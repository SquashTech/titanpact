// The Collection's size (docs/worlds.md §2.2): what a mode that deals from owned heroes waits on.

import { heroes } from '../data/heroes';
import { heroPool } from './recruitment';

export function ownedHeroCount(purchases: readonly string[]): number {
  return Object.keys(heroPool(heroes, purchases)).length;
}
