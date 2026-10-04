# titan-eyes.md — The true final boss: the Titan's Eyes

> Module of the Titanpact `/docs` suite. Companion to `lore.md` (which owns why the Titan
> cannot take the field and what the Herald is), `run-loop.md` §4/§6 (the finale as structure)
> and `combat.md` (the Pact Clock). **DECIDED and BUILT** (2026-09-16, reshaped 2026-09-18, per
> user direction). **§10 is the rule in force:** the Herald and the Eyes are ONE fight in two
> phases, the Herald warded while its company stands, the Eyes met once — wide — under a field of
> the Titan's own, and the Titan rising mid-fight. §3, §6 and §7.2–7.3 describe the first,
> two-fight build and are kept only as pointers. The four-act re-fit (2026-10-02,
> `xp-overhaul.md` §5) moved the numbers again: Eyes Int 115 / 85 with HP kept at 810 / 945, the
> Herald's Attack and Intelligence −20, `WITHERING_GAZE_FRACTION` 0.04. Still open: the sim's
> Regard reads (§8).

---

## 1. The ask

> *Design the true final boss: the Titan's eyes, which have shown up on the title screen and the
> run-start animation. The player has to defeat them twice, essentially. Unique mechanics about
> gazing at a party member which indicates a powerful attack incoming. Mono-Ancient. After
> knocking both out they start the 2nd phase where they are more powerful.*

What the ask fixes:

- **They are a PAIR.** The title screen draws two eyes over the ridge (`titanArt.tsx` `EYES`); the
  run's cold open (`TitanWakeScreen`) is one of them opening. The last fight is 2v2 in the only
  sense the game has ever meant it.
- **The gaze is a TELEGRAPH.** A powerful attack the player is told about a turn early, aimed at
  one named hero, is a decision made with full information. The boss's power is in the number;
  the fight's interest is in what you do about knowing.
- **Two phases, same fight** — a KO taken early is a KO carried. ("Defeat them twice" became the
  Herald, then the Eyes, §10.)

## 2. Fiction — what the Eyes are

`lore.md` §7: the Titan never takes the field; the Herald is its hand and its voice, sent through a
breach in the seals. The Eyes are the second thing that fits through a breach that size: **not the
body — the regard.** The seals that still hold keep the Titan where it is. They do not stop it
looking.

So the finale is three beats:

1. **The Herald** walks, at the front of what the lands turned — one Late Titanspawn per broken
   seal.
2. The Herald falls, and the Titan **turns to look**. Its two Eyes open — wide, the title screen's
   `wide` state (`figurePrimitives.ts makeEye`).
3. **The Eyes close.** *You put it on the ground, and it names you* (`lore.md` §4) — and a Titan is
   on the ground when it has been made to look away.

**Three cinematic beats frame it, all presentation, none a decision:**

- **The Herald walks** (`HeraldScreen`), before the fight: the Endbringer on the Titan's hide
  (`TitanBody`) growing out of the distance, `entrance.dread`, then a caption and a button.
- **The Titan rises** (`TitanRiseScreen`), now played OVER the fight as the Left Eye's arrival
  (§10.2 item 3): the title screen's own figure climbs into the frame from below under an
  escalating rumble, lands with one jolt and the lids open all the way.
