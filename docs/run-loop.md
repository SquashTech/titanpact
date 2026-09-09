# run-loop.md — The Escalating-Fight Run Loop

> Module of the Titanpact `/docs` suite. Companion to `combat.md`, `progression.md`,
> `mana.md`, `architecture.md`, `locations.md` — which owns the layer directly
> above this one: **which place** an act happens in, and how that biases the encounter
> pools §2 describes — and `lore.md`, which owns what §4's finale *means*. The map/node structure that turns the single fixed
> demo fight into the roguelike run CLAUDE.md's north star describes: draft →
> escalating fights → relics.

Slay the Spire is the direct reference (per user direction, 2026-08-16): a branching
map of nodes, most of which reward something (a Guild Hall shop, equipment, a relic,
gold, or a hero upgrade), interspersed with fights and Elite fights, all culminating in
an end-of-act boss fight against a **Guardian**. Renamed from Ancient on 2026-08-29
(per user direction): "Ancient" is being reserved for something later in a run, and now
refers only to the `types-and-heroes.md`-locked type — a rare, boss-only "near-total
defensive wall". The boss encounter itself is unchanged; only what the map calls it is.

**This pass now chains 5 acts** (2026-08-17 revision, per user direction — see "Multi-act
sequencing" below), each built from the uniform per-act shape in §1.

---

## 1. Map shape

`src/run/map.ts` generates a deterministic (seeded) branching map for **one act**; a run
chains `TOTAL_ACTS` of them (§3 "Multi-act sequencing"). Per-act row layout
(2026-08-17 revision — was a looser weighted-random spread across rows 1-4, which let a
path skip from the opening fight straight to the funnel with only reward-node luck in
between; per user direction, the shape is now forced and uniform):

- **Row 0: a single forced `fight` node.** Slay the Spire convention — the act always
  opens on an easy, unambiguous fight, no early reward-node luck and no meaningless
  first choice among identical-weight openers.
- **Row 1: 3 nodes, pick 1 of 3 — reward types only** (`equipmentReward`/`passiveReward`/
  `gemReward`/`currencyReward`/`upgradeReward`/`forgeReward`/`hpBoostReward`/
  `manaBoostReward`/`event`, weighted). No
  `fight`/`shop`/`elite`/`classReward` mixed in — every reward row is a genuine reward
  choice, not a chance to draw another fight or dodge one, and `classReward` is reserved
  for its own forced Mentor row (2026-08-22 revision, per user direction — see the Mentor
  row note below), never a random pick-1-of-3 option. In acts 4 and 5 one seat on one of
  the act's two pick-3 rows is taken by a forced `tutorReward` (see "The Tutor" below); the
  other two seats roll normally, so the row still offers three distinct things.
- **Row 2: a single forced `skirmish` node.**
- **Row 3: 3 nodes, pick 1 of 3 — reward types only**, same pool as row 1.
- **Row 4: 2 nodes, pick 1 of 2 — `elite` or `battle`** (2026-08-17, per user direction:
  "give the player the option to fight the Elite OR a regular Battle"). `elite` is the
  act's difficulty spike (+10 to 2 stats on all 4 AI heroes); `battle` is a plain,
  no-bonus alternative — same risk profile as `skirmish`, just later in the act. Always
  presented as a real choice (see edges, below), not one that depends on luck.
- **Row 5: 3 nodes, pick 1 of 3 — reward types only** (2026-09-08, per user direction), same
  pool as rows 1 and 3. A third reward row, affordable once the map stopped having to fit its
  well ("A map that scrolls", below): the act had two reward seats to spend across a
  nine-type pool, so its rarest cards were being drawn about once a run.
- **Row 6 (funnel): the act's one guaranteed spend.** A single `shop` node in acts 1-2, and a
  `shop` + `blacksmith` **pick 1 of 2** from act 3 on ("The Blacksmith", below). Every
  path converges here — the standard Slay the Spire "everything narrows before the boss" beat.
- **Row 7: the single `boss` node** — the act's Guardian.

The upshot: every act is exactly **Fight → pick 1 of 3 → Skirmish → pick 1 of 3 →
(Elite or Battle) → pick 1 of 3 → (Guild Hall or Blacksmith) → Guardian** — no path through
an act ever skips a fight, and none arrives at the funnel holding only half the fork.

**The Mentor row (acts 1-4).** Acts 1 through 4 each splice one extra forced single-node
`classReward` row into the shape above, giving them 9 rows against Act 5's 8. It sits
**immediately before the Skirmish** (2026-09-05, per user direction — it was immediately
*after*, and Act 1 only, until then), so the Class is in hand for the act's first
recruitable fight rather than arriving just after it. A Mentor act therefore reads
**Fight → pick 1 of 3 → Mentor → Skirmish → pick 1 of 3 → (Elite or Battle) → pick 1 of 3
→ (Guild Hall or Blacksmith) → Guardian**, and its Skirmish lands one row later than Act 5's (`MENTOR_ROW`,
`LAST_MENTOR_ACT`, `skirmishRowFor`, `src/run/map.ts`). Both are single-node rows, so no
path can bypass either.

**Act 5 deliberately has none** — a different beat is being designed for it (2026-09-05,
per user direction). It is currently the only act on the bare 8-row shape, which is why
`test/map.test.ts` uses Act 5, not Act 2, wherever it indexes rows by hand.

**The Blacksmith (act 3 on).** From act 3 the funnel widens to two and the act's guaranteed
spend becomes a fork: the **Guild Hall** trades in people and new gear — recruits, Recruit
Contracts, a 4-item shelf, and (2026-09-08, per user direction) **selling** from the bag, behind a
row that opens it rather than laid out inline — the bag is the one list here whose length is the
player's rather than the offer's, and a full one pushed what they came to buy off the panel —
while the **Blacksmith** works on gear already owned: an item slot, a tier at the Anvil, an
element at the Enchanter. One verb family each, so neither node needs explaining twice.

Acts 1-2 keep the single Guild Hall. The early roster is still forming, and the Guild Hall is
the only shelf of heroes in the run — a fork that can cost a player their recruit shelf wants
an act with some gold already in it. The reward row feeding the funnel **fully connects** to
both: the fork is the point, and a seed must never decide it. Since 2026-09-08 the Elite/Battle
row is wired the same way and by the same rule (§1) (`generateMap`, `src/run/map.ts`).

The Blacksmith's slot is the dearest thing in the run — `SLOT_PRICE_BY_TARGET` charges 120 for a
hero's second and 200 for its third, against an act income of roughly 50-120g. It has to be:
the same grant is what the free `forgeReward` node hands out, and that node sits at the lowest
weight on the reward row precisely to keep slots scarce. Gold buys a way to *pay* for that
scarcity, never a way around it — the relationship the Anvil already has to buying a tier
outright (`docs/equipment.md` §5).

**Tiles with no names (2026-09-08, per user direction).** A nine-row act did not fit the well at
the old 84px rows. Rather than pay for the extra row in scrolling, the tiles dropped their
LABELS: the glyph, the silhouette tier and the colour already carry what the word did —
recruitability included, since `fight`/`battle` draw a claw and `skirmish`/`elite` a helm
(`nodeIcons.tsx`) — and a long press still reads any node out in full. That took rows to 56px and
the tier min-widths from 74/92/106/124 to 46/58/66/84, which fits nine rows inside the well with
room to spare.

This supersedes the two-word Monsters/Skirmish label vocabulary of 2026-08-29 (CLAUDE.md), which
had already moved difficulty onto colour and glyph; the names now live only in each tile's
`aria-label` and in its long-press card.

**The map does not show the act (2026-09-08, per user direction).** It shows where the player is
standing and the two or three places they may go from there. The whole-act graph — the fixed-row
grid, the measured SVG edge overlay, the scroll anchoring — is gone.

The measurement that made this safe: across 40 seeds of an act, only **two of seven branch
points actually route anywhere**. A reward row feeding the Mentor, a reward row feeding the
funnel, and the funnel feeding the Guardian all reach the same places whichever option is taken.
The two that matter are the reward row that STEERS into Elite-or-Battle, and the Elite/Battle row
itself, whose two options open different rewards on the row above. So the graph was spending the
entire well to price two decisions.

Those two are priced by the choice cards instead. Each card carries an **"Opens" chip** naming
what taking it leads to, drawn only when the options on the row differ (`leadOnTypes`,
`leadOnsDiffer`, MapScreen.tsx) — if every option reaches the same places the marker is noise
and is not drawn. It is derived from `nextIds`, never authored, so a change to the generator
shows up in the UI for free.

What the whole-act view gave away for free and was worth keeping is an act's SHAPE, and the
**progress rail** replaces it. It was one pip per row at first — an act's length, the current one
lit, the last drawn as the Guardian rather than dotted, because "how many more" and "what is at
the end" are the same question.

That answered *how far* and left *how hard* to be discovered a row at a time, so since
**2026-09-08** (per user direction) every row is marked by what it makes you do (`railTypeFor`,
MapScreen.tsx): a bare dot for a row that only pays out, and the node's own glyph, in its own
colour, for one that does not. Every forced fight in the act, its kind and its difficulty, are
readable before the act starts — the whole planning surface a scene-map can afford, in the room
the pips already had. A row offering more than one thing wears the **hardest** of them, so the
rail never under-promises: Elite-or-Battle shows the Elite. What is behind the player fades on
both mark kinds; colour means ahead.

Note what did NOT change: `RunMap`, `generateMap`, `reachableNodeIds`, `advanceToNode` and the save
format are all untouched, and every map test still passes without edit. The act still HAS its
shape; the player is simply walked through it rather than shown it.

Four Mentors means a run can Class up to four heroes rather than one, since the offer
filters to heroes with no Class yet. Measured (`scripts/sim`, 40,000 runs at 3× XP), that
took the Classes from statistically inert — every one of the sixteen inside ±0.03 lift —
to a real spread: Berserker +0.20 (z 2.4) and Warden +0.17 (z 2.1) at the top, Warrior
−0.19 (z −2.4) at the bottom. Whether that spread wants flattening is now a live question
where it previously could not even be asked.

**The Tutor seat (acts 4-5).** Acts 4 and 5 each guarantee exactly one `tutorReward`
(2026-09-07, per user direction). Unlike the Mentor it gets **no row of its own**: it is
spliced into one of the act's two pick-1-of-3 reward rows, row and column both rolled off
the map seed (`TUTOR_ACTS`, `TUTOR_ROW_WIDTH`, `src/run/map.ts`). That placement is the
whole balance argument. The Tutor is the strongest single reward in the run — an exact
move, chosen rather than rolled — and giving it a forced row would have handed it out
free; sitting it inside a reward row prices it against the Forge, the Boon, the Gem and
the item cache it displaces, which is the only price a reward row can charge. It rolls one
fewer weighted reward and takes the freed seat rather than overwriting a rolled one.

