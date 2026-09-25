# mastery.md — Mastery: pips, the Scribe, and the mastered innate

> **STATUS: DECIDED 2026-09-14 (per user direction, after a same-day draft on "fights survived"
> was playtested on paper and rejected — §0); ALL FIVE PHASES OF §8 ARE IN.** `CLAUDE.md` and `xp-overhaul.md`
> describe the game in force wherever a §8 phase has not landed; §8 is the route and §9 the list
> of sign-offs each phase spends — **check its Status column before assuming anything here is
> live.** Every number below is a first pass unless it says otherwise; the design is the shape,
> and phase 5 is where the numbers get set.
>
> **REVISED 2026-09-24 (per user direction, §8 phase 6): the tenth pip no longer teaches the
> signature move — it MASTERS THE INNATE.** The signature is a guaranteed learn off the level-up
> schedule at the hero's own `signatureLevel` (§5), set by how hard the move hits; the tenth pip
> replaces the hero's innate passive with an authored, sizable upgrade of the same verb (§5b).
> Wherever a line below says "ten is its signature", read §5 and §5b.

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

> **Every hero has ten pips. Five is its Evolution; ten masters its innate passive. A Mastery
> Scroll is one pip, assigned the moment it is paid, to whoever the player says. Scrolls come from
> the map, never from a fight.** (Ten was the signature move until 2026-09-24 — §5.)

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
only, which is simpler than it is today, with one catch-all: a Guild hire that arrived past the
pip unevolved (§4) takes its Evolution on its next report, since no node paid it a pip.

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

Demand is smaller than 6 × 10 looks. Recruits arrive with pips (§4) — a contract from Act 4 on
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

> An enemy or a **contract** hero in act N holds `2 × N − 2` pips (0 / 2 / 4 / 6 / 8, the finale
> 10): the Scribe's pace for a hero it touched every act BEFORE this one. A **Guild hire** arrives
> one behind, `max(0, 2N − 3)` (0 / 1 / 3 / 5 / 7) — both raw in Act 1.

So every hero-pool enemy from Act 4 arrives **evolved**, the finale's carries its signature, a
contract is a pip ahead of a hire from Act 2 on (`test/recruitment.test.ts` gains the axis beside
level, Evolution and kit), and *contract finished, hire raw* is now true four ways. It was `2N − 1`
for a day (phase 2), which evolved every enemy from Act 3; phase 5 set it here per user direction
(§8). `rollLevelProgression` stops walking an Evolution entry
and reads the figure. The Titanspawn have no Evolution and no pips; their tiers are by act.

**Ichor retires.** Its two seats and its shelf were the Scroll Cache's, Lone Scroll's and
bundle's before it, and go back; its measured effect was nothing (`xp-overhaul.md` §8, phase 2:
13 levels-at-par a run moved full-clear by ~0); and it was the second aimed currency with the same
who-screen as Scrolls, which is one too many to teach. Levels stay roster-wide and automatic, the
cube stays, and a hero behind par still closes on it on its own (§2 of that doc) — the catch-up
Ichor was *also* for is the curve's job and was measured as such. This is its own phase (§8, 2)
so it can be vetoed without touching the rest.

---

## 5. The signature move — a level's guaranteed learn

> **Revised 2026-09-24, per user direction.** The signature was the tenth pip's until this date.
> Measured, most heroes never reached ten (35 pips a completed run across six heroes — about three
> signatures a run on the middle path, and those in Act 5), so the move that says what a hero *is*
> was, for most of the roster, a line on a sheet. It is on the **level-up schedule** now, where
> every hero reaches it.

Every hero has ONE **signature move** — `HeroDefinition.signatureMoveId`, the move that says what
the hero *is* in one button. Riptide's **Lizard Rush** is the template: 75 BP Water physical, Renew
35 to both allies, 45 mana — a solid hit plus the thing the hero does. A verb, not a nuke; the
damage formula is locked and the identity is in the rider.

**When: `schedule.signatureLevel`, guaranteed.** At that level the level-up report teaches it —
not rolled, in no band, the same move every run. It is not a schedule ENTRY (`scheduleTaken` never
counts it); it is a move offer spent by being made (`offeredMoveIds`), so below `MOVE_CAP` it
simply lands and at the cap it is replace-or-decline, declined for the run like any offer
(`pendingSignature`, `src/run/progression.ts`). A raw Guild hire that arrives past its level takes
it on its next report; a contract hero and an enemy past it hold it already
(`rollLevelProgression` puts it in the kit ahead of the offers, in the last slot if the kit is
full).

