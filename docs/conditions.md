# conditions.md — Status Effect System

> Module of the Titanpact `/docs` suite. Companion to `combat.md`, `types-and-heroes.md`, `progression.md`, `mana.md`, `architecture.md`. Kept standalone until manually reconciled.

The status system is the **6th engine contract**. Its design bet is the same as the rest of Titanpact: keep the *framework* small and the *instances* rich. Pokémon's status system is a pile of bespoke special cases; ours is a handful of parameterized shapes. The payoff is twofold — magnitude gives statuses a legible dial (Burn 20 ≠ Burn 5), and making statuses **engine-legible flags** hands the movepool a whole conditional layer for free (see *Status-Query Layer*).

There are **eight** statuses across **three shapes**. No snowflakes: every status is an instance of one shape.

---

## 1. The Three Shapes

| Shape | Carries | Stacks | Members |
|---|---|---|---|
| **Magnitude** | a number `X` | yes (see per-status rule) | Burn, Blight, Expose, Regen |
| **Boolean** | nothing (on/off, fixed effect) | no | Bleed, Freeze |
| **Duration** | a turn counter `N` (on/off effect) | no (refresh/extend per move) | Daze, Bind |

Every status instance is fully described by: `shape · magnitude/duration · tick-timing · decay rule · stacking rule · removal rule · effect`.

Tick timing is **end of turn** throughout in the original framing; `CLAUDE.md`'s turn/round split is now locked (turn = one combatant's action, round = the full cycle), and the engine ticks at **end of round** — the only tick boundary `resolveRound.ts` has (alongside bench regen). Implemented, not yet designer-confirmed against this specific split.

---

## 2. Where statuses sit in the pipelines

Titanpact keeps two pipelines separate (locked invariant). Statuses respect that split — they do not entangle it.

**Stat pipeline** (feeds the offense/defense ratio). Order of operations is **multiplicative-after-additive**:

```
effective_stat = floor( (base_stat + Σ flat_mods) × (1 − BlightX/100) )
```

Flat modifiers (the existing flat-additive system) sum first; percentage effects apply as a multiplicative layer on top. **Blight is the only status in this pipeline** — it lowers the effective Atk/Def/Int/Wis that feed the ratio.

**Damage pipeline** (the locked formula). Expose enters here as one more multiplicative term:

```
BasePower × (Atk/Def ratio) × STAB(1.25) × TypeMult × ExposeMult × Variance(0.85–1.0) × Crit
```

**DoTs bypass both pipelines.** Burn (fixed magnitude) and Bleed (%max-HP) are applied directly at end of turn — they route through neither the ratio nor the damage multiplier. This is deliberate: it means Blight amplifies *attacks*, not ticks, so there's no cross-interaction to reason about.

Multiplicative stacking is the chosen rule for all percentage modifiers (Blight, Expose, and any move/relic % terms), consistent with the already-all-multiplicative damage formula.

---

## 3. Status Catalog

### Burn — *magnitude · decays · escapable burst-drain*
- **Effect:** end of turn, deal `X` damage, then `X = floor(X/2)`.
- **Terminates:** halving reaches 0 (Burn 20 → 10 → 5 → 2 → 1 → 0; total 38). Explicitly `floor(X/2)` — *not* `ceil`, which would stick at 1 forever.
- **Stacking:** additive magnitude.
- **Removal:** cleared by **switching to bench**; cleared by **Cleanse**.
- **Role:** front-loaded pressure. Hurts now, fades, and you can run from it. The DoT with an exit.

### Bleed — *boolean · flat · inescapable chip*
- **Effect:** end of turn, deal **5% of max HP**. Fixed. No magnitude.
- **Reapplication:** you are Bleeding or you are not. Re-applying to a Bleeding target is a **no-op** — Bleed moves want a secondary effect so they aren't dead draws.
- **Removal:** **Cleanse only.** Does **not** clear on switch.
- **Role:** the anti-tank clock (~20 turns solo; scales against big HP pools, not against armor). Inescapable by design — you can't pivot out of it, which is exactly why it's kept low and flat rather than stackable.

### Blight — *magnitude (%) · persists · universal softener*
- **Effect:** reduces **Attack, Defense, Intelligence, Wisdom** by `X%` (multiplicative layer in the stat pipeline). Does **not** touch Speed (Freeze owns that) or Mana (off the resource-denial axis).
- **Cap:** **50%.** At the cap the defensive-side amplification is `1/(1−0.5) = 2×` on incoming damage — a super-effective hit's worth, on top of the type chart. Reaching 50% on all four stats is an "exceedingly rare, you broke them" state; challenge builds may chase it deliberately. The cap holds the math; rarity holds the balance.
- **Two-sided:** the blighted hero deals less (`×(1−X)`, linear, safe) *and* takes more (`1/(1−X)`, the amplification vector the cap protects). It sits on one target that both attacks and defends, so that target eats both.
- **Stacking:** magnitude accumulates **additively** toward the 50% cap; the resulting single `(1 − X/100)` applies multiplicatively.
- **Removal:** **persists through switch**; cleared by **Cleanse.**
- **Role:** built-up softening. No auto-ramp — escalation comes from the *player* stacking it. Thrives in the late-fight lock-in phase, where a target who can't switch out gets progressively more fragile. No matchup (always at least mildly useful); the texture is magnitude, not situational fit.

