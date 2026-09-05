// RunRecord -> Aggregate. Everything here is a running sum so a worker can
// fold thousands of runs without keeping any of them.

import { TOTAL_ACTS } from '../../src/run/state';
import type { RunRecord } from './run';
import {
  emptyChoice,
  emptyEnemy,
  emptyFightKind,
  emptyHero,
  type Aggregate,
  type ChoiceAgg,
} from './types';

function choiceBucket(agg: Aggregate, bucket: string): Record<string, ChoiceAgg> {
  switch (bucket) {
    case 'relic':
      return agg.relicChoices;
    case 'banner':
      return agg.bannerChoices;
    case 'evolution':
      return agg.evolutionChoices;
    case 'class':
      return agg.classChoices;
    default:
      return agg.draftChoices;
  }
}

export function foldRun(agg: Aggregate, record: RunRecord): void {
  agg.runs += 1;
  if (record.won) agg.wins += 1;
  agg.encountersWonSum += record.encountersWon;
  agg.goldEndSum += record.goldEnd;
  agg.levelUpPoolEndSum += record.levelUpPoolEnd;
  agg.rosterLevelEndSum += record.rosterLevelEnd;

  for (let act = 1; act <= Math.min(record.actReached, TOTAL_ACTS); act++) agg.actEntered[act] += 1;
  for (const act of record.actsCleared) agg.actCleared[act] += 1;
  if (record.won) agg.actCleared[TOTAL_ACTS] += 1;
  if (!record.won) {
    agg.deathAct[Math.min(record.deathAct || record.actReached, TOTAL_ACTS)] += 1;
    const key = record.deathNodeType ?? 'unknown';
    agg.deathByNodeType[key] = (agg.deathByNodeType[key] ?? 0) + 1;
  }

  for (const key of record.equipped) agg.equipRarityByAct[key] = (agg.equipRarityByAct[key] ?? 0) + 1;

  for (const fight of record.fights) {
    const key = `${fight.act}:${fight.mapNodeType}`;
    const kind = (agg.fightKinds[key] ??= emptyFightKind());
    kind.n += 1;
    if (fight.won) kind.wins += 1;
    kind.roundsSum += fight.rounds;
    kind.playerHpFracSum += fight.playerHpFrac;
    if (fight.pactTicked) kind.pactFights += 1;
    if (fight.stalemate) kind.stalemates += 1;

    if (fight.mapNodeType === 'boss' || fight.mapNodeType === 'finale') {
      const guardianKey = fight.mapNodeType === 'finale' ? 'FINALE' : `${fight.locationId}@act${fight.act}`;
      const g = (agg.guardians[guardianKey] ??= emptyFightKind());
      g.n += 1;
      if (fight.won) g.wins += 1;
      g.roundsSum += fight.rounds;
      g.playerHpFracSum += fight.playerHpFrac;
      if (fight.pactTicked) g.pactFights += 1;
      if (fight.stalemate) g.stalemates += 1;
    }

    agg.roundHistogram[fight.rounds] = (agg.roundHistogram[fight.rounds] ?? 0) + 1;
    agg.playerTurns += fight.playerTurns;
    for (const tier of Object.keys(fight.castsByTier)) agg.castsByTier[tier] = (agg.castsByTier[tier] ?? 0) + fight.castsByTier[tier];
    for (const band of Object.keys(fight.castsByManaBand)) agg.castsByManaBand[band] = (agg.castsByManaBand[band] ?? 0) + fight.castsByManaBand[band];
    agg.playerRests += fight.playerRests;
    agg.playerSwitches += fight.playerSwitches;
    if (fight.lockedIn) agg.lockInFights += 1;

    for (const heroId of Object.keys(fight.playerHeroes)) {
      const t = fight.playerHeroes[heroId];
      const hero = (agg.heroes[heroId] ??= emptyHero());
      hero.fielded += 1;
      if (fight.won) hero.fieldedWins += 1;
      hero.roundsActive += t.rounds;
      hero.damageDealt += t.dealt;
      hero.damageTaken += t.taken;
      hero.healingDone += t.healed;
      hero.kos += t.kos;
      if (t.died) hero.deaths += 1;
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
