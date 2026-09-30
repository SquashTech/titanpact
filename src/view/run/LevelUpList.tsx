import type { CSSProperties } from 'react';
import { rosterHeroes } from '../../data/content';
import type { StatKey } from '../../engine/content';
import { GROWTH_STATS, MAX_LEVEL, growthUnitFor, xpProgress, xpToNextLevel, type HeroLevelUp } from '../../run/growth';
import { getTypeColor } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { STAT_COLORS, STAT_LABELS, StatGlyph } from '../shared/StatBars';

/** The tag a row wears when its level has reached the hero's signature — drawn in the signature's own gold. */
export const SIGNATURE_TAG = '✦ Signature!';

/**
 * A gain of this many points or more, on ONE level, is a big one and gets the louder cell. A
 * report can cover several levels at once, so the bar rises by two a level past the first —
 * two ordinary rolls in a row is not the same thing as one that reached the top of its grade.
 */
const BIG_ROLL_POINTS = 3;

function isBigRoll(points: number, levels: number): boolean {
  return points >= BIG_ROLL_POINTS + 2 * Math.max(0, levels - 1);
}

interface ListProps {
  report: readonly HeroLevelUp[];
  /**
   * Every growth stat gets a cell whether or not it rolled: the misses are what make the hits read
   * as a ROLL against a grade, and a row of constant width is what lets six be scanned at a glance.
   * Off, a row is the hero, its levels and its bar.
   */
  gains?: boolean;
  /** The tag for what a hero's level still owes it; omitted, no row wears one. */
  owedFor?: (rosterId: string) => string | null;
}

/**
 * The whole roster's rows, benched heroes included — that IS the rule, and one fielded hero
 * levelling would read as participation XP. Landed at once and still: the victory screen has
 * already swept the bars.
 */
export function LevelUpList({ report, gains = false, owedFor }: ListProps) {
  return (
    <div className={`level-up-list${gains ? '' : ' is-compact'}`}>
      {report.map((hero) => (
        <LevelUpRow key={hero.rosterId} hero={hero} gains={gains} owed={owedFor?.(hero.rosterId) ?? null} />
      ))}
    </div>
  );
}

interface RowProps {
  hero: HeroLevelUp;
  gains: boolean;
  /** The tag for what this level still owes the hero, or null for nothing. */
  owed: string | null;
}

function LevelUpRow({ hero, gains, owed }: RowProps) {
  const definition = rosterHeroes[hero.heroId];
  if (!definition) return null;
  const levels = hero.toLevel - hero.fromLevel;
  const atCap = hero.toLevel >= MAX_LEVEL;
  // Dimmed only at the cap. A row the grant left part-way to its next level is not a miss: the
  // bar moved, and the bar is the point.
  const capped = atCap && levels <= 0;
  const toNext = xpToNextLevel(hero.toXp);

  return (
    <div
      className={`level-up-row is-shown${capped ? ' is-capped' : ''}`}
      style={{ '--plate-color': getTypeColor(definition.types[0]) } as CSSProperties}
    >
      <HeroPortrait heroId={definition.id} className="level-up-portrait" />

      <div className="level-up-body">
        <div className="level-up-ident">
          <span className="level-up-name">{definition.name}</span>
          {owed && <span className={`level-up-owed${owed === SIGNATURE_TAG ? ' is-signature' : ''}`}>{owed}</span>}
          <span className="level-up-level">
            {capped ? (
              <span className="level-up-max">Max</span>
            ) : levels <= 0 ? (
              <span className="level-up-from">Lv {hero.toLevel}</span>
            ) : (
              <>
                <span className="level-up-from">{hero.fromLevel}</span>
                <span className="level-up-arrow" aria-hidden="true">
                  →
                </span>
                <span className="level-up-to">{hero.toLevel}</span>
              </>
            )}
          </span>
        </div>

        <div className="level-up-xp" title={atCap ? `${definition.name} is at the cap` : `${toNext} XP to level ${hero.toLevel + 1}`}>
          <span className="level-up-xp-track" aria-hidden="true">
            <i className="level-up-xp-fill" style={{ width: `${xpProgress(hero.toXp) * 100}%` }} />
          </span>
          <span className="level-up-xp-next">{atCap ? 'Max' : `${toNext} to Lv ${hero.toLevel + 1}`}</span>
        </div>

        {gains && (
          <div className="level-up-gains">
            {GROWTH_STATS.map((stat, i) => (
              <StatGainCell key={stat} stat={stat} amount={hero.gained[stat] ?? 0} index={i} levels={levels} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * One growth stat's outcome, the cells run left to right. A big roll (isBigRoll) lands harder —
 * the roll has a top, and reaching it is the thing worth a louder cell.
 */
function StatGainCell({ stat, amount, index, levels }: { stat: StatKey; amount: number; index: number; levels: number }) {
  const points = amount / growthUnitFor(stat);
  const tone = amount <= 0 ? '' : isBigRoll(points, levels) ? ' is-hit is-big' : ' is-hit';
  return (
    <span
      className={`level-up-cell${tone}`}
      style={{ '--stat-color': STAT_COLORS[stat], animationDelay: `${140 + index * 45}ms` } as CSSProperties}
      title={`${STAT_LABELS[stat]} ${amount > 0 ? `+${amount}` : 'did not roll'}`}
    >
      <StatGlyph stat={stat} tone="inherit" />
      <span className="level-up-cell-amount">{amount > 0 ? `+${amount}` : '·'}</span>
    </span>
  );
}
