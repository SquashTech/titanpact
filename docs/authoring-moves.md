# authoring-moves.md

**A runbook for turning one type's designed move table into shipped content.**

The designer hands over a slate of ~15 moves for one type, as a table with the columns
`Move Name / Phy·Mag·Buff·Heal / Base Power / Mana Cost / Effect / Early·Mid·Late`, and
asks you to remove that type's existing moves, replace them, and "distribute them
appropriately."

Fire was the first (2026-08-29), Water the second, Frost the third, Storm
the fourth, Stone the fifth, Nature the sixth, Light the seventh, Shadow the
eighth, Arcane the ninth, Mind the tenth, Spirit the eleventh, Iron the
twelfth, Beast the thirteenth and Mech the fourteenth (all 2026-08-30). One
type remains — Ancient. This file is what those fourteen cost to learn, written
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

Nature needed **two**, the fewest since Frost, and both were visible on the
first read — but only one of them *looked* like an engine field. "instantly
detonate Poison" announces itself. **"if the user has Renew" does not**: it is
the same six words as Immolate's "if the target is Burned", the field it wants
already exists, and it is one word away from being expressible. That is the
whole trap. **Read every conditional clause for WHOSE state it asks about, not
just which status it names** — a slate can reuse an engine field's exact
grammar and still be asking it a question it has never been asked. The general
form is a sibling of Stone's: Stone's trap was a payload landing on the wrong
side of the field, and Nature's is a *condition being read* off the wrong side.

Light needed **one**, the fewest of any slate, and it was visible in four
words — "if Sanctuary is active". The lesson is not about the extension. It is
about the column that **is not there**: the table said "apply Daze" six times
and never said *for how long*. Base Power, Mana Cost and the rider's chance are
all columns; a duration-shape status's duration was not, and there is no
`isValidMoveDefinition` to catch a zero. **Before authoring, list every status
your slate applies, check the shape it needs against `src/data/statuses.ts` —
magnitude, duration, or timer — and check whether the table supplies that
number.** Where it does not, the honest move is to use the existing precedent,
say so in the hand-off, and let the designer overrule it; the wrong move is to
pick a different value per row and quietly invent a balance split the table
never asked for.

