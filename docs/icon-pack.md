# icon-pack.md

> How the Pixel Odyssey iconset in `art/2500plusIcons/` is organised, which icons were
> picked for which game concept, and the size constraint that governs all of it.
> Presentation only — nothing here reaches the engine.

---

## The sheet

`art/2500plusIcons/*/Iconset.png` is an RPG Maker MV iconset: **512 × 5504, 16 columns ×
172 rows of 32 × 32 icons = 2752 total.** The index of any icon is `row * 16 + col`, which
is how every pick below is cited.

The pack ships the same 2752 icons in 22 variants — `No Border`, plus black and white
borders at ten opacities each. **`No Border` is the one to use.** On this UI's near-black
arena (`--bg: #0f1117`) a black border vanishes and a white one adds a halo that fights the
type-tinted surfaces the fight screen is built from.

### Two regions, two different kinds of usefulness

**Rows 0–19 — stock RPG Maker RTP icons.** Generic, but this is where the *plain, single-
concept* glyphs live: elements, a heal cross, stat arrows, weapons. Most of the picks below
come from here, because a badge 16px across needs one idea, not three.

**Rows 21–39 — the "Skills & States" matrix, and the real find.** It is a grid where
**every row is an element and every column is a modifier**, so the same 16 modifiers are
drawn against 19 different elements:

| Col | Modifier | Col | Modifier |
|---|---|---|---|
| 0–2 | bronze / silver / gold star (skill tier) | 8 | ward shield (resist) |
| 3 | green cross (restore) | 9 | impact burst |
| 4 | strike hook | 10 | explosion |
| 5 | deflect arrow | 11 | splash |
| 6 | **cycle arrows (ongoing)** | 12–13 | **minor / major up arrow** |
| 7 | shatter | 14–15 | minor / major down arrow |

Element rows: 21 Fire, 22 Frost, 23 Storm, 24 Water, 25 Stone, 26 Nature, 27 Light,
28 Shadow, 29 Death, 30 Poison, 31 Stone-shell, 32 Mist, 33 Phoenix, 34 Starburst,
35 Heart, 36 Sleep, 37 Thunder, 38 Arcane, 39 Conduct. Rows 40+ leave elements behind
and repeat the same modifier columns against weapon types.

**Why this matters more than any individual icon:** it hands us a ready-made visual grammar
where *the modifier says what kind of thing this is and the element says which one*. That
is exactly the axis Titanpact already has — three different systems (statuses, Field
Effects, Elemental Force) that are each "a thing happening, flavoured by a type", and which
currently all reach for the same emoji and collide. See the picks.

---

## Picks

All extracted to `art/icons/<set>/<name>.png` at the native 32 × 32 with alpha intact.

> Most of what follows is now **historical** — three of the four sets have been replaced by
> vector and are marked as such per section. The picks are kept on record because the
> reasoning behind them is what eventually made the case against the pack.

### `art/icons/move-kind/` — the `MoveKindBadge` glyphs — **superseded, see below**

> These four were extracted and wired, then replaced by vector (`MoveKindGlyph`,
> `src/view/shared/statIcons.tsx`) for the reasons in "Where this pack does NOT apply". The
> files are still in `art/icons/move-kind/`; nothing imports them. The picks are kept on
> record because the reasoning — silhouette strength at a forced 16px — is what made the
> case for moving off the pack here.

| Slot | File | Index | Why |
|---|---|---|---|
| Physical | `physical.png` | 97 | Plain sword. The strongest diagonal silhouette in the pack — the one shape that survives being drawn small. |
| Magical | `magical.png` | 70 | Four-point sparkle. Reads as "spell", not as a specific weapon, and holds together at half size where the more literal orb (118) fragments. |
| Heal | `heal.png` | 72 | Green cross. Universal, and the only unambiguous heal glyph in the pack. |
| Heal (alt) | `heal-heart.png` | 84 | Bolder fallback — 72's gold frame goes noisy below ~24px, this doesn't. |
| Buff | `buff.png` | 81 | Glowing ward shield. |

### `art/icons/status/` — the 9 authored statuses — **superseded, see below**

> Extracted and wired, then replaced by vector (`STATUS_PATHS`,
> `src/view/shared/statusIcons.tsx`). The files are still in `art/icons/status/`; nothing
> imports them. Two of the nine picks below carry a "**needs ≥ 32px**" warning, on a family
> whose only real slot is a 16px badge — which is most of the argument for the move.

