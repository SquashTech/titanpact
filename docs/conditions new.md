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

### Daze — *boolean · control* (REDESIGNED 2026-08-30 — flinch)
- **Effect:** the target cannot use a **move** for the rest of the round. It can
  still Rest, and switches were never blockable (they resolve in their own
  bracket above every move).
- **Removal:** removed automatically at the **end of the round it landed in**
  (`StatusDefinition.clearsAtEndOfRound`). Also cleared by switching and by
  Cleanse, both of which are now unreachable in practice — it cannot outlive its
  own round.
- **It carries no number.** It was a duration-shape status authored per-move at
  2 rounds; that is gone, and no `statusApplication` should author a magnitude or
  duration for it (`test/lightMoves.test.ts` pins this).

**What changed and why.** As a two-round lockout, Daze was a *purchase*: spend
mana, remove up to two enemy turns, and the only question was whether you could
afford it. As flinch it is a **bet on turn order**, which is the Pokémon
mechanic it is named after:

- A hero's action is gated on a live read when its turn comes up
  (`resolveRound.ts`), so a Daze only denies anything if its applier acted
  **earlier in the same round**. Landed on someone who has already moved, it is
  worth exactly zero — it still applies, it just never gets read.
- Nobody can ever *begin* a round Dazed, which is what makes the number
  meaningless. There is no second round to count down to.
- **Speed and priority are now the entire price.** The same 30% rider is a real
  tempo swing on a fast hero and close to dead weight on a slow one, with no
  content change between the two. That asymmetry is the point.

The old design intent — "a tank dumps mana to shut off a scary target" — is
explicitly **not** what this is any more. A slow tank is now the worst possible
holder of a Daze move. If the tank-shutdown role is still wanted, it needs a
different status (a real multi-round lock) rather than this one.

**Open, and worth watching:** a priority-bracketed Daze move would buy its way
past the Speed check entirely, which is the one thing that could undo the
redesign. Nothing authors one today (Light's six are all bracket 0, asserted in
`test/lightMoves.test.ts`) and the first slate that wants one should say so
rather than slipping it in.

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
- **2026-09-02:** the first Freeze applied by something other than a move. Rime's
  Glacier Evolution grants **Frozen Stone** — *whenever this hero's Defense rises,
  Freeze a random enemy* — which lets a defensive turn plant the setup the three
  payoffs above are waiting for, and gives the Stone graft it arrives with a second
  reason to exist.

### Bleed — boolean
- End of turn: target takes 5% of max HP.
- **Does NOT cleanse on switch.**
- Design intent: straightforward, flavorful; combo / lifesteal potential.
- **The combo potential is now spent (2026-08-30, Beast).** Three Beast rows
  plant it (Claw at 20%, Lacerate, Toxic Fangs) and two double their base
  power against a target carrying it (Maul at 40, Eviscerate at 75), and
  neither casher CONSUMES it. That combination is only playable because Bleed
  survives a switch: the mark a 20-mana opener plants follows a foe to the
  bench and back, which is what makes an 80-mana finisher worth holding.
  Cleanse is the only answer to it.

### Renew — magnitude (positive / self-buff)
- Standard heal-over-time.
- Positive status → subject to the Cleanse-strips-positives question (see open).
- **Named Renew, not Regen (2026-08-26).** "Regen" collided with the `MP Regen` stat in
  prose and code identifiers, and that collision had already produced one real bug —
  Verdant Earth's stat bonus was wired to `mpRegen` instead of this status. The stat
  keeps its name; the status took the distinct one.
- **A PASSIVE-applied Renew is flat (2026-09-02).** Crag's Rootwarden grants **Unstoppable
  Growth** — *when this hero enters the battlefield, it gains Renew 20* — and that 20 is the
  authored 20, not a figure run through the healing formula. A move's HoT snapshots
  `HealPower × WisdomMult × STAB` at application; a passive has no move to take STAB from,
  and passive healing has always been flat (Sanguine). Worth knowing when reading a path
  that grants both Wisdom and a healing passive: the Wisdom buys the *moves*, not the
  passive. It still stacks additively on arrival, like any other Renew.

### Conduct — boolean
- Applied only by a specific move that names Conduct in its own `statusApplication`
  (moves.ts `risingStatic`, `jolt`, `ionize`, `stormLash`, `thunderbolt`, and Water's
  `shockBubble`) — same authoring convention as every other status, not automatic.
- **2026-09-01:** a passive may also plant it. **Static Tide** (reserved since 2026-09-02, once Riptide's Maelstrom
  Evolution) marks the target of every Water attack its owner lands, which is what
  turns a Water/Storm hero into its own applier *and* detonator. Still an authored
  choice, still never the detonation pass planting its own mark.
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

