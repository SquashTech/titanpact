# Patrons

**Decided 2026-10-13, revised 2026-10-15, per user direction. Phase 1 BUILT 2026-10-15** (see "Built"). The Mentor's seat and the
Academy's seat stop being forced single tiles and become **patron seats**: two patrons offered, one
taken. Every patron has a **Trust** ladder, and Trust is how its rewards grow over a run. A player who
commits to one patron early is promised its capstone; a player who spreads gets a strong run without
one.

## Decided

1. **Patrons are one kind of thing.** A title, a name, an optional student, and five rungs. Nothing
   on a patron seat is a one-shot.
2. **Trust is per patron, per run, 0–5, and never decays.** Taking a patron raises its Trust by one
   and pays the rung it reached. Skipping one costs only the meeting not taken.
3. **The seats are row 2 and row 6 of every act** (today's `SPLICED_ROW` and `ACADEMY_ROW`,
   `src/run/map.ts`), each a pick 1 of 2. Eight seats a run.
4. **Odds rise with Trust and never guarantee** (per user direction). A patron the player has taken
   is drawn at a seat more often the higher its Trust — Hades' god weighting: early choices shape the
   build without fixing it. The weight is the dial; playtest sets it.
5. **The Promise.** The patron taken at the run's **first seat** (Act 1, row 2) is guaranteed one of
   the two tiles at three of the seven seats left before the capstone, chosen off the run seed when it
   is taken and never shown. Meeting it at all three reaches Trust 4, so a focused player's capstone
   is certain. Only the first pick is promised — two promises would decide six of the seven remaining
   seats.
   - The odds of (4) still run at every other seat, so the promised patron can appear off-schedule
     too, and a promised visit cannot be told from a lucky one.
   - Skipping a promised visit spends it. The odds may still bring the patron back.
   - A patron that reaches Trust 4 early releases its unspent promised seats to the normal draw.
6. **Trust reaches 4 on the road, and 5 only at the capstone.** A patron at Trust 4 stops appearing
   at seats, which spreads the player's later meetings on its own.
7. **The capstone: one a run, right before the Act 4 Guardian** (moved from the Vigil so the reward
   has two fights to show itself). It is the fifth meeting: the patron at Trust 4 comes and pays rung
   5, a reward screen with no decision. Two at Trust 4 → the beat asks which one comes, its one
   decision. None at 4 → no beat.
8. **Rungs 1–4 carry the power; rung 5 carries the memory.** Each of rungs 1–4 is worth about a good
   reward-row tile on its own; rung 5 is about one more rung of power, named and visible. The
   authoring test: **two patrons at Trust 3 are about as strong as one at Trust 5.** Rung 5 only lands
   in Act 4, so it is balanced for exactly two fights, and the Act 4 Guardian and the finale are never
   tuned around a capstone — a spread run has none.
9. **Rung 5 is always something the game already has** (2026-10-15, per user direction): a piece of
   equipment, a Force (Edge, Aim, Grace, an element), a move, or a passive. It never reaches into a
   hero's identity — no second Evolution path, no second Class, no type change, no extra socket. In
   practice a patron grows ONE thing it gave, and rung 5 swaps that thing for its finished form: an
   item for a Unique, a passive for its mastered version (the `masteredPassiveIds` shape), a Class for
   a Master Class. One engine verb, "replace this id with that one".
10. **A patron's moves, passives and Uniques are in no other pool** — the rule Classes follow
    (`docs/academy.md`). A patron move wears its holder's innate primary type (`typeFollowsUser`).
11. **The Mentor leaves the seat for the reward pool** (per user direction): an XP tile in
    `REWARD_WEIGHTS`, chosen like any reward. The Act 1 boost it guaranteed now comes from the first
    seat, so every patron that can appear there needs a rung 1 that pays in the Act 1 Skirmish.
12. **Classes are optional.** The Academy's grant becomes the Headmaster, drawn like any patron, so a
    run can end with no Class.
13. **A patron is a title and a name, and never stands on a fight stage.** The map tile and preview
    carry the title ("the Swordsman"); the voice line carries the name ("Kaede, the Swordsman"). A
    patron is drawn only in its own screen's keeper header — Hades' gods are never mistaken for
    playable characters because they only ever appear as portraits.

## The patrons

Every rung is a first pass. "Student" is the hero the patron picks at its first meeting; later rungs
go to that hero with no decision.

**The Swordsman** (student). The template.

| Rung | Pays |
|---|---|
| 1 | A Sword for the student, sized to the act |
| 2 | A Slice move |
| 3 | Edge, as a passive |
| 4 | The Sword a tier up, and a second Slice move |
| 5 | The Sword becomes his Unique blade, in place |

**The Huntress** (student). The Swordsman's ranged mirror.

| Rung | Pays |
|---|---|
| 1 | A Bow for the student |
| 2 | An Arrow move |
| 3 | Aim, as a passive |
| 4 | The Bow a tier up, and a second Arrow |
| 5 | The Bow becomes her Unique bow |

**The Archmage** (student). The casters' weapon patron.

