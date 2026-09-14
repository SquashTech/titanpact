import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { initUiScale } from './uiScale';
import { useReloadOnNewBuild } from './useReloadOnNewBuild';
import { clearSave, readSave, writeSave } from './saveStorage';
import { eraseAllData, readProfile, updateProfile } from './profileStorage';
import { usePlaytime } from './usePlaytime';
import type { StatKey } from '../engine/content';
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
import { BoonNodeScreen } from '../view/run/BoonNodeScreen';
import { TutorNodeScreen } from '../view/run/TutorNodeScreen';
import { MentorNodeScreen } from '../view/run/MentorNodeScreen';
import { NodeRewardScreen, type RewardNodeType } from '../view/run/NodeRewardScreen';
import { ForgeScreen } from '../view/run/ForgeScreen';
import { IchorNodeScreen } from '../view/run/IchorNodeScreen';
import { ScrollNodeScreen, type ScrollPlan } from '../view/run/ScrollNodeScreen';
import { ManaWellScreen } from '../view/run/ManaWellScreen';
import { BlacksmithScreen } from '../view/run/BlacksmithScreen';
import { GuardianBannerScreen } from '../view/run/GuardianBannerScreen';
import { LevelUpScreen } from '../view/run/LevelUpScreen';
import { CrucibleScreen } from '../view/run/CrucibleScreen';
import { RosterReplaceScreen } from '../view/run/RosterReplaceScreen';
import { RecruitScreen } from '../view/run/RecruitScreen';
import { RecruitFanfare } from '../view/run/RecruitFanfare';
import { EventNodeScreen } from '../view/run/EventNodeScreen';
import { runEvents } from '../data/events';
import { rollRunEvent } from '../run/events';
import { SandboxBattleScreen } from '../view/run/SandboxBattleScreen';
import { RunSummaryScreen } from '../view/run/RunSummaryScreen';
import { heroes } from '../data/heroes';
import { moves } from '../data/moves';
import { allCombatants, rosterHeroes } from '../data/content';
import { CompanionScreen, type CompanionBeat } from '../view/run/CompanionScreen';
import { absorbCompanions, companionCandidate, companionJoinDue, joinCompanion } from '../run/companion';
import { koRosterIdsOf } from '../run/buildCombatState';
import { enemies, finaleEnemies, ENDBRINGER_ID } from '../data/enemies';
import { ActIntroScreen } from '../view/run/ActIntroScreen';
import { PactSealScreen } from '../view/run/PactSealScreen';
import { TitanWakeScreen } from '../view/run/TitanWakeScreen';
import { equipment, EQUIPMENT_DROP_POOL, rollEquipmentDrops } from '../data/equipment';
import {
  equipItem,
  pickWeightedEquipment,
  rarityWeightsFor,
  unseenCount,
  EQUIPMENT_DROP_CHANCE,
  LOOT_SOURCE,
  type EquipmentDefinition,
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
import { guildHallOffers, ICHOR_PURCHASE_COST, ICHOR_PURCHASE_LIMIT } from '../data/recruitment';
import { IchorError, buyIchor, canBuyIchor, grantIchor, type IchorKind } from '../run/ichor';
import { buyScroll, canBuyScroll } from '../run/mastery';
import { rollGuildHallOffers, buyEquipment, ShopError, type GuildHallOffers } from '../run/shop';
import { ConsumableError, buyConsumable, grantConsumable, rollConsumableDrop, spendConsumables, type ConsumableKind, type ConsumablePurse } from '../run/consumables';
import { guildHallEntry } from '../run/guildRecruit';
import { anyClassAvailable } from '../run/classes';
import { generateMap, type MapNodeType } from '../run/map';
import {
  generateTutorialMap,
  isTutorialAct,
  mapBeatKey,
  markTutorialBeatSeen,
  rewardBeatKey,
  tutorialBeat,
  tutorialContractOffers,
  tutorialEncounterFor,
  tutorialLockedActiveRosterIds,
  tutorialPayoutFor,
  TUTORIAL_STARTER_IDS,
  type TutorialBeatKey,
} from '../run/tutorial';
import { TUTORIAL_ENCOUNTERS, TUTORIAL_LOCKS, TUTORIAL_PAYOUTS, TUTORIAL_SCRIPT } from '../data/tutorial';
import { TutorialOverlay } from '../view/run/TutorialOverlay';
import { generateStarterOptions } from '../run/draft';
import {
  generateEncounter,
  generateFinaleEncounter,
  type EncounterNodeType,
  type Encounter,
} from '../run/enemyGen';
import { actScaling } from '../run/difficulty';
import { applyEncounterLevels, encounterXpKind, levelOf, xpForEncounter, xpForLevel, type HeroLevelUp } from '../run/growth';
import { generateItinerary, locationForAct } from '../run/locations';
import { encounterKindOf, nodeEncounter } from '../run/encounters';
import { ACT_ONE_LOCATION_ID, locations } from '../data/locations';
import { LocationProvider } from '../view/shared/LocationContext';
import { NODE_TINT_MANA, NODE_TINT_VITAL } from '../view/shared/NodeStage';
import { prefetchTrack, setTrack } from '../audio/music';
import { playSfx } from '../audio/sfx';
import { hasTrack } from '../audio/tracks';
import { pickSquad, STANDARD_SQUAD_SIZE } from '../run/squad';
import {
  reachableNodeIds,
  advanceToNode,
  advanceToNextAct,
  grantCurrencyReward,
  grantContractReward,
  stashItem,
  recordBrokenSeal,
  GOLD_REWARD_RANGE,
  rollGoldRange,
} from '../run/runProgress';
import { buildSandboxSide, createEmptySandboxSide, type SandboxSideConfig } from '../run/sandbox';
import { createStatusTestSides } from '../run/statusTestFight';
import { atEvolution, fullMovepool, pendingScheduleEntry } from '../run/progression';
import { progressionTable } from '../data/progression';
import type { RunState, RosterEntry } from '../run/state';
import type { Squad } from '../run/squad';

type Screen =
  | { kind: 'title' }
  | { kind: 'draft'; optionIds: string[] }
  /** The act-boundary beat: five sockets, one per Guardian (docs/run-loop.md §4). */
  | { kind: 'pactSeal' }
  /** Per-act arrival beat; reads its location off the run's itinerary. */
  | { kind: 'titanWake' }
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
      xpGained: number;
      /** Rolled at squad-confirm time so the victory screen can spotlight it; handleFightResolved reuses it. */
      equipmentReward: EquipmentDefinition | null;
      /** The potion drop, rolled and carried the same way. */
      consumableReward: ConsumableKind | null;
    }
  | { kind: 'quickBattle'; player: Encounter; ai: Encounter }
  | { kind: 'sandboxBattle' }
  | { kind: 'sandboxFight'; player: Encounter; ai: Encounter; playerRelics: string[] }
  /** TEMPORARY DEV/TEST — src/run/statusTestFight.ts. Own kind so leaving returns to the title. */
  | { kind: 'statusTestFight'; player: Encounter; ai: Encounter }
  /** `offers` and `soldOutEquipmentIds` live on the screen, not in the shop component: a purchase re-renders the shop and component-local state would reroll / forget. */
  | { kind: 'shop'; nodeId: string; offers: GuildHallOffers; soldOutEquipmentIds: string[]; ichorBought: number; scrollsBought: number }
  | { kind: 'reward'; nodeId: string; nodeType: RewardNodeType }
  /** The Forge: +1 item slot to one hero. */
  | { kind: 'forge'; nodeId: string }
  /** The Mana Well: +MANA_WELL_AMOUNT max Mana to one hero. */
  | { kind: 'manaWell'; nodeId: string }
  /**
   * Ichor: XP to one hero (run/ichor.ts). A map node (`nodeId`, free) or the Guild Hall shelf
   * (`cost`, `nodeId` null); the pick raises the level-up report and then `next`.
   */
  | { kind: 'ichor'; kindOfIchor: IchorKind; nodeId: string | null; cost: number; next: Screen }
  /**
   * Mastery Scrolls to whoever the player taps (run/mastery.ts, docs/mastery.md): the Scribe's
   * forced row and the Guild Hall shelf (`bought`, `nodeId` null, the gold already charged). The
   * Evolution the fifth pip raises is the screen's own; it walks the node when every pip is down.
   */
  | { kind: 'scrolls'; plan: ScrollPlan; nodeId: string | null; bought: boolean; next: Screen }
  | { kind: 'blacksmith'; nodeId: string }
  | { kind: 'boonNode'; nodeId: string }
  /** The Mentor (acts 1-3): pick a hero, and one Mid move is rolled for it. */
  | { kind: 'mentorNode'; nodeId: string }
  /** The Tutor (acts 4-5): pick a hero, then ANY move off its own pool. */
  | { kind: 'tutorNode'; nodeId: string }
  /** Which event this node is gets rolled ONCE at node-select time — the screen re-renders on every onRunChange. */
  | { kind: 'event'; nodeId: string; eventId: string }
  /** What the fight just did to the roster. First in the post-fight chain — it is the fight's own consequence. */
  | { kind: 'levelUp'; report: readonly HeroLevelUp[]; next: Screen }
  /** The companion's beats (run/companion.ts): the loss goes AHEAD of the level report; the join right after it; the tier-step is the report's own. */
  | { kind: 'companion'; beat: CompanionBeat; next: Screen }
  /** Guardian's Banner after a Guardian win in acts 1-4. Not a map node, so no nodeId. */
  | { kind: 'guardianBanner'; next: Screen }
  /** The Crucible: pick one hero, and that hero takes a Class. The Guardian's beat. */
  | { kind: 'crucible'; next: Screen }
  /** Roster-full replacement, Guild Hall path only; the contract path resolves in RecruitScreen. */
  | { kind: 'rosterReplace'; candidate: RosterReplaceCandidate; next: Screen }
  /** Offers sampled once in handleFightResolved; only pushed when the player holds a contract. */
  /** `required`: the scripted run's forced contract — the screen has no way out but signing (docs/tutorial.md). */
  | { kind: 'recruit'; offers: RosterEntry[]; next: Screen; required?: boolean }
  | { kind: 'runComplete' }
  | { kind: 'runFailed' };

