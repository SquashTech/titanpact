import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { constructedContent, TRIAL_LIST } from '../src/data/trials';
import { FINALE_LOCATION_ID, locations } from '../src/data/locations';
import { arenaLocationIds, locationForType } from '../src/run/locations';
import { createProfile, decodeProfile, type Profile } from '../src/run/profile';
import { constructedHeroIds, constructedSide, overPoolMoveIds, slotManaPool, slotProblems, TEAM_SIZE } from '../src/run/constructed';
import { signatureIdFor } from '../src/run/progression';
import { createRng } from '../src/engine/rng/seededRng';
import { starsSpent } from '../src/run/starShop';
import {
  OFFER_SIZE,
  TEAM_TYPE_LIMIT,
  GAUNTLET_CLEAR_BONUS,
  GAUNTLET_ENTRY_PRICE,
  PILOT_FROM_WINS,
  WINS_TO_CLEAR,
  GauntletError,
  canEnterGauntlet,
  draftPick,
  endGauntlet,
  enterGauntlet,
  gauntletAiPilot,
  gauntletLocationId,
  gauntletOpponent,
  recordGauntletFight,
  rollGauntletSlot,
  settleLeftFight,
  startGauntletFight,
  type GauntletContent,
  type GauntletRun,
} from '../src/run/gauntlet';

const content: GauntletContent = { ...constructedContent, typeChart };
const owned = Object.values(heroes)
  .filter((h) => !h.unlock)
  .map((h) => h.id);
const TODAY = '2026-10-07';

function opened(): Profile {
  return { ...createProfile(), cyclesCleared: 1, runsCompleted: 1 };
}

/** Six picks, the first of every offer. */
function draft(run: GauntletRun, stars: Record<string, readonly string[]> = {}): GauntletRun {
  while (run.team.length < TEAM_SIZE) run = draftPick(content, owned, stars, run, 0);
  return run;
}

function drafted(profile: Profile): Profile {
  return { ...profile, gauntlet: draft(profile.gauntlet!) };
}

/** Every offer a run shows, drafting the `take`th of each. */
function offersOf(seed: number, stars: Record<string, readonly string[]> = {}, take = 0) {
  let run = enterGauntlet({ ...opened(), evolutionStars: stars as Record<string, string[]> }, content, owned, seed, TODAY, 0).gauntlet!;
  const offers = [];
  while (run.team.length < TEAM_SIZE) {
    offers.push(run.offer);
    run = draftPick(content, owned, stars, run, Math.min(take, run.offer.length - 1));
  }
  return { offers, run };
}

test('gauntlet: six offers of three owned heroes, none offered twice, three types an offer, never a type the team is full of', () => {
  for (let seed = 1; seed <= 20; seed++) {
    for (let take = 0; take < OFFER_SIZE; take++) {
      const { offers, run } = offersOf(seed, {}, take);
      assert.strictEqual(offers.length, TEAM_SIZE);
      const seen = offers.flat().map((s) => s.heroId);
      assert.strictEqual(new Set(seen).size, seen.length, 'a hero offered twice');
      for (const id of seen) assert.ok(owned.includes(id), `${id} is not owned`);
      let team: string[] = [];
      for (const offer of offers) {
        assert.strictEqual(offer.length, OFFER_SIZE);
        const types = offer.map((s) => heroes[s.heroId].types[0]);
        assert.strictEqual(new Set(types).size, OFFER_SIZE, `an offer repeats a type: ${types.join(', ')}`);
        for (const t of types) assert.ok(team.filter((u) => u === t).length < TEAM_TYPE_LIMIT, `${t} offered to a team holding ${TEAM_TYPE_LIMIT}`);
        team = [...team, heroes[offer[Math.min(take, offer.length - 1)].heroId].types[0]];
      }
      assert.strictEqual(run.offer.length, 0);
    }
  }
});

