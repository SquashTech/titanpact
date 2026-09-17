// One headless run, node for node, mirroring src/app/App.tsx's orchestration.
// When this file and App.tsx disagree, App.tsx is right and this is a bug —
// the numbers are only worth reading while the two stay in step.

import type { StatKey } from '../../src/engine/content';
import { heroes } from '../../src/data/heroes';
import { rosterHeroes } from '../../src/data/content';
import { absorbCompanions, companionCandidate, companionJoinDue, joinCompanion } from '../../src/run/companion';
import { canBuyMend, buyMend, mendRoster, recordWounds } from '../../src/run/wounds';
import { moves } from '../../src/data/moves';
import { equipment } from '../../src/data/equipment';
import { relics, guardianBannerRelics } from '../../src/data/relics';
import { classes } from '../../src/data/classes';
import { runEvents } from '../../src/data/events';
import { progressionTable } from '../../src/data/progression';
import { enemies, finaleEnemies, ENDBRINGER_ID, titanEyes, EYE_IDS } from '../../src/data/enemies';
import { encounterKindOf, encounterSeedFor, nodeEncounter } from '../../src/run/encounters';
import { allCombatants } from '../../src/data/content';
import { guildHallOffers, CONTRACT_PURCHASE_COST } from '../../src/data/recruitment';
import { SCRIBE_PIPS_EACH, SCROLL_CACHE_COUNT, buyScroll, canBuyScroll, grantMastery } from '../../src/run/mastery';

