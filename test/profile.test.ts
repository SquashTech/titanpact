import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { progressionTable } from '../src/data/progression';
import {
  addPlaytime,
  createProfile,
  decodeProfile,
  formatPlaytime,
  hasEvolutionStar,
  PROFILE_VERSION,
  recordActReached,
  recordRunEnded,
  recordRunStarted,
  RUN_HISTORY_CAP,
  starredHeroCount,
  totalStars,
  type RunEnd,
  type RunRecordHero,
} from '../src/run/profile';

const knownHeroIds: ReadonlySet<string> = new Set(Object.keys(heroes));
const knownPathIds: ReadonlySet<string> = new Set(
  Object.values(progressionTable.evolutions).flatMap((nodes) => nodes.flatMap((node) => node.paths.map((path) => path.id)))
);

/** A hero on the finishing roster, evolved down its `${heroId}-${kind}` path. */
function finished(heroId: string, kind: 'offensive' | 'defensive' | 'utility', level = 30): RunRecordHero {
  return { heroId, level, evolutionPathId: `${heroId}-${kind}` };
}

function cleared(roster: RunRecordHero[]): RunEnd {
  return { outcome: 'win', actReached: 6, locationId: null, encountersWon: 16, roster, relicIds: ['bannerOfTheBulwark'] };
}

function wiped(actReached: number, roster: RunRecordHero[]): RunEnd {
  return { outcome: 'loss', actReached, locationId: 'wildsEdge', encountersWon: 4, roster, relicIds: [] };
}

// --- Verbs ---

