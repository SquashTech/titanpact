# Wild Innates and the Event Expansion

**Status: PROPOSED, 2026-10-02** (per user direction). §6 names every locked rule a piece of
it reverses; none of them moves until it is decided.

**Decided 2026-10-03, per user direction:**

- **Werewolf Bite is mono-Beast in both slots.** It reverses the immutable primary for that
  one entry; the graft is suppressed.
- **The bite also teaches a decent Beast move,** so the bitten hero has STAB from the day it
  is bitten, not only from the Turn.
- **Motley's re-base stands as proposed:** 170 / 50×5 / 130, grades C / B×5 / A.
- **The first innate wave is Motley and Aurum (Gilded Mane).** The other seven stay
  proposals.
- **Build order is §4:** the event vocabulary first.

**Phase 1 is IN (2026-10-03):**

- **New outcome kinds:** `choice`, `gamble` and `recruit`.
- **Costs:** gold and `woundAll`.
- **Event weights.**
- **Nineteen new events,** every Location covered. The map's `event` weight went 16 → 30.

`docs/events.md` is the reference.

**Phase 2 is IN (same day): Motley's Trick**, exactly as §1 has it.

- **New schema words:** `MoveDefinition.metamorphic` / `permanent` and
  `PassiveDefinition.metamorphicFaces`.
- **The roll:** `resolveMetamorphicFaces` in `engine/state.ts`, derived like Jackpot's.
- **The swap:** `run/metamorphic.ts` `kitForRound` swaps the face in at the kit, the one place
  it happens. The move buttons, the Rest check and the AI all read it. The engine never sees
  the Trick.
- **The lock:** `isLockedMove` / `replaceableMoveIds` in `run/progression.ts` guard `grantMove`
  and both replace lists.
- **Motley's line:** 170 / 50×5 / 130, grades C / B×5 / A, kit Trick + Psi Bolt.
- **The face's row** wears a *Motley's Trick* tag over its name.

**The first innate wave is IN: Gilded Mane** (Aurum, replacing Blazing Mane).

- `PassiveDefinition.goldStatGrants` grants +5 Attack and +5 Defense per 50 gold, or per 25 at
  Mastery 10.
- It is read off `SquadPlacement.gold` at fight build, and off `gold` on every run sheet.
- **The AI holds no gold, so an enemy Aurum fights bare.** Flagged: it may want a stand-in
  figure.

**Werewolf Bite is IN** (§3.3, as decided).

- **The outcome:** a `transform` kind on one chosen hero.
- **The curse:** `RosterEntry.typeOverride` (both slots, read by `rosterEntryTypes` and, via
  `Combatant.typeOverride`, by `effectiveTypes`).
- **The move:** Lacerate is taught, replace-or-decline at the cap.
- **The Turn:** `RosterEntry.masteryOverride` (Lycanthrope, form `werewolf`, read by
  `innatePassiveIdsFor` / `masteredInnateFor` / `formIdFor`). Every portrait reads
  `formIdFor`.
- **Saves:** both fields are saved, and an older save reads uncursed.
- **Weight 5, ungated.**

Open on it:

- **The werewolf sprite does not exist yet.** `art/evolutions/werewolf.png` plus its attack and
  damaged frames plug in with no code. Until then a turned hero wears its own art.
- **A Class move** (`typeFollowsUser`) still wears the hero's authored primary, not Beast.
- **The sim's pilot never accepts a curse.**

**Not yet built from §3.1:** `innateSwap`, `terminate` and `delayed`. Their events (Soul Swap,
Whispering Altar's sacrifice, Roc's Egg, Frozen in Time) wait on them.

**No sim pass has been run on any of this.**

Three asks:

1. **Motley's Trick**: Metronome as an innate, with Motley re-based around it.
2. **A handful of game-breaking innates**: verbs that change how a hero is *piloted*, not
   how hard it hits.
3. **Many more events, and wilder ones**: Werewolf Bite, thematic recruits, Location-gated
   events.

What exists today (2026-10-02):

- **Events.** Six events, all ungated (`src/data/events.ts`).
- **Outcome vocabulary.** Four kinds: `learnMove`, `statShift`, `grantPassive`, `loot`.
- **Frequency.** The `event` node weighs 16 of 256 in `REWARD_WEIGHTS`. That is about three
  events *offered* a run.
- **Location gate.** `RunEventDefinition.locationIds` is already wired into
  `eligibleEvents`, but nothing uses it.
