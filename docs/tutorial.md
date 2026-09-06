# tutorial.md — The Scripted First Run

> Module of the Titanpact `/docs` suite. Companion to `run-loop.md` (whose §1 act shape this
> narrows for exactly one act), `lore.md` (whose premise the intro speaks aloud) and
> `leveling-and-ranks.md` (whose curve the payout table is tuned against).
>
> Signed off 2026-09-05, per user direction. The tutorial is **content plus one flag**, not a
> mode: a tutorial run is a normal run with Act 1 pinned, and nothing survives the first
> Guardian except the profile bit saying it happened.

---

## 1. What it is

The first run on an account is **scripted through Act 1**, presented as **Valor talking to the
player**. Valor and Fang are forced as the starting pact — partners already a year into walking
toward Wild's Edge — and the act's map is narrowed to **one node per row** so Valor can walk the
player through every stop and no lesson is lost to routing.

From the Act 1 Guardian onward the run is an ordinary run: the map branches, the payouts roll,
and nobody narrates.

**Trigger.** `Profile.tutorialDone`, set when the Act 1 Guardian falls — not when the run
starts. A tutorial the player wiped in is therefore offered again, which is the whole reason it
is not just `runsStarted === 0`. A pre-tutorial profile with a cleared run decodes as done, so a
veteran is never handed one. The Title screen's Dev menu carries **Replay Tutorial**, which
bypasses the profile without rewriting it.

**Losing.** A wipe ends the run like any other. There is no retry: the tutorial's job is to
teach what the game is, and "losing is free" is the one thing that would be a lie by Act 2.

## 2. The corridor

`TUTORIAL_ROW_TYPES` (`src/run/tutorial.ts`) is the standard eight-row Mentor-act shape from
`run-loop.md` §1 with **every choice row narrowed to a single node**. The 1-of-3 choices *inside*
a reward node are untouched — the choosing is the lesson; the routing is not.

| Row | Node | What Valor teaches |
| --- | --- | --- |
| 0 | Monsters | doubles, targeting, Speed, Mana, Rest, reading a resist |
| — | *post-fight gates* | Gems and relics · equipment and the no-stash rule · XP as a pot |
| 1 | Equipment | comparing three pieces; rarity as a budget |
| 2 | Mentor | Classes: permanent, one per hero, four on the road |
| 3 | Skirmish | type advantage both ways, **physical vs magical**, the forced Recruit Contract |
| 4 | Relic | team-wide vs. per-hero |
| — | *post-fight gate* | **Evolution** (the focus lock puts Valor at level 5 here) |
| 5 | Monsters | the bench, switching, the lock-in rule, flying the caster |
| 6 | Guild Hall | gold: a hero, gear, or a contract |
| 7 | Guardian | the faction-escort shape, the Ancient wall, **reading the number not the colour**, the Pact Clock |

Every node type appears **exactly once**, which is what lets a beat be addressed by node type
alone (`map:<type>`); a test pins that.

## 3. The type lesson the act is built around

Act 1's Guardian is the **Goblin Lord, Beast/Ancient**. The types strong against Beast are
**Frost, Storm and Mech** — and those are exactly the three types strong against **Iron**
(Valor) and **Beast** (Fang).

So the Skirmish fields two **Frost** heroes. The same move reads two ways on one screen (double
into Fang, half into Valor), and the pair the player is being hurt by is the pair a Recruit
Contract can claim — because it is what the thing at the end of the valley fears. *What beats
you is what beats what is ahead* is the whole act in one sentence, and the player is made to
feel it before they are told it.

**The Guardian is shaped like every other Guardian.** It fields two of Wild's Edge's own
**Goblin basics** with the Lord on the bench, because that is what a `boss` node is everywhere
since 2026-09-06 (`run-loop.md` "The Guardian's escorts"). The tutorial only names *which* two,
so Valor can be specific: the **Grunt** is a Beast for the caster to double into, the **Warrior**
is Iron so claws barely mark it. Killing one brings the Lord out, which is where the Ancient
wall gets explained with the wall in front of them.

