import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { initUiScale } from './uiScale';
import { useReloadOnNewBuild } from './useReloadOnNewBuild';
import { clearSave, readSave, writeSave } from './saveStorage';
import { eraseAllData, readProfile, updateProfile } from './profileStorage';
import { usePlaytime } from './usePlaytime';
import { saveSummary, type SavedRun } from '../run/save';
import {
  recordActReached,
  recordRunCompleted,
  recordRunFailed,
  recordRunStarted,
  recordTutorialDone,
  shouldPlayTutorial,
  type Profile,
} from '../run/profile';
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
import { GemChoiceScreen } from '../view/run/GemChoiceScreen';
import { ClassNodeScreen } from '../view/run/ClassNodeScreen';
import { EventNodeScreen } from '../view/run/EventNodeScreen';
import { runEvents } from '../data/events';
import { rollRunEvent } from '../run/events';
import { SandboxBattleScreen } from '../view/run/SandboxBattleScreen';
import { RunSummaryScreen } from '../view/run/RunSummaryScreen';
import { heroes } from '../data/heroes';
import { enemies, factions, basicEnemiesOf, finaleEnemies, ENDBRINGER_ID } from '../data/enemies';
import { ActIntroScreen } from '../view/run/ActIntroScreen';
import { PactSealScreen } from '../view/run/PactSealScreen';
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
import { createRunState, createRosterEntry, addRosterEntry, FINALE_ACT, ROSTER_CAP, TOTAL_ACTS } from '../run/state';
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
import { gemForStat } from '../data/relics';
import { rollGuildHallOffers, buyEquipment, ShopError, type GuildHallOffers } from '../run/shop';
import { guildHallEntry } from '../run/guildRecruit';
import { generateMap, type MapNodeType } from '../run/map';
import {
  generateTutorialMap,
  isTutorialAct,
  mapBeatKey,
  markTutorialBeatSeen,
  rewardBeatKey,
  tutorialBeat,
  tutorialEncounterFor,
  tutorialPayoutFor,
  TUTORIAL_STARTER_IDS,
  type TutorialBeatKey,
} from '../run/tutorial';
import { TUTORIAL_ENCOUNTERS, TUTORIAL_PAYOUTS, TUTORIAL_SCRIPT } from '../data/tutorial';
import { TutorialOverlay } from '../view/run/TutorialOverlay';
import { pickGemOffers, rollGemOffers } from '../run/gems';
import { generateStarterOptions } from '../run/draft';
import {
  generateEncounter,
  generateLeaderEncounter,
  generateFinaleEncounter,
  appendFinalEnemy,
  type EncounterNodeType,
  type Encounter,
} from '../run/enemyGen';
import { actScaling, trainingPointsFor, type ScalingTrack } from '../run/difficulty';
import { generateItinerary, locationBias, locationForAct } from '../run/locations';
import { ACT_ONE_LOCATION_ID, locations } from '../data/locations';
import { LocationProvider } from '../view/shared/LocationContext';
import { NODE_TINT_MANA } from '../view/shared/NodeStage';
import { prefetchTrack, setTrack } from '../audio/music';
import { hasTrack } from '../audio/tracks';
import { pickSquad, STANDARD_SQUAD_SIZE } from '../run/squad';
import {
  reachableNodeIds,
  advanceToNode,
  advanceToNextAct,
  grantCurrencyReward,
  grantUpgradeReward,
  grantContractReward,
  recordBrokenSeal,
} from '../run/runProgress';
import { buildSandboxSide, createEmptySandboxSide, type SandboxSideConfig } from '../run/sandbox';
import { createStatusTestSides } from '../run/statusTestFight';
import { availableEvolution, fullMovepool, canAffordAnyLevelUp } from '../run/progression';
import { progressionTable } from '../data/progression';
import type { RunState, RosterEntry } from '../run/state';
import type { Squad } from '../run/squad';

