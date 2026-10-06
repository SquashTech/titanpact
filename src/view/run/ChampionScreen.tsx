// The run's last screen before the summary (docs/titan-eyes.md §7, per user direction): the Titan's
// Eyes have closed and the Titan is bound (TitanBoundScreen says so), and the roster is
// presented one hero at a time — the champion's hall — before standing together as the heroes
// of the land. Tap advances a hero early; the last beat waits for the button.

import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { levelOf } from '../../run/growth';
import { rosterEntryTypes, formIdFor } from '../../run/progression';
import { cycleOf } from '../../run/cycles';
import type { RunState } from '../../run/state';
import { getTypeColorRgb } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeBadge } from '../shared/TypeBadge';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { evolutionName } from './evolutionName';

interface Props {
  run: RunState;
  onContinue: () => void;
}

/** One hero's presentation, ms. */
const HERO_MS = 2600;

const GOLD_RGB = '224, 166, 60';

/** Motes rising through the light, placed by a fixed spread so every beat draws the same air. */
function ChampionMotes({ count }: { count: number }) {
  return (
    <span className="champion-motes" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const across = (i * 61.8) % 100;
        const lag = (i * 0.37) % 3.2;
        return (
          <span
            key={i}
            className="champion-mote"
            style={{ left: `${across}%`, animationDelay: `${lag}s`, animationDuration: `${3.2 + ((i * 17) % 10) / 5}s`, '--size': `${2 + (i % 3)}px` } as CSSProperties}
          />
        );
      })}
    </span>
  );
}

export function ChampionScreen({ run, onContinue }: Props) {
  // roster.length is the hall with everyone in it.
  const [index, setIndex] = useState(0);
  const roster = run.roster;
  const done = index >= roster.length;

  useEffect(() => {
    if (done) {
      playSfx('victory');
      return;
    }
    if (prefersReducedMotion()) {
      setIndex(roster.length);
      return;
    }
    playSfx('pact.bind');
    const t = window.setTimeout(() => setIndex((i) => i + 1), HERO_MS);
    return () => window.clearTimeout(t);
  }, [index, done, roster.length]);

  const entry = index >= 0 && index < roster.length ? roster[index] : null;
  const hero = entry ? rosterHeroes[entry.heroId] : null;
  const pactRgb = hero ? getTypeColorRgb(hero.types[0]) : GOLD_RGB;
  const form = entry ? evolutionName(entry) : null;

  return (
    <div
      className={`champion-screen${done ? ' is-hall' : ''}`}
      style={{ '--pact-rgb': pactRgb } as CSSProperties}
      onClick={() => {
        if (!done) setIndex((i) => i + 1);
      }}
    >
      <span className="champion-veil" aria-hidden="true" />
      <span className="champion-rays" aria-hidden="true" />
      <ChampionMotes count={done ? 26 : 16} />

      {entry && hero && (
        <div className="champion-beat" key={entry.rosterId}>
          <div className="champion-stage">
            <span className="champion-halo" aria-hidden="true" />
            <span className="champion-shock" aria-hidden="true" />
            <span className="champion-floor" aria-hidden="true" />
            <HeroPortrait heroId={hero.id} pathId={formIdFor(entry)} className="champion-figure" seed={entry.rosterId} />
            <span className="champion-flash" aria-hidden="true" />
          </div>

          <div className="champion-plate">
            <div className="champion-kicker">Champion</div>
            <h2 className="champion-name">{hero.name}</h2>
            <div className="champion-rule" aria-hidden="true">
              <span />◆<span />
            </div>
            <div className="champion-facts">
              {form && <span className="champion-form">{form}</span>}
              <span className="champion-level">Level {levelOf(entry)}</span>
            </div>
            <div className="champion-types">
              {rosterEntryTypes(hero, entry).map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
          </div>
        </div>
      )}

      {!done && (
        <div className="champion-progress" aria-label={`Champion ${index + 1} of ${roster.length}`}>
          {roster.map((r, i) => (
            <span key={r.rosterId} className={`champion-pip${i < index ? ' is-past' : i === index ? ' is-here' : ''}`} />
          ))}
        </div>
      )}

      {done && (
        <div className="champion-hall">
          <div className="champion-hall-head">
            <div className="champion-kicker">Cycle {cycleOf(run.cycle).numeral} · The Titan is bound</div>
            <h2 className="champion-title">Heroes of the Land</h2>
            <div className="champion-rule" aria-hidden="true">
              <span />◆<span />
            </div>
          </div>
          <div className="champion-row">
            {roster.map((r, i) => {
              const h = rosterHeroes[r.heroId];
              if (!h) return null;
              return (
                <div
                  key={r.rosterId}
                  className="champion-cell"
                  style={{ '--pact-rgb': getTypeColorRgb(h.types[0]), '--enter': `${0.25 + i * 0.12}s` } as CSSProperties}
                >
                  <span className="champion-cell-floor" aria-hidden="true" />
                  <HeroPortrait heroId={h.id} pathId={formIdFor(r)} className="champion-cell-figure" seed={r.rosterId} />
                  <div className="champion-cell-name">{h.name}</div>
                  <div className="champion-cell-level">Lv {levelOf(r)}</div>
                </div>
              );
            })}
          </div>
          <p className="champion-line">Their names are kept where the seals are. The last two held; the world is still here.</p>
          <button type="button" className="resolve-button champion-continue" onClick={onContinue}>
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
