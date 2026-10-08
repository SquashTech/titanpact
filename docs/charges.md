# Charges

**DECIDED in shape 2026-10-08, per user direction. Phase 1 (the engine) is IN, and Squall's Arrows
(the first refills, below) are IN.** A few moves carry a number of
**Charges** a fight. Each cast spends one. With none left, the move can't be used for the rest of the
fight. This replaces the rising mana cost (`manaCostGainOnUse`) as the way a lockout is kept from
being spammed, and it generalizes the existing `oncePerFight` gate, which becomes one Charge.

Decided: Charges belong to the **hero** and stay spent through a switch. They are drawn as **pips**,
never as a fraction. Reactive refills are the design space worth opening. Every count below is a first
pass for playtest.

## Why

The rising cost (Blind, Barrier and Feint, +20 a cast) tried to price a lockout by the fight rather
than by the cast. It leaks in three ways.

- **Mana can buy it out.** Overflow is uncapped and never decays, and the Mana Well, the Wellspring,
  regen gear and the Arcane grants all feed the pool. A mana-rich hero pays the surcharge and casts
  again, so the cap is weakest on the heroes it most needs to hold.
- **It is a hidden ledger.** "25, then 45, then 65" has to be remembered. Three pips do not.
- **It makes one number do two jobs.** A lockout's price had to answer both "is one cast worth it?"
  and "how often may it be cast?". With Charges, mana answers only the first.

Mana cost stays the primary balance lever on every reliable move that holds no Charges.

## The rule

- `MoveDefinition.chargesPerFight?: number`, an integer of 1 or more. The code name is deliberately
  not `charges`, because `StatusDefinition.charges` is Renew's count of heals. The player-facing word
  is **Charges**.
- A move with no `chargesPerFight` is unlimited, as now.
- **A fight opens with every Charge full.** Nothing carries between fights.
- **A cast spends one when it resolves**, in the same place mana is paid. A move that fizzles before
  paying mana (`moveUnavailable`, `noValidTarget`) spends none. A move that is cast and blocked,
  Barrier'd or Daze'd mid-round spent its Charge if it spent its mana.
- **At zero, the move is unusable** through `isMoveUsable`, the one gate the engine, the AI and the
  view already read. That is the same path `oncePerFight` takes today.
- **Charges belong to the combatant, keyed by move id.** They stay spent through a switch. The bench
  doesn't refill them, Rest doesn't refill them, and switching in doesn't refill them. Stat
  modifiers already persist through a switch for the same reason: otherwise a pivot would be a
  refill. If a move leaves and returns through Motley's Trick, it comes back with the count it left
  with.
- **Mana is still paid.** A charged move keeps a mana cost. Whether that cost comes down now that it
  no longer limits frequency is a dial (see below), not part of the rule.
- **Both sides follow the rule.** An enemy's Barrier runs out the way the player's does.

