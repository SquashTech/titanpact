# collection.md — The Collection: a deck of heroes, and the stars that grow it

> **STATUS: DIRECTION DECIDED 2026-09-26 (per user direction), NUMBERS OPEN. PHASES 1–3 (THE DECK, THE STAKES, SINGLE HEROES AND THE SUMMONING) ARE IN, same day — §10.**
> The designer stops assigning heroes to the draft or the recruit pool; the player does, on a
> **Deck** built from the heroes the account owns. The base 42 are owned from the first launch
> and the default deck IS today's split, so a new account plays today's game. Stars become a
> renewable currency — a cleared run pays a base bonus that grows by Ascension rung, and an
> Ascension attempt costs stars to begin. Heroes past the base 42 are bought singly, in bundles,
> or drawn blind. §8 lists what this reverses; until the §10 phase that replaces each one lands,
> the rule in force is the one it names.

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
decides which fourteen heroes open a run and which twenty-eight can join one. Starter Packs
(`constellation.md` §3) are a first answer — a whole pool swapped at once — and the Deck is the
general one.

---

## 1. The rule this reduces to

**You collect heroes; you build the run's pools out of them; stakes pay stars and cost stars.**

The Constellation's first half still holds untouched — *content, never configuration*: nothing
bought carries power into a run, it only changes what the run's pools can draw. A deck is a
choice of which content, not a stat.

---

## 2. The Deck

A deck is **14 starter slots + 28 recruit slots = 42**, one starter and two recruits **per
draftable type**.

- **The starter slots feed the draft.** `generateStarterOptions` rolls its four from the fourteen
  and the screen picks two, as today. One starter per type is what gives the draft its type
  spread; a deck of three Fire starters would stop it being a draft, so the slot is per type.
- **All 42 feed the run.** The fork's contracts, the Guild Hall and the hero-pool enemy party
  read the whole deck — which is what `heroPool()` hands them today (every owned hero, starters
  included). An owned hero **left out of the deck is out of the run** entirely.
- **The default deck is today's roster**: each type's `starter: true` hero in its starter slot,
  its other two in the recruit slots. `HeroDefinition.starter` survives as the default and
  nothing else.
- **A slot may stay empty** only when the account owns fewer than three of a type. It cannot,
  in the base game.
- **A slot is filled by a hero of that slot's type** — its innate primary. A dual-typed hero
  goes under its primary.
- **Starter Packs become presets.** Equipping a pack was loading a deck; a preset is a deck the
  game hands you whole. The Second String is the preset that swaps every starter for a recruit.
  Pack zero, currently named *Classic*, goes back to **The Fourteen** — *Classic* is the run
  mode's name now (§5).
- **The screen** is a Collection on the title: every hero owned as a card in a scrollable grid
  (Marvel Snap, Clash Royale), the deck as fourteen type rows of three, a tap to swap a hero in.
  Locked heroes show on the grid, face visible, dossier open, as a shelf does today.

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
  worse than today's.
- **Everything past the base is bought with stars:**
  - **A single hero**, chosen — the full price.
  - **A bundle** (the Free Company, From the Tall Grass as they stand) — a set at a discount.
  - **A Summoning** — a blind draw, stars only, forever. Two rules make it earned rather than
    predatory:
    - **It only ever yields a hero you don't own.** No duplicates, so no duplicate currency.
      The excitement is *which*, never *whether*.
    - **It costs less than a direct purchase.** Buying is choosing; the discount is what giving
      the choice up is paid. A draw at the direct price should never be taken.
    - It is not called a Contract — the Recruit Contract is an in-run item.
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
First-pass figures (`ASCENSION_RUNGS`, `src/run/ascension.ts`); `test/starShop` pins only the
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
deck (`SIM_PACK` already takes a draft pool).

---

## 6a. Build-arounds — heroes that bend the deck's rules (PROPOSED, 2026-09-26)

A **build-around** hero, once decked, overrides one of §2's deck rules and asks something of
the deck in return. The worked example: a **Fire Goddess** who requires the deck to hold more
than one Fire starter, breaking *one starter per type*. That rule exists to give the draft its
spread, so breaking it is the price. The payoff is a draft leaning toward Fire.

- **Rules are data.** A build-around carries a `deckRules` entry from a small shared vocabulary
  (`requiresStarters: { type, count }`, `extraRecruitSlots`, `forbidsType`, …) that deck
  validation reads. It is never bespoke logic on the hero (the content-is-data rule).
- **A requirement must be visible on the Collection card** before the hero is decked, with the
  deck marked invalid until it is met.
- **One build-around a deck**, proposed. Two rule-benders stacking is where a deck stops being
  legible.
- **Open:** whether a build-around's power lives in the rule it bends (a Fire-heavy draft IS the
  reward), in its own kit reading the deck (+X per Fire starter, a run-time read of deck
  state), or in both. The rule-bend alone is the cheaper, cleaner first version.

---

## 7. Code seams

None built.

