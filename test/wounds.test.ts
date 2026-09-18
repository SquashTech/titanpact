// Wounds (src/run/wounds.ts, docs/run-loop.md "Wounds"): HP carries across an act's nodes, a
// knockout persists until a Rest, the mend, a Revive or the act's end, and the act's end is the
// one free mend.

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { getMaxHp } from '../src/engine/state';
import { buildCombatState } from '../src/run/buildCombatState';
import { REWARD_WEIGHTS, MAP_NODE_TYPES } from '../src/run/map';
import { advanceToNextAct } from '../src/run/runProgress';
import { pickSquad, SquadSelectionError } from '../src/run/squad';
import { addRosterEntry, createRosterEntry, createRunState, type RunState } from '../src/run/state';
import {
  MEND_PRICE_FLOOR,
  MEND_PRICE_PER_HERO,
  mendPrice,
  rosterMissing,
  REVIVE_FRACTION,
  WoundsError,
  anyDown,
  anyWounded,
  buyMend,
  canBuyMend,
  mendRoster,
  recordWounds,
  reviveHero,
  standingHp,
  standingRoster,
  woundedHp,
  woundsFrom,
} from '../src/run/wounds';
import {
  CONSUMABLE_KINDS,
  ConsumableError,
  REVIVE_DROP_CHANCE,
  STARTING_CONSUMABLES,
  canUseRevive,
  grantConsumable,
  rollConsumableDrop,
  spendRevive,
} from '../src/run/consumables';

function seedRoster(ids: string[], gold = 0): RunState {
  let run = createRunState(gold);
  for (const id of ids) run = addRosterEntry(run, createRosterEntry(id, id, heroes[id].moveIds));
  return run;
}

function fightState(run: RunState, fielded: string[]) {
  const ai = seedRoster(['ironWarden']);
  return buildCombatState(1, heroes, equipment, [
    // Every fight fields the whole standing roster; the size is passed so the fixture can leave a hero out.
    { side: 'A', squad: pickSquad(run.roster, fielded, fielded.length), roster: run.roster },
    { side: 'B', squad: pickSquad(ai.roster, ['ironWarden']), roster: ai.roster },
  ]);
}

function withDown(run: RunState, rosterId: string): RunState {
  return { ...run, roster: run.roster.map((e) => (e.rosterId === rosterId ? { ...e, wounds: 999, down: true } : e)) };
}

test('wounds: a hero stands at max less its wounds, and at nothing while down', () => {
  assert.strictEqual(woundedHp(200, 0), 200);
  assert.strictEqual(woundedHp(200, 60), 140);
  assert.strictEqual(woundedHp(200, 400), 0);
  const entry = createRosterEntry('x', 'cinderKnight', []);
  assert.strictEqual(standingHp(200, { ...entry, wounds: 60 }), 140);
  assert.strictEqual(standingHp(200, { ...entry, wounds: 0, down: true }), 0, 'down reads 0 whatever the wound count says');
});

test('wounds: what a fight leaves is the HP missing, clamped to the max', () => {
  assert.strictEqual(woundsFrom(200, 0), 200);
  assert.strictEqual(woundsFrom(200, 10), 190);
  assert.strictEqual(woundsFrom(200, 120), 80);
  assert.strictEqual(woundsFrom(200, 260), 0, 'over max (a fight buff) reads as whole');
});

test('wounds: a fresh entry is whole and standing, and a whole roster places at full HP', () => {
  const run = seedRoster(['cinderKnight', 'tidecaller']);
  assert.strictEqual(run.roster[0].wounds, 0);
  assert.strictEqual(run.roster[0].down, false);
  assert.ok(!anyWounded(run));
  const state = fightState(run, ['cinderKnight', 'tidecaller']);
  const c = state.combatants['A:cinderKnight'];
  assert.strictEqual(c.currentHp, getMaxHp(heroes.cinderKnight, c));
});

test('wounds: recordWounds reads the fielded side back — a KO is down, un-fielded heroes untouched, the fight\'s own buffs not carried', () => {
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
  assert.strictEqual(cinder.down, false);
  assert.strictEqual(tide.down, true, 'a KO persists');
  assert.strictEqual(warden.wounds, 0, 'not fielded, not touched');
  assert.strictEqual(run.roster[0].wounds, 0, 'pure');

  // The next fight places Cinder where the wound left it and does not field Tidecaller at all.
  assert.deepStrictEqual(standingRoster(next.roster).map((e) => e.rosterId), ['cinderKnight', 'ironWarden']);
  assert.throws(() => pickSquad(next.roster, ['cinderKnight', 'tidecaller', 'ironWarden']), SquadSelectionError);
  const squad = pickSquad(next.roster, ['cinderKnight', 'ironWarden']);
  assert.deepStrictEqual(squad.activeIds, ['cinderKnight', 'ironWarden']);
  const again = fightState(next, ['cinderKnight', 'ironWarden']);
  assert.strictEqual(again.combatants['A:cinderKnight'].currentHp, Math.floor(max / 2));
  assert.strictEqual(again.combatants['A:tidecaller'], undefined);
});

test('wounds: one hero left standing fields alone, into an empty second slot', () => {
  const run = withDown(withDown(seedRoster(['cinderKnight', 'tidecaller', 'ironWarden']), 'tidecaller'), 'ironWarden');
  const squad = pickSquad(run.roster, ['cinderKnight']);
  assert.deepStrictEqual(squad.activeIds, ['cinderKnight', null]);
  assert.deepStrictEqual(squad.benchIds, []);
});

