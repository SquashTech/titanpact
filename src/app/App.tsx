import { useEffect, useRef, useState } from 'react';
import { initUiScale } from './uiScale';
import { useReloadOnNewBuild } from './useReloadOnNewBuild';
import { FightScreen } from '../view/combat/FightScreen';
import { TitleScreen } from '../view/run/TitleScreen';
import { DraftScreen } from '../view/run/DraftScreen';
import { SquadSelectScreen } from '../view/run/SquadSelectScreen';
import { MapScreen } from '../view/run/MapScreen';
import { ShopNodeScreen } from '../view/run/ShopNodeScreen';
import { NodeRewardScreen, type RewardNodeType } from '../view/run/NodeRewardScreen';
import { CacheOpenScreen } from '../view/run/CacheOpenScreen';
import { GuardianBannerScreen } from '../view/run/GuardianBannerScreen';
import { LevelUpScreen } from '../view/run/LevelUpScreen';
import { ForceEquipScreen } from '../view/run/ForceEquipScreen';
import { RosterReplaceScreen } from '../view/run/RosterReplaceScreen';
import { RecruitScreen } from '../view/run/RecruitScreen';
import { StatBoostScreen, type StatBoostNodeType } from '../view/run/StatBoostScreen';
import { ClassNodeScreen } from '../view/run/ClassNodeScreen';
import { EventNodeScreen } from '../view/run/EventNodeScreen';
import { runEvents } from '../data/events';
import { rollRunEvent } from '../run/events';
import { SandboxBattleScreen } from '../view/run/SandboxBattleScreen';
import { heroes } from '../data/heroes';
import { enemies, factions, basicEnemiesOf } from '../data/enemies';
import { ActIntroScreen } from '../view/run/ActIntroScreen';
import { equipment } from '../data/equipment';
import {
  equipItem,
  pickWeightedEquipment,
  pickWeightedEquipmentBySlot,
  rarityWeightsFor,
  type EquipmentDefinition,
  type EquipmentSlot,
  type LootSource,
} from '../run/equipment';
import { createRunState, createRosterEntry, addRosterEntry, ROSTER_CAP, TOTAL_ACTS } from '../run/state';
import {
  deriveContractOffer,
  claimContract,
  claimContractReplacing,
  recruitFromGuildHallReplacing,
  freshRosterId,
  isRecruitable,
  pickContractOffers,
  RecruitmentError,
  type GuildHallOffer,
  type RosterReplaceCandidate,
} from '../run/recruitment';
import { guildHallOffers } from '../data/recruitment';
import { rollGuildHallOffers, buyEquipment, ShopError, type GuildHallOffers } from '../run/shop';
import { generateMap, type MapNodeType } from '../run/map';
import { generateStarterOptions } from '../run/draft';
import { generateEncounter, generateLeaderEncounter, appendFinalEnemy, type EncounterNodeType, type Encounter } from '../run/enemyGen';
import { actScaling, type ScalingTrack } from '../run/difficulty';
import { generateItinerary, locationBias, locationForAct } from '../run/locations';
import { ACT_ONE_LOCATION_ID, locations } from '../data/locations';
import { LocationProvider } from '../view/shared/LocationContext';
import { prefetchTrack, setTrack } from '../audio/music';
import { hasTrack } from '../audio/tracks';
import { pickSquad } from '../run/squad';
import { advanceToNode, advanceToNextAct, grantCurrencyReward, grantUpgradeReward, grantContractReward } from '../run/runProgress';
import { buildSandboxSide, createEmptySandboxSide, type SandboxSideConfig } from '../run/sandbox';
import { createStatusTestSides } from '../run/statusTestFight';
import { fullMovepool, canAffordAnyLevelUp } from '../run/progression';
import { progressionTable } from '../data/progression';
import type { RunState, RosterEntry } from '../run/state';
import type { Squad } from '../run/squad';

