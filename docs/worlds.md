# worlds.md — The account, the Worlds, and a new look

> **STATUS: DIRECTION PARTLY DECIDED; PHASE 2 BUILT (2026-11-24) — the Library reads every hero and
> the Collection starts at zero.** A rethink of what the account
> grows into, a permanent mode for it to grow in, and the frame and look around both. §2 holds what is
> decided per user direction; §3 is PROPOSED; §4 is OPEN and is not to be silently resolved; §5 lists
> what this reverses if built. Until a phase in §8 lands, every rule in CLAUDE.md stands.

---

## 1. Why

The Collection feels arbitrary, and nothing tells the story of an account growing. A hero pulled in
the Observatory is not exciting because nothing guarantees the player can use it: it joins the deck,
and the deck only feeds the draft and the Recruit rolls, so a pulled hero can go a dozen runs before
it is ever recruited. The reward sits behind a second lottery.

The fix splits the two jobs:

- **The Library is where you meet heroes.** Every hero is in it. A run works as a free demo: you
  play Ursa, love her, and want her.
- **The Collection is what you own and raise.** A pulled hero is usable the moment it lands, in a
  mode where owning it is the point.

References: League of Legends' free rotation and Marvel Snap's "play against it, then want it" for the
first; AFK Arena's campaign and Resonating Crystal, Epic Seven and Dragon Quest Monsters for the second.

---

## 2. Decided (per user direction, 2026-11-21 to 2026-11-24)

### 2.1 The Library fields every hero
The roguelike draws its draft, its Recruit nodes, its events and its enemy parties from the whole
catalog, owned or not. The deck no longer feeds a run. **Every hero is in every draft from the first
run**, Motley and the Burden heroes included (2026-11-24, per user direction; §4.8 is settled).
**BUILT:** the draft reads `libraryRows` (`src/run/deck.ts`) and a new run's `deck` is null, so its
pools are the whole catalog; a run saved with a deck snapshot keeps it.

### 2.2 The Collection starts at zero
A new account owns no hero. The Starfall is the only way to own one, and owned heroes are what the
Constructed modes use: the Worlds (§2.3), the Trials and the Gauntlet. The Library does not read it.
Decided 2026-11-24, per user direction:

- **Every account restarts at zero**, the oldest included: profile version 4 takes every hero entry
  off the ledger (Starfalls, bundles, grants, legacy singles), which refunds what they cost.
- **No starter grant**: a new account owns only the tutorial's one forced Starfall (§3.6 is settled).
- **The Starfall draws any hero not owned**, the old base roster included, never a bundle's; the
  fill-every-type-to-three rule is gone.
- **The Gauntlet opens at 15 owned** (`GAUNTLET_MIN_OWNED`), on top of the Cycle I clear; its sky seat
  is only glimpsed until then (`ConstellationDefinition.minOwned`).
- **Cycle V's full-deck gate is gone.**

**BUILT** in `src/run/recruitment.ts` (`ownsHero`: nothing owned free), `src/run/starShop.ts`,
`src/run/profile.ts`, `src/run/gauntlet.ts`, `src/run/collection.ts`, `src/run/sky.ts`.

**The deck is retired** (same day, per user direction): the Collection screen lists every hero a
type at a time, owned first, with Info and a bundle's Buy; Equip, Swap, the Deck view and
`Profile.deck` are gone. **Not yet:** the Trials and Versus do not wait on a Collection size.

### 2.3 The Worlds: a permanent mode
A sequence of Worlds, each a run of stages ending in a boss (1-1, 1-2, 1-3, 1-4, then the 1-5 boss),
clearing one opening the next. It uses only owned heroes, and its progress is permanent.

**Player-facing names** (2026-11-24, per user direction): the mode is **Your Story**, and a World is a
**Chapter** — Chapter 1, stages 1-1 to 1-5, a Blot at the end. This doc keeps "the Worlds" as its
working term for the mode.

### 2.4 Six levelled seats
**XP levels a seat, not a hero.** The team has six seats, and any owned hero placed in a seat is at
that seat's level. A new pull is useful at once because it inherits a seat, which is what the whole
rethink is for. Six seats rather than one team level, per user direction, because raising all six is
the long-term goal the mode is built around.

