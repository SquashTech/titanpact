import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { enemies } from '../src/data/enemies';
import { guildHallOffers } from '../src/data/recruitment';
import { ENEMY_LEVEL_BY_ACT, GUILD_HALL_ACT_LAG, guildHallLevel } from '../src/run/difficulty';
import { EVOLUTION_LEVEL } from '../src/run/progression';
import { ENCOUNTERS_PER_ACT, MAX_LEVEL, levelAfterEncounters } from '../src/run/growth';
import { guildHallEntry } from '../src/run/guildRecruit';
import { createRunState, createRosterEntry, addRosterEntry, ROSTER_CAP } from '../src/run/state';
import { equipItem } from '../src/run/equipment';
import { equipment } from '../src/data/equipment';
import {
  recruitFromGuildHall,
  recruitFromGuildHallReplacing,
  deriveContractOffer,
  claimContract,
  claimContractReplacing,
  buyContract,
  isRecruitable,
  freshRosterId,
  RecruitmentError,
} from '../src/run/recruitment';

function seedRoster(heroIds: string[], gold = 0) {
  let run = createRunState(gold);
  for (const heroId of heroIds) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  return run;
}

// --- Guild Hall (raise) ---

test('recruitment: Guild Hall recruit spends gold and adds an entry at the act hire level', () => {
  const run = seedRoster(['cinderKnight'], 100);
  const offer = guildHallOffers.find((o) => o.heroId === 'ironWarden')!;

  const next = recruitFromGuildHall(run, offer, 'ironWarden');
  assert.strictEqual(next.gold, 100 - offer.cost);
  const entry = next.roster.find((r) => r.rosterId === 'ironWarden');
  assert.ok(entry);
  assert.strictEqual(entry!.heroId, 'ironWarden');
  assert.strictEqual(entry!.level, guildHallLevel(1));
  assert.deepStrictEqual(entry!.chosenPathIds, []);
});

test('recruitment: Guild Hall recruit rejects insufficient gold', () => {
  const run = seedRoster(['cinderKnight'], 5);
  const offer = guildHallOffers.find((o) => o.heroId === 'ironWarden')!;
  assert.throws(() => recruitFromGuildHall(run, offer, 'ironWarden'), RecruitmentError);
});

test('recruitment: Guild Hall recruit still enforces the roster cap', () => {
  const allSix = ['cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle', 'stormRanger', 'shadowMonk'];
  assert.strictEqual(allSix.length, ROSTER_CAP);
  const run = seedRoster(allSix, 1000);
  const offer = guildHallOffers.find((o) => o.heroId === 'ironWarden')!;
  assert.throws(() => recruitFromGuildHall(run, offer, 'extra-ironWarden'));
});

test('recruitment: a hire arrives ONE ACT behind the roster, and never catches up', () => {
  // Derived from the level curve since 2026-09-10, not authored beside it: a hire arrives at the
  // level the roster held when this act began, plus one (docs/growth-overhaul.md §6). That IS
  // "decaying runway value" — the gap is a fixed act, so it is worth most early, when one act is
  // most of the run.
  for (let act = 1; act <= 5; act++) {
    const level = guildHallLevel(act);
    assert.ok(level >= guildHallLevel(act - 1), `act ${act}: the hire curve must not go backwards`);
    assert.ok(level < MAX_LEVEL, `act ${act}: a hire at ${level} is already at the cap`);
    // Behind on arrival, and the curve is a delta, so it stays behind for the rest of the run.
    assert.ok(
      level < levelAfterEncounters(act * ENCOUNTERS_PER_ACT),
      `act ${act}: a hire at ${level} is not underlevelled at all`
    );
    assert.strictEqual(
      level,
      levelAfterEncounters(Math.max(0, act - GUILD_HALL_ACT_LAG) * ENCOUNTERS_PER_ACT) + 1,
      `act ${act}: the hire level must track the curve, not a table beside it`
    );
  }
  // A junk act clamps rather than running off the end of the curve.
  assert.ok(guildHallLevel(99) <= MAX_LEVEL);
  assert.strictEqual(guildHallLevel(0), guildHallLevel(1));
});