type Screen =
  | { kind: 'title' }
  | { kind: 'draft'; optionIds: string[] }
  /** Per-act arrival beat; reads its location off the run's itinerary. */
  | { kind: 'actIntro' }
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
      /** Rolled at squad-confirm time so the victory screen can spotlight it; handleFightResolved reuses it. */
      equipmentReward: EquipmentDefinition | null;
    }
  | { kind: 'quickBattle'; player: Encounter; ai: Encounter }
  | { kind: 'sandboxBattle' }
  | { kind: 'sandboxFight'; player: Encounter; ai: Encounter; playerRelics: string[] }
  /** TEMPORARY DEV/TEST — src/run/statusTestFight.ts. Own kind so leaving returns to the title. */
  | { kind: 'statusTestFight'; player: Encounter; ai: Encounter }
  /** `offers` and `soldOutEquipmentIds` live on the screen, not in the shop component: a purchase unmounts the shop through the equip gate, and component-local state would reroll / forget. */
  | { kind: 'shop'; nodeId: string; offers: GuildHallOffers; soldOutEquipmentIds: string[] }
  | { kind: 'reward'; nodeId: string; nodeType: RewardNodeType }
  /** Cache-opening beat; the node is already resolved and the item rolled. `next` is the equip gate. */
  | { kind: 'cacheOpen'; slot: EquipmentSlot; next: Screen }
  | { kind: 'statBoost'; nodeId: string; nodeType: StatBoostNodeType }
  | { kind: 'classNode'; nodeId: string }
  /** Which event this node is gets rolled ONCE at node-select time — the screen re-renders on every onRunChange. */
  | { kind: 'event'; nodeId: string; eventId: string }
  /** Guardian's Banner after a Guardian win in acts 1-4. Not a map node, so no nodeId. */
  | { kind: 'guardianBanner'; next: Screen }
  | { kind: 'levelUp'; next: Screen }
  /** Forced equip-or-trash gate; there is no unequipped stash. */
  | { kind: 'forceEquip'; queue: string[]; next: Screen }
  /** Roster-full replacement, Guild Hall path only; the contract path resolves in RecruitScreen. */
  | { kind: 'rosterReplace'; candidate: RosterReplaceCandidate; next: Screen }
  /** Offers sampled once in handleFightResolved; only pushed when the player holds a contract. */
  | { kind: 'recruit'; offers: RosterEntry[]; next: Screen }
  | { kind: 'runComplete' }
  | { kind: 'runFailed' };

/** Screens outside an act get no ambient Location (LocationContext). Listed as the exceptions so new node screens inherit the place by default. */
const PLACELESS_SCREENS: ReadonlySet<Screen['kind']> = new Set([
  'title',
  'draft',
  'quickBattle',
  'sandboxBattle',
  'sandboxFight',
  'statusTestFight',
  'runComplete',
  'runFailed',
]);

const EQUIPMENT_POOL = Object.values(equipment);

/** Throwaway (unseeded) seed for the entry-point rolls in this file. */
function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

function addHeroes(run: RunState, heroIds: readonly string[], level?: number): RunState {
  for (const heroId of heroIds) {
    const entry = createRosterEntry(heroId, heroId, heroes[heroId].moveIds);
    run = addRosterEntry(run, level === undefined ? entry : { ...entry, level });
  }
  return run;
}

/** A fresh run from the drafted pair; map and itinerary drawn once for the whole run. */
function createStartingRun(heroIds: readonly string[]): RunState {
  return {
    ...addHeroes(createRunState(0, 40), heroIds),
    map: generateMap(randomSeed()),
    locationIds: generateItinerary(randomSeed()),
  };
}

/**
 * "Visit Location": a normal run whose Act 1 is the chosen place (breaking generateItinerary's
 * Wild's-Edge-first rule on purpose) with a random full roster at level 1.
 */
function createLocationVisitRun(locationId: string): RunState {
  const heroIds = shuffled(Object.keys(heroes)).slice(0, ROSTER_CAP);
  const rest = shuffled(Object.keys(locations).filter((id) => id !== locationId));
  return {
    ...addHeroes(createRunState(0, 40), heroIds),
    map: generateMap(randomSeed()),
    locationIds: [locationId, ...rest].slice(0, TOTAL_ACTS),
  };
}

/** Fisher-Yates on a copy. */
function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** TEMPORARY DEV/TEST — a full roster one level under Evolution with one point to spend. Remove with its TitleScreen button. */
function createLevel4TestRun(): RunState {
  return {
    ...addHeroes(createRunState(1, 999), Object.keys(heroes).slice(0, ROSTER_CAP), 4),
    map: generateMap(randomSeed()),
    locationIds: generateItinerary(randomSeed()),
  };
}

