# equipment.md

The item system, reworked 2026-09-07 per user direction. Supersedes the catalog design in
`progression.md` "Items (per-hero)"; the SLOT rules, the stash, and the act-scaled drop curve
in that document are unchanged and still authoritative.

The complaint this answers, in the user's words: the equipment system "doesn't feel satisfying
or interesting and is overall cumbersome to deal with." Two earlier passes attacked the symptom
— uncategorised slots (2026-09-06) removed the bookkeeping question, the rarity budget pass
(2026-09-06) made an individual item bigger. Neither touched the actual cause: **a catalog of
106 unrelated names, none of which the player ever learns.** An item you cannot recognise on
sight is an item you cannot want.

---

## 1. The three axes

**An item is a Family, a Tier, and optionally an Enchantment.** Nothing else.

| Axis | Count | Decides | Changed by |
|---|---|---|---|
| **Family** | 16 | stat shape + signature passive | finding one |
| **Tier** | 5 | how much of everything | the **Anvil**, or a **merge** |
| **Enchantment** | 14 | which element it feeds | the **Enchanter** |

Three orthogonal, individually legible questions. "Is a Spear right for this hero?" is a
different question from "is Epic enough?" is a different question from "does Blazing help
Cinder?" — and each has its own reward node answering it.

### What this deletes

The old catalog was 106 ids: 28 hand-authored Act-1 commons, **42 generated per-type pieces**
(3 each x 14 non-Ancient types), and 36 signatures. Forty-two of those hundred-and-six existed
for one reason — to attach an Elemental Force of some type to something holdable.

**Elemental Force stops being an item and becomes the enchantment.** That single reframe
deletes all 42, hands the enchantment system its entire content set for free, and — because
Force is flat Base Power on moves matching its type (`resolveElementalForceBonus`,
`damagePipeline.ts`) — makes every Enchanter node a question *about the hero holding the item*.
Binding Embers to Cinder's blade is a read. Binding it to Cortex is a wasted node.

16 families x 5 tiers = 80 base items, x 14 enchantments on top. The player reads two words and
knows both axes the name carries: **"Blazing Spear"** — a Spear, bound to Fire. The tier is the
box colour and its pip count (§8).

---

## 2. Families

Each family is a stat signature plus one signature passive, its **Awakening**, which comes
online at Epic. Below Epic a family is stats only — a plain, legible Common is what an Act-1
item should be, and that has not changed (`EFFECT_FLOOR_MIN_RARITY`).

Every Awakening is **flat** — one magnitude, the same at Epic, Legendary and Mythic (§3).

| # | Family | Stats | Awakening | Magnitude | Fires on |
|---|---|---|---|---|---|
| 1 | Sword | Attack | Sunder * | target -10 Defense | landing a hit |
| 2 | Dagger | Attack + Speed | Bloodthirst * | heal 15% of damage dealt | landing a hit |
| 3 | Greataxe | Attack + HP | Vengeful Emblem * | +5 Attack | taking a hit |
| 4 | Spear | Attack + Defense | *Impale* | Poison 5 | landing a hit |
| 5 | Bow | Attack + Wisdom | *Marksman* | **unset** — bonus damage % | always |
| 6 | Staff | Intelligence | *Overchannel* | 10 Mana, past the pool | landing a hit |
| 7 | Wand | Intelligence + Speed | Quickening * | +10 Speed | entry |
| 8 | Tome | Intelligence + Wisdom | Purifying Ward * | sheds every negative status | entry |
| 9 | Orb | Intelligence + Mana | Arcane Reservoir * | 30 Mana, past the pool | entry |
| 10 | Plate | Defense + HP | Warden's Vigil * | heal 10% of damage taken | taking a hit |
| 11 | Shield | Defense | Second Skin * | +5 Defense, +5 Wisdom | taking a hit |
| 12 | Leathers | Defense + Speed | *Barbs* | **unset** — Poison on both enemies | taking a hit |
| 13 | Robe | Wisdom + Mana | *Mana Ward* | Mana equal to 15% of damage taken | taking a hit |
| 14 | Boots | Speed | Quickening * | +10 Speed | entry |
| 15 | Ring | Mana + MP Regen | *Attunement* | partner gains 20 Mana, past the pool | entry |
| 16 | Crest | all five combat stats | Rallying Standard * | partner +10 Attack, +10 Intelligence | entry |

