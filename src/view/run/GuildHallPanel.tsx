import { heroes } from '../../data/heroes';
import { guildHallOffers, CONTRACT_PURCHASE_COST } from '../../data/recruitment';
import type { RunState } from '../../run/state';
import { ROSTER_CAP } from '../../run/state';
import { recruitFromGuildHall, buyContract, RecruitmentError } from '../../run/recruitment';

interface Props {
  run: RunState;
  onRecruit: (next: RunState) => void;
}

/**
 * Guild Hall (raise) recruitment (docs/progression.md "The raise-vs-recruit
 * axis"): spend gold to add a fresh, 0-progress hero to the roster.
 * Recruit Contracts (recruit) aren't offered here — they're claimed off a
 * beaten enemy at fight's end (FightScreen), not bought up front.
 */
export function GuildHallPanel({ run, onRecruit }: Props) {
  const rosterHeroIds = new Set(run.roster.map((r) => r.heroId));
  const available = guildHallOffers.filter((o) => !rosterHeroIds.has(o.heroId));
  const rosterFull = run.roster.length >= ROSTER_CAP;

  if (available.length === 0) return null;

  function handleRecruit(offer: (typeof guildHallOffers)[number]) {
    try {
      onRecruit(recruitFromGuildHall(run, offer, offer.heroId));
    } catch (err) {
      if (!(err instanceof RecruitmentError)) throw err;
    }
  }

  function handleBuyContract() {
    try {
      onRecruit(buyContract(run, CONTRACT_PURCHASE_COST));
    } catch (err) {
      if (!(err instanceof RecruitmentError)) throw err;
    }
  }

  return (
    <div className="guild-hall">
      <h2>Guild Hall — {run.gold}g</h2>
      <div className="guild-hall-grid">
        {available.map((offer) => {
          const hero = heroes[offer.heroId];
          const affordable = run.gold >= offer.cost && !rosterFull;
          return (
            <button
              key={offer.id}
              className="roster-card guild-hall-card"
              disabled={!affordable}
              onClick={() => handleRecruit(offer)}
            >
              <div className="roster-card-name">{hero.name}</div>
              <div className="roster-card-types">{hero.types.join('/')}</div>
              <div className="guild-hall-cost">{offer.cost}g</div>
            </button>
          );
        })}
      </div>
      {rosterFull && <p className="hint">Roster is full ({ROSTER_CAP}/{ROSTER_CAP}) — terminate a hero to recruit another.</p>}

      <button className="roster-card guild-hall-card" disabled={run.gold < CONTRACT_PURCHASE_COST} onClick={handleBuyContract}>
        <div className="roster-card-name">📜 Recruit Contract</div>
        <div className="guild-hall-cost">{CONTRACT_PURCHASE_COST}g</div>
      </button>
    </div>
  );
}
