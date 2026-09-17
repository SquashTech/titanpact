import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { playSfx } from '../../audio/sfx';
import type { SfxId } from '../../audio/sounds';
import type { EquipmentDefinition } from '../../run/equipment';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { enchantTypeOf, ItemEffectChips, ItemPiece, RARITY_COLOR_VARS, RARITY_LABELS } from '../shared/EquipmentBox';
import { ElementGlyph } from '../shared/elementIcons';
import { overlayHost } from '../shared/overlayHost';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { AnvilFigure, HammerFigure, RuneRing } from './smithyArt';

export type SmithyWork = { kind: 'anvil' | 'enchant'; before: EquipmentDefinition; after: EquipmentDefinition };

/** The hammer's three strikes, from mount (ms). The CSS swing is keyed to the same figures. */
const STRIKE_AT = [420, 800, 1180] as const;
/** When the Enchanter's circle closes on the piece (ms). */
const BIND_AT = 1050;
/** How long each beat holds before it clears itself. A tap anywhere skips it. */
export const SMITHY_BEAT_MS = { anvil: 2700, enchant: 2600 } as const;

// Golden-angle scatter, as CacheReveal's: stable, never symmetrical.
const SPARKS = Array.from({ length: 14 }, (_, i) => {
  const seed = i * 137.51;
  return {
    angle: -20 - ((seed * 0.53) % 140), // upward fan, off the face
    distance: 44 + ((seed * 0.31) % 50),
    size: 2 + ((seed * 0.13) % 2.5),
    delay: (seed * 0.4) % 60,
  };
});
const MOTES = Array.from({ length: 16 }, (_, i) => {
  const seed = i * 137.51;
  return { angle: seed % 360, distance: 84 + ((seed * 0.29) % 30), size: 2.5 + ((seed * 0.11) % 3), delay: (seed * 0.9) % 420 };
});

/**
 * What the Smithy MADE (2026-09-16, per user direction). The Anvil and the Enchanter were two
 * price buttons on a list row, and the tier changing under the finger was the whole of it — the
 * dearest things the Guild Hall sells, and the least seen.
 *
 * So each gets a beat: the piece on the anvil under three hammer strikes, the third of which
 * takes it up a tier; or the piece inside the Enchanter's circle as the element draws in and
 * binds. Both state what the piece now IS. Neither is a decision: it clears itself, a tap skips
 * it, and the change has already landed before it plays.
 */
