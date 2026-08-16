import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const API_TARGET = process.env.VESTARA_API_URL ?? 'http://127.0.0.1:4310';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom', '@emotion/react', '@emotion/styled', '@mui/material'],
  },
  server: {
    port: 5178,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