test('wounds: a max that rises mid-act carries the current up with it, and never stands a downed hero up', () => {
  const run = seedRoster(['cinderKnight']);
  const grown = { ...run, roster: [{ ...run.roster[0], wounds: 50, growthStatGrants: { hp: 30 } }] };
  const state = fightState(grown, ['cinderKnight']);
  const c = state.combatants['A:cinderKnight'];
  assert.strictEqual(c.currentHp, getMaxHp(heroes.cinderKnight, c) - 50);

  const downAndGrown = { ...run, roster: [{ ...run.roster[0], wounds: 10, down: true, growthStatGrants: { hp: 300 } }] };
  assert.ok(anyDown(downAndGrown));
  assert.strictEqual(standingRoster(downAndGrown.roster).length, 0, 'down is a flag, not a wound count');
});

test('wounds: the act boundary is the free mend and stands the downed up; the Rest and the shelf are the paid ones', () => {
  const run = seedRoster(['cinderKnight', 'tidecaller'], 100);
  const hurt = withDown({ ...run, roster: run.roster.map((e) => ({ ...e, wounds: 40 })) }, 'tidecaller');
  assert.ok(anyWounded(hurt));
  assert.ok(anyDown(hurt));
  assert.ok(advanceToNextAct(hurt, 7).roster.every((e) => e.wounds === 0 && !e.down));
  assert.ok(mendRoster(hurt).roster.every((e) => e.wounds === 0 && !e.down));

  // Priced by what is missing: Cinder 40 of 200, Tide down (a whole hero) = 1.2 heroes' worth.
  const maxHpOf = () => 200;
  assert.strictEqual(rosterMissing(hurt, maxHpOf), 1.2);
  const cost = mendPrice(hurt, maxHpOf);
  assert.strictEqual(cost, Math.round((MEND_PRICE_PER_HERO * 1.2) / 5) * 5);
  assert.ok(canBuyMend(hurt, cost));
  const mended = buyMend(hurt, cost);
  assert.strictEqual(mended.gold, 100 - cost);
  assert.ok(!anyWounded(mended));
  assert.ok(!anyDown(mended));
  assert.ok(!canBuyMend(mended, cost), 'nothing to mend is not for sale');
  assert.throws(() => buyMend(mended, cost), WoundsError);
  assert.ok(!canBuyMend({ ...hurt, gold: cost - 1 }, cost));
  assert.throws(() => buyMend({ ...hurt, gold: cost - 1 }, cost), WoundsError);

  // A roster that is only down, not otherwise hurt, is still for sale, at a whole hero's price.
  const onlyDown = withDown(run, 'tidecaller');
  assert.strictEqual(mendPrice(onlyDown, maxHpOf), MEND_PRICE_PER_HERO);
  assert.ok(canBuyMend(onlyDown, MEND_PRICE_PER_HERO));
  // A scratch costs the floor, never nothing; six heroes at half cost about what the old flat 40 did.
  const scratch = { ...run, roster: run.roster.map((e, i) => (i === 0 ? { ...e, wounds: 10 } : e)) };
  assert.strictEqual(mendPrice(scratch, maxHpOf), MEND_PRICE_FLOOR);
  const six = seedRoster(['cinderKnight', 'tidecaller', 'ironWarden', 'valor', 'crag', 'tempest'], 100);
  const halved = { ...six, roster: six.roster.map((e) => ({ ...e, wounds: 100 })) };
  assert.strictEqual(mendPrice(halved, maxHpOf), MEND_PRICE_PER_HERO * 3);
});

test('wounds: a Revive stands ONE downed hero up at half, off the purse, and only a downed one', () => {
  const run = grantConsumable(withDown(seedRoster(['cinderKnight', 'tidecaller']), 'tidecaller'), 'revive');
  assert.ok(canUseRevive(run));
  const revived = spendRevive(reviveHero(run, 'tidecaller', 200));
  const tide = revived.roster[1];
  assert.strictEqual(tide.down, false);
  assert.strictEqual(standingHp(200, tide), Math.round(200 * REVIVE_FRACTION));
  assert.strictEqual(revived.consumables.revive, 0);
  assert.ok(!canUseRevive(revived));
  assert.throws(() => spendRevive(revived), ConsumableError);
  assert.throws(() => reviveHero(run, 'cinderKnight', 200), WoundsError, 'standing heroes are not revived');
  assert.throws(() => reviveHero(run, 'nobody', 200), WoundsError);
});

test('wounds: the Revive is a purse kind that starts at none and drops rarer than a potion, never at the finale', () => {
  assert.ok(CONSUMABLE_KINDS.includes('revive'));
  assert.strictEqual(STARTING_CONSUMABLES.revive, 0);
  assert.ok(REVIVE_DROP_CHANCE.elite > REVIVE_DROP_CHANCE.skirmish);
  assert.strictEqual(REVIVE_DROP_CHANCE.finale, 0);
  // The potion roll misses (0.99), the Revive's own roll hits (0.0).
  const draws = [0.99, 0.0];
  assert.strictEqual(rollConsumableDrop('elite', () => draws.shift()!), 'revive');
  const miss = [0.99, 0.99];
  assert.strictEqual(rollConsumableDrop('elite', () => miss.shift()!), null);
});

test('wounds: the Rest sits in the reward pool as a node type', () => {
  assert.ok(MAP_NODE_TYPES.includes('restReward'));
  const seat = REWARD_WEIGHTS.find(([type]) => type === 'restReward');
  assert.ok(seat && seat[1] > 0);
});
