# guild-hall-overhaul.md — No Guild Hall, no gold, recruits off the map

> **STATUS: DECIDED 2026-11-11 (per user direction); PHASES 1–2 IN (same day).** The shape is
> decided; every number marked *first pass* is a placeholder for playtest. §7 lists the invariants
> it reverses; §8 and §9 record what phases 1 and 2 built and measured.

---

## 0. Why this exists

The Guild Hall is the last homework in a run. A forced visit every act opens three counters —
Tavern, Gems, Gear — each showing the whole roster, each pricing in a currency spent nowhere else,
so a visit is a dozen small purchases and a budget held in the head. Its mend also undercuts the
act: Wounds are meant to cost the rest of the act, and a whole roster stood up for a few dozen gold
before the Guardian makes them cost almost nothing.

Gold exists only to be spent there. It is earned on fight bands and a purse node, and it buys
contracts, the Tavern's call, the mend, shelf Gems, shelf gear and one event. Take the Hall away and
gold has nothing left to do; the purse, the map's least interesting reward, goes with it.

Recruiting after a fight goes too. With the Hall gone the claim screen would be the only way in,
one a run's fork, free while a seat is empty — always taken, never a decision, and too slow to fill
a roster that fields every hero. A recruit becomes a **map node** priced against the tiles beside
it, and the decision on it is a **type**, not a hero sheet.

---

## 1. Gold is deleted

Nothing in a run is priced in gold, and nothing pays it.

| Goes | Where it lived |
|---|---|
| Fight gold bands and the act scale | `GOLD_REWARD_RANGE`, `ACT_GOLD_SCALE`, `goldRangeFor` (`run/runProgress.ts`) |
| The purse node | `currencyReward`, weight 20 (`run/map.ts`) — its weight returns to the pool |
| Sell on the who-screen | `sellItem`, `sellValueFor` — the decline becomes a plain **Leave it**; a drop nobody can receive is lost |
| `RunState.gold` | `run/state.ts`; old saves drop the field on load |
| `goldStatGrants` | dead vocabulary since Gilded Mane stopped reading gold (2026-10-12) |
| Event gold costs | "Pay the captain" (20g) and any `cost.gold` — re-costed as `woundAll` or a lost node |

Stardust is meta currency and untouched.

---

## 2. Recruiting is a map node

**Nothing recruits after a fight.** The claim screen, Recruit Contracts, the contract node, the
Elite's contract drop and the Tavern are deleted. A hero joins at the **Recruit** node (name
*first pass*), a tile in the pick-1-of-3 reward rows.

### 2.1 The pick is a type

The node shows **three types**. The player picks one, and the game rolls a hero of that type from
the player's **deck**. Each type tile shows the heroes it could roll, dimmed, so the gamble can be
read before it is taken — the deck the player built is what bounds it.

- **At least one of the three is a type of the act's Location** (`spawnTypes`); the rest are drawn
  from every type with a hero available. If the Location's types have nobody left, all three fall
  back to any available type.
- **No duplicates.** A hero on the roster, or terminated this run, is never rolled. A type with
  nobody left is never shown.
- **A full roster still gets the node.** The pick becomes a swap: the termination screen follows the
  roll, and the dismissed hero's gear is handed on through the who-screen as it is today.

### 2.2 What arrives: raw, at par, scaled by act

The precedent is the Guild hire, moved up to the player's par:

- **Level:** the player's par entering the node.
- **Mastery:** `masteryForAct − 1` pips, the hire figure (`2N−3`: 0 / 1 / 3 / 5 by act), each filled
  by fit off the hero's best grades as an un-Gemmed pip is today. *First pass* — the enemy figure
  `2N−2` is the alternative if late recruits read too thin.
- **Moves:** filled to `MOVE_CAP` from the schedule entries its level reached that would land as
  receipts (`withReceipts`); an entry that would ask stays owed, worked off one a fight.
- **Evolution:** never pre-chosen. A recruit at 5 pips raises its Evolution screen on arrival, so
  the player picks the path — that is what raw means late in a run.
- **Gear:** none. Sockets fill from the map like anyone's.

### 2.3 Supply

