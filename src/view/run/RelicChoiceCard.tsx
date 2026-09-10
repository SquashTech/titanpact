import type { CSSProperties } from 'react';
import { RelicArt } from '../shared/relicArt';
import { relicColor } from '../shared/relicIcons';

/** The card only ever needed this much of a relic. */
interface Offer {
  id: string;
  name: string;
  description?: string;
}

interface Props {
  relic: Offer;
  picked: boolean;
  onPick: () => void;
  revealDelayMs: number;
  /** Banners carry their name — a run plans four acts around "Banner of Vitality +2". */
  named?: boolean;
}

/** Just the part that tells five Banners apart. The claim button states the full name. */
function shortName(relic: Offer): string {
  return relic.name.replace(/^Banner of (the )?/, '');
}

/**
 * One offer, as the object itself (2026-09-08, per user direction). This was a full-width row of
 * name-plus-description prose; the relic axis is flat stats, so every row read as the same
 * sentence with one number changed and the choice looked like paperwork.
 *
 * What survives is the stone (or the standard) at display size, standing on its own light, with
 * the stat glyphs it grants as its charge. Tap selects; the claim is the screen's bottom button.
 */
export function RelicChoiceCard({ relic, picked, onPick, revealDelayMs, named = false }: Props) {
  return (
    <button
      className={`relic-pick${picked ? ' picked' : ''}`}
      style={{ animationDelay: `${revealDelayMs}ms`, '--relic-color': relicColor(relic.id) } as CSSProperties}
      aria-label={`${relic.name} — ${relic.description ?? ''}`}
      aria-pressed={picked}
      onClick={onPick}
    >
      {/* The frame is what the light and the selection wash are anchored to — the button itself
          grows a line taller when a name wraps, and the glow would follow it under the text. */}
      <span className="relic-pick-frame">
        <span className="relic-pick-glow" aria-hidden="true" />
        <span className="relic-pick-plinth" aria-hidden="true" />
        <RelicArt relicId={relic.id} className="relic-pick-art" />
      </span>
      {named && <span className="relic-pick-name">{shortName(relic)}</span>}
    </button>
  );
}
