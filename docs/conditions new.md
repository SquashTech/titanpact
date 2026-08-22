# conditions.md

Status effect definitions for Titanpact. Rules and contracts live here; concrete
values (tick amounts, timer ceilings, detonation percentages) live in `/data`.

This file supersedes the prior conditions module. It reflects decisions locked in
design review. **Open questions carry "do not resolve without designer sign-off"
discipline** and are collected at the bottom.

---

## Active statuses

### Burn — magnitude
- End of turn: target takes X damage, then Burn magnitude is halved.
- **Cleansed by switching out.**
- Design intent: stackable damage; decays on its own so it self-limits.

### Daze — duration
- Target cannot attack for X turns.
- **Cleansed by switching out.**
- Design intent: interacts with the mana system. A tank can dump mana to Daze a
  scary target, but pays for it by skipping its own turn.

### Freeze — *boolean · control*
- **Effect:** **halve Speed.**
- **Removal:** cleared by **switching**; cleared by **Cleanse.**

### Bleed — boolean
- End of turn: target takes 5% of max HP.
- **Does NOT cleanse on switch.**
- Design intent: straightforward, flavorful; combo / lifesteal potential.

### Regen — magnitude (positive / self-buff)
- Standard heal-over-time.
- Positive status → subject to the Cleanse-strips-positives question (see open).

### Conduct — boolean
- Applied only by a specific move that names Conduct in its own `statusApplication`
  (moves.ts `voltaicJolt`) — same authoring convention as every other status, not
  automatic.
- Once applied, **any** Storm OR Iron based attack can detonate the mark for an
  additional **10% of target's max HP** as damage, consuming it.
- Sharing the detonate mechanic across Storm and Iron gives Iron a signature status
  without inventing a second effect.
- ⚠️ **Apply-vs-detonate timing undefined.** Intended as loop-split (one hit applies,
  a separate hit detonates). If the applying hit also detonates, the status is
  invisible and collapses into "Storm/Iron hits harder." See open questions.
- ANSWER: Apply and detonate are separate
- **2026-08-21 correction:** this section originally read "applied by hitting the
  target with a Storm OR Iron based attack," and the engine matched that literally —
  `triggerTypes` drove both apply-if-absent AND detonate-if-present, so every single
  Storm/Iron damage move inflicted Conduct on a clean hit. Reported as a bug: apply
  should be a per-move authored choice (like Burn/Bleed/Poison/etc. via
  `statusApplication`), while detonate stays automatic for any Storm/Iron hit. Fixed
  in statusEngine.ts (`applyOrDetonateTriggeredStatuses` → `detonateTriggeredStatuses`,
  detonate-only) plus a new dedicated move, `voltaicJolt`.

### Poison X — timer / delayed detonation
- First instance starts a **3-turn timer**.
- **Not cleansed by switching out.** Timer only ticks down while that hero is active
  → switching stalls the clock rather than clearing it; the poisoner must play around
  the stall.
- Reapplying Poison while the timer is ticking down increases the X value   
- When the timer hits zero: deals **X% max HP** damage.
- Replaces Blight (cut). Fixes Blight's non-tactility: visible clock, visible payoff.


### Haunt — target modifier
- Applied to a unit. While active, **all Spirit or Mind attacks directed at a
  non-Haunted hero also strike the Haunted hero** — i.e. single-target becomes spread.
- **Cleansed by switching out.**
- Unmistakably Spirit/Mind. Novel verb (retarget/multiply), not a DoT.
- ⚠️ Native-spread interaction and burst-ceiling check pending. See open questions.

### Stealth — 1-turn self-buff
- For 1 turn the hero **cannot be targeted by attacks**; **spread moves still land.**
- **Outspeeding + applying Stealth redirects the incoming attack to the other active
  hero** (the Speed-matters hook).
- Positive / self-buff → subject to the Cleanse-strips-positives question, alongside
  Regen.
