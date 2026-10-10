// The staged pictures fight tips show (docs/tutorial.md "Scenes"): which heroes, which moves, which
// part is ringed. Words stay in tips.ts; the view draws these with the fight's own components
// (src/view/run/TipScene.tsx), so a picture can never disagree with the screen it explains.
// test/tips.test.ts checks every id here and every multiplier a scene promises.

import type { StatKey } from '../engine/content';

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
  | 'move'
  | 'foe'
  | 'stageMarks'
  | 'rest'
  | 'switch'
  | 'bag'
  | 'field';

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

/** Per fight tip, per page: the picture above the words, or null for none. */
export const TIP_SCENES: Readonly<Record<string, readonly (TipScene | null)[]>> = {
  'fight.basics': [
    null,
    { hero: { heroId: 'cinderKnight', mana: 0.6 }, heroFigure: true, moves: ['singe', 'kindle'], focus: ['manaGem', 'mpBar'] },
    { foes: [{ heroId: 'wildOracle' }], hero: { heroId: 'cinderKnight' }, moves: ['singe'], focus: ['foe', 'move'] },
  ],
  'fight.stages': [
    { hero: { heroId: 'cinderKnight', stages: { attack: 2, speed: -1 } }, heroFigure: true, focus: ['stageMarks'] },
    null,
  ],
  'fight.switching': [{ hero: { heroId: 'cinderKnight' }, bar: true, focus: ['switch'] }, null, null],
  'fight.types': [
    { ...TYPES_CAST, moves: ['ember'], focus: ['matchups'], expect: { ember: [2, 0.5] } },
    {
      hero: { heroId: 'cinderKnight' },
      heroFigure: true,
      moves: ['singe', 'rockToss'],
      tags: { singe: '+25%' },
      focus: ['typeIcon', 'heroTypes'],
    },
  ],
  'fight.attacks': [
    { hero: { heroId: 'cinderKnight' }, moves: KINDS_MOVES, focus: ['kindBadge'], focusMoves: ['singe', 'ember'] },
    { hero: { heroId: 'cinderKnight' }, moves: KINDS_MOVES, focus: ['kindBadge'], focusMoves: ['kindle', 'weaken'] },
  ],
  'fight.rest': [{ hero: { heroId: 'cinderKnight', mana: 0 }, heroFigure: true, rest: true, focus: ['rest', 'mpBar'] }],
  'fight.ancient': [
    { ...ANCIENT_CAST, moves: [], focus: ['foeTypes'] },
    { ...ANCIENT_CAST, focus: ['matchups'], expect: { siphon: [1], jolt: [0.5] } },
    null,
  ],
  'fight.bag': [{ hero: { heroId: 'cinderKnight' }, bar: true, focus: ['bag'] }],
  'fight.field': [{ hero: { heroId: 'cinderKnight' }, field: 'scorchedLand', focus: ['field'] }],
};

