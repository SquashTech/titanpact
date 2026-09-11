# progression.md

> How heroes and teams grow across a run: the level curve, Evolution, equipment,
> relics, XP, and the raise-vs-recruit axis. Rules only — grant values, XP rates, and
> equipment/relic content are **data** (`/data`). Combat effects of these systems
> resolve through the stat and damage pipelines in `architecture.md`.

> **Partly superseded by `growth-overhaul.md` (2026-09-10), which is now built in FULL**
> and this file is updated for it: Gems are deleted, moves come only from Mastery Scrolls,
> levels are automatic, roster-wide and cap 30 and pay through authored growth grades,
> Evolutions come from the Crucible, and a Guild hire arrives raw. Equipment's open question
> (2 base slots, halved budgets) was **closed as LEAVE** per user direction — one slot stands.
> **Everything here describes what the code does.**

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

## Levelling is automatic (2026-09-10, Growth Overhaul phase 3)

- Every roster hero levels every won encounter, fielded or benched. **No pool, no allocation,
  no screen.** `MAX_LEVEL` = 30; each level rolls every stat against that hero's growth grade.
- This reverses the pooled, freely-distributed currency this section used to describe, and with
  it the bench-XP reconciliation question below: there is no rate to reconcile, because there is
  no per-hero XP at all.
- The strategic decision surface it used to be moved to **Mastery Scrolls** — which hero to
  deepen, at what cost in breadth. Full spec: `docs/leveling-and-ranks.md` Parts 1 and 1b.

---

## Evolution (LOCKED rules)

> **`docs/leveling-and-ranks.md` is now the authoritative spec for level-ups and
> Evolution** and supersedes this section where they disagree. The type-graft/shift
> question is reconciled (below — secondary type can shift, 2026-08-15 sign-off) and
> implemented. **The levelling currency this paragraph used to describe is deleted**
> (2026-09-10): `levelUpHero`, `grantLevelUpMove` and the pool they spent are all gone.
> Levels tick automatically (`src/run/growth.ts`) and moves come from Mastery Scrolls
> (`spendMasteryScroll`, `grantOfferedMove`). The bench-XP question below is closed by the
> same change: there is no per-hero XP rate left to reconcile.
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
- **Slot capacity comes from `itemSlotsFor(hero, entry)` and nowhere else** — the base count
  plus its Forge grants, clamped to `MAX_ITEM_SLOTS`. UI, save validation and `runProgress`
  all read that one function.
- **`BASE_ITEM_SLOTS` = 1.** A hero that holds one item is the norm; the item it holds is
  therefore a real part of its identity rather than a third of a rounding error. This is the
  half of the change that makes an individual item *matter* — the complaint that items "feel
  imperceptible" is as much about how many are diluting each other as about their size.
- **There is no per-hero slot dial** (2026-09-08). `HeroDefinition.itemSlots` used to be one,
  authored at 2 on exactly the nine heroes at **Speed ≤ 40** (Bellows, Cube, Sentinel, Aegis,
  Warden, Hollowbark, Pincer, Crag, Flurry), on the reasoning that a hero who never wins a
  priority tiebreak scales on gear instead of tempo. Two measurements retired it ("Pricing HP"
  below): Speed and HP are anti-correlated across this roster, so those nine were *also* the
  nine bulkiest (250–300 HP) and the rule landed on an axis it never named; and a second item
  is worth **79.3%** in a mirror match, several times the largest stat grant measured, so the
  compensation was far larger than the disadvantage and nothing priced it against the 450
  budget. The field is gone from the schema, not merely unused, so it cannot come back by
  accident. **The tiebreak problem it was paying for is still real and is now unanswered** —
  if slow heroes need compensating, it should be something priced, on an axis that says what
  it is.
- **`MAX_ITEM_SLOTS` = 3** (2026-09-07, down from 5), and the Forge (below) is the only way up.
  Three is what a half-width squad card seats on a phone (docs/equipment.md §8), so every hero
  is two Forges from the cap. A hero at the cap is not a legal Forge target — the reward can go
  dead on one hero, which is what makes spending it a choice.
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

### The stash (2026-09-07, per user direction: "nobody likes finnicky, awkward systems")