test('gauntlet: every rolled hero is evolved, legal, castable, holds its signature, and swings at least twice', () => {
  for (let seed = 1; seed <= 30; seed++) {
    for (const slot of offersOf(seed).offers.flat()) {
      assert.ok(slot.pathId, `${slot.heroId} is unevolved`);
      assert.deepStrictEqual(slotProblems(content, slot), [], `${slot.heroId}: ${slotProblems(content, slot).join('; ')}`);
      assert.strictEqual(slot.moveIds.length, 4, `${slot.heroId} holds ${slot.moveIds.length}`);
      assert.deepStrictEqual(slot.itemIds, []);
      const path = content.table.evolutions[slot.heroId].flatMap((n) => n.paths).find((p) => p.id === slot.pathId)!;
      const signature = signatureIdFor(heroes[slot.heroId], { offenseSwapped: !!path.swapsOffense });
      if (signature) assert.ok(slot.moveIds.includes(signature), `${slot.heroId} lacks its signature`);
      assert.ok(slot.moveIds.filter((id) => moves[id].kind === 'damage').length >= 2, `${slot.heroId} swings ${slot.moveIds.join(', ')}`);
    }
  }
});

test('gauntlet: no hero in any form is dealt a move over its Mana pool', () => {
  // Every form, rolled many times: the pool is the cap, whatever the roll favours.
  for (const heroId of owned) {
    for (const path of content.table.evolutions[heroId].flatMap((n) => n.paths)) {
      for (let seed = 1; seed <= 6; seed++) {
        const { slot } = rollGauntletSlot(content, heroId, path.id, createRng(seed));
        assert.deepStrictEqual(overPoolMoveIds(content, slot), [], `${path.id} holds ${overPoolMoveIds(content, slot).join(', ')} over ${slotManaPool(content, slot)}`);
      }
    }
  }
});

test('gauntlet: the offers are fixed by the seed and the picks', () => {
  assert.deepStrictEqual(offersOf(7).offers, offersOf(7).offers);
  assert.notDeepStrictEqual(offersOf(7).offers, offersOf(8).offers);
  assert.deepStrictEqual(offersOf(7, {}, 1).offers[0], offersOf(7, {}, 0).offers[0]);
});

test('gauntlet: unstarred paths are weighted up, not filtered', () => {
  // Every hero's first path starred: uniform would put a third of the offers on a starred path.
  const stars: Record<string, string[]> = {};
  for (const id of owned) stars[id] = [content.table.evolutions[id][0].paths[0].id];
  let starred = 0;
  let total = 0;
  for (let seed = 1; seed <= 40; seed++) {
    for (const slot of offersOf(seed, stars).offers.flat()) {
      total++;
      if (stars[slot.heroId].includes(slot.pathId!)) starred++;
    }
  }
  assert.ok(starred > 0, 'a starred path never appears');
  assert.ok(starred / total < 0.25, `${starred} of ${total} starred`);
});

test('gauntlet: the opponent is fixed by seed and record, and is six legal heroes with two leads', () => {
  const profile = drafted(enterGauntlet(opened(), content, owned, 11, TODAY, 0));
  const run = profile.gauntlet!;
  const a = gauntletOpponent(content, run);
  assert.deepStrictEqual(a, gauntletOpponent(content, run));
  assert.strictEqual(a.team.length, TEAM_SIZE);
  assert.strictEqual(new Set(a.team.map((s) => s.heroId)).size, TEAM_SIZE);
  for (const slot of a.team) assert.deepStrictEqual(slotProblems(content, slot), []);
  assert.deepStrictEqual(a.leads, [a.team[0].heroId, a.team[1].heroId]);
  assert.notDeepStrictEqual(gauntletOpponent(content, { ...run, wins: 1 }).team, a.team);
  // It fields: both sides project through the Trials' own builder.
  constructedSide(content, { name: 'gauntlet', slots: run.team });
  constructedSide(content, { name: 'opponent', slots: a.team }, a.leads);
});

test('gauntlet: each win, the opponent answers your typing harder', () => {
  let early = 0;
  let late = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const run: GauntletRun = drafted(enterGauntlet(opened(), content, owned, seed, TODAY, 0)).gauntlet!;
    const mine = new Set(run.team.map((s) => heroes[s.heroId].types[0]));
    // Opponents whose primary type hits one of the team's primaries super-effectively.
    const hits = (r: GauntletRun) => gauntletOpponent(content, r).team.filter((s) => [...mine].some((t) => (typeChart[heroes[s.heroId].types[0]]?.[t] ?? 1) > 1)).length;
    early += hits(run);
    late += hits({ ...run, wins: 4 });
  }
  assert.ok(late > early, `super-effective opponents: ${early} at 0 wins, ${late} at 4`);
});

