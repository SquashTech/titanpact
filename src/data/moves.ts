// ⚠️ MOSTLY TEST FIXTURE CONTENT — a broad spread of moves to exercise the
// engine across all 15 types, both categories, every implemented TargetMode,
// and a spread of priority brackets. Enough variety to run messy, interesting
// 2v2s while the real content gets authored.
//
// EXCEPT Fire (2026-08-29), Water, Frost, Storm, Stone, Nature, Light,
// Shadow, Arcane, Mind, Spirit and Iron (all 2026-08-30), the twelve types
// replaced wholesale by their designed movepools —
// see the "(AUTHORED)" blocks below. Those are balance-tuned content;
// everything else here is still filler and should be read (and replaced) as
// such, type by type. Three types are left: Mech, Beast, Ancient. As of the
// Iron slate the "original fixture moves" section at the top of this file is
// gone entirely — every remaining fixture move belongs to one of those three. Every engine field below exists because an authored slate
// needed it, and each is generic vocabulary in engine/content.ts rather than a
// per-type special case:
//
//   Fire  — StatusApplication.chance (Ember), critChance (Singe, Firebrand),
//           conditionalPower (Immolate), statDeltas on a damage move (Molten Lash)
//   Water — drainPercent (Siphon, Engulf), cleanseCount (Wash Away),
//           manaDiscountOnUse (Wave Shred)
//   Frost — requiresTargetStatus (Glaciate, Absolute Zero),
//           conditionalPower.consumesStatus (Cold Snap)
//   Light — conditionalPower.requiresFieldEffect (Smite) — the first damage
//           condition that reads the BOARD instead of a combatant
//   Shadow — conditionalPower.requiresTargetHpBelow (Rend, Eclipse) — the
//           first damage condition that reads a NUMBER rather than the
//           presence of a status or a field
//   Arcane — manaGrant (Infuse, Empower, Conduit, Font of Power) — the first
//           content that moves mana between combatants, and the reason
//           currentMana is no longer bounded by the pool; conditionalTarget
//           (Overload) — the first move whose TARGETING reads the board;
//           derivedStatDeltas (Arcane Overflow) — the first stat grant with no
//           authored number
//   Iron  — conditionalManaCost.requiresAnyEnemyStatus (Metallic Blade) — the
//           second side of Storm's cost condition, "an enemy" rather than
//           "both". Worth a field rather than a rounding because Iron
//           DETONATES the status it reads, which turns a price into a choice:
//           swing at the marked foe and cash the mark, or swing at the other
//           one and keep the discount (docs/combat.md)
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
  // The "original fixture moves" section used to open the file here, and its
  // last survivor was Quick Jab (Iron, 30 BP, 4 mana, priority 1). The
  // authored Iron slate (2026-08-30) deleted it, which is the moment the
  // fixture pool finally emptied: every move in this file is now authored
  // content or a fixture move belonging to one of the three types still
  // waiting for a slate (Mech, Beast, Ancient).
  //
  // Quick Jab was the game's cheapest move at 4 mana and one of only two
  // fixture priority-1 rows a test ever stood on. The slate shipped with no
  // priority row at all and reported that as a deleted capability
  // (docs/authoring-moves.md §10); the designer answered it the same day with
  // **Swift Blow**, in the Iron block above — 15 mana for 15 base power at
  // bracket 1, so the type buys the turn order rather than the exchange. The
  // priority fixtures point back at an Iron move accordingly.
  //
  // Quick Jab's actual price point is still gone: 4 mana was less than a third
  // of anything the slate authors, and Iron's floor is 15.
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

  // --- Nature (AUTHORED, 2026-08-30) ----------------------------------------
  // The sixth designed movepool. Nature is the first type whose damage mostly
  // isn't in its damage moves: four of the fifteen do nothing but stack Poison,
  // which is the catalog's one 'timer'-shape status (statuses.ts) — a magnitude
  // that BUILDS and then pays out once, as a percentage of the holder's max HP.
  // The slate is arranged around the two ways that stack turns into a win:
  //
  //   - **Wait for it.** Poison survives a switch and STALLS on the bench
  //     (activeOnly), so a foe who pivots away carries it with them and only
  //     restarts the clock by coming back. Toxic Spores, Blight, Corrode and
  //     Thorn Whip exist to make that number bigger.
  //   - **Refuse to wait.** Miasma detonates it on contact (content.ts
  //     detonatesStatus), paying the whole accumulated magnitude out
  //     immediately — its own Poison 5 included, because the detonation
  //     resolves after the application.
  //
  // Running alongside it is Renew, which is doing THREE jobs here. This is the
  // single most load-bearing thing about the slate and it is worth reading
  // before tuning any number in it:
  //
  //   1. It heals, on the usual halving curve, snapshotted through the healing
  //      formula at cast time (healPipeline.ts scaleHotMagnitude) — so the
  //      caster's Wisdom and Nature's own STAB are already inside every
  //      authored magnitude below before it ever ticks.
  //   2. It is Seed Shot's and Branch Slam's damage condition
  //      (conditionalPower.requiresUserStatus) — the first two moves in the
  //      game whose bonus is something you put on YOURSELF rather than inflict.
  //   3. Under Verdant Earth it is ALSO flat Attack and Intelligence
  //      (fieldEffects.ts statBonusEqualToStatusMagnitude), and this slate sets
  //      that field effect twice (Magic Growth, Force of Nature).
  //
  // So Overgrowth's Renew 100 is not a 100-point heal. It is a heal, a damage
  // doubler, and — under the type's own field effect — a ~+125 stat swing on
  // one hero, all decaying by half each round. See docs/combat.md.
  //
  // Cost floor 15, ceiling 75, and the slate authors no priority column, so
  // every Nature move resolves in bracket 0.
  vineLash: {
    id: 'vineLash',
    name: 'Vine Lash',
    type: 'Nature',
    category: 'physical',
    kind: 'damage',
    basePower: 40,
    // A 20% opener, not a Poison plan — the guaranteed appliers are Toxic
    // Spores, Blight, Corrode and Thorn Whip. The chance gates the RIDER and
    // never the hit (CLAUDE.md "No accuracy stat").
    statusApplication: { statusId: 'Poison', magnitude: 5, duration: 3, chance: 0.2, target: 'moveTarget' },
    manaCost: 20,
    priority: 0,
    target: 'singleEnemy',
    description: 'A whip-crack of living vine, sometimes barbed (20% chance of Poison 5).',
  },
  toxicSpores: {
    id: 'toxicSpores',
    name: 'Toxic Spores',
    type: 'Nature',
    category: 'magical',
    // No damage body at all, so 'buff' with a negative payload — the engine has
    // no 'debuff' kind and MoveTile recovers the label from the sign
    // (docs/authoring-moves.md §2).
    kind: 'buff',
    statusApplication: { statusId: 'Poison', magnitude: 10, duration: 3, target: 'moveTarget' },
    statDeltas: [{ stat: 'speed', amount: -5 }],
    manaCost: 20,
    priority: 0,
    target: 'singleEnemy',
    description: 'A cloud of spores that clings and drags (inflicts Poison 10, −5 Speed).',
  },
  regrowth: {
    id: 'regrowth',
    name: 'Regrowth',
    type: 'Nature',
    category: 'magical',
    kind: 'buff',
    // Twenty is what a Wisdom-50 caster with no STAB gets; a Nature hero
    // casting it on itself is already at 25 before Wisdom (healPipeline.ts).
    // It is also what makes Seed Shot a 60 BP move rather than a 30 BP one,
    // which is why the cheapest Renew in the pool is the one Sylva opens with.
    statusApplication: { statusId: 'Renew', magnitude: 20, target: 'moveTarget' },
    manaCost: 20,
    priority: 0,
    target: 'bothAllies',
    description: 'Green comes back up under both allies (grants Renew 20).',
  },
  seedShot: {
    id: 'seedShot',
    name: 'Seed Shot',
    type: 'Nature',
    category: 'magical',
    kind: 'damage',
    basePower: 30,
    // The first conditional in the game that reads the USER
    // (content.ts conditionalPower.requiresUserStatus). Deliberately not
    // consuming: the Renew it reads is also healing the caster and, under
    // Verdant Earth, is that hero's Attack and Intelligence — eating it would
    // make one press undo the other two.
    conditionalPower: { requiresUserStatus: 'Renew', multiplier: 2 },
    manaCost: 25,
    priority: 0,
    target: 'singleEnemy',
    description: 'A seed fired hard enough to sting — harder while you are still growing (×2 while you have Renew).',
  },
  ivySpike: {
    id: 'ivySpike',
    name: 'Ivy Spike',
    type: 'Nature',
    category: 'physical',
    kind: 'damage',
    basePower: 25,
    // Lands AFTER its own hit (resolveRound.ts), so the −10 shapes the next
    // swing rather than this one.
    statDeltas: [{ stat: 'attack', amount: -10 }],
    manaCost: 15,
    priority: 0,
    target: 'singleEnemy',
    description: 'A low thorn that takes the strength out of the next swing (−10 Attack).',
  },
  blight: {
    id: 'blight',
    name: 'Blight',
    type: 'Nature',
    category: 'magical',
    kind: 'buff',
    statusApplication: { statusId: 'Poison', magnitude: 20, duration: 3, target: 'moveTarget' },
    manaCost: 30,
    priority: 0,
    target: 'bothEnemies',
    description: 'Rot goes through the whole enemy line (inflicts Poison 20 on both).',
  },
  corrode: {
    id: 'corrode',
    name: 'Corrode',
    type: 'Nature',
    category: 'magical',
    kind: 'damage',
    basePower: 50,
    statusApplication: { statusId: 'Poison', magnitude: 10, duration: 3, target: 'moveTarget' },
    statDeltas: [{ stat: 'defense', amount: -10 }],
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: 'Sap that eats through the guard and stays in the wound (Poison 10, −10 Defense).',
  },
  thornWhip: {
    id: 'thornWhip',
    name: 'Thorn Whip',
    type: 'Nature',
    category: 'physical',
    kind: 'damage',
    basePower: 35,
    statusApplication: { statusId: 'Poison', magnitude: 10, duration: 3, target: 'moveTarget' },
    // Both offensive stats at once, which is what the 45 is actually buying —
    // 35 BP is the smallest damage body in the Mid tier.
    statDeltas: [
      { stat: 'attack', amount: -10 },
      { stat: 'intelligence', amount: -10 },
    ],
    manaCost: 45,
    priority: 0,
    target: 'singleEnemy',
    description: 'Barbs that leave a foe poisoned and unable to answer either way (Poison 10, −10 Attack, −10 Intelligence).',
  },
  wildBloom: {
    id: 'wildBloom',
    name: 'Wild Bloom',
    type: 'Nature',
    category: 'magical',
    kind: 'buff',
    statusApplication: { statusId: 'Renew', magnitude: 50, target: 'moveTarget' },
    manaCost: 45,
    priority: 0,
    target: 'bothAllies',
    description: 'The whole side flowers at once (grants Renew 50).',
  },
  magicGrowth: {
    id: 'magicGrowth',
    name: 'Magic Growth',
    type: 'Nature',
    category: 'magical',
    kind: 'buff',
    statusApplication: { statusId: 'Renew', magnitude: 30, target: 'moveTarget' },
    // The cheaper of the slate's two Verdant Earth setters, and the one that
    // arrives holding its own payoff: the Renew it grants IS the Attack and
    // Intelligence the field effect then reads (fieldEffects.ts).
    fieldEffectApplication: 'verdantEarth',
    manaCost: 40,
    priority: 0,
    target: 'singleAlly',
    description: 'Feeds one ally and turns the ground under everyone (Renew 30; Verdant Earth for 5 rounds).',
  },
  leafSlice: {
    id: 'leafSlice',
    name: 'Leaf Slice',
    type: 'Nature',
    category: 'physical',
    kind: 'damage',
    basePower: 60,
    // Bleed is boolean-shape (statuses.ts) — no magnitude, no decay, a flat 5%
    // of max HP every round for the rest of the fight, and a switch does not
    // clear it. The 30% is priced against that permanence.
    statusApplication: { statusId: 'Bleed', chance: 0.3, target: 'moveTarget' },
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: 'A leaf edge drawn across the guard (30% chance of Bleed).',
  },
  overgrowth: {
    id: 'overgrowth',
    name: 'Overgrowth',
    type: 'Nature',
    category: 'magical',
    kind: 'buff',
    // The largest single number in the game, and it is three numbers: heal,
    // Seed Shot / Branch Slam doubler, and (under Verdant Earth) flat Attack
    // and Intelligence. See the section note above.
    statusApplication: { statusId: 'Renew', magnitude: 100, target: 'moveTarget' },
    manaCost: 70,
    priority: 0,
    target: 'singleAlly',
    description: 'One ally disappears under new growth (grants Renew 100).',
  },
  forceOfNature: {
    id: 'forceOfNature',
    name: 'Force of Nature',
    type: 'Nature',
    category: 'magical',
    kind: 'damage',
    basePower: 100,
    fieldEffectApplication: 'verdantEarth',
    manaCost: 75,
    priority: 0,
    target: 'singleEnemy',
    description: 'The forest answers, and stays answered (Verdant Earth for 5 rounds).',
  },
  branchSlam: {
    id: 'branchSlam',
    name: 'Branch Slam',
    type: 'Nature',
    category: 'physical',
    kind: 'damage',
    basePower: 80,
    // Seed Shot's capstone: same condition, and the reason a physical Nature
    // hero wants a Renew move in its kit at all. 160 effective BP is the
    // biggest number the type reaches, and every route to it runs through
    // having spent an earlier turn on yourself.
    conditionalPower: { requiresUserStatus: 'Renew', multiplier: 2 },
    manaCost: 70,
    priority: 0,
    target: 'singleEnemy',
    description: 'A whole bough brought down two-handed (×2 while you have Renew).',
  },
  miasma: {
    id: 'miasma',
    name: 'Miasma',
    type: 'Nature',
    category: 'magical',
    kind: 'damage',
    basePower: 50,
    statusApplication: { statusId: 'Poison', magnitude: 5, duration: 3, target: 'moveTarget' },
    // Resolved AFTER the application above (resolveRound.ts), so the 5 it just
    // planted is part of what goes off — a Miasma into a clean target is worth
    // 5% of max HP, and one into a Blight + Corrode + Thorn Whip stack is worth
    // 45%. The move is priced at 75 for the second case, not the first.
    detonatesStatus: 'Poison',
    manaCost: 75,
    priority: 0,
    target: 'singleEnemy',
    description: 'Everything this side has planted goes off at once (Poison 5, then detonates the whole stack).',
  },

  // --- Light (AUTHORED 2026-08-30) ---------------------------------------
  // The designed seventeen, replacing the five fixture Light moves
  // (radiantBeam, sunstrike, restoreVigor, purify, consecrate — the first two
  // in this block, the other three in the Heal / Cleanse / Field Effect blocks
  // below). Three ids are REUSED rather than retired, because the slate
  // re-authors the same idea at a new price: radiantBeam, purify, consecrate.
  //
  // The type is three overlapping lines rather than one:
  //
  //   1. **Daze pressure.** Six of the seventeen carry Daze — one guaranteed
  //      (Blind) and five chance-gated at 10/20/30/30/30%. Daze carries no
  //      number (statuses.ts, redesigned to FLINCH 2026-08-30): it denies the
  //      rest of the round and is gone when the round ends. So every one of
  //      these six is really a bet on TURN ORDER — it does nothing at all
  //      against a foe that has already acted, and Solace (Speed 61) gets far
  //      more out of the same rider than Aegis (35) does. Blinding Flash rolls
  //      per target, which is the slate's best odds of catching someone before
  //      they move.
  //   2. **Intelligence buffs.** Bless / Radiance / Exalt are +20 single, +40
  //      both, +100 single. Flat additive multiples of 5 (CLAUDE.md), and
  //      pointedly INTELLIGENCE — a Light hero's own damage line is magical, so
  //      these compound with the type's own kit as well as with a magical
  //      partner's. Exalt's +100 is larger than any base stat in the roster.
  //   3. **Sanctuary as an enabler.** Consecrate is the only setter, and Smite
  //      is the only payoff — the game's first move whose damage condition is
  //      the BOARD rather than a combatant (content.ts
  //      conditionalPower.requiresFieldEffect). Sanctuary is global, so the
  //      same cast that gives this side +1 priority on heals also arms an
  //      enemy Smite; that is the locked shape of field effects, and it is
  //      what the 45 mana is buying against.
  //
  // Cost floor 15, ceiling 120 (Judgment, the highest-priced move in the game),
  // and the slate authors no priority column, so every Light move resolves in
  // bracket 0 — Sanctuary is the type's only bracket play, and it is rented for
  // 5 rounds rather than owned.

  // -- Early --
  glimmer: {
    id: 'glimmer',
    name: 'Glimmer',
    type: 'Light',
    category: 'magical',
    kind: 'damage',
    basePower: 40,
    // A 10% opener, not a Daze plan — Blind is the guaranteed applier. The
    // chance gates the RIDER and never the hit (CLAUDE.md "No accuracy stat").
    statusApplication: { statusId: 'Daze', chance: 0.1, target: 'moveTarget' },
    manaCost: 20,
    priority: 0,
    target: 'singleEnemy',
    description: 'A needle of light, occasionally straight across the eyes (10% chance of Daze).',
  },
  bless: {
    id: 'bless',
    name: 'Bless',
    type: 'Light',
    category: 'magical',
    kind: 'buff',
    statDeltas: [{ stat: 'intelligence', amount: 20 }],
    manaCost: 15,
    priority: 0,
    target: 'singleAlly',
    description: "Lays a hand on an ally and sharpens what they already know (+20 Intelligence).",
  },
  mend: {
    id: 'mend',
    name: 'Mend',
    type: 'Light',
    category: 'magical',
    kind: 'heal',
    // Not flat HP: 45 is what the healing formula SCALES, off the caster's own
    // Wisdom and Light's STAB (healPipeline.ts). Solace at Wisdom 70 restores
    // 68; a Wisdom-40 borrower of this move restores 41.
    healPower: 45,
    manaCost: 25,
    priority: 0,
    target: 'singleAlly',
    description: 'Closes an ally up, cleanly and immediately.',
  },
  purify: {
    id: 'purify',
    name: 'Purify',
    type: 'Light',
    category: 'magical',
    // The fixture Purify healed 10 as well as cleansing; the authored one is
    // pure cleanse, so 'buff' with no deltas — the engine's kind for a move
    // whose entire payload is its riders (docs/authoring-moves.md §2).
    kind: 'buff',
    statDeltas: [],
    cleanses: true,
    // "A negative status", singular — so one, picked at RANDOM from the
    // eligible ones (content.ts cleanseCount). Never a positive status, and
    // still no way to name which. This makes Purify the ONLY cleanse move
    // besides Water's Wash Away, and the game now has no cleanse-all move at
    // all; the unlimited path survives only in the engine.
    cleanseCount: 1,
    manaCost: 20,
    priority: 0,
    target: 'singleAlly',
    description: "Burns one affliction off an ally, whichever the light finds first.",
  },
  blind: {
    id: 'blind',
    name: 'Blind',
    type: 'Light',
    category: 'magical',
    // No damage body, so 'buff' with a hostile payload — MoveTile recovers the
    // Debuff label from the rider's target (docs/authoring-moves.md §2).
    kind: 'buff',
    statDeltas: [],
    // The slate's only GUARANTEED Daze, and since the 2026-08-30 flinch
    // redesign it is a pure 1-for-1 turn trade that only pays when the caster
    // is faster: spend your action to delete theirs. Against a foe that has
    // already moved it does nothing whatsoever. The whole move is priced on the
    // caster's Speed now, which is why it sits in Solace's pool (61) and not
    // Aegis's (35).
    statusApplication: { statusId: 'Daze', target: 'moveTarget' },
    manaCost: 25,
    priority: 0,
    target: 'singleEnemy',
    description: 'Floods a foe with white until there is nothing to aim at (inflicts Daze).',
  },
  holyStrike: {
    id: 'holyStrike',
    name: 'Holy Strike',
    type: 'Light',
    category: 'physical',
    kind: 'damage',
    basePower: 40,
    // The type's only self-sustain outside the heal line, and the reason a
    // physical Light hero is not purely a damage seat: Renew is snapshotted
    // through the caster's Wisdom and STAB at application (healPipeline.ts
    // scaleHotMagnitude), so Aegis at Wisdom 75 banks more than the 10 written.
    statusApplication: { statusId: 'Renew', magnitude: 10, target: 'self' },
    manaCost: 20,
    priority: 0,
    target: 'singleEnemy',
    description: 'A struck blow that gives something back (grants the user Renew 10).',
  },

  // -- Mid --
  radiantBeam: {
    id: 'radiantBeam',
    name: 'Radiant Beam',
    type: 'Light',
    category: 'magical',
    kind: 'damage',
    basePower: 60,
    statusApplication: { statusId: 'Daze', chance: 0.2, target: 'moveTarget' },
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: 'A focused lance of blinding light (20% chance of Daze).',
  },
  consecrate: {
    id: 'consecrate',
    name: 'Consecrate',
    type: 'Light',
    category: 'magical',
    kind: 'heal',
    healPower: 40,
    // The slate's whole tempo game in one cast: a two-target heal that also
    // turns the ground, which then gives every subsequent heal on the field +1
    // priority AND switches on Smite. Note what the 45 is really buying —
    // Sanctuary is global (docs/field-effects.md), so this arms an enemy Smite
    // too, and its heal bonus helps whoever is healing.
    fieldEffectApplication: 'sanctuary',
    manaCost: 45,
    priority: 0,
    target: 'bothAllies',
    description: 'Hallows the ground and lifts both allies (heals, and sets Sanctuary for 5 rounds).',
  },
  radiance: {
    id: 'radiance',
    name: 'Radiance',
    type: 'Light',
    category: 'magical',
    kind: 'buff',
    statDeltas: [{ stat: 'intelligence', amount: 40 }],
    manaCost: 50,
    priority: 0,
    target: 'bothAllies',
    description: 'Both allies burn brighter (+40 Intelligence each).',
  },
  holySlice: {
    id: 'holySlice',
    name: 'Holy Slice',
    type: 'Light',
    category: 'physical',
    kind: 'damage',
    basePower: 60,
    statusApplication: { statusId: 'Bleed', chance: 0.3, target: 'moveTarget' },
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: 'A clean cut that does not close on its own (30% chance of Bleed).',
  },
  smite: {
    id: 'smite',
    name: 'Smite',
    type: 'Light',
    category: 'magical',
    kind: 'damage',
    basePower: 50,
    // The first conditional in the game that reads the BOARD rather than a
    // combatant (content.ts conditionalPower.requiresFieldEffect). Three things
    // follow, all of them intended:
    //   - Consecrate is the only setter, so the type carries its own key — but
    //     a Magical Surge or a Verdant Earth cast by ANYONE overrides Sanctuary
    //     and switches this back off mid-fight.
    //   - The field is global, so an enemy Light hero's Consecrate arms this
    //     too, and this side's Consecrate arms theirs.
    //   - No consumesStatus: there is no holder to strip, and ending a global
    //     field early is a different mechanic that has not been decided.
    conditionalPower: { requiresFieldEffect: 'sanctuary', multiplier: 2 },
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: 'Calls the judgment down — twice as hard on hallowed ground (×2 while Sanctuary is up).',
  },
  blindingFlash: {
    id: 'blindingFlash',
    name: 'Blinding Flash',
    type: 'Light',
    category: 'magical',
    kind: 'damage',
    basePower: 40,
    // Rolled once PER TARGET (content.ts StatusApplication.chance), so this is
    // two independent 30% rolls, not one — the most Daze the slate can put on
    // the board in a single cast, which is what the 50 is priced for.
    statusApplication: { statusId: 'Daze', chance: 0.3, target: 'moveTarget' },
    manaCost: 50,
    priority: 0,
    target: 'bothEnemies',
    description: 'A white detonation across the whole enemy line (30% chance of Daze on each).',
  },

  // -- Late --
  judgment: {
    id: 'judgment',
    name: 'Judgment',
    type: 'Light',
    category: 'magical',
    kind: 'damage',
    // The highest BasePower AND the highest mana cost in the game. No rider at
    // all, deliberately: it is the slate's one move that is only a number.
    basePower: 150,
    manaCost: 120,
    priority: 0,
    target: 'singleEnemy',
    description: 'The verdict, delivered. Nothing subtle about it.',
  },
  divineGrace: {
    id: 'divineGrace',
    name: 'Divine Grace',
    type: 'Light',
    category: 'magical',
    kind: 'heal',
    healPower: 90,
    manaCost: 70,
    priority: 0,
    target: 'bothAllies',
    description: 'Grace enough for both, poured out at once.',
  },
  solarFlare: {
    id: 'solarFlare',
    name: 'Solar Flare',
    type: 'Light',
    category: 'magical',
    kind: 'damage',
    basePower: 70,
    manaCost: 60,
    priority: 0,
    target: 'bothEnemies',
    description: 'A flare of searing light that washes over both foes.',
  },
  deityBlade: {
    id: 'deityBlade',
    name: 'Deity Blade',
    type: 'Light',
    category: 'physical',
    kind: 'damage',
    basePower: 80,
    statusApplication: { statusId: 'Daze', chance: 0.3, target: 'moveTarget' },
    manaCost: 75,
    priority: 0,
    target: 'singleEnemy',
    description: 'A blade of borrowed divinity, and a light nobody looks straight at (30% chance of Daze).',
  },
  exalt: {
    id: 'exalt',
    name: 'Exalt',
    type: 'Light',
    category: 'magical',
    kind: 'buff',
    // +100 is larger than any base Intelligence in the roster, and stat mods
    // PERSIST across a switch (CLAUDE.md "Resolved design questions") — so this
    // is a one-cast investment in one hero for the rest of the fight, which is
    // what the 60 and the single target are pricing.
    statDeltas: [{ stat: 'intelligence', amount: 100 }],
    manaCost: 60,
    priority: 0,
    target: 'singleAlly',
    description: 'Raises one ally past what they were built for (+100 Intelligence).',
  },

  // --- Shadow (AUTHORED 2026-08-30) --------------------------------------
  // The designed fifteen, replacing the five fixture Shadow moves
  // (duskStrike, shadowVeil, nightmareGrasp, weaken, vanish). Two ids are
  // REUSED rather than retired because the slate re-authors the same idea at a
  // new price: weaken (9 -> 15, and now hits Wisdom as well as Defense) and
  // vanish (10 -> 15, otherwise unchanged).
  //
  // The most aggressive slate so far: twelve of the fifteen are damage or
  // damage-shaped, and the three that are not are all setup for the twelve.
  // It runs as four overlapping lines:
  //
  //   1. **Bleed, as flat attrition.** Backstab and Shadow Slice at 30%, Dusk
  //      Blade guaranteed. Bleed is boolean and does NOT decay (statuses.ts):
  //      a flat 5% of max HP every round, and it survives a switch. That makes
  //      it the mirror of Fire's Burn — Burn is a burst that halves away, Bleed
  //      is a small permanent tax you cannot pivot out of. Three carriers is
  //      deliberately few; the type's plan is to apply it early and keep
  //      pressing, not to stack it.
  //   2. **Poison, as the magical line's clock.** Umbra Bolt / Umbral Beam /
  //      Umbral Wave at 20% for 5 / 10 / 20. Every one is chanced, which is the
  //      slate's own statement about how it differs from Nature: Nature plants
  //      Poison on purpose and detonates it, Shadow accumulates it as a side
  //      effect of attacking. Duration 3 throughout, matching every other
  //      Poison in the game and the status's own "3-round timer".
  //   3. **Stealth into Ambush.** Vanish (15) and Shadow Form (60) are the only
  //      two Stealth grants in the game, and Ambush is the only payoff. Stealth
  //      makes the holder untargetable by single-target moves, so the cast that
  //      buys the double ALSO buys a round of safety — and Ambush spends it
  //      (conditionalPower.consumesStatus), so the strike is what breaks cover.
  //      Note the blanket rule in statuses.ts: a side's two actives can never
  //      both be Stealthed, so a double-Shadow team gets one hidden hero, not
  //      two.
  //   4. **The execute.** Rend (40) and Eclipse (100) double against a target
  //      under half HP — the game's first damage condition that reads a NUMBER
  //      rather than the presence of a status or a field
  //      (content.ts conditionalPower.requiresTargetHpBelow). Read BEFORE the
  //      hit's own damage, so neither can double off HP it is about to take;
  //      an execute is paid for by whatever softened the target first, which is
  //      exactly the doubles-partner pressure this type wants to reward.
  //
  // Cost floor 15, ceiling 80 (Eclipse). The slate authors ONE priority row —
  // Shadowstrike at +1, and it pays 45 mana for 35 base power to get it, which
  // is the most expensive point-of-damage in the type. Weaken and Enfeeble are
  // the only non-damage debuffs, and both hit Defense AND Wisdom, so a Shadow
  // side softens for its own physical line and its own magical one with the
  // same button.
  umbraBolt: {
    id: 'umbraBolt',
    name: 'Umbra Bolt',
    type: 'Shadow',
    category: 'magical',
    kind: 'damage',
    basePower: 40,
    // The cheap magical opener, and a 20% Poison rider rather than a plan —
    // the type has no guaranteed Poison applier at all, which is what separates
    // its clock from Nature's (see the block header).
    statusApplication: { statusId: 'Poison', magnitude: 5, duration: 3, chance: 0.2, target: 'moveTarget' },
    manaCost: 20,
    priority: 0,
    target: 'singleEnemy',
    description: 'A dart of congealed dark that sometimes leaves rot behind (20% chance of Poison 5).',
  },
  vanish: {
    id: 'vanish',
    name: 'Vanish',
    type: 'Shadow',
    category: 'physical',
    kind: 'buff',
    statDeltas: [],
    // Duration 1, and Stealth ticks at the START of a round (statuses.ts): this
    // covers the rest of the round it is cast in plus the whole of the next,
    // then goes. The table gives no number for it; 1 is the value this id has
    // always carried and the only Stealth in the game — see docs/conditions.md.
    statusApplication: { statusId: 'Stealth', duration: 1, target: 'self' },
    manaCost: 15,
    priority: 0,
    target: 'self',
    description: 'Steps out of sight for this round and the next (grants Stealth).',
  },
  fadeStrike: {
    id: 'fadeStrike',
    name: 'Fade Strike',
    type: 'Shadow',
    category: 'physical',
    kind: 'damage',
    basePower: 45,
    // Roughly five times the 1/16 default (damagePipeline.ts
    // PROVISIONAL_CRIT_CHANCE). Crit SOURCE stays a loadout question
    // (CLAUDE.md); this is a per-move override, not a stat.
    critChance: 0.3,
    manaCost: 25,
    priority: 0,
    target: 'singleEnemy',
    description: 'A strike thrown from the edge of vision, hard to guard against (30% crit).',
  },
  backstab: {
    id: 'backstab',
    name: 'Backstab',
    type: 'Shadow',
    category: 'physical',
    kind: 'damage',
    basePower: 30,
    statusApplication: { statusId: 'Bleed', chance: 0.3, target: 'moveTarget' },
    manaCost: 20,
    priority: 0,
    target: 'singleEnemy',
    description: 'A short blade under the guard (30% chance of Bleed).',
  },
  weaken: {
    id: 'weaken',
    name: 'Weaken',
    type: 'Shadow',
    category: 'magical',
    kind: 'buff',
    // BOTH defensive stats, which is what makes this the type's universal
    // opener: Shadow's own kit is split physical/magical, so one cast softens
    // for either half of it and for whatever the partner is running.
    statDeltas: [
      { stat: 'defense', amount: -10 },
      { stat: 'wisdom', amount: -10 },
    ],
    manaCost: 15,
    priority: 0,
    target: 'singleEnemy',
    description: "Creeping shadow that erodes the target's guard and their will (-10 Defense, -10 Wisdom).",
  },
  shadowSlice: {
    id: 'shadowSlice',
    name: 'Shadow Slice',
    type: 'Shadow',
    category: 'physical',
    kind: 'damage',
    basePower: 60,
    statusApplication: { statusId: 'Bleed', chance: 0.3, target: 'moveTarget' },
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: 'A long cut that opens as it lands (30% chance of Bleed).',
  },
  ambush: {
    id: 'ambush',
    name: 'Ambush',
    type: 'Shadow',
    category: 'physical',
    kind: 'damage',
    basePower: 50,
    // The only payoff for the type's two Stealth grants, and it SPENDS the
    // cover it cashed in (content.ts conditionalPower.consumesStatus). Read off
    // the attacker's live statuses when the hit resolves, so the player can see
    // the chip lit on the button before committing (FightScreen userConditionMet).
    // Stealth only ever runs one round, so the consume costs the remainder of
    // that round's protection rather than a standing buff.
    conditionalPower: { requiresUserStatus: 'Stealth', multiplier: 2, consumesStatus: true },
    manaCost: 35,
    priority: 0,
    target: 'singleEnemy',
    description: 'Breaks cover to strike (double power from Stealth, which it spends).',
  },
  rend: {
    id: 'rend',
    name: 'Rend',
    type: 'Shadow',
    category: 'physical',
    kind: 'damage',
    basePower: 40,
    // The cheap execute (content.ts conditionalPower.requiresTargetHpBelow).
    // Read BEFORE this hit's damage, so it can never double off HP it is about
    // to remove — the bonus is paid for by whatever softened the target first.
    conditionalPower: { requiresTargetHpBelow: 0.5, multiplier: 2 },
    manaCost: 30,
    priority: 0,
    target: 'singleEnemy',
    description: 'Tears at a wound that is already there (double damage below half HP).',
  },
  umbralBeam: {
    id: 'umbralBeam',
    name: 'Umbral Beam',
    type: 'Shadow',
    category: 'magical',
    kind: 'damage',
    basePower: 60,
    statusApplication: { statusId: 'Poison', magnitude: 10, duration: 3, chance: 0.2, target: 'moveTarget' },
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: 'A sustained lance of darkness (20% chance of Poison 10).',
  },
  shadowstrike: {
    id: 'shadowstrike',
    name: 'Shadowstrike',
    type: 'Shadow',
    category: 'physical',
    kind: 'damage',
    basePower: 35,
    // The slate's only priority row, and the price is steep on purpose: 45 mana
    // for 35 base power is the worst rate in the type. What it buys is the
    // bracket — Shadow otherwise has no way to move before a faster foe, and
    // this is the move that finishes something a Rend left standing.
    manaCost: 45,
    priority: 1,
    target: 'singleEnemy',
    description: 'Crosses the gap before the guard comes up (strikes first).',
  },
  enfeeble: {
    id: 'enfeeble',
    name: 'Enfeeble',
    type: 'Shadow',
    category: 'magical',
    kind: 'buff',
    statDeltas: [
      { stat: 'defense', amount: -30 },
      { stat: 'wisdom', amount: -30 },
    ],
    // Weaken at three times the size and across both foes. Stat mods PERSIST
    // through a switch (CLAUDE.md), so this is 50 mana spent once to make every
    // hit the rest of the fight land harder — the type's biggest single tempo
    // commitment that deals no damage at all.
    manaCost: 50,
    priority: 0,
    target: 'bothEnemies',
    description: 'Drags the whole enemy line down (-30 Defense, -30 Wisdom on both).',
  },
  eclipse: {
    id: 'eclipse',
    name: 'Eclipse',
    type: 'Shadow',
    category: 'magical',
    kind: 'damage',
    basePower: 100,
    conditionalPower: { requiresTargetHpBelow: 0.5, multiplier: 2 },
    manaCost: 80,
    priority: 0,
    target: 'singleEnemy',
    description: 'Puts out the light entirely (double damage below half HP).',
  },
  umbralWave: {
    id: 'umbralWave',
    name: 'Umbral Wave',
    type: 'Shadow',
    category: 'magical',
    kind: 'damage',
    basePower: 70,
    // Rolls per target (content.ts StatusApplication.chance), so this is the
    // slate's best odds of getting Poison onto the board at all.
    statusApplication: { statusId: 'Poison', magnitude: 20, duration: 3, chance: 0.2, target: 'moveTarget' },
    manaCost: 65,
    priority: 0,
    target: 'bothEnemies',
    description: 'Dark rolls over the whole enemy line (20% chance of Poison 20 on each).',
  },
  duskBlade: {
    id: 'duskBlade',
    name: 'Dusk Blade',
    type: 'Shadow',
    category: 'physical',
    kind: 'damage',
    basePower: 80,
    // The only GUARANTEED Bleed in the game. Bleed does not decay and does not
    // clear on a switch (statuses.ts), so this is 5% of max HP per round for
    // the rest of the fight on top of an 80 BP hit.
    statusApplication: { statusId: 'Bleed', target: 'moveTarget' },
    manaCost: 60,
    priority: 0,
    target: 'singleEnemy',
    description: 'A cut that will not close (inflicts Bleed).',
  },
  shadowForm: {
    id: 'shadowForm',
    name: 'Shadow Form',
    type: 'Shadow',
    category: 'physical',
    kind: 'buff',
    // Vanish and Rally in one button, at four times Vanish's price. +75 Attack
    // is flat, additive and persists through a switch (CLAUDE.md), so the 60 is
    // buying a permanent buff plus a round of cover plus an armed Ambush.
    statDeltas: [{ stat: 'attack', amount: 75 }],
    statusApplication: { statusId: 'Stealth', duration: 1, target: 'self' },
    manaCost: 60,
    priority: 0,
    target: 'self',
    description: 'Becomes the dark itself (grants Stealth and +75 Attack).',
  },

  // --- Arcane (AUTHORED 2026-08-30) --------------------------------------
  // The designed sixteen, replacing the four fixture Arcane moves (arcaneBolt,
  // manaBurst, arcaneSurge, and the deliberately-unaffordable 999-mana
  // overload). One id is REUSED: `overload`, which the slate re-authors as a
  // real 50-mana move — the fixture's mana-legality coverage moved to a
  // test-local definition in test/combat.test.ts rather than staying shipped
  // as an uncastable move.
  //
  // The first type whose subject is the resource itself. Every other slate
  // spends mana; this one MOVES it, and four of its rows hand mana to an ally
  // in amounts that deliberately exceed what the ally can hold
  // (content.ts manaGrant, docs/mana.md "Overflow"). It runs as three lines:
  //
  //   1. **The battery.** Infuse (20 -> 40), Empower (40 -> 80), Conduit
  //      (60 -> 150) and Font of Power (100 -> 150 to BOTH allies). Every one
  //      is a net gain for the side and a net loss for the caster's own tempo,
  //      which is the trade the type is built on: a turn spent giving is a turn
  //      not spent attacking, and the payoff has to arrive on somebody else's
  //      turn. The overflow is what makes them more than a wash — a partner at
  //      full pool used to waste the whole grant, and now banks it.
  //   2. **The sink.** Singularity at 200 base power for 150 mana is larger
  //      than any pool in the roster and is not meant to be castable off one:
  //      it is what Conduit and Font of Power are FOR. Arcane Blast (60) and
  //      Cataclysm (90) are the same idea one tier down, and Mana Tap at
  //      **0 mana** is the floor under all of it — the only free move in the
  //      game, so an Arcane hero that has given its pool away still acts.
  //   3. **Magical Surge, set twice and read twice.** Mana Font (which also
  //      hands the side +10 MP Regen) and Magic Cloak (which also hides the
  //      caster) both set it; Overload reads it back as a SPREAD
  //      (content.ts conditionalTarget) — the first move in the game whose
  //      targeting depends on the board. Doubled MP Regen under a field the
  //      type sets itself is the second engine behind the battery: the mana
  //      Infuse hands over is partly mana the field gave back.
  //
  // Arcane Overflow is the slate's capstone and its own category: it hands
  // BOTH allies flat Attack and Intelligence equal to the caster's mana before
  // the cast (content.ts derivedStatDeltas). It is the only stat grant in the
  // game with no authored number, and the only one exempt from the
  // multiples-of-5/10 rule — a mana pool is whatever it is. Note that it grants
  // Attack to a type whose own two heroes are both Intelligence casters: the
  // half that matters is the one landing on a PHYSICAL partner, which is the
  // most explicitly doubles-shaped move in the roster.
  //
  // Cost floor 0 (Mana Tap), ceiling 150 (Conduit's grant, Singularity's hit).
  // The slate authors no priority anywhere and no status but Stealth.
  infuse: {
    id: 'infuse',
    name: 'Infuse',
    type: 'Arcane',
    category: 'magical',
    kind: 'buff',
    statDeltas: [],
    // 20 for 40 — the cheapest tempo trade in the type and its opening
    // statement: a turn given away is worth more than a turn spent, as long as
    // the partner has something to spend it on. Ally modes include the caster
    // (targeting.ts), so pointing it at yourself is a legal 20-for-40 self-ramp.
    manaGrant: 40,
    manaCost: 20,
    priority: 0,
    target: 'singleAlly',
    description: 'Pours 40 mana into an ally — past their pool if it will not fit.',
  },
  magicBolt: {
    id: 'magicBolt',
    name: 'Magic Bolt',
    type: 'Arcane',
    category: 'magical',
    kind: 'damage',
    basePower: 45,
    manaCost: 25,
    priority: 0,
    target: 'singleEnemy',
    description: 'A clean, unadorned bolt of shaped mana.',
  },
  focus: {
    id: 'focus',
    name: 'Focus',
    type: 'Arcane',
    category: 'magical',
    kind: 'buff',
    statDeltas: [{ stat: 'intelligence', amount: 20 }],
    manaCost: 15,
    priority: 0,
    target: 'self',
    description: 'Narrows the mind to a point (+20 Intelligence).',
  },
  manaFont: {
    id: 'manaFont',
    name: 'Mana Font',
    type: 'Arcane',
    category: 'magical',
    kind: 'buff',
    // +10 MP Regen and doubled regen on top of it: the field multiplies the
    // stat (manaRegen.ts applies mpRegenMultiplier to the effective stat), so
    // this one cast is worth +20 a round to each ally for as long as it holds.
    statDeltas: [{ stat: 'mpRegen', amount: 10 }],
    fieldEffectApplication: 'surgingMagic',
    manaCost: 20,
    priority: 0,
    target: 'bothAllies',
    description: 'Opens a well under the whole field (+10 MP Regen to allies, and sets Magical Surge).',
  },
  manaTap: {
    id: 'manaTap',
    name: 'Mana Tap',
    type: 'Arcane',
    category: 'magical',
    kind: 'damage',
    basePower: 20,
    // The only 0-cost move in the game. A hero holding it can never be forced
    // to Rest (state.ts hasAffordableMove is a >= check), which is the point:
    // the type gives its mana away, and the floor under that is a button that
    // costs nothing. See docs/authoring-moves.md for the hand-off note.
    manaCost: 0,
    priority: 0,
    target: 'singleEnemy',
    description: 'Draws a trickle of ambient mana and flicks it at a foe. Costs nothing.',
  },
  empower: {
    id: 'empower',
    name: 'Empower',
    type: 'Arcane',
    category: 'magical',
    kind: 'buff',
    statDeltas: [],
    manaGrant: 80,
    manaCost: 40,
    priority: 0,
    target: 'singleAlly',
    description: 'Floods an ally with 80 mana — past their pool if it will not fit.',
  },
  arcaneBlast: {
    id: 'arcaneBlast',
    name: 'Arcane Blast',
    type: 'Arcane',
    category: 'magical',
    kind: 'damage',
    basePower: 80,
    manaCost: 60,
    priority: 0,
    target: 'singleEnemy',
    description: 'Raw power, undisguised.',
  },
  arcPulse: {
    id: 'arcPulse',
    name: 'Arc Pulse',
    type: 'Arcane',
    category: 'magical',
    kind: 'damage',
    basePower: 45,
    manaCost: 45,
    priority: 0,
    target: 'bothEnemies',
    description: 'A ring of force that crosses the whole enemy line.',
  },
  overload: {
    id: 'overload',
    name: 'Overload',
    type: 'Arcane',
    category: 'magical',
    kind: 'damage',
    basePower: 70,
    // The first move whose TARGETING reads the board (content.ts
    // conditionalTarget). Resolved when the move lands, not when the round is
    // ordered, so a partner's Mana Font earlier this same round has already
    // spread it — the two are a combo, not a two-round setup. The player still
    // declares against one enemy; the second target is added on the way in.
    conditionalTarget: { requiresFieldEffect: 'surgingMagic', target: 'bothEnemies' },
    manaCost: 50,
    priority: 0,
    target: 'singleEnemy',
    description: 'Dumps stored power into a foe — or into both, if the air is already singing.',
  },
  study: {
    id: 'study',
    name: 'Study',
    type: 'Arcane',
    category: 'magical',
    kind: 'buff',
    statDeltas: [{ stat: 'intelligence', amount: 60 }],
    manaCost: 40,
    priority: 0,
    target: 'self',
    description: 'Reads the shape of the fight and rewrites it (+60 Intelligence).',
  },
  magicCloak: {
    id: 'magicCloak',
    name: 'Magic Cloak',
    type: 'Arcane',
    category: 'magical',
    kind: 'buff',
    statDeltas: [],
    fieldEffectApplication: 'surgingMagic',
    // Duration 1, matching Shadow's Vanish and Shadow Form — the only other
    // Stealth grants in the game, and the value that id has always carried.
    // Stealth ticks at the START of a round (statuses.ts), so this covers the
    // rest of the casting round plus the whole of the next.
    statusApplication: { statusId: 'Stealth', duration: 1, target: 'self' },
    manaCost: 40,
    priority: 0,
    target: 'self',
    description: 'Wraps the caster in live mana (grants Stealth and sets Magical Surge).',
  },
  conduit: {
    id: 'conduit',
    name: 'Conduit',
    type: 'Arcane',
    category: 'magical',
    kind: 'buff',
    statDeltas: [],
    // 150 into a pool no hero in the roster can hold — this is the row the
    // overflow rule exists for, and the one that makes Singularity castable.
    manaGrant: 150,
    manaCost: 60,
    priority: 0,
    target: 'singleAlly',
    description: 'Becomes a channel between an ally and the raw source (150 mana, past their pool).',
  },
  singularity: {
    id: 'singularity',
    name: 'Singularity',
    type: 'Arcane',
    category: 'magical',
    kind: 'damage',
    basePower: 200,
    // Larger than any pool in the roster on purpose: the type authors its own
    // way to pay for it (Conduit, Font of Power) rather than waiting on a run's
    // mana growth. Not a finding — see docs/authoring-moves.md §8.
    manaCost: 150,
    priority: 0,
    target: 'singleEnemy',
    description: 'Collapses a point of space onto one enemy.',
  },
  cataclysm: {
    id: 'cataclysm',
    name: 'Cataclysm',
    type: 'Arcane',
    category: 'magical',
    kind: 'damage',
    basePower: 90,
    manaCost: 90,
    priority: 0,
    target: 'bothEnemies',
    description: 'Unmakes the ground both foes are standing on.',
  },
  arcaneOverflow: {
    id: 'arcaneOverflow',
    name: 'Arcane Overflow',
    type: 'Arcane',
    category: 'magical',
    kind: 'buff',
    statDeltas: [],
    // No authored number: both grants are the caster's mana as it stood BEFORE
    // this 80 was paid (content.ts derivedStatDeltas). Overflow counts, which
    // is the whole combo — Font of Power into this puts a three-figure buff on
    // both allies, and the mana is still there to spend afterward.
    derivedStatDeltas: { source: 'userManaBeforeCast', stats: ['attack', 'intelligence'] },
    manaCost: 80,
    priority: 0,
    target: 'bothAllies',
    description: "Spills the caster's stored mana into both allies as raw Attack and Intelligence.",
  },
  fontOfPower: {
    id: 'fontOfPower',
    name: 'Font of Power',
    type: 'Arcane',
    category: 'magical',
    kind: 'buff',
    statDeltas: [],
    // bothAllies, so the caster is paid too (targeting.ts activeOf includes the
    // caster on every ally mode): 100 out, 150 back to itself and 150 to the
    // partner. The single biggest tempo swing in the type.
    manaGrant: 150,
    manaCost: 100,
    priority: 0,
    target: 'bothAllies',
    description: 'Opens the source itself — 150 mana to both allies, past their pools.',
  },

  // --- Mind (AUTHORED 2026-08-30) ----------------------------------------
  // The designed sixteen, replacing the four fixture Mind moves (psychicLance,
  // mindSpike, curseMind, stasisField). No id is reused: `stasis` is a new id
  // for the field-effect setter rather than `stasisField` re-authored, because
  // the design table calls the effect "Stasis Field" and a move and a field
  // effect sharing one name reads better than a move named after the field it
  // is no longer the only content for.
  //
  // The type whose subject is the OPPONENT'S stat line. Every other slate
  // buys damage, healing, tempo or a resource; this one buys the denominator.
  // It runs as four lines:
  //
  //   1. **The Wisdom war.** Nine of the sixteen touch Wisdom, and they point
  //      in both directions: Enervate (-30), Disorient (-30 spread) and the
  //      three chanced riders push it down, while Brain Ward (+20) and Mental
  //      Fortress (+30 to both allies) push it up. Wisdom is the magical
  //      pair's DENOMINATOR (CLAUDE.md "Damage formula"), so every one of
  //      those is a damage number wearing a support move's clothes — the type
  //      attacks by making its own attacks bigger rather than by hitting
  //      harder.
  //   2. **Mind Shatter closes the loop.** It is the one move in the slate
  //      that swings the user's WISDOM instead of Intelligence
  //      (content.ts offStatOverride, pipeline 1). So Brain Ward and Mental
  //      Fortress, authored as defensive buffs, are also its ramp, and the
  //      target's Wisdom is on BOTH sides of the ratio: Enervate makes the
  //      hit bigger and Mental Fortress makes it bigger again. 100 base power
  //      for 80 mana is the ceiling of the slate and this is what feeds it.
  //   3. **Brain Flay, the amplifier.** The capstone deals no damage at all
  //      (content.ts doublesStatReductions): it doubles every reduction
  //      already standing on both enemies. Break Will's -50/-50 becomes
  //      -100/-100 for one more cast, and it COMPOUNDS, so the real ceiling
  //      is however many turns the type is given. Stat mods persist through
  //      switching (LOCKED), so nothing walks it off; the only bound is
  //      getEffectiveStat's floor of 1.
  //   4. **The two marks, and only one of them is Mind's.** Wicked Fear
  //      applies HAUNT, and Mind is one of Haunt's spreadTriggerTypes
  //      (statuses.ts), so the slate's eight single-target damage moves all
  //      spread onto a Haunted holder's partner for free — a hidden rider
  //      across half the slate, the same shape Conduct is for Storm, and it
  //      is priced into these numbers. Cerebral Shock applies CONDUCT, whose
  //      triggerTypes are ['Storm', 'Iron'] — so Mind plants a mark it can
  //      never cash itself (2026-08-30 designer call: intended). It is the
  //      slate's one move that is worth nothing without a specific partner.
  //
  // Cost floor 15 (Brain Ward), ceiling 80 (Mind Shatter, Brain Flay). One
  // priority row (Psychic Blow, +1) and no Elemental Force grant.
  psiBolt: {
    id: 'psiBolt',
    name: 'Psi Bolt',
    type: 'Mind',
    category: 'magical',
    kind: 'damage',
    basePower: 40,
    // The type's opener, and the cheapest way it starts the Wisdom war: the
    // debuff is a 1-in-5 rider (content.ts statDeltaChance), so this is a
    // poke that occasionally sets up rather than a setup move that also pokes.
    statDeltas: [{ stat: 'wisdom', amount: -20 }],
    statDeltaChance: 0.2,
    manaCost: 20,
    priority: 0,
    target: 'singleEnemy',
    description: "A lance of raw thought that sometimes leaves the mind open.",
  },
  brainWard: {
    id: 'brainWard',
    name: 'Brain Ward',
    type: 'Mind',
    category: 'magical',
    kind: 'buff',
    statDeltas: [{ stat: 'wisdom', amount: 20 }],
    // The slate's cheapest move at 15, and deliberately double-purposed: read
    // as defence it is +20 against every magical attacker, and read as offence
    // it is +20 base power on the holder's own Mind Shatter.
    manaCost: 15,
    priority: 0,
    target: 'singleAlly',
    description: "Shores up an ally's mind — +20 Wisdom.",
  },
  enervate: {
    id: 'enervate',
    name: 'Enervate',
    type: 'Mind',
    category: 'magical',
    kind: 'buff',
    statDeltas: [{ stat: 'wisdom', amount: -30 }],
    manaCost: 25,
    priority: 0,
    target: 'singleEnemy',
    description: "Drains a foe's guard — -30 Wisdom.",
  },
  lull: {
    id: 'lull',
    name: 'Lull',
    type: 'Mind',
    category: 'magical',
    kind: 'buff',
    statDeltas: [{ stat: 'intelligence', amount: -20 }],
    // The mirror of Enervate and the cheaper of the two, because Intelligence
    // is the enemy's NUMERATOR — it blunts what comes back rather than
    // sharpening what goes out, so it is worth less to a Mind hero on the
    // turn it is cast and more over a long fight.
    manaCost: 20,
    priority: 0,
    target: 'singleEnemy',
    description: "Dulls a foe's focus — -20 Intelligence.",
  },
  dopamine: {
    id: 'dopamine',
    name: 'Dopamine',
    type: 'Mind',
    category: 'magical',
    kind: 'heal',
    // healPower, not flat HP: the figure the healing formula scales off the
    // CASTER's Wisdom (docs/combat.md "The healing formula"). Which makes it
    // the third move in the slate that Brain Ward and Mental Fortress ramp.
    healPower: 30,
    manaCost: 20,
    priority: 0,
    target: 'singleAlly',
    description: 'Floods an ally with relief.',
  },
  psychock: {
    id: 'psychock',
    name: 'Psychock',
    type: 'Mind',
    category: 'magical',
    kind: 'damage',
    basePower: 60,
    statDeltas: [{ stat: 'wisdom', amount: -30 }],
    statDeltaChance: 0.2,
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: 'A heavier shock that can leave the mind wide open.',
  },
  wickedFear: {
    id: 'wickedFear',
    name: 'Wicked Fear',
    type: 'Mind',
    category: 'magical',
    kind: 'damage',
    basePower: 50,
    // Haunt is the type's own hook (statuses.ts spreadTriggerTypes covers
    // Spirit and Mind), so this is the slate's force multiplier: every
    // single-target Mind attack after it also strikes the holder when it is
    // aimed at the holder's PARTNER. Boolean-shape, so no magnitude and no
    // duration to author.
    statusApplication: { statusId: 'Haunt', target: 'moveTarget' },
    manaCost: 45,
    priority: 0,
    target: 'singleEnemy',
    description: 'A terror that binds a foe to its partner.',
  },
  stasis: {
    id: 'stasis',
    name: 'Stasis',
    type: 'Mind',
    category: 'magical',
    kind: 'buff',
    statDeltas: [
      { stat: 'intelligence', amount: 20 },
      { stat: 'wisdom', amount: 20 },
    ],
    fieldEffectApplication: 'stasisBubble',
    // 45 for a field plus a two-stat self-buff, where the old bare setter was
    // 20 for the field alone — the shape every authored slate has converged on
    // (Nature, Light and Arcane all did the same): the field rides on a cast
    // you wanted anyway rather than costing a turn spent on nothing.
    manaCost: 45,
    priority: 0,
    target: 'self',
    description: 'Stasis Field for 5 rounds: the slowest in a bracket acts first. +20 Int, +20 Wis.',
  },
  cerebralShock: {
    id: 'cerebralShock',
    name: 'Cerebral Shock',
    type: 'Mind',
    category: 'magical',
    kind: 'damage',
    basePower: 50,
    // Conduct's triggerTypes are ['Storm', 'Iron'] (statuses.ts), so no Mind
    // move detonates this — the mark is for a PARTNER to cash in. 2026-08-30
    // designer call: intended, and the most explicitly doubles-shaped move in
    // the slate. Priced as a 50 BP hit whose rider is worth 10% of the
    // target's max HP only on a team that brought a Storm or Iron hero.
    statusApplication: { statusId: 'Conduct', target: 'moveTarget' },
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: "Leaves a foe's nerves conducting — for an ally to set off.",
  },
  psychicBlow: {
    id: 'psychicBlow',
    name: 'Psychic Blow',
    type: 'Mind',
    category: 'magical',
    kind: 'damage',
    basePower: 40,
    manaCost: 30,
    // The slate's only bracket row. Worth more to this type than the number
    // suggests: Stasis Field REVERSES same-bracket order, so a Mind side that
    // has set its own field is buying the front of a bracket it has also made
    // hostile to everything else in bracket 0.
    priority: 1,
    target: 'singleEnemy',
    description: 'A thought that lands before the thinking does.',
  },
  disorient: {
    id: 'disorient',
    name: 'Disorient',
    type: 'Mind',
    category: 'magical',
    kind: 'buff',
    statDeltas: [
      { stat: 'intelligence', amount: -30 },
      { stat: 'wisdom', amount: -30 },
    ],
    manaCost: 50,
    priority: 0,
    target: 'bothEnemies',
    description: 'Scrambles both foes — -30 Intelligence and -30 Wisdom.',
  },
  mentalFortress: {
    id: 'mentalFortress',
    name: 'Mental Fortress',
    type: 'Mind',
    category: 'magical',
    kind: 'buff',
    statDeltas: [{ stat: 'wisdom', amount: 30 }],
    manaCost: 40,
    priority: 0,
    target: 'bothAllies',
    description: 'Both allies gain +30 Wisdom.',
  },
  psionicWave: {
    id: 'psionicWave',
    name: 'Psionic Wave',
    type: 'Mind',
    category: 'magical',
    kind: 'damage',
    basePower: 70,
    statDeltas: [{ stat: 'wisdom', amount: -30 }],
    // Rolled per target (content.ts statDeltaChance), so this can debuff one
    // foe and miss the other — the same per-target rule Ember's chanced Burn
    // follows.
    statDeltaChance: 0.2,
    manaCost: 60,
    priority: 0,
    target: 'bothEnemies',
    description: 'A wave of pressure across the whole field.',
  },
  mindShatter: {
    id: 'mindShatter',
    name: 'Mind Shatter',
    type: 'Mind',
    category: 'magical',
    kind: 'damage',
    basePower: 100,
    // PIPELINE 1 (content.ts offStatOverride): the ratio's NUMERATOR reads
    // Wisdom instead of Intelligence. The DENOMINATOR is untouched — this is
    // still a magical move, so it divides by the target's Wisdom — which makes
    // it the only attack in the game where one stat sits on both sides of the
    // ratio. Enervate makes it bigger by shrinking the bottom; Mental Fortress
    // makes it bigger by growing the top.
    offStatOverride: 'wisdom',
    manaCost: 80,
    priority: 0,
    target: 'singleEnemy',
    description: 'Breaks a mind open with the strength of your own — swings Wisdom, not Intelligence.',
  },
  brainFlay: {
    id: 'brainFlay',
    name: 'Brain Flay',
    type: 'Mind',
    category: 'magical',
    kind: 'buff',
    statDeltas: [],
    // The capstone, and it deals nothing (content.ts doublesStatReductions):
    // it doubles every reduction already standing on both enemies. Worth
    // exactly what the type has already spent — 0 on a clean board, -100/-100
    // on a board Break Will has been through. COMPOUNDS on a second cast.
    doublesStatReductions: true,
    manaCost: 80,
    priority: 0,
    target: 'bothEnemies',
    description: 'Tears open every wound already in both foes minds — doubles their stat reductions.',
  },
  breakWill: {
    id: 'breakWill',
    name: 'Break Will',
    type: 'Mind',
    category: 'magical',
    kind: 'buff',
    // -50 Attack is the slate's only touch on the PHYSICAL pipeline, and it is
    // what stops the type being blank against a physical team. Paired with
    // Brain Flay it is the biggest single stat swing in the game.
    statDeltas: [
      { stat: 'intelligence', amount: -50 },
      { stat: 'attack', amount: -50 },
    ],
    manaCost: 70,
    priority: 0,
    target: 'bothEnemies',
    description: 'Empties both foes of the will to fight — -50 Intelligence and -50 Attack.',
  },

  // --- Spirit ------------------------------------------------------------
  // The authored slate (2026-08-30), replacing soulRend/specterHowl/
  // spectralBind/secondWind/mendWounds. Two things fix the whole type and
  // neither is visible in any one row:
  //
  // 1. **Every damage move here is single-target, and that is the spread.**
  //    Haunt lists Spirit in its `spreadTriggerTypes` (statuses.ts), so any
  //    singleEnemy Spirit hit on a Haunted hero's PARTNER also strikes the
  //    holder. Twelve of these seventeen are damage moves and every one of
  //    them carries that hook for free; three of them plant the mark (Wisp at
  //    20%, Torment and Poltergeist outright). So the type reads as having no
  //    spread move and actually has twelve, gated behind one setup cast —
  //    Storm's Conduct arrangement, except Spirit both plants AND cashes with
  //    the same kit rather than needing a partner. test/spiritMoves.test.ts
  //    pins the count so it cannot drift silently.
  // 2. **Two moves pay their own HP to power the other two.** Spite and
  //    Vengeance multiply off `requiresUserHpBelow` (content.ts), and Soul
  //    Offering and Last Rites are `selfHpCost` moves that put the caster
  //    under those lines on purpose. Spirit's damage ceiling and its survival
  //    are deliberately the same bar.
  wisp: {
    id: 'wisp',
    name: 'Wisp',
    type: 'Spirit',
    category: 'magical',
    kind: 'damage',
    basePower: 40,
    // Chanced, so it is the opener that MIGHT set up rather than the one that
    // does — Torment is the guaranteed version at 5 more mana and no damage.
    // Both exist because Haunt's payoff is every other move in the type.
    statusApplication: { statusId: 'Haunt', chance: 0.2, target: 'moveTarget' },
    manaCost: 20,
    priority: 0,
    target: 'singleEnemy',
    description: 'A drifting light that sometimes catches and clings (20% chance to Haunt).',
  },
  torment: {
    id: 'torment',
    name: 'Torment',
    type: 'Spirit',
    category: 'magical',
    // No damage body at all, so `buff` with a hostile payload — the engine's
    // kind for "a move whose whole point is its rider" (MoveTile recovers the
    // Debuff label from the non-positive status aimed at an enemy).
    kind: 'buff',
    statusApplication: { statusId: 'Haunt', target: 'moveTarget' },
    manaCost: 25,
    priority: 0,
    target: 'singleEnemy',
    description: "Binds the target's spirit to its partner, so a blow to one is a blow to both (applies Haunt).",
  },
  drain: {
    id: 'drain',
    name: 'Drain',
    type: 'Spirit',
    category: 'magical',
    kind: 'damage',
    basePower: 30,
    // The cheap half of the type's sustain, and the reason Spirit can afford
    // to live under Spite's line: the HP comes back off the attacker's own
    // offense, not off Wisdom, so it scales with what the hero already is
    // (content.ts drainPercent).
    drainPercent: 0.5,
    manaCost: 20,
    priority: 0,
    target: 'singleEnemy',
    description: 'Draws the life out of a wound and takes it (heals 50% of damage dealt).',
  },
  secondWind: {
    id: 'secondWind',
    name: 'Second Wind',
    type: 'Spirit',
    category: 'magical',
    kind: 'buff',
    statDeltas: [],
    statusApplication: { statusId: 'Renew', magnitude: 30, target: 'self' },
    manaCost: 30,
    priority: 0,
    target: 'self',
    description: 'Steadies the caster’s breath, mending a little more each round (grants Renew 30).',
  },
  unbound: {
    id: 'unbound',
    name: 'Unbound',
    type: 'Spirit',
    category: 'magical',
    kind: 'buff',
    statDeltas: [
      { stat: 'intelligence', amount: 10 },
      { stat: 'speed', amount: 10 },
    ],
    manaCost: 15,
    priority: 0,
    target: 'self',
    description: 'Slips the body’s hold entirely (+10 Intelligence, +10 Speed).',
  },
  spite: {
    id: 'spite',
    name: 'Spite',
    type: 'Spirit',
    category: 'magical',
    kind: 'damage',
    basePower: 35,
    // The first move in the game whose bonus is a fact about the CASTER's HP
    // (content.ts conditionalPower.requiresUserHpBelow). Asked once per cast,
    // off a snapshot taken before the target loop — so on a Haunted pair,
    // where this single-target move becomes two hits, both are doubled or
    // neither is.
    conditionalPower: { requiresUserHpBelow: 0.5, multiplier: 2 },
    manaCost: 25,
    priority: 0,
    target: 'singleEnemy',
    description: 'Bitterness sharpened by injury — double base power while the user is below 50% HP.',
  },
  phantomStrike: {
    id: 'phantomStrike',
    name: 'Phantom Strike',
    type: 'Spirit',
    category: 'physical',
    kind: 'damage',
    basePower: 45,
    critChance: 0.3,
    manaCost: 25,
    priority: 0,
    target: 'singleEnemy',
    description: 'A blow from somewhere the target was not watching (30% crit).',
  },
  spookySlice: {
    id: 'spookySlice',
    name: 'Spooky Slice',
    type: 'Spirit',
    category: 'physical',
    kind: 'damage',
    basePower: 60,
    // Bleed is the one status here that does NOT clear on a switch
    // (statuses.ts), which makes the physical line's mark the durable one and
    // Haunt the one a pivot answers.
    statusApplication: { statusId: 'Bleed', chance: 0.3, target: 'moveTarget' },
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: 'A cut that arrives before the blade does (30% chance to inflict Bleed).',
  },
  soulRend: {
    id: 'soulRend',
    name: 'Soul Rend',
    type: 'Spirit',
    category: 'magical',
    kind: 'damage',
    basePower: 55,
    drainPercent: 0.5,
    manaCost: 50,
    priority: 0,
    target: 'singleEnemy',
    description: "A tearing pull at the target's spirit, and the taking of what comes loose (heals 50% of damage dealt).",
  },
  poltergeist: {
    id: 'poltergeist',
    name: 'Poltergeist',
    type: 'Spirit',
    category: 'magical',
    kind: 'damage',
    basePower: 50,
    // Damage AND a guaranteed mark, which is what makes it the mid-game
    // upgrade over both early setters at once: Wisp's hit without Wisp's roll,
    // Torment's certainty without Torment's blank turn.
    statusApplication: { statusId: 'Haunt', target: 'moveTarget' },
    manaCost: 45,
    priority: 0,
    target: 'singleEnemy',
    description: 'Hurls the room at one foe and ties them to the other (applies Haunt).',
  },
  soulOffering: {
    id: 'soulOffering',
    name: 'Soul Offering',
    type: 'Spirit',
    category: 'magical',
    kind: 'buff',
    statDeltas: [
      { stat: 'intelligence', amount: 40 },
      { stat: 'attack', amount: 40 },
    ],
    // Both halves land on ONE ally, and 'singleAlly' includes the caster
    // (targeting.ts activeOf) — so pointing it at yourself is legal, and was
    // confirmed as intended (2026-08-30), the same call Arcane's Font of Power
    // got. It buffs both offensive stats precisely so it does not care which
    // pipeline the recipient drives.
    //
    // The cost is paid AFTER the buff lands and CAN faint the caster
    // (content.ts selfHpCost): a Spirit hero cashing itself in to leave its
    // partner +40/+40 is the play this move exists to offer.
    selfHpCost: { mode: 'percentMaxHp', amount: 0.25 },
    manaCost: 30,
    priority: 0,
    target: 'singleAlly',
    description: 'Spends a quarter of the user’s life to give an ally +40 Intelligence and +40 Attack.',
  },
  vengeance: {
    id: 'vengeance',
    name: 'Vengeance',
    type: 'Spirit',
    category: 'magical',
    kind: 'damage',
    basePower: 60,
    // Spite's line, drawn half as low for half again the multiplier: 60 x 3 is
    // 180 base power, the largest number in the game, and it is only ever
    // available to a hero one hit from dying.
    conditionalPower: { requiresUserHpBelow: 0.25, multiplier: 3 },
    manaCost: 45,
    priority: 0,
    target: 'singleEnemy',
    description: 'Everything left, spent at once — triple base power while the user is below 25% HP.',
  },
  flicker: {
    id: 'flicker',
    name: 'Flicker',
    type: 'Spirit',
    category: 'magical',
    kind: 'damage',
    basePower: 40,
    manaCost: 40,
    // The slate's only bracket row, and it is priced as a tax rather than a
    // poke: 40 mana for 40 base power buys nothing but the order. That is the
    // whole point on a type whose best moves want the caster to still be
    // standing at low HP.
    priority: 1,
    target: 'singleEnemy',
    description: 'Gone and back before the blow lands (always strikes first).',
  },
  banish: {
    id: 'banish',
    name: 'Banish',
    type: 'Spirit',
    category: 'magical',
    kind: 'damage',
    basePower: 100,
    manaCost: 80,
    priority: 0,
    target: 'singleEnemy',
    description: 'Sends the target somewhere it does not come back from the same.',
  },
  wailingFlight: {
    id: 'wailingFlight',
    name: 'Wailing Flight',
    type: 'Spirit',
    category: 'physical',
    kind: 'damage',
    basePower: 85,
    statDeltas: [{ stat: 'speed', amount: 20 }],
    // Onto the CASTER, not the foe it just hit (content.ts statDeltaTarget) —
    // the physical line's answer to Flicker, bought once and kept rather than
    // rented a round at a time.
    statDeltaTarget: 'self',
    manaCost: 65,
    priority: 0,
    target: 'singleEnemy',
    description: 'A shrieking pass that leaves the user faster than it arrived (+20 Speed).',
  },
  lastRites: {
    id: 'lastRites',
    name: 'Last Rites',
    type: 'Spirit',
    category: 'magical',
    kind: 'damage',
    basePower: 120,
    // The largest authored base power in the game, and the price is the rest
    // of the hero (content.ts selfHpCost, `reduceToHp`). It cannot faint the
    // caster by construction and it never heals one already lower — what it
    // does is hand the survivor to Vengeance, which wants exactly this.
    selfHpCost: { mode: 'reduceToHp', amount: 1 },
    manaCost: 100,
    priority: 0,
    target: 'singleEnemy',
    description: 'Everything the user has, in one blow (the user drops to 1 HP).',
  },
  ascendant: {
    id: 'ascendant',
    name: 'Ascendant',
    type: 'Spirit',
    category: 'magical',
    kind: 'buff',
    statDeltas: [
      { stat: 'intelligence', amount: 75 },
      { stat: 'speed', amount: 25 },
    ],
    manaCost: 60,
    priority: 0,
    target: 'self',
    description: 'Lets go of the body altogether (+75 Intelligence, +25 Speed).',
  },

  // --- Iron (AUTHORED, 2026-08-30) -----------------------------------------
  // The twelfth authored slate, and the most single-minded of the twelve. Iron
  // has exactly one plan and every row serves it: push the physical ratio's
  // NUMERATOR up and its DENOMINATOR down, then swing.
  //
  //   - FIVE rows hand the caster Attack (Iron Fist +5, Momentum Swing +20,
  //     Sharpen +30, Onslaught +30, Juggernaut +50), and three of those five
  //     are attached to a hit rather than to a turn spent buffing — the ramp
  //     mostly costs nothing but the mana.
  //   - THREE reduce the target's Defense (Opening Strike -10, Pin Down -10,
  //     Rend Armor -20). Same ratio, other end.
  //   - Stat mods PERSIST through a switch (CLAUDE.md, 2026-08-15 sign-off),
  //     so BOTH halves survive a pivot and neither is priced against a single
  //     exchange. Sharpen into Momentum Swing into Onslaught is +100 Attack by
  //     the fourth turn and it keeps it; every stat delta here is a permanent
  //     investment in the fight, not a buff with a clock.
  //
  // Iron is one of Conduct's two trigger types (statuses.ts `triggerTypes:
  // ['Storm', 'Iron']`), so every one of the TEN damage rows below detonates
  // an existing mark for 10% of the target's max HP, for free, with nothing
  // authored — the same hidden rider Storm carries, and the reason the raw
  // numbers here are not the whole price.
  //
  // The slate plants Conduct ZERO times. Designer call (2026-08-30): Iron
  // CASHES the mark and never sets it, so planting is a Storm partner's job
  // (or Mind's Cerebral Shock). Metallic Blade is the one row that reads the
  // mark, and reading it is what makes it free — see its own note for the
  // spend-it-or-bank-it decision that falls out of Iron detonating what it
  // reads.
  //
  // Two rows were added the same day the first fourteen shipped, and they are
  // the two capabilities the slate's own hand-off reported as deleted
  // (docs/authoring-moves.md §10). Worth knowing they are answers rather than
  // afterthoughts, because neither is a like-for-like restoration:
  //
  //   - **Fortify** re-authors the fixture id at 15 mana for +15 DEFENSE, where
  //     the fixture move was 10 for +10 Defense AND +10 Wisdom. So the type
  //     gets its cheap guard buff back and the Wisdom half stays deleted. The
  //     three moves that still grant Wisdom are all MIND (Brain Ward, Stasis,
  //     Mental Fortress), so a physical hero can no longer buy any magical
  //     defense without a Mind partner.
  //   - **Swift Blow** re-opens the bracket Quick Jab closed, at 15 mana for
  //     15 base power rather than 4 for 30. It is the type's ONLY priority row,
  //     and at a quarter of Onslaught's power it buys the turn order rather
  //     than the exchange.
  //
  // What the type still deliberately does not have, all stated by omission: no
  // heal, no cleanse, no field effect, no drain, no bracket below 0, and
  // exactly ONE status rider in sixteen rows.

  // Early --------------------------------------------------------------------
  swiftBlow: {
    id: 'swiftBlow',
    name: 'Swift Blow',
    type: 'Iron',
    category: 'physical',
    kind: 'damage',
    basePower: 15,
    // The type's only priority row, and the whole of its bracket play. 15 base
    // power is a quarter of Serrated Slice's and a seventh of Onslaught's — it
    // is not bought to deal damage, it is bought to act first, which is worth
    // most on the Iron heroes that cannot (Warden at Speed 30, Bellows at 15).
    //
    // It is also a Conduct detonation that resolves ABOVE bracket 0, which is
    // the one thing no other Iron row can do: 15 power plus 10% of a max HP
    // bar, delivered before the target moves.
    manaCost: 15,
    priority: 1,
    target: 'singleEnemy',
    description: 'A short, early jab that lands before almost anything else.',
  },
  ironFist: {
    id: 'ironFist',
    name: 'Iron Fist',
    type: 'Iron',
    category: 'physical',
    kind: 'damage',
    basePower: 40,
    // The fixture id survives at the authored price (8 -> 20). The +5 is the
    // smallest legal stat grant (CLAUDE.md: multiples of 5) and it is the
    // point of the row — an opener that is very slightly better every time you
    // press it, on a stat mod that never expires.
    statDeltas: [{ stat: 'attack', amount: 5 }],
    statDeltaTarget: 'self',
    manaCost: 20,
    priority: 0,
    target: 'singleEnemy',
    description: 'A hardened, metal-plated punch that settles the shoulder for the next one (+5 Attack).',
  },
  sharpen: {
    id: 'sharpen',
    name: 'Sharpen',
    type: 'Iron',
    category: 'physical',
    kind: 'buff',
    // No statDeltaTarget: the move already targets 'self', so naming it again
    // is a no-op that makes MoveTile print "(Self) — Self".
    statDeltas: [{ stat: 'attack', amount: 30 }],
    manaCost: 25,
    priority: 0,
    target: 'self',
    description: 'A turn spent on the edge instead of the enemy (+30 Attack).',
  },
  fortify: {
    id: 'fortify',
    name: 'Fortify',
    type: 'Iron',
    category: 'physical',
    kind: 'buff',
    // Re-authored, not restored. The fixture Fortify was 10 mana for +10
    // Defense AND +10 Wisdom and sat in NINE starting kits across seven types;
    // this is 15 for +15 Defense and nothing else. The Wisdom half stays
    // deleted, and what that costs is narrower than it looks but real: the
    // only remaining Wisdom grants are Mind's (Brain Ward, Stasis, Mental
    // Fortress), so this move used to be how a PHYSICAL hero bought magical
    // defense and now nothing is.
    //
    // Four of the nine ex-holders take it back (Warden, Sentinel, Hollowbark,
    // Clockwork — the ones whose slot was genuinely defensive). The other five
    // keep the Iron row they were repointed onto, because +30 Attack on an
    // Atk-70 Cinder or an Atk-90 Bellows is a better move than +15 Defense and
    // reverting it would be a worse hero for the sake of a tidier history.
    statDeltas: [{ stat: 'defense', amount: 15 }],
    manaCost: 15,
    priority: 0,
    target: 'self',
    description: "Hardens the caster's guard (+15 Defense).",
  },
  openingStrike: {
    id: 'openingStrike',
    name: 'Opening Strike',
    type: 'Iron',
    category: 'physical',
    kind: 'damage',
    basePower: 30,
    // Deltas land AFTER the hit, so the -10 shapes the NEXT swing and never
    // its own. That is what makes this an opener rather than a cheap nuke.
    statDeltas: [{ stat: 'defense', amount: -10 }],
    manaCost: 20,
    priority: 0,
    target: 'singleEnemy',
    description: "A probing blow that finds the seam in a guard (-10 to the target's Defense).",
  },
  heavyBlow: {
    id: 'heavyBlow',
    name: 'Heavy Blow',
    type: 'Iron',
    category: 'physical',
    kind: 'damage',
    basePower: 45,
    // Nearly five times the 1/16 default (damagePipeline.ts). The type's only
    // source of variance beyond the locked 0.85-1.0 roll.
    critChance: 0.3,
    manaCost: 25,
    priority: 0,
    target: 'singleEnemy',
    description: 'A committed, full-weight swing (30% crit chance).',
  },
  pinDown: {
    id: 'pinDown',
    name: 'Pin Down',
    type: 'Iron',
    category: 'physical',
    kind: 'buff',
    // A `buff`-kind move with a negative payload aimed at an enemy is how the
    // engine spells "debuff" (docs/authoring-moves.md §2) — there is no
    // 'debuff' kind, and MoveTile recovers the label from the sign.
    statDeltas: [
      { stat: 'defense', amount: -10 },
      { stat: 'speed', amount: -10 },
    ],
    manaCost: 15,
    priority: 0,
    target: 'singleEnemy',
    description: "Traps a limb and leans on it (-10 to the target's Defense and Speed).",
  },

  // Mid ----------------------------------------------------------------------
  serratedSlice: {
    id: 'serratedSlice',
    name: 'Serrated Slice',
    type: 'Iron',
    category: 'physical',
    kind: 'damage',
    basePower: 60,
    // The slate's ONLY status rider. Bleed is boolean and flat (5% of max HP
    // per round, no decay) and does NOT clear on a switch, so a landed roll
    // follows the target to the bench and back.
    statusApplication: { statusId: 'Bleed', chance: 0.3, target: 'moveTarget' },
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: 'A ragged, toothed edge dragged across the wound (30% chance of Bleed).',
  },
  momentumSwing: {
    id: 'momentumSwing',
    name: 'Momentum Swing',
    type: 'Iron',
    category: 'physical',
    kind: 'damage',
    basePower: 50,
    statDeltas: [{ stat: 'attack', amount: 20 }],
    statDeltaTarget: 'self',
    manaCost: 35,
    priority: 0,
    target: 'singleEnemy',
    description: 'Lets the weight of the weapon carry into the follow-through (+20 Attack).',
  },
  rendArmor: {
    id: 'rendArmor',
    name: 'Rend Armor',
    type: 'Iron',
    category: 'physical',
    kind: 'damage',
    basePower: 55,
    statDeltas: [{ stat: 'defense', amount: -20 }],
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: "Peels plate away from what it was protecting (-20 to the target's Defense).",
  },
  metallicBlade: {
    id: 'metallicBlade',
    name: 'Metallic Blade',
    type: 'Iron',
    category: 'physical',
    kind: 'damage',
    basePower: 50,
    // `requiresAnyEnemyStatus` — the second side of conditionalManaCost, and
    // the reason it exists (content.ts, designer call 2026-08-30). Storm's
    // Overcharge needs BOTH enemies marked; this needs one, anywhere on the
    // enemy side, whether or not it is the foe being hit.
    //
    // That distinction is the move. Iron detonates Conduct (statuses.ts
    // triggerTypes), so swinging this at the MARKED foe cashes the mark for
    // 10% max HP and ends its own discount, while swinging it at the unmarked
    // one leaves the mark standing and stays free next round. Spend it or bank
    // it — a decision Overcharge cannot pose, because a board that satisfies
    // "both marked" cannot survive the cast that reads it.
    conditionalManaCost: { requiresAnyEnemyStatus: 'Conduct', manaCost: 0 },
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: 'A blade that answers a charged field (free while an enemy carries Conduct).',
  },
  reinforce: {
    id: 'reinforce',
    name: 'Reinforce',
    type: 'Iron',
    category: 'physical',
    kind: 'buff',
    statDeltas: [
      { stat: 'attack', amount: 20 },
      { stat: 'defense', amount: 20 },
    ],
    manaCost: 50,
    priority: 0,
    target: 'bothAllies',
    description: 'Braces both allies behind the same plate (+20 Attack and +20 Defense each).',
  },

  // Late ---------------------------------------------------------------------
  onslaught: {
    id: 'onslaught',
    name: 'Onslaught',
    type: 'Iron',
    category: 'physical',
    kind: 'damage',
    basePower: 100,
    statDeltas: [{ stat: 'attack', amount: 30 }],
    statDeltaTarget: 'self',
    manaCost: 80,
    priority: 0,
    target: 'singleEnemy',
    description: 'An unbroken sequence of blows that only gets heavier (+30 Attack).',
  },
  juggernaut: {
    id: 'juggernaut',
    name: 'Juggernaut',
    type: 'Iron',
    category: 'physical',
    kind: 'buff',
    // The largest buff in the game: three stats at +50 each, on one hero, and
    // permanent for the fight. Priced as a whole turn plus 70 mana, and it is
    // the only Iron row that touches Speed upward — the type's answer to
    // having no priority bracket anywhere.
    statDeltas: [
      { stat: 'attack', amount: 50 },
      { stat: 'defense', amount: 50 },
      { stat: 'speed', amount: 50 },
    ],
    manaCost: 70,
    priority: 0,
    target: 'self',
    description: 'Becomes the thing that does not stop (+50 Attack, +50 Defense and +50 Speed).',
  },
  swingingChain: {
    id: 'swingingChain',
    name: 'Swinging Chain',
    type: 'Iron',
    category: 'physical',
    kind: 'damage',
    basePower: 70,
    // The slate's only spread, and no reduction applies (CLAUDE.md: this is a
    // doubles-only game) — so it is 70 into each foe AND a Conduct detonation
    // on each of them that carries a mark.
    manaCost: 65,
    priority: 0,
    target: 'bothEnemies',
    description: 'A weighted chain swung in a flat arc through both foes.',
  },
  conjuredSword: {
    id: 'conjuredSword',
    name: 'Conjured Sword',
    type: 'Iron',
    category: 'magical',
    kind: 'damage',
    basePower: 120,
    // The slate's ONE magical row, and the only one authored for heroes who do
    // not have this type (designer note, 2026-08-30): a late learnable for
    // spellcasters, whose Intelligence swings an Iron-typed blade against
    // Wisdom. No Iron hero should hold it — Warden is Int 20, Valor 40,
    // Gallant 20, Bellows 15 — so it lives in off-type pools and is pinned in
    // the orphan list (test/stoneMoves.test.ts) rather than stuffed into one
    // of theirs. Note it still detonates Conduct like every other Iron damage
    // move, which is a free rider on a hero that cannot plant the mark either.
    manaCost: 80,
    priority: 0,
    target: 'singleEnemy',
    description: 'A blade with no smith and no weight, held together by will (magical).',
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

  // --- Beast (AUTHORED, 2026-08-30) -----------------------------------------
  // The thirteenth authored type, and the one that finally spends the roster's
  // BLEED. Fifteen rows, fourteen of them physical, and three separate engines
  // running through them:
  //
  //   1. **Bleed as a currency.** Three rows plant it (Claw at 20%, Lacerate
  //      outright, Toxic Fangs outright) and two cash it for DOUBLE damage
  //      (Maul at 40 base power, Eviscerate at 75). Bleed never clears on
  //      switching (statuses.ts), so unlike Burn or Freeze the mark follows a
  //      foe to the bench and is still there when it comes back — which is
  //      what makes planting it early with a 20-mana move worth a 80-mana
  //      finisher later.
  //   2. **The pack.** Three rows read the caster's ACTIVE PARTNER's type and
  //      pay double (Prowl's buff, Pack Hunt's base power) or half (Pack
  //      Leader's price) when it is a Beast. The first condition in the game
  //      that asks about a hero on your OWN side, and the only one a player
  //      answers at draft time — see the three engine fields in
  //      engine/content.ts and the hand-off in docs/authoring-moves.md §10,
  //      because the roster has exactly ONE native Beast hero and the
  //      condition is reached through a type-graft Evolution instead.
  //   3. **The ramp.** Rally (+20 Attack, both allies), Prowl (+10/+10, or
  //      +20/+20 beside a Beast) and Pack Leader (+50 Attack and Speed, both
  //      allies) all feed Apex Predator, which doubles whatever the caster's
  //      Attack has become — so the buffs are a multiplier on each other
  //      rather than a list.
  //
  // What the type deliberately does not have, all stated by omission: no heal,
  // no cleanse, no field effect, no drain, no debuff of any kind (every stat
  // delta in the slate is positive), and exactly one magical row.
  //
  // Beast is in no status's triggerTypes or spreadTriggerTypes (statuses.ts),
  // so unlike Storm/Iron (Conduct) and Spirit/Mind (Haunt) none of its twelve
  // damage rows carries a hidden type-keyed rider — what is written is what
  // it is worth.

  // Early --------------------------------------------------------------------
  // Rally survives by ID and is re-authored at the table's price: it was 12
  // mana for +10 Attack and is now 25 for +20, so both halves doubled. It is
  // the widest blast radius in the slate by far — SIX non-Beast starting kits
  // carry it (Tempest, Voltaic, Scallywag, Mordrax, Valor, Gallant) plus two
  // level-up pools — and this is Spirit's Second Wind re-pricing again, one
  // slate later. See docs/authoring-moves.md §10.
  rally: {
    id: 'rally',
    name: 'Rally',
    type: 'Beast',
    category: 'physical',
    kind: 'buff',
    statDeltas: [{ stat: 'attack', amount: 20 }],
    manaCost: 25,
    priority: 0,
    target: 'bothAllies',
    description: 'A rousing howl that sharpens both allies’ offense (+20 Attack).',
  },
  claw: {
    id: 'claw',
    name: 'Claw',
    type: 'Beast',
    category: 'physical',
    kind: 'damage',
    basePower: 40,
    // The type's opener and its cheapest way to start a Bleed. 20% is a poke
    // that sometimes becomes a plan rather than a setup move: the guaranteed
    // carriers (Lacerate, Toxic Fangs) cost 35 and 40, so at 20 this is what
    // an early-fight Beast presses while it waits to afford them.
    statusApplication: { statusId: 'Bleed', target: 'moveTarget', chance: 0.2 },
    manaCost: 20,
    priority: 0,
    target: 'singleEnemy',
    description: 'A raking swipe that sometimes opens a wound (20% Bleed).',
  },
  venomBite: {
    id: 'venomBite',
    name: 'Venom Bite',
    type: 'Beast',
    category: 'physical',
    kind: 'damage',
    basePower: 30,
    // The slate's other DoT, and the only one that is GUARANTEED at 20 mana.
    // Poison's timer is authored at 3 the same way every other Poison row in
    // the game is (Shadow, Nature) — the table gives the magnitude and the
    // duration is the established one, not a per-slate invention.
    statusApplication: { statusId: 'Poison', target: 'moveTarget', magnitude: 10, duration: 3 },
    manaCost: 20,
    priority: 0,
    target: 'singleEnemy',
    description: 'A bite that leaves venom working under the skin (Poison 10).',
  },
  prowl: {
    id: 'prowl',
    name: 'Prowl',
    type: 'Beast',
    category: 'physical',
    kind: 'buff',
    // The type's cheapest row and the first of its three pack conditions
    // (content.ts conditionalStatDeltas): +10/+10 alone, +20/+20 with a Beast
    // in the other active slot. Both Attack AND Speed, which is what makes it
    // the buff a fast bruiser presses on turn one rather than Rally — the
    // Speed is what keeps it acting first while the Attack ramps.
    statDeltas: [
      { stat: 'attack', amount: 10 },
      { stat: 'speed', amount: 10 },
    ],
    statDeltaTarget: 'self',
    conditionalStatDeltas: { requiresPartnerType: 'Beast', multiplier: 2 },
    manaCost: 15,
    priority: 0,
    target: 'self',
    description: 'Circles for an opening (+10 Attack, +10 Speed — doubled beside a Beast).',
  },
  pounce: {
    id: 'pounce',
    name: 'Pounce',
    type: 'Beast',
    category: 'physical',
    kind: 'damage',
    basePower: 30,
    // The slate's only bracket row, and the type's whole answer to being
    // outsped. 30 base power for 35 mana is deliberately a bad rate: what is
    // being bought is the ORDER, on a type whose damage rows are otherwise
    // all worth more the longer a Bleed has been running.
    manaCost: 35,
    priority: 1,
    target: 'singleEnemy',
    description: 'Springs first, from cover.',
  },

  // Mid ----------------------------------------------------------------------
  lacerate: {
    id: 'lacerate',
    name: 'Lacerate',
    type: 'Beast',
    category: 'physical',
    kind: 'damage',
    basePower: 50,
    // The reliable half of Claw: 15 more mana turns a 20% chance into a
    // certainty and adds 10 base power. This is the move Maul and Eviscerate
    // are actually set up by.
    statusApplication: { statusId: 'Bleed', target: 'moveTarget' },
    manaCost: 35,
    priority: 0,
    target: 'singleEnemy',
    description: 'Opens a wound too deep to close (inflicts Bleed).',
  },
  maul: {
    id: 'maul',
    name: 'Maul',
    type: 'Beast',
    category: 'physical',
    kind: 'damage',
    basePower: 40,
    // The cheap half of the payoff pair. Doubling the BASE POWER is where a
    // "double damage" row belongs (CLAUDE.md two-pipeline separation): it
    // scales the formula's own input, so it composes with STAB, the type
    // chart and every relic modifier exactly as an 80 BP move would.
    // No consumesStatus — the Bleed is still there for Eviscerate next round,
    // which is the whole reason to plant it early.
    conditionalPower: { requiresTargetStatus: 'Bleed', multiplier: 2 },
    manaCost: 35,
    priority: 0,
    target: 'singleEnemy',
    description: 'Tears into an open wound (double damage vs Bleeding).',
  },
  toxicFangs: {
    id: 'toxicFangs',
    name: 'Toxic Fangs',
    type: 'Beast',
    category: 'physical',
    kind: 'damage',
    basePower: 40,
    // The first move in the game to apply TWO statuses (content.ts
    // statusApplication is a list since this row — 2026-08-30 designer call).
    // Both guaranteed, both on the move's own target, resolved in this order.
    // At 40 mana it is Lacerate plus Venom Bite for 15 less than casting both,
    // and the pair is worth more than the sum: Bleed arms Maul and Eviscerate
    // while the Poison timer runs, and neither is cleared by switching out.
    statusApplication: [
      { statusId: 'Bleed', target: 'moveTarget' },
      { statusId: 'Poison', target: 'moveTarget', magnitude: 10, duration: 3 },
    ],
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: 'Fangs that tear and envenom at once (inflicts Bleed and Poison 10).',
  },
  rampage: {
    id: 'rampage',
    name: 'Rampage',
    type: 'Beast',
    category: 'physical',
    kind: 'damage',
    basePower: 70,
    // Stone's Rubble Rush shape at a bigger number (content.ts recoilPercent):
    // a quarter of the damage ACTUALLY dealt, paid once after the target loop,
    // and it can faint the user with no floor. The highest single-target base
    // power in the slate that asks no question of the board.
    recoilPercent: 0.25,
    manaCost: 50,
    priority: 0,
    target: 'singleEnemy',
    description: 'An all-out assault that costs the attacker too (25% recoil).',
  },
  thrash: {
    id: 'thrash',
    name: 'Thrash',
    type: 'Beast',
    category: 'physical',
    kind: 'damage',
    basePower: 45,
    // The type's only physical spread, and the only way it touches both foes
    // without a magical stat. No rider: 45 into two targets for 45 mana is
    // the whole row, which is what a type carrying this much conditional
    // damage needs as its unconditional floor.
    manaCost: 45,
    priority: 0,
    target: 'bothEnemies',
    description: 'Lashes out at everything within reach.',
  },
  packHunt: {
    id: 'packHunt',
    name: 'Pack Hunt',
    type: 'Beast',
    category: 'physical',
    kind: 'damage',
    basePower: 40,
    // The second pack row, and the one that makes the condition a DAMAGE
    // decision rather than a buff bonus (content.ts
    // conditionalPower.requiresPartnerType). 40 base power alone is a bad
    // 40-mana move; 80 beside a Beast is the best rate in the slate. Read off
    // the ACTIVE partner when the hit lands, so switching a Beast in earlier
    // in the same round already counts.
    conditionalPower: { requiresPartnerType: 'Beast', multiplier: 2 },
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
    description: 'Strikes as one of a pair (double power beside a Beast).',
  },

  // Late ---------------------------------------------------------------------
  eviscerate: {
    id: 'eviscerate',
    name: 'Eviscerate',
    type: 'Beast',
    category: 'physical',
    kind: 'damage',
    basePower: 75,
    // Maul's capstone: same question, nearly double the base power and more
    // than double the price. A Bleed planted by a 20-mana Claw on round one
    // is what turns this into a 150 BP hit on round five, and nothing the
    // defender does short of a Cleanse takes it away — Bleed survives a
    // switch (statuses.ts).
    conditionalPower: { requiresTargetStatus: 'Bleed', multiplier: 2 },
    manaCost: 80,
    priority: 0,
    target: 'singleEnemy',
    description: 'Finishes what the wound started (double damage vs Bleeding).',
  },
  apexPredator: {
    id: 'apexPredator',
    name: 'Apex Predator',
    type: 'Beast',
    category: 'physical',
    kind: 'buff',
    // "Double the user's Attack" as a DERIVED grant (content.ts
    // derivedStatDeltas 'userEffectiveAttack', 2026-08-30 designer call):
    // it grants Attack equal to whatever the caster's Attack currently reads,
    // which is a doubling rather than a flat number. So Rally and Prowl before
    // it are worth double again, a second cast doubles the doubled figure, and
    // a debuffed caster doubles the debuffed one.
    derivedStatDeltas: { source: 'userEffectiveAttack', stats: ['attack'] },
    statDeltaTarget: 'self',
    manaCost: 90,
    priority: 0,
    target: 'self',
    description: "Sheds every restraint — doubles the user's Attack.",
  },
  packLeader: {
    id: 'packLeader',
    name: 'Pack Leader',
    type: 'Beast',
    category: 'physical',
    kind: 'buff',
    // The biggest stat grant in the game: +50 Attack AND +50 Speed to both
    // allies, which is more than most heroes' entire authored Attack.
    statDeltas: [
      { stat: 'attack', amount: 50 },
      { stat: 'speed', amount: 50 },
    ],
    // The third pack row, and the only one that pays out as a PRICE rather
    // than as an effect (content.ts conditionalManaCost.requiresPartnerType).
    // 100 is above every hero's starting pool; 50 beside a Beast is castable
    // by mid-run, so the discount is not a bonus on top of the move — it is
    // most of what decides whether the move exists for a given team.
    conditionalManaCost: { requiresPartnerType: 'Beast', manaCost: 50 },
    manaCost: 100,
    priority: 0,
    target: 'bothAllies',
    description: 'Takes the front and the pack follows (+50 Attack and Speed to both allies).',
  },
  animalSpirit: {
    id: 'animalSpirit',
    name: 'Animal Spirit',
    type: 'Beast',
    category: 'magical',
    kind: 'damage',
    basePower: 60,
    // The slate's ONE magical row, authored as coverage for casters rather
    // than for the type's own hero (designer note, 2026-08-30) — Beast's only
    // native hero is Attack 90 / Intelligence 20, so this is deliberately not
    // for it. It lives off-type, in a caster's pool; see
    // docs/authoring-moves.md §10 for the candidates left unplaced.
    manaCost: 50,
    priority: 0,
    target: 'bothEnemies',
    description: 'Calls something older than the caster down on both foes.',
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
  // Restore Vigor (Light, heal 40, target 'self', 14 mana) lived here until the
  // authored Light slate replaced it (2026-08-30). It was the game's ONLY
  // heal-kind move targeting 'self' and the cheapest heal anywhere, and three
  // non-Light heroes carried it as their sustain (Cinder, Crimson, Valor) —
  // all three now hold Mend Wounds, which is the same role at the same price.
  // The slate's own heals are Mend (singleAlly, which still resolves onto the
  // caster) and two bothAllies moves, so nothing is unreachable; what went away
  // is the price point, and a heal that needed no target declaration at all.
  // Mend Wounds (Spirit, heal 45, singleAlly, 16 mana) lived here until the
  // authored Spirit slate replaced it (2026-08-30), and it went the same way
  // Restore Vigor did one slate earlier — which is the point worth recording,
  // because it happened to the same three heroes twice.
  //
  // The seventeen authored Spirit moves contain NO heal-kind move and no
  // cleanse: every drop of Spirit healing is now Drain and Soul Rend, which
  // return a share of a hit, and Second Wind, which is a HoT. So the type that
  // reads as the game's healer can no longer put HP on an ALLY at all — only
  // on itself, and only by attacking. Designer call (2026-08-30), taken with
  // the consequence stated: Cinder, Crimson and Valor, who were moved onto
  // this move when Light killed Restore Vigor, lose their heal outright rather
  // than being repointed a second time onto Light's Mend at 25.
  //
  // What remains heal-kind anywhere: Water's Oasis and Wash Away, Light's
  // Mend, Consecrate and Divine Grace, Mind's Dopamine. The cheapest is now
  // Mend at 25, up from 16.

  // --- Buff / debuff (flat stat deltas — CLAUDE.md "flat additive integers, multiples of 5 or 10") ---
  // Fortify (Iron, +10 Defense / +10 Wisdom, self, 10 mana) lived here until
  // the authored Iron slate replaced the type (2026-08-30), and it was the
  // largest single deletion any slate has made: NINE starting kits carried it
  // (Cinder, Cube, Sentinel, Hollowbark, Aegis, Warden, Valor, Clockwork,
  // Bellows) across seven types, plus two level-up pools.
  //
  // The designer re-authored it into the slate the same day, which is the
  // second time reporting a deleted capability has produced better content
  // than patching around it would have (Fire's Stoke the Flames was the
  // first). It now lives in the Iron block above at 15 mana for +15 Defense.
  //
  // The half that stayed deleted is the one worth remembering: the fixture
  // move granted WISDOM as well, and the re-authored one does not. Mind still
  // grants Wisdom three ways (Brain Ward, Stasis, Mental Fortress), so the
  // stat is not unreachable — but all three are Mind, so a physical hero's
  // only route to magical defense is now equipment, relics, Evolution, or a
  // Mind partner. See docs/authoring-moves.md §10 (Iron).
  //
  // Rally (Beast, +10 Attack, both allies, 12 mana) lived here until the
  // authored Beast slate (2026-08-30). It survives BY ID, re-authored up in
  // the Beast block at the table's price — 25 mana for +20 Attack, so both
  // halves doubled. That is the second-widest re-pricing any slate has done
  // after Spirit's Second Wind, and for the same reason: SIX non-Beast
  // starting kits carry it (Tempest, Voltaic, Scallywag, Mordrax, Valor,
  // Gallant) plus Crag's and Sentinel's pools, so eight heroes with nothing
  // to do with Beast had their buff slot re-priced by a Beast decision. It is
  // still the game's cheapest side-wide Attack buff; it is no longer a
  // 12-mana one. See docs/authoring-moves.md §10 (Beast).
  //
  // War Horn (Beast, +10 Attack/Defense/Speed, both allies, 24 mana) went
  // with it and does NOT survive. It was Goblin Chief's signature and the
  // only move in the game granting three stats at once; the slate's
  // equivalent is Pack Leader, at 100 mana for two stats at five times the
  // magnitude, which is not the same move and is not meant to be. The Chief
  // is re-kitted onto the slate's own rows (src/data/enemies.ts).

  // --- Status moves (docs/conditions.md) — one per status, plus Cleanse ---
  // Bleed's dedicated fixture carrier (rendingClaw — Beast, 35 BP + guaranteed
  // Bleed at 12 mana) went when the authored Beast slate landed (2026-08-30),
  // and this is the last of the per-status fixture carriers to go: every one
  // of the nine statuses is now planted by authored content only.
  //
  // The slate replaces it five times over (Claw at 20%, Lacerate, Toxic
  // Fangs, and two more rows that CASH the mark rather than plant it), so the
  // vector needed no patching — but the cheapest Bleed in the game went from
  // 12 mana to 20, and the cheapest GUARANTEED one from 12 to 35. It was also
  // Rime's off-type Bleed row, which is repointed onto the slate's own Claw
  // (src/data/progression.ts) since Rime is one of the three heroes that can
  // graft Beast.
  // Daze's dedicated fixture carrier (stunningBlow — Iron, 25 BP + guaranteed
  // Daze at 20 mana) went the way Burn's, Freeze's, Conduct's, Haunt's and
  // Renew's did, when the authored Iron slate landed (2026-08-30). Unlike
  // those, the replacement is not in the slate that deleted it: Iron authors
  // no Daze at all. Light carries the status six times over (Glimmer, Blind,
  // Holy Beam, Blinding Flash, Deity Blade, Judgment), so the vector needed no
  // patching — but the status is now entirely Light's, and the cheapest way
  // to Daze anything went from 20 mana to Blind at 25.
  //
  // It was also the off-type physical slot in two kits (Pincer, Warden) and
  // five level-up pools; all seven are repointed onto Iron's own rows.
  // Haunt's and Renew's fixture carriers both lived here (spectralBind, 30 BP
  // at 12 mana; secondWind, Renew 20 at 15) until the authored Spirit slate
  // (2026-08-30). Haunt is now planted three ways up in the Spirit block —
  // Wisp chanced, Torment and Poltergeist outright — and Second Wind survives
  // by id at the slate's price, Renew 30 for 30. That re-pricing is the one
  // consequence worth knowing about here: six NON-Spirit starting kits carry
  // Second Wind as their sustain slot, so a move that cost 15 all game now
  // costs 30 for all of them (docs/authoring-moves.md §10, Spirit).
  // Cleanse's dedicated fixture carrier (purify — Light, heal 10 + cleanse-ALL,
  // 16 mana) went the same way when Light was authored (2026-08-30). The slate
  // re-authors the id as a pure cleanse at 20, but with `cleanseCount: 1`, so
  // NO move in the game strips more than one status any more — the unlimited
  // path is engine-only now (statusEngine.ts cleanseStatuses with no cap, still
  // pinned by test/waterMoves.test.ts). If a future relic or move wants
  // cleanse-all back, the engine is ready for it.

  // --- Field Effect moves (docs/field-effects.md) -------------------------
  // What is LEFT of a block that used to hold one setter per effect. Three of
  // the five have since been folded into their type's authored slate, which is
  // the better shape — the field is a rider on a cast you wanted anyway rather
  // than a turn spent on nothing:
  //
  //   - Verdant Earth (Nature, 2026-08-30) sets from Magic Growth and Force of
  //     Nature; the standalone setter was deleted and its `overgrowth` id
  //     reused by the slate's Renew 100 buff.
  //   - Sanctuary (Light, 2026-08-30) sets from Consecrate, which is now a
  //     45-mana bothAllies heal that turns the ground on the way past.
  //   - Magical Surge (Arcane, 2026-08-30) sets from TWO of the Arcane slate's
  //     own moves — Mana Font and Magic Cloak, both in the Arcane section
  //     above — and `arcaneSurge`, the standalone setter that used to live
  //     here, was deleted outright rather than having its id reused.
  // Stasis Bubble's standalone 20-mana setter used to sit here. The authored
  // Mind slate (2026-08-30) replaced it with `stasis` in the Mind section
  // above — 45 mana, and it buffs the caster's Intelligence and Wisdom on the
  // way past. Same trade Nature, Light and Arcane all made; the effect still
  // has exactly one setter, it is just no longer a bare one.
  // Sanctuary's standalone 20-mana setter used to sit here; the authored Light
  // slate (2026-08-30) reused its `consecrate` id for a 45-mana bothAllies HEAL
  // that also turns the ground — the same trade Nature made with Verdant Earth.
  // The effect still has exactly one setter, it is just no longer a bare one.
};
