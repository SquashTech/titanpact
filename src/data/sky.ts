// The sky (docs/the-sky.md §2–§4): five constellations, one a way to play. First Light holds the
// lessons, the Infinite its five Cycles, the Trials one star a Trial, the Gauntlet its clears, and
// Strange Worlds the twisted runs to come. The sky is 340 × 540; shapes and placements are first pass.
// The lessons and Strange Worlds are named seats, uncharted until their scenarios are authored (§10).

import type { ConstellationDefinition, ScenarioDefinition, SkyContent, SkyStar } from '../run/sky';
import { TRIAL_LIST } from './trials';

/** The sky's own units: a chart point is laid out on this box. */
export const SKY_WIDTH = 340;
export const SKY_HEIGHT = 540;

const WIN = { kind: 'win' } as const;

const scenario = (id: string, name: string, acts?: number): ScenarioDefinition => ({ id, name, goal: WIN, modifiers: acts ? { acts } : {} });

const SCENARIOS: readonly ScenarioDefinition[] = [
  scenario('firstLight.move', 'Read a Move'),
  scenario('firstLight.matchup', 'The Matchup'),
  scenario('firstLight.target', 'Two at Once'),
  scenario('firstLight.order', 'Who Goes First'),
  scenario('bench.switch', 'The Switch'),
  scenario('bench.rest', 'Rest'),
  scenario('bench.lockIn', 'Locked In'),
  scenario('road.act', 'The Road', 1),
  scenario('strange.monotype', 'One Type'),
  scenario('strange.newPlace', 'A New Place'),
  scenario('strange.strangers', 'Strangers'),
  scenario('strange.oneGuardian', 'One Guardian'),
  scenario('strange.fixedBand', 'A Fixed Band'),
  scenario('strange.puzzles', 'Puzzles'),
];

const scenarioStar = (scenarioId: string, x: number, y: number): SkyStar => ({ id: scenarioId, x, y, light: { kind: 'scenario', scenarioId } });
const chain = (n: number) => Array.from({ length: n - 1 }, (_, i) => [i, i + 1] as const);

/** A ring of `count` points, for a constellation with one star per Trial. */
function ring(count: number, i: number): { x: number; y: number } {
  const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
  return { x: 0.5 + 0.46 * Math.cos(angle), y: 0.5 + 0.46 * Math.sin(angle) };
}

const CONSTELLATIONS: readonly ConstellationDefinition[] = [
  {
    id: 'firstLight',
    name: 'First Light',
    at: { x: 0.25, y: 0.86 },
    size: 0.25,
    stars: [
      scenarioStar('firstLight.move', 0.04, 0.82),
      scenarioStar('firstLight.matchup', 0.18, 0.6),
      scenarioStar('firstLight.target', 0.31, 0.72),
      scenarioStar('firstLight.order', 0.44, 0.45),
      scenarioStar('bench.switch', 0.57, 0.56),
      scenarioStar('bench.rest', 0.7, 0.3),
      scenarioStar('bench.lockIn', 0.83, 0.4),
      scenarioStar('road.act', 0.96, 0.16),
    ],
    lines: chain(8),
    after: [],
    rail: true,
    uncharted: true,
    rewards: [{ kind: 'stardust', amount: 300 }],
  },
  {
    id: 'infinite',
    name: 'The Infinite',
    at: { x: 0.5, y: 0.49 },
    size: 0.47,
    // A pentagram, Cycle I at its crown, drawn star to star the way it is cleared.
    stars: [
      [0.5, 0.04],
      [0.96, 0.38],
      [0.78, 0.94],
      [0.22, 0.94],
      [0.04, 0.38],
    ].map(([x, y], i) => ({ id: `cycles.${i + 1}`, x, y, light: { kind: 'cycleCleared', cycle: i + 1 } })),
    lines: [
      [0, 2],
      [2, 4],
      [4, 1],
      [1, 3],
      [3, 0],
    ],
    after: ['road.act'],
    rewards: [],
  },
  {
    id: 'trials',
    name: 'The Trials',
    at: { x: 0.22, y: 0.31 },
    size: 0.31,
    stars: TRIAL_LIST.map((trial, i) => ({ id: `trials.${trial.id}`, ...ring(TRIAL_LIST.length, i), light: { kind: 'trialBeaten', trialId: trial.id } })),
    lines: TRIAL_LIST.map((_, i) => [i, (i + 1) % TRIAL_LIST.length] as const),
    after: ['cycles.1'],
    rewards: [],
  },
  {
    id: 'gauntlet',
    name: 'The Gauntlet',
    at: { x: 0.8, y: 0.31 },
    size: 0.25,
    // Crossed blades, the centre the first clear.
    stars: [
      [0.5, 0.5],
      [0.1, 0.1],
      [0.9, 0.9],
      [0.9, 0.1],
      [0.1, 0.9],
    ].map(([x, y], i) => ({ id: `gauntlet.${i + 1}`, x, y, light: { kind: 'gauntletCleared', count: i + 1 } })),
    lines: [
      [1, 0],
      [0, 2],
      [3, 0],
      [0, 4],
    ],
    after: ['cycles.1'],
    rewards: [],
  },
  {
    id: 'strange',
    name: 'Strange Worlds',
    at: { x: 0.76, y: 0.1 },
    size: 0.22,
    stars: [
      scenarioStar('strange.monotype', 0.5, 0.5),
      scenarioStar('strange.newPlace', 0.64, 0.4),
      scenarioStar('strange.strangers', 0.62, 0.66),
      scenarioStar('strange.oneGuardian', 0.34, 0.62),
      scenarioStar('strange.fixedBand', 0.36, 0.26),
      scenarioStar('strange.puzzles', 0.78, 0.2),
    ],
    lines: chain(6),
    after: ['cycles.1'],
    uncharted: true,
    rewards: [],
  },
];

export const sky: SkyContent = {
  constellations: Object.fromEntries(CONSTELLATIONS.map((c) => [c.id, c])),
  scenarios: Object.fromEntries(SCENARIOS.map((s) => [s.id, s])),
};
