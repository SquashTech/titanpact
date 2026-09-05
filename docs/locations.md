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
| Blighted Shrine | Shadow / Arcane / Mind | 8 |
| Molten Foundry | Fire / Mech / Iron | 8 |
| Necropolis | Spirit / Frost / Shadow | 8 |
| Forbidden Forest | Nature / Stone / Light | 7 |

A Skirmish fields 4. Under a hard filter, Necropolis on its originally proposed
Spirit/Frost pair matched **exactly 4 heroes** — it would have fielded the identical four
every single time, and its Elite and Guardian would have drawn from that same closed set.
Shadow was added as a third Necropolis type to open it up, at the cost of overlapping
Blighted Shrine. Weighting rather than filtering is what keeps every location varied
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

`enemies.ts` groups its content by **faction** (`FactionRoster`: a `baselineAct`, a list of
`basicIds`, and one `leaderId`), and a Location names the one it fields through
`LocationDefinition.factionId`. `fight` and `battle` are the two node types that read as
*faction*; `skirmish` reads as *region*.

**The bill is paid (2026-09-05).** All six: **Goblins** (5 basics + the Chief, Wild's Edge),
**Cultists** (4 + the Cult Mystic, Blighted Shrine) and **Raiders** (4 + the Champion Raider,
Storm Coast) since 2026-09-02, then **Fae** (4 + the Pixie Queen, Forbidden Forest),
**Vulcans** (4 + the Vulcadozer, Molten Foundry) and **Undead** (4 + the Dread Raven,
Necropolis). Every Location fields its own roster and its own Guardian champion; nothing
falls back to `DEFAULT_FACTION_ID` any more, and Wild's Edge names it only because Act 1 *is*
the Goblins.

The Molten Foundry's faction was called **Automatons** until 2026-09-05 and is now the
**Vulcans**, because four of its six are not Mechs at all — the name is the place's, not
either half's. `LocationDefinition.faction` is the only place the old name lived.

Each one was a block of data in `enemies.ts` plus one field on its Location, exactly as this
section predicted — no engine change was needed for any of the five, which is the pure-data
architecture doing its job. The five tells below are built entirely out of status and field
effect vocabulary that already existed.

The upside buried in it: `run-loop.md` §4 still lists "a real Guardian boss hero" as
unbuilt, and locations supply the reason to author six of them rather than one. Each
location's Guardian is its faction's apex. That is a far better authoring prompt than
"make a Guardian."

**What a faction is authored against (2026-09-02, the Cultists).** `FactionRoster
.baselineAct` is the act a roster's stat lines *are* — `difficulty.ts`'s `actScaling` takes
it as an override on the `monsters` track default, so the same four Cultists are an Act 2
encounter as written and pick up +30 stats per act beyond it. The Goblins' 2 is a fudge (they
are Act 1 content that never appears past Act 1, so the clamp does the work); the Cultists' 2
is a real figure, and the field exists so the next faction can honestly say 3 without moving
a global.

How far above the Goblins is a **decision that was made twice** (2026-09-02), and the second
answer is the one to reason from. The first pass read "considerably stronger than Goblins"
as ~280 against their ~180 — more than a full act-step of daylight, and deliberately under
the weakest authored hero at 325, on the theory that a mob should stay under the hero band.
Per user direction that theory is wrong at this point in a run: an Act 2 squad is four heroes
carrying two acts of equipment and level-ups, and a 280-stat enemy is deleted before it acts.
The basics are now a flat **400** — level with the *strongest* authored hero, not under the
weakest — and the Mystic 500. Fodder is what the Goblins are for; a faction with a shrine and
a Guardian is not fodder.

What keeps them from simply being heroes is **mana**, which was left where it was when the
stat lines went up: 50-65 pools against a hero band of 30-90, with kits costing 15-30 a cast.
They hit like the top of the roster and run dry like a mob, which is the intended shape — the
fight is decided in the first few rounds or it is decided by who can still cast.

