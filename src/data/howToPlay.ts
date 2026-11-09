// How to Play — CONTENT (docs/the-sky.md §2c). The book is whole from the start; a First Light
// lesson opens on its own pages, so the rules are written once. Same voice and tokens as the tips
// (src/data/tips.ts); a page's pictures are keyed by its id in tipScenes.ts.
// A page that lists rules lists them: a line opening `- ` is a bullet.

import type { ManualPage } from '../run/manual';
import { statuses } from './statuses';

const MOVE = 'firstLight.move';
const MANA = 'firstLight.mana';
const TYPES = 'firstLight.types';
const SPREAD = 'firstLight.spread';
const KINDS = 'firstLight.kinds';
const BURN = 'firstLight.burn';
const SWITCH = 'firstLight.switch';
const GEAR = 'firstLight.gear';
const GEMS = 'firstLight.gems';
const CONTRACTS = 'firstLight.contracts';
const OPEN = 'firstLight.open';
/** A page about a run, taught by no lesson. */
const RUN = null;

function page(id: string, title: string, lesson: string | null, emblem: readonly string[], ...pages: string[]): ManualPage {
  return { id: `howto.${id}`, title, ...(lesson ? { lesson } : {}), emblem, pages };
}

/** The lesson that teaches a status, where one does. */
const TAUGHT_BY: Readonly<Record<string, string>> = { Burn: BURN };

/** A status's page, in bullets. A status not here reads its own description, a bullet a sentence. */
const STATUS_WORDS: Readonly<Record<string, readonly string[]>> = {
  Burn: [
    '- At each round end: *15%* of max HP, then *8%*, then *4%*, then out.\n- Another Burn lights it again.\n- *Rest*, *switching* or *Cleanse* puts it out.',
  ],
  Poison: [
    "- A *timer*. Its pips fill once a round, and when they are full it goes off: the badge's number, as % of max HP.\n- It only counts down while the hero is *on the field*.",
    '- Another Poison *raises the number*, but never resets the timer.\n- Switching doesn\'t clear it: a benched hero\'s timer just waits.',
  ],
  Bleed: ['- Loses *6%* of max HP at every round end.\n- It lasts until something clears it. Switching doesn\'t.'],
  Freeze: ['- *Halves* the hero\'s Speed.\n- Switching out clears it.'],
  Daze: [
    "- A *Dazed* hero can't attack for the rest of the round.\n- It can still *switch* or *Rest*.",
    '- It only lands if it comes *before* the hero moves: the faster hero dazes.',
  ],
  Renew: ['- Heals *10%* of max HP at each round end, for *3 rounds*.\n- Another Renew sets it back to 3.\n- It stays through switching and Cleanse.'],
  Shield: [
    "- *Extra health* that takes a move's hits before HP does.\n- A hit that empties it *breaks* it.\n- It can't hold more than the hero's max HP.",
    "- *Burn*, *Bleed* and a move's own cost go *straight through* it.",
  ],
  Conduct: [
    '- *Mark* a foe with Conduct [conduct].\n- The next *Storm*, *Iron* or *Mech* hit on it deals *Bonus* damage, and uses up the mark.',
    '- Mark first, strike second: the marker must act *before* the striker.',
  ],
  Barrier: ['- Every move the *other side* aims at this hero turns away, for the rest of the round.\n- Its partner can still reach it.'],
  Provoke: ['- *Single-target* moves aimed at either hero on its side hit this hero instead.\n- *Spread* moves are not pulled in.\n- It lasts until the round ends.'],
  Haunt: ['- A *Spirit* or *Mind* attack on this hero also strikes its partner.\n- When this hero falls, the Haunt passes to its partner.\n- Switching clears it.'],
  IceShell: ["- Whoever's hit *breaks* this hero's Shield is *Frozen*.\n- It is spent when it fires."],
  Beheld: ["- The Titan's eye is on this hero: a *Regard* is coming.\n- Switching out breaks its gaze. A Shield takes the hit first."],
  Poised: ["- The hero's *next attack* goes ahead of moves it would otherwise follow.\n- Then it's spent.\n- It waits until used, but switching clears it."],
  DrawnBlade: ["- The hero's *next Slice* goes ahead of moves it would otherwise follow.\n- Then it's spent.\n- Switching clears it."],
  Ambush: ["- The hero's *next attack* hits harder: the badge's number is added to its power, whatever its type.\n- Then it's spent.\n- It waits until used, but switching clears it."],
  Edge: ["- Every *Slice* this hero uses hits harder: the badge's number is added to its power, whatever its type.\n- It lasts the whole fight, through switching."],
  Crescendo: ["- For *this round*, every *Arcane* move this hero uses hits harder by the badge's number.\n- It's gone when the round ends."],
  Grace: ["- Every *heal* this hero casts heals more: the badge's number is added to its power.\n- It lasts the whole fight, through switching."],
  Aim: ["- Every *Arrow* this hero looses hits harder: the badge's number is added to its power, whatever its type.\n- It lasts the whole fight, through switching."],
};

