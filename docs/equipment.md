# equipment.md

> **Read with `docs/gear-absorption.md` (2026-09-15, per user direction).** Gear is absorbed on
> receipt and never comes off: there is no bag, no carry, no Roster gear board and no later sale;
> merging is `mergeIntoHeld` on the who-screen (any tier, the held enchant surviving, no act
> window); every hero has three sockets; the Anvil and Enchanter are the Guild Hall's Smithy.
> §1–§4 and §6 stand as written; §5 and §8–§11 are trimmed to what is still true.

The item system, reworked 2026-09-07 per user direction. Supersedes the catalog design in
`progression.md` "Items (per-hero)"; the act-scaled drop curve in that document is unchanged.
Code: `src/data/equipment.ts` (catalog), `src/run/equipment.ts` (budget, tiers, enchants, act
window), `src/run/shop.ts` (prices), `test/equipment.test.ts`.

The complaint this answers, in the user's words: the equipment system "doesn't feel satisfying
or interesting and is overall cumbersome to deal with." Two earlier passes attacked the symptom
— uncategorised slots and the rarity budget pass (both 2026-09-06). Neither touched the actual
cause: **a catalog of 106 unrelated names, none of which the player ever learns.** An item you
cannot recognise on sight is an item you cannot want.

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
Cinder?" — and each has its own answer in the run.

**Elemental Force is the enchantment, not an item.** The old catalog spent 42 of its 106 ids
attaching a Force of some type to something holdable; the reframe deleted all 42 and gave the
enchantment system its whole content set. Because Force is flat Base Power on moves matching
its type (`resolveElementalForceBonus`, `damagePipeline.ts`), every enchant is a question *about
the hero holding the item*: Embers on Cinder's blade is a read, on an Intelligence caster of
another type a waste.

16 families x 5 tiers = 80 base items, x 14 enchantments on top, with composite ids
(`sword.epic.blazing`). The player reads two words and knows both axes the name carries:
**"Blazing Spear"** — a Spear, bound to Fire. The tier is the box colour and its pip count (§8).

---

## 2. Families

Each family is a stat signature plus one signature passive, its **Awakening**, which comes
online at Epic. Below Epic a family is stats only — a plain, legible Common is what an Act-1
item should be (`EFFECT_FLOOR_MIN_RARITY`).

Every Awakening is **flat** — one magnitude, the same at Epic, Legendary and Mythic (§3).

| # | Family | Stats | Awakening | Magnitude | Fires on |
|---|---|---|---|---|---|
| 1 | Sword | Attack | Sunder | target -10 Defense | landing a hit |
| 2 | Dagger | Attack + Speed | Bloodthirst | heal 15% of damage dealt | landing a hit |
| 3 | Greataxe | Attack + HP | Vengeful Emblem | +10 Attack | taking a hit |
| 4 | Spear | Attack + Defense | Impale | Poison 5 | landing a hit |
| 5 | Bow | Attack + Wisdom | Marksman | +10% damage | always |
| 6 | Staff | Intelligence | Overchannel | 10 Mana, past the pool | landing a hit |
| 7 | Wand | Intelligence + Speed | Quickening | +10 Speed | entry |
| 8 | Tome | Intelligence + Wisdom | Purifying Ward | sheds every negative status | entry |
| 9 | Orb | Intelligence + Mana | Arcane Reservoir | 30 Mana, past the pool | entry |
| 10 | Plate | Defense + HP | Warden's Vigil | heal 10% of damage taken | taking a hit |
| 11 | Shield | Defense | Second Skin | +5 Defense, +5 Wisdom | taking a hit |
| 12 | Leathers | Defense + Speed | Barbs | Poison 3 on both enemies | taking a hit |
| 13 | Robe | Wisdom + Mana | Mana Ward | Mana equal to 15% of damage taken | taking a hit |
| 14 | Boots | Speed | Quickening | +10 Speed | entry |
| 15 | Ring | Mana + MP Regen | Attunement | partner gains 20 Mana, past the pool | entry |
| 16 | Crest | all five combat stats | Rallying Standard | partner +10 Attack, +10 Intelligence | entry |

All fifteen are authored in `src/data/passives.ts` and priced in `PASSIVE_ITEM_COST`. Quickening
appears twice (Wand and Boots): two families may share an Awakening where the stat signature
makes it read differently.

### The inherited magnitudes owe a balance pass

Flat pricing at 20 flattened a table that used to range 30-50, so ten passives priced against
each other no longer are: Vengeful Emblem cost 50 and Purifying Ward 30, and now cost the same;
Arcane Reservoir's 30 Mana and Attunement's 20 are likewise no longer separated by price. The
magnitudes above were set under the old prices and are **still owed a sweep** before playtest.

