// A scripted, printable 2v2 fight — NOT a game, just a way to watch the real
// engine (src/engine) run a fight round by round without a view layer yet.
// Uses the same test-fixture content as the test suite (src/data): 4
// untuned heroes, 5 untuned moves, a placeholder type chart.
//
// Run with: npm run demo

import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { createCombatant, type CombatState, type Side } from '../src/engine/state';
import { createRng } from '../src/engine/rng/seededRng';
import { resolveRound } from '../src/engine/combat/resolveRound';
import { applyForcedReplacement } from '../src/engine/combat/switching';
import type { Action } from '../src/engine/combat/actions';
import type { CombatEvent } from '../src/engine/events';

const SEED = Number(process.argv[2] ?? 1);
const MAX_ROUNDS = 30;

const roster: { combatantId: string; heroId: string; side: Side }[] = [
  { combatantId: 'a1', heroId: 'cinderKnight', side: 'A' },
  { combatantId: 'a2', heroId: 'tidecaller', side: 'A' },
  { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
  { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
];

const displayName: Record<string, string> = {};
for (const r of roster) displayName[r.combatantId] = `${heroes[r.heroId].name} (${r.combatantId})`;
function name(id: string): string {
  return displayName[id] ?? id;
}

// Explicit starting-resource choice for this demo (full HP/mana) — NOT an
// engine default. Starting mana is still 🔒 OPEN per docs/mana.md.
const combatants: CombatState['combatants'] = {};
for (const r of roster) {
  const hero = heroes[r.heroId];
  combatants[r.combatantId] = createCombatant(r.combatantId, r.heroId, r.side, hero.baseStats.hp, hero.baseStats.manaPool);
}

let state: CombatState = {
  seed: SEED,
  rngState: createRng(SEED),
  round: 1,
  active: { A: ['a1', 'a2'], B: ['b1', 'b2'] },
  bench: { A: [], B: [] }, // this fixture roster is exactly 2v2, no bench — see note below
  combatants,
  koCount: { A: 0, B: 0 },
};

const config = { typeChart, heroes, moves, benchHpRegenFlat: 5 };

function firstActiveOn(s: CombatState, side: Side): string | null {
  return s.active[side].find((id) => id && !s.combatants[id].fainted) ?? null;
}

function pickAction(s: CombatState, combatantId: string): Action {
  const combatant = s.combatants[combatantId];
  const hero = heroes[combatant.heroId];
  // Always the hero's first listed move — a deliberately dumb policy, just to drive the demo.
  const moveId = hero.moveIds[0];
  const move = moves[moveId];
  const enemySide: Side = combatant.side === 'A' ? 'B' : 'A';
  const declaredTarget =
    move.target === 'singleEnemy' ? firstActiveOn(s, enemySide) : move.target === 'singleAlly' ? combatantId : null;
  return { kind: 'move', combatantId, moveId, declaredTarget };
}

function sideDefeated(s: CombatState, side: Side): boolean {
  return roster.filter((r) => r.side === side).every((r) => s.combatants[r.combatantId].fainted);
}

function formatEvent(e: CombatEvent): string | null {
  switch (e.type) {
    case 'RoundStarted':
      return `\n=== Round ${e.round} ===`;
    case 'MoveUsed':
      return `  ${name(e.combatantId)} uses ${moves[e.moveId].name} (-${e.manaSpent} mana)`;
    case 'DamageDealt': {
      const tag = e.isCrit ? ' CRIT' : '';
      const eff = e.typeMult >= 2 ? ' super effective!' : e.typeMult <= 0.5 ? ' not very effective...' : '';
      return `    -> ${e.amount} dmg to ${name(e.targetCombatantId)}${tag}${eff}`;
    }
    case 'Fainted':
      return `    ${name(e.combatantId)} fainted! (side ${e.side} KOs: ${e.koCount})`;
    case 'BenchRegenTicked':
      return `  ${name(e.combatantId)} regens ${e.hpRegen} HP on the bench (${e.newHp}/${e.maxHp})`;
    default:
      return null; // TurnStarted / MoveDeclared / HpChanged / ManaChanged / SwitchedIn / RoundEnded omitted for readability
  }
}

console.log(`Titanpact engine demo — seed ${SEED}\n`);
for (const r of roster) {
  const hero = heroes[r.heroId];
  console.log(`  ${name(r.combatantId)}  HP ${hero.baseStats.hp}  types [${hero.types.join('/')}]`);
}

let round = 0;
while (round < MAX_ROUNDS && !sideDefeated(state, 'A') && !sideDefeated(state, 'B')) {
  round++;
  const actions: Action[] = state.active.A.concat(state.active.B)
    .filter((id): id is string => id !== null && !state.combatants[id].fainted)
    .map((id) => pickAction(state, id));

  const result = resolveRound(state, actions, config);
  state = result.state;
  for (const e of result.events) {
    const line = formatEvent(e);
    if (line) console.log(line);
  }

  // Forced replacement of any fainted active slot (no bench in this 2v2 fixture, so slots just stay empty).
  for (const side of ['A', 'B'] as const) {
    state.active[side].forEach((id, slot) => {
      if (id === null && state.bench[side].length > 0) {
        const inId = state.bench[side][0];
        const res = applyForcedReplacement(state, state.round, side, slot as 0 | 1, inId);
        state = res.state;
      }
    });
  }
}

console.log(`\n=== Fight over after ${round} round(s) ===`);
if (sideDefeated(state, 'A')) console.log('Side B wins.');
else if (sideDefeated(state, 'B')) console.log('Side A wins.');
else console.log('No winner within the round cap (mana exhaustion stalemate) — try a different seed.');
