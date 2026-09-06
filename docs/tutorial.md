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
| 3 | Skirmish | type advantage both ways, focus fire, the Recruit Contract |
| 4 | Relic | team-wide vs. per-hero |
| 5 | Monsters | the bench, switching, the lock-in rule |
| — | *post-fight gate* | Evolution |
| 6 | Guild Hall | gold: a hero, gear, or a contract |
| 7 | Guardian | the escorts, the Ancient wall, the Pact Clock |

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

The Guardian's two escorts are then one each: **Stone** for Valor's Iron and **Nature** for
Fang's Beast. "The stone one is mine; the green one is yours." Both are super-effective reads
the player has by then been taught to look for, and clearing them is what brings the Lord off
the bench — which is where the Ancient wall gets explained, with the wall in front of them.

Two tests pin this: the Skirmish pair must threaten a starter *and* not be resisted by the
Guardian, and each starter must have an escort its own domain is strong against.

## 4. Payouts

`TUTORIAL_PAYOUTS` replaces the roll for Act 1's four fights — the tutorial has to arrive at its
Guardian with a specific amount of power, not a distribution of it.

| Node | XP | Gold |
| --- | --- | --- |
| Monsters (opener) | 4 | 25 |
| Skirmish | 8 | 30 |
| Monsters (warband) | 10 | 65 |
| Guardian | 4 | — |

**22 XP before the Guardian** against the **10** it costs to take one hero from level 1 to the
Evolution at 5, so following Valor's advice (pour it into one hero) reaches the fork with room
to spare, and spreading it evenly still gets somebody there. A test asserts the floor, because
Evolution is the one lesson that cannot be scripted into a screen — the player has to be able to
afford it.

**160 gold at the Guild Hall** (40 starting + 125) against a 50-gold hero, a 30-gold Rare and a
20-gold contract. Valor tells them to buy the body.

## 5. How the script is wired

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
field). Order in the array is priority order. Cue progress is **FightScreen-local**, not run
state: a fight is atomic and a reload replays it.

**Gating.** The scripted *mechanics* (map, encounters, payouts) check `isTutorialAct` — the flag
**and** Act 1 — so Act 2 onward carries no extra branch. The *dialogue* checks the flag alone,
so a lesson Act 1 never reached (an Evolution nobody could afford) still lands the first time it
applies. Every id is one-shot, so nothing repeats either way.

## 6. Open questions

- **No skip.** The dialogue cannot be dismissed wholesale; the Title's Replay entry is the only
  control over it. If playtesting says the second read is a wall, a Skip that keeps the curated
  map and drops the lines is a small addition to `TutorialOverlay`.
- **Act 1's Guardian is unmodified.** Only the escorts are scripted — and they are the one
  place a Guardian still fields heroes rather than its faction (`run-loop.md` "The Guardian's
  escorts"). No Goblin typing is weak to both Iron and Beast, so the "one is mine, one is
  yours" lesson below cannot be taught out of the Wild's Edge roster; a scripted encounter
  therefore draws from `allCombatants` and names its own. Whether the arriving power
  level actually clears him reliably is a playtest question, and the two tables in §4 are the
  knobs.
- **Fang barely speaks.** Four lines in the whole run. Whether the partnership reads as a
  partnership on that budget is a writing question, not a systems one.
