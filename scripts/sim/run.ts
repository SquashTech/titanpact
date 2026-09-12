// One headless run, node for node, mirroring src/app/App.tsx's orchestration.
// When this file and App.tsx disagree, App.tsx is right and this is a bug —
// the numbers are only worth reading while the two stay in step.

import type { StatKey } from '../../src/engine/content';
import { heroes } from '../../src/data/heroes';
import { moves } from '../../src/data/moves';
import { equipment } from '../../src/data/equipment';
import { relics, guardianBannerRelics } from '../../src/data/relics';
import { classes } from '../../src/data/classes';
import { runEvents } from '../../src/data/events';
import { progressionTable } from '../../src/data/progression';
import { enemies, factions, basicEnemiesOf, finaleEnemies, ENDBRINGER_ID } from '../../src/data/enemies';
import { guildHallOffers, CONTRACT_PURCHASE_COST, SCROLL_PURCHASE_COST, SCROLL_PURCHASE_LIMIT } from '../../src/data/recruitment';

import { createRunState, createRosterEntry, addRosterEntry, terminateRosterEntry, ROSTER_CAP, TOTAL_ACTS, type RunState, type RosterEntry } from '../../src/run/state';
import { generateMap, type MapNodeType } from '../../src/run/map';
import { generateStarterOptions, STARTER_PICK_COUNT } from '../../src/run/draft';
import { generateItinerary, locationBias, locationForAct } from '../../src/run/locations';
import { actScaling, encounterHeroCountOverride, type ScalingTrack } from '../../src/run/difficulty';
import { grantEncounterLevels, levelsForEncounter, MAX_LEVEL } from '../../src/run/growth';
import { generateEncounter, generateLeaderEncounter, generateFinaleEncounter, appendFinalEnemy, type Encounter, type EncounterNodeType } from '../../src/run/enemyGen';
import { pickSquad, requiredSquadSize, STANDARD_SQUAD_SIZE, type Squad } from '../../src/run/squad';
import {
  advanceToNode,
  advanceToNextAct,
  equipToRoster,
  grantContractReward,
  grantCurrencyReward,
  grantItemSlot,
  grantRelicReward,
  anvilQuote,
  anvilUpgrade,
  buyItemSlot,
  slotQuote,
  reachableNodeIds,
  recordBrokenSeal,
  sellFromStash,
  GOLD_REWARD_RANGE,
  PURSE_GOLD_RANGE,
  rollGoldRange,
} from '../../src/run/runProgress';
import {
  MOVE_CAP,
  SCROLLS_PER_ACT,
  SCROLLS_PER_ELITE,
  SCROLLS_PER_FIGHT,
  SCROLLS_PER_SKIRMISH,
  SCROLL_REWARD_COUNT,
  LONE_SCROLL_COUNT,
  grantMasteryScrolls,
  canSpendScroll,
  recordMoveOffer,
  masteryRank,
  grantOfferedMove,
  itemSlotsFor,
  grantMove,
} from '../../src/run/progression';
import { claimContract, claimContractReplacing, deriveContractOffer, isRecruitable, pickContractOffers, recruitFromGuildHall, recruitFromGuildHallReplacing, freshRosterId, buyContract, buyMasteryScroll } from '../../src/run/recruitment';
import { guildHallEntry } from '../../src/run/guildRecruit';
import { rollGuildHallOffers, buyEquipment, sellValueFor, EQUIPMENT_PRICE_BY_RARITY } from '../../src/run/shop';
import { mentorMovePool, tutorMovePool } from '../../src/run/tutor';
import { grantClass, rollClassOffers } from '../../src/run/classes';
import { boonMoveCount, pickBoonOffers } from '../../src/run/boons';
import { applyStatShift, grantEventPassive, rollRunEvent, rollEventMove, statShiftAllowed } from '../../src/run/events';
import { MAX_ITEM_SLOTS, pickWeightedEquipment, rarityWeightsFor, EQUIPMENT_DROP_CHANCE, LOOT_SOURCE, type EquipmentDefinition } from '../../src/run/equipment';
import { passives } from '../../src/data/passives';
import { getMaxHp } from '../../src/engine/state';
import { createCombatant } from '../../src/engine/state';

import { simulateFight, PLAYER_SIDE, type PilotKind } from './fight';
import * as policy from './policy';
import type { PourEvolution } from './policy';
import { makeRng, pick, randomSeed, sample, withRandom, type Rng } from './rng';

