const DEFAULT_OLLAMA_BASE_URL = (import.meta.env.VITE_OLLAMA_BASE_URL || '/api/ollama').replace(/\/$/, '');
const DEFAULT_OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'openvoid/Void-Gemini';

// ESA Configuration
export const CONFIG = {
  app: {
    name: 'ESA',
    fullName: 'Engaging Study Assistant',
    tagline: 'Study made easy',
    storageKey: 'esa_saved_sessions',
  },

  // Ollama settings
  ollama: {
    baseUrl: DEFAULT_OLLAMA_BASE_URL,
    model: DEFAULT_OLLAMA_MODEL,
    maxTokens: 8192,
    temperature: 0.7,
  },

  // Content processing
  content: {
    maxChunkTokens: 2000, // Reduced to force more granular slides without skipping
    maxDocumentPages: 1000,
    maxDocumentTokens: 500000,
  },

  // Mode thresholds (max complexity_score allowed before gap-filling triggers)
  modes: {
    'quick-prep': {
      label: 'Quick Prep',
      description: 'Key terms & definitions only. Perfect for last-minute review.',
      icon: '⚡',
      maxComplexity: 2,
      includeExamples: false,
      includeSelfTest: false,
    },
    'revision': {
      label: 'Revision',
      description: 'Balanced depth with self-test questions. Great for active recall.',
      icon: '📚',
      maxComplexity: 3,
      includeExamples: true,
      includeSelfTest: true,
    },
    'deep-dive': {
      label: 'Deep Dive',
      description: 'Full explanations with examples & analogies. For thorough understanding.',
      icon: '🧠',
      maxComplexity: 5,
      includeExamples: true,
      includeSelfTest: true,
    },
  },

  // TTS settings
  tts: {
    defaultSpeed: 1.25,
    minSpeed: 0.75,
    maxSpeed: 2.0,
    speedStep: 0.25,
    preferredVoices: ['Google US English', 'Samantha', 'Alex', 'Daniel'],
  },

  // Slide settings
  slides: {
    maxBulletPoints: 5, // Increased to allow more detail per slide
    newSlideConfidenceThreshold: 0.9,
  },

  // Search settings
  search: {
    maxResults: 3,
    queryTemplate: 'simple explanation of {concept} for beginners',
  },
};
