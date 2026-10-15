# versus.md — Versus: a friend across the table, by code

> **STATUS: DRAFTED 2026-10-15, NOT BUILT.** Decided per user direction: **friends only, joined by a
> room code** — no matchmaking, no ranked ladder, no lobby browser unless the game ever needs one;
> **a turn timer**; **the format is a Gauntlet-style draft, not Constructed** — Constructed is built
> up over a long collection, a draft puts a wide range of heroes in front of both players at once;
> **each player is dealt their own offers from one shared seed**; **versus opens with the Gauntlet**,
> on the first Cycle I clear. Everything else here is a proposal, and §8 lists what is open.

Two players, two phones. Each drafts a six the Gauntlet way, and then the two sixes fight once.
It plays like a Gauntlet fight, except that the other side's commands come from a person.

---

## 0. Why this is cheap here, and where the cost really is

- **The engine already does the hard part.** `resolveRound(state, actions, config)` is pure, and the
  RNG lives in the combat state (`CombatState.seed`, `rngState`). Two clients that start from the
  same seed and the same two teams, and feed in the same actions, compute the same fight to the
  last variance roll. So the wire carries **commands, never state**. This is **lockstep**, the model
  fighting games and RTS replays use.
- **The draft is already lockstep too.** `rollOffer` and `rollGauntletSlot` (`src/run/gauntlet.ts`)
  build every offer, path and kit from `seed + the picks so far`. Given the seed and the pool, both
  clients deal both players' boards themselves, and the only thing sent is which of three was
  taken. A whole match is `build + seed + pool + twelve picks + action log`. No team code changes
  hands.
- **The cost is the view.** `FightScreen` is written as *the player against an AI*: the enemy's
  leads go out first, potions are free and instant, the enemy decides without waiting. Every one of
  those is a sync point once the other side is a person (§3).
- **References.** Pokémon Emerald's **Battle Factory** (rental sets, already the Gauntlet's model)
  and Hearthstone Arena for the draft, each player with their own picks; Pokémon Showdown's
  challenge-a-friend for the room (a code, a timer that auto-picks); VGC's simultaneous team preview
  for the leads.

---

## 1. The format

**A draft and one fight.** Both players enter the room, the host sends a seed, and each is dealt
**six offers of three** exactly as the Gauntlet deals them: a hero in a random path and kit, level
30, Mastery 10, no items, `TEAM_TYPE_LIMIT` held. Both draft **at the same time** with no waiting on
each other, since the two boards never compete for a hero. A mirror is possible only by chance.
When both sixes are in, they fight.

- **The pool is the union of what either player owns**, sent in the handshake, so a player who owns
  more never deals a thinner draft to either side, and the base 28 are always enough.
- **Each player's board is keyed by their seat**: `rollOffer` seeded off `seed ^ seat`, so the two
  boards differ and either client can roll both.
- **No path stars are weighted up.** The Gauntlet weights unstarred paths (`UNSTARRED_WEIGHT`)
  because a clear stars them; a versus draft pays no stars (§8), so every path is dealt evenly.
- **Potions: the Gauntlet's purse**, synced as in §3.
- One draft, one fight. Best of three is a lobby loop, not an engine change (§8).

**The gate is the Gauntlet's** (`isGauntletOpen`): versus is a fourth door, or a door inside the
Gauntlet's, from the first Cycle I clear. A friend who has not cleared Cycle I cannot join yet.

**Constructed versus is later**, if ever: the same fight with a team code (§7) in place of the
draft. Nothing in the fight layer changes between the two.

---

## 2. Transport

A room needs a meeting point even with no matchmaking. Two options, both free at friend scale:

| | WebRTC peer-to-peer (PeerJS broker) | A small relay (Cloudflare Durable Object / PartyKit) |
|---|---|---|
| Server we run | none | ~100 lines |
| Fails on | strict NATs, some mobile carriers | nothing common |
| Reconnect | re-handshake | the relay holds the log |

**Proposed: the relay.** Mobile networks are where WebRTC falls over most, and a relay that keeps
the room's log makes reconnect (§4) a replay instead of a protocol. The game also has to be
**hosted** somewhere both phones can open, which it is not today; a static host serves the build and
the relay sits beside it.

**The handshake carries the build hash.** Two builds with different content will desync on the
first deal, so a mismatch refuses the room ("your friend is on a different version").

### Messages

| Message | Sent | Carries |
|---|---|---|
| `hello` | on join | build hash, display name, owned hero ids |
| `seed` | host, once both are in | the match seed |
| `pick` | each draft offer | the index taken, 0–2 |
| `leads` | lead pick | two hero ids, committed (§3) |
| `commands` | each command phase | that side's `Action[]`, committed |
| `drink` | command phase | a potion on a hero, in order with commands |
| `replace` | after a KO | the forced replacement's hero id |
| `hash` | after each round | a hash of the resolved state (§4) |
| `leave` | any time | forfeits |

---

## 3. Sync points: where the view stops assuming an AI

Each of these is a moment where one side used to know something before the other.

1. **The draft never waits.** Your six offers depend only on your own picks, so you draft at your
   own pace; a `pick` is sent as it is made, and the screen waits only at the end, until the other
   six is in. Your friend's picks stay hidden until team preview.
