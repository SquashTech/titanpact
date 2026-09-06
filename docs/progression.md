# progression.md

> How heroes and teams grow across a run: the level-up currency, Evolution, equipment,
> relics, XP, and the raise-vs-recruit axis. Rules only — grant values, XP rates, and
> equipment/relic content are **data** (`/data`). Combat effects of these systems
> resolve through the stat and damage pipelines in `architecture.md`.

## Progression philosophy: level-ups unlock, they don't inflate

The core rule that keeps balance legible:

- **Level-ups never directly raise a stat.** Leveling **unlocks moves** and **drives
  Evolution**. It does not silently pump numbers.
- Stat growth, where it happens, comes through **Evolution paths** as explicit
  grants — never as an invisible per-level drip.

This separation is deliberate: it means a hero's power at any moment is explained by
*visible choices* (which moves, which Evolution path, which gear, which relics), not by
an opaque level curve.

---

## The level-up currency (pooled, freely distributed)

- Leveling uses a **pooled level-up currency**, distributed **freely** across the
  roster by the player — not a per-hero locked XP track for spending. 
- The player chooses where to invest the pool. This is a strategic decision surface,
  not an automatic allocation.

---

## Evolution (LOCKED rules)

> **`docs/leveling-and-ranks.md` is now the authoritative spec for level-ups and
> Evolution** and supersedes this section where they disagree. The type-graft/shift
> question is reconciled (below — secondary type can shift, 2026-08-15 sign-off) and
> implemented. **Reconciled (2026-08-16 playtest sign-off):** the leveling
> *currency* mechanic now matches `leveling-and-ranks.md` — `src/run/progression.ts`
> implements `levelUpHero` (spends one pooled Training Point, incrementing
> `RosterEntry.level`) plus `grantLevelUpMove` (resolves that level-up's random move
> offer: gained outright under the 4-move cap, or an accept/decline replacement
> choice at cap). The older two-independent-spends model (`unlockTierMove` /
> `investRankProgress`) is removed. Spending is also now forced immediately after
> every points grant (`LevelUpScreen`), not deferred via Manage Roster. **Still
> open:** the bench-XP reconciliation question below is unaffected by this change
> (points are still freely distributable to any roster hero, benched or active).
>
> **Renamed and re-scoped (2026-08-16):** what this section used to call
> "rank-up" is now **Evolution** (docs/leveling-and-ranks.md's terminology, matched
> here and in code — `RankUpBranch`/`chooseRankUpBranch` etc. are now
> `EvolutionPath`/`chooseEvolutionPath`). The trigger is also simplified for the
> current implementation pass: instead of a per-hero-authored `rankProgress`
> threshold, every hero now Evolves at the same flat, uniform level
> (`EVOLUTION_LEVEL`, currently 5) — and the level-up that reaches it **replaces**
> that level-up's move offer rather than granting one alongside the Evolution
> choice. See `leveling-and-ranks.md` Part 2 for the full rule and its scope note
> reconciling this against `CLAUDE.md`'s variable evolution-depth design intent.

- Level-ups **drive Evolution**; Evolution is where a hero's identity branches.
- **Evolution paths differ in kind, not degree.** A path is not "the same hero but
  bigger numbers" — paths take the hero in genuinely different directions
  (different kits, roles, tools). Do not implement paths as tiered stat bumps.
- **Every path carries a single identifiable name** (`leveling-and-ranks.md`) — e.g.
  Cinder's Explosive / Ironclad / Thunderblaze — not just a `kind` label.
- **The hero's innate type is immutable across all Evolution** (`types-and-heroes.md`).
- **Mono is a valid terminal state** — a hero can be fully realized without ever
  branching into a second type. Don't gate "finished" on dual-typing.

### Stat grants

- Where an Evolution path (or other source) grants stats, **grants are always
  multiples of 5 or 10.** Never grant 7, never grant 12. This keeps the number space
  clean and readable.
- Grants feed the **stat pipeline** (`architecture.md`) as part of effective stats.

### Evolution sequencing (current scope — see `leveling-and-ranks.md` for the deferred multi-node design)

