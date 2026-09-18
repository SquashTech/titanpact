// The Herald's ward (content.ts PassiveDefinition.wardedWhileCompanyStands, docs/titan-eyes.md
// §10): a guard read live off the board rather than a status kept in step with it. Its own module
// so statusEngine, passiveEngine and resolveRound can all read it without a cycle.

import type { CombatState } from '../state';
import { phaseOf } from '../state';
import type { PassiveDefinition, PassiveId, StatusDefinition } from '../content';

/**
 * The ward on this combatant, or null: a held passive with `wardedWhileCompanyStands` whose
 * condition holds — a standing ally of the owner's phase or earlier on its side, field or bench
 * (the Herald's company; the Eyes waiting behind it are a later phase and do not count). Read
 * live at targeting (resolveRound, beside blockingStatusId), at declaration (statusEngine
 * selectableTargets) and at every status application from the far side, so it is one rule in
 * one place and never a status that has to be kept in step with the board.
 */
export function wardOn(state: CombatState, combatantId: string, passiveDefs: Record<PassiveId, PassiveDefinition>): PassiveId | null {
  const owner = state.combatants[combatantId];
  if (!owner || owner.fainted) return null;
  const held = Object.keys(owner.passives).find((id) => passiveDefs[id]?.wardedWhileCompanyStands);
  if (!held) return null;
  const ownerPhase = phaseOf(owner);
  const companyStands = Object.values(state.combatants).some(
    (c) => c.side === owner.side && c.combatantId !== combatantId && !c.fainted && phaseOf(c) <= ownerPhase
  );
  return companyStands ? held : null;
}

/** A status from the far side that a ward refuses: anything not marked `positive`. */
export function wardRefusesStatus(
  state: CombatState,
  targetId: string,
  sourceCombatantId: string | undefined,
  def: StatusDefinition,
  passiveDefs: Record<PassiveId, PassiveDefinition>
): boolean {
  if (def.positive) return false;
  const source = sourceCombatantId ? state.combatants[sourceCombatantId] : undefined;
  if (!source || source.side === state.combatants[targetId]?.side) return false;
  return wardOn(state, targetId, passiveDefs) !== null;
}

