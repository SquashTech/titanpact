# versus.md — Versus: a friend across the table, by code

> **STATUS: DRAFTED 2026-10-15, NOT BUILT.** Decided per user direction: **friends only, joined by a
> room code** — no matchmaking, no ranked ladder, no lobby browser unless the game ever needs one;
> **a turn timer**; the format is **Constructed first, Gauntlet-style later**. Everything else here
> is a proposal, and §8 lists what is open.

Two players, two phones, one fight. Each brings a six from the teambuilder, and the fight plays as
it does against the Trials' pilot, except that the other side's commands come from a person.

---

## 0. Why this is cheap here, and where the cost really is

- **The engine already does the hard part.** `resolveRound(state, actions, config)` is pure, and the
  RNG lives in the combat state (`CombatState.seed`, `rngState`). Two clients that start from the
  same seed and the same two teams, and feed in the same actions, compute the same fight to the
  last variance roll. So the wire carries **commands, never state**. This is **lockstep**, the model
  fighting games and RTS replays use. A whole match is `build + seed + two teams + action log`.
- **The cost is the view.** `FightScreen` is written as *the player against an AI*: the enemy's
  leads go out first, potions are free and instant, the enemy decides without waiting. Every one of
  those is a sync point once the other side is a person (§3).
- **References.** Pokémon Showdown's challenge-a-friend (a code, a team paste, a timer that
  auto-picks); VGC's simultaneous team preview; Into the Breach for the opposite case, a game that
  stayed single-player because its fights were built around a readable AI. Titanpact's are too, and
  §6 says what that costs.

---

## 1. The format

**Phase 1 is Constructed.** Each player picks one of their own saved teams (`Profile.constructedTeams`),
checked legal against **their own** profile (`teamProblems` with their unlocks). The other player's
team needs no unlock on your side: the content is the same build, so every hero can be fielded on
either screen.

- Level 30, Mastery 10, Mythic gear, the expected stat line: `constructedSide` as it stands.
- **Potions: `CONSTRUCTED_POTIONS` (one HP, one MP)**, the Trials' purse, synced as in §3.
- One fight, best of one. A best-of-three is a lobby loop, not an engine change (§8).

**Phase 3 is a shared draft** (§5), the Gauntlet's offers dealt to both players from one seed.

---

## 2. Transport

A room needs a meeting point even with no matchmaking. Two options, both free at friend scale:

| | WebRTC peer-to-peer (PeerJS broker) | A small relay (Cloudflare Durable Object / PartyKit) |
|---|---|---|
| Server we run | none | ~100 lines |
| Fails on | strict NATs, some mobile carriers | nothing common |
| Reconnect | re-handshake | the relay holds the log |

**Proposed: the relay.** Mobile networks are where WebRTC falls over most, and a relay that keeps
the room's action log makes reconnect (§4) a replay instead of a protocol. The game also has to be
**hosted** somewhere both phones can open, which it is not today; a static host serves the build and
the relay sits beside it.

**The handshake carries the build hash.** Two builds with different content will desync on the
first round, so a mismatch refuses the room ("your friend is on a different version").

### Messages

| Message | Sent | Carries |
|---|---|---|
| `hello` | on join | build hash, display name |
| `team` | before the fight | the team code (§7) |
| `seed` | host, once both teams are in | the fight's seed |
| `leads` | lead pick | two hero ids, committed (§3) |
| `commands` | each command phase | that side's `Action[]`, committed |
| `drink` | command phase | a potion on a hero, in order with commands |
| `replace` | after a KO | the forced replacement's hero id |
| `hash` | after each round | a hash of the resolved state (§4) |
| `leave` | any time | forfeits |

---

## 3. Sync points: where the view stops assuming an AI

Each of these is a moment where one side used to know something before the other.