test('gauntlet: shut until the first Cycle I clear', () => {
  assert.strictEqual(canEnterGauntlet(createProfile(), 99, TODAY), false);
  assert.throws(() => enterGauntlet(createProfile(), content, owned, 1, TODAY, 99), GauntletError);
});

test('gauntlet: one free entry a day; the next costs stars; one run at a time', () => {
  let profile = enterGauntlet(opened(), content, owned, 1, TODAY, 0);
  assert.strictEqual(profile.gauntletEntriesBought, 0);
  assert.strictEqual(profile.gauntletFreeDay, TODAY);
  assert.throws(() => enterGauntlet(profile, content, owned, 2, TODAY, 99), GauntletError);
  profile = endGauntlet(profile).profile;
  assert.strictEqual(canEnterGauntlet(profile, GAUNTLET_ENTRY_PRICE - 1, TODAY), false);
  assert.throws(() => enterGauntlet(profile, content, owned, 2, TODAY, GAUNTLET_ENTRY_PRICE - 1), GauntletError);
  profile = enterGauntlet(profile, content, owned, 2, TODAY, GAUNTLET_ENTRY_PRICE);
  assert.strictEqual(profile.gauntletEntriesBought, 1);
  assert.strictEqual(starsSpent(profile, {}), GAUNTLET_ENTRY_PRICE);
  profile = endGauntlet(profile).profile;
  // Tomorrow is free again, and a missed day does not bank.
  profile = enterGauntlet(profile, content, owned, 3, '2026-10-09', 0);
  assert.strictEqual(profile.gauntletEntriesBought, 1);
  assert.strictEqual(canEnterGauntlet(endGauntlet(profile).profile, 0, '2026-10-09'), false);
});

test('gauntlet: a pick is one of the offer, the team fills once, in order', () => {
  let run = enterGauntlet(opened(), content, owned, 1, TODAY, 0).gauntlet!;
  assert.throws(() => draftPick(content, owned, {}, run, OFFER_SIZE), GauntletError);
  const picked: string[] = [];
  while (run.team.length < TEAM_SIZE) {
    picked.push(run.offer[2].heroId);
    run = draftPick(content, owned, {}, run, 2);
  }
  assert.deepStrictEqual(run.team.map((s) => s.heroId), picked);
  assert.throws(() => draftPick(content, owned, {}, run, 0), GauntletError);
});

test('gauntlet: a run saved under the fifteen-hero board drafts on from its first three', () => {
  const offer = offersOf(3).offers;
  const old = { seed: 3, board: [...offer[0], ...offer[1]], team: [], wins: 0, losses: 0, fighting: false };
  const profile = decodeProfile({ ...JSON.parse(JSON.stringify(opened())), gauntlet: old });
  assert.deepStrictEqual(profile.gauntlet!.offer.map((s) => s.heroId), offer[0].map((s) => s.heroId));
  assert.deepStrictEqual(profile.gauntlet!.team, []);
});

test('gauntlet: five wins stars every unstarred path on the team and pays the bonus', () => {
  let profile = drafted(enterGauntlet(opened(), content, owned, 3, TODAY, 0));
  const team = profile.gauntlet!.team;
  profile = { ...profile, evolutionStars: { [team[0].heroId]: [team[0].pathId!] } };
  let result = null;
  for (let i = 0; i < 4; i++) {
    ({ profile, result } = recordGauntletFight(startGauntletFight(profile), 'win'));
    assert.strictEqual(result, null);
  }
  ({ profile, result } = recordGauntletFight(profile, 'loss'));
  assert.strictEqual(result, null);
  ({ profile, result } = recordGauntletFight(startGauntletFight(profile), 'win'));
  assert.ok(result?.cleared);
  assert.deepStrictEqual(result!.starsEarned, team.slice(1).map((s) => s.pathId));
  assert.strictEqual(result!.bonus, GAUNTLET_CLEAR_BONUS);
  assert.strictEqual(profile.gauntlet, null);
  assert.strictEqual(profile.gauntletClears, 1);
  assert.strictEqual(profile.bonusStars, GAUNTLET_CLEAR_BONUS);
  for (const slot of team) assert.ok(profile.evolutionStars[slot.heroId].includes(slot.pathId!));
  // A Gauntlet star opens the hero in the Trials.
  for (const slot of team) assert.ok(constructedHeroIds(profile).has(slot.heroId));
  // Cycle I colour: no Cycle recorded on it.
  assert.deepStrictEqual(profile.starCycles, {});
});

