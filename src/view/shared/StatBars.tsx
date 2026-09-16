import type { StatKey, StatLine } from '../../engine/content';
import { STAT_ORDER } from '../../engine/content';
import { GRADE_CHANCE, gradeMaxPoints, growthUnitFor, type GrowthGrade, type GrowthGrades } from '../../run/growth';
import { BASE_STAT_SCALE, type StatScale } from '../../run/statScale';
import { STAT_COLORS, StatGlyph } from './statIcons';

// Re-exported so screens keep one import site for the stat-block vocabulary.
export { STAT_ORDER };
export { STAT_COLORS, StatGlyph } from './statIcons';

/** 3-letter codes for the fixed-width bar-label column; relicStacks.ts has the full words. */
export const STAT_LABELS: Record<StatKey, string> = {
  hp: 'HP',
  attack: 'ATK',
  defense: 'DEF',
  intelligence: 'INT',
  wisdom: 'WIS',
  speed: 'SPD',
  manaPool: 'MP',
  mpRegen: 'MPR',
};

/**
 * A stat's 0-1 fraction of the reference ceiling (run/statScale.ts) — every stat readout draws on
 * this one scale, so bar length is comparable across heroes. The reference walks with the run's
 * par; without one it is level 1's.
 */
export function statFraction(stat: StatKey, value: number, scale: StatScale = BASE_STAT_SCALE): number {
  return Math.min(1, Math.max(0, value) / scale.ceiling[stat]);
}

function fmtDelta(n: number): string {
  if (n === 0) return '';
  return n > 0 ? `+${n}` : `${n}`;
}

/**
 * A Shield on the HP bar (docs/shield.md §5): a pale band drawn past the fill in the bar's own
 * track, so the pool reads as health the hero has not spent yet. The track's length is still max
 * HP and cannot grow, so what will not fit after the fill is laid OVER it from the left — the
 * mana overflow's answer — and a full hero with a full Shield reads as a bar that is twice full.
 * The exact figure is always beside it in the label.
 */
export function ShieldFill({ currentHp, maxHp, shield, as: Tag = 'div' }: { currentHp: number; maxHp: number; shield: number; as?: 'div' | 'span' }) {
  if (shield <= 0 || maxHp <= 0) return null;
  const hpFraction = Math.max(0, Math.min(1, currentHp / maxHp));
  const past = Math.min(shield / maxHp, 1 - hpFraction);
  const over = Math.max(0, Math.min(1, shield / maxHp - past));
  return (
    <>
      {past > 0 && <Tag className="bar-fill shield" style={{ left: `${hpFraction * 100}%`, width: `${past * 100}%` }} />}
      {over > 0 && <Tag className="bar-fill shield-over" style={{ width: `${over * 100}%` }} />}
    </>
  );
}

/** The "+N" the HP label gains while a Shield is held, in the Shield's tone. */
export function ShieldLabel({ shield }: { shield: number }) {
  if (shield <= 0) return null;
  return <span className="shield-label"> +{shield}</span>;
}

/** Shared HP-bar color tiering, so "HP is getting low" is the same threshold everywhere. */
export function hpTier(fraction: number): 'hp-high' | 'hp-mid' | 'hp-low' {
  if (fraction > 0.5) return 'hp-high';
  if (fraction > 0.2) return 'hp-mid';
  return 'hp-low';
}

// Stat Total counts Mana Pool (the 550 roster total includes it) and excludes MP Regen (flat 10 on every hero).
// This sum IS the roster rule — heroStatTotal in statBudget.ts pins every authored line to 550.
const TOTAL_STATS: readonly StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed', 'manaPool'];

/** Sums whatever stat values it is handed — effective ones wherever the caller has them, not the authored base. */
export function computeStatTotal(stats: Partial<Record<StatKey, number>>): number {
  return TOTAL_STATS.reduce((sum, stat) => sum + (stats[stat] ?? 0), 0);
}

// The growth column's tone ramp. Two above the line read as gains and four below fade out of
// the way, because the question a grade answers is "does THIS stat grow", not "rank all seven".
const GRADE_TONE: Record<GrowthGrade, { color: string; opacity: number; weight: number }> = {
  S: { color: 'var(--accent)', opacity: 1, weight: 700 },
  A: { color: 'var(--accent)', opacity: 0.82, weight: 700 },
  B: { color: 'var(--text)', opacity: 0.72, weight: 600 },
  C: { color: 'var(--text-dim)', opacity: 0.9, weight: 600 },
  D: { color: 'var(--text-dim)', opacity: 0.66, weight: 600 },
  E: { color: 'var(--text-dim)', opacity: 0.5, weight: 600 },
  F: { color: 'var(--text-dim)', opacity: 0.38, weight: 600 },
};

