// The tutorial (docs/the-tutorial.md): one scripted fight that teaches by playing, a short road after it,
// and an open fight. Each foe that falls brings in the next, set for the next idea.

import { STORY_ENEMY_SIDE, STORY_PLAYER_SIDE, type StoryCommand, type StoryCue, type StoryFight, type StoryHeroSpec, type StoryScreen } from '../run/story';
import type { Tip } from '../run/tips';

const foe = (rosterId: string) => ({ side: STORY_ENEMY_SIDE, rosterId });
const ally = (rosterId: string) => ({ side: STORY_PLAYER_SIDE, rosterId });
const hit = (actor: string, moveId: string, target: { side: 'A' | 'B'; rosterId: string }): StoryCommand => ({ actor, moveId, target });

/** The party, a gameplan each: physical, fast physical, magical spread, magical support. */
export const TUTORIAL_PARTY = ['cinder', 'raiju', 'cairn', 'solace'] as const;

export const TUTORIAL_FIGHT: StoryFight = {
  id: 'tutorial',
  seed: 2026,
  fixedRolls: true,
  // Only Cairn's Waystone fires: the one passive the fight names.
  quietSides: [STORY_ENEMY_SIDE],
  player: [
    { rosterId: 'cinder', heroId: 'cinderKnight', level: 5, moveIds: ['singe', 'setAlight'], quiet: true },
    { rosterId: 'raiju', heroId: 'raiju', level: 5, moveIds: ['thunderclap'], quiet: true },
    { rosterId: 'cairn', heroId: 'cairn', level: 5, moveIds: ['tremor'] },
    { rosterId: 'solace', heroId: 'dawnwarden', level: 5, moveIds: ['glimmer', 'mend'], quiet: true },
  ],
  playerLeads: [],
  guidedLeads: ['cinder', 'raiju'],
  guidedReplacements: ['solace'],
  enemy: [
    { rosterId: 'sprout', heroId: 'sproutling', level: 4, moveIds: ['seedShot'] },
    { rosterId: 'pud', heroId: 'puddling', level: 4, moveIds: ['splash'] },
    { rosterId: 'kindle', heroId: 'kindlehide', level: 5, moveIds: ['singe'] },
    { rosterId: 'arc', heroId: 'arcling', level: 10, moveIds: ['thunderclap'] },
    { rosterId: 'mesmerid', heroId: 'mesmerid', level: 5, moveIds: ['glimmer'] },
    { rosterId: 'ravager', heroId: 'ravager', level: 9, moveIds: ['heavyBlow'] },
  ],
  enemyLeads: ['sprout', 'pud'],
  enemyScript: [
    [hit('sprout', 'seedShot', ally('raiju')), hit('pud', 'splash', ally('cinder'))],
    [hit('kindle', 'singe', ally('raiju')), hit('arc', 'thunderclap', ally('raiju'))],
    [hit('kindle', 'singe', ally('cairn')), hit('arc', 'thunderclap', ally('cairn'))],
    [hit('mesmerid', 'glimmer', ally('cairn')), hit('ravager', 'heavyBlow', ally('cinder'))],
    [hit('mesmerid', 'glimmer', ally('cairn')), hit('ravager', 'heavyBlow', ally('cinder'))],
    [hit('mesmerid', 'glimmer', ally('cinder')), hit('ravager', 'heavyBlow', ally('cairn'))],
    [hit('ravager', 'heavyBlow', ally('cinder'))],
  ],
  guide: [
    [hit('cinder', 'singe', foe('sprout')), hit('raiju', 'thunderclap', foe('pud'))],
    [hit('cinder', 'singe', foe('kindle')), { actor: 'raiju', switchTo: 'cairn' }],
    [hit('cinder', 'singe', foe('kindle')), { actor: 'cairn', moveId: 'tremor' }],
    [hit('cinder', 'singe', foe('mesmerid')), { actor: 'cairn', moveId: 'tremor' }],
    [{ actor: 'cinder', rest: true }, { actor: 'cairn', moveId: 'tremor' }],
    [hit('cinder', 'setAlight', foe('mesmerid')), { actor: 'cairn', moveId: 'tremor' }],
    [hit('cinder', 'singe', foe('ravager')), { actor: 'solace', moveId: 'mend', target: ally('cinder') }],
  ],
};