It is deliberately lategame-only: before act 4 a hero's own pool is still mostly ahead of
it and the level-up curve is handing out moves anyway, so the node's answer to "what would
you rather have" would be "a move I was going to get". By act 4 the roster is at or near
`MOVE_CAP` with an Evolution behind it, and what the player actually lacks is a *specific*
move — usually one a level-up offered once and they declined, or one gated behind a tier
they will not reach. The Tutor is absent from `REWARD_WEIGHTS`, so those two seats are its
only source in a run.

Edges connect each node to 1-2 nodes in the next row within a small column window, with
a repair pass guaranteeing every node (row 1+) has at least one incoming edge — no
orphaned nodes. Given the forced single-node rows above, this repair pass in practice
means the single fight/skirmish node before a 3-wide reward row always ends up connected
to all 3 of them (nothing else exists to claim the "leftover" reward nodes), so the "pick
1 of 3" framing holds for real — no reward option is ever silently unreachable. The row
feeding into the Elite-or-Battle row is a special case on top of that. Its source row is
3-wide and its target row 2-wide, so the generic windowed-edge algorithm would present
both options only sometimes, depending on which reward node was picked. That row
transition is therefore overridden to **fully connect** every row-3 node to both row-4
nodes, exactly like the funnel row below it.

Between **2026-08-26** and **2026-09-08** it instead **steered** — left → Elite only,
middle → both, right → Battle only. The guarantee was intact but narrowed: the middle
node always kept both open, so no path ever lost the choice; what the player could not do
was take a specific *side* reward and keep it. The motivation was visual as much as
mechanical, full-connect being the only place the map drew crossing edges.

It was **reverted on 2026-09-08** (per user direction), and by the thing that motivated
it. Steering only works as pricing if the price is *visible when it is paid*, which the
whole-act graph made true for free. With the map now a scene showing one row at a time
(`MapRoute`), a reward two rows back quietly closing an encounter is a rule the player has
to hold in their head rather than see — and the crossing edges it was drawn to avoid no
longer exist either, because a single row of two options cannot cross. Both consequences
are pinned by tests (`test/map.test.ts`: "every node in the reward row above Elite-or-Battle
keeps both options open", and "…has nothing left to signpost", which asserts the lead-on
markers derive themselves off that row).

This is still simpler than Slay the Spire's real path-weaving generator, but it is enough
to prove branching *choice* within a row.

## 2. Node types

**What the map calls them (2026-08-29, per user direction).** The four encounter types
share **two** player-facing names, not four. `fight` and `battle` both read **Monsters**;
`skirmish` and `elite` both read **Skirmish**. The split is recruitability — the one fact
a player needs before choosing a route — and difficulty is carried by colour and glyph
instead (`MapScreen`'s `NODE_COLORS`, `nodeIcons.tsx`: `--enemy` the soft opener,
`--ally` a standard fight, `--crit` the Elite spike; Monsters wear a claw, Skirmishes a
helm, the Elite that helm under a crown). `boss` reads **Guardian**. The type *ids* below
are unchanged; this is labelling only.

The two channels are deliberately **not** redundant — name for recruitability, colour for
difficulty. Making colour agree with the label instead was tried and reverted the same
day: moving `battle` to `--enemy` put it next to `elite` on row 4, the act's one real
difficulty choice, in two reds a shade apart (#d9534f vs #ff7043).

| Type | Resolution |
|---|---|
| `fight` | `FightScreen` vs. a generated 4-hero AI squad (`src/run/enemyGen.ts`), no bonus. Always row 0, each act's opening node — draws from the non-recruitable enemy pool (Goblins), not the draftable hero roster. |
| `skirmish` | Mechanically identical to `fight` (same 4-hero, no-bonus `generateEncounter` call — App.tsx collapses it to `EncounterNodeType: 'fight'`), but draws from the **recruitable hero pool** and is named differently on the map (2026-08-17, per user direction) so the player can see, before committing a squad, that beating this one is a shot at a Recruit Contract claim. Always row 2. |
| `battle` (map-facing name "Monsters", 2026-08-22 revision) | Also mechanically identical to `fight`/`skirmish` (collapses to `EncounterNodeType: 'fight'`), but draws from the **non-recruitable enemy pool**, same as `fight` — not `skirmish`'s recruitable pool. Row 4's non-Elite alternative to `elite`. **2026-08-23 revision, per user direction:** no longer a plain `generateEncounter` call over the whole enemy pool — `App.tsx`'s `handleSelectNode` calls the dedicated `generateLeaderEncounter` (`enemyGen.ts`) instead, which always fields the Location faction's leader plus 3 random draws from its basics. This is what makes `battle` a real, considerably-tougher alternative to `elite` rather than a same-difficulty reskin of the opener — see "Goblin roster" and "Factions, and the Cultists" below for the content this draws on. |
| `elite` | The AI's 4 heroes each carry a flat +10 bonus to 2 random growth stats. Draws from the recruitable pool, same as `skirmish`/`battle`. Row 4's difficulty-spike alternative to `battle` — the player picks one or the other, never both. |
| `boss` | `FightScreen` vs. **2 of the Location faction's basics** (no bench — a real no-cycling fight), each with a flat +20 bonus to 3 random growth stats. Hero-pool escorts until 2026-09-06 — see "The Guardian's escorts" below. Winning grants 1 Recruit Contract, the Guardian's Banner in acts 1-4, and ends the act (§3). **2026-09-01 exception:** a location may hold a **faction champion** on the boss's bench — see "The Guardian's champion" below. |
| `shop` | `ShopNodeScreen` — the existing `GuildHallPanel`, given an exit for the first time. Overhauled 2026-08-18: offers 2-3 curated hero recruits (50g each, `GUILD_HALL_RECRUIT_COST`) rather than the full catalog, plus a rarity-priced equipment shelf, rolled once per visit (`src/run/shop.ts` `rollGuildHallOffers`). Second pass 2026-08-31: relics are no longer sold anywhere, the shelf is 4 wide and readable on its face, sold stock greys out, and Recruit Contracts confirm before buying (`docs/progression.md` "Second pass"). |
| `equipmentReward` ("Item") | `NodeRewardScreen` — pick 1 of 3 items, rarity-weighted (`equipment.ts` `pickWeightedEquipment`); claiming bags it and lights the Roster badge — see "The bag notification" in `docs/progression.md`. Items are uncategorised as of 2026-09-06, so the three on offer are simply the three rolled (`docs/progression.md` "Uncategorised slots"). |
| `currencyReward` | `NodeRewardScreen` — an instant flat gold grant (15-30, more for nothing having been spent yet). **2026-09-08, per user direction:** it pays out on arrival and the screen counts the PURSE up to its new total, coin by coin, over a Claim button that was never a decision — the drop size is a chip beside a number the player can act on, rather than a number they cannot. `upgradeReward` shares the beat, counting the level-up pool. |
| `upgradeReward` | `NodeRewardScreen` — an instant flat grant to the pooled level-up currency (2-3 points), on top of the per-fight-win grant (see below). |
| `forgeReward` ("The Forge") | `ForgeScreen` — pick one roster hero to gain **+1 item slot** for the rest of the run (`runProgress.ts` `grantItemSlot`, stored on `RosterEntry.bonusItemSlots`, capped at `MAX_ITEM_SLOTS` = 3). **2026-09-06**, replacing the three slot-specific cache nodes (`weaponReward`/`armorReward`/`accessoryReward`), which lost their meaning when items stopped having categories — most of their frequency went to `equipmentReward`, whose weight went 20 → 40. The scarcest thing on the reward row (weight 8) on purpose: it is permanent, it compounds with every drop after it, and it is the only reward here a hero can be at the cap for — a roster entirely at 3 slots makes the node a dead draw, which is what makes spending it a choice — and at the 2026-09-07 cap of 3 that arrives materially sooner. |
| `gemReward` ("Gem Cache") | `GemChoiceScreen` — pick 1 of 3 stones and take `GEM_NODE_STACK` = 4 of it. See "Gems" below. |
| `passiveReward` ("Boon") | `BoonNodeScreen` — pick 1 of 3 passives, then the hero it settles on (`grantEventPassive`, stored on `RosterEntry.bonusPassiveGrants`). See "Boons" below. |
| `hpBoostReward` ("Vitality Shrine") | **2026-09-09, per user direction:** hands over Emerald ×`GEM_NODE_STACK` through `GemChoiceScreen` with the offer fixed to one, exactly as the Mana Well does. It no longer makes the player pick a hero at the node — Gems are placed at the player's leisure and moved again later, so a shrine that forced the choice on the spot was asking a question the Gems page answers better. Name, tint and place-flavour unchanged; `StatBoostScreen` and `grantStatBonus` were deleted with the old grant. |
| `manaBoostReward` ("Mana Well") | **2026-09-05, per user direction:** this no longer makes the player pick a hero. It hands over Sapphire ×`GEM_NODE_STACK` through `GemChoiceScreen` with the offer fixed to one. Its name, tint and place-flavour are unchanged; only the grant is. Its twin, the Regen Spring (`manaRegenBoostReward`), was deleted with Peridot on 2026-09-07. |
| `classReward` ("Mentor's Hall") | `ClassNodeScreen` — pick 1 of 3 Classes (`src/data/classes.ts`), then pick which roster hero learns it, filtered to heroes with no Class yet (`src/run/classes.ts` `grantClass`, stored on `RosterEntry.classId` — a hero can hold at most one Class per run, so `grantClass` REPLACES rather than stacks). If every roster hero already has a Class, the offer is simply wasted. The screen names the heroes it CAN still teach, portraits and all, while the three disciplines are being read (2026-09-08) — that filtered roster is the whole reason to take or leave one, and it used to be a screen away behind the roster glyph. **Not in `REWARD_WEIGHTS`** (2026-08-22 revision, per user direction) — the only way to encounter this node type is a forced Mentor row (§1), never a random pick-1-of-3 option in any act. Acts 1-4 each guarantee one, so a run can Class up to four heroes; the offer filters to heroes with no Class yet and is wasted only once every hero has one. |
| `tutorReward` ("Tutor") | `TutorNodeScreen` — pick one roster hero, then **any** move from that hero's level-up pool. See "The Tutor" below. Acts 4-5 only. |
| `event` | `EventNodeScreen` — rolls one of the authored map events (`src/data/events.ts`, `src/run/events.ts`) and resolves it: a move taught to a chosen hero, a Passive taught to a chosen hero, a flat stat trade, or a pile of act-curve loot dropped straight into the bag. Which event a node turns out to be is rolled once at node-select time and gated by act and Location. See **docs/events.md**. |

The stat bonuses above are the **node-kind** axis only — what `elite` costs relative to
`battle` *within one act*. Every encounter node also carries the **per-act** axis on top
(§3 "Per-act difficulty scaling"), so an Act 4 `elite` fields its +10×2 plus six
act-steps, and its heroes arrive at level 7 already evolved.

### The two reward lanes (2026-09-01, per user direction)

The Monsters / Skirmish split used to be a **naming + pool** split only: both lanes paid
the same kind of reward, graded by difficulty, so `elite` simply out-paid `battle` on
every axis at once and row 4's Elite-or-Battle pick collapsed into "how hard a fight do
you want." The per-win payout tables in `App.tsx` (`goldRewardFor`, `trainingPointsFor`,
`EQUIPMENT_DROP_CHANCE`/`LOOT_SOURCE`, all keyed on `EncounterMapNodeType` — the **map**
node type, since `skirmish` and `battle` are indistinguishable once collapsed to
`EncounterNodeType`) now make the two lanes pay in different currencies:

