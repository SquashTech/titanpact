// Shapes the simulator produces. Workers aggregate as they go and ship an
// `Aggregate` back; nothing keeps per-run records for a 10k-run batch.

import { addTimeCounts, emptyTimeCounts, PACE_PROFILES, type TimeCounts } from './time';

/**
 * A randomized-offer experiment. Every reward screen this simulator drives
 * offers N options and the policy takes one UNIFORMLY AT RANDOM, so the set a
 * decision put on the table is independent of how good the run was. That makes
 * `picked` vs `offered` a matched comparison: the same decision points, minus
 * the option's own effect.
 */
export interface ChoiceAgg {
  /** Times this option was taken. */
  picked: number;
  /** Encounters won AFTER taking it, summed. */
  pickedProgress: number;
  /** Sum of squares, so the report can put a standard error on the lift. */
  pickedProgressSq: number;
  /** Runs that went on to be completed, among those that took it. */
  pickedWins: number;
  /** Times this option was on the table (taken or not). */
  offered: number;
  /** Encounters won after those decision points, summed — the baseline. */
  offeredProgress: number;
  offeredProgressSq: number;
  offeredWins: number;
}

export interface HeroAgg {
  /** Runs the hero was on the roster for at any point. */
  runs: number;
  /** Fights the hero was in the fielded squad for. */
  fielded: number;
  fieldedWins: number;
  /** Rounds the hero spent on the field (active, not fainted). */
  roundsActive: number;
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  /** Enemies this hero landed the KO on. */
  kos: number;
  /** Times this hero fainted. */
  deaths: number;
  /** Sum of level at run end (or at death), over `runs`. */
  finalLevelSum: number;
  /** Runs where the hero was on the roster and the run was completed. */
  runsWon: number;
}

export interface EnemyAgg {
  /** Fights this enemy appeared in. */
  fights: number;
  /** Those fights the PLAYER lost. */
  playerLosses: number;
  roundsActive: number;
  damageDealt: number;
  damageTaken: number;
  kos: number;
  deaths: number;
}

export interface FightKindAgg {
  n: number;
  wins: number;
  roundsSum: number;
  /** Player squad HP as a fraction of max, summed over won fights. */
  playerHpFracSum: number;
  /** Fights that reached the Pact Clock's first tick. */
  pactFights: number;
  /** Fights that hit the hard round cap without a winner. */
  stalemates: number;
  /** Fielded stat totals, summed — divide by n for the mean. */
  playerStatsSum: number;
  enemyStatsSum: number;
}

/** A per-run minute histogram, one per pace profile (time.ts PACE_PROFILES order); index = whole minutes. */
export type MinuteHistograms = number[][];

export interface Aggregate {
  runs: number;
  wins: number;
  /** index 0 unused; [act] = runs that entered that act. */
  actEntered: number[];
  /** [act] = runs that beat that act's Guardian (act 6 = the Endbringer). */
  actCleared: number[];
  /** [act] = runs that ended in that act. */
  deathAct: number[];
  deathByNodeType: Record<string, number>;
  /** Encounters won, summed over all runs. */
  encountersWonSum: number;
  goldEndSum: number;
  /** The companion (src/run/companion.ts): runs it joined, runs a knockout took it, and the encounter count it was lost at, summed. */
  companionJoined: number;
  companionLost: number;
  companionLostAtSum: number;
  /** Sum of the mean roster level at run end. */
  rosterLevelEndSum: number;
  rosterEvolvedEndSum: number;
  /** Runs that ended with EVERY roster hero evolved. */
  runsRosterEvolved: number;
  /** Fight outcomes keyed `act:nodeType`. */
  fightKinds: Record<string, FightKindAgg>;
  /** Guardian fights keyed by location id. */
  guardians: Record<string, FightKindAgg>;
  heroes: Record<string, HeroAgg>;
  /** The same fight telemetry keyed `heroId:early` (acts 1-2) and `heroId:late` (acts 3-6) — the late-bloomer / front-loaded split growth grades are authored to produce. */
  heroesByHalf: Record<string, HeroAgg>;
  enemies: Record<string, EnemyAgg>;
  boonChoices: Record<string, ChoiceAgg>;
  bannerChoices: Record<string, ChoiceAgg>;
  evolutionChoices: Record<string, ChoiceAgg>;
  classChoices: Record<string, ChoiceAgg>;
  draftChoices: Record<string, ChoiceAgg>;
  /** Map-node types: which kind of node a row offered, and which one the walk took. */
  nodeChoices: Record<string, ChoiceAgg>;
  /** Equipment rarity actually equipped, by act. */
  equipRarityByAct: Record<string, number>;
  /** Round-count histogram across every fight, bucketed by round. */
  roundHistogram: number[];
  /** Best level each roster hero reached, histogram over (hero, run) pairs — index = level. */
  heroLevelHistogram: number[];
  /** The same, restricted to runs that reached act 4+ — the aggregate is dominated by Act 1 deaths. */
  heroLevelHistogramDeep: number[];
  /** Player-side move casts, by the move's authored tier. Every 70+ mana move is `late`. */
  castsByTier: Record<string, number>;
  /** Player-side move casts, by mana actually spent. */
  castsByManaBand: Record<string, number>;
  /** Player-side turns, Rests and voluntary switches — is the mana economy live? */
  playerTurns: number;
  playerRests: number;
  playerSwitches: number;
  /** Fights where the player side reached the 2-KO lock-in threshold. */
  lockInFights: number;
  /** Ichor eaten, by source, in levels-at-par (run/ichor.ts) — and the same on completed runs. */
  ichorBySource: Record<string, number>;
  ichorBySourceWon: Record<string, number>;
  /** Heroes who joined the roster after the draft, by route. */
  recruitsBySource: Record<string, number>;
  /** What runs cost in taps and screens (time.ts), [act], summed over runs that ENTERED the act. */
  timeByAct: TimeCounts[];
  /** The same, over completed runs only — a full clear's shape, undiluted by Act 1 deaths. */
  timeByActWon: TimeCounts[];
  /** Estimated whole-run minutes, completed runs / lost runs, per pace profile. */
  runMinutesWon: MinuteHistograms;
  runMinutesLost: MinuteHistograms;
  /** Wall-clock ms spent simulating. */
  elapsedMs: number;
}

