// ⚠️ TEST FIXTURE CONTENT — a level-up move pool and rank-up branches for the
// 6 fixture heroes, enough to exercise both consequences of leveling end to
// end (docs/leveling-and-ranks.md: a level-up "progresses toward a rank-up"
// and "offers a random move"). Each hero's starting kit (src/data/heroes.ts)
// is deliberately small — a low-power main-type move plus 1-2 support moves
// — so the moveTiers pool below is where the rest of a hero's thematic
// movepool lives, offered randomly (not in authored order) as the hero
// levels up toward the 4-move cap (src/run/progression.ts MOVE_CAP). Not the
// authored 53-hero progression content.
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
    cinderKnight: ['emberSlash', 'flareBurst', 'quickJab', 'fangRush', 'cinderNova', 'infernoWave'],
    tidecaller: ['aquaJet', 'tsunamiCrash', 'frostLock', 'ripCurrent', 'mendWounds', 'curseMind'],
    ironWarden: ['boulderToss', 'shrapnelBlast', 'stoneQuake', 'ironFist', 'fortify'],
    wildOracle: ['wildfire', 'vineLash', 'soulRend', 'rendingClaw', 'naturesWrath'],
    stormRanger: ['quickJab', 'thunderclap', 'galeSlash', 'fangRush'],
    shadowMonk: ['duskStrike', 'shadowVeil', 'fangRush', 'quickJab', 'nightmareGrasp'],
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
