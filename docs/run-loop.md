# run-loop.md — The Escalating-Fight Run Loop

> Module of the Titanpact `/docs` suite. Companion to `combat.md`, `progression.md`,
> `mana.md`, `architecture.md`, `locations.md` — which owns the layer directly
> above this one: **which place** an act happens in, and how that biases the encounter
> pools §2 describes — and `lore.md`, which owns what §4's finale *means*. The map/node structure that turns the single fixed
> demo fight into the roguelike run CLAUDE.md's north star describes: draft →
> escalating fights → relics.

> **Partly superseded by `growth-overhaul.md`.** Its seven phases landed 2026-09-10 and its
> **§11 second pass landed 2026-09-11** (and §12's price curve 2026-09-12): Evolutions come from the 4th rung into a hero, the
> Crucible on a Guardian node grants a **Class** (a move or a passive), the Mentor row in acts
> 1-3 is an Early-Mid Tutor (`mentorReward`) with a Forge in act 4's seat, and `crucibleReward`
> is deleted. Where a paragraph below still says the Crucible evolves or the Mentor teaches a
> stat-pair Class, §11 wins. **Everything else describes what the code does.**

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
- **Row 1: 3 nodes, pick 1 of 3 — reward types only** (`equipmentReward`/`scrollReward`/
  `manaWellReward`/`passiveReward`/`currencyReward`/`forgeReward`/`event`, weighted). No
  `fight`/`shop`/`elite`/`mentorReward` mixed in — every reward row is a genuine reward
  choice, not a chance to draw another fight or dodge one, and `mentorReward` is reserved
  for its own forced Mentor row (2026-08-22 revision, per user direction — see the Mentor
  row note below), never a random pick-1-of-3 option. In act 4 one seat on one of the act's
  three pick-3 rows is taken by a forced `tutorReward` (see "The Tutor" below); the other two
  seats roll normally, so the row still offers three distinct things.
- **Row 2: the spliced seat — a single forced node in every act 1-5.** The Mentor in acts
  1-3, the Forge in act 4, the Tutor in act 5 (below). Until 2026-09-14 this row was a second,
  un-forked `skirmish` and the spliced seat sat above it; see "Three fights an act" below.
- **Row 3: 3 nodes, pick 1 of 3 — reward types only**, same pool as row 1.
- **Row 4: 2 nodes, pick 1 of 2 — `elite` or `skirmish`** (2026-09-13, Titanspawn
  overhaul phase 3; `elite` or `battle` from 2026-08-17). `elite` is the act's difficulty
  spike (a level over the Skirmish since 2026-09-15, loot one tier ahead, **XP ×1.5** since 2026-09-14 —
  `ENCOUNTER_XP_MULTIPLIER`, above par, which assumes the Skirmish); the `skirmish` is a plain,
  no-bonus, recruitable alternative, and both tiles preview the typing they field (below).
  Always presented as a real choice (see edges, below), not one that depends on luck.
- **Row 5: 3 nodes, pick 1 of 3 — reward types only** (2026-09-08, per user direction), same
  pool as rows 1 and 3. A third reward row, affordable once the map stopped having to fit its
  well ("A map that scrolls", below): the act had two reward seats to spend across a
  nine-type pool, so its rarest cards were being drawn about once a run.
- **Row 6 (funnel): the act's one guaranteed spend.** A single `shop` node in acts 1-2, and a
  `shop` + `blacksmith` **pick 1 of 2** from act 3 on ("The Blacksmith", below). Every
  path converges here — the standard Slay the Spire "everything narrows before the boss" beat.
- **Row 7: the single `boss` node** — the act's Guardian.

The upshot: every act is exactly **Fight → pick 1 of 3 → Mentor / Forge / Tutor → pick 1 of 3
→ (Elite or Skirmish) → pick 1 of 3 → (Guild Hall or Blacksmith) → Guardian** — three fights,
no path through an act ever skips one, and none arrives at the funnel holding only half the fork.

**Three fights an act (2026-09-14, per user direction).** The un-forked Skirmish row came out:
the run was measuring ~92 minutes for a player who taps every beat against a 45-minute target
(`scripts/sim/time.ts`), and cutting an act — the other lever the same size — would have cost a
Location, which is where the run's flavour lives. The plain Skirmish was the fight to lose: in
acts 2-5 it won at 100% with three-quarters of the squad's HP left, so it cost the run time and
nothing else, and in Act 1 it was one of three ~80% hurdles in the run's wall. The fork is now
the act's one Skirmish, the reward rows stay at three (per user direction — a call to be judged
in play, since Act 5 now runs two reward rows back-to-back either side of its Tutor), and the
act's XP is re-sized ×1.25 so par still lands the decided act ends
(`ENCOUNTER_XP_BY_ACT`, `ENCOUNTERS_PER_ACT` = 3). Measured on the same 600-run seed and
pilot: **Reader 92 → 77 min, Auto 63 → 53, Fast 37 → 32**; full-clear 23 → 26%, Act 1 clear
51 → 65% (the wall softened by exactly the fight it lost), Acts 4-5 Guardians unchanged. The
tutorial's corridor lost its warband `battle` with it, and its bench lesson moved onto the
Guardian.

**The fork is Elite-or-Skirmish since 2026-09-13** (Titanspawn overhaul phase 3; it was
Elite-or-Battle). Both options draw the recruitable pool and both pay a contract, so claim
supply is one higher an act; what separates them is the Elite's risk/reward axis (harder, loot
one tier ahead, XP ×1.5) and the TACTICAL one, which is new: each tile previews the enemy typing it
fields — a row of element marks under the sigil — and the Skirmish row does too. The preview
is honest by construction: every encounter node draws from a seed derived from the map's seed
and the node's id (`src/run/encounters.ts`, the one place App.tsx, the sim and the map's
preview all build an encounter), so the tile and the tap are the same draw, and the fork's
Skirmish is re-rolled against its Elite until the two differ in at least one type. `battle`
survives as a node type only for the tutorial's curated corridor.

**The spliced seat: Mentor (acts 1-3), Forge (act 4), Tutor (act 5).** Row 2 is a forced
single-node row in every act. In acts 1-3 it is the Mentor (`mentorReward`): pick a hero, and
one Mid-tier move is rolled for it from its own pool (2026-09-11, `growth-overhaul.md` §11 — it
taught a stat-pair Class until then). In act 4 the same seat is a forced Forge (`forgeReward`,
2026-09-11). In act 5 it is a forced Tutor (`tutorReward`, 2026-09-14, per user direction): a
guaranteed Late move going into the run's last Guardian, in the seat Act 5 had been holding
empty since 2026-09-05 "for a different beat". It sits **ahead of the fork** (the row was
placed immediately before the Skirmish on 2026-09-05, per user direction, and the fork is the
Skirmish now), so the move is in hand for the act's first recruitable fight rather than
arriving just after it. Since the seat exists in every act and the Skirmish row is gone, the
shape no longer varies by act: 8 rows in all five (`SPLICED_ROW`, `LAST_MENTOR_ACT`,
`FORGE_ACT`, `src/run/map.ts`). A single-node row is one no path can bypass.

**The Blacksmith (act 3 on) — DELETED 2026-09-15 (`docs/gear-absorption.md` §6): the funnel is one
forced Guild Hall every act, its Smithy tab holding the Anvil and Enchanter over worn gear; the
shelf sells no gear and nothing is sold. The Smithy is laid out by hero since 2026-09-16 — a bench
a hero with its sprite and sockets, a work sheet a piece, and a hammer-and-anvil or binding beat
for what each service makes (`docs/visual-language.md` "Thirty-seventh pass"). What follows is
the record.** From act 3 the funnel widens to two and the act's guaranteed
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
recruitability included, since `fight`/`battle` draw the Titan's eye and `skirmish`/`elite`
their enemy typing (`nodeIcons.tsx`, `ElementPie.tsx`) — and a long press still reads any
node out in full. That took rows to 56px and
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

