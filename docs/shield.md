# shield.md — Shield: bonus health, off Defense

> **STATUS: BUILT AND MEASURED (decided 2026-09-14 per user direction, built 2026-09-15).** The six
> decisions in §3 are the designer's (the cap at 100% of max HP over the proposed 50%). §8 names
> where the build departed from the text and what was measured; the bases and the cap are the
> designer's to move. Every number below is a first pass unless it says otherwise.

---

## 0. Why this exists

Two threads met on the same day.

**Defense has one job.** After `stat-scaling.md`, every stat but one does two things: Attack and
Intelligence swing hits *and* scale the DoTs and debuffs of their category; Wisdom shrinks magical
hits *and* scales every heal, HoT and buff; Speed orders everything. Defense shrinks physical hits.
That is not even the larger half — the move catalog is 94 physical to 133 magical — and it is
the reason a Defense-heavy hero reads as "takes hits" where a Wisdom-heavy one reads as "a
healer, a buffer, a wall against casters". The roster tilts physical (20 swingers to 12 magical,
4 mixed), which is why it has not *felt* dead; the scaling overhaul handed Wisdom its third and
fourth jobs and gave Defense nothing. Two Stone moves already swing *with* Defense
(`offStatOverride`: Body Blow, Body Crush) — the slates were reaching for a second job before
anyone named the problem.

**A seat was held.** `authoring-moves.md` §10 lists *"Protect / shield / damage negation"* among
the shapes deliberately left unbuilt — "a redirect now exists (Provoke), but that moves a hit,
it does not stop one" — and the designer's early brainstorm had a **Shield** that works as bonus
health. Bonus health that scales off Defense is the same sentence the game already says four
times: *a magnitude the caster's stat scales, on the heal formula's constants*. Heals off Wisdom,
Burns off the attacking stat, buffs off Wisdom, **Shield off Defense**. One more stat in the seat
of a rule the player already reads, not a new rule.

---

## 1. The rule this reduces to

**A Shield is HP that is not yours yet: it is taken from before HP is, it scales off the caster's
Defense as a heal scales off Wisdom, it lasts until it is broken, and it can never hold more than
the hero's own max HP.**

Everything below is that sentence made precise.

---

## 2. The status

`Shield` is a **magnitude-shape status** with its own pipeline, `'shield'`, beside `dot` and
`hot` (`StatusDefinition.pipeline`, `src/engine/content.ts`). Its magnitude is a pool of HP.

    magnitude = round(authored × DefMult × STAB)
    DefMult   = 1 + (casterDefense − 50) / 100, clamped [0.5, 2.0]

The heal formula's constants, the heal formula's clamp, Defense in Wisdom's seat — `magnitudeStatKey`
in `statusMagnitude.ts` has a third arm (`hot → wisdom`, `dot → the move's offensive stat`,
**`shield → defense`**) and `magnitudeScales` admits the pipeline. A Shield on self is a benefit
and scales like a HoT on self. **Snapshotted at application**: the pool is what the caster's
Defense made it at cast, and the holder's Defense never re-sizes it. A 100-Defense tank shields
for ×1.5; a 32-Defense caster for ×0.82. That is Defense's support job, and it makes a
Defense-heavy hero a *guardian* the way a Wisdom-heavy one is a healer.

Definition, as `src/data/statuses.ts` carries it:

| Field | Value | Why |
|---|---|---|
| `shape` | `magnitude` | The pool is the number. |
| `pipeline` | `'shield'` | Read at the HP-loss chokepoint (§4) and nowhere else. |
| `ticksAtEndOfRound` | `false` | It does nothing on the clock. |
| `decay` | `'none'` | Until broken (§3.1); it does not leak. |
| `stacking` | `'additive'`, **capped** | A second Shield adds to the first up to the cap (§3.1); the engine's additive stacking with a per-holder ceiling, which is one new clause on `applyStatus`. |
| `clearsOnSwitch` | `false` | Bonus health leaves with the hero and comes back with it — it is "not yours yet", not "this round's". The cap is what keeps that from being a bank (§3.1). |
| `positive` | `true` | Never stripped by Cleanse; a foe removes it by hitting it. |
| `activeOnly` | — | No tick to skip. |

