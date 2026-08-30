# authoring-moves.md

**A runbook for turning one type's designed move table into shipped content.**

The designer hands over a slate of ~15 moves for one type, as a table with the columns
`Move Name / Phy·Mag·Buff·Heal / Base Power / Mana Cost / Effect / Early·Mid·Late`, and
asks you to remove that type's existing moves, replace them, and "distribute them
appropriately."

Fire was the first (2026-08-29), Water the second, Frost the third, Storm
the fourth and Stone the fifth (all 2026-08-30). Ten types remain. This file is what those five cost to learn, written
down so the next one is an afternoon instead of a day. Water took about a third of
Fire's time and Frost about the same as Water, and every hour of the saving came from
§0 step 1 — naming the engine extensions before writing any content. Frost needed two
(a targeting gate and a status consume) and both were visible in the table on the
first read: the words to watch for are "can only target" and "consume".

Storm needed **four**, and is the reason step 1 now says *stop and ask* as well as
*name it* (§10). Its words to watch for were "randomly", "switch out", "priority
+1 if", and "costs 0 if" — every one of them a row that reads as a small clause
and lands as an engine decision.

Stone needed **five**, the most of any slate so far, and confirmed Storm's lesson
rather than adding a new one: four of the five were asked about in a single round
trip before any content was written, and none of them had to be rebuilt. Its words
to watch for were "in place of", "damage the user took", "as recoil", "redirect",
and — the one that hides — **"Allies gain"** on a row whose damage targets enemies.
That last one reads like an ordinary `statDeltas` clause and is actually a second,
independent targeting resolution. **The general form of the trap: whenever one row's
payload lands on a different side of the field from its damage, that is an engine
field, not a rider.**

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
   pools, enemies, tests, docs.
5. **Distribute** (§7): starting kits, level-up pools, enemy loadouts.
6. **Verify** (§9) and report the open design questions you hit (§10).

Expect the mechanical part to be fast and the *removal* to be where the surprises are.

---

## 1. Files you will touch

| File | What it holds | Always? |
|---|---|---|
| `src/data/moves.ts` | Every move, as pure data. The main event. | Yes |
| `src/data/heroes.ts` | `moveIds` = each hero's **3-move starting kit**. | Yes, for your type's heroes |
| `src/data/progression.ts` | `moveTiers[heroId]` = the **level-up pool** drawn from as a hero levels (`MOVE_CAP` is 4, so a hero ends a run with its 3 starters plus one pick, or a swap). | Yes |
| `src/data/enemies.ts` | Enemy heroes have `moveIds` too, and much smaller mana pools. | If your type has an enemy |
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

### `Mana Cost` → `manaCost`

Mana is the primary balance lever (`CLAUDE.md`) — there is no accuracy stat, so cost is
what separates a cheap poke from a finisher. Sanity-check the slate's **floor** against
the mana pools of the heroes and enemies that will hold it (§7, and the trap in §8).

### `Effect` → riders

See §3. Every rider is an optional field layered on top of the move's kind; a damage
move can carry all of them at once.

### `Early / Mid / Late` → `progressionTable.moveTiers`

**Not an engine field.** It is the level-up pool a move belongs to. Early moves are
starting-kit candidates; Mid/Late go in `moveTiers`. There is currently no per-tier
gating in `src/run/progression.ts` — the pool is one flat list per hero, offered at
random — so the tier column is your guide for *which hero gets what*, not a value you
encode. If the designer wants tiers actually gated by level, that is a progression
change and a conversation, not a moves change.

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
  (recoil, or a self-buff). `'randomAlly'` / `'randomEnemy'` (Storm's Rising
  Static) let the rider resolve its OWN target, independently of the move's —
  which is how one move buffs an ally and marks an enemy in the same cast.
- `magnitude` for magnitude/timer statuses; `duration` for duration statuses.
- `chance: 0.1` gates the rider on a roll. **It gates the rider, never the move** —
  the damage still lands (`CLAUDE.md`: no accuracy stat). Rolls once per target.
- **A move can carry exactly ONE `statusApplication`.** If a design row wants two
  statuses at once, that is an engine change (the field would have to become a list)
  and worth raising before you build it.

The catalog (`src/data/statuses.ts`, `docs/conditions new.md`):

