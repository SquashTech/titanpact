# companion-call.md — The companion off the roster: a Call

> **STATUS: DECIDED 2026-10-04, per user direction — NOTHING BUILT.** The companion still joins
> after the run's first fight, but it **never takes one of the six roster slots**: it travels with
> the party, and **once a fight it can be Called** — tapped where it stands on the field, it acts
> once with a move from its kit, off the field, costing neither active hero its turn. **No stake**:
> it cannot be lost. **The awakening refreshes the Call** for the Eyes. §11 is the build order;
> §10 lists what is still open. Reverses part of `docs/titanspawn-overhaul.md` §5 (§9 here).

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

**The companion is a summon, not a party member.** Six heroes fight; the companion is Called.

---

## 2. What the companion is today, and what each part becomes

| Today (`src/run/companion.ts`, `titanspawn-overhaul.md` §5) | Under the Call (decided) |
|---|---|
| Joins after the first fight: the beaten side's lead, cannot be declined | **Unchanged** |
| Takes one of the six roster slots; presses on the cap | **Takes none.** The roster is six heroes |
| Fielded like any hero; every fight fields the whole roster | **Never fielded.** Acts only through the Call |
| A knockout removes it from the run (`RosterEntry.mortal`) | **Cannot be lost** — §5 |
| Levels roster-wide, takes schedule offers, Mastery pips, items | **None of them** — §4 |
| Tier-steps Early → Mid → Late at Mastery 5 and 10 | **Tier by act** (`SPAWN_TIER_BY_ACT`) |
| Excluded from Act 1's enemy-count cap (the Act 1 Skirmish is 3v2) | Moot — it is no body. Act 1 loses a body; §6 |
| `companion:<type>` star for a clear with it alive | **A clear with that line** — a 14-line collection |
| Awakens to Ancient at the finale; later companions of the line join Ancient | **The awakening refreshes the Call**; an ascended line carries an Ancient move — §3.3 |
| On A1 a Revive never saves it | **Retired** — nothing to save |

---

## 3. The Call

### 3.1 What it does

**One move from the companion's current kit, once a fight, free.** In the command phase the
player taps the companion (§8), picks a move and a target exactly as for a hero, and the Call is
declared into the round beside the two heroes' actions. It costs neither active hero its turn.

- **Pick from the kit.** Kits are 3 / 4 / 4 moves (`SPAWN_KIT_SIZE`) and already split by job — a
  Water Early is Splash / Tide Guard / Refresh: a hit, a Shield on the pair, a heal. WHICH is the
  decision that makes the Call more than a button.
- **At the move's own priority, Speed the tiebreak** — the locked bracket rule, no special case.
  The order track shows where it lands. "Always first" was weighed and set aside: it would make
  every priority move pointless as a Call.
- **No mana.** The Called caster has no pool on the field and some Late costs exceed the spawn's
  own; the cost is waived. Once a fight is the price.
- **Its stats** are its line's tier at the fight's PAR, rolled through the line's grades exactly
  as an escort's are (`docs/enemy-levels.md`) — computed at fight build, never stored, so a Call
  scales with the run without the companion levelling.
- **A move like any other to everyone else.** Enemy reactive passives see its hit, allies'
  move-reading passives see its cast. The Called caster carries **no passives** — no Mark, no
  innate.
- **Once declared, it resolves**, even if both active heroes fall earlier in the round: it is off
  the field. A KO'd target retargets as a move's does.
- **The enemy has no Call.** A Guardian with one is an A2+ rung idea, not this.

### 3.2 What may not be Called

Greyed in the Call sheet, read whole like any refused move:

- a move whose only target is **self** (it leaves at once);
- a **pivot** (`switchesUserOut`);
- a move that reads **the caster's own HP**.

**Self-side costs are dropped** — recoil, a self-Burn — there is nobody to land on. A Call that
sets a field is the Herald route's shape and fits.

### 3.3 The awakening

The companion wakes as the Herald falls (`CompanionAwakensScreen`), so **waking refreshes the
Call**: one more for the Eyes phase. A line that has woken (`Profile.ascendedSpawnTypes`) joins on
every later run with **one Ancient-slate move added to its kit** — which move is open (§10).

---

## 4. Growth

**Tier by act**, Early → Mid → Late on the escorts' own schedule (`SPAWN_TIER_BY_ACT` = early /
mid / mid / late / late), with the existing `grown` beat at the act boundary that steps it.

- **No XP, no offers, no pips, no items.** Every Scribe pip, Cache pip and shelf Scroll lands on a
  real hero; every item too.
- The trainee fantasy ("weak early, above the cast late") leaves the companion. The tier steps are
  its growth.

---

## 5. The stake — none

Decided: **no stake.** The companion is always there and cannot be lost; it is pure upside. A
per-Call HP cost and a Call that can be lost under an HP line were weighed and set aside — the
rework exists to make the companion less confusing, and a death rule held in the head is the
opposite.

- **The `companion:<type>` star** is earned by clearing a run with that line as the companion — a
  14-line collection, which line joins being the first fight's lead.
