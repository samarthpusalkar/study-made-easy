// Ollama LLM Service — handles all AI interactions
import { CONFIG } from '../config.js';

const OLLAMA_BASE_URL = CONFIG.ollama.baseUrl;
const MODEL = CONFIG.ollama.model;

/**
 * Robustly extract JSON from LLM response that might contain markdown, code blocks, etc.
 */
function extractJSON(text) {
  // Strip markdown code blocks
  let cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');

  // Try to find JSON object with balanced braces
  let depth = 0;
  let start = -1;

  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (cleaned[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        const candidate = cleaned.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          // Keep looking for another JSON block
          start = -1;
        }
      }
    }
  }

  return null;
}

async function chatCompletion(messages, options = {}) {
  const url = `${OLLAMA_BASE_URL}/api/chat`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model || MODEL,
      messages,
      stream: false,
      options: {
        temperature: options.temperature ?? CONFIG.ollama.temperature,
        num_predict: options.maxTokens ?? CONFIG.ollama.maxTokens,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[ESA] Ollama error:', response.status, errText);
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.message?.content || '';
}

/**
 * Check if Ollama is running and the model is available
 */
export async function checkOllamaStatus() {
  try {
    const url = `${OLLAMA_BASE_URL}/api/tags`;
    const res = await fetch(url);
    if (!res.ok) return { available: false, error: 'Ollama not responding' };
    const data = await res.json();
    const models = data.models?.map((m) => m.name) || [];
    const hasModel = models.some((m) => m.startsWith(MODEL));
    return {
      available: true,
      hasModel,
      models,
      error: hasModel ? null : `Model "${MODEL}" not found. Available: ${models.join(', ')}`,
    };
  } catch {
    return {
      available: false,
      error: `Cannot connect to the Ollama endpoint at ${OLLAMA_BASE_URL}.`,
    };
  }
}

/**
 * Assign complexity scores (1-5) to each section
 */
export async function scoreComplexity(sections) {
  const scored = [];

  for (const section of sections) {
    const prompt = `Rate the technical complexity of this educational content on a scale of 1-5:
1 = Basic definitions, common knowledge
2 = Simple concepts with some terminology
3 = Moderate - requires background knowledge
4 = Advanced - technical depth, specialized jargon
5 = Expert - requires deep domain expertise

Content:
"""
${section.content.substring(0, 800)}
"""

Respond with ONLY a JSON object: {"score": <number>, "reason": "<brief reason>"}`;

    try {
      const response = await chatCompletion([{ role: 'user', content: prompt }], {
        temperature: 0.3,
        maxTokens: 100,
      });
      const parsed = extractJSON(response) || { score: 3, reason: 'default' };
      scored.push({
        ...section,
        complexity_score: Math.min(5, Math.max(1, parsed.score)),
        complexity_reason: parsed.reason,
      });
    } catch {
      scored.push({ ...section, complexity_score: 3, complexity_reason: 'Could not assess' });
    }
  }

  return scored;
}

/**
 * Simplify content using web search results and LLM
 */
export async function simplifyContent(section, webResults = []) {
  const webContext = webResults.length
    ? `\n\nAdditional context from web search:\n${webResults.map((r) => `- ${r.text}`).join('\n')}`
    : '';

  const prompt = `You are an expert educator. Simplify the following educational content for a beginner student.

Rules:
- Replace technical jargon with simple explanations in parentheses
- Add a relatable analogy or everyday example
- Keep the core meaning accurate
- Write in clear, conversational language
- Keep it concise (max 150 words)
${webContext}

Original content:
"""
${section.content}
"""

Respond with the simplified content only, no preamble.`;

  const simplified = await chatCompletion([{ role: 'user', content: prompt }], {
    temperature: 0.6,
  });

  return { ...section, content: simplified, original_content: section.content };
}

/**
 * Summarize accumulated narrative context into a concise summary.
 * Called by the pipeline when unsummarized scripts exceed the char threshold.
 * @param {string} existingSummary - The current running summary (empty string if first summarization)
 * @param {string[]} recentScripts - Array of {title, script} entries since last summarization
 * @returns {Promise<string>} Condensed narrative summary
 */
export async function summarizeNarrativeContext(existingSummary, recentScripts) {
  const scriptBlock = recentScripts
    .map((s) => `[${s.title}]: ${s.script}`)
    .join('\n\n');

  const priorContext = existingSummary
    ? `Previous lecture summary:\n"""\n${existingSummary}\n"""\n\n`
    : '';

  const prompt = `You are summarizing the narrative arc of an ongoing lecture for internal use by an AI slide generator.

${priorContext}New slides since last summary:
"""
${scriptBlock}
"""

Write a concise summary (max 200 words) that captures:
1. The key concepts and topics covered so far, in order
2. The narrative thread / flow of the lecture
3. The last topic discussed and where the lecturer left off

This summary will be used to help generate the NEXT slides so the lecture feels continuous. Be factual and dense — no filler. Respond with ONLY the summary text, nothing else.`;

  try {
    const response = await chatCompletion([{ role: 'user', content: prompt }], {
      temperature: 0.3,
      maxTokens: CONFIG.narrative.summaryMaxTokens,
    });
    return response.trim();
  } catch (err) {
    console.error('[ESA] Narrative summarization failed:', err);
    // Fallback: just use the existing summary or empty string
    return existingSummary || '';
  }
}

/**
 * Generate slide content from a processed section
 * @param {object} section - The content section to convert
 * @param {string} mode - The study mode
 * @param {object} narrativeContext - Context for narration continuity
 * @param {number} narrativeContext.slideIndex - 0-based index of this slide
 * @param {number} narrativeContext.totalSlides - Total number of slides being generated
 * @param {string|null} narrativeContext.previousSlideScript - Speaker notes from the immediately previous slide
 * @param {string|null} narrativeContext.previousSlideTitle - Title of the immediately previous slide
 * @param {string|null} narrativeContext.narrativeSummary - Compressed summary of ALL earlier slides (long-term memory)
 */
export async function generateSlideContent(section, mode, narrativeContext = {}) {
  const modeConfig = CONFIG.modes[mode];
  const selfTestLine = modeConfig.includeSelfTest
    ? '- Include ONE self-test question at the end (start with "🤔 ")'
    : '- Do NOT include any questions';
  const exampleLine = modeConfig.includeExamples
    ? '- Include a brief real-world example or analogy'
    : '- Do NOT include examples or analogies';

  const {
    slideIndex = 0,
    totalSlides = 1,
    previousSlideScript = null,
    previousSlideTitle = null,
    narrativeSummary = null,
  } = narrativeContext;
  const isFirstSlide = slideIndex === 0;
  const isLastSlide = slideIndex === totalSlides - 1;
  const maxPrevChars = CONFIG.narrative.previousSlideContextChars;

  // Build the narration continuity instruction based on slide position
  let narrationInstruction;
  if (isFirstSlide) {
    narrationInstruction = `- Speaker Notes: This is the FIRST slide of the lecture. Write a warm, engaging opening that welcomes the student, briefly introduces the overall topic, and then dives into this slide's content. Set the tone for the entire lecture. Make it sound like a true, passionate lecturer beginning a class.`;
  } else {
    // Short-term memory: tail of previous slide's script
    const prevScriptTail = previousSlideScript
      ? previousSlideScript.slice(-maxPrevChars)
      : '';

    // Long-term memory: compressed summary of all earlier slides
    const summaryBlock = narrativeSummary
      ? '\n- LECTURE SUMMARY SO FAR (topics already covered — do not repeat introductions for these):\n"""' + narrativeSummary + '"""'
      : '';

    const lastSlideNote = isLastSlide
      ? '\n- This is the LAST slide. End with a brief, encouraging wrap-up summarizing what was covered across the lecture.'
      : '';

    narrationInstruction = '- Speaker Notes: This is slide ' + (slideIndex + 1) + ' of ' + totalSlides + ' in an ongoing lecture. You are CONTINUING a lecture already in progress -- do NOT start with "Welcome", "Hello", "Today we will learn", or any introductory greeting. Instead, use a smooth transition from the previous slide (titled: "' + (previousSlideTitle || 'previous topic') + '"). Pick up where the lecturer left off and naturally bridge into this new concept. The narration should feel like one continuous, flowing lecture.' + summaryBlock + '\n- Here is the END of the previous slide\'s narration for context (continue from here):\n"""' + prevScriptTail + '"""' + lastSlideNote;
  }

const prompt = `You MUST respond with ONLY valid JSON, no other text. Convert this educational content into a presentation slide.

Rules:
- Title: Short, descriptive (max 8 words)
- Bullet points: Max ${CONFIG.slides.maxBulletPoints} bullets, each 1-2 sentences. Do NOT cram everything into bullets.
- Use emoji at the start of each bullet for visual clarity
${narrationInstruction}
- The speaker notes must provide detailed analogies and examples, and explicitly expand on the bullets. Do not just read the bullets.
${exampleLine}
${selfTestLine}

Respond with ONLY this JSON structure, nothing else:
{"title": "Your Title Here", "bullets": ["bullet 1", "bullet 2", "bullet 3"], "example": "an example or null", "selfTestQuestion": "a question or null", "speakerNotes": "Your detailed lecture script here"}

Content to convert:
"""
${section.content}
"""`;

  try {
    const response = await chatCompletion([{ role: 'user', content: prompt }], {
      temperature: 0.5,
      maxTokens: 4096,
    });
    const parsed = extractJSON(response) || {};
    return {
      title: parsed.title || section.section_title || 'Untitled Slide',
      bullets: Array.isArray(parsed.bullets) && parsed.bullets.length > 0 ? parsed.bullets : [section.content.substring(0, 200) + '...'],
      example: parsed.example || null,
      selfTestQuestion: parsed.selfTestQuestion || null,
      speakerNotes: parsed.speakerNotes || section.content,
      complexity_score: section.complexity_score,
      sectionIndex: section.index,
    };
  } catch {
    return {
      title: section.section_title || 'Content',
      bullets: [section.content.substring(0, 200) + '...'],
      example: null,
      selfTestQuestion: null,
      speakerNotes: section.content,
      complexity_score: section.complexity_score,
      sectionIndex: section.index,
    };
  }
}

/**
 * Answer a user question with slide context
 */
export async function answerQuestion(question, currentSlide, chatHistory = []) {
  const contextMessages = chatHistory.slice(-6).map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  const systemPrompt = `You are a helpful study tutor. The student is viewing a presentation slide and has a question.

Current slide:
Title: ${currentSlide?.title || 'N/A'}
Content: ${currentSlide?.bullets?.join('. ') || 'N/A'}
${currentSlide?.example ? `Example: ${currentSlide.example}` : ''}

Rules:
- Answer concisely (max 100 words)
- Use the slide context to give relevant answers
- If the question is about something not on the slide, still answer helpfully
- Use simple language and examples
- End with a JSON flag on a new line: {"shouldCreateSlide": true/false, "confidence": 0.0-1.0}
  Set shouldCreateSlide to true ONLY if the question reveals a fundamental gap that needs its own slide.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...contextMessages,
    { role: 'user', content: question },
  ];

  const response = await chatCompletion(messages, { temperature: 0.6 });

  // Try to extract the JSON flag
  let shouldCreateSlide = false;
  let confidence = 0;
  try {
    const flags = extractJSON(response);
    if (flags && 'shouldCreateSlide' in flags) {
      shouldCreateSlide = flags.shouldCreateSlide === true;
      confidence = flags.confidence || 0;
    }
  } catch {
    // Ignore parse errors
  }

  // Clean the answer (remove JSON blocks)
  const cleanAnswer = response
    .replace(/```json[\s\S]*?```/g, '')
    .replace(/\{[^{}]*"shouldCreateSlide"[^{}]*\}/g, '')
    .trim();

  return {
    answer: cleanAnswer,
    shouldCreateSlide: shouldCreateSlide && confidence >= CONFIG.slides.newSlideConfidenceThreshold,
    confidence,
  };
}

/**
 * Evaluate a user's answer to a self-test question
 */
export async function evaluateAnswer(question, answer, slideContext) {
  const prompt = `You are an encouraging study tutor. The student answered a self-test question based on the slide.
Question: "${question}"
Student's Answer: "${answer}"
Context: "${slideContext}"

Evaluate the answer. Be encouraging. Correct them gently if wrong, confirm if right, and briefly explain why based on the context. Keep it under 60 words.`;

  const response = await chatCompletion([{ role: 'user', content: prompt }], {
    temperature: 0.6,
  });
  
  return response.replace(/```.*?```/gs, '').trim();
}

/**
 * Generate a new slide for a concept identified during Q&A
 */
export async function generateGapSlide(concept, context) {
  const prompt = `Create a clear, beginner-friendly explanatory slide for the concept: "${concept}"

Context for why this is needed: The student asked about this while studying: "${context}"

Format as JSON:
{
  "title": "...",
  "bullets": ["...", "...", "..."],
  "example": "...",
  "speakerNotes": "..."
}`;

  try {
    const response = await chatCompletion([{ role: 'user', content: prompt }], {
      temperature: 0.5,
    });
    const parsed = extractJSON(response) || {};
    return {
      title: parsed.title || concept,
      bullets: parsed.bullets || [`Definition of ${concept}`],
      example: parsed.example || null,
      selfTestQuestion: null,
      speakerNotes: parsed.speakerNotes || `Let's understand ${concept}.`,
      complexity_score: 1,
      isGapSlide: true,
    };
  } catch {
    return {
      title: concept,
      bullets: [`Understanding ${concept}`],
      example: null,
      selfTestQuestion: null,
      speakerNotes: `Let's explore ${concept}.`,
      complexity_score: 1,
      isGapSlide: true,
    };
  }
}
