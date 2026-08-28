import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { moves } from '../../data/moves';
import type { MoveDefinition, StatKey, StatLine, TypeId } from '../../engine/content';
import type { HealCaster } from '../../engine/heal/healPipeline';
import type { StatModifiers } from '../../engine/state';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { HeroPortrait } from './HeroPortrait';
import { ManaCost } from './ManaCost';
import { MoveInfoPanel } from './MoveTile';
import { TypeBadge } from './TypeBadge';
import { STAT_COLORS, STAT_LABELS, computeStatTotal, statFraction } from './StatBars';

/**
 * The hero *stage* — one hero standing at 144px inside a summoning sigil,
 * with the stat silhouette and movepool that inform whether to commit to
 * them, and a rail of the other candidates underneath.
 *
 * Lifted out of DraftScreen (docs/visual-language.md, third pass) when the
 * Recruit Contract claim became a screen of its own rather than a strip of
 * portrait buttons on the victory box: both screens ask the same question —
 * *do you want this hero on your team, permanently, for a price* — so they
 * are the same screen, the way every pick-a-hero grid became one card
 * (HeroPickCard, ninth pass).
 *
 * The CSS family keeps its `.draft-*` prefix. That prefix now names the
 * idiom, not the screen: renaming ~200 selectors would silently invalidate
 * every `.draft-figure` / `.draft-portrait` measurement docs/visual-
 * language.md's third and fifth passes record, and the history is worth more
 * than the prefix. Screens layer their own `.recruit-*`-style block on top
 * for what only they have.
 */

const DEFAULT_MOTES = 16;

/**
 * Ambient motes drifting up the whole screen — the same golden-angle-sequence
 * trick as TitleScreen's useEmbers and NodeStage's field (pure function of
 * index, so the scatter is stable across re-renders with no seed to store).
 * They take the featured hero's type color from `--pact-rgb`, so switching
 * candidates re-tints the air as well as the figure.
 */
function useMotes(count: number) {
  return useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const seed = i * 137.51;
        return {
          left: seed % 100,
          delay: (seed * 1.3) % 7,
          duration: 5.5 + ((seed * 0.29) % 4),
          size: 2 + ((seed * 0.17) % 2),
        };
      }),
    [count]
  );
}

/**
 * The scene: a two-tone gold/violet wash and a mote field, both full-bleed
 * past .app-shell's padding. Not a container — nothing sits "in" it — and it
 * paints at z-index 0, so every sibling after it must be lifted above it
 * (see `.draft-cta`'s comment in styles.css).
 */
