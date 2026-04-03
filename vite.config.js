/* global process */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const ollamaProxyTarget = env.OLLAMA_PROXY_TARGET || 'http://localhost:11434';

  return {
    plugins: [react()],
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
