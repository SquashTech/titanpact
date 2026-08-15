import { useState } from 'react';
import { FightScreen } from '../view/combat/FightScreen';
import { SquadSelectScreen } from '../view/run/SquadSelectScreen';
import { heroes } from '../data/heroes';
import { equipment } from '../data/equipment';
import { createRunState, createRosterEntry, addRosterEntry, ROSTER_CAP } from '../run/state';
import { equipItem } from '../run/equipment';
import { deriveContractOffer, claimContract } from '../run/recruitment';
import type { RunState, RosterEntry } from '../run/state';
import type { Squad } from '../run/squad';

/**
 * Starting roster for this playable slice: a small starting pair plus gold,
 * leaving the rest of the fixture roster to be recruited in-run via the
 * Guild Hall (src/view/run/GuildHallPanel.tsx) or claimed as Recruit
 * Contracts after a win (src/view/combat/FightScreen.tsx) — the two
 * acquisition paths from docs/progression.md "The raise-vs-recruit axis".
 * cinderKnight starts pre-equipped just to prove equipment reaches the fight
 * (src/run/equipment.ts) — not a balance statement.
 */
function createStartingRun(): RunState {
  let run = createRunState(0, 40);
  for (const heroId of ['cinderKnight', 'tidecaller']) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  return {
    ...run,
    roster: run.roster.map((entry) =>
      entry.rosterId === 'cinderKnight' ? { ...entry, equipment: equipItem(entry.equipment, equipment.ironBlade) } : entry
    ),
  };
}

/** Guarantees a rosterId that doesn't collide with an existing entry, even if the same heroId is claimed more than once across a run. */
function freshRosterId(run: RunState, heroId: string): string {
  if (!run.roster.some((r) => r.rosterId === heroId)) return heroId;
  let n = 2;
  while (run.roster.some((r) => r.rosterId === `${heroId}-${n}`)) n++;
  return `${heroId}-${n}`;
}

export function App() {
  const [playerRun, setPlayerRun] = useState<RunState>(createStartingRun);
  const [squad, setSquad] = useState<Squad | null>(null);

  function handleClaimContract(defeated: RosterEntry): boolean {
    if (playerRun.roster.length >= ROSTER_CAP) return false;
    const offer = deriveContractOffer(defeated);
    const rosterId = freshRosterId(playerRun, defeated.heroId);
    setPlayerRun((run) => claimContract(run, offer, rosterId));
    return true;
  }

  return (
    <div className="app-shell">
      <header className="app-header">Titanpact</header>
      {squad ? (
        <FightScreen playerRun={playerRun} playerSquad={squad} onExit={() => setSquad(null)} onClaimContract={handleClaimContract} />
      ) : (
        <SquadSelectScreen run={playerRun} onConfirm={setSquad} onRunChange={setPlayerRun} />
      )}
    </div>
  );
}
