# cycle-five.md — The Last Cycle

> **STATUS: SHAPE DECIDED, DETAILS PROPOSED** (2026-10-14). Decided, per user direction
> (`cycles.md` §8):
> - The Wardens are Cycle V's keys: a Guardian beaten frees its Warden.
> - The Titan is fought as **the Feet, then the Hands, then the Eyes**.
> - Cycle V needs a full deck.
> - Its stars are rainbow.
>
> Everything else here is a proposal, marked so. §10 lists the questions to answer before
> building. This is the "own document" that `cycles.md` §9 asked for.

---

> **2026-10-14, per user direction: the whole Titan fight is in space.** The Titan fell from the
> sky (`lore.md` "The fall"), and Cycle V fights it among the stars. This reopens the setting of
> §4 and §6, which assumed the Threshold; whether the Feet, Hands and Eyes survive as the phases in
> space, and how the band gets there, are open (§10).

## 0. What Cycle V has to do

Cycles I–IV each tighten the same story: the Titan rises, the band seals it, it sleeps a year.
Cycle V is the only one that **ends**. It has three jobs, and every proposal below serves one of
them:

1. **Pay off the Wardens.** From Cycle II the account's first band has stood beside the
   Guardians, drawn in red, under the line *The Titan holds them.* That is a promise the game has
   been making for three Cycles. Cycle V is where it is kept.
2. **Put the Titan on the field.** In Cycles I–IV the player fights only its Herald and its Eyes.
   Cycle V is the first time its body can be struck, and that is the only reason it can be killed
   (`cycles.md` §1).
3. **End the story where the player can see it ended.** The binding in Cycles I–IV
   (`titan-eyes.md` §11) is built to be undone in Cycle V. The epilogue has to change the game
   permanently, not just print a message.

## 1. What is already in place

- **The gate:** `FULL_DECK_CYCLE` = 5, the deck-ownership check `shortTypes`, and the Cycle-opening
  check `openCycle`.
- **The ceiling:** `MAX_BUILT_CYCLE` = 4 is the only thing keeping Cycle V greyed out.
- **The Cycle definition** in `src/run/cycles.ts` has a name ("The Last Cycle"), but no line, no
  lore card, and a clear bonus of 0.
- **Rules carry forward:** every Cycle rule is a `cycle >= N` check, so a Cycle V run already
  carries all of Cycles II–IV:
  - Permadeath.
  - Woken Guardians with Wardens.
  - The ward, the frayed Banners, the dearer Smithy, Act 1 in the Frozen Reach.
  - Warbands played as engines.
- **The engine pieces the Titan fight needs already exist:**
  - **Phases.** `Squad.reserves` is an ordered list of phases, and it handles any number of them
    (`test/titanEyes` proves it past two).
  - **Phase-relative clock.** `phaseStartedRound` starts the Pact Clock fresh each phase.
  - **The ward.** `wardedWhileCompanyStands` keeps a body untargetable while its company stands.
  - **Withering Gaze.**
  - **The woken companion** acts once per phase (`perPhase`), and its move lands as Ancient.
- **Ancient's chart:** Ancient resists every type, and its own attacks are neutral against
  everything. Against an all-Ancient Titan, every hero hits at half and the woken companion hits
  at full.

## 2. The fiction

**PROPOSED copy direction:**
- The fifth year. **No seal holds.** The rings the band locked four times have worn through. The
  Titan does not send its Herald and look through the breach; it **walks through it**.
- The Wardens have been inside the seals since Cycle II. In Cycle V the seals are no longer worth
  holding, so the Titan **keeps the Wardens instead**. Each beast stands guard over the Warden of
  its land as it always has, but now there is nothing behind it to lock, only someone to set free.
- The Titan can die because it is finally standing where it can be struck. Each part that falls is
  a piece of it that can't come back. When the Eyes close in Cycle V, they **do not close to
  sleep**.

