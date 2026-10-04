# companion-call.md — The companion off the roster: a Call

> **STATUS: DECIDED 2026-10-04, per user direction — PHASE 1 (CONTENT) BUILT.** The companion still joins
> after the run's first fight, but it **never takes one of the six roster slots**: it travels with
> the party, and **once a fight an active hero can spend its turn to Call it** — the companion
> casts its tier's ONE move, which never asks for a target, from off the field. **No
> stake**: it cannot be lost. **The awakening refreshes the Call** for the Eyes. §11 is the build
> order; §10 lists what is still open. Reverses part of `docs/titanspawn-overhaul.md` §5 (§9 here).

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

**The ten new moves are Call-only for now**: ordinary tiered slate moves in no hero pool. Some
belong in hero kits (per user direction) — that is a later pass, and each slate's census test
already counts them. `callMoveIdSet` is a holder in its own right for the reachability tests.

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

- A **Called** combatant: present in `CombatState.combatants`, on neither the active slots nor the
  bench, held on its side as `calledId` with a `callsRemaining` count (1; the awakening adds 1),
  holding its tier's one move. Never targetable, never fielded, never counted toward the side's
  defeat or its lock-in.
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
- **Roster screen**: a read-only *Travelling with you* strip under the six.
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
- **Act 1**: is a turn-costing Call enough to replace the free body, or does `ACT_LEVEL_ADJUST` move.
- **The round-3 brake** (§3.1): held in reserve, built only if measured.
- **The sim's Call policy** — the hold value and the latest point it must be spent.

---

## 11. Build order

1. **Content — BUILT 2026-10-04.** `callMoveIds` on every line, ten new moves, the four rules
   pinned by `test/companionCall.test.ts`.
2. **Engine.** `calledId` / `callsRemaining` on a side, the `call` action as the caller's action,
   the `Called` event, cost waived, self-side effects dropped, spent only at resolution,
   untargetable and outside defeat and lock-in. `test/companionCall.test.ts`.
3. **Run.** `RunState.companion = { heroId, ascended }` replaces the roster entry; the fight build
   adds the Called caster at the act's tier and par; the awakening adds a Call; `absorbCompanions`,
   the pip tier-steps and the companion-only `mortal` readers go; a save migration moves an
   on-roster companion off the roster; the star re-read; A1's rule retired.
4. **View.** The field figure, the Call card, the commit into the acting hero's socket, queued /
   spent states, the playback beat, the order track mark, the map footer chip, the roster strip,
   join copy, the tip; the companion off the level report, who-screens and Fallen screen.
5. **Sim.** A Call policy for both pilots; then measure Act 1, the Act 4 Guardian, the finale and
   full-clear against the current baseline.
6. **Docs.** This file to BUILT, `titanspawn-overhaul.md` §5, CLAUDE.md's roster-cap exception and
   companion lines, `docs/ascension.md`.
