// Wounds (src/run/wounds.ts, docs/run-loop.md "Wounds"): HP carries across an act's nodes, the
// walk floor keeps a wound from being a brick, and the act's end is the one free mend.

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { getMaxHp } from '../src/engine/state';
import { buildCombatState } from '../src/run/buildCombatState';
import { REWARD_WEIGHTS, MAP_NODE_TYPES } from '../src/run/map';
import { advanceToNextAct } from '../src/run/runProgress';
import { pickSquad } from '../src/run/squad';
import { addRosterEntry, createRosterEntry, createRunState, type RunState } from '../src/run/state';
import {
  MEND_PRICE,
  WALK_FLOOR,
  WoundsError,
  anyWounded,
  buyMend,
  canBuyMend,
  mendRoster,
  recordWounds,
  woundedHp,
  woundsFrom,
} from '../src/run/wounds';

function seedRoster(ids: string[], gold = 0): RunState {
  let run = createRunState(gold);
  for (const id of ids) run = addRosterEntry(run, createRosterEntry(id, id, heroes[id].moveIds));
  return run;
}

function fightState(run: RunState, fielded: string[]) {
  const ai = seedRoster(['ironWarden']);
  return buildCombatState(1, heroes, equipment, [
    // Bring-6-pick-4 fields the whole roster below four; the size is passed so a bench can be left out.
    { side: 'A', squad: pickSquad(run.roster, fielded, fielded.length), roster: run.roster },
    { side: 'B', squad: pickSquad(ai.roster, ['ironWarden']), roster: ai.roster },
  ]);
}

test('wounds: a hero stands at max less its wounds, never under the walk floor', () => {
  assert.strictEqual(woundedHp(200, 0), 200);
  assert.strictEqual(woundedHp(200, 60), 140);
  assert.strictEqual(woundedHp(200, 150), Math.ceil(200 * WALK_FLOOR));
  assert.strictEqual(woundedHp(200, 400), Math.ceil(200 * WALK_FLOOR), 'a KO floors, it does not brick');
});

test('wounds: what a fight leaves is already floored, so surviving low is never worse than dying', () => {
  const floor = Math.ceil(200 * WALK_FLOOR);
  assert.strictEqual(woundsFrom(200, 0), 200 - floor);
  assert.strictEqual(woundsFrom(200, 10), 200 - floor, 'a hero alive under the floor walks out at the floor');
  assert.strictEqual(woundsFrom(200, 120), 80);
  assert.strictEqual(woundsFrom(200, 260), 0, 'over max (a fight buff) reads as whole');
});

test('wounds: a fresh entry is whole, and a whole roster places at full HP', () => {
  const run = seedRoster(['cinderKnight', 'tidecaller']);
  assert.strictEqual(run.roster[0].wounds, 0);
  assert.ok(!anyWounded(run));
  const state = fightState(run, ['cinderKnight', 'tidecaller']);
  const c = state.combatants['A:cinderKnight'];
  assert.strictEqual(c.currentHp, getMaxHp(heroes.cinderKnight, c));
});

test('wounds: recordWounds reads the fielded side back, un-fielded heroes untouched, the fight\'s own buffs not carried', () => {
  const run = seedRoster(['cinderKnight', 'tidecaller', 'ironWarden']);
  const state = fightState(run, ['cinderKnight', 'tidecaller']);
  const max = getMaxHp(heroes.cinderKnight, state.combatants['A:cinderKnight']);
  const hurt = {
    ...state,
    combatants: {
      ...state.combatants,
      // Cinder at half, with a +40 HP fight buff that must NOT count against it.
      'A:cinderKnight': { ...state.combatants['A:cinderKnight'], currentHp: Math.floor(max / 2), statModifiers: { hp: 40 } },
      // Tidecaller KO'd.
      'A:tidecaller': { ...state.combatants['A:tidecaller'], currentHp: 0, fainted: true },
    },
  };
  const next = recordWounds(run, hurt, 'A', heroes);
  const [cinder, tide, warden] = next.roster;
  assert.strictEqual(cinder.wounds, max - Math.floor(max / 2));
  const tideMax = getMaxHp(heroes.tidecaller, state.combatants['A:tidecaller']);
  assert.strictEqual(tide.wounds, tideMax - Math.ceil(tideMax * WALK_FLOOR), 'a KO leaves the hero at the floor');
  assert.strictEqual(warden.wounds, 0, 'not fielded, not touched');
  assert.strictEqual(run.roster[0].wounds, 0, 'pure');

  // The next fight places them where the wounds left them.
  const again = fightState(next, ['cinderKnight', 'tidecaller']);
  assert.strictEqual(again.combatants['A:cinderKnight'].currentHp, Math.floor(max / 2));
  assert.strictEqual(again.combatants['A:tidecaller'].currentHp, Math.ceil(tideMax * WALK_FLOOR));
});

test('wounds: a max that rises mid-act carries the current up with it', () => {
  const run = seedRoster(['cinderKnight']);
  const grown = { ...run, roster: [{ ...run.roster[0], wounds: 50, growthStatGrants: { hp: 30 } }] };
  const state = fightState(grown, ['cinderKnight']);
  const c = state.combatants['A:cinderKnight'];
  assert.strictEqual(c.currentHp, getMaxHp(heroes.cinderKnight, c) - 50);
});

test('wounds: the act boundary is the free mend; the Rest and the shelf are the paid ones', () => {
  const run = seedRoster(['cinderKnight', 'tidecaller'], 100);
  const hurt = { ...run, roster: run.roster.map((e) => ({ ...e, wounds: 40 })) };
  assert.ok(anyWounded(hurt));
  assert.ok(advanceToNextAct(hurt, 7).roster.every((e) => e.wounds === 0));
  assert.ok(mendRoster(hurt).roster.every((e) => e.wounds === 0));

  assert.ok(canBuyMend(hurt));
  const mended = buyMend(hurt);
  assert.strictEqual(mended.gold, 100 - MEND_PRICE);
  assert.ok(!anyWounded(mended));
  assert.ok(!canBuyMend(mended), 'nothing to mend is not for sale');
  assert.throws(() => buyMend(mended), WoundsError);
  assert.ok(!canBuyMend({ ...hurt, gold: MEND_PRICE - 1 }));
  assert.throws(() => buyMend({ ...hurt, gold: MEND_PRICE - 1 }), WoundsError);
});

test('wounds: the Rest sits in the reward pool as a node type', () => {
  assert.ok(MAP_NODE_TYPES.includes('restReward'));
  const seat = REWARD_WEIGHTS.find(([type]) => type === 'restReward');
  assert.ok(seat && seat[1] > 0);
});
