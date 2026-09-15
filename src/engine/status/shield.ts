// Shield: HP that is not yours yet (docs/shield.md). A 'shield'-pipeline status whose
// magnitude is a pool taken from before HP — by a move's hit only, never by a DoT, the Pact
// Clock, a cost or recoil — lasting until a hit empties it, held at the holder's max HP.

import type { StatusDefinition } from '../content';
import type { CombatState, Combatant } from '../state';
import type { CombatEvent } from '../events';

/** The one status a catalog wires to the 'shield' pipeline, or undefined when it carries none. */
export function shieldStatusDef(statusDefs: Record<string, StatusDefinition>): StatusDefinition | undefined {
  for (const def of Object.values(statusDefs)) if (def.pipeline === 'shield') return def;
  return undefined;
}

/** The pool a combatant holds — 0 with no Shield. */
export function shieldHeld(combatant: Combatant | undefined, statusDefs: Record<string, StatusDefinition>): number {
  const def = shieldStatusDef(statusDefs);
  if (!def || !combatant) return 0;
  return combatant.statuses[def.id]?.magnitude ?? 0;
}

/**
 * Takes `incoming` out of the holder's Shield first. Returns what the pool absorbed and the
 * state with the pool reduced; a pool emptied by the hit is removed with StatusRemoved
 * 'broken' (carrying the striker) so a broken trigger can read who did it.
 */
export function absorbIntoShield(
  state: CombatState,
  round: number,
  targetId: string,
  incoming: number,
  statusDefs: Record<string, StatusDefinition>,
  sourceCombatantId?: string
): { state: CombatState; absorbed: number; broken: boolean; events: CombatEvent[] } {
  const def = shieldStatusDef(statusDefs);
  const target = state.combatants[targetId];
  const held = def ? target?.statuses[def.id]?.magnitude ?? 0 : 0;
  if (!def || !target || held <= 0 || incoming <= 0) return { state, absorbed: 0, broken: false, events: [] };

  const absorbed = Math.min(held, incoming);
  const remaining = held - absorbed;
  const statuses = { ...target.statuses };
  if (remaining > 0) statuses[def.id] = { ...statuses[def.id], magnitude: remaining };
  else delete statuses[def.id];

  const next: CombatState = { ...state, combatants: { ...state.combatants, [targetId]: { ...target, statuses } } };
  const events: CombatEvent[] =
    remaining > 0 ? [] : [{ type: 'StatusRemoved', round, combatantId: targetId, statusId: def.id, reason: 'broken', sourceCombatantId }];
  return { state: next, absorbed, broken: remaining <= 0, events };
}
