// Content Pipeline — orchestrates the full document → slides workflow
import { parseDocument } from '../services/documentParser.js';
import { scoreComplexity, simplifyContent, generateSlideContent } from '../services/ollamaService.js';
import { searchConcept } from '../services/searchService.js';
import { CONFIG } from '../config.js';

/**
 * Process a document through the full pipeline
 * @param {File|string} input - File or raw text
 * @param {string} mode - 'quick-prep' | 'revision' | 'deep-dive'
 * @param {function} onProgress - callback({step, message, percent})
 * @returns {Promise<{slides: Array, metadata: Object}>}
 */
export async function processDocument(input, mode, onProgress) {
  const modeConfig = CONFIG.modes[mode];
  const progress = (step, message, percent) => {
    if (onProgress) onProgress({ step, message, percent });
  };

  // Step 1: Parse document
  progress('parsing', 'Reading and parsing your document...', 5);
  const parsed = await parseDocument(input);
  progress('parsing', `Found ${parsed.sections.length} sections (${parsed.totalTokens} tokens)`, 15);

  if (parsed.sections.length === 0) {
    throw new Error('No content found in the document. Please check the file and try again.');
  }

  // Step 2: Score complexity
  progress('analyzing', 'Analyzing content complexity with AI...', 20);
  const scoredSections = await scoreComplexity(parsed.sections);
  progress('analyzing', 'Complexity analysis complete', 35);

  // Step 3: Identify gaps and enrich
  progress('enriching', 'Finding and filling knowledge gaps...', 40);
  const enrichedSections = [];
  const totalSections = scoredSections.length;

  for (let i = 0; i < totalSections; i++) {
    const section = scoredSections[i];
    const percentInStep = 40 + (i / totalSections) * 25;

    if (section.complexity_score > modeConfig.maxComplexity) {
      // This section is too complex for the selected mode — simplify it
      progress(
        'enriching',
        `Simplifying: "${section.section_title}" (complexity ${section.complexity_score}/${modeConfig.maxComplexity})...`,
        percentInStep
      );

      // Search for simpler explanations
      const searchResults = await searchConcept(section.section_title);

      // Simplify with LLM + web results
      const simplified = await simplifyContent(section, searchResults);
      enrichedSections.push(simplified);
    } else {
      enrichedSections.push(section);
    }
  }

  progress('enriching', 'Content enrichment complete', 65);

  // Step 4: Generate slides
  progress('generating', 'Creating presentation slides...', 70);
  const slides = [];

  for (let i = 0; i < enrichedSections.length; i++) {
    const section = enrichedSections[i];
    const percentInStep = 70 + (i / enrichedSections.length) * 25;

    progress(
      'generating',
      `Generating slide ${i + 1} of ${enrichedSections.length}...`,
      percentInStep
    );

    const slide = await generateSlideContent(section, mode);
    slides.push(slide);
  }

  progress('generating', 'All slides generated!', 95);

  // Step 5: Prepare audio (just mark as ready, TTS is on-demand)
  progress('audio', 'Preparing audio narration...', 98);
  // Audio is generated on-demand via TTS service, not pre-generated
  progress('complete', 'Your study session is ready! 🎉', 100);

  return {
    slides,
    metadata: {
      fileName: parsed.fileName,
      totalTokens: parsed.totalTokens,
      totalSections: parsed.sections.length,
      totalSlides: slides.length,
      mode,
      processedAt: new Date().toISOString(),
    },
  };
}