`oncePerFight: true` becomes `chargesPerFight: 1`, and `Combatant.spentMoveIds` becomes a per-move
count of Charges spent (`Combatant.chargesSpent`). `manaCostGainOnUse` is deleted once its three
holders have moved off it. `manaDiscountOnUse` (Wave Shred's ramp) is a different verb and stays.

## Display: pips

Charges are drawn as **pips on the move tile**, never as "2/2".

- One pip a Charge, in a short row on the tile's edge. A full pip is a Charge left and a hollow pip is
  a spent one. This follows the field effect's round pips (`field-effect-pip` / `.spent`) so the
  combat screen keeps one visual language for "how many are left".
- When the last pip is spent, the tile greys out the way an unaffordable move does. The reason must
  read differently from "can't afford", or the player will try to Rest for a move that Rest can't
  bring back. The hollow row says it without a word.
- A refill lights a pip again with a brief flash on the beat its event lands. This is the view
  reading an event, never engine timing.
- The move's detail overlay says it in a sentence: *"2 Charges a fight. Spent Charges stay spent
  through a switch."* This replaces "Costs 20 more each use".
- **The enemy's pips are visible.** Wherever an enemy's moves are read (the scouted chip, the dossier,
  the target picker's detail), its charged moves show their pips. "Their Barrier is spent" is
  counterplay the player must be able to see.
- Charges are a fight-only state, so no out-of-fight screen draws them except as the overlay's
  sentence.

The pip art (shape and colour) is open. It should not read as a Mastery pip or a stat-modifier pip.

## First holders

| Move | Holder | Today | Charges |
|---|---|---|---|
| Barrier | Arcane, Early | 25, +20 a cast | **2** |
| Blind | Light, Early | 25, +20 a cast | **2** |
| Feint | Class | 30, +20 a cast | **2** |
| Ink Blast | Nautilus signature | once a fight, first turn, all Mana | **1** (unchanged in effect) |

Two Charges is the old surcharge's practical ceiling: the third cast at 65 was seldom paid. Each
count is a dial.

## Reactive refills

The design space this opens. A refill is a passive effect, `restoreCharge`, aimed at one charged move
or at all of them, firing off a hook the passive engine already has. Two rules come with it.

1. **A refill restores, it never grants.** It refills a spent pip and never exceeds the move's
   count, the potions' rule. A raised count is a different verb (below) and much rarer.
2. **No refill on switching in, on the bench, or every round.** Each is a Charge on a timer, and that
   is the spam this rule exists to stop. `test/` should pin that no `restoreCharge` sits on
   `SwitchedIn` or on a bare round-end hook.

Refills worth trying (names are placeholders, none is authored):

- **Riposte.** When your Barrier turns a move away, its Charge comes back. A correct read pays for
  the next one, and a wasted guard does not.
- **Second Wind.** When an ally is KO'd, restore one Charge of each of your charged moves. This is the
  comeback lever, and it lands as lock-in approaches.
- **Reload.** When this hero lands a KO, restore one Charge.
- **Deep Breath.** Resting restores one Charge as well as the Mana. This makes Rest a decision for a
  hero that isn't out of mana.
- **Hold the Line.** When your Shield breaks, restore one Charge of a guard move.

Each needs a `maxFiresPerFight` cap if a sim run shows it looping. This is the same instrument as
Force: limit the procs, never cap the resource.

## Squall's Arrows (BUILT 2026-10-08, per user direction)

The first holder of the refill verbs. **Arrow is a move TAG, never a type** (`MoveDefinition.tags`,
`MoveTag = 'arrow'`): a family a passive can read, kept out of the Storm slate (`spawnSlate` skips a
tagged move), so no graft line, spawn or other hero draws one. Squall's alone.

| Arrow | Band | Power | Mana | Charges |
|---|---|---|---|---|
| Storm Arrow | Early, **starting kit** (replaces Thunderclap, now in his Early pool) | 50 | 15 | 4 |
| Pinning Shot | Mid, a guaranteed Daze | 55 | 30 | 2 |
| Stormpiercer | Late | 105 | 55 | 2 |

Strong for their price, held by the quiver. **Slipstream is dropped** (the Storm audit's decision
of the same day reversed): his innate is **Retrieve**, *an Arrow that knocks a foe out gets its
Charge back*, and his mastered innate is **Retrieve+**, that Arrow gets 2 back and **Restock**, *a
Rest refills every Arrow* (`alsoReactive` on `Rested`; the card keeps the innate's name with a +,
as every mastered innate does). Engine: a `moveTag` trigger condition, a `restoreCharge` passive
effect (`triggeringMove` or `moveTag`, an amount or `'all'`, never past the count), a
`ChargeRestored` event; `resolvePassiveReactions` now takes the move catalog. Every figure is a first
pass. What to watch: Squall out of Arrows in a long fight with only Rising Static, before his first
offers land.

## Raised counts (rarer than refills)

`+1 Charge to this hero's charged moves`, a raised maximum, drawn as one more pip. It is a bare
number, but like the mana exception it changes what a hero can do, visibly. It belongs on an
**innate or an Evolution passive**, never a Boon, a Banner or gear. It is a hero's identity, not a
shelf item. Start with none.

## Moves that read Charges

A second wave, once the first holders have been played:

- **Exhaust.** A hit that spends one Charge of each of the target's charged moves. This answers an
  enemy's Barrier directly.
- **Last Shot.** A charged move whose final Charge hits harder or does more ("on its last Charge…").
  A count with a climax.
- **Empty-handed.** A hit that grows with how many of the user's own charged moves are spent. It pays
  a hero that has burned its tools.
- **Charge-gated power.** A strong move made fair by one or two Charges instead of a punishing price.
  This is the main thing the verb is for beyond lockouts.

## Candidates to audit

Moves where frequency is the problem and price is a poor answer. These are for the hero audit to
decide one by one; none is decided here.

- **Provoke** (Stone, Early, 25, priority 1) and **Bodyguard** (Mid, 35): a redirect every round
  is the same lock-shaped problem Barrier had.
- **Transfix** (Mid, 40, a guaranteed Daze on a hit): Blind's twin with damage attached.
- **The guaranteed-Daze signatures** and the double flinch.
- **Mana-grant moves**, if a grant into overflow ever loops with a mana-priced lockout. Charges
  make that loop harmless, which is a reason to move the lockout, not the grant.
- **Field setters**, as an alternative to the locked no-refresh rule. Probably no: the rule already
  bounds them.

The hero audit sheet could carry a Charges column so the decision is made as each type is reached.

## The AI

`isMoveUsable` already keeps a spent move out of the enemy's options, so the AI is correct on day
one. It may still be wasteful: an AI that treats Charges as free will spend them in round 1. The
first build should measure that before teaching the AI to save them. A sim pass that counts in which
round enemy Charges are spent will tell.

## Phases

1. **Engine.** `chargesPerFight`, `Combatant.chargesSpent`, `isMoveUsable` reads it, the spend at
   mana payment, `oncePerFight` migrated, `manaCostGainOnUse` deleted with its three holders moved to
   Charges. Tests: a switch keeps the count, Rest doesn't refill it, a fizzle spends nothing, and
   both sides are capped.
2. **View.** Pips on the move tile, the enemy's pips wherever its moves are read, the overlay
   sentence, and the greyed state's distinct reading.
3. **Measure.** Barrier, Blind and Feint cast counts before and after, full-clear skilled and chart,
   and the AI's spend round. If a charged move is now cast less than it was, lower its mana cost.
4. **Refills.** A `restoreCharge` passive effect and an event (`ChargeRestored`) for the view to flash.
   Author two or three of the refills above, on Barrier's and Blind's holders first.
5. **The audit.** Candidates move onto Charges one by one, and the Charge-reading moves are authored.

## Open

- **Protect's back-to-back problem.** Two Charges still allow guard, attack, guard. If a guard on
  consecutive rounds is the real issue, a "not two rounds running" cooldown is a second gate.
  `isMoveUsable` can hold it beside Charges. Decide after phase 3 shows how Barrier is actually cast.
- **Do charged moves get cheaper?** Measured in phase 3, not assumed.
- **A Charge consumable** (an "Ether", a fourth purse kind) is held back. It is a free action, and
  one a fight is effectively a count raised by one on every charged move.
- **The pip art.**

## Reverses

- "A guaranteed lockout is priced by the fight, not the cast … Feint, Blind and Barrier carry
  `manaCostGainOnUse` = 20" (CLAUDE.md, Combat math). The lockout is now limited by Charges.
- "Not spam-proofed by a consecutive-use rule — mana is the balance lever" (Barrier's comment,
  `src/data/moves.ts`). Only the second half stands, and only for moves without Charges.
- `oncePerFight` on a move is folded into Charges. `oncePerFight` on a **passive's** reaction is a
  different field and stays.
