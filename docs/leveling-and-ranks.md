# leveling-and-ranks.md

> The authoritative spec for **how heroes grow**: the post-battle level-up grant, what
> a level-up does to a hero's movepool, and the rank-up branching system. This module
> supersedes the level-up / rank-up sections of `progression.md` — where they
> disagree, this file wins, and `progression.md` should be updated to defer here.
> Rules only; thresholds, move data, and per-hero rank branches are **data** (`/data`).

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

A level-up affects **only the hero's movepool**. Specifically, on level-up the hero
either:

- **Gains a new move**, if they have fewer than four; or
- Is offered the **option to replace one of their four existing moves** with a newly
  offered move, if they are already at the cap.

The player may **decline** a replacement and keep the current four — a level-up at cap
is an *offer*, not a forced overwrite.

### The four-move cap (LOCKED)

A hero holds a **maximum of four moves.** This is a hard cap. Once at four, growth in
the movepool is strictly *substitution*, never expansion.

> **Implemented (2026-08-16 playtest pass):** `src/run/progression.ts`'s
> `levelUpHero`/`grantLevelUpMove`/`MOVE_CAP` enforce exactly this — under the cap a
> level-up's move is gained outright; at the cap it's an accept/decline replacement
> offer (`src/view/run/LevelUpScreen.tsx`). **Fixture content now respects the cap
> too:** `/src/data/heroes.ts` starting kits were trimmed to 3 moves each (a
> low-power move of the hero's main type plus 1-2 support moves — heal/buff/status),
> leaving room to grow into the cap via level-ups instead of starting over it. Every
> fixture hero's `moveTiers` pool (`src/data/progression.ts`) was expanded to match, so
> a level-up's random draw has real variety across all 6 heroes, not just 2. Rank-up
> branches (Part 2, below) remain fixture content for only 2 of 6 heroes — a separate
> axis from the move pool, see README "Known gaps."

### Level-ups never change stats (LOCKED)

**Leveling up does not increase any stat.** No HP, no Attack, no Speed — nothing. A
level-up is a movepool event and only a movepool event. All stat growth happens at
**rank-up** (Part 2). This separation is what keeps a hero's raw power explained by
visible choices rather than an opaque level curve.

### Which moves are offered

The moves offered on level-up are drawn from a pool **shaped by the hero's current
typing and rank-up history** (see Part 2 — rank-ups steer future offerings). The exact
selection rule (weighted draw vs. authored per-level lists) is a design detail to
specify in `/data`; the invariant is that offerings are **type-appropriate to what the
hero currently is.**

---

# Part 2 — The rank-up system

## Trigger

When a hero reaches a **certain level threshold**, they **rank up**. At that moment the
player is presented with a **choice of three options**, each with different pros and
cons. (Threshold levels, and how many rank-ups a hero can undergo across a run, are
data — likely more than one rank tier; specify in `/data`.)

## The three options differ in kind, not degree (LOCKED)

A rank-up is **not** "pick how much to grow." The three options take the hero in
**genuinely different directions** — a different role, a different type identity, a
different tool. Never author rank branches as tiered stat bumps of the same shape.

An option may grant any of:

- **A secondary type** (mono → dual, or a shift of the secondary slot), and/or
- **A stat grant** — always in **multiples of 5 or 10** (`progression.md`), and/or
- **An ability** (a passive or triggered effect).

Not every option changes typing — **staying mono is a valid option** and a valid
terminal identity. The branches are authored per hero (each hero has its own set of
rank options), consistent with the authored-roster philosophy in `types-and-heroes.md`.

## The immutability nuance (reconciles with `types-and-heroes.md`)

`types-and-heroes.md` states a hero's innate type is immutable. Rank-ups do change
typing — so read the invariant precisely:

- **The innate PRIMARY type is immutable.** It is present in *every* rank option and
  never changes. (The Snowman below is Frost in all three options.)
- **The SECONDARY type slot is the rank-up branch axis.** Rank-ups add or shift the
  secondary type; they never touch the primary.

So "type is immutable" means the **innate primary** is immutable — not that typing is
frozen. Update `types-and-heroes.md`'s flat "rank-ups never change type" wording to
this primary/secondary distinction.

## Worked example — Snowman (canonical; keep verbatim)

A **Mono Frost** "Snowman" hero reaches its rank-up threshold. The three options:

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

> The Snow-summon ability presupposes the **weather subsystem**, which is flagged
> 🔒 OPEN in `mana.md` (weather dependency). The example is canonical, but that
> option's ability can only be implemented once weather is signed off.

## Rank-ups steer future level-up offerings (LOCKED behavior)

A rank-up **influences which moves are later offered on level-up.** Branching into a
new secondary type **opens that type's moves** for future level-up offers — e.g. the
**Frost / Arcane** Snowman will subsequently be offered **Arcane attacks** it could not
have received as Mono Frost.

This makes the rank-up choice compounding: it is not just an immediate package of
type/stats/ability, it **redirects the hero's whole future movepool** toward the
chosen identity. The branch you *don't* pick does not open its offerings. (Whether the
retained primary's moves continue to be offered alongside the new type's — expected
yes — and the exact weighting are `/data` details to specify.)

---

## Data vs. rules

This module specifies **rules**. The following are **data** (`/data`), not doc content:

- Level-up counts awarded per encounter tier (normal vs. elite).
- Rank-up level thresholds and the number of rank tiers per hero.
- Each hero's authored three-option rank branches (types, grants, abilities).
- Move offer pools / weighting per type and per rank path.

## Cross-references

- `progression.md` — pooled currency framing, equipment, relics, raise-vs-recruit.
  **Its level-up/rank-up sections defer to this file.**
- `types-and-heroes.md` — the 15-type system and the primary/secondary immutability
  nuance above; mono as a valid terminal state.
- `combat.md` — how the resulting stats/moves resolve in a fight (stat pipeline, move
  resolution).
- `mana.md` — the weather subsystem the Snowman's Snow ability depends on (🔒 OPEN).
- `architecture.md` — rank-ups/level-ups mutate **run state**, not combat state.
