// ⚠️ TEST FIXTURE CONTENT — a level-up move pool and Evolution paths for the
// 6 fixture heroes, enough to exercise both consequences of leveling end to
// end (docs/leveling-and-ranks.md: a level-up either "offers a random move"
// or, at EVOLUTION_LEVEL, surfaces the Evolution choice instead). Each
// hero's starting kit (src/data/heroes.ts) is deliberately small — a
// low-power main-type move plus 1-2 support moves — so the moveTiers pool
// below is where the rest of a hero's thematic movepool lives, offered
// randomly (not in authored order) as the hero levels up toward the 4-move
// cap (src/run/progression.ts MOVE_CAP). Not the authored 53-hero
// progression content.
//
// SCOPE NOTE: paths are stat-only (statGrants, no unlocksMoveIds) — kept
// deliberately separate from the level-up move pool so the two growth axes
// don't gate the same content twice. Every fixture hero's evolution node
// sits at EVOLUTION_LEVEL and offers exactly three paths differing in kind
// (CLAUDE.md "the player is presented with a choice of three options"),
// demonstrating the shape the real 53-hero roster's authored Evolutions
// (docs/leveling-and-ranks.md) will need to follow: one offensive, one
// defensive, one utility — not every path grafts a type ("mono remains a
// legitimate terminal state", docs/progression.md). cinderKnight's
// defensive path and tidecaller's defensive path each carry a typeGraft,
// purely to exercise the type-graft mechanic (docs/progression.md
// "Type-graft paths") end to end — the specific names and secondary types
// below are fixture flavor picks, not authored canon.

import type { ProgressionTable } from '../run/progression';
import { EVOLUTION_LEVEL } from '../run/progression';

export const progressionTable: ProgressionTable = {
  moveTiers: {
    cinderKnight: ['emberSlash', 'flareBurst', 'quickJab', 'fangRush', 'cinderNova', 'infernoWave'],
    tidecaller: ['aquaJet', 'tsunamiCrash', 'frostLock', 'ripCurrent', 'mendWounds', 'curseMind'],
    ironWarden: ['boulderToss', 'shrapnelBlast', 'stoneQuake', 'ironFist', 'fortify'],
    wildOracle: ['wildfire', 'vineLash', 'soulRend', 'rendingClaw', 'naturesWrath'],
    stormRanger: ['quickJab', 'thunderclap', 'galeSlash', 'fangRush'],
    shadowMonk: ['duskStrike', 'shadowVeil', 'fangRush', 'quickJab', 'nightmareGrasp'],
    glacialWarden: ['frostBite', 'purify', 'mendWounds', 'weaken'],
    dawnwarden: ['sunstrike', 'healingRain', 'fortify', 'exposeWeakness'],
    runescribe: ['mindSpike', 'psychicLance', 'weaken', 'curseMind'],
    mindweaver: ['exposeWeakness', 'quickJab', 'corruptingTouch', 'stunningBlow'],
    forgewright: ['ironFist', 'shrapnelBlast', 'quickJab', 'stunningBlow'],
    packAlpha: ['rendingClaw', 'quickJab', 'fortify', 'weaken'],
  },
  evolutions: {
    cinderKnight: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
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
          {
            id: 'cinderKnight-utility',
            heroId: 'cinderKnight',
            kind: 'utility',
            name: 'Kindled Spirit',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
          },
        ],
      },
    ],
    tidecaller: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'tidecaller-offensive',
            heroId: 'tidecaller',
            kind: 'offensive',
            name: 'Deluge Adept',
            statGrants: { intelligence: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'tidecaller-defensive',
            heroId: 'tidecaller',
            kind: 'defensive',
            name: 'Glacial Bastion',
            statGrants: { defense: 10, wisdom: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Frost',
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
