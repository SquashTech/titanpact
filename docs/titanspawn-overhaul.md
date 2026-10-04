# titanspawn-overhaul.md — The Titanspawn Overhaul

> **STATUS: BUILT IN FULL (2026-09-13, per user direction).** Location factions are replaced by
> one per-type mob family (**Titanspawn**), Locations partition the fourteen mortal types, the run
> has a **mortal companion**, the Pact Clock is off the bench, and the fork is a previewed
> Elite-or-Skirmish. §11 is the rule in force wherever it disagrees with older docs.
> **Later changes on top:** enemies are LEVELLED per node and the two difficulty tracks are gone
> (`docs/enemy-levels.md`, 2026-09-15); the companion's tier-steps sit on Mastery pips 5 and 10
> and its gear goes with it on a KO (`docs/mastery.md`, `docs/gear-absorption.md` §7); the run is
> four acts then the finale (`docs/xp-overhaul.md` §5); the scripted tutorial is deleted
> (`docs/tutorial.md`).
>
> The approved art is in `docs/art/titanspawn-bestiary.html` (also published at
> https://claude.ai/code/artifact/94773309-d55c-4bb7-98ff-14edf8de9a57).

---

## 1. The problem, and the rule it reduces to

The map split fights into **Monsters** (not recruitable) and **Skirmish** (recruitable), and each
Location authored its own monster faction. From Act 2 the line blurred: Cultists and Raiders were
named **roles** on hero-shaped bodies with hero-shaped kits, so the player met something that looked
like a hero, beat it, and got no contract — a withheld reward, not fodder.

The fix is to make the mob layer *legible as a mob layer* everywhere, the way Pokémon's wild
encounters are legible without a caption:

> **The mob layer is the type chart made flesh. The Guardian is where the chart lies.**

A Titanspawn has no exception — a Fire one is answered by Water, and that is the whole lesson.
Every exception the run wants lives on the Guardian and its champion, which stay authored.

## 2. Titanspawn

**What they are.** What leaks through the failing seal takes the colour of the land it leaks into,
and grows as the seals break — so the mob layer is a miniature of the Titan in every act. This is
the one place `types-and-heroes.md`'s reframe ("type is the domain a hero draws on, not what its
body is made of") is deliberately inverted: heroes *draw on* a domain; spawn *are* the domain
leaking into flesh.

**Shape.** One line per type — **fourteen**; Ancient never spawns — in three tiers, **Early → Mid →
Late**, each an objective upgrade of the last. Mono-typed, no branches, no type-graft. A tier is a
distinct body, not a scaled one. `src/data/titanspawn.ts`; `test/titanspawn.test.ts`.

**Stats.** *Early is round, Late is spiked.* An Early's seven stats sit within roughly 1.3× of each
other; Mid grows the type's pair; Late spikes the type's primary stat past anything on the hero
roster. Totals **200 / 400 / 600** on the enemy convention (`SPAWN_COMBAT_TOTAL`) — below the cast,
at it, above it. Neither the 550 nor the 28-point grade budget binds a spawn; both are *hero* rules.
A spawn's **level** is rolled through its line's grades on top (`enemy-levels.md`).

**Kits.** A spawn's move pool is **its type's authored slate**, read at its tier's band; kits are
**3 / 4 / 4** (an Early is thin, Mid and Late are full). No moves are authored for the mob layer.
What each line "excels in" is read off the slate's shape, which is what the Late's spike matches:

| Type | Excels in | Early | Mid | Late |
|---|---|---|---|---|
| Fire | Int, Burn | Emberling | Kindlehide | Pyroclast |
| Water | Speed, Wisdom, Renew | Puddling | Rillfin | Breakwater |
| Frost | Int, HP, Freeze | Sleetling | Hoarfang | Frostheave |
| Storm | Speed, Int, Conduct | Arcling | Voltail | Stormfront |
| Stone | HP, Def, Provoke | Pebbling | Slabback | Monolith |
| Nature | Wisdom, HP, Poison/Renew | Sproutling | Bramblehide | Wildwood |
| Light | Wisdom, Int, Daze, heal | Gleamling | Lanternmoth | Dawnwing |
| Shadow | Atk, Speed, Ambush/Bleed | Duskling | Gloomfang | Nocturne |
| Arcane | Int, Mana, buffs | Runeling | Sigilwing | Armillary |
| Mind | Int, Wisdom, buffs/debuffs | Whimling | Mesmerid | Cerebra |
| Spirit | Int, HP, Haunt | Wispling | Shroudkin | Threnody |
| Iron | Atk, Def | Rivetling | Ingot | Siegework |
| Mech | mixed Atk/Int, MP Regen, Burn | Cogling | Gearhound | Dynamo |
| Beast | Atk, HP, Bleed | Cubling | Ravager | Behemoth |

Stone and Iron overlap on the slate, as do Shadow and Beast; the spikes split them on purpose —
Stone the **HP/Def** wall that Provokes, Iron the **Atk/Def** bruiser; Shadow the **Speed**
ambusher, Beast the **HP/Atk** brawler. Fire's Late *is* the Burn, Mech's *pays* it.

**Names.** A spawn never shares a name with any content in `src/data` (pinned by test). Sharing a
*root* with a move in its own slate (Emberling/Ember) is allowed for the approved names and avoided
for the next one.

**Art.** Heroes stay 48px pixel art; spawn are **geometric SVG**, generated per line from one
`(tier, pose)` function (`src/view/shared/titanspawnArt.tsx`) — flat fills in three tones of the
type hue, primitives only. The two styles are meant to be *obviously* different. Rules:

- **The Titan's eye is the family tell** — gold burning to the mythic red, vertical slit, the one
  feature on every body that is not type-coloured. **One eye at Early, two from Mid**; a Late's two
  are *wrong-placed or wrong-sized* and idle half-lidded. "Many eyes" was tried and rejected — it
  swallowed the silhouette.
- **The element is a feature, then a tool, then the body.** Early carries one token of it; Mid
  fights with it; Late is an armature for it, and **breaks the hero frame**.
- **Every Early ends in -ling**, and the suffix drops at Mid.
- **Poses are two layers**: a global transform (attack leans and lunges; hurt recoils) plus a
  per-line accent. A pose is a STATE, as it is for hero frames.
- **Scale and facing.** The viewBox is the gallery's 108 units with the ground line on its bottom
  edge, so a spawn stands where a sprite's feet are; `overflow: visible` lets a Late leave the box.
  No per-side flip — this battlefield never flips a sprite. The gallery's ground shadow is dropped
  in favour of the card's own platform.

**Guardian art** (2026-09-16, per user direction — *these enemies are pieces of the Titan that
mutated, so keeping them visually consistent is key*). The champions and the Herald are drawn in
the same vocabulary (`src/view/shared/guardianFigures.ts`, primitives shared through
`figurePrimitives.ts`; review page `docs/art/guardian-bestiary.html`, written FROM the module by
`scripts/art/guardian-gallery.ts`). The old pixel sprites are archived under `art/archive/guardians/`.

- **The body is the mortal type's three tones**, at a Late's scale or over it, and **every
  Guardian breaks the hero frame** on at least one edge. A Guardian is bigger because it is DRAWN
  bigger, never boxed bigger.
- **One Titan eye**, half-lidded at idle. A second, wrong-placed eye was tried on every Guardian and
  taken off.
- **No seal on the body.** Nothing on a Guardian is Ancient-coloured (the test pins it); the
  finale's unsealed champion is the same drawing.
- **The Endbringer is the Titan's HERALD, not the Titan** — a gaunt hooded standard-bearer,
  mono-Ancient, the Titan's eye on the pennant and the broken seals threaded on the pole.
- **Poses are the spawn's two layers**, with a per-Guardian accent.
- **Renames** (per user direction): the Leviathan is the **Kraken** (`kraken`), the Lava Beast the
  **Dragon** (`dragon`), the Goblin Lord the **Manticore** (`manticore`). A save naming an old id
  is rejected.

## 3. Locations partition the types

The mob layer is a **hard filter** on the Location's types (`LocationDefinition.spawnTypes`); the
hero-pool `affinity` stays a **weighting**, aligned to the partition where the two disagreed. The
Location becomes a counter-pick decision — *bring Water to the Foundry*.

| Location | Spawn types | Champion (mortal half) |
|---|---|---|
| Wild's Edge | **any** Early | Manticore — Beast |
| Molten Foundry | Fire / Mech / Iron | Dragon — Fire |
| Forbidden Forest | Nature / Beast / Light | Elder Bough — Nature |
| Blighted Shrine | Shadow / Arcane / Mind | Yugzulach — Shadow |
| Storm Coast | Storm / Water / Stone | Kraken — Water |
| Necropolis | Spirit / Frost | Skeleton King — Spirit |

Fourteen types into five three-seat Locations is one seat short; the user chose a two-type
Necropolis over sharing Shadow with the Shrine. A two-line Location repeats a body (two Wisplings
and a Sleetling), which is what a mob layer looks like. Bought Locations (`docs/locations.md`) carry
their own `spawnTypes`.

**What stays authored.** The Guardians and their champions. **A Guardian's escorts are spawn of its
Location's types** at `SPAWN_TIER_BY_ACT` (Early / Mid / Mid / Late), three levels under par. Every
champion's mortal half sits *inside* its own triple, so the Location's answer is the Guardian's
answer in every case — the mob layer is exceptionless, the Guardian is the only place an exception
can live, and today none does (§10).

## 4. The map

**Monsters bookend the act; heroes fill the middle.** The forced opener and the Guardian draw spawn;
the rows between draw the hero pool.

- **The opener.** Act 1's is **two Early spawn** from all fourteen types — an automatic win, the
  on-ramp. From Act 2 it is a Mid of the Location's types leading Earlies, the escorts' tiers rising
  with the act (`OPENER_ESCORT_TIERS_BY_ACT`) and the Earlies carrying one item each
  (`OPENER_GEAR_FROM_ACT`).
- **The fork** is **Elite-or-Skirmish** — both hero pool, both recruitable — and each option
  **previews the enemy typing on its tile** (`ElementPie.tsx`, the disc cut into one wedge per
  type). The Elite keeps its risk/reward axis; the preview adds the tactical one. **The two options
  differ in at least one type**, or the choice is empty.
- **Encounters are deterministic per node** (`src/run/encounters.ts`, the one node→encounter
  function for App, sim and preview): the seed is derived from the map seed and the node id, so
  nothing new is stored and **the preview IS the fight**. The guarantee is on the TYPE SET — the
  fork's Skirmish re-rolls its seed (up to eight times) until its scouted types differ from the
  Elite's. The preview is the enemy side's effective types, a grafted Evolution included.
- **`battle` is off the generated map** but not deleted; a save can still hold one.
- **Enemy tier is a readable difficulty gauge**: an Early in Act 3 is a breather, a Late is not,
  and the silhouette says which. The `fight` tile wears the Titan's eye and reads **Titanspawn**.

**Claim supply goes up by one per act** (the fork's second option is now recruitable).

## 5. The companion

The Fire Emblem **trainee** (weak early, above the cast with investment) fused with **death fodder**
from competitive doubles. The cute is the price. `src/run/companion.ts`, `CompanionScreen`.

**The beat.** After the run's first fight, one of the Early spawn the player beat — the beaten
side's lead (`companionCandidate`) — **joins**. It cannot be declined (per user direction). It
arrives at the roster's par with those levels' growth rolled: RAW is unbuilt, not hollow. One per
run.

**It is a hero in every respect but one.** It takes one of the six roster slots, levels roster-wide,
takes its schedule's offers off **its type's whole slate** (`spawnMoveTiers`), takes Mastery pips,
holds items. **The only new rule: a knockout removes it from the run** (`RosterEntry.mortal`) — not
"stays down", gone, with its pips and its gear. The `lost` beat (its body absorbed back into the
Titan, the Eyes opening behind it) comes before anything else in the post-fight chain, so the report
never lists a hero that is already gone. Mortality is read at resolution off the fight's last state.

- **The roster slot is load-bearing.** A free seventh body with permadeath is always fielded as a
  sacrifice and there is no decision. In a slot, every contract presses on the cap, and terminating
  the mascot for a contract hero is the cap rule doing its job with feelings attached.
- **Tier-steps, not a branch.** At Mastery 5 it steps Early → Mid and at 10 Mid → Late
  (`STEP_PIPS`): a heroId swap that keeps moves, items, levels and growth and takes the next body's
  base line and figure, with the `grown` beat. No Evolution screen, no graft.
- **The Late must be strictly better than a hero, not merely viable.** 600 and a strong pool is the
  trainee's payoff. This is the number the whole idea hangs on, and it is authored, not derived.
- **It does not count toward Act 1's enemy-count cap** (per user direction): the cap reads the
  immortal roster, so the Act 1 Skirmish is 3v2.
- **`rosterHeroes`** (`data/content.ts`) is the roster-facing lookup — `heroes` plus the spawn;
  the pools a run draws from still read `heroes`, which keeps a spawn out of the draft, the Guild
  Hall, the contracts and the Skirmish.
- **The Guild Hall comparison answers itself**: a hire is 50g for a raw hero that cannot die; the
  companion is free, can end above the cast, and can be lost.

## 6. The Pact Clock comes off the bench

**Decided (user direction).** The Clock takes its fraction of max HP from **active combatants
only** (`tickPactClock`). It reversed the 2026-09-01 "both sides, active and benched" rule, and the
fiction got a cleaner line: **the bench is out of the leak.**

It still terminates: every switch-in eats at least one boundary tick, and the escalation makes any
active hero lethal within a few rounds. The immediate reason was the companion — a benched mortal
dying to the Clock was the one death that is not a decision — but the rule is general. Measured
over 892 simulated fights: 0.8% reach round 30 and none hit the engine cap (0.9% / none with the
bench in).

## 7. What is deleted

Done: every faction's basics and leader (Goblins, Cultists, Fae, Foundry, Necropolis and Raider
rosters), `FactionRoster`, `factions`, `LocationDefinition.factionId`; their sprites are archived
under `art/archive/factions/`, outside the sprite glob. `locations.md` and `lore.md` were rewritten
to match (the six *Guardians* are what the wardens decayed into; the spawn are the leak).

## 8. What this does NOT touch

The damage formula, the stat pipeline, the 550 and 28-point hero budgets, Classes, Banners, Boons,
the Tutor, the Mentor, items, the roster cap, the lock-in rule, node type ids, the Guardians and
champions, and the type chart. No engine vocabulary is added: a spawn is a `HeroDefinition`-shaped
enemy with an authored tier, and the companion is a `RosterEntry` with a mortality flag.

## 9. Order of work

All phases **DONE 2026-09-13**: (0) this doc and the gallery; (1) content and renderer,
`src/data/titanspawn.ts` and `titanspawnArt.tsx`, `HeroPortrait` dispatching to it; (2) the mob
layer, `src/run/spawn.ts`, `test/mobLayer.test.ts`; (3) the fork, `src/run/encounters.ts`,
`test/encounters.test.ts`; (4) the companion, `test/companion.test.ts`; (5) the Clock off the bench;
(6) a sim pass, below. The tutorial rewrite was superseded 2026-09-24 by first-time tips.

## Phase 6 findings (2026-09-13, sim pass 8)

2000 skilled-pilot runs and 1000 chart-pilot runs. Directional, as every batch is. The difficulty
tracks this pass measured were replaced by enemy levels two days later (`enemy-levels.md`), so read
the act figures as history; the findings below still describe the design.

1. **Act 1's opener is the auto-win.** 99.6% won, 1.7 rounds, 96% HP at the end.
2. **Claim supply on the fork went up, and the fork stayed fair.** Contract joins 3.75 a run; node
   lift Skirmish +0.14 / Elite −0.14 (z ±1.1).
3. **The companion is the game's biggest late bloomer, and mostly does not live to be one.** Early
   trade ratio 0.43, late 3.36 (above every hero's late half but Glyph's); a knockout takes it in
   about half of runs, at a mean encounter of 3.3. "The Late must be strictly better than a hero"
   holds; the question is whether the trainee should die this often before it gets there.
4. **The Guild Hall did not visibly tilt** (hires 2.26 a run against contracts 3.75).

**Two dials:** the Act 1 enemy-count cap now excludes the companion (per user direction; Act 1
78 → 83%); and `SPAWN_TIER_BY_ACT` keeps Late escorts from Act 4 — a Late in Act 4 is not a
breather, and that is the point of it (Late from Act 5 only measured Act 4 82.9 → 96.1%).

## 10. Open questions — DO NOT silently resolve

Decided and removed: gear on a dead companion (first strip to bag; since gear absorption, it goes
with the companion), the opener's shape from Act 2, where the second tier-step sits (Mastery 10),
spawn totals and kit sizes, and whether faction art is archived (archived).

- **A replacement companion after a death** — built as **never** (`RunState.companionHeroId` is
  kept after the loss and gates the join); reversing it is one condition in `companionJoinDue`.
- **Which Earlies can be the companion** — built as the beaten side's lead, so any of the fourteen
  can ask. A subset would be a filter on `companionCandidate`; the cuteness bar is open.
- **The Guardian exception** — every champion sits inside its Location's triple (§3); whether one is
  moved off it on purpose.
- **The Necropolis as "the deep location"** — Late spawn a step early if play keeps calling it the
  wall (it was the worst Location in every act it appeared in, pass 8).

## 11. Locked invariants this overturns

| Before | After |
|---|---|
| Locations author a **faction** that `fight`/`battle` draw from; the Guardian's escorts are its basics | Locations name **spawn types**; the opener and the escorts draw Titanspawn |
| Encounters scale on two tracks with **Monsters baselined at Act 2** | Two tracks, then (2026-09-15) none — enemies are levelled per node (`enemy-levels.md`); a spawn's tier is its body, its level the run-depth axis |
| **The Pact Clock hits both sides, active and benched** | Active only; the bench is out of the leak |
| The fork is **Elite or Battle** (one recruitable, one not) | **Elite or Skirmish**, both recruitable, both previewing enemy typing on the tile |
| Nothing on the roster is lost except by **termination** | A KO'd companion is **gone from the run** |
| Every roster hero's stats sum to **550** and its grades to **28** | Both stay *hero* rules; the companion's tiers are authored outside them, Late 600 |
| "Ancient" is reserved; the six peoples are what the wardens **decayed into** | Unchanged for Ancient; the six *Guardians* are what the wardens decayed into, and the spawn are the leak |
