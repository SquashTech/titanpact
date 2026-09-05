// One headless run, node for node, mirroring src/app/App.tsx's orchestration.
// When this file and App.tsx disagree, App.tsx is right and this is a bug —
// the numbers are only worth reading while the two stay in step.

import type { StatKey } from '../../src/engine/content';
import { heroes } from '../../src/data/heroes';
import { moves } from '../../src/data/moves';
import { equipment } from '../../src/data/equipment';
import { relics, drawableRelics, guardianBannerRelics } from '../../src/data/relics';
import { classes } from '../../src/data/classes';
import { runEvents } from '../../src/data/events';
import { progressionTable } from '../../src/data/progression';
import { enemies, factions, basicEnemiesOf, finaleEnemies, ENDBRINGER_ID } from '../../src/data/enemies';
import { guildHallOffers, CONTRACT_PURCHASE_COST } from '../../src/data/recruitment';

import { createRunState, createRosterEntry, addRosterEntry, terminateRosterEntry, ROSTER_CAP, TOTAL_ACTS, type RunState, type RosterEntry } from '../../src/run/state';
import { generateMap, type MapNodeType } from '../../src/run/map';
import { generateStarterOptions, STARTER_PICK_COUNT } from '../../src/run/draft';
import { generateItinerary, locationBias, locationForAct } from '../../src/run/locations';
import { actScaling, type ScalingTrack } from '../../src/run/difficulty';
import { generateEncounter, generateLeaderEncounter, generateFinaleEncounter, appendFinalEnemy, type Encounter, type EncounterNodeType } from '../../src/run/enemyGen';
import { pickSquad, requiredSquadSize, STANDARD_SQUAD_SIZE, type Squad } from '../../src/run/squad';
import {
  advanceToNode,
  advanceToNextAct,
  equipToRoster,
  grantContractReward,
  grantCurrencyReward,
  grantRelicReward,
  grantStatBonus,
  grantUpgradeReward,
  reachableNodeIds,
  recordBrokenSeal,
} from '../../src/run/runProgress';
import {
  MOVE_CAP,
  canAffordAnyLevelUp,
  chooseEvolutionPath,
  drawMasteryStats,
  grantLevelUpMove,
  grantMasteryStat,
  levelUpCost,
  levelUpHero,
  levelUpMovePool,
  levelUpPayout,
  pendingEvolution,
} from '../../src/run/progression';
import { claimContract, claimContractReplacing, deriveContractOffer, isRecruitable, pickContractOffers, recruitFromGuildHall, recruitFromGuildHallReplacing, freshRosterId, buyContract } from '../../src/run/recruitment';
import { rollGuildHallOffers, buyEquipment, EQUIPMENT_PRICE_BY_RARITY } from '../../src/run/shop';
import { grantClass } from '../../src/run/classes';
import { applyStatShift, grantEventPassive, rollRunEvent, rollEventMove, statShiftAllowed } from '../../src/run/events';
import { pickWeightedEquipment, pickWeightedEquipmentBySlot, rarityWeightsFor, type EquipmentDefinition, type EquipmentSlot, type LootSource } from '../../src/run/equipment';
import { passives } from '../../src/data/passives';
import { getMaxHp } from '../../src/engine/state';
import { createCombatant } from '../../src/engine/state';

import { simulateFight, PLAYER_SIDE } from './fight';
import * as policy from './policy';
import { makeRng, pick, randomSeed, sample, withRandom, type Rng } from './rng';

const EQUIPMENT_POOL = Object.values(equipment);
const STARTER_IDS = Object.values(heroes).filter((h) => h.starter).map((h) => h.id);

/** App.tsx `EncounterMapNodeType` — the reward lane keys off the MAP node, not the flattened encounter kind. */
type EncounterMapNodeType = 'fight' | 'skirmish' | 'battle' | 'elite' | 'boss' | 'finale';

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

function goldRewardFor(nodeType: EncounterMapNodeType, rng: Rng): number {
  if (nodeType === 'boss' || nodeType === 'finale') return 0;
  if (nodeType === 'battle') return 30 + Math.floor(rng() * 16);
  return 15 + Math.floor(rng() * 11);
}

function trainingPointsFor(nodeType: EncounterMapNodeType): number {
  if (nodeType === 'finale') return 0;
  if (nodeType === 'fight') return 2;
  if (nodeType === 'battle') return 3;
  return 4;
}

/** NodeRewardScreen's flat XP cache. */
const UPGRADE_REWARD_XP = 2;

/** StatBoostScreen's three node kinds. */
const STAT_BOOST: Record<string, { stat: StatKey; amount: number }> = {
  hpBoostReward: { stat: 'hp', amount: 20 },
  manaBoostReward: { stat: 'manaPool', amount: 10 },
  manaRegenBoostReward: { stat: 'mpRegen', amount: 5 },
};

