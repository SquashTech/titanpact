# stat-scaling.md — Buffs and debuffs: scaled bases, the ceiling, the noise floor

> **STATUS: DRAFT 2026-09-14 (per user direction — option A of two, after a Pokémon-shaped
> stage system was weighed and set aside, §0). NOTHING IN §8 IS BUILT. The ceiling (§3, phase 2)
> is NOT decided — the designer is unsure it is needed at all; it stays in the doc as the
> proposal and §10 carries the case against it.** `CLAUDE.md` and
> `combat.md` describe the game in force wherever a §8 phase has not landed; §8 is the route
> and §9 the list of sign-offs each phase spends — **check its Status column before assuming
> anything here is live.** Every number below is a first pass unless it says otherwise; the
> design is the shape, and phase 5 is where the numbers get set.

---

## 0. Why this exists

A buff or debuff is the one magnitude in the game that does not scale. Heals read the caster's
Wisdom; a Burn reads the Attack or Intelligence its move swings with; a Renew reads Wisdom. A
+20 Attack is +20 Attack in Act 1 and +20 Attack in the finale, on a 30-Attack caster and a
105-Attack brawler alike. Three things follow from that, measured against the tree as of
2026-09-14 (69 authored `statDeltas` across `moves.ts`, `signatures.ts` and `classes.ts`,
base stats at their roster medians — Attack 60, Defense 55, Intelligence 40, Wisdom 46):

1. **A single cast can sit inside the dice.** Variance is 0.85–1.0, so a high roll is 1.18× a
   low one. Kindle (+20 Attack) on the median hero is ×1.33 — visible, barely. On the 90–105
   Attack heroes who would actually carry an Attack buff it is ×1.19–×1.22, and the modal
   debuff rider (−10 Defense: Molten Lash, Undertow, Corrode, Opening Strike) is ×1.22 on the
   median Defense. The player presses the button, the next number is a fifth bigger, and
   cannot tell the buff from the roll.
2. **A flat buff decays with the run, and this run levels hard.** An A-grade stat gains ~1.9
   points a level, so the median 60 is ~115 at 30; enemy lines walk `ACT_STEP_CURVE` up +390
   stat total by Act 5. Kindle goes from ×1.33 in Act 1 to ×1.17 in Act 5 with nothing on the
   card changing. A move the player learned to trust stops working and does not say so. The
   Early band of a type's slate is priced for Act 1; it is the same move in Act 4 at half
   the value.
3. **There is no ceiling.** `getEffectiveStat` floors every stat at 1 and caps nothing;
   `combat.md` lists "a cap on stat modifiers" and "a Haze verb" as the two open levers the
   Pact Clock was built beside rather than instead of. Apex Predator, Arcane Overflow and
   Brain Flay compound by design and the Clock is what ends them.

The slates already know all three. Frost Wall (+60 Defense to both), Storm Surge (+50/+50 to
both), Exalt (+100 Intelligence), Juggernaut (+50/+50/+50): the authors wanted a big moment and
had only a bigger number to write it with. And the Mastery pass left the weaker signatures
explicitly waiting on "a buff/debuff rework" (`mastery.md` §8, phase 4). This is that rework.

**The alternative set aside.** A stage system — ±3 steps, ×1.5 / ×2 / ×2.5 and their
reciprocals, capped — fixes all three at once and was the first proposal. It was set aside for
two reasons the designer weighed as real: a step is a discrete dial, and the slates use a
continuous one (a −15 against a −20, +10 Speed +10 Intelligence on one move, a rider priced at
exactly the fraction of the hit it rides); and **a flat buff helps a weak stat more than a
strong one** — +40 Defense on a 30-Defense glass cannon is +133%, where ×1.5 on the same hero
is a cantrip. "Buff the squishy" is a play the flat shape makes and the stage shape does not,
and it is worth keeping on purpose. So the numbers stay flat and stay authored, and what this
doc adds is the scaling every other magnitude already has, the ceiling `combat.md` already
asked for, and an authoring floor.

---

## 1. The rule this reduces to