- ⚠️ Command-then-resolve timing needs an explicit rule. See open questions.
- **Exclusivity rule (2026-08-19, resolved): a side's two active heroes can never both
  be Stealthed at the same time.** Without this, simultaneously Stealthing both
  actives makes an entire enemy turn whiff for free — a stall tactic with no
  counterplay, not an interesting use of the Speed-matters redirect. If an
  application would create double-active-Stealth, it fizzles (no status, no event —
  same as any other blocked reapply); the move itself still resolves and still costs
  its mana. Enforced at the point of application (statusEngine.ts `applyStatus`), not
  as a switch-time guard — Stealth's own duration (protects the casting round plus
  the one after) makes a benched Stealth surviving long enough to re-enter as active
  alongside an independently-Stealthed partner structurally unreachable today, given
  one action per hero per round.

---

## Cut this review

- **Bind** — cut. Too situational (many fights have only 2 enemies; no switching
  available to deny). Its earlier rescue (Bind + Haunt) is void now that Haunt does
  its own thing.
- **Blight** — cut entirely, replaced by **Poison**. Percentage stat-drain was
  invisible/non-tactile by nature.
- **Expose** — cut, no replacement. Slow and boring; its damage-amplification job is
  covered better by Conduct.

---

## Shape taxonomy — needs revisiting

The original three-shape framing (Magnitude / Boolean / Duration) no longer maps
cleanly:

- Magnitude: Burn, Regen
- Boolean: Bleed, Freeze, Conduct
- Duration: Daze
- Poison: timer / delayed-detonation — its own shape
- Haunt: target modifier — its own shape
- Stealth: 1-turn self-buff — boolean-ish

Either accept that the taxonomy is now "core shapes plus a few distinct specials," or
re-derive the shapes to match reality. Keep the docs honest either way. Flagged, not
resolved.

---

## Element coverage map

Design lens going forward is coverage, not count: does each draftable element get a
status to call its own? (Roguelike structure keeps per-run status load low, so raw
count is not the constraint — legibility and non-overlap are.)

- **Covered:** Fire (Burn), Frost (Freeze), Storm + Iron (Conduct), Spirit/Mind (Haunt)
- **Agnostic-served:** Bleed, Regen, Stealth (place Stealth deliberately — reads
  Shadow, but Beast/predator-ambush or fully agnostic avoids double-signaturing one
  element)
- **Status-poor (holes):** Water, Stone, Mech, Beast, Nature, Light, Arcane
- **Cleanest next fill:** Arcane mana-**regen** denial (hits the regen stat, not the
  pool — surgical, distinct from the cut Sap). Unbuilt; bench interaction is the
  load-bearing decision if pursued.

Nothing forces more statuses today. Just know where the holes are before tuning
movepools.

---

## Open questions — designer sign-off required

2. **Conduct apply-vs-detonate.** Confirm applying hit and detonating hit are
   separate (loop-split), not the same hit. Answer: they are separate
3. **Poison "builds up."** Define the mechanic: bigger final pop per re-application,
   or refresh/extend the timer? Pick one. Answer:  do not refresh/extend timer.
percentage goes up
4. **Poison re-application mid-timer.** Stack payoff / reset to 3 / no-op?  Answer: no reset
5. **Haunt + native spread.** Does Haunt double-hit on already-spread moves, or is it
   strictly single→spread with no effect on native spread? Plus a burst-ceiling check
   (no spread-damage reduction in combat math means Haunt ~doubles output).
6. **Cleanse strips positives?** Resolve for Regen AND Stealth together — an enemy
   peeling Stealth/Regen is either healthy counterplay or feels awful. Answer: do not strip positives
7. **Stealth command-then-resolve timing.** If an enemy commanded an attack at a hero
   who then goes Stealth this same turn, who resolves first decides whether it
   protects. Write the rule (faster-Stealth dodges; slower-Stealth eats it, safe next
   turn). Answer: A fast stealth can redirect an attack directed at that hero

---

## Bookkeeping carried out of this review

- Bind removed → audit any move or hero note referencing switch-lock.
- Strike the earlier Bind + Haunt combo idea; Haunt is standalone.
- Confirm "switching cleanses Daze" is reflected wherever Daze is referenced.
