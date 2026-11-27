# road-map.md — The run map as a road

> Module of the Titanpact `/docs` suite, beside `run-loop.md` (what an act's rows hold) and
> `visual-language.md`. This doc owns **how an act's map is drawn**: a road with stops on it,
> in place of today's one row of tiles over the Location painting.
>
> **DECIDED AND BUILT 2026-11-27, per user direction.** `src/view/run/MapRoad.tsx` (+ `mapRoad.css`)
> replaced the one-row scene (`MapRoute`, deleted) and the progress rail; the tap preview moved to
> `MapPreview.tsx` unchanged. Mocks: `art/concepts/road-map/index.html`.

---

## 1. What was decided

- **Lanes** (picked over Signposts, 2026-11-27). The act is one vertical road the player
  scrolls. A choice row is the road splitting into one lane per option, and the lanes join
  again at the next stop. Done stops carry a check, skipped lanes go grey, the live lanes march,
  and a portrait token stands on the current stop. Reward rows past the next one hide under mist.
  The first tap on a stop lights it and raises a card with Go; the second tap goes. Reference
  games: Candy Crush, Royal Match, Clash Royale's Trophy Road.
- **The Guardian stop is a Tower** (2026-11-27, replacing the sealed stone gate): a stout keep
  with a red pennant and a barred door, standing at the top of the road on the Location
  painting (`art/concepts/road-map/guardian/tower.png`, 96px). The Lair, Ring, Egg and Throne
  were the other options.
- **No magenta eye** on the Guardian stop or anywhere else (2026-11-27, per user direction):
  the eye was the Titan's, and the Titan is out of the game.

## 2. Open

- **The fork reads as a route.** Every row is fully connected to the next (since 2026-09-08),
  so no lane closes anything. A road that splits invites the player to read it as a route that
  matters, and nothing on the road says otherwise.
- **Scrolling.** An act is about 2,500px, roughly three screens at 394×780. The map has never
  asked the player to scroll, and the screen has to open scrolled to the current stop.
- **Ground art.** The Location paintings are side-on. The road keeps the painting as the horizon
  and draws plain ground under it in the colour read off the painting (`useGroundColor`), with
  trees in shades of it. Each Location could still have its own top-down ground drawn.
- **The Tower's beat.** Built as a first pass: the tower shakes, its door flares in the Guardian's
  element, and that colour floods the screen into the fight (1250ms, the old gate's timing).
- **The Guardian's type** lights the tower's door (`map-tower-door`); the pennant stays red.
- **Lost from the old scene:** the patrons' entrance animations (tied to the old reveal's CSS),
  the per-tile arrival chimes, and the lead-on marks (dead since every row fully connects). On
  arriving at a stop the road now scrolls up from the last one instead.
- **Dead CSS** for the old scene (`.map-route`, `.map-choice`, `.map-rail`, the gate's rules) is
  still in `src/app/styles.css`, as is `mapSpots` in `locationBackdrops.ts`.
