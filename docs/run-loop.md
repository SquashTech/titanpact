# run-loop.md — The Escalating-Fight Run Loop

> Module of the Titanpact `/docs` suite. Companion to `combat.md`, `progression.md`,
> `mana.md`, `architecture.md`, `locations.md` — which owns the layer directly above this one:
> **which place** an act happens in, and how that biases the encounter pools §2 describes — and
> `lore.md`, which owns what §4's finale *means*. This is the map/node structure that turns a
> single fight into the roguelike run CLAUDE.md's north star describes: draft → escalating fights
> → relics.

Slay the Spire is the direct reference (2026-08-16): a branching map of nodes, most of which
reward something, interspersed with fights, culminating in an end-of-act boss fight against a
**Guardian**. "Ancient" is reserved for the locked type — a rare, boss-only near-total defensive
wall — and the Titan behind the finale.

A run is **four seal acts of the §1 shape, then the finale act** (`TOTAL_ACTS` = 5, `SEAL_ACTS`
= 4, `FINALE_ACT`; `docs/xp-overhaul.md` §5). Act 5 of the old five-act run was deleted, not
compressed.

---

## 1. Map shape

`src/run/map.ts` generates a deterministic (seeded) branching map for **one act**; a run chains
them (§3 "Multi-act sequencing"). The shape is forced and identical in every seal act, so no path
can skip from the opener to the funnel on reward-node luck:

- **Row 0: a single forced `fight`** — the act always opens on an easy, unambiguous fight.
- **Row 1: pick 1 of 3 — reward types only**, weighted from `REWARD_WEIGHTS`. No fight, shop or
  Mentor mixed in: every reward row is a genuine reward choice, never a chance to draw or dodge a
  fight. A row never repeats a type.
- **Row 2: the spliced seat** — a single forced node: the **Mentor** in acts 1–3, the **Tutor** in
  act 4 (below).
- **Row 3: pick 1 of 3 — reward types only.**
- **Row 4: the Scribe** — a forced row: pick two heroes, two Mastery pips each ("Mastery Scrolls"
  below), ahead of the fork so the Evolution it buys is in hand for the Elite and the Guardian.
- **Row 5: pick 1 of 2 — `elite` or `skirmish`.** The Elite is the act's difficulty spike (a level
  over the Skirmish, loot one tier ahead, **XP ×1.5** above par); the Skirmish is the plain,
  recruitable alternative. Both tiles preview the typing they field.
- **Row 6: pick 1 of 3 — reward types only.** The third reward row (2026-09-08): with two seats
  across a nine-type pool the rarest cards were drawn about once a run.
- **Row 7: the funnel — one forced Guild Hall** (`shop`), the act's one guaranteed spend.
- **Row 8: the `boss`** — the act's Guardian.

So every act is **Fight → pick 1 of 3 → Mentor / Tutor → pick 1 of 3 → Scribe → (Elite or
Skirmish) → pick 1 of 3 → Guild Hall → Guardian** — three fights, none skippable. A single-node row
is one no path can bypass.

**Three fights an act (2026-09-14, per user direction).** The un-forked Skirmish row came out: the
run measured ~92 minutes for a player who taps every beat against a 45-minute target
(`scripts/sim/time.ts`), and cutting an act would have cost a Location, where the run's flavour
lives. The plain Skirmish was the fight to lose — in later acts it won at 100% with three-quarters
of the squad's HP left, costing time and nothing else. The act's XP was re-sized ×1.25 so par
still lands the decided act ends (`ENCOUNTER_XP_BY_ACT`, `ENCOUNTERS_PER_ACT` = 3). Measured on
the same 600-run seed: **Reader 92 → 77 min, Auto 63 → 53, Fast 37 → 32**; full-clear 23 → 26%,
Act 1 clear 51 → 65%.

**The fork is Elite-or-Skirmish** (2026-09-13). Both draw the recruitable pool and both pay a
contract; what separates them is the Elite's risk/reward and the TACTICAL axis: each tile previews
the enemy typing it fields. The preview is honest by construction — every encounter node draws
from a seed derived from the map's seed and the node's id (`src/run/encounters.ts`, the one place
the game, the sim and the preview all build an encounter), so the tile and the tap are the same
draw, and the fork's Skirmish is re-rolled until it differs from the Elite in at least one type.
`battle` survives as a node type only for a save that still holds one.

**The Mentor** (acts 1–3, `mentorReward`, `MentorNodeScreen`): pick a hero, and one **Mid-tier
move is ROLLED** from its own pool, un-gated and taking no schedule entry (`mentorMovePool`,
`src/run/tutor.ts`). Who is the only decision, on purpose — it is one of a new player's first
nodes (it was briefly a curated pick, and before that a stat-pair Class). It sits **ahead of the
fork**, so the move is in hand for the act's first recruitable fight. With the Tutor it is the
only way to a move AHEAD of its schedule. `SPLICED_ROW`, `LAST_MENTOR_ACT`.

**The Guild Hall's three counters (2026-10-08, per user direction; replacing the Shop / Tavern /
Smithy split of 2026-09-24):** **Tavern** (the hire board — each hire one Recruit Contract — and the
bar: the Contract for gold, the reroll, the party mend, and on the back shelf the two potions and
the Revive), **Gems** and **Gear**. It opens on the Tavern. The Smithy came off the every-act hall:
an Anvil and an Enchanter over every worn piece every act was a freedom that made a visit homework.
The Gem and Gear counters each show the whole roster under the stock — **every hero's Mastery pips
at the Gems, every hero's three sockets at the Gear** — so the decision is made on the counter and
not on the Roster screen. **Pick a piece, then the hero: it is bought straight onto that hero**
(armed first at `CONFIRM_PURCHASE_FROM` and over), with no who-screen after; a Gem whose pip opens
an Evolution or masters the innate raises it over the hall (`HallCounters.tsx`). The stock grew
with the room: **`SHELF_GEM_COUNT` = 9 — every stat once and two seconds**, and
**`SHOP_ITEM_COUNT` = 6** pieces on the act's standard curve at `EQUIPMENT_PRICE_BY_RARITY`.
**The Vigil trades the Tavern for the Smithy**: Gems, Gear, and the Anvil and Enchanter over worn
gear — nobody joins for the finale, and with no bar no mend, potion or Revive is sold there.
Cycle III's "the Smithy ×1.5" (`smithyPrice`) now prices only the Vigil's Smithy.
**The reroll** is the Tavern's one lever on WHO shows up: a fresh shelf for
`TAVERN_REROLL_BASE_COST` = 10g, +`TAVERN_REROLL_STEP` = 10 each time a visit
(`rerollGuildHallOffers`), never a roster hero and never a face just turned away while the pool can
spare one. Untuned, and the sim never rerolls.

