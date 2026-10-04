# progression.md

> How heroes and teams grow across a run: levelling, Evolution, equipment, relics, the
> raise-vs-recruit axis and meta-progression. Rules only — grant values, XP rates and
> equipment/relic content are **data** (`src/data/`). Combat effects of these systems resolve
> through the stat and damage pipelines in `architecture.md`.
>
> Levelling and Evolution are specified in `docs/leveling-and-ranks.md`, which this file defers
> to. Gear is specified in `docs/gear-absorption.md` and `docs/equipment.md`.

## Progression philosophy: power is explained by visible choices

A hero's power at any moment should be explained by *visible choices* — which moves, which
Evolution path, which gear, which Banners — not by an opaque curve. The original form of the rule
was "level-ups never raise a stat"; automatic levelling reversed that half (2026-09-10), and the
legibility moved into the **growth grade**, which is authored, budgeted and printed on the hero
sheet (`leveling-and-ranks.md` "Levels pay STATS").

---

## Levelling is automatic

Every roster hero levels every won encounter, fielded or benched, on `XP(L) = L³`, and each level
rolls every stat against that hero's growth grade. **No pool, no allocation**; `MAX_LEVEL` = 30.
Moves come from each hero's level **schedule**. Full spec: `docs/leveling-and-ranks.md` Part 1.

---

## Evolution (LOCKED rules)

> `docs/leveling-and-ranks.md` Part 2 is the authoritative spec and wins where they disagree.

- **The Evolution opens at Mastery 5** — five Mastery Scrolls aimed at that hero
  (`docs/mastery.md`), never a level and never a beat.
- **Evolution paths differ in kind, not degree.** A path is not "the same hero but bigger numbers"
  — paths take the hero in genuinely different directions. Do not implement paths as tiered stat
  bumps.
- **Every path carries a single identifiable name** — e.g. Cinder's Explosive / Ironclad /
  Thunderblaze. The old `kind` label is deleted (2026-09-16).
- **A path grants exactly two of a type graft, a move and a passive, and no stat line**
  (`docs/evolution-simplification.md`). The one stat verb is the rewire, Attack ⇄ Intelligence.
- **The hero's innate primary type is immutable across all Evolution** (`types-and-heroes.md`).
- **Mono is a valid terminal state** — a hero can be fully realized without ever branching into a
  second type. Don't gate "finished" on dual-typing.

### Stat grants

- Where a source grants authored stats (equipment, Banners, the Mana Well), **grants are always
  multiples of 5 or 10.** Never grant 7, never grant 12. A growth roll and a derived grant are the
  named exemptions (`CLAUDE.md`). Evolution paths no longer grant stats at all.
- Grants feed the **stat pipeline** (`architecture.md`) as part of effective stats.

### Evolution sequencing

- A hero's Evolution line is an **ordered list of nodes** (`ProgressionTable.evolutions`,
  `src/run/progression.ts`), authored per hero. **Every hero has exactly one node**; more
  (Capstone = 0 / Single = 1 / Deep-line = 2+, per `CLAUDE.md`) is a deferred extension of this
  same shape.
- Node *N* opens once its Mastery threshold is reached **and** every prior node has a path
  chosen. Nodes are not conditioned on *which* path was picked at a prior node — path choice
  changes what that node grants, not which node comes next. Revisit only if a hero design
  genuinely needs diverging future nodes; it is a bigger data-model change.
- Choosing a path is **free** and one-shot per node — the price was the pips.

### Type-graft paths

- An Evolution path may **graft or shift the secondary type slot**, per `docs/leveling-and-ranks.md`
  "The immutability nuance": the innate **primary** never changes; the **secondary** slot is the
  branch axis.
- **The graft owns the secondary SLOT** (`leveling-and-ranks.md` "The RETYPE"): a mono hero gains
  a second type, and an innately dual hero **trades** the one it was born with. There is only ever
  **one** secondary slot (heroes cap at two types); shifting is swapping what occupies it, never
  stacking a third.
- The hero's effective types for combat (STAB, and being the target of `TypeMult`) are the innate
  primary **plus** the current graft, resolved at the combat layer (`effectiveTypes`,
  `rosterEntryTypes`) — never written back onto the authored hero data.
- **A graft carries its type's line** (`learnableMoveIds`, derived by `evolutionLine`). A type the
  hero has no moves in is defence and STAB it will rarely collect — half a graft. See
  `leveling-and-ranks.md` "Evolution steers future level-up offerings".
- **Mono remains a legitimate terminal state**: not grafting is always one of a node's choices.

---

## Items (per-hero)

