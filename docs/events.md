# Map Events

The `event` map node (docs/run-loop.md §2), authored 2026-08-31 after standing as a
deliberately empty placeholder since the map was built.

- **Content:** `src/data/events.ts` (`runEvents`, `RunEventDefinition`)
- **Mechanism:** `src/run/events.ts` (selection + resolution, pure `RunState` transforms)
- **Presentation:** `src/view/run/EventNodeScreen.tsx`
- **Engine:** `PassiveHook 'SwitchedIn'` and `PassiveEffectTarget 'activeEnemies'`
  (`src/engine/content.ts`, `src/engine/combat/passiveEngine.ts`) — added for the first
  event-granted passive, §4.

---

## 1. What an event is

An event is a map node that hands over something the rest of the map cannot: a **move**,
a **passive**, a **stat trade**, or **loot**. Everything about it is data. The screen
branches on the outcome's `kind` and never on an event's id, so authoring a new event is
authoring a record — no new code path, no new screen.

That is the load-bearing constraint. If a new event wants behavior the outcome vocabulary
cannot express, the fix is to **extend the vocabulary**, not to special-case an id — the
same rule CLAUDE.md states for every other content type.

### The outcome vocabulary

| kind | what it does | e.g. |
| --- | --- | --- |
| `learnMove` | Rolls ONE move from a declarative `MovePoolFilter` and lets the player teach it to any roster hero, swapping one out if that hero is at `MOVE_CAP`. **No pool holds a signature or a Class move** (`movePoolFor`): both belong to somebody. | Fruit Slicer, Wildcard |
| `statShift` | Flat additive stat deltas, some possibly negative, permanently-for-the-run on one chosen hero (`RosterEntry.bonusStatGrants`). | Soul Transfer |
| `grantPassive` | Teaches a Passive to one chosen hero (`RosterEntry.bonusPassiveGrants`). | Assertiveness Training |
| `loot` | N pieces of equipment on the act's own drop curve, through the who-screens. | Loot Pile |
| `recruit` | `count` heroes from a `HeroPoolFilter` over the run's deck, none already held. One joins **raw at the player's par** (`eventRecruitEntry`: a hire's terms without a hire's act of lag). At the cap, someone leaves with their gear. Always declinable. | Rustling Grass, Raise the Dead |
| `gamble` | A chosen hero takes `win` at `chance`, `lose` otherwise. Both branches are a `statShift` or a `grantPassive`, both are shown first, and a hero that could not survive the worse one is greyed. | The Two-Headed Coin, the Fae Ring |
| `curse` | MARKS one chosen hero with a curse (`data/curses.ts`, `applyCurse`), which changes nothing until the **Turn** at the curse's Mastery pip. The hero turns on the spot if already past it. The Turn is the whole transformation: the typing in both slots (the one override of the innate primary), the curse's base line in place of the hero's, its innate, its move and its art (`run/curse.ts`). | Werewolf Bite |
| `choice` | One to three options, each its own outcome and cost, **plus an implicit Leave**. Options never nest. Every option's contents roll at mount, so an option shows what it holds. | Lucid Dream, the Whispering Altar |

**Costs** (`EventCost`, 2026-10-03) sit beside an outcome and land in the same transform:

- **`gold`**: a sink, never a grant.
- **`woundAll`**: a share of max HP off every standing hero as Wounds. It stops at 1 HP, so
  an event never KOs anyone.

**A gamble or a cost lives inside a `choice`**, so there is always a way out. `test/events`
enforces it.

**Never GRANTED by an event:** gold, Mastery Scrolls, Recruit Contracts. Each is already a
whole map-node type or a per-act grant, and an event that duplicated one would be a reward
node wearing a costume.

**A hero is granted now** (`recruit`, 2026-10-03, per user direction). The difference from a
contract is the point:

- A recruit is raw, not finished.
- It is narrowed by theme: the Necropolis raises the dead, the Foundry builds a Mech.
- It is paid for by the node it took, not by a contract.

### The authored slate

| Event | Outcome |
| --- | --- |
| **Fruit Slicer** | A random *Slice* move (`{ nameIncludes: 'Slice' }` — seven moves across seven types), taught to a chosen hero. |
| **Wildcard** | A random move from the **entire** catalog, taught to a chosen hero. Ancient-type moves join this pool automatically the day they are authored — the filter is the catalog, not a list. |
| **Soul Transfer** | A chosen hero trades **−20 max HP for +20 Intelligence, +20 Wisdom, +20 Mana**. |
| **The Deep Well** | A chosen hero trades **−20 max HP for +40 Mana and +5 MP Regen**: the Mana Well's grant, for a scratch (`docs/mana.md` "Growing the pool"). |
| **Assertiveness Training** | A chosen hero learns **Imposing Presence** (§4). |
| **Loot Pile** | **3** random pieces of equipment on the act's rarity curve. |