// --- Records the aggregator consumes ---

export interface ChoiceEvent {
  bucket: 'relic' | 'banner' | 'evolution' | 'class' | 'draft';
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
  levelUpPoolEnd: number;
  rosterLevelEnd: number;
  /** heroId -> best level reached this run, for every hero that was ever on the roster. */
  heroLevels: Record<string, number>;
  fights: FightRecord[];
  choices: ChoiceEvent[];
  /** Rarity of every item actually equipped, keyed `act:rarity`. */
  equipped: string[];
}

// --- Helpers ---

function entryOf(run: RunState, rosterId: string): RosterEntry {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new Error(`${rosterId} left the roster`);
  return entry;
}

/** Level-cap guard: the pool can hold points nobody can afford, which is normal and banks (CLAUDE.md). */
function spendLevelUps(run: RunState, rng: Rng, opts: policy.PolicyOptions, choices: ChoiceEvent[], encountersWon: number): RunState {
  let next = run;
  let guard = 0;
  while (canAffordAnyLevelUp(next) && guard++ < 200) {
    const affordable = next.roster.filter((entry) => next.levelUpPool >= levelUpCost(entry.level));
    const target = policy.levelUpTarget(affordable, opts.levelPolicy);
    if (!target) break;

    next = levelUpHero(next, target.rosterId);
    const entry = entryOf(next, target.rosterId);
    const payout = levelUpPayout(progressionTable, moves, entry);

    if (payout === 'evolution') {
      const node = pendingEvolution(progressionTable, entry);
      if (!node || node.paths.length === 0) continue;
      // Uniformly random: this is the experiment (see policy.ts).
      const path = pick(rng, node.paths);
      choices.push({
        bucket: 'evolution',
        offered: node.paths.map((p) => p.id),
        picked: [path.id],
        encountersWonAtChoice: encountersWon,
      });
      const before = entryOf(next, target.rosterId).unlockedMoveIds.length;
      next = chooseEvolutionPath(next, progressionTable, heroes, target.rosterId, path.id);
      // Overflow: a path's granted move that would exceed MOVE_CAP is offered as replace-or-decline.
      const after = entryOf(next, target.rosterId);
      const granted = path.unlocksMoveIds.filter((id) => !after.unlockedMoveIds.includes(id));
      if (before + granted.length > 0 && granted.length > 0) {
        for (const moveId of granted) {
          const replaceId = policy.replacementTarget(entryOf(next, target.rosterId), moveId);
          if (replaceId) next = grantLevelUpMove(next, target.rosterId, moveId, replaceId);
        }
      }
    } else if (payout === 'move') {
      const pool = levelUpMovePool(progressionTable, moves, entryOf(next, target.rosterId));
      if (pool.length === 0) continue;
      // Best-of-three offered, so the pick is a play rather than a coin flip; the pool itself is unbiased.
      const offered = sample(rng, pool, Math.min(3, pool.length));
      const moveId = offered.reduce((best, id) => (policy.moveValue(id) > policy.moveValue(best) ? id : best));
      const current = entryOf(next, target.rosterId);
      if (current.unlockedMoveIds.length < MOVE_CAP) {
        next = grantLevelUpMove(next, target.rosterId, moveId);
      } else {
        const replaceId = policy.replacementTarget(current, moveId);
        if (replaceId) next = grantLevelUpMove(next, target.rosterId, moveId, replaceId);
      }
    } else {
      const drawn = drawMasteryStats(rng);
      // The reel is the balance question; which of the three to take is a play. Take the one worth most to this hero.
      const chosen = drawn.reduce((best, stat) =>
        policy.itemValueFor(entryOf(next, target.rosterId), { id: '', name: '', slot: 'weapon', rarity: 'common', statGrants: { [stat]: 10 } }) >
        policy.itemValueFor(entryOf(next, target.rosterId), { id: '', name: '', slot: 'weapon', rarity: 'common', statGrants: { [best]: 10 } })
          ? stat
          : best
      );
      next = grantMasteryStat(next, target.rosterId, chosen);
    }
  }
  return next;
}

