import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: '.vite/build/preload', // 👈 separate folder from main
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/preload.js'), // 👈 only preload, not main
      formats: ['cjs'],
      fileName: () => 'preload.js'
    },
    rollupOptions: {
      external: ['electron'],
      // output: {
      //   entryFileNames: 'preload.js',
      //   dir: '.vite/build/preload'  // Add this line
      // }
    }
  },
})
