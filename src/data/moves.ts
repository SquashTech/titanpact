// ⚠️ MOSTLY TEST FIXTURE CONTENT — a broad spread of moves to exercise the
// engine across all 15 types, both categories, every implemented TargetMode,
// and a spread of priority brackets. Enough variety to run messy, interesting
// 2v2s while the real content gets authored.
//
// EXCEPT Fire (2026-08-29), Water (2026-08-30) and Frost (2026-08-30), the
// first three types replaced wholesale by their designed movepools — see the "(AUTHORED)"
// blocks below. Those forty-five are balance-tuned content; everything else here
// is still filler and should be read (and replaced) as such, type by type.
// Nine engine fields exist because an authored slate needed them, and each is
// generic vocabulary in engine/content.ts rather than a per-type special case:
//
//   Fire  — StatusApplication.chance (Ember), critChance (Singe, Firebrand),
//           conditionalPower (Immolate), statDeltas on a damage move (Molten Lash)
//   Water — drainPercent (Siphon, Engulf), cleanseCount (Wash Away),
//           manaDiscountOnUse (Wave Shred)
//   Frost — requiresTargetStatus (Glaciate, Absolute Zero),
//           conditionalPower.consumesStatus (Cold Snap)
//
// Most moves here are `kind: 'damage'` — variety comes from
// type/category/power/cost/priority/targeting — including doubles-native
// spread moves that hit your own ally (`allOthers`), a deliberate nod to
// Pokémon VGC staples like Earthquake/Surf where positioning matters.
//
// The block at the bottom covers `kind: 'heal'` and `kind: 'buff'`, plus one
// move per docs/conditions.md status that's authored per-move (attached via
// `statusApplication` to a small dedicated damage/buff move rather than
// retrofitted onto the moves above, so the original fixture moves — and the
// tests/demo script that reference them by id — stay untouched) and a
// Cleanse move. Burn and Fire Force lost their dedicated fixture carriers
// when Fire was authored, and both were replaced from inside the authored
// pool: Burn by eight Fire-typed carriers, Fire Force by Stoke the Flames —
// and Freeze's dedicated carrier (frostLock) went the same way when Frost was
// authored, replaced by six Frost carriers of its own —
// which is now the only move in the game that grants ANY Elemental Force, so
// do not delete it without replacing that vector.
// Conduct's dedicated fixture carrier (voltaicJolt) went the same way when
// Storm was authored: the slate plants the mark five times over (Rising
// Static, Jolt, Ionize, Storm Lash, Thunderbolt), so that vector needed no
// patching. ANY Storm/Iron damage move can still detonate an existing mark via
// StatusDefinition.triggerTypes; that half stays automatic — see
// statusEngine.ts detonateTriggeredStatuses.

import type { MoveDefinition } from '../engine/content';

