# gear-absorption.md — Gear is absorbed: assign on receipt, never unequip

> **STATUS: DECIDED 2026-09-15 (per user direction); PHASES 1–2 OF §8 ARE IN, 3–4 OWED.** `CLAUDE.md`,
> `docs/equipment.md` and `docs/progression.md` describe the game in force wherever a §8 phase has
> not landed; §8 is the route and §9 the list of sign-offs each phase spends — **check its Status
> column before assuming anything here is live.** The supply figures in §5 are measured; every
> other number is a first pass.

---

## 0. Why this exists

Every reward in the run resolves at the node, in one gesture — Boon, Forge, Mentor, Tutor, Mana
Well, Scribe, Crucible: pick a thing, pick a hero, move on. Equipment was the one reward that
did not. A drop went to a bag, a badge lit on the map's Roster button, and the player left the
map — the forward line of the run — to open a management screen, read a stat table, and decide
where the item went, what it displaced, and where THAT went. That screen was the last piece of
homework in a run the rest of which had been streamlined for fun-per-minute.

The history in `progression.md` explains how it got there. Items were first resolved on the spot
(equip or trash), which cascaded — a displaced item re-queued — and demanded a compare against
what was held. The bag fixed the cascade by deferring everything, and moved the cost into an
inbox. Both shapes were paying for the same thing: **an item coming OFF a hero.** Remove that and
there is no cascade, no bag, no compare against what is held, and no reason for a screen the
player has to remember to open.

The player's own read, which decided it: they were already doing a who-screen per item — they
just had to open it themselves, every time, through the Roster button. Making the screen automatic
reads as more screens and is fewer.

---

## 1. The rule this reduces to

**An item is absorbed by the hero it is given to, the moment it is received, and never comes off.**

Everything below follows. A hero has three sockets, always; an item fills one for the run; there
is nothing to swap, nothing to carry, nothing to sell later. The only question an item ever asks is
*who* — and a duplicate asks *deepen or widen*.

---

## 2. The who-screen

Every item arrives on one screen — the Forge's grammar (`HeroPickGrid`), which every who-screen
in the run shares: the item at the top, the roster below, a tap seats it and the run moves on.

Each hero's card says what a tap would do, and it is one of three things:

- **Take** — a free socket, no item of this family held. The item lands in the socket.
- **Merge** — the hero already holds this family. The held piece rises a tier (§3), the drop is
  consumed. The card reads the tier it would become.
- **Nothing** — three sockets full and no family match, or the family held at Mythic. The card
  is disabled and says so.

A fourth button, **Sell**, is always there at `sellValueFor` — the one "decline" the system has,
so a Wisdom piece dropping on six physical attackers never has to eat a socket for the run. When
NO hero can take the item at all, the screen is skipped and the item converts to gold on the
spot; the victory overlay or cache reveal has already shown it, so nothing is hidden.

**Where it fires.** After a fight, first in the post-fight chain behind the level report — the
fight's own consequence, ahead of the Banner and everything under it. On the Equipment Cache,
after the 1-of-3 pick. On a Loot Pile event, once per item, in sequence. Never from the Guild Hall
(§6). A contract hero arriving with a piece (§7) does not raise it — the piece is already on the
hero.

**Numbers are hidden at the decision.** The card shows the family glyph, the tier pips and the
enchant; the item's stat line is on the item card at the top, once. The full compare — what this
hero's sheet becomes — is a long-press preview, as on every who-screen. The monotonicity rule
(`equipment.md` §3) is what makes this honest: a higher tier of the same family is strictly
better, so the only real question is a family-to-hero fit, which is an identity read, not a
numbers read.

---

## 3. Merging is a tap on the holder

A same-family drop given to the hero holding that family **merges**: the held piece becomes
**one tier above the higher of the two**, and the drop is gone. Held Common + dropped Epic is a
Legendary; held Epic + dropped Common is a Legendary too. Never a downgrade, never a question
about which input survives, and a duplicate of any tier is always good news.

- **The enchant is the held piece's if it has one, otherwise the drop's.** One rule, no screen.
  The Enchanter is where an enchant is changed on purpose.