**A buff is a rider, and riders scale with the caster.** The status-magnitude rule of
2026-09-05 (`CLAUDE.md`, `combat.md` "Scaled status magnitudes") already says it for DoTs and
HoTs: *the authored magnitude is a BASE; what lands is `authored × StatMult × STAB`.* This doc
extends that sentence to `statDeltas` and changes nothing else about it. The multiples-of-5
rule survives in the form the DoT rule already gave it: **authored bases are multiples of 5;
what lands is base × multiplier.**

The stat pipeline still produces only the ratio. A scaled delta is still a flat number added to
the stat, still in `statModifiers`, still read by `getEffectiveStat` as it is today. Nothing
here touches the damage pipeline, and no % term is added to any stat — the multiplier is
applied to the *grant*, once, at the moment it is authored into the fight.

---

## 2. The formula

    landed = round(authored × StatMult × STAB)
    StatMult = 1 + (casterStat − 50) / 100, clamped [0.5, 2.0]

The constants are the heal formula's and the status formula's — 50 is par, every point is 1% —
so the player still reads one rule. `magnitudeMultFromStat` (`src/engine/heal/healPipeline.ts`)
is the function; `resolveStatusMagnitudeFor` (`src/engine/status/statusMagnitude.ts`) is the
sibling this one is written beside. **Snapshotted at cast**, never re-read off whoever holds it,
exactly as a HoT is.

### Which stat is read