const EQUIPMENT_POOL = Object.values(equipment);
const STARTER_IDS = Object.values(heroes).filter((h) => h.starter).map((h) => h.id);

/** App.tsx `EncounterMapNodeType` — the reward lane keys off the MAP node, not the flattened encounter kind. */
type EncounterMapNodeType = 'fight' | 'skirmish' | 'battle' | 'elite' | 'boss' | 'finale';

// EQUIPMENT_DROP_CHANCE and LOOT_SOURCE come from run/equipment.ts, so the sim rolls the odds the game ships.

function goldRewardFor(nodeType: EncounterMapNodeType, rng: Rng): number {
  return rollGoldRange(GOLD_REWARD_RANGE[nodeType], rng);
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
  goldEnd: number;
  rosterLevelEnd: number;
  /** heroId -> best level reached this run, for every hero that was ever on the roster. */
  heroLevels: Record<string, number>;
  /** Best Mastery Rank each hero reached — the movepool gate now that level does not gate it. */
  /** Best `masteryScrollsSpent` seen per hero — rank, Evolution and Late are all read off it. */
  heroScrolls: Record<string, number>;
  /** Share of the roster that had evolved when the run ended — the §11 target is 1.0. */
  rosterEvolvedEnd: number;
  fights: FightRecord[];
  choices: ChoiceEvent[];
  /** Rarity of every item actually equipped, keyed `act:rarity`. */
  equipped: string[];
  /** Scrolls granted this run, by source; `unspent` is what nobody could take. */
  scrollsBySource: Record<string, number>;
  /** Heroes joining after the draft: `contract` (claimed or bought), `hire` (Guild Hall). */
  recruitsBySource: Record<string, number>;
}

// --- Helpers ---

function entryOf(run: RunState, rosterId: string): RosterEntry {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new Error(`${rosterId} left the roster`);
  return entry;
}

/** What a won fight pays in Scrolls, by lane — App.tsx scrollRewardFor, mirrored. */
function scrollRewardFor(nodeType: MapNodeType): number {
  switch (nodeType) {
    case 'elite':
      return SCROLLS_PER_ELITE;
    case 'skirmish':
      return SCROLLS_PER_SKIRMISH;
    case 'fight':
    case 'battle':
      return SCROLLS_PER_FIGHT;
    default:
      return 0;
  }
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
  const replaceId = picked.grantsMoveId ? policy.replacementTarget(target, picked.grantsMoveId) : undefined;
  return grantClass(run, classes, target.rosterId, picked.id, replaceId ?? undefined);
}

/**
 * The item policy: worn by whoever gains most, and everything else sold. The greedy wearer
 * never wants what it just displaced, so draining the bag each time also keeps it from filling
 * and refusing the next swap — this sim models the floor of the stash, not its use.
 */
