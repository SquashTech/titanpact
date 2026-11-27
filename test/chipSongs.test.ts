// The chiptune soundtrack's table (src/audio/chipSongs.ts). A bar a step short shifts every bar
// after it, and a bad note only shows up as silence on whichever screen first plays it.

import * as assert from 'assert';
import { test } from './harness';
import { chipSongs, FIGHT_SONGS } from '../src/audio/chipSongs';
import { compileSong } from '../src/audio/chipScore';
import { locations } from '../src/data/locations';

const steps = (bar: string) => bar.trim().split(/\s+/).length;
const list = (p: string | readonly string[]) => (typeof p === 'string' ? [p] : p);

test('chip songs: every bar is sixteen steps and every line spans the chords', () => {
  for (const [id, song] of Object.entries(chipSongs)) {
    assert.strictEqual(song.melody.length, song.chords.length, `${id}: melody bars`);
    if (song.harmony) assert.strictEqual(song.harmony.length, song.chords.length, `${id}: harmony bars`);
    for (const bar of [...song.melody, ...(song.harmony ?? [])]) assert.strictEqual(steps(bar), 16, `${id}: "${bar}"`);
    for (const bar of [...list(song.bass), ...(song.arp ? list(song.arp) : [])]) assert.strictEqual(steps(bar), 16, `${id}: "${bar}"`);
    const kit = song.drums;
    if (kit) {
      const patterns = [...list(kit.kick), ...list(kit.snare), ...list(kit.hat), ...Object.values(kit.fill ?? {})];
      for (const pattern of patterns) assert.strictEqual(pattern.length, 16, `${id}: drum "${pattern}"`);
    }
  }
});

test('chip songs: every note and chord parses', () => {
  for (const [id, song] of Object.entries(chipSongs)) {
    assert.doesNotThrow(() => compileSong(song), `${id} does not compile`);
    assert.ok(compileSong(song).lead.length > 0, `${id} has no melody`);
  }
});

test('chip songs: every place, both placeless screens and the fight themes have one', () => {
  for (const id of [...Object.keys(locations), 'titleScreen', 'starterScreen', ...FIGHT_SONGS]) {
    assert.ok(id in chipSongs, `${id} has no chiptune song`);
  }
});
