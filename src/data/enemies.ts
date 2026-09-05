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

  // --- Fae (Forbidden Forest) — authored for Act 2, scaled up from there ---
  // Every one is Nature-primary, the Cultists' shared-spine shape a third time. It is the
  // widest answer any faction has handed out: Fire, Frost, Shadow AND Beast all read 2x off
  // Nature, where the Cultists' Shadow gives up two types and the Raiders' Iron three. That
  // is deliberate — the Fae are the faction a player is most likely to meet already holding
  // the counter, and the engine below is what they get in exchange.
  //
  // The tell is Renew, and it runs one step further than the Raiders' Conduct. Conduct is a
  // mark that pays out on a hit; Renew is a buff that pays out three ways at once —
  //   1. it heals at the end of every round (the status),
  //   2. Seed Shot and Branch Slam deal DOUBLE damage while the user carries it,
  //   3. under Verdant Earth every combatant's Attack and Intelligence go up by their live
  //      Renew value — so the Light Fairy's Magic Growth is worth a whole turn the way the
  //      Stormraider's Ionize is.
  // The brake is that Renew halves at the end of every round, so the whole engine decays on
  // its own clock, and Verdant Earth is SYMMETRIC — a player side that brought its own Renew
  // gets the same stats out of the Fae's ground. Planting is the faction; keeping it planted
  // is what it spends its turns on.
  pixie: {
    id: 'pixie',
    name: 'Pixie',
    types: ['Nature'],
    baseStats: { hp: 85, attack: 25, defense: 55, intelligence: 85, wisdom: 65, speed: 85, manaPool: 55, mpRegen: 12 },
    moveIds: ['regrowth', 'seedShot', 'toxicSpores'],
    starter: false,
  },
  // The physical half, and the one that needs no payoff move of its own: under Verdant Earth
  // its Attack carries the whole line's Renew, so Leaf Slice and Heavy Blow scale off a buff
  // somebody else paid for. Mono-Nature would have made that a fair trade; the Iron makes it
  // a bruiser that survives long enough to collect.
  faeWarrior: {
    id: 'faeWarrior',
    name: 'Fae Warrior',
    types: ['Nature', 'Iron'],
    baseStats: { hp: 115, attack: 95, defense: 90, intelligence: 20, wisdom: 40, speed: 40, manaPool: 55, mpRegen: 12 },
    moveIds: ['ivySpike', 'leafSlice', 'heavyBlow'],
    starter: false,
  },
  // Sets the ground. Magic Growth is this faction's Ionize — a turn spent on the field rather
  // than the enemy, and the reason the tell shows up at a plain `fight` node and not only
  // behind the Queen. Mend is the second half of why the Fae are a slow fight: Renew heals at
  // the end of the round, this heals inside it.
  lightFairy: {
    id: 'lightFairy',
    name: 'Light Fairy',
    types: ['Nature', 'Light'],
    baseStats: { hp: 100, attack: 25, defense: 65, intelligence: 85, wisdom: 80, speed: 45, manaPool: 65, mpRegen: 12 },
    moveIds: ['magicGrowth', 'mend', 'glimmer'],
    starter: false,
  },
  // Carries Seed Shot, so it is the basic that cashes what the other two plant. Backfire
  // burning its own user is the joke and the cost at once: a Nature body taking 2x off Fire
  // is the worst thing on the field to be running a furnace inside.
  mechaFairy: {
    id: 'mechaFairy',
    name: 'Mecha Fairy',
    types: ['Nature', 'Mech'],
    baseStats: { hp: 95, attack: 30, defense: 70, intelligence: 90, wisdom: 55, speed: 60, manaPool: 60, mpRegen: 12 },
    moveIds: ['overclock', 'seedShot', 'backfire'],
    starter: false,
  },
  // Fields the "Monsters" battle node alongside 3 random basic Fae; never randomly drawn.
  // 500, the third leader at that figure, and spent like the Cult Mystic rather than the
  // Champion Raider — a caster, because what a Fae leader adds is more of the engine, not a
  // bigger swing. Wild Bloom is the escalation the basics cannot afford: Renew 50 on both,
  // which under her own Magic Growth is +50 Attack and +50 Intelligence to the whole side.
  pixieQueen: {
    id: 'pixieQueen',
    name: 'Pixie Queen',
    types: ['Nature', 'Arcane'],
    baseStats: { hp: 140, attack: 35, defense: 80, intelligence: 105, wisdom: 85, speed: 55, manaPool: 100, mpRegen: 16 },
    moveIds: ['magicGrowth', 'wildBloom', 'arcaneBlast', 'magicBolt'],
    starter: false,
  },
  // The Forbidden Forest's Guardian reinforcement, and the apex of the engine rather than a
  // bigger version of the Queen: Overgrowth is Renew 100 on itself, which is ~200 HP healed
  // over the following rounds AND +100 Attack under Verdant Earth AND the switch that turns
  // Branch Slam's 80 base power into 160. Three payouts off one turn is the most any single
  // action in the game does, and Speed 30 — the slowest champion by 20 — is the price: it
  // sets up in front of you, in the open, while you hit it.
  //
  // Unlike the Goblin Lord and the Leviathan it sits INSIDE its faction's spine (Yugzulach's
  // shape), so the Fire/Frost/Shadow/Beast answer that beat the basics still beats the boss.
  // Renew 100 stacking on top of 260 HP is the figure in here most likely to move in a
  // balance pass — it is a first-pass number, not a decision.
  elderBough: {
    id: 'elderBough',
    name: 'Elder Bough',
    types: ['Nature', 'Ancient'],
    baseStats: { hp: 260, attack: 105, defense: 110, intelligence: 105, wisdom: 90, speed: 30, manaPool: 150, mpRegen: 20 },
    moveIds: ['runicBlast', 'overgrowth', 'branchSlam', 'forceOfNature'],
    starter: false,
  },

  // --- Vulcans (Molten Foundry) — authored for Act 2, scaled up from there ---
  // The first faction since the Goblins with NO single type spine, and that is the point of
  // the name: they are the Foundry's inhabitants, not one species. Fire runs through four of
  // the six and Mech through the other two, so the roster reads as a place rather than a
  // cult or a warband. The open question §6 of docs/locations.md asks — should a faction be
  // counterable as a unit — gets its second answer here, and the answer is that a MIXED
  // faction can still be counterable as a unit, because the two halves happen to share an
  // answer: Water is 2x into Fire and 2x into Mech, so it is super-effective on all five of
  // the fightable roster. Tighter than the Cultists' Light/Spirit, not looser.
  //
  // What redeems it is where the exception sits. The ONE Vulcan Water does not beat is the
  // Lava Beast, whose Ancient half drags it back to 1x — so a squad that brought Water cuts
  // through the whole Foundry and then meets the Guardian with its answer gone. That is the
  // pattern worth keeping: not a faction with a hole in its counter, a faction whose BOSS is
  // the hole.
  //
  // The tell is Burn that does not go out. Spreading Blaze sets **Scorched Land**, whose
  // whole text is "Burn no longer decays", and Burn stacks ADDITIVELY — so every plant after
  // the first climbs a ladder that never comes back down, and Immolate triples off it. The
  // counterplay is authored into the status rather than into the kits: Burn `clearsOnSwitch`,
  // so a switch wipes the stack clean. Which means the engine sharpens exactly as the fight
  // grinds down, because the lock-in rule takes switching away at 2 KO'd heroes.
  //
  // The Mech half pays the same fire it deals: Overheat and Meltdown Burn their own user, and
  // under the Vulcans' own Scorched Land that self-Burn never decays either. They are cooking
  // themselves on their own ground, which is the Foundry in one sentence.
  flameSprite: {
    id: 'flameSprite',
    name: 'Flame Sprite',
    types: ['Fire'],
    baseStats: { hp: 80, attack: 20, defense: 50, intelligence: 90, wisdom: 60, speed: 100, manaPool: 65, mpRegen: 12 },
    moveIds: ['spreadingBlaze', 'immolate', 'ember'],
    starter: false,
  },
  // Sets the ground and cashes it on one body, the Pixie's shape. Fastest thing in the enemy
  // pool at 100, because a field effect planted after the round it was meant to pay for is a
  // wasted turn — and the 65 pool is sized to cast Spreading Blaze AND Immolate in one opening.
  //
  // Its Water half is the coverage the Fire spine does not have (2x into Fire, Stone and
  // Mech) and its sustain both — Siphon returns half of what it takes, on a side that spends
  // the fight burning itself. It does NOT dodge the faction's own answer: Water still reads
  // 2x here, because Water does not resist itself on this chart.
  steamSpirit: {
    id: 'steamSpirit',
    name: 'Steam Spirit',
    types: ['Fire', 'Water'],
    baseStats: { hp: 105, attack: 20, defense: 70, intelligence: 85, wisdom: 75, speed: 45, manaPool: 65, mpRegen: 12 },
    moveIds: ['setAlight', 'siphon', 'torrent'],
    starter: false,
  },
  // The physical plant. Molten Lash is the only Burn in the faction that runs off Attack, so
  // this is the one member that feeds the engine without being a caster — and the -10 Defense
  // rider is what makes a stacked Burn worth stacking further.
  emberLizard: {
    id: 'emberLizard',
    name: 'Ember Lizard',
    types: ['Fire', 'Beast'],
    baseStats: { hp: 115, attack: 100, defense: 80, intelligence: 20, wisdom: 35, speed: 50, manaPool: 55, mpRegen: 12 },
    moveIds: ['kindle', 'moltenLash', 'claw'],
    starter: false,
  },
  // The bridge between the two halves, and the member that pays for the faction's own engine.
  // Overheat Burns the target for 20 and the USER for 20, which under the Vulcans' own
  // Scorched Land never decays — 50 mana on a 60 pool, so it vents once and then clanks.
  // Malfunction is the Mech texture: a rider rolled from Burn / Poison / Conduct, one of
  // which this faction has no way at all to cash. Rolling it is a real cost, not a flourish.
  automaton: {
    id: 'automaton',
    name: 'Automaton',
    types: ['Mech'],
    baseStats: { hp: 110, attack: 30, defense: 90, intelligence: 85, wisdom: 45, speed: 40, manaPool: 60, mpRegen: 12 },
    moveIds: ['overclock', 'malfunction', 'overheat'],
    starter: false,
  },
  // Fields the "Monsters" battle node alongside 3 random basic Vulcans; never randomly drawn.
  // 500, the fourth leader at that figure, and spent like the Champion Raider — a physical
  // line, not a caster. It deliberately touches no Burn at all: the Foundry's leader is the
  // MACHINE answer to a fire faction, and what it contributes is Jury-Rig, which hands both
  // allies +20 on two rolled stats. Two of its four moves roll their own priority bracket on
  // top of that, so a Vulcadozer round is the one place in the game where nothing is known
  // before it resolves.
  vulcadozer: {
    id: 'vulcadozer',
    name: 'Vulcadozer',
    types: ['Mech'],
    baseStats: { hp: 165, attack: 110, defense: 100, intelligence: 25, wisdom: 45, speed: 55, manaPool: 100, mpRegen: 16 },
    moveIds: ['cogBop', 'cogSlam', 'whirlingBlades', 'juryRig'],
    starter: false,
  },
  // The Molten Foundry's Guardian reinforcement, and the apex of the engine rather than a
  // bigger Vulcadozer: it lights its own Scorched Land and then feeds a Burn stack that
  // cannot fall off, 10 a cast on both heroes, while Immolate triples off the stack it just
  // built. Every move is cheap on a 150 pool, so it acts every round and never Rests — a
  // Guardian that grinds rather than one that lands one enormous turn.
  //
  // It deliberately does NOT carry Volcanic Surge, and that is a finding rather than a taste
  // call: the self-inflicted Burn 30 does not decay on the boss's own field either, so a
  // second cast puts 60 a round on a 265 HP body and the fight becomes "outlast its suicide".
  // Measured at 265 -> 190 in two rounds WITH the decay still on. The self-cooking joke lives
  // on the Automaton, where 110 HP and a one-cast pool make it a cost instead of an exit.
  //
  // Ancient is doing double duty: it is the champion silhouette the other three share, and it
  // is the entire reason this faction is not solved by one type. Water is 2x on every other
  // Vulcan and 1x on this one, so the answer that carried the act runs out at the Guardian.
  lavaBeast: {
    id: 'lavaBeast',
    name: 'Lava Beast',
    types: ['Fire', 'Ancient'],
    baseStats: { hp: 265, attack: 110, defense: 95, intelligence: 115, wisdom: 75, speed: 40, manaPool: 150, mpRegen: 20 },
    moveIds: ['runicBlast', 'spreadingBlaze', 'immolate', 'firebrand'],
    starter: false,
  },

  // --- Undead (Necropolis) — authored for Act 2, scaled up from there ---
  // Spirit-primary on four of the six, the Cultists' shared-spine shape, and the tightest
  // answer any faction has: only Arcane and Mind read 2x off Spirit. The Dread Raven is
  // deliberately outside that spine — see its own note.
  //
  // The tell is HAUNT, and it is the first faction engine that changes WHO gets hit rather
  // than how hard. A Haunted hero takes every Spirit or Mind attack aimed at its PARTNER
  // (`spreadTriggerTypes`, statusEngine.ts) — which is most of this roster's damage — so one
  // Torment turns four single-target casts into eight hits. In a game whose locked invariants
  // include "no spread damage reduction", that is the largest multiplier a status can buy.
  //
  // The second half is what makes the first half a trap rather than a grind. Spite doubles
  // below 50% of the user's HP and Vengeance TRIPLES below 25%, so an Undead gets stronger
  // the closer it is to dead. The two interlock: Haunt spreads the player's incoming damage
  // across both enemies, which walks BOTH of them into Spite range together instead of
  // letting either be removed cleanly. Chipping the Necropolis arms it. The counterplay is
  // to burst one target through the spread, or to switch — Haunt `clearsOnSwitch`, and it is
  // the switch-out that clears it, not the switch-in.
  skullShambler: {
    id: 'skullShambler',
    name: 'Skull Shambler',
    types: ['Spirit'],
    baseStats: { hp: 70, attack: 25, defense: 60, intelligence: 90, wisdom: 65, speed: 90, manaPool: 55, mpRegen: 12 },
    moveIds: ['torment', 'spite', 'drain'],
    starter: false,
  },
  // Plants the mark and carries the low-HP payoff on one body, the Pixie's shape. 70 HP is
  // the lowest of any 400-band basic on purpose (an Act 1 Goblin is lower, and is fodder): it
  // is the one that reaches Spite's 50% window on the player's FIRST hit, so the engine's
  // second half shows up before the fight is decided.
  // Torment is unconditional and costs 25, which is the whole reason the mark is reliable.
  //
  // Skeletons in mail. Phantom Strike and Spooky Slice are physical SPIRIT, which is what
  // lets the faction's one bruiser spread through Haunt like the casters do — the Iron half
  // is its bulk and its coverage, not its job.
  skeletonKnight: {
    id: 'skeletonKnight',
    name: 'Skeleton Knight',
    types: ['Spirit', 'Iron'],
    baseStats: { hp: 110, attack: 100, defense: 95, intelligence: 20, wisdom: 35, speed: 40, manaPool: 55, mpRegen: 12 },
    moveIds: ['ironFist', 'phantomStrike', 'spookySlice'],
    starter: false,
  },
  // The attrition body, and the mirror of the Shambler: 145 HP — the bulkiest basic in the
  // game — and Speed 15, the slowest thing anywhere. It is built to still be standing when
  // its own payoff arms, and Vengeance at triple power below 25% is a 145 HP hero's reward
  // for having taken a long time to kill. Poison is what it does while it waits.
  shamblingHusk: {
    id: 'shamblingHusk',
    name: 'Shambling Husk',
    types: ['Spirit', 'Nature'],
    baseStats: { hp: 145, attack: 30, defense: 85, intelligence: 70, wisdom: 55, speed: 15, manaPool: 65, mpRegen: 12 },
    moveIds: ['toxicSpores', 'blight', 'vengeance'],
    starter: false,
  },
  // The reason Mind is in this faction at all: Haunt triggers off Spirit AND Mind, and this
  // is the only member that swings the second one. Two mark sources in one kit — Wisp at a
  // 20% roll for 20 mana, Wicked Fear unconditionally for 45 — so the Conjurer is the enemy
  // that has to die if the player wants the spread to stop.
  boneConjurer: {
    id: 'boneConjurer',
    name: 'Bone Conjurer',
    types: ['Spirit', 'Mind'],
    baseStats: { hp: 95, attack: 20, defense: 65, intelligence: 100, wisdom: 75, speed: 45, manaPool: 65, mpRegen: 12 },
    moveIds: ['wisp', 'psiBolt', 'wickedFear'],
    starter: false,
  },
  // Fields the "Monsters" battle node alongside 3 random basic Undead; never randomly drawn.
  // The first LEADER authored outside its faction's spine — Beast/Shadow against four Spirits
  // — and the consequence is exact and intended: Haunt does not trigger on Beast or Shadow,
  // so the Raven is the one Undead whose blows do not carry. It is the beatstick while the
  // basics do the spreading, and a `battle` node becomes a real fork: kill the Raven, which
  // is fast and hits hardest, or kill the Conjurer, which is what makes everything else hurt
  // twice.
  //
  // Rend is how it joins the engine anyway without a Spirit move: double damage against a
  // target under half HP, on a board where Haunt has just put BOTH heroes there at once.
  // 70 Defense on 140 HP is the softest leader in the game, which is the other half of the
  // fork — this one can actually be removed in the turns the player spends on it.
  dreadRaven: {
    id: 'dreadRaven',
    name: 'Dread Raven',
    types: ['Beast', 'Shadow'],
    baseStats: { hp: 140, attack: 110, defense: 70, intelligence: 25, wisdom: 60, speed: 95, manaPool: 100, mpRegen: 16 },
    moveIds: ['claw', 'rend', 'lacerate', 'shadowSlice'],
    starter: false,
  },
  // The Necropolis's Guardian reinforcement, and the apex of both halves: it Haunts with
  // Poltergeist so the player's damage stops being aimed, and then Vengeance triples once it
  // drops under 25%. 210 HP is the LOWEST of the five champions on purpose — the window is
  // ~52 HP wide, roughly one player turn, and the whole fight is the question of whether that
  // turn kills it or hands it a 180-power swing. The stats that would have been HP are in
  // Attack and Intelligence instead.
  //
  // It does not carry Last Rites, for the reason the Lava Beast does not carry Volcanic
  // Surge: bp120 that drops the user to 1 HP is a self-destruct dressed as a finisher, and a
  // boss that ends itself makes turtling the answer. Vengeance is the opposite trade — it
  // punishes a sloppy finish instead of performing one.
  skeletonKing: {
    id: 'skeletonKing',
    name: 'Skeleton King',
    types: ['Spirit', 'Ancient'],
    baseStats: { hp: 210, attack: 110, defense: 105, intelligence: 125, wisdom: 95, speed: 55, manaPool: 150, mpRegen: 20 },
    moveIds: ['runicBlast', 'poltergeist', 'wailingFlight', 'vengeance'],
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
  fae: {
    id: 'fae',
    name: 'Fae',
    baselineAct: 2,
    basicIds: ['pixie', 'faeWarrior', 'lightFairy', 'mechaFairy'],
    leaderId: 'pixieQueen',
  },
  vulcans: {
    id: 'vulcans',
    name: 'Vulcans',
    baselineAct: 2,
    basicIds: ['flameSprite', 'steamSpirit', 'emberLizard', 'automaton'],
    leaderId: 'vulcadozer',
  },
  undead: {
    id: 'undead',
    name: 'Undead',
    baselineAct: 2,
    basicIds: ['skullShambler', 'skeletonKnight', 'shamblingHusk', 'boneConjurer'],
    leaderId: 'dreadRaven',
  },
};

/**
 * Act 1's faction, and the fallback for a Location that ever ships without one. Every
 * Location has an authored roster as of 2026-09-05, so nothing falls back today — only
 * Wild's Edge names this, and it names it because Act 1 IS the Goblins
 * (docs/locations.md "The faction bill").
 */
export const DEFAULT_FACTION_ID = 'goblins';

/** Pointed at by `LocationDefinition.guardianFinalEnemyId`. */
export const GOBLIN_LORD_ID = 'goblinLord';
export const YUGZULACH_ID = 'yugzulach';
export const LEVIATHAN_ID = 'leviathan';
export const ELDER_BOUGH_ID = 'elderBough';
export const LAVA_BEAST_ID = 'lavaBeast';
export const SKELETON_KING_ID = 'skeletonKing';

/** `enemies` narrowed to one faction's basics, for the generators that must never draw its leader. */
export function basicEnemiesOf(faction: FactionRoster): HeroLookup {
  return Object.fromEntries(faction.basicIds.map((id) => [id, enemies[id]]));
}
