// Non-recruitable enemy content (docs/run-loop.md "Non-recruitable enemy content").
// Same shape as HeroDefinition but a separate pool from heroes.ts, which is what lets
// isRecruitable exclude it — a KO'd Goblin never produces a Recruit Contract offer.
//
// Grouped by faction: `factions` below is what a Location points at, so adding a
// faction is data plus one field on LocationDefinition (docs/locations.md §5.2).

import type { HeroDefinition } from '../engine/content';
import type { HeroLookup } from '../engine/state';

export const enemies: Record<string, HeroDefinition> = {
  // --- Goblins (Wild's Edge) — authored for Act 1 ---
  goblinGrunt: {
    id: 'goblinGrunt',
    name: 'Goblin Grunt',
    types: ['Beast'],
    baseStats: { hp: 50, attack: 35, defense: 25, intelligence: 15, wisdom: 20, speed: 40, manaPool: 40, mpRegen: 10 },
    moveIds: ['claw', 'venomBite'],
    starter: false,
  },
  goblinSkulker: {
    id: 'goblinSkulker',
    name: 'Goblin Skulker',
    types: ['Shadow'],
    baseStats: { hp: 45, attack: 30, defense: 20, intelligence: 15, wisdom: 20, speed: 45, manaPool: 40, mpRegen: 10 },
    moveIds: ['backstab', 'weaken'],
    starter: false,
  },
  spookyGoblin: {
    id: 'spookyGoblin',
    name: 'Spooky Goblin',
    types: ['Spirit'],
    baseStats: { hp: 42, attack: 20, defense: 20, intelligence: 35, wisdom: 30, speed: 42, manaPool: 40, mpRegen: 10 },
    moveIds: ['wisp', 'drain'],
    starter: false,
  },
  goblinWarrior: {
    id: 'goblinWarrior',
    name: 'Goblin Warrior',
    types: ['Iron'],
    baseStats: { hp: 55, attack: 35, defense: 35, intelligence: 10, wisdom: 15, speed: 30, manaPool: 40, mpRegen: 10 },
    moveIds: ['ironFist', 'openingStrike'],
    starter: false,
  },
  torchGoblin: {
    id: 'torchGoblin',
    name: 'Torch Goblin',
    types: ['Fire'],
    baseStats: { hp: 42, attack: 32, defense: 18, intelligence: 25, wisdom: 18, speed: 48, manaPool: 40, mpRegen: 10 },
    moveIds: ['ember', 'singe'],
    starter: false,
  },
  // Fields the "Monsters" battle node alongside 3 random basic Goblins; never randomly drawn.
  // +100 HP over the original 110 (2026-09-02): everything else about him was already a
  // step up from the basics, but he died on the same timetable they did, so the fixed
  // threat backing the variable support never got to be one. The extra bulk is all in HP
  // on purpose — he outlasts the player's opening, he does not out-hit it.
  goblinChief: {
    id: 'goblinChief',
    name: 'Goblin Chief',
    types: ['Beast'],
    baseStats: { hp: 210, attack: 60, defense: 45, intelligence: 25, wisdom: 35, speed: 50, manaPool: 70, mpRegen: 14 },
    moveIds: ['lacerate', 'packHunt'],
    starter: false,
  },
  // Wild's Edge's Guardian reinforcement: held on the enemy bench so the fight's first KO
  // brings him in (enemyGen.ts `appendFinalEnemy`, locations.ts `guardianFinalEnemyId`).
  // Not in the faction's basics and not drawn by any generator. Stat total 600 is a playtest figure.
  // Redistributed 2026-09-02, per user direction: -15 Attack and -10 Intelligence into +25 HP,
  // total untouched. He walks on after a KO with the fight already going the player's way, so
  // his job is to take that back over several rounds rather than to two-shot whoever is left.
  goblinLord: {
    id: 'goblinLord',
    name: 'Goblin Lord',
    types: ['Beast', 'Ancient'],
    baseStats: { hp: 215, attack: 90, defense: 85, intelligence: 70, wisdom: 65, speed: 75, manaPool: 120, mpRegen: 20 },
    moveIds: ['thrash', 'momentumSwing', 'enfeeble', 'archonBlast'],
    starter: false,
  },

  // --- Cultists (Blighted Shrine) — authored for Act 2, scaled up from there ---
  // Every one is Shadow-primary: the faction reads as one cult, and its shared
  // weakness to Light and Spirit is the price of that legibility.
  //
  // The basics sit at 400 combat stats — the TOP of the hero band, not under it.
  // A Goblin is fodder on purpose; a Cultist is not, and an Act 2 squad carrying
  // two acts of equipment should have to actually fight one. Their mana is where
  // they are still mobs: hero-sized pools would let them cast a hero's whole game.
  cultBlade: {
    id: 'cultBlade',
    name: 'Cult Blade',
    types: ['Shadow', 'Iron'],
    baseStats: { hp: 105, attack: 85, defense: 75, intelligence: 25, wisdom: 45, speed: 65, manaPool: 50, mpRegen: 12 },
    moveIds: ['backstab', 'heavyBlow', 'pinDown'],
    starter: false,
  },
  dreadCultist: {
    id: 'dreadCultist',
    name: 'Dread Cultist',
    types: ['Shadow'],
    baseStats: { hp: 100, attack: 30, defense: 60, intelligence: 90, wisdom: 70, speed: 50, manaPool: 60, mpRegen: 12 },
    moveIds: ['umbraBolt', 'weaken', 'drain'],
    starter: false,
  },
  blightedCultist: {
    id: 'blightedCultist',
    name: 'Blighted Cultist',
    types: ['Shadow', 'Nature'],
    baseStats: { hp: 125, attack: 40, defense: 70, intelligence: 80, wisdom: 60, speed: 25, manaPool: 55, mpRegen: 12 },
    moveIds: ['toxicSpores', 'umbraBolt', 'blight'],
    starter: false,
  },
  // Deep Chill sets up Glaciate, which the AI will not declare without a Frozen target
  // (ai.ts hasLegalTarget) — the 65 mana pool is sized to fund both in consecutive rounds.
  frozenCultist: {
    id: 'frozenCultist',
    name: 'Frozen Cultist',
    types: ['Shadow', 'Frost'],
    baseStats: { hp: 100, attack: 35, defense: 70, intelligence: 90, wisdom: 70, speed: 35, manaPool: 65, mpRegen: 12 },
    moveIds: ['deepChill', 'glaciate', 'umbraBolt'],
    starter: false,
  },
  // Fields the "Monsters" battle node alongside 3 random basic Cultists; never randomly drawn.
  // Empower is the faction's tell: the Mystic pours 80 mana into a Cultist that cannot
  // otherwise afford its own best move. At 500 it is only a quarter clear of its own
  // support — deliberately flatter than the Goblin Chief's 1.8x, because what makes a
  // Blighted Shrine `battle` hard is Enfeeble and Empower landing on three real threats,
  // not one fat healthbar.
  cultMystic: {
    id: 'cultMystic',
    name: 'Cult Mystic',
    types: ['Shadow', 'Arcane'],
    baseStats: { hp: 145, attack: 40, defense: 75, intelligence: 100, wisdom: 80, speed: 60, manaPool: 100, mpRegen: 16 },
    moveIds: ['magicBolt', 'umbralBeam', 'enfeeble', 'empower'],
    starter: false,
  },
  // The Blighted Shrine's Guardian reinforcement, the Goblin Lord's opposite number one
  // act later: 700 to his 600, and a magical line where his is physical.
  yugzulach: {
    id: 'yugzulach',
    name: 'Yugzulach',
    types: ['Shadow', 'Ancient'],
    baseStats: { hp: 220, attack: 90, defense: 100, intelligence: 120, wisdom: 95, speed: 75, manaPool: 140, mpRegen: 20 },
    moveIds: ['runicBlast', 'forgottenCurse', 'duskBlade', 'eclipse'],
    starter: false,
  },

  // --- Raiders (Storm Coast) — authored for Act 2, scaled up from there ---
  // Every one is Iron-primary: a warband in mail, not five unrelated coastal things.
  // The price of that spine is Fire, Storm and Mech, which all read 2x off Iron.
  //
  // What makes them a different fight from the Cultists at the same stat band is
  // Conduct. The status is authored to detonate off `triggerTypes: ['Storm', 'Iron']`
  // — which is this faction's entire damage output — and two of their moves go FREE
  // against a marked field (metallicBlade on any mark, overcharge on both). So the
  // Stormraider's Ionize is worth a whole turn: it buys the warband a round where the
  // mana brake is off and every hit carries +10% max HP on top. The counterplay is
  // that detonating consumes the mark, so the discount and the damage compete.
  raider: {
    id: 'raider',
    name: 'Raider',
    types: ['Iron'],
    baseStats: { hp: 110, attack: 90, defense: 75, intelligence: 20, wisdom: 40, speed: 65, manaPool: 50, mpRegen: 12 },
    moveIds: ['openingStrike', 'heavyBlow', 'metallicBlade'],
    starter: false,
  },
  // The one who salts the field. Ionize is priority +1 and hits both, but the AI prices
  // moves off the pre-round snapshot, so the marks it plants pay out the round AFTER —
  // the pool is sized to cast it and still reach Storm Lash next round.
  stormRaider: {
    id: 'stormRaider',
    name: 'Stormraider',
    types: ['Iron', 'Storm'],
    baseStats: { hp: 115, attack: 90, defense: 80, intelligence: 25, wisdom: 40, speed: 50, manaPool: 65, mpRegen: 12 },
    moveIds: ['ionize', 'stormLash', 'ironFist'],
    starter: false,
  },
  // The fastest Raider, and Swift Blow is why: priority +1 on 15 base power is nothing on
  // its own, but it cashes a Conduct mark for 10% of the target's max HP before the round
  // properly starts. Its Water half opens the holes the rest of the line swings into.
  surfRaider: {
    id: 'surfRaider',
    name: 'Surfraider',
    types: ['Iron', 'Water'],
    baseStats: { hp: 95, attack: 85, defense: 65, intelligence: 25, wisdom: 45, speed: 85, manaPool: 55, mpRegen: 12 },
    moveIds: ['swiftBlow', 'undertow', 'aquaSlice'],
    starter: false,
  },
  // Infuse is the basic-tier answer to the faction's own mana brake: 40 mana tops an
  // ally back up to a second cast rather than overflowing it, which is the Champion's job.
  // Fortify is the Iron a caster actually uses — no Attack in the line to spend, and the
  // reason this is the one Raider that neither plants a Conduct mark nor cashes one: the
  // only Iron move that runs off Intelligence is Conjured Sword, at twice its pool.
  mysticRaider: {
    id: 'mysticRaider',
    name: 'Mysticraider',
    types: ['Iron', 'Arcane'],
    baseStats: { hp: 100, attack: 30, defense: 70, intelligence: 95, wisdom: 70, speed: 35, manaPool: 65, mpRegen: 12 },
    moveIds: ['fortify', 'infuse', 'magicBolt'],
    starter: false,
  },
  // Fields the "Monsters" battle node alongside 3 random basic Raiders; never randomly drawn.
  // 500, the Cult Mystic's figure, but spent the other way round: he is a pure physical
  // line where she is a caster. His tell is Overcharge — 80 base power for nothing once
  // the field is conducting, on top of the detonation the hit itself sets off.
  championRaider: {
    id: 'championRaider',
    name: 'Champion Raider',
    types: ['Iron', 'Storm'],
    baseStats: { hp: 150, attack: 110, defense: 90, intelligence: 30, wisdom: 50, speed: 70, manaPool: 100, mpRegen: 16 },
    moveIds: ['heavyBlow', 'stormLash', 'reinforce', 'overcharge'],
    starter: false,
  },
  // The Storm Coast's Guardian reinforcement, and the one thing on this coast that is
  // not a Raider — which is the point: the champion hangs off the Location, not the
  // faction. 700, matching Yugzulach, and Water/Ancient rather than the warband's Iron.
  // Archon Blast is the Goblin Lord's move because the Ancient slate is three moves
  // long and unauthored (CLAUDE.md "Repo map"); it should be revisited when Ancient lands.
  leviathan: {
    id: 'leviathan',
    name: 'Leviathan',
    types: ['Water', 'Ancient'],
    baseStats: { hp: 230, attack: 95, defense: 95, intelligence: 130, wisdom: 100, speed: 50, manaPool: 150, mpRegen: 20 },
    moveIds: ['aquaSlice', 'maelstrom', 'archonBlast', 'tsunami'],
    starter: false,
  },
};