An earlier pass scripted hero escorts — Stone for Valor, Nature for Fang — to stage a
super-effective read for each starter. That is gone: no Goblin typing is weak to both Iron and
Beast, and a tutorial must not teach a fight the rest of the run never presents. The lesson it
was staging turned out not to need staging (§5).

Two tests pin what is left: the Skirmish pair must threaten a starter *and* not be resisted by
the Guardian, and every scripted Guardian escort must be in the Location faction's `basicIds`.

## 4. What the act refuses to let you skip

A lesson the player is allowed to decline is a lesson some players never see, so Act 1 removes
the option rather than advising against it (2026-09-06, per user direction). Three locks, all in
`TUTORIAL_LOCKS`, each lifting the moment its lesson lands, none surviving Act 1.

| Lock | What it closes | Lifts when |
| --- | --- | --- |
| `focusHeroId` | Every Level Up card but Valor | Valor takes an Evolution |
| `recruitHeroId` | The Skirmish contract is one offer, and the screen has no leave button | It is signed |
| `fieldHeroId` / `fieldAtNodes` | Flurry is pinned to an ACTIVE slot at the warband and the Guardian | Act 1 ends |

**The Evolution needed no lock of its own.** `LevelUpScreen` already refuses to bank or
auto-close while one is pending, and `EvolutionScreen` has no decline. What was missing was a
guarantee the player *reaches* one — which is what the focus lock is. With every point landing
on one hero the fork arrives on a schedule: 4 XP takes Valor to level 3, the Skirmish's 8 takes
her to 5, so the Evolution surfaces on the same level-up screen that hands over Flurry. A test
walks that arithmetic against the payout table and asserts *which node* it lands on, so retuning
either table fails loudly rather than quietly moving the beat.

The focus lock has one consequence worth knowing: the screen now closes on a pool the
locked-out heroes could still buy. `LevelUpScreen.leave()` therefore banks any spendable
remainder on the way out — without that, App's `levelUpPending` gate re-opens the screen
forever. Outside a lock the auto-continue only ever fires on an empty pool, so the bank is inert.

## 5. Physical vs magical, and why the caster is not optional

The damage formula has two pipelines — Attack against Defense, Intelligence against Wisdom —
and the split is **invisible until the player owns one of each**. A draft cannot be relied on to
hand them a caster, so the tutorial hands them one and does not ask.

**Flurry** is the roster's least ambiguous magical specialist: **25 Attack against 80
Intelligence**, and her only damage move is magical. She is also Frost, so she is still the
Guardian answer §3 is built on — one recruit, two lessons.

**The proof is the Goblin Lord himself, and it needed no staging.** He is authored at
**75 Defense against 60 Wisdom**, so the two pipelines already read differently on him. Through
the real damage pipeline, on base kits:

| | Move | Pipeline | Damage |
| --- | --- | --- | --- |
| Valor | Iron Fist | physical, 60/75, ×0.5 | **20** |
| Fang | Claw | physical, 90/75, ×0.5 | **30** |
| Flurry | Rime Wind | magical, 80/60, ×1.0 | **42** |

The caster wins **without being strong against him** — Frost doubles into Beast and the Ancient
half halves it straight back, so her type multiplier is a flat 1. She is ahead purely on the
stat ratio. That is the cleanest possible statement of the lesson: *type advantage is one term
in the sum, not the sum.*

So the cues stopped naming a staged wall. `boss:escorts` sets up the warband, and `boss:ancient`
fires when the Lord walks on and tells the player to hold each move over him and read the number
rather than the colour. Neither line names which of our heroes is holding it, because Flurry
holds one active slot and the player picks the other — Fang may be on the bench.

A test recomputes the table above through `calcDamage` and fails if the caster ever stops
out-damaging both starters against the champion. It runs on base kits, because Valor's Evolution
is the player's choice and Storm Lash would otherwise beat her.

## 6. Payouts

`TUTORIAL_PAYOUTS` replaces the roll for Act 1's four fights — the tutorial has to arrive at its
Guardian with a specific amount of power, not a distribution of it.

