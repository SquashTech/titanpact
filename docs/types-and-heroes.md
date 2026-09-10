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

### Resolved: Fire's early-game sweep (2026-09-09)

`Fire → Iron` dropped **2× → 1×**. Fire keeps Nature and Frost, so it now carries
two super-effective targets, the same as Stone, Iron, Spirit, Light and Nature.

The cell was not over-tuned in the abstract — Fire's chart profile was net +1,
tied with Water, Arcane, Spirit and Mech. It was over-tuned against the *factions*.
Every early faction is a mono-type family with a second type stapled on, and those
secondaries are overwhelmingly Nature, Iron and Frost — all three Fire-weak, and
dual types stack multiplicatively. Measured across the six early factions, Fire
answered **five of six** at a mean 1.55× where no other type cleared 1.35×, and
Crimson (the only mono-Fire starter) measured a **+3.90 encounter draft lift**
against a next-best of +1.33. Ablating Crimson's whole support kit moved that to
+4.30 — it was never the kit.

Of the four candidate cells measured, this is the only one that moved the number:
Crimson's offensive coverage 1.54 → 1.20, which puts Storm (1.35) and Mech (1.28)
ahead of it. Adding a new weakness to Fire, or a new resistance against it, both
measured as near-no-ops, because the problem was never what Fire *takes*.

It is also the cell the type filter argues for. "Fire melts iron" is a reading of
what a body is *made of*; Iron as a **domain** is armament and discipline, which
fire has no particular claim on. See the banner at the top of this file.

**What it costs, explicitly:** the Raiders are a mono-Iron warband whose design
prices that spine at being weak to Fire, Storm and Mech. That price is now paid by
two types rather than three (`test/raiders.test.ts`). Storm Coast has the highest
act-2 Guardian clear rate of the five, so it has the room — but this is the thing
to watch if act 2 gets harder.

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

### The stat total (LOCKED 2026-09-09)

Every hero's authored line sums to **exactly 550 at face value** across seven stats —
HP, Attack, Defense, Intelligence, Wisdom, Speed, Mana — with **HP counted at 1:1**
like everything else. **MP Regen sits outside the total at a flat 10** for everyone;
it is a tempo dial the equipment layer moves (`STAT_POINT_VALUE` prices it at 3×), not
a place to hide a hero's power level. `heroStatTotal` in `src/run/statBudget.ts` is the
one definition; `test/roster.test.ts` pins both halves.

**550 is the number the hero sheet already shows.** The Stat Total row on `StatBars`
sums exactly these seven, so the rule is checkable by the player and not just by the
repo — which is the whole reason it is face value. It replaced a 450 budget that
priced HP at 0.5, under which two on-budget heroes could read 530 and 590 on screen
with nothing to explain the gap.

The total is a *shape* rule, not a power rule. What it buys is that two heroes are
never separated by raw total — only by where they put it — so "which hero is
stronger" is always a question about the matchup and never about the sheet. A hero
that wants to be enormous somewhere has to be small somewhere else, and the roster's
extremes are authored that way on purpose: Bellows at **105 Attack / 5 Speed**, Cube
at **115 Defense / 10 Speed**, Squall and Widow at **100+ Speed** off 45-Defense
bodies. Coming in under 550 is not the way to signal a specialist — spiking one stat
past anything else in the roster is.

The 2026-09-09 re-base paid its bill **out of HP** and left **Speed untouched on every
hero**, so no priority order moved. HP now costs three times what it costs an enemy
line, and the roster's HP range compressed from 160–300 to **180–250** in consequence
— an accepted, measured cost, not an oversight (`docs/progression.md` "Pricing HP").

Before 2026-09-05 only the 14 starters were on budget and the 22 recruit-only heroes
ran 390–480. That gap read as "recruits are the weaker pool", which is exactly what
`starter: false` is *not* supposed to mean (see "Starters vs. recruit-only heroes").

**Lucius is mono-Mind** as of the same pass — a deliberate retype of the authored
hero, not an in-run graft. Shadow/Mind was a dual typing doing the work an Evolution
branch should do. Mono-Mind Lucius gets three branches and **Voidcaller grafts
Shadow**, so the old pairing is something the player chooses rather than something he
is born into. His pool follows the primary type; Weaken stays as the one Shadow
keepsake.

This still holds now that a dual hero *can* trade its secondary in-run
(`leveling-and-ranks.md` "The RETYPE"): a mono hero is offered two grafts and a mono
path, a dual hero one retype. Born dual is no longer a tax on Evolution, but it is
still less branching than born mono — so the choice between the two is a real
authoring decision, not a default.

### Growth grades — the second budget (2026-09-10)

Every hero also authors a **growth grade per stat**, and those seven sum to
**exactly `GRADE_BUDGET` = 28** (`src/run/growth.ts`; pinned in `test/roster.test.ts`
directly beneath the 550). The 550 stops being sufficient to say a hero is fairly
costed the moment growth exists — a low base with S grades outruns a high base with F
grades however the 550 is spent. Grades cover the same seven stats the total covers;
MP Regen is outside both.

**A grade line is a shape, never a size.** A grade's success chance is exactly
`0.05 + 0.15 × cost` — linear, no rounding — so any line summing to 28 buys the same
**4.55 successes a level** whatever its shape. "This hero grows more" is not an
authorable property. Only *placement* is, and that is the whole Est/Oifey axis:

| | Where the budget goes | Reads as |
|---|---|---|
| **Late bloomer** | the stat it swings with, plus Speed — growth compounds through the damage ratio | behind early, ahead late; Riptide's hedged 55/59 resolves upward into a fast caster, Pincer's 80 Attack ends at 135 behind its 90 Defense |
| **Front-loaded** | bulk, Wisdom or mana; the drafted spike is held at B or C | strong the hour you get it, changes character rather than scales — Bellows, Marrow, Runescribe |

Two rules bound both, and they are what keep the second budget honest:

- **A dump stat stays dumped (E/F).** It is what the 550 charged for, and growth must
  not quietly refund it. A pure physical hero's Intelligence and a pure caster's
  Attack are where the budget is found.
- **A stat a hero genuinely swings or defends with never goes below C.** The first
  draft of this pass gave Tempest an F in Defense and measured it straight into
  trap-pick territory (draft lift −1.99 → −3.23 against the all-B baseline), which the
  north star forbids. Nightshade had the same fault and the same fix.

The late bloomer is the archetype the pass exists to create. The Guild Hall pool is
exactly the `starter: false` heroes, and a hire arrives an act behind
(`guildHallLevel`) — so an underlevelled hire is a *downside* unless its grades make
the levels it has left worth more than the ones it missed. That is a decision the
player can only make by reading the grades, which is why `StatBars` renders the letter
column on the hero sheet and the Guild Hall preview.

Measured cost of the pass, same 1000-run batch either side: full-clear **29.6% →
35.6%**. The player side gained because a targeted line spends the same budget on
stats the hero actually uses, where all-B spent a seventh of it on a caster's Attack.
Enemies take no growth rolls at all, so the lift lands on the player alone — if the
run wants to come back down, `ACT_STEP_CURVE` is the one knob
(`docs/run-loop.md`), not the grades.

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
