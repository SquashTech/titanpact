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

## What a level-up COSTS (LOCKED, 2026-09-01)

**A level-up costs as many Training Points as the hero's current level.** Level 1 → 2
costs 1, level 4 → 5 costs 4, level 10 → 11 costs 10 (`levelUpCost`,
`costToReachLevel`, `src/run/progression.ts`; `test/levelCost.test.ts`).

### Why it is a curve

The price used to be a flat 1 at every level. Walk what that 1 actually bought:

| Levels | What the point buys | Value |
|---|---|---|
| 2–4 | A move gain, then *declinable* replacement offers (kit is 3, cap is 4) | Low, and falling |
| 5 | **Evolution** — 20–40 equipment points, plus a type, plus a passive or a move line | Enormous |
| 6–10 | Replacement offers again | Low |
| 11+ | **+10 to a chosen combat stat, forever, unbounded** | High, and never falls |

That curve is **convex**: the eleventh point sunk into a hero was worth strictly more than
the fourth, which was worth more than a declined offer on a bench hero. The system paid
*more* per point the harder the player concentrated — so pouring everything into one carry
was not merely available, it was the dominant line, and a 45-minute run resolved into
"whose one attacker sweeps".

### Why it is a price and not a cap

A per-act **level cap** was the obvious alternative and is the weaker one. It fences the
outcome without touching the convexity that causes it, and it strands currency the moment
every hero sits at the ceiling — a level-up screen that has nothing to sell is worse than
one that sells something expensive. A rising price leaves the carry build **legal** and
charges for it in **breadth**, which in a bring-6-pick-4 doubles game is the currency that
actually decides fights. Hyperfocus remains a real option (that is what `MASTERY_LEVEL` is
for); it is no longer a free one.

The concrete shape of the choice, which is the whole design claim:

- One hero rushed from level 1 to their Evolution: **10 points.**
- The four-hero battle core lifted to level 3: **12 points.**
- An act pays **~15–16** from fights. So an act buys either one, not both.

### Three consequences, all load-bearing

- **The mastery treadmill self-limits.** Level 11 costs 10, level 12 costs 11. The
  unbounded +10 tail needs no cap; it prices itself out.
- **A leftover pool that buys nobody is NORMAL, and it banks.** Every gate that used to
  read `levelUpPool > 0` now reads `canAffordAnyLevelUp` (`src/app/App.tsx`,
  `LevelUpScreen`) — otherwise the level-up screen reopens at every map node holding 2
  points against a roster that all costs 3. Banking toward an expensive level is a real
  and intended play; `RosterPeek` is where the banked figure is read.
- **Recruits are cheap to raise; veterans are not.** A Guild Hall hero arriving
  underleveled is now genuinely competitive with pouring the same points into an existing
  carry. That is the raise-vs-recruit axis (`progression.md`) finally having a price
  attached, and it reinforces strategic churn rather than fighting it.

### Income was rescaled with it

The curve is meaningless without the income it is denominated in, so per-fight payouts
moved in the same pass (`trainingPointsFor`, `src/app/App.tsx`): **2** for the act's
row-0 opener (`fight`), **3** for Monsters (`battle`), **4** for Skirmish (`skirmish`,
`elite`) and **4** for the Guardian — an act's four fights pay **13–14**, and the
reward-row XP option is a flat **2** (`UPGRADE_REWARD_XP`, `NodeRewardScreen`).

The opener is priced below the rest of the Monsters lane deliberately: it is the lightest
fight on the map, the one every path takes, and the one a player meets before owning
anything. The XP cache is priced *below one fight* for the same reason it exists — a
top-up the player can take instead of gold or a relic, not a substitute for fighting.

Income is deliberately **flat across acts**. Scaling it by act would inflate the price
curve away, and the resulting deceleration — the same income buying fewer levels every act
— *is* the brake. Over five acts a run pays ~65–70 from fights, which lands a four-hero core
a level or so behind Act 5 enemies at level 10 (`ENEMY_LEVEL_BY_ACT`,
`src/run/difficulty.ts`): the player is meant to be behind on level and ahead on gear.