- **The act window does not cap a merge.** It capped the Anvil and the bag-merge because gold and
  patience could climb past it; a merge is now a finite roll of the drop table meeting a finite
  roster, and cannot be bought or hoarded. The window still caps what DROPS and what the Anvil
  lifts to.
- **Mythic has nothing above it**, so the holder of a Mythic is not a target for that family.
  A Unique has no ladder and does not merge.
- **The player chooses.** A Common Spear against a roster holding a Rare Spear on Cinder and an
  empty socket on Fang is *Cinder to Epic* or *Fang gets a Spear*. Deepen or widen — that is the
  build decision, and it arrives on the same tap as every other item.

The bag-merge (`mergeFromStash`, the pair picker, the Merges Ready label) is deleted with the bag.
`MergeBurst` is promoted from a bag animation to the who-screen's merge beat.

---

## 4. Three sockets, always

`BASE_ITEM_SLOTS` = 3 = `MAX_ITEM_SLOTS`; `RosterEntry.bonusItemSlots` is deleted from the schema;
`itemSlotsFor` returns the constant. **The Forge is deleted** — the node, the screen, the tutorial
row — and the Blacksmith's slot sale with it.

The 2026-09-06 argument for one slot was dilution: an item that is a third of a hero's gear is a
third of a rounding error. That argument was about slot scarcity making an item matter. Here
**permanence** is what makes it matter — the socket is spent for the run — and **supply** (§5)
is the dial, which is a better dial than slot count: the Forge's 38 weight in the reward pool was
the scarcest, most compounding, most dead-able node on the map, and the mirror-match measurement
that a second item is worth 79% was the reason nobody could author a per-hero slot count. Uniform
sockets close both.

Eighteen seats against ~16 items a full run (§5): the overflow-to-gold case is rare and reached
only by a player who never merges, which is what makes merging the thing that keeps a roster
open.

---

## 5. Supply — measured, and the dial

Items a completed run obtains today, by source (3000 runs, skilled pilot, `sim-out/items-baseline`):

| Act | fight drops | Cache node | Loot Pile | **no Guild Hall** | Guild Hall shelf |
|---|---|---|---|---|---|
| 1–5, each | ~2.7 | ~0.5 | ~0.1 | **~3.3** | ~0.2 |
| run | 13.4 | 2.5 | 0.5 | **16.4** | 1.1 |

Fight drops are 82% of it — the three fights an act pay 1.0 / ~0.7 / 0.95 (`EQUIPMENT_DROP_CHANCE`).
The shelf added about one item a run under the pilot, so deleting it moves supply by ~7%.

With 16 families, ~16 draws land on ~10 distinct families and ~6 repeats, so a run offers about
six merge decisions; always-merge uses ~10 seats, never-merge all 16. Sixteen who-screens a run,
against 29 move offers and ~2 Boons.

**The dial is fight drops, not the Cache.** A drop after nearly every fight is a drop that stops
reading as an event. The first-pass proposal for phase 4: the Guardian always drops, the Elite
always, the Skirmish half the time, the opener never — ~2 a fight-act, ~12–13 a run, every drop
from a fight that earned it. The Cache is the deliberate faucet (the player picks a family) and
takes the Forge's seat weight. Decided by playtest, not here.

---

## 6. One Guild Hall

The Blacksmith is folded back into the Guild Hall and the funnel is **forced** — one node wide
in every act, as acts 1–2 already were. The Guild Hall keeps people (hires, contracts), Scrolls,
potions and the mend, and gains the **Anvil** and the **Enchanter**, both over held gear only. It
loses the item shelf and the Sell section: nothing is loose to sell, and the shelf was the reason
the screen read as analysis paralysis (per user direction) — four items against a roster is a
compare, and compares are what this doc deletes.

The 2026-09-08 one-verb-per-node split was made because people and gear on one screen read as a
chore hub. The merged node holds FEWER verbs than the two did combined — the shelf, the sale and
the slot purchase are gone — so it is worth a look, not a rule.

