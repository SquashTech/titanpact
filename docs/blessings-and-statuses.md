# blessings-and-statuses.md — Blessings, and the status pass (Haunt, Burn, Renew)

> **STATUS: BUILT (2026-09-28, per user direction).** Blessings, the Pactwarden's scene, the
> Haunt flip, the Burn and Renew percents and both fields are in. The map faucet (the Pactwarden's
> Shrine) followed 2026-10-03. The planned sim passes were skipped per user direction, so nothing
> here is measured. Still open: an in-kit Blessing (§1.4), the companion and earned Blessings
> (§1.7), and Night Terror's 20% (§2.5).

---

## 0. Why this exists

Two threads from playtest.

**Runs die in Act 1 to one bad matchup.** The fork previews the enemy typing, so the choice is
informed, but a two-hero side with the companion still loses to one crit or one unanswerable pair.
The Act 1 wall has been called a design question and not a number since the XP overhaul
(`xp-overhaul.md` §8); every non-design dial has been tried against it. A Blessing is a design answer.

**Three statuses didn't earn their slot.** Poison, Bleed, Conduct and Freeze are the winners; Ambush
too; Daze and Barrier are fine. The winners share a shape: **Poison, Bleed and Conduct are a
fraction of max HP, and Freeze, Daze and Barrier are booleans.** None of them has a number that has
to keep pace with a run. **Burn and Renew were the only bare magnitudes**, and they were the two that
felt bad. **Haunt** was a different problem: its payoff pointed away from the target a doubles fight
is about (§2.1).

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
- **Lasts until used.** A Blessing the opening pair does not spend in Act 1 is still there at the
  finale. The game gets easier; the designer accepted that. It also makes the Blessing a thing to
  protect, which is a decision the player keeps making all run.
- **The opening pair are Blessed at the start of every run**, in a short scene (§1.5).
- **At most one Blessing a hero.** A second one on a Blessed hero is refused (the who-screen greys
  the hero), so the supply stays countable.

### 1.3 What spends it

| Source | Spends a Blessing? | Why |
|---|---|---|
| A move's hit (incl. Conduct burst, Haunt echo) | **Yes** | The case it exists for. |
| A DoT tick (Burn, Bleed, Poison), a passive's damage (Nightmare) | **Yes** | Any source of damage. |
| Withering Gaze | **Yes** | It is a field, not the terminator. |
| **The Pact Clock** | **No** | The Clock ends stalls and nothing answers it. A Blessing that stopped it would add a round to a stall. |
| Recoil, a self-HP price | **No** | A cost must stay a cost. |
| A self-Burn's tick | **Yes** | A status instance doesn't record who applied it, so a self-Burn tick can't be told from an enemy's. It only matters when the tick would be lethal. |

**Shield first, then the Blessing.** Only what would bring HP to 0 after the Shield is prevented, so
the Blessing is spent only when it actually saves the hero. **Lingering refuses first**: a hero
holding both spends the endure (it comes back next fight) and keeps the Blessing.

`HpLossSource` carries `'clock'` and `'cost'` for the two exemptions (`faintHandling.ts`
`applyHpDelta`). The `enduresOnce` floor still reads every source, the Clock included, which
disagrees with the `'Endured'` comment in `content.ts`; no roster card endures any more, so that is
a question for whoever next gives a hero the verb.

### 1.4 Where Blessings come from

1. **The opening pair**, every run. The main supply.
2. **The Pactwarden's Shrine** (2026-10-03, per user direction): a rare reward-row seat,
   `blessingReward` / `BlessingShrineScreen`, weight 3 in `REWARD_WEIGHTS` (about one act in eleven,
   a third of runs). Pick one hero not already Blessed. Not measured.
3. **In kits — PROPOSED, not built.** A move that Blesses an ally mid-fight guarantees one knockout
   won't happen, the same category as Feint, Blind and Barrier: it should carry
   `manaCostGainOnUse` and **only last for that fight**. Rare, a Late or signature seat; rarer still
   on an enemy, where a Blessed Guardian escort cancels focus fire the player spent two turns on.

