# the-sky.md — The Sky: lighting the multiverse

> **STATUS: DIRECTION DECIDED; PHASES 1–4 DONE (2026-10-24): Stardust is the currency, Blip is the little face, and the title is the sky.** §1–§5 hold what is
> decided; anything marked PROPOSED or OPEN is not. §10 is the build plan. If built, it replaces
> Stories as the front door (§9).
>
> Decided 2026-10-23, per user direction:
> - The front door is a **sky of constellations**. A constellation is lit by playing its
>   **scenarios**, and lighting one opens the next.
> - The first few constellations are **railroaded tutorials**. After them the player can play
>   **Journey** or longer, twisted scenarios, and lighting pays out new content.
> - The protagonist is **a happy, twinkly light** that watches the multiverse's tellings and looks
>   for new ones. It **thinks**, and the player reads its thoughts: meta and fun, never serious.
> - **The light lives outside runs.** It appears in the sky, while the player browses scenarios,
>   and at the very beginning. Inside a run you're just playing Titanpact. Its thoughts appear
>   passively and are never tapped through.
> - The currency is **Stardust**, in larger increments (100 a draw), never sold.

---

## 0. Why

Stories was the second attempt to teach the game through a told story, and the framing didn't take.
The production was stronger the second time, but **characters talking to each other** needs a cast
drama to carry it, and Titanpact's heroes are pieces in a collection rather than a cast. The
**gameplay tutorials** were liked, so they stay. What goes is the framing around them.

The sky moves the carrying to **one voice**, held outside the game itself. The teaching lives in a
scenario's constraints, and progress shows up as a lit sky rather than a story beat.

References:

- **Into the Breach**: timelines, losing one costs nothing, almost no dialogue.
- **Dicey Dungeons**: each episode is a run with one rule bent, framed by a host.
- **Balatro's challenge decks and Isaac's challenges**: an unlock list made of twisted runs.
- **Balatro's Jimbo and Thomas Was Alone**: a small, funny inner voice.
- **Pokémon's monotype runs and Battle Frontier**: the community's own rule twists, and facilities
  as modes.

## 1. The light

Something in the stars watches every telling of the Titan's rising: every world where a band sets
out, in every way it could. **It is a happy, twinkly light named Blip** (2026-10-24, per user
direction). It loves
watching these stories unfold and goes looking for new ones that might be interesting. Sometimes it
darts around the screen making cute sounds. **A star is a telling that held**, and the light lights
the sky by finding them. The player is the light: its picks are the player's picks.

- **The scale lives in the premise, not the content.** No run visits another universe. The player
  sees stars.
- **It thinks, and the thoughts are read** (decided): short, meta and fun. It's new to these worlds
  too, so what it notices is often what the player is about to learn. It watches the heroes like a
  favourite show: it has favourites and roots for underdogs. It is curious about the player's
  picks and never judges them.
- **Where it lives** (decided): the sky, the scenario cards, the very beginning. **Not inside a
  run.** A run is just Titanpact; the light comes back when the run ends.
- **Thoughts are passive** (decided). A thought appears beside the light as the player browses and
  fades on its own. It never blocks input and never needs a tap.
- **No hero explains a rule.** The tips rule stands for tips. The light is the named exception: it
  may think in "I", and a thought is not a tip.
- **The Titan is the one thing it doesn't enjoy** (PROPOSED). The magenta eye shouldn't be able to
  see it, and over the Cycles it starts to. By Cycle V the Titan is looking right at it. That's an
  arc told in a handful of thoughts, and it keeps the Titan serious while the light stays playful.
- **Its look: the little face** (decided 2026-10-24, per user direction; variant D of
  `art/concepts/blip/`). It's a soft glowing body with two eyes that look where it's going and
  blink. On a win the eyes go ^^ with a blush; on a loss they droop. It's drawn as a glow, not a
  sprite, so it costs no PixelLab generations.
- **Its voice** (decided with the look): a babble, one bandpass-filtered sawtooth syllable on every
  other letter as a thought types out. It's procedural Web Audio, beside the existing voice-blip
  system (`StoryActor.voice`, `src/audio/`).
