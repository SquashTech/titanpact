# collection.md — The Collection: a deck of heroes, and the stars that grow it

> **STATUS: DIRECTION DECIDED 2026-09-26 (per user direction), NUMBERS OPEN. BUILT except phase 4
> (the Constellation re-price), which is held — §10.**
> The designer stops assigning heroes to the draft or the recruit pool; the player does, on a
> **Deck** built from the heroes the account owns. The base 42 are owned from the first launch
> and are the default deck. Stars are a renewable currency — a cleared run pays a base bonus that
> grows by Ascension rung, and an Ascension attempt costs stars to begin. Heroes past the base 42
> come in bundles or are drawn blind by the **Starfall**; none is sold singly. §8 lists what this
> reversed.

---

## 0. Why this exists

Two problems with one answer.

- **The Constellation finishes.** `constellation.md` §1 prices the shop against a finite supply
  (126 stars for the base roster, three more a pack hero), and says so: the shop is done the day
  the sky is full. A hero or Location is cheap to author, so content will keep coming — but a
  player who has starred every path has nothing left to earn it with.
- **Ascension pays only bragging rights.** A1 measures 31% full-clear against Classic's 74%
  (`ascension.md` §9b). Nothing a player keeps says they climbed.

And a third that the first two expose: **a growing collection has no use** while the designer
decides which fourteen heroes open a run and which twenty-eight can join one. The Deck is the
answer (Starter Packs, a first answer that swapped a whole pool at once, were deleted with it).

---

## 1. The rule this reduces to

**You collect heroes; you build the run's pools out of them; stakes pay stars and cost stars.**

The Constellation's first half still holds untouched — *content, never configuration*: nothing
bought carries power into a run, it only changes what the run's pools can draw. A deck is a
choice of which content, not a stat.

---

## 2. The Deck

A deck is **three heroes a draftable type, 42 in all — three equal slots, no starter and no
recruit** (2026-09-26, per user direction, replacing the 14 starter + 28 recruit split of the
same morning). **There is no starter / recruit-only distinction anywhere**: `HeroDefinition.starter`
is deleted, and with it Starter Packs, presets and the Second String.

- **The draft draws one hero from each row, then shows four.** `generateStarterOptions(seed,
  deckRows(deck))` (`src/run/draft.ts`) draws fourteen — one a type — and shows four of them, so
  the four always span four types, which is what the old one-starter-a-type rule was protecting.
  The player picks two, as before. Every decked hero can open a run.
- **All 42 feed the run.** The fork's contracts, the Guild Hall and the hero-pool enemy party
  read the whole deck. The Guild Hall offers any deck hero not on the roster — it used to offer
  only `starter: false` ones. An owned hero **left out of the deck is out of the run** entirely.
- **The default deck is the base roster**, three a type.
- **A slot may stay empty** only when the account owns fewer than three of a type. It cannot,
  in the base game.
- **A slot is filled by a hero of that slot's type** — its innate primary. A dual-typed hero
  goes under its primary.
- **A new account gets no on-ramp** (decided): its first draft is as random as any other, and
  the first-time tips carry a new player.
- **The screen** is the Collection on the title (`CollectionScreen`), after Clash Royale: one
  long page, a section a type, every hero of the type in it — the three decked first (gold edge,
  *In deck*), the owned rest, then the heroes not yet owned, greyed with their price. A **rail of
  type glyphs down the right edge** jumps the page to a type (tap or drag) and lights the type in
  view. Tapping a hero gives **Info** (the full dossier) and one verb: **Equip** for an owned hero
  out of the deck — the row's three light as *Replace*, and the one tapped is swapped out — or
  for one not owned, **Buy** its bundle at the bundle's current price, or a line saying only the
  Starfall brings it (phase 6: no hero is sold singly). Each owned card carries its three path stars.

---

## 3. Who you fight — two from the deck, the rest from anywhere

