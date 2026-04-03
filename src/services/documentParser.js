// Document Parser Service — converts various formats to intermediate JSON
// import { marked } from 'marked'; // Unused Dependency
import { CONFIG } from '../config.js';

/**
 * Parse a file or raw text into standardized sections
 * @param {File|string} input - File object or raw text string
 * @returns {Promise<{sections: Array<{section_title, content, index}>}>}
 */
export async function parseDocument(input) {
  let text = '';
  let fileName = 'pasted-text';

  if (typeof input === 'string') {
    text = input;
  } else if (input instanceof File) {
    fileName = input.name;
    const ext = fileName.split('.').pop().toLowerCase();

    switch (ext) {
      case 'txt':
        text = await input.text();
        break;
      case 'md':
        text = await input.text();
        break;
      case 'html':
      case 'htm':
        text = await parseHTML(await input.text());
        break;
      case 'pdf':
        text = await parsePDF(input);
        break;
      default:
        text = await input.text();
    }
  }

  // Enforce max token limit
  const tokens = text.split(/\s+/);
  if (tokens.length > CONFIG.content.maxDocumentTokens) {
    text = tokens.slice(0, CONFIG.content.maxDocumentTokens).join(' ');
  }

  const sections = splitIntoSections(text);
  return {
    fileName,
    totalTokens: text.split(/\s+/).length,
    sections,
  };
}

/**
 * Parse HTML content to plain text
 */
function parseHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove scripts and styles
  doc.querySelectorAll('script, style, nav, footer, header').forEach((el) => el.remove());

  // Extract text preserving some structure
  const body = doc.body;
  let result = '';

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
        result += '\n\n## ' + node.textContent.trim() + '\n\n';
      } else if (['p', 'div', 'section', 'article'].includes(tag)) {
        result += '\n';
        node.childNodes.forEach(walk);
        result += '\n';
      } else if (['li'].includes(tag)) {
        result += '\n- ' + node.textContent.trim();
      } else {
        node.childNodes.forEach(walk);
      }
    }
  }

  walk(body);
  return result.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Parse PDF using pdf.js
 */
async function parsePDF(file) {
  try {
    const pdfjsLib = await import('pdfjs-dist');

    // Set worker source
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const maxPages = Math.min(pdf.numPages, CONFIG.content.maxDocumentPages);

    let fullText = '';
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str).join(' ');
      fullText += `\n\n--- Page ${i} ---\n\n${pageText}`;
    }

    return fullText.trim();
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to parse PDF. The file may be corrupted or password-protected.');
  }
}

/**
 * Split text into sections based on headings, paragraphs, or chunks
 */
