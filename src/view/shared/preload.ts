// Images fetched and decoded before the screen that shows them mounts, so a painting never lands a
// beat after its screen. Vite inlines anything under 4KB into the bundle; everything larger — the
// Location paintings above all — is its own file, fetched the first time something draws it.
// Three moments load ahead: the launch screen (the title's first run: Wild's Edge), the title
// (everything else, quietly), and the next act's Location choice (its places, in case the quiet
// pass has not reached them yet).

import { ACT_ONE_LOCATION_ID } from '../../data/locations';
import { locationBackdropUrls } from './locationBackdrops';
import { heroArt, heroPoses } from './heroArt';
import { allMapNodeArtUrls } from '../run/mapNodeArt';
import { enchantedArtUrls } from './equipmentArt';

/** Held so a decoded image is not collected before the screen that wants it mounts. */
const loaded = new Map<string, Promise<void>>();
const held: HTMLImageElement[] = [];

/** Fetch and decode one image, once per session; never rejects. A bundled data: URL needs neither. */
export function preloadImage(url: string, priority: 'high' | 'low' = 'high'): Promise<void> {
  if (url.startsWith('data:')) return Promise.resolve();
  const known = loaded.get(url);
  if (known) return known;
  const img = new Image();
  img.decoding = 'async';
  (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = priority;
  img.src = url;
  held.push(img);
  const done = img.decode().catch(() => {
    // A failed decode is the screen's problem when it draws, not the preloader's.
  });
  loaded.set(url, done);
  return done;
}

/** All of them, or as many as land before `timeoutMs` — a slow connection must never hold a screen. */
export function preloadImages(urls: readonly string[], timeoutMs = Infinity): Promise<void> {
  const all = Promise.all(urls.map((url) => preloadImage(url))).then(() => undefined);
  if (!Number.isFinite(timeoutMs)) return all;
  return Promise.race([all, new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs))]);
}

/** A few at a time at low priority, starting when the page is idle, so it never competes with play. */
export function prefetchImages(urls: readonly string[], concurrency = 3): void {
  const queue = urls.filter((url) => !url.startsWith('data:') && !loaded.has(url));
  const next = (): void => {
    const url = queue.shift();
    if (url) void preloadImage(url, 'low').then(next);
  };
  const start = () => {
    for (let i = 0; i < concurrency; i++) next();
  };
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
  if (idle) idle(start);
  else window.setTimeout(start, 200);
}

/** Every painting a Location owns: arrival, map, arena, hall. */
export function locationArtUrls(locationIds: readonly string[]): string[] {
  return locationIds.flatMap((id) => locationBackdropUrls(id));
}

/** What the first minute of a new run shows: Wild's Edge. */
export function launchArtUrls(): string[] {
  return locationArtUrls([ACT_ONE_LOCATION_ID]);
}

/** Everything else worth having before it is asked for. */
export function allArtUrls(): string[] {
  const heroes = Object.values(heroArt).filter((url): url is string => !!url);
  const poses = Object.values(heroPoses).flatMap((p) => (p ? Object.values(p).filter((url): url is string => typeof url === 'string') : []));
  return [...locationBackdropUrls(), ...allMapNodeArtUrls(), ...heroes, ...poses, ...enchantedArtUrls()];
}