test('recruitment: a hire arrives RAW — rank 1, no Evolution, its own starting kit', () => {
  // The flat-value / decaying-runway line, on three axes instead of one (docs/growth-overhaul.md
  // §6). A hire is unbuilt: every decision about what it becomes is still the player's, which is
  // the whole of what 50 gold buys against a Contract's finished hero.
  for (const act of [1, 3, 5]) {
    const run = { ...seedRoster(['cinderKnight'], 100), actNumber: act };
    const offer = guildHallOffers.find((o) => o.heroId === 'ironWarden')!;
    const entry = recruitFromGuildHall(run, offer, 'ironWarden').roster.find((r) => r.rosterId === 'ironWarden')!;

    assert.strictEqual(entry.level, guildHallLevel(act));
    assert.deepStrictEqual(entry.chosenPathIds, [], `act ${act}: a hire must not arrive evolved`);
    assert.strictEqual(entry.masteryScrollsSpent, 0, `act ${act}: a hire must arrive at rank 1`);
    assert.deepStrictEqual(
      [...entry.unlockedMoveIds],
      [...offer.startingMoveIds],
      `act ${act}: a hire's kit is its authored starting kit, nothing more`
    );
    assert.deepStrictEqual(entry.offeredMoveIds, [], `act ${act}: and its whole Scroll pool is untouched`);
  }
});

test('recruitment: RAW is unbuilt, not hollow — a hire has the growth its levels earned', () => {
  // A level-13 hire with no growth grants would be ~120 points behind a level-13 roster hero,
  // which is not an archetype, it is a waste of 50 gold.
  const run = { ...seedRoster(['cinderKnight'], 100), actNumber: 4 };
  const offer = guildHallOffers.find((o) => o.heroId === 'ironWarden')!;
  const entry = recruitFromGuildHall(run, offer, 'ironWarden').roster.find((r) => r.rosterId === 'ironWarden')!;

  assert.ok(entry.level > 1);
  const gained = Object.values(entry.growthStatGrants).reduce((sum, n) => sum + (n ?? 0), 0);
  assert.ok(gained > 0, 'a hire past level 1 must carry growth grants');
  // Loosely bounded rather than pinned: the roll is seeded but the grades are placeholder, and
  // pinning an exact figure would fail on the phase 7 authoring pass for no reason.
  assert.ok(gained > (entry.level - 1) * 4, `${gained} points over ${entry.level - 1} levels is too thin to be a real roll`);
});

test('recruitment: the previewed hire is the hire that is bought', () => {
  const run = { ...seedRoster(['cinderKnight'], 100), actNumber: 5 };
  const offer = guildHallOffers.find((o) => o.heroId === 'ironWarden')!;

  const previewed = guildHallEntry(run, offer, 'preview');
  const bought = recruitFromGuildHall(run, offer, 'ironWarden').roster.find((r) => r.rosterId === 'ironWarden')!;
  assert.deepStrictEqual({ ...bought, rosterId: 'preview' }, previewed);
});

// --- Recruit Contracts (recruit) ---

test('recruitment: a contract offer carries over Evolution state but not equipment or rosterId', () => {
  const run = seedRoster(['ironWarden']);
  const defeated = {
    ...run.roster[0],
    equipment: equipItem(run.roster[0].equipment, equipment['sword.common'].id),
    level: 5,
    chosenPathIds: ['ironWarden-veteran'],
    evolutionStatGrants: { defense: 10 },
    evolutionTypeGraft: null,
  };

  const offer = deriveContractOffer(defeated);
  assert.strictEqual((offer as any).rosterId, undefined);
  assert.strictEqual((offer as any).equipment, undefined);
  assert.strictEqual(offer.level, 5);
  assert.deepStrictEqual(offer.chosenPathIds, ['ironWarden-veteran']);
  assert.deepStrictEqual(offer.evolutionStatGrants, { defense: 10 });
});

