# Retiring the Titan's eye — inventory

2026-11-27, per user direction: the magenta eye came from the Titan, and the Titan is leaving the
game for the Storybook (`docs/worlds.md` §2.7). No new art, colour or motif uses it. This page lists
every place the eye still lives and splits what code can drop now from what waits on a redraw or on
the Titan's own removal.

**The short version.** Almost every use is still drawn by a live screen (the finale, the Pact Seal,
the title's Titan art, the Threshold, the map's Titan gate), so code can't drop them without
changing what the player sees. They go with the Titan, not before it. The one dead piece is gone.

## Done in this pass

| What | Why it was safe |
|---|---|
| `src/view/shared/titanEye.ts` deleted (`TITAN_EYE`, `EYE_GRADIENT`, `makeEye`) | Imported by nothing since the Titanspawn became pixel sprites (9285a5a4) |
| `scripts/generate-icons.mjs` comments no longer point at it | The script carries its own colour stops |
| All 30 Guardian frames erased by hand, no generations spent (per user direction, 2026-11-27) | See "The Guardians" below |

### The Guardians

Each crack is filled from the pixels around it. An eye that sat where no eye belongs is filled the
same way: the Elder Bough's trunk eye (its dark ring stays as a knot), the Manticore's flank crack,
the Sphinx's forehead jewel, the Wendigo's skull. An eye in the creature's own eye socket is
recoloured to a natural eye instead, so nothing ends up blank-faced: Kraken, Roc and Manticore
amber, Dragon and Seraph gold, Skeleton King Spirit cyan, and Yugzulach's hood glow and attack
wisps a cold Shadow silver. The Skeleton King's violet robe and the Sphinx's Mind wave are their own
colours and stay. The before/after sheet and the script (one hue window and a set of eye boxes per
Guardian) are in `art/concepts/guardians-no-eye/`.

## Code and CSS still in use (each one is visible)

| Where | What it draws | Goes when |
|---|---|---|
| `src/app/styles.css:81-82` `--titan-rgb: 242, 71, 220` | The token every rule below reads | The last reader goes |
| `styles.css` `.enemy-pip.is-boss` (≈2899, 2912) | Boss pips in the fight HUD | **Not Titan-only: Guardians use it too.** Needs a new boss colour (decision below) |
| `styles.css` `.status-badge-ward` (≈3844) | The Herald's Ward badge | With the Herald |
| `styles.css` `.combatant-portrait.is-titans-own` (≈4167) | Magenta rim on the Herald and the Eyes | With the finale |
| `styles.css` `.title-backlight`, `.title-titan .titan-eyes`, `.title-wordmark` (≈21414, 21487, 22092) | Titan glow behind the old title and the Pact Seal; the wordmark glow | `.title-wordmark` is shared with `src/view/story/story.css`, so recolour it, don't delete it |
| `styles.css` `.titan-mote`, `.titan-eye-halo`, `.titan-eye-globe` (≈29618-29792) | LoreScreen and `titanArt.tsx` eyes | With LoreScreen and the Titan art |
| `styles.css` `.titan-rise-*`, `.titan-bound-*`, `.herald-figure` (≈29892-30491) | TitanRise, TitanBound and Herald screens | With the finale screens |
| `styles.css` `.titan-body::before` (≈37997) | The Titan's hide arena (`TitanBody.tsx`) | With the finale |
| `styles.css` `@keyframes pact-seal-eye-flare` (≈50712) | The Pact Seal strike | With the Pact Seal's Titan |
| `src/view/run/openingCards.css:103, 179` (hard-coded `242, 71, 220`) | The opening cards' Eyes glow | With the Eyes card |
| `src/view/run/titanArt.tsx:62-70` (`#f247dc` stops) | `TitanColossus`, `TitanRidge`: title, Launch and Pact Seal | With the Titan art |
| `src/view/run/mapLandmarks.tsx:30` `TITAN_LIGHT` → `MapRoute.tsx:509` | The finale gate's seam and its flood on the map | When the finale node changes |
| `src/view/shared/SceneLights.tsx:83-84, 95-96` (`kind: 'eye'`) | Two pulsing eyes in the Threshold's arena and map paintings | With the Threshold. The `'eye'` light kind has no other user |
| `src/view/shared/statusIcons.tsx:222` `Beheld: '#f247dc'` | The Eyes' Beheld status | With the Eyes |
| `src/view/shared/nodeIcons.tsx:46` `TITAN_EYE` glyph → `fight`, `battle` | The Fight tile's glyph: a slit-pupil eye (ink, not magenta) | **Needs a new glyph (decision below)**: it's the most-seen Titan eye in the game |
| `public/icons/*` (made by `generate-icons.mjs`) | The app icon: a gold-and-red slit eye | **Needs a new mark (decision below)** |