| Node | Lane | Training Points | Gold | Equipment drop |
|---|---|---|---|---|
| `fight` (row 0 opener) | Monsters | 3 | 15-25 | **always**, act's standard curve |
| `battle` (row 4) | Monsters | 3 | **30-45** | **always**, act's standard curve |
| `skirmish` (row 2) | Skirmish | **4** | 15-25 | 25%, act's standard curve |
| `elite` (row 4) | Skirmish | **4** | 15-25 | 55%, **one tier ahead** (`rarityWeightsFor(act, 'elite')`) |
| `boss` | Guardian | **4** | 0 | 70%, one tier ahead |

Training Points are the **Act 1** figures; every act past the first adds `ACT_XP_STEP` to each
(§3). The table above sat at 1/1/2/2/2 until 2026-09-06, which was two income passes out of date —
it is read off `BASE_TRAINING_POINTS` now.

**The opener pays 3, not 2 (2026-09-06, per user direction).** Reaching the Evolution costs 10
pooled points, and an act paid 9 on its Battle route against 10 on its Elite one — so whether a
player who poured an act into one hero could evolve before that act's Guardian came down to a
routing choice made two rows earlier, for reasons they could not see. Both routes clear it now
(10 and 11). Making the all-in *affordable* is the intent: it is a real plan with a real cost, the
rest of the roster sitting at level 1 with catching up to do, and it should be the player's
decision rather than the map's. The point went on the opener because row 0 is forced in every act,
so it lands on every route — putting it on `battle` would have reached only the short route and
flattened the Elite's XP premium, which is this whole split. Run income goes 145 → 150.

- **Monsters is the loot-and-gold lane.** The guaranteed drop was previously a hard-coded
  special case for the row-0 opener; it is now the lane's rule. `battle` additionally
  carries the fat gold band. The opener is held at the thin band on purpose — it is
  deliberately the run's lightest fight and already ships a free item, and making it the
  map's richest gold node would undercut everything after it.
- **Skirmish is the XP lane.** Double the Training Points, plus the recruitable pool
  (the Recruit Contract shot), paid for with the thin gold band and a drop that is a roll
  rather than a promise. `elite` buys rarity, not quantity.
- **Row 4 is now a real trade.** `elite`: 2 points, a recruitable roster, 55% at a
  tier-ahead item, against a harder fight. `battle`: 1 point, double gold, a certain
  item, against an easier one.

**The Guardian pays 2, down from 3-4.** The old figure was the specific complaint — too
much of the run's currency landing in a single beat — and it is no longer load-bearing
now that the Banner (§3, always granted in acts 1-4) is the fight's headline reward.

Net effect on the curve: an act pays **6-7 Training Points**, down from 8-11.

**Scarcity is the point, and it prices two other things up.** The cut is deliberately
more than a trim — it changes what a Training Point is worth relative to every other
way of gaining power, and two of those get sharper:

- **The raise-vs-recruit pivot** (`docs/progression.md`). A contract hero arrives at
  the act's enemy level — 5 in Act 3, 7 in Act 4, 10 in Act 5 (`ENEMY_LEVEL_BY_ACT`,
  `src/run/difficulty.ts`). Against an act that pays 6-7 points, claiming a level-5
  hero mid-run is close to *four acts* of banked leveling arriving in one spend, on a
  hero chosen because they fit the plan the run has actually turned into. That is the
  intended shape: **strategic churn should be a live option, not a concession.** A
  hero who is lagging is meant to be pivotable away from, and the scarcer the pooled
  currency is, the more a ready-made replacement is worth against pouring more points
  into the laggard. The roster cap (6, gaining requires terminating) is what keeps this
  a decision rather than a free upgrade.
- **The `upgradeReward` node** (2-3 points) is now worth roughly a third to a half of
  an act's entire fight income in a single pick-1-of-3. Its value is deliberately
  swingy: near-worthless to a player whose roster is already where they want it,
  near-decisive to one holding a hero two levels short of an Evolution branch point.
  That spread is the node doing its job — it is the strategic pull toward Evolution
  the node was kept for (§4), and the XP cut is what gives it teeth.

### The Tutor

**2026-09-07, per user direction.** `tutorReward` → `TutorNodeScreen`. Pick a roster hero,
then pick **any one move** off that hero's own level-up pool and it is taught outright. The
node grants through `grantMove` — the same free faucet an event's gift uses, not
`grantLevelUpMove` — so teaching a move does **not** spend a level-up offer, and the pool
the hero's remaining levels draw from is untouched.

What "its own level-up pool" means is `tutorMovePool` (`src/run/tutor.ts`), and it is
deliberately wider than the pool a level-up draws from:

- **The authored pool**, `progressionTable.moveTiers[heroId]`, entire.
- **Plus everything the Evolution paths the hero actually took brought with them** — both
  the moves a path JOINS to the pool (`learnableMoveIds`) and the ones it GRANTED outright
  (`unlocksMoveIds`). The second half is the interesting one: an Evolution grant refused at
  `MOVE_CAP` is otherwise gone for the rest of the run, and the Tutor is the only thing in
  the game that can hand it back.
- **Not tier-gated.** A level-3 hero may be taught a Late move. "Any of them" is the node;
  the mana cost is what stops a level-3 hero casting it.
- **Not filtered by `offeredMoveIds`.** A move offered once and declined is still on the
  shelf — that hole is most of what the node exists to fill.
- **Not filtered by what the hero currently holds.** Known moves are listed and greyed in
  place rather than hidden, so the list reads as the hero's whole repertoire rather than as
  a leftovers bin.
- **The starting kit is absent**, because it was never learned from a level-up. A starting
  move swapped away is still gone for good; whether the Tutor should also recover those is
  open (below).

At `MOVE_CAP` — which by act 4 is the normal case — the pick hands off to the same
replace-or-decline panel a level-up move offer uses, so nothing about the swap is new to
the player. Every hero on the roster is eligible however many Tutors they have already
used; a hero whose pool is exhausted is shown greyed with "pool exhausted", and a roster
where every hero is exhausted lets the player walk on rather than stranding them.

**Open (flagged, not decided).** Three calls above are inferences from "the player can
choose ANY of them" rather than designer decisions: (1) that a chosen Evolution path's
`unlocksMoveIds` join the shelf; (2) that the shelf is not tier-gated; (3) that the
starting kit stays off it. Each is a one-line change in `tutorMovePool`.

### Boons (2026-09-07, per user direction)

The **Boon** node hands one hero a **passive**, permanently, for the rest of the run. It is the
salvage of the deleted relic pool: the passive Idols were the only relics that felt like anything,
and what made them unusable was not the effects but the *scope* — applied to all four heroes at
once, a passive is either a bigger Gem or an unanswerable one. Given to a hero the player chooses,
the same effect is a build decision.

Same three-phase shape as the Mentor, because it is the same kind of decision: select a Boon,
confirm, then tap the hero, then a reveal. Mechanically it is `grantEventPassive` — the verb the
run events already use — so a Boon is an ordinary entry in `RosterEntry.bonusPassiveGrants` and
nothing in the engine learns the word.

**The pool has two halves** (`src/run/boons.ts` `boonPool`):

- **The roster-agnostic half** — every equipment and event passive (`boonPassives`, ~17). All of
  them are live on any hero, so they are always eligible.
- **The type-locked half** — one per type, +20% damage with that type's moves
  (`typeDamagePassiveFor`, `TYPE_DAMAGE_BONUS`). Four of these existed as passive relics; the
  other ten are new, generated from a name table rather than authored one by one. **Ancient has
  none**, the same call the Ancient Force relic made: nothing can reach an Ancient move.

**Excluded on purpose:** Evolution passives (a path's passive IS that path's identity, and handing
Firestarter to anyone would dilute every Evolution) and Classes (their own node).

**The type filter is what makes the type-locked half possible.** A type Boon is offered only when
some roster hero actually fields that type, type-grafts included. Unfiltered it would be fourteen
entries against seventeen, so a typical 1-of-3 would show two grants nobody could use and the node
would read as "did I roll my type" rather than as a choice. Filtered, a type Boon is never dead
and is usually the strongest card on offer — which is what makes passing it up for a generic one
a real decision.

**The filter stops at the offer, and the hero-pick phase says so.** It guarantees *somebody* on
the roster fields the type; it cannot stop the player putting the Iron Boon on the Water hero. So
the second phase prints how many of each hero's unlocked moves the Boon would fire on
(`boonMoveCount`), reddened at zero. It is not a block: heroes carry a few off-type moves by
design (`docs/types-and-heroes.md`), and a hero can unlock more of a type later, so a thin pick is
the player's to make.

**A Boon stacks.** `bonusPassiveGrants` appends, so a second Bloodthirst on the same hero is a
build rather than a wasted pick, and every hero stays eligible however many they hold. The card
says what they already carry.

**Open — the weight is a first pass.** 18 in `REWARD_WEIGHTS`, just under the Gem Cache's 20 and
taken from the same pot the deleted Relic Shrine freed. It is the only reward-row node that
changes how a hero *plays* rather than how big its numbers are, which argues for scarcer; it is
also the node most likely to be the reason a run comes together, which argues for commoner.
Playtest.

