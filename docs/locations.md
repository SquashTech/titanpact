# locations.md — Acts as Places

> Module of the Titanpact `/docs` suite. Companion to `run-loop.md` (which owns the
> per-act *map shape*) and `types-and-heroes.md` (which owns the type roster). This doc
> owns the layer above the map: **which place an act happens in**, and what that changes.

A run chains `TOTAL_ACTS = 5` acts (`run-loop.md` §3). Until now every act was the same
act — same generated map shape, same encounter pools, same Goblins, differing only in
seed. A **Location** is the identity an act wears: a name, a faction, a type affinity, a
set of heroes findable nowhere else, and a look.

---

## 1. The shape

**Act 1 is always Wild's Edge.** It is the tutorial ground and the only location whose
Skirmishes draw on *every* type — the player has no team identity yet, so nothing should
be pressuring it. Its faction is the Goblins, which is also the enemy content that
already exists (`src/data/enemies.ts`).

**Acts 2-5 draw from the remaining locations without replacement.** A location is never
visited twice in one run.

### Choice, not a roll (decided 2026-08-28, per user direction)

The alternatives considered were a fully random location per act, or a "named location
vs. reroll for a random one" offer. Both were rejected for the same reason: the reroll has
no upside a player can reason about, so the interesting case — weighing two real futures —
never happens.

Instead, **each act offers 2 named locations and the player picks one.** With Wild's Edge
locked to Act 1 and five other locations authored, the arithmetic closes exactly: Act 2
picks 1 of 2 drawn from 5, Act 3 from the remaining 4, Act 4 from 3, and Act 5 has exactly
2 left — every act keeps a real choice, including the last.

What that buys over a roll is a **sequencing** decision layered on top of the pick. The
player is not choosing *whether* to visit Necropolis so much as *when* — "take it now
while I still have Fire coverage, because I will have to eat it eventually." That is the
same texture as the reward-row steering locked on 2026-08-26 (`run-loop.md` §1): the
choice is never removed, it is priced.

It also puts the location decision on the same footing as everything else in the run. The
map is fully visible and priceable from the start of an act; a random location would be
the only major strategic axis decided by luck the player cannot see coming.

> **Implemented so far:** the itinerary (Act 1 fixed, acts 2-5 drawn without replacement)
> and the per-act arrival screen. The **1-of-2 choice UI is not built yet** — the
> itinerary is currently drawn *for* the player rather than chosen *by* them. Scoped in
> §5.1.

## 2. Weighting, not filtering

A location carries an `affinity: readonly TypeId[] | null` — the types its Skirmishes and
Elites lean on. `null` means "every type", and Wild's Edge is the only location that holds
it.

**Affinity biases the encounter pool; it does not filter it.** An encounter fills all but
one of its slots from heroes matching the location's affinity, then fills the remaining
slot from the whole pool (`src/run/enemyGen.ts` `PoolBias`, supplied by
`src/run/locations.ts` `locationBias`).

This is not a stylistic preference — a hard filter breaks on the current roster. Measured
against `src/data/heroes.ts`'s 32 heroes:

| Location | Affinity | Heroes matching |
|---|---|---|
| Wild's Edge | *all* | 32 |
| Storm Coast | Storm / Iron / Water | 10 |
| Blighted Shrines | Shadow / Arcane / Mind | 8 |
| Molten Foundry | Fire / Mech / Iron | 8 |
| Necropolis | Spirit / Frost / Shadow | 8 |
| Forbidden Forest | Nature / Stone / Light | 7 |

A Skirmish fields 4. Under a hard filter, Necropolis on its originally proposed
Spirit/Frost pair matched **exactly 4 heroes** — it would have fielded the identical four
every single time, and its Elite and Ancient would have drawn from that same closed set.
Shadow was added as a third Necropolis type to open it up, at the cost of overlapping
Blighted Shrines. Weighting rather than filtering is what keeps every location varied
without blocking the feature on authoring twenty more heroes.

The one type no location claims is **Beast**, which lives at Wild's Edge with the
Goblins. That is an accident of the example set and a good one — Wild's Edge is the
wilderness.

## 3. What a location does and does not touch

