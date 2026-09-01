import type { StatKey, StatLine } from '../../engine/content';
import { STAT_ORDER } from '../../engine/content';
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
  hp: 170,
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

// Stat Total counts Mana Pool (the 450 starter budget includes it) and excludes MP Regen (flat 10 on every hero).
const TOTAL_STATS: readonly StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed', 'manaPool'];

/** Sums whatever stat values it is handed — effective ones wherever the caller has them, not the authored base. */
export function computeStatTotal(stats: Partial<Record<StatKey, number>>): number {
  return TOTAL_STATS.reduce((sum, stat) => sum + (stats[stat] ?? 0), 0);
}

interface Props {
  baseStats: StatLine;
  /** Additive deltas on top of base (grants or live buffs); drives the "+N" annotation even when `totals` is given. */
  deltas?: Partial<Record<StatKey, number>>;
  /** Final effective value where it isn't base+deltas (e.g. Freeze's Speed halving). Per-stat fallback to base+deltas. */
  totals?: Partial<Record<StatKey, number>>;
}

export function StatBars({ baseStats, deltas = {}, totals: totalOverrides = {} }: Props) {
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
        return (
          <div className={`stat-bar-row${isBest ? ' stat-bar-best' : ''}`} key={stat}>
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
    </div>
  );
}
