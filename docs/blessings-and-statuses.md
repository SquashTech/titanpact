# blessings-and-statuses.md — Blessings, and the status pass (Haunt, Burn, Renew)

> **STATUS: DRAFT 2026-09-28, from a design conversation after two months of playtest.**
> Decided per user direction: a Blessing **prevents** the killing damage (it does not leave the
> hero at 1 HP), and **lasts until it is used** — no fade at the end of Act 1, accepting that the
> game gets easier. Everything else is a proposal until the designer signs it. Build order is
> §6: **Blessings and Haunt first**, Burn and Renew after, the two fields with them.
> **Phase 1 is BUILT (2026-09-28):** the engine, the roster flag, the opening pair Blessed at run
> start, the spend beat and the marks (§1.6). `SIM_NO_BLESSING=1` is the sim's
> A/B for phase 4. **Phase 2 is BUILT (same day):** the Pactwarden's scene (§1.5). **Phase 3 is BUILT
> (same day):** Haunt flipped, passing on a knockout, Wisp certain, Lament and Keening on the echo (§2.5).
> **Phase 5 is BUILT (same day):** Burn is a percent of max HP, never caster-scaled, and keeps the higher
> of two (§3.3, §3.4); Scorched Land stays at ¾ retention (§5). Phase 4, the sim pass, was skipped per user direction.
> **Phase 6 is BUILT (same day):** Renew is a percent of max HP that heals on landing and twice more,
> still Wisdom-scaled, and Verdant Earth doubles it and turns overheal into Shield (§4.3, §5).

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
| Recoil, a self-HP price | **No** | A cost must stay a cost. |
| A self-Burn's tick | **Yes, as built** | A status instance doesn't record who applied it, so a self-Burn tick can't be told apart from an enemy's. It only matters when the tick would be lethal, and then the Blessing is spent, not saved. Revisit if the Burn rework (§3) gives an instance a source. |

**Shield first, then the Blessing.** A hit that the Shield takes whole never reaches the Blessing;
only what would bring HP to 0 after the Shield is prevented. The Blessing is spent only when it
actually saves the hero.

