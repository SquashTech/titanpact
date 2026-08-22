import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { enemies } from '../src/data/enemies';
import { guildHallOffers } from '../src/data/recruitment';
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
  let run = createRunState(0, gold);
  for (const heroId of heroIds) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  return run;
}

// --- Guild Hall (raise) --------------------------------------------------

test('recruitment: Guild Hall recruit spends gold and adds a fresh 0-progress entry', () => {
  const run = seedRoster(['cinderKnight'], 100);
  const offer = guildHallOffers.find((o) => o.heroId === 'ironWarden')!;

  const next = recruitFromGuildHall(run, offer, 'ironWarden');
  assert.strictEqual(next.gold, 100 - offer.cost);
  const entry = next.roster.find((r) => r.rosterId === 'ironWarden');
  assert.ok(entry);
  assert.strictEqual(entry!.heroId, 'ironWarden');
  assert.strictEqual(entry!.level, 1);
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

// --- Recruit Contracts (recruit) -----------------------------------------

test('recruitment: a contract offer carries over Evolution state but not equipment or rosterId', () => {
  const run = seedRoster(['ironWarden']);
  const defeated = {
    ...run.roster[0],
    equipment: equipItem(run.roster[0].equipment, equipment.ironBlade),
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
    equipment: equipItem(run.roster[0].equipment, equipment.ironBlade),
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
  assert.deepStrictEqual(entry!.equipment, { weapon: null, armor: null, accessory: null });
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

// --- Roster-full replacement (RosterReplaceScreen) ------------------------

test('recruitment: recruitFromGuildHallReplacing swaps the terminated hero for a fresh recruit, inheriting its equipment', () => {
  const allSix = ['cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle', 'stormRanger', 'shadowMonk'];
  let run = seedRoster(allSix, 1000);
  run = {
    ...run,
    roster: run.roster.map((r) => (r.rosterId === 'tidecaller' ? { ...r, equipment: equipItem(r.equipment, equipment.ironBlade), level: 4 } : r)),
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
  assert.strictEqual(entry!.level, 1); // fresh, no progress carried over
  assert.strictEqual(entry!.equipment.weapon, 'ironBlade'); // inherited from the terminated hero
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
    roster: run.roster.map((r) => (r.rosterId === 'ironWarden' ? { ...r, equipment: equipItem(r.equipment, equipment.ironBlade) } : r)),
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
  assert.strictEqual(entry!.equipment.weapon, 'ironBlade'); // inherited from the terminated hero, not the veteran's own (offer is ungeared)
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

// --- Non-recruitable enemy content ----------------------------------------

test('recruitment: isRecruitable accepts a heroId from the recruitable pool and rejects one that is not in it', () => {
  assert.strictEqual(isRecruitable('cinderKnight', heroes), true);
  assert.strictEqual(isRecruitable('goblinGrunt', heroes), false);
});

test('recruitment: the enemy pool shares no ids with the recruitable hero pool', () => {
  const overlap = Object.keys(enemies).filter((id) => id in heroes);
  assert.deepStrictEqual(overlap, []);
});
