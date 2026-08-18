# conditions.md — Status Effect System

> Module of the Titanpact `/docs` suite. Companion to `combat.md`, `types-and-heroes.md`, `progression.md`, `mana.md`, `architecture.md`. Kept standalone until manually reconciled.

The status system is the **6th engine contract**. Its design bet is the same as the rest of Titanpact: keep the *framework* small and the *instances* rich. Pokémon's status system is a pile of bespoke special cases; ours is a handful of parameterized shapes plus a small number of documented, narrowly-scoped engine hooks for the statuses that don't fit a pure tick-based shape.

There are **nine** statuses. This supersedes the original 8-status catalog: a 2026 design review cut **Bind, Blight, and Expose** (situational, invisible/non-tactile, or redundant with a better mechanic) and added **Conduct, Poison, Haunt, and Stealth** in their place.

---

## 1. The Shapes

| Shape | Carries | Stacks | Members |
|---|---|---|---|
| **Magnitude** | a number `X` | yes (see per-status rule) | Burn, Regen |
| **Boolean** | nothing (on/off, fixed effect) | no | Bleed, Freeze, Conduct, Haunt |
| **Duration** | a turn counter `N` (on/off effect) | no (refresh/extend per move) | Daze, Stealth |
| **Timer** | a magnitude `X` *and* a turn counter `N`, but the counter only advances while active | magnitude adds, duration holds | Poison |

Every status instance is fully described by: `shape · magnitude/duration · tick-timing · decay rule · stacking rule · removal rule · effect`. Three statuses additionally hook a point in the engine outside the tick loop — Conduct (on-hit, keyed to move type), Haunt (target resolution), Stealth (target resolution) — documented per-status below and in `src/engine/combat/statusEngine.ts`'s header comment as the accepted, narrowly-scoped exceptions to "no per-status special cases."

Tick timing is **end of round** throughout (`CLAUDE.md`'s turn/round split: turn = one combatant's action, round = the full cycle) — the only tick boundary `resolveRound.ts` has (alongside bench regen). Poison's tick is additionally gated on the combatant being **active** — see its catalog entry.

---

## 2. Where statuses sit in the pipelines

Titanpact keeps two pipelines separate (locked invariant). Statuses respect that split — they do not entangle it.

**No status currently sits in the stat pipeline.** Blight, the one status that did (a multiplicative Atk/Def/Int/Wis reduction), is cut. `getEffectiveStat` (`src/engine/state.ts`) now only special-cases Freeze's Speed halving.

**No status currently sits in the damage pipeline's multiplicative modifier term.** Expose, the one status that did (a one-shot % amplifier consumed on the next hit), is cut. The `DamageModifier` accumulator in `damagePipeline.ts` stays empty until a future relic/ability fills it.

**DoTs/HoTs bypass both pipelines**, applied directly at end of round: Burn (fixed magnitude, halving), Bleed (%max-HP, fixed), Regen (heal, halving), and Poison's end-of-timer detonation (%max-HP, fixed). None of these route through the ratio or the damage multiplier.

**Conduct's detonate bonus also bypasses both pipelines.** It's computed as a flat %-of-max-HP addend and folded straight into the hit's `amount` in `resolveRound.ts`, the same treatment DoT ticks get — it is deliberately NOT a multiplicative modifier on the hit that triggers it, so it doesn't interact with STAB/TypeMult/Variance/Crit.

**Haunt and Stealth sit in target resolution, not damage math at all.** They change *which combatants* a damage move's `targetIds` end up being, computed in `resolveRound.ts` right after `resolveTargets` returns and before the `MoveDeclared` event — see `statusEngine.ts`'s `applyStealthRedirect` and `expandSpreadTargets`.

---

## 3. Status Catalog

### Burn — *magnitude · decays · escapable burst-drain*
- **Effect:** end of round, deal `X` damage, then `X = floor(X/2)`.
- **Terminates:** halving reaches 0 (Burn 20 → 10 → 5 → 2 → 1 → 0; total 38). Explicitly `floor(X/2)` — *not* `ceil`, which would stick at 1 forever.
- **Stacking:** additive magnitude.
- **Removal:** cleared by **switching to bench**; cleared by **Cleanse**.
- **Role:** front-loaded pressure. Hurts now, fades, and you can run from it. The DoT with an exit.

