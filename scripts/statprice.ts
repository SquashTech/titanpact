// What is a point of HP worth, and are the tanks actually winning?
//
// The 450 hero budget and the equipment tiers have always disagreed by 2x on HP's price, and the
// HP doubling moved both without answering it (docs/progression.md "Pricing HP"). These two
// experiments measure it instead of arguing it. Both are MIRROR-CONTROLLED: everything a per-hero
// win-rate table confounds — draft order, level, who got the gear, which types the run offered —
// is identical on both sides and cancels.
//
//   node dist/scripts/statprice.js price   --fights 2000        what a point of HP is worth
//   node dist/scripts/statprice.js roster  --partner valor    which heroes lines are weak
//   node dist/scripts/statprice.js budget  --points 30        re-spending a hero own budget
//   node dist/scripts/statprice.js mana    --points 20        is Mana Pool worth buying
//   node dist/scripts/statprice.js slot                       what a second item slot is worth

import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import type { StatKey } from '../src/engine/content';
import { createRosterEntry, createRunState, addRosterEntry } from '../src/run/state';
import type { RosterEntry } from '../src/run/state';
import { pickSquad } from '../src/run/squad';
import { progressionTable } from '../src/data/progression';
import {
  MOVE_CAP,
  chooseEvolutionPath,
  grantLevelUpMove,
  levelUpHero,
  levelUpMovePool,
  levelUpPayout,
  pendingEvolution,
  recordMoveOffer,
} from '../src/run/progression';
import { moveValue as policyMoveValue, replacementTarget } from './sim/policy';
import { simulateFight } from './sim/fight';
import { makeRng, withRandom } from './sim/rng';

const ALL = Object.values(heroes);
const STARTERS = ALL.filter((h) => h.starter);
const LEVEL = 5;

/**
 * A hero as a real run would have it at `level`: every level-up spent, each one taking the best
 * move `levelUpMovePool` offers (policy.moveValue, replacing the weakest at MOVE_CAP), and the
 * Evolution taken at EVOLUTION_LEVEL. Built through the run's OWN progression functions, so the
 * tier gates are the ones the game applies.
 *
 * This matters more than it looks. Before 2026-09-08 this harness handed every hero its three-move
 * STARTING KIT at whatever level was asked for, so raising the level changed stats and nothing
 * else — which made a hero designed to be weak early and strong late unmeasurable by construction.
 */
const kitCache = new Map<string, RosterEntry>();

