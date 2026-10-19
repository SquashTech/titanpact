# world-map.md — The world map

> Module of the Titanpact `/docs` suite, beside `locations.md` (the places one at a time),
> `lore.md` (the fall, the seal) and `stories.md` (where the map is first shown). This doc owns
> **where the places are relative to each other**, and when the player is shown that.
>
> **PROPOSED 2026-10-19, nothing decided or built.** The user's direction, in their words:
> *"something to orient the player with some more context. We can wait to show this until the
> Titan drops and include the Titan in the map maybe. We probably need some central point like a
> city which is not named or anything yet, but naturally I think a city would be where everything
> starts and then Wild's Edge is right next to the city."* Treatments to pick from:
> `art/concepts/world-map/index.html`.

---

## 1. Why

The game has eleven places and no geography. A Location is a painting, a name, an omen and three
types, met one at a time, and the order a run meets them in is a random draw. Nothing says the
Storm Coast is far from the Molten Foundry, that the Necropolis is where the river ends, or that
the Titan came down a day's walk from where the player started. The Story makes it more pressing:
chapter 2 sends Ren **north** after the Herald, chapter 3 is in the Forbidden Forest, and chapter
4 is **a town to the east** (`stories.md` §11–15). Those directions need a page to point at.

Reference games: **Slay the Spire**'s act map is a route, not a world, and that's the run map we
already have. What this is closer to is **Darkest Dungeon's** hamlet-and-regions board (one home,
the dangerous places around it, each a clear biome) and **Hades'** short travel beat between
biomes. **Pokémon**'s town map is the plainest precedent for a portrait handheld: a small
board, a cursor on where you are, place names, and nothing to manage.

## 2. The layout

North is up. The board is portrait, sized to the phone.

| Where | Place | Why there |
|---|---|---|
| **Centre** | **The city** (unnamed, §6) | Where everything starts. It sits at a **ford on the river**, which is why a city is there at all. |
| Just **north** of the city | **Wild's Edge** | Where the farmland stops and the wild begins: the city's own edge, close enough to walk to for a hunting job (the prologue). Every type walks here because it's the crossroads. |
| **North**, past Wild's Edge | **Forbidden Forest** | Chapter 3's forest, on the road north. The river runs through it. Nature, Beast, Light. |
| **Far north**, centre | **The Threshold**: the Titan's crater | Where it fell (`lore.md` "The fall"). Ren goes north after the Herald, so the Titan is north. The river rises here: **"the river runs black"** the morning after (`stories.md` §11) because it flows out of the crater, through the forest, past Wild's Edge and through the city. |
| **West** coast | **Storm Coast** | The open sea is west, so the weather comes ashore here. Storm, Water, Stone. |
| **South-west**, at the river's mouth | **Necropolis** | The dead city at the end of the river the living city sits on. Proposed as the old capital (§7). Spirit, Frost. |
| **East** | **Molten Foundry** | In a canyon of the eastern range: furnaces want ore and a mountain. Fire, Mech, Iron. Chapter 4's surviving town is on the road east toward it. |
| **South-east** | **Blighted Shrine** | Dark badlands below the end of the range, far from the river and the roads. Shadow, Arcane, Mind. |
| **Far north-west**, a frozen bay | **Frozen Reach** (Cycle III) | The northern sea, where ships go out and don't come back. In Cycle III the Long Winter **spreads south from here** and buries Wild's Edge, which is why Act 1 moves to the Reach (`cycles.md` §3). |
| **North-east**, the range's high peak | **Thunder Aerie** (Cycle IV) | The tallest peak of the same eastern range as the Foundry. |
| **Just south** of the city | **Holy Sanctum** (Cycle II) | Survivors raised it (`cycles.md` §3), so it's built next to the people who raised it. |
| **Far south**, misty highlands | **Dreaming Spires** (Cycle III) | The farthest place from the Titan, quiet enough to dream in. Mind, Arcane, Spirit. |

Three things this layout gives without adding a rule:

- **The river is the story's spine.** Crater → forest → Wild's Edge → city → Necropolis → sea.
  Whatever the Titan does to the land, the river carries home. One line on the map explains
  chapter 2's black river, why the city is in danger, and why the dead city is at its end.
- **The seals ring the Titan.** The six base seals (Wild's Edge, Forest, Coast, Foundry,
  Necropolis, Shrine) stand on every side of the crater, and each one's chain can be drawn to it.
  That's the Pact Seal screen's picture laid out on the land.
- **The roads leave from the city.** A run's random draw of Locations reads as setting out from
  home in a different direction each act, not a teleport.

**A tension to decide.** The user asked for a central city, and the seals would like the Titan at
the centre. The layout above puts the city at the centre of the board and the crater in the
north, a day's walk past Wild's Edge, so the seal chains converge north instead of radiating out.
The alternative is to put the crater at the centre and the city just south of it, which makes the
seal picture cleaner but puts the city in the Titan's shadow. Proposed: city centre. The prologue
needs the Titan close enough to see fall from Wild's Edge, and both layouts give that.

## 3. When it's shown

The map is never a screen the player has to remember to open. It appears where the game already
pauses to move the player somewhere.