Classes left the Mentor for the Crucible on 2026-09-11 (`growth-overhaul.md` §11). The old
stat-pair Classes had measured statistically inert until there were four of them (`scripts/sim`,
40,000 runs), which is the finding that made them verbs.

**The Tutor seat (acts 4-5).** Acts 4 and 5 each guarantee exactly one `tutorReward`
(2026-09-07, per user direction). Unlike the Mentor it gets **no row of its own**: it is
spliced into one of the act's two pick-1-of-3 reward rows, row and column both rolled off
the map seed (`TUTOR_ACTS`, `TUTOR_ROW_WIDTH`, `src/run/map.ts`). That placement is the
whole balance argument. The Tutor is the strongest single reward in the run — an exact
move, chosen rather than rolled — and giving it a forced row would have handed it out
free; sitting it inside a reward row prices it against the Forge, the Boon, the purse and
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

**What the map calls them (2026-08-29, per user direction; renamed 2026-09-13).** The four
encounter types share **two** player-facing names, not four. `fight` and `battle` both read
**Titanspawn** (they read Monsters until the Titanspawn overhaul made that literally what they
field); `skirmish` and `elite` both read **Skirmish**. The split is recruitability — the one
fact a player needs before choosing a route — and difficulty is carried by colour and glyph
instead (`MapScreen`'s `NODE_COLORS`, `nodeIcons.tsx`: `--enemy` the soft opener,
`--ally` a standard fight, `--crit` the Elite spike). **Titanspawn tiles wear the Titan's
eye** — the lens the title and TitanWakeScreen open on, since what leaks through the seal is
the thing watching — and **a Skirmish tile's face is its enemy typing**: the disc cut into one
wedge per type, each wearing its element (`ElementPie.tsx`), in place of the helm and the row
of marks it used to carry underneath. The Elite keeps its crown as a badge on the rim. The
helm survives only where no typing is drawn — the rail, the lead-on chips, the origin mark and
the dossier head. `boss` reads **Guardian**. The type *ids* below are unchanged; this is
labelling only.

The two channels are deliberately **not** redundant — name for recruitability, colour for
difficulty. Making colour agree with the label instead was tried and reverted the same
day: moving `battle` to `--enemy` put it next to `elite` on row 4, the act's one real
difficulty choice, in two reds a shade apart (#d9534f vs #ff7043).

| Type | Resolution |
|---|---|
| `fight` | **2026-09-13: draws Titanspawn — Act 1 two bare Earlies from every line, from Act 2 a leader at the act's tier over three geared Earlies (`run/spawn.ts`, "The mob layer is Titanspawn" below).** Before that: `FightScreen` vs. a generated 4-hero AI squad (`src/run/enemyGen.ts`), no bonus. Always row 0, each act's opening node — draws from the non-recruitable enemy pool (Goblins), not the draftable hero roster. |
| `skirmish` | Mechanically identical to `fight` (same 4-hero, no-bonus `generateEncounter` call — App.tsx collapses it to `EncounterNodeType: 'fight'`), but draws from the **recruitable hero pool** and is named differently on the map (2026-08-17, per user direction) so the player can see, before committing a squad, that beating this one is a shot at a Recruit Contract claim. Always row 2. |
| `battle` (map-facing name "Monsters", 2026-08-22 revision) | **2026-09-13: the same leader-over-Earlies spawn shape as the Act 2+ opener, in every act, until the fork becomes Elite-or-Skirmish (overhaul phase 3).** Before that: also mechanically identical to `fight`/`skirmish` (collapses to `EncounterNodeType: 'fight'`), but draws from the **non-recruitable enemy pool**, same as `fight` — not `skirmish`'s recruitable pool. Row 4's non-Elite alternative to `elite`. **2026-08-23 revision, per user direction:** no longer a plain `generateEncounter` call over the whole enemy pool — `App.tsx`'s `handleSelectNode` calls the dedicated `generateLeaderEncounter` (`enemyGen.ts`) instead, which always fields the Location faction's leader plus 3 random draws from its basics. This is what makes `battle` a real, considerably-tougher alternative to `elite` rather than a same-difficulty reskin of the opener — see "Goblin roster" and "Factions, and the Cultists" below for the content this draws on. |
| `elite` | Four heroes from the recruitable pool, same as `skirmish`, one level over it (`ENEMY_LEVEL_OFFSET`, 2026-09-15 — it was a flat +10 to 2 random stats each). Row 4's difficulty-spike alternative to `skirmish` — the player picks one or the other, never both. |
| `boss` | **2026-09-15: escorts and champion take the node's level (`docs/enemy-levels.md`) — the tracks below are history.** **2026-09-13: the two escorts are Titanspawn of the Location's `spawnTypes` at the act's tier, on the monsters track; the champion alone keeps the skirmish track.** Before that: `FightScreen` vs. **2 of the Location faction's basics** (no bench — a real no-cycling fight), each with a flat +20 bonus to 3 random growth stats. Hero-pool escorts until 2026-09-06 — see "The Guardian's escorts" below. Winning grants 1 Recruit Contract, the Guardian's Banner in acts 1-4, and ends the act (§3). **2026-09-01 exception:** a location may hold a **faction champion** on the boss's bench — see "The Guardian's champion" below. |
| `shop` | `ShopNodeScreen` — the existing `GuildHallPanel`, given an exit for the first time. Overhauled 2026-08-18: offers 2-3 curated hero recruits (50g each, `GUILD_HALL_RECRUIT_COST`) rather than the full catalog, plus a rarity-priced equipment shelf, rolled once per visit (`src/run/shop.ts` `rollGuildHallOffers`). Second pass 2026-08-31: relics are no longer sold anywhere, the shelf is 4 wide and readable on its face, sold stock greys out, and Recruit Contracts confirm before buying (`docs/progression.md` "Second pass"). |
| `equipmentReward` ("Item") | `NodeRewardScreen` — pick 1 of 3 items, rarity-weighted (`equipment.ts` `pickWeightedEquipment`); claiming bags it and lights the Roster badge — see "The bag notification" in `docs/progression.md`. Items are uncategorised as of 2026-09-06, so the three on offer are simply the three rolled (`docs/progression.md` "Uncategorised slots"). |
| `currencyReward` | `NodeRewardScreen` — an instant flat gold grant (15-30 at Act 1, ×`ACT_GOLD_SCALE` after — see "The two reward lanes"). **2026-09-08, per user direction:** it pays out on arrival and the screen counts the PURSE up to its new total, coin by coin, over a Claim button that was never a decision — the drop size is a chip beside a number the player can act on, rather than a number they cannot. The two Scroll nodes share that beat. |
| `scrollReward` ("Scroll Cache") | `ScrollNodeScreen` — **`SCROLL_CACHE_COUNT` = 3 Mastery pips**, one tap each, in any split (`src/run/mastery.ts`, `docs/mastery.md` §3, 2026-09-14). Five pips is a hero's Evolution and the fifth raises it right there; the Scribe seeds two heroes an act, this is where the player prioritises. Weight 46 — the seat the Scroll Cache held before Ichor, taken back when Ichor retired (Mastery phase 2). See "Mastery Scrolls" below. |
| `forgeReward` ("The Forge") | `ForgeScreen` — pick one roster hero to gain **+1 item slot** for the rest of the run (`runProgress.ts` `grantItemSlot`, stored on `RosterEntry.bonusItemSlots`, capped at `MAX_ITEM_SLOTS` = 3). **2026-09-06**, replacing the three slot-specific cache nodes (`weaponReward`/`armorReward`/`accessoryReward`), which lost their meaning when items stopped having categories — most of their frequency went to `equipmentReward`, whose weight went 20 → 40. The scarcest thing on the reward row (weight 8) on purpose: it is permanent, it compounds with every drop after it, and it is the only reward here a hero can be at the cap for — a roster entirely at 3 slots makes the node a dead draw, which is what makes spending it a choice — and at the 2026-09-07 cap of 3 that arrives materially sooner. |
| `manaWellReward` ("Mana Well") | `ManaWellScreen` — pick one roster hero to gain **+`MANA_WELL_AMOUNT` = 30 max Mana** for the rest of the run (`runProgress.ts` `grantManaWell`, onto `bonusStatGrants`; stacks; never refused). **2026-09-13, per user direction** — the one bare-number screen the constitution allows. See "The Mana Well" below. |
| `passiveReward` ("Boon") | `BoonNodeScreen` — pick 1 of 3 passives, then the hero it settles on (`grantEventPassive`, stored on `RosterEntry.bonusPassiveGrants`). See "Boons" below. |
| `mentorReward` ("Mentor's Hall") | `MentorNodeScreen` — "the Mentor can teach any hero a powerful move": pick a hero, and ONE Mid-tier move is rolled from that hero's own pool, un-rank-gated (`mentorMovePool`, `src/run/tutor.ts`). A Scroll pour with the band fixed at Mid that ticks nothing; the rolled offer is spent by being made. Who is the only decision, on purpose — it is one of a new player's first nodes (2026-09-11, `growth-overhaul.md` §11; it was briefly a curated Early-Mid pick, and before that a stat-pair Class). **Not in `REWARD_WEIGHTS`** — the only way to meet one is the forced row in acts 1-3 (§1). |
| `tutorReward` ("Tutor") | `TutorNodeScreen` — pick one roster hero, then **any** move from that hero's Scroll pool. See "The Tutor" below. Acts 4-5 only. |
| `scribeReward` ("Scribe") | `ScrollNodeScreen` — pick TWO heroes, and each takes **2 Mastery** (`SCRIBE_PICKS`, `SCRIBE_PIPS_EACH`, `src/run/mastery.ts`; `docs/mastery.md` §3, 2026-09-14). Five pips is a hero's Evolution, ten its signature; the fifth raises the Evolution screen right there, over the node. Cannot be concentrated — that is what the Scroll Cache (phase 2) and the Guild Hall shelf are for. **Not in `REWARD_WEIGHTS`** — a forced row every act 1-5, between the second reward row and the Elite/Skirmish fork (§1). |
| `event` | `EventNodeScreen` — rolls one of the authored map events (`src/data/events.ts`, `src/run/events.ts`) and resolves it: a move taught to a chosen hero, a Passive taught to a chosen hero, a flat stat trade, or a pile of act-curve loot dropped straight into the bag. Which event a node turns out to be is rolled once at node-select time and gated by act and Location. See **docs/events.md**. |

Every encounter node's enemies arrive at a **level** set off the player's par entering that
node (`docs/enemy-levels.md` §4) — the Skirmish at par, the Elite a step over, the Guardian's
escorts under and its champion over them — and at the act's Mastery, so from Act 4 every
hero-pool enemy is evolved.

### The two reward lanes (2026-09-01, per user direction)

The Monsters / Skirmish split used to be a **naming + pool** split only: both lanes paid
the same kind of reward, graded by difficulty, so `elite` simply out-paid `battle` on
every axis at once and row 4's Elite-or-Battle pick collapsed into "how hard a fight do
you want." The per-win payout tables in `App.tsx` (`goldRewardFor`, `EQUIPMENT_DROP_CHANCE`/`LOOT_SOURCE`,
all keyed on `EncounterMapNodeType` — the **map** node type, since `skirmish` and `battle` are
indistinguishable once collapsed to `EncounterNodeType`) make the two lanes pay differently:

**Gold carries the act since 2026-09-17, per user direction** (`ACT_GOLD_SCALE` = ×1 / 1.5 / 2 /
2.5 / 3 by act, `goldRangeFor` / `purseRangeFor`, rounded to 5s; the table below is Act 1's).
Gold had no act term where XP has had one since 2026-09-13, so a fight paid 15–25 in Act 5 as in
Act 1 while the Smithy's prices climb 25 → 130 a lift — and the fat band below belonged to
`battle`, which left the map when the fork became Elite-or-Skirmish, so the loot-and-gold lane
had quietly lost its gold half. Measured (sim, 1500 runs, skilled pilot): ~45g earned an act,
flat, the Guild Hall entered with 53–66g in Acts 2–5 and the Anvil paid 0.2–7.7g an act; with the
term 41 / 71 / 92 / 123 / 156 earned, the Hall entered with 82 / 104 / 142 / 181, the Scrolls
selling out from Act 3 AND the Anvil paid 32 / 52 / 79g in Acts 3–5, full-clear 11.5 → 13.3% on
the same seed, all of it at the finale. The steps size an act's income at about one Smithy job
at the act's window tier plus one shelf item. **The Guardian then took the fat band** (same day,
per user direction): earned 63 / 106 / 161 / 187 / 249 by act, the Hall entered with 119 / 162 /
245 / 332 in Acts 2–5, full-clear unmoved (13.1%) and 72g unspent at the end against 32 — the
sim's pilot lifted but never enchanted. **The pilot then learned the Enchanter** (same day,
`resolveEnchanter`: one binding a visit, always the holder's innate primary type, on the piece
where that gains most): enchant spend 31 / 45 / 74g in Acts 3–5, unspent at the end back to 31g,
full-clear 13.1 → 15.8% on the same seed, the finale 65 → 72% — a Force on the act's window
tier is worth a fight at the Eyes. If Act 4–5 read as rich in play, the Guardian's band and the
last two steps of the scale are the two dials. First-pass, a playtest figure; the prices stand.

| Node | Lane | Gold (Act 1) | Equipment drop |
|---|---|---|---|
| `fight` (row 0 opener) | Monsters | 15-25 | **always**, act's standard curve |
| `battle` (row 4) | Monsters | **30-45** | **always**, act's standard curve |
| `skirmish` (row 2) | Skirmish | 15-25 | 25%, act's standard curve |
| `elite` (row 4) | Skirmish | 15-25 | 55%, **one tier ahead** (`rarityWeightsFor(act, 'elite')`) |
| `boss` | Guardian | **30-45** (2026-09-17; was 0 — the fat band `battle` took off the map, so the act's hardest fight is its richest, banked for the next act's Hall) | 70%, one tier ahead |

**The XP column is gone (2026-09-10, Growth Overhaul phase 3).** Levels are automatic and
roster-wide, so no encounter pays a currency for them. XP is an authored figure by ACT, read off
the count of encounters won rather than the node — the fourth of an act is the Guardian and pays
×2 and **the Elite ×1.5** (2026-09-14, per user direction), read off the node that was fought
(`ENCOUNTER_XP_BY_ACT`, `ENCOUNTER_XP_MULTIPLIER`, `encounterXpKind`, `src/run/growth.ts`). Par
assumes the Skirmish, so the Elite's XP is above par: a player who takes every Elite ends act 5
~2,200 XP ahead — under a level at that height, and a fuller bar all the way. The node dossier
prints the figure beside the loot tier so the fork's XP is a reason the player can read.
`BASE_TRAINING_POINTS`, `ACT_XP_STEP` and `trainingPointsFor` are all deleted.