function entryAtLevel(heroId: string, level: number): RosterEntry {
  const key = `${heroId}@${level}`;
  const cached = kitCache.get(key);
  if (cached) return cached;

  let run = addRosterEntry(createRunState(10_000), createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  for (let next = 2; next <= level; next++) {
    run = levelUpHero(run, heroId);
    const entry = run.roster[0];
    const payout = levelUpPayout(progressionTable, moves, entry);
    if (payout === 'evolution') {
      const node = pendingEvolution(progressionTable, entry);
      if (node && node.paths.length > 0) {
        run = chooseEvolutionPath(run, progressionTable, heroes, heroId, node.paths[0].id);
      }
      continue;
    }
    if (payout !== 'move') continue;
    const pool = levelUpMovePool(progressionTable, moves, entry);
    if (pool.length === 0) continue;
    const best = pool.reduce((a, b) => (policyMoveValue(b) > policyMoveValue(a) ? b : a));
    const replace = entry.unlockedMoveIds.length >= MOVE_CAP ? replacementTarget(entry, best) : undefined;
    if (entry.unlockedMoveIds.length >= MOVE_CAP && !replace) {
      run = recordMoveOffer(run, heroId, [best]);
      continue;
    }
    run = grantLevelUpMove(run, heroId, best, replace ?? undefined);
  }
  kitCache.set(key, run.roster[0]);
  return run.roster[0];
}

function rosterOf(heroIds: readonly string[], grant: Partial<Record<StatKey, number>>, level: number = LEVEL): RosterEntry[] {
  return heroIds.map((heroId, i) => ({
    ...entryAtLevel(heroId, level),
    rosterId: `r${i}`,
    bonusStatGrants: { ...grant },
  }));
}

/** One fight. Returns true when side A won. */
function fight(
  seed: number,
  aHeroes: readonly string[],
  aGrant: Partial<Record<StatKey, number>>,
  bHeroes: readonly string[],
  bGrant: Partial<Record<StatKey, number>>,
  level: number = LEVEL
): boolean {
  const a = rosterOf(aHeroes, aGrant, level);
  const b = rosterOf(bHeroes, bGrant, level);
  const rng = makeRng(seed);
  return withRandom(rng, () =>
    simulateFight({
      seed,
      playerRoster: a,
      playerSquad: pickSquad(a, a.map((e) => e.rosterId)),
      playerRelicIds: [],
      aiRoster: b,
      aiSquad: pickSquad(b, b.map((e) => e.rosterId)),
      rng,
      playerSwitching: true,
    }).won
  );
}

function pct(a: number, b: number): string {
  return b === 0 ? '  n/a' : `${((100 * a) / b).toFixed(1)}%`;
}

/** Standard error on a proportion, in percentage points. */
function se(a: number, b: number): number {
  if (b === 0) return 0;
  const p = a / b;
  return 100 * Math.sqrt((p * (1 - p)) / b);
}

// --- Experiment 1: the exchange rate ---

interface Arm {
  label: string;
  /** Amount granted per budget point spent, per stat. */
  per: Partial<Record<StatKey, number>>;
}

const ARMS: Arm[] = [
  // The reference: a point of offense. Both stats at full, because no hero uses both
  // (the Warcry Banner's reasoning, CLAUDE.md).
  { label: 'Attack+Intelligence', per: { attack: 1, intelligence: 1 } },
  // The other half of the tank axis: both are live on every hero, so a point buys half of each.
  { label: 'Defense+Wisdom', per: { defense: 0.5, wisdom: 0.5 } },
  { label: 'Speed', per: { speed: 1 } },
];

/** HP granted per budget point, i.e. 1 / HP_BUDGET_VALUE. The knob under test. */
const HP_RATES = [1, 2, 2.5, 3, 3.5, 4];

function grantFor(per: Partial<Record<StatKey, number>>, points: number): Partial<Record<StatKey, number>> {
  const out: Partial<Record<StatKey, number>> = {};
  for (const [stat, rate] of Object.entries(per)) out[stat as StatKey] = Math.round(points * (rate ?? 0));
  return out;
}

function priceExperiment(fights: number, points: number, pool: readonly { id: string }[]) {
  console.log('EXPERIMENT 1 — what one budget point of HP is worth');
  console.log(`Mirror match: identical squads at level ${LEVEL}, one stat grant differing. Each arm spends`);
  console.log(`${points} budget points, so the two sides cost the same. ${fights * 2} fights per cell, sides swapped.`);
  console.log('"HP win%" is how often the HP grant beat the challenger. 50% means the two prices are equal.\n');

  for (const arm of ARMS) {
    console.log(`  vs ${arm.label} — challenger gets ${JSON.stringify(grantFor(arm.per, points))}`);
    console.log(`    ${'HP/point'.padEnd(10)}${'granted'.padStart(9)}${'HP win%'.padStart(10)}${'±se'.padStart(7)}`);
    for (const rate of HP_RATES) {
      const hpGrant = grantFor({ hp: rate }, points);
      const challenger = grantFor(arm.per, points);
      let wins = 0;
      let n = 0;
      for (let i = 0; i < fights; i++) {
        const pickRng = makeRng(Math.round(rate * 1000) * 7919 + i);
        const remaining = pool.map((h) => h.id);
        const squad: string[] = [];
        while (squad.length < 4 && remaining.length > 0) squad.push(remaining.splice(Math.floor(pickRng() * remaining.length), 1)[0]);
        if (squad.length < 4) continue;
        // Each squad fights twice with the sides swapped, so any first-mover edge cancels.
        if (fight(50_000 + i * 2, squad, hpGrant, squad, challenger)) wins += 1;
        if (!fight(50_000 + i * 2 + 1, squad, challenger, squad, hpGrant)) wins += 1;
        n += 2;
      }
      console.log(`    ${String(rate).padEnd(10)}${`+${Math.round(points * rate)}`.padStart(9)}${pct(wins, n).padStart(10)}${se(wins, n).toFixed(2).padStart(7)}`);
    }
    console.log('');
  }
}

// --- Experiment 2: are the tanks actually winning? ---

/**
 * Every hero fights every other hero, four copies a side, same level, no gear, no relics. The
 * only variable left is the authored stat line, so a hero's win rate IS its line's worth — the
 * number the run-level per-hero table cannot give, because there level and draft order dominate.
 */
function rosterExperiment(repeats: number, partnerId?: string, level: number = LEVEL) {
  const ids = ALL.map((h) => h.id);
  // Four copies of one hero is unfair to a SUPPORT: Zenith's whole kit hands mana to a partner,
  // and against itself it is a Base Power 20 attack. With `partnerId` each side fields two copies
  // of the hero under test plus two of a fixed neutral, so a support has someone to support and
  // both sides carry the same passenger.
  const squadFor = (id: string): string[] =>
    partnerId && id !== partnerId ? [id, id, partnerId, partnerId] : [id, id, id, id];
  const wins: Record<string, number> = {};
  const played: Record<string, number> = {};
  for (const id of ids) {
    wins[id] = 0;
    played[id] = 0;
  }

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = squadFor(ids[i]);
      const b = squadFor(ids[j]);
      for (let r = 0; r < repeats; r++) {
        const seed = 900_000 + (i * 100 + j) * 1000 + r;
        // Swapped sides, so the engine's own side ordering never counts as a hero's strength.
        if (fight(seed, a, {}, b, {}, level)) wins[ids[i]] += 1;
        else wins[ids[j]] += 1;
        if (fight(seed + 500, b, {}, a, {}, level)) wins[ids[j]] += 1;
        else wins[ids[i]] += 1;
        played[ids[i]] += 2;
        played[ids[j]] += 2;
      }
    }
  }

  const rows = ids
    .map((id) => ({
      id,
      name: heroes[id].name,
      hp: heroes[id].baseStats.hp,
      rate: wins[id] / played[id],
      n: played[id],
    }))
    .sort((a, b) => b.rate - a.rate);

  console.log('EXPERIMENT 2 — is a high-HP line actually stronger?');
  console.log(`Round robin: every hero vs every other, four copies a side, level ${LEVEL}, no gear or relics.`);
  console.log(`${rows[0].n} fights per hero. The authored line is the only variable left.\n`);
  console.log(`  ${'hero'.padEnd(13)}${'HP'.padStart(5)}${'win%'.padStart(8)}${'±se'.padStart(7)}`);
  for (const row of rows) {
    console.log(`  ${row.name.padEnd(13)}${String(row.hp).padStart(5)}${pct(row.rate * row.n, row.n).padStart(8)}${se(row.rate * row.n, row.n).toFixed(1).padStart(7)}`);
  }

  // Which authored stats actually pay. Every hero spends the same 450, so a stat that correlates
  // POSITIVELY is one the roster under-buys and a negative one is a stat heroes are wasting points
  // on — the whole "which lines are badly spent" question, one column at a time.
  const STATS: readonly StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed', 'manaPool'];
  const my = rows.reduce((s, r) => s + r.rate, 0) / rows.length;
  console.log(`\n  Correlation of each authored stat with measured win rate, across all ${rows.length} heroes.`);
  console.log(`  Every line spends the same 450, so this reads as: which stats is it worth spending on?\n`);
  console.log(`  ${'stat'.padEnd(14)}${'corr'.padStart(8)}${'per +10'.padStart(10)}`);
  for (const stat of STATS) {
    const xs = rows.map((r) => heroes[r.id].baseStats[stat]);
    const mx = xs.reduce((s, x) => s + x, 0) / xs.length;
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    rows.forEach((r, i) => {
      sxy += (xs[i] - mx) * (r.rate - my);
      sxx += (xs[i] - mx) ** 2;
      syy += (r.rate - my) ** 2;
    });
    const corr = sxy / Math.sqrt(sxx * syy);
    console.log(`  ${stat.padEnd(14)}${corr.toFixed(3).padStart(8)}${((sxy / sxx) * 10 * 100).toFixed(2).padStart(9)}pp`);
  }

  const sorted = [...rows].sort((a, b) => b.hp - a.hp);
  const topTen = sorted.slice(0, 10);
  const bottomTen = sorted.slice(-10);
  const mean = (list: typeof rows) => (list.reduce((s, r) => s + r.rate, 0) / list.length) * 100;
  console.log(`\n  the 10 highest-HP heroes average ${mean(topTen).toFixed(1)}% (mean HP ${(topTen.reduce((s, r) => s + r.hp, 0) / 10).toFixed(0)})`);
  console.log(`  the 10 lowest-HP  heroes average ${mean(bottomTen).toFixed(1)}% (mean HP ${(bottomTen.reduce((s, r) => s + r.hp, 0) / 10).toFixed(0)})`);
}

