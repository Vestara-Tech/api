import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const API_TARGET = process.env.VESTARA_API_URL ?? 'http://127.0.0.1:4310';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@vestara/client': resolve(__dirname, '../../packages/vestara-client/src/index.ts'),
    },
  },
  server: {
    port: 5175,
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
