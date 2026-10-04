# conditions.md

Status effect definitions for Titanpact. Rules and contracts live here; concrete values (tick
amounts, timer ceilings, detonation percentages) live in `src/data/statuses.ts`, which
`statusEngine.ts` reads generically. Open questions carry "do not resolve without designer sign-off"
discipline and are collected at the bottom.

---

## Active statuses

### Burn — magnitude
- End of round: the holder takes X% of its max HP, then X is halved. A new Burn **keeps the higher**
  of the two, never adds (`takeHigher`).
- **Cleansed by switching out.**
- A percent of the holder's max HP, never caster-scaled (2026-09-28). The why, the conversion rate
  and Scorched Land's ¾ retention: `blessings-and-statuses.md` §3, §5.

### Daze — *boolean · control* (flinch, 2026-08-30)
- **Effect:** the target cannot use a **move** for the rest of the round. It can still Rest, and
  switches were never blockable.
- **Removal:** at the **end of the round it landed in** (`clearsAtEndOfRound`). It carries no number;
  no `statusApplication` authors a magnitude or duration for it (`test/lightMoves.test.ts`).
- **A bet on turn order, not a purchase.** A hero's action is gated on a live read when its turn
  comes up (`resolveRound.ts`), so a Daze only denies anything if its applier acted **earlier in the
  same round**; landed on someone who has already moved it is worth zero. **Speed and priority are
  the entire price** — a real tempo swing on a fast hero, dead weight on a slow one.
- A slow tank is now the worst holder of a Daze move. If a tank-shutdown role is wanted, it needs a
  different status (a real multi-round lock).
- **Open, and worth watching:** a priority-bracketed Daze move would buy its way past the Speed check
  entirely. The first slate that wants one should say so rather than slipping it in.

### Freeze — *boolean · control*
- **Effect:** **halve Speed.** **Removal:** switching; Cleanse.
- **Priced by what Frost does with it.** Frost's pool hangs payoffs off it — targeting gates
  (Glaciate, Absolute Zero) and a consume-for-double (Cold Snap) — so its worth is mostly what the
  type can do with it. A voluntary switch deletes the setup until lock-in stops it, so Frost is
  deliberately the weaker half of the fight it is strongest in. Passives can plant it too (Frozen
  Stone; Ice Shell's `onShieldBroken`).

### Bleed — boolean
- End of round: the holder takes 5% of max HP. **Does NOT cleanse on switch**; Cleanse is the only
  answer.
- **The combo payoff (Beast):** openers plant it and finishers double against it without consuming
  it, which only works because Bleed survives a switch.

### Renew — magnitude (positive)
- A percent of the holder's max HP, Wisdom-scaled at cast, healing on landing and then for 2 rounds;
  persists through switching and Cleanse and ticks on the bench (2026-09-28,
  `blessings-and-statuses.md` §4).
- **Named Renew, not Regen**: "Regen" collided with the `MP Regen` stat and had already produced one
  real bug.

### Conduct — boolean
- **Applied only by a move that names it in its own `statusApplication`**, or by a passive that
  plants it (Static Tide) — never by the detonation pass itself.
- **Apply and detonate are separate hits** (decided). Any **Storm, Iron or Mech** hit detonates the
  mark for an extra **15% of the target's max HP**, consuming it (`triggerTypes`,
  `detonateBonusPercentMaxHp` in `statuses.ts`).
- Sharing the detonate across types gives Iron a signature status without a second effect.

### Poison X — timer / delayed detonation
- First instance starts a **3-round timer**; at zero it deals **X% max HP**.
- **Not cleansed by switching.** The timer only ticks while the hero is active, so switching stalls
  the clock rather than clearing it.
- **Re-application raises X and never resets or extends the timer** (decided).
- **Forced detonation:** a move may author `detonatesStatus: 'Poison'` (`MoveDefinition`) and pay the
  timer out immediately at its current magnitude — the move buys time, not damage — and the status
  leaves as `consumed`. Written against the timer shape, not the id.
- Replaced Blight (cut). The name `blight` is now a Nature MOVE, not a status.