### 2.5 A permanent currency
A new currency, separate from the summoning one, buys levels, Gems and item caches in the Worlds. It
is **Ink**, and the summoning currency is **Pages** (2026-11-24, per user direction, §3.7). **Everything it buys is owned for good.** XP spent is permanent; Gems and gear
can be moved between heroes as the player rebuilds a team.

### 2.6 The look: storybook day
Chosen 2026-11-24 from `art/concepts/vibrant/` over "jewel night":

- **Interface:** a cream console, ink text, rounded buttons with a soft drop edge, the bottom
  buttons as cream coins with coloured rims. The stone-and-gold pixel kit goes.
- **Cards are bubbly** (2026-11-24, per user direction, from `art/concepts/whimsy/`, over stickers,
  inked pages and stamps): very round, a puffy highlight and a chunky lip in the card's own colour
  (type, hero, rarity, rite); gear sockets are small bubbly squares. Plain rectangles read surgical.
  **The mana gem is a bubble** (2026-11-25, per user direction, from `art/concepts/mana-gem/`, over a
  candy hexagon, a droplet and a crystal shard): a glossy blue bead with one highlight and an ink
  rim, gold when the pool overflows.
  **A move button is paper washed in its type** (2026-11-27, per user direction, from
  `art/concepts/move-buttons/`, over cream, a night card and a full type-colour face): rim and lip a
  shade deeper, the type in a coloured disc, and every icon (reach, chevrons, the stub's kind) in its
  own colour. Forcing ink onto the icons sucked the life out of them.
- **Arenas:** sunny and undimmed (the mock's Wild's Edge: Pixen 196x228, seed 8, low detail).
  Text over a bright arena needs a white face with an ink rim, or it disappears into the grass.
- **Heroes:** redrawn cartoony with bigger heads, rounder shapes, two-tone cel shading and bright
  colours, from the existing sprite, so identity and outfit survive. **Dark-typed heroes are
  spooky-cute** (rich purples and teals instead of black, mischievous eyes), per user direction:
  the plain cartoony prompt barely changes them.

### 2.7 The Titan goes; the frame is the Storybook
The Titan, the Touched Guardians and the magenta eyes give way to **the Storybook** (2026-11-24, per
user direction, chosen over Little planets and Crystals from `art/concepts/frames/`). References:
Paper Mario, Kingdom Hearts' Hundred Acre Wood.

- **The world is a book whose pages have been blotted out.** Each World is a chapter to restore.
- **The roguelike is the Library** (renamed from the Infinite, 2026-11-24, per user direction): its stacks hold every hero from every story.
- **A pull writes a hero into your book.** It is yours from then on.
- **The mob line is the Doodles** (2026-11-27, per user direction, replacing "Titanspawn" in
  player-facing copy; code ids still say `titanspawn`): margin doodles come to life, one line a type,
  drawn clean as their element in the heroes' chibi style with ordinary cartoon eyes. **No ink on
  them** (2026-11-27, per user direction): ink drips and ink running through the body were mocked
  (`art/concepts/spawn-redraw/ink/`) and rejected as looking bad, so "Enemies are ink" and the Blots
  are reversed. Open: Ink, the currency, was "washed out of a Blot" and needs a new source story.
- **The Guardians are stern, not cute** (2026-11-27, per user direction, replacing the Touched pixel
  art): the heroes' clean storybook style with no smiles, closed mouths and heavy brows, so a boss
  reads apart from the recruitable heroes. A cute pass and a fierce one were mocked
  (`art/concepts/spawn-redraw/guardians/tone/`); the cute one read goofy. No magenta eye or crack.
- **Working title: Twofold Heroes** (2026-11-24, per user direction, picked from six logos in
  `art/concepts/names/`). The brand is the one word *Twofold* — a pair, and a folded page — with
  HEROES set small beneath it, the way Fire Emblem Heroes stacks. Plain "Twofold" is taken on Steam
  (a 2023 visual novel, and Twofold Tower, a puzzle game); "Twofold Heroes" turned up nothing in a
  first search. Not yet checked against trademarks or Google Play. **On the title and the browser tab
  since 2026-11-24, per user direction**; the install manifest still says Titanpact.

§3.1–§3.2 below were written for Crystals; their structure carries over to chapters.

---

## 3. Proposed

### 3.1 One chapter a type (written for Crystals, SUPERSEDED as a frame by §2.7)
The Crystals pitch was: **each element has a Crystal, the Crystals have gone dark, and the player
lights them back one World at a time.** Read *chapter* for *Crystal*; the fit with what is built holds:

- *Type is the domain a hero's power draws from* is the Crystal premise word for word.
- **Fourteen draftable types give fourteen Crystals, and fourteen Worlds**, with Ancient as the
  last: the thing older than the Crystals, or the thing that broke them.
- **The Trials already field one authored team a type** (`docs/constructed.md`): each becomes its
  World's boss team.
- **The Doodles (the Titanspawn) are one mob line a type, drawn as the element itself.** Without
  the magenta eye they are the element run wild while its Crystal is dark: the stages of their World.
- **Each type's Guardian becomes its Crystal's warden**, the World's boss beside or within the
  Trial team.

The weakness is that Crystals are a template, not an identity. §3.2 is what would make the frame do
mechanical work.

### 3.2 Lighting a Crystal opens its type to the Starfall
The account starts able to call heroes of one or two types, and each World cleared lights a Crystal
and widens who can answer. The Collection grows type by type because of what the player did, which
is the account story §1 says is missing. The cost is narrow early pulls, which may suit a new player
learning a smaller pool.

### 3.3 The Library's fiction
The name carries it (§2.7): a run is borrowed from the stacks, with every hero in it and none of them
yours yet. Nothing more is needed; Slay the Spire's ascent has less. Code ids still say `classic`.

### 3.4 Seat levels catch up on the cube
On `XP(L) = L³` the curve does catch-up on its own: levels 1→20 cost 8,000 XP, while 20→25 cost
about 7,600. Priced straight off the curve, raising a low seat to the team's floor costs about as much
as pushing the top seat a few levels. That is the carry-or-floor choice the six seats exist to create.

### 3.5 Fold the Trials into the Worlds
The game would otherwise have the Library, the Trials, the Gauntlet, the Worlds and the Sky. The
Trials' teambuilder becomes the Worlds' team screen, and its fourteen fights become World bosses
(§3.1) or challenge stages.

### 3.7 The Sky becomes the book
Everything celestial in `docs/the-sky.md` translates into the book; its code and structure mostly
survive, its October art does not. Mocked in `art/concepts/spread/`.

| Today | Under the Storybook | Status |
|---|---|---|
| Blip, a light | **Blip, a bookworm in round reading glasses, peeking out of a red book** (`art/concepts/spread/blip-glasses.png`). Its voice, thoughts and poke carry over; it now needs a sprite and poses | **Decided** 2026-11-24, per user direction |
| The galaxy title, the Pact ring and its seats | **An open book on a desk**: the Library on the top page, **Your Story** (the Worlds, renamed 2026-11-24, per user direction) on the bottom, the Gauntlet and the Trials as ribbon bookmarks | **Decided and BUILT** 2026-11-24, per user direction (`BookTitle.tsx`): Your Story reads Coming soon until the Worlds exist; Blip draws as the bookworm |
| Stardust | **Pages**: a pull fills a blank page with a hero. The Collection is literally your book's pages | **Decided** 2026-11-24, per user direction; player-facing text says Pages (code ids still say stardust) |
| The Starfall | **Writing a hero**: a quill sketches a figure on a blank page, then colour floods in | **Decided and BUILT** 2026-11-25, per user direction (`Starfall.tsx`): the Pages fly into a blank page, the type wheel still spins and stamps the type in its corner, the quill sketches, a drop of the type's colour floods it; a ten-draw sketches ten small pages. The name Starfall stays for now |
| The Observatory | **The Scriptorium** | **Not taken** 2026-11-25, per user direction: the Observatory keeps its name and its heroes-as-stars chart, drawn by day as a star chart inked on paper, an owned hero a sticker in its type's colour |
| Essence (§2.5) | **Ink**: what buys seat levels and draws a hero's equipment and Gems — one purse for all growth. Washing a Blot out of a page is what yields it, so the enemy and the purse tell one story. Enemies are **Blots**, never "ink monsters" | **Decided** 2026-11-24, per user direction (Gilt rejected). **The Blots half is reversed 2026-11-27**: the mob line is the Doodles, with no ink (§2.7); Ink's source story is open |
| Cycles I–V | **Editions**: the Second Edition retells the story, changed and harder | Proposed |
| Strange Worlds | **Tall Tales** | Proposed |
| Stars as records | **Gold-star stickers**, unchanged in name | Proposed |

Blip's one arc — the Titan beginning to see it — passes to the Blot, creeping toward the page Blip
lives on across the Editions.

### 3.8 The Inkmaster (an idea, 2026-11-27, raised by the user)
**Someone has trapped the land's heroes inside his book, and they must beat him to escape.** The
working name is the Inkmaster; Ink Lord and Ink Emperor were also floated. He gives §2.7's blotted
pages an author: the Blots are his ink, and the run is a reading of his book.

What it explains that the game already does:
- **Runs repeat** because the book is read again; an escape attempt is a reading.
- **A pull writes a hero into your book**: you take heroes back from his pages, one page at a time.
- **The Blot creeping toward Blip's page** (§3.7) is his hand reaching for the last free reader.
- **Editions** (Cycles I–V) are his rewrites, each harder, the way the Titan adapted each Cycle.

Questions it raises, for the designer:
- **The name sets the tone.** *Inkmaster* reads playful (a showman, a ringmaster); *Ink Lord* and
  *Ink Emperor* read as a real threat. Spooky-cute (§2.6) leans toward the first.
- **Ink is the player's currency** (§3.7: Ink buys seat levels, washed out of a Blot). If the
  villain *is* ink, the purse is his blood. That could be the point (you spend his power against
  him) or a muddle to rename around.
- **What happens to the Titan's pieces.** The Herald, the Eyes and the four seals either become his
  chapters (a herald who reads his prologue, eyes in the margins) or retire with the Titan.
- **What escaping means across Editions.** The Titan died for good at Cycle V. Does the Fifth
  Edition close his book, or turn him into a reader of yours?
- **Who is trapped.** "The heroes of the land" puts the whole Library in his book. Is the player's
  own book (the Collection) a separate book written against his, or pages torn out of it?

Status: **an idea, not decided.** It sits beside §2.7 and decides nothing in it.

**The opening tells it (2026-11-27, per user direction, picked from `art/concepts/opening-ink/`).**
The Titan is gone from the story, so the first thing a new account sees is the Inkmaster:
- **The comic** (`data/opening.ts`) is six storybook pages in the heroes' own voice: *We were heroes
  once, out in the wide world. / Then came the Inkmaster, who collects heroes. / One stroke of his
  quill, and we were trapped on his pages. / He set a guard at the end of every chapter. / His story
  ends on the last page. / Reach the last page, and we walk out of the story.* The ending is vague on
  purpose: the finale is still the Herald and the Eyes, so it promises the last page, not a fight
  with him. Six PixelLab paintings (`art/title/opening/`) with the roster's own sprites stood in them.
- **The welcome** is its own paper page before the first fight, not a dim over it: *Our heroes are
  trapped inside the Inkmaster's book. Fight your way to the end to free them.* It is the one tip
  allowed "our", answering the comic.
- **He is drawn as the showman** (option A of `art/concepts/spawn-redraw/inkmaster/`) on the comic
  and the welcome. Whether he is a boss, and in what shape, is still open.
- **The loading screen** is the title's book shut on the desk, the wordmark on its cover, which
  swings open onto the title. **The title** has one ≡ corner button (Records, Reference, Options,
  Dev), so the wordmark stands alone, and the desk runs down to the tab bar. The tab bar is left as
  it is, since its buttons may change.

**How he is portrayed is decided** (2026-11-27, per user direction, picked from
`art/concepts/spawn-redraw/inkmaster/`): **his two Hands replace the Titan's Eyes**, and his face is
the beat. The finale's second phase fights his Left Hand (black velvet glove, a dripping quill) and
Right Hand (an open glove pooling ink), one for one in the Eyes' slots, so the engine and the phase
stand. When the last Hand falls, the showman (top hat, quill for a baton) leans out of the page in
the moment the Titan used to rise over the fight. He never shows his face before. The Endbringer is
redrawn as a stern hooded herald and stays phase 1. Built so far: the Hands' art at the Eyes' paths
(`art/heroes/titan/eye*.png`, `righteye*.png`) and their names; ids still say `leftEye`/`rightEye`.
The kit is renamed for writing (ids unchanged): Gaze is **Underline**, which leaves a hero
**Underlined**; Regard is **Strike Through**; Lidded is **Blotter**; Laid Bare is **Red Pen**; the
Withering Gaze field is **Spilled Ink**. As the Herald falls, his book opens and the two Hands rise
out of the ink, with his face still hidden (`TitanRiseScreen`). When the Hands are beaten, he bursts
out of his page at last, is pulled back down into it, and the book shuts (`TitanBoundScreen`). Then
its last page replaces the Titan's seal (2026-11-27, per user direction, picked from
`art/concepts/spawn-redraw/ending/`): **The End**, the run's heroes standing on the page, and its
chapters as a table of contents, each with the Guardian beaten there. No line about escaping or
about him writing again. Not built: the closed-eye opening cards, and the code ids and file names still
saying Titan and Eye.
Reference: Smash Bros.' Master Hand and Crazy Hand. The Doodles can be the margin scribbles of his
book, and Ink the currency his ink spent against him (both proposed, not decided).

