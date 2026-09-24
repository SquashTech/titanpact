// First-time tips — CONTENT. Mechanism is src/run/tips.ts; design notes are docs/tutorial.md.
//
// EDITING THIS FILE
//   - Tips are plain game-UI text, not dialogue: nobody is speaking, so no "we", no in-world
//     voice. Say what the thing is and what the player does with it, then stop.
//   - Keep a page to one or two short sentences. A tip that needs a fourth page is two tips.
//   - `SCREEN_TIPS` keys are the ids App.tsx asks for (`SCREEN_TIP_IDS` in run/tips.ts); a
//     test fails if either side has an id the other does not.
//   - `FIGHT_TIPS` are checked at the top of every command phase. Order is priority order.
//   - A page may print a move-kind icon inline: `[physical]`, `[magical]`, `[heal]`, `[buff]`,
//     `[debuff]`. A misspelt token prints literally and fails `test/tips.test.ts`.

import type { FightTip, ScreenTipId, Tip } from '../run/tips';

/**
 * The one piece of lore, ahead of the first draft on an account: one line a tap. Everything else
 * the run says about itself it says in its own beats (the cold open, the arrival, the seal).
 */
export const LORE_LINES: readonly string[] = [
  'A Titan cannot be killed.',
  'It can only be put to sleep for 1,000 years.',
  'Our time is up.',
  'We must seal the pact.',
];

function tip(id: string, title: string, ...pages: string[]): Tip {
  return { id, title, pages };
}

export const SCREEN_TIPS: Readonly<Record<ScreenTipId, Tip>> = {
  draft: tip('draft', 'Starting Heroes', 'Pick two heroes to start the run. More join along the way.'),
  run: tip(
    'run',
    'The Journey',
    "Venture forth to defeat five Guardians of the Titan's Seal.",
    'If all your heroes fall, the journey is over.'
  ),
  map: tip(
    'map',
    'The Map',
    'Choose where to go next. Every path has the same number of fights and ends at the Guardian.',
    'Hold a node to see what it is.'
  ),
  wounds: tip(
    'wounds',
    'Wounds',
    'HP carries over from fight to fight within an act. Mana refills at the start of every fight.',
    'A knocked-out hero sits out until healed: at a Rest, the Guild Hall, with a Revive, or when the act ends.'
  ),
  fork: tip(
    'fork',
    'Elite or Skirmish',
    'Both fights are against other heroes you can recruit afterwards. The tile shows the types they field.',
    'The Elite is a level higher, always drops an item, and pays more XP.'
  ),
  squad: tip(
    'squad',
    'Lead Order',
    'Your whole roster fights. Set the order: the first two start on the field, the rest wait on the bench.'
  ),
  levelUp: tip(
    'levelUp',
    'Level Up',
    'Every won fight gives XP to the whole roster, benched heroes included.',
    "Each level rolls every stat against the hero's growth grades. Some levels also offer a new move — take it or skip it; it won't be offered again."
  ),
  item: tip(
    'item',
    'Items',
    "Choose which hero gets this item. Once given, it can't be moved.",
    'Each hero holds three. Giving a hero a second item of the same kind merges them into a stronger one.',
    'Or sell it for gold if nobody wants it.'
  ),
  companion: tip(
    'companion',
    'Companion',
    'A Titanspawn you beat has joined you. It fights and levels like any hero.',
    "If it's knocked out, it's gone for the rest of the run."
  ),
  fallen: tip(
    'fallen',
    'Permadeath',
    'Heroes knocked out in that fight are lost, along with their items — unless you spend a Revive on them now.'
  ),
  equipmentReward: tip('equipmentReward', 'Equipment', 'Choose one of three items. Hold an item to read it in full.'),
  tutor: tip(
    'tutor',
    'Tutor',
    "Choose a hero. It learns a random Late-tier move from its own move list. If its moves are full, replace one or pass."
  ),
  boon: tip('boon', 'Boon', 'Choose one of three passives and give it to a hero. It keeps it for the rest of the run.'),
  manaWell: tip('manaWell', 'Mana Well', 'Choose a hero to gain +30 max Mana for the rest of the run.'),
  leyLine: tip(
    'leyLine',
    'Ley Line',
    "Choose a hero to gain +10 Elemental Force for the rest of the run. Its moves of its own primary type hit harder."
  ),
  rest: tip('rest', 'Rest', 'Every hero is fully healed, and knocked-out heroes get back up.'),
  event: tip('event', 'Event', 'Something unusual. Read what it offers before you choose.'),
  scribe: tip(
    'scribe',
    'Mastery Scrolls',
    'Choose two heroes. Each gets 2 Mastery Scrolls.',
    'At 5 Scrolls a hero Evolves into a new form. At 10 it learns its signature move.'
  ),
  scrollCache: tip(
    'scrollCache',
    'Scroll Cache',
    'Split 3 Mastery Scrolls between your heroes however you like. At 5 a hero Evolves; at 10 it learns its signature move.'
  ),
  shop: tip(
    'shop',
    'Guild Hall',
    'Spend gold on new heroes, Recruit Contracts, Mastery Scrolls, potions and Revives. Mend heals your whole roster.',
    'The Smithy tab upgrades and enchants the items your heroes hold.'
  ),
  recruit: tip(
    'recruit',
    'Recruit Contract',
    'Spend a contract to add a defeated enemy to your roster. It joins at its level, with its moves and its item.',
    'Your roster holds six. Past that, someone has to leave — and their items leave with them.'
  ),
  banner: tip('banner', 'Banner', 'Choose one Banner. It boosts your whole team for the rest of the run. Banners stack.'),
  crucible: tip(
    'crucible',
    'Crucible',
    'Choose one hero to take a Class: a new move or passive. One per hero, and it is permanent.'
  ),
  seal: tip(
    'seal',
    'Seal Broken',
    'One seal down. Break all five, then face the finale.',
    'Your heroes are fully healed between acts.'
  ),
  locationChoice: tip(
    'locationChoice',
    'Next Act',
    'Choose where the next act takes place. Each place is home to different types of Titanspawn.'
  ),
};

