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
- **Merging is free and needs no venue.** It lives anywhere the bag is visible (Roster
  Management). Gating a free, obvious action behind a node would reintroduce exactly the
  friction this rework removes. It was also to be a third verb on `ItemFoundScreen` — Equip /
  Keep / **Merge** / Sell — which 2026-09-08 made moot: found items go straight to the bag, so
  a pair is completed *in* the place merging already happens.
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

- **`STASH_CAPACITY` 8 -> 10** (2026-09-07, per user direction), then **gone** (2026-09-08 —
  `docs/progression.md` "The uncapped bag"). The bump was because the bag does double duty:
  carrying options for an unknown matchup *and* holding duplicates long enough to pair them.
  Removing the cap outright settles the second job for good — a pair never fails to fit.
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

## 9. The gear board as pieces (2026-09-10, per user direction)

The second pass over Manage Roster. §8 made it *legible*; this makes it a thing you handle. Four
changes, and the fourth is the one the other three were clearing room for.

### 9.1 The carry is pointer-driven, and therefore exists

The board was on HTML5 drag-and-drop — `draggable`, `dragstart`, `dataTransfer`. **None of that
fires from a finger.** On the device this game is played on, "or drag it" had never worked; gear
could only ever be tapped from box to box, and the drag half of the affordance was a desktop
convenience nobody would see.

`useGearDrag` (`src/view/shared/useGearDrag.tsx`) replaces it with pointer events, one gesture on
both. Three readings share one `pointerdown`, separated by what happens next:

| What follows | What it was |
|---|---|
| release without moving | a TAP — select, or place what is held |
| ~500ms without moving | the long-press readout (`useLongPress` still owns it) |
| movement past 7px | a CARRY, and the other two are cancelled |

7px is deliberately under `useLongPress`'s 12px cancel, so a carry never also fires a hold.

Two mechanics worth knowing before touching it:

- **Hit-testing is `elementFromPoint` against a `data-gear-slot` attribute**, not per-slot pointer
  events. The carried piece sits under the finger and would eat every one of them.
- **The listeners are on `window`**, not the box. A real carry leaves the 46px box within its first
  few pixels, and a captured pointer on the box still could not say what is *underneath* it.

