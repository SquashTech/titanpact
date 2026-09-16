// Non-recruitable AUTHORED enemies: the six Guardian champions and the Endbringer. Same shape as
// HeroDefinition but a separate pool from heroes.ts, which is what lets isRecruitable exclude it —
// a KO'd champion never produces a Recruit Contract offer.
//
// The mob layer is not here. Every basic and leader the Locations used to author went with the
// factions (docs/titanspawn-overhaul.md §7); what a `fight`, `battle` or Guardian escort draws now
// is a Titanspawn (data/titanspawn.ts), by the Location's `spawnTypes` and the act's tier.

import type { GrowthStatKey, HeroDefinition } from '../engine/content';
import type { HeroLookup } from '../engine/state';
import type { GrowthGrade } from '../run/growth';

/**
 * A champion is FRONT-LOADED: authored at full strength, so its level buys it little
 * (docs/enemy-levels.md §5). E across the board — a hero line sums to 28, this to 7 — and the
 * same for the Endbringer. Measured: on hero grades the Act 2 Guardian fell to 67% cleared.
 */
export const CHAMPION_GRADES: Record<GrowthStatKey, GrowthGrade> = {
  hp: 'E', attack: 'E', defense: 'E', intelligence: 'E', wisdom: 'E', speed: 'E', manaPool: 'E',
};

