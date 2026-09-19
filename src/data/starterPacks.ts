import type { StarterPack } from '../run/starterPacks';
import { BASE_PACK_ID } from '../run/starterPacks';
import { heroes } from './heroes';

/**
 * The packs the draft can open on (docs/constellation.md §3, mechanism in run/starterPacks.ts).
 * Pack zero is the fourteen starters, derived from `HeroDefinition.starter` so the two can never
 * drift. The Second String is the first shake-up: the base roster's recruit-only heroes stood in
 * the draft, one a type, opened by the first cleared run and never sold — a player who has seen
 * the fourteen through once is handed fourteen others to open on.
 */
export const STARTER_PACKS: readonly StarterPack[] = [
  {
    id: BASE_PACK_ID,
    name: 'Classic',
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
    unlock: { kind: 'clear' },
  },
];

export const starterPackById: Record<string, StarterPack> = Object.fromEntries(STARTER_PACKS.map((pack) => [pack.id, pack]));