### Bleed — *boolean · flat · inescapable chip*
- **Effect:** end of round, deal **5% of max HP**. Fixed. No magnitude.
- **Reapplication:** you are Bleeding or you are not. Re-applying to a Bleeding target is a **no-op** — Bleed moves want a secondary effect so they aren't dead draws.
- **Removal:** **Cleanse only.** Does **not** clear on switch.
- **Role:** the anti-tank clock (~20 rounds solo; scales against big HP pools, not against armor). Inescapable by design — you can't pivot out of it.

### Freeze — *boolean · control*
- **Effect:** **halve Speed.**
- **Removal:** cleared by **switching**; cleared by **Cleanse.**
- **Role:** soft tempo control. You act through it slower; pivoting clears it. Binary partner to Bleed — the two dial-less statuses are one DoT and one control.

### Daze — *duration · hard action-denial · expensive*
- **Effect:** **cannot attack. Can switch.** (The "can switch" defines that Daze does *not* lock switching.)
- **Duration:** move-determined, almost never above **2–3**.
- **Cost:** priced high — this is hard denial, the expensive lever.
- **Removal:** duration expiry; **cleared by switching**; **Cleanse.**
- **Role:** tempo tax. Denies an action outright but leaves repositioning open, so you're paying the fight's economy for a hard-but-incomplete denial.

### Regen — *magnitude · positive · the mirror of Burn*
- **Effect:** end of round, heal `X`, then `X = floor(X/2)` — the sign-flipped mirror of Burn's decay curve.
- **Stacking:** additive magnitude.
- **Removal:** persists through switch. **Never stripped by Cleanse** — Regen is one of the two positive statuses (with Stealth), and Cleanse is a flat catch-all that spares positives entirely (§7).
- **Role:** the only *buff* inside the status framework, precisely because it's a per-round tick. Every other buff is a flat stat modifier in the existing system — keep the two from overlapping.