/** ForceEquipScreen: every drop is resolved on the spot — worn by whoever gains most, or trashed. */
function forceEquip(run: RunState, itemId: string, equipped: string[], actNumber: number): RunState {
  const item = equipment[itemId];
  if (!item || run.roster.length === 0) return run;
  const target = policy.bestWearer(run.roster, item);
  if (!target || target.gain <= 0) return run;
  equipped.push(`${actNumber}:${item.rarity}`);
  return equipToRoster(run, target.rosterId, itemId, equipment).run;
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
    levelUpPoolEnd: 0,
    rosterLevelEnd: 0,
    heroLevels: {},
    fights: [],
    choices: [],
    equipped: [],
  };

  // --- Draft: 4 starters offered, 2 taken at random (the experiment). ---
  const draftOptions = generateStarterOptions(randomSeed(rng), STARTER_IDS);
  const drafted = sample(rng, draftOptions, STARTER_PICK_COUNT);
  record.choices.push({ bucket: 'draft', offered: draftOptions, picked: drafted, encountersWonAtChoice: 0 });

  let run: RunState = createRunState(0, 40);
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
    const location = locationForAct(run.locationIds, run.actNumber);

    for (const entry of run.roster) {
      record.heroLevels[entry.heroId] = Math.max(record.heroLevels[entry.heroId] ?? 0, entry.level);
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
        if (run.actNumber < TOTAL_ACTS) run = advanceToNextAct(run, randomSeed(rng));
        else {
          record.won = true;
          break;
        }
      }

      run = tryRecruitContracts(run, outcome.defeatedRoster, rng);
      if (outcome.drop) run = forceEquip(run, outcome.drop.id, record.equipped, run.actNumber);
      run = spendLevelUps(run, rng, options, record.choices, run.encountersWon);
      continue;
    }

    run = resolveRewardNode(run, node.type, location.id, rng, record, options);
    run = advanceToNode(run, nodeId);
    run = spendLevelUps(run, rng, options, record.choices, run.encountersWon);
  }

  record.goldEnd = run.gold;
  record.levelUpPoolEnd = run.levelUpPool;
  record.rosterLevelEnd =
    run.roster.length > 0 ? run.roster.reduce((sum, r) => sum + r.level, 0) / run.roster.length : 0;
  for (const entry of run.roster) {
    record.heroLevels[entry.heroId] = Math.max(record.heroLevels[entry.heroId] ?? 0, entry.level);
  }
  return record;
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
  let encounter: Encounter;
  let squadSize = STANDARD_SQUAD_SIZE;
  let workingRun = run;

  if (mapNodeType === 'finale') {
    encounter = generateFinaleEncounter(
      run.brokenSeals,
      location.guardianFinalEnemyId ?? ENDBRINGER_ID,
      finaleEnemies,
      actScaling('monsters', TOTAL_ACTS, TOTAL_ACTS)
    );
    squadSize = ROSTER_CAP;
  } else {
    const isMobFight = mapNodeType === 'fight' || mapNodeType === 'battle';
    const faction = factions[location.factionId];
    const encounterKind: EncounterNodeType =
      mapNodeType === 'skirmish' || mapNodeType === 'battle' ? 'fight' : (mapNodeType as EncounterNodeType);
    const isSecondFight = encounterKind === 'fight' && run.fightsStarted === 1;
    const track: ScalingTrack = isMobFight ? 'monsters' : 'skirmish';
    const scaling = actScaling(track, run.actNumber, isMobFight ? faction.baselineAct : undefined);

    if (mapNodeType === 'battle') {
      encounter = generateLeaderEncounter(randomSeed(rng), faction.basicIds, faction.leaderId, enemies, scaling);
    } else {
      const encounterPool = mapNodeType === 'fight' ? basicEnemiesOf(faction) : heroes;
      const excludeHeroIds = encounterPool === heroes ? run.roster.map((r) => r.heroId) : undefined;
      const heroCountOverride = mapNodeType === 'fight' ? 2 : isSecondFight ? 2 : undefined;
      const heroCount = heroCountOverride ?? (encounterKind === 'boss' ? 2 : 4);
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
    playerHeroes,
    enemyHeroes,
  });

  if (!fight.won) return { run: workingRun, won: false, defeatedRoster: encounter.run.roster, drop: null };

  workingRun = grantCurrencyReward(workingRun, goldRewardFor(kindKey, rng));
  workingRun = grantUpgradeReward(workingRun, trainingPointsFor(kindKey) * options.xpMult);
  return { run: workingRun, won: true, defeatedRoster: encounter.run.roster, drop };
}

/** The Guardian's Banner: a fixed 1-of-3, taken at random. */
function claimBanner(run: RunState, rng: Rng, record: RunRecord): RunState {
  const offered = guardianBannerRelics.map((r) => r.id);
  const picked = pick(rng, offered);
  record.choices.push({ bucket: 'banner', offered, picked: [picked], encountersWonAtChoice: run.encountersWon });
  return grantRelicReward(run, picked);
}