- **It can be poked** (PROPOSED 2026-10-24, user idea). Tapping Blip squishes it like poking the
  Pillsbury Doughboy: a squash and spring-back, a giggle, the face reacting. It's a toy, not a
  control. It never opens anything, and poking it isn't a decision. *Second-order:* a tap on Blip
  must not also count as a tap on the sky under it. Does a run of pokes escalate (dizzy, then
  annoyed), and is there a thought for being poked a lot?
- **Blip skins** (PROPOSED 2026-10-24, user idea): new content that changes its look, and can
  bring its own thoughts or its own poke animation. A skin is the obvious second Stardust sink
  (§5), and lighting a constellation can pay one. Skins are cosmetic only: a skin never changes
  what a scenario pays or what Blip notices.

The register, as samples rather than drafts:

- *"That one's guarded this door so long it forgot why."*
- *"Slowest bear I've ever seen. I love him."*
- *"Oh no. …Okay. Again. That one had a really good bear."*
- *"That's a crab. I made a crab."*
- *"…It's looking at me. It isn't supposed to be able to do that."*

## 2. The sky

- **A scenario is one star.** Playing and winning it lights the star.
- **A constellation is a set of stars.** When every star in a set is lit, its shape draws in and it
  pays (§5).
- **Lighting opens neighbours.** The sky is a graph: a lit constellation reveals the ones touching
  it. The rails come first (§3), and the sky branches after them (§4).
- **The title IS the sky** (PROPOSED). There's no door into a mode. A tapped constellation is a mode,
  and its stars are the ways to play it.
- **An unlit neighbour shows its shape and its reward, not its scenarios** (PROPOSED). The player
  can see what they're reaching for, as with Balatro's locked list.
- **A lost scenario costs nothing.** The star stays dark and can be retried, like Into the Breach's
  lost timeline.

## 3. The rails: tutorial constellations

These are the first few constellations, one after another with no choice. The machinery is salvaged
whole from Stories:

- deterministic fights (`stories.md` §5, `src/run/story.ts`): an encounter script, a fixed seed,
  guided commands;
- control tips shown at the moment a control is first needed (`stories.md` §1c, `StoryCue.tips`);
- the descent from the stars (`stories.md` §1b `fromSky`), which is now literally the frame.

The cast's dialogue is cut. A scenario card is a **name**, a **fixed team**, the **goal that forces
the lesson**, and whatever the light thinks about it:

- *Win before the Shield breaks.*
- *Bring the benched hero back with full Mana.*
- *KO the Frost hero first.*

The player learns a rule by being boxed in by it, as in Hearthstone puzzles or Pokémon Showdown
puzzles.

**Proposed rails, three constellations.** Journey opens as soon as the rails end, so they stay
short:

| Constellation | Teaches | Shape of its stars |
|---|---|---|
| **First Light** | reading a move, matchups, doubles targeting, turn order | one-fight puzzles |
| **The Bench** | switching, bench Mana, Rest, Shield, Conduct, lock-in | one-fight puzzles |
| **The Road** | the map, reward rows, a Guardian, levels, gear, the Guild Hall | one short act with a fixed team |

The Road's last star opens **Journey**. That is the Many Roads beat (`stories.md` §14c), now a
constellation drawing in instead of a screen.

## 4. After the rails

The sky branches. Some constellations hold modes that already exist; others hold new scenarios.

**Existing modes become constellations:**

| Constellation | What it holds |
|---|---|
| **Journey** | the plain run, a new telling |
| **The Cycles** | a line of five stars, I to V, each lit by a clear at that Cycle |
| **The Trials** | worlds already watched (Constructed) |
| **The Gauntlet** | heroes from different worlds, set against each other |
| **Each hero** (PROPOSED) | a small constellation of its three path stars, which exist today |

**New scenario kinds** (PROPOSED; every one is a Journey with one thing bent):

- **Monotype**: recruit, hire and claim only heroes of one type. One star per type, and lighting
  all fourteen draws the type wheel.
- **A new place**: a Journey with a Location added to the pool. Lighting it adds that Location to
  every Journey.
