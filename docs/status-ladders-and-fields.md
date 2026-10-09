# Status ladders and three new fields

> **§1 (Burn's levels) and §2 (Renew's count) are SUPERSEDED by `docs/timed-statuses.md`**
> (2026-10-09): both are now timed — on or off, three rounds, no number. §3–5 (the fields) stand,
> except that Scorched Land now stops Burn fading instead of raising its level.

Decided and built 2026-10-06, per user direction. It replaces Burn's halving percent and Renew's
Wisdom-scaled percent with numbers a player can read off the badge, and adds three Field Effects
that bend a rule instead of adding a bonus. It supersedes `blessings-and-statuses.md` §3–5 wherever
they disagree.

**Why.** Burn and Renew carried authored percents that landed anywhere: 2, 3, 4, 5, 6, 7, 8, 10,
13, 15, 17, 20, 30 and 38 on Burn sources alone. Numbers like 8 or 14 read as arbitrary in a game
whose other statuses are a flag (Bleed 5%, Daze) or a short clock (Poison 3). Each status now has one
job and a small integer:

| Status | The number means | Job |
|---|---|---|
| Bleed | nothing — a flag | set and forget, 5% a round, survives switching |
| Poison | the burst's size, on a 3-round fuse | stacks and bursts |
| **Burn** | **a level, 1 to 3** | **a ladder you climb, and one action resets** |
| **Renew** | **heals left** | **a steady tenth a round, as long as the count** |

---

## 1. Burn: three levels

| Level | Name | End of round |
|---|---|---|
| 1 | Burning | 5% of max HP |
| 2 | Badly Burned | 10% |
| 3 | Engulfed | 25% |

- **Each application climbs its magnitude in levels**, held at Engulfed (`StatusDefinition.levels`,
  stacking `additive`, `StatusApplied.capped` at the top). A Burn authored bare is one level.
- **Nothing decays it.** It ends when the holder **Rests** (`clearsOnRest`, `StatusRemoved 'rest'`),
  is **Cleansed**, or **switches out**. Switching still clears it, so level 1 is not Bleed.
- **The cliff is the design.** At 1–2 you can play through it; at Engulfed you are dead in four rounds,
  so it asks for an answer. Resting skips the turn — strong tempo for the side that Burned you.
- **Never caster-scaled** (`fixedMagnitude`), as before.
- **The Rest key opens at full mana** while the acting hero holds anything a Rest puts out
  (`FightScreen` `actingCanRest`). The out-of-mana Rest row was never gated.
- **The AI and the sim's pilot Rest when Engulfed** (`atTopOfRestableLadder`, `run/ai.ts`). Without it
  Engulfed was a free quarter a round against an enemy that never switches.
- **Scorched Land: every Burn lands one level higher** (`FieldEffectDefinition.raisesStatusLevel`),
  replacing its retain-¾ decay. Self-Burns climb it too: a Mech self-Burner pays more under its own field.

### Conversion

Every authored percent became levels by one rule — **≤10% → 1, 13–20% → 2, ≥30% → 3** — on moves and
signatures, self-Burns included (Steam Vent, Backfire, Boiler Blow 1; Overheat, Volcanic Surge,
Meltdown 2). Spark Burst and Perfect Creation Engulf outright. Set Alight (Early, 20 mana) lands two
levels: two casts Engulf.

**Passive Burns are capped.** Under "keep the higher" a small passive Burn repeated did nothing; on a
ladder every proc climbs. So a passive that fires often sets **Burning and no higher**
(`maxMagnitude: 1`) and its mastered card climbs **up to Badly Burned** (`maxMagnitude: 2` — the
mastered-innate "at least doubled" read off the cap): Cinderguard, Sulphur / Sulphur+, Boiler /
Boiler+, Foxfire / Foxfire+, Fire-Breather / Fire-Breather+, Kindled Mane, Brushfire. The rare,
build-around procs climb freely: Rekindle 1, Ignition 1, Pyre 1, Funeral Pyre 2.

## 2. Renew: the number is the heals

- **Renew N is N heals of 10% of the holder's max HP**, the first the moment it lands, then one at
  each round end (`StatusDefinition.charges`). The badge counts down. Renew 3 is 30%, no arithmetic.
- **A second Renew adds its count.** Renew 1 heals once on landing and is never held.
- **Unscaled.** It no longer reads the caster's Wisdom or STAB. Heal moves keep the healing formula;
  this is Renew's named exception in CLAUDE.md, simplified.
- **Verdant Earth unchanged:** each heal ×2, overheal to Shield.
- Persists through switching and Cleanse, and ticks on the bench, as before.

### Conversion

