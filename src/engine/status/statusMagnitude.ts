// The status-magnitude formula (docs/combat.md "Scaled status magnitudes").
//   magnitude = authored × StatMult × STAB,  StatMult = 1 + (stat − 50)/100 clamped [0.5, 2.0]
// One shape for both signs, sharing the healing formula's constants so the player reads a
// single rule: 50 is par, every point is 1%. Which stat is read is the only thing that
// differs — a HoT takes the caster's Wisdom, a DoT the offensive stat its move already
// swings with, so a physical Fire hero and a magical one both get a real Burn.

import type { HeroDefinition, MoveDefinition, StatusApplication, StatusDefinition } from '../content';
import type { Combatant, FieldEffectContext } from '../state';
import { getEffectiveStat, effectiveTypes } from '../state';
import { statKeysForMove } from '../damage/damagePipeline';
import { resolveStab } from '../damage/typeMult';
import { magnitudeMultFromStat } from '../heal/healPipeline';

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
  if (magnitude === undefined) return magnitude;
  if (def.pipeline !== 'hot' && def.pipeline !== 'dot') return magnitude;
  if (def.pipeline === 'dot' && app.target === 'self') return magnitude;

  const statKey = def.pipeline === 'hot' ? 'wisdom' : statKeysForMove(move)[0];
  const statMult = magnitudeMultFromStat(getEffectiveStat(casterHero, caster, statKey, fieldEffectCtx));
  const stab = resolveStab(move.type, effectiveTypes(casterHero, caster));
  return Math.round(magnitude * statMult * stab);
}
