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
  // Redesigned 2026-08-30 from a duration-shape lockout (authored per-move at
  // 2 rounds) into FLINCH, in the Pokemon sense. It is boolean, carries no
  // number, and is gone at the end of the round it landed in.
  //
  // What that buys: Daze is now a bet on TURN ORDER rather than a purchase of
  // enemy turns. resolveRound reads it live when each actor's turn comes up, so
  // a Daze lands only if its applier moved first — a fast hero's chanced rider
  // is a real tempo swing and a slow hero's is close to nothing. Speed and
  // priority became the whole cost/benefit of the status, and no move has to
  // author a magnitude to say so.
  Daze: {
    id: 'Daze',
    name: 'Daze',
    shape: 'boolean',
    ticksAtEndOfRound: false,
    decay: 'none',
    // Nothing to combine: it is present or it is not, and a second application
    // in the same round is a no-op on a hero already denied its action.
    stacking: 'none',
    // Kept honest rather than kept useful. Voluntary switches resolve in their
    // own bracket ABOVE every move (priority.ts), so a Daze applied during the
    // move phase can never be dodged by switching in the round it exists — this
    // flag is unreachable for Daze today, and stays true because it is still
    // what would happen.
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
    // Persists through switch — provisional call, not stated explicitly by the
    // design doc. Treated as a mark meant to be cashed in later (same reasoning
    // the old, now-cut Expose used), not an acute effect you dodge by pivoting.
    clearsOnSwitch: false,
    // Detonate-only. Only a move with its own `statusApplication: { statusId: 'Conduct' }`
    // plants the mark — the authored Storm slate does it five times (moves.ts Rising
    // Static, Jolt, Ionize, Storm Lash, Thunderbolt); ANY Storm/Iron damage move can
    // then cash it in via this list, which is nine more Storm rows carrying this hook
    // for free. 2026-08-21 designer correction: triggerTypes previously also drove
    // auto-apply, which meant every Storm/Iron hit inflicted Conduct — see statusEngine.ts
    // detonateTriggeredStatuses.
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
    // Duration 1 applied mid-round, ticking at END of round, is exactly "this
    // turn": the tick that closes the round it was cast in takes it to 0 and
    // removes it. Deliberately NOT Stealth's ticksAtStartOfRound — that flag
    // exists to give Stealth a full round AFTER the one it was cast in, and
    // Provoke is priced (25 mana, Priority +1) as a single round of soak.
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