Until now every obtained item was **resolved on the spot** — equipped or trashed before the run
advanced — and a swap *cascaded*, pushing the displaced item back onto the same queue to be
resolved in turn. Three costs came out of that in playtest: the player committed an item's
permanent fate knowing nothing about the fights ahead, one drop could turn into a chain of
forced decisions, and — because nothing could be carried unequipped — Manage Roster could only
ever *trade* two occupied slots. It was a shell game.

`RunState.stash` is the missing concept. It dissolves all three at once.

- **`STASH_CAPACITY` = 8, and the cap is the design.** Superseded 2026-09-08 — see "The uncapped
  bag" below. The argument was that an uncapped bag never forces a decision, so the cap kept the
  discard alive and moved it to a moment when the matchup is *known*.
- **The bag is where everything lands.** Superseded 2026-09-08 — see "The bag notification"
  below. Originally the bag filled only with gear that came *off* a hero, and a found item was
  loose until the player seated, bagged or sold it on the spot.
- **A swap out of the bag is net-zero** (`equipFromStash`): one item leaves, one returns.
- **Unwanted gear is sold, not destroyed** — `EQUIPMENT_SELL_SHARE` = 0.5 of the buy price
  (`sellValueFor`, `src/run/shop.ts`). Gold gains a second faucet that scales with how picky the
  player is, and with the cap gone (below) the Hall's counter is where discard pressure now
  lives at all — a choice the player walks into rather than one a full tray forces. Selling
  is **bag-only**: equipped gear comes off first, which keeps the irreversible verb one step
  away from a mis-tap. The share is untuned.
- **Every slot is both a source and a destination.** A hero's boxes and the bag's are the same
  `ItemBox`, and one tap-then-tap covers equipping, unequipping, handing gear to another hero
  and swapping two. `trashEquipment` survives as a legal transform but no longer has a UI.
- **A save written before the bag decodes to an empty one** and no `SAVE_VERSION` bump is owed:
  the old model had nowhere to put an unequipped item, so "missing" and "empty" say the same
  thing (`decodeStash`).

### The item gate, and the swap window (2026-09-07, per user direction)

Three changes, all downstream of the bag above: once an unwanted item can simply be carried,
the gate stops being a decision the run has to force, and the one decision that *does* cost
something gets room to be made properly.

- **The gate only opens when somebody has a free slot.** Superseded 2026-09-08 by "The bag
  notification" below, which closed it in every case but the full bag. It opened whenever
  anyone could take the item; with the whole roster full its one honest answer was "keep it in
  the bag", so the item went there and the screen never appeared.