**The Blacksmith — deleted 2026-09-15** (`docs/gear-absorption.md` §6). From act 3 the funnel was
a pick of Guild Hall or Blacksmith (item slots, the Anvil, the Enchanter). With gear absorbed the
funnel is one forced Guild Hall every act; nothing is sold back. Its Smithy went to the Vigil alone on 2026-10-08.

**The map is a scene, not a graph (2026-09-08).** It shows where the player is standing and the
two or three places they may go (`MapRoute`); the whole-act grid is gone. Across 40 seeds only
**two of seven branch points actually route anywhere**, so the graph was spending the whole screen
to price two decisions. Those are priced on the cards instead: an **"Opens" chip** names what a
choice leads to, drawn only when the options on the row differ (`leadOnTypes`, `leadOnsDiffer`,
derived from `nextIds`). The **progress rail** (`railTypeFor`, `ProgressRail`) keeps the act's
shape: a dot for a row that only pays out, the node's own glyph and colour for one that does not,
a mixed row wearing its **hardest** option so the rail never under-promises. Tiles carry a glyph,
a colour and **one short word** (`NODE_LABELS`, `mapNodes.ts`; labels came back 2026-10-02), and a
long press reads any node out in full. `generateMap`, `reachableNodeIds`, `advanceToNode` and the
save format did not change: the act still HAS its shape; the player is walked through it.

**Edges.** Each node connects to 1–2 nodes in the next row within a small column window, with a
repair pass guaranteeing every node an incoming edge, so the "pick 1 of 3" framing holds for real.
The rows feeding the fork and the funnel **fully connect**: a seed must never decide either
choice. Between 2026-08-26 and 2026-09-08 the row above the fork instead *steered* (left → Elite,
right → the other); it was reverted because steering only prices a choice if the price is visible
when paid, and a scene showing one row at a time cannot show a reward two rows back closing an
encounter (`test/map.test.ts` pins both).

## 2. Node types