### Gems (2026-09-05; rebuilt per-hero 2026-09-09, both per user direction)

A **Gem** is **per-hero stat investment**: a flat **+5** to one stat (**+10** for HP), socketed
into ONE hero rather than granted to the team. There are **seven**, one per stat except MP Regen,
each named for the stone whose colour the stat already wears (`src/data/gems.ts` `gemList`):

| Stat | Gem | Stat | Gem |
|---|---|---|---|
| HP | Emerald | Speed | Citrine |
| Attack | Ruby | Intelligence | Amethyst |
| Defense | Onyx | Mana Pool | Sapphire |
| Wisdom | Aquamarine | | |

**Why they left the relic axis.** As a team-wide +5 they were satisfying to collect and carried
no decision — the offer asked which stat, never which hero, and the game had no way at all to
express "I want to build THIS one". The per-hero version is the EV analogue: the player pours
stones into the heroes they are actually building, and the pouring is the fun.

**Peridot is gone (2026-09-07).** MP Regen is a flat 10 on every hero, so +5 was +50% of a
*throughput* stat, and throughput compounds over a fight in a way a buffer does not. It read as
the correct pick from every offer it appeared in, which is the opposite of what a 1-of-3 is for.
It lives on the Wellspring Banner instead. **Worth re-asking** now that a Gem is per-hero and
priced against a cap rather than free — restoring it is one entry in `GEM_TABLE`.

#### The two caps

`GEM_CAP_PER_HERO` = **20**, `GEM_CAP_PER_STAT` = **8** (`src/run/gems.ts`). They do different
jobs, and the pair is load-bearing:

- The **per-hero** cap is the anti-funnel lever. Pokémon has no equivalent — every Pokémon can
  max its own 510 — but here the pool is shared across a roster, so without it a run is one
  runaway carry and three passengers.
- The **per-stat** cap forces spread *within* a hero. 20/8 means at least three stats to fill
  one, the same "two maxed and change" shape as 510/252.

The cap is **flat**, not scaled by level or act. Tying capacity to level would make Gem
investment and Training Point investment pull the same direction — a stronger carry fantasy, but
a cap whose job is limiting concentration cannot grow with the thing players concentrate.

`gemCapacityFor` is the one place capacity is decided, the same rule `itemSlotsFor` follows.

#### Re-allocation is free, and freezes at node-select

Gems move between heroes and between stats **freely and unlimitedly, at no cost**, from the map.
This is what makes the rework safe for roster churn: a hero terminated in Act 4 is not a hero's
worth of Gems lost, and a late recruit is one tap from wearing the run's whole pile. It replaced
an earlier permanent-allocation design whose refund-on-termination and catch-up-grant-on-recruit
patches were both trying to buy exactly this.

**Where it happens: the Gems board, Manage Roster's second tab** (2026-09-09, per user
direction, after playtest). `GemBoard` is the Gear board's twin — a tray of the unspent pool
along the bottom, the same six `HeroSlotCard`s above it, and one tap-then-tap to move a stone.
It replaced setting Gems on the hero sheet, which cost four steps a hero (roster → sheet → Gems
page → back out) for a job the Gear board does in one. Two departures from the Gear board, both
because Gems arrive four and five at a time: a held stone **stays held** after it lands, so a
stack is poured with repeated taps, and **holding a hero pours every one that fits**. Taking
them back is the same gesture inverted — tap a hero's stone chip for one, hold it for all of
that stat. The hero sheet keeps its Gems page as the detail view (per-stat pips, Pull all), one
tap away from the board.

It **freezes from node-select onward**. `SquadSelectScreen` generates the encounter at
node-select time specifically so the enemy squad can be scouted before the player commits — so a
Gem spread still fluid after the scout means the optimal play is counter-tuning every single
fight. Two reasons that is the wrong game:

1. **The counter-pick layer already exists and is better.** Bring-6-pick-4 against a scout is a
   real decision; if Gems can also answer a bad matchup, the player tunes around it instead of
   bringing a different hero, and the sideboard gets *less* interesting.
2. It is the whole tedium defence. Re-tuning happens when the player decides to, not under
   optimization pressure at all ~25 encounters.

Gems answer "who is my team", not "who am I fighting". Node commit is already final (there is no
back affordance on `SquadSelectScreen`), so the freeze lands on a boundary the player already
understands. The freeze is enforced by ENTRY POINT rather than by a flag: the Gems board lives on
Manage Roster, which only the map opens, and `HeroPreviewOverlay` shows its Gems page only when
handed the run. A sheet opened from anywhere else simply has no dial.

#### The pool is derived, never stored

`RunState.gemsEarned` is every Gem the run has paid out, per stat. `RosterEntry.gemAllocation` is
where they currently sit. The spendable pool is **the difference** (`gemPool`), never a third
stored number. That is what makes free re-allocation safe rather than merely convenient:

- A Gem cannot be duplicated or lost by any code path.
- Terminating a hero returns its Gems **by construction**, not by a rule somebody has to
  remember to write.
- A save whose roster holds more than the run earned is *refused* (`save.ts`), because that is
corruption rather than a negative pool.

#### Where they come from (`src/run/gems.ts`)

- **Every won fight pays a stack**, sized by node type: `fight`/`battle`/`skirmish` **2**,
  `elite` **3** (`GEM_FIGHT_STACK`). The Guardian pays none — it already pays a Banner, and a
  Gem on top would blur which grant the act-boundary spike came from. The finale pays none: the
  run ends on it.
- **The `gemReward` node and the two shrines** pay `GEM_NODE_STACK` = **4** — the Gem Cache as a
  1-of-3, the Vitality Shrine as Emeralds and the Mana Well as Sapphires. Bigger than a fight's,
  because a whole map node bought it.
- **Every payout is a choice.** A fight offers a 1-of-3 of stats and a node offers the same at
  four times the size; the two shrines are the fixed grants. The old 30-50% drop ROLL is gone —
  it existed to keep two runs from holding the same Gems, and the player picking the stat does
  that job better. A fight that paid nothing would now just be a fight that skipped its reward.

**All first-pass placeholders for playtest; only the shape is decided.** Income rose roughly 4x
with the rework and that is deliberate in two ways. Power parity alone would have argued for
less — concentrated stats are worth more than spread ones, so 40 points aimed at two stats on
two heroes beats 40 spread over seven stats and four heroes. But **a cap only does anti-funnel
work when income runs well past ONE hero's worth**: at 28 a run against a cap of 20 the player
fills one hero and the cap never binds, which IS the funnel. Somewhere near 2 to 2.5 hero-loads
by the end of a run is the interesting zone, and that is what the current figures aim at.

**Always listed, held or not.** The run sheet shows all seven Gems from the first node of a run,
dimmed at ×0 (`RunRelicsPanel`, `.relic-rail`), counting what the RUN has collected wherever
those stones currently sit. An unheld Gem is a slot to fill rather than an absence.

**Open — the flat +5 is not priced by stat, and there are three HP prices in the repo.** The
roster stat budget charges HP 1:1 (2026-09-09), equipment's `STAT_POINT_VALUE` charges ½, and the
Emerald grants 2×. Team-wide Gems hid the mismatch because everyone got everything; per-hero and
capped, "Emerald or Ruby?" is an explicit player question at every allocation, so whichever stone
is mispriced becomes the auto-pick — exactly the failure mode that killed Peridot. **This wants a
decision before the numbers are tuned.**

### Winning a fight: the post-fight gates

A won encounter resolves through up to five gates before the map comes back
(`App.tsx handleFightResolved`), in this order:

0. **The Gem offer** (`GemChoiceScreen`) — every won fight but the Guardian and the finale,
   a 1-of-3 of stats paid as a stack. See "Gems" above.
0. **The Guardian's Banner** (`GuardianBannerScreen`) — boss nodes only; a fixed 1-of-3
   team-wide relic, ahead of everything else remaining so a hero recruited at gate 1
   arrives under it. See §3.
1. **Recruit Contract claim** (`RecruitScreen`) — the beaten recruitable heroes, up to
   `MAX_CONTRACT_OFFERS` = 2 of them (`recruitment.ts pickContractOffers`). **Skipped
   entirely when the player holds no contracts**, and when nothing beaten was
   recruitable: the run goes straight on rather than opening a screen whose offer cannot
   be taken. On a boss node the act-end contract (§3) is granted *before* this check, so
   it is spendable on the heroes that boss fight just beat.
2. **Training Point allocation** (`LevelUpScreen`), if the pool is non-empty.

The item drop is no longer a step here: it is banked into the bag as part of the same
`RunState` transform as the gold and the XP, and the map's Roster badge is what says so
(`docs/progression.md` "The bag notification" and "The uncapped bag").

Recruiting comes first on purpose: the gear and the Training Points this same win paid
out can then go to the hero who just joined, instead of arriving one node too late for
them. **2026-08-28, per user direction:** the claim used to be a band inside
`FightScreen`'s victory overlay — two portrait buttons under the gold/XP chips — which
priced a permanent roster decision below the item drop above it. It is now its own
screen, standing on the draft's stage (see `docs/visual-language.md`).

`contractReward` (an instant flat grant of 1 Recruit Contract) was **removed as a map
node type** (2026-08-17, per user direction: contracts should come from Guild Halls and
act-end grants, not map-node luck) — see §3 "Multi-act sequencing" for where that grant
moved to.

`fight`/`battle` vs. `skirmish` (2026-08-17, per user direction; pool split revised
2026-08-22) is purely a **naming + pool** split, not a difficulty one — App.tsx's
`handleSelectNode` picks the encounter pool off `node.type === 'fight' || 'battle'` (mob)
vs. anything else (recruitable), then collapses `skirmish`/`battle` down to the
`EncounterNodeType` `'fight'` before calling `generateEncounter`/`FightScreen`, which only
need the mechanical shape (heroCount/stat bonus), not which map node it came from.

## 3. Decisions locked for this pass (2026-08-16 sign-off, multi-act entry 2026-08-17)

