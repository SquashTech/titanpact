# companion-call.md — The companion off the roster: a Call

> **STATUS: PROPOSED 2026-10-04, per user direction — NOTHING DECIDED, NOTHING BUILT.** A draft to
> think through in its own session. The companion still joins after the run's first fight, but it
> **never takes one of the six roster slots**: it travels with the party, and **once a fight it can
> be Called** — a free action in the command phase, as a potion is — to step in, act once with a
> move from its kit, and leave. Every number and most shapes below are open; §10 lists them.
> Reverses part of `docs/titanspawn-overhaul.md` §5 (§9 here).

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
- **Titanspawn stay out of Constructed.** Their tiers are authored outside the 550 / 28 budgets
  and the Late is meant to beat a hero (`titanspawn-overhaul.md` §5); a second power ladder at
  level 30 is not worth what it would cost.

---

## 1. The rule this reduces to

**The companion is a summon, not a party member.** Six heroes fight; the companion is Called.

---

## 2. What the companion is today, and what each part becomes

| Today (`src/run/companion.ts`, `titanspawn-overhaul.md` §5) | Under the Call (proposed) |
|---|---|
| Joins after the first fight: the beaten side's lead, cannot be declined | **Unchanged** |
| Takes one of the six roster slots; presses on the cap | **Takes none.** The roster is six heroes |
| Fielded like any hero; every fight fields the whole roster | **Never fielded.** Acts only through the Call |
| A knockout removes it from the run (`RosterEntry.mortal`) | Cannot be knocked out on the field. The stake moves — §5 |
| Levels roster-wide, takes schedule offers off its type's slate, takes Mastery pips, holds items | Open — §4. Proposed: tiers by act, no offers, no pips, no items |
| Tier-steps Early → Mid → Late at Mastery 5 and 10 | Proposed: tier-steps by act (the same `SPAWN_TIER_BY_ACT` the escorts read) |
| Excluded from Act 1's enemy-count cap (the Act 1 Skirmish is 3v2) | Moot — it is no body. Act 1 loses a body; §6 |
| `companion:<type>` star for a clear with it alive; the Spawn page | **Unchanged**, or "alive" re-read — §5 |
| Awakens to Ancient at the finale; later companions of the line join Ancient | **Unchanged**; Ancient changes what its Call does |
| On A1 a Revive never saves it | Re-read with the stake — §5 |

---

## 3. The Call

**Proposed shape.** In the command phase the companion's portrait sits beside the Bag. Tapping it
opens the **Call**: its kit (the moves of its current tier), each read whole. The player picks one
and a target, exactly as for a hero's move. The Call is **free** — it costs neither active hero
its turn — and resolves **in the round**, as a move does, from off the field. Once used, it is
spent for the fight.

- **Once a fight** is the proposed cadence; once an act (a scarcer, bigger beat) is the obvious
  alternative. The cadence is the main power dial.
- **Whose stats?** The spawn's own tier line at the fight's level (par), as an escort's is
  (`docs/enemy-levels.md`), so a Call scales with the run without the companion levelling.
- **Which moves?** Its tier's authored kit (the spawn kits already exist, from the type slates).
  Picking from the kit is a decision; a single fixed signature per spawn is simpler. Open.
- **When it resolves.** At the move's own priority, with the companion's Speed as the tiebreak —
  or always first, as a free action reads. Open: "always first" is strong and easy to read.
- **What it may not do.** Proposed: no switch-out moves, no self-only buffs (it leaves at once),
  no moves that read its own HP. A Call that sets a field is the Herald route's shape and fits.
- **Not a passive trigger source?** Potions and the Pact Clock are not. A Call is a move, so the
  passives that read moves would see it — whether they should is open (§10).
- **The enemy has no Call.** The AI never drinks; it would never Call. A Guardian with a Call of
  its own is an A2+ rung idea, not this.

---

## 4. Growth

Today the companion is the game's biggest late bloomer (Early trade ratio 0.43, late 3.36,
`titanspawn-overhaul.md` phase 6), paid for with roster XP, Mastery pips and offers. Off the
roster, the proposal is to **drop all three**:

- **Tier by act**, Early → Mid → Late on the escorts' own schedule (`SPAWN_TIER_BY_ACT`), with the
  existing `grown` beat at the act boundary.
- **No offers, no pips, no items.** Every Scribe pip, Cache pip and shelf Scroll now lands on a real
  hero; every item too.
- This removes the trainee fantasy ("weak early, above the cast late") from the companion. Whether
  the Call should keep some of it — a Call that grows with the number of fights it has been used
  in, say — is open.

---

## 5. The stake