**N = round(3 × old percent ÷ 10), at least 1** — the old three heals' total, at par, in tenths:
Sow, Refresh, Regrowth 3; Second Wind 4; High Tide, Greenwood 5; Wild Bloom 6; **Overgrowth 10**
(the Elder Bough's big self-plant — the outlier); signatures 2–3. Passives that fire often take 1
(Grief, Bloodmeal, Bitter Brew, Restorative Toxin — now one heal per Poison applied); entry and
kill triggers 2–3; Hallowed Step 2 → 4 mastered; Warm Spring 1 a round, held to 2.

**What it cost:** the Wisdom and STAB a real healer used to add, roughly a third of its Renew at
par. Nothing paid it back.

---

## 3. Blood Moon (Beast)

> **Bleeding heroes can't be healed, and a hit on a Bleeding hero heals the attacker a quarter of the
> damage dealt.**

- `blocksHealingWhile: 'Bleed'` refuses every heal: a heal move (`Healed.blocked`, amount 0), a Renew
  tick (the charge is still spent), a drain, a passive heal (`healBlocked`, `statusEngine.ts`). **A
  potion still works** — it is player-only, so blocking it would only ever bite the player.
- `lifestealAgainst: { Bleed, 0.25 }` rides the drain path: a hit's HP removed × 25% to the striker,
  added to any `drainPercent` the move carries, one `Healed` with `drain`. A Bleeding attacker feeds
  on nothing — the race is to Bleed the other side first.
- Counters both healing fields at once, and gives the physical, no-mana attacker a field.

## 4. Downpour (Water)

> **Water and Frost attacks are never resisted — they always hit for at least ×1.**

`unresistedTypes`, read as a floor on the chart term (`fieldTypeMultFloor`, `calcDamage`). A
super-effective hit is untouched; only resistances lift. The AI's matchup read and the pilot's
forecast take the same floor.

## 5. Bedrock (Stone)

> **Physical attacks hit with the higher of the attacker's Attack and Defense.**

`physicalSwingsWithDefense`, read in `resolveStatRatio`: which stat feeds the numerator, never a
multiplier — stat pipeline, locked math intact. A move with its own `offStatOverride` (Body Blow) keeps
it. Magical hits untouched. `DamageDealt.offStat` reports the stat actually read. Every Defense buff
(Iron Skin, Rampart, the ×4 ceiling) becomes offense; Shield already scales off Defense.

## 6. The three routes, on day one

| Field | Herald (Boon) | Early rider | Mid reader (×2 under it) |
|---|---|---|---|
| Blood Moon | Herald of the Hunt | **Gash** — Beast, physical 35, Bleed, 25 mana | **Blood Frenzy** — physical 50, 35 mana |
| Downpour | Herald of Rain | **Rainfall** — Water, Cleanse one ally, 20 mana | **Drench** — magical 50, 35 mana |
| Bedrock | Herald of Stone | **Dig In** — Stone, Shield 30 self, 20 mana | **Tectonic Slam** — physical 50, 35 mana |

Riders are priced as their payload (Claw, Purify, Iron Skin); readers as Verdant Lash. Both sit in
every hero pool of the field's type (six each), and the rider is in that type's Early Titanspawn kit
(it replaced Refresh, Tremor and Prowl, kits being pinned at three), so the enemy sets these fields
too. The six moves sit last in `moves.ts` on purpose: derived graft lines and spawn slates read the
catalog in file order, and appending kept every existing line as it was.

---

## 7. Open — to watch in play

- **Engulfed on a boss.** 25% of the target's max HP hits the Eyes (HP ×1.5) hardest; two Fire heroes
  can Engulf in round two. The AI Rests it off, losing a turn each time. A Guardian cap at Badly Burned
  is the lever if it reads as a cheese.
- **Burn readers that fire every tick** — Ashfeast (heal the tick), Stoke (+Int a tick), Witch's Brew
  (Poison a tick) — were bounded by halving and now last until a Rest. `maxFiresPerFight` is the lever
  (`feedback_force_limit_procs_not_cap`), not a Burn cap.
- **Set Alight** at two levels for 20 mana is the cheapest Engulf; one level is the fallback.
- **Overgrowth 10** heals for ten rounds; a cap at 6–8 if it reads as too long.
- **Renew lost its Wisdom scaling** — the Nature/Water/Light healers are the ones to watch.
- **Art:** the three fields have no icon yet (`fieldEffectIconArt` is Partial; the badge falls back).
- **Not measured.** No sim pass was run.

## 8. Invariants this reverses

- CLAUDE.md "Status magnitude formula": Burn's percent-of-max-HP and keep-the-higher → **levels**.
- CLAUDE.md "Healing formula", Renew's named exception: a Wisdom-scaled percent → **an unscaled count
  of 10% heals**.
- `blessings-and-statuses.md` §3.4 (keep the higher), §4 (Renew's shape), §5 (Scorched Land's ¾).
- `field-effects.md` "Scorched Land" (decay) → a level higher.
