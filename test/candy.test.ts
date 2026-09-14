// Candy: XP aimed at one hero (src/run/candy.ts, docs/xp-overhaul.md §3).

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { CANDY_PURCHASE_COST, CANDY_PURCHASE_LIMIT } from '../src/data/recruitment';
import {
  CANDY_LEVELS,
  CANDY_NODE_KIND,
  CandyError,
  anyCandyEligible,
  buyCandy,
  canBuyCandy,
  canEatCandy,
  candyLevelAfter,
  candyXp,
  grantCandy,
  parLevel,
} from '../src/run/candy';
import { MAX_LEVEL, MAX_XP, levelAfterEncounters, levelOf, xpForLevel } from '../src/run/growth';
import { REWARD_WEIGHTS } from '../src/run/map';
import { addRosterEntry, createRosterEntry, createRunState, type RunState } from '../src/run/state';

const ALWAYS = () => 0.999999;

function runAtPar(encountersWon: number, heroIds: readonly string[] = ['cinderKnight']): RunState {
  let run: RunState = { ...createRunState(100), encountersWon };
  for (const id of heroIds) {
    run = addRosterEntry(run, { ...createRosterEntry(id, id, heroes[id].moveIds), xp: xpForLevel(levelAfterEncounters(encountersWon)) });
  }
  return run;
}

test('candy: a candy is worth its levels AT PAR on the run curve, so it grows with the act', () => {
  assert.deepStrictEqual(CANDY_LEVELS, { candy: 2, small: 1 });
  for (const encountersWon of [0, 4, 8, 12, 16, 20]) {
    const run = runAtPar(encountersWon);
    const par = parLevel(run);
    assert.strictEqual(par, levelAfterEncounters(encountersWon));
    if (par + 2 <= MAX_LEVEL) {
      assert.strictEqual(candyXp(run, 'candy'), xpForLevel(par + 2) - xpForLevel(par), `Candy after ${encountersWon} wins`);
      assert.strictEqual(candyXp(run, 'small'), xpForLevel(par + 1) - xpForLevel(par), `Small after ${encountersWon} wins`);
    }
  }
  // Act 5's candy is the same two levels Act 1's was, at Act 5's price.
  assert.ok(candyXp(runAtPar(16), 'candy') > 4 * candyXp(runAtPar(0), 'candy'));
  // At the cap the candy is still two steps on the curve, ending at the cap — never zero.
  const late = { ...runAtPar(21), encountersWon: 999 };
  assert.strictEqual(parLevel(late), MAX_LEVEL);
  assert.strictEqual(candyXp(late, 'candy'), MAX_XP - xpForLevel(MAX_LEVEL - 2));
});

test('candy: at par it lands exactly the promised levels; behind par it lands more; ahead, fewer', () => {
  // The convex curve is the mechanism (docs/xp-overhaul.md §2): one grant, three outcomes.
  const run = runAtPar(8, ['cinderKnight', 'crimson', 'rime']);
  const par = parLevel(run);
  const behind = { ...run.roster[1], xp: xpForLevel(par - 5) };
  const ahead = { ...run.roster[2], xp: xpForLevel(par + 3) };
  const fixture = { ...run, roster: [run.roster[0], behind, ahead] };

  assert.strictEqual(candyLevelAfter(fixture, run.roster[0], 'candy'), par + 2, 'at par: exactly +2');
  assert.ok(candyLevelAfter(fixture, behind, 'candy') - (par - 5) > 2, 'behind par: more than +2');
  assert.ok(candyLevelAfter(fixture, ahead, 'candy') - (par + 3) < 2, 'ahead of par: fewer than +2');

  const fed = grantCandy(fixture, heroes, 'cinderKnight', 'candy', ALWAYS);
  assert.strictEqual(fed.report.fromLevel, par);
  assert.strictEqual(fed.report.toLevel, par + 2);
  assert.strictEqual(levelOf(fed.run.roster[0]), par + 2);
  assert.ok((fed.report.gained.hp ?? 0) > 0, 'the levels crossed rolled growth');
  assert.strictEqual(fed.run.roster[1], behind, 'nobody else moved');
  assert.strictEqual(fed.run.roster[2], ahead);
});

