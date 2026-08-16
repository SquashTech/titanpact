import { useState } from 'react';
import { FightScreen } from '../view/combat/FightScreen';
import { TitleScreen } from '../view/run/TitleScreen';
import { SquadSelectScreen } from '../view/run/SquadSelectScreen';
import { MapScreen } from '../view/run/MapScreen';
import { ShopNodeScreen } from '../view/run/ShopNodeScreen';
import { NodeRewardScreen, type RewardNodeType } from '../view/run/NodeRewardScreen';
import { LevelUpScreen } from '../view/run/LevelUpScreen';
import { heroes } from '../data/heroes';
import { enemies } from '../data/enemies';
import { equipment } from '../data/equipment';
import { relics } from '../data/relics';
import { createRunState, createRosterEntry, addRosterEntry, ROSTER_CAP } from '../run/state';
import { equipItem } from '../run/equipment';
import { deriveContractOffer, claimContract, isRecruitable } from '../run/recruitment';
import { generateMap } from '../run/map';
import { generateEncounter, type EncounterNodeType, type Encounter } from '../run/enemyGen';
import { relicTeamStatModifiers } from '../run/relics';
import { advanceToNode, grantCurrencyReward, grantUpgradeReward } from '../run/runProgress';
import type { RunState, RosterEntry } from '../run/state';
import type { Squad } from '../run/squad';

type Screen =
  | { kind: 'title' }
  | { kind: 'map' }
  | { kind: 'squadSelect'; nodeId: string; nodeType: EncounterNodeType; encounter: Encounter }
  | { kind: 'fight'; nodeId: string; nodeType: EncounterNodeType; squad: Squad; encounter: Encounter; goldReward: number }
  | { kind: 'quickBattle'; player: Encounter; ai: Encounter }
  | { kind: 'shop'; nodeId: string }
  | { kind: 'reward'; nodeId: string; nodeType: RewardNodeType }
  /** Forced spend gate (CLAUDE.md "training points ... must be instantly allocated before the run continues") — `next` is whatever screen would otherwise have followed. */
  | { kind: 'levelUp'; next: Screen }
  | { kind: 'runComplete' }
  | { kind: 'runFailed' };

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

/**
 * Training Points paid out per battle win (docs/leveling-and-ranks.md
 * "tougher fights grant more"; CLAUDE.md "After winning a fight, you are
 * given training points"). 2 for a normal fight, 3-4 for elite — boss folds
 * into the elite figure since no separate boss value was specified.
 */
function trainingPointsFor(nodeType: EncounterNodeType): number {
  if (nodeType === 'fight') return 2;
  return 3 + Math.floor(Math.random() * 2); // 3-4
}