export function SmithyBeat({ work, onDone }: { work: SmithyWork; onDone: () => void }) {
  const reduced = prefersReducedMotion();
  const [strikes, setStrikes] = useState(reduced ? 3 : 0);
  const [bound, setBound] = useState(reduced);
  const enchantType = enchantTypeOf(work.after);
  // Read through a ref: the timeline runs once per piece of work, and a parent re-render handing
  // over a fresh callback must not restart it (it did — the bench's own highlight timer re-rendered
  // the parent mid-beat, and the hammer started over).
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const done = () => onDoneRef.current();
    const enchantType = enchantTypeOf(work.after);
    if (reduced) {
      const timer = window.setTimeout(done, 900);
      return () => window.clearTimeout(timer);
    }
    const timers: number[] = [];
    if (work.kind === 'anvil') {
      STRIKE_AT.forEach((at, i) => {
        timers.push(
          window.setTimeout(() => {
            setStrikes(i + 1);
            playSfx('anvil.strike', { pitch: 1 + i * 0.07 });
            if (i === STRIKE_AT.length - 1) playSfx('anvil.ring', { delay: 0.03 });
          }, at)
        );
      });
    } else {
      playSfx('enchant.bind');
      timers.push(
        window.setTimeout(() => {
          setBound(true);
          playSfx((enchantType ? `cast.${enchantType}` : 'cast') as SfxId);
        }, BIND_AT)
      );
    }
    timers.push(window.setTimeout(done, SMITHY_BEAT_MS[work.kind]));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [work, reduced]);

  const done = work.kind === 'anvil' ? strikes >= STRIKE_AT.length : bound;
  const shown = done ? work.after : work.before;
  const tint = work.kind === 'enchant' && enchantType ? getTypeColor(enchantType) : RARITY_COLOR_VARS[work.after.rarity];
  const style = {
    '--rarity-color': RARITY_COLOR_VARS[work.after.rarity],
    '--beat-color': tint,
    ...(enchantType ? { '--type-rgb': getTypeColorRgb(enchantType) } : null),
  } as CSSProperties;

  return createPortal(
    <div className={`smithy-beat is-${work.kind}${done ? ' is-done' : ''}`} style={style} onClick={onDone}>
      <div className="smithy-beat-stage">
        {work.kind === 'anvil' ? (
          <>
            <span className="smithy-beat-heat" aria-hidden="true" />
            <AnvilFigure key={`anvil-${strikes}`} className={`smithy-beat-anvil${strikes > 0 ? ' is-rung' : ''}`} />
            {/* Keyed on the strike count so every jolt, flash and spark fan restarts on the hit. */}
            <span key={`piece-${strikes}`} className={`smithy-beat-piece${strikes > 0 ? ' is-struck' : ''}`}>
              <ItemPiece item={shown} />
            </span>
            {strikes > 0 && (
              <span key={`sparks-${strikes}`} className="smithy-beat-sparks" aria-hidden="true">
                {SPARKS.map((s, i) => (
                  <i
                    key={i}
                    style={
                      {
                        '--spark-angle': `${s.angle}deg`,
                        '--spark-distance': `${s.distance}px`,
                        width: `${s.size}px`,
                        height: `${s.size}px`,
                        animationDelay: `${s.delay}ms`,
                      } as CSSProperties
                    }
                  />
                ))}
              </span>
            )}
            {strikes > 0 && <span key={`flash-${strikes}`} className={`smithy-beat-flash${done ? ' is-final' : ''}`} aria-hidden="true" />}
            {done && (
              <>
                <span className="smithy-beat-ring" aria-hidden="true" />
                <span className="smithy-beat-ring is-late" aria-hidden="true" />
              </>
            )}
            {!reduced && <HammerFigure className="smithy-beat-hammer" />}
          </>
        ) : (
          <>
            <span className="smithy-beat-aura" aria-hidden="true" />
            <RuneRing className="smithy-beat-runes" />
            {enchantType && <ElementGlyph type={enchantType} className="smithy-beat-sigil" />}
            {!bound && (
              <span className="smithy-beat-motes" aria-hidden="true">
                {MOTES.map((m, i) => (
                  <i
                    key={i}
                    style={
                      {
                        '--mote-angle': `${m.angle}deg`,
                        '--mote-distance': `${m.distance}px`,
                        width: `${m.size}px`,
                        height: `${m.size}px`,
                        animationDelay: `${m.delay}ms`,
                      } as CSSProperties
                    }
                  />
                ))}
              </span>
            )}
            <span key={bound ? 'after' : 'before'} className={`smithy-beat-piece${bound ? ' is-bound' : ''}`}>
              <ItemPiece item={shown} />
            </span>
            {bound && (
              <>
                <span className="smithy-beat-flash is-final" aria-hidden="true" />
                <span className="smithy-beat-ring" aria-hidden="true" />
                <span className="smithy-beat-ring is-late" aria-hidden="true" />
              </>
            )}
          </>
        )}
      </div>

      <div className={`smithy-beat-caption${done ? ' is-shown' : ''}`}>
        <span className="smithy-beat-verb">{work.kind === 'anvil' ? 'Forged up' : 'Bound'}</span>
        <span className="smithy-beat-name">{work.after.name}</span>
        <span className="smithy-beat-rarity">
          {RARITY_LABELS[work.after.rarity]}
          {work.kind === 'enchant' && enchantType ? ` · ${enchantType}` : ''}
        </span>
        <span className="smithy-beat-chips">
          <ItemEffectChips item={work.after} labelled />
        </span>
      </div>
    </div>,
    overlayHost()
  );
}
