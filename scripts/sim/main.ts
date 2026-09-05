// Batch driver. Forks one worker per core, splits the seed range across them,
// merges the shards and prints the report.
//
//   node dist/scripts/sim/main.js --runs 2000 --policy spread --out sim-report.txt

import { fork } from 'child_process';
import { cpus } from 'os';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { formatReport } from './report';
import { emptyAggregate, mergeAggregate, type Aggregate } from './types';
import { runShard, type WorkerJob } from './worker';
import type { LevelPolicy } from './policy';

interface Args {
  runs: number;
  policy: LevelPolicy;
  seed: number;
  workers: number;
  xpMult: number;
  switching: boolean;
  out: string | null;
  json: string | null;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = {
    runs: 500,
    policy: 'spread',
    seed: 1,
    workers: Math.max(1, cpus().length - 1),
    xpMult: 1,
    switching: true,
    out: null,
    json: null,
  };
  for (let i = 0; i < argv.length; i += 2) {
    const value = argv[i + 1];
    switch (argv[i]) {
      case '--runs':
        args.runs = Number(value);
        break;
      case '--policy':
        args.policy = value === 'focus' ? 'focus' : 'spread';
        break;
      case '--seed':
        args.seed = Number(value);
        break;
      case '--workers':
        args.workers = Math.max(1, Number(value));
        break;
      case '--xpmult':
        args.xpMult = Number(value);
        break;
      case '--switching':
        args.switching = value !== 'off';
        break;
      case '--out':
        args.out = value;
        break;
      case '--json':
        args.json = value;
        break;
      default:
        break;
    }
  }
  return args;
}

function shard(job: WorkerJob): Promise<Aggregate> {
  return new Promise((resolve, reject) => {
    const child = fork(join(__dirname, 'worker.js'), [], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    child.on('message', (agg) => resolve(agg as Aggregate));
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0) reject(new Error(`worker exited ${code}`));
    });
    child.send(job);
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const started = Date.now();
  const total = emptyAggregate();

  if (args.workers === 1) {
    mergeAggregate(total, runShard({ firstSeed: args.seed, runs: args.runs, levelPolicy: args.policy, xpMult: args.xpMult, playerSwitching: args.switching }));
  } else {
    // Contiguous seed blocks, so any single run stays reproducible by seed alone.
    const perWorker = Math.ceil(args.runs / args.workers);
    const jobs: WorkerJob[] = [];
    for (let i = 0; i < args.workers; i++) {
      const first = args.seed + i * perWorker;
      const runs = Math.min(perWorker, args.seed + args.runs - first);
      if (runs > 0) jobs.push({ firstSeed: first, runs, levelPolicy: args.policy, xpMult: args.xpMult, playerSwitching: args.switching });
    }
    process.stderr.write(`simulating ${args.runs} runs across ${jobs.length} workers...\n`);
    const results = await Promise.all(jobs.map(shard));
    for (const result of results) mergeAggregate(total, result);
  }

  const report = formatReport(total, {
    runs: args.runs,
    levelPolicy: args.policy,
    seed: args.seed,
    xpMult: args.xpMult,
    switching: args.switching,
    wallMs: Date.now() - started,
  });
  process.stdout.write(report);
  if (args.out) writeFileSync(args.out, report, 'utf8');
  if (args.json) writeFileSync(args.json, JSON.stringify(total), 'utf8');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
