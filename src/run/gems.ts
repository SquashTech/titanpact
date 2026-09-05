// Gems (docs/run-loop.md "Gems"): the common, stacking half of the relic axis. A Gem IS an
// ordinary relic — the engine never learns the word — so this file owns only the two questions
// the catalog can't answer: when a Gem is handed out, and which ones an offer holds.

import { gemRelics } from '../data/relics';
import type { XpNodeType } from './difficulty';

/** A Gem offer is a 1-of-3, the same shape as the Relic Shrine and the Guardian's Banner. */
export const GEM_OFFER_COUNT = 3;

/**
 * Chance a won fight ALSO pays a Gem offer, by map node type. Every figure is a first-pass
 * placeholder for playtest; only the shape is decided — a Gem is the drip-feed that smooths the
 * player's power curve between the sparse Banner and Shrine grants, so a fight pays one often
 * enough to plan around and rarely enough that a run's Gem spread still differs.
 *
 * The Guardian pays none: it already pays a Banner, and stacking a Gem on top would blur which
 * grant the act-boundary spike came from. The finale ends the run.
 */
export const GEM_DROP_CHANCE: Record<XpNodeType, number> = {
  fight: 0.3,
  battle: 0.35,
  skirmish: 0.35,
  elite: 0.5,
  boss: 0,
  finale: 0,
};

/** The Act 1 opener always pays: the run's first Gem teaches the system rather than rolling for it. */
export function gemDropChanceFor(nodeType: XpNodeType, isRunOpener: boolean): number {
  return isRunOpener ? 1 : GEM_DROP_CHANCE[nodeType];
}

/** `count` distinct Gems, in random order. Ownership is never filtered — Gems are designed to stack. */
export function pickGemOffers(count: number = GEM_OFFER_COUNT, random: () => number = Math.random): string[] {
  const remaining = gemRelics.map((gem) => gem.id);
  const picked: string[] = [];
  while (picked.length < Math.min(count, remaining.length)) {
    picked.push(remaining.splice(Math.floor(random() * remaining.length), 1)[0]);
  }
  return picked;
}

/** `[]` when the roll fails; otherwise the ids the post-fight Gem screen offers. */
export function rollGemOffers(nodeType: XpNodeType, isRunOpener: boolean, random: () => number = Math.random): string[] {
  return random() < gemDropChanceFor(nodeType, isRunOpener) ? pickGemOffers(GEM_OFFER_COUNT, random) : [];
}