/** Checked at the top of every command phase; the first unseen one whose conditions all hold is shown. */
export const FIGHT_TIPS: readonly FightTip[] = [
  {
    id: 'fight.basics',
    title: 'Combat',
    when: {},
    pages: [
      'Each round, choose a move and a target for both heroes on the field. Then the round plays out, fastest first.',
      'Moves cost Mana. Everyone regains a little each round.',
      'Tap a fighter to read it. The small figures across the top show the turn order, left to right. Hold a move to read it before you choose.',
    ],
  },
  {
    id: 'fight.types',
    title: 'Types',
    when: { minRound: 2 },
    pages: [
      "The number on a move is how well it hits the target's type: above 1 is strong, below 1 is resisted. A move matching its user's own type deals 25% more.",
      '[physical] Physical moves use Attack against Defense. [magical] Magical moves use Intelligence against Wisdom.',
    ],
  },
  {
    id: 'fight.rest',
    title: 'Rest',
    when: { outOfMana: true },
    pages: ["Out of Mana. Rest skips the hero's turn but refills all of its Mana."],
  },
  {
    id: 'fight.guardian',
    title: 'Guardian',
    when: { nodeTypes: ['boss'] },
    pages: ['The Guardian waits on the bench. It steps in as soon as one of its escorts falls.'],
  },
  {
    id: 'fight.ancient',
    title: 'Ancient',
    when: { enemyTypeOnField: 'Ancient' },
    pages: ['Ancient resists every type: damage against it is halved. A move strong against its other type only breaks even.'],
  },
  {
    id: 'fight.bench',
    title: 'Bench',
    when: { benchHeld: true, minRound: 2 },
    pages: [
      'Benched heroes regain Mana every round. Switching a hero out uses its turn.',
      "Once half your side has been knocked out, you can't switch anymore.",
    ],
  },
  {
    id: 'fight.bag',
    title: 'Bag',
    when: { minRound: 3 },
    pages: ["The Bag holds your potions. Drinking one doesn't cost a turn."],
  },
  {
    id: 'fight.knockout',
    title: 'Knocked Out',
    when: { playerKnockedOut: true },
    pages: ['A knocked-out hero stays down after the fight, until a Rest, the Guild Hall, a Revive, or the end of the act.'],
  },
  {
    id: 'fight.lockIn',
    title: 'Locked In',
    when: { lockedIn: true },
    pages: ["Half your side is down. You can no longer switch — only replace a fallen hero."],
  },
  {
    id: 'fight.field',
    title: 'Field Effect',
    when: { fieldEffectActive: true },
    pages: ['A Field Effect changes the rules for everyone for 5 rounds. Tap it to read it.'],
  },
  {
    id: 'fight.pactClock',
    title: 'Pact Clock',
    when: { pactClockNear: true },
    pages: ['This fight is running long. From round 30, everyone on the field loses a growing share of max HP each round. End it.'],
  },
];
