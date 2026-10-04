# mastery.md — Mastery: pips, the Scribe, and the mastered innate

> **STATUS: BUILT IN FULL (decided 2026-09-14, per user direction; all six phases of §8 in).**
> In force: ten pips a hero, **5 is its Evolution, 10 masters its innate** (§5b); a Scroll is one
> pip, assigned on the node that pays it. **The signature move is NOT a pip** (revised 2026-09-24):
> it is a guaranteed learn off the level-up report at the hero's own `signatureLevel` (§5).
> **With four acts (2026-10-02, `xp-overhaul.md` §5)** the Scribe runs acts 1–4, the shelf sells
> Scrolls **two to a pack**, and **the MVP pip** (§3) pays one free pip after every won fight but
> the finale — reversing "never a post-fight drop". Ichor (`xp-overhaul.md` §3) is retired.
> Measured under four acts: 45 pips a completed run, every hero evolved 77% of runs. Every number
> is a first pass; the shape is decided.

---

## 0. Why this exists

The XP Overhaul put moves, stats and the Evolution on one curve, and it worked for two of them.
Levels are roster-wide and automatic, so under it the Evolution was too: a hero reached
`schedule.evolutionLevel` on the same fight every other hero at par reached its own, and the screen
that raised it was a consequence of nothing the player did. The Scroll ladder it replaced was worse
in every way but one — the player CHOSE who turned and when. That control, and the tension of
watching it come, is what the schedule lost.

Three shapes were tried before this one, and each is worth a line so nobody tries it again.

- **Mana spent in fights.** Unbounded in rounds, so it pays the heal-stall directly, and Rest is a
  second stall inside the first.
