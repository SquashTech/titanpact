import { useEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { EquipmentDefinition } from '../../run/equipment';
import { RARITY_COLOR_VARS, RARITY_LABELS, ItemEffectChips, ItemPiece } from '../shared/EquipmentBox';
import { overlayHost } from '../shared/overlayHost';
import { prefersReducedMotion } from '../shared/reducedMotion';

/** How long the burst holds before it clears itself. A tap anywhere skips it. */
export const MERGE_BURST_MS = 1900;

/**
 * What a merge MADE (2026-09-10, per user direction). Two pieces went into the bag and one came
 * out, and until now the whole event was a grid quietly reshuffling by one box — the single
 * strongest thing a player can do to an item, and the least legible.
 *
 * So the result gets a beat of its own: the two inputs fly together, the new piece is struck out
 * of them, and it states what it now IS — the tier it climbed to and everything it grants. It is
 * not a decision and nothing waits on it; it clears itself, and a tap skips it.
 */
export function MergeBurst({ result, onDone }: { result: EquipmentDefinition; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, prefersReducedMotion() ? 900 : MERGE_BURST_MS);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return createPortal(
    <div className="merge-burst" onClick={onDone} style={{ '--rarity-color': RARITY_COLOR_VARS[result.rarity] } as CSSProperties}>
      <div className="merge-burst-stage">
        {/* The two inputs, thrown in from either side and struck out at the meeting point. They are
            the SAME piece drawn twice — a merge takes two of one thing, and drawing both is what
            makes the flash read as a collision rather than as a reveal. */}
        <span className="merge-burst-input is-left" aria-hidden="true">
          <ItemPiece item={result} />
        </span>
        <span className="merge-burst-input is-right" aria-hidden="true">
          <ItemPiece item={result} />
        </span>
        <span className="merge-burst-ring" aria-hidden="true" />
        <span className="merge-burst-ring is-late" aria-hidden="true" />
        <span className="merge-burst-flash" aria-hidden="true" />
        <span className="merge-burst-piece">
          <ItemPiece item={result} />
        </span>
      </div>
      <div className="merge-burst-caption">
        <span className="merge-burst-name">{result.name}</span>
        <span className="merge-burst-rarity">{RARITY_LABELS[result.rarity]}</span>
        <span className="merge-burst-chips">
          <ItemEffectChips item={result} />
        </span>
      </div>
    </div>,
    overlayHost()
  );
}