**What the map calls them.** The encounter types share **two** player-facing names: `fight` (and
the legacy `battle`) read **Titanspawn**; `skirmish` and `elite` read **Skirmish**; `boss` reads
**Guardian**. The split is recruitability — the one fact a player needs before choosing a route —
and difficulty is carried by colour and glyph (`NODE_COLORS`, `nodeIcons.tsx`). Titanspawn tiles
wear the **Titan's eye**; a Skirmish tile's face is its **enemy typing**, one wedge per type
(`ElementPie.tsx`), the Elite keeping its crown as a badge. The two channels are deliberately not
redundant — name for recruitability, colour for difficulty (making colour agree with the label put
two reds a shade apart on the act's one real difficulty choice, and was reverted).

| Type | Resolution |
|---|---|
| `fight` | The act's opener: **Titanspawn** (`run/spawn.ts`, "The mob layer is Titanspawn" below). Not recruitable. |
| `skirmish` | Four heroes from the **recruitable pool**, at par. The fork's plain option; a Recruit Contract shot. |
| `elite` | As `skirmish`, one level over it (`ENEMY_LEVEL_OFFSET`), loot one tier ahead, XP ×1.5. |
| `boss` | The Location's champion over Titanspawn escorts, all at the node's level (`docs/enemy-levels.md` §4). Pays the Guardian's Banner and the Crucible, and ends the act (§3). It paid a Recruit Contract until 2026-10-05 ("Contracts" below). |
| `shop` | The **Guild Hall** — Tavern, Gems and Gear (§1); the Vigil's is Gems, Gear and Smithy. Rolled once a visit (`rollGuildHallOffers`). |
| `equipmentReward` ("Items") | `NodeRewardScreen` — pick 1 of 3 items on the act's curve; the pick goes straight to the who-screen (`docs/gear-absorption.md`). Weight 78. |
| `currencyReward` | An instant gold grant (15–30 at Act 1, × `ACT_GOLD_SCALE`), paid on arrival and counted up into the purse. |
| `contractReward` ("Contract") | One Recruit Contract, paid on arrival (`grantContract`). Weight 24. See "Contracts" below. |
| `scrollReward` ("Scroll Cache") | `ScrollNodeScreen` — **`SCROLL_CACHE_COUNT` = 3 Mastery pips** in any split. Weight 20. See "Mastery Scrolls" below. |
| `scribeReward` ("Scribe") | `ScrollNodeScreen` — pick TWO heroes, **2 pips each** (`SCRIBE_PICKS`, `SCRIBE_PIPS_EACH`). Not in `REWARD_WEIGHTS`: a forced row every act (§1). |
| `forgeReward` ("Forge") | The Smithy's Anvil AND Enchanter, free, once. See "The Forge and the Ley Line". Weight 25. |
| `leyLineReward` ("Ley Line") | Pick a hero: +`LEY_LINE_FORCE` = 10 Force at its innate primary, for the run. See "The Forge and the Ley Line". Weight 25. |
| `manaWellReward` ("Mana Well") | Pick a hero: +`MANA_WELL_AMOUNT` = 40 max Mana and +`MANA_WELL_REGEN` = 5 MP Regen, for the run. See "The Mana Well". Weight 20. |
| `restReward` ("Rest") | The whole roster made whole, the downed stood up. See "Wounds". Weight 30. |
| `passiveReward` ("Boon") | Pick 1 of 3 passives, then the hero it settles on. See "Boons". Weight 22. |
| `blessingReward` ("Pactwarden's Shrine") | A Blessing for one hero not already holding one (`grantBlessing`, `blessings-and-statuses.md` §1.4). Weight 3. |
| `mentorReward` ("Mentor") | Acts 1–3, the forced spliced row only. See "The Mentor" (§1). |
| `tutorReward` ("Tutor") | Act 4, the forced spliced row only. See "The Tutor". |
| `event` | One authored map event, rolled at node select and gated by act and Location. See **docs/events.md**. Weight 30. |

Every encounter node's enemies arrive at a **level** set off the player's par entering that node
(`docs/enemy-levels.md` §4) — the Skirmish at par, the Elite a step over, the Guardian's escorts
under and its champion over them, plus the act's own term — and at the act's Mastery, so from
Act 4 every hero-pool enemy is evolved.

### The two reward lanes

What a won fight pays, by node (`GOLD_REWARD_RANGE`, `EQUIPMENT_DROP_CHANCE`, `LOOT_SOURCE`; one
table each, so the map's readout and the roll cannot drift):

| Node | Gold (Act 1) | Equipment drop |
|---|---|---|
| `fight` (opener) | 15–25 | **always**, act's standard curve |
| `skirmish` | 15–25 | 60%, standard curve |
| `elite` | 15–25 | **always**, one tier ahead |
| `boss` | **30–45** | **always**, one tier ahead |

The lanes were once Monsters (loot and gold) against Skirmish (recruits); with `battle` off the
map the opener is the loot lane's only fight, and the fork is Elite against Skirmish on risk and
reward. The drop odds were **measured** (`docs/gear-absorption.md` §5): every table without the
opener's guaranteed item lost six to eight points of full-clear, all in acts 1–2. The Guardian
carries the fat gold band (2026-09-17), so the act's hardest fight is its richest, banked for the
next act's Hall.

**Gold carries the act** (`ACT_GOLD_SCALE` ×1 / 1.5 / 2 / 2.5 for acts 1–4, rounded to 5s). Without
it a fight paid the same in the last act as the first while the Smithy's prices climb 25 → 130 a
lift; measured on the five-act build, income rose from a flat ~45g an act to roughly one Smithy job
at the act's window tier plus one shelf item, and the sim's pilot then spent it on the Anvil and
Enchanter (full-clear 11.5 → 15.8% on one seed). If late acts read as rich in play, the Guardian's
band and the scale's last steps are the dials.

**XP** is authored by act and priced by kind — the Guardian ×2, the Elite ×1.5 — read off the node
fought (`ENCOUNTER_XP_BY_ACT`, `ENCOUNTER_XP_MULTIPLIER`, `encounterXpKind`, `src/run/growth.ts`).
Par assumes the Skirmish, so the Elite's XP is above par; the node dossier prints it beside the loot
tier so the fork's XP is a reason the player can read.

### The Tutor

**The Mentor's beat at the Late band** (`tutorReward`, `TutorNodeScreen`): act 4's forced spliced
row. Pick a roster hero, and **one Late-tier move is rolled** from its pool (`tutorMovePool` =
`tierMovePool` at Late, `src/run/tutor.ts`: the authored table plus a chosen path's line, minus
what the hero holds or was already offered), un-gated by level and taking no schedule entry. Below
`MOVE_CAP` it lands; at the cap it is the replace-or-decline question. The offer is spent by being
made. It reaches a Late move before `lateLevel`, or a second once the schedule's one has landed
(every Late slate holds four, `test/tutor.test.ts`). It was once a curated pick of any move off the
pool — the run's strongest reward and its longest screen — until the schedule made the Late band
reachable for everyone.

### Boons

The **Boon** node hands one hero a **passive**, permanently. It is the salvage of the deleted relic
pool: the passive relics were the only ones that felt like anything, and what made them unusable
was the *scope* — applied to all four heroes at once, a passive is either a bigger stat grant or an
unanswerable one. Given to a hero the player chooses, the same effect is a build decision.
Mechanically it is `grantEventPassive`, an ordinary entry in `RosterEntry.bonusPassiveGrants`.

**The pool has two halves** (`src/run/boons.ts` `boonPool`):

- **The roster-agnostic half** — every equipment and event passive (`boonPassives`), live on any
  hero.
- **The type-locked half** — one per type, +20% damage with that type's moves
  (`typeDamagePassiveFor`, `TYPE_DAMAGE_BONUS`). **Ancient has none**: nothing can reach an Ancient
  move.

**Excluded on purpose:** Evolution passives, Classes and innates — each is somebody's identity
already (an innate that IS an equipment card stays, as that card).

**The type filter is what makes the type-locked half possible.** A type Boon is offered only when
some roster hero fields that type, grafts included; unfiltered, a typical 1-of-3 would show two
grants nobody could use. Filtered, a type Boon is never dead and is usually the strongest card,
which makes passing it up a real decision. **The filter stops at the offer**: the hero-pick phase
prints how many of each hero's moves the Boon would fire on (`boonMoveCount`), reddened at zero —
not a block, since heroes carry off-type moves by design.

**A Boon stacks**: `bonusPassiveGrants` appends, so a second copy on one hero is a build, not a
wasted pick.

> **Open — the weight (22) is a first pass.** It is the only reward-row node that changes how a
> hero *plays* rather than how big its numbers are, which argues for scarcer; it is also the node
> most likely to be why a run comes together, which argues for commoner. Playtest.

### The schedule

**Moves come from each hero's level-up SCHEDULE** (`src/run/progression.ts`,
`docs/xp-overhaul.md` §4). A `LevelSchedule` — `offerLevels`, `midLevel`, `lateLevel`,
`signatureLevel` — read off the hero's own level: a level on the list rolls ONE move from the band
it has opened (Early below `midLevel`, where it expires; Mid until `lateLevel`, where it expires;
Late after), take it or decline, burned either way, replace-or-decline at `MOVE_CAP`. Every hero
authors **five offers** (two Early, two Mid, one Late); `DEFAULT_SCHEDULE` is what the Titanspawn
and so the companion read. The signature is a guaranteed learn at `signatureLevel`. It pays out on
the level-up beat after a fight (`levelUpFlow.ts`), one entry a hero a beat, in roster order.
`RosterEntry.scheduleTaken` walks the entries in order, which is what lets a raw hire work its
backlog off one fight at a time. Rules: `leveling-and-ranks.md`.

### The Mana Well

`manaWellReward` → `ManaWellScreen`: pick a hero, and its max Mana rises by `MANA_WELL_AMOUNT` = 40
and its MP Regen by `MANA_WELL_REGEN` = 5 for the run (`grantManaWell`, onto `bonusStatGrants`;
stacks). It was +30 Mana alone and never taken; the regen makes it the map's only per-hero regen
(2026-09-28). Every card says the pool it would leave the hero with.

It is a bare number with a screen, brought back on purpose and **for mana only**: +10 Attack was
never something a player could see happen, but a pool is the stat a whole tier of moves is priced
in, so +40 Mana is a Late cast a fight, visibly, and the choice of who reads off what each hero
could then cast. A Vitality shrine does not get to ride on it. The sim's pilot does not plan its
Late casts and so under-values it; watch it in playtest rather than the sim.

### The Forge and the Ley Line

**2026-09-17, per user direction.** The Smithy's two verbs — the Anvil's lift and the Enchanter's
binding — each given a free seat on the map. Seven reward types filling nine seats an act meant
every act showed nearly every node; nine types into nine seats makes a reward row a draw again.

**The Forge** (`forgeReward`, `ForgeNodeScreen`, `forgeItem`): the roster as benches
(`SmithyBenches`); tap a worn piece, pick an element, and it comes off the anvil **a tier up AND
bound** (2026-09-24 — the lift alone read as a trap pick). The lift is the paid Anvil's quote
(`anvilQuote`): a Unique, a Mythic or a tier the act's window has not reached gets no lift, but is
still bound, so the node is dead only for a roster that wears nothing. Played on `SmithyBeat`'s
`forge` beat. Watch it: a free lift an act eats about one paid one, and gold already pools.

**The Ley Line** (`leyLineReward`, `LeyLineScreen`, `grantLeyLine`, `LEY_LINE_FORCE` = 10): the
hero draws Force at its **innate primary** — the Enchanter's own rule — held on
`RosterEntry.bonusStatusGrants` and summed with its gear's Force at fight build, listed on its own
sheet line. Force is a flat add to a move's BasePower before the multiplier chain, **per hit, per
target**: +10 on an Early move's 40 is +25% on every hit of the type. Sized as a Rare enchant, and
flat on purpose — a Late move's 90+ outgrows it, so a Force-stacked spread attacker limits itself.

**On the bare-number rule.** The Ley Line is the second named exception beside the Mana Well:
Force is not a stat but a typed damage-pipeline term paid only on the hero's own element, so it is
read on every hit rather than on a sheet. The Forge needs none (an item is already a thing a screen
hands over). Neither extends to a third.

### Mastery Scrolls — the Scribe, the Cache, and the shelf

**Pips the player aims at ONE hero** (`src/run/mastery.ts`, `docs/mastery.md`). Every hero has
ten; **five is its Evolution, ten masters its innate** (`masteredPassiveIds` replaces `passiveIds`)
— uniform, no per-hero figure. A Scroll is one pip, landed the instant it is paid on
`ScrollNodeScreen`. *Fights pay XP, the map pays Scrolls*, with one exception, the MVP pip below.

- **The Scribe** (`scribeReward`, a forced row every act: two heroes, 2 each) — it cannot be
  concentrated, and that is what seeds the roster.
- **The Scroll Cache** (`scrollReward`, weight 20, `SCROLL_CACHE_COUNT` = 3 in any split) — where
  the player prioritises. It was 46, under which an act held two or more Caches 47% of the time
  and, with the Scribe's 2, an Act 1 Evolution was the default; at 20 an act holds one 60% of the
  time.
- **The Guild Hall shelf** (`SCROLL_PURCHASE_COST` = 25g, `SCROLL_PURCHASE_LIMIT` = 2 a visit, two
  pips to a pack, `SCROLL_PACK_PIPS`).
- **The MVP pip** (`src/run/mvp.ts`): the biggest share of one team column takes a free pip, never
  the same hero twice running.

The fifth pip raises the Evolution screen over the node that paid it (`masteryFlow.ts`); the
level-up report raises it only as the catch-all for a hire that arrived past the pip. The supply is
the balance number (`docs/mastery.md` §8).

**Ichor is retired** (2026-09-14): XP paid by the map broke *fights pay XP, the map pays Scrolls*,
its measured effect on full-clear was nothing either way (`docs/xp-overhaul.md` §8), and a second
aimed currency with the same who-screen was one too many to teach. **Gems** (per-hero stat stones,
deleted 2026-09-10) failed the rule *a bare number never gets a screen*: `docs/growth-overhaul.md`
§1.

### Consumables — the two flasks and the Revive

Two potions and a Revive, held as a TEAM purse beside gold (`RunState.consumables`,
`src/run/consumables.ts`). **HP Potion** restores half of max HP, **MP Potion** half of max Mana.
Every run opens with one of each — the early lever against an awkward first matchup.

**A potion is a FREE action, not a declared one.** A potion's point is that the player sees its
outcome before declaring, so it is not an `Action` kind: it is applied to `CombatState` on the spot
during the command phase (`useConsumable`, `src/engine/combat/consumables.ts`), emits
`ConsumableUsed` then the ordinary `HpChanged`/`ManaChanged`, and the command grid re-derives — an
out-of-mana Rest row turns back into moves. A hero that had committed Rest is re-asked. Irreversible:
Back cannot un-drink.

**Five rules, each answering a way the potion could quietly become something else:**

- **Not a trigger source.** No passive reaction pass runs behind a potion, as behind the Pact
  Clock; otherwise a heal-reactive passive gets a free trigger for no turn.
- **A RESTORE, never a grant.** Mana caps at the pool; overflow (`mana.md`) reads as full and
  refuses the potion. Overflow is Arcane's and `manaGrant`'s alone.
- **Flat, outside the heal formula.** No WisdomMult, no STAB, no variance — a run resource, not a
  move.
- **Player-only.** Enemies never drink; a no-turn-cost restore on an AI would be a stat bump
  wearing a hat.
- **Active, alive, command phase.** The bench regenerates on its own; a KO'd hero is the Revive's
  business.

**Scarcity is the whole price, so scarcity is capped.** The mana invariant is bent on purpose by
one MP potion and broken by five banked. `CONSUMABLE_HOLD_CAP` = 3 a kind; an over-cap drop or
purchase is lost. Faucets: the starting pair; the Shop at a flat `CONSUMABLE_PRICE` = 20g (a pure
sink, the cap its only limit); and a **drop** (`CONSUMABLE_DROP_CHANCE`: 12% a fight, 20% an Elite,
25% a Guardian, none from the finale), rolled at squad-confirm so the victory ledger can show it.
No reward node sells potions. **What a fight drank comes off the purse at resolve**, so a fight
quit and replayed refunds it. Potions are not drinkable on the map: drinking at a fight's start is
strictly better.

In a fight they live in the **Bag**, the console's fourth key (`BagPanel`): a chip row of kinds,
the chosen kind's effect, then WHO drinks it; every row reserves its readout line so the panel
never resizes under the thumb. The struck token they wear is one die (`Coin.tsx`, tinted by
`--coin-rgb`) on the Bag key, its chips and the Shop shelf.

**The Revive.** One downed hero stood up at **half HP** (`REVIVE_FRACTION`), spent on the **lead
pick** at the top of a fight — a downed hero enters fallen, and its cell wears the key while one
is held — **or in a fight from the Bag** on the potions' terms: a free command-phase action on a
FALLEN hero, who stands onto the bench and is one fewer KO against lock-in. The merged finale (one
fight, two phases, nothing mended between) is the fight that wants one saved for it; measured,
the finale 41.9 → 48.6% with the sim's leftovers. **Sold steep, one a visit** (`REVIVE_PRICE` = 80,
`REVIVE_PURCHASE_LIMIT` = 1): a KO that 20g undoes is not a KO; at 80 it is a trade against the
Anvil, and a pilot that buys one at the Vigil takes the finale 52 → 57%. **Never started with.**
Its other faucet is its own drop roll (`REVIVE_DROP_CHANCE`: 6% a fight, 8% a Skirmish, 15% an
Elite, 20% a Guardian), taken only when the potion roll missed, so a fight drops one thing at most.
A Revive never saves the companion.

