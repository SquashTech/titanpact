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
- **Row 1: 3 nodes, pick 1 of 3 — reward types only** (`equipmentReward`/`relicReward`/
  `currencyReward`/`upgradeReward`/`weaponReward`/`armorReward`/`accessoryReward`/
  `hpBoostReward`/`manaBoostReward`/`manaRegenBoostReward`/`event`, weighted). No
  `fight`/`shop`/`elite`/`classReward` mixed in — every reward row is a genuine reward
  choice, not a chance to draw another fight or dodge one, and `classReward` is reserved
  for its own forced Act-1 Mentor row (2026-08-22 revision, per user direction — see
  the Mentor row note below), never a random pick-1-of-3 option.
- **Row 2: a single forced `skirmish` node.**
- **Row 3: 3 nodes, pick 1 of 3 — reward types only**, same pool as row 1.

**The Mentor row (Act 1 only).** Act 1 splices one extra forced single-node `classReward`
row into the shape above, giving it 8 rows where every other act has 7. It sits
**immediately before the Skirmish** (2026-09-05, per user direction — it was immediately
*after* until then), so the Class is in hand for the run's first recruitable fight rather
than arriving just after it. Act 1's row order is therefore `fight` → reward → **Mentor**
→ `skirmish` → reward → `elite`/`battle` → `shop` → `boss`, and Act 1's Skirmish lands one
row later than every other act's (`MENTOR_ROW`, `skirmishRowFor`, `src/run/map.ts`). Both
rows are single nodes, so no path can bypass either.
- **Row 4: 2 nodes, pick 1 of 2 — `elite` or `battle`** (2026-08-17, per user direction:
  "give the player the option to fight the Elite OR a regular Battle"). `elite` is the
  act's difficulty spike (+10 to 2 stats on all 4 AI heroes); `battle` is a plain,
  no-bonus alternative — same risk profile as `skirmish`, just later in the act. Always
  presented as a real choice (see edges, below), not one that depends on luck.
- **Row 5 (funnel): a single `shop` node** every path converges on — a guaranteed last
  chance to spend gold before the boss, also the standard Slay the Spire "everything
  narrows before the boss" beat.
- **Row 6: the single `boss` node** — the act's Guardian.

The upshot: every act is exactly **Fight → pick 1 of 3 → Skirmish → pick 1 of 3 →
(Elite or Battle) → Guild Hall → Guardian** — no path through an act ever skips a fight.

Edges connect each node to 1-2 nodes in the next row within a small column window, with
a repair pass guaranteeing every node (row 1+) has at least one incoming edge — no
orphaned nodes. Given the forced single-node rows above, this repair pass in practice
means the single fight/skirmish node before a 3-wide reward row always ends up connected
to all 3 of them (nothing else exists to claim the "leftover" reward nodes), so the "pick
1 of 3" framing holds for real — no reward option is ever silently unreachable. The row
feeding into the Elite-or-Battle row is a special case on top of that. Its source row is
3-wide and its target row 2-wide, so the generic windowed-edge algorithm would present
both options only sometimes, depending on which reward node was picked. That row
transition is therefore overridden — originally to **fully connect** every row-3 node to
both row-4 nodes, and since **2026-08-26** (per user direction) to **steer**:

| Row-3 node | Leads to |
| --- | --- |
| left | Elite only |
| middle | Elite *or* Battle |
| right | Battle only |

