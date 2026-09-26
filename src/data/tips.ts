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
  draft: tip('draft', 'Starting Heroes', 'Pick two heroes from the row at the bottom to start the run. More join along the way.'),
  run: tip(
    'run',
    'The Journey',
    "Venture forth to defeat five Guardians of the Titan's Seal.",
    'If all your heroes fall, the journey is over.'
  ),
  map: tip(
    'map',
    'The Map',
    'Tap one of the nodes ahead to go there.',
    'The track across the top is the whole act. Every path has the same number of fights, and every one ends at the Guardian.',
    'Hold a node to see what it is.'
  ),
  wounds: tip(
    'wounds',
    'Wounds',
    'HP carries over from fight to fight within an act. Mana refills between fights.',
    'A knocked-out hero cannot battle. They can rise again at a Rest site, healing at the Guild Hall, using a Revive, or by making it to the next Act.'
  ),
  fork: tip(
    'fork',
    'Elite or Skirmish',
    'The Elite on the left is a level higher, always drops an item, and pays more XP.'
  ),
  squad: tip(
    'squad',
    'Pick Your Leads',
    'Tap two heroes to lead the fight. The rest wait on the bench.'
  ),
  levelUp: tip(
    'levelUp',
    'Level Up',
    'Every won fight gives XP to the whole roster, benched heroes included.'
  ),
  item: tip(
    'item',
    'Items',
    "Choose which hero gets this item. They will keep it for the whole journey.",
    'Each hero holds three. Giving a hero a second item of the same kind merges them into a stronger one.',
    'You can sell it for gold if nobody wants it.'
  ),
  fallen: tip(
    'fallen',
    'Permadeath',
    'Spend a Revive to keep any fallen heroes. Otherwise, they are gone forever.'
  ),
  equipmentReward: tip('equipmentReward', 'Equipment', 'Choose one of these three items. Hold an item to read it in full.'),
  boon: tip('boon', 'Boon', 'Choose one of these three passives, then the hero to give it to. It keeps it for the rest of the run.'),
  manaWell: tip('manaWell', 'Mana Well', 'Choose a hero to gain +30 max Mana for the rest of the run.'),
  rest: tip('rest', 'Rest', 'Every hero is fully healed, and knocked-out heroes get back up.'),
  event: tip('event', 'Event', 'Something unusual. Read what it offers before you choose.'),
  scribe: tip(
    'scribe',
    'Mastery Scrolls',
    'Choose two heroes. Each gets 2 Mastery Scrolls.',
    'At 5 Scrolls, a hero Evolves into a new form. At 10, their innate powers will grow.'
  ),
  shop: tip(
    'shop',
    'Guild Hall',
    'The Shop sells Recruit Contracts, Mastery Scrolls, potions and Revives for gold. Mend heals your whole roster.',
    'The Tavern hires new heroes.',
    'The Smithy upgrades and enchants the items your heroes hold.'
  ),
  recruit: tip(
    'recruit',
    'Recruit Contract',
    'Spend a contract to add a defeated enemy to your roster. It joins at its level, with its moves and its item.',
    'Your roster holds six. Past that, you must choose a hero to leave the party.'
  ),
  banner: tip('banner', 'Banner', 'Choose one Banner. It boosts your whole team for the rest of the run. Banners stack.'),
  crucible: tip(
    'crucible',
    'Crucible',
    'Classes teach heroes powerful new abilities or moves within their type. Each hero can learn only one.'
  ),
  locationChoice: tip(
    'locationChoice',
    'Next Act',
    'Choose where the next act takes place. Each place is home to different types of Titanspawn and Heroes.'
  ),
};

/**
 * Checked at the top of every command phase; the first unseen one whose conditions all hold is
 * shown. Each page names ONE thing on screen, and TipOverlay lights it (src/view/run/tipStaging.ts
 * says which) — so a page says "the number beside each enemy's name", never "the number".
 */
export const FIGHT_TIPS: readonly FightTip[] = [
  {
    id: 'fight.basics',
    title: 'Combat',
    when: {},
    pages: [
      'Each round, choose a move and a target for both heroes on the field. Then the round plays out in Speed order.',
      'Moves cost Mana. Everyone regains some each round. Heroes can choose to Rest to recover all Mana. Sometimes, Rest will be the only option.',
      'Tap a fighter or hold down on a move to read more information about them.',
    ],
  },
  {
    id: 'fight.skirmish',
    title: 'Skirmish',
    when: { nodeTypes: ['skirmish', 'elite'] },
    pages: [
      'Skirmishes are fights against other heroes attempting to stop the Titan. If you win, you can use a Contract to recruit one to your party.',
    ],
  },
  {
    id: 'fight.switching',
    title: 'Switching',
    when: { benchHeld: true },
    pages: [
      "Switch swaps a hero on the field for one waiting on your bench. The swap happens before anyone moves, and uses that hero's turn.",
      "Switch out a hero that is hurt, out of Mana, or weak to the enemy's types. Benched heroes regain Mana every round, so it comes back ready.",
      "Once half your side has been knocked out, you can't switch anymore.",
    ],
  },
  {
    id: 'fight.types',
    title: 'Types',
    when: { minRound: 2 },
    pages: [
      "The number on a move is how well it hits the target's type: above 1 is strong, below 1 is resisted.",
      "The icon before a move's name is its type. A move that shares a type with the hero using it deals 25% more.",
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
    id: 'fight.ancient',
    title: 'Ancient',
    when: { enemyTypeOnField: 'Ancient' },
    pages: [
      'Every Guardian is Ancient. Ancient resists every type: every hit on it is halved.',
      "A move strong against its other type only breaks even (1×); anything else hits it for half. The number beside its name on each move shows which.",
      'Ancient moves are resisted by nothing: every hit lands at full strength on every type.',
    ],
  },
  {
    id: 'fight.pactClock',
    title: 'One Last Thing',
    when: { nodeTypes: ['boss'] },
    pages: [
      'Fights cannot last forever. From round 30 the Pact Clock strikes: everyone on the field loses a growing share of max HP every round.',
      'The side that is ahead still wins. Only a stall loses — so press the Guardian, and end it.',
    ],
  },
  {
    id: 'fight.bag',
    title: 'Bag',
    when: { minRound: 3 },
    pages: ["The Bag holds your potions. Drinking one doesn't use a turn."],
  },
  {
    id: 'fight.knockout',
    title: 'Knocked Out',
    when: { playerKnockedOut: true },
    pages: ['A knocked-out hero stays down after the fight, until a Rest, the Guild Hall, a Revive, or the end of the act.'],
  },
  {
    id: 'fight.field',
    title: 'Field Effect',
    when: { fieldEffectActive: true },
    pages: ['A Field Effect is up. It changes the rules for everyone until its pips run out; tap it to read it.'],
  },
];