const prompt = (id: string, title: string, ...pages: string[]): Tip => ({ id: `tutorial.${id}`, title, pages });

/** Before the leads: every type at a glance, then the arrows they draw. */
export const TUTORIAL_LEAD_TIP = prompt('leads', 'Types', 'Every hero has a *type*. There are fourteen.', 'An arrow up means your hero hits that foe hard. Lead with the heroes whose arrows point up.');
/** At the replacement panel, the first time a hero falls. */
export const TUTORIAL_REPLACEMENT_TIP = prompt('replace', 'Knocked Out', 'A hero who falls is out for the fight. Send in another from the bench.');

/** One prompt a round, tapped through; then the hand on every tap until round 8, which is the player's. */
export const TUTORIAL_CUES: readonly StoryCue[] = [
  { round: 0, at: 'leads', point: true, tips: [TUTORIAL_LEAD_TIP] },
  { round: 0, at: 'replacement', point: true, tips: [TUTORIAL_REPLACEMENT_TIP] },
  { round: 1, point: true, tips: [prompt('move', 'Moves', 'Pick a move, then who it hits. The fastest hero acts first.')] },
  { round: 2, point: true, tips: [prompt('switch', 'Switching', 'Switch in a hero who takes the hit better. Stone shrugs off Storm and Fire.')] },
  { round: 3, point: true, tips: [prompt('spread', 'Spread', 'Some moves hit both foes at once.')] },
  { round: 4, point: true, tips: [prompt('kinds', 'Physical and Magical', '[physical] *Defense* stops physical hits. [magical] *Wisdom* stops magic. This foe has high Wisdom.')] },
  { round: 5, point: true, tips: [prompt('rest', 'Mana', 'Moves cost *Mana*. Out of it, *Rest* fills it back up.')] },
  { round: 6, point: true, tips: [prompt('burn', 'Burn', 'A *Burn* keeps hurting after the hit, at the end of each round.')] },
  { round: 7, point: true, tips: [prompt('heal', 'Healing', 'Some moves heal an ally.')] },
  { round: 8, tips: [prompt('yours', 'Your Turn', 'Finish it your way.')] },
];

/** The victory pays a piece and two Gems, each to the hero the hand names. */
export const TUTORIAL_ITEM: StoryScreen = { kind: 'item', itemId: 'sword.common.blazing', to: 'cinder' };
export const TUTORIAL_GEMS: StoryScreen = {
  kind: 'gems',
  gems: [
    { gem: { stat: 'attack', points: 5 }, to: 'raiju' },
    { gem: { stat: 'intelligence', points: 5 }, to: 'solace' },
  ],
};
export const TUTORIAL_ITEM_TIP = prompt('item', 'Equipment', 'Gear goes to one hero, for good.');
export const TUTORIAL_GEMS_TIP = prompt('gems', 'Gems', 'A Gem raises a stat and fills a Mastery pip.');
export const TUTORIAL_MAP_TIP = prompt('map', 'The Map', 'A run is a road of stops. Tap one to see what waits there, then tap again to go.');

/** The road after the fight, one stop a row. */
export const TUTORIAL_ROAD = ['recruitReward', 'restReward', 'fight'] as const;
/** The level a hero recruited on the road joins at, the party's own. */
export const TUTORIAL_LEVEL = 5;

/** The open fight: a light team on its own kits and the enemy AI, nothing scripted. */
export const TUTORIAL_OPEN_FOES: readonly StoryHeroSpec[] = [
  { rosterId: 'cub', heroId: 'cubling', level: 4 },
  { rosterId: 'peb', heroId: 'pebbling', level: 4 },
  { rosterId: 'gleam', heroId: 'gleamling', level: 4 },
  { rosterId: 'whim', heroId: 'whimling', level: 4 },
];
export const TUTORIAL_OPEN_FOE_LEADS = ['cub', 'peb'] as const;

/** Every prompt the tutorial shows, in play order. */
export const TUTORIAL_TIPS: readonly Tip[] = [
  ...TUTORIAL_CUES.flatMap((cue) => cue.tips ?? []),
  TUTORIAL_ITEM_TIP,
  TUTORIAL_GEMS_TIP,
  TUTORIAL_MAP_TIP,
];