const GRADE_ORDER: readonly GrowthGrade[] = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];

/** The 3-column grid with the growth letter added; set inline so no caller without grades pays for it. */
const GRADED_COLUMNS = '68px minmax(0, 1fr) 58px 16px';

interface Props {
  baseStats: StatLine;
  /** Additive deltas on top of base (grants or live buffs); drives the "+N" annotation even when `totals` is given. */
  deltas?: Partial<Record<StatKey, number>>;
  /** Final effective value where it isn't base+deltas (e.g. Freeze's Speed halving). Per-stat fallback to base+deltas. */
  totals?: Partial<Record<StatKey, number>>;
  /**
   * The hero's growth grades, which turn the bars into a forecast rather than a snapshot. Opt-in:
   * a combat card is asking what this hero IS, and only a sheet is asking what it becomes.
   */
  grades?: GrowthGrades;
  /**
   * What THIS fight did to the line, apart from the loadout: the row reads "from → to" for a stat
   * the fight moved, and the track carries a tick at the floor a debuff can take it to and, when
   * it fits the scale, at the ceiling a buff can (docs/stat-scaling.md §3, §5). `floors` and
   * `ceilings` are effective values, not modifiers.
   */
  fight?: { deltas: Partial<Record<StatKey, number>>; floors: Partial<Record<StatKey, number>>; ceilings?: Partial<Record<StatKey, number>> };
  /**
   * The reference the bars are drawn against (run/statScale.ts): the run's, so a hero is read
   * against the fights it is in and the roster beside it. Level 1's when omitted — the draft and
   * the Compendium, where there is no run to be at par with.
   */
  scale?: StatScale;
}