**Lore lines this overturns** (rewrite when built):
- `lore.md` §7: "The Titan has no name, and never takes the field".
- `lore.md` §7: "A Titan cannot be reduced to 0 HP".
- `lore.md` §5: the seals holding.
- `lore.md` §7: the Endbringer name's origin ("outlived everyone who knew"), which `cycles.md` §7
  already flags.

## 3. The road: acts 1–4 free Wardens instead of locking rings

### 3.1 The rule

**DECIDED in principle:** in Cycle V, a beaten Guardian does not lock a ring. It **frees the
Warden** that stood beside it, and every Warden freed stands with the player at the end (§5).
The model is Slay the Spire's three keys before the Heart: the run's route decides how many you
carry into the last fight.

### 3.2 Problem: most runs can't reach most Wardens

This needs a decision. Wardens are seated on the **six base seals**, but from Cycle III onward:
- Act 1 is always the **Frozen Reach**, which has no Warden.
- **Wild's Edge is lost**, so the Warden seated there can never be reached.
- Acts 2–4 pick from a pool that includes the Cycle-granted places (Holy Sanctum, Dreaming Spires,
  Thunder Aerie), and none of those hold a Warden either.

As built, a Cycle V run frees **zero to three** Wardens, and a run that wanders through the granted
places frees none.

**PROPOSED, two changes:**
1. **The Frozen Reach holds Wild's Edge's Warden.** The Edge lies under the snow
   (`lostFromCycle: 3`). The Warden held there was carried into the Reach, and the Reach's Guardian
   holds it. Every Cycle V run then frees **one Warden in Act 1**, guaranteed, which teaches the
   rule the first time the player meets it.
2. **Acts 2–4's location choice shows which Warden each tile holds**, and a granted place shows
   none. *(2026-10-16: the 1-of-2 pick is deleted, per user direction — places are drawn at
   random — so this change has nothing to stand on until it is re-decided; `locations.md` §1.)* The pick-1-of-2 that exists today becomes the run's main strategic question: *a place
   whose Guardian holds a Warden, or a place whose spawn and backdrop suit my deck*.

A route through only base seals frees four. A route through the granted places frees fewer and
has to win without them.

**Counting the cost under repeated use** (`CLAUDE.md`, "weigh repeatable effects"): a Warden is a
free action every phase of the final fight (§5), so four Wardens are worth roughly twice what two
are. The Titan's numbers are fitted to the **expected** count, not the maximum. The sim measures
what the expected count is.

### 3.3 What changes on screen at each act's end

- **The Pact Seal screen inverts.** Today each act's end locks a ring and the Titan's lids narrow
  (`LID_BY_SEALS`). In Cycle V:
  - Each act's end **breaks** a ring open.
  - The freed Warden walks out of it, losing the red rim it has worn since Cycle II.
  - The Titan's eyes open **wider** every act.
  - The same screen and the same art, run backwards, so a returning player reads the meaning
    without being told.
- **The Guardian fight is unchanged.** The Warden still enters last from the bench, fights against
  the player, and is drawn held. The player has to beat it to free it. That is the cost of the key,
  and it is already built.
- **A Warden beaten in the Guardian fight is not lost.** Freeing is the Guardian's defeat, not the
  Warden surviving it. (Permadeath is the player's rule, not the Wardens'.)

## 4. The Titan

### 4.1 Shape

**DECIDED:** the Feet, then the Hands, then the Eyes.

**PROPOSED:** each part is a **pair**: Left and Right Foot, Left and Right Hand, Left and Right Eye.
This is a doubles game, so a pair fills the enemy's two slots and every phase is a true 2v2.
- The Eyes are already a pair.
- The Feet and Hands are pixel, in the Titan's own language, as the Eyes are (§12, 2026-10-18;
  this line once put them in the Guardians' geometric grammar).
- Six bodies, three phases.

### 4.2 Length

The tension here is the one you raised for Cycle IV. You turned down two-phase Guardians as "a
length increase, not difficulty", and three phases is exactly a length increase. This proposal
accepts that **only for the run's single true ending**, and pays for it two ways:
- **No Herald fight in Cycle V** (§6). Today's finale fields seven bodies (the Herald, four
  Titanspawn, two Eyes); Cycle V's fields six.