### 3.6 A starter grant (SETTLED by §2.2: none; the modes wait on the Collection instead)

---

## 4. Open — DO NOT silently resolve

1. **Where seat XP lands.** Aimed at one seat by the player (a carry runs ahead), or split by a rule?
2. **Level 99.** The user floated it and asked to keep it in mind. **The damage formula ignores
   level**: `offStat / defStat` is a ratio, so two sides growing evenly hit as hard at 99 as at 10,
   while HP grows 3 a point, so fights lengthen as the seats climb. Pokémon puts level in its damage
   formula for this reason. Options: a level term in the Worlds only (it breaks a locked formula);
   no HP growth past ~30; or 99 as a display number on a compressed stat curve.
3. **Mana at high level.** Mana growth was cut to 1 a point (2026-09-28) because pools outgrew move
   prices by Act 3. At 99 levels mana stops being a decision unless its growth stops or prices scale.
4. **Moves in the Worlds.** The roguelike's offers burn when declined; in a permanent mode that is a
   regret kept for good. Pokémon's move relearner is the precedent: every offer a hero has reached
   stays learnable, and the player picks a loadout. The 1–30 schedule also needs stretching.
5. **Evolution paths.** Permanent, or respec for Essence?
6. **Gems are also Mastery pips.** If a Gem can come off, can an Evolution be undone? Mastery counts
   Gems *ever placed* (the pip is permanent, the stat is portable — recommended) or Gems *socketed now*.
