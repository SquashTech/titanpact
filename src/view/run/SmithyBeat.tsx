import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { playSfx } from '../../audio/sfx';
import type { SfxId } from '../../audio/sounds';
import { RARITY_ORDER, parseEquipmentId, type EquipmentDefinition } from '../../run/equipment';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { enchantTypeOf, ItemEffectChips, ItemPiece, RARITY_COLOR_VARS, RARITY_LABELS } from '../shared/EquipmentBox';
import { ElementGlyph } from '../shared/elementIcons';
import { enchantArt, equipmentArt } from '../shared/equipmentArt';
import { overlayHost } from '../shared/overlayHost';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { AnvilFigure, HammerFigure, RuneRing } from './smithyArt';

export type SmithyWork =
  | { kind: 'anvil' | 'enchant'; before: EquipmentDefinition; after: EquipmentDefinition }
  /** The Forge node: the hammer, then the circle. `lifted` is what comes off the anvil, null when the act gave no lift. */
  | { kind: 'forge'; before: EquipmentDefinition; lifted: EquipmentDefinition | null; after: EquipmentDefinition };

type Cue = 'heat' | 'swing1' | 'hit1' | 'swing2' | 'hit2' | 'swing3' | 'hit3' | 'quench' | 'cooled' | 'draw' | 'pour' | 'bound' | 'done';

/** One act's cues (ms from the act's start). The third swing is the slow one: the camera leans in for it. */
const ANVIL: readonly (readonly [Cue, number])[] = [
  ['heat', 0],
  ['swing1', 700],
  ['hit1', 1000],
  ['swing2', 1150],
  ['hit2', 1450],
  ['swing3', 1650],
  ['hit3', 2350],
  ['quench', 2900],
  ['cooled', 3400],
];
const ANVIL_MS = 3900;
const ENCHANT: readonly (readonly [Cue, number])[] = [
  ['draw', 0],
  ['pour', 1000],
  ['bound', 2500],
];
const ENCHANT_MS = 2700;
/** The caption holds this long after the last act before the beat clears itself. */
const CAPTION_HOLD_MS = 2600;
const HITSTOP_MS = 80;

const ORDER: readonly Cue[] = ['heat', 'swing1', 'hit1', 'swing2', 'hit2', 'swing3', 'hit3', 'quench', 'cooled', 'draw', 'pour', 'bound', 'done'];

/** Golden-angle scatter: stable, never symmetrical. */
const scatter = (n: number, fn: (seed: number, i: number) => Record<string, number>) => Array.from({ length: n }, (_, i) => fn(i * 137.51, i));
const SPARKS = scatter(18, (s) => ({ vx: -120 + (s * 0.61) % 240, h: 50 + (s * 0.29) % 70, fall: 60 + (s * 0.17) % 60, size: 2 + (s * 0.13) % 3, delay: (s * 0.2) % 50 }));
const EMBERS = scatter(16, (s) => ({ x: -90 + (s * 0.53) % 180, rise: 140 + (s * 0.31) % 120, drift: -20 + (s * 0.23) % 40, size: 2 + (s * 0.11) % 3, delay: (s * 0.7) % 1600 }));
const STEAM = scatter(9, (s, i) => ({ x: -70 + i * 17 + (s * 0.1) % 8, size: 46 + (s * 0.37) % 40, rise: 90 + (s * 0.41) % 70, delay: (s * 0.3) % 160 }));
const MOTES = scatter(30, (s) => ({ angle: s % 360, from: 190 + (s * 0.29) % 90, size: 3 + (s * 0.11) % 4, delay: (s * 1.1) % 1300 }));
const SHARDS = scatter(22, (s, i) => ({ angle: s % 360, reach: 100 + (s * 0.37) % 80, size: 3 + (s * 0.17) % 4, delay: (s * 0.3) % 80, tone: i % 2 }));
const RUNES = Array.from({ length: 8 }, (_, i) => i * 45);

