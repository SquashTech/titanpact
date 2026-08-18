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
    description: 'End of round: deal magnitude damage, then halve it. Fades to 0; escapable by switching.',
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
    description: "End of round: deal 5% of the target's max HP. Fixed, inescapable by switching — Cleanse only.",
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
    description: "Can't attack; can still switch. Duration counts down at end of round; cleared by switching.",
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
    description: 'End of round: heal magnitude, then halve it. A positive status — persists through switch, never stripped by Cleanse.',
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
      "Marked by a Storm or Iron hit. The next Storm or Iron hit on this target deals an extra 10% of the target's max HP and consumes the mark — apply and detonate are always separate hits.",
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
      "Starts a 3-round timer. Only counts down while this hero is active — switching stalls the clock rather than clearing it. Reapplying raises the magnitude without resetting the timer. At zero: deals magnitude% of max HP and is consumed.",
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
    description: "While active, a Spirit or Mind attack aimed at this hero's non-Haunted partner also strikes this hero. Cleared by switching.",
  },
  Stealth: {
    id: 'Stealth',
    name: 'Stealth',
    shape: 'duration',
    ticksAtEndOfRound: true,
    decay: 'none',
    stacking: 'none',
    clearsOnSwitch: false,
    positive: true,
    pipeline: 'target',
    description:
      'For 1 round this hero cannot be targeted by a single-target attack (spread moves still land) — a single-target attack resolving after this status lands redirects onto the other active hero.',
  },
};
