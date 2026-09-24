// First-time tips (docs/tutorial.md): mechanism only. Every word a tip says lives in
// src/data/tips.ts — this module never imports it, the arrangement events.ts / data/events.ts use.
//
// There is no tutorial run. A first run is an ordinary run, and the first time the player meets a
// mechanic — a screen, a node, a situation inside a fight — a short, out-of-universe card says what
// it is, once. Which ones have been shown is PROFILE state (`Profile.seenTipIds`), not run state, so
// a tip read in a run that was wiped is not read again in the next one.

import type { TypeId } from '../engine/content';
import type { MapNodeType } from './map';

export interface Tip {
  id: string;
  /** The mechanic being named, as the card's header. */
  title: string;
  /** One page per tap. Most tips are a single page; none should need more than three. */
  pages: readonly string[];
}

/** The lore card's id in `seenTipIds`: the four lines ahead of the first draft, once an account. */
export const LORE_TIP_ID = 'lore';

// --- Inline icons ---

/**
 * Icon tokens a page may carry, written `[physical]`. Naming a mechanic is weaker than showing the
 * mark the player is about to go looking for, so a tip can print the glyph the move buttons wear.
 * Opaque NAMES here; the view maps them onto glyphs, so the run tier stays free of the view tier.
 */
export const TIP_ICON_TOKENS = ['physical', 'magical', 'heal', 'buff', 'debuff'] as const;

export type TipIconToken = (typeof TIP_ICON_TOKENS)[number];

export type TipSegment = { text: string } | { icon: TipIconToken };

/** Any `[word]`, so an unknown token can be reported rather than silently printed as prose. */
const TOKEN_PATTERN = /\[([a-zA-Z]+)\]/g;

export function isTipIconToken(value: string): value is TipIconToken {
  return (TIP_ICON_TOKENS as readonly string[]).includes(value);
}

/** Splits a page into text and icon runs. An unrecognised `[word]` stays literal — a typo should look wrong, and a test fails on one. */
export function parseTipText(text: string): TipSegment[] {
  const segments: TipSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const token = match[1];
    if (!isTipIconToken(token)) continue;
    const at = match.index ?? 0;
    if (at > cursor) segments.push({ text: text.slice(cursor, at) });
    segments.push({ icon: token });
    cursor = at + match[0].length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

/** Every `[word]` in a page that is NOT a known token. */
export function unknownIconTokens(text: string): string[] {
  return [...text.matchAll(TOKEN_PATTERN)].map((m) => m[1]).filter((token) => !isTipIconToken(token));
}

// --- Out-of-fight tips ---

/**
 * Every id App.tsx can ask for from a screen (`screenTipIds`). App is the only producer and this is
 * the list it produces, so the content can be checked against it: an id renamed on one side and not
 * the other is a tip that silently never plays (`test/tips.test.ts`).
 */
export const SCREEN_TIP_IDS = [
  'draft',
  'run',
  'map',
  'wounds',
  'fork',
  'squad',
  'levelUp',
  'item',
  'companion',
  'fallen',
  'equipmentReward',
  'tutor',
  'boon',
  'manaWell',
  'leyLine',
  'rest',
  'event',
  'scribe',
  'scrollCache',
  'shop',
  'recruit',
  'banner',
  'crucible',
  'seal',
  'locationChoice',
] as const;

export type ScreenTipId = (typeof SCREEN_TIP_IDS)[number];

/**
 * The first candidate the player has not seen, or null. Candidates are in priority order — a
 * screen can be the first meeting with more than one thing (the map after a fight is both "HP
 * carries over" and, one row on, "Elite or Skirmish"), and each lands on its own visit.
 */
export function firstUnseenTip(
  tips: Readonly<Record<string, Tip>>,
  candidateIds: readonly string[],
  seenIds: readonly string[]
): Tip | null {
  for (const id of candidateIds) {
    if (seenIds.includes(id)) continue;
    const tip = tips[id];
    if (tip) return tip;
  }
  return null;
}

// --- Mid-fight tips ---

/**
 * When a fight tip fires, checked at the top of every command phase. Every authored field must
 * hold. Declarative so the content file stays pure data.
 */
export interface FightTipCondition {
  /** This round or later. */
  minRound?: number;
  /** Only at these map nodes. */
  nodeTypes?: readonly MapNodeType[];
  /** A player active hero can pay for no move at all — the moment Rest exists for. */
  outOfMana?: boolean;
  /** The player side has lost voluntary switching. */
  lockedIn?: boolean;
  /** The player has someone on the bench. */
  benchHeld?: boolean;
  /** At least one player hero has been knocked out this fight. */
  playerKnockedOut?: boolean;
  /** An enemy of this type is standing on the field. */
  enemyTypeOnField?: TypeId;
  /** A Field Effect is up. */
  fieldEffectActive?: boolean;
  /** The Pact Clock's warning has started, or the clock itself. */
  pactClockNear?: boolean;
}

export interface FightTip extends Tip {
  when: FightTipCondition;
}

/** What a fight tip is tested against. FightScreen derives it from live combat state. */
export interface FightTipContext {
  round: number;
  nodeType: MapNodeType;
  anyOutOfMana: boolean;
  lockedIn: boolean;
  benchSize: number;
  playerKnockouts: number;
  enemyTypesOnField: readonly TypeId[];
  fieldEffectActive: boolean;
  pactClockNear: boolean;
}

function fightTipMatches(when: FightTipCondition, ctx: FightTipContext): boolean {
  if (when.minRound !== undefined && ctx.round < when.minRound) return false;
  if (when.nodeTypes !== undefined && !when.nodeTypes.includes(ctx.nodeType)) return false;
  if (when.outOfMana !== undefined && ctx.anyOutOfMana !== when.outOfMana) return false;
  if (when.lockedIn !== undefined && ctx.lockedIn !== when.lockedIn) return false;
  if (when.benchHeld !== undefined && ctx.benchSize > 0 !== when.benchHeld) return false;
  if (when.playerKnockedOut !== undefined && ctx.playerKnockouts > 0 !== when.playerKnockedOut) return false;
  if (when.enemyTypeOnField !== undefined && !ctx.enemyTypesOnField.includes(when.enemyTypeOnField)) return false;
  if (when.fieldEffectActive !== undefined && ctx.fieldEffectActive !== when.fieldEffectActive) return false;
  if (when.pactClockNear !== undefined && ctx.pactClockNear !== when.pactClockNear) return false;
  return true;
}

/**
 * The first unseen fight tip whose conditions hold. List order is priority order, so the basics
 * on round 1 win over a standing condition that happens to be true at the same moment.
 */
export function matchFightTip(tips: readonly FightTip[], ctx: FightTipContext, seenIds: readonly string[]): FightTip | null {
  return tips.find((tip) => !seenIds.includes(tip.id) && fightTipMatches(tip.when, ctx)) ?? null;
}
