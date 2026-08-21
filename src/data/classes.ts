// Classes (CLAUDE.md-adjacent design, 2026-08-20 conversation): a Class is a
// Passive (engine/content.ts PassiveDefinition, isValidPassiveDefinition)
// whose only content is a flat, thematic statGrants buff — a hero can hold
// at most one per run (src/run/classes.ts grantClass, RosterEntry.classId).
// Fifteen of the sixteen below cover every one of the C(6,2)=15 possible
// pairs across the six core stats (hp/attack/defense/intelligence/wisdom/
// speed — deliberately NOT manaPool/mpRegen, an open question flagged in the
// 2026-08-20 conversation: a tempo-stat Class would be a second axis of mana
// tuning on top of the LOCKED mana-tuning invariant, docs/mana.md, and
// hasn't been decided). Champion is the one generalist outlier: +5 to all
// six instead of +10 to two, same total-ish magnitude spread thin rather
// than concentrated. All grants are multiples of 5/10 per CLAUDE.md "Stat
// modifiers" and match the +10-per-stat convention Evolution paths already
// use (src/data/progression.ts) — see isValidPassiveDefinition for the
// checked invariant (test/classes.test.ts asserts every entry here passes).

import type { PassiveDefinition } from '../engine/content';

export const classes: Record<string, PassiveDefinition> = {
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    description: 'A frontline fighter built to trade blows: +10 Attack, +10 Defense.',
    statGrants: { attack: 10, defense: 10 },
  },
  guardian: {
    id: 'guardian',
    name: 'Guardian',
    description: 'Built to outlast: +10 HP, +10 Defense.',
    statGrants: { hp: 10, defense: 10 },
  },
  berserker: {
    id: 'berserker',
    name: 'Berserker',
    description: 'Hits hard and shrugs it off: +10 Attack, +10 HP.',
    statGrants: { attack: 10, hp: 10 },
  },
  duelist: {
    id: 'duelist',
    name: 'Duelist',
    description: 'Fast in, fast out: +10 Attack, +10 Speed.',
    statGrants: { attack: 10, speed: 10 },
  },
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    description: 'Quick and hard to burn down magically: +10 Speed, +10 Wisdom.',
    statGrants: { speed: 10, wisdom: 10 },
  },
  monk: {
    id: 'monk',
    name: 'Monk',
    description: 'Mobile and physically sturdy: +10 Speed, +10 Defense.',
    statGrants: { speed: 10, defense: 10 },
  },
  mystic: {
    id: 'mystic',
    name: 'Mystic',
    description: 'A pure caster, hits and resists in kind: +10 Intelligence, +10 Wisdom.',
    statGrants: { intelligence: 10, wisdom: 10 },
  },
  sorcerer: {
    id: 'sorcerer',
    name: 'Sorcerer',
    description: 'A mobile spellcaster: +10 Intelligence, +10 Speed.',
    statGrants: { intelligence: 10, speed: 10 },
  },
  templar: {
    id: 'templar',
    name: 'Templar',
    description: 'A magic-bulwark caster: +10 Defense, +10 Intelligence.',
    statGrants: { defense: 10, intelligence: 10 },
  },
  warden: {
    id: 'warden',
    name: 'Warden',
    description: 'Bulwark against both damage types: +10 Defense, +10 Wisdom.',
    statGrants: { defense: 10, wisdom: 10 },
  },
  sage: {
    id: 'sage',
    name: 'Sage',
    description: 'A defensive caster built to stick around: +10 HP, +10 Wisdom.',
    statGrants: { hp: 10, wisdom: 10 },
  },
  champion: {
    id: 'champion',
    name: 'Champion',
    description: 'A generalist, a little better at everything: +5 to every stat.',
    statGrants: { hp: 5, attack: 5, defense: 5, intelligence: 5, wisdom: 5, speed: 5 },
  },
  battlemage: {
    id: 'battlemage',
    name: 'Battlemage',
    description: 'A hybrid striker, hits hard on the swing and the cast: +10 Attack, +10 Intelligence.',
    statGrants: { attack: 10, intelligence: 10 },
  },
  crusader: {
    id: 'crusader',
    name: 'Crusader',
    description: 'An aggressive attacker who shrugs off magic: +10 Attack, +10 Wisdom.',
    statGrants: { attack: 10, wisdom: 10 },
  },
  shaman: {
    id: 'shaman',
    name: 'Shaman',
    description: 'A bulky caster who sticks around long enough to cast: +10 HP, +10 Intelligence.',
    statGrants: { hp: 10, intelligence: 10 },
  },
  outrider: {
    id: 'outrider',
    name: 'Outrider',
    description: 'Hard to pin down and hard to kill: +10 HP, +10 Speed.',
    statGrants: { hp: 10, speed: 10 },
  },
};
