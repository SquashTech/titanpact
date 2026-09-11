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
`ItemFoundScreen`, `StatBoostScreen`, `ClassNodeScreen` and `RosterReplaceScreen` still
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

## Fifth pass — the action console (2026-08-26)

Open item 3 ("a persistent console shell"), closed. Triggered by the plainest
possible report: *about an eighth of the screen is gray space at the bottom,
between the moves and the Back/Switch/Log/Ref/Menu row.*

### What was wrong, measured

`.action-area` is a chassis of fixed height — **316.6px** at 375×812 — holding
**four** panel variants, each `flex-shrink: 0` and sized to its own contents:

| Console state | Panel height | Bare console face below it | % of screen |
|---|---|---|---|
| Move select (3 moves) | 194.8px | **108.9px** | 13.4% |
| Targeting | 145.7px | **157.9px** | 19.4% |
| Round resolving | 80.4px | **226.4px** | 27.9% |

So the report understated it twice over. The gray is three different sizes,
and — worse than the gray itself — **the panel's bottom edge moves by up to
114px at every step of a single turn**. A console that breathes in and out
between picking a move, picking a target, and watching the round is what reads
as unpolished; the empty band is only the most visible symptom.

Two defects underneath, and they are the same two every pass has found:

1. **A hole in the grid, at the common case.** `.move-grid` was 2-column. At 3
   moves the fourth cell was empty — a measured **161.5 × 69.4px** gap. With
   `MOVE_CAP = 4` and starting kits now uniformly 3, that hole was not the edge
   case, it was the default.
2. **The buttons were empty of the decision.** A move button carried name,
   type, mana cost and BP. Not what the move *does* — a buff read as a name and
   a glyph — and not how it fares against the enemies actually standing there.
   Both were behind a **500ms long-press, per move, per turn, for the whole
   run**, in a doubles game where type matchup is the single most consequential
   fact on screen. This is the fourth pass in a row where applying the no-boxes
   rule well required the second question the rule doesn't ask. It is now 4 for
   4; the doc already says to treat it as part of the procedure.

### What replaced it

| Was | Is |
|---|---|
| Four variants sizing themselves inside a fixed chassis | One shell: `.action-panel` is `flex: 1 1 auto`, so the outer boundary is **constant for the whole fight** and only the contents change |
| 2-col `.move-grid`, one empty cell at 3 moves | 1-col `.move-list`, `grid-auto-rows: 1fr` — fills exactly at **any** move count |
| Name / type / cost / BP, effect behind a hold | A second line per row: **live per-enemy effectiveness** for attacks, `moveEffectSummary()` for everything else |
| Meta on its own `.move-row-mid` line | Meta rides the name's line — full row width made room, which is what freed the second line |
| 82px banner, 226px of bare face under it | Banner fills, carrying a **beat trail** of the round so far |
| Target cards 98.7px, 157.9px of gray below | Target cards **248.6px**, portrait at a clean **2×** |
| Target cards `compact` — portrait, name, type | HP/MP back on them, in the battlefield's own numerals-inside-the-track register |

Details worth keeping:

- **`grid-auto-rows: 1fr` is what actually closes the ask.** Rows come out at
  79.9px for 3 moves and 58.4px for 4, and in both cases the list's
  `scrollHeight` equals its `clientHeight` — the fill is exact, not approximate,
  and it stays exact if a hero ever holds a different number.
- **A single column is not a cosmetic choice.** 3 moves in 2 columns leaves a
  hole no styling can fill; one column has no parity to get wrong. The width it
  buys is the other half — the effect line only fits because the row is 329px.
- **The effectiveness readout is chromeless, deliberately.** The second pass
  took three sub-boxes out of this button. An `.eff-chip` — which has a fill and
  a ring — would have put the first one straight back, so the tier reads as
  colored text, and the 4×/0.25× escalation as a glow on the numeral rather
  than the filled tint `.eff-chip` uses. Same two-step hierarchy, no rectangle.
- **The beat trail only ever lists *revealed* beats.** The queue holds the rest
  of the round, already resolved by the engine; rendering that would hand the
  player the enemy's turn before it happens. Newest-first, so the freshest
  history sits under the beat it followed and old lines fall off the bottom
  instead of pushing the current beat down.
- **The current beat and its trail centre as one group.** Top-aligning them
  would put a single sentence at the ceiling of a 295px box on every round's
  first beat — trading bare console face for the same emptiness with a gold
  border drawn around it. `.combat-banner-hint` is absolute so its height never
  enters that centring, and `.beat-trail` is `flex: 0 1 auto` so it takes only
  what its lines need.
- **`banner-pop` now fires per beat, not per round.** The banner was one
  persistent element whose text swapped; `.combat-banner-current` is keyed on
  the trail's length, so each beat remounts it and replays the arrival.
- **2× on the target picker is not a precedent for the arena.** Open item 5 is
  about the battlefield, which holds four figures in a fixed-height scene and is
  unchanged. This is the picker: two figures, and a panel that now has 248.6px
  of card where it had 98.7px. Committing a move to a target is the last
  irreversible tap of a turn and the hero being committed against was a 48px
  thumbnail.
- **Dropping `compact` on the target picker is the same finding as the move
  button's.** It was the right call at 98.7px — HP/MP/statuses are on the
  battlefield cards above, and repeating them bloated a box with no room. At
  248.6px the trade inverts: the question being asked is *which of these two do
  I hit*, and how much HP one has left and what it is already suffering are the
  two facts that answer it. Redundancy costs nothing against empty space.
- **Those bars share `.team-row`'s treatment, not the base one.** Numerals
  inside the track, not stacked labels beneath it. They sit a few centimetres
  below the battlefield's bars showing the same two numbers for the same
  heroes; two registers that close together read as two different readouts.
  Same lesson as the Field Effect badge, applied across a panel boundary
  instead of within one.
- **The power readout is a column, not a chip.** `.move-list .move-power` has a
  `min-width` and a placeholder (`.move-power-empty`) on buff moves, because
  without one the type code lands at one x on rows with a BP/HEAL value and
  another on rows without, and a 3–4 row list rags visibly between them.
- **Scoping discipline.** `.move-grid` is untouched and still 2-column —
  `LevelUpScreen`'s move-replace offer (`.reward-panel .move-grid`,
  `MoveButtonReplica`) uses it, sits in a scrolling column, and has no chassis
  to fill. Likewise the fill rules for `.bench-row` are scoped under
  `.target-panel`, so the switch-in picker's overlay copy is unaffected
  (verified: its cards still compute `display: block`).

### Verification

Driven and measured in the running app at 375×812, per the standard below.

- **Fill.** Panel bottom 744 against a bottom-bar top of 752 in *every* state —
  move select, targeting, forced replacement, resolving. The 8px is
  `.action-area`'s own `padding-bottom`. The 108.9 / 157.9 / 226.4px bands are
  gone and the panel's edges no longer move between steps.
- **Move counts.** 3 → 79.9px rows; 4 (synthetic 4th row injected into the live
  grid) → 58.4px rows, `scrollHeight === clientHeight` at both.
- **Row interior.** Effect line starts at x=66, exactly under `.move-name`, and
  reserves 15.0px whether it holds effectiveness chips or a summary sentence —
  the two must match or the grid's rows step against each other, the defect
  `.move-row-mid`'s `min-height` was originally added for.
- **Beat trail.** 11 lines fit 180px without scrolling; banner held at 295.6px
  throughout; group stays centred as it grows.
- **Forced replacement.** Panel 295.6px, bench row 198.6px, Confirm 43px and
  unstretched.
- **Rest fallback.** Synthetic probe (it needs a hero with no affordable move;
  25 driven rounds of Quick Battle never drained one). Fills the list at
  251.6px, centred to within 0.5px, indent correctly neutralised, text not
  clipped.
- **Target picker.** Card 248.6px, portrait exactly **96.0px** (2× of the 48px
  source — the scale this doc requires), `.bar-label` computing `position:
  absolute`, i.e. inside the track as intended.
- **Power column.** Type codes land within 3.1px of each other across a 4-move
  list (249.2–252.3), the residue being the glyph widths of FRS/LIT/SPI rather
  than the layout.
- No horizontal overflow at any point (`documentElement.scrollWidth === 375`).
  No console errors. `npm test` (203 engine tests), `npm run typecheck:view` and
  `npm run build:view` all pass.

Three things to know:

- **`1fr` is `minmax(auto, 1fr)`, so rows have a floor** — measured at 56px for
  a two-line row. At `MOVE_CAP` the tracks land at 58.4px, clearing it by only
  2.4px, and the 🧪 Status FX fixture's 7-move movepool blows straight through
  it (428px of rows in a 252px list) and drew over the panel's own border.
  `.move-list` now scrolls internally as a backstop. It does not engage at 3 or
  4 moves.
- **At 375×667 the move list scrolls**, because the console is only 171.6px
  there — the battlefield is a content-sized 441.4px regardless of viewport, i.e.
  66% of a 667px screen. This is not a regression (the old panel was 194.8px in
  the same 171.6px area, so `.action-area` scrolled instead); the scroll just
  moved one level in, which keeps the header pinned and the chassis intact.
  Making the arena height-responsive is the actual fix and belongs with open
  item 2.
- **This one was actually looked at** — the first pass in four where the Browser
  pane composited, so move-select, targeting and mid-round playback were all
  seen rendering rather than only measured. Three things the geometry did not
  catch and the screenshots did: the ragged type-code column (fixed, above), a
  target card that read as sparse until HP/MP went back on it (fixed, above),
  and the stacked bar labels that gave the picker a different register from the
  battlefield directly above it (fixed, above). **Still not seen on a real
  device** — every figure is a 375×812 emulated viewport.

---

## Sixth pass — the console as a place (2026-08-26)

Same day as the fifth, and its direct sequel. The fifth pass made the console
*fill*; the note back was that it still read as **zones** — "less boxyness of the
UI where it feels like everything is split into different zones, more of a
cohesive interface" — with the draft screen (third pass) named as the bar.

### What was wrong, measured

The first pass's own diagnosis, still live on the half of the screen it never
reached. Computed styles at 375×812, walking down from the shell:

| | border | radius | fill | shadow |
|---|---|---|---|---|
| `.app-shell` | — | — | — | — |
| `.action-area` | 1px `--border-strong` | 15px | gradient | yes |
| `.action-panel` | 1px `--border` | 11px | gradient | yes |
| `.move-button` | 1px tinted | 11px | gradient | yes |

**Three concentric rounded rectangles drawn in the identical grammar**, which is
verbatim the defect at the top of this document. The first pass removed
`battlefield`, `team-row` and `combatant-card` and installed `.action-area` as a
deliberate chassis — "the only boxed region on the fight screen" — and that was
right at the time and one step too far in the end. It made the console an
*object sitting under* the arena, and left the two containers inside it standing.
Of the five containers the first pass named as "pure grouping, carrying no
information at all", **two were still boxed.**

And the thing the boxes contained was, a fourth time, the actual problem:

1. **The header was a form label.** `Select Aegis' Move:` in glowing 12px body
   copy plus `Long-press for info`. It named a hero the arena was already
   lighting, in a register nothing else on the screen uses, and said nothing
   about the only thing the player genuinely could not see — that a doubles turn
   is **two** decisions, which one they were on, and what was already locked in
   for the other.
2. **Nothing below the horizon was alive.** The title screen, the draft and the
   level-up screen all carry a drifting ember field; the arena has the Field
   Effect sweep and the acting platform's pulse. The console had no ambient layer
   at all, which is half of why it read as a control panel bolted under a picture.

### The rule this pass adds

> **Separate regions by depth, not by edge.**

The first pass's finding was that two regions built from identical material
cannot be separated by degree — they have to be separated by *kind*. True, and
a drawn edge is not the only way to do it. A photograph separates foreground
from background with **light and focus**, and gets a single continuous space
instead of two stacked slabs:

```
far   = the arena.   Cool, hazy, vignetted, small figures, a horizon.
near  = the console. Warmer, sharper, larger elements, lit from the
        player's own side — and lit specifically by whoever is commanding it.
```

So the console's gradient now runs the **opposite way to a card's**: darkest at
the seam where the arena's floor tips away, warming toward the bottom edge where
the ground is closest to the viewer. A card is lighter at its top edge because
light falls on it from above. Ground is lighter near you because you are standing
on it. Same value range, opposite reading — and the console stops being an object.

### What replaced it

| Was | Is |
|---|---|
| `.action-area` a raised chassis: border, 15px radius, drop shadow | Near ground. No border, no radius, no shadow — an inverted gradient and an inset darkening at the seam |
| `.action-panel` a bordered, rounded, shadowed card inside it | **Unboxed.** Pure grouping, nothing in it pressable; it never had a claim to a rectangle |
| A panel edge between arena and console | A **seam of light** — a 1px hairline in the commander's own color, brightest directly beneath them, fading to nothing at both ends |
| Three or four raised move tiles with 6px gutters | **Facets of one surface**: full-bleed, zero gap, divided by a single scored hairline |
| Type as a rim drawn around each tile | Type as **light in the facet's leading wall** — a white-hot core blooming in the domain color, running off the screen edge |
| Five raised chips in the bottom bar | The same keys, **set into** the same ground |
| `Select Aegis' Move:` + `Long-press for info` | The **command crest**: one socket per active hero, the commander lit in their domain, a committed hero wearing the mana crystal of the move it holds |
| A second, differently-styled header for targeting | The **same crest**, one step later, its trailing label becoming the move being aimed |
| The beat banner: a gold-bordered, glowing panel around unpressable text | Unboxed. The round's gold pools on the ground and the beat stands in it |
| Nothing moving below the horizon | Nine embers rising, tinted to the commander |

Details worth keeping:

- **The console is lit by whoever is commanding it, in their color and from
  their position.** `--console-rgb` takes the acting hero's primary effective
  type; `--console-origin` slides the light source to 27% or 73% to sit under
  whichever half of the ally row holds it. This is the whole join — a light has
  a position, and putting the console's at the foot of the figure that owns it
  makes arena floor and console one continuous lit surface. It is also
  read-at-a-glance information (which side you are commanding from, whose turn
  it is) delivered without a word of UI.
- **This inverts a written non-goal, deliberately.** "Accent color at region
  boundaries" is listed below as something to avoid — but that entry is about
  *separating* two regions with hue, and this fuses them. It also changes exactly
  as often as it should: **twice a turn**, at the moment command passes. The
  draft's rejected version would have re-tinted on every rail tap, which is the
  strobe that non-goal is really about.
- **The domain light needed a white-hot core.** Seven of the fifteen types are
  low-chroma (Iron `#9aa3ad`, Stone `#a89468`, Ancient `#8a9c5e`), and a flat 3px
  bar of raw type color at the screen's edge is not a light source, it is a
  scratch. A white core with the domain color as its bloom is how a real emitter
  reads, and it brings Iron through as *cool white light* rather than as nothing.
  Verified against Stone and Iron specifically, which is where the first attempt
  failed.
- **The pressable things kept their rectangles; the rectangles turned inward.**
  Move rows and console keys are still boxed — they are controls, and the rule
  stands. What changed is which way the box faces. Raised (lit top edge, drop
  shadow, lighter fill) makes separate objects scattered on a tray. Inset (dark
  rim above, lit lip below, filled darker than the ground) makes one surface with
  grooves cut into it. Same count of rectangles, one object instead of four.
- **Committed reads as loaded, not as spent.** The selected facet fills with gold
  and its leading light goes full, but stays inset — a choice that popped up out
  of the surface would read as already resolved, and the player can still back
  out of it.
- **The beat banner had to go too, and by the rule it always did.** It is not
  pressable — `.advance-overlay` covers the whole screen and takes the taps, and
  the banner has never had a handler — so it never had a claim to a rectangle.
  Once the move rows became facets it was the last card left in the tray, and
  while a round played out the screen went straight back to looking like the
  thing this pass is undoing.
- **The crest is the same fixed-denominator idiom** as the draft's pact sockets,
  the Field Effect plaque's 5-pip duration clock and the level-up screen's rank
  track: a shape whose full form is learned once and then read at a glance.
  Fourth use, and the first one that carries a *sequence* rather than a count.
- **The entrance animation is capped hard.** Command passes twice a turn, every
  turn, for a run — so the rows stagger in over 290ms total and start at opacity
  **0.4**, not 0. An entrance that starts transparent makes the move list
  unreadable for its whole duration, on the one control the player is waiting to
  press. The `--dur-fast`/`--dur-mid` header note already says polish must never
  cost perceived responsiveness; `--dur-slow` (420ms) was added for ambient
  transitions only — a light changing color, never a control answering a press.
- **Filling a chassis is not the same as filling a card.** The fifth pass let the
  forced-replacement panel's bench cards grow like the target picker's, and with a
  single candidate that produced a 351 x 200px rectangle holding a 24px sprite —
  the panel filled and looked *emptier* than when it had a gap beneath it. Capped
  at 168px and centred, so one candidate is the size either of two would be, with
  the portrait at 2x and the bars in the shared in-track register. Its heading is
  the one console header that is not the crest (the hero whose slot it fills has
  just been knocked out, so there is no commander to socket) but it moves into the
  crest's register anyway — the console must not change type systems depending on
  how the turn is going.
- **Ambient at half the draft's strength.** Nine embers, not sixteen, at 0.45
  opacity: this field is a third of the height and passes behind move names and
  damage numbers being read against a clock, not behind a figure being admired.

### Verification

Driven through every console state in the running app and measured.

- **The rule, asserted rather than eyeballed.** Walking every element inside
  `.action-area` and collecting those with a real top border: **move select →
  zero**. Targeting → `combatant-card` only, which is exactly right (the frame
  *is* the affordance). Resolving → `beat-trail` only, which is its scored
  separator, not a box.
- **Fill survived the fifth pass intact.** Panel 447.4 → 744 against a
  bottom-bar top of 752 in every state; `.action-area` `scrollHeight ===
  clientHeight`; no horizontal overflow (`documentElement.scrollWidth === 375`).
- **The light tracks command.** Water `74, 144, 217` at origin `27%` (ally slot
  0) → Frost `127, 214, 224` at `73%` (slot 1) → gold `224, 166, 60` at `50%`
  while resolving. Crest sockets follow: the hero that just committed keeps full
  color and gains its move's mana crystal.
- **Forced replacement.** Panel 296.6px, card 168 x 223.6px, portrait exactly
  96.0px, bar labels computing position: absolute (in-track).
