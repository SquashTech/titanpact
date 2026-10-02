import { useCallback, useEffect, useRef, useState } from 'react';

/** A one-tap purchase at or above this price asks twice (docs/polish-handoff.md §3). Potions stay one tap. */
export const CONFIRM_PURCHASE_FROM = 25;

const ARMED_MS = 4000;

/**
 * Tap to arm, tap again to commit. The first tap only arms; the arm lapses after a few seconds or on
 * any press outside the armed button, so a stray tap — or the tap that lands where a screen just
 * closed — never spends anything.
 */
export function useArmedTap(onCommit: () => void, enabled: boolean) {
  const [armed, setArmed] = useState(false);
  const ref = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!enabled) setArmed(false);
  }, [enabled]);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), ARMED_MS);
    const disarm = (e: PointerEvent) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return;
      setArmed(false);
    };
    document.addEventListener('pointerdown', disarm, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', disarm, true);
    };
  }, [armed]);

  const onClick = useCallback(() => {
    if (!enabled) {
      onCommit();
      return;
    }
    if (armed) {
      setArmed(false);
      onCommit();
    } else {
      setArmed(true);
    }
  }, [armed, enabled, onCommit]);

  return { armed: enabled && armed, onClick, ref };
}