/** A beaten hero-pool enemy can be claimed with a contract. Free power below the cap; above it, only for a real upgrade. */
function tryRecruitContracts(run: RunState, defeatedRoster: readonly RosterEntry[], rng: Rng): RunState {
  if (run.recruitContracts <= 0) return run;
  const eligible = defeatedRoster.filter((entry) => isRecruitable(entry.heroId, heroes));
  const offers = pickContractOffers(eligible);
  if (offers.length === 0) return run;
  const best = policy.byPower(offers)[0];
  const offer = deriveContractOffer(best);
  const rosterId = freshRosterId(run, best.heroId);

  if (run.roster.length < ROSTER_CAP) return claimContract(run, offer, rosterId);
  const weakest = policy.byPower(run.roster)[run.roster.length - 1];
  if (policy.powerScore(best) <= policy.powerScore(weakest)) return run;
  return claimContractReplacing(run, offer, rosterId, weakest.rosterId);
}

function resolveRewardNode(run: RunState, nodeType: MapNodeType, locationId: string, rng: Rng, record: RunRecord, options: RunOptions): RunState {
  switch (nodeType) {
    case 'currencyReward':
      return grantCurrencyReward(run, 15 + Math.floor(rng() * 16));
    case 'upgradeReward':
      return grantUpgradeReward(run, UPGRADE_REWARD_XP * options.xpMult);
    case 'equipmentReward': {
      // Three offered; the policy takes the one worth most to somebody. Equipment is a
      // power question, not a design experiment — the rarity curve is what's under test.
      const choices = pickWeightedEquipment(EQUIPMENT_POOL, 3, rarityWeightsFor(run.actNumber, 'standard'));
      if (choices.length === 0) return run;
      const best = choices.reduce((a, b) => ((policy.bestWearer(run.roster, b)?.gain ?? 0) > (policy.bestWearer(run.roster, a)?.gain ?? 0) ? b : a));
      return forceEquip(run, best.id, record.equipped, run.actNumber);
    }
    case 'relicReward': {
      const pool = drawableRelics.filter((r) => !run.relics.includes(r.id));
      const offered = sample(rng, pool, 3);
      if (offered.length === 0) return run;
      const picked = pick(rng, offered);
      record.choices.push({
        bucket: 'relic',
        offered: offered.map((r) => r.id),
        picked: [picked.id],
        encountersWonAtChoice: run.encountersWon,
      });
      return grantRelicReward(run, picked.id);
    }
    case 'weaponReward':
    case 'armorReward':
    case 'accessoryReward': {
      const slot: EquipmentSlot = nodeType === 'weaponReward' ? 'weapon' : nodeType === 'armorReward' ? 'armor' : 'accessory';
      const item = pickWeightedEquipmentBySlot(EQUIPMENT_POOL, slot, rarityWeightsFor(run.actNumber, 'standard'));
      return item ? forceEquip(run, item.id, record.equipped, run.actNumber) : run;
    }
    case 'hpBoostReward':
    case 'manaBoostReward':
    case 'manaRegenBoostReward': {
      const boost = STAT_BOOST[nodeType];
      const target = policy.statBoostTarget(run.roster, boost.stat);
      return target ? grantStatBonus(run, target.rosterId, boost.stat, boost.amount) : run;
    }
    case 'classReward': {
      const offered = sample(rng, Object.values(classes), 3);
      const target = policy.passiveTarget(run.roster);
      if (offered.length === 0 || !target) return run;
      const picked = pick(rng, offered);
      record.choices.push({
        bucket: 'class',
        offered: offered.map((c) => c.id),
        picked: [picked.id],
        encountersWonAtChoice: run.encountersWon,
      });
      return grantClass(run, classes, target.rosterId, picked.id);
    }
    case 'event':
      return resolveEvent(run, locationId, rng, record);
    case 'shop':
    case 'muster':
      return resolveShop(run, nodeType === 'muster', rng, record);
    default:
      return run;
  }
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
    if (entry.unlockedMoveIds.length < MOVE_CAP) return grantLevelUpMove(run, target.rosterId, moveId);
    const replaceId = policy.replacementTarget(entry, moveId);
    return replaceId ? grantLevelUpMove(run, target.rosterId, moveId, replaceId) : run;
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
  for (const item of drops) next = forceEquip(next, item.id, record.equipped, run.actNumber);
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
      next = recruitFromGuildHall(next, offer, rosterId);
      continue;
    }
    // A Guild Hall recruit arrives at level 1, so replacing a veteran is almost never right.
    const weakest = policy.byPower(next.roster)[next.roster.length - 1];
    if (weakest.level <= 1 && policy.powerScore(weakest) < policy.powerScore({ ...weakest, heroId: offer.heroId })) {
      next = recruitFromGuildHallReplacing(next, offer, rosterId, weakest.rosterId);
    }
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
    next = forceEquip(next, itemId, record.equipped, next.actNumber);
  }

  // Spare gold at the last shop before a Guardian buys a contract rather than rusting.
  if (next.gold >= CONTRACT_PURCHASE_COST && next.roster.length < ROSTER_CAP) {
    next = buyContract(next, CONTRACT_PURCHASE_COST);
  }
  return next;
}
