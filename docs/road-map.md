# road-map.md — The run map as a road

> Module of the Titanpact `/docs` suite, beside `run-loop.md` (what an act's rows hold) and
> `visual-language.md`. This doc owns **how an act's map is drawn**: a road with stops on it,
> in place of today's one row of tiles over the Location painting.
>
> **DECIDED 2026-11-27, per user direction, NOT BUILT.** Mocks: `art/concepts/road-map/index.html`.

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
- **Ground art.** The Location paintings are side-on. The mock keeps the painting as the horizon
  and draws a flat meadow under it, so each Location needs its own top-down ground.
- **The Tower's beat.** Tapping today's gate plays a door-opening beat before the fight
  (three layers, `OPENING` in `MapRoute`). The Tower needs its own, such as the door swinging
  open or the pennant rising.
- **The Guardian's type.** Today's gate burns the Guardian's element as a seal on its door; the
  Tower shows none yet. The pennant could take the type colour.
