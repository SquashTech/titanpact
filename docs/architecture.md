# architecture.md

> System boundaries, the event contract, and the repo map. This is the doc to read
> first. Everything else (`combat.md`, `types-and-heroes.md`, `progression.md`,
> `mana.md`) specifies rules that must be implemented *inside* the boundaries drawn
> here. If a rule and this file ever disagree about where code lives, this file wins.

## North star (context, not spec)

Titanpact is a piloted (not auto-battle) tactical roguelike. Doubles (2v2) combat,
~45-minute runs, 15-type elemental chart, authored named heroes, deep progression.
The whole point is that team comp, prediction, and resource management create real
strategic depth. The architecture exists to keep that depth **legible and tunable**.

---

## The one invariant everything hangs on: engine / presentation separation

This is locked. It was proven by the feel-pass prototype and is not up for
renegotiation.

- The **engine** is pure, deterministic, and has zero knowledge of React, the DOM,
  audio, or animation. Given a state and an input, it produces a new state **and a
  stream of discrete events**. It never sleeps, tweens, or waits.
- The **presentation layer** subscribes to that event stream and is solely
  responsible for *feel*: sequenced resolution, draining HP bars, floating damage
  numbers, type-colored particle bursts, hitstop, screen shake, and procedural
  Web Audio synthesis.

These two pipelines must never entangle. The engine does not know that a hit
"feels" heavy; it only knows a `DamageDealt` event was emitted. The view does not
know the damage formula; it only knows how to make the number that arrived land
with weight.

**Why this matters for you (Claude Code):** if you ever find yourself importing a
React type into `/engine`, or computing damage inside a component, stop — you are
about to break the invariant. Route it through an event instead.

---

## The event contract

The engine emits **typed, serializable, replayable** event records. An event is a
plain data object: no functions, no class instances, no references the view has to
resolve. The view consumes them in order and decides how (and how fast) to render
each one.

Design constraints on every event type:

- **Serializable** — an event log can be persisted and replayed to reconstruct a
  fight exactly (see *Determinism* below). This is also the basis for the roguelike
  save system and for regression testing.
- **Self-describing** — the view should not need to re-query engine state to render
  an event. If the HP bar needs the new value, the event carries the new value.
- **Discrete** — one event = one thing that happened. `DamageDealt` and
  `Fainted` are two events, not one, even when a hit is lethal.

> 🔒 **OPEN — do not resolve without designer sign-off.**
> `CLAUDE.md` enumerates the defined engine contracts. The **condition / status
> vocabulary is the sixth contract and is still unspecified.** Do not invent status
> events or a status resolution model unilaterally — this decision ripples into
> `combat.md` (stat mods on switch), `types-and-heroes.md` (Blight as a cross-type
> status), and `mana.md`. Flag it and wait.

**Proposed canonical event set — RECONCILE with `CLAUDE.md` before coding, treat as
draft, not locked:**

`RoundStarted` · `TurnStarted` · `MoveDeclared` · `MoveUsed` · `DamageDealt` ·
`HpChanged` · `StatChanged` · `Fainted` · `SwitchedIn` · `BenchRegenTicked` ·
`ManaChanged` · `RoundEnded` · (status events — **blocked on the sixth contract**)

If the prototype or `CLAUDE.md` already names these differently, their names win.

---

## The two damage pipelines

Also locked. Damage is computed by **two separate pipelines** and keeping them
separate is what keeps balance readable. Do not collapse them.

1. **Stat pipeline** — resolves *effective stats*. Base stat line, plus flat stat
   modifiers, plus equipment contributions, plus rank-up stat grants, produce the
   final Attack and Defense that feed the offense/defense **ratio**. Everything that
   changes "how strong is this hero right now" lives here.
2. **Damage pipeline** — takes `BasePower`, the ratio from pipeline 1, and applies
   the locked formula terms (`STAB`, `TypeMult`, `Variance`, `Crit`) **plus a single
   multiplier term** where all situational damage modifiers accumulate.