function resolveDrop(run: RunState, itemId: string, equipped: string[], actNumber: number): RunState {
  const item = equipment[itemId];
  if (!item || run.roster.length === 0) return run;
  const target = policy.bestWearer(run.roster, item);
  if (!target || target.gain <= 0) return grantCurrencyReward(run, sellValueFor(item));
  equipped.push(`${actNumber}:${item.rarity}`);
  let next = equipToRoster(run, target.rosterId, itemId, equipment, heroes, target.replaceIndex);
  while (next.stash.length > 0) next = sellFromStash(next, 0, equipment);
  return next;
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
    encountersWon: 0,
    goldEnd: 0,
    rosterLevelEnd: 0,
    heroLevels: {},
    heroScrolls: {},
    rosterEvolvedEnd: 0,
    fights: [],
    choices: [],
    equipped: [],
    scrollsBySource: {},
    recruitsBySource: {},
  };

  // --- Draft: 4 starters offered, 2 taken at random (the experiment). ---
  const draftOptions = generateStarterOptions(randomSeed(rng), STARTER_IDS);
  const drafted = sample(rng, draftOptions, STARTER_PICK_COUNT);
  record.choices.push({ bucket: 'draft', offered: draftOptions, picked: drafted, encountersWonAtChoice: 0 });

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

    for (const entry of run.roster) {
      record.heroLevels[entry.heroId] = Math.max(record.heroLevels[entry.heroId] ?? 0, entry.level);
      record.heroScrolls[entry.heroId] = Math.max(record.heroScrolls[entry.heroId] ?? 0, entry.masteryScrollsSpent);
    }

    if (isEncounterNode(node.type)) {
      const outcome = resolveEncounterNode(run, node.type, location.id, rng, options, record);
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
      // Automatic and roster-wide, benched heroes included (src/run/growth.ts).
      run = grantEncounterLevels(run, heroes, rng);
      record.encountersWon = run.encountersWon;

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
            level: champion.level,
            statGrants: champion.evolutionStatGrants,
          });
        }
        // Guardian → Banner → Crucible (a Class) → Pact Seal.
        run = resolveCrucible(run, rng, record.choices);
        run = grantScrolls(run, SCROLLS_PER_ACT, 'guardian', record);
        if (run.actNumber < TOTAL_ACTS) {
          run = advanceToNextAct(run, randomSeed(rng));
        }
        else {
          record.won = true;
          break;
        }
      }

      run = tryRecruitContracts(run, outcome.defeatedRoster, rng, record);
      if (outcome.drop) run = resolveDrop(run, outcome.drop.id, record.equipped, run.actNumber);
      // The fight's Scrolls, by lane (docs/growth-overhaul.md §11); the Guardian's are above.
      if (node.type !== 'boss') run = grantScrolls(run, scrollRewardFor(node.type), node.type, record);
      run = pourHeldScrolls(run, rng, record);
      continue;
    }

    run = resolveRewardNode(run, node.type, location.id, rng, record, options);
    run = pourHeldScrolls(run, rng, record);
    run = advanceToNode(run, nodeId);
  }

  record.goldEnd = run.gold;
  if (run.masteryScrolls > 0) record.scrollsBySource.unspent = run.masteryScrolls;
  record.rosterEvolvedEnd =
    run.roster.length > 0 ? run.roster.filter((r) => r.chosenPathIds.length > 0).length / run.roster.length : 0;
  record.rosterLevelEnd =
    run.roster.length > 0 ? run.roster.reduce((sum, r) => sum + r.level, 0) / run.roster.length : 0;
  for (const entry of run.roster) {
    record.heroLevels[entry.heroId] = Math.max(record.heroLevels[entry.heroId] ?? 0, entry.level);
    record.heroScrolls[entry.heroId] = Math.max(record.heroScrolls[entry.heroId] ?? 0, entry.masteryScrollsSpent);
  }
  return record;
}

/**
 * A Scroll is poured where it is won, never held (App.tsx `masteryDue`): last in the post-fight
 * chain, after the contract and the Crucible, and on the way out of a Cache or the Guild Hall. The
 * 6th into a hero evolves it (policy.pourScrolls), logged here as the choice it is.
 */
function pourHeldScrolls(run: RunState, rng: Rng, record: RunRecord): RunState {
  if (run.masteryScrolls <= 0) return run;
  const evolutions: PourEvolution[] = [];
  const next = policy.pourScrolls(run, rng, evolutions);
  for (const e of evolutions) {
    record.choices.push({ bucket: 'evolution', offered: e.offered, picked: [e.picked], encountersWonAtChoice: next.encountersWon });
  }
  return next;
}

function isEncounterNode(type: MapNodeType): boolean {
  return type === 'fight' || type === 'skirmish' || type === 'battle' || type === 'elite' || type === 'boss' || type === 'finale';
}

interface EncounterOutcome {
  run: RunState;
  won: boolean;
  defeatedRoster: readonly RosterEntry[];
  drop: EquipmentDefinition | null;
}

