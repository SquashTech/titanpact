# authoring-moves.md

**A runbook for turning one type's designed move table into shipped content.**

The designer hands over a slate of ~15 moves for one type, as a table with the columns
`Move Name / Phy·Mag·Buff·Heal / Base Power / Mana Cost / Effect / Early·Mid·Late`, and
asks you to remove that type's existing moves, replace them, and "distribute them
appropriately."

All fifteen slates are authored: fourteen from a designer's table (Fire 2026-08-29, the
other thirteen 2026-08-30) and **Ancient** (2026-09-17, §10 "Ancient"), the enemy-only
slate with no table, no hero and no pool. A second pass added two to four moves a slate on
the existing vocabulary (§11). This file is what those slates cost to learn, so the next
one — a reworked slate, a new type, a new hero's line — is an afternoon instead of a day.
Nearly all of the saving came from §0 step 1: naming the engine extensions before writing
any content.

### Words to watch for

Each slate hid its engine work in a few words of the table. Sort the rows by these before
anything else:

| Slate | Words | What they turned out to be |
|---|---|---|
| Frost | "can only target", "consume" | a legality gate, and a status spent as a cost |
| Storm | "randomly", "switch out", "priority +1 if", "costs 0 if" | four design forks — stop and ask, don't improvise |
| Stone | "in place of", "damage the user took", "as recoil", "redirect", **"Allies gain"** | the last one hides: a payload landing on a different side from the damage is an engine field, not a rider |
| Nature | "if the user has Renew" | the same grammar as "if the target is Burned", asked of a different combatant |
| Light | "if Sanctuary is active" — and a Daze with **no duration column** | a missing number can be a missing decision (Daze became a flinch rather than getting a guessed `2`) |
| Shadow | "below 50% HP" | the first condition reading a quantity rather than a presence |
| Arcane | "(can exceed their max)" | not a field but a removed invariant: every reader of `currentMana` had to be checked |
| Mind | "double stat reductions" | a question about a move that the designer answered about the system (the stat floor) |
| Spirit | "loses 25% of max HP", "drops to 1 HP" | a price known before pressing, not recoil |
| Iron | "if **an** enemy has Conduct" | the same field as Storm's, a different quantifier — and a different mechanic |
| Beast | "if partner is a Beast" ×3 | one condition, three hosts (power, price, stat grant) |
| Mech | four spellings of "randomly" | four places chance can attach, one of which must be known before the commit |

### The lessons

- **Stop and ask** when a row has two or three defensible readings (Storm). One round trip
  up front is cheaper than rebuilding the targeting model afterwards.
