// vite.config.js
const { defineConfig } = require('vite');
const path = require('path');

module.exports = defineConfig({
  build: {
    outDir: '.vite/build',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/main.js'),
        preload: path.resolve(__dirname, 'src/preload.js'),
      },
      output: {
        entryFileNames: '[name].js',
        dir: path.resolve(__dirname, '.vite/build/main'),
        format: 'cjs'
      }
    }
  }
});