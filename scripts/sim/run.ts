// One headless run, node for node, mirroring src/app/App.tsx's orchestration.
// When this file and App.tsx disagree, App.tsx is right and this is a bug —
// the numbers are only worth reading while the two stay in step.

import type { StatKey } from '../../src/engine/content';
import { heroes as allHeroes } from '../../src/data/heroes';
import { rosterHeroes } from '../../src/data/content';
import { isGathering, isLongWinter } from '../../src/run/cycles';
import { anyDown, anyWounded, mendRoster, recordWounds, standingRoster } from '../../src/run/wounds';
import { grantConsumable, leftItemFlask, rollConsumableDrop } from '../../src/run/consumables';
import { moves } from '../../src/data/moves';
import { equipment } from '../../src/data/equipment';
import { relics, guardianBannersFor } from '../../src/data/relics';
import { classes } from '../../src/data/classes';
import { runEvents } from '../../src/data/events';
import { progressionTable } from '../../src/data/progression';
import { enemies, finaleEnemies, ENDBRINGER_ID, titanEyes, EYE_PHASES } from '../../src/data/enemies';
import { encounterKindOf, encounterSeedFor, nodeEncounter } from '../../src/run/encounters';
import { wardensFromRun, type Warden } from '../../src/run/wardens';
import { allCombatants } from '../../src/data/content';
import { chooseMvp, mvpLedgersFromEvents } from '../../src/run/mvp';
import { statuses } from '../../src/data/statuses';
import type { CombatEvent } from '../../src/engine/events';
import type { CombatState } from '../../src/engine/state';
import { GEM_CACHE_COUNT, SCRIBE_GEMS, placeGem, rollGemDrop, rollGems, type Gem } from '../../src/run/gems';
import { campBundle, rollCampDoors, rollCampGear, rollCampGemShelf, type CampPiece } from '../../src/run/camp';
import { anyMasteryEligible } from '../../src/run/mastery';

import { createRunState, createRosterEntry, addRosterEntry, terminateRosterEntry, ROSTER_CAP, SEAL_ACTS, TOTAL_ACTS, type RunState, type RosterEntry } from '../../src/run/state';
import { patrons } from '../../src/data/patrons';
import { rollFittingGear } from '../../src/data/equipment';
import { RARITY_ORDER, type EquipmentRarity } from '../../src/run/equipment';
import { rosterEntryTypes } from '../../src/run/progression';
import { PATRON_ROWS } from '../../src/run/map';
import { capstoneCandidates, fittedRarity, forgeUnique, heldFamilyIndex, liftHeldItem, meetPatron, patronAtSeat, patronItemId, seatIndexFor, setStudent, studentOf, trustOf, type PatronStep } from '../../src/run/patrons';
import { blessOpeningPair, canBless, grantBlessing } from '../../src/run/blessings';
import { generateMap, type MapNode, type MapNodeType } from '../../src/run/map';
import { generateStarterOptions, STARTER_PICK_COUNT } from '../../src/run/draft';
import { actOneLocationFor, locationForAct, locationPool, seatNextLocation } from '../../src/run/locations';
import { locations } from '../../src/data/locations';
import { encounterScaling, enemyLoadoutFor } from '../../src/run/difficulty';
import { MAX_XP, MVP_XP_SHARE, encounterXpKind, grantEncounterLevels, grantXp, levelOf, MAX_LEVEL, xpForEncounter } from '../../src/run/growth';
import { deckRows, normalizeDeck } from '../../src/run/deck';
import { generateFinaleEncounter, type Encounter, type EncounterNodeType } from '../../src/run/enemyGen';
import { pickSquad, requiredSquadSize, STANDARD_SQUAD_SIZE, type Squad } from '../../src/run/squad';
import {
  absorbItem,
  itemReceiptFor,
  advanceToNode,
  advanceToNextAct,
  grantRelicReward,
  reachableNodeIds,
  recordBrokenSeal,
  grantManaWell,
  forgeItem,
  forgeTarget,
  grantLeyLine,
  recordPermanentStatGains,
} from '../../src/run/runProgress';
import { MOVE_CAP, recordMoveOffer, grantOfferedMove, grantMove } from '../../src/run/progression';
import { heroPool, freshRosterId } from '../../src/run/recruitment';
import { recruitNodeEntry, recruitTypeOffers, rollRecruitHero } from '../../src/run/recruitNode';

// The run's pool (run/recruitment.ts heroPool): the base game, plus whatever SIM_PURCHASES names —
// a comma-separated list of Constellation offer ids, so a batch can hold a bundle.
// SIM_ALL_HEROES=1 owns the whole catalog and drafts from every hero of a type (six a row, not the
// deck's three), so a batch measures all 84 on equal draft odds.
export const SIM_ALL_HEROES = process.env.SIM_ALL_HEROES === '1';
export const SIM_PURCHASES: readonly string[] = SIM_ALL_HEROES
  ? Object.keys(allHeroes).map((id) => `summon.${id}`)
  : (process.env.SIM_PURCHASES ?? '').split(',').filter(Boolean);
// SIM_NO_BLESSING=1 opens the run without the opening pair's Blessings, the A/B for docs/blessings-and-statuses.md.
export const SIM_NO_BLESSING = process.env.SIM_NO_BLESSING === '1';
const heroes = heroPool(allHeroes, SIM_PURCHASES);
import { tutorMovePool } from '../../src/run/tutor';
import { canTrain, mentorXpFor } from '../../src/run/mentor';
import { grantClass, rollClassOffers } from '../../src/run/classes';
import { boonMoveCount, pickBoonOffers } from '../../src/run/boons';
import { applyEventCost, applyHeroOutcome, applyStatShift, eventRecruitEntry, grantEventPassive, heroOutcomeAllowed, joinEventRecruit, eligibleEvents, outcomeForAct, recruitPool, resolveGamble, rollRecruits, rollRunEvent, rollEventMove, statShiftAllowed } from '../../src/run/events';
import type { EventCost, ResolvableOutcome } from '../../src/data/events';
import {
  pickWeightedEquipment,
  rarityWeightsFor,
  EQUIPMENT_DROP_CHANCE,
  LOOT_SOURCE,
  ENCHANTMENT_IDS,
  ENCHANTMENTS,
  parseEquipmentId,
  type EnchantmentId,
  type EquipmentDefinition,
} from '../../src/run/equipment';
import { passives } from '../../src/data/passives';
import { getMaxHp } from '../../src/engine/state';
import { createCombatant } from '../../src/engine/state';

import { simulateFight, PLAYER_SIDE, type PilotKind, type ShieldTally, type MoveTally } from './fight';
import * as policy from './policy';
import type { PourEvolution } from './policy';
import { makeRng, pick, randomSeed, sample, withRandom, type Rng } from './rng';
import { emptyTimeCounts, type ScreenKind, type TimeCounts } from './time';
import { emptyKnockoutCounts, type KnockoutCounts } from './types';

