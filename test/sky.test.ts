import * as assert from 'assert';
import { test } from './harness';
import { createProfile, decodeProfile, recordRunEnded, recordTipSeen, recordTrialCleared, STARDUST_PER_STAR, totalStars, trialStardust, type Profile, type RunEnd } from '../src/run/profile';
import { sky, TUTORIAL_STAR } from '../src/data/sky';
import { TRIAL_LIST } from '../src/data/trials';
import { constellationState, findStar, isConstellationLit, isDrawInUnshown, isStarLit, recordScenarioLit, skyLightingTipId, skyStardust, SkyError, starScenario, type ConstellationState } from '../src/run/sky';
import { isGauntletOpen } from '../src/run/gauntlet';
import { isConstructedOpen } from '../src/run/constructed';
import { stardustEarned } from '../src/run/starShop';

const end = (cycle: number, outcome: 'win' | 'loss'): RunEnd => ({ outcome, actReached: 6, locationId: null, encountersWon: 1, cycle, roster: [] });

const states = (profile: Profile, content = sky): Record<string, ConstellationState> =>
  Object.fromEntries(Object.keys(content.constellations).map((id) => [id, constellationState(profile, content, id)]));

const playable = (state: ConstellationState) => state === 'open' || state === 'lit';


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
    'the tutorial is the one way in'
  );
  assert.strictEqual(sky.constellations.trials.stars.length, TRIAL_LIST.length, 'a star per Trial');
});

test('sky: a new account sees the tutorial first and the Infinite past it', () => {
  const s = states(createProfile());
  assert.strictEqual(s.firstLight, 'open');
  assert.strictEqual(s.infinite, 'glimpsed', 'the Infinite shows its shape until the tutorial is won');
  for (const id of ['trials', 'gauntlet', 'strange']) assert.strictEqual(s[id], 'hidden', id);
  assert.strictEqual(skyStardust(createProfile(), sky), 0);
  assert.deepStrictEqual(Object.values(sky.constellations).filter((c) => c.uncharted).map((c) => c.id), ['strange'], 'only Strange Worlds waits on scenarios');
});

test('sky: the tutorial won opens the Infinite and pays once', () => {
  let profile = recordScenarioLit(createProfile(), sky, TUTORIAL_STAR);
  assert.strictEqual(constellationState(profile, sky, 'infinite'), 'open');
  assert.strictEqual(constellationState(profile, sky, 'firstLight'), 'lit');
  const paid = skyStardust(profile, sky);
  assert.strictEqual(paid, 100);
  assert.strictEqual(recordScenarioLit(profile, sky, TUTORIAL_STAR), profile, 'a replay stores nothing');
  assert.strictEqual(skyStardust(profile, sky), paid, 'and pays nothing');
  assert.throws(() => recordScenarioLit(profile, sky, 'noSuchScenario'), SkyError);
});

test('sky: an existing account lights exactly what it has already done, and its balance does not move', () => {
  let profile = recordRunEnded(createProfile(), end(1, 'win'), 1);
  profile = recordRunEnded(profile, end(2, 'win'), 2);
  profile = recordTrialCleared(profile, TRIAL_LIST[0].id);
  const s = states(profile);
  assert.strictEqual(s.firstLight, 'lit', 'an account that played before the sky has nothing to learn from the tutorial');
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
  // The tutorial it never played pays nothing: the sky arriving moves no balance.
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
  const profile = recordScenarioLit(createProfile(), sky, TUTORIAL_STAR);
  assert.deepStrictEqual(decodeProfile(JSON.parse(JSON.stringify(profile))).litStars, [TUTORIAL_STAR]);
  assert.deepStrictEqual(decodeProfile({ litStars: ['a', 'a', 3, ''] }).litStars, ['a']);
  assert.deepStrictEqual(decodeProfile({}).litStars, []);
});

test('sky: the tutorial won pays on the title once, and a veteran has nothing to draw in', () => {
  const tutorial = sky.constellations.firstLight;
  const veteran = recordRunEnded(createProfile(), end(1, 'win'), 1);
  assert.strictEqual(isDrawInUnshown(veteran, tutorial), false, 'a rail lit by an earlier run has nothing to draw in');
  const won = recordScenarioLit(createProfile(), sky, TUTORIAL_STAR);
  assert.strictEqual(isDrawInUnshown(won, tutorial), true);
  assert.strictEqual(isDrawInUnshown(recordTipSeen(won, skyLightingTipId(tutorial.id)), tutorial), false);
});
