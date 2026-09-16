// The run's last screen before the summary (docs/titan-eyes.md §7, per user direction): the Titan's
// Eyes have closed, the Titan goes back to sleep for another thousand years, and the roster is
// presented one hero at a time — the champion's hall — before standing together as the heroes
// of the land. Tap advances a hero early; the last beat waits for the button.

import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { levelOf } from '../../run/growth';
import { rosterEntryTypes } from '../../run/progression';
import type { RunState } from '../../run/state';
import { getTypeColorRgb } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeBadge } from '../shared/TypeBadge';
import { prefersReducedMotion } from '../shared/reducedMotion';

interface Props {
  run: RunState;
  onContinue: () => void;
}

/** One hero's presentation, ms; the sleep card before the first hero holds a little longer. */
const HERO_MS = 2200;
const SLEEP_MS = 3200;

export function ChampionScreen({ run, onContinue }: Props) {
  // -1 is the sleep card; roster.length is the hall with everyone in it.
  const [index, setIndex] = useState(-1);
  const roster = run.roster;
  const done = index >= roster.length;

  useEffect(() => {
    if (done) return;
    if (prefersReducedMotion()) {
      setIndex(roster.length);
      return;
    }
    playSfx(index === -1 ? 'titan.stir' : index === 0 ? 'victory' : 'pact.bind');
    const t = window.setTimeout(() => setIndex((i) => i + 1), index === -1 ? SLEEP_MS : HERO_MS);
    return () => window.clearTimeout(t);
  }, [index, done, roster.length]);

  const entry = index >= 0 && index < roster.length ? roster[index] : null;
  const hero = entry ? rosterHeroes[entry.heroId] : null;
  const pactRgb = hero ? getTypeColorRgb(hero.types[0]) : '214, 176, 96';

  return (
    <div
      className={`champion-screen${done ? ' is-hall' : ''}${index === -1 ? ' is-sleep' : ''}`}
      style={{ '--pact-rgb': pactRgb } as CSSProperties}
      onClick={() => {
        if (!done) setIndex((i) => i + 1);
      }}
    >
      <span className="champion-veil" aria-hidden="true" />

      {index === -1 && (
        <div className="champion-sleep">
          <div className="champion-kicker">The Eyes close</div>
          <h2 className="champion-title">The Titan sleeps</h2>
          <p className="champion-line">Bound to those who put it down. A thousand years, if the seals are kept.</p>
        </div>
      )}

      {entry && hero && (
        <div className="champion-stage" key={entry.rosterId}>
          <span className="champion-ring is-outer" aria-hidden="true" />
          <span className="champion-ring is-inner" aria-hidden="true" />
          <HeroPortrait heroId={hero.id} className="champion-figure" seed={entry.rosterId} />
          <div className="champion-plate">
            <div className="champion-kicker">
              {index + 1} of {roster.length}
            </div>
            <h2 className="champion-name">{hero.name}</h2>
            <div className="champion-level">Level {levelOf(entry)}</div>
            <div className="champion-types">
              {rosterEntryTypes(hero, entry).map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
          </div>
        </div>
      )}

      {done && (
        <div className="champion-hall">
          <div className="champion-kicker">Heroes of the land</div>
          <h2 className="champion-title">Titanpact</h2>
          <div className="champion-row">
            {roster.map((r) => {
              const h = rosterHeroes[r.heroId];
              if (!h) return null;
              return (
                <div key={r.rosterId} className="champion-cell" style={{ '--pact-rgb': getTypeColorRgb(h.types[0]) } as CSSProperties}>
                  <HeroPortrait heroId={h.id} className="champion-cell-figure" seed={r.rosterId} />
                  <div className="champion-cell-name">{h.name}</div>
                </div>
              );
            })}
          </div>
          <p className="champion-line">Their names are kept where the seals are. The sixth held; the world is still here.</p>
          <button type="button" className="resolve-button champion-continue" onClick={onContinue}>
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