- **Fights fielded and survived** (+1 fielded, −1 KO'd). Rejected in a paper playtest: once a fight
  is decided, optimal play is to switch the bench in and cast once each to lock their mark — a
  mop-up phase after every win. **Any per-fight reward keyed to who was on the field has that
  mop-up.** The family is wrong, not the number. (The MVP pip, §3, is keyed to a *share of a
  column*, on the field two rounds, never the same hero twice running — not to presence.)
- **The Scroll ladder** (`growth-overhaul.md` §11–12). Killed by its screens, not its price:
  forty-seven decisions a run.

What survives is the currency, stripped of everything that made it a screen: **a Scroll does
nothing but move a hero one pip closer to something.**

---

## 1. The rule this reduces to

> **Every hero has ten pips. Five is its Evolution; ten masters its innate passive. A Mastery
> Scroll is one pip, assigned the moment it is paid, to whoever the player says.**

No per-hero threshold to author, no price curve, no purse, no KO cost. The player's control is
*who*, on a screen that asks only that. Uniform 5 / 10 is a deliberate simplification: the per-hero
timing identity the level schedule carried moves onto the **signature move** and its level (§5).

**Fights pay XP, the map pays Scrolls** — with one exception, the MVP pip (§3). That sentence is
also why Ichor retired (§4): it was XP paid by the map.

---

## 2. Pips and the who-screen

**Mastery** is an integer on `RosterEntry`, 0–10 (`src/run/mastery.ts`). Nothing happens at 1–4 or
6–9. Reaching **5** raises that hero's Evolution screen; reaching **10** masters its innate (§5b).
Both fire **on the node that paid the pip**, not on the level-up report, with one catch-all: a Guild
hire that arrived past the pip unevolved (§4) takes its Evolution on its next report.

**The who-screen** (`ScrollNodeScreen`, with `masteryFlow.ts`): every roster hero as a card, a
ten-pip row with markers at 5 and 10, a tap a pip. A tap that crosses a marker hands straight off to
the Evolution screen (or the mastered-innate reveal) and comes back for the remaining pips. A hero
at 10 is refused. The screen collects one thing, *who*.

**No purse.** A node's Scrolls are assigned on the node. A flat price is the only price that keeps
*a Scroll always does something the instant it lands* true. "I'm about to recruit someone" is
refused; that is what the shelf is for.

**Concentrating is dominant, and that is fine.** Mastery is a step function, so with a fixed supply
the player reaches the same number of milestones in any order — concentrating just reaches the first
sooner. Spreading thin is a trap the pips teach in one node (measured: `focus` beat `spread` by six
to twelve points). The question a Scroll node asks is therefore **which hero's next step**, and the
map supplies the inputs: the fork previews the Elite's and Skirmish's typing, the Guardian's type is
fixed by the Location, and pips are at risk — a companion's die with it, a terminated hero's are
gone (strategic churn is a goal, and this is what it costs).

**The companion** eats pips like anyone: its tier-steps are Early → Mid at 5 and Mid → Late at 10.
A KO takes its pips with it — a real reason to hesitate over a mortal.

---

## 3. The three faucets

Each pays a different amount for a different price, and the screens ask different questions.

| Faucet | Where | Pays | The screen asks | Price |
|---|---|---|---|---|
| **The Scribe** (forced) | `scribeReward`, a row every act 1–4, between the second reward row and the Elite/Skirmish fork | **Pick TWO heroes; each takes 2** (`SCRIBE_PIPS_EACH`) | *Who gets the ball rolling?* — breadth | A row of map time, two taps |
| **Scroll Cache** (optional) | `scrollReward` in the reward-row pool, weight 20 (`src/run/map.ts`) | **3 Scrolls, divided freely** (`SCROLL_CACHE_COUNT`) | *Who is closest to something?* — depth | The seat: an item, a Boon, a Forge not taken |
| **The shelf** | The Guild Hall and the Vigil, 25g a pack, 2 packs a visit | **2 Scrolls a pack** (`SCROLL_PACK_PIPS`), split freely | the same | Gold against recruits and gear |
| **The MVP pip** | the victory screen, every won fight but the finale (`src/run/mvp.ts`, `MvpRow`) | 1 pip to the hero with the biggest share of one team column | nothing — it is named | free |

**The Scribe seeds; the Cache and the shelf prioritise.** The Scribe's pick-two-get-two cannot be
concentrated, so it spreads four pips over the roster on a rhythm the player does not choose. It
sits before the fork so the Evolution it buys lands before the previewed Elite and the Guardian. A
hero at 9 takes 1 and the other is lost — the card says so; a hero at 10 cannot be picked.

**The Cache's weight** was 46 (the seat it held before Ichor) and came down to 20 (per user
direction — two Caches an act made an Act 1 Evolution the default; `CLAUDE.md`).

### The MVP pip

2026-10-02, per user direction (`src/run/mvp.ts`). Each hero's score is its weighted share of
whichever team column it led most — Damage (Shield-absorbed and DoT included), Finishes (×0.8),
Support (heals plus Shield it granted that a hit emptied), Anchor (damage taken), Control (statuses
and stat drops on enemies, buffs on allies) — on the field 2+ rounds; never a hero at the cap, never
the same hero twice running. The victory screen names the hero with a one-word title for the column
and never the share (Striker, Finisher, Lifeline, Anchor, Tactician — the role is what teaches, a
percentage only invites an argument). Winners split Anchor 29 / Control 26 / Damage 21 / Support 11
/ Finishes 7% on the skilled pilot; **Anchor leads, which is the tanks' column — a weight below 1 is
the dial.** It sends pips where the fight says rather than to the strongest four, so it reaches more
fully evolved rosters per pip than the shelf does.

### Supply

Recruits arrive with pips (§4), so a roster with two mid-run recruits needs ~20–25 pips to evolve
everyone, not 30. **The target is every hero evolved, and a mastered innate or two, a run.**

Measured under four acts (`xp-overhaul.md` §5, MVP + 2-packs, Scribe 2 + 2): **45 pips a completed
run, every hero evolved 77% / 54% (skilled / chart), a third of Evolutions in Acts 1–2.** Under five
acts it was 35 pips (Scribe 20 / Cache 9 / shelf 6).

---

## 4. Recruits, enemies and the companion — derived, not authored