- **A1's companion rule** ("a Revive never saves the companion") is retired.

---

## 6. Balance — what must be measured

- **Act 1 loses its free body.** The Act 1 Skirmish was 3v2 because the cap ignored the companion
  (per user direction, Act 1 78 → 83%). Five heroes against the cap's two, plus a Call, is the new
  shape. This is the largest single number; `ACT_LEVEL_ADJUST` is the dial if the Call does not
  cover the body.
- **Six heroes on every roster** raises the floor across the run, and every Scroll and item lands
  on a hero. Full-clear rises; `ACT_LEVEL_ADJUST` absorbs it.
- **A third actor every fight** is a new power source of its own, largest in Act 4 when a Late
  kit arrives. Watch the Act 4 Guardian and the finale (two Calls).
- **Contracts** no longer compete with the companion for a slot — claims may rise.
- **The Constructed gate** gains a sixth unlock on companion runs (the point of the change).
- **The sim** needs a Call policy for both pilots before any of this reads (§11, phase 4).

---

## 7. Engine

A move today needs a caster on the field. The Call needs **an off-field caster for one action**:

- A **Called** combatant: present in `CombatState.combatants`, on neither the active slots nor the
  bench, held on its side as `calledId` with a `callsRemaining` count (1; the awakening adds 1).
  Never targetable, never fielded, never counted toward the side's defeat or its lock-in.
- A new action kind, `{ kind: 'call', moveId, declaredTarget }`, ordered by priority and Speed with
  the rest and resolved through the existing move pipeline with this caster: cost waived, self-side
  effects dropped, `callsRemaining` decremented at resolution.
- **Events**: a `Called` event ahead of the move's own, so the view brings the companion in and out;
  nothing else about presentation lives in the engine.
- **Content stays data.** The spawn kits are data already; the Call is one engine verb, not
  per-spawn logic. The §3.2 refusals are read off move data (target, `switchesUserOut`, HP reads).
- **The pilot** (`src/run/pilot.ts`, `scripts/sim/pilot.ts`) scores a Call like any other option,
  with a hold value so it is not spent on round one by default.

---

## 8. UI

**In combat — on the field, for playtest** (per user direction: if it reads as too distracting, the
fallback is a key in the Bag or the bottom row).

- **The figure.** The companion stands small on the player's side of the stage, behind the pair —
  never on the bottom row, which is full (Back / Switch / Rest / Bag). **Lit, with an idle bob**,
  while a Call is left; **dimmed, resting** once spent.
- **Tap → the Call sheet**: the move grid headed with the companion's name and caster readouts, then
  the existing target panel. Usable at any step of the command phase; it belongs to no hero's turn.
- **Queued**: the figure wears the chosen move's type mark; tap again to cancel. A Call is declared
  into the round, not applied on the spot like a potion, so it is revocable until the round locks.
- **Playback**: on `Called` the companion leaps in from its spot, the move plays with its type FX,
  and it leaps back. The order track carries its mark in its slot.
- **The lead pick** has no companion cell.

**Outside combat.**

- **Map footer**: the last portrait in the party row beside the Roster key, set apart by a thin
  divider and drawn with no HP pip (it cannot be hurt). Tapped, its dossier: tier, kit, *Called
  once a fight*. A quiet mark, explained when it changes (the join and `grown` beats).
- **Roster screen**: a read-only *Travelling with you* strip under the six.
- **Beats kept**: the join (*X will follow you. Once a fight, call on it.*), `grown` at the act
  boundary, the awakening, the Spawn page.
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

- **The ascended line's Ancient move**: which one (an Ancient-slate move, enemy-only today), and
  whether it is the same move for every line.
- **Placement**: the field figure is for playtest; the fallback if it distracts.
- **Act 1**: is the Call enough to replace the free body, or does `ACT_LEVEL_ADJUST` move.
- **The sim's Call policy** — the hold value and the latest point it must be spent.

---

## 11. Build order

1. **Engine.** `calledId` / `callsRemaining` on a side, the `call` action, the `Called` event,
   cost waived and self-side effects dropped, untargetable and outside defeat and lock-in.
   `test/companionCall.test.ts`.
2. **Run.** `RunState.companion = { heroId, ascended }` replaces the roster entry; the fight build
   adds the Called caster at the act's tier and par; the awakening adds a Call; `absorbCompanions`,
   the pip tier-steps and the companion-only `mortal` readers go; a save migration moves an
   on-roster companion off the roster; the star re-read; A1's rule retired.
3. **View.** The field figure, the Call sheet, queued / spent states, the playback beat, the order
   track mark, the map footer chip, the roster strip, join copy, the tip; the companion off the
   level report, who-screens and Fallen screen.
4. **Sim.** A Call policy for both pilots; then measure Act 1, the Act 4 Guardian, the finale and
   full-clear against the current baseline.
5. **Docs.** This file to BUILT, `titanspawn-overhaul.md` §5, CLAUDE.md's roster-cap exception and
   companion lines, `docs/ascension.md`.
