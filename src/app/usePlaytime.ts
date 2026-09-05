// Accumulates foreground playtime into the profile.
//
// Wall-clock between flushes, not a tick count: a backgrounded phone throttles timers to
// nothing, so counting intervals would undercount a session and overcount a paused one.
// The clock only runs while the document is visible, so a game left open on a locked phone
// overnight does not report as ten hours played.

import { useEffect } from 'react';
import { addPlaytime } from '../run/profile';
import { updateProfile } from './profileStorage';

/** Long enough that the write is rare, short enough that a hard kill loses little. */
const FLUSH_MS = 30_000;

export function usePlaytime(): void {
  useEffect(() => {
    // Not state: a re-render must not restart the span, and nothing renders this number.
    let spanStartedAt = document.visibilityState === 'visible' ? Date.now() : null;

    function flush(): void {
      if (spanStartedAt === null) return;
      const now = Date.now();
      const elapsed = now - spanStartedAt;
      spanStartedAt = now;
      // A clock that jumped backwards (a manual time change, a suspend) is dropped by addPlaytime.
      if (elapsed > 0) updateProfile((profile) => addPlaytime(profile, elapsed));
    }

    function handleVisibility(): void {
      if (document.visibilityState === 'visible') {
        spanStartedAt = Date.now();
      } else {
        // Banks the span before the tab can be frozen, then stops the clock.
        flush();
        spanStartedAt = null;
      }
    }

    const timer = window.setInterval(flush, FLUSH_MS);
    document.addEventListener('visibilitychange', handleVisibility);
    // pagehide, not beforeunload: iOS fires the latter unreliably and never on a bfcache exit.
    window.addEventListener('pagehide', flush);

    return () => {
      flush();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, []);
}
