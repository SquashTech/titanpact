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
- **Load-bearing beyond its own effect (2026-08-30, Frost).** Halved Speed is a
  tempo nudge; what actually prices Freeze now is that Frost's authored pool
  hangs three payoffs off it — two hard targeting gates (Glaciate, Absolute
  Zero) and one consume-for-double (Cold Snap). It is the first status whose
  worth is mostly a function of what a type can *do with it* rather than of what
  it does. Two consequences to keep in view when tuning either half: a single
  voluntary switch still deletes the whole setup, and the lock-in rule
  (CLAUDE.md) stops it doing so once a side is two heroes down — so Frost is
  deliberately the weaker half of the fight it is strongest in.

### Bleed — boolean
- End of turn: target takes 5% of max HP.
- **Does NOT cleanse on switch.**
- Design intent: straightforward, flavorful; combo / lifesteal potential.

### Renew — magnitude (positive / self-buff)
- Standard heal-over-time.
- Positive status → subject to the Cleanse-strips-positives question (see open).
- **Named Renew, not Regen (2026-08-26).** "Regen" collided with the `MP Regen` stat in
  prose and code identifiers, and that collision had already produced one real bug —
  Verdant Earth's stat bonus was wired to `mpRegen` instead of this status. The stat
  keeps its name; the status took the distinct one.

### Conduct — boolean
- Applied only by a specific move that names Conduct in its own `statusApplication`
  (moves.ts `risingStatic`, `jolt`, `ionize`, `stormLash`, `thunderbolt`) — same
  authoring convention as every other status, not automatic.
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
  detonate-only) plus a new dedicated move, `voltaicJolt` — since replaced by the
  authored Storm slate (2026-08-30), which plants the mark on five of its fifteen
  moves and detonates it on nine.

### Poison X — timer / delayed detonation
- First instance starts a **3-turn timer**.
- **Not cleansed by switching out.** Timer only ticks down while that hero is active
  → switching stalls the clock rather than clearing it; the poisoner must play around
  the stall.
- Reapplying Poison while the timer is ticking down increases the X value   
- When the timer hits zero: deals **X% max HP** damage.
- **Forced detonation (2026-08-30, Nature).** A move may author
  `detonatesStatus: 'Poison'` (`MoveDefinition`, docs/combat.md) and pay the
  timer out immediately, at whatever magnitude it has reached, instead of
  waiting for zero. Nature's Miasma is the only content: it applies Poison 5 and
  then detonates, so its own application counts toward the pop. The amount is
  identical to what the expiry would have dealt — the move buys time, not
  damage — and the status leaves as `consumed` rather than `expired`.
  Poison is currently the only timer-shape status, so it is currently the only
  detonatable one; the field is written against the shape, not the id.
- Replaces Blight (cut). Fixes Blight's non-tactility: visible clock, visible payoff.
  (The name is now reused by a Nature MOVE, `blight` — spread Poison 20 — which
  is content, not a status.)


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
- **Declaration time (2026-08-28): an already-Stealthed hero is not offered as a target
  at all** — the target picker omits it for single-target attacks, so "cannot be
  targeted" is literal rather than something the player discovers via the redirect.
  The redirect above still covers the mid-round case, where Stealth lands *after* the
  attack was declared. Same narrow shape both sides (`selectableTargets` /
  `applyStealthRedirect`, statusEngine.ts): damage-kind, singleEnemy/singleAlly only,
  so spread moves keep listing and hitting a Stealthed hero. If the Stealthed hero is
  the only one left to aim at, it is offered anyway rather than presenting an empty
  picker — mirroring the redirect's own "no alternate, the attack goes through" branch.
- Positive / self-buff → subject to the Cleanse-strips-positives question, alongside
  Renew.
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

### Provoke — 1-round redirect (2026-08-30, Stone)
- While active, **every single-target move the enemy side aims at this side is
  redirected onto the holder.** Spread moves are unaffected. Stone's Provoke
  (25 mana, Priority +1) is the only carrier.
- **The inverse of Stealth.** Stealth pushes an attack off its holder; Provoke
  pulls every attack on the side onto it. Same hook point in `resolveRound`, same
  narrow single-target shape, and the same two halves — a resolve-time redirect
  (`applyProvokeRedirect`) and a declaration-time narrowing of the target picker
  (`selectableTargets`), so the player is never offered a target the redirect
  would silently move the move off. Where Stealth *hides* its holder from the
  picker, Provoke narrows the picker **to** it.
- **Every move kind, not just damage** (2026-08-30 designer call). A debuff or a
  status rider the enemy aims at your fragile partner is exactly what a taunt is
  for; limiting it to attacks would make Provoke an attack-soak rather than a
  body-block. This is the one axis where it deliberately departs from Stealth's
  precedent.
- **Enemy side only.** A move resolved against its own caster's side
  (`singleAlly` — a heal, a Toughen Up) is untouched: dragging an ally's buff
  onto the opposing taunt would be nonsense, and "enemy attacks" is what the
  design row says.