7. **Does the Library pay Ink?** If yes, every run grows the account and the modes feed each
   other. If no, they stay cleanly apart, and a player who only plays runs never sees heroes grow.
8. **The deck** — settled: retired (§2.2).
9. **The Sky's names.** §3.7 translates it into the book; Blip is decided. Pages summon and Ink grows
   (decided); left: what each mode pays (§4.7 — the natural split is the Library paying Pages and the
   Worlds paying Ink), Ink buys seat levels too (decided 2026-11-24, per user direction: one purse for all growth, so
   raising a seat and gearing a hero compete); Editions, or let the Cycles retire into
   plain difficulty; the two-page title against the single press it replaces.
10. **The enemy tell.** The magenta eye was a strong, cheap read for "enemy". A bright game needs a
    new one, perhaps the element gone feral.
11. **Grim names.** Blood Moon, Torment, Revenant, Werewolf Bite, the Endbringer, the Burden. A tone
    pass renames some; some, like the Werewolf curse, may not fit at all.
12. **The name is a working title, Twofold Heroes** (§2.7). Left open: a trademark and Google Play
    check before anything public, and when the code, the save keys and the repo stop saying Titanpact.
    Rejected along the way, per user direction: any *-bound* name, any *Story-* prefix (crowded on
    stores), Ink & Ever, Twice Upon a Time.
