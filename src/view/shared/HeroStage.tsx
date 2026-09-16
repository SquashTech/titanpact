import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { moves } from '../../data/moves';
import type { MoveDefinition, StatKey, StatLine, TypeId } from '../../engine/content';
import type { HealCaster } from '../../engine/heal/healPipeline';
import type { StatModifiers } from '../../engine/state';
import { getTypeColorRgb } from '../combat/typeColors';
import { MoveDetailOverlay } from '../combat/MoveDetailOverlay';
import { HeroPortrait } from './HeroPortrait';
import { MoveButtonReplica } from './MoveTile';
import { TypeBadge } from './TypeBadge';
import { STAT_COLORS, STAT_LABELS, computeStatTotal, statFraction } from './StatBars';
import type { StatScale } from '../../run/statScale';

// The hero stage shared by the draft and the Recruit Contract claim: one hero at 144px in a sigil
// with its stat sheet beside it (the dais), the kit as the fight's own move console under them, and
// a rail of other candidates. The CSS family keeps its `.draft-*` prefix on purpose — it names the
// idiom, not the screen.

const DEFAULT_MOTES = 16;

// Golden-angle scatter: pure function of the index, stable across re-renders with no seed.
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

/** Full-bleed wash and mote field at z-index 0; every sibling after it must be lifted above it. */
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

/** Callers key this on the hero so switching candidates remounts it and replays the arrival. */
export function StageFigure({
  heroId,
  heroName,
  onInspect,
  children,
}: {
  heroId: string;
  heroName: string;
  onInspect?: () => void;
  /** Drawn on the figure (level pip, binding ring). A remount replays it too — clear one-shot animations when the hero changes. */
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

// Same set the Stat Total sums (StatBars TOTAL_STATS); MP Regen is flat across the roster.
const SHEET_STATS: readonly StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed', 'manaPool'];

/** The figure and the sheet beside it, side by side. */
export function StageDais({ children }: { children: ReactNode }) {
  return <div className="draft-dais">{children}</div>;
}

/** Seven bars on StatBars' shared reference plus their total. `grants` is the flat delta the hero already carries (entryStats.ts); `scale` the run's reference, level 1's at the draft. */
export function StageSheet({ baseStats, grants = {}, scale }: { baseStats: StatLine; grants?: StatModifiers; scale?: StatScale }) {
  const effective = Object.fromEntries(
    SHEET_STATS.map((stat) => [stat, baseStats[stat] + (grants[stat] ?? 0)])
  ) as Record<StatKey, number>;
  return (
    <div className="draft-sheet">
      {SHEET_STATS.map((stat) => {
        const granted = grants[stat] ?? 0;
        const value = effective[stat];
        return (
          <div className="draft-sheet-row" key={stat} style={{ '--stat': STAT_COLORS[stat] } as CSSProperties}>
            <span className="draft-sheet-label">{STAT_LABELS[stat]}</span>
            <span className="draft-sheet-track">
              <span className="draft-sheet-fill" style={{ width: `${statFraction(stat, value, scale) * 100}%` }} />
            </span>
            <span className={`draft-sheet-value${granted ? ' is-boosted' : ''}`}>{value}</span>
          </div>
        );
      })}
      <div className="draft-sheet-total" title="Stat Total — the seven bars above it, summed">
        <span className="draft-sheet-label">Stat Total</span>
        <span className="draft-sheet-value">{computeStatTotal(effective)}</span>
      </div>
    </div>
  );
}

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
 * The kit as the fight shows it: the same move rows the console deals, read without a board
 * (MoveButtonReplica). A tap pops the dossier over the stage. `caster` is what a heal's
 * figure and a Class move's type resolve against.
 */
export function StageKit({ moveIds, caster, onPick }: { moveIds: readonly string[]; caster?: HealCaster; onPick: (move: MoveDefinition) => void }) {
  return (
    <div className="move-list draft-console">
      {moveIds.map((moveId) => {
        const move = moves[moveId];
        if (!move) return null;
        return <MoveButtonReplica key={moveId} move={move} caster={caster} onClick={() => onPick(move)} />;
      })}
    </div>
  );
}

/** The in-combat move dossier, minus the forecast — `caster` rather than a `context` says there is no fight. */
export function StageMovePopup({ move, caster, onClose }: { move: MoveDefinition; caster?: HealCaster; onClose: () => void }) {
  return <MoveDetailOverlay move={move} caster={caster} onClose={onClose} />;
}

export function StageRail({ children }: { children: ReactNode }) {
  return <div className="draft-rail">{children}</div>;
}

/** One candidate on the rail. `sealed` is the screen's "already spoken for" state. */
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