- **Facets tile exactly.** Three rows at 85.5px, each spanning 0 → 375 (full
  bleed past the shell's 12px padding), `scrollHeight === clientHeight`.
- `npm test` (203 engine tests), `npm run typecheck:view` and `npm run
  build:view` all pass. No console errors. Dead CSS removed with the markup it
  belonged to (`.move-panel-header/-title/-hint`, its glow keyframe,
  `.target-panel-move-meta/-name`); `.target-panel-header/-title` stay, since the
  forced-replacement panel still uses them.

Two caveats:

- **Seen rendering, at one size.** Move select for four different domains (Stone,
  Iron, Fire, Frost, Water — the low-chroma cases picked on purpose), targeting,
  command passing between the two heroes, and mid-round playback. All at an
  emulated 375×812. **Not seen on a real device**, and the seam light in
  particular is a 1px feature at 20-90% alpha — the thing most likely to read
  differently on real glass.
- **375×667 still scrolls the move list**, unchanged from the fifth pass and for
  the same reason: the arena is content-sized at 441.4px whatever the viewport,
  so the console gets 172px there. Full-bleed facets make the cut-off row read as
  a list continuing rather than as a clipped card, which softens it, but the
  actual fix is a height-responsive arena — see open item 2.

---

## Seventh pass — hold-to-inspect, and the move dossier (2026-08-27)

The sixth pass rebuilt the console around the move rows. This one is about the
*other* thing those rows do: the ~500ms hold that opens a move's details. The
report was that it was "barebones and weakly executed," and both halves of that
turned out to be literally true — the gesture and the card it opens were each
the oldest surviving version of themselves.

### What was wrong, measured

**The gesture showed nothing until it was over.** `onPointerDown` started a
500ms timer and no pixel changed until the popup appeared. A control that does
nothing for half a second is indistinguishable from a dead control, which is
most of why "hold for info" goes undiscovered at all — and on the fight screen
it is the only route to a move's full readout.

Two defects underneath it, both bugs rather than styling:

1. **A scroll fired it.** The timer was cancelled on `pointerup` and
   `pointerleave`, and on touch the pointer stays *captured* by the element it
   went down on — `pointerleave` never fires mid-drag. So flicking to scroll
   `.move-list` (which scrolls at 375×667, per the fifth pass) or any roster
   list sat perfectly still as far as the DOM was concerned and popped a detail
   card 500ms later.
2. **The one move worth inspecting could not be inspected.** Unaffordable rows
   were `disabled`, and a disabled button receives no pointer events at all. The
   expensive move a player is saving up for — the single most likely thing to
   want explained — was the only move in the game that could not be held.

And a third found while measuring the fix: `.move-list .move-button` carries
`animation: console-row-in … both`, and a **forwards fill retains the
keyframe's `opacity: 1` forever**, outranking every ordinary declaration in the
cascade. So `.move-list .move-button:disabled { opacity: 0.4 }` had never
applied — an unaffordable row dimmed only by losing its leading light. Changing
the fill to `backwards` (which is all the stagger delay actually needs) restored
it: measured 1 → 0.4.

**The card was the pre-second-pass move button, preserved.** It opened on
`.log-overlay`/`.log-panel` — the *Battle Log's* chassis — while every other
hold-to-inspect card in combat (`StatusDetailOverlay`, `FieldEffectDetailOverlay`)
had long since moved to `.detail-overlay`/`.detail-panel` with an identity
stripe in the subject's own colour. The single most-performed long-press in the
game was the only one opening something shaped differently from all the others.
Inside it, five chips in a row: a filled `TypeBadge`, a bordered PHY/MAG
`CategoryBadge`, two uppercase word-spans and a bare `STAB` tag — which is
verbatim the competing-rectangles defect the second pass removed from the button
this card opens *from*, left standing in the card itself.

And, for the fifth pass in a row, the boxes were the smaller half of the
problem. What the card *contained* was: the type multiplier (already on the
button's own second line since the fifth pass), and a line of flavour text. It
told the player nothing the row underneath it wasn't already saying.

### What replaced it

| Was | Is |
|---|---|
| 500ms of nothing | A **charge**: after a delay no tap survives, the facet lights from its own leading emitter, arriving as the card opens |
| Fires during a scroll | Cancels past 12px of travel — a pointer that moves is a scroll, not a hold |
| Unaffordable = `disabled` = uninspectable | `.is-unaffordable` + `aria-disabled`: same dead treatment, refuses the tap, keeps the gesture |
| No confirmation the gesture landed | One 12ms haptic where the platform has one |
| The Battle Log's panel | `.detail-panel`, the shell every other inspect card uses, with the move's type as its stripe and its wash |
| `TypeBadge` + `CategoryBadge` + 2 word-spans + `STAB` tag | One 44px type disc + a single line: `FROST · MAGICAL · SINGLE ENEMY` |
| Type multiplier (already on the button) | A **damage forecast**: a real band per enemy, drawn as a bite out of that enemy's own HP track |
| Nothing about turn order | **Priority**, which ten authored moves carry and which the UI displayed nowhere at all |
| Nothing about the payload | Status / stat / cleanse / field rows, each in its own glyph and colour |
| Cost only | Cost, and what the hero is left standing on |

Details worth keeping:

- **The forecast calls the engine, it does not re-implement it.** `calcDamage`
  takes pre-rolled variance and crit precisely so it can run without RNG, so the
  card runs it at both ends of the 0.85–1.0 band with every input read the way
  `resolveRound.ts` reads it — field-effect context into the stat ratio, passive
  damage modifiers, Elemental Force into BasePower. Verified end to end: a
  Sunstrike forecast of **49–57** against Squall was followed by the round
  actually taking Squall 90 → 40, i.e. **50**. Crit is deliberately outside the
  band (a 1/16 event would inflate every forecast by half) and the card says so
  in a footnote rather than hiding it.
- **The bite, not the numerals, is the readout.** "38–45" is precise and says
  nothing about whether that matters to a hero standing on 52 HP, read against a
  turn clock. Drawing the damage *out of the defender's own remaining track*,
  with a notch where the worst roll lands, is the same fixed-denominator idiom
  as the Field Effect plaque's 5-pip clock, the draft's pact sockets and the
  level-up rank track. Fifth use.
- **The bite needed a dark base under its hatching**, for the reason the console
  light needed a white-hot core: seven of the fifteen domains are low-chroma, and
  a pale hatch laid straight over the green HP fill read as lighter green rather
  than as a different material.
- **It is one card, in four places.** `MoveDetailCard` is what the fight rows,
  the hero sheet, the level-up replace offer and the recruit preview all open —
  holding a move produces the same object wherever you are. The forecast half
  simply doesn't render without a fight to forecast against, which is what
  `MoveDossierContext` being optional buys.
- **The width is the shell's, not a status card's.** The panel first shipped
  capped at 340px, inherited from `.status-detail-panel` — right for three short
  lines, wrong for a header, a numbers row, a payload list and a two-enemy
  forecast, which at 340 read as a small slab floating in a full-screen blur on
  the 394px design canvas. It now takes `.detail-panel`'s own 380 cap, i.e. the
  full 362px the overlay's padding leaves, with the type scale raised a step to
  match and the forecast's enemy portraits at their **native 48px** rather than
  the 24px thumbnail they started at. Measured 362 × 358px at 394 × 852 with no
  horizontal overflow.
- **The card found a content bug on its first render.** STAB was being shown on
  buffs and heals — a term that does not exist in a non-damage move's
  resolution. Gated to `kind === 'damage'`.
- **The forecast's defender types are bare glyphs, not `TypeBadge`.** Two filled
  chips per row would have reinstated the exact sub-box this card exists to
  argue against, and they out-shouted the defender's own name.
- **The charge is light, and it is late.** The first version drew a hard-edged
  wipe travelling the row, and it was wrong twice: it read as a progress bar, in
  a console whose *committed* state is already a gold fill; and because the
  animation starts on pointerdown, an ordinary tap flashed a partly-filled bar
  for the 80–150ms a finger is down, which reads as a glitch on the control
  pressed most often in the game. It now shows nothing for the first 180ms —
  longer than any tap — and then lights the row from its own leading emitter,
  a soft falloff spreading rightwards with no edge to read as a percentage.
  `animation-fill-mode: both` is what makes the delay invisible rather than
  merely early: the backwards half holds the from-state (opacity 0) throughout
  it. Verified at 100ms into a press: computed opacity **0**.
- **`data-holding`, not a returned boolean.** `useLongPress` is spread onto its
  element at a dozen call sites; a `data-*` attribute is legal to spread and
  every one of them picked up the charge without an edit, where a flag would
  have needed twelve.
- **The move row moved out of `FightScreen`'s `.map()`** into its own `MoveRow`,
  for the reason `RecruitClaimCard` did: `useLongPress` is a hook. That is what
  let the hand-rolled timer this button carried be deleted in favour of the
  shared one.

### Verification

Driven in the running app at 375×812 and screenshotted through headless Edge
over CDP (the Browser pane does not composite in this session).

- **Card states seen rendering**: a damage move with a status rider (Cinder
  Bite), a plain attack, a magical attack, a self-buff (Fortify), a heal +
  cleanse (Purify), and a priority attack (Fang Rush, `+1 STRIKES FIRST`).
  Heights 221–387px inside an 812px viewport.
- **Forecast geometry** asserted per row, not eyeballed: HP fill, bite
  left/width, notch position and HP tier all computed from the same fractions.
- **Forecast honesty** confirmed against a resolved round (above).
- **The charge** confirmed at both ends: invisible 100ms into a press (opacity
  0, delay 0.18s), and the row lit from its leading edge on a real hold.
- **Unaffordable treatment survived the `:disabled` → `.is-unaffordable` swap**,
  and now actually dims (opacity 0.4, measured) for the first time.
- `npm test` (203 engine tests), `npm run typecheck:view` and `npm run
  build:view` all pass. Dead CSS removed with the markup it belonged to
  (`.move-popup-meta/-kind/-target/-matchups/-matchup-row`, `.move-stab`);
  `.move-popup-panel/-hint/-description` stay, since the map node preview, the
  equipment popups and the level-up offer still use them.

### A portal to `document.body` leaves the design canvas

Found the moment this reached a real phone, and it is a *class* of bug rather
than a detail of this card — worth knowing before the next overlay is written.

The three combat detail overlays (move, status, Field Effect) each portal out of
the component that opens them, for a real reason StatusDetailOverlay documents:
they hang off an icon inside a `CombatantCard`, and that card can carry `filter`
or `transform`, either of which turns a `position: fixed` descendant into a
containing-block child of the *card*. All three portalled to `document.body`.

But `.app-shell` is a **transform-scaled design canvas** (src/app/uiScale.ts):
every size in this app is authored against a ~394px canvas and the shell is
scaled to fill the real screen. Anything mounted outside the shell is not
scaled — it renders at its authored px against the raw layout viewport. On a
browser at page zoom 0.5, which uiScale.ts already records as a real measured
case (an iPhone reporting `screen 390x844` hands the page a **780px** layout
viewport), a 380px card came out at **48% of the screen**, sitting next to move
rows drawn at twice its type size. That is what "the box still looks extremely
small" was, and no amount of raising the max-width would have fixed it — the
previous attempt raised 340 → 380 and moved the number by four points.

The fix is one line, in a shared `overlayHost()`: portal into `.app-shell`
instead. The shell always carries a `transform` (`scale(…)`, set inline by
uiScale — never `none`), and any transform makes an element the containing block
for its fixed-position descendants. So `inset: 0` now means *the canvas*: the
overlay is scaled with everything else, and it is still above every card's own
filter or transform, which is what the portal was for.

Measured at an 780×1690 viewport (the same shell-vs-viewport ratio the zoomed
phone produces): overlay box **430 × 1690** — exactly the shell, not the 780px
viewport — move card **92% of the shell** (395 device px from 362 CSS px × 1.09),
status card 76% (its own 300px cap, correct for a three-line readout).

**The rule: never `createPortal(…, document.body)` in this app.** Use
`overlayHost()`.

### Portrait only, whichever way the phone is held

The manifest has said `orientation: portrait` since it was written, and that covers
exactly one case: an installed Android PWA. A browser tab obeys the device, and iOS
ignores the manifest for orientation entirely — so a turned phone handed the canvas an
844×390 viewport, where `MIN_SCALE` pinned the scale at 1 and the shell became a 430×390
box with a 700px-tall design canvas inside it. Everything below the fold simply left.

Two moves, in `uiScale.ts` (2026-09-08, per user direction). First ask:
`screen.orientation.lock('portrait')`, which the platform grants inside an installed app
and rejects everywhere else — the rejection is swallowed, because the second move is the
real fix. Where the lock does not take, the canvas was laid out against the screen's SHORT
edge and given a **quarter turn** into the landscape viewport, so a turned phone showed the
same portrait game sideways.

**The quarter turn was removed on 2026-09-09** (per user direction: *"if I try to turn to
landscape, the app does this weird rotating attempt thing"*), and it is worth writing down
why a correct fix was the wrong one. It only ever ran where the lock had been *refused* —
so the browser turns the page, and then the canvas visibly turns back. On a still
screenshot that is a portrait game held sideways; in the hand it is two rotations
disagreeing, with a stretch of layout in between that belongs to neither. **A fix that
works in the end state and not in the transition is not a fix on a device the player is
physically moving.**

What replaced it is one layout in every orientation, plus a floor:

- **`MIN_CANVAS_HEIGHT` = 600.** `MIN_SCALE = 1` says "don't shrink the UI on a short
  viewport, let the screens compress into it", which is right until there is nothing left
  to compress. Measured, a fight at a 390px canvas loses the whole command console off the
  bottom — the screens stop compressing and start clipping. Under the floor the scale drops
  instead, so a viewport too short for the game renders it **small rather than broken**.
  Nothing reaches the floor in portrait; a turned phone reaches it every time.
- **The width is capped in canvas units too** (`Math.min(footprintWidth / scale, MAX_WIDTH)`).
  Without that, scaling down buys the shell a proportionally *wider* canvas out of the same
  footprint, and landscape came out as a 660px-wide design canvas.

A turned phone now shows the portrait game upright, complete, and centred in a narrow strip
— and, above all, still. Overlays come along for free either way: `overlayHost()` portals
into `.app-shell`, so they are inside the transform like everything else.

### Nothing in this app is selectable

Reported off the same device and on the same overlays: press and hold on a move
name, a forecast row, or an enemy in the targeting panel, and the browser
highlighted the text or grabbed the sprite. That is the platform reacting to a
press *partway through the player's own hold*, and it takes the gesture with it —
the hold reads as the control failing.

This was not a missing rule; it was a rule applied **fifteen times**. Every
long-pressable surface carried its own copy of `-webkit-touch-callout` /
`-webkit-user-select` / `user-select`, each with its own paragraph explaining
them, so every new surface had to know to bring one. The move dossier and the
combat targeting panel are what a surface that didn't looks like. Being more
careful was never going to be the fix.

All three properties inherit, so they are now declared **once on `:root`** — which
covers everything the app will ever render, portalled overlays included — plus
`-webkit-user-drag: none` on `img` (that one doesn't inherit) and
`draggable={false}` on every sprite, for the engines that read the attribute
instead. The fifteen copies and their fifteen paragraphs are gone. `.selectable`
is the opt-in escape hatch, used by nothing today; it exists so that the day some
readout genuinely wants copying, the answer is a class rather than a sixteenth
copy of the block.

**The rule: never add `user-select`, `-webkit-touch-callout` or
`-webkit-tap-highlight-color` to a component.** It is already handled. If a
surface needs the opposite, that is `.selectable`.

Verified in the running app on the two surfaces named in the report — every text
node and portrait in the move dossier and in the targeting panel computes
`user-select: none` with a transparent tap highlight, and `user-drag: none` on the
sprites — and all three properties survive minification into the production
bundle.

Two caveats:

- **The haptic has been feature-detected, never felt**, and iOS Safari has no
  Vibration API at all — on iPhone the charge is the entire feedback.
- **The hold is still 500ms.** With the charge drawn it is legible rather than
  dead, but whether 500 is the right number is a feel question that wants a
  thumb, not a measurement.

---

## Eighth pass — the beat, and the console keys (2026-08-27)

Two asks, both about the bottom third of the fight screen.

### The beat trail is removed

The sixth pass filled the resolving console's dead space with `.beat-trail`, a
running list of the round's earlier beats. That is reversed, on user direction:
re-reading a beat mid-fight is a want the vast majority of players never have,
the game is readable enough without it, and the trail was spending the console's
best real estate on history while the beat actually happening sat at 14px. The
full log stays one tap away in the Menu, which is where a deliberate look-back
belongs.

Everything above about the trail — newest-first ordering, revealed-beats-only,
`flex: 0 1 auto`, the scored separator the verification pass measured — is
history now. Two of its findings survive it: `.combat-banner-current` still
centres as a group (keyed on `beatSeq` rather than the trail's length, so
`banner-strike` still fires per beat, not per round), and the chassis is still
what's fixed, with `.combat-banner-focus` clamping at three lines instead of the
trail scrolling.

### What replaces it: a beat with a subject and a payload

`buildBeats` now authors an optional presentational split alongside the plain
sentence (`BeatFlavor` — lead / headline / sub / tag / accent / kind). `banner`
is unchanged and still what the event log reads, so nothing downstream of the
split depends on it existing; a beat that supplies none of it puts its sentence
in the headline slot at a size down (`.banner-focus-sentence`).

- **The split is only for beats that have one.** "Cinder uses" / "Ember Burst",
  "Bramble takes" / "47 damage". A sentence that already reads as one thought —
  `StatusRemoved`, `ActionBlocked` — is not decorated into three lines.
- **Effectiveness is stamped, not trailed.** Crit / super / resist were an
  em-dash and a clause on the end of the damage sentence. They are now a struck
  chip under the number, arriving 80ms later so the two land as a one-two.
- **The move's own type colors the beat**, via `--banner-accent` set inline from
  `getTypeColor(move.type)` — the stylesheet never names one of the 15. Category
  colors (`--banner-kind-color`, set by `.banner-kind-*`) are the fallback, and
  every value is a token the floating combat numbers already use, so a crit
  reads orange in the console and orange over the card it landed on.
- **Both vars live on `.combat-banner`, not on the headline.** The inner element
  remounts every beat; a background that remounts can't cross-fade, and the
  headline and its stamp must not be able to disagree about the beat's color.

**Finding worth keeping: the light pool was drafted three times too strong.**
At 20%/9% the beat's color stopped reading as light on the ground and started
reading as fog *in front of* the text — the dim lead and sub lines lost most of
their contrast, and the near-white pool an ordinary hit produces turned the
console into a gray cloud. 11%/4.5% says what color the beat is without ever
being the thing you look at. The plain-damage kind is `#ccd3e0` rather than
`--text` for the same reason: pure white through the pool formula is haze.

### The console keys

- **Off is drawn, not dimmed.** `opacity: 0.35` on a disabled key was the
  weakest state in the console — a uniform fade reads as a rendering artifact
  rather than a control the game has switched off, and against a dark face 35%
  of a dim key and 100% of a dim key are nearly the same pixel. The off state
  now removes the rim entirely, sinks the face a step darker than the console,
  and drops the label to an explicit inert value. Nothing translucent.
- **Back is lit when it is live.** Availability is the thing this key has to
  communicate and it flickers several times a turn. It takes gold the way Switch
  takes ally blue, so the row reads as *two colored keys and one neutral* when
  there is something to undo and *one colored and two neutral* when there isn't
  — a difference in kind, visible without comparing brightnesses, costing no
  width. Gold rather than a fourth hue because Back is navigation, not a play.
- **The emoji is gone.** `🔄` is a full-color image the platform draws: it could
  not take the key's own color, so it stayed bright on a key the stylesheet had
  just turned off, and it was the one element in the console that did not belong
  to the console. `⇄` and `☰` are type, and they inherit.
- **Menu carries the commander's light.** It has no state to report, so its rim
  and glyph are free to take `--console-rgb` instead — the key recolours with
  the acting hero, which is what stops the row reading as a strip of chrome
  bolted under the console rather than the bottom of it. The glyph is at 0.5
  alpha, not full: at full strength a Fire commander turned it solid orange,
  which reads as a warning rather than as a menu.

### Verification

Driven through a real Quick Battle round over CDP, reading computed style off
the live DOM.

- **The trail is gone at every beat** (`.beat-trail` absent for all 8 beats of
  the round), and the headline computes to 30px — 19px on the sentence fallback.
- **Type accent tracks content**: Beast `#b5772f` → Iron `#9aa3ad` → Light
  `#e8d16a`, each with `.combat-banner-focus` color matching exactly.
- **Kinds resolve**: `banner-kind-damage` `rgb(204, 211, 224)`,
  `banner-kind-ko` `rgb(217, 83, 79)`, `banner-kind-resist` `rgb(153, 160, 175)`
  with the "Not very effective..." chip attached.
- **Back's two states are structurally different, not just dimmer**: disabled
  carries no accent ring and a `rgb(78, 86, 101)` glyph; enabled carries
  `rgba(224, 166, 60, 0.6)` at 1px and a `rgb(224, 166, 60)` glyph. Opacity is
  `1` in both.

## Ninth pass — the map-node screens, and the size of a Continue (2026-08-28)

Open item 6's remainder ("apply the rule outside combat… still outstanding: the
map, roster, and **shrine** screens"), plus a direct report: *avoid vertically
skinny "Continue" buttons at the bottom — these should be chunkier and easier
for players to press.* The two turned out to be the same screens.

### What was wrong

**Every node screen introduced its buttons with a bordered banner carrying no
action.** There were five hand-tuned variants of that one box —
`.equip-cache-banner`, `.relic-shrine-banner`, `.class-shrine-banner`,
`.equip-spotlight`, `.evolution-banner` — and each sat inside a *second* box,
`.reward-panel`, on flat `--bg`. Three levels between the screen edge and the
first pressable thing, which is the same finding as the diagnosis at the top of
this doc, three months of passes later, on the half of the app combat isn't.

**The hero grid was the known defect, still open.** `.hero-grid-portrait` drew
the 48×48 sources at **30px** — 0.625×, the fractional downscale this doc opens
with — on `ItemFoundScreen`, `StatBoostScreen` and `ClassNodeScreen`. It is
listed under open item 6 as "the first thing to fix when those screens come up."
They came up.

**And the cards were empty of the decision** — the question this doc's own
procedure says to ask after "what does the box contain?", now 5 for 5. A
`.hero-grid-card` carried a name, a level and two type chips. On the Vitality
Shrine that is a picker for a *permanent* +20 HP grant with nothing on it about
the hero receiving it; on ItemFoundScreen it did carry the target slot, in a
dashed sunken sub-box.

**Two primaries, one of them inert.** Mentor's Hall, the Gold and XP caches and
the Relic Shrine each rendered a gold Claim/Confirm button *and* a gold
Continue directly beneath it. Same fill, same size, and on arrival exactly one
of them did anything.

**The CTA itself was 42px.** 12px of padding around 14px type, pinned to the
bottom edge of a portrait phone — inside the home-indicator's gesture strip and
under the least accurate part of the thumb's travel. Both platforms' minimum
touch target (44/48px) sat above it.

### What replaced it

| Was | Is |
|---|---|
| Five bordered banners, each inside `.reward-panel` | One shared stage: `NodeSky` (full-bleed, tinted) + `NodeHeader` (eyebrow / bloomed title / readout), nothing drawn around either |
| Per-screen hue hard-coded into per-screen banner rules | One custom property, `--node-rgb`, set once on the screen root; sky, motes, eyebrow, title bloom and readout all inherit it |
| `.hero-grid`, 30px portraits (0.625×) | `HeroPickCard` — 48px (1×) at three columns, 96px (2×) at two, the level-up screen's card generalised |
| Name / level / two chips | A CTA line saying what the tap buys ("+20 Max HP", "Replace", "Teach"), and an optional detail row (the target equip slot, the rank track) |
| No way to inspect from a stat-grant node | Hold a card for the full hero sheet, the same gesture as everywhere else |
| Claim *and* Continue, both gold, both full width | One bottom button, whichever the screen is waiting for |
| 42px CTA | **56px minimum**, 16px/800, `--radius-md`; `.secondary-button` follows to 50px so a pair still reads as a pair |
| Post-fight Continue: 15px label, centred, hugging its text | Same 56px slab, `flex: 1` across the row |

Details worth keeping:

- **The tint had to live on the screen root, not on the components.** They took
  a `tint` prop first, and the XP cache came out with a green header above a
  gold numeral: a sibling of the header inherits nothing from it. One
  declaration on `.node-screen` is also what lets a *forced equip* tint the
  whole room with the drop's rarity (`RARITY_RGB_VARS` — the tier palette as
  bare rgb triples, added for exactly this).
- **The ring survived, the banner didn't.** The dashed rotating circle behind
  the shrine headings was the one part of those boxes doing real work. It is now
  rendered only when the header has art to frame (the Mentor): centred on a bare
  title it reads as a stray circle crossing the readout, which is what it did
  for two rounds of screenshots before the rule became "frames the figure or
  isn't drawn".
- **Gold and XP get a numeral, not a hint.** There is nothing to choose at those
  nodes, so the amount is the screen — 64px, lit by the node's hue, centred in
  the room rather than pinned above the CTA. Thumb reach is an argument about
  controls; this isn't one.
- **Three more portraits were at broken scales** and were fixed with them: the
  Mentor at 84px (1.75×) → 96px, its small variant 72px → 48px, and the Class
  reveal's 72px mentor / 88px hero → 48px / 96px. The size gap now *carries* the
  hierarchy in that reveal instead of both figures being wrong.
- **`.hero-grid` is deliberately still alive.** `RosterReplaceScreen` and the
  Mentor's roster-peek overlay still use it, both inside overlays where the
  small card is doing no harm. The class exists for those two now, not as the
  app's pick-a-hero idiom.

### Verification

Every screen was driven and **looked at**, not measured — rendered through a
throwaway harness (a root `nodes.html` plus an entry importing the real screen
modules, both deleted before committing) into headless Edge at 394×800 device
pixels ×2, then read back as PNGs. That is what caught the green-header/gold-
numeral inheritance bug and both ring placements; none of the three would have
shown up in computed style.

Shot and checked: Vitality Shrine, Mana Well, Gold Cache, XP Cache, Equipment
Cache, Relic Shrine, Mentor's Hall, the Event placeholder, ItemFoundScreen,
EvolutionScreen, and the Level Up screen itself (unchanged in appearance after
its card and header were replaced by the shared ones — which is the point of
the refactor). `npm test` (203 engine tests), `npm run typecheck:view` and the
production build all pass.

Two notes for whoever picks this up:

- **Headless Edge drops screenshots at random here.** Roughly one run in three
  writes no file at all, exit code 0, no stderr — unrelated to the page (the
  same URL succeeds on retry). Loop until the file is non-empty; don't debug the
  screen.
- **`initUiScale` fights a headless viewport.** Mounting the real shell in
  headless Edge produced a canvas wider than the window and clipped the right
  column. The harness pinned `.app-shell` to `width: 394px; height: 800px;
  transform: none` instead, which is the canvas the UI is authored against
  anyway.

## Tenth pass — one shape for every pick-a-hero screen (2026-08-28)

A direct report, same day as the ninth: *every screen that asks the player to
select a hero should be laid out like the Level Up screen — same information in
the same places, same boxes in the same positions. Every one of them needs a way
to check the roster, a glyph in a top corner rather than a worded button. And the
Confirm button should be bigger still, and lifted off the bottom edge.*

The ninth pass gave those screens a shared **stage**. This one makes them the
same **screen**.

### What was wrong

**Same parts, different heights.** All the pick screens already drew a
`NodeHeader` over a `HeroPickGrid`, but three of them wrapped the grid in
`.screen-scroll > .bottom-pinned` while `LevelUpScreen` and `StatBoostScreen`
gave it `is-filling` and let it own the space. So the row of figures landed at a
different y on `ItemFoundScreen` (where its height moved with how much the
dropped item had to say about itself), on `ClassNodeScreen`, and on Level Up —
three variants of a screen the player is meant to learn once.

**Two grids never got the treatment at all.** `RosterReplaceScreen` still drew
an `.equip-spotlight` over a `.hero-grid` of 30px portraits — the last live
instance of the fractional downscale this doc opens with, kept alive in the
ninth pass on the grounds that it was "inside an overlay". It is a full-screen
decision about permanently destroying a hero; the overlay is a technicality.
The Mentor's roster-peek overlay was the other, and it is now gone entirely.

**"Check your roster" existed exactly once, as a paragraph.** A full-width
`.secondary-button` reading "👥 Check Your Roster", on Mentor's Hall only, and
only during its first phase. Every other screen that permanently commits
something to a hero — a Training Point, an Evolution branch, a piece of gear, a
+20 HP grant, a team-wide relic — offered no answer to *what have I actually
got* without leaving the decision.

**A latent bug the pass surfaced.** The ninth pass's
`.node-screen > *:not(.node-sky) { position: relative }` is (0,2,0) and sits
below every overlay's own rule, so it silently overwrote `position: fixed` on
any modal rendered as a direct child of a node screen — which is how all of them
are rendered. Hero sheets opened from those screens were laying out as in-flow
blocks in the flex column. Now the selector names its exceptions
(`.log-overlay`, `.detail-overlay`, `.corner-glyph-button`) instead of leaving
them to fight for specificity.

### What replaced it

| Was | Is |
|---|---|
| Grid in `.screen-scroll > .bottom-pinned` on three screens, `is-filling` on two | `HeroPickGrid … fill` as a **direct child** everywhere: header → context → grid → CTA, four bands, same order, same heights |
| ForceEquip's item text pushing the roster down by however tall it was | `.node-item-effects` is its own band, `max-height: 32%`, scrolling internally |
| `RosterReplaceScreen`'s `.equip-spotlight` + 30px `.hero-grid` | The node stage: sky, `NodeHeader` with the incoming hero as its art, `HeroPickCard` grid whose detail row names the gear the termination strips |
| "👥 Check Your Roster", one screen, one phase | `RosterPeek` — a 44px corner glyph on **nine** screens, opening a read-only panel: gold / unspent XP / contracts, the owned relics, and the roster as the same `HeroPickCard` figures, each opening the full sheet |
| `SquadSelectScreen`'s two worded chips in a `.map-header` bar | The same corner glyphs (roster → Manage Roster, since moving gear *is* the point there; 📖 → Reference) |
| 56px CTA flush to the screen edge | **68px**, 18px/800, `--radius-lg`, and **12px clear of the bottom** |

Details worth keeping:

- **The lift mattered more than the height.** A 56px bar flush to the edge is
  still the screen's border; the 12px gap is what makes it an object sitting on
  the screen, and it moves the whole target out of the home-indicator's swipe
  strip rather than only growing upward. The margin is scoped to CTAs that are
  *direct children of a screen root* — the same `.resolve-button` inside a
  `.log-panel` dialog is laid out by that panel's gap and must not collect a
  stray 12px.
- **The peek is deliberately read-only.** Equipment is moved on
  `RosterManagementScreen`, reachable from the map and before a fight. Opening
  an inspector from inside a *forced allocation gate* must not be able to
  quietly change the thing being allocated.
- **A glyph, not a phrase.** It is the same utility on nine screens, so it
  should be the same shape in the same corner on all of them, learned once —
  and every one of these screens wants its full width for a centred title.
- **Absolute positioning has to be paid for.** The glyph floats over the scroll
  area rather than taking a row, so each host reserves the corner: the Guild
  Hall's header gets `padding-right`, and Squad Select's scouted-enemy panel
  drops 16px so its rightmost chip clears the buttons' bottom edge. Both were
  found by looking, not by reasoning.

### Verification

Same method as the ninth pass and the same caveats apply — a throwaway harness
(root `shots.html` + an entry importing the real screen modules from a synthetic
`RunState`, both deleted before committing) driven in headless Edge over CDP,
read back as PNGs. Shot and looked at: Level Up, the peek overlay over it, the
peek's hero sheet, Vitality Shrine, ForceEquip, Mentor's Hall (both phases),
Relic Shrine, Equipment Cache, the Event placeholder, Guild Hall, Roster
Replace, Squad Select, Evolution. The Squad Select corner collision and the
peek card's redundant "LEVEL 4" line were both only visible in the PNGs.

The real app (not just the harness) was then driven from the title screen into
Level Up to confirm the peek button mounts and the CTA measures 70px with its
bottom 12px clear of the shell. `npm run typecheck:view` passes.

## Eleventh pass — the Recruit Contract gets a screen (2026-08-28)

A direct report: *the recruit screen should be its own screen, with presentation
close to the starter select. It must be very clear how many Contracts the player
has, and that recruiting spends one. With no Contracts, don't show it at all.*

### What was wrong

**The biggest roster decision in the run was a band inside a results box.** Two
56px portraits under an eyebrow reading "📜 Recruit Contracts available: 2",
below the gold/XP chips and below the equipment spotlight, inside a panel whose
whole job is to say *the fight is over*. Adding a hero to a six-slot roster —
permanently, for a currency the player may hold exactly one of for a whole act
— was staged as a smaller moment than the item that dropped above it.

**The price was a number in a sentence.** Nothing on that band made "you are
spending one of these" a visible event; the count simply read one lower the
next time a victory box appeared.

**An offer with no way to take it was still drawn.** With zero contracts the
band rendered in full and the confirm button read "No Contracts Left" — a
screenful of hero portraits teaching the player that their taps are decorative.

**The draft had already solved the same problem.** Choosing a hero for the run
is the draft's entire ceremony: a 144px figure in a summoning sigil, a stat
silhouette on shared ceilings, the kit as pressable chips, a rail of the
alternatives. The claim asks the identical question — *do you want this hero,
permanently, for a price* — and answered it with two portrait buttons.

### What replaced it

| Was | Is |
|---|---|
| `.recruit-claims` band in `FightScreen`'s victory overlay | `RecruitScreen` — a top-level screen (`App.tsx` `{ kind: 'recruit' }`), the first of the post-fight gates, ahead of the equip and level-up gates so this win's gear and Training Points can go to the hero it just recruited |
| Two 56px portrait cards, name + type chips | The draft's stage, shared as `view/shared/HeroStage.tsx`: same sky and motes, same 144px figure and sigil, same silhouette, kit and rail |
| "Recruit Contracts available: N" in an eyebrow | `.recruit-contracts` — one seal pip per contract owned, with the seal this signature will consume **dimmed and pulsing** the moment a signable hero is on stage |
| A confirm button that armed on selection | The stage button *is* the spend, and says the price: "Sign Cinder — 1 Contract" |
| Nothing said what a veteran brings | `Lv 5` on the figure, the chosen Evolution branches named under the types, and the silhouette's granted stats tinted `--buff` — "arrives with branches partially locked" (CLAUDE.md), drawn |
| Band rendered even with 0 contracts | `handleFightResolved` never opens the screen: no contracts (or nothing recruitable beaten) means straight on to the next gate |

Details worth keeping:

- **The price reads as leaving, not arriving.** The spending pip dims and
  drifts up rather than glowing gold; a bright pip would read as a reward being
  granted, which is the opposite of what is happening.
- **Walking away is not the loudest control.** The draft's `.draft-cta` slab
  (25px padding, 21px type) belongs to "Seal the Pact". Here the commit is the
  signature on the stage, so the bottom button — "Leave Them" / "Done
  Recruiting" — is a subdued panel button. It needed `.recruit-screen >` to
  outrank `.resolve-button`'s gold, which the first render caught.
- **The class family keeps its `.draft-*` prefix.** Renaming ~200 selectors to
  something screen-neutral would invalidate every `.draft-figure` /
  `.draft-portrait` measurement the third and fifth passes record. The prefix
  now names the idiom; `.recruit-*` is only what this screen adds.
- **Everything drawn is the hero that actually arrives.** A contract strips the
  enemy's gear (`recruitment.ts deriveContractOffer`), so silhouette, kit and
  hero sheet all read off an ungeared copy of the entry rather than the build
  that just fought — the old claim preview advertised a weapon that never came.

### Verification

Same method as the ninth and tenth passes: a throwaway harness (root
`recruitshot.html` + an entry mounting the real `RecruitScreen` /
`DraftScreen` from a synthetic `RunState`, both deleted before committing),
headless Edge over CDP, PNGs read back. Shot and looked at: two offers at two
contracts, the state after signing one (stage advances to the unsigned offer,
rail seals the signed one, CTA becomes "Done Recruiting"), one offer at one
contract with a full roster ("Replace a hero for Cinder"), the
`RosterReplaceScreen` overlay opened over it, and the draft itself as a
regression check on the extraction. The gold "Leave Them" was only visible in
the first PNG. `npm run typecheck:view`, `npm run typecheck` and `npm test`
(203 passing) all pass.

## Twelfth pass — the equip screen becomes a comparison (2026-08-31)

A direct report: *the "give a piece of equipment to a hero" screen has some
issues once you've reached the middle/lategame. There's no way of knowing if
the piece of equipment you have now is better or worse than what your heroes
already have equipped. You have to go through multiple informational
menus/overlays to read what each hero has equipped, and it's very cumbersome
and inefficient.* With a stated ask: handle six heroes on screen, show what
each hero's currently equipped item is doing, and show what the offered item
does.

### What was wrong

**The screen asked a numeric question in a shape built for an identity
question.** `ItemFoundScreen` drew six `HeroPickCard`s — the shared
figure-on-type-tinted-ground card the tenth pass generalised — each with one
detail line reading `⚔ Torch`. That card is exactly right when the question is
*which of these heroes*; it says who they are and what the tap buys. But the
question this screen actually asks is *is this better than what they have*,
asked six times over with the same terms each time, and a 118px card in a
three-column grid has no room to answer it once, let alone six times.

**So the answer lived in six overlays.** The name of the held item was on the
card; everything that made the name mean something — its stats, its granted
passive, its Elemental Force — was behind a long-press into
`HeroPreviewOverlay`, one hero at a time. Answering "who should get this" meant
opening six sheets and holding twelve stat lines in your head, which is the
"cumbersome and inefficient" in the report, stated precisely.

**Early-game hid the problem.** Empty slots compare against nothing, so the
card grid was fine for the first act and quietly stopped working as the
roster filled — which is why the report arrives from the midgame.

### What replaced it

The six cards became six rows: `EquipCompareRow`, a table with the same
columns in the same order, scanned down rather than hunted across.

| Was | Is |
|---|---|
| `HeroPickGrid` of six `.pick-card`s | `.equip-compare-table` — a `.screen-scroll` column of `.equip-row`s, one hero each |
| `⚔ Torch` as the whole answer | Three lines: **who** (figure, name, level, types), **what they hold** (icon + name in its own rarity colour), **what would change** |
| The comparison, in six long-presses | `compareEquipment` (`src/run/equipCompare.ts`) — a pure diff of two `EquipmentDefinition`s, rendered as chips |
| Nothing said what the offered item does per hero | Every chip is written as a **transition**: `ATK 5→15`, not `ATK +10` |
| One layout for two to six heroes | Two scales at HeroPickGrid's own threshold: 48px rows past four heroes, 96px rows at four or fewer |
| 25px title, which ran "Mantle of the Archmage" under the roster glyph | `NodeHeader`'s existing `compact` (19px) plus a symmetric 38px corner guard |

Details worth keeping:

- **The transition chip is the whole idea.** `ATK 5→15` answers both halves of
  the report in one token — the left number is what the hero's current item is
  doing (the fact that used to cost an overlay), the right is what it would
  become. Where one side is zero the arrow is dropped for a bare `+15` / `−5`;
  `0→15` spends three characters saying nothing.
- **Silence is a feature.** An effect both items carry equally produces no chip
  at all. An item granting +10 Attack replacing one that grants +10 Attack has
  nothing to say about Attack, and saying it anyway is what buries the two
  lines that matter. This is the invariant `test/equipCompare.test.ts` exists
  to defend.
- **No verdict.** It would be easy to sum the deltas into a better/worse arrow
  and it would be wrong: Attack on an Intelligence hero is not worth what
  Attack on a physical one is, Fire Force is worth nothing to a hero with no
  Fire moves, and the north star ("every hero must be viable under *some*
  combination") means the game cannot know what the player is building toward.
  The one verdict the screen *can* state is that an empty slot costs nothing,
  so `EQUIP` is green and `REPLACE` is gold.
- **Type codes are load-bearing, not decoration.** An Elemental Force chip is
  worth its full magnitude to a hero of that type and nothing to anyone else,
  so the chip carries its type's colour and the codes it is checked against sit
  two lines above it.
- **The header did not become redundant.** It is the *absolute* reading of the
  item and the table is the *relative* one. A player meeting an item for the
  first time should not have to reconstruct what it is from six diffs of it,
  and a diff has no room for a passive's prose.
- **The chips are chromeless.** Six rows × up to six chips is 36 small
  rectangles on one screen if they are pills; colour and weight carry the
  grouping instead.
- **`flex: none` on the row is load-bearing.** Without it a column of six flex
  items inside a fixed-height scroll box squashes to fit rather than
  overflowing — which is not scrolling, it is six rows quietly losing 15px of
  content each on a short viewport. Caught in verification, not in review.
- **`justify-content: safe center`**, not plain `center`: the table is centred
  in the space between the header and Trash so a small roster does not leave a
  hole, and `safe` is what stops a full roster being centred by clipping its
  first row somewhere no scroll can reach.
- **The seating animation survived the move unchanged.** `equip-seat-jolt` and
  `.equip-seat-flare` were written for the cards; what they animate is a thing
  accepting weight, not a card, so they read the same on a row.

### Verification

Same method as the ninth through eleventh passes: a throwaway harness (root
`equipcheck.html` + `src/app/equipcheck.tsx` mounting the real
`ItemFoundScreen` from a synthetic mid-run `RunState`, both deleted before
committing) served by vite, driven and shot in the Browser pane. Shot and
looked at: a legendary weapon against six heroes (five filled slots and one
empty), the same screen after equipping — which proves the bump path, since
the displaced Torch returns as the queue head under "Needs a New Home" with
every row recomputed against it — a common weapon whose holder already has
one (the `No change` row), a mythic armour against six armours (five chips per
row, wrapping), the roomy scale at four heroes, the `i` sheet opening over the
table, and the seating flare frozen mid-sweep. The short-viewport squash and
the clipped 25px title were both found this way. `npm run typecheck`,
`npm run typecheck:view` and `npm test` (581 passing) all pass.

## Thirteenth pass — a named enemy takes the field (2026-09-01)

The ask, alongside the Goblin Lord content itself: *have some battlefield effect
play when he enters to denote that a powerful enemy has just entered play. Maybe
even the music could slow by 20% or something to lower the pitch and give the
battle an epic effect. That is experimental though and we may walk that back.*

### What was wrong

Nothing was broken. What was missing is that the engine has exactly one way of
saying a combatant arrived — a `SwitchedIn` event — and the view had exactly one
way of showing it: `"X switches in!"` in the console, the `switchIn` whoosh, and
a card appearing. That is the right treatment for the fourth bench cycle of an
ordinary fight, and it is the *only* treatment available, so the Guardian
fight's reinforcement would have walked on looking like a routine pivot.

### What replaced it

A **dramatic entrance**: one flag, five answers.

- `view/shared/entrances.ts` — a table of hero ids to arrival copy, keyed exactly
  like `heroArt.ts`. Presentation data in the presentation layer; the engine never
  learns this exists, which is what CLAUDE.md's "never bake timing, animation, or
  sound into the engine" requires and also what makes an entrance addable or
  removable without a number in a fight changing.
  The table is **every Guardian champion plus the Endbringer** (2026-09-07) and
  nothing else, so a run meets exactly one an act and the treatment never becomes
  the house style for arriving. The finale's *unsealed* champions are deliberately
  out: the player has already fought all six, so there is nothing left to conceal
  and the act's one hidden card stays the thing at the end of it.
- `SquadSelectScreen.tsx` — the same table conceals the chip on the battle
  preview: a **silhouette and its typing**, no name, no portrait, no stat sheet.
  The two halves are one flag on purpose, because either alone is worse than
  neither — concealing something that then walks on like an ordinary bench pivot
  is a promise not kept, and announcing something the player already read a full
  stat sheet for is a reveal of nothing. The silhouette is drawn from the *real*
  portrait through `brightness(0) invert(1)`, so it is honestly that figure's
  outline at 32px: the player gets its size and stance and none of its identity.
  The chip is a `div`, not a `button` — one that looks pressable and opens
  nothing reads as broken, where one that plainly cannot be pressed reads as
  withheld.
- `buildBeats.ts` — a `SwitchedIn` for one of those ids gets its own sentence
  ("Something comes out of the treeline" / **Goblin Lord** / "The ground goes
  quiet."), the `ko` headline red rather than the switch-in `buff` green, and a
  `dramaticEntrance: true` flag on the beat. The lead and the meta are authored
  **per champion** rather than shared: the Goblin Lord's treeline is Wild's Edge,
  and reusing it under the Molten Foundry would read as a bug in the copy, not as
  a house line.
- `styles.css` — a veil clipped to `.battlefield`: a red bloom on the enemy row,
  dusk closing from the top, an expanding ring, and a four-step lurch on
  `.team-row.enemy`. **Not** a full-screen overlay, and **not** a transform on
  `.battlefield` itself: the arena is full-bleed against the shell's negative
  margins, so translating it opens a sliver of page background at the edges. The
  lurch goes on the row, which is inside the clip and is also the thing the
  player should be looking at.
- `sounds.ts` / `music.ts` — a slow falling horn (`entrance.dread`), and
  ⚠️ **experimentally**, the act's track dropped to `playbackRate` 0.8 for the
  rest of the fight. Web Audio has no time-stretch, so speed and pitch move
  together: the score goes about three semitones flat and stays there.
  `FightScreen` restores 1 on unmount, which is what scopes it to the fight —
  the track belongs to the act and would otherwise carry the drop out onto the
  map. One constant, `DREAD_MUSIC_RATE`, walks it back.

### Verification

The standard method (ninth pass onward): a throwaway `lordcheck.html` +
`src/app/lordcheck.tsx` mounting the real `FightScreen` against a real
`appendFinalEnemy`-ed boss encounter, with the enemy pair given `hp: -9999` so
the first exchange KOs one and the forced replacement fires on round 1. Both
deleted before committing.

Two things were found and fixed by looking at it. The shockwave ring was first
authored at 60% width scaling to 2.6 — a ~340px final radius on a ~430px arena,
which read not as a shockwave but as a stray arc sweeping across the player's own
team. It is 26%/2.2 now, sized to die on the horizon. And the veil held full
opacity to 55% of its run, which washed out the portrait for the better part of a
second — the beat exists to make the player look at that card. It comes off the
peak at 32% now.

The music path was confirmed live rather than reasoned about: the harness
exposed `setTrack`/`setMusicRate`/`musicDebug` on `window`, and with
`wildsEdge` actually sounding (`contextState: "running"`) the rate moved
1 → 0.8 → 1 through the real AudioParam ramp.

The concealed chip got a second harness of its own (`scoutcheck.html` +
`src/app/scoutcheck.tsx`, mounting the real `SquadSelectScreen` against the same
encounter, likewise deleted). Shot at 1x and again at 4x to read the silhouette
itself: three chips, two of them clickable, the third a dim outline over `BST` /
`ANC` badges that opens nothing and reports `cursor: default`. `npm run
typecheck`, `npm run typecheck:view` and `npm test` (594 passing) all pass.

## Fourteenth pass — the arena stands somewhere (2026-09-01)

The ask: *implement location aesthetics into the battlefield. Wild's Edge
should look different than Storm Coast and Forbidden Forest. The degree to
which the screen can take on the aesthetics is tough to say, so this will be
somewhat experimental.*

### What was wrong

`docs/locations.md` §5.5 already carried a Location through the map well and
all ten node screens, and closed with an admission: `FightScreen` is untouched.
That left the run's identity system covering every screen the player passes
*through* and missing the one they sit *in*. A Necropolis fight and a Molten
Foundry fight were the same slate-blue box with different sprites in it.

The reason it was left is real, and it is the interesting part of this pass:
the arena is not a node stage. It is not a lit room with a subject in the
middle — it is a two-zone tactical field whose "horizon" is a divider halfway
down the screen, and whose every square inch is either a figure, a numeral, or
the space a damage popup flies through. Dropping the node stage's sky into it
would have been the wrong shape at the wrong strength.

### What replaced it

The same three channels, re-fitted rather than re-used.

**Light, not hue.** Six full `background` overrides on
`.battlefield[data-location="…"]`, the same discipline `.map-well` follows —
open dusk with the softest, widest ground light in the set; a forest lit only
by a canopy gap between two black edges; a furnace with a hard-edged floor
under a black ceiling; an overcast coast with the light overhead and a diagonal
squall across it; a snowfield with no light source at all, only flat cold fog
lying on the ground; and a shrine that is nothing but one tight altar bloom
under a violet crown. Each recipe keeps the enemy-red and ally-blue zone tints
at 0.18 — those are *information* — and each sets its own weight of tactical
grid, which is the one place the grid finally earns its keep: a foundry has
plating at 0.03, a forest has nothing to draw at 0.008.

**The horizon silhouette, hung on `.battlefield-divider`.** Everywhere else the
far distance is the bottom edge of the screen. Here it is the middle, which is
the entire reason that divider stopped being a rule between two panels and
became a horizon in the fifth pass. So the treeline stands behind the *enemy
row* — which is exactly where "over there" is.

**Weather at 0.45 density and 0.34 opacity**, the quietest field in the game.

**And the console left alone.** The scene is the place; the console is the
instrument panel it is read through. Giving both the location's weather would
erase the only line on this screen separating world from UI — which is the
same argument the third pass used to give the arena a scene and the console a
box in the first place.

### What looking at it changed

Three, all of which read as fine in the stylesheet and were wrong on screen.

1. **The band has to be tall.** First cut was 13% of the arena, sized to sit in
   the strip under the enemy row. Every silhouette landed entirely behind that
   row's HP and MP pills, and the only part of it that cleared them was its own
   ground fill: a solid black bar across the middle of the screen. It is 28%
   now, tall enough that the skyline reaches past the pills to the portraits.
2. **The base has to dissolve.** Every band in `locationArt.tsx` ends in a
   full-width ground fill, which is right when the band sits on the bottom edge
   of a screen and is a slab anywhere else. `mask-image: linear-gradient(to
   top, transparent 0%, #000 26%)` turns it into mist at the foot of the
   treeline instead — and mist at a treeline base is what a distant one
   actually looks like.
3. **Half a pixel of blur.** At full contrast the Wild's Edge pines read as
   sharp black cutouts pasted behind the name pills. `blur(0.5px)` with opacity
   down to 0.5 is depth of field, not softening: the skyline is the only
   far-away object on the screen, and it should not be in the same focal plane
   as the type badge in front of it.

An active Field Effect still owns the horizon line and its haze. Those rules
sit later in `styles.css` at equal specificity, which is deliberate and is
worth not "tidying": standing battlefield state outranks the place it is
standing in.

### Verification

The standard method (ninth pass onward): a throwaway `harness.html` +
`src/app/harness.tsx` mounting the real `FightScreen` inside a
`LocationProvider` chosen by `?loc=`, both deleted before committing. All six
locations shot at 394x790, plus `?loc=none` to confirm the placeless arena
(sandbox, quick battle) is byte-for-byte the scene it was. The Field Effect
override was checked live rather than reasoned about — `.field-effect-active`
forced on with a location set, and `getComputedStyle(divider, '::before')`
reporting the effect's colour, not the location's. No console errors. `npm run
typecheck`, `npm run typecheck:view` and `npm test` (637 passing) all pass.

One thing was tuned and left deliberately quiet: the Molten Foundry's floor
heat. It wants to be brighter than it is, and the ally row's HP and MP bars are
sitting in it.

## Fifteenth pass — a fight opens on a beat (2026-09-03)

The ask: *we now have passives like Imposing Presence that trigger whenever a hero
enters the battlefield. So what happens is that, currently, I open a battle and we
jump straight to the move selection phase, and the two enemies have their attack
lowered from Imposing Presence. As the designer of the game, I know why this is,
but for new players I think that the information needs to be conveyed as its own
beat.* Explicitly: not lengthy, not many inputs.

### What was wrong

The engine had been doing the right thing since entry passives existed.
`resolveBattleStartEntries` synthesises the `SwitchedIn` each starting lead would
have produced, runs the normal matcher, and hands back both the resulting board
and the events. `FightScreen` used the board and dropped the events into the
**log** — a panel two taps deep behind the Menu. So a fight opened on a board
that had already changed, with nothing on screen having named what changed it. The
one player who could read it was the person who wrote the passive.

The fix needed no engine work and no new screen, because both halves already
existed and had never been connected: a generic beat player
(`startBeatPlayback(startState, events, finalState)` — tap-advance, popups,
banner, SFX, log append) and a `PassiveTriggered` + `statDelta` grouping in
`buildBeats` that already renders *"Imposing Presence · Cortex and Crimson /
**ATK −10**"* with debuff numbers floating off both enemy cards. The opening
events were the one event stream in the game that never reached it.

### What replaced it

`openBattle` now returns **two boards and the events between them** — `start`
(both leads on the field, entry passives *not* applied), `events`, and `final`
(what round 1 is declared on). The fight renders `start` and plays the difference.
That split is the whole fix; everything below is presentation on top of it.

- `view/combat/openingBeats.ts` — the **engagement beat**, and deliberately
  event-less (`events: []`): both leads are already on the board at first render,
  so there is nothing to replay. It exists so the passive beats are not the first
  thing a fight ever shows, which would read as "something happened before I did
  anything". Lead is the **Location** (`Wild's Edge`, falling back to `Battle`
  when placeless — Quick Battle, sandbox), headline is the **enemy leads**, stamp
  is `Battle begins`, and the headline glows in the Location's own `tintRgb`
  through the existing `bannerAccent`. It does **not** re-reveal the enemy roster:
  `SquadSelectScreen` already scouts that, so this beat says *where and against
  whom* and stops.
- `FightScreen.tsx` — `resolving` now **initialises true**. A fight opens
  mid-playback by definition, and initialising it false paints one frame of a live
  action console before the mount effect takes it away. `startBeatPlayback` gained
  a `prelude` parameter for beats that aren't grouped from events.
- **The player advances it, a tap per beat.** Always at least one beat, even when
  there is nothing to say — an intro that appears only sometimes reads as an
  interruption rather than a ritual, and it would announce "something happened"
  before the player could know what. So an ordinary fight is **exactly one tap**,
  and a fight with an entry passive on both leads is three.
  - ⚠️ **Reversed same day, on user direction, after the first phone test.** This
    shipped auto-advancing at `INTRO_BEAT_MS` = 1000 with a tap to skip, on the
    reasoning that the common case should cost **zero** inputs. Held in the hand
    that was worse, not better: *"I honestly think it's okay and won't be too
    cumbersome."* A timed beat the player cannot control is a wait, however short,
    and it also made the fight's very first input mean something (**skip**) that
    the identical tap means nothing like for the rest of the fight (**advance**).
    Tap-advancing it deletes `INTRO_BEAT_MS`, `introPlaying` and `skipIntro`
    outright — the intro is now *only* `startBeatPlayback` with a prelude, sharing
    the round's overlay, its hold-to-auto-play and its
    `tap ▸ or hold to auto-play ⏵⏵` hint. The general lesson is the cheaper one:
    **a new moment should borrow the input the surrounding screen already
    teaches**, and inventing a second verb for the same gesture costs more than
    the input it saves.
- `sounds.ts` — one row, `battle.join`: a struck low drum, then a swell that rises
  where `entrance.dread`'s sweeps fall. Fires once a battle so it may have
  presence, but it is capped under dread (0.44 against 0.52) on purpose — **the
  engagement is the frame; a named enemy arriving inside it is the event**, and the
  frame must never outsize the event. `beatSfx` reads it off an `engagement` flag,
  checked before `PRIORITY` for the same reason `dramaticEntrance` is: the beat
  carries no events, so there is nothing for `PRIORITY` to rank.
- `buildBeats.ts`, incidental but in the sentence this pass exists to deliver:
  stat beats read `attack` straight off `StatChangedEvent.stat`. They now go
  through `STAT_LABELS`, so the headline is **`ATK -10`** and the popup `-10 ATK`,
  in the same vocabulary the cards use. This changes mid-fight stat beats too.

The thirteenth pass's dramatic entrance is untouched and does not collide: a
Guardian never leads a fight, so a staged arrival is still only ever a mid-fight
event.

### Verification

The standard method: a throwaway `introharness.html` + `src/app/introHarness.tsx`
mounting the real `FightScreen` against a real `generateEncounter` pair, with
`imposingPresence` pushed onto both player leads' `bonusPassiveGrants` (its only
real source is a map event, too many clicks deep to reach for a view check).
`?p=0` drops the passive and `?loc=none` goes placeless. Both files deleted before
committing.

Read as a recording rather than as a screenshot, since the thing under test is a
sequence: `.combat-banner-current`, `.combat-banner-hint` and `.move-button`
sampled after each synthetic tap.

- With none: the engagement beat **holds indefinitely** with no tap (`moveBtns=0`,
  hint reads `tap ▸ or hold to auto-play ⏵⏵`), and **one** tap puts 4 move buttons
  on screen. One tap, exactly as asked.
- With two holders: hold → tap 1 → `IMPOSING PRESENCE · CORTEX AND CRIMSON /
  ATK -10` → tap 2 → the second holder's identical beat → tap 3 → console. Input
  gated for the whole intro.
- Placeless: the lead reads `BATTLE`.

Under the auto-advancing first cut, the same harness proved the board and the
**battle log after skipping were byte-identical to watching** — six lines, both
`Imposing Presence triggers` and all four `attack -10`. That property is now free:
with no skip path, there is only the one path.

`npm run typecheck:view` and `npm test` (720 passing) pass.

One thing found by looking at it and **not** fixed: two holders of the same
passive produce two consecutive beats with identical text, distinguishable only by
the headline replaying its arrival animation (`beatSeq` remounts it). That is
pre-existing `buildBeats` behaviour for any repeated passive and reads the same
mid-fight, so it is left alone rather than special-cased here.

## Sixteenth pass — an item is a picture, not a sentence (2026-09-06)

Per user direction, alongside the item rework: **wherever an item is part of a hero's KIT it is
drawn, not written.** `ItemBox` (`src/view/shared/EquipmentBox.tsx`) is the one representation —
the item's silhouette in a square, rarity-edged box, no label. The name and the full effect list
are one tap away (`ItemSummaryPopup`), and both stay in the `aria-label` and the `title`, so the
text is unprinted rather than lost.

What forced it: a hero holds up to five items now, and the forced-equip table shows six heroes at
once. Printing a name per slot was thirty item names on one screen, and the names were never the
thing being decided — the diff underneath was.

Three rules came out of the pass, and the boundaries are the interesting part:

- **A box replaces a name only where items are SCANNED.** The forced-equip spotlight (the item
  the screen is about) keeps its name, rarity and full effect list. So does the "which of these
  goes?" replace picker — that list *is* a choice between two held items, and telling them apart
  by silhouette alone is not a fair thing to ask.
- **Where items are CHOSEN, the words become marks instead of vanishing.** Reward cards, the Guild
  Hall shelf and the Compendium dropped `"+50 Attack · Sunder"` for `ItemEffectChips`: a stat glyph
  and its number, an element glyph for an Elemental Force, a passive's own glyph. Picking one of
  three by silhouette would be picking blind; the chips keep the comparison possible at a third of
  the width.
- **Tap means "what is this", except where tap already means something.** Read-only grids (hero
  sheets, previews) summarise on tap. Manage Roster's tap selects and moves gear — that screen's
  entire job — so there it is a hold. One behaviour, two gestures, and the gesture is decided by
  what else the surface has to do.

The cost, stated plainly: the icon is derived from an item's NAME (`equipmentForm`), and ~30 forms
cover 106 items, so two items can share a silhouette and be told apart only by rarity colour. That
is the trade the density buys. If it bites in playtest, the fix is more forms, not more labels.

Measured on the Manage Roster screen: six heroes went from filling the panel and scrolling to
fitting with room to spare.

## Seventeenth pass — the figure carries the fight (2026-09-06)

Every combat animation up to here was on the CARD. On the battlefield there is no card: the
fourth pass stripped the box, the border and the background off `.team-row .combatant-card` and
moved every signal onto the figure. So an attack landing was a rectangle glowing behind a hero
who never moved, and the hero who threw it did nothing at all.

Three things now happen to the sprite. **The actor cuts to an action frame and leans at the
other row. Whoever it hits cuts to a wound frame and reacts. Every swap between two frames is
covered by a flash.**

The load-bearing decision is that **a pose is a STATE, not a one-shot.** It is up for exactly as
long as the console is narrating the line that put it there — the declaration, the damage, the
rider, the KO — and drops on the first beat that isn't about it. A beat lasts as long as the
player takes to tap, so a pose on a timer is gone by the time they read the damage line it
belongs to. Which figure is mid-move comes from `buildBeats` (`strikeCombatantId`), stamped at
the declaration and carried until an event arrives that cannot belong to that action — a round
boundary, a DoT tick, a switch, the Pact.

That also settles the timing, which is otherwise the hard part. The recoil is the only one-shot,
and it fires on the beat its damage is announced, which is a beat where the attacker's pose is
already up. The two halves read as one exchange **without being timed against each other at
all** — nothing to tune, and nothing that can drift when the player reads at their own pace.

The reaction is graded by what caused it, which is where the vocabulary earns its keep:

- `.hit-struck` / `.hit-crit` — a blow, or a Poison burst. Knocked away from the attacker,
  blown out to near-white on the frame of contact, settling through a shake. Direction is read
  off which row the figure stands in (`--hit-knock`), so it works for either side unchanged.
- `.hit-wince` — a Burn or Bleed tick. Same wound frame, but the figure **sags under its own
  weight** rather than being knocked anywhere, on a slacker curve, never blowing out. Nothing
  threw this and it must not read like something did. Poison sits with the blows instead,
  because it does not tick down — it bursts once for everything at the end.
- `.releasing` — the flash over the swap OUT of a pose. Entering one is masked by the opening
  frame of its own animation; leaving one had nothing, so the sprite cut and the drop out of the
  lean happened raw. `usePoseRelease` sets that class **during render** rather than from an
  effect: an effect lands it one frame after the swap it exists to hide, and one unmasked frame
  is the whole artifact.

**To give a hero its frames: drop `<name>attack.png` and `<name>damaged.png` beside its idle
`<name>.png`.** That is the whole job — no import, no table, no code. `heroPoses`
(`src/view/shared/heroArt.ts`) is discovered from an `import.meta.glob` over the figure
directories, and every behaviour above is keyed on hero id and has worked for the whole roster
since the frames existed. Either frame may be omitted; a hero keeps its idle sprite for whatever
is missing.

Three details are load-bearing:

- **The convention follows the SPRITE filename, not the hero id.** Those differ across most of
  the roster (`fang.png` is `packAlpha`, `solace.png` is `dawnwarden`), and whoever is drawing
  the art is thinking of the character. The idle sprite is what ties a hero id to a filename, so
  there is no second table to keep in sync.
- **The glob is scoped to `art/heroes` and `art/enemies`.** `art/` also holds ~2,200 icons; an
  eager glob over all of it would bundle every one. Those two directories hold 82 files of which
  80 were already imported, so the discovery costs nothing on top of what the page loads anyway.
- **Dead art is caught in dev, in two grades.** Naming by convention gives up the build error a
  hand-written import got, and the failure it gives up is the worst kind — a frame that never
  appears and nobody notices for weeks. So a correctly-suffixed file no hero claims *throws*, and
  any other undrawn sprite *warns* and names the rename it probably wants. The second grade is
  the one that would have caught `fangattacking.png`; the first is deliberately not fatal for
  work-in-progress art, which has to be allowed to sit in the folder.

Which heroes have frames is not recorded anywhere but the art folder, deliberately — the list
would be stale by the next commit. `heroArt.ts` warns in dev about any sprite nothing draws,
which is the closest thing to a roll-call worth keeping. The only thing between the rest of the
roster and the same treatment is the art.

## Eighteenth pass — the CTA plate (2026-09-08)

*Per user direction: "in general I don't like how many buttons in the game are just a solid
yellow button — it doesn't feel like part of an atmospheric, immersive video game, it feels
like web UI vibe coding stuff."*

`.resolve-button` was a flat gold slab on roughly thirty screens — every Continue, every
Confirm, every Start Fight — plus the post-fight Continue, which is the most-pressed button in
the game. The ninth pass had already made it big and lifted it off the bottom edge; what it
never questioned was the fill. A saturated rectangle of one hardcoded hue, repeated on every
screen, is the one element in the app that belongs to no place in particular. The rooms around
it had meanwhile become places: `--node-rgb` is set on every node screen root and on the map,
and the sky, the header eyebrow, the title bloom and the readout all take their light from it.
The button sat in that light wearing gold.

**It is now a dark forged plate lit by the room's own hue.** A near-black metal face with a
diagonal sheen, a wash of `--node-rgb` pooling at the top and bottom edges, a rim in the same
hue with a brighter top edge, and an outer glow that comes up on hover. The label is the hue
mixed toward white, not black ink on a fill. Nothing about it is hardcoded: the same control is
green at Wild's Edge, violet at a Boon, teal at the Class node, gold at a Banner, and the drop's
own rarity on a forced equip — because `.node-screen` already carried that information and the
button now simply reads it.

Three consequences worth stating:

- **Gold now means something.** It survives on exactly three presses — `.title-cta`,
  `.draft-cta` and `.recruit-leave.is-only-option` — the run's terminal commitments, which
  already shared a gold gradient and a pulse and were previously indistinguishable from the
  Continue button directly beneath them. A treatment that appears three times a run reads as
  ceremony; the same treatment thirty times an act reads as a default.
- **Dismissing is not advancing, and now looks like it.** `.roster-close-button` and
  `.sheet-close-button` were initially left on the gold slab — they live on full-screen sheets
  with no other control on them, so the loud fill cost nothing there. Once everything around them
  went dark that stopped being true: Close became the loudest control in the app, on a sheet that
  already carries an ✕ in its corner doing the same job. They now take the plate with the room's
  light switched off — a single neutral `--cta-rgb`, and the gray rim, gray label and absent glow
  all follow from it. Same material as a CTA, so it still reads as the sheet's one control; no
  hue, so it never competes with a button that is actually spending something.
- **Disabled stopped being an opacity.** At `opacity: 0.32` a dark plate on a dark screen is
  gone, where the gold slab it replaced was merely quiet. It now drops the hue entirely and
  becomes an inert gray plate at 0.55 — legible as a control, unmistakably not the one to press.

Two mechanical notes, both of which cost a round of screenshots:

- **The plate cannot live in a `:root` token.** A `var()` inside a custom property is
  substituted where that property is *declared*, not where it is used, so a `--cta-plate` on
  `:root` bakes in `:root`'s `--cta-rgb`. With `--cta-rgb` undefined there the whole token goes
  guaranteed-invalid, and the button rendered fully transparent — the treeline showed through
  it. The plate is one rule with two selectors instead (`.resolve-button, .result-panel
  .result-buttons button`), and the post-fight Quit button had to be re-scoped through
  `.result-panel` to keep outranking it.
- **Dark does not mean darker than the sky.** The first correction over-shot to a `#191d27`
  face, which read as a wireframe outline. The plate has to be a *lighter* dark than the room it
  stands in — in the same family as `--panel-alt` — which is what makes it an object sitting in
  the scene rather than a hole cut in it.

## Nineteenth pass — the line of battle (2026-09-08)

The fourth pass took the boxes off the battlefield figures and the seventeenth gave them poses.
The arrangement they stood in never changed, and it was still a 2x2 lattice: four figures dead
centre in four identical 181x185 cells, both rows level, both at the same width. A hero with no
box around it, standing in a cell, still reads as a hero in a box.

Three things were drawing that lattice.

- **Both sides read top-down.** Portrait, then 81px of readout under it — on both rows. So the
  screen ran figures / readouts / horizon / figures / readouts, and each side's own scoreboard
  stood between it and the enemy. The two teams were ~340px apart with a wall of UI in the gap.
  Nothing about that is a confrontation.
- **The readout was 177px wide against a 74–104px platform.** The loudest, widest, flattest
  object on the screen, in four identical copies at four identical offsets. The bars *were* the
  grid lines; the figures were what sat inside them.
- **No depth anywhere.** No stagger, no overlap, no perspective, and a floor textured with
  uniform 26px squares — literal graph paper, which is a diagram of a place rather than a place.

### What replaced it

**MIRROR.** `.team-row.enemy .combatant-card` is `column-reverse`, so a side's readouts sit at
the edge of the screen it belongs to and its figures at the horizon. Both teams now stand *on*
the line, ~50px apart, with the instruments framing them top and bottom — Pokémon's own
arrangement, and the single change that does most of the work. It also finally pays off the
fourteenth pass: the Location's treeline, anchored at the divider, stopped sitting behind the
enemy's HP bars and started sitting behind the enemy.

**PLATE.** Name and both bars are one object now (`.combatant-plate`, grouped in the markup so
the DOM sequence stays the reading sequence on both sides), `--figure-plate-w` = 146px wide —
sized to the ground the hero stands on rather than to the cell it was allotted. It is drawn as a
soft scrim, not a panel: it was built once as a proper instrument, filled and hairlined with a
type-tinted edge, and four of those is four boxes again. The scrim also does the contrast job
the name pill's own scrim used to, which is why that pill could go.

**FORMATION.** The far line stands on smaller, dimmer ground — 74px platforms against the near
row's 104px — with a `brightness(0.93) saturate(0.9)` haze on its sprites, folded into
`--figure-shadow` because the strike and hit keyframes replace `filter` wholesale and anything
declared beside the token vanishes for the length of every animation. No scale: the art is 48px
pixel art and any non-integer factor makes some source pixels 1px wide and others 2px.

**Horizontal perspective — the far pair standing closer together — was tried twice and removed,
both times reported from a phone.** As `padding` on the row it insets the whole card, and a card
is not only a figure: it carried the far type chips 13px right of the near ones directly below
them and the far nameplate 13px off the plate below it, so the two lines stopped sharing a column.
Moved onto the stage it insets only the figure, which is worse in a quieter way — the sprite
slides off the centre of its own HP bar, and in the right-hand slot it slides straight into the
type chips pinned at the card's left edge, closing a 12px gap to nothing.

There is no third place to put it. A figure's nameplate and its type chips are positioned against
the card, so either they travel with the figure or they do not, and those are the two faults. This
is the same 13px order as the within-line stagger, and it failed the same way: **too small to read
as distance, large enough to read as misaligned.** Twice now on this screen, a horizontal offset
under ~15px has been reported as a bug before it was ever read as depth. The haze
is folded into `--figure-shadow`, because the strike and hit keyframes replace `filter` wholesale
and anything declared beside the token vanishes for the length of every animation. Each side also
gets a pool of light both its figures stand in, so a pair shares a piece of ground rather than
each having a private ellipse in the dark.

**Depth *within* a line was tried twice and removed.** One figure per row pushed 10px toward the
divider (the only direction either side has slack in — the other way is 10px into its own MP
bar), platform sizes following. The first arrangement pushed opposite columns, which gives four
distinct depths and still leaves both lines tilted the *same* way, right-hand figure higher on
each. That was reported from a single screenshot as *"are the heroes on the right raised slightly
higher, why is that."* Pushing the same column instead makes the two lines lean against each
other, which is geometrically the better answer and was still not worth it: ten pixels is too
little to read as perspective and just enough to read as misalignment. It was reported as wonky
twice before it was read as depth once.

The lesson generalises past this screen. The lattice was already broken by the mirror and by the
two rows being different widths; the stagger was buying a margin that was not needed, at a cost
that was. **Between the lines is where depth belongs here** — that difference is 140px and reads
instantly. Within a line there is no room to make an offset large enough to mean something, and
anything smaller reads as a bug.

**FLOOR.** `.battlefield-floor` — a `repeating-conic-gradient` fan centred on the horizon, masked
to nothing at the horizon (where a fan converges into moiré) and up to full at the two screen
edges. One element for both halves, because sharing the vanishing point is what makes the enemy
ground and the ally ground read as one field with a line across it rather than two stacked
panels. Location-independent on purpose: all six recipes replace the background stack wholesale,
and a floor's geometry is not a mood.

**THE PLACE ON BOTH SIDES OF THE LINE.** The Location's skyline band was anchored at the divider,
behind the enemy row — correct when it was written, since that is where "over there" is, and it is
what the fourteenth pass built the divider into a horizon for. But it left every scrap of a
Location's terrain in the half of the screen the player looks at least, and the half they read
every turn, with their own two heroes in it, had nothing but light. So the skyline renders
**twice**: the far band small and hazed at the divider, a near band at the bottom edge that the
player's figures stand in front of. Two bands at two scales is what a landscape does anyway — the
same trees are large here and small over there — and it is what makes the arena read as one
continuous place rather than a backdrop hung behind the enemy.

Three details, each found by looking:

- **The near band is magnified 2x and offset, and flipped.** There is one skyline drawing per
  Location, so drawn at the same size in the same place it is visibly the same picture twice. On
  the Storm Coast that is two identical shipwrecks, one behind each team, which is worse than
  having no near band at all. Cropping a magnified window off-centre lands on different shapes —
  and 2x is what a foreground wanted regardless.
- **Its mask fades upward, the opposite of the far band's.** The far band has to dissolve its own
  ground slab *downward* into the horizon glow. This one meets the screen's bottom edge, where a
  solid base is correct, and has to dissolve the *tops* of its shapes instead — those are what
  cross the ally nameplates, and HP is not negotiable against scenery.
- **No blur on it.** The far band carries half a pixel as depth-of-field; repeating that here
  would put the near terrain in the same focal plane as the thing it is meant to be nearer than.

The perspective fan **replaces** the tactical grid rather than layering over it. Seven pairs of
`repeating-linear-gradient` — the placeless stack plus all six recipes, weighted per location so
that the foundry had a plated deck and the forest nearly none — came out in this pass. Axis-aligned
26px squares are the one texture that cannot help but draw a lattice, which is the thing the pass
exists to undo, and once the figures were staggered the grid was the last object on screen still
insisting they were not. Nothing was lost by it: on the Foundry the fan picks up the floor's own
heat and reads as plating better than the squares did.

Strike reach and hit knockback went 7px → 11/10px in the same pass. They were sized when a lean
could only ever be a twitch in place; across 50px of horizon a lean is a step toward somebody,
and the room it travels into is the empty divider band.

**A wrapped status band moves nothing.** The band is the one part of a figure whose height is not
knowable in advance — four chips fit on a line, five do not — and it used to be free to shove its
own figure, nameplate and HP bar 28px down the screen, out of line with a partner carrying fewer.
Three rules together make it inert:

- `.team-row` has a **fixed** height, not a min-height, so a wrap cannot push the horizon, the
  other row or the console.
- The cards pack at **`flex-start`** — which `column-reverse` puts at the far card's bottom and
  `column` at the near card's top, i.e. the divider in both cases. Everything a player reads is
  therefore anchored to the horizon, and the band grows outward toward the screen edge.
- The band is **`flex-shrink: 0`**. Without it, it is the item that gives when the card's height
  is pinned: the second line got squeezed back into one line's worth of box and its chips spilled
  downward across the hero's own name.

The arena's outer padding is then sized to hold exactly one wrapped row
(`--figure-status-h + --figure-status-gap`), paid for by dropping the battlefield's 8px row gaps —
those dated from when the divider was a rule between two panels rather than a horizon with a band
of its own. Net cost 12px of console. A *third* row still clips at the screen edge; that is seven
or more simultaneous statuses on one hero, and clipping the outermost chips is a much better
failure than moving the HP bars.

HP and MP did not move off the screen, get smaller, or become a hover. They are the two numbers a
player reads every single turn. What changed is that they stopped being the widest thing on the
field.

### Verification

Harness (`fight-harness.html` + `src/app/fightHarness.tsx`, both throwaway) mounting `FightScreen`
from a quick-battle encounter, driven headless over CDP — the standard method from the ninth pass
on. Checked: command phase placeless and in four Locations, targeting, a resolving strike pose, a
damage popup's landing point, a KO'd slot's replacement placeholder, and the bench/switch panel.

Four absolutely-positioned things measure from the card and so had to learn where the stage went
on the mirrored side — the type chips, the KO tag, the floating damage number, and the stat-mod
rim ticks. The damage number is the one that matters: unfixed, a hit landing on the far row puts
its numeral on the attacker's own nameplate. The empty-slot placeholder is the other correction —
it has no figure and so no plate to sit on, and keeps the scrim pill the name gave up everywhere
else.

## Twentieth pass — the Titan gets a body (2026-09-09)

*Per user direction: "currently it's just some words, some faint ambiance, and some rectangles.
I want the title screen to sell the Titan and/or PACT part of the game better."*

### What was wrong

The title screen had had an atmosphere pass — fog bands, a mote field, grain, a vignette, a
godray burst behind the wordmark — and it worked, but it was atmosphere around *nothing*. The
subject of the screen was a word. Both halves of the name were unrepresented: there was no
Titan anywhere in the frame, and the pact was a noun in the logo rather than a thing the
picture was about. A player who had never heard of the game learned, from the whole first
screen, that it was called Titanpact and that somewhere it was foggy.

The second problem was arithmetic. The content stack is vertically centred, and on a 754px-tall
box a wordmark, a tagline and two buttons leave roughly 230px of unbroken black under the last
button. Empty space at the bottom of a title screen is not restraint; it is the screen running
out of things to say a third of the way down.

### What replaced it

**A bound colossus, and the run's premise, in one image.** Back to front:

- **`.title-backlight`** — a cold shaft behind the head and the sick green of the seal's ground
  low in the frame. It is emitted *before* the figure and both sit at `z-index: 0`, which is
  the whole trick: everything in `titanArt.tsx` is a hole cut in this light rather than a shape
  drawn on top of the dark. The moment the figure is lighter than what is behind it, it stops
  being a thing in the distance and becomes a decal on the glass.
- **`TitanColossus`** — a chained figure with no top of head at all: the skull dissolves upward
  out of the frame, because a colossus that fits in frame is not one. One flat near-black fill
  for every plate; the structure is carried entirely by open rim polylines along the edges the
  sky can actually reach. It breathes on an 11-second cycle, the rim swells on 13, the eyes
  gutter on 8.3 and a broken length of chain swings on 7.4 — four periods that never divide into
  each other, so the figure never returns to a pose it has held.
- **The eyes are `TitanWakeScreen`'s eyes**, at a hundredth the size and lifted stop for stop:
  the same lens tapering to points at both corners, the same globe ramp (pale gold core out
  through `--tier-mythic-rgb` to almost nothing at the rim), the same vertical slit held
  contracted, the same halo bleeding past the lids. The backlight behind the head went from cold
  cyan to that same ember for the same reason. **This is the throughline, and it is worth the
  one warm exception on a screen that is otherwise deliberately cold:** the thing the title is a
  picture *of* is the thing the run opens on, and it should be lit the same way in both.
- **The pact seal** — three counter-rotating rings on the Titan's chest with the wordmark
  struck across them. That is the composition the whole screen is arranged around: TITANPACT is
  not a caption on the picture, it is the mark burned into the thing in it. Five sigils ride the
  middle ring, one per Guardian, and **the fourth one has gone out** — the binding is failing at
  the moment the player picks it up (`docs/lore.md` §1), said once in a dead mark instead of in
  copy.
- **`TitanRidge`** — the only layer in front of the fog, and the one that earns the bottom third
  back. Four pactbearer figures ~15px tall stand on a near crest against the horizon glow, with
  a further crest and three broken warden towers behind them. A silhouette the size of the frame
  is only big if something known-small stands in front of it; the ratio here is about forty to
  one, and it is the entire reason the figure reads as a Titan rather than as a statue.
**And then no words at all.** The first version of this pass added copy to carry the premise —
an eyebrow line above the wordmark (*the last binding is failing*) and a "Seal the pact" whisper
under the CTA — on top of the tagline that was already there. Per user direction all three came
off, and the screen is better for it: the title now runs wordmark, button, Compendium, and the
picture does the rest. **The lesson is worth keeping.** Every one of those lines was written to
say something the image had *already been built to say* — the dead sigil says the binding is
failing, the seal under the wordmark says the run is a pact — so each was a caption on a picture
that did not need one. A screen that has just learned to speak visually is exactly the screen
where the old copy has to be re-read as redundant rather than kept as belt-and-braces.

**The pact button.** The gold CTA was still the rounded rectangle the eighteenth pass left it
as. It is now a chamfered struck plate: two cut corners (four would read as a ticket stub), a
5px bezel, a hot rim along the top edge falling to the same bronze the wordmark ends on, and a
specular that crosses it every 5.2 seconds and is off-screen for the rest of the cycle — so the
button spends most of its life still and the sweep is an event rather than a shimmer.

**And it comes in two metals.** Continue and Start were the same gold plate, which said they
were the same act, and they are not: one strikes a pact and the other picks one back up.
Continue is now **verdigris** — the identical plate in oxidised copper, a metal struck a while
ago and since weathered — while gold stays with the run that has yet to begin. Green rather than
any other second colour because the screen already owns it: the horizon the pactbearers stand
against is this hue, so the button belongs to the picture rather than arriving from outside it.
Two notes on doing this without a parallel copy of the CSS:

- **A tone is a list of custom properties, declared on `.title-screen`** (`--plate-face`,
  `--plate-bezel`, `--plate-ink`, `--plate-etch`, `--plate-sheen`, `--plate-flare`,
  `--plate-rgb`, `--plate-bloom-rgb`, `--plate-dusk`), and every layer under it reads them. On
  the *screen* rather than on the button because the launch shockwave and white-out are
  siblings of the button, not children of it — they can only inherit a palette from an ancestor
  they share, and the whole point is that pressing Continue blooms verdigris while pressing
  Start blooms gold. The launch state is `filter: brightness()` on the plate rather than a
  second gradient, so an overdriven plate is the same plate in either metal. The eighteenth
  pass's warning still applies: these cannot live on `:root`, because a `var()` inside a custom
  property resolves where the property is *declared*.
- **The first verdigris was mint candy.** Lifting the top two stops nearly to white made the
  plate paler and sweeter than the gold it is supposed to defer to — a secondary action reading
  louder than the primary. Every stop now sits a shade under its gold counterpart, which is what
  makes it read as the older of the two metals rather than the brighter.

Continue also lost its two sub-lines (the act/place/roster line and `saved 2h ago`). They were
answering "is this the run I remember" on a screen that only ever holds one save, so the
question could not arise; `savedAgo` and `parkedRunLabel` went with them.

### Three mechanical notes

- **A `clip-path` takes the box-shadow with it.** Chamfering the plate deleted its glow, which
  is why the button is three nested elements: the socket carries the outer light on a `filter:
  drop-shadow` the clip never touches, the frame under it is a slightly larger chamfered plate
  showing through as the bezel, and the sweep is a child inside the clip where it belongs. The
  idle pulse had to move from `box-shadow` to `filter` for the same reason.
- **The chamfer ate the keyboard focus ring too.** The global `:focus-visible` rule sets
  `outline: none` and delivers the ring as a box-shadow — which this button clips away — so the
  one control the whole screen is built around would have focused invisibly. The hairline etch
  inside the plate is a `::after`, and it thickens on `:focus-visible` to serve as the ring.
- **`radial-gradient(circle, …)` sizes to farthest-CORNER.** The seal's tick ring is a masked
  `repeating-conic-gradient`, and a bare `circle` put the annulus at radius ~100 on a 300px box
  instead of ~150, floating the ticks well inside the ring they graduate. `closest-side` is
  load-bearing.

### What looking at it changed

Three things were only visible in a screenshot, and all three were the same mistake — a shape
that is correct in outline and wrong in *contrast*:

- **Four attempts at a top-of-head, and the fourth was not drawing one.** The head was authored
  with a crown and horns, and every version read as something else: horns leaving the temples
  and sweeping outward put a horizontal line at the widest part of the skull with a dome above
  it, which is a **cowboy hat** (the user's word, and unmistakable once seen); moving them to
  the crown and steepening them made **rabbit ears**; thickening them against a flat crown made
  a **chimney**. The diagnosis was the same every time and it was not the shape — it was that
  the top of the frame is the one place with no backlight to silhouette against *and* the
  vignette crushing it on top of that, so a horn's fill was invisible and only its two rim
  curves showed, i.e. a wireframe. `TitanWakeScreen` never draws a top of head either. The skull
  now dissolves upward through the same mask that dissolves its feet into the fog, and what is
  left — a mass, a brow, a jaw and two lights — reads as a head too big for the frame, which is
  what all four attempts were reaching for. **When a shape keeps reading as the wrong object,
  suspect the light before the outline.**
- **A shoulder that curves away from the throat in one arc is a hood.** The first figure read as
  a bowling pin. The trapezius now runs almost flat out of the neck before it turns down, and
  that shelf is the single line doing the most work in the whole figure.
- **The pauldrons were tucked under the shoulder line**, tracking the body's own edge a few
  pixels inside it, so two near-parallel rims read as one thick line. They now rise *above* the
  shoulder they sit on, which is what makes them plates rather than thickness.

The chains were relocated twice for the same reason and are worth stating as a rule: the
wordmark is nearly the full width of the canvas, so **nothing decorative can share its band**.
The binding is now kept to the collar above it, the two flanks outside the buttons, and one
heavy span across the waist in the band the layout leaves empty — which is the one place where
the atmosphere and the dead space solved each other.

### Verification

Screenshotted through the harness in `reference-screenshot-harness` at 394x780: the idle screen,
the launch beat mid-bloom, the parked-run variant (Continue over Start a New Run, which shifts
the whole stack up and still composes), `prefers-reduced-motion: reduce` (the global collapse
holds a legible final state on every new layer — the sweep parks off-plate, the dead sigil stays
dead), and the CTA under `:focus-visible`.

## Twenty-first pass — the last emoji come off (2026-09-10)

*Per user direction, after a friend's note that "there are screens in the game that feel like web
UI." An audit of ~30 screens at 394x780 found six recurring web idioms; this pass takes the first
and most mechanical of them.*

### What was wrong, measured

**~30 colour emoji were still standing in for icons**, across 16 files — 💰 ⚔️ 🛡️ 📜 🔩 ⚒️ 🏛️
🚪 🗑 🪙 👥 📖 🔊 🔥 🩸 🧪 💚 👻 ⚡ 🔒. They are the single loudest tell in the audit and the
cheapest to fix, because **the vocabulary to replace them already existed**: `nodeIcons`,
`sectionIcons`, `statIcons`, `statusIcons`, `equipmentIcons` and `RunGlyph` between them already
drew almost every concept the emoji were naming. These were simply the sites nobody converted.

Two of them were doing real damage rather than merely looking off:

- **`👥`, in a rounded square, top-right of EVERY node screen in the run** (`RosterPeek`, and
  `SquadSelectScreen`'s own copy). It is the first thing the eye lands on on the Guild Hall, the
  Blacksmith, every reward, the Boon, the Mentor, the Crucible, the Banner and the act intro — and
  it is a Segoe/Apple drawing sitting on top of an otherwise authored screen. `HUB_PATHS.roster` —
  two figures, drawn for the map footer — was already there and already correct.
- **The section headers.** `⚔️ Recruits`, `🛡️ Equipment`, `🔩 Item Slots`, `⚒️ Anvil & Enchanter`,
  `⚔️ Scouted Enemies`, `🛡️ Arrange Your Squad`. A colour emoji beside 12px letterspaced caps is the
  exact composition of a web page's section header, and it is why the two shop screens read as a
  pricing page more than any other single detail.

### What replaced it

Every site now draws from the icon modules. One picture per concept, and it mostly just names
glyphs that already existed:

| Was | Is | From |
|---|---|---|
| `👥` roster corner | two figures | `HUB_PATHS.roster` (already drawn) |
| `📖` Compendium | open tome | `HUB_PATHS.codex` — the Mentor node's `OPEN_BOOK`, shared on purpose |
| `📜` Reference / Battle Log | ruled scroll | `HUB_PATHS.reference` |
| `📜` Recruit Contract | quill | `ResourceGlyph kind="contract"` |
| `💰` `🪙` gold, sell | money bag | `ResourceGlyph kind="gold"` |
| `⚔️` Recruits, Scouted Enemies | crossed swords | `SECTION_PATHS.moves` |
| `🛡️` Equipment | chest | `SECTION_PATHS.equipment` |
| `🛡️` Arrange Your Squad | heater shield | `STAT_PATHS.defense` |
| `⚒️` Anvil & Enchanter, and its price button | anvil on its stump | `NODE_PATHS.forgeReward` |
| `✦` Enchant | four-point spark | `STAT_PATHS.intelligence` |
| `📊` Reference row | shield with a bolt through it | `SECTION_PATHS.matchups` |
| `🔥🩸🧪💚👻⚡` in beat popups | the status's own mark | `STATUS_PATHS` |

**Shield versus swords is the one place the swap added information rather than preserving it.**
Squad Select's two headers were `⚔️` and `🛡️`, which said nothing; crossed swords over the scouted
enemies and a shield over your own squad says *theirs* and *yours* in the mark alone.

**The status popups needed a contract change, not a substitution.** `BeatPopup` carried a `text`
string with the emoji baked into it, so a Burn tick was the literal string `"🔥 -14"`. It now
carries an optional `glyph` — a status id — which `CombatantCard` draws as a `StatusGlyph` ahead of
the number. That is strictly better than what the emoji did: the popup now wears **the same mark the
figure's shoulder cluster is already wearing**, so a `-14` floating off a hero points back at the
badge that caused it. `.dmg-popup-glyph` is sized in `em` because the popup is 15px on a bench card
and 17px on the battlefield, and the mark has to track the numeral rather than be set twice. The
emoji also rode in `bannerLead` and came off there with nothing to replace it — the console banner
already colours itself by `bannerFocusKind`.

### Nine new glyphs, and what looking at them changed

The rest needed authoring: `door`, `discard`, `warn`, `sound`, `mute`, `trophy`, `lock`, `hand`,
`hall`. They were drawn blind, then rendered as a contact sheet at 14 / 16 / 18 / 22 / 36px — which
is the whole method, and two of the nine failed it outright:

- **A door is not a door.** The first `door` was a slab with a knob hung in its jamb. Below about
  22px the 3-unit jamb and its 1.6-unit gap both land under one pixel, and the glyph reads as *a bar
  beside a box*. It is now an **archway** — the opening rather than the slab that fills it — which
  survives because it is ONE object whose hole is a third of its own width. A second attempt, an
  arch with legs, read as a horseshoe magnet; the flat-bottomed inner arch is what stops that.
- **A 24-unit box holds one object.** `slots` was two `.item-piece` silhouettes side by side, one
  filled and one hollow, the pair being the information. At 14–18px they are two dots: at 0.62 scale
  a 3-unit chamfer is half a pixel. Overlapping them made a blob. The glyph is now a single open
  **`hand`**, which is what the Forge node has always called this ("Another Hand Free"), and which
  reads at every size because a hand is a silhouette rather than a construction. **Capacity is not
  gear**, so it is deliberately not the chest the Guild Hall's shelf wears.

This is the twentieth pass's four-attempts-at-a-top-of-head lesson arriving from the other
direction: there a shape kept reading as the wrong object because of the *light*, here because of
the *size*. Both are invisible until something is rendered and looked at.

The two headers that took a glyph also needed `.section-glyph`'s 16px raised to 18 — crossed swords
rotated 45° are two 4-unit blades, which go spindly at 16px beside 15px bold text.

**The Dev menu's `🧪` rows are deliberately untouched.** They are throwaway fixtures already marked
as such, and drawing them properly would make scaffolding look shipped.

### Verification

Typecheck clean, 988 engine tests passing, and the affected screens screenshotted through the
harness in `reference-screenshot-harness` at 394x780: the title, Records, the Compendium, the map
Options sheet, Squad Select, the Guild Hall, the Blacksmith, and a fight in progress.

### What this pass did NOT touch

The five other idioms the audit named, in the order they are worth doing:

1. ~~**The colored-left-border list card**~~ — done in the twenty-second pass below.
   Was: — `border-left: 3px solid <hue>` on a dark rounded rect
   with a bold title, a gray sentence and a caps label, i.e. Bootstrap's `alert` / `list-group-item`.
   **16 components wear it**: `.status-ref-row`, `.evo-path-card`, `.item-readout`,
   `.passive-readout`, `.roster-card`, `.squad-slot`, `.relic-card`, `.guild-hall-hero-card`,
   `.guild-hall-contract-row`, `.equip-cache-card`, `.boon-shrine-card`, `.equip-spotlight-passive`,
   `.equip-target-card`, `.hero-grid-card`, `.sandbox-hero-card`, `.swap-option-badge`. The Reference
   overlay, the Boon shrine, the Mentor's Hall, the Equipment Cache and the Guild Hall are the same
   list in different hues. One shape, sixteen places — the highest-leverage fix left.
2. ~~**The Guild Hall and the Blacksmith**~~ — done in the twenty-third pass below. Was: — shopping-cart line items, a form-validation sentence in
   orange, a right-aligned italic hint in a table-header row, and (the Blacksmith) a screen that
   titles itself twice. Open item 6 below has exempted the Guild Hall since the ninth pass.
3. ~~**The map is inside a card**~~ — done in the twenty-fourth pass below. Was: — a header rect, a body rect and a footer rect, each with a 1px
   border and a radius, around a scene. The fight screen's own rule ("a place, not a container") has
   never reached it.
4. ~~**The hero sheet**~~ — mostly a MISREADING; see the twenty-fifth pass below, which corrects it. Was:
   an iOS-style bottom tab bar with superscript count badges, a three-sentence
   paragraph of documentation prose about growth grades, and ~400px of empty panel under ITEMS.
5. ~~**The KPI tile grid** on Records and Run Summary~~ — done in the twenty-fifth pass below. Was: — a big accent numeral over a small caps label,
   2-up. A SaaS analytics dashboard, verbatim.

Two measured defects worth fixing alongside those:

- **Dead vertical space.** Tallest empty band per screen: Crucible **416px, 53% of the phone**,
  reward-equip 177, Forge 167, Boon 161, Banner 161, Tutor 157, draft 153. The Gold Cache and the
  act intro *compose* their space and are the counterexample to copy.
- ~~**`.resolve-button:disabled` reads as a bug**~~ — fixed in the twenty-third pass. Was:, not as a waiting control: at `opacity: 0.55` over a
  node screen's parallax, the mountains are visible through the button.

## Twenty-second pass — the list-row marker comes off nineteen cards (2026-09-10)

*Second item from the same audit. The first pass took the emoji; this one takes the shape.*

### What was wrong, measured

**Nineteen components carried their identity colour as a 3px bar down the left edge** of an
otherwise gray rounded rectangle:

`.status-ref-row` · `.evo-path-card` · `.item-readout` · `.passive-readout` · `.roster-card` ·
`.squad-slot` · `.relic-card` (and through it `.boon-shrine-card`, `.class-shrine-card`) ·
`.guild-hall-hero-card` · `.guild-hall-contract-row` · `.equip-cache-card` · `.equip-target-card` ·
`.equip-spotlight-passive` · `.hero-grid-card` · `.sandbox-hero-card` · `.swap-option-badge` ·
`.item-service-row` · `.move-tile` · `.mastery-hero-row` · `.level-up-row`

That is Bootstrap's `alert` / `list-group-item`, and it was the most-repeated surface in the game.
The Reference overlay's Statuses and Passives tabs, the Boon shrine, the Mentor's Hall, the
Equipment Cache, the Guild Hall's shelf and the Blacksmith's item services were **the same list in
different hues** — which is why those screens read as a documentation page and a pricing page
rather than as places.

The count is four higher than the audit first reported, because `.move-tile`, `.mastery-hero-row`,
`.level-up-row` and `.item-service-row` write `border-left-width: 3px` on a separate line instead
of using the shorthand, so a grep for `border-left: 3px solid` missed them.

### What replaced it

**Nothing new.** `.move-button` (second pass) and `.pick-card` (third) had each already hit this
exact problem and each solved it the same way, in comments written at the time:

> This used to be a flat gray gradient with a 3px type-colored left border — a hard stripe that
> stops abruptly, reads as a list-row marker rather than as part of the control, and left the
> button itself colorless. Now `--move-type-rgb` drives a wash that enters from the top-left corner
> and dissolves across the face, plus a rim tinted the same way.

So the answer already existed twice and had simply never been generalised. There is now **one hued
plate**, declared last in `styles.css`, that all nineteen adopt: a radial wash entering from above
the top-left corner, a rim mixed from the same hue, and a top edge that catches it harder than the
sides — because the light arrives from up there and a uniform rim reads as a frame stuck on rather
than as the same light. **The object is lit by its colour instead of being labelled with it.**

Two optional knobs, and nothing else:

- `--plate-color` — the identity hue. Defaults to `--border`, so a card whose hue is not set
  degrades to the old colourless plate rather than to black.
- `--plate-base` — the surface under the wash, for the six cards that are sunken or gradient rather
  than the ordinary raised plane.

**`color-mix`, not `rgba(var(--x-rgb), …)`.** Every one of these hues is already published as a hex
custom property — `--rarity-color`, `--boon-color`, `--passive-color`, `--tier-*`, plus the type
colours set inline from JSX — and `rgba()` cannot take a hex var. Demanding an rgb triple would
have meant a second parallel copy of the whole palette. `.move-button` and `.pick-card` predate
`color-mix` being reachable here and are left on their `rgb` triples; they are already correct.

**Being declared last is load-bearing, and so is being (0,1,0).** Each of the nineteen selectors is
a single class, and so is the shared rule, so declaration order is what lets the plate win the base
surface from the component's own `background`. Every *state* variant — `.picked`, `:hover`,
`.is-selected`, `.active` — is (0,2,0) and still beats it, which is why not one of them needed
touching. Eight `border-left-color` overrides on kind/tier variants became `--plate-color`
declarations; the seven JSX sites that set `borderLeftColor` inline now set `--plate-color`.

### Verification

Typecheck clean, 988 engine tests passing, and screenshotted at 394x780: the Reference overlay's
Statuses tab, the Boon shrine, the Mentor's Hall, the Equipment Cache, the Guild Hall, the
Blacksmith, the Mastery board, the level-up report, the Evolution screen, the draft, and the hero
sheet's Moves page. Nothing lost a state it had; the Equipment Cache keeps its rarity bloom (that
lives in `box-shadow`, which this rule does not touch).

### What it did not fix, and what it exposed

The plate changes what the cards are *made of*. It does not change that several screens are still a
**list of cards floating in the middle of a tall empty screen** — the Boon, the Cache and the
Crucible all still measure 160–420px of dead band. That is the composition problem, and it is next
after the two shop screens.

It also leaves the **dashed empty slot** untouched — the Mastery board's fourth move chip, the
Blacksmith's unbought slots, the roster's empty gear cells. A dashed rectangle is the wireframe
idiom the same way a left bar is the list idiom, and `styles.css` still has twenty of them. The
eighth pass already machined some of these (`.item-box`, whose comment says the dashed version "read
as a disabled form field"); the rest never followed.

## Twenty-third pass — the two shops stop being a pricing page (2026-09-10)

*Third item from the audit. The Guild Hall was deliberately exempted from the ninth pass ("a shop
with three distinct lists, not a one-decision node") and never came back; the Blacksmith inherited
its chrome wholesale when it split off in 2026-09-08.*

### What was wrong

Five separate web idioms, stacked:

- **A masthead.** `.guild-hall-header` was an `<h2>` at one end of a `border-bottom` rule and a
  gold figure at the other. Worse on the Blacksmith, which therefore **named itself twice** — a
  `NodeHeader` reading *THE BLACKSMITH / Work On What You Carry*, and immediately under it an
  `<h1>Blacksmith` with a purse.
- **Table header rows.** `.guild-hall-section-head` was `justify-content: space-between` — a bold
  uppercase title behind a coloured tick on the left, a small italic note hard right. That is a
  `<thead>`, and two or three of them down a scrolling column is the single biggest reason these
  screens read as a document.
- **Shopping-cart line items.** The Recruit Contract, the Mastery Scroll and the Sell row were
  full-width `glyph · bold name · gray sentence · price hard right`. Three of those stacked is an
  invoice.
- **Form validation.** *"Roster is full (6/6) — recruiting will ask you to terminate a hero to make
  room."* in gold, as a paragraph of its own. `.hint` is globally `color: var(--accent)`, so every
  loose advisory on a screen full of prices reads as *something is wrong*.
- **A pricing table.** Six `1 → 2 slots ⋯ 120` bars, one per hero card, each `space-between` with
  the gain at one end and the cost at the other.

### What replaced it

**The purse leaves the page and gets pinned.** `NodePurse` sits in the top corner the roster glyph
does not own, in the same chip language `.map-stat` uses — so gold is one object across the run,
and the number every decision is measured against no longer scrolls away. Both mastheads are gone,
and `ShopNodeScreen` now takes the `NodeHeader` every other node screen has always had
(*THE GUILD HALL / Who Will You Take / People and gear — for gold*).

**The section head becomes a chapter mark.** Centred, flanked by two rules that fade *away* from
the label in both directions (`::after` is the same gradient mirrored), with whatever the section
qualifies sitting **under** it rather than beside it, and no longer italic. The flanking rules are
not decoration: they are the thing that makes a centred label read as a break in a place rather
than as a heading on a page. `.hint` joins the same dim centred voice inside `.guild-hall`.

**The two goods go on a shelf.** The Contract and the Scroll are now two plates side by side —
glyph, name, one line, a struck coin — each lit by the resource it buys rather than by the panel's
gold, in the same two hues their glyphs and their run-HUD counts already wear (`RESOURCE_COLORS`).
The Contract's held count moved from a *"N held"* chip in a row to a **tally on the corner of the
plate**, which reads as stock the way a sentence does not. The Sell row got the same plate.

**A price becomes a struck coin**, on the shelf and on every equipment card — the same object in
both places instead of a bare gold figure at the end of a row. The Blacksmith's slot purchase
shrinks from a full-width bar to a centred chip that fits its content, so the card's own hardware
stays the subject; `1 → 2 slots` is just `+1 slot`, since the card underneath already shows how
many sockets there are.

**And the roster-full warning stops being an error.** It is now a clause on the Recruits hint —
*"Unevolved, unranked — yours to build · roster is full (6/6), so a hire asks who leaves"* — which
is what it always meant.

### Three things carried in from the audit while the file was open

- **The scrollbar.** `.screen-scroll` showed a persistent track down the right edge of every node
  screen. `.move-list` and `.roster-held-chips` already hide theirs; this is the same call. A
  visible scrollbar is browser chrome more than it is an affordance, and the thing it would tell
  you — that there is more below — is already said by the card the fold cuts through.
- **Two more dashed sockets machined.** `.squad-slot.empty` and `.mastery-move-chip.is-empty` now
  wear the four L-cut corner brackets `.item-box.empty` got in the eighth pass, for the reason
  written down there: a dashed rectangle reads as a disabled form field, a recess with brackets
  reads as a mount waiting for something. (The remaining dashed rules in the file are deliberate
  ornament — the title seal, the evolve ring, the pact seal, the recruit fanfare — plus
  `.item-box.is-lifted`, where dashed means *in flight*.)
- **The disabled CTA stops looking broken.** `.resolve-button:disabled` was `opacity: 0.55`, and on
  a node screen the location's parallax showed straight **through** the plate — trees and masts
  crossing the label. Measured on the Mastery board and the Boon shrine. The dimming is now baked
  into the fill and the text instead, so the plate stays a solid object while it waits.

### Verification

Typecheck clean, 988 engine tests passing. Screenshotted at 394x780, both screens top and bottom,
plus the Guild Hall at a full roster (the state that used to raise the gold warning) and the
disabled CTA cropped against the parallax it used to show through.

### What is still open on these two screens

- **The equipment card is still a row**: icon, name, RARITY in caps, stat chips, price. The plate
  now carries the rarity as light, so the caps word is saying a second time what the card's own
  colour says — but removing it is a content call, not a styling one.
- **The Anvil & Enchanter rows** keep two square action buttons at the right end. They are two
  genuine actions, so the shape is honest; they just have not been given the shelf's treatment.

## Twenty-fourth pass — the map is a place (2026-09-10)

*Fourth item from the audit, and the open item this file has carried since the first pass: "Apply
the rule outside combat… still outstanding: the **map**."*

### What was wrong

The first pass wrote the rule — *a rectangle means "you can act on this"; nothing else gets a box* —
and spent itself proving it on the arena, which lost its border, radius and shadow and bled to
three screen edges. **The map is the same kind of object and never got the same treatment.** It was
three stacked rounded rectangles:

- `.map-header` — a sunken bar with an inset shadow, holding act, level, purse and two bordered
  glyph buttons. A toolbar.
- `.map-well` — a bordered, rounded, recessed frame holding the scene.
- `.map-footer` — a drawer, square-topped and pulled up 10px so it met the well's outline.

The 2026-09-08 pass had already turned the well's *contents* into a scene ("the well is a scene
now, not a diagram"), which is exactly what made the frame indefensible: an authored place, with
weather and a horizon and a treeline, **stopping at a 1px border two-thirds of the way up the
phone**, with a toolbar above it and a drawer below.

### What replaced it

**The scene is the screen.** `.map-screen` takes the full-bleed treatment `.battlefield` uses —
negative margins on all four edges, the spacing put back as padding so nothing inside moves — and
paints what the well used to paint. The header and the footer now sit **on** the place rather than
beside it.

Three things had to move with it, and the third was the one that mattered:

- **The six per-location scenes.** `docs/locations.md`'s light — Wild's Edge's soft dusk, the
  Forbidden Forest's single canopy shaft and heavy flanks, and four more — were authored as
  `.map-screen[data-location="…"] .map-well` and had to be re-targeted to the screen. They are
  (0,2,0) against the base rule's (0,1,0), so they still win the background; nothing else changed.
- **`LocationAmbience` left the well** and became a screen-level layer at `z-index: 0`. This is
  what actually finished the job: the background bled first, but the *weather and the ground* were
  still boxed, so the trees stopped in mid-air at the old frame line. Weather does not stop at a
  panel edge.
- **`MapPlacard` stayed in the well**, deliberately, and is the one thing that should. The well's
  bottom edge is now exactly the top of the footer button, so anchoring the place's name there is
  what keeps it clear of that button however many lines the name takes — pinning it to the screen
  instead clipped "Forbidden Forest / Fae" behind the drawer, which is how this was found.

**The header buttons go chromeless.** A bordered square around a glyph is a toolbar button, and two
of them bracketing a row of readouts is a toolbar — the same call the first pass made on the
battlefield figure's info button ("bordered circle button → chromeless glyph; the figure is the
tap target"). The act, level and purse chips keep their own hairline plates, because they *are*
readouts and have to hold against a lit scene; the tray they sat in is what had to go.

**The footer keeps its box, and should.** It is the one control on the screen, so by the rule it
gets a rectangle. It only lost the square top corners, which existed to seam it against a frame
that no longer exists.

### Verification

Screenshotted at 394x780 at Wild's Edge and the Forbidden Forest — two locations chosen because
their authored light is opposite (widest/softest versus heaviest vignette with a single central
shaft), so a location rule that failed to re-target would be obvious rather than subtle.

**The test suite was not clean on this commit and that is not this change**: another session was
authoring the Iron and Beast move slates in the same tree at the time (`src/data/moves.ts` and
`src/data/heroes.ts` modified mid-run), and its three failures are content assertions with nothing
to do with the view layer. Only `styles.css` and `MapScreen.tsx` were committed here.

### What this leaves

- **The hamburger.** `HUB_PATHS.menu` is still three stacked bars, and so is FightScreen's `☰`
  Menu key. It is a web idiom, and it is also the single most universally-understood control on the
  screen; the audit named it and this pass deliberately did not take it, because the fix is a new
  object rather than a restyle and the container was the real problem. Revisit it alongside the
  fight screen's bottom bar.
- **The route still only draws the current row.** Nothing here changed what the map shows — the
  2026-09-08 pass owns that — only what it is set in.

## Twenty-fifth pass — the ledger, and a key instead of a paragraph (2026-09-10)

*Fifth and last item from the audit. It is shorter than the four before it, because looking
properly at the hero sheet found that most of what the audit flagged there had already been
decided — see "What was NOT wrong" below, which is the more useful half of this entry.*

### The KPI tile grid

**Records** and **Run Summary** each laid their figures out as a grid of tiles: a big accent
numeral over a small letterspaced caps label, in a bordered box, two-up on Records and four-up on
the summary. That is a SaaS analytics dashboard's KPI row, verbatim, and once the shops were dealt
with it was the most web-looking object left in the game — `03-records.png` was the single clearest
"a tool made this" screenshot in the whole audit.

It is a **ledger** now: label, leader dots, figure. Both screens share it.

- **The dots are the whole difference.** Label-left/figure-right with a rule between is a
  definition list, which is no better than the tiles. A run of leader dots on the baseline is a
  scorecard or a table of contents — a thing printed in a book — and that is what makes the same
  data read as a record rather than as a readout.
- **It also obeys the rule the tiles were breaking.** A lifetime record is not something you can
  act on, so it does not get a box. Six boxes that cannot be pressed is exactly the noise the first
  pass's rule exists to remove.
- The dots are a repeating `radial-gradient` masked to fade in over the first 14px, so the run
  starts clear of the word rather than butting against it.

**And the section marks are now one object.** `.records-section-title` and
`.run-summary-section-title` take the centred, rule-flanked chapter mark the twenty-third pass gave
the shops, so a break in a list looks the same everywhere.

Records also lost half a sentence. *"A hero earns a star for every run cleared with them on the
final roster. Stars show on their Compendium tile."* — the second half is a navigation instruction
that the Compendium answers by simply having the stars on it, and what a star **means** is the only
part a record needs.

### The growth key

The hero sheet's Stats page ended in three sentences of prose: *"Letters are growth grades — the
chance a level raises that stat, S 95% down to F 5%. All seven cost the same on every hero, so the
line says where growth lands, not how much."* Documentation, set in the middle of a character
sheet, and inline-styled at the call site where everything around it is a class.

It is a **key** now — the seven grades in a row, each over its percentage, in the exact tones the
letter column beside the bars uses. Three reasons that is better and not merely shorter:

- It teaches **all seven**, where the sentence taught two by naming the ends of a scale the reader
  could not see.
- It is **data, not prose**: the same object a chart legend or a map key is, and legends are native
  to games in a way explanatory paragraphs are not.
- The second sentence goes entirely. That a line is on budget is a fact about **authoring** — it
  belongs in `docs/types-and-heroes.md`, which already says it — not something a player opens a
  hero sheet to learn.

`GRADE_TONE`'s colour and weight still come from the table (they vary per grade); the four
properties that never varied moved to `.stat-bar-grade`.

### What was NOT wrong — two corrections to the audit

The audit called two things on the hero sheet defects. Reading the code, **both are decisions taken
the same day, with reasons written down**, and re-litigating them would have been the wrong work:

- **The ~400px of empty panel under a short page is deliberate.** The comment on
  `.detail-overlay.is-sheet` records the measurement: the four pages want 561 / 427 / 380 / 266px,
  so a content-sized centred sheet moves the tab strip by ~148px between Stats and Passives — a
  control the thumb would miss. The panel holds its height on purpose, and the leftover room is
  styled as the page's own floor rather than left as blank panel. **A fixed target beats a tight
  box**, and the audit measured the symptom without reading the trade.
- **The tab strip's counts are load-bearing.** "An empty Passives page is a fact the player can
  read off the strip instead of paying a tap to discover" (`TabStrip.tsx`). The strip is an app
  idiom, but the count is doing real work, and removing the shape would take the information with
  it.

The lesson is worth keeping for the next audit: **an audit measures a screen, and a screen is not
its own argument.** Two of the five things flagged here were already answered in a comment three
lines above the CSS the audit was reading.

### Verification

Typecheck clean. Screenshotted at 394x780: Records, the Run Summary, and a hero sheet's Stats page.

**The engine suite was not clean, and none of it is this**: another session was authoring the
Shadow, Spirit, Iron, Beast and Undead move slates in the same tree throughout, and its nine
failures are content assertions about passives, per-type slates and the grade budget. The engine
tests do not compile `src/view` at all (`tsconfig.json` versus `tsconfig.view.json`), and the four
files committed here are view-only.

### What is still open, across the whole sweep

- ~~**The hamburger**~~ — resolved as KEPT in the twenty-seventh pass below, with the reason.
- ~~**Two affordances for one thing**~~ — done in the twenty-seventh pass below. Was: on `HeroPickCard` — a corner `i` button and an INSPECT line on
  the same card, with long-press doing it too. Three ways into one sheet.
- **The equipment card is still a row** (icon, name, RARITY in caps, stat chips, price) even though
  the plate now carries the rarity as light. Removing the caps word is a content call.
- ~~**Composition, not chrome.**~~ — done in the twenty-sixth pass below. Was: several node screens float a short list in the middle of a tall
  screen: Crucible 416px of dead band, then reward-equip 177, Forge 167, Boon 161, Banner 161,
  Tutor 157, draft 153. The Gold Cache and the act intro *compose* their space and are the
  counterexample to copy. This is the biggest thing the sweep did not touch, and it is a layout
  problem rather than a styling one.

## Twenty-sixth pass — the node screens fill their frames (2026-09-10)

*The thing the audit's first five passes deliberately did not touch: composition rather than
chrome. Per user direction, "now fix the dead space on the node screens".*

### What was wrong, measured

Painted content versus empty band, at 394x780, excluding sky and parallax:

| Screen | Empty above | Empty below |
|---|---|---|
| Crucible | — | **416px** |
| Equipment Cache | 170px | 173px |
| Boon shrine | 160px | 161px |
| Guardian's Banner | 161px | 161px |
| Mentor's Hall | 100px | 101px |

**These were two different faults wearing the same symptom, and measuring alone could not tell them
apart.** The band totals looked similar; the causes were not.

- **The Crucible was a plumbing bug.** `.pick-grid.is-filling` claims its height with
  `flex: 1 1 auto`, which does nothing inside a block — and the Crucible was the one pick-a-hero
  screen that wrapped its grid in `.screen-scroll` instead of mounting it as a direct child of the
  flex-column screen. So the grid sat content-sized at the top with 416px of nothing under it.
  Every other such screen (Forge, Tutor, Mentor, the Boon's second phase) already did it the other
  way. One line of JSX.
- **The rest were composed but under-filled.** Their content *was* centred — `.stage-centered`
  has done that for a while — so the air was symmetric, which is why it looked deliberate. It was
  not: three cards occupying 271px of a ~600px stage means the thing the screen exists to ask
  fills 45% of the frame.

**Centred air is not itself the problem**, and this is the distinction the pass turns on. The Gold
Cache has 234px either side of its numeral and reads as composed, because its subject is a **focal
point**. A stack of small rows is not one. So the fix is to let the content fill the stage, not to
take the air away.

### What replaced it

**A stage stack.** A short list of choice cards inside `.stage-centered` — three Boons, three
pieces of gear, three disciplines — now shares the stage: each card takes a share of the height and
caps out, with the leftover still centred. Equalising them is a bonus rather than a cost: three
plates of one height read as a set of things offered, where three different heights read as a list
that happened to be that long.

**A grown card has to re-centre what is in it.** The first attempt produced a 132px Boon plate with
11px above its badge and 51px of nothing below — the same dead space, moved *inside* the card. The
axis differs by card: the shrine cards are flex rows whose cross axis is vertical, the Mentor's are
columns whose main axis is, and the equipment card already centred. That is a trap worth naming,
because it turns a fix into a smaller version of the bug it fixed.

**Two columns when the grid owns the stage.** `HeroPickGrid` chose columns from the hero count
alone (`count > 4 ? 3 : 2`), so a six-hero roster always went to three — six 118×124 cards with
48px portraits floating in a 570–660px box. The screen's whole question is *which hero*, and it was
asking in thumbnails. Six heroes at two columns is three rows of ~190px, which fills those boxes
almost exactly and buys the 96px portrait the card was already built for. The rule is now
`count > (fill ? 6 : 4)`: a grid without `fill` is embedded in a panel (the roster peek, the run
summary) where the room is genuinely tight.

**And one screen has to opt out, which is the interesting part.** The Event node passes `fill` but
does *not* own the stage — it prints the move on offer above the grid and leaves it half the height
the Crucible gives it. Two columns there squashed the cards to 104px and `overflow: hidden` ate the
name, the types and the CTA **silently**: the cards still looked like cards, just with nothing
written on them. It takes `columns={3}` explicitly, and `.pick-card` now carries a
`min-height` per column count so the same situation overflows the grid — a scrollbar — rather than
disappearing content. A floor is worth more than the fix, because the next screen with a tall
header will hit this and nobody will be looking.

### The Banner, and two things found by growing it

Five standards at 86px art occupied 276px of the stage. Growing the art alone **re-wrapped them
2+2+1**, stranding Wellspring alone on a line: a flex item sized by its own content stops fitting
three to a row past about 90px. The cell is now pinned to a third of the row, so 3+2 holds — which
is the shape the row is composed as — and the art grows inside it.

That surfaced a **pre-existing** defect. The two-stat Banners (Warcry, Bulwark) draw two charges at
the single glyph's size, and the cloth is only 62% of the art's box (the swallowtail runs x 12..52
of a 64 viewBox), so the pair hung off both folds. It always did; making the banners bigger is what
made it visible. `RelicCharge` now marks a pair and a pair is set at `0.2em` against a single's
`0.3em`, so both marks land on the cloth. Everything is in `em` of the art's own font-size, so a
Banner drawn at any scale keeps the same charge.

### Result

| Screen | Was | Is |
|---|---|---|
| Crucible | 416px | none |
| Guardian's Banner | 161 / 161 | none |
| Mentor's Hall | 100 / 101 | 40 / 41 |
| Equipment Cache | 170 / 173 | 93 / 96 |
| Boon shrine | 160 / 161 | 93 / 93 |

Nothing overflows: every stage stack and pick grid measures `scrollHeight === clientHeight`.

**The Gold Cache is deliberately untouched at 234 / 234.** It is the counterexample the rest of
this pass is calibrated against — one lit numeral with air around it — and filling that frame would
make it worse. The draft's 40–48px bands are ordinary spacing between three composed regions.

### Verification

Typecheck clean; every affected screen screenshotted at 394x780 and measured before and after,
plus the Banner row at 3× to check the charges against the cloth.

**The engine suite reports nine failures and none is this**: another session has been authoring the
Shadow, Spirit, Iron, Beast and Undead move slates in the same tree all day. The failing set is
identical to the one standing before this pass began (passives, per-type slates, the grade budget),
the engine tests do not compile `src/view`, and the four files committed here are view-only.

## Twenty-seventh pass — the battlefield gauge, and one affordance too many (2026-09-10)

*The last two items off the audit. Per user direction after a review of what was left: "do the
hp/mp bars and drop the i".*

### The bars were the last stock widget in the arena

Flat saturated capsules — `#4caf6a` and `#4a90d9`, Material's own green and blue at full strength
— with white numerals set inside them. An HTML `<progress>` element, and it mattered more than its
size: **everything around it had been authored**, so being surrounded by that made the bars louder
rather than quieter. The figures stand on type-tinted platforms, the console is lit in the
commanding hero's domain, the popups wear their status's own mark, and then the single most-read
object on the screen is a Bootstrap progress bar.

**Six treatments were rendered at the real 13px and looked at before picking anything**, the same
method the ninth glyph and the Titan's head needed. What that settled, in order of usefulness:

- **The pill had to go first.** A full-width capsule with rounded ends is the canonical progress
  bar and no amount of bevel survives it. Every good variant was squared.
- **A chamfered plate was handsome and was doing none of the work.** It looked the most "designed"
  of the six, but side by side with a squared track the difference was carried entirely by the lit
  head and the saturation drop — and a 3px chamfer at 13px tall is invisible anyway. It would also
  have cost the track its outer ring, since a `clip-path` takes the `box-shadow` with it
  (twentieth pass). Dropped.
- **Discrete cells at an 8px pitch fought the numerals into mush**, and ten-percent ticks crowded a
  186px bar. **Quarters** are the most a bar this wide takes before the marks read as texture.

So: a squared slot cut into the figure's ground, graduated at the quarters over the **whole** track
so the empty part is graduated too, with the fill's leading edge lit. The head is the part that
matters — it is the reading, so it is the one part of the bar that should look lit, and an `inset`
shadow rides the fill's own right edge at any value for free. The fills are held back to
`saturate(0.86)` so the gauge sits **in** the scene's palette rather than on top of it; at full
chroma these two were the most saturated objects on the battlefield, brighter than the hero sprites
they belong to.

The graduation is not decoration. It turns "a green bar" into "about half", readable without
reading the numerals — which is what a player scanning four of these mid-fight is actually doing.

### Three kinds of bar, two shapes — and the line is not where it looks

The gauge goes to the battlefield figures, the target picker and the target panel's bench. The
bench's own 5px sliver, the switch picker's 7px gauge and the hero sheet's 8px stat bars keep the
capsule.

**The line between them is where the NUMERALS sit, not what the bar measures.** The three that got
the gauge carry their figure *inside* the track at 13px, which is what makes them instruments: the
bar is the reading. The other three print their figure *beside* the bar — there the number is the
reading and the bar is a second, softer cue, so a capsule is right and a notch at that height would
only be noise. A first draft of this comment claimed the distinction was "live reading versus
static", which the switch picker immediately falsifies: it is as live as anything on the
battlefield and it still wants the capsule.

### The `i` comes off the pick card

A `HeroPickCard` offered **three affordances for two verbs**: a small `i` in the corner and a long
press both opened the sheet, while a tap did the thing. The one that looked most like a button was
the one that committed nothing — and it got worse when the twenty-sixth pass doubled the cards, at
which point the `i` was a 20px target floating over a 96px portrait.

Holding is already the game's inspect verb everywhere else — a move, a status, an item, a roster
card — so the `i` was the odd one out rather than the safety net. It is gone, and with it
`.pick-info`.

**The cost is real and is paid in copy.** The Forge, the Tutor and the Mentor already said "hold to
review" in their own readouts; three screens did not, and two of those commit something permanent.
The Crucible, the Boon's vessel step and the roster-replacement screen now say it. **A screen that
removes an affordance owes the remaining one a sentence** — particularly the two where the tap
being explained is irreversible.

### Verification

Typecheck clean. Screenshotted in a real fight at 3× — full bars, and a spread of partial values
driven in to check the lit head and the quarter marks at every level — plus the switch picker and a
hero sheet to confirm the three capsule contexts are untouched, and the Crucible to confirm zero
`.pick-info` nodes with long-press still opening the sheet.

**The engine suite's nine failures are, again, not this**: another session has been authoring move
slates in this tree all day, the failing set is unchanged, and the engine tests do not compile
`src/view`.

### What is left, and deliberately

- **The hamburger stays.** Both the map's Options button and the fight console's Menu key open the
  same system menu — sound, save, quit, abandon — which is not part of the fiction and is not
  something a player should hunt for. Three bars is the one mark everybody already reads as
  "everything else lives here", and the obvious alternative, a cog, collides with the Mech type
  glyph, which can be on screen at the same time in combat. **This is the second thing the audit
  flagged that turned out to be right** (the hero sheet's fixed height was the first), and it is
  recorded here as decided rather than left on a list.
- ~~`.hint` is globally `color: var(--accent)`~~ — done, below.
- The equipment card still prints its rarity in caps under the name, now that the plate carries
  rarity as light. A content call, not a styling one.

### Addendum — `.hint` goes dim app-wide

`.hint` was `color: var(--accent)`, and its own comment justified that: *"Kept gold (it's the 'what
do I do here' line and every screen has one)."* **That job moved.** `NodeHeader`'s `readout` is
where a screen says what it is asking, and what is left wearing `.hint` is six sites of a different
kind — five empty states ("No gear on offer this visit", "The bag is empty", "Nothing to work on
yet") and one inline level suffix on Squad Select. None is an instruction; none is a warning, which
is what gold says. The twenty-third pass had scoped it dim inside the shops; the rest of the app had
the same problem for the same reason, and that scoped override now drops its own `color`.

**The level suffix is the one that improves rather than merely calms.** `Cinder Lv 4` set the level
in gold beside every name — and under roster-wide levelling that figure is *identical on all six
cards*, which CLAUDE.md already says carries no information. Gold was giving the loudest treatment
on the card to its least informative word.

### And the `i` comes off Squad Select too — but only after the hold exists

The twenty-seventh pass took the `i` off `HeroPickCard`. Squad Select had a second, separate one —
`.info-button`, a bordered circle with a serif italic `i`, used by that screen alone, and *more*
web-looking than the chromeless mark that had just gone.

It could not simply be deleted, and the reason is the interesting part: **`SquadSelectScreen` had no
long press.** Its cells handled a tap (swap) and an HTML5 drag and nothing else — so unlike a pick
card, that `i` was not a redundant second route to the hero sheet, it was the **only** one.
Removing it would have stranded the sheet on the screen where you decide who fights. *An audit that
counts affordances has to check what each one is the only way to reach.*

So the hold went in first. Three notes on doing that:

- **The cell became its own component.** `SquadSlot` exists because `useLongPress` is a hook and a
  hook cannot live in a `.map()` body. Nothing else about the cell changed.
- **A hold, a tap and a drag now share one element, and they do not collide.** The hook cancels its
  timer once the pointer travels 12px — which any drag does long before `dragstart` — and it
  swallows the click a completed hold would otherwise deliver to the swap handler. Both were
  verified rather than assumed: a synthetic press-plus-30px-travel does not open the sheet, and a
  completed hold leaves the grid order and the selection untouched.
- **The cell answers the keyboard now**, which it did not before. It carried `role="button"` and a
  tab stop and responded to no key at all; Enter and Space do what a tap does. The sheet itself is
  still not keyboard-reachable from here — that is the honest cost of trading a `<button>` for a
  gesture — but it is reachable through the roster button in the corner, and this is a
  touch-first game where hold is the inspect verb everywhere.

`.info-button` and `.hero-grid-info-button` are deleted; the game's last bordered-circle `i` is
`.draft-info`, which survives because the draft is the one screen where a hero has no roster entry
to hold.

## Twenty-eighth pass — the Crucible is a place (2026-09-10)

*Per user direction: "make the Crucible screen way more interesting and epic. Currently it's just
a bunch of boring boxes."*

### What was wrong

The Crucible was the tenth pass's pick-a-hero grid — six `.pick-card`s under a header — and the
tenth pass was right that one shape should serve every pick-a-hero screen *of the same weight*.
The Crucible is not of the same weight. The Forge asks which hero gets a slot; the Crucible asks
which hero is permanently remade, once an act, with no way back once the next screen opens. It
was drawn identically to the screen that hands out an item slot, and the only thing that said
otherwise was the readout.

### What replaced it

**A hanging bowl of molten gold, and the roster standing around it.** `crucibleArt.tsx` draws the
vessel the way `titanArt.tsx` draws the Titan — one near-black fill for every plate, structure
carried by the rim highlights, the whole thing cut into a light (`.crucible-heat`) emitted
*before* it. The bowl is authored once at 394×200 and sized off one dial (`--vessel-scale`);
the chains, the embers' source line and the ranks' floor are all derived from the rim it puts
at y=74, so the composition survives the dial being turned.

- **Two ranks, lit from below.** The nearer three stand on the far side of the rim with their
  names on it; the rest a step up and behind, at 72% brightness. Depth is carried by light and
  never by size — a 48px source scales to 96 and to nothing in between. Every portrait's drop
  shadow falls *up* and warm, where every other portrait's in the game falls down.
- **No boxes at rest.** A figure is the battlefield idiom: nothing around it until it is the one
  chosen, then a hot frame in the *fire's* colour rather than the hero's type, because it is the
  Crucible claiming them. That frame is also a new step — the old screen went straight from tap
  to the Evolution screen, which has no back button, so a mis-tap on the most permanent choice
  in the run was unrecoverable. Now a tap **arms** (the hero steps toward the bowl, the fire
  brightens, the rest step back into the dark) and the CTA commits, carrying the name.
- **Ash.** An evolved hero stands greyed, still holdable for its sheet, with a small tag. It
  stays on the screen because the narrowing choice is the point of showing it.
- **Nothing here loops.** Heat 2.7s, slick 5.3, bubbles 3.9, smoke 9.7/12.3/14.9, embers
  4.2–7.8 — the same no-common-divisor rule as the Titan, so the fire never returns to a frame
  the eye has seen. Everything is transform/opacity on its own layer, and the global
  reduced-motion collapse at the top of the stylesheet takes all of it down at once.
- **Cold.** With nobody left to evolve the melt goes dark, the glow, embers and smoke stop, the
  title changes, and the CTA is the exit. The chains and the lip keep their metal.

### Verification

Rendered through the throwaway harness at 394×780: six heroes with two evolved, a hero armed,
a four-hero roster, and the cold state. The chains converge on a point above the title in every
case, and the CTA stays on the bottom edge with the vessel's plinth running off the frame under it.

## Twenty-ninth pass — the fight ends on a curtain, not a card (2026-09-11)

*Per user direction: "significantly improve the victory overlay … more sleek and professional …
add some pizazz to the rewards … show the player that their heroes are leveling up."*

### What was wrong

The fight ended on a 340px card: "Victory!" in green, three pill chips (`+40g`, `⭐ +1 Level`,
`+1 Scroll`), the drop as a boxed spotlight, a Continue. Everything arrived at once, so nothing
was an event; and the one thing the card could not say was *why* the next screen — the level-up
report — was about to hand every hero a row of stat rolls. `+1 Level` in a chip is a number; it
is not a hero levelling.

### What replaced it

**`FightResultOverlay`** (`src/view/combat/`), the node-screen shape laid over the dimmed field:
banner, content, one chunky CTA on the bottom edge, so the chain a win opens (this → Level Up →
Banner → …) is one kind of screen from its first beat. It is a *sequence*, each beat a timed
class flip, and a tap anywhere lands all of them.

- **The strike.** A gilded "Victory!" — a top-lit gold gradient clipped to the letterforms —
  dropped in with the level-up report's flash, rays and sheen, in gold where the report's is
  white; one fact under it in the horizon register ("Won in 6 rounds"). A loss strikes "Defeat"
  in red and goes straight to the CTA. Each has its own fanfare (`victory`, `defeat`).
- **The roster, with bars.** Every roster hero stands in a row — reserve heroes tagged and a step
  dimmer, but in the same rank, because that IS the rule — with a level badge and a bar under
  each. The bar is a CSS animation iterated once a level (`--fills`), with a 45ms wave down the
  row; each iteration boundary is the frame the badge ticks (`onAnimationIteration`) and the
  figure blooms. The whole sequence lands inside ~2.2s for a three-row ledger (tightened from
  ~3s the same day, per user direction). One `xp.orb` a level for the whole roster, not one a hero. A capped hero shows
  MAX on a grey full bar. "Heroes +1 Level" pops once the bars have shown it.
- **The ledger.** Chromeless rows with hairlines: gold counting up with coin strikes from the
  moment its row lands (and the purse it lands in), the Scroll, and the drop as the *chit* it will
  be on the roster — `ItemPiece` plus `ItemEffectChips`, rarity as a word on the right — the one
  box on the screen, because it is the one thing that opens (`ItemSummaryPopup`).
- **The CTA** arrives grey and takes the gold when the sequence has played or been tapped
  through. Never disabled: a press at any point resolves the fight.

`RunSummaryScreen` still wears the old `.result-*` card; the chips and the quiet spotlight copy
were deleted with the panel, and the `.equip-spotlight` card block — which nothing had rendered
since the item gate went — went with them. `NodeSky`'s motes came out as `NodeMotes` so the
overlay could have the air without the wash.

### Verification

Rendered through the throwaway harness at 394×780: six heroes with two reserve (+1), four with
one at the cap (+2, frames at 900/1250/1900ms showing the wave, the tick to Lv 2 and the bloom),
the tutorial's two, a loss, and a Quick Battle with nothing to pay. The Browser pane's tab was
hidden throughout (`document.hidden`, timeline at 0) so every frame came from headless Edge.

## Open / future improvements

Roughly in order of expected payoff.

1. ~~**Move-button internals.**~~ Done in the second pass above.
2. **Phase-shift the whole screen.** The console and arena are active at different
   times. Planning: console hot and full, arena dimmed. Resolving: console collapses
   to a thin ticker, arena goes full-bleed and full-brightness. The beat stream
   already drives this — it is the natural payoff of the engine/presentation split,
   and it would make the split feel *authored* rather than merely clean. The fifth
   pass took the interim step (the resolving console fills and carries a beat trail
   instead of collapsing) precisely because the full version makes the arena's
   height variable, and **the arena's height is currently content-sized and fixed
   at 441.4px whatever the viewport** — 66% of a 375×667 screen, which is why the
   move list has to scroll there. Making the arena height-responsive is the same
   piece of work as this item; do them together.
3. ~~**A persistent console shell.**~~ Done across the fifth and sixth passes.
   The variants share a boundary, a fill behaviour, and — since the sixth — one
   header object (`ConsoleCrest`) across move selection and targeting. They are
   still separate JSX branches, but there is no longer a "framed container" to
   unify them into: the frame is gone.
4. **Numerals on busy backgrounds.** Without card boxes, HP/MP legibility rests on
   text shadows. This needs checking against the noisiest case — Field Effect active,
   multiple statuses, damage popup mid-flight, low-HP pulse — on a real device.
5. **Portrait scale.** 96px (2×) was chosen over 144px (3×) to fit the arena's
   vertical budget, and that still stands for the battlefield. 3× now ships on the
   draft screen (third pass), where exactly one figure is on stage — so the scale has
   been *built* but still hasn't been **eyeballed on a real device**, which was the
   actual condition. Look at it there before considering it for the arena.
6. **Apply the rule outside combat.** ~~Draft~~ (third pass), ~~level-up~~ (fourth)
   and ~~the shrine/node screens~~ (ninth) are done. Still outstanding: the **map**
   and **roster** screens, which keep the same nesting — and the **Guild Hall**
   (`GuildHallPanel`, which `ShopNodeScreen` wraps), deliberately left alone in the
   ninth pass because it is a shop with three distinct lists, not a one-decision
   node. Each finished pass is a worked example — and note that in all of them, as
   on the Field Effect badge, the win came as much from asking what the boxes
   *contained* as from removing them. That question is now 5 for 5; treat it as part
   of the procedure rather than an extra.
   - **One portrait is still at a broken scale, knowingly.**
     `.roster-card-portrait` is 40px (0.833×) on `SquadSelectScreen` and the Guild
     Hall. It was left alone because fixing it changes that card's height and those
     screens' layout budgets are tight; it is the first thing to fix when they come
     up. `.hero-grid-portrait`'s 30px is now out of the run loop entirely — the
     node screens took `HeroPickCard` in the ninth pass, `RosterReplaceScreen` and
     the roster peek in the tenth. `.hero-grid` itself survives only as dead
     styling; delete it when something else touches that block.
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
   with the generic buff glyph and no BP, so nothing distinguishes "this rewrites
   the battlefield for 5 rounds" from an ordinary self-buff until it resolves. Wants a
   distinct kind glyph, which is a `MoveKindBadge`/content-schema question, not a
   styling one — the glyph is keyed on `move.kind`, and there is no `fieldEffect`
   kind today. Partly mitigated by the seventh pass: the move dossier now draws a
   `Field: <name>` row in the effect's own element glyph and colour. The *grid* is
   still silent about it.

## Non-goals

- **Diegetic framing** (the whole UI as a pact-stone or commander's slate) was
  considered and rejected: expensive, and it fights the at-a-glance parsing that
  doubles combat demands.
- **Accent color at region boundaries.** Separate with value and depth, not hue. The
  arena already carries per-hero type tints, ally/enemy zone gradients, and a
  full-battlefield tint while a Field Effect is up; a colored seam only adds noise.
  - **Exception, sixth pass: hue that FUSES two regions rather than separating
    them.** The console is lit in the commanding hero's domain color, seam
    included. The test this has to pass is the one the draft's rejected
    full-screen tint failed — how often does it change? Twice a turn, at the
    moment command passes, is a signal. Once per rail tap would have been a
    strobe. Reach for this only where the recolour is itself the information.
