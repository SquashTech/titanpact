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

- **Row 0 (entry): 3 plain `fight` nodes.** Slay the Spire convention — the run always
  opens on an easy, unambiguous fight, no early reward-node luck.
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
| `fight` | `FightScreen` vs. a generated 4-hero AI squad (`src/run/enemyGen.ts`), no bonus. |
| `elite` | Same, but the AI's 4 heroes each carry a flat +10 bonus to 2 random growth stats. |
| `boss` | `FightScreen` vs. 2 AI heroes (no bench — a real no-cycling fight), each with a flat +20 bonus to 3 random growth stats. |
| `shop` | `ShopNodeScreen` — the existing `GuildHallPanel`, given an exit for the first time. |
| `equipmentReward` | `NodeRewardScreen` — pick 1 of 3 equipment items, then which roster hero to equip it on. |
| `relicReward` | `NodeRewardScreen` — pick 1 of 3 relics not already owned. |
| `currencyReward` | `NodeRewardScreen` — an instant flat gold grant (15-30, more for nothing having been spent yet). |
| `upgradeReward` | `NodeRewardScreen` — an instant flat grant to the pooled level-up currency (2-3 points). |

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
- **HP/mana persist between map nodes.** Discovered as necessary during this
  exploration, not part of the original ask: without persistence, "escalating fights"
  are just repeated fresh fights, and there's no resource tension across the run —
  which is the entire point of the Slay the Spire reference. `RosterEntry` gains
  `currentHp`/`currentMana: number | null` (`state.ts`); `null` means "at full,"
  covering fresh recruits and Contract claims without special-casing them.
  `runProgress.ts`'s `syncRosterVitals` writes a fight's ending values back after every
  node; `buildCombatState.ts`'s `placeEntry` reads them back in, **clamped to the
  current max, never healed by a cap increase** (e.g. a mid-run rank-up raising max
  HP just adds headroom, it doesn't top the hero back up).
- **No passive recovery between nodes in this pass** — no rest-site node type. Heal
  moves, relics, and equipment are the only recovery levers. This may prove too
  punishing on first playtest; that's a legitimate signal to gather, not a reason to
  pre-build a rest mechanic now. A rest-site node type is the natural follow-up if so.
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

## 4. What's still not built

- **A missing UI gap this surfaced, now filled:** there was no view-layer way to spend
  the pooled level-up currency at all before this pass (`progression.ts`'s
  `unlockTierMove`/`investRankProgress`/`chooseRankUpBranch` were exercised only in
  tests). `src/view/run/TrainingPanel.tsx` is the minimal spend UI, reachable from
  `MapScreen` at any time — otherwise `upgradeReward` nodes would grant currency the
  player could never actually use.
- **Multi-act sequencing.** This pass is one act, start to boss. Chaining acts (with
  escalating difficulty between them) is deferred until this loop's shape is validated.
- **Visual path rendering.** `MapScreen` renders nodes grouped by row with
  reachable/visited/current/locked states, but does not draw connecting lines between
  them — a cosmetic gap, same "lowest priority, purely cosmetic" bucket as the
  feel-pass prototype's presentation layer (`architecture.md`).
- **A real Ancient boss hero**, and real content generally — this pass still runs on
  `/src/data`'s 6 fixture heroes (README "Next steps" #5, unchanged by this work).