export function emptyAggregate(): Aggregate {
  return {
    runs: 0,
    wins: 0,
    actEntered: [0, 0, 0, 0, 0, 0, 0],
    actCleared: [0, 0, 0, 0, 0, 0, 0],
    deathAct: [0, 0, 0, 0, 0, 0, 0],
    deathByNodeType: {},
    encountersWonSum: 0,
    goldEndSum: 0,
    companionJoined: 0,
    companionLost: 0,
    companionLostAtSum: 0,
    rosterLevelEndSum: 0,
    rosterEvolvedEndSum: 0,
    runsRosterEvolved: 0,
    fightKinds: {},
    guardians: {},
    heroes: {},
    heroesByHalf: {},
    enemies: {},
    boonChoices: {},
    bannerChoices: {},
    evolutionChoices: {},
    classChoices: {},
    draftChoices: {},
    nodeChoices: {},
    equipRarityByAct: {},
    roundHistogram: [],
    heroLevelHistogram: [],
    heroLevelHistogramDeep: [],
    castsByTier: {},
    castsByManaBand: {},
    playerTurns: 0,
    playerRests: 0,
    playerSwitches: 0,
    lockInFights: 0,
    ichorBySource: {},
    ichorBySourceWon: {},
    recruitsBySource: {},
    timeByAct: Array.from({ length: 7 }, emptyTimeCounts),
    timeByActWon: Array.from({ length: 7 }, emptyTimeCounts),
    runMinutesWon: PACE_PROFILES.map(() => []),
    runMinutesLost: PACE_PROFILES.map(() => []),
    elapsedMs: 0,
  };
}

export function emptyChoice(): ChoiceAgg {
  return { picked: 0, pickedProgress: 0, pickedProgressSq: 0, pickedWins: 0, offered: 0, offeredProgress: 0, offeredProgressSq: 0, offeredWins: 0 };
}

export function emptyHero(): HeroAgg {
  return {
    runs: 0,
    fielded: 0,
    fieldedWins: 0,
    roundsActive: 0,
    damageDealt: 0,
    damageTaken: 0,
    healingDone: 0,
    kos: 0,
    deaths: 0,
    finalLevelSum: 0,
    runsWon: 0,
  };
}

export function emptyEnemy(): EnemyAgg {
  return { fights: 0, playerLosses: 0, roundsActive: 0, damageDealt: 0, damageTaken: 0, kos: 0, deaths: 0 };
}

export function emptyFightKind(): FightKindAgg {
  return { n: 0, wins: 0, roundsSum: 0, playerHpFracSum: 0, pactFights: 0, stalemates: 0, playerStatsSum: 0, enemyStatsSum: 0 };
}

