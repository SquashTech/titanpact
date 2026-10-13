# Patrons

**Decided 2026-10-13, per user direction. Not built.** The Mentor's seat and the Academy's seat
stop being forced single tiles and become **patron seats**: two NPCs offered, one taken. Every NPC
is a patron with a **Trust** ladder, and Trust is how its rewards grow over a run. A player who
commits to one patron early is promised its capstone; a player who spreads gets a strong run
without one.

## Decided

1. **Every NPC is a patron.** No one-shot "wanderers": the Mentor, the Academy's Class grant and
   every new NPC are the same kind of thing — a name, an optional student, and five rungs.
2. **Trust is per patron, per run, 0–5, and never decays.** Taking a patron raises its Trust by one
   and pays the rung it reached. Skipping one costs only the meeting not taken.
3. **The seats are row 2 and row 6 of every act** (today's `SPLICED_ROW` and `ACADEMY_ROW`,
   `src/run/map.ts`), each a pick 1 of 2. Eight seats a run.
4. **Odds rise with Trust and never guarantee** (option B, per user direction). A patron the player
   has taken is drawn at a seat more often the higher its Trust — Hades' god weighting: early
   choices shape the build without fixing it. The weight is the dial; the target is set by
   playtest, not here.
5. **The Promise.** The patron taken at the run's **first seat** (Act 1, row 2) is guaranteed one
   of the two tiles at three of the seven seats left before the capstone, chosen off the run seed at
   the moment it is taken and never shown. Meeting it at all three reaches Trust 4, so a focused
   player's capstone is certain. Only the first pick is promised — two promises would decide six of
   the seven remaining seats.
   - The odds of (4) still run at every other seat, so the promised patron can appear off-schedule
     too, and the player cannot tell a promised visit from a lucky one.
   - Skipping a promised visit spends it. The odds may still bring the patron back.
   - A patron that reaches Trust 4 early releases its unspent promised seats to the normal draw.
6. **Trust reaches 4 on the road, and 5 only at the capstone.** A patron at Trust 4 stops appearing
   at seats, which spreads the player's later meetings on its own.
7. **The capstone: one a run, right before the Act 4 Guardian** (per user direction, moved from the
   Vigil so the reward has two fights to show itself — the last Guardian and the finale). It is the
   fifth meeting: the patron at Trust 4 comes and pays rung 5, a reward screen with no decision. Two
   patrons at Trust 4 → the beat asks which one comes, its one decision. None at 4 → no beat.
8. **Rungs 1–4 carry the power; rung 5 carries the memory** (per user direction: "very cool and
   memorable, but not so insane that they feel almost required"). Each of rungs 1–4 is worth about a
   good reward-row tile on its own. Rung 5 is a transformation — named, visible, changing how a hero
   looks or plays — worth about one more rung of power. The authoring test: **two patrons at Trust 3
   are about as strong as one at Trust 5.** Because rung 5 only ever lands in Act 4, it is balanced
   for exactly two fights. The Act 4 Guardian and the finale are never tuned around a capstone,
   since a spread run has none.
9. **Classes are optional** (per user direction). The Academy's grant becomes a patron (the
   Headmaster, below) drawn like any other, so a run can end with no Class at all.
10. **A patron's moves and passives are in no other pool**, the rule Classes already follow
    (`docs/academy.md`): no level-up pool, no Tutor pool, no Boon pool. A patron move wears its
    holder's innate primary type (`typeFollowsUser`), as a class move does.

## What it reverses

- **The Mentor in acts 1–3 and the Tutor in act 4 as a forced single tile** (`splicedRowType`).
- **The Academy as a forced single tile every act** (`docs/academy.md`), and with it "four Classes a
  run".
- **The act shape**: Act 4 gains the capstone beat between the Guild Hall and the Guardian.
- **Uniques are Guardian-only** (`src/data/equipment.ts`), if the Blademaster ships: his blade is a
  second source.

## Engine shape (proposal)

- `PatronDefinition` in `src/data/patrons.ts`: id, name, `hasStudent`, and five rungs, each rung a
  list of existing reward verbs — grant or lift an item, teach a move, grant a passive, pay XP, teach
  a Class. No bespoke logic; a rung that wants one extends the vocabulary.
