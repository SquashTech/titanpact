// The status vocabulary (docs/conditions.md) as data — statusEngine.ts reads these flags
// generically. Elemental Force is one persistent, positive magnitude status per type
// (`${Type}Force`), adding its magnitude as flat BasePower to that type's moves.

import type { StatusDefinition } from '../engine/content';
import { TYPES, type TitanpactType } from './typechart';

function elementalForceStatus(type: TitanpactType): StatusDefinition {
  return {
    id: `${type}Force`,
    name: `${type} Force`,
    shape: 'magnitude',
    ticksAtEndOfRound: false,
    decay: 'none',
    stacking: 'additive',
    clearsOnSwitch: false,
    positive: true,
    forceType: type,
    pipeline: 'basePower',
    description: `Adds its magnitude as flat Base Power to every ${type}-type move this hero uses.`,
  };
}

export const statuses: Record<string, StatusDefinition> = {
  Burn: {
    id: 'Burn',
    name: 'Burn',
    shape: 'magnitude',
    ticksAtEndOfRound: true,
    decay: 'halve',
    stacking: 'additive',
    clearsOnSwitch: true,
    pipeline: 'dot',
    description: 'End of round: deal X damage, then halve it. Cleansed by switching.',
  },
  Bleed: {
    id: 'Bleed',
    name: 'Bleed',
    shape: 'boolean',
    ticksAtEndOfRound: true,
    decay: 'none',
    stacking: 'none',
    clearsOnSwitch: false,
    pipeline: 'dot',
    flatPercentOfMaxHp: 0.05,
    description: "End of round: deal 5% of the target's max HP.",
  },
  Freeze: {
    id: 'Freeze',
    name: 'Freeze',
    shape: 'boolean',
    ticksAtEndOfRound: false,
    decay: 'none',
    stacking: 'none',
    clearsOnSwitch: true,
    pipeline: 'control',
    description: 'Halves Speed. Cleared by switching.',
  },
  // Flinch: no magnitude, gone at the end of the round it lands in. resolveRound reads it live,
  // so it only bites when the applier moved first — Speed/priority is its whole price.
  Daze: {
    id: 'Daze',
    name: 'Daze',
    shape: 'boolean',
    ticksAtEndOfRound: false,
    decay: 'none',
    stacking: 'none',
    // Unreachable today (switches resolve before every move) but still the correct value.
    clearsOnSwitch: true,
    clearsAtEndOfRound: true,
    pipeline: 'control',
    description: "Can't attack for the rest of the round, but can still switch or Rest. Gone when the round ends.",
  },
  Renew: {
    id: 'Renew',
    name: 'Renew',
    shape: 'magnitude',
    ticksAtEndOfRound: true,
    decay: 'halve',
    stacking: 'additive',
    clearsOnSwitch: false,
    positive: true,
    pipeline: 'hot',
    description: 'End of round: heal X, then halve it. Persists through switch and cleanse.',
  },
  Conduct: {
    id: 'Conduct',
    name: 'Conduct',
    shape: 'boolean',
    ticksAtEndOfRound: false,
    decay: 'none',
    stacking: 'none',
    // Persists through switch — provisional; treated as a mark to cash in later.
    clearsOnSwitch: false,
    // Detonate-only: `triggerTypes` never auto-applies Conduct. Only a move's own
    // statusApplication plants it (statusEngine.ts detonateTriggeredStatuses).
    triggerTypes: ['Storm', 'Iron'],
    detonateBonusPercentMaxHp: 0.1,
    pipeline: 'trigger',
    description:
      "The next Storm or Iron hit on this target deals an extra 10% of the target's max HP and consumes the mark.",
  },
  Poison: {
    id: 'Poison',
    name: 'Poison',
    shape: 'timer',
    ticksAtEndOfRound: true,
    decay: 'none',
    stacking: 'additiveMagnitudeFixedDuration',
    clearsOnSwitch: false,
    activeOnly: true,
    pipeline: 'timer',
    description:
      "Starts a 3-round timer, then deals X% max HP damage. Only counts down while the hero is active. Reapplying raises the X% without resetting the timer.",
  },
  Haunt: {
    id: 'Haunt',
    name: 'Haunt',
    shape: 'boolean',
    ticksAtEndOfRound: false,
    decay: 'none',
    stacking: 'none',
    clearsOnSwitch: true,
    spreadTriggerTypes: ['Spirit', 'Mind'],
    pipeline: 'target',
    description: "While active, a Spirit or Mind attack aimed at this hero's partner also strikes this hero. Cleared by switching.",
  },
  Stealth: {
    id: 'Stealth',
    name: 'Stealth',
    shape: 'duration',
    ticksAtEndOfRound: false,
    ticksAtStartOfRound: true,
    decay: 'none',
    stacking: 'none',
    clearsOnSwitch: false,
    positive: true,
    pipeline: 'target',
    description:
      "Hero cannot be the target of an attack. If Stealth is applied mid-round, attacks targeting this are redirected to this hero's partner. Spread moves still land. Both active heroes can never be Stealthed at the same time — a second Stealth fizzles while the other is still active and Stealthed.",
  },
  Provoke: {
    id: 'Provoke',
    name: 'Provoke',
    shape: 'duration',
    // Duration 1 ticking at END of round = exactly the round it was cast in. Deliberately not
    // Stealth's start-of-round tick, which would give it a full extra round.
    ticksAtEndOfRound: true,
    decay: 'none',
    stacking: 'none',
    clearsOnSwitch: true,
    redirectsSingleTargetEnemyMoves: true,
    pipeline: 'target',
    description:
      'Single-target enemy moves aimed at either hero on this side are redirected onto this hero instead. Spread moves are unaffected. Lasts until the end of the round it was used.',
  },
  ...Object.fromEntries(TYPES.map((type) => [`${type}Force`, elementalForceStatus(type)])),
};
