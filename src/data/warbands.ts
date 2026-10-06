// The Gathering's warbands (docs/cycles.md §3, Cycle IV): enemy teams built around one engine
// instead of drawn at random — a field and the move it doubles, a Shield wall behind a redirect, a
// DoT and its detonator. Pure data: run/warbands.ts fills each slot with a body that can learn one
// of its moves and guarantees that move into its kit, so the combo is on the field, not in a pool.

export interface WarbandSlot {
  /** Any of these, in preference order: the body must be able to learn one, and the first it can is forced into its kit. */
  moveIds: readonly string[];
}

export interface WarbandDefinition {
  id: string;
  name: string;
  slots: readonly WarbandSlot[];
}

const poison = ['toxicSpores', 'blight', 'corrode', 'venomBite', 'toxicFangs', 'vineLash'];

export const warbands: Record<string, WarbandDefinition> = {
  scorchedEarth: {
    id: 'scorchedEarth',
    name: 'Scorched Earth',
    slots: [{ moveIds: ['spreadingBlaze'] }, { moveIds: ['flareUp', 'immolate'] }, { moveIds: ['setAlight', 'scorch', 'ember', 'sparkBurst'] }],
  },
  consecration: {
    id: 'consecration',
    name: 'Consecration',
    slots: [{ moveIds: ['consecrate', 'hallow'] }, { moveIds: ['smite', 'sunlance'] }, { moveIds: ['benediction', 'vigil'] }],
  },
  surge: {
    id: 'surge',
    name: 'Surge',
    slots: [{ moveIds: ['manaFont', 'magicCloak'] }, { moveIds: ['resonantBolt', 'overload'] }],
  },
  stasis: {
    id: 'stasis',
    name: 'Stasis',
    slots: [{ moveIds: ['stasis', 'distort'] }, { moveIds: ['hindsight'] }],
  },
  overgrowth: {
    id: 'overgrowth',
    name: 'Overgrowth',
    slots: [{ moveIds: ['sow', 'magicGrowth', 'forceOfNature'] }, { moveIds: ['verdantLash'] }],
  },
  shieldWall: {
    id: 'shieldWall',
    name: 'Shield Wall',
    slots: [
      { moveIds: ['bodyguard', 'provoke'] },
      { moveIds: ['bastion', 'rampart', 'crest', 'tideGuard', 'vigil', 'ironSkin', 'wardingSigil'] },
      { moveIds: ['bodyCrush', 'bodyBlow', 'shieldBash', 'retribution', 'stoneheart'] },
    ],
  },
  rot: {
    id: 'rot',
    name: 'Rot',
    slots: [{ moveIds: poison }, { moveIds: poison }, { moveIds: ['miasma', 'grimHarvest'] }],
  },
  bloodletters: {
    id: 'bloodletters',
    name: 'Bloodletters',
    slots: [{ moveIds: ['lacerate', 'bloodTrail', 'rendingLeap', 'duskBlade'] }, { moveIds: ['maul', 'eviscerate'] }],
  },
  conductors: {
    id: 'conductors',
    name: 'Conductors',
    slots: [
      { moveIds: ['risingStatic', 'jolt', 'arcFlash', 'sparkPlug', 'shockBubble', 'ionize', 'stunningBolt'] },
      { moveIds: ['electricBurst', 'ionCascade', 'overcharge', 'metallicBlade', 'whirlingBlades'] },
    ],
  },
  haunting: {
    id: 'haunting',
    name: 'The Haunting',
    slots: [{ moveIds: ['wisp', 'torment', 'poltergeist', 'wickedFear', 'willOWisp'] }, { moveIds: ['seance'] }],
  },
  warDrums: {
    id: 'warDrums',
    name: 'War Drums',
    slots: [
      { moveIds: ['raiseTheStandard', 'rally', 'stormSurge', 'packLeader', 'howl'] },
      { moveIds: ['eviscerate', 'maul', 'bodyCrush', 'rendingLeap', 'landslide', 'immolate'] },
    ],
  },
  deepFreeze: {
    id: 'deepFreeze',
    name: 'Deep Freeze',
    slots: [
      { moveIds: ['frostBolt', 'iceShard', 'deepChill', 'icicleThrust', 'permafrost', 'avalanche'] },
      { moveIds: ['glaciate', 'absoluteZero', 'coldSnap', 'iceShatter'] },
    ],
  },
};