| Status | Shape | Behaviour | Cleared by switching? |
|---|---|---|---|
| `Burn` | magnitude | End of round: deal X, then **halve** X | Yes |
| `Renew` | magnitude, positive | End of round: heal X, then halve X. Cleanse never strips it | No |
| `Bleed` | boolean | End of round: 5% of max HP, flat | No |
| `Freeze` | boolean | Halves Speed | Yes |
| `Daze` | duration | Cannot attack (can still switch or Rest) | Yes |
| `Poison` | timer | Magnitude builds, duration only ticks while active, detonates at 0 | No (stalls on the bench) |
| `Conduct` | boolean | A Storm/Iron damage move detonates it for bonus %maxHP | No |
| `Haunt` | boolean | A Spirit/Mind single-target hit on the partner also strikes the holder | Yes |
| `Stealth` | duration, positive | Cannot be targeted; a single-target attack already aimed here is redirected to the partner. Spread moves still land | No |

Two of these have **type-keyed hooks** that fire automatically off any damage move of
the right type (`StatusDefinition.triggerTypes` for Conduct, `spreadTriggerTypes` for
Haunt). If you are authoring Storm, Iron, Spirit or Mind, your damage moves will
detonate/spread these without you writing anything — that is intended, and it means the
type's raw numbers are already carrying a hidden rider. Price accordingly.

`${Type}Force` (Elemental Force) is also a magnitude status, one per type, adding flat
BasePower to that type's moves. If your type's table has a "power up your own element"
row, that is what it should be. Fire's Stoke the Flames is the only move granting one
today, and it is worth copying as a shape: `bothAllies` rather than `self`, which turns
a personal ramp into a reason to draft two heroes of the same type.

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

### `conditionalPriority`