- **The Pact Clock counts per phase** (built), so no single phase can turn into a stall.

Target: Cycle V's finale runs about as long as today's, around 25 rounds, measured.

### 4.3 Typing

**PROPOSED.** An all-Ancient Titan means three phases of every hero hitting at half. That is the
Eyes' rule today, and it works because it lasts one phase. Over three it becomes a grind, and team
composition stops mattering.

The proposal: **the Feet and Hands are Ancient plus a secondary type; the Eyes stay mono-Ancient.**
- Dual types multiply, so a type that hits the secondary super-effectively lands at **×1** through
  Ancient's halving. The rest land at half.
- Each of the first two phases then rewards **two or three types** in your deck, and the full-deck
  requirement starts to pay off: a deck with three heroes of every type can always field an answer.
- The Eyes stay the wall where only the companion hits at full, as today.

Candidate secondaries, chosen for what the part *does*, to be checked against the chart:

| Part | Secondary | Why |
|---|---|---|
| The Feet | **Stone** | The ground the Titan walks on; the body that refuses to move |
| The Hands | **Iron** | It grips, binds and shackles: the seals' own metal, turned around |
| The Eyes | — | As built |

### 4.4 Each phase's verb

**PROPOSED.** One rule per phase, so each phase asks a different doubles question. These are
anchored in raid and part-break bosses (Monster Hunter's part breaks, a Shadow of the Colossus
climb seen from below), adapted to a 2v2 board.

**The Feet: *focus or split*.**
- **Trample** (an innate on each Foot): at round end, a Foot that took no hit from the player this
  round stomps both of the player's active heroes.
- Focus-firing one Foot means eating the other's stomps. Splitting means neither falls fast.
- High HP, high Defense, slow, physical. This is the endurance check.
- Trample is direct damage on the Pact Clock's terms (no Shield). So the counterplay is hitting
  both Feet, not walling.

**The Hands: *rescue or press*.**
- **Grasp** (a move): a Hand seizes one of the player's active heroes. The held hero can't act or
  switch until the Hand that holds it takes a hit.
- The other Hand **Crushes** whoever is held.
- Every round the player chooses between freeing an ally and damaging the Hand that isn't holding
  anyone.
- Grasp is a guaranteed lockout, so by invariant it is **limited by Charges**: proposed at 3 per
  Hand.
- Fast, mixed attackers. This is the decision check.

**The Eyes: *as built*.**
- Withering Gaze, Beheld and the Regard (`titan-eyes.md`).
- Proposed for Cycle V only: **the Gaze lands at 5%**, the figure from before the four-act re-fit,
  because nothing is warded here and the Wardens are acting.
- This is the damage race the player already knows. Meeting the familiar boss at the end of the
  Titan's body is the point.

### 4.5 Numbers

Not proposed here. The first pass uses the precedent you set for every boss:
- Levelled at the finale's par plus the champion bonus.
- Mastery at the cap.
- Act 4's enemy gear.
- HP sized the way the Eyes' was: ×1.5 the escort line, then fitted by the sim.

Per `CLAUDE.md`, the sim finds mechanical faults, stranded states and copy mismatches. The win
rate is directional, and the balance call is made by playing.

## 5. The Wardens in the last fight

**PROPOSED: each freed Warden acts on its own, once a phase, telegraphed.** This is the companion's
model (`companion-call.md` §12), already built and already playtested.
- It is never fielded, never targeted, and costs no turn.
- **Its move is its signature** if it held one at the win, otherwise the strongest move in its
  recorded kit. It resolves at its own type, **not** Ancient. Ancient stays the companion's, so the
  woken companion keeps the one thing the Titan can't shrug off.
- **Window:** a Warden acts in a window rolled per phase, as the companion does.
  - Proposed: Wardens take **rounds 2–4** of each phase, so they don't land on top of an early
    companion.
  - Each is telegraphed with a ! on its figure and a seat on the turn-order track, as the companion
    is.
