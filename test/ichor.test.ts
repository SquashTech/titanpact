// Ichor: XP aimed at one hero (src/run/ichor.ts, docs/xp-overhaul.md §3).

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { ICHOR_PURCHASE_COST, ICHOR_PURCHASE_LIMIT } from '../src/data/recruitment';
import {
  ICHOR_FIGHTS,
  ICHOR_NODE_KIND,
  IchorError,
  anyIchorEligible,
  buyIchor,
  canBuyIchor,
  canDrinkIchor,
  ichorLevelAfter,
  ichorXp,
  ichorXpForAct,
  grantIchor,
} from '../src/run/ichor';
import { ENCOUNTERS_PER_ACT, MAX_XP, encounterXpForAct, levelAfterEncounters, levelOf, xpAfterEncounters, xpForLevel } from '../src/run/growth';
import { REWARD_WEIGHTS } from '../src/run/map';
import { addRosterEntry, createRosterEntry, createRunState, type RunState } from '../src/run/state';

const ALWAYS = () => 0.999999;

/** A run `encountersWon` in, every hero holding par's XP (part-way into its level, as par is). */
function runAtPar(encountersWon: number, heroIds: readonly string[] = ['cinderKnight']): RunState {
  const actNumber = Math.min(6, Math.floor(Math.max(0, encountersWon - 1) / ENCOUNTERS_PER_ACT) + 1);
  let run: RunState = { ...createRunState(100), encountersWon, actNumber };
  for (const id of heroIds) {
    run = addRosterEntry(run, { ...createRosterEntry(id, id, heroes[id].moveIds), xp: xpAfterEncounters(encountersWon) });
  }
  return run;
}

test('Ichor: an Ichor is worth a fixed number of the act\'s FIGHTS, so it grows with the act and reads in the XP the fights pay', () => {
  // 2026-09-14: priced in fights, not levels-at-par — the same currency the fight result and the
  // level-up report show. Sized to what two levels at par cost at each act's end, ≈2.5 fights in
  // every act (≈3 until 2026-09-14, when the act went to three fights and the base fight grew to
  // pay for it); flat within the act, so an act's opener pays up to a level more than the old figure did.
  assert.deepStrictEqual(ICHOR_FIGHTS, { ichor: 2.5, drop: 1.25 });
  for (let act = 1; act <= 6; act++) {
    assert.strictEqual(ichorXpForAct(act, 'ichor'), Math.round(2.5 * encounterXpForAct(act)), `Ichor in act ${act}`);
    assert.strictEqual(ichorXpForAct(act, 'drop'), Math.round(1.25 * encounterXpForAct(act)), `Drop in act ${act}`);
    assert.strictEqual(ichorXp({ actNumber: act }, 'ichor'), ichorXpForAct(act, 'ichor'));
  }
  assert.deepStrictEqual([1, 2, 3, 4, 5].map((act) => ichorXpForAct(act, 'ichor')), [375, 1400, 2650, 4375, 5000]);
  // Act 5's Ichor is the same fights Act 1's was, at Act 5's price.
  assert.ok(ichorXpForAct(5, 'ichor') > 4 * ichorXpForAct(1, 'ichor'));
  // And it buys roughly what the old denomination did: two or three levels for a hero at par, in every act.
  for (const encountersWon of [1, 4, 7, 10, 13]) {
    const run = runAtPar(encountersWon);
    const gained = ichorLevelAfter(run, run.roster[0], 'ichor') - levelOf(run.roster[0]);
    assert.ok(gained >= 1 && gained <= 3, `after ${encountersWon} wins an Ichor at par lands ${gained} levels`);
  }
});