- `Profile.deck` — `{ starters: Record<type, heroId>, recruits: Record<type, [heroId, heroId]> }`,
  decoded from an old file as the default deck (the equipped pack's starters, if one was held).
- `heroPool()` gains the deck: owned (`unlock` held) AND decked. Every reader already goes
  through it or `recruitPool` in `App.tsx`. The enemy draw (`heroPoolEncounter`,
  `src/run/encounters.ts`) splits in two: the first two from the deck, any more from the
  catalog. The claim side needs nothing: `App.tsx` already filters the defeated party through
  `isRecruitable` against `recruitPool` before `pickContractOffers`, so once `recruitPool` is
  the deck a stranger is never offered. The care is all in the draw: it must stay deterministic
  (the fork tile previews the typing off the same seed), keep the roster exclusion and the
  Location bias, and hand the sim and tests the base game when no deck is given.
- `beginRun`'s draft reads the deck's starters in place of `equippedPack`; `Profile.equippedPackId`
  becomes "load a preset" and goes.
- `starBalance` is no longer fully derived: an entry fee buys nothing held, so the profile keeps a
  spent-stars ledger (`Profile.starsSpent`) beside the offer purchases.
- `Profile.clearBonuses` — the clear bonuses paid, by rung, for the balance and for "first clear
  only" if that is chosen.
- The Summoning: a seeded draw over `heroes` not owned, and a `grant: 'summon'` offer kind.
- The Collection screen on the title; the Constellation's pack shelf becomes presets + bundles.

---

## 8. What this changes

In **CLAUDE.md**:
- *Starters vs. recruit-only — every hero is flagged, a hero is in exactly one pool* → the flag is
  the **default deck**; the player assigns. "One pool" holds per deck.
- *42, three a type* → the base collection and the default deck's size, not the run's.

In **constellation.md**:
- §1 *the supply is finite, the shop finishes* → the clear bonus makes it renewable.
- §2 *Balance = earned − cost of what is held* → earned (hero stars + clear bonuses) − held −
  spent.
- §3 Starter Packs → presets of a deck; §3.4 (the un-drafted heroes) is moot — a deck decides it.
- §7 pricing is re-done against a renewable supply.

---

## 9. Open questions — DO NOT silently resolve

- **Every number in §5**, and the two candidate fixes for the Classic farm.
- **Whether a stranger is drawn toward heroes the account doesn't own** (the advert) or evenly
  from everything not decked. Two strangers a party is decided.
- **Summoning price** against the direct price, and whether bundles survive beside it.
- **Does a Summoning or a purchase ever put a hero in the deck by itself?** Proposed: no, it lands
  in the collection with a mark, the deck untouched.
- **Is the deck locked during an Ascension attempt?** An Ascension attempt paid for with stars could fix the deck at
  entry; it does anyway, since the run is saved.
- **Two per type in the recruit slots** is decided; whether a later size (3, once collections are
  deep) is ever wanted is not.

---

## 10. Phases

1. **The Deck — BUILT 2026-09-26.** `src/run/deck.ts` (the rows, the default, `normalizeDeck` making
   any stored value legal against what is owned, presets, `encounterPools`); `Profile.deck`, stored
   loose and made legal on read (`profileDeck`), a pre-deck file's equipped pack migrating into its
   starter slots; `RunState.deck`, the deck snapshotted when the pact is sealed, so an edit between
   sessions never moves a run's pools (null on an older save, which reads every owned hero and
   fields no strangers); the draft rolling from the starter slots; the enemy draw split in
   `enemyGen.ts drawParty` — the deck floor first, the rest from deck and strangers together, the
   party shuffled so its order says nothing — with the map's preview reading the same pools as the
   fight. The claim side needed nothing: `isRecruitable` against the deck refuses a stranger. The
   **Collection** tile on the title (`CollectionScreen`): a row a type, tap a hero to make it the
   starter, read it, or trade in an owned hero the row has no room for; the two presets above. The
   Constellation lost its Starter Packs shelf; rung 0 is named **Classic**. The Second String's
   first-clear gate went with the equip toggle — any deck is buildable by hand from launch.
2. **The stakes — BUILT 2026-09-26.** `AscensionRung.entryFee` / `clearBonus` (`rungOf`); the
   profile's ledger, `bonusStars` and `feesPaid`, beside the hero stars (`starsEarned` /
   `starsSpent` / `starBalance` in `starShop.ts`, the balance no longer fully derived);
   `recordRunStarted` spends the fee at the seal and refuses a rung the balance cannot cover;
   `recordRunEnded` pays the bonus on a win into `RunRecord.clearBonus`. The rung picker prints
   each rung's cost and pay and greys one out of reach (`canEnterRung`); the run summary shows the
   bonus as a Records chip, and its Start a New Run names the fee — or, out of reach, says what
   the rung needs, since that button skips the picker. The Constellation's ledger counts both.
   Unmeasured beyond the arithmetic above; the numbers are the designer's after play.
3. **Single purchases and the Summoning — BUILT 2026-09-26.** Every hero outside the base 42 is an
   offer of its own at `HERO_PRICE` = 3 (`hero.<id>`, generated in `data/starShop.ts`). A bundle is
   those heroes a star cheaper and is **sold only while none of them is owned** (`offerWithdrawn`):
   past that its heroes are singles, so no hero is paid for twice and no price ever moves; three
   singles hold the bundle. **The Summoning** is `SUMMON_PRICE` = 2 — under a single, the discount
   for giving up the choice — and draws from `summonPool`, the heroes outside the base not owned,
   so never a duplicate; it goes quiet when the pool is empty. It leaves `summon.<id>` in
   `Profile.purchases`, priced by `starsSpent`, so ownership is still one read
   (`ownsHero`, `run/recruitment.ts`: base, bundle, single, or drawn). The Constellation's first
   shelf is **Heroes** — the Summoning over one row a hero — and a draw is revealed on its own sheet.
   A hero bought or drawn lands in its row's **reserve** in the Collection, never in the deck, and
   swaps in from either side. Locked heroes are not yet on the Collection's grid; the shop is where
   they are seen.
4. **Constellation re-price** against §5.