### 1.5 The scene

- **Where it sits:** INSIDE the draft since 2026-10-07 (per user direction, "bake the Blessing into
  the starter sequence"): Seal the Pact → **the pact forged and blessed** under the draft's own
  night sky → the act intro. No scene change; placeless, like the draft. A run saved on the old
  `blessing` screen resumes into the same sequence.
- **Who blesses: the Pactwarden** (per user direction): a blind elder who keeps the old binding
  rite, with a golden cord and a lantern — the witness to the pact the player has just sealed
  (`lore.md` §4). Not Ancient-coloured, for the reason no Guardian is. She is a VOICE here, not a
  figure — the pair hold the stage; her art `art/npc/pactwarden.png` stands at her Shrine.
- **The beat** (`PactForging.tsx`): the opening pair gather either side, each sends a beam of its
  own colour into the type chart between them, the chart locks — the pact forged — and rises into
  the sky as a star. Her one line: *"I bless you for this journey. You may need it."* A tap sends
  that star's light down onto each hero and leaves the gold rim at their feet; a second tap moves on.
- **What it does is said by a first-time tip, not by her.** The `blessing` tip fires on the first
  map where any roster hero is Blessed. In code and copy these are **the opening pair**.

### 1.6 Presentation

**Quiet while held, loud when spent** (per user direction): a Blessing can sit on a hero for a whole
run, so it never takes a word or a status-row chip.
- **In a fight**: a thin gold rim on the ground under the figure, breathing slowly, and a small gold
  star beside the level on the nameplate.
- **Off the map**: the same star (`BlessingMark`) on the roster sheet, the route's roster readout,
  the squad screen and the who-screens.
- **Spending it is the beat that explains it**: the banner *"X's Blessing breaks"* with a
  **Blessing used up** tag, the nameplate's star swelling and shattering (`BlessingBreak`), a gold
  flare and no hurt frame, and the `blessing` chime. A spend on a round-end tick gets its own beat
  after the summary (`buildBeats` `blessingBeat`). Its own event (`BlessingSpent`, and
  `DamageDealt.prevented` on a hit) keeps it apart from `Endured`.

### 1.7 Interactions

- **Ascension. DECIDED 2026-09-28: A1 keeps the opening Blessing** — welcome help against A1's
  wall, measured as a Revive-supply problem (`ascension.md` §9b). Taking it away is a candidate
  rule for **A5**.
- **The companion — OPEN, designer's call.** It joins after the first fight, so the opening
  Blessings never reach it. The parallel to *a Revive never saves the companion* would be *a
  Blessing is never given to the companion*; as built, the Shrine does not exclude it.
- **Wounds and `down`.** A prevented knockout means the hero is never `down`. The Blessing competes
  with the Revive and the mend in the economy; the sim's per-act gold ledger would show it.
- **Termination.** A terminated hero's Blessing goes with it, like its gear.

### 1.8 Engine

`RosterEntry.blessed`, saved with the run, copied onto `Combatant.blessed` at fight build and
written back at resolve (a replayed fight refunds it). `applyHpDelta` (`faintHandling.ts`) does the
check after the Shield; `src/run/blessings.ts` grants it (`grantBlessing`, `blessOpeningPair`).

---

## 2. Haunt

### 2.1 The problem

Haunt used to strike a Haunted hero with **Spirit or Mind attacks aimed at its partner**, so
haunting X told you to stop hitting X — backwards in a game about knocking one enemy out fast.
**Séance** (×2 against a Haunted target) already pointed the other way. Delivery was finicky too:
Torment a whole turn, Wisp half the time, and the setup died with the Haunted hero.

### 2.2 The three changes

**1. Flip the echo.** *A Spirit or Mind attack on a Haunted hero also strikes its partner.*
Haunt your focus target, keep hitting it, and the partner takes the echo. Still only single-target
moves expand, still no spread reduction.

**2. The ghost moves on.** *When a Haunted hero is knocked out, the Haunt passes to its partner*
(or to the next hero to take the fallen one's place). One pass per knockout, so it can walk down a
whole enemy side but never multiplies.

**3. No setup turn.** **Wisp** is a guaranteed rider; **Torment** stays a no-damage turn but adds
Ambush 20 on self; **Poltergeist**, **Wicked Fear** and **Crossed Path** already apply it on hit.

**Unchanged:** clears on switch; boolean; Spirit and Mind are the only trigger types.

### 2.3 What changed for each holder

| Card | Holder | Under the flip |
|---|---|---|
| Ghostlight / Wraithfire | Revenant (innate / mastered) | +25% Spirit damage to a Haunted foe; a pass keeps it live on the partner |
| Lament / Keening | Sorrow (innate / mastered) | **Reads the echo only** (`viaStatusId: 'Haunt'`), healing for what the echo dealt |
| Nightmare / Night Terror | Dread (innate / mastered) | 10% / 20% a round to each Haunted enemy; Haunt persists through KOs, so the tick keeps finding a host |
| Enthrall | Evolution grant | Unchanged — a delivery |
| Omen | Evolution grant | Both enemies Haunted on entry: two-target Spirit for the fight. Strong, but it's the Evolution's payoff |
| Séance | Late pool | Now agrees with the echo |
| Perfect Creation | Mech Late | Unchanged |

### 2.4 Copy

Card text: *"A Spirit or Mind attack on this hero also strikes its partner. When this hero falls,
the Haunt passes to its partner. Cleared by switching."*

### 2.5 As built

- **The flip:** `expandSpreadTargets` (`statusEngine.ts`) asks whether the *target* holds a status
  whose `spreadTriggerTypes` include the move's type, and adds its standing partner, stamped
  `viaStatusId`.
- **Passing on:** `StatusDefinition.passesOnFaint` (Haunt alone). `passFaintedStatuses` sweeps
  between actions and after each round-end step, removing it from the fallen (`StatusRemoved`
  `'passed'`) and applying it to the partner, or parking it on `CombatState.pendingSideStatuses`
  for the next hero to enter (`performSwitch`).
- **Open, unmeasured:** Wisp is now Poltergeist's cheaper Early twin — whether Poltergeist wants
  something of its own; and **Night Terror stays at 20%**, which may need to come down.

---

## 3. Burn

> **Superseded 2026-10-06** by `status-ladders-and-fields.md` §1: Burn is three levels now, and Rest puts it out.

### 3.1 The change

Everything that makes it Burn is kept — front-loaded, halving, **cleansed by switching** — and the
unit changed: **the magnitude is a percent of the holder's max HP**, halving each round, **never
caster-scaled** (CLAUDE.md is amended: the status-magnitude formula's `dot` arm and Boiler's
`scaledBy` have no holder).

| Status | Shape | Switching |
|---|---|---|
| Bleed | 5% every round, forever | persists |
| Poison | delayed burst after 3 rounds | only counts down while active |
| **Burn** | a front-loaded spike that halves | **cleanses** |

A self-Burn is now a price you can read before pressing the button.

### 3.2 The cost: the Fire kits

Burn was referenced 21 times in moves, 18 in passives, 7 in signatures. Every authored magnitude
was converted by one measured rate (§3.3); the readers (`requiresTargetStatus: 'Burn'`,
detonations, Scorched Land) still read "is Burned".

### 3.3 As built

- **The rate was measured, not guessed.** Against an at-par target, the old Burns landed at about
  **half their authored number as a percent** in every tier (Spark Flash 15 ≈ 8.6%, Spark Burst 60
  ≈ 30%), because caster scaling grew at about the rate HP does. So a Burn on an enemy is
  **authored ÷ 2**, a self-Burn cost **÷ 3** (what it cost at par), a passive's flat Burn **÷ 3**,
  Boiler's scaled one ÷ 2; **Showstopper** is 4%, to keep the mastered card at least double its
  innate's 2%.
- **Engine:** `StatusDefinition.percentOfMaxHp` (a tick deals `ceil(maxHp × magnitude / 100)` of the
  holder's max) and `fixedMagnitude` (never scaled). Every printed Burn number wears its %
  (`statusAmountText`).
- **Not measured** (per user direction). It lands at parity at par by construction; what changes is
  that Burn no longer falls behind a tank, a Banner stack or late gear.

### 3.4 Burn keeps the higher (2026-09-28, per user direction)

Burn's stacking is **keep the higher** (`takeHigher`): a new Burn refreshes a fading one to the
larger of the two and never adds to it.

**Why:** under every-round recasting on a target that never switches, additive + halving settled at
twice the magnitude (Set Alight every round: 120% of max HP over 5 rounds, for 20 mana a cast).
Keep-the-higher leaves a single cast unchanged (8 → 4 → 2 → 1) and spam ticks 8, 8, 8… Each status
keeps its own job: **Bleed** set and forget, **Burn** a spike you refresh, **Poison** the one that
stacks and bursts. **Set Alight** (Early, 20 mana, 15%) is still the best cheap status move and is
left for playtest; 12% is the candidate if it reads as too strong.

## 4. Renew

> **Superseded 2026-10-06** by `status-ladders-and-fields.md` §2: Renew is a count of 10% heals, unscaled.

### 4.1 The problem

Renew was slow — cast on a hurt hero who was knocked out before it healed enough to matter — and
flat, so it fell further behind as HP grew through a run.

### 4.2 The change

A **percent of the holder's max HP**, its **first heal on application**, then a **flat fixed
duration** with no halving. Renew persists through switching and ticks on the bench, so **Renew and
rotate** — heal on the bench, come back healthy — is the healing half of bench mana regen. The Renew
payoffs (stacking three ways) are a design goal.

### 4.3 As built

A percent of the HOLDER's max HP that **keeps its Wisdom scaling** (authored × Wisdom StatMult ×
STAB, snapshotted at cast; CLAUDE.md's healing formula carries the named exception).

- **Shape:** heals the moment it lands (`ticksOnApply`), then at the end of each of the next 2
  rounds (`defaultDuration: 2`): three heals in all. A second Renew adds to the pool and tops the
  clock back up (`additiveRefreshDuration`).
- **The rate, at parity:** new percent = authored × 200 ÷ (3 × par HP) — about ÷3.5 Early, ÷4 Mid,
  ÷4.7 Late, signatures and passives ÷4 (Refresh 30 → 9%, Overgrowth 150 → 32%). **Restorative
  Toxin** pays Renew at ×0.5 of the Poison it applied.
- **The trade:** total healing is unchanged at par; a third lands at once and none decays. **The
  cost:** a Renew lasts 2 rounds where a halving one lingered for four or five, so moves that read
  "the user holds Renew" (Branch Slam, Seed Shot's line) have a shorter window. `defaultDuration` is
  the dial if that bites. Not measured.

## 5. Scorched Land and Verdant Earth

- **Scorched Land — Burn keeps ¾ instead of half.** A "switching doesn't cleanse Burn" version was
  reverted the same day: the enemy AI never switches, so it only ever bit the player. With
  keep-the-higher (§3.4) it makes one Burn linger rather than a stack snowball.
- **Verdant Earth** (per user direction): *Renew heals twice as much, and healing past max HP becomes
  Shield* (`FieldEffectDefinition.amplifiesStatusHealing`, read in `healFromStatus`), replacing the
  bonus Attack/Intelligence equal to current Renew. The old `statBonusEqualToStatusMagnitude` verb
  stays in the vocabulary with no holder. The Elder Bough now plays more defensively under its own
  field.

---

## 6. Build order

All of it is built. Phases 4 and 7 (the sim measurements) were skipped per user direction, so
Act 1 clear, Blessings spent by act and the Spirit heroes' win rates under the flip are unmeasured.

---

## 7. Invariants this touches

- **Consumables / Revive:** a Blessing is prevention where the Revive is recovery. A1's "a Revive
  is the ONE way back" stays true; a Blessing is not a way back.
- **Status magnitude formula:** Burn left it, unscaled; Renew left the `hot` arm's unit but keeps its
  Wisdom scaling. Both are named in CLAUDE.md.
- **Haunt's spread:** the single-target-only rule stands; the direction flipped.