Plain, un-modified glyphs, so statuses read as the *base* family.

| Status | Index | Note |
|---|---|---|
| Burn | 64 | flame |
| Bleed | 77 | impact/wound burst — the weakest pick here; the pack has no actual blood glyph |
| Freeze | 65 | snowflake — **needs ≥ 32px**, the arms disconnect when halved |
| Daze | 8 | cyan Z stack |
| Renew | 75 | green cycle arrows |
| Conduct | 11 | water drops between two bolts. Uncannily exact — Conduct *is* water + electricity |
| Poison | 2 | purple bubbles |
| Haunt | 10 | skull in a purple swirl — **needs ≥ 32px**, becomes a blob when halved |
| Stealth | 4 | white shrouded form |

### `art/icons/field-effect/` — matrix column 6 (cycle arrows) × the effect's `flavorType`

| Effect | Index | Row × col |
|---|---|---|
| Surging Magic | 614 | Arcane × cycle |
| Scorched Land | 342 | Fire × cycle |
| Stasis Bubble | 582 | Sleep × cycle |
| Sanctuary | 438 | Light × cycle |
| Verdant Earth | 422 | Nature × cycle |

The first attempt used the plain element glyph, which was wrong: Scorched Land would have
worn the same flame as Burn and Stasis Bubble the same Z as Daze, and **both families are
on screen at the same time** — the plaque sits on the horizon while status badges sit on the
figures. The cycle-arrow column both separates them and means the right thing: a Field
Effect is a standing state that keeps ticking, not a one-shot.

Column 12/13's up arrow was the other candidate and is worse: it reads "buff", which is a
lie for Stasis Bubble (it slows everyone) and for Scorched Land (it stops Burn decaying).

### `art/icons/force/` — matrix column 13 (major up arrow) × element — **superseded, see below**

> Extracted and wired, then replaced by vector — `ELEMENT_PATHS`
> (`src/view/shared/elementIcons.tsx`) composed under a drawn arrow by `StatusGlyph`. The
> files are still in `art/icons/force/`; nothing imports them. The design below survived the
> move intact; only the source of the art changed, and the four missing types stopped being
> missing.

Elemental Force grants +Base Power to one type, so "element + big up arrow" is a literal
picture of the status. This replaces `FORCE_EMOJI` in `statusIcons.tsx`, whose header
comment already documents the collision this design avoids — that map had to dodge the
obvious 🔥/❄️/⚡ precisely because Burn/Freeze/Conduct had already taken them. Here the
modifier column does the disambiguating, so Fire Force and Burn can both be flames.

**Covers 11 of the 15 types** — Fire, Frost, Storm, Water, Stone, Nature, Light, Shadow,
Arcane, Mind (sleep row), Spirit (phoenix row). **Iron, Mech, Beast and Ancient have no
element row in the pack** and are not extracted; they need either a hand-drawn addition or
a fallback to the existing type-coloured text chip.

> This paragraph is the whole reason the family is vector now: "hand-drawn addition" was
> the right answer, and there was no version of it that left the other eleven on the pack
> without the set rendering in two styles.

### The resulting system

Worth stating plainly, because it fell out of the matrix rather than being designed:

> **The modifier glyph names the family. The element names the member.**
> Status = plain element · Field Effect = element + cycle · Elemental Force = element + up arrow.

Three systems that currently compete for the same emoji become one grammar with three
inflections.

> This is the one part of the pack's design that was kept when the art was not — see "Where
> this pack does NOT apply" for where it runs now.

---

## The size constraint — read this before wiring anything

`visual-language.md`'s defect 1 applies directly: **display sizes must be integer multiples
of the source, or clean halves.** These sources are 32px, so the only honest display sizes
are **32px (1:1)** and **16px (1:2)**.

16px is a genuine halving — every other source pixel is *dropped*, not blended — so it is
not a uniform softening. Measured by rendering each pick at both sizes:

- **Survives 16px:** 97 sword, 81 shield, 84 heart, 64 flame, 8 sleep, 75 cycle, 4 shroud,
  70 sparkle, 2 bubbles. Bold silhouettes with few interior details.
- **Destroyed at 16px:** 65 snowflake (arms break into loose pixels), 10 haunt (the skull
  disappears), 72 heal (the frame turns to mush), 118 orb, 11 conduct (the drops separate).

Current rendered sizes, measured in the running app:

| Surface | Rendered | Usable source size |
|---|---|---|
| `.move-kind-badge` | ~17 × 13px | **16px only** — so it must take a picks-from-the-survivors list |
| `.status-badge` | ~27 × 20px | Wants **32px**; the shoulder cluster has room to grow to it |
| `.field-effect-badge` | 18px tall | Would need the plaque to grow, or a 16px-safe glyph |

So the move-kind badges and the status badges cannot use the same size, and the four
kind picks above were chosen from the 16px-survivor list for exactly that reason.

One thing that muddies all of this: `initUiScale` transform-scales the whole shell by up to
1.2× (~1.104 at 375px wide), so **nothing** lands on whole device pixels anyway. That is
pre-existing and affects the hero portraits equally; it argues for picking bold shapes over
chasing exact multiples.

---

## What was wired in

> Historical. `src/view/shared/iconArt.ts` held four maps and now holds one (Field
> Effects); the status, Force and move-kind maps are gone, and `itemArt.ts` was deleted
> outright — nothing had imported it since `EquipmentIcon` moved to iconset cells, and gear
> is vector now. The emoji fallbacks it describes are gone too: every status, every type and
> every item has a drawn glyph, so the **mixed icon/emoji cluster this section warns about
> is no longer a state the UI can reach.**

`StatusGlyph` in `statusIcons.tsx` is still the single place a status glyph is drawn — the
battlefield shoulder badge, `StatusDetailOverlay`, `HeroDetailOverlay`'s chip and
`ReferenceOverlay`'s catalog all render it rather than interpolating a string, so the
decision is made once. `EquipmentIcon` (`EquipmentBox.tsx` → `EquipmentFormGlyph`) is the
same single point for gear, and `MoveKindBadge` for its four.

One thing that outlived the PNGs and applies to any surface drawing these: a wrapper that
tints a glyph has to set `color`, not just `background`. `StatusDetailOverlay`'s 44px disc
and `ReferenceOverlay`'s catalog disc both set only a tinted background — correct for a
full-colour PNG, and silently wrong for a `currentColor` path, which came out in the app's
default text grey inside a correctly orange Burn chip. Both now set the colour too.

### Two things measured after wiring, both regressions, both fixed

- **The shoulder cluster stacked into a column.** Going from an 11px emoji to a 16px icon
  widened each badge past what `.team-row .status-badge-row`'s `max-width: 58px` could fit
  two of, so four statuses went from two rows (~40px) to **four rows (98px)** running down
  past the portrait. Widened to 82px, which restores two per row and brings four statuses
  back to 71px. It overlaps the 96px portrait more than before — which is the intent of a
  *shoulder* cluster rather than a cost of it.
- **The Field Effect plaque got a glyph and then lost it again.** Adding a 16px icon cost
  23px of width and 6px of height: 190px total (51% of the screen) with row clearance
  dropping from 4.4px to 2.2px. The plaque is the one surface in this family that already
  spells its subject out in words, and the most size-constrained thing on the screen — it
  has to sit inside a 13px horizon band without touching either team row. The glyph moved
  to `FieldEffectDetailOverlay`, which like `.status-detail-icon` has room to show it at
  native 32px.

The rule that generalises: **an icon earns its place where there is no room for the word.**
Status badges qualify, the move-kind badge qualifies, the plaque does not.

---

## Where this pack does NOT apply: the vector families

The stat icons (HP / ATK / DEF / INT / WIS / SPD / MP / MPR) were emoji, and the obvious
next move was to pull eight more picks out of the sheet. They are **inline vector art**
instead — `src/view/shared/statIcons.tsx`, drawn on a 24 × 24 grid — for two reasons that
follow directly from the size constraint above:

- **They render too small for this pack.** Every surface that draws a stat glyph sets it at
  `1.15em` against 10–12px text, i.e. **11–14px**. The only honest sizes for a 32px source
  are 32 and 16; 11–14 is neither, and the measured "destroyed at 16px" list is what a stat
  block would be made of.
- **They have to take a color they aren't drawn in.** A stat glyph is tinted by
  `STAT_COLORS` in a stat block and by buff-green / debuff-red in a battlefield corner
  badge. A PNG can't do that; a `currentColor` path is free.