**The resolve order is a track on the horizon** (`OrderTrack.tsx`, `orderMarks.ts`): the four
active fighters as half-size sprites, first to last, on a gold rail above the far side's status
strip, each rimmed in its side's colour, a chevron between each pair and a gold `=` for a tie. It
reads `previewOrder` (the same keys `orderActions` sorts on, no RNG spun); the player's declared
brackets move their sprites, the enemy's sit at 0 until the round plays. **During playback** it
walks `RoundOrdered` beat by beat, and a bracket that changed the order lifts or sinks its sprite
(`bracketEffect`, read on the field's own axis, so `reversedSpeed` counts). Tapping a sprite while
commanding says the round in words (`describeOrder`).

> **Open:** the hold cap, the prices and the drop odds are playtest numbers; and whether a potion
> may be drunk during a forced-replacement beat after a KO — the moment a player most wants one,
> and the moment the board is mid-transition — is undecided.

### Winning a fight: the post-fight chain

A won encounter resolves through a chain of beats before the map comes back (`App.tsx
handleFightResolved`). The **levels, gold and drop are granted in the same `RunState` transform**,
before any screen opens, and reported on the victory screen (levels, bars, a Stat gains tap). Then,
each beat skipped when it has nothing to ask:

1. **The Titan bound** — the finale only: the collapse and the binding, ahead of everything.
2. **The Fallen** (Ascension 1, `FallenScreen`) or **the companion lost** — what the fight took.
3. **The level-up beat** — only when somebody is owed a schedule offer, a signature or an
   Evolution (`levelUpFlow.ts`).
4. **The companion joins** — after the run's first fight.
5. **The drop's who-screen** (`ItemWhoScreen`) — a drop nobody can take is gold on the spot.
6. **The Guardian's Banner** — boss nodes (§3).
7. **Recruit Contract claim** (`RecruitScreen`) — up to `MAX_CONTRACT_OFFERS` = 2 beaten
   recruitable heroes, **skipped when the player holds no contracts** or nothing beaten was
   recruitable. A boss node never reaches it: its escorts are spawn and the act grant is gone.
8. **The Crucible** (`CrucibleScreen`) — boss nodes: pick ONE hero, which takes a **Class** —
   three rolled from the whole catalog, a move or a passive. Skipped when every hero holds one.
9. **The Pact Seal** (§4), then the next act — boss nodes.

What the fight did comes first, what the ACT pays after. The Banner goes before the contract so a
hero recruited in the same beat arrives under it, and the contract before the Crucible so that hero
can walk into it. The claim was once a band on the victory overlay, which priced a permanent roster
decision below the item drop; it is its own screen on the draft's stage.

### Contracts

**Every recruit costs one Recruit Contract, and gold never buys a hero** (2026-10-05, per user
direction). A claim after a won Skirmish or Elite spends one, as it always did; a Tavern hire spends
one too, where it cost 50 gold. The run opens holding one. The supply is three faucets, every one of
them a choice:

- **The Contract node** (`contractReward`, weight 24): one contract on arrival, in the pick-1-of-3
  reward rows, so taking it is turning down a Boon, a Cache or a Forge beside it.
- **The Tavern's Contract**, at `contractPrice` = `CONTRACT_BASE_PRICE` 40 + `CONTRACT_PRICE_STEP`
  20 for every one bought this RUN (`RunState.contractsBought`) — 40, 60, 80. It rises across the
  run, not the visit, so buying a full roster is possible and dearer each time.
- **The Elite's drop** (same day, per user direction): a won Elite drops one at
  `CONTRACT_DROP_CHANCE.elite` = 50% (`rollContractDrop`), rolled at fight start with its other
  drops and paid BEFORE the claim screen, so it can sign one of the heroes it was won from. The fork
  reads Elite = harder fight, better hero, and a coin-flip at the means to take it; the Skirmish
  stays the safe road, which a held contract still claims from.

**What it replaced.** The run used to pay one free contract at every Guardian. With the starting one
and a 50g hire, that was exactly the four empty seats a two-hero draft leaves, so the dominant play
was to recruit at every chance and recruiting stopped being a decision by Act 2. The problem was not
the currency but that filling an empty seat cost nothing; a contract now costs a reward seat or a
rising slice of the gold that also buys Scrolls, the Smithy and the mend. One currency for both
routes also keeps the two-routes rule legible: the contract hero is finished and the hire is raw, at
the same price. `contractReward` was a node type once before (removed 2026-08-17, when the act grant
replaced it).

**Measured** (2000 runs a batch, seed 1, against the same seed at `bf5dcc67`): full-clear 31.1 →
23.6% chart / 81.3 → 75.0% skilled, the whole loss in Acts 3–5 (the finale 56 → 45% chart), Acts
1–2 flat. Heroes filling an empty seat are unchanged (2.9 a run), but the swaps collapsed — a
veteran claimed over a weaker hero 1.20 → 0.15 a run chart, 1.84 → 0.28 skilled — and the 35–60g an
act now spent on contracts came out of the Anvil and Enchanter (Act 3 Anvil 46 → 22g chart). The
sim walks reward rows at random and spends its contract at the Hall rather than saving it for the
next fork, so a player who plans should lose less; the direction is the finding.

**The Elite's drop, measured** (same seed, against the build without it): full-clear 23.6 → 28.0%
chart / 75.0 → 76.2% skilled — about two thirds of the chart pilot's loss back — with veteran swaps
0.15 → 0.47 / 0.28 → 0.72 a run and Tavern contract spending down 15–40% an act, the gold going back
to the Smithy (Act 3 Anvil 22 → 31g chart).

**Open dials, for playtest:** the node's weight, the two prices, and the Elite's odds. An in-fight capture (bind a low-HP enemy)
was weighed and set aside: it would make combat fiddlier, and speed is the game's strength.

## 3. Decisions locked for this pass

- **Multi-act sequencing.** A run chains `TOTAL_ACTS` acts (`src/run/state.ts`): four of the §1
  shape, then the finale act (§4). `RunState.actNumber` (1-indexed) tracks the current one. On a
  Guardian win: record the broken seal, then
  `advanceToNextAct` (a fresh `generateMap` seed, position reset, `actNumber` incremented). Roster,
  gold, Banners, contracts and consumables all carry over; only the map resets. Acts 2–4 open on a
  **1-of-2 Location choice** (`LocationChoiceScreen`, `locations.md` §1, §4).
- **Enemies are levelled, not stepped** (2026-09-15, `docs/enemy-levels.md`). An enemy's one stat
  axis is its **level**, rolled through its growth grades from 1 as a Guild hire's is, set per NODE
  off the player's par plus a kind offset (`ENEMY_LEVEL_OFFSET`) and the act's term
  (`ACT_LEVEL_ADJUST`), and shown on the scouted chips, the dossier and the nameplate. Enemy **gear
  from Act 3** is the second axis (`ENEMY_GEAR_BY_ACT` — one item in Act 3, two in Act 4 — `EnemyLoadout`). The two-track act-step
  curve, node-kind stat bonuses and the champion multiplier are deleted.
- **The Guardian's Banner** (2026-08-30; three since 2026-09-14). Beating a Guardian grants a
  **fixed 1-of-3 team-wide relic** (`GuardianBannerScreen`), every seal act. Not a map node; it
  hangs off the boss win, ahead of the contract and the Crucible. The three never change and never
  roll — **one per concept**, so a run's picks read as a team shape:

  | Banner | Concept | Grant |
  |---|---|---|
  | Banner of the Warcry | Offense | Team-wide +30 Attack, +30 Intelligence, +10 Speed |
  | Banner of the Bulwark | Defense | Team-wide +15 Defense, +15 Wisdom, +5 MP Regen |
  | Banner of the Wellspring | Staying power | Team-wide +50 HP, +25 Mana Pool, +5 MP Regen |

  **Reshaped 2026-09-28.** The Wellspring was the take every run: +10 MP Regen on a flat base of 10
  doubled every hero's regen, buying "cast everything forever". Its regen was halved and a matching
  +5 put on the Bulwark, so regen is the one stat two Banners carry and stacking it takes a
  commitment across both; the Warcry came down 40 → 30 to carry **+10 Speed**. That rider reverses
  "no Banner carries Speed" on purpose — **Swiftness** (+20 Speed) was deleted as dead in every
  batch (z −11), because Speed pays only at a threshold and a flat team-wide grant never changes
  the intra-team order — and whether the rider pays is the thing to watch.

  **Why the Warcry's figures run larger:** a hero swings with Attack *or* Intelligence, so its two
  stats are worth one to any hero, and the sim prices **a point of Defense or Wisdom at roughly six
  of Attack or Intelligence**. The hypothesis is hits-to-KO: shaving incoming damage flips an
  enemy's 2-hit KO to a 3-hit far more often than +15% outgoing flips the player's 2-hit to a 1-hit.
  At the pre-reshape figures the three measured within half a standard error under the skilled
  pilot.

  **Fixed is the design**: because the same three come back every act, the decision is *what shape
  is this team*. A stack is written as one card (`Banner of the Bulwark +2`, `relicStacks.ts`); held
  Banners fly on the map's shelf (`BannerShelf.tsx`). A Banner is broadcast to the side at fight
  build (`entryStats.ts`), so it covers heroes obtained after it. `test/relics.test.ts` pins the
  shapes.

  > **Open — parity is measured against the skilled pilot only.** Under the chart pilot the spread
  > widens (Bulwark ahead, Wellspring behind, z ±2): a pilot that dies early values mana less, as
  > the mana-tuning invariant predicts, and a new player is nearer that pilot. The sim's answer is
  > directional; the playtest's is the decision.
- **Relics: stat-only, by design.** `src/run/relics.ts` still supports `grantsPassiveIds` and
  `grantsStatusIds`, but no relic uses either since the ~50-relic random pool was deleted
  (2026-09-07): those relics collapsed into a bigger stat grant or a passive unanswerable across the
  whole team. Interesting effects live per hero. Reaching for a team-wide passive again should be a
  decision, not a refill of the old pool.
- **Non-recruitable enemy content.** Mob fights draw from a separate pool, never the draftable
  roster — the early roster was facing its own heroes as fodder, and every hero must be viable, not
  "the thing you curb-stomp in fight 1". `isRecruitable(heroId, recruitablePool)` gates contract
  offers on membership in the recruitable pool specifically, re-checked at `handleClaimContract`,
  so a beaten Titanspawn or champion never produces a contract. `allCombatants` (`data/content.ts`)
  is what combat keys off; only recruitment cares which pool a combatant came from.
- **The mob layer is Titanspawn** (2026-09-13, `docs/titanspawn-overhaul.md`; the Goblin roster
  and the six Location factions are deleted, sprites in `art/archive/factions/`). One mob line per
  mortal type in three tiers, drawn by the Location's `spawnTypes` and the act's tier
  (`src/data/titanspawn.ts`, `src/run/spawn.ts`, `SPAWN_TIER_BY_ACT`). **Act 1's opener** is two bare
  Earlies from every line (the on-ramp; the companion is drawn from them). **From Act 2 the opener**
  is a leader over three escorts each carrying one item, the escorts' tiers rising with the act
  (`OPENER_ESCORT_TIERS_BY_ACT`: Mid/Early/Early in Act 2, Mid/Mid/Early in 3, Mid/Mid/Mid in 4).
  They had been three Earlies all run, and under persisting knockouts the opener was the one fight
  an act that could never set up a short-handed fork; measured, the cost landed in **Act 2** (94 →
  90% skilled, 79 → 70% chart). Act 2 is the dial to watch.

  **Measured baseline — the enemy stat convention.** An enemy line's stat total counts the six
  combat stats, HP at `HP_BUDGET_VALUE` = 0.5, with Mana and MP Regen outside it (`statBudget.ts`).
- **The Guardian's escorts** are Titanspawn of the Location's `spawnTypes` at the act's tier, at
  the node's level: **one in Acts 1–2, two after** (`GUARDIAN_ESCORTS_BY_ACT`). Flavour first — a
  champion is the apex of the land the act has been fighting, not a pair of wandering adventurers.
  A Guardian therefore offers no contract of its own: the boss pays a Banner and the per-act grant.
- **The Guardian's champion.** Each Location names one champion
  (`LocationDefinition.guardianFinalEnemyId`, `locations.md` §3), added by `appendFinalEnemy`
  `CHAMPION_LEVEL_BONUS` = 2 over its escorts, **front-loaded**: it grows on E grades through Act 3
  and on C in Act 4 (`CHAMPION_GRADES`, `CHAMPION_GRADE_BY_ACT`). It sits on the **enemy bench**: the AI never switches
  voluntarily, so it reaches the field by **forced replacement after a KO**, walking on at the
  moment the fight had started going the player's way; with one escort it takes the lead slot the
  missing escort leaves. At A1 it leads from round one, Marked (`docs/ascension.md` §2a). No
  Guardian carries its type's Mark at Base. **It cannot be skipped**: `sideDefeated` tests every
  combatant on the side, bench included. **It is concealed until it arrives**: its scout chip is a
  silhouette and its typing and opens no sheet (`view/shared/entrances.ts`) — the typing kept so the
  player can build against the fight, everything that would pre-solve it withheld. The entrance is
  presentation, not a Field Effect. Wild's Edge's is the **Manticore**: **Attack 55** since
  2026-09-15 (−10 into +20 HP) took the Act 1 Guardian 77 → 82% cleared; Attack is his one dial —
  Mana fed Archon Blast and read worse.
- **The companion** (`src/run/companion.ts`). After the run's first fight, the beaten side's lead
  Early joins — one button, no declining (`CompanionScreen`). A hero in every respect but one,
  `RosterEntry.mortal`: a knockout takes it back into the Titan, first in the post-fight chain. Its
  Evolution is a tier-step (Early → Mid at Mastery 5, Mid → Late at 10). One per run; a dead one is
  not replaced. It does not count toward Act 1's enemy-count cap. `rosterHeroes`
  (`data/content.ts`) is the roster-facing lookup.
- **Wounds: HP persists across an act's nodes; mana does not** (2026-09-15, FOR PLAYTEST;
  `src/run/wounds.ts`). A fight writes each fielded hero's missing HP onto `RosterEntry.wounds`,
  and the act's end (`advanceToNextAct`) is the one free mend. It is stored as HP MISSING, so a max
  that moves mid-act moves the current with it. Mana still opens full every fight: mana
  persistence's failure mode is a Rest on turn 1, a dead turn rather than a decision, and Overflow
  would carry uncapped across fights.

  **A knockout persists** (2026-09-17): a KO'd hero is `RosterEntry.down` — on the roster, off the
  field, entering every fight fallen — stood up only by the **Rest** seat, the Guild Hall's
  **mend**, a **Revive** or the act's end. It is the counterweight to every fight fielding the whole
  roster (`combat.md` "The fielded roster"): six bodies a fight is a large buff, and a KO that costs
  the rest of the act prices it. The flag is its own field so a growth roll cannot stand a hero up.
  This replaced a 25% walk floor, written when a KO'd hero had no way back for the run; with four
  faucets and a hard reset at the act's end, the way back exists.

  **Why:** with full heals every fight had to be a wall, because a fight that is not a wall is free.
  Under wounds a fight can be winnable and still cost something, and the act's threat becomes the
  Guardian faced with a depleted roster (Slay the Spire's model). The second aim is churn: a
  contract hero arrives whole.

  **The faucets, every one priced:** the **Rest** (`restReward`, weight 30 — the rest-vs-upgrade
  choice inside the row the map already has), the **Guild Hall's mend** (the whole roster, the
  downed included, **priced by what is missing**: `mendPrice` = `MEND_PRICE_PER_HERO` 15 a hero's
  worth of missing HP, a downed hero a whole one, in fives, floor 5), the **Revive**, and a
  **contract** hero. `WoundBar` draws the bar wherever the roster is read — the map's footer as six
  portrait chips, the lead-pick cells, the fight result, the hero sheet — always drawn full too,
  since a bar that only appears when something is wrong cannot be compared.

  **Measured** (2026-09-17, 600 runs): against the whole-roster flip alone, persisting KOs were
  inside noise, because **47% of KOs fall at the Guardian and another quarter in the finale** —
  every one followed by a mend — and only ~6% of fights are entered short-handed. With three fights
  an act and the Guardian last, a KO can cost the fork or the Guardian and nothing else. That is
  structural; the dials are the Revive's odds and whether the act's end revives.

  > **Open for playtest:** Act 1 (no real sideboard, already the wall) gets the same rule with
  > nothing scripted for it; the per-act contract lands at the Guardian win, the instant everyone
  > is healed anyway, so it is the least persuasive contract in the run; and the sim's walk picks
  > reward nodes uniformly, so its full-clear under wounds is a floor on a pilot that never chooses
  > to Rest.
