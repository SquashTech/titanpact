# locations.md — Acts as Places

> Module of the Titanpact `/docs` suite. Companion to `run-loop.md` (which owns the
> per-act *map shape*) and `types-and-heroes.md` (which owns the type roster). This doc
> owns the layer above the map: **which place an act happens in**, and what that changes.

A run chains four seal acts of the standard shape, then the finale act (`run-loop.md` §3-4;
`TOTAL_ACTS` = 5, `SEAL_ACTS` = 4). A **Location** is the identity an act wears: a name, the
spawn types it fields, a type affinity, a Guardian's champion, and a look
(`src/data/locations.ts`, `src/run/locations.ts`).

---

## 1. The shape

**Act 1 is always Wild's Edge.** It is the tutorial ground and the only location whose
Skirmishes draw on *every* type — the player has no team identity yet, so nothing should
be pressuring it. Its mob layer is every line's Early — the leak runs thin out here
(`spawnTypes: null`, §3).

**Acts 2-4 draw from the remaining locations without replacement.** A location is never
visited twice in one run.

**The finale act is a fixed location the draw can never produce** — The Threshold: no mob
layer, no affinity that biases anything, and no map of the `run-loop.md` §1 shape. It is where
the binding was made (`run-loop.md` §4).

**Locations go unvisited every run**, and that is load-bearing rather than leftover: since the
run went to four acts, two of the base five seal locations stay shut, and the unbroken seals are
why there is a world left at all (`lore.md` §5). They are also the natural anchor for
`progression.md`'s light meta-progression — the thread between runs.

### Choice, not a roll (decided 2026-08-28, per user direction)

The alternatives considered were a fully random location per act, or a "named location
vs. reroll for a random one" offer. Both were rejected for the same reason: the reroll has
no upside a player can reason about, so the interesting case — weighing two real futures —
never happens.

Instead, **each act offers 2 named locations and the player picks one.** With Wild's Edge
locked to Act 1 and five other base locations, Act 2 picks 1 of 2 drawn from 5, Act 3 from the
remaining 4, Act 4 from 3 — every act keeps a real choice, including the last. Bought locations
(§4) join the pool and only widen it.

What that buys over a roll is a **sequencing** decision layered on top of the pick. The
player is not choosing *whether* to visit Necropolis so much as *when* — "take it now
while I still have Fire coverage." The choice is never removed, it is priced — the texture the
reward-row steering carried until it was reverted on 2026-09-08 (`run-loop.md` §1).

It also puts the location decision on the same footing as everything else in the run. The
map is fully visible and priceable from the start of an act; a random location would be
the only major strategic axis decided by luck the player cannot see coming.

**As built:** `RunState.locationIds` is a **history** — where the run has been and where it
stands, never a plan. Every seal act after the first opens on `LocationChoiceScreen` (§4),
between the Pact Seal and the arrival screen; `drawLocationCandidates` draws
`LOCATION_CHOICE_COUNT` = 2 flat (never weighted) from `unvisitedLocationIds`, `chooseLocation`
seats the pick, and `advanceToNextAct` seats the Threshold itself. `generateItinerary` survives
for fixtures and dev routes. The sim takes the offer at random and reports a **location lift**
table (which PLACE is the wall, matched against the one it could have gone to).

## 2. Weighting, not filtering

A location carries an `affinity: readonly TypeId[] | null` — the types its Skirmishes and
Elites lean on. `null` means "every type", and Wild's Edge is the only seal location that holds
it.

**Affinity biases the encounter pool; it does not filter it.** An encounter fills all but
one of its slots from heroes matching the location's affinity, then fills the remaining
slot from the whole pool (`src/run/enemyGen.ts` `PoolBias`, supplied by
`src/run/locations.ts` `locationBias`).

| Location | Affinity |
|---|---|
| Wild's Edge | *all* |
| Blighted Shrine | Shadow / Arcane / Mind |
| Forbidden Forest | Nature / Beast / Light |
| Molten Foundry | Fire / Mech / Iron |
| Storm Coast | Storm / Water / Stone |
| Necropolis | Spirit / Frost / Shadow |