The full formula lives in `combat.md`. The architectural rule is just: **stat-shaped
effects go in pipeline 1, damage-shaped modifiers go in the pipeline-2 multiplier
term.** Never smuggle a damage modifier into a stat or vice versa — that's how
balance becomes illegible.

---

## Determinism & RNG

The engine must be **deterministic given a seed**. This is a roguelike; run
reproducibility, seed sharing, save/resume, and replay-based testing all depend on
it.

- One seeded RNG source, threaded through engine state. **No `Math.random()` inside
  `/engine`, ever.**
- The damage `Variance` roll (0.85–1.0) draws from this source. Variance is
  intentional and load-bearing — do not "clean it up" by removing it.
- Anything that consumes RNG (variance, crit, any future draft/loot rolls) must draw
  in a **fixed, documented order** so the same seed always produces the same fight.
- Replaying a persisted event log against the same seed and inputs must reproduce
  the identical fight. If it doesn't, that's a bug in engine purity, not a tuning
  issue.

---

## State shapes (three tiers)

Keep these separate; they have different lifetimes and different persistence needs.

- **Combat state** — the current fight: active + benched combatants, HP, mana, stat
  modifiers, turn/round cursor, RNG state. Lifetime: one battle.
- **Run state** — the current roguelike run: roster (≤6), equipment, relics,
  progression pool, XP, map/encounter position. Lifetime: one ~45-min run.
- **Meta state** — whatever survives a run. Lifetime: the save file.

> 🔒 **OPEN — do not resolve without designer sign-off.**
> **Per-run reset vs. meta-progression** is unresolved. This is exactly the seam
> between *run state* and *meta state* above. Build the boundary so either answer is
> cheap to implement; do not hard-wire the assumption that runs carry nothing (or
> everything) forward.

---

## Proposed repo map

Draft — must match the target repo map already in `CLAUDE.md`. If they diverge,
`CLAUDE.md` wins and this section gets updated.

```
/src
  /engine            # pure, deterministic, no React / DOM / audio
    /combat          # turn & round resolution, targeting, switching, lock-in
    /damage          # the two pipelines
    /rng             # seeded RNG
    events.ts        # the event contract (typed records)
    state.ts         # combat state shapes
  /run               # run + progression state, raise-vs-recruit, relics/equipment
  /data              # CONTENT: heroes, moves, type chart, relics, equipment
    heroes.ts
    moves.ts
    typechart.ts     # the 15x15 matrix lives HERE, not in a doc
    relics.ts
    equipment.ts
  /view              # React. subscribes to engine events. owns all feel.
    /combat
    /feedback        # hitstop, screen shake, particles, Web Audio synth
  /app               # screens, routing, run orchestration
/docs                # combat / types-and-heroes / progression / mana / architecture
CLAUDE.md
```

**Content vs. code.** `/data` holds tunable values (stat lines, base powers, the type
chart, crit multiplier, mana costs, XP rates). Docs describe the *rules*; `/data`
holds the *numbers*. When a doc says "flat additive" or "multiple of 5 or 10," that's
a rule for the code; the actual grant values are data.

---

## Testing approach

Because the engine is pure and deterministic, it is fully unit-testable without a
renderer:

- **Golden replays.** Seed + inputs → event log. Snapshot the log; a diff is either a
  bug or an intentional balance change that needs sign-off.
- **Formula tests.** Assert the damage pipeline against hand-computed cases,
  especially the multiplicative type-stacking edges (4× and the 0.25× floor).
- **Invariant tests.** Lock-in engages at 2+ KOs; stat grants are always multiples of
  5/10; level-ups never mutate a stat directly; type is immutable.

The view is tested separately (it should be thin) and is allowed to be
non-deterministic in timing — it just can't be non-deterministic in *outcome*,
because outcome is the engine's job.

---

## Conventions

- Prototype → prove architecture → graduate to this TS + React repo. This is a
  **file-carry operation**, not a fresh start: behavior demonstrated in the
  prototypes is the acceptance bar.
- TypeScript, strict. Engine code is framework-free.
- Never resolve a 🔒 OPEN item silently. Surface it, propose, wait for sign-off.