- **The leads are chosen in the fight** (2026-09-28): every fight fields the whole roster; the
  enemy's two take the field first, then the player picks two from the whole roster with HP and a
  matchup arrow per enemy lead on every cell (`combat.md` "The lead pick"). The node's encounter is
  generated at node select (`handleSelectNode`), so it is scouted before the fight —
  `HeroPreviewOverlay` reads any scouted hero's sheet.
- **A run ends on loss, not a retry-in-place.** Losing any fight ends the run ("Run Failed");
  clearing the finale ends it as a win. Both write the profile's run history and tallies, and the
  next run draws from the player's deck and unlocks (`progression.md` "Per-run reset vs.
  meta-progression").
- **Reward choices preview before committing.** Every reward is read whole before it is taken: an
  item's grants are shown before Claim, and a hero or shelf piece opens its sheet before the buy.

## 4. The finale — the Pact

The fiction this implements is `docs/lore.md`; this section owns only the structure. In one line:
**four acts break four seals, and the finale is the thing behind them.**

### The Pact Seal — the between-acts beat

A run's Guardians are its broken seals, so the run needs a place to *count* them.
`PactSealScreen` is a **four-socket** seal (`SEAL_ACTS`) — the fixed-denominator socket idiom of
the draft's pact sockets and the Field Effect plaque's clock — and each Guardian win fills one in
that Location's tint. It grants nothing, so it goes **last** in the act-boundary chain, after the
post-fight beats and immediately before the next act: the opposite of the Banner's placement, for
the same reason. The last socket fills and **the seal breaks** — the finale's opening beat.

