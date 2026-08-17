# types-and-heroes.md

> The 15-type elemental system, how effectiveness resolves, the roster model, and the
> rules for authoring heroes. The **type chart itself (the 15×15 matrix) is data** and
> lives in `/data/typechart.ts` — this doc specifies how it behaves and what's known
> to be mistuned, not the individual cells.

## The foundational principle: type = power source

**A hero's type is the domain their power draws from — not what their body is made
of.** This is the single most important authoring filter in the project. It's what
collapsed the roster from an incoherent body-descriptor mess ("it's a rock, so
Stone") into a coherent 15-type system.

Author every hero by asking *where does this hero's power come from?*, not *what is
this hero physically?* A knight whose strength is divine conviction is **Light**, not
**Iron**, even in plate armor. Apply this filter first, always.

---

## The 15 types

`Fire` · `Water` · `Frost` · `Storm` · `Stone` · `Nature` · `Light` · `Shadow` ·
`Arcane` · `Mind` · `Spirit` · `Iron` · `Forge` · `Beast` · `Ancient`

Each names a **power source**. (Full domain descriptions belong alongside the chart
in `/data`; the authoring rule above is what governs assignment.)

### Ancient is special (LOCKED)

`Ancient` is an intentional **near-total defensive wall** — it exists primarily on
**enemy** encounters and is **rarely draftable** by the player. Treat it as a
boss/threat type, not a standard roster option. Its chart row/column is deliberately
lopsided; that's a feature, not a tuning bug to "fix."

---

## Effectiveness resolution

- Effectiveness comes from the chart and feeds `TypeMult` in the damage formula
  (`combat.md`).
- **Dual-type effectiveness stacks multiplicatively.** A move that is 2× against each
  of a target's two types resolves to **4×**; 0.5× against each resolves to the
  floor.
- **Range (LOCKED — 2026-08-15 designer sign-off): up to 4×, down to a 0.25× floor,
  no hard immunities.** No type-chart cell should ever be authored as a true 0× —
  every matchup stays chippable by something. `typeMult.ts TYPE_MULT_FLOOR` enforces
  the clamp.

### STAB

**STAB = 1.25×** when a move's type matches one of the user's types (`combat.md`).
For a dual-type hero, a move matching *either* type gets STAB (it does not double for
matching both — STAB is a single 1.25× term).

---

## Known balance state (NOT yet resolved — these are tracked tuning issues)

The chart is playable but knowingly mistuned in these spots. Carry these forward as
open tuning work, not as settled values:

- **Nature and Beast are fragile** — each currently carries **three weaknesses**,
  which makes them hard to justify drafting.

These are balance-tuning items, not structural changes. Adjust in `/data`, playtest,
don't silently rewrite the type philosophy to paper over them.

### Resolved: Light/Shadow over-resist

Light and Shadow used to resist each other (a mutual 0.5×), which was flagged above
as over-tuned defensively. A chart pass retuned them to **mutual 2× weakness**
instead — Light and Shadow now hit each other hard rather than shrugging each other
off — and gave each a shared weakness to **Spirit** (2×). Net profile for both is now
2 weaknesses vs. 1 resistance (Light resists Fire; Shadow resists Mind), so this is no
longer an over-resist problem. Not yet playtested at this new setting — watch whether
it swings the other way into fragility, the same failure mode Nature/Beast already
have.

---

## Blight

**Blight is not a type.** It was demoted to a **cross-type status effect defined at
the move-design layer.** Do not add a Blight row/column to the chart. It's implemented
per `conditions.md`'s status catalog: a magnitude status (cap 50%) that lowers
Attack/Defense/Intelligence/Wisdom multiplicatively in the stat pipeline — see
`architecture.md` and `conditions.md` §2. The sixth engine contract (condition/status
vocabulary) that Blight depended on is now implemented (`src/engine/combat/statusEngine.ts`).

---

## The roster model

- **Hard cap of 6 heroes** on a team.
- Doubles is played as **bring-6-pick-4**: you build up to 6, and each fight fields 4
  (2 active + 2 benched). This sideboard structure is the strategic layer above
  individual fights.
- Switching/bench/lock-in mechanics are in `combat.md`; how heroes are acquired and
  developed is in `progression.md`.

### Starters vs. recruit-only heroes

Every hero carries a `starter: boolean` (`HeroDefinition.starter`, `src/data/heroes.ts`)
— the single source of truth for which of the two acquisition paths a hero belongs to:

- **`starter: true`** — offered as a candidate in the start-of-run draft
  (`src/run/draft.ts`, `DraftScreen`: pick 2 of 4 random starter candidates).
- **`starter: false`** — **recruit-only**. Never appears in the draft; exists in the
  game solely as a Guild Hall offer or a Recruit Contract catch (`progression.md`
  "The raise-vs-recruit axis"). `src/data/recruitment.ts`'s Guild Hall offer pool is
  *derived* from `starter: false` heroes, not hand-maintained, so the two pools can
  never drift apart.

A hero is in exactly one pool, never both, and never neither. This split is
independent of type coverage — a type can have both a starter and a recruit-only
hero (Iron currently does: Valor starts, Warden is recruit-only), and recruit-only
status says nothing about a hero's power level, just where you first meet them.

**Current fixture state (2026-08-17):** 14 starters give **one starter per type**
(every type except Ancient, which is intentionally near-undraftable per "Ancient is
special" above) — Cinder (Fire), Tidecaller (Water), The Abominable (Frost),
Squall (Storm), Crag (Stone), Sylva (Nature), Solace (Light), Vesper
(Shadow), Glyph (Arcane), Cortex (Mind), Revenant (Spirit), Valor
(Iron), Vulcan (Forge), Pack Alpha (Beast). Warden is the roster's first
recruit-only hero — kept in the game, pulled out of the draft so Iron's starter slot
is Valor instead. Expect the recruit-only list to grow as more of the authored
53-hero roster is added; this is the seed of that split, not the finished shape of it.

---

## Hero authoring rules (LOCKED)

- **Apply the power-source filter first** (top of this doc) to assign type.
- **The innate PRIMARY type is immutable.** Progression never changes it — it's
  present across every Evolution path a hero is ever offered. **The SECONDARY type
  slot is the Evolution branch axis**: an Evolution path may add or shift it, but
  never touch the primary (`docs/leveling-and-ranks.md` "The immutability nuance" —
  the authoritative spec for how this works; `progression.md` "Type-graft paths" is
  being reconciled with it, see that section's note).
- **Mono is a valid terminal state.** A mono-type hero that never gains a second type
  is a legitimate, finished design identity — not an unfinished or "larval" one.
  Don't treat dual-typing as the goal state every hero climbs toward.
- **Type authoring is not archetype authoring.** Team archetypes must **emerge from
  content** (movepools, abilities, equipment, relics), not be pre-specified. Don't
  bake archetype assumptions into type or hero definitions.

### The authored roster

Eight authored heroes exist in the prototype with full type coverage. Their concrete
stat lines, typings, and movepools are **data** (`/data/heroes.ts`) — this doc governs
the rules they're authored under, not their individual values.

> 🔒 **OPEN — do not resolve without designer sign-off.**
> **Five heroes have unresolved (50/50) typings:** Giant Lobster, Solace, Crystal
> Guardian, Hellhound, Artificer. Each is a genuine coin-flip between two power-source
> readings and must not be assigned a type unilaterally — run each through the
> power-source filter *with the designer* and lock it deliberately. Leave them
> explicitly flagged in `/data` until then.
