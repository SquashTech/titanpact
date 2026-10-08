// A status's rules as rows rather than as its sentence (2026-09-11, per user direction): what it
// does at the tick, how it decays, how a second application stacks, what a switch and a Cleanse
// do to it — each read off the definition fields the statusEngine runs on. Only what a field says
// is here; a rule that lives in prose alone (Freeze halving Speed) stays in the description.

import type { StatusDefinition } from '../../engine/content';
import { statuses } from '../../data/statuses';

/** What a rider ADDS, as the player reads it: a level status climbs (Burn +1), anything else is its number (Renew 3). */
export function statusAmountText(statusId: string, amount: number): string {
  return statuses[statusId]?.levels ? `+${amount}` : `${amount}`;
}

/** What a hero HOLDS, as the player reads it: a level status by its level's name (Badly Burned), anything else its number. */
export function statusHeldText(statusId: string, amount: number): string {
  const levels = statuses[statusId]?.levels;
  if (!levels) return `${amount}`;
  return levels.names[Math.max(1, Math.min(levels.names.length, amount)) - 1];
}

/** A ladder's rungs as one line: `Burning 5% · Badly Burned 10% · Engulfed 25%`. */
function levelsText(levels: NonNullable<StatusDefinition['levels']>): string {
  return levels.names.map((name, i) => `${name} ${levels.tickPercents[i]}%`).join(' · ');
}

export interface StatusFact {
  /** The row's register word. */
  label: string;
  text: string;
}

function typeList(types: readonly string[]): string {
  return types.length <= 1 ? types.join('') : `${types.slice(0, -1).join(', ')} or ${types[types.length - 1]}`;
}

/** What the end-of-round tick does, if the status has one. */
function tickText(def: StatusDefinition): string | null {
  if (def.flatPercentOfMaxHp != null) return `Deals ${Math.round(def.flatPercentOfMaxHp * 100)}% of max HP`;
  if (def.shape === 'timer') return 'Counts down — at 0, deals its magnitude in % of max HP';
  if (!def.ticksAtEndOfRound) return null;
  if (def.pipeline === 'dot') return def.levels ? `Deals by level: ${levelsText(def.levels)} of max HP` : 'Deals its magnitude';
  if (def.pipeline === 'hot') return def.charges ? `Heals ${def.charges.tickPercent}% of max HP and spends one` : 'Heals its magnitude';
  if (def.shape === 'duration') return 'Counts down one round';
  return null;
}

function stackingText(def: StatusDefinition): string {
  switch (def.stacking) {
    case 'additive':
      if (def.levels) return `Climbs a level, up to ${def.levels.names[def.levels.names.length - 1]}`;
      if (def.charges) return 'Adds its heals to what is there';
      return def.pipeline === 'shield' ? "Adds to what is there, up to this hero's max HP" : 'Adds to what is there';
    case 'takeHigher':
      return 'Keeps the higher';
    case 'additiveMagnitudeFixedDuration':
      return 'Adds, the timer never resets';
    case 'additiveRefreshDuration':
      return 'Adds, and the timer tops back up';
    case 'none':
      return def.shape === 'boolean' ? 'Already there — nothing' : 'Refreshes it';
  }
}

