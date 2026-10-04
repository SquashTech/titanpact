# Wild Innates and the Event Expansion

**Status: PARTLY BUILT** (proposed 2026-10-02, decided 2026-10-03, per user direction). Three asks:
Motley's Trick (§1), a handful of game-breaking innates (§2), and many more, wilder events (§3).

**Built (2026-10-03):**

- **The event vocabulary** — `choice`, `gamble`, `recruit` and `curse` outcomes, gold and
  `woundAll` costs, per-event `weight`, and a 26-event slate, most of it Location-gated. The map's
  `event` weight went 16 → 30. `docs/events.md` is the reference.
- **Motley's Trick** (§1), on the re-based Motley.
- **Gilded Mane** (Aurum, replacing Blazing Mane; §2).
- **Werewolf Bite** (§3.3), reworked from the proposal: the bite MARKS, and the Turn comes at
  Mastery 5.

**Not built:** the other innates in §2 (PROPOSED); the outcome kinds `innateSwap`, `terminate` and
`delayed` (§3.1) and the events that wait on them; the rest of §3.2's slate. **No sim pass has
been run on any of this.** §6 names the locked rules each piece reverses.

---

## 1. Motley's Trick

> **Motley's Trick** (innate). Motley always carries *Motley's Trick*. It takes one of the
> four slots, and nothing can teach over it. At the start of every round the Trick becomes
> a random move from anywhere in the game: that move's type, mana cost, power, targeting and
> effects, for that round.

### How it plays

- **The roll is visible before you declare.** Pokémon's Metronome is blind; this one is not. The
  command phase shows this round's face, with the full card on a long press, and the player
  decides whether to use it, Rest, or swing a fixed move. That keeps the chaos a *read* and not a
  slot machine, which is the difference between a gimmick and a hero.
- **The roll is derived, not stored** — `hash(seed, round, combatantId)`, the shape of Jackpot's
  `resolveRandomBasePower` — so engine, view and AI agree, replays are deterministic, and an enemy
  Motley works with no AI change.
- **The mana price is the balance.** A Late face in Act 1 is legal; whether it can be paid for is
  the question.
- **STAB lands only on Mind faces**, and equal Attack and Intelligence mean neither half of the
  catalog is a dud roll.

**The pool** is every move except signatures, class moves and the Trick itself. **Ancient stays
in** — rolling one of the Herald's moves is the best story the Trick can tell. **Open:** whether
Rest-like or no-op faces need filtering out; find out in play.

**Mastered (pip 10): *Motley's Trick+*** shows **two faces and Motley picks one**.

**Motley's line:** 170 / 50×5 / 130 (Mana the roster's top pool by 35; HP under the roster's 180
floor on purpose — the "weak" asked for), grades C / B×5 / A, kit Trick + Psi Bolt. Slapstick and
Pandemonium retired.

### As built

- **Schema:** `MoveDefinition.metamorphic` / `permanent`, `PassiveDefinition.metamorphicFaces`
  (1, or 2 mastered).
- **The roll:** `resolveMetamorphicFaces` in `engine/state.ts`.
- **The swap:** `run/metamorphic.ts` `kitForRound` swaps the face in at the kit, the one place it
  happens; the move buttons, the Rest check and the AI all read it, and the engine never sees the
  Trick.
- **The lock:** `isLockedMove` / `replaceableMoveIds` in `run/progression.ts` guard `grantMove` and
  both replace lists. The face's row wears a *Motley's Trick* tag over its name.

A future "Copycat" innate (becomes the last move an enemy used) would reuse the metamorphic slot
with a different source.

---

## 2. Game-breaking innates

The bar: **each one changes what the player does on their turn or on the map**, not a number on
the sheet. Each sits on a hero whose fantasy it is. Engine cost: **●** data on existing verbs,
**◐** one new generic verb, **○** a real engine feature.

