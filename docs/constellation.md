# constellation.md — The Constellation: what a star buys

> **STATUS (2026-10-03).** Decided in shape 2026-09-17 (per user direction). **Built:** the shop
> (`src/run/starShop.ts`, `src/data/starShop.ts`, `StarShopScreen.tsx`, tabs Starfall / Market /
> Stars / Spawn) selling four bought Locations (§11 phase 5), one hero bundle, From the Tall Grass
> (§11 phase 6), and the Starfall blind draw (`docs/collection.md` §4). **Deleted 2026-09-26:**
> Starter Packs (§3), with the starter split, and the Compendium, whose stars are this panel's
> Stars and Spawn tabs (`docs/collection.md` §2, §10). **Not built:** star tiers (§6), Class trios,
> Titanspawn lines and cosmetics (§4), and the re-price against a renewable supply (§7,
> `docs/collection.md` phase 4, held).

---

## 0. Why this exists

`progression.md` locks the meta-game as **unlocks only**: a run resets everything, and what
persists is the pool a future run draws from. The earning half was built 2026-09-16 — a star per
hero per Evolution path, on the final roster of a clear — and the spending half was left as a
sentence: stars buy "new things for runs". This is that sentence unpacked. Its first item, the
Starter Pack, is gone with the starter split; the Collection's deck (`docs/collection.md`) is what
a player now shapes a run's pools with.

---

## 1. The rule this reduces to

**You buy content, never configuration — and content grows the sky.**

Two halves. The first is the locked line re-stated: nothing in the Constellation carries power
into a run. A purchase adds things to the pools a run draws from (heroes, Locations, and in
future Classes and spawn), or changes what the player looks at (cosmetics).

The second half is what keeps the shop alive: a hero bought brings **three stars** on the same
terms as a base hero's, so a purchase grows the supply it was paid from. The supply is no longer
finite — a cleared run also pays a repeatable **clear bonus** by rung (`docs/collection.md` §5) —
so the shop is never finished just because the sky is full.

---

## 2. Supply — what a star is and how many there are

- One star per hero per Evolution path, permanent, a set not a count (`Profile.evolutionStars`):
  three a hero. A hero that finishes unevolved earns nothing; clearing the same path twice is the
  same star. A `companion:<type>` star is earned for clearing with the companion alive
  (`docs/ascension.md`).
- A **clear bonus** on every won run, by rung (`ASCENSION_RUNGS`, `src/run/ascension.ts`); an
  Ascension attempt costs an entry fee, always spent (`docs/collection.md` §5).
- **Balance = earned (hero stars, companion stars, clear bonuses) − cost of what is held − spent**
  (`starBalance`). A star never comes off a hero.

An owned hero stars on these terms whatever way it was got, so buying a hero still grows the sky
and the collection and the currency feed each other.

---

## 3. Starter Packs

**Deleted 2026-09-26** with the starter split (`docs/collection.md` §2): the draft draws one hero
from each of the player's deck rows, and there is no pool for a pack to replace. A pack's two
ideas live on elsewhere — a themed set of new heroes is a **bundle** (§11 phase 6), and choosing
what a run opens on is the **deck**.

---

## 4. The rest of the catalog

Every item is an unlock into a pool a run draws from, or a cosmetic. In order of how well each
fits the engine:

- **Classes, in trios — not built.** A Class is one move or one passive, untiered, wearing its
  holder's type (`src/data/classes.ts`). The Crucible rolls three from the whole catalog, so a
  trio bought would be in every Crucible from then on. The cheapest real content in the game.
- **Titanspawn lines — not built.** A second Early / Mid / Late line for a type: geometric SVG
  (cheap art), new enemies at the fork, and — because the companion is drawn from the Early spawn
  the first fight beats — a new companion. One purchase, three systems.
- **Heroes — built as bundles and the Starfall.** No hero is sold singly (2026-09-26): a bundle
  sells a set at a price discounted by what of it is owned, and the Starfall is a blind draw of a
  hero not owned (`docs/collection.md` §4). The base roster's "three a type" is the *base game's*
  completeness; every hero past it carries `HeroDefinition.unlock` (§9).
- **Locations — built, four** (§11 phase 5). Drawn **beside** the base five rather than as an
  alternate for one, so a bought place's spawn types overlap the base partition. The cost is the
  music: none of the four has a track yet.
- **Cosmetics — not built.** A hero's alternate palette, a title sky, a map tint. The purest fit
  for "no power", the weakest for "new things for runs". **Direction, 2026-09-28** (per user
  direction): themed Starfalls (*Alignments*, `docs/collection.md` §4) are for cosmetics, never
  heroes.

---

## 5. Not in the catalog

