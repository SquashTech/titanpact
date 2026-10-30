// How to Play — CONTENT (docs/the-sky.md §2c). The manual the player fills by playing: First
// Light's lessons file their pages as they teach them, and a run files the rest the first time it
// meets the thing. A lesson's in-fight tip IS its page, so the rules are written once. Same voice
// and tokens as the tips (src/data/tips.ts); a page's pictures are keyed by its id in tipScenes.ts.
// A page that lists rules lists them: a line opening `- ` is a bullet.

import type { ManualPage, ManualSource, ManualTrigger } from '../run/manual';
import { statuses } from './statuses';

const lesson = (scenarioId: string): ManualSource => ({ kind: 'lesson', scenarioId });
const MOVE = lesson('firstLight.move');
const MANA = lesson('firstLight.mana');
const TYPES = lesson('firstLight.types');
const SPREAD = lesson('firstLight.spread');
const KINDS = lesson('firstLight.kinds');
const BURN = lesson('firstLight.burn');
const SWITCH = lesson('firstLight.switch');
const GEAR = lesson('firstLight.gear');
const OPEN = lesson('firstLight.open');
const met = (trigger: ManualTrigger): ManualSource => ({ kind: 'run', met: trigger });
/** A screen page its screen's choice needs, opened over that screen the first time (run/manual.ts). */
const atDecision = (p: ManualPage): ManualPage => ({ ...p, atDecision: true });

function page(id: string, title: string, source: ManualSource, emblem: readonly string[], ...pages: string[]): ManualPage {
  return { id: `howto.${id}`, title, source, emblem, pages };
}

/** The lesson that teaches a status, where one does. */
const TAUGHT_BY: Readonly<Record<string, ManualSource>> = { Burn: BURN };

/** A status's page, in bullets. A status not here reads its own description, a bullet a sentence. */
const STATUS_WORDS: Readonly<Record<string, readonly string[]>> = {
  Burn: [
    '- Burns at each round end: *15%* of max HP, then *8%*, then *4%*. Then it goes out.\n- Its pips are the rounds it has left.',
    '- Another Burn lights it again at *15%*.\n- *Rest*, *switching* or *Cleanse* puts it out.',
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
    source: TAUGHT_BY[statusId] ?? met({ kind: 'status', statusId }),
    emblem: [`status:${statusId}`],
    pages: STATUS_WORDS[statusId] ?? [asBullets(status.description ?? '')],
  };
}

/** Every status a fighter can carry, an Elemental Force aside: those are an item's, read on the item. */
const STATUS_PAGES = Object.values(statuses)
  .filter((status) => status.id !== `${status.forceType}Force` && status.description)
  .map((status) => statusPage(status.id));

const taughtIn = (source: ManualSource) => STATUS_PAGES.filter((p) => TAUGHT_BY[p.id.slice('howto.status.'.length)] === source);

