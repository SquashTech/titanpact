// The Titanspawn (docs/titanspawn-overhaul.md §2): the mob layer, one line per mortal type in
// three tiers. Each is a HeroDefinition-shaped enemy with an authored `tier`; the engine never
// reads the tier, and nothing here is recruitable — a spawn lives in `titanspawn`, not `heroes`.
//
// Stats are on the ENEMY convention (six combat stats, HP at HP_BUDGET_VALUE; mana outside it):
// Early 200, Mid 400, Late 600 — below the cast, at it, above it. Early is round (every priced
// stat within 1.3× of the others), Mid grows the type's pair, Late spikes the type's primary stat
// past the hero roster's maximum for it. Kits are the type's own slate read at the tier's band,
// 3 / 4 / 4 moves. Growth grades are authored once per LINE on the hero budget (GRADE_BUDGET),
// because the companion (§5) levels roster-wide like anyone; an enemy spawn never rolls them.
// Every figure is pinned by test/titanspawn.test.ts.

import type { GrowthStatKey, HeroDefinition, MoveTier, StatLine, TypeId } from '../engine/content';
import type { GrowthGrade } from '../run/growth';

export type SpawnTier = MoveTier;

export const SPAWN_TIERS: readonly SpawnTier[] = ['early', 'mid', 'late'];

/** Combat-stat total per tier (statBudget.ts COMBAT_BUDGET_STATS). Authored outright, never derived. */
export const SPAWN_COMBAT_TOTAL: Record<SpawnTier, number> = { early: 200, mid: 400, late: 600 };

/** Moves a spawn holds, all from its type's slate at its own band. */
export const SPAWN_KIT_SIZE: Record<SpawnTier, number> = { early: 3, mid: 4, late: 4 };

/** Widest ratio between any two priced combat stats on an Early — "Early is round". */
export const EARLY_STAT_SPREAD = 1.3;

/** Every type that spawns. Ancient is the finale's alone. */
export const SPAWN_TYPES: readonly TypeId[] = [
  'Fire', 'Water', 'Frost', 'Storm', 'Stone', 'Nature', 'Light',
  'Shadow', 'Arcane', 'Mind', 'Spirit', 'Iron', 'Mech', 'Beast',
];

export interface TitanspawnDefinition extends HeroDefinition {
  types: readonly [TypeId];
  tier: SpawnTier;
}

export interface TitanspawnLine {
  type: TypeId;
  /** The stat the Late spikes past the roster; the Early leans toward it. */
  primaryStat: GrowthStatKey | 'mpRegen';
  /** One name per tier; the Early's ends in -ling. */
  names: Record<SpawnTier, string>;
  stats: Record<SpawnTier, StatLine>;
  moveIds: Record<SpawnTier, readonly string[]>;
  growthGrades: Record<GrowthStatKey, GrowthGrade>;
}

const line = (
  type: TypeId,
  primaryStat: TitanspawnLine['primaryStat'],
  names: [string, string, string],
  stats: [StatLine, StatLine, StatLine],
  moveIds: [readonly string[], readonly string[], readonly string[]],
  growthGrades: Record<GrowthStatKey, GrowthGrade>
): TitanspawnLine => ({
  type,
  primaryStat,
  names: { early: names[0], mid: names[1], late: names[2] },
  stats: { early: stats[0], mid: stats[1], late: stats[2] },
  moveIds: { early: moveIds[0], mid: moveIds[1], late: moveIds[2] },
  growthGrades,
});

const st = (hp: number, attack: number, defense: number, intelligence: number, wisdom: number, speed: number, manaPool: number, mpRegen: number): StatLine =>
  ({ hp, attack, defense, intelligence, wisdom, speed, manaPool, mpRegen });

