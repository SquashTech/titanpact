import { useEffect } from 'react';

// Reloads when the server serves a newer build than the one running (iOS resumes a suspended web
// app rather than re-navigating, so reopening never fetches). Compares the hashed bundle the page
// booted from against the one the server's HTML points at — not the SW update cycle, which only
// fires when sw.js itself changes.
//
// Caller must gate this to the title screen: a run lives only in React state, so a reload
// anywhere else silently destroys it.

const RELOAD_TARGET_KEY = 'titanpact:pendingBuildReload';
const POLL_MS = 30_000;

const bundleFrom = (root: ParentNode): string | null =>
  root.querySelector('script[type="module"][src*="assets/"]')?.getAttribute('src') ?? null;

async function deployedBundle(): Promise<string | null> {
  // `cache: 'reload'`: neither the http cache (Pages sends max-age=600) nor the SW shell may answer.
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
        return; // Offline, or the deploy is mid-flight.
      }
      if (cancelled || !deployed || deployed === running) return;

      // Loop guard: a reload already aimed at this bundle that didn't take means a half-published
      // deploy — sit on the old build rather than reloading forever.
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
    // pageshow covers a bfcache restore, which fires no visibilitychange.
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