13. **Music.** Twelve FLAC tracks keyed to Locations. If they are dark, they are the hardest thing to
    make whimsical after the fact.

---

## 5. What it reverses (if built)

| Rule in CLAUDE.md | Becomes |
|---|---|
| The deck feeds the run's pools (`docs/collection.md`); the draft draws one hero a deck row | The Library draws from every hero (§2.1) |
| The base 28 owned free as the default deck; the Starfall fills every type to three first | The Collection starts at zero (§2.2) |
| Cycle V asks for three of every type owned | Nothing in the Library reads ownership |
| Bundles (From the Tall Grass) as a way into the run's pools | Bundles, if kept, are Collection-only |
| Constructed (the Trials) as a separate mode | Folded into the Worlds (§3.5, proposed) |
| `MAX_LEVEL` = 30, levels roster-wide | Unchanged in the Library; the Worlds level six seats, possibly to 99 (§4.2) |
| Gear absorbed, never comes off | Unchanged in the Library; movable in the Worlds (§2.5) |
| "A bare number never gets a screen" | Excepted in the Worlds, where Essence buys Gems |
| The Titan, the Herald, the Eyes, the Touched Guardians, `TITAN_EYE` magenta, the Cycles' sealed-Titan premise, the Wardens | Replaced by the frame §3.1 settles on |
| The dark palette and the stone-and-gold kit (`docs/visual-language.md`) | Storybook day (§2.6) |