That flattens one half of the two-lane split, and the half that remains is the one that was
always the sharper of the two:

- **Monsters is the loot-and-gold lane.** The guaranteed drop is the lane's rule, and `battle`
  additionally carries the fat gold band. The opener is held at the thin band on purpose — it is
  deliberately the run's lightest fight and already ships a free item, and making it the map's
  richest gold node would undercut everything after it.
- **Skirmish is the RECRUIT lane.** It was "the XP lane" until phase 3 took the XP out; what is
  left is the recruitable pool (the Recruit Contract shot) and, on `elite`, a tier-ahead item at
  better odds — paid for with the thin gold band and a drop that is a roll rather than a promise.
- **Row 4 is still a real trade.** `elite`: a recruitable roster, 55% at a tier-ahead item,
  against a harder fight. `battle`: double gold, a certain item, against an easier one.

**Open — the Skirmish lane is thinner than it was.** Losing the XP premium leaves it carrying
recruitability and drop rarity alone against Monsters' gold and guaranteed drops, and whether
that is still an even trade is a phase 6 question, not one to patch here.

### The Tutor

**2026-09-13, per user direction — the Mentor's beat at the Late band.** `tutorReward` →
`TutorNodeScreen`, acts 4–5, one seat an act inside a pick-1-of-3 reward row. Pick a roster hero,
and **one Late-tier move is rolled** from that hero's pool (`tutorMovePool` = `tierMovePool` at
Late, `src/run/tutor.ts`: the authored table plus a chosen path's line, minus what the hero holds
or was already offered), un-gated by level and taking no schedule entry. Below `MOVE_CAP` it
lands and the box says so; at the cap it is the replace-or-decline question. The offer is spent by
being made. With the Mentor it is the only way to a move AHEAD of its schedule — a Late move in
Act 4 before `lateLevel`, or a third one once the schedule's two have landed (every Late slate
holds four, pinned in `test/tutor.test.ts`).

It was (2026-09-07) a curated pick of **any** move off the hero's whole pool, declined offers and
refused Evolution grants included, taught through `grantMove` so nothing was spent. That was the
run's strongest reward and its longest screen, and once the schedule made the Late band
reachable for everyone the shelf's breadth stopped being what the seat was for.

### Boons (2026-09-07, per user direction)

The **Boon** node hands one hero a **passive**, permanently, for the rest of the run. It is the
salvage of the deleted relic pool: the passive Idols were the only relics that felt like anything,
and what made them unusable was not the effects but the *scope* — applied to all four heroes at
once, a passive is either a bigger stat grant or an unanswerable one. Given to a hero the player chooses,
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

**Open — the weight is a first pass.** 30 in `REWARD_WEIGHTS` (18 until the Gem Cache and the
two shrines freed 40 on 2026-09-10). It is the only reward-row node that
changes how a hero *plays* rather than how big its numbers are, which argues for scarcer; it is
also the node most likely to be the reason a run comes together, which argues for commoner.
Playtest.

### The schedule (2026-09-13, XP Overhaul phase 3)

**The run's only faucet for moves is the level-up SCHEDULE** (`src/run/progression.ts`,
`docs/xp-overhaul.md` §4). Every hero reads a `LevelSchedule` — `offerLevels`, `midLevel`,
`evolutionLevel`, `lateLevel` — off its own level: a level on the list rolls ONE move from the
band that level has opened (Early below `midLevel`, where it expires; Mid from there; Mid+Late
from `lateLevel`), take it or decline, burned either way, replace-or-decline at `MOVE_CAP`; the
level at `evolutionLevel` raises the Evolution in place of an offer. It pays out on the **level-up
report** (`LevelUpScreen`, `levelUpFlow.ts`) after the rows land, one entry a hero a beat, in
roster order — a receipt below the cap, the replace question at it, the Evolution as a screen of
its own. `RosterEntry.scheduleTaken` walks the entries in order, which is what lets a raw hire
arrive with its entries un-taken and work them off one fight at a time. Every hero is on
`DEFAULT_SCHEDULE` (offers every three levels from 4, Mid 10, Evolution 16, Late 21) until the
per-hero pass. No Scroll, no purse, no Mastery screen, no map chip: the section below is history.

### Mastery Scrolls (2026-09-10, Growth Overhaul phase 2 — DELETED 2026-09-13)

> Superseded whole by the schedule above; kept for the reasoning. Nothing in it runs.

**The run's only faucet for moves.** Scrolls buy a hero its next RUNG on `MasteryScreen`,
which is pushed after every node that leaves the purse able to buy one; a rung offers **one**
move from that hero's pool — take it or decline, and the move is burned either way — and it ticks
that hero's **Mastery Rank**, which is what gates the tiers (Early at 1, Mid at 2, Late at 3;
rungs at 3 and 6, the Evolution at 4). **A rung's price rises with the rung** (2026-09-12,
`growth-overhaul.md` §12 — the pre-overhaul level-up curve, restored): 1, 2, 3, 4, then 5 a rung.
Spec and rationale: `docs/leveling-and-ranks.md` Part 1b and `docs/growth-overhaul.md` §4, §12.

**Where they come from.** Every won fight, scaled by act (`scrollsFor`, `src/run/difficulty.ts`):
the act opener 3, Battle 3, Skirmish 4, Elite 4, the Guardian 4, +2 per act past the first —
14–15 an act in Act 1, 46–47 in Act 5, ~150 a run. **The fights are the only faucet since
2026-09-13** (XP Overhaul phase 2): the Scroll Cache, the lone Scroll and the Guild Hall's Scroll
bundle all became Ichor (below). Against that, six Evolutions are 60 and six heroes to the Late
band are 120, so everything past "everyone evolves" is a real spread-vs-concentrate call. This is
the bridge state — phase 3 deletes the ladder whole.

### The Mana Well

**2026-09-13, per user direction.** `manaWellReward` → `ManaWellScreen`, weight 20 in the reward
rows beside the purse: pick a hero, and its max Mana rises by `MANA_WELL_AMOUNT` = 30 for the
rest of the run. The Forge's grammar — one tap, who — and every card says the pool it would
leave the hero with.

It is the `manaBoostReward` shrine the Growth Overhaul deleted under *a bare number never gets a
screen*, brought back on purpose and for one stat only. The rule stands for the numbers it was
written against: +10 Attack was never something a player could see happen. A pool is different
in kind — it is the stat a whole tier of moves is priced in, so +30 Mana is a Late cast a fight,
visibly, and the choice of who reads off what each hero could then cast. That is the exception's
whole justification; a Vitality shrine does not get to ride on it.