/** The piece itself: its pixel art at 2x, lit in its tier's colour, the enchant's gem on its shoulder. A piece with no art keeps its chit. */
function BeatPiece({ item }: { item: EquipmentDefinition }) {
  const art = equipmentArt(item);
  if (!art) return <ItemPiece item={item} />;
  const { enchantId } = parseEquipmentId(item.id);
  const gem = enchantId ? enchantArt(enchantId) : undefined;
  return (
    <span className="cine-sprite" style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties}>
      <img src={art} alt="" draggable={false} />
      {gem && <img src={gem} className="cine-gem" alt="" draggable={false} />}
    </span>
  );
}

function Burst<T extends Record<string, number>>({ className, items, vars }: { className: string; items: T[]; vars: (item: T) => Record<string, string | number> }) {
  return (
    <span className={className} aria-hidden="true">
      {items.map((item, i) => (
        <i key={i} className={item.tone ? 'is-alt' : undefined} style={vars(item) as CSSProperties} />
      ))}
    </span>
  );
}

/**
 * What the Smithy MADE, as a cutscene (2026-10-27, per user direction). The bars come down and the
 * work plays out: on the Anvil the piece heats in the fire, takes two strikes and a third the camera
 * leans into, and is quenched in a burst of steam to come out in its new tier; at the Enchanter the
 * circle draws itself, the element pours in from the edges while the piece turns in the air, and the
 * binding wipes it over into its enchanted form as its new name writes itself. The Forge plays both,
 * one after the other. Neither is a decision: the change has landed before it plays, it clears
 * itself, and a tap skips it.
 */
