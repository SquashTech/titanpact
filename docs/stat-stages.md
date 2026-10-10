# stat-stages.md — Buffs and debuffs as counted steps

> **STATUS: DECIDED 2026-10-09 (per user direction); phases 0–1 BUILT and phase 2 mechanically**
> (same day): the badge, the engine (`Combatant.statStages`, `applyStageDelta`, `stageMultiplier`),
> the beat copy, the tip and its chart, every move's delta converted by the §6.1 bands, and the
> §6.2 statement moves re-authored as suggested (Break Will's clear is `clearsRaisedStages`), and
> **the passive brake (§6.3) built**: every passive stat effect is a stage (119), the 100 on a repeating hook
> braked. **Only the derived grants (§6.4) and Tyrant's Due's run-long gain are still FLAT.** Not measured.
> Every buff and debuff a fight hands out becomes a **stage**: a stat moves **up to five steps
> either way**, each step a fixed multiplier on what the hero brought to the fight. This
> **supersedes `docs/stat-scaling.md`** (caster-scaled flat deltas and the −½ … ×4 band) and
> reverses the CLAUDE.md invariant "stat modifiers are flat additive integers" for fight
> modifiers (§11). Decided: the range, the curve, the display, the tip, and that **stages survive
> a switch**. Open: §10. The before → after mapping for all 273 sites is generated in the
> appendices.

---

## 0. Why this exists

A buff was a flat number, so a new buff move could differ from an old one only by being bigger.
Picking up a +90 Intelligence move next to a +75 one is a non-event, and the slates said so:
**of 104 moves carrying a stat delta, not one trades a stat up for one down** — they all sat on
the same single axis, size.

`docs/stat-scaling.md` §0 weighed stages on 2026-09-14 and set them aside for two reasons, and
both have moved:

1. *"A step is a discrete dial where the slates use a continuous one."* The continuous dial is
   the problem. Two points on it read as the same move.
2. *"A flat buff helps a weak stat more than a strong one"* — buff the squishy. That job now
   belongs to **Shield** (bonus HP off the caster's Defense, worth most on a fragile target,
   `docs/shield.md`), which did not exist when the call was made.

A count also does what a flat number cannot: it can be **cleared, stolen, copied, inverted,
passed on a pivot and read by a move**, so new buffs can differ by what they do (§8).

---

## 1. The rule this reduces to

**Flat is what you bring. Stages are what happens in the fight.**

| Flat (unchanged) | Stages (new) |
|---|---|
| Base stats, growth rolls, Gems | A move's `statDeltas` |
| Equipment, Banners, the Mana Well, the Ley Line | A passive's `statDelta` effect |
| Evolution and Class grants | Derived fight grants (Apex Predator, Stampede — §6.4) |
| A passive's `statGrants` / `partnerStatGrants` (always-on, loadout-shaped) | |
| MP Regen, everywhere (Mana Font's +10 stays flat) | |

Stages apply to **ATK, DEF, INT, WIS and SPD**. HP, the Mana pool and MP Regen have none — no
current delta touches HP or the pool, and MP Regen is exempt from every per-hero rule already.

---

## 2. The curve

    effective = round((base + loadout) × stageMult)
    stageMult = (2 + n) / 2  for n ≥ 0,   2 / (2 − n)  for n < 0,   n ∈ [−5, +5]

| Steps | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| ▲ up | ×1.5 | ×2 | ×2.5 | ×3 | ×3.5 |
| ▼ down | ÷1.5 | ÷2 | ÷2.5 | ÷3 | ÷3.5 |

- **Stages sum and clamp.** +2 then −2 is exactly where it started. A step past ±5 is lost, and
  if nothing moved the beat says *can't go any higher / lower*.
- **The smallest step clears the dice.** Variance is 0.85–1.0, so a high roll is ~18% over a low
  one; a step under ~×1.33 hides inside it. ×1.5 does not.
- **The two-pipeline rule holds.** A stage multiplies the stat in the stat pipeline, which still
  outputs only the off/def ratio; Force, relic bonuses and every damage modifier stay in the
  damage pipeline. A damage-pipeline version (+2 ATK = ×2 outgoing) was rejected because Speed
  order, Shield off Defense, Bedrock and Wisdom-scaled heals all read the stat itself.
- **Every reader of the stat sees it.** A WIS stage moves heals and Shield-on-Defense moves with
  a DEF stage. The `[0.5, 2.0]` StatMult clamp on those formulas still bounds them.
- **Against the band it replaces:** the buff ceiling comes down from ×4 to ×3.5; the debuff floor
  goes from ×½ to ÷3.5 (≈ ×0.29). The floor is the number to watch (§10).

### Lifetime

- **Stages survive a switch** (decided 2026-10-09 — consistent with the 2026-08-15 call that stat
  mods persist, `docs/combat.md`). The tip says so.
- Rest does not clear them. The fight's end does.

---

## 3. What is deleted

- **Caster scaling of deltas** — `src/engine/combat/statDeltaScaling.ts` (`scaleStatDelta`,
  `statDeltaRole`). A stage is a stage, whoever casts it.
- **The −½ … ×4 band** — `statModifierFloor`, `statModifierCeiling`, `STAT_CEILING_MULTIPLE`. The
  clamp at ±5 is the band now.
- **`modTier`** in `CombatantCard.tsx` — the badge reads the stage count directly.
- **Stampede's `uncapped`** exception goes with the ceiling it was the exception to, unless §6.4
  keeps it.

**What Wisdom loses:** it was the stat that made a buff land bigger. It keeps heals and the
magical defence, but it is thinner than it was (§10).

---

## 4. Display (phase 0 BUILT, `ac5d3f47`)

The nameplate badge (`StatModBadge`, `CombatantCard.tsx`):

- **The abbreviation, an arrow, and one filled pip per step** — `ATK ▲ ▮▮`. No empty slots: a
  five-slot track was tried in mockup and crowded a full field.
- **Gold up (`#ef9f27`), slate down (`#85b7eb`)**, not the app's green/red — direction never
  rests on a red/green read, and the arrow carries it in greyscale.
- **Framed at the limit**: *can't go any higher / lower* is a state.
- **Never a number.** "+1" reads as one point when every other figure on the sheet is points.
  A long press gives `Attack ▲▲ — ×2`.

Until the engine lands the badge runs on the old flat modifiers with one to three pips.

### The beat

The change gets the words, the badge gets the pip:

| Steps | Up | Down |
|---|---|---|
| 1 | *Attack rose* | *Attack fell* |
| 2 | *Attack rose sharply* | *Attack fell sharply* |
| 3+ | *Attack rose drastically* | *Attack fell drastically* |
| at the limit | *Attack can't go any higher* | *Attack can't go any lower* |

The console line, the popup and the move text (`MoveTile`, `MoveDetailOverlay`, generated from
the data) read `ATK ▲▲` where they read `+20 ATK`.

---

## 5. The tip

A fight tip on the first stat change an account ever sees, either side:

> **Raised and lowered**
> An arrow beside a stat means it was raised or lowered in this fight. Arrows stay through a
> switch.
>
> | | 1 | 2 | 3 | 4 | 5 |
> |---|---|---|---|---|---|
> | ▲ | ×1.5 | ×2 | ×2.5 | ×3 | ×3.5 |
> | ▼ | ÷1.5 | ÷2 | ÷2.5 | ÷3 | ÷3.5 |

Tip pages are strings today (`src/data/tips.ts`); the chart needs a page token (`[stages]`) or a
structured page in `TipOverlay`, with `test/tips.test.ts` covering it.

---

## 6. Migration

### 6.1 Moves — by authored base

| Today (buff) | Stages | Today (debuff) | Stages |
|---|---|---|---|
| +10 … +25 | ▲ | −10 … −20 | ▼ |
| +30 … +55 | ▲▲ | −25 … −35 | ▼▼ |
| +60 … +90 | ▲▲▲ | −40 and past | ▼▼▼ |
| +100 | ▲▲▲▲ | | |

The bands sit where today's figure landed against a median stat: +20 on a 60-Attack hero was
×1.33, nearest ▲; −30 on 55 Defense was ×0.45, nearest ▼▼. Applied: **51 ▲, 16 ▲▲, 4 ▲▲▲,
1 ▲▲▲▲, 51 ▼, 10 ▼▼, 2 ▼▼▼** across 135 deltas.

**The +10/+15 moves get stronger.** ▲ is ×1.5; today's +10 was ~×1.17. Eighteen deltas sit at
+10/+15; their mana or their rider is what to look at, not their stage.

`statDeltaChance` and `statDeltaTarget` carry over unchanged. Prowl's partner multiplier
(`statDeltaPartnerType`) becomes **one extra step** with the partner.

### 6.2 Statement moves — re-authored, not mapped (BUILT 2026-10-09)

The mechanical band would make these +3s; each instead uses the axes stages open. Built as below,
mana costs untouched; a self-side drop is a cost and the tile still reads it as a Buff, and Break
Will's clear is a new verb, `MoveDefinition.clearsRaisedStages` (raised stages on each delta target
return to 0 before the move's own drops land; a lowered one is kept).

| Move | Today | Suggested |
|---|---|---|
| Frost Wall (late, both allies) | DEF +60 | DEF ▲▲ both allies — a both-allies ▲▲ is already the statement |
| Storm Surge (late, both allies) | ATK +50, SPD +50 | ATK ▲, SPD ▲▲ both allies — speed control |
| Exalt (late, ally) | INT +100 | INT ▲▲▲ on an ally |
| Shadow Form (late, self) | ATK +75 | ATK ▲▲▲, DEF ▼ — the first trade |
| Study (mid, self) | INT +60 | INT ▲▲ — a Mid move is not a +3 |
| Break Will (late, both foes) | ATK −50, INT −50 | ATK ▼, INT ▼ both foes, and clears their raised stages |
| Ascendant (late, self) | INT +75, SPD +25 | INT ▲▲, SPD ▲ |
| Juggernaut (late, self) | ATK/DEF/SPD +50 | ATK ▲▲, DEF ▲▲, SPD ▼ — a juggernaut is slow |
| Pack Leader (late, both allies) | ATK +50, SPD +50 | ATK ▲, SPD ▲ both allies |

### 6.3 Passives — the hard part

**101 of the 127 passive stat effects fire on a repeating hook with no cap** — 58 on
`DamageDealt` alone. Under flat deltas the ×4 ceiling took many hits to reach; at a step a hit
they reach ▲5 in five. The magnitude mapping (+5 … +15 → ▲, +20 … +35 → ▲▲, +40 → ▲▲▲, the same
for drops) is in Appendix B, but **a repeating passive needs a brake before its stage means
anything.** 99 of the 127 are a hero's identity (36 mastered innates, 34 path passives, 29
innates), so the brake is roster design, not loot tuning.

**The brake — DECIDED 2026-10-09 (per user direction): one step a round, up to a cap a fight.**

- **Tempo, an engine rule:** a passive on a repeating hook moves a stat **at most one step a
  round**, whatever it answers — a spread hit, two hits, a tick and a hit are still one step. One
  step a firing always: a repeating card's old size buys its CAP, never a bigger step.
- **Ceiling, per card:** a repeating card stops after a number of steps a fight, read off its old
  figure — **±5 → 2, ±10 or ±15 → 3, ±20 and past → 5** (the stage limit). Authored on the EFFECT
  as `perFight` beside `stages` (built so, not on the reaction's `maxFiresPerFight`): the brake holds
  the stat change alone, so a card's other half — Wildfire's Mana — keeps firing past it. A step the
  limit swallows whole is not a firing and spends nothing.
- **Mastered = twice the base card's cap**, held at 5 — mastering ramps LONGER, not faster
  (Fang's Pack Hunter 2 → Alpha's Call 4; Cinder's Kindling 3 → Forgeheart 5). A mastered card
  whose base has no repeating stat effect (Bellows, Rex, Ursa, Vex) takes the band off its own
  figure. **Kite gains nothing** (Outpace is already at 5) and needs its mastery authored by hand.
- **Card text says both:** "Once a round, when it hits: ATK ▲ (3 a fight)".
- **Bounded hooks are untouched:** a `SwitchedIn` / `SwitchedOut` card (19) re-fires only on a
  pivot, which costs a turn, and a once-a-fight card is already capped. Those land their band
  (+5 … +15 → ▲, +20 … +35 → ▲▲, +40 → ▲▲▲) a firing, no round rule.
- **Derived amounts** (Stampede, Surging Intellect, Neuroplastic) are §6.4's.

A STACKED card (a Boon taken twice) multiplies the cap, never the one-a-round tempo (built so;
the user's to overturn).

### 6.4 Derived grants — decided one by one

| Grant | Today | Suggested |
|---|---|---|
| Apex Predator (move) | ATK equal to its own ATK | ATK ▲▲ — it is ×2, exactly |
| Arcane Overflow (move) | ATK/INT equal to mana before the cast, both allies | a step per 40 mana spent, max ▲▲▲ — or kept as the named flat exception |
| Stampede / Stampede+ | SPD doubles each round end, past the ceiling | SPD ▲▲ each round end, capped at ▲5 like any other |
| Surging Intellect / + | INT equal to every mana gained | INT ▲ each time 30+ mana lands at once (a Rest, a grant) |
| Neuroplastic / + | WIS (and ATK/INT) equal to a lowered stat's drop | **a step for every step a foe takes from it** — a stage verb as written |

### 6.5 Stays flat

`conditionalStatGrants` (Bloodthirsty) and `partnerStatGrants` (Mana Chime) are always-on and
loadout-shaped, so they stay flat by §1. Bloodthirsty reads fight state and is the one to
re-check.

---

## 7. Fallout

- **Engine:** `Combatant.statModifiers` becomes a stage record; `getEffectiveStat` applies the
  multiplier; `resolveRound`'s delta loop drops scaling; `StatChanged` carries `steps` and
  `capped`; `getCombatStatDelta` reads stages.
- **AI:** its valuation of a buff is in points today and needs re-pricing in stages.
- **View:** the badge (done), the console and popup lines (`buildBeats.ts`, `formatEvent.ts`),
  the move text, the hero detail breakdown.
- **Tests:** `statDeltaScaling`, the floor/ceiling tests, any fixture asserting a landed figure.
- **Docs:** `stat-scaling.md` marked superseded; `combat.md`; CLAUDE.md's invariant (§11).
- **Sim:** one pass after the move migration, read for broken mechanics (memory: sims are
  directional).

---

## 8. Verbs the count opens (candidates, not built)

Clear every stage on a target (Haze, `combat.md`'s open lever) · steal a target's raised stages
· copy an ally's · invert a target's · pass stages on a pivot (Living Wall already passes a
Shield) · a move whose power rises per stage its user, or its target, holds · immune to drops ·
reflect a drop · gain stages when dropped · a threshold rider ("at ▲▲ ATK, hits also Bleed").

---

## 9. Phases

0. **The badge** — BUILT (`ac5d3f47`).
1. **The engine** — BUILT: `statStages` beside the flat `statModifiers` (which keeps passives,
   derived grants and MP Regen — Mana Font moved to `mpRegenGrant`), the curve and the ±5 clamp,
   `StatChanged.stages`, `statDeltaScaling.ts` deleted, `hasStatReduction` reading stages, the AI
   and the pilot pricing a step as the points it moves; the beat copy ("rises sharply"), the
   `[stages]` tip token and `fight.stages`.
2. **Moves** — BUILT: the §6.1 mapping, and the §6.2 statement moves re-authored.
3. **Passives** — BUILT: the brake (`PassiveInstance.steppedRound` / `stepsThisFight`), `stages` +
   `perFight` on every card (112 converted), the card text and the readout rows. Next: the derived
   grants (§6.4) and Kite's mastery.
4. **Measure** — one sim pass, then play.

---

## 10. Open questions

1. **Wisdom's lost job** — it no longer sizes a buff. Is heals and magical defence enough for a stat, or
   does it want a stage-flavoured second job?
2. **The debuff floor** — ÷3.5 is far below today's ½, and the enemy AI never switches out of a
   drop. Start at −5 and pull back to −3 if debuffs dominate.
3. ~~The repeating-passive brake~~ — built (§6.3).
4. **Arcane Overflow and Surging Intellect** — converted or kept as named flat exceptions.
5. **Stampede's exception** — capped at ▲5 or still uncapped.
6. **+10/+15 moves at ×1.5** — re-priced in mana, or left as a buff to the Early slates.
7. **Bloodthirsty** — flat or staged.

---

## 11. Invariants reversed

| CLAUDE.md said | Now |
|---|---|
| Stat modifiers are flat additive integers, multiples of 5 or 10; no % stat mods | Fight modifiers are stages, a multiplier on (base + loadout); loadout grants stay flat |
| A move's delta is a BASE scaled off the caster's Wisdom / offensive stat | A stage is a stage; no caster scaling |
| A fight modifier is held inside −½ … +3× of (base + loadout) | Held at ±5 steps: ×3.5 up, ÷3.5 down |
| Stampede's Speed rises past the ceiling | Open (§10.5) |

---

## Appendix A — Moves, before → after

Generated from the data 2026-10-09 (signature twins collapsed). `rider` = a damaging move whose
delta rides the hit. Rows marked *statement* take §6.2 over the band; *derived* take §6.4.

#### Fire

| Move | Source | Kind | Lands on | Today | Proposed | Note |
|---|---|---|---|---|---|---|
| Kindle | early | buff | self | ATK +20 | ATK ▲ |  |
| Heat Haze | mid | buff | both foes | INT -20 | INT ▼ |  |
| Molten Lash | mid | damage | foe | DEF -20 | DEF ▼ | rider |
| Emberlance | Signature | damage | self | DEF +20 | DEF ▲ | rider |

#### Water

| Move | Source | Kind | Lands on | Today | Proposed | Note |
|---|---|---|---|---|---|---|
| Ink Cloud | early | buff | both foes | ATK -15, INT -15 | ATK ▼, INT ▼ |  |
| Undertow | early | damage | foe | DEF -10 | DEF ▼ | rider |
| Vise | Signature | damage | foe | SPD -20 | SPD ▼ | rider |

#### Frost

| Move | Source | Kind | Lands on | Today | Proposed | Note |
|---|---|---|---|---|---|---|
| Frost Armor | early | buff | ally | DEF +20 | DEF ▲ |  |
| Blinding Snow | mid | buff | both foes | SPD -10 | SPD ▼ |  |
| Frost Wall | late | buff | both allies | DEF +60 | DEF ▲▲▲ | statement move — re-author |

#### Storm

| Move | Source | Kind | Lands on | Today | Proposed | Note |
|---|---|---|---|---|---|---|
| Charge | early | buff | self | SPD +10, INT +20 | SPD ▲, INT ▲ |  |
| Tailwind | mid | buff | ally | SPD +40 | SPD ▲▲ |  |
| Storm Surge | late | buff | both allies | ATK +50, SPD +50 | ATK ▲▲, SPD ▲▲ | statement move — re-author |
| Stormkite | Signature | buff | both foes | SPD -20 | SPD ▼ |  |

#### Stone

| Move | Source | Kind | Lands on | Today | Proposed | Note |
|---|---|---|---|---|---|---|
| Gravel Spray | early | damage | both foes | DEF -10 (30%) | DEF ▼ (30%) | rider |
| Mud Ball | early | damage | foe | SPD -10 | SPD ▼ | rider |
| Toughen Up | early | buff | ally | ATK +15, DEF +15 | ATK ▲, DEF ▲ |  |
| Spire Claw | mid | damage | self | DEF +20 | DEF ▲ | rider |
| Landslide | late | damage | both allies | DEF +20 | DEF ▲ | rider |
| Groundsplit | Signature | damage | both foes | SPD -15 | SPD ▼ | rider |
| Rollout | Signature | damage | self | DEF +20 | DEF ▲ | rider |
| Roost Guard | Signature | buff | both allies | DEF +30 | DEF ▲▲ |  |
| Upheaval | Signature | damage | self | ATK +20 | ATK ▲ | rider |

#### Nature

| Move | Source | Kind | Lands on | Today | Proposed | Note |
|---|---|---|---|---|---|---|
| Ivy Spike | early | damage | foe | ATK -10 | ATK ▼ | rider |
| Toxic Spores | early | buff | foe | SPD -10 | SPD ▼ |  |
| Corrode | mid | damage | foe | DEF -10 | DEF ▼ | rider |
| Rootbind | mid | buff | foe | SPD -30 | SPD ▼▼ |  |
| Thorn Whip | mid | damage | foe | ATK -10, INT -10 | ATK ▼, INT ▼ | rider |
| Sporestorm | Signature | damage | both foes | SPD -10 | SPD ▼ | rider |

#### Light

| Move | Source | Kind | Lands on | Today | Proposed | Note |
|---|---|---|---|---|---|---|
| Bless | early | buff | ally | INT +20 | INT ▲ |  |
| Radiance | mid | buff | both allies | INT +40 | INT ▲▲ |  |
| Exalt | late | buff | ally | INT +100 | INT ▲▲▲▲ | statement move — re-author |
| Bulwark Strike | Signature | damage | both allies | DEF +20 | DEF ▲ | rider |

#### Shadow

| Move | Source | Kind | Lands on | Today | Proposed | Note |
|---|---|---|---|---|---|---|
| Hamstring | early | damage | foe | SPD -15 | SPD ▼ | rider |
| Weaken | early | buff | foe | ATK -20, DEF -20 | ATK ▼, DEF ▼ |  |
| Enfeeble | mid | buff | both foes | ATK -30, DEF -30 | ATK ▼▼, DEF ▼▼ |  |
| Smoke Bomb | mid | buff | both foes | ATK -20, SPD -20 | ATK ▼, SPD ▼ |  |
| Shadow Form | late | buff | self | ATK +75 | ATK ▲▲▲ | statement move — re-author |
| Bogslam | Signature | damage | foe | ATK -20, SPD -20 | ATK ▼, SPD ▼ | rider |
| Evil Eye | Signature | damage | foe | ATK -20, INT -20 | ATK ▼, INT ▼ | rider |
| Jinx | Class | damage | foe | INT -15 | INT ▼ | rider |

#### Arcane

| Move | Source | Kind | Lands on | Today | Proposed | Note |
|---|---|---|---|---|---|---|
| Focus | early | buff | self | INT +20 | INT ▲ |  |
| Mana Font | early | buff | both allies | MPR +10 | MPR ▲ |  |
| Study | mid | buff | self | INT +60 | INT ▲▲▲ | statement move — re-author |
| Arcane Overflow | late | buff | both allies | — | ? | derived — decide by hand |
| Culmination | Signature | damage | self | INT +20 | INT ▲ | rider |
| Erasure | Signature | damage | both foes | INT -20 | INT ▼ | rider |
| Fairy Ring | Signature | buff | both allies | SPD +20 | SPD ▲ |  |
| Runebreaker | Signature | damage | foe | DEF -20 | DEF ▼ | rider |

#### Mind

| Move | Source | Kind | Lands on | Today | Proposed | Note |
|---|---|---|---|---|---|---|
| Brain Ward | early | buff | ally | WIS +30 | WIS ▲▲ |  |
| Distort | early | buff | foe | INT -20 | INT ▼ |  |
| Enervate | early | buff | foe | WIS -30 | WIS ▼▼ |  |
| Lull | early | buff | foe | INT -30 | INT ▼▼ |  |
| Psi Bolt | early | damage | foe | WIS -20 (50%) | WIS ▼ (50%) | rider |
| Psi Pulse | early | damage | both foes | WIS -10 (30%) | WIS ▼ (30%) | rider |
| Disorient | mid | buff | both foes | INT -30, WIS -30 | INT ▼▼, WIS ▼▼ |  |
| Mental Fortress | mid | buff | both allies | WIS +30 | WIS ▲▲ |  |
| Psyshock | mid | damage | foe | WIS -30 (50%) | WIS ▼▼ (50%) | rider |
| Stasis | mid | buff | both allies | INT +20, WIS +20 | INT ▲, WIS ▲ |  |
| Break Will | late | buff | both foes | INT -50, ATK -50 | INT ▼▼▼, ATK ▼▼▼ | statement move — re-author |
| Psionic Wave | late | damage | both foes | WIS -30 (50%) | WIS ▼▼ (50%) | rider |
| Psychokinesis | late | damage | foe | WIS -20 | WIS ▼ | rider |
| Hollowing | Signature | damage | foe | WIS -30 | WIS ▼▼ | rider |
| Mindlink | Signature | damage | both allies | ATK +15, INT +15 | ATK ▲, INT ▲ | rider |
| Stinging Bloom | Signature | damage | both foes | ATK -10 | ATK ▼ | rider |
| Tragicomedy | Signature | damage | both foes | ATK -15, INT -15 | ATK ▼, INT ▼ | rider |

#### Spirit

| Move | Source | Kind | Lands on | Today | Proposed | Note |
|---|---|---|---|---|---|---|
| Unbound | early | buff | self | INT +20, SPD +15 | INT ▲, SPD ▲ |  |
| Soul Offering | mid | buff | ally | INT +40, ATK +40 | INT ▲▲, ATK ▲▲ |  |
| Ascendant | late | buff | self | INT +75, SPD +25 | INT ▲▲▲, SPD ▲ | statement move — re-author |
| Wailing Flight | late | damage | self | SPD +20 | SPD ▲ | rider |
| Ancestors Rise | Signature | buff | both allies | ATK +25, INT +25 | ATK ▲, INT ▲ |  |
| Dirge of Ash | Signature | damage | both foes | ATK -20 | ATK ▼ | rider |
| Last Keen | Signature | damage | both foes | ATK -15, INT -15 | ATK ▼, INT ▼ | rider |

#### Iron

| Move | Source | Kind | Lands on | Today | Proposed | Note |
|---|---|---|---|---|---|---|
| Fortify | early | buff | self | DEF +20 | DEF ▲ |  |
| Iron Fist | early | damage | self | ATK +10 | ATK ▲ | rider |
| Opening Strike | early | damage | foe | DEF -10 | DEF ▼ | rider |
| Pin Down | early | buff | foe | DEF -20, SPD -10 | DEF ▼, SPD ▼ |  |
| Sharpen | early | buff | self | ATK +30 | ATK ▲▲ |  |
| Momentum Swing | mid | damage | self | ATK +20 | ATK ▲ | rider |
| Parry | mid | buff | self | ATK +20 | ATK ▲ |  |
| Reinforce | mid | buff | both allies | ATK +20, DEF +20 | ATK ▲, DEF ▲ |  |
| Rend Armor | mid | damage | foe | DEF -20 | DEF ▼ | rider |
| Juggernaut | late | buff | self | ATK +50, DEF +50, SPD +50 | ATK ▲▲, DEF ▲▲, SPD ▲▲ | statement move — re-author |
| Onslaught | late | damage | self | ATK +30 | ATK ▲▲ | rider |
| Broadside | Signature | damage | self | DEF -20 | DEF ▼ | rider |
| Intercept | Class | buff | self | DEF +10 | DEF ▲ |  |
| Oathstrike | Signature | damage | both allies | ATK +15 | ATK ▲ | rider |

#### Mech

| Move | Source | Kind | Lands on | Today | Proposed | Note |
|---|---|---|---|---|---|---|
| Kickstart | early | heal | ally | SPD +10 | SPD ▲ |  |
| Overdrive | late | buff | both allies | ATK +20, DEF +20, INT +20, WIS +20, SPD +20 | ATK ▲, DEF ▲, INT ▲, WIS ▲, SPD ▲ |  |
| Overhaul | Signature | heal | ally | DEF +20 | DEF ▲ |  |

#### Beast

| Move | Source | Kind | Lands on | Today | Proposed | Note |
|---|---|---|---|---|---|---|
| Howl | early | buff | both allies | ATK +15, SPD +15 | ATK ▲, SPD ▲ |  |
| Prowl | early | buff | self | ATK +20, SPD +20 | ATK ▲, SPD ▲ |  |
| Rally | early | buff | both allies | ATK +20 | ATK ▲ |  |
| Apex Predator | late | buff | self | — | ? | derived — decide by hand |
| Pack Leader | late | buff | both allies | ATK +50, SPD +50 | ATK ▲▲, SPD ▲▲ | statement move — re-author |
| Ground Pound | Signature | damage | both foes | ATK -10 | ATK ▼ | rider |
| Pack Call | Signature | damage | both allies | SPD +15 | SPD ▲ | rider |
| Stranglehold | Signature | damage | foe | SPD -20, DEF -20 | SPD ▼, DEF ▼ | rider |

#### Ancient

| Move | Source | Kind | Lands on | Today | Proposed | Note |
|---|---|---|---|---|---|---|
| Archon Blast | mid | damage | self | WIS +20 | WIS ▲ | rider |
| Erode | mid | buff | both foes | DEF -15, WIS -15 | DEF ▼, WIS ▼ |  |
| Forgotten Curse | mid | damage | both foes | WIS -10 | WIS ▼ | rider |
| Weight of Ages | mid | damage | both foes | SPD -15 | SPD ▼ | rider |
| Raise the Standard | late | buff | both allies | ATK +20, INT +20 | ATK ▲, INT ▲ |  |

## Appendix B — Passive stat effects, before → after

Generated from the data 2026-10-09, mastered (+) cards included. **repeats — cap risk** marks a
repeating hook with no `oncePerFight` or `maxFiresPerFight` (§6.3).

| Passive | Trigger | Lands on | Today | Proposed | Note |
|---|---|---|---|---|---|
| Afterglow | Healed (source) | trigger target | ATK/INT +20 | ATK/INT ▲▲ | **repeats — cap risk** |
| Aftershock | DamageDealt (source) | trigger target | DEF -10 | DEF ▼ | **repeats — cap risk** |
| Anvil Crown | DamageDealt | self | INT +10 | INT ▲ | **repeats — cap risk** |
| Bad Luck | DamageDealt (source) | randomEnemy | ATK/INT -5 | ATK/INT ▼ | **repeats — cap risk** |
| Bad Luck+ | DamageDealt (source) | randomEnemy | ATK/INT -10 | ATK/INT ▼ | **repeats — cap risk** |
| Bitter Cold | DamageDealt (source) | self | ATK +10 | ATK ▲ | **repeats — cap risk** |
| Bitter Cold+ | DamageDealt (source) | self | ATK +20 | ATK ▲▲ | **repeats — cap risk** |
| Breach | DamageDealt (source) | trigger target | DEF -5 | DEF ▼ | **repeats — cap risk** |
| Breach+ | DamageDealt (source) | trigger target | DEF -15 | DEF ▼ | **repeats — cap risk** |
| Brimming | Healed | self | ATK +10 | ATK ▲ | **repeats — cap risk** |
| Brimming | StatusTicked | self | ATK +10 | ATK ▲ | **repeats — cap risk** |
| Brimming+ | Healed | self | ATK +20 | ATK ▲▲ | **repeats — cap risk** |
| Brimming+ | StatusTicked | self | ATK +20 | ATK ▲▲ | **repeats — cap risk** |
| Bury | DamageDealt (source) | trigger target | SPD -10 | SPD ▼ | **repeats — cap risk** |
| Cavalry Charge | SwitchedIn | self | ATK +30 | ATK ▲▲ |  |
| Chest Beat | SwitchedIn | activeEnemies | ATK -10 | ATK ▼ |  |
| Chest Beat+ | SwitchedIn | activeEnemies | ATK -20 | ATK ▼▼ |  |
| Cinderguard | RoundStarted | self | DEF +10 | DEF ▲ | **repeats — cap risk** |
| Closing Canopy | SwitchedOut | activeEnemies | SPD -20 | SPD ▼▼ |  |
| Cold Forge | StatChanged | self | ATK +10 | ATK ▲ | **repeats — cap risk** |
| Combustion | StatusApplied | self | ATK +20 | ATK ▲▲ | **repeats — cap risk** |
| Consecrate | Healed | self | DEF/WIS +5 | DEF/WIS ▲ | **repeats — cap risk** |
| Consecrate+ | Healed | self | DEF/WIS +15 | DEF/WIS ▲ | **repeats — cap risk** |
| Constrict | DamageDealt (source) | trigger target | SPD -10 | SPD ▼ | **repeats — cap risk** |
| Crescendo | DamageDealt (source) | self | INT +10 | INT ▲ | **repeats — cap risk** |
| Curl | DamageDealt | self | DEF +5 | DEF ▲ | **repeats — cap risk** |
| Curl+ | DamageDealt | self | DEF +10 | DEF ▲ | **repeats — cap risk** |
| Death Wail | DamageDealt (source) | activeEnemies | ATK/INT -5 | ATK/INT ▼ | **repeats — cap risk** |
| Death Wail+ | DamageDealt (source) | activeEnemies | ATK/INT -10 | ATK/INT ▼ | **repeats — cap risk** |
| Deep Breath | Rested | self | INT/WIS +20 | INT/WIS ▲▲ | **repeats — cap risk** |
| Desert Body | DamageDealt (source) | self | DEF +10 | DEF ▲ | **repeats — cap risk** |
| Drag | DamageDealt (source) | trigger target | SPD -10 | SPD ▼ | **repeats — cap risk** |
| Drag | DamageDealt (source) | self | SPD +10 | SPD ▲ | **repeats — cap risk** |
| Drag+ | DamageDealt (source) | trigger target | SPD -20 | SPD ▼▼ | **repeats — cap risk** |
| Drag+ | DamageDealt (source) | self | SPD +20 | SPD ▲▲ | **repeats — cap risk** |
| Eldest Face | DamageDealt (source) | self | INT +10 | INT ▲ | **repeats — cap risk** |
| Enthrall | RoundEnded | activeEnemies | WIS -10 | WIS ▼ | **repeats — cap risk** |
| Feast+ | DamageDealt (source) | self | ATK +20 | ATK ▲▲ | **repeats — cap risk** |
| Frenzy | DamageDealt (source) | self | ATK/INT +5 | ATK/INT ▲ | **repeats — cap risk** |
| Gallop | DamageDealt (source) | self | SPD +10 | SPD ▲ | **repeats — cap risk** |
| Gathering Weight | MoveUsed | self | DEF +10 | DEF ▲ | **repeats — cap risk** |
| Gilded String | MoveUsed | ally | ATK/INT +15 | ATK/INT ▲ | **repeats — cap risk** |
| Glitter | RoundEnded | ally | SPD +10 | SPD ▲ | **repeats — cap risk** |
| Heartwood | StatusTicked | self | ATK/DEF +10 | ATK/DEF ▲ | **repeats — cap risk** |
| Held Under | DamageDealt (source) | trigger target | DEF/SPD -10 | DEF/SPD ▼ | **repeats — cap risk** |
| High Noon | DamageDealt (source) | self | SPD +10 | SPD ▲ | **repeats — cap risk** |
| Hubris | StatChanged | triggerSubject | DEF/WIS -15 | DEF/WIS ▼ | **repeats — cap risk** |
| Imposing Presence | SwitchedIn | activeEnemies | ATK -10 | ATK ▼ |  |
| Induction | StatusDetonated | self | INT +15 | INT ▲ | **repeats — cap risk** |
| Ink | SwitchedOut | activeEnemies | ATK/INT -10 | ATK/INT ▼ |  |
| Ink Cloud | SwitchedIn | activeEnemies | INT/SPD -10 | INT/SPD ▼ |  |
| Ink+ | SwitchedOut | activeEnemies | ATK/INT -25 | ATK/INT ▼▼ |  |
| Inscribe | DamageDealt (source) | trigger target | WIS -5 | WIS ▼ | **repeats — cap risk** |
| Inscribe+ | DamageDealt (source) | trigger target | WIS -10 | WIS ▼ | **repeats — cap risk** |
| Ironbound+ | RoundEnded | self | ATK/DEF +10 | ATK/DEF ▲ | **repeats — cap risk** |
| Killing Frost | StatusApplied (source) | self | INT +20 | INT ▲▲ | **repeats — cap risk** |
| Kindling | DamageDealt (source) | self | ATK/INT +10 | ATK/INT ▲ | **repeats — cap risk** |
| Kindling+ | DamageDealt (source) | self | ATK/INT +20 | ATK/INT ▲▲ | **repeats — cap risk** |
| Lodestone+ | SwitchedIn | activeEnemies | DEF -15 | DEF ▼ |  |
| Lullaby | RoundEnded | activeEnemies | SPD -5 | SPD ▼ | **repeats — cap risk** |
| Lullaby+ | RoundEnded | activeEnemies | SPD -15 | SPD ▼ | **repeats — cap risk** |
| Matriarch's Fury | DamageDealt | self | ATK +10 | ATK ▲ | **repeats — cap risk** |
| Matriarch's Fury | DamageDealt | ally | ATK +10 | ATK ▲ | **repeats — cap risk** |
| Mirage | DamageDealt | activeEnemies | ATK/INT -10 | ATK/INT ▼ | **repeats — cap risk** |
| Nettle | DamageDealt (source) | trigger target | ATK -5 | ATK ▼ | **repeats — cap risk** |
| Nettle+ | DamageDealt (source) | trigger target | ATK -10 | ATK ▼ | **repeats — cap risk** |
| Neuroplastic | StatChanged | self | WIS derived | ? | derived — decide by hand |
| Neuroplastic+ | StatChanged | self | WIS/ATK/INT derived | ? | derived — decide by hand |
| Outpace | RoundEnded | self | INT +20 | INT ▲▲ | **repeats — cap risk** |
| Outpace+ | RoundEnded | self | INT +40 | INT ▲▲▲ | **repeats — cap risk** |
| Owl's Gaze | DamageDealt (source) | trigger target | WIS -10 | WIS ▼ | **repeats — cap risk** |
| Pack Hunter | DamageDealt (source) | self | ATK/INT +5 | ATK/INT ▲ | **repeats — cap risk** |
| Pack Hunter+ | DamageDealt (source) | self | ATK/INT +10 | ATK/INT ▲ | **repeats — cap risk** |
| Pack Hunter+ | DamageDealt (source) | ally | ATK +10 | ATK ▲ | **repeats — cap risk** |
| Petal Storm | DamageDealt (source) | trigger target | WIS -10 | WIS ▼ | **repeats — cap risk** |
| Puppet Strings | StatChanged | self | INT +10 | INT ▲ | **repeats — cap risk** |
| Quickening | SwitchedIn | self | SPD +10 | SPD ▲ |  |
| Rallying Standard | SwitchedIn | ally | ATK/INT +10 | ATK/INT ▲ |  |
| Rallying Standard+ | SwitchedIn | ally | ATK/INT +25 | ATK/INT ▲▲ |  |
| Rampant | DamageDealt | self | ATK +10 | ATK ▲ | **repeats — cap risk** |
| Ready Stance | SwitchedIn | self | ATK +15 | ATK ▲ |  |
| Recitation | DamageDealt (source) | activeEnemies | WIS -5 | WIS ▼ | **repeats — cap risk** |
| Reverberation | Healed (source) | activeEnemies | SPD -10 | SPD ▼ | **repeats — cap risk** |
| Rivet | RoundEnded | ally | DEF +5 | DEF ▲ | **repeats — cap risk** |
| Rivet+ | RoundEnded | ally | DEF +15 | DEF ▲ | **repeats — cap risk** |
| Rolling Snow | DamageDealt (source) | self | ATK/SPD +20 | ATK/SPD ▲▲ | **repeats — cap risk** |
| Runaway Pressure | DamageDealt (source) | self | ATK +10 | ATK ▲ | **repeats — cap risk** |
| Sanguine+ | StatusTicked | self | ATK +10 | ATK ▲ | **repeats — cap risk** |
| Second Skin | DamageDealt | self | DEF/WIS +5 | DEF/WIS ▲ | **repeats — cap risk** |
| Serpent's Eye | SwitchedIn | activeEnemies | INT -10 | INT ▼ |  |
| Serpent's Eye+ | SwitchedIn | activeEnemies | INT/ATK -20 | INT/ATK ▼▼ |  |
| Settling Stone | RoundEnded | self | DEF +10 | DEF ▲ | **repeats — cap risk** |
| Shared Dish | Healed | ally | ATK/INT +10 | ATK/INT ▲ | **repeats — cap risk** |
| Shared Dish | StatusTicked | ally | ATK/INT +10 | ATK/INT ▲ | **repeats — cap risk** |
| Shieldbearer | SwitchedIn | ally | DEF/WIS +20 | DEF/WIS ▲▲ |  |
| Sinking Sands | SwitchedOut | activeEnemies | DEF -10 | DEF ▼ |  |
| Snare | SwitchedIn | activeEnemies | SPD -20 | SPD ▼▼ |  |
| Spirit Pack | RoundEnded | ally | ATK/SPD +10 | ATK/SPD ▲ | **repeats — cap risk** |
| Spore Ring | StatusApplied (source) | trigger target | ATK/INT +10 | ATK/INT ▲ | **repeats — cap risk** |
| Squall Line | DamageDealt (source) | self | ATK/SPD +5 | ATK/SPD ▲ | **repeats — cap risk** |
| Stalwart | SwitchedIn | self | DEF/WIS +10 | DEF/WIS ▲ |  |
| Stampede | RoundEnded | self | SPD derived | ? | derived — decide by hand |
| Stampede+ | RoundEnded | self | SPD derived | ? | derived — decide by hand |
| Stoke | StatusTicked | self | INT +10 | INT ▲ | **repeats — cap risk** |
| Stoke+ | StatusTicked | self | INT +20 | INT ▲▲ | **repeats — cap risk** |
| Sunblind | StatusApplied (source) | trigger target | WIS -20 | WIS ▼▼ | **repeats — cap risk** |
| Sunder | DamageDealt (source) | trigger target | DEF -10 | DEF ▼ | **repeats — cap risk** |
| Surging Intellect | ManaGained | self | INT derived | ? | derived — decide by hand |
| Surging Intellect+ | ManaGained | self | INT derived | ? | derived — decide by hand |
| Swell | DamageDealt (source) | self | INT +10 | INT ▲ | **repeats — cap risk** |
| Swell | DamageDealt (source) | self | ATK +10 | ATK ▲ | **repeats — cap risk** |
| Tally | MoveUsed | self | INT +5 | INT ▲ | **repeats — cap risk** |
| Tally+ | MoveUsed | self | INT +10 | INT ▲ | **repeats — cap risk** |
| Tempering | DamageDealt | self | DEF +10 | DEF ▲ | **repeats — cap risk** |
| Thornrot | StatusApplied (source) | self | ATK/SPD +10 | ATK/SPD ▲ | **repeats — cap risk** |
| Troop Leader | MoveUsed | ally | ATK/SPD +10 | ATK/SPD ▲ | **repeats — cap risk** |
| Tyrant's Due | DamageDealt (source) | self | ATK +10 | ATK ▲ | once a fight; permanent |
| Tyrant's Due+ | DamageDealt (source) | self | ATK +10 | ATK ▲ | permanent; **repeats — cap risk** |
| Unbothered | DamageDealt (source) | triggerSubject | ATK/INT -5 | ATK/INT ▼ | **repeats — cap risk** |
| Unbothered+ | DamageDealt (source) | triggerSubject | ATK/INT -10 | ATK/INT ▼ | **repeats — cap risk** |
| Undermine | DamageDealt (source) | trigger target | DEF -10 | DEF ▼ | **repeats — cap risk** |
| Undermine+ | DamageDealt (source) | trigger target | DEF -20 | DEF ▼▼ | **repeats — cap risk** |
| Unfurl | StatusApplied | self | INT +10 | INT ▲ | **repeats — cap risk** |
| Unfurl+ | StatusApplied | self | INT +20 | INT ▲▲ | **repeats — cap risk** |
| Vengeful Emblem | DamageDealt | self | ATK +10 | ATK ▲ | **repeats — cap risk** |
| Vengeful Emblem+ | DamageDealt | self | ATK +25 | ATK ▲▲ | **repeats — cap risk** |
| Well Fed | StatusApplied | self | ATK +10 | ATK ▲ | **repeats — cap risk** |