**Gold.** Two sinks go (items, slots), one faucet arrives (overflow and Sell). The player's
playtest read is that late runs had no gold, so this is welcome; the Anvil's prices were set to be
dearer than buying the tier outright, and that comparison no longer exists, so they are re-based
against hires and Scrolls in phase 2 and watched.

---

## 7. A contract arrives armed

Enemies carry one item from Act 4 (`ENEMY_GEAR_FROM_ACT`), stripped on a contract claim today.
Under absorption a contract hero **arrives with its piece absorbed** — finished on a fourth axis
(level, Evolution, kit, gear) against a hire's raw one, and the piece is rolled to fit the hero
(the family against its offensive stat, the enchant against a type it fields). No who-screen: it
is already on the hero. Gear dies with a hero on termination or a companion's death — it always
did; now there is no bag for it to fall into.

---

## 8. Order of work

Sequenced so the tree is playable at every boundary. `SAVE_VERSION` bumps at each.

| # | Phase | Exit criterion | Status |
|---|---|---|---|
| 1 | **Absorption.** Three sockets, `bonusItemSlots` gone, the Forge deleted (node, screen, tutorial row → the Boon; its 38 weight simply left the pool — the Cache's weight is phase 4's), the slot sale deleted; `ItemWhoScreen` on every receipt with take / merge / sell; merge at any tier on the holder; the stash, the unseen marks, the footer label, the swap screen, move / unequip / sell-from-stash / trash deleted; the Roster screen read-only for gear; the sim's item policy on the same three verbs. | No reader of `stash`, `bonusItemSlots` or `unseenItemIds`; a run completable end to end; every test green. | **DONE 2026-09-15.** `absorbItem` / `itemReceiptFor` / `anyoneCanReceive` / `sellItem` (`runProgress.ts`), `mergeIntoHeld` (`equipment.ts`), `ItemWhoScreen` chained by App.tsx (`whoScreensFor`); a v17 save is refused rather than converted, since the codec refuses every version but its own. The act-4 in-row Tutor seat retired with the Forge: the spliced row is the Tutor in acts 4 and 5. `SAVE_VERSION` 18. Measured below. |
| 2 | **One Guild Hall.** The Blacksmith node and screen deleted; the funnel one wide; the Anvil and Enchanter in the Guild Hall over held gear; the item shelf and the Sell section deleted; Anvil prices re-based. | No `'blacksmith'` node type; `rollGuildHallOffers` rolls no gear. **Separable.** | **DONE 2026-09-15**, in the same pass — the Blacksmith depended on the bag's item refs, so it was rewritten once rather than twice. The **Smithy** tab (`GuildHallPanel`) holds `ItemServicesSection`, potions and the mend; `GuildHallOffers` is heroes only. Anvil prices NOT re-based yet — the table stands and `test/shop.test.ts` pins only that a lift costs more than the tier sells for. |
| 3 | **A contract arrives armed.** `claimContract` absorbs the enemy's gear; `enemyGen` rolls the piece to fit. | An Act 4 contract holds one item on arrival; the recruitment test pins it. **Separable.** | |
| 4 | **Supply.** The drop table (§5), the Cache's weight, against the sim; docs and `CLAUDE.md` caught up. | Items a run and who-screens a run reported; full-clear against the phase-0 baseline. | |

