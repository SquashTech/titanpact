// PWA service worker. Production-only: under `vite dev` a worker intercepting module requests
// fights HMR. Test with `npm run build:view && npm run preview`.
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  // Scope-relative so it works at a domain root and under the GitHub Pages subpath alike.
  const url = new URL('sw.js', document.baseURI);

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(url).catch((err) => {
      // Losing offline play must not take the app down.
      console.warn('[titanpact] service worker registration failed', err);
    });
  });
}