**What it looks like** (2026-10-07, per user direction — the screen was barren): the sockets sit
on the title's own seal, each holding a chain that runs off into the dark, under the title's Titan
whose **eyes open wider with every seal broken** (`LID_BY_SEALS`). The fallen warden rises over the
seal and is drawn into its socket while its chain strains; the strike snaps the chain, the place
quakes and the eyes flare wider. A tablet a seal under the ring keeps the record — act, Location,
Broken or Holds.

### The finale's shape

The finale act is not another act of the §1 shape; it is a corridor of two nodes at a **fixed
location** the itinerary can never draw, the way Act 1 is fixed to Wild's Edge — where the binding
was made.

- **Row 0: the Vigil** (`muster`) — a Guild Hall variant and the run's last node of any kind. **It
  recruits NOBODY** (2026-09-24): no hires, no Contract, no reroll; its Tavern holds the mend alone
  and it opens on the Shop. The finale is fought by the roster the run kept, so arriving short is
  the run's own result. It used to fill the roster free; measured, removing that was noise at both
  rungs (Base 73.7 → 74.0%, A1 31.2 → 31.3%), since at Base every run already arrived six strong.
  The finale by heroes standing on entry, A1: six 91%, five 65%, four 49%, three 16%. Its shelf is
  the run's last place to spend gold.
