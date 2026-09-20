import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { moves } from '../../data/moves';
import { isBurden } from '../../data/passives';
import type { HeroDefinition, MoveDefinition, PassiveDefinition, StatKey, StatLine, TypeId } from '../../engine/content';
import { innatePassiveOf, titansMarkOf } from '../../run/innate';
import type { HealCaster } from '../../engine/heal/healPipeline';
import type { StatModifiers } from '../../engine/state';
import { getTypeColorRgb } from '../combat/typeColors';
import { MoveDetailOverlay } from '../combat/MoveDetailOverlay';
import { HeroPortrait } from './HeroPortrait';
import { MoveButtonReplica } from './MoveTile';
import { TypeBadge } from './TypeBadge';
import { STAT_COLORS, STAT_LABELS, computeStatTotal, statFraction } from './StatBars';
import { PassiveGlyph, passiveColor, passiveTint } from './passiveIcons';
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

/** Seven bars on StatBars' shared reference plus their total. `grants` is the flat delta the hero already carries (entryStats.ts); `scale` the run's reference, level 1's at the draft. `burden` prints the surplus the total carries (docs/innate-passives.md §4). */
export function StageSheet({ baseStats, grants = {}, scale, burden = false }: { baseStats: StatLine; grants?: StatModifiers; scale?: StatScale; burden?: boolean }) {
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
      <div className="draft-sheet-total" title={burden ? "Stat Total — over the roster's 550, the price of its Burden" : 'Stat Total — the seven bars above it, summed'}>
        <span className="draft-sheet-label">Stat Total</span>
        <span className={`draft-sheet-value${burden ? ' is-burden' : ''}`}>
          {computeStatTotal(effective)}
          {burden && <span className="draft-sheet-burden"> · Burden</span>}
        </span>
      </div>
    </div>
  );
}

/** Whether the hero's line carries the Burden surplus — the sheet's total says so beside the number. */
export function heroHasBurden(hero: Pick<HeroDefinition, 'passiveIds'>): boolean {
  return (hero.passiveIds ?? []).some(isBurden);
}

/**
 * The innate passive (docs/innate-passives.md §6), read in full on the stage — glyph, name and
 * its one sentence — because it is the line a draft is decided on, and a line behind a tap is not
 * read. The tap opens the dossier. A Titanspawn shows its Mark in the same seat, named as the
 * Titan's. Nothing renders for a definition that holds neither.
 */
export function StageInnate({ hero, onOpen }: { hero: Pick<HeroDefinition, 'passiveIds'>; onOpen?: (passive: PassiveDefinition) => void }) {
  const innate = innatePassiveOf(hero);
  const mark = innate ? null : titansMarkOf(hero);
  const passive = innate ?? mark;
  if (!passive) return null;
  const burden = isBurden(passive.id);
  const kind = mark ? "Titan's Mark" : burden ? 'Burden' : 'Innate';
  return (
    <button
      type="button"
      className={`draft-innate${burden ? ' is-burden' : ''}${mark ? ' is-mark' : ''}`}
      style={{ '--passive-color': passiveColor(passive.id), '--passive-tint': passiveTint(passive.id, 0.14) } as CSSProperties}
      onClick={onOpen ? () => onOpen(passive) : undefined}
      disabled={!onOpen}
    >
      <span className="draft-innate-icon">
        <PassiveGlyph passiveId={passive.id} />
      </span>
      <span className="draft-innate-body">
        <span className="draft-innate-head">
          <span className="draft-innate-kind">{kind}</span>
          <span className="draft-innate-name">{passive.name}</span>
        </span>
        <span className="draft-innate-desc">{passive.description}</span>
      </span>
    </button>
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