### Haunt — target modifier
- While active, **a Spirit or Mind attack on the Haunted hero also strikes its partner**, and **when
  the Haunted hero falls the Haunt passes to its partner** (2026-09-28, `blessings-and-statuses.md`
  §2). **Cleansed by switching out.**
- **Only single-target moves expand** (decided); native spread moves are untouched, and there is no
  spread-damage reduction.

### Ambush — a typeless Force, spent on the next attack (2026-09-07)
- Magnitude-shape, `positive`. Its magnitude is added as **flat Base Power** to the next attack the
  holder lands — **whatever type that attack is** — and is then spent.
- **It replaced Stealth** (deleted 2026-09-07), whose whole turn bought nothing but the absence of
  one attack, in a doubles game where the opponent simply hits the partner.
- **The Elemental Force family with the type taken off** (`forceAllTypes`, `consumedOnDamage`): a
  **BasePower-stage** input, so the two-pipeline separation holds; it lands **before**
  `conditionalPower`'s multiplier, so an execute never doubles it; and it is read **per hit**, so a
  spread pays on both targets and a multi-hit move (`hitCount`, Thousand Cuts) counts it each hit.
- **Flat Base Power rather than a percentage — deliberate.** A percentage would compound with crit,
  STAB, type advantage, a Force and an execute. Flat Base Power is proportionally larger on a cheap
  fast move than on a nuke (the ambusher's fantasy), and pays magical and physical moves identically.
- **Scalable, not boolean** (designer call): per-source magnitudes let granters price differently,
  since mana cost is the primary balance lever.
- **Spent after the move's hits.** A spread pays once; a buff or heal never spends it; Retribution
  (fixed damage) owes nothing. Riders resolve after the damage case, so a damage move that *grants*
  Ambush cashes the one it held and plants a fresh one (Cutthroat).
- **No clock, `clearsOnSwitch: true`.** A rider that waits is safe to hand out; clearing on switch
  stops grant → pivot out to regen → pivot back loaded (`test/statuses.test.ts`).
- **`stacking: 'additive'`, uncapped.** The brake is opportunity cost and mana; whether that is enough
  is an **open tuning question**.
- **The design rule:** a granter that costs a whole turn has to pay back **more than one attack's
  damage**, so Ambush mostly rides on turns already worth taking — a brace (Fortify), a debuff
  (Enervate), a field set (Magic Cloak), a stat turn (Shadow Form, Prowl). Lie in Wait is the one
  dedicated setup turn and is priced to clear the bar.

### Provoke — 1-round redirect (Stone)
- While active, **every single-target move the enemy side aims at this side is redirected onto the
  holder** — every move kind, not just damage. Spread moves are unaffected; a move aimed at its own
  caster's side is untouched.
- Two halves: a resolve-time redirect (`applyProvokeRedirect`) and a declaration-time narrowing of
  the target picker (`selectableTargets`), so the player is never offered a target the redirect would
  silently move the move off.
- **Duration 1, ticking at end of round** = exactly this round. **Priority +1 is load-bearing**: the
  taunt has to stand before the enemy's attacks resolve.
- It resolves before Haunt. Read generically off `redirectsSingleTargetEnemyMoves`; no literal-id
  retargeting is left in the engine.

### Barrier — *boolean · guard* (2026-09-09, Arcane)
- While active, **every move the OPPOSING side resolves against the holder turns away entirely** —
  damage and riders alike; it still resolves against anyone else, and its mana is still spent.
  **Ally moves reach through it.**
- **Priority +2, a bracket of its own**, so no Speed roll decides it. Applied after every redirect,
  so a Provoked move fizzles too.
- **`clearsAtEndOfRound`, `clearsOnSwitch`, `positive`.** Cleanse does not strip it.
- **No consecutive-use rule.** Limited instead by **mana** (it carries `manaCostGainOnUse` = 20, a
  guaranteed lockout priced by the fight) and **doubles** (it covers one body of two). Dispersal
  across heroes is the other half of the design; the pools that hold it are in
  `src/data/progression.ts`.
- Read off `blocksIncomingMoves` (`blockingStatusId`); emits `MoveGuarded` per turned-away target.

### Others in the catalog

Shield and Ice Shell (`docs/shield.md`), Beheld (`titan-eyes.md` §5), Poised, Cannonball and the
fifteen Elemental Forces are defined in `src/data/statuses.ts` with their own docs.

---

## Chanced applications

`StatusApplication.chance` gates a rider on a probability in [0, 1]; omitted means always.
- **It gates the rider, never the move** — "no accuracy stat" is untouched.
- **It rolls once per resolved target**, and draws from the seeded RNG only when the field is
  present, so unchanced riders replay byte-identically.

## More than one status per move

`MoveDefinition.statusApplication` is **one rider or a list**, read through `statusApplicationsOf`.
They resolve in authored order, each with its own targets, `chance` and passive reactions; there is
no compound status. A one-rider move draws exactly the RNG it always did
(`test/beastMoves.test.ts`).

## Chanced stat deltas

`MoveDefinition.statDeltaChance` is the sibling of `StatusApplication.chance` for stat deltas, with
the same three rules (gates the rider, rolls per target, omitted draws nothing). The roll gates the
**whole delta list together** — one coin flip, not one per stat.

## Limited cleanse

`MoveDefinition.cleanseCount`, paired with `cleanses`, strips **at most N** eligible statuses, chosen
at **random** (Wash Away, 1). **Positive statuses are never eligible.** Random, not caster-chosen —
there is deliberately no "cleanse THIS named status". It draws RNG only when it genuinely has to
choose.

## Status queries: Gate and Consume

- **Gate** — `requiresTargetStatus`: the move may only resolve against a carrier; unmet, it fizzles
  for no mana with its own `ActionBlocked` reason. Applied after Provoke/Haunt retargeting, so a
  redirect cannot smuggle a gated hit onto an unmarked hero.
- **Consume** — `conditionalPower.consumesStatus`: the hit that got the conditional multiplier spends
  the status it read (`StatusRemoved` `consumed`).

Both read live status when the action resolves, so a mark from a faster action this round counts.
Not yet in the vocabulary: gating on the *caster's* own status, gating on absence, and transmuting
one status into another. Nothing has asked for them.

---

## Cut

- **Bind** — too situational; nothing to deny with two enemies.
- **Blight** — replaced by **Poison**; percentage stat-drain was invisible.
- **Expose** — slow and boring; Conduct covers damage amplification.
- **Stealth** — replaced by **Ambush** (2026-09-07).

---

## Shape taxonomy — needs revisiting

The original three-shape framing (Magnitude / Boolean / Duration) no longer maps cleanly:

- Magnitude: Burn, Renew, Shield
- Boolean: Bleed, Freeze, Conduct, Daze (boolean plus `clearsAtEndOfRound`), Barrier
- Magnitude read as flat Base Power: Ambush and the Elemental Forces
- Duration: Provoke, Beheld
- Poison: timer / delayed-detonation — its own shape
- Haunt: target modifier — its own shape

Either accept "core shapes plus a few specials", or re-derive the shapes. Flagged, not resolved.

---

## Element coverage map

The lens is coverage, not count: does each draftable element get a status to call its own?

- **Covered:** Fire (Burn), Frost (Freeze), Storm + Iron + Mech (Conduct), Spirit/Mind (Haunt)
- **Agnostic-served:** Bleed, Renew, Ambush (Shadow-first, deliberately typeless)
- **Status-poor (holes):** Water, Stone, Beast, Nature, Light, Arcane
- **Cleanest next fill (unbuilt):** Arcane mana-**regen** denial — hits the regen stat, not the pool.
  The bench interaction is the load-bearing decision if pursued.

---

## Open questions — designer sign-off required

1. **Ambush's brake.** Additive, uncapped; is opportunity cost plus mana enough?
2. **A priority Daze move** would bypass the Speed check (see Daze).
3. **Shape taxonomy** (above).

Decided and folded in above: Conduct apply and detonate are separate hits; Poison re-application
raises X without resetting the timer; Haunt expands single-target moves only; Cleanse never strips
positives.
