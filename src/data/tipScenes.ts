// The staged pictures tips and the How to Play page show (docs/tutorial.md "Scenes"): which
// heroes, which moves, which part is ringed. Words stay in tips.ts and howToPlay.ts; the view draws
// them with the fight's own components (src/view/run/TipScene.tsx), so a picture can never disagree
// with the screen it explains.
// test/tips.test.ts checks every id here and every multiplier a scene promises.

import type { StatKey } from '../engine/content';
import type { Gem } from '../run/gems';

/** A fighter in a scene. */
export interface TipSceneFighter {
  heroId: string;
  /** Fraction of max Mana held; full when omitted. */
  mana?: number;
  /** Fraction of max HP held; full when omitted. */
  hp?: number;
  /** The level on its nameplate; the scenes' level 5 when omitted. */
  level?: number;
  stages?: Partial<Record<StatKey, number>>;
  /** Statuses it wears, drawn on its card exactly as a fight draws them. */
  statuses?: readonly SceneStatus[];
}

/** A status as a card wears it: the number on its badge and the rounds its pips count. */
export interface SceneStatus {
  statusId: string;
  magnitude?: number;
  duration?: number;
}

/** What a page rings. Every focus names one kind of mark, never a region. */
export type TipSceneFocus =
  | 'manaGem'
  | 'mpBar'
  | 'kindBadge'
  | 'typeIcon'
  | 'heroTypes'
  | 'foeTypes'
  | 'matchups'
  | 'reach'
  | 'move'
  | 'foe'
  | 'stageMarks'
  | 'rest'
  | 'switch'
  | 'bag'
  | 'field'
  | 'posters'
  | 'bar'
  | 'stock'
  | 'heroCards'
  | 'statuses';

/** A part of a move row a scene labels in place, with a line to it. */
export type TipSceneCallout = 'mana' | 'type' | 'rider' | 'kind' | 'power' | 'matchup';

export interface TipScene {
  /** Enemy figures across the top; a damage row shows its matchup against each. */
  foes?: readonly TipSceneFighter[];
  /** The player's hero, as a figure, and the caster of `moves`. */
  hero: TipSceneFighter;
  /** Draw the hero's figure (its moves are drawn either way). */
  heroFigure?: boolean;
  /** The hero's move rows, in order. */
  moves?: readonly string[];
  /** The out-of-Mana Rest row in place of the moves. */
  rest?: boolean;
  /** The command bar under the moves. */
  bar?: boolean;
  /** A Field Effect plaque. */
  field?: string;
  /** A short tag on a move row, by move id ("+25%" on the STAB row). */
  tags?: Readonly<Record<string, string>>;
  focus?: readonly TipSceneFocus[];
  /** Restrict a row-level focus to these moves. */
  focusMoves?: readonly string[];
  /** Parts of the first focus row named in place, each ringed with its label beside it. */
  callouts?: readonly TipSceneCallout[];
  /** The matchup each damage row must show against each foe, row by row — checked by test. */
  expect?: Readonly<Record<string, readonly number[]>>;
}

/** A roster hero at a Guild Hall counter. */
export interface TipHallHero {
  heroId: string;
  mastery?: number;
  items?: readonly string[];
  /** HP missing, as a fraction of max. */
  wounded?: number;
}

/** A Guild Hall counter, staged: the hall's own panel on a made-up visit, with a piece already picked. */
export interface TipHallScene {
  hall: 'tavern' | 'gems' | 'gear';
  roster: readonly TipHallHero[];
  /** Tavern hires, by hero id. */
  hires?: readonly string[];
  gems?: readonly Gem[];
  items?: readonly string[];
  /** The stock slot already picked (Gems, Gear). */
  pick?: number;
  gold: number;
  focus?: readonly TipSceneFocus[];
}

/**
 * One status, drawn as its badge round by round (the badge a fight draws, larger), each step with a
 * short note under it: how a Burn dies down, how a Poison's timer fills.
 */
export interface TipStatusScene {
  status: string;
  steps: readonly { magnitude?: number; duration?: number; note?: string }[];
}

/** A roll call of heroes, one a type, each over its type's badge. */
export interface TipRollScene {
  roll: readonly string[];
}

export type TipPicture = TipScene | TipHallScene | TipRollScene | TipStatusScene;

export function isHallScene(scene: TipPicture): scene is TipHallScene {
  return 'hall' in scene;
}

export function isRollScene(scene: TipPicture): scene is TipRollScene {
  return 'roll' in scene;
}

