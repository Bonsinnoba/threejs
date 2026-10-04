import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        lab: resolve(projectRoot, 'index.html'),
        technology: resolve(projectRoot, 'technology.html')
      }
    }
  }
});