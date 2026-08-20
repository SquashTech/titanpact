// ⚠️ TEST FIXTURE CONTENT — a handful of team-wide stat relics sufficient to
// exercise relicReward map nodes and src/run/relics.ts end to end, plus one
// Passive-granting relic (Emberheart) proving relics' side of the Passives
// wiring (RelicDefinition.grantsPassiveIds, src/run/passives.ts). Not
// authored relic content.

import type { RelicDefinition } from '../run/relics';

export const relics: Record<string, RelicDefinition> = {
  ironStandard: {
    id: 'ironStandard',
    name: 'Iron Standard',
    description: 'Team-wide +10 Defense.',
    statGrants: { defense: 10 },
  },
  warHorn: {
    id: 'warHorn',
    name: 'War Horn',
    description: 'Team-wide +10 Attack.',
    statGrants: { attack: 10 },
  },
  sagesLantern: {
    id: 'sagesLantern',
    name: "Sage's Lantern",
    description: 'Team-wide +10 Intelligence, +10 Wisdom.',
    statGrants: { intelligence: 10, wisdom: 10 },
  },
  windcallersBanner: {
    id: 'windcallersBanner',
    name: "Windcaller's Banner",
    description: 'Team-wide +10 Speed.',
    statGrants: { speed: 10 },
  },
  deepWellstone: {
    id: 'deepWellstone',
    name: 'Deep Wellstone',
    description: 'Team-wide +20 Mana pool, +5 MP Regen.',
    statGrants: { manaPool: 20, mpRegen: 5 },
  },
  bulwarkCore: {
    id: 'bulwarkCore',
    name: 'Bulwark Core',
    description: 'Team-wide +20 HP.',
    statGrants: { hp: 20 },
  },
  emberheart: {
    id: 'emberheart',
    name: 'Emberheart',
    description: 'Team-wide: grants the Emberheart passive (+20% bonus damage with Fire-type moves).',
    statGrants: {},
    grantsPassiveIds: ['emberheart'],
  },
};