export function isStatusScene(scene: TipPicture): scene is TipStatusScene {
  return 'steps' in scene;
}

/** One base hero of every draftable type, in the chart's order: faces the Story's player meets first where it can. */
export const TYPE_ROLL = [
  'cinderKnight',
  'tidecaller',
  'rime',
  'raiju',
  'crag',
  'wildOracle',
  'dawnwarden',
  'nightshade',
  'runescribe',
  'drift',
  'revenant',
  'valor',
  'forgewright',
  'packAlpha',
] as const;

// --- The casts ---

/** A Fire caster against a foe Fire beats and one that shrugs it off. */
const TYPES_CAST = {
  hero: { heroId: 'crimson' },
  foes: [{ heroId: 'wildOracle' }, { heroId: 'leviathan' }],
} as const;

/** Cinder's kit with one of each kind of move. */
const KINDS_MOVES = ['singe', 'ember', 'kindle', 'weaken'] as const;

/** A Water hero against the Dragon (Fire/Ancient): the strong move breaks even, the rest are halved. */
const ANCIENT_CAST = {
  hero: { heroId: 'leviathan' },
  foes: [{ heroId: 'dragon' }],
  moves: ['siphon', 'jolt'],
} as const;

/** The same three heroes at every counter, so the pages read as one visit. */
const HALL_ROSTER = ['cinderKnight', 'wildOracle', 'leviathan'] as const;

/** Cinder over two moves, part-way down the blue bar. */
const MANA_SCENE: TipScene = { hero: { heroId: 'cinderKnight', mana: 0.6 }, heroFigure: true, moves: ['singe', 'kindle'], focus: ['manaGem', 'mpBar'] };

const MATCHUP_SCENE: TipScene = { ...TYPES_CAST, moves: ['ember'], focus: ['matchups'], expect: { ember: [2, 0.5] } };

/** One target, both, and one at random, against the same pair. */
const TARGETS_SCENE: TipScene = {
  ...TYPES_CAST,
  moves: ['ember', 'firestorm', 'jackpot'],
  focus: ['matchups'],
  expect: { ember: [2, 0.5], firestorm: [2, 0.5] },
};

const SWITCH_SCENE: TipScene = { hero: { heroId: 'cinderKnight' }, bar: true, focus: ['switch'] };

/** The Story prologue's second round: the White Stag, which Iron cuts and Beast glances off. */
const HUNT_FOES = [{ heroId: 'stag', level: 1 }] as const;
const HUNT_VALOR = { heroId: 'valorPrologue', level: 2 } as const;

