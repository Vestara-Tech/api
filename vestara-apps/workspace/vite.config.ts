import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_TARGET = process.env.VESTARA_API_URL ?? 'http://localhost:4310';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@vestara/ui': resolve(__dirname, '../../packages/vestara-ui/src/index.ts'),
    },
    dedupe: ['react', 'react-dom', '@emotion/react', '@emotion/styled', '@mui/material'],
  },
  server: {
    port: 5180,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