export function StatBars({ baseStats, deltas = {}, totals: totalOverrides = {}, grades, fight, scale = BASE_STAT_SCALE }: Props) {
  const totals = STAT_ORDER.map((stat) => Math.max(0, totalOverrides[stat] ?? baseStats[stat] + (deltas[stat] ?? 0)));
  const percents = STAT_ORDER.map((stat, i) => statFraction(stat, totals[i], scale) * 100);
  // The spike the sheet highlights is one of the seven graded stats; MP Regen is flat on everyone.
  const bestPercent = Math.max(...percents.filter((_, i) => TOTAL_STATS.includes(STAT_ORDER[i])));
  // Summed from the same effective numbers the bars draw, never from baseStats.
  const effective = Object.fromEntries(STAT_ORDER.map((stat, i) => [stat, totals[i]])) as Record<StatKey, number>;
  const statTotal = computeStatTotal(effective);
  const totalDelta = statTotal - computeStatTotal(baseStats);

  return (
    <div className="stat-bars">
      {STAT_ORDER.map((stat, i) => {
        const delta = deltas[stat] ?? 0;
        const isBest = TOTAL_STATS.includes(stat) && percents[i] === bestPercent && bestPercent > 0;
        const grade = grades?.[stat as keyof GrowthGrades];
        return (
          <div
            className={`stat-bar-row${isBest ? ' stat-bar-best' : ''}`}
            key={stat}
            style={grades ? { gridTemplateColumns: GRADED_COLUMNS } : undefined}
          >
            <span className="stat-bar-label">
              <StatGlyph stat={stat} /> {STAT_LABELS[stat]}
            </span>
            <div className="stat-bar-track">
              <div className="stat-bar-fill" style={{ width: `${percents[i]}%`, background: isBest ? 'var(--accent)' : STAT_COLORS[stat] }} />
              {/* Par: where a typical hero at the reference level stands, so the fill reads as ahead of or behind the run. */}
              <div
                className="stat-bar-par"
                style={{ left: `${statFraction(stat, scale.par[stat], scale) * 100}%` }}
                title={`A typical hero at Lv ${scale.level} has ${scale.par[stat]} ${STAT_LABELS[stat]}`}
              />
              {fight && fight.floors[stat] !== undefined && fight.floors[stat]! > 0 && (
                // The floor a debuff can take this stat to (docs/stat-scaling.md §3) — where the bar stops shrinking.
                <div
                  className={`stat-bar-floor${(fight.deltas[stat] ?? 0) < 0 && totals[i] <= fight.floors[stat]! ? ' is-held' : ''}`}
                  style={{ left: `${statFraction(stat, fight.floors[stat]!, scale) * 100}%` }}
                  title={`${STAT_LABELS[stat]} can't go lower than ${fight.floors[stat]}`}
                />
              )}
              {fight && fight.ceilings?.[stat] !== undefined && fight.ceilings[stat]! > 0 && fight.ceilings[stat]! <= scale.ceiling[stat] && (
                <div
                  className={`stat-bar-floor${(fight.deltas[stat] ?? 0) > 0 && totals[i] >= fight.ceilings[stat]! ? ' is-held' : ''}`}
                  style={{ left: `${statFraction(stat, fight.ceilings[stat]!, scale) * 100}%` }}
                  title={`${STAT_LABELS[stat]} can't go higher than ${fight.ceilings[stat]}`}
                />
              )}
            </div>
            <span className="stat-bar-value">
              {fight && fight.deltas[stat] ? (
                // What the fight did, read as from → to: the loadout figure it started at, then where it stands.
                <>
                  <span className="stat-bar-from">{totals[i] - fight.deltas[stat]!}</span>
                  <span className="stat-bar-arrow"> → </span>
                  <span className={fight.deltas[stat]! > 0 ? 'stat-buff' : 'stat-debuff'}>{totals[i]}</span>
                </>
              ) : (
                <>
                  {totals[i]}
                  {delta !== 0 && <span className={delta > 0 ? 'stat-buff' : 'stat-debuff'}> {fmtDelta(delta)}</span>}
                </>
              )}
            </span>
            {grades &&
              (grade ? (
                <span
                  className="stat-bar-grade"
                  style={{ color: GRADE_TONE[grade].color, opacity: GRADE_TONE[grade].opacity, fontWeight: GRADE_TONE[grade].weight }}
                  title={`Growth ${grade} — ${Math.round(GRADE_CHANCE[grade] * 100)}% chance each level raises ${STAT_LABELS[stat]}, by up to +${gradeMaxPoints(grade) * growthUnitFor(stat)}`}
                >
                  {grade}
                </span>
              ) : (
                // MP Regen has no grade and never will — a dash so the column reads as deliberate.
                <span className="stat-bar-grade is-none" title="MP Regen is flat across the roster and does not grow">
                  –
                </span>
              ))}
          </div>
        );
      })}
      <div className="stat-par-key" aria-label={`The tick on each bar: a typical hero at Lv ${scale.level}`}>
        <span className="stat-par-key-tick" />
        <span>typical hero at Lv {scale.level}</span>
      </div>
      <div
        className="stat-total-row"
        title="Stat Total — HP + Attack + Defense + Intelligence + Wisdom + Speed + Mana Pool, as this hero currently stands (MP Regen excluded, flat across the roster)"
      >
        <span className="stat-total-label">Stat Total</span>
        <span className="stat-total-value">
          {statTotal}
          {totalDelta !== 0 && <span className={totalDelta > 0 ? 'stat-buff' : 'stat-debuff'}> {fmtDelta(totalDelta)}</span>}
        </span>
      </div>
      {/*
       * The key to the letter column. It was three sentences of prose — "Letters are growth grades
       * — the chance a level raises that stat, S 95% down to F 5%. All seven cost the same on every
       * hero, so the line says where growth lands, not how much." — which is documentation set in
       * the middle of a character sheet, and it taught two of the seven grades by naming the ends
       * of a scale the reader could not see.
       *
       * A legend teaches all seven at once, in the same tones the column itself uses, and it is
       * DATA rather than prose: the same object a chart or a map key is. The second sentence goes
       * entirely — a line being on budget is a fact about authoring, not something a player reads a
       * sheet to learn.
       */}
      {grades && (
        <div className="stat-growth-key" aria-label="Growth grades: the chance a level raises that stat">
          <span className="stat-growth-key-label">Growth</span>
          {GRADE_ORDER.map((g) => (
            <span key={g} className="stat-growth-key-cell">
              <span className="stat-growth-key-grade" style={{ color: GRADE_TONE[g].color, opacity: GRADE_TONE[g].opacity }}>
                {g}
              </span>
              <span className="stat-growth-key-pct">{Math.round(GRADE_CHANCE[g] * 100)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
