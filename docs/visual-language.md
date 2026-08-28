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

Two caveats:

- **Not seen on a real device.** The haptic in particular has only been
  feature-detected, never felt, and iOS Safari has no Vibration API at all — on
  iPhone the charge sweep is the entire feedback.
- **The hold is still 500ms.** With the charge drawn it is legible rather than
  dead, but whether 500 is the right number is a feel question that wants a
  thumb, not a measurement.

---

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