**The level is set by the move's power**, in three windows (`src/data/heroes.ts`; each moved a level later on 2026-09-25, per user direction — Skyshear and Flurry held at 19 and 23, where the next level up is one of their own offers):

| Window | Act (at par) | What sits there | Heroes |
|---|---|---|---|
| **14–16** | Act 2's Guardian into Act 3 | a rider-led hit, a buff, a cheap or a debuff-first move | Riptide 14, Sentinel 14, Dread 14, Valor 14 · Rime 15, Fang 15 · Brimstone 16, Pincer 16, Crag 16, Aegis 16, Lucius 16, Trance 16, Warden 16, Patch 16, Coil 16 |
| **18–20** | late Act 3 | a Late-sized hit with one real rider | Sylva 18, Widow 18, Sorrow 18, Clockwork 18 · Cinder 19, Cube 19, Skyshear 19, Slate 19, Mordrax 19, Empyrean 19, Glyph 19, Revenant 19, Vex 19 · Squall 20, Zenith 20, Cortex 20 |
| **22–24** | Act 4 | 95+ Base Power, a lockout, double-on-a-status, a whole-side heal or a pool refill | Tempest 22, Marrow 22, Scallywag 22, Bellows 22 · Crimson 23, Leviathan 23, Flurry 23, Hollowbark 23, Solace 23, Nightshade 23, Pixie 23, Gallant 23, Rex 23 · Ursa 24 |

Never on one of the hero's own offer levels, so the report pays it as a beat of its own, ahead of
that level's roll when both land. `test/mastery.test.ts` pins the windows, the stagger, and that
the heaviest (the recoil nukes, the 100-power fists) sit in the last window.

**The screen.** The same box a level's offer ends in, dressed as the event it is (`SignatureBox`,
`MoveOfferOverlay.tsx`): a crest that bursts in over the hero's name — *✦ Signature Move ✦* —
the card in a frame whose rim is a turning sheen in the hero's own type colour, motes rising off
it, and a fanfare in the element's voice. It is learned once a run, so it is the one move screen
allowed to be loud. The Dossier's Moves tab lists it under *Signature — Lv N*.

**Exclusivity, the Class-move rule's sibling.** A signature is in no type pool, no Mentor or Tutor
pool, no graft's `learnableMoveIds`, and no path's `unlocksMoveIds` — untiered the way a Class
move is. Authored at the hero's innate primary type, so STAB is guaranteed without
`typeFollowsUser`. **Tidecaller grants Maelstrom** (2026-09-14, per user direction): a Late Water
spread at the Evolution, taken OFF Riptide's own pool so the grant is not timing alone.

**Inside the cap.** `MOVE_CAP` is 4 and stays 4. "Decline your signature" is a sad screen and a
real decision. **Priced Late** (the ×0.75 re-price applies; floor 45). Not for the companion — a
spawn line has none.

**What it costs the enemy side.** An enemy is levelled to its node, so a hero-pool enemy holds its
signature from the same window a roster hero does — the lighter ones from Act 3, the heaviest
from Act 4 — where it used to hold one only in the finale. That is symmetric by design and is in
the §8 phase 6 measurement.

---

## 5b. The mastered innate — the tenth pip

At **ten pips** the hero's innate passive (`docs/innate-passives.md`) is **MASTERED**: replaced by
an authored upgrade of the same verb, a sizable step louder — the power fantasy of the thing the
hero relies on, turned all the way up. `HeroDefinition.masteredPassiveIds` holds it;
`innatePassiveIdsFor(hero, entry)` (`src/run/innate.ts`) is the one read, and every fight build and
hero sheet goes through it, so the swap is total: the born card is gone, not stacked under.

**The authoring rule** (pinned in `test/mastery.test.ts`): the same trigger, a new name, in no
pool, and **every flat figure at least doubled** — or the reach widened (one enemy → both, self →
the pair), a cap taken off (Apex Tyrant keeps Tyrant's Due's 10 and loses once-a-fight), or a roll
made certain (Boiling Point). Where one reaction cannot carry the upgrade it is two cards,
Broadside's shape, read as one innate by its first. A Burden stays a Burden: Iron Mountain still
cannot switch, and now grows for staying.