> 🔒 **OPEN — flag before hardening.** Every number above is a first-pass playtest figure;
> only the shape is decided. Three specific questions the curve creates:
>
> - **Should Evolution cost a premium** over its linear price? It is the single most
>   run-defining purchase in the game and currently costs the same as any other level.
> - **A Recruit Contract hands over a leveled hero for free** — an Act 3 claim is a
>   level-5, already-evolved hero, i.e. 10 points of curve nobody paid. Contracts were a
>   modest bonus under flat pricing and are noticeably stronger under the curve. That may
>   be correct (contracts are documented as flat-value), but it is a change in their power.
> - **Does income ever scale by act?** The answer above is "no, on purpose". If playtest
>   says the player falls too far behind the enemy level curve, the fix to reach for first
>   is the enemy curve or the gear curve — not income, which un-does the brake.

## Spending is optional — the pool banks on the map

The Level Up screen is offered after every node that can afford a level, but it is no
longer a wall: **Bank _n_ XP for later** leaves it with the pool intact
(`RunState.levelUpDeferred`, `deferLevelUp`). The flag suppresses the automatic gate so a
banked pool is not re-offered at every node, and **any XP grant clears it**
(`grantUpgradeReward`) — new income always re-opens the screen. An unresolved Evolution
still blocks the out: that is a payout the player already bought, not a spend.

Banking only works if the banked figure is visible, so the map's status bar carries **Gold
· XP · Contracts** beside the act count, and the XP chip is a button whenever the pool can
afford a level — the way back into the screen the player walked out of. This is the
"banking toward an expensive level is a real and intended play" line above finally having
an interface.

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
- **An ability** (a passive or triggered effect), and/or
- **A move, granted outright** (`unlocksMoveIds`), subject to MOVE_CAP — see
  clause 5 below, and/or
- **A set of newly LEARNABLE moves** — see "Evolution steers future level-up
  offerings" below. These join the level-up pool; they are not handed over.

Not every path changes typing — **staying mono is a valid path** and a valid terminal
identity.