// --- Experiment 3: the budget question itself ---

/**
 * The decisive one. Experiments 1 and 2 ask what a grant ON TOP is worth and whether high-HP
 * heroes win; this one re-spends a hero's OWN budget at the rate the roster charges. Every
 * variant moves `points` budget points out of HP and into offense, at HP_BUDGET_VALUE — so
 * -2 HP buys +1 Attack and +1 Intelligence, exactly the trade a designer makes authoring a line.
 *
 * If the shifted variant wins, the roster is charging too MUCH for HP and its tanks are
 * short-changed. If the original wins, HP is underpriced and the tanks are getting it free.
 */
function manaExperiment(repeats: number, points: number) {
  console.log('EXPERIMENT 5 — is Mana Pool a stat worth buying?');
  console.log(`Each hero fights itself with ${points} budget points moved out of Mana Pool and into HP`);
  console.log(`at HP_BUDGET_VALUE: -${points} Mana for +${points * 2} HP. Above 50% means the pool was overbought.\n`);

  const shift: Partial<Record<StatKey, number>> = { manaPool: -points, hp: points * 2 };
  const rows: { name: string; mana: number; magical: boolean; rate: number; n: number }[] = [];
  for (const hero of ALL) {
    // Never below what the STARTING kit must cast — a hero that cannot open is not a data point.
    const need = Math.max(0, ...hero.moveIds.map((id) => moves[id]?.manaCost ?? 0));
    if (hero.baseStats.manaPool - points < need) continue;
    const squad = [hero.id, hero.id, hero.id, hero.id];
    let wins = 0;
    let n = 0;
    for (let r = 0; r < repeats; r++) {
      const seed = 600_000 + r * 23;
      if (fight(seed, squad, shift, squad, {})) wins += 1;
      if (!fight(seed + 11, squad, {}, squad, shift)) wins += 1;
      n += 2;
    }
    rows.push({
      name: hero.name,
      mana: hero.baseStats.manaPool,
      magical: hero.baseStats.intelligence > hero.baseStats.attack,
      rate: wins / n,
      n,
    });
  }

  rows.sort((a, b) => b.rate - a.rate);
  console.log(`  ${'hero'.padEnd(13)}${'pool'.padStart(6)}${'kind'.padStart(6)}${'shifted win%'.padStart(14)}`);
  for (const r of rows) {
    console.log(`  ${r.name.padEnd(13)}${String(r.mana).padStart(6)}${(r.magical ? 'MAG' : 'phy').padStart(6)}${pct(r.rate * r.n, r.n).padStart(14)}`);
  }
  const mean = (list: typeof rows) => (list.reduce((s, r) => s + r.rate * r.n, 0) / list.reduce((s, r) => s + r.n, 0)) * 100;
  const mag = rows.filter((r) => r.magical);
  const phy = rows.filter((r) => !r.magical);
  console.log(`\n  ALL      ${mean(rows).toFixed(1)}%  (${rows.length} heroes could spare the points)`);
  console.log(`  magical  ${mean(mag).toFixed(1)}%  (n=${mag.length})`);
  console.log(`  physical ${mean(phy).toFixed(1)}%  (n=${phy.length})`);
}

