# constellation.md — The Constellation: what a star buys

> **STATUS: DECIDED IN SHAPE 2026-09-17 (per user direction), NOTHING BUILT.** The shop is
> plumbed (`src/run/starShop.ts`, `Profile.purchases`, `StarShopScreen.tsx`) and its catalog
> (`src/data/starShop.ts`) is empty. This doc is the plan for what fills it, written ahead of the
> content so the content has a shape to land in. §3 (Starter Packs), §5 (nothing with power, no
> difficulty) and §6 (star tiers, five rungs) are the designer's decisions; §3.4 is a proposal
> carried forward that has not been ruled on; §7's prices are a first pass; §10 names what is
> still open. Every hero, pack and Location named here is a placeholder for authoring, not
> authored.

---

## 0. Why this exists

`progression.md` locks the meta-game as **unlocks only**: a run resets everything, and what
persists is the pool a future run draws from. The earning half was built 2026-09-16 — a star per
hero per Evolution path, on the final roster of a clear — and the spending half was left as a
sentence: stars buy "new things for runs". This is that sentence unpacked.

The designer's first and favourite item is the **Starter Pack**: something equipped on the title
that replaces the pool the start-of-run draft is rolled from. A pack can be a re-cut of the
existing roster (Cinder, Leviathan, Squall and Mordrax in the draft instead of their types'
starters) or a set of brand-new heroes with a theme of their own — in-universe or out of it. The
worked example is **the Slashers**: a dream-stalker as Mind, a masked camper as Iron, a phone
caller as Shadow, a trap-builder as Mech. The rest of the catalog is built around that idea.

---

## 1. The rule this reduces to

**You buy content, never configuration — and content grows the sky.**

Two halves. The first is the locked line re-stated: nothing in the Constellation carries power
into a run. A purchase adds things to the pools a run draws from (heroes, Locations, Classes,
spawn), or changes what the player looks at (cosmetics). Equipping a pack is free and reversible
and is not a purchase; a pack once bought is held forever.

The second half is what keeps the shop alive. A star is earned per hero per path, so the supply
is finite — **126 for the base roster** (§2) — and a shop against a finite supply is finished the
day the sky is full. A pack of new heroes brings **three stars per hero** on the same terms as
Valor's, so every theme pack bought extends the supply past what it cost. The catalog is sized so
that the base game's stars buy the base catalog, and each pack pays for the next.

---

## 2. Supply — what a star is and how many there are

- One star per hero per Evolution path: **42 × 3 = 126** for the base roster, permanent, a set
  not a count (`Profile.evolutionStars`). A hero that finishes unevolved earns nothing; clearing
  the same path twice is the same star.
- A clear pays at most six (the final roster), and measured runs evolve everyone 64% of the time,
  so an early clear is worth **3–5 new stars**, falling toward zero as the sky fills.
- **Balance = earned − cost of what is held** (`starBalance`). A star never comes off a hero; the
  Compendium keeps every one.

What that prices: the first purchase must be reachable off one clear (≤ 4), the base catalog must
fit inside 126 with room for the player to not finish it, and anything that does not bring stars
back is a pure draw-down.

**A pack's heroes star on exactly the same terms** (per user direction) — an eight-hero pack is
24 stars in the sky it did not have before. A re-cut pack brings no hero stars (its heroes are
already in the roster), so **a re-cut pack carries a star of its own**, earned by clearing a run
with it equipped (§3.5).

---

## 3. Starter Packs

### 3.1 Shape

A pack is a list of hero ids the start-of-run draft is rolled from **instead of** the fourteen
starters. The draft is untouched: `generateStarterOptions(seed, heroIds)` already takes its pool
as a parameter and rolls `STARTER_OPTION_COUNT` = 4 from it, and the screen picks
`STARTER_PICK_COUNT` = 2. A pack is a different `heroIds`; four of eight is the same function as
four of fourteen.

- **Eight heroes minimum, no maximum** (per user direction). Eight is the floor so the four shown
  are always a real draw from something larger.
- **Any types, in any mix** (per user direction). A pack is not held to one hero a type and not
  held to type coverage. A **Foundry pack** of nothing but Fire, Iron and Mech is a legitimate
  pack: the four it shows may share a type, the pact it seals may be mono-slate, and the run's
  counter-pick game is narrower for it. The designer's ruling is that this is flavour, not a
  balance concern — a pack IS a self-imposed shape, and a player who equips one has chosen it.
  Record it here so nobody "fixes" a mono-slate pack into coverage later.
