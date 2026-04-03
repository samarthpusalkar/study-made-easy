// Search Service — web search for gap-filling
// Uses DuckDuckGo Instant Answer API (no API key needed)
import { CONFIG } from '../config.js';

/**
 * Search for simple explanations of a concept
 * @param {string} concept - The concept to search for
 * @param {number} maxResults - Maximum results to return
 * @returns {Promise<Array<{title, text, url}>>}
 */
export async function searchConcept(concept, maxResults = CONFIG.search.maxResults) {
  const query = CONFIG.search.queryTemplate.replace('{concept}', concept);

  try {
    // Try DuckDuckGo Instant Answer API
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

    const response = await fetch(ddgUrl);
    if (!response.ok) throw new Error('DDG API failed');

    const data = await response.json();
    const results = [];

    // Abstract (main answer)
    if (data.Abstract) {
      results.push({
        title: data.Heading || concept,
        text: data.Abstract,
        url: data.AbstractURL || '',
        source: 'DuckDuckGo',
      });
    }

    // Related topics
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, maxResults - results.length)) {
        if (topic.Text) {
          results.push({
            title: topic.Text.split(' - ')[0] || concept,
            text: topic.Text,
            url: topic.FirstURL || '',
            source: 'DuckDuckGo',
          });
        }
      }
    }

    // Definition
    if (data.Definition && results.length < maxResults) {
      results.push({
        title: `Definition: ${concept}`,
        text: data.Definition,
        url: data.DefinitionURL || '',
        source: data.DefinitionSource || 'DuckDuckGo',
      });
    }

    return results.slice(0, maxResults);
  } catch (error) {
    console.warn('Web search failed, falling back to LLM knowledge:', error);
    // Fallback: return empty array, LLM will use its own knowledge
    return [];
  }
}