### Three things the vocabulary cannot express

Named because each shaped a family's design, and each would be a reasonable engine extension
later — not one to make casually, since a family needs no bespoke logic.

- **No damage-category condition on a damage modifier.** `PassiveDamageModifier` is evaluated
  per hit against `{ moveType }` alone (`passiveEngine.ts`). "Bonus damage with physical moves"
  is not sayable there, so Marksman is untyped and unconditional, at half a typed passive's 20%.
- **No counter-attack.** A reactive on a target-role `DamageDealt` has no target that is its
  attacker, so a true Riposte was not authorable; Barbs hits `activeEnemies` instead. (A passive
  `damage` effect — direct %-max-HP — has since been added; it does not change the targeting.)
- **Bleed cannot scale.** It is `shape: 'boolean'`. The scalable damage-over-time status Impale
  and Barbs can author is **Poison**.

**The four type-flavoured passives left items** — Emberheart, Frostbrand, Shadowfang,
Stormcaller's Focus. Element is the enchantment axis, and a Fire-locked passive on a Sword would
compete with a Blazing enchant for the same job. They live on as the Boon pool's type-locked +20%
damage passives (one per type, `TYPE_PASSIVE_NAMES`).

**Naming (2026-09-07, per user direction).** An item's name is its family noun and nothing else:
a Sword is a **Sword** at every tier. An enchanted one takes the enchant as a prefix —
*Blazing Sword*. A tier adjective (Iron / Steel / Etched / Hallowed / Godforged) was tried and
dropped: the rarity colour and the rarity label already carry the tier twice, and a three-word
name is a worse answer to "which Sword is this?" than a purple border. What the name is FOR is
the family and the element — the two axes no colour encodes.

---

## 3. The tier ladder, and the monotonicity rule

**A tier upgrade must never lower a number.** This is the load-bearing rule of the whole
rework: the Anvil, the merge and the drop curve all exist to move an item up the ladder, and
if the marquee moment (Rare -> Epic, where the family Awakens) hands the player a stat
*downgrade* to fund the passive, every upgrade reward reads as a bait-and-switch.

**An Awakening is FLAT — the same magnitude at Epic, Legendary and Mythic — and priced at a flat
20 points** (`AWAKENING_COST`, 2026-09-07, per user direction; it replaced a per-passive 30-50
table, under which the Awakening tier lost 10-30 stat points to pay for it). The tier buys stats;
the family buys the effect. With `RARITY_BUDGET` unchanged:

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