**Cap: a hero's Shield never exceeds its max HP** (`getMaxHp`, so loadout HP counts). A Shield
that would pass it lands the rest of the way and says *can't go any higher* — the band vocabulary
`stat-scaling.md` gave stats, reused verbatim, since a pool that stops growing is the same moment
as a stat that does. The designer set the cap at 100% over the proposed 50%: a fully shielded
hero has twice its health to chew through, which is a real wall and a real target for the
counterplay in §3.2.

---

## 3. The six decisions

Each was put to the designer with a recommendation and an alternative; all six are decided.

### 3.1 Until broken, with a cap — not timed

A Shield lasts until damage empties it; nothing else ends it. The risk named was banking:
shield both allies, switch out, come back still shielded, repeat — the stall the Pact Clock
brackets. The answer is the cap, not a timer: **Shield ≤ max HP**, additive up to it, then held. A
timer would have made Shield a Barrier with a number; the cap keeps it bonus health. *Decided:
the cap at 100% of max HP.*

### 3.2 Hits only — DoTs, the Clock and costs go through

A Shield is taken from by **a move's hit** and nothing else. The category `combat.md` already
has — *direct HP loss: no Defense, no type chart, no variance, no passive reaction pass* — gains
a third reading: **no Shield**. So a Burn tick, a Bleed tick, the Pact Clock, a self-cost (Soul
Offering's 25%), recoil, a passive's own damage, all go straight to HP under a full Shield. That
is the consistent reading (they already ignore Defense, and the Shield is Defense's), and it hands
the game a clean anti-Shield answer: **Burn and Bleed through a wall.** Nature, Fire and Beast
get a job against Iron and Stone. A detonation (Conduct's burst) rides a hit and is absorbed with
it; drain reads what the hit did to HP, not to the Shield (§4). *Decided.*

### 3.3 An absorbed hit still counts as a hit

For everything downstream — a passive that reacts to *taking a hit*, `damageTakenSinceLastTurn`,
the Battle Log — the hit landed and did what got through. `DamageDealt.amount` stays what HP
lost; a new `absorbed` field carries what the Shield took, and a Shield emptied by the hit emits
`StatusRemoved` with reason `'broken'`. A hit fully absorbed is a `DamageDealt` of 0 with
`absorbed` = the hit: the figure the player sees is *absorbed 40*, never a silent nothing.
*Decided.*

### 3.4 Heals and Shields do not talk

A Shield does not fill missing HP (`missingHp` reads HP alone); a heal does not become Shield.
*Decided.* The one exception since 2026-09-28 is a field: under **Verdant Earth** a Renew's
overheal becomes Shield (`docs/blessings-and-statuses.md` §5); outside it, the rule stands.

### 3.5 The moves: two converts and a handful of new ones

Two existing buffs read better as Shields than as the Defense they grant, and converting them
gives the mechanic a home in two slates the day it lands:

| Move | Was | Now |
|---|---|---|
| **Tide Guard** (Water, Early, both allies, 15 mana) | +15 Defense both | **Shield 20 on both allies** — a standing swell that takes the first hit |
| **Bastion** (Stone, Mid, both allies, 40 mana) | +30 Defense both | **Shield 45 on both allies** — both heroes set their feet |

The new ones, one per slate that carries Defense as an identity, each a distinct verb so the
mechanic is not five copies of one card. Bases are authored at par (a 50-Defense caster off-type
lands the figure as written) against roster HP of 180–250; a Shield's band is the buff body's
(Early 20–30, Mid 30–50, Late 50–75, `stat-scaling.md` §4) read as a fraction of a Mid hero's
HP (roughly a tenth, a fifth, a third):

| Move | Slate, tier | Target | Base | The verb |
|---|---|---|---|---|
| **Iron Skin** | Iron, Early | self | 30 | The plain one: the tank shields itself and swings next round. |
| **Vigil** (authored as *Sanctuary*; renamed at build — Sanctuary is Light's field effect and Halo an Evolution path) | Light, Early | single ally | 25 + Renew 10 | A Shield and a HoT on one card — the healer's version, both halves off its own stats (Defense, Wisdom), so a Light hero with both reads as the best support in the roster and one with only Wisdom reads as a healer who can shield a little. |
| **Ice Shell** | Frost, Mid | single ally | 50 | Bigger, single target, and the hit that breaks it Freezes the striker (a `trigger` on `'broken'` — one new clause, §4). The reason to hit *around* a Frost Shield. |
| **Rampart** | Stone, Late | both allies | 65 | The wall. Late-priced, both allies, the biggest pool on the table — the card that makes Stone the Shield type the way Light is the heal type. |
| **Living Wall** | Iron, Mid | self, then switch | 40 | Shield self and pivot out (`switchesUserOut`): the Shield goes to the bench with the hero and comes back — the one card that spends §3.1's "leaves with the hero" on purpose. |

**Two more Water cards, 2026-09-15 (per user direction), so the Mid and Late Water spawn can shield:** **Crest** (Mid, magical damage 45 on one foe, Shield 25 on self, 40 mana — the hit reads Intelligence and the pool Defense, the one card that swings and shields) and **Seawall** (Late, Shield 70 on one ally and a full cleanse, 50 mana — the biggest single pool, on Water's cleanse verb). Seated in Tidecaller's and Pincer's pools and the Rillfin's and Breakwater's kits (for Engulf and High Tide). Measured on the same seed: full-clear 22.5 → 22.8%, acts inside noise; player casts per 1000 turns Crest 2.6, Seawall 1.0; the Breakwater takes 123 → 110 a round. **And two more, same day, for the Sleetling and the Lanternmoth:** **Rime Coat** (Frost Early, Shield 30 on one ally, 20 mana — the plain single-ally pool, no shell) and **Benediction** (Light Mid, heal 30 and Shield 25 on both allies, 50 mana — a mend now off Wisdom and a hit held later off Defense, the heal-kind Shield). Seated in the Frost and Light heroes' pools and the two kits (for Ice Shard and Blinding Flash). Measured: full-clear 22.8 → 22.5%, acts inside noise; player casts per 1000 turns Rime Coat 3.0, Benediction 2.0.

Nine new, two converted, in five slates. **Not** in Wisdom's slates — Mind, Spirit, Arcane
carry the buffs and heals; a Shield there would be Wisdom doing Defense's new job. Each new move
is authored on the runbook (`authoring-moves.md`) with a slate test; the converts kept their
seats. *Decided.*

### 3.6 The AI and the pilot price it as a guard

Both already price a Barrier at what the far side would otherwise have landed on the holder;
a Shield is that with a number: `min(shield, incoming over the horizon)`. The AI's inertness
rule gains one clause — a Shield on a hero already at the cap is a no-op (§3.1's *can't go any
higher*), the same clause a capped stat got. *Decided.*

---

## 4. The engine seam

**One chokepoint.** Every HP loss in the engine passes through `applyHpDelta`
(`src/engine/combat/faintHandling.ts`) — the move's hit (`resolveRound.ts:366`), the detonate
bonus (`:423`), recoil (`:472`), the self-cost (`:816`), DoT ticks and detonations
(`statusEngine.ts:147`, `:319`), the Pact Clock (`pactClock.ts:66`), a passive's own damage
(`passiveEngine.ts:208`), and potions. The absorb sits **there**, gated on a new argument —
`source: 'hit' | 'direct'` — so §3.2 is one parameter at each call site and not a rule spread
across eight files (the line numbers above are as of the build). `'hit'` at the move's hit and the detonate bonus; `'direct'` everywhere else,
which is also the default, so a call site nobody updated is direct and a Shield never silently
absorbs something it should not.

Inside `applyHpDelta` with `source: 'hit'` and a Shield held: `absorbed = min(shield, −delta)`,
the Shield's magnitude drops by it, the remainder goes to HP as today, and the return carries
`absorbed` for the caller to put on its `DamageDealt`. A Shield at 0 is removed with
`StatusRemoved { reason: 'broken' }` before the HP change is applied, so a *broken* trigger
(§3.5's Ice Shell) fires on the striker with the hit already resolved.

**Drain** (`resolveRound.ts:401`) reads `damageDealt`, which is what HP lost — a drain through a
Shield heals for what got through, which is the honest reading. **Retribution** reads
`damageTakenSinceLastTurn`, likewise HP only.

**Stacking with a cap** is the one clause in `applyStatus` (`statusEngine.ts`): for a
`'shield'` pipeline, `magnitude = min(existing + incoming, getMaxHp(holder))`, and the
`StatusApplied` event gains `capped: true` when the cap took some — the same field, the same
word, as `StatChanged`.

**A trigger on `'broken'`**: Ice Shell's Freeze-the-striker is a rider on the *status* rather
than the move, fired by the removal reason (built as `onShieldBroken`, §8) — a Shield that
punishes being broken is the one that creates a decision on the other side of the board.

**No change to the damage pipeline.** The hit is computed in full — ratio, chart, variance, crit,
every modifier — and only then absorbed. `docs/combat.md`'s two-pipeline rule is untouched; the
Shield is an HP-side fact, not a damage term. The `DamageDealt` event's formula fields describe
the hit as computed; `amount` is what reached HP; `absorbed` is the difference.

**On a physical hit Defense counts twice** — it shrank the hit, then it sized the pool. That is
the point, not a bug: it is the mirror of Wisdom scaling a heal that then patches a physical hit.
But it means the physical/magical split of the *enemy* pool decides how good a tank feels; §8
"Measured" has the split.

---

## 5. What the fight feels like

- **The bar.** A Shield draws as a segment past the HP fill in the bar's own track — the fill is
  green, the Shield a pale band after it, the track's length still max HP so a full Shield on a
  full hero reads as a bar that is *twice full*. The `HP 180/220` label gains `+40` in the
  Shield's tone. On the combatant card and the hero sheet alike.
- **The hit.** *absorbed 40* rises off the figure in the Shield's tone where a damage number
  would; a hit that gets through shows both — *absorbed 40 · 12* — and the Shield segment
  shrinks; a hit that breaks it flashes the segment out and the popup says *Shield broken*.
- **The cast.** *Shield 45* on the receiving figure, the way *Renew 20* does, in the status art's
  popup/flash pair; the segment grows to meet it.
- **Before the press.** The move card prints the figure for the caster (`riderMagnitude`'s path,
  since a Shield is a rider), and — with a live board — *X's Shield can't go any higher* when the
  cap would take it, the stat-scaling card's sentence.
- **The status chip** on the card and the sheet: the Shield glyph with its pool, tappable to the
  status dossier that says what goes through it (§3.2), since that is the thing a player has to
  learn once.

---

## 6. Enemies

Titanspawn kits are drawn from the type slates, so an Iron, Stone, Water, Frost or Light spawn
holding one of §3.5's moves shields the way a hero does, off its own Defense — a high-level Late
Stone spawn shields for up to ×2. That is the curve doing to enemy Shields what it does to enemy
hits, and the reason a player needs the §3.2 answer in the bag by Act 4. `masteryForAct` and the
schedules are untouched: a Shield move is a move.

---

## 7. What is deleted or changed

Done at the build: Tide Guard's and Bastion's Defense grants became Shield applications (their
slate tests re-pinned); `combat.md`'s *direct HP loss* reads "no Shield"; `StatusRemovalReason`
has `'broken'`, `DamageDealt` has `absorbed`, `StatusApplied` has `capped`. No `SAVE_VERSION`
change was needed.

---

## 8. Order of work

All four phases are done (2026-09-15): **1** the engine (`test/shield.test.ts` pins §2–§4),
**2** the content (§3.5's cards with slate tests, the `'broken'` trigger built), **3** the
presentation (§5), **4** measured — below — with nothing moved.

**What was built, where it departs from the text above (2026-09-15).**

- **The broken trigger is a status field, not a hook:** `StatusDefinition.onShieldBroken`
  (`content.ts`) — a rider a status lands on the striker whose hit breaks its holder's Shield,
  then is consumed. Ice Shell plants a second boolean status, `IceShell`, beside its Shield 50;
  the Shield itself carries no trigger, since Tide Guard's and Ice Shell's pools are one additive
  status and only the Frost card should punish. `StatusRemoved 'broken'` carries
  `sourceCombatantId`, the striker, so the rider knows who to pay. `statusEngine.ts
  resolveShieldBrokenRiders` runs after the hit has resolved, at both `'hit'` sites.
- **Sanctuary is Vigil** (`vigil`): Light already has a field effect named Sanctuary (Consecrate
  sets it, Smite doubles under it) and Zenith's Light graft is a path named Halo. Same card —
  Shield 25 + Renew 10, single ally, Early, 25 mana.
- **The seats are a first pass, placed by the build, for the designer to move:** Iron Skin in
  Iron Warden's, Valor's and Gallant's pools; Living Wall in Iron Warden's and Valor's; Rampart in
  Crag's and Sentinel's; Vigil in Dawnwarden's and Aegis's; Ice Shell in Glacial Warden's and
  Rime's. **The Iron and Stone spawn kits each carry a Shield** (per user direction, same day):
  the Rivetling holds Iron Skin in place of Sharpen, the Monolith Rampart in place of Landslide (a
  60 BP magical spread on a 40-Int body), the Slabback keeps Bastion, and the Puddling holds Tide
  Guard in place of Siphon (the Water kits held no Shield before — Act 1's enemy casts were
  hero-pool enemies whose starting kits carry it); the Hoarfang holds Ice Shell in place of Icicle
  Thrust (physical, on an 85-Int caster) and the Gleamling Vigil in place of Blind (a flinch on a
  34-Speed body). Measured on the same seed: full-clear 22.5 → 22.8%, Act 1 unmoved; the Rivetling
  takes 120 → 114 a round and deals 18 → 17, the Monolith 116 → 104 taken and 87 → 69 dealt;
  enemy Shield casts 861 → 1038 in Act 1 and 225 → 617 in Act 4.
- **The cap on the view:** `StatBars.tsx ShieldFill` draws the band past the fill and, for what
  will not fit, over it from the left — the mana overflow's answer, since the track's length is
  max HP and cannot grow. `applyEventToState` takes `DamageDealt.absorbed` off the displayed
  pool, since the engine's partial absorb emits no status event of its own.
- **The AI and the pilot** (§3.6): `ai.ts riderIsRedundant` treats a Shield rider as inert when
  every receiver's pool is at its max HP; the pilot prices a Shield rider at
  `min(pool, room under the cap, incoming over the horizon × ½)`, prices a hit into a Shield as
  the absorb plus what reaches HP (no KO credit, no drain off the absorb), and `policy.ts`
  values a Shield card at its base × 1.2 for the replace-at-cap decision.

**Measured (2026-09-15; 3000 runs, seed 100000, skilled pilot — the same batch as the enemy-curve
baseline, `sim-out/shield-phase4.txt` against `sim-out/act-curve.txt`).** The baseline is the
tree the Shield landed on, not phase 2b's: full-clear 23.1%, acts 62 / 63 / 95 / 71 / 88.

- **Full-clear 23.1 → 22.5%**, acts 63 / 61 / 96 / 72 / 85 — inside the batch's noise (±0.8) on
  the whole and on every act but 5 (88 → 85, z ≈ 2.6; Act 5's fights are the magical-heavy ones,
  below). Run length 76 → 78 min Reader. **The mechanic is not a player buff at these bases**,
  which is the right first reading for bonus health that costs a turn.
- **Absorbed as a share of every hit the player side is dealt:** 4.5 / 3.4 / 5.3 / 4.3 / 4.2% by
  act, **13% in the finale** — where the roster is built, Rampart is in hand and the pilot has
  1.8 Shield casts a fight against 0.6–0.8 earlier. Pools granted a fight, player side: 28 / 33 /
  50 / 65 / 63 / 164 HP by act; **52–68% of what is granted is ever taken off a hit** — the rest
  is standing when the fight ends.
- **The cap binds rarely:** 2% of Act 1 casts, under 2% after — Bastion on a full-HP Early body,
  or a stacked Rampart in the finale (53 of 1184). At 100% of max HP it is a rule the player
  meets a few times a run, not a wall.
- **Broken:** 39% of player pools in Act 1, 48% in Act 2, then 32–34% — a Shield is a hit's worth
  most of the time, the doc's "takes the first hit". Enemy pools (hero-pool enemies holding a
  convert, and the Slabback): 861 / 976 / 442 / 225 / 110 casts by act, 62–77% of them broken.
- **The converts were dead as Defense and are live as Shields.** The same seed with Tide Guard
  and Bastion put back to +15 / +30 Defense: full-clear 22.5%, identical — but Tide Guard's casts
  2975 → 3630 and **Bastion's 43 → 2559** (0.1 → 8.0 per 1000 player turns). The pilot never took
  the +30 Defense buff; it takes the Shield 45 on both allies once every hundred-odd turns. That is
  the swap's whole yield today: a card the game shipped and nobody cast is now a card.
- **Cast rates per 1000 player turns:** Tide Guard 11.3, Bastion 8.0, Iron Skin 4.6, Ice Shell
  3.2, Living Wall 2.8, Vigil 2.2, Rampart 1.0 (Late, two pools hold it).
- **The Defense question, directionally yes and inside the error:** draft lift Crag 1.34 → 1.54,
  Valor 0.16 → 0.64, Riptide −0.53 → −0.34 (±0.38 each); Sentinel fielded 885 → 1175 fights at
  87.8 → 90.1% win. No sign flipped. The doc's "reach for Iron and Stone as supports" is a playtest
  question still.
- **Damage taken by category, player side:** 73 / 27 physical / magical in Act 1, then **35–40 /
  60–65** from Act 2 on and 16 / 84 in the finale. The §4 "counts twice" reading — Defense shrinks
  the hit, then sizes the pool — is worth most in Act 1 and least where the pools are biggest, which
  is the honest shape for a Defense mechanic against a magical late game and the number to hold
  against if a Shield base is ever raised: a bigger pool buys more in the finale, where it is
  already 13% of hits, than in Act 1, where the wall is.

---

## 9. Locked invariants this overturns

All landed 2026-09-15.

| Was (`CLAUDE.md` / `combat.md` / `authoring-moves.md`) | Now | Phase |
|---|---|---|
| *Protect / shield / damage negation* is a deliberately unbuilt shape | **Built**, as bonus health: a `'shield'` status pipeline, absorbed at the HP chokepoint | 1 |
| Direct HP loss: no Defense, no type chart, no variance, no passive reaction pass | Gains **no Shield** — a DoT, the Clock, a cost and recoil go through | 1 |
| A status magnitude reads Wisdom (`hot`) or the move's offensive stat (`dot`) | A third arm: **`shield` reads Defense** | 1 |
| Status stacking is `none` / `additive` / `takeHigher` / `additiveMagnitudeFixedDuration`, unbounded | `additive` with a **per-holder cap** for the `'shield'` pipeline only | 1 |
| Tide Guard grants +15 Defense to both allies; Bastion +30 | Shield 20 and Shield 45 on both allies | 2 |
| Every status magnitude the engine applies is either a DoT, a HoT, a Force or a timer | A fifth kind, a pool | 1 |

**Held, and worth saying so:** the damage formula and both pipelines (a Shield is applied after
the hit is computed, never inside it); the heal formula and its constants (borrowed, not
changed); `stat-scaling.md` whole; the Pact Clock (which goes through a Shield, so it still ends
a stall); potions (a restore, HP only); the 550 and 28 budgets; "a bare number never gets a
screen" — a Shield is a rider on a move, chosen by casting it.

---

## 10. Open questions — DO NOT silently resolve

- **Overheal → Shield beyond Verdant Earth** (§3.4). The field's version is built
  (`blessings-and-statuses.md` §5); a general one — only from a heal move (never a HoT tick, never
  a potion), at the heal's own Wisdom scaling, into the same cap — is still undecided. It would give
  every healer a Shield job off Wisdom, which is the thing this doc gives Defense, so it is a
  decision about whether Defense keeps the job to itself.
- **Bench regen and Shield.** `benchHpRegenFlat` heals HP on the bench; a Shield neither regens
  nor decays there. Nothing to decide unless bench HP regen ever becomes a fraction of max, in
  which case "does the Shield count" is a real question.
- **The `'broken'` trigger.** Built for Ice Shell as `onShieldBroken` (§8 "What was built") —
  Shield-specific by design, not a general status-removal hook. A Renew that pays out when
  cleansed or a Barrier that punishes the move it turned would want the general shape, and that
  is still its own conversation.
- **The Class and the signature.** No Class grants a Shield (a Class verb "a shield" beside "a
  redirect, a priority strike, a spread, a heal" is the obvious candidate). Among signatures,
  Dread's is a Shield card; none of the Iron or Stone signatures is. Content to place.
- **The equipment passive Second Skin** (*+5 Defense, +5 Wisdom on taking a hit*) fires on an
  absorbed hit under §3.3. Intended — it is the item most likely to sit on a tank — but it is
  the first passive whose trigger count a Shield raises, and no sim pass has reported by how much.
- **Guardians.** A champion with a Shield move is the one place a Shield off a high-level boss's
  Defense could read as unfair (a ×2 pool on a 400-HP boss is 800 effective). No champion holds
  one until the numbers are seen; if one should, the doc would rather author its base down than
  exempt it from the formula.

### Watch in playtest

Whether a Defense-heavy hero's *identity* changes — whether the player reaches for Iron and Stone
as supports, not just as bodies. Whether §3.2's counterplay is found: the run where a Bleed
through a Rampart wins a fight is the one that proves the design. Whether the cap at 100% ever
binds in ordinary play, or only under stacked Rampart casts. And whether "twice full" on the bar
reads at a glance, or needs the number.
