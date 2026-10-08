# Charges

**DECIDED in shape 2026-10-08, per user direction. Phase 1 (the engine) is IN, and Squall's Arrows
(the first refills, below) are IN. Phase 2 (the pips) is IN. Phase 3 is MEASURED. Phase 4 (the refill Boons) is IN. Phase 5's audit is DONE and Last Shot is IN.** A few moves carry a number of
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
- Out of a fight, a move row draws its pips full (`MoveButtonReplica`): the draft, the offer and the
  Tutor read a quiver's size the same way the fight does. The row's summary text no longer says it.

**Built (2026-10-08):** `ChargePips` (`src/view/shared/ChargePips.tsx`) draws slim upright cells in
pale gold, lit or hollow — not the field's dots, Mastery's squares or a stat change's triangles. A
spent row is `.is-spent`: dimmed with every unusable row, but its mana gem stays lit, since a spent
move is gated (`isMoveUsable`) rather than unaffordable. A refill flashes the relit cells once when
the command phase returns, read off that round's `ChargeRestored` events. The enemy dossier's move
list draws the live count, and the move detail page carries the pips beside its sentence. The
battle log names every refill.

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

## Rising Static: a refill on a move (BUILT 2026-10-08, per user direction)

Storm's Early buff lost its +20 Speed, which never mattered, and became the first MOVE that refills:
**both allies get one Charge back on every spent move** (`MoveDefinition.restoresCharges`, the same
`engine/combat/charges.ts` reader the passive uses), and it still marks one random enemy Conducting.
30 Mana, now aimed at `bothAllies` rather than a random ally. It sits in four starting kits (Squall,
Tempest, Kite, Raiju) and the Storm slate, so the Storm spawn carry it too. For Squall it is a quiver
top-up that costs a turn. For a kit with no Charges it is Conduct alone, so watch Tempest, Kite and
Raiju: Kite's Outpace read the Speed it gave.

## The refill Boons (phase 4, BUILT 2026-10-08)

