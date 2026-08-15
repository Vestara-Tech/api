import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

const API_TARGET = process.env.VESTARA_API_URL ?? 'http://localhost:4310';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@vestara/ai-ui': resolve(__dirname, '../../packages/ai-ui/src/index.ts'),
      '@vestara/ai-ui/src/api/contracts': resolve(__dirname, '../../packages/ai-ui/src/api/contracts.ts'),
    },
  },
  server: {
    port: 5176,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/ui-render.test.ts'],
    environment: 'node',
  },
});