Nobody is on a private model. A hero the player does not control reads its pips off the act
(`masteryForAct`, `src/run/mastery.ts`):

> An enemy or a **contract** hero in act N holds `2 × N − 2` pips (0 / 2 / 4 / 6), and the finale
> reads `MASTERY_CAP` by rule. A **Guild hire** arrives one behind, `max(0, 2N − 3)`
> (`guildHallMastery`) — both raw in Act 1.

So every hero-pool enemy from Act 4 arrives **evolved**, the finale's carry their mastered innates,
and a contract is a pip ahead of a hire from Act 2 on (`test/recruitment.test.ts`) — *contract
finished, hire raw* true four ways. It was `2N − 1` for a day, which evolved every enemy from Act 3;
`2N − 2` is the user's figure, and measured it moved nothing (the gap to the pre-Mastery tree is the
PLAYER's Evolutions arriving later, not the enemy's earlier). The Titanspawn have no Evolution and
no pips; their tiers are by act.

**Ichor retired** (2026-09-14). Its seats went back to the Scroll Cache; its measured effect was
nothing (`xp-overhaul.md` §8, phase 2); and it was a second aimed currency with the same who-screen
as Scrolls, one too many to teach. A hero behind par still closes on it on its own — the cube's job.

---

## 5. The signature move — a level's guaranteed learn

> **Revised 2026-09-24, per user direction.** The signature was the tenth pip's until this date.
> Measured, most heroes never reached ten (about three signatures a run, in Act 5), so the move that
> says what a hero *is* was, for most of the roster, a line on a sheet. It is on the **level-up
> schedule** now, where every hero reaches it.

Every hero has ONE **signature move** — `HeroDefinition.signatureMoveId` (`src/data/signatures.ts`),
the move that says what the hero *is* in one button. Riptide's **Lizard Rush** is the template: 75
BP Water physical, Renew 35 to both allies, 45 mana — a solid hit plus the thing the hero does. A
verb, not a nuke; the identity is in the rider.

**When: `schedule.signatureLevel`, guaranteed.** At that level the level-up report teaches it —
not rolled, in no band, the same move every run. It is not a schedule ENTRY (`scheduleTaken` never
counts it); it is a move offer spent by being made (`offeredMoveIds`), so below `MOVE_CAP` it
simply lands and at the cap it is replace-or-decline (`pendingSignature`, `src/run/progression.ts`).
A raw Guild hire past its level takes it on its next report; a contract hero and an enemy past it
hold it already (`rollLevelProgression` puts it in the kit ahead of the offers, in the last slot if
the kit is full).

**The level is set by the move's power**, in three windows (`src/data/heroes.ts`; each moved a level later on 2026-09-25, per user direction — Skyshear and Flurry held at 19 and 23, where the next level up is one of their own offers). The table is the first 45; the heroes added since author theirs in the same windows, and some names have changed since (Cortex → Reverie, Cube → Floe, Slate → Petra):

| Window | Act (at par) | What sits there | Heroes |
|---|---|---|---|
| **14–16** | Act 2's Guardian into Act 3 | a rider-led hit, a buff, a cheap or a debuff-first move | Riptide 14, Sentinel 14, Dread 14, Valor 14 · Rime 15, Fang 15 · Brimstone 16, Pincer 16, Crag 16, Aegis 16, Lucius 16, Trance 16, Warden 16, Patch 16, Coil 16 · Nautilus 15 |
| **18–20** | late Act 3 | a Late-sized hit with one real rider | Sylva 18, Widow 18, Sorrow 18, Clockwork 18 · Cinder 19, Cube 19, Skyshear 19, Slate 19, Mordrax 19, Empyrean 19, Glyph 19, Revenant 19, Vex 19 · Squall 20, Zenith 20, Cortex 20 · Tixwick 18 |
| **22–24** | Act 4 | 95+ Base Power, a lockout, double-on-a-status, a whole-side heal or a pool refill | Tempest 22, Marrow 22, Scallywag 22, Bellows 22 · Crimson 23, Leviathan 23, Flurry 23, Hollowbark 23, Solace 23, Nightshade 23, Pixie 23, Gallant 23, Rex 23 · Ursa 24 · Drake 22 |