| Delta | Reads | Why |
|---|---|---|
| A **buff** (positive delta, on an ally or self) | the caster's **Wisdom** | The support stat, as a HoT's. Wisdom is the roster's flattest stat (35–80, median 46) and today buys only defence; this gives it a second job, and makes a high-Wisdom hero a better *buffer* than a brawler casting the same move — an archetype the roster does not have. |
| A **debuff** (negative delta, on an enemy) | the **offensive stat the move swings with** — Attack if physical, Intelligence if magical (`statKeysForMove`) | As a DoT's. A debuff is an attack that lands on a stat instead of HP, and a split slate keeps no trap-pick half. |
| A **self-debuff** as a COST | nothing — the authored figure lands | The self-Burn rule. A price has to be knowable before the button is pressed. No move authors one today; the rule is here for the first that does. |
| A **derived** delta (`derivedStatDeltas`: Apex Predator, Arcane Overflow) | nothing — already derived | It reads a live number; scaling it would scale a number the player is looking at. Unchanged; §3 is what reaches these. |
| A **passive's** `statDelta` effect (Entanglement's −10, Rime's +5s) | nothing — flat | Passive-applied magnitudes are flat today for the same reason: a passive has no move to take STAB from. Unchanged. |
| `conditionalStatGrants` (Bloodthirsty) | nothing — flat | Loadout-shaped and live; unchanged. |
| `mpRegen` (Mana Font's +10) | nothing — flat | MP Regen sits outside the 550 and outside every per-hero grant; a regen buff is a resource grant, not a ratio change. Exempt, and the only stat that is. |

**STAB applies** — ×1.25 when the move's type is one of the caster's — because the family
carries it and because it prices off-type coverage the way it is priced everywhere else: an
off-type buff is a natural pick, a fifth weaker, not a trap. A Class move wears its holder's
primary (`typeFollowsUser`), so a Class buff is always STAB.

**The sign decides, not the target.** Rising Static buffs a random ally and Conducts a random
enemy on one card; Landslide hits both enemies and buffs both allies; a rider on a hit debuffs
the thing it hit. Each delta is classed by its own sign, so a mixed move reads two stats and
that is correct — the buff half is support, the debuff half is offence.

**What the multiplier reaches.** `conditionalStatDeltas` (Prowl beside a Beast) multiplies the
AMOUNT, and the scaling multiplies that — one ×2 pack, one StatMult, one rounding.
`randomStatDeltas` (Overclock, Jury-Rig, Piston Punch) scales its `amount` the same way; which
stat is drawn is unchanged. `doublesStatReductions` (Brain Flay) doubles what has already
landed and reads no stat of its own — it doubles scaled figures, so it needs no clause.

### Worked numbers

Kindle, +20 Attack on self, cast by a Wisdom-40 Fire brawler: 20 × 0.9 × 1.25 = **+23**. Cast
by Crimson at Wisdom 75, on-type: 20 × 1.25 × 1.25 = **+31**. The same Kindle
at level 28 on a hero whose Wisdom has grown to 80: 20 × 1.3 × 1.25 = **+33** — against an
Attack that has grown to ~115, still ×1.28. Unscaled it would be ×1.17.

Weaken, −20 Defense / −20 Wisdom, cast by a magical Shadow hero at Intelligence 85: 20 × 1.35 ×
1.25 = **−34** each. The same Weaken from an off-type physical hero at Intelligence 25: 20 × 0.75
= **−15**. That spread — the dedicated debuffer at more than twice the dabbler — is the point.

The decay it leaves is real and should be said: `1 + (stat − 50)/100` does not double when the
stat doubles. A support hero's S-grade Wisdom going 55 → 110 moves the multiplier 1.05 → 1.6
while enemy Defense on the step curve roughly doubles — a +20 buff shifts the ratio by ~0.38 in
Act 1 and ~0.29 in Act 5, a quarter lost against half unscaled. The Late band's larger bases
(§4) carry the rest. A steeper constant for deltas alone (`stat / 50`, linear through the
origin, which tracks a doubling exactly) is §10's first dial; it is not the first choice
because it would be a second rule where the family has one.

---

## 3. The ceiling — UNDECIDED

> Not signed off. The designer's doubt is whether a cap is needed once deltas scale and the
> Pact Clock already brackets the stall; see §10 for the case each way. The shape below is
> what would be built IF phase 2 is taken, and phases 1, 3, 4 and 5 do not depend on it.

**A stat's fight modifier is clamped to `[−½S, +S]`, where `S = base + loadout`. A buff can at
most double a stat; a debuff can at most halve it.** One sentence, symmetric in the ratio (×2
against ×½, which is what the pipeline produces), and hero-relative — a 105-Attack brawler caps
at 210, a 30-Attack caster at 60, so buffing the caster's dump stat has a hard stop and the
specialist stays the specialist.

- **Clamped at WRITE, not at read.** `statModifiers[stat]` is clamped as the delta lands, so
  `StatChanged.delta` reports what actually landed, the view's arrows are honest, and
  `getEffectiveStat` is untouched. The event gains a `capped: boolean` so the view can say *at
  the limit* and a stat-reactive passive (Frozen Stone, Entanglement) still fires on the
  attempt. A delta that lands at 0 because the cap was already reached still emits — the
  player cast the move and should see why nothing happened.
- **`S` reads `baselineStatModifiers`** — equipment, Banners, Evolution and Class grants raise
  the ceiling with the base, which is what a loadout is for. Conditional and field-effect
  grants (Bloodthirsty, Verdant Earth) are read live in `getEffectiveStat` and sit outside the
  clamp; they add on top and the floor at 1 still holds.
- **The three compounders.** Apex Predator's "Attack equal to own Attack" IS `+S` when cast
  unbuffed — the cap binds it at exactly what it does today and stops the second cast. Brain
  Flay's doubling caps at `−½S` — a fully broken stat is a halved one, and the third Flay does
  nothing. Arcane Overflow reads a mana figure that can be 200+ against an Attack of 30–105, so
  it hits the cap on nearly every cast, and Font of Power's 150 past the pool is worth nothing
  to it above `+S`. That is a real cost to the Arcane slate's signature combo and §10 carries
  it; the mana still overflows and is still spendable, which is the combo's other half.
- **The Pact Clock stands.** The cap bounds setup; it does not bound a sustain stall, which is
  what the Clock is for. `combat.md`'s "a cap on stat modifiers" lever closes with this phase;
  "a Haze verb" stays open and becomes worth building, since a capped stat is a state a reset
  can answer (§10).
- **Speed and the floor.** Freeze's halving applies after the clamp, as it does after
  everything today; the floor at 1 is unchanged.

---

## 4. The noise floor, and the bands

Scaling holds a buff's *relative* size across the run — which means a buff inside the dice in
Act 1 stays inside them for thirty levels. That is an authoring rule, not a formula:

**A buff move's BODY is authored at ≥ 20; a delta RIDING a hit may go to 10; nothing is
authored at 5.** At the roster medians, 20 is ×1.33 on Attack, ×1.36 on Defense, ×1.5 on
Intelligence — outside the 1.18 variance band on every stat but Speed, which is ordering and
exempt from the argument. A rider is allowed under it because the hit is the body and the
rider is a tilt on the next one.

The bands are the authored bases, and the ones in the tree are already close:

| Band | Body base | Rider base | Today's spread |
|---|---|---|---|
| Early | 20–30 | 10 | Kindle 20, Sharpen 30, Weaken 20/20, Tide Guard **10** (both allies), Toughen Up **10/10** |
| Mid | 30–50 | 10–20 | Bastion 30, Study 60, Radiance 40, Enfeeble 30/30, Reinforce 20/20 |
| Late | 50–75 | 20–30 | Frost Wall 60, Storm Surge 50/50, Shadow Form 75, Exalt **100**, Break Will 50/50 |

**Entries under the floor (the migration, in full — everything else stands as its base):**
Toxic Spores −5 Speed → −10; Piston Punch's random 5 → 10; Tide Guard +10 Defense to both
allies → 15 (a two-target body may sit a rung under a one-target one, as the mana already
prices); Toughen Up 10/10 → 15/15; Iron Fist's +10 rider stands (a rider); Charge 10/10 stands
as an Early split. **Over the ceiling:** Exalt's +100 Intelligence exceeds `S` for every hero
under 100 Intelligence, so under §3 it reads as "to the cap" — which is what the card says.
Either author it as 75 and let the cap be the cap, or keep 100 as the one card whose number
is a promise the ceiling keeps. §10.

The Ancient slate is unauthored and inherits all of this. The signatures' first-pass numbers
(`mastery.md` §8 phase 4) get re-read against the bands in phase 3, which is the rework they
were waiting on.

---

## 5. What the fight feels like

- **The buffer is a role.** A Wisdom-80 support casting Bless hands +30 Intelligence, not +20;
  the same hero's Weaken off a 25-Intelligence body lands −15. Who casts the buff matters, and
  the hero sheet can say so.
- **The number the card shows is the number that lands.** `MoveTile` and `MoveDetailOverlay`
  print the scaled figure for the hero holding the tile, as they print a scaled Burn today
  (`resolveStatusMagnitudeFor`'s sibling, from a plain stat + type pair, so a level-up offer
  and a Tutor roll show it without a Combatant). The hero sheet's stat row shows
  `Attack 60 → 84` and the cap as a bar end. A pip strip under the sprite carries the sign
  and the tier — one, two, three marks, full at the cap — and a stat hitting the ceiling gets
  the status art's flash pair.
- **"At the limit" is a state.** A hero at `+S` Attack is a thing to switch for, debuff, or
  race; the second Sharpen does nothing and the card says so before it is pressed.
- **Buffing the squishy stays a play**, and the cap is hero-relative so it stays bounded: +40
  Defense on a 30-Defense hero is still +133%, and the third one is the wall.

---

## 6. Enemies and the AI

Enemies scale on the same formula off their own stats. A Late Titanspawn on the step curve
with a 100+ Intelligence lands a ×1.5 debuff; an Early one at 40 lands ×0.9. That is the
curve doing for enemy buffs what it already does for enemy hits, and it is why enemy bases
need no separate table.

The pilot values any `statDeltas` at a flat 15 utility (`scripts/sim/policy.ts`) and
`pilot.ts` reads the authored amount. Both read the landed figure after phase 1 and the cap
after phase 2, and the Titanspawn kits' buff moves get re-measured — a Guardian's escort
reaching `+S` in two casts is the kind of thing the sim finds first.

---

## 7. What changes in the tree

- `isValidFlatStatGrant`'s scope: it keeps binding every authored delta and every loadout
  grant, as `test/arcaneMoves.test.ts` pins; what LANDS is exempt, as a scaled Burn is.
- `StatChanged` carries `authored` and `landed` (and `capped`), so the view can show a +20 that
  arrived as +27 and a +27 that stopped at +12.
- `Combatant.statModifiers` keeps its shape — flat numbers, stored as today — so **no
  `SAVE_VERSION` bump in phases 1–2**; a mid-fight save carries landed figures either way.
- `combat.md` "Stat modifiers" gains the scaling and the ceiling; "Scaled status magnitudes"
  gains one line saying deltas are in the family. `CLAUDE.md`'s "no % stat mods" line is
  rewritten to the DoT rule's form (§9).
- Deleted: the "no ceiling" fact under "The floor" and the open lever it left.

---

## 8. Order of work

Sequenced so the tree is playable at every boundary and each phase can be refused alone.

| # | Phase | Exit criterion | Status |
|---|---|---|---|
| 1 | **The formula.** `scaleStatDelta` beside `scaleStatusMagnitude`, reading Wisdom for a buff and the move's offensive stat for a debuff, STAB, snapshot; wired into `resolveRound`'s delta loop (authored, random and pack-multiplied deltas; derived and passive deltas pass through); `StatChanged.authored / landed`; the tile and overlay print the landed figure for the holder. No content change. | Every authored delta lands at base × StatMult × STAB; `test/arcaneMoves` still passes on bases; the sim reports buff magnitude landed per act. | — |
| 2 | **The ceiling.** Clamp at write to `[−½S, +S]`; `capped` on the event; Apex Predator, Brain Flay and Arcane Overflow measured against it; the Font of Power decision (§10). **Separable — veto leaves phase 1 standing.** | No fight modifier outside the band on any combatant at any round; the three compounders' sim win-rate deltas reported. | **UNDECIDED** — the designer is unsure a cap is needed. Phase 1 ships first and measures how often a modifier would have exceeded `+S` (§10); that figure decides this row. |
| 3 | **The floor re-author.** §4's sub-floor entries; Exalt's decision; the signatures' deltas re-read against the bands; `test/moveTiers` (or a sibling) pins the body floor at 20 and forbids 5. | No authored body under 20, no delta of 5; the Ancient hand-off in `authoring-moves.md` §10 names the bands. | — |
| 4 | **Presentation.** The pip strip, the `→` on the hero sheet, the cap as a bar end, the flash pair on a cap hit, "at the limit" on the tile before the press. | A player can read a hero's modifier state from the fight screen without opening the sheet. | — |
| 5 | **Re-fit.** The AI's utility for a scaled delta and a capped one; a sim pass on the pilot against the pre-phase-1 baseline (full-clear 54%, Reader 77 / Auto 53 / Fast 32 min); the Act 1 wall re-read, since a buff above the noise floor is the kind of lever the wall has not been given; then the `stat / 50` dial if the Late-act decay reads as a fault in play. | Win-rate targets are a playtest question; the measurement is buffs' share of casts by act, and whether it rose. | — |

**What each phase measures.** Phase 1: the landed/authored ratio by act and by caster (is the
buffer archetype real, or is Wisdom too flat to make one?). Phase 2: how often the cap binds,
and on whom — if it binds on ordinary two-cast setup it is too low; if it never binds on Apex
Predator it is too high. Phase 3: nothing measurable; it is an authoring pass. Phase 5: whether
buffs are cast more, and whether the Act 1 wall moved.

---

## 9. Locked invariants this overturns

Each is a sign-off. In force until the phase that replaces it lands.

| Today (`CLAUDE.md` / `combat.md`) | Becomes | Phase |
|---|---|---|
| Stat modifiers are flat additive integers, multiples of 5 or 10. **No % stat mods.** | **Authored bases are multiples of 5; what lands is `base × StatMult × STAB`** — the status-magnitude rule's form. Still flat, still additive, still in the stat pipeline; the multiplier is on the grant, once, at cast. Loadout grants (equipment, Banners, Evolution, Class) stay exactly authored. | 1 |
| Two documented exemptions from the multiples-of-5 rule (derived grants, growth rolls); "a third should be a conversation, not a habit" | This is that conversation. Every in-fight delta lands unrounded-to-5; the rule binds what is authored. | 1 |
| Passive-applied magnitudes are flat — a passive has no move to take STAB from | **Held**, and extended to a passive's `statDelta` effect for the same reason. | 1 |
| A `dot` on self is a COST and never scales | **Held**, and a self-debuff delta is the same rule. | 1 |
| Stat modifiers have no ceiling; a cap is an open lever | **`[−½S, +S]`, clamped at write** — IF phase 2 is taken. Undecided; the lever stays open until it is. | 2 (undecided) |
| Apex Predator and Arcane Overflow are authored to compound deliberately | Only under phase 2: Apex Predator lands once at the cap; Arcane Overflow lands at the cap and the mana past it is spendable but grants nothing. | 2 (undecided) |
| `combat.md` "The floor": floors at 1 and never ceilings | Floors at 1, ceilings at `+S` — only under phase 2. | 2 (undecided) |

**Held, and worth saying so:** the two-pipeline separation (a scaled delta is still a stat, and
the damage pipeline never sees it); persist-on-switch (and the cap is what makes persistence
safe on a cycling game); the damage, heal and status formulas and their constants; the 550 and
28 budgets and every loadout rule; the Pact Clock; the one-decision-kind rule; "a bare number
never gets a screen" — a buff's landed figure is shown on a card, never chosen on one.

---

## 10. Open questions — DO NOT silently resolve

- **Whether there is a ceiling at all.** The designer's doubt, and it is a fair one. The case
  against: scaling already fixes the two findings that are about *feel*; the third (no cap) is a
  stall problem the Pact Clock already brackets; a cap is a rule the player has to learn and a
  moment ("nothing happened") the fight has to explain; and the compounders are three moves,
  which is a content question before it is an engine one. The case for: with scaling, a Late
  buff off a high-Wisdom caster is ×2 the authored base, so the *uncapped* numbers get bigger,
  not smaller; "at the limit" is a state a switch or a Haze can answer, and without one setup
  is answered only by racing it; and the Clock ends a stall at round 30, which is long after a
  two-cast setup has decided the fight. **Neither is settled by argument.** Phase 1 records,
  per fight, the largest modifier a stat reached as a fraction of `S` — if ordinary play
  rarely passes ×2 and only the three compounders do, the answer is to author those three and
  build no cap; if two casts of a Late buff routinely pass it, the cap is doing real work.
- **The constant.** `1 + (stat − 50)/100` under-tracks a run in which stats double; `stat / 50`
  tracks it exactly and is a second rule. Phase 5 decides from play, not from the arithmetic
  above, since the Late bases already carry most of the gap.
- **Font of Power under the cap.** Overflow's 150-past-the-pool is a mana combo first and an
  Attack combo second; with Arcane Overflow capped at `+S` the second half is gone. Options:
  accept it (the mana is the combo); let Overflow read mana into *both* stats at half rate so
  it caps later; or exempt derived grants from the ceiling, which reopens the stall the
  ceiling closes. Recommendation: accept, and watch the Arcane heroes in the phase-5 sim.
- **Exalt at 100.** A base above every hero's `S` is a card that says "to the cap". Keep it
  as the one such card, or author it at 75. Recommendation: keep — one card whose promise the
  ceiling keeps is a legible thing, twelve would not be.
- **Speed.** Scaling it buys nothing (a priority bracket's tiebreak is ordering, and ×1.5 and
  +20 carry the same information); exempting it is one more rule. Recommendation: uniform —
  scale it, cap it, say nothing special.
- **A Wisdom self-buff compounds** — Brain Ward raises the Wisdom the next Brain Ward reads.
  That is Renew's stacked-payoff shape and intended for the same reason; the cap bounds it.
  Flagged so it is not read as a fault when the sim finds it.
- **The Haze verb.** A cleanse that clears stat modifiers (Purify clears statuses, not
  modifiers) is one new effect primitive and the VGC-native answer to a capped setup. Not in
  §8 — it is content the ceiling makes worth authoring, and the type it belongs to (Light?
  Water? Mind?) is a slate decision.
- **Bloodthirsty.** The last in-fight flat grant. Held flat here as loadout-shaped; if the
  buffer archetype lands and a conditional grant reads as the odd one out, it is one line.

### Watch in playtest

Whether a player can *feel* who cast the buff — the archetype is the thing this buys over
stages, and if Wisdom's 35–80 spread is too flat to make it felt, the constant is the dial.
Whether the cap is reached in ordinary play or only by the compounders. Whether the Act 1 wall
moves at all — it has resisted every non-design lever so far, and a buff that shows up in the
damage number is a design lever.
