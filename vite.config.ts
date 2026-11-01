import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import path from 'path';

export default defineConfig({
  plugins: [
    angular()
  ],
  resolve: {
    alias: {
      '@angular-video/core': path.resolve(import.meta.dirname, './packages/core/src/index.ts'),
      '@angular-video/studio': path.resolve(import.meta.dirname, './packages/studio/src/index.ts')
    }
  },
  server: {
    port: 4250,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
});
