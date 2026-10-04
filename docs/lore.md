# lore.md — The Pact, the Seal, and the Endbringer

> Module of the Titanpact `/docs` suite. Companion to `locations.md` (the places),
> `run-loop.md` (which owns the finale as *structure*), `titan-eyes.md` (the finale fight)
> and `combat.md` (which owns the Pact Clock as *mechanism*). This doc owns the layer
> none of them do: **what the run is about**, and which existing mechanics are already
> saying it.
>
> Signed off 2026-09-05, per user direction. It is deliberately written *after* the
> systems rather than before them — almost everything below is a reading of something
> already in the game, not an addition to it. **The fiction has not been re-counted for four
> acts** (2026-10-02): where it says five seals broken and one shut, the game now breaks four
> and leaves two of the base six shut (§5).

---

## 1. The premise in four sentences

A **Titan** cannot be killed. It can only be **bound**, and only to something that has
already put it on the ground — binding is mutual, so the Titan gets a leash and the world
gets a hand on the other end. The last binding is failing. A player's run is the journey
to break what remains of it on purpose, so that the thing behind it comes out facing
someone rather than facing nobody. **What comes out is the Titan's Herald** (2026-09-16,
per user direction): a Titan does not walk through a breach, it sends its hand and its
voice ahead of it, and the Herald is both. Putting the Herald on the ground is putting the
Titan on the ground in the only sense the Titan has — which is why a pact can be sealed
with something that never takes the field.

> *It is coming out either way. The only question is whether anything is holding the
> other end.*

An unbound Titan is not malicious. That is the point of the fiction and the reason the
game is not about a villain: a Titan ends humanity the way a season does. There is nobody
to reason with, only something to be bound to.

## 2. The Ancient half is the seal

This is the load-bearing idea, and it is a **reading of the type chart**, not an invention.

`src/data/typechart.ts` makes Ancient a pure defensive wall: every attacker row carries
`Ancient: 0.5`, and Ancient's own attacker row is deliberately empty. `locations.md`
already noticed the consequence — every Guardian is authored **X/Ancient**, so
nothing on the board is ever super-effective against one.

The fiction is that the Ancient half is not the champion's **nature**. It is its **duty**.

The last pactbearers bound the Endbringer by grafting six wardens into the binding, and
the Ancient in each of them is the piece of the lock it carries. That is why an Ancient
attack hits nothing especially hard: a seal is not a weapon. And it is why everything is
resisted: a seal is only ever a wall.

Three things fall out of this at no cost:

- **The Guardians are what the wardens decayed into.** The Manticore, Yugzulach, the
  Kraken, the Elder Bough, the Dragon and the Skeleton King are six wardens after an
  age of holding the seal — a garrison that no longer remembers what it is guarding, only
  that nobody gets past. They are not evil and they are not wrong. They are a garrison that
  outlived its briefing. **What stands around them is the leak.** The binding is failing
  (§3), and what comes through a failing seal takes the colour of the land it comes through
  into: the **Titanspawn** (`docs/titanspawn-overhaul.md` §2), one line per mortal type,
  small where the seal still mostly holds and grown where it is almost gone. A spawn is not
  a people. It is the Titan's weight, felt before the Titan. **And a Guardian looks like its
  brood** (2026-09-16, `titanspawn-overhaul.md` §2 "Guardian art"): geometry in its mortal
  type's colour, with the Titan's eye in it.
- **The run is a sacrilege, deliberately.** Every Guardian broken is a lock broken. The
  player is not clearing dungeons; they are dismantling the thing keeping the world
  shut, because it is coming apart anyway and an accident is worse than a decision.
- **A champion is the hardest fight in its act for a reason the player can feel.** It is
  not a difficulty tier. It is a load-bearing wall.

## 3. The Pact Clock is the binding coming apart

`combat.md` locked the Pact Clock as a stall terminator and wrote one line of fiction for
it — *"the pact comes due on everyone who showed up."* That line is now the whole cosmology.

The binding leaks. Any engagement that runs long enough starts taking the Titan's weight
through the failing seal, which is why from round 30 **every combatant on the field, both
sides**, loses an escalating fraction of max HP, and why it is direct HP loss that no
Defense, type chart, variance or passive can touch. It is not an attack. It is the world's
condition arriving on schedule. **The bench is out of the leak** (2026-09-13,
`titanspawn-overhaul.md` §6): what stands in the seal's draught takes its weight; what
stands behind the line does not, yet.

Two properties the mechanic already has become fiction for free:

| Mechanic (locked in `combat.md`) | What it means |
|---|---|
| Hits **both sides** | Nobody is on the Titan's side. It has no allies, only a leash. |
| **No passive-reaction pass** — the terminator is not a trigger source | There is nothing to react *to*. It is not a source, it is a condition. |

The same countdown runs at three scales: the fight, the run, and the world.

## 4. Small pacts, and one large one

The draft screen already says **Seal the Pact** and fills **pact sockets**
(`visual-language.md`). Read literally, that is correct: binding is one rite at every
scale, and a hero joining the player's roster is that rite performed small. A Recruit
Contract is a pact. A Guild Hall hire is a pact. The Titan is the last one, and it is the
same shape — you put it on the ground, and it names you.