- `RunState.trust: Record<patronId, number>` and `RunState.promise: { patronId, seats } | null`,
  rolled from the seed so a replay is the same run.
- The seat draw reads both; the capstone row reads `trust`. On the tile, Trust is a quiet row of
  pips; the rung it pays is named in the preview.

## First patrons (drafts — every rung is open)

**The Mentor** (no student). The Act 1 wall leans on its XP, so it belongs in the first seat's pool.

| Rung | Pays |
|---|---|
| 1–2 | XP to one hero, by act (today's 800 / 3,000 / 6,000) |
| 3 | XP to two heroes |
| 4 | The next fight's MVP bonus doubled |
| 5 | One hero reaches its next schedule entry at once |

**The Headmaster** (the Academy, no student).

| Rung | Pays |
|---|---|
| 1 | A Class, three rolled, for a hero without one (today's Academy) |
| 2 | Another Class |
| 3 | The Class is picked, not rolled |
| 4 | Another Class |
| 5 | A mastered Class: one hero's Class verb upgraded, as a mastered innate is |

**The Blademaster** (has a student). The first patron the user named.

| Rung | Pays |
|---|---|
| 1 | A Sword for his student, sized to the act, through the item who-screen |
| 2 | A Slice move |
| 3 | Edge, as a passive |
| 4 | The Sword a tier up, and a second Slice move |
| 5 | The Sword becomes his Unique blade, in place — no socket question, and a Unique already cannot merge |

**The Stormcaller** (has a student). Makes one field the run's identity; every verb exists.

| Rung | Pays |
|---|---|
| 1 | Pick a field: its Herald for the student |
| 2 | The field's Early rider move |
| 3 | The field lasts longer when your side sets it |
| 4 | A second hero carries the Herald |
| 5 | Your field is up from round 1 of every fight |

**The Hexwright** (has a student). Hades' Chaos: each rung lays a curse and a blessing on the
student, both deepening; rung 5 lifts the curse and keeps the blessing. Built on the Burden and
curse vocabulary.

**The Tutor.** Whether it stays as a patron, and whether its "pick a Late move" needs Trust at all,
is open.

**Held back, each against a written rule:**
- **The Rival**, a patron you fight — a fourth fight in an act, against the run-length trims.
- **The Beastwarden**, who invests in the companion — `docs/companion-call.md` says the companion
  takes no XP, pips, offers or items.
- **The Alchemist**, potions — the flask faucet is deliberately a drop, never a node.
- **The Mercenary**, a lent hero — "there is no exception to the cap".

## Open questions

- **A third placement.** Recommended: a "patron visits" weight in `REWARD_WEIGHTS`, one patron
  against the two rewards beside it — no new row, and the run's RNG bonus meeting.
- **How rungs 1–4 scale.** Recommended: the act sets the size, Trust sets the kind. Trust-only with a
  cap at act + 1 is the blunter alternative.
- **Students under permadeath** (Cycle II on). A student lost takes the chain, and the capstone, with
  it — or the patron takes a new student at the next meeting a rung down.
- **The first seat's pool.** It decides the Promise and meets the Act 1 Skirmish, so every patron
  that can appear there needs a rung 1 that pays at once.
- **The roster.** How many patrons, and each one's five rungs.
- **The Mentor's XP sizing.** 800 / 3,000 / 6,000 was sized so a hero taking every Mentor reaches 30
  (`docs/mentor.md`); a patron Mentor meets less often.
- **Where the capstone sits.** Its own row between the Guild Hall and the Guardian, or inside the
  Guild Hall's row.
- **Deferred until played:** a Tavern *Letter of Introduction* (a chosen patron guaranteed at the
  next seat — Hades' Keepsake), and joint meetings for two patrons at Trust 3 (Hades' Duo boons).
- **The sim pilot** needs a Trust policy — focus or spread — before anything it measures means
  anything, and what it measures is directional.

## Art

A patron needs a keeper figure for its screen and a map tile. The Mentor and Tutor have both
(`art/map-nodes/`); the Academy is a building. Each new patron is about one 48px figure and one tile
— on the hero recipe, 5 generations a roll.
