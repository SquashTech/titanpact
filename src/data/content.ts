// Combined combatant lookup — every HeroDefinition-shaped id that can appear
// on a battlefield: the recruitable hero roster plus non-recruitable enemy
// content (docs/run-loop.md "Non-recruitable enemy content"). Combat
// resolution and fight-screen rendering don't care which pool a combatant
// came from — only src/run/recruitment.ts's isRecruitable check does, and it
// checks membership in `heroes` specifically, not this merged pool. Use
// `heroes` (not this) anywhere the player's own roster/recruitment/progression
// is being handled — this export is for resolving whatever is ACTUALLY on the
// field in a given fight, on either side.

import type { HeroDefinition } from '../engine/content';
import { heroes } from './heroes';
import { enemies } from './enemies';

export const allCombatants: Record<string, HeroDefinition> = { ...heroes, ...enemies };