test('gauntlet: nothing below five wins — two losses, or a retire', () => {
  let profile = drafted(enterGauntlet(opened(), content, owned, 4, TODAY, 0));
  let result = null;
  for (let i = 0; i < 4; i++) ({ profile } = recordGauntletFight(profile, 'win'));
  ({ profile, result } = recordGauntletFight(profile, 'loss'));
  ({ profile, result } = recordGauntletFight(profile, 'loss'));
  assert.deepStrictEqual(result, { wins: 4, losses: 2, cleared: false, starsEarned: [], bonus: 0 });
  assert.strictEqual(profile.gauntlet, null);
  assert.deepStrictEqual(profile.evolutionStars, {});
  assert.strictEqual(profile.bonusStars, 0);

  const retired = endGauntlet(drafted(enterGauntlet(opened(), content, owned, 5, TODAY, 0)));
  assert.strictEqual(retired.result.cleared, false);
  assert.deepStrictEqual(retired.profile.evolutionStars, {});
});

test('gauntlet: a fight left unfinished is a loss', () => {
  const profile = startGauntletFight(drafted(enterGauntlet(opened(), content, owned, 6, TODAY, 0)));
  const settled = settleLeftFight(profile);
  assert.ok(settled.forfeited);
  assert.strictEqual(settled.profile.gauntlet!.losses, 1);
  assert.strictEqual(settled.profile.gauntlet!.fighting, false);
  assert.strictEqual(settleLeftFight(settled.profile).forfeited, false);
});

test('gauntlet: the open run and the ledger survive a save, and an unreadable run is dropped alone', () => {
  const profile = startGauntletFight(drafted(enterGauntlet(opened(), content, owned, 9, TODAY, 0)));
  const read = decodeProfile(JSON.parse(JSON.stringify(profile)));
  assert.deepStrictEqual(read.gauntlet, profile.gauntlet);
  assert.strictEqual(read.gauntletFreeDay, TODAY);
  const broken = decodeProfile({ ...JSON.parse(JSON.stringify(profile)), gauntlet: { board: 'no' } });
  assert.strictEqual(broken.gauntlet, null);
  assert.strictEqual(broken.cyclesCleared, 1);
  assert.strictEqual(decodeProfile({}).gauntlet, null);
});

test('arena locations: every Trial stands in a Location holding its type; a Gauntlet fight in one of the rest, fixed by its seed', () => {
  for (const trial of TRIAL_LIST) {
    const id = locationForType(trial.type);
    assert.ok(id && locations[id].spawnTypes?.includes(trial.type), `${trial.id} has no place`);
  }
  const ids = arenaLocationIds();
  assert.ok(!ids.includes(FINALE_LOCATION_ID));
  const run = enterGauntlet(opened(), content, owned, 12, TODAY, 0).gauntlet!;
  const at = gauntletLocationId(run, ids);
  assert.ok(at && ids.includes(at));
  assert.strictEqual(gauntletLocationId(run, ids), at);
  const seen = new Set(Array.from({ length: 6 }, (_, wins) => gauntletLocationId({ ...run, wins }, ids)));
  assert.ok(seen.size > 1, 'every fight stands in the same place');
});

test('gauntlet: the AI is the escalation — Classic\'s for the early fights, the Trials\' pilot from PILOT_FROM_WINS', () => {
  const run = drafted(enterGauntlet(opened(), content, owned, 2, TODAY, 0)).gauntlet!;
  for (let wins = 0; wins < WINS_TO_CLEAR; wins++) assert.strictEqual(gauntletAiPilot({ ...run, wins }), wins >= PILOT_FROM_WINS);
  // Losses never move it: a run that stumbles early stays on the easier AI.
  const stumbled: GauntletRun = { ...run, wins: 0, losses: 1 };
  assert.strictEqual(gauntletAiPilot(stumbled), false);
});
