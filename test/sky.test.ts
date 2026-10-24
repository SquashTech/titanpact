import * as assert from 'assert';
import { test } from './harness';
import { createProfile, decodeProfile, recordRunEnded, recordTrialCleared, STARDUST_PER_STAR, totalStars, trialStardust, type Profile, type RunEnd } from '../src/run/profile';
import { sky } from '../src/data/sky';
import { TRIAL_LIST } from '../src/data/trials';
import { constellationState, findStar, isConstellationLit, isStarLit, recordScenarioLit, skyStardust, SkyError, starScenario, type ConstellationState } from '../src/run/sky';
import { isGauntletOpen } from '../src/run/gauntlet';
import { isConstructedOpen } from '../src/run/constructed';
import { stardustEarned } from '../src/run/starShop';

const end = (cycle: number, outcome: 'win' | 'loss'): RunEnd => ({ outcome, actReached: 6, locationId: null, encountersWon: 1, cycle, roster: [] });

const states = (profile: Profile, content = sky): Record<string, ConstellationState> =>
  Object.fromEntries(Object.keys(content.constellations).map((id) => [id, constellationState(profile, content, id)]));

const playable = (state: ConstellationState) => state === 'open' || state === 'lit';

/** The sky as it will be once the lessons are authored. */
const charted = { ...sky, constellations: Object.fromEntries(Object.entries(sky.constellations).map(([id, c]) => [id, { ...c, uncharted: false }])) };

test('sky: the data hangs together — every wait, line, star and scenario points at something real', () => {
  const starIds = new Set<string>();
  const scenarioStars = new Set<string>();
  for (const c of Object.values(sky.constellations)) {
    for (const starId of c.after) assert.ok(findStar(sky, starId), `${c.id} waits on a missing star ${starId}`);
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
  }
  for (const id of Object.keys(sky.scenarios)) assert.ok(scenarioStars.has(id), `scenario ${id} has no star`);
  assert.deepStrictEqual(Object.keys(sky.constellations), ['firstLight', 'infinite', 'trials', 'gauntlet', 'strange'], 'five ways to play');
  assert.deepStrictEqual(
    Object.values(sky.constellations).filter((c) => c.after.length === 0).map((c) => c.id),
    ['firstLight'],
    'the lessons are the one way in'
  );
  assert.strictEqual(sky.constellations.trials.stars.length, TRIAL_LIST.length, 'a star per Trial');
});

test('sky: once charted, a new account sees the lessons first and the Infinite past them', () => {
  const s = states(createProfile(), charted);
  assert.strictEqual(s.firstLight, 'open');
  assert.strictEqual(s.infinite, 'glimpsed', 'the Infinite shows its shape until the lessons are done');
  for (const id of ['trials', 'gauntlet', 'strange']) assert.strictEqual(s[id], 'hidden', id);
  assert.strictEqual(skyStardust(createProfile(), charted), 0);
});

test('sky: while the lessons are uncharted they stand aside, so a new account can still enter the Infinite', () => {
  const s = states(createProfile());
  assert.strictEqual(s.firstLight, 'open');
  assert.strictEqual(s.infinite, 'open');
  for (const id of ['trials', 'gauntlet', 'strange']) assert.strictEqual(s[id], 'glimpsed', id);
  assert.ok(Object.values(sky.constellations).filter((c) => c.uncharted).every((c) => c.rail || c.id === 'strange'), 'only the lessons and Strange Worlds wait on scenarios');
});

test('sky: playing every lesson lights First Light, opens the Infinite and pays once', () => {
  let profile = createProfile();
  for (const star of sky.constellations.firstLight.stars) profile = recordScenarioLit(profile, charted, (star.light as { scenarioId: string }).scenarioId);
  assert.strictEqual(constellationState(profile, charted, 'firstLight'), 'lit');
  assert.strictEqual(constellationState(profile, charted, 'infinite'), 'open');
  const paid = skyStardust(profile, charted);
  assert.strictEqual(paid, 300);
  assert.strictEqual(recordScenarioLit(profile, charted, 'firstLight.move'), profile, 'a replay stores nothing');
  assert.strictEqual(skyStardust(profile, charted), paid, 'and pays nothing');
  assert.throws(() => recordScenarioLit(profile, charted, 'noSuchScenario'), SkyError);
});

test('sky: an existing account lights exactly what it has already done, and its balance does not move', () => {
  let profile = recordRunEnded(createProfile(), end(1, 'win'), 1);
  profile = recordRunEnded(profile, end(2, 'win'), 2);
  profile = recordTrialCleared(profile, TRIAL_LIST[0].id);
  const s = states(profile);
  assert.strictEqual(s.firstLight, 'lit', 'an account that played before the sky has nothing to learn from the lessons');
  assert.strictEqual(s.infinite, 'open', 'two of five Cycles cleared');
  const infinite = sky.constellations.infinite;
  assert.deepStrictEqual(
    infinite.stars.map((star) => isStarLit(profile, infinite, star)),
    [true, true, false, false, false]
  );
  assert.strictEqual(s.trials, 'open');
  assert.strictEqual(s.gauntlet, 'open');
  assert.strictEqual(s.strange, 'open', 'open, though uncharted');
  assert.ok(!isConstellationLit(profile, sky.constellations.gauntlet));
  // The lessons it never played pay nothing: the sky arriving moves no balance.
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
  assert.strictEqual(constellationState(lost, sky, 'gauntlet'), 'glimpsed');
});

test('sky: the Gauntlet lights a star a clear, up to five', () => {
  const gauntlet = sky.constellations.gauntlet;
  const three = { ...recordRunEnded(createProfile(), end(1, 'win'), 1), gauntletClears: 3 };
  assert.deepStrictEqual(gauntlet.stars.map((star) => isStarLit(three, gauntlet, star)), [true, true, true, false, false]);
});

test('sky: lit scenarios survive a round trip and decode deduplicated', () => {
  const profile = recordScenarioLit(createProfile(), sky, 'firstLight.move');
  assert.deepStrictEqual(decodeProfile(JSON.parse(JSON.stringify(profile))).litStars, ['firstLight.move']);
  assert.deepStrictEqual(decodeProfile({ litStars: ['a', 'a', 3, ''] }).litStars, ['a']);
  assert.deepStrictEqual(decodeProfile({}).litStars, []);
});
