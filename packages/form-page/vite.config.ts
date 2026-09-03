import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/f/',
  build: {
    outDir: '../../crates/msgpunk-server/static',
    emptyOutDir: true,
  },
});