Three of the refills above, shipped as **Boons** rather than on a hero, because neither the Barrier
holder (Thane) nor the Blind holder (Aurum) has been through the hero audit, and an innate is the
audit's call. A refill Boon joins the pool only while a roster hero holds a move it can refill
(`chargeBoonFits`, read off the card's own `restoreCharge`, so a new refill needs no table), the
type Boons' gate; the who-screen says how many of each hero's moves it would refill, or *nothing to
refill*.

| Boon | When | Gives back |
|---|---|---|
| **Riposte** | this hero's Barrier turns a move away (`MoveGuarded`, a new passive hook) | 1 Charge to its guard (`tags: ['guard']` on Barrier), twice a fight |
| **Grim Resolve** | this hero's partner is knocked out by a hit | 1 Charge to every move of this hero's with Charges |
| **Deep Breath** | this hero Rests | 1 Charge to every move of this hero's with Charges |

Reload is left out: it is Squall's Retrieve without the Arrow, and on Squall it would double his
innate. Hold the Line waits for a Shield move with Charges. Riposte's cap is there because one guard
can turn two moves away. Not simulated: the sim's Boon pick takes the card it values most, and a
refill Boon is rare enough per run that a batch would not see it.

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

## The audit (phase 5, 2026-10-08)

Every move in the game that guarantees a Daze or lays a guard or a redirect, read against the rule
**"a guaranteed lockout is limited by Charges"**:

- **Every player move that guarantees a Daze already holds Charges**: Blind, Feint and Pinning Shot
  (2) and Ink Blast (1). Daze is the game's only turn-denying status (Freeze halves Speed). Two
  others guarantee one and stay off Charges: **Perfect Creation** (Mech Late, 100 Mana, six statuses
  at once — its price already makes it a once-a-fight cast) and **Transfix** (Ancient, the Herald's,
  enemy-only, inside the finale's tuning).
- **The Provoke family holds 5 Charges** (2026-10-08, per user direction, REVERSING the recommendation
  below, which the user first agreed to): a large count, set to break the checkmate a tank, a Renew
  engine and a Provoke every round can build, not to ration the tank's job. Provoke, Bodyguard,
  Intercept and the three signatures (their rewired twins follow). Wall Strike is a 75 BP hit as well,
  so the count caps its damage too. Not simulated. The recommendation it reversed:
  **The Provoke family stays uncharged.** Provoke,
  Bodyguard, Intercept (the Class) and three signatures (Wall Strike, Roost Guard, Nevermore) are six
  moves and the whole tank archetype. A redirect is not a lockout: the enemy still acts, onto the
  tank, which pays for it in HP, and the redirect lasts the round it is cast. Charging it would cap
  the tank's one job at two rounds a fight. If a Provoke every round reads as a lock in play, the
  answer is the same cooldown question Barrier has, not a count.
- **Last Shot is BUILT** on Stormpiercer, Squall's Late Arrow: ×1.5 on its last Charge
  (`conditionalPower.requiresLastCharge`, read off the count as the cast began, so the engine, the
  forecast and the pilot agree; the fight row lights the bonus when one Charge is left). Not
  simulated: Stormpiercer was cast 282 times in 3000 runs.
- **Exhaust and Empty-handed are DEFERRED.** Exhaust strips an enemy's Charges, and today few enemy
  kits hold any (the Arcane spawn's Barrier, a hero-pool enemy's Blind), so it would be a dead card
  most fights; it waits for Charges to spread. Empty-handed wants a hero with several charged moves,
  and only Squall has that.

## Spreading Charges (BUILT 2026-10-08, per user direction)

Charges belong on an effect too strong to repeat, and **damage is an effect** (Storm Arrow is the
template): a Late-sized payload at an Early or Mid price, a few times a fight. Six moves carried it to
four more types, kept at the end of the catalog so no type's derived Evolution line moved, each in at
least two heroes' offers (pinned in `test/charges.test.ts`). Untagged ones join their type's slate,
so the Titanspawn field them too; the Arrow does not.

| Move | Type, tier | Payload | Mana | Charges | Offered to |
|---|---|---|---|---|---|
| Iron Arrow | Iron, Early | 50 BP, an Arrow (Squall's Retrieve reads it) | 15 | 3 | Scallywag, Ronin, Gallant, Squall, Whirr |
| Flashpoint | Fire, Mid | 50 BP and Engulfed (Burn 3) | 25 | 1 | Crimson, Tinder, Ashwing, Brimstone, Kitsu |
| Full Bloom | Nature, Mid | Renew 8 on one ally | 25 | 2 | Sylva, Lotus, Morel, Selkie, Hart |
| Rocket Pod | Mech, Mid | 55 BP on both foes | 25 | 3 | Rex, Whirr, Bellows, Clockwork |
| Repair Kit | Mech, Early | Heal 60 on one ally | 15 | 3 | Patch, Clockwork, Abacus, Warden, Bellows |
| Battery Pack | Mech, Mid | +40 Mana to one ally, past the pool | 10 | 2 | Patch, Abacus, Clockwork, Kite, Zenith |

**Widened the same day** (per user direction) by concept: Whirr's darts, Brimstone and Kitsu's
fire, Selkie and Hart's healing, Warden and Bellows's plate, Kite's support. **Zenith holds Battery
Pack on purpose**: a single-ally move can target its caster, and Surging Intellect turns the +40 Mana
into +40 Intelligence, twice a fight — a named combo, not an accident. The widening was not simulated.

**Measured** (3000 runs a side, seed 7, against `2c5df1aa`): full-clear 77.5 → 78.5% skilled, 28.3 →
28.3% chart, every act inside a point. Skilled-pilot casts: Rocket Pod 1834 (12.6 damage a Mana, Mech's
best), Flashpoint 860 (29% of its damage from the Burn), Repair Kit 767, Iron Arrow 648 (13.5 damage a
Mana, the Arrow family's top), Battery Pack 159, **Full Bloom 4** — the skilled pilot reaches for
Regrowth (Renew 3 on both, 20 Mana) instead; the chart pilot cast it 105 times. None of the six is in
the enemy side's top 40 by knockouts. Full Bloom is the one to watch: a Renew 8 on one body may simply
lose to a Renew 3 on two.

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
2. **View.** IN. Pips on the move tile, the enemy's pips wherever its moves are read, the overlay
   sentence, and the greyed state's distinct reading.
3. **Measure.** DONE (above). Barrier, Blind and Feint cast counts before and after, full-clear skilled and chart,
   and the AI's spend round. If a charged move is now cast less than it was, lower its mana cost.
4. **Refills.** IN (below). A `restoreCharge` passive effect and an event (`ChargeRestored`) for the view to flash.
   Author two or three of the refills above, on Barrier's and Blind's holders first.
5. **The audit.** DONE (below). Candidates move onto Charges one by one, and the Charge-reading moves are authored.

## Measured (phase 3, 2026-10-08)

3000 runs a side, seed 7, against `a862ffc0` (the commit before Charges), both sides flying the same
pilots. Two pilot fixes went in first and into the baseline too: the skilled pilot (`src/run/pilot.ts`)
never asked `isMoveUsable`, so it chose a spent move and lost the turn (a live bug for the Trials and
the late Gauntlet, whose enemy it flies); and it priced a Charge refill at nothing, so it never cast
Rising Static (now half a round of the receiver's output a Charge, `CHARGE_VALUE_ROUNDS`). The sim
report gained a per-hero `rest%`.

| | skilled base → Charges | chart base → Charges |
|---|---|---|
| Full-clear | 77.3 → 77.4% | 27.7 → 28.7% |
| Barrier casts | 485 → 532 | 1368 → 1438 |
| Blind casts | 512 → 519 | 510 → 549 |
| Feint casts | 2937 → 2310 | 1675 → 1537 |
| Squall DPR | 125.7 → 136.0 | 98.5 → 106.5 |
| Squall win% / die% | 98.2 / 12.4 → 98.4 / 12.9 | 92.4 / 23.3 → 92.9 / 24.4 |
| Squall rest% | 1.1 → 1.0% | 1.9 → 1.4% |
| Rising Static casts | 94 → 30 | 826 → 780 |

Read: **the cap is neutral on the run** — every act inside a point. Barrier and Blind are cast as
often as before: the old third cast at 65 was rarely paid, so two Charges is the same ceiling, now
legible. **Feint is the one the cap bites** (−21% skilled), a Class move cast every fight that the
skilled pilot used to fire three times and more. **Squall does not run dry**: his Rest rate went down
and his damage up 8%; Storm Arrow is his most-cast move (5375) and third in the catalogue on damage per
mana (12.1, behind Zap and Snow Blast), held there by its four Charges. **Rising Static is a weak
card** for the skilled pilot (a third of its old casts): Conduct on a random foe plus a refill only a
charged kit can use. Tempest, Kite and Raiju are not in the default deck and were not measured; a
`SIM_ALL_HEROES` pass would. The mana costs of Barrier, Blind and Feint stay where they are (phase
3's rule was "lower it if it is now cast less", and only Feint is, by design).

## Open

- **Protect's back-to-back problem.** Two Charges still allow guard, attack, guard. If a guard on
  consecutive rounds is the real issue, a "not two rounds running" cooldown is a second gate.
  `isMoveUsable` can hold it beside Charges. Decide after phase 3 shows how Barrier is actually cast.
- **Do charged moves get cheaper?** Measured in phase 3: no.
- **The Provoke family** (above): 5 Charges, per user direction.
- **A Charge consumable** (an "Ether", a fourth purse kind) is held back. It is a free action, and
  one a fight is effectively a count raised by one on every charged move.

## Reverses

- "A guaranteed lockout is priced by the fight, not the cast … Feint, Blind and Barrier carry
  `manaCostGainOnUse` = 20" (CLAUDE.md, Combat math). The lockout is now limited by Charges.
- "Not spam-proofed by a consecutive-use rule — mana is the balance lever" (Barrier's comment,
  `src/data/moves.ts`). Only the second half stands, and only for moves without Charges.
- `oncePerFight` on a move is folded into Charges. `oncePerFight` on a **passive's** reaction is a
  different field and stays.