**A recruitable fight fields at least two heroes from the deck; any others are strangers**,
drawn from the whole catalog (2026-09-26, per user direction). Hero-pool enemies appear only at
recruitable nodes (the Skirmish and the Elite; the opener, `battle` and the Guardian's escorts
are Titanspawn), so the point of those fights is that what you beat can join you. Two claimable
heroes a fight means a fight never offers nothing, and a stranger is how a player meets a hero
before owning it.

- **A stranger is any hero not in the deck.** A stranger you don't own is the advertisement.
  One you own but left out of the deck is just a hero you chose not to bring.
- **A stranger is never offered.** The contract offers are picked from the party's deck heroes
  only, so a stranger never reaches the recruit screen at all (per user direction). A party may
  hold two. Owned or not, a stranger is the Collection's business, never the run's.
- **Act 1 has no strangers by construction.** Its Skirmish is capped at the immortal roster
  (`encounterHeroCountOverride`), so it fields two, and both are the deck's. Strangers begin
  where parties reach three, the Act 2 fork on.
- **The Elite reads the same rule.** It is recruitable on the same terms.
- **It dampens deck-softening without removing it.** Filling the deck with easy heroes softens
  only the claimable half of a party, and those are also the heroes you would recruit.

---

## 4. Getting heroes

- **The base 42 are owned from the first launch**, free. A new account's first run must not be
  worse than today's. **Re-chosen 2026-09-28** (per user direction), once the roster reached six a type:
  the base should teach the clean version of each type, so eight heroes swapped places with the
  Starfall. Ashwing, Selkie, Hush, Nimbus, Murk, Thane, Drift and Patch came in; Brimstone, Riptide,
  Flurry, Tempest, Nightshade, Zenith, Reverie and Bellows went out. Four of those eight are mixed lines
  and two are the complexity exceptions (a dual type, the Burden). A profile written before the swap
  keeps the eight free (`LEFT_BASE_2026_09_28`, a `grant.` ledger entry, `PROFILE_VERSION` 2).
