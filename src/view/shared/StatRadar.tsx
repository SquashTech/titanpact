import type { CSSProperties } from 'react';
import type { StatKey, StatLine } from '../../engine/content';
import { heroes } from '../../data/heroes';
import { GRADE_CHANCE, type GrowthGrades } from '../../run/growth';
import { BASE_STAT_SCALE } from '../../run/statScale';
import { STAT_COLORS, StatGlyph, STAT_LABELS } from './StatBars';

/** The seven stats the 550 budget covers, clockwise from the top. MP Regen is flat and sits outside. */
const RADAR_STATS: readonly StatKey[] = ['hp', 'attack', 'defense', 'speed', 'wisdom', 'intelligence', 'manaPool'];

const W = 300;
const H = 236;
const CX = W / 2;
const CY = 120;
const R = 78;
const LABEL_R = R + 30;
/** A stat at zero still leaves a sliver, so the shape never collapses onto the centre. */
const MIN_FRACTION = 0.06;

/** The rim is the roster's own highest base figure for each stat, so the hero a stat is the spike of reaches the edge. */
const ROSTER_PEAK = Object.fromEntries(RADAR_STATS.map((stat) => [stat, Math.max(...Object.values(heroes).map((hero) => hero.baseStats[stat]))])) as Record<StatKey, number>;

const fractionOf = (stat: StatKey, value: number) => Math.min(1, Math.max(0, value) / ROSTER_PEAK[stat]);

function point(i: number, r: number): [number, number] {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / RADAR_STATS.length;
  return [CX + Math.cos(angle) * r, CY + Math.sin(angle) * r];
}

function polygon(fractions: readonly number[]): string {
  return fractions.map((f, i) => point(i, R * Math.max(MIN_FRACTION, f)).join(',')).join(' ');
}

/**
 * A hero's shape at a glance: the seven budgeted stats as a heptagon against the roster's peak
 * for each, the level-1 typical hero's shape dashed beneath it, each corner carrying its figure
 * and growth letter. The spike — the stat the hero is signalled by — is lit.
 */
export function StatRadar({ baseStats, grades, color }: { baseStats: StatLine; grades?: GrowthGrades; color: string }) {
  const fractions = RADAR_STATS.map((stat) => fractionOf(stat, baseStats[stat]));
  const par = RADAR_STATS.map((stat) => fractionOf(stat, BASE_STAT_SCALE.par[stat]));
  const best = Math.max(...fractions);

  return (
    <div className="stat-radar" style={{ '--radar-color': color } as CSSProperties}>
      <svg viewBox={`0 0 ${W} ${H}`} className="stat-radar-svg" aria-hidden="true">
        {[0.25, 0.5, 0.75, 1].map((ring) => (
          <polygon key={ring} className="stat-radar-ring" points={polygon(RADAR_STATS.map(() => ring))} />
        ))}
        {RADAR_STATS.map((stat, i) => {
          const [x, y] = point(i, R);
          return <line key={stat} className="stat-radar-spoke" x1={CX} y1={CY} x2={x} y2={y} />;
        })}
        <polygon className="stat-radar-par" points={polygon(par)} />
        <polygon className="stat-radar-shape" points={polygon(fractions)} />
        {RADAR_STATS.map((stat, i) => {
          const [x, y] = point(i, R * Math.max(MIN_FRACTION, fractions[i]));
          const isBest = fractions[i] === best;
          return <circle key={stat} className={`stat-radar-dot${isBest ? ' is-best' : ''}`} cx={x} cy={y} r={isBest ? 4 : 2.6} style={{ fill: isBest ? undefined : STAT_COLORS[stat] }} />;
        })}
      </svg>
      {RADAR_STATS.map((stat, i) => {
        const [x, y] = point(i, LABEL_R);
        const grade = grades?.[stat as keyof GrowthGrades];
        const isBest = fractions[i] === best;
        return (
          <div
            key={stat}
            className={`stat-radar-label${isBest ? ' is-best' : ''}`}
            style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }}
            title={grade ? `Growth ${grade} — ${Math.round(GRADE_CHANCE[grade] * 100)}% chance each level raises ${STAT_LABELS[stat]}` : undefined}
          >
            <span className="stat-radar-label-name">
              <StatGlyph stat={stat} /> {STAT_LABELS[stat]}
            </span>
            <span className="stat-radar-label-value">
              {baseStats[stat]}
              {grade && <span className={`stat-radar-grade is-${grade}`}>{grade}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