- **Exclusive**: an equipped pack is the whole draft. There is no fill-from-default; the base
  starters are not in a pack run's draft.
- **The base game is pack zero.** The fourteen starters are a pack with the id `base`, held by
  every profile, equipped by default. One code path, one Compendium shape, one equip toggle.
  `HeroDefinition.starter` stays as the authoring of pack zero's membership; a pack's own list is
  authored on the pack.

```ts
interface StarterPack {
  id: string;
  name: string;
  /** One line on the title tile and the Compendium row. */
  description: string;
  /** ≥ 8. Any types, any overlap. The draft's pool while this pack is equipped. */
  heroIds: readonly string[];
  /** 'theme' brings new heroes and their stars; 'recut' is drawn from the base roster and carries a pack star. */
  kind: 'theme' | 'recut';
}
```

A test pins: eight or more; every id a known hero; a `recut` pack lists only base-roster heroes;
a `theme` pack lists only heroes outside pack zero.

### 3.2 Two kinds

**Theme packs** are new heroes. Each is the full authoring job a base hero is: a 550 line,
28 grade points, a schedule, a signature, three Evolutions on the five-clause framework, pixel
art with attack and hurt pose frames, three stars. In-universe or not — the Slashers are not, a
"Founders of the Guild" pack would be. Eight heroes is two-thirds of the pass that closed the
roster at 42; a theme is a release, not a patch.

**Re-cut packs** are the base roster re-drafted. No new heroes, no new art; a list and a name.
Their value is that the recruit-only two-thirds of the roster never gets drafted, and a re-cut is
the only way to open a run on Leviathan. Cheap to make, so the catalog can carry several.

### 3.3 Buy vs. equip

Buying puts the pack in `Profile.purchases` like any offer. **Equipping is a separate, free,
reversible choice** — `Profile.equippedPackId`, defaulting to `'base'`, set from the title. The
Constellation sells; the title dresses. A player who buys the Slashers and never equips them has
lost nothing but the stars, and has the pack's heroes wherever §3.4 puts them.

### 3.4 The un-drafted heroes — PROPOSED, NOT RULED ON

An eight-pack shows four and the player takes two. What happens to the six left over decides
whether a pack is a *run* or a *draft screen*.