The `titanEyes` data, `isTitanEye` and `EYE_IDS` (`src/data/enemies.ts`) are the finale's
*enemies*, not the motif. They leave with the Titan's content (`docs/worlds.md` §8 counts 1,441
mentions), which is outside this pass.

## Art that carries the eye

Counted by pixels near the magenta (`r>150, b>120`, low green) and checked by eye.

| Files | What's on them | Action |
|---|---|---|
| `art/heroes/guardians/` — 10 Guardians × 3 frames (dragon, elderBough, kraken, manticore, roc, seraph, skeletonKing, sphinx, wendigo, yugzulach) | The "Touched" slit eye and crack. A few frames have it hidden (dragondamaged, skeletonKingdamaged) | **Done**, hand-erased (above) |
| `art/heroes/titan/herald.png`, `heraldattack.png` (`heralddamaged.png` has none) | The magenta seam down the faceless head | Retire with the Titan, or redraw if the Herald becomes a Storybook chapter (`worlds.md` §3, open) |
| `art/heroes/titan/eye*.png`, `righteye*.png` — 8 files | The Eyes themselves | Retire with the Titan. Redrawing them makes no sense |
| `art/map-nodes/landmarks/titanStone.png` | A standing stone with a **red** slit eye (older red Titan palette, not magenta) | Redraw or replace. Still drawn on the map (`mapLandmarks.tsx:17`) |
| `art/map-nodes/landmarks/titanGate*.png` — 4 files | The finale gate. Its red seam is a Titan motif; the magenta is added by `TITAN_LIGHT` in code | Retire with the finale node |
| `art/locations/{,map/,battle/}theThreshold.png` | The Titan in fog with two eyes (the arena's magenta sits there too) | Retire with the Threshold |
| `art/title/fallingTitan.png` | The falling Titan | **Unreferenced**: nothing in `src` loads it. Can be deleted any time |
| `art/heroes/titanspawn/` | The Titanspawn eyes | **Not in this pass**: another session is redrawing them |

Not flagged: the magenta in Necropolis, Blighted Shrine, Dreaming Spires and Forbidden Forest
paintings is their own purple. `art/map-nodes/passiveReward.png` is the Boon glyph's own colour.
`guardianGate*.png` has no eye.

Concept pages under `art/concepts/` (titan-look, guardians-eldritch, spawn-sprites, spawn-redraw,
boss-hp, stories, world-map) show the eye. They're history; leave them.

## CLAUDE.md and docs that describe the eye (stale, not rules)

- `CLAUDE.md` lines 41-52: the Touched Guardians ("ONE magenta slit-eye … one thin magenta crack"),
  the Titanspawn eyes, the Herald's seam, "the Titan's eye is magenta everywhere (`TITAN_EYE`,
  `--titan-rgb`)". These need a one-line note that the eye is retired (2026-11-27). The finale lines
  can be rewritten when the Titan's content goes.
- `docs/titan-eyes.md` §12 (335-371): the Titan art direction and "the eye is magenta everywhere",
  and it still cites `TITAN_EYE` in `figurePrimitives.ts`, which is gone.
- `docs/titanspawn-overhaul.md` 87, 117-118: the eye as the family tell; the Touched rules.
- `docs/lore.md` 163: the Herald's magenta seam.
- `docs/visual-language.md` 3509: "a boss has a bar in the Titan's magenta".
- `docs/cosmetics.md` 83: "No magenta" because the eye owns it. **With the eye gone, the reason
  disappears.** Does the ban stand?
- `docs/world-map.md` 101, 110-112; `docs/the-sky.md` 68, 347, 506; `docs/cycle-five.md` 346-348:
  Titan scenes in magenta, all retiring with the Titan.
- `docs/worlds.md` 102, 134, 235, 260 and `docs/road-map.md` 23 already record the retirement.

## Decisions for the user

1. **Boss colour.** Guardians share the Titan's boss pip (and, per `visual-language.md`, its bar).
   Once `--titan-rgb` goes, Guardian bosses need a colour of their own. The storybook palette
   decides it; a comparison page is cheap.
2. **The Fight glyph and the app icon.** Both are slit-pupil eyes. The eye was "what the
   Titanspawn are", and that reading is gone. Replace them with a new mark, or keep the eye shape
   and lose the slit?
3. **Guardian redraws: decided 2026-11-27, per user direction: erased by hand, no generations.**
   Done. A face eye stays recoloured, not erased (2026-11-27, per user direction).
4. **The Titan's own pieces** (Herald, Eyes, Threshold, Titan gate, titanStone, the finale's CSS)
   wait on `worlds.md` §3: do they retire, or become Storybook chapters?
