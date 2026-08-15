// ⚠️ TEST FIXTURE CONTENT — 4 heroes sufficient to run a 2v2 fight through the
// engine. Not the authored 53-concept roster (docs/types-and-heroes.md);
// stat lines and typings here are arbitrary and untuned.

import type { HeroDefinition } from '../engine/content';

export const heroes: Record<string, HeroDefinition> = {
  cinderKnight: {
    id: 'cinderKnight',
    name: 'Cinder Knight',
    types: ['Fire'],
    baseStats: { hp: 100, attack: 70, defense: 60, intelligence: 30, wisdom: 40, speed: 50, manaPool: 60, mpRegen: 5 },
    moveIds: ['emberSlash', 'quickJab'],
  },
  tidecaller: {
    id: 'tidecaller',
    name: 'Tidecaller',
    types: ['Water'],
    baseStats: { hp: 90, attack: 40, defense: 50, intelligence: 75, wisdom: 65, speed: 55, manaPool: 80, mpRegen: 8 },
    moveIds: ['tidalBolt'],
  },
  ironWarden: {
    id: 'ironWarden',
    name: 'Iron Warden',
    types: ['Iron', 'Stone'],
    baseStats: { hp: 120, attack: 55, defense: 90, intelligence: 20, wisdom: 50, speed: 30, manaPool: 40, mpRegen: 4 },
    moveIds: ['quickJab'],
  },
  wildOracle: {
    id: 'wildOracle',
    name: 'Wild Oracle',
    types: ['Nature', 'Spirit'],
    baseStats: { hp: 85, attack: 35, defense: 45, intelligence: 80, wisdom: 70, speed: 65, manaPool: 90, mpRegen: 10 },
    moveIds: ['wildfire', 'overload'],
  },
};