Measured on the greedy pilot (1000 runs, two seeds): a node lift of −0.15 (Ichor's), and about
4 points of full-clear at weight 20 — the seats it takes from items and Forges, which a pilot
that does not plan its Late casts values higher than pool depth. A player who wants the Late
band will not price it that way; watch it in playtest rather than the sim.

### Mastery Scrolls — the Scribe, the Cache, and the shelf

**Pips the player aims at ONE hero** (`src/run/mastery.ts`, `docs/mastery.md`, 2026-09-14). Every
hero has ten; **five is its Evolution, ten its signature move** — uniform, no per-hero figure. A
Scroll is one pip, landed the instant it is paid on `ScrollNodeScreen`, and a pip between the two
milestones does nothing but count. Three faucets, every one on the map and none in a fight — *fights
pay XP, the map pays Scrolls*: the **Scribe** (`scribeReward`, a forced row every act 1–5: pick two
heroes, `SCRIBE_PIPS_EACH` = 2 each — it cannot be concentrated, and that is what seeds the roster),
the **Scroll Cache** (`scrollReward`, weight 46 in the reward pool: `SCROLL_CACHE_COUNT` = 3 in any
split — where the player prioritises), and the Guild Hall shelf (`SCROLL_PURCHASE_COST` = 25g,
`SCROLL_PURCHASE_LIMIT` = 2 a visit, the tap charges the gold and opens the who screen). The fifth
pip raises the Evolution screen over the node that paid it (`masteryFlow.ts`), and the tenth the
hero's **signature move** (`HeroDefinition.signatureMoveId`, `src/data/signatures.ts` — one
authored move a hero, in no pool, replace-or-decline at `MOVE_CAP`; Riptide's Lizard Rush is the
template and, until phase 4 authors the rest, the only one); the level-up report raises either
only as the catch-all for a hire that arrived past the pip. The supply is the only balance
number: measured on the greedy pilot at these weights, **~35 pips a completed run** (Scribe 20,
Cache 9, shelf 6), against a target of every hero evolved and ~3 signatures; phase 5 sets it.

**Ichor — RETIRED (2026-09-14, Mastery phase 2).** The two aimed-XP nodes (`ichorReward` at 46,
`ichorDropReward` at 14) and the shelf's Drops are gone whole with `src/run/ichor.ts` and
`IchorNodeScreen`; the Cache took the 46 back (it was the Scroll Cache's seat before Ichor took it)
and the 14 was not re-pointed. Three reasons (`docs/mastery.md` §4): it was XP paid by the map, the
one thing that broke *fights pay XP, the map pays Scrolls*; its measured effect was nothing
(`docs/xp-overhaul.md` §8, phase 2: 13 levels-at-par a run moved full-clear by ~0, and removing it
moved it by ~0 again); and it was a second aimed currency with the same who screen as Scrolls,
which is one too many to teach. Levels stay roster-wide and automatic on `L³`, and a hero behind
par still closes on it on its own.

### Gems — DELETED (2026-09-10, Growth Overhaul phase 1)

Gems were per-hero stat investment: seven stones, one per stat but MP Regen, a flat +5 (+10 HP)
socketed into one hero, re-poured freely on the map, capped 20 a hero and 8 a stat. They are gone
whole — the catalog, the board, the pool, the `gemReward` Gem Cache, the per-fight drip, and the
two stat shrines (`hpBoostReward` Vitality, `manaBoostReward` Mana Well) that had been re-pointed
to pay in them. `REWARD_WEIGHTS` lost 40 weight, which went to the Boon (18 -> 30) and the purse
(18 -> 26) until phase 2 seats the Mastery Scroll node.

**Why.** `docs/growth-overhaul.md` §1 carries the argument in full. Three findings: free
re-allocation made the decision admin rather than strategy; "+5 Attack" never became a story the
way a learned move does; and a run earned ~40 Gems against a roster capacity of 120, so neither
cap could bind. ~200 stat points a run, at roughly ten times the attention cost per point of one
late Legendary.

**What it cost, measured.** 200 batch runs at `c25f79b` full-cleared 45.5% and won 12.11
encounters; the same batch after the excision reads 33.0% and 10.70. The roster is exactly that
much lighter and nothing has been handed back yet — automatic per-level stat growth (phase 3) is
the replacement, and re-fitting the curve is phase 6. Do not read the drop as a regression.

### Consumables — the two flasks (2026-09-13, per user direction)

Two potions, held as a TEAM purse beside gold and the Scrolls (`RunState.consumables`,
`src/run/consumables.ts`) and drunk in a fight on any active hero. **HP Potion** restores half of
max HP; **MP Potion** restores half of max Mana. Every run opens with one of each — the early
lever against an awkward first matchup, before a hero has a kit that answers it.

**A potion is a FREE action, not a declared one.** `actions.ts` forbids an action seeing another's
outcome inside a round; a potion's whole point is that the player sees its outcome before
declaring — drink, and the Mana is simply there to spend. So it is not a fourth `Action` kind. It
is applied to `CombatState` on the spot during the command phase (`useConsumable`,
`src/engine/combat/consumables.ts`, the same out-of-round shape as `applyForcedReplacement`),
emits `ConsumableUsed` then the ordinary `HpChanged`/`ManaChanged`, and the command grid
re-derives: the out-of-mana Rest row turns back into moves because `canAffordAnyMove` is read
off live state. A hero that had already committed Rest is un-committed and re-asked. Like the Rest
key it is irreversible — Back cannot un-drink.

**Five rules, each answering a way the potion could quietly become something else:**

- **Not a trigger source.** No passive reaction pass runs behind a potion, exactly as behind the
  Pact Clock. A heal-reactive passive would otherwise get a free trigger for no turn, and the
  potion would be a combo piece instead of a lever.
- **A RESTORE, never a grant.** Mana caps at the pool; overflow (docs/mana.md) reads as full and
  refuses the potion. Overflow is Arcane's identity and `manaGrant`'s alone.
- **Flat, outside the heal formula.** No WisdomMult, no STAB, no variance — a run resource, not
  a move. The third direct-HP family beside the Clock and bench regen.
- **Player-only.** Enemies never drink. A no-turn-cost restore on an AI would be a stat bump
  wearing a hat; if an Ascension ever wants it, it is a dial with its own AI line, not a default.
- **Active, alive, command phase.** The bench regenerates on its own; a KO'd hero is a different
  item's business (a Revive is a different conversation, and `ConsumableKind` leaves the door
  open).

**Scarcity is the whole price, so scarcity is capped.** The mana invariant — *investment pays out
later than the point at which a weak team dies* — is bent on purpose by one MP potion and broken
by five banked. `CONSUMABLE_HOLD_CAP` = 3 a kind; a drop or a purchase onto a full flask is
refused, never banked. Three faucets: the starting pair; the Guild Hall's gear counter at a flat
`CONSUMABLE_PRICE` = 20 gold, a pure sink with no per-visit limit because the cap is the limit;
and a **drop** off a won encounter (`CONSUMABLE_DROP_CHANCE`: 12% on a fight, 20% an Elite, 25%
a Guardian, none from the finale), one potion of an even kind, rolled at squad-confirm like the
item drop so the victory ledger can show it. No `consumableReward` node type: the reward pool's
weights were just re-fitted, and a 1-of-3 seat spent on a potion is a seat not spent on a Forge.

**What a fight drank comes off the purse at resolve**, not on the sip, so a fight quit and
replayed refunds it whole — the same reason gold is granted at resolve. On the map the flask
shows on the header purse as two counts; it is a purse, not an inbox, so the footer never flags
it. In a fight the potions live in the **Bag**, the console's fourth key — Back, Switch, Rest,
Bag — carrying what it holds as a count on its rim, dark with nothing left (2026-09-17, per user
direction). Pressing it opens one panel (`BagPanel`): the kinds as a chip row, opening on the
first with stock, the chosen kind's effect in one line, then WHO drinks it. A new consumable is
one more chip. The history: one Flask key in the bottom row (2026-09-13), then two round flasks
in the field's bottom corners, which sat in the ally status bands and pushed each hero's chips
off its centre; the Menu key they had crowded out moved to the sky's top-right corner
(`.field-menu`), a pause key's place, and the row had its seat back. Both leave the field
while a round plays.

