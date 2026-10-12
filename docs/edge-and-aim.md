# Edge and Aim — a Force for a move family

**BUILT 2026-10-12, per user direction.** Proposed as "Edge and Draw" the same day; Draw was
renamed **Aim** before it shipped. Every figure is a first pass.

## 1. What they are

**Edge** powers up Slices; **Aim** powers up Arrows. Each is Elemental Force with the element
swapped for a move family (`MoveTag`, `docs/hero-audit.md` Nature, `docs/charges.md`):

- **Flat Base Power on every hit** of a move carrying the tag, added after the authored power and
  before the multiplier chain — exactly where Elemental Force and Ambush sit
  (`resolveElementalForceBonus`). Damage pipeline, never a stat.
- **Any type.** A Shadow Slice and a Leaf Slice both take Edge, so a slicer with an off-type cut
  gets paid for it, which Elemental Force never does.
- **Stacks with Elemental Force and Ambush**, additively: Leaf Slice with Nature Force 10, Edge 10
  and Ambush 20 swings at 60 + 40.
- **A magnitude status**: additive, persistent, kept through a switch, never spent by a hit —
  Force's shape, not Ambush's. Drawn as a chip with its number (a blade, a reticle), each wearing
  the Force family's corner arrow.

Why its own word and not "Slice Force": Force always means an element, on the item sheet, the
Ley Line, the Smithy's Enchanter and the type-locked Boons. A family bonus that read as Force would
make players hunt for the Slice type on the chart.

## 2. Engine

`StatusDefinition.forceTag?: MoveTag`, exclusive with `forceType` and `forceAllTypes`.
`resolveElementalForceBonus` takes the move (its type and tags) rather than its type, so every
reader — the resolver, the forecast, the pilot, the move detail and the fight tile — gets it free.
Two statuses: `Edge` (`forceTag: 'slice'`) and `Aim` (`forceTag: 'arrow'`).

## 3. Sources

| | Edge | Aim |
|---|---|---|
| **A move** | **Hone** — new Early Iron buff, 20 mana, self: **Edge 20**, 3 Charges. In the pool of every hero holding four or more Slices: Tixwick, Sorrow, Nightshade, Widow, Scallywag, Jinx, Murk. | **Take Aim** — new Early Storm buff, 20 mana, self: **Aim 20**, 3 Charges. Squall's pool (and the Deadeyes', when they ship). |
| **A hero** | **Tixwick's Thresher**: its passive is **Grindstone** — *at the end of each round, this hero gains Edge 5, up to 4 times a fight* (it replaced Reaping). | **Squall's Restock** (Retrieve+): a Rest refills every Arrow and also gives **Aim 10**. |
| **A Boon** | **Whetstone** — *on entering the field, gains Edge 10.* Offered only while a roster hero holds a Slice (`familyBoonMoveCount`). | **Fletching** — the same, Aim 10, offered only while somebody holds an Arrow (Quiver counts). |
| **Gear** | None. Force costs 2 points a magnitude on an item; a narrower bonus wants a lower price, decided once it has been seen in play. | Same. |

## 4. To watch

- **Multi-hit multiplies it.** Every hit re-reads flat Base Power, so Thousand Cuts (3 hits, 4 with
  Twin Scythes+) pays Edge three or four times — the Ambush shape. Hone's Edge 20 on Thousand Cuts +
  Twin Scythes+ is +80 Base Power a cast; Thousand Cuts' 70 mana and Hone's 3 Charges hold it.
- **Banking sources are limited by firings, never by a cap** (the Force rule): Grindstone carries
  `maxFiresPerFight` 4, Hone and Take Aim 3 Charges.
- **Arrows are cheap and Charged.** Aim 20 on a 15-mana Storm Arrow (50) is +40%; Charges are the
  brake.

## 5. Open

- Whether Edge or Aim ever go on gear, and at what price per magnitude.
- Whether Hone's pool list should follow the Slice count as pools change, or be authored by hand.
