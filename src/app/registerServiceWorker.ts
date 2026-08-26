/**
 * Installs the service worker that makes Titanpact an installable PWA — the
 * point being to play it from a phone's home screen, fullscreen, instead of
 * through browser chrome.
 *
 * Registration is production-only on purpose: under `vite dev` a worker
 * intercepting module requests fights HMR and produces "my edit didn't apply"
 * ghosts. Localhost is a secure context, so an installed dev build is not
 * needed to test any of this — `npm run build:view && npm run preview` is.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  // Scope-relative: works at a domain root and under the GitHub Pages
  // project subpath alike, matching the build's relative `base`.
  const url = new URL('sw.js', document.baseURI);

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(url).catch((err) => {
      // A failed registration costs offline play, not the game — an install
      // over plain http, say. Don't let it take the app down with it.
      console.warn('[titanpact] service worker registration failed', err);
    });
  });
}