### Ambush — a typeless Force, spent on the next attack (2026-09-07)
- Magnitude-shape, `positive`. Its magnitude is added as **flat Base Power** to the
  next attack the holder lands — **whatever type that attack is** — and is then spent.
- **It replaced Stealth**, which was deleted the same day. Stealth's problem was never
  its effect; it was that a whole turn bought nothing but the absence of one attack, in
  a doubles game where the opponent simply hits the partner instead. `authoring-moves.md`
  §10 had already recorded the symptom from the other end — Vesper's starting kit was
  two off-type supports and a Stealth grant, the trap pick the north star forbids.
- **It is the Elemental Force family with the type taken off.** `forceAllTypes` matches
  any move where `forceType` matches one, so the whole implementation is a wildcard in
  `resolveElementalForceBonus` plus `consumedOnDamage` in `resolveRound` — no new
  subsystem, and no bespoke logic in a content file. That inheritance decides three
  things for free: it is a **BasePower-stage** input, so the two-pipeline separation
  holds; it lands **before** `conditionalPower`'s multiplier is applied, so an execute
  never doubles the Ambush along with the move; and it is read **per hit**, so a spread
  pays on both targets.
- **Flat Base Power rather than a percentage — deliberate.** A percentage in pipeline 2
  would compound multiplicatively with crit, STAB, type advantage, a Force *and* a ×2
  execute, and Ambush-on-a-crit-execute is a six-times turn. Flat Base Power also gives
  the status a *niche*: it is proportionally larger on a cheap fast move than on a nuke
  (Ambush 45 turns Backstab's 30 into 75, but Dusk Blade's 80 into 125), which is both
  the ambusher's fantasy and something no flat Attack buff does. It pays a magical move
  and a physical one identically, so a mixed attacker gets full value from one buff.
- **Scalable, not boolean (2026-09-07 designer call).** A fixed constant would make a
  15-mana granter and a 60-mana one worth exactly the same, which fights the locked
  "mana cost is the primary balance lever". Per-source magnitudes are what let Lie in
  Wait (45), Shadow Form (40) and Cutthroat (20) price differently.
- **Spent after the move's hits, not during them** (`resolveRound`, after the per-target
  loop). Consequences worth knowing: a **spread** reads it on every target and still pays
  once; a **buff or heal** never spends it; a move that reaches nobody spends nothing;
  and **Retribution** owes nothing, since it is fixed damage that never runs the formula.
  Riders resolve after the damage case, so a damage move that *grants* Ambush cashes the
  one it was holding and then plants a fresh one — Cutthroat's whole design.
- **No clock, `clearsOnSwitch: true`.** The clock was dropped on purpose: a rider that
  expires is only usable by a hero who gets to act next round, which is what makes a
  status feel bad to hold, and a rider that waits is safe to hand out across many types.
  Clearing on switch is what stops the real abuse — grant, pivot out to regenerate on the
  bench, pivot back loaded. `test/statuses.test.ts` pins both halves.
- **`stacking: 'additive'`, uncapped.** The brake is the opportunity cost: every point of
  ramp is a turn not spent attacking. Whether that brake is enough is an open tuning
  question rather than a settled one.
- **The design rule the rework turns on, and the reason Stealth failed:** a granter that
  costs a whole turn has to pay back **more than one attack's damage** or pressing it is
  never correct. So Ambush should mostly ride on turns the player was already spending —
  a brace, a switch-in, a debuff, a field set — and a bare "spend a turn to gain it"
  button needs a magnitude that genuinely clears that bar. Lie in Wait at 45 is the one
  granter that buys nothing else, and it is priced accordingly.
- **Multi-hit is the authored payoff (2026-09-07, `MoveDefinition.hitCount`).** Because
  the bonus is flat BasePower re-read per hit, a move that hits three times counts the
  Ambush three times: Thousand Cuts (Shadow, late, 20 BP × 3, 50 mana) turns an Ambush 45
  into +135 rather than +45. Bare it is an unremarkable 60 BasePower, and that is the
  authored shape — it is a payoff, not a staple. The brake is mana: Lie in Wait plus
  Thousand Cuts is 70 across two rounds, which is a 60-pool Shadow hero's entire budget
  with its one regen tick included, and leaves them Resting after. Whether that is brake
  enough is the open tuning question on this whole rework.
