# companion-call.md — The companion off the roster: a Call

> **STATUS: DECIDED 2026-10-04, per user direction — NOTHING BUILT.** The companion still joins
> after the run's first fight, but it **never takes one of the six roster slots**: it travels with
> the party, and **once a fight an active hero can spend its turn to Call it** — the companion
> casts its tier's ONE move, a whole-side move that needs no target, from off the field. **No
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
| A kit of 3 / 4 / 4 moves off its type's slate | **One Call move per tier**, whole-side — §3.2 |
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

### 3.2 One move, whole-side

**Each line has ONE Call move per tier** — `TitanspawnLine.callMoveIds: Record<SpawnTier, string>`
— and **every Call move covers a whole side**: `bothEnemies` or `bothAllies`. Never `singleEnemy`,
`singleAlly`, `self`, or `allOthers` (which would strike the caller's own partner). So **a Call
never asks for a target**: tap the companion, read its one card, press **Call**. No kit, no list,
no target panel, nothing greyed. The decision is WHEN, and WHO gives up the turn.

The spawn kits (`moveIds`, 3 / 4 / 4) stay as they are — they are what an ENEMY spawn fights with.
The Call move is drawn from the type's whole slate at the tier's band, not only from the kit.

**First pass, picked by name — needs a pass that reads each move's effects** (34 of 42 filled from
the slates; the 8 gaps have no whole-side move at that band and need one authored):

| Line | Early | Mid | Late |
|---|---|---|---|
| Fire | Spark Flash | Backdraft | Firestorm |
| Water | Tide Guard | Oasis | High Tide |
| Frost | Rime Wind | Blinding Snow | Avalanche |
| Storm | **author** | Chain Lightning | Ion Cascade |
| Stone | Tremor | Bastion | Rampart |
| Nature | Regrowth | Wild Bloom | **author** |
| Light | **author** | Benediction | Divine Grace |
| Shadow | **author** | Smoke Bomb | Umbral Wave |
| Arcane | Mana Font | Arc Pulse | Cataclysm |
| Mind | **author** | Disorient | Psionic Wave |
| Spirit | **author** | **author** | **author** |
| Iron | **author** | Reinforce | Swinging Chain |
| Mech | Overclock | Whirling Blades | Meltdown |
| Beast | Howl | Thrash | Animal Spirit |

Snow Blast and Frigid Air are `allOthers` and excluded. Spirit's slate is single-target throughout.
The eight are authored as ordinary slate moves (`docs/authoring-moves.md`), pooled for heroes like
any other, so the Call adds content, not a parallel move list.

### 3.3 Restrictions

None needed at runtime: the Call move is authored, and test pins every `callMoveIds` entry as
whole-side, of the line's type, at the tier's band, and not a pivot.

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
  target (it is whole-side). Ordered by the move's priority and the Called caster's Speed, resolved
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

- **The Call table** (§3.2): the 34 picks were chosen by name; each needs reading for effect, and
  the eight gaps need authoring.
- **The woken line's cross-run reward** (§3.4): a Call that refreshes in every fight's second half,
  or none beyond the finale refresh.
- **Placement**: the field figure is for playtest; the fallback if it distracts.
- **Act 1**: is a turn-costing Call enough to replace the free body, or does `ACT_LEVEL_ADJUST` move.
- **The round-3 brake** (§3.1): held in reserve, built only if measured.
- **The sim's Call policy** — the hold value and the latest point it must be spent.

---

## 11. Build order

1. **Content.** `callMoveIds` on every line; the 34 picks reviewed for effect; the eight gaps
   authored. Test pins whole-side, type, band and no pivot.
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
