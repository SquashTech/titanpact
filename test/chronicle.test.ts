// The Chronicle (src/run/chronicle.ts): the Cycle tapestry's captions and its weave-once beat.

import * as assert from 'assert';
import { test } from './harness';
import { chronicleBand, chronicleLines, chronicleWovenTipId, pendingWeave } from '../src/run/chronicle';
import { createProfile, type RunRecord } from '../src/run/profile';

function win(cycle: number, heroIds: string[], endedAt: number): RunRecord {
  return {
    outcome: 'win',
    endedAt,
    durationMs: null,
    actReached: 5,
    locationId: null,
    encountersWon: 13,
    cycle,
    roster: heroIds.map((heroId) => ({ heroId, level: 24, evolutionPathId: null })),
    starsEarned: [],
    clearBonus: 0,
  };
}

const NAMES: Record<string, string> = { a: 'Ash', b: 'Bell', c: 'Cove' };
const nameOf = (id: string) => NAMES[id];

test('chronicle: a cleared Cycle is captioned with its FIRST win, oldest record in a newest-first history', () => {
  const profile = { ...createProfile(), cyclesCleared: 2, runHistory: [win(2, ['c'], 3), win(2, ['a', 'b'], 2), win(1, ['a', 'b', 'c'], 1)] };
  const lines = chronicleLines(profile, nameOf);
  assert.strictEqual(lines[1], 'The first year. Ash, Bell and Cove sealed the Titan, and stayed to hold its seals.');
  assert.strictEqual(lines[2], 'The second year. Ash and Bell sealed it again.');
  assert.strictEqual(lines[3], undefined);
});

test('chronicle: a Cycle whose record has aged out of the history still gets a line', () => {
  const lines = chronicleLines({ ...createProfile(), cyclesCleared: 2 }, nameOf);
  assert.strictEqual(lines[2], 'The second year. The Titan was sealed again.');
});

test('chronicle: the Wardens stand in the first panel, else the first Cycle I win band', () => {
  const history = [win(1, ['b'], 2), win(1, ['a', 'c'], 1)];
  assert.deepStrictEqual(chronicleBand({ runHistory: history, wardens: [] }).map((h) => h.heroId), ['a', 'c']);
  const warden = { heroId: 'b', sealId: 'wildsEdge', pathId: 'b-x', moveIds: [], classId: null, itemIds: [] };
  assert.deepStrictEqual(chronicleBand({ runHistory: history, wardens: [warden] }), [{ heroId: 'b', pathId: 'b-x' }]);
});

test('chronicle: the newest cleared Cycle weaves once, and nothing weaves before a clear', () => {
  assert.strictEqual(pendingWeave({ cyclesCleared: 0, seenTipIds: [] }), undefined);
  assert.strictEqual(pendingWeave({ cyclesCleared: 2, seenTipIds: [chronicleWovenTipId(1)] }), 2);
  assert.strictEqual(pendingWeave({ cyclesCleared: 2, seenTipIds: [chronicleWovenTipId(2)] }), undefined);
});
