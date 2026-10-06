# cycles.md — The Cycles: difficulty as the story

> **STATUS: DECIDED in shape; PHASE 1 IS IN** (2026-10-06, per user direction — §7a). Replaces the
> Ascension *ladder* (`docs/ascension.md` §5) with five **Cycles**: each is the Titan's next
> rising, a year after the last, in a world that has changed and against a Titan that has
> adapted — and the fifth ends the cycle for good. A1 Permadeath is built and is not thrown away;
> it becomes Cycle II's rule. §8 lists what is decided, §9 what is open, §7a what is built.

---

## 0. Why

A Slay the Spire ladder is the same run with worse numbers, and it never ends. `ascension.md` §1
already ruled out the first half — *a rung is a rule, never a bare number*. The Cycles rule out the
second: the ladder is a story with five chapters, and the last one is the ending. Replayability
comes from the journey changing, not from the arithmetic growing.

## 1. The premise, revised

- **A sealed Titan sleeps for one year**, not a thousand. Then it rises, and a band sets out again.
  (A thousand years made every run the only run in its world; a year makes the runs a sequence.)
- **Each Cycle is that next year.** The world has changed since the last sealing, and the Titan has
  learned from it.
- **A Titan cannot be killed — until the last Cycle.** Today two seals hold every run, which is why
  only the Herald comes through and the Titan never takes the field (`lore.md` §5). Every Cycle
  costs the world wardens; in **Cycle V no seal holds, and the Titan comes through whole**. It can
  be killed only because, for the first time, it is standing where it can be struck. The thing that
  makes the last Cycle the most dangerous is the thing that makes it winnable.

## 2. The Wardens — the account's first band

**The first-ever Cycle I victory on an account is saved, and those heroes are the account's
Wardens forever.** From Cycle II on, the seals the player breaks are held by the heroes they first
won with. Binding is mutual (`lore.md` §1): the band that sealed the Titan stayed to hold the seals.

- **The snapshot:** each hero's identity, Evolution path, Class, innate (mastered or not), moves and
  gear at the Eyes' close. Never updated by a later win.
- **Six heroes, six base seals** (Wild's Edge, Blighted Shrine, Forbidden Forest, Molten Foundry,
  Storm Coast, Necropolis): each Warden is assigned the seal whose spawn types best fit its typing,
  once, at the snapshot.
- **The Wardens are ADDITIVE.** The beasts (Kraken, Dragon, Manticore, …) stay every Cycle's
  Guardians; they are iconic and nothing displaces them. From Cycle II a seal's Warden **stands
  beside its beast** in the Guardian fight, levelled to the node like any escort.
- **The Warden is EXTRA** (2026-10-06): it takes no escort's slot, so from Cycle II every
  Guardian fight is one body larger — the Titan has adapted, and the seal is held twice.
- **A seal with no Warden keeps the beast alone** — a first win with fewer than six heroes, or an
  account whose first win predates this and is gone from Run History (capped at 50).

### As built (phase 2, 2026-10-06) — `src/run/wardens.ts`

- **A Warden is its decisions, not its numbers** (`Profile.wardens`): the hero, its seal, the path
  it finished down, its kit, its Class and its gear at the win. Recorded once, by `recordWardens`
  on the first Cycle I clear; a later win never replaces it.
- **Seated by type** (`seatWardens`): every assignment of the band to the six seals is tried and
  the best total fit kept — a seal's spawn line matching the hero's primary scores 2, its
  secondary 1, roster order breaking ties. Wild's Edge spawns every type and fits nobody, so it
  takes whoever fits least elsewhere.