const EQUIPMENT_POOL = Object.values(equipment);
// The draft's rows: the base roster's default deck, one hero drawn from each (run/draft.ts).
const DRAFT_ROWS = SIM_ALL_HEROES
  ? deckRows(normalizeDeck({}, heroes, SIM_PURCHASES)).map((row) => Object.keys(heroes).filter((id) => heroes[id].types[0] === heroes[row[0]].types[0]))
  : deckRows(normalizeDeck({}, heroes, SIM_PURCHASES));

/** App.tsx `EncounterMapNodeType` — the reward lane keys off the MAP node, not the flattened encounter kind. */
type EncounterMapNodeType = 'fight' | 'skirmish' | 'battle' | 'elite' | 'boss' | 'finale';

// EQUIPMENT_DROP_CHANCE and LOOT_SOURCE come from run/equipment.ts, so the sim rolls the odds the game ships.

/** NodeRewardScreen's flat XP cache. */
const UPGRADE_REWARD_XP = 2;

// --- Records the aggregator consumes ---

export interface ChoiceEvent {
  bucket: 'banner' | 'boon' | 'evolution' | 'class' | 'draft' | 'node' | 'event' | 'patron';
  offered: string[];
  /** Usually one; the draft takes two of its four. */
  picked: string[];
  /** Encounters already won when the choice was made — progress after is measured against the run's final tally. */
  encountersWonAtChoice: number;
}

export interface FightRecord {
  act: number;
  mapNodeType: string;
  locationId: string;
  won: boolean;
  stalemate: boolean;
  rounds: number;
  beats: number;
  pactTicked: boolean;
  playerHpFrac: number;
  playerTurns: number;
  playerRests: number;
  playerSwitches: number;
  lockedIn: boolean;
  playerSquadStats: number;
  enemySquadStats: number;
  castsByTier: Record<string, number>;
  castsByManaBand: Record<string, number>;
  castsByMove: Record<string, number>;
  moves: Record<string, MoveTally>;
  enemyMoves: Record<string, MoveTally>;
  movesByHero: Record<string, MoveTally>;
  fieldSets: Record<string, number>;
  enemyFieldSets: Record<string, number>;
  fieldRounds: Record<string, number>;
  statDeltaCount: number;
  statDeltaAuthored: number;
  statDeltaLanded: number;
  enemyStatDeltaCount: number;
  enemyStatDeltaAuthored: number;
  enemyStatDeltaLanded: number;
  heldDrops: number;
  enemyHeldDrops: number;
  shield: ShieldTally;
  peakModifierFrac: number;
  wouldHaveCapped: boolean;
  wouldHaveCappedUp: boolean;
  wouldHaveCappedDown: boolean;
  floored: boolean;
  /** heroId -> per-fight telemetry, player side. */
  playerHeroes: Record<string, { rounds: number; dealt: number; taken: number; healed: number; kos: number; rests: number; died: boolean }>;
  enemyHeroes: Record<string, { rounds: number; dealt: number; taken: number; kos: number; died: boolean }>;
}

export interface RunRecord {
  seed: number;
  won: boolean;
  /** Highest act entered. */
  actReached: number;
  /** Acts whose Guardian fell. */
  actsCleared: number[];
  deathAct: number;
  deathNodeType: string | null;
  encountersWon: number;
  rosterLevelEnd: number;
  rosterSizeEnd: number;
  /** Heroes standing when the finale was entered (null = never reached it). Nothing is hired after act 4, so this is the side the run kept. */
  finaleRoster: number | null;
  /** heroId -> best level reached this run, for every hero that was ever on the roster. */
  heroLevels: Record<string, number>;
  /** A won run's band, seated as the Wardens it would become (run/wardens.ts). */
  wardens?: Warden[];
  /** Share of the roster that had evolved when the run ended — the §11 target is 1.0. */
  rosterEvolvedEnd: number;
  fights: FightRecord[];
  choices: ChoiceEvent[];
  /** Rarity of every item actually equipped, keyed `act:rarity`. */
  equipped: string[];
  /** Mastery pips landed this run, by source (run/mastery.ts). */
  pipsBySource: Record<string, number>;
  /** The MVP pip (run/mvp.ts, SIM_MVP=1): tallies keyed `col:<column>`, `hero:<heroId>`, `repeatBlocked`, `fights`; the run's MVPs by roster id; the last one. */
  mvp: Record<string, number>;
  mvpByRoster: Record<string, number>;
  mvpLast?: string;
  /** Signatures owed at the tenth pip this run, by hero: times reached and times the kit took it. */
  signatures: Record<string, { reached: number; taken: number }>;
  /** Every rolled move offer (schedule, Mentor, Tutor, signature) by move id: times on the table, times the kit took it. */
  moveOffers: Record<string, { offered: number; taken: number }>;
  /** The ledger: items left for a flask, `act:left`, and the Camp's door taken, `act:camp:<door id>`. */
  flow: Record<string, number>;
  /** Heroes joining at the Recruit node: `recruit` below the cap, `recruitReplacing` at it. */
  recruitsBySource: Record<string, number>;
  /** Items obtained, keyed `act:source` — `drop` (a fight), `node` (Equipment Cache), `event` (a loot pile), `shop`. */
  itemsBySource: Record<string, number>;
  /** Drops that merged into a held piece rather than taking a socket, and drops that COULD have (somebody held the family). */
  merges: number;
  mergeOffers: number;
  /** Persisting knockouts (src/run/wounds.ts): fights entered short-handed, KOs that persisted, and what stood them up. */
  knockouts: KnockoutCounts;
  /** What the run cost in taps and screens, [act]; index 0 unused (time.ts prices it). */
  timeByAct: TimeCounts[];
}

// --- Helpers ---

/** One more pass through a screen, on the act's time ledger. */
function tally(record: RunRecord, act: number, kind: ScreenKind, n = 1): void {
  const screens = record.timeByAct[act].screens;
  screens[kind] = (screens[kind] ?? 0) + n;
}

function ledger(record: RunRecord, act: number, key: string, amount: number): void {
  const k = `${act}:${key}`;
  record.flow[k] = (record.flow[k] ?? 0) + amount;
}

function entryOf(run: RunState, rosterId: string): RosterEntry {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new Error(`${rosterId} left the roster`);
  return entry;
}

/**
 * The Academy: one Class into one hero (docs/academy.md). Three offered, taken at random — the catalog is under test, not the policy — and the target is the strongest
 * hero with no Class yet, since the screen offers only those and an offer nobody can take is
 * wasted. Random across the offer rather than greedy so the lift table lights up for all nine.
 */
function resolveAcademy(run: RunState, rng: Rng, choices: ChoiceEvent[], count?: number): RunState {
  const target = policy.passiveTarget(run.roster.filter((entry) => entry.classId === null));
  const offered = rollClassOffers(classes, rng, count);
  if (!target || offered.length === 0) return run;
  const picked = pick(rng, offered);
  choices.push({ bucket: 'class', offered: offered.map((c) => c.id), picked: [picked.id], encountersWonAtChoice: run.encountersWon });
  const replaceId = picked.grantsMoveId ? policy.replacementTarget(target, picked.grantsMoveId, run.roster) : undefined;
  return grantClass(run, classes, target.rosterId, picked.id, replaceId ?? undefined);
}

