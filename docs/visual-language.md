# visual-language.md

> How the presentation layer decides what gets drawn as a container and what doesn't.
> This is a **presentation** doc — everything in it lives on the view side of the
> engine/presentation boundary drawn in `architecture.md`, and none of it may ever
> influence resolution. It exists because "make it look better" kept producing
> locally-nicer panels that made the screen globally worse, and the reason was a
> structural one worth writing down.

---

## The diagnosis (2026-08-24)

Feedback on the combat screen was that the battlefield and the action-selection area
ran together visually. The first fix treated that literally — a stronger seam between
the two regions — and it did not help. The real problem was one level up.

The fight screen was a strict containment hierarchy of rectangles, and **every level
of the hierarchy was drawn with the same visual grammar**: rounded rect, `1px
--border`, gradient fill, drop shadow. Five levels deep between the screen edge and
any actual number:

```
app-shell → battlefield → team-row → combatant-card → status-badge
app-shell → action-area  → action-panel → move-grid → move-button → move-crystal
```

Of those, `battlefield`, `team-row`, `action-area`, `action-panel`, and `move-grid`
are **pure grouping — they carry no information at all**. Only the leaves do. So
roughly half the ink on screen was spent drawing containers that mean nothing, and
the eye had to peel containers to reach content.

That is why a better seam could not work. Making one meaningless box nicer does not
help when the complaint is that everything is a box. Two regions built from identical
material cannot be separated by degree; they have to be separated by *kind*.

### Two defects found while investigating

Both pre-existing, both fixed in the same pass:

1. **Every portrait in the game was at a broken scale.** Sources are 48×48 pixel art
   (`art/heroes/*.png`); the battlefield displayed them at 56px — a 1.167× scale.
   With `image-rendering: pixelated` that renders some source pixels 1px wide and
   their neighbours 2px, blurring the art's own grid. The bench was worse (20px, a
   0.4167× scale). **Display sizes must be integer multiples of 48** (or clean
   fractions: 24px is the one usable downscale).
2. **`transition: outline` on `.combatant-card` rendered a stuck white 3px ring**
   instead of the assigned color. `outline-style` is not an interpolable property, so
   Chrome animated width and color from their *initial* values (`medium`,
   `currentColor`). It was also hitting the bench hover outline. Outlines must not be
   transitioned.

A stale comment also claimed "most heroes have no art yet". Art coverage is in fact
**complete** — all 32 heroes and 6 enemies are mapped in `heroArt.ts` — which is what
made a portrait-forward battlefield viable at all.

---

## The rule

> **A rectangle means "you can act on this." Nothing else gets a box.**

Applied ruthlessly, this converts chrome from noise into signal. Its most useful
consequence is that the action console becomes the *only* boxed region on the fight
screen, which separates it from the battlefield by kind rather than by degree — the
thing a nicer seam could never do.

Its second consequence is better than the first: **targetability becomes the frame**.
A battlefield figure has no box at rest and grows one at the exact moment it becomes a
legal target. The rectangle *is* the affordance, rather than a permanent container
with a glow layered onto it.

### What the rule implies per region

| Region | Boxed? | Why |
|---|---|---|
| Battlefield | No | A place, not a container. Full-bleed scene. |
| Battlefield figure (at rest) | No | Not actionable. |
| Battlefield figure (targetable) | **Yes** | The frame is the affordance. |
| Action console | **Yes** | Everything in it is a control. |
| Bench / target picker cards | **Yes** | Those cards genuinely are buttons. |
| Move buttons | **Yes** | Controls. (Their *internal* sub-boxes are not — see below.) |

---

## What was implemented

All in `src/app/styles.css`, `src/view/combat/CombatantCard.tsx`, and one class rename
in `FightScreen.tsx`. **The engine was not touched**, which is the payoff of the
`architecture.md` separation: this was a large visual change with zero mechanical risk.

- **The arena is a scene.** `.battlefield` lost its border, radius and shadow, and
  bleeds to three screen edges. Vignetted floor, zone tints pulled to the edges where
  figures stand, and a horizon.
- **The horizon.** `.battlefield-divider` — formerly two gradient rules flanking a
  "VS" chip, i.e. a *divider between two panels* — became an edge-to-edge light band
  with atmospheric haze, doing the job a horizon does in a landscape. "VS" survives as
  a faint mark on the line.