The player is a **pactbearer**. That is the only thing the fiction asks the player
character to be, and it is deliberately thin: this is a roguelike about a team, and the
heroes are the characters.

## 5. The five seals, and the sixth

The arithmetic already closes, and the fiction takes it as given rather than arranging it.

**As built (four acts, 2026-10-02):** there are **six** base seal locations. Act 1 is always
Wild's Edge, and acts 2–4 each pick one of two drawn from the rest (`locations.md`), so **every
run breaks four seals and leaves two of the base six shut** — more if it stood in a bought
Location (`unbrokenSealLocationIds`, `src/run/locations.ts`). The fiction below was written for
five broken and one shut and has not been re-written; read "the sixth" as "the seals that held".
The Champion screen already says "The last two held".

- The seals you broke are why the Herald walks.
- **The sixth is why it is only the Herald.** One warden held. The binding failed at five
  points out of six, and a breach five-sixths open is wide enough for the Titan's hand and
  not for the Titan — the seal the player never reached is the difference between "the
  Herald is through" and "the Titan is loose *and nothing is holding it*". It is why there
  is a world left at all.

Which location that is changes every run, and the player is told which one it was. This is
the natural anchor for `progression.md`'s light meta-progression: the unbroken seal is the
thread between runs, and the reason the world survives to be run again.

## 6. The finale, and why the Guardians come back weaker

**Superseded 2026-09-17/18** (`titan-eyes.md` §10, `run-loop.md` §4): the shipped finale does not
field the broken Guardians. The Herald leads one Late Titanspawn per broken seal — what the lands
turned — then the Eyes (§7). A Guardian's win is still snapshotted as a `BrokenSeal` (its act,
Location and the power it was beaten at), and the old path that rebuilds each champion UNSEALED
— its Ancient half dropped, because the Ancient *was* the seal and the player already took it
(`unsealedIdFor`, `src/data/enemies.ts`) — remains in `generateFinaleEncounter` only as the
fallback when no escorts are passed.

The fiction it carried still holds: breaking a Guardian breaks its ward, and what stands up
afterward is just the beast that was carrying it.

## 7. The Endbringer

**The Endbringer is the Titan's Herald, not the Titan** (2026-09-16, per user direction —
it was written as the Titan itself until then, and the figure drawn for it was a colossus;
both were wrong in kind). **Endbringer is not its name.** It is what the wardens called what
came through the breach, and the word outlived everyone who knew what it referred to. The
Titan has no name, and never takes the field.

The Herald is the Titan's hand and its voice: it walks ahead of the thing it announces and
carries the thing's eye on its banner (`titanspawn-overhaul.md` §2 "Guardian art" — the
standard-bearer, the five broken seals threaded on its pole). It is mono-**Ancient**: it
resists everything and is super-effective against nothing, the correct silhouette for the
one piece of the Titan that stands where it can be struck. It stands at the front of its fight
from the first round, and what walks behind it is what the five lands turned — one Late
Titanspawn a seal (2026-09-17; until then the five wardens returned unsealed ahead of it and it
came last).

The Herald is the part of the Titan that *walks*. **The Eyes are the part that *looks***
(`titan-eyes.md`, 2026-09-16): with the Herald down the Titan turns to see what did it, and
its two Eyes open over the Threshold — the sixth seal holds the body where it is, and does not
stop it looking. Both can be put down; nothing else of a Titan can. Winning is putting the Eyes
out — making it look away — and that *is* the pact. Binding is mutual and is offered to whoever
has already put the Titan down, and a Titan is on the ground when it has been made to look
away. The run ends with a Titan on the player's leash, asleep again for a thousand years if the
seals are kept, its Herald broken and its Eyes closed at the Threshold, and five holes in the
world where the wardens used to be.

**The win is reduction, not survival.** A Titan cannot be reduced to 0 HP, which is why survival
once read as the better fiction — but a Herald and the Eyes can, so reduction is the right win.

## 8. What the fiction constrains

Not much, on purpose — but these three are now load-bearing and should be flagged rather
than quietly broken:

1. **A Guardian is Ancient-second.** Every one is, and `locations.md`
   already calls this a convention. It is now a *rule*: the Ancient half is the seal, so a
   champion without one is a champion that is not part of the binding. Every new location —
   the four bought ones included — has an Ancient-second champion, or it is not a seal.
2. **Ancient stays a defensive-only type.** `typechart.ts` already carries a comment
   telling the reader to keep the attacker row empty. The fiction is now the second reason:
   a seal is not a weapon.
3. **Nothing that is not a piece of the Titan is mono-Ancient.** The Herald and the two Eyes
   are; nothing else is. An ordinary hero or mob with the full wall would read as a third.

## 9. Open, and deliberately so

- **How much of this the player is ever told.** What exists: the first-run lore card (four lines,
  `LoreScreen`, `docs/tutorial.md`), the act intro (`ActIntroScreen`), the Pact Seal screen, the
  finale's three beats (`HeraldScreen`, `TitanRiseScreen`, `TitanBoundScreen`) and the champion's
  hall. The house style — one line of flavor per surface, no exposition — argues for keeping it
  that way. Whether anything more is wanted is open.
- **What the player character wants.** Deliberately unspecified. "Pactbearer" is a role,
  not a person, and the heroes are where the characterisation budget goes.