2. **Lead pick becomes blind and simultaneous.** Today the enemy's two take the field and the player
   picks against them. In versus both see both sixes at team preview, pick hidden, and are revealed
   together (VGC's team preview). `placeLeads` is called once per side, the same as now.
3. **Commands are commit-then-reveal.** Each side's `Action[]` is sent when locked in; the screen
   shows *waiting* until the other side's arrives; then both clients call `resolveRound` with the
   two sets in the same order. Neither client sees the other's commands before its own are sent.
4. **Potions.** They apply on the spot during the command phase, so a drink is sent as its own
   message and applied on both screens when it lands. The drinker sees the outcome before declaring,
   which is the point, and the opponent sees it too, which is new: a drink is visible information
   in versus. The alternative is to apply drinks at resolve only, which breaks the rule that the
   player sees what a drink did before declaring. Proposed: apply on arrival, show it.
5. **Forced replacement after a KO** waits for whichever side owns the fallen hero, then both apply
   `applyForcedReplacement`. Both sides replacing at once is simultaneous and blind, as with leads.
6. **One screen orientation.** Your side is always the bottom of your screen. The engine keeps its
   `PLAYER_SIDE` / enemy split; the view maps *my side* to whichever one you are, so the host is
   the player side and the guest the enemy side under the hood.

### The turn timer

- **Proposed 60 seconds a command phase, 30 for a draft pick, a lead pick or a replacement**, shown
  as a quiet draining ring, no number until the last ten seconds.
- **At zero, your own client submits for you.** A command phase uses the Gauntlet's pilot
  (`pilotActions`), not a Rest, because a timed-out turn should still be a turn. A draft pick takes
  the first of the three, a replacement the first candidate.
- The timer is honest, not secure. A friend who edits their client to have no timer has bigger
  problems than the timer.

---

## 4. Desync and reconnect

- **Hash every round**, and hash both sixes once the draft closes. After each `resolveRound` both
  clients hash the state and exchange it. A mismatch is a bug, not a cheat: the match stops with
  "out of step" and both logs are kept for a repro. The likely source is `Math.pow` / `Math.exp`
  differing between V8 (Android, desktop) and JavaScriptCore (iOS). Integer-rounded damage makes
  this rare, not impossible. The first fix to try is routing every transcendental call through one
  function both engines agree on.
- **Reconnect is a replay.** The relay holds the log; a dropped player rejoins with the code and
  replays seed, pool, picks and every committed action to the current round. The screen skips
  straight to the end of the replay, no animation.
- **Abandonment.** Ninety seconds of absence offers the other player *claim the win* or *keep
  waiting*.

---

## 5. Draft shapes considered

Three ways to deal a shared draft, and why the first was taken (2026-10-15, per user direction):

| Shape | For | Against |
|---|---|---|
| **Own offers, same seed** (taken) | no waiting; Battle Factory and Arena precedent; mirrors only by chance | you never read or answer your friend's draft until preview |
| Same offers, both pick | you can read what they might build | a mirror is the same unit, path and kit |
| Snake draft, shared board | denial; the most interaction | every pick waits on the other player |

The snake is the one to revisit if versus wants more draft interaction later; it costs only the
waits, not new verbs.

---

## 6. What versus puts pressure on

Every fight in the game was tuned against an AI, and some of the rules are guards against how that
AI plays. A person will find the lines it never does:

- **The Provoke family's 5 Charges** broke the tank + Renew + Provoke checkmate against an AI that
  walks into it. A person will build it on purpose, and a draft deals a tank, a Renew and a Provoke
  more often than one would expect.
- **The Pact Clock at round 30** brackets a stall the AI drifts into. A person will stall to it
  deliberately if they are ahead.
- **Lock-in at half the side KO'd** is a phase change both sides now play toward.
- **Information the AI never used**: scouting, the order track, a drink's outcome.

None of this blocks the build; it is the playtest list. If versus turns out to need its own rules,
they live in a versus ruleset, not in Classic's numbers.

---

## 7. Team codes

Not needed for versus as decided: the draft rebuilds both sixes from the seed. Team codes stay
Constructed's (`docs/constructed.md` §5), and a Constructed versus would be the same fight with a
code exchanged in place of the twelve picks.

---

## 8. Open questions

- **Rewards.** Does a versus win pay stars? Proposed: no. A friend fight is its own reward, and
  stars from a friend you can farm are a hole in the economy. It is also why §1 drops the
  unstarred weighting.
- **Entry.** The Gauntlet costs a free daily entry or 3 stars. Proposed: versus is free, since it
  pays nothing.
- **Best of three**, a fresh draft or the same sixes between games: a lobby loop, cheap, later.
- **Union pool fairness**: a hero only one player owns can be dealt to the other. Proposed: fine,
  it is how a friend shows you a hero you have not got.
- **Spectating**: a third client that only reads the log. Free with lockstep; no demand yet.
- **Timer length**: 60 s is Showdown's ballpark; play decides.
- **Hosting**: where the build lives (static host) and who pays for the relay at any scale above
  friends.

---

## 9. Implementation, in order

1. **Two tabs, no server.** Versus over `BroadcastChannel` between two browser tabs on one machine:
   the seeded twin draft (§1), team preview and blind leads, commit-then-reveal, the per-round hash.
   Proves lockstep and the screen with nothing deployed. `test/` gains a determinism test: one log
   replayed twice, equal hashes.
2. **The relay and room codes** (§2), the build hash, the turn timer, and the door into it.
3. **Reconnect and abandonment** (§4).

Each step is playable on its own: step 1 already lets two people on one desk play a match.

---

## 10. What this reverses

Nothing yet. Versus is a new mode; it changes no Classic, Trials or Gauntlet rule. Three rules read
differently inside it, and the build makes them explicit rather than silent:

- **"The enemy AI reads the telegraph"** and every pilot-only behaviour: the other side is a person.
- **"Player-only; enemies never drink"**: both sides are players, so both hold the Gauntlet's purse.
- **The Gauntlet's unstarred weighting**: not applied in a versus draft, which pays no stars.