**This is the clearest evidence yet that naming beats guessing.** Light shipped
with `duration: 2` on all six (stunningBlow's, the only precedent) and reported
it as the one value the table omitted. The designer's answer was not a different
number — it was to **redesign the status so the number stops existing**: Daze
became flinch the same day (boolean, `clearsAtEndOfRound`, gone at the end of
the round it landed in). A silently-chosen 2 would have hidden the question the
mechanic was actually posing, and the type would have shipped around it.

Shadow also needed **one**, and it is the cleanest example yet of §0 step 1
paying for itself. Its words to watch for were "below 50% HP" — and the reason
they matter is not that the clause is complicated. It is that **every damage
condition in the game before it asked whether something was PRESENT**: a status
on the target, a status on the user, a field effect on the board. "Below 50%"
asks a *quantity*, and §4 already said so ("anything reading a **number** rather
than a status's presence"). One question, asked before any content was written,
settled the four forks that would each have been a rebuild afterwards — read
before or after this hit's own damage, strict or inclusive at the line, per
target or per cast, and what `consumesStatus` means when there is nothing to
consume.

The other thing Shadow is worth remembering for: **two of its rows were
answered by the designer with something other than a value.** "Double base power
if the user HAD Stealth" was raised as a consume-or-not fork; the answer was
*"Stealth only ever lasts one turn anyway, so it gets Consumed regardless — it
should just check during the move selection phase"*, which is a statement about
how the mechanic should READ to a player, not about the engine. It turned into
`consumesStatus` plus a check that the FightScreen chip lights up before the
player commits — and the chip was then confirmed in the app, unlit and lit, one
round apart. **When the designer answers a mechanical fork with a sentence about
legibility, the deliverable includes the surface, not just the field.**

Arcane needed **three**, the second-most of any slate, and it is the first one
whose hardest question was not about the engine at all. Its words to watch for
were "spread if", "equal to the user's", and — the one that matters —
**"(can exceed their max)"**. Four rows carried that parenthetical, and it is
the whole slate: not a rider on a mana grant but a change to what
`Combatant.currentMana` MEANS, and therefore to every line in the codebase
that had been written assuming a ceiling. Three of those lines already existed
and all three would have silently undone the mechanic — the regen tick's
`Math.min`, Rest's assignment TO the pool, and a view gauge dividing by the
pool.

**The generalisation, and the reason this one is worth remembering:** most
slates ADD a field. This one **removed an invariant**. When a design row
changes what an existing state field is allowed to hold, the work is not
"write the new field" — it is *grep every reader of that field and ask which
of them was relying on the old bound*. `grep -rn "currentMana"` was a
twelve-line list and five of those lines needed a decision. None of them is
findable by reading the design table, and none of them would have failed a
test that did not already exist.

The corollary for the hand-off: the designer question to ask about a row like
this is not "how much?" but **"what takes it away?"** — a ceiling, a decay, a
Rest, a round boundary, a switch, a map node are six different answers and the
table gives none of them. Asked as one multiple-choice question up front, it
cost one round trip; discovered afterwards, each one is a rebuild.

Mind needed **two**, and its lesson is the sharpest version yet of Arcane's.
Its words to watch for were "20% chance to reduce" and "double stat
reductions" — but neither of those is the finding. The finding is what the
designer said when asked about the second one: *"Compounds for sure, but I
think it's worthy of mentioning at this point that we need to make sure stats
can never drop below 1."*

**The slate's most important change was to a function no Mind move calls.**
`getEffectiveStat` had no clamp, and the authored slates had already outgrown
that without anyone noticing: Break Will alone is −50 Attack, which puts an
Attack-25 caster at −25, and a NEGATIVE `defStat` inverts the off/def ratio so
an attack HEALS its target. That bug was reachable by Stone's and Shadow's
content too. Nobody had written a stat low enough to find it.

**The generalisation, and it is the counterpart to Arcane's:** Arcane's slate
*removed an invariant* (mana's ceiling) and the work was grepping every reader
of the field. Mind's slate *discovered a missing one* — and the way it got
found was not by reading the design table at all. It got found by asking the
designer a question about a move and having them answer about the SYSTEM.
When a row would push an existing number somewhere no content has pushed it
before, the question worth asking is not "how much?" but **"what happens at
the extreme?"** — and the honest place to answer it is the chokepoint every
reader shares, not the move that got there first.

The corollary for §5: a clamp is not a feature of the move that needed it.
Brain Flay writes an uncapped modifier and `getEffectiveStat` floors what is
read out of it, which keeps "how far is this target debuffed" and "what can
this target actually do" as two separate facts. Clamping at the write site
would have made a third Brain Flay silently identical to a second.

Spirit needed **two**, and it is the first slate whose engine work was
*predicted in writing by the previous one*. Shadow's hand-off closed with a
list of three shapes deliberately left unbuilt, and the first of them — "the
user-side version, double damage while YOU are below half" — is two of
Spirit's seventeen rows. It cost one edit to a switch and one new argument,
because the fork Shadow had already answered (strictly below? read when?) did
not have to be re-answered.

**The generalisation, and it is a cheap one to bank: the "deliberately left
unbuilt" list at the end of a hand-off is a work queue.** §0 step 1 says sort
the table into *already expressible* vs *needs a new field*. There is a third
bucket worth checking first — *already designed, not yet built* — and the only
place it lives is §10. Reading the previous slate's open list before reading
your own table turned what would have been a four-fork conversation into a
zero-fork one.

Spirit's other lesson is about the row that did NOT have a precedent. Its words
to watch for were **"loses 25% of max HP"** and **"drops to 1 HP"** — two rows
that look like one mechanic and are two, and neither is `recoilPercent`. The
trap is specific and worth naming: the game already had a self-harm field, it
was the obvious place to reach, and it is wrong for BOTH rows — it bills a
fraction of *damage dealt*, and one of these moves deals none. **When a design
row costs the caster something, the question is not "which self-harm field?"
but "billed against WHAT, and known WHEN?"** Recoil is an outcome you discover;
`selfHpCost` is a price you read before pressing. That distinction is the
entire reason it is a separate field, and it is invisible if you only ask
whether a field for self-damage exists.

Iron needed **one**, tying Light and Shadow for the cheapest slate, and its
words to watch for were three: **"if AN enemy has Conduct."** The field it
wants already existed and already read Conduct — Storm's `conditionalManaCost`,
authored six rows earlier — and the only difference is the quantifier. That is
the whole trap, and it is Nature's in a new costume: *the same grammar, asked
of a different quantity*. Nature's version read a condition off the wrong side
of the field; this one reads it off the right side and **counts differently**.

**What makes it worth a field rather than a shrug is second-order, and it is
the generalisable part.** Iron is one of Conduct's `triggerTypes`, so an Iron
damage move DETONATES the mark it reads. Under "all enemies" the discount is
self-consuming — a board that satisfies the condition cannot survive the cast
that reads it — so Overcharge poses no choice at all. Under "any enemy" the
player picks: swing at the marked foe and cash the mark, or swing at the other
one and keep the discount. **One word in the design table turned a price into a
decision, and it was only visible by asking what the move does to the state it
reads.** When a row's condition and its payload touch the same piece of state,
that is the question to ask — not "how much?" but *"what does reading it do to
it?"*

The corollary for §0 step 1: the sort is *already expressible* vs *needs a new
field*, and a row can be in the second bucket while looking exactly like the
first. Grep the field's existing readers and diff the SENTENCE, not the shape.

Iron's other lesson has nothing to do with the engine and everything to do with
§6. It is the slate that finally emptied the fixture pool, and it deleted the
single most widely-held move in the game — **Fortify was in NINE starting kits
across seven types**. That is not a §6 grep result you absorb; it is a design
decision about eight heroes who have nothing to do with Iron, and it has to be
made deliberately and reported. See §10.

Beast needed **four**, second only to Stone, and three of the four are the
SAME CONDITION. Its words to watch for were "if partner is a Beast" — and the
trap is not the condition, which is easy. It is that the clause appears on
three rows that hang three different mechanics off it: Prowl doubles a stat
grant, Pack Hunt doubles base power, Pack Leader replaces a price. One of
those already had a home (`conditionalPower` gained a sixth sibling), one
nearly did (`conditionalManaCost` gained a third side), and one had none at
all (`conditionalStatDeltas` is new).

**The generalisation, and it is the cheapest one in this file to act on: count
the HOSTS, not the conditions.** A condition repeated across rows costs one
field. A condition repeated across rows *of different payload kinds* costs one
field per kind, because what varies is not the question but what hangs off the
answer. Reading the table for "how many distinct conditions?" gives you one
here; reading it for "how many things does that condition modify?" gives you
three, which is the real number. Sorting the table by the CLAUSE rather than
by the row is what makes that visible in the first read.

Beast's second lesson is about §7 and is genuinely new. **When a condition
reads the ROSTER, run the reachability check on the CONDITION, not only on the
moves.** Stone taught "a move with no holder is a normal state, name it"; this
is its sibling one level up. Three of Beast's fifteen rows are gated on having
a Beast partner, and the roster contains exactly ONE native Beast hero — so on
its own the type can never satisfy its own signature. It turns out to be
reachable anyway, but only because three heroes in a completely different file
carry a Beast **type-graft Evolution** (`src/data/progression.ts` — Sylva,
Rime, Mordrax). Nothing in moves.ts, heroes.ts or the design table says so.
The check is one grep (`typeGraft: '<Type>'`) and without it this slate would
have shipped three rows that read as unreachable and are not, or — worse the
other way — three rows the author assumed were reachable and were not.

The fourth field was the one this file has been carrying as a to-do since
Fire: §3's "a move can carry exactly ONE statusApplication" was raised as an
engine change on the Toxic Fangs row, and the designer widened the field
rather than re-cutting the row. Worth knowing it cost about an hour, because
the honest version (make the field a union, funnel every reader through one
helper) touched ~40 call sites across twelve test files and none of them
needed thought. **A long-standing "raise before you build it" note is usually
cheaper than it looks by the time something actually asks for it** — the
reason to raise it is still that the designer might not want it, not that it
is expensive.

Mech needed **four**, and it is the first slate whose lesson is about
*where a roll lives* rather than about what a field does. Its words to watch
for were four different spellings of one word — "randomly Priority", "a random
stat", "randomly apply", "randomly roll this attack's base power" — and the
trap is that they look like one extension and are four, because chance can
attach to four different parts of a move.

**The finding, and it is worth banking: one of those four could not be drawn
from the shared RNG stream at all.** Three of them (bracket, stat, rider) roll
*after* the player commits, so they belong in the round's own seeded stream
like every draw before them. Jackpot's does not: the design row says "at the
start of each turn", the designer confirmed the number is SHOWN on the button,
and a value the view must read before committing cannot be one the view
advances by reading — a player would re-roll Jackpot by opening the move
dossier twice.

The fix is worth copying rather than re-deriving. It is **derived, not stored
and not drawn**: a pure function of `(seed, round, combatantId, moveId)` pushed
through the same mulberry32 (`state.ts resolveRandomBasePower`). That bought
three things at once, none of which was designed for individually — it
re-rolls every round because `round` is an input, it is per hero because
`combatantId` is one, and `rngState` is never touched so every fight authored
before it replays byte-identically. The two alternatives both cost more and
delivered less: a STORED roll needs a new CombatState field and a seeding pass
in both builders, and a STREAM draw cannot be read before the round resolves,
which is the one thing the row actually requires.

**The generalisable question, and it is a new one for §0 step 1:** for
anything random, ask *when is it known, relative to the commit?* A roll the
player sees before choosing and a roll they discover afterwards are not the
same field with a different timing — they are different mechanics, and they
live in different places. Mech has both, four rows apart in the same table.

Mech's other lesson is Iron's inverted and is a roster fact rather than an
engine one. Iron cashes Conduct eleven times and plants it zero; Mech plants
Conduct twice and Haunt once and **cashes neither** — it is in no status's
`triggerTypes` or `spreadTriggerTypes`. Asked up front rather than assumed,
and confirmed as intended: Mech builds, a partner fires. Worth asking on every
remaining slate, because "does this type interact with the marks it applies"
is invisible in a design table and is a whole doubles axis.

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

**Check the floor, not the ceiling.** A hero's `baseStats.manaPool` is where it
*starts*, and heroes gain mana all run from relics, equipment and Evolution
(`docs/mana.md` "Mana pools GROW over a run") — commonly +40 by mid-run and well past
+100 in a run built for it. **A move costing more than any current hero's starting pool
is intended, not a finding.** Do not report it, and do not tune it down.

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
- **A move can carry ONE rider or a LIST of them** (2026-08-30, Beast's Toxic
  Fangs — "afflict Bleed and Poison 10"). Author a single rider bare, exactly
  as every move before it does; author an array when a row applies two. Riders
  resolve in authored order, each resolving its own targets and rolling its own
  `chance`, and a one-rider move draws exactly the RNG it always did. Read it
  through `content.ts statusApplicationsOf` — never off the field directly,
  which is a union — and remember the three player-facing surfaces have to show
  ALL of them (§5).

The catalog (`src/data/statuses.ts`, `docs/conditions new.md`):

| Status | Shape | Behaviour | Cleared by switching? |
|---|---|---|---|
| `Burn` | magnitude | End of round: deal X, then **halve** X | Yes |
| `Renew` | magnitude, positive | End of round: heal X, then halve X. Cleanse never strips it | No |
| `Bleed` | boolean | End of round: 5% of max HP, flat | No |
| `Freeze` | boolean | Halves Speed | Yes |
| `Daze` | boolean | Cannot use a move for the REST OF THE ROUND, then gone. Flinch: worth nothing if its applier acted second | Yes (moot) |
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

A **replacement** price while the enemy side carries a named status — not a
discount. Two sides, and a move authors **exactly one**:

- `{ requiresAllEnemiesStatus: 'Conduct', manaCost: 0 }` (Storm's Overcharge) —
  every active enemy carries it.
- `{ requiresAnyEnemyStatus: 'Conduct', manaCost: 0 }` (Iron's Metallic Blade) —
  at least one does, whether or not it is the foe being hit.
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
downstream retargeting layer (Stealth, Provoke, Haunt) reads the effective
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

### `statDeltaChance`

`statDeltaChance: 0.2` (Mind's Psi Bolt, Psychock, Psionic Wave) is
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

### `doublesStatReductions`

`doublesStatReductions: true` (Mind's Brain Flay) doubles every stat the move's resolved
targets are already debuffed on. A move authoring this carries no `basePower`; what it
is worth is entirely what the board already says.

Reads and writes `statModifiers` ONLY, never `baselineStatModifiers` — the first is what
this fight inflicted, the second is the loadout, and a target's armor must not change how
hard its debuffs amplify. Every negatively-modified stat, not a named list. Positive
modifiers are untouched.

It **compounds** (−50 → −100 → −200): it doubles the number on the board, so a second
cast doubles the doubled one. Nothing clamps here — `getEffectiveStat` floors every stat
at 1 for every reader at once, which is where that invariant belongs. Pressing it on a
clean board changes nothing and still costs the mana, the Retribution shape.

If you author one of these, the button needs the LIVE figure and not only the rule:
FightScreen carries a `−N more` chip for exactly the reason the retribution chip exists.

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

Per-move override of the 1/16 default. See §10 — this has an open question attached.

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

Author exactly one of the
five; nothing validates that, and a `conditionalPower` authoring none is a
silent dud — but `test/shadowMoves.test.ts` pins "exactly one side" across the
WHOLE move table, so extending that list is the cheapest part of adding a
sixth, and it fails the moment you author the new field.
Two behavioural differences worth knowing before you reach for it:

- The target-side form is re-read per hit, so a spread move can double against
  one foe and not the other. The user-side form asks one question about one
  combatant, so a spread cast is doubled against **every** target or none.
- A bonus that lives on the caster is one the enemy cannot interact with at
  all. Burn/Freeze/Conduct can be cleansed, switched off, or simply not be on
  the target you picked; if the status you read is `positive` and survives a
  switch — as Renew is and does — the condition is effectively unconditional
  from the second turn onward. That is priced entirely in mana today; see §10.

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
- ~~**Recoil / self-damage as HP.**~~ **Now exists in two shapes** —
  `recoilPercent` (§3), a fraction of the damage dealt, and `selfHpCost` (§3),
  a share of the caster's own max HP or a floor it drops to. Between them they
  cover every self-harm row authored so far except a flat authored number,
  which still has no field; Fire's self-Burn remains the better shape for that.
- **Two-turn / charge / recharge moves.** Nothing in the round model supports a move
  that spans rounds. (A move that sends its user OUT now exists —
  `switchesUserOut` — but that resolves entirely within its own round.)
- **Protect / shield / damage negation.** (A *redirect* now exists — Provoke pulls
  every single-target enemy move onto its holder — but that moves a hit, it does not
  stop one.)
- **A move that applies a damage-pipeline modifier** ("+20% Fire damage for 3 rounds").
  `DamageModifier` exists but is fed only by Passives, never by moves.
- ~~**A second status on one move.**~~ **Now exists** — `statusApplication` is
  one rider or a list of them (§3), Beast's Toxic Fangs. What is still a
  conversation is any RELATIONSHIP between two riders: "apply X only if Y
  landed", or a compound status that is more than its two halves.
- **Targeting the bench.** (Random targeting now exists — `randomAlly` /
  `randomEnemy`, on the move and on a status rider independently. Conditional
  targeting exists in TWO shapes now: `requiresTargetStatus` restricts *which*
  combatants are legal ("only a target carrying status X"), and
  `conditionalTarget` swaps the whole `TargetMode` while a named field effect is
  up (Arcane's Overload). Neither generalises: "only the slower foe", "only a
  full-HP ally", gating on the *absence* of a status, and a conditional target
  keyed on anything other than the one global field slot are all still
  conversations.)
- **Percentage stat modifiers**, or any stat growth. Flat multiples of 5/10 only —
  with the single exception of `derivedStatDeltas` (§3), whose amount is read off
  live state and lands unrounded. A stat delta scaled as a *fraction* of anything
  is still a conversation.
- **Accuracy.** Moves always land. A "70% to hit" row is a `chance`-gated *rider* or it
  is a conversation.
- **Priority or cost that varies with state in a shape not already covered.** Three
  shapes exist now: `manaDiscountOnUse` (a self-inflicted, monotonic, per-fight
  discount), `conditionalManaCost` (a replacement price gated on the enemy side
  carrying a status — in TWO quantifiers now, every enemy or any enemy), and
  `conditionalPriority` (a bracket bonus gated on the declared target's status). "Costs double while Burned" and "priority scales
  with missing HP" are still conversations. Note that reading a *number* is no
  longer novel in itself — `conditionalPower` does it on both sides of the
  field now (`requiresTargetHpBelow`, `requiresUserHpBelow`) — but no COST or
  PRIORITY field reads one, and that is the part still open.
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
- ~~**The top of the curve may be unreachable.**~~ **This was wrong, and it was
  reported as a finding by all five slates before anyone caught it.** Fire's Inferno at
  75, Water's Wave Shred at 80, Frost's Avalanche at 75, Storm's Overcharge at 60 and
  Stone's Boulder Slam at 80 were each written up as "above every hero's pool". All five
  were comparing against `baseStats.manaPool`, which is the **starting** pool. Heroes
  gain mana all run (`docs/mana.md`, 2026-08-30) — a capstone the roster cannot cast on
  turn one is the intended shape, not a defect. **The trap is not the move; it is the
  reflex to check a cost against a starting pool.**
- **Enemies are the real version of that check.** Enemies get no relics, no equipment
  and no Evolution, so an enemy's pool genuinely is fixed for the whole game. An enemy
  that cannot afford its own kit is a live finding — bump its mana rather than
  cheapening the design. Same for a HERO that cannot afford its own three-move
  **starting kit**, which is the one thing a player cannot fix by drafting.
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

**One shape has now been retired.** "A balance consequence outside the slate" was, in
four of the five slates below, some version of *"the Late-tier capstone costs more than
any hero's pool"* — and that turned out to be a misreading of `baseStats.manaPool` as a
ceiling rather than a starting value (`docs/mana.md`, 2026-08-30 designer sign-off).
The bullets below are left as written, because the *shape* of the finding is still the
right one to look for and this is a useful record of how a plausible non-finding
survived five repetitions. **But do not report this particular one again.** If your
slate's only balance consequence is "the expensive moves are expensive", you have found
nothing, and saying so is better than padding the hand-off.

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

Nature's, as a sixth — and the first slate whose findings are about a
NUMBER rather than about a rule. Its two engine fields were the cheapest of
any slate since Frost. What it actually surfaced is that Nature's central
resource is now being counted three separate ways, and that the type has
nobody to play it against:

- **A capability the slate deleted.** Two, and both are stated by omission.
  (1) `healingRain` was the game's only `bothAllies` **heal-kind** move, and
  the authored fifteen contain no heal-kind move at all — every drop of Nature
  healing is now Renew, a HoT. Nature can no longer put HP back on a hero
  *this* turn, only over the next several, which is a real identity call and
  not obviously the intended one; Sylva keeps a direct heal only because
  `mendWounds` (Spirit) survives in its pool, and `test/heal.test.ts`'s
  bothAllies fixture had to be repointed onto Water's Oasis. (2) The slate has
  **no spread damage move**. `naturesWrath` (42 BP, bothEnemies) died with the
  rewrite and nothing replaces it — Blight is spread but is a debuff, so
  Nature's only way to touch both enemies at once is 30 mana of Poison. The
  Stone-Provoke test that stood on `naturesWrath` as its "a spread move still
  hits both" fixture now stands on Stone's own Rockfall.
- **A locked decision the slate brushed against.** `detonatesStatus` is the
  **second** damage source in the game that never runs the LOCKED damage
  formula, after Stone's `retributionPercent`. Neither breaks the lock. But
  Stone's hand-off left one open question — should a future `DamageModifier`
  reach fixed damage? — and a second instance turns that from a question about
  one move into a question about a category. Recorded in `docs/combat.md`
  rather than settled by accumulation.
- **A balance consequence outside the slate — raised, and answered the same
  day.** **Renew is now counted three times.** It heals on the usual halving curve; it
  is Seed Shot's and Branch Slam's ×2 (`requiresUserStatus`); and under
  Verdant Earth it is *also* flat Attack and Intelligence
  (`statBonusEqualToStatusMagnitude`). The slate ships its own enabler for the
  third — Magic Growth and Force of Nature both set Verdant Earth. So
  Overgrowth's Renew 100, snapshotted through a Nature caster's Wisdom and STAB
  to roughly 125, is simultaneously a ~250 HP heal over the fight, a doubling
  of an 80 BP move, and **+125 Attack and +125 Intelligence on one hero** —
  larger than any base stat in the roster — all decaying by half a round at a
  time. Nothing here is a rules conflict; it is a magnitude one, and it was
  worth a designer's eye before the slate was tuned.
  **Answer (2026-08-30): intended, and locked** — Renew is a slow passive
  effect, so its payoffs have to be powerful or the turn spent on it is never
  worth taking, and the halving curve is what bounds the window rather than the
  magnitude (`docs/combat.md` "Renew's stacked payoffs"). **Do not report this
  again**, the same way the starting-pool non-finding is retired. A FOURTH
  reading of Renew, a payoff that does not decay with the magnitude, or one
  that reads another hero's Renew would each be new. Left here rather than
  deleted because the shape of the finding — *"one resource has quietly
  accumulated N independent readings and this slate is what puts them on one
  hero"* — is still the right thing to go looking for, and it is worth knowing
  that raising it took one round trip and cost nothing.
- **A second one, smaller: Nature has no enemy.** Three Nature heroes, zero
  Nature entries in `enemies.ts` — so none of these fifteen ever appears on the
  side of the field the player is fighting. That matters more for this type
  than it would for Fire or Storm, because Nature's whole identity is a clock
  the *defender* is supposed to play around by switching, and a player who only
  ever casts Poison never learns to answer it.

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
- **~~A balance consequence outside the slate.~~ RETRACTED (2026-08-30).** This
  slate reported that Sentinel's 30 mana pool cannot afford Body Blow (40), the
  move its Defense 100 exists to swing. That was the fifth repetition of the
  non-finding above: 30 is Sentinel's STARTING pool, and one mana relic plus an
  accessory plus an Evolution puts it at ~70. The move comes online partway
  through a run, as intended. Left here rather than deleted because a retracted
  finding is more useful to the next author than a clean page.
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

Light's, as a seventh — the cheapest slate yet on engine work (one field) and
the first whose findings are all about **what the table did not say**:

- **A capability the slate deleted — three, and the third is the one that
  matters.** (1) `restoreVigor` was the game's only heal-kind move targeting
  `'self'`, its cheapest heal at 14, and the sustain in three NON-Light kits
  (Cinder, Crimson, Valor). All three now hold `mendWounds` — same role, 16
  mana — and the type's own heals start at 25. (2) `sunstrike`, Light's spread
  poke at 18, is replaced by Solar Flare at 60, so the type's cheapest way to
  touch both foes went 18 → 50 (Blinding Flash). (3) **The game no longer has
  a cleanse-all move.** The fixture Purify stripped everything; the authored
  one is `cleanseCount: 1`, faithfully reading "a negative status", so every
  Cleanse in the game is now limited and the unlimited path survives only in
  the engine (`test/waterMoves.test.ts` still pins it). That is a real
  identity call about how answerable a stacked-up status board should be, and
  the table states it only by the word "a".
- **A locked decision the slate brushed against.**
  `conditionalPower.requiresFieldEffect` makes a **global, both-sides,
  5-round, single-slot** state into a damage term. It does not break the
  two-pipeline lock (it is a BasePower-stage input like its two siblings), but
  it does mean an enemy's Consecrate arms your Smite and any Surging Magic
  switches it off — the first time the field-effect slot is contested for a
  reason other than its own effect. Recorded in `docs/combat.md` and
  `docs/field-effects.md` rather than settled by accident, along with the two
  shapes deliberately left unbuilt: gating on a field's *absence*, and on
  *any* field rather than a named one.
- **A balance consequence outside the slate — raised, and answered by
  redesigning the status.** Six of seventeen Light moves apply **Daze**, and
  Daze was a duration-shape status whose duration the table never gave. The
  slate shipped with `2` on all six, the only precedent in the game
  (`stunningBlow`), and reported it as an authored guess rather than a
  decision.

  **Designer call, 2026-08-30: Daze is now FLINCH.** Boolean, no number,
  removed at the end of the round it landed in
  (`StatusDefinition.clearsAtEndOfRound`; `docs/conditions new.md`). The
  question the slate surfaced was not "1 or 2" — it was that a status whose
  whole job is denying one action should be priced against **turn order**, not
  bought by the round. It now is: a Daze denies nothing unless its applier
  acted first, so the same rider is worth a lot on a fast hero and almost
  nothing on a slow one, with no content change between them.

  Two things this cost the type, both worth knowing and neither tuned away:
  Blind (25 mana, no damage, guaranteed) went from a two-round lockout to a
  1-for-1 turn trade that only pays when the caster is faster; and Light
  authors no priority anywhere, so it has no way to buy past a Speed
  disadvantage. `test/lightMoves.test.ts` pins both.

  **The generalisation:** a missing column is sometimes a missing *decision*.
  When the table omits a number the mechanic needs, the useful question in the
  hand-off is not only "which value?" but "should this mechanic want a value at
  all?" — and asking it that way is what produced a better status instead of a
  tuned one.

Shadow's, as an eighth — the second-cheapest slate on engine work (one
field) and the first whose findings are mostly about **the heroes that
already held the type** rather than about the moves:

- **A capability the slate deleted — two, and both are stated by omission.**
  (1) `nightmareGrasp` was priority **−1**, and the authored fifteen contain
  exactly one bracket row: Shadowstrike at +1. So the type lost its slow-heavy
  option entirely and kept only the fast-cheap one, which is a real identity
  call (Shadow commits to acting first, never to hitting harder for acting
  last) that the table states only by leaving the column blank.
  (2) **The slate contains no heal and no cleanse.** Vesper's and Marrow's old
  kits were `vanish + secondWind + purify` — two off-type supports and no
  attack — so mono-Shadow sustain was always borrowed, and it still is: Vesper
  keeps `secondWind` (Spirit) and Marrow keeps `purify` (Light) only because
  the distribution put them there. Nothing in fifteen authored moves puts a
  point of HP back. Named rather than patched.
- **A locked decision the slate brushed against.**
  `conditionalPower.requiresTargetHpBelow` is the first damage condition that
  reads a **continuous quantity** rather than the presence of a status or a
  field. It does not break the two-pipeline lock (it is a BasePower-stage
  input like its three siblings) and it draws no RNG. What is new is the
  *counterplay surface*: a Burn can be cleansed, a Freeze switched off, a
  field displaced — an HP fraction can only be answered by healing back above
  the line, and it gets more likely precisely as the target gets closer to
  dying anyway. Recorded in `docs/combat.md` rather than settled by accident,
  along with the three shapes deliberately left unbuilt (a user-side version,
  an inverse, and reading any other continuous quantity).
- **A balance consequence outside the slate — and this one is about the
  roster.** Three things, in increasing order of how much they need a
  designer:
  1. **Goblin Skulker could not afford its own kit.** 25 mana / 3 regen
     against a floor that went 9 → 15 and a cheapest damage move that went
     11 → 20. Raised to 40/10, the same fix and the same reasoning as Torch
     Goblin when Fire landed. This is the affordability check that IS a
     finding — enemies get no relics, no equipment and no Evolution, so their
     pools are fixed for the whole game.
  2. **Vesper had no damage move at all.** A mono-Shadow hero whose entire
     starting kit was two off-type supports and a Stealth grant — the trap
     pick the north star forbids, sitting in the roster until a slate went
     looking. Fixed here (Fade Strike opens it now), but worth knowing that
     the *distribution* pass is what surfaces this class of problem and
     nothing else does.
  3. **Vesper and Marrow were the same hero — raised, and answered the same
     day.** Identical stat block (85/75/45/40/40/70/45/10), identical types,
     identical starting kits, identical level-up pools, and three Evolution
     paths with identical names AND identical descriptions (Nightreaver /
     Stillmind / Nightveil). The slate's own pass did the minimum that stopped
     them being interchangeable at level 1 — different kits, different pools —
     and named the rest as a roster decision.

     **Designer call, 2026-08-30: Marrow becomes the type's INTELLIGENCE
     user.** Attack and Intelligence swap (75/40 → 40/75), mana goes 45 → 65
     because the magical line does not really open until Umbral Beam at 40,
     and everything else stays put — so the two are now deliberate **mirrors**
     rather than duplicates: the same frame (85 HP / 45 Def / 40 Wis / 70
     Speed, stat total 355 on both) driving opposite pipelines. Marrow's kit
     and pool moved to the Poison/execute line, and its three Evolution paths
     were rewritten (Carrion / Ossuary / Ashenwell), because the byte-identical
     ones made the two heroes the same hero at every level rather than only at
     level 1.

     **The generalisation worth carrying:** the duplicate stat block was
     visible in `heroes.ts` the whole time and nobody had opened that file
     looking for it. What surfaced it was the *distribution* step (§7) — asking
     "which of these two heroes should get which half of the slate" is a
     question you cannot answer without diffing them, and it is the only step
     in this runbook that forces you to. **Distribution is a roster audit
     wearing a movepool hat.** Two of Shadow's three roster findings came out
     of it and neither is about a move.
- **A second one, smaller: the type is nearly absent from the enemy side.**
  One Shadow enemy exists (Goblin Skulker, two moves), so thirteen of the
  fifteen never appear on the side of the field the player is fighting. Less
  acute than Nature's version of this finding — Shadow's mechanics are read
  off the player's own board, not off a clock the defender has to answer —
  but Stealth in particular is a status a player will never learn to play
  around until something casts it at them.

Arcane's, as a ninth — the slate that changed a state invariant rather than
adding a field, and the first whose engine work was mostly in code nobody
touched:

- **A capability the slate deleted — two prices and one test fixture.**
  (1) `arcaneBolt` cost **9**, which made it one of the three cheapest damage
  moves in the game and the reason Glyph could act every round on an 85 pool
  from level 1. The slate's cheapest real attack is Magic Bolt at 25. What
  replaces the *role* is Mana Tap at **0**, which is not the same thing — 0
  never scales, so where the old 9-mana bolt was a cheap poke that stayed
  relevant, Mana Tap is a floor you fall back to. Whether the type wanted a
  cheap-but-real opener as well as a free one is a design call the table states
  only by omission. (2) `manaBurst` was a 40 BP spread at **18**; the slate's
  cheapest spread is Arc Pulse at 45, so the type's way to touch both enemies
  went 18 → 45 — the same shape as Light's 18 → 50 and worth knowing is now a
  pattern across authored slates rather than a one-off. (3) The fixture
  `overload` (999 mana, uncastable by design) was the ONLY content exercising
  the engine's mana-legality guard, and the slate reuses its id. Moved to a
  test-local definition in `test/combat.test.ts` per §6 rather than left as an
  unpressable button in a shipped movepool.
- **A locked decision the slate brushed against — two, and the first is the
  bigger one.**
  (1) **`Combatant.currentMana` is no longer bounded.** It is the first
  resource in the game whose value may exceed its own maximum, and the first
  time a UI gauge has had to render past 100%. HP has `applyHpDelta` clamping
  every write; mana now deliberately has no equivalent, which means the
  invariant lives in prose and in `test/arcaneMoves.test.ts` rather than in a
  chokepoint function. That is a real fragility: a future feature that writes
  mana without going through a grant is free to reintroduce a clamp and nothing
  will fail loudly. Worth considering an `applyManaDelta` chokepoint if a
  second mana-moving mechanic ever lands.
  (2) **`derivedStatDeltas` is the first hole in the multiples-of-5/10 lock**
  (CLAUDE.md). Asked, and answered by the designer as an exemption rather than a
  rounding rule. Recorded in `docs/combat.md` and pinned from both sides —
  the derived grant lands unrounded, and every authored delta in the game is
  still asserted to be a multiple of 5.
- **A balance consequence outside the slate — three, and none of them is about
  a mana cost.**
  1. **Mana Tap is the only 0-cost move in the game**, and `hasAffordableMove`
     is a `>=` check, so **its holder can never be forced to Rest**. Rest is the
     engine's softlock fallback (`docs/combat.md`) and a whole game mechanic —
     "you overspent, now lose a turn" — simply does not apply to Zenith. That is
     arguably exactly right for the type that gives its pool away, and it is
     also the first hero in the roster that one of the game's tempo rules cannot
     reach. Reported rather than priced away, and pinned by a test so a later
     rebalance that gives Mana Tap a cost has to notice it is removing the
     battery's floor.
  2. **Arcane Overflow grants Attack to a type that has none.** Glyph is Attack
     25 and Zenith 20, so half of the slate's capstone is worth nothing on
     either hero that can cast it — it only pays on a PHYSICAL partner. This is
     the most explicitly doubles-shaped move in the roster and reads as
     deliberate, but it means one move's value swings by team composition more
     than anything else in the game, and a player who drafts two Arcane heroes
     gets a capstone that is half dead. Not tuned; named.
  3. **Arcane has no enemy.** Zero Arcane entries in `enemies.ts`, so none of
     these sixteen ever appears on the side the player is fighting. Nature's
     version of this finding, with an extra edge: **Magical Surge doubles MP
     Regen for BOTH sides**, so it is the one field effect whose downside a
     player learns only by having it used against them — and nothing can.
- **A fourth, smaller, and it came out of the distribution pass again.** Glyph
  and Zenith are NOT the same hero (365 vs 360 across the six non-mana stats,
  and genuinely different frames — 80/32/80 Wisdom-glass against 95/45/65
  bulk), but their kits and level-up pools **were byte-identical apart from one
  slot**: both opened `arcaneBolt, manaBurst, …` and both pools were off-type
  Mind filler. So the two played identically despite reading differently, which
  is the inverse of Shadow's Vesper/Marrow problem and just as invisible until
  someone asks which half of a slate each hero should get. Fixed here —
  artillery and battery, no shared pool entries — and it is the second slate
  running where §7 was what surfaced a roster problem. **Distribution keeps
  being a roster audit wearing a movepool hat.**

Mind's, as a tenth — the slate whose engine work was two small fields and one
invariant, and whose findings are all about a **roster of two**:

- **A capability the slate deleted — one, and it is a price point again.**
  `mindSpike` cost **6** and was priority **+1**; `psychicLance` cost 13 for 62 base
  power, which was the best power-per-mana in the game. The authored floor is 15 and
  the cheapest real attack is Psi Bolt at 20. The type kept its bracket row (Psychic
  Blow, +1) but at 30 rather than 6, so Mind's "act every round, always first, on
  nothing" option is gone. That is the same 18 → 45/50 shape Light and Arcane both
  reported, now on its fourth slate — **it is a pattern across authored slates rather
  than a per-type call**, and worth deciding deliberately rather than four more times
  by omission.
- **A locked decision the slate brushed against — and this one is the reason the
  slate mattered.** `getEffectiveStat` now floors every stat at 1
  (`docs/combat.md`). It does not break the two-pipeline lock or the
  multiples-of-5/10 lock — it clamps what is READ, and every authored delta is still
  a multiple of 5. What is new is that the stat pipeline now has a boundary it never
  had, and the boundary is where the damage formula stops being defined. Recorded
  rather than left implicit, along with the shape deliberately left unbuilt: the
  modifier itself is NOT clamped, so "how far is this debuffed" and "what can this
  hero do" stay two separate facts.
- **A balance consequence outside the slate — three, and all three are about the two
  heroes that hold the type.**
  1. **Cortex is a 50/50 hero with no physical half to take.** Attack 53 against
     Intelligence 55, and the authored sixteen contain **zero physical moves**, so
     over half of Cortex's offensive stat budget is inert. It is not a trap pick —
     Mind Shatter swings **Wisdom** (`offStatOverride`), which is the one move in the
     game that makes a Wisdom-55/Int-55 frame a real attacker, and the distribution
     is built around exactly that. But the 53 Attack is now paying for nothing, and
     whether Cortex should become a proper caster (the Marrow treatment) or keep the
     flat line as a type-graft hook is a roster decision, not a movepool one.
  2. **Cerebral Shock has no holder, by design.** It applies Conduct, whose
     `triggerTypes` are `['Storm', 'Iron']`, so no Mind move can detonate its own
     mark — confirmed as intended (Mind sets up, a partner cashes in). It is
     therefore the most partner-dependent move in the roster, and it is in the
     `test/stoneMoves.test.ts` orphan list rather than stuffed into a pool where it
     would be a dead button. Per Stone's rule: the deliverable is the list, not a fix.
  3. **Mind has no enemy.** Zero Mind entries in `enemies.ts`, so none of these
     sixteen ever appears on the side the player is fighting — Nature's and Arcane's
     finding for the third time. It bites hardest here of the three, because Mind's
     whole plan is a stat line the DEFENDER is supposed to answer by switching or
     cleansing, and a player who has only ever cast Disorient has never had to.
- **A fourth, and it is §7 doing its job for the third slate running.** Cortex and
  Lucius were not duplicates (Int 55 vs 75 is a real gap) but their pools were both
  off-type filler drawn from the same four fixture moves, so neither had a line.
  They now split by the axis the slate actually has: Cortex takes the Wisdom/control
  half its 55/55 frame can play, Lucius the raw magical half its Int 75 wants, with
  no shared entries. **Distribution keeps being a roster audit wearing a movepool
  hat** — that is three for three.

Spirit's, as an eleventh — the slate whose engine work was half-predicted by
the previous one, and whose findings are all about a type that has **one
hero and no heal**:

- **A capability the slate deleted — one, and it is the third time it has been
  the same three heroes.** `mendWounds` (Spirit, heal 45, singleAlly, 16 mana)
  is gone, and the authored seventeen contain **no heal-kind move and no
  cleanse**. So the type that reads as the game's healer can no longer put HP
  on an ALLY at all: Drain and Soul Rend return a share of a hit to the
  *caster*, and Second Wind is a HoT on itself. Cinder, Crimson and Valor —
  who were moved onto Mend Wounds one slate earlier when Light killed Restore
  Vigor — lose their heal outright rather than being repointed a second time
  (designer call, taken with the consequence stated). Sylva loses its only
  direct heal too, which is the consequence Nature's own hand-off predicted,
  arriving one slate later than expected. The cheapest heal in the game is now
  Light's Mend at 25, up from 16.

  **This is the fifth slate in a row to delete a price point, and it is worth
  stopping on.** Light reported 18 → 50, Arcane 18 → 45, Mind 6 → 20, Shadow
  9 → 15, and now Spirit 16 → 25 on the cheapest heal anywhere. Each was
  reported as a per-type identity call. Five of them is not five calls; it is
  an unstated global policy that authored slates start around 20 and fixture
  content started around 10. Worth deciding once, deliberately, rather than a
  sixth time by omission.

- **A locked decision the slate brushed against — two.**
  (1) `requiresUserHpBelow` is the fifth `conditionalPower` sibling and does
  not break the two-pipeline lock (BasePower-stage, like all four before it).
  What is new is the direction of the incentive: Shadow's execute has no
  counterplay but healing above the line and gets stronger as the victim nears
  death; this one gets stronger as the CASTER nears death, so it is
  self-limiting in a way the target-side form is not. Recorded in
  `docs/combat.md` rather than settled by accident.
  (2) `selfHpCost` is the **third** way a move can hurt its own caster, after
  `recoilPercent` and Fire's self-Burn, and the first whose price is knowable
  before the button is pressed. It can faint the user with no floor — the same
  designer call recoil got. The shape deliberately left unbuilt: a cost billed
  against anything other than max HP or a floor (current HP, mana, a stat).

- **A balance consequence outside the slate — three, and the first is the one
  that reaches furthest.**
  1. **Second Wind was re-priced from 15 to 30, and it is in SIX non-Spirit
     starting kits.** Renew 20 → 30 for double the mana, on Cube, Sentinel,
     Mordrax, Solace, Vesper and Revenant. The table says 30 and re-pricing an
     existing move is clearly intended, but this is the largest cross-type
     blast radius any slate has had — five heroes that have nothing to do with
     Spirit had their sustain slot doubled in price by a Spirit decision.
     Reported, not tuned.
  2. **Spirit is a roster of ONE.** Revenant is the only Spirit hero, so there
     is no second line to split the slate into — it draws the entire magical
     half (eleven pool entries, against every other type's four to eight),
     which is a deliberate departure from "keep the pool a line, not a sample"
     and a fact about the roster rather than the slate. The three PHYSICAL
     moves (Phantom Strike, Spooky Slice, Wailing Flight) have no home:
     Revenant is Int 77 against Atk 56, so Wailing Flight's 85 base power
     lands for less than Banish's 100 does. Stone's finding with the sides
     swapped — and per Stone's rule the deliverable is the list, pinned in
     `test/stoneMoves.test.ts`, not a fix.
  3. **Spooky Goblin could not afford its own kit.** 30 mana / 4 regen against
     a kit whose cheapest move went 11 → 50. Raised to 40/10 — the third time
     that exact fix has been applied, after Torch Goblin and Goblin Skulker,
     which makes 40/10 the de facto standard basic-enemy pool rather than a
     per-case patch.

- **A fourth, and it is the good news: Spirit is the first authored type since
  Storm whose signature status the player can learn by having it used against
  them.** Nature, Arcane and Mind each shipped with zero enemies of their type
  — the same finding three slates running. Spooky Goblin now plants Haunt
  (Wisp) and cashes it (Drain), so the mark, the spread and the counterplay
  (switching clears Haunt) are all demonstrable from the far side of the field.

- **A fifth, small, and it came out of §7 for the fourth slate running.**
  Widening the "no starter in its own pool" assertion past the type being
  authored found `ironWarden` carrying `fortify` in BOTH its kit and its
  level-up pool — dead weight `levelUpMovePool` could never offer, which made
  its pool read as five picks when it was four. Predates this slate and
  nothing else would have found it. **Distribution keeps being a roster audit
  wearing a movepool hat** — that is four for four, and the lesson has
  sharpened: write the §9 assertions over the WHOLE roster, not over your
  type's slice of it. The type-scoped version of this same check has shipped
  in four previous slates and none of them caught it.

**The Haunt count, per the type-keyed-hook question below.** Spirit's answer:
**twelve of its seventeen moves are damage moves, every one of them is
`singleEnemy`, and every one spreads onto a Haunted holder for free** — while
three of them plant the mark. The slate reads as having no spread move and
actually has twelve, gated behind one setup cast. That is Storm's Conduct
arrangement with one difference worth pricing: Storm needs a partner of the
right type to cash its mark in, and Spirit plants AND cashes with the same
kit. `test/spiritMoves.test.ts` pins the count so it cannot drift silently.

Iron's, as a twelfth — the slate that emptied the fixture pool, and whose
findings are almost entirely about the **eight heroes that have nothing to do
with the type**:

- **A capability the slate deleted — the biggest deletion any slate has made,
  and the fastest one a designer has ever answered.** `fortify` (Iron, +10
  Defense / +10 Wisdom, self, **10 mana**) was in **NINE starting kits across
  seven types** — Cinder, Cube, Sentinel, Hollowbark, Aegis, Warden, Valor,
  Clockwork, Bellows — plus two level-up pools. The slate's fourteen rows
  contained **no defensive buff under 50 mana** (Reinforce at 50, Juggernaut at
  70), so what went away was a role and not a price point: the game's cheapest
  buff, and the only cheap defensive self-buff anywhere.

  Eight of the nine were repointed onto the nearest Iron row that keeps each
  hero's slot shape (Sharpen for the Attack users, Pin Down for the cheap
  slots); Aegis, the one with a 70 pool and Wisdom 75, went onto its OWN type's
  Mend. **None got a defensive buff back**, because there was none to point at.

  **Designer call, same day: Fortify is re-authored into the slate** at **15
  mana for +15 Defense**, and Quick Jab's bracket comes back as **Swift Blow**
  (Phy 15, 15 mana, **priority +1**). Sixteen rows, not fourteen. Three things
  about how that landed are worth carrying:

  1. **Neither is a restoration.** Fortify lost its Wisdom half permanently, and
     Swift Blow is 15 base power at 15 mana where Quick Jab was 30 at 4. The
     designer answered the *role* both times and re-priced the row — which is
     the same shape as Fire's Stoke the Flames (12/`self` → 30/`bothAllies`)
     and Light's Daze-becomes-flinch. **A reported gap comes back as better
     content, not as the old row.**
  2. **Only four of the nine kits took Fortify back** — Warden, Sentinel,
     Hollowbark, Clockwork, the ones whose slot was genuinely defensive. The
     other five keep the Iron row they were repointed onto, because +30 Attack
     on an Atk-70 Cinder or an Atk-90 Bellows is a better move than +15 Defense
     and reverting it would be a worse hero for the sake of a tidier history.
     **Do not treat a re-authored move as an undo.**
  3. **The half that stayed deleted is the finding now.** Fortify no longer
     grants Wisdom, and the only three moves that do are all **Mind** (Brain
     Ward, Stasis, Mental Fortress). So a PHYSICAL hero can no longer buy
     magical defense from a move at all — it is equipment, relics, Evolution,
     or a Mind partner. Pinned as an exact set in `test/ironMoves.test.ts`
     rather than as a count. *(This corrects the first version of this
     hand-off, which claimed Fortify was the game's only Wisdom grant. It was
     not — Mind's slate had three, six rows earlier in the same file. Left
     visible rather than silently fixed, because "the only X in the game" is
     exactly the kind of claim a slate author should grep before writing.)*

  One smaller deletion on the same pass survives unanswered: `stunningBlow` was
  Daze's dedicated carrier. Light replaces it six times over, but the cheapest
  Daze in the game went 20 → 25 and the status is now entirely Light's.

- **A locked decision the slate brushed against.**
  `conditionalManaCost.requiresAnyEnemyStatus` does not break anything —
  it is the same replacement-price shape, the same resolution timing, the same
  single board-aware reader. What is new is that a cost condition and the
  move's own payload now touch the **same piece of state**: Iron detonates
  Conduct, so Metallic Blade's discount is spent by the cast that uses it *if
  and only if* the player aims it at the marked foe. That is the first time a
  price in this game has been something a player can choose to preserve, and
  it is recorded in `docs/combat.md` rather than settled by accident, along
  with the shape deliberately left unbuilt: a cost gated on the CASTER's own
  statuses, or on a status's absence.

- **A balance consequence outside the slate — three, and the first is a
  designer call already taken.**
  1. **Metallic Blade cannot be set up by its own type.** The slate plants
     Conduct zero times (designer call, 2026-08-30: Iron cashes, a partner
     sets), so its discount is gated on a **team composition** rather than on a
     setup any Iron hero can perform. Storm's Overcharge has a test asserting
     the key ships with the lock; this one cannot have that test, because the
     key is by construction on another hero. It is the most partner-dependent
     row in the roster — Mind's Cerebral Shock with the sides swapped, and the
     two are each other's answer.
  2. **Goblin Warrior could not afford its own kit.** 20 mana / 2 regen against
     a floor that went 4 → 15 and a cheapest attack that went 4 → 20; at the old
     pool it acted about once every five rounds. Raised to **40/10** — the
     fourth time that exact fix has been applied, after Torch Goblin, Goblin
     Skulker and Spooky Goblin, which makes 40/10 the standard basic-enemy pool
     rather than a per-case patch. It now swings Iron Fist and Opening Strike,
     which between them demonstrate the type's whole plan from the side of the
     field the player is fighting.
  3. **Conjured Sword has one home and wants a decision about the rest.** The
     designer's note ("a lategame learnable for certain spellcasters, not
     necessarily intended for native Iron heroes") is a placement instruction,
     not a mechanic — and every Iron hero is Intelligence 40 or below, so it
     genuinely cannot live with its own type. It went into Glyph's pool (Int 90,
     an 85 pool against the move's 80, and already the artillery line) as the
     least arguable single home. **Which other casters learn it is a roster
     decision, not a movepool one** — Lucius (Int 75), Zenith (85), Marrow (75),
     Solace (75) and Crimson (80) are the obvious candidates and are
     deliberately left unplaced, per Stone's rule that the deliverable is the
     list, not a fix.

- **A fourth, and §7 earns its keep for the fifth slate running.** Iron's three
  heroes were not duplicates, but two of their three kits opened on the same
  move and their pools were byte-identical off-type filler (Valor and Gallant
  both `shrapnelBlast/stunningBlow/…`), so the type read as one hero in three
  stat lines. They now split on the axis the slate actually has: Warden plays
  the **denominator** (Opening Strike, Pin Down, Rend Armor — Atk 55 behind
  Def 90), Gallant plays the **numerator** (Heavy Blow, the Attack ramp,
  Onslaught — Atk 80 behind Def 55), and Valor, the only starter, takes the
  middle and the side-wide Reinforce. **Distribution keeps being a roster audit
  wearing a movepool hat** — that is five for five.

Beast's, as a thirteenth — the slate whose engine work was one condition in
three costumes, and whose findings are about a type with **one hero, and a
signature that hero cannot use alone**:

- **A capability the slate deleted — three, and the third is the interesting
  one.** (1) `fangRush` was 45 BP at **8 mana** and priority **1**: the
  cheapest attack in the game after Quick Jab and Beast's whole bracket play.
  The slate keeps a bracket row (Pounce, +1) but at 35 mana for 30 base power,
  so the type still acts first and no longer does it for free. The floor went
  8 → 15 and the cheapest ATTACK 8 → 20, which is the sixth slate in a row to
  delete a price point — Spirit's hand-off already named that as an unstated
  global policy rather than a per-type call, and **this is not being reported
  again as a finding**, only counted. (2) `warHorn` was the only move in the
  game granting THREE stats at once (+10 Attack/Defense/Speed, both allies, 24
  mana), and it is gone with no equivalent: Pack Leader is two stats at five
  times the magnitude for four times the price, which is a different move.
  (3) `rendingClaw` was Bleed's dedicated fixture carrier and **the last
  per-status fixture carrier in the game** — every one of the nine statuses is
  now planted by authored content only. The slate replaces the vector three
  times over, but the cheapest Bleed went 12 → 20 and the cheapest GUARANTEED
  one 12 → 35.

- **A locked decision the slate brushed against — the counterplay surface,
  again, and this time it is gone entirely.** `requiresPartnerType` does not
  break the two-pipeline separation (BasePower-stage, like all six siblings)
  or the flat-modifier rule (doubling a multiple of 5 is one). What is new is
  that **every damage condition before it could be answered by the defender**
  — cleanse the Burn, switch off the Freeze, displace the field, heal above
  the line. A partner's TYPE cannot be interacted with at all: it is not
  answered, it is drafted, and the only thing that changes it mid-fight is the
  holder's own switch. Recorded in `docs/combat.md` rather than settled by
  accident, with three shapes deliberately left unbuilt (reading the ENEMY
  pair's types, reading anything about a partner other than its type, and any
  version that counts the bench).

- **A balance consequence outside the slate — three.**
  1. **Rally was re-priced 12 → 25 for +10 → +20, and it is in SIX non-Beast
     starting kits** (Tempest, Voltaic, Scallywag, Mordrax, Valor, Gallant)
     plus Crag's and Sentinel's pools. Second only to Spirit's Second Wind as
     a cross-type blast radius, and the same shape: the table says 25 and
     re-pricing an existing move is clearly intended, but eight heroes with
     nothing to do with Beast had their buff slot doubled by a Beast decision.
     Every one of them can still afford it (the tightest is Gallant, 45 pool);
     reported, not tuned.
  2. **Beast is a roster of ONE, and three of its fifteen rows need a Beast
     PARTNER.** Fang is the only native Beast hero, and two Fangs cannot be on
     one team — so on the roster as authored, Prowl's doubling, Pack Hunt's
     doubling and Pack Leader's half-price are all unreachable. They are
     reachable in practice, but only through a door in another file: **Sylva,
     Rime and Mordrax each carry a Beast type-graft Evolution**
     (`src/data/progression.ts`), and effective types satisfy the condition.
     So the type's signature is a mid-run unlock gated on having drafted one
     of three specific heroes, rather than a draft-time choice. Until it fires,
     Pack Hunt (40 BP / 40 mana) is strictly worse than Lacerate (50 BP +
     Bleed / 35). **That is the finding, and it is a roster decision rather
     than a movepool one**: a second Beast hero, or a fourth graft path, or
     leaving it as the reward for a specific pairing are three different
     answers and the deliverable is the list, not a fix.
     **ANSWERED 2026-08-30 — the first option, taken twice.** `Widow`
     (Beast/Shadow) and `Coil` (Beast/Mind) are on the roster
     (`src/data/heroes.ts`). Both are `starter: false`, so the roster keeps
     its one-starter-per-type shape and the pack condition is still not a
     DRAFT-time choice — it is now a Guild Hall / Recruit Contract one,
     which is earlier and far less conditional than the Evolution door it
     had. The graft paths on Sylva, Rime and Mordrax are untouched.
  3. **Goblin Grunt could not afford its own kit** — 25/3 against a floor that
     went 8 → 20 — and is raised to **40/10**, the FIFTH time that exact fix
     has been applied (Torch Goblin, Goblin Skulker, Spooky Goblin, Goblin
     Warrior). **Goblin Chief** is the first tougher-tier enemy to need one:
     50/6 against a kit whose rows cost 35 and 40, raised to **70/14**. If a
     sixth basic enemy ever needs it, 40/10 should probably just become the
     authored default rather than a per-case patch.

- **A fourth, and it is the good news.** Beast is only the second authored type
  since Storm whose signature the player can learn by having it used against
  them, and the FIRST whose signature requires two enemies to demonstrate:
  Goblin Chief holds Pack Hunt and fights alongside a Beast Goblin Grunt, so
  the pack bonus is visible from the far side of the field even on a run where
  the player never grafts Beast onto anyone. Nature, Arcane and Mind each
  shipped with no enemy of their type at all.

- **A fifth, small, and it is §7 reaching across slates for the first time.**
  Animal Spirit is the slate's one magical row, authored as "coverage for
  certain casters" and homeless by construction (every Beast hero is
  Intelligence 20). It went to **Sylva** — Int 60 on an 80 pool, an offensive
  Evolution that grafts Beast so the move gains STAB on exactly the build that
  wants it, and, the part that made it the least arguable home in the roster,
  **Nature's own hand-off reported that its slate has no spread damage move
  and nothing had filled that gap since**. The other candidates (Lucius,
  Marrow, Solace, Crimson, Glyph, Zenith, Revenant) are deliberately left
  unplaced per Stone's rule. Worth knowing that the previous slates' open
  lists are useful for placement and not only for engine work.
  **ANSWERED 2026-08-30, and by the roster rather than by placement.**
  `Coil` is Beast/Mind at Intelligence 75, so Animal Spirit now has a holder
  for which Beast is an INNATE type — STAB without spending an Evolution to
  get it. The Sylva placement stands (an Int 60 Nature caster is still a good
  home, and it is the graft build that wants it); this just means the row is
  no longer homeless by construction, because the construction changed.

Mech's, as a fourteenth — the slate whose engine work was four fields and
whose findings are about a roster of two, one of which cannot cast a third of
the type:

- **A capability the slate deleted — one, and it is the price point again,
  for the seventh slate running.** `sparkForge` cost **6** and was priority
  **+1**; `moltenHammer` was 70 base power for **15** and priority **-1**. The
  authored floor is 15 (Overclock) and the cheapest attack is 20. So Mech lost
  the same "act every round on nothing" option Frost, Light, Arcane, Mind,
  Shadow and Spirit each lost, and it is now seven slates rather than seven
  calls — the unstated global policy §10 flagged after Spirit, still unstated.

  What Mech did NOT lose is bracket play, and that is worth separating out:
  the fixture pair covered -1 and +1 with two fixed rows, and Cog Bop and Cog
  Slam cover the same two brackets with a coin flip. The type kept the axis
  and made it a gamble, which is the slate working as designed rather than a
  gap.

  Smaller, and a consequence of a commit one hour older than this slate:
  **Clockwork lost Fortify again.** It had been given the re-authored Fortify
  (+15 Defense, 15 mana) to answer Iron's reported gap; a full Mech kit takes
  it back off, because Clockwork is MONO Mech and an off-type slot is a slot
  with no STAB. What replaces it is Overclock — +20 to a stat that is Defense
  one time in five. That is a real downgrade in reliability for a hero whose
  Defense 70 / 130 HP is its best feature, and it is reported rather than
  patched around.

- **A locked decision the slate brushed against — two, and the first is about
  the LOCKED variance term.** Jackpot is the first move whose Base Power is
  not a number, which puts a second random term into a formula that already
  has exactly one (`Variance`, 0.85-1.0, "load-bearing — never remove",
  CLAUDE.md). It does not break the lock and it is not a second variance: it
  is a BasePower-stage term, resolved BEFORE the formula runs and visible to
  the player, where variance is a post-hoc multiplier nobody sees. But the two
  do compose, and the composition is worth stating once rather than
  discovering: a 50 roll into a 0.85 variance is 42.5 effective power against
  a 150 roll into a 1.0, which is a **3.5x spread on one button**. Recorded in
  `docs/combat.md` rather than settled by accident.

  The second: `resolveRandomBasePower` is the first randomness in the engine
  that does not come off `CombatState.rngState`. `seededRng.ts` says its PRNG
  is "the ONLY randomness source allowed inside /src/engine" and that still
  holds — this uses the same mulberry32 — but the SHARED STREAM is no longer
  the only place a roll can live, and that is a real change to how determinism
  is reasoned about here. The rule that replaces it: a roll the player reads
  before committing must be derived from state, and a roll they discover after
  committing must come off the stream. Also in `docs/combat.md`.

- **A balance consequence outside the slate — three.**
  1. **Four of the fifteen are magical and Mech has no magical hero.** Backfire,
     Overheat, Malfunction and Meltdown are `Mag`; Clockwork is Intelligence
     **45** and Bellows is **15**. Stone's finding with a fourth row on it, and
     one degree worse: Stone's three magical rows had NO holder and went to
     the orphan list, while these four have a holder who is simply bad at
     them. Meltdown at 80 base power through Intelligence 45 lands for less
     than Whirling Blades at 45 does through Attack 60, so the slate's
     magical capstone is worse than its mid-tier physical spread on the only
     hero who can cast it. Not a trap pick — Clockwork's kit leads on Piston
     Punch, a physical row — but half the slate is priced for a body the type
     does not have. Whether Clockwork should become a proper caster (the
     Marrow treatment) or whether Mech should get a third hero is a roster
     decision, not a movepool one.
  2. **Mech has no enemy.** Zero Mech entries in `enemies.ts` — Nature's,
     Arcane's and Mind's finding for the fourth time, and it bites hardest
     here of the four. Every other type's identity is a thing done TO the
     player that they learn to answer; Mech's is a gamble, and a player who
     has never had Jackpot rolled at them has never had to decide whether to
     switch out of a 150. The type is also the cheapest to demonstrate from
     the far side, because randomness needs no setup.
  3. **Perfect Creation and Malfunction are the most partner-dependent rows in
     the game, and they are dependent on FOUR types.** Conduct wants a Storm
     or Iron ally, Haunt wants Spirit or Mind. Mind's Cerebral Shock has the
     same shape with one type; Iron's Metallic Blade has it inverted. Mech is
     now the third corner of that arrangement and the only one that plants two
     different marks for two different pairs — so Perfect Creation's value
     swings further on team composition than any other move, from "six
     statuses, four of which do something" next to a Fire hero to all six next
     to Bellows-and-a-Storm-partner. Reported, not tuned.

- **A fourth, and §7 earns its keep for the sixth slate running.** Clockwork
  and Bellows were not duplicates (Int 45/Atk 60 against Int 15/Atk 90), but
  both pools were **entirely off-type Iron filler** and `momentumSwing`
  appeared in both — so the mono-Mech starter's whole level-up line was moves
  it got no STAB on, and the two heroes overlapped. They now split on the axis
  the slate has: Clockwork takes the magical attrition line plus Salvage (the
  only self-target heal in the game, and the answer to its own three self-Burn
  rows), Bellows takes the heavy swings plus the two rows that read no stat at
  all. No shared entries. **Distribution keeps being a roster audit wearing a
  movepool hat** — six for six.

- **A fifth, and it is a cross-slate assertion doing its job.** Iron pinned
  "every Wisdom grant left in the game is Mind" as an exact set, explicitly so
  that a later slate adding a non-Mind one would have to notice. Overdrive is
  "+20 to all stats", "all stats" includes Wisdom, and the test failed on the
  first run. Extended rather than deleted (`test/ironMoves.test.ts`): a
  physical hero CAN now buy magical defense from a move, but only at 100 mana,
  only as one fifth of a capstone, and only from a type it has to be standing
  next to — so the shape of Iron's finding survives its own exception. **Write
  the exact-set assertion, not the count.**

**One more procedural note, from Mind.** §0 step 1 says name the extensions up front
and §10 says report what you hit. Mind is the case where those were the same act:
the stat floor exists because a question about Brain Flay's second cast was asked
*before* any content was written, and the designer answered a question that had not
been asked. **Ask the extension question in a form that invites the system answer** —
"what does a second cast do?" got a better result than "which multiplier?" would have.

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
the mark. **Iron's count is ten of fourteen and zero** — every damage row cashes,
nothing plants — which is the same hook arranged as a doubles dependency rather
than as a self-contained engine, and it is a designer call rather than a gap. That is the type's whole engine and it is invisible in the design
table — `test/stormMoves.test.ts` pins the count so it cannot drift silently.

**The one procedural lesson from Storm**: §0 step 1 says name the engine
extensions up front. Storm is the case where that step should also **stop and
ask**. "Randomly give an ally X and an enemy Y" and "switch out" are not
extensions with an obvious shape — they are questions with two or three
defensible answers each, and picking one silently would have meant rebuilding
the targeting model or the switch path after the fact. Two questions cost one
round trip and saved the slate.
