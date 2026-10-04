import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { initUiScale } from './uiScale';
import { allArtUrls, locationArtUrls, prefetchImages, preloadImages } from '../view/shared/preload';
import { useReloadOnNewBuild } from './useReloadOnNewBuild';
import { clearSave, flushSave, persistStorage, readResume, readSave, readSaveFromMirror, saveHealth, writeSave, type SaveHealth, type SaveRead } from './saveStorage';
import { eraseAllData, readProfile, updateProfile } from './profileStorage';
import { usePlaytime } from './usePlaytime';
import type { StatKey } from '../engine/content';
import { saveSummary, type SaveCheckpoint, type SavedRun } from '../run/save';
import { isResumable, resumeTarget, type CombatSnapshot, type ResumePayload, type RunScreen, type ScrollProgress } from '../run/resume';
import {
  companionTypeOf,
  isSpawnAscended,
  recordActReached,
  recordRunEnded,
  recordSpawnAscended,
  recordRunStarted,
  recordTipSeen,
  resetTips,
  type Profile,
  type RunEnd,
} from '../run/profile';
import { FightScreen } from '../view/combat/FightScreen';
import { TitleScreen } from '../view/run/TitleScreen';
import { LaunchScreen } from '../view/run/LaunchScreen';
import { DraftScreen } from '../view/run/DraftScreen';
import { MapScreen } from '../view/run/MapScreen';
import { ShopNodeScreen } from '../view/run/ShopNodeScreen';
import { BoonNodeScreen } from '../view/run/BoonNodeScreen';
import { TutorNodeScreen } from '../view/run/TutorNodeScreen';
import { MentorNodeScreen } from '../view/run/MentorNodeScreen';
import { NodeRewardScreen } from '../view/run/NodeRewardScreen';
import { ItemWhoScreen } from '../view/run/ItemWhoScreen';
import { clearGuildHallTab } from '../view/run/guildHallTabMemory';
import { ScrollNodeScreen } from '../view/run/ScrollNodeScreen';
import { ManaWellScreen } from '../view/run/ManaWellScreen';
import { BlessingShrineScreen } from '../view/run/BlessingShrineScreen';
import { ForgeNodeScreen } from '../view/run/ForgeNodeScreen';
import { LeyLineScreen } from '../view/run/LeyLineScreen';
import { RestNodeScreen } from '../view/run/RestNodeScreen';
import { GuardianBannerScreen } from '../view/run/GuardianBannerScreen';
import { LevelUpScreen } from '../view/run/LevelUpScreen';
import { levelPayoffOwed } from '../view/run/levelUpFlow';
import { CrucibleScreen } from '../view/run/CrucibleScreen';
import { RosterReplaceScreen } from '../view/run/RosterReplaceScreen';
import { RecruitScreen } from '../view/run/RecruitScreen';
import { RecruitFanfare } from '../view/run/RecruitFanfare';
import { EventNodeScreen } from '../view/run/EventNodeScreen';
import { runEvents } from '../data/events';
import { rollRunEvent } from '../run/events';
import { turnedCurse } from '../run/curse';
import { SandboxBattleScreen } from '../view/run/SandboxBattleScreen';
import { TrialsDevScreen } from '../view/run/TrialsDevScreen';
import { ChampionScreen } from '../view/run/ChampionScreen';
import { RunSummaryScreen } from '../view/run/RunSummaryScreen';
import { heroes } from '../data/heroes';
import { moves } from '../data/moves';
import { allCombatants, rosterHeroes } from '../data/content';
import { CompanionScreen } from '../view/run/CompanionScreen';
import { absorbCompanions, awakenCompanion, companionCandidate, companionJoinDue, companionToAwaken, joinCompanion } from '../run/companion';
import { fallenAfterFight, isPermadeath, openAscension } from '../run/ascension';
import { FallenScreen } from '../view/run/FallenScreen';
import type { CombatState } from '../engine/state';
import { koRosterIdsOf } from '../run/buildCombatState';
import { WoundsError, anyWounded, buyMend, mendPrice, recordWounds, mendRoster } from '../run/wounds';
import { entryHp } from '../view/shared/WoundBar';
import { enemies, finaleEnemies, ENDBRINGER_ID, MANTICORE_ID, titanEyes, EYE_PHASES } from '../data/enemies';
import { relics } from '../data/relics';
import { ActIntroScreen } from '../view/run/ActIntroScreen';
import { PactSealScreen } from '../view/run/PactSealScreen';
import { HeraldScreen } from '../view/run/HeraldScreen';
import { CompanionAwakensScreen } from '../view/run/CompanionAwakensScreen';
import { TitanBoundScreen } from '../view/run/TitanBoundScreen';
import { TitanWakeScreen } from '../view/run/TitanWakeScreen';
import { BlessingScreen } from '../view/run/BlessingScreen';
import { equipment, EQUIPMENT_DROP_POOL, rollEquipmentDrops } from '../data/equipment';
import {
  equipItem,
  pickWeightedEquipment,
  rarityWeightsFor,
  BASE_ITEM_SLOTS,
  EQUIPMENT_DROP_CHANCE,
  LOOT_SOURCE,
  type EquipmentDefinition,
} from '../run/equipment';
import { createRunState, createRosterEntry, addRosterEntry, FINALE_ACT, ROSTER_CAP, SEAL_ACTS, TOTAL_ACTS } from '../run/state';
import { blessOpeningPair } from '../run/blessings';
import {
  deriveContractOffer,
  claimContract,
  claimContractReplacing,
  recruitFromGuildHallReplacing,
  freshRosterId,
  heroPool,
  isRecruitable,
  pickContractOffers,
  RecruitmentError,
  type GuildHallOffer,
  type RosterReplaceCandidate,
} from '../run/recruitment';
import { guildHallOffersFor } from '../data/recruitment';
import { MASTERY_CAP, SCROLL_CACHE_COUNT, SCROLL_PACK_PIPS, buyScroll, canBuyScroll, canTakeMastery, grantMastery } from '../run/mastery';
import type { MvpPick } from '../run/mvp';
import { ShopItemError, TavernRerollError, buyShopItem, rerollGuildHallOffers, rollGuildHallOffers, type GuildHallOffers } from '../run/shop';
import { ConsumableError, buyConsumable, grantConsumable, rollConsumableDrop, spendConsumables, type ConsumableKind, type ConsumablePurse, type PotionKind } from '../run/consumables';
import { guildHallEntry } from '../run/guildRecruit';
import { anyClassAvailable } from '../run/classes';
import { generateMap, type MapNodeType } from '../run/map';
import { firstUnseenTip, LORE_TIP_ID, type ScreenTipId } from '../run/tips';
import { LORE_LINES, SCREEN_TIPS } from '../data/tips';
import { TipOverlay } from '../view/run/TipOverlay';
import { SaveTroubleBanner } from '../view/run/SaveTroubleBanner';
import { InstallOverlay } from '../view/run/InstallOverlay';
import { currentInstallPlatform } from './installPrompt';
import { INSTALL_TIP_ID } from '../run/installHint';
import { LoreScreen } from '../view/run/LoreScreen';
import { generateStarterOptions } from '../run/draft';
import { deckHeroIds, deckRows, encounterPools, profileDeck, type Deck } from '../run/deck';
import {
  generateEncounter,
  generateFinaleEncounter,

  type EncounterNodeType,
  type Encounter,
} from '../run/enemyGen';
import { CHAMPION_LEVEL_BONUS, encounterScaling, enemyLevelFor } from '../run/difficulty';
import { ENCOUNTERS_PER_ACT, MAX_LEVEL, applySeededEncounterLevels, encounterXpKind, levelOf, xpForEncounter, xpForLevel, type HeroLevelUp } from '../run/growth';
import { chooseLocation, drawLocationCandidates, generateItinerary, locationChoiceDue, locationForAct, locationPool } from '../run/locations';
import { encounterKindOf, encounterSeedFor, nodeEncounter } from '../run/encounters';
import { ACT_ONE_LOCATION_ID, locations } from '../data/locations';
import { LocationProvider } from '../view/shared/LocationContext';
import { LocationChoiceScreen } from '../view/run/LocationChoiceScreen';
import { ProfileProvider } from '../view/shared/ProfileContext';
import { starShopCatalog } from '../data/starShop';
import { buyOffer, canEnterRung, starBalance, starfall, type StarShopOffer } from '../run/starShop';
import { NODE_TINT_MANA, NODE_TINT_VITAL } from '../view/shared/NodeStage';
import { prefetchTrack, setTrack } from '../audio/music';
import { playSfx } from '../audio/sfx';
import { hasTrack } from '../audio/tracks';
import { openingSquad } from '../run/squad';
import {
  reachableNodeIds,
  advanceToNode,
  advanceToNextAct,
  grantCurrencyReward,
  grantContractReward,
  anyoneCanReceive,
  sellItem,
  recordBrokenSeal,
  grantRelicReward,
  goldRangeFor,
  rollGoldRange,
  recordPermanentStatGains,
} from '../run/runProgress';
import { buildSandboxSide, createEmptySandboxSide, type SandboxSideConfig } from '../run/sandbox';
import { constructedSide } from '../run/constructed';
import { constructedContent, trials } from '../data/trials';
import { createStatusTestSides } from '../run/statusTestFight';
import { atEvolution, currentEvolutionPathId, fullMovepool } from '../run/progression';
import { progressionTable } from '../data/progression';
import type { RunState, RosterEntry } from '../run/state';
import type { Squad } from '../run/squad';
import { statScaleFor } from '../run/statScale';
import { RoadGate } from '../view/run/RoadEncounter';
import { mapNodeArt, mapNodeAwakening } from '../view/run/mapNodeArt';

