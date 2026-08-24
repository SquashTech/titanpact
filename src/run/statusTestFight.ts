// ⚠️ TEMPORARY DEV/TEST FIXTURE — not a game entry point, and nothing in a
// real run imports it. Builds a fight whose only purpose is exercising the
// status-effect presentation layer: badges, popups, tick flashes, the
// shoulder cluster's collision behavior when several statuses stack, and how
// all of that survives a Field Effect tint behind it.
//
// The problem it solves: reaching a rich status state in normal play means
// drafting the right heroes, leveling them to unlock the right moves, and
// then winning long enough for statuses to stack — minutes of setup for a
// few seconds of the UI you actually wanted to look at, and half the time a
// combatant dies before the stack gets interesting.
//
// So: every combatant has 9999 HP (nothing ever faints, so the fight runs
// until you leave it), a 999 mana pool with huge regen (no Rest turns
// interrupting the test), and a movepool made of nothing but status moves.
//
// Deliberately DERIVED from src/data/moves.ts rather than listing move ids
// by hand (CLAUDE.md "all acquirable content is pure data"): author a new
// status move and it shows up here automatically, with no second list to
// remember to update. That's also why the split below keys off
// `move.target` instead of a hardcoded roster of which move goes where.
//
// To remove: delete this file, App.tsx's handleStatusTestFight + its
// 'statusTestFight' screen kind, and TitleScreen's button and prop.

import type { MoveDefinition } from '../engine/content';
import { moves } from '../data/moves';
import { heroes } from '../data/heroes';
import { createEmptyLoadout } from './equipment';
import type { SandboxHeroConfig, SandboxSideConfig } from './sandbox';

/** Nothing faints, so the fight never ends on its own and a status stack can be watched for as long as you like. */
export const STATUS_TEST_HP = 9999;
/** Big enough that no combatant is ever forced to Rest mid-test (docs/mana.md — Rest is mandatory at zero affordable moves, which would eat turns here). */
export const STATUS_TEST_MANA_POOL = 999;
export const STATUS_TEST_MP_REGEN = 99;

/** Enemy-facing target modes — the split that decides whether a status move afflicts someone else or buffs its own side. */
const ENEMY_TARGET_MODES: ReadonlySet<MoveDefinition['target']> = new Set(['singleEnemy', 'bothEnemies', 'allOthers']);

function byName(a: MoveDefinition, b: MoveDefinition): number {
  return a.name.localeCompare(b.name);
}

/**
 * Every status-applying move in the game, split by who it lands on.
 *
 * `afflict` is the debuff bench (Burn, Bleed, Poison, Freeze, Daze, Conduct,
 * Haunt, …); `support` is the self/ally side (Regen, Stealth, Elemental
 * Force) plus every cleansing move, so removal has something to remove.
 * Cleansers have no `statusApplication` of their own — they're the other half
 * of the status lifecycle and belong in the same fixture.
 */
export function statusTestMovePools(): { afflict: string[]; support: string[] } {
  const all = Object.values(moves);
  const afflict = all.filter((m) => m.statusApplication && ENEMY_TARGET_MODES.has(m.target));
  const support = all.filter((m) => (m.statusApplication && !ENEMY_TARGET_MODES.has(m.target)) || m.cleanses);
  return {
    afflict: afflict.sort(byName).map((m) => m.id),
    support: support.sort(byName).map((m) => m.id),
  };
}

/**
 * Exact grants to land on STATUS_TEST_HP / STATUS_TEST_MANA_POOL rather than
 * "base plus a big number", so every combatant reads the same round figure on
 * screen regardless of which hero it is — which is the point when the thing
 * under test is how a number sits inside its bar track.
 *
 * These deliberately ignore the flat-grant invariant (CLAUDE.md: multiples of
 * 5 or 10). That rule governs authored content; this is a throwaway fixture
 * whose grants never touch a real run, and `buildSandboxSide` passes
 * bonusStatGrants straight through to entryStats without validation.
 */
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

/**
 * One side: an afflicter and a supporter active, the same pair benched behind
 * them.
 *
 * The two pools are split across two heroes rather than piled onto one
 * because FightScreen steps through both active heroes every round — so a
 * single round can land an affliction on the enemy AND a positive status on
 * your own side, which is the state worth looking at.
 *
 * The afflict pool is 7 moves today, which is one row more than the console
 * fits: its move grid scrolls by roughly 40px. That's deliberate — reaching
 * every affliction from one hero, without a switch, matters more here than
 * avoiding a scroll, and a 4-row grid is a layout worth having under test
 * anyway. If the pool grows enough that this stops being tolerable, deal the
 * overflow onto the matching bench hero rather than splitting the pools
 * across the two active ones.
 *
 * The bench carries the same two pools so switching (and the status-clears-on-
 * switch path, docs/conditions.md) is testable without leaving the fixture.
 */
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

// Four distinct primary types per side, so the type-tinted platforms, name
// pills and move-button washes are all visibly different from each other —
// the fixture is for looking at the UI, so it may as well exercise the color
// system while it's up. Which heroes these are otherwise doesn't matter:
// every movepool is overridden above.
const PLAYER_HERO_IDS = ['cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle'] as const;
const AI_HERO_IDS = ['crimson', 'stormRanger', 'shadowMonk', 'rime'] as const;

export function createStatusTestSides(): { a: SandboxSideConfig; b: SandboxSideConfig } {
  return { a: testSide(PLAYER_HERO_IDS), b: testSide(AI_HERO_IDS) };
}