/**
 * The item policy on the who-screen (docs/gear-absorption.md §2): taken or merged by whoever
 * gains most, sold when nobody gains. A merge counts as an item obtained and an item worn, at
 * the tier it reached.
 */
function resolveDrop(run: RunState, itemId: string, record: RunRecord, actNumber: number, source: 'drop' | 'node' | 'event' | 'camp'): RunState {
  const item = equipment[itemId];
  if (!item || run.roster.length === 0) return run;
  record.itemsBySource[`${actNumber}:${source}`] = (record.itemsBySource[`${actNumber}:${source}`] ?? 0) + 1;
  const target = policy.bestReceiver(run.roster, item);
  if (run.roster.some((entry) => itemReceiptFor(entry, item, rosterHeroes[entry.heroId], equipment).kind === 'merge')) record.mergeOffers += 1;
  if (!target || target.gain <= 0) {
    ledger(record, actNumber, 'left', 1);
    return grantConsumable(run, leftItemFlask(run));
  }
  if (target.receipt.kind === 'merge') record.merges += 1;
  record.equipped.push(`${actNumber}:${target.receipt.kind === 'merge' ? target.receipt.resultRarity : item.rarity}`);
  return absorbItem(run, target.rosterId, itemId, equipment, rosterHeroes);
}

function rosterSquad(run: RunState, size: number): Squad {
  const required = requiredSquadSize(standingRoster(run.roster).length, size);
  return pickSquad(run.roster, policy.fieldedSquadIds(run.roster, required), size);
}

// --- The run ---

export interface RunOptions extends policy.PolicyOptions {
  seed: number;
  /** Scales every Training Point payout — the lever for asking whether XP income is the binding constraint. */
  xpMult: number;
  /** Player-side mana cycling (fight.ts manaCycleSwitches). */
  playerSwitching: boolean;
  /** Who pilots the player side in every fight (fight.ts PilotKind). */
  pilot: PilotKind;
  /** The Cycle (docs/cycles.md), 1-based. */
  cycle: number;
  /** The band holding the seals from Cycle II (run/wardens.ts); omitted = none. */
  wardens?: readonly Warden[];
}

export function simulateRun(options: RunOptions): RunRecord {
  const rng = makeRng(options.seed);
  return withRandom(rng, () => runInner(options, rng));
}

function runInner(options: RunOptions, rng: Rng): RunRecord {
  const record: RunRecord = {
    seed: options.seed,
    won: false,
    actReached: 1,
    actsCleared: [],
    deathAct: 0,
    deathNodeType: null,
    encountersWon: 0,
    flow: {},
    rosterLevelEnd: 0,
    rosterSizeEnd: 0,
    finaleRoster: null,
    heroLevels: {},
    rosterEvolvedEnd: 0,
    fights: [],
    choices: [],
    equipped: [],
    pipsBySource: {},
    mvp: {},
    mvpByRoster: {},
    signatures: {},
    moveOffers: {},
    recruitsBySource: {},
    itemsBySource: {},
    merges: 0,
    mergeOffers: 0,
    knockouts: emptyKnockoutCounts(),
    timeByAct: Array.from({ length: TOTAL_ACTS + 1 }, emptyTimeCounts),
  };

  // --- Draft: 4 starters offered, 2 taken at random (the experiment). ---
  const draftOptions = generateStarterOptions(randomSeed(rng), DRAFT_ROWS);
  const drafted = sample(rng, draftOptions, STARTER_PICK_COUNT);
  record.choices.push({ bucket: 'draft', offered: draftOptions, picked: drafted, encountersWonAtChoice: 0 });
  tally(record, 1, 'draft');

  let run: RunState = createRunState(options.cycle);
  for (const heroId of drafted) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  if (!SIM_NO_BLESSING) run = blessOpeningPair(run);
  run = { ...run, map: generateMap(randomSeed(rng)), locationIds: [actOneLocationFor(run.cycle)] };

  let alive = true;
  let guard = 0;

  while (alive && guard++ < 500) {
    record.actReached = Math.max(record.actReached, run.actNumber);
    const reachable = reachableNodeIds(run);
    if (reachable.length === 0) break;
    const nodeId = patronFocus(run, reachable) ?? pick(rng, reachable);
    const node = run.map!.nodes[nodeId];
    // The walk takes a reachable node UNIFORMLY AT RANDOM, so the row is already the
    // randomized experiment every other lift table reads — recording it costs nothing and
    // is the only measurement of a reward NODE as against the option it displaced.
    const offeredTypes = [...new Set(reachable.map((id) => run.map!.nodes[id].type as string))];
    if (offeredTypes.length > 1) {
      record.choices.push({ bucket: 'node', offered: offeredTypes, picked: [node.type], encountersWonAtChoice: run.encountersWon });
    }
    const location = locationForAct(run.locationIds, run.actNumber);
    tally(record, run.actNumber, 'mapPick');

    for (const entry of run.roster) {
      record.heroLevels[entry.heroId] = Math.max(record.heroLevels[entry.heroId] ?? 0, levelOf(entry));
    }

    if (node.type === 'boss' && run.actNumber === SEAL_ACTS) {
      const owed = capstoneCandidates(run, patrons);
      if (owed.length > 0) run = resolvePatronMeeting(run, owed[0], null, rng, record);
    }
    if (node.type === 'patronSeat') {
      const seat = seatIndexFor(run.actNumber, node.row, PATRON_ROWS);
      const patronId = seat === null ? null : patronAtSeat(run, seat, node.col);
      if (patronId) run = resolvePatronMeeting(run, patronId, seat, rng, record);
    }

    if (isEncounterNode(node.type)) {
      // The Guardian's drop lands after the act has advanced; it belongs to the act it was fought in.
      const foughtAct = run.actNumber;
      if (node.type === 'finale') record.finaleRoster = standingRoster(run.roster).length;
      const outcome = resolveEncounterNode(run, node, location.id, rng, options, record);
      run = outcome.run;
      if (!outcome.won) {
        alive = false;
        record.deathAct = run.actNumber;
        record.deathNodeType = node.type;
        break;
      }
      if (node.type === 'finale') {
        record.won = true;
        break;
      }
      run = advanceToNode(run, nodeId);
      run = { ...run, encountersWon: run.encountersWon + 1 };
      // Automatic and roster-wide, benched heroes included (src/run/growth.ts); the payoffs are the
      // schedule (docs/xp-overhaul.md §4). The report itself is on the fight result, not a screen.
      run = grantEncounterLevels(run, rosterHeroes, rng, encounterXpKind(node.type));
      run = paySchedule(run, rng, record);
      record.encountersWon = run.encountersWon;

      if (node.type === 'boss') {
        record.actsCleared.push(run.actNumber);
        run = claimBanner(run, rng, record);
        const champion = outcome.defeatedRoster.find((e) => e.rosterId === location.guardianFinalEnemyId);
        if (champion) {
          run = recordBrokenSeal(run, {
            actNumber: run.actNumber,
            locationId: location.id,
            championId: champion.heroId,
            level: levelOf(champion),
            statGrants: champion.evolutionStatGrants,
            growthStatGrants: champion.growthStatGrants,
          });
        }
        // Guardian → Banner → Pact Seal.
        tally(record, run.actNumber, 'banner');
        tally(record, run.actNumber, 'pactSeal');
        if (run.actNumber < TOTAL_ACTS) {
          run = advanceToNextAct(run, randomSeed(rng));
          run = seatNextLocation(run, randomSeed(rng), locationPool(run.cycle));
          tally(record, run.actNumber, 'actIntro');
        }
        else {
          record.won = true;
          break;
        }
      }

      if (outcome.drop) {
        tally(record, foughtAct, 'drop');
        run = resolveDrop(run, outcome.drop.id, record, foughtAct, 'drop');
      }
      continue;
    }

    tally(record, run.actNumber, node.type as ScreenKind);
    run = resolveRewardNode(run, node.type, location.id, rng, record, options);
    run = advanceToNode(run, nodeId);
  }

  record.rosterSizeEnd = run.roster.length;
  record.rosterEvolvedEnd =
    run.roster.length > 0 ? run.roster.filter((r) => r.chosenPathIds.length > 0).length / run.roster.length : 0;
  record.rosterLevelEnd =
    run.roster.length > 0 ? run.roster.reduce((sum, r) => sum + levelOf(r), 0) / run.roster.length : 0;
  for (const entry of run.roster) {
    record.heroLevels[entry.heroId] = Math.max(record.heroLevels[entry.heroId] ?? 0, levelOf(entry));
  }
  if (record.won) record.wardens = wardensFromRun(run, heroes);
  return record;
}