1. **The prologue's end (the reveal).** A Tale of Valor, chapter 1, after the fall and the escape:
   the map opens for the first time. The fall's trail is still in the sky, the crater is fresh,
   the six seals stand open, the city is lit, and Wild's Edge holds the player's mark. One line,
   no tally. This is the first time the player learns the world has more than one place in it.
2. **Story chapter openings.** Each chapter opens with the map, drawing the road to where it
   happens (north to the forest, east to the town). It replaces nothing; it sits ahead of the
   arrival screen.
3. **A Classic run's act transitions.** The Pact Seal screen locks a ring at every act's end and
   then the arrival screen names the next place. The proposal: **the map *is* the Pact Seal
   beat.** The ring locks *on the map*, at its place, with its chain pulled taut to the crater,
   and the road then draws from there to the next place, which is where the arrival screen opens.
   One beat where there were two. **This would replace the Pact Seal screen as rebuilt on
   2026-10-07** (the sockets on the title's seal, the Titan's eyes opening wider), so it's the
   user's call. The lighter version keeps the Pact Seal screen and adds only the road drawing,
   as a few seconds on the arrival.
4. **Proposed, not recommended: a map to open any time** (a tab in the Reference, or a tap on the
   act rail). It's a screen the player has to remember to open, so it's expensive and probably
   not needed if (1)–(3) land.

## 4. What it shows at each moment

| Moment | Shows |
|---|---|
| Prologue reveal | The fall's trail; the crater, fresh, its magenta glow; six open seal rings; the city lit; Wild's Edge marked; the black river. Cycle-granted places are absent. |
| Story chapter opening | The road so far as a walked line, and the next stop pulsing. |
| Classic, between acts | Places this run has stood in (lit, their ring locked and chained to the crater), the place just left, the road to the next one, and the places not drawn this run (dim). Seals that held through the run without being visited stay open-ringed. |
| Classic, Cycle II on | The Holy Sanctum appears beside the city. Wardens could stand at their seals (a small figure), which is a quiet way to show them. |
| Cycle III | Snow spreading from the Frozen Reach over the north; Wild's Edge under it (dim, unmarked); the Reach as Act 1; the Spires appear. |
| Cycle IV | The Aerie appears. |
| Cycle V | No seal holds: every ring open, the crater wider. The finale's map. |

The Titan is drawn the way the Titan art rule says (`titan-art-direction` in memory,
`titan-eyes.md` §12): pixel, fog greys, near-black, magenta the only colour. On the map that's a
dark crater with the fallen shape half-buried in it and one magenta glow. Places are never drawn
in magenta.

## 5. Treatments (pick on `art/concepts/world-map/index.html`)

- **A. Painted.** A PixelLab painting of the land at night (Pixflux img2img off a hand-laid
  layout, so the geography is exactly §2's), with names, seals and the road drawn over it. Most
  like the Location paintings; the hardest to change later (a moved place means a repaint).
- **B. Night land.** The land as a dark silhouette under the title's night sky, places as small
  lit marks, seal rings as a constellation drawn to the crater. It rhymes with the title and the
  Constellation, and it's all vector, so Cycles can change it freely.
- **C. Cartographer's chart.** Ink on a flat parchment face (no grain, per the no-texture rule),
  hand-drawn hills, trees and a wax seal at each seal place. The most readable as a *map*; the
  furthest from the game's night palette.

Every treatment shows the same three moments: the prologue reveal, a Classic run entering
Act 3, and Cycle III's Long Winter. The city's name candidates (§6) toggle on the page too.

**How the paintings were made** (36 PixelLab generations): the layout was laid by hand as flat
shapes (`layout-rich.svg`/`.png`), then given to `create_image_pro` at 224x400 as a "composition
and layout only" reference (15 generations each, seeds 8 and 29). Pixflux img2img off the same
layout at strengths 60–160 came out flat or toy-like and was dropped. The Pro paintings moved a
few places slightly (the crater sits higher), so the page shifts its marks per painting.

## 6. Names for the city (open, the user's to name)

Plain English, like the Locations: **Hearthold**, **Pactford** (the ford, and the town where
pacts are made: the Guild could be headquartered here), **Lanternfall**, **Kingsmere**,
**Haven**. The concepts label it "The City".

## 7. Open — do not silently resolve

- **City at the centre, or the Titan** (§2).
- **Whether the map replaces the Pact Seal screen** or only joins the arrival (§3.3).
- **What the city is in play.** It has no node. Candidates: it's where the Guild Hall is
  (the funnel every act is the city's guild, met on the road); it's where a Story chapter
  returns between acts; or it's only a picture.
- **The Necropolis as the old capital**: a lore proposal that would make the river a line from
  the living city to the dead one. It also touches `lore.md` §2's open item (the fall has no age
  before it), since an old capital implies an age before the Titan.
- **Distances.** The run's draw ignores geography: Act 2 can be the Coast and Act 3 the Shrine,
  across the whole map. Proposed: keep the draw and draw the road however long it is. The
  alternative (the draw prefers neighbours) changes run variety for a picture and isn't
  recommended.
- **Chapter 4's town** east of the city: whether it gets a name and a mark.
- **Where the Wardens show**, from Cycle II.