- **Ascension.** Unlocked by clearing the rung below, never bought (per user direction; the
  Slay the Spire shape) — an attempt's star fee is the price of a try, not of the unlock.
  Ascension is where mastery is priced — comps, kits, passives, AI, not numbers
  (`docs/ascension.md`). **Five rungs, Ascension 5 the ceiling** (per user direction).
- **Banners.** The three concepts are a closed family by invariant; a fourth would be a
  team-wide grant and there is no such thing.
- **Anything a run carries in as power.** No starting gold, no extra socket, no head start on a
  level. The locked paragraph in `progression.md` is the rule and this doc does not reopen it.

---

## 6. Star tiers — Ascension colours (NOT BUILT)

A star records the highest Ascension it was cleared at, and shows a colour for it. **White,
bronze, silver, gold, rainbow** — five colours for the five rungs (per user direction).
**Purely cosmetic**: a star is a star to the balance whatever its colour.

- Max-only, never regressed: a gold star cleared again at the base tier stays gold.
- Storage: `evolutionStars` is `heroId → pathId[]` today and would become
  `heroId → { pathId → tier }`, with existing entries decoding to the lowest tier. `totalStars`
  counts entries, so nothing downstream moves.
- **The mapping is unsettled.** Five colours, but a base clear and Ascension 1–5 are six states.
  `docs/ascension.md` §8 proposes Base white, A1–A5 bronze / silver / silver / gold / rainbow.

---

## 7. Pricing — first pass

| Item | Stars | Status |
|---|---|---|
| Starfall (one hero, blind) | 2 | built (`STARFALL_PRICE`) |
| Hero bundle (three) | 8, discounted by what is owned | built (`offerPrice`) |
| Location | 6 | built |
| Cosmetic | 1–2 | proposed |
| Class trio | 2–3 | proposed |
| Titanspawn line | 4 | proposed |

Sized when the supply was finite so a first clear (3–5 stars) buys something. Nothing here is
measured; the re-price against the renewable supply is `docs/collection.md` phase 4, held. The
sim can price an offer's *difficulty* but not its worth in stars — that is the designer's, after
play.

---

## 8. Code seams

Built: `StarShopOffer.grant` is `location` or `heroBundle`; `buyOffer` is unchanged by grant kind.
A place is in a run's pool only while its offer is held (`LocationDefinition.unlock`,
`locationPool(profile.purchases)` in `src/run/locations.ts`); a hero likewise
(`HeroDefinition.unlock`, `heroPool` in `src/run/recruitment.ts`). Each is a filter on the
profile applied once where the pool is read; the sim and the tests pass nothing and get the base
game. `rosterHeroes` and the save's hero index hold every authored hero, so a run carrying an
unowned hero decodes on any profile.

Still to land with their items: a bought Class into `classes`, a bought spawn line into the
type's spawn draw, and the tier storage (§6).

---

## 9. What this changes in CLAUDE.md

- *42, three a type, complete* → the **base game's** roster. `test/roster` pins three a type over
  `heroPool(heroes)` with nothing bought; every hero past it carries `unlock`.
- The starter split and pack-based readings are gone with §3.
- Nothing else. The stars' earning rules, the empty-catalog rule (an offer needs a grant to make)
  and the unlocks-only lock all stand.

---

## 10. Open questions

1. **The tier mapping** (§6): six clear states on five colours.
2. **Re-pricing** every offer against a renewable supply (`docs/collection.md` phase 4).
3. **Music for the four bought Locations** (`hasTrack` is false for each; the act plays in
   silence).
4. **`lore.md` §5** still reads "the sixth" seal; with bought Locations and four acts, several
   base seals hold at the end of a run, and it should read "the ones you never reached".

---

## 11. Phases

1. **The pack schema** — built 2026-09-19 (Classic and the Second String), deleted 2026-09-26
   with §3.