- **Whenever one row's payload lands on a different side of the field from its damage, that
  is an engine field** (Stone's `statDeltaTarget`).
- **Read every conditional clause for WHOSE state it asks about**, not just which status it
  names (Nature). Grep the field's existing readers and diff the SENTENCE, not the shape —
  "an enemy" and "both enemies" are different mechanics when the move also consumes what it
  reads (Iron). When a row's condition and payload touch the same state, ask *what does
  reading it do to it?*
- **List every status the slate applies and check its shape** (magnitude, duration, timer)
  against `src/data/statuses.ts`. Where the table omits a number the shape needs, name it in
  the hand-off rather than inventing one; the useful question is sometimes "should this
  mechanic want a value at all?" (Light).
- **When the designer answers a mechanical fork with a sentence about legibility, the
  deliverable includes the surface** — the chip on the button, lit before the player commits
  (Shadow).
- **When a row changes what an existing state field may hold, grep every reader of that
  field** and ask which relied on the old bound (Arcane: the regen tick's `Math.min`, Rest,
  a gauge dividing by the pool). The designer question is not "how much?" but **"what takes
  it away?"**
- **When a row pushes a number somewhere no content has pushed it, ask "what happens at the
  extreme?"** and answer it at the chokepoint every reader shares, not on the move that got
  there first (Mind: `getEffectiveStat`'s floor at 1).
- **The previous slate's "deliberately left unbuilt" list is a work queue** — check it before
  reading your own table (Spirit's user-side HP condition was Shadow's open item).
- **For a self-cost, ask "billed against WHAT, and known WHEN?"** Recoil is an outcome;
  `selfHpCost` is a price (Spirit).
- **Count the HOSTS, not the conditions** (Beast): a condition repeated across rows of
  different payload kinds costs one field per kind.
- **When a condition reads the ROSTER, run the reachability check on the condition** — the
  enabler may live in another file (`grep "typeGraft: '<Type>'"`).
- **For anything random, ask when it is known relative to the commit** (Mech). A roll the
  player reads before choosing is derived from state; one discovered afterwards comes off the
  stream (`docs/combat.md` "Randomness that does not come off the shared stream").
- **Ask whether the type interacts with the marks it applies** (Conduct, Haunt) — invisible
  in a table and a whole doubles axis.
- **A long-standing "raise before you build it" note is usually cheaper than it looks** by
  the time something asks for it; raise it because the designer might not want it, not
  because it is expensive (Beast's rider list touched ~40 call sites, none needing thought).

Read this **before** opening `src/data/moves.ts`. Read `CLAUDE.md` first if you have not.

---

## 0. The shape of the job

Roughly, in this order:

1. **Read the table twice.** Sort every row into *already expressible* vs *needs a new
   engine field*. Most rows are the former. Do this before writing anything — the
   engine extensions are the only part with design risk, and you want them named up
   front, not discovered halfway through authoring.
2. **Extend the engine vocabulary** for the rows that need it (§4, §5).
3. **Replace the type's moves** in `src/data/moves.ts`.
4. **Re-wire everything that pointed at the old ones** (§6) — hero kits, level-up
   pools, Titanspawn and champion kits, tests, docs.
5. **Distribute** (§7): starting kits, level-up pools, enemy kits.
6. **Verify** (§9) and report the open design questions you hit (§10).

Expect the mechanical part to be fast and the *removal* to be where the surprises are.

---

## 1. Files you will touch

| File | What it holds | Always? |
|---|---|---|
| `src/data/moves.ts` | Every move, as pure data. The main event. | Yes |
| `src/data/heroes.ts` | `moveIds` = each hero's **2-move starting kit**. | Yes, for your type's heroes |
| `src/data/progression.ts` | `moveTiers[heroId]` = the **level-up pool** the hero's schedule offers roll from (`MOVE_CAP` is 4; past it an offer is replace-or-decline). | Yes |
| `src/data/titanspawn.ts`, `src/data/enemies.ts` | The Titanspawn kits (a fixed 3 / 4 / 4 by tier, drawn from the type's slate) and the Guardian champions' and the Herald's `moveIds`. | If a kit holds a move you change |
| `src/engine/content.ts` | `MoveDefinition` / `StatusApplication` — the contract. | Only when a row needs a new field |
| `src/engine/damage/damagePipeline.ts` | Pipeline 2. New BasePower-stage or multiplier terms live here. | Only for damage-math extensions |
| `src/engine/combat/resolveRound.ts` | Where a move's fields are actually read and applied. | Only for new fields |
| `src/view/shared/MoveTile.tsx`, `src/view/combat/MoveDetailOverlay.tsx`, `src/view/combat/FightScreen.tsx` | The three places a move's effect is described to the player. | Only for new fields (§5) |
| `test/*.test.ts` | Fixture tests reference moves **by id**. | Almost certainly (§6) |
| `docs/` | The design record. | When you extend or hit an open question |

Find your type's heroes and any existing moves with:

```bash
grep -n "types: \['Frost'\|types: \['Frost'," src/data/heroes.ts
```

```bash
grep -n "type: 'Frost'" src/data/moves.ts
```

---

## 2. Translating the design table, column by column

### `Phy / Mag / Buff / Heal` → `kind` + `category`

The table's four labels do **not** map one-to-one onto `kind`, which is only ever
`'damage' | 'heal' | 'buff'`.

| Table says | `kind` | `category` |
|---|---|---|
| Phy | `'damage'` | `'physical'` (Attack ÷ Defense) |
| Mag | `'damage'` | `'magical'` (Intelligence ÷ Wisdom) |
| Heal | `'heal'` | either — healing scales off the caster's **Wisdom** regardless |
| Buff | `'buff'` | pick the pipeline the buff is thematically about; it is inert |
| Debuff | `'buff'` **with a negative payload** | as above |
| **Mag with `Base Power: N`** (no number) | `'buff'` | as authored |

That last row is the one that trips people. A move with no damage body is
`kind: 'buff'` **whatever it does to the enemy** — `'buff'` is the engine's kind for
"a move whose entire payload is its riders". Fire's Spark Flash (`Apply Burn 10.
Spread.`) is `kind: 'buff'`, `target: 'bothEnemies'`. The UI recovers the sign on its
own: `MoveTile.tsx`'s `isDebuff` reads a negative stat delta, or a non-`positive`
status aimed at someone other than the caster, and labels it **Debuff**. You do not
tag it, and you must not invent a `'debuff'` kind.

`category` on a non-damage move is never read by the engine. Author it truthfully
anyway (an Attack buff is `'physical'`) — it is documentation.

### `Base Power` → `basePower`

Number for damage moves; **omit the field entirely** when the table says `N`.
`healPower` is the heal-kind equivalent, and it is *not* flat HP — it is the figure the
healing formula scales, so a Wisdom-80 caster restores more than the number written.

### `hitCount` (2026-09-07)

Damage-kind only; omit for the ordinary single hit. The move resolves its **whole
per-target body** this many times, so `basePower` is read **per hit** — Thousand Cuts
is authored at 20 and lands 60. Everything downstream repeats with it: each hit rolls
its own variance and crit, re-reads the type chart and the live off/def ratio, fires its
own `DamageDealt` (and therefore its own passive reactions), and re-reads every flat
BasePower bonus.

**That last clause is the whole reason the field exists.** Ambush is flat BasePower, so
a 3-hit move counts it three times — an Ambush 45 is +135 across the move rather than
+45. Multi-hit is Shadow's authored payoff for the keyword, and pricing one anywhere
else should start from that multiplication, not from the bare total.

Three things it does NOT repeat: **riders** fire once, after the whole move; a
**consumed** status (Ambush, a `consumesStatus` conditional) is spent once; and a
target that **faints mid-sequence** ends the sequence rather than being swung at again.
Never pair it with `retributionPercent`, which bypasses the formula and would pay N
times for nothing — `test/shadowMoves.test.ts` pins that.

### `Mana Cost` → `manaCost`

Mana is the primary balance lever (`CLAUDE.md`) — there is no accuracy stat, so cost is
what separates a cheap poke from a finisher. Sanity-check the slate's **floor** against
the mana pools of the heroes and enemies that will hold it (§7, and the trap in §8).

**Check the floor, not the ceiling.** A hero's `baseStats.manaPool` is where it
*starts*, and heroes gain mana all run from relics, equipment and Evolution
(`docs/mana.md` "Mana pools GROW over a run") — commonly +40 by mid-run and well past
+100 in a run built for it. **A move costing more than any current hero's starting pool
is intended, not a finding.** Do not report it, and do not tune it down.

### `Effect` → riders

See §3. Every rider is an optional field layered on top of the move's kind; a damage
move can carry all of them at once.

### `Early / Mid / Late` → `MoveDefinition.tier`

**Author it.** `tier: 'early' | 'mid' | 'late'` gates which band of a hero's level-up
schedule can offer the move (`src/run/progression.ts`, `docs/xp-overhaul.md` §4): the
schedule opens Mid at `midLevel` and Late at `lateLevel`, and **each band offers its own
tier** — Early expires when Mid opens, Mid when Late does (`MOVE_TIER_RANK_EXPIRY`). A
graft's line is gated on reaching a tier only, never on expiry. The Mentor rolls a Mid move
and the Tutor a Late one, both un-gated (`src/run/tutor.ts`). Not an *engine* field:
nothing in combat reads it, though the mana conventions do (§8).

Things to know before you author a slate's column:

- **Omitting `tier` means Early**, i.e. ungated, so a slate left untiered fails silently.
  `TIERED_TYPES` in `test/moveTiers.test.ts` lists every slate (all fifteen); **add a new
  type to it** and the test then demands a tier on every one of its moves.
- **Tier is your distribution guide** (§7), and it binds: Early moves are starting-kit
  candidates and the first offers, Mid/Late go in `moveTiers`. Every pool must survive the
  offers its schedule makes from each band (`movePoolFloor`, pinned by
  `test/moveTiers.test.ts`); pools are authored at about 6 Early / 6 Mid / 4 Late.
- **Know what your Early tier leaves the type's magical hero.** All fourteen slates put
  exactly one magical row there, and the type's magical hero starts with it — so Sylva
  and Marrow had only off-stat or utility rows left to draw. That is fine (2026-08-31
  designer call: a hero holding a move off its better stat is a legitimate pick, the way
  it is in Pokémon, not the "trap pick" the north star forbids — that is a hero whose
  *only* damage move is off-stat). Worth knowing you are doing it, not worth avoiding.

### `priority`

Rarely in the table; author `0` unless the effect text says otherwise. The engine uses
integer brackets with Speed as the tiebreak *within* a bracket. In use today: `1` for
cheap fast pokes, `-1` for heavy slow swings. Switches resolve in their own bracket
above everything.

---

## 3. The rider vocabulary (what `Effect` can already say)

Every one of these is optional and composes with any `kind`.

### `statusApplication` — inflict or grant one status

```ts
statusApplication: { statusId: 'Burn', magnitude: 10, target: 'moveTarget' }
```

- `target: 'moveTarget'` = the move's own resolved targets. `'self'` = the user
  (recoil, or a self-buff). `'bothAllies'` (2026-09-01, Water's Lizard Rush) and
  `'randomAlly'` / `'randomEnemy'` (Storm's Rising Static) let the rider resolve
  its OWN target relative to the CASTER, independently of the move's — which is
  how one move hits an enemy and mends its own side in the same cast. Only the
  random pair draws RNG; `'bothAllies'` costs the same rolls as no rider at all.
- `magnitude` for magnitude/timer statuses; `duration` for duration statuses.
  **Burn and Renew are percents of the HOLDER's max HP** (2026-09-28,
  `docs/blessings-and-statuses.md` §3–4). A Burn lands exactly as authored and is never
  caster-scaled, on an enemy or as a self-cost. A Renew is a **base** the caster's Wisdom
  and STAB scale at cast (`docs/combat.md` "Scaled status magnitudes"): author it against
  the reference hero — Wisdom 50, no STAB — and the roster spread takes care of itself.
- **A Shield rider is authored the same way** (2026-09-15, `docs/shield.md`): its magnitude is
  a base the caster's **Defense** scales on the heal formula's constants, with STAB — so Iron
  Warden (100 Defense, Iron) turns Iron Skin's 30 into 56 and an off-type 50-Defense caster lands
  the figure as written. Author against the reference hero; a Shield's band is the buff body's
  (Early 20–30, Mid 30–50, Late 50–75) read as a fraction of a Mid hero's HP. Bonus health, not
  Defense: it is the thing to reach for when a row says *protect*, *ward*, *shell* or *wall*, and
  the two Defense grants that read that way (Tide Guard, Bastion) were converted. A card that
  should punish being broken plants a second marker status carrying `onShieldBroken` beside the
  pool, as Ice Shell does — the Shield itself is one additive status per holder and carries no
  trigger of its own.
- `chance: 0.1` gates the rider on a roll. **It gates the rider, never the move** —
  the damage still lands (`CLAUDE.md`: no accuracy stat). Rolls once per target.
- **A move can carry ONE rider or a LIST of them** (2026-08-30, Beast's Toxic
  Fangs — "afflict Bleed and Poison 10"). Author a single rider bare, exactly
  as every move before it does; author an array when a row applies two. Riders
  resolve in authored order, each resolving its own targets and rolling its own
  `chance`, and a one-rider move draws exactly the RNG it always did. Read it
  through `content.ts statusApplicationsOf` — never off the field directly,
  which is a union — and remember the three player-facing surfaces have to show
  ALL of them (§5).

The catalog (`src/data/statuses.ts`, `docs/conditions.md`):

| Status | Shape | Behaviour | Cleared by switching? |
|---|---|---|---|
| `Burn` | magnitude | End of round: deal X% of max HP, then **halve** X. A new Burn keeps the higher of the two. Never caster-scaled | Yes |
| `Renew` | magnitude, positive | Heals X% of max HP when it lands, then at the end of each of the next 2 rounds, no decay. X scales off the caster's Wisdom. Cleanse never strips it | No |
| `Bleed` | boolean | End of round: 5% of max HP, flat | No |
| `Freeze` | boolean | Halves Speed | Yes |
| `Daze` | boolean | Cannot use a move for the REST OF THE ROUND, then gone. Flinch: worth nothing if its applier acted second | Yes (moot) |
| `Poison` | timer | Magnitude builds, duration only ticks while active, detonates at 0 | No (stalls on the bench) |
| `Conduct` | boolean | A Storm/Iron/Mech damage move detonates it for bonus %maxHP | No |
| `Haunt` | boolean | A Spirit/Mind single-target hit on the holder also strikes its partner; passes to the partner on a knockout (`blessings-and-statuses.md` §2, 2026-09-28) | Yes |
| `Ambush` | magnitude, positive | Adds its magnitude as flat Base Power to the next attack the holder lands, whatever the move type, then is spent. No clock | Yes |
| `Provoke` | duration | Every single-target move the enemy side aims at this side is redirected onto the holder. Spread moves are unaffected | Yes |
| `Shield` | magnitude, positive | Bonus health (`docs/shield.md`): a move's hit is taken from it before HP; a DoT tick, the Pact Clock, recoil and a self-cost go straight through. Lasts until a hit empties it; adds up to the holder's max HP. X scales off the caster's **Defense** (§3) | No |
| `IceShell` | boolean, positive | Ice Shell's marker beside its Shield: the striker whose hit breaks the holder's Shield is Frozen, then it is spent (`onShieldBroken`) | No |
| `Barrier` | boolean, positive | Every move the far side aims at the holder turns away for the rest of the round. Priced by the fight (`manaCostGainOnUse`) | Yes |
| `Poised` | boolean, positive | The holder's next attack goes at +1 priority, then it is spent | Yes |
| `Cannonball` | magnitude, positive | Loaded on the bench; every one fires as the holder enters the field | No |
| `Beheld` | duration | The finale's Eyes only: a Regard is coming. Switching out breaks it | Yes |

Two of these have **type-keyed hooks** that fire automatically off any damage move of
the right type (`StatusDefinition.triggerTypes` for Conduct, `spreadTriggerTypes` for
Haunt). If you are authoring Storm, Iron, Spirit or Mind, your damage moves will
detonate/spread these without you writing anything — that is intended, and it means the
type's raw numbers are already carrying a hidden rider. Price accordingly.

`${Type}Force` (Elemental Force) is also a magnitude status, one per type, adding flat
BasePower to that type's moves. If your type's table has a "power up your own element"
row, that is what it should be. Fire's Stoke the Flames grants it to `bothAllies`, which
turns a personal ramp into a reason to draft two heroes of the same type; the §11 Early
self-buffs (Undercurrent, Hoarfrost Edge, Static Charge, Soulfire) are the personal version.

### `requiresTargetStatus`

`requiresTargetStatus: 'Freeze'` (Frost's Glaciate, Absolute Zero) makes the move
**illegal** against anything not carrying that status: with no legal target the
view will not offer it and the engine fizzles it for no mana
(`ActionBlocked`, reason `targetStatusMissing`). A hard gate, not a damage
penalty — do not confuse it with `conditionalPower` below, which asks the same
question and pays a bonus instead of refusing.

Two things to check before authoring one: that every hero who can be offered the
move can also reach the status (`test/frostMoves.test.ts` asserts this), and that
the pool has a *guaranteed* applier rather than only chanced ones — a gate behind
a 20% roll is a move the player cannot plan around.

### `cleanses: true` (+ `cleanseCount`)

Strips every non-`positive` status from the resolved targets. `cleanseCount: 1` (Water's
Wash Away) caps it at N, picked at **random** — still never a `positive` status, and still
no way to name which one. Omit `cleanseCount` and nothing draws RNG.

### `drainPercent`

`drainPercent: 0.5` on a damage move (Water's Siphon/Engulf) returns half the HP it
actually removed to the user. It does **not** run the healing formula — no HealPower, no
Wisdom, no STAB of its own — because the number it scales has already been through the
damage formula. Read `docs/combat.md` "Drain" before authoring a variant.

### `manaDiscountOnUse`

`manaDiscountOnUse: 20` (Water's Wave Shred) drops this move's cost **for that combatant**
by 20 every time they cast it, for the rest of the fight, floored at 0. The first cast is
always the authored price. If you author one of these, sanity-check that a hero who holds
it can afford the *first* cast — the ramp cannot start otherwise.

`manaCostGainOnUse` is the same ledger run the other way: each cast makes the move dearer
for the rest of the fight. It is how a guaranteed lockout is priced (Feint, Blind and
Barrier at +20, `CLAUDE.md` "No accuracy stat").

### `basePowerGainOnUse`

`{ amount: 40, max: 200 }` (Frost's Snowball, 2026-09-02) is the mana ramp's mirror on the
other side of the formula: every cast raises this move's BasePower **for that combatant**
by `amount` for the rest of the fight, capped at `max` TOTAL. Like the mana ramp, the cast
pays the **pre-increment** figure — Snowball's first throw is the authored 40 — and the
accrual lives on `Combatant.moveBasePowerBonuses`, so it is per hero, per move, and gone
when the fight is.

Two things to get right:

- **It is a BasePower-stage substitution, not a modifier.** It replaces the authored
  BasePower *input*, so `max` caps the ramp alone: the conditional multiplier and Elemental
  Force still apply on top of the capped figure, exactly as they do to any other move.
- **Read it through `state.ts resolveCastBasePower`, never `move.basePower`.** That is the
  one function the engine, the move button, and the dossier's damage forecast all call, and
  it also covers `randomBasePower` (the two fields are exclusive). A surface that reads the
  authored number shows a lie the moment the ramp starts.

### `conditionalPriority`

`{ requiresTargetStatus: 'Conduct', bonus: 1 }` (Storm's Electric Burst) raises the
move's bracket when its **declared target** carries the status. Evaluated when the
round is ORDERED, not when the move resolves — a bracket has to be settled before
anything happens, so a mark planted this same round is too late. Read off the
declared target only, so a fixed-group move never gets it.

### `conditionalManaCost`

A **replacement** price while the enemy side carries a named status — not a
discount. Two sides, and a move authors **exactly one**:

- `{ requiresAllEnemiesStatus: 'Conduct', manaCost: 0 }` (Storm's Overcharge) —
  every active enemy carries it.
- `{ requiresAnyEnemyStatus: 'Conduct', manaCost: 0 }` (Iron's Metallic Blade) —
  at least one does, whether or not it is the foe being hit. Mech's Whirling Blades
  (2026-09-17) reads the same side at **30 of 60** — half, not free, because Iron owns
  free and Mech's spread then detonates every mark it touches.
- `{ requiresPartnerType: 'Beast', manaCost: 50 }` (Beast's Pack Leader) — the
  caster's ACTIVE PARTNER is of a named type. The only side that reads the
  caster's own row rather than the enemy's, and the only one whose condition a
  player answers at draft time. See `requiresPartnerType` below.

Nothing in the type system enforces "exactly one"; both fields are optional and
a move authoring neither is a silent dud. `test/ironMoves.test.ts` pins it over
the whole move table, same as `test/shadowMoves.test.ts` does for
`conditionalPower`'s five siblings — so a third sibling fails the moment it is
authored without extending that list.

Composes with `manaDiscountOnUse` by taking the lower. Unlike `conditionalPriority`
this IS read at resolution, so a mark planted earlier in the same round pays for it.
Every live-fight reader must go through `state.ts resolveManaCost`;
`effectiveManaCost` stays the board-free answer for the draft/level-up/compendium
surfaces. Both sides need at least one ACTIVE enemy (a wiped side vacuously
satisfies "every enemy is marked") and both read the enemy side only — a mark on
your own partner discounts nothing.

**The two sides are different mechanics, not different tolerances.** Where the
gated move also *interacts* with the status it reads, "all" is self-consuming
and "any" is a choice: an Iron move detonates Conduct, so Metallic Blade cashes
the mark if it swings at the marked foe and banks the discount if it swings at
the other one. Reach for the "any" side when the design row wants that decision,
not merely when it says "an".

### `switchesUserOut`

`true` (Storm's Tailwind) sends the caster to the bench after the move's payload
lands, with the incoming hero declared up front on `MoveAction.switchToCombatantId`.
Respects the LOCKED lock-in rule; a block degrades the move (buff lands, mana spent,
only the pivot refused) rather than fizzling it. If you author one, the view needs a
second declaration stage — FightScreen reuses `SwitchInPanel` for it.

### `detonatesStatus`

`detonatesStatus: 'Poison'` (Nature's Miasma) fires a **timer-shape** status's
stored payload on the move's resolved targets now, instead of when its clock
runs out. Three things fix its shape:

- It resolves **after** the move's own `statusApplication`, so Miasma's "apply
  Poison 5, then detonate" includes the 5 it just planted. If a design row wants
  the reverse order, that is a conversation, not a re-ordering.
- It is worth **exactly** what the expiry would have been (`magnitude`% of max
  HP). Keep that true: the move buys tempo, not damage, and the moment the two
  numbers diverge it has become its own damage source — one the type chart
  cannot touch, like Stone's retribution.
- It is gated on `StatusDefinition.pipeline === 'timer'`, not on the id, so it
  is a no-op on anything else. Poison is the only timer status today, so Poison
  is the only detonatable one.

### `manaGrant`

`manaGrant: 40` (Arcane's Infuse, Empower 80, Conduit 150, Font of Power 150)
hands the move's resolved targets flat mana. The first content that moves mana
between combatants, and the reason `Combatant.currentMana` is no longer bounded
by `getMaxMana`.

**The overflow is uncapped and sticky** (`docs/mana.md` "Overflow"): regen
never lowers you, Rest tops up TO the pool and never below what you hold, it
survives a switch, and it ends only by being spent or at the next map node. If
you author one of these, that is the rule you are authoring against — a grant
bigger than the target's pool is the normal case, not the edge case.

Two things worth knowing before reaching for it:

- **Ally modes include the caster** (`targeting.ts activeOf`), so a
  `singleAlly` grant can legally be pointed at yourself, and a `bothAllies`
  one always pays the caster too. Font of Power is 100 out and 150 back to
  itself plus 150 to the partner.
- It emits its own **`ManaGranted`** event, not a bare `ManaChanged` — the
  latter is deliberately omitted from the Battle Log as bookkeeping, so a grant
  without its own event is invisible in the log.

### `conditionalTarget`

`{ requiresFieldEffect: 'surgingMagic', target: 'bothEnemies' }` (Arcane's
Overload, "spread if Magical Surge is active") replaces the move's `target`
while that field is up. The first move whose TARGETING reads the board.

Read at **resolution**, via `state.ts resolveTargetMode` — the same board-aware
single-reader discipline `resolveManaCost` follows, and the same timing as
`conditionalPower.requiresFieldEffect` rather than `conditionalPriority`'s
(a bracket must be settled before the round resolves; a target list need not
be). So a partner's setter earlier in the same round already counts.

The player still declares against the AUTHORED mode — Overload opens a normal
single-target panel and the second target is added on the way in — and every
downstream retargeting layer (Provoke, Haunt) reads the effective
mode, so a conditionally-spread move behaves exactly as an authored spread one.

### `derivedStatDeltas`

`{ source: 'userManaBeforeCast', stats: ['attack', 'intelligence'] }` (Arcane
Overflow) is `statDeltas` with the amount read off live state instead of
authored. It expands into ordinary `StatDelta`s at cast time, so
`statDeltaTarget`, the `StatChanged` events and `statModifiers` are all the
unchanged path.

Two things fix its shape, and both are decisions rather than mechanics:

- The mana is read **before the cost is paid** (the design row says so), and
  reading it spends nothing.
- It is the **one documented exemption** from CLAUDE.md's multiples-of-5/10
  rule. A derived amount has no authored number to round, and rounding it would
  make the buff disagree with the numeral on the caster's own bar. Do not add a
  second exemption without asking.

`source` is a small union on purpose. A later slate wanting "equal to missing
HP" adds a member; it does not add a field, and it certainly does not add a
predicate function. **Beast is the slate that proved it** —
`'userEffectiveAttack'` (Apex Predator, "double the user's Attack") is a
second member and cost one line in `resolveRound`. It reads the caster's live
effective Attack through `getEffectiveStat`, so equipment and this fight's
buffs and debuffs are all inside it, which is what makes it a DOUBLING: it
compounds on a second cast, and a Rally landed first is doubled along with
everything else.

### `fieldEffectApplication`

Sets the single global battlefield state for a flat **5 rounds** (never authored
per-move). One at a time; a different one overrides and restarts the clock.

`surgingMagic` (Arcane, doubles MP Regen) · `scorchedLand` (Fire, Burn keeps ¾ a round
instead of half) · `stasisBubble` (Mind, slowest-first within a bracket) · `sanctuary`
(Light, heals get +1 priority and ×1.5) · `verdantEarth` (Nature, Renew heals ×2 and
overheal becomes Shield) · `witheringGaze` (Ancient, the Eyes only).

If your type's table implies a *new* field effect, read `docs/field-effects.md` first —
`FieldEffectDefinition` is a small set of implemented shapes, and a new one is an engine
extension, not a data row. **A field needs all three routes on day one** — a Herald Boon, an
Early rider that sets it, and a reader that doubles under it — or it never appears in play
(`docs/field-effects.md` "Why four of five never appeared").

### `statDeltas`

Flat additive integers, **multiples of 5 or 10**, no percentages
(`CLAUDE.md`, enforced for grants by `isValidFlatStatGrant`). Works on any kind; on a
damage move the deltas land **after** the hit, so a Defense debuff shapes the next hit
and not its own.

**The figure you author is a BASE** (2026-09-14, `docs/stat-scaling.md`): it lands as
`round(base × StatMult × STAB)`, a buff off the caster's Wisdom and a debuff off the stat the
move swings with, and a drop is held at −½ of the target's base + loadout. So author it at
par (a Wisdom-50 caster off-type lands the base as written) and to the **noise floor**
(`test/statScaling.test.ts`): a `buff`-kind move's body is **≥ 20 on one stat, ≥ 15 a stat
when split or paid to both allies** (Speed and MP Regen do not count — one is ordering, the other is exempt from
scaling), a rider on a damage or heal move **≥ 10**, and **nothing at 5** anywhere. The bands
are the bases the slates already use — Early 20–30, Mid 30–50, Late 50–75 for a body, riders
10 / 10–20 / 20–30 — and the Ancient slate inherits them.

`statDeltaTarget` (Stone's Landslide) sends them somewhere other than the move's own
targets — `'moveTarget'` (the default, and every move authored before it), `'self'`,
or `'bothAllies'`. Reach for it the moment a damage row also says "allies gain": that
is a move whose two halves land on opposite sides of the field, and it is the exact
shape `StatusApplication.target` already solves for a status rider.

### `statDeltaChance`

`statDeltaChance: 0.2` (Mind's Psi Bolt, Psyshock, Psionic Wave) is
`StatusApplication.chance` for stat deltas, and behaves identically: it gates the
DELTAS and never the move's own body, it rolls once per resolved target (so a chanced
spread catches one foe and misses the other), and it draws no RNG at all when absent.
One difference — the roll gates the whole delta list together, so "20% chance to reduce
Intelligence and Wisdom" is one flip with two consequences.

### `conditionalStatDeltas`

`{ requiresPartnerType: 'Beast', multiplier: 2 }` (Beast's Prowl, "+10 Attack
and +10 Speed. Doubled if partner is a Beast") multiplies every one of the
move's `statDeltas` AMOUNTS while the condition holds — so a +10 lands as one
+20 and one `StatChanged`, not as two applications.

The third host of the partner condition (§ below), and the reason it is a
field of its own rather than a flag on `statDeltas`: what hangs off the
answer here is a stat grant, where `conditionalPower` hangs BasePower and
`conditionalManaCost` hangs a price. Deliberately does not reach
`derivedStatDeltas` — that amount is already read off live state.

### `requiresPartnerType` (the partner condition, three hosts)

The one condition in the game that reads a combatant on the CASTER's own side.
It appears on three different fields because three different mechanics hang
off it, and `state.ts activePartnerTypes` is the single reader all three go
through:

| Field | What it changes |
|---|---|
| `conditionalPower.requiresPartnerType` | the BasePower multiplier (Pack Hunt) |
| `conditionalManaCost.requiresPartnerType` | the price (Pack Leader) |
| `conditionalStatDeltas` | the move's own stat grants (Prowl) |

Four rules, all settled up front and all in `docs/combat.md`: the ACTIVE
partner only (never the bench), a fainted partner counts for nothing, EFFECTIVE
types so a type-graft Evolution satisfies it, and read LIVE at resolution — so
a partner KO'd earlier in the same round can take a discount away after the
player committed, and the cast fizzles for no mana if they cannot cover it.

**Before authoring one, check who can satisfy it** (`grep "typeGraft: '<Type>'"`
as well as `heroes.ts`). A condition that reads the roster can be trivially
unreachable, and the enabler may live in a file the design table never
mentions.

### `conditionalPower.requiresTargetStatReduction`

`{ requiresTargetStatReduction: true, multiplier }` (Mind's Brain Flay) is the
conditionalPower form for "×N against a foe whose stats have been lowered". Per target,
like `requiresTargetHpBelow`, so a spread doubles against the debuffed foe only. It reads
`statModifiers` ONLY, never `baselineStatModifiers` — the first is what this fight
inflicted, the second is the loadout, and a target's armor must not arm its punisher. Any
negative entry counts, however small, and a foe held at its floor still counts.

It replaced `doublesStatReductions` (2026-09-14): with the stat floor at −½ of base +
loadout, one scaled Mid debuff floors most targets and a doubling from there landed 0. A
"double the reductions" verb cannot be authored under that floor; a hit that cashes them in
can.

### `offStatOverride`

`offStatOverride: 'defense'` (Stone's Body Blow, Body Crush) makes the ratio's
**numerator** read a named stat instead of the one `category` selects. **Pipeline 1** —
it changes which stat is read, it does not scale anything, so it composes with every
multiplier term like an ordinary move and nothing enters the damage pipeline. Only the
numerator moves; the defender still blocks with the category's stat.

If you author one, thread it into `MoveDetailOverlay`'s `forecastAgainst` as well as
`resolveRound` — the dossier calls `resolveStatRatio` itself, and a forecast reading
the wrong stat is the §5 "the forecast lies" failure in its purest form.

### `recoilPercent`

`recoilPercent: 0.25` (Stone's Rubble Rush) is the exact mirror of `drainPercent`:
scaled off the HP actually removed, no formula of its own, summed across a spread
move's targets. Two differences worth knowing before you author one — it is paid
**once, after the target loop** (a caster that faints mid-move must not keep hitting),
and it **can faint the user**, with no floor.

Fire's Volcanic Surge, which takes recoil as a self-inflicted Burn, is still the better
shape when the cost is a flat authored number; reach for `recoilPercent` only when the cost has to be a fraction of a hit
nobody knows until it lands.

### `selfHpCost`

`{ mode: 'percentMaxHp', amount: 0.25 }` (Spirit's Soul Offering) or
`{ mode: 'reduceToHp', amount: 1 }` (Last Rites) is the HP a move charges its
own caster. The **third** self-harm shape, and the only one whose price is
knowable before the button is pressed — `recoilPercent` bills a fraction of
damage *dealt* (unknown until the hit lands, and meaningless on a move with no
damage body), and Fire's self-Burn bills a flat magnitude spread over rounds.
Reach for this one when the design row names a share of the caster's own bar.

Four things fix its shape:

- **It can faint the user**, no floor — the same answer `recoilPercent` got.
  `reduceToHp` cannot by construction; `percentMaxHp` at low HP can.
- **`reduceToHp` is a `Math.max`, never an assignment.** A caster already at or
  below the floor pays nothing rather than being healed up to it.
- **Paid last, after the payload**, directly before `switchesUserOut` — so the
  buff reaches the ally even when the bill kills the caster, and a caster that
  killed itself cannot then pivot.
- It emits its own **`selfCost`** on the DamageDealt event, not `recoil`. The
  log has to name which bill it is, and both carry identity formula terms.

### `retributionPercent`

`retributionPercent: 0.5` (Stone's Retribution, and 1 on Stoneheart) replaces the
move's whole damage body with a share of `Combatant.damageTakenSinceLastTurn`. Such a
move authors **no `basePower`**.

It is **fixed damage**: the formula is never evaluated, so no ratio, STAB, TypeMult,
variance or crit — and, importantly for replays, **no RNG is drawn**. The counter
accumulates at `applyHpDelta` (so every damage source counts) and resets when the
combatant commits to an action; a blocked or fizzled action does not reset it. Pressing
one with nothing banked deals 0 and still costs the mana.

### `target`

`singleEnemy` · `bothEnemies` · `singleAlly` · `bothAllies` · `self` · `allOthers` ·
`randomAlly` · `randomEnemy`.

The two random modes draw one target from the seeded RNG at resolution
(`targeting.ts resolveTargetsRolled`). The view groups them with the fixed-group
modes — the target row shows the candidates and doubles as the confirm control,
because there is nothing to pick.

**"Spread" in a design table means `bothEnemies`.** `allOthers` also catches your own
partner — a real authored downside, so only use it when the table says so explicitly.
There is no spread-damage reduction; this is a doubles-only game.

### `critChance`

Per-move override of the 1/16 default. How it should combine with equipment crit, once that
exists, is open (`docs/combat.md` "Crit").

### `randomBasePower`, `randomPriority`, `randomStatDeltas`, `randomStatusApplication`

Mech's four ways to attach chance to a move. Three roll after the commit and draw from the
round's stream; `randomBasePower` is shown on the button before the commit, so it is
derived from `(seed, round, combatantId, moveId)` and never drawn (`docs/combat.md` "Base
Power that is rolled, not authored"). Read it through `resolveCastBasePower`.

### `conditionalPower`

`{ requiresTargetStatus: 'Burn', multiplier: 3 }` — multiplies the move's **BasePower
input** when the target carries the named status. Read per target, off live statuses, so
a status applied earlier in the same round already counts.

Swap in `requiresUserStatus` (Nature's Seed Shot, Branch Slam — "double damage
if the user has Renew") and the same multiplier asks about the **attacker**
instead. Swap in `requiresFieldEffect` (Light's Smite — "double damage if
Sanctuary is active") and it asks about the **board**, which nobody holds:
`CombatState.activeFieldEffect` is one global slot, so a spread cast is doubled
against every target or none, an enemy setting the field arms your move and
yours arms theirs, and *any other* field effect displaces it. `consumesStatus`
is inert on that form — there is nothing to strip.

Swap in `requiresTargetHpBelow: 0.5` (Shadow’s Rend, Eclipse — "double damage
if the target is below 50% HP") and it asks about a **number** rather than the
presence of anything: the target’s live HP fraction, read per target, checked
STRICTLY below the line and BEFORE this hit’s own damage, so an execute can
never double off HP it is itself about to remove. `consumesStatus` is inert on
this form too.

Swap in `requiresUserHpBelow: 0.5` (Spirit's Spite ×2, and Vengeance ×3 at
0.25) and it asks that same number of the **attacker**. The fifth sibling, and
the one behavioural difference that matters: it is asked **once per cast**, off
a snapshot taken before the target loop, so a spread cast is doubled against
every target or none — where the target-HP form is re-read per hit. The
snapshot is load-bearing rather than incidental: a move carrying both this and
`drainPercent` would otherwise heal itself back over the line partway through
its own target list. `consumesStatus` is inert here too.

With `requiresPartnerType` and `requiresTargetStatReduction` (below) that is seven forms.
Author exactly one; nothing in the type system validates that, and a `conditionalPower`
authoring none is a silent dud — but `test/shadowMoves.test.ts` pins "exactly one side"
across the WHOLE move table, so extending that list is the cheapest part of adding an
eighth, and it fails the moment you author the new field.
Two behavioural differences worth knowing before you reach for it:

- The target-side form is re-read per hit, so a spread move can double against
  one foe and not the other. The user-side form asks one question about one
  combatant, so a spread cast is doubled against **every** target or none.
- A bonus that lives on the caster is one the enemy cannot interact with at
  all. Burn/Freeze/Conduct can be cleansed, switched off, or simply not be on
  the target you picked; if the status you read is `positive` and survives a
  switch — as Renew is and does — the condition is effectively unconditional
  from the second turn onward. That is intended (`docs/combat.md` "Renew's stacked
  payoffs") and priced in mana.

Add `consumesStatus: true` (Frost's Cold Snap) and the hit that actually got the
multiplier also **strips** the status, as its own `StatusRemoved` beat with reason
`consumed`. Opt-in: Fire's Immolate authors the multiplier without it. Worth
authoring when the type also has a `requiresTargetStatus` move, because that is
what turns "which move do I press" into a real choice — spend the mark, or keep
it as the key.

---

## 4. What the engine cannot express yet

If a row needs one of these, **stop and say so** before improvising. Some are cheap
extensions; some are design decisions above your pay grade. Either way, name it.

Already built, so not on this list: multi-hit (`hitCount`), recoil and HP costs
(`recoilPercent`, `selfHpCost`), Shield and redirects (`Shield`, Provoke, Barrier), two
riders on one move (a rider list), random and field-conditional targeting.

- **Two-turn / charge / recharge moves.** Nothing in the round model supports a move
  that spans rounds. (`switchesUserOut` resolves entirely within its own round.)
- **A self-cost that is a flat authored HP number.** No field; Fire's self-Burn is the
  shape for it.
- **Damage negation beyond the Shield pool**: a negation lasting more than a round, or
  damage reduction as a percentage. Both would be new vocabulary; `docs/shield.md` §3.1
  says why the Shield is a pool and not a timer.
- **A move that applies a damage-pipeline modifier** ("+20% Fire damage for 3 rounds").
  `DamageModifier` exists but is fed only by Passives, never by moves.
- **A relationship between two riders**: "apply X only if Y landed", or a compound status
  that is more than its two halves.
- **Targeting the bench**, and conditional targeting beyond the two shapes that exist
  (`requiresTargetStatus`, `conditionalTarget` on the field slot): "only the slower foe",
  "only a full-HP ally", gating on the *absence* of a status.
- **Percentage stat modifiers.** Flat bases only — scaled off the caster (§3 `statDeltas`),
  with `derivedStatDeltas` the one unrounded exemption. A delta scaled as a *fraction* of
  anything is a conversation.
- **Accuracy.** Moves always land. A "70% to hit" row is a `chance`-gated *rider* or it
  is a conversation.
- **Priority or cost that reads a NUMBER**, or any state shape not already covered
  (`manaDiscountOnUse` / `manaCostGainOnUse`, `conditionalManaCost`, `conditionalPriority`).
  "Costs double while Burned" and "priority scales with missing HP" are conversations;
  `conditionalPower` reads numbers, but no cost or priority field does.
- **Field effects of a non-standard duration**, or more than one active at a time.

There is also **no `isValidMoveDefinition`** — nothing catches a magnitude-shape status
authored without a `magnitude`, or a `basePower` on a heal. Be careful, and consider
writing one if your slate makes the gap bite.

---

## 5. How to extend the vocabulary correctly

Fire needed four new fields. The discipline that kept them clean, in order:

1. **Make it generic, and name it for the mechanic, not the move.** `conditionalPower`,
   not `immolateBonus`. Data, not a predicate function — same rule as
   `StatusDefinition.triggerTypes`. If a content file wants bespoke logic, that is a
   smell; extend the vocabulary instead (`CLAUDE.md`).
2. **Decide which pipeline it belongs to, and write down why.** The two-pipeline
   separation is locked. A BasePower-stage term (Elemental Force, `conditionalPower`)
   changes the formula's *input*. A `DamageModifier` scales the *result*. They are not
   interchangeable, they compose differently, and getting it wrong is invisible until
   two of them stack. There is a test in `test/fireMoves.test.ts` that asserts the
   conditional multiplier does **not** leak into `multiplierTerm`; write its equivalent.
3. **Default to inert.** A new optional field must leave every existing move byte-identical.
   For anything that draws RNG, that means *drawing nothing at all* when the field is
   absent — `StatusApplication.chance` only touches `rngState` when present, and there
   is a test asserting an unchanced rider costs the same RNG as no rider. Golden replays
   depend on this.
4. **Thread it through the three player-facing surfaces.** A rule the player cannot see
   is a bug:
   - `MoveTile.tsx` `moveEffectSummary` — the one-line summary on hero sheets and pickers.
   - `MoveDetailOverlay.tsx` — the hold-to-inspect dossier: an `EffectRow`, plus the
     damage forecast if the field changes damage (it calls the engine's own
     `calcDamage`, so pass your new term in or the forecast lies).
   - `FightScreen.tsx` `MoveRow` — the chips on the button itself, which is where the
     decision is actually made. Fire's `+Burn` chip had to learn to say `10% Burn` and
     `+Burn (self)`, because otherwise Ember reads as a guaranteed Burn and Volcanic
     Surge reads as burning the *enemy*.
5. **Carry it on the event if it changes the math**, and print it in the Battle Log's
   readout (`events.ts` `DamageDealtEvent`, `formatEvent.ts`). The log claims to show
   the whole formula; a term missing from it makes the log wrong, not merely terse.
6. **Update the docs** — `docs/combat.md` for damage math, `docs/conditions.md` for
   status behaviour — especially where you touch something the designer has locked.

---

## 6. Removing the old moves (where the time actually goes)

`grep -rn "<oldId>" --include=*.ts --include=*.tsx --include=*.md . | grep -v node_modules`
for **every** id you delete, before deleting it. Expect hits in five places:

1. **`heroes.ts` starting kits** and **`progression.ts` pools** — obvious.
2. **Enemy kits** — the Titanspawn kits in `titanspawn.ts` and the champions in
   `enemies.ts`. Easy to miss (§8).
3. **Fixture tests, heavily.** `test/combat.test.ts` alone referenced Fire's `emberSlash`
   more than a dozen times, as the generic "a physical attack happens" stand-in. Repoint them to
   the nearest new move rather than rewriting the tests: pick a **cheap, low-BP,
   single-target** replacement so you do not accidentally turn a targeting test into a
   KO test. Fire used `singe` (30 BP / 20 MP) for all of them.
4. **Off-type pools.** Fixture content put `wildfire` in mono-Nature Sylva's pool. When
   the Fire move dies, that slot needs a same-type replacement, not a Fire one.
5. **Docs and code comments** naming the move as an example — `docs/field-effects.md`
   named `scorchTheEarth` as Scorched Land's setter, and `src/data/fieldEffects.ts` had
   it in a comment.

**Watch for coverage you are deleting, not just references.** Three fixture Fire moves
were the *only* content exercising an engine path: `stokeTheFlames` (a move granting
Elemental Force), `cinderBite` (a physical Fire move applying a status),
`scorchTheEarth` (a field-effect setter). The slate replaced two of the three; the
Elemental Force vector it did not.

When the slate leaves a path uncovered you have exactly two honest options: **move the
coverage into a test-local move definition** (with a comment saying why it is not
content), or **tell the designer the slate has a gap**. Do not quietly re-add the old
move as content, and do not let the path go untested because the content went away.

Do both, in fact. Fire's Elemental Force vector went to a test-local stand-in *and* into
the hand-off, and the designer re-authored the move a day later at 30 mana and
`bothAllies` instead of 12 and `self` — better content than the fixture move, and it
only exists because the gap was named instead of absorbed. **This is the highest-value
thing you do on one of these slates.** The mechanical work is an afternoon; noticing what
the slate silently dropped is the part only you are positioned to do.

---

## 7. Distributing the slate

**Starting kits** (`heroes.ts` `moveIds`) are exactly two: one low-power main-type
attack and one move that is not an attack, chosen so the hero's innate passive fires off
the kit (`CLAUDE.md`; Widow is the named exception). Pick the attack by the stat the hero actually attacks with —
compare `attack` against `intelligence` in its `baseStats` and give it a `physical` or
`magical` move accordingly. A hero whose only damage move is off its better stat is the
"trap pick" the north star forbids.

**Level-up pools** (`progression.ts` `moveTiers`) get the Mid/Late moves, split by the
same physical/magical read so each hero gets a coherent line rather than a random ninth
of the slate. Two rules:

- **Never list a hero's own starting move in its pool.** `levelMovePool` filters out
  anything already unlocked, so it is dead weight that can never be offered.
- Keep the pool a *line*, not a sample. Fire went: Cinder (Atk 70) took the physical
  line, Crimson (Int 80) the magical burst line, Brimstone (Fire/Shadow) the
  spread-and-attrition line.

**Dual-typed heroes** keep their other type's moves in the pool alongside yours.

**Off-type Early entries are policy, not leakage** (2026-09-05). Every pool carries a few, drawn
from the *commodity layer* — each slate has the same Early shape (a bp40/mp20 single-target attack
with a small chanced rider, plus mp15-25 buffs), and those rows carry no engine role, so any hero
can hold them. They exist because ten heroes had Early pools with no damage move at all, which is
three level-ups paying out nothing the player can press. Three rules:

- **Pick on the stat the hero attacks with.** Magical: Magic Bolt, Psi Bolt, Wisp, Umbra Bolt,
  Glimmer, Jolt, Ember, Backfire. Physical: Claw, Iron Fist, Rock Toss, Ice Shard, Holy Strike,
  Vine Lash, Cog Bop, Fade Strike, Phantom Strike, Thunderclap, Heavy Blow, Opening Strike.
- **Never pick the move an Evolution path already hands over** (`test/roster.test.ts`). A type has
  exactly one Early attack per category, so "give the hero a taste of the type it may graft" and
  "the graft delivers that type's line" collide by default. Telegraph a graft with a DIFFERENT move
  of that type where one exists, and where none does, do not telegraph it — a base pool carrying the
  branch's own move spoils the branch instead of foreshadowing it.
- **Commodity means no engine role.** Seed Shot looks like one and is not: its `conditionalPower`
  keys off Renew, so a hero with no Renew source gets a dead conditional
  (`test/natureMoves.test.ts`). Read the riders before you share a move out.

**Enemies**: a Titanspawn kit is a fixed 3 / 4 / 4 by tier, drawn from the type's slate
(`titanspawn.ts`), so a new move takes a seat by swapping one out; champions are authored in
`enemies.ts`. Check every holder's mana (§8).

---

## 8. Traps that cost real time on Fire

- **Statuses tick at end of round, in the same round they were applied.** A move that
  applies `Burn 10` leaves the target on `Burn 5` at the end of `resolveRound`, because
  the end-of-round tick fired it and halved it. Every test assertion about a freshly
  applied magnitude status must expect the **post-tick** value. (A field effect that slows
  decay changes it — Scorched Land keeps ¾ rather than half.)
- **The fixture heroes are far too fragile for an authored slate.** Crimson's Ember into
  Warden is `40 BP × 1.6 ratio × 1.25 STAB × 2 type` — well past Warden's 135 HP. **A
  target that faints to the hit never reaches the riders at all**, so a rider test
  silently becomes a KO test that passes for the wrong reason, or fails inexplicably.
  Give test defenders a large `currentHp` **and** a matching `hp` stat modifier
  (`getMaxHp` reads `baseStats + statModifiers`, never `currentHp`).
- **An authored slate's mana curve is steeper than the fixture one.** Fire's floor went
  from 4–20 to 15–75, and five basic enemies in turn could no longer afford their kits.
  Check every holder — heroes *and* enemies — against the new floor, and raise the enemy's
  mana rather than cheapening the design.
- **Don't check a cost against a starting pool.** All five early slates reported their
  capstone as "above every hero's pool", comparing against `baseStats.manaPool` — the
  **starting** pool. Heroes gain mana all run (`docs/mana.md`); a capstone the roster
  cannot cast on turn one is the intended shape.
- **Price the Late column so a hero at the Late band can cast it twice a fight.** What binds
  is not pool ≥ cost but pool + a fight's regen ≥ 2 × cost — measured (2026-09-13) when Late
  was 4.5% of all casts and capstones landed once a fight. **The conventions in force: a
  single-target Late is 55+, a spread Late 65+, a spread Mid 60+; signatures 45–60; the 100+
  whole-pool casts keep their price.** Spread damage costs more because there is no spread
  reduction — a spread hit at a single hit's price topped every damage-per-mana table. These
  are floors, not prices: the eight most-cast Late moves sit 10 above them (2026-09-28,
  `docs/mana.md` "Growing the pool"). The history of the re-prices is in `CLAUDE.md` and
  `docs/xp-overhaul.md`.
- **Enemy kits are the real version of the affordability check.** A Titanspawn kit or a
  champion that cannot afford its own moves is a live finding — raise its mana rather than
  cheapening the design. Same for a HERO that cannot afford its own two-move **starting
  kit**, which is the one thing a player cannot fix by drafting.
- **A deleted move's PRIORITY can be load-bearing in a test, not just its id.** Water's
  slate authors no priority column, so every Water move is bracket 0 — and repointing
  `test/statuses.test.ts`'s Freeze-order test from the old priority-1 Aqua Jet onto a
  priority-0 replacement silently put its two actions in *different brackets*, which
  makes a Speed-tiebreak assertion pass or fail for reasons that have nothing to do with
  Speed. Check the `priority` of what you delete, not only the `id`. The general form:
  **a fixture move's every field is potentially what a test is standing on.**
- **Bash heredocs break on apostrophes in this environment.** Use the `Write` tool for
  patch scripts, run them with `node`, and normalise CRLF (`s.split('\n').join(nl)`) —
  the repo is CRLF. Write scripts that **assert an exact match count** before replacing,
  so a silent no-op fails loudly.

---

## 9. Verification checklist

```bash
npm test
```

```bash
npm run typecheck:view
```

Then, beyond green tests:

- **No dangling ids, checked by a test.** `test/waterMoves.test.ts` carries two worth
  copying: one walks `heroes` + `enemies` + `progressionTable.moveTiers` asserting every
  move id resolves, the other asserts no hero lists its own starting move in its pool
  (dead weight `levelMovePool` can never offer). Write them over the whole roster (§10).
- **No orphans you did not mean.** The reachability set in `test/stoneMoves.test.ts` (§10).
- **Test the mechanic, not the balance.** `test/fireMoves.test.ts` and
  `test/waterMoves.test.ts` are the model: assert
  that a chanced rider rolls, that a conditional multiplier lands on BasePower and not
  on `multiplierTerm`, that a debuff applies after its own hit. Do **not** assert
  specific damage numbers — those are balance and will move.
- **Look at it in the app.** `preview_start` the dev server, open Sandbox Battle, add
  one of your type's heroes (the sandbox exposes their whole pool as checkboxes, which
  is the fastest way to confirm the distribution landed), start a fight, and read the
  move rows:

  ```js
  [...document.querySelectorAll('.move-button')].map(b => b.innerText.replace(/\n/g,' | '))
  ```

  This is where Fire's `10% Burn` and `×3 vs Burn` chips were confirmed. Note the
  browser pane has a zero-size viewport when hidden, so coordinate clicks miss —
  drive it with `find`/refs and `javascript_tool`, not screenshots.

---

## 10. Report the design questions you hit

The last part of the job is telling the designer what the slate *implied* that they may
not have decided. `CLAUDE.md`: present tensions and second-order questions, and prefer
deferring an open question explicitly over forcing premature closure.

Every slate's findings fell into the same three shapes. Use them as the template:

- **A capability the slate deleted.** Run the §6 grep and say what went away — Fire's only
  move-granted Elemental Force, Water's and Shadow's bracket rows, Nature's only heal-kind
  and spread moves, Light's cleanse-all, Iron's Fortify (in nine kits across seven types).
  "No gap" is a finding too. A named gap tends to come back as *better* content, not as the
  old row (Stoke the Flames at 30/`bothAllies`, Fortify at 15 for +15 Defense, Swift Blow) —
  and a re-authored move is not an undo: only the kits whose slot it suited take it back.
- **A locked decision the slate brushed against.** Each new field that touched a lock was
  recorded in `docs/combat.md` rather than settled by accident: a second crit source, a
  second way to restore HP, an unpressable move, fixed damage outside the formula, an
  unbounded resource, the stat floor, a condition the defender cannot answer, a second
  random term.
- **A balance consequence outside the slate.** A re-priced shared move with a cross-type
  blast radius (Second Wind in six kits, Rally in six), a holder that cannot afford its own
  starting kit, a move whose value swings with team composition.

**Do not report these again — they were each answered:**

- *"The capstone costs more than any hero's pool."* A misreading of `baseStats.manaPool` as a
  ceiling; it is a starting value (`docs/mana.md`). Reported by five slates before anyone
  caught it. If your only balance finding is that expensive moves are expensive, say you
  found nothing.
- *"Renew's payoffs stack."* Intended and locked (`docs/combat.md` "Renew's stacked
  payoffs"). A FOURTH reading of Renew, or one that reads another hero's Renew, would be new.
- *"These moves have no holder."* A normal state (Stone's three magical rows, a designer call):
  a slate is authored for the type, not for the heroes that currently have it. The
  deliverable is the list, pinned as an exact set in `test/stoneMoves.test.ts`, never a move
  stuffed into the nearest pool. Update the list when a slate legitimately adds to it; never
  delete the assertion.

**Procedural lessons:**

- **Distribution is a roster audit wearing a movepool hat.** Six slates running, §7 surfaced
  a roster problem nothing else would have: two heroes with byte-identical stat blocks and
  Evolutions (Vesper/Marrow — Marrow became the type's Intelligence user), kits and pools that
  overlapped, a hero with no damage move, a kit move listed in its own pool. **Write the §9
  assertions over the WHOLE roster**, not your type's slice — the type-scoped version shipped
  four times and missed one.
- **Run the reachability check as well as the dangling-id one.** They are opposite failures:
  a pool pointing at a move that does not exist, and a move no pool points at.
- **Write the exact-set assertion, not the count.** Iron pinned "every Wisdom grant is Mind"
  as a set, and Mech's Overdrive failed it on the first run — which is what the set is for.
- **If your type has a type-keyed status hook** (Conduct on Storm/Iron/Mech, Haunt on
  Spirit/Mind), count how many of its damage moves carry the hook for free and pin the count —
  Storm detonates on ten of fifteen, Iron cashes on every damage row and plants nothing,
  Spirit spreads twelve single-target hits through Haunt. That is the type's engine and it is
  invisible in the table.
- **Ask the extension question in a form that invites the system answer.** "What does a
  second cast do?" got the stat floor; "which multiplier?" would not have (Mind).

### The slates on record

What each slate added to the engine, and the identity facts its `test/<type>Moves.test.ts`
pins as design rules (a count pin moves; an identity pin does not — §11):

| Slate | Engine vocabulary it added | Standing identity facts |
|---|---|---|
| Fire | `conditionalPower`, `critChance`, chanced riders, `statDeltas` on damage | self-Burn is a flat, knowable cost |
| Water | `drainPercent`, `cleanseCount`, `manaDiscountOnUse` | no bracket play: Water's tempo is Speed and mana |
| Frost | `requiresTargetStatus`, `consumesStatus` | every gated move ships beside a guaranteed Freeze |
| Storm | random targeting, rider `target`, `conditionalPriority`, `conditionalManaCost` (all), `switchesUserOut` | plants and cashes its own Conduct |
| Stone | `offStatOverride`, `retributionPercent`, `recoilPercent`, `statDeltaTarget` | magical rows live off-type (designer call) |
| Nature | `requiresUserStatus`, `detonatesStatus` | healing is Renew, not heal-kind moves |
| Light | `requiresFieldEffect` | Daze is a flinch; content cleanses one status, never all |
| Shadow | `requiresTargetHpBelow`, `hitCount` | Ambush is the type's keyword; its one bracket row is +1 |
| Arcane | `manaGrant` and overflow, `conditionalTarget`, `derivedStatDeltas` | Mana Tap costs 0, so its holder is never forced to Rest (pinned) |
| Mind | `statDeltaChance`, the stat floor, `requiresTargetStatReduction` | Mind plants Conduct and a partner cashes it |
| Spirit | `requiresUserHpBelow`, `selfHpCost` | heals only its caster; every hit is single-target, Haunt spreads it |
| Iron | `conditionalManaCost.requiresAnyEnemyStatus` | cashes Conduct, plants none — a doubles dependency by design |
| Beast | `requiresPartnerType` (three hosts), rider lists, `userEffectiveAttack` | buys speed, never debuffs |
| Mech | `randomPriority`, `randomStatDeltas`, `randomStatusApplication`, derived `randomBasePower` | plants Conduct and Haunt, cashes its own Conduct only |
| Ancient | none | enemy-only; see below |

### Still open from the hand-offs

- **The price floor.** Seven slates each deleted the fixture era's 5–10 mana pokes (authored
  floors start at 15, cheapest attacks at 20), each reported as a per-type identity call. It
  is in effect a global policy that was never stated or decided as one.
- **Crit composition** and **whether a `DamageModifier` reaches fixed damage** (retribution,
  detonation): both in `docs/combat.md`.
- **No `applyManaDelta` chokepoint.** Mana's "may exceed the pool" invariant lives in prose
  and `test/arcaneMoves.test.ts`; a future mana writer could reintroduce a clamp without
  failing anything. Worth adding if a second mana-moving mechanic lands.
- **Conjured Sword's other holders** — a "lategame learnable for certain spellcasters" placed
  in two pools; which other casters learn it is a roster decision left open.
- **Arcane Overflow's Attack half** pays only on a physical partner — named, not tuned.
- **Abide on a Guardian** (below).

### Ancient

**Ancient (2026-09-17), the fifteenth and last.** No designer's table: the slate was
authored from three constraints the docs already lock — every Ancient hit resolves at 1×
(`typechart.ts`, *a seal is not a weapon*), no hero is ever Ancient (`types-and-heroes.md`,
so there is no pool and no offer to gate), and the Herald's own note that *a Titan does not
need to hit harder, it makes everything else softer*. Eleven moves plus the Eyes' five, all
tiered (the tier is descriptive, since nothing offers an Ancient move, but the mana
conventions read off it). Zero engine extensions.

| Move | Tier | Shape | Holder |
|---|---|---|---|
| Runic Blast | Early | 50 BP single, 20 | Skeleton King |
| Warding Sigil | Early | Shield 30 on self, 25 | Elder Bough |
| Forgotten Curse | Mid | 40 BP spread, −10 Wis both, 35 | Yugzulach, the Right Eyes |
| Archon Blast | Mid | 55 BP single, +20 Wis self, 40 | Manticore, Kraken, the Left Eyes |
| Weight of Ages | Mid | **physical** 50 BP spread, −15 Speed both, 50 | Dragon |
| Transfix | Mid | **physical** 40 BP single + Daze, 40 | the Herald |
| Long Drink | Mid | **physical** 60 BP single, drains half, 45 | Yugzulach |
| Erode | Mid | −20 Def / −20 Wis both foes, 45 | the Herald, the Left Eyes |
| Raise the Standard | Late | +20 Atk / +20 Int both allies, 50 | the Herald |
| Oblivion | Late | 120 BP single, 70 | the Herald |
| Abide | Late | heals the user, 60 power, 45 | Elder Bough |

The figures in this table are the slate as authored; the finale's re-fits since (Oblivion
90, Erode −15 — `CLAUDE.md`, `docs/titan-eyes.md`) live in `src/data/moves.ts`.

- **Bodies sit 10–20 under the hero slates' at each tier** because Ancient STAB is never
  resisted.
- **Three hits are physical** (Weight of Ages, Long Drink, Transfix), per user direction: an
  all-magical enemy type would make Defense worthless in every Guardian fight and the finale.
  The Eyes, at 40 Attack, hold none.
- **The Herald's threat is its company, not its hand.** Erode and Raise the Standard do no
  damage; the fight's difficulty lives in what the Late spawn beside it do under them.
  Oblivion's BP is the dial that moves the Herald's own fight; Erode's figures move the
  escorts.
- **Transfix is a certainty on the Herald and a gamble on anything slower** — Daze takes a
  turn only if it resolves first, and the Herald's Speed outruns every hero.
- **Orphans were placed, not left**: Yugzulach took Long Drink, the Dragon Weight of Ages, the
  Elder Bough Warding Sigil and Abide.

**Open, for the designer:** whether Abide belongs on a Guardian at all, given the Elder Bough
measures as the softest Act 2 wall either way.

---

## 11. The 2026-09-15 expansion: two to four a slate, on the existing vocabulary

Thirty-nine moves across the fourteen authored slates, no engine field added (Sanctuary's
`healMultiplier` is a Field Effect flag, not a move one). Per user direction: the thin slates
took four (Storm, Nature, Mech, Beast were at 15), the sixteens three, the rest two, and the
brief was *combine ideas or statuses that already exist* plus the Field Effect fix in
`docs/field-effects.md` "Why four of five never appeared". What it added, by shape:

- **Field riders** (a type's ordinary Early job that also sets its field): Sow, Hallow, Distort.
- **Field readers** (`conditionalPower.requiresFieldEffect`, ×2): Flare Up, Resonant Bolt,
  Hindsight, Sunlance, Verdant Lash. **Pool a reader beside a setter** — the same rule as a
  status conditional beside its applier (§7); a Herald Boon is a second route, not the one the
  pool relies on.
- **Elemental Force self-buffs**: Undercurrent, Hoarfrost Edge, Static Charge, Soulfire (Force
  25, 20 mana, Early). Force is the one self-buff a pivot keeps (`clearsOnSwitch: false`), it
  is pre-ratio BasePower so a multi-hit or a spread pays it more than once, and a hero holding
  one makes the enchant axis readable on its own sheet. Stoke the Flames stays the whole-side
  version.
- **Pivots**: Blazing Retreat (Burn then out), Ride the Lightning. Not in a spawn kit — the
  enemy AI declares no `switchToCombatantId`.
- **Status combos on one card**: Stunning Bolt (Conduct + chanced Daze), Bodyguard (Shield on
  the ally, Provoke on self, priority 1), Blood Trail (Bleed + `conditionalPriority` on Bleed),
  Shield Bash (`offStatOverride` Defense + chanced Daze), Rootbind (Poison + −30 Speed), Grim
  Harvest (`detonatesStatus` Poison + drain), Blinding Snow (chanced spread Daze at +1, a gamble
  rather than the lockout Feint prices by the fight), Heat Haze, Parry, Patch Up, Séance.
- **Plain rows** the slates lacked: a Mind drain (Mind Leech), a Nature drain (Leech), a Mech
  Conduct planter (Shock Coil — the type detonated it and never planted it), an Arcane
  two-hit (Twin Cast), Late spreads for Storm, Mech and Beast (Ion Cascade, Salvo, Rending Leap).
  Mech later got the loop the other two detonators have (2026-09-17): an Early planter (Spark
  Plug, guaranteed Conduct) and a reader (Whirling Blades at half price beside a mark). The
  discount rarely fires under the sim's one-ply pilot, because any Mech hit consumes the mark
  it would read; the card's value is the plant-then-spread line a player can plan.

**The slate identities held, and the tests said which.** Every `test/*Moves.test.ts` pins a
shape beyond a count, and three drafts broke one: a Beast intimidate (the slate never debuffs —
"the type buys speed, never trades it"), an Iron cleanse (the slate has no heal, cleanse or
field), a magical Mech spread (four magical rows, pinned "against a roster whose best
Intelligence is 45"), and a Spirit spread (every Spirit hit is single-target; Haunt is what
spreads it). Each was re-authored inside the identity rather than the pin moved. **A count pin
moves; an identity pin is a design rule** — read the assertion's message before editing it.

**Distribution** (§7 unchanged): each move went to two or three pools on its category line,
the readers beside their setters, and one seat in the fitting Titanspawn kit (each a swap,
since the kits are a fixed 3 / 4 / 4) — so the enemy side sets fields too, which the "no
owner" rule makes into counterplay. Full-clear unmoved (`docs/field-effects.md`).