function splitIntoSections(text) {
  const sections = [];
  const targetTokens = CONFIG.content.targetSectionTokens || CONFIG.content.maxChunkTokens;
  const maxChunkTokens = CONFIG.content.maxChunkTokens;

  // Try to split by markdown headings first
  const headingPattern = /^#{1,3}\s+(.+)$/gm;
  const headings = [...text.matchAll(headingPattern)];

  if (headings.length >= 2) {
    // Split by headings
    for (let i = 0; i < headings.length; i++) {
      const start = headings[i].index;
      const end = i + 1 < headings.length ? headings[i + 1].index : text.length;
      const sectionText = text.slice(start, end).trim();
      const title = headings[i][1].trim();
      const content = sectionText.replace(/^#{1,3}\s+.+\n*/, '').trim();

      if (content.length > 20) {
        const chunks = chunkTextSmart(content, targetTokens, maxChunkTokens);
        chunks.forEach((chunk, ci) => {
          sections.push({
            section_title: chunks.length > 1 ? `${title} (${ci + 1}/${chunks.length})` : title,
            content: chunk,
            index: sections.length,
          });
        });
      }
    }
  } else {
    // Split by double newlines (paragraphs)
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 20);

    if (paragraphs.length === 0) {
      // Just chunk the whole thing
      const chunks = chunkTextSmart(text, targetTokens, maxChunkTokens);
      chunks.forEach((chunk, i) => {
        sections.push({
          section_title: `Section ${i + 1}`,
          content: chunk,
          index: i,
        });
      });
    } else {
      // Group paragraphs into sections within token limits
      let currentSection = { title: '', content: '', tokens: 0 };
      let sectionNum = 1;

      for (const para of paragraphs) {
        const paraTokens = para.split(/\s+/).length;

        if (paraTokens > maxChunkTokens) {
          // Flush the current section, then chunk oversized paragraphs smartly.
          if (currentSection.content) {
            sections.push({
              section_title: currentSection.title || `Section ${sectionNum}`,
              content: currentSection.content.trim(),
              index: sections.length,
            });
            sectionNum++;
            currentSection = { title: '', content: '', tokens: 0 };
          }

          const chunks = chunkTextSmart(para, targetTokens, maxChunkTokens);
          let candidateTitle = '';
          const firstLine = para.split('\n')[0];
          if (firstLine.length < 80) {
            candidateTitle = firstLine.replace(/^[-*#]+\s*/, '');
          }
          
          chunks.forEach((chunk, i) => {
            let title = candidateTitle || `Section ${sectionNum}`;
            if (chunks.length > 1) {
              title += ` (Part ${i + 1})`;
            }
            sections.push({
               section_title: title,
               content: chunk,
               index: sections.length,
            });
          });
          sectionNum++;
        } else {
          if (currentSection.tokens + paraTokens > targetTokens && currentSection.content) {
            sections.push({
              section_title: currentSection.title || `Section ${sectionNum}`,
              content: currentSection.content.trim(),
              index: sections.length,
            });
            sectionNum++;
            currentSection = { title: '', content: '', tokens: 0 };
          }

          // Try to extract a title from the first line
          if (!currentSection.title) {
            const firstLine = para.split('\n')[0];
            if (firstLine.length < 80) {
              currentSection.title = firstLine.replace(/^[-*#]+\s*/, '');
            }
          }

          currentSection.content += para + '\n\n';
          currentSection.tokens += paraTokens;
        }
      }

      // Don't forget the last section
      if (currentSection.content.trim()) {
        sections.push({
          section_title: currentSection.title || `Section ${sectionNum}`,
          content: currentSection.content.trim(),
          index: sections.length,
        });
      }
    }
  }

  return sections;
}

/**
 * Chunk text into slide-sized pieces, preferring paragraph/sentence boundaries.
 */
function chunkTextSmart(text, targetTokens, maxTokens) {
  const blocks = text
    .split(/\n\s*\n/)
    .flatMap((paragraph) => splitParagraphIntoBlocks(paragraph))
    .map((block) => block.trim())
    .filter(Boolean);

  const chunks = [];
  let currentChunk = [];
  let currentTokens = 0;

  const flushCurrentChunk = () => {
    if (currentChunk.length === 0) return;
    chunks.push(currentChunk.join(' ').trim());
    currentChunk = [];
    currentTokens = 0;
  };

  for (const block of blocks) {
    const blockTokens = countTokens(block);

    if (blockTokens > maxTokens) {
      flushCurrentChunk();

      const words = block.split(/\s+/);
      for (let i = 0; i < words.length; i += maxTokens) {
        chunks.push(words.slice(i, i + maxTokens).join(' '));
      }
      continue;
    }

    if (currentTokens + blockTokens > targetTokens && currentChunk.length > 0) {
      flushCurrentChunk();
    }

    currentChunk.push(block);
    currentTokens += blockTokens;
  }

  flushCurrentChunk();

  return chunks.length > 0 ? chunks : chunkTextByWords(text, maxTokens);
}

function splitParagraphIntoBlocks(paragraph) {
  const sentenceLikeBlocks = paragraph
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'`(])/)
    .map((block) => block.trim())
    .filter(Boolean);

  return sentenceLikeBlocks.length > 0 ? sentenceLikeBlocks : [paragraph];
}

function chunkTextByWords(text, maxTokens) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];

  for (let i = 0; i < words.length; i += maxTokens) {
    chunks.push(words.slice(i, i + maxTokens).join(' '));
  }

  return chunks;
}

function countTokens(text) {
  return text.split(/\s+/).filter(Boolean).length;
}
