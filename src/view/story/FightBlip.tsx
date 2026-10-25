import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { canvasPoint, overlayHost } from '../shared/overlayHost';
import { Blip, type BlipHandle } from '../run/Blip';
import './story.css';

// Blip watching a lesson fight (docs/the-sky.md §1, the lessons' exception): it has seen this telling,
// so it says why the round's guided taps are the ones. Never tapped through; the round's playback hushes it.

/** Blip sits at the left end of the band between the two sides, and talks along it. */
const SEAT_INSET = 26;

interface Props {
  round: number;
  /** The round's thought, set once the tips are done; unset while there is nothing to say. */
  lines?: readonly string[];
  won: boolean;
}

export function FightBlip({ round, lines, won }: Props) {
  const blip = useRef<BlipHandle>(null);
  const [home, setHome] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const band = document.querySelector('.battlefield-divider')?.getBoundingClientRect();
    if (!band) return;
    const at = canvasPoint(band.left, band.top + band.height / 2);
    setHome({ x: at.x + SEAT_INSET, y: at.y });
  }, []);

  const speaking = lines !== undefined && lines.length > 0;
  useEffect(() => {
    if (!home) return;
    if (speaking) blip.current?.think(lines, undefined, { linger: true });
    else blip.current?.quiet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home !== null, round, speaking]);

  useEffect(() => {
    if (won) blip.current?.react('win');
  }, [won]);

  return createPortal(
    <div className="fight-blip">
      {home && <Blip ref={blip} home={home} active bubbleAt="beside" />}
    </div>,
    overlayHost()
  );
}
