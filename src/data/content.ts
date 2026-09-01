// Every combatant that can appear on a battlefield: heroes plus enemies. Use `heroes` for
// anything roster/recruitment/progression-facing — isRecruitable checks `heroes`, not this.

import type { HeroDefinition } from '../engine/content';
import { heroes } from './heroes';
import { enemies } from './enemies';

export const allCombatants: Record<string, HeroDefinition> = { ...heroes, ...enemies };
