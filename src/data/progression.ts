// ⚠️ TEST FIXTURE CONTENT — a level-up move pool and rank-up branches for 2 of
// the 6 fixture heroes (cinderKnight, tidecaller), enough to exercise both
// consequences of leveling end to end (docs/leveling-and-ranks.md: a
// level-up "progresses toward a rank-up" and "offers a random move"). The
// other 4 fixture heroes intentionally have no entries here — an empty pool
// is a valid state (nothing left to offer), not a bug. Not the authored
// 53-hero progression content.
//
// SCOPE NOTE: branches are stat-only (statGrants, no unlocksMoveIds) — kept
// deliberately separate from the level-up move pool so the two growth axes
// don't gate the same content twice. cinderKnight's defensive branch also
// carries a typeGraft, purely to exercise the type-graft mechanic
// (docs/progression.md "Type-graft branches") end to end — "Ember Bulwark"
// grafting Stone onto the mono-Fire Cinder Knight is a fixture flavor pick,
// not authored canon.

import type { ProgressionTable } from '../run/progression';

export const progressionTable: ProgressionTable = {
  moveTiers: {
    cinderKnight: ['cinderNova'],
    tidecaller: ['ripCurrent'],
  },
  rankUps: {
    cinderKnight: [
      {
        threshold: 3,
        branches: [
          {
            id: 'cinderKnight-offensive',
            heroId: 'cinderKnight',
            kind: 'offensive',
            name: 'Blazing Vanguard',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'cinderKnight-defensive',
            heroId: 'cinderKnight',
            kind: 'defensive',
            name: 'Ember Bulwark',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Stone',
          },
        ],
      },
    ],
    tidecaller: [
      {
        threshold: 3,
        branches: [
          {
            id: 'tidecaller-offensive',
            heroId: 'tidecaller',
            kind: 'offensive',
            name: 'Deluge Adept',
            statGrants: { intelligence: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'tidecaller-utility',
            heroId: 'tidecaller',
            kind: 'utility',
            name: 'Mana Current',
            statGrants: { manaPool: 10, mpRegen: 5 },
            unlocksMoveIds: [],
          },
        ],
      },
    ],
  },
};
