// Every combatant that can appear on a battlefield: heroes plus enemies. Use `heroes` for
// anything roster/recruitment/progression-facing — isRecruitable checks `heroes`, not this.

import type { HeroDefinition } from '../engine/content';
import { heroes } from './heroes';
import { enemies, titanEyes, unsealedChampions } from './enemies';
import { titanspawn } from './titanspawn';

// The unsealed champions and the Titanspawn are battlefield-only content (docs/lore.md §6,
// docs/titanspawn-overhaul.md) — they belong here, where rendering and resolution look ids up,
// and nowhere the run pools draw from.
export const allCombatants: Record<string, HeroDefinition> = { ...heroes, ...enemies, ...unsealedChampions, ...titanEyes, ...titanspawn };

/**
 * Everything a ROSTER entry may name: the recruitable pool plus the companion's bodies
 * (run/companion.ts). The roster-facing screens and helpers read this; the pools a run draws
 * from (draft, Guild Hall, contracts, encounters) still read `heroes`, which is what keeps a
 * spawn out of them.
 */
export const rosterHeroes: Record<string, HeroDefinition> = { ...heroes, ...titanspawn };