2. **Star tiers** — not built (§6).
3. **The small catalog** — Class trios, a Titanspawn line, a cosmetic or two — not built.
4. **The first theme pack** — superseded by bundles (phase 6).
5. **Bought Locations — BUILT 2026-09-19, per user direction.**
   - `LocationDefinition.unlock` names the offer that puts a place in the pool; the base six
     carry none. `ITINERARY_POOL_IDS` is the base pool, and a run's real pool is
     `locationPool(profile.purchases)`, read once in `enterAct`. A bought place is drawn
     **beside** the base five, never instead of one, so its spawn types overlap; the partition
     test still holds because it runs over the base pool. More base seals then hold at the end
     of a run (`unbrokenSealLocationIds`).
   - Each warden covers a type no base Guardian does, and each Location takes two shared types
     and one from elsewhere so none reads as a base Location with different weather. All are 6
     stars, unmeasured, and none has a track.
   - **Holy Sanctum** — Light / Spirit / Mind; the **Seraph** (Light / Ancient): the Light
     reader pattern at boss scale — Hallow sets Sanctuary, Smite and Sunlance land ×2 on it,
     Blinding Flash is the spread Daze. A blank face of light, a burning wheel, three pairs of
     wings, the eye in the chest. Ambience `radiance` (candle-light that rises and swells), a
     basilica horizon.
   - **Dreaming Spires** — Mind / Arcane / Spirit; the **Sphinx** (Distort sets Stasis Field,
     Hindsight lands ×2 under it at −1 priority, Psychokinesis the physical hand, Disorient
     the spread debuff; Speed 35). Ambience `drift` (rings that hang and wander), a horizon
     of towers off plumb with blocks hanging in the air.
   - **Thunder Aerie** — Storm / Arcane / Beast; the **Roc** (Storm Lash and Ionize mark with
     Conduct, Ion Cascade ×2 across the marked pair, Skyfall the dive; Speed 90 — the fastest
     champion, 320 HP so the Skeleton King keeps the floor). Ambience `lightning` (bolts that
     stand still, dark 88% of the cycle), a peak past the top of the frame.
   - **Frozen Reach** — Frost / Water / Stone; the **Wendigo** (Deep Chill and Permafrost
     Freeze, Cold Snap ×2 spending the mark, Absolute Zero only on a Frozen hero — Freeze
     halves Speed and a switch clears it, so the bench is the answer). Ambience `blizzard`
     (snow driven sideways on one wind), ice shelves with a ship frozen in.
   - Brass Works was proposed and dropped as redundant with the Foundry; Crystal Hollow, Iron
     Bastion and Witchwood Fen are the un-built rest of that list.
6. **Hero bundles — BUILT 2026-09-19, reshaped 2026-09-26.**
   - `HeroDefinition.unlock` names the offer that puts a hero in a run's pools, exactly as
     `LocationDefinition.unlock` does a place. `heroPool(heroes, purchases)` is the one filter,
     read once in App (`recruitPool`) and handed to the hero-pool encounter draw, `isRecruitable`
     at the claim, and the Guild Hall shelf (`guildHallOffersFor(pool)`). The grant is
     `{ kind: 'heroBundle', heroIds }`; a test holds each hero's `unlock` and the bundle's list to
     each other.
   - The first bundle, **the Free Company** (Scallywag, Patch, Vex), was deleted 2026-09-26; its
     three are Starfall-only (`unlock: 'starfall'`), and Patch has since joined the base.
   - **From the Tall Grass** (2026-09-24, per user direction) is the one bundle: 8 stars, the
     starter triangle — Fire, Water, Nature — as a Pokémon nod.
     **Drake** — the fire dragon, Attack 105 on a thin pool. Innate **Slumber**: a Rest grants
     Ambush 45, so the pool running dry IS the breath drawn, and an MP Potion trades the Ambush
     away. Paths Hoardwyrm, Wyvern (Storm graft; Fire/Storm is 4× weak to Stone on purpose) and
     Cinderscale (Stone graft); signature **Wyrmfire**, the only physical Fire move that takes
     both foes.
     **Nautilus** — the octopus controller, Wisdom 75 / Intelligence 75 on Speed 40. Innate
     **Ink**: on switching out, both active enemies lose 10 Attack and 10 Intelligence (a new
     `SwitchedOut` hook, never on a knockout). Signature **Ink Blast** (+2 priority, Daze on both
     foes, then a retreat that fires Ink) is gated three ways because a double flinch is a free
     turn: `firstTurnOnly`, `oncePerFight` and `manaCostAll`. A hold (the target cannot switch)
     was designed first and dropped — the enemy AI never switches, so it could not matter. Paths
     Deepgrip (the `manaSurcharge` effect), Inkmind (Mind graft), Mimic (Shadow graft).
     **Tixwick** — the mantis, Attack 105 on Speed 45: slow, and first anyway. Innate **Poised**:
     a move that deals no damage leaves it Poised, and its next attack goes a bracket early (a new
     `MoveUsed` hook and a **Poised** status carrying `StatusDefinition.priorityBonus`). Signature
     **Guillotine**. Paths Reaper (Iron graft), Orchid (mono: Provoke and **Lure**), Ghost Mantis
     (Spirit graft).
   - **Everything on a shelf can be looked at before it is paid for** (per user direction): a
     hero's face opens its dossier (`HeroDossierOverlay`), a bundle row its own screen
     (`BundlePeekOverlay`), a Location row the place (`LocationPeekOverlay`: the choice card at
     full size, its omen, its domains by name, who keeps it). **A shelf row never spends a
     star**: the cost on it is a label, and the offer's own screen carries the ONE Purchase
     button, above Close. No row carries a description.
