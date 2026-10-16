// The Reference's How to Play page — CONTENT (docs/tutorial.md §6). The rules in full, for the
// player who goes looking; nothing raises it. Same voice and tokens as the tips (src/data/tips.ts),
// one paragraph a page. A section's pictures are keyed by its id in src/data/tipScenes.ts.

import type { Tip } from '../run/tips';

function section(id: string, title: string, ...pages: string[]): Tip {
  return { id: `howto.${id}`, title, pages };
}

export const HOW_TO_PLAY: readonly Tip[] = [
  section(
    'journey',
    'The Journey',
    "Each act ends with a Guardian. Defeat all four to lock the four rings of the Titan's Seal, then win one last fight.",
    'If all your heroes fall, the journey is over.'
  ),
  section(
    'map',
    'The Map',
    'Tap one of the places ahead to read what happens there. Tap it again, or press its button, to go.',
    'The track across the top shows the way to the Guardian, and the number beside it how many stops are left before it.',
    'At the fork, an Elite is a level above a Skirmish, always drops an item, and pays more XP.'
  ),
  section(
    'combat',
    'Combat',
    'Each round, choose a move and a target for both heroes on the field. Then the round plays out in Speed order.',
    'Tap a fighter to read about it. Hold a move to read what it does.'
  ),
  section(
    'mana',
    'Mana and Rest',
    'A move costs the Mana in its gem, paid from the blue bar. Everyone regains some each round.',
    "A hero out of Mana can Rest: it skips the hero's turn but refills all of its Mana."
  ),
  section(
    'types',
    'Types',
    "The arrows under a move's number show how it hits each enemy, in the order they stand: [super] double, [resist] half, two arrows four times or a quarter.",
    "The icon before a move's name is its type. A move that shares a type with the hero using it deals 25% more."
  ),
  section(
    'targets',
    'Who a Move Hits',
    'The bars under the arrows show who an attack hits. [single] One enemy, the one you pick. [spread] Both enemies. [random] One enemy, at random.',
    'Figures show who a move or an effect reaches: [self] the hero using it, [ally] your side, [foe] an enemy. A figure in front of an effect says who gets it.',
    'A move that hits everyone also shows [ally]: it hits your partner too.'
  ),
  section(
    'kinds',
    'Kinds of Move',
    '[physical] Physical moves use Attack against Defense. [magical] Magical moves use Intelligence against Wisdom.',
    "[buff] Buffs raise a stat for the rest of the fight. [debuff] Debuffs lower an enemy's."
  ),
  section(
    'stages',
    'Raised and Lowered',
    'An arrow beside a stat means it was raised or lowered in this fight. Arrows stay through a switch.',
    '[stages]',
    'A passive works on its own, and affects each hero at most once a round.'
  ),
  section(
    'bench',
    'Leads and Switching',
    'The enemy sends out its leads first. Tap two heroes to answer them. The rest wait on the bench, regaining Mana every round.',
    'A green arrow means that hero has the type advantage over the enemy above it. A red arrow means the enemy has it.',
    "Switch swaps in a benched hero before anyone moves, using that hero's turn. Switch out a hero that is hurt, out of Mana, or weak to the enemy's types.",
    "Once half your side has been knocked out, you can't switch anymore."
  ),
  section(
    'bag',
    'The Bag',
    "The Bag holds your potions. Drinking one doesn't use a turn.",
    "A potion restores half of a hero's HP or Mana.",
    'Potions sometimes drop after a won fight. You can hold three of each.'
  ),
  section(
    'field',
    'Field Effects',
    'A Field Effect changes the rules for everyone until its pips run out. Tap it to read it.',
    'Only one is up at a time. A different one replaces it.'
  ),
  section(
    'companion',
    'Your Companion',
    'After the first fight of a run, one of the creatures you beat joins you as a companion.',
    'When your companion is about to act, it wears a ! and takes a place in the turn order. Tap it to read the move.',
    "It acts on its own, once a fight. It costs no Mana, needs no target, and takes no hero's turn."
  ),
  section(
    'ancient',
    'Ancient',
    'Every Guardian is Ancient. Ancient resists every type: every hit on it is halved.',
    "A move strong against its other type only breaks even (1×); anything else hits it for half. The [super] or [resist] on each move shows which.",
    'Ancient moves are resisted by nothing: every hit lands at full strength on every type.'
  ),
  section(
    'pactClock',
    'The Pact Clock',
    'Fights cannot last forever. From round 30 the Pact Clock strikes: everyone on the field loses a growing share of max HP every round.',
    'The side that is ahead still wins. Only a stall loses.'
  ),
  section(
    'wounds',
    'Wounds',
    'HP carries over from fight to fight within an act. Mana refills between fights.',
    'A knocked-out hero cannot battle. They can rise again by healing at a Rest site or Guild Hall, or by making it to the next act.'
  ),
  section(
    'blessing',
    'Blessings',
    'Your two starting heroes are Blessed. A gold star marks a Blessed hero.',
    'The first time a Blessed hero would be knocked out, the blow is turned aside and the Blessing is used up. Until then, it lasts from fight to fight.'
  ),
  section(
    'levels',
    'Levels and Moves',
    'Every hero on your roster gains XP from each won fight, benched heroes included.',
    "Each level can raise a hero's stats. Some levels offer a new move: take it or pass. A hero knows four moves at most."
  ),
  section(
    'items',
    'Items',
    'An item goes to a hero the moment it arrives.',
    'Each hero holds three. Giving a hero a second item of the same kind merges them into a stronger one.',
    'A hero holding three can replace one with the new item. The old one is lost, with nothing back for it.',
    'You can sell an item for gold if nobody wants it.'
  ),
  section(
    'gems',
    'Gems and Mastery',
    'Tap a hero to set a Gem in it. The stat it raises is theirs for the run.',
    'Every Gem is also a Mastery pip. At 5, a hero Evolves into a new form. At 10, their innate powers grow.'
  ),
  section(
    'recruit',
    'Recruiting',
    'Skirmishes are fights against other heroes who would rather seal the pact themselves.',
    'After a win, spend a Recruit Contract to add one of them to your roster. It joins at its level, with its moves and its item.',
    'Your roster holds six. Past that, you must choose a hero to leave the party.'
  ),
  section(
    'guildHall',
    'The Guild Hall',
    'The Tavern hires heroes for a Recruit Contract. Its bar sells Contracts, a fresh shelf of faces, and a meal that heals your whole roster.',
    'The Gem counter sells single Gems. Pick one, then the hero to set it in.',
    'The Gear counter sells items. Pick one, then the hero to wear it.'
  ),
  section(
    'academy',
    'The Academy',
    'Classes teach heroes powerful new abilities or moves within their type. Each hero can learn only one.',
    'Choose a Class first, then a hero to learn it.'
  ),
  section('banner', 'Banners', 'Beating a Guardian earns a Banner. It boosts your whole team for the rest of the run, and Banners stack.'),
  section(
    'nextAct',
    'The Next Act',
    'Choose where the next act takes place. Each place is home to different types of Titanspawn and heroes.'
  ),
  section(
    'cycles',
    'Cycles',
    'Clearing a run opens the next Cycle, each harder than the last.',
    'From Cycle II, the heroes who sealed the Titan stand beside its Guardians, and the Guardians wake.'
  ),
];
