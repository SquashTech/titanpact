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

## Third pass — the start-of-run draft (2026-08-25)

The first application of the rule **outside combat** (open item 6), on the screen
where it matters most: the draft is a player's first real contact with the game's
content, and it read as a form.

### What was wrong, measured

`DraftScreen` was a 227px flavor banner (a box) above a bordered `.squad-section` (a
box) holding a 2×2 `.roster-grid` of four 158 × 112px `.roster-card`s (boxes) — the
same concentric-rectangle hierarchy the fight screen was converted away from, on a
screen with only four objects on it. Two defects underneath the styling:

1. **The sprite was at a broken scale — the exact defect this doc exists to forbid.**
   `.roster-card-portrait` drew 48px sources at **40px**, a 0.833× downscale. The
   game's opening image was its blurriest. (Defect 1 of the first pass named 24px as
   the *one* usable fraction of 48; 40px is not one of them.)
2. **The boxes weren't just ugly, they were empty.** A card carried a name and two
   type chips. Stats and movepool sat behind an info button, so the player either
   picked blind or opened four overlays to make one choice. This is what "clicking on
   boxes" actually describes, and no amount of restyling the card would have fixed it
   — the complaint was about what the card *contained*.

Note the shape of that second finding: it's the same category as the second pass's
Field Effect badge. The rule governs whether a thing is drawn, not whether the thing
is worth drawing. Both times, applying it well required a second question the rule
doesn't ask on its own.

### What replaced it

A **stage**, not a grid. One candidate stands at a time; the others wait in the dark.

| Was | Is |
|---|---|
| Four 158 × 112 cards | One figure on stage, three in a rail |
| Portrait 40px (0.833×, blurry) | **144px — a clean 3×** |
| 227px banner of prose | 110px header: eyebrow, wordmark, one line |
| "Choose Your Allies (1/2)" in a section heading | Two **sockets** that fill with the bound hero's own 24px sprite |
| Name + two type chips | Name, types, a 6-bar **stat silhouette**, and the starting kit |
| Card border = the object | Chromeless figures; the frame appears on the one on stage |
| Selection = tinting a card | A commit button that binds, and a rail seal |

Three things on the screen are boxed, and all three are pressable: the commit button,
the candidate currently on stage, and the CTA. Everything else — figure, sigil,
platform, stat bars, move list, sockets — is drawn without a container.

Details worth keeping:

- **3× is affordable here and only here.** Open item 5 wanted to try 144px and
  couldn't, because the battlefield holds four figures inside a fixed-height arena.
  The draft holds exactly one, so it gets the scale the art deserves. This is not a
  precedent for the arena.
- **The stat silhouette shares StatBars' ceilings, deliberately.** `statFraction()`
  was extracted from `StatBars.tsx` rather than re-deriving maxima locally, so a bar
  means the same length here as on the hero sheet. Six stats, not eight: Mana Pool
  and MP Regen are the separate tempo axis (CLAUDE.md), and the point of the strip is
  *cross-candidate comparison* — six bars is a silhouette, eight is a spec sheet.
- **The kit is the move buttons with their boxes taken off.** Same mana crystal at
  half scale (a bare unitless number is the fault the Field Effect plaque was rebuilt
  for), and the type carried as the name's own color — the same "type is the
  material, not a tag on it" move `.move-type-code` made.
- **The screen's hue does not follow the featured hero.** The type color lives in the
  figure's own bloom, platform, sigil and commit button. Tinting the full-screen wash
  as well would strobe on every rail tap; the wash stays the pact's constant
  gold/violet. The motes *do* take the type color — at 2–4px the swap is invisible.
- **Two taps per pick** (feature on the rail, commit on the stage) is deliberate. This
  is the most consequential decision in a run; the ceremony is the point.

### Scoping discipline

Every rule is scoped under a `.draft-*` class, and the old `.draft-banner*` block was
deleted outright. `.roster-card` and `.roster-grid` are untouched — `SquadSelectScreen`
and the reward nodes still use them, and **`.roster-card-portrait` still carries the
0.833× scale defect there**. That is a real, known bug on a screen the player sees
before every fight; it was left alone because fixing it changes that screen's card
height and its layout budget is already tight (see the `.enemy-scout-grid` comment).
It belongs in its own pass, with its own measurements.

---

## Fourth pass — the level-up screen (2026-08-26)

The second screen outside combat (open item 6), and the one the player sees most often:
it runs after **every** fight win.

### What was wrong, measured

`LevelUpScreen` was three stacked boxes above one grid of buttons:

1. `.levelup-banner` — bordered, glowing, 150px tall. Carries no action.
2. `.levelup-xp-card` — bordered, gold-glowing, **inside** the banner. Also no action; it
   held a numeral.
3. `.levelup-feedback` — bordered, and rendered **unconditionally**, reserving its own
   height for the placeholder sentence "Spend XP to learn new moves and evolve!" while
   nothing had happened yet.