- A hero's Evolution line is an **ordered list of nodes** (`ProgressionTable.evolutions`,
  `src/run/progression.ts`), authored per-hero in `/data`. **Currently every hero has
  exactly one node**, gated on hero level rather than an accumulated-progress
  threshold — `EVOLUTION_LEVEL` is a single flat engine constant, not per-hero data.
  Multiple ordered nodes (Capstone = 0 / Single = 1 / Deep-line = 2+ per `CLAUDE.md`)
  are a deferred extension of this same shape, not a different one.
- Node *N* becomes available once `entry.level >= node[N].level` **and** every prior
  node already has a path chosen. Nodes are not conditioned on *which* path was
  picked at a prior node — path choice changes what that node grants, not which node
  comes next. Revisit this if a hero design genuinely needs diverging future nodes
  per earlier path — it's a bigger data-model change, not a default to reach for.
- Choosing a path is **free** and one-shot per node — the point cost was already paid
  reaching the node's trigger level via level-ups.

### Type-graft paths (reconciled with `docs/leveling-and-ranks.md` — 2026-08-15)

- An Evolution path may optionally **graft or shift the secondary type slot** on a
  hero, per `docs/leveling-and-ranks.md` "The immutability nuance": the innate
  **primary** type never changes; the **secondary** type slot is the Evolution
  branch axis and can be set by one Evolution and **replaced by a later one.**
- **Only mono-type heroes have a free secondary slot to start.** A hero authored
  with two innate types already has both type slots filled by design — a path
  must never offer a graft/shift to an already-dual-by-design hero. This is
  enforced at data-application time, not just by authoring convention.
- **A graft can be overwritten by a later graft path**, any number of times
  across a hero's Evolution line — each application simply replaces the current
  secondary type with the new one. There is still only ever **one** secondary
  slot (Titanpact heroes cap at two types total, `types-and-heroes.md`); shifting
  isn't stacking a third type, it's swapping what occupies the second one.
- The **innate primary type never changes.** Type-graft/shift only ever touches
  the secondary slot; the authored `HeroDefinition.types` primary stays
  immutable. The hero's effective types for combat purposes (STAB, and being the
  target of an opponent's `TypeMult`) are the innate primary **plus** the current
  secondary-slot grant (if any), resolved at the combat layer — never written
  back onto the authored hero data.
- A path that grafts a type may **also** carry `statGrants` /
  `unlocksMoveIds` / `learnableMoveIds` — grafting isn't mutually exclusive
  with the rest of a path's payload, it's one more thing a path's "kind" can
  express (typically fits an `offensive` or `utility` path reframing the hero's
  toolkit around a new domain, but nothing mechanically requires that pairing).
- **In practice a graft should carry `learnableMoveIds`** (2026-09-01). A type
  the hero has no moves in is defence and STAB it will rarely collect — half a
  graft. Opening a line of the grafted type's slate is the other half, and is
  what makes the graft read as "gain Spirit **and the ability to learn Spirit
  moves**". See `leveling-and-ranks.md` "Evolution steers future level-up
  offerings" for the mechanism and its open weighting question.
- **Mono remains a legitimate terminal state.** Not grafting is always a valid
  choice among a node's paths — a graft path should normally be offered
  alongside a non-graft alternative at that node, not forced.

---

## Items (per-hero)

### Uncategorised slots (2026-09-06, per user direction, replacing weapon/armor/accessory)

