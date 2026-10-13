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
  stages?: Partial<Record<StatKey, number>>;
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
  | 'heroCards';

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

export type TipPicture = TipScene | TipHallScene;

export function isHallScene(scene: TipPicture): scene is TipHallScene {
  return 'hall' in scene;
}

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

/** Per tip or How to Play section, per page: the picture above the words, or null for none. */
export const TIP_SCENES: Readonly<Record<string, readonly (TipPicture | null)[]>> = {
  'fight.basics': [null, MANA_SCENE, { ...TARGETS_SCENE, moves: ['ember', 'firestorm'] }],
  bench: [null, null, SWITCH_SCENE],
  'howto.combat': [null, { foes: [{ heroId: 'wildOracle' }], hero: { heroId: 'cinderKnight' }, moves: ['singe'], focus: ['foe', 'move'] }],
  'howto.mana': [MANA_SCENE, { hero: { heroId: 'cinderKnight', mana: 0 }, heroFigure: true, rest: true, focus: ['rest', 'mpBar'] }],
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
  'howto.kinds': [
    { hero: { heroId: 'cinderKnight' }, moves: KINDS_MOVES, focus: ['kindBadge'], focusMoves: ['singe', 'ember'] },
    { hero: { heroId: 'cinderKnight' }, moves: KINDS_MOVES, focus: ['kindBadge'], focusMoves: ['kindle', 'weaken'] },
  ],
  'howto.stages': [{ hero: { heroId: 'cinderKnight', stages: { attack: 2, speed: -1 } }, heroFigure: true, focus: ['stageMarks'] }],
  'howto.bench': [null, null, SWITCH_SCENE],
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
