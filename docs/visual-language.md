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

## Second pass — Field Effects and move-button internals (2026-08-24)

Two follow-ups from playing the converted screen. Both are the same rule applied one
level further down, and the first one exposes a category of bug the rule doesn't catch
on its own.

### The Field Effect badge was the messiest object on the screen

Measured, not eyeballed. `.battlefield-divider .field-effect-badge` set no `font-size`,
so it inherited the **16px/400 root** — body copy, on a battlefield where the next
largest text is a 13px hero name and the horizon's own "VS" mark is 9px/800. That
rendered a **156 × 32px** slab, 42% of a 375px screen, right-pinned. Consequences:

- At 32px tall against a **13px** divider row it overhung ~9px into *both* team rows.
- Its left edge **overlapped the "VS" glyph by 3px** — two pieces of chrome literally
  colliding, which no amount of restyling either one would have fixed.
- `"Surging Magic · 4"` — a bare number with no unit, indistinguishable at a glance
  from a stack count, a tier, or a power value.

The lesson worth keeping: **the no-boxes rule governs whether a thing is drawn, not
what register it's drawn in.** This badge was legitimately boxed (it's long-pressable,
so the frame is the affordance) and still wrecked the composition, because nothing
checked that it belonged to the same type system as its surroundings. When adding an
element to the arena, match the register of what it sits on — the horizon is 9px/800
letterspaced, so anything living on the horizon is too.

### What replaced it

A **plaque on the horizon** rather than a badge stuck near it:

| Was | Is |
|---|---|
| Right-pinned, colliding with "VS" | Centred; "VS" fades out behind it |
| 16px/400 body copy | 9px/800/0.14em uppercase — the horizon's own register |
| 156 × 32px, overhanging ~9px into both rows | 159 × 22px, clearing both rows by 4.4px |
| `· 4`, a unitless number | A **5-pip track** — duration is a flat 5 rounds for every effect (`FIELD_EFFECT_DURATION_ROUNDS`, locked), so the denominator never changes and the player learns the shape of a full clock once |
| Flat `--panel` fill | Type-tinted glass + outer glow, tying it to the ambient treatment |
| Popped into existence | Arrival animation, remounted on effect change (keyed by `fieldEffectId`) so an override reads as a *new* field |
| Hold-only detail card | **Tap or hold** — standing rules that rewrite every move shouldn't be gated behind a gesture |

### And two beat-stream fixes, which were half the "clarity" problem

Presentation clarity wasn't only spatial. The beat stream was both too quiet at the
moment that mattered and too loud the rest of the time:

- **`FieldEffectSet` now carries the effect's rules text** in `bannerMeta` (with a new
  `bannerMetaClass`, so a rules sentence isn't styled in `.combat-banner-meta`'s mana
  blue and doesn't read as a cost). This is the one beat the player is guaranteed to
  see, so it's where "what does this do" belongs.
- **`FieldEffectTicked` is no longer its own beat.** It said `"Surging Magic holds
  (4 rounds left)"` — information the plaque already shows — and charged one mandatory
  tap per round, every round, for five rounds. It's now `carry`ed, so the event still
  applies and still reaches the event log via `formatEvents(beat.events, …)`; it just
  rides along on the next beat that has something to say.

### Move-button internals (open item 1, now done)

The old note said the buttons contained sub-boxes and that flattening the crystal might
be a regression. Measurement found it was worse than recorded — **three** sub-boxes, not
two: `.move-crystal` (26px filled orb), `.type-badge` (33 × 17 filled chip), and
`.move-kind-badge` (28 × 22 *bordered* chip). Three competing rectangles inside a 137px
content area that is itself inside a rectangle.

The resolution keeps the crystal and flattens everything around it — which is what makes
keeping it work. One orb on a clean face reads as a game object; an orb competing with
two chips read as clutter. And mana cost is the primary balance lever (CLAUDE.md), so it
earns the billing.

- **Type became the button's material, not a tag on it.** The 3px type-colored left
  border (a list-row marker idiom — it stops abruptly and leaves the button itself
  colorless) is gone. `--move-type-rgb` is set inline per move and drives a wash entering
  from the top-left plus a rim tinted to match, so the whole control is type-coded.
- `.type-badge` → `.move-type-code`, chromeless colored text. Color alone can't separate
  15 types, so the abbreviation stays — as text, not as a second colored rectangle under
  a colored button.
- `.move-kind-badge` loses its border and well *in this context only* (the rule is scoped
  to `.move-row-mid`; `.category-badge` is unchanged everywhere else). An emoji is already
  a self-contained shape. Freed of the frame it runs a size larger and reads better.
- Radius `--radius-sm` → `--radius-md`; the crystal gets a tighter specular highlight and
  a rim light matching the top-left source `--hairline` implies.
- `.selected` keeps the type wash underneath the amber at reduced strength — the button
  the player just picked shouldn't be the only one whose type they can no longer read.