- **Everything past the base is got with stars** (phase 6, 2026-09-26, per user direction — no
  hero is sold singly):
  - **A bundle** — From the Tall Grass is the only one; the Free Company was deleted and its three
    are the Starfall's alone (`unlock: 'starfall'`). **A bundle part of which is owned is
    DISCOUNTED**: its price is its cost times the share of its heroes still to get, rounded up
    (`offerPrice`) — 8, then 6, then 3 — and the ledger replays purchases in order, so a bundle
    is charged what it cost the day it was bought.
  - **The Starfall** (renamed from the Summoning; *Omen* was the user's other candidate and is the
    Location's word, so it was passed over) — a blind draw, stars only, forever. Two rules make it
    earned rather than predatory:
    - **It only ever yields a hero you don't own.** No duplicates, so no duplicate currency.
      The excitement is *which*, never *whether*.
    - **It costs less than choosing.** `STARFALL_PRICE` = 2 against a bundle's 8 for three: the
      discount is what giving the choice up is paid.
    - It is not called a Contract — the Recruit Contract is an in-run item.
- **Alignments** (PROPOSED, nothing built but a seat): a Starfall that draws from a curated few
  — the Constellation's Heroes page holds an empty section for them. Named Alignments because
  *Banner* is the Guardian's relic. **Direction, 2026-09-28** (per user direction, not built): themed
  Starfalls are for COSMETICS, not heroes. Hero unlocking stays a true blind draw, where the player
  never knows what comes next.
- An owned hero **stars on the base terms** (`constellation.md` §2): three paths, three stars. So
  buying a hero still grows the sky, and the collection and the currency feed each other.

---

## 5. The star economy

**Stars stop being finite.** A cleared run pays a **clear bonus** on top of its hero stars, and
the bonus is repeatable.

| | Entry fee | Clear bonus | Expected a run* |
|---|---|---|---|
| **Classic** | — | **1**, every clear | +0.74 |
| **A1** Permadeath | **1**, always spent | **6**, every clear | +0.87 |
| A2–A5 | rises by rung | rises by rung | must beat the rung below |

\* Win rate × bonus − fee, at the skilled pilot's measured 73.7% / 31.2% (`ascension.md` §9b).
First-pass figures (`CYCLES`, `src/run/cycles.ts`); `test/starShop` pins only the
shape — Classic free and paying, each rung ahead of the one below.

**Decided 2026-09-26, per user direction:** Classic pays a **small bonus on every clear**, so a
player at zero can always win their way back to an A1 fee — no balance is ever stuck — and the
**fee is always spent**, a win refunding nothing. The designer's first spitball (3 / 5) is below,
with why it was moved.

The spitball was **wrong in one direction**: at measured
win rates, Classic pays ≈ 0.74 × 3 = **+2.2 a run** and A1 ≈ 0.31 × 5 − 1 = **+0.6**, so once the
hero stars run out Classic is the best farm and Ascension is never worth attempting. The shape
the numbers must satisfy:

- **A rung's expected payout must beat the rung below it.** Each rung roughly halves the win
  rate, so the bonus must grow faster than that.
- **Classic is not a farm.** Held by keeping its bonus small rather than paying it once (the
  first-clear-only candidate was declined — it could strand a player below the A1 fee).
- **The fee is a price, not a stake.** The refund-on-a-win candidate was declined.

The fee is **spent at run start and saved with it**, so quitting mid-run is not a free attempt.
**Classic never costs**, so a player at zero stars is never locked out of the game, only out of
a rung.

Hero stars are unchanged: one per hero per path, a set not a count.

---

## 6. The tension to watch — the north star under a player's deck

*No hero is a trap pick* is today checked against a roster the designer fixed. A player will
build the strongest deck they can, and a hero no strong deck holds will show plainly. That is
information, not a defect — it is how a card game balances — but it moves the test from "is this
hero viable in the pool it was put in" to "does anyone choose it". The sim can be pointed at a
deck (the sim drafts from `deckRows` of the default deck).

---

## 6a. Build-arounds — heroes that bend the deck's rules (PROPOSED, 2026-09-26)

A **build-around** hero, once decked, overrides one of §2's deck rules and asks something of
the deck in return. The worked example was written against starter slots: a **Fire Goddess**
who requires more than one Fire starter. With starter slots gone (§2) it needs recasting — a
Fire row that holds four, or a draft that always offers a Fire, are the obvious shapes — and the
recasting is open. The rule it bends is still the draft's type spread, and bending it is still
the price.

- **Rules are data.** A build-around carries a `deckRules` entry from a small shared vocabulary
  (`rowSize: { type, count }`, `draftAlwaysOffers`, `forbidsType`, …) that deck validation
  and the draft read. It is never bespoke logic on the hero (the content-is-data rule).
- **A requirement must be visible on the Collection card** before the hero is decked, with the
  deck marked invalid until it is met.
- **One build-around a deck**, proposed. Two rule-benders stacking is where a deck stops being
  legible.
- **Open:** whether a build-around's power lives in the rule it bends (a Fire-heavy draft IS the
  reward), in its own kit reading the deck (+X per decked Fire hero, a run-time read of deck
  state), or in both. The rule-bend alone is the cheaper, cleaner first version.

---

## 7. Code seams

The deck is `src/run/deck.ts` (`deckRows`, `normalizeDeck`, `encounterPools`), held on
`Profile.deck` and snapshotted on `RunState.deck` at the seal, so an edit between sessions never
moves a run's pools. The enemy draw splits in `enemyGen.ts drawParty` (the deck floor first, the
rest from deck and strangers together, shuffled), and the map's preview reads the same pools as the
fight; `isRecruitable` against the deck is what refuses a stranger. The stakes are
`AscensionRung.entryFee` / `clearBonus` with the profile's ledger (`starsEarned` / `starsSpent` /
`starBalance`, `starShop.ts`); the Starfall is `starfall` / `starfallPool` / `STARFALL_PRICE`.

