# leveling-and-ranks.md

> The authoritative spec for **how heroes grow**: the post-battle level-up grant, what
> a level-up does to a hero's movepool, and the Evolution branching system. This module
> supersedes the level-up / Evolution sections of `progression.md` — where they
> disagree, this file wins, and `progression.md` should be updated to defer here.
> Rules only; thresholds, move data, and per-hero Evolution paths are **data** (`/data`).

---

# Part 1 — The level-up system

## How level-ups are earned

Level-ups are awarded **after battles**, as a discrete count. A fight grants a certain
**number of level-ups**, and tougher fights grant more — **elite fights pay out extra
level-ups as their reward**. The count scales with encounter difficulty; the exact
per-encounter values are data (`/data`), tunable.

Think of level-ups as a **pooled resource earned per battle**, not as XP that
accumulates invisibly on individual heroes. (This is the concrete form of the "pooled
level-up currency" referenced in `progression.md`.)

## The pool is distributed freely — including to the bench

After a battle, the player **assigns the earned level-ups to any heroes they choose**,
including **benched** heroes. There is no per-hero XP bar to fill and no requirement
that a hero participated in the fight to receive a level-up. The allocation is a
deliberate strategic decision surface: pour level-ups into a developing hero now, or
spread them, or bank them into a hero you plan to field later.

> 🔒 **OPEN — do not resolve without designer sign-off.**
> **Reconcile with the "bench XP at 33%" rule in `progression.md`.** That rule assumed
> heroes earn their *own* XP at a reduced rate while benched. This freely-distributed
> pooled model appears to **supersede** per-hero bench XP entirely (the player decides
> who gets level-ups, so "bench rate" may be obsolete). Do not silently keep both.
> Decide: is bench-XP-rate removed, or does it survive as a modifier on how pooled
> level-ups apply to benched heroes? Flag until signed off.

## What a level-up does (LOCKED)

A level-up affects **only the hero's movepool** — with one exception carved out below:
the level-up that takes a hero to **`EVOLUTION_LEVEL`** does not touch the movepool at
all; it triggers Evolution instead (Part 2). Below that level, a level-up either:

- **Gains a new move**, if they have fewer than four; or
- Is offered the **option to replace one of their four existing moves** with a newly
  offered move, if they are already at the cap.

The player may **decline** a replacement and keep the current four — a level-up at cap
is an *offer*, not a forced overwrite.

### Which move is offered: the tier gate (2026-08-31)

The move is drawn at random from the hero's pool (`progressionTable.moveTiers`), but
**not from all of it.** Every move carries the designer table's `Early / Mid / Late`
column as `MoveDefinition.tier`, and `MOVE_TIER_LEVEL` (`src/run/progression.ts`) gates
each tier behind a hero level: **Early from 1, Mid from 4, Late from 7.** A hero is
never offered a capstone at level 2.

Three properties, all deliberate:

- **Cumulative, not windows.** Reaching a tier's level adds it; it never closes the tier
  below. Exclusive windows would make a move the hero simply never rolled permanently
  unreachable, and could leave the pool empty at exactly the level the player is feeding
  it points.
- **Read at the level just reached.** The level-up that takes a hero to 4 can draw a Mid
  move — the point pays out on the level it buys, not the one before it.
- **An empty pool is legal.** A hero whose Early moves are exhausted at level 3 gets a
  level and nothing else; the level-up screen labels that card "Level only" *before* the
  point is spent, so it is a visible signal to feed someone else, not a silent dud.

The gate applies to generated enemies through the same function
(`src/run/enemyGen.ts`), so an Act 1 enemy at level 1 fields only Early moves and the
Act 5 level-10 enemies field the capstones — the act curve buys movepool depth for free.

**All fourteen authored slates carry the designer's tier column**, checked against the
source table on 2026-08-31. Ancient is untiered because it has no authored slate yet,
and a move with no `tier` counts as Early, i.e. ungated. See `docs/authoring-moves.md`
§2 and `test/moveTiers.test.ts`.

**The gate exposed a pool-composition problem it did not cause.** Six heroes' level-up
pools (Sylva, Tempest, Vesper, Marrow, Nightshade, Bellows) held no Early move at all,
so they learned nothing until level 4 — those pools were built while the tier column
was documentation only, and nothing ever asked them to hold one. All six were given
one; `test/moveTiers.test.ts` now asserts that **every pool holds something a level-1
hero can be offered**, which is the invariant the gate creates.

Fourteen pools hold exactly one Early move. That is thin but not broken: a 3-move
starting kit against a 4-move cap leaves room for exactly one outright gain anyway, and
every offer after that is a replacement offer the player may decline.

### The four-move cap (LOCKED)

A hero holds a **maximum of four moves.** This is a hard cap. Once at four, growth in
the movepool is strictly *substitution*, never expansion.

> **Implemented (2026-08-16 playtest pass):** `src/run/progression.ts`'s
> `levelUpHero`/`grantLevelUpMove`/`MOVE_CAP` enforce exactly this — under the cap a
> level-up's move is gained outright; at the cap it's an accept/decline replacement
> offer (`src/view/run/LevelUpScreen.tsx`). **Fixture content now respects the cap
> too:** `/src/data/heroes.ts` starting kits are **exactly 3 moves for every hero** (a
> low-power move of the hero's main type plus two supports — heal/buff/status),
> leaving room to grow into the cap via level-ups instead of starting over it. The
> five Field Effect setters briefly broke that uniformity as fourth starting moves;
> they moved into `moveTiers` on 2026-08-26 (`docs/field-effects.md`), so the rule now
> holds with no exceptions — which is what lets the draft screen compare four
> candidates' kits against each other without one of them being a slot longer. Every
> fixture hero's `moveTiers` pool (`src/data/progression.ts`) was expanded to match, so
> a level-up's random draw has real variety across all 12 heroes. Evolution paths
> (Part 2, below) now cover all 12 fixture heroes too — a separate axis from the
> move pool, see README "Known gaps."

### Level-ups never change stats (LOCKED)

**Leveling up does not increase any stat.** No HP, no Attack, no Speed — nothing. A
level-up is a movepool event and only a movepool event. All stat growth happens at
**Evolution** (Part 2). This separation is what keeps a hero's raw power explained by
visible choices rather than an opaque level curve.

### Which moves are offered

The moves offered on level-up are drawn from a pool **shaped by the hero's current
typing and Evolution history** (see Part 2 — an Evolution path steers future
offerings). The exact selection rule (weighted draw vs. authored per-level lists) is a
design detail to specify in `/data`; the invariant is that offerings are
**type-appropriate to what the hero currently is.**

---

# Part 2 — The Evolution system

## Trigger (current scope: a single flat level, uniform across the roster)

**Every hero Evolves at the same fixed level — `EVOLUTION_LEVEL` (currently 5,
`src/run/progression.ts`) — for the entire roster.** At that moment the player is
presented with a **choice of three paths**, each with different pros and cons.

> **Scope note, not a contradiction of `CLAUDE.md`.** `CLAUDE.md` describes evolution
> depth as varying by design — *Capstone = 0 Evolutions, Single = 1, Deep line = 2+*
> — with per-hero-authored trigger levels implied. This file's current
> implementation is a deliberately scoped-down first pass: **every hero gets exactly
> one Evolution, at the same uniform level, for now.** That's the "Single" shape
> applied uniformly rather than authored per hero. Per-hero trigger levels and
> multi-node Evolution lines (Capstone / Deep-line heroes) are **deferred, not
> abandoned** — the data model (`ProgressionTable.evolutions: EvolutionNode[]` per
> hero, ordered) already supports more than one node whenever that authoring work
> happens; only the "every hero's first node sits at the same flat level" constraint
> is the temporary part.

## The level-up that reaches EVOLUTION_LEVEL does not offer a move (LOCKED)

This is new behavior, not just a rename: **the level-up that brings a hero to
`EVOLUTION_LEVEL` replaces that level-up's move offer with the Evolution choice.** No
move is rolled or gained that level-up — the player picks a path instead. Below
`EVOLUTION_LEVEL`, level-ups behave exactly as Part 1 describes. Once evolved, level-ups
resume granting moves normally (or, if a later Evolution node exists for a Deep-line
hero, the same suppression applies again at that node's level).

> **Implemented (2026-08-16):** `src/run/progression.ts` `availableEvolution()` — the
> caller (`LevelUpScreen.tsx`) checks it immediately after every `levelUpHero()` call
> and skips the move roll entirely whenever it returns non-null.

## The three paths differ in kind, not degree (LOCKED)

An Evolution is **not** "pick how much to grow." The three paths take the hero in
**genuinely different directions** — a different role, a different type identity, a
different tool. Never author paths as tiered stat bumps of the same shape.

**Every path must carry a single identifiable name** — a proper noun the player
recognizes and remembers, the way Cinder's three paths might be named
**Explosive**, **Ironclad**, and **Thunderblaze**. The name, not the `kind` label
(`offensive` / `defensive` / `utility`), is what the player sees first and what the
build gets called in conversation about the run.

A path may grant any of:

- **A secondary type** (mono → dual, or a shift of the secondary slot), and/or
- **A stat grant** — always in **multiples of 5 or 10** (`progression.md`), and/or
- **An ability** (a passive or triggered effect).

Not every path changes typing — **staying mono is a valid path** and a valid terminal
identity. Typing usually shifts by *adding* a secondary (mono → dual), but a path may
also *replace* an already-granted secondary outright — e.g. a hero flavored around
"Iron Stone" might Evolve down an **Iron / Light** path instead of the expected
Iron / Stone, if that's the path chosen. This is the same secondary-slot-shift
mechanic `progression.md`'s "Type-graft paths" already specifies; it just means the
resulting pairing isn't always the "obvious" one implied by the hero's name or flavor.

The paths are authored per hero (each hero has its own set of three), consistent with
the authored-roster philosophy in `types-and-heroes.md`.

## The immutability nuance (reconciles with `types-and-heroes.md`)

`types-and-heroes.md` states a hero's innate type is immutable. Evolution paths do
change typing — so read the invariant precisely:

- **The innate PRIMARY type is immutable.** It is present in *every* path offered and
  never changes. (The Snowman below is Frost in all three options.)
- **The SECONDARY type slot is the Evolution branch axis.** A path may add or shift the
  secondary type; it never touches the primary.

So "type is immutable" means the **innate primary** is immutable — not that typing is
frozen. `types-and-heroes.md`'s "Hero authoring rules" now carries this
primary/secondary distinction rather than a flat "type never changes" claim.

## Worked example — Snowman (canonical; keep verbatim)

A **Mono Frost** "Snowman" hero reaches `EVOLUTION_LEVEL`. The three options:

- **Become Frost / Stone**, and gain **+30 Defense.**
  → the defensive/tank branch (secondary type + stat grant).
- **Stay Mono Frost**, and gain an **ability that summons Snow at the start of
  combat.**
  → the mono-utility branch (no type change, no stats — an ability instead).
- **Become Frost / Arcane**, and gain **+10 Intelligence and +10 Wisdom.**
  → the special-attacker pivot (secondary type + stat grant).

Note how the three differ **in kind**: a wall, a weather/utility enabler, and a
caster pivot — not three sizes of the same upgrade. Frost is retained in all three
(the immutable primary). All stat grants are multiples of 5/10.

> This example predates the "single identifiable name" rule above and hasn't had
> names authored for its three options yet (that's real content-design work, deferred
> to a future pass — see `types-and-heroes.md`'s open five-50/50-heroes note for the
> same kind of deferred content work). Keep the mechanical shape verbatim; add names
> when the Snowman's paths get finalized.
>
> The Snow-summon ability presupposes the **weather subsystem**, which is flagged
> 🔒 OPEN in `mana.md` (weather dependency). The example is canonical, but that
> option's ability can only be implemented once weather is signed off.

## Evolution steers future level-up offerings (LOCKED behavior)

Choosing an Evolution path **influences which moves are later offered on level-up.**
Branching into a new secondary type **opens that type's moves** for future level-up
offers — e.g. the **Frost / Arcane** Snowman will subsequently be offered **Arcane
attacks** it could not have received as Mono Frost.

This makes the Evolution choice compounding: it is not just an immediate package of
type/stats/ability, it **redirects the hero's whole future movepool** toward the
chosen identity. The path you *don't* pick does not open its offerings. (Whether the
retained primary's moves continue to be offered alongside the new type's — expected
yes — and the exact weighting are `/data` details to specify.)

---

## Data vs. rules

This module specifies **rules**. The following are **data** (`/data`), not doc content:

- Level-up counts awarded per encounter tier (normal vs. elite).
- Each hero's authored three-path Evolution (names, types, grants, abilities).
- Move offer pools / weighting per type and per Evolution path.
- **Deferred:** per-hero Evolution trigger levels and multi-node Evolution lines
  (Capstone / Deep-line depth) — not yet authorable; `EVOLUTION_LEVEL` is presently a
  single engine-level constant, not per-hero data. Promoting it to per-hero data (and
  allowing more than one ordered node) is the next scope expansion of this system, not
  a rule change — the `EvolutionNode[]`-per-hero shape is already there to support it.

## Cross-references

- `progression.md` — pooled currency framing, equipment, relics, raise-vs-recruit.
  **Its level-up/Evolution sections defer to this file.**
- `types-and-heroes.md` — the 15-type system and the primary/secondary immutability
  nuance above; mono as a valid terminal state.
- `combat.md` — how the resulting stats/moves resolve in a fight (stat pipeline, move
  resolution).
- `mana.md` — the weather subsystem the Snowman's Snow ability depends on (🔒 OPEN).
- `architecture.md` — Evolution/level-ups mutate **run state**, not combat state.
