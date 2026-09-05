import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import {
  addPlaytime,
  createProfile,
  decodeProfile,
  formatPlaytime,
  PROFILE_VERSION,
  recordActReached,
  recordRunCompleted,
  recordRunFailed,
  recordRunStarted,
  starredHeroCount,
  totalStars,
} from '../src/run/profile';

const knownHeroIds: ReadonlySet<string> = new Set(Object.keys(heroes));

// --- Verbs ---

test('profile: a fresh profile is empty but for act I, which is where every run starts', () => {
  const profile = createProfile();
  assert.strictEqual(profile.playtimeMs, 0);
  assert.strictEqual(profile.runsStarted, 0);
  assert.strictEqual(profile.furthestAct, 1);
  assert.deepStrictEqual(profile.heroStars, {});
});

test('profile: playtime accumulates and ignores a clock that went backwards', () => {
  let profile = addPlaytime(createProfile(), 30_000);
  profile = addPlaytime(profile, 30_000);
  assert.strictEqual(profile.playtimeMs, 60_000);
  assert.strictEqual(addPlaytime(profile, -5_000).playtimeMs, 60_000);
  assert.strictEqual(addPlaytime(profile, NaN).playtimeMs, 60_000);
});

test('profile: the first run sealed sets firstPlayedAt, and later ones do not move it', () => {
  let profile = recordRunStarted(createProfile(), 1_000);
  assert.strictEqual(profile.firstPlayedAt, 1_000);
  profile = recordRunStarted(profile, 9_000);
  assert.strictEqual(profile.runsStarted, 2);
  assert.strictEqual(profile.firstPlayedAt, 1_000);
  assert.strictEqual(profile.lastPlayedAt, 9_000);
});

test('profile: a clear stars every hero on the final roster', () => {
  const profile = recordRunCompleted(createProfile(), ['cinderKnight', 'rime'], 1_000);
  assert.strictEqual(profile.runsCompleted, 1);
  assert.deepStrictEqual(profile.heroStars, { cinderKnight: 1, rime: 1 });
});

test('profile: stars stack across runs, and a hero left out of one clear does not gain', () => {
  let profile = recordRunCompleted(createProfile(), ['cinderKnight', 'rime'], 1_000);
  profile = recordRunCompleted(profile, ['cinderKnight', 'valor'], 2_000);
  assert.deepStrictEqual(profile.heroStars, { cinderKnight: 2, rime: 1, valor: 1 });
  assert.strictEqual(totalStars(profile), 4);
  assert.strictEqual(starredHeroCount(profile), 3);
});

test('profile: a loss counts as a loss and stars nobody', () => {
  const profile = recordRunFailed(createProfile(), 1_000);
  assert.strictEqual(profile.runsFailed, 1);
  assert.strictEqual(profile.runsCompleted, 0);
  assert.deepStrictEqual(profile.heroStars, {});
});

test('profile: furthest act only ever climbs', () => {
  let profile = recordActReached(createProfile(), 4);
  assert.strictEqual(profile.furthestAct, 4);
  profile = recordActReached(profile, 2);
  assert.strictEqual(profile.furthestAct, 4, 'a later shorter run must not walk the record back');
  profile = recordActReached(profile, 5);
  assert.strictEqual(profile.furthestAct, 5);
});

test('profile: every verb returns a new profile and leaves the old one alone', () => {
  const before = createProfile();
  recordRunStarted(before, 1);
  recordRunCompleted(before, ['rime'], 1);
  addPlaytime(before, 1_000);
  assert.deepStrictEqual(before, createProfile());
});

// --- Formatting ---

test('profile: playtime reads coarsely, and a first session is not "0m"', () => {
  assert.strictEqual(formatPlaytime(0), 'under a minute');
  assert.strictEqual(formatPlaytime(45_000), 'under a minute');
  assert.strictEqual(formatPlaytime(12 * 60_000), '12m');
  assert.strictEqual(formatPlaytime(60 * 60_000), '1h 0m');
  assert.strictEqual(formatPlaytime(4 * 60 * 60_000 + 12 * 60_000), '4h 12m');
});

// --- Decoding. The opposite policy to save.ts: keep whatever is readable. ---

test('profile: a full round trip is lossless', () => {
  let profile = recordRunStarted(createProfile(), 1_000);
  profile = recordRunCompleted(profile, ['cinderKnight', 'rime'], 2_000);
  profile = addPlaytime(profile, 90_000);
  profile = recordActReached(profile, 5);
  assert.deepStrictEqual(decodeProfile(JSON.parse(JSON.stringify(profile)), knownHeroIds), profile);
});

test('profile: junk decodes to a fresh profile instead of throwing', () => {
  for (const junk of [null, undefined, 42, 'nope', []]) {
    assert.deepStrictEqual(decodeProfile(junk, knownHeroIds), createProfile());
  }
});

test('profile: a partly broken file keeps every field that survived', () => {
  const decoded = decodeProfile(
    { playtimeMs: 60_000, runsStarted: 'lots', runsCompleted: 3, furthestAct: -4, heroStars: 'gone' },
    knownHeroIds
  );
  assert.strictEqual(decoded.playtimeMs, 60_000, 'a readable field beside a broken one is kept');
  assert.strictEqual(decoded.runsCompleted, 3);
  assert.strictEqual(decoded.runsStarted, 0, 'the unreadable field falls back, alone');
  assert.strictEqual(decoded.furthestAct, 1, 'an impossible act clamps to the floor');
  assert.deepStrictEqual(decoded.heroStars, {});
  assert.strictEqual(decoded.version, PROFILE_VERSION);
});

test('profile: stars for a hero this build no longer ships are dropped, not taken as corruption', () => {
  const decoded = decodeProfile({ runsCompleted: 2, heroStars: { rime: 2, aHeroThatWasCut: 5 } }, knownHeroIds);
  assert.deepStrictEqual(decoded.heroStars, { rime: 2 });
  assert.strictEqual(decoded.runsCompleted, 2, 'the rest of the profile survives the dropped entry');
});

test('profile: a zero or negative star tally is not stored as an entry', () => {
  const decoded = decodeProfile({ heroStars: { rime: 0, valor: -3, cinderKnight: 2 } }, knownHeroIds);
  assert.deepStrictEqual(decoded.heroStars, { cinderKnight: 2 });
});
