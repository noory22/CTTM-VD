import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    outDir: 'dist/renderer',      // <-- Put production HTML/assets here
    emptyOutDir: true,            // <-- Clears the folder before each build
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'), // Entry point
    },
  },
})