The three fixed categories are gone. They read as **"finnicky, unintuitive, and cumbersome"**
in playtest: three separate columns to keep filled meant most drops were the wrong *kind*
rather than the wrong *item*, and the interesting question ("is this better than what I've
got?") was buried under a bookkeeping one ("does this even go anywhere?"). Every item is now
just an item, and a hero has a list of slots that anything can fill.

What that bought, and the shape of the replacement:

- **`EquipmentDefinition` has no `slot` field.** The catalog's weapon/armor/trinket groupings
  in `src/data/equipment.ts` are authoring flavour, nothing more — names still describe
  swords and plate, but nothing checks them.
- **`RosterEntry.equipment` is a compact `readonly string[]`**, not a keyed record. Index N
  *is* the Nth slot and there are never holes, so the list's length is what fills the slot
  boxes. Capacity is stored nowhere on the entry: it is derived.
- **Slot capacity comes from `itemSlotsFor(hero, entry)` and nowhere else** — the hero's
  authored count plus its Forge grants, clamped to `MAX_ITEM_SLOTS`. UI, save validation and
  `runProgress` all read that one function.
- **`BASE_ITEM_SLOTS` = 1.** A hero that holds one item is the norm; the item it holds is
  therefore a real part of its identity rather than a third of a rounding error. This is the
  half of the change that makes an individual item *matter* — the complaint that items "feel
  imperceptible" is as much about how many are diluting each other as about their size.
- **`HeroDefinition.itemSlots` = 2 is the per-hero balance dial**, authored on exactly the
  nine heroes at **Speed ≤ 40** (Bellows, Cube, Sentinel, Aegis, Warden, Hollowbark, Pincer,
  Crag, Flurry). They never win a priority tiebreak, so gear rather than tempo is what scales
  them. `test/roster.test.ts` pins the band **both ways**, so a hero drifting across 40 Speed
  cannot silently gain or lose a slot. Crag is the only starter among them.
- **`MAX_ITEM_SLOTS` = 5**, and the Forge (below) is the only way up. A hero at the cap is not
  a legal Forge target — the reward can go dead on one hero, which is what makes spending it
  a choice.
- **A hero never holds two copies of one item.** The passive and Elemental Force grants
  count-stack, so duplicates would quietly double an effect the card shows once; one legible
  copy is the point. `holdsItem` guards every equip and every hand-off.
- **The Forge node** (`forgeReward`, `ForgeScreen`) grants +1 slot to one chosen hero for the
  rest of the run. It replaced the three slot-specific cache nodes, which had no meaning left.
  It is deliberately the scarcest thing on the reward row (weight 8 against `equipmentReward`'s
  40): it is permanent, and it compounds with every drop after it.

Two knock-on decisions the UI had to make, both in `EquipCompareRow`:

- **What a tap MEANS now depends on the hero.** A free slot takes the item outright; one held
  item is a straight swap; a full hero holding two or more has to be asked which one goes, and
  that case *alone* expands into a per-item picker with its own diffs. Making every hero use
  the picker would have added a tap to the common case, which is the friction this rework
  exists to remove.
- **Manage Roster hands over rather than swapping a matching slot.** With no categories there
  is no matching slot to trade into, so `moveEquipment` appends when the destination has room
  and trades items when it does not.

### Everything else

- Items contribute through the **stat pipeline** (stat-shaped effects) or the
  **damage multiplier term** (damage-shaped effects) per the pipeline rules in
  `architecture.md` — same discipline as everywhere: stat effects go in stats, damage
  modifiers go in the multiplier term.
- **Equipment strips on contract termination.** When a hero leaves the team
  (contract terminated), their gear is removed. Model equipment as attached to the
  hero's roster slot, not permanently bound to the hero object, so termination cleanly
  reclaims it.
- **Rarity tiers (2026-08-17, per user direction): Common/Rare/Epic/Legendary/Mythic**,
  gray/blue/purple/gold/red — `EquipmentDefinition.rarity` (`src/run/equipment.ts`
  `EquipmentRarity`), with per-tier colors as CSS custom properties (`styles.css`
  `--tier-*`) so every rarity-colored element (Equipment Cache cards, the
  forced-equip spotlight) stays in sync from one source.

### The rarity budget (2026-08-30, per user direction)

A tier is no longer just a colour and a drop weight — it is a **point budget**, and
every authored item spends its tier's budget **exactly** (`RARITY_BUDGET`,
`equipmentBudgetProblems`, `src/run/equipment.ts`; asserted over the whole catalog by
`test/equipment.test.ts`):

**Budgets were rebased 2026-09-06** (per user direction), from 10/20/30/40/50, alongside the
drop from three item slots to one. A hero holding a third as many items needs each of them to
carry about three times as much, or "one uncategorised slot" reads as a nerf rather than a
focus. Two things about the new row are deliberate:

