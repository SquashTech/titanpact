# The Tutorial — one fight, then a short road

> **STATUS: BUILT (2026-11-13, per user direction).** Replaces First Light (`docs/first-light.md`):
> its eleven lessons, the Learned screens, the screen lessons and the Ascent. Content
> `src/data/tutorial.ts`, the road `src/run/tutorial.ts`, the screen `src/view/story/TutorialScreen.tsx`,
> pinned round by round in `test/tutorial.test.ts`.

## 1. Why

First Light taught each concept well and broke the flow: every concept ended on a Victory / Learned
stop. The tutorial is now **one long scripted fight** that teaches by playing, then a short road
and an open fight. Reference: Pokémon's first rival battle and Hearthstone's first missions (one
fight, the hand on the one right play), Into the Breach (a small board set up so the answer is there
to find).

## 2. Decisions (2026-11-13, per user direction)

- **One fight carries the concepts**, larger than 2v2 so there is room for a bench, switching and
  replacements. **Each round has one prompt**, tapped through. Otherwise the hand points and every
  other control is locked (`guidedAction`).
- **No variance in the scripted fight.** The one exception to the locked Variance term
  (`StoryFight.fixedRolls` → `CombatState.fixedRolls`): every hit lands at the range's middle
  (`FIXED_VARIANCE` = 0.925) and nothing crits, so the numbers are still the formula's and the
  physical/magical round stays honest. The target cards forecast the one number. Both RNG draws still
  happen, so the stream stays in step.
- **The party leaves the fight hurt**, Cairn down, so the Rest stop pays for itself.
- **The type roll is in** (`TYPE_ROLL`): a hero of every type, the lead pick's first page.
- **The fight opens on a guided Lead Pick** (`StoryFight.guidedLeads`).
- **The victory teaches Equipment and Gems** on the real item and Gem screens, one prompt each.
- **The Ascent is deleted, and the First Light name with it.** The tutorial is *How to Play* on the
  sky: one star in the clasp at the ring's foot. The Reference's book was renamed **Rules** so the two
  never share a name. Tapping the clasp plays the tutorial again.
- **It pays 100 Stardust, then forces one Starfall** (the existing tour: Observatory, Call to the
  Stars), then the player is on the title to start their first run.
- **Nothing teaches after it.** Winning retires the three first-time tips. A run's screens, and a map
  tile's tap preview, carry the rest.
- **A Recruit stop before the open fight**, where the player picks any base hero: the first real
  choice in the game.
- **The party mixes gameplans:** physical (Cinder, Raiju), magical (Cairn, Solace), a spread caster
  and a healer.

## 3. The flow

1. **The fall** plays on a new account's first sky (Blip's `firstSky` beat), then the tutorial starts
   on its own, opening on the Welcome.
2. **The scripted fight** (§4), 4v6.
3. **Victory:** the item who-screen (*Gear goes to one hero, for good.*), then the Gem screen (*A Gem
   raises a stat and fills a Mastery pip.*). Both guided, Cinder takes a Blazing Sword, Raiju an
   Attack Gem and Solace an Intelligence Gem.
4. **The map**, one prompt. The road has three stops: **Recruit → Rest → Fight** (`roadMap`).
5. **Recruit:** any base hero the party does not hold, at level 5 (`TutorialRecruitScreen`).
6. **Rest:** the run's own Rest screen; wounds mend and Cairn stands up.
7. **The open fight:** five heroes against Cubling, Pebbling, Gleamling and Whimling at level 4 on
   their own kits and the enemy AI. Real rules, variance back. A loss replays it.
8. **Win:** the title. The Stardust flies to the Observatory, the ring closes, and the tour pulls one
   Starfall.

A tutorial left partway starts over from the top; the title's press says *Begin*.

## 4. The scripted fight

**Party** (base heroes, four types, level 5; only Cairn's innate fires):

| Hero | Type | Plays | Holds |
|---|---|---|---|
| Cinder | Fire | physical hitter, Burn | Singe, Set Alight |
| Raiju | Storm | fast physical | Thunderclap |
| Cairn | Stone | magical spread; Waystone shields its partner | Tremor |
| Solace | Light | magical support | Glimmer, Mend |

**Foes, six**, in the order they enter, each on one plain move: **Sproutling, Puddling** (leads,
level 4), **Kindlehide** (Fire) and **Arcling** (Storm), **Mesmerid** (Mind, a high-Wisdom wall) and
**Ravager** (Beast, level 9). Each knockout brings the next foe in, which sets the board for the next
idea.

| Round | Prompt | The hand | What happens |
|---|---|---|---|
| Lead pick | *Every hero has a type. There are fourteen.* (the type roll), then the arrows | Cinder, Raiju | |
| 1 | *Pick a move, then who it hits. The fastest hero acts first.* | Singe → Sproutling, Thunderclap → Puddling | Raiju first; both fall to 2× hits. |
| 2 | *Switch in a hero who takes the hit better. Stone shrugs off Storm and Fire.* | Raiju → Cairn; Singe → Kindlehide | Cairn takes both hits at ½. |
| 3 | *Some moves hit both foes at once.* | Singe → Kindlehide; Tremor | Tremor drops both. |
| 4 | *Defense stops physical hits. Wisdom stops magic.* | Singe → Mesmerid; Tremor | Singe 71 against Tremor 27 on Mesmerid. |
| 5 | *Moves cost Mana. Out of it, Rest fills it back up.* | Cinder Rests; Tremor | Cinder holds 15, every move costs 20. |
| 6 | *A Burn keeps hurting after the hit.* | Set Alight → Mesmerid; Tremor | Ravager drops Cairn first; the Burn tick finishes Mesmerid. |
| — | *A hero who falls is out for the fight. Send in another from the bench.* | Solace | The replacement. |
| 7 | *Some moves heal an ally.* | Mend → Cinder; Singe → Ravager | Ravager left at 67. |
| 8 | *Finish it your way.* | nothing | The player finishes Ravager. |

**Changed from the draft in building it:** Immolate is out (Cinder's Intelligence is 25, so a tripled
Immolate read as a small number; the Burn finishing a foe is the beat instead, as First Light's Burn
lesson had it). Passives get no prompt: Waystone announces itself by name every round from round 2,
and the open fight's own kits fire theirs. Kindlehide and Mesmerid replaced Emberling and Ingot, so
the spread lands on two foes the Singe could not drop alone, and the physical/magical gap is 2.6×.

## 5. Open — for the designer

1. **The move card still prints Singe's 30% crit** in the scripted fight, where nothing crits. The
   target forecast is fixed; the card badge is not.
2. **Merge** isn't taught. A second drop at the victory could show it, at one more tap.
3. **The level report** is skipped at the victory (the scripted fight pays no XP).
4. **The open fight's foes** are on their own kits (Cubling's Venom Bite poisons). Plain hits only, as
   the old open fight had, is a one-line change if it reads as too much.
