# the-sky.md — The Sky: lighting the multiverse

> **First Light's lessons are being redrafted: `docs/first-light.md`** (2026-10-27, DRAFT, per user
> direction): ten one-concept lessons, a silent Blip, Valor and Fang deleted. Until it is built, §2c's
> curriculum and §6's lessons below are what the game does.

> **STATUS: DIRECTION DECIDED; PHASES 1–5 DONE (2026-10-24): Stardust is the currency, the title is a scroll of stacked bands (five constellations), and Blip lives in it, thinking and pokeable.** §1–§5 hold what is
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
>   passively and are never tapped through. **Blip stays out of fights** (2026-10-26, per user
>   direction, reversing the 2026-10-25 exception that had it narrate the guided lessons): in
>   combat the heroes speak. A hero on the field calls each guided round's plan in a speech bubble
>   over its side (`StoryCue.lines`, `HeroCallout`), reading the foes the way a fighter would.
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
- **It can be poked** (BUILT 2026-10-24, user idea; phase 5). Tapping Blip squishes it like poking the
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
- **The title IS the sky** (built as the Pact, §2b). There's no door into a mode. A tapped constellation is a mode,
  and its stars are the ways to play it.
- **An unlit neighbour shows its shape and its reward, not its scenarios** (PROPOSED). The player
  can see what they're reaching for, as with Balatro's locked list.
- **A lost scenario costs nothing.** The star stays dark and can be retried, like Into the Breach's
  lost timeline.

## 2b. The Pact (2026-10-25, per user direction)

The title is ONE screen, replacing the stacked bands of 2026-10-24, which the player had to cycle
through. Picked from a side-by-side page (`art/concepts/pact-circle/`, "B · The Path In"):

- **The Infinite sits in the middle, inside a ring: the Pact.** The ring has a seat on three of its
  points (Strange Worlds north, the Gauntlet east, the Trials west). A seat nothing has reached yet
  is an empty dotted socket.
- **First Light is not a seat.** It is a trail of four stars climbing from the foot of the screen
  into a gap in the ring. The next lesson is awake and named. The ones after it are dim stars in
  dotted sockets, nameless until they wake.
- **A lesson won is played back on the title**, once an account (`skyLightingTipId`,
  `unshownLightings`). The star charges and bursts gold, the line draws to the next star, and the
  next star wakes with its name written in. A seat that opens on that star (the Infinite, after The
  Clearing) pops in where it sits.
- **The last lesson draws First Light in.** The trail flares gold, a crest shows its name and its
  Stardust, and the Stardust flies as motes into the Observatory's badge, which counts it in. The
  trail then folds into a small **clasp** at the ring's foot, the gap closes, and the Pact settles
  to the middle of the screen. After that it reads as a plain ring, and the clasp still zooms in
  to replay a lesson.
- **A tapped seat zooms in** to its constellation: its stars named, its own press. A tap on the
  sky backs out. There is one press under the Pact: the next lesson until First Light is sealed,
  then *Enter the Infinite*.
- The Stardust is the 300 First Light already paid (§10, still FLAGGED). Nothing about the payout
  changed; it is only shown now.
- **Revised by §2c (2026-10-26):** a lesson is never named. A woken star shows a blank page, not
  its name, and the press reads *Begin* then *Next Lesson*.

## 2d. The sky, and the Infinite tapped (2026-10-26, per user direction)

Picked from a side-by-side page (`art/concepts/celestial-title/`, "C · Galaxy" and "A · The Black Hole").

- **No ground under the title.** The fog-bank painting, the treeline ridge and the rising motes are
  gone. A slow spiral galaxy turns behind the Pact (`GalaxySky.tsx`), its bright core sitting
  behind the Infinite: Blip is a celestial being, and the title is its sky.
- **Tapping the Infinite** zooms into that core and lands on a black hole (`InfiniteView.tsx`): a
  dark centre, a burning disk turning round it, its far side bent over the top. No words but the
  Cycle's own. The Cycles sit above it: the numeral, its name, arrows to step through, five pips
  with the cleared ones gold. The disk burns in the chosen Cycle's colour (near its star colour,
  §5 of `cycles.md`; V turns through them all), and a locked Cycle is cold and grey.
