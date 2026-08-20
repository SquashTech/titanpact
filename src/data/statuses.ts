// The 9-status condition vocabulary (docs/conditions.md, the engine's 6th
// contract) as DATA — every status is an instance of one of 4 shapes; the
// engine (engine/combat/statusEngine.ts) reads these flags generically rather
// than special-casing each status by name. Replaces the earlier 8-status
// catalog: Bind, Blight, and Expose were cut in design review; Conduct,
// Poison, Haunt, and Stealth replace them.
//
// Elemental Force: one magnitude-shape status per type (`${Type}Force`,
// generated below from typechart.ts's TYPES rather than hand-authored 15
// times), adding its magnitude as flat BasePower to that type's moves
// (damagePipeline.ts resolveElementalForceBonus). Granted via a move's
// statusApplication (self-target, additive stacking — no new engine plumbing
// needed there), or via equipment/relics at fight-build time
// (src/run/statusGrants.ts). Persistent (no decay, doesn't clear on switch)
// and positive (Cleanse can't strip it) since it's meant to represent a
// standing investment, not an acute buff.

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
  ...Object.fromEntries(TYPES.map((type) => [`${type}Force`, elementalForceStatus(type)])),
};
