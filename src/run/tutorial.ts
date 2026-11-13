// The tutorial's road (docs/the-tutorial.md §3): the scripted fight's party carried onto a map of
// one stop a row, as a run's own screens read it.

import type { HeroLookup } from '../engine/state';
import type { CombatState } from '../engine/state';
import type { MapNodeType, RunMap } from './map';
import { createRunState, type RunState } from './state';
import { STORY_PLAYER_SIDE } from './story';
import { recordWounds } from './wounds';

const nodeId = (row: number) => `tutorial-${row}`;

/** A map of `types`, one node a row, each leading to the next. */
export function roadMap(types: readonly MapNodeType[]): RunMap {
  const nodes = Object.fromEntries(
    types.map((type, row) => [nodeId(row), { id: nodeId(row), type, row, col: 0, nextIds: row + 1 < types.length ? [nodeId(row + 1)] : [] }])
  );
  return { seed: 0, nodes, rows: types.map((_, row) => [nodeId(row)]), startNodeIds: [nodeId(0)], bossNodeId: nodeId(types.length - 1) };
}

/** The fight's party as a run on the road: wounds and knockouts kept, every innate awake again. */
export function partyAfterFight(party: RunState, state: CombatState, heroes: HeroLookup, road: readonly MapNodeType[], locationId: string): RunState {
  const wounded = recordWounds(party, state, STORY_PLAYER_SIDE, heroes);
  return {
    ...createRunState(),
    roster: wounded.roster.map(({ innateQuiet: _quiet, ...entry }) => entry),
    map: roadMap(road),
    locationIds: [locationId],
  };
}
