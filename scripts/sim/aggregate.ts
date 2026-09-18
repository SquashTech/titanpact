// RunRecord -> Aggregate. Everything here is a running sum so a worker can
// fold thousands of runs without keeping any of them.

import { TOTAL_ACTS } from '../../src/run/state';
import { addTimeCounts, emptyTimeCounts, PACE_PROFILES, secondsFor } from './time';
import type { RunRecord } from './run';
import {
  emptyChoice,
  emptyEnemy,
  addKnockoutCounts,
  emptyFightKind,
  emptyHero,
  emptyMoveAgg,
  emptySignature,
  type Aggregate,
  type ChoiceAgg,
  type MoveAgg,
} from './types';
import type { MoveTally } from './fight';

function foldMoves(into: Record<string, MoveAgg>, from: Record<string, MoveTally>, prefix = ''): void {
  for (const id of Object.keys(from)) {
    const t = from[id];
    const m = (into[prefix + id] ??= emptyMoveAgg());
    m.fights += 1;
    m.casts += t.casts;
    m.damage += t.damage;
    m.dot += t.dot;
    m.healing += t.healing;
    m.kos += t.kos;
    m.manaSpent += t.manaSpent;
  }
}

function choiceBucket(agg: Aggregate, bucket: string): Record<string, ChoiceAgg> {
  switch (bucket) {
    case 'boon':
      return agg.boonChoices;
    case 'banner':
      return agg.bannerChoices;
    case 'evolution':
      return agg.evolutionChoices;
    case 'class':
      return agg.classChoices;
    case 'node':
      return agg.nodeChoices;
    default:
      return agg.draftChoices;
  }
}