export const MANUAL_PAGES: readonly ManualPage[] = [
  page(
    'combat',
    'Turn by Turn',
    MOVE,
    ['stat:speed'],
    'Each round, pick a *move* for each hero on the field, then pick *who it hits*.',
    '- The round then plays out *fastest first*.\n- *Tap* any fighter to read its stats, moves and passive.\n- *Hold* a move to read all of it.'
  ),
  page('mana', 'Mana', MANA, ['stat:manaPool'], '- A move costs the *Mana* in its gem, paid from the blue bar.\n- Every hero regains some Mana each round.'),
  page(
    'targets',
    'Single and Spread',
    SPREAD,
    ['glyph:spread'],
    'The bars under a move show who it hits:\n- [single] A bar under each enemy: the *one* you pick.\n- [spread] One long bar under both: it hits *both*, each at full power.',
    'Figures show who an effect reaches:\n- [self] the hero using it\n- [ally] your side\n- [foe] an enemy',
    'A move that hits everyone also shows [ally]: it hits your partner too.'
  ),
  page(
    'stages',
    'Buffs and Debuffs',
    met({ kind: 'fight', what: 'stage' }),
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
    'The arrows under a move show how it hits each enemy:\n- [super] *double* damage\n- [resist] *half* damage\n- two arrows: *four times*, or a *quarter*',
    "- The icon before a move's name is its type.\n- A move that shares a type with the hero using it deals *25%* more."
  ),

  page(
    'bench',
    'Switching',
    SWITCH,
    ['glyph:switch'],
    '- *Switch* trades a hero on the field for one on the *bench*, before anyone moves.\n- The one coming in uses its turn arriving.',
    '- Heroes on the bench *regain Mana* every round.\n- Switch out a hero that is hurt, out of Mana, or weak to the enemy.'
  ),
  page(
    'kinds',
    'Physical and Magical',
    KINDS,
    ['kind:physical', 'kind:magical'],
    '- [physical] *Physical*: Attack against Defense.\n- [magical] *Magical*: Intelligence against Wisdom.',
    'A foe with thick armour may have a thin mind. Tap it, and strike the defense it lacks.'
  ),
  page('rest', 'Rest', MANA, ['node:restReward'], '- A hero short of Mana can *Rest*.\n- It skips its turn and *refills all of its Mana*.'),
  page(
    'statuses',
    'Status Effects',
    BURN,
    ['status:Burn', 'status:Shield'],
    '- A *status* is an effect that lasts, marked beside a fighter.\n- Some help, some harm.',
    '- *Tap* a fighter to read its statuses.\n- *Pips* count rounds. A *number* is how strong it is.'
  ),
  ...taughtIn(BURN),

  page(
    'leads',
    'Leads',
    OPEN,
    ['glyph:leads'],
    '- The enemy sends out its *leads* first.\n- Tap two heroes to answer them. The rest wait on the bench.',
    '- A *green* arrow: your hero has the type advantage over the enemy above it.\n- A *red* arrow: the enemy has it.'
  ),
  {
    ...page(
      'passives',
      'Passives',
      OPEN,
      ['passive:waystone'],
      "- Every hero has a *passive* of its own.\n- It works *by itself*: you never pick it.\n- Its name shows whenever it fires.",
      '- *Tap* a hero to read its passive.\n- A passive affects each hero at most *once a round*.'
    ),
    afterFight: true,
  },
  atDecision(
    page(
      'map',
      'The Map',
      met({ kind: 'screen', screen: 'map' }),
      ['node:fight'],
      '- Tap a place ahead to read what happens there.\n- Tap it again to go.',
      'The track across the top shows the way to the Guardian, and how many stops are left before it.'
    )
  ),
  page(
    'items',
    'Items',
    GEAR,
    ['node:equipmentReward'],
    'An item goes to a hero the moment it arrives, and stays.',
    '- Each hero holds *three*.\n- A second item of the same kind *merges* into a stronger one.',
    '- A hero holding three can *replace* one: the old one is lost.\n- Or *sell* the new one instead.'
  ),
  atDecision(
    page(
      'levels',
      'Levels and Moves',
      met({ kind: 'screen', screen: 'levelUp' }),
      ['resource:xp'],
      '- Every hero on your roster gains XP from each won fight, *benched heroes too*.',
      "- Each level can raise a hero's stats.\n- Some levels offer a new move: take it or pass.\n- A hero knows *four* moves at most."
    )
  ),
  page(
    'wounds',
    'Wounds',
    met({ kind: 'screen', screen: 'map' }),
    ['stat:hp'],
    '- *HP* carries over from fight to fight within an act.\n- *Mana* refills before every fight.',
    '- A knocked-out hero sits out.\n- It stands again at a *Rest* site, the *Guild Hall*, or the *next act*.'
  ),
  page(
    'bag',
    'The Bag',
    met({ kind: 'screen', screen: 'fight' }),
    ['resource:hpPotion', 'resource:mpPotion'],
    "- Drinking a potion *doesn't use a turn*: drink, then choose a move.\n- A potion restores *half* of a hero's HP or Mana.\n- Hold up to *three* of each."
  ),

  page('heals', 'Heals', met({ kind: 'fight', what: 'heal' }), ['kind:heal'], "- [heal] A *heal* restores an ally's HP.\n- It grows with the healer's *Wisdom*.\n- It can't raise a hero who has been knocked out."),
  page(
    'patrons',
    'Patrons',
    met({ kind: 'screen', screen: 'patronNode' }),
    ['node:mentorReward'],
    '- At a patron seat, choose who to meet.\n- Each patron gives one of your heroes something of their own.',
    'The more often you choose a patron, the more they *trust* you, and the better their help.'
  ),
  page(
    'fork',
    'Elite or Skirmish',
    met({ kind: 'screen', screen: 'map' }),
    ['node:elite', 'node:skirmish'],
    'At the fork, an *Elite*, against a Skirmish:\n- is a *level higher*\n- *always* drops an item\n- pays *more XP*',
    'Tap a tile to see the types it fields against your roster.'
  ),
  atDecision(
    page(
      'recruit',
      'Recruiting',
      met({ kind: 'screen', screen: 'recruit' }),
      ['resource:contract'],
      '- Skirmishes and Elites are fought against other heroes.\n- After a win, a *Recruit Contract* adds one of them to your roster, with its moves and its item.',
      '- Your roster holds *six*.\n- Past that, a hero must leave to make room.'
    )
  ),

  page(
    'journey',
    'The Infinite',
    met({ kind: 'screen', screen: 'actIntro:first' }),
    ['node:boss'],
    "- Each act ends with a *Guardian*.\n- Defeat all four to lock the four rings of the Titan's Seal, then win one last fight.",
    'If all your heroes fall, the run is over.'
  ),
  page(
    'blessing',
    'Blessings',
    met({ kind: 'screen', screen: 'actIntro:first' }),
    ['node:blessingReward'],
    '- Your two starting heroes are *Blessed*.\n- A gold star marks a Blessed hero.',
    'The first time a Blessed hero would be knocked out, the blow is turned aside and the Blessing is used up.'
  ),
  page(
    'companion',
    'Your Companion',
    met({ kind: 'screen', screen: 'companion' }),
    ['glyph:paw'],
    'After the first fight of a run, one of the creatures you beat joins you as a companion.',
    '- It acts on its own, *once a fight*.\n- It costs no Mana and no hero\'s turn.\n- A *!* and a place in the turn order show when.'
  ),
  page(
    'gems',
    'Gems and Mastery',
    met({ kind: 'screen', screen: 'scrolls' }),
    ['resource:scroll'],
    '- Tap a hero to set a *Gem* in it.\n- The stat it raises is theirs for the run.',
    'Every Gem is also a *Mastery* pip:\n- at *5*, a hero Evolves into a new form\n- at *10*, their innate power grows'
  ),
  page(
    'academy',
    'The Academy',
    met({ kind: 'screen', screen: 'academyNode' }),
    ['node:tutorReward'],
    '- A *Class* teaches a hero a powerful new ability or move within its type.\n- Each hero can learn only one.',
    'Choose a Class first, then a hero to learn it.'
  ),
  page(
    'guildHall',
    'The Guild Hall',
    met({ kind: 'screen', screen: 'shop' }),
    ['node:shop'],
    'The *Tavern* hires heroes for a Recruit Contract. Its bar sells Contracts, a fresh shelf of faces, and a meal that heals your whole roster.',
    'The *Gem* counter sells single Gems. Pick one, then the hero to set it in.',
    'The *Gear* counter sells items. Pick one, then the hero to wear it.'
  ),
  page(
    'ancient',
    'Ancient',
    met({ kind: 'fight', what: 'ancient' }),
    ['type:Ancient'],
    '- Every Guardian is *Ancient*.\n- Ancient resists every type: every hit on it is *halved*.',
    'A move strong against its other type only breaks even (1×). The [super] or [resist] on each move shows which.',
    'Ancient moves are resisted by nothing: every hit lands at full strength on every type.'
  ),
  page('banner', 'Banners', met({ kind: 'screen', screen: 'guardianBanner' }), ['glyph:banner'], '- Beating a Guardian earns a *Banner*.\n- It boosts your *whole team* for the rest of the run.\n- Banners stack.'),
  page(
    'nextAct',
    'The Next Act',
    met({ kind: 'screen', screen: 'actIntro:later' }),
    ['glyph:road'],
    '- Each act takes you somewhere new, never the same place twice.\n- Each place is home to different types of Titanspawn and heroes.'
  ),
  page(
    'lockIn',
    'No Way Out',
    met({ kind: 'fight', what: 'lockIn' }),
    ['glyph:lock'],
    "- Once *half* a side has been knocked out, it *can't switch* anymore.\n- A fallen hero is still replaced from the bench."
  ),
  page(
    'field',
    'Field Effects',
    met({ kind: 'fight', what: 'field' }),
    ['field:scorchedLand'],
    '- A *Field Effect* changes the rules for everyone until its pips run out.\n- Tap it to read it.',
    '- Only one is up at a time.\n- A different one replaces it.'
  ),
  page(
    'pactClock',
    'The Pact Clock',
    met({ kind: 'fight', what: 'pactClock' }),
    ['glyph:clock'],
    '- From round *30*, the *Pact Clock* strikes.\n- Everyone on the field loses a growing share of max HP every round.',
    'The side that is ahead still wins. Only a stall loses.'
  ),
  page(
    'cycles',
    'Cycles',
    met({ kind: 'screen', screen: 'runComplete' }),
    ['glyph:cycle'],
    '- Clearing a run opens the next *Cycle*, each harder than the last.\n- From Cycle II, the heroes who sealed the Titan stand beside its Guardians, and the Guardians wake.'
  ),
  ...STATUS_PAGES.filter((p) => !TAUGHT_BY[p.id.slice('howto.status.'.length)]),
];

const BY_ID: Readonly<Record<string, ManualPage>> = Object.fromEntries(MANUAL_PAGES.map((p) => [p.id, p]));

/** A page by id (`howto.mana`), for a lesson's cue to show. Throws on a typo: a cue must name a real page. */
export function manualPage(id: string): ManualPage {
  const found = BY_ID[id];
  if (!found) throw new Error(`No How to Play page ${id}`);
  return found;
}
