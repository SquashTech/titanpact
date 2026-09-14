# mastery.md — Mastery: pips, the Scribe, and the signature

> **STATUS: DECIDED 2026-09-14 (per user direction, after a same-day draft on "fights survived"
> was playtested on paper and rejected — §0); NOTHING BUILT.** `CLAUDE.md` and `xp-overhaul.md`
> describe the game in force wherever a §8 phase has not landed; §8 is the route and §9 the list
> of sign-offs each phase spends — **check its Status column before assuming anything here is
> live.** Every number below is a first pass unless it says otherwise; the design is the shape,
> and phase 5 is where the numbers get set.

---

## 0. Why this exists

The XP Overhaul put moves, stats and the Evolution on one curve, and it worked for two of them.
Levels are roster-wide and automatic, so under it the Evolution is too: a hero reaches
`schedule.evolutionLevel` on the same fight every other hero at par reaches its own, fielded or
benched, and the screen that raises it is a consequence of nothing the player did. The Scroll
ladder it replaced was worse in every way but one — the player poured Scrolls into ONE hero and
CHOSE who turned and when. That control, and the tension of watching it come, is what the
schedule lost.

Three shapes were tried before this one, and each is worth a line so nobody tries it again.

- **Mana spent in fights.** Unbounded in rounds — mana available is `pool + regen × rounds` and
  nothing in the run charges for rounds, since HP restores between nodes — so it pays the
  heal-stall directly, and Rest (a skipped turn that refills the pool) is a second stall inside
  the first. A speed multiplier against it is a second dial fighting the first.