1. **Lead pick becomes blind and simultaneous.** Today the enemy's two take the field and the player
   picks against them. In versus both pick from team preview, hidden, and both are revealed
   together (VGC's team preview). `placeLeads` is called once per side, the same as now.
2. **Commands are commit-then-reveal.** Each side's `Action[]` is sent when locked in; the screen
   shows *waiting* until the other side's arrives; then both clients call `resolveRound` with the
   two sets in the same order. Neither client sees the other's commands before its own are sent.
3. **Potions.** They apply on the spot during the command phase, so a drink is sent as its own
   message and applied on both screens when it lands. The drinker sees the outcome before declaring,
   which is the point, and the opponent sees it too, which is new: a drink is visible information
   in versus. The alternative is to apply drinks at resolve only; that breaks the rule that the
   player sees what a drink did before declaring. Proposed: apply on arrival, show it.
4. **Forced replacement after a KO** waits for whichever side owns the fallen hero, then both apply
   `applyForcedReplacement`. Both sides replacing at once is simultaneous and blind, as with leads.
5. **One screen orientation.** Your side is always the bottom of your screen. The engine keeps its
   `PLAYER_SIDE` / enemy split; the view maps *my side* to whichever one you are, so the host is
   the player side and the guest the enemy side under the hood.

### The turn timer

- **Proposed 60 seconds a command phase, 30 for a lead pick or a replacement**, shown as a quiet
  draining ring, no number until the last ten seconds.
- **At zero, your own client submits for you, using the Trials' pilot** (`pilotActions`), not a
  Rest: a timed-out turn should still be a turn. A replacement times out to the first candidate.
- The timer is honest, not secure. A friend who edits their client to have no timer has bigger
  problems than the timer.

---

## 4. Desync and reconnect

- **Hash every round.** After each `resolveRound` both clients hash the state and exchange it. A
  mismatch is a bug, not a cheat: the fight stops with "out of step" and both logs are kept for a
  repro. The likely source is `Math.pow` / `Math.exp` differing between V8 (Android, desktop) and
  JavaScriptCore (iOS). Integer-rounded damage makes this rare, not impossible. The first target
  for a fix is to make every transcendental call go through one function both engines agree on.
- **Reconnect is a replay.** The relay holds the log; a dropped player rejoins with the code and
  replays seed + teams + every committed action to the current round. The screen skips straight to
  the end of the replay, no animation.
- **Abandonment.** Ninety seconds of absence offers the other player *claim the win* or *keep
  waiting*.

---

## 5. Phase 3: a shared draft

The Gauntlet deals six offers of three from one seed. A versus draft deals **the same offers to
both players** and fights once at the end, one fight between the two sixes. It is Battle Factory
between friends. The draft can be simultaneous (both see the same three, each takes one) with no
snake order to sync, because the two picks do not compete for a hero. Heroes come from the
**union** of what either player owns, so a friend who owns more does not deal a thinner draft.

---

## 6. What versus puts pressure on

Every fight in the game was tuned against an AI, and some of the rules are guards against how that
AI plays. A person will find the lines it never does:

- **The Provoke family's 5 Charges** broke the tank + Renew + Provoke checkmate against an AI that
  walks into it. A person will build it on purpose.
- **The Pact Clock at round 30** brackets a stall the AI drifts into. A person will stall to it
  deliberately if they are ahead.
- **Lock-in at half the side KO'd** is a phase change both sides now play toward.
- **Information the AI never used**: scouting, the order track, a drink's outcome.

None of this blocks the build; it is the playtest list. If versus turns out to need its own rules,
they live in a versus ruleset, not in Classic's numbers.

---

## 7. Team codes

Versus needs Constructed's unbuilt **team codes** (`docs/constructed.md` §5): a `Team` is a
small object (six slots of hero, path, moves, items, gems), so a code is that object compacted and
base64url'd, short enough to paste into a chat. Building it for versus also builds it for sharing
teams, which was always the plan.

---

## 8. Open questions

- **Rewards.** Does a versus win pay stars? Proposed: no. A friend fight is its own reward, and
  stars from a friend you can farm are a hole in the economy.
- **Best of three**, with team preview between games: a lobby loop, cheap, later.
- **Spectating**: a third client that only reads the log. Free with lockstep; no demand yet.
- **Timer length**: 60 s is Showdown's ballpark; play decides.
- **Hosting**: where the build lives (static host) and who pays for the relay at any scale above
  friends.
- **A rematch with teams swapped** — a fun Battle Factory echo, not needed.

---

## 9. Implementation, in order

1. **Two tabs, no server.** Versus over `BroadcastChannel` between two browser tabs on one machine:
   the view flip (§3), blind leads, commit-then-reveal, the per-round hash. Proves lockstep and the
   screen with nothing deployed. `test/` gains a determinism test: one log replayed twice, equal
   hashes.
2. **Team codes** (§7), in Constructed's teambuilder.
3. **The relay and room codes** (§2), the build hash, the turn timer, and the title's door into it.
4. **Reconnect and abandonment** (§4).
5. **The shared draft** (§5).

Each step is playable on its own: step 1 already lets two people on one desk play a fight.

---

## 10. What this reverses

Nothing yet. Versus is a new mode; it changes no Classic, Trials or Gauntlet rule. Two rules read
differently inside it, and the build makes them explicit rather than silent:

- **"The enemy AI reads the telegraph"** and every pilot-only behaviour: the other side is a person.
- **"Player-only; enemies never drink"**: both sides are players, so both hold the Trials' purse.
