import type { StatKey, StatLine } from '../../engine/content';
import { STAT_ORDER } from '../../engine/content';
import { GRADE_CHANCE, gradeMaxPoints, growthUnitFor, type GrowthGrade, type GrowthGrades } from '../../run/growth';
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

// Fixed reference ceilings, not per-hero maxes, so bar length is comparable across heroes.
const STAT_SCALE_MAX: Record<StatKey, number> = {
  hp: 340,
  attack: 110,
  defense: 120,
  intelligence: 110,
  wisdom: 100,
  speed: 120,
  manaPool: 120,
  mpRegen: 16,
};

/** A stat's 0-1 fraction of its shared ceiling — every stat readout draws on this one scale. */
export function statFraction(stat: StatKey, value: number): number {
  return Math.min(1, Math.max(0, value) / STAT_SCALE_MAX[stat]);
}

function fmtDelta(n: number): string {
  if (n === 0) return '';
  return n > 0 ? `+${n}` : `${n}`;
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
}

export function StatBars({ baseStats, deltas = {}, totals: totalOverrides = {}, grades }: Props) {
  const totals = STAT_ORDER.map((stat) => Math.max(0, totalOverrides[stat] ?? baseStats[stat] + (deltas[stat] ?? 0)));
  const percents = STAT_ORDER.map((stat, i) => Math.min(100, (totals[i] / STAT_SCALE_MAX[stat]) * 100));
  const bestPercent = Math.max(...percents);
  // Summed from the same effective numbers the bars draw, never from baseStats.
  const effective = Object.fromEntries(STAT_ORDER.map((stat, i) => [stat, totals[i]])) as Record<StatKey, number>;
  const statTotal = computeStatTotal(effective);
  const totalDelta = statTotal - computeStatTotal(baseStats);

  return (
    <div className="stat-bars">
      {STAT_ORDER.map((stat, i) => {
        const delta = deltas[stat] ?? 0;
        const isBest = percents[i] === bestPercent && bestPercent > 0;
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
            </div>
            <span className="stat-bar-value">
              {totals[i]}
              {delta !== 0 && <span className={delta > 0 ? 'stat-buff' : 'stat-debuff'}> {fmtDelta(delta)}</span>}
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
