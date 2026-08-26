# run-loop.md — The Escalating-Fight Run Loop

> Module of the Titanpact `/docs` suite. Companion to `combat.md`, `progression.md`,
> `mana.md`, `architecture.md`. The map/node structure that turns the single fixed
> demo fight into the roguelike run CLAUDE.md's north star describes: draft →
> escalating fights → relics.

Slay the Spire is the direct reference (per user direction, 2026-08-16): a branching
map of nodes, most of which reward something (a Guild Hall shop, equipment, a relic,
gold, or a hero upgrade), interspersed with fights and Elite fights, all culminating in
an end-of-act boss fight against an **Ancient** — a nice fit, since `Ancient` is
already `types-and-heroes.md`-locked as a rare, boss-only "near-total defensive wall"
type.

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
- **Row 4: 2 nodes, pick 1 of 2 — `elite` or `battle`** (2026-08-17, per user direction:
  "give the player the option to fight the Elite OR a regular Battle"). `elite` is the
  act's difficulty spike (+10 to 2 stats on all 4 AI heroes); `battle` is a plain,
  no-bonus alternative — same risk profile as `skirmish`, just later in the act. Always
  presented as a real choice (see edges, below), not one that depends on luck.
- **Row 5 (funnel): a single `shop` node** every path converges on — a guaranteed last
  chance to spend gold before the boss, also the standard Slay the Spire "everything
  narrows before the boss" beat.
- **Row 6: the single `boss` node** — the act's Ancient.

The upshot: every act is exactly **Fight → pick 1 of 3 → Skirmish → pick 1 of 3 →
(Elite or Battle) → Guild Hall → Ancient** — no path through an act ever skips a fight.

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

