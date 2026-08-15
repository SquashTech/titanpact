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

export type Action = MoveAction | SwitchAction;