- **Heroes are staged figures.** New `.combatant-stage` / `.combatant-platform`. Under
  `.team-row` the card box is gone entirely and each signal moved onto the figure:

  | Was | Is |
  |---|---|
  | Portrait, 56px in a card | 96px (clean 2×) on a type-tinted platform |
  | Name + types, 3 nested boxes | One pill |
  | HP/MP, bar + label below each | Numerals set *inside* the track |
  | Statuses, reserved-height row | Shoulder cluster, out of flow |
  | Stat mods, card corners | Rim ticks on the platform |
  | Acting, blue edge outline | The platform lights and pulses |
  | Targetable, glow on a box | A frame appears |
  | Damage popups, card top-left | Centred on the figure's chest, 17px |
  | Info, bordered circle button | Chromeless glyph; the figure is the tap target |

- **Depth without breaking the art.** The plan was to scale the enemy row down for a
  horizon effect, but 48px pixel art cannot take a fractional scale (see defect 1).
  Both rows render at a clean 2× and the **platform** carries the distance instead —
  enemy ground smaller, dimmer, tighter; ally ground wider and brighter.
- **Reclaimed space paid for the art.** Moving HP/MP numerals inside their tracks
  freed ~24px per card, which is most of what the 96px portrait cost.

### Scoping discipline

Every figure rule is scoped under `.team-row`. The bench and target pickers keep their
boxes, and `.combatant-platform` is `display: none` by default, turned on only for the
battlefield. Any future work here must preserve that scoping — `CombatantCard` renders
in four different contexts and only one of them is the battlefield.

---

## Verification standard

This pass was verified by measuring computed geometry and styles in the running app
across every phase (move-select, targeting, resolving, mid-fight KO), not by eye:
full-bleed offsets, exact portrait dimensions, label/track overlay, badge collision
boxes, empty-slot row height after a KO, and Field Effect state. `npm test` (200
engine tests) and `npm run build:view` both pass.

Two notes for whoever picks this up:

- **The production build needs Node 24.** The pinned runtime is at
  `.node-runtime/node-v24.19.0-win-x64/`; a system Node older than that fails on `??=`
  with a confusing unhandled-rejection warning rather than a clear version error.
- Nothing here has been checked on a real device yet. Everything above is geometry,
  not aesthetics.

---

## Open / future improvements

Roughly in order of expected payoff.

1. **Move-button internals.** The buttons themselves are correctly boxed (they're
   controls), but they still *contain* sub-boxes: `.move-crystal` (a mana orb) and
   `.move-power`. That's the same nesting problem one level down. The obvious next
   application of the rule — with the caveat that the crystal is a genuinely nice
   piece of visual design and flattening it may be a regression worth reverting.
2. **Phase-shift the whole screen.** The console and arena are active at different
   times. Planning: console hot and full, arena dimmed. Resolving: console collapses
   to a thin ticker, arena goes full-bleed and full-brightness. The beat stream
   already drives this — it is the natural payoff of the engine/presentation split,
   and it would make the split feel *authored* rather than merely clean.
3. **A persistent console shell.** `.action-area` currently holds four different
   panel variants (move grid, target panel, replacement picker, resolving banner),
   each with its own border. The chassis now stabilises the outer boundary, but the
   variants could be de-duplicated into one framed container with a fixed header.
4. **Numerals on busy backgrounds.** Without card boxes, HP/MP legibility rests on
   text shadows. This needs checking against the noisiest case — Field Effect active,
   multiple statuses, damage popup mid-flight, low-HP pulse — on a real device.
5. **Portrait scale.** 96px (2×) was chosen over 144px (3×) to fit the vertical
   budget. If the phase-shift work (2) frees arena height during planning, 3× becomes
   possible — but 48px sources at 3× will read as very chunky and should be eyeballed
   on one hero before committing the roster.
6. **Apply the rule outside combat.** The same nesting exists on the map, draft,
   roster, and shrine screens. The rule is general; only the combat screen has been
   converted.
7. **Ground-plane depth.** The platform currently carries distance via size and
   opacity. A true perspective floor grid (fading toward the horizon) would sell it
   further, at some risk of noise behind the figures.

## Non-goals

- **Diegetic framing** (the whole UI as a pact-stone or commander's slate) was
  considered and rejected: expensive, and it fights the at-a-glance parsing that
  doubles combat demands.
- **Accent color at region boundaries.** Separate with value and depth, not hue. The
  arena already carries per-hero type tints, ally/enemy zone gradients, and a
  full-battlefield tint while a Field Effect is up; a colored seam only adds noise.