**The resolve order is shown** (`TurnOrderRibbon`, 2026-09-17, per user direction): a plaque
on the field's bottom edge, under the ally status bands, reading left to right — the Speed
glyph, then the four active portraits in the order the round would resolve, a chevron for
"then" and `=` for a tie the RNG breaks, an ally's ring solid and an enemy's dotted. It is
`previewOrder` (`engine/combat/priority.ts`): the same keys `orderActions` sorts on, no RNG
spun. The player's declared actions carry their real bracket — a priority move, a switch (`⇄`)
or a Rest (`☾`) moves its portrait and wears the bracket as a pip; a rolled bracket shows
`?` at 0 — and the enemy's are unknown until the round plays, so they sit at bracket 0.
**During playback the ribbon is the real order** (same day): `resolveRound` emits
`RoundOrdered` — every action's settled bracket and Speed, right after `RoundStarted` — and the
ribbon walks it beat by beat: the last combatant whose turn began (`TurnStarted`, a Daze block,
a voluntary switch) stands forward in its type light, the ones before it fall back, a fainted one
is greyed, and the round's end retires them all. **A bracket that changed the order is lit**
(`bracketEffect`): a cut ahead of someone faster takes a gold ring and a doubled chevron `»`
in front of it, a hold behind someone slower a cold one; a +1 on the fastest hero, which moved
nothing, is a pip and no more. Both readouts are the one component (`TurnOrderRibbon`).

**Open, deliberately:** the hold cap, the price and the drop odds are all playtest numbers; and
whether a potion should be drinkable during a forced-replacement beat after a KO — the moment a
player most wants one, and the moment the board is mid-transition — is not decided. The scripted
first run does not yet mention the flask at all.

### Winning a fight: the post-fight gates

A won encounter resolves through up to five gates before the map comes back
(`App.tsx handleFightResolved`), in this order:

0. **The Guardian's Banner** (`GuardianBannerScreen`) — boss nodes only; a fixed 1-of-3
   team-wide relic (offense, defense or staying power), ahead of everything else remaining so a hero recruited at gate 1
   arrives under it. See §3.
1. **Recruit Contract claim** (`RecruitScreen`) — the beaten recruitable heroes, up to
   `MAX_CONTRACT_OFFERS` = 2 of them (`recruitment.ts pickContractOffers`). **Skipped
   entirely when the player holds no contracts**, and when nothing beaten was
   recruitable: the run goes straight on rather than opening a screen whose offer cannot
   be taken. On a boss node the act-end contract (§3) is granted *before* this check, so
   it is spendable on the heroes that boss fight just beat.
2. **The Crucible** (`CrucibleScreen`) — **boss nodes only**: pick ONE roster hero, and that
   hero takes a Class — one of three rolled from the whole catalog, a move or a passive
   (2026-09-11, `growth-overhaul.md` §11; it granted the Evolution until then). Once a hero
   stands at the rim there is no way back to the roster. Five a run, one per act.
   Skipped when every hero already holds a Class. Evolutions come from the 4th rung into a
   hero, inside the Mastery beat below.

**The levels themselves are not a gate.** They are granted in the same `RunState` transform as
the gold, before any screen opens (`grantEncounterLevels`), and reported on the victory overlay
rather than asked about — since 2026-09-11 as the whole roster standing in a row with a bar
under each that fills once per level and ticks the badge, reserve heroes included, so the
stat cells on the report screen that follows read as this fight's consequence
(`FightResultOverlay`, `docs/visual-language.md` twenty-ninth pass). The item drop is banked the same way, with the map's
Roster badge saying so (`docs/progression.md` "The bag notification" and "The uncapped bag").

Recruiting comes before the Evolution gate on purpose: the gear this same win paid out can then
go to the hero who just joined, instead of arriving one node too late for them. **2026-08-28, per user direction:** the claim used to be a band inside
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
- **Enemies are levelled, not stepped (2026-09-15, per user direction — `docs/enemy-levels.md`).**
  This bullet carried the per-act difficulty curve from 2026-08-30 to 2026-09-15: two scaling
  tracks with different baseline acts, an accelerating `ACT_STEP_CURVE` of +30 stat-total
  steps, node-kind stat bonuses on the Elite and the Guardian, and a ×1.3 multiplier for the
  champion. All of it is deleted. An enemy's one stat axis is now its **level**, rolled through
  its growth grades from 1 as a Guild hire's is, set per NODE off the player's par plus a kind
  offset (`ENEMY_LEVEL_OFFSET`, `src/run/difficulty.ts`), shown on the scouted chips, the node
  dossier and the fight nameplate. Enemy **gear from Act 4** is the second axis
  (`ENEMY_GEAR_FROM_ACT`, the `EnemyLoadout` seam), and a champion is front-loaded
  (`CHAMPION_GRADES`). The old bullet's open questions — the uniform stat draw ignoring HP's
  worth, whether a contract carries the act scaling, the monsters track's Act 2 placeholder —
  are all moot under it; what a contract carries is exactly what a roster hero has.
