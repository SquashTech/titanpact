import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  root: '.',
  base: command === 'build' ? './' : '/',
  build: {
    outDir: 'dist-view',
  },
}));
