import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

const API_TARGET = process.env.VESTARA_API_URL ?? 'http://127.0.0.1:4310';

export default defineConfig({
  plugins: [react(), tailwindcss()],  server: {
    port: 5178,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
  test: {
    include: ['tests/ui-render.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 30_000,
  },
});
