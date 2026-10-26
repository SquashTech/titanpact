// How to Play — CONTENT (docs/the-sky.md §2c). The manual the player fills by playing: First
// Light's lessons file their pages as they teach them, and a run files the rest the first time it
// meets the thing. A lesson's in-fight tip IS its page, so the rules are written once. Same voice
// and tokens as the tips (src/data/tips.ts); a page's pictures are keyed by its id in tipScenes.ts.

import type { ManualPage, ManualSource, ManualTrigger } from '../run/manual';
import { statuses } from './statuses';

const lesson = (scenarioId: string): ManualSource => ({ kind: 'lesson', scenarioId });
const HUNT = lesson('firstLight.hunt');
const CLEARING = lesson('firstLight.clearing');
const ROAD = lesson('firstLight.road');
const FORK = lesson('firstLight.fork');
const met = (trigger: ManualTrigger): ManualSource => ({ kind: 'run', met: trigger });

function page(id: string, title: string, source: ManualSource, emblem: readonly string[], ...pages: string[]): ManualPage {
  return { id: `howto.${id}`, title, source, emblem, pages };
}

/** Words for a status the lessons teach; every other status reads its own description. */
const TAUGHT_STATUSES: Readonly<Record<string, { source: ManualSource; pages: readonly string[] }>> = {
  Shield: {
    source: CLEARING,
    pages: ['A *Shield* is extra health that takes hits before HP does, until a hit *breaks* it.', "Burn, Bleed and a move's own cost go straight through it."],
  },
  Conduct: {
    source: CLEARING,
    pages: ['A *Conduct* [conduct] mark makes the next *Storm*, *Iron* or *Mech* hit on its target deal *Bonus* damage, and uses up the mark.', 'Mark first, then strike: the marking hero must act before the striker.'],
  },
  Daze: {
    source: FORK,
    pages: ["A *Dazed* hero can't attack for the rest of the round, but can still switch or Rest.", 'It lands only if it goes first: a hero that has already moved shrugs it off.'],
  },
};

function statusPage(statusId: string): ManualPage {
  const status = statuses[statusId];
  const taught = TAUGHT_STATUSES[statusId];
  return {
    id: `howto.status.${statusId}`,
    title: status.name,
    source: taught?.source ?? met({ kind: 'status', statusId }),
    emblem: [`status:${statusId}`],
    pages: taught?.pages ?? [status.description ?? ''],
  };
}

/** Every status a fighter can carry, an Elemental Force aside: those are an item's, read on the item. */
const STATUS_PAGES = Object.values(statuses)
  .filter((status) => !status.forceType && status.description)
  .map((status) => statusPage(status.id));