/**
 * What the level-up report pays out (src/view/run/levelUpFlow.ts): after every level-up — a won
 * fight's — each hero owed a schedule entry takes one (policy.takeSchedule). The
 * Evolution is logged as the choice it is; offers and Evolutions are tallied as the screens they
 * cost.
 */
function paySchedule(run: RunState, rng: Rng, record: RunRecord): RunState {
  const payout = policy.emptyPayout();
  const next = policy.takeSchedule(run, rng, payout);
  recordPayout(record, payout, next.encountersWon);
  tally(record, run.actNumber, 'evolution', payout.evolutions.length);
  tally(record, run.actNumber, 'offer', payout.offers);
  tally(record, run.actNumber, 'moveLearned', payout.receipts);
  return next;
}

/** The Evolutions a payout took are logged as the choices they are, and its signatures under the hero they were owed to. */
function recordPayout(record: RunRecord, payout: policy.SchedulePayout, encountersWon: number): void {
  for (const e of payout.evolutions) {
    record.choices.push({ bucket: 'evolution', offered: e.offered, picked: [e.picked], encountersWonAtChoice: encountersWon });
  }
  for (const s of payout.signatures) {
    const slot = (record.signatures[s.heroId] ??= { reached: 0, taken: 0 });
    slot.reached += 1;
    if (s.taken) slot.taken += 1;
  }
  for (const o of payout.moveOffers) recordMoveOfferMade(record, o.moveId, o.taken);
}

function recordMoveOfferMade(record: RunRecord, moveId: string, taken: boolean): void {
  const slot = (record.moveOffers[moveId] ??= { offered: 0, taken: 0 });
  slot.offered += 1;
  if (taken) slot.taken += 1;
}

function isEncounterNode(type: MapNodeType): boolean {
  return type === 'fight' || type === 'skirmish' || type === 'battle' || type === 'elite' || type === 'boss' || type === 'finale';
}

interface EncounterOutcome {
  run: RunState;
  won: boolean;
  defeatedRoster: readonly RosterEntry[];
  drop: EquipmentDefinition | null;
  /** The enemy side as fielded. */
  encounter: Encounter | null;
  /** The player's roster ids that ended the fight KO'd. */
  koRosterIds: readonly string[];
}

