import { useMemo, useState } from 'react';
import { FightScreen } from '../view/combat/FightScreen';
import { SquadSelectScreen } from '../view/run/SquadSelectScreen';
import { heroes } from '../data/heroes';
import { equipment } from '../data/equipment';
import { createRunState, createRosterEntry, addRosterEntry } from '../run/state';
import { equipItem } from '../run/equipment';
import type { RunState } from '../run/state';
import type { Squad } from '../run/squad';

/**
 * Fixed starting roster for this playable slice. Recruitment (Recruit
 * Contracts vs. Guild Halls, the gold economy) isn't built yet (README
 * "Known gaps"), so the player's full 6-hero roster is granted up front
 * rather than acquired in-run. A couple of heroes start pre-equipped just to
 * prove equipment reaches the fight (src/run/equipment.ts) — not a balance
 * statement.
 */
function createStartingRun(): RunState {
  let run = createRunState(0);
  for (const heroId of Object.keys(heroes)) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  return {
    ...run,
    roster: run.roster.map((entry) => {
      if (entry.rosterId === 'cinderKnight') return { ...entry, equipment: equipItem(entry.equipment, equipment.ironBlade) };
      if (entry.rosterId === 'tidecaller') return { ...entry, equipment: equipItem(entry.equipment, equipment.vitalCharm) };
      return entry;
    }),
  };
}

export function App() {
  const playerRun = useMemo(createStartingRun, []);
  const [squad, setSquad] = useState<Squad | null>(null);

  return (
    <div className="app-shell">
      <header className="app-header">Titanpact</header>
      {squad ? (
        <FightScreen playerRun={playerRun} playerSquad={squad} onExit={() => setSquad(null)} />
      ) : (
        <SquadSelectScreen run={playerRun} onConfirm={setSquad} />
      )}
    </div>
  );
}