- **Strangers**: the draft and the Guild Hall draw off the whole catalog, not the deck.
- **One Guardian, twice as hard**: a short scenario, one act against a woken champion.
- **A fixed band**: a set team for the whole run, with no recruiting.
- **Puzzles past the rails**: one-fight scenarios on advanced verbs (fields, Charges, Blessings,
  the companion's Call).

These are seeds, not a list. The point is that the sky makes room for them.

## 5. What lighting pays

The constellation rule stands (`constellation.md` §1): **you light content, never power.**

A constellation can pay:

- **Stardust**;
- a **Location** into the Journey pool;
- a **hero** or a **bundle** into the Collection;
- a **cosmetic** (`docs/cosmetics.md`'s gradient maps);
- a **mode** (the Trials and the Gauntlet are lit, no longer opened by a first clear);
- **new constellations**.

Every reward is shown on the unlit shape (§2).

**Stardust** (decided 2026-10-23, per user direction) replaces the star currency, so "star" only
ever means a lit node.

- **100 is one draw** (the Starfall), and 1,000 is ten.
- **The ten-draw is spectacle and convenience** (2026-10-24, per user direction): exactly ten
  singles' price, no discount and no guarantee. It lets a player with a pile of Stardust spend it
  in one go instead of watching a single draw over and over.
- It is paid by constellation rewards and by winning a Journey.
- **This is not a microtransaction game.** Stardust is never sold.

Open questions about Stardust:

- **The finer grain is the real gain** (PROPOSED): a lost Journey can pay a little for how far it
  got, which whole stars never could.
- **The sink runs dry.** The Starfall never draws a duplicate, so Stardust stops buying heroes once
  the Collection is complete. Cosmetics are the obvious second sink, and Blip skins (§1) are the
  first candidate.
- **The conversion** (BUILT 2026-10-24): a draw was 2 stars, so 1 star = **50 Stardust**
  (`STARDUST_PER_STAR`) keeps every price where it was. A lit star pays 50, a Trial clear 250, a
  Gauntlet clear 250, and a Gauntlet entry costs 150. The Cycle clears pay 50 / 300 / 1,500 / 2,000,
  and From the Tall Grass costs 400. A bundle's discounted share rounds up to a whole 50, so a
  converted balance buys exactly what it did. The balance is still derived
  (`stardustEarned − stardustSpent`). A file from before (profile version 2) is converted as it is
  read: its stored star counts are ×50, and the file is never converted twice.

## 6. A scenario is data

Content is data, so a scenario is a `ScenarioDefinition`: a name, a goal, the run modifiers it sets,
and the light's thoughts about it. The run layer extends a modifier vocabulary rather than each
scenario carrying code. Most modifiers already exist:

| Modifier | Exists as |
|---|---|
| Fixed team | Stories' fixed cast (`StoryHeroSpec`, `storyEntry`) |
| Encounter script, fixed seed | `scriptedEnemyActions`, `guidedAction` |
| Deck or recruit filter (type, strangers) | `deck.ts`, `heroPool` |
| Location pool | `locationPool`, Cycles' grants |
| Cycle | `RunState.cycle` |
| One short act | `storyActRun` |
| Goal (win before X, KO Y first) | **new**: a check read off the event stream in the run layer, never in the engine |

## 7. Tensions

- **"The Constellation" is already the shop's name.** The sky either absorbs the shop or the shop
  takes another name.
- **Do heroes shrink into pieces?** If every run is "a telling," one hero may matter less. The
  Wardens push back on that: they're the one band that is the player's forever.
- **A voice the player didn't choose.** Keeping the light curious rather than opinionated limits
  that.
- **Repetition.** The light lives outside runs, so it isn't a quip every fight. But the sky is
  visited between every run. Its thoughts there lean on firsts, said once an account, with a small
  reactive pool for returns.

## 8. Open — DO NOT silently resolve

1. **The twist.** The Titan's eye is magenta everywhere, and the light could be its other eye. A
   happy light makes that a gut punch rather than a reveal. Probably dropped.
2. **How many rail stars?** It has to be few enough that Journey opens fast.
3. **Stardust's figures** (§5): what a Journey win, a loss and a constellation pay.
4. **Journey's name.** Renamed Journey on 2026-10-22; it may be renamed again to suit the sky.
5. **The Cycles' gate** (a clear opens the next) maps onto a constellation of five. Do the Cycles'
   Location grants become that constellation's payouts?
6. **The shop's name and shape** (§7).
7. **Each scenario's numbers**: act count, goals, rewards. All open.

**A Tale of Valor is cut in full** (2026-10-24, per user direction): its cast, chapters and
dialogue. The machinery it was built on (deterministic fights, control tips, the descent from the
stars) stays for §3.

## 9. What it reverses (if built)

- `stories.md` §0: Stories as the front door and the trademark mode. The machinery stays; the cast
  framing goes.
- `stories.md` §14c: the Many Roads screen. It becomes The Road's constellation drawing in.
- `docs/gauntlet.md` §7: the title's three doors (`TitleModes.tsx`). The title becomes the sky, and
  the Trials and the Gauntlet open by lighting, not by a first Cycle I clear.
- `constellation.md` and `collection.md`: stars as a currency. Stardust replaces them; the path
  stars stay as lit stars.

## 10. The build plan (PROPOSED)

Seven phases, each landing on its own with the tests and typecheck green. Phases 1 and 2 can run in
parallel (they touch different files). The rest go in order.

**Phase 1 — Stardust.** *(run layer and copy; no new screen)* **DONE 2026-10-24.** The ten-draw is
`starfallTen` (ten singles on one ledger) and `StarfallTenScreen`: ten lights fall into a grid
with no wheel. It needs ten heroes left to draw. The Stardust mark is a sparkle (`HubGlyph
'stardust'`, or ✦ in text); ★ means only a lit star. Whether a lost Journey pays is still OPEN.
- Rescale the derived ledger in `src/run/starShop.ts`: earnings and prices ×50 (§5), `STARFALL_PRICE`
  100, `GAUNTLET_ENTRY_PRICE` 150, `TRIAL_CLEAR_STARS` → a Stardust figure.
- A Journey win pays Stardust (the clear bonus, converted). Whether a loss pays is OPEN (§5).
- Rename every player-facing "star" that means currency to Stardust. The lit stars keep the word.
- Ten draws at once: one Starfall scene showing ten, at ten singles' price.
- Tests: balances convert exactly for an existing profile; no save migration.

**Phase 2 — The light, as a comparison page.** *(art direction before code)*
- Three or four looks and motion personalities side by side, each with its chirps, for the designer
  to pick (glow and particles in CSS, procedural Web Audio). `art/concepts/blip/`. **DONE: D, the
  little face, picked 2026-10-24.**

**Phase 3 — The sky's data and logic.** *(pure run layer)*
- `src/data/sky.ts`: `ConstellationDefinition` (id, shape, stars, neighbours, reward) and
  `ScenarioDefinition` (§6).
- `src/run/sky.ts`: lit, revealed and payable, DERIVED from the profile where a record already
  exists (`cyclesCleared`, Trials beaten, path stars, Gauntlet open), stored (`Profile.litStars`)
  only for scenarios that are new.
- The existing modes as constellations (§4), so the sky can stand in for the title before any new
  scenario exists.
- Tests: an existing profile lights exactly what it has already done.

**DONE 2026-10-24.** `src/run/sky.ts` holds the rules and `src/data/sky.ts` the sky; `test/sky.test.ts`
pins them. As built:
- **Four states.** A constellation is *lit* (every star lit), *open* (playable: it is a root, or
  something it comes after is lit), *glimpsed* (shape and reward only, one step past an open one)
  or *hidden*. "Neighbours" became `after`: the graph points one way.
- **What lights a star.** A scenario win (stored in `Profile.litStars`), a Journey won, a Cycle
  cleared, a Trial beaten or a Gauntlet cleared. Each of the last four reads a record that already
  exists.
- **The existing modes open in the sky exactly when they open today.** The Trials and the Gauntlet
  open after a Journey win, the Cycles after the first clear. A test checks this against
  `isConstructedOpen` and `isGauntletOpen`.
- **An account that played before the sky** (finished a run or a Story chapter) has its rails lit
  but is NOT paid their reward, so the sky arriving moves no existing balance. Only a rail
  actually played pays.
- **First-pass content (FLAGGED, needs your call):**
  - **The rails are 4 / 3 / 1 stars**, as named seats: First Light (a move, the matchup,
    targeting, turn order), The Bench (the switch, Rest, lock-in) and The Road (one act). §8.2
    is still open.
  - **Each rail pays 100 Stardust**, one draw, which is the Starfall's price used as precedent.
    §8.3 is still open.
  - **No other constellation pays yet.** Journey, the Trials and the Gauntlet already pay
    through their own clears, and whether the Cycles' Location grants become constellation
    payouts is §8.5.
  - **Placements and shapes are placeholders** for phase 4 to tune.
- **Not built:** goals past a plain win (`ScenarioGoal` holds only `win`; the rest land with
  phase 6), and a constellation for each hero (still PROPOSED).
- **One thing phase 4 must handle:** a brand-new account cannot open Journey until the rails are
  playable, which is phase 6.

**Phase 4 — The sky screen.** *(view)*
- The title becomes the sky: constellations drawn, lit or shown as a shape with a reward, a tap
  opening its stars, a star opening its scenario card.
- Retire the three doors (`TitleModes.tsx`) and the Many Roads screen.
- Fold or rename the shop (§7, §8.6).

**DONE 2026-10-24 (per user direction, the first-pass rails kept).** `SkyChart.tsx` draws the sky
on the title's Play page in place of the seal, the Seal the Pact press and the three doors:
- Lit constellations draw their shape in gold, and open ones show their stars. Glimpsed ones are
  faint with their reward, and a one-star constellation (Journey, the Gauntlet, the Road) is drawn
  larger with a slow halo.
- A tap opens a sheet: the constellation's name, its stars ★/☆ by name, and one press. That press
  is read off the kind of star it holds: *Begin a Journey*, *Choose a Cycle* (the Chronicle
  picker), *Open the Trials*, *Enter the Gauntlet*.
- A parked run keeps Continue Run and Start a New Run under the sky.
- **Retired:** `TitleModes.tsx` (the doors and mode pages, with `PactButton` moved to its own
  file), `ModesOpenBeat.tsx` and the modes-open tip, `ManyRoadsScreen` and its route, the
  doors' CSS and `art/ui/modes/`. The title no longer opens Stories: Valor is cut (§8), and its
  code goes in phase 6.
- **The rails are `uncharted`** until phase 6. They open what comes after them as if lit, so a
  new account can begin a Journey today. They show as hollow stars, and their sheet says "Not
  yet charted."
- **Still OPEN, not touched:** the shop is still called **The Constellation** on the hub nav
  (§7, §8.6). Placements and shapes are first pass. A brand-new account currently has no
  tutorial at all until the rails land.

**Phase 5 — The light and its thoughts.** *(view, plus a data table)*
- The light from phase 2, living in the sky and on scenario cards.
- `src/data/thoughts.ts`: thoughts keyed by moment (a constellation revealed, a card opened, a
  Journey won or lost, a first look at a hero). `Profile.seenThoughtIds` keeps the firsts once an
  account.
- Passive: a thought appears beside the light and fades. No tap, never during a run.
- The poke (§1): a squash and spring-back on tap, with the face reacting. Skins come later, once
  a constellation or the shop has a seat to pay one.

**Phase 6 — The rails.** *(content on Stories' machinery)*
- First Light, The Bench and The Road as scenarios on `src/run/story.ts`'s fixed casts, encounter
  scripts and seeds. Their control tips stay.
- The new piece: a scenario **goal**, checked in the run layer off the event stream.
- Delete A Tale of Valor's cast, chapters and dialogue (§8). Keep the machinery.
- The first press on a new account descends from the sky into First Light.

**Phase 7 — The first twisted scenarios.**
- Monotype (fourteen stars), A New Place, and Strangers, on modifiers the run layer already has.
- Their constellations pay a Location, Stardust and the first cosmetics.