| Hero | Innate | Mastered |
|---|---|---|
| Cinder | Kindling (+5 Atk on Burn) | **Forgeheart** — +10 Atk and +10 Def on Burn |
| Crimson | Stoke (+10 Int on a Burn tick) | **Wildfire** — +20 Int and 10 Mana past the pool on a Burn tick |
| Brimstone | Sulphur (entry: Burn 5 on both) | **Hellmouth** — entry: Burn 20 on both |
| Riptide | Drag (Water hit: −5 Spe) | **Rip Current** — Water hit: −15 Spe |
| Pincer | Carapace (entry: Shield 30) | **Exoskeleton** — entry: Shield 75 |
| Leviathan | Overchannel (+10 Mana a hit) | **Abyssal Well** — +25 Mana a hit |
| Flurry | Glaciate (hit taken: −5 Spe both) | **Deep Winter** — hit taken: −15 Spe both |
| Rime | Cold Snap (+10 Atk on Freeze) | **Shatterpoint** — +25 Atk on Freeze |
| Cube | Absolute Zero (Def up: −5 Spe both) | **Zero Kelvin** — Def up: −15 Spe both |
| Squall | Tailwind (entry: partner +10 Spe) | **Jetstream** — entry: partner +25 Spe |
| Tempest | Live Wire (Conduct set off: Shield 20) | **Thunderhead** — Shield 50 |
| Skyshear | Static Field (+10 Int per Conduct) | **Supercell** — +25 Int per Conduct |
| Crag | Vengeful Emblem (hit taken: +10 Atk) | **Bedrock Wrath** — hit taken: +25 Atk |
| Sentinel | Stone Wall (entry: partner Shield 20) | **Fortress** — entry: partner Shield 60 |
| Slate | Fault Line (Stone hit: Shield 10) | **Tectonic** — Stone hit: Shield 30 |
| Sylva | Verdurous (Renew: Poison 5 on one enemy) | **Rampant Bloom** — Renew: Poison 10 on both |
| Mordrax | Impale (hit: Poison 5) | **Skewer** — hit: Poison 12 |
| Hollowbark | Barbs (hit taken: Poison 3 both) | **Thornmail** — hit taken: Poison 8 both |
| Solace | Grace (heal: +10 Mana) | **Beatitude** — heal: +25 Mana |
| Aegis | Consecrate (healed: +5 Def/Wis) | **Sanctified** — healed: +15 Def/Wis |
| Empyrean | Halo (round end: partner +10 HP) | **Corona** — round end: partner +30 HP |
| Widow | Lethal Bite (×2 on Bleed AND Poison) | **Black Widow** — ×1.5 on Bleed, ×1.5 on Poison, ×2.25 on both |
| Marrow | Necrosis (Poison tick: heal it) | **Lich's Draught** — heal twice it |
| Nightshade | Shadowmeld (entry: Ambush 10) | **Umbral Veil** — entry: Ambush 30 |
| Glyph | Arcane Repose (Rest: Shield = mana) | **Arcane Bastion** — Shield = 2× mana |
| Zenith | Arcane Reservoir (entry: +30 Mana) | **Starwell** — entry: +75 Mana |
| Pixie | Attunement (entry: partner +20 Mana) | **Fey Communion** — partner +50 Mana |
| Cortex | Neuroplastic (enemy Wis lost → gain it) | **Mindthief** — gain it as Wis AND Int |
| Lucius | Hunger (Mind hit: heal 20%) | **Insatiable** — heal 50% |
| Trance | Lullaby (round end: −5 Spe both) | **Deep Slumber** — −15 Spe both |
| Revenant | Ghostlight (Haunt: Spirit Force 10) | **Wraithfire** — Spirit Force 25 |
| Sorrow | Lament (hit a Haunted: heal it) | **Keening** — heal it, and the partner half |
| Dread | Nightmare (Haunted lose 10%) | **Night Terror** — Haunted lose 20% |
| Warden | Rivet (round end: partner +5 Def) | **Riveted Line** — partner +15 Def |
| Valor | Rallying Standard (entry: partner +10 Atk/Int) | **Clarion Call** — partner +25 Atk/Int |
| Gallant | Sunder (hit: −10 Def) | **Shatterlance** — hit: −25 Def |
| Scallywag | Broadside (1 ball a round, 4 max) | **Grand Broadside** — 2 a round, 6 max |
| Clockwork | Boiler (Mech hit: 30% Burn 10, scaled) | **Boiling Point** — always Burn 20, scaled |
| Bellows | Ironbound (cannot switch) — Burden | **Iron Mountain** — cannot switch; +10 Atk/Def a round |
| Rex | Tyrant's Due (once a fight, kill: +10 Atk for the run) | **Apex Tyrant** — every kill |
| Patch | Field Repair (heal: cleanse 1) | **Refit** — heal: cleanse all, Shield 30 |
| Fang | Pack Hunter (partner hits: +5 Atk) | **Alpha's Call** — partner hits: both +10 Atk |
| Ursa | Feast (kill: heal 50%) | **Glut** — kill: heal to full, +20 Atk |
| Coil | Serpent's Eye (entry: −10 Int both) | **Petrifying Stare** — entry: −20 Int and −20 Atk both |
| Vex | Sanguine (Bleed tick: heal it) | **Hemophage** — heal 1.5×, +10 Atk |

