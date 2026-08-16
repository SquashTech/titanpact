import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { enemies } from '../src/data/enemies';
import { guildHallOffers } from '../src/data/recruitment';
import { createRunState, createRosterEntry, addRosterEntry, ROSTER_CAP } from '../src/run/state';
import { equipItem } from '../src/run/equipment';
import { equipment } from '../src/data/equipment';
import { recruitFromGuildHall, deriveContractOffer, claimContract, buyContract, isRecruitable, RecruitmentError } from '../src/run/recruitment';

function seedRoster(heroIds: string[], gold = 0) {
  let run = createRunState(0, gold);
  for (const heroId of heroIds) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  return run;
}

// --- Guild Hall (raise) --------------------------------------------------

test('recruitment: Guild Hall recruit spends gold and adds a fresh 0-progress entry', () => {
  const run = seedRoster(['cinderKnight'], 20);
  const offer = guildHallOffers.find((o) => o.heroId === 'ironWarden')!;

  const next = recruitFromGuildHall(run, offer, 'ironWarden');
  assert.strictEqual(next.gold, 20 - offer.cost);
  const entry = next.roster.find((r) => r.rosterId === 'ironWarden');
  assert.ok(entry);
  assert.strictEqual(entry!.heroId, 'ironWarden');
  assert.strictEqual(entry!.rankProgress, 0);
  assert.deepStrictEqual(entry!.chosenBranchIds, []);
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

test('recruitment: a contract offer carries over rank-up state but not equipment or rosterId', () => {
  const run = seedRoster(['ironWarden']);
  const defeated = {
    ...run.roster[0],
    equipment: equipItem(run.roster[0].equipment, equipment.ironBlade),
    rankProgress: 5,
    chosenBranchIds: ['ironWarden-veteran'],
    rankStatGrants: { defense: 10 },
    rankTypeGraft: null,
  };

  const offer = deriveContractOffer(defeated);
  assert.strictEqual((offer as any).rosterId, undefined);
  assert.strictEqual((offer as any).equipment, undefined);
  assert.strictEqual(offer.rankProgress, 5);
  assert.deepStrictEqual(offer.chosenBranchIds, ['ironWarden-veteran']);
  assert.deepStrictEqual(offer.rankStatGrants, { defense: 10 });
});

test('recruitment: claiming a contract is free in gold and adds the offer ungeared under a fresh rosterId', () => {
  const run = seedRoster(['cinderKnight'], 0); // createRunState defaults recruitContracts to 1
  const defeated = {
    ...run.roster[0],
    heroId: 'ironWarden',
    equipment: equipItem(run.roster[0].equipment, equipment.ironBlade),
    rankProgress: 5,
  };
  const offer = deriveContractOffer(defeated);

  const next = claimContract(run, offer, 'claimed-ironWarden');
  assert.strictEqual(next.gold, 0); // free in gold...
  assert.strictEqual(next.recruitContracts, 0); // ...but spends one Recruit Contract
  const entry = next.roster.find((r) => r.rosterId === 'claimed-ironWarden');
  assert.ok(entry);
  assert.strictEqual(entry!.heroId, 'ironWarden');
  assert.strictEqual(entry!.rankProgress, 5);
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

// --- Non-recruitable enemy content ----------------------------------------

test('recruitment: isRecruitable accepts a heroId from the recruitable pool and rejects one that is not in it', () => {
  assert.strictEqual(isRecruitable('cinderKnight', heroes), true);
  assert.strictEqual(isRecruitable('goblinGrunt', heroes), false);
});

test('recruitment: the enemy pool shares no ids with the recruitable hero pool', () => {
  const overlap = Object.keys(enemies).filter((id) => id in heroes);
  assert.deepStrictEqual(overlap, []);
});