function budgetExperiment(repeats: number, points: number, hpPerPoint: number) {
  console.log('EXPERIMENT 3 — re-spending a hero’s own budget');
  console.log(`Each hero fights itself with ${points} budget points moved out of HP and into offense,`);
  console.log(`at the roster's current rate of ${hpPerPoint} HP per point: ${points * hpPerPoint} HP for +${points} Attack and +${points} Intelligence.`);
  console.log('Above 50% means the SHIFTED line is better, i.e. the roster charges too much for HP.\n');

  const shift: Partial<Record<StatKey, number>> = { hp: -points * hpPerPoint, attack: points, intelligence: points };
  const rows: { name: string; hp: number; rate: number; n: number }[] = [];
  let totalWins = 0;
  let totalN = 0;

  for (const hero of ALL) {
    const squad = [hero.id, hero.id, hero.id, hero.id];
    let wins = 0;
    let n = 0;
    for (let r = 0; r < repeats; r++) {
      const seed = 700_000 + r * 31;
      if (fight(seed, squad, shift, squad, {})) wins += 1;
      if (!fight(seed + 7, squad, {}, squad, shift)) wins += 1;
      n += 2;
    }
    rows.push({ name: hero.name, hp: hero.baseStats.hp, rate: wins / n, n });
    totalWins += wins;
    totalN += n;
  }

  rows.sort((a, b) => b.rate - a.rate);
  console.log(`  ${'hero'.padEnd(13)}${'HP'.padStart(5)}${'shifted win%'.padStart(14)}`);
  for (const row of rows) console.log(`  ${row.name.padEnd(13)}${String(row.hp).padStart(5)}${pct(row.rate * row.n, row.n).padStart(14)}`);
  console.log(`\n  ROSTER-WIDE: shifted wins ${pct(totalWins, totalN)} ±${se(totalWins, totalN).toFixed(2)} of ${totalN} fights`);
  const better = rows.filter((r) => r.rate > 0.5).length;
  console.log(`  ${better} of ${rows.length} heroes are better off with the points moved out of HP`);
}