| Type | Resolution |
|---|---|
| `fight` | `FightScreen` vs. a generated 4-hero AI squad (`src/run/enemyGen.ts`), no bonus. Always row 0, each act's opening node — draws from the non-recruitable enemy pool (Goblins), not the draftable hero roster. |
| `skirmish` | Mechanically identical to `fight` (same 4-hero, no-bonus `generateEncounter` call — App.tsx collapses it to `EncounterNodeType: 'fight'`), but draws from the **recruitable hero pool** and is named differently on the map (2026-08-17, per user direction) so the player can see, before committing a squad, that beating this one is a shot at a Recruit Contract claim. Always row 2. |
| `battle` (map-facing name "Monsters", 2026-08-22 revision) | Also mechanically identical to `fight`/`skirmish` (collapses to `EncounterNodeType: 'fight'`), but draws from the **non-recruitable enemy pool**, same as `fight` — not `skirmish`'s recruitable pool. Row 4's non-Elite alternative to `elite`. **2026-08-23 revision, per user direction:** no longer a plain `generateEncounter` call over the whole enemy pool — `App.tsx`'s `handleSelectNode` calls the dedicated `generateGoblinChiefEncounter` (`enemyGen.ts`) instead, which always fields `goblinChief` plus 3 random draws from `BASIC_GOBLIN_IDS`. This is what makes `battle` a real, considerably-tougher alternative to `elite` rather than a same-difficulty reskin of the opener — see "Goblin roster" below for the content this draws on. Different-themed (non-Goblin) monster tiers for later acts remain future work, see "Per-act difficulty scaling" below. |
| `elite` | The AI's 4 heroes each carry a flat +10 bonus to 2 random growth stats. Draws from the recruitable pool, same as `skirmish`/`battle`. Row 4's difficulty-spike alternative to `battle` — the player picks one or the other, never both. |
| `boss` | `FightScreen` vs. 2 AI heroes (no bench — a real no-cycling fight), each with a flat +20 bonus to 3 random growth stats. Winning grants 1 Recruit Contract and ends the act (§3). |
| `shop` | `ShopNodeScreen` — the existing `GuildHallPanel`, given an exit for the first time. Overhauled 2026-08-18: offers 2-3 curated hero recruits (50g each, `GUILD_HALL_RECRUIT_COST`) rather than the full catalog, plus rarity-priced equipment and flat-cost relics for sale, rolled once per visit (`src/run/shop.ts` `rollGuildHallOffers`). |
| `equipmentReward` | `NodeRewardScreen` — pick 1 of 3 equipment items, rarity-weighted (`equipment.ts` `pickWeightedEquipment`); claiming hands off to the forced equip-or-trash gate (`ForceEquipScreen`) rather than a stash — see "The unequipped-item inventory was removed" below. |
| `relicReward` | `NodeRewardScreen` — pick 1 of 3 relics not already owned. |
| `currencyReward` | `NodeRewardScreen` — an instant flat gold grant (15-30, more for nothing having been spent yet). |
| `upgradeReward` | `NodeRewardScreen` — an instant flat grant to the pooled level-up currency (2-3 points), on top of the per-fight-win grant (see below). |
| `weaponReward` / `armorReward` / `accessoryReward` | Rolls a single rarity-weighted item of that fixed slot (`equipment.ts` `pickWeightedEquipmentBySlot`) and hands off straight to `ForceEquipScreen` — no 3-choice picker, unlike `equipmentReward`'s mixed-slot pick. |
| `hpBoostReward` / `manaBoostReward` / `manaRegenBoostReward` | `StatBoostScreen` — pick one roster hero to receive a flat, permanent-for-the-run stat grant (+20 HP / +10 Mana / +5 MP Regen, `runProgress.ts` `grantStatBonus`), stored on `RosterEntry.bonusStatGrants`. `manaRegenBoostReward` added 2026-08-22, per user direction. |
| `classReward` ("Mentor's Hall") | `ClassNodeScreen` — pick 1 of 3 Classes (`src/data/classes.ts`), then pick which roster hero learns it, filtered to heroes with no Class yet (`src/run/classes.ts` `grantClass`, stored on `RosterEntry.classId` — a hero can hold at most one Class per run, so `grantClass` REPLACES rather than stacks). If every roster hero already has a Class, the offer is simply wasted. **Not in `REWARD_WEIGHTS`** (2026-08-22 revision, per user direction) — the only way to encounter this node type is the forced Act-1 Mentor row (§1), never a random pick-1-of-3 option in any act. |
| `event` | `EventNodeScreen` — placeholder, no content yet (deferred: "we will design these when it's time"). |

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
  `TOTAL_ACTS = 5` acts (`src/run/state.ts`) instead of ending at the first boss.
  `RunState.actNumber` (1-indexed) tracks which act is current. On a boss-node win
  (`App.tsx handleFightResolved`): grant 1 Recruit Contract
  (`runProgress.ts grantContractReward` — this is where the removed `contractReward`
  map node's grant moved to), then if `actNumber < TOTAL_ACTS`, call
  `runProgress.ts advanceToNextAct` (fresh `generateMap` seed, `currentNodeId`/
  `visitedNodeIds` reset to the new act's start row, `actNumber` incremented) and return
  to the map screen; otherwise show "Run Complete." Roster, gold, relics, and Recruit
  Contracts all carry over between acts — only the map itself and per-act position reset,
  same "fully restore HP/mana between nodes" spirit already locked below, just at the
  act boundary instead of the node boundary. Difficulty does **not** yet scale by act
  number — every act's `fight`/`elite`/`boss` nodes use the same stat-bonus figures
  (§2) regardless of which act they're in, so acts 2-5 are only harder in practice via
  the player's own accumulated gear/relics/levels, not via any deliberate curve. Whether
  that's enough escalation over 5 acts, or whether encounters need an explicit
  per-act difficulty multiplier, is now an open balance question — flag before assuming
  either answer.
- **Relics: minimal, stat-only.** `src/run/relics.ts` mirrors `equipment.ts`'s own
  scope note exactly — team-wide flat stat grants only. Hook-triggered relics (e.g.
  "on faint, heal the team") wait for the trigger-hook engine contract (CLAUDE.md
  "Architecture", README "Next steps" #3), which isn't built. Do not add a
  trigger/hook field to `RelicDefinition` speculatively before that contract lands.
- **Boss = existing fixture heroes, scaled up, not new Ancient content.** No
  hand-authored Ancient hero yet — `enemyGen.ts`'s boss encounter is 2 fixture heroes
  with a bigger stat bonus. Authoring a real Ancient is future work, once this loop is
  validated and real content authoring begins (README "Next steps" #5).
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
  `FightScreen.tsx`'s claim list is filtered through it, and `App.tsx`'s
  `handleClaimContract` re-checks it as the actual RunState-mutation boundary, not just
  the UI. `src/data/content.ts`'s `allCombatants` (`{ ...heroes, ...enemies }`) is what
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
  stronger `goblinChief` (mono Beast, ~2x the basic Goblins' stats, wielding a
  powerful team-wide buff move, War Horn). The 5 basic ids live in
  `BASIC_GOBLIN_IDS`/`basicGoblins`; `goblinChief` is never drawn randomly.
  `handleSelectNode` specializes both mob-fight node types on this split: the row-0
  `fight` opener draws exactly 2 random heroes from `basicGoblins`
  (`generateEncounter(..., heroCountOverride: 2)`), and the row-4 `battle` node
  ("Monsters") calls the dedicated `generateGoblinChiefEncounter` (`enemyGen.ts`),
  which always fields `goblinChief` alongside 3 random draws from
  `BASIC_GOBLIN_IDS` — a fixed threat backed by variable support, rather than a
  fully random 4-pick. This is what makes `battle` a real, harder alternative to
  `elite` instead of a same-difficulty reskin of the opener. Different-themed
  (non-Goblin) monster tiers for later acts remain future work — see "Per-act
  difficulty scaling" below. Which rows/node types pull from which pool, and how
  the pool itself scales by act number, is still open balance work, not
  architecture work.
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
  (2026-08-16, second playtest; retuned 2026-08-26).** `App.tsx`'s `trainingPointsFor`
  keys on the **map** node type — 1 for the act's opening `fight` (the light 2v2
  against the non-recruitable mob pool), 2 for a normal `skirmish`/`battle`, 3-4 for
  `elite`/`boss`. It takes a `MapNodeType` rather than an `EncounterNodeType`
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
  hero's old item) or trashes it outright. Each act's opening Goblin fight (row 0) also
  always grants one random Common item on top of its gold/training-point rewards
  (`App.tsx` `handleFightResolved`), so the player exercises this loop from turn one
  rather than waiting on `equipmentReward` node luck.

## 4. What's still not built

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
- **Per-act difficulty scaling.** Multi-act sequencing itself is now built (§3), but
  encounter difficulty doesn't yet scale with `actNumber` — see §3's note on this.
- **Visual path rendering.** `MapScreen` renders nodes grouped by row with
  reachable/visited/current/locked states, but does not draw connecting lines between
  them — a cosmetic gap, same "lowest priority, purely cosmetic" bucket as the
  feel-pass prototype's presentation layer (`architecture.md`).
- **A real Ancient boss hero**, and real content generally — this pass still runs on
  `/src/data`'s 6 fixture heroes (README "Next steps" #5, unchanged by this work).
