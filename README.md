# Titanpact

Piloted doubles (2v2) tactical roguelike. See [`CLAUDE.md`](./CLAUDE.md) for the project
constitution and [`docs/`](./docs) for the deeper design modules.

> **New chat picking this up?** Read this file top to bottom, then skim `CLAUDE.md` and
> `docs/`. "Next steps" below is the prioritized punch list — start there. "Known gaps"
> lists things that are *intentionally* unbuilt (flagged, not forgotten) — check it
> before assuming something's missing by accident.

## Next steps (priority order)

1. **Most 🔒 OPEN items got a 2026-08-15 designer sign-off** — mana's resource model
   (per-hero), regen cadence (every round, active + bench) and starting value (full,
   `docs/mana.md`), crit source (loadout/equipment layer, `docs/combat.md`),
   damage-modifier stacking (multiplicative), stat-mods-on-switch (persist), the
   turn/round model (locked as proposed), the type-chart floor (soft 0.25×, no
   immunities, `docs/types-and-heroes.md`), and per-run reset vs. meta-progression
   (light meta-progression — unlocks only, `docs/progression.md`) are now locked.
   Several of these are locked as *decisions* but not yet *implemented* — see the
   "NOT YET IMPLEMENTED" notes in `docs/mana.md`, `docs/combat.md` (crit), and
   `docs/progression.md` (meta-progression) before assuming the engine already
   behaves per the decision. Still genuinely open: weather's interaction with mana,
   and the five 50/50 hero typings (Giant Lobster, Solace, Crystal Guardian,
   Hellhound, Artificer — deferred in favor of nailing down Evolution mechanics first).
   The condition/status sixth contract is now **implemented** (`docs/conditions.md`,
   `src/engine/combat/statusEngine.ts`) — 8 statuses, plus heal and buff/debuff move
   kinds — with its own remaining open sub-questions resolved provisionally per the
   doc's recommendations, not yet designer-confirmed; see `docs/conditions.md` §7.
