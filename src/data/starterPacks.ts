import type { StarterPack } from '../run/starterPacks';
import { BASE_PACK_ID } from '../run/starterPacks';
import { heroes } from './heroes';

/**
 * The deck presets (docs/collection.md §2, shape in run/starterPacks.ts). The Fourteen is the
 * flagged starters, derived from `HeroDefinition.starter` so the two can never drift — loading it
 * puts the default deck's starters back. The Second String stands the base roster's recruit-only
 * heroes in the draft instead, one a type.
 */
export const STARTER_PACKS: readonly StarterPack[] = [
  {
    id: BASE_PACK_ID,
    name: 'The Fourteen',
    heroIds: Object.values(heroes)
      .filter((hero) => hero.starter)
      .map((hero) => hero.id),
    kind: 'base',
  },
  {
    id: 'secondString',
    name: 'Second String',
    heroIds: ['cinderKnight', 'pincer', 'glacialWarden', 'stormRanger', 'slate', 'mordax', 'empyrean', 'marrow', 'pixie', 'sorrow', 'trance', 'gallant', 'rex', 'ursa'],
    kind: 'recut',
  },
];

export const starterPackById: Record<string, StarterPack> = Object.fromEntries(STARTER_PACKS.map((pack) => [pack.id, pack]));