- **The Guardian's Banner (2026-08-30, per user direction; widened to five 2026-09-07;
  compressed to three 2026-09-14).**
  Beating an act's Guardian
  grants a second reward on top of the Recruit Contract: a **fixed 1-of-3 relic choice**
  (`GuardianBannerScreen`), shown after the wins that end **acts 1-4** and not after act
  5's, whose Guardian ends the run — a team-wide permanent handed to a finished run is a
  choice with nothing to spend it on. Not a map node; it hangs off the boss win itself
  (`App.tsx` `handleFightResolved`, `Screen` kind `guardianBanner`), and it goes **first**
  in the post-fight chain, ahead of the recruit/equip/level-up gates, so a hero recruited
  in that same beat already arrives under the banner.

  The three options never change and never roll — **one per concept**, offense, defense and
  staying power, so a run's picks read as a team shape ("two Warcries, a Bulwark, a Wellspring"):

  | Banner | Concept | Grant |
  |---|---|---|
  | Banner of the Warcry | Offense | Team-wide +40 Attack, +40 Intelligence |
  | Banner of the Bulwark | Defense | Team-wide +15 Defense, +15 Wisdom |
  | Banner of the Wellspring | Staying power | Team-wide +40 HP, +30 Mana Pool, +10 MP Regen |

  **The figures are measured parity, not a point scale.** A hero swings with Attack *or* with
  Intelligence, never both, so the Warcry's two stats are worth *one* stat to any given hero —
  that is why it carries both, so neither half of the roster finds it a trap. But the sim prices
  the stats themselves very unequally: **a point of Defense or Wisdom is worth roughly six
  points of Attack or Intelligence** (the Bulwark from +10 to +15 moved its lift +0.3 and the
  full-clear +4.7; the Warcry from +25 to +50 moved +0.2 and +6.3). So the Warcry's +40 stands
  against the Bulwark's +15, and at those figures the three come out within half a standard
  error of each other under the skilled pilot, the order flipping between seed blocks (3000 and
  4000 runs: +0.05 / 0.00 / −0.05, then +0.07 / +0.04 / −0.11). The hypothesis for the
  asymmetry is discrete: what wins a fight is HITS-TO-KO, and the player is usually on the
  favourable side of that threshold already (a ~1.13 stat ratio at the Guardian), so shaving
  incoming damage flips an enemy's 2-hit KO to a 3-hit far more often than +15% outgoing flips
  the player's 2-hit to a 1-hit — and the side with a bench turns every survived round into a
  switch and a regen tick. A hypothesis, not a measurement. The Wellspring carries HP beside
  both halves of the mana axis (2026-09-14, per user direction — HP came off the Bulwark, and
  the pool came down from +40): pool saturates (below) and regen alone was the auto-take, and
  HP is the half that still pays when a team dies before its mana does.

  **Five became three (2026-09-14, per user direction).** The five were one per STAT AXIS —
  Vitality (+50 HP), Warcry (+20/+20), Bulwark (+15/+15), Swiftness (+20 Speed), Wellspring
  (+40/+10) — and two of them went. **Swiftness was dead in every batch**, under both pilots
  (−0.43 / −0.69, z −11 at n≈2400; the only Banner ever significant in the wrong direction) and
  in the designer's own runs. The reason is the stat, not the number: Speed pays only at a
  THRESHOLD — it does nothing until it flips an ordering — and a flat team-wide grant never
  changes the intra-team order, is overridden by priority brackets, and flips perhaps one enemy
  matchup a fight, where every other stat pays continuously through the ratio. Citrine (−0.17)
  is the same finding in the equipment family. Speed is fine as a HERO stat, because a hero's
  base line pays for it; it is a bad GRANT, and no Banner carries it. Vitality was first folded
  into the Bulwark and then, the same day, moved to the Wellspring — the Bulwark led every batch
  at either shape (+0.28 to +0.74, z 3–7), and it was the five-Banner passes (n≈490 a Banner,
  se 0.26, the four non-Speed Banners shuffling order every batch) that had been too small to
  see it. `test/relics.test.ts` pins all three shapes and the absence of Speed.

  Being **fixed** is the design, not a placeholder. Because the same three come back every act,
  the real decision is *what shape is this team*, and that only becomes a decision if the player
  can see all three offers coming from act 1. There is no random relic pool for one to leak into
  any more (2026-09-07); `RelicDefinition.guardianBanner` is now display grouping only.

  **Stacking** needs no new mechanism: duplicate relic ids already sum in
  `relicTeamStatModifiers`. What is new is how a stack is *written* — one card named
  `Banner of the Bulwark +2` carrying the summed `+45 Defense`, rather than three identical cards
  (`src/view/shared/relicStacks.ts`, used by `RosterPeek` and the map's Banner shelf). The suffix
  counts copies **beyond the first**, the upgrade-pip convention: 3 copies reads "+2".

  **Where a raised Banner lives (2026-09-10, per user direction):** the bottom-right of the map
  well, flying opposite the location placard (`BannerShelf.tsx`). It was a rail across the top of
  the Roster sheet listing every Banner held or not, which was there so spread-vs-commit would be
  visible from act 1 — but that decision is taken on this screen, which shows all three anyway, so
  the rail was charging the gear board its whole first fold to restate a choice already made. The
  shelf shows only what is HELD, with a count past one; an act-1 run flies nothing, which is
  correct. See `docs/equipment.md` §9.3 for what the freed room went to. Like
  every relic, a banner applies to heroes obtained before *and* after it — the grant is
  broadcast to the side at fight-build time (`entryStats.ts`), never written onto a hero.

  **Open balance question — parity is measured against the skilled pilot only.** Under the
  chart pilot the same figures spread to +0.21 / 0.00 / −0.21 (Bulwark / Warcry / Wellspring,
  z ±2): a pilot that dies early values mana less, which is what the mana-tuning invariant
  ("mana investment must pay out later than the point at which a weak team dies") predicts, and
  a new player is nearer that pilot than the skilled one. The two levers if playtest agrees
  are the Wellspring's HP (+40 → +50) and its regen; the Warcry's +40 is the number a player
  will read as "why is offense priced so high", and the six-to-one above is the answer to
  keep on hand. **The sim's answer is directional; the playtest's is the decision.** Flag
  before hardening either way.
- **Relics: stat-only, by design.** `src/run/relics.ts` still carries `grantsPassiveIds` and
  `grantsStatusIds` — the team-wide grant shapes the pipeline supports — but as of 2026-09-07 no
  shipped relic uses either, and the ~50-relic random pool that did is deleted. Playtest found
  those relics collapsed into two buckets: a bigger stat grant, or a passive that was unanswerable
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
  never meant to inherit a Manticore (`locations.md` §3).
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

  Wild's Edge's is the **Manticore** (`enemies.ts`) — Beast/Ancient, 550 stat total,
  20 MP Regen, four moves across four types (Claw, Maul, Enfeeble, and the
  Ancient row authored for him, Archon Blast). **Attack 55 since 2026-09-15** (−10 into +20 HP,
  per user direction): with gear absorbed and Act 1 two levels lighter he was still the act's
  wall at 77% and killed two heroes a fight; measured 82% after, Act 1 58 → 62%. Attack is his
  one dial — a shift into Mana fed Archon Blast and read worse, and MP Regen barely moved him. He is enemy-pool content, so
  `isRecruitable` excludes him by pool membership exactly as it does every Goblin: a
  beaten Manticore produces no contract offer. He carries **no node-kind stat bonus** —
  the 550 is the authored number and the escorts' +20×3 is not applied to it — but he does
  take the **act curve**, which is the only thing that ever moves a champion (`ENEMY_LEVEL_BY_ACT`
  is inert for one; see §3).

- **The companion (2026-09-13, Titanspawn overhaul phase 4, `src/run/companion.ts`).** After
  the run's first fight is won, the beaten side's lead Early asks to join, and does — the screen
  (`CompanionScreen`) has one button, a welcome, and the creature dances and chirps while you
  read it (per user direction: "the friendly {name} wants to accompany you", no declining). It is
  a hero in every respect but one — a slot, roster-wide levels, Scrolls off its type's whole
  slate, items, restores between nodes — and the one is `RosterEntry.mortal`: a knockout takes it
  back into the Titan, first in the post-fight chain, ahead of the level report, its items to the
  bag. Its Evolution rung is a tier-step in place of a branch (Early → Mid at `EVOLUTION_RUNG`,
  Mid → Late where the Late band opens), raised from the Mastery board's pour like an Evolution.
  The post-fight chain is therefore: **companion lost → levels → companion joined → Banner →
  contract → Crucible → Mastery**. One per run; a dead one is not replaced (open in the overhaul
  doc's §10). `rosterHeroes` (`data/content.ts`) is what the roster-facing screens read now.

- **The mob layer is Titanspawn (2026-09-13, Titanspawn overhaul phase 2).** Everything below
  this bullet about Goblins, factions, `FactionRoster`, `basicEnemiesOf` and
  `generateLeaderEncounter` is history: the six factions were deleted whole and their sprites
  archived (`art/archive/factions/`), and what `fight`, `battle` and the Guardian's escorts
  field is a **Titanspawn** — one mob line per mortal type in three tiers, drawn by the
  Location's `spawnTypes` and the act's tier (`docs/titanspawn-overhaul.md` §2-§4;
  `src/data/titanspawn.ts`, `src/run/spawn.ts`, `SPAWN_TIER_BY_ACT` in `difficulty.ts`).
  The composition: Act 1's opener is two bare Earlies from every line; from Act 2 the opener
  is a leader at the act's tier (floored at Mid) over three Earlies that each carry one item
  rolled on the act's drop curve — the Earlies stay Earlies all run and equipment is what
  scales them, per user direction; `battle` is that shape in every act until phase 3; the
  Guardian's escorts are two spawn at the act's tier. **The escorts ride the monsters track
  now**, reversing the 2026-09-06 "the pool moves; the scaling does not" below: a Late is
  600 base, authored against the monsters curve, and on the skirmish track it made the Act 4-5
  Guardians 25-43% fights (40-run sim). On the monsters track they measure 71-100% and are the
  run's hardest Guardians rather than its walls — phase 6's re-fit starts from there. The
  champion alone keeps the skirmish track, appended separately. Nothing the Monsters word
  meant on the map changed; only what it points at. **2026-09-15: both tracks are gone** —
  the escorts and the champion take the Guardian node's level (`docs/enemy-levels.md` §4).

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
  non-Goblin champions were **700 → 550**, the Manticore's already-tuned figure, cut out of
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
- **Wounds: HP persists across an act's nodes; mana does not (2026-09-15, per user
  direction, FOR PLAYTEST).** `src/run/wounds.ts`. A fight writes each fielded hero's
  missing HP onto `RosterEntry.wounds`, the next fight places it that far down, and the
  act's end (`advanceToNextAct`) is the one free mend in a run. It is stored as the HP
  MISSING rather than the HP held, so a max that moves mid-act — a growth roll, a
  Banner, an item swapped at the Blacksmith — moves the current by the same amount on
  its own. Mana still opens full every fight (the LOCKED full-starting-pool decision in
  `mana.md` stands): mana persistence's failure mode is a Rest on turn 1, which is a
  dead turn rather than a decision, and Overflow would otherwise carry uncapped across
  fights. It is a second dial for a second experiment (the walk regenerating N rounds of
  MP Regen), not part of this one.
  **The walk floor is what makes this not the 2026-08-16 reversal again.** That pass
  persisted raw HP and a KO'd hero stayed at 0 into the next fight — a dead roster slot
  with no way back. Now every hero enters the next node with at least `WALK_FLOOR` (25%)
  of its max, KO'd or not: a floor on EVERYONE rather than a revive rule, so dying is
  never a better outcome than surviving at 8%. The floor is applied when the wound is
  written (`woundsFrom`) and again when it is read (`woundedHp`), the second covering a
  max that fell.
  **Why:** with full heals every fight had to be a wall, because a fight that is not a
  wall is free — and the act was three coin flips and a boss. Under wounds a fight can be
  individually winnable and still cost something, and the act's threat becomes the
  Guardian faced with a depleted roster (Slay the Spire's model: hallway fights are easy,
  the sum is the threat). The follow-on, if it plays, is lowering per-fight enemy stats;
  the enemy curve is untouched for the first playtest. The second aim is churn: the
  contract hero standing there after the Elite is at full HP, and "would you like a
  healthy hero" is a different offer from "would you like a hero".
  **The faucets, every one priced:** the **sideboard** (bring-6-pick-4 fields a fresh
  hero over a wounded one — a heal that costs power, on every fight, with no node), the
  **Rest** (`restReward`, weight 30 in `REWARD_WEIGHTS`: the whole roster whole, in the
  seat a reward row would have given to gear, Scrolls or a Boon — the Slay the Spire
  rest-vs-upgrade choice, inside the row the map already has), the **Guild Hall's mend**
  (`MEND_PRICE` = 40, the whole roster, dark while nobody is hurt), and a **contract**
  hero, who arrives whole. Potions are NOT drinkable on the map (per user direction):
  they are a free action in a fight with the outcome shown before declaring, so drinking
  at a fight's start is strictly better than drinking on the map and the map version is
  dominated. What wounds change about potions is that the 20g shelf line and the hold
  cap of 3 become real. `WoundBar` draws the bar everywhere the roster is read (2026-09-15, second pass, per user
  direction — a rim on the squad cell and a bar behind the roster glyph were not a read):
  the **map's footer button wears the party** as six portrait chips with bars, so the state
  is on the map rather than behind a tap; the **squad cells** carry a bar row with the
  figure (it still fits four scouted on one page — stage bottom 594px against the footer at
  688); the **fight result** draws what the fight LEFT under what it paid, per hero, the
  fielded off the end state and the reserve off what they carried; the **hero sheet** carries
  the figure under the pips; and the roster peek and the Rest. It is always drawn full too,
  since a bar that only appears when something is wrong cannot be compared against the ones
  that are fine.
  **Open for playtest:** Act 1 (three heroes, no real sideboard, already the wall) gets
  the same rule with nothing scripted for it; the per-act Recruit Contract lands at the
  Guardian win, the instant everyone is healed anyway, so it becomes the least
  persuasive contract in the run; and the sim's walk picks reward nodes uniformly, so
  its full-clear under wounds is a floor on a pilot that never chooses to Rest.
  **Measured (2026-09-15, 600 runs, `--pilot chart --seed 7`, same seed both ways):**
  full-clear 31.8% → 12.0%; act clear 62 → 53% (Act 1), 83 → 68% (2), 96 → 87% (3),
  74 → 60% (4), 87 → 64% (5); 73% of deaths at a Guardian. The pilot fields a wounded
  hero at a discount but drinks no potions and takes a Rest only when the uniform walk
  lands on one, so the number is what an unmanaged roster loses — the curve re-fit, if
  the feel plays, comes off per-fight enemy stats, not off the floor.
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

**The enemy is the Herald, and behind it what the five lands turned** (2026-09-17, per user
direction — `generateFinaleEncounter` with `FinaleEscortOptions`, `App.tsx`):

| Bench position | Who |
|---|---|
| active | **The Herald** — mono-Ancient, on the field from the first round |
| active | The Act 1 seal's Late Titanspawn |
| bench 0-3 | The Act 2, 3, 4 and 5 seals' Late spawn, in seal order |

One Late spawn per broken seal, drawn from that seal's Location lines (Wild's Edge draws from
every line), at the finale's level and every Mastery pip — the fully-turned mortals of each land,
which is what a Titanspawn is (`titanspawn-overhaul.md`). The Herald leads because it is the
standard-bearer, and because a boss on the field from round one with its company behind it is a
fight where a boss entering last behind five sacks was a queue. Measured before the flip: the
unsealed Guardians hit for 10–30 a round and the Herald fight was 100% won with 90% HP left; with
the spawn it is 99% for the skilled pilot and **100 → 88%, 42% HP left** for the chart pilot. The
Herald's own damage is still 60–70 a round because its kit is Ancient filler (Runic Blast 60 BP at
14 mana) — the Ancient slate is the lever left.

