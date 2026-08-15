import type { CombatState, Side } from '../src/engine/state';
import { createCombatant } from '../src/engine/state';
import { createRng } from '../src/engine/rng/seededRng';
import { heroes } from '../src/data/heroes';

export interface FixtureCombatant {
  combatantId: string;
  heroId: string;
  side: Side;
}

/** Builds a 2v2 fight (2 active + 2 bench per side) from full-HP/full-mana fixture combatants. Test-only: starting resource fullness is a choice this helper makes for convenience, not an engine default (see createCombatant). */
export function createFightState(seed: number, sideA: FixtureCombatant[], sideB: FixtureCombatant[]): CombatState {
  const combatants: CombatState['combatants'] = {};

  function place(list: FixtureCombatant[]) {
    for (const c of list) {
      const hero = heroes[c.heroId];
      combatants[c.combatantId] = createCombatant(c.combatantId, c.heroId, c.side, hero.baseStats.hp, hero.baseStats.manaPool);
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
  };
}
