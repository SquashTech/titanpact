# companion-call.md — The companion off the roster: a Call

> **STATUS: BUILT IN FULL 2026-10-04, per user direction** (content, engine, run, view, sim, docs). The companion still joins
> after the run's first fight, but it **never takes one of the six roster slots**: it travels with
> the party, and **once a fight an active hero can spend its turn to Call it** — the companion
> casts its tier's ONE move, which never asks for a target, from off the field. **No
> stake**: it cannot be lost. **The awakening refreshes the Call** for the Eyes. §11 is the build
> order; §10 lists what is still open. Reverses part of `docs/titanspawn-overhaul.md` §5 (§9 here).
>
> **REVISED 2026-10-11, per user direction — §12: the companion ACTS ON ITS OWN.** Nobody Calls it.
> Once a fight it casts its one move, free, in a round rolled inside its line's window (opening or
> middle), and that round is **telegraphed from the top of the command phase** — a ! on its figure
> and a seat on the order track; a tap reads the exact move. The enemy AI reads the telegraph too.
> **Woken, in the finale, it acts once in EACH phase** (the Herald, then the Eyes) **and its move
> resolves as Ancient**, and it opens a Titan eye. §12 supersedes §3.1, §3.4, §7's action, §8's
> Call card and the sim's Call policy; §3.2's move table and every rule in §4–§5 stand.

---

## 0. Why this exists

- **A companion run is a smaller Constructed run.** Constructed builds only heroes the player has
  won with (`docs/constructed.md` §2, the hero gate). A Titanspawn never enters Constructed, and
  the companion takes one of the six slots, so a win with the companion alive unlocks at most
  five heroes where a run that lost it unlocks six. Keeping it alive — the thing the game asks of
  the player — is the worse outcome for the meta. Patches on the gate (a companion "vouches" for a
  hero, a free pick, a guaranteed six) were weighed and set aside as confusing.
- **The fix is upstream.** If the companion is not a roster hero, every run is six real heroes,
  every win unlocks up to six, and the gate needs no exception.
- **It is less confusing and cleans up roster management.** A mortal seventh-that-is-a-sixth, with
  its own levelling, pips, gear and death beat, was a second set of rules inside the roster.
- **Titanspawn stay out of Constructed**, and **Constructed has no companion**: its six are built
  heroes. Their tiers are authored outside the 550 / 28 budgets and the Late is meant to beat a
  hero (`titanspawn-overhaul.md` §5); a second power ladder at level 30 is not worth what it costs.

---

## 1. The rule this reduces to

**The companion is a summon, not a party member.** Six heroes fight; one of them can spend its
turn to Call the companion, once a fight.

---

## 2. What the companion is today, and what each part becomes

| Today (`src/run/companion.ts`, `titanspawn-overhaul.md` §5) | Under the Call (decided) |
|---|---|
| Joins after the first fight: the beaten side's lead, cannot be declined | **Unchanged** |
| Takes one of the six roster slots; presses on the cap | **Takes none.** The roster is six heroes |
| Fielded like any hero; every fight fields the whole roster | **Never fielded.** Acts only through the Call |
| A kit of 3 / 4 / 4 moves off its type's slate | **One Call move per tier**, no target asked — §3.2 |
| A knockout removes it from the run (`RosterEntry.mortal`) | **Cannot be lost** — §5 |
| Levels roster-wide, takes schedule offers, Mastery pips, items | **None of them** — §4 |
| Tier-steps Early → Mid → Late at Mastery 5 and 10 | **Tier by act** (`SPAWN_TIER_BY_ACT`) |
| Excluded from Act 1's enemy-count cap (the Act 1 Skirmish is 3v2) | Moot — it is no body. Act 1 loses a body; §6 |
| `companion:<type>` star for a clear with it alive | **A clear with that line** — a 14-line collection |
| Awakens to Ancient at the finale; later companions of the line join Ancient | **The awakening refreshes the Call**; the cross-run reward is open — §3.4 |
| On A1 a Revive never saves it | **Retired** — nothing to save |