- **Drawn behind the player's pair** beside the companion: the band that sealed the Titan in
  Cycle I, standing with the band that kills it.

**Engine cost.** `CombatState.calls` holds **one** off-field caster per side. Wardens need it to
become a list per side. The extension is mechanical:
- `callIntent` returns every caster due this round.
- The order track seats each one.
- `rearmCallsForPhase` re-arms them all at a phase change.

The view's single-caster assumptions need the same sweep.

**Alternatives considered:**
- **Field the Wardens as extra bodies on the player's bench.** This breaks the roster cap and the
  "every fight fields the whole roster" lead pick. It also makes a long fight longer. Rejected.
- **A Warden removes one Titan part's ward.** This is a pure key, as in Slay the Spire, and costs
  no engine work. But a Warden that only removes an obstacle never gets to act, and the payoff
  being set up since Cycle II is *seeing them fight*. Kept as a fallback if the list-of-casters
  work is too expensive.

## 6. The arrival: the Herald's last beat

**PROPOSED.**
- Act 5's map stays the Vigil, then the fight.
- The Herald's march (`HeraldScreen`, §11 of `titan-eyes.md`) plays as in Cycles I–IV: the Herald
  walks in and sounds its horn.
- **Nothing rises behind it.** Instead the frame goes dark from above and **a Foot comes down on
  the Herald**. The Titan has no further use for a voice.
- Caption, proposed: eyebrow *No seal holds*, title *The Titan walks*.
- The fight opens straight on the Feet.

This keeps the Herald march the player has seen four times, and breaks it at the exact beat they
expect the company to rise. That costs nothing in combat and is the cheapest big moment in the
Cycle.

**Between phases:** the Titan Rise cinematic is re-cut. At the Feet → Hands boundary the camera
rises up the body; at the Hands → Eyes boundary it reaches the head, which is the existing
`TitanRiseScreen` ending. Each boundary is a short beat that can be tapped through.

## 7. The ending

**PROPOSED, in order:**
1. **The Eyes close and do not reopen.** This is today's `TitanBoundScreen` collapse, except the
   head does not go down into the seal. It falls *forward* and comes to rest. The ember goes out.
2. **The seal breaks for good.** The rings that turned in to lock four times now fall apart. Every
   Warden, freed or not, walks out of what is left: all six, in the colours of their lands.
3. **The names:** the roster's names are written round the rim as in Cycles I–IV, **and the
   Wardens' names with them**. One inscription for both bands.
4. **The hall** ("Heroes of the Land") gets its Cycle V form. The kicker reads *The Titan is dead*.
   The Wardens stand in the back row of the hall, without stars.
5. **The title changes for good.** After the first Cycle V clear on an account:
   - The title screen's Titan lies dead under the ridge, its eyes dark.
   - The seal is gone from behind the wordmark.
   - The cold open's eye never opens again.
   This is the epilogue the player keeps.
6. **The Chronicle** (`CycleTapestry`) weaves its last panel. Cycles I–IV stay playable after the
   story ends (`cycles.md` §4). The proposed framing: the Chronicle reads as **the story being
   told**, so a Cycle I run after the ending is a retelling, and its title and lore read that way.

## 8. Rewards

- **Rainbow stars** (built).
- **Clear bonus: proposed 60.** This is a placeholder; the precedents are 1 / 6 / 30 / 40. Stars
  are not meant to be scarce, and the long-run sink is cosmetics (`cycles.md` §5).
- **The ending is the reward.** No further unlock is proposed. A Cycle V clear changes the title
  screen and the Chronicle and colours the stars. Nothing in play gets stronger afterward.

## 9. Order of work

