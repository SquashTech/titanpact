// The sky (docs/the-sky.md §2–§4): the rails first, then the Infinite, then the modes that already exist,
// each as a constellation. Shapes and placements are first pass, for the sky screen to tune.
// The rail scenarios are named seats, uncharted until their fights are authored (§10, phase 6).

import type { ConstellationDefinition, ScenarioDefinition, SkyContent, SkyStar } from '../run/sky';
import { TRIAL_LIST } from './trials';

const WIN = { kind: 'win' } as const;

const RAIL_SCENARIOS: readonly ScenarioDefinition[] = [
  { id: 'firstLight.move', name: 'Read a Move', goal: WIN, modifiers: {} },
  { id: 'firstLight.matchup', name: 'The Matchup', goal: WIN, modifiers: {} },
  { id: 'firstLight.target', name: 'Two at Once', goal: WIN, modifiers: {} },
  { id: 'firstLight.order', name: 'Who Goes First', goal: WIN, modifiers: {} },
  { id: 'bench.switch', name: 'The Switch', goal: WIN, modifiers: {} },
  { id: 'bench.rest', name: 'Rest', goal: WIN, modifiers: {} },
  { id: 'bench.lockIn', name: 'Locked In', goal: WIN, modifiers: {} },
  { id: 'road.act', name: 'The Road', goal: WIN, modifiers: { acts: 1 } },
];

const scenarioStar = (scenarioId: string, x: number, y: number): SkyStar => ({ id: scenarioId, x, y, light: { kind: 'scenario', scenarioId } });

/** A ring of `count` points, for a constellation with one star per Trial. */
function ring(count: number, i: number): { x: number; y: number } {
  const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
  return { x: 0.5 + 0.45 * Math.cos(angle), y: 0.5 + 0.45 * Math.sin(angle) };
}

const CONSTELLATIONS: readonly ConstellationDefinition[] = [
  {
    id: 'firstLight',
    name: 'First Light',
    at: { x: 0.2, y: 0.85 },
    stars: [
      scenarioStar('firstLight.move', 0.1, 0.8),
      scenarioStar('firstLight.matchup', 0.4, 0.5),
      scenarioStar('firstLight.target', 0.7, 0.65),
      scenarioStar('firstLight.order', 0.9, 0.2),
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
    after: [],
    rail: true,
    uncharted: true,
    rewards: [{ kind: 'stardust', amount: 100 }],
  },
  {
    id: 'theBench',
    name: 'The Bench',
    at: { x: 0.5, y: 0.75 },
    stars: [scenarioStar('bench.switch', 0.15, 0.3), scenarioStar('bench.rest', 0.5, 0.75), scenarioStar('bench.lockIn', 0.85, 0.3)],
    lines: [
      [0, 1],
      [1, 2],
      [2, 0],
    ],
    after: ['firstLight'],
    rail: true,
    uncharted: true,
    rewards: [{ kind: 'stardust', amount: 100 }],
  },
  {
    id: 'theRoad',
    name: 'The Road',
    at: { x: 0.8, y: 0.62 },
    stars: [scenarioStar('road.act', 0.5, 0.5)],
    lines: [],
    after: ['theBench'],
    rail: true,
    uncharted: true,
    rewards: [{ kind: 'stardust', amount: 100 }],
  },
  {
    id: 'journey',
    name: 'The Infinite',
    at: { x: 0.5, y: 0.45 },
    stars: [{ id: 'journey.won', x: 0.5, y: 0.5, light: { kind: 'journeyWon' } }],
    lines: [],
    after: ['theRoad'],
    rewards: [],
  },
  {
    id: 'cycles',
    name: 'The Cycles',
    at: { x: 0.5, y: 0.12 },
    stars: [1, 2, 3, 4, 5].map((cycle, i) => ({ id: `cycles.${cycle}`, x: 0.05 + i * 0.225, y: i % 2 ? 0.3 : 0.7, light: { kind: 'cycleCleared', cycle } })),
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
    after: ['journey'],
    rewards: [],
  },
  {
    id: 'trials',
    name: 'The Trials',
    at: { x: 0.17, y: 0.35 },
    stars: TRIAL_LIST.map((trial, i) => ({ id: `trials.${trial.id}`, ...ring(TRIAL_LIST.length, i), light: { kind: 'trialBeaten', trialId: trial.id } })),
    lines: TRIAL_LIST.map((_, i) => [i, (i + 1) % TRIAL_LIST.length] as const),
    after: ['journey'],
    rewards: [],
  },
  {
    id: 'gauntlet',
    name: 'The Gauntlet',
    at: { x: 0.83, y: 0.33 },
    stars: [{ id: 'gauntlet.cleared', x: 0.5, y: 0.5, light: { kind: 'gauntletCleared' } }],
    lines: [],
    after: ['journey'],
    rewards: [],
  },
];

export const sky: SkyContent = {
  constellations: Object.fromEntries(CONSTELLATIONS.map((c) => [c.id, c])),
  scenarios: Object.fromEntries(RAIL_SCENARIOS.map((s) => [s.id, s])),
};