**What each phase measures.** Phase 1: items a run, merges a run, seats used at the end, and
full-clear against `items-baseline` (12.0%, acts 46 / 55 / 96 / 61 / 81 — a batch that already
carries Wounds, and reads far under the 42% `CLAUDE.md` records; whether that is the pilot
mishandling Rest and mend or the curve is a playtest question, not this doc's). Phase 4: the same
under the proposed drop table.

Phases 1–2, measured (3000 runs, seed 100000, skilled pilot, the same seed as the baseline):
**full-clear 12.0 → 18.8%**, acts 46 / 55 / 96 / 61 / 81 → 49 / 58 / 97 / 76 / 90. Three sockets
for everyone is a player buff of about seven points, most of it in acts 4–5 where a roster used
to be socket-bound — the difficulty re-fit is phase 4's, with the drop table. Items a completed
run 16.4 → **17.2** (the Cache 2.5 → 3.0: the Forge's weight leaving the pool made every other
reward proportionally commoner). **A merge was OFFERED 4.7 times a completed run and TAKEN 0.6**:
the pilot's `bestReceiver` scores a take at the item's whole value and a merge at the tier step it
buys, so while any socket is free it widens, and with 18 seats against 17 items one nearly always
is. That is the pilot's policy, but the arithmetic under it is the game's — a tier step is +20
budget points (or the Awakening at Epic) against a fresh socket's 30–90 — so **"deepen or widen"
is only a live decision once sockets fill, or when the drop fits nobody with a socket free.** A
design question for phase 4, listed in §10.

---

## 9. Locked invariants this overturns

Each is a sign-off. In force until the phase that replaces it lands.

| Today (`CLAUDE.md` / `equipment.md` / `progression.md`) | Becomes | Phase |
|---|---|---|
| Every hero starts on `BASE_ITEM_SLOTS` = 1; the Forge grants +1 to `MAX_ITEM_SLOTS` = 3 | **Three sockets, always.** The Forge and `bonusItemSlots` are deleted | 1 |
| Every item goes straight to the bag; a badge on the Roster button says one is waiting | **No bag.** Every item raises a who-screen on receipt and is absorbed by the hero chosen | 1 |
| Equipment strips on termination to the bag; a KO'd companion's items strip to the bag | Gear **dies with the hero** | 1 |
| Merging: two of the same family AND tier, bag-only, the act window caps the result | **A same-family drop merges into the holder at any tier**, result = the higher + 1, uncapped by the window | 1 |
| Unwanted gear is sold from the bag; equipped gear comes off first | **Sell is a button on the who-screen**, once, at receipt; nothing is sold later | 1 |
| The Roster screen is where gear is assigned, moved, merged and sold | The Roster screen **reads** gear and assigns nothing | 1 |
| The funnel is pick-1-of-2 from act 3: Guild Hall or Blacksmith | **Forced Guild Hall**, every act; the Blacksmith is deleted and its Anvil and Enchanter move in | 2 |
| The Guild Hall shelf sells one of four items; the run's only place to SELL | The shelf sells **no gear**; there is no sale | 2 |
| Enemy gear is stripped on a contract claim | **Absorbed** on the contract hero | 3 |
| Drops: `fight` 1, `battle` 1, `skirmish` 0.6, `elite` 0.8, `boss` 0.95 | Playtest's dial; §5's first pass | 4 |

**Held, and worth saying so:** the rarity budget and the monotonicity rule, the 16 families and
14 enchants, the Awakening at Epic, the act window on drops and the Anvil, the one-per-family
rule on a hero, `EQUIPMENT_SELL_SHARE`, the no-gold-printer inequalities (now only the Anvil's),
and *a bare number never gets a screen* — the who-screen collects a hero, not a number.

---

## 10. Open questions — DO NOT silently resolve

- **The drop table** (§5) — a playtest number. Built unchanged in phase 1.
- **Does the merged Guild Hall read as one place?** Phase 2 ships it; the 2026-09-08 split is the
  fallback if it reads as a chore hub again.
- **A contract's piece** — rolled to fit (§7), or the enemy's own roll kept? Fit is the first
  pass; "the item you saw it wearing" is the alternative and is more honest.
- **The Act 1 / full-clear gap** between `items-baseline` and `CLAUDE.md`'s enemy-levels figures.
  Not this doc's, but it is the baseline every phase here is measured against.
- **Is merging worth choosing?** Measured (§8): offered 4.7 times a run, taken 0.6 by a pilot
  that widens while a socket is free, and the budget table says it is right to. If a merge is
  meant to compete with a take before the roster fills, the merge has to buy more than a tier
  step — a second family Awakening at Legendary, say — or fight drops have to come down (§5) so
  sockets are scarcer than items. Playtest first: a human may merge for the Awakening alone.
- **The Anvil's prices** are un-rebased: the shelf they were priced against is gone. Re-base
  against hires (50g) and Scrolls (25g) once gold is watched through a few runs.
