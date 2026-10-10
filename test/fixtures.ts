import type { CombatState, Combatant, Side } from '../src/engine/state';
import { createCombatant, getMaxHp, getMaxMana, applyStageDelta } from '../src/engine/state';
import { createRng } from '../src/engine/rng/seededRng';
import { heroes } from '../src/data/heroes';
import { allCombatants } from '../src/data/content';
import type { MoveDefinition, StatKey } from '../src/engine/content';

export interface FixtureCombatant {
  combatantId: string;
  heroId: string;
  side: Side;
}

/**
 * The HP a fixture combatant starts and caps at. Use this, never
 * `heroes[id].baseStats.hp` — max HP goes through getMaxHp, which is where grants and
 * modifiers land, so a test written against the raw stat line reads a hero nobody fields.
 */
export function fixtureMaxHp(heroId: string): number {
  const blank = createCombatant('probe', heroId, 'A', 0, 0);
  return getMaxHp(heroes[heroId], blank);
}

/**
 * Tops a combatant up to its OWN max, AFTER whatever statModifiers it carries. The move-slate
 * fixtures raise `statModifiers.hp` to buy a long fight; setting `currentHp` to a literal
 * alongside that silently starts them wounded, which trips every execute-threshold move.
 */
export function withFullPools(combatant: Combatant): Combatant {
  const hero = allCombatants[combatant.heroId];
  return { ...combatant, currentHp: getMaxHp(hero, combatant), currentMana: getMaxMana(hero, combatant) };
}

/** Builds a fight (first 2 per side active, rest benched) at full HP/mana — a test convenience, not an engine default. */
export function createFightState(seed: number, sideA: FixtureCombatant[], sideB: FixtureCombatant[]): CombatState {
  const combatants: CombatState['combatants'] = {};

  function place(list: FixtureCombatant[]) {
    for (const c of list) {
      const hero = heroes[c.heroId];
      // Through getMaxHp/getMaxMana, not the raw stat line, so the fixture starts at FULL —
      // the same way buildCombatState does.
      const blank = createCombatant(c.combatantId, c.heroId, c.side, 0, 0);
      combatants[c.combatantId] = { ...blank, currentHp: getMaxHp(hero, blank), currentMana: getMaxMana(hero, blank) };
    }
  }
  place(sideA);
  place(sideB);

  return {
    seed,
    rngState: createRng(seed),
    round: 1,
    active: {
      A: [sideA[0]?.combatantId ?? null, sideA[1]?.combatantId ?? null],
      B: [sideB[0]?.combatantId ?? null, sideB[1]?.combatantId ?? null],
    },
    bench: {
      A: sideA.slice(2).map((c) => c.combatantId),
      B: sideB.slice(2).map((c) => c.combatantId),
    },
    combatants,
    koCount: { A: 0, B: 0 },
    activeFieldEffect: null,
  };
}

/** The steps a move's delta lands on this target after the ±5 limit (docs/stat-stages.md) — no caster scaling, so neither caster nor move is read. */
export function landedDelta(state: CombatState, _casterId: string, _move: MoveDefinition, stat: StatKey, stages: number, targetId: string): number {
  return applyStageDelta(state.combatants[targetId], stat, stages).landed;
}

/** The steps a move authors on `stat` — its statDeltas row, or its randomStatDeltas reel. */
export function stagesOf(move: MoveDefinition, stat: StatKey): number {
  return move.statDeltas?.find((d) => d.stat === stat)?.stages ?? move.randomStatDeltas?.stages ?? 0;
}

/** A combatant's stage record, for the slate tests that read what a move raised or lowered. */
export function stagesRecordOf(state: CombatState, combatantId: string): Record<string, number> {
  return (state.combatants[combatantId].statStages ?? {}) as Record<string, number>;
}
