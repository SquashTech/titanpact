// Declared per-round actions (docs/combat.md "Action declaration & targeting").
// Both sides declare all active combatants' actions, then the round resolves
// in priority/speed order — this declare-then-resolve structure is what makes
// prediction the core skill. Preserve it: nothing here should let an action
// see the outcome of another action declared in the same round.

export interface MoveAction {
  kind: 'move';
  combatantId: string;
  moveId: string;
  /** Required for singleEnemy/singleAlly moves; ignored otherwise. */
  declaredTarget?: string | null;
}

export interface SwitchAction {
  kind: 'switch';
  combatantId: string;
  benchedCombatantId: string;
}

/**
 * Rest: skip the turn and fully restore Mana (CLAUDE.md "Mana & tempo" — "no
 * defensive benefit"). Forced fallback when none of a hero's moves are
 * affordable and no bench hero is available to switch to instead (the
 * softlock this closes); also freely choosable any other time as a
 * tempo play (dump mana into a big hit, Rest it back next round).
 */
export interface RestAction {
  kind: 'rest';
  combatantId: string;
}

export type Action = MoveAction | SwitchAction | RestAction;