function resolveEncounterNode(
  run: RunState,
  mapNodeType: MapNodeType,
  locationId: string,
  rng: Rng,
  options: RunOptions,
  record: RunRecord
): EncounterOutcome {
  const location = locationForAct(run.locationIds, run.actNumber);
  const kindKey = mapNodeType as EncounterMapNodeType;
  const isRunOpener = run.actNumber === 1 && run.encountersWon === 0;
  let encounter: Encounter;
  let squadSize = STANDARD_SQUAD_SIZE;
  let workingRun = run;

  if (mapNodeType === 'finale') {
    encounter = generateFinaleEncounter(
      run.brokenSeals,
      location.guardianFinalEnemyId ?? ENDBRINGER_ID,
      finaleEnemies,
      // The skirmish track, matching App.tsx: baselining the Endbringer against its own act paid it zero steps.
      actScaling('skirmish', TOTAL_ACTS)
    );
    squadSize = ROSTER_CAP;
  } else {
    const isMobFight = mapNodeType === 'fight' || mapNodeType === 'battle';
    // Guardians field their own faction (App.tsx handleSelectNode). Pool only — the track below is unchanged.
    const isFactionFight = isMobFight || mapNodeType === 'boss';
    const faction = factions[location.factionId];
    const encounterKind: EncounterNodeType =
      mapNodeType === 'skirmish' || mapNodeType === 'battle' ? 'fight' : (mapNodeType as EncounterNodeType);
    const isSecondFight = encounterKind === 'fight' && run.fightsStarted === 1;
    const track: ScalingTrack = isMobFight ? 'monsters' : 'skirmish';
    const scaling = actScaling(track, run.actNumber, isMobFight ? faction.baselineAct : undefined);

    if (mapNodeType === 'battle') {
      encounter = generateLeaderEncounter(randomSeed(rng), faction.basicIds, faction.leaderId, enemies, scaling);
    } else {
      const encounterPool = isFactionFight ? basicEnemiesOf(faction) : heroes;
      const excludeHeroIds = encounterPool === heroes ? run.roster.map((r) => r.heroId) : undefined;
      const standardCount = encounterKind === 'boss' ? 2 : 4;
      const heroCountOverride =
        mapNodeType === 'fight' || isSecondFight
          ? 2
          : encounterHeroCountOverride(mapNodeType, workingRun.actNumber, workingRun.roster.length, standardCount);
      const heroCount = heroCountOverride ?? standardCount;
      const bias = encounterPool === heroes ? locationBias(location, heroes, heroCount) : undefined;
      encounter = generateEncounter(encounterKind, randomSeed(rng), encounterPool, {
        heroCount: heroCountOverride,
        bias,
        excludeHeroIds,
        scaling,
        progression: progressionTable,
      });
      if (mapNodeType === 'boss' && location.guardianFinalEnemyId) {
        encounter = appendFinalEnemy(encounter, location.guardianFinalEnemyId, enemies, randomSeed(rng), scaling);
      }
    }
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
    playerHeroes,
    enemyHeroes,
  });

  if (!fight.won) return { run: workingRun, won: false, defeatedRoster: encounter.run.roster, drop: null };

  workingRun = grantCurrencyReward(workingRun, goldRewardFor(kindKey, rng));
  return { run: workingRun, won: true, defeatedRoster: encounter.run.roster, drop };
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
  const best = policy.byPower(offers)[0];
  const offer = deriveContractOffer(best);
  const rosterId = freshRosterId(run, best.heroId);

  if (run.roster.length < ROSTER_CAP) {
    record.recruitsBySource.contract = (record.recruitsBySource.contract ?? 0) + 1;
    return claimContract(run, offer, rosterId);
  }
  const weakest = policy.byPower(run.roster)[run.roster.length - 1];
  if (policy.powerScore(best) <= policy.powerScore(weakest)) return run;
  record.recruitsBySource.contractReplacing = (record.recruitsBySource.contractReplacing ?? 0) + 1;
  return claimContractReplacing(run, offer, rosterId, weakest.rosterId);
}

/** grantMasteryScrolls, with the source tallied on the run record. */
function grantScrolls(run: RunState, count: number, source: string, record: RunRecord): RunState {
  if (count <= 0) return run;
  record.scrollsBySource[source] = (record.scrollsBySource[source] ?? 0) + count;
  return grantMasteryScrolls(run, count);
}