test('candy: a hero at the cap is refused rather than wasted', () => {
  const run = runAtPar(4, ['cinderKnight', 'crimson']);
  const capped = { ...run, roster: [{ ...run.roster[0], xp: MAX_XP }, run.roster[1]] };
  assert.strictEqual(canEatCandy(capped.roster[0]), false);
  assert.strictEqual(canEatCandy(capped.roster[1]), true);
  assert.ok(anyCandyEligible(capped.roster));
  assert.throws(() => grantCandy(capped, heroes, 'cinderKnight', 'small'), CandyError);
  assert.throws(() => grantCandy(capped, heroes, 'nobody', 'small'), CandyError);
  const allCapped = { ...capped, roster: capped.roster.map((r) => ({ ...r, xp: MAX_XP })) };
  assert.strictEqual(anyCandyEligible(allCapped.roster), false);
  assert.strictEqual(canBuyCandy(allCapped, 0, 0, CANDY_PURCHASE_LIMIT), false, 'the shelf will not sell to a roster that cannot eat');
});

test('candy: the shelf charges flat gold, sells no more than the limit a visit, and the pick is where it lands', () => {
  let run = { ...runAtPar(4), gold: CANDY_PURCHASE_COST * (CANDY_PURCHASE_LIMIT + 1) };
  for (let bought = 0; bought < CANDY_PURCHASE_LIMIT; bought++) {
    assert.ok(canBuyCandy(run, CANDY_PURCHASE_COST, bought, CANDY_PURCHASE_LIMIT));
    const before = levelOf(run.roster[0]);
    run = buyCandy(run, CANDY_PURCHASE_COST, bought, CANDY_PURCHASE_LIMIT);
    assert.strictEqual(levelOf(run.roster[0]), before, 'buying charges; it does not feed');
    run = grantCandy(run, heroes, 'cinderKnight', 'small', ALWAYS).run;
  }
  assert.strictEqual(run.gold, CANDY_PURCHASE_COST);
  // Two Smalls are NOT +2: the first lands at par+1, and the second is eaten by a hero now ahead of
  // par, where the same XP is worth less than a level. The carry throttles itself (docs/xp-overhaul.md §2).
  assert.strictEqual(levelOf(run.roster[0]), levelAfterEncounters(4) + 1);
  assert.ok(run.roster[0].xp > xpForLevel(levelAfterEncounters(4) + 1), 'and banks the rest part-way to the next');
  // Gold left, shelf empty: the limit is what refuses, not the purse.
  assert.strictEqual(canBuyCandy(run, CANDY_PURCHASE_COST, CANDY_PURCHASE_LIMIT, CANDY_PURCHASE_LIMIT), false);
  assert.throws(() => buyCandy(run, CANDY_PURCHASE_COST, CANDY_PURCHASE_LIMIT, CANDY_PURCHASE_LIMIT), CandyError);
  assert.throws(() => buyCandy({ ...run, gold: 1 }, CANDY_PURCHASE_COST, 0, CANDY_PURCHASE_LIMIT), CandyError);
});

test('candy: the two nodes took the Scroll seats, weight for weight', () => {
  // docs/xp-overhaul.md §3: seat for seat and weight for weight (46 and 14).
  assert.deepStrictEqual(CANDY_NODE_KIND, { candyReward: 'candy', smallCandyReward: 'small' });
  const weights = new Map(REWARD_WEIGHTS);
  assert.strictEqual(weights.get('candyReward'), 46);
  assert.strictEqual(weights.get('smallCandyReward'), 14);
  assert.strictEqual(weights.size, REWARD_WEIGHTS.length, 'no seat is listed twice');
});
