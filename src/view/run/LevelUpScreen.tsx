import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { heroes } from '../../data/heroes';
import type { StatKey } from '../../engine/content';
import { GROWTH_STATS, MAX_LEVEL, type HeroLevelUp } from '../../run/growth';
import type { RunState } from '../../run/state';
import { getTypeColor } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { NodeHeader, NodeSky, NODE_TINT_VITAL } from '../shared/NodeStage';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { STAT_COLORS, STAT_LABELS, StatGlyph } from '../shared/StatBars';
import { RosterPeek } from './RosterPeek';

interface Props {
  run: RunState;
  /** One entry per roster hero, in roster order — including any that were already at the cap. */
  report: readonly HeroLevelUp[];
  onContinue: () => void;
}

/** Beat boundaries, in ms from the screen landing. Six rows finish inside ~1.5s. */
const ROW_LEAD_MS = 160;
const ROW_STAGGER_MS = 230;

/**
 * What a won encounter did to the roster (docs/growth-overhaul.md §3). Levels are automatic,
 * roster-wide and unallocatable, which removed the screen that used to report them — so the
 * player could see a number climb on the hero sheet and never see the moment it climbed.
 *
 * The whole roster is listed, benched heroes included, because that IS the rule and one fielded
 * hero levelling would read as participation XP. Every stat gets a cell whether or not it rolled:
 * the misses are what make the hits read as a ROLL against a grade rather than an authored grant,
 * and a row of constant width is what lets six of them be scanned at a glance.
 */
export function LevelUpScreen({ run, report, onContinue }: Props) {
  const [revealed, setRevealed] = useState(() => (prefersReducedMotion() ? report.length : 0));

  useEffect(() => {
    if (prefersReducedMotion()) return;
    playSfx('levelUp');
    const timers = report.map((_, i) =>
      window.setTimeout(() => {
        setRevealed((n) => Math.max(n, i + 1));
        // A ladder up the roster. The fanfare plays once, over the top of all of them — six
        // fanfares in a row is the reason this pip exists.
        playSfx('xp.orb', { pitch: 1 + i * 0.07 });
      }, ROW_LEAD_MS + i * ROW_STAGGER_MS)
    );
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Read off the heroes that actually MOVED. Levels are roster-wide, so this is the roster's own
  // level — but one hero already parked at the cap must not be allowed to name the beat.
  const reached = report.reduce((best, hero) => (hero.toLevel > hero.fromLevel ? Math.max(best, hero.toLevel) : best), 0);

  return (
    <div className="node-screen level-up-screen" style={{ '--node-rgb': NODE_TINT_VITAL } as CSSProperties}>
      <NodeSky />
      <RosterPeek run={run} />

      <NodeHeader
        compact
        eyebrow="The Pact Hardens"
        title={reached > 0 ? `Level ${reached}` : `Level ${MAX_LEVEL}`}
        readout="Everyone gains, fielded or benched. Each stat rolls on its own growth grade."
      />

      {/* Tap the list to land every row at once: this plays after every won fight, so waiting
          out the stagger must never be the only way through it. */}
      <div className="screen-scroll" onClick={() => setRevealed(report.length)}>
        <div className="level-up-list">
          {report.map((hero, i) => (
            <LevelUpRow key={hero.rosterId} hero={hero} index={i} shown={i < revealed} />
          ))}
        </div>
      </div>

      <button className="resolve-button" onClick={onContinue}>
        Continue
      </button>
    </div>
  );
}

interface RowProps {
  hero: HeroLevelUp;
  index: number;
  shown: boolean;
}

function LevelUpRow({ hero, shown }: RowProps) {
  const definition = heroes[hero.heroId];
  if (!definition) return null;
  const levels = hero.toLevel - hero.fromLevel;
  const capped = levels <= 0;

  return (
    <div
      className={`level-up-row${shown ? ' is-shown' : ''}${capped ? ' is-capped' : ''}`}
      style={{ borderLeftColor: getTypeColor(definition.types[0]) }}
    >
      <HeroPortrait heroId={definition.id} className="level-up-portrait" />

      <div className="level-up-body">
        <div className="level-up-ident">
          <span className="level-up-name">{definition.name}</span>
          <span className="level-up-level">
            {capped ? (
              <span className="level-up-max">Max</span>
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

        <div className="level-up-gains">
          {GROWTH_STATS.map((stat, i) => (
            <StatGainCell key={stat} stat={stat} amount={hero.gained[stat] ?? 0} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * One growth stat's outcome. The delay runs the cells left to right under the tail of the row's
 * own 320ms land, so a row reads as one gesture rather than as seven things arriving at once.
 */
function StatGainCell({ stat, amount, index }: { stat: StatKey; amount: number; index: number }) {
  return (
    <span
      className={`level-up-cell${amount > 0 ? ' is-hit' : ''}`}
      style={{ '--stat-color': STAT_COLORS[stat], animationDelay: `${140 + index * 45}ms` } as CSSProperties}
      title={`${STAT_LABELS[stat]} ${amount > 0 ? `+${amount}` : 'did not roll'}`}
    >
      <StatGlyph stat={stat} tone="inherit" />
      <span className="level-up-cell-amount">{amount > 0 ? `+${amount}` : '·'}</span>
    </span>
  );
}