test('recruitment: claiming a contract is free in gold and adds the offer ungeared under a fresh rosterId', () => {
  const run = seedRoster(['cinderKnight'], 0); // createRunState defaults recruitContracts to 1
  const defeated = {
    ...run.roster[0],
    heroId: 'ironWarden',
    equipment: equipItem(run.roster[0].equipment, equipment['sword.common'].id),
    level: 5,
  };
  const offer = deriveContractOffer(defeated);

  const next = claimContract(run, offer, 'claimed-ironWarden');
  assert.strictEqual(next.gold, 0); // free in gold...
  assert.strictEqual(next.recruitContracts, 0); // ...but spends one Recruit Contract
  const entry = next.roster.find((r) => r.rosterId === 'claimed-ironWarden');
  assert.ok(entry);
  assert.strictEqual(entry!.heroId, 'ironWarden');
  assert.strictEqual(entry!.level, 5);
  assert.deepStrictEqual(entry!.equipment, []);
});

test('recruitment: claiming a contract still enforces the roster cap', () => {
  const allSix = ['cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle', 'stormRanger', 'shadowMonk'];
  const run = seedRoster(allSix, 0);
  const offer = deriveContractOffer(run.roster[0]);
  assert.throws(() => claimContract(run, offer, 'extra'));
});

test('recruitment: claiming a contract with none available is rejected', () => {
  const run = { ...seedRoster(['cinderKnight'], 0), recruitContracts: 0 };
  const offer = deriveContractOffer(run.roster[0]);
  assert.throws(() => claimContract(run, offer, 'claimed'), RecruitmentError);
});

test('recruitment: buyContract spends gold and grants a Recruit Contract; insufficient gold is rejected', () => {
  const run = seedRoster(['cinderKnight'], 12);
  assert.throws(() => buyContract(run, 20), RecruitmentError);

  const next = buyContract(run, 12);
  assert.strictEqual(next.gold, 0);
  assert.strictEqual(next.recruitContracts, run.recruitContracts + 1);
});

// --- Roster-full replacement (RosterReplaceScreen) ---

test('recruitment: recruitFromGuildHallReplacing swaps the terminated hero for a fresh recruit, inheriting its equipment', () => {
  const allSix = ['cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle', 'stormRanger', 'shadowMonk'];
  let run = seedRoster(allSix, 1000);
  run = {
    ...run,
    roster: run.roster.map((r) => (r.rosterId === 'tidecaller' ? { ...r, equipment: equipItem(r.equipment, equipment['sword.common'].id), level: 4 } : r)),
  };
  const incomingOffer = guildHallOffers.find((o) => !allSix.includes(o.heroId))!;
  assert.ok(incomingOffer, 'expected a Guild Hall offer for a hero not already on the fixture roster');

  const next = recruitFromGuildHallReplacing(run, incomingOffer, incomingOffer.heroId, 'tidecaller');
  assert.strictEqual(next.gold, 1000 - incomingOffer.cost);
  assert.strictEqual(next.roster.length, ROSTER_CAP); // still 6, not 7
  assert.ok(!next.roster.some((r) => r.rosterId === 'tidecaller'), 'tidecaller is gone');
  const entry = next.roster.find((r) => r.rosterId === incomingOffer.heroId);
  assert.ok(entry);
  assert.strictEqual(entry!.heroId, incomingOffer.heroId);
  assert.strictEqual(entry!.level, guildHallLevel(run.actNumber)); // the act's hire, not the terminated hero's level
  assert.strictEqual(entry!.equipment[0], 'sword.common'); // inherited from the terminated hero
});

