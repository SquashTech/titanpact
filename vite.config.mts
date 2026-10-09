import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  root: '.',
  base: command === 'build' ? './' : '/',
  define: {
    __BUILD_SHA__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 8) ?? 'dev'),
  },
  build: {
    outDir: 'dist-view',
  },
}));