export function StageSky({ motes = DEFAULT_MOTES }: { motes?: number }) {
  const field = useMotes(motes);
  return (
    <div className="draft-sky" aria-hidden="true">
      <span className="draft-sky-wash" />
      <div className="draft-motes">
        {field.map((m, i) => (
          <span
            key={i}
            className="draft-mote"
            style={
              {
                left: `${m.left}%`,
                width: `${m.size}px`,
                height: `${m.size}px`,
                animationDelay: `${m.delay}s`,
                animationDuration: `${m.duration}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The figure on stage. Callers key it on the hero so switching candidates
 * remounts it and replays the arrival — a new hero should read as summoned
 * in, not as a swapped <img src>.
 */
export function StageFigure({
  heroId,
  heroName,
  onInspect,
  children,
}: {
  heroId: string;
  heroName: string;
  onInspect?: () => void;
  /** A corner mark on the figure itself (the recruit screen's level pip). */
  children?: ReactNode;
}) {
  return (
    <div className="draft-figure">
      <span className="draft-sigil" aria-hidden="true" />
      <HeroPortrait heroId={heroId} className="draft-portrait" />
      {children}
      {onInspect && (
        <button className="draft-info" onClick={onInspect} aria-label={`View ${heroName} details`}>
          i
        </button>
      )}
    </div>
  );
}

/**
 * The stats the Stat Total beside them is summed from, in the same order
 * StatBars uses. Mana Pool joined the strip when it joined the total
 * (2026-08-28): a hero pays for its power out of the same 450 budget its pool
 * comes from, so a strip that hid the pool showed a 62-Speed hero and an
 * 85-Speed hero as if the difference were free. Seven bars that add up to the
 * number next to them beats six that do not.
 *
 * MP Regen stays off — flat 10 on every hero, so it is a column of identical
 * bars, and this strip exists to be compared across candidates at a glance.
 * The full eight-stat block is one tap away on the hero sheet.
 */
const SILHOUETTE_STATS: readonly StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed', 'manaPool'];

/**
 * Seven bars on StatBars' shared ceilings (statFraction) plus the Stat Total
 * they sum to. `grants` is the flat delta a hero already carries into the
 * pick (entryStats.ts) — a drafted candidate has none, a beaten veteran
 * offered on a contract usually does — added to the bar and called out in the
 * accent, so the numbers on screen are the ones that will fight. The total
 * sums those same granted numbers rather than the authored base (2026-08-28),
 * so the strip stays internally consistent: the bars and the number beside
 * them always describe the same hero.
 */
export function StageSilhouette({ baseStats, grants = {} }: { baseStats: StatLine; grants?: StatModifiers }) {
  const effective = Object.fromEntries(
    SILHOUETTE_STATS.map((stat) => [stat, baseStats[stat] + (grants[stat] ?? 0)])
  ) as Record<StatKey, number>;
  return (
    <div className="draft-silhouette">
      {SILHOUETTE_STATS.map((stat) => {
        const granted = grants[stat] ?? 0;
        const value = baseStats[stat] + granted;
        return (
          <div className="draft-stat" key={stat}>
            <span className={`draft-stat-value${granted ? ' is-boosted' : ''}`}>{value}</span>
            <div className="draft-stat-track">
              <div
                className="draft-stat-fill"
                style={{ height: `${statFraction(stat, value) * 100}%`, background: STAT_COLORS[stat] }}
              />
            </div>
            <span className="draft-stat-label">{STAT_LABELS[stat]}</span>
          </div>
        );
      })}
      <div className="draft-stat draft-stat-total" title="Stat Total — the seven bars beside it, summed">
        <span className="draft-stat-value">{computeStatTotal(effective)}</span>
        <div className="draft-stat-track draft-stat-track-empty" />
        <span className="draft-stat-label">Stat Total</span>
      </div>
    </div>
  );
}

/** The hero's types, under the name. */
export function StageTypes({ types }: { types: readonly TypeId[] }) {
  return (
    <div className="draft-types">
      {types.map((t) => (
        <TypeBadge key={t} type={t} />
      ))}
    </div>
  );
}

/**
 * The hero's kit. These were chromeless spans — the mana crystal with the
 * type carried as the name's own color — because at the time they were a
 * readout, and docs/visual-language.md's rule reserves a rectangle for things
 * you can act on. They ARE actionable: tapping one pops its full detail over
 * the stage, which is the only way the player can find out what a kit
 * actually does before committing to a hero for the rest of the run. So under
 * the same rule they get their boxes back, and the box advertises the tap.
 */
export function StageKit({ moveIds, onPick }: { moveIds: readonly string[]; onPick: (move: MoveDefinition) => void }) {
  return (
    <div className="draft-kit">
      {moveIds.map((moveId) => {
        const move = moves[moveId];
        if (!move) return null;
        return (
          <button
            className="draft-kit-move"
            key={moveId}
            style={{ '--move-type': getTypeColor(move.type), '--move-type-rgb': getTypeColorRgb(move.type) } as CSSProperties}
            onClick={() => onPick(move)}
            aria-haspopup="dialog"
          >
            <ManaCost cost={move.manaCost} size="sm" className="draft-kit-crystal" />
            {move.name}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Move detail as an overlay rather than a slab pinned under the kit: it
 * appears over the stage, right where the eye already is, and a tap anywhere
 * dismisses it (same contract as the in-combat long-press move popup). It
 * carries the move's own type color, so the card still reads as the same
 * object as the chip that opened it.
 */
export function StageMovePopup({ move, caster, onClose }: { move: MoveDefinition; caster?: HealCaster; onClose: () => void }) {
  return (
    <div className="log-overlay" onClick={onClose}>
      <div
        className="draft-move-popup"
        role="dialog"
        aria-label={`${move.name} details`}
        style={{ '--move-type-rgb': getTypeColorRgb(move.type) } as CSSProperties}
      >
        <MoveInfoPanel move={move} caster={caster} />
        <div className="move-popup-hint">Tap anywhere to close</div>
      </div>
    </div>
  );
}

/** The other candidates, waiting in the dark. */
export function StageRail({ children }: { children: ReactNode }) {
  return <div className="draft-rail">{children}</div>;
}

/**
 * One candidate on the rail. Chromeless at rest — the frame is the
 * affordance, and it appears on the one that's on stage
 * (docs/visual-language.md). `sealed` is the screen's own "this one is
 * already spoken for" state: a drafted pick, a signed contract.
 */
export function StageCandidate({
  heroId,
  heroName,
  primaryType,
  featured,
  sealed,
  onSelect,
}: {
  heroId: string;
  heroName: string;
  primaryType: TypeId;
  featured: boolean;
  sealed?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`draft-candidate${featured ? ' featured' : ''}${sealed ? ' chosen' : ''}`}
      style={{ '--type-rgb': getTypeColorRgb(primaryType) } as CSSProperties}
      onClick={onSelect}
      aria-pressed={featured}
    >
      <HeroPortrait heroId={heroId} className="draft-candidate-portrait" />
      <span className="draft-candidate-name">{heroName}</span>
      {sealed && (
        <span className="draft-candidate-seal" aria-hidden="true">
          ✦
        </span>
      )}
    </button>
  );
}
