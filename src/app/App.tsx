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
import { StatBoostScreen, type StatBoostNodeType } from '../view/run/StatBoostScreen';
import { EventNodeScreen } from '../view/run/EventNodeScreen';
import { SandboxBattleScreen } from '../view/run/SandboxBattleScreen';
import { heroes } from '../data/heroes';
import { enemies } from '../data/enemies';
import { relics } from '../data/relics';
import { equipment } from '../data/equipment';
import { equipItem, pickWeightedEquipmentBySlot, type EquipmentDefinition, type EquipmentSlot } from '../run/equipment';
import { createRunState, createRosterEntry, addRosterEntry, ROSTER_CAP, TOTAL_ACTS } from '../run/state';
import { deriveContractOffer, claimContract, isRecruitable } from '../run/recruitment';
import { guildHallOffers } from '../data/recruitment';
import { rollGuildHallOffers, buyEquipment, ShopError, type GuildHallOffers } from '../run/shop';
import { generateMap } from '../run/map';
import { generateStarterOptions } from '../run/draft';
import { generateEncounter, type EncounterNodeType, type Encounter } from '../run/enemyGen';
import { pickSquad } from '../run/squad';
import { relicTeamStatModifiers } from '../run/relics';
import { relicTeamPassiveGrants } from '../run/passives';
import { advanceToNode, advanceToNextAct, grantCurrencyReward, grantUpgradeReward, grantContractReward } from '../run/runProgress';
import { buildSandboxSide, createEmptySandboxSide, type SandboxSideConfig } from '../run/sandbox';
import { progressionTable } from '../data/progression';
import type { RunState, RosterEntry } from '../run/state';
import type { Squad } from '../run/squad';

type Screen =
  | { kind: 'title' }
  | { kind: 'draft'; optionIds: string[] }
  | { kind: 'map' }
  | { kind: 'squadSelect'; nodeId: string; nodeType: EncounterNodeType; encounter: Encounter }
  | {
      kind: 'fight';
      nodeId: string;
      nodeType: EncounterNodeType;
      squad: Squad;
      encounter: Encounter;
      goldReward: number;
      trainingPointsReward: number;
      /** The opener Goblin fight's guaranteed common-item drop (see handleFightResolved), rolled up front at squad-confirm time so the victory screen can spotlight it — same value handleFightResolved then hands to ForceEquipScreen, rather than re-rolling after the fact. */
      equipmentReward: EquipmentDefinition | null;
    }
  | { kind: 'quickBattle'; player: Encounter; ai: Encounter }
  | { kind: 'sandboxBattle' }
  /** Built from a SandboxBattleScreen config (src/run/sandbox.ts) — `playerRelics` drives Side A's team relic modifiers, same props the real 'fight' kind already uses; Sandbox Battle has no enemy-side relic support. */
  | { kind: 'sandboxFight'; player: Encounter; ai: Encounter; playerRelics: string[] }
  /** `offers` is rolled once at node-select time (run/shop.ts rollGuildHallOffers) rather than inside GuildHallPanel's own state — see shop.ts's header for why a component-local roll would reroll on every equipment purchase. */
  | { kind: 'shop'; nodeId: string; offers: GuildHallOffers }
  | { kind: 'reward'; nodeId: string; nodeType: RewardNodeType }
  | { kind: 'statBoost'; nodeId: string; nodeType: StatBoostNodeType }
  | { kind: 'event'; nodeId: string }
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
 * and grants a single Training Point, so spending it on whichever hero
 * triggers its Evolution choice immediately — skips the normal grind of
 * playing fights and leveling up 4 times per hero just to exercise the
 * Evolution UI. Remove this (and its TitleScreen button) once Evolution
 * content/UI work is done.
 */
function createLevel4TestRun(): RunState {
  const testHeroIds = Object.keys(heroes).slice(0, ROSTER_CAP);
  let run = createRunState(1, 999);
  for (const heroId of testHeroIds) {
    run = addRosterEntry(run, { ...createRosterEntry(heroId, heroId, heroes[heroId].moveIds), level: 4 });
  }
  return {
    ...run,
    map: generateMap(Math.floor(Math.random() * 2 ** 31)),
  };
}