Under pack zero a starter is draft-only: the twelve not shown are unreachable that run, and the
in-run pools (the fork's contracts, the Guild Hall) draw only from `starter: false`. If a pack's
heroes are starters in that sense, a theme pack's 24 stars come two a run and take a dozen clears
to fill, and a Slasher run is two Slashers and twenty-eight ordinary recruits.

**Proposal: while a pack is equipped, its un-drafted heroes join the recruit pool for that run.**
The base roster's recruit-only 28 stay in the pool too; the base *starters* stay out (they are
draft-only, and this run's draft was the pack). So a Slasher run drafts two Slashers and can meet
the other six at the fork — which is what makes it a Slasher run — and when nothing is equipped
the base game is exactly what it is today.

What it costs: the CLAUDE.md line *a hero is in exactly one pool, never both* becomes a per-run
fact rather than a per-definition one (§9). A re-cut pack already needs that reading — its eight
are recruit-only heroes stood in the draft — so the proposal changes the wording once, not twice.

### 3.5 Stars

- A pack hero stars per path, on the base terms. The Compendium's hero list grows a section per
  pack held (pack zero's fourteen and twenty-eight are its first two).
- **A re-cut pack carries one star of its own** (per user direction), earned by clearing a run
  with the pack equipped, on top of whatever hero stars that clear earned. It sits on the pack's
  row in the Compendium and counts toward the balance like any star. It takes a tier like a hero's
  (§6): a re-cut cleared at Ascension 3 shows a gold pack star.
- Whether a theme pack — and pack zero — also carries a pack star is open (§10). It is cheap and
  symmetric, and it would make the sky's first row *the packs*; it is not what was asked for.

### 3.6 The tutorial

The scripted first run forces Valor and Fang and ignores the equipped pack. A pack cannot be
bought before the first clear in any case (no stars), but a wiped tutorial is offered again and
the profile might hold a pack by then — the script wins, the pack stays equipped for the run
after.

### 3.7 Worked examples

**The Slashers** (theme, out of universe, eight-plus). Archetypes, never the names — homage is
stronger unnamed, and the named ones are licensed. A type each is not required (§3.1) but reads
well for a set this size:

| Slot | Type | Sketch |
|---|---|---|
| the Dreamer | Mind | reaches you asleep; a Daze / Sleep kit, the signature lands only on a Dazed target |
| the Camper | Iron | the unkillable walker; Shield and recoil, never fast |
| the Caller | Shadow | knows where you are; priority, Feint, the pivot-and-strike |
| the Puzzler | Mech | traps; DoTs the target chooses to trigger, a self-cost kit |
| the Shape | Spirit | silent, stands back up; the Revive-adjacent passive, Spirit's drain |
| the Doll | Arcane | a puppet by rite; mana overflow, the small body with the big pool |
| the Chainsaw | Beast | Apex Predator's natural home |
| the Burned | Fire | shears and a scarred face; self-Burn as the cost, the Fire slate's ramp |

Eight named; a ninth and tenth are welcome (the Snowman as Frost, the Fisherman as Water). Every
slot is a sketch for the hero pass, not a kit.

**The Foundry pack** (re-cut, in universe). The base roster's Fire, Iron and Mech heroes — nine
heroes, three slates — and nothing else. Equipped, a run opens on two of them, and the Molten
Foundry act is a mirror match. That is the point of it.

---

## 4. The rest of the catalog

Every item is an unlock into a pool a run draws from, or a cosmetic. In order of how well each
fits the engine:

- **Classes, in trios.** A Class is one move or one passive, untiered, wearing its holder's type
  (`src/data/classes.ts`, nine today). The Crucible rolls three from the whole catalog, so a trio
  bought is in every Crucible from then on. The cheapest real content in the game and the best
  value a star buys.
- **Titanspawn lines.** A second Early / Mid / Late line for a type: geometric SVG (cheap art),
  new enemies at the fork, and — because the companion is drawn from the Early spawn the first
  fight beats — a new companion. One purchase, three systems.
- **Heroes, singly.** A fourth hero for a type, into the recruit pool, three stars back. The
  "three a type, complete at 42" line is the *base game's* completeness; the Constellation is
  where a type gets its fourth (§9).
- **Locations, as alternates.** The fourteen types are already partitioned across the five
  itinerary Locations, so a new one cannot take a fresh slice: it is an alternate for an existing
  slate — same `spawnTypes`, its own name, Guardian, tint, ambience and track — entering
  `ITINERARY_POOL_IDS` so the four-of-N draw has more to draw from. Guardian art is the generated
  grammar (`guardianFigures.ts`) and the Crucible is decoupled from the Guardian count, so a
  sixth Guardian breaks nothing. The cost is the music: a FLAC track per Location.
- **Cosmetics.** A hero's alternate palette (portrait plus the pose frames), a title sky, a map
  tint. The purest fit for "no power", the weakest for "new things for runs": cheap, a few in the
  catalog as the first thing a single clear can afford, never the spine.

---

## 5. Not in the catalog

- **Ascension.** Unlocked by clearing the rung below, never bought (per user direction; the
  Slay the Spire shape). Paying the reward of clearing to make clearing harder is backwards, and
  Ascension is where mastery is priced — comps, kits, passives, AI, not numbers
  (`project-ascension-scope`). **Five rungs, Ascension 5 the ceiling** (per user direction): the
  game is simple enough that five is the ladder, and §6's palette is sized to it.
- **Banners.** The three concepts are a closed family by invariant; a fourth would be a
  team-wide grant and there is no such thing.
- **Anything a run carries in as power.** No starting gold, no extra socket, no head start on a
  level. The locked paragraph in `progression.md` is the rule and this doc does not reopen it.

---

## 6. Star tiers — Ascension colours

A star records the highest Ascension it was cleared at, and shows a colour for it. **White,
bronze, silver, gold, rainbow** — five colours for the five rungs (per user direction).
**Purely cosmetic**: a star is a star to the balance whatever its colour, so the tier adds
nothing to the Constellation's resources and no purchase reads it.

- Max-only, never regressed: a gold star cleared again at the base tier stays gold.
- Pack stars (§3.5) take a tier the same way.
- Storage: `evolutionStars` is `heroId → pathId[]` today and becomes
  `heroId → { pathId → tier }`, with existing entries decoding to the lowest tier. `totalStars`
  counts entries, so nothing downstream moves.
- **The mapping is the one number this section does not settle.** Five colours; but a base clear
  and Ascension 1–5 are six states. Either the base game *is* the first rung (Ascension 1 with
  nothing turned on, so a base clear is white and A5 is rainbow), or the base clear is white and
  two of the middle rungs share a colour. Decide when Ascension is designed; the palette is
  spoken for either way.

---

## 7. Pricing — first pass

| Item | Stars | Brings back |
|---|---|---|
| Cosmetic | 1–2 | — |
| Class trio | 2–3 | — |
| Single hero | 3 | 3 |
| Titanspawn line | 4 | — |
| Re-cut pack | 5 | 1 (the pack star) |
| Location (alternate) | 5–6 | — |
| Theme pack (8+) | 10–12 | 24+ |

Sized so a first clear (3–5 stars) buys something, the base catalog without theme packs comes in
around 100 against the 126 supply, and every theme pack is net positive for the sky. Nothing here
is measured; the sim can price a pack's *difficulty* (run the pilot on the pack's pool) but not
its worth in stars — that is the designer's, after play.

---

## 8. Code seams

None built. Where each lands when it is:

- `src/data/starterPacks.ts` — the packs as data (`StarterPack`, §3.1), pack zero included.
- `src/data/starShop.ts` — the catalog: an offer per pack, Class trio, spawn line, Location,
  hero, cosmetic. `StarShopOffer` grows a `grant` discriminant so a purchase knows what it
  unlocks; `buyOffer` is unchanged.
- `Profile.equippedPackId` (`'base'` by default); `Profile.evolutionStars` re-shaped for tiers
  (§6) with a decode migration; `Profile.packStars` for §3.5.
- The draft: `generateStarterOptions` is handed the equipped pack's `heroIds`. The recruit pool
  (`heroes` in `data/content.ts`, the fork's contract draw, the Guild Hall) reads the equipped
  pack under §3.4 if it is taken up.
- The Compendium's `starters` / `recruitable` tabs become a section per pack held; the
  `STARTER_HEROES` / `RECRUIT_HEROES` module constants stop being constants.
- `RunRecord.packId` — a cleared run with the Slashers is a different record than one without
  (§10).
- The title: the equip toggle, beside the Constellation tile.
- Unlock gating at the pool edges: a bought Class into `classes`, a bought Location into
  `ITINERARY_POOL_IDS`, a bought spawn line into the type's spawn draw — each a filter on the
  profile, applied once where the pool is read.

---

## 9. What this changes in CLAUDE.md

- *A hero is in exactly one pool, never both* → true **per run**, decided by the equipped pack,
  not per definition. A re-cut pack stands recruit-only heroes in the draft; §3.4 puts a pack's
  un-drafted heroes in the recruit pool.
- *42, three a type, complete* → the **base game's** roster. The Constellation is where a type
  gets a fourth hero and where heroes outside the universe exist at all.
- The Compendium's starters / recruitable split is per pack, not per `HeroDefinition.starter`.
- Nothing else. The stars' earning rules, the balance, the empty-catalog rule (an offer needs a
  grant to make) and the unlocks-only lock all stand.

---

## 10. Open questions

1. **§3.4** — do a pack's un-drafted heroes join the recruit pool while it is equipped? Proposed
   yes; not ruled on. It is the difference between a pack run and a pack draft.
2. **Pack stars on theme packs and pack zero.** Cheap and symmetric; would make the packs the
   sky's first row. Not asked for.
3. **The tier mapping** (§6): six clear states on five colours.
4. **Run History and the pack.** A record should say which pack a run opened on; whether the
   history filters by it is a screen question for later.
5. **A mono-slate pack and the Locations.** The Foundry pack into the Molten Foundry is a
   mirror; the Foundry pack into the Blighted Shrine is a run whose whole draft is Shadow-weak.
   Ruled flavour, not balance — recorded so the first playtest that hates it knows it was chosen.
6. **Whether a bought hero can be in more than one pack.** A Slasher in a later "Villains" pack
   is the same hero twice; the schema allows it and nothing needs it yet.

---

## 11. Phases

1. **The pack schema and pack zero** — `StarterPack`, `equippedPackId`, the draft reading the
   equipped pack, the title toggle, the Compendium per pack. No new content; the base game
   unchanged under it. A re-cut pack (the Foundry) as the first offer, to prove the seam.
2. **Star tiers** — the storage re-shape, the decode migration, the five colours on every star
   cell. Waits on Ascension existing to have a tier to record; the storage can land first.
3. **The small catalog** — Class trios, a Titanspawn line, a cosmetic or two; each is a pool
   filter on the profile.
4. **The first theme pack** — the Slashers, eight heroes through the full hero pass, with
   whatever §3.4 became.
5. **An alternate Location** — the first one with its own Guardian and track.
