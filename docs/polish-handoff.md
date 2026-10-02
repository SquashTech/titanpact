# polish-handoff.md — where the polish pass stands (2026-10-02)

> A handoff between Claude sessions, not a design module. Read it before the next playtest.
> The **next job**: play one full run, start to finish, as a player would, and report back.

---

## 1. What this pass did

The pass started from a "is this worth paying for on mobile" review and a first-15-minutes
playthrough on a fresh account (`art/concepts/ftue-1002/sheet-1..4.png`, 32 captioned screens).
Everything below is committed to `main`.

**First-time experience**
- The Mastery tip fires on whichever comes first, the Scroll Cache or the Scribe.
- The run's first map node carries a pulsing *Tap to begin*.
- The Blessing scene says what it did ("Each will shrug off the first blow that would knock it out").
- *Physical vs Magical* is its own **Attacks** tip, separate from **Types**.
- The Skirmish tip's rivals "would rather seal the pact themselves" (the lore never said why
  heroes fight you; that line is a placeholder for the designer to replace).
- The Fruit Slicer event's text now matches what it gives.
- The event screen's 1.15 s hold is 0.25 s.

**Plain language**
- Every innate and Evolution passive opens *When*, not *Whenever* (more fit one line).
- Gone from player text: "Early band", "learns outright" (now "has room" / "kit full"),
  "+20 MP each use" (now "costs 20 more each use"), "5 Evolves · 10 masters the innate"
  (now "Evolves at 5 · Innate grows at 10"), STAB (now "same type").
- A status a hero puts on itself is *gained*, not *afflicted*.
- A chance-gated stat change prints its odds on the learned-move card (Gravel Spray read as guaranteed).

**Systems**
- **Starting kits are one attack and one move that is not** — Widow the only exception
  (her innate needs a Bleed and a Poison). Thirteen heroes changed; Warden and Scallywag no
  longer open on the 15 BP Swift Blow. A test pins the rule; CLAUDE.md records it.
  *Not yet sim-measured.*
- **One schedule entry per hero per level-up report.** The flow used to pay every owed entry,
  so the companion (joining owing its level-4 offer) took two moves off one fight. The
  companion now also joins with entries below its level already taken. The sim already
  behaved this way.

**Screens**
- *Start a Run* is bigger: 296 px plate, 22 px label between seal diamonds, gilt wings, stronger glow.
- **Map tiles carry a one-word label above them** (`NODE_LABELS`: Fight, Elite, Skirmish,
  Guardian, Scrolls, Items, Boon, Event…), above because the route lines arrive from below.
- **The press-and-hold node panel** heads with the tile's own pixel art (landmarks as one still
  sprite), titles itself with the tile's label, hides rows that only printed a dash, folds a
  Titanspawn tile's enemies into one row, and keeps the Wounds glossary on Rest only and
  Elemental Force on the Ley Line only. The row icons stay vector (the pixel pack was tried at
  this size before and dropped — `docs/icon-pack.md`; the user chose to keep vector).
- **Road scenes cut** for the Mentor, Tutor, Scribe and Forge: the screen opens directly and the
  keeper's line sits in its header. Events keep their road scene (their text is content).
- **The Forge beat** no longer moves the piece: the anvil dims and the rune circle opens round
  the piece where it lies.
- Classes (another session's work, committed with this push): Sage's Deep Breath also grants
  Wisdom; the Herald class is renamed **Bard** with a lyre icon.

## 2. Known, not yet addressed

From the first-15-minutes playthrough, still open:
- **Early fights were trivially easy** — the opener and an Act 1 Elite each won in 1–2 rounds
  with little damage taken. One run, so a data point, not a finding; watch it over a full run.
- Status names in move text (*Conduct*, *Ambush 20*) are unexplained outside their tap-sheet.
- The PWA install prompt is the first thing a new account sees (it already detects iOS/Android).
- The title's type wheel clips at the edges on a 375 px phone.
- Early Titanspawn sprites are tiny next to hero sprites.
- The MVP row's "Tactician"/"Striker" label is unexplained.
- **DEV stays visible on the title — deliberately** (the user: not shipping soon).

Not verified on screen this pass: the Guild Hall / Guardian / Vigil / Titan tiles and their hold
panels; the Elite/Skirmish row's labels next to its lead-on marks; the Tutor and Scribe headers;
the title when a run is parked (the taller plate may nudge it).

Bigger items from the product review, untouched: native wrapper (Capacitor), cloud save
(saves are `localStorage` only), crash reporting, localization, an audio pass, store assets.

## 3. The next job: a full run, start to finish

**Goal.** Play one complete run the way a new-ish player would — draft to the Titan's Eyes or to
a loss — and report what the whole run feels like, not just its opening.

**Setup (the in-app Browser pane).**
- `preview_start` with `name: "titanpact-view"` (it uses the pinned Node in `.node-runtime/`).
- `resize_window` preset `mobile` (375 × 812). Reload after resizing, or the canvas scales wrong.
- The pane's storage is the user's test profile. **Back it up first**
  (`localStorage['titanpact.profile']`, and `titanpact.run` if present) and restore it exactly
  when done. The app writes the run save on `pagehide`, so a restore must also run inside a
  `pagehide` listener, or the save comes back. Verify with `Object.keys(localStorage)` after.
- For a true first-run experience, clear storage before starting. To skip tips you have
  already judged, pre-seed `seenTipIds` (ids are in `src/data/tips.ts` plus `lore`, `install`).

**Driving the game.**
- Every move is two taps: the move, then a target (or confirm for spread moves).
- **Auto** only plays the round's resolution beats; you still pick moves each round.
- A long-press on a map tile: dispatch a `pointerdown` PointerEvent on `.map-medallion` and wait
  ~1 s (`useLongPress`, `src/view/shared/MoveTile.tsx`).
- `get_page_text` and `find` are faster than screenshots for reading a screen; screenshot the
  moments worth showing.
- Expect ~60+ minutes of play. Don't shortcut it by editing the save — the point is the
  real run. (Editing the save was fine for checking one screen; not for this.)

**What to report.** Write it up for the user, with screenshots saved under
`art/concepts/<date>-full-run/`:
- The run in brief: draft, route, who carried, where it was won or lost, how long it took.
- **Pacing**: where it dragged, where it rushed, how many taps a node or fight cost, which
  screens were dead weight.
- **Difficulty curve** act by act: which fights threatened, which were free, whether Guardians
  and the finale land (CLAUDE.md's target: Base feels like Pokémon Emerald played as an adult).
- **Decisions**: which choices felt real, which had one obvious answer, which were confusing.
- **Clarity**: anything a new player would not understand, any jargon left, any text that
  disagrees with what happened.
- **Bugs and rough edges**, each with a screenshot and how to reproduce.
- A short ranked list of what to fix next.

Report what happened, not what the design docs say should happen. A single run is one data
point; say so where a call needs more runs or the sim (`docs/` and memory list the sim tools —
run it with `--workers 2`).