### Freeze — *boolean · control*
- **Effect:** **halve Speed.**
- **Removal:** cleared by **switching**; cleared by **Cleanse.**
- **Role:** soft tempo control. You act through it slower; pivoting clears it. Binary partner to Bleed — the two dial-less statuses are one DoT and one control.

### Daze — *duration · hard action-denial · expensive*
- **Effect:** **cannot attack. Can switch.** (The "can switch" defines that Daze does *not* lock switching — contrast Bind.)
- **Duration:** move-determined, almost never above **2–3**.
- **Cost:** priced high — this is hard denial, the expensive lever.
- **Removal:** duration expiry; **Cleanse.** *(Switch interaction flagged — see Open Questions.)*
- **Role:** tempo tax. Denies an action outright but leaves repositioning open, so you're paying the fight's economy for a hard-but-incomplete denial.

### Bind — *duration · switch-lock · cheap*
- **Effect:** **cannot switch.**
- **Duration:** move-determined, usually caps around **5**.
- **Cost:** cheap — its value is downstream (in what it enables), not in the effect itself.
- **Removal:** duration expiry; **Cleanse.** (Cannot be escaped by switching — the whole point.)
- **Role:** the combo-enabler. Traps a target in your persistent pressure (Bleed/Blight) and denies the bench-regen cycle. Cheap and long because it sets up rather than resolves.

> **Daze + Bind = full lock** (can't attack *and* can't switch). This is intended and self-regulating: the cost asymmetry means the full lock only exists inside the brief, expensive Daze window (1–2 turns you paid a premium for), never as a cheap sentence. Price the pair as a combo, not two independent effects.

### Expose — *magnitude (%) · one-shot mark*
- **Effect:** the next instance of damage received is amplified by `X%` (multiplicative term in the damage pipeline).
- **Consumed:** **wiped on the first instance of receiving damage.** In doubles, the **first attacker** into the mark claims the bonus, then it's gone. Intended play detonates it *same turn* (partner marks → partner hammers, before any end-of-turn tick), so the cross-turn "a DoT tick eats it" edge rarely bites.
- **Stacking:** consumed too fast to stack meaningfully; re-apply before consumption = take the higher magnitude.
- **Removal:** self-consuming; **Cleanse.**
- **Role:** the doubles mark-then-detonate setup. Distinct from Blight on both axes — Expose is one-shot burst in the *damage* pipeline; Blight is persistent softening in the *stat* pipeline. They stack productively (soften, then detonate).

### Regen — *magnitude · positive · the mirror of Burn*
- **Effect:** end of turn, heal `X`, then `X = floor(X/2)` — the sign-flipped mirror of Burn's decay curve.
- **Stacking:** additive magnitude.
- **Removal:** **Cleanse** (see Open Questions re: whether catch-all Cleanse should strip positives). Persists through switch — no reason to strip your own buff by repositioning.
- **Role:** the only *buff* inside the status framework, precisely because it's a per-round tick. Every other buff is a flat stat modifier in the existing system — keep the two from overlapping.

---

## 4. Removal Model

Two mechanisms, no more:

**Switch to bench** — the acute-effect exit. Clears **Burn** and **Freeze** only. The persistent nasties (**Bleed, Blight**) follow you; **Bind** prevents switching outright. This web is the counterplay logic: escape acute effects by pivoting, but the persistent effects punish the switch-happy, and Bind punishes the pivot itself.

**Cleanse** (keyword) — the catch-all. Wipes status in one action. This is a **key support-hero option** and the primary answer to Bleed/Blight/Bind, which switching can't touch.

