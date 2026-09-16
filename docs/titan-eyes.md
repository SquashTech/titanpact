# titan-eyes.md — The true final boss: the Titan's Eyes

> Module of the Titanpact `/docs` suite. Companion to `lore.md` (which owns why the Titan
> cannot take the field and what the Herald is), `run-loop.md` §4/§6 (the finale as structure)
> and `combat.md` (the Pact Clock). **DECIDED and BUILT, phases 1–3, 2026-09-16, per user
> direction** — §7 carries the seven decisions, §9 what the build found and measured. Phase 4 (the
> sim's four reads) is open.

---

## 1. The ask

> *Design the true final boss: the Titan's eyes, which have shown up on the title screen and the
> run-start animation. The player has to defeat them twice, essentially. Unique mechanics about
> gazing at a party member which indicates a powerful attack incoming. Mono-Ancient. After
> knocking both out they start the 2nd phase where they are more powerful.*

Three things the ask already fixes, and that the rest of this doc is built on:

- **They are a PAIR.** The title screen draws two eyes over the ridge (`titanArt.tsx` `EYES`, one
  at x=94 tilted 7°, one at x=272 tilted −7°); the run's cold open (`TitanWakeScreen`) is one of
  them opening. A pair is the doubles format made literal — the last fight is 2v2 in the only
  sense the game has ever meant it.
- **The gaze is a TELEGRAPH.** A powerful attack the player is told about a turn early, aimed at
  one named hero, is a decision the player makes with full information — which is what the whole
  game is (no accuracy stat, every move lands). The boss's power is in the number; the fight's
  interest is in what you do about knowing.
- **Two phases, same fight.** "Defeat them twice" is one encounter with a mid-point, not two
  nodes — a KO taken in phase 1 is a KO carried into phase 2, and that is the cost the phase
  structure charges.

## 2. Fiction — what the Eyes are

`lore.md` §7 (rewritten 2026-09-16): the Titan never takes the field; the Herald is its hand and
its voice, sent through a breach five-sixths open. The Eyes are the second thing that fits
through a breach that size: **not the body — the regard.** The sixth seal holds the Titan where
it is. It does not stop it looking.

So the finale is three beats, and the third is the one the title screen has been showing all
along:

1. The five broken seals return unsealed, and **the Herald** walks (the existing finale fight).
2. The Herald falls, and the Titan **turns to look**. Its two Eyes open on the Threshold — the
   `TitanWakeScreen` beat played at the scale of the sky, both eyes this time.
3. **The Eyes close.** Putting them out is the last thing the binding asks: *you put it on the
   ground, and it names you* (`lore.md` §4) — and a Titan is on the ground when it has been made
   to look away.

Phase 2 is the eyes going **wide**: the title screen's own `stare` → `wide` progression, the halo
the eye carries in every figure in the game (`figurePrimitives.ts makeEye` — `wide` is the state
with the red bloom). Half-lidded first, because the Titan is not yet paying attention; wide after
both are put out, because now it is.

Two lore lines move, and should be edited when this is built rather than left to drift:

- §7 "the Herald is the only part of the Titan that can be put down" → the Herald is the part
  that *walks*; the Eyes are the part that *looks*. Both can be put down; nothing else can.
- §8 rule 3 "nothing else in the game is mono-Ancient — the Endbringer is the only one" → the
  Herald and the Eyes are the Titan's own pieces, and mono-Ancient is what marks a piece of the
  Titan. Nothing that is not one is ever mono-Ancient.

## 3. Structure — where the fight sits

The finale act's map (`src/run/map.ts finaleMap`) is two nodes, `muster → finale`. This adds a
third: **`muster → finale → titan`**, the Eyes' own node, entered when the Herald's fight is won.

- **A separate fight, not a bench entry** after the Herald. A fight is atomic and replayable
  (`docs/tutorial.md`, the save's map checkpoint), and the Eyes opening is a beat that wants
  the screen — a card sliding in from the bench is the wrong size for it.
- **The player fields the run's six**, as the finale does (`run-loop.md` §6: the finale is a
  6v6, lock-in at three KOs). The enemy side is **two active and two in reserve** — 6 v 2+2.
  No escorts, no unsealed Guardians: the Eyes alone, so the fight is legible as the pair.
- **Wounds.** HP persists across an act's nodes (`run-loop.md` "Wounds", `WALK_FLOOR` 25%), so
  the Eyes are entered carrying whatever the Herald cost. That is either the fight's difficulty
  dial or a cheap wall — **decide** (§7). The alternatives: a free mend between the two (the
  Titan's regard "holds you up"), or a Rest seat between them the player can decline.

## 4. The two combatants

Two authored enemies in `data/enemies.ts`, both mono-**Ancient**, `starter: false`, never
recruitable, held by a new `finaleEyes` lookup beside `finaleEnemies` so `generateFinaleEncounter`
stays what it is. Names are the title screen's: **the Left Eye** and **the Right Eye** — or
**Sinister** and **Dexter**, the heraldic words for left and right, which read as names and say
that the pair is a coat of arms (a Guardian's is a *seal*; the Titan's is its *device*).
**Decide** (§7).

**Symmetric bodies, asymmetric kits.** Two identical enemies are the least interesting doubles
pair the game can field; two that share the gaze and differ in what rides beside it are a pair.
Both hold **Gaze** and **Regard** (§5); the rest of each kit is a role:

| | Left Eye | Right Eye |
|---|---|---|
| Role | The one that hurts | The one that holds |
| Beside the gaze | **Runic Blast**, **Enfeeble** (the Endbringer's softener: −Atk/−Int on both) | **Forgotten Curse**, **Lidded** (new: Shield on both Eyes, off Defense — an Eye closing halfway) |
| Reads as | the striker | the wall that makes the striker safe |

Ancient's attacker row is empty on the chart (`typechart.ts`; `lore.md` §2 — *a seal is not a
weapon*), so every Ancient move is neutral into everything, and the Eyes' damage is carried by
base power and Intelligence alone. That is correct: the Titan does not have a type advantage
over anyone. It has a number.

**A passive each, and one shared** (data, `passives.ts`, in no Boon pool — Evolution/Class
exclusivity rules apply):

- **Unblinking** (both): cannot be Dazed. An eye does not flinch. *Needs status-immunity
  vocabulary the engine does not have — the one engine addition in this doc that is not
  strictly required; without it, Daze is a legitimate answer to the Regard, which is maybe
  fine (§7).*
- **Lidded** is a move, not a passive, so it costs the Right Eye a turn.

**First-pass stat lines** (the champion convention, `CHAMPION_GRADES` all E, level from the
node — but the Eyes are the run's ceiling, so the lines are authored high and the level buys
little):

| | HP | Atk | Def | Int | Wis | Spd | Mana | MPR |
|---|---|---|---|---|---|---|---|---|
| Left Eye | 540 | 40 | 105 | 155 | 105 | 92 | 220 | 28 |
| Right Eye | 630 | 40 | 125 | 125 | 125 | 82 | 220 | 28 |
| Left Eye, wide | 680 | 40 | 115 | 190 | 115 | 102 | 260 | 32 |
| Right Eye, wide | 790 | 40 | 145 | 150 | 145 | 92 | 260 | 32 |

(The lines as shipped after the second tuning pass, §9; Regard 160, Glare 205. The first draft —
480/560/600/700 HP, Int 140/110/170/130, Regard 150, Glare 190 — measured as a wall no roster
ever failed.)

Attack 40 on all four is deliberate: nothing they do is physical, and a dumped stat is what a
specialist looks like. Speed 90/100 for the reason the Endbringer's is 95 — the fastest hero is
90, so the wide Eyes outrun everything but a priority bracket, and the half-lidded ones do not
quite. **Every number here is a placeholder for the sim** (§6).

## 5. The gaze — the mechanic

Two moves, one status, and nothing in the engine that does not already exist for the first
version.

**Beheld** — a new status (`statuses.ts`): `boolean` shape, no magnitude, **`clearsOnSwitch:
true`**, cleared at the end of the round after it lands if not consumed (`timer`, duration 1 —
see `reference-status-duration-is-per-application`: a timer with no authored duration fires
the round it lands, so this one is authored at 1 so it lives through the NEXT round's
declaration). Displayed on the hero's card as the eye's own glyph, and voiced *"The Left Eye
fixes on Valor."*

**Gaze** — Ancient, magical, `kind: 'buff'`, **priority +1**, mana 20, `target: singleEnemy`,
`statusApplication: Beheld`. Nothing else. It goes first so the mark is on the board before
the player's actions resolve — the telegraph is visible for the whole of the next command
phase, which is the point.

**Regard** — Ancient, magical, base power **160** (phase 2 **Glare**, 205), mana 60,
`target: singleEnemy`, **`requiresTargetStatus: 'Beheld'`** (the hard targeting gate already in
`statusEngine.ts statusGatedTargets` — no legal target means the move cannot be declared) and
**`detonatesStatus: 'Beheld'`** (the mark is consumed by the strike). A Regard is a hit for
every passive and a `'hit'` for the Shield pipeline.

What the player can do about a Beheld hero, every one of it existing mechanics:

| Answer | What happens | Cost |
|---|---|---|
| **Switch it out** | Beheld clears on switch; Regard has no legal target and cannot be declared — the Eye Gazes again, a whole turn lost to the Titan | the switch-in eats the round; lock-in (3 KOs in a 6v6) takes this away late |
| **Shield it** (Bastion, Vigil, Rampart…) | Regard is a hit; the pool takes it first | a cast |
| **KO the Eye first** | the strike never comes | needs the damage, and the Right Eye's Lidded makes it dear |
| **Heal through it** | the number is large but it is one hit | Wisdom |
| **Daze the Eye** (if Unblinking is not built) | flinch cancels the Regard | Speed |
| **Take it** | a Late hero at par survives a 150-power neutral hit from Int 140 with room; two Regards in a round on one hero do not | nothing — and that is the trap the phase-2 Stare sets |

Provoke: a taunter redirects a `singleEnemy` move onto itself (`applyProvokeRedirect`), and the
gate filters to Beheld holders — **the order of the two is an engine question**. Proposed: the
gate wins (an Eye cannot be made to look at what it is not looking at), so Provoke is not an
answer to the Regard, only to everything beside it. Pinned by test either way.

**The AI needs one generic rule** to play this, and it is a rule the AI should have had anyway:
*a move whose target gate is open outranks the move that opens it.* Today `pickAiAction` weighs
a neutral damage move and a useful status move the same (`WEIGHT_NEUTRAL`), so an Eye with a
Beheld hero in front of it would Gaze again half the time. The fix is data-shaped: when a
declarable move carries `requiresTargetStatus` and has a legal target, its weight is multiplied
(the same dial `WEIGHT_SUPER` uses, so it is *usually* the strike, as a super-effective option is
usually the pick — an Eye that always fires is as readable as one that never does). Gaze itself
is filtered as inert by the existing rider-redundancy check when its target is already Beheld.

**Phase 2 escalates the gaze, not just the number.** The wide Eyes' Gaze is **Stare**: `target:
bothEnemies` — it marks **both** active heroes, and the two Eyes then Glare on the same round.
The switch answer still exists, but the player has two marks and two switch-ins, and lock-in is
closer. Alternatives named in §7: Beheld survives a switch in phase 2 (removes the counterplay
— probably wrong, it turns a decision into a dice roll), or the wide Eyes gain a priority bracket
on Glare (removes the KO-first answer).

## 6. Phase 2 — the mechanism

The phase transition is **forced replacement from the bench** — mechanics the engine has had
since the Guardian rode the bench (`enemyGen.ts appendFinalEnemy`): the two wide Eyes sit on
the enemy bench, and when an active Eye falls, the bench fills the slot. One rule is missing:
today a bench entry replaces the FIRST faint, and phase 2 must not start until BOTH are down.

**New engine vocabulary, small and generic: a `reserve` bench entry enters only when the
side's field is empty.** `Squad.reserveIds` beside `benchIds`; `switching.ts`' forced
replacement skips reserves while any active ally is alive; `sideDefeated` (`FightScreen`)
already counts every combatant on the side, so the fight does not end at the phase boundary.
The view keys the phase beat off the reserves' `SwitchedIn` — no new event.

Why not a revive or an HP-refill primitive: "defeat them twice" is two bodies, not one body
twice, and two bodies are pure data. The wide Eyes are separate `HeroDefinition`s with their
own lines and kits, so "more powerful" is authored per stat and per move rather than being a
multiplier the sim cannot see.

**The Pact Clock.** `run-loop.md` §6 already names the rule for the Herald's 6v6 and leaves it
unmeasured: *the Endbringer's entry starts the clock.* This fight has the same shape one step
further out, and the same rule fits: **the clock starts when the wide Eyes enter.** Phase 1 is
a puzzle the player is allowed to solve slowly; phase 2 is on the clock, and the Titan's
weight arriving as the Titan looks at you is the fiction the Clock was written for (`lore.md`
§3). Needs the Clock to take a start round from the encounter rather than a constant —
`pactClock.ts` takes a `PactClockConfig` (`DEFAULT_PACT_CLOCK`, start round 30); the encounter carries its own config, the default everywhere else.

**Kill order inside a phase.** Both Eyes must fall before the reserves enter, so the last
living Eye of phase 1 fights alone against up to two heroes — a 1v2 the AI plays fine. The
wide pair enter TOGETHER at full HP, which is the beat.

**Measurement before numbers** (`feedback-sim-results-are-directional`): the sim has a finale;
give it the third node and read (a) how often phase 2 is reached, (b) how often it is cleared,
(c) how many Regards land versus are dodged by a switch, versus shielded, (d) rounds in each
phase against the Clock. A Regard that is *always* dodged is a telegraph with no teeth; one
that is *never* dodged is a number.

## 7. Decided (2026-09-16, per user direction)

1. **Names: Left Eye / Right Eye.** The title screen's.
2. **A free mend** between the Herald and the Eyes (`mendRoster` on the finale's win).
3. **Phase 2 escalates the gaze: Stare marks both.** Beheld still breaks on a switch; Glare
   has no priority. ("Go with your gut.")
4. **No Unblinking — Daze stays an answer.** No status-immunity vocabulary was built.
5. **Taunt wins.** A Provoke pull lands the Regard on the taunter although it is not Beheld
   — `MoveDefinition.gateYieldsToRedirect`, set on Regard and Glare alone; every other gated
   move keeps the locked order (gate after redirect, a pull onto an ungated hero fizzles).
6. **The Clock is untouched** — round 30 from the fight's first round, as everywhere.
7. **The win beat: the Titan goes back to sleep for another thousand years, and the heroes are
   celebrated** — `ChampionScreen`, a Pokémon-style champion's hall: the sleep card, then each
   hero presented in the recruit fanfare's rings, then the whole roster in a row; then the summary.

## 8. Phases

| # | What | Status |
|---|---|---|
| 1 | Content: `titanEyes` (four `HeroDefinition`s, `data/enemies.ts`), Beheld, Gaze / Regard / Stare / Glare / Lidded, `gateYieldsToRedirect`, the AI's gate-open weight (`WEIGHT_GATE_OPEN`); `test/titanEyes.test.ts` | **Done** |
| 2 | Structure: `Squad.reserveIds` → `Combatant.reserve` → `replacementCandidates` (the one replacement rule, every site reads it); the `titan` node on the finale corridor; `generateTitanEncounter`; the free mend; the sim's third node | **Done** |
| 3 | Presentation: the Eyes as figures (`guardianFigures.ts titanEye` — the title's lens, half-lidded then wide); dramatic entrances for all four; Beheld's glyph (the map's Titan-eye lens, mythic red) and the blocked Regard's line; the map tile, dossier and node facts; `ChampionScreen` | **Done** |
| 4 | Sim: the four reads in §6 (phase 2 reached / cleared, Regards landed vs dodged vs shielded, rounds a phase against the Clock); then the numbers | Open |

## 9. Build notes and the first measurement

- **Reserves enter together.** The first draft let a reserve in only when the field was empty,
  so the first wide Eye in closed the door on the second. The rule is now *a reserve enters
  once nothing but reserves stands* — the pair walk on side by side, which was the beat.
- **Beheld is not consumed by the strike.** Two Eyes may Regard one mark in a round; that is the
  phase-2 trap and it was left in. Duration 2 ticking at round end = the Gaze's round and the
  whole of the next.
- **Lidded is strong as authored.** Shield 40 base scales off a Defense of 120–140 (×1.7–1.9)
  and STAB, and stacks additively cast on cast: a Right Eye left alone reaches 300 of Shield.
  The sim's pilot plays through it; a naive one does not. A dial, not a bug.
- **The Eyes one-shot a dumped Wisdom.** Int 140 into a Wisdom of 40 is a 3.5× ratio on a neutral
  60-power Runic Blast with STAB — ~300 — before a Regard is ever fired. The existing formula
  doing what it does; the Herald has the same Intelligence. Noted for the balance pass.
- **Measured, three passes (the chart pilot; `feedback-sim-results-are-directional`):**
  - As first authored (300 runs): 59 reached the Eyes, **all 59 cleared**, 21.5 rounds, 59.6% HP
    left — the run's longest fight and never its loss; full-clear 19.7%, unmoved by the node.
  - Per user direction — *the run should be able to end there* — a first bump (HP 600/700/760/880,
    Int 170/140/210/170, Regard 170, Glare 220; 400 runs): 91 reached, **24.2% cleared**, 8.4%
    HP left; full-clear 5.5%. Too far.
  - Halfway back, the lines in §4 (600 runs): 135 reached, **61.5% cleared** (83), 21.5 rounds,
    **20.0% HP** left; full-clear **13.8%** (was 19.7). The Eyes now end roughly two runs in five
    that reach them — the hardest single fight in the run, under the Act 4 Guardian's 70% and
    over nothing. **Shipped.** The pilot never dodges a Beheld hero (it switches on matchup, and
    Ancient is neutral), so a player who uses the telegraph does better than this figure.