| Phase | What |
|---|---|
| 1 | **The road.** `MAX_BUILT_CYCLE` = 5, the Cycle V line and lore card. The Frozen Reach holds the Edge's Warden. A beaten Guardian frees its Warden (`RunState.freedWardens`). The Pact Seal screen inverts. Location tiles show their Warden. |
| 2 | **The Titan.** Six bodies in three phases. Feet and Hands art in the Guardian grammar, kits, Trample and Grasp (with Charges), secondaries. The Eyes' Cycle V Gaze. |
| 3 | **The Wardens act.** `CombatState.calls` becomes a list per side. Telegraph, order track and AI read for each caster. |
| 4 | **The beats.** The Herald trodden. The phase-boundary climb. The death, the seal breaking, the Wardens walking out, the Cycle V hall. |
| 5 | **The epilogue that stays.** The title's dead Titan and the Chronicle's last panel, both gated on the first Cycle V clear. |
| 6 | **Measure.** The sim's `--cycle 5`: mechanical faults first, then directional rates by Wardens freed (0–4). |
| 7 | **Copy.** The `lore.md` rewrites (§2), every Cycle V line, the hall. |

Phase 1 is playable on its own: a Cycle V run that frees Wardens into today's finale. That run is
the first playtest of whether the Wardens-as-keys rule changes the route choice.

## 10. Open — answer before building

1. **The re-seat (§3.2):** does the Frozen Reach hold Wild's Edge's Warden, so every Cycle V run
   frees one in Act 1?
2. **Typing (§4.3):** Ancient plus a secondary on the Feet and Hands, or mono-Ancient throughout?
   And if secondaries, Stone and Iron, or something else?
3. **The verbs (§4.4):** Trample (focus or split) and Grasp (rescue or press). Keep, replace, or
   swap which phase gets which?
4. **How a Warden acts (§5):** once per phase on its signature, at its own type, the engine
   extended to a list of casters? Or once per *fight*? Or the ward-key fallback?
5. **The Herald (§6):** crushed by a Foot in the intro, so Cycle V has no Herald fight?
6. **A Warden beaten in its Guardian fight (§3.3):** freed anyway, as proposed? Or must it survive
   the fight, which would turn every Cycle V Guardian into an escort mission?
7. **The title after the ending (§7.5):** permanent for the account? And do Cycles I–IV read as a
   retelling afterwards?
8. **Clear bonus (§8):** 60, or another figure?
9. **The Wardens page** (`cycles.md` §7a phase 2, still waiting on copy): Cycle V is where it would
   matter most. Build it alongside phase 1?

## 11. Invariants this would reverse

| Where | The rule | What changes |
|---|---|---|
| `lore.md` §7 | The Titan "never takes the field" | It takes the field in Cycle V |
| `lore.md` §7 | "A Titan cannot be reduced to 0 HP" | In Cycle V it can, part by part |
| `lore.md` §5 / `cycles.md` §10 | The seals hold | None hold in Cycle V; a beaten Guardian frees, not locks |
| `CombatState.calls` | One off-field caster a side | A list a side (§5) |
| `companion-call.md` §12.4 | The woken companion is the one thing that strikes the Titan at full | Still true of the Eyes; on the Feet and Hands the secondary opens other windows (§4.3) |
| `cycles.md` §2 | A Warden is always an enemy | In Cycle V a freed one fights beside the player |

## 12. Art direction (2026-10-18, per user direction)

Picked from mock-ups (`art/concepts/titan-look/cycle-five.html`), nothing built: the arena is
**"on its body"**, the band standing on the Titan's hide among the stars, magenta cracks, its
curve the horizon; **the Feet are "monument"** (blunt, fused stone, cracks running up from the
sole); **the Hands are "cracked palm"** (near-black, magenta cracks across the palm). All three
are pixel in the Titan's own language, not the Guardians' geometric grammar, so §4.1's line that
the Feet and Hands are drawn in `guardianFigures.ts` is superseded. The Eyes are the finale's
(`titan-eyes.md` §13). The concepts are `raw/c5-hide-8.png`, `raw/c5-foot2-11.png` and
`raw/c5-hand-29.png` there; each still needs its pair, frames and a broken frame.