---

## 6. The art bill

Counted from the repo on 2026-11-21:

| Layer | Size | Cost |
|---|---|---|
| Interface palette | `styles.css`: ~40 colour tokens, but ~1,300 hex and ~2,600 rgba colours written in directly | A sweep, not a token swap: mechanical work over a few sessions |
| Interface pixel kit | 22 PNGs in `art/ui/` (stone frames, planks, slots, flagstones) | Small: redraw or replace with CSS |
| Backdrops | 11 Locations × arrival, map, battle and hall paintings, 44 PNGs | Medium; redrawn anyway if the Worlds become Crystals |
| Heroes | 84 base sprites plus attack and damaged frames | ~420 gens for bases, ~840 for frames |
| Evolutions | 759 files, ~250 paths × 3 frames | ~1,250 gens: the bulk |
| Titanspawn and Guardians | ~155 files | ~800 gens, or replaced by the frame |
| Titan content | 1,441 mentions across `src` and `docs`, 101 source files | Mostly deletion plus tests |

About **3,300 PixelLab generations** with re-rolls, inside one 10,000 cycle. The real cost is
reviewing every frame.

**The recipe** (worked first try on 10 of 10 heroes in the mock): `edit_image_pro_flash` on the
existing 48px sprite, seed 11, *"Redraw this same character in a cute cartoony style like a whimsical
monster-collector RPG: bigger head, rounder simpler shapes, big expressive eyes, bright saturated
cheerful colours, clean dark outline, simple two-tone cel shading, same design, same pose,
three-quarter view, the entire character fits inside the canvas"*. Dark types swap the middle for
*"a spooky-cute cartoon style like a friendly storybook villain … big mischievous eyes, keep its dark
identity and colours but in rich saturated purples and teals instead of black"*. 5 generations a
sprite. Before the full roster, lock the style on 6–8 heroes across body types and pass the best as
the style anchor on every later edit.

---

## 7. Tensions

- **Three redesigns at once.** The meta, the frame and the look are all moving, so nothing is stable
  to test against. The frame decides the art (redraw the Titanspawn or replace them), so it comes first.
- **The Worlds' management screens are the expensive kind** — screens the player has to remember to
  open. That is the genre's draw, so accept it, but keep each to one screen.
- **The Library loses its meta hook.** A pull no longer pays off in a run, so the Library earns its
  place through Stardust and, if §4.7 says yes, Essence.
- **Cuteness against menace.** Spooky-cute answers it for heroes; enemies and bosses still need to
  read as threats in a bright world (§4.10).

---

## 8. Phases (PROPOSED)

1. **Finish the frame** (§2.7, §3.7, §4.9): the Storybook, the working title and Blip are chosen;
   the Sky's names are left.
2. **The Library opens to every hero, and the Collection starts at zero** (§2.1, §2.2). **BUILT
   2026-11-24**, the deck retired with it.
3. **The Worlds, first slice**: one World, six seats, Essence, the team screen grown from the Trials'
   teambuilder. Settle §4.1–§4.7 inside it, with level 99 measured rather than argued.
4. **The look**: the style lock, then the interface sweep and pixel kit, then heroes, then backdrops.
   Enemies last, once the frame says what they are. **STARTED 2026-11-24:** all 84 heroes and 253
   Evolutions redrawn with attack and hurt frames; the battle, map and arrival backdrops repainted
   sunny (spooky-cute for Necropolis, Blighted Shrine and the Threshold); the pixel kit recoloured
   to paper and tan in place; the theme lives in `src/app/storybook.css`, loaded after styles.css.
   Left: the title and the Sky, the Titan's map stone and the Guardians, the Titanspawn, and the
   remaining dark panels screen by screen.
5. **The rest of the Worlds**, one a Crystal.