- **The five homes, and what Ambush means in each (2026-09-07).** The rule they were
  chosen by is the one above: a granter should ride on a turn that was already worth
  taking, because a turn that buys *only* Ambush has to beat an attack to be correct.
  - **Shadow** — the type that owns it. Lie in Wait (20 mana, Ambush 45) is the one
    exception to that rule, the dedicated setup turn, and is priced to clear the bar.
    Cutthroat (30, 40 BP + Ambush 20) cashes what it holds and plants a fresh one, since
    riders resolve after the damage case. Shadow Form (60) adds Ambush 40 to its +75
    Attack. Thousand Cuts is the payoff.
  - **Iron** — Fortify (20 mana, +15 Defense + Ambush 20). Iron's answer to *why turtle*:
    the guard turn now loads the swing after it, which is the counter-attacker payoff the
    type had no way to express.
  - **Beast** — Prowl (25 mana, +10 Attack/+10 Speed doubled beside a Beast, + Ambush 20).
    The stat half keeps the partner conditional; the Ambush does not, since one scaling
    clause per move is enough. What it is circling for is Pounce, priority 1.
  - **Mind** — Enervate (30 mana, -30 Wisdom on a foe + Ambush 25). Mind spends whole
    turns lowering an enemy and gets nothing offensive back; this closes that loop, and
    double-dips on purpose — the Wisdom it strips is the defStat the loaded magical hit
    divides by.
  - **Arcane** — Magic Cloak (40 mana, Magical Surge + Ambush 30), which was already
    paying for itself with the field.
  - Plus the **Afterimage** passive: Ambush 20 on arrival, which makes a pivot an
    offensive move rather than only a mana-recovery one.

---

### Provoke — 1-round redirect (2026-08-30, Stone)
- While active, **every single-target move the enemy side aims at this side is
  redirected onto the holder.** Spread moves are unaffected. Stone's Provoke
  (25 mana, Priority +1) is the only carrier.
- **It is the only retargeting layer left that moves a move toward somebody**, and
  since Stealth's deletion (2026-09-07) the only one a player can cast. Two halves:
  a resolve-time redirect (`applyProvokeRedirect`) and a declaration-time narrowing
  of the target picker (`selectableTargets`), so the player is never offered a
  target the redirect would silently move the move off.
- **Every move kind, not just damage** (2026-08-30 designer call). A debuff or a
  status rider the enemy aims at your fragile partner is exactly what a taunt is
  for; limiting it to attacks would make Provoke an attack-soak rather than a
  body-block.
- **Enemy side only.** A move resolved against its own caster's side
  (`singleAlly` — a heal, a Toughen Up) is untouched: dragging an ally's buff
  onto the opposing taunt would be nonsense, and "enemy attacks" is what the
  design row says.
- **Duration 1, ticking at end of round**, which is exactly "this turn": the tick
  that closes the round it was cast in takes it to 0 and removes it. Provoke is
  priced as a single round of soak, and it is now the only duration-shape status in
  the catalog. **Priority +1 is load-bearing rather than flavour**: the
  taunt has to be standing before the enemy's attacks resolve or it protects
  nothing.
- **It resolves before Haunt**, which then spreads from wherever the hit actually
  landed.
- Read generically off `StatusDefinition.redirectsSingleTargetEnemyMoves` rather
  than as a literal `'Provoke'` id check, so the next type that wants a taunt
  authors it as data — same discipline as `triggerTypes` / `spreadTriggerTypes`.
  It was the first status-redirect hook to be data-driven, and since Stealth's
  deletion it is the only one — no literal-id retargeting is left in the engine.

### Barrier — *boolean · guard* (2026-09-09, Arcane)
- While active, **every move the OPPOSING side resolves against the holder turns
  away entirely** — the whole payload, damage and riders alike. The move still
  resolves against anyone else it reached, and its mana is still spent.
- **Ally moves reach through it.** A partner's heal, buff or cleanse is untouched.
  This is the difference between a guard and an isolation effect, and it is what
  makes Barrier a defensive turn rather than a turn that also refuses help.
- **Priority +2, a bracket of its own** above every other move in the game (the
  next-highest is +1, eleven moves). Load-bearing for the same reason Provoke's +1
  is: a guard that resolves after the attack it was meant to stop protects nothing.
  Unlike Provoke, +2 makes it *unconditional* — no Speed roll decides it.
- **Applied after every redirect**, so a move pulled onto the holder by Provoke
  fizzles too. Same ordering argument as the `requiresTargetStatus` gate below it:
  a redirect must not smuggle a move past a check the target was owed.
- **`clearsAtEndOfRound`, `clearsOnSwitch`, `positive`.** One round's decision,
  never bankable on the bench, and Cleanse does not strip it.
- **Deliberately NOT spam-proofed by a consecutive-use rule.** VGC's diminishing
  success chance is the mechanism Protect is famous for and it does not stop
  Protect being omnipresent there. Two things limit it here instead: **mana** (25 a
  round against Glyph's 85 pool and Cortex's 75 — the locked lever on reliable
  moves), and **doubles** (a guard covers one body of two, and the far side simply
  attacks the other). If it still reads as too available, the cost is the dial.
