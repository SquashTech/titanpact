import { useEffect, useRef, useState } from 'react';
import { initUiScale } from './uiScale';
import { FightScreen } from '../view/combat/FightScreen';
import { TitleScreen } from '../view/run/TitleScreen';
import { DraftScreen } from '../view/run/DraftScreen';
import { SquadSelectScreen } from '../view/run/SquadSelectScreen';
import { MapScreen } from '../view/run/MapScreen';
import { ShopNodeScreen } from '../view/run/ShopNodeScreen';
import { NodeRewardScreen, type RewardNodeType } from '../view/run/NodeRewardScreen';
import { LevelUpScreen } from '../view/run/LevelUpScreen';
import { ForceEquipScreen } from '../view/run/ForceEquipScreen';
import { heroes } from '../data/heroes';
import { enemies } from '../data/enemies';
import { relics } from '../data/relics';
import { equipment } from '../data/equipment';
import { equipItem } from '../run/equipment';
import { createRunState, createRosterEntry, addRosterEntry, ROSTER_CAP, TOTAL_ACTS } from '../run/state';
import { deriveContractOffer, claimContract, isRecruitable } from '../run/recruitment';
import { generateMap } from '../run/map';
import { generateStarterOptions } from '../run/draft';
import { generateEncounter, type EncounterNodeType, type Encounter } from '../run/enemyGen';
import { relicTeamStatModifiers } from '../run/relics';
import { advanceToNode, advanceToNextAct, grantCurrencyReward, grantUpgradeReward, grantContractReward } from '../run/runProgress';
import type { RunState, RosterEntry } from '../run/state';
import type { Squad } from '../run/squad';

type Screen =
  | { kind: 'title' }
  | { kind: 'draft'; optionIds: string[] }
  | { kind: 'map' }
  | { kind: 'squadSelect'; nodeId: string; nodeType: EncounterNodeType; encounter: Encounter }
  | { kind: 'fight'; nodeId: string; nodeType: EncounterNodeType; squad: Squad; encounter: Encounter; goldReward: number }
  | { kind: 'quickBattle'; player: Encounter; ai: Encounter }
  | { kind: 'shop'; nodeId: string }
  | { kind: 'reward'; nodeId: string; nodeType: RewardNodeType }
  /** Forced spend gate (CLAUDE.md "training points ... must be instantly allocated before the run continues") — `next` is whatever screen would otherwise have followed. */
  | { kind: 'levelUp'; next: Screen }
  /** Forced equip-or-trash gate (user direction: no unequipped stash — every piece of gear obtained must be resolved before the run continues) — `queue` is the item(s) awaiting a decision, `next` is whatever screen would otherwise have followed. */
  | { kind: 'forceEquip'; queue: string[]; next: Screen }
  | { kind: 'runComplete' }
  | { kind: 'runFailed' };

/**
 * Starting roster for a fresh run: the player's two drafted heroes
 * (DraftScreen — pick 2 of 4 random candidates, CLAUDE.md "every hero must
 * be viable" so runs shouldn't always open with the same pair) plus gold,
 * leaving the rest of the fixture roster to be recruited in-run via Guild
 * Hall (shop map nodes) or claimed as Recruit Contracts after a win. A fresh
 * RunMap is generated per run (docs/run-loop.md).
 */
function createStartingRun(heroIds: readonly string[]): RunState {
  let run = createRunState(0, 40);
  for (const heroId of heroIds) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  return {
    ...run,
    map: generateMap(Math.floor(Math.random() * 2 ** 31)),
  };
}

/**
 * ⚠️ TEMPORARY DEV/TEST HELPER — not a real game entry point. Fills the
 * roster (up to ROSTER_CAP) with heroes already at level EVOLUTION_LEVEL - 1
 * and grants one Training Point per hero, so the very first spend on each
 * hero triggers its Evolution choice immediately — skips the normal grind of
 * playing fights and leveling up 4 times per hero just to exercise the
 * Evolution UI. Remove this (and its TitleScreen button) once Evolution
 * content/UI work is done.
 */
