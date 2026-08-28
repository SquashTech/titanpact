import type { StatKey, StatLine } from '../../engine/content';
import { STAT_COLORS, StatGlyph } from './statIcons';

export const STAT_ORDER: StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed', 'manaPool', 'mpRegen'];

/** Abbreviated everywhere a stat block reads (StatBars, buff/debuff chips, equipment/Evolution grant chips) — Pokémon-VGC-style short codes instead of full words, so the fixed-width bar-label column never wraps or truncates. */
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

/** Re-exported so the dozen screens that draw a stat block keep importing their color and their glyph from the same place; both now live in statIcons.tsx, where the glyph geometry needs the color anyway. */
export { STAT_COLORS, StatGlyph } from './statIcons';

/**
 * Fixed reference ceilings, not per-hero maxes — this is what makes bar
 * length comparable both within one hero's block (tallest bar = best stat)
 * and across heroes (a 120 HP bar is visibly longer than a 90 HP bar).
 * Chosen with headroom above the current fixture roster's base stats
 * (src/data/heroes.ts, ~30-120 on core stats) plus typical rank/equipment
 * grants, so a well-built hero's bars approach but rarely clip full width.
 */
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

/**
 * One stat's value as a 0-1 fraction of its shared reference ceiling — the
 * bar-length calculation below, exposed so any other stat readout is drawn
 * on the *same* scale rather than re-deriving its own ceilings. The draft
 * screen's compact stat silhouette is the first such caller; duplicating
 * STAT_SCALE_MAX there would have meant two blocks that silently disagree
 * about how long a 90 HP bar is.
 */
export function statFraction(stat: StatKey, value: number): number {
  return Math.min(1, Math.max(0, value) / STAT_SCALE_MAX[stat]);
}

function fmtDelta(n: number): string {
  if (n === 0) return '';
  return n > 0 ? `+${n}` : `${n}`;
}

/** Shared HP-bar color tiering (CombatantCard's battlefield bars and the hero-detail resource row alike), so "HP is getting low" reads as the same color threshold everywhere a bar is drawn. */
export function hpTier(fraction: number): 'hp-high' | 'hp-mid' | 'hp-low' {
  if (fraction > 0.5) return 'hp-high';
  if (fraction > 0.2) return 'hp-mid';
  return 'hp-low';
}

/**
 * The stats summed for the Stat Total (balance-tracking readout, CLAUDE.md
 * north-star "every hero must be viable"). Mana Pool counts (2026-08-28):
 * the authored starter spreads are budgeted at 450 across HP + Mana Pool +
 * the five battle stats, so a total that left Mana Pool out reported a
 * mana-heavy hero as 80 points weaker than a lean one that had simply spent
 * the same budget elsewhere. Buying a deep pool IS how a hero pays for its
 * power.
 *
 * MP Regen stays out — it is flat 10 on every hero (src/data/heroes.ts), so
 * it distinguishes nobody and only inflates the number. Revisit if a hero
 * ever authors a different regen.
 */
const TOTAL_STATS: readonly StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed', 'manaPool'];

/**
 * Sums whatever stat values it is handed — base stats for an unmodified hero,
 * *effective* ones wherever the caller has them. Renamed from BST /
 * computeBst (2026-08-28): the number on screen is deliberately no longer the
 * authored base total, it is what this hero currently is, so equipment,
 * relics, a Class, Evolution grants and live combat buffs all move it. A
 * player comparing two builds reads the answer off one number instead of
 * summing seven bars in their head. The authored 450 budget still exists as a
 * balance constraint (src/data/heroes.ts) — it just isn't what the UI reports.
 */
export function computeStatTotal(stats: Partial<Record<StatKey, number>>): number {
  return TOTAL_STATS.reduce((sum, stat) => sum + (stats[stat] ?? 0), 0);
}

interface Props {
  baseStats: StatLine;
  /** Additive deltas layered on top of base — rank/equipment grants (run tier) or live combat buffs/debuffs. Omit for a plain base readout. Used for the "+N" annotation text even when `totals` is also given. */
  deltas?: Partial<Record<StatKey, number>>;
  /**
   * Final effective value per stat, when it isn't simply baseStats+deltas —
   * e.g. Freeze's Speed halving (engine/state.ts getEffectiveStat). Falls back to
   * baseStats+deltas per-stat when a stat is omitted, so callers with no live
   * combat statuses (CompendiumScreen, HeroPreviewOverlay) don't need this.
   */
  totals?: Partial<Record<StatKey, number>>;
}

/**
 * Color-coded bar-graph stat block (CLAUDE.md-adjacent Pokémon-VGC framing):
 * replaces the old row-of-numbers table so a player can read a hero's
 * strongest/weakest stat at a glance instead of parsing 8 numbers. Bar length
 * is on a fixed shared scale (STAT_SCALE_MAX) so it's meaningful both within
 * one hero's block and across different heroes' blocks.
 */
export function StatBars({ baseStats, deltas = {}, totals: totalOverrides = {} }: Props) {
  const totals = STAT_ORDER.map((stat) => Math.max(0, totalOverrides[stat] ?? baseStats[stat] + (deltas[stat] ?? 0)));
  const percents = STAT_ORDER.map((stat, i) => Math.min(100, (totals[i] / STAT_SCALE_MAX[stat]) * 100));
  const bestPercent = Math.max(...percents);
  /**
   * Summed from the same effective numbers the bars above are drawn from —
   * NOT from baseStats — so every source of stats a hero picks up in a run
   * (equipment, relics, Class, Evolution grants, live buffs/debuffs, and a
   * status-pipeline effect like Freeze that the `totals` override carries)
   * moves this number the moment it moves a bar. The delta beside it is
   * against the authored base, the same "+N" annotation each stat row uses.
   */
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