/** The screen machine (run/resume.ts), so a save can carry the screen it was written on. */
type Screen = RunScreen;

/** Screens outside an act get no ambient Location (LocationContext). Listed as the exceptions so new node screens inherit the place by default. */
const PLACELESS_SCREENS: ReadonlySet<Screen['kind']> = new Set([
  'title',
  'lore',
  'draft',
  // Placeless is the point: it drops the title's track and leaves the cold open in silence,
  // and Act I's music then starts where it always does, on the arrival screen.
  'titanWake',
  // Before the act: the stones where the road begins belong to no Location.
  'blessing',
  // Between two acts, and the property of neither.
  'pactSeal',
  // Each place on offer lights its own card; the sky behind them belongs to none of them.
  'locationChoice',

  // After the last fight: the Threshold's track drops and the binding plays in silence.
  'titanBound',
  'quickBattle',
  'sandboxBattle',
  'sandboxFight',
  'trialsDev',
  'trialsFight',
  'statusTestFight',
  'champions',
  'runComplete',
  'runFailed',
]);

/** What the title holds for a save read at boot. A refused save is dropped, but the reason is kept so the title can say why the run is gone. */
function slotFrom(result: SaveRead | null): { save: SavedRun | null; staleReason: string | null; recovered?: boolean } {
  if (!result) return { save: null, staleReason: null };
  if (result.ok) return { save: result.save, staleReason: null, ...(result.source !== 'main' ? { recovered: true } : {}) };
  clearSave();
  // The title says only that a save was cleared; the reason is for whoever is debugging it.
  console.warn(`Titanpact: refused a stored run — ${result.reason}`);
  return { save: null, staleReason: result.reason };
}

/** What the player is told when a save does not land whole: the fact, and that the run goes on. */
const SAVE_TROUBLE_LINES: Record<Exclude<SaveHealth, 'ok'>, string> = {
  checkpointOnly: 'This device is low on storage, so the run is only being saved on the map. It will save everywhere again once there is room.',
  failed: "Couldn't save — this device is out of storage space. Your run goes on, and it will save again once there is room.",
};

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
 * A fresh run from the drafted pair, standing at Wild's Edge; every act after opens on the
 * location choice (`enterAct`). A first run on an account is this run too — there is no tutorial
 * run, only first-time tips over an ordinary one (docs/tutorial.md).
 */
function createStartingRun(heroIds: readonly string[], ascension: number): RunState {
  return {
    ...blessOpeningPair(addHeroes(createRunState(40, 1, ascension), heroIds)),
    map: generateMap(randomSeed()),
    locationIds: [ACT_ONE_LOCATION_ID],
  };
}

/**
 * "Visit Location": a normal run whose Act 1 is the chosen place (breaking the Wild's-Edge-first
 * rule on purpose) with a random full roster at level 1. Wild's Edge is then on offer like any
 * other unvisited place, so the run still has a real choice every act.
 */
