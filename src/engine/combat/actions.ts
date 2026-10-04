// Declared per-round actions (docs/combat.md). Declare-then-resolve: nothing
// here may let an action see the outcome of another declared the same round.

export interface MoveAction {
  kind: 'move';
  combatantId: string;
  moveId: string;
  /** Required for singleEnemy/singleAlly moves; ignored otherwise. */
  declaredTarget?: string | null;
  /** Who comes in when a switchesUserOut move pivots. Absent or no longer benched: the buff lands, the pivot does not. */
  switchToCombatantId?: string | null;
}

export interface SwitchAction {
  kind: 'switch';
  combatantId: string;
  benchedCombatantId: string;
}

/** Skip the turn and fully restore Mana. The forced fallback when nothing is affordable; also a free tempo play. */
export interface RestAction {
  kind: 'rest';
  combatantId: string;
}

/**
 * The caller spends its turn to Call its side's off-field caster (docs/companion-call.md §3.1), which
 * casts its one move: no move id and no target here — the side's SideCall holds the move, and a Call
 * move never asks for one. Once a fight; spent only if the caller's turn happens.
 */
export interface CallAction {
  kind: 'call';
  combatantId: string;
}

export type Action = MoveAction | SwitchAction | RestAction | CallAction;