The guarantee the full-connect rule existed to provide is intact, just narrowed: the
middle node always keeps both open, so **no path ever loses the Elite/Battle choice**.
What the player can no longer do is take a specific *side* reward and keep the choice —
a tradeoff they can see and price from the start of the act, since the whole map is
visible, rather than luck imposed on them. Two tests pin both halves down (`test/map.test.ts`:
"the Elite/Battle choice stays reachable…" and "…steers left->Elite, right->Battle,
middle->both").

The motivation was visual as much as mechanical: full-connect was the only place the map
drew crossing edges, running the left reward all the way across to the Battle and the
right one back to the Elite. Once `MapScreen` started drawing real parent→child lines
(2026-08-26), that row read as noise rather than structure. This is still simpler than
Slay the Spire's real path-weaving generator, but it's now enough to prove branching
*choice* within a row without the visual tangle.

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
| `boss` | `FightScreen` vs. 2 AI heroes (no bench — a real no-cycling fight), each with a flat +20 bonus to 3 random growth stats. Winning grants 1 Recruit Contract, the Guardian's Banner in acts 1-4, and ends the act (§3). **2026-09-01 exception:** a location may hold a **faction champion** on the boss's bench — see "The Guardian's champion" below. |
| `shop` | `ShopNodeScreen` — the existing `GuildHallPanel`, given an exit for the first time. Overhauled 2026-08-18: offers 2-3 curated hero recruits (50g each, `GUILD_HALL_RECRUIT_COST`) rather than the full catalog, plus a rarity-priced equipment shelf, rolled once per visit (`src/run/shop.ts` `rollGuildHallOffers`). Second pass 2026-08-31: relics are no longer sold anywhere, the shelf is 4 wide and readable on its face, sold stock greys out, and Recruit Contracts confirm before buying (`docs/progression.md` "Second pass"). |
| `equipmentReward` | `NodeRewardScreen` — pick 1 of 3 equipment items, rarity-weighted (`equipment.ts` `pickWeightedEquipment`); claiming hands off to the forced equip-or-trash gate (`ForceEquipScreen`) rather than a stash — see "The unequipped-item inventory was removed" below. |
| `relicReward` | `NodeRewardScreen` — pick 1 of 3 relics not already owned. |
| `currencyReward` | `NodeRewardScreen` — an instant flat gold grant (15-30, more for nothing having been spent yet). |
| `upgradeReward` | `NodeRewardScreen` — an instant flat grant to the pooled level-up currency (2-3 points), on top of the per-fight-win grant (see below). |
| `weaponReward` / `armorReward` / `accessoryReward` | Rolls a single rarity-weighted item of that fixed slot (`equipment.ts` `pickWeightedEquipmentBySlot`) and hands off straight to `ForceEquipScreen` — no 3-choice picker, unlike `equipmentReward`'s mixed-slot pick. |
| `hpBoostReward` / `manaBoostReward` / `manaRegenBoostReward` | `StatBoostScreen` — pick one roster hero to receive a flat, permanent-for-the-run stat grant (+20 HP / +10 Mana / +5 MP Regen, `runProgress.ts` `grantStatBonus`), stored on `RosterEntry.bonusStatGrants`. `manaRegenBoostReward` added 2026-08-22, per user direction. |
| `classReward` ("Mentor's Hall") | `ClassNodeScreen` — pick 1 of 3 Classes (`src/data/classes.ts`), then pick which roster hero learns it, filtered to heroes with no Class yet (`src/run/classes.ts` `grantClass`, stored on `RosterEntry.classId` — a hero can hold at most one Class per run, so `grantClass` REPLACES rather than stacks). If every roster hero already has a Class, the offer is simply wasted. **Not in `REWARD_WEIGHTS`** (2026-08-22 revision, per user direction) — the only way to encounter this node type is the forced Act-1 Mentor row (§1), never a random pick-1-of-3 option in any act. |
| `event` | `EventNodeScreen` — rolls one of the authored map events (`src/data/events.ts`, `src/run/events.ts`) and resolves it: a move taught to a chosen hero, a Passive taught to a chosen hero, a flat stat trade, or a pile of act-curve loot handed to `ForceEquipScreen`. Which event a node turns out to be is rolled once at node-select time and gated by act and Location. See **docs/events.md**. |

The stat bonuses above are the **node-kind** axis only — what `elite` costs relative to
`battle` *within one act*. Every encounter node also carries the **per-act** axis on top
(§3 "Per-act difficulty scaling"), so an Act 4 `elite` fields its +10×2 plus three
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
| `fight` (row 0 opener) | Monsters | 1 | 15-25 | **always**, act's standard curve |
| `battle` (row 4) | Monsters | 1 | **30-45** | **always**, act's standard curve |
| `skirmish` (row 2) | Skirmish | **2** | 15-25 | 25%, act's standard curve |
| `elite` (row 4) | Skirmish | **2** | 15-25 | 55%, **one tier ahead** (`rarityWeightsFor(act, 'elite')`) |
| `boss` | Guardian | **2** | 0 | 70%, one tier ahead |

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

### Winning a fight: the post-fight gates

A won encounter resolves through up to four gates before the map comes back
(`App.tsx handleFightResolved`), in this order:

0. **The Guardian's Banner** (`GuardianBannerScreen`) — boss nodes in acts 1-4 only; a
   fixed 1-of-3 team-wide relic, ahead of everything else so a hero recruited at gate 1
   arrives under it. See §3.
1. **Recruit Contract claim** (`RecruitScreen`) — the beaten recruitable heroes, up to
   `MAX_CONTRACT_OFFERS` = 2 of them (`recruitment.ts pickContractOffers`). **Skipped
   entirely when the player holds no contracts**, and when nothing beaten was
   recruitable: the run goes straight on rather than opening a screen whose offer cannot
   be taken. On a boss node the act-end contract (§3) is granted *before* this check, so
   it is spendable on the heroes that boss fight just beat.
2. **Forced equip-or-trash** (`ForceEquipScreen`) for this node's item drop, if any.
3. **Training Point allocation** (`LevelUpScreen`), if the pool is non-empty.

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
  | `skirmish` | `skirmish`, `elite`, `boss` | **1** | The hero roster is authored and already sits at the power level a run starts at, so it starts scaling right away — every act past the first adds a step. Guardians ride this track: they are hero-pool content. |

  **One act-step = +30 to an enemy's stat total** — 3 distinct growth stats at +10 each
  (both figures satisfy CLAUDE.md's multiples-of-5/10 rule; +10×3 over +5×6 so a step is
  felt where it lands rather than smeared). Each step rolls its **own** 3 stats and the
  steps merge, so a 4-step Act 5 enemy has a broad line rather than +40 in one stat.
  This is a **second, independent axis** on top of the node-kind bonuses in §2 — kind
  says how hard a fight is *for its act*, the curve says how deep the act is. An Act 4
  `elite` therefore carries its +10×2 **plus** 3 act-steps.

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
- **The Guardian's Banner (2026-08-30, per user direction).** Beating an act's Guardian
  grants a second reward on top of the Recruit Contract: a **fixed 1-of-3 relic choice**
  (`GuardianBannerScreen`), shown after the wins that end **acts 1-4** and not after act
  5's, whose Guardian ends the run — a team-wide permanent handed to a finished run is a
  choice with nothing to spend it on. Not a map node; it hangs off the boss win itself
  (`App.tsx` `handleFightResolved`, `Screen` kind `guardianBanner`), and it goes **first**
  in the post-fight chain, ahead of the recruit/equip/level-up gates, so a hero recruited
  in that same beat already arrives under the banner.

  The three options never change and never roll:

  | Banner | Grant |
  |---|---|
  | Banner of Vitality | Team-wide +30 HP |
  | Banner of the Wellspring | Team-wide +20 Mana pool |
  | Banner of the Everflow | Team-wide +10 MP Regen |

  Being **fixed** is the design, not a placeholder. Because the same three come back four
  times, the real decision is *spread them or commit to one axis*, and that only becomes a
  decision if the player can see all four offers coming from act 1. `RelicDefinition
  .guardianBanner` keeps all three out of `drawableRelics` (`src/data/relics.ts`), which is
  what both random sources — the Relic Shrine's 1-of-3 and the Guild Hall's stock — draw
  from, so a banner is never a random offer and the fixed choice is never pre-empted.

  **Stacking** needs no new mechanism: duplicate relic ids already sum in
  `relicTeamStatModifiers`. What is new is how a stack is *written* — one card named
  `Banner of Vitality +2` carrying the summed `+90 HP`, rather than three identical cards
  (`src/view/shared/relicStacks.ts`, used by `RelicsOverlay` and `RosterPeek`). The suffix
  counts copies **beyond the first**, the upgrade-pip convention: 3 copies reads "+2". Like
  every relic, a banner applies to heroes obtained before *and* after it — the grant is
  broadcast to the side at fight-build time (`entryStats.ts`), never written onto a hero.

  **Open balance question — the three are not equal, and the MP Regen one is the outlier.**
  Against the roster's averages (~105 HP, ~58 Mana pool, a flat **10** MP Regen on every
  hero), +30 HP is about +29%, +20 Mana about +34%, and +10 MP Regen is **+100%** — and
  regen is throughput, not a one-time buffer, so over a six-round fight it is worth ~60
  mana against the Wellspring's 20. At four stacks it is 50 MP Regen, 5× base, which is
  also the side of the ledger CLAUDE.md's mana-tuning invariant ("mana investment must pay
  out later than the point at which a weak team dies") is most sensitive to. The authored
  values are the ones asked for and are what ships; the balance-pass alternative on record
  is **+5 MP Regen**, or holding +10 and raising the Wellspring to +40. Flag before
  hardening either way.
