import * as assert from 'assert';
import { test } from './harness';
import { createProfile, decodeProfile, recordRunEnded, recordTrialCleared, STARDUST_PER_STAR, totalStars, trialStardust, type Profile, type RunEnd } from '../src/run/profile';
import { sky } from '../src/data/sky';
import { TRIAL_LIST } from '../src/data/trials';
import { constellationState, isConstellationLit, recordScenarioLit, skyStardust, SkyError, starScenario, type ConstellationState } from '../src/run/sky';
import { isGauntletOpen } from '../src/run/gauntlet';
import { isConstructedOpen } from '../src/run/constructed';
import { stardustEarned } from '../src/run/starShop';

const end = (cycle: number, outcome: 'win' | 'loss'): RunEnd => ({ outcome, actReached: 6, locationId: null, encountersWon: 1, cycle, roster: [] });

const states = (profile: Profile): Record<string, ConstellationState> =>
  Object.fromEntries(Object.keys(sky.constellations).map((id) => [id, constellationState(profile, sky, id)]));

const playable = (state: ConstellationState) => state === 'open' || state === 'lit';

/** The sky as it will be once the rails are authored. */
const charted = { ...sky, constellations: Object.fromEntries(Object.entries(sky.constellations).map(([id, c]) => [id, { ...c, uncharted: false }])) };

test('sky: the data hangs together — every link, line, star and scenario points at something real', () => {
  const ids = Object.keys(sky.constellations);
  const starIds = new Set<string>();
  const scenarioStars = new Set<string>();
  for (const c of Object.values(sky.constellations)) {
    for (const prior of c.after) assert.ok(ids.includes(prior), `${c.id} comes after a missing ${prior}`);
    for (const [a, b] of c.lines) assert.ok(c.stars[a] && c.stars[b] && a !== b, `${c.id} has a line to nowhere`);
    assert.ok(c.stars.length > 0, `${c.id} has no stars`);
    for (const star of c.stars) {
      assert.ok(!starIds.has(star.id), `star ${star.id} twice`);
      starIds.add(star.id);
      assert.ok(star.x >= 0 && star.x <= 1 && star.y >= 0 && star.y <= 1, `${star.id} is outside its box`);
      if (star.light.kind === 'scenario') {
        assert.ok(starScenario(sky, star), `${star.id} plays a missing scenario`);
        scenarioStars.add(star.light.scenarioId);
      }
    }
    assert.ok(c.at.x >= 0 && c.at.x <= 1 && c.at.y >= 0 && c.at.y <= 1, `${c.id} is outside the sky`);
  }
  for (const id of Object.keys(sky.scenarios)) assert.ok(scenarioStars.has(id), `scenario ${id} has no star`);
  assert.deepStrictEqual(ids.filter((id) => sky.constellations[id].after.length === 0), ['firstLight'], 'the rails are the one way in');
  // Acyclic: walking back along `after` never returns to where it started.
  const reaches = (from: string, seen: Set<string>): boolean =>
    sky.constellations[from].after.some((prior) => seen.has(prior) || reaches(prior, new Set([...seen, prior])));
  for (const id of ids) assert.ok(!reaches(id, new Set([id])), `${id} comes after itself`);
  assert.strictEqual(sky.constellations.trials.stars.length, TRIAL_LIST.length, 'a star per Trial');
});

test('sky: a new account sees the rails first and nothing past the next one', () => {
  const s = Object.fromEntries(Object.keys(charted.constellations).map((id) => [id, constellationState(createProfile(), charted, id)]));
  assert.strictEqual(s.firstLight, 'open');
  assert.strictEqual(s.theBench, 'glimpsed', 'the next rail shows its shape and reward');
  for (const id of ['theRoad', 'journey', 'cycles', 'trials', 'gauntlet']) assert.strictEqual(s[id], 'hidden', id);
  assert.strictEqual(skyStardust(createProfile(), charted), 0);
});

