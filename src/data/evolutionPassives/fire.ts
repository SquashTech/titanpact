import type { PassiveDefinition } from '../../engine/content';

export const firePathPassives: Record<string, PassiveDefinition> = {
  // Cinder's Explosive: a Fire hit lights a fire, never feeds one already burning.
  rekindle: {
    id: 'rekindle',
    name: 'Rekindle',
    description: 'Sets the target Burning, unless it already is.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Fire' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Burn', onlyIfAbsent: true },
    },
  },
  // Crimson's Cinderveil: the Spirit graft's own spread, laid by every Fire hit.
  emberVeil: {
    id: 'emberVeil',
    name: 'Ember Veil',
    description: 'Target is Haunted.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Fire' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Haunt' },
    },
  },
  // Crimson's Pyroclasm, beside Firestarter: the fire it starts never touches its own side.
  flameproof: {
    id: 'flameproof',
    name: 'Flameproof',
    description: 'While this hero is active, your active heroes are immune to Burn.',
    sideRefusesStatuses: ['Burn'],
  },
  // Brimstone's Hexfume: Sulphur's entry, in poison.
  hexfume: {
    id: 'hexfume',
    name: 'Hexfume',
    description: 'Both foes gain Poison 10.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Poison', magnitude: 10, duration: 3 },
    },
  },
  // Brimstone's Rotflame: the fire feeds the rot Grim Harvest reaps.
  witchsBrew: {
    id: 'witchsBrew',
    name: "Witch's Brew",
    description: 'When an enemy takes Burn damage, it gains Poison 5.',
    reactive: {
      hook: 'StatusTicked',
      condition: { relativeTo: 'enemy', eventFieldEquals: { statusId: 'Burn', kind: 'damage' } },
      effect: { kind: 'applyStatus', target: 'triggerSubject', statusId: 'Poison', magnitude: 5, duration: 3 },
    },
  },
  // Ashwing's Firebird.
  risingFlame: {
    id: 'risingFlame',
    name: 'Rising Flame',
    description: 'Gains Fire Force 15. Up to 3 times a fight.',
    reactive: {
      maxFiresPerFight: 3,
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'FireForce', magnitude: 15 },
    },
  },
  // Ashwing's Sunbird: under Consecrate's Sanctuary the bird's fire mends its partner.
  dawnfire: {
    id: 'dawnfire',
    name: 'Dawnfire',
    description: 'While Sanctuary is up, heals its partner for a third of the damage dealt.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Fire' }, requiresFieldEffect: 'sanctuary' },
      effect: { kind: 'heal', target: 'ally', amount: { kind: 'matchTriggerAmount', multiplier: 0.33 } },
    },
  },
  // Ashwing's Ashen: Smoulder is what arms it — the phoenix rises whole.
  funeralPyre: {
    id: 'funeralPyre',
    name: 'Funeral Pyre',
    description: 'When this hero stands at 1 HP instead of being knocked out, it heals to full HP and refills its Mana.',
    reactive: {
      hook: 'Endured',
      condition: { relativeTo: 'self' },
      effect: { kind: 'heal', target: 'self', amount: { kind: 'percentMaxHp', value: 1 } },
      alsoEffect: { kind: 'restoreMana', target: 'self' },
    },
  },
  // Tinder's Headliner: the bow on the way off, which gives Grand Finale its reason.
  curtainCall: {
    id: 'curtainCall',
    name: 'Curtain Call',
    description: 'Partner heals 15% of its max HP.',
    reactive: {
      hook: 'SwitchedOut',
      condition: { relativeTo: 'self' },
      effect: { kind: 'heal', target: 'ally', amount: { kind: 'percentMaxHp', value: 0.15 } },
    },
  },
  // Tinder's Limelight: every entrance lights the stage for Radiant Beam.
  footlights: {
    id: 'footlights',
    name: 'Footlights',
    description: 'Gains Light Force 15. Up to 3 times a fight.',
    reactive: {
      maxFiresPerFight: 3,
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'LightForce', magnitude: 15 },
    },
  },
  // Cinder's Thunderblaze: Storm Lash plants the mark, and his fire sets it off.
  stormfire: {
    id: 'stormfire',
    name: 'Stormfire',
    description: "This hero's Fire attacks also set off Conduct.",
    setsOffStatus: { statusId: 'Conduct', moveTypes: ['Fire'] },
  },
  // Crimson's Emberweave: every enemy fire feeds the weave Arc Pulse spends.
  spellfire: {
    id: 'spellfire',
    name: 'Spellfire',
    description: 'When an enemy takes Burn damage, this hero gains Arcane Force 10. Up to 3 times a fight.',
    reactive: {
      maxFiresPerFight: 3,
      hook: 'StatusTicked',
      condition: { relativeTo: 'enemy', eventFieldEquals: { statusId: 'Burn', kind: 'damage' } },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'ArcaneForce', magnitude: 10 },
    },
  },
  // Drake's Wyvern: it comes in on the wing and strikes first.
  wingwake: {
    id: 'wingwake',
    name: 'Wingwake',
    description: 'Its next attack goes at +1 priority and gains Ambush 20.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Poised' },
      alsoEffect: { kind: 'applyStatus', target: 'self', statusId: 'Ambush', magnitude: 20 },
    },
  },
  // Tinder's Sparkler: the warm-up act, and the partner takes the stage.
  spotlight: {
    id: 'spotlight',
    name: 'Spotlight',
    description: 'Partner gains Ambush 20. Up to 3 times a fight.',
    reactive: {
      maxFiresPerFight: 3,
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Ambush', magnitude: 20 },
    },
  },
};