> ### The Evolution framework (2026-09-01 designer call)
>
> The shape every hero's node is authored to. **All 36 heroes are on it** as of
> 2026-09-05 — the 14 starters landed 2026-09-02, the 22 recruit-only heroes in the
> baseline pass that followed. `test/roster.test.ts` pins the parts of it that are
> checkable: three kinds per node, at least one mono path, no path that is a bare
> stat line, and a gross stat line inside the Rare-to-Mythic band.
>
> The recruit-only pass also took the five DUAL-typed recruits — Cinder, Brimstone,
> Bellows, Widow and Coil — somewhere the starters never had to go, and it took two
> passes to get there. Duals used to be offered no graft at all, so their three paths
> could only compete with each other; each one carries a passive or a granted move for
> that reason, and `learnableMoveIds` **without** a `typeGraft` is what lets a path hand
> over a whole LINE (the field is only type-checked when a graft is present). Cinder's
> Explosive opens Fire's magical column that way, which its physical body could never
> read.
>
> ### The RETYPE (2026-09-05, designer call)
>
> Then the prohibition itself came off. **The graft owns the SECONDARY SLOT** rather than
> appending to the type list — `effectiveTypes` and `rosterEntryTypes` both compose
> `[primary, graft]` — so a mono hero gains a second type exactly as before, and an
> innately dual one **trades the one it was born with**. Nothing ever reaches three types
> and the primary is never touched, which is the invariant that was actually load-bearing;
> the old throw was guarding an append that could not express a replacement.
>
> **A retype is a swap, not a gain**, which is what makes it safe: a mono hero's graft is
> pure addition (a chart column plus a slate plus STAB), while a dual hero pays for its
> new column with the old one and loses STAB on moves it is already holding. So it does
> not make duals better than monos — it makes their node contain a real fork instead of
> three flavours of the same currency.
>
> **Exactly one path per dual hero retypes** (`test/roster.test.ts`). Three would make the
> innate pairing a starting state rather than an identity; none is what the pass was fixing.
> And a retype path must carry the new type's line — `unlocksMoveIds` plus at least four
> `learnableMoveIds` — because clause 5's problem (a hero left holding a loadout that no
> longer reads what it now is) is the same problem a lost STAB creates. The five:
>
> | Hero | Path | Trade | What it buys |
> | --- | --- | --- | --- |
> | Cinder | Thunderblaze | Iron → **Storm** | The name always wanted it. The Iron it *keeps* still detonates Conduct — `Conduct.triggerTypes` is Storm and Iron, and detonation never asked for STAB. |
> | Brimstone | Hexfume | Shadow → **Nature** | The smoke was always the poison. Its Hexfume passive (arrival Poisons both foes) and Nature's Poison line are the same idea twice. |
> | Bellows | Overpressure | Iron → **Fire** | It is a boiler. Mech is the PRIMARY, so the self-burning Mech column stays learnable alongside the Fire one — which is what keeps Superheat fuelled. |
> | Widow | Silkbinder | Shadow → **Nature** | The trapper rather than the assassin. Nature has a physical column, which a 20-Intelligence spider needs. |
> | Coil | Hooded | Mind → **Stone** | A basilisk's gaze. The riskiest of the five: Coil's pool is almost all Mind, so this spends nearly every STAB it has. Stone's magical column is exactly three moves, which is just enough to refill a loadout — watch it in playtest. |
>
> Lucius is the counter-example that still stands. He was retyped **mono-Mind** in the same
> pass (`types-and-heroes.md` "The stat budget"), and the retype rule does not undo that: a
> mono hero gets two graft paths plus a mono one, where a dual gets one retype. Being born
> dual is no longer a tax, but it is still less branching than being born mono.
>
> Tempest was authored from nothing (2026-09-02) rather than re-authored: it was the
> one hero of 36 with no `evolutions` entry at all, and nothing failed — the lookup is
> `?? []`, so it simply never evolved, in the player's roster and in `enemyGen` alike.
> `test/moveTiers.test.ts` now pins the coverage, the three kinds, and the graft's
> learnable line, so the next omission is a red test rather than a silent one.
>
> **1. Grants got bigger.** An Evolution is permanent, once per hero, and
> run-defining; paying out the ~20 points a Common item pays was the wrong
> order of magnitude. Re-authored nodes sit at roughly 20–40 points in
> equipment currency (`src/run/equipment.ts` `STAT_POINT_VALUE` — HP and Mana
> at ½, MP Regen at 3×), i.e. Rare-to-Epic. The multiples-of-5/10 rule is
> untouched; only magnitude moved.
>
> **2. The MONO path trades stats for a PASSIVE.** A graft buys a whole second
> column of the type chart *and* a second slate to draw level-up offers from. A
> mono path offering only stats cannot compete, which quietly made "mono is a
> valid terminal identity" false in practice. So a mono path takes the
> **smallest stat line on its node** and carries something no graft can offer:
> Crimson's **Pyroclasm** grants Firestarter, Fang's **Bloodhunt** grants
> Bloodthirsty.
>
> **A default, not a law** (2026-09-02): Riptide and Rime both put the passive on a
> GRAFT instead — Siren's Enthrall, Glacier's Frozen Stone — and pay for it in
> the stat line (Siren grants no stats at all). What the clause protects is that a
> mono path must carry something a graft cannot, and a signature MOVE (clause 5) serves
> that too: Riptide's Tidecaller has Lizard Rush, Rime's Avalanche has Snowball. What
> stays true is that a mono path offering *only stats* cannot compete.
>
> Tempest's Thunderhead breaks the other half (2026-09-02): +30 Speed ties Lightning
> Rod's net 30 rather than sitting under it, and it carries Feedback Loop on top. The
> designer's read is that a grant spent entirely on ONE axis that is neither offense
> nor defense is not the same 30 points as a mixed line — Speed only orders actions —
> and that 65 to 95 is worth being the loudest thing on the node. Watch it: if a mono
> path can out-pay both grafts, the clause was measuring the wrong thing.
>
> **3. A GRAFT path pays three ways** — more stats, the new type, and a line of
> that type's moves via `learnableMoveIds` (below). Three payoffs against the
> mono path's two, because the graft is also giving up the passive. STAB on the
> grafted line is the point: a type with no moves in it is half a graft.
>
> **4. A path may DRAMATICALLY REFOCUS the hero.** `statGrants` is signed, and a
> refocus path spends one stat to buy another. Fang's **Warhowl** is the worked
> example: −30 Attack / +60 Intelligence turns a 90-Attack physical body into an
> 80-Intelligence caster that kept its Speed. Nothing in the contract needed
> changing for this — the field has always been signed — it had simply never
> been used to say something that loud. The Attack is *spent*, not merely
> unused, which is what makes it a choice rather than a strict upgrade.
>
> **5. A path GRANTS a move, not only the promise of one** (2026-09-01, the fix
> for the refocus risk below). `unlocksMoveIds` is now authored, and it is what
> makes a refocus land the same turn it is chosen: Warhowl hands Fang
> **Poltergeist**, so the 60 Intelligence has something to read immediately
> rather than waiting on a level-up roll. `learnableMoveIds` still carries the
> *line*; `unlocksMoveIds` carries the one move the path is incomplete without.
>
> **The refocus risk, and how the grant is priced against MOVE_CAP** (closed
> 2026-09-01): a hero whose authored pool is entirely one category — Fang's is
> entirely physical — used to come out of a refocus with a loadout that no
> longer read the stat it now lived on, because `learnableMoveIds` only
> *offers* the fix on a later level-up. A granted move fixes that, but a level-5
> hero is normally already at MOVE_CAP, so the grant is **priced, not free**:
> `applyEvolutionMoves` (`src/run/progression.ts`) fills open slots in order and
> returns the rest as `overflow`, which `LevelUpScreen` puts to the player as the
> same **replace-or-decline** offer a level-up at the cap makes. The loadout
> never grows to five, and the player — not the path — decides what the new move
> displaces.

