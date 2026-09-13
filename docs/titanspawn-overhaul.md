# titanspawn-overhaul.md — The Titanspawn Overhaul

> **STATUS: DECIDED, NOT BUILT (2026-09-13, per user direction). NO PHASE OF §9 IS IN.**
> This module replaces the location factions with a single per-type mob family (**Titanspawn**),
> partitions the fourteen mortal types across the five run locations, gives the run a **mortal
> companion**, takes the Pact Clock off the bench, and turns the map's Elite-or-Battle fork into
> a previewed Elite-or-Skirmish. `CLAUDE.md`'s invariants still describe *today's* game and are
> the rules in force until the phase that replaces each one lands — **check §9's Status column
> before assuming anything here runs.** Where this disagrees with `locations.md`, `run-loop.md`,
> `lore.md` or `combat.md`, those describe what runs and this describes what replaces it. Each
> phase updates them as it lands.
>
> The approved art is in `docs/art/titanspawn-bestiary.html` (also published at
> https://claude.ai/code/artifact/94773309-d55c-4bb7-98ff-14edf8de9a57). Its inline script IS the
> generator phase 1 ports; the page is the review surface, not a mock-up.

---

## 1. The problem, and the rule it reduces to

The map splits fights into **Monsters** (not recruitable: `fight`, `battle`) and **Skirmish**
(recruitable: `skirmish`, `elite`), and each Location authors its own monster faction. In Act 1
the split reads: Goblins are a *species* with a *leader* at a stat total of ~180, and nobody
mistakes one for a hero. From Act 2 the line blurs. Cultists and Raiders are named **roles** on
hero-shaped bodies with hero-shaped kits, so the player meets something that looks like a hero,
beats it, and gets no contract. That is confusing on first contact and unsatisfying on every
contact after — a withheld reward, not fodder.

The fix is not to remove the split. The monster track is doing structural work nothing else
does: it is the **easy track by construction** (a 400-total roster on a baseline one act behind
the hero pool's, `difficulty.ts`), which is what keeps the forced opener winnable without any
hidden fairness dial. The fix is to make the mob layer *legible as a mob layer* everywhere, the
way Pokémon's wild encounters are legible without a caption:

> **The mob layer is the type chart made flesh. The Guardian is where the chart lies.**

A Titanspawn has no exception — a Fire one is answered by Water, and that is the whole lesson.
Every exception the run wants (a boss outside its own answer, a tell that misdirects) lives on
the Guardian and its champion, which stay authored. `locations.md` §6 found tentatively that "the
exception is the lever that matters, not the spine"; this doc takes that finding and gives the
exception exactly one home.

## 2. Titanspawn

**What they are.** Lore §3 says the binding leaks. What leaks through the failing seal takes the
colour of the land it leaks into, and grows as the seals break — so the mob layer is a miniature
of the Endbringer in every act, and fighting it is fighting the Titan's weight before the Titan.
This is also the one place `types-and-heroes.md`'s reframe ("type is the domain a hero draws on,
not what its body is made of") is deliberately inverted: heroes *draw on* a domain; spawn *are*
the domain leaking into flesh. Note it there so the inversion reads as a rule, not a contradiction.

**Shape.** One line per type — **fourteen**; Ancient stays the finale's alone and never spawns
— in three tiers, **Early → Mid → Late**, each an objective upgrade of the last in the
Squirtle/Wartortle/Blastoise sense. Mono-typed, no branches, no type-graft. A tier is a distinct
body, not a scaled one.

**Stats.** *Early is round, Late is spiked.* An Early's seven stats sit within roughly 1.3× of
each other; Mid grows the type's pair; Late spikes the type's primary stat past anything on the
hero roster. The tiers sharpen, not just scale. **Late is ≥ 600 total** (user direction) with a
strong pool — an enemy Late at 600 plus the monster track's Act-5 steps still lands under a
hero-pool enemy at 550 plus the skirmish track's, so "legitimately powerful" and "the easy
fight" do not contradict; the two tracks already do the separating. Early and Mid totals are
**phase-1 figures to author**, not decided here (the Goblins' ~180 and the old factions' 400 are
the brackets). Neither the 550 budget nor the 28-point grade budget binds a spawn — both are
*hero* rules — and both spawn numbers are authored outright, never derived.

**Kits.** A spawn's move pool is **its type's authored slate**, read at its tier's band: Early
spawn hold Early moves, Mid hold Mid, Late hold Late (`MoveDefinition.tier`). No new moves are
authored for the mob layer. What each line "excels in" is read off the slate's shape
(physical/magical lean, dominant status), which is what the Late's stat spike matches:

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

Stone and Iron overlap on the slate (both physical walls), as do Shadow and Beast; the spikes
split them on purpose — Stone the **HP/Def** wall that Provokes, Iron the **Atk/Def** bruiser;
Shadow the **Speed** ambusher, Beast the **HP/Atk** brawler. Fire and Mech both Burn; Fire's
Late *is* the Burn, Mech's *pays* it, as the slates do.

**Names** were checked against every content name in `src/data` (moves, passives, statuses,
equipment, classes, relics, heroes, Evolution paths). Seven collided and were renamed; the rule
going forward is **a spawn never shares a name or a root with a move in its own slate or with a
hero of its type**, since the two will stand on one field.

**Art** (the second half of what makes them legible). Heroes stay 48px pixel art; spawn are
**geometric SVG**, generated per line from one `(tier, pose)` function — flat fills in three
tones of the type hue from `typeColors.ts`, primitives only. The two styles are meant to be
*obviously* different. Rules the gallery was authored to, and that the port must keep:

- **The Titan's eye is the family tell** — `TitanWakeScreen`'s eye, gold burning to the mythic
  red with a vertical slit and horizontal lids, the one feature on every body that is not
  type-coloured. **One eye at Early, two from Mid.** A Late's two are *wrong-placed or
  wrong-sized* (on the wings, low in the torso, one deeper than the other, too small for the
  mass) and idle half-lidded with a faint permanent halo (`stare`). "Many eyes" on the Late was
  tried and **rejected** — it swallowed the silhouette; two with creep does the job.
- **The element is a feature, then a tool, then the body.** Early carries one token of it; Mid
  fights with it; Late is an armature for it, and **breaks the hero frame** (taller, longer or
  wider than a 48px cell — geometry makes that free).
- **Every Early ends in -ling**, and the suffix drops at Mid.
- **Poses are two layers**: a global transform (attack leans and lunges; hurt recoils, squashes,
  narrows the eyes and draws impact ticks on the struck side) plus a per-line accent (a crown
  that flares, a tail that re-curves, limbs that stretch). A pose is a STATE, as it is for hero
  frames (`heroArt.ts`); nothing here changes the figure system's timing model.
- **Faces right.** Enemies mirror, as sprites do.

## 3. Locations partition the types

The mob layer is a **hard filter** on the Location's types; the hero-pool `affinity` stays a
**weighting** (`locations.md` §2's reasoning is untouched — the hero layer is where a whole act
of the same answer would be a wall). The Location becomes a counter-pick decision — *bring Water
to the Foundry* — which is what gives the 1-of-2 location choice (`locations.md` §5.1, "the
headline gap") stakes it has never had.

| Location | Spawn types | Champion (mortal half) | What moved |
|---|---|---|---|
| Wild's Edge | **any** Early | Goblin Lord — Beast | Act 1 rolls from all fourteen |
| Molten Foundry | Fire / Mech / Iron | Lava Beast — Fire | unchanged |
| Forbidden Forest | Nature / **Beast** / Light | Elder Bough — Nature | Stone out, Beast in (Beast had no home) |
| Blighted Shrine | Shadow / Arcane / Mind | Yugzulach — Shadow | unchanged |
| Storm Coast | Storm / Water / **Stone** | Leviathan — Water | Iron out (it was the Raiders'; the location is the place now, not the people) |
| Necropolis | Spirit / Frost | Skeleton King — Spirit | **two types**, by decision — the partition stays pure and the Necropolis gets a narrower shape |
| The Threshold | none | Endbringer — Ancient | no mob nodes |

Fourteen types into five three-seat locations is fifteen seats, one short; the user chose a
two-type Necropolis over sharing Shadow with the Shrine. If the sim keeps calling the Necropolis
the run's wall, "the deep location" is now an authorable identity (Late spawn a step early)
rather than a global dial — that is `locations.md` §6's "does a location modify difficulty"
answered per-location, and it is **not** decided here.

**What stays authored.** The six Guardians and their champions (`CHAMPION_IDS`, the finale's
unsealed forms, the Endbringer) are untouched. **A Guardian's escorts become two spawn of its
Location's types**; the champion still enters last from the bench. Note that every champion's
mortal half sits *inside* its own triple, so the Location's answer is the Guardian's answer in
all five cases — with the mob layer now exceptionless by design, the Guardian is the only place an
exception can live, and today none does. Either the kit carries it (the Lava Beast burning
itself) or one Guardian is moved off its triple on purpose. Open question, §10.

## 4. The map

**Monsters bookend the act; heroes fill the middle.** The forced opener (row 0) and the Guardian
draw spawn; the rows between draw the hero pool.

- **The opener** stays on the monster track. Act 1's rolls **two Early spawn** from all fourteen
  types — "very weak and pretty much an automatic win", the on-ramp. Later acts draw the
  Location's types at the act's tier.
- **The fork** (row 4) becomes **Elite-or-Skirmish** — both hero pool, both recruitable — and
  each option **previews the enemy typing on its tile**. The Elite keeps its risk/reward axis
  (harder, rarity one tier ahead, `rarityWeightsFor`); the preview adds the tactical one, and it
  is what makes bring-6-pick-4 a map-level decision. **The generator guarantees the two options
  differ in at least one type**, or the choice is empty. The Skirmish row (row 2) previews too,
  for consistency. The preview lives *on the tile* — a glyph pair in the space the labels
  vacated on 2026-09-08 — not in the long-press readout, for the same reason steering came off
  that row: a rule held in the head does not survive the map being a scene.
- **`battle` (leader + 3 basics) loses its seat** on the fork. Whether the opener from Act 2
  takes that shape (a Mid among Earlies) or every opener is four scaled Earlies is **open**, §10.
  The node type ids are unchanged either way; what changes is what `fight`/`battle` draw.
- **Enemy tier is a readable difficulty gauge**: an Early in Act 3 is a breather, a Late is not,
  and the silhouette says which before the fight is entered.

The two difficulty tracks (`ScalingTrack`) survive unchanged; `FactionRoster.baselineAct` goes
with the factions, and the monster track's baseline is the track default again.

**Claim supply goes up by one per act** (the fork's second option is now recruitable). The roster
cap still prices the free route; the Guild Hall's 50g hire was balanced against contract
*scarcity* as well as finished-vs-raw, and phase 6's sim pass measures whether it tilted.

## 5. The companion

The Fire Emblem **trainee** (a tier-0 unit with an extra promotion, weak early, above the cast
with investment) fused with **death fodder** from competitive doubles. The cute is the price.

**The beat.** In the scripted first fight, one of the two Early spawn the player beats **asks
to join**. One per run; whether a replacement can ever appear after a death is **open**, §10.

**It is a hero in every respect but one.** It takes one of the six roster slots, levels
roster-wide like anyone, takes Mastery Scrolls, evolves on the ladder, holds items, restores HP
and mana between nodes like anyone. **The only new rule: a knockout removes it from the run.**
Not "stays KO'd" — gone. After the fight, before anything else in the post-fight chain (ahead of
the level-up report, so the report never lists a hero that is already gone), a brief screen shows
it **absorbed back into the Titan**, using the Eyes as the motif (`TitanWakeScreen`'s, the same
throughline the title carries). The fight's consequence, then its growth.

- **The roster slot is load-bearing.** A free seventh body with permadeath is always fielded as a
  sacrifice and there is no decision. In a slot, Act 1's roster is three, every contract presses
  on the cap, and terminating the mascot for a contract hero is the cap rule doing its job with
  feelings attached. The sacrifice play *frees the slot*, so the tempo dividend has two parts.
- **The ladder is reused wholesale.** Its Scroll pool is **its type's slate** (the same one enemy
  spawn read); `EVOLUTION_RUNG` raises a **tier-step** (Early → Mid, then Mid → Late on the
  ladder's second threshold) in place of a branch — no `EvolutionScreen`, no graft; and every
  other rung is an ordinary move offer, so nothing gets a screen for a bare number. Rank
  thresholds, prices and income are untouched. Exactly where the second tier-step sits on the
  rung ladder is a phase-4 figure (§10).
- **The Late must be strictly better than a hero, not merely viable.** Rung 6 is 20 Scrolls of
  ~150; if the payoff for that plus mortality is a 550 mono with no branches, nobody invests and
  the companion degenerates into pure fodder. **≥ 600 and a strong pool** (§2) is the trainee's
  payoff: above the cast. This is the number the whole idea hangs on, and it is authored, not
  derived.
- **Sacrifice is priced by rules that already exist.** A KO'd companion counts toward the
  lock-in rule (2+ KO'd disables voluntary switching), so the tempo play costs switching freedom
  for the rest of the same fight. No new rule.
- **Equipment on a dead companion — open (§10).** Recommendation: strip to bag, as termination
  does. If death *loses* the item, equipping the companion is never correct, which quietly guts
  "an actual viable unit"; the unit is the price, the item is not.
- **The Guild Hall comparison answers itself**: a hire is 50g for a raw hero that cannot die;
  the companion is free, can end above the cast, and can be lost. Different axes, priced by the
  mortality.
- **The scripted Act 1 is re-authored around this** (two Early spawn, the join beat, Valor saying
  it is mortal *before* the player finds out). The tutorial rewrite is **deferred** until the
  game's systems are complete, per user direction; phase 4 leaves the script functional, not
  final.

## 6. The Pact Clock comes off the bench

**Decided (user direction).** From `startRound` the Clock takes its fraction of max HP from
**active combatants only**. It reverses the 2026-09-01 invariant ("both sides, active and
benched") and `lore.md` §3's table row *"hits the bench: the pact comes due on everyone who
showed up, not everyone who swung"* — that row is deleted and the fiction gets a cleaner line
out of it: **the bench is out of the leak.**

Why it still terminates: a side can rotate to spread the damage across four bodies, but every
switch-in eats at least one boundary tick, and the escalation (10 → 15 → 20 …) makes any active
hero lethal within a few rounds regardless. Stalls end later, not never; "the side that is ahead
still wins" holds. The immediate reason is the companion — a benched mortal dying to the Clock
was the one death that is not a decision, and the one most likely to read as a cheat — but the
rule is general, not a companion exception; the Clock has no exceptions and keeps none. Phase 5
re-measures stall length; round 30 was always a placeholder for a measurement.

## 7. What is deleted

- **Every faction's basics and leader** — Goblin Grunt/Skulker/Spooky/Warrior/Torch + Chief;
  Cult Blade/Dread/Blighted/Frozen + Mystic; Pixie/Fae Warrior/Light Fairy/Mecha Fairy + Pixie
  Queen; Flame Sprite/Steam Spirit/Ember Lizard/Automaton/Vulcadozer; Skull Shambler/Skeleton
  Knight/Shambling Husk/Bone Conjurer/Dread Raven; Raider/Storm/Surf/Mystic/Champion Raider.
  Their PNGs and pose frames under `art/enemies/*` go with them (the champion and Endbringer
  files stay). `FactionRoster`, `factions`, `DEFAULT_FACTION_ID`, `LocationDefinition.factionId`
  and `.faction` are deleted; `generateLeaderEncounter` goes or is repurposed by §10's opener
  decision.
- **`docs/locations.md` §3 "The faction bill" and §5.2** describe content that no longer exists;
  phase 2 rewrites them. `lore.md` §2's "six warden-peoples decayed into" becomes the six
  *Guardians* decayed into — cheaper than it sounds, and the replacement (the leak) is stronger.
- The Monsters/Skirmish **vocabulary** survives (`run-loop.md`'s two-word set); only what the
  Monsters word points at changes.

## 8. What this does NOT touch

The damage formula, the stat pipeline, the 550 and 28-point hero budgets, the Scroll ladder's
thresholds and prices, the Crucible and Classes, Banners, Boons, the Tutor, the Mentor, item
slots and rarity, the roster cap, the lock-in rule, HP/mana restore between nodes, node type
ids, the map shape, the five-acts-then-finale structure, the finale encounter, the Guardians and
champions. The type chart is untouched. No engine vocabulary is added: a spawn is a
`HeroDefinition`-shaped enemy with an authored tier, and the companion is a `RosterEntry` with a
mortality flag the post-fight chain reads.

## 9. Order of work

Each phase leaves the game playable. Dependencies drive the order; 3 and 5 are independent.

| # | Phase | Status | Notes |
|---|---|---|---|
| 0 | This doc; `CLAUDE.md` pointer; gallery into `docs/art/` | **Done 2026-09-13** | |
| 1 | Content + renderer: `src/data/titanspawn.ts` (14 × 3: stats, tier, kit band, growth grades for the companion), `TitanspawnGlyph` ported from the gallery script into the figure system beside `heroPoses` | Pending | Nothing else is visible without it. The port keeps the generator's rules (§2) verbatim. |
| 2 | Mob layer: `fight`/`battle` draw spawn by the Location's types and the act's tier; Guardian escorts become spawn; §7's deletions; `LocationDefinition.spawnTypes` replaces `factionId`; `locations.md` §3/§5.2 and `lore.md` §2 rewritten | Pending | The big deletion. Needs §10's opener decision. |
| 3 | The fork: Elite-or-Skirmish, typing preview on the Skirmish and fork tiles, generator guarantees the two differ | Pending | Independent; small. |
| 4 | The companion: mortality flag, join beat after fight one, absorption screen first in the post-fight chain, ladder reuse with the tier-step at `EVOLUTION_RUNG`, Late ≥ 600, Act 1 script kept functional | Pending | Needs 1 and 2. Needs §10's equipment decision. |
| 5 | Pact Clock off the bench; `lore.md` §3 row deleted; sim re-measures stall length | Pending | Independent; one engine file plus the doc. |
| 6 | Difficulty re-fit and a sim pass: is Act 1's opener the auto-win; claim supply on the fork; the companion's trade ratio by run half; whether the Guild Hall tilted | Pending | After everything. |
| — | Tutorial rewrite | **Deferred** | Until systems are complete, per user. |

Verify each phase as the repo does: `npm test`, `npm run typecheck`, `npm run typecheck:view`.

## 10. Open questions — DO NOT silently resolve

- **Equipment on a dead companion**: strip to bag (recommended, §5) or lost with it. Changes
  phase 4's code.
- **The opener's shape from Act 2**: `battle`'s leader-plus-basics kept as a Mid among Earlies,
  or four Earlies scaled by act. Changes phase 2's generator.
- **Where the companion's second tier-step sits** on the rung ladder (the first is the
  `EVOLUTION_RUNG`; the second has no existing threshold to borrow).
- **A replacement companion after a death** — never, or possible. One at a time is decided;
  replacement is not.
- **Early and Mid stat totals**, and the per-tier kit size (2 / 3 / 4 moves is the obvious
  read of the ladder; not decided).
- **Which Earlies can be the companion** — all fourteen authored to one cuteness bar, or the
  join beat rolls from a subset (Rivetling and Runeling are the hard sells).
- **The Guardian exception** — every champion sits inside its Location's triple (§3); whether
  one is moved off it on purpose.
- **The Necropolis as "the deep location"** — Late spawn a step early if the sim keeps calling
  it the wall (§3).
- **Whether `art/enemies/*` faction PNGs are deleted or archived.** They are finished art; the
  cheap answer is a folder move, not a delete.

## 11. Locked invariants this overturns

| `CLAUDE.md` today | After this |
|---|---|
| Locations author a **faction** that `fight`/`battle` draw from; the Guardian's escorts are its basics | Locations name **spawn types**; `fight`/`battle` and the escorts draw Titanspawn |
| Encounters scale on two tracks with **Monsters baselined at Act 2** via `FactionRoster.baselineAct` | Two tracks kept; the baseline is the track default, there is no per-roster override |
| **The Pact Clock hits both sides, active and benched** | Active only; the bench is out of the leak |
| The fork is **Elite or Battle** (one recruitable, one not), tiles carry no labels | **Elite or Skirmish**, both recruitable, both previewing enemy typing on the tile |
| Nothing on the roster is lost except by **termination** | A KO'd companion is **gone from the run** |
| Every roster hero's stats sum to **550** and its grades to **28** | Both stay *hero* rules; the companion's tiers are authored outside them, Late ≥ 600 |
| "Ancient" is reserved; the six peoples are what the wardens **decayed into** | Unchanged for Ancient; the six *Guardians* are what the wardens decayed into, and the spawn are the leak |
