// Scaled stat deltas (docs/stat-scaling.md §2). A move's authored delta is a BASE on the
// status-magnitude formula: landed = round(authored × StatMult × STAB), StatMult from the
// caster's Wisdom for a buff and from the offensive stat the move swings with for a debuff.
// The sign classes the delta, not the move's target, so a mixed move reads two stats.

import type { HeroDefinition, MoveDefinition, StatKey } from '../content';
import type { Combatant, FieldEffectContext } from '../state';
import { getEffectiveStat, effectiveTypes } from '../state';
import { statKeysForMove } from '../damage/damagePipeline';
import { resolveStab } from '../damage/typeMult';
import { magnitudeMultFromStat } from '../heal/healPipeline';
import type { MagnitudeCaster } from '../status/statusMagnitude';

/**
 * buff — a positive delta, reads Wisdom. debuff — a negative delta on the other side, reads
 * the move's offensive stat. cost — a negative delta on the caster's own side, the self-Burn
 * rule: a price is knowable before the button is pressed, so it lands flat. flat — MP Regen,
 * a resource grant rather than a ratio change, and a zero.
 */
export type StatDeltaRole = 'buff' | 'debuff' | 'cost' | 'flat';

export function statDeltaRole(stat: StatKey, amount: number, landsOnCasterSide: boolean): StatDeltaRole {
  if (amount === 0 || stat === 'mpRegen') return 'flat';
  if (amount > 0) return 'buff';
  return landsOnCasterSide ? 'cost' : 'debuff';
}

/** Which caster stat a role reads; undefined when nothing scales it. */
export function statDeltaStatKey(role: StatDeltaRole, move: MoveDefinition): StatKey | undefined {
  if (role === 'buff') return 'wisdom';
  if (role === 'debuff') return statKeysForMove(move)[0];
  return undefined;
}

/** Par: the stat value at which StatMult is exactly 1 — the same 50 every magnitude reads. */
const STAT_DELTA_REFERENCE = 50;

/**
 * The formula from a plain stat + type pair, for a screen with a hero but no fight. A stat
 * the caster does not carry falls back to par, which is the authored base — the honest
 * answer when there is nothing to scale it by.
 */
export function resolveStatDeltaFor(
  stat: StatKey,
  amount: number,
  move: MoveDefinition,
  caster: MagnitudeCaster,
  landsOnCasterSide: boolean
): number {
  const key = statDeltaStatKey(statDeltaRole(stat, amount, landsOnCasterSide), move);
  if (key === undefined) return amount;
  const statMult = magnitudeMultFromStat(caster.stats[key] ?? STAT_DELTA_REFERENCE);
  // Rounded on the magnitude, so a +20 and a −20 off the same caster land the same distance from 0.
  return Math.sign(amount) * Math.round(Math.abs(amount) * statMult * resolveStab(move.type, caster.types));
}

/** The caster-side scaling for one delta, snapshotted at cast — never re-read off whoever holds it. */
export function scaleStatDelta(
  stat: StatKey,
  amount: number,
  move: MoveDefinition,
  casterHero: HeroDefinition,
  caster: Combatant,
  landsOnCasterSide: boolean,
  fieldEffectCtx?: FieldEffectContext
): number {
  const key = statDeltaStatKey(statDeltaRole(stat, amount, landsOnCasterSide), move);
  if (key === undefined) return amount;
  return resolveStatDeltaFor(stat, amount, move, {
    stats: { [key]: getEffectiveStat(casterHero, caster, key, fieldEffectCtx) },
    types: effectiveTypes(casterHero, caster),
  }, landsOnCasterSide);
}

/**
 * Where a move's authored deltas land, read off the card alone — for a screen with no board.
 * 'allOthers' lands on both sides and reads as enemy-side, the debuff being the reason to cast it.
 */
export function statDeltaLandsOnCasterSide(move: MoveDefinition): boolean {
  if (move.statDeltaTarget === 'self' || move.statDeltaTarget === 'bothAllies') return true;
  const target = move.target;
  return target === 'self' || target === 'singleAlly' || target === 'bothAllies' || target === 'randomAlly';
}
