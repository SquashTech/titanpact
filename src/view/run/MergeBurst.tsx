import { useEffect, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { playSfx } from '../../audio/sfx';
import { equipment } from '../../data/equipment';
import { RARITY_ORDER, type EquipmentDefinition } from '../../run/equipment';
import { EquipmentIcon, ItemEffectChips, RARITY_COLOR_VARS, RARITY_LABELS } from '../shared/EquipmentBox';
import { overlayHost } from '../shared/overlayHost';
import { prefersReducedMotion } from '../shared/reducedMotion';

/** What went in and what came out. */
export interface MergeEvent {
  resultId: string;
  inputIds: readonly [string, string];
}

/** The beat (ms from mount): the two pieces square up, spiral in, strike, and the new one rises. */
const SPIRAL_AT = 650;
const STRIKE_AT = 1250;
const PIP_AT = 2050;
const MERGE_BURST_MS = 4200;

/** Sparks off the strike: angle (deg), reach (px), size (px), delay (s). */
const SPARKS = Array.from({ length: 22 }, (_, i) => {
  const t = (i * 0.618034) % 1;
  return [Math.round(i * (360 / 22) + t * 12), Math.round(90 + t * 90), +(3 + ((i * 0.37) % 1) * 4).toFixed(1), +((i * 0.013) % 0.08).toFixed(3)] as const;
});

function Plaque({ item, className, style }: { item: EquipmentDefinition; className: string; style?: CSSProperties }) {
  return (
    <span className={`merge-plaque ${className}`} style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity], ...style } as CSSProperties} aria-hidden="true">
      <span className="merge-plaque-diamond" />
      <EquipmentIcon item={item} className="merge-plaque-art" />
    </span>
  );
}

/**
 * What a merge MADE, as the strongest thing a player can do to an item deserves: the two pieces it
 * took square up in their own tiers, spiral into each other, and strike; the new piece rises out of
 * the flash in the tier it climbed to, the new pip stamped last. Nothing waits on it — it clears
 * itself, and a tap skips it.
 */
export function MergeBurst({ merge, onDone }: { merge: MergeEvent; onDone: () => void }) {
  const result = equipment[merge.resultId];
  const inputs = merge.inputIds.map((id) => equipment[id] ?? result);
  const fromRarity = RARITY_ORDER[Math.max(...inputs.map((item) => RARITY_ORDER.indexOf(item.rarity)))];
  const pips = RARITY_ORDER.indexOf(result.rarity) + 1;

  // Held in a ref: a caller passes a fresh closure each render, which must not restart the beat.
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const still = prefersReducedMotion();
    const timers = [window.setTimeout(() => done.current(), still ? 1400 : MERGE_BURST_MS)];
    if (still) playSfx('discovery');
    else {
      playSfx('evolve.charge');
      timers.push(window.setTimeout(() => playSfx('anvil.strike'), STRIKE_AT));
      timers.push(window.setTimeout(() => playSfx('evolve.fanfare'), STRIKE_AT + 120));
      timers.push(window.setTimeout(() => playSfx('star.land'), PIP_AT));
    }
    return () => timers.forEach(window.clearTimeout);
  }, []);

  return createPortal(
    <div className="merge-burst" onClick={onDone} style={{ '--rarity-color': RARITY_COLOR_VARS[result.rarity] } as CSSProperties}>
      <span className="merge-burst-veil" aria-hidden="true" />
      <div className="merge-burst-stage">
        <span className="merge-burst-rays" aria-hidden="true" />
        <span className="merge-burst-orbit" aria-hidden="true">
          <Plaque item={inputs[0]} className="merge-burst-input is-left" />
          <Plaque item={inputs[1]} className="merge-burst-input is-right" />
        </span>
        <span className="merge-burst-flash" aria-hidden="true" />
        <span className="merge-burst-ring" aria-hidden="true" />
        <span className="merge-burst-ring is-late" aria-hidden="true" />
        <span className="merge-burst-sparks" aria-hidden="true">
          {SPARKS.map(([a, reach, size, delay], i) => (
            <i key={i} style={{ '--a': `${a}deg`, '--reach': `${reach}px`, '--size': `${size}px`, animationDelay: `${STRIKE_AT / 1000 + delay}s` } as CSSProperties} />
          ))}
        </span>
        <Plaque item={result} className="merge-burst-piece" />
        <span className="merge-burst-pips" aria-hidden="true">
          {Array.from({ length: pips }, (_, i) => (
            <i key={i} className={i === pips - 1 ? 'is-new' : undefined} style={{ '--pip-i': i } as CSSProperties} />
          ))}
        </span>
      </div>
      <div className="merge-burst-caption">
        <span className="merge-burst-name">{result.name}</span>
        <span className="merge-burst-climb">
          <span className="merge-burst-from" style={{ color: RARITY_COLOR_VARS[fromRarity] }}>
            {RARITY_LABELS[fromRarity]}
          </span>
          <span className="merge-burst-arrow">→</span>
          <span className="merge-burst-rarity">{RARITY_LABELS[result.rarity]}</span>
        </span>
        <span className="merge-burst-chips">
          <ItemEffectChips item={result} />
        </span>
      </div>
    </div>,
    overlayHost()
  );
}