function resolveRewardNode(run: RunState, nodeType: MapNodeType, locationId: string, rng: Rng, record: RunRecord, options: RunOptions): RunState {
  switch (nodeType) {
    // The Scroll Cache. The GRANT is what is under test; who it goes to is policy.pourScrolls,
    // which runs before every fight.
    case 'scrollReward':
      return grantScrolls(run, SCROLL_REWARD_COUNT, 'scrollCache', record);
    case 'currencyReward':
      return grantCurrencyReward(run, rollGoldRange(PURSE_GOLD_RANGE, rng));
    case 'loneScrollReward':
      return grantScrolls(run, LONE_SCROLL_COUNT, 'loneScroll', record);
    case 'equipmentReward': {
      // Three offered; the policy takes the one worth most to somebody. Equipment is a
      // power question, not a design experiment — the rarity curve is what's under test.
      const choices = pickWeightedEquipment(EQUIPMENT_POOL, 3, rarityWeightsFor(run.actNumber, 'standard'));
      if (choices.length === 0) return run;
      const best = choices.reduce((a, b) => ((policy.bestWearer(run.roster, b)?.gain ?? 0) > (policy.bestWearer(run.roster, a)?.gain ?? 0) ? b : a));
      return resolveDrop(run, best.id, record.equipped, run.actNumber);
    }
    case 'passiveReward': {
      // Offered 3 and taken at random — the pool is under test, not the policy. The TARGET is not
      // random though: a type-locked Boon goes to whoever has the most moves of its type, which
      // is what a player does, and measuring it on the strongest hero regardless would score the
      // type half of the pool as weaker than it is. Generic Boons ride the strongest hero.
      const offered = pickBoonOffers(run.roster, heroes, undefined, rng);
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
    case 'forgeReward': {
      // Whoever is holding the most already: an extra slot is worth most where the gear is.
      const target = [...run.roster]
        .filter((entry) => itemSlotsFor(heroes[entry.heroId], entry) < MAX_ITEM_SLOTS)
        .sort((a, b) => policy.powerScore(b) - policy.powerScore(a))[0];
      return target ? grantItemSlot(run, target.rosterId, heroes) : run;
    }
    // The Mentor (acts 1-3): one Mid move ROLLED for the hero whose Mid pool is worth most.
    case 'mentorReward':
      return resolveMentor(run, rng);
    case 'tutorReward':
      return resolveTutor(run);
    case 'blacksmith':
      return resolveBlacksmith(run);
    case 'event':
      return resolveEvent(run, locationId, rng, record);
    case 'shop':
    case 'muster':
      return resolveShop(run, nodeType === 'muster', rng, record);
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
function resolveMentor(run: RunState, rng: Rng): RunState {
  let best: { entry: RosterEntry; value: number } | null = null;
  for (const entry of run.roster) {
    const pool = mentorMovePool(progressionTable, moves, entry);
    if (pool.length === 0) continue;
    const value = pool.reduce((sum, id) => sum + policy.moveValue(id), 0) / pool.length + policy.powerScore(entry) * 0.01;
    if (!best || value > best.value) best = { entry, value };
  }
  if (!best) return run;
  const pool = mentorMovePool(progressionTable, moves, best.entry);
  const moveId = pick(rng, pool);
  const next = recordMoveOffer(run, best.entry.rosterId, [moveId]);
  if (best.entry.unlockedMoveIds.length < MOVE_CAP) return grantOfferedMove(next, best.entry.rosterId, moveId);
  const replaceId = policy.replacementTarget(best.entry, moveId);
  return replaceId ? grantOfferedMove(next, best.entry.rosterId, moveId, replaceId) : next;
}

/**
 * The Tutor: one hero, then any move off its own level-up pool, un-rolled and un-gated. Not a
 * randomized experiment — WHICH move to teach is a play, and rolling it would measure the pool
 * rather than the node. The hero is the one the pool is worth most to (most moves it does not
 * already hold, strongest as the tiebreak), and the move is the best of them.
 */
function resolveTutor(run: RunState): RunState {
  let best: { rosterId: string; moveId: string; value: number } | null = null;
  for (const entry of run.roster) {
    for (const moveId of tutorMovePool(progressionTable, moves, entry)) {
      if (entry.unlockedMoveIds.includes(moveId)) continue;
      const value = policy.moveValue(moveId) + policy.powerScore(entry) * 0.01;
      if (!best || value > best.value) best = { rosterId: entry.rosterId, moveId, value };
    }
  }
  if (!best) return run;
  const entry = entryOf(run, best.rosterId);
  if (entry.unlockedMoveIds.length < MOVE_CAP) return grantMove(run, best.rosterId, best.moveId);
  const replaceId = policy.replacementTarget(entry, best.moveId);
  return replaceId ? grantMove(run, best.rosterId, best.moveId, replaceId) : run;
}

/**
 * The Blacksmith: slots, the Anvil, the Enchanter, all for gold. The sim buys the slot first
 * (the one grant nothing else on the map sells) and then lifts its best-placed item a tier
 * while the gold lasts. The Enchanter is left alone — picking an element is a team-composition
 * read this policy has no model of, and buying one at random would price the node below what a
 * player gets from it.
 */
function resolveBlacksmith(run: RunState): RunState {
  let next = run;

  const slotTarget = [...next.roster]
    .filter((entry) => {
      const quote = slotQuote(next, entry.rosterId, heroes);
      return quote != null && quote.cost <= next.gold;
    })
    .sort((a, b) => policy.powerScore(b) - policy.powerScore(a))[0];
  if (slotTarget) next = buyItemSlot(next, slotTarget.rosterId, heroes);

  // One lift per visit: the most valuable item on the strongest hero that can afford it.
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
      next = anvilUpgrade(next, { kind: 'hero', rosterId: entry.rosterId, index: bestIndex }, equipment);
      break;
    }
  }
  return next;
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
    const replaceId = policy.replacementTarget(entry, moveId);
    return replaceId ? grantMove(run, target.rosterId, moveId, replaceId) : run;
  }

  if (outcome.kind === 'statShift') {
    // Trades are accepted whenever the floor allows and the hero can use what it gains.
    const candidates = run.roster.filter((entry) => {
      const combatant = createCombatant('probe', entry.heroId, 'A', 0, 0);
      const maxHp = getMaxHp(heroes[entry.heroId], {
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
  for (const item of drops) next = resolveDrop(next, item.id, record.equipped, run.actNumber);
  return next;
}

/** Guild Hall: fill empty roster slots first, then buy gear that is a real upgrade, then bank the rest. */
function resolveShop(run: RunState, muster: boolean, rng: Rng, record: RunRecord): RunState {
  let next = run;
  const offers = rollGuildHallOffers(next, guildHallOffers, EQUIPMENT_POOL, muster);

  for (const offerId of offers.heroOfferIds) {
    const offer = guildHallOffers.find((o) => o.id === offerId);
    if (!offer || next.gold < offer.cost) continue;
    const rosterId = freshRosterId(next, offer.heroId);
    if (next.roster.length < ROSTER_CAP) {
      record.recruitsBySource.hire = (record.recruitsBySource.hire ?? 0) + 1;
      next = recruitFromGuildHall(next, offer, rosterId);
      continue;
    }
    // A hire arrives raw and one act behind (guildHallEntry), so it replaces only a hero it outscores as-is.
    const weakest = policy.byPower(next.roster)[next.roster.length - 1];
    if (policy.powerScore(weakest) < policy.powerScore(guildHallEntry(next, offer, rosterId))) {
      record.recruitsBySource.hireReplacing = (record.recruitsBySource.hireReplacing ?? 0) + 1;
      next = recruitFromGuildHallReplacing(next, offer, rosterId, weakest.rosterId);
    }
  }

  // The shelf's Scrolls (SCROLL_PURCHASE_LIMIT a visit), bought while a hero can take one and the
  // gold is there — a Scroll is the one purchase whose value never decays.
  while (next.masteryScrolls < SCROLL_PURCHASE_LIMIT && next.gold >= SCROLL_PURCHASE_COST) {
    if (!next.roster.some((entry) => canSpendScroll(progressionTable, moves, { ...next, masteryScrolls: 1 }, entry))) break;
    next = buyMasteryScroll(next, SCROLL_PURCHASE_COST, SCROLL_PURCHASE_LIMIT);
    record.scrollsBySource.guildHall = (record.scrollsBySource.guildHall ?? 0) + 1;
  }

  for (const itemId of offers.equipmentOfferIds) {
    const item = equipment[itemId];
    if (!item) continue;
    const price = EQUIPMENT_PRICE_BY_RARITY[item.rarity];
    if (next.gold < price) continue;
    const wearer = policy.bestWearer(next.roster, item);
    // Buy only a meaningful upgrade — hoarding gold for a later, better shelf is the alternative.
    if (!wearer || wearer.gain < price * 0.25) continue;
    next = buyEquipment(next, item);
    next = resolveDrop(next, itemId, record.equipped, next.actNumber);
  }

  // Spare gold at the last shop before a Guardian buys a contract rather than rusting.
  if (next.gold >= CONTRACT_PURCHASE_COST && next.roster.length < ROSTER_CAP) {
    next = buyContract(next, CONTRACT_PURCHASE_COST);
  }
  return next;
}