2. ~~Build the recruitment economy.~~ **Done for both acquisition paths**
   (`src/run/recruitment.ts`, `docs/progression.md` "raise-vs-recruit axis"): Guild Hall
   spends gold on a fresh 0-progress hero from a data-driven offer pool
   (`src/data/recruitment.ts`); Recruit Contracts claim a defeated enemy's exact
   Evolution state (level, chosen paths, stat grants, type-graft), ungeared. Both
   are wired into the playable slice (`ShopNodeScreen.tsx` on `shop` map nodes,
   claim buttons on `FightScreen`'s victory overlay) and covered by
   `test/recruitment.test.ts`. Contract offers have a real trigger — claiming reuses
   the specific map node's generated AI roster (`src/run/enemyGen.ts`), not a fixed
   stand-in. **Recruit Contracts are now a scarce currency, not unlimited claiming**
   (2026-08-16 playtest pass): `RunState.recruitContracts` starts at 1/run, is spent on
   every claim, and can be topped up via a `contractReward` map node or bought at the
   Guild Hall for a flat 20g (cheaper than a direct 50g hero recruit). **Guild Hall
   overhaul (2026-08-18):** offers only 2-3 curated heroes per visit instead of the full
   catalog, plus rarity-priced equipment and flat-cost relics for direct purchase
   (`src/run/shop.ts`). **Still not built:** the decaying Guild Hall runway value curve
   (offers are flat-cost, not time-decaying).
3. **Relics: minimal version done, hook-triggered version still blocked.**
   `src/run/relics.ts` + `src/data/relics.ts` (`docs/run-loop.md`) implement team-wide
   flat stat grants, the same stat-pipeline-only precedent equipment already uses —
   enough to back `relicReward` map nodes end to end. Hook-triggered relics (e.g. "on
   faint, heal the team") still need the hook-and-condition system (the hero-ability
   effect engine — `CLAUDE.md` "Architecture") that isn't built. Equipment has the same
   split: stat-pipeline half only (see "Known gaps" below).
4. ~~Escalating fights / a real run loop.~~ **Done, one act.** `/src/app` now
   orchestrates a Slay the Spire-style branching map (`src/run/map.ts`,
   `docs/run-loop.md`) — `MapScreen.tsx` hub, 8 node types (fight/elite/boss + 5 reward
   types), squad selection before every fight node (team-preview style, not once per
   run), HP/mana persisting between nodes (`RosterEntry.currentHp/currentMana`,
   `src/run/runProgress.ts`), and a win/loss run outcome (no more retry-in-place
   "Rematch"). Covered by `test/map.test.ts`, `test/enemyGen.test.ts`,
   `test/runProgress.test.ts`, `test/relics.test.ts`. **Still not built:** multi-act
   sequencing (this is one act, start to boss), visual path-line rendering on the map
   (nodes render grouped by row, not connected by drawn lines), and a real Ancient boss
   hero (the boss fight is 2 scaled-up fixture heroes, not authored Ancient content).
   See `docs/run-loop.md` §4 for the full list.
5. **Replace `/src/data` test fixtures with real content.** Either locate/import the
   prototype files `CLAUDE.md` treats as the reference (`prototypes/combat-prototype.jsx`
   and the feel-pass variant — not present in this repo as of this writing) and port
   their roster/type chart, or author fresh content collaboratively. Don't hand-tune the
   placeholder chart in `src/data/typechart.ts` into "the" chart — replace it wholesale.
   Higher-value now that a real run loop exists to play it through.
6. **A presentation "feel" pass** — sequenced event playback, hitstop, floating damage
   numbers, procedural audio — once the above is stable enough to be worth polishing.
   Lowest priority; purely cosmetic and the feel-pass prototype is the model for it per
   `docs/architecture.md`.

## Status

The pure TypeScript combat engine (`/src/engine`) proves the event-stream /
engine-presentation separation, the two damage pipelines, and the
turn/round/switching/lock-in loop from `docs/combat.md` and `docs/architecture.md`.
It also implements the condition/status system (`docs/conditions.md`, the 6th
engine contract): 8 statuses across 3 shapes as data (`src/data/statuses.ts`) driving
a generic runtime (`src/engine/combat/statusEngine.ts` — no per-status special
cases), plus `heal` and `buff` move kinds (`src/engine/content.ts`) so moves can
heal, buff/debuff flat stats, and apply/cleanse statuses in any combination.
Covered by `test/statuses.test.ts`.

`/src/run` is the roster/progression layer that sits on top of the engine
(docs/architecture.md "State shapes": the RUN tier). It implements:
- **Roster** (`state.ts`): up to 6 heroes, add/terminate (equipment strips on
  termination — `progression.md`).
- **Equipment** (`equipment.ts`): 3 slots/hero, flat stat grants only — the stat-pipeline
  half of the discipline in `architecture.md`. Damage-shaped equipment/relic bonuses are
  deferred; see "Known gaps."
- **Bring-6-pick-4 squad selection** (`squad.ts`): picks 1-4 roster heroes into a
  {2 active, 2 bench} `Squad`.
- **The engine seam** (`buildCombatState.ts`): turns a `Squad` + roster into a real
  `CombatState`, applying equipment/Evolution stat grants as each combatant's starting
  modifiers.
- **The pooled level-up currency** (`progression.ts`): `levelUpHero` spends one point to
  level a roster entry up (increments `RosterEntry.level`); `grantLevelUpMove` resolves
  that level-up's move offer — a random pick from the hero's `moveTiers` pool, gained
  outright under the 4-move cap or an accept/decline replacement at the cap
  (`MOVE_CAP`). **Below `EVOLUTION_LEVEL` only** — the level-up that reaches it
  (currently level 5, flat and uniform across every hero) skips the move offer
  entirely and instead surfaces the hero's Evolution: a one-shot choice of three
  named paths (`chooseEvolutionPath`) granting permanent stats and/or a type-graft.
  **`moveTiers` pool content covers all 12 fixture heroes** (`src/data/
  progression.ts`), each drawing from a handful of thematically-appropriate moves
  beyond their starting kit. **Evolution paths now cover all 12** as well, each with
  the full three named paths — a separate axis from the move pool, still fixture
  content rather than authored balance — see "Known gaps."
- **The recruitment economy** (`recruitment.ts`): Guild Hall (gold, fresh hero) and
  Recruit Contract (claims a defeated hero's exact Evolution state, ungeared) acquisition
  paths, both enforcing the roster cap via the same `addRosterEntry` used everywhere
  else. `RunState.gold` funds the Guild Hall side; Recruit Contracts spend a separate,
  scarce `RunState.recruitContracts` pool instead (starts at 1/run, toppable via a
  `contractReward` map node or a cheaper Guild Hall purchase, `buyContract`).
- **The run loop / branching map** (`map.ts`, `enemyGen.ts`, `runProgress.ts`,
  `relics.ts` — `docs/run-loop.md`): a seeded, Slay the Spire-style branching map for
  one act, 8 node types (fight/elite/boss + shop/equipment/relic/currency/upgrade
  reward), a seeded per-node AI encounter generator (reusing `RosterEntry.
  evolutionStatGrants` for elite/boss difficulty scaling — no new mechanism), minimal
  team-wide stat-only relics, and HP/mana that persist between nodes
  (`RosterEntry.currentHp/currentMana`, clamped to current max on read, never healed by
  a cap increase).

`/src/view` + `/src/app` is a Vite + React playable slice: `MapScreen` is the run's
hub — pick a reachable node, and fight/elite/boss nodes lead into a fresh
bring-6-pick-4 squad pick (`SquadSelectScreen`, now per-fight/team-preview-style, not
once per run) before `FightScreen` against that node's generated AI squad. The node's
AI encounter is generated before `SquadSelectScreen` renders (not after squad
confirmation), so that screen doubles as a battle-preview: a "Scouted enemies" section
shows the generated AI squad alongside the player's own roster, both with an info
button opening `HeroPreviewOverlay` (full stat table, moves, equipment — computed
straight from `RosterEntry`/`HeroDefinition`, no live fight required). The fight
screen exposes real switching (declared as a round action, blocked once locked in) and
forced replacement (choosing which bench hero fills a KO'd slot). A loss ends the run
("Run Failed"); beating the boss node ends it ("Run Complete") — both offer "Start New
Run" (fresh roster, fresh map seed; there's no meta-progression/unlock-pool layer yet).

A round resolves instantly in the engine, then `FightScreen` replays its event stream
one tap-advanced **beat** at a time (`buildBeats.ts`) rather than dumping the end
state — a beat groups the events that belong to one readable moment (a move landing,
a status ticking, a KO) behind a single banner + tap. **A KO is its own beat**
(2026-08-16): a fainting hit's damage/HP-drain beat and the resulting faint (which
clears the active slot and pulls up the replacement picker) used to be bundled
together, so the card could disappear before the player saw the bar actually reach
zero; they're now sequenced as two separate taps. The battlefield also got a visual
pass (2026-08-16) — gradient card/panel backgrounds, a targetable-glow pulse, a
KO shake, HP/mana bar shine and a low-HP pulse, and an opaque `result-panel` window
for the victory/defeat screen instead of the outcome text sitting directly against the
dimmed battlefield.

Training Points are forced-allocated immediately: `LevelUpScreen` blocks the run from
continuing until every point earned (from a fight win or an `upgradeReward` node) is
spent on a hero — replacing the earlier `TrainingPanel`, a deferred "spend whenever"
panel. `MapScreen`'s "Manage Roster" button now opens `RosterManagementScreen` instead:
read-only full stat spreads and equipment status per hero, plus moving an equipped item
from one hero to another.

**Known gaps, not silently resolved:**

- The reference prototypes (`prototypes/combat-prototype.jsx` and the feel-pass
  variant) that `CLAUDE.md` treats as the behavioral acceptance bar are not present in
  this repo. `/src/data` currently holds hand-authored **test fixtures** (6 heroes, ~55
  moves across all 15 types, a placeholder type chart, a handful of equipment items) sufficient to exercise
  the engine and `/src/run` — not the authored roster or the real 15x15 balance chart.
  Bring the prototypes in (or hand off the authored content) before treating this as
  more than a scaffold.
- Every 🔒 OPEN item from the docs (stat-mods-on-switch, damage-modifier stacking
  order, crit source, type-chart floor vs. immunity, turn/round boundaries, mana's
  resource model/regen/starting state) is left flagged in code comments at the point
  it matters, with a provisional value where one was needed to make the engine
  runnable. Search for `🔒 OPEN` before hardening any of these. The condition/status
  sixth contract graduated from this list — it's implemented, not just flagged — but
  its own sub-questions (`docs/conditions.md` §7) are still provisional the same way.
- **Equipment only wires the stat-pipeline half.** Damage-shaped equipment bonuses (the
  pipeline-2 multiplier term) need the same hook-and-condition system as abilities,
  which isn't built — see "Next steps" #3.
- **Evolution paths are fixture content for all 12 fixture heroes**
  (`src/data/progression.ts`), each with the full three named paths (one offensive,
  one defensive, one utility) the framework requires; no path unlocks a move on
  choice, to keep the level-up move pool and Evolution stat grants distinct axes.
  Most heroes' non-mono paths graft a second type to exercise the type-graft
  mechanic (`docs/progression.md` "Type-graft paths") end to end; each hero keeps
  exactly one mono path as a valid terminal identity. ironWarden and wildOracle were
  promoted from dual- to mono-typed (`src/data/heroes.ts`) so their Evolutions could
  follow this mono-base-plus-graft framework — the type chart is keyed per single
  type, so this didn't require a chart change. None of this is authored-canon
  content — see `docs/leveling-and-ranks.md` Part 2 for the rules the real 53-hero
  roster's Evolutions need to follow.
- ~~Fixture heroes already exceed the 4-move cap at roster creation.~~ **Fixed
  (2026-08-16):** `heroes.ts` starting kits are now trimmed to 3 moves each (a
  low-power move of the hero's main type plus 1-2 support moves), leaving room to grow
  into `MOVE_CAP` via level-ups instead of starting over it — a level-up now surfaces a
  clean gain until the cap, then the accept/decline replacement offer
  (`docs/leveling-and-ranks.md`). Each hero's `moveTiers` pool was expanded to match
  (see the level-up currency bullet above).
- **The run loop is one act, and its map has no visual path lines.** See
  `docs/run-loop.md` §4 for the full list of what's still not built there (multi-act
  sequencing, a real Ancient boss hero, drawn map connectors).
- **No hitstop/screen-shake/procedural audio.** `FightScreen` already replays a round
  beat-by-beat, tap-advanced (see above), and has a light CSS-only "juice" pass
  (card shake on KO, targetable/low-HP pulses, bar shine, popup/banner motion) — but
  the full feel-pass the prototypes model (hitstop, screen shake, procedural Web Audio)
  is not built here.

## Requirements

System Node is **v14.15.1** (EOL) and can't run Vite (`node`/`npm` on your `PATH`
resolve to it). A portable **Node 24 LTS** is vendored at `.node-runtime/` (gitignored,
not committed) purely so this project doesn't depend on your system Node. Prepend it to
`PATH` for any command below:

```bash
# bash
export PATH="$(pwd)/.node-runtime/node-v24.19.0-win-x64:$PATH"
```

```powershell
# PowerShell
$env:PATH = "$PWD\.node-runtime\node-v24.19.0-win-x64;$env:PATH"
```

If `.node-runtime/` isn't present (e.g. fresh clone), download it yourself or upgrade
your system Node to 18+ and skip the `PATH` prepend.

## Commands

```bash
npm install
npm run dev          # Vite dev server — the playable fight screen, http://localhost:5173
npm run build:view   # typecheck + production build of the view -> dist-view/
npm run preview      # serve the production build

npm run build        # tsc -> dist/ (engine/tests/demo only, not the view)
npm test             # build, then run the engine test suite
npm run demo         # build, then run a scripted 2v2 fight through the engine, printed to the console
npm run typecheck        # tsc --noEmit (engine/node side)
npm run typecheck:view   # tsc --noEmit (view/app side, DOM + JSX)
```

`npm run demo [seed]` is the non-visual sibling of `npm run dev`: a fixed AI drives both
sides and the event log prints as text. Useful for eyeballing the engine without a
browser, or for a specific seed.