export const enemies: Record<string, HeroDefinition> = {
  // Wild's Edge's Guardian reinforcement (the Goblin Lord until 2026-09-16, renamed with its
  // figure — guardianFigures.ts draws a manticore, per user direction): held on the enemy bench so
  // the fight's first KO brings it in (enemyGen.ts `appendFinalEnemy`, locations.ts `guardianFinalEnemyId`).
  // Never drawn by any generator.
  // Redistributed 2026-09-02, per user direction: -15 Attack and -10 Intelligence into +25 HP,
  // total untouched. He walks on after a KO with the fight already going the player's way, so
  // his job is to take that back over several rounds rather than to two-shot whoever is left.
  // The same trade again 2026-09-15, per user direction: -10 Attack into +20 HP. With gear
  // absorbed and Act 1 two levels lighter he was still the act's wall at 77% and killing two
  // heroes a fight; Attack is the term his whole kit swings with, and HP is what the trade buys
  // (Guardian 77 -> 82%, Act 1 58 -> 62%). A shift into Mana measured WORSE — the pool feeds
  // Archon Blast — and MP Regen barely moved it; Attack is the dial.
  manticore: {
    id: 'manticore',
    name: 'Manticore',
    types: ['Beast', 'Ancient'],
    // 550, the figure the other five were brought down TO on 2026-09-06. What still makes this
    // the run's lightest Guardian is the escorts (Act 1 fields Early spawn at 200) and a Beast
    // kit that has to set Bleed up with Claw before Maul pays out, rather than the spread damage
    // that was killing a hero per round (docs/run-loop.md).
    baseStats: { hp: 450, attack: 55, defense: 75, intelligence: 60, wisdom: 60, speed: 75, manaPool: 105, mpRegen: 20 },
    moveIds: ['claw', 'maul', 'enfeeble', 'archonBlast'],
    starter: false,
    growthGrades: CHAMPION_GRADES,
  },

  // The Blighted Shrine's Guardian reinforcement, and the Manticore's opposite number: the
  // same 550 total, a magical line where his is physical.
  //
  // EVERY champion is 550 as of 2026-09-06 (was 700 for these five). They are flat numbers meeting
  // a player who grows all run, so a champion authored for "Act 2 or later" is a wall in Act 2 and
  // a speed bump in Act 5 — measured, the Act 2 Guardian won 3-10% of the time against the Act 3
  // one's 30-67%. What separates one act's Guardian from another's is now the escorts beside it
  // (the act's tier of spawn, docs/run-loop.md "The Guardian's escorts") and the act curve on top.
  yugzulach: {
    id: 'yugzulach',
    name: 'Yugzulach',
    types: ['Shadow', 'Ancient'],
    baseStats: { hp: 330, attack: 70, defense: 85, intelligence: 85, wisdom: 75, speed: 70, manaPool: 140, mpRegen: 20 },
    moveIds: ['runicBlast', 'forgottenCurse', 'duskBlade', 'eclipse'],
    starter: false,
    growthGrades: CHAMPION_GRADES,
  },

  // The Forbidden Forest's Guardian reinforcement: the apex of the Renew engine. Overgrowth is
  // Renew 100 on itself, which is ~200 HP healed over the following rounds AND +100 Attack under
  // Verdant Earth AND the switch that turns Branch Slam's 80 base power into 160. Three payouts
  // off one turn is the most any single action in the game does, and Speed 30 — the slowest
  // champion by 20 — is the price: it sets up in front of you, in the open, while you hit it.
  //
  // It sits INSIDE its Location's types (Yugzulach's shape), so the answer that beat the act's
  // spawn still beats the boss. Renew 100 stacking on top of 205 HP is the figure in here most
  // likely to move in a balance pass — it is a first-pass number, not a decision.
  elderBough: {
    id: 'elderBough',
    name: 'Elder Bough',
    types: ['Nature', 'Ancient'],
    baseStats: { hp: 410, attack: 85, defense: 90, intelligence: 75, wisdom: 65, speed: 30, manaPool: 150, mpRegen: 20 },
    moveIds: ['runicBlast', 'overgrowth', 'branchSlam', 'forceOfNature'],
    starter: false,
    growthGrades: CHAMPION_GRADES,
  },

  // The Molten Foundry's Guardian reinforcement (the Lava Beast until 2026-09-16, renamed with its
  // figure — guardianFigures.ts draws a dragon). It lights its own Scorched Land and then feeds
  // a Burn stack that cannot fall off, 10 a cast on both heroes, while Immolate triples off the
  // stack it just built. Every move is cheap on a 150 pool, so it acts every round and never
  // Rests — a Guardian that grinds rather than one that lands one enormous turn.
  //
  // It deliberately does NOT carry Volcanic Surge, and that is a finding rather than a taste
  // call: the self-inflicted Burn 30 does not decay on the boss's own field either, so a
  // second cast puts 60 a round on a 210 HP body and the fight becomes "outlast its suicide".
  // Measured at 265 -> 190 in two rounds WITH the decay still on, before the 550 pass.
  //
  // Ancient is doing double duty: it is the champion silhouette the others share, and it is
  // why the Foundry is not solved by one type. Water is 2x on every Fire spawn and 1x on this,
  // so the answer that carried the act runs out at the Guardian.
  dragon: {
    id: 'dragon',
    name: 'Dragon',
    types: ['Fire', 'Ancient'],
    baseStats: { hp: 420, attack: 85, defense: 80, intelligence: 80, wisdom: 60, speed: 35, manaPool: 150, mpRegen: 20 },
    moveIds: ['runicBlast', 'spreadingBlaze', 'immolate', 'firebrand'],
    starter: false,
    growthGrades: CHAMPION_GRADES,
  },

  // The Necropolis's Guardian reinforcement, and the apex of both halves: it Haunts with
  // Poltergeist so the player's damage stops being aimed, and then Vengeance triples once it
  // drops under 25%. 155 HP is the LOWEST of the five champions on purpose — the window is
  // ~39 HP wide, roughly one player turn, and the whole fight is the question of whether that
  // turn kills it or hands it a 180-power swing. The stats that would have been HP are in
  // Attack and Intelligence instead.
  //
  // It does not carry Last Rites, for the reason the Dragon does not carry Volcanic
  // Surge: bp120 that drops the user to 1 HP is a self-destruct dressed as a finisher, and a
  // boss that ends itself makes turtling the answer. Vengeance is the opposite trade — it
  // punishes a sloppy finish instead of performing one.
  skeletonKing: {
    id: 'skeletonKing',
    name: 'Skeleton King',
    types: ['Spirit', 'Ancient'],
    baseStats: { hp: 310, attack: 85, defense: 90, intelligence: 90, wisdom: 80, speed: 50, manaPool: 150, mpRegen: 20 },
    moveIds: ['runicBlast', 'poltergeist', 'wailingFlight', 'vengeance'],
    starter: false,
    growthGrades: CHAMPION_GRADES,
  },

  // The Storm Coast's Guardian reinforcement (the Leviathan until 2026-09-16, renamed with its
  // figure — guardianFigures.ts draws a kraken, so the name says so). 550, matching every other champion.
  // Archon Blast is the Manticore's move because the Ancient slate is three moves
  // long and unauthored (CLAUDE.md "Repo map"); it should be revisited when Ancient lands.
  kraken: {
    id: 'kraken',
    name: 'Kraken',
    types: ['Water', 'Ancient'],
    baseStats: { hp: 350, attack: 75, defense: 80, intelligence: 95, wisdom: 80, speed: 45, manaPool: 150, mpRegen: 20 },
    moveIds: ['aquaSlice', 'maelstrom', 'archonBlast', 'tsunami'],
    starter: false,
    growthGrades: CHAMPION_GRADES,
  },

  // --- The Threshold — the Titan's Herald, what walks out when five seals are broken (docs/lore.md §7) ---
  // The finale's last combatant, and the only mono-Ancient thing in the game. It enters LAST,
  // after five unsealed champions, so it is authored as the fight's ending rather than its
  // whole — an enormous, slow, magical body for something that does not need to hurry. It is
  // the Titan's HERALD, not the Titan (2026-09-16, per user direction; the figure is a
  // standard-bearer, guardianFigures.ts).
  //
  // 900 combat stats against the champions' 700 — a step, not a different number class.
  // Magical-leaning (135 Int / 100 Atk) because the whole Ancient slate is magical, and
  // Speed 95 for one reason: the fastest authored hero is 90, so nothing outruns it, but
  // it is still a Speed number rather than an exemption and every priority bracket still
  // beats it.
  //
  // The kit is PROVISIONAL. Ancient is the one type slate still unauthored
  // (CLAUDE.md "Repo map", docs/authoring-moves.md), so this is the three existing Ancient
  // moves plus Enfeeble — which is the shape the real kit should keep: a Titan does not
  // need to hit harder, it makes everything else softer. Revisit when Ancient lands, and
  // watch Enfeeble specifically — stat mods have no ceiling, and two casts is -60/-60.
  endbringer: {
    id: 'endbringer',
    name: 'Endbringer',
    types: ['Ancient'],
    baseStats: { hp: 680, attack: 100, defense: 115, intelligence: 135, wisdom: 115, speed: 95, manaPool: 200, mpRegen: 25 },
    moveIds: ['runicBlast', 'forgottenCurse', 'archonBlast', 'enfeeble'],
    starter: false,
    growthGrades: CHAMPION_GRADES,
  },
};