**The title hub (2026-10-01, per user direction — Clash Royale / Marvel Snap).** The Collection
and the Constellation stopped being sheets with a Close button and became whole pages along a
bottom bar, `Collection · Play · Constellation` (`HubNav.tsx`), Play raised in the middle as the
title itself. Records went to a corner glyph on Play: a ledger, not somewhere you go. Each page
has its own sections along its top (`hubChrome.tsx`):
- **Collection** — *Deck*, the run's 42 on one screen, two types a line, a tap opening that
  type's bench to swap from (`DeckView.tsx`); and *All heroes*, the long page a type with the rail.
- **Constellation** — *Starfall*, the sky: every hero in the catalog a star on its type's spoke,
  the owned ones lit, the Lodestar at the centre and the call under it (`StarSky.tsx`); *Market*,
  bundles, Alignments and Locations; *Stars* and *Spawn* as before.

The Starfall scene (`Starfall.tsx`) runs ~7.7s, every beat skippable: the stars rise, the type
wheel spins up and ticks to a stop on the hero's type (the first thing told), the light swells in
that colour and leaves the sky, falls as a meteor, strikes, and the hero rises out of the pillar
as a silhouette before colouring in. A hero just fallen flares in the sky, dots the Collection's
tab and wears a New tag until the session ends.

---

## 8. What this changes

In **CLAUDE.md**:
- *Starters vs. recruit-only — every hero is flagged, a hero is in exactly one pool* → **deleted**
  (phase 5): no flag, no split; the draft draws one hero from each deck row.
- *42, three a type* → the base collection and the default deck's size, not the run's.

In **constellation.md**:
- §1 *the supply is finite, the shop finishes* → the clear bonus makes it renewable.
- §2 *Balance = earned − cost of what is held* → earned (hero stars + clear bonuses) − held −
  spent.
- §3 Starter Packs → deleted with the starter split (phase 5); §3.4 is moot.
- The Heroes shelf of singles → no hero is sold singly (phase 6); the Constellation sells the
  Starfall and bundles, and holds the Compendium's **Stars** and **Spawn** pages.
- §7 pricing is to be re-done against a renewable supply — phase 4, held.

In **ascension.md** and **progression.md**: the Compendium they name is gone (phase 5) — its
hero lists are the Collection, its star cells and Spawn bestiary the Constellation's Stars and
Spawn pages, its Equipment and Types pages the Reference's.

---

## 9. Open questions — DO NOT silently resolve

- **Every number in §5** (first-pass, unmeasured beyond the arithmetic there).
- **Whether a stranger is drawn toward heroes the account doesn't own** (the advert) or evenly
  from everything not decked. Two strangers a party is decided.
- **The Starfall's price** against a bundle's, and what an Alignment costs.
- **Three a type** is decided; whether a later size (four, once collections are deep) is ever
  wanted is not.

Settled by the build: a Starfall or a purchase lands a hero in the Collection's reserve with a
mark, never in the deck; and the deck is fixed for a run (Ascension included) because it is
snapshotted at the seal.

---

## 10. Phases

1. **The Deck — BUILT 2026-09-26** (§2, §3, §7).
2. **The stakes — BUILT 2026-09-26** (§5): the fee spent at the seal, the bonus paid on a win, the
   rung picker printing both and greying a rung out of reach (`canEnterRung`).
3. **The Summoning — BUILT 2026-09-26**, then reshaped by phase 6 (its single-hero offers deleted).
4. **Constellation re-price** against §5 — **HELD**, not started.
5. **No starters; the Compendium dissolved — BUILT 2026-09-26** (§2, §8). `test/deck` pins that the
   four options span four types and every decked hero can be drawn. **Unmeasured**: a random draft
   raises the average opening — sim pass 11 found the Second String beating Classic — and the
   sim has not been re-run.
6. **The Starfall; bundles only — BUILT 2026-09-26** (§4). A ledger entry this build no longer
   ships — a single bought earlier, the Free Company — is **refunded**: its stars come back; a
   legacy single still owns its hero, a legacy Free Company does not.
