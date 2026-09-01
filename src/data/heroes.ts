// ⚠️ TEST FIXTURE CONTENT — heroes sufficient to run a 2v2 fight and exercise
// bring-6-pick-4 squad selection (src/run) through the engine. Not the
// authored 53-concept roster (docs/types-and-heroes.md); typings here are
// still arbitrary. The 14 STARTER stat lines are authored and tuned to a
// 450 base Stat Total budget (HP + manaPool + the five battle stats) as of 2026-08-28 — do not nudge one without rebalancing its budget.
// Recruit-only stat lines are still untuned.
//
// STARTING KITS ARE EXACTLY THREE MOVES, for every hero, with no exceptions
// (2026-08-26). A low-power move of the hero's main type plus two supports —
// heal/buff/status. Two reasons it's a rule rather than a habit:
//
//   1. The draft screen (src/view/run/DraftScreen.tsx) puts four candidates'
//      kits side by side and lets the player read each move before
//      committing; one hero carrying a fourth move makes that comparison
//      lopsided before the player has learned what any of the moves do.
//   2. MOVE_CAP is 4 (src/run/progression.ts), so a 3-move kit leaves exactly
//      one slot to grow into via level-up. A hero starting AT the cap could
//      never take a level-up move outright — every offer would arrive as a
//      replacement.
//
// The rest of each hero's thematic movepool lives in src/data/progression.ts'
// moveTiers, offered randomly on level-up. That includes the five Field
// Effect setters (docs/field-effects.md), which used to be granted here as a
// fourth starting move and are now level-up unlocks for the same starters.
//
// `starter` (docs/types-and-heroes.md "Starters vs. recruit-only heroes") is
// the single source of truth for the start-of-run draft pool
// (src/run/draft.ts) vs. the Guild Hall's recruit-only offer pool
// (src/data/recruitment.ts derives its offers from `starter: false` heroes
// here, so the two pools can never drift out of sync with each other).
//
// FILE ORDER: grouped by the hero's PRIMARY type, in src/data/typechart.ts'
// TYPES order — the same order CompendiumScreen renders, so reading this
// file and reading that screen agree (2026-08-26). Design happens per type,
// so a new hero goes in its type's section rather than at the end. Nothing
// reads this order: every consumer either sorts for itself or keys by id.
// Within a section, order is arbitrary — the Compendium's sort is stable, so
// whatever order a section is in here is the order it shows there.

import type { HeroDefinition } from '../engine/content';