Two magnitudes are **unset**, not defaulted — Marksman's percentage and Barbs' Poison are
decisions nobody has made, and a placeholder would launder one into a number that looks
authored.

`*` = exists in `PASSIVE_ITEM_COST` today, already flat and already the right shape. Italics =
still to author — **six**, not the eight an earlier draft assumed: Warden's Vigil and Quickening
both found homes once the vocabulary audit below ruled out the designs that needed engine work.

Quickening appears twice (Wand and Boots). Two families may share an Awakening where the stat
signature makes it read differently; a 16-family catalog does not owe 16 distinct passives.

### The inherited magnitudes owe a balance pass

Flat pricing at 20 flattens a table that used to range 30-50, so ten passives that were priced
against each other no longer are. Vengeful Emblem cost 50 and Purifying Ward 30; they now cost
the same. Arcane Reservoir's 30 Mana and Attunement's 20 are likewise no longer separated by
their price. Nothing here is broken — the point values were always a legibility tool over
untuned numbers — but the magnitudes in the table above were set under the old prices and
should be swept once before playtest.

### Three things the vocabulary cannot express

Named because each killed a design that read well on paper, and each would be a reasonable
engine extension later — but not one to make casually, since content is data and the whole
point is that a family needs no bespoke logic.

- **No damage-category condition.** `PassiveDamageModifier` is evaluated per hit against
  `{ moveType }` alone (`passiveEngine.ts` `TriggerContext`). "Bonus damage with physical moves"
  is not sayable, so Marksman is untyped and unconditional instead.
- **No counter-attack.** There is no `damage` effect primitive, and a target-role `DamageDealt`
  cannot reach its attacker — `triggerTarget` is documented as "the defender of a DamageDealt"
  whatever the condition read. A true Riposte is impossible; Barbs is the reachable substitute,
  hitting `activeEnemies` instead.
- **Bleed cannot scale.** It is `shape: 'boolean'` with a fixed 5% of max HP. The scalable
  damage-over-time statuses are **Poison** and **Burn**; the scalable heal-over-time is
  **Renew**. Impale and Barbs use Poison for that reason, not for flavour.

**The four type-flavoured passives retire from items** — Emberheart, Frostbrand, Shadowfang,
Stormcaller's Focus. Element is the enchantment axis now, and a Fire-locked passive on a Sword
would compete with a Blazing enchant for the same job. Emberheart survives as a relic; the
other three lose their only home and should be deleted or re-homed onto Evolutions.

**Naming (2026-09-07, per user direction).** An item's name is its family noun and nothing else:
a Sword is a **Sword** at every tier. An enchanted one takes the enchant as a prefix —
*Blazing Sword*.

A tier adjective was tried first (Iron / Steel / Etched / Hallowed / Godforged) on the reasoning
that two Swords in an eight-box bag need telling apart. It was dropped as overcomplication: the
UI already carries the distinction **twice**, in the rarity colour every item box is bordered
with and in the rarity label on every card, and a three-word name is a worse answer to "which
Sword is this?" than a purple border. It also took the *Runed* collision with the Arcane enchant
away with it.

What the name is FOR is the family and the element — the two axes no colour encodes.

---

## 3. The tier ladder, and the monotonicity rule

**A tier upgrade must never lower a number.** This is the load-bearing rule of the whole
rework: the Anvil, the merge and the drop curve all exist to move an item up the ladder, and
if the marquee moment (Rare -> Epic, where the family Awakens) hands the player a stat
*downgrade* to fund the passive, every upgrade reward reads as a bait-and-switch.

The old model could not satisfy it. Budget steps are +20 (`RARITY_BUDGET` 30/50/70/90/110) and
a granted passive is a flat lump of 30-50 (`PASSIVE_ITEM_COST`), so the tier where the passive
lands loses 10-30 stat points to pay for it.

