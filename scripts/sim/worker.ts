// One shard of a batch: simulates a seed range and posts a single Aggregate
// back to the parent. Runs are independent, so sharding is just a seed split.

import { foldRun } from './aggregate';
import { simulateRun } from './run';
import { emptyAggregate, type Aggregate } from './types';
import type { LevelPolicy } from './policy';

export interface WorkerJob {
  firstSeed: number;
  runs: number;
  levelPolicy: LevelPolicy;
  xpMult: number;
  playerSwitching: boolean;
}

export function runShard(job: WorkerJob): Aggregate {
  const agg = emptyAggregate();
  const started = Date.now();
  for (let i = 0; i < job.runs; i++) {
    try {
      foldRun(
        agg,
        simulateRun({
          seed: job.firstSeed + i,
          levelPolicy: job.levelPolicy,
          xpMult: job.xpMult,
          playerSwitching: job.playerSwitching,
        })
      );
    } catch (err) {
      // A crashed run is a bug worth seeing, but it must not take the batch down.
      process.stderr.write(`run ${job.firstSeed + i} failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    }
  }
  agg.elapsedMs = Date.now() - started;
  return agg;
}

if (require.main === module) {
  process.on('message', (job: WorkerJob) => {
    const agg = runShard(job);
    process.send!(agg);
    process.exit(0);
  });
}
