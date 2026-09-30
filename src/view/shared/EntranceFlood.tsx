import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { overlayHost } from './overlayHost';

// The light a map landmark floods the screen with as its fight starts (MapRoute OPENING), carried
// across the screen change: the map hands it off as it leaves, and the next screen mounts the same
// flood at full strength and lets it lift, so the fight rises out of the light rather than cutting in.

export interface Flood {
  color: string;
  x: number;
  y: number;
}

// Long enough to survive the screen change, short enough that a flood never greets a later screen.
const HANDOFF_MS = 1500;

let pending: (Flood & { at: number }) | null = null;

export function handOffFlood(flood: Flood): void {
  pending = { ...flood, at: performance.now() };
}

export function EntranceFlood() {
  // Read, not consumed, in render (StrictMode renders twice); consumed once mounted.
  const [flood] = useState(() => (pending && performance.now() - pending.at < HANDOFF_MS ? pending : null));
  const [lifted, setLifted] = useState(false);
  useEffect(() => {
    pending = null;
  }, []);

  if (!flood || lifted) return null;
  return createPortal(
    <div
      className="map-opening-flood is-lifting"
      style={{ '--flood-color': flood.color, '--flood-x': `${flood.x}px`, '--flood-y': `${flood.y}px` } as CSSProperties}
      onAnimationEnd={() => setLifted(true)}
      aria-hidden="true"
    />,
    overlayHost()
  );
}
