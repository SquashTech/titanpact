import type { PassiveDefinition } from '../../engine/content';

export const shadowPathPassives: Record<string, PassiveDefinition> = {
  // Marrow's Carrion: tends the rot so Eclipse arrives on a foe already half gone.
  festering: {
    id: 'festering',
    name: 'Festering',
    description: 'When this hero hits a Poisoned foe, that foe gains Poison 10.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventTargetHasStatus: 'Poison' },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Poison', magnitude: 10, duration: 3 },
    },
  },
  // Marrow's Ashenwell.
  ashenPyre: {
    id: 'ashenPyre',
    name: 'Pyre',
    description: 'When an enemy takes Poison damage, it climbs a level of Burn.',
    reactive: {
      hook: 'StatusTicked',
      condition: { relativeTo: 'enemy', eventFieldEquals: { statusId: 'Poison', kind: 'damage' } },
      effect: { kind: 'applyStatus', target: 'triggerSubject', statusId: 'Burn', magnitude: 1 },
    },
  },
  // Nightshade's Penumbra: beside Shadowmeld's arrival Ambush, the loaded blow also goes first.
  halfSeen: {
    id: 'halfSeen',
    name: 'Half-Seen',
    description: 'When this hero enters the battlefield, it becomes Poised.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Poised' },
    },
  },
  // Jinx's Black Cat: Deepgrip's verb on every hit.
  misfortune: {
    id: 'misfortune',
    name: 'Misfortune',
    description: 'When this hero lands a hit, every move its target holds costs 10 more Mana for the rest of the fight, up to 30.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'manaSurcharge', target: 'triggerTarget', amount: 10, max: 30 },
    },
  },
  // Jinx's Nekomata.
  secondTail: {
    id: 'secondTail',
    name: 'Second Tail',
    description: 'The first time this hero would be knocked out each fight, it stands at 1 HP instead, and both active enemies are Haunted.',
    enduresOnce: true,
    reactive: {
      hook: 'Endured',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Haunt' },
    },
  },
  // Murk's Lurker: Murk's shallow pool makes it Rest often, and Shadowstrike cashes the wait first.
  stillWater: {
    id: 'stillWater',
    name: 'Still Water',
    description: 'When this hero Rests, it gains Ambush 40.',
    reactive: {
      hook: 'Rested',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Ambush', magnitude: 40 },
    },
  },
  // Murk's Drowner.
  heldUnder: {
    id: 'heldUnder',
    name: 'Held Under',
    description: 'When this hero lands a hit, its target loses 10 Defense and 10 Speed.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'statDelta', target: 'triggerTarget', stat: ['defense', 'speed'], amount: -10 },
    },
  },
  // Rook's Coven: any curse counts, her partner's included — a table of witches, not one.
  witchmark: {
    id: 'witchmark',
    name: 'Witchmark',
    description: 'When a move lowers an enemy stat, that enemy gains Poison 5.',
    reactive: {
      hook: 'StatChanged',
      condition: { relativeTo: 'enemy', eventFieldNegative: 'delta' },
      effect: { kind: 'applyStatus', target: 'triggerSubject', statusId: 'Poison', magnitude: 5, duration: 3 },
    },
  },
  // Rook's Hedge Witch.
  bitterBrew: {
    id: 'bitterBrew',
    name: 'Bitter Brew',
    description: 'When this hero afflicts Poison, its partner gains Renew 1.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Poison' } },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Renew', magnitude: 1 },
    },
  },
};
