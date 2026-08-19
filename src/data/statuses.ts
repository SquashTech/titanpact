// The 9-status condition vocabulary (docs/conditions.md, the engine's 6th
// contract) as DATA — every status is an instance of one of 4 shapes; the
// engine (engine/combat/statusEngine.ts) reads these flags generically rather
// than special-casing each status by name. Replaces the earlier 8-status
// catalog: Bind, Blight, and Expose were cut in design review; Conduct,
// Poison, Haunt, and Stealth replace them.

import type { StatusDefinition } from '../engine/content';

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
  Daze: {
    id: 'Daze',
    name: 'Daze',
    shape: 'duration',
    ticksAtEndOfRound: true,
    decay: 'none',
    stacking: 'takeHigher',
    clearsOnSwitch: true,
    pipeline: 'control',
    description: "Can't attack, but can switch. Duration counts down at end of round; cleared by switching.",
  },
  Regen: {
    id: 'Regen',
    name: 'Regen',
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
    // Persists through switch — provisional call, not stated explicitly by the
    // design doc. Treated as a mark meant to be cashed in later (same reasoning
    // the old, now-cut Expose used), not an acute effect you dodge by pivoting.
    clearsOnSwitch: false,
    triggerTypes: ['Storm', 'Iron'],
    detonateBonusPercentMaxHp: 0.1,
    pipeline: 'trigger',
    description:
      "Lasts one turn. The next Storm or Iron hit on this target deals an extra 10% of the target's max HP and consumes the mark.",
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
};
