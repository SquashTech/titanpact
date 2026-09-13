// Every combatant that can appear on a battlefield: heroes plus enemies. Use `heroes` for
// anything roster/recruitment/progression-facing — isRecruitable checks `heroes`, not this.

import type { HeroDefinition } from '../engine/content';
import { heroes } from './heroes';
import { enemies, unsealedChampions } from './enemies';
import { titanspawn } from './titanspawn';

// The unsealed champions and the Titanspawn are battlefield-only content (docs/lore.md §6,
// docs/titanspawn-overhaul.md) — they belong here, where rendering and resolution look ids up,
// and nowhere the run pools draw from.
export const allCombatants: Record<string, HeroDefinition> = { ...heroes, ...enemies, ...unsealedChampions, ...titanspawn };