- **Multi-act sequencing (2026-08-17, per user direction).** A run now chains
  `TOTAL_ACTS` acts (`src/run/state.ts`) instead of ending at the first boss — 5 of the
  §1 shape, then the finale act (§4).
  `RunState.actNumber` (1-indexed) tracks which act is current. On a boss-node win
  (`App.tsx handleFightResolved`): grant 1 Recruit Contract
  (`runProgress.ts grantContractReward` — this is where the removed `contractReward`
  map node's grant moved to), then if `actNumber < TOTAL_ACTS`, call
  `runProgress.ts advanceToNextAct` (fresh `generateMap` seed, `currentNodeId`/
  `visitedNodeIds` reset to the new act's start row, `actNumber` incremented) and return
  to the map screen; otherwise show "Run Complete." Roster, gold, relics, and Recruit
  Contracts all carry over between acts — only the map itself and per-act position reset,
  same "fully restore HP/mana between nodes" spirit already locked below, just at the
  act boundary instead of the node boundary.
- **Per-act difficulty scaling (2026-08-30, per user direction).** Resolves the open
  question this bullet used to carry ("difficulty does not yet scale by act number").
  `src/run/difficulty.ts` is a pure `(track, actNumber) -> ActScaling` table;
  `enemyGen.ts` applies what it returns. `App.tsx` reads the track off the node type and
  the act off `RunState.actNumber` — nothing else in the run loop participates.

  **Why act-indexed.** Locations are drawn in random order (`locations.md`), so act
  number is the only stable measure of run depth. Without this, an Act 2 power level
  fight can land in Act 5.

  **Two tracks, differing only in baseline act** — they scale at the same rate:

  | Track | Node types | Baseline act | Why |
  | --- | --- | --- | --- |
  | `monsters` | `fight`, `battle` | **2** | ⚠️ Placeholder. Per-act monster content does not exist — every act still fields Goblins (`locations.md` §5). Declaring today's Goblin roster the *Act 2* baseline lets the curve be written now and the content authored later: whatever monster roster ships is tuned to feel right in Act 2 and the curve carries it forward. Act 1 clamps to zero steps rather than going negative (the row-0 opener is meant to be the run's weakest fight, not a debuffed one), so **Acts 1 and 2 currently field identically-scaled monsters** — a known consequence of the placeholder, not a curve decision. |
  | `skirmish` | `skirmish`, `elite`, `boss` | **1** | The hero roster is authored and already sits at the power level a run starts at, so it starts scaling right away — every act past the first adds a step. Guardians stay on this track even though their escorts are faction content since 2026-09-06: the track is what makes the act's apex fight scale like an apex fight, and moving it to `monsters` would have cut the champion's own curve by 4 steps in Act 5, at the end of the run that measures easiest. |

  **One act-step = +30 to an enemy's stat total** — 3 distinct growth stats at +10 each
  (both figures satisfy CLAUDE.md's multiples-of-5/10 rule; +10×3 over +5×6 so a step is
  felt where it lands rather than smeared). Each step rolls its **own** 3 stats and the
  steps merge, so a deep-act enemy has a broad line rather than +40 in one stat.
  This is a **second, independent axis** on top of the node-kind bonuses in §2 — kind
  says how hard a fight is *for its act*, the curve says how deep the act is.

  **How many steps: `ACT_STEP_CURVE`, and it ACCELERATES (2026-09-05).** The number of
  steps is a cumulative table indexed by how many acts past the track's baseline —
  `[0, 1, 3, 6, 10]` — not the linear `act − baselineAct` it started as. So a Skirmish-track
  Act 5 enemy takes 10 steps (+300), and an Act 4 `elite` carries its +10×2 **plus** 6
  act-steps.

  It has to accelerate because the player's power curve does. Measured over 40,000
  simulated runs (`scripts/sim`), under the linear curve the enemy's fielded stat total grew
  by **+239, +161, +90, +87** across the run while the player's grew by **+254, +192, +364,
  +399**. The two cross at Act 4 — exactly where Guardian win rates ran away (57% → 89% →
  99%). The player accelerates because Banners stack one per act and the gear-rarity window
  opens late (Act 5 drops 34% legendary / 27% mythic; Act 1 drops neither). The enemy
  decelerated for two reasons, and the second is the sharp one:

  - the step was flat, so it never compounded; and
  - **`ENEMY_LEVEL_BY_ACT` is inert for a Guardian's champion.** Every champion ships a
    full 4-move kit, so `MOVE_CAP` leaves no room for level-up moves, and `appendFinalEnemy`
    never calls level progression at all. A champion's `level` is a label; levels 7 and 10
    buy it nothing. The stat curve is the *only* live lever on it.

  Index 1 is deliberately left at 1 step: Act 2 is already the hardest Guardian in the run
  and needed no help. After the change the player/enemy stat ratio at the Guardian is flat
  across the run (1.13 / 1.10 / 1.16 / 1.16 / 1.15) where it used to diverge to 1.44.

  > **A flat ratio does not produce a flat win rate, and should not be tuned until it does.**
  > Guardian win rates still rise late (Act 5 ≈ 81%) because the population reaching Act 5 is
  > self-selected — only strong runs get there. Scaling hard enough to force a flat win rate
  > would mean the enemy *out*-growing the player, which is a different design statement.
  > The ratio is the thing this curve is tuned against.

  **Enemy level by act: 1 / 3 / 5 / 7 / 10.** Level is not a stat multiplier (CLAUDE.md:
  no automatic stat growth), so it buys exactly two things, both intended: it gates
  Evolution at `EVOLUTION_LEVEL = 5` — which is why the table jumps 3 → 5 at Act 3, so
  **from Act 3 on every hero-pool enemy arrives already evolved** — and it is how many
  move unlocks a hero has had, so a scaled enemy fills toward the 4-move cap instead of
  fighting on its 3-move starting kit. Both are cashed in by `enemyGen.ts` in the same
  order a player's hero earns them (Evolution first, remaining level-ups on moves). The
  Evolution path is picked at random with no weighting — choosing the path that best
  suits a hero is authored design, deliberately not guessed at by the generator, and is
  the natural seam for hand-authored encounters to take over. On the `monsters` track
  level is currently cosmetic (the Goblin pool has no progression data), but it is the
  honest tier label and starts working the moment monster content gets a table.

  **Measured baseline** — mean enemy stat total (HP+Atk+Def+Int+Wis+Spd through
  `getEffectiveStat`, 40 seeds per act), for reading playtest against:

  | Act | `elite` | `boss` (Guardian) | `battle` (Goblin Chief node) | Level |
  | --- | --- | --- | --- | --- |
  | 1 | 392 | 432 | 218 | 1 |
  | 2 | 422 | 462 | 218 | 3 |
  | 3 | 464 | 504 | 248 | 5 |
  | 4 | 494 | 534 | 278 | 7 |
  | 5 | 524 | 563 | 308 | 10 |

  Note Act 2 → 3 climbs ~42, not the flat 30: that act also turns Evolution on, and the
  chosen path carries its own stat grant. The Act 3 spike is therefore the largest in
  the run by design — it is where enemies stop being unevolved.

  Note too how far the `monsters` column sits below the others. The Goblin roster was
  authored as deliberately-weaker fodder, and the curve moves it without fixing that —
  more evidence that the Act 2 monster baseline is content still owed, not a number to
  tune upward here.

  **Open, and deliberately so:**
  - **Every number is a first-pass figure**, per the direction that set them: only the
    curve's *shape* is decided. Tune by playtest.
  - **Stats are drawn uniformly, and a point of HP is not a point of Attack** (the
    equipment budget already prices HP at ½ — `STAT_POINT_VALUE`). So an enemy that
    rolls its steps into HP is a genuinely easier fight than one that rolls offense.
    Acceptable variance for a first curve — `elite`'s existing bonus has the same
    property — but weighting the draw by `STAT_POINT_VALUE` is the knob to reach for
    before changing the totals.
  - **Recruit Contracts carry the whole thing.** `deriveContractOffer` already carries
    `level`, `chosenPathIds`, `evolutionStatGrants` and `unlockedMoveIds`, so claiming a
    beaten Act 4 enemy hands the player a level-7, already-evolved hero holding ~90
    points of act scaling. That is the existing behaviour amplified (elite's +20 always
    rode along the same way) and it reads as the intended meaning of "recruiting them
    gets them at the same level" — but it makes late-act contracts dramatically stronger
    than early-act ones. Flag before assuming it stays. The knob is
    `deriveContractOffer`, not the curve.
  - **Authored encounters are the intended successor,** not a rewrite of this. The
    generator takes an `ActScaling` rather than deriving one, so a hand-built encounter
    can hand over its own numbers — or ignore the table entirely — through the same seam.
- **The Guardian's Banner (2026-08-30, per user direction; widened to five 2026-09-07).**
  Beating an act's Guardian
  grants a second reward on top of the Recruit Contract: a **fixed 1-of-5 relic choice**
  (`GuardianBannerScreen`), shown after the wins that end **acts 1-4** and not after act
  5's, whose Guardian ends the run — a team-wide permanent handed to a finished run is a
  choice with nothing to spend it on. Not a map node; it hangs off the boss win itself
  (`App.tsx` `handleFightResolved`, `Screen` kind `guardianBanner`), and it goes **first**
  in the post-fight chain, ahead of the recruit/equip/level-up gates, so a hero recruited
  in that same beat already arrives under the banner.

  The five options never change and never roll — **one per axis**, so a run's five picks are a
  spread-or-commit decision across the whole stat line rather than across HP and mana:

  | Banner | Grant |
  |---|---|
  | Banner of Vitality | Team-wide +30 HP |
  | Banner of the Warcry | Team-wide +20 Attack, +20 Intelligence |
  | Banner of the Bulwark | Team-wide +15 Defense, +15 Wisdom |
  | Banner of Swiftness | Team-wide +20 Speed |
  | Banner of the Wellspring | Team-wide +40 Mana Pool, +10 MP Regen |

  **The two-stat Banners are not the same shape.** A hero swings with Attack *or* with
  Intelligence, never both, so the Warcry's two stats are worth *one* stat to any given hero and
  are priced at full value — it is one offensive Banner that refuses to be a trap for either half
  of the roster. Defense and Wisdom are both live on every hero, because everyone is hit by both
  pipelines, so the Bulwark's two are worth two and are priced at +15 each. The Wellspring pairs
  both halves of the mana axis because neither carries a pick alone: pool saturates (below), and
  MP Regen alone was the auto-take that got Peridot deleted.

  Being **fixed** is the design, not a placeholder. Because the same five come back every act,
  the real decision is *spread them or commit to one axis*, and that only becomes a decision if
  the player can see all five offers coming from act 1. There is no random relic pool for one to
  leak into any more (2026-09-07); `RelicDefinition.guardianBanner` is now display grouping only.

  **Stacking** needs no new mechanism: duplicate relic ids already sum in
  `relicTeamStatModifiers`. What is new is how a stack is *written* — one card named
  `Banner of Vitality +2` carrying the summed `+90 HP`, rather than three identical cards
  (`src/view/shared/relicStacks.ts`, used by `RunRelicsPanel` and `RosterPeek`). The suffix
  counts copies **beyond the first**, the upgrade-pip convention: 3 copies reads "+2". Like
  every relic, a banner applies to heroes obtained before *and* after it — the grant is
  broadcast to the side at fight-build time (`entryStats.ts`), never written onto a hero.

  **Open balance question — the five are not equal, and the Wellspring is still the one to
  watch.** Against the roster's averages (~105 HP, ~58 Mana pool, a flat **10** MP Regen on
  every hero, ~55 in each combat stat), +30 HP is about +29%, +20 Attack about +36%, +15 Defense
  about +27%, +20 Speed about +36% — and the Wellspring's +10 MP Regen alone is **+100%**, with
  +40 Mana Pool on top of it. Regen is throughput, not a one-time buffer, so over a six-round
  fight it is worth ~60 mana; that is also the side of the ledger CLAUDE.md's mana-tuning
  invariant ("mana investment must pay out later than the point at which a weak team dies") is
  most sensitive to. Mana pool is the counterweight and it **saturates** — batch simulation
  measures +50, +150 and +300 identically, a fight ending long before a deeper reserve is
  reached — so most of the Wellspring's measured value is the regen half. The balance-pass
  alternative on record is dropping it to **+5 MP Regen**. Flag before hardening either way.

  **Also open: five Banners against five Guardians means a run can now take one of each.** With
  three options and four picks, spreading was forced to double up somewhere. It no longer is,
  which makes "one of each" the obvious default line and commit the deliberate deviation from
  it. Whether that reads as a real decision or as a flat menu is exactly what the next playtest
  should answer; the knob if it does not is offering **3 of the 5** per Guardian.