/** In typechart.ts TYPES order. */
export const titanspawnLines: readonly TitanspawnLine[] = [
  line('Fire', 'intelligence', ['Emberling', 'Kindlehide', 'Pyroclast'],
    [st(64, 30, 30, 38, 34, 36, 40, 10), st(150, 45, 60, 90, 70, 60, 60, 12), st(240, 55, 95, 140, 95, 95, 90, 15)],
    [['ember', 'singe', 'setAlight'], ['scorch', 'backdraft', 'immolate', 'moltenLash'], ['inferno', 'firestorm', 'sparkBurst', 'volcanicSurge']],
    { hp: 'A', attack: 'F', defense: 'C', intelligence: 'S', wisdom: 'B', speed: 'B', manaPool: 'S' }),

  line('Water', 'speed', ['Puddling', 'Rillfin', 'Breakwater'],
    [st(64, 30, 32, 32, 36, 38, 40, 10), st(120, 50, 55, 65, 80, 90, 60, 12), st(200, 75, 95, 105, 100, 125, 90, 15)],
    [['splash', 'siphon', 'refresh'], ['torrent', 'engulf', 'deluge', 'oasis'], ['tsunami', 'maelstrom', 'highTide', 'waveShred']],
    { hp: 'B', attack: 'E', defense: 'C', intelligence: 'B', wisdom: 'A', speed: 'S', manaPool: 'A' }),

  line('Frost', 'hp', ['Sleetling', 'Hoarfang', 'Frostheave'],
    [st(76, 30, 32, 36, 32, 32, 40, 10), st(170, 55, 60, 85, 55, 60, 60, 12), st(360, 60, 100, 120, 80, 60, 90, 15)],
    [['iceShard', 'deepChill', 'snowBlast'], ['icicleThrust', 'glaciate', 'permafrost', 'frigidAir'], ['avalanche', 'absoluteZero', 'iceShatter', 'frostWall']],
    { hp: 'S', attack: 'F', defense: 'B', intelligence: 'S', wisdom: 'B', speed: 'C', manaPool: 'A' }),

  line('Storm', 'speed', ['Arcling', 'Voltail', 'Stormfront'],
    [st(60, 30, 30, 36, 36, 38, 40, 10), st(110, 50, 50, 85, 60, 100, 60, 12), st(180, 60, 70, 130, 90, 160, 90, 15)],
    [['jolt', 'zap', 'charge'], ['chainLightning', 'electricBurst', 'ionize', 'stormLash'], ['thunderbolt', 'ionicZap', 'overcharge', 'stormSurge']],
    { hp: 'C', attack: 'E', defense: 'C', intelligence: 'S', wisdom: 'B', speed: 'S', manaPool: 'A' }),

  line('Stone', 'defense', ['Pebbling', 'Slabback', 'Monolith'],
    [st(72, 32, 38, 30, 32, 32, 40, 10), st(180, 60, 100, 30, 65, 55, 55, 12), st(300, 90, 160, 40, 90, 70, 80, 15)],
    [['rockToss', 'tremor', 'provoke'], ['faultLine', 'bodyBlow', 'bastion', 'rockfall'], ['boulderSlam', 'bodyCrush', 'landslide', 'stoneheart']],
    { hp: 'S', attack: 'B', defense: 'S', intelligence: 'F', wisdom: 'A', speed: 'C', manaPool: 'B' }),

  line('Nature', 'wisdom', ['Sproutling', 'Bramblehide', 'Wildwood'],
    [st(72, 30, 32, 32, 38, 32, 40, 10), st(170, 60, 60, 55, 90, 50, 60, 12), st(260, 90, 90, 90, 150, 50, 90, 15)],
    [['vineLash', 'toxicSpores', 'regrowth'], ['corrode', 'blight', 'wildBloom', 'leafSlice'], ['forceOfNature', 'miasma', 'overgrowth', 'branchSlam']],
    { hp: 'S', attack: 'C', defense: 'B', intelligence: 'B', wisdom: 'S', speed: 'D', manaPool: 'C' }),

  line('Light', 'intelligence', ['Gleamling', 'Lanternmoth', 'Dawnwing'],
    [st(64, 30, 30, 36, 38, 34, 40, 10), st(120, 40, 55, 85, 90, 70, 65, 12), st(200, 50, 80, 150, 120, 100, 100, 15)],
    [['glimmer', 'mend', 'blind'], ['radiantBeam', 'blindingFlash', 'consecrate', 'smite'], ['judgment', 'solarFlare', 'divineGrace', 'exalt']],
    { hp: 'B', attack: 'F', defense: 'C', intelligence: 'S', wisdom: 'S', speed: 'C', manaPool: 'S' }),

  line('Shadow', 'speed', ['Duskling', 'Gloomfang', 'Nocturne'],
    [st(60, 36, 30, 30, 36, 38, 40, 10), st(110, 90, 60, 40, 60, 95, 55, 12), st(180, 130, 70, 60, 80, 170, 80, 15)],
    [['fadeStrike', 'backstab', 'lieInWait'], ['shadowSlice', 'cutthroat', 'shadowstrike', 'enfeeble'], ['duskBlade', 'thousandCuts', 'shadowForm', 'umbralWave']],
    { hp: 'C', attack: 'S', defense: 'C', intelligence: 'E', wisdom: 'B', speed: 'S', manaPool: 'A' }),

  line('Arcane', 'intelligence', ['Runeling', 'Sigilwing', 'Armillary'],
    [st(60, 30, 30, 38, 36, 36, 50, 10), st(120, 40, 55, 95, 75, 75, 90, 12), st(200, 40, 90, 160, 110, 100, 150, 20)],
    [['magicBolt', 'focus', 'manaTap'], ['arcaneBlast', 'arcPulse', 'study', 'empower'], ['singularity', 'cataclysm', 'conduit', 'arcaneOverflow']],
    { hp: 'C', attack: 'F', defense: 'C', intelligence: 'S', wisdom: 'A', speed: 'A', manaPool: 'S' }),

  line('Mind', 'wisdom', ['Whimling', 'Mesmerid', 'Cerebra'],
    [st(64, 30, 30, 38, 36, 34, 40, 10), st(130, 40, 55, 85, 90, 65, 60, 12), st(220, 40, 80, 130, 150, 90, 90, 15)],
    [['psiBolt', 'lull', 'brainWard'], ['psyshock', 'disorient', 'psychicBlow', 'mentalFortress'], ['mindShatter', 'psionicWave', 'breakWill', 'brainFlay']],
    { hp: 'B', attack: 'F', defense: 'C', intelligence: 'S', wisdom: 'S', speed: 'B', manaPool: 'A' }),

  line('Spirit', 'intelligence', ['Wispling', 'Shroudkin', 'Threnody'],
    [st(72, 30, 30, 38, 34, 32, 40, 10), st(160, 45, 55, 90, 70, 60, 60, 12), st(280, 50, 80, 150, 100, 80, 90, 15)],
    [['wisp', 'drain', 'torment'], ['soulRend', 'poltergeist', 'flicker', 'vengeance'], ['banish', 'lastRites', 'ascendant', 'wailingFlight']],
    { hp: 'S', attack: 'F', defense: 'C', intelligence: 'S', wisdom: 'B', speed: 'B', manaPool: 'A' }),

  line('Iron', 'attack', ['Rivetling', 'Ingot', 'Siegework'],
    [st(68, 38, 36, 30, 30, 32, 40, 10), st(140, 95, 95, 30, 50, 60, 55, 12), st(240, 150, 140, 30, 80, 80, 80, 15)],
    [['ironFist', 'heavyBlow', 'sharpen'], ['serratedSlice', 'rendArmor', 'momentumSwing', 'reinforce'], ['onslaught', 'juggernaut', 'swingingChain', 'conjuredSword']],
    { hp: 'A', attack: 'S', defense: 'S', intelligence: 'F', wisdom: 'C', speed: 'C', manaPool: 'A' }),

  // The spike is MP Regen — outside the combat total, and the one stat no hero grows.
  line('Mech', 'mpRegen', ['Cogling', 'Gearhound', 'Dynamo'],
    [st(64, 36, 32, 36, 30, 34, 40, 12), st(130, 80, 60, 80, 50, 65, 60, 16), st(220, 120, 100, 120, 80, 70, 120, 30)],
    [['cogBop', 'backfire', 'overclock'], ['cogSlam', 'overheat', 'whirlingBlades', 'juryRig'], ['meltdown', 'jackpot', 'overdrive', 'perfectCreation']],
    { hp: 'B', attack: 'A', defense: 'B', intelligence: 'A', wisdom: 'D', speed: 'C', manaPool: 'A' }),

  line('Beast', 'hp', ['Cubling', 'Ravager', 'Behemoth'],
    [st(76, 36, 32, 30, 30, 34, 40, 10), st(170, 95, 55, 30, 55, 80, 55, 12), st(380, 140, 100, 30, 60, 80, 80, 15)],
    [['claw', 'venomBite', 'prowl'], ['lacerate', 'maul', 'thrash', 'rampage'], ['eviscerate', 'apexPredator', 'animalSpirit', 'packLeader']],
    { hp: 'S', attack: 'S', defense: 'B', intelligence: 'F', wisdom: 'C', speed: 'A', manaPool: 'B' }),
];