The Cultists are also the first faction with a **shared type spine** — every one of them
leads on Shadow, with the second type fanning out (Iron / none / Nature / Frost, then Arcane
on the Mystic and Ancient on Yugzulach). That is the legibility trade the shape is for: the
faction reads as one cult at a glance, and it pays for that with one common answer — Light
and Spirit are super-effective against the whole roster. Whether a faction *should* be
counterable as a unit is an open balance question (§6), not a settled one; the Goblins, whose
five basics are five different types, are the counter-example already in the game.

The shared spine is now the house shape rather than one faction's experiment: the Raiders
lead on Iron and the Fae on Nature, each fanning its second type out across the basics the
way the Cultists do. What each spine costs is the whole point of picking one — Shadow gives
up two attacking types (Light, Spirit), Iron three (Fire, Storm, Mech), and Nature four
(Fire, Frost, Shadow, Beast). The Fae are therefore the most counterable faction in the game
on purpose, and the Renew engine below is what they are paid for it.

**The counter-example, and the better answer (2026-09-05, the Vulcans).** The Molten Foundry
has **no single spine** — Fire leads four of its six and Mech the other two, which is what
the rename is for. It did not escape the §6 problem: Water is 2x into Fire *and* 2x into
Mech, so it is super-effective on the entire fightable roster, tighter than the Cultists'
Light/Spirit rather than looser. A mixed faction is not automatically an uncounterable one.

What makes it work anyway is **where the exception sits**. The one Vulcan Water does not
beat is the **Lava Beast**, whose Ancient half drags it back to 1x — so a squad that brought
Water cuts through the whole Foundry and then meets the Guardian with its answer gone. That
is the pattern to reuse: not a faction with a hole in its counter, a faction whose *boss* is
the hole. It costs nothing to author (every champion is already Ancient-second) and it makes
the type-answer decision a real one instead of a solved one.

**What a faction's tell is (2026-09-05, the Fae, the Vulcans and the Undead).** A roster at the same 400/500/700 band as
the last two has to be a different *fight*, not a different colour, and the lever is a status
the whole kit is built around. The Raiders' is Conduct — a mark that pays out on the next hit.
The Fae's is **Renew**, which pays out three ways off one turn: the end-of-round heal, the
x2 on Seed Shot and Branch Slam while the user carries it, and — under **Verdant Earth**, set
by the Light Fairy's Magic Growth at a plain `fight` node — Attack and Intelligence equal to
the live Renew value. Two brakes keep it honest: Renew halves every round, so the engine
decays on its own clock, and Verdant Earth is **symmetric**, so a player side carrying its own
Renew gets the same stats out of the Fae's ground. The Elder Bough is the apex of it —
Overgrowth is Renew 100 on itself, three payouts from one action — and Speed 30, the slowest
champion by 20, is what it pays. Whether that self-plant is too much on top of 260 HP is a
first-pass number for playtest, not a decision.

The Vulcans' is **Burn that does not go out**. Spreading Blaze sets **Scorched Land**, whose
whole text is "Burn no longer decays", and Burn stacks *additively* — so once the ground is
lit the stack only ever climbs, and Immolate triples against a Burned target. The
counterplay is authored into the status rather than into the kits: Burn `clearsOnSwitch`, so
one switch wipes it clean. Which means this engine **sharpens as the fight grinds**, because
the lock-in rule takes voluntary switching away at 2 KO'd heroes — the mirror image of the
Fae's Renew, which decays on its own whether you engage with it or not.

One thing the same field effect ruled out, worth recording so it is not re-added: the
Guardian originally carried **Volcanic Surge**, whose self-inflicted Burn 30 *also* stops
decaying on the boss's own Scorched Land. Measured at 265 -> 190 HP in two rounds with the
decay still on; with it suppressed the fight becomes "outlast its suicide". The self-cooking
belongs on the Automaton, where 110 HP and a one-cast pool make Overheat a cost rather than
an exit. `test/vulcans.test.ts` guards the Guardian against any self-targeted status.

