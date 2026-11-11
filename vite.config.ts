import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    // three.js는 그 자체로 크다. 게임 코드와 따로 묶어 두면 게임만 고쳤을 때 다시 받지 않아도 된다.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          return id.indexOf('node_modules/three/') !== -1 ? 'three' : undefined;
        },
      },
    },
  },
});