- **Relics: stat-only, by design.** `src/run/relics.ts` still carries `grantsPassiveIds` and
  `grantsStatusIds` — the team-wide grant shapes the pipeline supports — but as of 2026-09-07 no
  shipped relic uses either, and the ~50-relic random pool that did is deleted. Playtest found
  those relics collapsed into two buckets: a bigger Gem, or a passive that was unanswerable
  applied to all four heroes at once. Interesting effects live per-hero on equipment now, where
  an item slot prices them. Reaching for a team-wide passive again should be a decision, not a
  refill of the old pool.
- ~~**Boss = existing fixture heroes, scaled up, not new Guardian content.**~~ **CLOSED
  (2026-09-01 / 2026-09-06).** Every Location now names an authored champion, and since
  2026-09-06 the escorts beside it are that Location faction's own basics rather than
  fixture heroes — the boss encounter is authored content on both halves ("The Guardian's
  champion" and "The Guardian's escorts" below). Note this is
  also where a real **Ancient** would land, if the reserved name becomes its own
  late-run encounter rather than a rename of this one.
- **Non-recruitable enemy content (2026-08-16, second playtest).** The opening row's
  fight nodes were drawing AI squads from the same recruitable hero pool the player's
  own early roster is still built from — a structural 2v4 (2 starting heroes vs. 4
  fielded AI heroes), independent of how the fight is tuned, and it burns a real hero
  concept as disposable fodder besides (CLAUDE.md's north star: every hero must be
  viable, not "the thing you curb-stomp in fight 1"). Per user direction: `src/data/
  enemies.ts` is a separate, deliberately-weaker content pool (`goblinGrunt`,
  `goblinSkulker` — same `HeroDefinition` shape as a hero, just weaker numbers; a
  Goblin doesn't need a different schema, it needs different numbers), and `fight`
  nodes draw from it instead of `src/data/heroes.ts` (`App.tsx`'s `handleSelectNode`,
  gated on `node.type === 'fight'` — moved here from `handleSquadConfirmed` in the
  2026-08-16 battle-preview pass below, since the encounter now has to exist before
  squad-select renders it). `src/run/recruitment.ts`'s new
  `isRecruitable(heroId, recruitablePool)` gates Recruit Contract offers on membership
  in the caller's recruitable pool specifically — never the combined pool a fight
  actually drew from — so a defeated Goblin can never produce a contract offer;
  `App.tsx`'s `handleFightResolved` filters the claim
  offer through it, and `handleClaimContract` re-checks it as the actual
  RunState-mutation boundary, not just the UI. `src/data/content.ts`'s `allCombatants` (`{ ...heroes, ...enemies }`) is what
  combat resolution and fight-screen rendering actually key off of — they don't care
  which pool a combatant came from, only recruitment does. This was a mechanism + a
  first-pass curve (originally row 0 only) — **2026-08-22 revision, per user
  direction:** `battle` nodes (row 4, map-facing "Monsters") now also draw from
  `enemies.ts`, to read as "non-recruitable" the way the name implies, distinct from
  `skirmish`'s recruitable squads.
- **Goblin roster (2026-08-23, per user direction).** `enemies.ts` grew from the
  original 2 mono-Beast Goblins to 5 basic, mono-typed Goblin variants —
  `goblinGrunt` (Beast), `goblinSkulker` (retyped Beast → Shadow), `spookyGoblin`
  (Spirit), `goblinWarrior` (Iron), `torchGoblin` (Fire) — plus a considerably
  stronger `goblinChief` (mono Beast, wielding a powerful team-wide buff move,
  War Horn). Originally ~2x the basic Goblins' stats; **+100 HP on 2026-09-02, per
  user direction**, taking him to 210/425 — he was a step up on every stat except
  the one that decides whether a fixed threat gets to be a threat at all, and died
  on the same timetable as the support he was meant to anchor. All of it in HP, so
  he outlasts the player's opening rather than out-hitting it. The 5 basic ids live in
  `factions.goblins.basicIds`; `goblinChief` is never drawn randomly.
  `handleSelectNode` specializes both mob-fight node types on this split: the row-0
  `fight` opener draws exactly 2 random heroes from the faction basics
  (`generateEncounter(..., heroCountOverride: 2)`), and the row-4 `battle` node
  ("Monsters") calls the dedicated leader generator (`enemyGen.ts`), which always
  fields `goblinChief` alongside 3 random draws from the faction basics — a fixed
  threat backed by variable support, rather than a
  fully random 4-pick. This is what makes `battle` a real, harder alternative to
  `elite` instead of a same-difficulty reskin of the opener. Generalised into
  `FactionRoster` on 2026-09-02, below — the ids named here now live on
  `factions.goblins`. Which rows/node types pull from which pool, and how
  the pool itself scales by act number, is still open balance work, not
  architecture work.
- **Factions, and the Cultists (2026-09-02, per user direction).** The mob pool is no
  longer one flat list with Goblin-shaped constants around it. `enemies.ts` exports
  `factions`: a `FactionRoster` is `{ baselineAct, basicIds, leaderId }`, a Location names
  one through `LocationDefinition.factionId`, and `handleSelectNode` reads it —
  `basicEnemiesOf(faction)` for the `fight` opener, `generateLeaderEncounter` (the renamed
  `generateGoblinChiefEncounter`; the function was already generic, only its name was not)
  for `battle`. `guardianFinalEnemyId` deliberately stayed on the **Location** rather than
  moving into the faction: the four locations still pointing at the Goblin default were
  never meant to inherit a Goblin Lord (`locations.md` §3).
  The **Cultists** are the first faction authored for an act other than Act 1, and the
  first content to use `FactionRoster.baselineAct` — `actScaling` takes it as an override
  on the `monsters` track, so the roster *is* an Act 2 encounter as written and takes
  +30 stats per act above that (Act 3 +30, Act 4 +60, Act 5 +90). Four basics —
  **Cult Blade** (Shadow/Iron, physical), **Dread Cultist** (mono Shadow, caster with
  Drain sustain), **Blighted Cultist** (Shadow/Nature, Poison), **Frozen Cultist**
  (Shadow/Frost, Deep Chill into Glaciate) — each a flat **400** combat stat total
  against the Goblins' ~180. **Revised the same day, per user direction:** they were
  first authored at ~280, under the weakest hero (325), on the theory that a mob belongs
  below the hero band; an Act 2 squad carrying two acts of equipment just deletes that,
  so they now sit level with the *strongest* hero instead. Their **mana was left where it
  was** (50-65 pools, 12 MP Regen) and that is the brake — they hit like the top of the
  roster and run dry like a mob. The leader is the **Cult Mystic** (Shadow/Arcane, 500 —
  only a quarter clear of its own support, far flatter than the Goblin Chief's 1.8x,
  because its edge is Enfeeble and Empower rather than a bigger healthbar), whose Empower
  hands a basic 80 mana — more than any of their pools hold, so the overflow rule
  (`mana.md`) is what the faction's leader does for a living. The Guardian
  champion is **Yugzulach** (Shadow/Ancient, 700), and authoring him took Runic Blast and
  Forgotten Curse off the unreachable-move list they had sat on since Ancient was written
  as filler.
  Two consequences worth naming rather than discovering later: every Cultist leads on
  **Shadow**, so Light and Spirit answer the whole Location at once (open question,
  `locations.md` §6), and the faction is four basics rather than five, so a `battle` node
  there shows three of four every time — thinner variety than Wild's Edge's three of five.
- **The Guardian's champion (2026-09-01, per user direction).** A Location may name one
  enemy id (`LocationDefinition.guardianFinalEnemyId`, `locations.md` §3) that is placed
  on the **enemy bench** of that act's Guardian fight — `enemyGen.ts`'s
  `appendFinalEnemy`, called by `handleSelectNode` after the boss encounter is
  generated. The bench is the whole mechanism: the AI never switches voluntarily
  (`FightScreen`'s `pickAiAction` only pivots on a `switchesUserOut` move), so the one
  way this combatant reaches the field is the **forced replacement after an enemy KO**.
  He is therefore the last thing to walk on, and he walks on at the moment the fight
  had started going the player's way. This is the first authored exception to "boss = 2
  heroes, no bench" above, and it is deliberately not a general widening of it: every
  other location's field is `null`.

  Wild's Edge's is the **Goblin Lord** (`enemies.ts`) — Beast/Ancient, 550 stat total,
  20 MP Regen, four moves across four types (Claw, Maul, Enfeeble, and the
  Ancient row authored for him, Archon Blast). He is enemy-pool content, so
  `isRecruitable` excludes him by pool membership exactly as it does every Goblin: a
  beaten Goblin Lord produces no contract offer. He carries **no node-kind stat bonus** —
  the 550 is the authored number and the escorts' +20×3 is not applied to it — but he does
  take the **act curve**, which is the only thing that ever moves a champion (`ENEMY_LEVEL_BY_ACT`
  is inert for one; see §3).

- **The Guardian's escorts are its own faction (2026-09-06, per user direction).** A `boss`
  node now draws its two active enemies from `basicEnemiesOf(factions[location.factionId])`,
  the same pool `fight` uses, instead of from the recruitable hero pool. Flavour first —
  a champion is the apex of the warband the act has been fighting, not a pair of wandering
  adventurers — and it makes the Guardian the one fight where the act's faction shows up
  in full: two basics in front, its champion behind.

  Three consequences, all deliberate:

  - **A Guardian no longer offers a Recruit Contract.** Its enemies are enemy-pool content,
    so `isRecruitable` rejects them by pool membership. Contracts now come only from
    Skirmish/Elite claims, the per-act grant, and the Guild Hall — the boss pays a Banner.
  - **The pool moves; the scaling does not.** The escorts still ride the `skirmish` track
    and still take the boss's +20×3 node bonus, so they are faction bodies on the Guardian
    curve rather than a mob fight with a boss stapled on.
  - **Act 1's Guardian got much lighter**, because the Goblins are the one faction authored
    as fodder (~180 a body against every other faction's 400). Measured over 20k simulated
    runs: the Wild's Edge Guardian went **31.7% → 75.5%** and Act 1's clear rate 13.4% → 32.0%.
    Acts 2-5 barely moved on this change alone — a 400-stat basic is a hero-sized body.

  **The champion nerf that came with it (2026-09-06, per user direction).** The five
  non-Goblin champions were **700 → 550**, the Goblin Lord's already-tuned figure, cut out of
  HP and the offensive stats with Speed left alone. The simulator had the Act 2 Guardian at
  **3-10%** against the same locations' Act 3 Guardian at **30-67%**, and human playtest agreed
  that Act 2 was where runs ended.

  **Where the Act 2 cliff actually comes from**, since the first write-up of this pass got it
  wrong and blamed the champion. A champion DOES take the act curve — `appendFinalEnemy` applies
  `actStatBonus(rng, scaling.statSteps)` — so a 550 champion is fielded at 550 / 580 / 640 / 730 /
  850 across acts 1-5. What is flat is its **base**, and its **level**, which is inert. Between
  Act 1 and Act 2 the champion moves +30. The **escorts move 235 → 490**, because the Goblins are
  the one faction authored as fodder (~180 a body) and every other faction is a flat 400, while
  the player's own fielded total grows about 13% over the same act. The step is at the faction
  boundary, not on the Guardian curve; the champion cut absorbed it at the boss.

  So the levers still open are the faction line (a Goblins-to-400 step with nothing between it,
  or an Act 2 faction authored nearer 300) and `ACT_STEP_CURVE` index 1, still held at 1 step
  under a comment saying Act 2 needs no help. Not "make champions scale" — they already do.

  After both changes, over 20k runs: Act 2 Guardians **18-41%** (from 1.4-9.2%), Act 2's clear
  rate **3.0% → 20.1%**, Act 3 **57.7%**, Act 5 **77.2%**, full clears **0.1% → 1.6%**. The
  Guardian is now the second-easiest node kind in the run after the row-0 opener, and `elite`
  is the hardest fight in every act — a finding to sit with rather than act on immediately.
  What is still open: the back half is easier than it was, because a base that fits Act 2 is
  generous by Act 5 even with the curve on top.

  **He cannot be skipped.** `sideDefeated` (FightScreen) tests every combatant on the
  side, bench included — not just the two active slots — so a round that KOs the whole
  Guardian pair at once does not end the fight. The post-round forced-replacement loop
  fills a slot from the bench and play continues. This is a normal fight against an
  enemy team of **three**; the Lord is simply the third enemy, and the bench is about
  *when* he arrives, never *whether*.

  **He is concealed until he arrives (2026-09-01, second pass, per user direction).**
  `SquadSelectScreen` scouts the whole enemy roster, which would have handed the player
  his name, portrait, stat line and movepool before a command was given — the entrance
  would still have been a surprise of timing, and nothing else. His scout chip is a
  **silhouette and its typing** instead, and it opens no stat sheet
  (`view/shared/entrances.ts`, the same set that drives the entrance itself). Typing is
  deliberately kept: the player has to be able to build a squad against this fight, and
  "there is a Beast/Ancient in here somewhere" is the difference between a hard read and
  an unfair one. What is withheld is everything that would let them pre-solve it.

  **The entrance is presentation, not a Field Effect.** It sets nothing on the
  battlefield and changes no rules — `view/shared/entrances.ts` names the hero ids that
  get it, `buildBeats` flags the beat, and the veil/lurch/horn/music-drop hang off that
  flag. See `visual-language.md`.
- **HP/mana fully restore between map nodes (reversed 2026-08-16, first playtest).**
  The original pass persisted HP/mana across nodes (`RosterEntry.currentHp`/
  `currentMana`, clamped to max on the next fight) on the theory that escalating
  fights need resource tension carried across the run. First playtest hit the failure
  mode head-on: a hero KO'd in an early fight simply stayed at 0 HP into the next one —
  permanently bricked for the rest of the run, with no rest-site node type (see below)
  and no in-run way back. That's not tension, it's a dead roster slot. Per user
  direction, persistence was removed: `buildCombatState.ts`'s `placeEntry` now always
  starts every fielded combatant at full HP/mana (computed after equipment/Evolution
  stat modifiers, same as the LOCKED full-starting-pool decision in `mana.md`).
  `RosterEntry` no longer carries `currentHp`/`currentMana` fields, and
  `runProgress.ts`'s `syncRosterVitals` was deleted. If run-length resource tension is
  wanted later, it needs a different lever than raw persistence — e.g. a cost gated on
  the *choice* to fight (mana/HP entry cost) rather than an ambient penalty a KO'd hero
  can't do anything about.
- **No passive recovery between nodes in this pass** — no rest-site node type; moot for
  HP/mana now that fights fully heal on their own, but still relevant for anything a
  future resource-tension mechanic reintroduces.
- **Squad selection happens before every fight/elite/boss node, not once per run.**
  Discovered during implementation: CLAUDE.md frames the bring-6-pick-4 sideboard as
  VGC-style team preview, which is inherently per-battle, not a once-per-run
  commitment. `GuildHallPanel` was pulled out of `SquadSelectScreen` accordingly — it
  now lives exclusively behind `shop` map nodes, so Guild Hall access stays a map
  choice rather than being freely available before every fight.
- **A run ends on loss, not a retry-in-place.** The old single-demo-fight "Rematch"
  button is gone. Losing a fight/elite/boss node ends the run (a "Run Failed" screen);
  winning the boss node ends it as a "Run Complete" screen. Both offer "Start New Run"
  — a fresh `RunState` and a fresh `generateMap` seed. There is no meta-progression
  layer yet (`progression.md` "Per-run reset vs. meta-progression" is decided but NOT
  YET IMPLEMENTED) — a new run currently starts from the same fixed 2-hero roster
  every time, not from an unlock pool.
- **Battle preview before squad-select (2026-08-16, second playtest).** Encounter
  generation (`generateEncounter`) moved from `handleSquadConfirmed` to
  `handleSelectNode`, so the AI squad exists before `SquadSelectScreen` renders — that
  screen now shows a "Scouted enemies" section (the node's generated squad, both active
  and bench) alongside the player's own roster, both with an info button opening a new
  `src/view/run/HeroPreviewOverlay.tsx` (full stat table + moves + equipment, computed
  directly from `RosterEntry`/`HeroDefinition` rather than a live `Combatant` since no
  fight exists yet).
- **Training Points now paid out per fight win, not only via `upgradeReward` nodes
  (2026-08-16, second playtest; retuned 2026-08-26, relaned 2026-09-01).** `App.tsx`'s
  `trainingPointsFor` keys on the **map** node type — 1 for Monsters (`fight`,
  `battle`), 2 for Skirmish (`skirmish`, `elite`) and for the Guardian. The previous
  difficulty grade (1 / 2 / 3-4) is superseded by the lane split — see "The two reward
  lanes" in §2. It takes a `MapNodeType` rather than an `EncounterNodeType`
  precisely because `skirmish` and `battle` collapse to a mechanical `fight`
  encounter, so the opener is otherwise indistinguishable from its successors —
  `upgradeReward` nodes remain a second,
  separate source (per user direction: valuable as a strategic pull toward Evolution
  over gearing/relics, not redundant with the per-fight grant). Spending is also no
  longer deferred: `src/view/run/LevelUpScreen.tsx` forces every earned point to be
  allocated before the run can continue, replacing the old "spend whenever via Manage
  Roster" `TrainingPanel` flow (`progression.md`, "Reconciled" note).
- **Reward choices preview before committing (2026-08-16, second playtest).**
  `NodeRewardScreen`'s `equipmentReward` flow shows an item's stat grants on
  tap-to-preview and requires an explicit Claim button (previously: tap an item, done —
  no preview).
- **A real unequipped-item inventory replaced immediate-equip and hero-to-hero
  moving, then was itself removed (2026-08-16 third playtest → 2026-08-17 reversal).**
  Third-playtest history: the original equipment model had no inventory —
  `equipmentReward` forced an immediate "which hero gets this" choice, and reassigning
  gear meant `moveEquipment` unequipping a source hero's slot straight onto a target's
  (a swap, never a stash). That was replaced with `RunState.inventory: string[]`
  holding owned-but-unequipped item ids, equipped/unequipped at leisure from
  `RosterManagementScreen`.
- **The unequipped-item inventory was removed (2026-08-17, per user direction: "adds
  unnecessary player busywork").** `RunState.inventory` is gone. Every piece of
  equipment obtained — whether from a battle win or an `equipmentReward` node — must be
  resolved on the spot: `runProgress.ts`'s `equipToRoster` equips it onto a hero and
  returns whatever was already in that slot as `bumpedItemId` (never silently dropped,
  since there's no stash to catch it); the new `src/view/run/ForceEquipScreen.tsx` is a
  forced gate (same `{ kind: 'forceEquip'; queue; next }` `Screen`-union pattern
  `LevelUpScreen` already used for the training-point spend gate) that keeps surfacing
  items — the original grant, then any bumped item, then whatever *that* bumps — until
  the player has either equipped or trashed (`trashEquipment`) every one of them.
  `RosterManagementScreen` no longer has an Inventory section; it now only reassigns
  gear that's already equipped, via `swapEquipment` (a true hero-to-hero swap — tap a
  filled slot then tap the matching slot on another hero, or drag it — never orphaning
  an item since both slots always end up occupied by *something*, possibly the other
  hero's old item) or trashes it outright. Every **Monsters** node (the row-0
  opener and row 4's `battle`) also always grants one random act-curve item on top of its
  gold/training-point rewards — see "The two reward lanes" above — so the player exercises
  this loop from turn one rather than waiting on `equipmentReward` node luck.
- **…and a capped one came back (2026-09-07), then lost its cap (2026-09-08), then lost
  its screen with it.** The bullet above is superseded twice over. `RunState.stash` now
  holds any number of unequipped items; the bumped-item cascade is gone — a displaced
  item falls into the bag instead of back onto the queue — and `ItemFoundScreen`
  (formerly `ForceEquipScreen`) is **deleted**: every drop goes to the bag unasked and
  the map's Roster button carries the badge that says one is waiting. What survives from
  2026-08-17 is only half of its finding — resolving a drop on the spot was worse than
  carrying it, and the cap that was supposed to be the other half turned out to force a
  discard between two items the player had already declined. Full write-up:
  `docs/progression.md` "The stash", "The bag notification", "The uncapped bag".

## 4. Act 6 — the Pact (2026-09-05, per user direction)

The fiction this implements is `docs/lore.md`; this section owns only the structure. In
one line: **five acts break five seals, and Act 6 is the thing behind them.**

### The Pact Seal — the between-acts beat

A run's five Guardians are its five broken seals, so the run needs a place to *count*
them. `PactSealScreen` is a five-socket seal — the same fixed-denominator socket idiom as
the draft's pact sockets and the Field Effect plaque's 5-pip clock
(`visual-language.md`) — and each act's Guardian win fills one with that location's
champion sigil in the faction's `tintRgb`.

It grants nothing, so it goes **last** in the act-boundary chain, after the post-fight
gates and immediately before the next act's `ActIntroScreen`: the seal fills, then you
arrive somewhere new. That ordering is the opposite of the Banner's (which goes first
precisely *because* it grants something) and for the same reason.

The fifth socket is the payoff. It fills, and instead of an act intro **the seal breaks**
— which is Act 6's opening beat, bought with one animation on a screen that had to exist
anyway.

### Act 6's shape

`TOTAL_ACTS` becomes **6**. Act 6 is not another act of the §1 shape; it is two nodes:

- **Row 0: a single `muster` node — the Vigil.** A Guild Hall variant, and the run's last
  node of any kind. Three jobs, in descending order of how load-bearing they are:
  1. **Fills the roster to `ROSTER_CAP`.** The finale is 6v6 and a roster can legitimately
     be *under* 6 — the draft grants 2 (`STARTER_PICK_COUNT`) and the cap is a ceiling,
     not a floor. Recruits taken here to reach 6 are **free**; a 6v4 finale is not a
     difficulty setting, it is a bug the player cannot see coming.
  2. **Spends the gold.** Gold is otherwise dead currency the moment Act 5's Guardian
     falls. The Vigil's equipment shelf is the run's last, at one rarity tier ahead.
  3. **Spends banked Training Points**, since `levelUpDeferred` lets a pool ride.
- **Row 1: the single `finale` node.** No branch, no choice — the map is a corridor, and
  drawing it as one is the point.

Act 6 happens at a **fixed location** the acts-2-5 draw can never produce, the way Act 1 is
fixed to Wild's Edge. It has no faction and no affinity: it is where the binding was made.

### The final battle — 6v6

**The board is still 2v2.** Six-a-side is a *bench* change, not a field change — targeting,
the spread rule, priority brackets and the whole damage pipeline are untouched. That is
what makes this affordable.

**The player fields the entire roster.** No bring-6-pick-4 sideboard; `requiredSquadSize`
returns 6 and squad select becomes a *lead-order* screen rather than a *pick* screen. This
does systemic work the rest of the run cannot: every other fight lets a hyperfocus build
bench its dead weight, and this one drags all six onto the field. It is the single place
where breadth is priced in gameplay rather than in `levelUpCost`, and it lands where that
reads as drama instead of punishment.

**The enemy is the five you broke, then the thing they were holding shut.**

| Bench position | Who |
|---|---|
| active, active | The Act 1 and Act 2 champions |
| bench 0-2 | The Act 3, 4 and 5 champions, in that order |
| bench 3 | **Endbringer** — mono-Ancient, the last combatant to reach the field |

Order is not decoration: forced replacement pulls from the bench in order, so the fight
**escalates across itself** and the Endbringer arrives only once the five in front of it
are gone.

**The five arrive unsealed.** They field as their base type alone — Goblin Lord mono-Beast,
Yugzulach mono-Shadow, Leviathan mono-Water, Elder Bough mono-Nature, Lava Beast mono-Fire,
Skeleton King mono-Spirit — because the Ancient half *was* the seal and the player already
took it (`lore.md` §6). This is balance and fiction agreeing: six X/Ancient bodies at ~700
stat total, none takeable at super-effective damage, against the Pact Clock, is a finale
that ends in a timeout — and `FightScreen` resolves a mutual wipe as a **player loss**. The
Endbringer is the only true wall, which is what a Titan should be.

Deriving the unsealed form from the authored champion (drop the Ancient type, keep
everything else) rather than authoring six more enemies is the pure-data version and the
one that cannot drift.

**They arrive at the power they were beaten at.** Each boss win snapshots the champion's
actual `RosterEntry` — level, act scaling, unlocked moves — into the run's broken-seal
ledger, and the finale rebuilds it verbatim. Named consequence, accepted rather than
accidental: this **rewards taking hard locations early**, because a champion beaten in Act
2 returns at Act 2 power. It puts a price on `locations.md`'s "when, not whether", payable
at the only moment the whole run is on the table at once.

### The windows 6v6 actually moves

Small list, and that is the finding — most of the engine does not care how deep a bench is.

| Window | Today | Finale |
|---|---|---|
| `requiredSquadSize` (`squad.ts`) | `min(4, rosterSize)` | 6 |
| `isLockedIn` (`engine/state.ts`) | `koCount >= 2` | **3** |
| Enemy bench order | generated | authored (table above) |
| Squad select | pick 4 of 6 | order 6 of 6 |

`SwitchInPanel`'s bench list is **not** on that list, which was the surprise: it was
already a list rather than a pair of rails, and four options fit a portrait screen without
scrolling. Squad select was the same shape of luck — its grid has always been six cells
(the roster cap), so the finale only had to stop calling the bottom row "Reserve".

The lock-in threshold is the one with teeth. Two of four is half a side; two of six is a
third, which would take voluntary switching away while two thirds of the fight is still
standing. **Three** holds the ratio, and lock-in stays in the finale rather than being
dropped — it is the intentional phase transition, and the last third of a 6v6 with the
Endbringer already out is exactly what it is for.

> 🔒 **OPEN — flag before hardening.**
> - **The Pact Clock has not been measured against a 6v6.** Twelve bodies, four benched
>   per side regenerating mana every round, and one enemy resisting everything is the
>   deepest HP pool in the game — round 30 may well be a timeout rather than a bracket,
>   and a timeout is a player loss. The cheap fix is a bigger number; the *better* one, if
>   it is needed, is a rule: **the Endbringer's entry starts the clock.** The pact comes
>   due when the thing you came for reaches the field. Do not reach for either until the
>   fight has actually been measured — `combat.md` already flags 30 as unmeasured.
> - **Act 5's Guardian now pays a Banner.** The Banner was acts 1-4 only because act 5's
>   win ended the run and a team-wide permanent handed to a finished run buys nothing.
>   That reasoning is void: there is a fight after it. Five stacks instead of four also
>   moves the spread-or-commit decision the fixed offer exists to create, and the MP
>   Regen question (§3) gets one act sharper. **2026-09-07:** the offer is 1-of-5 now, so
>   five Guardians against five Banners is exactly one of each — see §3's second open question.
> - **The win condition is reduction to 0 HP**, and `lore.md` §7 records the alternative
>   (survival) and why it is better fiction and a new engine primitive.

## 5. What's still not built

- **Level-up spend UI, superseded (2026-08-16 playtest pass):** the original gap (no
  view-layer way to spend the pooled level-up currency) was first filled by
  `src/view/run/TrainingPanel.tsx`, a deferred-spend panel reachable from `MapScreen`
  "at any time." That's since been replaced: Training Points are now forced-allocated
  immediately via `src/view/run/LevelUpScreen.tsx` right after they're granted (every
  fight win, and any `upgradeReward` node claim) — the run cannot continue with an
  unspent pool. `MapScreen`'s "Manage Roster" button now opens
  `src/view/run/RosterManagementScreen.tsx` instead: condensed hero rows (Info button
  for the full stat-bar readout) plus reassigning already-equipped gear between heroes
  and, since 2026-09-07, in and out of the bag that backs them (`moveEquipment` /
  `equipFromStash` / `unequipToStash` / `sellFromStash` — see "…and a capped one came
  back" above, and its two successors). Still not a level-up spend surface.
- **Per-act difficulty scaling — the curve is built (§3), the numbers are not settled.**
  `src/run/difficulty.ts` gives every act a baseline; what remains open is the tuning
  (all figures are first-pass), the uniform stat draw ignoring that HP is worth less
  than Attack, whether a Recruit Contract should carry the act scaling it was fought
  under, and the authored per-act monster tiers the `monsters` track's Act 2 baseline is
  standing in for. Each is written up under §3's bullet.
- **Per-location choice.** Acts now happen in named Locations with their own
  faction, type affinity and arrival screen (`locations.md`, 2026-08-28), but the
  itinerary is currently drawn *for* the player. The decided design — **each act
  offers 2 named locations and the player picks one** — is not built yet, and the
  five non-Act-1 factions all have their own enemy content as of 2026-09-05 (Cultists,
  Raiders, Fae, Vulcans, Undead), so no location falls back to Goblins any more. The
  1-of-2 location choice is tracked in `locations.md` §5, not here.
- **Visual path rendering.** `MapScreen` renders nodes grouped by row with
  reachable/visited/current/locked states, but does not draw connecting lines between
  them — a cosmetic gap, same "lowest priority, purely cosmetic" bucket as the
  feel-pass prototype's presentation layer (`architecture.md`).
- **A real Guardian boss hero**, and real content generally — this pass still runs on
  `/src/data`'s 6 fixture heroes (README "Next steps" #5, unchanged by this work).