- **Relics: minimal, stat-only.** `src/run/relics.ts` mirrors `equipment.ts`'s own
  scope note exactly — team-wide flat stat grants only. Hook-triggered relics (e.g.
  "on faint, heal the team") wait for the trigger-hook engine contract (CLAUDE.md
  "Architecture", README "Next steps" #3), which isn't built. Do not add a
  trigger/hook field to `RelicDefinition` speculatively before that contract lands.
- **Boss = existing fixture heroes, scaled up, not new Guardian content.** No
  hand-authored Guardian hero yet — `enemyGen.ts`'s boss encounter is 2 fixture heroes
  with a bigger stat bonus. Authoring a real Guardian is future work, once this loop is
  validated and real content authoring begins (README "Next steps" #5). Note this is
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

  Wild's Edge's is the **Goblin Lord** (`enemies.ts`) — Beast/Ancient, 600 stat total,
  20 MP Regen, four moves across four types (Thrash, Momentum Swing, Enfeeble, and the
  Ancient row authored for him, Archon Blast). He is enemy-pool content, so
  `isRecruitable` excludes him by pool membership exactly as it does every Goblin: a
  beaten Goblin Lord produces no contract offer. He carries **no node-kind or act stat
  bonus** — the 600 is the authored number, and a generated bonus on top of it would
  make it something else.

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
>   moves the spread-or-commit decision the fixed 1-of-3 exists to create, and the MP
>   Regen banner's open balance question (§3) gets one act sharper.
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
  (`swapEquipment`/`trashEquipment` — see "The unequipped-item inventory was removed"
  above), no longer a spend surface and no longer backed by a stash.
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