**Fix (2026-09-07, per user direction): an Awakening is FLAT — the same magnitude at Epic,
Legendary and Mythic — and it is priced at a flat 20 points.** The tier buys stats; the family
buys the effect. Those are the two axes, and letting the tier also scale the effect was
conflating them.

`PASSIVE_ITEM_COST` therefore collapses from a per-passive table of 30/40/50 to the constant
**20**. With `RARITY_BUDGET` unchanged:

| Tier | Budget | Stats | Effect |
|---|---|---|---|
| Common | 30 | 30 | — |
| Rare | 50 | 50 | — |
| Epic | 70 | 50 | 20 |
| Legendary | 90 | 70 | 20 |
| Mythic | 110 | 90 | 20 |

Stats run 30 / 50 / 50 / 70 / 90 — monotone, and every tier spends its budget exactly. The one
flat step is Rare -> Epic, which is the step that gains the Awakening: the player is not being
shorted, they are being handed the thing the item is named for.

**`EFFECT_FLOOR_SHARE` becomes a flat `EFFECT_FLOOR` of 20 points from Epic up.** A share
requires the effect column to grow every tier, which a flat Awakening by definition does not.

**This deletes the only engine change the rework needed.** An earlier draft had passives taking
a per-item magnitude so an effect could scale with tier; flat Awakenings mean today's passives
are already the right shape, `grantsPassiveIds` stays a plain string array, and the whole
rework lives in content and run code. Uniques may carry two Awakenings (Aegis Eternal does):
Mythic 110 = 90 stats, or 70 stats + two 20-point passives.

The trade accepted here: above Epic, an upgrade improves the hero rather than the item. Epic is
where a family becomes itself and Legendary/Mythic are stat weight on top. That is legible, and
legible was the goal.

### Enchantment value

An enchant grants Force scaling with the item's tier: **5 / 10 / 15 / 20 / 25** (10 to 50
points, roughly a third on top at every tier). It scales with the item so enchanting a Mythic
is the biggest payoff, which is right — the Enchanter is a late-run venue.

**One enchant per item, maximum.** Without the cap a triple-enchanted Common outruns a Mythic
and the tier axis stops meaning anything. The cap is also what gives the Enchanter its teeth:
"overwrite the enchant you already have?" is a decision, "add another" is not.

Enchant budget is tracked **separately** from `RARITY_BUDGET` and does not count against it, so
`equipmentBudgetProblems` still audits the base item exactly as it does today.

---

## 4. Enchantments

Fourteen, one per type, **excluding Ancient** (per user direction). This matches the precedent
the generated type gear already set — `TYPES.filter((type) => type !== 'Ancient')`.

Fire **Blazing** · Water **Tidal** · Frost **Rimed** · Storm **Thundering** · Stone **Granite** ·
Nature **Verdant** · Light **Radiant** · Shadow **Umbral** · Arcane **Runed** · Mind **Psionic** ·
Spirit **Haunted** · Iron **Tempered** · Mech **Geared** · Beast **Feral**

Elemental only. No non-elemental "greater" enchant class — a second class would muddy what an
Enchanter node means, and the rule "an enchant is an element" is worth more than the variety.

These are the only adjectives an item name carries, so nothing can collide with them.

---

## 5. Acquiring and improving

Four paths, each with a distinct role. This is what keeps gold, luck and patience all live.

| Path | Costs | Gives you |
|---|---|---|
| **Drop** | nothing | a random item |
| **Shelf** (Guild Hall) | gold | one of 4 offered items |
| **Anvil** (Blacksmith service) | gold | +1 tier on an item you already own |
| **Merge** | a duplicate | +1 tier, free |

### The Anvil and the Enchanter are Blacksmith services