The Undead's is **Haunt**, and it is the first tell that changes *who gets hit* rather than
how hard. A Haunted hero takes every Spirit or Mind attack aimed at its **partner**
(`spreadTriggerTypes`, `statusEngine.ts`) — which is most of this roster's damage — so one
25-mana Torment turns each of the faction's single-target casts into two hits, with nothing
scaling the second one down, because "no spread damage reduction" is a locked invariant.
Measured across the roster: 10 of its 17 single-target attacks spread, and the seven that do
not are the Knight's Iron half, the King's Ancient half, and all four of the Raven's.

The second half is what makes the first half a trap rather than a grind. **Spite** doubles
below 50% of the *user's* HP and **Vengeance** triples below 25%, so an Undead gets stronger
the closer it is to dead — and the two interlock, because spreading the player's damage
across both enemies walks *both* into Spite range together instead of letting either be
removed cleanly. Chipping the Necropolis arms it. The counterplay is to burst one target
through the spread, or to switch: Haunt `clearsOnSwitch`, and it is the switch-*out* that
clears it.

The Skeleton King is that at apex, and its stat line is the argument: 210 HP, the **lowest**
of the five champions, with the points that would have been HP in Attack and Intelligence.
The Vengeance window is ~52 HP wide — roughly one player turn — so the whole fight is whether
that turn kills it or hands it a 180-power swing. It does **not** carry Last Rites (bp120,
user drops to 1 HP) for the same reason the Lava Beast lost Volcanic Surge: a boss that ends
itself makes turtling the answer. Vengeance punishes a sloppy finish instead of performing
one, which is the opposite trade.

### `guardianFinalEnemyId` — the faction champion

One enemy id per location, held on the **bench** of that location's Guardian fight so it
is the last combatant to reach the field (`run-loop.md` "The Guardian's champion" for the
mechanism and the balance questions). **All six have one**, as of 2026-09-05: Wild's Edge's
**Goblin Lord** (600 stat total, Beast/Ancient, physical), the Blighted Shrine's
**Yugzulach** (700, Shadow/Ancient, magical — the same silhouette one act later and down the
other damage pipeline), the Storm Coast's **Leviathan** (700, Water/Ancient), the Forbidden
Forest's **Elder Bough** (700, Nature/Ancient), the Molten Foundry's **Lava Beast** (700,
Fire/Ancient) and the Necropolis's **Skeleton King** (700, Spirit/Ancient). No location
carries `null` any more.

All six are **Ancient-second**, which is a convention worth naming now that the set is
closed: Ancient's attacker row is empty and every other row resists it, so a champion is a
type-chart *wall* — nothing on the board is super-effective against one. That is the
silhouette the fight is meant to have, and it is also the lever the Vulcans use (below).

Whether the champion sits inside its faction's type spine is a per-location call, and all
three readings are now in the game. Yugzulach, the Elder Bough and the Skeleton King **do**,
so the answer that beat the basics still beats the boss — the readable version. The Leviathan
does **not**, because the Storm Coast's apex is a thing that lives in the water rather than a
bigger Raider. The Lava Beast is the third: inside the spine, but its Ancient half is what
takes the faction's one answer away exactly when the player reaches for it (see the Vulcans
note above).

**The leader is a separate question, and the Undead answered it differently (2026-09-05).**
Every other faction's `leaderId` shares its basics' primary type. The **Dread Raven** is
Beast/Shadow against four Spirits, and the consequence is mechanical rather than cosmetic:
Haunt triggers off Spirit and Mind, so the Raven is the one Undead whose blows do not carry.
That turns a `battle` node into a real fork — kill the Raven, which is the fastest and
hardest-hitting thing on the board and the softest leader in the game at 70 Defense, or kill
the Bone Conjurer, which is what makes everything *else* hurt twice. A leader outside the
spine is worth reaching for exactly when the faction's tell has trigger types to sit outside
*of*; it would have bought the Cultists or the Vulcans nothing.

