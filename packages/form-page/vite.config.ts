import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/f/',
  optimizeDeps: {
    include: ['@msgpunk/toolkit', '@msgpunk/toolkit/aes-gcm'],
  },
  build: {
    outDir: '../../crates/msgpunk-server/static',
    emptyOutDir: true,
    commonjsOptions: {
      include: [/toolkit/, /node_modules/],
    },
  },
});