**The effect floor is a flat `EFFECT_FLOOR` of 20 points from Epic up**, not a share: a share
requires the effect column to grow every tier, which a flat Awakening by definition does not.
(CLAUDE.md's rarity-budget invariant still names the old ⅓ share, `EFFECT_FLOOR_SHARE`.) Flat
Awakenings also kept `grantsPassiveIds` a plain string array — no per-item passive magnitude.
Uniques may carry two Awakenings (Aegis Eternal does): Mythic 110 = 90 stats, or 70 stats + two
20-point passives.

The trade accepted here: above Epic, an upgrade improves the hero rather than the item. Epic is
where a family becomes itself and Legendary/Mythic are stat weight on top. That is legible, and
legible was the goal.

### Enchantment value

An enchant grants Force scaling with the item's tier: **5 / 10 / 15 / 20 / 25**
(`ENCHANT_FORCE_BY_RARITY`), so enchanting a Mythic is the biggest payoff.

**One enchant per item, maximum.** Without the cap a triple-enchanted Common outruns a Mythic
and the tier axis stops meaning anything. The cap is also what gives the Enchanter its teeth:
"overwrite the enchant you already have?" is a decision, "add another" is not.

Enchant budget is tracked **separately** from `RARITY_BUDGET` and does not count against it, so
`equipmentBudgetProblems` audits the base item alone.

---

## 4. Enchantments

Fourteen, one per type, **excluding Ancient** (per user direction).

Fire **Blazing** · Water **Tidal** · Frost **Rimed** · Storm **Thundering** · Stone **Granite** ·
Nature **Verdant** · Light **Radiant** · Shadow **Umbral** · Arcane **Runed** · Mind **Psionic** ·
Spirit **Haunted** · Iron **Tempered** · Mech **Geared** · Beast **Feral**

Elemental only. No non-elemental "greater" enchant class — a second class would muddy what an
Enchanter means, and the rule "an enchant is an element" is worth more than the variety.

These are the only adjectives an item name carries, so nothing can collide with them.

---

## 5. Acquiring and improving

| Path | Costs | Gives you |
|---|---|---|
| **Drop** | nothing | a random item (`docs/gear-absorption.md` §5 for the odds) |
| **Shop** (Guild Hall) | gold, `shopItemPrice` | one of the two pieces on offer a visit |
| **Anvil** (Guild Hall Smithy) | gold | +1 tier on a worn item |
| **Enchanter** (Guild Hall Smithy) | gold | bind or overwrite an element |
| **Forge** (reward node) | a reward seat | the Anvil and the Enchanter free, once |
| **Merge** | a duplicate | a tier above the higher of the two, free, on receipt |

Every received item goes through the who-screen; its one decline is **Sell**, at
`EQUIPMENT_SELL_SHARE` = 0.5 of `EQUIPMENT_PRICE_BY_RARITY`.

### The Anvil and the Enchanter are Smithy services

Repeatable and **unlimited so long as the player can pay**, on the Guild Hall's Smithy tab
(`ItemServicesSection`; `docs/gear-absorption.md` §6). Prices are first-pass and untuned
(`ANVIL_PRICE_BY_TARGET`, `ENCHANT_PRICE_BY_RARITY` in `src/run/shop.ts`). The Anvil is
deliberately dear — you are paying to keep *this* item, its family, its Awakening, its enchant,
not to acquire power efficiently. Merging is the free route.

| Anvil | Gold | | Enchant (or re-enchant) | Gold |
|---|---|---|---|---|
| Common -> Rare | 25 | | on a Common | 20 |
| Rare -> Epic | 45 | | on a Rare | 35 |
| Epic -> Legendary | 75 | | on an Epic | 55 |
| Legendary -> Mythic | 130 | | on a Legendary | 80 |
| | | | on a Mythic | 120 |

### Merging

A second item of a family a hero already holds **merges into the holder** (`mergeIntoHeld`,
`docs/gear-absorption.md` §3) — a tier above the higher of the two, the held enchant surviving.
This turns the duplicate drops a 16-family catalog inevitably produces into its main upside.
Mythics and Uniques cannot merge.

**Drops are NOT weighted toward families the player already holds** (2026-09-07, per user
direction). Weighting would make merging a reliable engine at the price of variety, and the
variety is what a 16-family catalog is for. The player already steers toward a pair through
every pick-1-of-X in the run. If merges prove too rare in playtest, **the lever is a wider
shop, not a weighted roll**.

### The act window governs every path

`ACT_RARITY_WINDOW` caps what an act can drop — no Legendary in Act 1, no Mythic before Act 3 —
and `actAllowsRarity` holds the Anvil to the same rule, so a rich Act-1 player cannot buy past
it. **The merge is the exception**: it does not consult the window (`docs/gear-absorption.md`
§3).

### No gold printer

With no sale of held gear there is no path from gold back to gold beyond buy-then-sell on the
who-screen, which loses half. What survives is one inequality, pinned by `test/shop.test.ts`: **an
Anvil lift must cost more than the tier it reaches sells for**, so a Sell can never read as the
Anvil undone at a profit.

---

## 6. Uniques

A handful — Worldbreaker, Guardian Plate, Aegis Eternal, Archon's Staff and more
(`UNIQUE_EQUIPMENT`), one per act, dropped by Guardians.

- **Mythic only**, and outside the family system. No family, no Awakening, no tier ladder.
- **Not upgradeable and not mergeable** — being Mythic already, both are moot rather than
  forbidden, so this needs no special-case rule.
- **Enchantable** (per user direction). Uniques sit outside two axes and inside the third.

They are the grail. Total flattening into families would buy consistency at the price of the
one item per run the player tells a story about.

---

## 7. Open questions

- **The inherited Awakening magnitudes** (§2) are owed a sweep.
- **Untuned:** both Smithy price tables, the shop prices and the enchant Force ladder.

---

## 8. Item slots and boxes (2026-09-07, per user direction)

- **`MAX_ITEM_SLOTS` = 3**, which is now every hero's (`BASE_ITEM_SLOTS`). Three is what a
  half-width card seats on a 375px phone; the slot row is a 3-column grid of fluid squares
  (~45px on mobile, ~53px on desktop).
- **Item boxes carry a tier pip band** (1 mark for Common through 5 for Mythic). The pip exists
  because item names dropped their tier adjective (§2): colour says two Swords differ, the count
  says which is better. Hidden on the 22px compact variant, which prints the tier in words.

The Manage Roster gear board this section introduced (bag at the bottom, tap-to-seat, per-move
cues) is deleted; the Roster screen reads gear and assigns nothing (`docs/gear-absorption.md`).

## 9. Gear as pieces (2026-09-10, per user direction)

### 9.1 The carry

Deleted with the bag (`docs/gear-absorption.md`): nothing is carried any more.

### 9.2 A piece and a socket, not a filled box and an empty box

`ItemPiece` is split out of the item box so the same object can be drawn wherever gear appears
loose (the who-screen, the merge burst).

- **The piece** is a cut chit: a 7px corner bevel (`clip-path`), a body gradient mixing the tier
  colour into a light slate, a lit top-left facet, a rim bright above and tier-dark below, and
  its own cast shadow. Its silhouette is **stamped** — dark ink with a 1px light edge under it —
  and its tier pips run **light**, because they sit on the piece's darkest band. Reversing either
  makes a Common illegible, that being the palest body in the set.
- **The socket** is a hole: sunken, with four corner L-cuts (a masked border) rather than a
  dashed rectangle, which read as a disabled form field.
- **The mount** (`.equip-mount`) is the rig those sockets are set into — a recessed strip with
  bracket corners in the hero's type colour.

> **Trap.** `--surface` is not a defined token and `--surface-raised` / `--surface-sunken` /
> `--selected-fill` are **gradients**. A `color-mix()` against any of them is invalid, which
> invalidates the whole `background` declaration *silently* — the element renders transparent
> and merely looks dark. Mix against `--panel`, `--panel-alt`, `--well` or a literal.
>
> **Second trap.** `--item-box-size` and `--item-box-pip` are declared on `.item-box`. Anywhere a
> piece is drawn loose they must be re-declared, or the silhouette silently drops to inherited
> font-size and the pips to zero width.

### 9.3 The Banners left this screen for the map

They fly along the **bottom-right of the map well** (`BannerShelf.tsx`), opposite the location
placard and level with it: what the place is on the left, what the run has taken on the right.
Only what is HELD, folded with its count, in the order the run won it; an act-1 run flies
nothing. The choice itself is taken on the Guardian's 1-of-3 screen, which shows all three, so a
rail restating it on the gear screen was cut.

No entrance animation, for the same reason the map's horizon has none: the map is re-entered
after every node, and a standard that unfurls each time reads as a transition. The cloth's own
sway still runs, staggered per pole.

### 9.4 Merging says so

`MergeBurst` gives a merge its beat on the who-screen: the two inputs fly together, the new piece
is struck out of them, and it states the tier it climbed to and everything it grants. It clears
itself after `MERGE_BURST_MS` (1900), and a tap skips it. The bag-side pair badges and the map
footer's merge label went with the bag.

### 9.5 The bag icon

Deleted with the bag.

## 10. The gear board as a sheet

Superseded: the Roster screen is now a read-only sheet (`RosterManagementScreen`,
`.roster-sheet`). Its predecessor's rules — content-sized, a title bar, type-coloured hero
cards, the portrait in a plate — carried over in spirit.

> **Trap.** `.resolve-button` sets `width: 100%`. Giving a button margins so it sits inside a
> sheet's rounded corner makes it overhang by exactly those margins, and an `overflow: hidden`
> sheet then clips its right edge. `width: auto` is the fix.

## 11. The hero sheet (2026-09-10, per user direction)

### 11.1 The tap shift

> The general rule it found: on a **centred, content-sized** panel, any element that changes
> size with state moves the entire screen by half the delta. Reserve the taller state's height.

### 11.2 Both hero sheets take the gear sheet's treatment

`HeroPreviewOverlay` (the run's), `HeroDossierOverlay` (the Collection's) and the fight's
`HeroDetailOverlay` share
`.detail-panel.is-tabbed` and `.is-hero-sheet`: three bands — title bar, recessed page well,
control strip — instead of one flat rectangle.

The sheet is cut in the hero's **innate primary** type colour, passed as `--hero-color`. Innate,
not effective: a graft changes what a hero fights like and never who it is (CLAUDE.md), and this
is the screen that answers the second question — the badges under the name carry the effective
pair. That colour drives the title bar's wash, the hairline under it, the portrait plate, the
level plate and the active tab. The level is on its own plate, not in the name string.

### 11.3 The empty well stays, and why

The panel is `flex: 1 1 auto` — full height, whatever the page holds — so a short page leaves a
large empty well. That is deliberate: **the tab strip has to sit in the same place on every
page**, or the control the player is aiming at moves out from under the thumb.

A content-sized, bottom-anchored panel closed the well and was **reverted per user direction**,
who wanted the sheet centred; centring a content-sized panel moves the strip by half the spread
between pages (measured 561 / 427 / 380 / 266px on one hero — a ~148px jump). So the well is
styled instead: `.is-hero-sheet .detail-tab-body` is cut into the sheet, and the leftover room
reads as the page's own floor.