/** Pointed at by `LocationDefinition.guardianFinalEnemyId`. */
export const MANTICORE_ID = 'manticore';
export const YUGZULACH_ID = 'yugzulach';
export const KRAKEN_ID = 'kraken';
export const ELDER_BOUGH_ID = 'elderBough';
export const DRAGON_ID = 'dragon';
export const SKELETON_KING_ID = 'skeletonKing';

/** The Threshold's, and the only mono-Ancient id in the game (docs/lore.md §7). */
export const ENDBRINGER_ID = 'endbringer';

/** Every Guardian champion, in no particular order — a run breaks five of these six. */
export const CHAMPION_IDS: readonly string[] = [
  MANTICORE_ID,
  YUGZULACH_ID,
  KRAKEN_ID,
  ELDER_BOUGH_ID,
  DRAGON_ID,
  SKELETON_KING_ID,
];

export function unsealedIdFor(championId: string): string {
  return `${championId}Unsealed`;
}

/**
 * docs/lore.md §6: a champion's Ancient half IS the seal, so the one that comes back for
 * the finale comes back without it. Derived rather than authored — six duplicated stat
 * lines would drift, and the only difference is the type that was taken off it.
 */
function unseal(champion: HeroDefinition): HeroDefinition {
  const [primary, secondary] = champion.types;
  // The Ancient-second convention is a rule, not a habit (docs/lore.md §8): a champion
  // without a seal to take off it is not part of the binding.
  if (secondary !== 'Ancient') throw new Error(`${champion.id} is not Ancient-second — it carries no seal to break`);
  return { ...champion, id: unsealedIdFor(champion.id), types: [primary] };
}

/** Keyed by `unsealedIdFor(championId)`. Folded into `allCombatants` (data/content.ts). */
export const unsealedChampions: HeroLookup = Object.fromEntries(
  CHAMPION_IDS.map((id) => [unsealedIdFor(id), unseal(enemies[id])])
);

/** Everything the finale can field, and nothing else — `generateFinaleEncounter`'s pool. */
export const finaleEnemies: HeroLookup = { ...unsealedChampions, [ENDBRINGER_ID]: enemies[ENDBRINGER_ID] };
