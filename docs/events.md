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

### The outcome vocabulary (four kinds)

| kind | what it does | today's events |
| --- | --- | --- |
| `learnMove` | Rolls ONE move from a declarative `MovePoolFilter` and lets the player teach it to any roster hero — swapping one out if that hero is at `MOVE_CAP`. | Fruit Slicer, Wildcard |
| `statShift` | Flat additive stat deltas, some possibly negative, permanently-for-the-run on one chosen hero (`RosterEntry.bonusStatGrants`). | Soul Transfer |
| `grantPassive` | Teaches a Passive to one chosen hero (`RosterEntry.bonusPassiveGrants`). | Assertiveness Training |
| `loot` | N pieces of equipment on the act's own drop curve, handed to `ForceEquipScreen`. | Loot Pile |

**What is deliberately NOT in the vocabulary:** gold, Training Points, Recruit Contracts.
Each is already a whole map-node type or a per-act grant, and an event that duplicated one
would be a reward node wearing a costume. An event should be a thing the map cannot
otherwise do.

### The authored slate

| Event | Outcome |
| --- | --- |
| **Fruit Slicer** | A random *Slice* move (`{ nameIncludes: 'Slice' }` — seven moves across seven types), taught to a chosen hero. |
| **Wildcard** | A random move from the **entire** catalog, taught to a chosen hero. Ancient-type moves join this pool automatically the day they are authored — the filter is the catalog, not a list. |
| **Soul Transfer** | A chosen hero trades **−20 max HP for +20 Mana**. |
| **Assertiveness Training** | A chosen hero learns **Imposing Presence** (§4). |
| **Loot Pile** | **3** random pieces of equipment on the act's rarity curve. |

---

## 2. Selection: act and Location gates

`src/run/events.ts` `eligibleEvents` filters the catalog on two authored, both-optional
gates before `rollRunEvent` picks uniformly among what is left:

- **`minAct`** — earliest act, inclusive.
- **`locationIds`** — the Locations (docs/locations.md) this event belongs to.

Every event on the current slate leaves both unset, so today's five are one general pool
that can appear anywhere. **The Location gate is the hook for Location-specific events**
(user direction, 2026-08-31: "in the future, there may be Location-specific events... make
sure the engine is prepared to tackle that down the line"). A Molten Foundry event sets
`locationIds: ['moltenFoundry']` and is never rolled elsewhere; nothing else changes, and
`test/events.test.ts` already covers the gate with a synthetic event.

A run with **no** itinerary (an `enemyGen` throwaway roster, a fixture) passes
`locationId: null`, which matches only the ungated events — the conservative reading: an
event authored for the Necropolis should not surface somewhere unknown.

**Two rolls, in two places, on purpose.** *Which event* a node is rolls in `App.tsx` at
node-select time and rides on the `Screen` variant, exactly as the shop's offers do — the
screen re-renders on every `onRunChange`, and a roll made inside it would produce a
different event each time the run state moved. The event's *own contents* (which move,
which loot) roll inside the screen, which is safe because the screen is never unmounted
mid-event: its one hand-off, loot → the equip gate, is terminal.

**Weighting:** none. `event` has a single weight in `map.ts` `REWARD_WEIGHTS` (raised
8 → 14 when the node stopped being empty — **flagged as an inference, not a decision**),
and the events inside it are equiprobable. With five entries a weight table would be five
numbers nobody yet has a reason to pick. Add a `weight` field when the pool grows to where
some events should be rarer, the same call `REWARD_WEIGHTS` already made for map nodes.

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
