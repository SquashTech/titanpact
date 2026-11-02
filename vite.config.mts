import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Lists every emitted file for the service worker to save on install, so a sprite or track the
// player has not reached yet still loads offline. Music goes in its own list: it is most of the bytes.
function precacheList(): Plugin {
  return {
    name: 'titanpact-precache-list',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.html') && !f.endsWith('.map'));
      const isMusic = (f: string) => /\.(flac|mp3|ogg|wav|m4a)$/i.test(f);
      this.emitFile({
        type: 'asset',
        fileName: 'precache.json',
        source: JSON.stringify({ core: files.filter((f) => !isMusic(f)), music: files.filter(isMusic) }),
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [react(), precacheList()],
  root: '.',
  base: command === 'build' ? './' : '/',
  define: {
    __BUILD_SHA__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 8) ?? 'dev'),
  },
  build: {
    outDir: 'dist-view',
  },
}));
