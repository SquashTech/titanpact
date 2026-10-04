# stat-scaling.md — Buffs and debuffs: scaled bases, the ceiling, the noise floor

> **STATUS: BUILT IN FULL 2026-09-14** (per user direction — option A of two, after a
> Pokémon-shaped stage system was weighed and set aside, §0). A move's stat delta lands scaled off
> the caster (§2), every fight modifier is held inside **−½ … +3× of (base + loadout)** (§3 — the
> buff half at ×4, not the ×2 first proposed, the designer's call after a full playtest run), the
> sub-floor entries were re-authored (§4), and the fight screen reads it (§5). Measured: full-clear
> 61.6% → 66.4% over the pre-scaling baseline on the greedy pilot (§8). What is still open is in
> §10.

---

## 0. Why this exists

A buff or debuff was the one magnitude in the game that did not scale. Heals read the caster's
Wisdom; a DoT read the stat its move swung with. A +20 Attack was +20 Attack in Act 1 and in the
finale, on a 30-Attack caster and a 105-Attack brawler alike. Three things followed, measured
against the tree as of 2026-09-14 (base stats at their roster medians — Attack 60, Defense 55,
Intelligence 40, Wisdom 46):

1. **A single cast could sit inside the dice.** Variance is 0.85–1.0, so a high roll is 1.18× a
   low one. Kindle (+20 Attack) on a 90–105 Attack hero was ×1.19–×1.22, and the modal debuff
   rider (−10 Defense) ×1.22. The player could not tell the buff from the roll.
2. **A flat buff decays with the run, and this run levels hard.** Kindle went from ×1.33 in Act 1
   to ×1.17 in Act 5 with nothing on the card changing.
3. **There was no ceiling.** `getEffectiveStat` floors every stat at 1 and capped nothing;
   `combat.md` listed "a cap on stat modifiers" and "a Haze verb" as the two open levers beside the
   Pact Clock.

The slates already knew all three: Frost Wall (+60 Defense to both), Exalt (+100 Intelligence),
Juggernaut (+50/+50/+50) — the authors wanted a big moment and had only a bigger number.

**The alternative set aside.** A stage system — ±3 steps, ×1.5 / ×2 / ×2.5 and their reciprocals,
capped — fixes all three at once. It was set aside because a step is a discrete dial where the
slates use a continuous one, and because **a flat buff helps a weak stat more than a strong one** —
+40 Defense on a 30-Defense glass cannon is +133%, where ×1.5 is a cantrip. "Buff the squishy" is a
play worth keeping on purpose. So the numbers stay flat and authored, and this doc adds the scaling
every other magnitude has, the ceiling `combat.md` asked for, and an authoring floor.

---

## 1. The rule this reduces to

**A buff is a rider, and riders scale with the caster.** The status-magnitude rule (`CLAUDE.md`,
`combat.md` "Scaled status magnitudes") says *the authored magnitude is a BASE; what lands is
`authored × StatMult × STAB`.* This doc extends that sentence to `statDeltas` and changes nothing
else. **Authored bases are multiples of 5; what lands is base × multiplier.**

The stat pipeline still produces only the ratio. A scaled delta is still a flat number added to the
stat, in `statModifiers`, read by `getEffectiveStat`. No % term is added to any stat — the
multiplier is applied to the *grant*, once, at cast.

---

## 2. The formula

    landed = round(authored × StatMult × STAB)
    StatMult = 1 + (casterStat − 50) / 100, clamped [0.5, 2.0]

The constants are the heal and status formulas', so the player reads one rule.
`src/engine/combat/statDeltaScaling.ts` (`scaleStatDelta`, `resolveStatDeltaFor`, `statDeltaRole`),
wired into `resolveRound`'s delta loop. **Snapshotted at cast**, as a HoT is.

### Which stat is read

| Delta | Reads | Why |
|---|---|---|
| A **buff** (positive delta, on an ally or self) | the caster's **Wisdom** | The support stat, as a HoT's. Gives Wisdom a second job and makes a high-Wisdom hero a better *buffer* than a brawler casting the same move. |
| A **debuff** (negative delta, on an enemy) | the **offensive stat the move swings with** (`statKeysForMove`) | As a DoT's. A split slate keeps no trap-pick half. |
| A **self-debuff** as a COST | nothing — the authored figure lands | The self-Burn rule: a price is knowable before the press. |
| A **derived** delta (`derivedStatDeltas`) | nothing — already derived | It reads a live number. |
| A **passive's** `statDelta` | nothing — flat | A passive has no move to take STAB from. |
| `conditionalStatGrants` (Bloodthirsty) | nothing — flat | Loadout-shaped and live. |
| `mpRegen` | nothing — flat | MP Regen sits outside every per-hero grant; the only exempt stat. |

**STAB applies**, so an off-type buff is a natural pick, a fifth weaker, not a trap. A Class move
wears its holder's primary, so a Class buff is always STAB.

**The sign decides, not the target.** Each delta is classed by its own sign, so a mixed move (a hit
that debuffs a foe and buffs an ally) reads two stats, and that is correct.

**What the multiplier reaches.** `conditionalStatDeltas` (Prowl beside a Beast) and
`randomStatDeltas` (Overclock, Jury-Rig, Piston Punch) scale their amount the same way — one
StatMult, one rounding. Brain Flay lands no delta of its own (`requiresTargetStatReduction`).

### Worked numbers

Kindle (+20 Attack, self) off a Wisdom-40 Fire brawler: 20 × 0.9 × 1.25 = **+23**; off Wisdom 75:
**+31**; at level 28 on Wisdom 80: **+33**, still ×1.28 on a ~115 Attack where unscaled it would be
×1.17. Weaken (−20/−20) off a magical Shadow hero at Intelligence 85: **−34** each; off an off-type
physical hero at Intelligence 25: **−15**. The dedicated debuffer at twice the dabbler is the point.

The decay it leaves is real: `1 + (stat − 50)/100` does not double when the stat doubles, so a +20
buff shifts the ratio by ~0.38 in Act 1 and ~0.29 in Act 5 — a quarter lost against half unscaled.
The Late band's larger bases (§4) carry the rest. A steeper constant (`stat / 50`) is §10's open
dial.

---

## 3. The ceiling — BUILT, as `[−½S, +3S]`

**A stat's fight modifier is held inside `[−½S, +3S]`, where `S = base + loadout`: a debuff can at
most halve a stat, and a buff can at most take it to four times what it started the fight at.**
Hero-relative, so a specialist stays the specialist. `statModifierFloor` / `statModifierCeiling` /
`applyStatModifierDelta` in `src/engine/state.ts` (`STAT_CEILING_MULTIPLE` = 4), used by every
writer of `statModifiers` — a move's deltas and a passive's `statDelta`.

- **Clamped at WRITE, not at read**, so `StatChanged.delta` reports what landed and
  `getEffectiveStat` is untouched. `StatChanged.capped` marks a change the band shortened; a delta
  that lands 0 still emits (the player should see why nothing happened), and a stat-reactive
  passive (Frozen Stone, Entanglement) still fires on the attempt.
- **`S` reads `baselineStatModifiers`**: equipment, Banners, Evolution and Class grants raise the
  band with the base. Conditional and field-effect grants are read live and sit outside it; the
  floor at 1 still holds and nothing authored can reach it.
- **The compounders.** Apex Predator's second cast lands the rest of the way to ×4 and no further
  (`test/beastMoves`); Arcane Overflow's Attack half caps on a low-Attack caster while its
  Intelligence half lands in full (`test/arcaneMoves`).
- **The Pact Clock stands.** The band bounds setup, not a sustain stall. `combat.md`'s "a cap on
  stat modifiers" lever is closed; "a Haze verb" stays open (§10).
- Freeze's Speed halving applies after the clamp.

---

## 4. The noise floor, and the bands

Scaling holds a buff's *relative* size across the run, so a buff inside the dice in Act 1 would stay
there. That is an authoring rule, pinned by `test/statScaling.test.ts`:

**A buff move's BODY is authored at ≥ 20 on one stat, or ≥ 15 a stat when split or paid to both
allies; a delta RIDING a hit may go to 10; nothing is authored at 5.** Speed and MP Regen do not
count toward a body. A debuff body takes the same floor. A Class move is exempt — its body is its
verb. At the roster medians, 20 is outside the 1.18 variance band on every stat but Speed.

| Band | Body base | Rider base |
|---|---|---|
| Early | 20–30 | 10 |
| Mid | 30–50 | 10–20 |
| Late | 50–75 | 20–30 |

The re-author is done (2026-09-14): the sub-floor entries were raised to the floor, every signature
already sat inside the bands, and `authoring-moves.md` "`statDeltas`" carries the bands for new
slates. **Exalt stays at +100** — the one card whose number reads "to the cap" (§10).

---

## 5. What the fight feels like

- **The buffer is a role.** Who casts the buff matters, and the hero sheet can say so.
- **The number the card shows is the number that lands.** `MoveTile` and `MoveDetailOverlay` print
  the scaled figure for the hero holding the tile (`statDeltaReadout`), and the overlay says *can't
  go any lower* / *can't go any higher* before the press.
- **The pip strip** (`CombatantCard` `modTier`): one, two or three marks by the modifier against
  base + loadout, a debuff's third mark being the floor. The hero sheet's row reads `100 → 50`
  where the fight moved a stat (`StatBars`), with a tick at the floor and at the ceiling when it
  fits the scale. A held drop reads *can't go any lower* in the beat and log, on a `popup-floor`
  popup rather than a −0. The player-facing voice is never "the floor" or "the cap".
- **"At the limit" is a state** — a thing to switch for, debuff, or race.
- **Buffing the squishy stays a play**, and the band is hero-relative so it stays bounded.

---

## 6. Enemies and the AI

Enemies scale on the same formula off their own stats, so enemy bases need no separate table. The
enemy AI (`src/run/ai.ts`) treats a pure debuff whose every drop would land 0 as inert, and aims a
drop at the foe it still lands on (`test/ai.test.ts`); it does not price a partial hold, on purpose
— it is aim-and-don't-waste, not search. The sim pilot prices the landed and held figure.

---

## 7. What changed in the tree

- `isValidFlatStatGrant` binds every authored delta and loadout grant (`test/arcaneMoves.test.ts`);
  what LANDS is exempt, as a scaled Burn is.
- `StatChanged` carries `authored` and `capped`.
- `Combatant.statModifiers` keeps its shape — no save change.
- `combat.md` and `CLAUDE.md` carry the scaling and the band.

---

## 8. Order of work

All phases **DONE 2026-09-14**:

| # | Phase | Where it lives |
|---|---|---|
| 1 | The formula | `statDeltaScaling.ts`, `resolveRound`, `StatChanged.authored`, `test/statScaling.test.ts` |
| 2a | The floor (−½S) | `statModifierFloor`, `applyStatModifierDelta`, `StatChanged.capped` |
| 2b | The ceiling (+3S, ×4) | `statModifierCeiling` |
| 3 | The floor re-author (§4) | `src/data/moves.ts`; `test/statScaling.test.ts` pins the floors |
| 4 | Presentation (§5) | `CombatantCard`, `StatBars`, `MoveDetailOverlay`, `MoveTile` |
| 5 | Re-fit: the AI's no-op rule (§6) | `src/run/ai.ts` |

**Measured** (1000 runs, seed 11, greedy pilot):

- **The pilot fault phase 1 found:** `statDeltaValue` scored a drop on an enemy as a loss, so the
  pilot had never cast a debuff on purpose. Fixed, the pre-scaling baseline is **61.6%** full-clear,
  not 52.5%.
- **Phase 1, scaling alone:** 61.6% → 58.5%, the whole loss late, where enemy debuffs landed at
  ×2.0–2.2. Landed/authored rose by act (player 1.31 → 2.18), so the scaling tracks the run and the
  buffer archetype is real. The **debuff** side already crossed −½S in a third of Act 1 fights
  before scaling, and zeroed a stat outright in 14% — the fault the floor answered.
- **Phase 2a, the floor:** 67.7% full-clear, Act 1 90.4% — the first lever in this tree to move Act
  1 at all, once the pilot priced the held figure.
- **Phase 2b, the ceiling:** 66.4% → 67.1%, noise; 0.0% of fights past ×4 in the sim, so the top
  binds in play, not on the pilot.
- **The whole doc:** full-clear **61.6% → 66.4%**, Act 1 89.2 → 89.8%, Acts 4–5 84.6 / 89.8 → 88.1 /
  90.0. Buffs' share of casts did not move on the pilot. Only the greedy pilot measured this; a
  `--pilot chart` pass against the pre-scaling tree is owed before these are quoted as final.

---

## 9. Locked invariants this overturns

All landed with the phases above; CLAUDE.md carries the current rule.

| Before | Now |
|---|---|
| Stat modifiers are flat additive integers, multiples of 5 or 10. **No % stat mods.** | **Authored bases are multiples of 5; what lands is `base × StatMult × STAB`.** Still flat, additive, in the stat pipeline. Loadout grants stay exactly authored. |
| Two exemptions from the multiples-of-5 rule (derived grants, growth rolls) | Every in-fight delta lands unrounded-to-5; the rule binds what is authored. |
| Passive-applied magnitudes are flat | **Held**, and extended to a passive's `statDelta`. |
| A `dot` on self is a COST and never scales | **Held**, and a self-debuff delta is the same rule. |
| Stat modifiers have no ceiling | **`[−½S, +3S]`, clamped at write.** The Haze verb stays open. |
| Apex Predator and Arcane Overflow compound deliberately | Both land to ×4 and no further. |
| `combat.md` "The floor": floors at 1 and never ceilings | Floors at 1 as a defence; the band is `[−½S, +3S]`. |

**Held:** the two-pipeline separation; persist-on-switch (the band is what makes persistence safe);
the damage, heal and status formulas; the 550 and 28 budgets; the Pact Clock; "a bare number never
gets a screen".

---

## 10. Open questions — DO NOT silently resolve

Resolved and folded in above: the buff half of the ceiling (built at ×4 after play); the enemy AI
and the floor (the no-op rule, §6); Exalt at 100 (kept); Font of Power under the cap (at ×4 the
Intelligence side survives, so accepted).

- **The constant.** `1 + (stat − 50)/100` under-tracks a run in which stats double; `stat / 50`
  tracks it exactly but is a second rule. Decide from play.
- **Speed.** Scaled and capped uniformly today. Recommendation stands: say nothing special.
- **A Wisdom self-buff compounds** — Brain Ward raises the Wisdom the next Brain Ward reads. Renew's
  stacked-payoff shape, intended; the band bounds it. Flagged so the sim does not read it as a
  fault.
- **The Haze verb** — not built. A cleanse that clears stat modifiers (Purify clears statuses, not
  modifiers) is one new effect primitive and the VGC-native answer to a capped setup; which type
  it belongs to is a slate decision.
- **Bloodthirsty**, the last in-fight flat grant, held flat as loadout-shaped.
- **The enemy AI's partial holds** — a drop that lands −12 of −26 is still cast. If the band should
  shape enemy *choice* beyond no-ops, that is a change to what the shipped AI is.

### Watch in playtest

Whether a player can *feel* who cast the buff — if Wisdom's spread is too flat to make the archetype
felt, the constant is the dial. Whether the ×4 cap is reached in ordinary play or only by the
compounders. Whether the Act 1 wall moves.