**One regression this caused, and the fix.** Removing the two tallest chips left
`.move-row-mid` with nothing enforcing its height, so a buff/heal move (no BP readout)
came out 6.6px shorter than a damage move and the grid's two rows stepped against each
other. `min-height: 20px` now states it explicitly rather than depending on contents.
Buttons are back to exactly their original 76.5px, which also preserves the
move-panel/targeting-panel height match `padding: 9.7px` exists to maintain.

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

The second pass was verified the same way — plaque size/centring/row clearance, move
button footprints and per-move `--move-type-rgb`, sub-box computed backgrounds and
borders, no horizontal overflow, the arrival banner's meta text and class, the absence
of a per-round tick beat, and the tick still reaching the event log. `npm test` (200
engine tests), `npm run typecheck:view` and `npm run build:view` all pass. Two gaps to
know about:

- **Transitioned and animated properties can't be measured in a hidden browser pane.**
  With `document.visibilityState === 'hidden'` the animation timeline is frozen at 0, so
  `getComputedStyle` reports the *start* value of anything with a `transition` on it —
  even a value just set inline. The "VS" fade reads as `opacity: 1` there; the rule was
  confirmed instead against a synthetic element carrying the same classes, which resolves
  to `0`. Don't trust an animated computed value from a non-compositing pane.

  **This bit the plaque measurements themselves, which is worth spelling out.** The
  arrival keyframe starts at `scale(0.82)`, and a frozen timeline pins it there — so
  `getBoundingClientRect()` returned every plaque dimension multiplied by 0.82, and the
  figures first recorded here (135 × 18px, "36% of screen", 6.4px of row clearance) were
  all understated by that factor. The corrected numbers above come from setting
  `element.style.animation = 'none'` before measuring, and they change the story: the
  plaque is **not narrower** than the badge it replaced (159px vs 156px — a wash). What it
  actually won was height (32px → 22px), a centred position instead of a right-pinned one,
  no collision with "VS", and real clearance from both team rows where the old badge
  overhung them by ~9px. That is still the fix; it just isn't the width fix the first
  measurement claimed. **Kill the animation before measuring an animated element, or use
  `offsetWidth`/`offsetHeight`, which ignore transforms.**
- `MoveButtonReplica` (LevelUpScreen's move-replace offer) got the identical treatment and
  compiles and typechecks, but that screen only appears when a hero with four moves is
  offered a fifth, which the test squad doesn't reach. It has not been seen rendering.

### Getting to the states worth measuring

Two title-screen shortcuts exist so UI work doesn't have to be played to:

- **🧪 Test: Status FX** (`src/run/statusTestFight.ts`) — 9999 HP and 999 mana on all
  eight combatants, and a movepool made of nothing but status moves, derived from
  `src/data/moves.ts` rather than a hand-kept list. Nothing faints, nothing has to
  Rest, and four statuses stack on one figure within a few rounds. This is the fixture
  for the status badge cluster, tick flashes, and popup collisions.
- **🧪 Test: Lv4 Squad** — a roster one Training Point short of Evolution.

Both are marked `temp` in the UI and each carries its own removal note.

One trap when driving the app through the Browser pane: `initUiScale` (`src/app/uiScale.ts`)
measures the visual viewport **once on mount** and only re-runs on `resize`. Mounting into a
hidden pane reports a 0×0 viewport, so the shell renders `width: 0; height: 0` and every
layout measurement taken afterwards is garbage. Dispatch a `resize` event before measuring.

---

## Open / future improvements

Roughly in order of expected payoff.

1. ~~**Move-button internals.**~~ Done in the second pass above.
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
8. **A register audit for the arena.** The Field Effect badge inherited a 16px root
   font simply because nobody set one, and no check would have caught it. Everything
   drawn on the battlefield now falls into one of three registers — 9px/800
   letterspaced (horizon marks), 11–13px/700 (figure labels), 17px (damage popups) —
   and it's worth asserting that in the verification sweep rather than rediscovering
   the next violation by looking at it.
9. **Field-effect moves aren't identifiable in the move grid.** `Arcane Surge` renders
   with the generic 🛡️ buff glyph and no BP, so nothing distinguishes "this rewrites
   the battlefield for 5 rounds" from an ordinary self-buff until it resolves. Wants a
   distinct kind glyph, which is a `MoveKindBadge`/content-schema question, not a
   styling one — `KIND_EMOJI` is keyed on `move.kind`, and there is no `fieldEffect`
   kind today.

## Non-goals

- **Diegetic framing** (the whole UI as a pact-stone or commander's slate) was
  considered and rejected: expensive, and it fights the at-a-glance parsing that
  doubles combat demands.
- **Accent color at region boundaries.** Separate with value and depth, not hue. The
  arena already carries per-hero type tints, ally/enemy zone gradients, and a
  full-battlefield tint while a Field Effect is up; a colored seam only adds noise.
