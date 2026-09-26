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
  Barrier: {
    id: 'Barrier',
    name: 'Barrier',
    shape: 'boolean',
    ticksAtEndOfRound: false,
    decay: 'none',
    stacking: 'none',
    // Cannot be banked on the bench, and gone when the round ends — a guard is one round's
    // decision, never a wall the holder walks around behind.
    clearsOnSwitch: true,
    clearsAtEndOfRound: true,
    positive: true,
    blocksIncomingMoves: true,
    pipeline: 'none',
    description: 'Every move the far side aims at this hero turns away for the rest of the round. An ally can still reach them.',
  },
  // Bonus health off the caster's Defense (docs/shield.md): taken from by a move's hit before
  // HP is, never by a DoT, the Clock, a cost or recoil; lasts until broken; held at max HP.
  Shield: {
    id: 'Shield',
    name: 'Shield',
    shape: 'magnitude',
    ticksAtEndOfRound: false,
    decay: 'none',
    stacking: 'additive',
    clearsOnSwitch: false,
    positive: true,
    pipeline: 'shield',
    description:
      "Bonus health, taken from before HP by a move's hit. Burn, Bleed, the Pact Clock, recoil and a move's own cost go straight through it. Lasts until a hit empties it, and can't hold more than this hero's max HP.",
  },
  // Ice Shell's marker beside the Shield it lands with: the striker whose hit breaks the
  // holder's Shield is Frozen, and the shell is spent. Inert without a Shield.
  IceShell: {
    id: 'IceShell',
    name: 'Ice Shell',
    shape: 'boolean',
    ticksAtEndOfRound: false,
    decay: 'none',
    stacking: 'none',
    clearsOnSwitch: false,
    positive: true,
    onShieldBroken: { statusId: 'Freeze' },
    pipeline: 'trigger',
    description: "Whoever's hit breaks this hero's Shield is Frozen. Spent when it fires.",
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
    // Detonate-only: `triggerTypes` never auto-applies Conduct. It is planted by a move's own
    // statusApplication, or by a passive that plants it (Static Tide) — never by the detonation
    // pass itself (statusEngine.ts detonateTriggeredStatuses).
    triggerTypes: ['Storm', 'Iron', 'Mech'],
    detonateBonusPercentMaxHp: 0.15,
    pipeline: 'trigger',
    description:
      "The next Storm, Iron or Mech hit on this target deals an extra 15% of the target's max HP and consumes the mark.",
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
  // Broadside's magazine (docs/innate-passives.md §7, Scallywag): one loaded a round on the bench, all
  // fired on the way in. A counter and nothing else — no tick, no decay, spent by the firing.
  Cannonball: {
    id: 'Cannonball',
    name: 'Cannonball',
    shape: 'magnitude',
    ticksAtEndOfRound: false,
    decay: 'none',
    stacking: 'additive',
    clearsOnSwitch: false,
    positive: true,
    pipeline: 'none',
    description: 'A cannonball loaded on the bench. Every one fires as this hero enters the battlefield.',
  },
  // Tixwick's stance (the Poised innate): the next strike goes a bracket early, then it is spent —
  // Ambush's consumption, carrying priority where Ambush carries power.
  Poised: {
    id: 'Poised',
    name: 'Poised',
    shape: 'boolean',
    ticksAtEndOfRound: false,
    decay: 'none',
    stacking: 'none',
    clearsOnSwitch: true,
    positive: true,
    consumedOnDamage: true,
    priorityBonus: 1,
    pipeline: 'none',
    description: 'The next attack this hero makes goes at +1 priority, then it is spent. No clock — it waits until it is used. Cleared by switching.',
  },
  Ambush: {
    id: 'Ambush',
    name: 'Ambush',
    shape: 'magnitude',
    ticksAtEndOfRound: false,
    decay: 'none',
    stacking: 'additive',
    clearsOnSwitch: true,
    positive: true,
    forceAllTypes: true,
    consumedOnDamage: true,
    pipeline: 'basePower',
    description:
      'Adds its magnitude as flat Base Power to the next attack this hero lands, whatever the move type, then is spent. No clock — it waits until it is cashed. Cleared by switching, so it cannot be banked on the bench.',
  },
  // The Titan's gaze (docs/titan-eyes.md §5): the mark a Regard needs. Duration 2 ticking at the
  // end of the round = the round the Gaze lands in and the whole of the next, so the telegraph is
  // on the board through one full command phase. Not consumed by the strike — two Eyes may
  // Regard one mark in a round, which is the trap the phase-2 Stare sets. Switching breaks it.
  Beheld: {
    id: 'Beheld',
    name: 'Beheld',
    shape: 'duration',
    ticksAtEndOfRound: true,
    decay: 'none',
    stacking: 'none',
    clearsOnSwitch: true,
    pipeline: 'none',
    description: "The Titan's eye is on this hero: a Regard is coming. Switching out breaks its gaze; a Shield takes the hit first.",
  },
  Provoke: {
    id: 'Provoke',
    name: 'Provoke',
    shape: 'duration',
    // Duration 1 ticking at END of round = exactly the round it was cast in.
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