/** Per tip or How to Play page, per page: the picture above the words, or null for none. */
export const TIP_SCENES: Readonly<Record<string, readonly (TipPicture | null)[]>> = {
  'fight.basics': [null, MANA_SCENE, { ...TARGETS_SCENE, moves: ['ember', 'firestorm'] }],
  bench: [null, null, SWITCH_SCENE],
  // Valor's Iron Fist against the Hunt's stag, every part of the row named in place.
  'howto.combat': [
    null,
    { foes: HUNT_FOES, hero: HUNT_VALOR, moves: ['ironFist'], callouts: ['mana', 'type', 'kind', 'power', 'matchup'], expect: { ironFist: [2] } },
  ],
  'howto.mana': [MANA_SCENE],
  'howto.rest': [{ hero: { heroId: 'cinderKnight', mana: 0 }, heroFigure: true, rest: true, focus: ['rest', 'mpBar'] }],
  'howto.types': [
    MATCHUP_SCENE,
    {
      hero: { heroId: 'cinderKnight' },
      heroFigure: true,
      moves: ['singe', 'rockToss'],
      tags: { singe: '+25%' },
      focus: ['typeIcon', 'heroTypes'],
    },
  ],
  'howto.targets': [
    TARGETS_SCENE,
    { ...TYPES_CAST, moves: ['ironFist', 'tideGuard'], focus: ['reach'] },
    { ...TYPES_CAST, moves: ['snowBlast'], focus: ['reach'] },
  ],
  'howto.kinds': [{ hero: { heroId: 'cinderKnight' }, moves: KINDS_MOVES, focus: ['kindBadge'], focusMoves: ['singe', 'ember'] }],
  'howto.stages': [
    { hero: { heroId: 'cinderKnight' }, moves: KINDS_MOVES, focus: ['kindBadge'], focusMoves: ['kindle', 'weaken'] },
    { hero: { heroId: 'cinderKnight', stages: { attack: 2, speed: -1 } }, heroFigure: true, focus: ['stageMarks'] },
  ],
  'howto.bench': [SWITCH_SCENE],
  'howto.heals': [{ hero: { heroId: 'dawnwarden' }, moves: ['glimmer', 'mend'], focus: ['kindBadge'], focusMoves: ['mend'] }],
  // A hero wearing three statuses at once, every badge ringed.
  'howto.statuses': [
    {
      hero: { heroId: 'raiju', statuses: [{ statusId: 'Burn', duration: 2 }, { statusId: 'Shield', magnitude: 30 }, { statusId: 'Poison', magnitude: 10, duration: 2 }] },
      heroFigure: true,
      focus: ['statuses'],
    },
  ],
  // Raiju's Rime Coat, its Shield named in place; then the Shield on a hero, as the fight draws it.
  'howto.status.Shield': [
    { hero: { heroId: 'raiju', level: 4 }, moves: ['rimeCoat'], callouts: ['rider'] },
    { hero: { heroId: 'ironWarden', statuses: [{ statusId: 'Shield', magnitude: 30 }] }, heroFigure: true, focus: ['statuses'] },
  ],
  'howto.status.Burn': [{ status: 'Burn', steps: [{ duration: 3, note: '15%' }, { duration: 2, note: '8%' }, { duration: 1, note: '4%' }] }],
  'howto.status.Poison': [
    { status: 'Poison', steps: [{ magnitude: 10, duration: 3, note: 'Lands' }, { magnitude: 10, duration: 2, note: 'Fills' }, { magnitude: 10, duration: 1, note: 'Goes off' }] },
  ],
  'howto.status.Renew': [{ status: 'Renew', steps: [{ duration: 3, note: '+10%' }, { duration: 2, note: '+10%' }, { duration: 1, note: '+10%' }] }],
  'howto.status.Bleed': [{ status: 'Bleed', steps: [{ note: '6% a round' }] }],
  'howto.status.Freeze': [{ status: 'Freeze', steps: [{ note: 'Speed ½' }] }],
  'howto.status.Daze': [{ status: 'Daze', steps: [{ note: 'This round' }] }],
  'howto.status.Barrier': [{ status: 'Barrier', steps: [{ note: 'This round' }] }],
  'howto.status.Provoke': [{ status: 'Provoke', steps: [{ note: 'This round' }] }],
  // Raiju's Storm Lash, its Conduct named in place, against the Clearing's Slabback.
  'howto.status.Conduct': [{ foes: [{ heroId: 'slabback', level: 12 }], hero: { heroId: 'raiju', level: 4 }, moves: ['stormLash'], callouts: ['rider'] }],
  'howto.bag': [{ hero: { heroId: 'cinderKnight' }, bar: true, focus: ['bag'] }],
  'howto.field': [{ hero: { heroId: 'cinderKnight' }, field: 'scorchedLand', focus: ['field'] }],
  'howto.ancient': [
    { ...ANCIENT_CAST, moves: [], focus: ['foeTypes'] },
    { ...ANCIENT_CAST, focus: ['matchups'], expect: { siphon: [1], jolt: [0.5] } },
  ],
  'howto.guildHall': [
    {
      hall: 'tavern',
      roster: [{ heroId: HALL_ROSTER[0] }, { heroId: HALL_ROSTER[1], wounded: 0.4 }, { heroId: HALL_ROSTER[2] }],
      hires: ['crimson', 'sentinel'],
      gold: 120,
      focus: ['posters', 'bar'],
    },
    {
      hall: 'gems',
      roster: [
        { heroId: HALL_ROSTER[0], mastery: 2 },
        { heroId: HALL_ROSTER[1], mastery: 4 },
        { heroId: HALL_ROSTER[2], mastery: 1 },
      ],
      gems: [
        { stat: 'attack', points: 5 },
        { stat: 'hp', points: 5 },
        { stat: 'speed', points: 5 },
      ],
      pick: 0,
      gold: 120,
      focus: ['stock', 'heroCards'],
    },
    {
      hall: 'gear',
      roster: [
        { heroId: HALL_ROSTER[0], items: ['sword.common'] },
        { heroId: HALL_ROSTER[1] },
        { heroId: HALL_ROSTER[2], items: ['dagger.common', 'bow.common', 'spear.common'] },
      ],
      items: ['sword.common', 'greataxe.rare', 'bow.rare'],
      pick: 0,
      gold: 120,
      focus: ['stock', 'heroCards'],
    },
  ],
};