- **The steps are a uniform +20**, and every budget halves onto a multiple of 5 — which the
  generated per-type gear needs to split a tier cleanly.
- **The tier RATIO compressed**, from Mythic being 5x a Common to 3.7x. An Act-1 Common is a
  hero's entire item for a long stretch of the run now, so it cannot read as a rounding error
  next to what Act 4 hands out.

| Tier | Budget | Worked example |
| --- | --- | --- |
| Common | 30 | Torch — 10 Attack, 10 Fire Force |
| Rare | 50 | Ember Band — 20 Attack, 15 Fire Force |
| Epic | 70 | Bloodletter Fang — 30 Attack + Bloodthirst |
| Legendary | 90 | Ring of Vitality — 60 HP, 10 MP Regen + Quickening |
| Mythic | 110 | Crown of the Ancients — 20 HP, 15 each of Atk/Def/Int/Wis + Rallying Standard |

Three things convert into those points:

- **Stats**, via `STAT_POINT_VALUE`. Attack/Defense/Intelligence/Wisdom/Speed cost 1
  per unit, which is the user's "roughly 10 total stats" read literally. Two stats are
  **deliberately not 1:1** — the one judgment call layered on the spec, and the first
  knob to turn if tiers feel wrong. **HP costs ½** (heroes sit at 80-150 HP,
  and it never enters the locked damage ratio at all, so at 1:1 every HP item would be a
  trap pick — which the north star forbids). **MP Regen costs 3×** (every hero's base is
  exactly 10, so +10 is a 100% swing in the resource-cycling engine the whole switching
  game runs on).

  **Mana Pool went ½ → 1 with the 2026-09-06 rebase.** At half price the tripled budgets
  bought +60 to +80 Mana on a single item, against a roster whose pools are 50-65 — an item
  that more than doubles a pool prices every move's mana cost out of meaning, and mana cost
  is the primary balance lever on reliable moves (CLAUDE.md). HP has no equivalent problem:
  it is not a resource that gates what a hero may cast, so it stayed at ½.
- **Elemental Force magnitude**, at 2 points per magnitude (`FORCE_POINT_VALUE`), raised
  from 1 in the same pass so magnitudes only doubled where budgets tripled. Force is authored
  as flat Base Power, but Base Power is multiplied by the off/def ratio — so what it actually
  contributes is percentage-shaped and grows with the hero, exactly like a type-locked damage
  passive. Left at 1 it would have tripled into +45 Base Power on a Mythic, against a median
  move's 50.
- **Granted passives**, priced in `PASSIVE_ITEM_COST` (`src/data/passives.ts`) — the
  "OR equivalent in terms of powerful passives or other effects" half of the brief.
  The anchor is **40 points = a 20% type-locked damage multiplier**, doubled from 20 in
  the 2026-09-06 rebase. That is not just tracking inflation: almost every priced passive is
  percentage-shaped or unbounded — a multiplier, a share of damage healed, a stack that grows
  all fight — so what it is worth rises with the stat line around it, and the stat lines
  tripled. Left at the old figures a Mythic would clear the effect floor for 18% of its budget
  and still be a stat stick. The table lives in
  the data layer, not on `PassiveDefinition`: what a passive is worth *in an item* is an
  equipment-economy question the engine has no opinion about, and relics grant passives
  on a different axis (team-wide, no slot competition) that shouldn't be forced through
  an equipment-shaped price. An item granting an unpriced passive **fails validation**
  rather than getting it free.

### The effect floor (2026-09-06, per user direction)

**From Epic up, an item must spend at least a third of its budget on effects** — granted
passives plus Elemental Force magnitude (`EFFECT_FLOOR_MIN_RARITY`, `EFFECT_FLOOR_SHARE`,
enforced by `equipmentBudgetProblems`). Epic owes 24 points, Legendary 30, Mythic 37.

It exists because the complaint the budget pass answers — items feel imperceptible — is only
half about size. A +110 Attack Mythic is bigger than what came before and still nothing to
think about. The floor is a **share**, not a boolean, precisely so a token +5 Force cannot
launder a stat stick past it.