function resolveEncounterNode(
  run: RunState,
  node: MapNode,
  locationId: string,
  rng: Rng,
  options: RunOptions,
  record: RunRecord
): EncounterOutcome {
  const location = locationForAct(run.locationIds, run.actNumber);
  const mapNodeType = node.type;
  const kindKey = mapNodeType as EncounterMapNodeType;
  const isRunOpener = run.actNumber === 1 && run.encountersWon === 0;
  let encounter: Encounter;
  let squadSize = STANDARD_SQUAD_SIZE;
  let workingRun = run;

  if (mapNodeType === 'finale') {
    // The shipped finale (App.tsx): the Herald leading Late spawn, the Eyes a phase a pair behind
    // them (docs/titan-eyes.md §10). SIM_FINALE=guardians replays the unsealed-Guardian shape it
    // replaced, SIM_FINALE=spawnLast the spawn with the Herald entering last.
    const finaleEscorts =
      process.env.SIM_FINALE === 'guardians'
        ? undefined
        : { spawnTypesFor: (locationId: string) => locations[locationId]?.spawnTypes ?? null, heraldLeads: process.env.SIM_FINALE !== 'spawnLast', loadout: enemyLoadoutFor('finale', TOTAL_ACTS) };
    encounter = generateFinaleEncounter(
      run.brokenSeals,
      location.guardianFinalEnemyId ?? ENDBRINGER_ID,
      finaleEnemies,
      encounterSeedFor(run.map!, node.id),
      encounterScaling('finale', TOTAL_ACTS),
      finaleEscorts,
      { phases: EYE_PHASES, pool: titanEyes }
    );
    squadSize = ROSTER_CAP;
  } else {
    // The same deterministic draw the game makes (run/encounters.ts): seeded off the map, so the
    // sim's own rng is not consulted here and a map seed reproduces its fights.
    const encounterKind = encounterKindOf(mapNodeType as Exclude<EncounterMapNodeType, 'finale'>);
    encounter = nodeEncounter(node, { run, location, heroes, allCombatants, enemies, progression: progressionTable, wardens: options.wardens });
    if (encounterKind === 'fight') workingRun = { ...workingRun, fightsStarted: workingRun.fightsStarted + 1 };
  }

  const drop = rng() < EQUIPMENT_DROP_CHANCE[kindKey]
    ? pickWeightedEquipment(EQUIPMENT_POOL, 1, rarityWeightsFor(workingRun.actNumber, LOOT_SOURCE[kindKey]))[0] ?? null
    : null;

  const downEntering = workingRun.roster.filter((entry) => entry.down).length;
  if (downEntering > 0) record.knockouts.shortHanded += 1;
  record.knockouts.downEntering += downEntering;
  const playerSquad = rosterSquad(workingRun, squadSize);
  const fight = simulateFight({
    seed: randomSeed(rng),
    playerRoster: workingRun.roster,
    playerSquad,
    playerRelicIds: workingRun.relics,
    aiRoster: encounter.run.roster,
    aiSquad: encounter.squad,
    rng,
    playerSwitching: options.playerSwitching,
    pilot: options.pilot,
    aiPlaysEngines: isGathering(workingRun),
  });

  const playerHeroes: FightRecord['playerHeroes'] = {};
  const enemyHeroes: FightRecord['enemyHeroes'] = {};
  for (const t of Object.values(fight.telemetry)) {
    if (t.side === PLAYER_SIDE) {
      const slot = (playerHeroes[t.heroId] ??= { rounds: 0, dealt: 0, taken: 0, healed: 0, kos: 0, rests: 0, died: false });
      slot.rests += t.rests;
      slot.rounds += t.roundsActive;
      slot.dealt += t.damageDealt;
      slot.taken += t.damageTaken;
      slot.healed += t.healingDone;
      slot.kos += t.kos;
      slot.died = slot.died || t.died;
    } else {
      const slot = (enemyHeroes[t.heroId] ??= { rounds: 0, dealt: 0, taken: 0, kos: 0, died: false });
      slot.rounds += t.roundsActive;
      slot.dealt += t.damageDealt;
      slot.taken += t.damageTaken;
      slot.kos += t.kos;
      slot.died = slot.died || t.died;
    }
  }

  record.fights.push({
    act: workingRun.actNumber,
    mapNodeType,
    locationId,
    won: fight.won,
    stalemate: fight.stalemate,
    rounds: fight.rounds,
    beats: fight.beats,
    pactTicked: fight.pactTicked,
    playerHpFrac: fight.playerHpFrac,
    playerTurns: fight.playerTurns,
    playerRests: fight.playerRests,
    playerSwitches: fight.playerSwitches,
    lockedIn: fight.lockedIn,
    playerSquadStats: fight.playerSquadStats,
    enemySquadStats: fight.enemySquadStats,
    castsByTier: fight.castsByTier,
    castsByManaBand: fight.castsByManaBand,
    castsByMove: fight.castsByMove,
    moves: fight.moves,
    enemyMoves: fight.enemyMoves,
    movesByHero: fight.movesByHero,
    fieldSets: fight.fieldSets,
    enemyFieldSets: fight.enemyFieldSets,
    fieldRounds: fight.fieldRounds,
    statDeltaCount: fight.statDeltaCount,
    statDeltaAuthored: fight.statDeltaAuthored,
    statDeltaLanded: fight.statDeltaLanded,
    enemyStatDeltaCount: fight.enemyStatDeltaCount,
    enemyStatDeltaAuthored: fight.enemyStatDeltaAuthored,
    enemyStatDeltaLanded: fight.enemyStatDeltaLanded,
    heldDrops: fight.heldDrops,
    enemyHeldDrops: fight.enemyHeldDrops,
    shield: fight.shield,
    peakModifierFrac: fight.peakModifierFrac,
    wouldHaveCapped: fight.wouldHaveCapped,
    wouldHaveCappedUp: fight.wouldHaveCappedUp,
    wouldHaveCappedDown: fight.wouldHaveCappedDown,
    floored: fight.floored,
    playerHeroes,
    enemyHeroes,
  });

  const time = record.timeByAct[workingRun.actNumber];
  time.fights += 1;
  time.rounds += fight.rounds;
  time.beats += fight.beats;
  time.actions += fight.playerTurns;
  tally(record, workingRun.actNumber, 'squadSelect');
  tally(record, workingRun.actNumber, 'fightOpen');
  tally(record, workingRun.actNumber, 'fightResult');

  const koRosterIds = Object.values(fight.telemetry)
    .filter((t) => t.side === PLAYER_SIDE && t.died)
    .map((t) => t.rosterId);
  if (!fight.won) return { run: workingRun, won: false, defeatedRoster: encounter.run.roster, drop: null, encounter, koRosterIds };

  // HP carries to the next node (src/run/wounds.ts); the act's end is what makes the roster whole.
  workingRun = recordPermanentStatGains(recordWounds(workingRun, fight.final, PLAYER_SIDE, rosterHeroes), fight.final, PLAYER_SIDE);
  record.knockouts.koInWins += koRosterIds.length;
  record.knockouts.koInWinsByKind[kindKey] = (record.knockouts.koInWinsByKind[kindKey] ?? 0) + koRosterIds.length;
  // The consumable drop (src/run/consumables.ts). Potions are never drunk here — the pilot has no Bag.
  if (MVP_ON && mapNodeType !== 'finale') workingRun = awardMvp(workingRun, fight.events, fight.final, mapNodeType, record);
  const consumableDrop = rollConsumableDrop(kindKey, rng);
  if (consumableDrop) workingRun = grantConsumable(workingRun, consumableDrop);
  workingRun = landGems(workingRun, rollGemDrop(kindKey, workingRun.actNumber, rng), 'drop', rng, record, options);
  return { run: workingRun, won: true, defeatedRoster: encounter.run.roster, drop, encounter, koRosterIds };
}

const MVP_ON = process.env.SIM_MVP === '1';

/** The fight's MVP (run/mvp.ts) takes bonus XP: never a capped hero, never the same hero twice running. */
function awardMvp(run: RunState, events: readonly CombatEvent[], final: CombatState, mapNodeType: MapNodeType, record: RunRecord): RunState {
  const onRoster = new Set(run.roster.map((e) => e.rosterId));
  const ledgers = mvpLedgersFromEvents(events, final, PLAYER_SIDE, statuses).filter((l) => onRoster.has(l.rosterId));
  const ineligible = new Set(run.roster.filter((e) => e.xp >= MAX_XP).map((e) => e.rosterId));
  const unruled = chooseMvp(ledgers, { ineligible });
  const pick = chooseMvp(ledgers, { ineligible, lastMvpRosterId: record.mvpLast });
  record.mvp.fights = (record.mvp.fights ?? 0) + 1;
  if (!pick) return run;
  if (unruled && unruled.rosterId !== pick.rosterId) record.mvp.repeatBlocked = (record.mvp.repeatBlocked ?? 0) + 1;
  const heroId = run.roster.find((e) => e.rosterId === pick.rosterId)?.heroId ?? '?';
  record.mvp[`col:${pick.column}`] = (record.mvp[`col:${pick.column}`] ?? 0) + 1;
  record.mvp[`hero:${heroId}`] = (record.mvp[`hero:${heroId}`] ?? 0) + 1;
  record.mvp.shareSum = (record.mvp.shareSum ?? 0) + pick.share;
  record.mvpByRoster[pick.rosterId] = (record.mvpByRoster[pick.rosterId] ?? 0) + 1;
  record.mvpLast = pick.rosterId;
  const bonus = Math.round(xpForEncounter(run.encountersWon + 1, encounterXpKind(mapNodeType)) * MVP_XP_SHARE);
  return { ...run, roster: run.roster.map((e) => (e.rosterId === pick.rosterId ? grantXp(e, rosterHeroes[e.heroId], bonus).entry : e)) };
}