- **Row 1: the finale** — no branch and no choice; drawing it as a corridor is the point.

### The finale

**The board is still 2v2.** Six-a-side is a *bench* change: targeting, the spread rule, priority
and the damage pipeline are untouched. The player fields the whole roster, as at every fight; what
the finale keeps is a deep **enemy** side.

**ONE fight in two phases** (`docs/titan-eyes.md` §10, `generateFinaleEncounter`):

| Position | Who |
|---|---|
| active | **The Herald** — mono-Ancient, on the field from the first round, **warded while any of its company stands** (bench included), so it falls last |
| active | The Act 1 seal's Late Titanspawn |
| bench | The Act 2, 3 and 4 seals' Late spawn, in seal order |
| reserves | **The Titan's Eyes** — two mono-Ancient Eyes, entering once the Herald's side is down |

One Late spawn per broken seal, drawn from that seal's Location lines, at the finale's level and
every Mastery pip — the fully-turned mortals of each land. The Herald leads because it is the
standard-bearer, and a boss on the field from round one with its company behind it is a fight
where a boss entering last was a queue. The Titan rises over the fight as the Herald falls; the
Eyes are met once, set **Withering Gaze**, and **nothing is mended at the boundary**. Details,
numbers and the cinematic beats: `docs/titan-eyes.md`.

