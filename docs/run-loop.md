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

**This pass builds one act, not a full multi-act run** — proving the loop shape before
committing to act-count/pacing decisions, which are really content and balance calls.

---

## 1. Map shape

`src/run/map.ts` generates a deterministic (seeded) branching map:

- **Row 0 (entry): a single plain `fight` node.** Slay the Spire convention — the run
  always opens on an easy, unambiguous fight, no early reward-node luck and no
  meaningless first choice among three identical-weight openers (2026-08-17 revision;
  was 3 nodes).
- **Rows 1-4: 3 nodes each, weighted-random type.** Rows 1-2 draw from fight/shop/
  equipment/relic/currency/upgrade only — no `elite` yet. Rows 3-4 add `elite` to the
  pool and drop the plain-fight share accordingly.
- **Row 5 (funnel): a single `shop` node** every path converges on — a guaranteed last
  chance to spend gold before the boss, also the standard Slay the Spire "everything
  narrows before the boss" beat.
- **Row 6: the single `boss` node.**

Edges connect each node to 1-2 nodes in the next row within a small column window, with
a repair pass guaranteeing every node (row 1+) has at least one incoming edge — no
orphaned nodes. This is simpler than Slay the Spire's real path-weaving generator (no
attempt to avoid visually crossing paths) but is enough to prove branching *choice*,
which is the thing actually being validated in this pass.

## 2. Node types

| Type | Resolution |
|---|---|
| `fight` | `FightScreen` vs. a generated 4-hero AI squad (`src/run/enemyGen.ts`), no bonus. Row 0 (the single opening node) draws from the non-recruitable enemy pool instead — see below. |
| `elite` | Same, but the AI's 4 heroes each carry a flat +10 bonus to 2 random growth stats. |
| `boss` | `FightScreen` vs. 2 AI heroes (no bench — a real no-cycling fight), each with a flat +20 bonus to 3 random growth stats. |
| `shop` | `ShopNodeScreen` — the existing `GuildHallPanel`, given an exit for the first time. |
| `equipmentReward` | `NodeRewardScreen` — pick 1 of 3 equipment items; claims straight into the run's unequipped inventory (`RunState.inventory`), no hero-assignment step. |
| `relicReward` | `NodeRewardScreen` — pick 1 of 3 relics not already owned. |
| `currencyReward` | `NodeRewardScreen` — an instant flat gold grant (15-30, more for nothing having been spent yet). |
| `upgradeReward` | `NodeRewardScreen` — an instant flat grant to the pooled level-up currency (2-3 points), on top of the per-fight-win grant (see below). |
| `contractReward` | `NodeRewardScreen` — an instant flat grant of 1 Recruit Contract (`progression.md` "raise-vs-recruit axis" — a scarce currency, not unlimited claiming). |

## 3. Decisions locked for this pass (2026-08-16 sign-off)

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
  Goblin doesn't need a different schema, it needs different numbers), and row 0's
  fight nodes draw from it instead of `src/data/heroes.ts` (`App.tsx`'s
  `handleSelectNode`, gated on `node.row === 0` — moved here from
  `handleSquadConfirmed` in the 2026-08-16 battle-preview pass below, since the
  encounter now has to exist before squad-select renders it). `src/run/recruitment.ts`'s new
  `isRecruitable(heroId, recruitablePool)` gates Recruit Contract offers on membership
  in the caller's recruitable pool specifically — never the combined pool a fight
  actually drew from — so a defeated Goblin can never produce a contract offer;
  `FightScreen.tsx`'s claim list is filtered through it, and `App.tsx`'s
  `handleClaimContract` re-checks it as the actual RunState-mutation boundary, not just
  the UI. `src/data/content.ts`'s `allCombatants` (`{ ...heroes, ...enemies }`) is what
  combat resolution and fight-screen rendering actually key off of — they don't care
  which pool a combatant came from, only recruitment does. This is a mechanism + a
  first-pass curve (row 0 only), not a full difficulty tuning pass — which rows/node
  types pull from which pool past the opening row is still open, and is balance work,
  not architecture work.
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
  (2026-08-16, second playtest).** `App.tsx`'s `trainingPointsFor` grants 2 for a
  normal `fight`, 3-4 for `elite`/`boss` — `upgradeReward` nodes remain a second,
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
  moving (2026-08-16, third playtest).** The original equipment model had no
  inventory: `equipmentReward` forced an immediate "which hero gets this" choice, and
  reassigning gear meant `moveEquipment` unequipping a source hero's slot straight onto
  a target's — a swap, never a stash. Per user direction, `RunState.inventory: string[]`
  (`src/run/state.ts`) now holds owned-but-unequipped item ids; `runProgress.ts`'s
  `grantInventoryReward` is what `equipmentReward` nodes call instead of the old
  `applyEquipmentReward`, and `equipFromInventory`/`unequipToInventory` replace
  `moveEquipment` — equipping pulls from the inventory (returning whatever was
  previously in that slot back to it), unequipping pushes to the inventory, and moving
  a item between two heroes is just those two ops composed through the inventory rather
  than a dedicated third function. `RosterManagementScreen` (below) is the UI: condensed
  hero rows (name/level/types + an Info button opening the full stat-bar readout) each
  show their 3 equipment slots underneath, empty by default; an Inventory section below
  the roster lists unequipped items as boxes, equipped via tap-then-tap-a-slot or native
  HTML5 drag-and-drop onto a slot.

## 4. What's still not built

- **Level-up spend UI, superseded (2026-08-16 playtest pass):** the original gap (no
  view-layer way to spend the pooled level-up currency) was first filled by
  `src/view/run/TrainingPanel.tsx`, a deferred-spend panel reachable from `MapScreen`
  "at any time." That's since been replaced: Training Points are now forced-allocated
  immediately via `src/view/run/LevelUpScreen.tsx` right after they're granted (every
  fight win, and any `upgradeReward` node claim) — the run cannot continue with an
  unspent pool. `MapScreen`'s "Manage Roster" button now opens
  `src/view/run/RosterManagementScreen.tsx` instead: condensed hero rows (Info button
  for the full stat-bar readout) plus equipping/unequipping against the run's
  inventory (`RunState.inventory`), no longer a spend surface.
- **Multi-act sequencing.** This pass is one act, start to boss. Chaining acts (with
  escalating difficulty between them) is deferred until this loop's shape is validated.
- **Visual path rendering.** `MapScreen` renders nodes grouped by row with
  reachable/visited/current/locked states, but does not draw connecting lines between
  them — a cosmetic gap, same "lowest priority, purely cosmetic" bucket as the
  feel-pass prototype's presentation layer (`architecture.md`).
- **A real Ancient boss hero**, and real content generally — this pass still runs on
  `/src/data`'s 6 fixture heroes (README "Next steps" #5, unchanged by this work).