Both live at the **Blacksmith** node (2026-09-08, per user direction — they were at the Guild
Hall until then), repeatable and **unlimited so long as the player can pay**. The split is one
verb family per node: the Guild Hall trades in people and new gear, the Blacksmith works on
gear you already own, and it sells item slots alongside these two
(`docs/run-loop.md` "The Blacksmith"). There are no free Anvil or Enchanter map nodes — the
reward row's spike in this space is the `forgeReward` Forge, which grants a slot.

Prices, first-pass and untuned. The Anvil is deliberately **more expensive than buying that
tier outright** (150 gold buys a Mythic off the shelf; 275 lifts a Common to one). You are
paying to keep *this* item — its family, its Awakening, its enchant — not to acquire power
efficiently. Merging is the efficient route, and it is free.

| Anvil | Gold | | Enchant (or re-enchant) | Gold |
|---|---|---|---|---|
| Common -> Rare | 25 | | on a Common | 20 |
| Rare -> Epic | 45 | | on a Rare | 35 |
| Epic -> Legendary | 75 | | on an Epic | 55 |
| Legendary -> Mythic | 130 | | on a Legendary | 80 |
| | | | on a Mythic | 120 |

### Merging

**Two items of the same family and tier combine into one of the next tier, free.** This is what
turns the duplicate drops a 16-family catalog inevitably produces from the system's main
downside into its main upside.

- **Family and tier must match. Enchantments are ignored for eligibility** — if either input is
  enchanted, the player picks which enchant the result carries. An enchanted duplicate is
  therefore always good news, never a blocker.
- **The bag is where duplicates live.** `RunState.stash` already permits them; the one-copy rule
  is and remains **per hero**, not per run (`state.ts:77`). No rule changes.
- **Merging is free and needs no venue.** It should be available anywhere the bag is visible
  (Roster Management), and offered as a third verb on `ItemFoundScreen` — Equip / Keep / **Merge**
  / Sell — whenever the found item completes a pair. Gating a free, obvious action behind a node
  would reintroduce exactly the friction this rework removes.
- **Mythics cannot merge.** Two of them are dead weight and should be sold.
- **Drops are NOT weighted toward families the player already holds** (2026-09-07, per user
  direction). Weighting would make merging a reliable engine at the price of variety, and the
  variety is what a 16-family catalog is for. The player already steers toward a pair through
  every pick-1-of-X in the run — Item nodes, the Guild Hall shelf — which is the right place
  for that agency, because it is a *choice* rather than a hidden thumb on the die. If merges
  prove too rare in playtest, **the lever is a wider shelf, not a weighted roll**: a Shop node
  carrying a larger inventory gives the player more chances to complete a pair deliberately.

### The act window governs every path

`ACT_RARITY_WINDOW` currently caps what an act can *drop* — no Legendary in Act 1, no Mythic
before Act 3. With a purchasable Anvil, a rich Act-1 player would simply buy past it, and with
merging a lucky one would merge past it.

**The window caps the Anvil and the merge too.** One rule, four paths, and holding a pair of
Legendaries through Act 2 waiting for the window to open is anticipation rather than a bug.

### No gold printer

The Anvil is repeatable and unbounded, so **no path from gold back to gold may profit.** There
are two such paths, and both are inequalities a test should pin — not comments, because both
price tables are untuned and will move.

**1. Buy, Anvil, sell.** Requires, at every tier `n`:

> `buy(n) + anvil(n -> n+1) > 0.5 x buy(n+1)`

With `EQUIPMENT_PRICE_BY_RARITY` 15/30/55/90/150, `EQUIPMENT_SELL_SHARE` = 0.5 and the Anvil
table above, the tightest step clears by roughly 2.5x, and the full Common -> Mythic run costs
275 against a 75-gold sale. The upgrade never even recovers its own tier's price gap, which is
the intended relationship: the Anvil is a luxury for an item you are attached to.

**2. Buy two, merge, sell.** Merging is free, so this one is governed entirely by the shelf
prices. Requires:

> `buy(n+1) < 4 x buy(n)`

The current curve steps 2.0x / 1.83x / 1.64x / 1.67x — safe, but note this constrains
`EQUIPMENT_PRICE_BY_RARITY` on its own, independently of anything the Anvil does. **A future
pass that steepens the shelf curve past 4x per tier opens a printer even if the Anvil is
untouched.** That is the non-obvious one, and the reason both belong in a test.