Three concentric/stacked containers introducing one region that was actually pressable.
Same shape as the fight screen and the draft, one screen further along. And underneath
them, the same two defects both earlier passes found:

1. **The sprite was at a broken scale.** `.hero-grid-portrait` drew the 48px sources at
   **30px** — a 0.625× downscale, not one of the two legal sizes (48, 24). Blurrier than
   the draft's 40px was.
2. **The cards were empty of the decision.** A card carried a name, `Lv N`, two type chips
   and the string "Tap to level up". Nothing about *what the point buys* — which is the
   entire question the screen asks. Whether a hero was one level from its Evolution,
   whether its movepool was exhausted, whether it was at the four-move cap so the level-up
   would open a swap: all of it was invisible, so the player either opened six overlays or
   picked at random. This is the third time in a row that applying the rule well required
   the second question the rule doesn't ask.

### What replaced it

| Was | Is |
|---|---|
| Banner box + XP card box + feedback box | Unboxed header on a full-bleed `.levelup-sky` |
| The pool as a numeral in a bordered card | A **depleting orb track** — one orb goes out per point spent |
| Feedback strip, permanently drawn, prose placeholder | One unboxed readout line, height still reserved by `min-height` |
| Portrait 30px (0.625×, blurry) | **48px (1×) at three columns, 96px (2×) at two** |
| 3px type-coloured left border + two filled type chips | Type is the card's **material** (wash + tinted rim) with chromeless type codes |
| `Lv N` as a bordered chip beside the name | A corner mark on the figure, unit set smaller than the numeral |
| Nothing about the payoff | A **rank track** toward the Evolution + a one-line **payoff** label |
| A 5px progress bar pinned to the card's bottom edge | Gold **rising through the card** over the same 550ms |

Two things on this screen are boxed, and both are pressable: the hero card and Continue.
Figure, ground, name, type codes, rank track, payoff line, orbs, header and readout are
all drawn without a container.

Details worth keeping:

- **The rank track is the pass's real content win.** Pips to the pending Evolution's
  trigger level, filled to the hero's current level, last pip drawn as a diamond. Same
  fixed-denominator idiom as the Field Effect plaque's duration clock and the draft's pact
  sockets — learned once, then read at a glance across six heroes. It needed one engine-side
  addition: `pendingEvolution()` in `src/run/progression.ts`, split out of
  `availableEvolution()`. The existing function is a *gate* ("may this hero evolve now"),
  and a progress track needs the other question ("where is this hero headed"). A
  post-Evolution hero has no pending node, so its track becomes its chosen path's name.
- **The payoff line makes the choice legible.** `Evolve!` / `Evolve next` / `New move` /
  `Move swap` / `Level only`, coloured so the roster sorts itself by eye. It stays visible
  with an empty pool: the locked card already says "you can't act on this", and six
  repetitions of "No XP" would replace the card's only information with a fact the header
  states once.
- **Two columns up to four heroes, three at five or six.** Not a cosmetic breakpoint — it
  is what keeps the portrait on a clean multiple of 48 at either width. An early-run pair
  gets 2× figures; a full roster gets a grid that fits without scrolling.
- **Only the portrait size is authored per column count.** The figure box (1.25× the
  portrait, with 0.125× of floor room below it) and the ground ellipse (0.9× wide, 0.19×
  tall, centred 0.03× above the sprite's base — proportions taken from
  `.draft-figure::after`) are derived from it, so the two layouts are one composition at
  two scales rather than two hand-tuned ones.
- **The sky is gold alone**, where the draft's is the pact's gold/violet: the draft is a
  bargain being struck, this screen is purely the reward for winning. The motes are gold
  too rather than type-tinted — six figures are on screen, and six colours in the air would
  fight the six type-washed cards in front of them.
- **The stacking trap `.draft-cta` documents bit again**, exactly as written down: a
  `z-index`-carrying full-bleed sky paints over anything left static, so `.resolve-button`
  and the offer's `.screen-scroll` needed `position: relative; z-index: 1`. Third screen,
  third time. It is worth reaching for that pair whenever a `-sky` goes in.

### Scoping discipline

Every rule is scoped under `.levelup-*` or `.growth-*`. **`.hero-grid` is untouched** —
`ForceEquipScreen`, `StatBoostScreen`, `ClassNodeScreen` and `RosterReplaceScreen` still
use it, and `.hero-grid-portrait` **still carries the 30px 0.625× defect there**, the same
way `.roster-card-portrait` was left carrying 0.833× after the draft pass. Both are real,
known bugs on screens the player sees, and both belong in their own pass with their own
measurements. What *was* removed from that block is only what LevelUpScreen alone used:
`.hero-grid-card-evolving`, `-leveling`, `.hero-grid-levelup-bar{,-fill}`, the
`hero-grid-levelup-fill` keyframes, and the orphaned `.hero-grid-card-disabled` selectors.
`.training-hero-portrait` (32px, 0.667×) is likewise left alone — it is
`SandboxBattleScreen`'s now; the move-replace offer took a new `.offer-hero-portrait` at a
clean 48px instead.

