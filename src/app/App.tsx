import { useState } from 'react';
import { FightScreen } from '../view/combat/FightScreen';
import { SquadSelectScreen } from '../view/run/SquadSelectScreen';
import { MapScreen } from '../view/run/MapScreen';
import { ShopNodeScreen } from '../view/run/ShopNodeScreen';
import { NodeRewardScreen, type RewardNodeType } from '../view/run/NodeRewardScreen';
import { heroes } from '../data/heroes';
import { equipment } from '../data/equipment';
import { relics } from '../data/relics';
import { createRunState, createRosterEntry, addRosterEntry, ROSTER_CAP } from '../run/state';
import { equipItem } from '../run/equipment';
import { deriveContractOffer, claimContract } from '../run/recruitment';
import { generateMap } from '../run/map';
import { generateEncounter, type EncounterNodeType, type Encounter } from '../run/enemyGen';
import { relicTeamStatModifiers } from '../run/relics';
import { advanceToNode, syncRosterVitals, grantCurrencyReward } from '../run/runProgress';
import type { RunState, RosterEntry } from '../run/state';
import type { Squad } from '../run/squad';
import type { CombatState } from '../engine/state';

type Screen =
  | { kind: 'map' }
  | { kind: 'squadSelect'; nodeId: string; nodeType: EncounterNodeType }
  | { kind: 'fight'; nodeId: string; nodeType: EncounterNodeType; squad: Squad; encounter: Encounter; goldReward: number }
  | { kind: 'shop'; nodeId: string }
  | { kind: 'reward'; nodeId: string; nodeType: RewardNodeType }
  | { kind: 'runComplete' }
  | { kind: 'runFailed' };

const PLAYER_SIDE = 'A';

/**
 * Starting roster for a fresh run: a small starting pair plus gold, leaving
 * the rest of the fixture roster to be recruited in-run via Guild Hall
 * (shop map nodes) or claimed as Recruit Contracts after a win. cinderKnight
 * starts pre-equipped just to prove equipment reaches the fight — not a
 * balance statement. A fresh RunMap is generated per run (docs/run-loop.md).
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
    map: generateMap(Math.floor(Math.random() * 2 ** 31)),
  };
}

/** Guarantees a rosterId that doesn't collide with an existing entry, even if the same heroId is claimed more than once across a run. */
function freshRosterId(run: RunState, heroId: string): string {
  if (!run.roster.some((r) => r.rosterId === heroId)) return heroId;
  let n = 2;
  while (run.roster.some((r) => r.rosterId === `${heroId}-${n}`)) n++;
  return `${heroId}-${n}`;
}

function goldRewardFor(nodeType: EncounterNodeType): number {
  if (nodeType === 'boss') return 0;
  if (nodeType === 'elite') return 30 + Math.floor(Math.random() * 16); // 30-45
  return 15 + Math.floor(Math.random() * 11); // 15-25
}

export function App() {
  const [playerRun, setPlayerRun] = useState<RunState>(createStartingRun);
  const [screen, setScreen] = useState<Screen>({ kind: 'map' });

  function handleClaimContract(defeated: RosterEntry): boolean {
    if (playerRun.roster.length >= ROSTER_CAP) return false;
    const offer = deriveContractOffer(defeated);
    const rosterId = freshRosterId(playerRun, defeated.heroId);
    setPlayerRun((run) => claimContract(run, offer, rosterId));
    return true;
  }

  function handleSelectNode(nodeId: string) {
    const node = playerRun.map!.nodes[nodeId];
    if (node.type === 'fight' || node.type === 'elite' || node.type === 'boss') {
      setScreen({ kind: 'squadSelect', nodeId, nodeType: node.type });
    } else if (node.type === 'shop') {
      setScreen({ kind: 'shop', nodeId });
    } else {
      setScreen({ kind: 'reward', nodeId, nodeType: node.type });
    }
  }

  function handleSquadConfirmed(squad: Squad, nodeId: string, nodeType: EncounterNodeType) {
    const encounter = generateEncounter(nodeType, Math.floor(Math.random() * 2 ** 31), heroes);
    setScreen({ kind: 'fight', nodeId, nodeType, squad, encounter, goldReward: goldRewardFor(nodeType) });
  }

  function handleFightResolved(nodeId: string, goldReward: number, outcome: 'win' | 'loss', finalState: CombatState) {
    if (outcome === 'loss') {
      setScreen({ kind: 'runFailed' });
      return;
    }
    let next = syncRosterVitals(playerRun, finalState, PLAYER_SIDE);
    next = grantCurrencyReward(next, goldReward);
    next = advanceToNode(next, nodeId);
    setPlayerRun(next);
    setScreen(nodeId === playerRun.map!.bossNodeId ? { kind: 'runComplete' } : { kind: 'map' });
  }

  function handleNodeContinue(nodeId: string) {
    setPlayerRun((run) => advanceToNode(run, nodeId));
    setScreen({ kind: 'map' });
  }

  function handleStartNewRun() {
    setPlayerRun(createStartingRun());
    setScreen({ kind: 'map' });
  }

  return (
    <div className="app-shell">
      <header className="app-header">Titanpact</header>

      {screen.kind === 'map' && <MapScreen run={playerRun} onRunChange={setPlayerRun} onSelectNode={handleSelectNode} />}

      {screen.kind === 'squadSelect' && (
        <SquadSelectScreen run={playerRun} onConfirm={(squad) => handleSquadConfirmed(squad, screen.nodeId, screen.nodeType)} />
      )}

      {screen.kind === 'fight' && (
        <FightScreen
          playerRun={playerRun}
          playerSquad={screen.squad}
          aiRun={screen.encounter.run}
          aiSquad={screen.encounter.squad}
          teamStatModifiers={relicTeamStatModifiers(playerRun.relics, relics)}
          goldReward={screen.goldReward}
          onClaimContract={handleClaimContract}
          onResolved={(outcome, finalState) => handleFightResolved(screen.nodeId, screen.goldReward, outcome, finalState)}
        />
      )}

      {screen.kind === 'shop' && (
        <ShopNodeScreen run={playerRun} onRunChange={setPlayerRun} onContinue={() => handleNodeContinue(screen.nodeId)} />
      )}

      {screen.kind === 'reward' && (
        <NodeRewardScreen
          nodeType={screen.nodeType}
          run={playerRun}
          onRunChange={setPlayerRun}
          onContinue={() => handleNodeContinue(screen.nodeId)}
        />
      )}

      {screen.kind === 'runComplete' && (
        <div className="result-overlay">
          <h2>Run Complete!</h2>
          <p className="hint">You defeated the Ancient. The map is cleared.</p>
          <div className="result-buttons">
            <button onClick={handleStartNewRun}>Start New Run</button>
          </div>
        </div>
      )}

      {screen.kind === 'runFailed' && (
        <div className="result-overlay">
          <h2>Run Failed</h2>
          <p className="hint">Your squad was defeated.</p>
          <div className="result-buttons">
            <button onClick={handleStartNewRun}>Start New Run</button>
          </div>
        </div>
      )}
    </div>
  );
}