**Lingering refuses first.** A hero holding both an endure and a Blessing spends the endure (it
comes back next fight) and keeps the Blessing (it doesn't).

As built, `HpLossSource` gained `'clock'` and `'cost'`: the Pact Clock, recoil and a self-HP price
pass them, and the Blessing ignores both. The `enduresOnce` floor still reads every source, the
Clock included, which disagrees with the `'Endured'` comment in `content.ts`. That was left alone:
no roster card endures any more, so it's a question for whoever next gives a hero that verb.

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

### 1.5 The scene — BUILT 2026-09-28

- **Where it sits:** draft → the Titan wakes (the cold open) → **the Blessing** → the act intro.
  The Titan notices the pact, then someone answers it. The first-run lore card (`tutorial.md`)
  stays where it is, ahead of the draft. Placeless, like the cold open.
- **Who blesses: the Pactwarden** (per user direction, picked from three concepts in
  `art/concepts/blessing/`). She is a blind elder who keeps the old binding rite, with a golden
  cord and a lantern: the witness to the pact the player has just sealed (`lore.md` §4). She is not
  Ancient-coloured, for the reason no Guardian is. Art: `art/npc/pactwarden.png` (Pro Flash, 48px,
  the Mentor as style reference, seed 11).
- **Where:** a ring of standing stones where the road into the wilds begins, with warm light
  between the stones (`art/backdrops/blessing.png`, Pixen 196×344, seed 29; the seed-8 roll came out
  as a Japanese-style shrine and was dropped).
- **The beat** (`BlessingScreen.tsx`, built from the road encounter's parts): she fades in with the
  opening pair either side, turned in toward her. Her one line types out: *"I bless you for this
  journey. You may need it."* A tap sends a shaft of gold down onto each hero and leaves the gold rim
  at their feet (the fight's rim), with the `blessing` sound. A second tap moves on. Every tap
  skips ahead, and reduced motion skips the arrival.
- **What it does is said by a first-time tip, not by her** (the tips rule: out-of-universe, once an
  account). The `blessing` tip fires on the first map where any roster hero is Blessed.
- "Starters" were deleted with the starter split (`collection.md` §2): in code and copy these are
  **the opening pair**. The tip says "starting heroes", as the draft's does.

### 1.6 Presentation

**Quiet while held, loud when spent** (per user direction, 2026-09-28): a Blessing can sit on a
hero for a whole run, so it never takes a word or a status-row chip.
- **In a fight**: a thin gold rim on the ground under the figure, breathing slowly, and a small gold
  star beside the level on the nameplate. A worded "Blessed" chip was built first and taken out.
- **Off the map**: the same star (`BlessingMark`) on the roster sheet, the route's roster readout
  and the squad screen, since protecting a Blessing is a map decision. The who-screens get it when
  a map faucet exists (§1.4).
- **Spending it is the beat that explains it**: the banner *"X's Blessing turns aside N damage"* in
  the Blessing's gold, the number struck through, a gold flare on the figure and no hurt frame;
  then the rim and the star are gone. Its own event (`BlessingSpent`, and `DamageDealt.prevented`
  on a hit) keeps it apart from `Endured`. The `blessing` sound effect exists and isn't wired to
  the beat yet.

### 1.7 Interactions to decide

- **Ascension. DECIDED 2026-09-28 (per user direction): A1 keeps the opening Blessing.** It is
  welcome help against A1's wall, which was measured as a Revive-supply problem (`ascension.md`
  §9b). Taking the opening Blessing away is a candidate rule for **A5**, if the ladder gets there.
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
| Lament / Keening | Sorrow (innate / mastered) | Heal when damaging a Haunted enemy | Would fire on nearly every hit | **Built: reads the echo only** (`viaStatusId: 'Haunt'`), healing for what the echo dealt |
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

### 2.5 As built (2026-09-28)

- **The flip:** `expandSpreadTargets` asks whether the *target* holds a status whose
  `spreadTriggerTypes` include the move's type, and if so adds the target's standing partner, stamped
  `viaStatusId`. A hit on the Haunted hero's partner no longer spreads.
- **Passing on:** `StatusDefinition.passesOnFaint` (Haunt alone). `passFaintedStatuses` sweeps
  between actions and after each round-end step (the ticks, the Clock, the round's end). It takes
  the status off the fallen (`StatusRemoved` with reason `'passed'`) and applies it to the partner.
  With no partner free, it goes on `CombatState.pendingSideStatuses`, and the next hero to enter on
  that side takes it (`performSwitch`). Removing it from the fallen is what makes the sweep run once.
  The pass is a `StatusApplied`, so Revenant's Ghostlight fires on it. The view shows one beat:
  *"The Haunt on X passes to Y"*. The echo's banner now reads *"Y is caught in the Haunt"*, since
  the partner isn't the Haunted one any more.
- **Wisp** is certain (a guaranteed rider at its old price). That leaves it Poltergeist's cheaper
  Early twin; whether Poltergeist wants something of its own is a question for phase 4.
- **Lament and Keening read the echo only** (§2.3). **Night Terror stays at 20%** until phase 4
  measures it.
- `authoring-moves.md`'s status reference row is updated; its older slate notes that describe the
  old direction are left as history.

---

## 3. Burn — BUILT 2026-09-28 (§3.3)

### 3.1 The change

Keep everything that makes it Burn — front-loaded, halving, **cleansed by switching**, *switch out
or it hurts* — and change the unit: **the magnitude is a percent of the target's max HP**, halving
each round (12% → 6% → 3%, ~21% over its life), stacking additively (keep-the-higher since §3.4). Against the others:

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

### 3.3 As built (2026-09-28)

**Decided per user direction:** a flat percent, **never caster-scaled** (it retires the status-magnitude
formula's `dot` arm and Boiler's `scaledBy`: CLAUDE.md is amended), and the halving shape kept.

- **The rate was measured, not guessed.** Against an at-par target (roster-average max HP 230 / 266 /
  311 at levels 6 / 14 / 24, with the average Fire/Mech caster's scaling and STAB), today's Burns
  land at about **half their authored number as a percent** in every tier: Spark Flash 15 ≈ 8.6%,
  Scorch 15 ≈ 8.1%, Spark Burst 60 ≈ 30%, Perfect Creation 75 ≈ 38%. Caster scaling grows at about
  the rate HP does, which is why one rate holds. So:
  - a Burn on an enemy: **authored ÷ 2** (Ember 5%, Set Alight 15%, Spark Burst 30%, Perfect Creation 38%);
  - a self-Burn cost (always flat): **÷ 3**, what it cost at par (Overheat 13%, Meltdown and Volcanic
    Surge 17%, Steam Vent 3%);
  - a passive's flat Burn: **÷ 3** (Burn 10 → 3%, 5 → 2%, 20 → 7%); Boiler's scaled one ÷ 2 (5%,
    Boiling Point 10%). **Showstopper** is 4%, not 3%, to keep the mastered card at least double its
    innate's 2%.
- **Engine:** `StatusDefinition.percentOfMaxHp`. A tick deals `ceil(maxHp × magnitude / 100)` of
  the HOLDER's max, and `magnitudeScales` skips it. The halving is unchanged; the stacking changed in §3.4.
- **Every number in the text now wears its %**: the descriptions (three that had drifted from their
  data were rewritten from it), and every place a magnitude prints — move tile, move detail, passive
  facts, the status chip and detail, the beat banner — through `statusAmountText`.
- The sim pilot prices a percent tick against the holder's HP; the enemy AI reads no magnitudes.
- **Not measured** (per user direction). The conversion lands at parity at par by construction;
  what it changes is that Burn no longer falls behind a tank, a Banner stack or late gear.

---

### 3.4 Burn keeps the higher (2026-09-28, per user direction)

Burn's stacking went from **additive** to **keep the higher** (`takeHigher`): a new Burn refreshes a
fading one to the larger of the two and never adds to it.

**Why:** the one-cast comparison in the first pass hid the real case, **the same target Burned every
round** by a player whose target never switches. Additive + halving settles at twice the magnitude
every round: Scorch every round ticked 8, 12, 14, 15, 15… (64% of max HP over 5 rounds), and Set
Alight 15, 22, 26, 28, 29… (120% over 5, for 20 mana a cast, with no hit on it). Poison's timer
never resets, so repeated casts bunch into one burst every third round (Corrode every round: 30% over
5), and a Bleed recast adds nothing (25% over 5 from the first cast).

**After:** a single cast is unchanged (8 → 4 → 2 → 1), so no kit was renumbered; spam now ticks
8, 8, 8… (40% over 5). Each status has its own job: **Bleed** is set and forget, **Burn** is a spike
you keep refreshing, **Poison** is the one that stacks and bursts, as its card already says. The costs:
two Fire heroes on one target no longer add, and passive Burns (Showstopper) refresh rather than pile
up. **Set Alight** (Early, 20 mana, 15%) is still the best cheap status move and is left for playtest;
12% is the candidate if it reads as too strong. The sim pilot values a Burn only by what it raises the
held magnitude.

## 4. Renew — BUILT 2026-09-28 (§4.3)

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

### 4.3 As built (2026-09-28)

**Decided per user direction:** a percent of the HOLDER's max HP that **keeps its Wisdom scaling**
(authored × Wisdom StatMult × STAB, snapshotted at cast; `fixedMagnitude` is what keeps Burn flat and
Renew scaled). CLAUDE.md's healing formula carries the named exception.

- **Shape:** it heals **the moment it lands** (`ticksOnApply`, for what that application added) and
  then **at the end of each of the next 2 rounds** (`defaultDuration: 2`), with no decay: three heals
  in all. A second Renew adds to the pool and tops the clock back up to the longer
  (`additiveRefreshDuration`). It still persists through switching and Cleanse and still ticks on the
  bench, so *Renew and rotate* works.
- **The rate, at parity:** the old Renew healed about twice its landed number over its life, and the
  new one heals its landed percent three times. The caster's scaling appears on both sides and
  cancels, so the new percent = authored × 200 ÷ (3 × par HP): about ÷3.5 Early, ÷4 Mid, ÷4.7 Late;
  signatures and passives ÷4. Refresh 30 → 9%, High Tide 75 → 16%, Overgrowth 150 → 32%, Second Wind
  50 → 14%, a passive's 40 → 10%. **Restorative Toxin** pays Renew at ×0.5 of the Poison it applied
  (was ×2 when Renew was flat HP).
- **Every Renew number in the text wears its %** (from the data; Second Wind's text had drifted to 45).
- **The trade:** total healing is unchanged at par. What changed is *when*: a third of it lands at
  once, none of it is lost to decay, and it keeps pace with max HP. **The cost:** a Renew lasts 2
  rounds now, where a halving one lingered at a trickle for four or five. Moves that read "the user
  holds Renew" (Branch Slam, Seed Shot's line) have a shorter window. `defaultDuration` is the dial
  if that bites.
- The sim pilot prices a percent Renew over its three heals. Not measured (per user direction).

## 5. Scorched Land and Verdant Earth

Both fields read the magnitude of the status that changes, so both have to move with it.

- **Scorched Land — kept at "Burn keeps ¾ instead of half"** (2026-09-28, per user direction). For
  one commit it was *switching out doesn't cleanse Burn*, and that was reverted the same day: **the
  enemy AI never switches**, so the rule never touched an enemy the player Burned. It only bit when
  an enemy set the field against the player (the Dragon Guardian's Spreading Blaze), which turned a
  player's field into an enemy-only one. Switch-denial is dead design while the AI doesn't switch.
  The ¾ retention works against a target that stays in, and with Burn refreshing instead of stacking
  (§3.4) it makes one Burn linger rather than making a stack snowball.
- **Verdant Earth — BUILT 2026-09-28** (per user direction): *Renew heals twice as much, and healing
  past max HP becomes Shield* (`FieldEffectDefinition.amplifiesStatusHealing`, read in
  `healFromStatus` for both the landing heal and the round-end ticks), replacing *bonus Attack and
  Intelligence equal to current Renew*, which a percent Renew would have shrunk to nothing. The
  field now grows the Renew it exists to reward, with no stat term. Its three routes (Herald, rider,
  reader) are unchanged. The old `statBonusEqualToStatusMagnitude` verb stays in the vocabulary with
  no holder. **Knock-on:** the Elder Bough's turn under its own field is now doubled Renew and Shield,
  not a free Attack stack, so that Guardian plays more defensively than it did.

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
