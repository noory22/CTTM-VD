// vite.renderer.config.mjs
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'src',                     // <---- where your index.html & renderer.jsx live
  plugins: [react(),tailwindcss()],
  base: './',
  build: {
    outDir: '../dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5173,                     // port for Vite dev server
  },
});
