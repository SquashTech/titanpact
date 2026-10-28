import * as assert from 'assert';
import { test } from './harness';
import { createProfile, decodeProfile, recordRunEnded, type RunEnd } from '../src/run/profile';
import { sky } from '../src/data/sky';
import { findStar } from '../src/run/sky';
import { THOUGHTS } from '../src/data/thoughts';
import { recordThoughtSeen, revealedFirst, revealedThought, thoughtFor } from '../src/run/thoughts';

const win: RunEnd = { outcome: 'win', actReached: 6, locationId: null, encountersWon: 1, cycle: 1, roster: [] };

test('thoughts: the table hangs together — unique ids, real constellations, lessons that exist', () => {
  const ids = new Set<string>();
  for (const t of THOUGHTS) {
    assert.ok(!ids.has(t.id), `${t.id} twice`);
    ids.add(t.id);
    if (t.moment.kind === 'revealed') assert.ok(sky.constellations[t.moment.constellationId], `${t.id} names a missing constellation`);
    if (t.showsNext) assert.ok(revealedFirst(createProfile(), THOUGHTS, t.showsNext), `${t.id} leads to ${t.showsNext}, which has no first`);
    if (t.plays) {
      assert.ok(t.scene, `${t.id} starts a lesson without holding the sky`);
      assert.ok(findStar(sky, t.plays) && sky.scenarios[t.plays]?.lesson, `${t.id} plays ${t.plays}, which is no lesson`);
    }
  }
  for (const c of Object.values(sky.constellations)) {
    assert.ok(THOUGHTS.some((t) => t.moment.kind === 'revealed' && t.moment.constellationId === c.id), `${c.id} has no first for being revealed`);
  }
});

test('thoughts: a first plays once an account', () => {
  let profile = createProfile();
  const first = thoughtFor(profile, THOUGHTS, { kind: 'firstSky' });
  assert.ok(first);
  profile = recordThoughtSeen(profile, first!);
  assert.strictEqual(thoughtFor(profile, THOUGHTS, { kind: 'firstSky' }), null);
  assert.strictEqual(recordThoughtSeen(profile, first!), profile, 'a first is recorded once');
  assert.deepStrictEqual(decodeProfile(JSON.parse(JSON.stringify(profile))).seenThoughtIds, [first!.id]);
  assert.deepStrictEqual(decodeProfile({}).seenThoughtIds, []);
});

test('thoughts: a constellation seen open is revealed once, uncharted ones never, in sky order', () => {
  let profile = createProfile();
  // A new account: First Light is the one thing open, so it is the first Blip points out.
  const first = revealedThought(profile, sky, THOUGHTS);
  assert.strictEqual(first?.constellationId, 'firstLight');
  profile = recordThoughtSeen(profile, first!.thought);
  assert.strictEqual(revealedThought(profile, sky, THOUGHTS), null, 'nothing else is open yet');

  // An Infinite run won opens the rest: one first a visit, in sky order. Strange Worlds opens too,
  // but uncharted, so it is never pointed out.
  profile = recordRunEnded(profile, win, 1);
  const order: string[] = [];
  for (let next = revealedThought(profile, sky, THOUGHTS); next; next = revealedThought(profile, sky, THOUGHTS)) {
    order.push(next.constellationId);
    profile = recordThoughtSeen(profile, next.thought);
  }
  assert.deepStrictEqual(order, ['infinite', 'trials', 'gauntlet']);
});

test('thoughts: the first sky plays the fall, leads to First Light and starts the first lesson', () => {
  let profile = createProfile();
  const hello = thoughtFor(profile, THOUGHTS, { kind: 'firstSky' })!;
  assert.strictEqual(hello.showsNext, 'firstLight');
  assert.strictEqual(hello.scene, 'fall');
  assert.strictEqual(hello.plays, 'firstLight.move');
  const shown = revealedFirst(profile, THOUGHTS, 'firstLight');
  assert.ok(shown, 'First Light has a first to show');
  profile = recordThoughtSeen(profile, shown!);
  assert.strictEqual(revealedFirst(profile, THOUGHTS, 'firstLight'), null);
});