| Node | XP | Gold |
| --- | --- | --- |
| Monsters (opener) | 4 | 25 |
| Skirmish | 8 | 30 |
| Monsters (warband) | 10 | 65 |
| Guardian | 4 | — |

**22 XP before the Guardian** against the **10** it costs to take one hero from level 1 to the
Evolution at 5. The focus lock (§4) makes that a schedule rather than a hope: every point lands
on Valor, so 4 puts her at level 3 and the Skirmish's 8 puts her at 5. Two tests hold it — one on
the floor, one on which node the fork actually lands after.

**160 gold at the Guild Hall** (40 starting + 125) against a 50-gold hero, a 30-gold Rare and a
20-gold contract. Valor tells them to buy the body.

## 7. How the script is wired

Content is `src/data/tutorial.ts` — dialogue, encounters, payouts, mid-fight cues. Mechanism is
`src/run/tutorial.ts`, which imports none of it (the same arrangement `events.ts` uses). This is
the file a designer edits; nothing else has to change to add, cut or rewrite a line.

**Out-of-fight beats** are addressed by a flat key namespace: `map:<nodeType>`,
`reward:<nodeType>`, or one of `TUTORIAL_SCREEN_BEAT_KEYS`. `App.tsx` resolves the current
screen to a key; `tutorialBeat` answers with a beat or nothing. Progress lives in
`RunState.tutorialSeenBeatIds`, so a beat survives a reload and never repeats. Two tests close
the drift: every key App can raise has a beat, and every beat names a key something raises — a
beat addressed to a moment nothing produces would otherwise just silently never play.

**Mid-fight cues** are `TutorialFightCue`s, matched at the top of every command phase against a
small live context (round, out-of-mana, locked in, lowest HP fraction, who is on the enemy
field), and never once a fight is decided. Order in the array is priority order. `node` may name
several fights, for a lesson that turns on a condition rather than a moment — Rest cannot be
promised to any one fight. Cue progress is **FightScreen-local**, not run state: a fight is
atomic and a reload replays it.

**A scripted fight has to survive its own dialogue.** The Goblins are authored as fodder, and
the opener was ending in round 1 — Iron Fist reads `40 x (60 Atk / 25 Def) x 1.25` = ~120 into a
100 HP Grunt — which took every round-2 lesson with it, and (before the guard above) left a cue
landing on top of the victory panel. `TutorialEncounter.statGrants` is the lever: the opener
carries **+25 HP and +35 Defense**, most of it Defense because the *ratio* was what ended the
fight, not the HP. That takes Valor from 2.4x down to ~1.0x and the fight from one round to
three or four. A test recomputes it through the real damage pipeline at maximum variance and
fails if any starter can one-shot an opener enemy.

**Gating.** The scripted *mechanics* (map, encounters, payouts) check `isTutorialAct` — the flag
**and** Act 1 — so Act 2 onward carries no extra branch. The *dialogue* checks the flag alone,
so a lesson Act 1 never reached (an Evolution nobody could afford) still lands the first time it
applies. Every id is one-shot, so nothing repeats either way.

## 8. Open questions

- **No skip.** The dialogue cannot be dismissed wholesale; the Title's Replay entry is the only
  control over it. If playtesting says the second read is a wall, a Skip that keeps the curated
  map and drops the lines is a small addition to `TutorialOverlay`.
- **Act 1's Guardian is unmodified**, escorts included — the script names two of the faction's
  basics rather than inventing any, so the fight is the one every other act presents. Measured
  over 20k simulated runs the Wild's Edge Guardian sits at 75.5% (`run-loop.md`), which is a
  comfortable place for a tutorial to end. Whether the arriving power level clears him reliably
  for a first-time player is still a playtest question, and the two tables in §6 are the knobs.
- **Three locks may be two too many.** The forced recruit and the pinned slot both survive into
  fights the player might reasonably want to arrange themselves, and a second-time player will
  feel every one of them. `TUTORIAL_LOCKS` is one object; dropping a lock is deleting a field.
- **Fang barely speaks.** Four lines in the whole run. Whether the partnership reads as a
  partnership on that budget is a writing question, not a systems one.