/**
 * A Location's mob roster. `basicIds` is what the `fight` node draws 2 of and the
 * `battle` node draws 3 of; `leaderId` is always present in a `battle` and never
 * randomly drawn. The Guardian's champion is deliberately NOT here — it hangs off
 * the Location, because which champion walks out is a property of whose ground you
 * are on rather than of the faction alone (docs/locations.md `guardianFinalEnemyId`).
 */
export interface FactionRoster {
  id: string;
  name: string;
  /** The act these stat lines represent. `difficulty.ts` scales the pool up from here. */
  baselineAct: number;
  basicIds: readonly string[];
  leaderId: string;
}

export const factions: Record<string, FactionRoster> = {
  goblins: {
    id: 'goblins',
    name: 'Goblins',
    baselineAct: 2,
    basicIds: ['goblinGrunt', 'goblinSkulker', 'spookyGoblin', 'goblinWarrior', 'torchGoblin'],
    leaderId: 'goblinChief',
  },
  cultists: {
    id: 'cultists',
    name: 'Cultists',
    baselineAct: 2,
    basicIds: ['cultBlade', 'dreadCultist', 'blightedCultist', 'frozenCultist'],
    leaderId: 'cultMystic',
  },
  raiders: {
    id: 'raiders',
    name: 'Raiders',
    baselineAct: 2,
    basicIds: ['raider', 'stormRaider', 'surfRaider', 'mysticRaider'],
    leaderId: 'championRaider',
  },
};

/** The faction every location without an authored one still fields (docs/locations.md "The faction bill"). */
export const DEFAULT_FACTION_ID = 'goblins';

/** Pointed at by `LocationDefinition.guardianFinalEnemyId`. */
export const GOBLIN_LORD_ID = 'goblinLord';
export const YUGZULACH_ID = 'yugzulach';
export const LEVIATHAN_ID = 'leviathan';

/** `enemies` narrowed to one faction's basics, for the generators that must never draw its leader. */
export function basicEnemiesOf(faction: FactionRoster): HeroLookup {
  return Object.fromEntries(faction.basicIds.map((id) => [id, enemies[id]]));
}