| Status | Switch clears? | Cleanse clears? |
|---|---|---|
| Burn | ✅ | ✅ |
| Freeze | ✅ | ✅ |
| Bleed | ❌ | ✅ |
| Blight | ❌ | ✅ |
| Bind | ❌ (can't switch) | ✅ |
| Daze | ⚠️ open | ✅ |
| Expose | (self-consumes) | ✅ |
| Regen | persists | ⚠️ open (strip positives?) |

---

## 5. Status-Query Layer (movepool interface)

The moment statuses became engine-legible flags with magnitudes, moves gained a conditional layer **for free**. This is where "more design space than Pokémon" actually comes from — not more statuses, but statuses that moves can *read*.

Expose this as a query interface the damage and priority pipelines can read, so status-referencing moves are **data-driven move definitions, not engine code** (preserves engine/presentation separation; keeps archetypes emergent from content):

```
hasStatus(target, status) -> bool
statusMagnitude(target, status) -> int      // 0 if absent
consumeStatus(target, status) -> int        // remove, return magnitude
applyStatus(target, status, magnitude?)
```

Moves use three verbs against that interface:

- **Gate** — behavior changes on presence/threshold.
  *"Priority +2 vs a Blighted target." · "×2 damage vs Burning." · "Can't be resisted vs Dazed." · "×2 vs Burn ≥ 20"* (threshold gates are the payoff for magnitude being real — Burn's *size* is queryable, not just its presence).
- **Consume** — detonate the status for effect and remove it.
  *"Deal damage equal to 3× the target's Burn, then clear it."* Turns DoTs into ammunition; this is why magnitude matters (consuming Burn 20 is a payload, Burn 2 isn't). Expose is the built-in case; this generalizes it.
- **Transmute** — convert or spread.
  *"Convert the target's Burn into Blight of equal magnitude." · "Spread this target's Bleed to its partner."* Very doubles-native, higher balance risk — **ship last.**

---

## 6. Combo-Pricing Principle

**Any move that reads a status is priced against the world where that status is already present.** A hero who applies Burn *and* carries "×2 vs Burning" is a two-card combo in one body. That's good design space — it's the setup/payoff structure doubles wants — but the *combined* cost must be priced as a combo, not as two independent moves. The failure mode is a single hero who runs the whole loop solo and collapses the doubles-coordination premise.

Prefer splitting the loop across the team (one hero marks, another cashes). Where it lives on one hero, price the payoff move assuming the setup is already paid for. (Same principle as Daze+Bind, generalized to every status-referencing move.)

---

## 7. Open Questions — DO NOT silently resolve

**Implementation status:** the engine (`src/engine/combat/statusEngine.ts`,
`src/data/statuses.ts`) now implements the full system described in this doc.
Where an item below had a stated recommendation, the engine adopted it so the
system could ship end-to-end — **these are provisional implementation
choices, not designer sign-offs**, the same status as e.g.
`PROVISIONAL_CRIT_CHANCE`. They're real, tested code, not prototype
placeholders, but still need designer confirmation before being promoted to
LOCKED the way `combat.md`'s 2026-08-15 decisions were.

- **Cleanse & positive statuses.** **Implemented as a split**: a move's `cleanses` field is `'debuffs'` (strips everything except Regen) or `'all'` (strips Regen too) — `statusEngine.cleanseStatuses`. No separate Dispel verb exists; there's no way to strip only a subset of buffs. (a)/(b) from the original question are answered by this split existing per-move rather than as two separate keywords.
- **Daze & switching.** **Implemented as switch-clears** — `clearOnSwitch` treats Daze the same as Freeze/Burn. Confirm this is the intended read of "Daze N>1 only matters for a hero you want to keep in."
- **Regen decay shape.** **Implemented as the halving mirror of Burn** (`statusEngine.tickEndOfRound`). The flat-`N`-for-a-duration alternative isn't built.
- **Duration authoring ranges.** **Not enforced by the engine** — a move can author any `duration` value; the soft caps (Daze 1–2/rarely 3, Bind up to 5) are followed by the fixture moves in `src/data/moves.ts` but nothing guards against a designer exceeding them. Still needs either a lint/validation pass or to stay a documented-only convention.
- **Stat-modifier persistence** (`CLAUDE.md` flagged). No longer blocks Blight — Blight persists by its own status rule regardless — but still governs whether *ordinary* flat mods reset on switch, which shapes bench-regen cycling. (Already resolved independently in `combat.md`: flat mods persist through switch.)

---

## Appendix — quick-reference table

| Status | Shape | Effect | Tick | Decay | Stacks | Switch | Cleanse |
|---|---|---|---|---|---|---|---|
| Burn | magnitude | `X` dmg | EoT | `floor(X/2)` | additive | clears | ✅ |
| Bleed | boolean | 5% max HP | EoT | — | no | persists | ✅ |
| Blight | magnitude % | −X% Atk/Def/Int/Wis (cap 50) | — | none | additive→cap | persists | ✅ |
| Freeze | boolean | ½ Speed | — | — | no | clears | ✅ |
| Daze | duration | can't attack, can switch | — | N→0 | no | ⚠️ open | ✅ |
| Bind | duration | can't switch | — | N→0 | no | n/a | ✅ |
| Expose | magnitude % | +X% next damage taken | on hit | consumed | no | self | ✅ |
| Regen | magnitude | heal `X` | EoT | `floor(X/2)` | additive | persists | ⚠️ open |