/** A description as bullets, a sentence each. */
function asBullets(description: string): string {
  return description
    .split(/(?<=\.)\s+(?=[A-Z])/)
    .map((sentence) => `- ${sentence}`)
    .join('\n');
}

function statusPage(statusId: string): ManualPage {
  const status = statuses[statusId];
  return {
    id: `howto.status.${statusId}`,
    title: status.name,
    ...(TAUGHT_BY[statusId] ? { lesson: TAUGHT_BY[statusId] } : {}),
    emblem: [`status:${statusId}`],
    pages: STATUS_WORDS[statusId] ?? [asBullets(status.description ?? '')],
  };
}

/** Every status a fighter can carry, an Elemental Force aside: those are an item's, read on the item. */
const STATUS_PAGES = Object.values(statuses)
  .filter((status) => status.id !== `${status.forceType}Force` && status.description)
  .map((status) => statusPage(status.id));

const taughtIn = (lesson: string) => STATUS_PAGES.filter((p) => p.lesson === lesson);

export const MANUAL_PAGES: readonly ManualPage[] = [
  page(
    'combat',
    'Turn by Turn',
    MOVE,
    ['stat:speed'],
    'Each round, pick a *move* for each hero, then *who it hits*.',
    '- The round plays out *fastest first*.\n- *Tap* a fighter to read it.\n- *Hold* a move to read all of it.'
  ),
  page('mana', 'Mana', MANA, ['stat:manaPool'], '- A move costs the *Mana* in its gem.\n- Every hero regains some each round.'),
  page(
    'targets',
    'Single and Spread',
    SPREAD,
    ['glyph:spread'],
    'The bars under a move show who it hits:\n- [single] the *one* foe you pick\n- [spread] *both* foes, each at full power'
  ),
  page(
    'reach',
    'Who It Reaches',
    RUN,
    ['glyph:spread'],
    'Figures show who an effect reaches:\n- [self] the hero using it\n- [ally] your side\n- [foe] an enemy',
    'A move that hits everyone also shows [ally]: it hits your partner too.'
  ),
  page(
    'stages',
    'Buffs and Debuffs',
    RUN,
    ['kind:buff', 'kind:debuff'],
    "- [buff] A *buff* raises a stat for the rest of the fight.\n- [debuff] A *debuff* lowers an enemy's.",
    '- An arrow beside a stat shows it was raised or lowered.\n- Arrows stay through a switch.',
    '[stages]'
  ),
  page(
    'types',
    'Types',
    TYPES,
    ['arrow:super', 'arrow:resist'],
    'The arrows under a move show how hard it hits each foe:\n- [super] *double*\n- [resist] *half*\n- two arrows: *four times*, or a *quarter*',
    "- The icon before a move's name is its type.\n- A move of the hero's own type hits *25%* harder."
  ),

  page(
    'bench',
    'Switching',
    SWITCH,
    ['glyph:switch'],
    '- *Switch* brings in a hero from the *bench*, before anyone moves.\n- Arriving uses its turn.\n- Benched heroes *regain Mana* every round.'
  ),
  page(
    'kinds',
    'Physical and Magical',
    KINDS,
    ['kind:physical', 'kind:magical'],
    '- [physical] *Physical*: Attack against Defense.\n- [magical] *Magical*: Intelligence against Wisdom.\n- Tap a foe to find the defense it lacks.'
  ),
  page('rest', 'Rest', MANA, ['node:restReward'], '- Short of Mana? *Rest*.\n- It skips the turn and *refills all its Mana*.'),
  page(
    'statuses',
    'Status Effects',
    BURN,
    ['status:Burn', 'status:Shield'],
    '- A *status* lasts, marked beside a fighter. Some help, some harm.\n- *Pips* count its rounds. A *number* is its strength.\n- *Tap* a fighter to read them.'
  ),
  ...taughtIn(BURN),

  page(
    'leads',
    'Leads',
    OPEN,
    ['glyph:leads'],
    '- The enemy sends out two *leads* first.\n- Tap two heroes to answer. The rest wait on the bench.',
    '- A *green* arrow: your hero hits the foe above it hard.\n- A *red* arrow: that foe hits your hero hard.'
  ),
  {
    ...page(
      'passives',
      'Passives',
      OPEN,
      ['passive:waystone'],
      '- Every hero has a *passive*. It works *by itself*, and its name shows when it fires.\n- *Tap* a hero to read it.\n- It affects each hero at most *once a round*.'
    ),
    afterFight: true,
  },
  page(
    'map',
    'The Map',
    RUN,
    ['node:fight'],
    '- Tap a place ahead to read what happens there.\n- Tap it again to go.',
    'The track across the top shows the way to the Guardian, and how many stops are left before it.'
  ),
  page(
    'items',
    'Items',
    GEAR,
    ['node:equipmentReward'],
    '- An item goes to one hero and *stays* there.\n- Each hero holds *three*.',
    '- A second of the same kind *merges* into a stronger one.\n- A full hero can *replace* one: the old one is lost.\n- Or *sell* the new one.'
  ),
  page(
    'levels',
    'Levels and Moves',
    RUN,
    ['resource:xp'],
    '- Every hero on your roster gains XP from each won fight, *benched heroes too*.',
    "- Each level can raise a hero's stats.\n- Some levels offer a new move: take it or pass.\n- A hero knows *four* moves at most."
  ),
  page(
    'wounds',
    'Wounds',
    RUN,
    ['stat:hp'],
    '- *HP* carries over from fight to fight within an act.\n- *Mana* refills before every fight.',
    '- A knocked-out hero sits out.\n- It stands again at a *Rest* site, the *Guild Hall*, or the *next act*.'
  ),
  page(
    'bag',
    'The Bag',
    RUN,
    ['resource:hpPotion', 'resource:mpPotion'],
    "- Drinking a potion *doesn't use a turn*: drink, then choose a move.\n- A potion restores *half* of a hero's HP or Mana.\n- Hold up to *three* of each."
  ),

  page('heals', 'Heals', RUN, ['kind:heal'], "- [heal] A *heal* restores an ally's HP.\n- It grows with the healer's *Wisdom*.\n- It can't raise a hero who has been knocked out."),
  page(
    'patrons',
    'Patrons',
    RUN,
    ['node:mentorReward'],
    '- At a patron seat, choose who to meet.\n- Each patron gives one of your heroes something of their own.',
    'The more often you choose a patron, the more they *trust* you, and the better their help.'
  ),
  page(
    'fork',
    'Elite or Skirmish',
    RUN,
    ['node:elite', 'node:skirmish'],
    'At the fork, an *Elite*, against a Skirmish:\n- is a *level higher*\n- *always* drops an item\n- pays *more XP*',
    'Tap a tile to see the types it fields against your roster.'
  ),
  page(
    'recruit',
    'Recruiting',
    CONTRACTS,
    ['resource:contract'],
    '- Win a Skirmish or an Elite, and a *Recruit Contract* signs a hero you beat.\n- It joins with its moves and its item.',
    '- Your roster holds *six*.\n- To sign a seventh, one has to leave.'
  ),

  page(
    'journey',
    'The Infinite',
    RUN,
    ['node:boss'],
    "- Each act ends with a *Guardian*.\n- Defeat all four to lock the four rings of the Titan's Seal, then win one last fight.",
    'If all your heroes fall, the run is over.'
  ),
  page(
    'blessing',
    'Blessings',
    RUN,
    ['node:blessingReward'],
    '- Your two starting heroes are *Blessed*.\n- A gold star marks a Blessed hero.',
    'The first time a Blessed hero would be knocked out, the blow is turned aside and the Blessing is used up.'
  ),
  page(
    'gems',
    'Gems and Mastery',
    GEMS,
    ['resource:scroll'],
    '- Tap a hero to set the *Gem* in it.\n- Its stat is theirs for the run.',
    'Every Gem is also a *Mastery* pip:\n- at *5*, the hero Evolves\n- at *10*, its passive grows stronger'
  ),
  page(
    'academy',
    'The Academy',
    RUN,
    ['node:tutorReward'],
    '- A *Class* teaches a hero a powerful new ability or move within its type.\n- Each hero can learn only one.',
    'Choose a Class first, then a hero to learn it.'
  ),
  page(
    'guildHall',
    'The Guild Hall',
    RUN,
    ['node:shop'],
    'The *Tavern* hires heroes for a Recruit Contract. Its bar sells Contracts, a fresh shelf of faces, and a meal that heals your whole roster.',
    'The *Gem* counter sells single Gems. Pick one, then the hero to set it in.',
    'The *Gear* counter sells items. Pick one, then the hero to wear it.'
  ),
  page(
    'ancient',
    'Ancient',
    RUN,
    ['type:Ancient'],
    '- Every Guardian is *Ancient*.\n- Ancient resists every type: every hit on it is *halved*.',
    'A move strong against its other type only breaks even (1×). The [super] or [resist] on each move shows which.',
    'Ancient moves are resisted by nothing: every hit lands at full strength on every type.'
  ),
  page('banner', 'Banners', RUN, ['glyph:banner'], '- Beating a Guardian earns a *Banner*.\n- It boosts your *whole team* for the rest of the run.\n- Banners stack.'),
  page(
    'nextAct',
    'The Next Act',
    RUN,
    ['glyph:road'],
    '- Each act takes you somewhere new, never the same place twice.\n- Each place is home to different types of Titanspawn and heroes.'
  ),
  page(
    'lockIn',
    'No Way Out',
    RUN,
    ['glyph:lock'],
    "- Once *half* a side has been knocked out, it *can't switch* anymore.\n- A fallen hero is still replaced from the bench."
  ),
  page(
    'field',
    'Field Effects',
    RUN,
    ['field:scorchedLand'],
    '- A *Field Effect* changes the rules for everyone until its pips run out.\n- Tap it to read it.',
    '- Only one is up at a time.\n- A different one replaces it.'
  ),
  page(
    'pactClock',
    'The Pact Clock',
    RUN,
    ['glyph:clock'],
    '- From round *30*, the *Pact Clock* strikes.\n- Everyone on the field loses a growing share of max HP every round.',
    'The side that is ahead still wins. Only a stall loses.'
  ),
  page(
    'cycles',
    'Cycles',
    RUN,
    ['glyph:cycle'],
    '- Clearing a run opens the next *Cycle*, each harder than the last.\n- From Cycle II, the heroes who sealed the Titan stand beside its Guardians, and the Guardians wake.'
  ),
  ...STATUS_PAGES.filter((p) => !p.lesson),
];

const BY_ID: Readonly<Record<string, ManualPage>> = Object.fromEntries(MANUAL_PAGES.map((p) => [p.id, p]));

/** A page by id (`howto.mana`), for a lesson's cue to show. Throws on a typo: a cue must name a real page. */
export function manualPage(id: string): ManualPage {
  const found = BY_ID[id];
  if (!found) throw new Error(`No How to Play page ${id}`);
  return found;
}
