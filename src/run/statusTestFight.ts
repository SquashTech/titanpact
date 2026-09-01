// TEMPORARY DEV FIXTURE — a fight for exercising status presentation (badges,
// popups, tick flashes, shoulder-cluster collisions). Nothing faints, nobody
// Rests, and every movepool is status moves only, derived from data/moves.ts.
// To remove: this file, App.tsx handleStatusTestFight + the 'statusTestFight'
// screen kind, and TitleScreen's button and prop.

import { firstStatusApplication } from '../engine/content';
import type { MoveDefinition } from '../engine/content';
import { moves } from '../data/moves';
import { heroes } from '../data/heroes';
import { createEmptyLoadout } from './equipment';
import type { SandboxHeroConfig, SandboxSideConfig } from './sandbox';

export const STATUS_TEST_HP = 9999;
export const STATUS_TEST_MANA_POOL = 999;
export const STATUS_TEST_MP_REGEN = 99;

const ENEMY_TARGET_MODES: ReadonlySet<MoveDefinition['target']> = new Set(['singleEnemy', 'bothEnemies', 'allOthers']);

function byName(a: MoveDefinition, b: MoveDefinition): number {
  return a.name.localeCompare(b.name);
}

/** `afflict` = enemy-targeted status moves; `support` = self/ally status moves plus every cleanser. */
export function statusTestMovePools(): { afflict: string[]; support: string[] } {
  const all = Object.values(moves);
  const afflict = all.filter((m) => firstStatusApplication(m) && ENEMY_TARGET_MODES.has(m.target));
  const support = all.filter((m) => (firstStatusApplication(m) && !ENEMY_TARGET_MODES.has(m.target)) || m.cleanses);
  return {
    afflict: afflict.sort(byName).map((m) => m.id),
    support: support.sort(byName).map((m) => m.id),
  };
}

// Exact grants so every combatant reads the same round figure. These ignore
// the multiples-of-5 invariant on purpose: fixture, never a real run.
function testHero(heroId: string, moveIds: string[]): SandboxHeroConfig {
  const base = heroes[heroId].baseStats;
  return {
    rosterId: heroId,
    heroId,
    level: 1,
    moveIds,
    pathId: null,
    equipment: createEmptyLoadout(),
    bonusStatGrants: {
      hp: STATUS_TEST_HP - base.hp,
      manaPool: STATUS_TEST_MANA_POOL - base.manaPool,
      mpRegen: STATUS_TEST_MP_REGEN - base.mpRegen,
    },
  };
}

/** An afflicter and a supporter active, the same pair benched so switching is testable. */
function testSide(heroIds: readonly [string, string, string, string]): SandboxSideConfig {
  const { afflict, support } = statusTestMovePools();
  return {
    heroes: [
      testHero(heroIds[0], afflict),
      testHero(heroIds[1], support),
      testHero(heroIds[2], afflict),
      testHero(heroIds[3], support),
    ],
    activeIds: [heroIds[0], heroIds[1]],
    relicIds: [],
  };
}

// Four distinct primary types per side so the type-tinted UI is visibly varied.
const PLAYER_HERO_IDS = ['cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle'] as const;
const AI_HERO_IDS = ['crimson', 'stormRanger', 'shadowMonk', 'rime'] as const;

export function createStatusTestSides(): { a: SandboxSideConfig; b: SandboxSideConfig } {
  return { a: testSide(PLAYER_HERO_IDS), b: testSide(AI_HERO_IDS) };
}