import { createRunState, createRosterEntry, addRosterEntry, terminateRosterEntry, ROSTER_CAP, TOTAL_ACTS, type RunState, type RosterEntry } from '../../src/run/state';
import { generateMap, type MapNode, type MapNodeType } from '../../src/run/map';
import { generateStarterOptions, STARTER_PICK_COUNT } from '../../src/run/draft';
import { generateItinerary, locationForAct } from '../../src/run/locations';
import { locations } from '../../src/data/locations';
import { encounterScaling } from '../../src/run/difficulty';
import { encounterXpKind, grantEncounterLevels, levelOf, MAX_LEVEL } from '../../src/run/growth';
import { generateFinaleEncounter, type Encounter, type EncounterNodeType, generateTitanEncounter } from '../../src/run/enemyGen';
import { pickSquad, requiredSquadSize, STANDARD_SQUAD_SIZE, type Squad } from '../../src/run/squad';
import {
  absorbItem,
  itemReceiptFor,
  advanceToNode,
  advanceToNextAct,
  grantContractReward,
  grantCurrencyReward,
  grantRelicReward,
  anvilQuote,
  anvilUpgrade,
  enchantItem,
  reachableNodeIds,
  recordBrokenSeal,
  goldRangeFor,
  purseRangeFor,
  rollGoldRange,
  grantManaWell,
  forgeLift,
  grantLeyLine,
} from '../../src/run/runProgress';
import { MOVE_CAP, recordMoveOffer, grantOfferedMove, grantMove } from '../../src/run/progression';
import { claimContract, claimContractReplacing, deriveContractOffer, isRecruitable, pickContractOffers, recruitFromGuildHall, recruitFromGuildHallReplacing, freshRosterId, buyContract } from '../../src/run/recruitment';
import { guildHallEntry } from '../../src/run/guildRecruit';
import { ENCHANT_PRICE_BY_RARITY, rollGuildHallOffers, sellValueFor } from '../../src/run/shop';
import { mentorMovePool, tutorMovePool } from '../../src/run/tutor';
import { grantClass, rollClassOffers } from '../../src/run/classes';
import { boonMoveCount, pickBoonOffers } from '../../src/run/boons';
import { applyStatShift, grantEventPassive, rollRunEvent, rollEventMove, statShiftAllowed } from '../../src/run/events';
import {
  pickWeightedEquipment,
  rarityWeightsFor,
  EQUIPMENT_DROP_CHANCE,
  LOOT_SOURCE,
  ENCHANTMENT_IDS,
  ENCHANTMENTS,
  equipmentIdFor,
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

const EQUIPMENT_POOL = Object.values(equipment);
const STARTER_IDS = Object.values(heroes).filter((h) => h.starter).map((h) => h.id);

/** App.tsx `EncounterMapNodeType` — the reward lane keys off the MAP node, not the flattened encounter kind. */
type EncounterMapNodeType = 'fight' | 'skirmish' | 'battle' | 'elite' | 'boss' | 'finale' | 'titan';

// EQUIPMENT_DROP_CHANCE and LOOT_SOURCE come from run/equipment.ts, so the sim rolls the odds the game ships.

function goldRewardFor(nodeType: EncounterMapNodeType, actNumber: number, rng: Rng): number {
  return rollGoldRange(goldRangeFor(nodeType, actNumber), rng);
}

/** NodeRewardScreen's flat XP cache. */
const UPGRADE_REWARD_XP = 2;

// --- Records the aggregator consumes ---

export interface ChoiceEvent {
  bucket: 'banner' | 'boon' | 'evolution' | 'class' | 'draft' | 'node';
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
  playerHeroes: Record<string, { rounds: number; dealt: number; taken: number; healed: number; kos: number; died: boolean }>;
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
  /** The companion this run took, and the encounter count at which a knockout took it back (null = it survived, or never joined). */
  companionHeroId: string | null;
  companionLostAt: number | null;
  goldEnd: number;
  rosterLevelEnd: number;
  /** heroId -> best level reached this run, for every hero that was ever on the roster. */
  heroLevels: Record<string, number>;
  /** Share of the roster that had evolved when the run ended — the §11 target is 1.0. */
  rosterEvolvedEnd: number;
  fights: FightRecord[];
  choices: ChoiceEvent[];
  /** Rarity of every item actually equipped, keyed `act:rarity`. */
  equipped: string[];
  /** Mastery pips landed this run, by source (run/mastery.ts). */
  pipsBySource: Record<string, number>;
  /** Signatures owed at the tenth pip this run, by hero: times reached and times the kit took it. */
  signatures: Record<string, { reached: number; taken: number }>;
  /** Every rolled move offer (schedule, Mentor, Tutor, signature) by move id: times on the table, times the kit took it. */
  moveOffers: Record<string, { offered: number; taken: number }>;
  /** The gold ledger, keyed `act:earned:<fight|purse|sell>`, `act:spent:<mend|hire|scroll|anvil|enchant|contract>`, and `act:hall` (the purse on entering the Guild Hall, with `act:hallVisits` counting it). */
  goldFlow: Record<string, number>;
  /** Heroes joining after the draft: `contract` (claimed or bought), `hire` (Guild Hall). */
  recruitsBySource: Record<string, number>;
  /** Items obtained, keyed `act:source` — `drop` (a fight), `node` (Equipment Cache), `event` (a loot pile), `contract` (worn in by a claimed hero). */
  itemsBySource: Record<string, number>;
  /** Drops that merged into a held piece rather than taking a socket, and drops that COULD have (somebody held the family). */
  merges: number;
  mergeOffers: number;
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
  record.goldFlow[k] = (record.goldFlow[k] ?? 0) + amount;
}

function entryOf(run: RunState, rosterId: string): RosterEntry {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new Error(`${rosterId} left the roster`);
  return entry;
}

/**
 * The Crucible: one Class into one hero (docs/growth-overhaul.md §11). Three offered, one a kind,
 * taken at random — the catalog is under test, not the policy — and the target is the strongest
 * hero with no Class yet, since the screen offers only those and an offer nobody can take is
 * wasted. Random across the offer rather than greedy so the lift table lights up for all nine.
 */
function resolveCrucible(run: RunState, rng: Rng, choices: ChoiceEvent[]): RunState {
  const target = policy.passiveTarget(run.roster.filter((entry) => entry.classId === null));
  const offered = rollClassOffers(classes, rng);
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
function resolveDrop(run: RunState, itemId: string, record: RunRecord, actNumber: number, source: 'drop' | 'node' | 'event'): RunState {
  const item = equipment[itemId];
  if (!item || run.roster.length === 0) return run;
  record.itemsBySource[`${actNumber}:${source}`] = (record.itemsBySource[`${actNumber}:${source}`] ?? 0) + 1;
  const target = policy.bestReceiver(run.roster, item);
  if (run.roster.some((entry) => itemReceiptFor(entry, item, rosterHeroes[entry.heroId], equipment).kind === 'merge')) record.mergeOffers += 1;
  if (!target || target.gain <= 0) {
    ledger(record, actNumber, 'earned:sell', sellValueFor(item));
    return grantCurrencyReward(run, sellValueFor(item));
  }
  if (target.receipt.kind === 'merge') record.merges += 1;
  record.equipped.push(`${actNumber}:${target.receipt.kind === 'merge' ? target.receipt.resultRarity : item.rarity}`);
  return absorbItem(run, target.rosterId, itemId, equipment, rosterHeroes);
}

function rosterSquad(run: RunState, size: number): Squad {
  const required = requiredSquadSize(run.roster.length, size);
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
    companionHeroId: null,
    companionLostAt: null,
    encountersWon: 0,
    goldEnd: 0,
    goldFlow: {},
    rosterLevelEnd: 0,
    heroLevels: {},
    rosterEvolvedEnd: 0,
    fights: [],
    choices: [],
    equipped: [],
    pipsBySource: {},
    signatures: {},
    moveOffers: {},
    recruitsBySource: {},
    itemsBySource: {},
    merges: 0,
    mergeOffers: 0,
    timeByAct: Array.from({ length: TOTAL_ACTS + 1 }, emptyTimeCounts),
  };

  // --- Draft: 4 starters offered, 2 taken at random (the experiment). ---
  const draftOptions = generateStarterOptions(randomSeed(rng), STARTER_IDS);
  const drafted = sample(rng, draftOptions, STARTER_PICK_COUNT);
  record.choices.push({ bucket: 'draft', offered: draftOptions, picked: drafted, encountersWonAtChoice: 0 });
  tally(record, 1, 'draft');

  let run: RunState = createRunState(40);
  for (const heroId of drafted) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  run = { ...run, map: generateMap(randomSeed(rng)), locationIds: generateItinerary(randomSeed(rng)) };

  let alive = true;
  let guard = 0;

  while (alive && guard++ < 500) {
    record.actReached = Math.max(record.actReached, run.actNumber);
    const reachable = reachableNodeIds(run);
    if (reachable.length === 0) break;
    const nodeId = pick(rng, reachable);
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

    if (isEncounterNode(node.type)) {
      // The Guardian's drop lands after the act has advanced; it belongs to the act it was fought in.
      const foughtAct = run.actNumber;
      const outcome = resolveEncounterNode(run, node, location.id, rng, options, record);
      run = outcome.run;
      if (!outcome.won) {
        alive = false;
        record.deathAct = run.actNumber;
        record.deathNodeType = node.type;
        break;
      }
      if (node.type === 'titan') {
        record.won = true;
        break;
      }
      // The Herald is down: the one free mend before the Eyes (docs/titan-eyes.md §3).
      if (node.type === 'finale') run = mendRoster(run);
      run = advanceToNode(run, nodeId);
      run = { ...run, encountersWon: run.encountersWon + 1 };
      // A KO'd companion is gone from the run, before the levels roll (src/run/companion.ts).
      const absorbed = absorbCompanions(run, outcome.koRosterIds);
      if (absorbed.absorbed.length > 0) record.companionLostAt ??= run.encountersWon;
      run = absorbed.run;
      // Automatic and roster-wide, benched heroes included (src/run/growth.ts); the report pays
      // the schedule (docs/xp-overhaul.md §4).
      run = grantEncounterLevels(run, rosterHeroes, rng, encounterXpKind(node.type));
      tally(record, run.actNumber, 'levelUp');
      run = paySchedule(run, rng, record);
      record.encountersWon = run.encountersWon;
      // The run's first fight: one of the Earlies it beat joins, and there is no declining.
      const companionId = companionJoinDue(run, node.type) && outcome.encounter ? companionCandidate(outcome.encounter) : null;
      if (companionId) {
        run = joinCompanion(run, companionId, rosterHeroes, rng);
        record.companionHeroId = companionId;
        tally(record, run.actNumber, 'companion');
      }

      if (node.type === 'boss') {
        record.actsCleared.push(run.actNumber);
        run = grantContractReward(run, 1);
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
        // Guardian → Banner → Crucible (a Class) → Pact Seal.
        run = resolveCrucible(run, rng, record.choices);
        tally(record, run.actNumber, 'banner');
        tally(record, run.actNumber, 'crucible');
        tally(record, run.actNumber, 'pactSeal');
        if (run.actNumber < TOTAL_ACTS) {
          run = advanceToNextAct(run, randomSeed(rng));
          tally(record, run.actNumber, 'actIntro');
        }
        else {
          record.won = true;
          break;
        }
      }

      run = tryRecruitContracts(run, outcome.defeatedRoster, rng, record);
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

  record.goldEnd = run.gold;
  record.rosterEvolvedEnd =
    run.roster.length > 0 ? run.roster.filter((r) => r.chosenPathIds.length > 0).length / run.roster.length : 0;
  record.rosterLevelEnd =
    run.roster.length > 0 ? run.roster.reduce((sum, r) => sum + levelOf(r), 0) / run.roster.length : 0;
  for (const entry of run.roster) {
    record.heroLevels[entry.heroId] = Math.max(record.heroLevels[entry.heroId] ?? 0, levelOf(entry));
  }
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
  return type === 'fight' || type === 'skirmish' || type === 'battle' || type === 'elite' || type === 'boss' || type === 'finale' || type === 'titan';
}

interface EncounterOutcome {
  run: RunState;
  won: boolean;
  defeatedRoster: readonly RosterEntry[];
  drop: EquipmentDefinition | null;
  /** The enemy side as fielded — what the companion's join beat reads. */
  encounter: Encounter | null;
  /** The player's roster ids that ended the fight KO'd — what the companion's mortality reads. */
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

  if (mapNodeType === 'titan') {
    encounter = generateTitanEncounter(EYE_IDS, titanEyes, encounterSeedFor(run.map!, node.id), encounterScaling('titan', TOTAL_ACTS));
    squadSize = ROSTER_CAP;
  } else if (mapNodeType === 'finale') {
    // The shipped finale (App.tsx): the Herald leading Late spawn. SIM_FINALE=guardians replays the
    // unsealed-Guardian shape it replaced, SIM_FINALE=spawnLast the spawn with the Herald entering last.
    const finaleEscorts =
      process.env.SIM_FINALE === 'guardians'
        ? undefined
        : { spawnTypesFor: (locationId: string) => locations[locationId]?.spawnTypes ?? null, heraldLeads: process.env.SIM_FINALE !== 'spawnLast' };
    encounter = generateFinaleEncounter(
      run.brokenSeals,
      location.guardianFinalEnemyId ?? ENDBRINGER_ID,
      finaleEnemies,
      encounterSeedFor(run.map!, node.id),
      encounterScaling('finale', TOTAL_ACTS),
      finaleEscorts
    );
    squadSize = ROSTER_CAP;
  } else {
    // The same deterministic draw the game makes (run/encounters.ts): seeded off the map, so the
    // sim's own rng is not consulted here and a map seed reproduces its fights.
    const encounterKind = encounterKindOf(mapNodeType as Exclude<EncounterMapNodeType, 'finale' | 'titan'>);
    encounter = nodeEncounter(node, { run, location, heroes, allCombatants, enemies, progression: progressionTable });
    if (encounterKind === 'fight') workingRun = { ...workingRun, fightsStarted: workingRun.fightsStarted + 1 };
  }

  const drop = rng() < EQUIPMENT_DROP_CHANCE[kindKey]
    ? pickWeightedEquipment(EQUIPMENT_POOL, 1, rarityWeightsFor(workingRun.actNumber, LOOT_SOURCE[kindKey]))[0] ?? null
    : null;

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
  });

  const playerHeroes: FightRecord['playerHeroes'] = {};
  const enemyHeroes: FightRecord['enemyHeroes'] = {};
  for (const t of Object.values(fight.telemetry)) {
    if (t.side === PLAYER_SIDE) {
      const slot = (playerHeroes[t.heroId] ??= { rounds: 0, dealt: 0, taken: 0, healed: 0, kos: 0, died: false });
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

  const goldWon = goldRewardFor(kindKey, workingRun.actNumber, rng);
  ledger(record, workingRun.actNumber, 'earned:fight', goldWon);
  workingRun = grantCurrencyReward(workingRun, goldWon);
  // HP carries to the next node (src/run/wounds.ts); the act's end is what makes the roster whole.
  workingRun = recordWounds(workingRun, fight.final, PLAYER_SIDE, rosterHeroes);
  return { run: workingRun, won: true, defeatedRoster: encounter.run.roster, drop, encounter, koRosterIds };
}

/** The Guardian's Banner: a fixed 1-of-5, taken at random. */
function claimBanner(run: RunState, rng: Rng, record: RunRecord): RunState {
  const offered = guardianBannerRelics.map((r) => r.id);
  const picked = pick(rng, offered);
  record.choices.push({ bucket: 'banner', offered, picked: [picked], encountersWonAtChoice: run.encountersWon });
  return grantRelicReward(run, picked);
}

/** A beaten hero-pool enemy can be claimed with a contract. Free power below the cap; above it, only for a real upgrade. */
function tryRecruitContracts(run: RunState, defeatedRoster: readonly RosterEntry[], rng: Rng, record: RunRecord): RunState {
  if (run.recruitContracts <= 0) return run;
  const eligible = defeatedRoster.filter((entry) => isRecruitable(entry.heroId, heroes));
  const offers = pickContractOffers(eligible);
  if (offers.length === 0) return run;
  tally(record, run.actNumber, 'contract');
  const best = policy.byPower(offers)[0];
  const offer = deriveContractOffer(best);
  const rosterId = freshRosterId(run, best.heroId);
  // A contract arrives armed (docs/gear-absorption.md §7): its gear counts as obtained and worn.
  for (const itemId of offer.equipment) {
    const item = equipment[itemId];
    if (!item) continue;
    record.itemsBySource[`${run.actNumber}:contract`] = (record.itemsBySource[`${run.actNumber}:contract`] ?? 0) + 1;
    record.equipped.push(`${run.actNumber}:${item.rarity}`);
  }

  if (run.roster.length < ROSTER_CAP) {
    record.recruitsBySource.contract = (record.recruitsBySource.contract ?? 0) + 1;
    return claimContract(run, offer, rosterId);
  }
  const weakest = policy.byPower(run.roster)[run.roster.length - 1];
  if (policy.powerScore(best) <= policy.powerScore(weakest)) return run;
  record.recruitsBySource.contractReplacing = (record.recruitsBySource.contractReplacing ?? 0) + 1;
  return claimContractReplacing(run, offer, rosterId, weakest.rosterId);
}

/**
 * Pips onto one hero (policy.scrollTarget), and what they open paid on the spot — the Scribe's
 * two picks, a shelf Scroll. The Evolution is logged as the choice it is, as the report's is.
 */
function landPips(run: RunState, rosterId: string, pips: number, source: string, rng: Rng, record: RunRecord): RunState {
  record.pipsBySource[source] = (record.pipsBySource[source] ?? 0) + pips;
  const payout = policy.emptyPayout();
  const next = policy.payMastery(grantMastery(run, rosterId, pips), rng, payout);
  recordPayout(record, payout, next.encountersWon);
  tally(record, run.actNumber, 'evolution', payout.evolutions.length);
  return next;
}

/** The Scribe: two heroes, SCRIBE_PIPS_EACH each, the policy's two. */
function resolveScribe(run: RunState, rng: Rng, record: RunRecord, options: RunOptions): RunState {
  let next = run;
  for (const target of policy.scribeTargets(run.roster, options.levelPolicy)) next = landPips(next, target.rosterId, SCRIBE_PIPS_EACH, 'scribe', rng, record);
  return next;
}

/** The Scroll Cache: SCROLL_CACHE_COUNT pips one at a time, each to the hero the policy names as it stands after the last. */
function resolveScrollCache(run: RunState, rng: Rng, record: RunRecord, options: RunOptions): RunState {
  let next = run;
  for (let i = 0; i < SCROLL_CACHE_COUNT; i++) {
    const target = policy.scrollTarget(next.roster, options.levelPolicy);
    if (!target) break;
    next = landPips(next, target.rosterId, 1, 'cache', rng, record);
  }
  return next;
}

function resolveRewardNode(run: RunState, nodeType: MapNodeType, locationId: string, rng: Rng, record: RunRecord, options: RunOptions): RunState {
  switch (nodeType) {
    case 'scribeReward':
      return resolveScribe(run, rng, record, options);
    case 'scrollReward':
      return resolveScrollCache(run, rng, record, options);
    case 'currencyReward': {
      const purse = rollGoldRange(purseRangeFor(run.actNumber), rng);
      ledger(record, run.actNumber, 'earned:purse', purse);
      return grantCurrencyReward(run, purse);
    }
    case 'restReward':
      return mendRoster(run);
    case 'manaWellReward': {
      // The hero the pool is worth most to (policy.statBoostTarget) — the one screen that asks who.
      const target = policy.statBoostTarget(run.roster, 'manaPool');
      return target ? grantManaWell(run, target.rosterId) : run;
    }
    case 'forgeReward':
      // The Anvil's pick with no price on it: the most valuable liftable piece on the strongest hero.
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
      const choices = pickWeightedEquipment(EQUIPMENT_POOL, 3, rarityWeightsFor(run.actNumber, 'standard'));
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
    // The Mentor (acts 1-3): one Mid move ROLLED for the hero whose Mid pool is worth most.
    case 'mentorReward':
      return resolveMentor(run, rng, record);
    case 'tutorReward':
      return resolveTutor(run, rng, record);
    case 'event':
      return resolveEvent(run, locationId, rng, record);
    case 'shop':
    case 'muster':
      return resolveShop(run, nodeType === 'muster', rng, record, options);
    default:
      return run;
  }
}

/**
 * The Mentor: a Mid move rolled for one hero (docs/growth-overhaul.md §11). The hero is the one
 * whose Mid pool is worth most on average — WHO is the player's only decision — and the roll is
 * the roll. Taken when it beats the worst move held (or there is room), declined otherwise; the
 * offer burns either way, as a Scroll's does.
 */
function resolveMentor(run: RunState, rng: Rng, record: RunRecord): RunState {
  return resolveTierRoll(run, rng, mentorMovePool, record);
}

function resolveTierRoll(run: RunState, rng: Rng, poolOf: typeof mentorMovePool, record: RunRecord): RunState {
  let best: { entry: RosterEntry; value: number } | null = null;
  for (const entry of run.roster) {
    const pool = poolOf(progressionTable, moves, entry);
    if (pool.length === 0) continue;
    const value = pool.reduce((sum, id) => sum + policy.moveValue(id), 0) / pool.length + policy.powerScore(entry) * 0.01;
    if (!best || value > best.value) best = { entry, value };
  }
  if (!best) return run;
  const pool = poolOf(progressionTable, moves, best.entry);
  const moveId = pick(rng, pool);
  const next = recordMoveOffer(run, best.entry.rosterId, [moveId]);
  if (best.entry.unlockedMoveIds.length < MOVE_CAP) {
    recordMoveOfferMade(record, moveId, true);
    return grantOfferedMove(next, best.entry.rosterId, moveId);
  }
  const replaceId = policy.replacementTarget(best.entry, moveId, run.roster);
  recordMoveOfferMade(record, moveId, replaceId !== null);
  return replaceId ? grantOfferedMove(next, best.entry.rosterId, moveId, replaceId) : next;
}

/**
 * The Tutor: the Mentor's beat at Late (src/run/tutor.ts) — the hero whose Late pool is worth
 * most on average takes the roll, and the move is taken when it beats the worst one held.
 */
function resolveTutor(run: RunState, rng: Rng, record: RunRecord): RunState {
  return resolveTierRoll(run, rng, tutorMovePool, record);
}

/**
 * The Guild Hall's Anvil: one lift a visit, the most valuable item on the strongest hero that can
 * afford it.
 */
function resolveAnvil(run: RunState): RunState {
  let next = run;
  for (const entry of policy.byPower(next.roster)) {
    let bestIndex = -1;
    let bestValue = -Infinity;
    entry.equipment.forEach((itemId, index) => {
      const quote = anvilQuote(next, itemId, equipment);
      if (!quote || quote.cost > next.gold) return;
      const value = policy.itemValueFor(entry, equipment[itemId] ?? null);
      if (value > bestValue) {
        bestValue = value;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0) {
      next = anvilUpgrade(next, { rosterId: entry.rosterId, index: bestIndex }, equipment);
      break;
    }
  }
  return next;
}

/** The Forge node: the Anvil's pick, free — the most valuable liftable piece on the strongest hero. */
function resolveForge(run: RunState): RunState {
  for (const entry of policy.byPower(run.roster)) {
    let bestIndex = -1;
    let bestValue = -Infinity;
    entry.equipment.forEach((itemId, index) => {
      if (!anvilQuote(run, itemId, equipment)) return;
      const value = policy.itemValueFor(entry, equipment[itemId] ?? null);
      if (value > bestValue) {
        bestValue = value;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0) return forgeLift(run, { rosterId: entry.rosterId, index: bestIndex }, equipment);
  }
  return run;
}

/**
 * The Guild Hall's Enchanter (2026-09-17): one binding a visit. An Elemental Force pays its
 * magnitude only to a hero that casts the type, so the only element ever bought for a piece is its
 * holder's innate primary — the one read a player makes without a team model — and the piece bound
 * is the one where that gains most (`itemValueFor` after minus before, so a piece already bound to
 * its holder's type is never re-bought). Left alone until the gold ledger showed the pilot walking
 * out of Acts 4–5 with 70g it had no verb for.
 */
function resolveEnchanter(run: RunState): RunState {
  let best: { rosterId: string; index: number; enchantId: EnchantmentId; gain: number } | null = null;
  for (const entry of policy.byPower(run.roster)) {
    const primary = heroes[entry.heroId]?.types[0];
    const enchantId = ENCHANTMENT_IDS.find((id) => ENCHANTMENTS[id] === primary);
    if (!enchantId) continue;
    for (let index = 0; index < entry.equipment.length; index++) {
      const item = equipment[entry.equipment[index]];
      if (!item || item.enchantId === enchantId || ENCHANT_PRICE_BY_RARITY[item.rarity] > run.gold) continue;
      const parsed = parseEquipmentId(item.id);
      const target = equipment[equipmentIdFor(parsed.base, parsed.rarity, enchantId)];
      if (!target) continue;
      const gain = policy.itemValueFor(entry, target) - policy.itemValueFor(entry, item);
      if (gain > 0 && (!best || gain > best.gain)) best = { rosterId: entry.rosterId, index, enchantId, gain };
    }
  }
  return best ? enchantItem(run, { rosterId: best.rosterId, index: best.index }, best.enchantId, equipment) : run;
}

function resolveEvent(run: RunState, locationId: string, rng: Rng, record: RunRecord): RunState {
  const event = rollRunEvent(runEvents, run.actNumber, locationId);
  if (!event) return run;
  const outcome = event.outcome;

  if (outcome.kind === 'learnMove') {
    const moveId = rollEventMove(outcome.pool, moves);
    const target = policy.passiveTarget(run.roster);
    if (!moveId || !target) return run;
    const entry = entryOf(run, target.rosterId);
    if (entry.unlockedMoveIds.includes(moveId)) return run;
    // An event's gift never spends a level-up offer (grantMove).
    if (entry.unlockedMoveIds.length < MOVE_CAP) return grantMove(run, target.rosterId, moveId);
    const replaceId = policy.replacementTarget(entry, moveId, run.roster);
    return replaceId ? grantMove(run, target.rosterId, moveId, replaceId) : run;
  }

  if (outcome.kind === 'statShift') {
    // Trades are accepted whenever the floor allows and the hero can use what it gains.
    const candidates = run.roster.filter((entry) => {
      const combatant = createCombatant('probe', entry.heroId, 'A', 0, 0);
      const maxHp = getMaxHp(rosterHeroes[entry.heroId], {
        ...combatant,
        baselineStatModifiers: { ...entry.evolutionStatGrants, ...entry.bonusStatGrants },
      });
      return statShiftAllowed(outcome.deltas, maxHp);
    });
    const target = policy.passiveTarget(candidates);
    return target ? applyStatShift(run, target.rosterId, outcome.deltas) : run;
  }

  if (outcome.kind === 'grantPassive') {
    const target = policy.passiveTarget(run.roster);
    if (!target || !policy.passiveExists(outcome.passiveId)) return run;
    return grantEventPassive(run, target.rosterId, outcome.passiveId, passives);
  }

  // loot
  let next = run;
  const drops = pickWeightedEquipment(EQUIPMENT_POOL, outcome.count, rarityWeightsFor(run.actNumber, 'standard'));
  for (const item of drops) next = resolveDrop(next, item.id, record, run.actNumber, 'event');
  return next;
}

/** Guild Hall: fill empty roster slots first, then Scrolls, then the Anvil, then bank the rest. */
function resolveShop(run: RunState, muster: boolean, rng: Rng, record: RunRecord, options: RunOptions): RunState {
  let next = run;
  const offers = rollGuildHallOffers(next, guildHallOffers, muster);
  const act = run.actNumber;
  ledger(record, act, 'hall', run.gold);
  ledger(record, act, 'hallVisits', 1);
  const spend = (key: string, fn: () => RunState) => {
    const before = next.gold;
    next = fn();
    ledger(record, act, `spent:${key}`, before - next.gold);
  };

  // The mend first, when the roster is hurt enough for it to be worth a hire's price.
  if (canBuyMend(next) && policy.rosterHpFraction(next.roster) < 0.6) spend('mend', () => buyMend(next));

  for (const offerId of offers.heroOfferIds) {
    const offer = guildHallOffers.find((o) => o.id === offerId);
    if (!offer || next.gold < offer.cost) continue;
    const rosterId = freshRosterId(next, offer.heroId);
    if (next.roster.length < ROSTER_CAP) {
      record.recruitsBySource.hire = (record.recruitsBySource.hire ?? 0) + 1;
      spend('hire', () => recruitFromGuildHall(next, offer, rosterId));
      continue;
    }
    // A hire arrives raw and one act behind (guildHallEntry), so it replaces only a hero it outscores as-is.
    const weakest = policy.byPower(next.roster)[next.roster.length - 1];
    if (policy.powerScore(weakest) < policy.powerScore(guildHallEntry(next, offer, rosterId))) {
      record.recruitsBySource.hireReplacing = (record.recruitsBySource.hireReplacing ?? 0) + 1;
      spend('hire', () => recruitFromGuildHallReplacing(next, offer, rosterId, weakest.rosterId));
    }
  }

  // The shelf's Mastery Scrolls (SCROLL_PURCHASE_LIMIT a visit), bought while somebody can still
  // take one and the gold is there, to the hero the policy names.
  for (let bought = 0; canBuyScroll(next, bought); bought++) {
    const target = policy.scrollTarget(next.roster, options.levelPolicy);
    if (!target) break;
    spend('scroll', () => landPips(buyScroll(next, bought), target.rosterId, 1, 'shelf', rng, record));
  }

  spend('anvil', () => resolveAnvil(next));
  spend('enchant', () => resolveEnchanter(next));

  // Spare gold at the last shop before a Guardian buys a contract rather than rusting.
  if (next.gold >= CONTRACT_PURCHASE_COST && next.roster.length < ROSTER_CAP) {
    spend('contract', () => buyContract(next, CONTRACT_PURCHASE_COST));
  }
  return next;
}
