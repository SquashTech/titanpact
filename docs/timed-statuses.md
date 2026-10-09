# Timed statuses: Burn and Renew

Decided and built 2026-10-09, per user direction. It replaces Burn's three-level ladder and
Renew's count of heals (`docs/status-ladders-and-fields.md` §1–2, both superseded).

**Why.** The ladder and the count both put a number on the badge that read wrong in play:
"Renew 2" is an odd thing to hand out, and a Burn that only came down when the holder Rested
asked the player to track a level. Both are now **on or off, for a fixed number of rounds**, with
the rounds drawn as pips beside the badge (Poison's timer display). No number is authored on
either: every Burn is the same Burn, every Renew the same Renew.

## 1. The shape — `StatusDefinition.timed`

`timed: { tickPercents }` — the status lasts `tickPercents.length` rounds; its k-th round end
deals (`dot`) or heals (`hot`) `tickPercents[k]`% of the HOLDER's max HP, then it is gone
(`StatusRemoved 'expired'`). The instance holds `duration`, the rounds left. **Every application
lands it whole and puts it back to its first round** — a re-application is a reset, never a stack.
Never caster-scaled (`fixedMagnitude`), never on the Shield (a tick, not a hit).

| Status | Rounds | Ticks | Total | Ends early |
| --- | --- | --- | --- | --- |
| **Burn** | 3 | **15% → 8% → 4%** | 27% | Rest, Cleanse, switching |
| **Renew** | 3 | **10% · 10% · 10%** | 30% | never (positive, survives switching) |
| **Bleed** (for comparison, unchanged shape) | until cleansed | **6%** a round (was 5%) | — | Cleanse only |

- **Burn fades.** The first tick lands the round it is applied, so it is nearly guaranteed; the
  last two are what a Rest or a switch can dodge. **A fresh Burn re-lights it at 15%** (per user
  direction — a no-op re-Burn was weighed and set aside), so a Fire hero who keeps the fire fed
  holds a target at 15% a round, at the cost of the turn.
- **Bleed is the opposite shape**: slow, sticky, no switch answer; it passes Burn's total at
  round five.
- **Renew heals nothing on landing** — a cast resolves before the round ends, so its first heal
  still comes that round. A second Renew sets it back to three; it never adds.

## 2. Scorched Land: Burn doesn't fade

`FieldEffectDefinition.holdsTimedStatusAtFirst: ['Burn']` — while the field holds, every Burn
tick is its first round's 15% (15 / 15 / 15). It replaced "every Burn lands a level higher".

## 3. What the data lost, and what paid for it

- Every `magnitude` and `maxMagnitude` on a Burn or Renew application is gone (moves,
  signatures, passives, Evolution passives). A move authored "Burn 3" is now plain Burn; its
  base power was not re-priced. To revisit move by move.
- **The big Renews took an up-front heal for the difference** (each was N heals of 10%; Renew is
  now three): High Tide (was 5) and Greenwood (5) heal 30, Wild Bloom (6) 40, Full Bloom (8)
  55, Overgrowth (10) 70 — all now `kind: 'heal'` with the Renew as a rider. **Second Wind**
  (Renew 4) stays a plain Renew: Spirit's slate authors no heal move. **Hallowed Step+'s**
  Renew 4 lost its step over Hallowed Step's 2, so the mastered card now Renews the hero itself
  as well as its partner; **Foxfire+** (Burn up to Badly Burned) now Burns both active enemies.
- **Top Billing** (+15% a Burn level) is +30% against a Burning foe.
- Passive Burns lost their level caps; with nothing to climb, a cap means nothing.

## 4. What to watch (design rework expected, per user direction)

- **Self-Burn as a cost** — Steam Vent, Backfire, Boiler Blow, Overheat, Volcanic Surge,
  Meltdown and the rest were priced at 5% a round until a switch; they now cost 15% up front
  and 27% if ridden out.
- **Passives that re-Burn or re-Renew often** (on every hit, at every round end — e.g. the Beast
  path card that Renews the partner each round) are now permanent 15%-a-round / 10%-a-round
  effects. Re-lighting at 15% is the decided rule; these cards are what it bites.
- **Renew readers** (Seed Shot, Branch Slam's doubler, Verdant Earth's ×2 and Shield overflow)
  read a yes/no now, which is what they always meant.
- **The AI Rests off a Burn only when what is left of it would knock the hero out**
  (`restOutlastsBurn`, `src/run/ai.ts`); the pilot reads the same.