---

## 3. The Call

### 3.1 What it costs: a turn, once a fight

**The Call is an action an active hero takes in place of its own** — chosen where a move is, at
that hero's step of the command phase. That hero does nothing else that round; the companion
casts its move. **Once a fight** for the side.

A FREE Call was weighed and set aside (per user direction): it was a third actor nobody paid for,
off a Late line built to out-hit the roster, timeable as an unanswerable opener or a finisher, and
doubled in the finale. Costing a turn makes it a trade, not a bonus. What the turn buys is real:

- a move the hero does not have, often in a type it does not have;
- **no mana** — the cost is waived (the Called caster has no pool on the field, and some Late
  costs exceed the spawn's own);
- the spawn's stat line, not the hero's.

So an out-of-mana hero can Call instead of Resting, and a hero walled by the enemy's typing has
something useful to do with its turn.

- **Order**: at the move's own priority, **the companion's Speed** the tiebreak — the locked
  bracket rule, no special case. The order track shows where it lands.
- **If the caller's action does not happen** — it is knocked out first, Dazed, or otherwise
  blocked — **the Call does not happen and is not spent.** The rule a move already lives under,
  plus the refund that keeps a once-a-fight resource from being lost to a flinch.
- **Its stats** are its line's tier at the fight's PAR, rolled through the line's grades exactly
  as an escort's are (`docs/enemy-levels.md`) — computed at fight build, never stored.
- **A move like any other to everyone else.** Enemy reactive passives see its hit, allies'
  move-reading passives see its cast. The Called caster carries **no passives** — no Mark, no
  innate. The CALLER's own on-use passives do not fire: it did not use a move.
- **Self-side costs are dropped** — recoil, a self-Burn — there is nobody to land on.
- **The enemy has no Call.** A Guardian with one is an A2+ rung idea, not this.
- **The tuning brake held in reserve**: if the sim shows a round-one Call still decides fights,
  the Call opens at **round 3** (a pip on the figure). Not built unless measured.

### 3.2 One move, and it never asks for a target

**Each line has ONE Call move per tier** — `TitanspawnLine.callMoveIds` (`src/data/titanspawn.ts`,
the `CALL_MOVE_IDS` table) — and **a Call never asks for a target**: tap the companion, read its
one card, press **Call**. No kit, no list, no target panel, nothing greyed. The decision is WHEN,
and WHO gives up the turn.

- **Thirteen lines cover a whole side**: `bothEnemies` or `bothAllies`. Never `allOthers`, which
  would strike the caller's own partner (Snow Blast and Frigid Air are excluded for that).
- **Spirit rolls its target** (per user direction): its slate's rule is that no Spirit damage move
  spreads — Haunt is how Spirit spreads — so its Calls are one heavy hit on a `randomEnemy`, still
  no target asked. Will-o'-Wisp also Haunts the foe it finds.

The spawn kits (`moveIds`, 3 / 4 / 4) stay as they are — they are what an ENEMY spawn fights with.
The Call move is drawn from the type's whole slate at the tier's band, not only from the kit.

**Four rules choose a Call move**, pinned by `test/companionCall.test.ts`:

1. It never asks for a target (above).
2. A damaging Call swings with the stat its line spikes at that tier — physical on an Attack line,
   magical on an Intelligence line. A buff, a heal, a Shield read Wisdom or Defense, so they pass.
3. No cost on the caster — no self-Burn, recoil or HP price. It would be dropped, and the card would
   then print a price nobody pays.
4. Nothing that reads the caster's own state — no drain, no derived stat grant (Arcane Overflow),
   no own-HP or own-status condition, no partner condition.

**The table (built 2026-10-04):**

| Line | Early | Mid | Late |
|---|---|---|---|
| Fire | Spark Flash — Burn 8% on both | Backdraft — 40, Burn | Firestorm — 70 |
| Water | Tide Guard — Shield 20 on both | Oasis — heal 50 on both | High Tide — Renew 16% on both |
| Frost | Rime Wind — 25 | Blinding Snow — +1 priority, 40% Daze, −10 Speed | Avalanche — 60, Freeze |
| Storm | **Arc Flash** — 30, 30% Conduct | Chain Lightning — 50 | Ion Cascade — 50, ×2 on Conduct |
| Stone | Gravel Spray — 30 physical | Bastion — Shield 45 | Rampart — Shield 65 |
| Nature | Regrowth — Renew 9% | Wild Bloom — Renew 19% | **Greenwood** — Renew 16%, cleanse all |
| Light | **Dawnlight** — heal 25 on both | Benediction — heal 30, Shield 25 | Divine Grace — heal 90 |
| Shadow | **Knife Fan** — 25 physical, 30% Bleed | Smoke Bomb — −20 Attack, −20 Speed | **Shadowsweep** — 65 physical, 30% Bleed |
| Arcane | Mana Font — +10 MP Regen, Surging Magic | Arc Pulse — 45 | Cataclysm — 90 |
| Mind | **Psi Pulse** — 30, 30% −10 Wisdom | Disorient — −30 Int, −30 Wis | Psionic Wave — 70, 50% −30 Wis |
| Spirit | **Will-o'-Wisp** — 55 on a random foe, Haunt | **Unquiet** — 80 on a random foe | **Requiem** — 130 on a random foe |
| Iron | **Shrapnel** — 30 physical, 30% crit | Reinforce — +20 Attack, +20 Defense | Swinging Chain — 70 |
| Mech | Overclock — random +20 on both | Whirling Blades — 45 | Salvo — 65, 30% Daze |
| Beast | Howl — +15 Attack, +15 Speed | Thrash — 45 | Pack Leader — +50 Attack, +50 Speed |

Bold is new (ten moves, `src/data/moves.ts` "Companion Calls"). Against the first pass by name,
four swaps came off the rules: Stone Tremor → Gravel Spray, Shadow Umbral Wave → Shadowsweep and
Beast Animal Spirit → Pack Leader (each swung with the line's dump stat), Mech Meltdown → Salvo (a
self-Burn). Greenwood dropped the Verdant Earth it was drafted with — off Nature's Late Wisdom a
doubled Renew was ~80% of max HP a tick on both. Ion Cascade is the weakest Late, short of its ×2
without a Conduct setter; Storm Surge is the alternative.

**The ten new moves are in hero pools too** (2026-10-04, per user direction), two heroes each, on the
stat line and role they fit: Arc Flash — Skyshear, Nimbus; Dawnlight — Dawnwarden, Hart; Knife Fan
— Widow, Murk; Shadowsweep — Widow, Jinx; Psi Pulse — Lucius, Trance; Shrapnel — Gallant, Ronin;
Greenwood — Wild Oracle, Lotus; Will-o'-Wisp — Revenant, Keen; Unquiet — Revenant, Kitsu; Requiem —
Keen, Kitsu. Each slate's census test counts them; `callMoveIdSet` stays a holder in its own right
(Requiem is magical Spirit, and Revenant's pool does not reach it).

**Watch in the sim**: the support Calls off a spiked stat — Rampart ~160 Shield on each (Stone
Defense 160), Divine Grace ~190 heal each (Light Wisdom 120), Pack Leader ~+70 Attack and Speed.
Each costs a turn, as a Stone hero's Rampart does.

### 3.3 Restrictions

None at runtime: the Call move is authored, and test pins every entry to the four rules above.

### 3.4 The awakening

The companion wakes as the Herald falls (`CompanionAwakensScreen`), so **waking refreshes the
Call**: one more for the Eyes phase. What a line that has woken (`Profile.ascendedSpawnTypes`)
carries into later runs is open (§10) — the earlier "an Ancient move in its kit" does not fit one
move.

---

## 4. Growth

**Tier by act**, Early → Mid → Late on the escorts' own schedule (`SPAWN_TIER_BY_ACT` = early /
mid / mid / late / late), with the existing `grown` beat at the act boundary that steps it — the
beat now shows the new Call move.

- **No XP, no offers, no pips, no items.** Every Scribe pip, Cache pip and shelf Scroll lands on a
  real hero; every item too.
- The trainee fantasy ("weak early, above the cast late") leaves the companion. The tier steps are
  its growth.

---

## 5. The stake — none

Decided: **no stake.** The companion is always there and cannot be lost. A per-Call HP cost and a
Call that can be lost under an HP line were weighed and set aside — the rework exists to make the
companion less confusing, and a death rule held in the head is the opposite. The turn is the price
of each Call (§3.1); nothing is the price of keeping it.

- **The `companion:<type>` star** is earned by clearing a run with that line as the companion — a
  14-line collection, which line joins being the first fight's lead.
- **A1's companion rule** ("a Revive never saves the companion") is retired.

---

## 6. Balance — what must be measured

### 6.1 Measured (2026-10-04, sim, 2000 runs a side, seed 101, Base)

Against the build before phase 1 (companion on the roster, mortal), same seed:

| | skilled before | skilled Call | chart before | chart Call |
|---|---|---|---|---|
| **full-clear** | 90.3% | 90.6% | 48.5% | 49.3% |
| Act 1 | 97.9 | **95.9** | 86.7 | **80.9** |
| Act 2 | 97.0 | 98.4 | 81.5 | 85.7 |
| Act 3 | 99.5 | 99.7 | 97.3 | 98.2 |
| Act 4 | 98.8 | 99.2 | 96.6 | 97.6 |
| finale | 96.8 | 97.1 | 73.0 | 74.2 |
| Act 1 Skirmish / Elite | 98.6 / 98.3 | 96.3 / 96.3 | 89.6 / 88.7 | 84.3 / 82.2 |

- **The run is unmoved and the difficulty moved forward**: Act 1 is harder (the Skirmish is 2v2
  and the Elite loses the body it had), Act 2 easier (a sixth real hero where the trainee stood),
  the back half a point either way. The chart pilot's Act 1 −5.8 / Act 2 +4.2 is the shape.
- **The Call is used**: the skilled pilot Calls in 74% of fights with a companion (CALL_HOLD 1.5,
  spent freely in place of a Rest or with two foes or fewer standing), the chart pilot in 98% (in
  place of its first Rest, else on round 3); 94 / 81 HP a Call; 5.5% of player turns.
- **A Late spread Call is not a fight-decider**: the Act 4 Guardian and the finale moved ≤1.2
  points on either pilot.
- The dial, if the Act 1 drop is to be paid back, is `ACT_LEVEL_ADJUST`'s Act 1 term — not moved.

- **Act 1 loses its free body.** The Act 1 Skirmish was 3v2 because the cap ignored the companion
  (per user direction, Act 1 78 → 83%). Five heroes against the cap's two, plus a Call that costs a
  turn, is the new shape — a smaller replacement than a free Call would have been. This is the
  largest single number; `ACT_LEVEL_ADJUST` is the dial.
- **Six heroes on every roster** raises the floor across the run, and every Scroll and item lands
  on a hero. Full-clear rises; `ACT_LEVEL_ADJUST` absorbs it.
- **The Late Calls** — a free-of-mana Late spread off a spiked stat line, for a turn. Watch the
  Act 4 Guardian and the finale (two Calls). The round-3 brake (§3.1) is the reserve dial.
- **Contracts** no longer compete with the companion for a slot — claims may rise.
- **The Constructed gate** gains a sixth unlock on companion runs (the point of the change).
- **The sim** needs a Call policy for both pilots before any of this reads (§11, phase 4).

---

## 7. Engine

A move today needs a caster on the field. The Call needs **an off-field caster for one action**,
declared by an on-field one:

- A **Called** combatant (`Combatant.called`): present in `CombatState.combatants`, on neither the
  active slots nor the bench, with its side's `CombatState.calls[side] = { combatantId, moveId,
  remaining }` (1; the awakening adds 1 through `grantCalls`). Seated by `withCalledCaster`, which
  strips its passives. Never targetable, never fielded, never counted toward the side's defeat
  (`sideDefeated`, which the view and the sim now read), its lock-in, its mana regen or a ward.
- A new action kind, **`{ kind: 'call', combatantId }`** — `combatantId` is the CALLER, an active
  hero, and it is that hero's action for the round. No `moveId` (the Called caster has one) and no
  target (it covers a side, or rolls one foe at resolution on the `randomEnemy` path targeting.ts
  already has). Ordered by the move's priority and the Called caster's Speed, resolved
  through the existing move pipeline with the Called caster: cost waived, self-side effects
  dropped. `callsRemaining` decrements **at resolution**, and only if the caller's action was not
  blocked or pre-empted by its KO.
- **Events**: a `Called` event (caller, Called caster) ahead of the move's own, so the view brings
  the companion in and out; nothing else about presentation lives in the engine.
- **Content stays data.** `callMoveIds` is data; the Call is one engine verb, not per-spawn logic.
- **The pilot** (`src/run/pilot.ts`, `scripts/sim/pilot.ts`) scores a Call as one more option for
  each active hero, against that hero's own best option, with a hold value so it is not spent on
  round one by default.

---

## 8. UI

**In combat — on the field, for playtest** (per user direction: if it reads as too distracting, the
fallback is a key in the Bag or the bottom row).

- **The figure.** The companion stands small on the player's side of the stage, behind the pair —
  never on the bottom row, which is full (Back / Switch / Rest / Bag). **Lit, with an idle bob**,
  while a Call is left; **dimmed, resting** once spent.
- **Tap → the Call card**: its one move, read whole, with the companion's caster readouts, and one
  **Call** button. Pressing it **commits the Call as the acting hero's action**, as tapping a move
  does, and the console steps on. The acting hero's console socket shows the companion's portrait
  in place of a move; Back undoes it like any commit.
- **Queued**: the figure wears its move's type mark while a Call is committed this round.
- **Playback**: on `Called` the caller gestures, the companion leaps in from its spot, the move plays
  with its type FX, and it leaps back. The order track carries its mark in its slot.
- **The lead pick** has no companion cell.

**Outside combat.**

- **Map footer**: the last portrait in the party row beside the Roster key, set apart by a thin
  divider and drawn with no HP pip (it cannot be hurt). Tapped, its dossier: tier, its Call move,
  *a hero can spend its turn to Call it, once a fight*. A quiet mark, explained when it changes (the
  join and `grown` beats).
- **Roster screen**: a read-only chip in the header — the companion, *Calls <move>* — opening its dossier.
- **Beats kept**: the join (*X will follow you. Once a fight, a hero can call on it.*), `grown` at
  the act boundary showing the new move, the awakening, the Spawn page.
- **Off the companion**: the level report, the Scribe / Cache / item who-screens, the Fallen screen.
  The `lost` beat is deleted.
- **A first-time tip** the first fight a Call is available (`src/data/tips.ts`).

---

## 9. What this reverses

- **`titanspawn-overhaul.md` §5, "the roster slot is load-bearing."** Its argument was that a free
  seventh *body* with permadeath is always fielded as a sacrifice, so it had to cost a slot. A Call
  is not a body, so the argument does not bite — but the decision was deliberate, and this
  reverses it: contracts no longer press on the mascot.
- **CLAUDE.md, "Roster hard cap = 6 … one exception, the companion"**: there is no exception; the
  companion is not on the roster.
- **"It does not count toward Act 1's enemy-count cap"**: moot.
- **The companion's `mortal` rule and its `lost` beat**; `isCompanion` survives only for the star
  and the Spawn page. **A1's companion rule** (`docs/ascension.md`): retired.
- **The companion's levels, Mastery pips, offers and items** (`masteryForAct` readers, the pip
  tier-steps, `spawnMoveTiers` offers): retired.

---

## 10. Open questions — DO NOT silently resolve

- **Ion Cascade or Storm Surge** for Storm's Late Call (§3.2), and **which Call moves enter hero
  kits**, and whose.
- **The woken line's cross-run reward** (§3.4): a Call that refreshes in every fight's second half,
  or none beyond the finale refresh.
- **Placement**: the field figure is for playtest; the fallback if it distracts.
- **Act 1**: measured −2.0 skilled / −5.8 chart (§6.1), Act 2 +1.4 / +4.2. Whether to pay it back
  with `ACT_LEVEL_ADJUST`'s Act 1 term is the designer's.
- **The round-3 brake** (§3.1): held in reserve, built only if measured.
- **The sim's Call policy** — `CALL_HOLD` 1.5 and `CALL_SPEND_BY` 2 are first-pass, not tuned.

---

## 11. Build order

1. **Content — BUILT 2026-10-04.** `callMoveIds` on every line, ten new moves, the four rules
   pinned by `test/companionCall.test.ts`.
2. **Engine — BUILT 2026-10-04.** `CombatState.calls` and `Combatant.called`, the `call` action as
   the caller's action (`castOf` orders it off the caster), the `Called` event and the
   `callUnavailable` block, cost waived, caster-side effects dropped, spent only once the caller's
   turn happens, untargetable and outside defeat, lock-in and regen. `test/companionCall.test.ts`.
3. **Run — BUILT 2026-10-04.** `RunState.companion = { type, ascended }` replaces the roster entry and
   `companionHeroId`; `RosterEntry.mortal`, `absorbCompanions`, the pip tier-steps and the `lost`
   beat are gone. `companionCallFor` seats the act's body (`companionTier`) at the par curve's level
   (`levelAfterEncounters`) on the EXPECTED line (`expectedGrowthAt`, shared with Constructed) —
   no gear, no Banners, the same figure every fight of a stretch — through `SquadPlacement.call`,
   in the view and the sim alike. A woken companion's `SideCall.phaseGrant` adds a Call when the
   Eyes' phase enters (switching.ts). The `grown` beat sits ahead of the Pact Seal on an act
   boundary that steps the tier (`companionGrowth`). A full roster still takes the companion. The
   star reads `RunRecord.companionType` on a clear. An older save decodes, its roster companion read
   off into `companion` (save.ts `decodeCompanion`, no version bump). Act 1's cap reads the roster
   alone, so the Act 1 Skirmish is 2v2 (§6).
4. **View — BUILT 2026-10-04.** `CompanionFigure` stands between and behind the pair in the ally
   row (`.companion-perch`) — ready (bob), queued (lit ground, ✦; a tap takes it back), acting (a
   leap on its move's beat), spent (dimmed). `CallSheet` is the move dossier against the live board
   with the cost hidden (`MoveDetailCard` `free`) and one button, *Valor calls Kindlehide*. A
   committed Call puts the companion in the hero's console socket (*Calls Kindlehide*) and in its
   place on the order track; the beat reads *Valor calls Kindlehide · Backdraft · Call* in place of a
   mana price; the log has its line. Out of a fight: the companion closes the map footer's party row,
   set apart and with no bar, and the **Roster's header** carries a chip (`CompanionDossier` on a tap)
   — a strip under the grid was tried and pushed the six off the page. The `fight.call` tip fires
   the first fight a Call is ready. The dev test runs carry a companion.
5. **Sim — BUILT 2026-10-04.** The skilled pilot (`src/run/pilot.ts` `pickCaller`) scores the Call
   off the caster with `scoreCast` and Calls when it beats the caller's own best line by
   `CALL_HOLD` = 1.5, or at all when the caller would Rest or `CALL_SPEND_BY` = 2 foes stand; the
   chart pilot (`scripts/sim/fight.ts`) Calls in place of its first Rest, else on round 3. The
   report prints Calls made, the share of fights, and HP a Call. Measured in §6.1.
6. **Docs — BUILT 2026-10-04.** This file; CLAUDE.md's twelfth-overhaul banner, roster-cap paragraph
   and Ascension lines; `titanspawn-overhaul.md` §5 and `ascension.md` §7 marked superseded. The Act
   1 dial (§6.1) is left alone, per user direction.

---

## 12. The companion acts on its own (2026-10-11, per user direction)

### 12.0 Why

In play, the Call was a poor choice to make: it asked a hero to give up its turn for a move the
team had not built around, and the sim showed what it turned into — the chart pilot Called *in
place of its first Rest* 98% of the time. A way to skip a Rest, not a decision. And the finale's
awakening did nothing anyone could see: an extra Call in a fight the player had already planned,
and an Ancient secondary type on a body that is never hit.

The rework is Into the Breach's intent system, turned on the player's own side: the decision is no
longer *whether to spend it* but *what to do knowing it is coming*.

### 12.1 The rule

- **It acts on its own, once a fight.** No hero spends a turn; nobody declares it. The engine adds
  its act to the round it falls in (`companionActions`, `src/engine/combat/priority.ts`) as a
  `{ kind: 'call', combatantId: <the companion> }` action. A hero or the AI declaring one is ignored.
- **Free**, as the Call was: no mana, every caster-side cost dropped, no passives (§3.1's rules
  for the cast itself all stand). Unlike the Call it costs no turn — *a free action, and see how
  the balance shakes out* (per user direction). The concern is the later Cycles, not Cycle I.
- **The same one move a tier** (§3.2's table). Tapping the figure reads the exact move.
- **Random targets roll at resolution** (Spirit), as every `randomEnemy` move does — not at the
  telegraph (per user direction).
- **Ordered as any move is**: its move's bracket, its own Speed the tiebreak.

### 12.2 When: a window a line

`TitanspawnLine.callTiming` (`src/data/titanspawn.ts`) gives each line a temperament, and
`CALL_WINDOWS` (`src/run/companion.ts`) a window of rounds for it. The act round is **rolled inside
the window off the fight's seeded RNG when the fight is built** (`withCalledCaster`) — so a replayed
fight acts on the same round, and the variance is in WHEN, never in what.

| Timing | Window | Lines |
|---|---|---|
| **early** — setters, guards, debuffers | rounds 1–2 | Fire, Frost, Storm, Stone, Shadow, Mind, Beast |
| **mid** — healers, cleansers, finishers | rounds 3–5 | Water, Nature, Light, Spirit, Arcane, Iron, Mech |

First pass, for playtest. A fight that ends before a mid line's round never sees it act.

### 12.3 The telegraph

The act round is known from the moment the fight is built, so **from the top of that round's
command phase** (`callIntent`, `src/engine/state.ts`):

- **A ! on its figure** (between and behind the pair), lit in its move's colour, pulsing, and a
  quicker bob.
- **A seat on the order track**, at its bracket and Speed, its frame wearing the same ! — the
  track is previewed with its act in it before the player commands anyone.
- **Tap the figure → its card**: the move read whole against the live board, and *Acts this round*
  / *Acts on its own, once a fight* / *Has acted this fight*. Nothing to press.
- **The playback banner** says *Free* where a move would print its mana.
- A first-time tip (`fight.companion`) the first time the ! is up. A new id, so a player who read
  the old Call tip reads this one.

**The enemy AI reads it** (per user direction). Classic's AI (`src/run/ai.ts` `braceWeight`) makes
a guard or a Shield `WEIGHT_SUPER / WEIGHT_NEUTRAL` times likelier while the far side's companion
telegraphs a damaging move — the same ratio every other pull in that file uses, so it usually
braces and not always. The skilled pilot (`src/run/pilot.ts` `telegraphedHitOn`) counts the
telegraphed hit into what each body stands to take this round — the lethal it would refuse, a
guard's worth, a Shield's — half of it for a move that rolls one of two foes.

### 12.4 The awakening

Woken in the finale (`companionAwakenedFor`: `ascended` and `actNumber === FINALE_ACT`):

- **It acts once in EACH phase** — the Herald's and the Eyes' are separate (per user direction;
  acting every few rounds was weighed and set aside as softening the endgame). A new phase hands it
  its act back, rolled inside its window counted from the phase's first round
  (`rearmCallsForPhase`, from `switching.ts` where the phase begins). Unwoken, it acts once a fight
  however many phases there are.
- **Its move resolves as Ancient** (`SideCall.moveType`, read through `calledMove`). Ancient's
  attacks are neutral against everything, and the Eyes are mono-Ancient, whose column resists all
  fourteen other types (`docs/types-and-heroes.md`): in the Eyes' phase every hero hits at half and
  the woken companion at full — the one thing in the run the Titan's body does not shrug off. Its
  Ancient secondary (the graft it already took) gives the retyped move STAB. A heal or a Shield
  retyped to Ancient keeps its STAB too.
- **It opens a Titan eye** — the Guardians' lens (`figurePrimitives.ts` `makeEye`), drawn over its
  head on the field. The Guardians wear one Titan eye and nothing Ancient on the body; the woken
  companion has taken one from it.

A line woken on an earlier run (`Profile.ascendedSpawnTypes`) joins `ascended`, so it is woken in
every finale of that line; outside the finale it is the ordinary companion. What it carries into
the rest of a run is still open (§10).

### 12.5 What it reverses

- **§3.1** — the turn as the price, the caller, the flinch/KO refund, the round-3 brake (moot).
- **§3.4** — the awakening's refresh is now an act a phase, and the Ancient graft now does
  something: the move resolves as Ancient.
- **§7** — `CallAction` is the companion's own act; the `callUnavailable` block, `availableCall`,
  `grantCalls` and `SideCall.phaseGrant` are deleted; `Called` carries the companion and its
  resolved `moveType`.
- **§8** — the Call card's button, the queued state and the caller's console socket are gone; the
  figure is *waiting / intends / acting / spent*.
- **§11.5** — both pilots' Call policies (`pickCaller`, `CALL_HOLD`, `CALL_SPEND_BY`,
  `CHART_CALL_ROUND`) are deleted; the report prints how often the companion acted and the HP an act.

### 12.6 Measured (2026-10-11, sim, skilled pilot, 1000 runs a side, seed 101)

The Call build against this one, same seed:

| | Cycle I, Call | Cycle I, free act | Cycle II, Call | Cycle II, free act |
|---|---|---|---|---|
| **full-clear** | 83.2% | **85.4%** | 16.5% | **23.1%** |
| Act 1 | 96.8 | 97.7 | 82.9 | 88.4 |
| Act 2 | 98.9 | 99.3 | 78.0 | 83.4 |
| Act 3 | 99.6 | 99.3 | 77.7 | 83.9 |
| Act 4 | 97.6 | 98.1 | 65.6 | 69.6 |
| finale | 89.5 | 90.4 | 50.0 | 53.7 |
| acted, of fights with one | 68% (Called) | 88% | 70% (Called) | 89% |
| HP an act | 91 | 66 | 81 | 62 |

- **Cycle I barely moves (+2.2)**, as expected. **Cycle II moves +6.6**, about +5 an act in the
  front half, where permadeath makes every early fight count — the number to watch.
- An act lands for less (66 against 91 HP): it no longer waits for the best moment, and the AI
  braces against it. But it lands in nearly nine fights of ten, and it costs no turn.
- The ~11% of fights it never acts in are mid lines in fights over before round 3.

### 12.7 Open — DO NOT silently resolve

- **The windows and the line assignments** (§12.2): first pass.
- **The power of a free act.** The Call's measured figures (§6.1) were for a move that cost a turn.
  Cycle I is expected to stay easy; the later Cycles are where to look. The dials, in order: the
  windows (a later act lands on a weaker board), the move table, the act-a-phase rule.
- **The AI's brace ratio**: borrowed, not tuned.
- **The Titan eye** is drawn over the figure, not on each spawn's body — a per-line placement is
  art work if the overlay reads as a sticker.
