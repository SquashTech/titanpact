// The status-magnitude formula (docs/combat.md "Scaled status magnitudes").
//   magnitude = authored × StatMult × STAB,  StatMult = 1 + (stat − 50)/100 clamped [0.5, 2.0]
// One shape for both signs, sharing the healing formula's constants so the player reads a
// single rule: 50 is par, every point is 1%. Which stat is read is the only thing that
// differs — a HoT takes the caster's Wisdom, a DoT the offensive stat its move already
// swings with, so a physical Fire hero and a magical one both get a real Burn.

import type { HeroDefinition, MoveDefinition, StatKey, StatusApplication, StatusDefinition, TypeId } from '../content';
import type { Combatant, FieldEffectContext } from '../state';
import { getEffectiveStat, effectiveTypes } from '../state';
import { statKeysForMove } from '../damage/damagePipeline';
import { resolveStab } from '../damage/typeMult';
import { magnitudeMultFromStat } from '../heal/healPipeline';

/**
 * The only caster inputs the formula has — the stats a rider might read and the types STAB
 * reads. The `HealCaster` equivalent, and there for the same reason: a level-up screen or a
 * hero sheet has no Combatant, and printing the authored base there tells the player a number
 * the move will not land.
 */
export interface MagnitudeCaster {
  stats: Partial<Record<StatKey, number>>;
  types: readonly TypeId[];
}

/** Which stat a rider reads: a HoT the caster's Wisdom, a DoT the offensive stat its move swings with. */
export function magnitudeStatKey(def: StatusDefinition, move: MoveDefinition): StatKey {
  return def.pipeline === 'hot' ? 'wisdom' : statKeysForMove(move)[0];
}

/** True when the authored magnitude is a BASE the caster scales, rather than the figure that lands. */
export function magnitudeScales(def: StatusDefinition, app: StatusApplication): boolean {
  if (def.pipeline !== 'hot' && def.pipeline !== 'dot') return false;
  return !(def.pipeline === 'dot' && app.target === 'self');
}

/**
 * The caster-side scaling for one rider, snapshotted at application — never re-read per
 * tick off whoever ends up holding it. Gated on `StatusDefinition.pipeline`, not on the
 * move's kind, so a damage move that grants Renew scales its Renew and a heal move that
 * inflicts Burn scales its Burn. Everything else passes through untouched.
 *
 * A `dot` aimed at `self` is the exception: that is Fire's and Mech's self-Burn, which
 * `docs/authoring-moves.md` bills as a COST whose price is knowable before the button is
 * pressed. Scaling it would make Meltdown's price grow with the Intelligence Meltdown
 * exists to convert, so a cost stays the flat authored number. A `hot` on self is a
 * benefit, not a cost, and scales like any other.
 */
export function scaleStatusMagnitude(
  magnitude: number | undefined,
  def: StatusDefinition,
  app: StatusApplication,
  move: MoveDefinition,
  casterHero: HeroDefinition,
  caster: Combatant,
  fieldEffectCtx?: FieldEffectContext
): number | undefined {
  if (magnitude === undefined || !magnitudeScales(def, app)) return magnitude;
  const statKey = magnitudeStatKey(def, move);
  return resolveStatusMagnitudeFor(magnitude, def, app, move, {
    stats: { [statKey]: getEffectiveStat(casterHero, caster, statKey, fieldEffectCtx) },
    types: effectiveTypes(casterHero, caster),
  });
}

/**
 * The same formula from a plain stat + type pair, for a screen with a hero but no fight.
 * A stat the caster does not carry falls back to the reference 50, which is a StatMult of 1 —
 * the authored base, which is the right answer when there is nothing to scale it by.
 */
export function resolveStatusMagnitudeFor(
  magnitude: number | undefined,
  def: StatusDefinition,
  app: StatusApplication,
  move: MoveDefinition,
  caster: MagnitudeCaster
): number | undefined {
  if (magnitude === undefined || !magnitudeScales(def, app)) return magnitude;
  const statMult = magnitudeMultFromStat(caster.stats[magnitudeStatKey(def, move)] ?? MAGNITUDE_STAT_REFERENCE);
  return Math.round(magnitude * statMult * resolveStab(move.type, caster.types));
}

/** Par: the stat value at which StatMult is exactly 1 (docs/combat.md — 50 is par, every point is 1%). */
const MAGNITUDE_STAT_REFERENCE = 50;
