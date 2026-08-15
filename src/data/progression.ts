// ⚠️ TEST FIXTURE CONTENT — tiered moves and rank-up branches for 2 of the 6
// fixture heroes (cinderKnight, tidecaller), enough to exercise both halves
// of the pooled level-up currency end to end (docs/progression.md: level-ups
// "progress a hero toward a rank-up, and unlock moves from the current
// tier"). The other 4 fixture heroes intentionally have no entries here — an
// empty table is a valid state (nothing to invest in yet), not a bug. Not the
// authored 53-hero progression content.
//
// SCOPE NOTE: branches are stat-only (statGrants, no unlocksMoveIds) — kept
// deliberately separate from the tier-move unlocks so the two spend paths
// (progress vs. moves) don't gate the same content twice. cinderKnight's
// defensive branch also carries a typeGraft, purely to exercise the
// type-graft mechanic (docs/progression.md "Type-graft branches") end to
// end — "Ember Bulwark" grafting Stone onto the mono-Fire Cinder Knight is a
// fixture flavor pick, not authored canon.

import type { ProgressionTable } from '../run/progression';

export const progressionTable: ProgressionTable = {
  moveTiers: {
    cinderKnight: [{ moveId: 'cinderNova', cost: 2 }],
    tidecaller: [{ moveId: 'ripCurrent', cost: 2 }],
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