**Gilded Mane (Aurum) is BUILT:** `PassiveDefinition.goldStatGrants`, +5 Attack and +5 Defense per
50 gold (per 25 at Mastery 10), read off `SquadPlacement.gold` at fight build and off `gold` on
every run sheet. **Open:** the AI holds no gold, so an enemy Aurum fights bare; it may want a
stand-in figure.

**The rest are PROPOSED, not decided:**

| Hero | Innate | What it does | Why it breaks the game | Cost |
| --- | --- | --- | --- | --- |
| **Marrow** (Shadow caster) | **Blood Price** | Has no Mana. Every move is paid in **HP, 1 for 1**. Heals refill the tank. | Rest is dead, mana nodes are dead, and the heal-forbidden moves become fuel. The Mana Well becomes a trap pick *for him alone*. | ◐ `paysInHp` read in `resolveManaCost`. Mana re-priced into HP on the 550 (a Burden check: §6). |
| **Jinx** (black cat) | **Nine Lives** | Starts the run with **9 lives**. Each KO spends one, and she stands at 1 HP instead. At 0 she is gone from the run, the companion's rule. | The only hero who *can't* be KO'd, until she can't be saved at all. | ◐ `enduresOnce` with a run-scale counter (`lives`). Reuses `mortal`. |
| **Mellow** (capybara) | **Everyone's Friend** | Every single-target enemy move is redirected to Mellow, always, like a permanent Follow Me. | VGC's strongest support verb with no cost to declare. | ● the class redirect verb, held passively. |
| **Morel** (mushroom) | **Contagion** | When any Poison ticks, the **other combatant beside the holder** is Poisoned for the same amount, on either side. Morel is immune. | Status becomes a weather system. Your own heroes catch it too. | ◐ a `triggerSubjectPartner` target. |
| **Totem** (ancestor pole) | **Never Walks** | **Cannot take the field**. Can't lead, be switched in, or be KO'd. On the bench, each round end it heals both actives on the heal formula. | A sixth hero who is all bench. Lock-in and the lead pick read differently around it. | ◐ `cannotSwitchIn`, read by `placeLeads` and `canSwitchIn`. |
| **Trove** (mimic chest) | **Devour** | On a finishing blow, it may **keep one of the fallen's moves**, offered replace-or-decline at fight end, for the run. | A third move faucet that runs on kills. | ◐ a post-fight offer source beside the schedule. |
| **Abacus** (calculating engine) | **Recalculate** | Once per fight, when an ally is KO'd, **the round is undone**: the board returns to its start and both sides re-declare. | A literal rewind; resolution is a pure state transform, so a snapshot is free. | ○ snapshot at `RoundStarted`, a rewind event and a view beat. |
| **Whirr** (hummingbird) | **Overclock** | **Acts twice a round** and loses 10% max HP at each round end. | Two declarations a turn is the hardest rule in doubles to break. | ○ two actions per combatant. The most expensive item here. |

**Mastered (+) sketches:** Blood Price+ heals overfill to Shield; Nine Lives+ +3 lives; Everyone's
Friend+ Mellow takes half; Contagion+ spreads Burn too; Never Walks+ also Renews; Devour+ any KO on
the field; Recalculate+ twice; Overclock+ 5%.

**Recommended next:** Mellow and Jinx (● and ◐). Recalculate and Overclock want their own docs.

---

## 3. The event expansion

### 3.1 The vocabulary

| kind | does | status |
| --- | --- | --- |
| `choice` | Two or three options plus an implicit Leave, each its own outcome. | **Built** |
| `gamble` | A stated chance, the other branch a stated cost, both shown before the tap. | **Built** |
| `recruit` | Heroes from a filter (`types`, `heroIds`) off the deck; one joins **raw at par**. At the cap, someone leaves. | **Built** |
| `curse` | Marks a hero with a curse (§3.3). Replaced the proposed `retype` and `masteryOverride`. | **Built** |
| costs: `gold`, `woundAll` | Paid as the outcome resolves. Replaced the proposed `wound` kind. | **Built** |
| `innateSwap` | Two heroes trade innates for the run. | Not built — Soul Swap |
| `terminate` | A hero leaves, as the price of something. | Not built — the Altar's sacrifice, Martyr's Vow |
| `delayed` | An outcome that pays N fights later. | Not built — Roc's Egg, Frozen in Time |