### Conduct — *boolean · type-triggered mark-and-detonate*
- **Effect:** landing a **Storm or Iron** damage hit on a target **without** Conduct applies it (no extra damage this hit). Landing a **Storm or Iron** damage hit on a target **already carrying** Conduct instead detonates it: an extra **10% of the target's max HP** as bonus damage, and the mark is consumed.
- **Apply and detonate are always separate hits** — a single hit never both applies and detonates. This is what keeps the status visible and playable rather than collapsing into "Storm/Iron just hits harder."
- **Authoring:** unlike every other status here, Conduct is **not attached to specific moves** via `statusApplication`. It auto-triggers off `StatusDefinition.triggerTypes` for *any* `kind: 'damage'` move whose type is Storm or Iron (`statusEngine.ts` `applyOrDetonateTriggeredStatuses`) — the whole existing Storm/Iron movepool exercises it for free.
- **Removal:** persists through switch (**provisional** — the design review didn't state this explicitly; treated as a mark meant to be cashed in later, same reasoning the cut Expose used). Cleared by Cleanse.
- **Role:** gives Storm and Iron a shared signature status without inventing two. A natural doubles combo: one hit marks, a different hit (same hero or a partner) cashes it in.

### Poison — *timer · delayed detonation · builds up*
- **Effect:** the first application starts a **3-round timer** carrying a magnitude `X` (the eventual damage %). At the timer's end, deals **X% of max HP** and is consumed.
- **Ticks only while active.** Switching the poisoned hero to bench **stalls the timer** — it does not clear the status and does not advance it. The poisoner has to play around the stall; the poisoned side can buy time by benching.
- **Reapplication:** the magnitude **accumulates additively**; the timer **never resets or extends**. A second application while the timer is already counting down just raises the eventual payout.
- **Removal:** **not cleared by switching** (see above — it stalls instead). Cleared by Cleanse.
- **Role:** replaces the cut Blight. Where Blight was an invisible, non-tactile stat drain, Poison is a visible clock with a visible payoff — the tactility Blight lacked.

### Haunt — *boolean · target modifier*
- **Effect:** while active on a hero, a **Spirit or Mind** damage move that targets that hero's **non-Haunted partner** (`singleEnemy` targeting) **also strikes the Haunted hero** — single-target becomes spread.
- **Scope (LOCKED, 2026-08-18 designer sign-off):** only expands `singleEnemy` targeting. A move that's already spread (`bothEnemies`/`allOthers`) is untouched by Haunt — strictly single→spread, never spread→bigger-spread. This caps Haunt's burst ceiling at "one extra full-damage hit" rather than letting it roughly double an already-spread move's output (no spread-damage reduction in combat math).
- **Removal:** cleared by **switching**. Cleared by Cleanse.
- **Role:** unmistakably Spirit/Mind. A novel verb (retarget/multiply) rather than another DoT — fills the Spirit/Mind status hole in the element coverage map.

### Stealth — *duration (1 round) · positive · self-buff redirect*
- **Effect:** for the round it's cast, the hero **cannot be targeted by a single-target attack** (`singleEnemy`/`singleAlly` `kind: 'damage'` moves) — **spread moves still land** regardless.
- **The speed hook:** actions declare-then-resolve in priority/speed order. If the Stealth-granting move resolves **before** an already-declared single-target attack aimed at that hero, the attack **redirects onto the other active hero on that side** when it comes up. If Stealth resolves **after** (the caster was slower), the attack has already landed — Stealth doesn't retroactively save it.
- **Removal:** authored with `duration: 1`, so it expires on its own at the next end-of-round tick — reuses the same countdown-to-removal path Daze uses. **Never stripped by Cleanse** (positive, alongside Regen).
- **Role:** the one status that reads Speed as a defensive resource instead of just a turn-order tiebreaker — out-speeding matters even on a move that deals no damage.

---

## 4. Removal Model

Two mechanisms, no more:

**Switch to bench** — the acute-effect exit. Clears **Burn, Freeze, Daze, Haunt**. The persistent nasties (**Bleed, Conduct, Poison**) follow you regardless — Poison's timer additionally *stalls* rather than clearing, so bench-parking doesn't erase the threat, only delays it.

**Cleanse** (keyword) — the catch-all. Wipes every non-positive status from a target in one action, **never** touching the two positive statuses (Regen, Stealth) — a flat rule (`StatusDefinition.positive`), not a per-move choice (§7).

| Status | Switch clears? | Cleanse clears? |
|---|---|---|
| Burn | ✅ | ✅ |
| Bleed | ❌ | ✅ |
| Freeze | ✅ | ✅ |
| Daze | ✅ | ✅ |
| Regen | persists | ❌ (positive) |
| Conduct | persists (provisional) | ✅ |
| Poison | stalls, doesn't clear | ✅ |
| Haunt | ✅ | ✅ |
| Stealth | persists (moot — 1-round) | ❌ (positive) |

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

Moves use these verbs against that interface:

- **Gate** — behavior changes on presence/threshold.
  *"Priority +2 vs a Poisoned target." · "×2 damage vs Burning." · "Can't be resisted vs Dazed." · "×2 vs Burn ≥ 20"* (threshold gates are the payoff for magnitude being real — Burn's *size* is queryable, not just its presence).
- **Consume** — detonate the status for effect and remove it.
  *"Deal damage equal to 3× the target's Burn, then clear it."* Turns DoTs into ammunition. Conduct is now the built-in case for this verb (any Storm/Iron hit is an implicit "consume Conduct" check); this generalizes further to other statuses via `statusApplication`-authored moves.
- **Transmute** — convert or spread.
  *"Convert the target's Burn into Poison of equal magnitude." · "Spread this target's Bleed to its partner."* Haunt is now the built-in case for the spread half of this verb (type-triggered, not move-authored). Very doubles-native, higher balance risk — **ship anything beyond Haunt/Conduct/Stealth last.**

---

## 6. Combo-Pricing Principle

**Any move that reads a status is priced against the world where that status is already present.** A hero who applies Conduct *and* carries a second Storm/Iron move to detonate it is a two-card combo in one body. That's good design space — it's the setup/payoff structure doubles wants — but the *combined* cost must be priced as a combo, not as two independent moves. The failure mode is a single hero who runs the whole loop solo and collapses the doubles-coordination premise.

Prefer splitting the loop across the team (one hero marks with a Storm move, another cashes in with an Iron move; one hero Haunts, another brings a Spirit/Mind attacker). Where it lives on one hero, price the payoff move assuming the setup is already paid for.

---

## 7. Open Questions — designer sign-off required

**Implementation status:** the engine (`src/engine/combat/statusEngine.ts`,
`src/data/statuses.ts`) implements the full 9-status system described in this
doc, including the 2026 design review's answers to the previous catalog's open
questions. Where the review gave an explicit answer, the engine adopted it —
**these are provisional implementation choices, not final designer sign-off**,
the same status as e.g. `PROVISIONAL_CRIT_CHANCE`. They're real, tested code,
not prototype placeholders, but still need confirmation before being promoted
to LOCKED the way `combat.md`'s 2026-08-15 decisions were.

Resolved by the 2026 review, implemented as stated:
- **Conduct apply-vs-detonate.** Applying hit and detonating hit are separate — never the same hit.
- **Poison "builds up."** Reapplying adds to magnitude; the timer never resets or extends.
- **Cleanse & positive statuses.** Cleanse never strips positives (Regen, Stealth), full stop — implemented as `StatusDefinition.positive`, not a per-move scope choice.
- **Stealth command-then-resolve timing.** A faster Stealth redirects an already-declared attack onto the target's partner; a slower Stealth doesn't save its caster from an attack that resolves first.

**LOCKED (2026-08-18 designer sign-off, not just a provisional implementation choice):**
- **Haunt + native spread.** Strictly single→spread — Haunt does NOT double-hit a move that's already spread (`bothEnemies`/`allOthers`); native spread is untouched. This was the engine's conservative default and is now confirmed, not just flagged. Rationale: no spread-damage reduction in combat math means a "yes" answer would roughly double a spread move's output whenever Haunt is up — locking the conservative reading caps that burst ceiling at "one extra full-damage hit."

Still open — **do not silently resolve**:
- **Duration authoring ranges.** Not enforced by the engine — a move can author any `duration` value; the soft caps (Daze 1–2/rarely 3) are followed by the fixture moves in `src/data/moves.ts` but nothing guards against a designer exceeding them.
- **Conduct's switch behavior.** Implemented as persisting through switch (a mark meant to be cashed in later), but the design review's notes don't state this explicitly — confirm the intended read.
- **Stat-modifier persistence** (`CLAUDE.md` flagged). Governs whether *ordinary* flat mods reset on switch, which shapes bench-regen cycling. Already resolved independently in `combat.md`: flat mods persist through switch.

---

## Appendix — quick-reference table

| Status | Shape | Effect | Tick | Decay | Stacks | Switch | Cleanse |
|---|---|---|---|---|---|---|---|
| Burn | magnitude | `X` dmg | EoR | `floor(X/2)` | additive | clears | ✅ |
| Bleed | boolean | 5% max HP | EoR | — | no | persists | ✅ |
| Freeze | boolean | ½ Speed | — | — | no | clears | ✅ |
| Daze | duration | can't attack, can switch | EoR | N→0 | takeHigher | clears | ✅ |
| Regen | magnitude | heal `X` | EoR | `floor(X/2)` | additive | persists | ❌ positive |
| Conduct | boolean | mark; +10% maxHP on detonate | on hit | consumed on detonate | no | persists (provisional) | ✅ |
| Poison | timer | X% maxHP at timer end | EoR, active only | magnitude none, timer N→0 | magnitude adds, duration fixed | stalls | ✅ |
| Haunt | boolean | singleEnemy Spirit/Mind → spread | — | — | no | clears | ✅ |
| Stealth | duration | untargetable (single-target only) 1 round | EoR | N→0 | no | persists (moot) | ❌ positive |
