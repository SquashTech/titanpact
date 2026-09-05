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
`Arcane` · `Mind` · `Spirit` · `Iron` · `Mech` · `Beast` · `Ancient`

Each names a **power source**. (Full domain descriptions belong alongside the chart
in `/data`; the authoring rule above is what governs assignment.)

### Ancient is special (LOCKED)

`Ancient` is an intentional **near-total defensive wall** — it exists primarily on
**enemy** encounters and is **rarely draftable** by the player. Treat it as a
boss/threat type, not a standard roster option. Its chart row/column is deliberately
lopsided; that's a feature, not a tuning bug to "fix."

**The lopsidedness is purely defensive.** Ancient's *column* resists all 14 other
types (0.5× each — the fantasy is "almost impossible to burst down"). Its *attacker
row is empty*: **every Ancient attack resolves at exactly 1×**, super-effective
against nothing and resisted by nothing. It had a single `Ancient → Mech = 2` cell,
removed 2026-09-01 — it taxed one type for no design reason, and Ancient's threat is
meant to come from the length of the fight, not from an offensive edge. Do not add
offensive cells to that row.

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

## Known balance state

### The chart is authored (2026-09-01)

`typechart.ts` was a placeholder fixture for a long time — a minimal matrix built to
exercise the engine, carrying a "do not hand-tune this into *the* chart" banner. A
full designer pass promoted it. The banner is gone; the matrix in `/data` is now the
chart, and cells are tuned in place rather than replaced wholesale.

The pass added **15 cells** (2× cells 31 → 38, 0.5× 44 → 51; neutral cells 67% → 60%
of the matrix). It was motivated by the chart reading as *thin* — too many matchups
resolved to a flat 1×, so type identity wasn't doing enough work in a fight. Four
motifs carry the new cells, and new cells should extend one of them rather than
land ad hoc:

- **Magic vs. machine** — Arcane and Mech are a mutual 2× rivalry, deliberately the
  same shape as Light/Shadow.
- **The intangible** — Spirit resists Iron and can't reach Mech (no soul to touch);
  Arcane's binding wards are what *does* get through to it.
- **Sensors** — Mech hits what it can see, so Shadow resists it and Water gets in.
- **Instinct over intellect** — Beast resists Mind and hits it hard.

### Resolved: Nature and Beast's fragility

Both carried **three weaknesses with nothing compensating**, which made them hard to
justify drafting. Fixed from opposite directions:

- **Beast** gained a resistance — `Mind → Beast = 0.5`, instinct has no argument to
  lose. Now 3 weaknesses vs. 3 resistances.
- **Nature** gained a resistance *and* a weakness — `Storm → Nature = 0.5` (a forest
  grounds the lightning and breaks the wind) plus `Shadow → Nature = 2` (lightless
  rot). Now 4 vs. 4: not softened, but given more action in both directions, which
  was the point of the pass.

### Resolved: Light/Shadow over-resist

Light and Shadow used to resist each other (a mutual 0.5×), flagged as over-tuned
defensively. An earlier pass retuned them to **mutual 2× weakness** — they hit each
other hard rather than shrugging each other off — and gave each a shared weakness to
**Spirit**. That left them at 2 weaknesses vs. only **1** resistance, i.e. swung into
the opposite failure mode. The 2026-09-01 pass gave each a second resistance:
`Arcane → Light = 0.5` (consecration sheds woven spellcraft) and `Mech → Shadow = 0.5`
(sensors can't lock onto what won't be seen). Light also picked up a third weakness,
`Mind → Light = 2` — doubt unmakes conviction. That direction is the one arguable cell
in the pass: the opposite reading (conviction is precisely what shrugs off doubt) is
just as defensible, and it was taken this way because Mind was the chart's weakest
type and needed the offensive target. Watch it in playtest.

None of this is playtested yet. Adjust in `/data`, playtest, don't silently rewrite
the type philosophy to paper over a bad matchup.

---

## Blight

**Blight is not a type, and it no longer exists at all.** It was demoted to a
**cross-type status effect defined at the move-design layer** (a magnitude status,
cap 50%, lowering Attack/Defense/Intelligence/Wisdom multiplicatively in the stat
pipeline) — and then cut entirely in the 2026 status-system design review, for being
invisible/non-tactile: a player couldn't see or play around a stat percentage the way
they could a clock. **Poison** (`conditions.md`'s status catalog) replaces it: a visible
3-round timer with a visible payoff. Do not add a Blight row/column to the chart, and no
status currently sits in the stat pipeline at all — see `architecture.md` and
`conditions.md` §2.

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
The **one-starter-per-type** shape below is a consequence of the current fixture
roster, not a rule — but it is load-bearing enough that new heroes have been added
as recruit-only to preserve it (Widow and Coil, Beast, 2026-08-30). If a type ever
wants two draftable heroes, that should be a decision taken on purpose.

**Current fixture state (2026-08-17):** 14 starters give **one starter per type**
(every type except Ancient, which is intentionally near-undraftable per "Ancient is
special" above) — Cinder (Fire), Tidecaller (Water), Flurry (Frost),
Squall (Storm), Crag (Stone), Sylva (Nature), Solace (Light), Vesper
(Shadow), Glyph (Arcane), Cortex (Mind), Revenant (Spirit), Valor
(Iron), Clockwork (Mech), Pack Alpha (Beast). Warden is the roster's first
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

### The stat budget (LOCKED 2026-09-05)

Every hero's authored line spends **exactly 450 points** across seven stats — HP,
Attack, Defense, Intelligence, Wisdom, Speed, Mana. **MP Regen sits outside the
budget at a flat 10** for everyone; it is a tempo dial the equipment layer moves
(`STAT_POINT_VALUE` prices it at 3×), not a place to hide a hero's power level.
`test/roster.test.ts` pins both halves.

The budget is a *shape* rule, not a power rule. What it buys is that two heroes are
never separated by raw total — only by where they put it — so "which hero is
stronger" is always a question about the matchup and never about the sheet. A hero
that wants to be enormous somewhere has to be small somewhere else, and the roster's
extremes are authored that way on purpose: Bellows at **105 Attack / 5 Speed**, Cube
at **115 Defense / 10 Speed**, Squall and Widow at **100+ Speed** off 45-Defense
bodies. Coming in under 450 is not the way to signal a specialist — spiking one stat
past anything else in the roster is.

Before 2026-09-05 only the 14 starters were on budget and the 22 recruit-only heroes
ran 390–480. That gap read as "recruits are the weaker pool", which is exactly what
`starter: false` is *not* supposed to mean (see "Starters vs. recruit-only heroes").

**Lucius is mono-Mind** as of the same pass — a deliberate retype, not a graft.
Shadow/Mind was a dual typing doing the work an Evolution branch should do, and it
cost him every graft path (`chooseEvolutionPath` refuses a graft on a dual-typed
hero). Mono-Mind Lucius gets three branches back and **Voidcaller grafts Shadow**, so
the old pairing is now something the player chooses rather than something he is born
into. His pool follows the primary type; Weaken stays as the one Shadow keepsake.

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