export const MANUAL_PAGES: readonly ManualPage[] = [
  page(
    'combat',
    'Turn by Turn',
    HUNT,
    ['stat:speed'],
    'Each round, choose a move and a target for both heroes on the field. Then the round plays out in *Speed* order.',
    '*Tap* any fighter to read its stats, moves and passive. *Hold* a move to read all of it.',
    'A passive works on its own, and affects each hero at most once a round.'
  ),
  page('mana', 'Mana', HUNT, ['stat:manaPool'], 'A move costs the *Mana* in its gem, paid from the blue bar.', 'Every hero regains some Mana each round.'),
  page(
    'targets',
    'Single and Spread',
    HUNT,
    ['glyph:spread'],
    'The bars under a move show who it hits. [single] A bar under each enemy: the one you pick. [spread] One long bar under both: it hits *both*, each at full power.',
    'Figures show who an effect reaches: [self] the hero using it, [ally] your side, [foe] an enemy.',
    'A move that hits everyone also shows [ally]: it hits your partner too.'
  ),
  page(
    'stages',
    'Buffs and Debuffs',
    HUNT,
    ['kind:buff', 'kind:debuff'],
    '[buff] A *buff* raises a stat for the rest of the fight. [debuff] A *debuff* lowers an enemy\'s.',
    'An arrow beside a stat shows it was raised or lowered. Arrows stay through a switch.',
    '[stages]'
  ),
  page(
    'types',
    'Types',
    HUNT,
    ['arrow:super', 'arrow:resist'],
    "The arrows under a move show how it hits each enemy: [super] double, [resist] half. Two arrows mean four times, or a quarter.",
    "The icon before a move's name is its type. A move that shares a type with the hero using it deals 25% more."
  ),

  page(
    'bench',
    'Switching',
    CLEARING,
    ['glyph:switch'],
    '*Switch* trades a hero on the field for one on the *bench*, before anyone moves. The one coming in uses its turn arriving.',
    'Heroes on the bench *regain Mana* every round. Switch out a hero that is hurt, out of Mana, or weak to the enemy.'
  ),
  page(
    'kinds',
    'Physical and Magical',
    CLEARING,
    ['kind:physical', 'kind:magical'],
    '[physical] *Physical* moves use Attack against Defense. [magical] *Magical* moves use Intelligence against Wisdom.',
    'A foe with thick armour may have a thin mind. Tap it, and strike the defense it lacks.'
  ),
  page('rest', 'Rest', CLEARING, ['node:restReward'], 'A hero short of Mana can *Rest*: it skips its turn and *refills all of its Mana*.'),
  page(
    'statuses',
    'Status Effects',
    CLEARING,
    ['status:Burn', 'status:Shield'],
    'A *status* is an effect that lasts, marked beside a fighter. Some help, some harm.',
    'Tap a fighter to read its statuses. Some wear off on their own; others last until something clears them.'
  ),
  ...STATUS_PAGES.filter((p) => TAUGHT_STATUSES[p.id.slice('howto.status.'.length)]?.source === CLEARING),

  page(
    'leads',
    'Leads',
    ROAD,
    ['glyph:leads'],
    'The enemy sends out its *leads* first. Tap two heroes to answer them. The rest wait on the bench.',
    'A green arrow means that hero has the type advantage over the enemy above it. A red arrow means the enemy has it.'
  ),
  page(
    'map',
    'The Map',
    ROAD,
    ['node:fight'],
    'Tap a place ahead to read what happens there. Tap it again to go.',
    'The track across the top shows the way to the Guardian, and how many stops are left before it.'
  ),
  page(
    'items',
    'Items',
    ROAD,
    ['node:equipmentReward'],
    'An item goes to a hero the moment it arrives, and stays.',
    'Each hero holds three. A second item of the same kind merges into a stronger one.',
    'A hero holding three can replace one: the old one is lost. Or sell the new one for gold.'
  ),
  page(
    'levels',
    'Levels and Moves',
    ROAD,
    ['resource:xp'],
    'Every hero on your roster gains XP from each won fight, benched heroes included.',
    "Each level can raise a hero's stats. Some levels offer a new move: take it or pass. A hero knows four moves at most."
  ),
  page(
    'wounds',
    'Wounds',
    ROAD,
    ['stat:hp'],
    'HP carries over from fight to fight within an act. Mana refills between fights.',
    'A knocked-out hero sits out until a Rest site, the Guild Hall, or the next act.'
  ),
  page(
    'bag',
    'The Bag',
    ROAD,
    ['resource:hpPotion', 'resource:mpPotion'],
    "The Bag holds potions for the whole team. Drinking one doesn't use a turn: drink, then choose a move.",
    "A potion restores half of a hero's HP or Mana. You can hold three of each."
  ),

  page(
    'heals',
    'Heals',
    FORK,
    ['kind:heal'],
    "[heal] A *heal* restores an ally's HP. It grows with the healer's *Wisdom*.",
    "A heal can't raise a hero who has been knocked out."
  ),
  ...STATUS_PAGES.filter((p) => TAUGHT_STATUSES[p.id.slice('howto.status.'.length)]?.source === FORK),
  page(
    'patrons',
    'Patrons',
    FORK,
    ['node:mentorReward'],
    'At a patron seat, choose who to meet. Each patron gives one of your heroes something of their own.',
    'The more often you choose a patron, the more they *trust* you, and the better their help.'
  ),
  page(
    'fork',
    'Elite or Skirmish',
    FORK,
    ['node:elite', 'node:skirmish'],
    'At the fork, an *Elite* is a level above a *Skirmish*, always drops an item, and pays more XP.',
    'Tap a tile to see the types it fields against your roster.'
  ),
  page(
    'recruit',
    'Recruiting',
    FORK,
    ['resource:contract'],
    'Skirmishes and Elites are fought against other heroes. After a win, a *Recruit Contract* adds one of them to your roster, with its moves and its item.',
    'Your roster holds six. Past that, a hero must leave to make room.'
  ),

  page(
    'journey',
    'The Infinite',
    met({ kind: 'screen', screen: 'actIntro:first' }),
    ['node:boss'],
    "Each act ends with a Guardian. Defeat all four to lock the four rings of the Titan's Seal, then win one last fight.",
    'If all your heroes fall, the run is over.'
  ),
  page(
    'blessing',
    'Blessings',
    met({ kind: 'screen', screen: 'actIntro:first' }),
    ['node:blessingReward'],
    'Your two starting heroes are *Blessed*. A gold star marks a Blessed hero.',
    'The first time a Blessed hero would be knocked out, the blow is turned aside and the Blessing is used up.'
  ),
  page(
    'companion',
    'Your Companion',
    met({ kind: 'screen', screen: 'companion' }),
    ['glyph:paw'],
    'After the first fight of a run, one of the creatures you beat joins you as a companion.',
    'Once a fight it acts on its own, costing no Mana and no turn. A ! and a place in the turn order show when.'
  ),
  page(
    'gems',
    'Gems and Mastery',
    met({ kind: 'screen', screen: 'scrolls' }),
    ['resource:scroll'],
    'Tap a hero to set a *Gem* in it. The stat it raises is theirs for the run.',
    'Every Gem is also a Mastery pip. At 5, a hero Evolves into a new form. At 10, their innate powers grow.'
  ),
  page(
    'academy',
    'The Academy',
    met({ kind: 'screen', screen: 'academyNode' }),
    ['node:tutorReward'],
    'Classes teach heroes powerful new abilities or moves within their type. Each hero can learn only one.',
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
    'Every Guardian is *Ancient*. Ancient resists every type: every hit on it is halved.',
    'A move strong against its other type only breaks even (1×). The [super] or [resist] on each move shows which.',
    'Ancient moves are resisted by nothing: every hit lands at full strength on every type.'
  ),
  page('banner', 'Banners', met({ kind: 'screen', screen: 'guardianBanner' }), ['glyph:banner'], 'Beating a Guardian earns a *Banner*. It boosts your whole team for the rest of the run, and Banners stack.'),
  page(
    'nextAct',
    'The Next Act',
    met({ kind: 'screen', screen: 'actIntro:later' }),
    ['glyph:road'],
    'Each act takes you somewhere new, never the same place twice. Each place is home to different types of Titanspawn and heroes.'
  ),
  page(
    'lockIn',
    'No Way Out',
    met({ kind: 'fight', what: 'lockIn' }),
    ['glyph:lock'],
    "Once half a side has been knocked out, it can't switch anymore. A fallen hero is still replaced from the bench."
  ),
  page(
    'field',
    'Field Effects',
    met({ kind: 'fight', what: 'field' }),
    ['field:scorchedLand'],
    'A *Field Effect* changes the rules for everyone until its pips run out. Tap it to read it.',
    'Only one is up at a time. A different one replaces it.'
  ),
  page(
    'pactClock',
    'The Pact Clock',
    met({ kind: 'fight', what: 'pactClock' }),
    ['glyph:clock'],
    'Fights cannot last forever. From round 30 the *Pact Clock* strikes: everyone on the field loses a growing share of max HP every round.',
    'The side that is ahead still wins. Only a stall loses.'
  ),
  page(
    'cycles',
    'Cycles',
    met({ kind: 'screen', screen: 'runComplete' }),
    ['glyph:cycle'],
    'Clearing a run opens the next *Cycle*, each harder than the last.',
    'From Cycle II, the heroes who sealed the Titan stand beside its Guardians, and the Guardians wake.'
  ),
  ...STATUS_PAGES.filter((p) => !TAUGHT_STATUSES[p.id.slice('howto.status.'.length)]),
];

const BY_ID: Readonly<Record<string, ManualPage>> = Object.fromEntries(MANUAL_PAGES.map((p) => [p.id, p]));

/** A page by id (`howto.mana`), for a lesson's cue to show. Throws on a typo: a cue must name a real page. */
export function manualPage(id: string): ManualPage {
  const found = BY_ID[id];
  if (!found) throw new Error(`No How to Play page ${id}`);
  return found;
}