/**
 * ⚠️ TEMPORARY DEV/TEST HELPER — not a real game entry point. Hand-assembles
 * a 2v2 that puts every condition from the docs/conditions.md overhaul
 * (Conduct, Poison, Haunt, Stealth — Burn/Bleed/Freeze/Daze/Regen/Cleanse
 * already had earlier browser-testable moves) in front of the player at
 * once, plus the Haunt+Mind interaction the type chart alone can't surface:
 * Mind is one of Haunt's `spreadTriggerTypes` (statusEngine.ts
 * expandSpreadTargets), so a `psychicLance` aimed at the enemy's
 * NON-Haunted half also strikes the Haunted one.
 *
 * Squad (2 active + 2 bench, freely switchable mid-fight — no lock-in until
 * 2+ KOs per CLAUDE.md):
 *  - Squall (Storm) carries `thunderclap` (applies Conduct) AND `ironFist`
 *    (Iron — detonates it) so the apply/detonate split is demoable solo,
 *    across two turns on the same target, without needing a second hero.
 *    Also carries `cinderBite` (Burn) as a bonus 4th move.
 *  - Cortex (Mind) carries `spectralBind` (Spirit — marks a target Haunted)
 *    AND `psychicLance`/`mindSpike` (Mind) — mark one enemy, then hit the
 *    OTHER enemy to watch the Haunted one get struck too. Also carries
 *    `frostLock` (Freeze) as a bonus 4th move.
 *  - Sylva keeps her default kit (`venomousBite` starts Poison's 3-round
 *    timer) plus `rendingClaw` (Bleed) as a bonus 4th move.
 *  - Vesper keeps her default kit (`vanish` grants 1-round Stealth; a fast
 *    Vanish redirects an incoming single-target hit onto her partner).
 *
 * AI side is two Fortify-only dummies (Crag, Warden) with HP bumped to 9999
 * via `bonusStatGrants` — a scratch punching bag, not real content, so
 * skipping the usual multiple-of-5/10 balance convention is fine here. They
 * never hit back and never faint, so a full Burn/Bleed/Poison/Freeze/
 * Conduct/Haunt rotation can be watched to completion.
 */
