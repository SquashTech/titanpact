// Aggregate -> a plain-text balance report. Nothing here decides anything; it
// only lays the counters out so a designer can read them.

import { heroes } from '../../src/data/heroes';
import { allCombatants } from '../../src/data/content';
import { isTitanspawn } from '../../src/data/titanspawn';
import { relics } from '../../src/data/relics';
import { passives } from '../../src/data/passives';
import { classes } from '../../src/data/classes';
import { locations } from '../../src/data/locations';
import { progressionTable } from '../../src/data/progression';
import { DEFAULT_SCHEDULE } from '../../src/run/progression';
import { TOTAL_ACTS } from '../../src/run/state';
import type { Aggregate, ChoiceAgg, HeroAgg } from './types';
import { addTimeCounts, emptyTimeCounts, PACE_PROFILES, SCREEN_SECONDS, secondsFor, type ScreenKind } from './time';

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return '   -  ';
  return `${((100 * numerator) / denominator).toFixed(1).padStart(5)}%`;
}

function num(value: number, digits = 1): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '-';
}

function mean(sum: number, n: number): string {
  return n > 0 ? num(sum / n, 2) : '-';
}

function pad(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : text + ' '.repeat(width - text.length);
}

function padStart(text: string, width: number): string {
  return text.length >= width ? text : ' '.repeat(width - text.length) + text;
}

