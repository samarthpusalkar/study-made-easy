/* global process */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

const STORAGE_FILE = path.resolve(process.cwd(), '.esa-storage.json');
const EMPTY_STORE = {
  version: 1,
  sessions: [],
  preferences: {},
};

function ensureStorageFile() {
  if (!fs.existsSync(STORAGE_FILE)) {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(EMPTY_STORE, null, 2), 'utf-8');
  }
}

function normalizeStoredData(data) {
  const safeData = typeof data === 'object' && data !== null ? data : {};
  return {
    version: 1,
    sessions: Array.isArray(safeData.sessions) ? safeData.sessions : [],
    preferences: typeof safeData.preferences === 'object' && safeData.preferences !== null
      ? safeData.preferences
      : {},
  };
}

function readStoredData() {
  ensureStorageFile();

  try {
    return normalizeStoredData(JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf-8')));
  } catch {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(EMPTY_STORE, null, 2), 'utf-8');
    return { ...EMPTY_STORE };
  }
}

function writeStoredData(data) {
  const normalized = normalizeStoredData(data);
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(normalized, null, 2), 'utf-8');
  return normalized;
}

function createStorageMiddleware() {
  return (req, res, next) => {
    const url = req.url?.split('?')[0];
    if (url !== '/api/storage') {
      next();
      return;
    }

    if (req.method === 'GET') {
      try {
        const store = readStoredData();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(store));
      } catch (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const payload = body ? JSON.parse(body) : EMPTY_STORE;
          const store = writeStoredData(payload);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(store));
        } catch (error) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    next();
  };
}

function storageApi() {
  return {
    name: 'esa-storage-api',
    configureServer(server) {
      server.middlewares.use(createStorageMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createStorageMiddleware());
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const ollamaProxyTarget = env.OLLAMA_PROXY_TARGET || 'http://localhost:11434';

  return {
    plugins: [react(), storageApi()],
    server: {
      port: 5173,
      proxy: {
        '/api/ollama': {
          target: ollamaProxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ollama/, ''),
        },
      },
    },
  };
});
