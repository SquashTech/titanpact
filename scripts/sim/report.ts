// Aggregate -> a plain-text balance report. Nothing here decides anything; it
// only lays the counters out so a designer can read them.

import { heroes } from '../../src/data/heroes';
import { allCombatants } from '../../src/data/content';
import { relics } from '../../src/data/relics';
import { classes } from '../../src/data/classes';
import { locations } from '../../src/data/locations';
import { progressionTable } from '../../src/data/progression';
import { TOTAL_ACTS } from '../../src/run/state';
import type { Aggregate, ChoiceAgg } from './types';

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return '   -  ';
  return `${((100 * numerator) / denominator).toFixed(1).padStart(5)}%`;
}

function num(value: number, digits = 1): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '-';
}

function pad(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : text + ' '.repeat(width - text.length);
}

function padStart(text: string, width: number): string {
  return text.length >= width ? text : ' '.repeat(width - text.length) + text;
}

function heading(title: string): string {
  return `\n${'='.repeat(78)}\n${title}\n${'='.repeat(78)}`;
}

/**
 * The lift of taking an option over leaving it on the table. Both arms come
 * from the same randomized decision points, so the difference is the option's
 * own contribution; `se` is the two-sample standard error of that difference.
 */
export interface Lift {
  n: number;
  lift: number;
  se: number;
  z: number;
  pickRate: number;
  winRatePicked: number;
}

export function liftOf(choice: ChoiceAgg): Lift {
  const nPicked = choice.picked;
  const nRest = choice.offered - choice.picked;
  const restProgress = choice.offeredProgress - choice.pickedProgress;
  const restProgressSq = choice.offeredProgressSq - choice.pickedProgressSq;
  if (nPicked < 2 || nRest < 2) {
    return { n: nPicked, lift: 0, se: Infinity, z: 0, pickRate: 0, winRatePicked: 0 };
  }
  const meanPicked = choice.pickedProgress / nPicked;
  const meanRest = restProgress / nRest;
  const varPicked = Math.max(0, choice.pickedProgressSq / nPicked - meanPicked * meanPicked);
  const varRest = Math.max(0, restProgressSq / nRest - meanRest * meanRest);
  const se = Math.sqrt(varPicked / nPicked + varRest / nRest);
  const lift = meanPicked - meanRest;
  return {
    n: nPicked,
    lift,
    se,
    z: se > 0 ? lift / se : 0,
    pickRate: choice.picked / choice.offered,
    winRatePicked: nPicked > 0 ? choice.pickedWins / nPicked : 0,
  };
}

function liftTable(title: string, bucket: Record<string, ChoiceAgg>, label: (id: string) => string, minN = 30): string {
  const rows = Object.keys(bucket)
    .map((id) => ({ id, ...liftOf(bucket[id]) }))
    .filter((row) => row.n >= minN)
    .sort((a, b) => b.lift - a.lift);
  if (rows.length === 0) return `${title}\n  (no option reached n=${minN})\n`;
  const lines = [
    title,
    `  ${pad('option', 34)}${padStart('n', 6)}${padStart('lift', 8)}${padStart('±se', 7)}${padStart('z', 7)}${padStart('win%', 7)}`,
  ];
  for (const row of rows) {
    const flag = Math.abs(row.z) >= 2 ? (row.z > 0 ? '  <<' : '  >>') : '';
    lines.push(
      `  ${pad(label(row.id), 34)}${padStart(String(row.n), 6)}${padStart(num(row.lift, 2), 8)}${padStart(num(row.se, 2), 7)}${padStart(num(row.z, 1), 7)}${padStart(num(100 * row.winRatePicked, 1), 7)}${flag}`
    );
  }
  return lines.join('\n') + '\n';
}

const pathNames: Record<string, string> = {};
for (const heroId of Object.keys(progressionTable.evolutions)) {
  for (const node of progressionTable.evolutions[heroId]) {
    for (const path of node.paths) {
      pathNames[path.id] = `${heroes[heroId]?.name ?? heroId}: ${path.name} (${path.kind[0]})`;
    }
  }
}