The broken-seal ledger (`recordBrokenSeal`) still snapshots each champion at the power it was
beaten at, and `generateFinaleEncounter` without escorts still builds the older shape — the four
champions **unsealed** (their Ancient half dropped, `finaleEnemies`) ahead of the Herald — which the
spawn company replaced on 2026-09-17.

**Lock-in** holds the ratio rather than the count: `lockInThreshold` is half a side, floor 2, so a
six-a-side locks at **3** without a second mechanism. It stays in the finale — the intentional
phase transition.

> **Recorded alternative, not open:** the win condition is reduction to 0 HP; `lore.md` §7
> records survival as the better fiction and a new engine primitive. The Pact Clock counts from
> the phase (`CombatState.phaseStartedRound`, `docs/titan-eyes.md` §10.2); its round-30 start is
> still `combat.md`'s unmeasured figure.

## 5. What's still not built or settled

- **Enemy level dials** (`docs/enemy-levels.md` §6): Act 1 and the last stretch are the two named
  for playtest. The Skirmish's offset and the hire's +1 are Act 1's levers; enemy gear earlier, a
  second item for the Guardian, or passives through the loadout seam are the late game's.
- **Evolution depth** — one Evolution node per hero; Capstone / Deep-line heroes are deferred
  (`leveling-and-ranks.md` Part 2).
- **Equipment crit** — locked as a loadout concern, no item carries it (`progression.md`).
- The open questions flagged above: the Boon's weight, the Banner parity under the chart pilot,
  potions during a forced replacement, the Wounds playtest items, the reroll's price, and the gold
  scale's late steps.