Boiling Point is Boiler's own card mastered, so it keeps `scaledBy` — the same holder, not a
second exception to the flat-passive rule (CLAUDE.md). Every figure is a first pass.

**The screen.** The Scroll that lands the tenth pip raises a reveal on the node that paid it
(`MasteredInnateOverlay`, raised by `masteryFlow.ts`): the born card small and struck through,
*becomes*, and the mastered card in the signature's frame under an *✦ Innate Mastered ✦* crest.
Nothing to decide — the upgrade is held from the pip. The who-screen's card says *Masters!*
before the tap; the hero sheet, the stage and the scouted chip read *Innate · Mastered* after.

**The enemy side.** `masteryForAct(6)` is 10, so every hero-pool enemy in the finale fields its
mastered innate, where it used to carry its signature. Before the finale no enemy is at ten.

**The companion** keeps its tier-step at ten; a spawn has no innate to master (it holds a Mark).

---

## 6. What the run feels like

Act 1: the Scribe, before the fork, pays Valor and Fang 2 each. A Cache shows in the next reward
row — three more on Valor and it turns on the spot, in front of the previewed Elite it now
counters. Or the Cache is passed for the item, and Valor turns in Act 2. The player chose.

Act 3: a contract hero arrived at 5, already turned. The Scribe's two picks are the two unevolved
heroes the player fields most; the Cache, when it shows, goes to the one the Guardian's type says.
The carry is at 7 and nobody has mastered an innate yet; the lighter signatures are landing off
the level-up report on their own.

