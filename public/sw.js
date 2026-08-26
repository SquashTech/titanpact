/*
 * Titanpact service worker.
 *
 * Two jobs, in this order of importance:
 *   1. Make the app installable and playable offline once it has been opened.
 *   2. Never serve a stale build. This repo ships several times a day, so a
 *      cache-first shell — the usual PWA default — would quietly pin a phone
 *      to an old bundle and make "test it on mobile" actively misleading.
 *
 * Hence the split strategy below: the HTML entry is network-first (fresh
 * whenever there's signal, cached only as an offline fallback), while
 * everything under assets/ is cache-first because Vite content-hashes those
 * filenames — a given URL's bytes can never change.
 */

const VERSION = 'v2';
const SHELL_CACHE = `titanpact-shell-${VERSION}`;
const ASSET_CACHE = `titanpact-assets-${VERSION}`;
const OWNED = [SHELL_CACHE, ASSET_CACHE];

// Scope-relative so the same worker works at the Vite dev root and under the
// GitHub Pages project subpath (/titanpact/) without a build step.
const scoped = (path) => new URL(path, self.registration.scope).toString();
const SHELL_URL = scoped('./');

const PRECACHE = [
  SHELL_URL,
  scoped('./manifest.webmanifest'),
  scoped('./icons/icon-192.png'),
  scoped('./icons/icon-512.png'),
  scoped('./icons/icon-maskable-512.png'),
  scoped('./icons/apple-touch-icon-180.png'),
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Individually, not addAll: one 404 (an icon renamed, say) must not
      // abort the whole install and leave the app uninstallable.
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: 'reload' }));
          } catch {
            /* non-fatal */
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('titanpact-') && !OWNED.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

/**
 * `fetchRequest` is what actually goes to the network and is not always
 * `request` — a navigation is answered by the shell URL — while `cacheKey` is
 * what the result is stored and looked up under.
 */
async function networkFirst(request, cacheName, { fetchRequest = request, cacheKey = request } = {}) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(fetchRequest);
    if (fresh && fresh.ok) cache.put(cacheKey, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations always resolve to the single-page shell, and the shell is
  // fetched with `cache: 'reload'` so the browser's OWN http cache cannot
  // answer it. GitHub Pages sends `Cache-Control: max-age=600` on the HTML, so
  // a plain fetch() here could hand a relaunched app a ten-minute-old shell —
  // which is the exact staleness this worker is network-first to prevent.
  // Built from the URL rather than `new Request(request, …)` because a
  // navigation request's `navigate` mode cannot be reconstructed.
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, SHELL_CACHE, {
        fetchRequest: new Request(SHELL_URL, { cache: 'reload', credentials: 'same-origin' }),
        cacheKey: SHELL_URL,
      })
    );
    return;
  }

  // Hashed build output — immutable by construction.
  if (url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  event.respondWith(networkFirst(request, SHELL_CACHE));
});