/** The Guardian's Banner: a fixed 1-of-5, taken at random. */
function claimBanner(run: RunState, rng: Rng, record: RunRecord): RunState {
  const offered = guardianBannersFor(isLongWinter(run)).map((r) => r.id);
  const picked = pick(rng, offered);
  record.choices.push({ bucket: 'banner', offered, picked: [picked], encountersWonAtChoice: run.encountersWon });
  return grantRelicReward(run, picked);
}

/**
 * The Recruit (run/recruitNode.ts): the type whose answer the policy scores highest. Free power below
 * the cap; above it, only for a real upgrade on the weakest.
 */
function resolveRecruit(run: RunState, locationId: string, rng: Rng, record: RunRecord): RunState {
  const types = recruitTypeOffers(run, heroes, locations[locationId]?.spawnTypes ?? [], rng);
  const arrivals = types
    .map((type) => rollRecruitHero(run, heroes, type, rng))
    .filter((heroId): heroId is string => heroId !== null)
    .map((heroId) => recruitNodeEntry(run, heroes[heroId], freshRosterId(run, heroId), rng));
  if (arrivals.length === 0) return run;
  const best = policy.byPower(arrivals)[0];
  if (run.roster.length < ROSTER_CAP) {
    record.recruitsBySource.recruit = (record.recruitsBySource.recruit ?? 0) + 1;
    return joinEventRecruit(run, best);
  }
  const weakest = policy.byPower(run.roster)[run.roster.length - 1];
  if (policy.powerScore(best) <= policy.powerScore(weakest)) return run;
  record.recruitsBySource.recruitReplacing = (record.recruitsBySource.recruitReplacing ?? 0) + 1;
  return joinEventRecruit(run, best, weakest.rosterId);
}

/**
 * Each Gem placed on the hero the policy names as it stands after the last, and what its pip opens
 * paid on the spot. The Evolution is logged as the choice it is.
 */
function landGems(run: RunState, gems: readonly Gem[], source: string, rng: Rng, record: RunRecord, options: RunOptions): RunState {
  let next = run;
  for (const gem of gems) {
    const target = policy.scrollTarget(next.roster, options.levelPolicy);
    if (!target) break;
    record.pipsBySource[source] = (record.pipsBySource[source] ?? 0) + 1;
    const payout = policy.emptyPayout();
    next = policy.payMastery(placeGem(next, target.rosterId, gem), rng, payout);
    recordPayout(record, payout, next.encountersWon);
    tally(record, run.actNumber, 'evolution', payout.evolutions.length);
  }
  return next;
}

function resolveScribe(run: RunState, rng: Rng, record: RunRecord, options: RunOptions): RunState {
  return landGems(run, rollGems(SCRIBE_GEMS, run.actNumber, rng), 'scribe', rng, record, options);
}

function resolveScrollCache(run: RunState, rng: Rng, record: RunRecord, options: RunOptions): RunState {
  return landGems(run, rollGems(GEM_CACHE_COUNT, run.actNumber, rng), 'cache', rng, record, options);
}

function resolveRewardNode(run: RunState, nodeType: MapNodeType, locationId: string, rng: Rng, record: RunRecord, options: RunOptions): RunState {
  switch (nodeType) {
    case 'scribeReward':
      return resolveScribe(run, rng, record, options);
    case 'scrollReward':
      return resolveScrollCache(run, rng, record, options);
    case 'recruitReward':
      return resolveRecruit(run, locationId, rng, record);
    case 'restReward':
      if (anyDown(run)) record.knockouts.restsWhileDown += 1;
      return mendRoster(run);
    case 'manaWellReward': {
      // The hero the pool is worth most to (policy.statBoostTarget) — the one screen that asks who.
      const target = policy.statBoostTarget(run.roster, 'manaPool');
      return target ? grantManaWell(run, target.rosterId) : run;
    }
    case 'blessingReward': {
      // The strongest hero not already Blessed: the carry is the one a turned-aside KO saves most.
      const target = policy.statBoostTarget(run.roster.filter(canBless), 'hp');
      return target ? grantBlessing(run, target.rosterId) : run;
    }
    case 'forgeReward':
      // The piece where the lift and the binding gain most.
      return resolveForge(run);
    case 'leyLineReward': {
      // Force pays only on the hero's own type's hits, so it goes to the strongest hero — the one
      // most fielded — which is what a player does with a typed grant it cannot mis-aim.
      const target = policy.passiveTarget(run.roster);
      return target ? grantLeyLine(run, target.rosterId, rosterHeroes) : run;
    }
    case 'equipmentReward': {
      // Three offered; the policy takes the one worth most to somebody. Equipment is a
      // power question, not a design experiment — the rarity curve is what's under test.
      const choices = pickWeightedEquipment(EQUIPMENT_POOL, 3, rarityWeightsFor(run.actNumber, 'cache'));
      if (choices.length === 0) return run;
      const best = choices.reduce((a, b) => ((policy.bestReceiver(run.roster, b)?.gain ?? 0) > (policy.bestReceiver(run.roster, a)?.gain ?? 0) ? b : a));
      return resolveDrop(run, best.id, record, run.actNumber, 'node');
    }
    case 'passiveReward': {
      // Offered 3 and taken at random — the pool is under test, not the policy. The TARGET is not
      // random though: a type-locked Boon goes to whoever has the most moves of its type, which
      // is what a player does, and measuring it on the strongest hero regardless would score the
      // type half of the pool as weaker than it is. Generic Boons ride the strongest hero.
      const offered = pickBoonOffers(run.roster, rosterHeroes, undefined, rng);
      if (offered.length === 0) return run;
      const picked = pick(rng, offered);
      const byFit = [...run.roster].sort(
        (a, b) => (boonMoveCount(passives[picked], b, moves) ?? 0) - (boonMoveCount(passives[picked], a, moves) ?? 0)
      );
      const target = boonMoveCount(passives[picked], run.roster[0], moves) === null ? policy.passiveTarget(run.roster) : byFit[0];
      if (!target) return run;
      record.choices.push({ bucket: 'boon', offered, picked: [picked], encountersWonAtChoice: run.encountersWon });
      return grantEventPassive(run, target.rosterId, picked, passives);
    }
    // The Mentor (acts 1-3): the act's XP onto one hero.
    case 'mentorReward':
      return resolveMentor(run, rng, record);
    case 'tutorReward':
      return resolveTutor(run, rng, record);
    case 'academyReward':
      return resolveAcademy(run, rng, record.choices);
    case 'event':
      return resolveEvent(run, locationId, rng, record);
    case 'camp':
      return resolveCamp(run, locationId, rng, record, options);
    default:
      return run;
  }
}

/** A focused pilot (docs/patrons.md): at a patron seat it takes the patron it trusts most; anywhere else, no say. */
function patronFocus(run: RunState, reachable: readonly string[]): string | null {
  const seats = reachable.filter((id) => run.map!.nodes[id].type === 'patronSeat');
  if (seats.length === 0) return null;
  const trustAt = (id: string) => {
    const node = run.map!.nodes[id];
    const seat = seatIndexFor(run.actNumber, node.row, PATRON_ROWS);
    const patronId = seat === null ? null : patronAtSeat(run, seat, node.col);
    return patronId ? trustOf(run, patronId) : -1;
  };
  return [...seats].sort((a, b) => trustAt(b) - trustAt(a))[0];
}

