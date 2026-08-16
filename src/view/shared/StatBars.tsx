import type { StatKey, StatLine } from '../../engine/content';

export const STAT_ORDER: StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed', 'manaPool', 'mpRegen'];

export const STAT_LABELS: Record<StatKey, string> = {
  hp: 'HP',
  attack: 'Attack',
  defense: 'Defense',
  intelligence: 'Intelligence',
  wisdom: 'Wisdom',
  speed: 'Speed',
  manaPool: 'Mana Pool',
  mpRegen: 'MP Regen',
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

interface Props {
  baseStats: StatLine;
  /** Additive deltas layered on top of base — rank/equipment grants (run tier) or live combat buffs/debuffs. Omit for a plain base readout. */
  deltas?: Partial<Record<StatKey, number>>;
}

/**
 * Color-coded bar-graph stat block (CLAUDE.md-adjacent Pokémon-VGC framing):
 * replaces the old row-of-numbers table so a player can read a hero's
 * strongest/weakest stat at a glance instead of parsing 8 numbers. Bar length
 * is on a fixed shared scale (STAT_SCALE_MAX) so it's meaningful both within
 * one hero's block and across different heroes' blocks.
 */
export function StatBars({ baseStats, deltas = {} }: Props) {
  const totals = STAT_ORDER.map((stat) => Math.max(0, baseStats[stat] + (deltas[stat] ?? 0)));
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
    </div>
  );
}
