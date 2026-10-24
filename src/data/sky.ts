// The sky (docs/the-sky.md §2–§4): five constellations, one a way to play. First Light holds the
// lessons, the Infinite its five Cycles, the Trials one star a Trial, the Gauntlet its clears, and
// Strange Worlds the twisted runs to come. Each is drawn in a band of its own; shapes are first pass.
// The lessons are data/lessons.ts's; Strange Worlds is named seats, uncharted until its scenarios are authored (§10).

import type { ConstellationDefinition, ScenarioDefinition, SkyContent, SkyStar } from '../run/sky';
import { TRIAL_LIST } from './trials';

const WIN = { kind: 'win' } as const;

const scenario = (id: string, name: string): ScenarioDefinition => ({ id, name, goal: WIN, modifiers: {} });
/** A First Light lesson plays the chapter of data/lessons.ts that shares its id. */
const lesson = (id: string, name: string): ScenarioDefinition => ({ ...scenario(id, name), lesson: id });

const SCENARIOS: readonly ScenarioDefinition[] = [
  lesson('firstLight.hunt', 'The Hunt'),
  lesson('firstLight.clearing', 'The Clearing'),
  lesson('firstLight.road', 'The Road'),
  lesson('firstLight.fork', 'The Fork'),
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
    // The two guided fights rise to the two acts, played in that order.
    stars: [
      scenarioStar('firstLight.hunt', 0.06, 0.82),
      scenarioStar('firstLight.clearing', 0.36, 0.56),
      scenarioStar('firstLight.road', 0.66, 0.64),
      scenarioStar('firstLight.fork', 0.94, 0.2),
    ],
    lines: chain(4),
    after: [],
    rail: true,
    rewards: [{ kind: 'stardust', amount: 300 }],
  },
  {
    id: 'infinite',
    name: 'The Infinite',
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
    // The two fights open it; the two acts stay First Light's to play, never a gate (2026-10-24, per user direction).
    after: ['firstLight.clearing'],
    rewards: [],
  },
  {
    id: 'trials',
    name: 'The Trials',
    stars: TRIAL_LIST.map((trial, i) => ({ id: `trials.${trial.id}`, ...ring(TRIAL_LIST.length, i), light: { kind: 'trialBeaten', trialId: trial.id } })),
    lines: TRIAL_LIST.map((_, i) => [i, (i + 1) % TRIAL_LIST.length] as const),
    after: ['cycles.1'],
    rewards: [],
  },
  {
    id: 'gauntlet',
    name: 'The Gauntlet',
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
