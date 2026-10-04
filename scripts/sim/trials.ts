// The Trials round-robin (docs/constructed.md §11 step 4): every Trial flown as the player side
// into every Trial on the AI side, at the same seeds. Single process — the whole matrix is seconds.
//
//   node dist/scripts/sim/trials.js --fights 20 --pilot chart     both sides on run/ai.ts
//   node dist/scripts/sim/trials.js --pilot greedy                the skilled pilot flies the player side
//   node dist/scripts/sim/trials.js --only spirit                 one Trial's row and column
//   node dist/scripts/sim/trials.js --ai-pilot greedy             the AI side flown by run/pilot.ts, as the Trials ship

import { TRIAL_LIST, constructedContent } from '../../src/data/trials';
import { constructedSide, type TrialDefinition } from '../../src/run/constructed';
import { simulateFight, type PilotKind } from './fight';
import { makeRng } from './rng';

interface Args {
  fights: number;
  pilot: PilotKind;
  only: string | null;
  aiPilot: PilotKind;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { fights: 20, pilot: 'chart', only: null, aiPilot: 'chart' };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i + 1];
    if (argv[i] === '--fights') args.fights = Number(value);
    if (argv[i] === '--pilot') args.pilot = value as PilotKind;
    if (argv[i] === '--only') args.only = value;
    if (argv[i] === '--ai-pilot') args.aiPilot = value as PilotKind;
  }
  return args;
}

/** Player-side win rate of `player` into `ai`, in percent. */
function winRate(player: TrialDefinition, ai: TrialDefinition, args: Args): { pct: number; rounds: number; stalemates: number } {
  let won = 0;
  let rounds = 0;
  let stalemates = 0;
  for (let i = 0; i < args.fights; i++) {
    // The sim has no lead pick, so the player side opens on its authored leads too.
    const p = constructedSide(constructedContent, player.team, player.leads);
    const e = constructedSide(constructedContent, ai.team, ai.leads);
    const outcome = simulateFight({
      seed: i + 1,
      playerRoster: p.run.roster,
      playerSquad: p.squad,
      playerRelicIds: [],
      aiRoster: e.run.roster,
      aiSquad: e.squad,
      rng: makeRng(i * 31 + 7),
      pilot: args.pilot,
      aiPilot: args.aiPilot,
    });
    if (outcome.won) won++;
    if (outcome.stalemate) stalemates++;
    rounds += outcome.rounds;
  }
  return { pct: Math.round((100 * won) / args.fights), rounds, stalemates };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const rows = args.only ? TRIAL_LIST.filter((t) => t.id === args.only) : TRIAL_LIST;
  const cols = TRIAL_LIST;
  const label = (t: TrialDefinition) => t.id.slice(0, 5);
  console.log(`Trials round-robin — ${args.fights} fights a cell, pilot ${args.pilot}, AI flown by ${args.aiPilot === 'greedy' ? 'run/pilot.ts (the Trials)' : 'run/ai.ts (Classic)'}. Rows fly the player side; columns are the AI.`);
  console.log('      ' + cols.map((t) => label(t).padStart(6)).join('') + '    avg');

  const colSum = cols.map(() => 0);
  let rounds = 0;
  let stalemates = 0;
  let fights = 0;
  for (const row of rows) {
    let line = '';
    let sum = 0;
    cols.forEach((col, j) => {
      const r = winRate(row, col, args);
      sum += r.pct;
      colSum[j] += r.pct;
      rounds += r.rounds;
      stalemates += r.stalemates;
      fights += args.fights;
      line += String(r.pct).padStart(6);
    });
    console.log(label(row).padEnd(6) + line + String(Math.round(sum / cols.length)).padStart(7));
  }
  console.log('AI win' + colSum.map((s) => String(100 - Math.round(s / rows.length)).padStart(6)).join(''));
  console.log(`mean rounds ${(rounds / fights).toFixed(1)}, stalemates ${stalemates}/${fights}`);

  if (args.only) {
    const subject = TRIAL_LIST.find((t) => t.id === args.only);
    if (!subject) return;
    const asAi = TRIAL_LIST.filter((t) => t.id !== subject.id).map((t) => 100 - winRate(t, subject, args).pct);
    console.log(`${subject.id} on the AI side into the other ${asAi.length}: ${Math.round(asAi.reduce((a, b) => a + b, 0) / asAi.length)}% won`);
  }
}

main();