test('recruitment: recruitFromGuildHallReplacing rejects insufficient gold and an unknown terminated rosterId', () => {
  const allSix = ['cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle', 'stormRanger', 'shadowMonk'];
  const run = seedRoster(allSix, 0);
  const incomingOffer = guildHallOffers.find((o) => !allSix.includes(o.heroId))!;
  assert.throws(() => recruitFromGuildHallReplacing(run, incomingOffer, incomingOffer.heroId, 'tidecaller'), RecruitmentError);

  const richRun = { ...run, gold: 1000 };
  assert.throws(() => recruitFromGuildHallReplacing(richRun, incomingOffer, incomingOffer.heroId, 'nonexistent'), RecruitmentError);
});

test('recruitment: claimContractReplacing swaps the terminated hero for the claimed veteran, inheriting its equipment but not the veteran\'s own', () => {
  const allSix = ['cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle', 'stormRanger', 'shadowMonk'];
  let run = seedRoster(allSix, 0);
  run = {
    ...run,
    roster: run.roster.map((r) => (r.rosterId === 'ironWarden' ? { ...r, equipment: equipItem(r.equipment, equipment['sword.common'].id) } : r)),
  };
  const defeated = { ...run.roster.find((r) => r.rosterId === 'cinderKnight')!, heroId: 'shadowMonk', level: 5 };
  const offer = deriveContractOffer(defeated); // shadowMonk is already on this roster, but rosterId is derived fresh below
  const rosterId = freshRosterId(run, 'shadowMonk');
  assert.strictEqual(rosterId, 'shadowMonk-2'); // shadowMonk already occupies its own rosterId

  const next = claimContractReplacing(run, offer, rosterId, 'ironWarden');
  assert.strictEqual(next.recruitContracts, run.recruitContracts - 1);
  assert.strictEqual(next.roster.length, ROSTER_CAP);
  assert.ok(!next.roster.some((r) => r.rosterId === 'ironWarden'), 'ironWarden is gone');
  const entry = next.roster.find((r) => r.rosterId === rosterId);
  assert.ok(entry);
  assert.strictEqual(entry!.heroId, 'shadowMonk');
  assert.strictEqual(entry!.level, 5); // veteran progress carried over
  assert.strictEqual(entry!.equipment[0], 'sword.common'); // inherited from the terminated hero, not the veteran's own (offer is ungeared)
});

test('recruitment: claimContractReplacing rejects no contracts available and an unknown terminated rosterId', () => {
  const allSix = ['cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle', 'stormRanger', 'shadowMonk'];
  const run = seedRoster(allSix, 0);
  const offer = deriveContractOffer(run.roster[0]);
  assert.throws(() => claimContractReplacing({ ...run, recruitContracts: 0 }, offer, 'new', 'ironWarden'), RecruitmentError);
  assert.throws(() => claimContractReplacing(run, offer, 'new', 'nonexistent'), RecruitmentError);
});

test('recruitment: freshRosterId returns the heroId itself when unclaimed, else disambiguates', () => {
  const run = seedRoster(['cinderKnight']);
  assert.strictEqual(freshRosterId(run, 'ironWarden'), 'ironWarden');
  assert.strictEqual(freshRosterId(run, 'cinderKnight'), 'cinderKnight-2');
});

// --- Non-recruitable enemy content ---

test('recruitment: isRecruitable accepts a heroId from the recruitable pool and rejects one that is not in it', () => {
  assert.strictEqual(isRecruitable('cinderKnight', heroes), true);
  assert.strictEqual(isRecruitable('goblinGrunt', heroes), false);
});

test('recruitment: the enemy pool shares no ids with the recruitable hero pool', () => {
  const overlap = Object.keys(enemies).filter((id) => id in heroes);
  assert.deepStrictEqual(overlap, []);
});

// --- Finished vs raw (docs/growth-overhaul.md §6) ---------------------------------------------

