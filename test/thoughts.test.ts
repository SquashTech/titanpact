import * as assert from 'assert';
import { test } from './harness';
import { createProfile, decodeProfile, recordRunEnded, type RunEnd } from '../src/run/profile';
import { sky } from '../src/data/sky';
import { findStar } from '../src/run/sky';
import { THOUGHTS } from '../src/data/thoughts';
import { recordThoughtSeen, revealedFirst, revealedThought, thoughtFor, zoomThought } from '../src/run/thoughts';

const win: RunEnd = { outcome: 'win', actReached: 6, locationId: null, encountersWon: 1, cycle: 1, roster: [] };

test('thoughts: the table hangs together — unique ids, real constellations, bubbles that fit', () => {
  const ids = new Set<string>();
  for (const t of THOUGHTS) {
    assert.ok(!ids.has(t.id), `${t.id} twice`);
    ids.add(t.id);
    if (t.moment.kind === 'revealed' || t.moment.kind === 'opened') assert.ok(sky.constellations[t.moment.constellationId], `${t.id} names a missing constellation`);
    if (t.moment.kind === 'star') assert.ok(findStar(sky, t.moment.starId), `${t.id} names a missing star`);
    assert.ok(t.lines.length > 0, `${t.id} says nothing`);
    for (const line of t.lines) assert.ok(line.length > 0 && line.length <= 100, `${t.id}: "${line}" is past what one bubble holds`);
    if (t.showsNext) assert.ok(revealedFirst(createProfile(), THOUGHTS, t.showsNext), `${t.id} leads to ${t.showsNext}, which has no first`);
    if (t.plays) {
      assert.ok(t.forced, `${t.id} starts a lesson without holding the sky`);
      assert.ok(findStar(sky, t.plays) && sky.scenarios[t.plays]?.lesson, `${t.id} plays ${t.plays}, which is no lesson`);
    }
  }
  for (const c of Object.values(sky.constellations)) {
    assert.ok(THOUGHTS.some((t) => t.once && t.moment.kind === 'revealed' && t.moment.constellationId === c.id), `${c.id} has no first for being revealed`);
  }
  for (const kind of ['idle', 'poked', 'pokedLots', 'uncharted'] as const) {
    assert.ok(THOUGHTS.filter((t) => t.moment.kind === kind && !t.once).length >= 2, `${kind} has a pool`);
  }
  for (const outcome of ['win', 'loss'] as const) {
    assert.ok(THOUGHTS.some((t) => t.moment.kind === 'returned' && t.moment.outcome === outcome && !t.once), `a ${outcome} has a pool`);
  }
});

test('thoughts: a first is thought once an account, and a pool is never used up', () => {
  let profile = createProfile();
  const first = thoughtFor(profile, THOUGHTS, { kind: 'firstSky' }, 0);
  assert.ok(first?.once);
  profile = recordThoughtSeen(profile, first!);
  assert.strictEqual(thoughtFor(profile, THOUGHTS, { kind: 'firstSky' }, 0), null, 'the first sky has no pool');
  assert.deepStrictEqual(decodeProfile(JSON.parse(JSON.stringify(profile))).seenThoughtIds, [first!.id]);

  const idle = thoughtFor(profile, THOUGHTS, { kind: 'idle' }, 0.99);
  assert.ok(idle && !idle.once);
  assert.strictEqual(recordThoughtSeen(profile, idle!), profile, 'a pool thought is never recorded');
  assert.ok(thoughtFor(recordThoughtSeen(profile, idle!), THOUGHTS, { kind: 'idle' }, 0.99));
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

test('thoughts: a zoom says its constellation first, then a star that is lit or next, then nothing', () => {
  let profile = createProfile();
  const first = zoomThought(profile, sky, THOUGHTS, 'infinite', 0)!;
  assert.strictEqual(first.id, 'opened.infinite');
  profile = recordThoughtSeen(profile, first);
  assert.strictEqual(zoomThought(profile, sky, THOUGHTS, 'infinite', 0), null, 'Cycle II is not next until Cycle I is cleared');
  profile = recordRunEnded(profile, win, 1);
  const next = zoomThought(profile, sky, THOUGHTS, 'infinite', 0)!;
  assert.ok(next.moment.kind === 'star' && next.moment.starId === 'cycles.2');
  profile = recordThoughtSeen(profile, next);
  assert.strictEqual(zoomThought(profile, sky, THOUGHTS, 'infinite', 0), null);
  const uncharted = zoomThought(createProfile(), sky, THOUGHTS, 'strange', 0);
  assert.strictEqual(uncharted?.moment.kind, 'uncharted');
});

test('thoughts: the first sky leads to First Light and says it once', () => {
  let profile = createProfile();
  const hello = thoughtFor(profile, THOUGHTS, { kind: 'firstSky' }, 0)!;
  assert.strictEqual(hello.showsNext, 'firstLight');
  assert.ok(hello.forced, 'the hello is a beat the player taps through');
  assert.strictEqual(hello.plays, 'firstLight.hunt');
  const shown = revealedFirst(profile, THOUGHTS, 'firstLight');
  assert.ok(shown, 'First Light has a first to show');
  profile = recordThoughtSeen(profile, shown!);
  assert.strictEqual(revealedFirst(profile, THOUGHTS, 'firstLight'), null);
});

test('thoughts: an opened sheet says its first once, and a return picks from its outcome', () => {
  let profile = createProfile();
  const opened = thoughtFor(profile, THOUGHTS, { kind: 'opened', constellationId: 'infinite' }, 0);
  assert.ok(opened?.once);
  profile = recordThoughtSeen(profile, opened!);
  assert.strictEqual(thoughtFor(profile, THOUGHTS, { kind: 'opened', constellationId: 'infinite' }, 0), null);
  const lost = thoughtFor(profile, THOUGHTS, { kind: 'returned', outcome: 'loss' }, 0.5);
  assert.ok(lost && lost.moment.kind === 'returned' && lost.moment.outcome === 'loss');
});