test('profile: a fresh profile is empty but for act I, which is where every run starts', () => {
  const profile = createProfile();
  assert.strictEqual(profile.playtimeMs, 0);
  assert.strictEqual(profile.runsStarted, 0);
  assert.strictEqual(profile.furthestAct, 1);
  assert.deepStrictEqual(profile.evolutionStars, {});
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

test('profile: a clear stars every EVOLVED hero on the final roster, by the form it finished in', () => {
  const profile = recordRunEnded(
    createProfile(),
    cleared([
      { heroId: 'cinderKnight', level: 30, evolutionPathId: 'cinderKnight-offensive' },
      { heroId: 'rime', level: 30, evolutionPathId: null },
    ]),
    1_000
  );
  assert.strictEqual(profile.runsCompleted, 1);
  assert.deepStrictEqual(profile.evolutionStars, { cinderKnight: ['cinderKnight-offensive'] }, 'an unevolved hero earns nothing');
  assert.ok(hasEvolutionStar(profile, 'cinderKnight', 'cinderKnight-offensive'));
  assert.ok(!hasEvolutionStar(profile, 'cinderKnight', 'cinderKnight-defensive'));
});

test('profile: stars collect across runs, one a path, and a repeat of the same form is the same star', () => {
  let profile = recordRunEnded(createProfile(), cleared([finished('cinderKnight', 'offensive'), finished('rime', 'defensive')]), 1_000);
  profile = recordRunEnded(profile, cleared([finished('cinderKnight', 'defensive'), finished('valor', 'utility')]), 2_000);
  profile = recordRunEnded(profile, cleared([finished('cinderKnight', 'defensive')]), 3_000);
  assert.deepStrictEqual(profile.evolutionStars, {
    cinderKnight: ['cinderKnight-offensive', 'cinderKnight-defensive'],
    rime: ['rime-defensive'],
    valor: ['valor-utility'],
  });
  assert.strictEqual(totalStars(profile), 4);
  assert.strictEqual(starredHeroCount(profile), 3);
});

test('profile: a loss counts as a loss and stars nobody', () => {
  const profile = recordRunEnded(createProfile(), wiped(3, [finished('rime', 'offensive')]), 1_000);
  assert.strictEqual(profile.runsFailed, 1);
  assert.strictEqual(profile.runsCompleted, 0);
  assert.deepStrictEqual(profile.evolutionStars, {});
});

// --- Run history ---

test('profile: every run that ends goes into the history, newest first, win or loss', () => {
  let profile = recordRunEnded(createProfile(), wiped(2, [finished('rime', 'offensive', 9)]), 1_000);
  profile = recordRunEnded(profile, cleared([finished('cinderKnight', 'offensive')]), 2_000);
  assert.strictEqual(profile.runHistory.length, 2);
  assert.strictEqual(profile.runHistory[0].outcome, 'win');
  assert.strictEqual(profile.runHistory[0].endedAt, 2_000);
  assert.strictEqual(profile.runHistory[1].outcome, 'loss');
  assert.strictEqual(profile.runHistory[1].actReached, 2);
  assert.strictEqual(profile.runHistory[1].locationId, 'wildsEdge');
  assert.deepStrictEqual(profile.runHistory[1].roster, [{ heroId: 'rime', level: 9, evolutionPathId: 'rime-offensive' }]);
});

test('profile: a record remembers only the stars that were NEW that run', () => {
  let profile = recordRunEnded(createProfile(), cleared([finished('cinderKnight', 'offensive'), finished('rime', 'defensive')]), 1_000);
  assert.deepStrictEqual(profile.runHistory[0].starsEarned, ['cinderKnight-offensive', 'rime-defensive']);
  profile = recordRunEnded(profile, cleared([finished('cinderKnight', 'offensive'), finished('rime', 'utility')]), 2_000);
  assert.deepStrictEqual(profile.runHistory[0].starsEarned, ['rime-utility'], 'a form already starred adds nothing');
  profile = recordRunEnded(profile, wiped(5, [finished('valor', 'offensive')]), 3_000);
  assert.deepStrictEqual(profile.runHistory[0].starsEarned, [], 'a loss stars nothing');
});

test('profile: a run length is read off the playtime clock between the pact and the end', () => {
  let profile = addPlaytime(createProfile(), 10 * 60_000);
  profile = recordRunStarted(profile, 1_000);
  assert.strictEqual(profile.runStartedAtPlaytimeMs, 10 * 60_000);
  profile = addPlaytime(profile, 42 * 60_000);
  profile = recordRunEnded(profile, wiped(3, []), 2_000);
  assert.strictEqual(profile.runHistory[0].durationMs, 42 * 60_000);
  assert.strictEqual(profile.runStartedAtPlaytimeMs, null, 'the clock is cleared for the next run');
  // A run whose pact was never sealed (a dev test run) carries no length rather than a wrong one.
  profile = recordRunEnded(profile, wiped(1, []), 3_000);
  assert.strictEqual(profile.runHistory[0].durationMs, null);
});

test('profile: the history is capped, and it is the oldest that falls off', () => {
  let profile = createProfile();
  for (let i = 1; i <= RUN_HISTORY_CAP + 5; i++) profile = recordRunEnded(profile, wiped(1, []), i);
  assert.strictEqual(profile.runHistory.length, RUN_HISTORY_CAP);
  assert.strictEqual(profile.runHistory[0].endedAt, RUN_HISTORY_CAP + 5);
  assert.strictEqual(profile.runHistory[RUN_HISTORY_CAP - 1].endedAt, 6);
});

test('profile: a record is written from a copy, so the run state it came from cannot change it', () => {
  const roster = [finished('rime', 'offensive')];
  const relicIds = ['bannerOfTheBulwark'];
  const profile = recordRunEnded(createProfile(), { ...cleared(roster), relicIds }, 1_000);
  roster[0].level = 1;
  relicIds.push('bannerOfTheWarcry');
  assert.strictEqual(profile.runHistory[0].roster[0].level, 30);
  assert.deepStrictEqual(profile.runHistory[0].relicIds, ['bannerOfTheBulwark']);
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
  recordRunEnded(before, cleared([finished('rime', 'offensive')]), 1);
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
  profile = recordRunEnded(profile, cleared([finished('cinderKnight', 'offensive'), finished('rime', 'utility')]), 2_000);
  profile = addPlaytime(profile, 90_000);
  profile = recordActReached(profile, 5);
  assert.deepStrictEqual(decodeProfile(JSON.parse(JSON.stringify(profile)), knownHeroIds, knownPathIds), profile);
});

test('profile: junk decodes to a fresh profile instead of throwing', () => {
  for (const junk of [null, undefined, 42, 'nope', []]) {
    assert.deepStrictEqual(decodeProfile(junk, knownHeroIds), createProfile());
  }
});

test('profile: a partly broken file keeps every field that survived', () => {
  const decoded = decodeProfile(
    { playtimeMs: 60_000, runsStarted: 'lots', runsCompleted: 3, furthestAct: -4, evolutionStars: 'gone' },
    knownHeroIds
  );
  assert.strictEqual(decoded.playtimeMs, 60_000, 'a readable field beside a broken one is kept');
  assert.strictEqual(decoded.runsCompleted, 3);
  assert.strictEqual(decoded.runsStarted, 0, 'the unreadable field falls back, alone');
  assert.strictEqual(decoded.furthestAct, 1, 'an impossible act clamps to the floor');
  assert.deepStrictEqual(decoded.evolutionStars, {});
  assert.strictEqual(decoded.version, PROFILE_VERSION);
});

test('profile: stars for a hero or a path this build no longer ships are dropped, not taken as corruption', () => {
  const decoded = decodeProfile(
    {
      runsCompleted: 2,
      evolutionStars: { rime: ['rime-defensive', 'rime-aPathThatWasCut'], aHeroThatWasCut: ['aHeroThatWasCut-offensive'] },
    },
    knownHeroIds,
    knownPathIds
  );
  assert.deepStrictEqual(decoded.evolutionStars, { rime: ['rime-defensive'] });
  assert.strictEqual(decoded.runsCompleted, 2, 'the rest of the profile survives the dropped entry');
});

test('profile: a junk or repeated path is not stored, and a hero left with nothing has no entry', () => {
  const decoded = decodeProfile(
    { evolutionStars: { rime: [0, '', null], valor: 'valor-utility', cinderKnight: ['cinderKnight-offensive', 'cinderKnight-offensive'] } },
    knownHeroIds
  );
  assert.deepStrictEqual(decoded.evolutionStars, { cinderKnight: ['cinderKnight-offensive'] });
});

test('profile: the pre-2026-09-16 run-count stars are not carried over — a count names no path', () => {
  const decoded = decodeProfile({ runsCompleted: 3, heroStars: { rime: 2, cinderKnight: 1 } }, knownHeroIds);
  assert.deepStrictEqual(decoded.evolutionStars, {});
  assert.strictEqual(decoded.runsCompleted, 3);
});

test('profile: a history line with no outcome is dropped; a readable one keeps what it can', () => {
  const decoded = decodeProfile(
    {
      runHistory: [
        { outcome: 'draw', actReached: 2 },
        'nope',
        {
          outcome: 'loss',
          actReached: 3,
          endedAt: 'yesterday',
          durationMs: -4,
          roster: [{ heroId: 'rime', level: 'high', evolutionPathId: 'rime-aPathThatWasCut' }, { level: 4 }, { heroId: 'goblin', level: 2 }],
          relicIds: ['bannerOfTheBulwark', 7],
          starsEarned: ['rime-offensive', 'rime-aPathThatWasCut'],
        },
      ],
    },
    knownHeroIds,
    knownPathIds
  );
  assert.strictEqual(decoded.runHistory.length, 1);
  const [record] = decoded.runHistory;
  assert.strictEqual(record.endedAt, 0);
  assert.strictEqual(record.durationMs, null);
  assert.deepStrictEqual(record.roster, [
    { heroId: 'rime', level: 1, evolutionPathId: null },
    // A companion's body is not a recruitable hero, and it still finished the run.
    { heroId: 'goblin', level: 2, evolutionPathId: null },
  ]);
  assert.deepStrictEqual(record.relicIds, ['bannerOfTheBulwark']);
  assert.deepStrictEqual(record.starsEarned, ['rime-offensive']);
});

test('profile: a history longer than the cap is cut on read, newest kept', () => {
  const runHistory = Array.from({ length: RUN_HISTORY_CAP + 3 }, (_, i) => ({ outcome: 'loss', actReached: 1, endedAt: 1000 - i }));
  const decoded = decodeProfile({ runHistory }, knownHeroIds);
  assert.strictEqual(decoded.runHistory.length, RUN_HISTORY_CAP);
  assert.strictEqual(decoded.runHistory[0].endedAt, 1000);
});

test('profile: every path in the game is a star, and every hero has exactly three', () => {
  for (const heroId of Object.keys(heroes)) {
    const paths = (progressionTable.evolutions[heroId] ?? []).flatMap((node) => node.paths);
    assert.strictEqual(paths.length, 3, `${heroId} should have three Evolution paths — three stars`);
    for (const path of paths) assert.strictEqual(path.heroId, heroId, `${path.id} is filed under the wrong hero`);
  }
});
