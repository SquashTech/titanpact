// Curses (docs/wild-innates-and-events.md §3.3): what an event can mark a hero with. The bite only
// MARKS; the Turn — at `turnAt` Mastery pips, or on the spot for a hero already past it — is the
// whole transformation at once: the typing, the body, the innate, the move and the art.

import type { PassiveId, StatKey, TypeId } from '../engine/content';

export interface CurseDefinition {
  id: string;
  name: string;
  /** The Mastery pip the Turn lands on — the Evolution's pip, so the body is played mid-run. */
  turnAt: number;
  /** The hero's whole typing once Turned, both slots; a graft is suppressed. */
  types: readonly TypeId[];
  /** Taught at the Turn (replace-or-decline at MOVE_CAP), so the new typing has STAB on the day. */
  moveId: string;
  /** Replaces the hero's innate from the Turn. */
  passiveIds: readonly PassiveId[];
  /** What the tenth pip makes of it, in place of the hero's own mastered innate. */
  masteredPassiveIds: readonly PassiveId[];
  /** The art the Turned hero wears: art/evolutions/<formId>.png. */
  formId: string;
  /**
   * The Turned hero's base line, REPLACING its own seven budgeted stats (run/curse.ts curseStatDelta);
   * the levels it already rolled, its gear and the Banners stay on top. Over the 550 on purpose.
   */
  baseStats: Readonly<Record<Exclude<StatKey, 'mpRegen'>, number>>;
}

export const curses: Record<string, CurseDefinition> = {
  // Per user direction, 2026-10-03: "super powerful stats, like 650 base". The roster's top Attack,
  // a striker's Speed, a caster's mind gone to the wolf.
  werewolf: {
    id: 'werewolf',
    name: 'Werewolf',
    turnAt: 5,
    types: ['Beast'],
    moveId: 'lacerate',
    passiveIds: ['lycanthrope'],
    masteredPassiveIds: ['lycanthropeMastered'],
    formId: 'werewolf',
    baseStats: { hp: 220, attack: 130, defense: 75, intelligence: 15, wisdom: 60, speed: 100, manaPool: 50 },
  },
};
