// The Deck (docs/collection.md §2): the player, not the definition, decides which owned heroes
// open a run and which can join one. A row a draftable type, three heroes a row — index 0 the
// starter slot (the draft's pool), 1 and 2 the recruit slots — and all of it the run's pool.
// Pure data in, data out: the profile holds the deck, a run holds a snapshot of it.

import type { HeroDefinition, TypeId } from '../engine/content';
import type { HeroLookup } from '../engine/state';
import { heroPool } from './recruitment';

export const DECK_ROW_SIZE = 3;
/** A recruitable fight fields at least this many deck heroes; the rest may be strangers (§3). */
export const DECK_HEROES_PER_FIGHT = 2;

/** type → [starter, recruit, recruit]. A row is short only when the account owns fewer of the type. */
export type Deck = Readonly<Record<TypeId, readonly string[]>>;

type Catalog = Record<string, HeroDefinition>;

const primaryOf = (hero: HeroDefinition): TypeId => hero.types[0];

/** The types with a starter in the base roster, in the order the catalog first names them. */
export function draftableTypes(catalog: Catalog): TypeId[] {
  const types: TypeId[] = [];
  for (const hero of Object.values(catalog)) {
    if (hero.starter && !hero.unlock && !types.includes(primaryOf(hero))) types.push(primaryOf(hero));
  }
  return types;
}

/** Owned heroes of a type, the flagged starter first, then catalog order. */
function ownedOfType(owned: Catalog, type: TypeId): string[] {
  const ofType = Object.values(owned).filter((hero) => primaryOf(hero) === type);
  return [...ofType.filter((h) => h.starter), ...ofType.filter((h) => !h.starter)].map((h) => h.id);
}

/** The deck a fresh account holds: each type's flagged starter in its starter slot, the base roster's other two in the recruit slots. */
export function defaultDeck(catalog: Catalog): Deck {
  return normalizeDeck({}, catalog, []);
}

/**
 * Any stored value made into a legal deck against what the account owns: unknown, unowned and
 * mistyped ids dropped, duplicates dropped, short rows topped up in default order. What a hand-
 * edited file or a hero leaving the catalog can do to a deck is undone here, and only here.
 */
export function normalizeDeck(raw: unknown, catalog: Catalog, purchases: readonly string[]): Deck {
  const owned = heroPool(catalog, purchases);
  const stored = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const deck: Record<TypeId, string[]> = {};
  for (const type of draftableTypes(catalog)) {
    const row: string[] = [];
    const wanted = Array.isArray(stored[type]) ? (stored[type] as unknown[]) : [];
    for (const id of [...wanted, ...ownedOfType(owned, type)]) {
      if (row.length >= DECK_ROW_SIZE) break;
      if (typeof id !== 'string' || row.includes(id)) continue;
      const hero = owned[id];
      if (hero && primaryOf(hero) === type) row.push(id);
    }
    deck[type] = row;
  }
  return deck;
}

/** The profile's deck, legal against what it owns now. */
export function profileDeck(profile: { deck: unknown; purchases: readonly string[] }, catalog: Catalog): Deck {
  return normalizeDeck(profile.deck, catalog, profile.purchases);
}

/** The draft's pool: every row's starter slot. */
export function deckStarters(deck: Deck): string[] {
  return Object.values(deck)
    .map((row) => row[0])
    .filter((id): id is string => id !== undefined);
}

/** Every hero in the deck — the run's pool. */
export function deckHeroIds(deck: Deck): string[] {
  return Object.values(deck).flat();
}

/** Owned heroes of `type` not in its row — the ones a swap can bring in. */
export function reserveOfType(deck: Deck, catalog: Catalog, purchases: readonly string[], type: TypeId): string[] {
  const row = deck[type] ?? [];
  return ownedOfType(heroPool(catalog, purchases), type).filter((id) => !row.includes(id));
}

export class DeckError extends Error {}

function rowOf(deck: Deck, heroId: string): TypeId {
  const type = Object.keys(deck).find((t) => deck[t].includes(heroId));
  if (!type) throw new DeckError(`${heroId} is not in the deck`);
  return type;
}

/** Moves a decked hero into its row's starter slot; the old starter takes its place. */
export function makeStarter(deck: Deck, heroId: string): Deck {
  const type = rowOf(deck, heroId);
  const row = [...deck[type]];
  const at = row.indexOf(heroId);
  [row[0], row[at]] = [row[at], row[0]];
  return { ...deck, [type]: row };
}

/** An owned, un-decked hero takes a decked one's slot in the same row. */
export function swapIntoDeck(deck: Deck, catalog: Catalog, purchases: readonly string[], inId: string, outId: string): Deck {
  const type = rowOf(deck, outId);
  if (!reserveOfType(deck, catalog, purchases, type).includes(inId)) throw new DeckError(`${inId} cannot take a ${type} slot`);
  return { ...deck, [type]: deck[type].map((id) => (id === outId ? inId : id)) };
}

/** A preset (docs/collection.md §2) stands each of its heroes in its row's starter slot; a hero not held or not decked is skipped. */
export function applyPreset(deck: Deck, heroIds: readonly string[]): Deck {
  let next = deck;
  for (const id of heroIds) {
    if (deckHeroIds(next).includes(id)) next = makeStarter(next, id);
  }
  return next;
}

/** Whether every one of a preset's heroes already sits in a starter slot. */
export function presetApplied(deck: Deck, heroIds: readonly string[]): boolean {
  const starters = new Set(deckStarters(deck));
  return heroIds.every((id) => starters.has(id));
}

export function lookupOf(catalog: Catalog, ids: readonly string[]): HeroLookup {
  return Object.fromEntries(ids.filter((id) => id in catalog).map((id) => [id, catalog[id]]));
}

/**
 * The two pools a run's encounters draw from. A run carrying a deck recruits from it, and its
 * strangers are the rest of the catalog; a run saved before decks reads `fallback` whole and
 * fields no strangers, as it did.
 */
export function encounterPools(run: { deck: readonly string[] | null }, catalog: Catalog, fallback: HeroLookup = catalog): { heroes: HeroLookup; strangers?: HeroLookup } {
  if (!run.deck) return { heroes: fallback };
  const decked = new Set(run.deck);
  return {
    heroes: lookupOf(catalog, run.deck),
    strangers: lookupOf(
      catalog,
      Object.keys(catalog).filter((id) => !decked.has(id))
    ),
  };
}
