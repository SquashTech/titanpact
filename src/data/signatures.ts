// The signature moves (docs/mastery.md §5): one authored move per hero, held only at ten Mastery
// pips — the move that says what the hero IS in one button. Riptide's Lizard Rush is the template:
// a solid hit plus the thing the hero does, never a bare nuke. Authored at the hero's innate
// primary type, so STAB is guaranteed without `typeFollowsUser`.
//
// The exclusivity rule, the Class-move rule's sibling (test/mastery.test.ts): a signature is in no
// type pool, no Mentor or Tutor pool, no graft's learnableMoveIds and no path's unlocksMoveIds —
// and carries no `tier`, since a tier gates offers and nothing ever offers one. `signatureMoves`
// fold into data/moves.ts; `HeroDefinition.signatureMoveId` is the pointer.

import type { MoveDefinition } from '../engine/content';

export const signatureMoves: Record<string, MoveDefinition> = {
  // Riptide. It was Tidecaller's clause-5 grant and a Water pool move until 2026-09-14 (Mastery
  // phase 3, per user direction); Tidecaller grants Maelstrom now, and every Riptide reaches this
  // at ten.
  lizardRush: {
    id: 'lizardRush',
    name: 'Lizard Rush',
    type: 'Water',
    category: 'physical',
    kind: 'damage',
    basePower: 75,
    statusApplication: { statusId: 'Renew', magnitude: 25, target: 'bothAllies' },
    manaCost: 45,
    priority: 0,
    target: 'singleEnemy',
    description: 'A charge that drags the whole tide behind it (grants both allies Renew 25).',
  },
};
