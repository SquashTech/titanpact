// Motley's Trick (docs/wild-innates-and-events.md §1): a `metamorphic` move is swapped, each round,
// for a face rolled from the whole catalog. The swap happens HERE and only here — at the kit the
// command phase reads — so the engine resolves a plain move and never learns the Trick exists:
// the face's type, price, priority, targeting and riders are simply the face's.

import type { MoveDefinition, PassiveDefinition, PassiveId } from '../engine/content';
import { resolveMetamorphicFaces, type CombatState } from '../engine/state';
import { signatureMoves } from '../data/signatures';
import { classMoves } from '../data/classes';

const poolCache = new WeakMap<Record<string, MoveDefinition>, readonly string[]>();

/**
 * Every move a face can be: the catalog less what belongs to somebody — a signature, a Class move —
 * and less the metamorphic moves themselves. Ancient stays in: rolling the Herald's own move is the
 * best story the Trick tells.
 */
export function metamorphicPool(moves: Record<string, MoveDefinition>): readonly string[] {
  const cached = poolCache.get(moves);
  if (cached) return cached;
  const pool = Object.values(moves)
    .filter((move) => !move.metamorphic && !signatureMoves[move.id] && !classMoves[move.id])
    .map((move) => move.id)
    .sort();
  poolCache.set(moves, pool);
  return pool;
}

/** The largest `metamorphicFaces` the combatant holds; one when it holds none. */
export function facesFor(state: CombatState, combatantId: string, passives: Record<PassiveId, PassiveDefinition>): number {
  const held = Object.keys(state.combatants[combatantId]?.passives ?? {});
  return held.reduce((most, id) => Math.max(most, passives[id]?.metamorphicFaces ?? 1), 1);
}

/**
 * The kit as it stands THIS round: each metamorphic move replaced by its face(s), in its own slot.
 * Read by the move buttons, the Rest check and the AI, so all three agree on what can be declared.
 */
export function kitForRound(
  state: CombatState,
  combatantId: string,
  moveIds: readonly string[],
  moves: Record<string, MoveDefinition>,
  passives: Record<PassiveId, PassiveDefinition>
): string[] {
  if (!moveIds.some((id) => moves[id]?.metamorphic)) return [...moveIds];
  // Never a move the kit already holds: two identical rows would be one choice wearing two buttons.
  const pool = metamorphicPool(moves).filter((id) => !moveIds.includes(id));
  const faces = resolveMetamorphicFaces(state, combatantId, pool, facesFor(state, combatantId, passives));
  return moveIds.flatMap((id) => (moves[id]?.metamorphic ? faces : [id]));
}

/** The metamorphic move a face came from, if `faceId` is one of this round's faces — for the button's tag. */
export function isFaceThisRound(
  state: CombatState,
  combatantId: string,
  moveIds: readonly string[],
  faceId: string,
  moves: Record<string, MoveDefinition>,
  passives: Record<PassiveId, PassiveDefinition>
): boolean {
  if (moveIds.includes(faceId)) return false;
  return kitForRound(state, combatantId, moveIds, moves, passives).includes(faceId);
}