export function SmithyBeat({ work, onDone }: { work: SmithyWork; onDone: () => void }) {
  const reduced = prefersReducedMotion();
  const acts: ('anvil' | 'enchant')[] = work.kind === 'forge' ? ['anvil', 'enchant'] : [work.kind];
  const [cue, setCue] = useState<Cue>(reduced ? 'done' : acts[0] === 'anvil' ? 'heat' : 'draw');
  const [hitstop, setHitstop] = useState(false);
  // Read through a ref: a parent re-render handing over a fresh callback must not restart the beat.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const enchantType = enchantTypeOf(work.after);
  const lifted = work.kind === 'forge' ? (work.lifted ?? work.before) : work.kind === 'anvil' ? work.after : work.before;

  useEffect(() => {
    const done = () => onDoneRef.current();
    if (reduced) {
      playSfx('anvil.ring');
      const timer = window.setTimeout(done, 1600);
      return () => window.clearTimeout(timer);
    }
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const hit = (pitch: number) => {
      setHitstop(true);
      at(HITSTOP_MS, () => setHitstop(false));
      playSfx('anvil.strike', { pitch });
    };
    let t = 0;
    for (const act of acts) {
      const start = t;
      for (const [name, ms] of act === 'anvil' ? ANVIL : ENCHANT) {
        at(start + ms, () => {
          setCue(name);
          if (name === 'heat') playSfx('forge.roar');
          if (name === 'hit1') hit(1);
          if (name === 'hit2') hit(1.07);
          if (name === 'hit3') {
            hit(0.9);
            playSfx('anvil.ring', { pitch: 0.85, gain: 1.2, delay: 0.03 });
          }
          if (name === 'quench') playSfx('forge.quench');
          if (name === 'cooled') playSfx('anvil.ring', { pitch: 1.2, gain: 0.7 });
          if (name === 'draw') playSfx('quill.scratch', { pitch: 0.7 });
          if (name === 'pour') playSfx('enchant.bind');
          if (name === 'bound') {
            playSfx((enchantType ? `cast.${enchantType}` : 'cast') as SfxId);
            playSfx('evolve.fanfare', { delay: 0.08 });
          }
        });
      }
      t += act === 'anvil' ? ANVIL_MS : ENCHANT_MS;
    }
    at(t, () => setCue('done'));
    at(t + CAPTION_HOLD_MS, done);
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reached = (c: Cue) => ORDER.indexOf(cue) >= ORDER.indexOf(c);
  const inEnchant = acts.includes('enchant') && (reached('draw') || (cue === 'done' && acts[acts.length - 1] === 'enchant'));
  const scene = inEnchant ? 'enchant' : 'anvil';
  const strikes = reached('hit3') ? 3 : reached('hit2') ? 2 : reached('hit1') ? 1 : 0;
  const swing = reached('swing3') ? 3 : reached('swing2') ? 2 : reached('swing1') ? 1 : 0;
  const finished = cue === 'done';
  const bound = reached('bound') && acts.includes('enchant');

  const fromRarity = work.before.rarity;
  const climbed = RARITY_ORDER.indexOf(work.after.rarity) > RARITY_ORDER.indexOf(fromRarity);
  const pips = RARITY_ORDER.indexOf(work.after.rarity) + 1;
  const tint = enchantType ? getTypeColor(enchantType) : RARITY_COLOR_VARS[work.after.rarity];

  const style = {
    '--rarity-color': RARITY_COLOR_VARS[work.after.rarity],
    '--beat-color': tint,
    ...(enchantType ? { '--type-rgb': getTypeColorRgb(enchantType) } : null),
  } as CSSProperties;

  return createPortal(
    <div
      className={['cine', `is-${work.kind}`, `is-${scene}`, `cue-${cue}`, hitstop ? 'is-hitstop' : '', finished ? 'is-done' : ''].filter(Boolean).join(' ')}
      data-el={enchantType ?? undefined}
      style={style}
      onClick={() => onDoneRef.current()}
    >
      <span className="cine-veil" aria-hidden="true" />
      <span className="cine-bar is-top" aria-hidden="true" />
      <span className="cine-bar is-bottom" aria-hidden="true" />

      <div className="cine-stage">
        <div className={`cine-camera${cue === 'swing3' || cue === 'hit3' ? ' is-leaning' : ''}`}>
          {scene === 'anvil' ? (
            <div className={`cine-anvil${strikes ? ` is-struck-${strikes}` : ''}`}>
              <span className="cine-fire" aria-hidden="true" />
              {!reached('cooled') && (
                <Burst className="cine-embers" items={EMBERS} vars={(e) => ({ '--x': `${e.x}px`, '--rise': `${e.rise}px`, '--drift': `${e.drift}px`, '--size': `${e.size}px`, animationDelay: `${e.delay}ms` })} />
              )}
              <AnvilFigure key={`anvil-${strikes}`} className={`cine-anvil-art${strikes ? ' is-rung' : ''}`} />
              <span className={`cine-trough${reached('quench') && !reached('cooled') ? ' is-up' : ''}`} aria-hidden="true" />
              <span
                className={['cine-piece', reached('quench') ? (reached('cooled') ? 'is-cooled' : 'is-quenched') : `is-heat-${strikes}`].join(' ')}
                key={reached('cooled') ? 'cooled' : 'hot'}
              >
                <BeatPiece item={reached('hit3') ? lifted : work.before} />
              </span>
              {strikes > 0 && !reached('quench') && (
                <span key={`hit-${strikes}`}>
                  <Burst className="cine-sparks" items={SPARKS} vars={(s) => ({ '--vx': `${s.vx}px`, '--h': `${s.h}px`, '--fall': `${s.fall}px`, '--size': `${s.size}px`, animationDelay: `${s.delay}ms` })} />
                  <span className={`cine-flash${strikes === 3 ? ' is-white' : ''}`} aria-hidden="true" />
                  {strikes === 3 && <span className="cine-ring is-hot" aria-hidden="true" />}
                </span>
              )}
              {reached('quench') && !reached('cooled') && (
                <Burst className="cine-steam" items={STEAM} vars={(s) => ({ '--x': `${s.x}px`, '--size': `${s.size}px`, '--rise': `${s.rise}px`, animationDelay: `${s.delay}ms` })} />
              )}
              {reached('cooled') && (
                <>
                  <span className="cine-rays" aria-hidden="true" />
                  <span className="cine-ring" aria-hidden="true" />
                </>
              )}
              {!reached('quench') && <HammerFigure key={`swing-${swing}`} className={`cine-hammer${swing ? ` is-swing${swing === 3 ? ' is-slow' : ''}` : ''}`} />}
            </div>
          ) : (
            <div className={`cine-enchant${bound ? ' is-bound' : ''}`}>
              <span className="cine-aura" aria-hidden="true" />
              <svg className="cine-circle" viewBox="0 0 240 240" aria-hidden="true">
                <circle className="cine-stroke" cx="120" cy="120" r="104" />
                <circle className="cine-stroke is-inner" cx="120" cy="120" r="86" />
                {RUNES.map((a, i) => (
                  <g key={a} transform={`rotate(${a} 120 120)`}>
                    <path className="cine-rune" d="M120 9 l6 6 -6 6 -6 -6z" style={{ animationDelay: `${0.45 + i * 0.07}s` } as CSSProperties} />
                  </g>
                ))}
              </svg>
              <RuneRing className="cine-runes" />
              {enchantType && <ElementGlyph type={enchantType} className="cine-sigil" />}
              {reached('pour') && !bound && (
                <Burst className="cine-motes" items={MOTES} vars={(m) => ({ '--a': `${m.angle}deg`, '--from': `${m.from}px`, '--size': `${m.size}px`, animationDelay: `${m.delay}ms` })} />
              )}
              <span className={`cine-piece is-floating${reached('pour') ? ' is-turning' : ''}`}>
                <BeatPiece item={lifted} />
                {bound && (
                  <span className="cine-wipe">
                    <BeatPiece item={work.after} />
                  </span>
                )}
              </span>
              {bound && (
                <>
                  <span className="cine-rays" aria-hidden="true" />
                  <span className="cine-flash is-white" aria-hidden="true" />
                  <span className="cine-ring" aria-hidden="true" />
                  <span className="cine-ring is-late" aria-hidden="true" />
                  <Burst className="cine-shards" items={SHARDS} vars={(s) => ({ '--a': `${s.angle}deg`, '--reach': `${s.reach}px`, '--size': `${s.size}px`, animationDelay: `${s.delay}ms` })} />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={`cine-caption${finished ? ' is-shown' : ''}`}>
        {finished && (
          <>
            <span className="cine-pips" aria-hidden="true">
              {Array.from({ length: pips }, (_, i) => (
                <i key={i} className={climbed && i === pips - 1 ? 'is-new' : undefined} style={{ '--pip-i': i } as CSSProperties} />
              ))}
            </span>
            <span className={`cine-name${acts.includes('enchant') ? ' is-written' : ''}`} aria-label={work.after.name}>
              {[...work.after.name].map((ch, i) => (
                <span key={i} style={{ '--ch-i': i } as CSSProperties} aria-hidden="true">
                  {ch}
                </span>
              ))}
            </span>
            <span className="cine-climb">
              {climbed && (
                <>
                  <span className="cine-from" style={{ color: RARITY_COLOR_VARS[fromRarity] }}>
                    {RARITY_LABELS[fromRarity]}
                  </span>
                  <span className="cine-arrow">→</span>
                </>
              )}
              <span className="cine-rarity">{RARITY_LABELS[work.after.rarity]}</span>
              {acts.includes('enchant') && enchantType && (
                <span className="cine-element" style={{ color: getTypeColor(enchantType) }}>
                  <ElementGlyph type={enchantType} />
                  {enchantType}
                </span>
              )}
            </span>
            <span className="cine-chips">
              <ItemEffectChips item={work.after} labelled />
            </span>
          </>
        )}
      </div>
    </div>,
    overlayHost()
  );
}