Act 5: three heroes are at 8–9. The Scribe cannot finish more than two of them; the Cache and the
shelf decide the third, and the gold it costs is a recruit not bought. Whoever reaches 10 carries
its innate, mastered, into the finale — Rex banking every kill, Sentinel's partner walking in
behind a 60-point Shield.

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
| 1 | **Mastery in.** `RosterEntry.mastery`; the who-screen (Ichor's, renamed, with the pip row); the **Scribe** row (`scribeReward`, forced, acts 1–5, pick two, +2 each); the **shelf** (Guild Hall and Vigil, 25g, 2 a visit); the Evolution raised at 5 from the node; `masteryForAct` for enemies, contracts, hires; the companion's steps at 5 / 10; delete §7's first four items. Ichor untouched — both seats stay. Tutorial re-checked (the Scribe with three heroes in a one-node-per-row act). | No reader of `evolutionLevel`; a run completable end to end; `test/recruitment.test.ts` pins contract > hire on pips. Measured against the XP Overhaul's phase-6 baseline (full-clear 57%, Evolutions 5.0 a run): Evolutions per run, "every hero evolved" %, the clock with one more row an act. | **DONE 2026-09-14.** `src/run/mastery.ts`; `ScrollNodeScreen` (a new screen beside Ichor's, since Ichor stays until phase 2) with `masteryFlow.ts` carrying the Evolution / tier-step / overflow raise that `levelUpFlow.ts` now composes as its catch-all; `MasteryPips` on the who-screen and the hero sheet; `ROW_WIDTHS` gained the Scribe at row 4 and the tutorial corridor a beat for it; `ActScaling.mastery`; `SAVE_VERSION` 15. Measured below. |
| 2 | **The Cache takes Ichor's seats.** `scrollReward` at 46; `ichorReward` / `ichorDropReward` / `ichor.ts` / the Drops deleted; the Drop's 14 retires. | No Ichor anywhere; the sim tallies pips by source. **Separable — veto here leaves phase 1 standing.** | **DONE 2026-09-14.** `scrollReward` (`SCROLL_CACHE_COUNT` = 3) in the pool at 46, on the same `ScrollNodeScreen`; `src/run/ichor.ts`, `IchorNodeScreen`, the shelf's Drops and `ICHOR_PURCHASE_*` deleted; the phial stays as XP's glyph; the corridor's third reward row is the Cache; the sim's `--policy focus / spread` is now the Scroll dial (`scrollTarget`). `SAVE_VERSION` 16. Measured below. |
| 3 | **The signature slot.** `signatureMoveId`; the tenth pip's replace-or-decline on the who-screen; the exclusivity test (no pool, no Tutor, no graft list, no path grant); Lizard Rush promoted and pulled from its three pools; the Tidecaller decision (§10); enemies at 10 hold it. | Riptide reaches Lizard Rush at 10 and nowhere else; the test catches a signature in any pool. | **DONE 2026-09-14.** `HeroDefinition.signatureMoveId`, `src/data/signatures.ts` (untiered, folded into `moves`), `pendingSignature` (`src/run/mastery.ts`: owed at ten, spent by being made); `masteryFlow.ts` raises it as `SignatureBox` — a receipt below the cap, replace-or-decline at it — on the Scroll node and, as the catch-all, the report; `rollLevelProgression` puts it in a generated hero's kit ahead of the offers, in the last slot if the kit is full; the Dossier's Moves tab lists it under *Signature — Mastery 10*. Tidecaller grants Maelstrom, off the pool (§5). The sim's `payMastery` takes it on the offer rule. |
| 4 | **Author 35 signatures.** Parallelisable from 3; ships hero by hero (an unauthored hero's tenth pip pays nothing, which is what today pays). | Every hero has one, on the template — a hit or a verb at the hero's primary, Late-priced, never a bare nuke. | **DONE 2026-09-14** (drafted, reviewed per user direction the same day: seven renamed, the numbers left as first-pass — the weaker ones wait on a buff/debuff rework, not on this table). All 36 point at a signature (`src/data/signatures.ts`): a hit sized like the type's Late moves plus the hero's own verb — the thing its paths keep circling — no two alike. Two written to the tests' pinned decisions rather than the first draft: Roost Guard grants Defense only (Wisdom off-Mind is a decision the Iron test guards), and Crag's is *Groundsplit* (the slate already had a Fault Line). Every per-type slate test now filters the catalog out, since a signature is a hero's, not a type's. |
| 5 | **Re-fit.** Cache weight, shelf price, the Scribe's 2 + 2, `masteryForAct`, against the sim with a Scroll policy on the pilot (concentrate on the fielded; evolve first, then signatures; the Scribe to the two most-fielded unevolved) and `time.ts` pricing the two screens; then the Act 1 wall re-read. | ~3 signatures a run on the middle path, every hero evolved on the Scribe alone; the clock reported against the 77 / 53 / 32 baseline. Win-rate targets are a playtest question. | **DONE 2026-09-14** (per user direction: `masteryForAct` = `2N − 2`; the Scribe's 2 + 2, the Cache's 46 and the shelf's 25g / 2 left where they were, with the dial table below for the designer). Measured below. |
| 6 | **The signature leaves the pips; the innate is mastered** (2026-09-24, per user direction). | Every hero learns its signature off the level-up report at its own `signatureLevel`; ten pips replace the innate with its authored upgrade. | **DONE 2026-09-24.** `LevelSchedule.signatureLevel` on all 45 (§5's table), `pendingSignature` moved to `src/run/progression.ts` and read off level — by the report (`levelUpFlow.ts`, ahead of the level's roll), `rollLevelProgression` and the sim's `payMastery`; `SignatureBox` dressed as the event (crest, type-coloured frame, fanfare) and a gold *✦ Signature!* tag on the report row. `HeroDefinition.masteredPassiveIds` on all 45 (§5b's table, `masteredInnatePassives` in `src/data/passives.ts`), `innatePassiveIdsFor` read by the fight build and every sheet, `MasteredInnateOverlay` raised by the Scroll that lands the tenth pip. **Measured** (1000 runs, greedy pilot, seed 1, same seeds both sides): under the `spread` Scroll policy the signature went from **1.1% of runs** reaching one (0.02 a completed run) to **six a completed run**, and full-clear **75.4 → 80.9%** — Acts 1–3 identical to the run, **Act 4 95.6 → 98.4, the finale 94.6 → 98.1**, so enemies holding signatures from their level does not offset the player's. Under `focus` (the pilot that reaches ten pips, 1.8 a run) **80.3 → 83.8%**, the same two acts. A player buff of 3–6 points, all of it Act 4 on; the dials are the three windows (a window up an act) and `ACT_LEVEL_ADJUST`'s Act 4 / 5 terms — the designer's to move. **Then moved a level later** (2026-09-25, per user direction, to 14–16 / 18–20 / 22–24): full-clear 80.9 → 81.8% on the same seeds (noise), signatures 5.9 a completed run.  |

**What each phase measures.** Phase 1: Evolutions per run and their *timing* — the greedy pilot
with the simplest policy (Scribe to the two most-fielded, shelf never) is the floor a real player
beats — and the row's clock cost, since the Scribe is the first forced row added since the
Skirmish row was cut to pay for time.

Phase 1, measured (300 runs, seed 11, greedy pilot, against the same seed on the tree before it):
**full-clear 60.3% → 54.7%**, roster evolved at end 78.6% → 66.7%, **"every hero evolved" 67.7% →
25.0%**. Pips a completed run: **20.0 Scribe + 2.1 shelf** — the pilot's `scrollTarget` buys the
shelf only when gold is left after recruits and gear, which it mostly is not. This is the bridge
state §3 predicts: the Scribe alone evolves four, and the ~12 the Cache pays are phase 2's. Acts:
87 / 90 / 95 / 84 / 88, so the loss is spread rather than an Act 1 wall (the Scribe pays Act 1 its
4 before the fork, and the early Evolution the level window forbade is now the pilot's default).
Clock: Reader 71.1 → 72.4 min, the Scribe row 0.7 min a run — the smallest node on the map.

Phase 5, measured (1000 runs, seed 11, every batch on the same seed). **`2N − 2` moved nothing
measurable**: full-clear 54.2% (`focus`), Act 3 96.4, Act 4 81.6 — Act 4's enemies are at 6 pips
either way, and Act 3's being unevolved is worth under a point. Against the pre-Mastery tree at the
same 1000 runs (62.0%; Acts 2–4 at 93.3 / 98.9 / 87.9 against 90.5 / 96.4 / 81.6) the eight-point
gap is the PLAYER's side: the level schedule evolved all six by Act 3–4 at par for free, and 35
pips evolve about four by the same point and the rest by Act 5 ("every hero evolved" 69 → 61%).
The rotate / carry pair: `focus` 54.2% against `spread` 48.6% — concentrating by six points, which
is §2's claim measured at scale. Supply sensitivity (all `focus`, 1000 runs): Cache weight 46 → 70
pays 2 more pips and +1.0; a Cache of 4 pays 3 more and +2.5; **the Scribe at 3 + 3 pays 10 more
and +3.8 (58.0%, every hero evolved 72%)** — the guaranteed faucet buys the most clear per pip,
since it is the roster-wide Evolutions the run lost. The clock: Reader 71.0 → 71.7 min, the Scribe
row 0.7 and the Cache 0.5 a run, the Evolution screens 2.4 → 2.5. Left where they were, per user
direction, with the table in §10: 2 + 2, 46, 25g / 2.

Phase 2, measured (300 runs, seed 11, `--policy focus`, against phase 1): **full-clear 54.7% →
54.7%** — removing Ichor and adding the Cache moved the clear rate by nothing, which is the null
Ichor's own measurement predicted — while **"every hero evolved" went 25.0% → 63.7%** and roster
evolved at end 66.7 → 79.3%. Pips a completed run: **Scribe 20.0 + Cache 9.3 + shelf 5.8 = 35**,
the middle path §3 estimated. `--policy spread` (fewest pips first, so the four evolve in step)
clears 42.0%: spreading is the trap §2 says it is, by twelve points, and the pair is the rotate /
carry measurement phase 5 asked for. **Against the tree before Mastery the run is still 60.3 →
54.7**, and the per-act table says where: Act 3 99.1 → 96.1 and **Act 4 89.3 → 81.6**, Acts 1, 2
and 5 unmoved. That is §4's derivation biting — under `masteryForAct` every hero-pool enemy from
Act 3 arrives evolved, where the level schedule left the late turners unevolved until Act 4 or 5.
A phase-5 dial (a lag on `masteryForAct`, or Act 3 at 4 pips), listed in §10. Phase 2: whether removing Ichor moves full-clear at all (it
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
| A generated hero walks the schedule's Evolution entry (`rollLevelProgression`) | Reads `masteryForAct`: evolved from Act 4 (Act 3 until phase 5), a signature in the finale | 1 |
| Contract finished, hire raw — three axes (level, Evolution, kit) | **Four**: pips, `2N − 2` against `2N − 3` (phase 5; a pip more each until then) | 1 |
| The companion's `evolutionLevel` and `lateLevel` are tier-steps | Its steps are 5 and 10 pips; its pips die with it | 1 |
| Ichor: the two reward-row seats and the Guild Hall shelf pay aimed XP; the only way the player paces an Evolution | **Retired.** The seats go back to the Scroll Cache, the shelf sells Scrolls; fielding paces nothing and Scrolls pace the Evolution | 2 |
| Moves come from ONE faucet, the schedule (the Mentor and Tutor named as the exceptions) | A **third** named exception: the signature, at ten pips, one per hero | 3 |
| A Class move is in no level-up pool and no Tutor pool | A sibling rule: a signature is in no pool, no Tutor, no graft list, no path grant | 3 |
| Lizard Rush is a Late Water move Tidecaller grants | **Riptide's signature**, off every pool; Tidecaller's clause 5 is §10's question | 3 |
| The signature is the tenth pip's, one per hero (phase 3 of this doc) | **A level's guaranteed learn** at `schedule.signatureLevel` (14–16 / 18–20 / 22–24 by the move's power) — still one per hero, still in no pool; the moves' one faucet gains no new exception, since the schedule IS the faucet | 6 |
| The tenth pip pays a move | **The tenth pip masters the innate**: `masteredPassiveIds` replaces `passiveIds` on that hero — a second passive authored per hero, in no pool, never granted anywhere else | 6 |
| A generated hero holds its signature only at ten pips (the finale) | Holds it from its `signatureLevel` — hero-pool enemies carry signatures from Act 3; the finale's carry their mastered innates | 6 |

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
- ~~**Tidecaller's clause 5.**~~ **Decided 2026-09-14, per user direction: (b).** Tidecaller grants
  Maelstrom, off Riptide's own pool; the signature is at ten for every Riptide. (a) — a mono path
  granting the signature early — was the more interesting rule and is not taken: a signature has
  ONE source, and a path that hands it out is a second.
- **Does "who first" read as situational?** If every Evolution is a uniform power-up, the Cache
  collapses to "my best hero", and no Scroll rule fixes that — it is a content finding about the
  paths. The one mechanical retreat is a per-hero cap of 2 pips a Cache, which forces *which two*
  at the cost of friction; hold it, do not build it.
- ~~**Enemies evolve a full act earlier than they used to.**~~ **Decided 2026-09-14, per user
  direction: `2N − 2`.** Enemies evolve from Act 4. It did NOT recover the clear rate — see phase 5
  in §8: the gap to the pre-Mastery tree is the PLAYER's Evolutions arriving later and fewer under
  35 pips, not the enemy's arriving earlier. The supply dials are the open question now.
- **How much supply?** Phase 5 measured the run at 35 pips a completed run (Scribe 20 / Cache 9 /
  shelf 6) against the pre-Mastery tree: full-clear 62.0 → 54.2%, every hero evolved 69 → 61%. One
  point of clear a ~2.5 pips: a Cache of 4 (38 pips) 56.7%; Cache weight 70 (37) 55.2%; **the
  Scribe at 3 + 3 (45 pips) 58.0% and every hero evolved 72%** — the guaranteed, un-concentrable
  faucet is the efficient one, since what the run lost is the schedule's roster-WIDE Evolutions,
  not the carry's. The Scribe's 2 + 2 is the user's figure; raising it is the user's call, and
  the case for leaving it is that the eight points are the price of Evolutions being earned.
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
