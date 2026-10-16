import type { StatKey, StatLine } from '../../engine/content';
import { GRADE_CHANCE, type GrowthGrades } from '../../run/growth';
import { BASE_STAT_SCALE, type StatScale } from '../../run/statScale';
import { STAT_COLORS, StatGlyph, STAT_LABELS, statFraction } from './StatBars';

/** The seven stats the 550 budget covers. MP Regen is a flat 10 on every hero, so it has no column unless asked. */
const COLUMN_STATS: readonly StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed', 'manaPool'];
const WITH_REGEN: readonly StatKey[] = [...COLUMN_STATS, 'mpRegen'];

interface Props {
  baseStats: StatLine;
  /** The figures to draw where they are not base: loadout and fight included. */
  totals?: Partial<Record<StatKey, number>>;
  /** What this fight moved, so a raised or lowered figure wears the buff or debuff tone. */
  fightDeltas?: Partial<Record<StatKey, number>>;
  grades?: GrowthGrades;
  scale?: StatScale;
  /** An eighth column for MP Regen — the fight sheet's, where a field can move it. */
  withRegen?: boolean;
  /** The sheet banner's form: glyph and letter under the bar, no label, so eight fit beside a portrait. */
  compact?: boolean;
}

/**
 * The stat line as a row of upright columns, one a stat across the box: the figure on top, the
 * bar rising from a shared floor, the glyph under it. The same scale and par tick as StatBars, so
 * a column reads exactly as long as its bar would.
 */
export function StatColumns({ baseStats, totals = {}, fightDeltas = {}, grades, scale = BASE_STAT_SCALE, withRegen = false, compact = false }: Props) {
  const stats = withRegen ? WITH_REGEN : COLUMN_STATS;
  const values = stats.map((stat) => Math.max(0, totals[stat] ?? baseStats[stat]));
  const fractions = stats.map((stat, i) => statFraction(stat, values[i], scale));
  const best = Math.max(...fractions.filter((_, i) => stats[i] !== 'mpRegen'));
  return (
    <div className={`stat-columns${compact ? ' is-compact' : ''}`} style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
      {stats.map((stat, i) => {
        const grade = grades?.[stat as keyof GrowthGrades];
        const isBest = stat !== 'mpRegen' && fractions[i] === best && best > 0;
        const moved = fightDeltas[stat] ?? 0;
        const gradeMark = grades && (
          <span
            className={`stat-column-grade is-${grade ?? 'none'}`}
            title={grade ? `Growth ${grade} — ${Math.round(GRADE_CHANCE[grade] * 100)}% chance each level raises ${STAT_LABELS[stat]}` : `${STAT_LABELS[stat]} does not grow`}
          >
            {grade ?? '–'}
          </span>
        );
        return (
          <div key={stat} className={`stat-column${isBest ? ' is-best' : ''}`} title={`${STAT_LABELS[stat]} ${values[i]}`}>
            <span className="stat-column-value">
              <span className={moved > 0 ? 'stat-buff' : moved < 0 ? 'stat-debuff' : undefined}>{values[i]}</span>
              {!compact && gradeMark}
            </span>
            <span className="stat-column-track">
              <span className="stat-column-fill" style={{ height: `${fractions[i] * 100}%`, background: isBest ? 'var(--accent)' : STAT_COLORS[stat] }} />
              <span className="stat-column-par" style={{ bottom: `${statFraction(stat, scale.par[stat], scale) * 100}%` }} />
            </span>
            <span className="stat-column-label">
              <StatGlyph stat={stat} />
              {!compact && STAT_LABELS[stat]}
            </span>
            {compact && gradeMark}
          </div>
        );
      })}
    </div>
  );
}