/** Screens outside an act get no ambient Location (LocationContext). Listed as the exceptions so new node screens inherit the place by default. */
const PLACELESS_SCREENS: ReadonlySet<Screen['kind']> = new Set([
  'title',
  'draft',
  // Placeless is the point: it drops the title's track and leaves the cold open in silence,
  // and Act I's music then starts where it always does, on the arrival screen.
  'titanWake',
  // Between two acts, and the property of neither.
  'pactSeal',
  'quickBattle',
  'sandboxBattle',
  'sandboxFight',
  'statusTestFight',
  'runComplete',
  'runFailed',
]);

// The Guild Hall shelf and every drop roll the BASE pool; enchanted items are reached by
// rolling an enchant onto a drop, never by sitting in the pool (rollEquipmentDrops).
const EQUIPMENT_POOL = EQUIPMENT_DROP_POOL;

/** Throwaway (unseeded) seed for the entry-point rolls in this file. */
function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

function addHeroes(run: RunState, heroIds: readonly string[], level?: number): RunState {
  for (const heroId of heroIds) {
    const entry = createRosterEntry(heroId, heroId, heroes[heroId].moveIds);
    run = addRosterEntry(run, level === undefined ? entry : { ...entry, xp: xpForLevel(level) });
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
    ...addHeroes(createRunState(40), heroIds),
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
    ...addHeroes(createRunState(40), heroIds),
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

/** TEMPORARY DEV/TEST — a full roster with its first hero stood at its Evolution. Remove with its TitleScreen button. */
function createLevel4TestRun(): RunState {
  const base = addHeroes(createRunState(999), Object.keys(heroes).slice(0, ROSTER_CAP), 4);
  // Some worn, some carried: Manage Roster's gear half is only exercisable with both.
  const worn = ['sword.common', 'staff.common', 'sword.common.blazing'];
  return {
    ...base,
    roster: base.roster.map((entry, i) => {
      const geared = { ...entry, equipment: worn[i] ? equipItem(entry.equipment, worn[i]) : entry.equipment };
      // The first hero stands at its Evolution, so the next level-up report raises it.
      return i === 0 ? atEvolution(geared) : geared;
    }),
    // Two mergeable pairs: a plain one, and one where both halves are enchanted so the
    // keep-which-enchant choice has somewhere to fire.
    stash: ['dagger.common', 'dagger.common', 'bow.common', 'spear.rare.blazing', 'spear.rare.tidal'],
    map: generateMap(randomSeed()),
    locationIds: generateItinerary(randomSeed()),
  };
}

/** TEST FIXTURE — arms the scripted opener's Duskling with a Dagger so the equip-inspect UI has an item from turn one. */
function equipTestDagger(encounter: Encounter): Encounter {
  const roster = encounter.run.roster.map((entry) =>
    entry.heroId === 'duskling' ? { ...entry, equipment: equipItem(entry.equipment, equipment['dagger.common'].id) } : entry
  );
  return { ...encounter, run: { ...encounter.run, roster } };
}

/** Payouts key on the MAP node type: `skirmish` and `battle` both flatten to a `fight` encounter but sit in opposite reward lanes. */
type EncounterMapNodeType = 'fight' | 'skirmish' | 'battle' | 'elite' | 'boss' | 'finale';

// The bands live in runProgress.ts (GOLD_REWARD_RANGE) so the map's node readout prints the roll it describes.
function goldRewardFor(nodeType: EncounterMapNodeType): number {
  return rollGoldRange(GOLD_REWARD_RANGE[nodeType]);
}

function equipmentDropFor(nodeType: EncounterMapNodeType, actNumber: number): EquipmentDefinition | null {
  if (Math.random() >= EQUIPMENT_DROP_CHANCE[nodeType]) return null;
  const weights = rarityWeightsFor(actNumber, LOOT_SOURCE[nodeType]);
  return rollEquipmentDrops(1, weights)[0] ?? null;
}

/** The map, behind the level-up gate if anyone can afford one and the player has not banked the pool. */


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
      // Gear teaches itself here now that nothing stops the run to hand it over: the badge is
      // lit, and this is the screen carrying it. Ahead of the node beat on purpose — it explains
      // what just happened, and the node beat explains what is next.
      if (unseenCount(run.unseenItemIds, run.stash) > 0) return 'equip';
      // The scripted act is a corridor, so "the node ahead" is a single node. A branching act
      // has nothing to name and returns null rather than picking one arbitrarily.
      const ahead = reachableNodeIds(run);
      const node = ahead.length === 1 ? run.map?.nodes[ahead[0]] : undefined;
      return node ? mapBeatKey(node.type) : null;
    }
    case 'levelUp':
      return 'levelUp';
    case 'crucible':
      return 'crucible';
    case 'reward':
      return rewardBeatKey(screen.nodeType);
    case 'ichor':
      return screen.nodeId ? rewardBeatKey(screen.kindOfIchor === 'ichor' ? 'ichorReward' : 'ichorDropReward') : null;
    case 'mentorNode':
      return 'mentorNode';
    case 'scrolls':
      return screen.plan.kind === 'scribe' ? 'scribeNode' : null;
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
  const [playerRun, setPlayerRun] = useState<RunState>(() => createRunState(40));
  const [screen, setScreen] = useState<Screen>({ kind: 'title' });
  const shellRef = useRef<HTMLDivElement>(null);

  // A Guardian's fall bumps `actNumber` before its spoils are handed out, so between that win
  // and the arrival screen the run is standing in a place it has not travelled to yet. The
  // ambient Location — sky and music both — stays with the act just cleared until `enterAct`.
  const [actBreak, setActBreak] = useState(false);

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

  /** The joining cinematic for the one recruit path that resolves here: terminating a hero to make room. */
  const [recruitFanfare, setRecruitFanfare] = useState<{ heroId: string; source: 'contract' | 'guild' } | null>(null);

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
        // The SKIRMISH track, not a self-baselined monsters one (2026-09-10, Growth Overhaul
        // phase 6). `actScaling('monsters', FINALE_ACT, FINALE_ACT)` baselined the Endbringer
        // against its own act and so paid it ZERO steps — the run's final fight was the one
        // piece of content on the map that never scaled at all, and it measured 98% won.
        actScaling('skirmish', FINALE_ACT)
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
      // Built at node-select time so SquadSelectScreen can scout the enemy squad — from the same
      // deterministic draw the map's tile previewed (run/encounters.ts).
      const isMobFight = node.type === 'fight' || node.type === 'battle';
      const encounterKind = encounterKindOf(node.type);
      // The scripted first act names its own enemies (docs/tutorial.md), so the fight is the one
      // Valor has just talked the player through. Null in every normal run and every later act.
      const scripted = tutorialEncounterFor(TUTORIAL_ENCOUNTERS, playerRun, node.type);
      let encounter = nodeEncounter(node, {
        run: playerRun,
        location,
        heroes,
        allCombatants,
        enemies,
        progression: progressionTable,
        scripted,
      });
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
        ichorBought: 0,
        scrollsBought: 0,
      });
    } else if (node.type === 'forgeReward') {
      setScreen({ kind: 'forge', nodeId });
    } else if (node.type === 'manaWellReward') {
      setScreen({ kind: 'manaWell', nodeId });
    } else if (node.type === 'ichorReward' || node.type === 'ichorDropReward') {
      setScreen({ kind: 'ichor', kindOfIchor: node.type === 'ichorReward' ? 'ichor' : 'drop', nodeId, cost: 0, next: { kind: 'map' } });
    } else if (node.type === 'scribeReward') {
      setScreen({ kind: 'scrolls', plan: { kind: 'scribe' }, nodeId, bought: false, next: { kind: 'map' } });
    } else if (node.type === 'blacksmith') {
      setScreen({ kind: 'blacksmith', nodeId });
    } else if (node.type === 'mentorReward') {
      setScreen({ kind: 'mentorNode', nodeId });
    } else if (node.type === 'passiveReward') {
      setScreen({ kind: 'boonNode', nodeId });
    } else if (node.type === 'tutorReward') {
      setScreen({ kind: 'tutorNode', nodeId });
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
      // Read off the win this fight WILL be: the act's base is a function of encounters won and
      // the kind is the tile's, so the figure is known before the fight rather than rolled after it.
      xpGained: xpForEncounter(playerRun.encountersWon + 1, encounterXpKind(mapNodeType)),
      equipmentReward,
      consumableReward: rollConsumableDrop(mapNodeType),
    });
  }

  function handleFightResolved(
    nodeId: string,
    goldReward: number,
    equipmentReward: EquipmentDefinition | null,
    consumableReward: ConsumableKind | null,
    /** This fight's enemy side — the beaten builds a Recruit Contract can claim, and the Early that asks to join. */
    encounter: Encounter,
    outcome: 'win' | 'loss',
    /** What the fight drank; debited here, so a fight quit and replayed refunds it. */
    consumablesUsed: ConsumablePurse,
    /** The player's own KO'd roster ids at the end — what the companion's mortality reads. */
    koRosterIds: readonly string[] = []
  ) {
    if (outcome === 'loss') {
      setScreen({ kind: 'runFailed' });
      return;
    }
    const defeatedRoster = encounter.run.roster;
    const mapNodeType = playerRun.map!.nodes[nodeId].type;
    const isGuardian = mapNodeType === 'boss';
    const isFinale = mapNodeType === 'finale';
    // EVERY Guardian pays a Banner now that the finale act follows act 5 — the reason act 5's
    // used to pay none (nothing left to spend it on) is void (docs/run-loop.md §4).
    const banner = isGuardian;

    let next = grantCurrencyReward(spendConsumables(playerRun, consumablesUsed), goldReward);
    next = advanceToNode(next, nodeId);
    // Onto the purse, clamped at the cap — a full flask spills the drop rather than banking it.
    if (consumableReward) next = grantConsumable(next, consumableReward);
    // Every node kind, unlike `fightsStarted` — this one is the run summary's tally, and since
    // 2026-09-10 it is also what the level curve reads (run/growth.ts).
    next = { ...next, encountersWon: next.encountersWon + 1 };
    // A KO'd companion is gone from the run — BEFORE the level report, so the report never lists
    // a hero that is already gone (docs/titanspawn-overhaul.md §5). Its items are in the bag.
    const absorption = absorbCompanions(next, koRosterIds, equipment);
    next = absorption.run;
    // Automatic and roster-wide, benched heroes included: no pool and no allocation. The report
    // is what the screen after the fight reads — the roll is destructive, so it cannot be
    // recovered from the roster afterwards.
    const levelled = applyEncounterLevels(next, rosterHeroes, Math.random, encounterXpKind(mapNodeType));
    next = levelled.run;
    // The run's first fight is won: one of the Earlies it beat asks to come along, and it does.
    // Joined after the levels roll so the report is the fight's and the newcomer arrives at par.
    const companionId = companionJoinDue(playerRun, mapNodeType) ? companionCandidate(encounter) : null;
    if (companionId) next = joinCompanion(next, companionId, rosterHeroes);

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
          level: levelOf(champion),
          statGrants: champion.evolutionStatGrants,
        });
      }
      if (next.actNumber < TOTAL_ACTS) {
        next = advanceToNextAct(next, randomSeed());
        setActBreak(true);
        // The seal grants nothing, so it goes last in the chain — the socket fills, then
        // you arrive somewhere new. The opposite of the Banner's placement, for the same reason.
        afterScreen = { kind: 'pactSeal' };
      } else {
        afterScreen = { kind: 'runComplete' };
      }
    } else {
      afterScreen = { kind: 'map' };
    }

    // The drop is banked, not gated: it goes to the bag and the map's Roster badge says so
    // (docs/progression.md "The bag notification"). The victory overlay has already shown it.
    if (equipmentReward) next = stashItem(next, equipmentReward.id, equipment);

    setPlayerRun(next);

    // The Crucible is the GUARDIAN's beat, not every fight's (docs/growth-overhaul.md §5, §11): one
    // hero takes a Class, in the chain Guardian → Banner → Crucible → Pact Seal → act intro. Team,
    // hero, run — three scales ascending. Skipped when every hero already holds one.
    const crucible = isGuardian && anyClassAvailable(next.roster);
    const afterCrucible: Screen = crucible ? { kind: 'crucible', next: afterScreen } : afterScreen;

    // Gate order is deliberate: banner, then recruit, then the Crucible — so a hero recruited
    // this beat already stands under the Banner, and can walk into the Crucible itself.
    // `next`, not `playerRun`: a boss node has just granted the contract that is spendable here.
    const recruitable = defeatedRoster.filter((entry) => isRecruitable(entry.heroId, heroes));
    // The scripted act names its one contract and refuses to let it be walked past; a non-null
    // answer is both the offer list and the reason the screen has no leave button.
    const forcedOffers = tutorialContractOffers(TUTORIAL_LOCKS, next, recruitable);
    const contractOffers = next.recruitContracts > 0 ? (forcedOffers ?? pickContractOffers(recruitable)) : [];
    const afterRecruit: Screen =
      contractOffers.length > 0
        ? { kind: 'recruit', offers: contractOffers, next: afterCrucible, required: forcedOffers !== null }
        : afterCrucible;
    const afterBanner: Screen = banner ? { kind: 'guardianBanner', next: afterRecruit } : afterRecruit;

    // The join beat sits right after the level report: the fight's consequence, then who it brought.
    const afterLevels: Screen = companionId ? { kind: 'companion', beat: { kind: 'join', heroId: companionId }, next: afterBanner } : afterBanner;
    // Levels go FIRST, ahead of the Banner and everything under it: they are what this fight did,
    // and the rest of the chain is what the ACT pays. Skipped when nobody levelled and nobody is
    // owed a schedule entry — a fight the XP left part-way to the next level (the fight result
    // already showed the bars move), past the finale, a roster entirely at the cap. A raw hire
    // with a backlog still gets its one entry a fight, level or no level.
    const owed = levelled.run.roster.some((entry) => pendingScheduleEntry(rosterHeroes[entry.heroId], entry) !== null);
    const afterLoss: Screen = levelled.report.some((hero) => hero.toLevel > hero.fromLevel) || owed
      ? { kind: 'levelUp', report: levelled.report, next: afterLevels }
      : afterLevels;
    // And the companion's loss ahead of even that — the one thing the fight took (§5).
    setScreen(
      absorption.absorbed.reduce<Screen>(
        (rest, gone) => ({ kind: 'companion', beat: { kind: 'lost', heroId: gone.heroId, returnedItems: gone.equipment.length }, next: rest }),
        afterLoss
      )
    );
  }

  function handleNodeContinue(nodeId: string) {
    setPlayerRun((run) => advanceToNode(run, nodeId));
    setScreen({ kind: 'map' });
  }

  /** One bundle off the Guild Hall shelf; the visit's count rides the shop screen, as sold-out gear does. */
  function handleBuyGuildConsumable(kind: ConsumableKind) {
    let next: RunState;
    try {
      next = buyConsumable(playerRun, kind);
    } catch (err) {
      if (!(err instanceof ConsumableError)) throw err;
      return;
    }
    playSfx('gold.coin');
    setPlayerRun(next);
  }

  /** The shelf's Drop of Ichor: the tap opens the who screen, and the gold is charged on the pick. */
  function handleBuyGuildIchor() {
    if (screen.kind !== 'shop') return;
    if (!canBuyIchor(playerRun, ICHOR_PURCHASE_COST, screen.ichorBought, ICHOR_PURCHASE_LIMIT)) return;
    setScreen({
      kind: 'ichor',
      kindOfIchor: 'drop',
      nodeId: null,
      cost: ICHOR_PURCHASE_COST,
      next: { ...screen, ichorBought: screen.ichorBought + 1 },
    });
  }

  /** The shelf's Mastery Scroll: the gold is charged on the tap, and the who screen lands the pip. */
  function handleBuyGuildScroll() {
    if (screen.kind !== 'shop' || !canBuyScroll(playerRun, screen.scrollsBought)) return;
    setPlayerRun(buyScroll(playerRun, screen.scrollsBought));
    playSfx('gold.coin');
    setScreen({ kind: 'scrolls', plan: { kind: 'scrolls', count: 1 }, nodeId: null, bought: true, next: { ...screen, scrollsBought: screen.scrollsBought + 1 } });
  }

  /** The Ichor eaten: charge the shelf if it was bought, feed the hero, walk the node, and show the jump. */
  function handleIchorPick(rosterId: string) {
    if (screen.kind !== 'ichor') return;
    let next: RunState;
    try {
      next = screen.cost > 0 ? buyIchor(playerRun, screen.cost, 0, 1) : playerRun;
      const fed = grantIchor(next, rosterHeroes, rosterId, screen.kindOfIchor);
      next = screen.nodeId ? advanceToNode(fed.run, screen.nodeId) : fed.run;
      if (screen.cost > 0) playSfx('gold.coin');
      setPlayerRun(next);
      setScreen({ kind: 'levelUp', report: [fed.report], next: screen.next });
    } catch (err) {
      if (!(err instanceof IchorError)) throw err;
    }
  }

  /**
   * Claiming an item advances the node and banks the item. A list, because the Loot Pile event
   * hands over three at once — they all go to the bag, so there is nothing to queue a screen for.
   */
  function handleClaimEquipment(nodeId: string, itemIds: string | string[]) {
    const ids = (Array.isArray(itemIds) ? itemIds : [itemIds]).filter((id) => equipment[id]);
    setPlayerRun((run) => ids.reduce((acc, id) => stashItem(acc, id, equipment), advanceToNode(run, nodeId)));
    setScreen({ kind: 'map' });
  }

  /** Guild Hall purchase: validate-before-commit, then the item drops in the bag and the shop stays open. */
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
    setPlayerRun(stashItem(next, itemId, equipment));
    if (screen.kind === 'shop') setScreen({ ...screen, soldOutEquipmentIds: [...screen.soldOutEquipmentIds, itemId] });
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
    // The cold open goes here and not on the title's press for the same reason the run itself
    // is built here: binding is mutual (docs/lore.md §1), so the thing on the far end of the
    // leash notices when the pact is sealed, not when a menu is browsed.
    setScreen({ kind: 'titanWake' });
    // Sealing the pact is the start, not pressing the title button: a draft backed out of
    // is not a run. An abandoned run still counts here — it was played.
    updateProfile((current) => recordRunStarted(current, Date.now()));
  }

  /** TEMPORARY DEV/TEST — the Crucible sits behind a Guardian, which is three fights away. */
  function handleStartCrucibleTestRun() {
    setPlayerRun(createLevel4TestRun());
    setScreen({ kind: 'crucible', next: { kind: 'map' } });
  }

  /** TEMPORARY DEV/TEST — see createLevel4TestRun. */
  function handleStartLevel4TestRun() {
    setPlayerRun(createLevel4TestRun());
    setScreen({ kind: 'map' });
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
    enterAct();
  }

  /** The arrival screen — and the moment the act's music is allowed to start (see `trackId`). */
  function enterAct() {
    setActBreak(false);
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

  // Across an act break the place stays with the act just cleared: the Banner, the contract, the
  // Crucible and the spoils belong to the fight that paid them, and the next act's sky and music
  // are the arrival screen's to start (`enterAct`).
  const ambientLocation =
    PLACELESS_SCREENS.has(screen.kind) || playerRun.locationIds.length === 0
      ? null
      : locationForAct(playerRun.locationIds, actBreak ? playerRun.actNumber - 1 : playerRun.actNumber);

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
          onStartCrucibleTestRun={handleStartCrucibleTestRun}
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
          xpGained={0}
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
          xpGained={0}
          equipmentReward={null}
          onResolved={() => setScreen({ kind: 'title' })}
        />
      )}

      {screen.kind === 'draft' && <DraftScreen optionIds={screen.optionIds} onConfirm={handleDraftConfirm} />}

      {screen.kind === 'pactSeal' && <PactSealScreen run={playerRun} onContinue={enterAct} />}

      {screen.kind === 'titanWake' && <TitanWakeScreen onDone={enterAct} />}

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
          lockedActiveRosterIds={tutorialLockedActiveRosterIds(TUTORIAL_LOCKS, playerRun, playerRun.map!.nodes[screen.nodeId].type)}
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
          xpGained={screen.xpGained}
          equipmentReward={screen.equipmentReward}
          consumableReward={screen.consumableReward}
          onResolved={(outcome, finalState, consumablesUsed) =>
            handleFightResolved(
              screen.nodeId,
              screen.goldReward,
              screen.equipmentReward,
              screen.consumableReward,
              screen.encounter,
              outcome,
              consumablesUsed,
              koRosterIdsOf(finalState, 'A')
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
          xpGained={0}
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
          ichorBought={screen.ichorBought}
          scrollsBought={screen.scrollsBought}
          onRunChange={setPlayerRun}
          onBuyEquipment={handleBuyGuildEquipment}
          onBuyIchor={handleBuyGuildIchor}
          onBuyScroll={handleBuyGuildScroll}
          onBuyConsumable={handleBuyGuildConsumable}
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
          required={screen.required}
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
              setRecruitFanfare({
                heroId: candidate.offer.heroId,
                source: candidate.source === 'guildHall' ? 'guild' : 'contract',
              });
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

      {screen.kind === 'ichor' && (
        <IchorNodeScreen
          run={playerRun}
          kind={screen.kindOfIchor}
          bought={screen.cost > 0}
          onPick={handleIchorPick}
          onSkip={() => (screen.nodeId ? handleNodeContinue(screen.nodeId) : setScreen(screen.next))}
        />
      )}

      {screen.kind === 'scrolls' && (
        <ScrollNodeScreen
          run={playerRun}
          onRunChange={setPlayerRun}
          plan={screen.plan}
          bought={screen.bought}
          onDone={() => (screen.nodeId ? handleNodeContinue(screen.nodeId) : setScreen(screen.next))}
        />
      )}

      {screen.kind === 'manaWell' && (
        <ManaWellScreen run={playerRun} onRunChange={setPlayerRun} onContinue={() => handleNodeContinue(screen.nodeId)} />
      )}

      {screen.kind === 'forge' && (
        <ForgeScreen run={playerRun} onRunChange={setPlayerRun} onContinue={() => handleNodeContinue(screen.nodeId)} />
      )}

      {screen.kind === 'blacksmith' && (
        <BlacksmithScreen run={playerRun} onRunChange={setPlayerRun} onContinue={() => handleNodeContinue(screen.nodeId)} />
      )}

      {screen.kind === 'boonNode' && (
        <BoonNodeScreen run={playerRun} onRunChange={setPlayerRun} onContinue={() => handleNodeContinue(screen.nodeId)} />
      )}

      {screen.kind === 'tutorNode' && (
        <TutorNodeScreen run={playerRun} onRunChange={setPlayerRun} onContinue={() => handleNodeContinue(screen.nodeId)} />
      )}

      {screen.kind === 'mentorNode' && (
        <MentorNodeScreen run={playerRun} onRunChange={setPlayerRun} onContinue={() => handleNodeContinue(screen.nodeId)} />
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

      {screen.kind === 'levelUp' && (
        <LevelUpScreen run={playerRun} onRunChange={setPlayerRun} report={screen.report} onContinue={() => setScreen(screen.next)} />
      )}

      {screen.kind === 'companion' && <CompanionScreen run={playerRun} beat={screen.beat} onContinue={() => setScreen(screen.next)} />}

      {screen.kind === 'guardianBanner' && (
        <GuardianBannerScreen run={playerRun} onRunChange={setPlayerRun} onContinue={() => setScreen(screen.next)} />
      )}

      {screen.kind === 'crucible' && (
        <CrucibleScreen run={playerRun} onRunChange={setPlayerRun} onContinue={() => setScreen(screen.next)} />
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

      {recruitFanfare && (
        <RecruitFanfare
          heroId={recruitFanfare.heroId}
          source={recruitFanfare.source}
          onDone={() => setRecruitFanfare(null)}
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