A hard filter was rejected on measurement: on the 32-hero roster of the time, Necropolis's
originally proposed Spirit/Frost pair matched **exactly 4 heroes** — it would have fielded the
identical four every time. Shadow stays in Necropolis's affinity (though not its spawn types)
for that reason. Weighting is what keeps every location varied whatever the roster's shape, and
the recruitable fight's deck rule (`docs/collection.md`) now narrows the pool further.

## 3. What a location does and does not touch

| Surface | Location-aware? |
|---|---|
| `skirmish` / `elite` encounter pool | **Yes** — affinity-biased (§2). |
| `fight` / `battle` / `boss` encounter pool | **Yes** — the Location's `spawnTypes`, exactly (§3 "The mob layer"), the Guardian's escorts included; affinity never applies here, because the spawn types *are* the filter. |
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
options rather than removing them. That half is **not built** (§5.4).

### `exclusiveHeroIds`

Each location carries a list of hero ids obtainable only while that location is current.
The field exists and is threaded through; **it is empty on every location, and nothing reads
it** (§5.4).

### The mob layer — Titanspawn (2026-09-13, replacing the factions)

The six factions were deleted whole (`docs/titanspawn-overhaul.md` §7; sprites archived under
`art/archive/factions/`). What `fight`, `battle` and the Guardian's escorts field is
**Titanspawn** (`src/data/titanspawn.ts`): one mob line per mortal type in three tiers, and a
Location names the lines it fields through `LocationDefinition.spawnTypes` — a **hard filter**,
where `affinity` stays a weighting. The five base run Locations partition the fourteen spawning
types between them (the overhaul doc's §3 has the table and why the Necropolis holds two).

The Location still decides who you fight; the mob layer is still the easy track by
construction (Early 200, Mid 400, Late 600 combat-stat totals, `SPAWN_COMBAT_TOTAL`, and every
spawn levelled to its node — `docs/enemy-levels.md`); and a Location is counterable as a unit,
exactly so, because a spawn has no second type and no exception. A spawn's kit is its type's
authored moves read at its tier's band, so a Necropolis still Haunts and a Foundry still Burns.
The one thing a faction could do that a spawn cannot — put an exception inside the roster — is
the Guardian's alone: **the mob layer is the type chart made flesh, and the Guardian is where
the chart lies.**

The composition by act lives in `src/run/spawn.ts` and is pinned by `test/mobLayer.test.ts`:
Act 1's opener is two bare Earlies from every line; from Act 2 the opener is a leader at the
act's tier (`SPAWN_TIER_BY_ACT`, floored at Mid) over escorts whose tiers are the act's
(`OPENER_ESCORT_TIERS_BY_ACT` — the Earlies phased out escort by escort; `run-loop.md`
"Titanspawn" has the measurement), each carrying an item rolled on the act's drop curve; the
`battle` node is that shape in every act; the Guardian's escorts are spawn at the act's tier,
`GUARDIAN_ESCORTS_BY_ACT` of them. A two-line Location repeats a body rather than coming up short.

### `guardianFinalEnemyId` — the champion

One enemy id per location, appended to that location's Guardian fight behind its escorts
(`appendFinalEnemy`; `run-loop.md` "The Guardian's champion" for the mechanism). Every location
has one: Wild's Edge's **Manticore** (Beast/Ancient), the Blighted Shrine's **Yugzulach**
(Shadow/Ancient), the Storm Coast's **Kraken** (Water/Ancient), the Forbidden Forest's **Elder
Bough** (Nature/Ancient), the Molten Foundry's **Dragon** (Fire/Ancient), the Necropolis's
**Skeleton King** (Spirit/Ancient), and the bought locations' **Seraph**, **Sphinx**, **Roc** and
**Wendigo** (§4). The Threshold's is the Endbringer, which is what the finale's bench ends on.

All are **Ancient-second**: Ancient's attacker row is empty and every other row resists it, so a
champion is a type-chart *wall* — nothing on the board is super-effective against one. Each
champion's mortal type is one of its location's spawn types, so the answer that beat the mob
layer is still the right colour at the boss; the Ancient half is what blunts it.

It is a **location** property rather than a node one: hanging it off the node would have made
it a property of *how hard this fight is*, which `run-loop.md` §2's node kinds and the enemy
level curve already say. This says *whose ground you are standing on*, and belongs beside
`spawnTypes` and `affinity`.

## 4. The arrival screen

`src/view/run/ActIntroScreen.tsx` — shown once per act, before the map: after the draft
for Act 1, and after the location choice for each seal act after it. It is the **per-act beat**,
not an Act-1-only title card.

It stands on the shared node stage (`visual-language.md` ninth pass) with a **`LocationSky`**,
because the whole point of this screen is that Necropolis must not look like Molten Foundry.
Each location supplies three things the sky reads:

1. **`tintRgb`** — drives `--node-rgb`, which the stage routes through the wash, the header
   bloom and the particles.
2. **`horizon`** — an authored SVG silhouette band along the bottom edge
   (`src/view/shared/locationArt.tsx`), on the same `currentColor`-only discipline as the
   other vector families. Colour alone reads as a *mood*, a silhouette reads as a *place*.
   Where a painted backdrop exists (below) the band is the fallback.
3. **`ambience`** — how the particle field behaves: `fireflies`, `embers`, `snow`, `rain`,
   `spores`, `sigils`, and the bought locations' `radiance`, `drift`, `lightning` and
   `blizzard`, differing in direction, speed, drift and shape. One shared keyframe for all of
   them was tried and abandoned — motion is half of what separates a forest from a foundry.

**Painted backdrops (2026-09-27, per user direction).** Every location has three, picked up by
glob in `src/view/shared/locationBackdrops.ts`, generated with PixelLab:

- **Arrival** — `art/locations/<locationId>.png`, 196x344 (2x on the 394-wide canvas). It
  replaces the horizon band (the painting has its own ground) and keeps the ambience; the wash
  becomes a scrim, dark behind the name and at the foot, with a low glow of `tintRgb`.
- **Map** — `art/locations/map/<locationId>.png`, because the arrival painting is composed
  around a centre landmark and the centre is where the medallions sit. A map backdrop is
  AMBIENT, not a scene (redone after playtest found the first set too busy): flat-shaded
  Pixflux, three silhouette layers low in the bottom third, a plain banded sky, the light low on
  the horizon, no sun or moon disc behind the medallions, a handful of colours. It is dimmed,
  scrimmed at the header and the roster tray, and the medallions, origin mark and placard get
  an opaque ground and a dark edge. **It is also every in-act screen's ground**: NodeSky
  (`is-painted`) and the contract claim's StageSky stand on it, dimmed further, with the node's
  own wash laid over it translucent so a gold cache or a violet boon still reads as one.
- **Arena** — `art/locations/battle/<locationId>.png`, 196x228 (the arena box at 2x), composed
  as an ARENA: one open floor filling the frame that both teams stand on, a thin skyline strip
  across the top quarter, props only in the far corners, side view. It replaces the bands and
  the drawn floor fan (`has-painted-arena`), keeps the weather, and sits at z −2 — under the
  Field Effect glow and sweep (z −1). Dimmed to 0.6 and desaturated, vignetted over the corners
  and the nameplate strip: nothing in it may compete with a 48px sprite or an HP bar. Reject a
  roll with figures in it or a floor that is patterned rather than plain. The Titan's back
  draws none.

The location-choice cards still draw the vector band.

### The location choice

`src/view/run/LocationChoiceScreen.tsx` — the 1-of-2 that opens every seal act after the
first (§1), shown after the Pact Seal and before the arrival screen. Two places, stacked
(a horizon band is wide and a phone is not), each card a scene built from the same three
things the arrival screen reads — its `tintRgb` on the card's own wash, its `ambience`
at half density, its horizon band in front — plus one thing the arrival screen keeps back:
**the warden on the skyline**. `guardianFinalEnemyId` is drawn through `HeroPortrait`
(the same generated figure the fight will show) standing behind the horizon band, dim and
desaturated, its feet hidden by the silhouette so it reads as some way off. The domains sit
over the band; Wild's Edge gets the words.

The screen itself is **placeless** (`PLACELESS_SCREENS`), like the Pact Seal: gold sky,
gold header, until a card is picked — then the screen's `--node-rgb` takes that place's
tint, so the sky, the title bloom and the button all turn its colour, the warden comes
forward, the other place steps back into the dark. No line under the name on either card
(2026-09-19, per user direction): the scene is the description, and the omen waits for the
map's first node. Pick-then-confirm, the Banner's idiom: the button names the pick (*Set out
for the Necropolis*), and the arrival screen's *Enter* is the next beat. Both candidates'
tracks are prefetched while the player weighs them.

One card is no choice: `enterAct` takes a lone candidate silently and the arrival screen
says where. It only happens on a dev run that opened somewhere other than Wild's Edge.

### Bought Locations — the Holy Sanctum, Dreaming Spires, Thunder Aerie, Frozen Reach (2026-09-19)

> **Granted by the Cycles since 2026-10-06** (`docs/cycles.md` §6): `fromCycle` replaces `unlock`,
> Sanctum II / Spires III / Aerie IV / Reach III (the Long Winter’s Act 1), each in its Cycle's pool and every later one. They
> are no longer sold; what follows is the history.

Four places the Constellation sells (`docs/constellation.md` §11 phase 5 has each one's kit and
look), each with a warden of a type no base Guardian covers — the Seraph (Light), Sphinx (Mind),
Roc (Storm) and Wendigo (Frost). `LocationDefinition.unlock` names its offer, and it is in a
run's pool only while that offer is held: `locationPool(profile.purchases)` in
`src/run/locations.ts`, read once where the act's offer is drawn. A bought location is drawn
**beside** the base five, so its spawn types overlap theirs — the partition in §3 is a rule for
the base pool, which `ITINERARY_POOL_IDS` still is.

## 5. Status and known gaps

### 5.1 The 1-of-2 location choice — built (2026-09-19)

See §1 and §4 "The location choice".

### 5.2 The mob layer — built, then replaced

The faction content was retired whole on 2026-09-13 by the Titanspawn overhaul (§3,
`docs/titanspawn-overhaul.md`); nothing here is outstanding.

### 5.3 Per-location Guardians — built

Every location carries a champion (§3); the Ancient slate's moves were given to them on
2026-09-17 (`authoring-moves.md` §10 "Ancient").

### 5.4 `exclusiveHeroIds` has no consumer

The field exists and is empty on every location, and **neither consumer §3 describes is
written**:

- The Skirmish pool does not add them (`locationBias` only weights heroes already in the pool;
  it never inserts one).
- The Guild Hall does not add them either — `rollGuildHallOffers` takes the deck-built
  `guildHallOffersFor(recruitPool)` list, with no knowledge of where the run currently is.

So "some heroes are only findable in certain locations" is a schema, not a behaviour. Both
consumers are small; what they wait on is a decision about which heroes are rare, and how that
sits beside the Collection's rule that the player's deck builds the run's pools
(`docs/collection.md`).

### 5.5 The location follows the player through the act

A location is carried by the map, its name, and every screen inside an act, not announced once
and dropped. On every surface the painted backdrops (§4) now carry most of it; what follows is
the structure they sit in.

#### The map well

The same three identity channels the arrival screen uses, at a fraction of their strength
(`MapScreen`, styles.css "The map well's Location"):

- **Tint and lighting.** `--node-rgb` and `data-location` are set on `.map-screen`; each
  location's wash recipe differs in *where the light comes from*, not only in hue. The wash is
  the well's own `background` rather than a layer, so it survives a map tall enough to scroll.
- **Weather.** The same ambience keyframes, at `MAP_MOTE_DENSITY` (half the count) and half the
  opacity, through `LocationMotes` (split from `LocationSky` so it can run without a sky).
- **Horizon** (fallback when no map backdrop exists). The same band, shorter, dimmer and with
  the entrance animation off — the map is re-entered after every node. It sits at the BOTTOM of
  the well, the act's origin: the route climbs away from where you walked in, toward the
  Guardian.

#### The omen

**Added 2026-09-08, per user direction.** `LocationDefinition.omen` is one line said by the
place — "The rain never stops falling along these shores." It is shown **once per act**, on the
map screen at the act's first Monsters node, and nowhere else. That node is the only row with
nothing behind it, so the omen costs the screen nothing.

It sits **above** the sigil, which is the direction an act runs in: the place speaks, and
the fight is what answers it. It is written **on** the place rather than under it: tracked out
large, in the location's own light, over a breathing haze of that light — a small italic caption
read as UI chrome. It is the only text on the map that is neither a control nor a readout.

It is the **only line a Location speaks** (2026-09-19, per user direction: the arrival and
choice screens' `flavor` line is deleted — the visuals do the talking). Gated on the node kind
rather than on being row 0, so the finale's Vigil never gets a line naming enemies that are not
there.

#### The name

`MapScreen`'s `MapPlacard` etches the location's name and its spawn types' marks into the
well's **bottom-left corner**, unboxed (`visual-language.md`: the only rectangles are
controls) and `pointer-events: none`. It was top-left first, where the Guardian's
`tier-ancient` tile (124px, wider than its ~117px column) spilled under it on longer names;
the bottom row is the act's opener, a 92px tile that fits its column, and the placard's width
cap is sized to the free column so a long name wraps. A name at the foot of the climb reads as
a signpost at the place you walked in from.

#### Every screen inside an act

`NodeSky` (`NodeStage.tsx`) renders the location whenever `LocationContext` has one, which
reaches every node screen without any of them knowing the system exists.

The division of the screen is the design. A node screen's own `--node-rgb` is a **semantic**
tint (gold for a cache, violet for a relic, teal for the Mentor, an item's rarity colour on the
item who-screen) and it owns the wash's upper pool and the header bloom: *what kind of moment
is this*. `LocationAmbience` redefines `--node-rgb` for its own subtree only and takes the
bottom: ground, weather, horizon — *where is it happening*. The generic rising motes are
**replaced** rather than joined, since two particle fields on one screen is noise.

`LocationContext` is the first React context in the repo, because a location is ambient — true
of the whole act, read by one shared leaf component — and prop-drilling it meant every node
screen forwarding a field it never reads. The value is nullable and `App.tsx` decides: `null`
outside an act (`PLACELESS_SCREENS`) keeps the title and the sandbox tools on the plain
placeless sky. No per-location wash recipes on node screens: a node screen is passed through in
seconds and already has a tint of its own.

#### The arena

`FightScreen`'s `.battlefield` carries `data-location` and the location's `--node-rgb`, and
renders one `LocationAmbience` layer (`ArenaLocation`, memoised because the arena re-renders on
every beat):

- **Lighting recipes** per location, each keeping the two zone tints at 0.18 — "enemy up
  there, me down here" is information and the location is only mood.
- **The horizon band** (fallback under the painted arena), anchored to `.battlefield-divider`
  so the skyline stands *behind the enemy row*. It has to be tall (28% of the arena, or only
  its ground shows behind the enemy pills), its base dissolves under a `mask-image`, and it
  carries half a pixel of blur so it sits in a different focal plane from the name pills.
- **Weather at `ARENA_MOTE_DENSITY` = 0.45**, the lowest of any surface — the one screen where
  a mote can cross a damage numeral.

The console below is deliberately untouched: the scene is the place, the console the
instrument panel it is read through. An active Field Effect still owns the horizon line and its
haze — authored later in `styles.css` at equal specificity, so standing battlefield state
outranks the place it is standing in.

### 5.6 Difficulty is location-blind

A location changes *who* you fight, never how hard (§6).

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

A band has to be tall enough that half of it clears whatever button the screen ends in; one
authored at 22% of screen height showed only a stray spire above a full-width button.

On the map, anything that must overhang the well's padding, or stay put while the route
scrolls, belongs on the `.map-well` frame, not inside the `.map-scroll` scroller: a
negatively-inset child of a scroll container does not overhang, it becomes scrollable overflow.

Every presentation surface has **no automated coverage**; each was verified by screenshot, the
standard method for this repo (`visual-language.md`). The data and selection layers are tested
(`test/locations.test.ts`).

## 6. Open questions — do not silently resolve

- **Does a location modify difficulty?** It changes *who* you fight, never how hard. The enemy
  curve is per node and per act (`docs/enemy-levels.md`, `ACT_LEVEL_ADJUST`); whether a
  location carries its own difficulty weight — a "deep" location worth more gold — is a
  separate question. The sim's location-lift table is where to look first.
- **Should Wild's Edge always be first?** It is locked that way here on tutorial grounds. A
  later meta-progression unlock ("start in a different region") is the obvious pressure on
  that rule, and `progression.md`'s light-meta-progression decision is where it would live.
- **Location-specific Field Effects.** A Necropolis where a Frost field is pre-applied, or
  a Foundry that re-lights itself, is the natural marriage of this system and
  `field-effects.md`. Deliberately not attempted.
- **Music for the bought locations and the Threshold.** `music/` holds a track for Wild's Edge
  and the five base locations only.