The node takes the contract node's seat in the reward pool at a weight that shows it about twice an
act (*first pass*: 24 → 40, to be read off the sim's row counts). It is **guaranteed in Act 1's
first reward row**, the way the opener guarantees an item, because a two-hero draft that waits on
the dice for a third is the thin-roster problem this replaces. Act 2's first row is the next
candidate for a guarantee if the roster still reads thin in play.

The event `recruit` outcome stays: a rarer third way in, priced by the event.

---

## 3. The Camp replaces the Guild Hall

The funnel row before the Guardian becomes **the Camp** (name *first pass*): one forced row, dressed
as the last stop before the gate, with **three fixed doors — pick one.** The reference is Slay the
Spire's campfire: rest or upgrade, never both.

| Door | What it is | Reuses |
|---|---|---|
| **Mend** | The whole roster made whole, the downed stood up | `restReward`'s screen |
| **Gems** | A Gem Cache, sized by act (*first pass*: the Cache's 4) | the Gem Cache screen |
| **Gear** | Pick one piece of three on the act's standard curve, then its who-screen | `equipmentReward` |

The mend is no longer bought; it costs the Gems or the Gear the roster would have taken into the
Guardian. The act's end still mends everyone for free — the Camp heals *into* the Guardian, the act
end heals *after* it.

**Watch:** Rest also sits in the reward pool at weight 30. With one guaranteed at every gate it may
read as the safe pick twice an act; cut its weight if it does.

---

## 4. The Elite: a previewed puzzle

With no recruit on the fork, the Skirmish is the road that costs fewer Wounds and the Elite the one
that pays more. The Elite earns its danger by being a *different* fight, read before it is chosen —
the reference is the Hades elite, the same enemy with a named perk.

### 4.1 Affixes

The Elite's side carries **one affix in Acts 1–2, two in Acts 3–4**, rolled with the fork's seeded
draw and shown on the tile's tap card. **An affix is a passive** granted to the enemy side
(`teamPassiveGrants`), so it is data in the existing vocabulary, never bespoke logic. First-pass
slate:

| Affix | Verb |
|---|---|
| **Warded** | opens the fight with a Shield on its leads |
| **Vengeful** | an ally falling raises the survivors a stage |
| **Swift** | +1 priority in the first round |
| **Marked** | the Titan's Mark the Titanspawn carry (`titansMarkFor`) |

The slate is open; any enemy-side passive that reads at a glance on a tap card is a candidate.

### 4.2 Its own field

Every Elite **opens with a field effect up** — Blood Moon, Downpour, Bedrock, Scorched Land and the
rest — drawn from fields whose type the Elite fields, any field if none, and shown on the same tap
card. **Open for the build:** a field set at fight start for its five rounds needs a small engine
hook (`buildCombatState` opens on `activeFieldEffect: null`); the existing alternative is a Herald
passive on the Elite's lead, which re-sets the field on every switch-in and is the stronger of the
two.

### 4.3 Its reward

The Elite keeps ×1.5 XP, its guaranteed item a tier ahead and its 2 Gems, and **adds a Boon pick on
a win** — the `passiveReward` screen, 1 of 3 then a hero, at the end of its post-fight chain. It
faced a passive; it pays one.

---

## 5. Build phases

1. **Recruit node.** The node, its type pick and roll, the arrival in §2.2, the Act 1 guarantee.
   Delete the claim screen, contracts, the contract node, the Elite drop and the
   recruitable-fight deck rule (§7).
2. **The Camp.** Replace the `shop` row with the three doors. Delete the Guild Hall, its counters,
   the mend price and the Tavern.
3. **Gold out.** Everything in §1, with save migration and the event re-costs.
4. **The Elite.** Affixes, the opening field, the Boon pick.
5. **Sim pass for faults.** Teach the pilot the Recruit node and the Camp's doors, then look for
   stranded states — a run that never reaches a third hero, a Recruit node with nobody to roll —
   and read the row counts for §2.3's weight. Win rates are directional; the balance call is made
   by playing.

---

## 6. Open, for playtest

- The Recruit node's weight and its guaranteed points (§2.3).
- Recruit Mastery: `2N−3` against `2N−2` (§2.2).
- The Camp's Gem count and Gear rarity (§3); Rest's pool weight beside it.
- The affix slate and its counts; opening field against a Herald (§4).
- The Skirmish: whether fewer Wounds is reason enough to take it, once the Elite is a puzzle.

---

## 7. What it reverses

Each per user direction, 2026-11-11:

- **The funnel is one forced Guild Hall every act** (CLAUDE.md, run structure; `run-loop.md` §1) —
  it is the Camp, one door of three.
- **The Guild Hall's three counters** — Tavern, Gems, Gear — and the Gem shelf as a Gem source
  (`gems.md`).
- **Recruitment: a contract hero arrives FINISHED, a Guild hire arrives RAW** — one route, raw at
  par, scaled by act. A recruit is never the enemy you beat, and never arrives armed
  (`gear-absorption.md` §7).
- **One Recruit Contract currency for both routes** (`run-loop.md` "Contracts") — no contracts.
- **A recruitable fight fields at least two deck heroes** (`collection.md`) — no fight is
  recruitable; enemy parties draw freely.
- **The Elite's 50% contract drop.**
- **The Guild Hall's mend as a Wounds faucet** (`run-loop.md` "Wounds") — the Camp's Mend door, the
  Rest seat and the act's end are the three.
- **Gold**, everywhere it is named, and the `currencyReward` purse.

---

## 8. Phase 1, built (2026-11-11)

The Recruit node is `recruitReward` (`src/run/recruitNode.ts`, `RecruitNodeScreen`), weight 40, and
Act 1's first reward row always holds one. A map saved with the Contract node reads it as a Recruit;
a save sitting on a claim or a Tavern swap walks on past it.

Deleted: the post-fight claim screen, Recruit Contracts and their price, the Contract node, the
Elite's contract drop, the Tavern's hires and its call, the deck floor on a hero fight (enemy parties
now draw from the deck and strangers together), `guildRecruit.ts` and `data/recruitment.ts`. The
Tavern keeps its meal until phase 2 deletes the Hall. A dismissed hero is recorded on
`RunState.departedHeroIds`, and the Recruit never rolls one again.

Decided in the build, each the existing precedent, **open for review**:

- **The Evolution of a recruit at 5 pips** is raised on the Recruit screen the moment it joins, as
  §2.2 says (settled same day, per user direction), with the path's move offered as replace-or-decline
  at a full kit. A reload before the path is chosen falls back to the next level-up report.
- **The pick is a wheel** (same day, per user direction, chosen from three concepts): the oath's
  sigil ring split into the types on offer, the heroes who could answer circling it, dimmed. The
  picked arc turns to the top, its heroes are drawn in and spin, and the spin slows on the one
  already rolled (`RecruitWheel`); the oath follows, listing the innate and any Evolution path
  passives beside the kit.
- **The Gathering (Cycle IV)** lost its player-side help with the Tavern: one more hire a visit. It
  is carried over as **one more type at every Recruit** (`GATHERING_EXTRA_RECRUIT_TYPES`).
- **First Light's Contracts lesson** is now *Recruits* on the new screen: three types, the hand on
  Nature, Hollowbark answers. Its scenario id stays `firstLight.contracts`, so a lit star stays lit.
- **The Recruit's tile and art** reuse the old Contract's quill until it has its own.
- **At a full roster** the arriving hero is named in the title but has no card to inspect before
  someone is dismissed — the event recruit's gap too.

**Measured (sim, 200 runs, seed 1, faults only):** no crash or stranded run. The sim walks reward
rows at random, so it took 1.09 recruits a run against ~2.9 under contracts, and the Recruit showed
the largest node lift in the batch (+1.05, z 3.5). A player who plans takes it far more often; the
weight in §2.3 is the dial, and the call is made by playing.

---

## 9. Phase 2, built (2026-11-11)

The funnel is the `camp` node (`src/run/camp.ts`, `CampNodeScreen`), drawn on the map as a tent
and fire (`art/map-nodes/landmarks/camp.png`). Its screen is the Rest's scene in firelight: the
company round the fire with every bar where the act left it, three doors under it, one chosen and
then committed.

- **Mend** plays on the Camp's own figures, the Rest's beat, and leaves only Continue. It is shut
  while nobody is hurt.
- **Gems** opens the Gem screen with `CAMP_GEMS` = the Cache's count, **3**, not the 4 this doc's
  §3 named: the Cache holds 3 now. Shut while every hero is mastered.
- **Gear** opens `CampGearScreen`: three pieces on the act's standard curve, one taken, then its
  who-screen.

Deleted: the Guild Hall screen, its three counters and its tab memory, the shelf Gems
(`rollShelfGems`, their price and purchase), the shelf gear and its price, the priced mend
(`mendPrice`, `buyMend`), the Guild Hall How to Play scenes, and the Guild Hall's map art. A map
saved with a `shop` node reads it as a Camp; a run saved inside the Hall opens on the Camp; a shelf
Gem still being placed lands as the Camp's would. Gold, the purse and Sell stay until phase 3.

**Left for later:** the Guild Hall's CSS in `styles.css` and the unused `art/guild` pieces, the
Location `hall` backdrops, and Rest's pool weight beside a guaranteed Mend (§3 "Watch").

**Measured (sim, 200 runs, seed 1, faults only):** no crash, stall or stranded run. The pilot takes
the Mend when the roster is under 60% or anyone is down, the Gems while anyone can take one, else
the Gear: Mend 39 / 52 / 57 / 53% of visits by act, the Gear only once the roster is mastered. Win
rates are directional; the call is made by playing.