The rule from `events.md` §1 still holds: the screen branches on `kind`, never on an event id.

### 3.2 The slate

The built slate (26 events) is in `src/data/events.ts` and `docs/events.md`. Several built events
took a simpler shape than proposed here — the Slag Bath and Lightning Rod are stat trades, not
retypes; the Whispering Altar teaches rather than sacrifices; the Roc's Nest recruits now rather
than hatching later.

**Proposed and not built**, kept as ideas:

| Event | Outcome | Waits on |
| --- | --- | --- |
| **Soul Swap** | Two chosen heroes trade innates for the run. | `innateSwap` |
| **Doppelgänger** | A copy of one of your heroes joins at its level, its gear left behind. | — |
| **The Wager** | One worn item: 50% it goes up a tier, 50% it's gone. | — |
| **Fountain of Youth** | A hero's XP returns to level 1's, and every growth grade steps up one for the run. | — |
| **The Mirror Pool** | Copy one hero's move onto another. | — |
| **Whispering Altar's sacrifice** | Sacrifice a hero; every other hero takes its XP. | `terminate` |
| **The Tongue-Eater** (Blighted Shrine) | Forget a move, learn a Shadow move. | — |
| **Overpressure** (Molten Foundry) | Two items merge regardless of family. | — |
| **Baptism** (Holy Sanctum) | Strip a hero's Burden, and its +60 with it. | — |
| **Martyr's Vow** (Holy Sanctum) | A hero is spent, and every other hero is whole and Blessed. | `terminate` |
| **Lucid Dream's re-choice** (Dreaming Spires) | Re-choose one hero's Evolution path. | — |
| **The Sleeper Wakes** (Dreaming Spires) | Rewire Attack ⇄ Intelligence. | — |
| **Roc's Egg** (Thunder Aerie) | Hatches three fights later into a mortal companion-like Storm spawn. | `delayed` |
| **Updraft** (Thunder Aerie) | A hero acts first in its bracket for the next fight. | — |
| **Frozen in Time** (Frozen Reach) | A hero sits out the rest of the act, then returns +2 levels and +2 Mastery. | `delayed` |
| **Thawed Champion** (Frozen Reach) | A Frost or Stone recruit joins *finished* (a contract's terms). | — |

### 3.3 Werewolf Bite

**As built** (2026-10-03, per user direction: "the full transformation doesn't happen until
Mastery 5, instant if the hero is already there", and a 650 body). This supersedes the proposal's
bite-retypes-now shape, in which the bitten hero lost STAB at once and Turned at pip 10.

- **The bite only MARKS.** A `curse` outcome writing `RosterEntry.curseId`; a marked hero is exactly
  itself. **Weight 5, ungated.**
- **The Turn** comes at the curse's pip, 5 (`data/curses.ts` `turnAt`), raised as a beat by
  `masteryFlow` on whatever screen landed the pip, ahead of the Evolution the same pip opens. A
  hero already past the pip Turns on the bite. The beat sets `curseTurned` (`run/curse.ts`), and
  everything reads that flag:
  - **typing:** mono-Beast in both slots (`rosterEntryTypes`, `Combatant.typeOverride`); the graft
    is suppressed — the one named exception to the immutable primary;
  - **body:** `curseStatDelta` replaces the base line with the Werewolf's **650**
    (220 / 130 / 75 / 15 / 60 / 100 / 50), with the levels already rolled kept on top;
  - **innate:** Lycanthrope, a finishing blow heals ⅕ of max HP; ⅖ from the tenth pip;
  - **move:** Lacerate is taught at the Turn, replace-or-decline at the cap (a decline still Turns);
  - **art:** `formIdFor` → `art/evolutions/werewolf.png` and its attack and damaged frames, one
    sprite for every Turned hero, since the form belongs to the curse, not the hero.
- **The reveal:** `MasteredInnateOverlay turn`, titled *The Turn*.
- **Saves:** both fields saved; an older save reads uncursed; an unknown curse is refused.
- **A star:** clearing with a Turned hero on the final roster stars the curse once
  (`Profile.curseStars`, `curse:werewolf`), charted under **Curses** on the Constellation's Stars
  page (`CurseStarsSection`), hidden until earned.

**Open:**

- **A Class move** (`typeFollowsUser`) still wears the hero's authored primary, not Beast.
- **The sim's pilot never accepts a curse.**
- **A hero that is already Beast** loses nothing and gains the body — free value. Fine, or exclude
  Beast?

### 3.4 Frequency

With the slate two thirds gated, a Location's eligible pool is roughly 7 general + 3 local. The
`event` weight **16 → 30** takes a run from ~3 offered events to ~5 — an inference, as 16 was. A
rare event sets a smaller `weight` (`DEFAULT_EVENT_WEIGHT` = 10). The original stat events stay as
the floor of the pool.

---

## 4. Build order

1. The event vocabulary — **done** (bar `innateSwap`, `terminate`, `delayed`).
2. Motley — **done**.
3. First-wave innates — **Aurum done**; Mellow and Jinx are the recommended next.
4. Werewolf Bite — **done**.
5. The Location slate — **done** for the 26; the rest of §3.2 is unbuilt.
6. **A sim pass** on the innates (`--workers 2`). **Not run.**
7. Recalculate and Overclock, each as its own doc.

---

## 5. Tensions worth naming

- **Every new innate makes its hero a build-around.** The north star is "no trap pick". A hero like
  Totem (never fields) or Marrow (no mana) is a trap in the wrong deck, and the deck rule means you
  won't always get the deck around them.
- **A hero that is mostly an innate** (Motley, Totem) is hard for the sim to pilot well. Its numbers
  will under-read.
- **Thematic recruits compete with contracts.** A contract is free and finished, a recruit event
  raw. If the recruit event is not *thematic*, it is a worse contract.
- **Retyping is permanent identity loss.** That is why it's an event, and why it's rare.

---

## 6. Invariants this reverses

| Invariant (CLAUDE.md) | Reversed by | Status |
| --- | --- | --- |
| "A hero's **innate primary type is immutable**." | Werewolf Bite's Turn. | **Reversed** — CLAUDE.md names the curse as the one exception. |
| The 550 budget (and the Burden is the one hero over it) | The Werewolf's 650 line. | **Reversed** — named in CLAUDE.md. |
| `docs/innate-passives.md` §6: an innate is "never chosen, rerolled or sold". | Soul Swap. | Proposed |
| `docs/events.md`: Recruit Contracts, gold and Mastery are **not** event outcomes. | the `recruit` events (built); Frozen in Time's +2 Mastery (proposed). | Partly |
| "A move's slot is the player's" (implicit). | Motley's Trick (`isLockedMove`). | **Reversed** |
| The roster HP range 180–250. | Motley at 170. | **Reversed** |
| The Burden is **Bellows alone** (pinned by `test/roster`). | Blood Price and Never Walks are arguably costs: either they come in +60, or they are ruled verbs, not Burdens. | Open, with the proposals |
| "No Evolution path ever replaces the innate." | Not reversed: the Werewolf comes off an event, not a path. Noted because it reads close. | — |
| `docs/mastery.md` §5b: pip 10 masters the innate. | The Turned hero's pip 10 masters Lycanthrope instead. | **Reversed**, per entry |
| Lock-in counts KOs; the whole roster fields. | Never Walks. | Proposed |