Below Epic there is no floor at all. A plain, legible Common is what an Act-1 item should be,
and the twelve designer-authored Commons are exactly that.

Two consequences worth knowing:

- **Thirteen hand-authored Epic+ items were pure stats** and needed effects. Six new equipment
  passives were authored for them (Sunder, Second Skin, Arcane Reservoir, Rallying Standard,
  Purifying Ward, Quickening) — all ordinary data over existing hooks, no engine change, and
  `passiveIcons.tsx` derives their glyphs so none needed a table entry. Four of the eight
  passives that already existed are the same 20% multiplier pointed at four types, which is
  fine as a set but could not have covered thirteen items on its own.
- **The generated per-type gear clears the floor with Elemental Force**, not passives — which
  is why its shape moved from a halve-the-budget formula to the explicit `TYPE_GEAR_SHAPE`
  table. With Force at 2 points and three different flavour-stat prices, no single divisor
  lands every piece on a multiple of 5 *and* clears the floor. The Rare armour is the one
  generated piece with no effect, and it is allowed to be plain.

> **Open question — items and Evolutions now trade differently.** The rebase tripled item
> budgets without touching a single Evolution path, so a path's stat line, measured in the
> same currency, went from "about two Mythics" to "about one" (`test/roster.test.ts`). That
> is a real shift in what a level-up is worth against a drop, and it has not been playtested.
>
> **Open question — Guild Hall gold prices were not retuned.** `EQUIPMENT_PRICE_BY_RARITY`
> is still 15/30/55/90/150, a 10x spread across a tier range that now spans 3.7x, so a Common
> is the most gold-efficient thing on the shelf by some distance. The prices are flagged
> "untuned" in `src/run/shop.ts` and were left alone deliberately — the shop economy is its
> own decision, not part of the budget pass.