> **Superseded, kept for the derivation it left behind.** The finale fielded the five unsealed
> Guardians ahead of the Herald from 2026-09-05 to 2026-09-17; `finaleEnemies` still carries the
> unsealed forms and `generateFinaleEncounter` without escorts still builds that shape.

**The five arrived unsealed** (the shape above replaced). They field as their base type alone — Manticore mono-Beast,
Yugzulach mono-Shadow, Kraken mono-Water, Elder Bough mono-Nature, Dragon mono-Fire,
Skeleton King mono-Spirit — because the Ancient half *was* the seal and the player already
took it (`lore.md` §6). This is balance and fiction agreeing: six X/Ancient bodies at ~700
stat total, none takeable at super-effective damage, against the Pact Clock, is a finale
that ends in a timeout — and `FightScreen` resolves a mutual wipe as a **player loss**. The
Endbringer is the only true wall, which is what the Titan's Herald should be. **Since 2026-09-16
the corridor has a third node after it, `titan` — the Titan's Eyes, the true final boss
(`docs/titan-eyes.md`): two mono-Ancient Eyes with a gaze that telegraphs a Regard, the wide pair
in reserve for phase 2, a free mend between the two fights, and the champion's hall after.**

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
- **Enemy levels — the table is built, the two end acts are not settled** (`docs/enemy-levels.md`
  §6): Act 1 measures 79% cleared against 85 under the old curve, Act 5 92 against 82. The
  Skirmish's offset and the hire's +1 are the Act 1 levers; gear from Act 3, a second item for
  the Guardian, or passives through the loadout seam are Act 5's.
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
