// Passives granted by Evolution paths (docs/evolution-simplification.md), one file a type.
// Evolution-only: in no Boon pool, like every Evolution passive.

import type { PassiveDefinition } from '../../engine/content';
import { firePathPassives } from './fire';
import { waterPathPassives } from './water';
import { frostPathPassives } from './frost';
import { stormPathPassives } from './storm';
import { stonePathPassives } from './stone';
import { naturePathPassives } from './nature';
import { lightPathPassives } from './light';
import { shadowPathPassives } from './shadow';
import { arcanePathPassives } from './arcane';
import { mindPathPassives } from './mind';
import { spiritPathPassives } from './spirit';
import { ironPathPassives } from './iron';
import { mechPathPassives } from './mech';
import { beastPathPassives } from './beast';

export const pathPassives: Record<string, PassiveDefinition> = {
  ...firePathPassives,
  ...waterPathPassives,
  ...frostPathPassives,
  ...stormPathPassives,
  ...stonePathPassives,
  ...naturePathPassives,
  ...lightPathPassives,
  ...shadowPathPassives,
  ...arcanePathPassives,
  ...mindPathPassives,
  ...spiritPathPassives,
  ...ironPathPassives,
  ...mechPathPassives,
  ...beastPathPassives,
};
