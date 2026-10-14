import type { CSSProperties } from 'react';
import { rosterHeroes } from '../../data/content';
import { locations } from '../../data/locations';
import { companionHeroId } from '../../run/companion';
import { cycleOf } from '../../run/cycles';
import { levelOf } from '../../run/growth';
import { formatPlaytime, type Profile } from '../../run/profile';
import { formIdFor, rosterEntryTypes } from '../../run/progression';
import { SEAL_ACTS, type RosterEntry, type RunState } from '../../run/state';
import { getTypeColorRgb } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeBadge } from '../shared/TypeBadge';
import { evolutionName } from './evolutionName';
import type { VictoryStars } from './victoryStars';

interface Props {
  run: RunState;
  profileAfter: Profile;
  stars: VictoryStars;
  onInspect: (entry: RosterEntry) => void;
}

const DATE = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** A cleared run as one framed picture to keep: the Cycle beaten, the team, where it went, what it paid. */
export function VictoryCard({ run, profileAfter, stars, onInspect }: Props) {
  const cycle = cycleOf(run.cycle);
  const record = profileAfter.runHistory[0];
  const route = run.locationIds.slice(0, SEAL_ACTS).map((id) => locations[id]?.name).filter(Boolean);
  const companionId = companionHeroId(run);
  const earned = stars.balanceAfter - stars.balanceBefore;
  const facts = [record?.durationMs != null ? formatPlaytime(record.durationMs) : null, record ? DATE.format(record.endedAt) : null].filter(Boolean);

  return (
    <div className={`vcard star-cycle-${run.cycle}`}>
      <span className="vcard-rays" aria-hidden="true" />
      <div className="vcard-mark">TITANPACT</div>

      <div className="vcard-cycle">
        <span className="vcard-cycle-numeral">{cycle.numeral}</span>
        <span className="vcard-cycle-words">
          <span className="vcard-cycle-cleared">Cycle {cycle.numeral} Cleared</span>
          <span className="vcard-cycle-name">{cycle.name}</span>
        </span>
      </div>

      <h2 className="vcard-title">The Titan is Sealed</h2>
      <div className="vcard-rule" aria-hidden="true">
        <span />◆<span />
      </div>

      <div className="vcard-team">
        {run.roster.map((entry) => {
          const h = rosterHeroes[entry.heroId];
          if (!h) return null;
          const earnedHere = stars.byRosterId[entry.rosterId];
          const star = earnedHere ? Math.max(...earnedHere.map((s) => s.cycle)) : 0;
          const form = evolutionName(entry);
          return (
            <button
              type="button"
              key={entry.rosterId}
              className="vcard-hero"
              style={{ '--pact-rgb': getTypeColorRgb(h.types[0]) } as CSSProperties}
              onClick={() => onInspect(entry)}
              aria-label={`${h.name}, level ${levelOf(entry)} — view sheet`}
            >
              <span className="vcard-hero-light" aria-hidden="true" />
              <HeroPortrait heroId={h.id} pathId={formIdFor(entry)} className="vcard-hero-figure" seed={entry.rosterId} />
              {star > 0 && <span className={`vcard-hero-star evo-star is-earned star-cycle-${star}`}>★</span>}
              <span className="vcard-hero-name">{h.name}</span>
              {form && <span className="vcard-hero-form">{form}</span>}
              <span className="vcard-hero-types">
                {rosterEntryTypes(h, entry).map((t) => (
                  <TypeBadge key={t} type={t} />
                ))}
              </span>
              <span className="vcard-hero-level">Lv {levelOf(entry)}</span>
            </button>
          );
        })}
      </div>

      {route.length > 0 && (
        <div className="vcard-route">
          {route.map((name, i) => (
            <span key={i} className="vcard-route-stop">
              {name}
            </span>
          ))}
        </div>
      )}

      <div className="vcard-foot">
        {companionId && run.companion && (
          <span className="vcard-companion" style={{ '--pact-rgb': getTypeColorRgb(run.companion.type) } as CSSProperties}>
            <HeroPortrait heroId={companionId} className="vcard-companion-figure" />
          </span>
        )}
        {earned > 0 && (
          <span className="vcard-stars">
            <span className="vcard-stars-glyph">★</span>+{earned}
          </span>
        )}
        <span className="vcard-facts">{facts.join(' · ')}</span>
      </div>
    </div>
  );
}