- **Engine.** No move transforms into another move, no move slot is locked, no
  `RoundStarted` passive hook exists, and the primary type is never rewritten.

---

## 1. Motley's Trick

> **Motley's Trick** (innate). Motley always carries *Motley's Trick*. It takes one of the
> four slots, and nothing can teach over it. At the start of every round the Trick becomes
> a random move from anywhere in the game: that move's type, mana cost, power, targeting and
> effects, for that round.

### How it plays

- **The roll is visible before you declare.** Pokémon's Metronome is blind; this one is
  not. The command phase shows this round's face: name, type and cost, with the full card
  on a long press. You then decide whether to use it, Rest, or swing a fixed move. That
  keeps the chaos a *read* and not a slot machine, which is the difference between a gimmick
  and a hero.
- **The roll is derived, not stored.** It is `hash(seed, round, combatantId)`, the same
  shape as `resolveRandomBasePower` (Jackpot, `src/engine/state.ts:307`). Engine, view and
  AI all agree, replays are deterministic, and no rng state advances. It resolves inside
  `moveForHero`, so every reader (the price, `isMoveUsable`, the button, the AI) sees the
  rolled move. An enemy Motley works with no AI change.
- **The mana price is the balance.** A Late face in Act 1 is legal; whether it can be paid
  for is the question. That is why the pool is huge (below): a 60-cost Late nuke is one cast
  a fight, a 20-cost Early jab is free.
- **STAB lands only on Mind faces.** Equal Attack and Intelligence mean a physical face and
  a magical face hit identically, which is exactly what you asked for. Neither half of the
  catalog is a dud roll.

### The pool, proposed

"Any other move in the game" is every move in `moves.ts`, **excluding**:

- signatures (one hero's identity);
- class moves (exclusive by invariant);
- the Trick itself.

**Ancient stays in.** Wildcard already includes it, and rolling one of the Herald's moves is
the best story the Trick can tell.

**Open question:** do Rest-like or no-op moves need filtering out? I'd rather find out in
play.

### Mastered (pip 10): *Motley's Trick+*

The Trick shows **two faces and Motley picks one**. This is the "figure doubled" rule
applied to a verb. It is still chaos, but now a hand of two.

### Motley's re-base

You asked for Attack / Defense / Intelligence / Wisdom / Speed all identical, a huge pool,
and weak otherwise. On the 550:

| HP | Atk | Def | Int | Wis | Spd | **Mana** | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 170 | 50 | 50 | 50 | 50 | 50 | **130** | 550 |

- **Mana 130 is the roster's top pool by 35.** The highest today is 95. A spike is how the
  550 signals a specialist, so this reads correctly on the sheet.
- **HP 170 is under the roster's 180 floor.** That is the "weak" you asked for. Flag it if
  the floor is meant to hold.
- **Speed 95 → 50** is the biggest loss. Motley stops being a fast Dazer and becomes a slow
  wildcard, which suits a hero whose turn is decided by the round.
- **Grades, proposed:** HP C, the five combat stats all B, Mana A, which sums to 3 + 20 + 5
  = 28. The identical-five shape holds as he levels instead of drifting apart on the first
  growth roll.
- **Kit:** `['motleysTrick', 'psiBolt']`. Psi Bolt is the reliable attack. The Trick is
  both of the kit's halves at once, so the "one attack and one not" rule is met by
  construction.
- **Slapstick and Pandemonium retire.** The Daze identity moves into the Trick's chaos.

### Engine cost

1. `MoveDefinition.metamorphic: { exclude: ... }`, a move whose resolved definition is
   rolled per round.
2. `PassiveDefinition.lockedMoveId`. The innate grants the move at roster creation, and
   every replace path refuses it:
   - `grantOfferedMove`
   - `MoveOfferOverlay`
   - the Tutor and Mentor screens
   - the event teach screen

   It shows a lock on the move card.
3. The view needs a face that changes: the move button re-renders each round, with a small
   poof as the command phase opens.

That is two engine words, both generic. A future "Copycat" innate (becomes the last move an
enemy used) would reuse the metamorphic slot with a different source.

---

## 2. Game-breaking innates: nine candidates

The bar: **each one changes what the player does on their turn or on the map**, not a number
on the sheet. Each sits on a hero whose fantasy it is. Engine cost is marked:

- **●** data on existing verbs
- **◐** one new generic verb
- **○** a real engine feature

| Hero | Innate | What it does | Why it breaks the game | Cost |
| --- | --- | --- | --- | --- |
| **Marrow** (Shadow caster) | **Blood Price** | Has no Mana. Every move is paid in **HP, 1 for 1**. Heals refill the tank. | Rest is dead, mana nodes are dead, and the heal-forbidden moves become fuel. The Mana Well becomes a trap pick *for him alone*. A Shadow caster that drinks its own life is exactly Marrow. | ◐ `paysInHp` flag read in `resolveManaCost`. Mana is re-priced into HP on the 550 (a Burden check: see §6). |
| **Jinx** (black cat) | **Nine Lives** | Jinx starts the run with **9 lives**. Each KO spends one, and she stands at 1 HP instead (any source, every fight). At 0 she is gone from the run, the companion's rule. | The only hero who *can't* be KO'd, until she can't be saved at all. Her counter is printed on the roster, and it turns every fight into a spend. | ◐ `enduresOnce` with a run-scale counter on `RosterEntry` (`lives`). Reuses `mortal`. |
| **Aurum** (gold lion) | **Gilded Mane** | +5 Attack and +5 Defense for every **50 gold** the run holds, read at fight build. | Gold becomes a combat stat. Every Shop visit is now *spend or keep*, and he is the reason to skip the Anvil. A run economy innate, the first. | ● a derived grant at `buildCombatState`, multiples of 5 kept. |
| **Mellow** (capybara) | **Everyone's Friend** | Every single-target enemy move is redirected to Mellow, always, like a permanent Follow Me. | VGC's strongest support verb with no cost to declare. The partner is untouchable, and the whole fight becomes "kill the capybara first". | ● the class redirect verb, held passively. |
| **Morel** (mushroom) | **Contagion** | When any Poison ticks, the **other combatant beside the holder** is Poisoned for the same amount, on either side. Morel is immune. | Status stops being targeted and becomes a weather system. Your own heroes catch it too. | ◐ a `triggerSubjectPartner` target. `StatusTicked` and `matchTriggerAmount` exist. |
| **Totem** (ancestor pole) | **Never Walks** | Totem **cannot take the field**. It can't lead, can't be switched in, and can't be KO'd. On the bench, each round end it heals both actives on the heal formula (Wis-scaled, Upkeep's exception). | A sixth hero who is all bench. The lock-in rule and the lead pick both read differently around it. It is the first hero you draft for the slot, not the body. | ◐ `cannotSwitchIn`, read by `placeLeads` and `canSwitchIn`. `whileBenched` exists. |
| **Trove** (mimic chest) | **Devour** | When Trove lands a finishing blow, it may **keep one of the fallen's moves**, offered as replace-or-decline at fight end, permanently for the run. | A third move faucet that runs on kills. Trove's kit is whatever it has eaten, and you aim it at the enemy whose move you want. | ◐ a post-fight offer source beside the schedule. The offer UI exists. |
| **Abacus** (calculating engine) | **Recalculate** | Once per fight, when an ally is KO'd, **the round is undone**: the board returns to its start and both sides re-declare. | A literal rewind. It works because resolution is a pure state transform: a snapshot is free, and the view only needs a rewind beat. The most game-breaking card here. | ○ snapshot at `RoundStarted`, a rewind event and a view beat. Engine-cheap, view-heavy. |
| **Whirr** (hummingbird) | **Overclock** | Whirr **acts twice a round** and loses 10% max HP at each round end. | Two declarations a turn is the hardest rule in doubles to break, and the HP bleed is the clock on it. | ○ two actions per combatant in command and resolution. The most expensive item on this list. |

**Each needs a mastered (+) form.** Sketches:

- Blood Price+: heals overfill to Shield.
- Nine Lives+: +3 lives.
- Gilded Mane+: per 25 gold.
- Everyone's Friend+: Mellow takes half.
- Contagion+: spreads Burn too.
- Never Walks+: also Renews.
- Devour+: any KO on the field.
- Recalculate+: twice.
- Overclock+: 5%.

**Recommended first wave:** Motley, Aurum, Mellow and Jinx. Three are ● or ◐, and they cover
a move-level, an economy-level, a doubles-level and a run-level break. Recalculate and
Overclock are the headline acts but want their own pass.

---

## 3. The event expansion

### 3.1 The vocabulary has to grow first

Six events on four verbs can't get wild. Proposed outcome kinds:

| kind | does | needed by |
| --- | --- | --- |
| `choice` | **Two or three options plus Leave**, each its own outcome. Today an event is one outcome and the only choice is *who*. | almost everything risky below |
| `gamble` | An outcome with a stated chance, and the other branch a stated cost. Both shown before the tap. | The Wager, Fae Ring |
| `recruit` | One hero from a filter (`types`, `heroIds`) joins **raw at the act's par**. At the cap, that means terminating. | the thematic recruits |
| `retype` | Overwrites a hero's types for the run (§3.3). | Werewolf Bite |
| `masteryOverride` | Replaces what pip 10 pays for one roster entry. | Werewolf Bite |
| `innateSwap` | Two heroes trade innates for the run. | Soul Swap |
| `wound` | HP off chosen or all heroes, as Wounds (act-scoped). | costs on several events |
| `terminate` | A hero leaves, as the price of something. | Whispering Altar, Siren Song |
| `delayed` | An outcome that pays N fights later. | Roc's Egg |

The rule from `events.md` §1 still holds: the screen branches on `kind`, never on an event
id.

### 3.2 The slate: ~30 events, two thirds Location-gated

**General (any Location):**

| Event | Outcome |
| --- | --- |
| **Werewolf Bite** | §3.3. |
| **Soul Swap** | Two chosen heroes trade innates for the run. |
| **Doppelgänger** | A copy of one of your heroes joins at its level, its gear left behind. |
| **The Wager** | One worn item: 50% it goes up a tier, 50% it's gone. |
| **Mercenary Camp** | Recruit one of three heroes, raw, at par. |
| **Fountain of Youth** | A hero's XP returns to level 1's, and every growth grade steps up one for the run. |
| **The Mirror Pool** | Copy one hero's move onto another. |

**Wild's Edge (Act 1):**

| Event | Outcome |
| --- | --- |
| **Rustling Grass** | A random hero from your deck joins, raw. |
| **Abandoned Camp** | A Revive and a Wound. |

**Blighted Shrine:**

| Event | Outcome |
| --- | --- |
| **Whispering Altar** | Sacrifice a hero. Every other hero takes its XP. |
| **The Tongue-Eater** | Forget a move, learn a Shadow move. |
| **Recruit: The Hermit** | A Shadow hero joins. |

**Forbidden Forest:**

| Event | Outcome |
| --- | --- |
| **Werewolf Bite** | Also the forest's own, at double weight. |
| **Fae Ring** | Gamble: +30 Speed, or −30 HP. |
| **Recruit: Dryad's Call** | A Nature hero joins. |

**Molten Foundry:**

| Event | Outcome |
| --- | --- |
| **Slag Bath** | A hero gains Iron as its secondary, replacing the graft. |
| **Overpressure** | Two items merge regardless of family. |
| **Recruit: Automaton Kit** | A Mech hero joins. |

**Storm Coast:**

| Event | Outcome |
| --- | --- |
| **Lightning Rod** | Storm secondary. |
| **Siren Song** | A Water hero joins, and a random hero leaves. |
| **Shipwreck** | Loot 3 and a Wound to all. |

**Necropolis:**

| Event | Outcome |
| --- | --- |
| **Lich's Bargain** | The hero endures once every fight, but no move can heal it. |
| **Grave Robbing** | Loot, and one hero comes back *down*. |
| **Recruit: Raise Dead** | A Spirit hero joins. |

**Holy Sanctum:**

| Event | Outcome |
| --- | --- |
| **Baptism** | Strip a hero's Burden, and its +60 with it. |
| **Martyr's Vow** | A hero is spent, and every other hero is whole and Blessed. |

**Dreaming Spires:**

| Event | Outcome |
| --- | --- |
| **Lucid Dream** | Re-choose one hero's Evolution path. |
| **The Sleeper Wakes** | Rewire Attack ⇄ Intelligence. |

**Thunder Aerie:**

| Event | Outcome |
| --- | --- |
| **Roc's Egg** | Hatches three fights later into a mortal companion-like Storm spawn. |
| **Updraft** | A hero acts first in its bracket for the next fight. |

**Frozen Reach:**

| Event | Outcome |
| --- | --- |
| **Frozen in Time** | A hero sits out the rest of the act, then returns +2 levels and +2 Mastery. |
| **Thawed Champion** | An old hero, a Frost or Stone recruit, joins *finished* (a contract's terms). |

### 3.3 Werewolf Bite

> A chosen hero is bitten. **It becomes mono-Beast**, whatever it was. At **Mastery 10** it
> no longer masters its innate: it **turns**. It becomes a Werewolf, with a new body, a new
> innate and a new move.

**The cost is real.** A bitten Fire hero's Fire moves lose STAB the moment it is bitten,
and its chart flips to Beast's. The curse is a trade until pip 10 pays it back. That is what
makes the event a decision and not a gift.

**Pip 10, the Turn.** `masteryOverride` replaces `masteredPassiveIds` on that entry with:

- **Lycanthrope**, an innate: flat statGrants (proposed +40 Attack, +20 Defense, +20 Speed,
  multiples of 10) plus "a finishing blow heals 20% max HP". It replaces the innate, as a
  mastered innate does.
- **Moonrend**, a move: Beast physical, Late power. It is granted replace-or-decline at
  `MOVE_CAP`.
- **The form.** The portrait reads a form id through the same `pathId` channel Evolutions
  use (`HeroPortrait.tsx:36-46`), so `art/evolutions/werewolf.png` with its attack and
  damaged frames plugs in with no new lookup.

**Art.** One shared Werewolf sprite with three poses, not a werewolf per hero. A form that
belongs to the curse, not the hero, reads as *the same thing happened to them*. Your
PixelLab pause until the 17th matters here: the code can land against a placeholder.

**Open questions:**

- **What happens to an Evolution's graft?** Proposed: the override wins both slots. The path
  keeps its move and passive and loses its type.
- **A hero that is already Beast** loses nothing to the bite and gains the Turn. Free value.
  Is that fine, or does the event exclude Beast?
- **A bite at Mastery 10 already** turns on the spot.

### 3.4 Frequency

With ~30 events, two thirds gated, a given Location's eligible pool is roughly 7 general + 3
local. Raising the `event` weight **16 → 30** takes a run from ~3 offered events to ~5. Add
`weight` to `RunEventDefinition` so Werewolf Bite and Soul Swap can be rare. This is an
inference, as 16 was.

**The four existing stat events** (Soul Transfer, Deep Well, Assertiveness Training, Loot
Pile) stay as the floor of the pool.

---

## 4. Build order, proposed

1. **The event vocabulary.** `choice` and `weight` first: everything risky needs them. Then
   `recruit`, `wound` and `terminate`.
2. **Motley.** `metamorphic` and `lockedMoveId`, the re-base, the view face.
3. **First-wave innates:** Aurum, Mellow, Jinx.
4. **Werewolf Bite.** `retype`, `masteryOverride`, form art (placeholder until the PixelLab
   refill).
5. **The Location slate,** a Location at a time.
6. **A sim pass** on the innates (`--workers 2`). Directional, per standing practice.
7. Recalculate and Overclock, each as its own doc.

---

## 5. Tensions worth naming

- **Every new innate makes its hero a build-around.** The north star is "no trap pick". A
  hero like Totem (never fields) or Marrow (no mana) is a trap in the wrong deck. The deck
  rule (three a type, drafted one a row) means you won't always get the deck around them.
  That is the risk to watch.
- **A hero that is mostly an innate** (Motley, Totem) is hard for the sim to pilot well.
  Its numbers will under-read.
- **Thematic recruits compete with contracts.** A contract is free and finished, a recruit
  event raw. If the recruit event is not *thematic* (a type you can't otherwise reach this
  act), it is a worse contract.
- **Retyping is permanent identity loss.** Pokémon never does it to a species. That is
  exactly why it's an event, and why it's rare.

---

## 6. Invariants this would reverse

| Invariant (CLAUDE.md) | Reversed by |
| --- | --- |
| "A hero's **innate primary type is immutable**." | Werewolf Bite (`retype`), and Slag Bath / Lightning Rod if they touch the primary (proposed: secondary only). |
| `docs/innate-passives.md` §6: an innate is "never chosen, rerolled or sold". | Soul Swap. |
| `docs/events.md`: Recruit Contracts, gold and Mastery are **not** event outcomes. | the `recruit` events, Frozen in Time (+2 Mastery). |
| "A move's slot is the player's" (implicit: every replace path is unguarded). | Motley's Trick, `lockedMoveId`. |
| The roster HP range 180–250. | Motley at 170. |
| The Burden is **Bellows alone** (pinned by `test/roster`). | Blood Price and Never Walks are arguably costs. Either they come in +60, or they are ruled verbs, not Burdens. |
| "No Evolution path ever replaces the innate." | Not reversed: the Werewolf comes off an event, not a path. Noted because it reads close. |
| `docs/mastery.md` §5b: pip 10 masters the innate. | the Werewolf Turn, per entry. |
| Lock-in counts KOs; the whole roster fields. | Never Walks (a hero who can't be KO'd and never fields). |