export function statusFacts(def: StatusDefinition): StatusFact[] {
  const rows: StatusFact[] = [];
  const tick = tickText(def);
  if (def.ticksOnApply && def.charges) rows.push({ label: 'Lands', text: `Heals ${def.charges.tickPercent}% of max HP at once, spending one` });
  if (tick) rows.push({ label: 'Each round', text: tick });
  if (def.charges) rows.push({ label: 'Lasts', text: 'One heal for each point' });
  if (def.shape === 'magnitude' && def.decay === 'halve') rows.push({ label: 'Then', text: 'Halves' });
  if (def.blocksIncomingMoves) rows.push({ label: 'Guard', text: 'Every enemy move aimed here turns away — an ally’s still lands' });
  // The one thing a player has to learn once about a Shield: what goes through it (docs/shield.md §3.2).
  if (def.pipeline === 'shield') {
    rows.push({ label: 'Absorbs', text: "A move's hit, before HP is touched" });
    rows.push({ label: 'Goes through', text: "Burn, Bleed and Poison ticks, the Pact Clock, recoil, and a move's own HP cost" });
    rows.push({ label: 'Ends', text: 'When a hit empties it' });
  }
  if (def.onShieldBroken) rows.push({ label: 'Broken', text: `The hit that breaks this hero's Shield ${def.onShieldBroken.statusId}s the striker — then spent` });
  if (def.redirectsSingleTargetEnemyMoves) rows.push({ label: 'Pull', text: 'Single-target enemy moves at either ally land here instead' });
  if (def.triggerTypes && def.detonateBonusPercentMaxHp != null) {
    rows.push({
      label: 'Detonates',
      text: `A ${typeList(def.triggerTypes)} hit: +${Math.round(def.detonateBonusPercentMaxHp * 100)}% of max HP, then spent`,
    });
  }
  if (def.spreadTriggerTypes) rows.push({ label: 'Spread', text: `A ${typeList(def.spreadTriggerTypes)} hit here also strikes the partner` });
  if (def.passesOnFaint) rows.push({ label: 'Passes on', text: 'When this hero falls, it passes to the partner' });
  if (def.forceType) rows.push({ label: 'Base Power', text: `+magnitude on every ${def.forceType} move` });
  if (def.forceAllTypes) rows.push({ label: 'Base Power', text: `+magnitude on the next hit, any type${def.consumedOnDamage ? ' — then spent' : ''}` });
  rows.push({ label: 'Reapplied', text: stackingText(def) });
  if (def.clearsAtEndOfRound) rows.push({ label: 'Ends', text: 'When this round ends' });
  if (def.activeOnly) rows.push({ label: 'Benched', text: 'The clock pauses' });
  if (def.clearsOnRest) rows.push({ label: 'Rest', text: 'Puts it out' });
  rows.push({ label: 'Switch', text: def.clearsOnSwitch ? 'Clears it' : 'Keeps it' });
  rows.push({ label: 'Cleanse', text: def.positive ? 'Cannot touch it' : 'Removes it' });
  return rows;
}

/** The ledger as one dim line, for the rider row on a move card: `DoT · halves · switch clears`. */
export function statusFactsLine(def: StatusDefinition): string {
  const parts: string[] = [];
  const tick = tickText(def);
  if (tick) parts.push(tick.replace(/^Deals its magnitude$/, 'ticks its magnitude').replace(/^Heals its magnitude$/, 'heals its magnitude'));
  if (def.shape === 'magnitude' && def.decay === 'halve') parts.push('halves each round');
  if (def.blocksIncomingMoves) parts.push('turns enemy moves away');
  if (def.pipeline === 'shield') parts.push('absorbs hits before HP', 'DoTs and the Clock go through', 'until broken', 'capped at max HP');
  if (def.onShieldBroken) parts.push(`${def.onShieldBroken.statusId}s whoever breaks the Shield`);
  if (def.redirectsSingleTargetEnemyMoves) parts.push('pulls single-target enemy moves');
  if (def.triggerTypes && def.detonateBonusPercentMaxHp != null) {
    parts.push(`${typeList(def.triggerTypes)} hit detonates it for ${Math.round(def.detonateBonusPercentMaxHp * 100)}% max HP`);
  }
  if (def.spreadTriggerTypes) parts.push(`${typeList(def.spreadTriggerTypes)} hits here spread to the partner`);
  if (def.passesOnFaint) parts.push('passes to the partner on a knockout');
  if (def.forceType) parts.push(`+Power on ${def.forceType} moves`);
  if (def.forceAllTypes) parts.push('+Power on the next hit');
  // A control status carries its rule in prose alone (Freeze, Daze), so the sentence stands in.
  if (parts.length === 0 && def.description) return def.description;
  if (def.clearsAtEndOfRound) parts.push('ends with the round');
  if (def.clearsOnRest) parts.push('Rest clears');
  parts.push(def.clearsOnSwitch ? 'switch clears' : 'survives switching');
  if (def.positive) parts.push('cleanse-proof');
  return parts.join(' · ');
}
