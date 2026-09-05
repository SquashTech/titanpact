import type { CombatState, Combatant, Side } from '../src/engine/state';
import { createCombatant, getMaxHp, getMaxMana } from '../src/engine/state';
import { createRng } from '../src/engine/rng/seededRng';
import { heroes } from '../src/data/heroes';
import { allCombatants } from '../src/data/content';

export interface FixtureCombatant {
  combatantId: string;
  heroId: string;
  side: Side;
}

/**
 * The HP a fixture combatant starts and caps at. Use this, never
 * `heroes[id].baseStats.hp` — max HP goes through getMaxHp, which applies HP_SCALE, so a
 * test written against the raw stat line breaks the moment that knob moves.
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
      // the same way buildCombatState does. HP_SCALE lives inside getMaxHp.
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