- **The Titan is bound** (`TitanBoundScreen`), the moment the Eyes close, ahead of the level report
  (`FightScreen`'s `cinematicWin` skips the result overlay on that one win): the head goes down the
  way it came, then the title screen's own seal (`SealArt.tsx`) turns in over the black, its sigils
  re-light one warden at a time, and the rings lock. Then the champion's hall (`ChampionScreen`).

`lore.md` carries the two lore lines this moved: the Herald walks and the Eyes look, and nothing
that is not a piece of the Titan is mono-Ancient.

## 3. Structure — where the fight sits

**Superseded by §10.2 item 1.** The first build was a third node (`muster → finale → titan`) with
a free mend between; the finale is now `muster → finale`, one fight, and nothing mends between the
phases.

## 4. The two combatants

**The Left Eye and the Right Eye** (the title screen's names), authored in `data/enemies.ts`, both
mono-**Ancient**, never recruitable. **Symmetric bodies, asymmetric kits**: both hold **Gaze** and
**Regard** (§5); the rest of each kit is a role.

| | Left Eye | Right Eye |
|---|---|---|
| Role | The one that hurts | The one that holds |
| Beside the gaze | **Archon Blast**, **Erode** (−Def / −Wis on both — the softening before the Regard) | **Forgotten Curse**, **Lidded** (Shield on both Eyes, off Defense — an Eye closing halfway) |
| Reads as | the striker | the wall that makes the striker safe |

Ancient's attacker row is empty on the chart (`lore.md` §2 — *a seal is not a weapon*), so the Eyes'
damage is carried by base power and Intelligence alone. The Titan does not have a type advantage
over anyone. It has a number.

**Stat lines** as shipped: HP 810 / 945, Intelligence 115 / 85 (`data/enemies.ts`). Attack 40 on
both is deliberate: nothing they do is physical. Each holds the two Gaze passives (§10.2 item 4).
The Eyes are the first enemies to hold innate passives.

## 5. The gaze — the mechanic

**Beheld** (`statuses.ts`): no magnitude, `clearsOnSwitch: true`, duration 2 ticking at round end —
the Gaze's round and the whole of the next, so the telegraph is on the board through one full
command phase. **Not consumed by the strike**: two Eyes may Regard one mark in a round, which is the
trap. Displayed as the Titan-eye glyph.

**Gaze** — Ancient, **priority +1**, mana 20, `singleEnemy`, applies Beheld and nothing else. It goes
first so the mark is on the board before the player's actions resolve.

**Regard** — Ancient, magical, base power **160**, mana 60, `singleEnemy`,
**`requiresTargetStatus: 'Beheld'`** (no legal target, no declaration). A hit for every passive and
for the Shield pipeline.

What the player can do about a Beheld hero, every one of it existing mechanics:

| Answer | What happens | Cost |
|---|---|---|
| **Switch it out** | Beheld clears; Regard has no legal target — the Eye Gazes again, a turn lost to the Titan | the switch-in eats the round; lock-in takes it away late |
| **Shield it** | Regard is a hit; the pool takes it first | a cast |
| **KO the Eye first** | the strike never comes | needs the damage; Lidded makes it dear |
| **Heal through it** | one large hit | Wisdom |
| **Daze the Eye** | flinch cancels the Regard | Speed |
| **Provoke** | **taunt wins**: the pull lands the Regard on the taunter (`gateYieldsToRedirect`, set on Regard alone) | a cast, and the taunter takes it |
| **Take it** | survivable once; two Regards in a round on one hero are not | — |

**The AI's one generic rule:** *a move whose target gate is open outranks the move that opens it*
(`WEIGHT_GATE_OPEN`); Gaze is filtered as inert by the rider-redundancy check when its target is
already Beheld.

The phase-2 escalation of the first build (Stare marking both, Glare) was deleted with the wide
pair (§10.2 item 1).

## 6. Phase 2 — the mechanism

**Superseded by §10.2.** The phase mechanism is the generic `reserves` phase list
(`Squad.reserves`, `Combatant.reservePhase`, `replacementCandidates` in `switching.ts`): a body of a
later phase enters only once nothing of an earlier phase stands, and a phase's pair walk on together.
The Pact Clock counts from the phase (§10.2 item 5). Why two bodies rather than a revive or HP refill:
"more powerful" is then authored per stat and per move, not a multiplier the sim cannot see.

## 7. Decided (2026-09-16, per user direction)

1. **Names: Left Eye / Right Eye.** The title screen's.
2. ~~A free mend between the Herald and the Eyes~~ — **superseded by §10**: one fight, nothing given
   back at the boundary.
3. ~~Phase 2 escalates the gaze: Stare marks both~~ — **superseded by §10**: the Eyes are met once.
   Beheld still breaks on a switch.
4. **No Unblinking — Daze stays an answer.** No status-immunity vocabulary was built.
5. **Taunt wins** (`MoveDefinition.gateYieldsToRedirect`, on Regard alone; every other gated move
   keeps the locked order — gate after redirect, a pull onto an ungated hero fizzles).
6. **The Clock** — counts from the phase since §10.2 item 5.
7. **The win beat:** the Titan goes back to sleep for another thousand years, and the heroes are
   celebrated — `TitanBoundScreen`, then `ChampionScreen` (each hero presented in the recruit
   fanfare's rings, then the whole roster in a row), then the summary.

## 8. Phases

Phases 1–3 (content, structure, presentation) are **done**: `test/titanEyes.test.ts`; the Eyes as
figures (`guardianFigures.ts titanEye`); **the arena as the Titan's hide** (`TitanBody.tsx`, drawn
whenever the enemy side holds an Eye or the Herald — *the entire battlefield is the Titan's body*);
**a knocked-out Eye stays on the field, shut** (`CombatantCard`'s `closed` pose).

**Phase 4 is open:** the sim's Regard reads — how many Regards land versus are dodged by a switch
versus shielded. A Regard that is *always* dodged is a telegraph with no teeth; one that is *never*
dodged is a number. (The pilot never dodges a Beheld hero — it switches on matchup — so a player who
uses the telegraph does better than any figure below.)

## 9. Build notes

- **Beheld is not consumed by the strike** — left in on purpose as the double-Regard trap.
- **Lidded is strong as authored.** Its Shield scales off a Defense of 120+ and stacks additively: a
  Right Eye left alone reaches ~300 of Shield. A dial, not a bug.
- **The Eyes punish a dumped Wisdom** — the existing formula doing what it does. Noted for the
  balance pass.
- The first two-fight build measured 61.5% of the finale's arrivals cleared at the Eyes after a
  second tuning pass (the first draft was a wall no roster failed; the first bump cleared 24%).

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

1. **One fight, two phases.** `finaleMap` is `muster → finale`. The enemy side is the Herald and the
   seals' Late spawn (phase 0), then the Eyes (phase 1). `Squad.reserves` is an ordered list of
   phases; `replacementCandidates` lets a body in only when nothing of an earlier phase stands, and
   only the NEXT phase when the field is empty — generic, and `test/titanEyes` proves it past two.
   Wounds, mana, knockouts and stat modifiers all carry across the boundary, and **nothing is given
   back at it** — a mid-fight revive was tried and dropped (§10.3). The wide pair (`leftEyeWide` /
   `rightEyeWide`, Stare, Glare) were cut; the fielded pair are drawn WIDE.
2. **The Herald's Standard.** `PassiveDefinition.wardedWhileCompanyStands` (`engine/combat/ward.ts`):
   while any standing ally of the owner's phase or earlier is on its side — **field or bench** —
   every move the far side aims at it turns away on Barrier's terms (`MoveGuarded` with a
   `passiveId`), and any non-positive status from the far side is refused. Bench included so the
   Herald falls last: an active-only ward left it bare for the back half of a round its escort died
   in. A single-target picker skips a warded foe; a spread lands on the spawn alone. The Pact Clock
   and a self-cost go through. Read live off the board.
3. **The cinematic is the Left Eye's arrival.** `entrances.ts cinematicEntranceFor` → a `cinematic`
   beat that `FightScreen` plays as `TitanRiseScreen` over the field through `overlayHost()`,
   holding playback whatever the Auto keys, its own tap skipping it. The fall it answers is the
   Herald's, which the ward guarantees is the last of its phase.
4. **Withering Gaze** (`fieldEffects.witheringGaze`, `drainsPercentMaxHp`): every active combatant
   not of an exempt type (`['Ancient']`, the Titan's own pieces) loses `WITHERING_GAZE_FRACTION` of
   max HP at each round end, on the Pact Clock's terms (direct, no Shield, no reaction pass, the
   bench out of it). Set by two innate Eye passives: **The Gaze Falls** on `SwitchedIn`, and **The
   Gaze Returns** on `RoundEnded` with `everyNRounds` = 3. Re-setting the active field never
   refreshes, so the Gaze lapses after five and returns on the next third round; a field of the
   player's own is overwritten one to three rounds later. The one field with no Herald, rider or
   reader — the Titan's, never a hero's. **5% at §10's build, 4% since the four-act re-fit**; a
   tenth measured as the Eyes phase's whole margin. *Why this shape:* felt at the first tick, a
   quarter of a hero over a phase, composing with the Regard instead of duplicating it — where an MP
   Regen ×0 or heal-suppression field bites only some builds, and a Beheld that survives a switch
   removes the fight's one clean counterplay.
5. **The Pact Clock counts from the phase** (`CombatState.phaseStartedRound`, `pactRoundOf`). A
   ~25-round fight under a clock that starts at 30 would read as a mutual wipe, so each phase is
   bracketed on its own.
6. **The numbers the merge moved** (at §10's build): the Herald's Oblivion 120 → 90 and Erode −20 →
   −15; the Eyes' HP ×1.5 (540 → 810, 630 → 945) so the phase lasts, and Int −20 to pay for it, since
   a roster arrives at them worn. The four-act re-fit then took Int −20 again and the Herald's
   Attack/Intelligence −20, keeping the HP (status note above).

### 10.3 Measured (600 runs, seed 1, chart pilot; five acts)

| Shape | Herald phase | finale cleared | full-clear |
|---|---|---|---|
| Two fights, the free mend between (pre-§10) | 92.4% | **57.6%** | 20.2% |
| One fight, THREE phases, ward + Gaze 10%, nothing at the boundary | 77.1% | 2.4% | 0.8% |
| … the fallen standing back up at each Eye phase (the revive, reverted) | 77.1% | 40–53% | 14–19% |
| One fight, TWO phases, ward + Gaze 10% | 77.1% | 32.9% | 11.5% |
| … Gaze 5%, Oblivion 90, Erode −15 | 83.3% | 47.6% | 16.7% |
| **… + Eyes HP ×1.5, Int −20 (shipped)** | **82.4%** | **41.9%** | 14.7% |

Knockouts carrying through the phases were the wall, not HP — standing the fallen back up recovered
47–53%, which read as a patch, so it was dropped. With two phases the same carry costs about fifteen
points against the old corridor, which the Gaze's fraction, the Herald's two move numbers and the
Eyes' Intelligence share between them. The ward is the Herald phase's 92 → 82. Under the four-act
re-fit the finale measured 74.4 / 97.3% (chart / skilled, `xp-overhaul.md` §5). The dials are
`WITHERING_GAZE_FRACTION`, the Herald's Oblivion and Erode, and the Eyes' lines.

### 10.4 Named consequences

- The Herald's **Erode** softens the roster for the Eyes as well; stat modifiers persist by the
  locked rule.
- `lockInThreshold` derives from the side's size, so the enemy's larger side locks later (the AI
  never reads it); the player's six still lock at 3 — and a knockout in the Herald phase is a
  knockout for the Eyes.
- `HeroDefinition.passiveIds` on the Eyes is innate and in no pool.
- "Defeat them twice" (§1, §7.3) is reversed: the Eyes are met once, wide. The single mark and its
  switch answer are the whole telegraph.
- **The Eyes are not scouted the first time through** (per user direction): a later phase's bodies
  are listed only once the profile has cleared a run (`Profile.runsCompleted`), and the finale
  tile's dossier names the Herald and its company alone.
- **The Revive is usable in a fight** (`run-loop.md` "Consumables"): the sim's pilot spending what it
  has left at the finale took it 41.9 → 48.6%.