/** Mean and quantiles of a whole-minute histogram (index = minutes). */
function quantiles(histogram: readonly number[]): { mean: number; p10: number; p50: number; p90: number } {
  let n = 0;
  let sum = 0;
  for (let m = 0; m < histogram.length; m++) {
    n += histogram[m] ?? 0;
    sum += (histogram[m] ?? 0) * (m + 0.5);
  }
  if (n === 0) return { mean: NaN, p10: NaN, p50: NaN, p90: NaN };
  const at = (q: number) => {
    let seen = 0;
    for (let m = 0; m < histogram.length; m++) {
      seen += histogram[m] ?? 0;
      if (seen >= q * n) return m + 0.5;
    }
    return histogram.length;
  };
  return { mean: sum / n, p10: at(0.1), p50: at(0.5), p90: at(0.9) };
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
  meta: { runs: number; levelPolicy: string; seed: number; xpMult: number; switching: boolean; pilot: string; wallMs: number }
): string {
  const out: string[] = [];
  const R = agg.runs || 1;

  out.push('TITANPACT — BATCH RUN SIMULATION');
  out.push(
    `runs=${agg.runs}  pilot=${meta.pilot}  levelPolicy=${meta.levelPolicy}  xpMult=${meta.xpMult}  playerSwitching=${meta.switching ? 'on' : 'off'}` +
      `  baseSeed=${meta.seed}  wall=${(meta.wallMs / 1000).toFixed(1)}s  cpu=${(agg.elapsedMs / 1000).toFixed(0)}s`
  );
  if (meta.pilot === 'greedy') {
    out.push('The player side is piloted by scripts/sim/pilot.ts: it scores every option in HP off the');
    out.push('real damage, heal and status pipelines, finishes what it can kill, and cycles for a');
    out.push('better matchup. One ply deep — a better floor, not a ceiling.');
  } else {
    out.push('The player side is piloted by src/run/ai.ts, which aims at type matchups but never');
    out.push('plans, and cycles a hero out rather than Resting.');
  }
  out.push('The ENEMY is always src/run/ai.ts — what the game ships — and never switches. Player');
  out.push('skill is a CONSTANT within a batch, not a variable: absolute win rates are a floor,');
  out.push('and the comparisons between options are the part that transfers.');

  // --- Run outcomes ---
  out.push(heading('1. RUN OUTCOMES'));
  out.push(`  full-clear rate            ${pct(agg.wins, R)}   (${agg.wins}/${agg.runs})`);
  out.push(`  encounters won per run     ${num(agg.encountersWonSum / R, 2)}`);
  out.push(`  mean roster level at end   ${num(agg.rosterLevelEndSum / R, 2)}`);
  out.push(`  gold unspent at end        ${num(agg.goldEndSum / R, 1)}`);
  out.push(
    `  companion                  joined ${pct(agg.companionJoined, R)}, lost ${pct(agg.companionLost, Math.max(1, agg.companionJoined))} of those` +
      (agg.companionLost > 0 ? ` (mean encounter ${num(agg.companionLostAtSum / agg.companionLost, 1)})` : '')
  );
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

  // --- Run length ---
  out.push(heading('1b. RUN LENGTH (estimated wall-clock)'));
  out.push('  The sim counts beats, action declarations and screens; scripts/sim/time.ts prices each in');
  out.push('  seconds. The counts are measured, the prices are assumptions — read the shape, then fix');
  out.push('  the prices against a stopwatch.');
  out.push('');
  out.push(
    `  ${pad('completed runs, minutes', 26)}${padStart('mean', 8)}${padStart('p10', 8)}${padStart('median', 8)}${padStart('p90', 8)}${padStart('beats', 8)}${padStart('actions', 9)}${padStart('screens', 9)}`
  );
  const wholeWon = emptyTimeCounts();
  for (let act = 1; act <= TOTAL_ACTS; act++) addTimeCounts(wholeWon, agg.timeByActWon[act]);
  PACE_PROFILES.forEach((profile, i) => {
    const q = quantiles(agg.runMinutesWon[i]);
    const split = secondsFor(wholeWon, profile);
    const share = (part: number) => (split.total > 0 ? pct(part, split.total) : '-');
    out.push(
      `  ${pad(profile.label, 26)}${padStart(num(q.mean, 1), 8)}${padStart(num(q.p10, 0), 8)}${padStart(num(q.p50, 0), 8)}${padStart(num(q.p90, 0), 8)}${padStart(share(split.beats), 8)}${padStart(share(split.actions), 9)}${padStart(share(split.screens), 9)}`
    );
  });
  out.push('');
  out.push(`  ${pad('lost runs, minutes', 26)}${padStart('mean', 8)}${padStart('p10', 8)}${padStart('median', 8)}${padStart('p90', 8)}`);
  PACE_PROFILES.forEach((profile, i) => {
    const q = quantiles(agg.runMinutesLost[i]);
    out.push(`  ${pad(profile.label, 26)}${padStart(num(q.mean, 1), 8)}${padStart(num(q.p10, 0), 8)}${padStart(num(q.p50, 0), 8)}${padStart(num(q.p90, 0), 8)}`);
  });
  out.push('');
  out.push('  per act, completed runs, Reader profile (rounds = per fight, beats = per round):');
  out.push(
    `  ${pad('act', 6)}${padStart('fights', 8)}${padStart('rounds', 8)}${padStart('beats', 8)}${padStart('actions', 9)}${padStart('screens', 9)}${padStart('fight min', 11)}${padStart('other min', 11)}${padStart('total', 8)}`
  );
  const reader = PACE_PROFILES[0];
  const W = agg.wins || 1;
  for (let act = 1; act <= TOTAL_ACTS; act++) {
    const t = agg.timeByActWon[act];
    const split = secondsFor(t, reader);
    const screens = Object.values(t.screens).reduce((a, b) => a + (b ?? 0), 0);
    out.push(
      `  ${pad(String(act), 6)}${padStart(num(t.fights / W, 1), 8)}${padStart(num(t.fights > 0 ? t.rounds / t.fights : 0, 1), 8)}${padStart(num(t.rounds > 0 ? t.beats / t.rounds : 0, 1), 8)}${padStart(num(t.actions / W, 0), 9)}${padStart(num(screens / W, 0), 9)}${padStart(num((split.beats + split.actions) / W / 60, 1), 11)}${padStart(num(split.screens / W / 60, 1), 11)}${padStart(num(split.total / W / 60, 1), 8)}`
    );
  }
  out.push('');
  out.push('  where the out-of-fight minutes go, completed runs (Reader):');
  const screenRows = (Object.keys(wholeWon.screens) as ScreenKind[])
    .map((kind) => ({ kind, n: wholeWon.screens[kind] ?? 0, seconds: (wholeWon.screens[kind] ?? 0) * SCREEN_SECONDS[kind] }))
    .sort((a, b) => b.seconds - a.seconds);
  for (const row of screenRows) {
    out.push(`    ${pad(row.kind, 18)}${padStart(num(row.n / W, 1), 7)} /run${padStart(num(row.seconds / W / 60, 1), 8)} min`);
  }

  // --- Fight difficulty ---
  out.push(heading('2. FIGHT DIFFICULTY BY ACT AND NODE'));
  out.push('  player/enemy = fielded stat totals, six combat stats. It is the RATIO that says who is out-scaling whom.');
  out.push(
    `  ${pad('act:node', 16)}${padStart('n', 8)}${padStart('win%', 8)}${padStart('rounds', 8)}${padStart('endHP%', 8)}${padStart('player', 8)}${padStart('enemy', 8)}${padStart('ratio', 7)}`
  );
  const kindKeys = Object.keys(agg.fightKinds).sort((a, b) => {
    const [actA, typeA] = a.split(':');
    const [actB, typeB] = b.split(':');
    return Number(actA) - Number(actB) || typeA.localeCompare(typeB);
  });
  for (const key of kindKeys) {
    const k = agg.fightKinds[key];
    if (k.n < 5) continue;
    const player = k.playerStatsSum / k.n;
    const enemy = k.enemyStatsSum / k.n;
    out.push(
      `  ${pad(key, 16)}${padStart(String(k.n), 8)}${padStart(pct(k.wins, k.n), 8)}${padStart(num(k.roundsSum / k.n, 1), 8)}${padStart(num((100 * k.playerHpFracSum) / k.n, 1), 8)}${padStart(num(player, 0), 8)}${padStart(num(enemy, 0), 8)}${padStart(num(enemy > 0 ? player / enemy : 0, 2), 7)}`
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

  // Growth grades are authored to make placement, not size, the difference between heroes
  // (CLAUDE.md "Growth grades"): a late bloomer should read weak here and strong there. The
  // trade ratio is the per-hero number least confounded by which fights it was fielded in.
  out.push('');
  out.push('  HEROES BY HALF — acts 1-2 vs acts 3-6. ratio = damage dealt / damage taken per round on');
  out.push('  the field; delta = late minus early. Every hero grows the same 9.1 points a level, so a');
  out.push('  big positive delta is a late bloomer and a big negative one is front-loaded — or a kit');
  out.push('  the enemy curve outruns, which is the trap-pick shape to look for.');
  out.push(`  ${pad('hero', 20)}${padStart('early n', 8)}${padStart('ratio', 7)}${padStart('die%', 7)}${padStart('KO/f', 6)}${padStart('late n', 8)}${padStart('ratio', 7)}${padStart('die%', 7)}${padStart('KO/f', 6)}${padStart('delta', 7)}`);
  const halfRows = heroRows
    .map((id) => {
      const e = agg.heroesByHalf[`${id}:early`];
      const l = agg.heroesByHalf[`${id}:late`];
      const ratioOf = (h: HeroAgg | undefined) => (h && h.damageTaken > 0 ? h.damageDealt / h.damageTaken : NaN);
      return { id, e, l, re: ratioOf(e), rl: ratioOf(l) };
    })
    .filter((r) => r.e && r.l && r.e.fielded >= 20 && r.l.fielded >= 20)
    .sort((a, b) => b.rl - b.re - (a.rl - a.re));
  for (const r of halfRows) {
    const e = r.e!;
    const l = r.l!;
    out.push(
      `  ${pad(allCombatants[r.id]?.name ?? r.id, 20)}${padStart(String(e.fielded), 8)}${padStart(num(r.re, 2), 7)}${padStart(pct(e.deaths, e.fielded), 7)}${padStart(num(e.kos / e.fielded, 2), 6)}${padStart(String(l.fielded), 8)}${padStart(num(r.rl, 2), 7)}${padStart(pct(l.deaths, l.fielded), 7)}${padStart(num(l.kos / l.fielded, 2), 6)}${padStart((r.rl - r.re >= 0 ? '+' : '') + num(r.rl - r.re, 2), 7)}`
    );
  }
  // The companion is one hero across up to three bodies (src/run/companion.ts), so its bodies
  // are summed into one row here — the question the overhaul's phase 6 asks is its trade ratio
  // by run half, and 42 rows of under-twenty fights cannot answer it.
  const companionHalf = (half: 'early' | 'late') => {
    const sum = { fielded: 0, deaths: 0, kos: 0, damageDealt: 0, damageTaken: 0 };
    for (const [key, h] of Object.entries(agg.heroesByHalf)) {
      const [id, at] = key.split(':');
      if (at !== half || !isTitanspawn(id)) continue;
      sum.fielded += h.fielded;
      sum.deaths += h.deaths;
      sum.kos += h.kos;
      sum.damageDealt += h.damageDealt;
      sum.damageTaken += h.damageTaken;
    }
    return sum;
  };
  const ce = companionHalf('early');
  const cl = companionHalf('late');
  if (ce.fielded > 0 && cl.fielded > 0) {
    const re = ce.damageTaken > 0 ? ce.damageDealt / ce.damageTaken : 0;
    const rl = cl.damageTaken > 0 ? cl.damageDealt / cl.damageTaken : 0;
    out.push(
      `  ${pad('THE COMPANION (all)', 20)}${padStart(String(ce.fielded), 8)}${padStart(num(re, 2), 7)}${padStart(pct(ce.deaths, ce.fielded), 7)}${padStart(num(ce.kos / ce.fielded, 2), 6)}${padStart(String(cl.fielded), 8)}${padStart(num(rl, 2), 7)}${padStart(pct(cl.deaths, cl.fielded), 7)}${padStart(num(cl.kos / cl.fielded, 2), 6)}${padStart((rl - re >= 0 ? '+' : '') + num(rl - re, 2), 7)}`
    );
  }

  out.push('');
  out.push(liftTable(
    '  DRAFT LIFT — extra encounters won when this starter was taken vs. left on the table:',
    agg.draftChoices,
    (id) => allCombatants[id]?.name ?? id,
    30
  ));

  out.push('  NODE LIFT — a map row offers several node types and the walk takes one at random, so');
  out.push('  this is the same matched comparison the tables above are: what taking THIS kind of node');
  out.push('  was worth against whatever else its row could have given. A row whose options were all');
  out.push('  one type contributes nothing.');
  out.push(liftTable('', agg.nodeChoices, (id) => id, 30));
  out.push('');

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
  out.push('  GUARDIAN BANNERS (fixed 1-of-5, so every offer count is identical):');
  out.push(liftTable('', agg.bannerChoices, (id) => relics[id]?.name ?? id, 15));
  out.push('  BOONS — the type-locked ones are only OFFERED to a roster that fields the type,');
  out.push('  so a low offer count there is the filter working, not a rare roll.');
  out.push(liftTable('', agg.boonChoices, (id) => passives[id]?.name ?? id, 15));

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
  out.push('  items obtained per run by source and act (all = per run that ENTERED the act; won = completed runs):');
  const itemSources = ['drop', 'node', 'event', 'contract'];
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  out.push(`  ${pad('act', 6)}${itemSources.map((s) => padStart(s, 10)).join('')}${padStart('total', 8)}   ${itemSources.map((s) => padStart(`won:${s}`, 13)).join('')}${padStart('total', 8)}`);
  const itemTotals = { all: 0, won: 0 };
  for (let act = 1; act <= TOTAL_ACTS; act++) {
    const entered = agg.actEntered[act] || 1;
    const all = itemSources.map((s) => (agg.itemsBySource[`${act}:${s}`] ?? 0) / entered);
    const won = itemSources.map((s) => (agg.itemsBySourceWon[`${act}:${s}`] ?? 0) / (agg.wins || 1));
    itemTotals.all += sum(all);
    itemTotals.won += sum(won);
    out.push(`  ${pad(String(act), 6)}${all.map((v) => padStart(num(v, 2), 10)).join('')}${padStart(num(sum(all), 2), 8)}   ${won.map((v) => padStart(num(v, 2), 13)).join('')}${padStart(num(sum(won), 2), 8)}`);
  }
  out.push(`  ${pad('sum', 6)}${' '.repeat(40)}${padStart(num(itemTotals.all, 2), 8)}   ${' '.repeat(52)}${padStart(num(itemTotals.won, 2), 8)}`);
  out.push('  (the "all" sum adds per-act means conditioned on entering each act: a full run\'s expectation, not a mean over dying runs)');
  out.push(`  merge offered (somebody held the family)  ${num(agg.mergeOffers / R, 2)} /run  (completed runs ${agg.wins > 0 ? num(agg.mergeOffersWon / agg.wins, 2) : '-'})`);
  out.push(`  merge taken by the pilot                  ${num(agg.merges / R, 2)} /run  (completed runs ${agg.wins > 0 ? num(agg.mergesWon / agg.wins, 2) : '-'})`);
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

  // Mastery pips by source (docs/mastery.md §3): the supply is the only balance number — the
  // target is every hero evolved and ~3 signatures a run, ~35-40 pips on the middle path.
  out.push('');
  out.push(`  Mastery pips landed, by source — per run (all ${R}) and per completed run (${agg.wins}):`);
  let pipsAll = 0;
  let pipsWon = 0;
  for (const source of Object.keys(agg.pipsBySource).sort()) {
    const all = agg.pipsBySource[source] ?? 0;
    const won = agg.pipsBySourceWon[source] ?? 0;
    pipsAll += all;
    pipsWon += won;
    out.push(`    ${pad(source, 24)}${padStart(mean(all, R), 8)}${padStart(agg.wins > 0 ? mean(won, agg.wins) : '-', 10)}`);
  }
  out.push(`    ${pad('TOTAL', 24)}${padStart(mean(pipsAll, R), 8)}${padStart(agg.wins > 0 ? mean(pipsWon, agg.wins) : '-', 10)}`);
  out.push('');
  out.push('  heroes joining after the draft, per run, by route:');
  for (const source of Object.keys(agg.recruitsBySource).sort()) {
    out.push(`    ${pad(source, 24)}${padStart(mean(agg.recruitsBySource[source], R), 8)}`);
  }

  // The movepool gate is the SCHEDULE (docs/xp-overhaul.md §4): a level opens Mid, one opens
  // Late, so the gates are read off best level reached (the Evolution is on Mastery pips now, not
  // a level — docs/mastery.md). EVERY move costing Late-tier is the expensive half of the catalog
  // (45+ since the phase-6 re-price), so this table says whether it is reachable at all, which is
  // what makes a big Mana pool worth anything. Read at the DEFAULT schedule; an authored per-hero
  // one (phase 4) moves a hero's own gates, not the table's.
  const levelHist = agg.heroLevelHistogram;
  const heroRuns = levelHist.reduce((sum, n) => sum + (n ?? 0), 0);
  const atLeast = (level: number) => levelHist.slice(level).reduce((sum, n) => sum + (n ?? 0), 0);
  const gates: readonly (readonly [string, number])[] = [
    [`Mid tier (Lv ${DEFAULT_SCHEDULE.midLevel})`, DEFAULT_SCHEDULE.midLevel],
    [`LATE tier (Lv ${DEFAULT_SCHEDULE.lateLevel})`, DEFAULT_SCHEDULE.lateLevel],
  ];
  // Split, because the whole-batch column is dominated by heroes that died in Act 1. The DEEP
  // column is the one that answers "does a player who gets there actually reach the late-tier
  // movepool".
  const deep = agg.heroLevelHistogramDeep;
  const deepRuns = deep.reduce((sum, n) => sum + (n ?? 0), 0);
  const atLeastDeep = (level: number) => deep.slice(level).reduce((sum, n) => sum + (n ?? 0), 0);
  out.push('');
  out.push(`  the movepool gate — best level reached, all ${heroRuns} (hero, run) pairs vs. the ${deepRuns} that reached act 4+:`);
  out.push(`    ${pad('', 24)}${padStart('all', 10)}${padStart('act 4+', 10)}`);
  for (const [label, level] of gates) {
    out.push(
      `    ${pad(label, 24)}${padStart(pct(atLeast(level), heroRuns), 10)}${padStart(pct(atLeastDeep(level), deepRuns), 10)}`
    );
  }
  // §11's stated target is a fully evolved roster by the end of a run.
  out.push(`    ${pad('roster evolved at end', 24)}${padStart(pct(agg.rosterEvolvedEndSum, R), 10)}   (every hero: ${pct(agg.runsRosterEvolved, R)} of runs)`);

  const totalCasts = ['early', 'mid', 'late'].reduce((sum, tier) => sum + (agg.castsByTier[tier] ?? 0), 0);
  out.push('');
  out.push('  player casts by move tier (whole run, then by act — the Late band cannot exist before it opens):');
  for (const tier of ['early', 'mid', 'late']) {
    const n = agg.castsByTier[tier] ?? 0;
    const byAct = [1, 2, 3, 4, 5, 6].map((act) => {
      const total = ['early', 'mid', 'late'].reduce((sum, t) => sum + (agg.castsByTier[`${act}:${t}`] ?? 0), 0);
      return padStart(pct(agg.castsByTier[`${act}:${tier}`] ?? 0, total), 8);
    });
    out.push(`    ${pad(tier, 20)}${padStart(String(n), 11)}${padStart(pct(n, totalCasts), 9)}   ${byAct.join('')}`);
  }
  out.push(`    ${pad('', 40)}   ${[1, 2, 3, 4, 5, 6].map((act) => padStart(`act ${act}`, 8)).join('')}`);
  out.push('  stat deltas (docs/stat-scaling.md), by the CASTER\'s side: landed/authored is the scaling; "past x4" / "under -S/2" the share of fights a modifier sat outside the [-1/2 S, +3S] band on that side (0 once each end is built), "floored" the share where a used stat reached 0 and the floor at 1 took over (§10); "held" is drops the −½S floor shortened, as a share of that side’s deltas (§3):');
  out.push(`    ${pad('', 20)}${padStart('player', 9)}${padStart('landed/auth', 13)}${padStart('enemy', 9)}${padStart('landed/auth', 13)}${padStart('peak mod/S', 12)}${padStart('past x4', 10)}${padStart('under -S/2', 12)}${padStart('floored', 10)}${padStart('held p/e', 14)}`);
  for (const act of [1, 2, 3, 4, 5, 6]) {
    const n = agg.statDeltaCountByAct[act] ?? 0;
    const fights = agg.fightsByAct[act] ?? 0;
    const ratio = (agg.statDeltaAuthoredByAct[act] ?? 0) > 0 ? ((agg.statDeltaLandedByAct[act] ?? 0) / (agg.statDeltaAuthoredByAct[act] ?? 1)).toFixed(2) : '-';
    const peak = fights > 0 ? ((agg.peakModifierFracSumByAct[act] ?? 0) / fights).toFixed(2) : '-';
    const en = agg.enemyStatDeltaCountByAct[act] ?? 0;
    const eRatio = (agg.enemyStatDeltaAuthoredByAct[act] ?? 0) > 0 ? ((agg.enemyStatDeltaLandedByAct[act] ?? 0) / (agg.enemyStatDeltaAuthoredByAct[act] ?? 1)).toFixed(2) : '-';
    out.push(`    ${pad(`act ${act}`, 20)}${padStart(String(n), 9)}${padStart(ratio, 13)}${padStart(String(en), 9)}${padStart(eRatio, 13)}${padStart(peak, 12)}${padStart(pct(agg.wouldHaveCappedUpByAct[act] ?? 0, fights), 10)}${padStart(pct(agg.wouldHaveCappedDownByAct[act] ?? 0, fights), 12)}${padStart(pct(agg.flooredByAct[act] ?? 0, fights), 10)}${padStart(`${pct(agg.heldDropsByAct[act] ?? 0, n)} / ${pct(agg.enemyHeldDropsByAct[act] ?? 0, en)}`, 14)}`);
  }
  out.push('  Shield (docs/shield.md §8 phase 4), by the HOLDER\'s side: casts = Shield riders landed, granted = pool added, absorbed = what pools took off hits, broken = pools a hit emptied, capped = casts the max-HP cap shortened; "absorbed/taken" is the player side\'s absorb as a share of every hit it was dealt (absorbed + through), and phys/mag that share of hits by category:');
  out.push(`    ${pad('', 20)}${padStart('fights', 8)}${padStart('casts p/e', 14)}${padStart('granted p/e', 18)}${padStart('absorbed p/e', 18)}${padStart('broken p/e', 14)}${padStart('capped p/e', 12)}${padStart('absorbed/taken', 16)}${padStart('phys/mag taken', 16)}`);
  const sh = (key: string, act: number) => agg.shieldByAct[key]?.[act] ?? 0;
  for (const act of [1, 2, 3, 4, 5, 6]) {
    const fights = agg.fightsByAct[act] ?? 0;
    const taken = sh('takenPhysical', act) + sh('takenMagical', act);
    out.push(
      `    ${pad(`act ${act}`, 20)}${padStart(String(fights), 8)}${padStart(`${sh('casts', act)} / ${sh('enemyCasts', act)}`, 14)}${padStart(`${sh('granted', act)} / ${sh('enemyGranted', act)}`, 18)}${padStart(`${sh('absorbed', act)} / ${sh('enemyAbsorbed', act)}`, 18)}${padStart(`${sh('broken', act)} / ${sh('enemyBroken', act)}`, 14)}${padStart(`${sh('capped', act)} / ${sh('enemyCapped', act)}`, 12)}${padStart(pct(sh('absorbed', act), taken), 16)}${padStart(`${pct(sh('takenPhysical', act), taken)} / ${pct(sh('takenMagical', act), taken)}`, 16)}`
    );
  }
  out.push('  the Shield cards, player casts (all runs) and per 1000 player turns:');
  for (const id of ['tideGuard', 'bastion', 'ironSkin', 'livingWall', 'rampart', 'vigil', 'iceShell']) {
    const n = agg.castsByMove[id] ?? 0;
    out.push(`    ${pad(id, 20)}${padStart(String(n), 11)}${padStart((agg.playerTurns > 0 ? (n * 1000) / agg.playerTurns : 0).toFixed(1), 9)}`);
  }
  out.push('  player casts by mana spent:');
  for (const band of ['0-19', '20-39', '40-59', '60-79', '80+']) {
    const n = agg.castsByManaBand[band] ?? 0;
    out.push(`    ${pad(band, 20)}${padStart(String(n), 11)}${padStart(pct(n, totalCasts), 9)}`);
  }

  return out.join('\n') + '\n';
}
