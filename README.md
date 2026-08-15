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
   the five 50/50 hero typings (Giant Lobster, Sun Priest, Crystal Guardian,
   Hellhound, Artificer — deferred in favor of nailing down rank-up mechanics first),
   and the condition/status sixth contract (in progress in a separate session).
2. ~~Build the recruitment economy.~~ **Done for both acquisition paths**
   (`src/run/recruitment.ts`, `docs/progression.md` "raise-vs-recruit axis"): Guild Hall
   spends gold on a fresh 0-progress hero from a data-driven offer pool
   (`src/data/recruitment.ts`); Recruit Contracts claim a defeated enemy's exact
   rank-up state (progress, branches, stat grants, type-graft) for free, ungeared. Both
   are wired into the playable slice (`GuildHallPanel.tsx` on squad-select,
   claim buttons on `FightScreen`'s victory overlay) and covered by
   `test/recruitment.test.ts`. **Still not built:** the decaying Guild Hall runway
   value curve (offers are flat-cost, not time-decaying) and a real trigger for
   Recruit Contract offers — claiming currently reuses the single demo fight's fixed
   AI roster as a stand-in for "the enemy you just beat," since the escalating-fight
   run loop (#4 below) that would generate that trigger organically doesn't exist yet.
3. **Build relics** once the hook-and-condition system (the hero-ability effect engine —
   `CLAUDE.md` "Architecture") exists. Relics and equipment share that system by design;
   equipment currently only wires the stat-pipeline half (see "Known gaps" below), and
   relics need the same engine before they can be more than a stub.
4. **Escalating fights / a real run loop.** `/src/app` currently orchestrates exactly one
   fight (squad-select → fight → squad-select). The roguelike run structure (draft →
   escalating fights → relics, `CLAUDE.md` north star) — persistent roster HP/mana
   between fights, an encounter sequence, run-vs-meta state — isn't built.
5. **Replace `/src/data` test fixtures with real content.** Either locate/import the
   prototype files `CLAUDE.md` treats as the reference (`prototypes/combat-prototype.jsx`
   and the feel-pass variant — not present in this repo as of this writing) and port
   their roster/type chart, or author fresh content collaboratively. Don't hand-tune the
   placeholder chart in `src/data/typechart.ts` into "the" chart — replace it wholesale.
6. **A presentation "feel" pass** — sequenced event playback, hitstop, floating damage
   numbers, procedural audio — once the above is stable enough to be worth polishing.
   Lowest priority; purely cosmetic and the feel-pass prototype is the model for it per
   `docs/architecture.md`.

## Status

The pure TypeScript combat engine (`/src/engine`) proves the event-stream /
engine-presentation separation, the two damage pipelines, and the
turn/round/switching/lock-in loop from `docs/combat.md` and `docs/architecture.md`.

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
  `CombatState`, applying equipment/rank-up stat grants as each combatant's starting
  modifiers.
- **The pooled level-up currency** (`progression.ts`): spends points to unlock tiered
  moves or advance rank-up progress; rank-up branches grant permanent stats and are
  one-shot per node. Concrete tier/branch content is fixture data for 2 of the 6
  fixture heroes (`src/data/progression.ts`) — see "Known gaps."
- **The recruitment economy** (`recruitment.ts`): Guild Hall (gold, fresh hero) and
  Recruit Contract (free, claims a defeated hero's exact rank-up state) acquisition
  paths, both enforcing the roster cap via the same `addRosterEntry` used everywhere
  else. `RunState.gold` funds the Guild Hall side; contracts don't touch it.

`/src/view` + `/src/app` is a Vite + React playable slice: pick a 4-hero squad from
your 6-hero roster, then fight a fixed AI (which also fields a 2-active/2-bench squad).
The fight screen exposes real switching (declared as a round action, blocked once
locked in) and forced replacement (choosing which bench hero fills a KO'd slot).

**Known gaps, not silently resolved:**

- The reference prototypes (`prototypes/combat-prototype.jsx` and the feel-pass
  variant) that `CLAUDE.md` treats as the behavioral acceptance bar are not present in
  this repo. `/src/data` currently holds hand-authored **test fixtures** (6 heroes, 9
  moves, a placeholder type chart, a handful of equipment items) sufficient to exercise
  the engine and `/src/run` — not the authored roster or the real 15x15 balance chart.
  Bring the prototypes in (or hand off the authored content) before treating this as
  more than a scaffold.
- Every 🔒 OPEN item from the docs (stat-mods-on-switch, damage-modifier stacking
  order, crit source, type-chart floor vs. immunity, turn/round boundaries, mana's
  resource model/regen/starting state, the condition/status sixth contract) is left
  flagged in code comments at the point it matters, with a provisional value where one
  was needed to make the engine runnable. Search for `🔒 OPEN` before hardening any of
  these.
- **Equipment only wires the stat-pipeline half.** Damage-shaped equipment bonuses (the
  pipeline-2 multiplier term) need the same hook-and-condition system as abilities,
  which isn't built — see "Next steps" #3.
- **Rank-up branches are fixture content for 2 of 6 heroes** (cinderKnight,
  tidecaller — `src/data/progression.ts`); no branch unlocks a move on choice, to keep
  the two level-up-pool spend paths distinct. One branch (cinderKnight's "Ember
  Bulwark") grafts a second type (Stone) to exercise the type-graft mechanic
  (`docs/progression.md` "Type-graft branches") end to end. The other 4 fixture
  heroes have nothing to invest in yet; that's a valid empty state, not a bug.
- **Recruit Contracts have no real fight-outcome trigger.** They're claimed off the
  fixed demo AI's roster on any win, not off a specific escalating-fight encounter —
  see "Next steps" #2.
- **No sequencing/animation.** The view renders each round's *end state* plus a text log
  of what happened — it does not yet subscribe to the event stream turn-by-turn with
  timing/juice. That's the "feel pass" the prototypes model; not built here.

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