export function foldRun(agg: Aggregate, record: RunRecord): void {
  agg.runs += 1;
  if (record.won) agg.wins += 1;
  agg.encountersWonSum += record.encountersWon;
  agg.goldEndSum += record.goldEnd;
  if (record.companionHeroId) agg.companionJoined += 1;
  if (record.companionLostAt !== null) {
    agg.companionLost += 1;
    agg.companionLostAtSum += record.companionLostAt;
  }
  agg.rosterLevelEndSum += record.rosterLevelEnd;
  agg.rosterEvolvedEndSum += record.rosterEvolvedEnd;
  if (record.rosterEvolvedEnd >= 1) agg.runsRosterEvolved += 1;

  for (let act = 1; act <= Math.min(record.actReached, TOTAL_ACTS); act++) agg.actEntered[act] += 1;
  for (const act of record.actsCleared) agg.actCleared[act] += 1;
  if (record.won) agg.actCleared[TOTAL_ACTS] += 1;
  if (!record.won) {
    agg.deathAct[Math.min(record.deathAct || record.actReached, TOTAL_ACTS)] += 1;
    const key = record.deathNodeType ?? 'unknown';
    agg.deathByNodeType[key] = (agg.deathByNodeType[key] ?? 0) + 1;
  }

  for (const key of record.equipped) agg.equipRarityByAct[key] = (agg.equipRarityByAct[key] ?? 0) + 1;
  for (const key of Object.keys(record.goldFlow)) agg.goldFlow[key] = (agg.goldFlow[key] ?? 0) + record.goldFlow[key];
  for (const key of Object.keys(record.pipsBySource)) {
    agg.pipsBySource[key] = (agg.pipsBySource[key] ?? 0) + record.pipsBySource[key];
    if (record.won) agg.pipsBySourceWon[key] = (agg.pipsBySourceWon[key] ?? 0) + record.pipsBySource[key];
  }
  for (const key of Object.keys(record.recruitsBySource)) agg.recruitsBySource[key] = (agg.recruitsBySource[key] ?? 0) + record.recruitsBySource[key];
  for (const key of Object.keys(record.itemsBySource)) {
    agg.itemsBySource[key] = (agg.itemsBySource[key] ?? 0) + record.itemsBySource[key];
    if (record.won) agg.itemsBySourceWon[key] = (agg.itemsBySourceWon[key] ?? 0) + record.itemsBySource[key];
  }
  agg.merges += record.merges;
  agg.mergeOffers += record.mergeOffers;
  addKnockoutCounts(agg.knockouts, record.knockouts);
  let signaturesThisRun = 0;
  for (const heroId of Object.keys(record.signatures)) {
    const s = record.signatures[heroId];
    const slot = (agg.signatures[heroId] ??= emptySignature());
    slot.reached += s.reached;
    slot.taken += s.taken;
    if (record.won) slot.reachedWon += s.reached;
    signaturesThisRun += s.reached;
  }
  agg.signaturesPerRun[signaturesThisRun] = (agg.signaturesPerRun[signaturesThisRun] ?? 0) + 1;
  for (const moveId of Object.keys(record.moveOffers)) {
    const slot = (agg.moveOffers[moveId] ??= { offered: 0, taken: 0 });
    slot.offered += record.moveOffers[moveId].offered;
    slot.taken += record.moveOffers[moveId].taken;
  }
  if (record.won) agg.signaturesPerRunWon[signaturesThisRun] = (agg.signaturesPerRunWon[signaturesThisRun] ?? 0) + 1;
  if (record.won) {
    agg.mergesWon += record.merges;
    agg.mergeOffersWon += record.mergeOffers;
  }

  const whole = emptyTimeCounts();
  for (let act = 1; act < record.timeByAct.length; act++) {
    addTimeCounts(agg.timeByAct[act], record.timeByAct[act]);
    if (record.won) addTimeCounts(agg.timeByActWon[act], record.timeByAct[act]);
    addTimeCounts(whole, record.timeByAct[act]);
  }
  PACE_PROFILES.forEach((profile, i) => {
    const minutes = Math.floor(secondsFor(whole, profile).total / 60);
    const histogram = record.won ? agg.runMinutesWon[i] : agg.runMinutesLost[i];
    histogram[minutes] = (histogram[minutes] ?? 0) + 1;
  });

  for (const fight of record.fights) {
    const key = `${fight.act}:${fight.mapNodeType}`;
    const kind = (agg.fightKinds[key] ??= emptyFightKind());
    kind.n += 1;
    if (fight.won) kind.wins += 1;
    kind.roundsSum += fight.rounds;
    kind.playerHpFracSum += fight.playerHpFrac;
    if (fight.pactTicked) kind.pactFights += 1;
    if (fight.stalemate) kind.stalemates += 1;
    kind.playerStatsSum += fight.playerSquadStats;
    kind.enemyStatsSum += fight.enemySquadStats;

    if (fight.mapNodeType === 'boss' || fight.mapNodeType === 'finale') {
      const guardianKey = fight.mapNodeType === 'finale' ? 'FINALE' : `${fight.locationId}@act${fight.act}`;
      const g = (agg.guardians[guardianKey] ??= emptyFightKind());
      g.n += 1;
      if (fight.won) g.wins += 1;
      g.roundsSum += fight.rounds;
      g.playerHpFracSum += fight.playerHpFrac;
      if (fight.pactTicked) g.pactFights += 1;
      if (fight.stalemate) g.stalemates += 1;
      g.playerStatsSum += fight.playerSquadStats;
      g.enemyStatsSum += fight.enemySquadStats;
    }

    agg.roundHistogram[fight.rounds] = (agg.roundHistogram[fight.rounds] ?? 0) + 1;
    for (const id of Object.keys(fight.fieldSets)) agg.fieldSets[id] = (agg.fieldSets[id] ?? 0) + fight.fieldSets[id];
    for (const id of Object.keys(fight.enemyFieldSets)) agg.enemyFieldSets[id] = (agg.enemyFieldSets[id] ?? 0) + fight.enemyFieldSets[id];
    for (const id of Object.keys(fight.fieldRounds)) agg.fieldRounds[id] = (agg.fieldRounds[id] ?? 0) + fight.fieldRounds[id];
    agg.fightRounds += fight.rounds;
    agg.playerTurns += fight.playerTurns;
    for (const tier of Object.keys(fight.castsByTier)) {
      agg.castsByTier[tier] = (agg.castsByTier[tier] ?? 0) + fight.castsByTier[tier];
      agg.castsByTier[`${fight.act}:${tier}`] = (agg.castsByTier[`${fight.act}:${tier}`] ?? 0) + fight.castsByTier[tier];
    }
    for (const band of Object.keys(fight.castsByManaBand)) agg.castsByManaBand[band] = (agg.castsByManaBand[band] ?? 0) + fight.castsByManaBand[band];
    for (const id of Object.keys(fight.castsByMove)) agg.castsByMove[id] = (agg.castsByMove[id] ?? 0) + fight.castsByMove[id];
    foldMoves(agg.moves, fight.moves);
    foldMoves(agg.enemyMoves, fight.enemyMoves);
    foldMoves(agg.movesByAct, fight.moves, `${fight.act}:`);
    foldMoves(agg.movesByHero, fight.movesByHero);
    agg.playerRests += fight.playerRests;
    agg.playerSwitches += fight.playerSwitches;
    if (fight.lockedIn) agg.lockInFights += 1;
    agg.statDeltaCountByAct[fight.act] = (agg.statDeltaCountByAct[fight.act] ?? 0) + fight.statDeltaCount;
    agg.statDeltaAuthoredByAct[fight.act] = (agg.statDeltaAuthoredByAct[fight.act] ?? 0) + fight.statDeltaAuthored;
    agg.statDeltaLandedByAct[fight.act] = (agg.statDeltaLandedByAct[fight.act] ?? 0) + fight.statDeltaLanded;
    agg.enemyStatDeltaCountByAct[fight.act] = (agg.enemyStatDeltaCountByAct[fight.act] ?? 0) + fight.enemyStatDeltaCount;
    agg.enemyStatDeltaAuthoredByAct[fight.act] = (agg.enemyStatDeltaAuthoredByAct[fight.act] ?? 0) + fight.enemyStatDeltaAuthored;
    agg.enemyStatDeltaLandedByAct[fight.act] = (agg.enemyStatDeltaLandedByAct[fight.act] ?? 0) + fight.enemyStatDeltaLanded;
    agg.heldDropsByAct[fight.act] = (agg.heldDropsByAct[fight.act] ?? 0) + fight.heldDrops;
    agg.enemyHeldDropsByAct[fight.act] = (agg.enemyHeldDropsByAct[fight.act] ?? 0) + fight.enemyHeldDrops;
    for (const [key, value] of Object.entries(fight.shield) as [string, number][]) {
      if (!agg.shieldByAct[key]) agg.shieldByAct[key] = [];
      agg.shieldByAct[key][fight.act] = (agg.shieldByAct[key][fight.act] ?? 0) + value;
    }
    agg.fightsByAct[fight.act] = (agg.fightsByAct[fight.act] ?? 0) + 1;
    agg.wouldHaveCappedByAct[fight.act] = (agg.wouldHaveCappedByAct[fight.act] ?? 0) + (fight.wouldHaveCapped ? 1 : 0);
    agg.peakModifierFracSumByAct[fight.act] = (agg.peakModifierFracSumByAct[fight.act] ?? 0) + fight.peakModifierFrac;
    agg.flooredByAct[fight.act] = (agg.flooredByAct[fight.act] ?? 0) + (fight.floored ? 1 : 0);
    agg.wouldHaveCappedUpByAct[fight.act] = (agg.wouldHaveCappedUpByAct[fight.act] ?? 0) + (fight.wouldHaveCappedUp ? 1 : 0);
    agg.wouldHaveCappedDownByAct[fight.act] = (agg.wouldHaveCappedDownByAct[fight.act] ?? 0) + (fight.wouldHaveCappedDown ? 1 : 0);

    for (const heroId of Object.keys(fight.playerHeroes)) {
      const t = fight.playerHeroes[heroId];
      const half = fight.act <= 2 ? 'early' : 'late';
      for (const hero of [(agg.heroes[heroId] ??= emptyHero()), (agg.heroesByHalf[`${heroId}:${half}`] ??= emptyHero())]) {
        hero.fielded += 1;
        if (fight.won) hero.fieldedWins += 1;
        hero.roundsActive += t.rounds;
        hero.damageDealt += t.dealt;
        hero.damageTaken += t.taken;
        hero.healingDone += t.healed;
        hero.kos += t.kos;
        if (t.died) hero.deaths += 1;
      }
    }
    for (const heroId of Object.keys(fight.enemyHeroes)) {
      const t = fight.enemyHeroes[heroId];
      const enemy = (agg.enemies[heroId] ??= emptyEnemy());
      enemy.fights += 1;
      if (!fight.won) enemy.playerLosses += 1;
      enemy.roundsActive += t.rounds;
      enemy.damageDealt += t.dealt;
      enemy.damageTaken += t.taken;
      enemy.kos += t.kos;
      if (t.died) enemy.deaths += 1;
    }
  }

  for (const heroId of Object.keys(record.heroLevels)) {
    const hero = (agg.heroes[heroId] ??= emptyHero());
    hero.runs += 1;
    hero.finalLevelSum += record.heroLevels[heroId];
    const best = record.heroLevels[heroId];
    agg.heroLevelHistogram[best] = (agg.heroLevelHistogram[best] ?? 0) + 1;
    if (record.actReached >= 4) agg.heroLevelHistogramDeep[best] = (agg.heroLevelHistogramDeep[best] ?? 0) + 1;
    if (record.won) hero.runsWon += 1;
  }

  for (const choice of record.choices) {
    const bucket = choiceBucket(agg, choice.bucket);
    const progress = record.encountersWon - choice.encountersWonAtChoice;
    if (choice.bucket === 'evolution') {
      agg.evolutionAtEncounter[choice.encountersWonAtChoice] = (agg.evolutionAtEncounter[choice.encountersWonAtChoice] ?? 0) + 1;
    }
    const picked = new Set(choice.picked);
    for (const option of choice.offered) {
      const slot = (bucket[option] ??= emptyChoice());
      slot.offered += 1;
      slot.offeredProgress += progress;
      slot.offeredProgressSq += progress * progress;
      if (record.won) slot.offeredWins += 1;
      if (picked.has(option)) {
        slot.picked += 1;
        slot.pickedProgress += progress;
        slot.pickedProgressSq += progress * progress;
        if (record.won) slot.pickedWins += 1;
      }
    }
    // A pick that was never in `offered` (shouldn't happen) would otherwise vanish.
    for (const option of choice.picked) {
      if (choice.offered.includes(option)) continue;
      const slot = (bucket[option] ??= emptyChoice());
      slot.picked += 1;
      slot.pickedProgress += progress;
      slot.pickedProgressSq += progress * progress;
      if (record.won) slot.pickedWins += 1;
    }
  }
}
