// ⚠️ TEST FIXTURE CONTENT — heroes sufficient to run a 2v2 fight and exercise
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
//
// `starter` (docs/types-and-heroes.md "Starters vs. recruit-only heroes") is
// the single source of truth for the start-of-run draft pool
// (src/run/draft.ts) vs. the Guild Hall's recruit-only offer pool
// (src/data/recruitment.ts derives its offers from `starter: false` heroes
// here, so the two pools can never drift out of sync with each other).

import type { HeroDefinition } from '../engine/content';

export const heroes: Record<string, HeroDefinition> = {
  // Recruit-only (starter: false) since 2026-08-17 — Fire's starter slot is
  // now Crimson, below. Retyped Fire/Iron and kept in the game as a distinct
  // armored veteran obtainable via Guild Hall or Recruit Contract, not the
  // start-of-run draft (same pattern as ironWarden's earlier swap for Valor).
  cinderKnight: {
    id: 'cinderKnight',
    name: 'Cinder',
    types: ['Fire', 'Iron'],
    baseStats: { hp: 100, attack: 70, defense: 60, intelligence: 30, wisdom: 40, speed: 50, manaPool: 60, mpRegen: 5 },
    moveIds: ['cinderBite', 'fortify', 'restoreVigor'],
    starter: false,
  },
  // Crimson (2026-08-17): the new Fire starter, replacing Cinder in the draft
  // pool. A magical Int-focused fire mage rather than Cinder's Attack-focused
  // knight build — same type, different kind of Fire hero.
  crimson: {
    id: 'crimson',
    name: 'Crimson',
    types: ['Fire'],
    baseStats: { hp: 90, attack: 25, defense: 35, intelligence: 80, wisdom: 45, speed: 60, manaPool: 85, mpRegen: 9 },
    moveIds: ['flareBurst', 'weaken', 'restoreVigor', 'scorchTheEarth'],
    starter: true,
  },
  tidecaller: {
    id: 'tidecaller',
    name: 'Riptide',
    types: ['Water'],
    baseStats: { hp: 105, attack: 40, defense: 50, intelligence: 75, wisdom: 65, speed: 55, manaPool: 80, mpRegen: 8 },
    moveIds: ['tidalBolt', 'healingRain', 'weaken'],
    starter: true,
  },
  // Recruit-only (starter: false) — Iron's starter slot is now Valor, below.
  // Kept in the game as a distinct Iron veteran obtainable via Guild Hall or
  // Recruit Contract, not the start-of-run draft (2026-08-17).
  ironWarden: {
    id: 'ironWarden',
    name: 'Warden',
    types: ['Iron'],
    baseStats: { hp: 135, attack: 55, defense: 90, intelligence: 20, wisdom: 50, speed: 30, manaPool: 40, mpRegen: 4 },
    moveIds: ['quickJab', 'stunningBlow', 'curseMind'],
    starter: false,
  },
  wildOracle: {
    id: 'wildOracle',
    name: 'Sylva',
    types: ['Nature'],
    baseStats: { hp: 100, attack: 35, defense: 45, intelligence: 80, wisdom: 70, speed: 65, manaPool: 90, mpRegen: 10 },
    moveIds: ['venomousBite', 'mendWounds', 'secondWind', 'overgrowth'],
    starter: true,
  },
  // Recruit-only (starter: false) since 2026-08-20 — Storm's starter slot is
  // now Tempest, below. Kept in the game as a distinct Storm veteran
  // obtainable via Guild Hall or Recruit Contract, not the start-of-run draft
  // (same pattern as ironWarden's/cinderKnight's earlier swaps).
  stormRanger: {
    id: 'stormRanger',
    name: 'Squall',
    types: ['Storm'],
    baseStats: { hp: 90, attack: 65, defense: 40, intelligence: 35, wisdom: 35, speed: 90, manaPool: 50, mpRegen: 6 },
    moveIds: ['galeShot', 'rally', 'thunderclap'],
    starter: false,
  },
  // Tempest (2026-08-20): the new Storm starter, replacing Squall in the
  // draft pool. Same stat line and starting kit as Squall for now — build
  // differentiation is deferred, not yet designed.
  tempest: {
    id: 'tempest',
    name: 'Tempest',
    types: ['Storm'],
    baseStats: { hp: 90, attack: 65, defense: 40, intelligence: 35, wisdom: 35, speed: 90, manaPool: 50, mpRegen: 6 },
    moveIds: ['galeShot', 'rally', 'thunderclap'],
    starter: true,
  },
  // Recruit-only (starter: false) since 2026-08-21 — Shadow's starter slot is
  // now Marrow, below. Kept in the game as a distinct Shadow hero obtainable
  // via Guild Hall or Recruit Contract, not the start-of-run draft (same
  // pattern as ironWarden's/cinderKnight's/stormRanger's earlier swaps).
  shadowMonk: {
    id: 'shadowMonk',
    name: 'Vesper',
    types: ['Shadow'],
    baseStats: { hp: 85, attack: 75, defense: 45, intelligence: 40, wisdom: 40, speed: 70, manaPool: 45, mpRegen: 5 },
    moveIds: ['vanish', 'secondWind', 'purify'],
    starter: false,
  },
  // Marrow (2026-08-21): the new Shadow starter, replacing Vesper in the
  // draft pool. Same stat line and starting kit as Vesper for now — build
  // differentiation is deferred, not yet designed.
  marrow: {
    id: 'marrow',
    name: 'Marrow',
    types: ['Shadow'],
    baseStats: { hp: 85, attack: 75, defense: 45, intelligence: 40, wisdom: 40, speed: 70, manaPool: 45, mpRegen: 5 },
    moveIds: ['vanish', 'secondWind', 'purify'],
    starter: true,
  },

  // Recruit-only (starter: false) since 2026-08-17 — Frost's starter slot is
  // now Rime, below. The Abominable stays in the game as a special
  // recruit-only hero, obtainable via Guild Hall or Recruit Contract, not the
  // start-of-run draft.
  glacialWarden: {
    id: 'glacialWarden',
    name: 'The Abominable',
    types: ['Frost'],
    baseStats: { hp: 140, attack: 30, defense: 55, intelligence: 70, wisdom: 60, speed: 45, manaPool: 70, mpRegen: 7 },
    moveIds: ['glacialSpike', 'frostLock', 'secondWind'],
    starter: false,
  },
  // Rime (2026-08-17): the new Frost starter, replacing The Abominable in the
  // draft pool. A fast talon-and-claw hunter rather than The Abominable's
  // slow magical bulk — same type, different kind of Frost hero. Its
  // defensive Evolution path grafts Beast (a Frost/Beast apex predator).
  rime: {
    id: 'rime',
    name: 'Rime',
    types: ['Frost'],
    baseStats: { hp: 95, attack: 60, defense: 40, intelligence: 45, wisdom: 60, speed: 85, manaPool: 55, mpRegen: 6 },
    moveIds: ['frostBite', 'rendingClaw', 'secondWind'],
    starter: true,
  },
  dawnwarden: {
    id: 'dawnwarden',
    name: 'Solace',
    types: ['Light'],
    baseStats: { hp: 100, attack: 40, defense: 65, intelligence: 55, wisdom: 85, speed: 40, manaPool: 85, mpRegen: 9 },
    moveIds: ['radiantBeam', 'restoreVigor', 'purify', 'consecrate'],
    starter: true,
  },
  runescribe: {
    id: 'runescribe',
    name: 'Glyph',
    types: ['Arcane'],
    baseStats: { hp: 80, attack: 25, defense: 35, intelligence: 85, wisdom: 45, speed: 60, manaPool: 95, mpRegen: 10 },
    moveIds: ['arcaneBolt', 'manaBurst', 'curseMind', 'arcaneSurge'],
    starter: true,
  },
  mindweaver: {
    id: 'mindweaver',
    name: 'Cortex',
    types: ['Mind'],
    baseStats: { hp: 90, attack: 30, defense: 40, intelligence: 75, wisdom: 65, speed: 55, manaPool: 65, mpRegen: 7 },
    moveIds: ['psychicLance', 'mindSpike', 'curseMind', 'stasisField'],
    starter: true,
  },
  forgewright: {
    id: 'forgewright',
    name: 'Clockwork',
    types: ['Mech'],
    baseStats: { hp: 120, attack: 75, defense: 70, intelligence: 25, wisdom: 40, speed: 35, manaPool: 45, mpRegen: 5 },
    moveIds: ['moltenHammer', 'sparkForge', 'fortify'],
    starter: true,
  },
  // Renamed from "Pack Alpha" to "Fang" (2026-08-20) — id kept stable
  // (packAlpha) since it's referenced throughout run/progression data;
  // only the display name changed.
  packAlpha: {
    id: 'packAlpha',
    name: 'Fang',
    types: ['Beast'],
    baseStats: { hp: 110, attack: 80, defense: 45, intelligence: 20, wisdom: 30, speed: 75, manaPool: 40, mpRegen: 4 },
    moveIds: ['fangRush', 'savageMaul', 'rally'],
    starter: true,
  },

  // --- Stone and Spirit starters (2026-08-17): the last two non-Ancient
  // types without a hero, filled in alongside Valor to complete a one-
  // starter-per-type roster (14 starters covering every type but Ancient).
  crag: {
    id: 'crag',
    name: 'Crag',
    types: ['Stone'],
    baseStats: { hp: 140, attack: 60, defense: 95, intelligence: 15, wisdom: 55, speed: 20, manaPool: 35, mpRegen: 4 },
    moveIds: ['boulderToss', 'fortify', 'secondWind'],
    starter: true,
  },
  revenant: {
    id: 'revenant',
    name: 'Revenant',
    types: ['Spirit'],
    baseStats: { hp: 90, attack: 25, defense: 40, intelligence: 70, wisdom: 75, speed: 60, manaPool: 75, mpRegen: 8 },
    moveIds: ['soulRend', 'secondWind', 'mendWounds'],
    starter: true,
  },

  // --- Valor (2026-08-17): the new Iron starter, replacing Warden in
  // the draft pool. A leaner, faster frontliner than Warden's
  // max-bulk tank build — same type, different kind of Iron hero.
  valor: {
    id: 'valor',
    name: 'Valor',
    types: ['Iron'],
    baseStats: { hp: 120, attack: 75, defense: 65, intelligence: 25, wisdom: 45, speed: 55, manaPool: 50, mpRegen: 6 },
    moveIds: ['ironFist', 'fortify', 'restoreVigor'],
    starter: true,
  },

  // --- Cube, Mordrax, Lucius (2026-08-17): new recruit-only heroes, not
  // added to the start-of-run draft pool.
  cube: {
    id: 'cube',
    name: 'Cube',
    types: ['Frost'],
    baseStats: { hp: 90, attack: 50, defense: 80, intelligence: 40, wisdom: 50, speed: 25, manaPool: 45, mpRegen: 5 },
    moveIds: ['frostBite', 'fortify', 'stunningBlow'],
    starter: false,
  },
  mordax: {
    id: 'mordax',
    name: 'Mordrax',
    types: ['Nature'],
    baseStats: { hp: 105, attack: 70, defense: 55, intelligence: 35, wisdom: 45, speed: 50, manaPool: 50, mpRegen: 5 },
    moveIds: ['vineLash', 'rendingClaw', 'rally'],
    starter: false,
  },
  // Lucius: his Evolution (src/data/progression.ts evolutions.lucius) grants
  // a Passive on the defensive path (Sanguine) rather than just stats — the
  // first hero to use that shape now that the Passives contract exists
  // (engine/content.ts PassiveDefinition). Already dual-typed (Shadow/Mind),
  // so none of his paths carry a typeGraft (mono-only rule).
  lucius: {
    id: 'lucius',
    name: 'Lucius',
    types: ['Shadow', 'Mind'],
    baseStats: { hp: 100, attack: 35, defense: 40, intelligence: 75, wisdom: 55, speed: 65, manaPool: 70, mpRegen: 7 },
    moveIds: ['shadowVeil', 'curseMind', 'spectralBind'],
    starter: false,
  },
};
