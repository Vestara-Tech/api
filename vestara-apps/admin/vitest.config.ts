import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const API_TARGET = process.env.VESTARA_API_URL ?? 'http://localhost:4310';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@vestara/ui': resolve(__dirname, '../../packages/vestara-ui/src/index.ts'),
    },
  },
  server: {
    port: 5179,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