A **location** property rather than a faction or boss-node one, and that placement is the
decision worth recording. What comes out of the treeline at Wild's Edge is a Goblin Lord
because Wild's Edge is where the Goblins are; the same node type in the Necropolis should
produce something else entirely. Hanging it off the node would have made it a property of
*how hard this fight is*, which is what `run-loop.md` §2's node kinds already say and what
the act curve already scales. Hanging it off the *faction* would have handed the four
placeholder Goblin locations a Goblin Lord they were never meant to field. This says *whose
ground you are standing on* — the same thing `faction`, `factionId` and `affinity` say, and
so it belongs beside them.

It is also the half of the faction bill above, and it is now paid in full — six locations,
six factions, six champions.

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

### 5.2 Faction enemy content — still the largest chunk of actual work

**Plumbed and half-paid (2026-09-02).** `LocationDefinition.factionId` names a
`FactionRoster` in `enemies.ts`, and `App.tsx`'s `handleSelectNode` reads it for
both mob node types — `basicEnemiesOf(faction)` for `fight`,
`generateLeaderEncounter(…, faction.basicIds, faction.leaderId, …)` for `battle`.
Nothing about a Goblin is hardcoded in the app layer any more; the old
`generateGoblinChiefEncounter` is the same function under a name that no longer
names a faction.

All six rosters exist as of 2026-09-05. Nothing points at `DEFAULT_FACTION_ID` as a
*fallback* any more — Wild's Edge names it because Act 1 is the Goblins, and the constant is
kept only for a Location that ever ships without a faction.

Roughly 4-5 basics + 1 leader per faction, `HeroDefinition`s in the shape
`enemies.ts` already uses (a Goblin does not need a different schema, it needs
different numbers — `run-loop.md` §3), plus a `baselineAct` saying which act the
numbers are for. Each faction that lands is a block of data and one field here.
The Cultists are the worked example.

**The Raiders (2026-09-03), and what a second faction settled.** The Storm Coast now
fields `'raiders'` — four basics at a flat 400, the Champion Raider at 500, the
Leviathan at 700, and `baselineAct: 2`. Every one of those figures is the Cultists'
figure, deliberately: Storm Coast and Blighted Shrine are both drawn from the same
acts 2-5 pool, so the two rosters are interchangeable in an itinerary and a second
stat band would only make the location pick a difficulty roll. Separating them is
`difficulty.ts`'s job, not the roster's.

They keep the **shared type spine** the Cultists introduced — every Raider is
Iron-primary, second types fanning out over none / Storm / Water / Arcane, then Storm
again on the Champion. So the open balance question in §6 now has two data points
rather than one: an Iron warband answers to Fire, Storm and Mech as a unit the same
way a Shadow cult answers to Light and Spirit.

What makes it a *different fight* at the same numbers is **Conduct**. The status
detonates off `triggerTypes: ['Storm', 'Iron']` (`statuses.ts`) — which is what this
faction is made of — and two of their moves go free against a marked field:
`metallicBlade` on any mark, `overcharge` on both. The Stormraider's Ionize is
therefore worth a whole turn: it buys the warband a round where the mana brake is off
*and* every hit carries an extra 10% of max HP. The counterplay is built in, because
detonating consumes the mark — the discount and the damage compete for it.

Two things that fell out of authoring it, both worth knowing before the next faction:

- **A faction gimmick wants a cheap detonator on every member.** The Surfraider's
  first kit was two Water moves and a non-damaging Iron debuff, which left the fastest
  Raider unable to cash a mark at all. `swiftBlow` (Iron, 15 power, priority +1) fixed
  it and is better content besides — the fast one detonates before the round starts.
- **The Mysticraider still cannot**, and that is a content gap rather than a choice:
  the only Iron move that runs off Intelligence is `conjuredSword` at 80 mana, well
  past the faction's mana brake. An Iron **magical** move in the 20-30 range would
  close it. Until then the caster plants nothing and cashes nothing — it makes the
  marks affordable, which is a clean enough division of labour to leave alone.