A thing that never stands on the field cannot be knocked out, and the companion's mortality was its
whole tension (a KO took it in about half of runs). Options:

1. **No stake.** It is always there. Simplest; the companion becomes pure upside.
2. **A Call costs the active pair.** The Called move's recoil, or the two actives each lose a slice
   of HP — the Titan takes its due. A stake per use, not per run.
3. **The Call can fail.** Called into a fight whose active pair is both below some HP line, it is
   lost — the death beat stays, moved from the field to the Call.
4. **Wounds.** Each Call wounds the companion for the act; Called while wounded it can be lost.

The `companion:<type>` star and A1's "a Revive never saves the companion" are re-read from
whichever is chosen. Under option 1 the star is "clear the run with any companion" and A1 needs a
new rule or loses one.

---

## 6. Balance — what must be measured

- **Act 1 loses its free body.** The Act 1 Skirmish was 3v2 because the cap ignored the companion
  (per user direction, Act 1 78 → 83%). Five heroes against the cap's two, plus a Call, is the new
  shape; the sim measures whether the Call covers the body. This is the largest single number.
- **Six heroes on every roster** raises the floor across the run (no slot spent on a trainee), and
  every Scroll and item lands on a hero. Full-clear rises; `ACT_LEVEL_ADJUST` absorbs it.
- **Contracts** no longer compete with the companion for a slot — claims may rise.
- **The Constructed gate** gains a sixth unlock on companion runs (the point of the change).
- **The sim** needs a Call policy for both pilots (when to Call, what with), or every number reads a
  player who never Calls.

---

## 7. Engine

A move today needs a caster on the field. The Call needs **an off-field caster for one action**:

- A **Called** combatant: present in `CombatState`, on neither the active slots nor the bench,
  never targetable, never fielded, never counted toward the side's defeat or its lock-in. It
  declares through a new action kind (`{ kind: 'call', moveId, declaredTarget }`) that resolves
  through the existing move pipeline with this caster.
- **Events**: a `Called` event ahead of the move's own, so the view can bring the companion in and
  out; nothing else about presentation lives in the engine.
- **Content stays data.** The spawn kits are data already; the Call adds one engine verb, not
  per-spawn logic.
- **The pilot** (`src/run/pilot.ts`) scores a Call like any other option, with a hold value so it
  is not spent on round one by default.

---

## 8. UI

- **The command phase**: the companion's portrait beside the Bag, lit while the Call is unspent;
  the Call sheet is the move list with the companion's caster readouts.
- **Playback**: the companion enters, acts, leaves — a short beat, its own entrance art.
- **Run screens**: the roster screen, the level-up report and the post-fight chain stop listing the
  companion; the join beat, the `grown` beat and the Spawn page stay. Somewhere persistent shows the
  companion and its tier — a quiet mark, per the run-long-state rule, explained when it changes.
- **The lead pick** loses the companion's cell.

---

## 9. What this reverses

- **`titanspawn-overhaul.md` §5, "the roster slot is load-bearing."** Its argument was that a free
  seventh *body* with permadeath is always fielded as a sacrifice, so it had to cost a slot. A Call
  is not a body, so the argument does not bite — but the decision was deliberate, and this
  reverses it: contracts no longer press on the mascot.
- **CLAUDE.md, "Roster hard cap = 6 … one exception, the companion"**: there is no exception; the
  companion is not on the roster.
- **"It does not count toward Act 1's enemy-count cap"**: moot.
- **`RosterEntry.mortal` / `isCompanion`** and every reader of them, and **A1's companion rule**
  (`docs/ascension.md`): re-read against §5.
- **The companion's Mastery pips, offers and items** (`masteryForAct` readers, `spawnMoveTiers`
  offers): retired if §4 is taken.

---

## 10. Open questions — DO NOT silently resolve

- **Cadence**: once a fight, or once an act.
- **The kit**: pick from the tier's kit, or one fixed signature per spawn.
- **Resolution order**: the move's own priority, or always first.
- **Restrictions**: which kinds of move a Call may not be (switch-out, self-only, HP-reading).
- **Passive triggers**: does a Call fire the passives that read moves.
- **Growth**: tiers by act with no offers / pips / items (proposed), or some trainee growth kept.
- **The stake** (§5): none, a cost per Call, a failing Call, or wounds — and with it the
  `companion:<type>` star's condition and A1's companion rule.
- **The finale awakening**: what an Ancient companion's Call does.
- **Act 1**: is the Call enough to replace the free body, or does `ACT_LEVEL_ADJUST` move.
- **The sim's Call policy** for both pilots, before any of the above is measured.