/** TEST FIXTURE — arms the opener's Goblin Skulker with a Dagger so the equip-inspect UI has an item from turn one. */
function equipTestDagger(encounter: Encounter): Encounter {
  const roster = encounter.run.roster.map((entry) =>
    entry.heroId === 'goblinSkulker' ? { ...entry, equipment: equipItem(entry.equipment, equipment.dagger) } : entry
  );
  return { ...encounter, run: { ...encounter.run, roster } };
}

/** Payouts key on the MAP node type: `skirmish` and `battle` both flatten to a `fight` encounter but sit in opposite reward lanes. */
type EncounterMapNodeType = 'fight' | 'skirmish' | 'battle' | 'elite' | 'boss';

// Two reward lanes: Monsters (fight/battle) is loot-and-gold with a guaranteed drop and 1 lane of
// XP; Skirmish (skirmish/elite) is the XP lane with a thin gold band and a rolled drop. The
// Guardian pays in the Banner, not coin.
function goldRewardFor(nodeType: EncounterMapNodeType): number {
  if (nodeType === 'boss') return 0;
  // The row-0 opener stays on the thin band: it is the lightest fight and already ships a drop.
  if (nodeType === 'battle') return 30 + Math.floor(Math.random() * 16); // 30-45
  return 15 + Math.floor(Math.random() * 11); // 15-25
}

/** Training Points per win: 2 the act opener / 3 Monsters / 4 Skirmish and Guardian. Deliberately FLAT across acts — the level-price curve is the brake (docs/leveling-and-ranks.md). */
function trainingPointsFor(nodeType: EncounterMapNodeType): number {
  // The opener is the lightest fight on the map and pays the least; `battle` is the full Monsters rate.
  if (nodeType === 'fight') return 2;
  if (nodeType === 'battle') return 3;
  return 4;
}

/** Monsters always drop; Skirmish rolls for it, with elite/boss also one loot tier ahead (LOOT_SOURCE). */
const EQUIPMENT_DROP_CHANCE: Record<EncounterMapNodeType, number> = {
  fight: 1,
  battle: 1,
  skirmish: 0.25,
  elite: 0.55,
  boss: 0.7,
};

const LOOT_SOURCE: Record<EncounterMapNodeType, LootSource> = {
  fight: 'standard',
  battle: 'standard',
  skirmish: 'standard',
  elite: 'elite',
  boss: 'elite',
};

function equipmentDropFor(nodeType: EncounterMapNodeType, actNumber: number): EquipmentDefinition | null {
  if (Math.random() >= EQUIPMENT_DROP_CHANCE[nodeType]) return null;
  const weights = rarityWeightsFor(actNumber, LOOT_SOURCE[nodeType]);
  return pickWeightedEquipment(EQUIPMENT_POOL, 1, weights)[0] ?? null;
}

/** The map, behind the level-up gate if anyone can afford one and the player has not banked the pool. */
function levelUpPending(run: RunState): boolean {
  return canAffordAnyLevelUp(run) && !run.levelUpDeferred;
}

function mapAfterLevelUp(run: RunState): Screen {
  return levelUpPending(run) ? { kind: 'levelUp', next: { kind: 'map' } } : { kind: 'map' };
}