/** `emberling`, `kindlehide`, … — the lowercased name, which the test pins unique across all content. */
export function spawnId(line: TitanspawnLine, tier: SpawnTier): string {
  return line.names[tier].toLowerCase();
}

/** Keyed by id. Folded into `allCombatants` (data/content.ts); never into `heroes`. */
export const titanspawn: Record<string, TitanspawnDefinition> = Object.fromEntries(
  titanspawnLines.flatMap((line) =>
    SPAWN_TIERS.map((tier) => {
      const id = spawnId(line, tier);
      const definition: TitanspawnDefinition = {
        id,
        name: line.names[tier],
        types: [line.type],
        tier,
        baseStats: line.stats[tier],
        moveIds: line.moveIds[tier],
        starter: false,
        growthGrades: line.growthGrades,
      };
      return [id, definition];
    })
  )
);

const lineById = new Map<string, TitanspawnLine>(
  titanspawnLines.flatMap((line) => SPAWN_TIERS.map((tier) => [spawnId(line, tier), line] as const))
);

export function isTitanspawn(heroId: string): boolean {
  return heroId in titanspawn;
}

/** The line a spawn belongs to, and where on it this body sits. Undefined for anything that is not a spawn. */
export function spawnPosition(heroId: string): { line: TitanspawnLine; tier: SpawnTier } | undefined {
  const line = lineById.get(heroId);
  return line ? { line, tier: titanspawn[heroId].tier } : undefined;
}

export function spawnLineOf(type: TypeId): TitanspawnLine | undefined {
  return titanspawnLines.find((line) => line.type === type);
}