- **Grown again at every seal** (`buildWarden`): to the Guardian's escorts' level
  (`WARDEN_LEVEL_BONUS` = 0 over them) on its own grades, at the act's Mastery. It fields what that
  level and act have opened: its Evolution once the pips allow (an enemy's rule, Act 4), its own
  moves whose band the level has reached, its Class from Act 2 (`WARDEN_CLASS_FROM_ACT`, the first
  Guardian's reward), and as many pieces of its gear as the act's enemies carry.
- **Last on the bench** (`appendWarden`): it enters after the escorts and the beast — the last to
  fall. **Never a contract** (`isWarden`): it is the band's, and may be a hero already held.
- **A win from before the Wardens is read off its history line** (`withBackfilledWardens`, on
  profile read): the oldest Cycle I win, each hero with its path and its own two moves, no Class
  and no gear — all a record kept.
- **Drawn held** (per user direction): a red glow round the figure and a red rim under it, breathing (`.is-held`, `isWardenCombatant`), and it takes the field on a beat of its own — its name over *The Titan holds them.* (`WARDEN_ARRIVAL_LINE`).
- The sim plays a Cycle I run to a win and seats that band (`--cycle 2`, `--wardens off` to compare).

Nothing like this exists in another roguelike that we know of. That is the point of protecting it.

## 3. The five Cycles — first pass

Each Cycle carries one change to **the world** (the journey: Locations, economy, who can be
recruited) and one to **the Titan** (the puzzle: a rule). The world line does not always hurt — the
survivors prepare between Cycles — so a Cycle is never a pure stack of penalties.

| Cycle | The world | The Titan | Lever |
|---|---|---|---|
| **I. The Sealing** | Today's game. | Today's game. | — |
| **II. The Remembered** | The Wardens hold the seals (§2). Survivors raised the **Holy Sanctum**. | **It learned to eat what it kills** — Permadeath, and the woken Guardians. | `ascension.ts` A1, built |
| **III. The Long Winter** | Towns are poorer: Banners at half, the Smithy dearer. Wild's Edge is overrun and Act 1 is somewhere else. | **It sends its hands ahead** — every Guardian warded while its escorts stand. | `ascension.md` A2 + A4 |
| **IV. The Gathering** | The Guild is bigger (more heroes in the pool); companions arrive already Ancient. | **It knows your shape** — authored warbands, two-phase Guardians. | A3 + A5 |
| **V. The Last Cycle** | No seal holds. | **The Titan takes the field.** A new final fight, then the epilogue. | New content |

The rows are a sketch. What is decided is the shape: one world line, one Titan line, five Cycles.

**The new piece in Cycle V — candidate:** the companions awakened to Ancient across the Cycles
(`ascension.md` §7a). Ancient is the seal's type; the last band fights the Titan with the seal
itself. Also a candidate: the Wardens stand with the player at the end.

## 4. Running the Cycles

- **A Cycle opens by clearing the one before.** Losing a run returns to the title; a loss is never
  canon and the world does not move.
- **Every unlocked Cycle stays selectable**, before the story ends and after. A player who has
  reached Cycle II's Permadeath can still take a breezy Cycle I run.
- **After Cycle V is cleared**, the story is over and every Cycle stays playable — for the stars
  (§5) and for its own sake.

## 5. Stars

- **A star is coloured by the highest Cycle it was earned on**: I white, II bronze, III silver,
  IV gold, V rainbow — max-only, never regressed, cosmetic. Five colours for five Cycles closes the
  "five colours for six states" gap (`constellation.md` §6). Storage: `heroId → { pathId → cycle }`.
- **The complete profile** is every star rainbow, earned on Cycle V: hundreds of hours, for the
  player who wants it.
- **No entry fee.** Ascension's 1-star fee at the seal is deleted — punishing and fiddly. A clear
  still pays stars by Cycle (figures open). Stars are not meant to be scarce; the late-game sink is
  **cosmetics and hero skins**, later.
- **Achievements** become a separate source of stars (their own doc, not this one).
- **Far later, if needed:** weight the draft toward heroes not yet starred at the player's Cycle.

## 6. Locations

The bought Locations (Holy Sanctum, Dreaming Spires, Thunder Aerie, Frozen Reach) become things a
Cycle **grants** (§3's world line), and the Constellation stops selling them. It keeps heroes,
bundles and the Starfall.

**As built (phase 4, 2026-10-06, per user direction):** `LocationDefinition.fromCycle` replaces
`unlock` — the Holy Sanctum from Cycle II, Dreaming Spires III, Thunder Aerie IV, Frozen Reach III (moved from V the same day: it is the Long Winter's Act 1) —
and a granted place is in the pool of **that Cycle and every later one** (`locationPool(cycle)`),
never a Cycle I run. Thunder Aerie waits on Cycle IV being built. The shelf's Locations
section and `LocationPeekOverlay` are deleted; a purchase recorded against an old Location offer
costs nothing against the balance.

## 7. Lore and copy to rewrite

- **Done (phase 1):** the lore card (*Sealed, it sleeps for one year. / The year is up.*), the
  Titan Bound line (*It wakes again in a year.*), and `lore.md` §7's *thousand years*.
- `TitanBoundScreen` in Cycle V needs its own line, when Cycle V is built.
- `lore.md` §1 (the premise) and §5 (why the seals hold, and what happens when they stop); §7's
  *the word outlived everyone who knew what it referred to*, which a one-year cycle does not
  support — the name needs another origin.
- The champion's hall: a Cycle I–IV clear is a sealing, not an ending.

## 7a. Order of work

| Phase | What | Status |
|---|---|---|
| 1 | Ascension → Cycles: `src/run/cycles.ts`, `RunState.cycle` (1-based) and `Profile.cyclesCleared`, saves and profiles migrated one up; no entry fee; the title's **Which Cycle?** picker once Cycle I is cleared (I–V listed, the unbuilt greyed by name); the map's Cycle badge; one-year lore; the sim's `--cycle N` | **Done** 2026-10-06 |
| 2 | The Wardens: snapshot the first Cycle I win (`Profile.wardens`), seat each by type on a base seal, field it as an EXTRA body beside its beast from Cycle II; back-fill from Run History; measured (below) | **Built** 2026-10-06 — the arrival line and a Wardens page wait on copy |
| 3 | Star colours by Cycle: `Profile.starCycles` (star id → highest Cycle, absent = I) beside the star lists, raised on a win, never walked back; white / bronze / silver / gold / rainbow on every star; the run summary lists a raised star with the new ones | **Built** 2026-10-06 |
| 4 | Bought Locations granted by a Cycle (§6); the Constellation stops selling them | **Built** 2026-10-06 |
| 5a | **Cycle III, the Long Winter** — the Guardians warded while their company stands (`TITANS_WARD_ID`, the Herald's rule), the Banners frayed (three half-strength Banners, `guardianBannersFor`, the originals' art), the Smithy ×1.5 (`smithyPrice`), Wild's Edge lost (`lostFromCycle`) and **Act 1 always the Frozen Reach** (`actOneFromCycle`, per user direction — the winter opens in the snow; the Reach moved V → III); Dreaming Spires in the pool; clear +30★ | **Built** 2026-10-06 |
| 5b | Cycle IV | — |
| — | Cycle V | When I–IV are built |

**Cycle III measured** (1000 runs a cell, greedy pilot, a played band seated): full-clear **15.3% (Cycle II) → 3.4%**. One rule off at a time: the ward 7.0%, whole Banners 6.5%, Wild's Edge kept 3.2%, the Smithy at Cycle I prices 3.5% — the ward and the fray are the whole of it, each about halving the clear; the Smithy and the lost Edge are flavour at this sample. Chart pilot 0.7% → 0.0%. With Act 1 fixed at the Frozen Reach: 3.6% (noise against the drawn opening). With Act 1 fixed at the Frozen Reach: 3.6% (noise against the drawn opening). The clear bonus (30) is sized so Cycle III pays more a run than Cycle II at those rates.

**Phase 2 measured** (1000 runs a cell, Cycle II, a Cycle I win's band seated): full-clear 23.5 → 16.2% greedy pilot, 2.1 → 0.7% chart pilot; the share of run-ending deaths at a Guardian 50 → 64% / 43 → 55%. Directional — the level dial is `WARDEN_LEVEL_BONUS`, its entry is last on the bench.

The picker copy is held to one line a Cycle (per user direction). Cycle II reads *The Titan’s darkness
spreads. Fallen heroes are gone for good.* (the user’s line). **Each Cycle past the first may carry a
lore card** (`CycleDefinition.lore`), four lines a tap, shown once an account ahead of that Cycle’s
first draft (`cycleLoreTipId`) — Cycle II’s: *A year has passed, and the Titan wakes. / The heroes
who sealed it stayed to guard the seals. / Now the Titan holds them. / We must seal the pact again.*

## 8. Decided (2026-10-06, per user direction)

- Five Cycles replace the Ascension ladder; each is a chapter, and Cycle V ends the Titan for good.
- A sealed Titan sleeps **one year**.
- **The first-ever Cycle I victory's heroes are the account's Wardens forever** — additive: each
  stands beside its seal's beast from Cycle II as an EXTRA body, no escort displaced; the beasts
  are never displaced.
- A seal with no Warden keeps its beast alone.
- A loss returns to the title. **Every unlocked Cycle stays selectable**, before the end and after.
- Stars are coloured by the Cycle they were earned on. **No star entry fee**; clears pay stars;
  cosmetics and skins are the eventual sink.
- Achievements grant stars, separately.

## 9. Open — DO NOT silently resolve

- **Whether the Warden leads** its beast's fight or comes in from reserve.
- **Everything in Cycle V** — the Wardens' fate, the fight, the epilogue — is decided when the
  Cycles before it are built. The one candidate on record: the Titan fought in body parts, **the
  Feet, then the Hands, then the Eyes**, for scale on a small screen.
- **A Warden from a hero the player later stops owning or decking** — it should not matter, since
  the snapshot is a record; confirm.
- **Clear payouts by Cycle** — Ascension's A1 paid 6.
- **Cycle V's fight and epilogue** — its own document.
- **Rows III–IV** (§3) are a first pass; each is a measurement before it is a decision.

## 10. Invariants this reverses

| Where | The rule | What changes |
|---|---|---|
| `ascension.md` §5 | A1–A5, a numbered ladder | Five Cycles; A1–A5's rules are re-seated as Cycle rows (§3). |
| `lore.md` §1, §7 | A Titan cannot be killed; a thousand years | One year; killable in Cycle V. |
| `lore.md` §5 | Two seals always hold | They hold in I–IV; none in V. |
| `locations.md` §4 "Bought Locations" | Sold by the Constellation | Granted by a Cycle. |
| `ascension.md` §8 | Star colours by rung, A2–A3 sharing silver | One colour a Cycle. |
| `ascension.md` §8, `collection.md` | A1 costs 1 star at the seal | No entry fee. |