**`MoveKindBadge` followed them off the pack**, and gained something the pack could not have
given it. Its four glyphs are now the stat glyphs, and three of the four pairings are exact
rather than symbolic: physical damage wears the **Attack sword**, magical damage the
**Intelligence spark**, a heal the **HP heart** — the literal stat each one reads
(CLAUDE.md "Two-pipeline separation"). A player who has learned the stat block has already
learned the move badge. Only buff keeps a symbol (the Defense shield), because no single
stat owns "changes stats or applies a status, in either direction". Colour comes from the
badge's tier class, never from `STAT_COLORS` — on a move button the glyph answers "which
kind of move", and a red sword meaning "Attack stat" in one place and "physical damage" in
another would be two claims in one shape.

**Five more families followed, on the same two reasons.** The six hero-sheet section headers
(`src/view/shared/sectionIcons.tsx`) render at 16px and always take their panel's gold. The
eighteen map node glyphs (`src/view/shared/nodeIcons.tsx`) render at 15–24px depending on
the node's tier and always take that node's `--node-color`. The map is the sharper case,
because it had already tried the pack and lost: commit 9688834 cut a set of hand-drawn
16 × 16 sprites that were being rendered at 22px — a 1.375× resample, exactly the
dishonest size this document warns about — and dropped the icon slot entirely rather than
keep bad art. Vector got the slot back, and got the reachability states back with it: the
sprites had needed a `grayscale(0.6)` on locked nodes, which is a *colour* change standing
in for a *lighting* one and made the route ahead least readable where it most needed to be
read. A `currentColor` path just takes the tile's opacity.

Both of those families reuse rather than reinvent where the pairing is literal. A Vitality
shrine on the map wears the **HP heart**; a Weapon Cache the **Attack sword**; an Armor Cache
the **Defense shield**; an Equipment Cache the section header's own **chest**. Same trade as
`MoveKindBadge`: a player who has read one hero stat block has already learned half of the
map.

**Then the last three went, and the division above went with them.** The nine statuses
(`STATUS_PATHS`, `statusIcons.tsx`), the fifteen types (`ELEMENT_PATHS`,
`elementIcons.tsx`) and the gear silhouettes (`EQUIP_FORM_PATHS`, `equipmentIcons.tsx`) are
vector now. Each fell for its own reason, and none of the three is the size argument:

- **Statuses fell to colour.** A status badge sets its own identity colour (`statusColor`)
  and the PNG could not take it, so the icon carried a drop-shadow to separate itself from
  the very chip it belonged to. A `currentColor` path just *is* the status's colour.
- **Elemental Force fell to coverage.** The pack has no element row for Iron, Mech, Beast or
  Ancient, so four of the fifteen chips had always rendered as emoji — a family that could
  never be one family. The elements had to be authored for those four regardless, and once
  four exist, fifteen should.
- **Equipment fell to arithmetic.** There are 55 items and there will be more; the pack path
  hand-mapped seven ids to cells and gave everything else a generic sword, shield or
  sparkle. A form derived from the item's own name (`equipmentForm`) draws new gear
  correctly the moment it is written, and no id table goes stale.

So the division is now: **vector owns everything a player looks at directly** — stats, move
kinds, section headers, map nodes, statuses, types and gear, seven families in one
vocabulary, all recolourable and all legible from 11px up. **This pack owns the Field
Effect plaque**, one fixed 32px slot on the horizon that never recolours and shows the art
at native resolution. That is not a grudging remainder: it is the only surface in the app
the pack was ever sized for.

The matrix's grammar outlived the matrix, which is the part worth keeping:

> **The modifier names the family. The base shape names the member.**

It now runs on drawn shapes rather than extracted cells — Mana Pool and MP Regen (droplet,
droplet + chevron), HP and Renew (heart, heart + chevron), Skirmish and Elite (helm, helm +
crown), and every Elemental Force chip (element + up arrow).

---

## Licensing

`art/2500plusIcons/Terms of Use.txt`: the pack is commercial, requires purchase, and says
the icons **"cannot be redistributed to other parties who have not purchased it."**

The full 22 sheets are currently **untracked**. Committing them publishes 2752 icons
verbatim, which is the redistribution the licence names. The extracted per-concept files in
`art/icons/` are a different case — a small derived subset used in a game, which is what the
licence grants — and match how `art/icons/16x16/` and `32x32/` (the Clockwork Raven pack,
already committed) are handled today.

Worth a deliberate decision rather than a default: either gitignore `art/2500plusIcons/` and
commit only the extracted icons, or keep the source sheets local and out of the repo.