test('recruitment: a contract hero arrives FINISHED where a hire arrives RAW — three axes, not one', () => {
  // CLAUDE.md's line — "Guild heroes have decaying runway value; contract heroes have flat value"
  // — used to be true on LEVEL alone. Since 2026-09-10 it is true on level, rank and Evolution,
  // which is what makes the two routes worth choosing between rather than ranking.
  const act = 4;
  const run = { ...seedRoster(['cinderKnight'], 200), actNumber: act };

  // The contract hero IS the enemy you beat: whatever that build carried, it carries.
  const beaten = {
    ...createRosterEntry('beaten', 'ironWarden', heroes.ironWarden.moveIds),
    level: 12,
    masteryScrollsSpent: 6,
    chosenPathIds: ['ironWarden-defensive'],
    unlockedMoveIds: [...heroes.ironWarden.moveIds, 'rendArmor'],
  };
  const claimed = claimContract(run, deriveContractOffer(beaten), 'claimed').roster.find(
    (r) => r.rosterId === 'claimed'
  )!;

  const offer = guildHallOffers.find((o) => o.heroId === 'ironWarden')!;
  const hired = recruitFromGuildHall(run, offer, 'hired').roster.find((r) => r.rosterId === 'hired')!;

  // Axis 1 — Evolution. Chosen for you, or yours to spend a Crucible on.
  assert.deepStrictEqual(claimed.chosenPathIds, ['ironWarden-defensive']);
  assert.deepStrictEqual(hired.chosenPathIds, []);

  // Axis 2 — Rank. Six Scrolls' worth already poured in, or none.
  assert.strictEqual(claimed.masteryScrollsSpent, 6);
  assert.strictEqual(hired.masteryScrollsSpent, 0);

  // Axis 3 — Kit. Picked by the game, or the hero's own authored three.
  assert.ok(claimed.unlockedMoveIds.length > offer.startingMoveIds.length);
  assert.deepStrictEqual([...hired.unlockedMoveIds], [...offer.startingMoveIds]);
});

test('recruitment: the LEVEL axis points the right way — a contract hero outranks a hire', () => {
  // §6's fourth axis, restored by phase 6's re-derivation of ENEMY_LEVEL_BY_ACT. It ran BACKWARDS
  // between phases 3 and 6 — an act-5 contract hero arrived at level 10 where a hire arrived at
  // 24 — because the enemy table was still fitted to a 10-level cap. Both tables read off the
  // same curve now, at different lags: the enemy trails the player's act-end level by
  // ENEMY_LEVEL_LAG, a hire by a whole act.
  for (let act = 1; act <= 5; act++) {
    assert.ok(
      ENEMY_LEVEL_BY_ACT[act - 1] > guildHallLevel(act),
      `act ${act}: a contract hero at ${ENEMY_LEVEL_BY_ACT[act - 1]} must outrank a hire at ${guildHallLevel(act)}`
    );
    // And still under the player, or claiming one would be an upgrade with no cost at all.
    assert.ok(
      ENEMY_LEVEL_BY_ACT[act - 1] <= levelAfterEncounters(act * ENCOUNTERS_PER_ACT),
      `act ${act}: an enemy must not out-level the roster it is fought by`
    );
  }
});

test('recruitment: a contract is free in gold and a hire is not — two brakes on two routes', () => {
  // The free route stays priced by the roster cap (gaining means terminating, and equipment
  // strips with no refund); gold prices the purchased one.
  const run = { ...seedRoster(['cinderKnight'], 200), actNumber: 3 };
  const beaten = createRosterEntry('beaten', 'ironWarden', heroes.ironWarden.moveIds);

  assert.strictEqual(claimContract(run, deriveContractOffer(beaten), 'claimed').gold, run.gold);

  const offer = guildHallOffers.find((o) => o.heroId === 'ironWarden')!;
  assert.strictEqual(recruitFromGuildHall(run, offer, 'hired').gold, run.gold - offer.cost);
  assert.ok(offer.cost > 0);
});