| Rung | Pays |
|---|---|
| 1 | A Staff for the student |
| 2 | A patron spell |
| 3 | A passive: a Mana grant on entering the field (overflow allowed) |
| 4 | The Staff a tier up |
| 5 | The Staff becomes his Unique staff |

**The Priest** (student). Healing, on Grace.

| Rung | Pays |
|---|---|
| 1 | A passive: Grace on entering the field |
| 2 | A patron heal move |
| 3 | The passive's Grace rises |
| 4 | The heal move also Cleanses |
| 5 | The passive's mastered form — e.g. Martyrdom: the first time each fight the student falls, both allies on the field are healed |

**The Headmaster** (no student). The Academy as a patron.

| Rung | Pays |
|---|---|
| 1 | A Class, three rolled, for a hero without one (today's Academy) |
| 2 | Another Class |
| 3 | A Class picked from five, not rolled from three |
| 4 | Another Class |
| 5 | **A Master Class**, one of three authored for this rung alone, REPLACING a hero's Class — so one Class a hero still holds |

The three Master Classes are designed around offense, defense and utility, and shown by name alone
(the Academy's role tags came off 2026-09-11, per user direction). First ideas: **Warlord**, hits on a
foe below half HP strike twice; **Bastion**, an ally's first hit taken each round comes to the holder,
Shielded; **Strategist**, a move — a priority swap, or a reset of an ally's stages.

**The Hexwright** (student). Hexes on the ENEMY, so she suits any hero.

| Rung | Pays |
|---|---|
| 1 | A passive: on entering the field, the foe opposite loses a stage of its best stat |
| 2–4 | The hex widens: both foes, two stages, a second stat |
| 5 | The hex's mastered form |

**The Forgemistress** (no student). The general gear patron.

| Rung | Pays |
|---|---|
| 1 | A Forge — one worn piece a tier up and an enchant |
| 2 | A piece rolled to fit a hero the player picks |
| 3 | Another Forge |
| 4 | A piece rolled to fit, a tier ahead of the act |
| 5 | One of three Forgemistress Uniques, for any hero |

## Built (phase 1, 2026-10-15)

- **Engine**: `src/run/patrons.ts` — Trust, students, the Promise, the seat draw and the rung verbs;
  `RunState.patrons` (optional, so a pre-patron save starts from no Trust; `decodePatrons`, save.ts).
- **Map**: rows 2 and 6 are two `patronSeat` tiles (`PATRON_ROWS`, run/map.ts). Every tile above links
  to both, and both link to every tile after — a patron picked never closes a reward the next row
  would have offered (the reason the fork links fully). A seat's two patrons are drawn the moment it
  comes into reach (`withReachableSeatOffers`, run/runProgress.ts), off the Trust held then, and
  kept, so the seat in front of you never re-rolls under it.
- **The Mentor and the Tutor** roll in the reward rows (`rewardWeightsFor`): the Mentor acts 1–3, the
  Tutor act 4, each at weight 25. The Academy node no longer generates; its screen and the Mentor's
  forced seat survive only for a save that still holds one.
- **The capstone** is a beat on entering the Act 4 Guardian's gate (App.tsx `handleEnterFight`), not a
  map row: one patron at Trust 4 comes straight in; two raise `PatronCapstoneScreen` first.
- **The screen** (`PatronNodeScreen`): the patron greets and says what the rung pays, then pays it a
  step at a time — the item who-screen restricted to the student (its taker becomes the student), a
  lift or a Unique in place, a move or passive taught straight to the student (no tap when there is
  nothing to choose), a Class through the Academy's own screen with the patron's header. A resumed
  save picks up at the step it stood on (`RunScreen.patronNode.stepsDone`).
- **All seven patrons** (the Huntress, the Priest, the Hexwright and the Forgemistress joined the same
  day). The Forgemistress added three rung verbs: `forge` (the Forge node's screen, free), `fittedItem`
  (a hero picked, then a piece rolled to fit them — the contract roll, `rollFittingGear`) and
  `uniqueChoice` (one of three Uniques, then the who-screen for anyone).
- **Art is placeholder**: every patron is drawn as a mark (a sword, a staff, a bow, a hammer…) on the
  tile and in its screen's header. Each wants a real NPC figure, and each new Unique an icon.
- **The sim** takes the patron it trusts most at every seat and the capstone before the last
  Guardian. Measured once, directional: 8 seats a run, nothing stranded.

### First-pass values, chosen to ship — every one is the designer's to move

- **Names**: Ren (Swordsman), Ysolde (Archmage), Aldous (Headmaster), Sable (Huntress), Osric
  (Priest), Morwen (Hexwright), Brann (Forgemistress).
- **The Huntress**: Bow → Hunter's Arrow (55, 15 mana, 4 Charges) → Keen Eye (on entering, Aim 15) →
  the Bow a tier up and Arrow Storm (both foes, 45, 20, 3 Charges) → Windpiercer (Atk 50, Wis 40, Aim 10).
- **The Priest**: Benediction (on entering, Grace 15) → Blessed Light (heal 45, 35 mana) → a Robe →
  Absolution (heal both 30, cleanses one, 45) → Martyr's Grace (the first time each fight the student
  drops under half, both allies are mended, 40 healing power). The capstone was proposed as "when the
  student falls"; a knockout is not a hook the engine offers, so it fires at half HP instead.
- **The Hexwright**: Evil Eye (on entering, both foes INT ▼) → Hex Bolt (55, ATK ▼, 35) → Curse of
  Frailty (on entering, both foes DEF ▼ WIS ▼) → Malediction (both foes 45, SPD ▼, 45) → Grand Hex
  (on entering, both foes ATK ▼ INT ▼ SPD ▼). Each hex moves one step: a repeating card may not move two.
- **The Forgemistress** (no student): a Forge → a fitted piece at the act's tier → a Forge → a fitted
  piece a tier ahead (inside the act window) → Hearthguard (HP 90, Def 60, Warden's Vigil), Emberheart
  (Mana 60, MP Regen 10, Attunement) or Strider's Mark (Spd 60, Atk 15, Int 15, Quickening).
- `TRUST_WEIGHT` = 2 (a patron's draw weight is 1 + 2 × Trust); `PATRON_ITEM_RARITY_BY_ACT` = Rare /
  Epic / Legendary / Legendary. A lift stays inside the act's rarity window, as the Anvil does.
- **Moves**: Crescent Cut (Slice, 70, 40 mana), Gale Sever (Slice, both foes, 55, 50), Arcane Lance
  (70, 40), Prism Burst (both foes, 55, 50) — all wear the holder's type.
- **Passives**: Honed (on entering, Edge 15), Starwell (on entering, 25 Mana).
- **Uniques** (Mythic 110): Moonfang (Atk 60, Spd 30, Edge 10), Astral Staff (Int 60, Mana 30,
  Overchannel). A Unique keeps the enchant of the piece it replaces.
- **Master Classes**: Warlord (Warlust — on a hit, ATK ▲ INT ▲ SPD ▲; a repeating card may move one
  step a firing, so it widens rather than doubles), Bastion (Bulwark — Provoke and DEF ▲▲, 5 Charges;
  Wisdom off-Mind is a pinned decision, so it guards Defense alone), Strategist (Grand Design — a
  partner entering beside it gains 40 Mana).
- **A student who left the roster**: the next rung goes to whoever takes it, who becomes the student.

## What it reverses

- **The Mentor in acts 1–3 and the Tutor in act 4 as a forced single tile** (`splicedRowType`).
- **The Academy as a forced single tile every act** (`docs/academy.md`), and "four Classes a run".
- **The act shape**: Act 4 gains the capstone beat between the Guild Hall and the Guardian.
- **Uniques are Guardian-only** (`src/data/equipment.ts`): the weapon patrons and the Forgemistress
  are a second source.

## Engine shape (proposal)

- `PatronDefinition` in `src/data/patrons.ts`: id, title, name, `hasStudent`, and five rungs, each a
  list of existing reward verbs — grant or lift an item, teach a move, grant a passive, teach a Class,
  and *replace an id with another* for rung 5. A rung that wants more extends the vocabulary.
- `RunState.trust: Record<patronId, number>`, `RunState.students: Record<patronId, rosterEntryId>`
  and `RunState.promise: { patronId, seats } | null`, rolled from the seed so a replay is the same run.
- The seat draw reads all three; the capstone row reads `trust`. On the tile, Trust is a quiet row of
  pips; the rung it pays is named in the preview.

## Open questions

- **A third placement.** Recommended: a "patron visits" weight in `REWARD_WEIGHTS`, one patron against
  the two rewards beside it — no new row, and the run's RNG bonus meeting.
- **How rungs 1–4 scale.** Recommended: the act sets the size, Trust sets the kind.
- **Students under permadeath** (Cycle II on). A student lost takes the chain and the capstone with it
  — or the patron takes a new student at the next meeting, a rung down.
- **A student's item and the overwrite** (`docs/gear-absorption.md`, 2026-10-15): if a patron's Sword
  is overwritten, the chain has nothing to grow. Either a patron item cannot be overwritten, or
  overwriting it ends the chain.
- **The first seat's pool.** It decides the Promise and meets the Act 1 Skirmish.
- **The Tutor.** Whether it becomes a reward-pool node beside the Mentor, or retires.
- **A patron who joins the Collection.** Clearing a run that holds a patron's capstone could unlock
  that patron as a hero — Slay the Spire's character unlocks — which keeps them unrecruitable inside a
  run. Each one is a whole hero to author (line, grades, schedule, innate, three paths with art,
  signature), so it would be a few chosen patrons, not all.
- **Deferred until played:** a Tavern *Letter of Introduction* (Hades' Keepsake) and joint meetings
  for two patrons at Trust 3 (Hades' Duo boons).
- **The sim pilot** needs a Trust policy — focus or spread — and what it measures is directional.

## Art

A patron is one keeper-header figure and one map tile, plus an icon for each Unique it gives. Seven
patrons at about 25 generations each is ~175 on the hero recipe.
