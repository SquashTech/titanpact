// The Gauntlet (docs/gauntlet.md §8 phase 2): whole runs — a board rolled, six drafted by a policy,
// the seeded opponents fought on the shipped AI (run/pilot.ts) until five wins or two losses.
//
//   node dist/scripts/sim/gauntlet.js --runs 300 --pilot chart --draft chart
//   node dist/scripts/sim/gauntlet.js --pilot greedy               the skilled pilot flies the player side
//   node dist/scripts/sim/gauntlet.js --draft random               six off the board in roll order
//   node dist/scripts/sim/gauntlet.js --flat                       no escalation: the same fights, any six

import { heroes } from '../../src/data/heroes';
import { gauntletContent } from '../../src/data/trials';
import { typeChart } from '../../src/data/typechart';
import type { TypeId } from '../../src/engine/content';
import { resolveTypeMult } from '../../src/engine/damage/typeMult';
import { constructedSide, slotTypes, TEAM_SIZE, type TeamSlot } from '../../src/run/constructed';
import { LOSSES_TO_END, WINS_TO_CLEAR, gauntletOpponent, rollBoard, type GauntletRun } from '../../src/run/gauntlet';
import { simulateFight, type PilotKind } from './fight';
import { makeRng } from './rng';

type DraftKind = 'chart' | 'random';

interface Args {
  runs: number;
  pilot: PilotKind;
  draft: DraftKind;
  /** Every opponent rolled as the first fight's is — six candidates, no counter-pick — at the same seed. */
  flat: boolean;
  seed: number;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { runs: 300, pilot: 'chart', draft: 'chart', flat: false, seed: 1 };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i + 1];
    if (argv[i] === '--runs') args.runs = Number(value);
    if (argv[i] === '--pilot') args.pilot = value as PilotKind;
    if (argv[i] === '--draft') args.draft = value as DraftKind;
    if (argv[i] === '--flat') args.flat = true;
    if (argv[i] === '--seed') args.seed = Number(value);
  }
  return args;
}

const DEFENDING: readonly TypeId[] = ['Fire', 'Water', 'Frost', 'Storm', 'Stone', 'Nature', 'Light', 'Shadow', 'Arcane', 'Mind', 'Spirit', 'Iron', 'Mech', 'Beast'];

/**
 * A team's chart value: the defending types its STAB types hit super-effectively, less half the
 * worst pile-up of members one attacking type hits super-effectively. What a player reading the
 * chart drafts toward; it knows nothing of kits or stats.
 */
function teamValue(team: readonly TeamSlot[]): number {
  const typings = team.map((slot) => slotTypes(gauntletContent, slot));
  const stab = new Set(typings.flat());
  const covered = DEFENDING.filter((d) => [...stab].some((t) => resolveTypeMult(typeChart, t, [d]) > 1)).length;
  const pileUp = Math.max(...DEFENDING.map((a) => typings.filter((types) => resolveTypeMult(typeChart, a, types) > 1).length));
  return covered - 0.5 * pileUp;
}

/** Board indices in draft order: greedy on the chart value, or the first six as rolled. */
function draft(board: readonly TeamSlot[], kind: DraftKind): number[] {
  if (kind === 'random') return [0, 1, 2, 3, 4, 5];
  const picked: number[] = [];
  while (picked.length < TEAM_SIZE) {
    let best = -1;
    let bestValue = -Infinity;
    board.forEach((slot, i) => {
      if (picked.includes(i)) return;
      const value = teamValue([...picked.map((j) => board[j]), slot]);
      if (value > bestValue) {
        bestValue = value;
        best = i;
      }
    });
    picked.push(best);
  }
  return picked;
}

/**
 * The in-fight lead pick (LeadPickPanel): the enemy's two are on the field first, and the player
 * opens on the two whose typing best answers them — the same doubling arithmetic as the arrows.
 */
function pickLeads(team: readonly TeamSlot[], foes: readonly TeamSlot[], foeLeads: readonly [string, string]): [string, string] {
  const leadTypes = foes.filter((s) => foeLeads.includes(s.heroId)).map((s) => slotTypes(gauntletContent, s));
  const edge = (slot: TeamSlot) => {
    const mine = slotTypes(gauntletContent, slot);
    return leadTypes.reduce((sum, theirs) => {
      const off = Math.max(...mine.map((t) => resolveTypeMult(typeChart, t, theirs)));
      const def = Math.max(...theirs.map((t) => resolveTypeMult(typeChart, t, mine)));
      return sum + Math.log2(off) - Math.log2(def);
    }, 0);
  };
  const ranked = [...team].sort((a, b) => edge(b) - edge(a));
  return [ranked[0].heroId, ranked[1].heroId];
}