- **The gate draws the same squad Manage Roster does.** The six comparison ROWS it used to draw
  were the same six heroes in a second notation — item silhouettes on one screen, item names on
  the other. They are now the same six CARDS (`HeroSlotCard.tsx`, shared by Manage Roster, the
  gate, and the Guild Hall's buy sheet), and every card's slot row is three columns wide —
  `MAX_ITEM_SLOTS` — whatever the hero's own capacity is. Slots past capacity draw as locked
  cavities, so six cards line their boxes up instead of ragging, and a hero at one slot can see
  the two the Forge would open.
- **A full hero opens `EquipSwapScreen`.** Handing gear to a hero with no room is the only equip
  that costs something, and it was the one being decided on the least information — an inline
  list of names, or nothing at all (Manage Roster's card tap was a no-op). It now gets the whole
  screen: the incoming item read out once, then every item already on the hero read out against
  it, with each side's passives as buttons that print their own rule. The ledger is
  `compareEquipment`'s diff arranged as **You gain / You lose** and nothing more — two columns
  rather than one merged list, so a loss cannot hide among gains. It stays deliberately not a
  verdict (`src/run/equipCompare.ts`): Attack on an Int hero is not worth what it is on a
  physical one. Tapping one of a hero's boxes directly still swaps outright — that gesture
  already names the slot.

### The bag notification (2026-09-08, per user direction)

Every item now goes **straight to the bag**, and a badge on the map's Roster button says one is
waiting. Nothing is auto-equipped, and nothing is asked. The gate above closed to the one state
it still answers a question in — a full bag.

**It is ONE door, and the LABEL says what is behind it.** The screen is also where a hero is
read and where one is terminated, so a button naming only the gear would be lying about what it
opens. Instead the label renames itself — `Roster` / `2 New Items` (`mapFooter.ts
footerWaiting`). A badge alone is a mark the eye learns to skip; a button that has changed its
mind about what it is called cannot be.

**The mark is an INBOX, not a stock figure.** A figure wired to a stock the player routinely
sits on would be lit most of the run, which is the definition of a mark the eye learns to skip.
**Opening the Roster is what empties it** (2026-09-11, per user direction, `markAllStashItemsSeen`):
the badge is a notification, and a notification is answered by being looked at, not by every item
under it being handled. It used to clear per item as each was tapped, which left the map's button
lit after a visit that had plainly seen the bag. Inside the screen the arrivals still wear their
mark until tapped, held as local state for that one visit, so what was new is still findable.

**The lit button is a FILLED plate** (2026-09-11, per user direction): a solid slab of the alert
colour with dark ink, lifting and glowing on a loop. It was a tinted outline, and a stylesheet
fault had left it with no background at all — fainter than at rest, on the one screen it exists
to interrupt.

**Mastery Scrolls do not ride that label either, because they never wait** (2026-09-10, revised
the same day). They were briefly a stock with a purse chip and a Roster tab; a Scroll is now poured
on the beat it is won (`MasteryScreen`), so there is no count to state and no badge to suppress.
The waiting-gear problem this section is about simply has no Scroll equivalent.

**One board, not two** (2026-09-10, revised the same day). Gear and Mastery briefly shared the
screen under a tab strip. `growth-overhaul.md` §10 had flagged that split as a watch item — "if the
screen reads as a chore hub once both are on it, that is the signal to separate them" — and it did,
so they are separated: the Roster screen is Gear alone, and Mastery is now a screen raised at the
moment a Scroll is won (`MasteryScreen`). It keeps the full-width rows, because a row has to carry
the four moves the hero already holds — "is there room, and for what" is half of what a Scroll asks,
and that is unreadable at half width.

The reason is that the gate had stopped being a decision and become a toll. Its cost was one
mandatory screen per drop, and it was buying nothing:

- **The reveal was already spent.** An `equipmentReward` node reveals the item on
  `NodeRewardScreen` — the player *picks* it out of three — and a fight's drop is read out in
  full on the victory overlay, name, rarity, stats and effects. The gate was the second or third
  time the same item was shown.
- **The decision was being made at the worst moment.** Who carries a piece of gear depends on the
  matchup, and the matchup is not known at the moment it drops. The bag already existed to move
  that decision to when it *is* known; the gate was asking for it early anyway.
- **The default answer was almost always the same.** With an unwanted item now carryable, "keep
  it in the bag" was the honest answer to most drops, which makes a screen asking the question a
  screen with one real button on it.

What replaces it:

- **`stashItem` is the arrival verb, and it is what sets the mark.** Every route in — a fight
  drop, an Item node claim, a Loot Pile's three, a Guild Hall purchase — lands there.
- **The mark is held as ITEM IDS** (`RunState.unseenItemIds`), not bag indices. Merging, selling
  and equipping all reshuffle indices, and a parallel array would have to be rewritten by each
  of them to stay aligned. Two copies of one item share one mark, which is also the honest
  reading: what is unchecked is the item, not the slot it happens to be sitting in.
- **A mark cannot outlive the item it points at.** Every write to the bag goes through one
  helper (`withStash`, `runProgress.ts`) which prunes against the resulting bag, so the only
  gestures needing an explicit clear are the two that *leave* the item in the bag — picking it
  up, and holding it to read it out. Both are the gesture the player would use to check it
  anyway, which is why "tap it once" is the whole dismissal rule.
- **`ItemFoundScreen` is gone entirely** — see "The uncapped bag" below. It survived this pass
  for one state, a full bag, and the cap it depended on was removed the same day.
- **The tutorial teaches gear on the map, not on a gate.** Valor's `equip` beat now fires the
  first time the badge is lit (`tutorialBeatKeyFor`, App.tsx), ahead of the beat for the node
  ahead: it explains what just happened, and the node beat explains what is next.
- **A save with no marks decodes to none**, and a mark naming something the bag no longer holds
  is dropped rather than refused (`decodeUnseen`). No `SAVE_VERSION` bump is owed — an unmarked
  bag is a quiet badge, not a broken run.

**The badge became the whole button (2026-09-08, second pass, per user direction).** A corner
badge was the entire cue, and a corner badge is the kind of mark an eye learns to stop seeing
after one act — while what it points at is a hero fighting a whole act without the item that was
in the bag the entire time. Removing the gate moved the cost of missing a drop onto the cue, so
the cue has to carry it.

The map's Roster button now *stops being the Roster* while anything is unchecked
(`.has-unopened`, `MapScreen`): the item colour replaces its accent on the top rule, the icon and
the glow; its label says what is waiting rather than where it goes ("2 New Items"); and the tile
breathes. The badge stays, bigger and carrying the count, but it is now the smallest part of the
cue rather than all of it. Nothing modal and nothing to dismiss — the button simply cannot be
read as the one that was there a node ago, which is the property a badge never had.

### The uncapped bag (2026-09-08, per user direction: the cap "doesn't add anything")

`STASH_CAPACITY` and `stashIsFull` are **deleted**, not raised. The bag holds whatever it holds.

The cap was defended above on the grounds that an uncapped bag never forces a decision. What
the same day's change made visible is that the decision it forced was not the interesting one:
by the time the bag is full the player is choosing between two items *neither of which they
wanted enough to equip*, at a moment chosen by the drop table rather than by them. Scarcity of
gear was never the axis — the **SLOT** is (`CLAUDE.md`), and a hero still holds one to three of
them. A bigger bag does not widen that; it only stops the run interrupting to say the tray is
full. The real discard pressure is the Guild Hall's sell counter, which is a *choice* the player
walks into.

What falls out of it:

- **Nothing that reaches the bag can be refused.** `stashItem`, `unequipToStash` and the
  displaced item from an `equipToRoster` swap all used to throw on a full bag; none of them can
  now. The only refusal left in `stashItem` is an id naming nothing.
- **`ItemFoundScreen` is deleted**, and with it the `itemFound` screen kind, its queue, and its
  place in the post-fight gate chain. It existed to answer "where does this go", and every
  answer it had is now either automatic (the bag) or available whenever the player wants it
  (the Roster). A fight drop folds into the same `RunState` transform as the gold and the XP;
  an Item-node claim and a Guild Hall purchase call `stashItem` and stay where they are — the
  shop no longer unmounts and remounts around a purchase.
- **The bag prints a count, not a fraction**, and draws what it holds plus one empty landing
  box. The trailing box is now the only thing saying "there is room for more"; it is not a
  count of anything.
- **The bag grid WRAPS.** It was a one-row horizontal scroller, which worked while the cap was
  10 and about seven boxes fit; uncapped, a sideways strip hides most of the bag. Merging is
  why that matters — pairing duplicates means seeing the whole bag at once, not swiping a tray
  — so it now wraps downward into room the Roster screen already had, and the panel's own
  vertical scroll takes the rest.
- **The save's stash length check is gone.** Ids are still validated against the catalog, so a
  hand-edited file cannot smuggle in content this build does not ship — it can only carry a lot
  of legitimate items.
- **The seating jolt moved rather than died.** `.roster-mgmt-card.is-equipping` was played only
  by the deleted gate; handing a hero gear is the one grant in the run loop that otherwise lands
  with no acknowledgement at all, so Manage Roster — now the only place gear is handed out —
  plays it instead. It fires *after* the equip there, so nothing waits on it.
- **What to watch instead:** a late-run bag of thirty items is a lot of identical silhouettes to
  read. If that becomes the annoyance the cap used to be, the answer is sorting or grouping the
  grid — not a cap coming back.

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
| Legendary | 90 | Plate — 35 Defense, 105 HP + Warden's Vigil |
| Mythic | 110 | Crown of the Ancients — 90 HP, 15 each of Atk/Def/Int/Wis + Rallying Standard |

Three things convert into those points:

- **Stats**, via `STAT_POINT_VALUE`. Attack/Defense/Intelligence/Wisdom/Speed cost 1
  per unit, which is the user's "roughly 10 total stats" read literally. Two stats are
  **deliberately not 1:1** — the one judgment call layered on the spec, and the first
  knob to turn if tiers feel wrong. **A point buys 3 HP** (`HP_PER_POINT`, 2026-09-11 —
  the measured break-even below, and the rate a growth roll pays; it never enters the locked
  damage ratio at all, so at 1:1 every HP item would be a trap pick — which the north star
  forbids). **MP Regen costs 3×** (every hero's base is
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
- **An uncapped stash (2026-09-08, per user direction — reversing 2026-09-07's cap, which
  reversed 2026-08-17's "no unequipped-item stash", which reversed 2026-08-16).**
  `RunState.stash` carries any number of unequipped items; every drop goes there unasked,
  marked unopened until the player looks at it. What survives three reversals is the thing
  none of them disputed: resolving a drop on the spot — with a swap cascading into the next
  forced decision — was the worst of the options. What did not survive is the cap, whose only
  decision was a forced discard between two items the player had already declined. Full
  reasoning in "The stash", "The bag notification" and "The uncapped bag" above.

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

## Pricing HP (2026-09-09 — the roster charges 1:1; enemies and equipment do not)

### The roster re-base (2026-09-09)

**Every hero's seven stats now sum to 550 at face value, HP included at 1:1.** This replaces
the 450 budget, which charged 0.5 a point of HP. Per user direction; `heroStatTotal` and
`HERO_STAT_TOTAL` in `src/run/statBudget.ts`, pinned by `test/roster.test.ts`.

The case for it is legibility, not balance. 550 is the number the **Stat Total** row already
prints on the hero sheet (`computeStatTotal`, `StatBars.tsx`), so "is this line on budget" stops
being a question only the repo can answer. Under the old rule two on-budget heroes could read
530 and 590 to the player, and the difference was invisible discount rather than design.

**It over-charges HP roughly 3×** against the break-even measured below, and that is a known,
accepted cost — a call to be judged in playtest, per the standing rule that sim numbers are
directional and balance is decided by playing. Two consequences to watch:

- The re-base took its points **out of HP** and out of nothing else wherever the delta allowed
  (32 of 36 lines moved HP alone; five needed a ±5 on Wisdom, Defense or Mana to land on a
  multiple of ten). **Speed was held fixed on every hero**, so priority order is untouched.
- The roster's HP range **compressed from 160–300 to 180–250**. The extremes went first, which
  is what tripling HP's price is supposed to do — but Sentinel and Bellows are 50 HP lighter and
  Cube 40, and the walls are the lines most likely to want a second look.

Enemies were **not** re-based. Faction lines (flat 400), champions (550) and the Endbringer (900)
carry no Mana and are authored against a measured baseline that assumes the discount, so they
still price HP at `HP_BUDGET_VALUE` = 0.5.

### What a point of HP is worth (measured 2026-09-08)

The codebase now holds three answers, which disagree by 4×:

| | Budget points per 1 real HP | Where |
|---|---|---|
| Hero stat lines | **1.0** | `heroStatTotal`, `src/run/statBudget.ts` |
| Enemy stat lines | 0.5 | `HP_BUDGET_VALUE`, `src/run/statBudget.ts` |
| Equipment rarity tiers | ⅓ (was 0.25 until 2026-09-11) | `HP_PER_POINT`, `src/run/equipment.ts` |

The lower two predate the doubling and neither was ever measured. Every budget figure in the
game (the roster's 550, a faction's flat 400, a champion's 550, the Endbringer's 900) still goes
through `statBudget.ts`, so changing a rate changes every budget test at once rather than
silently re-ranking the roster.

**What it is worth, measured** (`scripts/statprice.ts`, 2026-09-08). Mirror matches: identical
squads at level 5, one stat grant differing, sides swapped, 2400 fights a cell. Both sides cost
the same 40 budget points, so the win rate IS the relative price.

| HP granted per point | vs +40 Atk/+40 Int | vs +20 Def/+20 Wis |
|---|---|---|
| 1 (what the roster charged BEFORE the doubling) | 28.7% | 29.7% |
| 2 (what it charges now) | 37.3% | 39.6% |
| 3 | 49.6% | 49.5% |
| 4 (what equipment charges) | 59.3% | 59.4% |

**Break-even is 3.0 HP per budget point on both challengers** — an HP rate of ≈0.33. So no
figure in the table above is the measured one: the roster (now 1.0) over-charges HP three-fold,
enemies (0.5) by half, and equipment under-charged by a quarter at 0.25 until 2026-09-11, when
it was set to the measured rate outright — every item and Evolution HP grant was re-authored as
points × 3 (Greataxe/Plate 45/75/75/105/135, Evolutions 15/30/45/60), per user direction, so
the printed figure IS the priced one.

This settles the direction, and the roster re-base above knowingly went the other way. The
doubling had halved what the roster charged for HP, moving it from badly over-charged toward
fair without overshooting into a gift; 550-at-face-value gives that back and more. If the walls
read as weak in playtest, this measurement is why, and the fix is the rate — not their lines.

**But the price is not linear, and that is the real finding.** Re-spending a hero's OWN budget
— 30 points out of HP into offense at the current rate — wins only **52.5% ±0.76**, and helps
exactly 18 of 36 heroes. Adding HP on top of a full pool is weak (37%); taking it off a thin one
is dangerous. A flat rate is a compromise that is roughly right in the middle of the roster and
wrong at both ends, so a rebase to a single number would be trading one approximation for
another. Leave 0.5 until something else forces the question.

**Where the tanks' real advantage comes from.** A round robin (every hero vs every other, four
copies a side, no gear) puts correlation between authored HP and win rate at **0.110** — HP
explains about 1% of the variance, and Bellows and Sentinel both field 300 HP at 76.7% and 31.4%.
Movepools dominate. What did not show up there was `itemSlots: 2`, then authored on the nine
heroes at **Speed ≤ 40** — and in this roster Speed is anti-correlated with HP, so those nine were
precisely the nine highest-HP heroes (250–300). The same squad holding two items beats itself
holding one **79.3% ±0.76**, a bigger edge than any stat grant measured here. The tanks were
strong, and the slot was why. **Resolved 2026-09-08: the dial is gone and every hero starts on
one slot** (per user direction — see "Items (per-hero)" above). The HP rate was left at 0.5.

## Are the squishy casters weak? (measured 2026-09-08 — NO, not as a class)

Asked directly, because it is the obvious next suspicion after the item-slot pass. Round robin,
every hero vs every other, four copies a side, level 5, no gear:

| group | mean win rate |
|---|---|
| magical (Int > Atk) | 49.0% (n=14) |
| physical | 50.6% (n=22) |
| HP ≤ 200 | 49.2% (n=18) |
| HP > 200 | 50.8% (n=18) |
| **squishy casters** (magical AND HP ≤ 200) | **51.6%** (n=11) |

The archetype is fine — slightly above the roster mean. What is not fine is the **spread inside
it**: Lucius 78%, Brimstone 75%, Trance 68% and Crimson 66% sit in the roster's top four, while
Zenith 14%, Coil 34% and Cortex 38% sit at the bottom. A class-wide buff to squishy casters would
mostly inflate the four heroes who least need it. **The variance is per hero, not per archetype**,
so this is movepool work on named heroes, not a stat-total pass.

**Zenith is the one large outlier and its line is not the cause.** 190 HP / 85 Int is a normal
caster spread; its starting kit is Mana Tap (Base Power **20**), Infuse and Empower. It is an
Arcane mana battery whose kit is built to feed a partner, so a round robin fielding four copies of
it measures the one thing it cannot do. Rerun with each side carrying a fixed neutral partner and
it still lands at 13.9%, so the kit is thin even when the support has somewhere to go — but the
fix is a move, not a stat.

**Two redistribution routes were measured and both are dead ends**, which is why the lines were
left alone until the 2026-09-09 re-base:

- **HP → offense** (30 points, `budget` mode): shifted line wins **52.5% ±0.76**, helping exactly
  18 of 36 heroes. Near-neutral, so the current HP pricing is close to right at the actual lines.
- **Mana Pool → HP** (20 points, `mana` mode): shifted line wins **43.4%** overall — 38.3% on
  physical heroes, 51.2% on magical. Mana Pool correlates at −0.34 with win rate across the
  roster, the strongest single-stat signal there is, and cutting it still makes heroes **worse**.
  That correlation is confounded: casters carry big pools (mean 71.8 against physical 53.0) and
  are weaker for reasons of their own. A stat that saturates is not a stat you can sell.

---

`scripts/sim` IS deterministic by seed. Until 2026-09-08 it silently dropped ~15% of every batch:
`bestWearer` compared item ids where the game's rule (`holdsItem`) compares FAMILIES, so the sim
kept picking a hero already holding an enchanted sibling and throwing inside `equipToRoster`.

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
  investing levels, Scrolls and a Crucible. That runway **decays late-run**: there's
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
direct gold purchase — a new axis alongside hero recruitment. A bought equipment item goes
to the bag like every other equipment grant, and the Hall stays open around the purchase. Tapping a hero offer opens its full stat/move sheet, which
is where the gold is actually spent (2026-08-28 — `HeroPreviewOverlay`'s `action`).

**Second pass (2026-08-31, per user direction).** Four changes, all of them about the
Hall asking before it takes:

- **Relics are no longer sold at all.** `RELIC_PURCHASE_COST`, `buyRelic` and
  `GuildHallOffers.relicOfferIds` are gone; relics stay a reward-only axis (the Banners, from
  Guardians — the `relicReward` Shrine node was itself deleted on 2026-09-07). A shop that sells one of everything makes gold the only decision on the screen.
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

### A hire arrives RAW (2026-09-10, Growth Overhaul phase 5)

**A Guild Hall hire is unbuilt.** It arrives at the act's hire level with the growth those
levels earned, and nothing else: **no Evolution, Mastery Rank 1, its own authored three moves**
(`guildHallEntry`, `src/run/guildRecruit.ts`). Every decision about what it becomes is still the
player's, and that is the whole of what 50 gold buys.

It is the opposite half of a **contract** hero, which arrives **finished** — the enemy you beat,
entire: its Evolution chosen, the rank its level bought, a kit the game picked. You save six
Scrolls and a Crucible on a contract, and in exchange you authored none of it. That makes
contracts and Crucibles partially substitutable, which makes both more interesting than either
was alone (`docs/growth-overhaul.md` §6).

**RAW is unbuilt, not hollow.** The hire's levels are still ROLLED through `levelUpEntry`, seeded
off the offer so the preview and the purchase land on the same stat line. A level-13 hire with no
growth grants would be ~120 points behind a level-13 roster hero — not an archetype, just a waste
of 50 gold. It never carries the act's enemy stat scaling; that axis stays enemy-side.

**The hire level is DERIVED from the level curve**, not authored beside it: a hire arrives at the
level the roster held when this act began, plus one (`GUILD_HALL_ACT_LAG`, `guildHallLevel`).
The old `GUILD_HALL_LEVEL_BY_ACT` = 2 / 4 / 5 / 6 / 7 was written against a 10-level cap; against
30 it would have put an Act 3 hire at level 5 with the roster at 18 — not underlevelled, unusable.
Deriving it means phase 6 retunes `LEVEL_AFTER_ENCOUNTER` once and this follows.

**That fixed act-sized gap IS the "decaying runway value"** the raise-vs-recruit axis is named
for: one act is most of the run early and a fifth of it late, so the same lag is worth most in
Act 1 and least in Act 5. It answers the NOT-YET-IMPLEMENTED note above.

**The LEVEL axis points the right way again** since phase 6 re-derived `ENEMY_LEVEL_BY_ACT` off
the same curve, at a smaller lag: an enemy trails the player's act-end level by
`ENEMY_LEVEL_LAG` = 2 (**6 / 12 / 17 / 22 / 26**) where a hire trails by a whole act
(**2 / 9 / 15 / 20 / 25**). So a contract hero out-levels a hire at every act, and §6's fourth
axis reads the way its table says. It ran BACKWARDS between phases 3 and 6, and
`test/recruitment.test.ts` carries the assertion that would catch it going backwards again.

Gold cost is untouched at a flat 50g. Whether that is right for a hire that now buys strictly
less than it used to is open.

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