/** One meeting, every step paid the way the screen pays it: the student first, else the hero the step suits best. */
function resolvePatronMeeting(run: RunState, patronId: string, seat: number | null, rng: Rng, record: RunRecord): RunState {
  const met = meetPatron(run, patronId, seat);
  let next = met.run;
  const patron = patrons[patronId];
  record.choices.push({ bucket: 'patron', offered: [patronId], picked: [`${patronId}:${met.rung}`], encountersWonAtChoice: run.encountersWon });
  for (const step of patron.rungs[met.rung - 1]) next = resolvePatronStep(next, patronId, step, rng, record);
  return next;
}

function resolvePatronStep(run: RunState, patronId: string, step: PatronStep, rng: Rng, record: RunRecord): RunState {
  const patron = patrons[patronId];
  const student = patron.hasStudent ? studentOf(run, patronId) : null;
  const claim = (r: RunState, rosterId: string) => (patron.hasStudent && !studentOf(r, patronId) ? setStudent(r, patronId, rosterId) : r);
  const giveItem = (itemId: string): RunState => {
    const item = equipment[itemId];
    const roster = student ? run.roster.filter((e) => e.rosterId === student) : run.roster;
    const target = policy.bestReceiver(roster, item);
    if (!target || target.receipt.kind === 'replace') return run;
    return claim(absorbItem(run, target.rosterId, itemId, equipment, rosterHeroes), target.rosterId);
  };
  switch (step.kind) {
    case 'item':
      return giveItem(patronItemId(step.familyId, run.actNumber));
    case 'liftItem':
      return student && heldFamilyIndex(run, student, step.familyId) >= 0 ? liftHeldItem(run, student, step.familyId, equipment) : giveItem(patronItemId(step.familyId, run.actNumber));
    case 'unique':
      return student && heldFamilyIndex(run, student, step.familyId) >= 0 ? forgeUnique(run, student, step.familyId, step.uniqueId) : giveItem(step.uniqueId);
    case 'move': {
      const target = student ? run.roster.find((e) => e.rosterId === student)! : policy.passiveTarget(run.roster);
      if (!target || target.unlockedMoveIds.includes(step.moveId)) return target ? claim(run, target.rosterId) : run;
      if (target.unlockedMoveIds.length < MOVE_CAP) return claim(grantMove(run, target.rosterId, step.moveId), target.rosterId);
      const replaceId = policy.replacementTarget(target, step.moveId, run.roster);
      return claim(replaceId ? grantMove(run, target.rosterId, step.moveId, replaceId) : run, target.rosterId);
    }
    case 'passive': {
      const target = student ? run.roster.find((e) => e.rosterId === student)! : policy.passiveTarget(run.roster);
      return target ? claim(grantEventPassive(run, target.rosterId, step.passiveId, passives), target.rosterId) : run;
    }
    case 'class':
      return resolveAcademy(run, rng, record.choices, step.count);
    case 'masterClass': {
      const target = policy.passiveTarget(run.roster.filter((entry) => entry.classId !== null));
      if (!target) return run;
      const picked = classes[pick(rng, step.classIds)];
      const replaceId = picked.grantsMoveId ? policy.replacementTarget(target, picked.grantsMoveId, run.roster) : undefined;
      return grantClass(run, classes, target.rosterId, picked.id, replaceId ?? undefined);
    }
    case 'forge':
      return resolveForge(run);
    case 'fittedItem': {
      const target = policy.passiveTarget(run.roster);
      if (!target) return run;
      const hero = rosterHeroes[target.heroId];
      const rarity = fittedRarity(run.actNumber, step.tiersAhead);
      const weights = Object.fromEntries(RARITY_ORDER.map((r) => [r, r === rarity ? 1 : 0])) as Record<EquipmentRarity, number>;
      const item = rollFittingGear(hero.baseStats, rosterEntryTypes(hero, target), weights, rng);
      return item ? resolveDrop(run, item.id, record, run.actNumber, 'node') : run;
    }
    case 'uniqueChoice':
      return resolveDrop(run, pick(rng, step.uniqueIds), record, run.actNumber, 'node');
  }
}

/**
 * The Mentor (docs/mentor.md): the act's XP onto the lowest-levelled hero that can take it — the
 * cube lifts it furthest — and what the levels owe paid on the spot.
 */
function resolveMentor(run: RunState, rng: Rng, record: RunRecord): RunState {
  const target = [...run.roster].filter(canTrain).sort((a, b) => a.xp - b.xp || policy.powerScore(b) - policy.powerScore(a))[0];
  if (!target) return run;
  const trained = { ...run, roster: run.roster.map((e) => (e.rosterId === target.rosterId ? grantXp(e, rosterHeroes[e.heroId], mentorXpFor(run.actNumber), rng).entry : e)) };
  const payout = policy.emptyPayout();
  const next = policy.takeSchedule(trained, rng, payout);
  recordPayout(record, payout, next.encountersWon);
  return next;
}

/**
 * The Tutor (docs/tutor.md): a pick, not a roll — the most valuable move any hero can learn, on
 * the stronger hero when two tie, taken when there is room or it beats the worst one held.
 */
function resolveTutor(run: RunState, _rng: Rng, record: RunRecord): RunState {
  let best: { entry: RosterEntry; moveId: string; value: number } | null = null;
  for (const entry of run.roster) {
    for (const moveId of tutorMovePool(progressionTable, moves, entry)) {
      const value = policy.moveValue(moveId) + policy.powerScore(entry) * 0.01;
      if (!best || value > best.value) best = { entry, moveId, value };
    }
  }
  if (!best) return run;
  const { entry, moveId } = best;
  if (entry.unlockedMoveIds.length < MOVE_CAP) {
    recordMoveOfferMade(record, moveId, true);
    return grantOfferedMove(run, entry.rosterId, moveId);
  }
  const replaceId = policy.replacementTarget(entry, moveId, run.roster);
  recordMoveOfferMade(record, moveId, replaceId !== null);
  return replaceId ? grantOfferedMove(run, entry.rosterId, moveId, replaceId) : run;
}

/**
 * The Forge node (2026-09-24): the lift and the binding, free. The piece is the one where the work
 * gains most (`itemValueFor` after minus before), bound to its holder's innate primary — the one
 * read a player makes without a team model — or, for a hero whose primary has no enchant, left as it is bound.
 */