Never on one of the hero's own offer levels, so the report pays it as a beat of its own, ahead of
that level's roll when both land. `test/mastery.test.ts` pins the windows, the stagger, and that
the heaviest (the recoil nukes, the 100-power fists) sit in the last window.

**The screen.** `SignatureBox` (`MoveOfferOverlay.tsx`): a *✦ Signature Move ✦* crest, the card in
a frame whose rim is a turning sheen in the hero's type colour, and a fanfare in the element's
voice. It is learned once a run, so it is the one move screen allowed to be loud. The Dossier's
Moves tab lists it under *Signature — Lv N*.

**Exclusivity, the Class-move rule's sibling.** A signature is in no type pool, no Mentor or Tutor
pool, no graft's `learnableMoveIds`, and no path's `unlocksMoveIds` — untiered the way a Class
move is. Authored at the hero's innate primary type, so STAB is guaranteed without
`typeFollowsUser`. **Tidecaller grants Maelstrom** (2026-09-14, per user direction): a Late Water
spread taken OFF Riptide's own pool, since a signature has ONE source.

**Inside the cap.** `MOVE_CAP` is 4 and stays 4. "Decline your signature" is a sad screen and a
real decision. **Priced Late** (the ×0.75 re-price applies; floor 45). Not for the companion — a
spawn line has none.

**The enemy side.** An enemy is levelled to its node, so a hero-pool enemy holds its signature from
the same window a roster hero does. Symmetric by design; measured in §8 phase 6.

---

## 5b. The mastered innate — the tenth pip

At **ten pips** the hero's innate passive (`docs/innate-passives.md`) is **MASTERED**: replaced by
an authored upgrade of the same verb, a sizable step louder. `HeroDefinition.masteredPassiveIds`
holds it; `innatePassiveIdsFor(hero, entry)` (`src/run/innate.ts`) is the one read, and every fight
build and hero sheet goes through it, so the swap is total: the born card is gone, not stacked under.

**The authoring rule** (pinned in `test/mastery.test.ts`): the same trigger, **the innate's own name with a +** (Kindling → *Kindling+*; 2026-09-28, per user direction —
the upgrade is the same verb, and a new name read as a new card), in no pool, and **every flat figure at least doubled** — or the reach widened (one enemy → both, self →
the pair), a cap taken off (Apex Tyrant keeps Tyrant's Due's 10 and loses once-a-fight), or a roll
made certain (Boiling Point). Where one reaction cannot carry the upgrade it is two cards,
Broadside's shape, read as one innate by its first. A Burden stays a Burden: Iron Mountain still
cannot switch, and now grows for staying.

The Mastered column below names each card by its id (Forgeheart is `forgeheart`); the player reads it as
its innate's name plus a +. The hero dossier shows the innate alone, with a + key that turns it to the
mastered card. The table is the first 45 heroes; the rest author theirs in `src/data/heroes.ts`.

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
| Revenant | Ghostlight (+25% Spirit vs Haunted) | **Wraithfire** — +50% |
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
| Drake | Slumber (Rest: Ambush 45) | **Dragon's Dream** — Rest: Ambush 90 |
| Nautilus | Ink (switch out: −10 Atk/Int both) | **Abyssal Ink** — −25 Atk/Int both |
| Tixwick | Poised (a non-damaging move: next attack +1 priority) | **Deathtrap** — +1 priority and Ambush 30 |

Boiling Point is Boiler's own card mastered, so it keeps `scaledBy` — the same holder, not a
second exception to the flat-passive rule (CLAUDE.md). Every figure is a first pass.

**The screen.** The Scroll that lands the tenth pip raises `MasteredInnateOverlay` (via
`masteryFlow.ts`): the born card small and struck through, *becomes*, and the mastered card under
an *✦ Innate Mastered ✦* crest. Nothing to decide. The hero sheet, the stage and the scouted chip
read *Innate · Mastered* after.