export function formatReport(
  agg: Aggregate,
  meta: { runs: number; levelPolicy: string; seed: number; xpMult: number; switching: boolean; wallMs: number }
): string {
  const out: string[] = [];
  const R = agg.runs || 1;

  out.push('TITANPACT — BATCH RUN SIMULATION');
  out.push(
    `runs=${agg.runs}  levelPolicy=${meta.levelPolicy}  xpMult=${meta.xpMult}  playerSwitching=${meta.switching ? 'on' : 'off'}` +
      `  baseSeed=${meta.seed}  wall=${(meta.wallMs / 1000).toFixed(1)}s  cpu=${(agg.elapsedMs / 1000).toFixed(0)}s`
  );
  out.push('Both sides are piloted by src/run/ai.ts, which aims at type matchups but never plans.');
  out.push('Player skill is therefore a CONSTANT here, not a variable: absolute win rates are a');
  out.push('FLOOR, and the comparisons between options are the part that transfers. The player');
  out.push('side additionally cycles a hero out rather than Resting; the enemy AI never switches,');
  out.push('in the simulator or in the real game.');

  // --- Run outcomes ---
  out.push(heading('1. RUN OUTCOMES'));
  out.push(`  full-clear rate            ${pct(agg.wins, R)}   (${agg.wins}/${agg.runs})`);
  out.push(`  encounters won per run     ${num(agg.encountersWonSum / R, 2)}`);
  out.push(`  mean roster level at end   ${num(agg.rosterLevelEndSum / R, 2)}`);
  out.push(`  gold unspent at end        ${num(agg.goldEndSum / R, 1)}`);
  out.push(`  XP pool unspent at end     ${num(agg.levelUpPoolEndSum / R, 2)}`);
  out.push('');
  out.push(`  ${pad('act', 6)}${padStart('entered', 10)}${padStart('cleared', 10)}${padStart('clear%', 9)}${padStart('died here', 11)}`);
  for (let act = 1; act <= TOTAL_ACTS; act++) {
    out.push(
      `  ${pad(String(act), 6)}${padStart(String(agg.actEntered[act]), 10)}${padStart(String(agg.actCleared[act]), 10)}${padStart(pct(agg.actCleared[act], agg.actEntered[act]), 9)}${padStart(String(agg.deathAct[act]), 11)}`
    );
  }
  out.push('');
  out.push('  runs ended at node type:');
  for (const [type, count] of Object.entries(agg.deathByNodeType).sort((a, b) => b[1] - a[1])) {
    out.push(`    ${pad(type, 12)}${padStart(String(count), 7)}${padStart(pct(count, agg.runs - agg.wins), 8)}`);
  }

  // --- Fight difficulty ---
  out.push(heading('2. FIGHT DIFFICULTY BY ACT AND NODE'));
  out.push(`  ${pad('act:node', 16)}${padStart('n', 8)}${padStart('win%', 8)}${padStart('rounds', 8)}${padStart('endHP%', 8)}${padStart('pact%', 8)}${padStart('stale', 7)}`);
  const kindKeys = Object.keys(agg.fightKinds).sort((a, b) => {
    const [actA, typeA] = a.split(':');
    const [actB, typeB] = b.split(':');
    return Number(actA) - Number(actB) || typeA.localeCompare(typeB);
  });
  for (const key of kindKeys) {
    const k = agg.fightKinds[key];
    if (k.n < 5) continue;
    out.push(
      `  ${pad(key, 16)}${padStart(String(k.n), 8)}${padStart(pct(k.wins, k.n), 8)}${padStart(num(k.roundsSum / k.n, 1), 8)}${padStart(num((100 * k.playerHpFracSum) / k.n, 1), 8)}${padStart(pct(k.pactFights, k.n), 8)}${padStart(String(k.stalemates), 7)}`
    );
  }

  // --- Guardians ---
  out.push(heading('3. GUARDIANS AND THE FINALE'));
  out.push(`  ${pad('fight', 30)}${padStart('n', 8)}${padStart('win%', 8)}${padStart('rounds', 8)}${padStart('endHP%', 8)}${padStart('pact%', 8)}`);
  const guardianKeys = Object.keys(agg.guardians).sort((a, b) => {
    if (a === 'FINALE') return 1;
    if (b === 'FINALE') return -1;
    return (a.split('@act')[1] ?? '').localeCompare(b.split('@act')[1] ?? '') || a.localeCompare(b);
  });
  for (const key of guardianKeys) {
    const g = agg.guardians[key];
    if (g.n < 3) continue;
    const [locId, act] = key.split('@act');
    const name = key === 'FINALE' ? 'The Endbringer (act 6)' : `${locations[locId]?.name ?? locId} (act ${act})`;
    out.push(
      `  ${pad(name, 30)}${padStart(String(g.n), 8)}${padStart(pct(g.wins, g.n), 8)}${padStart(num(g.roundsSum / g.n, 1), 8)}${padStart(num((100 * g.playerHpFracSum) / g.n, 1), 8)}${padStart(pct(g.pactFights, g.n), 8)}`
    );
  }

  // --- Heroes ---
  out.push(heading('4. HEROES'));
  out.push('  DPR = damage dealt per round on the field. dmg/taken > 1 means the hero out-trades.');
  out.push(`  ${pad('hero', 20)}${padStart('runs', 6)}${padStart('fights', 8)}${padStart('win%', 7)}${padStart('DPR', 7)}${padStart('TPR', 7)}${padStart('ratio', 7)}${padStart('KO/f', 7)}${padStart('die%', 7)}${padStart('heal', 7)}${padStart('lvl', 6)}`);
  const heroRows = Object.keys(agg.heroes)
    .filter((id) => agg.heroes[id].fielded >= 20)
    .sort((a, b) => {
      const ha = agg.heroes[a];
      const hb = agg.heroes[b];
      return hb.fieldedWins / hb.fielded - ha.fieldedWins / ha.fielded;
    });
  for (const id of heroRows) {
    const h = agg.heroes[id];
    const dpr = h.roundsActive > 0 ? h.damageDealt / h.roundsActive : 0;
    const tpr = h.roundsActive > 0 ? h.damageTaken / h.roundsActive : 0;
    out.push(
      `  ${pad(allCombatants[id]?.name ?? id, 20)}${padStart(String(h.runs), 6)}${padStart(String(h.fielded), 8)}${padStart(pct(h.fieldedWins, h.fielded), 7)}${padStart(num(dpr, 1), 7)}${padStart(num(tpr, 1), 7)}${padStart(num(tpr > 0 ? dpr / tpr : 0, 2), 7)}${padStart(num(h.kos / h.fielded, 2), 7)}${padStart(pct(h.deaths, h.fielded), 7)}${padStart(num(h.roundsActive > 0 ? h.healingDone / h.roundsActive : 0, 1), 7)}${padStart(num(h.runs > 0 ? h.finalLevelSum / h.runs : 0, 1), 6)}`
    );
  }

  out.push('');
  out.push(liftTable(
    '  DRAFT LIFT — extra encounters won when this starter was taken vs. left on the table:',
    agg.draftChoices,
    (id) => allCombatants[id]?.name ?? id,
    30
  ));

  // --- Enemies ---
  out.push(heading('5. ENEMIES'));
  out.push(`  ${pad('enemy', 22)}${padStart('fights', 8)}${padStart('lose%', 8)}${padStart('DPR', 8)}${padStart('TPR', 8)}${padStart('KO/f', 7)}${padStart('die%', 7)}`);
  const enemyRows = Object.keys(agg.enemies)
    .filter((id) => agg.enemies[id].fights >= 20)
    .sort((a, b) => agg.enemies[b].playerLosses / agg.enemies[b].fights - agg.enemies[a].playerLosses / agg.enemies[a].fights);
  // The finale's UNSEALED champions carry the same display name as the sealed ones they
  // replay, so a colliding name must show its id or the two rows are unreadable.
  const nameCounts: Record<string, number> = {};
  for (const id of enemyRows) {
    const name = allCombatants[id]?.name ?? id;
    nameCounts[name] = (nameCounts[name] ?? 0) + 1;
  }
  for (const id of enemyRows) {
    const e = agg.enemies[id];
    const name = allCombatants[id]?.name ?? id;
    const dpr = e.roundsActive > 0 ? e.damageDealt / e.roundsActive : 0;
    const tpr = e.roundsActive > 0 ? e.damageTaken / e.roundsActive : 0;
    out.push(
      `  ${pad(nameCounts[name] > 1 ? `${name} [${id}]` : name, 22)}${padStart(String(e.fights), 8)}${padStart(pct(e.playerLosses, e.fights), 8)}${padStart(num(dpr, 1), 8)}${padStart(num(tpr, 1), 8)}${padStart(num(e.kos / e.fights, 2), 7)}${padStart(pct(e.deaths, e.fights), 7)}`
    );
  }

  // --- Relics ---
  out.push(heading('6. RELICS'));
  out.push('  Offered 3 at a time and taken at random, so lift is a matched comparison.');
  out.push(liftTable('', agg.relicChoices, (id) => relics[id]?.name ?? id, 15));
  out.push('  GUARDIAN BANNERS (fixed 1-of-3, so every offer count is identical):');
  out.push(liftTable('', agg.bannerChoices, (id) => relics[id]?.name ?? id, 15));

  // --- Classes ---
  out.push(heading('7. CLASSES'));
  out.push(liftTable('', agg.classChoices, (id) => classes[id]?.name ?? id, 20));

  // --- Evolution paths ---
  out.push(heading('8. EVOLUTION PATHS'));
  out.push('  Only paths that reached the minimum sample; a hero that rarely survives to level 5');
  out.push('  will not appear at all, which is itself worth noticing.');
  out.push(liftTable('', agg.evolutionChoices, (id) => pathNames[id] ?? id, 15));

  // --- Loot and pacing ---
  out.push(heading('9. LOOT AND PACING'));
  out.push('  equipment actually worn, by act and rarity:');
  const rarities = ['common', 'rare', 'epic', 'legendary', 'mythic'];
  out.push(`  ${pad('act', 6)}${rarities.map((r) => padStart(r, 11)).join('')}${padStart('total', 9)}`);
  for (let act = 1; act <= TOTAL_ACTS; act++) {
    const counts = rarities.map((r) => agg.equipRarityByAct[`${act}:${r}`] ?? 0);
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    out.push(`  ${pad(String(act), 6)}${counts.map((c, i) => padStart(`${c} (${total > 0 ? ((100 * c) / total).toFixed(0) : 0}%)`, 11)).join('')}${padStart(String(total), 9)}`);
  }
  out.push('');
  const totalFights = agg.roundHistogram.reduce((a, b) => a + (b ?? 0), 0);
  const pactFights = agg.roundHistogram.slice(30).reduce((a, b) => a + (b ?? 0), 0);
  let cumulative = 0;
  let median = 0;
  for (let i = 0; i < agg.roundHistogram.length; i++) {
    cumulative += agg.roundHistogram[i] ?? 0;
    if (median === 0 && cumulative >= totalFights / 2) median = i;
  }
  out.push(`  fights simulated           ${totalFights}`);
  out.push(`  median fight length        ${median} rounds`);
  out.push(`  fights reaching round 30   ${pct(pactFights, totalFights)}  (the Pact Clock's start)`);
  const stalemates = Object.values(agg.fightKinds).reduce((sum, k) => sum + k.stalemates, 0);
  out.push(`  fights hitting the cap     ${stalemates}  (engine stalls the Pact Clock did not close)`);
  out.push('');
  out.push('  the mana economy, player side:');
  out.push(`    turns taken              ${agg.playerTurns}`);
  out.push(`    spent Resting            ${pct(agg.playerRests, agg.playerTurns)}`);
  out.push(`    spent cycling out        ${pct(agg.playerSwitches, agg.playerTurns)}`);
  out.push(`    fights reaching lock-in  ${pct(agg.lockInFights, totalFights)}  (player side lost 2+ heroes)`);

  // The movepool gate. MOVE_TIER_LEVEL is early 1 / mid 4 / late 7, and EVERY move costing
  // 70+ mana is late-tier — so this table says whether the expensive half of the catalog is
  // reachable at all, which is what makes a big Mana pool worth anything.
  const levels = agg.heroLevelHistogram;
  const heroRuns = levels.reduce((sum, n) => sum + (n ?? 0), 0);
  const atLeast = (level: number) => levels.slice(level).reduce((sum, n) => sum + (n ?? 0), 0);
  const gates: readonly (readonly [string, number])[] = [
    ['mid tier (lvl 4)', 4],
    ['Evolution (lvl 5)', 5],
    ['LATE tier (lvl 7)', 7],
    ['mastery (lvl 11)', 11],
  ];
  out.push('');
  out.push(`  the movepool gate — best level reached, over ${heroRuns} (hero, run) pairs:`);
  for (const [label, level] of gates) {
    out.push(`    reached ${pad(label, 20)}${padStart(pct(atLeast(level), heroRuns), 8)}`);
  }

  const totalCasts = Object.values(agg.castsByTier).reduce((sum, n) => sum + n, 0);
  out.push('');
  out.push('  player casts by move tier:');
  for (const tier of ['early', 'mid', 'late']) {
    const n = agg.castsByTier[tier] ?? 0;
    out.push(`    ${pad(tier, 20)}${padStart(String(n), 11)}${padStart(pct(n, totalCasts), 9)}`);
  }
  out.push('  player casts by mana spent:');
  for (const band of ['0-19', '20-39', '40-59', '60-79', '80+']) {
    const n = agg.castsByManaBand[band] ?? 0;
    out.push(`    ${pad(band, 20)}${padStart(String(n), 11)}${padStart(pct(n, totalCasts), 9)}`);
  }

  return out.join('\n') + '\n';
}
