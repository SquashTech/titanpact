// The Mentor (src/run/mentor.ts, docs/mentor.md): a lump of XP onto one hero, growing by act,
// sized so a hero that commits to it can finish the run at the level cap.

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import {
  MAX_LEVEL,
  MVP_XP_SHARE,
  TOTAL_ENCOUNTERS,
  applySeededXp,
  encounterXpForAct,
  levelForXp,
  levelOf,
  xpAfterEncounters,
  xpForLevel,
} from '../src/run/growth';
import { MENTOR_XP_BY_ACT, canTrain, mentorXpFor } from '../src/run/mentor';
import { addRosterEntry, createRosterEntry, createRunState } from '../src/run/state';

test('mentor: XP, not levels — the grant grows by act and a hero behind par climbs further', () => {
  assert.deepStrictEqual([1, 2, 3].map(mentorXpFor), [...MENTOR_XP_BY_ACT]);
  assert.ok(MENTOR_XP_BY_ACT.every((xp, i) => i === 0 || xp > MENTOR_XP_BY_ACT[i - 1]));
  const behind = levelForXp(xpForLevel(6) + mentorXpFor(2)) - 6;
  const ahead = levelForXp(xpForLevel(12) + mentorXpFor(2)) - 12;
  assert.ok(behind > ahead, 'the cube lifts the hero further down it further');
});

test('mentor: a committed hero can reach the cap — every Mentor, every Elite and an MVP an act from Act 2', () => {
  const beforeFinale = xpAfterEncounters(TOTAL_ENCOUNTERS - 1);
  const mentors = MENTOR_XP_BY_ACT.reduce((sum, xp) => sum + xp, 0);
  const elites = [1, 2, 3, 4].reduce((sum, act) => sum + Math.round(encounterXpForAct(act) * 0.5), 0);
  const mvps = [2, 3, 4].reduce((sum, act) => sum + Math.round(encounterXpForAct(act) * MVP_XP_SHARE), 0);
  assert.ok(levelForXp(beforeFinale + mentors) < MAX_LEVEL, 'the Mentor alone does not reach it');
  assert.strictEqual(levelForXp(beforeFinale + mentors + elites + mvps), MAX_LEVEL);
});

test('mentor: the grant lands on one hero with its report line, and a hero at the cap is refused', () => {
  let run = addRosterEntry(createRunState(0), createRosterEntry('cinderKnight', 'cinderKnight', heroes.cinderKnight.moveIds));
  run = addRosterEntry(run, createRosterEntry('rime', 'rime', heroes.rime.moveIds));
  const { run: next, line } = applySeededXp(run, heroes, 'cinderKnight', mentorXpFor(1), 7);
  assert.strictEqual(next.roster[0].xp, run.roster[0].xp + mentorXpFor(1));
  assert.strictEqual(next.roster[1].xp, run.roster[1].xp, 'nobody else');
  assert.strictEqual(line.toLevel, levelOf(next.roster[0]));
  assert.ok(Object.keys(line.gained).length > 0, 'the levels rolled growth');
  assert.ok(!canTrain({ xp: xpForLevel(MAX_LEVEL) }));
});
