import { useEffect } from 'react';

/**
 * Reloads the page when the server is serving a newer build than the one
 * running, so a phone testing the deployed app picks up a push without the
 * swipe-away-in-the-App-Switcher dance (iOS resumes a suspended web app rather
 * than re-navigating it, so simply reopening the icon never fetches anything).
 *
 * **Caller must gate this to the title screen.** A run lives only in React
 * state — nothing persists it — so a reload at any other moment silently
 * destroys one. The title screen is the one place with nothing to lose: the
 * only routes back to it are closing Sandbox setup and finishing a
 * Quick/Sandbox/status-test battle, none of which touch run state.
 *
 * Detection compares the hashed bundle the page booted from against the one the
 * server's HTML now points at. Deliberately not the service worker's own update
 * cycle: `sw.js` only changes when the worker itself is edited, so it would miss
 * every ordinary app change — which is nearly all of them.
 */

const RELOAD_TARGET_KEY = 'titanpact:pendingBuildReload';
const POLL_MS = 30_000;

const bundleFrom = (root: ParentNode): string | null =>
  root.querySelector('script[type="module"][src*="assets/"]')?.getAttribute('src') ?? null;

async function deployedBundle(): Promise<string | null> {
  // `cache: 'reload'` so neither the browser's http cache (GitHub Pages sends
  // max-age=600 on the HTML) nor the service worker's cached shell can answer.
  // A check that can be served from a cache is worse than no check at all.
  const res = await fetch(document.baseURI, { cache: 'reload' });
  if (!res.ok) return null;
  return bundleFrom(new DOMParser().parseFromString(await res.text(), 'text/html'));
}

export function useReloadOnNewBuild(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !import.meta.env.PROD) return;

    let cancelled = false;

    const check = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;

      const running = bundleFrom(document);
      if (!running) return;

      let deployed: string | null;
      try {
        deployed = await deployedBundle();
      } catch {
        return; // Offline, or the deploy is mid-flight. Try again next tick.
      }
      if (cancelled || !deployed || deployed === running) return;

      // Loop guard: if a reload aimed at this exact bundle already happened and
      // the page still is not running it, something upstream is inconsistent
      // (a half-published deploy, say). Sit on the old build rather than
      // reloading forever.
      try {
        if (sessionStorage.getItem(RELOAD_TARGET_KEY) === deployed) return;
        sessionStorage.setItem(RELOAD_TARGET_KEY, deployed);
      } catch {
        /* Storage unavailable (private mode). Proceed unguarded. */
      }

      window.location.reload();
    };

    void check();
    const timer = window.setInterval(check, POLL_MS);
    // visibilitychange covers returning from the App Switcher; pageshow covers
    // a bfcache restore, which fires no visibility change of its own.
    document.addEventListener('visibilitychange', check);
    window.addEventListener('pageshow', check);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('pageshow', check);
    };
  }, [enabled]);
}