export const moves: Record<string, MoveDefinition> = {
  // --- Original fixture moves (descriptions added) -------------------------
  quickJab: {
    id: 'quickJab',
    name: 'Quick Jab',
    type: 'Iron',
    category: 'physical',
    kind: 'damage',
    basePower: 30,
    manaCost: 4,
    priority: 1,
    target: 'singleEnemy',
    description: 'A cheap, fast punch that moves before most other moves.',
  },
  overload: {
    id: 'overload',
    name: 'Overload',
    type: 'Arcane',
    category: 'magical',
    kind: 'damage',
    basePower: 90,
    manaCost: 999, // deliberately unaffordable in test fixtures — exercises the mana-legality guard
    priority: 0,
    target: 'singleEnemy',
    description: 'A reckless overdraw of arcane power — no hero can currently afford it.',
  },
  duskStrike: {
    id: 'duskStrike',
    name: 'Dusk Strike',
    type: 'Shadow',
    category: 'physical',
    kind: 'damage',
    basePower: 55,
    manaCost: 11,
    priority: 0,
    target: 'singleEnemy',
    description: 'A strike thrown from the edge of vision.',
  },

  // --- Fire (AUTHORED, 2026-08-29) ------------------------------------------
  // The first type whose movepool is designer-authored rather than fixture
  // filler. Early/Mid/Late in the design table is the level-up tier a move
  // belongs to (src/data/progression.ts moveTiers), not an engine field.
  //
  // Fire's whole identity is Burn: eleven of the fifteen either apply it, feed
  // off it, or stop it decaying. Three consequences worth knowing before
  // tuning anything here:
  //
  // 1. **Burn halves every round** (src/data/statuses.ts), so a big raw
  //    magnitude is a burst, not a plan. Scorched Land (Spreading Blaze) is
  //    what turns a stack into attrition, and it is why Spark Burst's Burn 50
  //    and Spark Flash's Burn 10 are the same card at two volumes rather than
  //    two different effects.
  // 2. **Burn is cleared by switching.** Every no-damage Burn move here loses
  //    its whole payload to one switch — priced in as the reason they cost
  //    less than a damage move of the same tier, not overlooked.
  // 3. **Mana is the balance lever** (CLAUDE.md): nothing here is
  //    accuracy-gated, so cost is what separates Ember from Inferno. The floor
  //    is 15 and the ceiling 75 — a much steeper curve than the fixture moves
  //    around it, and Fire heroes' mana pools are read against THIS curve.
  ember: {
    id: 'ember',
    name: 'Ember',
    type: 'Fire',
    category: 'magical',
    kind: 'damage',
    basePower: 40,
    statusApplication: { statusId: 'Burn', magnitude: 5, target: 'moveTarget', chance: 0.1 },
    manaCost: 20,
    priority: 0,
    target: 'singleEnemy',
    description: 'A thrown coal that occasionally catches (10% chance of Burn 5).',
  },
  sparkFlash: {
    id: 'sparkFlash',
    name: 'Spark Flash',
    type: 'Fire',
    category: 'magical',
    // No damage body at all: the Burn IS the move. 'buff' is the engine kind
    // for "a move whose whole payload is its riders" — the UI recovers the
    // sign from the rider and calls this a Debuff (MoveTile.tsx isDebuff).
    kind: 'buff',
    statusApplication: { statusId: 'Burn', magnitude: 10, target: 'moveTarget' },
    manaCost: 30,
    priority: 0,
    target: 'bothEnemies',
    description: 'A snap of flame across the field, leaving both foes smoldering (Burn 10).',
  },
  kindle: {
    id: 'kindle',
    name: 'Kindle',
    type: 'Fire',
    category: 'physical',
    kind: 'buff',
    statDeltas: [{ stat: 'attack', amount: 20 }],
    manaCost: 15,
    priority: 0,
    target: 'self',
    description: 'Draws the inner fire up into the arms (+20 Attack).',
  },
  singe: {
    id: 'singe',
    name: 'Singe',
    type: 'Fire',
    category: 'physical',
    kind: 'damage',
    basePower: 30,
    critChance: 0.3,
    manaCost: 20,
    priority: 0,
    target: 'singleEnemy',
    description: 'A glancing burn that finds the gap surprisingly often (30% crit).',
  },
  setAlight: {
    id: 'setAlight',
    name: 'Set Alight',
    type: 'Fire',
    category: 'magical',
    kind: 'buff',
    statusApplication: { statusId: 'Burn', magnitude: 20, target: 'moveTarget' },
    manaCost: 20,
    priority: 0,
    target: 'singleEnemy',
    description: 'Takes hold of one foe and does not let go (Burn 20).',
  },
  stokeTheFlames: {
    id: 'stokeTheFlames',
    name: 'Stoke the Flames',
    type: 'Fire',
    category: 'magical',
    kind: 'buff',
    // The pool's only ramp, and the one move here built for the SIDE rather
    // than for a hero: 'bothAllies' is both active heroes including the caster
    // (targeting.ts), so a second Fire hero standing next to this one gets the
    // same +20 Base Power on every Fire move it owns. Fire Force stacks
    // additively, persists through switching, and Cleanse never strips it
    // (statuses.ts flags it positive) — so the ramp survives the cycling game
    // that most Fire setup does not.
    //
    // Worth knowing before tuning: +20 BP is worth proportionally more on the
    // cheap moves than the expensive ones (+50% on Ember's 40, +20% on
    // Inferno's 100), so this rewards a wide cheap kit rather than a
    // one-big-move kit — the opposite of what the 30 mana suggests at a glance.
    statusApplication: { statusId: 'FireForce', magnitude: 20, target: 'moveTarget' },
    manaCost: 30,
    priority: 0,
    target: 'bothAllies',
    description: 'Feeds the fire in both allies (grants Fire Force 20 to the whole active side, stacks).',
  },
  scorch: {
    id: 'scorch',
    name: 'Scorch',
    type: 'Fire',
    category: 'magical',
    kind: 'damage',
    basePower: 60,
    statusApplication: { statusId: 'Burn', magnitude: 10, target: 'moveTarget' },
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: 'A sustained lick of flame that leaves the skin cooking (Burn 10).',
  },
  spreadingBlaze: {
    id: 'spreadingBlaze',
    name: 'Spreading Blaze',
    type: 'Fire',
    category: 'magical',
    kind: 'buff',
    statusApplication: { statusId: 'Burn', magnitude: 10, target: 'moveTarget' },
    fieldEffectApplication: 'scorchedLand',
    manaCost: 30,
    priority: 0,
    target: 'bothEnemies',
    description: 'Sets the ground itself alight — Scorched Land for 5 rounds, and Burn 10 on both foes.',
  },
  firebrand: {
    id: 'firebrand',
    name: 'Firebrand',
    type: 'Fire',
    category: 'physical',
    kind: 'damage',
    basePower: 75,
    critChance: 0.3,
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: 'A weapon swung white-hot, and it bites (30% crit).',
  },
  moltenLash: {
    id: 'moltenLash',
    name: 'Molten Lash',
    type: 'Fire',
    category: 'physical',
    kind: 'damage',
    basePower: 50,
    statusApplication: { statusId: 'Burn', magnitude: 10, target: 'moveTarget' },
    // Lands AFTER this hit resolves (resolveRound.ts) — the softened armour is
    // for whatever comes next, not for the lash itself.
    statDeltas: [{ stat: 'defense', amount: -10 }],
    manaCost: 35,
    priority: 0,
    target: 'singleEnemy',
    description: 'A whip of molten rope that burns through armour (Burn 10, -10 Defense).',
  },
  backdraft: {
    id: 'backdraft',
    name: 'Backdraft',
    type: 'Fire',
    category: 'magical',
    kind: 'damage',
    basePower: 40,
    statusApplication: { statusId: 'Burn', magnitude: 10, target: 'moveTarget' },
    manaCost: 45,
    priority: 0,
    target: 'bothEnemies',
    description: 'Fire doubling back through the room, catching both foes (Burn 10).',
  },
  immolate: {
    id: 'immolate',
    name: 'Immolate',
    type: 'Fire',
    category: 'magical',
    kind: 'damage',
    basePower: 30,
    // The payoff every other Burn move in this pool is setting up: 30 BP into
    // a clean target, 90 into a burning one. Checked per target off live
    // statuses, so a Burn landed earlier this same round already counts.
    conditionalPower: { requiresTargetStatus: 'Burn', multiplier: 3 },
    manaCost: 30,
    priority: 0,
    target: 'singleEnemy',
    description: 'Feeds a fire that is already lit — triple power against a Burned target.',
  },
  sparkBurst: {
    id: 'sparkBurst',
    name: 'Spark Burst',
    type: 'Fire',
    category: 'magical',
    kind: 'buff',
    statusApplication: { statusId: 'Burn', magnitude: 50, target: 'moveTarget' },
    manaCost: 70,
    priority: 0,
    target: 'bothEnemies',
    description: 'Both foes go up at once (Burn 50).',
  },
  inferno: {
    id: 'inferno',
    name: 'Inferno',
    type: 'Fire',
    category: 'magical',
    kind: 'damage',
    basePower: 100,
    manaCost: 75,
    priority: 0,
    target: 'singleEnemy',
    description: 'Everything the caster has, aimed at one place.',
  },
  firestorm: {
    id: 'firestorm',
    name: 'Firestorm',
    type: 'Fire',
    category: 'magical',
    kind: 'damage',
    basePower: 70,
    manaCost: 60,
    priority: 0,
    target: 'bothEnemies',
    description: 'A firefront that takes the whole opposing side at once.',
  },
  volcanicSurge: {
    id: 'volcanicSurge',
    name: 'Volcanic Surge',
    type: 'Fire',
    category: 'physical',
    kind: 'damage',
    basePower: 120,
    // Recoil as a Burn on the USER rather than flat self-damage: it halves
    // each round like any Burn, and the user's own switch clears it — so the
    // cost is real but escapable, which makes this a tempo decision rather
    // than a flat tax.
    statusApplication: { statusId: 'Burn', magnitude: 30, target: 'self' },
    manaCost: 75,
    priority: 0,
    target: 'singleEnemy',
    description: 'Opens the ground under one foe, and pays for it (self-inflicts Burn 30).',
  },

  // --- Water (AUTHORED, 2026-08-30) ----------------------------------------
  // The second designed movepool, after Fire. Where Fire's fifteen all orbit
  // one status, Water's orbit one question: **how long can you stay in?** Four
  // separate answers to it, none of which is a status the enemy can switch
  // away from:
  //
  //   - drain (Siphon, Engulf)      — HP off the swing you were making anyway
  //   - Renew (Refresh, High Tide)  — HP over time, and the ONE status here
  //                                   that survives a switch (statuses.ts)
  //   - flat heals (Oasis, Wash Away)
  //   - guard (Tide Guard's +10 Def to the side, Undertow's -10 off a foe)
  //
  // Three consequences worth knowing before tuning anything here:
  //
  // 1. **Water has no priority move any more.** The fixture pool's Aqua Jet
  //    (priority 1) and Tsunami Crash (priority -1) both died with this
  //    rewrite, and the design table authors no priority column — so every
  //    Water move resolves in bracket 0 and Water's whole tempo game is Speed
  //    and mana, not brackets.
  // 2. **The heals scale off the caster's Wisdom, not off Water.** Oasis, Wash
  //    Away and both Renew moves run the healing formula (docs/combat.md), so a
  //    Wisdom-40 Riptide gets 0.9x where a Wisdom-60 healer gets 1.1x — before
  //    Water's own 1.25 STAB. The authored numbers are what a Wisdom-50 Water
  //    caster restores, not a guarantee.
  // 3. **Drain deliberately does NOT run that formula** (content.ts
  //    drainPercent). It is half of a damage number that has already taken
  //    variance, crit, STAB and TypeMult — so Siphon's return swings with the
  //    matchup and with nothing else. Into a resisted target it returns almost
  //    nothing; that is the intended shape and the reason it is cheap.
  //
  // Cost floor is 15 and the ceiling 80 — the same steep authored curve Fire
  // set, and Water heroes' mana pools are read against THIS, not against the
  // 7-mana Aqua Jet they used to hold.
  splash: {
    id: 'splash',
    name: 'Splash',
    type: 'Water',
    category: 'magical',
    kind: 'damage',
    basePower: 45,
    manaCost: 20,
    priority: 0,
    target: 'singleEnemy',
    description: 'A hard slap of water with nothing clever behind it.',
  },
  siphon: {
    id: 'siphon',
    name: 'Siphon',
    type: 'Water',
    category: 'magical',
    kind: 'damage',
    basePower: 30,
    // Half of what it actually removes, not half of the roll — see
    // content.ts drainPercent. At 30 BP the return is small in absolute terms
    // and free in tempo terms, which is the whole pitch: an attack that does
    // not cost you the turn you would have spent healing.
    drainPercent: 0.5,
    manaCost: 20,
    priority: 0,
    target: 'singleEnemy',
    description: 'Draws the water back out of a foe, and keeps half of it (heals 50% of damage dealt).',
  },
  tideGuard: {
    id: 'tideGuard',
    name: 'Tide Guard',
    type: 'Water',
    category: 'physical',
    // Authored 'physical' because Defense is the physical pipeline's defending
    // stat — category is inert on a buff move and this is documentation
    // (authoring-moves.md §2).
    kind: 'buff',
    statDeltas: [{ stat: 'defense', amount: 10 }],
    manaCost: 15,
    priority: 0,
    target: 'bothAllies',
    description: 'A standing swell in front of both allies (+10 Defense).',
  },
  refresh: {
    id: 'refresh',
    name: 'Refresh',
    type: 'Water',
    category: 'magical',
    kind: 'buff',
    // Renew is the one status in this pool a switch does not clear
    // (statuses.ts clearsOnSwitch: false), which is what makes it Water's
    // answer to the cycling game rather than another thing lost to it. The
    // magnitude is snapshotted through the healing formula at cast time
    // (healPipeline.ts scaleHotMagnitude), so a high-Wisdom caster's Renew is
    // worth more for the whole time it ticks.
    statusApplication: { statusId: 'Renew', magnitude: 20, target: 'moveTarget' },
    manaCost: 20,
    priority: 0,
    target: 'singleAlly',
    description: 'Sets an ally mending on their own again (grants Renew 20).',
  },
  undertow: {
    id: 'undertow',
    name: 'Undertow',
    type: 'Water',
    category: 'physical',
    kind: 'damage',
    basePower: 35,
    // Lands AFTER this hit (resolveRound.ts) — the softened guard is for what
    // comes next, which on a Water side is usually the partner.
    statDeltas: [{ stat: 'defense', amount: -10 }],
    manaCost: 25,
    priority: 0,
    target: 'singleEnemy',
    description: 'Pulls the footing out from under a foe (-10 Defense).',
  },
  torrent: {
    id: 'torrent',
    name: 'Torrent',
    type: 'Water',
    category: 'magical',
    kind: 'damage',
    basePower: 65,
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: 'A sustained column of water aimed at one place.',
  },
  oasis: {
    id: 'oasis',
    name: 'Oasis',
    type: 'Water',
    category: 'magical',
    kind: 'heal',
    healPower: 50,
    manaCost: 50,
    priority: 0,
    target: 'bothAllies',
    description: 'Still water for the whole side at once.',
  },
  engulf: {
    id: 'engulf',
    name: 'Engulf',
    type: 'Water',
    category: 'magical',
    kind: 'damage',
    basePower: 50,
    drainPercent: 0.5,
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: 'Closes over a foe and does not give it back (heals 50% of damage dealt).',
  },
  aquaSlice: {
    id: 'aquaSlice',
    name: 'Aqua Slice',
    type: 'Water',
    category: 'physical',
    kind: 'damage',
    basePower: 60,
    // Bleed is boolean-shape and flat (5% max HP a round, statuses.ts): it
    // does not decay and switching does not clear it, so a 30% chance at it is
    // worth more on a long fight than the odds suggest.
    statusApplication: { statusId: 'Bleed', target: 'moveTarget', chance: 0.3 },
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: 'A pressurised edge of water that opens a wound (30% chance of Bleed).',
  },
  deluge: {
    id: 'deluge',
    name: 'Deluge',
    type: 'Water',
    category: 'magical',
    kind: 'damage',
    basePower: 45,
    manaCost: 45,
    priority: 0,
    target: 'bothEnemies',
    description: 'Water enough for both of them.',
  },
  washAway: {
    id: 'washAway',
    name: 'Wash Away',
    type: 'Water',
    category: 'magical',
    kind: 'heal',
    healPower: 30,
    cleanses: true,
    // One, at random — not Purify's full strip (content.ts cleanseCount). On a
    // hero carrying a single affliction the two are identical; the price is
    // paid exactly when the player most wants to choose, which is what keeps
    // this a tier below Purify rather than a cheaper copy of it.
    cleanseCount: 1,
    manaCost: 30,
    priority: 0,
    target: 'singleAlly',
    description: "Rinses one of an ally's afflictions away, chosen by the current (cleanses 1 at random).",
  },
  tsunami: {
    id: 'tsunami',
    name: 'Tsunami',
    type: 'Water',
    category: 'magical',
    kind: 'damage',
    basePower: 90,
    manaCost: 70,
    priority: 0,
    target: 'singleEnemy',
    description: 'The whole ocean, arriving at once, at one hero.',
  },
  maelstrom: {
    id: 'maelstrom',
    name: 'Maelstrom',
    type: 'Water',
    category: 'magical',
    kind: 'damage',
    basePower: 70,
    manaCost: 60,
    priority: 0,
    target: 'bothEnemies',
    description: 'A turning of the water that takes the whole opposing side down with it.',
  },
  highTide: {
    id: 'highTide',
    name: 'High Tide',
    type: 'Water',
    category: 'magical',
    kind: 'buff',
    // Refresh at volume and across the side — and the pool's real payoff move,
    // because Renew is the only thing Water hands out that a switch does not
    // take back. Scaled by the caster's Wisdom + STAB at cast time like any
    // Renew, so 50 is the floor a mid-Wisdom Water caster sees, not the cap.
    statusApplication: { statusId: 'Renew', magnitude: 50, target: 'moveTarget' },
    manaCost: 70,
    priority: 0,
    target: 'bothAllies',
    description: 'The tide comes in for the whole side (grants Renew 50).',
  },
  waveShred: {
    id: 'waveShred',
    name: 'Wave Shred',
    type: 'Water',
    category: 'physical',
    kind: 'damage',
    basePower: 80,
    // The pool's one variable cost (content.ts manaDiscountOnUse): 80, then
    // 60, then 40, ... for the rest of the fight, per hero. The ramp is the
    // move — it is a bad finisher and a very good fourth cast, which makes it
    // the only Water move that rewards a LONG fight rather than a survivable
    // one. Note the first cast is always charged 80: a hero who cannot reach
    // that price never starts the ramp (see docs/combat.md).
    manaDiscountOnUse: 20,
    manaCost: 80,
    priority: 0,
    target: 'singleEnemy',
    description: 'Cuts a channel through the water — and every cut after it runs easier (costs 20 less each use).',
  },

  // --- Frost (AUTHORED, 2026-08-30) -----------------------------------------
  // The third designed movepool. Fire's fifteen orbit Burn and Water's orbit
  // staying in; Frost's orbit **Freeze** — a boolean status whose entire
  // printed effect is halving Speed, and which eleven of these fifteen either
  // apply, pay off, or spend.
  //
  // Four consequences worth knowing before tuning anything here:
  //
  // 1. **Freeze is worth little on its own and a great deal to this pool.**
  //    Halved Speed is a tempo nudge; what actually prices Deep Chill (25 for
  //    no damage at all) and Permafrost is that they turn on Glaciate,
  //    Absolute Zero and Cold Snap. Frost is the first type whose SETUP is the
  //    expensive half and whose payoff is the cheap one.
  // 2. **Freeze is cleared by switching** (statuses.ts), so every payoff here
  //    is one voluntary switch away from evaporating — right up until a side
  //    has 2+ heroes KO'd and the lock-in rule (CLAUDE.md "Mana & tempo")
  //    removes switching entirely. Frost is the first pool whose best turn is
  //    a function of which PHASE of the fight it is, and it is deliberately
  //    the weaker half of the fight it is good in.
  // 3. **Two of the payoffs are hard targeting gates, not damage bonuses.**
  //    Glaciate and Absolute Zero carry `requiresTargetStatus` (content.ts):
  //    with no Frozen enemy on the field they have no legal target and cannot
  //    be declared at all. Cold Snap is the softer shape — it lands either way
  //    and doubles by SPENDING the Freeze (conditionalPower.consumesStatus).
  //    A Frost side holding both therefore has to choose, every time it lands
  //    a mark, between cashing it in and keeping it as a key.
  // 4. **Frost keeps bracket play, which Water gave up.** Quick Freeze is
  //    priority 1; every other move here resolves in bracket 0.
  //
  // Cost floor is 15 and the ceiling 75 — the same steep authored curve Fire
  // and Water set. The three Frost heroes' pools are 45/60/70 and are read
  // against THIS, not against the 10-mana Frostbite they used to hold.
  iceShard: {
    id: 'iceShard',
    name: 'Ice Shard',
    type: 'Frost',
    category: 'physical',
    kind: 'damage',
    basePower: 40,
    // The cheap way onto the Freeze track, and the only one that also does
    // damage at Early tier. A fifth of the time it does Deep Chill's whole job
    // for 5 less mana and a 40 BP hit on top — which is the reason Deep Chill
    // has to be a guarantee rather than a bigger chance.
    statusApplication: { statusId: 'Freeze', target: 'moveTarget', chance: 0.2 },
    manaCost: 20,
    priority: 0,
    target: 'singleEnemy',
    description: 'A splinter of ice thrown hard enough to stick (20% chance of Freeze).',
  },
  frostArmor: {
    id: 'frostArmor',
    name: 'Frost Armor',
    type: 'Frost',
    // Authored 'physical' because Defense is the physical pipeline's defending
    // stat — category is inert on a buff move and this is documentation
    // (authoring-moves.md §2).
    category: 'physical',
    kind: 'buff',
    statDeltas: [{ stat: 'defense', amount: 20 }],
    manaCost: 15,
    priority: 0,
    target: 'singleAlly',
    description: 'Sheathes one ally in rime (+20 Defense).',
  },
  deepChill: {
    id: 'deepChill',
    name: 'Deep Chill',
    type: 'Frost',
    category: 'magical',
    kind: 'buff',
    // No damage body at all — `kind: 'buff'` is the engine's kind for a move
    // that is only its rider, and the UI recovers the sign on its own
    // (MoveTile's isDebuff). This is the pool's key-cutter: the guaranteed
    // mark that makes Glaciate and Absolute Zero declarable at all.
    statusApplication: { statusId: 'Freeze', target: 'moveTarget' },
    manaCost: 25,
    priority: 0,
    target: 'singleEnemy',
    description: 'Drives the cold all the way in, no strike required (inflicts Freeze).',
  },
  rimeWind: {
    id: 'rimeWind',
    name: 'Rime Wind',
    type: 'Frost',
    category: 'magical',
    kind: 'damage',
    basePower: 25,
    manaCost: 35,
    priority: 0,
    target: 'bothEnemies',
    description: 'A thin, cutting wind across the whole far side.',
  },
  snowBlast: {
    id: 'snowBlast',
    name: 'Snow Blast',
    type: 'Frost',
    category: 'magical',
    kind: 'damage',
    basePower: 50,
    manaCost: 25,
    priority: 0,
    // Hits your own partner too — the VGC Surf/Earthquake shape, and an
    // authored downside rather than a targeting convenience. Note Frost Armor
    // does NOT cover a partner against this one: Snow Blast is magical, so it
    // reads Wisdom, and the +20 it grants is Defense.
    target: 'allOthers',
    description: 'A wall of driven snow that does not care who is standing in it.',
  },
  icicleThrust: {
    id: 'icicleThrust',
    name: 'Icicle Thrust',
    type: 'Frost',
    category: 'physical',
    kind: 'damage',
    basePower: 60,
    statusApplication: { statusId: 'Freeze', target: 'moveTarget', chance: 0.3 },
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: 'A driven spear of ice, aimed to stay in (30% chance of Freeze).',
  },
  glaciate: {
    id: 'glaciate',
    name: 'Glaciate',
    type: 'Frost',
    category: 'magical',
    kind: 'damage',
    basePower: 75,
    // A hard gate, not a bonus (content.ts requiresTargetStatus): with no
    // Frozen enemy on the field this move cannot be declared at all. That is
    // what buys 75 BP at 40 mana — the same price as Icicle Thrust's 60, for a
    // move that spends a whole earlier turn to become castable.
    requiresTargetStatus: 'Freeze',
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: 'Grows the ice already in a foe until it does the work (only targets a Frozen enemy).',
  },
  permafrost: {
    id: 'permafrost',
    name: 'Permafrost',
    type: 'Frost',
    category: 'magical',
    kind: 'buff',
    statusApplication: { statusId: 'Freeze', target: 'moveTarget' },
    manaCost: 45,
    priority: 0,
    target: 'bothEnemies',
    description: 'Sets the cold into the whole far side at once (inflicts Freeze).',
  },
  frigidAir: {
    id: 'frigidAir',
    name: 'Frigid Air',
    type: 'Frost',
    category: 'magical',
    kind: 'damage',
    basePower: 90,
    manaCost: 50,
    priority: 0,
    target: 'allOthers',
    description: 'The air itself turns lethal, for everyone still breathing it.',
  },
  quickFreeze: {
    id: 'quickFreeze',
    name: 'Quick Freeze',
    type: 'Frost',
    category: 'magical',
    kind: 'damage',
    basePower: 30,
    manaCost: 45,
    // Frost's one bracket play, and the pool's steepest price per point of
    // BasePower by a wide margin — 45 mana for 30 BP buys the bracket, not the
    // hit. It applies no Freeze despite the name (see the hand-off note in
    // docs/combat.md); what it is for is finishing a foe before it can switch
    // its Freeze off and take your gated move with it.
    priority: 1,
    target: 'singleEnemy',
    description: 'Cold, arriving before anything else does.',
  },
  coldSnap: {
    id: 'coldSnap',
    name: 'Cold Snap',
    type: 'Frost',
    category: 'physical',
    kind: 'damage',
    basePower: 55,
    // The soft counterpart to Glaciate's hard gate: this one lands whether or
    // not the target is marked, and doubles by SPENDING the mark
    // (content.ts conditionalPower.consumesStatus). Doubling a 55 BP physical
    // hit is worth less than unlocking Absolute Zero's 120, which is exactly
    // the choice it exists to pose.
    conditionalPower: { requiresTargetStatus: 'Freeze', multiplier: 2, consumesStatus: true },
    manaCost: 35,
    priority: 0,
    target: 'singleEnemy',
    description: 'Shatters the ice off a foe and puts it through them (×2 vs Frozen, consuming it).',
  },
  avalanche: {
    id: 'avalanche',
    name: 'Avalanche',
    type: 'Frost',
    category: 'magical',
    kind: 'damage',
    basePower: 60,
    statusApplication: { statusId: 'Freeze', target: 'moveTarget' },
    manaCost: 75,
    priority: 0,
    target: 'bothEnemies',
    description: 'The whole mountain comes down on both of them (inflicts Freeze).',
  },
  absoluteZero: {
    id: 'absoluteZero',
    name: 'Absolute Zero',
    type: 'Frost',
    category: 'magical',
    kind: 'damage',
    basePower: 120,
    // The pool's ceiling, and the reason the whole Freeze economy exists: the
    // biggest single number in any authored slate so far, payable only against
    // a foe somebody already spent a turn marking.
    requiresTargetStatus: 'Freeze',
    manaCost: 70,
    priority: 0,
    target: 'singleEnemy',
    description: 'Takes everything that was left (only targets a Frozen enemy).',
  },
  iceShatter: {
    id: 'iceShatter',
    name: 'Ice Shatter',
    type: 'Frost',
    category: 'physical',
    kind: 'damage',
    basePower: 80,
    statusApplication: { statusId: 'Freeze', target: 'moveTarget', chance: 0.5 },
    manaCost: 70,
    priority: 0,
    target: 'singleEnemy',
    description: 'A blow that breaks and re-forms at once (50% chance of Freeze).',
  },
  frostWall: {
    id: 'frostWall',
    name: 'Frost Wall',
    type: 'Frost',
    category: 'physical',
    kind: 'buff',
    // +60 to both, which is the largest stat grant any move hands out. Flat
    // additive and a multiple of 10, per CLAUDE.md — so its value is inversely
    // proportional to what the defenders already have, and it is worth most on
    // the squishy side rather than on the wall it looks like it belongs to.
    statDeltas: [{ stat: 'defense', amount: 60 }],
    manaCost: 60,
    priority: 0,
    target: 'bothAllies',
    description: 'A wall of ice across the near side of the field (+60 Defense).',
  },

  // --- Storm -------------------------------------------------------------
  // The authored Storm slate (2026-08-30), replacing the four fixture moves
  // (galeShot, galeSlash, voltaicJolt and the old magical Thunderclap).
  //
  // Storm is the first type whose whole slate is priced around a status hook
  // it gets for FREE: every damage move below is a Storm move, so every one of
  // them detonates an existing Conduct for 10% of the target's max HP without
  // authoring a single field (statuses.ts triggerTypes). Five moves plant the
  // mark and nine cash it in, which is the type's engine — see
  // docs/conditions new.md for the open question about pricing it.
  //
  // Two rows also carry the first move-level answers to "does the board change
  // what this costs / how fast it is": Overcharge is free while both enemies
  // are marked, and Electric Burst jumps a bracket against a marked target.
  risingStatic: {
    id: 'risingStatic',
    name: 'Rising Static',
    type: 'Storm',
    category: 'magical',
    kind: 'buff',
    // The only move in the game whose payload lands on BOTH sides of the field:
    // the Speed goes to a random ally (the move's own target) and the Conduct
    // to a random enemy (the rider's own, content.ts StatusApplication.target).
    // Neither is chosen, which is what prices a two-sided effect at Early tier.
    statDeltas: [{ stat: 'speed', amount: 20 }],
    statusApplication: { statusId: 'Conduct', target: 'randomEnemy' },
    manaCost: 30,
    priority: 0,
    target: 'randomAlly',
    description: 'Charge builds unbidden across the field — one ally quickens, one foe starts to conduct.',
  },
  jolt: {
    id: 'jolt',
    name: 'Jolt',
    type: 'Storm',
    category: 'magical',
    kind: 'damage',
    basePower: 40,
    statusApplication: { statusId: 'Conduct', target: 'moveTarget', chance: 0.2 },
    manaCost: 20,
    priority: 0,
    target: 'singleEnemy',
    description: 'A cheap arc of current that sometimes leaves the target charged.',
  },
  charge: {
    id: 'charge',
    name: 'Charge',
    type: 'Storm',
    category: 'magical',
    kind: 'buff',
    statDeltas: [
      { stat: 'speed', amount: 10 },
      { stat: 'intelligence', amount: 10 },
    ],
    manaCost: 20,
    priority: 0,
    target: 'self',
    description: 'Draw the storm inward and hold it (+10 Speed, +10 Intelligence).',
  },
  zap: {
    id: 'zap',
    name: 'Zap',
    type: 'Storm',
    category: 'magical',
    kind: 'damage',
    basePower: 20,
    manaCost: 25,
    priority: 1,
    target: 'singleEnemy',
    description: 'A flick of current that lands before anything else does.',
  },
  thunderclap: {
    id: 'thunderclap',
    name: 'Thunderclap',
    type: 'Storm',
    category: 'physical',
    kind: 'damage',
    basePower: 45,
    manaCost: 25,
    priority: 0,
    target: 'singleEnemy',
    description: 'A concussive crack of air, close enough to feel in the chest.',
  },
  ionize: {
    id: 'ionize',
    name: 'Ionize',
    type: 'Storm',
    category: 'magical',
    // No damage body at all — kind 'buff' is the engine's kind for "a move
    // whose entire payload is its riders", whatever those riders do to the
    // enemy (authoring-moves.md §2). The view recovers "Debuff" on its own
    // from a non-positive status aimed at someone other than the caster.
    kind: 'buff',
    statusApplication: { statusId: 'Conduct', target: 'moveTarget' },
    manaCost: 35,
    priority: 1,
    target: 'bothEnemies',
    description: 'Salts the air on the far side of the field — both foes start conducting.',
  },
  chainLightning: {
    id: 'chainLightning',
    name: 'Chain Lightning',
    type: 'Storm',
    category: 'magical',
    kind: 'damage',
    basePower: 50,
    manaCost: 50,
    priority: 0,
    target: 'bothEnemies',
    description: 'An arc that refuses to stop at the first thing it touches.',
  },
  tailwind: {
    id: 'tailwind',
    name: 'Tailwind',
    type: 'Storm',
    category: 'physical',
    kind: 'buff',
    statDeltas: [{ stat: 'speed', amount: 40 }],
    // The pivot (content.ts switchesUserOut): the buff lands, then the caster
    // goes to the bench and a declared hero comes in. Blocked — but only the
    // switch half — once the side is locked in at 2+ KOs.
    switchesUserOut: true,
    manaCost: 45,
    priority: 0,
    target: 'singleAlly',
    description: 'Hand the wind to someone else and step out of it (+40 Speed, then switch out).',
  },
  electricBurst: {
    id: 'electricBurst',
    name: 'Electric Burst',
    type: 'Storm',
    category: 'magical',
    kind: 'damage',
    basePower: 70,
    // Reads the board as it stood when the round was ORDERED, so the mark has
    // to already be there when you press the button — a partner planting
    // Conduct this same round does not speed this up (content.ts).
    conditionalPriority: { requiresTargetStatus: 'Conduct', bonus: 1 },
    manaCost: 50,
    priority: 0,
    target: 'singleEnemy',
    description: 'Current finds a charged target early — and arrives ahead of everything else.',
  },
  stormLash: {
    id: 'stormLash',
    name: 'Storm Lash',
    type: 'Storm',
    category: 'physical',
    kind: 'damage',
    basePower: 55,
    statusApplication: { statusId: 'Conduct', target: 'moveTarget' },
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: 'A whipcrack that leaves the target humming (inflicts Conduct).',
  },
  shockSlice: {
    id: 'shockSlice',
    name: 'Shock Slice',
    type: 'Storm',
    category: 'physical',
    kind: 'damage',
    basePower: 60,
    statusApplication: { statusId: 'Bleed', target: 'moveTarget', chance: 0.3 },
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: 'A charged edge drawn across the guard, often deep enough to open it.',
  },
  overcharge: {
    id: 'overcharge',
    name: 'Overcharge',
    type: 'Storm',
    category: 'physical',
    kind: 'damage',
    basePower: 80,
    // The payoff for a fully-marked board: free, but only while BOTH enemies
    // are still carrying Conduct — and this move's own detonation is what
    // strips one of them, so it pays for itself exactly once per setup
    // (content.ts conditionalManaCost).
    conditionalManaCost: { requiresAllEnemiesStatus: 'Conduct', manaCost: 0 },
    manaCost: 60,
    priority: 0,
    target: 'singleEnemy',
    description: 'Dump the whole charge at once — free, if the field is already carrying it.',
  },
  thunderbolt: {
    id: 'thunderbolt',
    name: 'Thunderbolt',
    type: 'Storm',
    category: 'magical',
    kind: 'damage',
    basePower: 90,
    statusApplication: { statusId: 'Conduct', target: 'moveTarget' },
    manaCost: 75,
    priority: 0,
    target: 'singleEnemy',
    description: 'The whole sky, through one point (inflicts Conduct).',
  },
  stormSurge: {
    id: 'stormSurge',
    name: 'Storm Surge',
    type: 'Storm',
    category: 'physical',
    kind: 'buff',
    statDeltas: [
      { stat: 'attack', amount: 50 },
      { stat: 'speed', amount: 50 },
    ],
    manaCost: 70,
    priority: 0,
    target: 'bothAllies',
    description: 'The front arrives, and it arrives on your side (+50 Attack, +50 Speed).',
  },
  ionicZap: {
    id: 'ionicZap',
    name: 'Ionic Zap',
    type: 'Storm',
    category: 'magical',
    kind: 'damage',
    basePower: 50,
    manaCost: 50,
    priority: 1,
    target: 'singleEnemy',
    description: 'A heavier bolt that still arrives before the round properly begins.',
  },

  // --- Stone -------------------------------------------------------------
  // The authored slate (2026-08-30), replacing the two fixture moves. Stone's
  // engine is DEFENSE AS AN OFFENSIVE STAT: Toughen Up and Bastion pour
  // Defense into a hero, Body Blow and Body Crush spend it as Attack, and
  // Provoke, Retribution and Stoneheart turn being hit into the resource the
  // whole line runs on. Nothing here reads a hidden type-keyed hook — unlike
  // Storm's Conduct, Stone's payoff is entirely in what the player builds.
  rockToss: {
    id: 'rockToss',
    name: 'Rock Toss',
    type: 'Stone',
    category: 'physical',
    kind: 'damage',
    basePower: 40,
    critChance: 0.3,
    manaCost: 20,
    priority: 0,
    target: 'singleEnemy',
    description: 'A jagged stone hurled at a seam in the guard (30% crit chance).',
  },
  toughenUp: {
    id: 'toughenUp',
    name: 'Toughen Up',
    type: 'Stone',
    category: 'physical',
    kind: 'buff',
    statDeltas: [
      { stat: 'attack', amount: 10 },
      { stat: 'defense', amount: 10 },
    ],
    manaCost: 15,
    priority: 0,
    target: 'singleAlly',
    description: 'Braces an ally into a fighting stance (+10 Attack, +10 Defense).',
  },
  provoke: {
    id: 'provoke',
    name: 'Provoke',
    type: 'Stone',
    category: 'physical',
    kind: 'buff',
    // Priority +1 is load-bearing rather than flavour: the taunt has to be
    // standing before the enemy's attacks resolve or it protects nothing, and
    // Provoke lasts only the round it was cast in (statuses.ts).
    statusApplication: { statusId: 'Provoke', duration: 1, target: 'self' },
    manaCost: 25,
    priority: 1,
    target: 'self',
    description: 'Plants yourself in the way — single-target enemy moves aimed at either ally are redirected onto you this round.',
  },
  tremor: {
    id: 'tremor',
    name: 'Tremor',
    type: 'Stone',
    category: 'magical',
    kind: 'damage',
    basePower: 35,
    manaCost: 25,
    priority: 0,
    target: 'bothEnemies',
    description: 'A low shudder through the ground beneath both foes.',
  },
  mudBall: {
    id: 'mudBall',
    name: 'Mud Ball',
    type: 'Stone',
    category: 'physical',
    kind: 'damage',
    basePower: 25,
    // Lands after its own hit (resolveRound.ts), so the Speed drop shapes the
    // NEXT round's order, not this one's.
    statDeltas: [{ stat: 'speed', amount: -10 }],
    manaCost: 15,
    priority: 0,
    target: 'singleEnemy',
    description: 'A clot of wet earth to the eyes — slow, cheap, and it sticks (-10 Speed).',
  },
  faultLine: {
    id: 'faultLine',
    name: 'Fault Line',
    type: 'Stone',
    category: 'physical',
    kind: 'damage',
    basePower: 60,
    critChance: 0.3,
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: 'Splits the ground open under one foe (30% crit chance).',
  },
  bodyBlow: {
    id: 'bodyBlow',
    name: 'Body Blow',
    type: 'Stone',
    category: 'physical',
    kind: 'damage',
    basePower: 60,
    // Pipeline 1 (content.ts offStatOverride): the ratio's NUMERATOR reads
    // Defense instead of Attack. The denominator is untouched — this still
    // divides by the target's Defense.
    offStatOverride: 'defense',
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: "A shoulder driven through the guard, powered by the caster's own bulk (uses Defense in place of Attack).",
  },
  bastion: {
    id: 'bastion',
    name: 'Bastion',
    type: 'Stone',
    category: 'physical',
    kind: 'buff',
    statDeltas: [{ stat: 'defense', amount: 30 }],
    manaCost: 40,
    priority: 0,
    target: 'bothAllies',
    description: 'Both heroes set their feet and hold the line (+30 Defense).',
  },
  retribution: {
    id: 'retribution',
    name: 'Retribution',
    type: 'Stone',
    category: 'physical',
    kind: 'damage',
    // No basePower: the whole damage body is the counter (content.ts
    // retributionPercent). FIXED damage — no ratio, STAB, type chart, variance
    // or crit, and no RNG drawn. At bracket 0 this can bank a faster foe's
    // opener from THIS round before it fires; Stoneheart, at +1, cannot.
    retributionPercent: 0.5,
    manaCost: 35,
    priority: 0,
    target: 'singleEnemy',
    description: 'Returns half of every wound taken since your last turn, exactly as it was dealt.',
  },
  rockfall: {
    id: 'rockfall',
    name: 'Rockfall',
    type: 'Stone',
    category: 'magical',
    kind: 'damage',
    basePower: 65,
    manaCost: 45,
    priority: -1,
    target: 'bothEnemies',
    description: 'A slow collapse of stone over the whole enemy line.',
  },
  rubbleRush: {
    id: 'rubbleRush',
    name: 'Rubble Rush',
    type: 'Stone',
    category: 'physical',
    kind: 'damage',
    basePower: 75,
    // 75 BP for 25 mana is deliberately underpriced in mana; the recoil is the
    // real cost, and it CAN faint the user (content.ts recoilPercent).
    recoilPercent: 0.25,
    manaCost: 25,
    priority: 0,
    target: 'singleEnemy',
    description: 'A headlong charge through the debris — cheap, heavy, and it costs you a quarter of what it deals.',
  },
  boulderSlam: {
    id: 'boulderSlam',
    name: 'Boulder Slam',
    type: 'Stone',
    category: 'physical',
    kind: 'damage',
    basePower: 100,
    critChance: 0.5,
    manaCost: 80,
    priority: 0,
    target: 'singleEnemy',
    description: 'Everything the caster has, brought down at once (50% crit chance).',
  },
  bodyCrush: {
    id: 'bodyCrush',
    name: 'Body Crush',
    type: 'Stone',
    category: 'physical',
    kind: 'damage',
    basePower: 90,
    offStatOverride: 'defense',
    manaCost: 75,
    priority: 0,
    target: 'singleEnemy',
    description: "The full weight of a hero who has spent the fight getting harder to move (uses Defense in place of Attack).",
  },
  stoneheart: {
    id: 'stoneheart',
    name: 'Stoneheart',
    type: 'Stone',
    category: 'physical',
    // The design table labels this Buff, which is only an artifact of its
    // Base Power reading N — it deals damage, so it is a damage-kind move
    // whose body is the counter (content.ts retributionPercent).
    kind: 'damage',
    retributionPercent: 1,
    // Priority +1 is what separates this from Retribution beyond the
    // percentage: it acts before anything can hit the user this round, so it
    // only ever cashes in what the PREVIOUS round did.
    manaCost: 70,
    priority: 1,
    target: 'singleEnemy',
    description: 'Every wound taken since your last turn, returned whole and first.',
  },
  landslide: {
    id: 'landslide',
    name: 'Landslide',
    type: 'Stone',
    category: 'magical',
    kind: 'damage',
    basePower: 60,
    statDeltas: [{ stat: 'defense', amount: 20 }],
    // The deltas land on the caster's side, not on the two enemies this hits
    // (content.ts statDeltaTarget) — the first move whose damage and whose
    // buff resolve on opposite sides of the field.
    statDeltaTarget: 'bothAllies',
    manaCost: 70,
    priority: 0,
    target: 'bothEnemies',
    description: 'Brings the hillside down on both foes and leaves your side dug into what it left (+20 Defense to allies).',
  },

  // --- Nature ------------------------------------------------------------
  vineLash: {
    id: 'vineLash',
    name: 'Vine Lash',
    type: 'Nature',
    category: 'physical',
    kind: 'damage',
    basePower: 50,
    manaCost: 9,
    priority: 0,
    target: 'singleEnemy',
    description: 'A whip-crack of living vine.',
  },
  naturesWrath: {
    id: 'naturesWrath',
    name: "Nature's Wrath",
    type: 'Nature',
    category: 'magical',
    kind: 'damage',
    basePower: 42,
    manaCost: 17,
    priority: 0,
    target: 'bothEnemies',
    description: 'Overgrowth erupts violently around both foes.',
  },

  // --- Light -------------------------------------------------------------
  radiantBeam: {
    id: 'radiantBeam',
    name: 'Radiant Beam',
    type: 'Light',
    category: 'magical',
    kind: 'damage',
    basePower: 58,
    manaCost: 12,
    priority: 0,
    target: 'singleEnemy',
    description: 'A focused lance of blinding light.',
  },
  sunstrike: {
    id: 'sunstrike',
    name: 'Sunstrike',
    type: 'Light',
    category: 'magical',
    kind: 'damage',
    basePower: 40,
    manaCost: 18,
    priority: 0,
    target: 'bothEnemies',
    description: 'A flare of searing light that washes over both foes.',
  },

  // --- Shadow ------------------------------------------------------------
  shadowVeil: {
    id: 'shadowVeil',
    name: 'Shadow Veil',
    type: 'Shadow',
    category: 'magical',
    kind: 'damage',
    basePower: 52,
    manaCost: 11,
    priority: 0,
    target: 'singleEnemy',
    description: "Creeping darkness that gnaws at the target's resolve.",
  },
  nightmareGrasp: {
    id: 'nightmareGrasp',
    name: 'Nightmare Grasp',
    type: 'Shadow',
    category: 'magical',
    kind: 'damage',
    basePower: 68,
    manaCost: 15,
    priority: -1,
    target: 'singleEnemy',
    description: 'A dragging grip of pure dread, slow to summon but hard to shake.',
  },

  // --- Arcane ------------------------------------------------------------
  arcaneBolt: {
    id: 'arcaneBolt',
    name: 'Arcane Bolt',
    type: 'Arcane',
    category: 'magical',
    kind: 'damage',
    basePower: 45,
    manaCost: 9,
    priority: 0,
    target: 'singleEnemy',
    description: 'A quick, crackling bolt of raw arcane energy.',
  },
  manaBurst: {
    id: 'manaBurst',
    name: 'Mana Burst',
    type: 'Arcane',
    category: 'magical',
    kind: 'damage',
    basePower: 40,
    manaCost: 18,
    priority: 0,
    target: 'bothEnemies',
    description: 'An unstable detonation of stored mana.',
  },

  // --- Mind --------------------------------------------------------------
  psychicLance: {
    id: 'psychicLance',
    name: 'Psychic Lance',
    type: 'Mind',
    category: 'magical',
    kind: 'damage',
    basePower: 62,
    manaCost: 13,
    priority: 0,
    target: 'singleEnemy',
    description: 'A piercing spear of pure thought.',
  },
  mindSpike: {
    id: 'mindSpike',
    name: 'Mind Spike',
    type: 'Mind',
    category: 'magical',
    kind: 'damage',
    basePower: 28,
    manaCost: 6,
    priority: 1,
    target: 'singleEnemy',
    description: 'A quick jab of psychic pressure — cheap and always fast.',
  },

  // --- Spirit ------------------------------------------------------------
  soulRend: {
    id: 'soulRend',
    name: 'Soul Rend',
    type: 'Spirit',
    category: 'magical',
    kind: 'damage',
    basePower: 55,
    manaCost: 11,
    priority: 0,
    target: 'singleEnemy',
    description: "A tearing pull at the target's spirit.",
  },
  specterHowl: {
    id: 'specterHowl',
    name: 'Specter Howl',
    type: 'Spirit',
    category: 'magical',
    kind: 'damage',
    basePower: 38,
    manaCost: 16,
    priority: 0,
    target: 'bothEnemies',
    description: 'A mournful wail that unsettles both foes at once.',
  },

  // --- Iron --------------------------------------------------------------
  ironFist: {
    id: 'ironFist',
    name: 'Iron Fist',
    type: 'Iron',
    category: 'physical',
    kind: 'damage',
    basePower: 40,
    manaCost: 8,
    priority: 0,
    target: 'singleEnemy',
    description: 'A hardened, metal-plated punch.',
  },
  shrapnelBlast: {
    id: 'shrapnelBlast',
    name: 'Shrapnel Blast',
    type: 'Iron',
    category: 'physical',
    kind: 'damage',
    basePower: 36,
    manaCost: 14,
    priority: 0,
    target: 'bothEnemies',
    description: 'A spray of jagged metal fragments.',
  },

  // --- Mech --------------------------------------------------------------
  moltenHammer: {
    id: 'moltenHammer',
    name: 'Molten Hammer',
    type: 'Mech',
    category: 'physical',
    kind: 'damage',
    basePower: 70,
    manaCost: 15,
    priority: -1,
    target: 'singleEnemy',
    description: 'A white-hot hammer blow, heavy and deliberate.',
  },
  sparkForge: {
    id: 'sparkForge',
    name: 'Spark Forge',
    type: 'Mech',
    category: 'physical',
    kind: 'damage',
    basePower: 32,
    manaCost: 6,
    priority: 1,
    target: 'singleEnemy',
    description: 'A quick flurry of glowing sparks.',
  },

  // --- Beast -------------------------------------------------------------
  fangRush: {
    id: 'fangRush',
    name: 'Fang Rush',
    type: 'Beast',
    category: 'physical',
    kind: 'damage',
    basePower: 45,
    manaCost: 8,
    priority: 1,
    target: 'singleEnemy',
    description: 'A snarling flurry of bites, fast enough to beat most moves.',
  },
  savageMaul: {
    id: 'savageMaul',
    name: 'Savage Maul',
    type: 'Beast',
    category: 'physical',
    kind: 'damage',
    basePower: 75,
    manaCost: 16,
    priority: 0,
    target: 'singleEnemy',
    description: 'A brutal, all-out mauling.',
  },

  // --- Ancient -----------------------------------------------------------
  runicBlast: {
    id: 'runicBlast',
    name: 'Runic Blast',
    type: 'Ancient',
    category: 'magical',
    kind: 'damage',
    basePower: 60,
    manaCost: 14,
    priority: 0,
    target: 'singleEnemy',
    description: 'A detonation of half-forgotten runic power.',
  },
  forgottenCurse: {
    id: 'forgottenCurse',
    name: 'Forgotten Curse',
    type: 'Ancient',
    category: 'magical',
    kind: 'damage',
    basePower: 40,
    manaCost: 17,
    priority: 0,
    target: 'bothEnemies',
    description: 'An old curse that settles over both foes at once.',
  },

  // --- Heal (docs/conditions.md-adjacent: the resource these moves spend against is mana, per CLAUDE.md's "mana cost is the primary balance lever") ---
  restoreVigor: {
    id: 'restoreVigor',
    name: 'Restore Vigor',
    type: 'Light',
    category: 'magical',
    kind: 'heal',
    healPower: 40,
    manaCost: 14,
    priority: 0,
    target: 'self',
    description: 'A burst of restorative light poured into the caster.',
  },
  healingRain: {
    id: 'healingRain',
    name: 'Healing Rain',
    type: 'Nature',
    category: 'magical',
    kind: 'heal',
    healPower: 28,
    manaCost: 20,
    priority: 0,
    target: 'bothAllies',
    description: 'A gentle rain that mends both allies at once.',
  },
  mendWounds: {
    id: 'mendWounds',
    name: 'Mend Wounds',
    type: 'Spirit',
    category: 'magical',
    kind: 'heal',
    healPower: 45,
    manaCost: 16,
    priority: 0,
    target: 'singleAlly',
    description: "A focused working that knits shut an ally's wounds.",
  },

  // --- Buff / debuff (flat stat deltas — CLAUDE.md "flat additive integers, multiples of 5 or 10") ---
  fortify: {
    id: 'fortify',
    name: 'Fortify',
    type: 'Iron',
    category: 'physical',
    kind: 'buff',
    statDeltas: [{ stat: 'defense', amount: 10 }, { stat: 'wisdom', amount: 10 }],
    manaCost: 10,
    priority: 0,
    target: 'self',
    description: "Hardens the caster's guard, physical and magical alike.",
  },
  rally: {
    id: 'rally',
    name: 'Rally',
    type: 'Beast',
    category: 'physical',
    kind: 'buff',
    statDeltas: [{ stat: 'attack', amount: 10 }],
    manaCost: 12,
    priority: 0,
    target: 'bothAllies',
    description: 'A rousing howl that sharpens both allies’ offense.',
  },
  weaken: {
    id: 'weaken',
    name: 'Weaken',
    type: 'Shadow',
    category: 'magical',
    kind: 'buff',
    statDeltas: [{ stat: 'defense', amount: -10 }],
    manaCost: 9,
    priority: 0,
    target: 'singleEnemy',
    description: "Creeping shadow that erodes the target's guard.",
  },
  curseMind: {
    id: 'curseMind',
    name: 'Curse Mind',
    type: 'Mind',
    category: 'magical',
    kind: 'buff',
    statDeltas: [{ stat: 'intelligence', amount: -10 }, { stat: 'wisdom', amount: -10 }],
    manaCost: 11,
    priority: 0,
    target: 'singleEnemy',
    description: "A disorienting pressure that dulls the target's mind.",
  },
  // Goblin Chief's signature move (src/data/enemies.ts) — deliberately the
  // strongest buff in the fixture pool: 3 stats at once, both allies, where
  // every other buff move here caps at 2 stats and/or a single target.
  warHorn: {
    id: 'warHorn',
    name: 'War Horn',
    type: 'Beast',
    category: 'physical',
    kind: 'buff',
    statDeltas: [
      { stat: 'attack', amount: 10 },
      { stat: 'defense', amount: 10 },
      { stat: 'speed', amount: 10 },
    ],
    manaCost: 24,
    priority: 0,
    target: 'bothAllies',
    description: "Whips both allies into a frenzy — Attack, Defense and Speed all up.",
  },

  // --- Status moves (docs/conditions.md) — one per status, plus Cleanse ---
  rendingClaw: {
    id: 'rendingClaw',
    name: 'Rending Claw',
    type: 'Beast',
    category: 'physical',
    kind: 'damage',
    basePower: 35,
    statusApplication: { statusId: 'Bleed', target: 'moveTarget' },
    manaCost: 12,
    priority: 0,
    target: 'singleEnemy',
    description: "A raking slash that opens a wound too deep to close (inflicts Bleed).",
  },
  venomousBite: {
    id: 'venomousBite',
    name: 'Venomous Bite',
    type: 'Nature',
    category: 'physical',
    kind: 'damage',
    basePower: 30,
    statusApplication: { statusId: 'Poison', magnitude: 10, duration: 3, target: 'moveTarget' },
    manaCost: 14,
    priority: 0,
    target: 'singleEnemy',
    description: 'A venom-laced bite that starts a 3-round countdown (inflicts Poison 10).',
  },
  stunningBlow: {
    id: 'stunningBlow',
    name: 'Stunning Blow',
    type: 'Iron',
    category: 'physical',
    kind: 'damage',
    basePower: 25,
    statusApplication: { statusId: 'Daze', duration: 2, target: 'moveTarget' },
    manaCost: 20,
    priority: 0,
    target: 'singleEnemy',
    description: 'A rattling haymaker, priced high for what it denies (inflicts Daze 2).',
  },
  spectralBind: {
    id: 'spectralBind',
    name: 'Spectral Bind',
    type: 'Spirit',
    category: 'magical',
    kind: 'damage',
    basePower: 30,
    statusApplication: { statusId: 'Haunt', target: 'moveTarget' },
    manaCost: 12,
    priority: 0,
    target: 'singleEnemy',
    description: "Tethers the target's spirit to its partner (inflicts Haunt).",
  },
  vanish: {
    id: 'vanish',
    name: 'Vanish',
    type: 'Shadow',
    category: 'physical',
    kind: 'buff',
    statDeltas: [],
    statusApplication: { statusId: 'Stealth', duration: 1, target: 'self' },
    manaCost: 10,
    priority: 0,
    target: 'self',
    description: "Enters Stealth for this round and the next.",
  },
  secondWind: {
    id: 'secondWind',
    name: 'Second Wind',
    type: 'Spirit',
    category: 'magical',
    kind: 'buff',
    statDeltas: [],
    statusApplication: { statusId: 'Renew', magnitude: 20, target: 'self' },
    manaCost: 15,
    priority: 0,
    target: 'self',
    description: 'Steadies the caster’s breath, mending a little more each round (grants Renew 20).',
  },
  purify: {
    id: 'purify',
    name: 'Purify',
    type: 'Light',
    category: 'magical',
    kind: 'heal',
    healPower: 10,
    cleanses: true,
    manaCost: 16,
    priority: 0,
    target: 'singleAlly',
    description: "Washes away an ally's afflictions (Grant Cleanse).",
  },

  // --- Field Effect moves (docs/field-effects.md) — one per effect ---------
  arcaneSurge: {
    id: 'arcaneSurge',
    name: 'Arcane Surge',
    type: 'Arcane',
    category: 'magical',
    kind: 'buff',
    statDeltas: [],
    fieldEffectApplication: 'surgingMagic',
    manaCost: 20,
    priority: 0,
    target: 'self',
    description: "Surging Magic for 5 rounds: every hero's MP Regen doubles.",
  },
  stasisField: {
    id: 'stasisField',
    name: 'Stasis Field',
    type: 'Mind',
    category: 'magical',
    kind: 'buff',
    statDeltas: [],
    fieldEffectApplication: 'stasisBubble',
    manaCost: 20,
    priority: 0,
    target: 'self',
    description: "Stasis Bubble for 5 rounds: the slowest in a bracket acts first.",
  },
  consecrate: {
    id: 'consecrate',
    name: 'Consecrate',
    type: 'Light',
    category: 'magical',
    kind: 'buff',
    statDeltas: [],
    fieldEffectApplication: 'sanctuary',
    manaCost: 20,
    priority: 0,
    target: 'self',
    description: "Sanctuary for 5 rounds: healing moves gain +1 priority.",
  },
  overgrowth: {
    id: 'overgrowth',
    name: 'Overgrowth',
    type: 'Nature',
    category: 'magical',
    kind: 'buff',
    statDeltas: [],
    fieldEffectApplication: 'verdantEarth',
    manaCost: 20,
    priority: 0,
    target: 'self',
    description: "Verdant Earth for 5 rounds: Renew also raises Attack and Intelligence.",
  },
};
