# The Deadeyes — a hero bundle

**PROPOSED 2026-10-08, per user direction. NOT BUILT.** **The Deadeyes** (the name decided the same
day, per user direction: a superhero trio's callsign, not a description) is the second hero bundle after From the Tall
Grass: three elemental archers who all shoot **Arrows** (`docs/charges.md`) and each relate to the
quiver differently. **Squall leaves the free base for it**, and a new Storm hero takes his seat.

Decided: the bundle exists; Squall is in it and out of the base; a new Storm base hero replaces him;
the trio's names; the bundle's name; **Quiver**, the shared starting move (below).
Everything else here — names, types, numbers, kits, paths — is a first pass for the designer's
approval.

## Why a bundle

From the Tall Grass sells a theme (the starter triangle). This one sells a **mechanic family**: Arrows
are the one tagged move family the engine reads (`MoveTag 'arrow'`, Retrieve, Restock), and Squall
already teaches it. The base taught Arrows for free; the bundle is where the family gets deep. The
rule from `docs/constellation.md` holds: a purchase widens what a run can draw from and never
carries power into one.

## The trio: three relationships to the quiver

| | **Squall** (exists) | **Sliver** (new) | **Sleet** (new) |
|---|---|---|---|
| Concept | The storm ranger: hooded, fast, first to loose | The centaur huntress: wound it, then finish it | The frost-elf sniper: slow it, then make the last shot count |
| Type | Storm | **Beast** | **Frost** |
| Tempo | Fast, aggressive (Speed 105) | Mid-speed burst (95) | Slow and patient (70), deep Mana |
| The quiver | **A kill buys the Arrow back** (Retrieve) | **A crit buys the Arrow back** | **The last Arrow is the one that counts** |
| Status | Conduct (Storm's mark) | Bleed (Beast's column) | Freeze (halves Speed, so she moves first) |
| Own-element Arrows (STAB when rolled) | Storm Arrow, Pinning Shot, Stormpiercer | Barbed Arrow, Gutshot, Heartseeker | Rime Arrow, Hoarfrost Bolt, Glacial Lance |

Squall refills by volume, Sliver by luck she can tilt, and Sleet does not refill at all — she spends
the quiver down to its climax.

**Squall, Sliver, Sleet** (2026-10-08, per user direction): three S-names, two weather words and the
splinter an Arrow leaves in a wound, which is Sliver's Bleed.

**Beast over Shadow for Sliver** (recommended): Beast is the guaranteed-Bleed column (Lacerate, Gash,
Blood Trail, Rending Leap); Shadow holds crit (Fade Strike) and chanced Bleed. A Beast archer with a
**Shadow graft path** covers both, where a Shadow archer would have to borrow the Bleeds.

## Quiver — the shared starting move (DECIDED 2026-10-08, per user direction)

All three archers open every run holding **Quiver**, the move that makes them a team. Their innates
are what set them apart; Quiver is what they share.

- **A face a round.** Quiver sits in the archer's top slot and shows **one Arrow a round**, rolled from
  the game's whole Arrow pool (every move tagged `'arrow'`) — Motley's Trick's shape
  (`metamorphic`, `run/metamorphic.ts kitForRound`), with the face pool narrowed to Arrows. One face,
  not two: the gamble is the point.
- **The first Arrow cast is locked in** as that slot for the rest of the fight. Before the lock, every
  round asks *take this one, or wait for a better roll?* After it, the slot is that Arrow with its
  own Charges, spent and refilled like any other. The lock belongs to the hero (`Combatant`) and holds
  through a switch, as Charges do.
- **Faces follow the hero's level**, the bands its offers read: Early Arrows only until its
  `midLevel`, Mid joining there, Late from its `lateLevel`. Early faces stay in the roll all run, so a
  late fight can still roll low, and that is what makes waiting a decision. Without the gate an Act 1
  archer could roll a 110 BP Glacial Lance.
- **Off-element faces are in.** Sliver can roll Rime Arrow and lose STAB on it; that is the gamble,
  and it lets the trio cross-pollinate (Sleet's Freeze on Squall's side of the run). Iron Arrow is in
  the pool for everyone.
- **Why the innates now matter more:** a locked slot is one Arrow with 2–4 Charges, dead when it runs
  dry. Squall buys it back with kills, Sliver with crits, and Sleet holds the last one for the kill.
  Quiver poses the problem; each innate is a different answer.
- **Each archer's own-element Arrows stay in its offer pool** (2026-10-08, per user direction), learned
  like any move, and **Quiver never rolls an Arrow the active kit already holds** — Motley's rule
  (`kitForRound` already drops held moves from the face pool). So a learned Arrow is the dependable
  floor and Quiver rolls everything else; the two can never show the same Arrow twice. Arrows of
  other elements, Iron Arrow included, come only through Quiver for an archer; non-archers who hold
  Iron Arrow keep it as an ordinary move.
- **The enemy side:** the AI reads the round's kit (`kitForRound`), so an enemy archer will likely
  cast its first face and lock at once. Acceptable; a smarter wait is a later AI tier.

**BUILT for Squall, 2026-10-08** (per user direction, ahead of the art): `quiver` in `src/data/moves.ts`
(`metamorphic: { poolTag: 'arrow', locksOnCast: true }`, `MetamorphicRule`), faces narrowed in
`run/metamorphic.ts kitForRound`, the kit and opened tiers stamped at fight build
(`buildCombatState quiverStamp` → `Combatant.kitMoveIds`, `openTiers`), and the lock written at the
cast (`state.ts faceLockFor` → `Combatant.lockedFaces`). The skilled pilot now reads the round's kit
too (it did not, for Motley either). Squall opens on Quiver + Rising Static with Storm Arrow in his
Early offers; the refill Boons count Quiver as an Arrow. Sliver and Sleet only need their Arrows and a
kit. Not simulated yet. Quiver wears Iron, the shared Arrow's metal, since it is never cast as itself.

## Squall (his shelf, and Quiver)

Squall is built and keeps Retrieve / Retrieve+ (Restock), Gale Volley and Windshear / Dust Devil /
Turbine. His kit becomes **Quiver + Rising Static**; Storm Arrow, Pinning Shot and Stormpiercer (Last
Shot) stay in his offers (Storm Arrow to his Early band) and in the Arrow pool, and Iron Arrow
leaves his offers. He moves from the base to
the bundle (`unlock: 'bundle.deadeyes'`).

**Open:** make Gale Volley an Arrow (tag, 2 Charges), so his signature reads Retrieve too.

## Sliver — Beast, the centaur huntress

- **Stats (550):** HP 200 · Atk 95 · Def 45 · Int 20 · Wis 40 · Spd 95 · Mana 55.
- **Grades (28):** HP C · Atk A · Def C · Int F · Wis C · Spd B · Mana C. A physical hitter whose dump
  stat (Intelligence) stays dumped.
- **Kit:** **Quiver** + **Rally** (Beast's Early buff).
- **Innate — Hunter's Eye:** this hero's Arrows have **+25% crit chance against a Bleeding foe**, and an
  Arrow that crits **gets its Charge back**.
- **Mastered — Hunter's Eye+:** +50% crit chance against a Bleeding foe, and the crit gives back 2.
- **Signature — Thinning the Herd:** an Arrow at both foes, Bleed on each, 1 Charge.
- **Her Beast Arrows** (into the shared pool, STAB for her):

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
- **Kit:** **Quiver** + **Steady Aim** (a new Frost Early buff: +Attack to self, and her next
  Arrow cannot be Dazed — or simply Frost's Rime Coat, if a new buff is one too many).
- **Innate — Deadeye:** each of this hero's Arrows hits **×1.5 on its last Charge**, and **×2 against
  a Frozen foe**. Last Shot, made her whole verb.
- **Mastered — Deadeye+:** ×2 on the last Charge, ×3 against a Frozen foe.
- **Signature — Whiteout Shot:** a single Arrow, 1 Charge, that Freezes both foes on landing.
- **Her Frost Arrows** (into the shared pool, STAB for her):

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
3. **Engine — Quiver:** a `metamorphic` move whose face pool is narrowed to a tag (`'arrow'`) and to
   the tiers the hero's level has opened (the combatant needs its level, or its open bands, at fight
   build), one face a round, and a **lock** on first cast held on the `Combatant` through a switch.
   The fight row tags the face with *Quiver* as Motley's does with *Trick*.
4. **Engine — a passive Last Shot:** a passive damage modifier gated on a last Charge (Deadeye), the
   move form's twin (`conditionalPower.requiresLastCharge`).
5. **Content:** Quiver, six Arrows, three kits, two innates and their mastered cards, two signatures, six paths,
   Stormhorn whole; Steady Aim if kept.
6. **Shelf:** `bundle.deadeyes` in `src/data/starShop.ts` at **8 stars** like Tall Grass; Squall's
   `unlock: 'bundle.deadeyes'`.
7. **Profiles:** Squall leaves the base, so an existing profile keeps him free — the
   `LEFT_BASE_2026_09_28` precedent (`src/run/profile.ts`): a grant ledger entry and a
   `PROFILE_VERSION` bump. Such a profile then sees the bundle discounted to 6 (`offerPrice`).
8. **Deck:** the default Storm row swaps Squall for Stormhorn; `test/roster` pins three a type over
   the base.
9. **Art:** Sliver, Sleet and Stormhorn via PixelLab (`reference_pixellab_hero_recipe`), plus path
   looks later. This is the long pole if the generation budget is still paused.
10. **Measure:** a `SIM_ALL_HEROES` batch, archers against the roster, and how often the pilot waits
    on a face versus locking the first.

## Open

- **Names:** Stormhorn. The trio and the bundle (The Deadeyes) are decided. Sleet's innate shares the
  word (Deadeye); kept on purpose as the team's namesake, unless it reads as confusing in play.
- **Gale Volley as an Arrow.**
- **Steady Aim:** a new Frost buff, or borrow Rime Coat.
- **Sleet's Freeze loop:** the enemy AI never switches, so a Frozen foe stays Frozen all fight, and
  ×2 Arrows against it are every Arrow. Deadeye may want the Frozen half only on the last Charge.
- **Sliver's crit refund:** the base 1/16 crit plus 25% against a Bleeding foe is about 31%, so she
  refunds about one Arrow in three there. Measure before the mastered figure.
- **Price:** 8 stars, as Tall Grass.
- **Quiver's name** (Nock? Draw?), and whether a locked slot that runs dry should fall back to rolling.
- **Squall's existing players** lose Storm Arrow as a reliable opener: it becomes one face of ten until
  his first Early offer can teach it back.
