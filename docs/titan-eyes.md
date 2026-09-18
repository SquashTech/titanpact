# titan-eyes.md — The true final boss: the Titan's Eyes

> Module of the Titanpact `/docs` suite. Companion to `lore.md` (which owns why the Titan
> cannot take the field and what the Herald is), `run-loop.md` §4/§6 (the finale as structure)
> and `combat.md` (the Pact Clock). **DECIDED and BUILT, phases 1–3, 2026-09-16, per user
> direction** — §7 carries the seven decisions, §9 what the build found and measured. Phase 4 (the
> sim's four reads) is open. **§10 (2026-09-18, per user direction) supersedes §3, §6 and §7.2:
> the Herald and the Eyes are ONE fight in two phases, the Herald is warded while its company
> stands, the Eyes are met once — wide, the phase-2 pair cut — set a field of the Titan's own,
> and the Titan rises mid-fight.** Where a line above disagrees with §10, §10 is the rule in force.

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

1. **The Herald** walks, at the front of what the five lands turned — one Late Titanspawn per
   broken seal (the finale fight; it fielded the five unsealed Guardians until 2026-09-17).
2. The Herald falls, and the Titan **turns to look**. Its two Eyes open on the Threshold — the
   `TitanWakeScreen` beat played at the scale of the sky, both eyes this time.
3. **The Eyes close.** Putting them out is the last thing the binding asks: *you put it on the
   ground, and it names you* (`lore.md` §4) — and a Titan is on the ground when it has been made
   to look away.

Phase 2 is the eyes going **wide**: the title screen's own `stare` → `wide` progression, the halo
the eye carries in every figure in the game (`figurePrimitives.ts makeEye` — `wide` is the state
with the red bloom). Half-lidded first, because the Titan is not yet paying attention; wide after
both are put out, because now it is.

**The corridor is framed at both ends and in the middle (2026-09-17, per user direction —
three cinematic beats, all presentation, none of them a decision):**

- **The Titan rises** (`TitanRiseScreen`), between the fifth socket's strike (`PactSealScreen`)
  and the Threshold's arrival card. The title screen's own figure — the brow, the two eyes
  (`titanArt.tsx`) over a skull that runs off the bottom, and the title's ridge with the four
  pactbearers on it for scale — climbs into the frame from below under a rumble that escalates
  with its height; it lands with one jolt and the lids crack to a slit. The eyes stay shut on the
  way up: a breach five-sixths open is wide enough to look through, not to walk through
  (`lore.md` §7), and the Eyes open on the Herald's fall, not here. Tap-anywhere skips, as the
  cold open does; `titan.stir` under it, `seal.shatter` on the landing, `titan.gaze` on the slit.
- **The Herald walks** (`HeraldScreen`), between the squad's confirm and the finale fight: the
  Endbringer on the Titan's hide (`TitanBody`, the arena the fight is about to be on) growing out
  of the distance at the size the fight cannot afford it, with `entrance.dread` as it comes, then a
  caption and a button into the fight. In the fight it stands at the front with the seals' Late
  spawn behind it; the beat is the thing that comes first.
- **The Titan is bound** (`TitanBoundScreen`), the moment the Eyes close, AHEAD of the level
  report and everything the fight pays (`FightScreen`'s `cinematicWin` skips the result overlay on
  that one win, so the collapse lands on the KO rather than on a spoils panel). Two halves: the
  head from the rise, eyes wide and the frame shaking harder than anything else in the game, goes
  out and goes down the way it came, one jolt as it lands; then, out of the black, **the title
  screen's own seal** (`SealArt.tsx`, the markup the title and this beat share) turns in over the
  black, its five sigils re-light one warden at a time (`seal.strike` each), and the rings lock
  (the launch's own spin-up, `pact.bind`). *The Titan is bound* is this screen's line; the
  champion's hall lost its sleep card to it and now opens on the first hero.

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
| Beside the gaze | **Archon Blast**, **Erode** (−20 Def / −20 Wis on both — the softening before the Regard; Runic Blast and Enfeeble until 2026-09-17, `authoring-moves.md` §10 "Ancient") | **Forgotten Curse**, **Lidded** (new: Shield on both Eyes, off Defense — an Eye closing halfway) |
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
   celebrated** — `TitanBoundScreen` (the collapse and the re-binding, 2026-09-17, §2) then
   `ChampionScreen`, a Pokémon-style champion's hall: each
   hero presented in the recruit fanfare's rings, then the whole roster in a row; then the summary.

## 8. Phases

| # | What | Status |
|---|---|---|
| 1 | Content: `titanEyes` (four `HeroDefinition`s, `data/enemies.ts`), Beheld, Gaze / Regard / Stare / Glare / Lidded, `gateYieldsToRedirect`, the AI's gate-open weight (`WEIGHT_GATE_OPEN`); `test/titanEyes.test.ts` | **Done** |
| 2 | Structure: `Squad.reserveIds` → `Combatant.reserve` → `replacementCandidates` (the one replacement rule, every site reads it); the `titan` node on the finale corridor; `generateTitanEncounter`; the free mend; the sim's third node | **Done** |
| 3 | Presentation: the Eyes as figures (`guardianFigures.ts titanEye` — the title's lens, half-lidded then wide); dramatic entrances for all four; Beheld's glyph (the map's Titan-eye lens, mythic red) and the blocked Regard's line; the map tile, dossier and node facts; `ChampionScreen`; **the arena as the Titan's hide** (`TitanBody.tsx`, per user direction — *the entire battlefield is the Titan's body*: plates seamed in arcs about a centre far below the frame, ember veins pulsing on a heartbeat, the brow a ridge across the top, drawn in place of the Location's scene whenever the enemy side holds an Eye — or the Herald, per user direction: both Threshold fights stand on the Titan); **a knocked-out Eye stays on the field, shut** (per user direction — `FightScreen` keeps the fallen Eye's card in its empty slot, `CombatantCard` draws it in the Eyes' own `closed` pose, a lid seam on the hide, until the wide pair replace it) | **Done** |
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

## 10. One fight: the Herald, then the Eyes (2026-09-18, per user direction)

### 10.1 The ask

> *Combine the Herald fight and the battle vs the Eyes into one long fight, with a cinematic
> where the Herald dies and the Titan rises up to attack the player. The Herald has a permanent
> Protect while a Titanspawn is next to him — once the 5th is knocked out they can go all-in.
> The Eyes fight starts with a field effect unique to the fight; for at least one turn the player
> should be in notable danger if they don't wipe it off with their own; the Titan re-applies it
> every ~3 turns. And crank the difficulty a bit.*


> Second pass, same day: *I don't love the forced revive between phases. Cut the 2nd Eye phase
> — the Herald + Titanspawn, then one phase against the Eyes. Bolster the Eyes' HP so it lasts
> a little longer, tone the Herald's moveset/damage down so the losses in that phase aren't so
> brutal. Make the sequence reasonable without mid-fight revivals.*

### 10.2 What was decided

1. **One fight, two phases.** `finaleMap` is `muster → finale`; the `titan` node is deleted.
   The enemy side is eight bodies: the Herald and the five seals' Late spawn (phase 0), then
   the Eyes (phase 1). `Squad.reserves` is an ordered list of phases; `Combatant.reservePhase`
   numbers them; `replacementCandidates` lets a body in only when nothing of an earlier phase
   stands, and only the NEXT phase when the field is empty (`switching.ts`) — the rule is generic
   and `test/titanEyes` proves it past two. The pair still walk on together. The free mend
   between the two fights is gone with the second fight; Wounds, mana, knockouts and stat
   modifiers all carry across the boundary, and **nothing is given back at it** (the second pass
   — a mid-fight revive measured as the only thing that made a third phase survivable, and it
   read as a patch). **The wide pair are cut** with the phase they were: `leftEyeWide` /
   `rightEyeWide`, Stare and Glare are deleted; the fielded pair are drawn WIDE, since the rise
   that brings them opens the lids all the way.
2. **The Herald's Standard.** `PassiveDefinition.wardedWhileCompanyStands`
   (`engine/combat/ward.ts wardOn`): while any standing ally of the owner's phase or earlier is on
   its side — field or bench; the Eyes waiting behind are a later phase and do not count — every
   move the far side aims at it turns away on Barrier's own terms (`MoveGuarded`, now carrying a
   `passiveId`), and any non-positive status from the far side is refused (a reaction passive, an
   Ice Shell's rider). **Bench included, not only the active partner** (per user direction):
   replacement happens after the round, so an active-only ward left the Herald bare for the back
   half of any round its escort died in, and let it die before the fifth spawn — which broke the
   beat the ask names. A single-target picker skips a warded foe (`selectableTargets`); a spread
   lands on the spawn alone. The Pact Clock and a self-cost go through, being neither a move nor
   an affliction. Read live off the board, never a status kept in step with it.
3. **The cinematic is the Left Eye's arrival.** `entrances.ts cinematicEntranceFor` → a
   `cinematic` beat (`buildBeats`) that `FightScreen` plays as `TitanRiseScreen` over the field
   through `overlayHost()`, holding playback however the Auto keys are set, its own tap skipping
   it; then the Eye's ordinary reveal beat. The rise moved off the fifth seal (`PactSealScreen`
   walks straight into the act now) and the lids open all the way at the top — the Eyes are the
   next thing on the field. The fall it answers is the Herald's, which the ward guarantees is the
   last of its phase.
4. **Withering Gaze** (`fieldEffects.witheringGaze`, `FieldEffectDefinition.drainsPercentMaxHp`):
   every active combatant not of an exempt type — `['Ancient']`, the Titan's own pieces — loses
   `WITHERING_GAZE_FRACTION` = **5%** of max HP at the end of each round, on the Pact Clock's terms
   (direct, no Shield, no reaction pass, the bench out of it), before the field's own countdown.
   Set by two innate Eye passives (`HeroDefinition.passiveIds`, the first thing to hold any): **The
   Gaze Falls** on `SwitchedIn`, and **The Gaze Returns** on the new `RoundEnded` hook with
   `everyNRounds` = 3. Re-setting the active field is a no-op that never refreshes, so the Gaze
   lapses after five and returns on the next third round; a field of the player's own is
   overwritten one to three rounds later. It is the one field with no Herald, no rider and no
   reader — the Titan's, never a hero's. A tenth was the first figure; it measured as the whole of
   the Eyes phase's margin (§10.3). *Why this over the alternatives:* an MP Regen ×0 field or a
   heal-suppression field is dangerous only to some builds and only over several rounds; a Beheld
   that survives a switch removes the fight's one clean counterplay. A twentieth of max on both
   actives is felt at the first tick, a quarter of a hero over a phase, and it composes with the
   Regard instead of duplicating it.
5. **The Pact Clock counts from the phase** (`CombatState.phaseStartedRound`, set by
   `performSwitch` when a later phase's first body enters; `pactRoundOf`). A ~25-round fight
   under a clock that starts at 30 is a mutual wipe waiting on a slow roster — which reads as a
   loss — so each phase is bracketed on its own, which is what §6 reached for. The view's warning
   reads the same round.
6. **The numbers the merge moved.** The Herald's Oblivion 120 → 90 and Erode −20 → −15 (the
   text always said −15): the Herald is the front of a fight the Eyes finish, and nothing mends
   after its phase. The Eyes' HP ×1.5 (540 → 810, 630 → 945) so the phase lasts, and Int −20
   (155 → 135, 125 → 105) to pay for it, since a roster arrives at them worn.

### 10.3 Measured (600 runs, seed 1, chart pilot; `scripts/sim`)

| Shape | Herald phase | finale cleared | full-clear |
|---|---|---|---|
| Two fights, the free mend between (pre-§10, same seed) | 92.4% | **57.6%** | 20.2% |
| One fight, THREE phases, ward + Gaze 10%, nothing at the boundary | 77.1% | 2.4% | 0.8% |
| … the fallen standing back up at each Eye phase (the revive, reverted) | 77.1% | 40–53% | 14–19% |
| One fight, TWO phases, ward + Gaze 10%, §4's Eyes | 77.1% | 32.9% | 11.5% |
| … Gaze 5% | 77.1% | 40.5% | 14.2% |
| … Gaze 5%, Oblivion 90, Erode −15 | 83.3% | 47.6% | 16.7% |
| … + Eyes HP ×1.5 | 83.3% | 36.2% | 12.7% |
| **… + Eyes HP ×1.5, Int −20 (shipped)** | **82.4%** | **41.9%** | 14.7% |
| shipped, Gaze back at 10% | 83.3% | 34.8% | 12.2% |

What the three-phase measurement found, and why the revive was tried and then dropped:
knockouts carrying through the phases were the wall, not HP — full HP and Mana at each boundary
recovered 2.4 → 11%, standing the fallen back up 47–53%. With two phases the same carry costs
about fifteen points against the old corridor, which the Gaze's fraction, the Herald's two move
numbers and the Eyes' Intelligence share between them. The ward is the Herald phase's 92 → 82: the
whole phase is played under Erode and Transfix instead of the Herald being focused down early.
Under the greedy pilot the finale is 85.5% (was ~90%). Every number here is directional
(`feedback-sim-results-are-directional`); the dials are `WITHERING_GAZE_FRACTION`, the Herald's
Oblivion and Erode, and the Eyes' lines.

### 10.4 Named consequences

- The Herald's **Erode** now softens the roster for the Eyes as well; the phases are one fight
  in every sense the engine has. Stat modifiers persist by the locked rule.
- `lockInThreshold` derives from the side's size: eight enemy bodies lock the enemy at 4, which
  the AI never reads (it only pivots); the player's six still lock at 3 — and a knockout in the
  Herald phase is a knockout for the Eyes.
- `HeroDefinition.passiveIds` is innate and in no pool; `test/roster` pins that no recruitable
  hero carries one — a hero's identity still lives in its Evolution and its Class.
- "Defeat them twice" (§1, §7.3) is reversed: the Eyes are met once, wide. The Stare that marked
  both heroes went with the phase; the single mark and its switch answer are the whole telegraph.