function createLocationVisitRun(locationId: string): RunState {
  const heroIds = shuffled(Object.keys(heroes)).slice(0, ROSTER_CAP);
  return {
    ...addHeroes(createRunState(40), heroIds),
    map: generateMap(randomSeed()),
    locationIds: [locationId],
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
  const worn = ['sword.common', 'staff.common', 'sword.common.blazing'];
  return {
    ...base,
    roster: base.roster.map((entry, i) => {
      const geared = { ...entry, equipment: worn[i] ? equipItem(entry.equipment, worn[i]) : entry.equipment };
      // The first hero stands at its Evolution, so the next level-up report raises it.
      return i === 0 ? atEvolution(geared) : geared;
    }),
    map: generateMap(randomSeed()),
    locationIds: generateItinerary(randomSeed()),
  };
}

/**
 * TEMPORARY DEV/TEST — the final battle, repeatedly (docs/titan-eyes.md §10): a finale-act run with
 * six random heroes at the cap, each FINISHED the way a contract hero is (its Evolution walked,
 * its signature in the kit — generateEncounter's own progression walk), wearing three items on
 * Act 5's elite curve in three distinct families, under five Banners, the Vigil already behind it
 * so the only node open is the Herald and the Eyes behind it. Remove with its TitleScreen row.
 */
function createTitanEyesTestRun(): RunState {
  const seed = randomSeed();
  // Two draws, since an encounter is sized by its node kind and a squad is validated at four.
  const scaling = { level: MAX_LEVEL, mastery: MASTERY_CAP };
  const four = generateEncounter('fight', seed, heroes, { heroCount: 4, scaling, progression: progressionTable });
  const two = generateEncounter('fight', seed + 1, heroes, { heroCount: 2, scaling, progression: progressionTable, excludeHeroIds: four.run.roster.map((r) => r.heroId) });
  const weights = rarityWeightsFor(SEAL_ACTS, 'elite');
  let run = createRunState(400);
  for (const entry of [...four.run.roster, ...two.run.roster]) {
    let loadout = entry.equipment;
    const families = new Set<string>();
    for (let tries = 0; families.size < BASE_ITEM_SLOTS && tries < 40; tries++) {
      const item = rollEquipmentDrops(1, weights)[0];
      const family = item.familyId ?? item.id;
      if (!item || families.has(family)) continue;
      families.add(family);
      loadout = equipItem(loadout, item.id);
    }
    run = addRosterEntry(run, { ...entry, equipment: loadout });
  }
  const locationIds = generateItinerary(seed);
  run = { ...run, actNumber: FINALE_ACT, map: generateMap(seed, FINALE_ACT), locationIds, encountersWon: SEAL_ACTS * ENCOUNTERS_PER_ACT };
  const bannerIds = Object.keys(relics);
  for (let act = 1; act <= SEAL_ACTS; act++) {
    const location = locationForAct(locationIds, act);
    const championId = location.guardianFinalEnemyId ?? MANTICORE_ID;
    run = recordBrokenSeal(run, { actNumber: act, locationId: location.id, championId, level: enemyLevelFor('boss', act) + CHAMPION_LEVEL_BONUS, statGrants: {}, growthStatGrants: {} });
    run = grantRelicReward(run, bannerIds[Math.floor(Math.random() * bannerIds.length)]);
  }
  // The corridor is Vigil → the final battle; stand past the Vigil so the fight is what is open.
  for (const row of run.map!.rows.slice(0, 1)) run = advanceToNode(run, row[0]);
  return run;
}

/** TEST FIXTURE — arms a Duskling in the run's opener with a Dagger so the equip-inspect UI has an item from turn one. */
function equipTestDagger(encounter: Encounter): Encounter {
  const roster = encounter.run.roster.map((entry) =>
    entry.heroId === 'duskling' ? { ...entry, equipment: equipItem(entry.equipment, equipment['dagger.common'].id) } : entry
  );
  return { ...encounter, run: { ...encounter.run, roster } };
}

/** How many who-screens still queue behind this one — a Loot Pile can hand over two of the same item, so the id alone is not a key. */
function whoScreensBehind(screen: Screen): number {
  let depth = 0;
  for (let cursor = screen; cursor.kind === 'itemWho'; cursor = cursor.next) depth += 1;
  return depth;
}

/** Payouts key on the MAP node type: `skirmish` and `battle` both flatten to a `fight` encounter but sit in opposite reward lanes. */
type EncounterMapNodeType = 'fight' | 'skirmish' | 'battle' | 'elite' | 'boss' | 'finale';

// The bands live in runProgress.ts (goldRangeFor) so the map's node readout prints the roll it describes.
function goldRewardFor(nodeType: EncounterMapNodeType, actNumber: number): number {
  return rollGoldRange(goldRangeFor(nodeType, actNumber));
}

function equipmentDropFor(nodeType: EncounterMapNodeType, actNumber: number): EquipmentDefinition | null {
  if (Math.random() >= EQUIPMENT_DROP_CHANCE[nodeType]) return null;
  const weights = rarityWeightsFor(actNumber, LOOT_SOURCE[nodeType]);
  return rollEquipmentDrops(1, weights)[0] ?? null;
}

/** The map, behind the level-up gate if anyone can afford one and the player has not banked the pool. */


/**
 * The first-time tips the current screen is the first meeting with, in priority order
 * (docs/tutorial.md); `firstUnseenTip` picks the first one the profile has not seen. Every id is
 * one-shot account-wide, so nothing repeats — and a tip whose moment a run never reached simply
 * waits for the run that does.
 *
 * `fight` is deliberately absent — mid-fight tips are FightScreen's, and one here would stack a
 * second card on top of one of them. So are the cinematic beats (the cold open, the Herald, the
 * Titan's fall), which explain themselves.
 */
function screenTipIds(screen: Screen, run: RunState): readonly ScreenTipId[] {
  switch (screen.kind) {
    case 'draft':
      return ['draft'];
    case 'actIntro':
      return ['run'];
    case 'map': {
      // The map tip waits for the first real choice: the act's opener is the only node on offer,
      // so "choose where to go next" would name a choice that is not there. A map after a fight is
      // where HP carrying over is first visible; the fork, the first time an Elite or Skirmish is
      // one step away.
      const reachable = reachableNodeIds(run);
      const ids: ScreenTipId[] = reachable.length > 1 ? ['map'] : [];
      // The opening pair's Blessing, on the first map it can be seen from.
      if (run.roster.some((entry) => entry.blessed)) ids.unshift('blessing');
      if (anyWounded(run)) ids.push('wounds');
      const ahead = reachable.map((id) => run.map?.nodes[id]?.type);
      if (ahead.includes('elite') || ahead.includes('skirmish')) ids.push('fork');
      return ids;
    }
    case 'itemWho':
      return ['item'];
    case 'fallen':
      return ['fallen'];
    case 'mentorNode':
      return []; // the screen's own line says it (2026-09-24, per user direction)
    case 'forge':
      return []; // the screen's own line says it (2026-09-24, per user direction)
    case 'scrolls':
      // A bought Scroll is the Guild Hall's, whose own tip has already named it.
      if (screen.bought) return [];
      // The Scribe or the Cache, whichever comes first, says how Scrolls work.
      return ['scribe'];
    case 'shop':
      return ['shop'];
    case 'recruit':
      return ['recruit'];
    case 'guardianBanner':
      return ['banner'];
    case 'crucible':
      return ['crucible'];
    case 'locationChoice':
      return ['locationChoice'];
    default:
      return [];
  }
}

export function App() {
  const [playerRun, setPlayerRun] = useState<RunState>(() => createRunState(40));
  const [screen, setScreen] = useState<Screen>({ kind: 'title' });
  // Read once: a device does not change platform mid-session, and installing reopens the game.
  const [installPlatform] = useState(currentInstallPlatform);
  const shellRef = useRef<HTMLDivElement>(null);

  // A Guardian's fall bumps `actNumber` before its spoils are handed out, so between that win
  // and the arrival screen the run is standing in a place it has not travelled to yet. The
  // ambient Location — sky and music both — stays with the act just cleared until `enterAct`.
  const [actBreak, setActBreak] = useState(false);

  // Read once at boot. A save this build refuses (older version, content since removed) is
  // dropped rather than left to fail again, but the reason is kept so the title can say why
  // the run the player left is gone instead of silently not offering it. One state, not two,
  // so the read happens in a single lazy initializer.
  const [saveSlot, setSaveSlot] = useState<{ save: SavedRun | null; staleReason: string | null; recovered?: boolean }>(() => slotFrom(readSave()));
  // localStorage came back empty — an evicted Home Screen app — so the IndexedDB mirror is asked.
  useEffect(() => {
    if (saveSlot.save || saveSlot.staleReason) return;
    let live = true;
    void readSaveFromMirror().then((result) => {
      if (live && result) setSaveSlot(slotFrom(result));
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Held so the title, its Records screen and the Constellation can render it, and so the Evolution
  // screen can mark the paths already starred (ProfileProvider). Stars only change at a run's end
  // and this is re-read on the way back to the title, so mid-run it is a snapshot, and current.
  // Everything that WRITES the profile goes straight to storage (profileStorage.updateProfile) —
  // playtime flushes on a timer, and putting that in React state would re-render the tree for a
  // number nothing shows.
  const [profile, setProfile] = useState<Profile>(() => readProfile());
  // The heroes a run draws from: its deck (run/deck.ts), fixed when the pact was sealed — the
  // fork's contracts, the Guild Hall and the enemy party all read this one table — and the
  // strangers a recruitable party may field past it. A run saved before decks reads every owned
  // hero (run/recruitment.ts heroPool) and fields no strangers.
  const ownedPool = useMemo(() => heroPool(heroes, profile.purchases), [profile.purchases]);
  const runPools = useMemo(() => encounterPools(playerRun, heroes, ownedPool), [playerRun.deck, ownedPool]);
  const recruitPool = runPools.heroes;
  // The cold launch's loading screen (LaunchScreen): `launched` mounts the title under it for its
  // fade, `launchDone` takes it down. Neither goes back to false this session.
  const [launched, setLaunched] = useState(false);
  const [launchDone, setLaunchDone] = useState(false);
  // Once the title is up, the rest of the game's larger art is fetched quietly (shared/preload.ts).
  useEffect(() => {
    if (launchDone) prefetchImages(allArtUrls());
  }, [launchDone]);

  /** The profile either side of the finished run, so the summary can show what the run added. */
  const [runOutcome, setRunOutcome] = useState<{ before: Profile; after: Profile } | null>(null);

  /** The joining cinematic for the one recruit path that resolves here: terminating a hero to make room. */
  const [recruitFanfare, setRecruitFanfare] = useState<{ heroId: string; source: 'contract' | 'guild' | 'event' } | null>(null);

  // Owned here rather than in SandboxBattleScreen, which unmounts during a sandbox fight.
  const [sandboxSideA, setSandboxSideA] = useState<SandboxSideConfig>(() => createEmptySandboxSide());
  const [sandboxSideB, setSandboxSideB] = useState<SandboxSideConfig>(() => createEmptySandboxSide());

  useEffect(() => {
    if (shellRef.current) return initUiScale(shellRef.current);
  }, []);

  // Every run screen is saved now, so a new build may reload anywhere but where it would cost a
  // moment the save does not hold: a fight's playback between command phases, and the Guild Hall's
  // open tab (docs/save-system.md §4).
  useReloadOnNewBuild(screen.kind === 'title' || (isResumable(screen.kind) && screen.kind !== 'fight' && screen.kind !== 'shop'));

  // The last map or act intro, which a save written anywhere else falls back to when its screen
  // cannot be restored. Null until the run has stood on one; the run's start falls back to its intro.
  const fallback = useRef<{ run: RunState; checkpoint: SaveCheckpoint } | null>(null);
  // The board the fight on screen last waited on, cleared when the screen moves off it.
  const combatSnapshot = useRef<{ screen: Screen; snapshot: CombatSnapshot } | null>(null);
  // How the last write went (saveStorage.ts). The banner says so once when it turns bad, and goes
  // when a write lands again; the map and fight menus keep a quiet mark while it stays bad.
  const [saveTrouble, setSaveTrouble] = useState<SaveHealth>('ok');
  const [saveTroubleSeen, setSaveTroubleSeen] = useState(false);
  /** A fight resumed from the save opens on this board, once. */
  const [resumedCombat, setResumedCombat] = useState<{ screen: Screen; snapshot: CombatSnapshot } | null>(null);

  /** Writes the run as it stands on `at`: a checkpoint is itself; anywhere else rides on the last one. */
  function persist(run: RunState, at: Screen) {
    if (!run.map || !isResumable(at.kind)) return;
    let save: SavedRun | null;
    if (at.kind === 'map' || at.kind === 'actIntro') {
      fallback.current = { run, checkpoint: at.kind };
      save = writeSave(run, at.kind);
    } else {
      const base = fallback.current ?? { run, checkpoint: 'actIntro' as const };
      const combat = at.kind === 'fight' && combatSnapshot.current?.screen === at ? combatSnapshot.current.snapshot : undefined;
      const resume: ResumePayload = { screen: at, ...(combat ? { combat } : {}), ...(actBreak ? { actBreak: true } : {}) };
      save = writeSave(run, base.checkpoint, { fallbackRun: base.run, resume });
    }
    if (save) setSaveSlot({ save, staleReason: null });
    const now = saveHealth();
    if (now === 'ok') setSaveTroubleSeen(false);
    setSaveTrouble(now);
  }

  // Autosave. An effect rather than a call inside each transition handler for two reasons:
  // it sees state that has actually committed (several handlers still read the pre-setState
  // `playerRun`), and one place cannot forget a path.
  useEffect(() => {
    if (combatSnapshot.current && combatSnapshot.current.screen !== screen) combatSnapshot.current = null;
    persist(playerRun, screen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerRun, screen]);

  // A write the OS interrupted, or one the quota refused, is tried again as the page goes away.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden') flushSave();
    };
    window.addEventListener('pagehide', flushSave);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('pagehide', flushSave);
      document.removeEventListener('visibilitychange', flush);
    };
  }, []);

  /** A fight's board waiting on the player: saved where it stands (D1 — the enemy's picks are seeded off it). */
  function handleCommandPhase(snapshot: CombatSnapshot) {
    if (screen.kind !== 'fight') return;
    combatSnapshot.current = { screen, snapshot };
    persist(playerRun, screen);
  }

  /** onRunChange for a screen that grants once: the grant marks it settled, so a resume goes past it (run/resume.ts). */
  function settlingRunChange(current: Screen) {
    return (next: RunState) => {
      setPlayerRun(next);
      setScreen((at) => (at === current ? ({ ...at, settled: true } as Screen) : at));
    };
  }

  usePlaytime();

  // Re-read on the way back to the title so Records and the Constellation show what the run
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
    const end: RunEnd = {
      outcome: screen.kind === 'runComplete' ? 'win' : 'loss',
      actReached: playerRun.actNumber,
      // The finale has no Location of its own (locationForAct falls back to Act 1's); the history reads the act instead.
      locationId: playerRun.actNumber <= SEAL_ACTS ? playerRun.locationIds[playerRun.actNumber - 1] ?? null : null,
      encountersWon: playerRun.encountersWon,
      ascension: playerRun.ascension,
      roster: playerRun.roster.map((entry) => ({
        heroId: entry.heroId,
        level: levelOf(entry),
        evolutionPathId: currentEvolutionPathId(entry),
        ...(turnedCurse(entry) ? { curseId: turnedCurse(entry)!.id } : {}),
      })),
    };
    const before = readProfile();
    const after = updateProfile((current) => recordRunEnded(current, end, now));
    setRunOutcome({ before, after });
  }, [screen.kind]);

  function handleEraseAllData() {
    eraseAllData();
    setProfile(readProfile());
    setSaveSlot({ save: null, staleReason: null });
    fallback.current = null;
  }

  /** A Constellation purchase (run/starShop.ts): written to storage, then the title re-reads it so the balance moves. */
  function handleBuyOffer(offer: StarShopOffer) {
    setProfile(updateProfile((current) => buyOffer(current, starShopCatalog, offer)));
  }

  /** A Starfall (docs/collection.md §4): written to storage like a purchase, the hero drawn handed back for the scene. */
  function handleStarfall(): string {
    let drawn = '';
    setProfile(
      updateProfile((current) => {
        const result = starfall(current, starShopCatalog, Math.random());
        drawn = result.heroId;
        return result.profile;
      })
    );
    return drawn;
  }

  /** TEMPORARY DEV/TEST — 50 stars on the bonus ledger, so the Constellation and the rung fees can be tried without clearing runs. */
  function handleGrantDevStars() {
    setProfile(updateProfile((current) => ({ ...current, bonusStars: current.bonusStars + 50 })));
  }

  /** The Collection's edit (docs/collection.md §2): the next run drafts from it and is sealed with it. */
  function handleChangeDeck(deck: Deck) {
    setProfile(updateProfile((current) => ({ ...current, deck: { ...deck } as Record<string, string[]> })));
  }

  /** Abandon: the parked run is discarded, not just left behind. */
  function handleAbandonRun() {
    clearSave();
    setSaveSlot({ save: null, staleReason: null });
    setScreen({ kind: 'title' });
  }

  /** The screen the save was written on, past anything it had already granted; else its checkpoint. */
  function handleContinueRun() {
    const parked = saveSlot.save;
    if (!parked) return;
    const checkpointRun = parked.fallbackRun ?? parked.run;
    fallback.current = { run: checkpointRun, checkpoint: parked.checkpoint };
    const resume = readResume(parked);
    if (!resume) {
      setPlayerRun(checkpointRun);
      setScreen({ kind: parked.checkpoint });
      return;
    }
    const target = resumeTarget(resume.screen, parked.run);
    setActBreak(resume.actBreak === true);
    if (target.screen === resume.screen && resume.combat) {
      setResumedCombat({ screen: target.screen, snapshot: resume.combat });
      combatSnapshot.current = { screen: target.screen, snapshot: resume.combat };
    }
    setPlayerRun(target.run);
    setScreen(target.screen);
  }

  function handleClaimContract(defeated: RosterEntry): boolean {
    if (!isRecruitable(defeated.heroId, recruitPool)) return false;
    if (playerRun.roster.length >= ROSTER_CAP) return false;
    if (playerRun.recruitContracts <= 0) return false;
    const offer = deriveContractOffer(defeated);
    const rosterId = freshRosterId(playerRun, defeated.heroId);
    setPlayerRun((run) => claimContract(run, offer, rosterId));
    recordClaim(defeated.rosterId);
    return true;
  }

  function recordClaim(offerRosterId: string) {
    setScreen((at) => (at.kind === 'recruit' ? { ...at, claimedRosterIds: [...(at.claimedRosterIds ?? []), offerRosterId] } : at));
  }

  function handleClaimContractReplace(defeated: RosterEntry, terminatedRosterId: string): boolean {
    if (!isRecruitable(defeated.heroId, recruitPool)) return false;
    if (playerRun.recruitContracts <= 0) return false;
    const offer = deriveContractOffer(defeated);
    const rosterId = freshRosterId(playerRun, defeated.heroId);
    setPlayerRun((run) => claimContractReplacing(run, offer, rosterId, terminatedRosterId));
    recordClaim(defeated.rosterId);
    return true;
  }

  function handleRequestRosterReplace(offer: GuildHallOffer) {
    setScreen({ kind: 'rosterReplace', candidate: { source: 'guildHall', offer }, next: screen });
  }

  function handleSelectNode(nodeId: string) {
    const node = playerRun.map!.nodes[nodeId];
    const location = locationForAct(playerRun.locationIds, playerRun.actNumber);
    if (node.type === 'finale') {
      // The Herald at the front, behind it what the five lands turned — one Late spawn per broken
      // seal, drawn from that seal's Location, every pip (docs/run-loop.md "The finale") — and
      // behind THAT, the Titan's Eyes, a phase a pair (docs/titan-eyes.md §10): one fight.
      const encounter = generateFinaleEncounter(
        playerRun.brokenSeals,
        location.guardianFinalEnemyId ?? ENDBRINGER_ID,
        finaleEnemies,
        encounterSeedFor(playerRun.map!, nodeId),
        encounterScaling('finale', FINALE_ACT),
        { spawnTypesFor: (locationId) => locations[locationId]?.spawnTypes ?? null, heraldLeads: true },
        { phases: EYE_PHASES, pool: titanEyes }
      );
      handleEnterFight(openingSquad(playerRun.roster), nodeId, 'boss', encounter);
    } else if (
      node.type === 'fight' ||
      node.type === 'skirmish' ||
      node.type === 'battle' ||
      node.type === 'elite' ||
      node.type === 'boss'
    ) {
      // The same deterministic draw the map's tile previewed (run/encounters.ts).
      const isMobFight = node.type === 'fight' || node.type === 'battle';
      const encounterKind = encounterKindOf(node.type);
      let encounter = nodeEncounter(node, {
        run: playerRun,
        location,
        heroes: recruitPool,
        strangers: runPools.strangers,
        allCombatants,
        enemies,
        progression: progressionTable,
      });
      const isFirstFight = encounterKind === 'fight' && playerRun.fightsStarted === 0;
      if (isMobFight && isFirstFight) {
        encounter = equipTestDagger(encounter);
      }
      if (encounterKind === 'fight') {
        setPlayerRun((run) => ({ ...run, fightsStarted: run.fightsStarted + 1 }));
      }
      // Leads are picked in the fight, once the enemy's are on the field (FightScreen's lead pick).
      handleEnterFight(openingSquad(playerRun.roster), nodeId, encounterKind, encounter);
    } else if (node.type === 'shop' || node.type === 'muster') {
      clearGuildHallTab();
      setScreen({
        kind: 'shop',
        nodeId,
        offers: rollGuildHallOffers(playerRun, guildHallOffersFor(recruitPool), node.type === 'muster'),
        scrollsBought: 0,
        revivesBought: 0,
        rerolls: 0,
        itemsBought: [],
      });
    } else if (node.type === 'manaWellReward') {
      setScreen({ kind: 'manaWell', nodeId });
    } else if (node.type === 'blessingReward') {
      setScreen({ kind: 'blessingShrine', nodeId });
    } else if (node.type === 'forgeReward') {
      setScreen({ kind: 'forge', nodeId });
    } else if (node.type === 'leyLineReward') {
      setScreen({ kind: 'leyLine', nodeId });
    } else if (node.type === 'restReward') {
      setScreen({ kind: 'rest', nodeId });
    } else if (node.type === 'scribeReward') {
      setScreen({ kind: 'scrolls', plan: { kind: 'scribe' }, nodeId, bought: false, next: { kind: 'map' } });
    } else if (node.type === 'scrollReward') {
      setScreen({ kind: 'scrolls', plan: { kind: 'scrolls', count: SCROLL_CACHE_COUNT }, nodeId, bought: false, next: { kind: 'map' } });
    } else if (node.type === 'mentorReward') {
      setScreen({ kind: 'mentorNode', nodeId, seed: randomSeed() });
    } else if (node.type === 'passiveReward') {
      setScreen({ kind: 'boonNode', nodeId, seed: randomSeed() });
    } else if (node.type === 'tutorReward') {
      setScreen({ kind: 'tutorNode', nodeId, seed: randomSeed() });
    } else if (node.type === 'event') {
      const rolled = rollRunEvent(runEvents, playerRun.actNumber, location.id);
      // Nothing eligible skips the node rather than stranding the player on an empty screen.
      if (rolled) setScreen({ kind: 'event', nodeId, eventId: rolled.id, seed: randomSeed() });
      else handleNodeContinue(nodeId);
    } else {
      setScreen({ kind: 'reward', nodeId, nodeType: node.type as 'currencyReward' | 'equipmentReward', seed: randomSeed() });
    }
  }

  function handleEnterFight(squad: Squad, nodeId: string, nodeType: EncounterNodeType, encounter: Encounter) {
    const mapNodeType = playerRun.map!.nodes[nodeId].type as EncounterMapNodeType;
    const equipmentReward = equipmentDropFor(mapNodeType, playerRun.actNumber);
    setResumedCombat(null);
    const fight: Screen = {
      kind: 'fight',
      nodeId,
      nodeType,
      squad,
      encounter,
      goldReward: goldRewardFor(mapNodeType, playerRun.actNumber),
      // Read off the win this fight WILL be: the act's base is a function of encounters won and
      // the kind is the tile's, so the figure is known before the fight rather than rolled after it.
      xpGained: xpForEncounter(playerRun.encountersWon + 1, encounterXpKind(mapNodeType)),
      equipmentRewardId: equipmentReward?.id ?? null,
      consumableReward: rollConsumableDrop(mapNodeType),
      levelSeed: randomSeed(),
    };
    // The Herald is announced before the fight — and a
    // companion brought this far answers it: it wakes to Ancient for the fight, and its line joins
    // Ancient on every run after (profile.ts `ascendedSpawnTypes`).
    const waking = mapNodeType === 'finale' ? companionToAwaken(playerRun) : null;
    if (waking) {
      setPlayerRun((run) => awakenCompanion(run));
      const type = companionTypeOf(waking.heroId);
      if (type) setProfile(updateProfile((current) => recordSpawnAscended(current, type)));
    }
    const afterHerald: Screen = waking ? { kind: 'companionAwakens', heroId: waking.heroId, next: fight } : fight;
    setScreen(mapNodeType === 'finale' ? { kind: 'herald', next: afterHerald } : fight);
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
    koRosterIds: readonly string[] = [],
    /** The fight's end state — what the roster's wounds are read off (run/wounds.ts). */
    finalState: CombatState | null = null,
    levelSeed: number = randomSeed(),
    /** The fight's MVP (run/mvp.ts), named on the victory screen: its free pip lands here. */
    mvp: MvpPick | null = null
  ) {
    setResumedCombat(null);
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
    // HP carries to the next node; the act's end is what makes the roster whole (run/wounds.ts).
    if (finalState) next = recordPermanentStatGains(recordWounds(next, finalState, 'A', rosterHeroes), finalState, 'A');
    // Onto the purse, clamped at the cap — a full flask spills the drop rather than banking it.
    if (consumableReward) next = grantConsumable(next, consumableReward);
    // Every node kind, unlike `fightsStarted` — this one is the run summary's tally, and since
    // 2026-09-10 it is also what the level curve reads (run/growth.ts).
    next = { ...next, encountersWon: next.encountersWon + 1 };
    // A KO'd companion is gone from the run — BEFORE the level report, so the report never lists
    // a hero that is already gone (docs/titanspawn-overhaul.md §5). Its gear goes with it.
    const absorption = absorbCompanions(next, koRosterIds);
    next = absorption.run;
    // The MVP's pip, before the levels: an Evolution it opens is raised by the level flow below.
    const mvpEntry = mvp ? next.roster.find((entry) => entry.rosterId === mvp.rosterId) : undefined;
    if (mvpEntry && canTakeMastery(mvpEntry)) next = { ...grantMastery(next, mvpEntry.rosterId, 1), lastMvpRosterId: mvpEntry.rosterId };
    // Automatic and roster-wide, benched heroes included: no pool and no allocation. The report
    // is what the screen after the fight reads — the roll is destructive, so it cannot be
    // recovered from the roster afterwards.
    const levelled = applySeededEncounterLevels(next, rosterHeroes, levelSeed, encounterXpKind(mapNodeType));
    next = levelled.run;
    // The run's first fight is won: one of the Earlies it beat asks to come along, and it does.
    // Joined after the levels roll so the report is the fight's and the newcomer arrives at par.
    const companionId = companionJoinDue(playerRun, mapNodeType) ? companionCandidate(encounter) : null;
    if (companionId) next = joinCompanion(next, companionId, rosterHeroes, Math.random, isSpawnAscended(readProfile(), companionTypeOf(companionId) ?? ''));

    let afterScreen: Screen;
    if (isFinale) {
      afterScreen = { kind: 'champions' };
    } else if (isGuardian) {
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
          growthStatGrants: champion.growthStatGrants,
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

    // A drop nobody can take converts to gold on the spot; the victory overlay has already shown it.
    const dropId = equipmentReward && anyoneCanReceive(next, equipmentReward, equipment, rosterHeroes) ? equipmentReward.id : null;
    if (equipmentReward && !dropId) next = sellItem(next, equipmentReward.id, equipment);

    setPlayerRun(next);

    // The Crucible is the GUARDIAN's beat, not every fight's (docs/growth-overhaul.md §5, §11): one
    // hero takes a Class, in the chain Guardian → Banner → Crucible → Pact Seal → act intro. Team,
    // hero, run — three scales ascending. Skipped when every hero already holds one.
    const crucible = isGuardian && anyClassAvailable(next.roster);
    const afterCrucible: Screen = crucible ? { kind: 'crucible', next: afterScreen, seed: randomSeed() } : afterScreen;

    // Gate order is deliberate: banner, then recruit, then the Crucible — so a hero recruited
    // this beat already stands under the Banner, and can walk into the Crucible itself.
    // `next`, not `playerRun`: a boss node has just granted the contract that is spendable here.
    const recruitable = defeatedRoster.filter((entry) => isRecruitable(entry.heroId, recruitPool));
    const contractOffers = next.recruitContracts > 0 ? pickContractOffers(recruitable) : [];
    const afterRecruit: Screen = contractOffers.length > 0 ? { kind: 'recruit', offers: contractOffers, next: afterCrucible } : afterCrucible;
    const afterBanner: Screen = banner ? { kind: 'guardianBanner', next: afterRecruit } : afterRecruit;

    // The drop asks who carries it right behind the levels — the fight's own consequence, ahead of
    // the Banner and everything under it (docs/gear-absorption.md §2).
    const afterDrop: Screen = dropId ? { kind: 'itemWho', itemId: dropId, next: afterBanner } : afterBanner;
    // The join beat sits between the level report and the drop: the run state already holds the
    // newcomer, so it must be met before the who-screen can offer it the item.
    const afterLevels: Screen = companionId ? { kind: 'companion', beat: { kind: 'join', heroId: companionId }, next: afterDrop } : afterDrop;
    // What the levels PAY goes first, ahead of the Banner and everything under it: they are what
    // this fight did, and the rest of the chain is what the ACT pays. The report itself lives on
    // the victory screen (FightResultOverlay, stat gains a tap away), so this beat only exists when
    // somebody is owed a move, a signature or an Evolution. A raw hire with a backlog still gets its
    // one entry a fight, level or no level.
    const afterLoss: Screen = levelled.run.roster.some((entry) => levelPayoffOwed(levelled.run, entry.rosterId))
      ? { kind: 'levelUp', report: levelled.report, next: afterLevels, seed: randomSeed() }
      : afterLevels;
    // And the companion's loss ahead of even that — the one thing the fight took (§5). Under
    // Permadeath the Fallen beat is that screen for everyone the fight knocked out (docs/ascension.md
    // §3): the KO'd stay on the roster, `down`, until it lets them go, so the level report that
    // follows reads the roster to know who is still there.
    const fallen = fallenAfterFight(next, koRosterIds);
    const chain: Screen =
      isPermadeath(next) && (fallen.length > 0 || absorption.absorbed.length > 0)
        ? { kind: 'fallen', rosterIds: fallen.map((entry) => entry.rosterId), companion: absorption.absorbed[0] ?? null, next: afterLoss }
        : absorption.absorbed.reduce<Screen>(
            (rest, gone) => ({ kind: 'companion', beat: { kind: 'lost', heroId: gone.heroId }, next: rest }),
            afterLoss
          );
    // The Eyes closing is the fight's own last beat, so the collapse and the binding go ahead of
    // even the level report: nothing the fight pays is worth seeing before the Titan is down.
    setScreen(isFinale ? { kind: 'titanBound', next: chain } : chain);
  }

  function handleNodeContinue(nodeId: string) {
    setPlayerRun((run) => advanceToNode(run, nodeId));
    setScreen({ kind: 'map' });
  }

  /** One off the Guild Hall shelf; the Revive's visit count rides the shop screen, as the Scrolls' does. */
  function handleBuyGuildConsumable(kind: ConsumableKind) {
    if (screen.kind !== 'shop') return;
    let next: RunState;
    try {
      next = buyConsumable(playerRun, kind, screen.revivesBought);
    } catch (err) {
      if (!(err instanceof ConsumableError)) throw err;
      return;
    }
    playSfx('gold.coin');
    setPlayerRun(next);
    if (kind === 'revive') setScreen({ ...screen, revivesBought: screen.revivesBought + 1 });
  }

  /** The Guild Hall's mend (run/wounds.ts): the whole roster whole, for what is missing. */
  function handleBuyGuildMend() {
    let next: RunState;
    try {
      next = buyMend(playerRun, mendPrice(playerRun, (entry) => entryHp(rosterHeroes[entry.heroId], entry, playerRun.relics).maxHp));
    } catch (err) {
      if (!(err instanceof WoundsError)) throw err;
      return;
    }
    playSfx('blessing');
    setPlayerRun(next);
  }

  /** The Tavern's reroll (run/shop.ts): a fresh shelf of hires, dearer each time a visit. */
  function handleRerollTavern() {
    // The Vigil has no hires to reroll.
    if (screen.kind !== 'shop' || playerRun.map?.nodes[screen.nodeId]?.type === 'muster') return;
    let rolled: ReturnType<typeof rerollGuildHallOffers>;
    try {
      rolled = rerollGuildHallOffers(playerRun, guildHallOffersFor(recruitPool), screen.offers, screen.rerolls);
    } catch (err) {
      if (!(err instanceof TavernRerollError)) throw err;
      return;
    }
    playSfx('gold.coin');
    setPlayerRun(rolled.run);
    setScreen({ ...screen, offers: rolled.offers, rerolls: screen.rerolls + 1 });
  }

  /** The shelf's Mastery Scroll: the gold is charged on the tap, and the who screen lands the pip. */
  function handleBuyGuildScroll() {
    if (screen.kind !== 'shop' || !canBuyScroll(playerRun, screen.scrollsBought)) return;
    setPlayerRun(buyScroll(playerRun, screen.scrollsBought));
    playSfx('gold.coin');
    setScreen({ kind: 'scrolls', plan: { kind: 'scrolls', count: SCROLL_PACK_PIPS }, nodeId: null, bought: true, next: { ...screen, scrollsBought: screen.scrollsBought + 1 } });
  }

  /** The Shop's gear shelf: the gold is charged on the confirm, and the who screen absorbs the piece. */
  function handleBuyGuildItem(slot: number) {
    if (screen.kind !== 'shop' || screen.itemsBought.includes(slot)) return;
    const item = equipment[screen.offers.itemIds[slot]];
    if (!item || !anyoneCanReceive(playerRun, item, equipment, rosterHeroes)) return;
    let next: RunState;
    try {
      next = buyShopItem(playerRun, item);
    } catch (err) {
      if (!(err instanceof ShopItemError)) throw err;
      return;
    }
    playSfx('gold.coin');
    setPlayerRun(next);
    setScreen({ kind: 'itemWho', itemId: item.id, next: { ...screen, itemsBought: [...screen.itemsBought, slot] } });
  }

  /**
   * Claiming an item advances the node, then asks who carries it — one who-screen per item, in
   * order, since the Loot Pile event hands over three at once. An item nobody can take is gold.
   * `base` is the run to advance from when the caller has just changed it (an event's cost).
   */
  function handleClaimEquipment(nodeId: string, itemIds: string | string[], base: RunState = playerRun) {
    const ids = (Array.isArray(itemIds) ? itemIds : [itemIds]).filter((id) => equipment[id]);
    const advanced = advanceToNode(base, nodeId);
    setPlayerRun(advanced);
    setScreen(whoScreensFor(advanced, ids, { kind: 'map' }));
  }

  /** Chains a who-screen per item ahead of `next`, selling on the spot whatever the roster cannot receive. */
  function whoScreensFor(run: RunState, itemIds: readonly string[], next: Screen): Screen {
    let settled = run;
    const asking: string[] = [];
    for (const id of itemIds) {
      const item = equipment[id];
      if (!item) continue;
      if (anyoneCanReceive(settled, item, equipment, rosterHeroes)) asking.push(id);
      else settled = sellItem(settled, id, equipment);
    }
    if (settled !== run) setPlayerRun(settled);
    return asking.reduceRight<Screen>((rest, id) => ({ kind: 'itemWho', itemId: id, next: rest }), next);
  }

  /** The title's Dev entry: every tip, and the lore card, shows again on its next occasion. */
  function handleResetTips() {
    setProfile(updateProfile(resetTips));
  }

  /** A tip or the lore card dismissed: account-wide, so it is written straight to storage. */
  function markTipSeen(id: string) {
    setProfile(updateProfile((current) => recordTipSeen(current, id)));
  }

  /** The rung rides `playerRun` across the draft; the run itself is only built on confirm. */
  function handleStartNewRun(ascension: number) {
    // One hero drawn from each deck row, then four of those shown (run/draft.ts).
    const optionIds = generateStarterOptions(randomSeed(), deckRows(profileDeck(profile, heroes)));
    setPlayerRun((run) => ({ ...run, ascension }));
    const draft: Screen = { kind: 'draft', optionIds };
    // The lore card once an account, ahead of the first draft — its last line is the draft's verb.
    setScreen(profile.seenTipIds.includes(LORE_TIP_ID) ? draft : { kind: 'lore', next: draft });
  }

  function handleDraftConfirm(chosenIds: string[]) {
    // The deck is snapshotted onto the run, so an edit between sessions never moves a run's pools.
    setPlayerRun((run) => ({ ...createStartingRun(chosenIds, run.ascension), deck: deckHeroIds(profileDeck(profile, heroes)) }));
    // The cold open goes here and not on the title's press for the same reason the run itself
    // is built here: binding is mutual (docs/lore.md §1), so the thing on the far end of the
    // leash notices when the pact is sealed, not when a menu is browsed.
    setScreen({ kind: 'titanWake' });
    fallback.current = null;
    persistStorage();
    // Sealing the pact is the start, not pressing the title button: a draft backed out of
    // is not a run. An abandoned run still counts here — it was played.
    // The rung's entry fee is spent here, with the seal (docs/collection.md §5).
    const rung = playerRun.ascension;
    updateProfile((current) => recordRunStarted(current, Date.now(), rung, starBalance(current, starShopCatalog)));
  }

  /** TEMPORARY DEV/TEST — the Crucible sits behind a Guardian, which is three fights away. */
  function handleStartCrucibleTestRun() {
    fallback.current = null;
    setPlayerRun(createLevel4TestRun());
    setScreen({ kind: 'crucible', next: { kind: 'map' }, seed: randomSeed() });
  }

  /** TEMPORARY DEV/TEST — see createTitanEyesTestRun. */
  function handleStartTitanEyesTestRun() {
    fallback.current = null;
    setPlayerRun(createTitanEyesTestRun());
    setScreen({ kind: 'map' });
  }

  /** TEMPORARY DEV/TEST — see createLevel4TestRun. */
  function handleStartLevel4TestRun() {
    fallback.current = null;
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
    fallback.current = null;
    setPlayerRun(createLocationVisitRun(locationId));
    enterAct();
  }

  /** The arrival screen — and the moment the act's music is allowed to start (see `trackId`). */
  /**
   * The seal is behind the player; the next act opens on where to go, then on arriving there.
   * The offer is drawn here, once — a run never knows its next place before this beat. One
   * candidate is no choice, so it is taken silently and the arrival screen says where.
   */
  function enterAct() {
    setActBreak(false);
    if (locationChoiceDue(playerRun)) {
      // The pool is the profile's: a Location bought at the Constellation is drawn beside the base five.
      const pool = locationPool(profile.purchases);
      const candidateIds = drawLocationCandidates(playerRun.locationIds, randomSeed(), pool);
      // Whichever is taken, its arrival screen is next: fetch both places' paintings now.
      void preloadImages(locationArtUrls(candidateIds));
      if (candidateIds.length > 1) {
        setScreen({ kind: 'locationChoice', candidateIds });
        return;
      }
      if (candidateIds.length === 1) setPlayerRun(chooseLocation(playerRun, candidateIds[0], pool));
    }
    setScreen({ kind: 'actIntro' });
  }

  function handleLocationChosen(locationId: string) {
    setPlayerRun(chooseLocation(playerRun, locationId, locationPool(profile.purchases)));
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

  // A run never knows its next place before the choice, so the tracks warmed are the offer's:
  // both candidates while the player weighs them, so the one picked doesn't arrive in silence
  // through a multi-megabyte download. From the title the next thing needed is Act 1's, always
  // the same place.
  const nextLocationIds = screen.kind === 'title' ? [ACT_ONE_LOCATION_ID] : screen.kind === 'locationChoice' ? screen.candidateIds : [];
  const nextLocationKey = nextLocationIds.join(',');
  useEffect(() => {
    for (const id of nextLocationKey.split(',')) if (hasTrack(id)) prefetchTrack(id);
  }, [nextLocationKey]);

  return (
    <LocationProvider location={ambientLocation}>
    <ProfileProvider profile={profile}>
    <div className="app-shell" ref={shellRef}>
      {screen.kind === 'title' && launched && (
        <TitleScreen
          profile={profile}
          onRefreshProfile={() => setProfile(readProfile())}
          onEraseAllData={handleEraseAllData}
          onBuyOffer={handleBuyOffer}
          onStarfall={handleStarfall}
          onChangeDeck={handleChangeDeck}
          parkedRun={saveSlot.save ? saveSummary(saveSlot.save) : null}
          staleSaveReason={saveSlot.staleReason}
          saveNotice={
            saveSlot.recovered
              ? "The last save was cut off, so the run was restored from the one before it."
              : saveSlot.save && saveTrouble !== 'ok'
                ? SAVE_TROUBLE_LINES[saveTrouble]
                : null
          }
          onContinueRun={handleContinueRun}
          onStartRun={handleStartNewRun}
          openAscension={openAscension(profile)}
          onResetTips={handleResetTips}
          onGrantDevStars={handleGrantDevStars}
          onQuickBattle={handleQuickBattle}
          onOpenSandbox={handleOpenSandbox}
          onOpenTrials={() => setScreen({ kind: 'trialsDev' })}
          onVisitLocation={handleVisitLocation}
          onStartLevel4TestRun={handleStartLevel4TestRun}
          onStartCrucibleTestRun={handleStartCrucibleTestRun}
          onStartStatusTestFight={handleStatusTestFight}
          onStartTitanEyesTestRun={handleStartTitanEyesTestRun}
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

      {screen.kind === 'trialsDev' && (
        <TrialsDevScreen
          onFight={(playerTrialId, opponentTrialId) => {
            const opponent = trials[opponentTrialId];
            setScreen({
              kind: 'trialsFight',
              player: constructedSide(constructedContent, trials[playerTrialId].team),
              ai: constructedSide(constructedContent, opponent.team, opponent.leads),
            });
          }}
          onClose={() => setScreen({ kind: 'title' })}
        />
      )}

      {screen.kind === 'trialsFight' && (
        <FightScreen
          playerRun={screen.player.run}
          playerSquad={screen.player.squad}
          aiRun={screen.ai.run}
          aiSquad={screen.ai.squad}
          goldReward={0}
          xpGained={0}
          equipmentReward={null}
          onResolved={() => setScreen({ kind: 'trialsDev' })}
          aiPilot
          onExitToTitle={() => setScreen({ kind: 'trialsDev' })}
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

      {screen.kind === 'lore' && (
        <LoreScreen
          lines={LORE_LINES}
          onDone={() => {
            markTipSeen(LORE_TIP_ID);
            setScreen(screen.next);
          }}
        />
      )}

      {screen.kind === 'draft' && <DraftScreen optionIds={screen.optionIds} onConfirm={handleDraftConfirm} />}

      {screen.kind === 'pactSeal' && (
        <PactSealScreen run={playerRun} onContinue={enterAct} />
      )}

      {screen.kind === 'titanWake' && <TitanWakeScreen onDone={() => setScreen({ kind: 'blessing' })} />}

      {screen.kind === 'blessing' && <BlessingScreen run={playerRun} onDone={enterAct} />}

      {screen.kind === 'locationChoice' && (
        <LocationChoiceScreen run={playerRun} candidateIds={screen.candidateIds} onChoose={handleLocationChosen} />
      )}

      {screen.kind === 'herald' && <HeraldScreen onContinue={() => setScreen(screen.next)} />}

      {screen.kind === 'companionAwakens' && <CompanionAwakensScreen heroId={screen.heroId} onContinue={() => setScreen(screen.next)} />}

      {screen.kind === 'titanBound' && <TitanBoundScreen onContinue={() => setScreen(screen.next)} />}

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
          saveTrouble={saveTrouble === 'ok' ? null : SAVE_TROUBLE_LINES[saveTrouble]}
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
          levelSeed={screen.levelSeed}
          equipmentReward={screen.equipmentRewardId ? equipment[screen.equipmentRewardId] ?? null : null}
          consumableReward={screen.consumableReward}
          initialSnapshot={resumedCombat?.screen === screen ? resumedCombat.snapshot : undefined}
          onCommandPhase={handleCommandPhase}
          onResolved={(outcome, finalState, consumablesUsed, mvp) =>
            handleFightResolved(
              screen.nodeId,
              screen.goldReward,
              screen.equipmentRewardId ? equipment[screen.equipmentRewardId] ?? null : null,
              screen.consumableReward,
              screen.encounter,
              outcome,
              consumablesUsed,
              koRosterIdsOf(finalState, 'A'),
              finalState,
              screen.levelSeed,
              mvp
            )
          }
          mvpRules={
            playerRun.map!.nodes[screen.nodeId].type === 'finale'
              ? undefined
              : {
                  ineligible: new Set(playerRun.roster.filter((entry) => entry.mastery >= MASTERY_CAP).map((entry) => entry.rosterId)),
                  lastMvpRosterId: playerRun.lastMvpRosterId ?? undefined,
                }
          }
          onSaveAndQuit={() => setScreen({ kind: 'title' })}
          onAbandonRun={handleAbandonRun}
          saveTrouble={saveTrouble === 'ok' ? null : SAVE_TROUBLE_LINES[saveTrouble]}
          tips={{ nodeType: playerRun.map!.nodes[screen.nodeId].type, seenIds: profile.seenTipIds, onSeen: markTipSeen }}
          cinematicWin={playerRun.map!.nodes[screen.nodeId].type === 'finale'}
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
          scrollsBought={screen.scrollsBought}
          revivesBought={screen.revivesBought}
          rerolls={screen.rerolls}
          itemsBought={screen.itemsBought}
          onRunChange={setPlayerRun}
          onBuyScroll={handleBuyGuildScroll}
          onBuyItem={handleBuyGuildItem}
          onReroll={handleRerollTavern}
          onBuyConsumable={handleBuyGuildConsumable}
          onBuyMend={handleBuyGuildMend}
          onRequestRosterReplace={handleRequestRosterReplace}
          onContinue={() => handleNodeContinue(screen.nodeId)}
          muster={playerRun.map?.nodes[screen.nodeId]?.type === 'muster'}
        />
      )}

      {screen.kind === 'recruit' && (
        <RecruitScreen
          run={playerRun}
          offers={screen.offers}
          claimedRosterIds={screen.claimedRosterIds}
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
          scale={statScaleFor(playerRun)}
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
          onRunChange={settlingRunChange(screen)}
          onContinue={() => handleNodeContinue(screen.nodeId)}
          onClaimEquipment={(itemId) => handleClaimEquipment(screen.nodeId, itemId)}
          seed={screen.seed}
        />
      )}

      {screen.kind === 'scrolls' && (
        <ScrollNodeScreen
          run={playerRun}
          onRunChange={setPlayerRun}
          plan={screen.plan}
          bought={screen.bought}
          onDone={() => (screen.nodeId ? handleNodeContinue(screen.nodeId) : setScreen(screen.next))}
          progress={screen.progress}
          onProgress={(progress: ScrollProgress) => setScreen((at) => (at.kind === 'scrolls' ? { ...at, progress } : at))}
        />
      )}

      {screen.kind === 'manaWell' && (
        <ManaWellScreen run={playerRun} onRunChange={settlingRunChange(screen)} onContinue={() => handleNodeContinue(screen.nodeId)} />
      )}

      {screen.kind === 'blessingShrine' && (
        <BlessingShrineScreen run={playerRun} onRunChange={settlingRunChange(screen)} onContinue={() => handleNodeContinue(screen.nodeId)} />
      )}

      {screen.kind === 'forge' && (
        <ForgeNodeScreen run={playerRun} onRunChange={settlingRunChange(screen)} onContinue={() => handleNodeContinue(screen.nodeId)} />
      )}

      {screen.kind === 'leyLine' && (
        <LeyLineScreen run={playerRun} onRunChange={settlingRunChange(screen)} onContinue={() => handleNodeContinue(screen.nodeId)} />
      )}

      {screen.kind === 'rest' && (
        <RestNodeScreen run={playerRun} onRunChange={settlingRunChange(screen)} onContinue={() => handleNodeContinue(screen.nodeId)} />
      )}

      {screen.kind === 'itemWho' && (
        <ItemWhoScreen key={`${screen.itemId}:${whoScreensBehind(screen.next)}`} run={playerRun} itemId={screen.itemId} onRunChange={settlingRunChange(screen)} onDone={() => setScreen(screen.next)} />
      )}


      {screen.kind === 'boonNode' && (
        <BoonNodeScreen run={playerRun} onRunChange={settlingRunChange(screen)} onContinue={() => handleNodeContinue(screen.nodeId)} seed={screen.seed} />
      )}

      {screen.kind === 'tutorNode' && (
        <TutorNodeScreen run={playerRun} onRunChange={settlingRunChange(screen)} onContinue={() => handleNodeContinue(screen.nodeId)} seed={screen.seed} />
      )}

      {screen.kind === 'mentorNode' && (
        <MentorNodeScreen run={playerRun} onRunChange={settlingRunChange(screen)} onContinue={() => handleNodeContinue(screen.nodeId)} seed={screen.seed} />
      )}

      {screen.kind === 'event' &&
        runEvents[screen.eventId] &&
        (() => {
          const { nodeId, eventId, seed } = screen;
          const onEventRunChange = settlingRunChange(screen);
          return (
            <RoadGate run={playerRun} place art={mapNodeArt('event')!} awakened={mapNodeAwakening('event')} name={runEvents[eventId].name} lines={[runEvents[eventId].flavor]}>
              <EventNodeScreen
                event={runEvents[eventId]}
                run={playerRun}
                onRunChange={onEventRunChange}
                seed={seed}
                onGrantEquipment={(itemIds, base) => handleClaimEquipment(nodeId, itemIds, base)}
                onRecruited={(heroId) => setRecruitFanfare({ heroId, source: 'event' })}
                onContinue={() => handleNodeContinue(nodeId)}
              />
            </RoadGate>
          );
        })()}

      {screen.kind === 'levelUp' && (
        <LevelUpScreen
          run={playerRun}
          onRunChange={setPlayerRun}
          report={screen.report.filter((hero) => playerRun.roster.some((entry) => entry.rosterId === hero.rosterId))}
          onContinue={() => setScreen(screen.next)}
          memory={{
            seed: screen.seed,
            taken: screen.taken ?? [],
            onTaken: (taken) => setScreen((at) => (at.kind === 'levelUp' ? { ...at, taken } : at)),
          }}
        />
      )}

      {screen.kind === 'fallen' && (
        <FallenScreen run={playerRun} rosterIds={screen.rosterIds} companion={screen.companion} onRunChange={setPlayerRun} onContinue={() => setScreen(screen.next)} />
      )}

      {screen.kind === 'companion' && <CompanionScreen run={playerRun} beat={screen.beat} onContinue={() => setScreen(screen.next)} />}

      {screen.kind === 'guardianBanner' && (
        <GuardianBannerScreen run={playerRun} onRunChange={settlingRunChange(screen)} onContinue={() => setScreen(screen.next)} />
      )}

      {screen.kind === 'crucible' && (
        <CrucibleScreen run={playerRun} onRunChange={settlingRunChange(screen)} onContinue={() => setScreen(screen.next)} seed={screen.seed} />
      )}

      {screen.kind === 'champions' && <ChampionScreen run={playerRun} onContinue={() => setScreen({ kind: 'runComplete' })} />}

      {/* `runOutcome` is set in the layout effect above, so it is already there on the first paint. */}
      {(screen.kind === 'runComplete' || screen.kind === 'runFailed') && runOutcome && (
        <RunSummaryScreen
          outcome={screen.kind === 'runComplete' ? 'win' : 'loss'}
          run={playerRun}
          profileBefore={runOutcome.before}
          profileAfter={runOutcome.after}
          onNewRun={() => handleStartNewRun(playerRun.ascension)}
          canAffordRung={canEnterRung(runOutcome.after, starShopCatalog, playerRun.ascension)}
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

      {/* The first-time tip for whatever screen is up. Last in the tree so it paints above
          everything; FightScreen mounts its own for the mid-fight tips. Held back while a recruit's
          fanfare plays, so the two never stack. */}
      {/* The install card, once an account, over the title on its first launch — ahead of any
          play, since an iPhone's Home Screen app does not share the browser's storage. */}
      {screen.kind === 'title' && launchDone && installPlatform && !profile.seenTipIds.includes(INSTALL_TIP_ID) && (
        <InstallOverlay platform={installPlatform} onDone={() => markTipSeen(INSTALL_TIP_ID)} />
      )}
      {saveTrouble !== 'ok' && !saveTroubleSeen && screen.kind !== 'title' && (
        <SaveTroubleBanner line={SAVE_TROUBLE_LINES[saveTrouble]} onDismiss={() => setSaveTroubleSeen(true)} />
      )}
      {(() => {
        if (recruitFanfare) return null;
        const tip = firstUnseenTip(SCREEN_TIPS, screenTipIds(screen, playerRun), profile.seenTipIds);
        if (!tip) return null;
        return <TipOverlay key={tip.id} tip={tip} onDone={() => markTipSeen(tip.id)} />;
      })()}
      {/* Last, so it sits over the title (and any tip) while it fades off them. */}
      {!launchDone && <LaunchScreen onReveal={() => setLaunched(true)} onDone={() => setLaunchDone(true)} />}
    </div>
    </ProfileProvider>
    </LocationProvider>
  );
}
