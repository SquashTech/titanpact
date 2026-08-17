import type { StatKey, StatLine } from '../../engine/content';

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

/** One glyph per stat, shared everywhere a stat reads compactly — battlefield stat-mod corner badges (CombatantCard) and stat-block labels (StatBars, HeroDetailOverlay) alike, so a player learns one icon vocabulary for both contexts. */
export const STAT_ICONS: Record<StatKey, string> = {
  hp: '❤️',
  attack: '⚔️',
  defense: '🛡️',
  intelligence: '🧠',
  wisdom: '🔮',
  speed: '👟',
  manaPool: '💧',
  mpRegen: '🔄',
};

/** One color per stat, shared everywhere a stat block is drawn — lets a player learn "purple = Intelligence" once and read every hero's block by color from then on. */
export const STAT_COLORS: Record<StatKey, string> = {
  hp: '#4caf6a',
  attack: '#d9534f',
  defense: '#8a94a8',
  intelligence: '#c356d0',
  wisdom: '#7fd6e0',
  speed: '#e8d16a',
  manaPool: '#4a90d9',
  mpRegen: '#4cd9a0',
};

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

function fmtDelta(n: number): string {
  if (n === 0) return '';
  return n > 0 ? `+${n}` : `${n}`;
}

/**
 * Core combat stats summed for BST (balance-tracking readout, CLAUDE.md
 * north-star "every hero must be viable"). Mirrors Pokémon's Base Stat Total
 * but excludes Mana Pool/MP Regen — those are the separate tempo/resource
 * axis CLAUDE.md's "Mana & tempo" section calls out, not raw combat power,
 * so folding them in would understate a lean-mana hero's BST relative to a
 * mana-heavy one of equal combat strength.
 */
const BST_STATS: readonly StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed'];

/** Always computed from base stats — the authored design number, not affected by live buffs/equipment/statuses — so it reads the same in every context that shows a stat block. */
export function computeBst(baseStats: StatLine): number {
  return BST_STATS.reduce((sum, stat) => sum + baseStats[stat], 0);
}

interface Props {
  baseStats: StatLine;
  /** Additive deltas layered on top of base — rank/equipment grants (run tier) or live combat buffs/debuffs. Omit for a plain base readout. Used for the "+N" annotation text even when `totals` is also given. */
  deltas?: Partial<Record<StatKey, number>>;
  /**
   * Final effective value per stat, when it isn't simply baseStats+deltas —
   * e.g. Blight's multiplicative Attack/Defense/Int/Wisdom reduction or
   * Freeze's Speed halving (engine/state.ts getEffectiveStat). Falls back to
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

  return (
    <div className="stat-bars">
      {STAT_ORDER.map((stat, i) => {
        const delta = deltas[stat] ?? 0;
        const isBest = percents[i] === bestPercent && bestPercent > 0;
        return (
          <div className={`stat-bar-row${isBest ? ' stat-bar-best' : ''}`} key={stat}>
            <span className="stat-bar-label">
              <span aria-hidden="true">{STAT_ICONS[stat]}</span> {STAT_LABELS[stat]}
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
        className="stat-bst-row"
        title="Base Stat Total — HP + Attack + Defense + Intelligence + Wisdom + Speed (Mana Pool / MP Regen excluded, a separate tempo axis)"
      >
        <span className="stat-bst-label">BST</span>
        <span className="stat-bst-value">{computeBst(baseStats)}</span>
      </div>
    </div>
  );
}