- **Duration 1, ticking at end of round**, which is exactly "this turn": the tick
  that closes the round it was cast in takes it to 0 and removes it.
  Deliberately **not** Stealth's `ticksAtStartOfRound` — that flag exists to give
  Stealth a full round *after* the one it was cast in, and Provoke is priced as a
  single round of soak. **Priority +1 is load-bearing rather than flavour**: the
  taunt has to be standing before the enemy's attacks resolve or it protects
  nothing.
- **It resolves after Stealth and before Haunt.** On the pathological board where
  one hero holds both Stealth and Provoke, Provoke wins — a 25-mana action taken
  this round to eat a hit should be the last word over a passive avoidance
  effect. Haunt then spreads from wherever the hit actually landed.
- Read generically off `StatusDefinition.redirectsSingleTargetEnemyMoves` rather
  than as a literal `'Provoke'` id check, so the next type that wants a taunt
  authors it as data — same discipline as `triggerTypes` / `spreadTriggerTypes`.
  This is the first status-redirect hook to be data-driven; Stealth's is still a
  literal id check, which is now the odd one out and worth folding in the next
  time that code is touched.

---

## Chanced applications (2026-08-29)

`StatusApplication.chance` (`engine/content.ts`) gates a rider on a probability in
[0, 1]; omitted means always, which is every move authored before Fire. Two rules
that matter:

- **It gates the rider, never the move.** The damage/heal/buff body always resolves
  — CLAUDE.md's "No accuracy stat / moves always land" is untouched. Fire's Ember
  always hits; only its Burn is a 10% roll.
- **It rolls once per resolved target**, so a chanced spread move can catch one foe
  and miss the other, and it draws from the seeded RNG only when the field is
  present (`resolveRound.ts`) — an unchanced rider draws nothing, so every replay
  recorded before this existed reproduces byte-identically.

## Limited cleanse (2026-08-30)

`MoveDefinition.cleanseCount` (`engine/content.ts`): paired with `cleanses`, strips
**at most N** eligible statuses instead of all of them, chosen at **random**.
Water's Wash Away is the first content, at 1. Omitted keeps the all-or-nothing
behaviour every Cleanse move before it had. Three rules:

- **Positive statuses are still never eligible.** The §7 rule is untouched — a
  limited cleanse picks only from the non-positive ones, so Wash Away can never
  spend its one pick removing an ally's Renew.
- **Random, not authored-priority.** A cleanse that lets the caster *choose* which
  affliction to shed is a much stronger effect than a partial one; the roll is
  what prices this a tier below Purify's full strip rather than making it a
  cheaper copy. There is still deliberately no "cleanse THIS named status" —
  Cleanse stays a quantity, not a query.
- **It draws RNG only when it genuinely has to choose.** With fewer eligible
  statuses than the limit allows, the stream is untouched — the same replay
  guarantee `StatusApplication.chance` carries.

## Status queries: Gate and Consume (2026-08-30)

The two verbs a move can now hang off "does the target carry X?", both authored
as data on `MoveDefinition` (`engine/content.ts`) and both generic in the
status, not Freeze checks:

- **Gate** — `requiresTargetStatus`: the move may only resolve against a
  carrier. Unmet, the action fizzles for no mana with its own `ActionBlocked`
  reason. Applied after Stealth/Haunt retargeting, so a redirect cannot smuggle
  a gated hit onto an unmarked hero. See docs/combat.md.
- **Consume** — `conditionalPower.consumesStatus`: the hit that got the
  conditional multiplier spends the status it read, as a `StatusRemoved` with
  reason `consumed`. Opt-in; a conditional without it leaves the status alone.

Both are pure reads of live status at the moment the action resolves, so a mark
applied by a faster action earlier in the same round already counts — the same
freshness rule `conditionalPower` and the field-effect context already followed.
Neither draws RNG.

What is still **not** in this vocabulary, and would be a real extension rather
than another flag: gating on the *caster's* own status, gating on the absence of
one, and transmuting one status into another. Nothing has asked for them yet.

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

- Magnitude: Burn, Renew
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
- **Agnostic-served:** Bleed, Renew, Stealth (place Stealth deliberately — reads
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
6. **Cleanse strips positives?** Resolve for Renew AND Stealth together — an enemy
   peeling Stealth/Renew is either healthy counterplay or feels awful. Answer: do not strip positives
7. **Stealth command-then-resolve timing.** If an enemy commanded an attack at a hero
   who then goes Stealth this same turn, who resolves first decides whether it
   protects. Write the rule (faster-Stealth dodges; slower-Stealth eats it, safe next
   turn). Answer: A fast stealth can redirect an attack directed at that hero

---

## Bookkeeping carried out of this review

- Bind removed → audit any move or hero note referencing switch-lock.
- Strike the earlier Bind + Haunt combo idea; Haunt is standalone.
- Confirm "switching cleanses Daze" is reflected wherever Daze is referenced.