test('sky: while the rails are uncharted they stand aside, so a new account can still begin a Journey', () => {
  const s = states(createProfile());
  for (const id of ['firstLight', 'theBench', 'theRoad', 'journey']) assert.strictEqual(s[id], 'open', id);
  assert.strictEqual(s.trials, 'glimpsed');
  assert.ok(Object.values(sky.constellations).filter((c) => c.uncharted).every((c) => c.rail), 'only a rail waits on its fights');
});

test('sky: playing a rail lights its stars once, opens the next and pays its reward once', () => {
  let profile = createProfile();
  const firstLight = sky.constellations.firstLight;
  for (const star of firstLight.stars) {
    assert.ok(!isConstellationLit(profile, firstLight));
    profile = recordScenarioLit(profile, sky, (star.light as { scenarioId: string }).scenarioId);
  }
  assert.strictEqual(constellationState(profile, charted, 'firstLight'), 'lit');
  assert.strictEqual(constellationState(profile, charted, 'theBench'), 'open');
  assert.strictEqual(constellationState(profile, charted, 'theRoad'), 'glimpsed');
  const paid = skyStardust(profile, sky);
  assert.strictEqual(paid, 100);
  assert.strictEqual(recordScenarioLit(profile, sky, 'firstLight.move'), profile, 'a replay stores nothing');
  assert.strictEqual(skyStardust(profile, sky), paid, 'and pays nothing');
  assert.throws(() => recordScenarioLit(profile, sky, 'noSuchScenario'), SkyError);
});

test('sky: an existing account lights exactly what it has already done, and its balance does not move', () => {
  let profile = recordRunEnded(createProfile(), end(1, 'win'), 1);
  profile = recordRunEnded(profile, end(2, 'win'), 2);
  profile = recordTrialCleared(profile, TRIAL_LIST[0].id);
  const s = states(profile);
  for (const id of ['firstLight', 'theBench', 'theRoad', 'journey']) assert.strictEqual(s[id], 'lit', id);
  assert.strictEqual(s.cycles, 'open', 'two of five Cycles cleared');
  const cycleStars = sky.constellations.cycles.stars;
  assert.deepStrictEqual(
    cycleStars.map((star) => star.light.kind === 'cycleCleared' && profile.cyclesCleared >= star.light.cycle),
    [true, true, false, false, false]
  );
  assert.strictEqual(s.trials, 'open');
  assert.strictEqual(s.gauntlet, 'open');
  // The rails it never played pay nothing: the sky arriving moves no balance.
  assert.strictEqual(skyStardust(profile, sky), 0);
  assert.strictEqual(stardustEarned(profile), totalStars(profile) * STARDUST_PER_STAR + profile.bonusStardust + trialStardust(profile));
});

test('sky: a mode opens in the sky exactly when it opens today', () => {
  const lost = recordRunEnded(createProfile(), end(1, 'loss'), 1);
  const won = recordRunEnded(createProfile(), end(1, 'win'), 1);
  for (const profile of [createProfile(), lost, won]) {
    const s = states(profile);
    assert.strictEqual(playable(s.trials), isConstructedOpen(profile), 'the Trials');
    assert.strictEqual(playable(s.gauntlet), isGauntletOpen(profile), 'the Gauntlet');
  }
  assert.strictEqual(constellationState(lost, sky, 'journey'), 'open', 'a lost run is still a Journey played');
  assert.strictEqual(constellationState(lost, sky, 'gauntlet'), 'glimpsed');
});

test('sky: lit scenarios survive a round trip and decode deduplicated', () => {
  const profile = recordScenarioLit(createProfile(), sky, 'firstLight.move');
  assert.deepStrictEqual(decodeProfile(JSON.parse(JSON.stringify(profile))).litStars, ['firstLight.move']);
  assert.deepStrictEqual(decodeProfile({ litStars: ['a', 'a', 3, ''] }).litStars, ['a']);
  assert.deepStrictEqual(decodeProfile({}).litStars, []);
});