The whole hero CARD is a landing pad (`HeroSlotCard`'s `dropKey`, the slot ref `hero:<id>:-1`), not
only its sockets — a 46px socket under a moving thumb is a smaller target than the thing it sits on.
Dropping on a full hero raises the swap window exactly as tapping one does.

### 9.2 A piece and a socket, not a filled box and an empty box

`ItemPiece` splits out of `ItemBox`. That split is what lets the *same object* be drawn under the
finger while it is carried, which is the whole of "gear is a game piece rather than a table cell".

- **The piece** is a cut chit: a 7px corner bevel (`clip-path`), a body gradient mixing the tier
  colour into a light slate, a lit top-left facet, a rim that is bright above and tier-dark below,
  and its own cast shadow. Its silhouette is **stamped** — dark ink with a 1px light edge under it —
  and its tier pips run **light**, because they sit on the piece's darkest band. Reversing either
  makes a Common illegible, that being the palest body in the set.
- **The socket** is a hole: sunken, with four corner L-cuts (a masked border) instead of the dashed
  rectangle it used to wear, which read as a disabled form field.
- **The mount** (`.equip-mount`) is the rig those sockets are set into — a recessed strip with
  bracket corners in the hero's type colour, which lights when the hero is a live destination.

> **Trap, and it costs an hour if you hit it.** `--surface` is not a defined token and
> `--surface-raised` / `--surface-sunken` / `--selected-fill` are **gradients**. A `color-mix()`
> against any of them is invalid, which invalidates the whole `background` declaration *silently* —
> the element renders transparent and merely looks dark. Mix against `--panel`, `--panel-alt`,
> `--well` or a literal.
>
> **Second trap.** `--item-box-size` and `--item-box-pip` are declared on `.item-box`. Anywhere a
> piece is drawn loose — the carry overlay, the merge burst, the header readout — they must be
> re-declared, or the silhouette silently drops to inherited font-size and the pips to zero width.

### 9.3 The Banners left this screen for the map

They were a rail across the top of the Roster sheet, showing all five held or not. That was so
spread-vs-commit would be visible from act 1 — but the decision is taken on the Guardian's own
1-of-5 screen, which shows all five anyway, so the rail was charging the gear screen its entire
first fold to restate a choice already made.

They now fly along the **bottom-right of the map well** (`BannerShelf.tsx`), opposite the location
placard and level with it: what the place is on the left, what the run has taken on the right. The
reading inverts with the move — only what is HELD, folded with its count, in the order the run won
it. An act-1 run flies nothing, which is correct.

No entrance animation, for the same reason `.map-atmosphere .location-horizon` has none: the map is
re-entered after every single node, and a standard that unfurls each time reads as a transition
rather than as something already planted. The cloth's own sway still runs, staggered per pole.

The ~130px that freed does **not** go to the carried item's readout. That readout is now the panel
HEADER's own text (`.roster-held` — piece, name, effect chips), a swap in place rather than a block
appearing, so nothing moves when a piece is lifted. The board centres in what is left; stretching
the cards into it was tried and is worse, being six cards with a hole in the middle of each.

### 9.4 Merging says so before, during and after

Three states, one mark (`MergeMark` — two solid heads closing on a spark; chevrons were tried and a
pair of them at 9px is an ✗, which is the one thing the mark must never say on a screen whose other
corner badge means "unopened").

1. **At rest.** `mergeablePairIndices` (`run/equipment.ts`) marks every bag slot with a partner, and
   each wears the badge in the tier the merge would REACH. The bag header carries the pair count.
   Merging used to announce itself only once an item was already in hand — so a bag holding a free
   Epic looked exactly like a bag that did not.
2. **On the map, before the screen is opened.** The footer button is an inbox and already changes
   its name for unopened gear; it now does the same for a waiting merge, in the tier palette's gold
   against gear's red. Gear ranks first: an unopened item may be the best thing in the run and has
   to be read, while a merge is a free tier that will still be free next node. One label, in that
   order — a button saying two things at once is a button saying neither.
3. **After.** `MergeBurst` gives the result a beat: the two inputs fly together, the new piece is
   struck out of them, and it states the tier it climbed to and everything it grants. Two pieces
   went in and one came out, and the whole event used to be the bag quietly reshuffling by one box —
   the strongest thing a player can do to an item, and the least legible. Nothing waits on it: it
   clears itself after `MERGE_BURST_MS`, and a tap skips it.

**The number to watch is `MERGE_BURST_MS` (1900).** It is a full-screen beat on an action a player
may take several times at one bag, and the first thing to cut if merges turn out to cluster.

### 9.5 The 🎒 went, and what replaced it is not a satchel

It was the last emoji on the screen — drawn by a font in a different hand from every other mark in
the run. Three satchels were drawn to replace it and every one read as an **anvil or a padlock** at
16px, where a 24-unit grid gives 0.67px a unit and a flap seam is under a pixel. (The Forge node is
already an anvil, which is what made the near-miss so easy to see.) A drawstring pouch was ruled out
separately: the gold glyph in the same header row is one.

What shipped is a bevelled **piece on a tray** — what the panel holds rather than what it is, in the
exact silhouette the pieces below it are cut to. `HUB_PATHS.bag`.

## 10. The gear board is a sheet, not a box (2026-09-10, per user direction)

§9 made the contents good and left the container alone, and the container was the problem: a
full-height rectangle of panel gray that stood the same height whether it held four items or forty.

### 10.1 Content-sized

`.roster-panel` was `height: 100%`. It is `height: auto; max-height: 100%` now — a sheet as tall as
what it holds, centred in the scrim, with the map reading around it. A full inventory still reaches
the cap and scrolls exactly as before.

That deletes the ~113px dead band `.gear-board`'s `justify-content: safe center` existed to
distribute, so that rule went with it. Everything else tightened by a few px at a time: the squad
grid's gap 9 → 7, a card's padding 6 → 5 and its internal gap 7 → 5, the inventory header to
centred alignment at 7px.

### 10.2 What stops the rest being gray

- **The sheet** is lit from its top edge and cooled toward its foot, with an inset white hairline
  inside the border and a deep drop shadow. One gradient and one inset ring is most of the
  difference between a panel and a box.
- **The header is a title BAR** — its own darker ground, the name set as an uppercase eyebrow, and
  a gold hairline under it that fades at both ends. It still doubles as the carried piece's readout
  (§9.3), which is why the eyebrow's tracking is explicitly *unset* for `.roster-held`: an item name
  is a proper noun and must not be set as a label.
- **A hero card** carries its own type colour as a wash falling from the top stripe and fading out
  before the mount, plus a short spill of that colour under the stripe itself. It is lit by the
  thing at the top of it rather than being a rectangle with a coloured edge.
- **The portrait sits in a plate** — a recess cut in the hero's type colour, the same figure/ground
  move the sockets below it make. A bare 28px sprite on a panel reads as an image that failed to
  load.
- **The inventory is genuinely cut INTO the sheet**: a dark floor, a hard top shadow, a lit bottom
  lip.
- **A locked slot stays faint** — dotted, at 0.2 opacity, unchanged. Drawing it up into a blanked
  fitting (floor, rim, a bar across the middle) was tried in this pass and reverted the same day,
  per user direction. The case for it was that at `BASE_ITEM_SLOTS` = 1 two thirds of every mount is
  one of these, so faint means a lot of near-blank card. But that blankness is the point: capacity a
  hero does **not** have must not draw the eye on the screen whose whole job is placing gear, and a
  legible blank competes with the sockets beside it for exactly the glance the player came to spend.

### 10.3 "Bag" → "Inventory", and the count is gone

Both per user direction. The count went because the grid below **is** the count — a figure restating
the number of boxes the eye can already see was the one thing in that header that never changed what
anybody did. What is left are the two inboxes (unopened, pairable) and the purse.

The rename reaches the Blacksmith's item list (`ItemServicesSection`, where an item's holder is a
hero's name or "Inventory"), the Guild Hall's purchase line, and the map footer's aria text.

> **Trap.** `.resolve-button` sets `width: 100%`. Giving the Close button margins so it sits inside
> the sheet's rounded corner makes it overhang its container by exactly those margins — and the
> sheet's new `overflow: hidden` then clips the right edge off, so the button silently loses a
> corner and its centred label sits off centre. `width: auto` is the fix; a block-level auto width
> accounts for margins.

## 11. The hero sheet, and the shift on tap (2026-09-10, per user direction)

### 11.1 The tap shift

Picking a piece up moved the whole screen a hair. Not the highlights — those are box-shadows and
transforms and cost no layout. The panel HEADER: it holds either an 11px eyebrow or a 26px piece
with its name and chips, and the held state was **3px taller**. Since the sheet is content-sized and
centred (§10.1), those 3px moved everything by half of them, every time.

`.roster-panel-header` has a fixed `height` now rather than a `min-height`. Whatever it carries, the
bar is one height.

> The general form of this: on a **centred, content-sized** panel, any element that changes size
> with state moves the entire screen by half the delta. Reserve the taller state's height.

### 11.2 Both hero sheets take the gear sheet's treatment

`HeroPreviewOverlay` (the run's) and `HeroDossierOverlay` (the Compendium's) share
`.detail-panel.is-tabbed`, and both now carry `.is-hero-sheet`: three bands — title bar, recessed
page well, control strip — instead of one flat rectangle with things stacked on it.

The sheet is cut in the hero's **innate primary** type colour, passed as `--hero-color`. Innate, not
effective: a graft changes what a hero fights like and never who it is (CLAUDE.md), and this is the
screen that answers the second question — the badges under the name carry the effective pair. That
colour drives the title bar's wash, the hairline under it, the portrait plate, the level plate and
the active tab, which is what makes six of these read as six heroes rather than one template.

The portrait is seated in a plate, and the level left the name: `Squall — Lv 14` ran a proper noun
and a figure that changes every fight into one string.

### 11.3 The empty well stays, and why

The panel is `flex: 1 1 auto` — full height, whatever the page holds — so a short page (Gear on a
two-item hero) leaves a large empty well. That is deliberate, and it is the second of two things
this sheet cannot have at once.

The rule it protects: **the tab strip has to sit in the same place on every page**, or the control
the player is aiming at moves out from under the thumb between one page and the next.

A content-sized panel was tried the same day, bottom-anchored (`justify-content: flex-end` on the
overlay) so that the panel's bottom edge — and therefore its last row, the strip — stayed pinned
while only the top edge floated. It closed the well completely. **Reverted per user direction**, who
wanted the sheet centred; centring a content-sized panel moves the strip by half the spread between
pages, and measured on one hero those pages want 561 / 427 / 380 / 266px — a ~148px jump between
Stats and Passives.

So the well is styled instead of removed: `.is-hero-sheet .detail-tab-body` is cut into the sheet
the way the Inventory tray is, and the leftover room reads as the page's own floor rather than as
unfinished panel.

`.detail-overlay.is-sheet` is used by exactly these two overlays, so any future attempt at this is
contained.
