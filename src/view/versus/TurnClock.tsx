// A versus player's own clock (docs/versus.md §3): a draining ring, a number only in the last ten
// seconds. It starts when its key appears, restarts when the key changes, and stops while paused.

import { useEffect, useRef, useState } from 'react';

const TICK_MS = 200;
const COUNTDOWN_FROM = 10;

/** Seconds left on the clock for `key`, or null with no clock running. Fires `onExpire` once a key. */
export function useTurnClock(key: string | null, seconds: number, paused: boolean, onExpire: () => void): number | null {
  const full = seconds * 1000;
  const [clock, setClock] = useState({ key, left: full });
  const left = clock.key === key ? clock.left : full;
  const expire = useRef(onExpire);
  expire.current = onExpire;
  const fired = useRef<string | null>(null);

  useEffect(() => {
    if (key === null || paused) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const spent = now - last;
      last = now;
      setClock((c) => ({ key, left: (c.key === key ? c.left : full) - spent }));
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [key, paused, full]);

  useEffect(() => {
    if (key === null || left > 0 || fired.current === key) return;
    fired.current = key;
    expire.current();
  }, [key, left]);

  return key === null ? null : Math.max(0, left / 1000);
}

export function TurnClock({ left, total, className = '' }: { left: number | null; total: number; className?: string }) {
  if (left === null) return null;
  const r = 11;
  const length = 2 * Math.PI * r;
  const share = Math.max(0, Math.min(1, left / total));
  const urgent = left <= COUNTDOWN_FROM;
  return (
    <div className={`vs-clock${urgent ? ' is-urgent' : ''} ${className}`} aria-label={`${Math.ceil(left)} seconds left`}>
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <circle cx="15" cy="15" r={r} className="vs-clock-track" />
        <circle cx="15" cy="15" r={r} className="vs-clock-fill" strokeDasharray={length} strokeDashoffset={length * (1 - share)} transform="rotate(-90 15 15)" />
      </svg>
      {urgent && <span className="vs-clock-number">{Math.ceil(left)}</span>}
    </div>
  );
}
