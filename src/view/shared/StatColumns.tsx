import type { StatKey, StatLine } from '../../engine/content';
import { GRADE_CHANCE, type GrowthGrades } from '../../run/growth';
import { BASE_STAT_SCALE, type StatScale } from '../../run/statScale';
import { STAT_COLORS, StatGlyph, STAT_LABELS, statFraction } from './StatBars';

/** The seven stats the 550 budget covers. MP Regen is a flat 10 on every hero, so it has no column. */
const COLUMN_STATS: readonly StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed', 'manaPool'];

/**
 * The stat line as a row of upright columns, one a stat across the box: the figure and growth
 * letter on top, the bar rising from a shared floor, the glyph and label under it. The same scale
 * and par tick as StatBars, so a column reads exactly as long as its bar would.
 */
export function StatColumns({ baseStats, grades, scale = BASE_STAT_SCALE }: { baseStats: StatLine; grades?: GrowthGrades; scale?: StatScale }) {
  const fractions = COLUMN_STATS.map((stat) => statFraction(stat, baseStats[stat], scale));
  const best = Math.max(...fractions);
  return (
    <div className="stat-columns">
      {COLUMN_STATS.map((stat, i) => {
        const grade = grades?.[stat as keyof GrowthGrades];
        const isBest = fractions[i] === best;
        return (
          <div key={stat} className={`stat-column${isBest ? ' is-best' : ''}`}>
            <span className="stat-column-value">
              {baseStats[stat]}
              {grade && (
                <span className={`stat-column-grade is-${grade}`} title={`Growth ${grade} — ${Math.round(GRADE_CHANCE[grade] * 100)}% chance each level raises ${STAT_LABELS[stat]}`}>
                  {grade}
                </span>
              )}
            </span>
            <span className="stat-column-track">
              <span className="stat-column-fill" style={{ height: `${fractions[i] * 100}%`, background: isBest ? 'var(--accent)' : STAT_COLORS[stat] }} />
              <span className="stat-column-par" style={{ bottom: `${statFraction(stat, scale.par[stat], scale) * 100}%` }} />
            </span>
            <span className="stat-column-label">
              <StatGlyph stat={stat} />
              {STAT_LABELS[stat]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