**The enemy side.** `masteryForAct` reads `MASTERY_CAP` in the finale, so every hero-pool enemy
there fields its mastered innate. Before the finale no enemy is at ten.

**The companion** keeps its tier-step at ten; a spawn has no innate to master (it holds a Mark).

---

## 6. What the run feels like

Act 1: the Scribe, before the fork, pays Valor and Fang 2 each. A Cache shows in the next reward
row — three more on Valor and it turns on the spot, in front of the previewed Elite it now
counters. Or the Cache is passed for the item, and Valor turns in Act 2. The player chose.

Act 3: a contract hero arrived with pips already in it. The Scribe's two picks are the two unevolved
heroes the player fields most; the Cache, when it shows, goes to the one the Guardian's type says.
The lighter signatures are landing off the level-up report on their own.

Act 4: a few heroes are at 8–9. The Scribe cannot finish more than two of them; the Cache, the
shelf and the MVP decide the rest, and the gold it costs is a recruit not bought. Whoever reaches 10
carries its innate, mastered, into the finale.

---

## 7. What is deleted

Done: `LevelSchedule.evolutionLevel` and the `'evolution'` schedule entry (the companion's steps
moved to pips); the Evolution's raise from the level-up report; the 10–24 Evolution window and its
test; Ichor entire (`ichorReward`, `ichorDropReward`, `src/run/ichor.ts`, `IchorNodeScreen`, the
shelf's Drops, `ICHOR_FIGHTS`); and Lizard Rush's three pool memberships. Levels, XP, `L³`, the
schedule's offers and bands, growth grades, both budgets, Classes, Boons, Banners and items are
untouched.

---

## 8. Order of work

All phases **DONE**. Measured on the sim (greedy pilot unless noted).

| # | Phase | Status |
|---|---|---|
| 1 | **Mastery in** — `RosterEntry.mastery`, the who-screen, the Scribe row, the shelf, the Evolution at 5, `masteryForAct`, the companion's steps | **DONE 2026-09-14.** Full-clear 60.3 → 54.7%; the Scribe row costs 0.7 min a run, the smallest node on the map. |
| 2 | **The Cache takes Ichor's seats**; Ichor deleted | **DONE 2026-09-14.** Full-clear unmoved (54.7%), "every hero evolved" 25 → 64%; 35 pips a completed run. `spread` clears twelve points under `focus`. |
| 3 | **The signature slot** — `signatureMoveId`, the exclusivity test, Lizard Rush promoted | **DONE 2026-09-14.** (Moved off the pips in phase 6.) |
| 4 | **Author the signatures** | **DONE 2026-09-14.** Every hero has one; the numbers are a first pass — the weaker ones were waiting on the buff/debuff rework (`docs/stat-scaling.md`, since built). |
| 5 | **Re-fit** — `masteryForAct` = `2N − 2` per user direction; the Scribe's 2 + 2, the Cache and the shelf left for the designer | **DONE 2026-09-14.** Full-clear 54.2% against the pre-Mastery 62.0%: the gap is the roster-wide Evolutions the level schedule paid for free. The Scribe at 3 + 3 bought +3.8 points — the most clear per pip. |
| 6 | **The signature leaves the pips; the innate is mastered** (2026-09-24, per user direction) | **DONE 2026-09-24.** Signatures went from 0.02 to ~6 a completed run; full-clear 75.4 → 80.9% (`spread`), all of it Act 4 on — enemies holding signatures from their level does not offset the player's. Windows moved a level later 2026-09-25: noise. |

The four-act re-fit of the supply (MVP pip, 2-packs) is measured in `xp-overhaul.md` §5.

---

## 9. Locked invariants this overturns

All landed. Rows marked † were revised again in phase 6.

| Before (`CLAUDE.md` / `xp-overhaul.md`) | Became | Phase |
|---|---|---|
| Evolutions come from the schedule's `evolutionLevel` — never from a beat, never from a spend | **From five pips**, bought one Scroll each; still never a beat, and a Scroll is aimed, not spent on a screen of options | 1 |
| Evolutions spread 10–24 per hero in three groups | **Uniform: 5.** The per-hero timing identity moves onto the signature move | 1 |
| The level-up report carries exactly ONE decision kind, and raises the Evolution | Still one kind — the offer. **The Evolution raises from the Scroll node** | 1 |
| The Scroll ladder is DELETED whole — no currency, no rung, no price, no purse | **A currency returns: the Scroll, one pip, flat.** No rung, no price curve, no purse | 1 |
| The map's per-act shape | Gains **the Scribe** between the second reward row and the fork — one forced row an act | 1 |
| A generated hero walks the schedule's Evolution entry | Reads `masteryForAct`: evolved from Act 4 | 1 |
| Contract finished, hire raw — three axes (level, Evolution, kit) | **Four**: pips, `2N − 2` against `2N − 3` | 1 |
| The companion's `evolutionLevel` and `lateLevel` are tier-steps | Its steps are 5 and 10 pips; its pips die with it | 1 |
| Ichor pays aimed XP; the only way the player paces an Evolution | **Retired.** The seats go back to the Scroll Cache, the shelf sells Scrolls | 2 |
| † Moves come from ONE faucet, the schedule | A third named exception: the signature, at ten pips — **since phase 6, a level's guaranteed learn**, so the schedule stays the one faucet | 3 / 6 |
| A Class move is in no level-up pool and no Tutor pool | A sibling rule: a signature is in no pool, no Tutor, no graft list, no path grant | 3 |
| Lizard Rush is a Late Water move Tidecaller grants | **Riptide's signature**, off every pool; Tidecaller grants Maelstrom | 3 |
| † The tenth pip pays a move | **The tenth pip masters the innate**: `masteredPassiveIds` replaces `passiveIds` — in no pool, never granted anywhere else | 6 |
| A generated hero holds its signature only at ten pips | Holds it from its `signatureLevel`; the finale's carry their mastered innates | 6 |
| Never a post-fight drop of Scrolls | **The MVP pip** (2026-10-02, `xp-overhaul.md` §5) | — |

**Held:** *a bare number never gets a screen, and a screen never buys a bare number.* A pip is not
a stat; it is progress toward a named thing, and the screen that collects it shows that thing.

---

## 10. Open questions — DO NOT silently resolve

Decided and removed: Ichor's retirement (retired), Tidecaller's clause 5 (Maelstrom), enemy pips
(`2N − 2`), the Scribe row's clock (0.7 min a run), and a hero at 9 on the Scribe (takes 1, the
other lost, the card says so).

