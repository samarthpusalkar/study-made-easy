// import fs from 'fs'; // Unused Dependency
import { LoremIpsum } from 'lorem-ipsum';

const lorem = new LoremIpsum();
const text = lorem.generateParagraphs(100);

function chunkText(text, maxTokens) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += maxTokens) {
    chunks.push(words.slice(i, i + maxTokens).join(' '));
  }
  return chunks;
}

const paragraphs = text
  .split(/\n\s*\n/)
  .map((p) => p.trim())
  .filter((p) => p.length > 20);

console.log('Total paragraphs:', paragraphs.length);

let currentSection = { title: '', content: '', tokens: 0 };
let sectionNum = 1;
const sections = [];
const maxChunkTokens = 500;

for (const para of paragraphs) {
  const paraTokens = para.split(/\s+/).length;

  if (paraTokens > maxChunkTokens) {
    // If the single paragraph is larger than maxChunkTokens, chunk it
    // First, flush the current section if it has content
    if (currentSection.content) {
      sections.push({
        section_title: currentSection.title || `Section ${sectionNum}`,
        content: currentSection.content.trim(),
        index: sections.length,
      });
      sectionNum++;
      currentSection = { title: '', content: '', tokens: 0 };
    }

    const chunks = chunkText(para, maxChunkTokens);
    // Don't add 'Part 1' if there's only one chunk (though we know there's more since paraTokens > max)
    const firstLine = para.split('\n')[0];
    let candidateTitle = '';
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
    // Standard logic
    if (currentSection.tokens + paraTokens > maxChunkTokens && currentSection.content) {
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

if (currentSection.content.trim()) {
  sections.push({
    section_title: currentSection.title || `Section ${sectionNum}`,
    content: currentSection.content.trim(),
    index: sections.length,
  });
}

console.log('Sections:', sections.length);
if (sections.length > 0) {
  console.log('First Section chunk tokens:', sections[0].content.split(/\s+/).length);
  console.log('All Section tokens:', sections.map(s => s.content.split(/\s+/).length));
}
