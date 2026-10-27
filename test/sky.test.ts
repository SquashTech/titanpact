import * as assert from 'assert';
import { test } from './harness';
import { createProfile, decodeProfile, recordRunEnded, recordTipSeen, recordTrialCleared, STARDUST_PER_STAR, totalStars, trialStardust, type Profile, type RunEnd } from '../src/run/profile';
import { sky } from '../src/data/sky';
import { TRIAL_LIST } from '../src/data/trials';
import { constellationState, findStar, isConstellationLit, isDrawInUnshown, isStarLit, profileBeforeLightings, recordScenarioLit, skyLightingTipId, skyStardust, SkyError, starScenario, unshownLightings, type ConstellationState } from '../src/run/sky';
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
    'the lessons are the one way in'
  );
  assert.strictEqual(sky.constellations.trials.stars.length, TRIAL_LIST.length, 'a star per Trial');
});

test('sky: a new account sees the lessons first and the Infinite past them', () => {
  const s = states(createProfile());
  assert.strictEqual(s.firstLight, 'open');
  assert.strictEqual(s.infinite, 'glimpsed', 'the Infinite shows its shape until the two fights are played');
  for (const id of ['trials', 'gauntlet', 'strange']) assert.strictEqual(s[id], 'hidden', id);
  assert.strictEqual(skyStardust(createProfile(), sky), 0);
  assert.deepStrictEqual(Object.values(sky.constellations).filter((c) => c.uncharted).map((c) => c.id), ['strange'], 'only Strange Worlds waits on scenarios');
});

test('sky: the guided fights open the Infinite; the two acts stay lessons, and every lesson pays once', () => {
  let profile = ['firstLight.move', 'firstLight.mana', 'firstLight.types', 'firstLight.spread'].reduce((p, id) => recordScenarioLit(p, sky, id), createProfile());
  assert.strictEqual(constellationState(profile, sky, 'infinite'), 'glimpsed', 'the first four are not enough');
  profile = recordScenarioLit(profile, sky, 'firstLight.clearing');
  assert.strictEqual(constellationState(profile, sky, 'infinite'), 'open', 'the Clearing opens the Infinite');
  assert.strictEqual(constellationState(profile, sky, 'firstLight'), 'open', 'the acts are still to play');
  assert.strictEqual(skyStardust(profile, sky), 0, 'paid only when every lesson is lit');
  profile = recordScenarioLit(recordScenarioLit(profile, sky, 'firstLight.road'), sky, 'firstLight.fork');
  assert.strictEqual(constellationState(profile, sky, 'firstLight'), 'lit');
  const paid = skyStardust(profile, sky);
  assert.strictEqual(paid, 300);
  assert.strictEqual(recordScenarioLit(profile, sky, 'firstLight.move'), profile, 'a replay stores nothing');
  assert.strictEqual(skyStardust(profile, sky), paid, 'and pays nothing');
  assert.throws(() => recordScenarioLit(profile, sky, 'noSuchScenario'), SkyError);
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
  assert.deepStrictEqual(decodeProfile({ litStars: ['firstLight.hunt', 'firstLight.clearing'] }).litStars, ['firstLight.move', 'firstLight.mana', 'firstLight.types', 'firstLight.spread', 'firstLight.clearing'], 'the Hunt lit lights the four lessons that replaced it');
  assert.deepStrictEqual(decodeProfile({ litStars: ['a', 'a', 3, ''] }).litStars, ['a']);
  assert.deepStrictEqual(decodeProfile({}).litStars, []);
});

test('sky: a lesson won plays its lighting on the title once, and the sky draws it unwon until then', () => {
  const firstLight = sky.constellations.firstLight;
  assert.deepStrictEqual(unshownLightings(createProfile(), firstLight), [], 'nothing won, nothing to play');
  const won = recordScenarioLit(recordScenarioLit(createProfile(), sky, 'firstLight.move'), sky, 'firstLight.clearing');
  assert.deepStrictEqual(unshownLightings(won, firstLight), [0, 4]);
  const before = profileBeforeLightings(won, ['firstLight.clearing']);
  assert.deepStrictEqual(firstLight.stars.map((star) => isStarLit(before, firstLight, star)), [true, false, false, false, false, false, false]);
  assert.strictEqual(constellationState(before, sky, 'infinite'), 'glimpsed', 'the Infinite waits on the Clearing being shown');
  assert.strictEqual(constellationState(won, sky, 'infinite'), 'open');
  const shown = recordTipSeen(won, skyLightingTipId('firstLight.move'));
  assert.deepStrictEqual(unshownLightings(shown, firstLight), [4]);
  const veteran = recordRunEnded(createProfile(), end(1, 'win'), 1);
  assert.deepStrictEqual(unshownLightings(veteran, firstLight), [], 'a rail lit by an earlier run has nothing to play');
  assert.strictEqual(isDrawInUnshown(veteran, firstLight), false, 'nor anything to draw in');
  const all = firstLight.stars.reduce((p, star) => recordScenarioLit(p, sky, star.id), createProfile());
  assert.strictEqual(isDrawInUnshown(all, firstLight), true);
  assert.strictEqual(isDrawInUnshown(recordTipSeen(all, skyLightingTipId(firstLight.id)), firstLight), false);
});