/** Every leaf on these records is a number, so merging is a field-wise add — asserted once here rather than typed per shape. */
function mergeCounts<T>(into: Record<string, T>, from: Record<string, T>, blank: () => T): void {
  for (const key of Object.keys(from)) {
    const target = (into[key] ?? (into[key] = blank())) as unknown as Record<string, number>;
    const source = from[key] as unknown as Record<string, number>;
    for (const field of Object.keys(source)) {
      target[field] = (target[field] ?? 0) + source[field];
    }
  }
}

function mergeArray(into: number[], from: readonly number[]): void {
  for (let i = 0; i < from.length; i++) into[i] = (into[i] ?? 0) + from[i];
}

/** Field-wise sum; every leaf in Aggregate is additive by construction. */
export function mergeAggregate(into: Aggregate, from: Aggregate): void {
  into.runs += from.runs;
  into.wins += from.wins;
  into.encountersWonSum += from.encountersWonSum;
  into.goldEndSum += from.goldEndSum;
  into.companionJoined += from.companionJoined;
  into.companionLost += from.companionLost;
  into.companionLostAtSum += from.companionLostAtSum;
  into.rosterLevelEndSum += from.rosterLevelEndSum;
  into.rosterEvolvedEndSum += from.rosterEvolvedEndSum;
  into.runsRosterEvolved += from.runsRosterEvolved;
  into.elapsedMs += from.elapsedMs;
  for (let act = 0; act < from.timeByAct.length; act++) addTimeCounts(into.timeByAct[act], from.timeByAct[act]);
  for (let act = 0; act < from.timeByActWon.length; act++) addTimeCounts(into.timeByActWon[act], from.timeByActWon[act]);
  for (let i = 0; i < from.runMinutesWon.length; i++) mergeArray(into.runMinutesWon[i], from.runMinutesWon[i]);
  for (let i = 0; i < from.runMinutesLost.length; i++) mergeArray(into.runMinutesLost[i], from.runMinutesLost[i]);
  into.playerTurns += from.playerTurns;
  into.playerRests += from.playerRests;
  into.playerSwitches += from.playerSwitches;
  into.lockInFights += from.lockInFights;
  mergeArray(into.actEntered, from.actEntered);
  mergeArray(into.actCleared, from.actCleared);
  mergeArray(into.deathAct, from.deathAct);
  mergeArray(into.roundHistogram, from.roundHistogram);
  mergeArray(into.heroLevelHistogram, from.heroLevelHistogram);
  mergeArray(into.heroLevelHistogramDeep, from.heroLevelHistogramDeep);
  for (const key of Object.keys(from.castsByTier)) into.castsByTier[key] = (into.castsByTier[key] ?? 0) + from.castsByTier[key];
  for (const key of Object.keys(from.castsByManaBand)) into.castsByManaBand[key] = (into.castsByManaBand[key] ?? 0) + from.castsByManaBand[key];
  for (const key of Object.keys(from.ichorBySource)) into.ichorBySource[key] = (into.ichorBySource[key] ?? 0) + from.ichorBySource[key];
  for (const key of Object.keys(from.ichorBySourceWon)) into.ichorBySourceWon[key] = (into.ichorBySourceWon[key] ?? 0) + from.ichorBySourceWon[key];
  for (const key of Object.keys(from.recruitsBySource)) into.recruitsBySource[key] = (into.recruitsBySource[key] ?? 0) + from.recruitsBySource[key];
  for (const key of Object.keys(from.deathByNodeType)) {
    into.deathByNodeType[key] = (into.deathByNodeType[key] ?? 0) + from.deathByNodeType[key];
  }
  for (const key of Object.keys(from.equipRarityByAct)) {
    into.equipRarityByAct[key] = (into.equipRarityByAct[key] ?? 0) + from.equipRarityByAct[key];
  }
  mergeCounts(into.fightKinds, from.fightKinds, emptyFightKind);
  mergeCounts(into.guardians, from.guardians, emptyFightKind);
  mergeCounts(into.heroes, from.heroes, emptyHero);
  mergeCounts(into.heroesByHalf, from.heroesByHalf, emptyHero);
  mergeCounts(into.enemies, from.enemies, emptyEnemy);
  mergeCounts(into.boonChoices, from.boonChoices, emptyChoice);
  mergeCounts(into.bannerChoices, from.bannerChoices, emptyChoice);
  mergeCounts(into.evolutionChoices, from.evolutionChoices, emptyChoice);
  mergeCounts(into.classChoices, from.classChoices, emptyChoice);
  mergeCounts(into.draftChoices, from.draftChoices, emptyChoice);
  mergeCounts(into.nodeChoices, from.nodeChoices, emptyChoice);
}