- **Enter starts the chosen Cycle**, replacing the *Which Cycle?* tapestry (`cycles.md` §4). The
  title's *Enter the Infinite* press opens the Infinite once a Cycle past I is open, and starts
  Cycle I directly before that.
- The Chronicle tapestry moved to Records' Chronicle tab, where a new clear's weave plays once (`cycles.md` §4).
- **First Light is the Ascent** (same day, per user direction, from `art/concepts/first-light/`): four
  floating islands of light climbing side to side to the ring's gap, each carrying the heroes its
  lesson is played with (`LESSON_CAST` in `SkyChart.tsx`). Won islands burn gold, the next glows and
  breathes, and the ones ahead hold their heroes as silhouettes. Each island's star sits on its rim,
  so the lighting beats and the fold into the clasp play as before; the islands sink away as it folds.

## 2e. First Light alone, then the tour (2026-10-26, per user direction)

- **A new account sees First Light and nothing else until it is won.** The Pact's seats and the
  Infinite are not drawn, and the hub's bar (Collection, Play, Observatory) and Records are hidden;
  Options and the Reference stay, being settings and the manual the lessons fill. This **reverses**
  §3's "the two fights open the Infinite; the two acts stay First Light's to play, never a gate":
  the Infinite still opens after the Clearing underneath, but is not shown until the Fork is won.
  An account that played before the sky has First Light lit and never sees the gate.
- **After the finale, Blip gives the tour** (`TitleScreen.tsx`, lines in `FIRST_LIGHT_TOUR`,
  `data/thoughts.ts`), each step a forced beat: it takes the player to the Observatory, where only
  *Call to the Stars* stands and a hand points at it; the first Starfall is a forced pull, paid from
  First Light's Stardust. Then back to Play, where Blip shows the Pact and the Infinite. Each part is
  remembered once (`tour.firstLight.starfall`, `tour.firstLight.done`) and resumes if left; an account
  that cannot afford the Starfall skips straight to the Infinite. It replaces the `drawnIn` thought.
  **Wordless and forced since 2026-10-27** (per user direction): Blip leaves its seat and flies to
  each thing to tap (`BlipGuide.tsx`) with the hand on it — the Observatory's tab, *Call to the
  Stars*, the reveal's *Awesome!*, then Play — and nothing else answers (`HubNav`'s `only`, the
  sky's press held). Once back on Play it flies home to its seat and the tour is done.

## 2c. The manual (2026-10-26, per user direction)

