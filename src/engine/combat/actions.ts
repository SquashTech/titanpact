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
 * A side's companion acting on its own (docs/companion-call.md §12): `combatantId` is the off-field
 * caster itself. Never declared by a hero or the AI — the engine adds it to the round its act falls
 * in (companionActions) — so it carries no move id and no target: the side's SideCall holds the
 * move, and a companion move never asks for one.
 */
export interface CallAction {
  kind: 'call';
  combatantId: string;
}

export type Action = MoveAction | SwitchAction | RestAction | CallAction;