interface RunOutcome {
  wins: number;
  losses: number;
  /** Per fight number (0-based): played, won. */
  fights: { won: boolean; rounds: number; stalemate: boolean }[];
}

function playGauntlet(seed: number, args: Args, owned: readonly string[]): RunOutcome {
  const board = rollBoard(gauntletContent, owned, {}, seed);
  const picks = draft(board, args.draft);
  let run: GauntletRun = { seed, board, team: picks.map((i) => board[i]), wins: 0, losses: 0, fighting: false };
  const fights: RunOutcome['fights'] = [];
  while (run.wins < WINS_TO_CLEAR && run.losses < LOSSES_TO_END) {
    // The opponent's seed reads wins + losses and its candidate count reads wins, so moving the wins
    // onto losses keeps the fight and drops the counter-pick.
    const read = args.flat ? { ...run, wins: 0, losses: run.wins + run.losses } : run;
    const opponent = gauntletOpponent(gauntletContent, read);
    const player = constructedSide(gauntletContent, { name: 'Gauntlet', slots: run.team }, pickLeads(run.team, opponent.team, opponent.leads));
    const ai = constructedSide(gauntletContent, { name: 'Opponent', slots: opponent.team }, opponent.leads);
    const fightSeed = (seed * 7 + fights.length + 1) >>> 0;
    const outcome = simulateFight({
      seed: fightSeed,
      playerRoster: player.run.roster,
      playerSquad: player.squad,
      playerRelicIds: [],
      aiRoster: ai.run.roster,
      aiSquad: ai.squad,
      rng: makeRng(fightSeed * 31 + 7),
      pilot: args.pilot,
      aiPilot: 'greedy',
    });
    fights.push({ won: outcome.won, rounds: outcome.rounds, stalemate: outcome.stalemate });
    run = { ...run, wins: run.wins + (outcome.won ? 1 : 0), losses: run.losses + (outcome.won ? 0 : 1) };
  }
  return { wins: run.wins, losses: run.losses, fights };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const owned = Object.values(heroes)
    .filter((h) => !h.unlock)
    .map((h) => h.id);

  const byWins = Array.from({ length: WINS_TO_CLEAR + 1 }, () => 0);
  const byFight = Array.from({ length: WINS_TO_CLEAR + LOSSES_TO_END - 1 }, () => ({ played: 0, won: 0 }));
  const byRecord = Array.from({ length: WINS_TO_CLEAR }, () => ({ played: 0, won: 0 }));
  let rounds = 0;
  let fights = 0;
  let stalemates = 0;
  const started = Date.now();

  for (let r = 0; r < args.runs; r++) {
    const outcome = playGauntlet(args.seed * 100003 + r + 1, args, owned);
    byWins[outcome.wins]++;
    let wins = 0;
    outcome.fights.forEach((f, i) => {
      byFight[i].played++;
      byRecord[wins].played++;
      if (f.won) {
        byFight[i].won++;
        byRecord[wins].won++;
        wins++;
      }
      rounds += f.rounds;
      fights++;
      if (f.stalemate) stalemates++;
    });
  }

  const pct = (n: number, d: number) => (d === 0 ? '  —' : `${Math.round((100 * n) / d)}%`.padStart(4));
  console.log(`Gauntlet — ${args.runs} runs, draft ${args.draft}, pilot ${args.pilot}, AI run/pilot.ts${args.flat ? ', no escalation' : ''}, owned = the base roster (${owned.length})`);
  console.log(`clear (${WINS_TO_CLEAR} wins): ${pct(byWins[WINS_TO_CLEAR], args.runs)}`);
  console.log('final wins:   ' + byWins.map((n, w) => `${w}: ${pct(n, args.runs)}`).join('   '));
  console.log('fight won, by wins going in (the escalation):   ' + byRecord.map((b, w) => `${w}W ${pct(b.won, b.played)} (${b.played})`).join('   '));
  console.log('fight won, by fight number:   ' + byFight.map((b, i) => `#${i + 1} ${pct(b.won, b.played)}`).join('   '));
  console.log(`fights a run ${(fights / args.runs).toFixed(2)}, mean rounds ${(rounds / fights).toFixed(1)}, stalemates ${stalemates}/${fights}, ${((Date.now() - started) / 1000).toFixed(0)}s`);
}

main();