**Gear is absorbed** (`docs/gear-absorption.md`, 2026-09-15): every item raises a who-screen on
receipt (`ItemWhoScreen`) and is given to a hero for good — take, merge or sell, and nothing else.
There is no bag, no swap and no later sale. The full slot and catalog spec is `docs/equipment.md`.

### Uncategorised slots

The weapon/armor/accessory categories are gone (2026-09-06). They read as **"finnicky,
unintuitive, and cumbersome"**: three columns to keep filled meant most drops were the wrong
*kind* rather than the wrong *item*, burying "is this better than what I've got?" under "does this
even go anywhere?".

- **`EquipmentDefinition` has no `slot` field**; the catalog's weapon/armor groupings in
  `src/data/equipment.ts` are authoring flavour.
- **`RosterEntry.equipment` is a compact list** — index N is the Nth socket, never with holes.
- **Every hero has `BASE_ITEM_SLOTS` = 3 = `MAX_ITEM_SLOTS`**, and capacity is decided in one
  place, `itemSlotsFor`. Three is what a half-width squad card seats on a phone.
- **No per-hero slot dial.** `HeroDefinition.itemSlots` (2 on the nine heroes at Speed ≤ 40) was
  deleted 2026-09-08: Speed and HP are anti-correlated in this roster, so those nine were also the
  nine bulkiest, and a second item measured worth **79.3%** in a mirror match — far more than the
  slowness it compensated. **The tiebreak problem it paid for is still unanswered**: if slow heroes
  need compensating, it should be something priced, on an axis that says what it is.
- **No hero holds two of one family**: the second one **merges** into the holder a tier above the
  higher of the two (`mergeIntoHeld`). Passives and Force count-stack, so a duplicate would quietly
  double an effect the card shows once.

### The stash, the bag notification and the uncapped bag — deleted

The unequipped-item bag (`RunState.stash`, 2026-09-07), its Roster-button notification
(2026-09-08) and its uncapped form (2026-09-08), together with the item gate, the swap screen and
the Forge's +1 slot, were **deleted by gear absorption** (`docs/gear-absorption.md`, whose §9
lists what it reversed). The one finding that survived every reversal: a drop resolved on the
spot must never **cascade** — a displaced item forcing the next decision was the worst option
tried.

### Everything else

- Items contribute through the **stat pipeline** (stat-shaped effects) or the **damage multiplier
  term** (damage-shaped effects) per `architecture.md` — stat effects go in stats, damage
  modifiers in the multiplier term.
- **Equipment goes with a terminated hero.** Gear is attached to the roster slot, not the hero
  definition, so termination cleanly reclaims it; it is never handed on.
- **Rarity tiers: Common / Rare / Epic / Legendary / Mythic**, gray / blue / purple / gold / red
  (`EquipmentRarity`), each colour a CSS custom property (`--tier-*`).
- **Crit is an equipment-layer concern** (`combat.md`, LOCKED) but **not built**: no item carries a
  crit field yet; moves carry a per-move `critChance`.

### The rarity budget

A tier is a **point budget**, and every authored item spends its tier's budget **exactly**
(`RARITY_BUDGET`, `equipmentBudgetProblems`, `src/run/equipment.ts`; asserted over the catalog by
`test/equipment.test.ts`). Rebased 2026-09-06 from 10/20/30/40/50 so an item carries enough to be
felt; **the steps are a uniform +20** (every budget halves onto a multiple of 5) and **the tier
ratio compressed** from 5× to 3.7×, so an Act-1 Common is not a rounding error beside Act 4's.

| Tier | Budget | Worked example |
| --- | --- | --- |
| Common | 30 | Torch — 10 Attack, 10 Fire Force |
| Rare | 50 | Ember Band — 20 Attack, 15 Fire Force |
| Epic | 70 | Bloodletter Fang — 30 Attack + Bloodthirst |
| Legendary | 90 | Plate — 35 Defense, 105 HP + Warden's Vigil |
| Mythic | 110 | Crown of the Ancients — 90 HP, 15 each of Atk/Def/Int/Wis + Rallying Standard |

Three things convert into those points:

- **Stats**, via `STAT_POINT_VALUE`: Attack/Defense/Intelligence/Wisdom/Speed/Mana cost 1 a unit.
  **A point buys 3 HP** (`HP_PER_POINT`, the measured break-even below — at 1:1 every HP item would
  be a trap pick). **MP Regen costs 3×**: every hero's base is 10, so +10 is a 100% swing in the
  resource-cycling engine. Mana is 1:1 because at half price an item could more than double a
  50–65 pool, pricing every move's mana cost out of meaning.