function createConditionsTestEncounter(): { player: Encounter; ai: Encounter } {
  let playerRun = createRunState(0, 0);
  playerRun = addRosterEntry(
    playerRun,
    createRosterEntry('conductTester', 'stormRanger', ['thunderclap', 'ironFist', 'restoreVigor', 'cinderBite'])
  );
  playerRun = addRosterEntry(
    playerRun,
    createRosterEntry('hauntMindTester', 'mindweaver', ['spectralBind', 'psychicLance', 'mindSpike', 'frostLock'])
  );
  playerRun = addRosterEntry(playerRun, createRosterEntry('poisonTester', 'wildOracle', [...heroes.wildOracle.moveIds, 'rendingClaw']));
  playerRun = addRosterEntry(playerRun, createRosterEntry('stealthTester', 'shadowMonk', heroes.shadowMonk.moveIds));
  const playerSquad = pickSquad(playerRun.roster, ['conductTester', 'hauntMindTester', 'poisonTester', 'stealthTester']);

  let aiRun = createRunState(0, 0);
  aiRun = addRosterEntry(aiRun, {
    ...createRosterEntry('conditionsDummyA', 'crag', ['fortify']),
    bonusStatGrants: { hp: 9999 - heroes.crag.baseStats.hp },
  });
  aiRun = addRosterEntry(aiRun, {
    ...createRosterEntry('conditionsDummyB', 'ironWarden', ['fortify']),
    bonusStatGrants: { hp: 9999 - heroes.ironWarden.baseStats.hp },
  });
  const aiSquad = pickSquad(aiRun.roster, ['conditionsDummyA', 'conditionsDummyB']);

  return { player: { run: playerRun, squad: playerSquad }, ai: { run: aiRun, squad: aiSquad } };
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

  /**
   * Sandbox Battle's team configs, owned here rather than inside
   * SandboxBattleScreen — App.tsx unmounts that screen while a sandbox fight
   * is in progress (swapping to the 'sandboxFight' screen kind), so
   * component-local state would be lost the instant "Start Fight" is
   * pressed. Living here lets a config survive the round trip through
   * FightScreen and back, which is the whole point of the tool.
   */
  const [sandboxSideA, setSandboxSideA] = useState<SandboxSideConfig>(() => createEmptySandboxSide());
  const [sandboxSideB, setSandboxSideB] = useState<SandboxSideConfig>(() => createEmptySandboxSide());

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
      // With 2 or fewer heroes on the roster, the whole roster is mandatory
      // and starts active — there's no bench/active split to decide, so the
      // battle-preview screen (SquadSelectScreen) would just be a forced,
      // decision-free tap. Skip straight into the fight with the full roster.
      if (playerRun.roster.length <= 2) {
        const squad = pickSquad(playerRun.roster, playerRun.roster.map((r) => r.rosterId));
        handleSquadConfirmed(squad, nodeId, encounterKind, encounter);
      } else {
        setScreen({ kind: 'squadSelect', nodeId, nodeType: encounterKind, encounter });
      }
    } else if (node.type === 'shop') {
      setScreen({ kind: 'shop', nodeId, offers: rollGuildHallOffers(playerRun, guildHallOffers, Object.values(equipment), Object.values(relics)) });
    } else if (node.type === 'weaponReward' || node.type === 'armorReward' || node.type === 'accessoryReward') {
      // Single guaranteed item of a fixed slot, no 3-choice picker — rolls
      // straight into the forced equip-or-trash gate, same as the Goblin
      // fight's guaranteed common-item drop below.
      const slot: EquipmentSlot = node.type === 'weaponReward' ? 'weapon' : node.type === 'armorReward' ? 'armor' : 'accessory';
      const item = pickWeightedEquipmentBySlot(Object.values(equipment), slot);
      setPlayerRun((run) => advanceToNode(run, nodeId));
      const afterScreen: Screen = playerRun.levelUpPool > 0 ? { kind: 'levelUp', next: { kind: 'map' } } : { kind: 'map' };
      setScreen(item ? { kind: 'forceEquip', queue: [item.id], next: afterScreen } : afterScreen);
    } else if (node.type === 'hpBoostReward' || node.type === 'manaBoostReward') {
      setScreen({ kind: 'statBoost', nodeId, nodeType: node.type });
    } else if (node.type === 'event') {
      setScreen({ kind: 'event', nodeId });
    } else {
      setScreen({ kind: 'reward', nodeId, nodeType: node.type });
    }
  }

  function handleSquadConfirmed(squad: Squad, nodeId: string, nodeType: EncounterNodeType, encounter: Encounter) {
    // The `fight` node (docs/run-loop.md "fight vs skirmish" — always row 0,
    // the act's opening Goblin fight) always grants one random piece of
    // Common gear, on top of the normal gold/training-point rewards — an
    // early, guaranteed taste of the equip loop rather than leaving it to the
    // reward-node economy's luck. Rolled here, before the fight even starts,
    // so the victory screen can spotlight the exact item that's coming —
    // handleFightResolved below reuses this same value instead of re-rolling.
    const isGoblinFight = playerRun.map!.nodes[nodeId].type === 'fight';
    const commonPool = Object.values(equipment).filter((item) => item.rarity === 'common');
    const equipmentReward = isGoblinFight ? (commonPool[Math.floor(Math.random() * commonPool.length)] ?? null) : null;
    setScreen({
      kind: 'fight',
      nodeId,
      nodeType,
      squad,
      encounter,
      goldReward: goldRewardFor(nodeType),
      trainingPointsReward: trainingPointsFor(nodeType),
      equipmentReward,
    });
  }

  function handleFightResolved(
    nodeId: string,
    nodeType: EncounterNodeType,
    goldReward: number,
    trainingPointsReward: number,
    equipmentReward: EquipmentDefinition | null,
    outcome: 'win' | 'loss'
  ) {
    if (outcome === 'loss') {
      setScreen({ kind: 'runFailed' });
      return;
    }
    const isBossNode = nodeId === playerRun.map!.bossNodeId;

    let next = grantCurrencyReward(playerRun, goldReward);
    next = grantUpgradeReward(next, trainingPointsReward);
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

    setScreen(equipmentReward ? { kind: 'forceEquip', queue: [equipmentReward.id], next: afterLevelUp } : afterLevelUp);
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

  /**
   * Guild Hall equipment purchase (ShopNodeScreen): spends gold, then hands
   * off to the same forced equip-or-trash gate every other equipment grant
   * uses. `next` is the current shop screen itself, not the map — buying
   * gear doesn't advance the map node, so the player lands back in the same
   * Guild Hall to keep shopping once the item is placed. Computes against
   * `playerRun` directly and only commits on success, same
   * validate-before-commit shape as GuildHallPanel's own recruit/contract
   * handlers, rather than throwing inside a setState updater.
   */
  function handleBuyGuildEquipment(itemId: string) {
    const item = equipment[itemId];
    if (!item) return;
    let next: RunState;
    try {
      next = buyEquipment(playerRun, item);
    } catch (err) {
      if (!(err instanceof ShopError)) throw err;
      return;
    }
    setPlayerRun(next);
    setScreen({ kind: 'forceEquip', queue: [itemId], next: screen });
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

  /** ⚠️ TEMPORARY DEV/TEST — see createConditionsTestEncounter. Reuses the 'quickBattle' screen kind since the needs (no run/map bookkeeping, drop straight into FightScreen, return to title on resolve) are identical to Quick Battle's. */
  function handleStartConditionsTest() {
    const { player, ai } = createConditionsTestEncounter();
    setScreen({ kind: 'quickBattle', player, ai });
  }

  function handleOpenSandbox() {
    setScreen({ kind: 'sandboxBattle' });
  }

  /**
   * Builds both sides via buildSandboxSide (src/run/sandbox.ts) and drops
   * straight into FightScreen. Unlike Quick Battle, onResolved below returns
   * to the Sandbox Battle screen (not title) — the whole point of this tool
   * is tweak-and-rerun without losing the configuration just tested.
   */
  function handleSandboxFight(a: SandboxSideConfig, b: SandboxSideConfig) {
    const player = buildSandboxSide(a, heroes, progressionTable);
    const ai = buildSandboxSide(b, heroes, progressionTable);
    setScreen({ kind: 'sandboxFight', player, ai, playerRelics: a.relicIds });
  }

  return (
    <div className="app-shell" ref={shellRef}>
      {screen.kind === 'title' && (
        <TitleScreen
          onStartRun={handleStartNewRun}
          onQuickBattle={handleQuickBattle}
          onOpenSandbox={handleOpenSandbox}
          onStartLevel4TestRun={handleStartLevel4TestRun}
          onStartConditionsTest={handleStartConditionsTest}
        />
      )}

      {screen.kind === 'sandboxBattle' && (
        <SandboxBattleScreen
          sideA={sandboxSideA}
          sideB={sandboxSideB}
          onChangeSideA={setSandboxSideA}
          onChangeSideB={setSandboxSideB}
          onStartFight={handleSandboxFight}
          onClose={() => setScreen({ kind: 'title' })}
        />
      )}

      {screen.kind === 'sandboxFight' && (
        <FightScreen
          playerRun={screen.player.run}
          playerSquad={screen.player.squad}
          aiRun={screen.ai.run}
          aiSquad={screen.ai.squad}
          teamStatModifiers={relicTeamStatModifiers(screen.playerRelics, relics)}
          teamPassiveGrants={relicTeamPassiveGrants(screen.playerRelics, relics)}
          goldReward={0}
          trainingPointsReward={0}
          equipmentReward={null}
          onClaimContract={() => false}
          onResolved={() => setScreen({ kind: 'sandboxBattle' })}
        />
      )}

      {screen.kind === 'draft' && <DraftScreen optionIds={screen.optionIds} onConfirm={handleDraftConfirm} />}

      {screen.kind === 'map' && <MapScreen run={playerRun} onRunChange={setPlayerRun} onSelectNode={handleSelectNode} />}

      {screen.kind === 'squadSelect' && (
        <SquadSelectScreen
          run={playerRun}
          encounter={screen.encounter}
          onRunChange={setPlayerRun}
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
          teamPassiveGrants={relicTeamPassiveGrants(playerRun.relics, relics)}
          goldReward={screen.goldReward}
          trainingPointsReward={screen.trainingPointsReward}
          equipmentReward={screen.equipmentReward}
          onClaimContract={handleClaimContract}
          onResolved={(outcome) =>
            handleFightResolved(screen.nodeId, screen.nodeType, screen.goldReward, screen.trainingPointsReward, screen.equipmentReward, outcome)
          }
        />
      )}

      {screen.kind === 'quickBattle' && (
        <FightScreen
          playerRun={screen.player.run}
          playerSquad={screen.player.squad}
          aiRun={screen.ai.run}
          aiSquad={screen.ai.squad}
          goldReward={0}
          trainingPointsReward={0}
          equipmentReward={null}
          onClaimContract={() => false}
          onResolved={() => setScreen({ kind: 'title' })}
        />
      )}

      {screen.kind === 'shop' && (
        <ShopNodeScreen
          run={playerRun}
          offers={screen.offers}
          onRunChange={setPlayerRun}
          onBuyEquipment={handleBuyGuildEquipment}
          onContinue={() => handleNodeContinue(screen.nodeId)}
        />
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

      {screen.kind === 'statBoost' && (
        <StatBoostScreen
          nodeType={screen.nodeType}
          run={playerRun}
          onRunChange={setPlayerRun}
          onContinue={() => handleNodeContinue(screen.nodeId)}
        />
      )}

      {screen.kind === 'event' && <EventNodeScreen onContinue={() => handleNodeContinue(screen.nodeId)} />}

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