**The second wave** (2026-10-03, `docs/wild-innates-and-events.md` §3.2) brought the slate
to 26. Two are anywhere:

- **Mercenary Camp:** 20g, one of three heroes joins.
- **The Two-Headed Coin:** 50%, +30 Atk / +30 Int / +20 Spd, else +20 Def / +20 Wis.

A third, **Werewolf Bite** (weight 5, anywhere), is the `curse`
(`docs/wild-innates-and-events.md` §3.3). The bite marks; at Mastery 5 (or at once, past it) the
hero Turns:

- pure Beast;
- a 650-stat body;
- Lacerate;
- Lycanthrope;
- the werewolf form.

The rest are a Location's own:

| Location | Events |
| --- | --- |
| Wild's Edge | **Rustling Grass** (a recruit), **Abandoned Camp** (2 loot, everyone −10% HP) |
| Blighted Shrine | **The Whispering Altar** (a Mid/Late Shadow move or Arcane move), **The Hermit's Lantern** (a Shadow/Arcane/Mind recruit) |
| Forbidden Forest | **The Fae Ring** (+40 Spd +20 Atk/Int, else +60 HP +20 Def), **The Dryad's Call** (a Nature/Beast/Light recruit) |
| Molten Foundry | **The Slag Bath** (−20 HP, +40 Def, +20 Wis), **Automaton Kit** (a Mech/Iron/Fire recruit) |
| Storm Coast | **Shipwreck** (3 loot, −10% HP), **Siren Song** (a recruit), **Lightning Rod** (60%: +25 Spd +30 Atk/Int, else +20 Spd +60 HP; also the Aerie) |
| Necropolis | **Grave Robbing** (2 loot, −10% HP), **Raise the Dead** (a Spirit/Frost recruit), **The Lich's Bargain** (−40 HP for +30 Int/Wis/Mana) |
| Holy Sanctum | **The Pilgrim's Font** (a Mid/Late Light move, or a recruit) |
| Dreaming Spires | **Lucid Dream** (a Mid/Late Mind move or Arcane one) |
| Thunder Aerie | **The Roc's Nest** (2 loot for −10% HP, or a Storm/Beast recruit), Lightning Rod |
| Frozen Reach | **The Icy Plunge** (+40 Def/Wis, else +60 HP +10 Def/Wis; or a free recruit) |

Every stat figure above is the **Act 1** payout. Gains grow with the act (§1b).

### 1b. Balance (2026-10-03, per user direction)

**An event is never a bad pick.** It competes for its row with the Item Cache. The price of an
event is not knowing which one you will get, never that the one you got was a poor trade.

**The bar is the Item Cache:** the best of three items on the act's curve. In item-budget points
(`run/equipment.ts` `statGrantCost`: 1 a stat point, 3 HP a point, MP Regen 3) that is about
**50 in Act 1, rising to about 100 by Act 5**. A single random item is 38 → 85.

**Stat payouts grow with the act:**

- **Authored at their Act 1 figure,** multiplied by `EVENT_STAT_SCALE_BY_ACT` =
  ×1 / 1.25 / 1.5 / 1.75 / 2 through `outcomeForAct`, and rounded to the multiples of 5.
- **Only gains grow;** a cost stays as written.
- **The screen shows the scaled figure,** and the sim resolves it.

**The pinned floors** (`test/eventVocabulary` "event balance"):

- **A stat trade** nets ≥ 45 points in Act 1, costs counted. The slate's trades sit at 48–77.
- **A gamble never loses.** Both branches pay, the jackpot pays more, and the EV clears 55. The
  slate's gambles are 80–85 against a 40 consolation: EV 60–67.
- **A typed move event** teaches only Mid or Late moves (`MovePoolFilter.tiers`), the
  Mentor's band or better.

**Costs mostly went:**

- Recruits are free, except Mercenary Camp's 20g.
- Move events are free.
- A loot event's wound is 10%. Two or three whole items against one picked of three is what
  that 10% buys.

Before the pass, the gambles' EV was +5 to +14 points and the trades +23 to +47, flat across
acts. Every gamble and most trades were worse than the cache they sat beside.

**Not measured.** The sim's pilot takes events and gambles but has no node-choice comparison
against the cache. A sim pass should read win rate by the reward picked.

`test/eventVocabulary` pins that every Location a run can visit before the finale holds at
least one event of its own.

---

## 2. Selection: act and Location gates

`src/run/events.ts` `eligibleEvents` filters the catalog on two authored, both-optional
gates before `rollRunEvent` picks uniformly among what is left:

- **`minAct`** — earliest act, inclusive.
- **`locationIds`** — the Locations (docs/locations.md) this event belongs to.

**The Location gate is how a place gets its own events** (user direction, 2026-08-31; used
since 2026-10-03). Eight of the slate are ungated. The rest are a Location's own, so a run
meets its Location's events beside the general pool.

