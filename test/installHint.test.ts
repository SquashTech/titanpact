import * as assert from 'assert';
import { test } from './harness';
import { INSTALL_CARD } from '../src/data/tips';
import { installPlatform } from '../src/run/installHint';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';
const INSTAGRAM = `${IPHONE} Instagram 340.0.0.0`;
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const at = (userAgent: string, maxTouchPoints = 5, standalone = false) => installPlatform({ userAgent, maxTouchPoints, standalone });

test('install card: each phone gets its own instructions', () => {
  assert.strictEqual(at(IPHONE), 'ios');
  assert.strictEqual(at(IPAD), 'ios', 'an iPad reports itself as a Mac with a touchscreen');
  assert.strictEqual(at(ANDROID), 'android');
  assert.strictEqual(at(INSTAGRAM), 'inApp');
});

test('install card: none on a desktop or once installed', () => {
  assert.strictEqual(at(WINDOWS, 0), null);
  assert.strictEqual(at(IPAD, 0), null, 'a Mac without touch is a Mac');
  assert.strictEqual(at(IPHONE, 5, true), null);
  assert.strictEqual(at(ANDROID, 5, true), null);
});

test('install card: every step glyph is a known token', () => {
  for (const card of Object.values(INSTALL_CARD)) {
    for (const step of card.steps) {
      const unknown = [...step.matchAll(/\[([a-zA-Z]+)\]/g)].map((m) => m[1]).filter((t) => t !== 'share' && t !== 'menu');
      assert.deepStrictEqual(unknown, [], step);
    }
  }
});
