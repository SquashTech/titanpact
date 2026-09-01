// A Class is a statGrants-only Passive; a hero holds at most one per run (src/run/classes.ts).
// Fifteen cover every pair of the six core stats — manaPool/mpRegen deliberately excluded, an
// open mana-tuning question (docs/mana.md) — and Champion is +5 to all six. `name` carries the
// "Class - " prefix because Classes share the Passive display surface; `id` stays bare.

import type { PassiveDefinition } from '../engine/content';

export const classes: Record<string, PassiveDefinition> = {
  warrior: {
    id: 'warrior',
    name: 'Class - Warrior',
    description: 'A frontline fighter built to trade blows: +10 Attack, +10 Defense.',
    statGrants: { attack: 10, defense: 10 },
  },
  guardian: {
    id: 'guardian',
    name: 'Class - Guardian',
    description: 'Built to outlast: +10 HP, +10 Defense.',
    statGrants: { hp: 10, defense: 10 },
  },
  berserker: {
    id: 'berserker',
    name: 'Class - Berserker',
    description: 'Hits hard and shrugs it off: +10 Attack, +10 HP.',
    statGrants: { attack: 10, hp: 10 },
  },
  duelist: {
    id: 'duelist',
    name: 'Class - Duelist',
    description: 'Fast in, fast out: +10 Attack, +10 Speed.',
    statGrants: { attack: 10, speed: 10 },
  },
  ranger: {
    id: 'ranger',
    name: 'Class - Ranger',
    description: 'Quick and hard to burn down magically: +10 Speed, +10 Wisdom.',
    statGrants: { speed: 10, wisdom: 10 },
  },
  monk: {
    id: 'monk',
    name: 'Class - Monk',
    description: 'Mobile and physically sturdy: +10 Speed, +10 Defense.',
    statGrants: { speed: 10, defense: 10 },
  },
  mystic: {
    id: 'mystic',
    name: 'Class - Mystic',
    description: 'A pure caster, hits and resists in kind: +10 Intelligence, +10 Wisdom.',
    statGrants: { intelligence: 10, wisdom: 10 },
  },
  sorcerer: {
    id: 'sorcerer',
    name: 'Class - Sorcerer',
    description: 'A mobile spellcaster: +10 Intelligence, +10 Speed.',
    statGrants: { intelligence: 10, speed: 10 },
  },
  templar: {
    id: 'templar',
    name: 'Class - Templar',
    description: 'A magic-bulwark caster: +10 Defense, +10 Intelligence.',
    statGrants: { defense: 10, intelligence: 10 },
  },
  warden: {
    id: 'warden',
    name: 'Class - Warden',
    description: 'Bulwark against both damage types: +10 Defense, +10 Wisdom.',
    statGrants: { defense: 10, wisdom: 10 },
  },
  sage: {
    id: 'sage',
    name: 'Class - Sage',
    description: 'A defensive caster built to stick around: +10 HP, +10 Wisdom.',
    statGrants: { hp: 10, wisdom: 10 },
  },
  champion: {
    id: 'champion',
    name: 'Class - Champion',
    description: 'A generalist, a little better at everything: +5 to every stat.',
    statGrants: { hp: 5, attack: 5, defense: 5, intelligence: 5, wisdom: 5, speed: 5 },
  },
  battlemage: {
    id: 'battlemage',
    name: 'Class - Battlemage',
    description: 'A hybrid striker, hits hard on the swing and the cast: +10 Attack, +10 Intelligence.',
    statGrants: { attack: 10, intelligence: 10 },
  },
  crusader: {
    id: 'crusader',
    name: 'Class - Crusader',
    description: 'An aggressive attacker who shrugs off magic: +10 Attack, +10 Wisdom.',
    statGrants: { attack: 10, wisdom: 10 },
  },
  shaman: {
    id: 'shaman',
    name: 'Class - Shaman',
    description: 'A bulky caster who sticks around long enough to cast: +10 HP, +10 Intelligence.',
    statGrants: { hp: 10, intelligence: 10 },
  },
  outrider: {
    id: 'outrider',
    name: 'Class - Outrider',
    description: 'Hard to pin down and hard to kill: +10 HP, +10 Speed.',
    statGrants: { hp: 10, speed: 10 },
  },
};
