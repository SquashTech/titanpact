// ⚠️ TEST FIXTURE CONTENT — 6 heroes sufficient to run a 2v2 fight and exercise
// bring-6-pick-4 squad selection (src/run) through the engine. Not the
// authored 53-concept roster (docs/types-and-heroes.md); stat lines and
// typings here are arbitrary and untuned.
//
// Starting kits are intentionally small (a cheap/low-power move of the
// hero's main type plus 1-2 support moves — heal/buff/status) rather than
// front-loading a hero's whole eventual kit: MOVE_CAP is 4
// (src/run/progression.ts), so a 3-move starting kit leaves room to grow
// into the cap via level-ups, and a 2-move kit leaves room for two. The rest
// of each hero's thematic movepool lives in src/data/progression.ts'
// moveTiers, offered randomly on level-up instead of granted upfront.

import type { HeroDefinition } from '../engine/content';

export const heroes: Record<string, HeroDefinition> = {
  cinderKnight: {
    id: 'cinderKnight',
    name: 'Cinder Knight',
    types: ['Fire'],
    baseStats: { hp: 100, attack: 70, defense: 60, intelligence: 30, wisdom: 40, speed: 50, manaPool: 60, mpRegen: 5 },
    moveIds: ['cinderBite', 'fortify', 'restoreVigor'],
  },
  tidecaller: {
    id: 'tidecaller',
    name: 'Tidecaller',
    types: ['Water'],
    baseStats: { hp: 90, attack: 40, defense: 50, intelligence: 75, wisdom: 65, speed: 55, manaPool: 80, mpRegen: 8 },
    moveIds: ['tidalBolt', 'healingRain', 'weaken'],
  },
  ironWarden: {
    id: 'ironWarden',
    name: 'Iron Warden',
    types: ['Iron'],
    baseStats: { hp: 120, attack: 55, defense: 90, intelligence: 20, wisdom: 50, speed: 30, manaPool: 40, mpRegen: 4 },
    moveIds: ['quickJab', 'stunningBlow', 'curseMind'],
  },
  wildOracle: {
    id: 'wildOracle',
    name: 'Wild Oracle',
    types: ['Nature'],
    baseStats: { hp: 85, attack: 35, defense: 45, intelligence: 80, wisdom: 70, speed: 65, manaPool: 90, mpRegen: 10 },
    moveIds: ['entanglingRoots', 'mendWounds', 'secondWind'],
  },
  stormRanger: {
    id: 'stormRanger',
    name: 'Storm Ranger',
    types: ['Storm'],
    baseStats: { hp: 80, attack: 65, defense: 40, intelligence: 35, wisdom: 35, speed: 90, manaPool: 50, mpRegen: 6 },
    moveIds: ['galeShot', 'rally', 'exposeWeakness'],
  },
  shadowMonk: {
    id: 'shadowMonk',
    name: 'Shadow Monk',
    types: ['Shadow'],
    baseStats: { hp: 75, attack: 75, defense: 45, intelligence: 40, wisdom: 40, speed: 70, manaPool: 45, mpRegen: 5 },
    moveIds: ['corruptingTouch', 'secondWind', 'purify'],
  },

  // --- New additions: fill Frost/Light/Arcane/Mind/Forge/Beast, the six
  // types with no hero representation yet (Ancient intentionally still
  // skipped — CLAUDE.md "Ancient is special", rarely draftable by design).
  // Same fixture status as the six above: mono-typed, small 3-move starting
  // kits drawn from the already-authored src/data/moves.ts pool, with the
  // rest of each thematic kit left for src/data/progression.ts moveTiers.
  glacialWarden: {
    id: 'glacialWarden',
    name: 'The Abominable',
    types: ['Frost'],
    baseStats: { hp: 95, attack: 30, defense: 55, intelligence: 70, wisdom: 60, speed: 45, manaPool: 70, mpRegen: 7 },
    moveIds: ['glacialSpike', 'frostLock', 'secondWind'],
  },
  dawnwarden: {
    id: 'dawnwarden',
    name: 'Sun Priest',
    types: ['Light'],
    baseStats: { hp: 100, attack: 40, defense: 65, intelligence: 55, wisdom: 85, speed: 40, manaPool: 85, mpRegen: 9 },
    moveIds: ['radiantBeam', 'restoreVigor', 'purify'],
  },
  runescribe: {
    id: 'runescribe',
    name: 'Runescribe',
    types: ['Arcane'],
    baseStats: { hp: 70, attack: 25, defense: 35, intelligence: 85, wisdom: 45, speed: 60, manaPool: 95, mpRegen: 10 },
    moveIds: ['arcaneBolt', 'manaBurst', 'exposeWeakness'],
  },
  mindweaver: {
    id: 'mindweaver',
    name: 'Mindweaver',
    types: ['Mind'],
    baseStats: { hp: 80, attack: 30, defense: 40, intelligence: 75, wisdom: 65, speed: 55, manaPool: 65, mpRegen: 7 },
    moveIds: ['psychicLance', 'mindSpike', 'curseMind'],
  },
  forgewright: {
    id: 'forgewright',
    name: 'Steam Colossus',
    types: ['Forge'],
    baseStats: { hp: 110, attack: 75, defense: 70, intelligence: 25, wisdom: 40, speed: 35, manaPool: 45, mpRegen: 5 },
    moveIds: ['moltenHammer', 'sparkForge', 'fortify'],
  },
  packAlpha: {
    id: 'packAlpha',
    name: 'Pack Alpha',
    types: ['Beast'],
    baseStats: { hp: 90, attack: 80, defense: 45, intelligence: 20, wisdom: 30, speed: 75, manaPool: 40, mpRegen: 4 },
    moveIds: ['fangRush', 'savageMaul', 'rally'],
  },
};
