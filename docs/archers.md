# The Archers — a hero bundle

**PROPOSED 2026-10-08, per user direction. NOT BUILT.** The second hero bundle after From the Tall
Grass: three elemental archers who all shoot **Arrows** (`docs/charges.md`) and each relate to the
quiver differently. **Squall leaves the free base for it**, and a new Storm hero takes his seat.

Decided: the bundle exists; Squall is in it and out of the base; a new Storm base hero replaces him.
Everything else here — names, types, numbers, kits, paths — is a first pass for the designer's
approval.

## Why a bundle

From the Tall Grass sells a theme (the starter triangle). This one sells a **mechanic family**: Arrows
are the one tagged move family the engine reads (`MoveTag 'arrow'`, Retrieve, Restock), and Squall
already teaches it. The base taught Arrows for free; the bundle is where the family gets deep. The
rule from `docs/constellation.md` holds: a purchase widens what a run can draw from and never
carries power into one.

## The trio: three relationships to the quiver

| | **Squall** (exists) | **Quarry** (new) | **Sleet** (new) |
|---|---|---|---|
| Concept | The storm ranger: hooded, fast, first to loose | The centaur huntress: wound it, then finish it | The frost-elf sniper: slow it, then make the last shot count |
| Type | Storm | **Beast** | **Frost** |
| Tempo | Fast, aggressive (Speed 105) | Mid-speed burst (95) | Slow and patient (70), deep Mana |
| The quiver | **A kill buys the Arrow back** (Retrieve) | **A crit buys the Arrow back** | **The last Arrow is the one that counts** |
| Status | Conduct (Storm's mark) | Bleed (Beast's column) | Freeze (halves Speed, so she moves first) |
| Element Arrow | Storm Arrow (Early) | Barbed Arrow (Early) | Rime Arrow (Early) |

Squall refills by volume, Quarry by luck she can tilt, and Sleet does not refill at all — she spends
the quiver down to its climax. All three hold **Iron Arrow** in their pools, the shared Arrow.

Two weather words, Squall and Sleet, are deliberate; Quarry is the hunt. Names are placeholders.

**Beast over Shadow for Quarry** (recommended): Beast is the guaranteed-Bleed column (Lacerate, Gash,
Blood Trail, Rending Leap); Shadow holds crit (Fade Strike) and chanced Bleed. A Beast archer with a
**Shadow graft path** covers both, where a Shadow archer would have to borrow the Bleeds.

## Squall (no change but his shelf)

Squall is built and keeps everything: Storm Arrow kit, Retrieve / Retrieve+ (Restock), Pinning Shot,
Stormpiercer (Last Shot), Gale Volley, Windshear / Dust Devil / Turbine. He moves from the base to the
bundle (`unlock: 'bundle.archers'`).

**Open:** make Gale Volley an Arrow (tag, 2 Charges), so his signature reads Retrieve too.

## Quarry — Beast, the centaur huntress

- **Stats (550):** HP 200 · Atk 95 · Def 45 · Int 20 · Wis 40 · Spd 95 · Mana 55.
- **Grades (28):** HP C · Atk A · Def C · Int F · Wis C · Spd B · Mana C. A physical hitter whose dump
  stat (Intelligence) stays dumped.
