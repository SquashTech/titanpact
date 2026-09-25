import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { initUiScale } from './uiScale';
import { useReloadOnNewBuild } from './useReloadOnNewBuild';
import { clearSave, readSave, writeSave } from './saveStorage';
import { eraseAllData, readProfile, updateProfile } from './profileStorage';
import { usePlaytime } from './usePlaytime';
import type { StatKey } from '../engine/content';
import { saveSummary, type SavedRun } from '../run/save';
import {
  recordActReached,
  recordRunEnded,
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
import { SquadSelectScreen } from '../view/run/SquadSelectScreen';
import { MapScreen } from '../view/run/MapScreen';
import { ShopNodeScreen } from '../view/run/ShopNodeScreen';
import { BoonNodeScreen } from '../view/run/BoonNodeScreen';
import { TutorNodeScreen } from '../view/run/TutorNodeScreen';
import { MentorNodeScreen } from '../view/run/MentorNodeScreen';
import { NodeRewardScreen, type RewardNodeType } from '../view/run/NodeRewardScreen';
import { ItemWhoScreen } from '../view/run/ItemWhoScreen';
import { ScrollNodeScreen, type ScrollPlan } from '../view/run/ScrollNodeScreen';
import { ManaWellScreen } from '../view/run/ManaWellScreen';
import { ForgeNodeScreen } from '../view/run/ForgeNodeScreen';
import { LeyLineScreen } from '../view/run/LeyLineScreen';
import { RestNodeScreen } from '../view/run/RestNodeScreen';
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
import { ChampionScreen } from '../view/run/ChampionScreen';
import { RunSummaryScreen } from '../view/run/RunSummaryScreen';
import { heroes } from '../data/heroes';
import { moves } from '../data/moves';
import { allCombatants, rosterHeroes } from '../data/content';
import { CompanionScreen, type CompanionBeat } from '../view/run/CompanionScreen';
import { absorbCompanions, companionCandidate, companionJoinDue, joinCompanion } from '../run/companion';
import { fallenAfterFight, isPermadeath, openAscension } from '../run/ascension';
import { FallenScreen } from '../view/run/FallenScreen';
import type { CombatState } from '../engine/state';
import { koRosterIdsOf } from '../run/buildCombatState';
import { WoundsError, anyDown, anyWounded, buyMend, mendPrice, recordWounds, mendRoster, standingRoster } from '../run/wounds';
import { entryHp } from '../view/shared/WoundBar';
import { enemies, finaleEnemies, ENDBRINGER_ID, MANTICORE_ID, titanEyes, EYE_PHASES } from '../data/enemies';
import { relics } from '../data/relics';
import { ActIntroScreen } from '../view/run/ActIntroScreen';
import { PactSealScreen } from '../view/run/PactSealScreen';
import { HeraldScreen } from '../view/run/HeraldScreen';
import { TitanBoundScreen } from '../view/run/TitanBoundScreen';
import { TitanWakeScreen } from '../view/run/TitanWakeScreen';
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
import { MASTERY_CAP, SCROLL_CACHE_COUNT, buyScroll, canBuyScroll } from '../run/mastery';
import { TavernRerollError, rerollGuildHallOffers, rollGuildHallOffers, type GuildHallOffers } from '../run/shop';
import { ConsumableError, buyConsumable, grantConsumable, rollConsumableDrop, spendConsumables, type ConsumableKind, type ConsumablePurse, type PotionKind } from '../run/consumables';
import { guildHallEntry } from '../run/guildRecruit';
import { anyClassAvailable } from '../run/classes';
import { generateMap, type MapNodeType } from '../run/map';
import { firstUnseenTip, LORE_TIP_ID, type ScreenTipId } from '../run/tips';
import { LORE_LINES, SCREEN_TIPS } from '../data/tips';
import { TipOverlay } from '../view/run/TipOverlay';
import { LoreScreen } from '../view/run/LoreScreen';
import { generateStarterOptions } from '../run/draft';
import { equipPack, equippedPack } from '../run/starterPacks';
import { STARTER_PACKS } from '../data/starterPacks';
import {
  generateEncounter,
  generateFinaleEncounter,

  type EncounterNodeType,
  type Encounter,
} from '../run/enemyGen';
import { CHAMPION_LEVEL_BONUS, encounterScaling, enemyLevelFor } from '../run/difficulty';
import { ENCOUNTERS_PER_ACT, MAX_LEVEL, applyEncounterLevels, encounterXpKind, levelOf, xpForEncounter, xpForLevel, type HeroLevelUp } from '../run/growth';
import { chooseLocation, drawLocationCandidates, generateItinerary, locationChoiceDue, locationForAct, locationPool } from '../run/locations';
import { encounterKindOf, encounterSeedFor, nodeEncounter } from '../run/encounters';
import { ACT_ONE_LOCATION_ID, locations } from '../data/locations';
import { LocationProvider } from '../view/shared/LocationContext';
import { LocationChoiceScreen } from '../view/run/LocationChoiceScreen';
import { ProfileProvider } from '../view/shared/ProfileContext';
import { starShopCatalog } from '../data/starShop';
import { buyOffer, type StarShopOffer } from '../run/starShop';
import { NODE_TINT_MANA, NODE_TINT_VITAL } from '../view/shared/NodeStage';
import { prefetchTrack, setTrack } from '../audio/music';
import { playSfx } from '../audio/sfx';
import { hasTrack } from '../audio/tracks';
import { pickSquad } from '../run/squad';
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
import { createStatusTestSides } from '../run/statusTestFight';
import { atEvolution, currentEvolutionPathId, fullMovepool, pendingScheduleEntry } from '../run/progression';
import { progressionTable } from '../data/progression';
import type { RunState, RosterEntry } from '../run/state';
import type { Squad } from '../run/squad';
import { statScaleFor } from '../run/statScale';

type Screen =
  | { kind: 'title' }
  /** The lore card, ahead of the first draft on an account (docs/tutorial.md). */
  | { kind: 'lore'; next: Screen }
  | { kind: 'draft'; optionIds: string[] }
  /** Permadeath's post-fight beat (docs/ascension.md §3): the KO'd heroes, still on the roster until Continue, and the companion the same fight took. */
  | { kind: 'fallen'; rosterIds: string[]; companion: RosterEntry | null; next: Screen }
  /** The act-boundary beat: five sockets, one per Guardian (docs/run-loop.md §4). */
  | { kind: 'pactSeal' }
  /** Acts 2-5 open on a 1-of-2 (docs/locations.md §1): the offer is drawn once, when the seal is behind the player. */
  | { kind: 'locationChoice'; candidateIds: string[] }

  /** Per-act arrival beat; reads its location off the run's itinerary. */
  | { kind: 'titanWake' }
  | { kind: 'actIntro' }
  /** The Herald announced before its fight; `next` is the fight. */
  | { kind: 'herald'; next: Screen }
  /** The Eyes have closed: the collapse and the re-binding, ahead of everything the fight pays. */
  | { kind: 'titanBound'; next: Screen }
  | { kind: 'map' }
  | { kind: 'squadSelect'; nodeId: string; nodeType: EncounterNodeType; encounter: Encounter }
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
  /** `offers` lives on the screen, not in the shop component: a purchase re-renders the shop and component-local state would reroll / forget. */
  | { kind: 'shop'; nodeId: string; offers: GuildHallOffers; scrollsBought: number; revivesBought: number; rerolls: number }
  | { kind: 'reward'; nodeId: string; nodeType: RewardNodeType }
  /** The Forge: +1 item slot to one hero. */
  /** An item has arrived and asks who carries it (docs/gear-absorption.md §2). `next` is where the run goes once it is absorbed or sold. */
  | { kind: 'itemWho'; itemId: string; next: Screen }
  /** The Mana Well: +MANA_WELL_AMOUNT max Mana to one hero. */
  | { kind: 'manaWell'; nodeId: string }
  | { kind: 'forge'; nodeId: string }
  | { kind: 'leyLine'; nodeId: string }
  | { kind: 'rest'; nodeId: string }
  /**
   * Mastery Scrolls to whoever the player taps (run/mastery.ts, docs/mastery.md): the Scribe's
   * forced row, the Scroll Cache's reward seat, and the Guild Hall shelf (`bought`, `nodeId` null,
   * the gold already charged). The Evolution the fifth pip raises is the screen's own; it walks
   * the node when every pip is down.
   */
  | { kind: 'scrolls'; plan: ScrollPlan; nodeId: string | null; bought: boolean; next: Screen }
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
  | { kind: 'recruit'; offers: RosterEntry[]; next: Screen }
  /** The Eyes have closed: the roster presented as the heroes of the land, then the summary. */
  | { kind: 'champions' }
  | { kind: 'runComplete' }
  | { kind: 'runFailed' };

/** Screens outside an act get no ambient Location (LocationContext). Listed as the exceptions so new node screens inherit the place by default. */
const PLACELESS_SCREENS: ReadonlySet<Screen['kind']> = new Set([
  'title',
  'lore',
  'draft',
  // Placeless is the point: it drops the title's track and leaves the cold open in silence,
  // and Act I's music then starts where it always does, on the arrival screen.
  'titanWake',
  // Between two acts, and the property of neither.
  'pactSeal',
  // Each place on offer lights its own card; the sky behind them belongs to none of them.
  'locationChoice',

  // After the last fight: the Threshold's track drops and the binding plays in silence.
  'titanBound',
  'quickBattle',
  'sandboxBattle',
  'sandboxFight',
  'statusTestFight',
  'champions',
  'runComplete',
  'runFailed',
]);

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
    ...addHeroes(createRunState(40, 1, ascension), heroIds),
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
      if (anyWounded(run)) ids.push('wounds');
      const ahead = reachable.map((id) => run.map?.nodes[id]?.type);
      if (ahead.includes('elite') || ahead.includes('skirmish')) ids.push('fork');
      return ids;
    }
    case 'squadSelect':
      return ['squad'];
    case 'levelUp':
      return ['levelUp'];
    case 'itemWho':
      return ['item'];
    case 'companion':
      return screen.beat.kind === 'join' ? ['companion'] : [];
    case 'fallen':
      return ['fallen'];
    case 'reward':
      return screen.nodeType === 'equipmentReward' ? ['equipmentReward'] : [];
    case 'mentorNode':
      return []; // the screen's own line says it (2026-09-24, per user direction)
    case 'tutorNode':
      return ['tutor'];
    case 'boonNode':
      return ['boon'];
    case 'manaWell':
      return ['manaWell'];
    case 'forge':
      return []; // the screen's own line says it (2026-09-24, per user direction)
    case 'leyLine':
      return ['leyLine'];
    case 'rest':
      return ['rest'];
    case 'event':
      return ['event'];
    case 'scrolls':
      // A bought Scroll is the Guild Hall's, whose own tip has already named it.
      if (screen.bought) return [];
      return [screen.plan.kind === 'scribe' ? 'scribe' : 'scrollCache'];
    case 'shop':
      return ['shop'];
    case 'recruit':
      return ['recruit'];
    case 'guardianBanner':
      return ['banner'];
    case 'crucible':
      return ['crucible'];
    case 'pactSeal':
      return ['seal'];
    case 'locationChoice':
      return ['locationChoice'];
    default:
      return [];
  }
}

