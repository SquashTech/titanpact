// The move and stat vocabulary every surface shares, kept free of React so the sim can read
// combat beats (scripts/sim/beats.ts) through the same buildBeats the fight screen uses.

import type { MoveDefinition, StatKey } from '../../engine/content';
import { statusApplicationsOf } from '../../engine/content';
import { statuses } from '../../data/statuses';

export type MoveKindGlyphKind = 'physical' | 'magical' | 'heal' | 'buff' | 'debuff';

/** 3-letter codes for the fixed-width bar-label column; relicStacks.ts has the full words. */
export const STAT_LABELS: Record<StatKey, string> = {
  hp: 'HP',
  attack: 'ATK',
  defense: 'DEF',
  intelligence: 'INT',
  wisdom: 'WIS',
  speed: 'SPD',
  manaPool: 'MP',
  mpRegen: 'MPR',
};

// `kind: 'buff'` covers both signs in the data; the sign is recovered here, once, so glyph, badge
// colour and label can never disagree. A move carrying both reads as a debuff (open UI question).
export function isDebuff(move: MoveDefinition): boolean {
  if (move.statDeltas?.some(({ amount }) => amount < 0)) return true;
  return statusApplicationsOf(move).some((app) => app.target !== 'self' && !statuses[app.statusId]?.positive);
}

/** The one MoveDefinition -> MoveKindGlyphKind mapping in the app. */
export function moveKindGlyph(move: MoveDefinition): MoveKindGlyphKind {
  if (move.kind === 'damage') return move.category;
  if (move.kind === 'heal') return 'heal';
  return isDebuff(move) ? 'debuff' : 'buff';
}