- **Kit:** **Barbed Arrow** + **Rally** (Beast's Early buff).
- **Innate — Hunter's Eye:** this hero's Arrows have **+25% crit chance against a Bleeding foe**, and an
  Arrow that crits **gets its Charge back**.
- **Mastered — Hunter's Eye+:** +50% crit chance against a Bleeding foe, and the crit gives back 2.
- **Signature — Thinning the Herd:** an Arrow at both foes, Bleed on each, 1 Charge.
- **Arrows:**

  | Arrow | Tier | Payload | Mana | Charges |
  |---|---|---|---|---|
  | Barbed Arrow | Early | 45 BP, Bleed | 15 | 3 |
  | Gutshot | Mid | 60 BP, ×1.5 vs a Bleeding foe | 30 | 2 |
  | Heartseeker | Late | 95 BP, 50% crit chance | 55 | 2 |

- **Paths (two of a graft, a move, a passive):**
  - **Nightstalker** — Shadow graft + passive *Opening*: a crit leaves a Bleed.
  - **Pack Hunter** — move *Call the Pack* (both allies +Attack) + passive: her partner's hits on a
    Bleeding foe count for her Hunter's Eye.
  - **Thornhide** — Nature graft + move Thornwhip (Poison and Bleed both, for Lethal Bite builds).

## Sleet — Frost, the frost-elf sniper

- **Stats (550):** HP 180 · Atk 100 · Def 40 · Int 25 · Wis 50 · Spd 70 · Mana 85.
- **Grades (28):** HP C · Atk S · Def D · Int F · Wis C · Spd C · Mana B. Slow and deep: the Mana is
  what lets her fire a whole quiver.
- **Kit:** **Rime Arrow** + **Steady Aim** (a new Frost Early buff: +Attack to self, and her next
  Arrow cannot be Dazed — or simply Frost's Rime Coat, if a new buff is one too many).
- **Innate — Deadeye:** each of this hero's Arrows hits **×1.5 on its last Charge**, and **×2 against
  a Frozen foe**. Last Shot, made her whole verb.
- **Mastered — Deadeye+:** ×2 on the last Charge, ×3 against a Frozen foe.
- **Signature — Whiteout Shot:** a single Arrow, 1 Charge, that Freezes both foes on landing.
- **Arrows:**

  | Arrow | Tier | Payload | Mana | Charges |
  |---|---|---|---|---|
  | Rime Arrow | Early | 45 BP, Freeze | 20 | 3 |
  | Hoarfrost Bolt | Mid | 65 BP, +1 priority vs a Frozen foe | 35 | 2 |
  | Glacial Lance | Late | 110 BP | 60 | 2 |

- **Paths:**
  - **Longwatch** — move + passive *Patience*: a round she does not attack, her next Arrow's Charge is
    not spent.
  - **Avalanche** — Stone graft + passive: Bedrock reads her Arrows (physical hits with the higher of
    Attack and Defense).
  - **Stormglass** — Storm graft + move: Arrows plant Conduct, the bridge to Squall.

## The new Storm base hero (Squall's seat)

The base's Storm three are Skyshear (the magical column) and Nimbus (the bulky caster); Squall was the
physical striker. The replacement keeps that seat and is **not** an archer, so the free roster still
meets Arrows through Iron Arrow but buys the family.

- **Stormhorn — the thunder ram** (placeholder). A slow, heavy physical bruiser where Squall was fast
  and light: HP 230 · Atk 100 · Def 70 · Int 15 · Wis 40 · Spd 60 · Mana 35. Grades HP A · Atk A ·
  Def B · Int F · Wis C · Spd C · Mana E.
- **Innate — Slipstream**, the Storm audit's decision of 2026-10-08 that Squall's Arrows displaced
  (`docs/hero-audit.md`): *when a friendly hero's Speed is increased, its Attack and Intelligence
  increase by the same amount.* It finds its home here. **Watch:** Rising Static no longer grants
  Speed, so Storm's Speed sources are now Tailwind and Charge; the kit should carry one.
- **Kit:** Thunderclap + Charge.
- Signature, paths and schedule to author with the Storm audit.

## Build list

1. **Engine — a passive crit verb:** a crit-chance bonus on a passive's damage modifier, optionally
   gated on a target status (`requiresTargetStatuses`). Crit's source was decided as the loadout layer
   (`docs/combat.md`); a passive is loadout. It also unblocks Windshear's Squall Line (+30% crit,
   `docs/hero-audit.md`).
2. **Engine — refill on a crit:** `restoreCharge` on `DamageDealt` with `eventFieldEquals { isCrit }`.
   The event already carries `isCrit`; check the matcher compares a boolean.
3. **Engine — a passive Last Shot:** a passive damage modifier gated on a last Charge (Deadeye), the
   move form's twin (`conditionalPower.requiresLastCharge`).
4. **Content:** six Arrows, two kits, two innates and their mastered cards, two signatures, six paths,
   Stormhorn whole; Steady Aim if kept.
5. **Shelf:** `bundle.archers` in `src/data/starShop.ts` at **8 stars** like Tall Grass; Squall's
   `unlock: 'bundle.archers'`.
6. **Profiles:** Squall leaves the base, so an existing profile keeps him free — the
   `LEFT_BASE_2026_09_28` precedent (`src/run/profile.ts`): a grant ledger entry and a
   `PROFILE_VERSION` bump. Such a profile then sees the bundle discounted to 6 (`offerPrice`).
7. **Deck:** the default Storm row swaps Squall for Stormhorn; `test/roster` pins three a type over
   the base.
8. **Art:** Quarry, Sleet and Stormhorn via PixelLab (`reference_pixellab_hero_recipe`), plus path
   looks later. This is the long pole if the generation budget is still paused.
9. **Measure:** a `SIM_ALL_HEROES` batch, archers against the roster.

## Open

- **Names:** Quarry, Sleet, Stormhorn, and the bundle's own (*The Quiver*? *Three Bows*?).
- **Gale Volley as an Arrow.**
- **Steady Aim:** a new Frost buff, or borrow Rime Coat.
- **Sleet's Freeze loop:** the enemy AI never switches, so a Frozen foe stays Frozen all fight, and
  ×2 Arrows against it are every Arrow. Deadeye may want the Frozen half only on the last Charge.
- **Quarry's crit refund:** the base 1/16 crit plus 25% against a Bleeding foe is about 31%, so she
  refunds about one Arrow in three there. Measure before the mastered figure.
- **Price:** 8 stars, as Tall Grass.