### 5.3 Per-location Guardians

`run-loop.md` §4 still lists "a real Guardian boss hero" as unbuilt — the boss is
two fixture heroes with a bigger stat bonus. Locations are the reason to author
six of them instead of one: each location's Guardian is its faction's apex. Blocked
behind 5.2 in practice, since a Guardian without its faction reads as unrelated.

**Three of six authored (2026-09-03).** The Leviathan joins the Goblin Lord and
Yugzulach, and is the case that proves the field belongs on the Location rather than
the faction: it is Water/Ancient where every Raider is Iron, because what comes out of
the surf is not a member of the warband. One open dependency — its Ancient STAB is
`archonBlast`, already the Goblin Lord's, because the Ancient slate is three
placeholder moves long (`CLAUDE.md` "Repo map"). Revisit when Ancient is authored.

**Partly answered, from an unexpected direction (2026-09-01).** The Goblin Lord is the
Goblins' apex, and he shipped without waiting on 5.2 — because
`guardianFinalEnemyId` puts him *beside* the generated boss rather than in place of it.
That is a cheaper shape than this section assumed: a champion is one enemy definition and
one field, where replacing the Guardian outright would mean authoring a whole boss and
deciding what happens to the +20-to-3-stats bonus, the Banner, and the contract claim.
Whether the other five factions want a champion, a replacement Guardian, or both is now a
real choice rather than a foregone one.

**Worked a second time (2026-09-02).** Yugzulach, Shadow/Ancient, arrives on the Blighted
Shrine Guardian bench exactly as the Lord does at Wild's Edge. Two data points make the
shape look deliberate rather than opportunistic: both champions are dual-typed with
**Ancient** as the second type, which is what that type keeps itself for, and both spend
their four moves across both damage pipelines. They differ in which pipeline they *lean* on
— the Lord is 90 Attack to 70 Intelligence, Yugzulach 120 Intelligence to 90 Attack — so
the answer a player needs at the end of Act 1 is not the answer they need again later. Four
to go.

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

### 5.5 The location follows the player through the act

**Closed 2026-08-29.** A location used to be announced once and then vanish:
the map well was one hardcoded warm gold in every act, and every screen past it
had no idea where it was. It is now carried by the map, its name, and every
screen inside an act.

#### The map well

The same three identity channels the arrival screen uses, at a fraction of
their strength (`MapScreen`, styles.css "The map well's Location"):

- **Tint and lighting.** `--node-rgb` and `data-location` are set on
  `.map-screen`; each location gets its own wash recipe. Tint alone would have
  produced six versions of one place, so the recipes differ in *where the light
  comes from* — open dusk over hills, a lit corridor between dark trunks, a hot
  floor under a black ceiling, flat overcast with a squall band, a fog that lies
  on the ground, a single altar bloom. That wash is the well's own `background`
  rather than a layer, deliberately: a background is fixed to its element, so it
  survives a map tall enough to scroll.
- **Weather.** The same six ambience keyframes, at `MAP_MOTE_DENSITY` (half the
  count) and half the opacity. `LocationSky` was split so `LocationMotes` can be
  used without a sky; `data-ambience` moved onto the motes container, which is
  the only ancestor both call sites share.
- **Horizon.** The same silhouette band, shorter, dimmer and with the entrance
  animation off — the map is re-entered after every node, and a band that
  settles in each time reads as a transition rather than as land. It sits at the
  BOTTOM of the well, which on this screen is the act's origin: the route climbs
  away from where you walked in, toward the Guardian.

The direction cue the old gold well carried survives the recolour — lit ground
at the bottom, a crown at the top — it is simply the location's colour now.

#### The name

`MapScreen`'s `MapPlacard` etches the location's name and its faction into the
well's **bottom-left corner**. It is unboxed, per `visual-language.md`'s rule
that the only rectangles are controls, and `pointer-events: none` so no map
shape can lose a tap to it.

