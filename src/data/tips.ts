// First-time tips — CONTENT. Mechanism is src/run/tips.ts; design notes are docs/tutorial.md.
//
// EDITING THIS FILE
//   - Tips are plain game-UI text, not dialogue: nobody is speaking, so no "we", no in-world
//     voice. Say what the thing is and what the player does with it, then stop.
//   - Keep a page to one or two short sentences. A tip that needs a fourth page is two tips.
//   - `SCREEN_TIPS` keys are the ids App.tsx asks for (`SCREEN_TIP_IDS` in run/tips.ts); a
//     test fails if either side has an id the other does not.
//   - `FIGHT_TIPS` are checked at the top of every command phase. Order is priority order.
//   - A page may print a move row's own mark inline: the kinds `[physical]`, `[magical]`, `[heal]`,
//     `[buff]`, `[debuff]`; the arrows `[super]`, `[resist]`; the seats' bars `[single]`, `[spread]`,
//     `[random]`; the figures `[self]`, `[ally]`, `[foe]`. A misspelt token prints literally and
//     fails `test/tips.test.ts`.

import type { InstallPlatform } from '../run/installHint';
import type { FightTip, ModesOpenPage, ScreenTipId, Tip } from '../run/tips';

/**
 * The one piece of lore, ahead of the first draft on an account, under the fall (TitanFallScreen,
 * docs/lore.md "The fall"): one line a tap. Everything else the run says about itself it says in its
 * own beats (the arrival, the seal).
 */
export const LORE_LINES: readonly string[] = ['One day, pure calamity fell upon our land.', 'We must seal the pact.'];

function tip(id: string, title: string, ...pages: string[]): Tip {
  return { id, title, pages };
}

export const SCREEN_TIPS: Readonly<Record<ScreenTipId, Tip>> = {
  bench: tip(
    'bench',
    'Your Bench',
    'The enemy sends out its leads first. Tap two heroes to answer them. The rest wait on the bench, regaining Mana every round.',
    'A green arrow means that hero has the type advantage over the enemy above it. A red arrow means the enemy has it.',
    "Switch swaps in a benched hero before anyone moves, using that hero's turn. Once half your side is knocked out, you can't switch anymore."
  ),
  item: tip(
    'item',
    'Items',
    'Choose which hero gets this item. They will keep it for the whole journey.',
    'Each hero holds three. Giving a hero a second item of the same kind merges them into a stronger one.',
    'You can sell it for gold if nobody wants it.'
  ),
};

/**
 * Checked at the top of every command phase; the first unseen one whose conditions all hold is
 * shown. A page may carry a staged picture (src/data/tipScenes.ts) with ONE thing ringed, so the
 * words name that thing — "a move's arrows", never "the number".
 */
export const FIGHT_TIPS: readonly FightTip[] = [
  {
    id: 'fight.basics',
    title: 'Combat',
    when: {},
    pages: [
      'Each round, choose a move and a target for both heroes on the field. Then the round plays out in Speed order.',
      'A move costs the Mana in its gem, paid from the blue bar. Everyone regains some each round, and Rest recovers all of it.',
      "The arrows under a move's number show how it hits each enemy: [super] double, [resist] half. [single] hits one enemy, [spread] hits both. Hold a move to read what it does.",
    ],
  },
];

/**
 * The title's beat after the first Cycle I win (run/tips.ts `modesOpenDue`): the caption over the
 * doors' arrival, then one window a mode, each over a picture of that mode's own screen.
 */
export const MODES_OPEN_CAPTION = 'Two New Ways to Play';

export const MODES_OPEN_PAGES: readonly ModesOpenPage[] = [
  {
    mode: 'trials',
    word: 'Trials',
    line: "Build a team of six from heroes you've won with, at full strength, choosing every Evolution, move and item. Beat fourteen teams, one of each type, for stars.",
  },
  {
    mode: 'gauntlet',
    word: 'Gauntlet',
    line: 'Draft six heroes you own, one of three at a time, each in a random Evolution. Win five fights before you lose two, and every new Evolution on your team earns its star.',
  },
];

/**
 * The first-launch install card (run/installHint.ts), per platform. `steps` are numbered; a
 * `[share]` or `[menu]` token prints the browser's own glyph. Android's `steps` are the fallback
 * for a browser that never offered its install dialog — when it does, the card is one button.
 */
export const INSTALL_CARD: Readonly<Record<InstallPlatform, { title: string; lead: string; steps: readonly string[]; note?: string }>> = {
  ios: {
    title: 'Welcome to Titanpact!',
    lead: 'Titanpact plays best installed as a full screen app.',
    steps: ['Tap [share] Share in the browser bar.', 'Scroll down and tap Add to Home Screen.', 'Open Titanpact from the new icon.'],
    note: "Progress in the browser doesn't carry over to the Home Screen app, so add it before you play.",
  },
  android: {
    title: 'Welcome to Titanpact!',
    lead: 'Titanpact plays best installed as a full screen app.',
    steps: ['Tap [menu] at the top right of the browser.', 'Tap Install app or Add to Home screen.', 'Open Titanpact from the new icon.'],
  },
  inApp: {
    title: 'Welcome to Titanpact!',
    lead: "This page is open inside another app, which can't save Titanpact to your home screen.",
    steps: ['Tap [menu] or [share] in this app.', 'Choose Open in browser (Safari or Chrome).'],
  },
};
