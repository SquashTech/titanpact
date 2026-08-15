# Titanpact

Piloted doubles (2v2) tactical roguelike. See [`CLAUDE.md`](./CLAUDE.md) for the project
constitution and [`docs/`](./docs) for the deeper design modules.

> **New chat picking this up?** Read this file top to bottom, then skim `CLAUDE.md` and
> `docs/`. "Next steps" below is the prioritized punch list — start there. "Known gaps"
> lists things that are *intentionally* unbuilt (flagged, not forgotten) — check it
> before assuming something's missing by accident.

## Next steps (priority order)

1. **Get a designer call on the 🔒 OPEN items**, or explicitly decide to keep punting on
   them. Real content (a real type chart, a real roster, real mana tuning) can't be
   authored responsibly until at least these are decided: mana's resource model
   (per-hero vs. shared pool) and regen cadence/starting value (`docs/mana.md`), crit
   source (`docs/combat.md`), damage-modifier stacking order, and the type-chart floor
   vs. hard-immunity question (`docs/types-and-heroes.md`). None of these are Claude's
   to decide unilaterally — see "How to work in this repo" in `CLAUDE.md`.
2. **Build `/src/run`** — the roster/progression layer: bring-6-pick-4, recruit vs. Guild
   Hall, equipment/relics, the level-up pool. This is the next architectural milestone
   per `CLAUDE.md`'s build order and is what the fight screen needs before it can show
   more than one scripted 2v2.
3. **Wire bench/switching into the fight screen.** The engine already implements
   lock-in and voluntary/forced switching (`src/engine/combat/switching.ts`,
   tested in `test/combat.test.ts`) — the UI just doesn't expose it because the current
   fixture roster has no bench. Needs `/src/run` (step 2) to have a real bench to expose.
4. **Replace `/src/data` test fixtures with real content.** Either locate/import the
   prototype files `CLAUDE.md` treats as the reference (`prototypes/combat-prototype.jsx`
   and the feel-pass variant — not present in this repo as of this writing) and port
   their roster/type chart, or author fresh content collaboratively. Don't hand-tune the
   placeholder chart in `src/data/typechart.ts` into "the" chart — replace it wholesale.
5. **A presentation "feel" pass** — sequenced event playback, hitstop, floating damage
   numbers, procedural audio — once the above is stable enough to be worth polishing.
   Lowest priority; purely cosmetic and the feel-pass prototype is the model for it per
   `docs/architecture.md`.

## Status

The pure TypeScript combat engine (`/src/engine`) proves the event-stream /
engine-presentation separation, the two damage pipelines, and the
turn/round/switching/lock-in loop from `docs/combat.md` and `docs/architecture.md`.
A first playable slice sits on top of it: `/src/view` + `/src/app` is a Vite + React
page where you pick moves/targets for a 2v2 fight against a fixed AI, rendered as HP/mana
bars and a scrolling event log — no run/roster/draft layer yet (`/src/run` is still
empty), just one fight.

**Known gaps, not silently resolved:**

- The reference prototypes (`prototypes/combat-prototype.jsx` and the feel-pass
  variant) that `CLAUDE.md` treats as the behavioral acceptance bar are not present in
  this repo. `/src/data` currently holds hand-authored **test fixtures** (4 heroes, 5
  moves, a placeholder type chart) sufficient to exercise the engine — not the
  authored roster or the real 15x15 balance chart. Bring the prototypes in (or hand off
  the authored content) before treating this as more than a scaffold.
- Every 🔒 OPEN item from the docs (stat-mods-on-switch, damage-modifier stacking
  order, crit source, type-chart floor vs. immunity, turn/round boundaries, mana's
  resource model/regen/starting state, the condition/status sixth contract) is left
  flagged in code comments at the point it matters, with a provisional value where one
  was needed to make the engine runnable. Search for `🔒 OPEN` before hardening any of
  these.
- The fight screen has no bench/switch UI — the fixture roster is exactly 2v2 with no
  bench, so lock-in and switching aren't reachable from the UI yet even though the
  engine supports them (see `test/combat.test.ts`).
- No sequencing/animation. The view renders each round's *end state* plus a text log of
  what happened — it does not yet subscribe to the event stream turn-by-turn with
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
