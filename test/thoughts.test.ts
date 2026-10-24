import * as assert from 'assert';
import { test } from './harness';
import { createProfile, decodeProfile, recordRunEnded, type RunEnd } from '../src/run/profile';
import { sky } from '../src/data/sky';
import { THOUGHTS } from '../src/data/thoughts';
import { recordThoughtSeen, revealedThought, thoughtFor } from '../src/run/thoughts';

const win: RunEnd = { outcome: 'win', actReached: 6, locationId: null, encountersWon: 1, cycle: 1, roster: [] };

test('thoughts: the table hangs together — unique ids, real constellations, short lines', () => {
  const ids = new Set<string>();
  for (const t of THOUGHTS) {
    assert.ok(!ids.has(t.id), `${t.id} twice`);
    ids.add(t.id);
    if (t.moment.kind === 'revealed' || t.moment.kind === 'opened') assert.ok(sky.constellations[t.moment.constellationId], `${t.id} names a missing constellation`);
    assert.ok(t.line.length > 0 && t.line.length <= 72, `${t.id} is ${t.line.length} characters, past what one bubble holds`);
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
  // A new account: the rails are uncharted, so Journey is the first one Blip points out.
  const first = revealedThought(profile, sky, THOUGHTS);
  assert.strictEqual(first?.constellationId, 'journey');
  profile = recordThoughtSeen(profile, first!.thought);
  assert.strictEqual(revealedThought(profile, sky, THOUGHTS), null, 'nothing else is open yet');

  // A Journey won opens the Cycles, the Trials and the Gauntlet: one first a visit, in sky order.
  profile = recordRunEnded(profile, win, 1);
  const order: string[] = [];
  for (let next = revealedThought(profile, sky, THOUGHTS); next; next = revealedThought(profile, sky, THOUGHTS)) {
    order.push(next.constellationId);
    profile = recordThoughtSeen(profile, next.thought);
  }
  assert.deepStrictEqual(order, ['cycles', 'trials', 'gauntlet']);
});

test('thoughts: an opened sheet says its first once, and a return picks from its outcome', () => {
  let profile = createProfile();
  const opened = thoughtFor(profile, THOUGHTS, { kind: 'opened', constellationId: 'journey' }, 0);
  assert.ok(opened?.once);
  profile = recordThoughtSeen(profile, opened!);
  assert.strictEqual(thoughtFor(profile, THOUGHTS, { kind: 'opened', constellationId: 'journey' }, 0), null);
  const lost = thoughtFor(profile, THOUGHTS, { kind: 'returned', outcome: 'loss' }, 0.5);
  assert.ok(lost && lost.moment.kind === 'returned' && lost.moment.outcome === 'loss');
});
