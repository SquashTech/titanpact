// Shapes the simulator produces. Workers aggregate as they go and ship an
// `Aggregate` back; nothing keeps per-run records for a 10k-run batch.

import { addTimeCounts, emptyTimeCounts, PACE_PROFILES, type TimeCounts } from './time';
import type { MoveTally } from './fight';

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

/** One move over the batch: its fight ledger summed, plus how many fights it was cast in at all. */
export interface MoveAgg extends MoveTally {
  fights: number;
}

/** The signature at ten pips (docs/mastery.md §5), by hero. */
export interface SignatureAgg {
  /** (hero, run) pairs where the tenth pip landed. */
  reached: number;
  /** Of those, the kit took the move (room, or it beat the worst held). */
  taken: number;
  /** Reached, in runs that went on to complete. */
  reachedWon: number;
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

/** Summed over runs (run.ts RunRecord.knockouts). */
export interface KnockoutCounts {
  /** Fights entered with at least one roster hero down. */
  shortHanded: number;
  /** Heroes down on entering a fight, summed. */
  downEntering: number;
  /** Heroes KO'd inside a fight the player WON — the KOs that persist — and the same by the node kind they fell at. */
  koInWins: number;
  koInWinsByKind: Record<string, number>;
  revivesFound: number;
  revivesSpent: number;
  /** Rest seats taken and Guild Hall mends bought while somebody was down. */
  restsWhileDown: number;
  mendsWhileDown: number;
  /** Permadeath (docs/ascension.md §3): heroes at the Fallen beat, and how many a Revive kept or the run let go. */
  fallen: number;
  fallenRevived: number;
  fallenLost: number;
}

export function emptyKnockoutCounts(): KnockoutCounts {
  return { shortHanded: 0, downEntering: 0, koInWins: 0, koInWinsByKind: {}, revivesFound: 0, revivesSpent: 0, restsWhileDown: 0, mendsWhileDown: 0, fallen: 0, fallenRevived: 0, fallenLost: 0 };
}

export function addKnockoutCounts(into: KnockoutCounts, from: KnockoutCounts): void {
  for (const key of Object.keys(from) as (keyof KnockoutCounts)[]) {
    if (key === 'koInWinsByKind') continue;
    into[key] += from[key];
  }
  for (const kind of Object.keys(from.koInWinsByKind)) into.koInWinsByKind[kind] = (into.koInWinsByKind[kind] ?? 0) + from.koInWinsByKind[kind];
}

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
  /** Roster size when the run ended, summed — under permadeath the count is the story. */
  rosterSizeEndSum: number;
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
  /** The act's 1-of-2 location offer, and which place the walk took. */
  locationChoices: Record<string, ChoiceAgg>;
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
  /** Player-side move casts by move id, all runs. */
  castsByMove: Record<string, number>;
  /** Per-move ledgers by the caster's side, all runs; `movesByAct` is the player side keyed `act:moveId`. */
  moves: Record<string, MoveAgg>;
  enemyMoves: Record<string, MoveAgg>;
  movesByAct: Record<string, MoveAgg>;
  /** The player side's ledger keyed `heroId:moveId` — what each hero actually does with its kit. */
  movesByHero: Record<string, MoveAgg>;
  /** Signatures by hero, and the count of tenth pips landed per run, histogram (index = signatures that run). */
  signatures: Record<string, SignatureAgg>;
  signaturesPerRun: number[];
  /** Rolled move offers by move id (schedule, Mentor, Tutor, signature): on the table, and taken. */
  moveOffers: Record<string, { offered: number; taken: number }>;
  signaturesPerRunWon: number[];
  /** Evolutions taken, histogram by the encounter count they landed at — when in the run a hero turns. */
  evolutionAtEncounter: number[];
  /** Field Effects: sets by side and rounds ended with one up, keyed by field id plus 'all' (fight.ts); fightRounds is the denominator. */
  fieldSets: Record<string, number>;
  enemyFieldSets: Record<string, number>;
  fieldRounds: Record<string, number>;
  fightRounds: number;
  /** Player-side turns, Rests and voluntary switches — is the mana economy live? */
  playerTurns: number;
  playerRests: number;
  playerSwitches: number;
  /** Fights where the player side reached the 2-KO lock-in threshold. */
  lockInFights: number;
  /** Per act (index = act): scaled stat deltas landed, |authored| and |landed| summed, fights, fights a [−½S, +S] ceiling would have clamped, and the peak modifier/S summed (docs/stat-scaling.md §8, §10). */
  statDeltaCountByAct: number[];
  statDeltaAuthoredByAct: number[];
  statDeltaLandedByAct: number[];
  enemyStatDeltaCountByAct: number[];
  enemyStatDeltaAuthoredByAct: number[];
  enemyStatDeltaLandedByAct: number[];
  heldDropsByAct: number[];
  enemyHeldDropsByAct: number[];
  /** Shield telemetry (docs/shield.md §8 phase 4), [act], keyed by the fight.ts ShieldTally field. */
  shieldByAct: Record<string, number[]>;
  fightsByAct: number[];
  wouldHaveCappedByAct: number[];
  wouldHaveCappedUpByAct: number[];
  wouldHaveCappedDownByAct: number[];
  flooredByAct: number[];
  peakModifierFracSumByAct: number[];
  /** Mastery pips landed, by source (scribe / shelf; the Cache from phase 2), all runs and won runs. */
  pipsBySource: Record<string, number>;
  pipsBySourceWon: Record<string, number>;
  /** The gold ledger summed over runs (run.ts RunRecord.goldFlow). */
  goldFlow: Record<string, number>;
  /** Heroes who joined the roster after the draft, by route. */
  recruitsBySource: Record<string, number>;
  /** Items obtained, keyed `act:source` (run.ts RunRecord.itemsBySource), all runs and won runs. */
  itemsBySource: Record<string, number>;
  itemsBySourceWon: Record<string, number>;
  /** Drops that merged into a held piece, all runs / won runs. */
  merges: number;
  mergesWon: number;
  mergeOffers: number;
  mergeOffersWon: number;
  /** Persisting knockouts (src/run/wounds.ts): what the rule cost and what paid it back. */
  knockouts: KnockoutCounts;
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
    rosterSizeEndSum: 0,
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
    locationChoices: {},
    equipRarityByAct: {},
    roundHistogram: [],
    heroLevelHistogram: [],
    heroLevelHistogramDeep: [],
    castsByTier: {},
    castsByManaBand: {},
    castsByMove: {},
    moves: {},
    enemyMoves: {},
    movesByAct: {},
    movesByHero: {},
    signatures: {},
    signaturesPerRun: [],
    moveOffers: {},
    signaturesPerRunWon: [],
    evolutionAtEncounter: [],
    fieldSets: {},
    enemyFieldSets: {},
    fieldRounds: {},
    fightRounds: 0,
    playerTurns: 0,
    playerRests: 0,
    playerSwitches: 0,
    lockInFights: 0,
    statDeltaCountByAct: [],
    shieldByAct: {},
    statDeltaAuthoredByAct: [],
    statDeltaLandedByAct: [],
    enemyStatDeltaCountByAct: [],
    enemyStatDeltaAuthoredByAct: [],
    enemyStatDeltaLandedByAct: [],
    heldDropsByAct: [],
    enemyHeldDropsByAct: [],
    fightsByAct: [],
    wouldHaveCappedByAct: [],
    wouldHaveCappedUpByAct: [],
    wouldHaveCappedDownByAct: [],
    flooredByAct: [],
    peakModifierFracSumByAct: [],
    pipsBySource: {},
    pipsBySourceWon: {},
    goldFlow: {},
    recruitsBySource: {},
    itemsBySource: {},
    itemsBySourceWon: {},
    merges: 0,
    mergesWon: 0,
    mergeOffers: 0,
    mergeOffersWon: 0,
    knockouts: emptyKnockoutCounts(),
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

export function emptyMoveAgg(): MoveAgg {
  return { casts: 0, damage: 0, dot: 0, healing: 0, kos: 0, manaSpent: 0, fights: 0 };
}

export function emptySignature(): SignatureAgg {
  return { reached: 0, taken: 0, reachedWon: 0 };
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
  into.rosterSizeEndSum += from.rosterSizeEndSum;
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
  for (const id of Object.keys(from.castsByMove)) into.castsByMove[id] = (into.castsByMove[id] ?? 0) + from.castsByMove[id];
  mergeCounts(into.moves, from.moves, emptyMoveAgg);
  mergeCounts(into.enemyMoves, from.enemyMoves, emptyMoveAgg);
  mergeCounts(into.movesByAct, from.movesByAct, emptyMoveAgg);
  mergeCounts(into.movesByHero, from.movesByHero, emptyMoveAgg);
  mergeCounts(into.signatures, from.signatures, emptySignature);
  mergeCounts(into.moveOffers, from.moveOffers, () => ({ offered: 0, taken: 0 }));
  mergeArray(into.signaturesPerRun, from.signaturesPerRun);
  mergeArray(into.signaturesPerRunWon, from.signaturesPerRunWon);
  mergeArray(into.evolutionAtEncounter, from.evolutionAtEncounter);
  for (const id of Object.keys(from.fieldSets)) into.fieldSets[id] = (into.fieldSets[id] ?? 0) + from.fieldSets[id];
  for (const id of Object.keys(from.enemyFieldSets)) into.enemyFieldSets[id] = (into.enemyFieldSets[id] ?? 0) + from.enemyFieldSets[id];
  for (const id of Object.keys(from.fieldRounds)) into.fieldRounds[id] = (into.fieldRounds[id] ?? 0) + from.fieldRounds[id];
  into.fightRounds += from.fightRounds;
  into.playerTurns += from.playerTurns;
  into.playerRests += from.playerRests;
  into.playerSwitches += from.playerSwitches;
  into.lockInFights += from.lockInFights;
  mergeArray(into.statDeltaCountByAct, from.statDeltaCountByAct);
  mergeArray(into.statDeltaAuthoredByAct, from.statDeltaAuthoredByAct);
  mergeArray(into.statDeltaLandedByAct, from.statDeltaLandedByAct);
  mergeArray(into.enemyStatDeltaCountByAct, from.enemyStatDeltaCountByAct);
  mergeArray(into.enemyStatDeltaAuthoredByAct, from.enemyStatDeltaAuthoredByAct);
  mergeArray(into.enemyStatDeltaLandedByAct, from.enemyStatDeltaLandedByAct);
  mergeArray(into.heldDropsByAct, from.heldDropsByAct);
  mergeArray(into.enemyHeldDropsByAct, from.enemyHeldDropsByAct);
  for (const key of Object.keys(from.shieldByAct)) {
    if (!into.shieldByAct[key]) into.shieldByAct[key] = [];
    mergeArray(into.shieldByAct[key], from.shieldByAct[key]);
  }
  mergeArray(into.fightsByAct, from.fightsByAct);
  mergeArray(into.wouldHaveCappedByAct, from.wouldHaveCappedByAct);
  mergeArray(into.flooredByAct, from.flooredByAct);
  mergeArray(into.wouldHaveCappedUpByAct, from.wouldHaveCappedUpByAct);
  mergeArray(into.wouldHaveCappedDownByAct, from.wouldHaveCappedDownByAct);
  mergeArray(into.peakModifierFracSumByAct, from.peakModifierFracSumByAct);
  mergeArray(into.actEntered, from.actEntered);
  mergeArray(into.actCleared, from.actCleared);
  mergeArray(into.deathAct, from.deathAct);
  mergeArray(into.roundHistogram, from.roundHistogram);
  mergeArray(into.heroLevelHistogram, from.heroLevelHistogram);
  mergeArray(into.heroLevelHistogramDeep, from.heroLevelHistogramDeep);
  for (const key of Object.keys(from.castsByTier)) into.castsByTier[key] = (into.castsByTier[key] ?? 0) + from.castsByTier[key];
  for (const key of Object.keys(from.castsByManaBand)) into.castsByManaBand[key] = (into.castsByManaBand[key] ?? 0) + from.castsByManaBand[key];
  for (const key of Object.keys(from.pipsBySource)) into.pipsBySource[key] = (into.pipsBySource[key] ?? 0) + from.pipsBySource[key];
  for (const key of Object.keys(from.pipsBySourceWon)) into.pipsBySourceWon[key] = (into.pipsBySourceWon[key] ?? 0) + from.pipsBySourceWon[key];
  for (const key of Object.keys(from.goldFlow)) into.goldFlow[key] = (into.goldFlow[key] ?? 0) + from.goldFlow[key];
  for (const key of Object.keys(from.recruitsBySource)) into.recruitsBySource[key] = (into.recruitsBySource[key] ?? 0) + from.recruitsBySource[key];
  for (const key of Object.keys(from.itemsBySource)) into.itemsBySource[key] = (into.itemsBySource[key] ?? 0) + from.itemsBySource[key];
  for (const key of Object.keys(from.itemsBySourceWon)) into.itemsBySourceWon[key] = (into.itemsBySourceWon[key] ?? 0) + from.itemsBySourceWon[key];
  into.merges += from.merges;
  into.mergesWon += from.mergesWon;
  into.mergeOffers += from.mergeOffers;
  into.mergeOffersWon += from.mergeOffersWon;
  addKnockoutCounts(into.knockouts, from.knockouts);
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
  mergeCounts(into.locationChoices, from.locationChoices, emptyChoice);
}
