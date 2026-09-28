# blessings-and-statuses.md — Blessings, and the status pass (Haunt, Burn, Renew)

> **STATUS: DRAFT 2026-09-28, from a design conversation after two months of playtest.**
> Decided per user direction: a Blessing **prevents** the killing damage (it does not leave the
> hero at 1 HP), and **lasts until it is used** — no fade at the end of Act 1, accepting that the
> game gets easier. Everything else is a proposal until the designer signs it. Build order is
> §6: **Blessings and Haunt first**, Burn and Renew after, the two fields with them.

---

## 0. Why this exists

Two threads from playtest.

**Runs die in Act 1 to one bad matchup.** The fork previews the enemy typing, so the choice is
informed, but a two-hero side with the companion still loses to one crit or one unanswerable pair.
The Act 1 wall has been called a design question and not a number since the XP overhaul
(`xp-overhaul.md` §8); every non-design dial has been tried against it. A Blessing is a design answer.

**Three statuses don't earn their slot.** Poison, Bleed, Conduct and Freeze are the winners; Ambush
too; Daze and Barrier are fine. The winners share a shape: **Poison, Bleed and Conduct are a
fraction of max HP, and Freeze, Daze and Barrier are booleans.** None of them has a number that has
to keep pace with a run. **Burn and Renew are the only bare magnitudes**, and they are the two that
feel bad. Burn needs the status-magnitude formula and a named exception (Boiler's `scaledBy`) to
stay relevant; Renew has neither and is slow besides. **Haunt** is a different problem: its payoff
points away from the target a doubles fight is about (§2.1).

---

## 1. Blessings

### 1.1 The rule

**A Blessing is a spent-once shield against death: the first time a Blessed hero would be knocked
out, the damage that would have done it is prevented and the Blessing is gone.** It sits on the
hero, not in a fight, so it carries from fight to fight until it is used.

### 1.2 Decided

- **Prevents, not endures.** The killing damage does not land at all; the hero keeps the HP it had.
  Enduring at 1 HP (Lingering's `enduresOnce`, Focus Sash) mostly buys a round before the same
  death, the complaint made of Renew in §4. Prevention is what makes a bad crit not have happened.
- **Lasts until used.** A Blessing the opening pair does not spend in Act 1 is still there in Act 5.
  The game gets easier; the designer accepted that. It also makes the Blessing a thing to protect,
  which is a decision the player keeps making all run.
- **The opening pair are Blessed at the start of every run**, in a short scene (§1.5).
- **More can be earned during a run, and kits can grant them** (§1.4).

### 1.3 Proposed: what spends it

| Source | Spends a Blessing? | Why |
|---|---|---|
| A move's hit (incl. Conduct burst, Haunt echo) | **Yes** | The case it exists for. |
| A DoT tick (Burn, Bleed, Poison), a passive's damage (Nightmare) | **Yes** | "Any source of damage", per the ask. |
| Withering Gaze | **Yes** | It is a field, not the terminator. |
| **The Pact Clock** | **No** | The Clock ends stalls and nothing answers it — no Shield, no reaction pass. A Blessing that stopped it would add a round to a stall. |
| Recoil, a self-Burn, a self-cost | **No** | A cost must stay a cost. Otherwise Fire's and Mech's self-Burn become free on a Blessed hero. |

**Shield first, then the Blessing.** A hit that the Shield takes whole never reaches the Blessing;
only what would bring HP to 0 after the Shield is prevented. The Blessing is spent only when it
actually saves the hero.

Note: the existing `enduresOnce` floor in `applyHpDelta` (`faintHandling.ts`) reads *every*
source, the Clock included, which disagrees with the `'Endured'` comment in `content.ts`. The
Blessing needs a source filter the floor doesn't have; reconcile the two while touching it.

### 1.4 Proposed: where Blessings come from

1. **The opening pair**, every run. The main supply.
2. **Earned on the map.** Candidates: a rare reward-row seat (pick a hero); the Guild Hall shelf,
   priced against the Revive at 80g (a Blessing is prevention, a Revive is recovery, so it should
   cost at least as much); a Guardian's Banner-beat alternative. Pick one faucet first and measure it.
3. **In kits.** A move that Blesses an ally mid-fight guarantees one knockout won't happen, the
   same category as Feint, Blind and Barrier. It should carry `manaCostGainOnUse` (a guaranteed
   lockout is priced by the fight) and **only last for that fight**, so an in-fight grant never
   turns into a run-long one. Rare, and a Late or signature seat. On an enemy it should be rarer
   still: a Blessed Guardian escort cancels the focus fire the player spent two turns on.

**At most one Blessing a hero.** A second one on a Blessed hero is refused (the who-screen greys the
hero), so the supply stays countable.

### 1.5 The scene

- Fires **every run**, after the draft and before the first map. The first-run lore card
  (`tutorial.md`) stays where it is, ahead of the draft.
- **One beat**: a PixelLab backdrop, the blessing figure, the two drafted heroes, one line —
  *"I bless you for this journey. You may need it."* — and a glow landing on each hero. One tap.
  Run length is always under pressure (`project_sim_run_length`), and this is paid every run.
- **Who blesses** is a lore question for the designer: whoever sends heroes out against the Titan's
  seals (`lore.md`). The figure should *not* be Ancient-coloured, for the reason no Guardian is.
- "Starters" were deleted with the starter split (`collection.md` §2): in code and copy these are
  **the opening pair**.

### 1.6 Presentation

- A **badge on the hero** everywhere HP is shown: the fight nameplate, the roster, the squad screen,
  the who-screens. It has to be readable from the map, because protecting it is a map decision.
- **Spending it is a beat**: the killing number shown, struck through, the glow breaking. The
  `Endured` event is the model; the Blessing gets its own event (`BlessingSpent`) so the view can
  tell the two apart.

### 1.7 Interactions to decide

- **Ascension 1 (Permadeath).** A Blessing is a pre-paid Revive, and A1's wall was measured as a
  Revive-supply problem (`ascension.md` §9b). Either that is welcome help, or **A1 opens without
  the opening Blessing**. A rung is a rule that removes a safety net, so the second fits the ladder.
- **The companion.** It joins after the first fight, so the opening Blessings never reach it. For
  earned ones: *a Revive never saves the companion*, so the parallel is *a Blessing is never given
  to the companion*. Designer's call.
- **Wounds and `down`.** A prevented knockout means the hero is never `down`, so none of the four
  mend faucets is needed for it. The Blessing competes with the Revive and the mend in the economy;
  the sim's per-act gold ledger will show it.
- **Termination.** A terminated hero's Blessing goes with it, like its gear.

### 1.8 Engine sketch

- `RosterEntry.blessed: boolean`, saved with the run. Copied onto the combatant at fight build
  (`Combatant.blessed`), written back at resolve (spent stays spent; a replayed fight refunds it,
  as consumables do).
- In `applyHpDelta`: after the Shield, if the loss would faint the target, the source is not the
  Clock or a self-cost, and the target is Blessed, set `newHp = previousHp`, clear the flag, emit
  `BlessingSpent`. Needs the loss `source` to distinguish `'clock'` and `'cost'` from `'direct'`.
- Content only grants it (`grantBlessing` effect) — no bespoke logic per source.

---

## 2. Haunt

### 2.1 The problem

Today a Haunted hero is struck by **Spirit or Mind attacks aimed at its partner**
(`expandSpreadTargets`, `statusEngine.ts`). Wisp and Poltergeist put Haunt **on the target you hit**,
so haunting X tells you to stop hitting X and hit Y instead. In a game about knocking one enemy out
fast, that is backwards: the turn you spent haunting X is paid back only if you turn away from X.
**Séance** (×2 against a Haunted target) already points the other way, so the slate disagrees with
itself. Then there is the delivery: Torment is a whole turn, Wisp lands it half the time, and when
the Haunted hero falls the setup dies with it.

The flavour is loved. The fix is three changes that keep it and point it the right way.

### 2.2 Proposed: the three changes

**1. Flip the echo.** *A Spirit or Mind attack on a Haunted hero also strikes its partner.*
Haunt your focus target, keep hitting it, and the partner takes the echo for free. Nothing to
retarget, and Séance agrees with it. Still only single-target moves expand (conditions.md §7,
locked), still no spread reduction. `expandSpreadTargets` reads the *target's* status instead of the
*ally's*; `DamageDealt.viaStatusId` still stamps the dragged-in hero.

**2. The ghost moves on.** *When a Haunted hero is knocked out, the Haunt passes to its partner.*
Focus fire no longer wastes the setup: the kill spreads the haunting, which is the flavour. If the
partner slot is empty or already Haunted, it waits for the next hero to take the fallen one's place.
One pass per knockout, so it can walk down a whole enemy side but never multiplies.

**3. No setup turn.** Haunt arrives as a guaranteed rider on Spirit's hits, not a turn of its own:
- **Wisp**: 50% → guaranteed. It is the Early Haunt delivery; a coin flip on the delivery is the
  finickiness.
- **Torment** keeps being a no-damage turn, but it earns it: Haunt on the target *and* Ambush 20 on
  self, so the next hit on that target lands the echo harder.
- **Poltergeist**, **Wicked Fear**, **Crossed Path** (Jinx's signature) already apply it on hit.

**Unchanged:** clears on switch (the enemy AI never switches, so it rarely matters, but a Haunted
player hero can still walk out of it); boolean; Spirit and Mind are the only trigger types.

### 2.3 What changes for each holder

Every Haunt payoff was written against the old direction. Under the flip, most of them fire more,
because the player now hits the Haunted hero directly instead of around it.

| Card | Holder | Today | Under the flip | Watch |
|---|---|---|---|---|
| Ghostlight / Wraithfire | Revenant (innate / mastered) | Spirit Force on each Haunt applied | Fires on every KO pass as well | Force stacks faster; fine at 10, watch 25 |
| Lament / Keening | Sorrow (innate / mastered) | Heal when damaging a Haunted enemy | Fires on nearly every hit | **Likely too strong** — a drain on every attack. Halve it, or have it read the echo only |
| Nightmare / Night Terror | Dread (innate / mastered) | 10% / 20% max HP a round to each Haunted enemy | Haunt persists through KOs, so the tick keeps finding a host | Night Terror's 20% may need to come down |
| Enthrall | Evolution grant | Water hits apply Haunt | Unchanged — a delivery | — |
| Omen | Evolution grant | Both enemies Haunted on entry | Both Haunted means a Spirit hit on either strikes both: two-target Spirit for the fight | Strong but it's the Evolution's payoff; keep |
| Séance | Late pool | ×2 against a Haunted target | Now agrees with the echo: ×2 on the target, echo on the partner | Check it's not the only Late pick |
| Perfect Creation | Mech Late | Plants Haunt among six marks | Unchanged | — |
| Wisp / Torment / Poltergeist / Wicked Fear / Crossed Path | Spirit / Mind slates | Deliveries | Wisp guaranteed (§2.2) | — |

### 2.4 Copy

Card text: *"A Spirit or Mind attack on this hero also strikes its partner. When this hero falls,
the Haunt passes to its partner. Cleared by switching."* Torment's line (*"a blow to one is a blow
to both"*) survives unchanged.

---

## 3. Burn — proposed, not yet scheduled

### 3.1 The change

Keep everything that makes it Burn — front-loaded, halving, **cleansed by switching**, *switch out
or it hurts* — and change the unit: **the magnitude is a percent of the target's max HP**, halving
each round (12% → 6% → 3%, ~21% over its life), stacking additively. Against the others:

| Status | Shape | Switching |
|---|---|---|
| Bleed | 5% every round, forever | persists |
| Poison | delayed burst after 3 rounds | only counts down while active |
| **Burn** | a front-loaded spike that halves | **cleanses** |

The designer's read: close enough to today's shape that it should work out. Second-order effects:
- **Fire's and Mech's self-Burn** becomes *"costs about 20% of your HP over three rounds"* — a
  price you can read before pressing the button, which is the rule for costs.
- **Boiler's `scaledBy`** can go, retiring one of CLAUDE.md's two named exceptions to "passive
  magnitudes are flat".
- **Open:** does the percent still scale off the caster's Attack/Int? Bleed doesn't. Proposal:
  drop the scaling — the percent already keeps pace, and a % has no physical or magical half.
  Burn is the only scaled `dot` today (Bleed is a flat percent, Poison a timer), so this retires
  the formula's `dot` arm outright.

### 3.2 The cost: the Fire kits

This is the worry, and it is real. Burn is referenced **21 times in moves, 18 in passives, 7 in
signatures** — every Fire hero's kit and some of Mech's. The plan to contain it:
1. **Mechanical first pass.** Convert every authored magnitude to a percent by one rate (the
   value a Burn deals to an at-par target at its tier), so nothing is hand-tuned on day one.
2. **Measure** (sim, same seed), then hand-tune only the outliers the report names.
3. The readers (anything with `requiresTargetStatus: 'Burn'`, detonations, Scorched Land) keep
   reading "is Burned", so they need no change beyond Scorched Land's number (§5).

---

## 4. Renew — proposed, not yet scheduled

### 4.1 The problem

Renew is slow: it is cast on a hurt hero, who is knocked out before it heals enough to matter.
And its number is flat, so it falls further behind as HP grows through a run.

### 4.2 The change

1. **A percent of the holder's max HP**, so it keeps pace like Bleed does.
2. **The first tick lands on application** — "heal now, keep healing". The hurt hero gets the heal
   before the next round's hits.
3. **Flat for a fixed duration, not halving** (e.g. 8% × 3 rounds). Renew already persists through
   switching and ticks on the bench (it isn't `activeOnly`); that is the thing only it does. Now that
   every fight fields six, **Renew and rotate** — heal on the bench, come back healthy — is the
   healing half of bench mana regen, the engine the game is built on. The halving drains a small
   number before the pivot pays off; a flat run of ticks doesn't.

Footprint: **12 in moves, 14 in passives, 12 in signatures.** The Renew payoffs (stacking three
ways) are a design goal (`project_renew_payoffs_intended`) and are rebuilt with it, not after.

---

## 5. Scorched Land and Verdant Earth

Both fields read the magnitude of the status that changes, so both have to move with it.

- **Scorched Land** (*Burn keeps ¾ of its value each round instead of half*). The shape survives a
  percent Burn: 12% → 9% → 7% → 5%… ≈ 48% over a Burn's life against ~21%. That may be too much
  when the field is up for five rounds; candidates are retain 0.75 → ⅔, or *Burn is not cleansed by
  switching while the field stands* (a verb, not a number, and it attacks Burn's one counter). The
  second is the more interesting field. Designer's call.
- **Verdant Earth** (*bonus Attack and Intelligence equal to current Renew*). A percent Renew reads
  as 8, so the grant collapses to nothing — the landmine it was kept for disappears, and so does the
  field. It needs a new verb. Candidates:
  - *Heroes holding Renew have +X Attack and Intelligence* (flat, authored — legible, but a bare
    number on a field).
  - *Renew heals twice as much, and overheal becomes Shield* — the Nature field grows the Renew it
    exists to reward, and uses the Shield vocabulary already built.
  - *Healing from Renew is also dealt as damage to the healed hero's attacker* — a thorn field.

  Recommendation: the second. It rewards what the field's owner is already doing, it has no stat
  term, and it stays within the one-verb-a-field shape (`field-effects.md`). All three routes
  (Herald, rider, reader) stay as they are.

---

## 6. Build order

| Phase | What | Scope |
|---|---|---|
| 1 | **Blessing engine**: `RosterEntry.blessed`, the `applyHpDelta` check with the source filter, `BlessingSpent`, badge, spend beat | engine + view |
| 2 | **Blessing scene**: PixelLab backdrop and figure, opening-pair grant, one tap | view + art |
| 3 | **Haunt**: flip `expandSpreadTargets`, pass on KO, Wisp guaranteed, card copy, retune Lament/Keening and Night Terror | engine + content |
| 4 | **Measure 1–3** (sim, same seed): Act 1 clear, full-clear, Blessings spent by act, Spirit heroes' win rates | sim |
| 5 | **Burn**: percent unit, mechanical conversion, Scorched Land, drop Boiler's exception | engine + content |
| 6 | **Renew**: percent, first tick on application, flat duration, payoffs, Verdant Earth | engine + content |
| 7 | **Measure 5–6** | sim |

A Blessing earned on the map (§1.4 item 2) and in kits (item 3) come after phase 4's numbers.

---

## 7. Invariants this touches

- **Consumables / Revive** (CLAUDE.md "Consumables"): a Blessing is a new safety layer beside the
  Revive — prevention where the Revive is recovery. A1's "a Revive is the ONE way back" stays true;
  a Blessing is not a way back.
- **Status magnitude formula** (phase 5): Burn leaves it if the percent is unscaled, and Boiler's
  named exception goes. Renew (phase 6) leaves the `hot` arm the same way.
- **Haunt's spread** (conditions.md §7): the single-target-only rule stands; the direction flips.
- CLAUDE.md gets a banner for this doc once the designer marks a phase decided.