### Verification

Driven through every state in the running app and measured, not eyeballed. Both fixtures:
🧪 Test: Lv4 Squad for the six-hero/three-column case, and a real run from the draft for
the two-hero/two-column one.

- Geometry: portrait exactly **48.0px** at three columns and **96.0px** at two — the
  scales this doc requires. Ground ellipse 0.9×/0.19× the portrait, centred **3.0%** above
  the sprite's base at both sizes (the draft's is 2.8%).
- Layout: nothing scrolls at 375×812, 375×667 or 360×600; Continue on screen at all three;
  no horizontal overflow anywhere; no payoff label or hero name clipped in a 100px card.
- Flow: level-up → charge animation → move grant → readout; level-up → Evolution →
  `EvolutionScreen` → path chosen → back with the track replaced by the path name; and the
  four-move-cap path all the way through the **move-replace offer**, which this doc
  previously recorded as never having been seen rendering. It fits its scroll area with
  0px of overflow.
- No console errors. `npm test` (200 engine tests), `npm run typecheck:view` and
  `npm run build:view` all pass.

Two caveats, both the documented hazards rather than new ones:

- **The frozen-timeline trap, a third time.** `.growth-charge` starts at `scaleY(0)`, and
  in a non-compositing pane `getBoundingClientRect()` duly reported its height as **0**.
  The rule was confirmed instead from its computed `animation-name`/`duration`/
  `transform-origin`. Likewise the diamond pip's resting `rotate(45deg)` and the
  `.is-evolving` card's fill were read off synthetic probe elements with
  `style.animation = 'none'`.
- **Nothing here has been seen rendering.** The Browser pane was not displayed for this
  session, so screenshots were unavailable and every figure above is geometry. The
  composition has not been looked at — including whether 2× figures at two columns are the
  right weight next to a 25px heading.

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
  **Resolved in the fourth pass** — reaching it needs a real run rather than a fixture
  (win the opening fight, spend the point, win the Skirmish, spend a point on the hero
  that just hit four moves), and driven that way the panel measures 577px inside a 661px
  scroll area with 0px of overflow.

The third pass was verified the same way, driving the screen through every state:
figure/portrait geometry (`.draft-portrait` computed 144px — exactly 3×), stage
content height against available height at three viewports, feature-switch,
commit/release, pact-full with an unchosen hero on stage, socket fill, CTA
enable, the info overlay, and `onConfirm` actually reaching the map screen. No
horizontal overflow at any size. At 375×812 and 375×667 nothing scrolls; at a
deliberately undersized 360×560 the stage scrolls internally and the rail and CTA
stay on screen, which is what its `overflow-y` is there for. `npm test` (200 engine
tests), `npm run typecheck:view` and `npm run build:view` all pass.

Two caveats on this pass specifically:

- **The frozen-timeline trap from the second pass bit again, and confirmed itself.**
  `.draft-figure`'s arrival keyframe starts at `scale(0.94)`, so every rect it and
  `.draft-portrait` reported was multiplied by 0.94 — the portrait measured 149.3
  device px where 158.8 was expected, and 149.3 / 158.8 is exactly 0.94. `transform`
  doesn't affect layout, so the *stack* was unaffected; only the reported rects were.
  Separately, `.draft-choose:disabled` read back with its gold glow still on because
  `box-shadow` is transitioned; a synthetic probe element carrying the same classes
  resolved it to `none`, correctly. Both are the documented hazard, not new bugs.
- **Nothing here has been seen rendering.** The Browser pane was not displayed for
  this session, so screenshots were unavailable and every figure above is geometry.
  The composition — 3× sprite scale in particular — has not been looked at.

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
5. **Portrait scale.** 96px (2×) was chosen over 144px (3×) to fit the arena's
   vertical budget, and that still stands for the battlefield. 3× now ships on the
   draft screen (third pass), where exactly one figure is on stage — so the scale has
   been *built* but still hasn't been **eyeballed on a real device**, which was the
   actual condition. Look at it there before considering it for the arena.
6. **Apply the rule outside combat.** ~~Draft~~ (third pass) and ~~level-up~~ (fourth)
   are done. Still outstanding: the **map, roster, and shrine** screens, which keep the
   same nesting. Both finished passes are worked examples — and note that in both, as
   on the Field Effect badge, the win came as much from asking what the boxes
   *contained* as from removing them. That question is now 3 for 3; treat it as part of
   the procedure rather than an extra.
   - **Two portraits are still at broken scales, knowingly.**
     `.roster-card-portrait` is 40px (0.833×) on `SquadSelectScreen` and the reward
     nodes; `.hero-grid-portrait` is 30px (0.625×) on `ForceEquipScreen`,
     `StatBoostScreen`, `ClassNodeScreen` and `RosterReplaceScreen`. Each was left
     alone because fixing it changes that card's height and those screens' layout
     budgets are tight. They are the first thing to fix when those screens come up.
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