function resolveForge(run: RunState): RunState {
  let best: { rosterId: string; index: number; enchantId: EnchantmentId; gain: number } | null = null;
  for (const entry of policy.byPower(run.roster)) {
    const primary = heroes[entry.heroId]?.types[0];
    for (let index = 0; index < entry.equipment.length; index++) {
      const itemId = entry.equipment[index];
      const item = equipment[itemId];
      if (!item) continue;
      const enchantId = ENCHANTMENT_IDS.find((id) => ENCHANTMENTS[id] === primary) ?? parseEquipmentId(itemId).enchantId;
      if (!enchantId) continue;
      const targetId = forgeTarget(run, itemId, enchantId, equipment);
      if (!targetId) continue;
      const gain = policy.itemValueFor(entry, equipment[targetId] ?? null) - policy.itemValueFor(entry, item);
      if (!best || gain > best.gain) best = { rosterId: entry.rosterId, index, enchantId, gain };
    }
  }
  return best ? forgeItem(run, { rosterId: best.rosterId, index: best.index }, best.enchantId, equipment) : run;
}


function resolveEvent(run: RunState, locationId: string, rng: Rng, record: RunRecord): RunState {
  const event = rollRunEvent(runEvents, run.actNumber, locationId);
  if (!event) return run;
  // The roll is random among what is eligible here, so it is the same matched experiment the
  // node lift reads: which EVENT, against the others this event node could have been.
  const eligible = eligibleEvents(runEvents, run.actNumber, locationId).map((e) => e.id);
  if (eligible.length > 1) record.choices.push({ bucket: 'event', offered: eligible, picked: [event.id], encountersWonAtChoice: run.encountersWon });
  if (event.outcome.kind !== 'choice') return resolveEventOutcome(run, outcomeForAct(event.outcome, run.actNumber), event.cost, record);
  // A choice: the first option the pilot can use, else Leave.
  for (const option of event.outcome.options) {
    if (option.outcome.kind === 'recruit' && run.roster.length >= ROSTER_CAP) continue;
    return resolveEventOutcome(run, outcomeForAct(option.outcome, run.actNumber), option.cost, record);
  }
  return run;
}

function simMaxHp(entry: RosterEntry): number {
  const combatant = createCombatant('probe', entry.heroId, 'A', 0, 0);
  return getMaxHp(rosterHeroes[entry.heroId], {
    ...combatant,
    baselineStatModifiers: { ...entry.evolutionStatGrants, ...entry.bonusStatGrants },
  });
}

function resolveEventOutcome(run: RunState, outcome: ResolvableOutcome, cost: EventCost | undefined, record: RunRecord): RunState {
  const paid = () => applyEventCost(run, cost, simMaxHp);

  if (outcome.kind === 'learnMove') {
    const moveId = rollEventMove(outcome.pool, moves);
    const target = policy.passiveTarget(run.roster);
    if (!moveId || !target) return run;
    const entry = entryOf(run, target.rosterId);
    if (entry.unlockedMoveIds.includes(moveId)) return run;
    run = paid();
    // An event's gift never spends a level-up offer (grantMove).
    if (entry.unlockedMoveIds.length < MOVE_CAP) return grantMove(run, target.rosterId, moveId);
    const replaceId = policy.replacementTarget(entry, moveId, run.roster);
    return replaceId ? grantMove(run, target.rosterId, moveId, replaceId) : run;
  }

  if (outcome.kind === 'statShift') {
    // Trades are accepted whenever the floor allows and the hero can use what it gains.
    const candidates = run.roster.filter((entry) => statShiftAllowed(outcome.deltas, simMaxHp(entry)));
    const target = policy.passiveTarget(candidates);
    return target ? applyStatShift(paid(), target.rosterId, outcome.deltas) : run;
  }

  if (outcome.kind === 'grantPassive') {
    const target = policy.passiveTarget(run.roster);
    if (!target || !policy.passiveExists(outcome.passiveId)) return run;
    return grantEventPassive(paid(), target.rosterId, outcome.passiveId, passives);
  }

  if (outcome.kind === 'gamble') {
    const candidates = run.roster.filter(
      (entry) => heroOutcomeAllowed(outcome.win, simMaxHp(entry)) && heroOutcomeAllowed(outcome.lose, simMaxHp(entry))
    );
    const target = policy.passiveTarget(candidates);
    if (!target) return run;
    const branch = resolveGamble(outcome.chance) === 'win' ? outcome.win : outcome.lose;
    return applyHeroOutcome(paid(), target.rosterId, branch, passives);
  }

  if (outcome.kind === 'recruit') {
    // Fills an empty seat only: the pilot never trades a built hero for a raw one.
    if (run.roster.length >= ROSTER_CAP) return run;
    const [heroId] = rollRecruits(run, outcome.pool, 1, recruitPool(run, heroes));
    if (!heroId) return run;
    const next = paid();
    return joinEventRecruit(next, eventRecruitEntry(next, heroes[heroId], freshRosterId(next, heroId)));
  }

  // A curse rewrites a hero's typing for a payout ten pips away: the pilot cannot weigh that, so it walks on.
  if (outcome.kind === 'curse') return run;

  // loot
  let next = paid();
  const drops = pickWeightedEquipment(EQUIPMENT_POOL, outcome.count, rarityWeightsFor(run.actNumber, 'standard'));
  for (const item of drops) next = resolveDrop(next, item.id, record, run.actNumber, 'event');
  return next;
}

/** The Camp: the Mend when the roster is hurt enough, else the Gems while anyone can take one, else the Gear. */
function resolveCamp(run: RunState, locationId: string, rng: Rng, record: RunRecord, options: RunOptions): RunState {
  const act = run.actNumber;
  const doors = rollCampDoors(run, rng);
  // The Mend door when the roster is hurt enough for it; otherwise one of the other two at random.
  const hurt = anyWounded(run) && (anyDown(run) || policy.rosterHpFraction(run.roster) < 0.6);
  const door = hurt || doors.length === 1 ? doors[0] : pick(rng, doors.slice(1));
  if (door === doors[0] && anyDown(run)) record.knockouts.mendsWhileDown += 1;
  ledger(record, act, `camp:${door}`, 1);
  let next = run;
  for (const piece of campBundle(door)?.pieces ?? []) next = resolveCampPiece(next, piece, locationId, rng, record, options);
  return next;
}

function resolveCampPiece(run: RunState, piece: CampPiece, locationId: string, rng: Rng, record: RunRecord, options: RunOptions): RunState {
  const act = run.actNumber;
  switch (piece.kind) {
    case 'mend':
      return mendRoster(run);
    case 'gems': {
      // The stats taken at random off the shelf: the policy places them, as at every Gem screen.
      const shelf = rollCampGemShelf(act, piece.of, rng);
      return landGems(run, sample(rng, shelf, piece.take), 'camp', rng, record, options);
    }
    case 'gear': {
      // The pieces worth most to somebody.
      const gain = (id: string) => policy.bestReceiver(run.roster, equipment[id])?.gain ?? 0;
      const taken = rollCampGear(act, piece.of, rng).filter((id) => equipment[id]).sort((a, b) => gain(b) - gain(a)).slice(0, piece.take);
      return taken.reduce((next, id) => resolveDrop(next, id, record, act, 'camp'), run);
    }
    case 'blessing':
      return resolveRewardNode(run, 'blessingReward', locationId, rng, record, options);
    case 'boon':
      return resolveRewardNode(run, 'passiveReward', locationId, rng, record, options);
  }
}
