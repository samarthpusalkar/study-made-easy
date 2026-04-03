import { CONFIG } from '../config.js';

const STORAGE_ENDPOINT = '/api/storage';

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getDefaultAppStore() {
  return {
    version: 1,
    sessions: [],
    preferences: {
      audio: { ...CONFIG.preferences.audio },
    },
  };
}

export function normalizeAppStore(store = {}) {
  const defaults = getDefaultAppStore();
  const safeStore = isObject(store) ? store : {};
  const safePreferences = isObject(safeStore.preferences) ? safeStore.preferences : {};
  const safeAudio = isObject(safePreferences.audio) ? safePreferences.audio : {};

  return {
    version: 1,
    sessions: Array.isArray(safeStore.sessions) ? safeStore.sessions : defaults.sessions,
    preferences: {
      ...defaults.preferences,
      ...safePreferences,
      audio: {
        ...defaults.preferences.audio,
        ...safeAudio,
        autoPlay: typeof safeAudio.autoPlay === 'boolean'
          ? safeAudio.autoPlay
          : defaults.preferences.audio.autoPlay,
        speed: typeof safeAudio.speed === 'number'
          ? safeAudio.speed
          : defaults.preferences.audio.speed,
      },
    },
  };
}

function hasUserData(store) {
  const normalized = normalizeAppStore(store);
  const defaults = getDefaultAppStore();

  return (
    normalized.sessions.length > 0
    || JSON.stringify(normalized.preferences) !== JSON.stringify(defaults.preferences)
  );
}

function readLocalStore() {
  try {
    const raw = localStorage.getItem(CONFIG.app.storageKey);
    if (raw) {
      return normalizeAppStore(JSON.parse(raw));
    }
  } catch (error) {
    console.error('Failed to read local app store', error);
  }

  try {
    const legacyRaw = localStorage.getItem(CONFIG.app.legacySessionStorageKey);
    if (legacyRaw) {
      const legacySessions = JSON.parse(legacyRaw);
      if (Array.isArray(legacySessions)) {
        return normalizeAppStore({ sessions: legacySessions });
      }
    }
  } catch (error) {
    console.error('Failed to read legacy session store', error);
  }

  return getDefaultAppStore();
}

function writeLocalStore(store) {
  const normalized = normalizeAppStore(store);
  localStorage.setItem(CONFIG.app.storageKey, JSON.stringify(normalized));
  localStorage.removeItem(CONFIG.app.legacySessionStorageKey);
  return normalized;
}

export async function loadAppStore() {
  const localStore = writeLocalStore(readLocalStore());

  try {
    const response = await fetch(STORAGE_ENDPOINT);
    if (!response.ok) {
      throw new Error(`Storage API returned ${response.status}`);
    }

    const remoteStore = normalizeAppStore(await response.json());

    if (!hasUserData(remoteStore) && hasUserData(localStore)) {
      await saveAppStore(localStore);
      return localStore;
    }

    writeLocalStore(remoteStore);
    return remoteStore;
  } catch (error) {
    console.warn('Storage API unavailable, using browser cache only', error);
    return localStore;
  }
}

export async function saveAppStore(store) {
  const normalized = writeLocalStore(store);

  try {
    const response = await fetch(STORAGE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized),
    });

    if (!response.ok) {
      throw new Error(`Storage API returned ${response.status}`);
    }
  } catch (error) {
    console.warn('Failed to sync app store to disk, browser cache is still updated', error);
  }

  return normalized;
}