It sat top-left first, reasoning that the top two rows are width-1 and a
width-1 row pins to the centre column (`ROW_COLUMNS`). True, and not enough —
**pinning a tile to a column does not keep it inside one.** The Guardian is
`tier-ancient`, whose 124px min-width exceeds the ~117px column, so it spills
into both neighbours and ran under the placard on longer names. The bottom row
is the act's opener, a `tier-encounter` tile at 92px that fits its column, so
that corner is genuinely empty; the width cap is now sized to the free column
rather than to the well, so a long name wraps rather than reaching whatever
tier ends up beside it. Measured clearance across all six names: 19px at worst.

Landing on the horizon silhouette turned out to be a gain rather than a cost —
dark land is a better ground for lit text than open sky, and a name at the foot
of the climb reads as a signpost at the place you walked in from.

#### Every screen inside an act

`NodeSky` (`NodeStage.tsx`) renders the location whenever `LocationContext` has
one, which reaches all ten node screens — the Guild Hall, every reward and stat
grant, the Mentor, level-up, forced equip, evolution, roster replace — plus the
squad select, without any of them knowing the system exists.

The division of the screen is the design. A node screen's own `--node-rgb` is a
**semantic** tint (gold for a cache, violet for a relic, teal for the Mentor,
an item's rarity colour for a forced equip) and it still owns the wash's upper
pool and the header bloom: *what kind of moment is this*. `LocationAmbience`
redefines `--node-rgb` for its own subtree only and takes the bottom: ground
glow, weather, horizon — *where is it happening*. Neither has to be dimmed for
the other, and the generic rising motes are **replaced** rather than joined,
since two particle fields on one screen is noise rather than twice the
atmosphere.

Two things this cost, both worth naming:

- **`LocationContext` is the first React context in the repo.** A location is
  ambient — true of the whole act, read by one shared leaf component, used for
  nothing else by any of the ten screens that render it. Prop-drilling it meant
  ten prop lists and ten call sites growing a field they only forward, and
  `RosterReplaceScreen` taking a `RunState` it does not otherwise want. The
  value is nullable and `App.tsx` decides: `null` outside an act
  (`PLACELESS_SCREENS`) is what keeps the title and the sandbox tools on the
  plain placeless sky with no opt-out at any call site.
- **`ShopNodeScreen` never actually stood on the node stage.** It carried
  `.node-screen` from the day it was written but rendered no sky and set no
  tint, so the Guild Hall was the one node in the run loop drawn on bare page
  background. It now has both; the tint is `NODE_TINT_MANA`, the same blue its
  tile wears on the map.

No per-location wash recipes on node screens, unlike the map well. The map is
dwelt on and can afford six lighting ideas; a node screen is passed through in
seconds and already has a tint of its own competing for the same field.

#### The arena

**Closed 2026-09-01.** `FightScreen` was the last surface that did not know
where it was, and the worst one to leave out: the map is looked at between
nodes, the fight is where the act is actually spent.

The three channels again, in the arena's own grammar rather than the node
stage's — `.battlefield` carries `data-location` and the location's
`--node-rgb`, and renders one `LocationAmbience` layer (`ArenaLocation`,
memoised because the arena re-renders on every beat and the weather has nothing
to say about any of them):

- **Six lighting recipes**, full overrides of the placeless scene, on the same
  rule the map well follows: the light is what separates the places, not the
  hue. Each keeps the two zone tints at a slightly reduced 0.18 — "enemy up
  there, me down here" is information and the location is only mood — and each
  carries its own weight of tactical grid, which finally means something: a
  foundry has plating, a forest has no floor to draw.
- **The horizon silhouette, anchored to `.battlefield-divider`.** On every
  other screen the far distance is the bottom edge; here it is the middle,
  which is the whole reason that divider became a horizon. So the treeline
  stands *behind the enemy row*, which is where "over there" is.
- **Weather at `ARENA_MOTE_DENSITY` = 0.45**, the lowest of any surface. This
  is the one screen where a mote can cross a damage numeral.

The console below is deliberately untouched. The scene is the place; the
console is the instrument panel it is read through, and weather in both would
erase the one line on this screen that separates world from UI.

Three things the horizon band cost, all of them invisible until it was on
screen (`visual-language.md` fourteenth pass has the shots):

- **It has to be TALL**, which is the opposite of what it looks like it wants.
  Sized to sit in the gap under the enemy row, the whole silhouette lands
  behind that row's HP and MP pills and the only thing visible is its own
  ground — a black bar across the middle of the screen. It is 28% of the
  arena, reaching up past the pills to the portraits.
- **Its base has to dissolve.** Every band in `locationArt.tsx` ends in a
  full-width ground fill, which is correct where the band sits on the bottom
  edge and is a hard slab anywhere else. A `mask-image` fading the lowest 26%
  turns it into mist at the foot of the treeline.
- **Half a pixel of blur**, which is depth of field rather than softening: the
  skyline is the only far-away thing on the screen, and a hard edge on it put
  the treeline in the same focal plane as the name pills in front of it.

An active Field Effect still owns the horizon line and its haze — those rules
are authored later in `styles.css` at equal specificity, deliberately, so
standing battlefield state outranks the place it is standing in.

**Still owed.** Nothing outside the view layer knows about any of this; the
location still changes only *who* you fight (§5.6). A location-specific Field
Effect remains explicitly deferred (§6).

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

Every presentation surface — the arrival screen, the map well, the node
screens and the arena (§5.5) — has **no automated coverage**. Each was verified
by screenshot, which is the standard method for this repo
(`visual-language.md`); the map well and the arena were checked across all six
locations, the node screens across three. The data and selection layers are tested (`test/locations.test.ts`).

A second trap, this one on the map: the atmosphere layer has to reach back over
the well's padding so its horizon meets the frame's real inside edge, and it
did that with negative insets while it still lived inside `.map-scroll`. A
negatively-inset child of a **scroll container** does not overhang — it becomes
scrollable overflow, and it put 14px of vertical and 12px of horizontal scroll
on a map deliberately sized to fit its canvas exactly. The fix was to split the
well into a `.map-well` frame (wash, border, radius, atmosphere, placard) and a
`.map-scroll` scroller inside it. Anything that must overhang the padding, or
must stay put while the route scrolls, belongs on the frame.

One trap the node screens hit that is worth repeating from the §5.7 list: the
horizon band was authored at 22% of screen height first, which put the whole
silhouette under the squad select's full-width "Start Fight" button with only
the Necropolis mausoleum's spire showing — a stray spike, not a skyline. It is
the same failure as drawing below y≈78 of the viewBox. A band has to be tall
enough that half of it clears whatever button the screen ends in.

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
- **May a faction share one type spine?** Still open, but no longer abstract — all six
  factions are authored now and four answers are on the table. The Cultists (Shadow),
  Raiders (Iron), Fae (Nature) and Undead (Spirit) each share a spine, and what that costs
  varies more than expected: Spirit and Shadow give up two attacking types, Iron three,
  Nature four. The Goblins share none. The **Vulcans** are the interesting case, because
  they show a mixed faction is not automatically the safer choice — Fire and Mech happen to
  share Water as an answer, so the Foundry is *tighter* to counter than the Cultists despite
  having no spine at all.

  What the set suggests, and what a playtest should check: the spine is not the lever that
  matters. The **exception** is. A faction whose Guardian sits outside its own answer (the
  Lava Beast) or whose leader sits outside its own tell (the Dread Raven) stays interesting
  at every stat band, spine or no spine. Measure whether that holds before writing it down
  as house style.
- **Where does the mob curve sit against the player curve?** `FactionRoster.baselineAct`
  makes "which act is this roster for" authorable, but the Cultists' 400 stat total at
  Act 2 and the +30/act above it are figures chosen against the hero roster as written,
  not measured against a played Act 3. The 400 already replaced a 280 that was wrong by
  inspection rather than by measurement; the +30/act has had neither test. Same status as
  every other number in `difficulty.ts`.