| Surface | Location-aware? |
|---|---|
| `skirmish` / `elite` / `boss` encounter pool | **Yes** — affinity-biased (§2). |
| `fight` / `battle` encounter pool | Not yet — see "The faction bill" below. |
| Recruit Contract offers | **Yes, transitively** — contracts are claimed off beaten Skirmish heroes, so biasing Skirmishes is what makes a hero "findable here". |
| Guild Hall recruit pool | **No, deliberately** — see below. |
| Map shape, node types, rewards | No. `run-loop.md` §1 is unchanged. |
| Combat resolution | No. Nothing here crosses the engine/presentation boundary or touches the damage pipeline. |

**The Guild Hall stays unfiltered on purpose.** Biasing Skirmishes narrows what a player
can *claim* that act — that is the rare-hero mechanic working as intended. But it can also
mean "I need a Fire hero and this act structurally cannot give me one." The Guild Hall is
the pressure valve: it offers from the whole pool, so the pressure a location applies stays
on the combat side, where it is legible.

The *intent* is that it also offers the location's exclusives on top, so a location **adds**
options rather than removing them. That half is **not built** — `rollGuildHallOffers` has no
idea where the run is. See §5.4.

### `exclusiveHeroIds`

Each location carries a list of hero ids obtainable only while that location is current.
The field exists and is threaded through; **it is empty on every location today, and nothing
reads it** (§5.4). Which heroes are rare and where they live is authoring work for when the
real roster lands (`run-loop.md` §4, README "Next steps" #5) — the schema is here so that
work is data entry rather than plumbing.

### The faction bill

`enemies.ts` holds 5 basic Goblins plus a Chief. `fight` and `battle` are the two node
types that read as *faction*; `skirmish` reads as *region*. So until Cultist, Fae,
Automaton, Raider and Undead rosters are authored — roughly 30 enemy definitions —
**acts 2-5 name their faction on the arrival screen while still fielding Goblins.**

This is a known and accepted intermediate state, not an oversight. The affinity layer (§2)
costs zero new content and works today; faction rosters can land one at a time, each one
flipping `LocationDefinition.factionEnemyIds` off the Goblin default. Scoped in §5.2.

The upside buried in it: `run-loop.md` §4 still lists "a real Ancient boss hero" as
unbuilt, and locations supply the reason to author six of them rather than one. Each
location's Ancient is its faction's apex. That is a far better authoring prompt than
"make an Ancient."

## 4. The arrival screen

`src/view/run/ActIntroScreen.tsx` — shown once per act, before the map: after the draft
for Act 1, and after `advanceToNextAct` for acts 2-5. It is the **per-act beat**, not an
Act-1-only title card.

It stands on the shared node stage (`visual-language.md` ninth pass — a place, a voice,
and nothing drawn around either) but replaces `NodeSky` with a **`LocationSky`**, because
the whole point of this screen is that Necropolis must not look like Molten Foundry. Each
location supplies three things the sky reads:

1. **`tintRgb`** — drives `--node-rgb`, which the existing stage already routes through
   the wash, the header bloom and the particles. One property, everything downstream.
2. **`horizon`** — an authored SVG silhouette band along the bottom edge
   (`src/view/shared/locationArt.tsx`), on the same `currentColor`-only discipline as the
   other vector families (`elementIcons.tsx`, `nodeIcons.tsx`). A treeline and palisade
   for Wild's Edge, smokestacks for the Foundry, tombstones and a mausoleum spire for the
   Necropolis. This is the element doing the most work — colour alone reads as a *mood*, a
   silhouette reads as a *place*.
3. **`ambience`** — how the particle field behaves. Six kinds, differing in direction,
   speed, drift and shape: `fireflies` rise and wander, `embers` rise fast and hot, `snow`
   falls and sways, `rain` falls fast on a slant, `spores` drift up slowly and wide,
   `sigils` fall while pulsing. Reusing the one existing `title-ember-rise` keyframe for
   all six was tried and abandoned — motion is half of what separates a forest from a
   foundry.

No art assets are involved. Everything is vector + CSS, so a location costs a paragraph of
data and a path, not a commissioned background.

## 5. What is not built yet

Everything below is a known gap, not an oversight. Roughly in the order that
would make the system worth the ceremony it already has.

### 5.1 The 1-of-2 location choice — the headline gap

§1 decided that **each act offers 2 named locations and the player picks one**.
That is the whole reason this system beats a random roll, and it is the one part
not written. Today `generateItinerary` draws all five up front and the player is
simply told where they are.

What it needs, and no more than this:

- A `Screen` variant (`{ kind: 'locationChoice' }`) shown *before* `actIntro` on
  every act after the first.
- `RunState.locationIds` stops being a pre-drawn itinerary and becomes a
  **history** of what has been visited, so the candidate draw excludes it. The
  without-replacement bookkeeping already lives in `src/run/locations.ts`; it
  moves from "draw all" to "draw 2 from what is left".
- `locationForAct` keeps working unchanged — it already reads a list by index.

Until it lands, acts 2-5 are effectively random-without-replacement, which is
explicitly **not** the decided design. Do not read the current behaviour as a
decision.

### 5.2 Faction enemy content — the largest chunk of actual work

`LocationDefinition.factionEnemyIds` is `null` on all six locations and **nothing
reads it yet**. `App.tsx`'s `handleSelectNode` still hardcodes `basicGoblins` for
`fight` and `generateGoblinChiefEncounter` for `battle`, so every act fields
Goblins while the arrival screen names Cultists, Fae, Automatons, Raiders or
Undead.

Roughly 5 basic + 1 leader per faction, ~30 `HeroDefinition`s in the shape
`enemies.ts` already uses (a Goblin does not need a different schema, it needs
different numbers — `run-loop.md` §3). Each faction that lands flips one field
here and one branch in `handleSelectNode`; they can arrive one at a time.

### 5.3 Per-location Ancients

`run-loop.md` §4 still lists "a real Ancient boss hero" as unbuilt — the boss is
two fixture heroes with a bigger stat bonus. Locations are the reason to author
six of them instead of one: each location's Ancient is its faction's apex. Blocked
behind 5.2 in practice, since an Ancient without its faction reads as unrelated.

### 5.4 `exclusiveHeroIds` has no consumer

The field exists and is empty on every location, and **neither of the two
consumers §3 describes is written**:

- The Skirmish pool does not add them (`locationBias` only weights heroes
  already in the pool; it never inserts one).
- The Guild Hall does not add them either — `rollGuildHallOffers` takes the flat
  `guildHallOffers` list built from `HeroDefinition.starter`, with no knowledge of
  where the run currently is.

So the "some heroes are only findable in certain locations" mechanic is currently
a schema, not a behaviour. Both consumers are small; what they are waiting on is
a real roster to declare rare in the first place.

### 5.5 The location vanishes after the arrival screen

It is announced once and then invisible for the rest of the act. `MapScreen`'s
footer reads `ACT 1/5` and never the place's name; squad-select, the Guild Hall
and every reward screen have no idea where they are. If a location is supposed to
be pressuring the player's choices all act, the map is the surface that should be
carrying its name and tint, not just the screen they already dismissed.

### 5.6 Difficulty is location-blind

A location changes *who* you fight, never how hard. That is deliberate for this
pass, but it interacts with the still-open per-act scaling question — see §6.

### 5.7 Constraints for anyone authoring a new location

Two that are easy to violate and only visible on device:

- **Nothing below y≈78 of the 400x110 horizon viewBox will be seen.** The band is
  anchored to the bottom of the screen and the Enter button covers its lowest
  quarter. Waterlines, ground detail and hull shapes drawn at the authored
  "ground" line are drawn under a button.
- **Nothing may span the full width at y=0.** The band's rim light
  (`drop-shadow(0 -1px 0 …)`) turns any shape touching the top edge into a hard
  horizontal line across the whole screen. This is what killed the Forbidden
  Forest's original canopy; its trunks now run past y=0 and are clipped flat by
  the SVG viewport instead.

The arrival screen has **no automated coverage** — it was verified by screenshot
across all six locations, which is the standard method for this repo
(`visual-language.md`). The data and selection layers are tested
(`test/locations.test.ts`).

## 6. Open questions — do not silently resolve

- **Does a location modify difficulty?** Right now it changes *who* you fight, never how
  hard. Per-act difficulty scaling is already an open question (`run-loop.md` §3); if it
  lands, whether locations carry their own difficulty weight — a "deep" location worth
  more gold — is a second question, not the same one.
- **Should Wild's Edge always be first?** It is locked that way here on tutorial grounds. A
  later meta-progression unlock ("start in a different region") is the obvious pressure on
  that rule, and `progression.md`'s light-meta-progression decision is where it would live.
- **Location-specific Field Effects.** A Necropolis where a Frost field is pre-applied, or
  a Foundry that re-lights itself, is the natural marriage of this system and
  `field-effects.md`. Deliberately not attempted — Field Effects has exactly one authored
  effect today, and the second one should not be a location's ambient passive.