Typing usually shifts by *adding* a secondary (mono → dual), but a path may
also *replace* the secondary outright — whether it was granted by an earlier graft or
is the hero's INNATE second type (the retype, above). A hero flavored around
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
chosen identity. The path you *don't* pick does not open its offerings.

> **Implemented (2026-09-01):** `EvolutionPath.learnableMoveIds`
> (`src/run/progression.ts`). `levelUpMovePool` unions the hero's authored pool
> with the `learnableMoveIds` of every path it has taken, deduped, then applies
> the same unlocked-filter and tier gate to the whole thing. Three consequences
> worth stating, since the rule above left them open:
>
> - **The retained primary keeps being offered** — the pool is *widened*, not
>   redirected. That is the "expected yes" above, now settled.
> - **Weighting stays uniform.** The level-up roll is flat across the pool, so a
>   graft's moves compete with the primary's on equal footing. If a grafted hero
>   should skew toward its new type, that is a weighting change to `levelUpMovePool`,
>   not more entries in the list — open, not decided.
> - **Tier gating still applies.** A Late graft move is unreachable until level 7
>   even though the graft happens at 5, so a graft arrives as a curve rather than
>   as a dump.
>
> Learnable moves also feed the level-up **floor** (`src/data/progression.ts`
> FLOOR, `test/moveTiers.test.ts`): a graft can only ever *add* to the pool, so
> it can widen a hero past the floor but never below it. The floor is still
> authored on the base pool, which is correct — it must hold for a hero that
> takes the mono path.

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
