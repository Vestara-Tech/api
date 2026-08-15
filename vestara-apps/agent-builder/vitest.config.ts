import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const API_TARGET = process.env.VESTARA_API_URL ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@vestara/ai-ui': resolve(__dirname, '../../packages/ai-ui/src/index.ts'),
    },
  },
  server: {
    port: 5177,
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