- **Fights fielded and survived** (+1 fielded, −1 KO'd, a per-hero threshold). The first draft of
  this doc. Rejected in a paper playtest the same day: once a fight is decided, optimal play is to
  switch the bench in and cast once each to lock their mark — a mop-up phase after every win that
  kills the combat flow. **Any per-fight reward keyed to who was on the field has that mop-up.**
  The family is wrong, not the number.
- **The Scroll ladder** (`growth-overhaul.md` §11–12). Killed by its screens, not its price:
  assign a Scroll, take a move offer, assign another, take another. Forty-seven decisions a run.

What survives from all three is the currency, stripped of everything that made it a screen: **a
Scroll does nothing but move a hero one pip closer to something.** Two quick taps and the player
is moving on, and the node they came from is one they wanted, because it means an Evolution
before the next big fight.

---

## 1. The rule this reduces to

> **Every hero has ten pips. Five is its Evolution; ten is its signature move. A Mastery Scroll
> is one pip, assigned the moment it is paid, to whoever the player says. Scrolls come from the
> map, never from a fight.**

No per-hero threshold to author, no price curve, no purse, no KO cost. The player's control is
*who*, on a screen that asks only that. Uniform 5 / 10 is a deliberate simplification: the
per-hero timing identity the level schedule carried (*evolves at 12* against *at 20*) moves off
the sheet and onto the **signature move itself** — the sheet reads *Signature: Lizard Rush*, and
that is the line a player reads before drafting.

**Fights pay XP, the map pays Scrolls.** Two currencies, two sources, no overlap. That sentence
is also why Ichor retires (§4): it was XP paid by the map, the one thing that broke it.

---

## 2. Pips and the who-screen

**Mastery** is an integer on `RosterEntry`, 0–10. Nothing happens at 1–4 or 6–9. Reaching **5**
raises that hero's Evolution screen; reaching **10** offers its signature move (§5). Both fire
**on the node that paid the pip**, not on the level-up report — the report goes back to offers
only, which is simpler than it is today.

**The who-screen** is Ichor's (`IchorNodeScreen`, renamed): every roster hero as a card, each with
a ten-pip row and markers at 5 and 10, a tap a pip. A tap that crosses a marker hands straight
off to the Evolution screen (or the signature's replace-or-decline) and comes back for the
remaining pips. A hero at 10 is refused, as Ichor refuses a hero at the cap. The screen collects
one thing, *who*, and the exciting decision — the Evolution's three paths — is the only other
thing that can appear on it.

**No purse.** A node's Scrolls are assigned on the node. The purse was the ladder's friction —
"can't afford the next rung yet", split-or-save arithmetic on every node — and a flat price is
the only price that keeps *a Scroll always does something the instant it lands* true. The one
edge case, "I'm about to recruit someone", is refused; that is what the shelf is for.

**Concentrating is dominant, and that is fine.** Mastery is a step function, so with a fixed
supply the player reaches the same number of milestones in any order — concentrating just
reaches the first one sooner. Spreading thin is a trap the pips teach in one node (three pips on
three heroes, nothing happened). The question a Scroll node asks is therefore never *split or
not*; it is **which hero's next step**, and that question has inputs the map supplies: the fork
previews the Elite's and Skirmish's typing, the Guardian's type is fixed by the Location, an
Evolution outranks a signature in raw power so the early nodes ask *who first* and the late ones
*which three*, and pips are at risk — a companion's die with it, a terminated hero's are gone
(strategic churn is a goal, and this is what it costs).

**The companion** eats pips like anyone: its tier-steps are Early → Mid at 5 and Mid → Late at 10,
in place of an Evolution and a signature. A KO takes its pips with it, the one place a Scroll can
be lost, and a real reason to hesitate over a mortal.

---

## 3. The three faucets

Each pays a different amount for a different price, and the two screens ask different questions.

| Faucet | Where | Pays | The screen asks | Price |
|---|---|---|---|---|
| **The Scribe** (forced) | A new row every act 1–5, between the second reward row and the Elite/Skirmish fork | **Pick TWO heroes; each takes 2** | *Who gets the ball rolling?* — breadth | A row of map time, two taps |
| **Scroll Cache** (optional) | The reward-row pool, in the seat and at the weight the Scroll Cache held before Ichor (46) | **3 Scrolls, divided freely** | *Who is closest to something?* — depth | The seat: an item, a Boon, a Forge not taken |
| **The shelf** | The Guild Hall and the finale's Vigil, flat gold, cap 2 a visit — a pure sink like potions | 1 Scroll each | the same, one at a time | Gold against recruits and gear |

**The Scribe seeds; the Cache and the shelf prioritise.** The Scribe's pick-two-get-two is what
keeps the forced beat from being "put everything on the carry" every act: it cannot be
concentrated, so it spreads four pips over the roster on a rhythm the player does not choose,
and the optional faucets are where the player chooses. Sits before the fork so the Evolution it
buys lands before the previewed Elite and the Guardian, and the preview informs the pick. A hero
at 9 takes 1 and the other is lost — the card says so; a hero at 10 cannot be picked.

**The Cache** is three taps on the who-screen, in any split. Weight 46 is where the Scroll Cache
sat before Ichor took its seat; the Drop's seat (14) retires and is not re-pointed.

**The shelf** replaces the Drops of Ichor the Guild Hall sold. A first-pass price of **25 gold**
(a potion is 20, a Drop was 35), two a visit.

### Supply

Demand is smaller than 6 × 10 looks. Recruits arrive with pips (§4) — a contract from Act 3 on
arrives evolved — so a roster with two mid-run recruits needs ~20–25 pips to evolve everyone, not
30, plus 5 a signature. **The target is every hero evolved and about three signatures a run,
~35–40 pips; 60 maxes the roster.**

| Source | Per run | Note |
|---|---|---|
| The Scribe | **20** | 4 an act × 5 acts, guaranteed; alone it evolves four heroes |
| Scroll Cache | ~10–12 at a half pick-rate; ~22 for a player who always takes it | 15 reward rows a run, the Cache in about half of them at weight 46 |
| The shelf | ~4–6 | ~4 visits, gold permitting |
| **Middle path** | **~35** | 45+ for a player who commits seats and gold to it |

Act 1 alone: the Scribe's 4 plus a Cache if it shows is enough for one hero to reach 5 before the
Act 1 Guardian, *by choice* — which is the lever the XP Overhaul's §10 named for the Act 1 wall
and never had a way to pull. The Cache's weight is the real dial: at 46 it is the second-commonest
seat on the map after equipment, so if signatures come too early or too rarely, the weight moves,
not the price.

---

## 4. Recruits, enemies and the companion — derived, not authored

Nobody is on a private model. A hero the player does not control reads its pips off the act the
way `guildHallLevel` reads the level curve:

> An enemy or a **contract** hero in act N holds `2 × N − 1` pips (1 / 3 / 5 / 7 / 9, the finale
> 10): the Scribe's pace for a hero it touched every act, less the pip this act has not yet paid.
> A **Guild hire** arrives one behind, `2 × N − 2` (0 / 2 / 4 / 6 / 8).

So every hero-pool enemy from Act 3 arrives **evolved** (exactly where `ENEMY_LEVEL_BY_ACT` puts
them today), the finale's carries its signature, a contract is always a pip ahead of a hire
(`test/recruitment.test.ts` gains the axis beside level, Evolution and kit), and *contract
finished, hire raw* is now true four ways. `rollLevelProgression` stops walking an Evolution entry
and reads the figure. The Titanspawn have no Evolution and no pips; their tiers are by act.

**Ichor retires.** Its two seats and its shelf were the Scroll Cache's, Lone Scroll's and
bundle's before it, and go back; its measured effect was nothing (`xp-overhaul.md` §8, phase 2:
13 levels-at-par a run moved full-clear by ~0); and it was the second aimed currency with the same
who-screen as Scrolls, which is one too many to teach. Levels stay roster-wide and automatic, the
cube stays, and a hero behind par still closes on it on its own (§2 of that doc) — the catch-up
Ichor was *also* for is the curve's job and was measured as such. This is its own phase (§8, 2)
so it can be vetoed without touching the rest.

---

## 5. The signature move

At **ten pips** a hero is offered its **signature move** — `HeroDefinition.signatureMoveId`, one
authored move per hero, the move that says what the hero *is* in one button. Riptide's **Lizard
Rush** is the template: 75 BP Water physical, Renew 25 to both allies, 45 mana — a solid hit plus
the thing the hero does. A verb, not a nuke; the damage formula is locked and the identity is in
the rider.

**Exclusivity, the Class-move rule's sibling.** A signature is in no type pool, no Mentor or Tutor
pool, no graft's `learnableMoveIds`, and no path's `unlocksMoveIds` — untiered the way a Class
move is. Authored at the hero's innate primary type, so STAB is guaranteed without
`typeFollowsUser`. Lizard Rush today fails this three ways (the Water pool,
`data/progression.ts:100`; two grafts' lists at `:801` and `:953`; Tidecaller's clause 5 at
`:663`) — it is the right *shape* and not yet a signature by the rule that makes it one. Phase 3
pulls it; §10 carries the Tidecaller question.

**Inside the cap.** `MOVE_CAP` is 4 and stays 4: the tenth pip's offer is replace-or-decline on
the who-screen, like a Class move at the rim. A fifth slot is a bigger power spike and breaks the
four-button read. "Decline your signature" is a sad screen and a real decision.

**Priced Late** (the ×0.75 re-price applies; floor 45). Not for the companion — a spawn line ends
at Late. Enemies hold one only at 10: the finale's hero-pool enemy, and a contract claimed there.

**35 to author** (Riptide's exists), on the Lizard Rush template. A slate's worth, and the most
identity a move can carry.

---

## 6. What the run feels like

Act 1: the Scribe, before the fork, pays Valor and Fang 2 each. A Cache shows in the next reward
row — three more on Valor and it turns on the spot, in front of the previewed Elite it now
counters. Or the Cache is passed for the item, and Valor turns in Act 2. The player chose.

Act 3: a contract hero arrived at 5, already turned. The Scribe's two picks are the two unevolved
heroes the player fields most; the Cache, when it shows, goes to the one the Guardian's type says.
The carry is at 7 and nobody has a signature yet.

Act 5: three heroes are at 8–9. The Scribe cannot finish more than two of them; the Cache and the
shelf decide the third, and the gold it costs is a recruit not bought. Whoever reaches 10 carries
its signature into the finale.

Every one of those beats is two or three taps on a screen that shows the pips lighting up, and
the only decision that ever pops over it is the one worth having.

---

## 7. What is deleted

- `LevelSchedule.evolutionLevel` and the `'evolution'` `ScheduleEntryKind`; `scheduleEntries` pays
  offers only; the companion's `'step'` entries move to pips. `DEFAULT_SCHEDULE` loses the figure;
  36 authored schedules lose theirs.
- The Evolution's raise from the level-up report (`levelUpFlow.ts`); `atEvolution` in its current
  form (it will stand a hero at 5 pips).
- The 10–24 Evolution window and its test in `test/moveTiers.test.ts`.
- The Dossier's "Level N" subhead on the Evolution tab.
- Ichor: `ichorReward`, `ichorDropReward`, `src/run/ichor.ts`, the shelf's Drops, `ICHOR_FIGHTS`
  (phase 2). `IchorNodeScreen` survives renamed as the who-screen.
- Lizard Rush's three pool memberships (§5).

Nothing else. Levels, XP, `L³`, the schedule's offers and bands, growth grades, both budgets,
Classes, Boons, Banners, items, the Clock, potions, the companion's mortality and the map shape
within an act (plus one row) are untouched.

---

## 8. Order of work

Sequenced so the tree is playable at every boundary. `SAVE_VERSION` bumps at each.

| # | Phase | Exit criterion | Status |
|---|---|---|---|
| 1 | **Mastery in.** `RosterEntry.mastery`; the who-screen (Ichor's, renamed, with the pip row); the **Scribe** row (`scribeReward`, forced, acts 1–5, pick two, +2 each); the **shelf** (Guild Hall and Vigil, 25g, 2 a visit); the Evolution raised at 5 from the node; `masteryForAct` for enemies, contracts, hires; the companion's steps at 5 / 10; delete §7's first four items. Ichor untouched — both seats stay. Tutorial re-checked (the Scribe with three heroes in a one-node-per-row act). | No reader of `evolutionLevel`; a run completable end to end; `test/recruitment.test.ts` pins contract > hire on pips. Measured against the XP Overhaul's phase-6 baseline (full-clear 57%, Evolutions 5.0 a run): Evolutions per run, "every hero evolved" %, the clock with one more row an act. | |
| 2 | **The Cache takes Ichor's seats.** `scrollReward` at 46; `ichorReward` / `ichorDropReward` / `ichor.ts` / the Drops deleted; the Drop's 14 retires. | No Ichor anywhere; the sim tallies pips by source. **Separable — veto here leaves phase 1 standing.** | |
| 3 | **The signature slot.** `signatureMoveId`; the tenth pip's replace-or-decline on the who-screen; the exclusivity test (no pool, no Tutor, no graft list, no path grant); Lizard Rush promoted and pulled from its three pools; the Tidecaller decision (§10); enemies at 10 hold it. | Riptide reaches Lizard Rush at 10 and nowhere else; the test catches a signature in any pool. | |
| 4 | **Author 35 signatures.** Parallelisable from 3; ships hero by hero (an unauthored hero's tenth pip pays nothing, which is what today pays). | Every hero has one, on the template — a hit or a verb at the hero's primary, Late-priced, never a bare nuke. | |
| 5 | **Re-fit.** Cache weight, shelf price, the Scribe's 2 + 2, `masteryForAct`, against the sim with a Scroll policy on the pilot (concentrate on the fielded; evolve first, then signatures; the Scribe to the two most-fielded unevolved) and `time.ts` pricing the two screens; then the Act 1 wall re-read. | ~3 signatures a run on the middle path, every hero evolved on the Scribe alone; the clock reported against the 77 / 53 / 32 baseline. Win-rate targets are a playtest question. | |

**What each phase measures.** Phase 1: Evolutions per run and their *timing* — the greedy pilot
with the simplest policy (Scribe to the two most-fielded, shelf never) is the floor a real player
beats — and the row's clock cost, since the Scribe is the first forced row added since the
Skirmish row was cut to pay for time. Phase 2: whether removing Ichor moves full-clear at all (it
should not, by its own measurement); if it does, the catch-up was doing more than the batch showed
and §10 gains a question. Phase 5: the signature count per run against the target of three, and
which faucet bought them.

---

## 9. Locked invariants this overturns

Each is a sign-off. In force until the phase that replaces it lands.

| Today (`CLAUDE.md` / `xp-overhaul.md`) | Becomes | Phase |
|---|---|---|
| Evolutions come from the schedule's `evolutionLevel` — never from a beat, never from a spend | **From five pips**, bought one Scroll each; still never a beat (no Guardian grants one), and a Scroll is aimed, not spent on a screen of options | 1 |
| Evolutions spread 10–24 per hero in three groups | **Uniform: 5.** The per-hero timing identity moves onto the signature move | 1 |
| The level-up report carries exactly ONE decision kind, and raises the Evolution | Still one kind — the offer. **The Evolution raises from the Scroll node**, so the report is lighter | 1 |
| The Scroll ladder is DELETED whole — no currency, no rung, no price, no purse | **A currency returns: the Scroll, one pip, flat.** No rung, no price curve, no purse — assigned on the node it is paid | 1 |
| The map's per-act shape: Fight → reward → spliced seat → reward → fork → reward → funnel → Guardian | Gains **the Scribe** between the second reward row and the fork — one forced row an act, acts 1–5 | 1 |
| A generated hero walks the schedule's Evolution entry (`rollLevelProgression`) | Reads `masteryForAct`: evolved from Act 3, a signature in the finale | 1 |
| Contract finished, hire raw — three axes (level, Evolution, kit) | **Four**: pips, `2N − 1` against `2N − 2` | 1 |
| The companion's `evolutionLevel` and `lateLevel` are tier-steps | Its steps are 5 and 10 pips; its pips die with it | 1 |
| Ichor: the two reward-row seats and the Guild Hall shelf pay aimed XP; the only way the player paces an Evolution | **Retired.** The seats go back to the Scroll Cache, the shelf sells Scrolls; fielding paces nothing and Scrolls pace the Evolution | 2 |
| Moves come from ONE faucet, the schedule (the Mentor and Tutor named as the exceptions) | A **third** named exception: the signature, at ten pips, one per hero | 3 |
| A Class move is in no level-up pool and no Tutor pool | A sibling rule: a signature is in no pool, no Tutor, no graft list, no path grant | 3 |
| Lizard Rush is a Late Water move Tidecaller grants | **Riptide's signature**, off every pool; Tidecaller's clause 5 is §10's question | 3 |

**Held, and worth saying so:** *a bare number never gets a screen, and a screen never buys a bare
number.* A pip is not a stat; it is progress toward a named thing, and the screen that collects
it shows the thing it is progress toward. Also untouched: `L³` and everything XP pays for, the
550 and 28 budgets, growth grades, the schedule's offers and bands, the damage and heal formulas,
the graft-owns-the-slot rule, Classes as verbs, Boons, the item rules, the Banner family, the Pact
Clock, potions, and the one-decision-kind rule on the report.

---

## 10. Open questions — DO NOT silently resolve

- **Ichor's retirement** is this doc's recommendation, phased separately so it can be refused.
  If it stays, it needs a seat that is not the Cache's and a reason to exist beside a second
  aimed currency; the shelf-only version (no map node) is the smallest one.
- **Does the Scribe row cost more clock than it pays?** Five rows a run at two taps each is ~1–2
  minutes tapping; the Skirmish row it stands where cost ~15. Measure it; if it is heavier than it
  looks, the Scribe can share the spliced row in acts where that row's tenant is weakest.
- **A hero at 9 on the Scribe**: takes 1 and loses 1 (this doc), or is greyed out like a hero at
  10. The first is more honest about what the Scribe is; the second never wastes a pip.
- **Tidecaller's clause 5.** A mono path must carry something a graft cannot, and Tidecaller
  carried Lizard Rush. (a) A mono path may grant the hero's signature *early*, at the Evolution —
  precisely a thing no graft can offer, and the tenth pip then pays nothing on that path; or (b)
  Tidecaller gets a new clause-5 move. (a) is the more interesting rule; it needs Rime's
  Avalanche / Snowball read the same way.
- **Does "who first" read as situational?** If every Evolution is a uniform power-up, the Cache
  collapses to "my best hero", and no Scroll rule fixes that — it is a content finding about the
  paths. The one mechanical retreat is a per-hero cap of 2 pips a Cache, which forces *which two*
  at the cost of friction; hold it, do not build it.
- **The shelf's price and cap.** 25g and 2 are a first pass; the potion shelf is the analogue.
  If the shelf is where signatures get bought, it is competing with recruits for the same gold,
  which is the intended tension — watch whether it reads as one.
- **Does a signature ever need to be a nuke?** The Class rule says never. Lizard Rush is not one
  and reads as a signature anyway; hold the line until an authored hero argues otherwise.

### Watch in playtest

- **Do the pips read on the map, not just the screen?** If a player cannot say who is closest to
  turning without opening the who-screen, the roster strip needs the pip row.
- **Does a Scribe pick on the companion feel like a trap or a bet?** Two pips on a mortal that
  dies next fight is the one way to lose Scrolls. It should read as a bet.
- **Does the tenth pip feel earned or inevitable?** At the middle path it is Act 5 for about
  three heroes. If every carry has it by Act 3, the Cache's weight comes down.
