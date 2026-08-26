import { useEffect, useRef, useState } from 'react';
import { initUiScale } from './uiScale';
import { ViewportProbe } from '../view/dev/ViewportProbe';
import { FightScreen } from '../view/combat/FightScreen';
import { TitleScreen } from '../view/run/TitleScreen';
import { DraftScreen } from '../view/run/DraftScreen';
import { SquadSelectScreen } from '../view/run/SquadSelectScreen';
import { MapScreen } from '../view/run/MapScreen';
import { ShopNodeScreen } from '../view/run/ShopNodeScreen';
import { NodeRewardScreen, type RewardNodeType } from '../view/run/NodeRewardScreen';
import { LevelUpScreen } from '../view/run/LevelUpScreen';
import { ForceEquipScreen } from '../view/run/ForceEquipScreen';
import { RosterReplaceScreen } from '../view/run/RosterReplaceScreen';
import { StatBoostScreen, type StatBoostNodeType } from '../view/run/StatBoostScreen';
import { ClassNodeScreen } from '../view/run/ClassNodeScreen';
import { EventNodeScreen } from '../view/run/EventNodeScreen';
import { SandboxBattleScreen } from '../view/run/SandboxBattleScreen';
import { heroes } from '../data/heroes';
import { enemies, basicGoblins, BASIC_GOBLIN_IDS, GOBLIN_CHIEF_ID } from '../data/enemies';
import { relics } from '../data/relics';
import { equipment } from '../data/equipment';
import {
  equipItem,
  pickWeightedEquipment,
  pickWeightedEquipmentBySlot,
  ELITE_RARITY_DROP_WEIGHTS,
  type EquipmentDefinition,
  type EquipmentSlot,
} from '../run/equipment';
import { createRunState, createRosterEntry, addRosterEntry, ROSTER_CAP, TOTAL_ACTS } from '../run/state';
import {
  deriveContractOffer,
  claimContract,
  claimContractReplacing,
  recruitFromGuildHallReplacing,
  freshRosterId,
  isRecruitable,
  RecruitmentError,
  type GuildHallOffer,
  type RosterReplaceCandidate,
} from '../run/recruitment';
import { guildHallOffers } from '../data/recruitment';
import { rollGuildHallOffers, buyEquipment, ShopError, type GuildHallOffers } from '../run/shop';
import { generateMap, type MapNodeType } from '../run/map';
import { generateStarterOptions } from '../run/draft';
import { generateEncounter, generateGoblinChiefEncounter, type EncounterNodeType, type Encounter } from '../run/enemyGen';
import { pickSquad } from '../run/squad';
import { advanceToNode, advanceToNextAct, grantCurrencyReward, grantUpgradeReward, grantContractReward } from '../run/runProgress';
import { buildSandboxSide, createEmptySandboxSide, type SandboxSideConfig } from '../run/sandbox';
import { createStatusTestSides } from '../run/statusTestFight';
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
      /** The opener Goblin fight's guaranteed common-item drop, or (for every other fight) an equipmentDropFor roll (see handleFightResolved / handleSquadConfirmed), rolled up front at squad-confirm time so the victory screen can spotlight it — same value handleFightResolved then hands to ForceEquipScreen, rather than re-rolling after the fact. */
      equipmentReward: EquipmentDefinition | null;
    }
  | { kind: 'quickBattle'; player: Encounter; ai: Encounter }
  | { kind: 'sandboxBattle' }
  /** Built from a SandboxBattleScreen config (src/run/sandbox.ts) — `playerRelics` drives Side A's team relic modifiers, same props the real 'fight' kind already uses; Sandbox Battle has no enemy-side relic support. */
  | { kind: 'sandboxFight'; player: Encounter; ai: Encounter; playerRelics: string[] }
  /** ⚠️ TEMPORARY DEV/TEST — see src/run/statusTestFight.ts. Its own kind rather than a reuse of 'sandboxFight' so leaving it returns to the title screen instead of an unrelated (and empty) Sandbox Battle config. */
  | { kind: 'statusTestFight'; player: Encounter; ai: Encounter }
  /** `offers` is rolled once at node-select time (run/shop.ts rollGuildHallOffers) rather than inside GuildHallPanel's own state — see shop.ts's header for why a component-local roll would reroll on every equipment purchase. */
  | { kind: 'shop'; nodeId: string; offers: GuildHallOffers }
  | { kind: 'reward'; nodeId: string; nodeType: RewardNodeType }
  | { kind: 'statBoost'; nodeId: string; nodeType: StatBoostNodeType }
  /** classReward node (docs/run-loop.md, ClassNodeScreen) — one screen handles both the 1-of-3 Class pick and the target-hero assignment internally, so this kind only needs the node id. */
  | { kind: 'classNode'; nodeId: string }
  | { kind: 'event'; nodeId: string }
  /** Forced spend gate (CLAUDE.md "training points ... must be instantly allocated before the run continues") — `next` is whatever screen would otherwise have followed. */
  | { kind: 'levelUp'; next: Screen }
  /** Forced equip-or-trash gate (user direction: no unequipped stash — every piece of gear obtained must be resolved before the run continues) — `queue` is the item(s) awaiting a decision, `next` is whatever screen would otherwise have followed. */
  | { kind: 'forceEquip'; queue: string[]; next: Screen }
  /**
   * Roster-full replacement gate (CLAUDE.md "Gaining a hero requires
   * terminating an existing one" once at ROSTER_CAP) — Guild Hall path only.
   * The Recruit Contract claim path (FightScreen's victory overlay) resolves
   * this in-place instead, since FightScreen can't safely remount mid-fight
   * (see RosterReplaceScreen's header comment). `next` is the shop screen
   * the player returns to either way, replace confirmed or cancelled.
   */
  | { kind: 'rosterReplace'; candidate: RosterReplaceCandidate; next: Screen }
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
 * given training points").
 *
 * Keyed on the **map** node type rather than the collapsed
 * EncounterNodeType, which is the whole reason this takes a MapNodeType:
 * `skirmish` and `battle` both flatten to a mechanical `fight` encounter
 * (handleNodeSelected's `encounterKind`), so a function taking the encounter
 * kind physically cannot tell the act's opening Goblin fight apart from the
 * normal fights that follow it.
 *
 * 1 for that opener (2026-08-26, per user direction — it is a deliberately
 * light 2v2 against the weak non-recruitable mob pool and was paying out the
 * same as a real fight), 2 for every normal fight after it, 3-4 for elite —
 * boss folds into the elite figure since no separate boss value was
 * specified.
 */
function trainingPointsFor(nodeType: MapNodeType): number {
  if (nodeType === 'fight') return 1;
  if (nodeType === 'skirmish' || nodeType === 'battle') return 2;
  return 3 + Math.floor(Math.random() * 2); // 3-4
}

/**
 * Per-fight equipment-drop odds beyond the Goblin fight's guaranteed common
 * item (handleSquadConfirmed's isGoblinFight branch, unaffected by this
 * table). Elite/boss fights roll both more often AND against
 * ELITE_RARITY_DROP_WEIGHTS (src/run/equipment.ts), which skews well above
 * the default RARITY_DROP_WEIGHTS toward rare-and-up gear — "higher % to
 * drop higher tier loot," not just a higher drop chance.
 */
const EQUIPMENT_DROP_CHANCE: Record<EncounterNodeType, number> = {
  fight: 0.25,
  elite: 0.55,
  boss: 0.7,
};

function equipmentDropFor(nodeType: EncounterNodeType): EquipmentDefinition | null {
  if (Math.random() >= EQUIPMENT_DROP_CHANCE[nodeType]) return null;
  const weights = nodeType === 'fight' ? undefined : ELITE_RARITY_DROP_WEIGHTS;
  return pickWeightedEquipment(Object.values(equipment), 1, weights)[0] ?? null;
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

  /** Roster-full variant of handleClaimContract above — FightScreen opens RosterReplaceScreen in place and calls this once the player picks who to terminate. */
  function handleClaimContractReplace(defeated: RosterEntry, terminatedRosterId: string): boolean {
    if (!isRecruitable(defeated.heroId, heroes)) return false;
    if (playerRun.recruitContracts <= 0) return false;
    const offer = deriveContractOffer(defeated);
    const rosterId = freshRosterId(playerRun, defeated.heroId);
    setPlayerRun((run) => claimContractReplacing(run, offer, rosterId, terminatedRosterId));
    return true;
  }

  /** Guild Hall recruiting at a full roster (GuildHallPanel) opens this Screen instead of recruiting directly — see the `rosterReplace` Screen kind's doc comment. */
  function handleRequestRosterReplace(offer: GuildHallOffer) {
    setScreen({ kind: 'rosterReplace', candidate: { source: 'guildHall', offer }, next: screen });
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
      // `fight` and `battle` (docs/run-loop.md "fight vs skirmish vs battle")
      // both draw from the non-recruitable enemy pool instead of the
      // draftable hero roster — `fight` (always row 0) is 2 random basic
      // Goblins (`BASIC_GOBLIN_IDS`), an intentionally weak opener; `battle`
      // (row 4, map-facing "Monsters") is Goblin Chief plus 3 random basic
      // Goblins, a considerably tougher, still-non-recruitable alternative to
      // that row's Elite option (2026-08-23, per user direction).
      // `skirmish`/`elite`/`boss` draw from the recruitable pool.
      const isMobFight = node.type === 'fight' || node.type === 'battle';
      // `skirmish` and `battle` map nodes ARE plain `fight` encounters
      // mechanically (same heroCount, no stat bonus) — only the pool and the
      // map-facing name differ, so both collapse to 'fight' for
      // generateEncounter/FightScreen, which only need the mechanical shape.
      const encounterKind: EncounterNodeType = node.type === 'skirmish' || node.type === 'battle' ? 'fight' : node.type;
      // The run's 2nd plain-encounter node specifically (not elite/boss,
      // which have their own fixed sizing) is a deliberately lighter 2v2
      // breather between the opener and elites kicking in.
      const isSecondFight = encounterKind === 'fight' && playerRun.fightsStarted === 1;
      let encounter: Encounter;
      if (node.type === 'battle') {
        encounter = generateGoblinChiefEncounter(Math.floor(Math.random() * 2 ** 31), BASIC_GOBLIN_IDS, GOBLIN_CHIEF_ID, enemies);
      } else {
        const encounterPool = node.type === 'fight' ? basicGoblins : heroes;
        const heroCountOverride = node.type === 'fight' ? 2 : isSecondFight ? 2 : undefined;
        encounter = generateEncounter(encounterKind, Math.floor(Math.random() * 2 ** 31), encounterPool, heroCountOverride);
      }
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
    } else if (node.type === 'hpBoostReward' || node.type === 'manaBoostReward' || node.type === 'manaRegenBoostReward') {
      setScreen({ kind: 'statBoost', nodeId, nodeType: node.type });
    } else if (node.type === 'classReward') {
      setScreen({ kind: 'classNode', nodeId });
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
    const mapNodeType = playerRun.map!.nodes[nodeId].type;
    const isGoblinFight = mapNodeType === 'fight';
    const commonPool = Object.values(equipment).filter((item) => item.rarity === 'common');
    const equipmentReward = isGoblinFight
      ? (commonPool[Math.floor(Math.random() * commonPool.length)] ?? null)
      : equipmentDropFor(nodeType);
    setScreen({
      kind: 'fight',
      nodeId,
      nodeType,
      squad,
      encounter,
      goldReward: goldRewardFor(nodeType),
      // The map node type, not `nodeType` — see trainingPointsFor: the
      // opener and the later normal fights are indistinguishable once
      // they collapse to the mechanical `fight` encounter kind.
      trainingPointsReward: trainingPointsFor(mapNodeType),
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

  /**
   * ⚠️ TEMPORARY DEV/TEST — see src/run/statusTestFight.ts for what this
   * fight is and why. Goes through the same buildSandboxSide path as Sandbox
   * Battle (so it exercises the real run -> combat seam rather than a special
   * case), just from a fixed config instead of a user-built one.
   */
  function handleStatusTestFight() {
    const { a, b } = createStatusTestSides();
    setScreen({
      kind: 'statusTestFight',
      player: buildSandboxSide(a, heroes, progressionTable),
      ai: buildSandboxSide(b, heroes, progressionTable),
    });
  }

  return (
    <div className="app-shell" ref={shellRef}>
      {/* TEMP: installed-PWA layout diagnosis. Remove with ViewportProbe.tsx. */}
      {screen.kind === 'title' && <ViewportProbe />}
      {screen.kind === 'title' && (
        <TitleScreen
          onStartRun={handleStartNewRun}
          onQuickBattle={handleQuickBattle}
          onOpenSandbox={handleOpenSandbox}
          onStartLevel4TestRun={handleStartLevel4TestRun}
          onStartStatusTestFight={handleStatusTestFight}
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
          playerRelicIds={screen.playerRelics}
          goldReward={0}
          trainingPointsReward={0}
          equipmentReward={null}
          onClaimContract={() => false}
          onClaimContractReplace={() => false}
          onResolved={() => setScreen({ kind: 'sandboxBattle' })}
        />
      )}

      {screen.kind === 'statusTestFight' && (
        <FightScreen
          playerRun={screen.player.run}
          playerSquad={screen.player.squad}
          aiRun={screen.ai.run}
          aiSquad={screen.ai.squad}
          goldReward={0}
          trainingPointsReward={0}
          equipmentReward={null}
          onClaimContract={() => false}
          onClaimContractReplace={() => false}
          onResolved={() => setScreen({ kind: 'title' })}
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
          playerRelicIds={playerRun.relics}
          goldReward={screen.goldReward}
          trainingPointsReward={screen.trainingPointsReward}
          equipmentReward={screen.equipmentReward}
          onClaimContract={handleClaimContract}
          onClaimContractReplace={handleClaimContractReplace}
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
          onClaimContractReplace={() => false}
          onResolved={() => setScreen({ kind: 'title' })}
        />
      )}

      {screen.kind === 'shop' && (
        <ShopNodeScreen
          run={playerRun}
          offers={screen.offers}
          onRunChange={setPlayerRun}
          onBuyEquipment={handleBuyGuildEquipment}
          onRequestRosterReplace={handleRequestRosterReplace}
          onContinue={() => handleNodeContinue(screen.nodeId)}
        />
      )}

      {screen.kind === 'rosterReplace' && (
        <RosterReplaceScreen
          roster={playerRun.roster}
          candidate={screen.candidate}
          relicIds={playerRun.relics}
          onConfirm={(terminatedRosterId) => {
            const { candidate } = screen;
            try {
              const rosterId = freshRosterId(playerRun, candidate.offer.heroId);
              const nextRun =
                candidate.source === 'guildHall'
                  ? recruitFromGuildHallReplacing(playerRun, candidate.offer, rosterId, terminatedRosterId)
                  : claimContractReplacing(playerRun, candidate.offer, rosterId, terminatedRosterId);
              setPlayerRun(nextRun);
              setScreen(screen.next);
              return true;
            } catch (err) {
              if (!(err instanceof RecruitmentError)) throw err;
              return false;
            }
          }}
          onCancel={() => setScreen(screen.next)}
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

      {screen.kind === 'classNode' && (
        <ClassNodeScreen run={playerRun} onRunChange={setPlayerRun} onContinue={() => handleNodeContinue(screen.nodeId)} />
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