- **Elemental Force magnitude**, 2 points a magnitude (`FORCE_POINT_VALUE`). Force is flat Base
  Power multiplied by the off/def ratio, so it is percentage-shaped and grows with the hero; at 1
  it would have reached +45 Base Power on a Mythic against a median move's 50.
- **Granted passives**, priced in `PASSIVE_ITEM_COST` (`src/data/passives.ts`). The anchor is
  **40 points = a 20% type-locked damage multiplier**: almost every priced passive is
  percentage-shaped or unbounded, so its worth rises with the stat line around it. The table lives
  in the data layer because what a passive is worth *in an item* is an equipment-economy question.
  An item granting an unpriced passive **fails validation**.

A Common's budget may be spent any way — 15 Attack + 15 Speed, 10 Attack + 10 Fire Force. The
twelve authored Common weapons are the worked example, pinned verbatim by `test/equipment.test.ts`.

> **Open — nothing caps how much of a tier a drawback may buy.** A negative stat grant refunds its
> full point value. No catalog item spends one today; a cap (say 25% of the tier budget) is the
> obvious answer and is undecided — flag before authoring a drawback item.
>
> **Open — shop prices are untuned.** `EQUIPMENT_PRICE_BY_RARITY` is 15/30/55/90/150, a 10×
> spread across a 3.7× budget range, so a Common is the most gold-efficient piece on the Shop's
> two-item shelf (`shopItemPrice`). Flagged "untuned" in `src/run/shop.ts`.

### The effect floor

**From Epic up, an item must spend at least a third of its budget on effects** — passives plus
Force (`EFFECT_FLOOR_MIN_RARITY`, `EFFECT_FLOOR_SHARE`): Epic owes 24 points, Legendary 30, Mythic
37. Size is only half of "items feel imperceptible": a +110 Attack Mythic is bigger and still
nothing to think about. The floor is a **share**, not a boolean, so a token +5 Force cannot
launder a stat stick past it. Below Epic there is no floor: a plain, legible Common is what an
Act-1 item should be. The generated per-type gear clears it with Force (`TYPE_GEAR_SHAPE`).

### The act-scaled drop curve

> "Legendary and Mythic equipment should be impossible to find in Act 1, but common items should
> be impossible to find in Act 5." (2026-08-30)

Two composable rules in `src/run/equipment.ts`, and **one function (`rarityWeightsFor`) every roll
site goes through** — the Equipment Cache, fight drops, the Shop shelf and events.

**1. The tier rows (`RARITY_WEIGHTS_BY_TIER`)**, as percentages:

| Loot tier | Common | Rare | Epic | Legendary | Mythic |
| --- | --- | --- | --- | --- | --- |
| 1 | 65 | 30 | 5 | — | — |
| 2 | 35 | 40 | 20 | 5 | — |
| 3 | 15 | 35 | 30 | 15 | 5 |
| 4 | 5 | 20 | 35 | 27 | 13 |
| 5 | — | 10 | 30 | 35 | 25 |
| 6 | — | 5 | 20 | 40 | 35 |

A plain fight rolls **tier = act number**; an **Elite or a Guardian rolls one tier ahead**
(`lootTierFor`) — one rule that scales with the run instead of a second fixed table.

**2. The act window (`ACT_RARITY_WINDOW`)** — the hard half, kept separate so the elite bump can
never punch through it: Act 1 caps at Epic, the last act floors at Rare.

The sampler **filters zero-weight items out** (`pickWeightedEquipment`): "impossible" has to mean
impossible, and a weighted walk can still land on a zero-weight entry through float drift.
Asserted by rolling in `test/equipment.test.ts`. Drop odds by node are in `run-loop.md` "The two
reward lanes". The rows are a plausible ramp, not a playtested one.

---

## Pricing HP (2026-09-09 — the roster charges 1:1; enemies and equipment do not)

### The roster re-base (2026-09-09)

**Every hero's seven stats sum to 550 at face value, HP included at 1:1** (`heroStatTotal`,
`HERO_STAT_TOTAL`, `src/run/statBudget.ts`; `test/roster.test.ts`). The case is legibility, not
balance: 550 is the number the **Stat Total** row already prints on the hero sheet, so "is this
line on budget" stops being a question only the repo can answer.

**It over-charges HP roughly 3×** against the break-even measured below — a known, accepted cost,
to be judged in playtest. The re-base took its points **out of HP** (Speed held fixed on every
hero), compressing the roster's HP range from 160–300 to 180–250; the walls are the lines most
likely to want a second look.