/**
 * With 2 or fewer heroes there is no lead order to decide, so the squad screen is skipped — unless
 * one of them is down, since that screen is where a Revive is spent (run/wounds.ts).
 */
function skipSquadSelect(run: RunState): boolean {
  return run.roster.length <= 2 && !anyDown(run);
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

  // Held so the title, its Records screen and the Compendium can render it, and so the Evolution
  // screen can mark the paths already starred (ProfileProvider). Stars only change at a run's end
  // and this is re-read on the way back to the title, so mid-run it is a snapshot, and current.
  // Everything that WRITES the profile goes straight to storage (profileStorage.updateProfile) —
  // playtime flushes on a timer, and putting that in React state would re-render the tree for a
  // number nothing shows.
  const [profile, setProfile] = useState<Profile>(() => readProfile());
  // The heroes a run draws from: the base roster plus every bundle the Constellation has sold
  // (run/recruitment.ts heroPool) — the fork's contracts, the Guild Hall and the enemy party all
  // read this one table, the way the itinerary reads locationPool.
  const recruitPool = useMemo(() => heroPool(heroes, profile.purchases), [profile.purchases]);
  // The cold launch's loading screen (LaunchScreen): `launched` mounts the title under it for its
  // fade, `launchDone` takes it down. Neither goes back to false this session.
  const [launched, setLaunched] = useState(false);
  const [launchDone, setLaunchDone] = useState(false);

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
    const end: RunEnd = {
      outcome: screen.kind === 'runComplete' ? 'win' : 'loss',
      actReached: playerRun.actNumber,
      // The finale has no Location of its own (locationForAct falls back to Act 1's); the history reads the act instead.
      locationId: playerRun.actNumber <= SEAL_ACTS ? playerRun.locationIds[playerRun.actNumber - 1] ?? null : null,
      encountersWon: playerRun.encountersWon,
      ascension: playerRun.ascension,
      roster: playerRun.roster.map((entry) => ({ heroId: entry.heroId, level: levelOf(entry), evolutionPathId: currentEvolutionPathId(entry) })),
    };
    const before = readProfile();
    const after = updateProfile((current) => recordRunEnded(current, end, now));
    setRunOutcome({ before, after });
  }, [screen.kind]);

  function handleEraseAllData() {
    eraseAllData();
    setProfile(readProfile());
    setSaveSlot({ save: null, staleReason: null });
  }

  /** A Constellation purchase (run/starShop.ts): written to storage, then the title re-reads it so the balance moves. */
  function handleBuyOffer(offer: StarShopOffer) {
    setProfile(updateProfile((current) => buyOffer(current, starShopCatalog, offer)));
  }

  /** Free and reversible (docs/constellation.md §3.3): the title dresses, the Constellation sells. */
  function handleEquipPack(packId: string) {
    setProfile(updateProfile((current) => equipPack(current, STARTER_PACKS, packId)));
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
    if (!isRecruitable(defeated.heroId, recruitPool)) return false;
    if (playerRun.roster.length >= ROSTER_CAP) return false;
    if (playerRun.recruitContracts <= 0) return false;
    const offer = deriveContractOffer(defeated);
    const rosterId = freshRosterId(playerRun, defeated.heroId);
    setPlayerRun((run) => claimContract(run, offer, rosterId));
    return true;
  }

  function handleClaimContractReplace(defeated: RosterEntry, terminatedRosterId: string): boolean {
    if (!isRecruitable(defeated.heroId, recruitPool)) return false;
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
      if (skipSquadSelect(playerRun)) {
        handleSquadConfirmed(pickSquad(playerRun.roster, standingRoster(playerRun.roster).map((r) => r.rosterId)), nodeId, 'boss', encounter);
      } else {
        setScreen({ kind: 'squadSelect', nodeId, nodeType: 'boss', encounter });
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
      let encounter = nodeEncounter(node, {
        run: playerRun,
        location,
        heroes: recruitPool,
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
      if (skipSquadSelect(playerRun)) {
        const squad = pickSquad(playerRun.roster, standingRoster(playerRun.roster).map((r) => r.rosterId));
        handleSquadConfirmed(squad, nodeId, encounterKind, encounter);
      } else {
        setScreen({ kind: 'squadSelect', nodeId, nodeType: encounterKind, encounter });
      }
    } else if (node.type === 'shop' || node.type === 'muster') {
      setScreen({
        kind: 'shop',
        nodeId,
        offers: rollGuildHallOffers(playerRun, guildHallOffersFor(recruitPool), node.type === 'muster'),
        scrollsBought: 0,
        revivesBought: 0,
        rerolls: 0,
      });
    } else if (node.type === 'manaWellReward') {
      setScreen({ kind: 'manaWell', nodeId });
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
      equipmentReward,
      consumableReward: rollConsumableDrop(mapNodeType),
    };
    // The Herald is announced between the squad and the fight, once the squad is settled.
    setScreen(mapNodeType === 'finale' ? { kind: 'herald', next: fight } : fight);
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
    finalState: CombatState | null = null
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
    const afterCrucible: Screen = crucible ? { kind: 'crucible', next: afterScreen } : afterScreen;

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
    // Levels go FIRST, ahead of the Banner and everything under it: they are what this fight did,
    // and the rest of the chain is what the ACT pays. Skipped when nobody levelled and nobody is
    // owed a schedule entry — a fight the XP left part-way to the next level (the fight result
    // already showed the bars move), past the finale, a roster entirely at the cap. A raw hire
    // with a backlog still gets its one entry a fight, level or no level.
    const owed = levelled.run.roster.some((entry) => pendingScheduleEntry(rosterHeroes[entry.heroId], entry) !== null);
    const afterLoss: Screen = levelled.report.some((hero) => hero.toLevel > hero.fromLevel) || owed
      ? { kind: 'levelUp', report: levelled.report, next: afterLevels }
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
    setScreen({ kind: 'scrolls', plan: { kind: 'scrolls', count: 1 }, nodeId: null, bought: true, next: { ...screen, scrollsBought: screen.scrollsBought + 1 } });
  }

  /**
   * Claiming an item advances the node, then asks who carries it — one who-screen per item, in
   * order, since the Loot Pile event hands over three at once. An item nobody can take is gold.
   */
  function handleClaimEquipment(nodeId: string, itemIds: string | string[]) {
    const ids = (Array.isArray(itemIds) ? itemIds : [itemIds]).filter((id) => equipment[id]);
    const advanced = advanceToNode(playerRun, nodeId);
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
    // The equipped Starter Pack's list (run/starterPacks.ts): pack zero is the fourteen starters.
    const starterHeroIds = equippedPack(profile, STARTER_PACKS).heroIds;
    const optionIds = generateStarterOptions(randomSeed(), starterHeroIds);
    setPlayerRun((run) => ({ ...run, ascension }));
    const draft: Screen = { kind: 'draft', optionIds };
    // The lore card once an account, ahead of the first draft — its last line is the draft's verb.
    setScreen(profile.seenTipIds.includes(LORE_TIP_ID) ? draft : { kind: 'lore', next: draft });
  }

  function handleDraftConfirm(chosenIds: string[]) {
    setPlayerRun((run) => createStartingRun(chosenIds, run.ascension));
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

  /** TEMPORARY DEV/TEST — see createTitanEyesTestRun. */
  function handleStartTitanEyesTestRun() {
    setPlayerRun(createTitanEyesTestRun());
    setScreen({ kind: 'map' });
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
          onEquipPack={handleEquipPack}
          parkedRun={saveSlot.save ? saveSummary(saveSlot.save) : null}
          staleSaveReason={saveSlot.staleReason}
          onContinueRun={handleContinueRun}
          onStartRun={handleStartNewRun}
          openAscension={openAscension(profile)}
          onResetTips={handleResetTips}
          onQuickBattle={handleQuickBattle}
          onOpenSandbox={handleOpenSandbox}
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

      {screen.kind === 'titanWake' && <TitanWakeScreen onDone={enterAct} />}

      {screen.kind === 'locationChoice' && (
        <LocationChoiceScreen run={playerRun} candidateIds={screen.candidateIds} onChoose={handleLocationChosen} />
      )}

      {screen.kind === 'herald' && <HeraldScreen onContinue={() => setScreen(screen.next)} />}

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
              koRosterIdsOf(finalState, 'A'),
              finalState
            )
          }
          onSaveAndQuit={() => setScreen({ kind: 'title' })}
          onAbandonRun={handleAbandonRun}
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
          onRunChange={setPlayerRun}
          onBuyScroll={handleBuyGuildScroll}
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
          onRunChange={setPlayerRun}
          onContinue={() => handleNodeContinue(screen.nodeId)}
          onClaimEquipment={(itemId) => handleClaimEquipment(screen.nodeId, itemId)}
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
        <ForgeNodeScreen run={playerRun} onRunChange={setPlayerRun} onContinue={() => handleNodeContinue(screen.nodeId)} />
      )}

      {screen.kind === 'leyLine' && (
        <LeyLineScreen run={playerRun} onRunChange={setPlayerRun} onContinue={() => handleNodeContinue(screen.nodeId)} />
      )}

      {screen.kind === 'rest' && (
        <RestNodeScreen run={playerRun} onRunChange={setPlayerRun} onContinue={() => handleNodeContinue(screen.nodeId)} />
      )}

      {screen.kind === 'itemWho' && (
        <ItemWhoScreen key={`${screen.itemId}:${whoScreensBehind(screen.next)}`} run={playerRun} itemId={screen.itemId} onRunChange={setPlayerRun} onDone={() => setScreen(screen.next)} />
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
        <LevelUpScreen
          run={playerRun}
          onRunChange={setPlayerRun}
          report={screen.report.filter((hero) => playerRun.roster.some((entry) => entry.rosterId === hero.rosterId))}
          onContinue={() => setScreen(screen.next)}
        />
      )}

      {screen.kind === 'fallen' && (
        <FallenScreen run={playerRun} rosterIds={screen.rosterIds} companion={screen.companion} onRunChange={setPlayerRun} onContinue={() => setScreen(screen.next)} />
      )}

      {screen.kind === 'companion' && <CompanionScreen run={playerRun} beat={screen.beat} onContinue={() => setScreen(screen.next)} />}

      {screen.kind === 'guardianBanner' && (
        <GuardianBannerScreen run={playerRun} onRunChange={setPlayerRun} onContinue={() => setScreen(screen.next)} />
      )}

      {screen.kind === 'crucible' && (
        <CrucibleScreen run={playerRun} onRunChange={setPlayerRun} onContinue={() => setScreen(screen.next)} />
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