export const heroes: Record<string, HeroDefinition> = {
  // --- Fire --------------------------------------------------------------
  cinderKnight: {
    id: 'cinderKnight',
    name: 'Cinder',
    types: ['Fire', 'Iron'],
    baseStats: { hp: 100, attack: 70, defense: 60, intelligence: 30, wisdom: 40, speed: 50, manaPool: 60, mpRegen: 10 },
    // Kindle in place of Mend Wounds, which the Spirit slate deleted
    // (moves.ts) — promoted out of this hero's own level-up pool, so
    // progression.ts drops it from there (a starting move in its own pool is
    // dead weight levelUpMovePool can never offer). Cinder keeps three moves
    // and loses healing outright; the designer call was to let the borrowers
    // lose the heal rather than repoint them onto Light's Mend a second time.
    // Sharpen in place of Fortify, which the authored Iron slate deleted
    // (moves.ts, 2026-08-30). Cinder is the one Fortify holder for which Iron
    // is an INNATE type, and it swings Atk 70 — so the slot goes from a cheap
    // defensive buff to the type's own +30 Attack rather than off-type filler.
    moveIds: ['singe', 'sharpen', 'kindle'],
    starter: false,
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson',
    types: ['Fire'],
    baseStats: { hp: 100, attack: 30, defense: 38, intelligence: 80, wisdom: 75, speed: 62, manaPool: 65, mpRegen: 10 },
    // Stoke the Flames in place of Mend Wounds (see Cinder above). Its own
    // type, its own pool, and the better support for an Intelligence 80 hero
    // than a borrowed heal was: Fire Force scales every Fire move Crimson owns
    // and reaches the partner too.
    moveIds: ['ember', 'weaken', 'stokeTheFlames'],
    starter: true,
  },
  brimstone: {
    id: 'brimstone',
    name: 'Brimstone',
    types: ['Fire', 'Shadow'],
    baseStats: { hp: 80, attack: 55, defense: 35, intelligence: 60, wisdom: 35, speed: 60, manaPool: 55, mpRegen: 10 },
    moveIds: ['ember', 'umbraBolt', 'weaken'],
    starter: false,
  },

  // --- Water -------------------------------------------------------------
  tidecaller: {
    id: 'tidecaller',
    name: 'Riptide',
    types: ['Water'],
    baseStats: { hp: 110, attack: 55, defense: 55, intelligence: 59, wisdom: 40, speed: 66, manaPool: 65, mpRegen: 10 },
    // Water's authored pool (src/data/moves.ts, 2026-08-30). Splash is the
    // magical opener (Int 59 > Atk 55), and both supports are now Water rather
    // than borrowed Nature/Shadow — Riptide is the only Water STARTER, so its
    // three moves are what a player learns the type from.
    moveIds: ['splash', 'tideGuard', 'refresh'],
    starter: true,
  },
  pincer: {
    id: 'pincer',
    name: 'Pincer',
    types: ['Water'],
    // Mana raised from 40 when Water's authored movepool landed: the cheapest
    // Water move is now 15 and its cheapest physical attack 25, against a
    // 7-mana Aqua Jet before — at the old pool Pincer opened with Undertow and
    // then had nothing legal for two rounds. Same fix (and same reason) as
    // Torch Goblin's when Fire landed; stat line otherwise untouched, and 430
    // is still inside the 450 budget the tuned starters use.
    baseStats: { hp: 125, attack: 70, defense: 85, intelligence: 20, wisdom: 45, speed: 30, manaPool: 55, mpRegen: 10 },
    // The physical read of the same pool (Atk 70 / Int 20): Undertow rather
    // than Splash, and Tide Guard on the hero with 85 Defense already, whose
    // job is to make the OTHER slot survivable too.
    // Opening Strike in place of Stunning Blow, which the Iron slate deleted
    // (moves.ts, 2026-08-30) — the same off-type physical slot at the same 20
    // mana, trading a guaranteed Daze for a Defense debuff that Rend Armor in
    // its pool then escalates.
    moveIds: ['undertow', 'tideGuard', 'openingStrike'],
    starter: false,
  },

  // --- Frost -------------------------------------------------------------
  glacialWarden: {
    id: 'glacialWarden',
    name: 'Flurry',
    types: ['Frost'],
    baseStats: { hp: 140, attack: 30, defense: 55, intelligence: 70, wisdom: 60, speed: 45, manaPool: 70, mpRegen: 10 },
    moveIds: ['rimeWind', 'frostArmor', 'deepChill'],
    starter: false,
  },
  rime: {
    id: 'rime',
    name: 'Rime',
    types: ['Frost'],
    baseStats: { hp: 110, attack: 65, defense: 55, intelligence: 65, wisdom: 53, speed: 42, manaPool: 60, mpRegen: 10 },
    moveIds: ['iceShard', 'deepChill', 'secondWind'],
    starter: true,
  },
  cube: {
    id: 'cube',
    name: 'Cube',
    types: ['Frost'],
    baseStats: { hp: 90, attack: 50, defense: 80, intelligence: 40, wisdom: 50, speed: 25, manaPool: 45, mpRegen: 10 },
    // Pin Down in place of Fortify (moves.ts, 2026-08-30). Iron's cheapest
    // row at 15, which is what a 45 pool wants, and its -10 Speed is worth
    // more to a Speed-25 hero than to anyone else on the field.
    moveIds: ['iceShard', 'frostArmor', 'pinDown'],
    starter: false,
  },

  // --- Storm -------------------------------------------------------------
  stormRanger: {
    id: 'stormRanger',
    name: 'Squall',
    types: ['Storm'],
    baseStats: { hp: 90, attack: 65, defense: 40, intelligence: 35, wisdom: 35, speed: 90, manaPool: 50, mpRegen: 10 },
    moveIds: ['thunderclap', 'risingStatic', 'rally'],
    starter: false,
  },
  tempest: {
    id: 'tempest',
    name: 'Tempest',
    types: ['Storm'],
    baseStats: { hp: 90, attack: 70, defense: 45, intelligence: 70, wisdom: 35, speed: 65, manaPool: 75, mpRegen: 10 },
    moveIds: ['jolt', 'charge', 'rally'],
    starter: true,
  },
  scallywag: {
    id: 'scallywag',
    name: 'Scallywag',
    types: ['Storm'],
    baseStats: { hp: 95, attack: 75, defense: 40, intelligence: 30, wisdom: 35, speed: 80, manaPool: 50, mpRegen: 10 },
    // Swift Blow in place of Quick Jab (moves.ts, 2026-08-30). Iron Fist stood
    // in for a day while the slate had no priority row at all; Swift Blow is
    // the actual successor — same bracket, 4 mana -> 15, 30 base power -> 15 —
    // and it is what a Speed-80 Attack-75 hero wants beside a 25-mana
    // Thunderclap.
    moveIds: ['thunderclap', 'swiftBlow', 'rally'],
    starter: false,
  },

  // --- Stone -------------------------------------------------------------
  crag: {
    id: 'crag',
    name: 'Crag',
    types: ['Stone'],
    baseStats: { hp: 140, attack: 90, defense: 75, intelligence: 20, wisdom: 35, speed: 40, manaPool: 50, mpRegen: 10 },
    moveIds: ['rockToss', 'toughenUp', 'secondWind'],
    starter: true,
  },
  sentinel: {
    id: 'sentinel',
    name: 'Sentinel',
    types: ['Stone'],
    baseStats: { hp: 150, attack: 45, defense: 100, intelligence: 15, wisdom: 50, speed: 15, manaPool: 30, mpRegen: 10 },
    // Fortify, re-authored by the designer the same day the Iron slate
    // deleted it (moves.ts, 2026-08-30) at 15 mana for +15 Defense. Sentinel
    // is the game's Defense-100 wall behind a Provoke that pulls every
    // single-target hit onto it, so this is the hero the buff exists for —
    // and 15/25/15 still opens on the tightest pool in the roster.
    moveIds: ['mudBall', 'provoke', 'fortify'],
    starter: false,
  },

  // --- Nature ------------------------------------------------------------
  // Re-kitted for the authored Nature slate (src/data/moves.ts, 2026-08-30),
  // split by the stat each hero actually attacks with: Sylva (Int 60 / Atk 45)
  // takes the magical line, Mordrax and Hollowbark (Atk 70, Int 35 and 20) the
  // physical one. Every kit is a Nature attack plus two supports, and every kit
  // carries a Renew source — that is not decoration, it is the type's damage
  // condition (moves.ts Seed Shot, Branch Slam).
  wildOracle: {
    id: 'wildOracle',
    name: 'Sylva',
    types: ['Nature'],
    baseStats: { hp: 80, attack: 45, defense: 60, intelligence: 60, wisdom: 60, speed: 65, manaPool: 80, mpRegen: 10 },
    // The whole type in three moves: Regrowth turns Seed Shot from a 30 BP poke
    // into a 60 BP one, and Toxic Spores starts the timer the pool's Mid/Late
    // half exists to cash in. 65 of an 80 pool, so the opening round is a real
    // choice between two of the three rather than a script.
    moveIds: ['seedShot', 'regrowth', 'toxicSpores'],
    starter: true,
  },
  mordax: {
    id: 'mordax',
    name: 'Mordrax',
    types: ['Nature'],
    baseStats: { hp: 105, attack: 70, defense: 55, intelligence: 35, wisdom: 45, speed: 50, manaPool: 50, mpRegen: 10 },
    moveIds: ['vineLash', 'regrowth', 'rally'],
    starter: false,
  },
  hollowbark: {
    id: 'hollowbark',
    name: 'Hollowbark',
    types: ['Nature'],
    baseStats: { hp: 135, attack: 70, defense: 80, intelligence: 20, wisdom: 45, speed: 30, manaPool: 40, mpRegen: 10 },
    // Ivy Spike at 15 is the cheapest move in the slate, which is what a 40
    // pool wants; Second Wind is its Renew (Spirit, so no STAB) and therefore
    // its route into Branch Slam later.
    // Fortify back, re-authored at 15 for +15 Defense (moves.ts, 2026-08-30).
    // Same price as the Pin Down that stood in for it, and the right one for
    // the 135 HP / 80 Defense wall of the Nature three.
    moveIds: ['ivySpike', 'fortify', 'secondWind'],
    starter: false,
  },

  // --- Light -------------------------------------------------------------
  dawnwarden: {
    id: 'dawnwarden',
    name: 'Solace',
    types: ['Light'],
    baseStats: { hp: 110, attack: 29, defense: 50, intelligence: 60, wisdom: 70, speed: 61, manaPool: 70, mpRegen: 10 },
    moveIds: ['glimmer', 'mend', 'purify'],
    starter: true,
  },
  aegis: {
    id: 'aegis',
    name: 'Aegis',
    types: ['Light'],
    baseStats: { hp: 120, attack: 45, defense: 80, intelligence: 40, wisdom: 75, speed: 35, manaPool: 70, mpRegen: 10 },
    // Mend in place of Fortify (moves.ts, 2026-08-30), promoted out of Aegis's
    // own level-up pool below. Iron has no cheap defensive buff left to point
    // at, so this is the one of the nine Fortify holders repointed onto its
    // OWN type instead: Wisdom 75 is what Mend scales off, and a 70 pool is
    // the only one of the nine that can carry a 25-mana heal beside a 30-mana
    // Renew.
    moveIds: ['holyStrike', 'mend', 'secondWind'],
    starter: false,
  },

  // --- Shadow ------------------------------------------------------------
  shadowMonk: {
    id: 'shadowMonk',
    name: 'Vesper',
    types: ['Shadow'],
    baseStats: { hp: 85, attack: 75, defense: 45, intelligence: 40, wisdom: 40, speed: 70, manaPool: 45, mpRegen: 10 },
    // The crit/Stealth line. Had no damage move at all before the slate landed
    // — a mono-Shadow hero whose whole kit was two off-type supports.
    moveIds: ['fadeStrike', 'vanish', 'secondWind'],
    starter: false,
  },
  // Marrow and Vesper were stat-for-stat identical until 2026-08-30, which the
  // Shadow slate surfaced and the designer resolved by making Marrow the type's
  // INTELLIGENCE user. They are now deliberate MIRRORS rather than duplicates:
  // the same frame (85 HP / 45 Def / 40 Wis / 70 Speed, stat total 355 on both)
  // driving opposite pipelines. Attack and Intelligence are swapped, and the
  // only other change is mana — Vesper's 45 covers a physical line that starts
  // at 15, where Marrow's magical one does not really open until Umbral Beam at
  // 40, so 65 is what makes the kit castable rather than a buff.
  //
  // Shadow now has both halves twice over: Vesper/Nightshade physical, and
  // Marrow/Lucius magical — with Marrow the mono-Shadow one and Lucius the
  // Shadow/Mind controller.
  marrow: {
    id: 'marrow',
    name: 'Marrow',
    types: ['Shadow'],
    baseStats: { hp: 85, attack: 40, defense: 45, intelligence: 75, wisdom: 40, speed: 70, manaPool: 65, mpRegen: 10 },
    // The Poison/attrition line: the cheap magical opener, the debuff that
    // softens for it, and the game's only cleanse.
    moveIds: ['umbraBolt', 'weaken', 'purify'],
    starter: false,
  },
  lucius: {
    id: 'lucius',
    name: 'Lucius',
    types: ['Shadow', 'Mind'],
    baseStats: { hp: 100, attack: 35, defense: 40, intelligence: 75, wisdom: 55, speed: 65, manaPool: 70, mpRegen: 10 },
    // Wicked Fear in place of spectralBind, which the Spirit slate deleted
    // (moves.ts). Its own type rather than a borrowed one, and the exact
    // upgrade progression.ts already named as spectralBind's successor: same
    // Haunt, 50 base power attached, 45 mana against 12. Promoted out of its
    // own pool, so progression.ts drops it from there.
    //
    // Worth keeping in the kit rather than swapping the role out: Lucius is
    // Shadow/MIND, and Mind is Haunt's other spreadTriggerTypes member
    // (statuses.ts) — every single-target Mind move it owns cashes this mark
    // in. 20 + 25 + 45 all sit inside a 70 pool.
    moveIds: ['umbraBolt', 'enervate', 'wickedFear'],
    starter: false,
  },
  nightshade: {
    id: 'nightshade',
    name: 'Nightshade',
    types: ['Shadow'],
    baseStats: { hp: 90, attack: 80, defense: 30, intelligence: 65, wisdom: 40, speed: 85, manaPool: 60, mpRegen: 10 },
    moveIds: ['backstab', 'vanish', 'weaken'],
    starter: true,
  },

  // --- Arcane ------------------------------------------------------------
  // Both Arcane heroes are Intelligence casters on near-identical frames
  // (365 vs 360 across the six non-mana stats), so the authored slate
  // (2026-08-30) splits them by ROLE rather than by pipeline: Glyph is the
  // glass artillery (Int 90 / Wis 80 / Def 32 / HP 80) and Zenith is the
  // battery (HP 95 / Def 45 / the biggest mana pool in the roster, and the
  // slowest of the two). Neither has an Attack stat worth speaking of, which
  // is why Arcane Overflow's Attack half is aimed at a PARTNER — see
  // src/data/moves.ts.
  runescribe: {
    id: 'runescribe',
    name: 'Glyph',
    types: ['Arcane'],
    baseStats: { hp: 80, attack: 25, defense: 32, intelligence: 90, wisdom: 80, speed: 58, manaPool: 85, mpRegen: 10 },
    // The artillery opener: a real attack, the Intelligence stack that scales
    // it, and Infuse so a mono-Arcane draft still has one hand on the battery.
    moveIds: ['magicBolt', 'focus', 'infuse'],
    starter: true,
  },
  zenith: {
    id: 'zenith',
    name: 'Zenith',
    types: ['Arcane'],
    baseStats: { hp: 95, attack: 20, defense: 45, intelligence: 85, wisdom: 65, speed: 50, manaPool: 90, mpRegen: 10 },
    // The battery's kit is deliberately the cheap end of the slate: Mana Tap
    // costs 0, which is what lets a hero whose whole plan is giving its pool
    // away still act on the turn after it has given everything.
    moveIds: ['manaTap', 'infuse', 'empower'],
    starter: false,
  },

  // --- Mind --------------------------------------------------------------
  // Cortex is the type's only STARTER and its bulk/tempo half: HP 100 and
  // Speed 67 against Lucius's Int 75. Its Intelligence and Wisdom are BOTH 55,
  // which would normally make it a weak caster — and the authored slate is
  // what rescues that, because Mind Shatter swings WISDOM in place of
  // Intelligence (moves.ts offStatOverride). Cortex is the hero that move
  // exists for: Brain Ward and Mental Fortress read as defensive buffs and are
  // also its damage ramp. See docs/authoring-moves.md for the roster question
  // its 53 Attack still raises.
  mindweaver: {
    id: 'mindweaver',
    name: 'Cortex',
    types: ['Mind'],
    baseStats: { hp: 100, attack: 53, defense: 45, intelligence: 55, wisdom: 55, speed: 67, manaPool: 75, mpRegen: 10 },
    // The opener, the Wisdom stack that scales Mind Shatter later, and the
    // slate's only heal. Floor 15, so a 75 pool acts every round from level 1.
    moveIds: ['psiBolt', 'brainWard', 'dopamine'],
    starter: true,
  },
  // Trance (2026-08-30) is Mind's DEBUFF engine, and it exists because the
  // type had authored one and staffed it with nobody. Mind's slate carries
  // five rows that take stats AWAY (Lull, Enervate, Disorient, Break Will,
  // and Brain Flay, which doubles whatever the other four left behind) —
  // and all three Mind heroes before this one ramp their OWN side instead:
  // Cortex is built around Brain Ward and Mental Fortress raising its
  // Wisdom until Mind Shatter swings it, Lucius is the Shadow attrition
  // line, Coil is Beast's enabler. Nobody was the hero the strip line was
  // written for.
  //
  // Mono Mind on purpose (designer call, 2026-08-30). Two things follow
  // from it that a dual could not have: it is a valid terminal identity
  // rather than a larval one (CLAUDE.md), and it is the only one of the
  // four Mind heroes still eligible for a type-graft Evolution — the other
  // three are dual-typed and chooseEvolutionPath refuses a graft to those.
  trance: {
    id: 'trance',
    name: 'Trance',
    types: ['Mind'],
    baseStats: { hp: 95, attack: 25, defense: 50, intelligence: 60, wisdom: 55, speed: 55, manaPool: 80, mpRegen: 10 },
    // The stat line is shaped by a fact about debuffs rather than about
    // damage: a flat stat delta is the same size whoever casts it
    // (CLAUDE.md, stat mods are flat additive integers), so Trance's own
    // offense is nearly irrelevant to its job. What it needs is to still be
    // standing on round four with mana left. Hence 95 HP behind Defense 50
    // at Attack 25, and an 80 pool — the strip chain costs 25 + 50 + 70 + 80
    // and this is the hero that has to pay it. 80 ties Revenant rather than
    // approaching the roster's 90 ceiling.
    //
    // Wisdom is deliberately 55 and NOT higher, which is the one number here
    // that is a roster decision rather than a hero one. Mind Shatter swings
    // WISDOM in place of Intelligence (moves.ts offStatOverride) and it is
    // the move that rescues Cortex's flat 55/55 — so a second mono-Mind hero
    // with more Wisdom than Cortex would quietly take Cortex's signature
    // away. Ties, does not pass. (Mind Shatter is also kept out of the pool
    // below, for the same reason and belt-and-braces.)
    //
    // THE KIT is the rule exactly — a low-power main-type move plus two
    // supports — and the two supports are both strips, which is the whole
    // pitch stated on turn one: Enervate takes 30 Wisdom, Lull takes 20
    // Intelligence, and every magical hit either hero throws afterwards is
    // worth more for it. In a doubles game the PARTNER is the main
    // beneficiary, which is what keeps Attack 25 from being a trap.
    moveIds: ['psiBolt', 'enervate', 'lull'],
    starter: false,
  },

  // --- Spirit ------------------------------------------------------------
  revenant: {
    id: 'revenant',
    name: 'Revenant',
    types: ['Spirit'],
    baseStats: { hp: 80, attack: 56, defense: 47, intelligence: 77, wisdom: 46, speed: 64, manaPool: 80, mpRegen: 10 },
    // The magical opener its Intelligence 77 actually wants, plus the type's
    // two self-supports. Wisp over Torment because a level-1 kit needs damage
    // in it (docs/authoring-moves.md §7), and Wisp is the row that plants
    // Haunt AND hits; Unbound at 15 is the cheap turn it can always afford on
    // an 80 pool once Second Wind went 15 -> 30. Soul Rend, its old opener,
    // went 11 -> 50 with the slate and is now a pool pick.
    moveIds: ['wisp', 'secondWind', 'unbound'],
    starter: true,
  },
  sorrow: {
    id: 'sorrow',
    name: 'Sorrow',
    types: ['Spirit'],
    baseStats: { hp: 75, attack: 80, defense: 38, intelligence: 45, wisdom: 50, speed: 90, manaPool: 62, mpRegen: 10 },
    // Spirit's SECOND hero, and the answer to the finding its own slate filed
    // against itself (docs/authoring-moves.md §10, Spirit #2): the type
    // authored three PHYSICAL moves into a roster of one Int-77 caster, so
    // Phantom Strike, Spooky Slice and Wailing Flight sat in the orphan list
    // in test/stoneMoves.test.ts with nowhere to go. Sorrow is where they go.
    //
    // A deliberate MIRROR of Revenant rather than a second copy of it — the
    // Vesper/Marrow arrangement one type over: same type, same fragility,
    // opposite pipelines. Attack 80 against Revenant's Intelligence 77, and
    // the rest of the frame is spent on the difference rather than copied:
    //
    //   - SPEED 90 over Revenant's 64 — tied with Squall and Widow for the
    //     roster's fastest — because the art is a thing that dives and is
    //     gone before the wail lands. It is also what pays for
    //     Defense 38 — the lowest here — since a body that never trades twice
    //     does not need to survive being hit twice.
    //   - MANA 62 against Revenant's 80, and the 18 it gives up is the reason
    //     it can afford Speed 90. Revenant's magical line runs to Banish (80)
    //     and Last Rites (100); Sorrow's physical line tops out at Wailing
    //     Flight (65), so 80 would be a pool it could never spend. Marrow's
    //     65-vs-Vesper's-45 reasoning, run in the other direction.
    //
    // Stat total 440 — recruit-only, so outside the 450 STARTER budget by
    // convention (see the header), and in band with the other recruit-only
    // lines (Lucius 440, Marrow 420).
    //
    // THE KIT is the rule exactly — a low-power main-type move plus two
    // supports — and unusually all three are the hero's OWN type. Phantom
    // Strike is the physical opener no other hero in the game can hold;
    // Torment is the setup that makes it, and everything after it, hit TWICE
    // (Haunt lists Spirit in spreadTriggerTypes, statuses.ts), which is the
    // whole pitch stated on turn one. Torment over Wisp deliberately, the
    // reverse of Revenant's call: Wisp is a 20% roll on a MAGICAL body, worth
    // little to Attack 80, where Torment's guarantee is worth the blank turn
    // precisely because Sorrow's follow-up is the biggest single-target
    // physical hit the type has.
    //
    // Second Wind is the one move shared with Revenant's kit, and knowingly:
    // deleting Mend Wounds left it as Spirit's ONLY self-sustain, and a
    // 75/38 body wants it at least as much as a 80/47 one. 25 + 25 + 30 all
    // sit inside a 62 pool.
    moveIds: ['phantomStrike', 'torment', 'secondWind'],
    starter: false,
  },

  // --- Iron --------------------------------------------------------------
  ironWarden: {
    id: 'ironWarden',
    name: 'Warden',
    types: ['Iron'],
    baseStats: { hp: 135, attack: 55, defense: 90, intelligence: 20, wisdom: 50, speed: 30, manaPool: 40, mpRegen: 10 },
    // Iron authored (moves.ts, 2026-08-30), then re-kitted the same day when
    // the designer answered both of the slate's reported gaps. This is
    // Warden's ORIGINAL kit re-authored rather than replaced: Quick Jab ->
    // Swift Blow (still bracket 1, 4 mana -> 15) and Fortify -> Fortify (10
    // for +10 Def/+10 Wis -> 15 for +15 Def), with Opening Strike in the slot
    // Stunning Blow held.
    //
    // It is also the hero the priority row is FOR. Warden is Speed 30 behind
    // Defense 90, so bracket 1 is the only way it ever acts first, and Swift
    // Blow's real payload on a marked target is the Conduct detonation it
    // delivers before the target moves. Pin Down and Second Wind drop to its
    // pool and to the other walls respectively.
    moveIds: ['swiftBlow', 'openingStrike', 'fortify'],
    starter: false,
  },
  valor: {
    id: 'valor',
    name: 'Valor',
    types: ['Iron'],
    baseStats: { hp: 120, attack: 60, defense: 65, intelligence: 40, wisdom: 45, speed: 60, manaPool: 60, mpRegen: 10 },
    // Rally in place of Mend Wounds (see Cinder above), promoted out of its
    // own pool. Iron authors no support of its own beyond Fortify, and Gallant
    // already carries Rally, so the off-type slot stays off-type — it just
    // stops being a heal.
    // Iron authored (moves.ts, 2026-08-30). Valor is the type's only STARTER
    // and the balanced frame (Atk 60 / Spd 60 / 60 pool), so it opens on the
    // ramp: Iron Fist grows +5 a swing and Sharpen buys +30 outright, both
    // permanent for the fight (stat mods persist through a switch). Rally
    // stays the off-type slot it has been since Mend Wounds died.
    moveIds: ['ironFist', 'sharpen', 'rally'],
    starter: true,
  },
  gallant: {
    id: 'gallant',
    name: 'Gallant',
    types: ['Iron'],
    baseStats: { hp: 110, attack: 80, defense: 55, intelligence: 20, wisdom: 35, speed: 70, manaPool: 45, mpRegen: 10 },
    // Iron authored (moves.ts, 2026-08-30). Gallant is Atk 80 / Spd 70 / Def
    // 55 — the glass half of the type — so it keeps its old two-attacks-plus-
    // Rally shape and takes the burst pair: Heavy Blow's 30% crit and Opening
    // Strike to set up the Onslaught in its pool.
    moveIds: ['heavyBlow', 'openingStrike', 'rally'],
    starter: false,
  },

  // --- Mech --------------------------------------------------------------
  forgewright: {
    id: 'forgewright',
    name: 'Clockwork',
    types: ['Mech'],
    baseStats: { hp: 130, attack: 60, defense: 70, intelligence: 45, wisdom: 40, speed: 55, manaPool: 50, mpRegen: 10 },
    // A full Mech kit now that the type is authored — Fortify comes back off
    // (it had been the third slot for exactly one commit), because Clockwork
    // is MONO Mech and every off-type slot is a slot with no STAB on it.
    //
    // The §7 shape: one low-power main-type attack plus two supports. Piston
    // Punch is the attack, picked for the Attack 60 over the Intelligence 45,
    // and it doubles as the ramp — every swing rolls another +5 somewhere.
    // Overclock and Kickstart are the supports, and between them they are the
    // whole reason to field this hero next to a bruiser.
    //
    // What it LOSES in the trade is a guaranteed defensive buff for a random
    // one: Fortify was +15 Defense on demand, Overclock is +20 to a stat that
    // is Defense one time in five. That is the type working as designed, and
    // it is reported in docs/authoring-moves.md §10 rather than patched around.
    //
    // 20/15/20 against a 50 pool — every move castable from turn one.
    moveIds: ['pistonPunch', 'overclock', 'kickstart'],
    starter: true,
  },
  steamColossus: {
    id: 'steamColossus',
    name: 'Bellows',
    types: ['Mech', 'Iron'],
    baseStats: { hp: 145, attack: 90, defense: 80, intelligence: 15, wisdom: 35, speed: 15, manaPool: 40, mpRegen: 10 },
    // Mech/IRON, so both halves of the kit get STAB and the Iron ramp stays:
    // Iron Fist to open, Sharpen to turn the 90 into 120.
    //
    // Cog Bop is the Mech slot, and it is on this hero rather than on
    // Clockwork for one reason — Speed 15 is the lowest in the roster, so a
    // bracket Bellows can only reach by coin flip is worth more here than
    // anywhere else in the game. Half the time it is the slowest hero on the
    // field moving first.
    //
    // 20/20/25 against a 40 pool — the cheapest kit is affordable, which is
    // the one thing a player cannot fix by drafting.
    moveIds: ['cogBop', 'ironFist', 'sharpen'],
    starter: false,
  },

  // --- Beast -------------------------------------------------------------
  packAlpha: {
    id: 'packAlpha',
    name: 'Fang',
    types: ['Beast'],
    baseStats: { hp: 100, attack: 90, defense: 55, intelligence: 20, wisdom: 50, speed: 80, manaPool: 55, mpRegen: 10 },
    // Beast authored (moves.ts, 2026-08-30), and Fang is the type's ONLY
    // hero — Spirit's Revenant situation exactly, so there is no second line
    // to split the slate into and this kit is chosen against the pool rather
    // than against a sibling.
    //
    // Two 20-mana attacks that plant the type's two clocks (Claw's 20% Bleed,
    // Venom Bite's guaranteed Poison) plus the side-wide buff, which is 65 of
    // a 55 pool — so the opening round is a real choice between two of the
    // three rather than a script. Both DoTs survive a switch, which is what
    // makes chipping on turn one worth an 80-mana Eviscerate on turn five.
    //
    // Prowl (15) is deliberately NOT here despite being the cheapest row in
    // the slate: its whole point is the doubling beside a Beast partner, and
    // Fang cannot have one at level 1 (see progression.ts and
    // docs/authoring-moves.md §10). Undoubled it is a worse Rally, so it
    // belongs one pick later rather than in the opening kit.
    moveIds: ['claw', 'venomBite', 'rally'],
    starter: true,
  },
  // Widow and Coil (2026-08-30) are the ROSTER answer to the Beast slate's
  // second hand-off finding (docs/authoring-moves.md §10): three of Beast's
  // fifteen rows read the caster's ACTIVE PARTNER's type, and with Fang the
  // only native Beast hero — and two Fangs illegal on one roster — Prowl's
  // doubling, Pack Hunt's doubling and Pack Leader's half price were all
  // unreachable except through a type-graft Evolution on one of three
  // specific heroes. That finding listed three answers and fixed none; this
  // is the first of them ("a second Beast hero"), taken twice.
  //
  // Both are `starter: false`, which keeps the roster's one-starter-per-type
  // shape intact (docs/types-and-heroes.md "Starters vs. recruit-only
  // heroes" — Fang stays Beast's draft slot). So the pack condition is still
  // not a draft-time choice; it is now a Guild Hall / Recruit Contract one,
  // which is a strictly earlier and less conditional door than the
  // Evolution it had before.
  //
  // They split Beast the way the type could not split itself: Widow takes
  // the physical half a fourteen-of-fifteen-physical slate is built for,
  // Coil the magical row it has exactly one of.
  widow: {
    id: 'widow',
    name: 'Widow',
    types: ['Beast', 'Shadow'],
    baseStats: { hp: 75, attack: 85, defense: 35, intelligence: 25, wisdom: 40, speed: 90, manaPool: 50, mpRegen: 10 },
    // Beast/Shadow is the roster's most fragile pairing on the current chart
    // — five 2x weaknesses (Frost, Storm and Mech through Beast; Light and
    // Spirit through Shadow), against Shadow's own 0.5x into Beast doing
    // nothing for it. That is the price of the line: Attack 85 at Speed 90
    // on 75 HP. It TIES Squall for fastest in the roster rather than passing
    // it, deliberately — this is an untuned recruit-only line and raising
    // the ceiling should be a decision, not a side effect.
    //
    // Widow is where Beast's Bleed and Shadow's Stealth are innate at once.
    // The two types already overlap on Bleed (Backstab, Shadow Slice, Dusk
    // Blade), so both the mark it plants and the payoffs it grows into
    // (Maul, Eviscerate) carry STAB — which no hero could do before.
    //
    // THE KIT is the rule exactly (a low-power main-type move plus two
    // supports), and Prowl is the interesting slot. Fang deliberately does
    // NOT start with Prowl because Fang cannot have a Beast partner at level
    // 1; Widow can, because a RECRUITED hero arrives into a roster that may
    // already hold one. Same move, opposite verdict, for the same reason.
    // Venom Bite over Claw because guaranteed beats 20% on a hero that plans
    // to be somewhere else next round, and Vanish is the Shadow half plus
    // the setup for the Ambush its pool leads to.
    moveIds: ['venomBite', 'vanish', 'prowl'],
    starter: false,
  },
  coil: {
    id: 'coil',
    name: 'Coil',
    types: ['Beast', 'Mind'],
    baseStats: { hp: 85, attack: 30, defense: 45, intelligence: 75, wisdom: 60, speed: 60, manaPool: 65, mpRegen: 10 },
    // The first Beast hero that is not an Attack stat, and that is the whole
    // point. The Beast slate's FIFTH hand-off finding was that Animal Spirit,
    // its one magical row, was "homeless by construction — every Beast hero
    // is Intelligence 20", and had to be lent to Sylva through a Nature
    // Evolution that grafts Beast on. Coil is Intelligence 75 with Beast as
    // an INNATE type, so that row finally has a holder swinging it with STAB
    // without spending an Evolution to get there.
    //
    // A tension worth naming rather than hiding: every hero in this file
    // starts with "a low-power move of the hero's MAIN type", and Beast has
    // no low-power magical row for Coil to take — Animal Spirit is 60 base
    // power at 50 mana. So the opener is Psi Bolt, off Coil's SECOND type.
    // Brimstone is the precedent for drawing one from each, but this is the
    // first time a primary type had nothing at all to offer at the low end,
    // and it is a movepool gap rather than a hero problem.
    //
    // Rally rather than Prowl for the third slot, and it is the same pack
    // question read from the other side: half of Prowl is dead on Attack 30,
    // where Rally's +20 Attack is worth full price on the PARTNER. Coil is
    // Beast's enabler half — the hero that makes Fang bigger and takes Pack
    // Leader's discount, rather than the one cashing it.
    moveIds: ['psiBolt', 'lull', 'rally'],
    starter: false,
  },
};