export function App() {
  const [playerRun, setPlayerRun] = useState<RunState>(createStartingRun);
  const [screen, setScreen] = useState<Screen>({ kind: 'title' });

  function handleClaimContract(defeated: RosterEntry): boolean {
    if (!isRecruitable(defeated.heroId, heroes)) return false;
    if (playerRun.roster.length >= ROSTER_CAP) return false;
    if (playerRun.recruitContracts <= 0) return false;
    const offer = deriveContractOffer(defeated);
    const rosterId = freshRosterId(playerRun, defeated.heroId);
    setPlayerRun((run) => claimContract(run, offer, rosterId));
    return true;
  }

  function handleSelectNode(nodeId: string) {
    const node = playerRun.map!.nodes[nodeId];
    if (node.type === 'fight' || node.type === 'elite' || node.type === 'boss') {
      // Generated here, at node-select time, rather than after squad
      // confirmation — the battle-preview screen (SquadSelectScreen) needs
      // the enemy squad to already exist so it can scout it before the
      // player commits a squad (playtest ask).
      //
      // Row 0 (docs/run-loop.md "Map shape" — the opening 3 plain-fight
      // nodes) draws from the non-recruitable enemy pool instead of the
      // draftable hero roster: an intentionally weak opener, not a real hero
      // spent as disposable fodder.
      const isOpeningFight = node.row === 0;
      const encounterPool = isOpeningFight ? enemies : heroes;
      // The run's 2nd `fight` node specifically (not elite/boss, which have
      // their own fixed sizing) is a deliberately lighter 2v2 breather
      // between the row-0 opener and elites kicking in.
      const isSecondFight = node.type === 'fight' && playerRun.fightsStarted === 1;
      const encounter = generateEncounter(node.type, Math.floor(Math.random() * 2 ** 31), encounterPool, isSecondFight ? 2 : undefined);
      if (node.type === 'fight') {
        setPlayerRun((run) => ({ ...run, fightsStarted: run.fightsStarted + 1 }));
      }
      setScreen({ kind: 'squadSelect', nodeId, nodeType: node.type, encounter });
    } else if (node.type === 'shop') {
      setScreen({ kind: 'shop', nodeId });
    } else {
      setScreen({ kind: 'reward', nodeId, nodeType: node.type });
    }
  }

  function handleSquadConfirmed(squad: Squad, nodeId: string, nodeType: EncounterNodeType, encounter: Encounter) {
    setScreen({ kind: 'fight', nodeId, nodeType, squad, encounter, goldReward: goldRewardFor(nodeType) });
  }

  function handleFightResolved(nodeId: string, nodeType: EncounterNodeType, goldReward: number, outcome: 'win' | 'loss') {
    if (outcome === 'loss') {
      setScreen({ kind: 'runFailed' });
      return;
    }
    let next = grantCurrencyReward(playerRun, goldReward);
    next = grantUpgradeReward(next, trainingPointsFor(nodeType));
    next = advanceToNode(next, nodeId);
    setPlayerRun(next);
    const afterScreen: Screen = nodeId === playerRun.map!.bossNodeId ? { kind: 'runComplete' } : { kind: 'map' };
    setScreen(next.levelUpPool > 0 ? { kind: 'levelUp', next: afterScreen } : afterScreen);
  }

  function handleNodeContinue(nodeId: string) {
    setPlayerRun((run) => advanceToNode(run, nodeId));
    setScreen(playerRun.levelUpPool > 0 ? { kind: 'levelUp', next: { kind: 'map' } } : { kind: 'map' });
  }

  function handleStartNewRun() {
    setPlayerRun(createStartingRun());
    setScreen({ kind: 'map' });
  }

  /**
   * Randomizes a full 4v4 (both sides drawn fresh from the fixture hero
   * pool, no rank-up bonuses) and drops straight into FightScreen — bypasses
   * the run/map/squad-select loop entirely so combat/UI changes can be
   * iterated on without playing through a run each time.
   */
  function handleQuickBattle() {
    const player = generateEncounter('fight', Math.floor(Math.random() * 2 ** 31), heroes);
    const ai = generateEncounter('fight', Math.floor(Math.random() * 2 ** 31), heroes);
    setScreen({ kind: 'quickBattle', player, ai });
  }

  return (
    <div className="app-shell">
      <header className="app-header">Titanpact</header>

      {screen.kind === 'title' && <TitleScreen onStartRun={handleStartNewRun} onQuickBattle={handleQuickBattle} />}

      {screen.kind === 'map' && <MapScreen run={playerRun} onRunChange={setPlayerRun} onSelectNode={handleSelectNode} />}

      {screen.kind === 'squadSelect' && (
        <SquadSelectScreen
          run={playerRun}
          encounter={screen.encounter}
          onConfirm={(squad) => handleSquadConfirmed(squad, screen.nodeId, screen.nodeType, screen.encounter)}
        />
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
          onResolved={(outcome) => handleFightResolved(screen.nodeId, screen.nodeType, screen.goldReward, outcome)}
        />
      )}

      {screen.kind === 'quickBattle' && (
        <FightScreen
          playerRun={screen.player.run}
          playerSquad={screen.player.squad}
          aiRun={screen.ai.run}
          aiSquad={screen.ai.squad}
          goldReward={0}
          onClaimContract={() => false}
          onResolved={() => setScreen({ kind: 'title' })}
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

      {screen.kind === 'levelUp' && (
        <LevelUpScreen run={playerRun} onRunChange={setPlayerRun} onDone={() => setScreen(screen.next)} />
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