---

## 6. Uniques

A handful survive — Worldbreaker, Guardian Plate, Aegis Eternal, Crown of the Ancients and a
couple more, roughly one per act, dropped by Guardians.

- **Mythic only**, and outside the family system. No family, no Awakening, no tier ladder.
- **Not upgradeable and not mergeable** — being Mythic already, both are moot rather than
  forbidden, so this needs no special-case rule.
- **Enchantable** (per user direction). Uniques sit outside two axes and inside the third.

They are the grail. Total flattening into families would buy consistency at the price of the
one item per run the player tells a story about.

---

## 7. Knock-on effects and open questions

- **`STASH_CAPACITY` 8 -> 10** (2026-09-07, per user direction). The bag does double duty now:
  carrying options for an unknown matchup *and* holding duplicates long enough to pair them.
  Merging partly self-solves — two slots become one — but the pair has to fit first. Ten is a
  small bump on purpose; the cap is still meant to force a discard decision.
- **Six passives to author** (§2 italics), each one flat, plus the two unset magnitudes.
- **Migration.** The catalog becomes generated the way the type gear already is; ids go
  composite (`sword.epic.blazing`); `SAVE_VERSION` bumps because every old id dies. Eight ids
  are pinned by tests and `App.tsx` — `ironBlade`, `guardianPlate`, `dagger`, `emberBand`,
  `arcaneFocus`, `oakenArmor`, `swiftBoots`, `vitalCharm` — and need remapping.
- **`CLAUDE.md` owes an edit at implementation time**, not before: the rarity-budget invariant
  names `EFFECT_FLOOR_SHARE` = 1/3, which becomes a flat `EFFECT_FLOOR` of 20 points, and
  `PASSIVE_ITEM_COST` collapses to the constant 20.
- **Untuned, all of it:** both price tables, the enchant Force ladder, the stash cap, and every
  inherited passive magnitude now that they all cost 20.

---

## 8. Manage Roster (2026-09-07, per user direction)

The screen where gear moves, reworked alongside the family system.

- **The squad is a 2x3 grid, not a list.** Six heroes read as a team at a glance, and each card
  gets its full width back for a slot row underneath the hero.
- **The bag sits at the bottom.** The roster is what the screen is about; the bag is the tray you
  draw from, and a tray belongs at the bottom of the reach.
- **`MAX_ITEM_SLOTS` = 3.** Three is what a half-width card seats on a 375px phone. The slot row
  is a 3-column grid of fluid squares rather than fixed boxes, so they size to the card — ~45px
  on mobile, ~53px on desktop — while the bag keeps full-size boxes, since that is where items
  are read and dragged from. Space for three is reserved whether the hero holds one or three.
- **Tapping a hero opens their sheet**; the whole identity block is the target, and the old "i"
  corner glyph is gone. Carrying an item, the same tap SEATS it — which is what makes the
  carry-and-place gesture usable on a phone, since the target becomes the card rather than a
  45px box. A full hero still makes the player name a slot: only they know what to give up.
- **Every move has its own cue** (`playSfx`, driven from the screen rather than the delegated
  `uiSfx` default, which the buttons opt out of with `data-sfx="none"` so nothing layers):

  | Action | Cue |
  |---|---|
  | Pick an item up | `ui.select` |
  | Put it down unchanged | `ui.back` |
  | Onto a hero — from the bag or another hero | `equip` |
  | Off a hero into the bag | `ui.move` |
  | Merge two items | `discovery` |
  | Open a hero sheet | `ui.tap` |

- **Item boxes are 48px with a tier pip band** (1 mark for Common through 5 for Mythic). The pip
  exists because item names dropped their tier adjective (§2): colour says two Swords differ, the
  count says which is better, and two same-family Swords that refuse to merge read as a bug
  otherwise. Hidden on the 22px compact variant in the equip-compare row, which prints the tier
  in words anyway.
