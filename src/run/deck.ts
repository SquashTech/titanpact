// The Library's rows (docs/worlds.md §2.1): a new run reads every hero (`libraryRows`, a null
// `RunState.deck`). A run saved with a deck snapshot (docs/collection.md §2) keeps reading it.

import type { HeroDefinition, TypeId } from '../engine/content';
import type { HeroLookup } from '../engine/state';

type Catalog = Record<string, HeroDefinition>;

const primaryOf = (hero: HeroDefinition): TypeId => hero.types[0];

/** The types of the heroes with no `unlock`, in the order the catalog first names them. */
export function draftableTypes(catalog: Catalog): TypeId[] {
  const types: TypeId[] = [];
  for (const hero of Object.values(catalog)) {
    if (!hero.unlock && !types.includes(primaryOf(hero))) types.push(primaryOf(hero));
  }
  return types;
}

/** Every hero by draftable type, in catalog order — the Library's rows, one drawn from each for the draft. */
export function libraryRows(catalog: Catalog): string[][] {
  const all = Object.values(catalog);
  return draftableTypes(catalog).map((type) => all.filter((hero) => primaryOf(hero) === type).map((hero) => hero.id));
}

/** The row a hero belongs in: its innate primary type. */
export function deckRowOf(hero: HeroDefinition): TypeId {
  return primaryOf(hero);
}

export function lookupOf(catalog: Catalog, ids: readonly string[]): HeroLookup {
  return Object.fromEntries(ids.filter((id) => id in catalog).map((id) => [id, catalog[id]]));
}

/**
 * The two pools a run's encounters draw from. A run carrying a deck recruits from it, and its
 * strangers are the rest of the catalog; a run with none reads `fallback` whole and fields no
 * strangers.
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