test('Ichor: the same drink lands more levels on a hero behind par than on one ahead of it', () => {
  // The convex curve is the mechanism (docs/xp-overhaul.md §2): one grant, three outcomes.
  const run = runAtPar(7, ['cinderKnight', 'crimson', 'rime']);
  const par = levelOf(run.roster[0]);
  assert.strictEqual(par, levelAfterEncounters(7));
  const behind = { ...run.roster[1], xp: xpForLevel(par - 5) };
  const ahead = { ...run.roster[2], xp: xpForLevel(par + 3) };
  const fixture = { ...run, roster: [run.roster[0], behind, ahead] };

  const atPar = ichorLevelAfter(fixture, run.roster[0], 'ichor') - par;
  const behindBy = ichorLevelAfter(fixture, behind, 'ichor') - (par - 5);
  const aheadBy = ichorLevelAfter(fixture, ahead, 'ichor') - (par + 3);
  assert.ok(behindBy > atPar, `behind par: ${behindBy} levels against ${atPar} at par`);
  assert.ok(aheadBy < atPar, `ahead of par: ${aheadBy} levels against ${atPar} at par`);

  const fed = grantIchor(fixture, heroes, 'cinderKnight', 'ichor', ALWAYS);
  assert.strictEqual(fed.report.fromLevel, par);
  assert.strictEqual(fed.report.toLevel, par + atPar);
  assert.strictEqual(fed.report.toXp - fed.report.fromXp, ichorXp(fixture, 'ichor'), 'the report carries the bar\'s two ends');
  assert.strictEqual(levelOf(fed.run.roster[0]), par + atPar);
  assert.ok((fed.report.gained.hp ?? 0) > 0, 'the levels crossed rolled growth');
  assert.strictEqual(fed.run.roster[1], behind, 'nobody else moved');
  assert.strictEqual(fed.run.roster[2], ahead);
});

test('Ichor: a hero at the cap is refused rather than wasted', () => {
  const run = runAtPar(4, ['cinderKnight', 'crimson']);
  const capped = { ...run, roster: [{ ...run.roster[0], xp: MAX_XP }, run.roster[1]] };
  assert.strictEqual(canDrinkIchor(capped.roster[0]), false);
  assert.strictEqual(canDrinkIchor(capped.roster[1]), true);
  assert.ok(anyIchorEligible(capped.roster));
  assert.throws(() => grantIchor(capped, heroes, 'cinderKnight', 'drop'), IchorError);
  assert.throws(() => grantIchor(capped, heroes, 'nobody', 'drop'), IchorError);
  const allCapped = { ...capped, roster: capped.roster.map((r) => ({ ...r, xp: MAX_XP })) };
  assert.strictEqual(anyIchorEligible(allCapped.roster), false);
  assert.strictEqual(canBuyIchor(allCapped, 0, 0, ICHOR_PURCHASE_LIMIT), false, 'the shelf will not sell to a roster that cannot eat');
});

test('Ichor: the shelf charges flat gold, sells no more than the limit a visit, and the pick is where it lands', () => {
  let run = { ...runAtPar(4), gold: ICHOR_PURCHASE_COST * (ICHOR_PURCHASE_LIMIT + 1) };
  for (let bought = 0; bought < ICHOR_PURCHASE_LIMIT; bought++) {
    assert.ok(canBuyIchor(run, ICHOR_PURCHASE_COST, bought, ICHOR_PURCHASE_LIMIT));
    const before = levelOf(run.roster[0]);
    run = buyIchor(run, ICHOR_PURCHASE_COST, bought, ICHOR_PURCHASE_LIMIT);
    assert.strictEqual(levelOf(run.roster[0]), before, 'buying charges; it does not feed');
    run = grantIchor(run, heroes, 'cinderKnight', 'drop', ALWAYS).run;
  }
  assert.strictEqual(run.gold, ICHOR_PURCHASE_COST);
  // Two Drops are an Ichor's XP onto one hero — banked exactly, whatever levels that crosses.
  assert.strictEqual(run.roster[0].xp, xpAfterEncounters(4) + 2 * ichorXp(run, 'drop'));
  assert.ok(levelOf(run.roster[0]) > levelAfterEncounters(4), 'and it is ahead of par for it');
  // Gold left, shelf empty: the limit is what refuses, not the purse.
  assert.strictEqual(canBuyIchor(run, ICHOR_PURCHASE_COST, ICHOR_PURCHASE_LIMIT, ICHOR_PURCHASE_LIMIT), false);
  assert.throws(() => buyIchor(run, ICHOR_PURCHASE_COST, ICHOR_PURCHASE_LIMIT, ICHOR_PURCHASE_LIMIT), IchorError);
  assert.throws(() => buyIchor({ ...run, gold: 1 }, ICHOR_PURCHASE_COST, 0, ICHOR_PURCHASE_LIMIT), IchorError);
});

test('Ichor: the two nodes took the Scroll seats, weight for weight', () => {
  // docs/xp-overhaul.md §3: seat for seat and weight for weight (46 and 14).
  assert.deepStrictEqual(ICHOR_NODE_KIND, { ichorReward: 'ichor', ichorDropReward: 'drop' });
  const weights = new Map(REWARD_WEIGHTS);
  assert.strictEqual(weights.get('ichorReward'), 46);
  assert.strictEqual(weights.get('ichorDropReward'), 14);
  assert.strictEqual(weights.size, REWARD_WEIGHTS.length, 'no seat is listed twice');
});