- **Dispersal is the other half of the design.** Two heroes hold it — Glyph and
  Cortex, both frail casters whose problem was being the *weakest* body on the
  field rather than a weak one. Zenith is the obvious third (38% per-fight death
  rate, the roster's highest) and is deliberately left out for now.
- Read generically off `StatusDefinition.blocksIncomingMoves` (`statusEngine.ts`
  `blockingStatusId`), never as a literal `'Barrier'` id — same discipline as
  `redirectsSingleTargetEnemyMoves`. Emits `MoveGuarded` per turned-away target so
  the view can read it on the DEFENDER, which is where the event actually happened.

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

## More than one status per move (2026-08-30, Beast)

`MoveDefinition.statusApplication` is **one rider or a list of them** — Beast's
Toxic Fangs, "afflict Bleed and Poison 10", the first move in the game to apply
two. Everything reads it through `content.ts statusApplicationsOf`, so a move
authoring a single bare rider is unchanged in both the data and the code path.

- **Ordered, and independent.** They resolve in authored order; each resolves
  its own targets and rolls its own `chance`, and each feeds its own passive
  reactions before the next runs. Two riders are two applications sharing a
  cast — there is no compound status and no interaction between them beyond
  the order.
- **A one-rider move draws exactly the RNG it always did.** The list path adds
  no draw of its own (`test/beastMoves.test.ts` pins it against a single-rider
  cast from the same state).
- Stacking is unchanged: each rider hits the ordinary `applyStatus` path, so
  the same status named twice on one move would stack by its own
  `StatusStacking` rule rather than by anything special here. Nothing authors
  that, and there is no reason to.

## Chanced stat deltas (2026-08-30, Mind)

`MoveDefinition.statDeltaChance` is the exact sibling of `StatusApplication.chance`
above, for the three Mind rows reading "20% chance to reduce the target's Wisdom by 20"
(Psi Bolt, Psyshock, Psionic Wave). It inherits that field's three rules wholesale,
because a chanced stat delta and a chanced status rider are the same mechanic pointed at
different state:

- **It gates the rider, never the move.** The damage body resolves unconditionally —
  `CLAUDE.md` "No accuracy stat". Psi Bolt is a 40 BP hit that sometimes also debuffs,
  not a debuff that sometimes misses.
- **Rolled once per resolved target**, so a chanced spread (Psionic Wave) can catch one
  foe and miss the other.
- **Omitted draws no RNG at all**, so every move authored before it replays identically.

One thing it does *not* copy: the roll gates the **whole delta list together**. A row
reading "20% chance to reduce Intelligence and Wisdom by 30" is one coin flip with two
consequences, not two flips. Independent odds per stat would be a different field and
nothing has asked for one.

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
  reason. Applied after Provoke/Haunt retargeting, so a redirect cannot smuggle
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
- Boolean: Bleed, Freeze, Conduct, **Daze** (2026-08-30: was Duration, now flinch —
  boolean plus `clearsAtEndOfRound`)
- Magnitude, second flavour: **Ambush** and the fifteen Elemental Forces — magnitude
  read as flat Base Power rather than as HP a tick moves. Same shape, different reader.
- Duration: Provoke, and nothing else.
- Poison: timer / delayed-detonation — its own shape
- Haunt: target modifier — its own shape

Either accept that the taxonomy is now "core shapes plus a few distinct specials," or
re-derive the shapes to match reality. Keep the docs honest either way. Flagged, not
resolved.

---

## Element coverage map

Design lens going forward is coverage, not count: does each draftable element get a
status to call its own? (Roguelike structure keeps per-run status load low, so raw
count is not the constraint — legibility and non-overlap are.)

- **Covered:** Fire (Burn), Frost (Freeze), Storm + Iron (Conduct), Spirit/Mind (Haunt)
- **Agnostic-served:** Bleed, Renew, Ambush (Ambush reads Shadow and is authored there
  first, but it is deliberately typeless and Iron/Beast are the planned next homes —
  see its section above)
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
6. **Cleanse strips positives?** Answer: do not strip positives. Carried forward to
   Ambush, which is `positive` for the same reason.
7. ~~**Stealth command-then-resolve timing.**~~ Moot — Stealth was deleted 2026-09-07
   and replaced by Ambush, which has no targeting behaviour to time.

---

## Bookkeeping carried out of this review

- Bind removed → audit any move or hero note referencing switch-lock.
- Strike the earlier Bind + Haunt combo idea; Haunt is standalone.
- Confirm "switching cleanses Daze" is reflected wherever Daze is referenced.