// --- Experiment 4: what the second item slot is worth ---

/**
 * `itemSlots: 2` is authored on the nine heroes at Speed <= 40 — and in this roster Speed and HP
 * are anti-correlated, so those nine are ALSO the nine highest-HP heroes (250-300). The rule reads
 * as a Speed rule and lands as an HP rule. Nothing prices the extra slot against the stat line, so
 * this measures it: the same squad, two items each against one.
 */
function slotExperiment(repeats: number, itemA: string, itemB: string) {
  console.log('EXPERIMENT 4 — what the second item slot is worth');
  console.log(`The same squad holding [${itemA}, ${itemB}] against the same squad holding [${itemA}] alone.`);
  console.log('Above 50% means the extra slot is an advantage. It is authored on Speed <= 40, which in');
  console.log('this roster is the nine highest-HP heroes — so it lands on the tanks and nothing prices it.\n');

  let wins = 0;
  let n = 0;
  for (const hero of ALL) {
    const squad = [hero.id, hero.id, hero.id, hero.id];
    for (let r = 0; r < repeats; r++) {
      const seed = 400_000 + r * 17;
      const two = rosterOf(squad, {}).map((e) => ({ ...e, equipment: [itemA, itemB], bonusItemSlots: 2 }));
      const one = rosterOf(squad, {}).map((e) => ({ ...e, equipment: [itemA], bonusItemSlots: 2 }));
      const play = (x: RosterEntry[], y: RosterEntry[], s: number) => {
        const rng = makeRng(s);
        return withRandom(rng, () =>
          simulateFight({
            seed: s,
            playerRoster: x,
            playerSquad: pickSquad(x, x.map((e) => e.rosterId)),
            playerRelicIds: [],
            aiRoster: y,
            aiSquad: pickSquad(y, y.map((e) => e.rosterId)),
            rng,
            playerSwitching: true,
          }).won
        );
      };
      if (play(two, one, seed)) wins += 1;
      if (!play(one, two, seed + 3)) wins += 1;
      n += 2;
    }
  }
  console.log(`  the two-item side wins ${pct(wins, n)} ±${se(wins, n).toFixed(2)} of ${n} fights`);
}

function main() {
  const argv = process.argv.slice(2);
  const mode =
    argv[0] === 'roster' ? 'roster' : argv[0] === 'budget' ? 'budget' : argv[0] === 'slot' ? 'slot' : argv[0] === 'mana' ? 'mana' : 'price';
  const fights = Number(argv[argv.indexOf('--fights') + 1]) || (mode === 'price' ? 1500 : 20);
  const points = Number(argv[argv.indexOf('--points') + 1]) || 40;

  if (mode === 'roster')
    rosterExperiment(
      fights,
      argv.includes('--partner') ? argv[argv.indexOf('--partner') + 1] : undefined,
      Number(argv[argv.indexOf('--level') + 1]) || LEVEL
    );
  else if (mode === 'budget') budgetExperiment(fights, points, Number(argv[argv.indexOf('--hprate') + 1]) || 2);
  else if (mode === 'mana') manaExperiment(fights, points);
  else if (mode === 'slot') slotExperiment(fights, argv[argv.indexOf('--a') + 1] ?? 'sword.rare', argv[argv.indexOf('--b') + 1] ?? 'plate.rare');
  else priceExperiment(fights, points, argv.includes('--starters') ? STARTERS : ALL);
}

main();
