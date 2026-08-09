import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // the tool must keep working when opened straight off disk
  base: './',
  build: { outDir: 'dist', sourcemap: true }
});