Enemy lines (Titanspawn, champions, the Herald) carry no Mana and still price HP at
`HP_BUDGET_VALUE` = 0.5.

### What a point of HP is worth (measured 2026-09-08)

| | Budget points per 1 real HP | Where |
|---|---|---|
| Hero stat lines | **1.0** | `heroStatTotal`, `src/run/statBudget.ts` |
| Enemy stat lines | 0.5 | `HP_BUDGET_VALUE`, `src/run/statBudget.ts` |
| Equipment rarity tiers | ⅓ | `HP_PER_POINT`, `src/run/equipment.ts` |

Every budget figure goes through `statBudget.ts`, so changing a rate changes every budget test at
once rather than silently re-ranking the roster.

**Measured** (`scripts/statprice.ts`): mirror matches, identical squads at level 5, one stat grant
differing, 2400 fights a cell; both sides cost the same 40 points, so the win rate IS the relative
price.

| HP granted per point | vs +40 Atk/+40 Int | vs +20 Def/+20 Wis |
|---|---|---|
| 1 | 28.7% | 29.7% |
| 2 | 37.3% | 39.6% |
| 3 | 49.6% | 49.5% |
| 4 | 59.3% | 59.4% |

**Break-even is 3.0 HP per point** — a rate of ≈0.33. Equipment and Evolution HP grants were set
to it outright on 2026-09-11 (so the printed figure IS the priced one); the roster's 1.0 knowingly
went the other way. If the walls read as weak in playtest, this is why, and the fix is the rate —
not their lines.

**The price is not linear.** Re-spending a hero's own 30 points out of HP into offense wins only
**52.5% ±0.76**, helping exactly half the roster: adding HP on top of a full pool is weak, taking it
off a thin one is dangerous. A flat rate is roughly right in the middle and wrong at both ends.
Across a round robin, authored HP explains about 1% of win-rate variance (r = 0.110); movepools
dominate.

## Are the squishy casters weak? (measured 2026-09-08 — NO, not as a class)

Round robin, level 5, no gear, the 36-hero roster: magical 49.0%, physical 50.6%, **squishy casters
(magical AND HP ≤ 200) 51.6%**. The archetype is fine; the **spread inside it** is per hero (the top
four and the bottom three of the roster were all casters), so the answer is movepool work on named
heroes, never a class-wide stat pass. Two redistribution routes measured as dead ends: HP → offense
(52.5%, near-neutral) and Mana → HP (43.4% — a stat that saturates is not one you can sell).

---

## Relics (team-wide)

- **The relic catalog is the Guardian's Banners** — three fixed, stat-only, team-wide grants
  (`run-loop.md` "The Guardian's Banner", `CLAUDE.md`). Nothing team-wide grants a passive or a
  Force.
- Relics are a **separate progression axis** from per-hero equipment. Do not merge relic logic
  into the equipment system.
- Relic effects respect the pipeline discipline: stat-shaped → stat pipeline, damage-shaped →
  multiplier term. A Banner is broadcast to the side at fight build, never written onto a hero.

---

## The raise-vs-recruit axis (LOCKED design intent)

There are no starters and no recruit-only heroes (`docs/collection.md` §2): any hero in the
player's deck can open a run, be fought, contracted or hired.

Two sources of heroes, with intentionally different value curves:

- **Guild Hall heroes (raise).** Carry **runway value** — upside you unlock by investing levels,
  Scrolls and a Crucible. That runway **decays late-run**: there is eventually not enough run left
  to cash it in.
- **Contract heroes (recruit).** **Flat-value veterans** — immediately useful, no runway needed.

The intended play pattern — **develop early, plug-and-play late** — should **emerge from these
timing dynamics**, not from scripting. Don't hard-code "late-run, prefer contracts." If it doesn't
emerge, that is a tuning signal on the curves, not a reason to script the AI or nudge the player.

**The mechanism** (`src/run/recruitment.ts`, `src/run/guildRecruit.ts`, `src/run/shop.ts`):

- **The Guild Hall's Tavern** rolls **2–3 heroes** a visit (`rollGuildHallOffers`, once at node
  select) at a flat **50g** (`GUILD_HALL_RECRUIT_COST`), plus a reroll (`run-loop.md` §1). Every
  purchase follows one rule — **show the thing, then ask**: a tap opens the hero's or item's sheet
  and the sheet holds the buy.
- **Relics are never sold** — a shop that sells one of everything makes gold the only decision.
- **Recruit Contracts are a scarce currency.** `RunState.recruitContracts` starts at 1, is spent on
  every `claimContract` (refused with none held), and comes from the per-act grant at each
  Guardian, the Tavern at a flat **20g** (`CONTRACT_PURCHASE_COST` — cheaper than a hire because a
  contract still requires beating something specific), and nowhere else. A claim offers up to
  `MAX_CONTRACT_OFFERS` = 2 beaten recruitable heroes, from the node's own generated roster.