`{ requiresTargetStatus: 'Conduct', bonus: 1 }` (Storm's Electric Burst) raises the
move's bracket when its **declared target** carries the status. Evaluated when the
round is ORDERED, not when the move resolves — a bracket has to be settled before
anything happens, so a mark planted this same round is too late. Read off the
declared target only, so a fixed-group move never gets it.

### `conditionalManaCost`

`{ requiresAllEnemiesStatus: 'Conduct', manaCost: 0 }` (Storm's Overcharge) is a
**replacement** price while every active enemy carries the status — not a discount.
Composes with `manaDiscountOnUse` by taking the lower. Unlike `conditionalPriority`
this IS read at resolution, so a mark planted earlier in the same round pays for it.
Every live-fight reader must go through `state.ts resolveManaCost`;
`effectiveManaCost` stays the board-free answer for the draft/level-up/compendium
surfaces.

### `switchesUserOut`

`true` (Storm's Tailwind) sends the caster to the bench after the move's payload
lands, with the incoming hero declared up front on `MoveAction.switchToCombatantId`.
Respects the LOCKED lock-in rule; a block degrades the move (buff lands, mana spent,
only the pivot refused) rather than fizzling it. If you author one, the view needs a
second declaration stage — FightScreen reuses `SwitchInPanel` for it.

### `fieldEffectApplication`

Sets the single global battlefield state for a flat **5 rounds** (never authored
per-move). One at a time; a different one overrides and restarts the clock.

`surgingMagic` (Arcane, doubles MP Regen) · `scorchedLand` (Fire, Burn stops decaying) ·
`stasisBubble` (Mind, slowest-first within a bracket) · `sanctuary` (Light, heals get
+1 priority) · `verdantEarth` (Nature, Renew also grants Atk/Int).

If your type's table implies a *new* field effect, read `docs/field-effects.md` first —
`FieldEffectDefinition` is a small set of implemented shapes, and a new one is an engine
extension, not a data row.

### `statDeltas`

Flat additive integers, **multiples of 5 or 10**, no percentages
(`CLAUDE.md`, enforced for grants by `isValidFlatStatGrant`). Works on any kind; on a
damage move the deltas land **after** the hit, so a Defense debuff shapes the next hit
and not its own.

`statDeltaTarget` (Stone's Landslide) sends them somewhere other than the move's own
targets — `'moveTarget'` (the default, and every move authored before it), `'self'`,
or `'bothAllies'`. Reach for it the moment a damage row also says "allies gain": that
is a move whose two halves land on opposite sides of the field, and it is the exact
shape `StatusApplication.target` already solves for a status rider.

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

This supersedes §4's "recoil as HP" entry. Fire's Volcanic Surge, which takes recoil as
a self-inflicted Burn, is still the better shape when the cost is a flat authored
number; reach for `recoilPercent` only when the cost has to be a fraction of a hit
nobody knows until it lands.

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

Per-move override of the 1/16 default. See §10 — this has an open question attached.

### `conditionalPower`

`{ requiresTargetStatus: 'Burn', multiplier: 3 }` — multiplies the move's **BasePower
input** when the target carries the named status. Read per target, off live statuses, so
a status applied earlier in the same round already counts.

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

- **Multi-hit** ("hits 2–5 times").
- ~~**Recoil / self-damage as HP.**~~ **Now exists** — `recoilPercent` (§3), as a
  fraction of the damage dealt. A recoil that is a flat authored number still has no
  field, and Fire's self-Burn is still the better shape for that case.
- **Two-turn / charge / recharge moves.** Nothing in the round model supports a move
  that spans rounds. (A move that sends its user OUT now exists —
  `switchesUserOut` — but that resolves entirely within its own round.)
- **Protect / shield / damage negation.** (A *redirect* now exists — Provoke pulls
  every single-target enemy move onto its holder — but that moves a hit, it does not
  stop one.)
- **A move that applies a damage-pipeline modifier** ("+20% Fire damage for 3 rounds").
  `DamageModifier` exists but is fed only by Passives, never by moves.
- **A second status on one move** (see §3).
- **Targeting the bench.** (Random targeting now exists — `randomAlly` /
  `randomEnemy`, on the move and on a status rider independently. Conditional
  targeting exists too, but only in the one shape `requiresTargetStatus` covers —
  "only a target carrying status X". "Only the slower foe", "only a full-HP ally"
  and gating on the *absence* of a status are all still conversations.)
- **Percentage stat modifiers**, or any stat growth. Flat multiples of 5/10 only.
- **Accuracy.** Moves always land. A "70% to hit" row is a `chance`-gated *rider* or it
  is a conversation.
- **Priority or cost that varies with state in a shape not already covered.** Three
  shapes exist now: `manaDiscountOnUse` (a self-inflicted, monotonic, per-fight
  discount), `conditionalManaCost` (a replacement price gated on every enemy
  carrying a status), and `conditionalPriority` (a bracket bonus gated on the
  declared target's status). "Costs double while Burned", "priority scales with
  missing HP" and anything reading a *number* rather than a status's presence are
  still conversations.
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
6. **Update the docs** — `docs/combat.md` for damage math, `docs/conditions new.md` for
   status behaviour — especially where you touch something the designer has locked.

---

## 6. Removing the old moves (where the time actually goes)

`grep -rn "<oldId>" --include=*.ts --include=*.tsx --include=*.md . | grep -v node_modules`
for **every** id you delete, before deleting it. Expect hits in five places:

1. **`heroes.ts` starting kits** and **`progression.ts` pools** — obvious.
2. **`enemies.ts`** — easy to miss, and enemy mana pools are small (§8).
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

**Starting kits** (`heroes.ts` `moveIds`) are exactly three: one low-power main-type
attack plus two supports. Pick the attack by the stat the hero actually attacks with —
compare `attack` against `intelligence` in its `baseStats` and give it a `physical` or
`magical` move accordingly. A hero whose only damage move is off its better stat is the
"trap pick" the north star forbids.

**Level-up pools** (`progression.ts` `moveTiers`) get the Mid/Late moves, split by the
same physical/magical read so each hero gets a coherent line rather than a random ninth
of the slate. Two rules:

- **Never list a hero's own starting move in its pool.** `levelUpMovePool` filters out
  anything already unlocked, so it is dead weight that can never be offered.
- Keep the pool a *line*, not a sample. Fire went: Cinder (Atk 70) took the physical
  line, Crimson (Int 80) the magical burst line, Brimstone (Fire/Shadow) the
  spread-and-attrition line.

**Dual-typed heroes** keep their other type's moves in the pool alongside yours.

**Enemies** (`enemies.ts`) get two moves and have tiny mana pools — check §8.

---

## 8. Traps that cost real time on Fire

- **Statuses tick at end of round, in the same round they were applied.** A move that
  applies `Burn 10` leaves the target on `Burn 5` at the end of `resolveRound`, because
  the end-of-round tick fired it and halved it. Every test assertion about a freshly
  applied magnitude status must expect the **post-tick** value. (Unless a field effect
  suppresses decay — Scorched Land is why Spreading Blaze's test reads 10.)
- **The fixture heroes are far too fragile for an authored slate.** Crimson's Ember into
  Warden is `40 BP × 1.6 ratio × 1.25 STAB × 2 type` — well past Warden's 135 HP. **A
  target that faints to the hit never reaches the riders at all**, so a rider test
  silently becomes a KO test that passes for the wrong reason, or fails inexplicably.
  Give test defenders a large `currentHp` **and** a matching `hp` stat modifier
  (`getMaxHp` reads `baseStats + statModifiers`, never `currentHp`).
- **An authored slate's mana curve is steeper than the fixture one.** Fire's floor went
  from 4–20 to 15–75. Torch Goblin, on a 28 pool, could suddenly act about once every
  three rounds. Check every holder — heroes *and* enemies — against the new floor, and
  bump the enemy's mana rather than cheapening the design.
- **The top of the curve may be unreachable.** Fire's Inferno costs 75; no fixture hero
  has a pool that large. That is a legitimate finding to report, not something to
  silently tune away.
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

- **No dangling ids.** Walk `heroes`, `enemies`, and `progressionTable.moveTiers` and
  assert every `moveId` exists in `moves`. Nothing else catches this.
- **No dangling ids, checked by a test rather than by hand.**
  `test/waterMoves.test.ts` ends with two that are worth copying verbatim into every
  slate: one walks `heroes` + `enemies` + `progressionTable.moveTiers` asserting every
  move id resolves, the other asserts no hero lists its own starting move in its
  level-up pool (dead weight `levelUpMovePool` can never offer).
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

Fire's three, as a template for the shape of these:

- **A capability the slate deleted.** Removing every fixture Fire move took away the
  only move-granted Elemental Force. Named rather than patched over — and the designer
  chose to re-author it into the slate, so the type ended up with a move it would not
  otherwise have had.
- **A locked decision the slate brushed against.** Per-move `critChance` does not break
  the "crit is a loadout layer, not a base stat" lock — but it does create a second crit
  source, and how a 30% move combines with a future crit accessory (replace / add /
  take-higher) is now an open question, recorded in `docs/combat.md` rather than
  silently settled.
- **A balance consequence outside the slate.** The new cost floor forced a mana bump on
  an enemy and left one move unaffordable for the hero meant to cast it.

Water's three, as a second data point on the same three shapes:

- **A capability the slate deleted.** Water's authored fifteen are all priority 0, so
  removing Aqua Jet (priority 1) and Tsunami Crash (priority -1) left the type with no
  bracket play at all — a real identity decision (Water's tempo game is Speed and mana,
  not brackets) that the table stated only by omission. Named, not patched.
- **A locked decision the slate brushed against.** `drainPercent` restores HP without
  touching the healing formula, which the 2026-08-28 sign-off locked. It does not break
  the lock — a drain is a damage rider, not a heal-kind move — but it does create a
  second way to restore HP that the Wisdom/support axis cannot invest in, recorded in
  `docs/combat.md` rather than silently settled.
- **A balance consequence outside the slate.** Pincer's mana went 40 → 55 (the new floor
  made its own opener unplayable), and Wave Shred's 80 is still above every Water hero's
  pool — and because the discount only applies *after* a cast, the ramp can never start.

Frost's three, as a third data point — note how consistently the three shapes
recur:

- **A capability the slate deleted.** Frostbite (10 mana) and Frost Lock (13) were
  the cheapest moves any Frost hero held, and the authored floor is 15. Cube, on a
  45 pool, went from three cheap moves to a kit whose Frost content starts at 15 —
  survivable, but the type lost its "act every round on a small pool" option
  entirely, which is a real identity decision the table states only by omission.
  Frost Lock was also Freeze's only dedicated carrier; the slate replaces that six
  times over, so that half needed no patching.
- **A locked decision the slate brushed against.** `requiresTargetStatus` is the
  first move property that can make a move **unpressable** rather than merely
  worse — a hero's usable movepool is now a function of the board. It does not
  break the north star ("no hero is a trap pick") because the gated moves ship in
  pools that also carry a guaranteed Freeze, but nothing in the *engine* enforces
  that pairing; it is a test assertion, and it is recorded in docs/combat.md
  rather than silently settled.
- **A balance consequence outside the slate.** Avalanche (75) is above every Frost
  hero's pool, and Ice Shatter (70) is above both PHYSICAL Frost heroes' — so the
  physical line's Late-tier capstone cannot be cast by either hero meant to hold
  it. Reported, not tuned away, same as Fire's Inferno and Water's Wave Shred.

Storm's, as a fourth — and the first slate whose §4 rows were the bulk of the
job rather than an afternoon's extension. Four of its fifteen needed engine
vocabulary that did not exist, and two of those (random targeting, a
move-forced switch) had genuine design forks that were **asked about before any
content was written** rather than improvised. That call is the single reason
this one did not need redoing:

- **A capability the slate deleted.** Nothing, for once — the old fixture Storm
  moves were four generic attacks, and the only vector among them
  (`voltaicJolt`, Conduct's dedicated carrier) is replaced five times over by
  the slate. Worth noting that "no gap" is a finding too, and only knowable by
  running the §6 grep.
- **A locked decision the slate brushed against.** `switchesUserOut` is the
  first move that can move a hero between the active row and the bench, which
  puts it directly against the LOCKED lock-in rule. Resolved by asking: it
  respects lock-in, and a block degrades the move (the buff lands, only the
  pivot is refused) rather than gating it. Recorded in docs/combat.md.
- **A balance consequence outside the slate.** Overcharge (60) sits in two
  50-mana pools, castable only at its conditional price — reported, not tuned.
  And Tempest, a STARTER, turned out to have no `moveTiers` entry at all, so it
  could never learn a move; the slate is what surfaced it, and it is fixed here.

Stone's, as a fifth — and the first slate whose findings were all about the
*roster* rather than about the engine. Five engine fields is the most any
slate has needed, and none of them was the hard part; four of the five were
asked about up front (§0 step 1) and the fifth, `statDeltaTarget`, was
mechanical. What the slate actually surfaced was three gaps in who can hold it:

- **A capability the slate deleted.** Nothing mechanical — the two fixture
  moves were generic attacks. But it deleted a *price point*: Boulder Toss cost
  12 and Stone Quake 18, and the authored floor is 15. Sentinel, on a **30**
  mana pool, went from a kit of 12/10/20 to one whose cheapest Stone move is
  Mud Ball at 15, and its own signature move — Body Blow, the one
  `offStatOverride` exists for and which its Defense 100 is built to swing —
  costs 40 and is **permanently unaffordable**. Confirmed in the app, not
  inferred: fielded with its own pool, Sentinel opens the fight on "Rest — out
  of mana".
- **A locked decision the slate brushed against.** `retributionPercent` is the
  first damage in the game that does not go through the LOCKED damage formula.
  It does not break the lock — the formula is still the only way a BasePower
  move computes damage — but it creates a damage source the type chart cannot
  touch, and whether a future relic damage modifier should reach it is now an
  open question in `docs/combat.md` rather than something settled by accident.
- **A balance consequence outside the slate — raised, and answered.** **Three of
  the fifteen moves are magical, and Stone has no magical hero** (Crag Int 20,
  Sentinel Int 15), so Tremor, Rockfall and Landslide are in no hero's pool and
  no enemy's kit. Reported rather than forced into a pool, because putting a
  magical move in an Int-20 hero's line is exactly the trap pick the north star
  forbids.

  **Designer call, 2026-08-30: this is intended, not a gap.** A magical Stone
  hero can arrive later, and an off-type pool is a legitimate home in the
  meantime — non-Stone heroes already learn Stone moves (`ironWarden`, `cube`
  and `steamColossus` all carry one), so nothing about these three is
  structurally unreachable, only unplaced.

  **The generalisation worth carrying to the next slate:** a slate is authored
  for the type, not for the two heroes that currently happen to have it. Moves
  with no holder today are a normal, healthy state — the roster is ~53 concepts
  and 32 exist. What you owe the designer is the *list*, not a fix: name what
  has no home so the decision (author a hero / place it off-type / leave it) is
  theirs. Do not quietly stuff a move into the nearest pool to make the number
  zero.

**The procedural lesson from Stone**, extending Storm's: when you finish the
slate, run the reachability check as well as the dangling-id one. They are
opposite failures — a dangling id is a pool pointing at a move that does not
exist, and this is a move no pool points at — and only the first had a test.
Twenty lines over `moves` vs `heroes + enemies + moveTiers` is what turned
"the slate is done" into "three of these fifteen have no holder yet."

`test/stoneMoves.test.ts` now pins the unreachable set exactly rather than
asserting it empty, which is the right shape for a list that is *expected* to be
non-empty: it says nothing about whether an orphan is acceptable, only that a
NEW one has to be looked at and consciously added. Update the list when a slate
legitimately adds to it; never delete the assertion.

If the type you are authoring has a type-keyed status hook (Conduct on Storm/Iron, Haunt
on Spirit/Mind), the equivalent question is almost certainly: *is the slate priced
knowing every one of its damage moves carries that hook for free?* Storm answered
it by counting: **ten of its fifteen moves are damage moves, and every one of
them detonates Conduct for 10% max HP with no field authored**, while five plant
the mark. That is the type's whole engine and it is invisible in the design
table — `test/stormMoves.test.ts` pins the count so it cannot drift silently.

**The one procedural lesson from Storm**: §0 step 1 says name the engine
extensions up front. Storm is the case where that step should also **stop and
ask**. "Randomly give an ally X and an enemy Y" and "switch out" are not
extensions with an obvious shape — they are questions with two or three
defensible answers each, and picking one silently would have meant rebuilding
the targeting model or the switch path after the fact. Two questions cost one
round trip and saved the slate.