Stats now **cover more possibilities** at every tier (the brief's other ask): a Common
weapon is no longer "30 Attack" but any 30 points — 15 Attack + 15 Speed, 10 Attack +
10 Fire Force, 15 Intelligence + 15 Defense. The twelve authored Common weapons in
`src/data/equipment.ts` are the worked example the rest of the catalog follows, and
`test/equipment.test.ts` pins them verbatim so a rebalance can't silently rewrite the
reference. The 2026-09-06 rebase kept every one of their SHAPES exactly: a stat-only item
tripled, and a Force item doubled both halves, because Force's own price doubled with it.

> **Open question — nothing caps how much of a tier a drawback may buy.** A negative
> stat grant refunds its full point value, which is what lets Berserker's Cleaver carry
> a Legendary-sized Attack line (50) *and* Sunder at Epic by taking −20 Defense. That is a good item; a
> hypothetical −40 Defense / 70 Attack Epic is not. A cap (say, 25% of the tier budget)
> is the obvious answer but has not been decided — flag before authoring a second
> drawback item.
- **No unequipped-item stash (2026-08-17, reversing the 2026-08-16 third-playtest
  design — per user direction, "adds unnecessary player busywork").** Every item
  obtained, from a battle win or an `equipmentReward` node alike, must be equipped to
  a hero or trashed for good before the run continues (`ForceEquipScreen`,
  `docs/run-loop.md` "The unequipped-item inventory was removed"). `RunState` no
  longer has an `inventory` field.

### The act-scaled drop curve (2026-08-30, per user direction)

> "We also need spawn rates to adjust as the run goes on. Legendary and Mythic
> equipment should be impossible to find in Act 1, but common items should be
> impossible to find in Act 5."

Two composable rules, both in `src/run/equipment.ts`, and **one function
(`rarityWeightsFor`) that every roll site in the game goes through** — the Equipment
Cache (`NodeRewardScreen`), the per-slot reward nodes and post-fight drops (`App.tsx`),
and the Guild Hall shelf (`run/shop.ts`). One curve, not four.

**1. The tier rows (`RARITY_WEIGHTS_BY_TIER`)** — the shape, as percentages:

| Loot tier | Common | Rare | Epic | Legendary | Mythic |
| --- | --- | --- | --- | --- | --- |
| 1 | 65 | 30 | 5 | — | — |
| 2 | 35 | 40 | 20 | 5 | — |
| 3 | 15 | 35 | 30 | 15 | 5 |
| 4 | 5 | 20 | 35 | 27 | 13 |
| 5 | — | 10 | 30 | 35 | 25 |
| 6 | — | 5 | 20 | 40 | 35 |

A plain fight rolls **tier = act number**. An **Elite or the act's Guardian rolls one
tier ahead** (`lootTierFor`), which is what tier 6 exists for — it replaces the old
flat `ELITE_RARITY_DROP_WEIGHTS` table, so "tougher fights drop better gear" is now
one rule that scales with the run instead of a second fixed table that doesn't.

**2. The act window (`ACT_RARITY_WINDOW`)** — the hard half, kept deliberately
separate so the elite bump can never punch through it. Act 1 is capped at Epic; Act 5
floors at Rare. Without this, an Act-1 elite rolling tier 2 would produce the 5%
Legendary the brief forbids.

The sampler **filters zero-weight items out of the pool** rather than leaving them in
at weight 0 (`pickWeightedEquipment`): "impossible" has to mean impossible, and a
plain weighted walk can still land on a zero-weight entry through float drift.
`test/equipment.test.ts` asserts this by rolling, not just by reading the table.

One knock-on: **the act-opening Goblin fight's guaranteed drop is no longer hard-coded
to Common** — it rolls the act's own standard curve. In Act 1 that is ~65% Common
anyway; by Act 5 there are no Commons left to hand out.

> **Open question — the curve is untuned.** The rows above are a plausible ramp, not a
> playtested one, and they interact with two things not yet decided: encounter
> difficulty doesn't scale by act at all yet (`run-loop.md` §3), and gold income is
> flat while `EQUIPMENT_PRICE_BY_RARITY` is not. An Act-5 Guild Hall now stocks mostly
> Legendary/Mythic at 90-150 gold apiece.

> The **crit source** question (`combat.md`) lands partly here: it's now LOCKED as a
> loadout/equipment layer, not a base stat — so it's an equipment concern. Not yet
> implemented: `equipment.ts` has no crit-chance field yet (see `combat.md` "Crit").

---

## Relics (team-wide)

- Relics are **team-wide passives** and a **separate progression axis** from per-hero
  equipment. Do not merge relic logic into the equipment system — they progress
  independently and apply to the whole team, not a slot.
- Relic effects still respect the pipeline discipline: stat-shaped → stat pipeline,
  damage-shaped → multiplier term.

---

## The raise-vs-recruit axis (LOCKED design intent)

**Starters vs. recruit-only (`types-and-heroes.md` "Starters vs. recruit-only
heroes"):** `HeroDefinition.starter` gates whether a hero is ever offered in the
start-of-run draft. `starter: false` heroes are recruit-only — the raise-vs-recruit
axis below is *how* you get them, this flag is *whether* you have to. Both dimensions
apply per hero independently (a recruit-only hero can still be raised via Guild Hall
or recruited via Contract, same as a starter you didn't happen to draft).

Two sources of heroes, with intentionally different value curves:

- **Guild Hall heroes (raise).** Carry **runway value** — upside you unlock by
  investing level-up currency and time. That runway **decays late-run**: there's
  eventually not enough run left to cash in the investment.
- **Contract heroes (recruit).** **Flat-value veterans** — they don't develop much,
  but they're immediately useful and don't need runway.

The intended play pattern — **develop early, plug-and-play late** — should **emerge
from these timing dynamics**, not from scripting. Don't hard-code "late-run, prefer
contracts." Set the value curves and let the correct behavior fall out. If it doesn't
emerge, that's a tuning signal on the curves (bench XP rate, grant sizes, run length),
not a reason to script the AI or nudge the player.

**IMPLEMENTED (the generic mechanism):** `src/run/recruitment.ts`. Guild Hall spends
`RunState.gold` on an ungeared `RosterEntry`, raised to the act's hire level, from a
data-driven offer pool (`src/data/recruitment.ts`, provisional flat costs). Recruit Contracts derive a
claimable offer from a defeated enemy's `RosterEntry` — carrying its level, chosen
Evolution paths, stat grants, and type-graft, but not its equipment (an assumption,
not a cited rule — equipment is roster-slot-attached, not hero-bound, and neither this
doc nor `CLAUDE.md` says whether captured gear transfers). The trigger is real, not a
placeholder: claiming reuses the specific map node's own generated AI roster
(`src/run/enemyGen.ts`), now that the run loop exists (`run-loop.md`).

**Guild Hall overhaul (2026-08-18, per user direction):** each `shop` node visit now
rolls a curated, one-time offer set (`src/run/shop.ts` `rollGuildHallOffers`, called
once at node-select time — see that module's header for why it isn't rolled inside the
panel component) rather than presenting the entire non-starter hero catalog at once —
**2-3 heroes**, at a flat **50g** each (`GUILD_HALL_RECRUIT_COST`, up from 20g). The
same visit also offers a rotating shelf of **equipment** (priced by rarity tier,
`EQUIPMENT_PRICE_BY_RARITY`, `src/run/shop.ts` — common 15g through mythic 150g) for
direct gold purchase — a new axis alongside hero recruitment. A bought equipment item
still resolves through the same forced equip-or-trash gate (`ForceEquipScreen`) every
other equipment grant uses. Tapping a hero offer opens its full stat/move sheet, which
is where the gold is actually spent (2026-08-28 — `HeroPreviewOverlay`'s `action`).

**Second pass (2026-08-31, per user direction).** Four changes, all of them about the
Hall asking before it takes:

- **Relics are no longer sold at all.** `RELIC_PURCHASE_COST`, `buyRelic` and
  `GuildHallOffers.relicOfferIds` are gone; relics stay a reward-only axis (the
  `relicReward` node and the Guardian's Banner). A shop that sells one of everything
  makes gold the only decision on the screen.
- **The equipment shelf is 4 wide** (`GUILD_HALL_EQUIPMENT_OFFER_COUNT`, up from 3,
  absorbing the freed room) and each card now carries the same benefit line every other
  gear card in the run does (`itemHighlights`, `EquipChoiceCard.tsx`) instead of hiding
  it behind a long-press nobody discovers.
- **A tap on an item opens its sheet rather than buying it**, and the sheet asks
  (`EquipInspectOverlay`'s new `action`, the same shape as `HeroPreviewOverlay`'s). With
  this every purchase in the Hall follows one rule — show the thing, then ask — which
  heroes reached on 2026-08-28 and gear had been the last exception to. Unaffordable
  items still open; the confirm is what goes inert.
- **A bought item greys out in place** rather than vanishing off the shelf
  (`soldOutEquipmentIds`, carried on App.tsx's `shop` Screen because the purchase
  unmounts the screen on its way through the equip gate).
- **A Recruit Contract asks before it buys**, in a confirm that spells out both
  before→after numbers, and the row carries a "N held" chip beside the price — the
  number the price is only readable against.
- **The Hall fits on one screen.** Contracts folded into the Recruits section (it is the
  other way to gain a hero, and a section head of its own cost ~40px), plus tighter
  section and shelf spacing, take a typical 394x780 phone from ~64px of overflow to 0.
  Two of those shelf rules had never applied: `.guild-hall-equip-list` /
  `.guild-hall-equip-card` were (0,1,0) and the base `.equip-cache-*` rules are defined
  later in `styles.css`, so source order won. They are `.equip-cache-*.guild-hall-*`
  now.
- **The corner roster glyph opens the full Manage Roster screen**, not the read-only
  peek (`RosterPeek`'s new optional `onRunChange`). A shop's real question is "do I
  already have something better in that slot", which needs the whole roster's equipment
  at once and the ability to shuffle it. The read-only peek stays the default everywhere
  else, and specifically in the forced allocation gates, where a roster panel that can
  move gear mid-placement could change the thing being placed.

**Recruit Contracts are a scarce currency, not a free-and-unlimited claim (2026-08-16
playtest pass).** `RunState.recruitContracts` starts at 1 per run and is spent (not
gold — free in that sense) on every `claimContract`; claiming with none available is
rejected (`RecruitmentError`). More can be found via a `contractReward` map node
(`run-loop.md` node types) or bought at a Guild Hall for a flat 20g
(`buyContract`, `src/data/recruitment.ts` `CONTRACT_PURCHASE_COST`, up from 12g
alongside the 2026-08-18 overhaul) — deliberately cheaper than a direct 50g hero
recruit, since a contract still requires beating something specific to cash in.
**NOT YET IMPLEMENTED:** the decaying Guild Hall runway value curve (offers are flat
gold costs, not a value that decays as the run progresses).

### A hire arrives raised (2026-09-06, per user direction)

A Guild Hall hire used to arrive at level 1 in every act, which by Act 4 bought the player
a hero too far behind to field — the runway was not decaying, it was gone. A hire now
arrives at `GUILD_HALL_LEVEL_BY_ACT` = **2 / 4 / 5 / 6 / 7** (`guildHallLevel`,
`src/run/difficulty.ts`; later acts hold at the last entry, so Act 6's Vigil musters at 7),
with those level-ups **already spent** — Evolution path first, then pool moves up to
`MOVE_CAP`, rolled by the same `rollLevelProgression` an enemy's build comes from
(`src/run/guildRecruit.ts`). It never carries the act's enemy stat scaling; that axis stays
enemy-side.

**The curve is drawn against the player's own roster, not `ENEMY_LEVEL_BY_ACT`** (1 / 3 / 5 /
7 / 10). The first pass pinned it under that table and the early halls came out worth nothing —
which is backwards, because the early acts are where the run is hardest (2026-09-06 playtest:
Act 2 is the wall, matching the sim's 57% Act-2 Guardian win rate). So the bump is
front-loaded: **+1 / +2 / +1 / +1 / +0** over that first pass, and acts 1-2 now sit *above* the
enemy level table, which is fine — enemies are scaled on stats at least as much as on levels.

Two lines the curve is drawn against instead:

- **Acts 1-2 stop short of `EVOLUTION_LEVEL`.** An early hire arrives one affordable level-up
  from its fork, and that fork is the *player's* pick on the next level-up screen rather than
  the roll's. From Act 3 the hire arrives already evolved, path rolled.
- **Every act stays well under `MASTERY_LEVEL`.** There is always movepool left to buy, so a
  hire is a head start and never a finished hero — which is the whole raise-vs-recruit axis.

Gold cost is untouched at a flat 50g, so what the same 50g buys now grows with the act; whether
that is the right price for an Act 5 level-7 hire is open.

The roll is deterministic in the offer, the act and the act's location, so the sheet the
player inspects is exactly the hero they pay for (`test/recruitment.test.ts`). The sheet
itself drops the equip grid and the relic breakdown for a hero not owned yet
(`HeroPreviewOverlay`'s `unowned`): the grid is always empty and the relics are a given.
Inspecting an item on the shelf now lists what every hero on the roster holds **in that item's
slot** (`SlotOwners`, `EquipChoiceCard.tsx`) — the buy decision without a trip through the
roster screen first.

---

## Per-run reset vs. meta-progression (LOCKED — 2026-08-15 designer sign-off)

**Light meta-progression: unlocks only.** Every run resets the roster, level-up
pool, equipment, and relics to zero — there is no persistent currency or
account-level power growth (rejected: a heavier meta-currency/upgrade layer, to
protect per-run balance legibility, `CLAUDE.md` north star). What *does* persist
across runs is the **pool of what a future run can draw from**: permanent unlocks
(new heroes, relics, equipment becoming available to draft) live in **meta state**
(`architecture.md` "State shapes"), separate from the **run state** that resets.
This is the standard roguelike-lite shape (Slay the Spire, Hades): each run is a
fresh attempt from an unlock pool that only grows.

**NOT YET IMPLEMENTED:** there is no meta-state layer, save format, or unlock-pool
model in code yet — this section records the design decision the eventual
implementation must honor, not a built system. Building it is real scope: a save
file, an unlock-pool data shape, and the run-state initialization reading from it.