function createLevel4TestRun(): RunState {
  const testHeroIds = Object.keys(heroes).slice(0, ROSTER_CAP);
  let run = createRunState(testHeroIds.length, 999);
  for (const heroId of testHeroIds) {
    run = addRosterEntry(run, { ...createRosterEntry(heroId, heroId, heroes[heroId].moveIds), level: 4 });
  }
  return {
    ...run,
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

/**
 * ⚠️ TEST FIXTURE — equips a Dagger (+5 Attack) onto the Goblin Skulker in
 * the run's very first battle only, so the equip-slot inspect UI (tap a
 * filled box to read what it does) has a real item to show from turn one,
 * without waiting on the equipment-reward economy. Remove once early map
 * rows can arm encounters for real.
 */
function equipTestDagger(encounter: Encounter): Encounter {
  const roster = encounter.run.roster.map((entry) =>
    entry.heroId === 'goblinSkulker' ? { ...entry, equipment: equipItem(entry.equipment, equipment.dagger) } : entry
  );
  return { ...encounter, run: { ...encounter.run, roster } };
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
  const [playerRun, setPlayerRun] = useState<RunState>(() => createRunState(0, 40));
  const [screen, setScreen] = useState<Screen>({ kind: 'title' });
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shellRef.current) return initUiScale(shellRef.current);
  }, []);

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
    if (
      node.type === 'fight' ||
      node.type === 'skirmish' ||
      node.type === 'battle' ||
      node.type === 'elite' ||
      node.type === 'boss'
    ) {
      // Generated here, at node-select time, rather than after squad
      // confirmation — the battle-preview screen (SquadSelectScreen) needs
      // the enemy squad to already exist so it can scout it before the
      // player commits a squad (playtest ask).
      //
      // `fight` (docs/run-loop.md "fight vs skirmish vs battle") draws from
      // the non-recruitable enemy pool instead of the draftable hero roster:
      // an intentionally weak opener, not a real hero spent as disposable
      // fodder. `skirmish`/`battle`/`elite`/`boss` all draw from the
      // recruitable pool.
      const isMobFight = node.type === 'fight';
      const encounterPool = isMobFight ? enemies : heroes;
      // `skirmish` and `battle` map nodes ARE plain `fight` encounters
      // mechanically (same heroCount, no stat bonus) — only the pool and the
      // map-facing name differ, so both collapse to 'fight' for
      // generateEncounter/FightScreen, which only need the mechanical shape.
      const encounterKind: EncounterNodeType = node.type === 'skirmish' || node.type === 'battle' ? 'fight' : node.type;
      // The run's 2nd plain-encounter node specifically (not elite/boss,
      // which have their own fixed sizing) is a deliberately lighter 2v2
      // breather between the opener and elites kicking in.
      const isSecondFight = encounterKind === 'fight' && playerRun.fightsStarted === 1;
      let encounter = generateEncounter(encounterKind, Math.floor(Math.random() * 2 ** 31), encounterPool, isSecondFight ? 2 : undefined);
      const isFirstFight = encounterKind === 'fight' && playerRun.fightsStarted === 0;
      if (isMobFight && isFirstFight) {
        encounter = equipTestDagger(encounter);
      }
      if (encounterKind === 'fight') {
        setPlayerRun((run) => ({ ...run, fightsStarted: run.fightsStarted + 1 }));
      }
      setScreen({ kind: 'squadSelect', nodeId, nodeType: encounterKind, encounter });
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
    // The `fight` node (docs/run-loop.md "fight vs skirmish" — always row 0,
    // the act's opening Goblin fight) always grants one random piece of
    // Common gear, on top of the normal gold/training-point rewards — an
    // early, guaranteed taste of the equip loop rather than leaving it to the
    // reward-node economy's luck.
    const isGoblinFight = playerRun.map!.nodes[nodeId].type === 'fight';
    const isBossNode = nodeId === playerRun.map!.bossNodeId;

    let next = grantCurrencyReward(playerRun, goldReward);
    next = grantUpgradeReward(next, trainingPointsFor(nodeType));
    next = advanceToNode(next, nodeId);

    // End of act (docs/run-loop.md "Multi-act sequencing"): a Recruit
    // Contract per act, replacing the old contractReward map node, then
    // either chain into the next act's fresh map or, past the last act, end
    // the run.
    let afterScreen: Screen;
    if (isBossNode) {
      next = grantContractReward(next, 1);
      if (next.actNumber < TOTAL_ACTS) {
        next = advanceToNextAct(next, Math.floor(Math.random() * 2 ** 31));
        afterScreen = { kind: 'map' };
      } else {
        afterScreen = { kind: 'runComplete' };
      }
    } else {
      afterScreen = { kind: 'map' };
    }

    setPlayerRun(next);
    const afterLevelUp: Screen = next.levelUpPool > 0 ? { kind: 'levelUp', next: afterScreen } : afterScreen;

    if (isGoblinFight) {
      const commonPool = Object.values(equipment).filter((item) => item.rarity === 'common');
      const itemId = commonPool[Math.floor(Math.random() * commonPool.length)]?.id;
      setScreen(itemId ? { kind: 'forceEquip', queue: [itemId], next: afterLevelUp } : afterLevelUp);
    } else {
      setScreen(afterLevelUp);
    }
  }

  function handleNodeContinue(nodeId: string) {
    setPlayerRun((run) => advanceToNode(run, nodeId));
    setScreen(playerRun.levelUpPool > 0 ? { kind: 'levelUp', next: { kind: 'map' } } : { kind: 'map' });
  }

  /**
   * equipmentReward node resolution: claiming an item immediately hands off
   * to the forced equip-or-trash gate (ForceEquipScreen) instead of stashing
   * it — mirrors handleFightResolved's Goblin-fight drop, but also advances
   * the map node first since NodeRewardScreen no longer has its own Continue
   * button for this node type.
   */
  function handleClaimEquipment(nodeId: string, itemId: string) {
    setPlayerRun((run) => advanceToNode(run, nodeId));
    const afterScreen: Screen = playerRun.levelUpPool > 0 ? { kind: 'levelUp', next: { kind: 'map' } } : { kind: 'map' };
    setScreen({ kind: 'forceEquip', queue: [itemId], next: afterScreen });
  }

  /** "Start a Run" from the title screen opens the draft (DraftScreen) rather than building the run directly — the starting pair isn't chosen yet. */
  function handleStartNewRun() {
    const starterHeroIds = Object.values(heroes)
      .filter((hero) => hero.starter)
      .map((hero) => hero.id);
    const optionIds = generateStarterOptions(Math.floor(Math.random() * 2 ** 31), starterHeroIds);
    setScreen({ kind: 'draft', optionIds });
  }

  function handleDraftConfirm(chosenIds: string[]) {
    setPlayerRun(createStartingRun(chosenIds));
    setScreen({ kind: 'map' });
  }

  /** ⚠️ TEMPORARY DEV/TEST — see createLevel4TestRun. Drops straight into the level-up/Evolution screen instead of the draft, since that's the whole point of this shortcut. */
  function handleStartLevel4TestRun() {
    setPlayerRun(createLevel4TestRun());
    setScreen({ kind: 'levelUp', next: { kind: 'map' } });
  }

  /**
   * Randomizes a full 4v4 (both sides drawn fresh from the fixture hero
   * pool, no Evolution bonuses) and drops straight into FightScreen — bypasses
   * the run/map/squad-select loop entirely so combat/UI changes can be
   * iterated on without playing through a run each time.
   */
  function handleQuickBattle() {
    const player = generateEncounter('fight', Math.floor(Math.random() * 2 ** 31), heroes);
    const ai = generateEncounter('fight', Math.floor(Math.random() * 2 ** 31), heroes);
    setScreen({ kind: 'quickBattle', player, ai });
  }

  return (
    <div className="app-shell" ref={shellRef}>
      {screen.kind === 'title' && (
        <TitleScreen onStartRun={handleStartNewRun} onQuickBattle={handleQuickBattle} onStartLevel4TestRun={handleStartLevel4TestRun} />
      )}

      {screen.kind === 'draft' && <DraftScreen optionIds={screen.optionIds} onConfirm={handleDraftConfirm} />}

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
          onClaimEquipment={(itemId) => handleClaimEquipment(screen.nodeId, itemId)}
        />
      )}

      {screen.kind === 'levelUp' && (
        <LevelUpScreen run={playerRun} onRunChange={setPlayerRun} onDone={() => setScreen(screen.next)} />
      )}

      {screen.kind === 'forceEquip' && (
        <ForceEquipScreen run={playerRun} queue={screen.queue} onRunChange={setPlayerRun} onDone={() => setScreen(screen.next)} />
      )}

      {screen.kind === 'runComplete' && (
        <div className="result-overlay">
          <h2>Run Complete!</h2>
          <p className="hint">You defeated the Ancient {TOTAL_ACTS} times. All acts are cleared.</p>
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