How to Play is a book the player fills by playing, the way Hades' Codex and Hollow Knight's Hunter's
Journal fill. Picked from a side-by-side page (`art/concepts/manual-pages/`, "C · Learned, then
filed"). Content `src/data/howToPlay.ts`, mechanism `src/run/manual.ts`.

- **A lesson's tip IS its page.** The lessons' cues show How to Play's own pages, so the rules are
  written once. Anything about this round in particular ("Fang is faster, so Howl first") is said in
  the fight, never on the page.
- **The lessons speak for themselves.** No lesson is named anywhere: the title shows a star and its
  page, the act screen says *First Light*.
- **Pages land on a Learned screen.** A lesson won ends on its own screen: the fight result's stage,
  its pages as tiles landing one by one, any one opened by a tap. Then the title lights the star.
- **The curriculum** (per user direction: what every fight needs comes first, so Mana before
  Switching, and one target or both in the first fight):

  | Lesson | Pages it files |
  |---|---|
  | First (2v2, guided) | Turn by Turn · Mana · Single and Spread · Buffs and Debuffs · Types |
  | Second (the bench, guided) | Switching · Physical and Magical · Rest · Status Effects · Shield · Conduct |
  | Third (an act) | Leads · The Map · Items · Levels and Moves · Wounds · The Bag |
  | Fourth (an act) | Heals · Daze · Patrons · Elite or Skirmish · Recruiting |

- **Status Effects is the general page, then one page a status.** The lessons teach Shield,
  Conduct and Daze; every other status is filed the first time it lands in any fight.
- **A run files the rest** the first time it meets the thing: a status, a Field Effect, lock-in, the
  Pact Clock, an Ancient foe, or a screen (the Guild Hall, the Academy, Gems, a Banner, the next
  act, a Cycle). A filed page waits (`Profile.manualUnshown`) and lands as a **Learned** row in the
  next won fight's result, last in its ledger.
- **The book's contents are the sky.** The Reference's How to Play tab draws First Light's four
  stars and the Infinite's rings. A lit star opens its lesson's pages; the rings hold what
  runs have filed. A page not yet learned is not shown, and a dark star is what is left: a count
  drawn as the sky, never a number.
- An account that played before the manual (`Profile.manualComplete`, set on decode) has every page.

**Watch in playtest:** the Clearing teaches six pages, and the Hunt shows three tips at the top of
its round 2. The Clearing's Physical and Magical is taught in the heroes' words more than by its numbers:
the Ravager's Defense and Wisdom are equal, and the Slabback resists Raiju's Storm. A foe whose
Defense far outweighs its Wisdom would show it; that is a re-script of the fight.

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
6. **The shop's name and shape** (§7). **Name DECIDED 2026-10-24, per user direction: the
   Observatory.** Its first page is a sky of heroes you call one down from, and its Stars and Spawn
   pages are the record of what was watched. The shape is still open: if per-hero constellations
   ever reach the sky, the Stars page may move there. Code ids keep `starShop` and
   `constellation`, as Journey kept `classic`.
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
- The shop was renamed **the Observatory** right after (§8.6).
- **Still OPEN:** placements and shapes are first pass. A brand-new account currently has no
  tutorial at all until the rails land.

**Phase 5 — The light and its thoughts.** *(view, plus a data table)*
- The light from phase 2, living in the sky and on scenario cards.
- `src/data/thoughts.ts`: thoughts keyed by moment (a constellation revealed, a card opened, a
  Journey won or lost, a first look at a hero). `Profile.seenThoughtIds` keeps the firsts once an
  account.
- Passive: a thought appears beside the light and fades. No tap, never during a run.
- The poke (§1): a squash and spring-back on tap, with the face reacting. Skins come later, once
  a constellation or the shop has a seat to pay one.

**Blip is SILENT since 2026-10-27** (per user direction): it no longer speaks anywhere, and every
line below is deleted. What stands is wordless — the face, the poke, the win and loss reactions,
the first sky's fall scene leading into the first lesson, a newly opened constellation pointed out
once, and First Light's tour walking to the Observatory and back on its own. `data/thoughts.ts`
keeps only those firsts, with no lines.

**DONE 2026-10-24.** `Blip.tsx` is the little face on a canvas: it springs toward its home, bobs,
looks along its motion, blinks, and goes happy, sad, surprised or dizzy. Thoughts type out beside
it with a babble (`blip.*` in `sounds.ts`, on the SFX bus) and fade on their own.
- **Where it goes:** it rests over the constellation a press would play next (the first open,
  unlit one with a press, else Journey). On a sheet, it perches on the top edge. It stops, and
  says nothing, whenever the sky is off screen or a sheet stands over it.
- **What it says** (`src/data/thoughts.ts`, picked by `src/run/thoughts.ts`, firsts kept in
  `Profile.seenThoughtIds`):
  - On arriving, one thing: a reaction to the Journey just ended (session-only, never stored),
    else the first-sky hello, else the first constellation seen open (it flies there to say it).
  - Then up to three idle thoughts a visit, with a dart to look around between them.
  - A sheet's first about its constellation, or an uncharted line.
- **The poke:** a squish, a hop and a giggle. The first and third poke think a line, and five in a
  run make it dizzy. The tap never reaches the sky under it.
- **The voice** (2026-10-24, per user direction): chatty and a little silly, not aphorisms. The
  user wrote the first-sky hello and the three rail lines; the rest were rewritten to match. A
  thought can run to several bubbles, and `showsNext` sends Blip on to a constellation to say
  its first there. The hello ends "I'll show you my favorite one first" and flies to First Light.
- **Blip never cuts itself off:** an idle thought or a dart waits while it is mid-thought or
  mid-flight, and a poke during a first only giggles.
- **How often Blip talks is first pass** (one arrival line, three idle at most, 9–16 s apart).
- **Forced and passive thoughts** (2026-10-24, per user direction): a thought marked `forced`
  holds the sky. Blip flies out of its seat to the middle of a dimmed screen, and each bubble waits
  for a tap (a tap mid-line finishes it). Every other thought stays passive and fades on its own.
  `plays` on a forced thought starts a lesson when it ends, unless that star is already lit.
- **The opening beat** (2026-10-24, per user direction) is the first-sky hello, now forced. It
  gives the premise in Blip's voice: it watches over one world in many versions, a Titan ends most
  of them, the few the heroes win become its stars, and the player is here to help find them.
  **The fall came back as its scene** (2026-10-25, per user direction): after *This one starts the
  way they always do...* Blip flies up out of frame and a comic page lands one panel at a time in
  the ridge painting's own pixel style — the sky cracks magenta, the Titan falls burning, it strikes
  the land and the page shakes (`OpeningFall`, a thought's `scene: 'fall'`; PixelLab pro_flash with
  the ridge as style ref, `art/title/opening/`, a horned roll of the fall in
  `art/concepts/opening-comic/`; 2026-10-26, per user direction, replacing the sprite falling over
  the title's sky, which read as janky against the painting) — and the page falls away into the
  glow as the view pulls back to a painted ridge
  where Valor and Fang stand watching the glow (`art/title/openingRidge.png`, Pixen seed 8; the
  other rolls are in `art/concepts/opening-ridge/`). Blip drifts back and says the First Light
  first over it, then the ridge goes to black and The Hunt starts. The scene plays on its own; no
  tap skips it. The premise lines and First Light's second line are first pass; the user wrote the
  hello, the hand-off line and First Light's first.
- **A lesson shows its tips every time it is played** (2026-10-24): the welcome and every control
  tip came back only once an account, so a lesson replayed from the sky taught nothing. They are
  still recorded on the account.
- **OPEN, raised by the First Light line** ("a mighty fighter and her trusty canine companion"):
  is the first rail's fixed team Valor and Fang? Valor's *Tale* is cut, but the pair may stand
  as the rail's cast with no dialogue.
- **Stacked bands** (2026-10-24, per user direction, REPLACING the zoom sky the same day: a zoom
  doesn't fit a portrait screen; "it needs to be something that scrolls"). The title scrolls
  through one full-width band of sky a constellation, snapping to centre, the next peeking dimmed.
  Each band draws its constellation big with its stars named round it, its name above and its
  press below. It opens on the band a press would play next; a pip rail on the right edge says
  where the scroll stands and jumps. Blip's seat and the five constellations below are kept from
  the zoom sky; the zoom, the shared chart, `at` and `size` are gone. Blip's "show" scrolls to a
  band rather than flying, and a band settling in view takes the zoom's thought.
- **The zoom sky** (superseded the same day, kept as history; picked from `art/concepts/sky-layout/`
  over a carousel and a scroll map). The first sky's small constellations, scattered about with Blip's
  bubble landing on them, didn't work. Now:
  - **Five constellations, one for each way to play:** First Light (the eight lessons, the three
    rails merged), the Infinite (its five Cycles, five nested rings since 2026-10-26), the Trials (a ring of fourteen),
    the Gauntlet (crossed blades, a star for each of the first five clears) and Strange Worlds
    (six named seats for §4's twisted runs, uncharted).
  - **"Enter the Infinite" sits under the Infinite**, one tap. A tap on any constellation zooms the
    sky into it: its stars named, the others dimmed, its own press at the foot and "‹ The Sky"
    back. A parked run hides the overview's press; Continue and Start a New Run stand under the sky.
  - **Blip sits in a band under the logo** and talks there, its bubble beside it, never over a
    constellation. It flies out only to point at one, then comes back to say its piece. On a zoom
    it says its first for that constellation, or for a star that is lit or next.
  - **A constellation opens off a STAR** (`after` is star ids): the Trials, the Gauntlet and
    Strange Worlds open on Cycle I's star, as the doors did on a first win.
  - **First pass, flagged:** First Light pays 300 (the three rails' 100 each, merged); the Gauntlet's
    five stars are five clears (new goals, precedent the Cycles' line of five); "Strange Worlds" is
    a working name; and placements and shapes are still first pass.
- **Journey is renamed THE INFINITE** (2026-10-24, per user direction, §8.4). The constellation
  is "The Infinite", its press "Enter the Infinite", and its star "The Titan slain". Code ids keep
  `journey` and `classic`.
- **Not built:** a first look at a hero (Blip doesn't live in the Collection), skins, and the
  Titan-noticing arc (still PROPOSED).

**Phase 6 — The rails.** *(content on Stories' machinery)* **LESSONS BUILT 2026-10-24** (per user
direction): First Light's four stars are the four tutorials Stories already had, every scene and
spoken line cut (`src/data/lessons.ts`, `test/lessons.test.ts`):
1. **The Hunt** — Valor and Fang, guided: picking a move and a target, matchups, turn order.
   **Played off Wild's Edge's map since 2026-10-25** (per user direction: the cut from the opening
   ridge straight into the fight was jarring): a one-tile act, the arrival, then the map, and the
   tile tapped. A tile's `script` holds the guide (`StoryActNode.script`); a guided tile drops nothing.
2. **The Clearing** — four heroes against two of the Titan's spawn, guided: switching, Rest, a
   Shield and a Conduct setup. **The Faceless is gone 2026-10-25** (per user direction: an Endbringer
   with no context read strangely): a level-12 Ravager (Pounce) and Slabback (Rock Toss), the first
   things out of the fall. Both fall in round 5, nobody down.
3. **The Road** — chapter 2's act: the map, rewards, items, levels, the Bag.
4. **The Fork** — chapter 3's act: types, the Swordsman's seat, Elite or Skirmish, Solace.

- **Ren and Will are recast** with base heroes: **Iron Warden** (Iron, the wall, Ren's seat in all
  three) and **Raiju** (Storm, speed 100, Will's seat in the Clearing). Each holds the lesson's moves.
  The Clearing still teaches as before, pinned by test: the Warden runs dry (24 Mana against a
  25-cost cheapest move) and Rests under Rime Coat's Shield, then the Raiju's Conduct is set off by
  the Warden's Gale Sever and both spawn fall, nobody down. The two acts are NOT
  re-measured with the Warden in Ren's place; play them.
- **The Infinite opens on the Clearing's star**, about ten minutes in. The two acts stay First
  Light's, never a gate, and the constellation pays its 300 when all four are lit.
- **How it plugs in:** each lesson is a one-beat chapter in its own book (`LESSONS`), played by
  `StoryChapterScreen`; a chapter whose beats run out with no end card finishes. App looks a
  chapter up in Valor's book and the lessons' alike. A won lesson lights its star
  (`recordScenarioLit`), returns to the sky and Blip cheers; a lost fight or act replays; "Back to
  the Sky" leaves. A cue's line is optional now, and a lesson's say nothing.
- **On the sky:** First Light's press plays the next lesson by name, and a lesson's name is tappable
  once it is lit or next, to play or replay it.
- **A Tale of Valor is deleted** (2026-10-24, per user direction): its book of chapters, the
  scene player, memories, the fall, end cards, the Story select, Ren, Will, the boar, the crow and
  the risen Herald with their art, the portraits, paintings and backdrops, the scene voices, and a
  cue's spoken line. A lesson's fight stands on Wild's Edge by its own `locationId`. The four
  tips that named Ren or Will name the Warden and the Raiju, and keep their ids for their staging.
- **OPEN, raised by the deletion:** nothing plays the Titan's fall or the lore card now (they were
  the prologue's), so a new account meets no lore before the sky. Blip's hello is the only framing.

- First Light, The Bench and The Road as scenarios on `src/run/story.ts`'s fixed casts, encounter
  scripts and seeds. Their control tips stay.
- The new piece: a scenario **goal**, checked in the run layer off the event stream.
- Delete A Tale of Valor's cast, chapters and dialogue (§8). Keep the machinery.
- The first press on a new account descends from the sky into First Light.

**Phase 7 — The first twisted scenarios.**
- Monotype (fourteen stars), A New Place, and Strangers, on modifiers the run layer already has.
- Their constellations pay a Location, Stardust and the first cosmetics.
