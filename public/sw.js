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

// v3: the app icon became the Titan's eye (scripts/generate-icons.mjs); the precached PNGs changed under the same names.
const VERSION = 'v3';
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

// Every built file, written by the precache-list plugin in vite.config.mts. Absent under `vite dev`.
const MANIFEST_URL = scoped('./precache.json');
const FETCH_WORKERS = 4;

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
      // The art before the new build takes over; the music follows on activate.
      await fill({ withMusic: false });
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
      await fill({ withMusic: true });
    })()
  );
});

// The page asks how much of the game is saved for offline play, and so restarts a fill the OS cut short.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'offline-status') return;
  event.waitUntil(fill({ withMusic: true }));
});

let filling = null;

function fill(options) {
  // A music fill asked for during an art-only one waits for it, then runs.
  const next = (filling ?? Promise.resolve()).then(() => runFill(options)).catch(() => {});
  filling = next.finally(() => {
    if (filling === next) filling = null;
  });
  return next;
}

async function readManifest() {
  const shell = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(MANIFEST_URL, { cache: 'reload' });
    if (res.ok) {
      await shell.put(MANIFEST_URL, res.clone());
      return { manifest: await res.json(), fresh: true };
    }
  } catch {
    /* offline: fall back to the saved copy */
  }
  const saved = await shell.match(MANIFEST_URL);
  return saved ? { manifest: await saved.json(), fresh: false } : null;
}

async function runFill({ withMusic }) {
  const read = await readManifest();
  if (!read) return broadcast({ saved: 0, total: 0 });
  const { manifest, fresh } = read;
  const wanted = [...manifest.core, ...manifest.music].map(scoped);
  const cache = await caches.open(ASSET_CACHE);

  // A fresh list is the whole build: anything else in the cache is an old build's and only takes room.
  if (fresh) {
    const keep = new Set(wanted);
    const keys = await cache.keys();
    await Promise.all(keys.filter((r) => !keep.has(r.url)).map((r) => cache.delete(r)));
  }

  const present = new Set((await cache.keys()).map((r) => r.url));
  const queue = (withMusic ? wanted : manifest.core.map(scoped)).filter((u) => !present.has(u));
  let saved = wanted.length - wanted.filter((u) => !present.has(u)).length;
  broadcast({ saved, total: wanted.length });

  const worker = async () => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          await cache.put(url, res);
          saved += 1;
          broadcast({ saved, total: wanted.length });
        }
      } catch {
        /* offline or a dropped connection: the next status request picks it up */
      }
    }
  };
  await Promise.all(Array.from({ length: FETCH_WORKERS }, worker));
}

async function broadcast(progress) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clients) client.postMessage({ type: 'offline-progress', ...progress });
}

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
    const cached = await cache.match(cacheKey, { ignoreVary: true });
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  // ignoreVary: a precached copy was fetched without the page's Origin header, and a hashed file never differs by it.
  const cached = await cache.match(request, { ignoreVary: true });
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