type Screen =
  | { kind: 'title' }
  | { kind: 'draft'; optionIds: string[] }
  /** The act-boundary beat: five sockets, one per Guardian (docs/run-loop.md §4). */
  | { kind: 'pactSeal' }
  /** Per-act arrival beat; reads its location off the run's itinerary. */
  | { kind: 'actIntro' }
  | { kind: 'map' }
  | { kind: 'squadSelect'; nodeId: string; nodeType: EncounterNodeType; encounter: Encounter; squadSize: number }
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
  /** A Gem offer — the gemReward node, the two stat shrines, and a fight that rolled one. Already-resolved, so no nodeId. */
  | { kind: 'gemChoice'; gemIds: string[]; eyebrow: string; title: string; tint?: string; next: Screen }
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
  // Between two acts, and the property of neither.
  'pactSeal',
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

/**
 * A fresh run from the drafted pair; map and itinerary drawn once for the whole run. A tutorial
 * run differs only in Act 1's map — its itinerary is drawn normally (Act 1 is always Wild's Edge
 * anyway) and `advanceToNextAct` generates Act 2 the ordinary way.
 */
function createStartingRun(heroIds: readonly string[], tutorial: boolean, seenBeatIds: readonly string[]): RunState {
  return {
    ...addHeroes(createRunState(0, 40), heroIds),
    map: tutorial ? generateTutorialMap(randomSeed()) : generateMap(randomSeed()),
    locationIds: generateItinerary(randomSeed()),
    tutorial,
    // Carried across the draft: the intro beat plays on the draft screen, before this run exists.
    tutorialSeenBeatIds: [...seenBeatIds],
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
type EncounterMapNodeType = 'fight' | 'skirmish' | 'battle' | 'elite' | 'boss' | 'finale';

// Two reward lanes: Monsters (fight/battle) is loot-and-gold with a guaranteed drop and 1 lane of
// XP; Skirmish (skirmish/elite) is the XP lane with a thin gold band and a rolled drop. The
// Guardian pays in the Banner, not coin.
function goldRewardFor(nodeType: EncounterMapNodeType): number {
  // The finale pays nothing at all: the run ends on it, and there is no node after it.
  if (nodeType === 'boss' || nodeType === 'finale') return 0;
  // The row-0 opener stays on the thin band: it is the lightest fight and already ships a drop.
  if (nodeType === 'battle') return 30 + Math.floor(Math.random() * 16); // 30-45
  return 15 + Math.floor(Math.random() * 11); // 15-25
}

/** Monsters always drop; Skirmish rolls for it, with elite/boss also one loot tier ahead (LOOT_SOURCE). */
const EQUIPMENT_DROP_CHANCE: Record<EncounterMapNodeType, number> = {
  fight: 1,
  battle: 1,
  skirmish: 0.25,
  elite: 0.55,
  boss: 0.7,
  finale: 0,
};

const LOOT_SOURCE: Record<EncounterMapNodeType, LootSource> = {
  fight: 'standard',
  battle: 'standard',
  skirmish: 'standard',
  elite: 'elite',
  boss: 'elite',
  finale: 'elite',
};

function equipmentDropFor(nodeType: EncounterMapNodeType, actNumber: number): EquipmentDefinition | null {
  if (Math.random() >= EQUIPMENT_DROP_CHANCE[nodeType]) return null;
  const weights = rarityWeightsFor(actNumber, LOOT_SOURCE[nodeType]);
  return pickWeightedEquipment(EQUIPMENT_POOL, 1, weights)[0] ?? null;
}

/**
 * How each Gem-granting node dresses the one GemChoiceScreen. The Mana Well and Regen Spring keep
 * the names, tints and place-flavour they had as hero-targeted shrines — only the grant changed.
 */
const GEM_NODE_PRESENTATION: Record<'gemReward' | 'manaBoostReward' | 'manaRegenBoostReward', { eyebrow: string; title: string; tint?: string }> = {
  gemReward: { eyebrow: 'A Seam Opens', title: 'Gem Cache' },
  manaBoostReward: { eyebrow: 'A Blessing', title: 'Mana Well', tint: NODE_TINT_MANA },
  manaRegenBoostReward: { eyebrow: 'A Blessing', title: 'Regen Spring', tint: NODE_TINT_MANA },
};

/** The map, behind the level-up gate if anyone can afford one and the player has not banked the pool. */
function levelUpPending(run: RunState): boolean {
  return canAffordAnyLevelUp(run) && !run.levelUpDeferred;
}

function mapAfterLevelUp(run: RunState): Screen {
  return levelUpPending(run) ? { kind: 'levelUp', next: { kind: 'map' } } : { kind: 'map' };
}

/**
 * Which of Valor's beats the current screen is the moment for (docs/tutorial.md). Returns a key
 * whether or not the script has a beat for it; `tutorialBeat` resolves that and the seen-list.
 *
 * `fight` is deliberately absent — mid-fight cues are FightScreen's, and a beat here would stack
 * a second dialogue box on top of one of them. Gated on `run.tutorial` rather than the act, so a
 * lesson Act 1 never reached (an Evolution nobody could afford) still lands the first time it
 * applies; every id is one-shot, so nothing repeats.
 */
function tutorialBeatKeyFor(screen: Screen, run: RunState): TutorialBeatKey | null {
  switch (screen.kind) {
    case 'draft':
      return 'intro';
    case 'actIntro':
      return run.actNumber === 1 ? 'arrival' : null;
    case 'map': {
      // The scripted act is a corridor, so "the node ahead" is a single node. A branching act
      // has nothing to name and returns null rather than picking one arbitrarily.
      const ahead = reachableNodeIds(run);
      const node = ahead.length === 1 ? run.map?.nodes[ahead[0]] : undefined;
      return node ? mapBeatKey(node.type) : null;
    }
    case 'gemChoice':
      return 'gem';
    case 'forceEquip':
      return 'equip';
    case 'levelUp':
      // The Evolution beat outranks the plain one: reaching a fork is the bigger lesson, and the
      // level-up basics have long since been spoken by the time one is affordable.
      return run.roster.some((entry) => availableEvolution(progressionTable, entry)) ? 'evolution' : 'levelUp';
    case 'reward':
      return rewardBeatKey(screen.nodeType);
    case 'classNode':
      return 'classNode';
    case 'recruit':
      return 'recruit';
    case 'shop':
      return 'shop';
    // The act has already ticked over to 2 by the time this screen shows, which is exactly the
    // beat the outro wants: the seal is filled and the scripted stretch is behind the player.
    case 'pactSeal':
      return 'outro';
    default:
      return null;
  }
}

export function App() {
  const [playerRun, setPlayerRun] = useState<RunState>(() => createRunState(0, 40));
  const [screen, setScreen] = useState<Screen>({ kind: 'title' });
  const shellRef = useRef<HTMLDivElement>(null);

  // Read once at boot. A save this build refuses (older version, content since removed) is
  // dropped rather than left to fail again, but the reason is kept so the title can say why
  // the run the player left is gone instead of silently not offering it. One state, not two,
  // so the read happens in a single lazy initializer.
  const [saveSlot, setSaveSlot] = useState<{ save: SavedRun | null; staleReason: string | null }>(() => {
    const result = readSave();
    if (!result) return { save: null, staleReason: null };
    if (result.ok) return { save: result.save, staleReason: null };
    clearSave();
    // The title says only that a save was cleared; the reason is for whoever is debugging it.
    console.warn(`Titanpact: refused a stored run — ${result.reason}`);
    return { save: null, staleReason: result.reason };
  });

  // Held only so the title and its Records screen can render it. Everything that WRITES the
  // profile goes straight to storage (profileStorage.updateProfile) — playtime flushes on a
  // timer, and putting that in React state would re-render the tree for a number nothing shows.
  const [profile, setProfile] = useState<Profile>(() => readProfile());

  /** The profile either side of the finished run, so the summary can show what the run added. */
  const [runOutcome, setRunOutcome] = useState<{ before: Profile; after: Profile } | null>(null);

  // Owned here rather than in SandboxBattleScreen, which unmounts during a sandbox fight.
  const [sandboxSideA, setSandboxSideA] = useState<SandboxSideConfig>(() => createEmptySandboxSide());
  const [sandboxSideB, setSandboxSideB] = useState<SandboxSideConfig>(() => createEmptySandboxSide());

  useEffect(() => {
    if (shellRef.current) return initUiScale(shellRef.current);
  }, []);

  // Title screen only. A checkpointed run now survives a reload, but everything between two
  // checkpoints does not, so a mid-fight reload would still cost the fight.
  useReloadOnNewBuild(screen.kind === 'title');

  // Autosave. An effect rather than a call inside each transition handler for two reasons:
  // it sees state that has actually committed (several handlers still read the pre-setState
  // `playerRun`), and one place cannot forget a path. Checkpoints only — see SaveCheckpoint.
  useEffect(() => {
    if (screen.kind !== 'map' && screen.kind !== 'actIntro') return;
    if (!playerRun.map) return;
    const save = writeSave(playerRun, screen.kind);
    setSaveSlot({ save, staleReason: null });
  }, [playerRun, screen]);

  usePlaytime();

  // Re-read on the way back to the title so Records and the Compendium show what the run
  // just banked. Nothing else in the app renders the profile, so nothing else needs this.
  useEffect(() => {
    if (screen.kind === 'title') setProfile(readProfile());
  }, [screen.kind]);

  // Monotonic in the profile, so an act reached and then abandoned still counts. Keyed on the
  // act alone, not the screen: this must not re-write storage at every screen change. A null
  // map is a run that never started (the title's placeholder, a Quick Battle's throwaway).
  useEffect(() => {
    if (!playerRun.map) return;
    updateProfile((current) => recordActReached(current, playerRun.actNumber));
  }, [playerRun.actNumber, playerRun.map]);

  // A finished run has nothing left to resume; the save would otherwise re-offer the map of a
  // run the player already lost or cleared. `playerRun` is final here: the handler that set this
  // screen committed the run in the same batch, so this render already has it — and it must be
  // read HERE rather than at the fight, because the recruit and level-up gates sit between the
  // last Guardian falling and this screen, and both can still change the roster.
  //
  // useLayoutEffect, not useEffect: the summary reads `runOutcome` to show what the run added to
  // the profile, and a post-paint effect would show the panel once without that block and then
  // reflow it in.
  useLayoutEffect(() => {
    if (screen.kind !== 'runFailed' && screen.kind !== 'runComplete') return;
    clearSave();
    setSaveSlot({ save: null, staleReason: null });
    const now = Date.now();
    const finalHeroIds = playerRun.roster.map((entry) => entry.heroId);
    const before = readProfile();
    const after = updateProfile((current) =>
      screen.kind === 'runComplete' ? recordRunCompleted(current, finalHeroIds, now) : recordRunFailed(current, now)
    );
    setRunOutcome({ before, after });
  }, [screen.kind]);

  function handleEraseAllData() {
    eraseAllData();
    setProfile(readProfile());
    setSaveSlot({ save: null, staleReason: null });
  }

  /** Abandon: the parked run is discarded, not just left behind. */
  function handleAbandonRun() {
    clearSave();
    setSaveSlot({ save: null, staleReason: null });
    setScreen({ kind: 'title' });
  }

  function handleContinueRun() {
    const parked = saveSlot.save;
    if (!parked) return;
    setPlayerRun(parked.run);
    setScreen({ kind: parked.checkpoint });
  }

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
    if (node.type === 'finale') {
      // Nothing is rolled here: the five broken seals in the order they were broken, at the
      // power they were beaten at, then the Endbringer (docs/lore.md §6).
      const encounter = generateFinaleEncounter(
        playerRun.brokenSeals,
        location.guardianFinalEnemyId ?? ENDBRINGER_ID,
        finaleEnemies,
        // Authored FOR act 6, so it takes no act steps — only the level, as its tier label.
        actScaling('monsters', FINALE_ACT, FINALE_ACT)
      );
      if (playerRun.roster.length <= 2) {
        handleSquadConfirmed(pickSquad(playerRun.roster, playerRun.roster.map((r) => r.rosterId), ROSTER_CAP), nodeId, 'boss', encounter);
      } else {
        setScreen({ kind: 'squadSelect', nodeId, nodeType: 'boss', encounter, squadSize: ROSTER_CAP });
      }
    } else if (
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
      // The scripted first act names its own enemies (docs/tutorial.md), so the fight is the one
      // Valor has just talked the player through. Null in every normal run and every later act.
      const scripted = tutorialEncounterFor(TUTORIAL_ENCOUNTERS, playerRun, node.type);
      let encounter: Encounter;
      if (node.type === 'battle' && !scripted) {
        encounter = generateLeaderEncounter(randomSeed(), faction.basicIds, faction.leaderId, enemies, scaling);
      } else {
        // A scripted monster fight draws from the whole faction table, not the basics: its roster
        // is named outright and may include a leader the basics list deliberately omits.
        const encounterPool = !isMobFight ? heroes : scripted ? enemies : basicEnemiesOf(faction);
        // A hero already on the roster is barred from the recruitable SPAWN, so two copies can never
        // reach one roster via a contract claim (mirrors rollGuildHallOffers).
        const excludeHeroIds = encounterPool === heroes ? playerRun.roster.map((r) => r.heroId) : undefined;
        const heroCountOverride = node.type === 'fight' ? 2 : isSecondFight ? 2 : undefined;
        const heroCount = heroCountOverride ?? (encounterKind === 'boss' ? 2 : 4);
        // Location affinity bias applies to the recruitable pool only (docs/locations.md §2).
        const bias = encounterPool === heroes ? locationBias(location, heroes, heroCount) : undefined;
        encounter = generateEncounter(encounterKind, randomSeed(), encounterPool, {
          forcedHeroIds: scripted?.heroIds,
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
        setScreen({ kind: 'squadSelect', nodeId, nodeType: encounterKind, encounter, squadSize: STANDARD_SQUAD_SIZE });
      }
    } else if (node.type === 'shop' || node.type === 'muster') {
      setScreen({
        kind: 'shop',
        nodeId,
        offers: rollGuildHallOffers(playerRun, guildHallOffers, EQUIPMENT_POOL, node.type === 'muster'),
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
    } else if (node.type === 'hpBoostReward') {
      setScreen({ kind: 'statBoost', nodeId, nodeType: node.type });
    } else if (node.type === 'gemReward' || node.type === 'manaBoostReward' || node.type === 'manaRegenBoostReward') {
      // The Gem Cache offers 1 of 3; the two stat shrines hand over the one Gem that carries their stat.
      const preset = GEM_NODE_PRESENTATION[node.type];
      const gemIds = node.type === 'gemReward' ? pickGemOffers() : [gemForStat[node.type === 'manaBoostReward' ? 'manaPool' : 'mpRegen'].id];
      setPlayerRun((run) => advanceToNode(run, nodeId));
      setScreen({ kind: 'gemChoice', gemIds, ...preset, next: mapAfterLevelUp(playerRun) });
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
    // The scripted act pays fixed figures instead of rolling: the tutorial has to arrive at its
    // Guardian with a specific amount of power, not a distribution of it (docs/tutorial.md).
    const payout = tutorialPayoutFor(TUTORIAL_PAYOUTS, playerRun, mapNodeType);
    setScreen({
      kind: 'fight',
      nodeId,
      nodeType,
      squad,
      encounter,
      goldReward: payout?.gold ?? goldRewardFor(mapNodeType),
      trainingPointsReward: payout?.xp ?? trainingPointsFor(mapNodeType, playerRun.actNumber),
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
    const mapNodeType = playerRun.map!.nodes[nodeId].type;
    const isGuardian = mapNodeType === 'boss';
    const isFinale = mapNodeType === 'finale';
    // EVERY Guardian pays a Banner now that the finale act follows act 5 — the reason act 5's
    // used to pay none (nothing left to spend it on) is void (docs/run-loop.md §4).
    const banner = isGuardian;

    let next = grantCurrencyReward(playerRun, goldReward);
    next = grantUpgradeReward(next, trainingPointsReward);
    next = advanceToNode(next, nodeId);
    // Every node kind, unlike `fightsStarted` — this one is the run summary's tally.
    next = { ...next, encountersWon: next.encountersWon + 1 };

    let afterScreen: Screen;
    if (isFinale) {
      afterScreen = { kind: 'runComplete' };
    } else if (isGuardian) {
      // Recorded on the Guardian falling, not on the run starting: a tutorial the player wiped
      // in is offered again (docs/tutorial.md). The rest of the run is a normal run either way.
      if (isTutorialAct(playerRun)) updateProfile(recordTutorialDone);
      next = grantContractReward(next, 1);
      // The seal, snapshotted at the power it was beaten at, so the finale can field it
      // again (docs/lore.md §6). The champion rides the Guardian's bench, so it is in the
      // defeated roster under its own id.
      const location = locationForAct(playerRun.locationIds, playerRun.actNumber);
      const champion = defeatedRoster.find((entry) => entry.rosterId === location.guardianFinalEnemyId);
      if (champion) {
        next = recordBrokenSeal(next, {
          actNumber: playerRun.actNumber,
          locationId: location.id,
          championId: champion.heroId,
          level: champion.level,
          statGrants: champion.evolutionStatGrants,
        });
      }
      if (next.actNumber < TOTAL_ACTS) {
        next = advanceToNextAct(next, randomSeed());
        // The seal grants nothing, so it goes last in the chain — the socket fills, then
        // you arrive somewhere new. The opposite of the Banner's placement, for the same reason.
        afterScreen = { kind: 'pactSeal' };
      } else {
        afterScreen = { kind: 'runComplete' };
      }
    } else {
      afterScreen = { kind: 'map' };
    }

    setPlayerRun(next);
    const afterLevelUp: Screen = levelUpPending(next) ? { kind: 'levelUp', next: afterScreen } : afterScreen;
    const afterEquip: Screen = equipmentReward ? { kind: 'forceEquip', queue: [equipmentReward.id], next: afterLevelUp } : afterLevelUp;

    // Gate order is deliberate: gem, banner, then recruit, then equip, then level-up — so a hero
    // recruited this beat already stands under both team-wide grants and can receive this win's
    // gear and points.
    // `next`, not `playerRun`: a boss node has just granted the contract that is spendable here.
    const contractOffers =
      next.recruitContracts > 0 ? pickContractOffers(defeatedRoster.filter((entry) => isRecruitable(entry.heroId, heroes))) : [];
    const afterRecruit: Screen = contractOffers.length > 0 ? { kind: 'recruit', offers: contractOffers, next: afterEquip } : afterEquip;
    const afterBanner: Screen = banner ? { kind: 'guardianBanner', next: afterRecruit } : afterRecruit;

    // The run's very first fight always pays a Gem; every other fight rolls for one (run/gems.ts).
    const isRunOpener = playerRun.actNumber === 1 && playerRun.map!.nodes[nodeId].row === 0;
    const gemIds = isFinale ? [] : rollGemOffers(mapNodeType as EncounterMapNodeType, isRunOpener);
    setScreen(
      gemIds.length > 0
        ? { kind: 'gemChoice', gemIds, eyebrow: 'Spoils', title: 'Gem Recovered', next: afterBanner }
        : afterBanner
    );
  }

  function handleNodeContinue(nodeId: string) {
    // The Vigil is the run's last node before the Titan, so a banked pool is re-offered
    // there or never — walking on clears the defer rather than honouring it.
    const unbank = playerRun.map?.nodes[nodeId]?.type === 'muster';
    setPlayerRun((run) => advanceToNode(unbank ? { ...run, levelUpDeferred: false } : run, nodeId));
    setScreen(mapAfterLevelUp(unbank ? { ...playerRun, levelUpDeferred: false } : playerRun));
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

  /** The title's replay entry (docs/tutorial.md); the profile is bypassed, not rewritten. */
  function handleReplayTutorial() {
    beginRun(true);
  }

  function handleStartNewRun() {
    beginRun(shouldPlayTutorial(profile));
  }

  function beginRun(tutorial: boolean) {
    const starterHeroIds = Object.values(heroes)
      .filter((hero) => hero.starter)
      .map((hero) => hero.id);
    // The scripted run draws no candidates: Valor and Fang are the pact, and the draft screen
    // is where Valor says so. The run itself is only built on confirm, so the flag has to be
    // parked on `playerRun` here for the intro beat to know it is a tutorial.
    const optionIds = tutorial ? [...TUTORIAL_STARTER_IDS] : generateStarterOptions(randomSeed(), starterHeroIds);
    setPlayerRun((run) => ({ ...run, tutorial, tutorialSeenBeatIds: [] }));
    setScreen({ kind: 'draft', optionIds });
  }

  function handleDraftConfirm(chosenIds: string[]) {
    setPlayerRun((run) => createStartingRun(chosenIds, run.tutorial, run.tutorialSeenBeatIds));
    setScreen({ kind: 'actIntro' });
    // Sealing the pact is the start, not pressing the title button: a draft backed out of
    // is not a run. An abandoned run still counts here — it was played.
    updateProfile((current) => recordRunStarted(current, Date.now()));
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
          profile={profile}
          onRefreshProfile={() => setProfile(readProfile())}
          onEraseAllData={handleEraseAllData}
          parkedRun={saveSlot.save ? saveSummary(saveSlot.save) : null}
          staleSaveReason={saveSlot.staleReason}
          onContinueRun={handleContinueRun}
          onStartRun={handleStartNewRun}
          onReplayTutorial={handleReplayTutorial}
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

      {screen.kind === 'pactSeal' && <PactSealScreen run={playerRun} onContinue={() => setScreen({ kind: 'actIntro' })} />}

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
          onSaveAndQuit={() => setScreen({ kind: 'title' })}
          onAbandonRun={handleAbandonRun}
        />
      )}

      {screen.kind === 'squadSelect' && (
        <SquadSelectScreen
          run={playerRun}
          encounter={screen.encounter}
          squadSize={screen.squadSize}
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
          onSaveAndQuit={() => setScreen({ kind: 'title' })}
          onAbandonRun={handleAbandonRun}
          tutorialNodeType={isTutorialAct(playerRun) ? playerRun.map!.nodes[screen.nodeId].type : undefined}
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
          muster={playerRun.map?.nodes[screen.nodeId]?.type === 'muster'}
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
          incomingEntry={
            screen.candidate.source === 'guildHall' ? guildHallEntry(playerRun, screen.candidate.offer, 'preview') : undefined
          }
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

      {screen.kind === 'gemChoice' && (
        <GemChoiceScreen
          gemIds={screen.gemIds}
          eyebrow={screen.eyebrow}
          title={screen.title}
          tint={screen.tint}
          run={playerRun}
          onRunChange={setPlayerRun}
          onContinue={() => setScreen(screen.next)}
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

      {/* `runOutcome` is set in the layout effect above, so it is already there on the first paint. */}
      {(screen.kind === 'runComplete' || screen.kind === 'runFailed') && runOutcome && (
        <RunSummaryScreen
          outcome={screen.kind === 'runComplete' ? 'win' : 'loss'}
          run={playerRun}
          profileBefore={runOutcome.before}
          profileAfter={runOutcome.after}
          onNewRun={handleStartNewRun}
          onReturnToTitle={() => setScreen({ kind: 'title' })}
        />
      )}

      {/* Valor, over whatever screen she is explaining. Last in the tree so it paints above
          everything; FightScreen mounts its own for the mid-fight cues. */}
      {(() => {
        const beat = tutorialBeat(TUTORIAL_SCRIPT, playerRun, tutorialBeatKeyFor(screen, playerRun));
        if (!beat) return null;
        return (
          <TutorialOverlay
            key={beat.id}
            beat={beat}
            onDone={() => setPlayerRun((run) => markTutorialBeatSeen(run, beat.id))}
          />
        );
      })()}
    </div>
    </LocationProvider>
  );
}
