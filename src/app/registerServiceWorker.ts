// PWA service worker. Production-only: under `vite dev` a worker intercepting module requests
// fights HMR. Test with `npm run build:view && npm run preview`.
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  // Scope-relative so it works at a domain root and under the GitHub Pages subpath alike.
  const url = new URL('sw.js', document.baseURI);

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type !== 'offline-progress') return;
    offline = { saved: event.data.saved, total: event.data.total };
    for (const listener of listeners) listener(offline);
  });

  const register = () =>
    navigator.serviceWorker
      .register(url)
      .then(() => requestOfflineStatus())
      .catch((err) => {
        // Losing offline play must not take the app down.
        console.warn('[titanpact] service worker registration failed', err);
      });
  // `load` may already have fired by the time the bundle runs, and then it never fires again.
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);
}

export interface OfflineProgress {
  saved: number;
  total: number;
}

let offline: OfflineProgress | null = null;
const listeners = new Set<(progress: OfflineProgress) => void>();

/** How much of the build is saved for offline play; null until the worker has answered. */
export function offlineProgress(): OfflineProgress | null {
  return offline;
}

export function onOfflineProgress(listener: (progress: OfflineProgress) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Asks the worker to report, saving whatever is still missing on the way. */
export function requestOfflineStatus(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  void navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: 'offline-status' }));
}