A run with **no** itinerary (an `enemyGen` throwaway roster, a fixture) passes
`locationId: null`, which matches only the ungated events — the conservative reading: an
event authored for the Necropolis should not surface somewhere unknown.

**Two rolls, in two places, on purpose.** *Which event* a node is rolls in `App.tsx` at
node-select time and rides on the `Screen` variant, exactly as the shop's offers do — the
screen re-renders on every `onRunChange`, and a roll made inside it would produce a
different event each time the run state moved. The event's *own contents* (which move,
which loot) roll inside the screen, which is safe because the screen is never unmounted
mid-event: its one hand-off, loot → the bag, is terminal.

**Weighting** (2026-10-03):

- **Inside the node,** an event's `weight` defaults to `DEFAULT_EVENT_WEIGHT` = 10. Recruits
  sit at 6, so a Location's own trades and gambles outnumber its strangers.
- **On the map,** `event` weighs **30** in `REWARD_WEIGHTS`. It was 8, then 16, and was
  raised when the slate grew from six to twenty-five. Still an inference, not a measurement.

---

## 3. Two things the events forced

**A negative stat grant.** Soul Transfer is the first content in the game that takes a
stat *away*. CLAUDE.md's "multiples of 5 or 10" governs magnitude, so a cost obeys it
exactly as a grant does. But nothing in the run tier assumed stats stay positive — max HP
feeds `getMaxHp`, which feeds starting HP, which at zero is a hero that faints the instant
a fight is built. `MIN_HP_AFTER_SHIFT` (10) is the floor, and the screen greys a hero out
rather than failing on tap. It is a safety net, not a balance knob: no authored hero is
anywhere near it, and the test asserts that.

**A passive from neither gear, relic, nor Evolution.** `RosterEntry.bonusPassiveGrants` is
the passive-grant sibling of `bonusStatGrants`, folded in by `entryStats.ts`
`entryPassiveCounts` alongside the other four sources. Duplicates stack, as duplicate
relics and duplicate item grants already do.

---

## 4. Imposing Presence, and the entry hook

> When this hero enters the battlefield, enemies lose 10 Attack.

This is the one place an event reached into the engine. Two additions, both generic:

**`PassiveHook 'SwitchedIn'`** — the entry hook. Its subject is the *incoming* combatant
(`passiveEngine.ts` `subjectOf`), so `relativeTo: 'self'` reads as "when I step onto the
battlefield". It fires for **every** way a hero arrives:

| arrival | where it is resolved |
| --- | --- |
| a declared switch | `resolveRound.ts`, switch bracket |
| a pivot move (`switchesUserOut`) | `resolveRound.ts`, post-payload pivot |
| a forced replacement after a KO | `FightScreen.tsx` (both sides) |
| **the opening lead** | `passiveEngine.ts` `resolveBattleStartEntries` |

The opening lead needed its own entry point because a fight's starting four are *placed*
by `buildCombatState`, not switched in, so they produce no `SwitchedIn` event. Rather than
a second code path, that function **synthesises** the event a switch would have produced
and runs it through the same matcher. The synthesised events are not returned — the view
would narrate them as "X switches in!" over a board where nothing switched. Only what the
passives did comes back, into the fight's opening log.

Without this, the passive would fire on a hero's *second* arrival but not its first, which
is not a reading of "enters the battlefield" anyone would defend.

**`PassiveEffectTarget 'activeEnemies'`** — the first group target. Every non-fainted
combatant currently **active** on the opposing side; `resolveEffect` resolves the effect
once per member, threading state, so one `PassiveTriggered` is followed by N `StatChanged`
events (`buildBeats.ts` consumes the whole run into one beat). Active-only is deliberate:
reaching the bench would let an entry passive debuff heroes not yet committed to the fight,
taxing the opponent's whole roster instead of reading the two heroes in front of you.

### Open balance question — flagged, not resolved

Imposing Presence **re-fires on every re-entry and is unbounded within a fight**. Cycling
the hero is the build, and switching costs tempo, which is the price. The shape has
precedent — Vengeful Emblem's +5 Attack per hit taken is equally unbounded — but this one
is the only debuff in the game that compounds **without spending mana**, and paired with a
fast pivot it may not need the tempo it costs. Worth watching in playtest. The
`grantPassive` outcome also lets a hero be taught it twice, which stacks (2 × −10 per
entry).

---

## 5. Adding an event

1. Write the record in `src/data/events.ts`. Give it a `name`, an `eyebrow`, one line of
   `flavor` (the screen draws it in its own voice — it is the only non-mechanical thing
   on the page), a `tone`, and an `outcome`.
2. If it belongs to a place or a stage of the run, add `locationIds` / `minAct`.
3. That is all. `test/events.test.ts` validates the whole catalog on every run — an empty
   move filter, an unknown passive id, an unknown location id, a stat delta off the
   multiples-of-5 rule, or a loot count of zero each fail loudly rather than shipping.

Do not add a branch to `EventNodeScreen` for it.