### A hire arrives RAW

**A Guild Hall hire is unbuilt**: it arrives at the act's hire level with the growth those levels
earned and nothing else — **no Evolution, no Mastery, its own authored two moves, every schedule
entry still owed** (`guildHallEntry`). Every decision about what it becomes is the player's, and
that is what 50 gold buys.

It is the opposite half of a **contract** hero, which arrives **finished** and **armed** — the
enemy you beat, entire: its Evolution chosen, the Mastery its act bought, every schedule entry
below its level taken, and the piece it fought in (`rollFittingGear`). You save the walk on a
contract, and in exchange you authored none of it.

**RAW is unbuilt, not hollow.** The hire's levels are still ROLLED through `levelUpEntry`, seeded
off the offer so the sheet the player inspects is exactly the hero they pay for
(`test/recruitment.test.ts`). A hire with no growth would be ~120 points behind a roster hero of
the same level — not an archetype, a waste of gold.

**The hire level is DERIVED from the level curve** (`GUILD_HALL_ACT_LAG` = 1, `guildHallLevel`): a
hire arrives at the level the roster held when this act began, plus one — **2 / 9 / 15 / 20** by
act. **That fixed act-sized gap IS the decaying runway value**: one act is most of the run early
and a quarter of it late.

**The LEVEL axis points the right way** (`docs/enemy-levels.md` §4): an enemy is levelled per node
off the player's par, the Skirmish at par plus the act's term (**3 / 10 / 17 / 20**), the Elite a
step over, so an Elite's contract out-levels a hire in every act and a Skirmish's never trails
one. `test/recruitment.test.ts` carries the assertion that catches it inverting.

> **Open:** the hire's flat 50g is untouched while what a hire buys has shrunk; whether that is
> right is undecided.

---

## Per-run reset vs. meta-progression (LOCKED — 2026-08-15 designer sign-off)

**Light meta-progression: unlocks only.** Every run resets the roster, levels, equipment and
relics to zero — there is no account-level power growth (rejected: a heavier meta-currency/upgrade
layer, to protect per-run balance legibility, `CLAUDE.md` north star). What persists is the **pool
of what a future run can draw from**: permanent unlocks live in the **profile**
(`src/run/profile.ts`), separate from the **run state** that resets — the Slay the Spire / Hades
shape.

**Built.** The profile holds the deck and Collection (`docs/collection.md`), stars and purchases,
Ascension progress (`docs/ascension.md`), tips seen and run history. Stars are spent at **The
Constellation** (`StarShopScreen.tsx`, `src/run/starShop.ts`, catalog `src/data/starShop.ts`):
four bought Locations and the hero bundles, plus the Starfall's blind draw — each a widening of the
pool, never power carried into a run. The plan and open numbers are `docs/constellation.md` and
`docs/collection.md`.

### Evolution stars — the meta currency's EARNING half

The profile (`Profile.evolutionStars`) records **one star per hero per Evolution path**: earned by
clearing a run with that hero on the final roster **in that form**, so a hero has exactly three to
collect and one that finishes unevolved earns none. Clearing twice down the same path is the same
star — the set is the record. `recordRunCompleted` takes the finishing roster as `{ heroId,
evolutionPathId }` pairs (`currentEvolutionPathId`). Stars are also paid as a clear bonus by rung
(`docs/collection.md`).

An earned star shows on the Constellation's **Stars** tab, the hero dossier's Evolution tab, and
**the Evolution choice itself** — only the earned mark, not three outlines, so the choice does not
read as a checklist. The profile reaches the run's screens through `ProfileProvider`, a snapshot
re-read at the title. **A path is a colour**: the type it grafts, else its granted move's type,
else neutral bone (`pathLeadType`, `src/view/shared/pathTint.ts`); `test/moveTiers` pins that no
node has two paths on one tint.

**Run History**: every run that ENDS, cleared or wiped, is written to `Profile.runHistory` as a
`RunRecord` (outcome, time, where it ended, fights won, the roster by hero / level / form, first
stars), newest first, capped at `RUN_HISTORY_CAP` = 50. An abandoned run is not recorded.
`recordRunEnded` is the one verb. Banners are on neither the summary nor the history: what a run
came to is its team.

**The balance** is stars earned − cost of what is held (`buyOffer` refuses a held offer or one past
the balance), so a star never comes off a hero once earned.
