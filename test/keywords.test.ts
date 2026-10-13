// Trigger keywords (src/run/keywords.ts): a passive's badge is read off its hook, so its sentence
// must not spell the trigger out again, and no sentence may spell out a trigger a badge covers.

import * as assert from 'assert';
import { test } from './harness';
import { passives } from '../src/data/passives';
import { passiveKeywordOf, passiveKeywordLabel, reactionKeywordOf } from '../src/run/keywords';
import { triggerKeywords } from '../src/data/keywords';
import type { PassiveDefinition } from '../src/engine/content';

const SPELLED_OUT = [
  /When this hero (enters|switches out|Rests|is healed|takes damage|takes a hit|is hit|lands|hits|knocks)/,
  /When an enemy hits this hero/,
  /^At the end of (each|every)/,
  /The first time (this hero|each fight)/,
  /Every (\w+ )?(attack|hit) this hero lands/,
];

function alsoKeyword(def: PassiveDefinition) {
  return def.alsoReactive ? reactionKeywordOf(def.alsoReactive) : undefined;
}

test('keywords: no passive sentence spells out a trigger a badge stands for', () => {
  for (const def of Object.values(passives)) {
    if (!passiveKeywordOf(def) && !alsoKeyword(def)) continue;
    for (const pattern of SPELLED_OUT) assert.ok(!pattern.test(def.description), `${def.id}: "${def.description}" spells out ${pattern}`);
  }
});

test('keywords: every keyword trigger clause in a sentence has a badge behind it', () => {
  for (const def of Object.values(passives)) {
    if (passiveKeywordOf(def)) continue;
    assert.ok(!/^When this hero (enters the battlefield|switches out|Rests|lands an attack|takes damage),/.test(def.description), `${def.id} reads as a keyword trigger but derives none`);
  }
});

test('keywords: a {trigger} or {also} token stands only where its reaction has a keyword', () => {
  for (const def of Object.values(passives)) {
    const tokens = def.description.match(/\{(\w+)\}/g) ?? [];
    for (const token of tokens) {
      if (token === '{trigger}') assert.ok(passiveKeywordOf(def), `${def.id}: {trigger} with no keyword`);
      else if (token === '{also}') assert.ok(alsoKeyword(def), `${def.id}: {also} with no second keyword`);
      else assert.fail(`${def.id}: unknown token ${token}`);
    }
  }
});

test('keywords: the badge reads the element or pipeline an On Hit is narrowed to', () => {
  const swell = passiveKeywordOf(passives.swell)!;
  assert.strictEqual(passiveKeywordLabel(swell, triggerKeywords[swell.id].name), 'On Physical Hit');
  const rekindle = passiveKeywordOf(passives.rekindle)!;
  assert.strictEqual(passiveKeywordLabel(rekindle, triggerKeywords[rekindle.id].name), 'On Fire Hit');
  assert.strictEqual(passiveKeywordOf(passives.grief)?.once, true);
  assert.strictEqual(passiveKeywordOf(passives.bellTolls)?.everyNRounds, 3);
  assert.strictEqual(passiveKeywordOf(passives.feast)?.id, 'takedown');
});