- **How much supply?** 45 pips a completed run under four acts with the MVP pip and 2-packs. The
  Scribe's 2 + 2 is the user's figure; at 3 + 3 it was the most clear per pip in every batch, and
  the case for leaving it is that the missing points are the price of Evolutions being earned.
- **The MVP's column weights.** Anchor wins most often (29%), which favours tanks; a weight below 1
  on Anchor is the dial.
- **The shelf's price and cap.** 25g a pack, 2 a visit, is a first pass. It competes with recruits
  for the same gold, which is the intended tension — watch whether it reads as one.
- **Does "who first" read as situational?** If every Evolution is a uniform power-up, the Cache
  collapses to "my best hero", and no Scroll rule fixes that — it is a content finding about the
  paths. The one mechanical retreat is a per-hero cap of 2 pips a Cache; hold it, do not build it.
- **Does a signature ever need to be a nuke?** The Class rule says never. Hold the line until an
  authored hero argues otherwise.

### Watch in playtest

- **Do the pips read on the map, not just the screen?** If a player cannot say who is closest to
  turning without opening the who-screen, the roster strip needs the pip row.
- **Does a Scribe pick on the companion feel like a trap or a bet?** It should read as a bet.
- **Does the tenth pip feel earned or inevitable?** If every carry has it by Act 3, supply comes
  down.