export function App() {
  const [playerRun, setPlayerRun] = useState<RunState>(() => createRunState(0, 40));
  const [screen, setScreen] = useState<Screen>({ kind: 'title' });
  const shellRef = useRef<HTMLDivElement>(null);

  // Owned here rather than in SandboxBattleScreen, which unmounts during a sandbox fight.
  const [sandboxSideA, setSandboxSideA] = useState<SandboxSideConfig>(() => createEmptySandboxSide());
  const [sandboxSideB, setSandboxSideB] = useState<SandboxSideConfig>(() => createEmptySandboxSide());

  useEffect(() => {
    if (shellRef.current) return initUiScale(shellRef.current);
  }, []);

  // Title screen only — a run lives in React state alone, so a reload anywhere else destroys one.
  useReloadOnNewBuild(screen.kind === 'title');

  function handleClaimContract(defeated: RosterEntry): boolean {
    if (!isRecruitable(defeated.heroId, heroes)) return false;
    if (playerRun.roster.length >= ROSTER_CAP) return false;
    if (playerRun.recruitContracts <= 0) return false;
    const offer = deriveContractOffer(defeated);
    const rosterId = freshRosterId(playerRun, defeated.heroId);
    setPlayerRun((run) => claimContract(run, offer, rosterId));
    return true;
  }

  function handleClaimContractReplace(defeated: RosterEntry, terminatedRosterId: string): boolean {
    if (!isRecruitable(defeated.heroId, heroes)) return false;
    if (playerRun.recruitContracts <= 0) return false;
    const offer = deriveContractOffer(defeated);
    const rosterId = freshRosterId(playerRun, defeated.heroId);
    setPlayerRun((run) => claimContractReplacing(run, offer, rosterId, terminatedRosterId));
    return true;
  }

  function handleRequestRosterReplace(offer: GuildHallOffer) {
    setScreen({ kind: 'rosterReplace', candidate: { source: 'guildHall', offer }, next: screen });
  }

  function handleSelectNode(nodeId: string) {
    const node = playerRun.map!.nodes[nodeId];
    const location = locationForAct(playerRun.locationIds, playerRun.actNumber);
    if (
      node.type === 'fight' ||
      node.type === 'skirmish' ||
      node.type === 'battle' ||
      node.type === 'elite' ||
      node.type === 'boss'
    ) {
      // Generated at node-select time so SquadSelectScreen can scout the enemy squad.
      // `fight`/`battle` draw from the Location's faction; `skirmish`/`elite`/`boss` from the recruitable hero pool.
      const isMobFight = node.type === 'fight' || node.type === 'battle';
      const faction = factions[location.factionId];
      // `skirmish` and `battle` are mechanically plain `fight` encounters.
      const encounterKind: EncounterNodeType = node.type === 'skirmish' || node.type === 'battle' ? 'fight' : node.type;
      // The run's 2nd plain encounter is a deliberately lighter 2v2.
      const isSecondFight = encounterKind === 'fight' && playerRun.fightsStarted === 1;
      const track: ScalingTrack = isMobFight ? 'monsters' : 'skirmish';
      const scaling = actScaling(track, playerRun.actNumber, isMobFight ? faction.baselineAct : undefined);
      let encounter: Encounter;
      if (node.type === 'battle') {
        encounter = generateLeaderEncounter(randomSeed(), faction.basicIds, faction.leaderId, enemies, scaling);
      } else {
        const encounterPool = node.type === 'fight' ? basicEnemiesOf(faction) : heroes;
        // A hero already on the roster is barred from the recruitable SPAWN, so two copies can never
        // reach one roster via a contract claim (mirrors rollGuildHallOffers).
        const excludeHeroIds = encounterPool === heroes ? playerRun.roster.map((r) => r.heroId) : undefined;
        const heroCountOverride = node.type === 'fight' ? 2 : isSecondFight ? 2 : undefined;
        const heroCount = heroCountOverride ?? (encounterKind === 'boss' ? 2 : 4);
        // Location affinity bias applies to the recruitable pool only (docs/locations.md §2).
        const bias = encounterPool === heroes ? locationBias(location, heroes, heroCount) : undefined;
        encounter = generateEncounter(encounterKind, randomSeed(), encounterPool, {
          heroCount: heroCountOverride,
          bias,
          excludeHeroIds,
          scaling,
          // No-op for the Goblin pool, which has no progression data.
          progression: progressionTable,
        });
        // The Location's held-back champion arrives benched, so the first enemy KO brings him in.
        const finalEnemyId = node.type === 'boss' ? location.guardianFinalEnemyId : null;
        if (finalEnemyId) {
          encounter = appendFinalEnemy(encounter, finalEnemyId, enemies, randomSeed(), scaling);
        }
      }
      const isFirstFight = encounterKind === 'fight' && playerRun.fightsStarted === 0;
      if (isMobFight && isFirstFight) {
        encounter = equipTestDagger(encounter);
      }
      if (encounterKind === 'fight') {
        setPlayerRun((run) => ({ ...run, fightsStarted: run.fightsStarted + 1 }));
      }
      // With 2 or fewer heroes there is no bench/active split to decide; skip squad select.
      if (playerRun.roster.length <= 2) {
        const squad = pickSquad(playerRun.roster, playerRun.roster.map((r) => r.rosterId));
        handleSquadConfirmed(squad, nodeId, encounterKind, encounter);
      } else {
        setScreen({ kind: 'squadSelect', nodeId, nodeType: encounterKind, encounter });
      }
    } else if (node.type === 'shop') {
      setScreen({
        kind: 'shop',
        nodeId,
        offers: rollGuildHallOffers(playerRun, guildHallOffers, EQUIPMENT_POOL),
        soldOutEquipmentIds: [],
      });
    } else if (node.type === 'weaponReward' || node.type === 'armorReward' || node.type === 'accessoryReward') {
      // One guaranteed item of a fixed slot, through the cache-opening beat into the equip gate.
      const slot: EquipmentSlot = node.type === 'weaponReward' ? 'weapon' : node.type === 'armorReward' ? 'armor' : 'accessory';
      const item = pickWeightedEquipmentBySlot(EQUIPMENT_POOL, slot, rarityWeightsFor(playerRun.actNumber, 'standard'));
      setPlayerRun((run) => advanceToNode(run, nodeId));
      const afterScreen = mapAfterLevelUp(playerRun);
      setScreen(
        item ? { kind: 'cacheOpen', slot, next: { kind: 'forceEquip', queue: [item.id], next: afterScreen } } : afterScreen
      );
    } else if (node.type === 'hpBoostReward' || node.type === 'manaBoostReward' || node.type === 'manaRegenBoostReward') {
      setScreen({ kind: 'statBoost', nodeId, nodeType: node.type });
    } else if (node.type === 'classReward') {
      setScreen({ kind: 'classNode', nodeId });
    } else if (node.type === 'event') {
      const rolled = rollRunEvent(runEvents, playerRun.actNumber, location.id);
      // Nothing eligible skips the node rather than stranding the player on an empty screen.
      if (rolled) setScreen({ kind: 'event', nodeId, eventId: rolled.id });
      else handleNodeContinue(nodeId);
    } else {
      setScreen({ kind: 'reward', nodeId, nodeType: node.type });
    }
  }

  function handleSquadConfirmed(squad: Squad, nodeId: string, nodeType: EncounterNodeType, encounter: Encounter) {
    const mapNodeType = playerRun.map!.nodes[nodeId].type as EncounterMapNodeType;
    const equipmentReward = equipmentDropFor(mapNodeType, playerRun.actNumber);
    setScreen({
      kind: 'fight',
      nodeId,
      nodeType,
      squad,
      encounter,
      goldReward: goldRewardFor(mapNodeType),
      trainingPointsReward: trainingPointsFor(mapNodeType),
      equipmentReward,
    });
  }

  function handleFightResolved(
    nodeId: string,
    goldReward: number,
    trainingPointsReward: number,
    equipmentReward: EquipmentDefinition | null,
    /** This fight's AI roster — the beaten builds a Recruit Contract can claim. */
    defeatedRoster: readonly RosterEntry[],
    outcome: 'win' | 'loss'
  ) {
    if (outcome === 'loss') {
      setScreen({ kind: 'runFailed' });
      return;
    }
    const isBossNode = nodeId === playerRun.map!.bossNodeId;
    // No Banner on the final act's Guardian: nothing left to spend it on. Read before advanceToNextAct bumps actNumber.
    const banner = isBossNode && playerRun.actNumber < TOTAL_ACTS;

    let next = grantCurrencyReward(playerRun, goldReward);
    next = grantUpgradeReward(next, trainingPointsReward);
    next = advanceToNode(next, nodeId);

    let afterScreen: Screen;
    if (isBossNode) {
      next = grantContractReward(next, 1);
      if (next.actNumber < TOTAL_ACTS) {
        next = advanceToNextAct(next, randomSeed());
        afterScreen = { kind: 'actIntro' };
      } else {
        afterScreen = { kind: 'runComplete' };
      }
    } else {
      afterScreen = { kind: 'map' };
    }

    setPlayerRun(next);
    const afterLevelUp: Screen = levelUpPending(next) ? { kind: 'levelUp', next: afterScreen } : afterScreen;
    const afterEquip: Screen = equipmentReward ? { kind: 'forceEquip', queue: [equipmentReward.id], next: afterLevelUp } : afterLevelUp;

    // Gate order is deliberate: banner, then recruit, then equip, then level-up — so a hero recruited
    // this beat already stands under the banner and can receive this win's gear and points.
    // `next`, not `playerRun`: a boss node has just granted the contract that is spendable here.
    const contractOffers =
      next.recruitContracts > 0 ? pickContractOffers(defeatedRoster.filter((entry) => isRecruitable(entry.heroId, heroes))) : [];
    const afterRecruit: Screen = contractOffers.length > 0 ? { kind: 'recruit', offers: contractOffers, next: afterEquip } : afterEquip;
    setScreen(banner ? { kind: 'guardianBanner', next: afterRecruit } : afterRecruit);
  }

  function handleNodeContinue(nodeId: string) {
    setPlayerRun((run) => advanceToNode(run, nodeId));
    setScreen(mapAfterLevelUp(playerRun));
  }

  /** Claiming an item advances the node and hands off to the equip gate. A queue, because the Loot Pile event hands over three at once. */
  function handleClaimEquipment(nodeId: string, itemIds: string | string[]) {
    setPlayerRun((run) => advanceToNode(run, nodeId));
    setScreen({ kind: 'forceEquip', queue: Array.isArray(itemIds) ? itemIds : [itemIds], next: mapAfterLevelUp(playerRun) });
  }

  /** Guild Hall purchase: validate-before-commit, then the equip gate returns to the same shop with the item greyed out. */
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
    const backToShop: Screen =
      screen.kind === 'shop' ? { ...screen, soldOutEquipmentIds: [...screen.soldOutEquipmentIds, itemId] } : screen;
    setScreen({ kind: 'forceEquip', queue: [itemId], next: backToShop });
  }

  function handleStartNewRun() {
    const starterHeroIds = Object.values(heroes)
      .filter((hero) => hero.starter)
      .map((hero) => hero.id);
    const optionIds = generateStarterOptions(randomSeed(), starterHeroIds);
    setScreen({ kind: 'draft', optionIds });
  }

  function handleDraftConfirm(chosenIds: string[]) {
    setPlayerRun(createStartingRun(chosenIds));
    setScreen({ kind: 'actIntro' });
  }

  /** TEMPORARY DEV/TEST — see createLevel4TestRun. */
  function handleStartLevel4TestRun() {
    setPlayerRun(createLevel4TestRun());
    setScreen({ kind: 'levelUp', next: { kind: 'map' } });
  }

  /** Random 4v4 straight into FightScreen. Every hero rolls MOVE_CAP moves from its FULL movepool — a throwaway fight is the place to spend on coverage. */
  function handleQuickBattle() {
    const movepools = Object.fromEntries(Object.values(heroes).map((hero) => [hero.id, fullMovepool(progressionTable, hero)]));
    const player = generateEncounter('fight', randomSeed(), heroes, { movepools });
    const ai = generateEncounter('fight', randomSeed(), heroes, { movepools });
    setScreen({ kind: 'quickBattle', player, ai });
  }

  function handleOpenSandbox() {
    setScreen({ kind: 'sandboxBattle' });
  }

  function handleVisitLocation(locationId: string) {
    setPlayerRun(createLocationVisitRun(locationId));
    setScreen({ kind: 'actIntro' });
  }

  function handleSandboxFight(a: SandboxSideConfig, b: SandboxSideConfig) {
    const player = buildSandboxSide(a, heroes, progressionTable);
    const ai = buildSandboxSide(b, heroes, progressionTable);
    setScreen({ kind: 'sandboxFight', player, ai, playerRelics: a.relicIds });
  }

  /** TEMPORARY DEV/TEST — src/run/statusTestFight.ts, through the same buildSandboxSide path as Sandbox Battle. */
  function handleStatusTestFight() {
    const { a, b } = createStatusTestSides();
    setScreen({
      kind: 'statusTestFight',
      player: buildSandboxSide(a, heroes, progressionTable),
      ai: buildSandboxSide(b, heroes, progressionTable),
    });
  }

  const ambientLocation =
    PLACELESS_SCREENS.has(screen.kind) || playerRun.locationIds.length === 0
      ? null
      : locationForAct(playerRun.locationIds, playerRun.actNumber);

  // The act's location IS the track; computed above the screen switch so music survives map <-> fight.
  // A location with no authored track fades to silence rather than carrying the previous act's music.
  // The title is the exception — it is placeless, so it names its own track (audio/tracks.ts).
  const trackId = screen.kind === 'title' ? 'titleScreen' : hasTrack(ambientLocation?.id) ? ambientLocation.id : null;
  useEffect(() => {
    setTrack(trackId);
  }, [trackId]);

  // The itinerary is drawn once at run start, so the track after this one is known rather than
  // guessed; from the title the next thing needed is Act 1's, always the same place. Warmed so
  // an act break doesn't sit in silence through a multi-megabyte download.
  const nextLocationId = screen.kind === 'title' ? ACT_ONE_LOCATION_ID : playerRun.locationIds[playerRun.actNumber] ?? null;
  useEffect(() => {
    if (hasTrack(nextLocationId)) prefetchTrack(nextLocationId);
  }, [nextLocationId]);

  return (
    <LocationProvider location={ambientLocation}>
    <div className="app-shell" ref={shellRef}>
      {screen.kind === 'title' && (
        <TitleScreen
          onStartRun={handleStartNewRun}
          onQuickBattle={handleQuickBattle}
          onOpenSandbox={handleOpenSandbox}
          onVisitLocation={handleVisitLocation}
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
          onResolved={() => setScreen({ kind: 'title' })}
        />
      )}

      {screen.kind === 'draft' && <DraftScreen optionIds={screen.optionIds} onConfirm={handleDraftConfirm} />}

      {screen.kind === 'actIntro' && (
        <ActIntroScreen
          run={playerRun}
          location={locationForAct(playerRun.locationIds, playerRun.actNumber)}
          onEnter={() => setScreen({ kind: 'map' })}
        />
      )}

      {screen.kind === 'map' && (
        <MapScreen
          run={playerRun}
          onRunChange={setPlayerRun}
          onSelectNode={handleSelectNode}
          onOpenLevelUp={() => setScreen({ kind: 'levelUp', next: { kind: 'map' } })}
          onQuitToTitle={() => setScreen({ kind: 'title' })}
        />
      )}

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
          onResolved={(outcome) =>
            handleFightResolved(
              screen.nodeId,
              screen.goldReward,
              screen.trainingPointsReward,
              screen.equipmentReward,
              screen.encounter.run.roster,
              outcome
            )
          }
          onQuitToTitle={() => setScreen({ kind: 'title' })}
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
          onResolved={() => setScreen({ kind: 'title' })}
          /* No run behind a Quick Battle: a plain one-tap exit, not the armed quit run fights get. */
          onExitToTitle={() => setScreen({ kind: 'title' })}
        />
      )}

      {screen.kind === 'shop' && (
        <ShopNodeScreen
          run={playerRun}
          offers={screen.offers}
          soldOutEquipmentIds={screen.soldOutEquipmentIds}
          onRunChange={setPlayerRun}
          onBuyEquipment={handleBuyGuildEquipment}
          onRequestRosterReplace={handleRequestRosterReplace}
          onContinue={() => handleNodeContinue(screen.nodeId)}
        />
      )}

      {screen.kind === 'recruit' && (
        <RecruitScreen
          run={playerRun}
          offers={screen.offers}
          onClaim={handleClaimContract}
          onClaimReplace={handleClaimContractReplace}
          onDone={() => setScreen(screen.next)}
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

      {screen.kind === 'cacheOpen' && (
        <CacheOpenScreen slot={screen.slot} onDone={() => setScreen(screen.next)} />
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

      {screen.kind === 'event' &&
        runEvents[screen.eventId] &&
        (() => {
          const { nodeId, eventId } = screen;
          return (
            <EventNodeScreen
              event={runEvents[eventId]}
              run={playerRun}
              onRunChange={setPlayerRun}
              onGrantEquipment={(itemIds) => handleClaimEquipment(nodeId, itemIds)}
              onContinue={() => handleNodeContinue(nodeId)}
            />
          );
        })()}

      {screen.kind === 'guardianBanner' && (
        <GuardianBannerScreen run={playerRun} onRunChange={setPlayerRun} onContinue={() => setScreen(screen.next)} />
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
          <p className="hint">You defeated the Guardian {TOTAL_ACTS} times. All acts are cleared.</p>
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
    </LocationProvider>
  );
}
