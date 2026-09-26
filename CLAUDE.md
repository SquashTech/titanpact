# TITANPACT — Project Constitution

Roguelike tactical RPG. Fully-piloted **doubles (2v2)** combat inspired by Pokémon VGC and
Guildrun. ~45-minute runs: draft → escalating fights → relics. Portrait-mode mobile.

**North star:** every hero must be viable under *some* combination of items, relics, and team
composition. No hero is a trap pick.

This file is the constitution: load-bearing rules and rationale. Deeper design lives in `/docs`
(see Repo map). When a rule here and a prompt conflict, this file wins — surface the conflict,
don't silently override it.

> **An overhaul supersedes part of this file: `docs/growth-overhaul.md`** (2026-09-10).
> Stats moved onto automatic roster-wide levelling (Fire Emblem growth grades, cap 30), moves
> onto a **Mastery Scroll / Mastery Rank** currency, Evolutions onto **the Crucible** at the act
> boundary, and **Gems were deleted**. That doc's §9 lists the invariants it reversed.
> **ALL SEVEN PHASES ARE DONE (2026-09-10):** Gems are gone, moves come only from Mastery
> Scrolls, levels are automatic and cap 30, Evolutions come from the Crucible, a Guild hire
> arrives raw against a contract hero's finished one, the difficulty curve is re-fitted against
> all of it, and all 36 heroes carry authored growth grades. Everything else below is still the
> rule in force.
> **Second pass, 2026-09-11 (`docs/growth-overhaul.md` §11):** Evolutions moved off the
> Crucible onto the Scroll ladder, the Crucible now grants a **Class**, Classes are **verbs** (a
> move or a passive, never stats), and the Mentor is an Early–Mid Tutor in acts 1–3 with a Forge
> in act 4's seat. **Third pass, 2026-09-12 (§12):** the ladder is PRICED — a rung costs 1, 2,
> 3, 4, then 5 Scrolls, income rises by act (3/3/4/4/4, +2 an act), the purse banks, and the
> thresholds are the old level curve's (Mid at rung 3, Evolution at 4, Late at 6).

> **A second overhaul is DECIDED and PARTLY BUILT: `docs/titanspawn-overhaul.md`** (2026-09-13).
> Location factions are replaced by **Titanspawn** — one mob line per mortal type in three tiers
> (Early/Mid/Late), geometric SVG art against the heroes' pixel art, kits from the type slates;
> locations **partition** the fourteen types (Necropolis at two); the fork becomes a previewed
> Elite-or-Skirmish; a **mortal companion** joins after the first fight (a hero in every respect
> except that a KO removes it from the run); and the **Pact Clock comes off the bench**. Its §11
> lists the invariants below it reverses; until the phase in its §9 that replaces each one lands,
> the rule below is still the rule in force. **Phases 1-2 are IN (2026-09-13):** the 42 spawn
> exist and render, the factions are deleted, `LocationDefinition.spawnTypes` is the mob layer's
> hard filter, `fight`/`battle` and the Guardian's escorts draw spawn by act tier
> (`SPAWN_TIER_BY_ACT`), and every spawn — escorts included — levels to its node
> (`docs/enemy-levels.md`, 2026-09-15, which retired the monsters track). **The Guardians and the
> Endbringer are drawn in the same geometry** (2026-09-16, `guardianFigures.ts`, §2 "Guardian
> art"): the mortal type's tones and one Titan eye, nothing Ancient-coloured on the body (a
> worn seal ring and a second wrong-placed eye were both tried and removed); the Endbringer is the Titan's **Herald**
> (a standard-bearer, the eye on the banner — never the Titan); the Leviathan is renamed
> **Kraken**, the Lava Beast **Dragon** and the Goblin Lord **Manticore**.
> **Phases 3–5 are IN too:** the fork is Elite-or-Skirmish with the enemy typing previewed on the
> tile from a draw seeded off the map (`src/run/encounters.ts`), the Pact Clock takes the field
> only, and the mortal companion joins after the first fight. **Phase 6 measured (sim pass 8) and
> left two balance dials for playtest** — the overhaul is built in full; its §11 table is now the
> rule in force wherever it disagrees with a line below.

> **A third overhaul is DECIDED and PHASE 1 IS IN: `docs/xp-overhaul.md`** (2026-09-13, §2–4
> decided per user direction; §5's four acts DEFERRED, not decided). One curve — `XP(L) = L³`,
> `src/run/growth.ts` — for stats, moves and Evolutions; **Ichor** nodes aim XP at one hero; the
> Scroll ladder is deleted and moves come from a per-hero level **schedule** with the roll kept.
> Its §9 lists the invariants below it reverses; until the §8 phase that replaces each one lands,
> the rule below is still the rule in force. **Phases 1–3 are IN:** `RosterEntry.xp` is stored and
> level is DERIVED (`levelOf`); a won encounter pays an **authored XP figure by act**
> (`ENCOUNTER_XP_BY_ACT`, Guardian ×2, Elite ×1.5 — 2026-09-13/14, per user direction, replacing XP derived from a
> level table, which filled every bar to the top and made XP a number nobody saw) and par is
> derived from the sum, still 8/14/19/24/28/30 at act ends; a hero off par gains on par instead of
> trailing by a fixed count (measured: +10 points full-clear, all of it in acts 2–5; §8). **Ichor**
> (`src/run/ichor.ts`) took the two Scroll nodes' seats and the Guild Hall shelf: XP worth 2 (or 1)
> levels AT PAR, aimed at ONE hero through a who screen, paid out on the level-up report; a hero
> at the cap is refused. **The Scroll ladder is DELETED** (phase 3): moves and the Evolution come
> from a per-hero **schedule** read off level (`DEFAULT_SCHEDULE`, `src/run/progression.ts`) and
> paid out on the level-up report — the invariants below say so. **Phase 4 is IN too:** all 36
> heroes author their own schedule (`src/data/heroes.ts`), two offers from every band (six a
> hero, Glyph seven), Evolutions spread 10–24 in three groups. **Phase 6 is IN (2026-09-13):**
> each band offers its own tier (Mid expires at Late as Early does at Mid), **Late-tier mana is
> re-priced ×0.75** (floor 45; the 100+ whole-pool casts keep their price) so a Late move is
> castable twice a fight, and `ACT_STEP_CURVE`'s last two steps came down to pay for the
> symmetric half of that. **Pushed part-way back 2026-09-17** (per user direction, sim pass 9):
> Late +10, spread damage +20 at Late / +15 at Mid — a single Late is 55+, a spread Late 65+ —
> because a spread hit at a single hit's price topped every damage-per-mana table
> (`docs/authoring-moves.md`). Late is still cast 1.6 times a fight in Act 5. Measured: full-clear 57%, Late casts 19 / 29 / 36% of Acts 4 / 5 /
> finale (was 11 / 18 / 23), the Act 1 wall at 76% untouched by every non-design lever (§8).
> Phase 5 (four acts) stays deferred.

> **A fourth overhaul is BUILT IN FULL: `docs/mastery.md`** (2026-09-14, per user
> direction). Evolutions come off the level schedule onto **Mastery**: every hero has ten pips,
> **5 is its Evolution and 10 its signature move** (one authored per hero, off every pool — Riptide's
> Lizard Rush is the template), uniform, no per-hero threshold. A pip is one **Mastery Scroll**,
> assigned the instant it is paid on a who-screen — no purse, no price curve, no move offer per
> Scroll. **Fights pay XP, the map pays Scrolls**: a forced **Scribe** row every act (pick two
> heroes, +2 each), a **Scroll Cache** in the reward pool (3, divided freely), and the Guild Hall
> shelf; never a post-fight drop. **Ichor retires** in its own phase. `evolutionLevel`, the
> report's Evolution raise, and the 10–24 window are what it deletes; its §9 lists every invariant
> below it reverses, and until the §8 phase that replaces each one lands, the rule below is still
> the rule in force. **Phase 1 is IN (2026-09-14):** `RosterEntry.mastery` (`src/run/mastery.ts`),
> the Evolution opens at 5 pips and at no level (`evolutionLevel` is gone from every schedule),
> the Scribe is a forced row every act 1–5 (`ScrollNodeScreen`, the Evolution raised over it),
> the Guild Hall shelf sells a Scroll (25g, 2 a visit), enemies / contracts / hires hold
> `masteryForAct` (**`2N−2`** since phase 5, hires `2N−3` — enemies evolve from Act 4), and the companion steps at 5 / 10. **Phase 2 is IN
> (same day): Ichor is RETIRED** — `src/run/ichor.ts`, both nodes, the screen and the shelf's Drops
> are gone; the **Scroll Cache** (`scrollReward`, 3 pips in any split) sits in the reward pool at
> the 46 it held before Ichor. Measured: 35 pips a completed run, every hero evolved 64%, full-clear
> unmoved by the swap. **Phase 3 is IN (same
> day): the signature slot** — `HeroDefinition.signatureMoveId`, `src/data/signatures.ts`, owed at
> the tenth pip and spent by being made, replace-or-decline at `MOVE_CAP`, in no pool by test;
> Lizard Rush is Riptide's, and Tidecaller grants Maelstrom (off Riptide's pool) in its place.
> **Phase 4 is IN** — all 36 heroes carry a signature (`src/data/signatures.ts`); the numbers are a first pass, the weaker ones waiting on a buff/debuff rework. **Phase 5 is IN:** `2N−2` per user direction; the Scribe's 2 + 2, the Cache's 46 and the shelf's 25g / 2 stand, with the supply dials measured in §8 — 35 pips a completed run, full-clear 54% against the pre-Mastery 62%, the gap being the roster-wide Evolutions the level schedule paid for free; the Scribe at 3 + 3 recovers half of it. That figure is the designer's to move.

> **A fifth overhaul is BUILT, phases 1–2: `docs/gear-absorption.md`** (2026-09-15, per user
> direction). **Gear is absorbed**: every item raises a who-screen the moment it arrives
> (`ItemWhoScreen`, behind the level report after a fight, after the Cache pick, once per Loot
> Pile item) and never comes off the hero it is given to; **three sockets for everyone**
> (`BASE_ITEM_SLOTS` = 3, `bonusItemSlots` and the Forge deleted); a same-family drop **merges
> into the holder** one tier above the higher of the two, the held enchant surviving, the act
> window not consulted (`mergeIntoHeld`); **Sell** is the who-screen's one decline, and a drop
> nobody can receive is gold on the spot. The bag, its marks and the footer label, the swap
> sheet, the Blacksmith node, the Guild Hall's item shelf and its Sell are DELETED; the funnel is
> a forced Guild Hall every act with the Anvil and Enchanter on its **Smithy** tab; the spliced
> row is the Tutor in acts 4 AND 5 (the in-row act-4 seat retired with the Forge). Its §9 lists the invariants below it reverses. Measured
> (sim, 3000 runs): full-clear 12.0 → 18.8% on the same seed — three sockets are a player buff
> — 17.2 items a completed run, a merge OFFERED 4.7 times a run and TAKEN 0.6 by a pilot that
> widens while a socket is free (§8). **Phase 3 is IN (same day): a contract arrives ARMED** —
> the enemy's piece is rolled to fit it (`rollFittingGear`: a family suiting its offensive stat,
> an enchant of a type it fields) and `claimContract` keeps it, the fifth finished axis against a
> bare hire; a terminated hero's gear goes with it, never handed on. **Phase 4 is IN (same day):
> the drop table was MEASURED** — every table without the opener's guaranteed item lost six to
> eight points of full-clear, all in acts 1–2 — so `EQUIPMENT_DROP_CHANCE` is 1 / 0.6 / 1 / 1
> (the Elite and Guardian always drop) and the Cache took the Forge's seat weight (40 → 78).
> Shipped: full-clear 19.9%, 21 items a completed run against 18 seats, merges offered 5.8 →
> taken 1.0. **The enemy curve then took an act term** (same day, per user direction —
> `ACT_LEVEL_ADJUST` = Act 1 −2, Acts 3 and 5 +2, `docs/enemy-levels.md` §4): Act 1 50 → 58%,
> Act 3 98 → 96, Act 5 90 → 88, full-clear 21.9%; then **the Goblin Lord traded 10 Attack for
> 20 HP** (his one dial — Mana fed Archon Blast and read worse): the Act 1 Guardian 77 → 82%,
> Act 1 62%, full-clear 23.1%.

> **A sixth is BUILT, phases 1–3: `docs/shield.md`** (decided 2026-09-14, built 2026-09-15).
> **Shield is bonus health off Defense**: a `'shield'`-pipeline status (`src/engine/status/shield.ts`)
> whose magnitude is a pool, scaled off the CASTER's Defense on the status-magnitude formula
> (`magnitudeStatKey`: `hot` → Wisdom, `dot` → the move's offensive stat, **`shield` → Defense**),
> taken from before HP by **a move's hit only** — `applyHpDelta` takes a `source`, `'hit'` at the
> move's hit and the Conduct burst, `'direct'` (the default) everywhere else, so a DoT, the Pact
> Clock, recoil and a self-cost go straight through — lasting until a hit empties it
> (`StatusRemoved 'broken'`, carrying the striker), additive up to **the holder's max HP**
> (`StatusApplied.capped`, voiced *can't go any higher*). `DamageDealt.amount` is what HP lost and
> `absorbed` what the pool took; an absorbed hit is still a hit for every passive, drain reads HP.
> Seven cards in five slates: Tide Guard and Bastion converted (Shield 20 / 45 on both allies),
> Iron Skin, Living Wall (pivots, the pool goes to the bench), Rampart (Late, both allies, 65),
> Ice Shell (50, and `IceShell` — `StatusDefinition.onShieldBroken` — Freezes whoever breaks
> it) and Vigil (the doc's Sanctuary, renamed: Sanctuary is Light's field effect). Pool seats are
> a first pass; the spawn kits are untouched. **Phase 4 is MEASURED (same day, §8): full-clear
> 23.1 → 22.5% on the same seed (noise), absorbed 3–5% of hits by act and 13% in the finale, the
> cap binding on 2% of casts, Bastion cast 43 → 2559 times — dead as Defense, live as a Shield.**

> **A seventh is BUILT IN FULL: `docs/innate-passives.md`** (2026-09-20, per user direction,
> drafted and built the same day). **Every hero holds ONE innate passive** on
> `HeroDefinition.passiveIds` (`innatePassiveOf`, `src/run/innate.ts`) — a verb never a bare
> number, uniform and unpriced, in no pool (a reused equipment card stays in the Boon pool as the
> card it is, and stacks), read whole on the draft card, the stage, the dossier and the scouted
> chip. 45 authored: 31 new cards, 12 catalog reuses, two engine verbs — **Lingering**
> (`enduresOnce`: the first KO each fight refused at 1 HP, any source, an `Endured` event) and
> **Ironbound** (`cannotSwitchOut`, read through `canSwitchOut` at every voluntary-switch site).
> **Every Titanspawn carries its type's Mark** (`titansMarkFor`): +`TITANS_MARK_FORCE` = 5 of its
> own Force at each round end it stands on the field, the Pact Clock's shape — **and no Guardian
> does** (measured: a Marked champion was the whole of a twelve-point Act 1 loss; the seal keeps it
> off). **The Burden** is the one priced exception: a cost-innate whose hero comes in
> `BURDEN_SURPLUS` = 60 OVER the 550, in base, permanent, printed `610 · Burden` — Bellows alone,
> `test/roster` pins the list. Measured (3000 runs, chart pilot, same seed): full-clear 20.8 →
> 22.5%, Act 1 67.8 → 68.3, the finale 52.8 → 62.6 (the Herald and the Eyes hold no innate), every
> hero inside ±2.6 points; Revenant −5.4 die%, Bellows +4.9 die% / +8.6 DPR. Its §10 lists the
> invariants it reverses. **Second wave, same day, per user direction:** nine innates re-authored
> so every one fires off the starting kit (Tempest holds Rising Static, Revenant Torment); five
> verbs added for them — `StatusDetonated` and `Rested` hooks, an event-read `statDelta`, a
> reactive `chance`, a `damageModifier.requiresTargetStatuses` — and **one passive magnitude
> that scales**: Boiler's Burn, `scaledBy: 'intelligence'` (StatMult, no STAB), the sole exception
> to "passive-applied magnitudes are flat". Lingering is off the roster; the endure verb stays.

> **An eighth is DECIDED, NOT BUILT: `docs/ascension.md`** (2026-09-21, per user direction).
> **Ascension 1 is Permadeath**: every roster entry `mortal` (the companion's rule for everyone),
> a KO on a won fight gone with its gear unless a **Revive** — the ONE way back — is spent on it at
> the fight's end on a **Fallen** beat before the level report; **a Revive never saves the
> companion**, at any rung. A2–A5 are PROPOSED, each a RULE never a bare enemy stat multiplier
> (Guardians Marked and warded, authored warbands, Banners halved + Smithy ×1.5 on the one economy
> rung, Gaze at a tenth + two-phase Guardians + an AI tier). Recruitment stays as it is at Base —
> the ladder is where it gets its demand. Decided beside it, every rung: a Compendium bestiary
> for the spawn, a `companion:<type>` star for clearing with the companion alive at the Eyes'
> close, and the companion exempt from Withering Gaze. Its §10 lists what each rung reverses.
> **Phases 0–1 are IN (same day) — A1 is PLAYABLE:** `isCompanion` splits the identity from the `mortal`
> rule; `src/run/ascension.ts` holds the rung (`RunState.ascension`, saved), `isPermadeath`, and the
> Fallen verbs; the title asks *How hard?* once a Base clear has opened A1 (`openAscension`,
> `Profile.ascensionCleared`); `FallenScreen` is first in the post-fight chain. The sim takes
> `--ascension`; measured (§9b, 3000 runs, skilled pilot) full-clear 73.7 → 31.2%, Act 2
> the wall (91 → 66), contracts claimed 1.74 → 2.57 a run and the swap route 2.27 → 0.39, the Revive
> crowding the Smithy out through Act 3 — the Revive supply is the binding number.
> **Phase 2 is IN (2026-09-26, §7a):** the Compendium's Spawn page (a line revealed by its star), the
> `companion:<type>` star, and — per user direction — the companion **awakening** at the finale:
> Ancient takes its secondary slot, and every later companion of that line joins Ancient
> (`Profile.ascendedSpawnTypes`). Ancient resists every type, so that is the thing to watch.

---

## Locked invariants — do not violate without an explicit decision

### Combat math
- **Damage formula (locked, exact):**
  `Damage = BasePower × (offStat / defStat) × STAB × TypeMult × Variance × Crit`
  - Physical pair: `offStat = Attack`, `defStat = Defense`.
  - Magical pair: `offStat = Intelligence`, `defStat = Wisdom`.
  - `STAB = 1.25` when the move's type is one of the user's types.
  - `TypeMult` = product over each defender type (dual types stack **multiplicatively**).
  - `Variance` = uniform `0.85–1.0`, rolled per hit. **Load-bearing — never remove.**
  - `Crit` = a multiplier term (source is an open question; see below).
- **Two-pipeline separation (non-negotiable):** the *stat pipeline* produces only the
  off/def **ratio**. The *damage pipeline* applies BasePower and every multiplier term.
  Damage modifiers (relic damage bonuses, offensive buffs, etc.) live in the **damage
  pipeline** — never folded back into stats. Mixing them destroys balance legibility.
- **Healing formula (2026-08-28):** `Heal = HealPower × WisdomMult × STAB`, with
  `WisdomMult = 1 + (Wisdom − 50)/100`. Scales with the **caster's Wisdom** (whatever the
  move's category), **never with the target's max HP**, and carries **no variance**. A HoT
  snapshots it at application time. Reasoning + open questions: `docs/combat.md`.
- **Status magnitude formula (2026-09-05):** a DoT or HoT rider's authored magnitude is a
  BASE — `magnitude = authored × StatMult × STAB`, `StatMult = 1 + (stat − 50)/100` clamped
  `[0.5, 2.0]`, snapshotted at application. Same shape and same constants as the heal
  formula; only the stat differs — a `hot` reads the caster's **Wisdom**, a `dot` the
  **offensive stat its own move swings with** (Attack if physical, Intelligence if magical),
  so a split slate like Fire has no trap-pick half. **A `dot` aimed at `self` is a COST and
  is never scaled** (Fire's and Mech's self-Burn, whose price must stay knowable before the
  button is pressed); a `hot` on self is a benefit and scales. Passive-applied magnitudes
  are flat — a passive has no move to take STAB from — **with one named exception** (2026-09-20,
  per user direction): a passive's `applyStatus` may carry `scaledBy`, the StatMult off the
  OWNER's stat and still no STAB; Boiler's Burn is the only holder, and a second is a
  conversation (`docs/innate-passives.md` §10). It exists because `HP_SCALE` is
  neutral for what repeats and not for what decays: `decay: 'halve'` caps a Burn's lifetime
  output at ≈2× its magnitude however long the fight runs. `docs/combat.md`.
- **Stat line:** HP, Attack/Defense, Intelligence/Wisdom, Speed, Mana, MP Regen.
- **Every hero's seven stats sum to exactly 550** — HP/Attack/Defense/Intelligence/
  Wisdom/Speed/Mana at FACE VALUE, HP counted at 1:1 (2026-09-09, replacing the 450
  budget that priced HP at half); **MP Regen sits outside it at a flat 10**. **One named
  exception, the Burden** (2026-09-20, `docs/innate-passives.md` §4): a hero whose innate is a
  COST comes in `BURDEN_SURPLUS` = 60 OVER, never under — printed on the sheet, pinned by test,
  Bellows alone. The rule is
  the number the hero sheet's Stat Total row already prints, so a line being on budget is
  checkable by the player and not only by the repo (`heroStatTotal`,
  `src/run/statBudget.ts`; `test/roster.test.ts`; `docs/types-and-heroes.md`). A
  specialist is signalled by spiking one stat past anything else in the roster, never by
  coming in under the total. The re-base took its points out of **HP** and held **Speed**
  fixed on every hero, compressing the roster's HP range from 160–300 to 180–250.
  **It deliberately over-charges HP** — measured break-even is ≈0.33 a point, enemy lines
  still pay `HP_BUDGET_VALUE` = 0.5 and equipment ⅓ (`HP_PER_POINT` = 3, 2026-09-11) — so it is a legibility call to be
  judged in playtest, and the walls are what to watch (`docs/progression.md` "Pricing HP").
- **Stat modifiers are flat additive integers, multiples of 5 or 10.** No % stat mods.
  **A MOVE's delta is authored as a BASE and lands scaled off the caster** (2026-09-14,
  `docs/stat-scaling.md` phase 1, per user direction — a stage system was weighed and set
  aside): `landed = round(authored × StatMult × STAB)`, the status-magnitude formula, a buff
  reading the caster's Wisdom and a debuff the offensive stat its move swings with. The rule
  binds the BASE, as it binds a Burn's; loadout grants (equipment, Banners, Evolution, Class)
  stay exactly authored, and a self-side cost, a derived grant, a passive's delta and MP Regen
  land flat. Still additive, still the stat pipeline — no % term touches a stat. **A fight
  modifier is held inside −½ … +3× of (base + loadout) at write** (`statModifierFloor` /
  `statModifierCeiling`, `STAT_CEILING_MULTIPLE` = 4; the floor on phase 1's measurement, the
  ceiling per user direction after a full playtest run, ×4 over the proposed ×2) — a debuff can
  at most halve a stat, a buff can at most take it to four times what it started the fight at,
  and `StatChanged.capped` says when an end took some; measured 61.6% → 67.1% full-clear over
  the pre-scaling baseline with every phase in, Act 1 89.2 → 89.7%. The player-facing voice is
  **"can't go any lower" / "can't go any higher"**, never "the floor" or "the cap".
  **Automatic stat growth from levelling is the one systemic exemption** (2026-09-10, Growth
  Overhaul phase 3): a growth roll grants **+1 to +4**, or **+3 to +12 HP**, none of which is a
  multiple of 5. The rule was written to keep authored grants legible, and a roll nobody authors per-hero
  is not that kind of grant — the legibility lives in the GRADE instead (`src/run/growth.ts`).
  A further exemption
  (2026-08-30): a **derived** grant, whose amount is read off live state rather than
  authored, lands unrounded — Arcane Overflow grants Attack/Intelligence equal to the
  caster's current Mana, and Beast's Apex Predator grants Attack equal to the caster's
  own current Attack (`MoveDefinition.derivedStatDeltas`, `docs/combat.md`). Two
  sources, one exemption; a third should be a conversation, not a habit.
- **No accuracy stat.** Moves always land. **Mana cost is the primary balance lever** on
  reliable moves. **A guaranteed lockout is priced by the fight, not the cast** (2026-09-11):
  Feint, Blind and Barrier carry `manaCostGainOnUse` = 20, so each cast is dearer for the rest
  of the fight and none of them is a permanent lock. It banks in the same per-move ledger as
  `manaDiscountOnUse` (`Combatant.moveManaDiscounts`, negative), so every price reader sees it.
- **Priority uses integer brackets; Speed is the tiebreaker within a bracket.**
- **No spread damage reduction** — this is a doubles-only game.

### Types
- **15 types:** Fire, Water, Frost, Storm, Stone, Nature, Light, Shadow, Arcane, Mind,
  Spirit, Iron, Mech, Beast, Ancient.
- **Type = the domain a hero's power draws from, not what its body is made of.** This reframe
  is the identity filter for the whole roster — apply it everywhere.
- A hero's **innate primary type is immutable.** Evolution may add or shift a *secondary*
  type (type-graft); it never changes the innate primary. **The graft owns the secondary
  SLOT, it does not append** (2026-09-05): a mono hero gains a second type, an innately
  dual one TRADES the one it was born with, and nothing ever reaches three types
  (`effectiveTypes`, `rosterEntryTypes`). A retype is a swap — it costs the old column and
  the STAB with it — so exactly one path per dual hero offers it, and that path carries the
  new type's line (`docs/leveling-and-ranks.md` "The RETYPE").

### Heroes & progression
- Heroes are **named, authored, fixed specialists** — **42, three a type (one starter, two
  recruit-only) for the fourteen draftable types, complete as of 2026-09-17** per user direction,
  replacing the ~53-concept target. Not procedurally generated. **41 as of 2026-09-19** (per
  user direction): Vesper is deleted, Widow moved Beast/Shadow → mono-Shadow into its seat, and
  Cinder Fire/Iron → mono-Fire, each with the type it lost bought back by an Evolution graft
  (Carapace, Ironclad); **Ursa** (mono-Beast, the slow bear — Attack 115 at Speed 20) took the
  Beast seat the same day. **The three-a-type count is the BASE roster's** (`docs/constellation.md`
  §4, §9): a hero with `HeroDefinition.unlock` is outside it, in a run's pools only while that
  Constellation offer is held (`heroPool`, `src/run/recruitment.ts` — the fork's contracts, the
  Guild Hall and the enemy party read it the way the itinerary reads `locationPool`), recruit-only
  and never in the draft. **Scallywag is the first** (same day, per user direction): Storm → mono-
  Iron, the Stormrunner graft his way back, in the **Free Company** bundle (8 stars) beside
  **Patch** (Mech, the Wisdom-85 medic drone on the repair column) and **Vex** (Beast, the
  Speed-110 vampire bat that feeds on Bleed, its Shadow turn a graft). **Skyshear** took Storm's third seat the same day: the slate's
  magical column at Int 95 / Speed 100. The base is 42 again and `test/roster` pins three a
  type, one starter, over `heroPool(heroes)` with nothing bought. **Starter Packs are BUILT**
  (same day, `docs/constellation.md` §11 phase 7): the draft reads `Profile.equippedPackId`
  (`src/run/starterPacks.ts`), pack zero is the fourteen starters, and **the Second String** —
  the base roster's recruit-only heroes, one a type — costs no stars and opens on the first
  cleared run; the Constellation's first shelf is the equip toggle, and every hero and place
  on any shelf can be examined before it is paid for.
- **Mono typing is a valid terminal state**, not a larval stage. Precedent: Pokémon
  Normal/Water/Bug. A numerically common mono type is not a design flaw.
- **Levels are AUTOMATIC and ROSTER-WIDE** (2026-09-10, `src/run/growth.ts`). Every roster hero
  levels every won encounter, fielded or benched. **No pool and no allocation** —
  `MAX_LEVEL` = 30. **Level is DERIVED from XP on `XP(L) = L³`** (2026-09-13, XP Overhaul
  phase 1, `xpForLevel` / `levelOf`), and **the XP a won encounter pays is the authored object**
  (2026-09-13, per user direction): `ENCOUNTER_XP_BY_ACT` = 150 / 560 / 1060 / 1750 / 2000 a
  fight (×1.25 on 2026-09-14, three fights an act)
  by act, the finale 5000, times the fought node's kind — **the Guardian ×2, the Elite ×1.5**
  (`ENCOUNTER_XP_MULTIPLIER`, 2026-09-14) — the one place a fight's kind prices its XP. Par
  (`levelAfterEncounters`) assumes the Skirmish at the fork, so an Elite is XP above par (five of
  them: a level by the end of act 5). Par is DERIVED from the sum and sized to reach the
  decided act ends, **8/14/19/24/28/30** (front-loaded in phase 6 because acts 1-2 measured as the
  run's wall); inside an act it walks 5/6/8, 10/11/14, 15/17/19, 20/21/24, 25/26/28 — three
  fights an act since 2026-09-14, the figures ×1.25 (150/560/1060/1750/2000) to hold the act ends.
  It replaced a level table paid out in XP sized to land par exactly ON a level every fight —
  which filled the bar to the top every time, so XP was invisible and the level count read as
  arbitrary. **The bar is real now**: the fight result and the level-up report sweep it from where
  the hero's XP stood to where the grant left it, a fight can leave it part-way (`xpProgress`,
  `xpToNextLevel`), and that partial is how catch-up reads. It is a **DELTA, never a target**: a hero that joins late has
  missed the grants before it and is behind — but the same XP climbs further from lower down the
  cube, so the gap closes slowly on its own. "Arrives underlevelled" stays a real archetype;
  "permanently" was reversed on purpose (`docs/xp-overhaul.md` §2) so that closing it is
  something the player can spend a node on (Ichor, phase 2).
  Participation-based XP was considered and **rejected** — it produces the runaway where your
  best four level, the sideboard rots, and by Act 4 you cannot rotate. Roster-wide gets the
  screen removal without buying that; a hero rotated in is at parity, so rotating is free.
  **The cost is real: hyperfocus dies as a LEVELLING strategy**, and is bought back by **Ichor**
  (2026-09-13, `src/run/ichor.ts`, `docs/xp-overhaul.md` §3): the two reward-row seats the Scroll
  Cache and Lone Scroll held, and the Guild Hall shelf, pay **3 (or 1.5) of the act's FIGHTS' worth
  of XP** (`ICHOR_FIGHTS`, 2026-09-14 — it was 2 (or 1) levels-at-par, the same value in a currency
  the player never saw) to ONE hero the player picks — more levels for a hero behind par, fewer for
  one ahead, since the cube throttles the carry and closes the gap with the same grant, and the who
  screen draws each hero's bar from → to so that is read, not told. A hero at the cap is refused.
  Every source is a seat that displaced another reward, so an Ichor is never free and never
  compounds. The supply is the only balance number and phase 6 sets it.
  **A level-up REPORT screen is not an allocation screen** (2026-09-10,
  `src/view/run/LevelUpScreen.tsx`): the ban is on a screen that collects a decision which is
  really a spreadsheet, not on the player seeing growth happen. It is first in the post-fight
  chain — the fight's own consequence, ahead of the Banner and everything under it — lists the
  whole roster, benched included, and gives **every** growth stat a cell whether or not it rolled,
  because the misses are what make the hits read as a roll against a grade. **It carries exactly
  ONE decision kind** (2026-09-13, XP Overhaul phase 3): once the rows have landed, each hero whose
  level has reached a schedule entry takes it there — a move offer over the report (a receipt
  below `MOVE_CAP`, replace-or-decline at it) or its Evolution as a screen of its own — in roster
  order, one entry a hero a beat (`src/view/run/levelUpFlow.ts`). It must not gain a second.
- **Each level rolls EVERY stat independently against that hero's growth grade for it.**
  A grade is a **distribution over points, not a coin** (`GRADE_ROLL`, 2026-09-10, per user
  direction — the flat "+2 or nothing" it replaced read as a schedule): a level lands **+0 to
  +4 points** on a stat, an S rarely missing (10%) and reaching +4, an F almost always missing
  (92%) and never passing +2. **A point is +1, or +3 HP, or +2 Mana** (CLAUDE.md's own
  measured HP break-even is ≈0.33 a point, so 3 HP IS 1 point's worth; Mana grows 2 since
  2026-09-13 because a Late move is priced in it and at 1 a point a 50-pool hero cast one once a
  fight at level 25 — player-only, since an enemy rolls no growth; `docs/mana.md` "Growing the
  pool" lists every faucet and why a Mana Well node is not one of them). **Every row's mean is exactly
  `0.1 + 0.3 × cost`** — what the flat roll paid — so the budget below and the phase-6
  difficulty re-fit both still hold; only the shape changed. Grades
  cover the **seven stats the 550 budget covers** — MP Regen excluded, as from every other
  per-hero grant. **Every hero's grades sum to exactly `GRADE_BUDGET` = 28** (an average of B):
  a SECOND budget, enforced by test beside the 550 one, because the 550 rule alone stops being
  sufficient the moment a low base with S-grades can outrun a high base with F-grades.
  **Base and growth are independent axes and that is the point** — low base + high growth is a
  late bloomer, high base + low growth is front-loaded. **All 36 heroes are authored**
  (2026-09-10); the budget and the no-placeholder rule are pinned in `test/roster.test.ts`,
  beneath the 550. Because a grade's mean is exactly linear in its cost, an on-budget line
  buys every hero the same 9.1 points a level — **a line decides where a hero grows, never
  how much** — so the two archetypes are placement, not size. Two authoring rules bound them: a
  hero's dump stat stays dumped (E/F, since that is what the 550 charged for), and a stat it
  genuinely swings or defends with never drops below C, which is where a trap pick comes from.
  `docs/types-and-heroes.md` "Growth grades".
- **Moves come from ONE faucet: the level-up SCHEDULE** (2026-09-13, XP Overhaul phase 3,
  `docs/xp-overhaul.md` §4, `src/run/progression.ts`; superseding the Mastery Scroll ladder of
  2026-09-10/§11/§12, deleted whole — no currency, no rung, no price, no purse, no bank, no
  Mastery screen). Every hero reads a `LevelSchedule` — `offerLevels`, `midLevel`,
  `evolutionLevel`, `lateLevel` — off its own LEVEL, the same schedule an enemy, a contract
  hero and a Guild hire read, so there is no longer a progression model the player's six carry
  that nobody else uses. **Keep the roll, lose the currency**: a level on `offerLevels` rolls ONE
  move from the band that level has opened (Early below `midLevel`, where it EXPIRES; Mid from
  there; Mid+Late from `lateLevel`) — take it or decline, burned either way, replace-or-decline at
  `MOVE_CAP`. The schedule says WHEN, the band says FROM WHAT, the roll says WHICH.
  **The schedule is walked one entry at a time** (`RosterEntry.scheduleTaken`, DERIVED owed entry
  via `pendingScheduleEntry`): a hero takes at most one entry per level-up, so a raw hire arrives
  with the entries below its level UN-taken and works them off one fight at a time — which is what
  its runway is — while a contract hero arrives with every entry below its level taken
  (`scheduleEntriesBelow`). A dry band pays nothing and the entry is still taken; the next level
  is what opens the next band. **All 36 heroes author their own schedule** (2026-09-13, phase 4,
  `src/data/heroes.ts`), inside the rules `test/moveTiers` pins: sorted offers, **4–7 a hero and
  under 6 on average** (the ladder's open-ended nine measured as 41 decisions a run), the
  Evolution in 10–24 with both ends populated, Mid before Late, an offer from every band
  (`movePoolFloor(schedule)`). Three groups by `evolutionLevel`: **early turners** (10–12, the
  Evolution inside Act 2 — Valor the fight after the tutorial, the brawlers and glass cannons),
  the **middle** (13–19, Act 3), **late turners** (20–24, Act 4 on — the slow tanks, the Colossus,
  and the front-loaded casters Marrow and Zenith). Deliberately NOT aligned with the grade
  archetype: a hero can bloom in stats and turn early, or the reverse. Per-hero timing is the
  lever the roster was missing — a sheet that says *evolves at 12* against one that says *evolves
  at 20* is an identity a player reads before drafting. `DEFAULT_SCHEDULE` (the old enemy table,
  nine offers) is what an unauthored definition — the Titanspawn — reads. **Each band offers its
  own tier** (phase 6): Early expires at `midLevel`, Mid at `lateLevel`, so the two Late offers are
  two Late moves; a graft's line is gated on reaching, not on the band, since its Early moves are
  the way into the new type. `growth-overhaul.md`
  §4's *ceiling behind the spend* guard rail retired with its premise: nothing is held, so
  nothing needs to sit behind a spend.
- **Evolutions come from the schedule's `evolutionLevel` — never from a beat, never from a
  spend** (2026-09-13, superseding the 4th rung). The level that reaches it raises that ONE
  hero's Evolution screen from the level-up report, in place of an offer — the Evolution is that
  level's whole reward — and takes the entry. Under the default it is level 16, Act 3 for a hero
  at par; the per-hero pass places it. A generated hero walks the same entries
  (`enemyGen.ts rollLevelProgression`), so rank and Evolution come from the same number a roster
  hero uses. `atEvolution` is the fixture helper that stands a hero at its entry.
- **The Crucible grants a CLASS** (2026-09-11). Same beat, same stage — *Guardian falls → Banner →
  Crucible → Pact Seal → act intro*, non-bankable, pick ONE hero — but what the fire tempers a
  hero into is a Class. Five Guardians, five Classes, six heroes: one hero ends Classless, the
  price of a late recruit. `crucibleReward` is deleted; its weight went to the (now Ichor) seat.
  **A Class is a VERB, never a number**: its schema is the Evolution path's minus the graft and
  the hero — a name, a kind, and exactly ONE of a granted move (`grantMove`, replace-or-decline
  at `MOVE_CAP`) or a passive (`ClassDefinition`, `src/run/classes.ts`; nine in
  `src/data/classes.ts`, three a kind; the Crucible rolls **three distinct from the whole catalog**,
  un-labelled — the one-per-kind roll and its Offensive/Defensive/Utility tags came off 2026-09-11
  per user direction). One per hero, replace-not-stack. **The hero at the rim is the hero
  tempered**: the Class choice has no way back to the roster.
  **Two exclusivity rules**, without which a Class is a Boon with a hat: a class passive is in no
  Boon pool, and a class move is in no level-up pool and no Tutor pool — untiered, and it **wears
  its holder's innate primary type** (`typeFollowsUser`, resolved once at the edge by
  `moveForHero` in `src/engine/state.ts` for the engine, the AI and every hero-scoped tile), so
  STAB is guaranteed and the chart is read at the hero's element. Authored as **role verbs** (a
  redirect, a priority strike, a spread, a heal, a hit-and-switch: the doubles toolkit no type
  slate covers evenly), never nukes.
- **The Mentor "teaches any hero a powerful move"** (2026-09-11, revised same day): acts 1–3
  (`LAST_MENTOR_ACT`), pick a hero, and **one Mid-tier move is ROLLED** from its pool —
  un-gated, a schedule offer with the band fixed at Mid that takes no entry (`mentorMovePool`,
  `src/run/tutor.ts`; `MentorNodeScreen`). The rolled offer is spent by being made, as a
  level's is. It was briefly a curated pick from the hero's Early-and-Mid list, which read as a
  designer's screen on one of a new player's first nodes; the roll keeps the payoff and leaves
  WHO as the only decision. With the Tutor it is the only way to a move AHEAD of its schedule.
  **Acts 4 and 5's spliced row is a forced Tutor** (2026-09-15; act 4's was the Forge until gear
  was absorbed — `docs/gear-absorption.md` §4).
- **Evolutions are authored branch points**, each option carrying a **single
  identifiable name** (e.g. Cinder's Explosive / Ironclad / Thunderblaze).
  **All 36 heroes are on the five-clause Evolution framework** as of 2026-09-05 — no
  path is ever a bare stat line (`docs/leveling-and-ranks.md`).
  Options take the hero in different directions, are **permanent within a run**, and gate the
  movepool. **The offensive / defensive / utility label is GONE** (2026-09-16, per user
  direction): `EvolutionPath.kind` and its badges are deleted, and a path is known by its name
  alone, and **a path id is `heroId-pathName`** (`cinderKnight-explosive`, the name camel-cased;
  `test/moveTiers` pins it). Stars recorded under the old `heroId-kind` ids were dropped.
- **Starters vs. recruit-only:** every hero is flagged `starter: true/false`
  (`HeroDefinition.starter`, `src/data/heroes.ts`). Starters are offered in the
  start-of-run draft; `starter: false` heroes exist only in the game, obtained
  in-run via Recruit Contract or Guild Hall. A hero is in exactly one pool, never
  both (`docs/types-and-heroes.md` "Starters vs. recruit-only heroes").
- **Recruitment: a contract hero arrives FINISHED, a Guild hire arrives RAW** (2026-09-10,
  Growth Overhaul phase 5). The line — *Guild heroes have decaying runway value; contract heroes
  have flat value* — is now true on **three axes**, where it used to be true on level alone.
  A **contract** hero (free, and it IS the enemy you beat) arrives with its Evolution already
  chosen, every schedule entry below its level taken, and a kit the game picked. A **Guild hire**
  (50g) arrives unevolved, its whole schedule still owed, holding its authored three moves — and
  works the backlog off one entry a fight. You save the walk on a contract, and in exchange you
  authored none of it.
  **RAW is unbuilt, not hollow** — a hire still gets the growth its levels earned, or it would be
  ~120 points behind a roster hero of the same level and simply a waste of gold.
  A hire arrives **one act behind**, `guildHallLevel` DERIVED from the level curve
  (`GUILD_HALL_ACT_LAG`, `src/run/difficulty.ts`) rather than authored beside it — that fixed
  act-sized gap IS the decaying runway, worth most early when one act is most of the run.
  **Two brakes on two routes:** gold prices the purchased one, the roster cap prices the free one
  (gaining requires terminating, and the terminated hero's gear goes with it). **A contract arrives
  ARMED** (2026-09-15, `docs/gear-absorption.md` §7): the piece the enemy fought in — rolled to fit
  it — is absorbed on the contract hero, the fifth finished axis against a hire's bare sockets.
  The LEVEL axis points the right way: a contract hero arrives at its NODE's enemy level
  (2026-09-15, `docs/enemy-levels.md` §4 — the Skirmish's is the player's par, 5/10/15/20/25,
  the Elite's a step over) against a hire's 2/9/15/20/25, so an Elite's contract outranks a hire
  and a Skirmish's never trails one. `test/recruitment.test.ts` carries the assertion that
  catches it inverting again.
- **Roster hard cap = 6, and EVERY fight fields the whole roster** (2026-09-17, per user
  direction, FOR PLAYTEST — `STANDARD_SQUAD_SIZE` = `ROSTER_CAP`, `src/run/squad.ts`; it was
  bring-6-pick-4). The pre-fight screen is **lead order**, not a pick: against a fully scouted
  AI party the pick was a chart lookup with a hidden answer key, and roster-wide levelling had
  already made rotation free. Lock-in derives from the side's size (`lockInThreshold`, half,
  floor 2), so six locks at **3**. Named costs, all open for playtest: the companion can no
  longer be benched out of a fight it would die in; Wounds lose the sideboard faucet (Rest, the
  mend and a contract carry it); the finale's squad size is no longer special. 6v4 is a player
  buff to be measured and absorbed by `ACT_LEVEL_ADJUST`, not by a bigger enemy party
  (`docs/combat.md` "The fielded roster"). Gaining a hero
  requires **terminating** an existing one. Equipment strips on termination; no gold refund.
  **One exception, the companion** (2026-09-13, Titanspawn overhaul §5, `src/run/companion.ts`):
  after the run's first fight one of the Early spawn it beat joins — it cannot be declined —
  as a hero in every respect but one: `RosterEntry.mortal`, and **a knockout removes it from
  the run** (its items strip to the bag). It takes a slot, levels roster-wide, takes its schedule's
  offers off its type's whole slate, and its schedule's `evolutionLevel` and `lateLevel` are
  **tier-steps** (Early → Mid, then Mid → Late) in place of a branch. One per run;
  a dead one is not replaced. **It does not count toward Act 1's enemy-count cap** (per user
  direction, same day): the cap reads the immortal roster, so the Act 1 Skirmish is 3v2. `rosterHeroes` (`data/content.ts`) is the roster-facing hero
  lookup for that reason; `heroes` stays the recruitable pool.
- **Items are uncategorised, and ABSORBED** (2026-09-06 for the first half, replacing the
  weapon/armor/accessory split, which playtested as fiddly and unintuitive; 2026-09-15 for the
  second, `docs/gear-absorption.md`, per user direction). Any item goes in any socket; **every
  hero has `BASE_ITEM_SLOTS` = 3 = `MAX_ITEM_SLOTS`**, no per-hero dial and nothing that grants
  more (the Forge and `bonusItemSlots` are deleted). **An item is given to a hero the moment it
  is received and never comes off** — the who-screen (`ItemWhoScreen`) is the one screen gear
  ever gets, with take / merge / sell as its verbs; there is no bag, no swap, no move, no later
  sale, and the Roster screen only reads. Permanence is what makes an item matter; supply is
  the balance number. **No hero holds two of one family**: the second one MERGES (`mergeIntoHeld`
  — a tier above the higher of the two, the held enchant surviving, the act window not
  consulted; Mythic and a Unique cannot). Capacity is decided in one place, `itemSlotsFor`.
  **Relics are the team-wide axis** — a separate axis, not items.
- **The relic catalog is ONE closed family of flat stats: the Guardian's Banners** (2026-09-07,
  replacing a ~50-relic random pool and the `relicReward` Shrine node, both deleted). Playtest
  found the pool collapsed into two buckets — a bigger stat grant, or a passive that was
  unanswerable applied to all four heroes at once — so the interesting grants live per-hero: on
  equipment and the Boon node. Nothing team-wide grants a passive or an Elemental Force, and a
  Banner is the ONLY team-wide grant of any kind.
- **The Tutor: one guaranteed seat in each of acts 4 and 5** (2026-09-07; reshaped 2026-09-13
  per user direction; act 5's moved to the forced spliced row 2026-09-14). `tutorReward` is **the Mentor's beat at the Late band**: pick a hero, and
  one **Late-tier move is ROLLED** from its pool — un-gated by level, taking no schedule entry,
  spent by being made (`tierMovePool`, `src/run/tutor.ts`; the Mentor is the same function at
  Mid). A guaranteed Late move, ahead of the band or beside it. It was a curated pick of ANY move
  off the pool — the run's strongest reward and its longest screen. **Both seats are the forced
  spliced row** since 2026-09-15 (`docs/gear-absorption.md` §4): act 4's used to sit inside a
  pick-1-of-3 reward row, priced by what it displaced, and moved to the row the Forge vacated.
  `docs/run-loop.md` "The Tutor".
- **Boons: the `passiveReward` node grants ONE hero a passive** (2026-09-07), the salvage of the
  passive relics — same effects, hero-scoped, so the scope that broke them is gone. 1-of-3 then
  pick a hero, via `grantEventPassive`; it stacks. The pool is every equipment/event passive plus
  **one type-locked +20% damage passive per type** (Ancient excluded), and a type one is offered
  **only when a roster hero fields that type** — the filter is what keeps it from ever being a
  dead card. Evolution passives, Classes and the new innate cards are excluded: all three are
  somebody's identity already (an innate that IS an equipment card stays, as that card).
  `src/run/boons.ts`, `docs/run-loop.md` "Boons".
- **There is no per-hero stat-investment currency** — with ONE authored exception since
  2026-09-13, per user direction: **the Mana Well** node (`manaWellReward`, `ManaWellScreen`,
  `grantManaWell`), pick a hero for +30 max Mana. Allowed because a pool is different in kind from
  the numbers the rule was written against: it is the stat a whole tier of moves is priced in, so
  +30 Mana is a Late cast a fight, visibly, where +10 Attack never was. It is an exception for
  mana alone; a Vitality shrine does not get to ride on it (`docs/run-loop.md` "The Mana Well").
  **A second named exception, 2026-09-17, per user direction: the Ley Line** (`leyLineReward`,
  `grantLeyLine`, `LEY_LINE_FORCE` = 10) — pick a hero for +10 Elemental Force at its innate
  primary, for the run, held on `RosterEntry.bonusStatusGrants` and summed with its gear's at
  fight build. Allowed because Force is not a stat: a typed BasePower term paid per hit, per
  target, only on the hero's own element, so it is read on every hit rather than on a sheet.
  Its sibling **the Forge** (`forgeReward`, `forgeItem`) is the Smithy's Anvil AND Enchanter free,
  once (2026-09-24, per user direction — the lift alone read as a trap pick) — one worn piece a
  tier up on the paid Anvil's own quote, so the act window still caps it, and bound to an element
  the player picks — and needs no exception. Together they are the Smithy's two verbs given map seats (25 each), which
  took the Scroll Cache from 59% of reward rows to 48% without its weight flowing into Equipment
  (`docs/run-loop.md` "The Forge and the Ley Line"); **the Cache's weight then came down 46 → 20**
  (same day, per user direction — two Caches an act was 47% of acts and, with the Scribe's 2, an
  Act 1 Evolution the default; at 20 it is one act in six, and an act holds one 60% of the time).
  Neither extends to a third.
  Gems were deleted whole on 2026-09-10
  (Growth Overhaul phase 1), and with them the `gemReward` Gem Cache and the two stat shrines
  (`hpBoostReward` Vitality, `manaBoostReward` Mana Well) — the reward pool's 40 freed weight
  went to the Boon and the purse. They failed against the rule the overhaul reduces to,
  **a bare number never gets a screen, and a screen never buys a bare number**: free
  re-allocation made the decision admin rather than strategy, "+5 Attack" never became a story
  the way a learned move does, and a run earned ~40 Gems against a roster capacity of 120, so
  the caps could not bind. ~200 stat points a run at roughly ten times the attention cost per
  point of one late Legendary. Stats become automatic and per-level in phase 3; until then the
  roster is that much lighter, and re-fitting the curve is phase 6's job, not a bug
  (`docs/growth-overhaul.md` §1, §7).
- **Item rarity is a point budget, spent exactly** (2026-08-30; rebased 2026-09-06): Common 30 /
  Rare 50 / Epic 70 / Legendary 90 / Mythic 110, paid in stats, Elemental Force magnitude, or
  granted passives (`RARITY_BUDGET`, `src/run/equipment.ts`; enforced by `test/equipment.test.ts`).
  Not every stat costs 1 — a point buys 3 HP (`HP_PER_POINT`, the measured break-even), MP Regen is
  3× (`STAT_POINT_VALUE`); Force is 2 a magnitude.
  **From Epic up an item must spend ≥⅓ of its budget on effects** — a passive or a Force, never
  stats alone (`EFFECT_FLOOR_SHARE`). Budgets tripled when heroes went from three slots to one,
  so the floor is what keeps a bigger item from being merely a bigger number.
  **Drop odds scale by act**: Legendary/Mythic cannot appear in Act 1, Common cannot appear
  in Act 5, elites roll one tier ahead (`rarityWeightsFor`, `docs/progression.md`).
  **Drop odds by node** (2026-09-15, measured, `docs/gear-absorption.md` §5): the opener always,
  the Skirmish 0.6, the Elite and the Guardian always — the opener's guaranteed item is the early
  game's power and every table without it lost the Act 1–2 wall by six to eight points.

### Mana & tempo
- Regenerating Mana with two stats: **pool size** and **per-turn MP Regen** (always written "MP Regen" — the bare word collided with the HoT status, now **Renew**).
- **Mana can exceed the pool** (2026-08-30, Arcane): a mana GRANT (`MoveDefinition
  .manaGrant`) overflows, and the overflow is uncapped, never clawed back by regen or
  Rest, and survives switching. It ends only by being spent or at the next map node
  (`docs/mana.md` "Overflow"). Every reader of `currentMana` must handle `> maxMana`.
- **Bench heroes regen mana** — this is the resource-cycling engine that makes switching
  productive.
- **Lock-in rule:** voluntary switching is disabled once **half a side is KO'd** — `ceil(size/2)`,
  floor 2 (`lockInThreshold`): 3 of the six a full roster fields, 2 of anything smaller (forced
  replacement of a downed hero still happens). This flips a fight from a cycling game into a
  grind — an intentional phase transition. **The one per-hero lock beside it is Ironbound**
  (2026-09-20, the Burden): both are read through `canSwitchOut`, never separately.
- **Rest** is a required choice when a hero does not have enough mana for any of their abilities.
  Recovers all mana, but skips the turn.
- **Mana tuning invariant:** *mana investment must pay out later than the point at which a weak
  team dies.* Keep this true when tuning any mana node or regen value.
- **The Pact Clock — the upper bracket on the invariant above** (2026-09-01,
  `src/engine/combat/pactClock.ts`). From **round 30** every **active** combatant — both
  sides; **the bench is out of the leak** since 2026-09-13 (Titanspawn overhaul §6, phase 5) —
  loses **10%** of max HP at the round boundary, rising **+5% per round**, so a full-HP hero
  dies five rounds in. Rotation spreads it, but every switch-in eats a tick, so stalls end
  later, not never. Direct HP loss: no Defense, no type
  chart, no variance, **no Shield** (2026-09-15, `docs/shield.md` §3.2), and **no passive
  reaction pass** — the terminator is not a trigger source. It closes the stall nothing else bracketed (mana regenerates, rounds were
  unbounded, stat mods have no ceiling). Escalating chip, not instant death, so the side
  that is ahead still wins and only the stall loses. Round 30 is a placeholder for a
  measurement — see `docs/combat.md`.

### Consumables
- **Two potions and a Revive, a team purse; the potions a FREE action** (2026-09-13,
  `src/run/consumables.ts`, `src/engine/combat/consumables.ts`). HP Potion and MP Potion each restore **half of max**,
  flat — outside the heal formula, no variance, no STAB. Drunk during the command phase on any
  **active** hero and applied to state on the spot, NOT declared into the round: the player sees
  the outcome before declaring, which is the point (an out-of-mana Rest row turns back into
  moves). **Not a passive trigger source**, like the Pact Clock. **A restore, never a grant** —
  Mana caps at the pool and overflow reads as full. **Player-only**; enemies never drink.
  Irreversible once drunk. Every run opens with one of each; **hold cap 3 a kind**, an over-cap
  drop or purchase is lost; faucets are the Guild Hall shelf (flat 20 gold, a pure sink) and a
  low-odds drop off a won encounter — deliberately no reward-node type. What a fight drank comes
  off the purse at resolve, so a replayed fight refunds it. **The Revive** (2026-09-17, per user
  direction) is the third kind and different in every way that matters: spent on a hero that is
  DOWN — on the **map**, on the squad screen, on a hero a fight left down (`reviveHero`, half HP),
  and **in a fight since 2026-09-18** (per user direction), from the Bag on the potions' terms,
  the fallen hero standing onto the bench at half (`useConsumable` 'revive') — the saved-for-the-
  finale layer of safety in a fight nothing mends inside;
  **sold steep, one a visit** (`REVIVE_PRICE` = 80, `REVIVE_PURCHASE_LIMIT` = 1, 2026-09-18 per
  user direction — the 09-17 "never sold" stood against a CHEAP one: a KO that 20g undoes is not
  a KO, one that 80g undoes and travels is a trade against the Anvil; measured, a pilot that buys
  one first at the Vigil takes the finale 52 → 57%) and never started with; its other faucet is
  its own rarer drop roll (`REVIVE_DROP_CHANCE`), taken only when the potion roll missed, so a
  fight drops one thing at most. `docs/run-loop.md` "Consumables".

### Architecture
- **All acquirable content — heroes, moves, abilities, relics, equipment — is pure data**
  referencing a shared engine vocabulary. No bespoke per-content logic. This is what makes the
  game maintainable and moddable; protect it.
- **Foundational contracts** the engine exposes: (1) effect primitives (atomic verbs),
  (2) trigger hooks (timing points), (3) status effects as their own content type, (4) the
  targeting model, (5) content schemas for all five content types. A 6th — **condition
  vocabulary** — is now implemented (`docs/conditions.md`, `src/engine/combat/statusEngine.ts`);
  see open questions for what's still pending designer confirmation.
- **Equipment and relics use the same hook-and-condition system as abilities**, unifying all
  five content types under one effect engine.
- **Resolution and presentation are separate layers.** The engine resolves a turn into an
  **ordered stream of discrete events** (act, damage, heal, faint, buff, …). The view layer
  *subscribes* to that stream and animates it. **Never bake timing, animation, or sound into the
  engine.** This separation is what lets "game feel" (juice, art, audio) be added and tuned
  forever without touching locked mechanics — proven by the two prototypes.

---

## Resolved design questions (2026-08-15 designer sign-off)

Decided; provisional/placeholder values in code are being promoted to locked as the
touching work happens. See the linked doc section for the decision, rationale, and
what's still unimplemented:

- Stat mods on switch: **persist** (`docs/combat.md`).
- Damage-modifier stacking: **multiplicative** (`docs/combat.md`).
- Turn vs round: the proposed model is now locked as-is (`docs/combat.md`).
- Crit source: **loadout/equipment layer**, not a base stat (`docs/combat.md`).
- Type-chart floor: **soft 0.25×, no hard immunities** (`docs/types-and-heroes.md`).
- Per-run reset vs meta-progression: **light meta-progression** — run state fully
  resets, permanent unlocks persist (`docs/progression.md`).
- Mana resource model/regen/starting state: **per-hero pool, regen every round for
  active + bench, full starting pool** (`docs/mana.md`).
- Five "50/50" heroes: general shape decided — **mono base, second type via an
  Evolution type-graft path** (`docs/progression.md` "Type-graft paths"), not
  inherent duals. Which specific type each hero starts mono as is still open (below).
- Run structure (2026-08-16 sign-off, multi-act extension 2026-08-17): **a Slay the
  Spire-style branching map** — a uniform per-act shape of forced Fight → pick 1 of 3
  reward → **the spliced seat** (Mentor in acts 1–3, Tutor in 4–5) → pick 1 of 3
  reward → pick 1 of 2 (**Elite or Skirmish** since
  2026-09-13, both recruitable, each tile previewing the enemy typing it fields from a draw
  seeded off the map so the preview IS the fight, and the two guaranteed to differ in a type —
  `src/run/encounters.ts`; it was Elite or Battle) → pick 1 of 3
  reward → the funnel → an end-of-act **Guardian** boss fight, no path ever skipping a
  fight, and no path ever losing a choice (`docs/run-loop.md`). **Three fights an act since
  2026-09-14** (per user direction): the un-forked Skirmish row between the opener and the
  fork came out to shorten the run without cutting a Location — it was the fight the sim
  measured as costing time and nothing else — the reward rows stayed at three, the act's XP
  was re-sized ×1.25 so par still lands 8/14/19/24/28, and Act 5's seat became a forced
  Tutor (its in-row seat stays in act 4 only). Measured: Reader 92 → 77 min, Auto 63 → 53,
  Act 1 clear 51 → 65% (`run-loop.md` "Three fights an act"). **2026-09-08:** a third
  reward row was added and the funnel became a **pick 1 of 2 from act 3** — Guild Hall or
  **Blacksmith** (item slots, the Anvil, the Enchanter). **Reversed 2026-09-15**
  (`docs/gear-absorption.md` §6): the Blacksmith is deleted, the funnel is **one forced Guild
  Hall every act**, and the Anvil and Enchanter sit on its Smithy tab over worn gear; the shelf
  sells no gear and nothing is sold. Map tiles
  **dropped their labels** to pay for the extra row — glyph, silhouette and colour carry
  what the words did, a long press still reads any node out, and this supersedes the
  two-word Monsters/Skirmish vocabulary below. **2026-08-29:** the boss was
  renamed Ancient → **Guardian**; "Ancient" is reserved for something later in a run and
  is otherwise only the locked TYPE, which is untouched. The map's encounter labels are
  now a two-word vocabulary — **Monsters** (not recruitable: `fight`, `battle`) and
  **Skirmish** (recruitable: `skirmish`, `elite`) — with difficulty carried by colour and
  glyph instead of by a third and fourth word. Node type *ids* are unchanged.
  **2026-09-08:** the reward row feeding Elite-or-Battle **fully connects** again,
  reverting the 2026-08-26 steering (left→Elite, right→Battle, middle→both). Steering
  priced the choice rather than removing it, and read correctly while the whole act was
  on screen to be read; it does not survive the map becoming a scene, where a reward two
  rows back quietly closing an encounter is a rule held in the head rather than seen. The
  lead-on markers came off that row with it, being derived. **5 acts of that shape,
  then a finale act** (2026-09-05, `docs/lore.md` + `run-loop.md` §4; **the finale corridor is
  Vigil → ONE fight since 2026-09-18, `docs/titan-eyes.md` §10** — the Herald leading one Late
  Titanspawn per broken seal, **warded while any of its company stands** (`wardedWhileCompanyStands`,
  bench included, so it falls last), then two mono-Ancient Eyes whose Gaze marks a hero Beheld
  and whose Regard can only be aimed at one — a `reserves` PHASE that enters once the Herald's
  is down, the Pact Clock counting from the phase, the phase-2 wide pair cut and **nothing given
  back at the boundary** (a mid-fight revive was tried and dropped the same day — knockouts
  carrying across phases were the wall, so the Herald's Oblivion 120 → 90 and Erode −15, the
  Eyes' HP ×1.5 and Int −20 pay for it instead); the Eyes set **Withering Gaze** (5% of max HP a
  round off every non-Ancient active, re-set every third round, answered only by a field of the
  player's own; `WITHERING_GAZE_FRACTION` is the dial); and a champion's hall after; **framed by three
  cinematic beats** — the Herald announced before the fight, the Titan rising OVER the fight as
  the Herald falls, and the collapse and re-binding under the title's seal when the Eyes close), are
  chained per run (`RunState.actNumber`, `TOTAL_ACTS`), each with a fresh map generated
  once the previous act's Guardian falls; 1 Recruit Contract is granted at the end of
  every act (replacing the removed `contractReward` map-node type — Recruit Contracts
  now come only from that per-act grant, a beaten enemy's contract claim, or a Guild
  Hall purchase). Beating an act's Guardian also grants **the Guardian's
  Banner** (2026-08-30; reshaped 2026-09-07; **three since 2026-09-14**, per user direction): a
  fixed, never-rolled **1-of-3** team-wide relic, one per CONCEPT — Warcry (offense: +40 Atk,
  +40 Int), Bulwark (defense: +15 Def, +15 Wis), Wellspring (staying power: +40 HP, +30 Mana,
  +10 MP Regen) — stackable across the five acts and displayed folded ("Banner of the Bulwark
  +2"), so a run's picks read as a team shape. The Warcry carries two stats because a hero
  swings with one or the other. **The figures are MEASURED parity, not a point scale**: the sim
  prices a point of Def/Wis at ~6× a point of Atk/Int, so +40 stands against +15 and the three
  land within half a standard error of each other under the skilled pilot. It was five, one per
  STAT: Vitality's HP moved to the Wellspring, and **Swiftness was deleted** — Speed pays only
  at a threshold, so a flat team-wide grant of it measured dead in every batch under both
  pilots and in play; no Banner carries Speed. Under the weak pilot the Bulwark still leads and
  the Wellspring trails (z ±2) — the open balance question for playtest (`docs/run-loop.md`
  "The Guardian's Banner"). **Enemies are LEVELLED, not stepped** (2026-09-15, per user
  direction, `docs/enemy-levels.md`, replacing the two-track act-step curve, the Elite's and
  Guardian's node-kind stat bonuses and the champion multiplier, all deleted): an enemy's ONE
  stat axis is its level, rolled through its growth grades from 1 exactly as a Guild hire's is —
  hero-pool enemy, Titanspawn and champion alike — and **shown** on the scouted chips, the node
  dossier and both sides' fight nameplates. The level is set **per node** off the player's PAR
  entering it plus a kind offset (`ENEMY_LEVEL_OFFSET`, `enemyLevelFor`,
  `src/run/difficulty.ts`): opener −3, `battle` −2, **Skirmish at par, Elite +1**, the
  Guardian's escorts −3 with the champion `CHAMPION_LEVEL_BONUS` = 2 over them, so a row of
  the map reads *Skirmish at your level, Elite a step over, the Guardian beaten on its body*;
  **plus the act's own term** (`ACT_LEVEL_ADJUST`, 2026-09-15: Act 1 −2, Acts 3 and 5 +2), the
  fine dial that shapes the run where the kind offsets shape a row.
  Mastery still reads off the act. **A champion is FRONT-LOADED**: `CHAMPION_GRADES`, all E,
  because on hero grades the Act 2 Guardian measured 67% cleared. **Enemy gear from Act 4**
  (`ENEMY_GEAR_FROM_ACT`, `EnemyLoadout`): one item each on the node's own rarity curve,
  stripped on a contract claim — level alone cannot track a player stacking Banners and
  late-window gear, and gear is the seam passives will share. Measured (sim pass 9): full-clear
  42.4% against the step curve's 43.6%, acts 79 / 79 / 98 / 76 / 92 against 85 / 85 / 96 / 76 /
  82 — Act 1 and Act 5 are the two dials named for playtest. Every number here is a first-pass
  figure; only the shape is decided. **HP persists across an act's
  nodes — Wounds — and mana does not** (2026-09-15, per user direction, FOR PLAYTEST;
  `src/run/wounds.ts`, `docs/run-loop.md` "Wounds"). A fight writes the fielded heroes'
  missing HP onto `RosterEntry.wounds`, and **a knockout PERSISTS** (2026-09-17, per user
  direction — the counterweight to every fight fielding the whole roster): a KO'd hero is
  `RosterEntry.down`, is not fielded (`standingRoster`, `pickSquad`), and stands up only at
  the **Rest** seat, the Guild Hall's **mend** (whole roster, the downed included, **priced by
  what is missing** since 2026-09-18 per user direction — `mendPrice`, `MEND_PRICE_PER_HERO` = 15
  a hero's worth of missing HP, a downed hero a whole one, floor 5, so six at half is 45 where
  the flat price was 40 and a scratch costs a scratch), a
  **Revive** (a rare drop, spent on the squad screen, half HP), or the act's end — the one free
  mend, everyone whole. The 25% walk floor this replaces was the guard against the 2026-08-16
  reversal, where raw persistence bricked a KO'd hero for the run with no way back; the four
  faucets are now the way back, and a KO is meant to cost the rest of the act. `down` is a flag,
  not `wounds >= max`, so a growth roll cannot stand a hero up. Potions stay in-fight only.
  Mana still opens full every fight; the enemy curve is untouched until it has been played. Relics are **stat-only**, by
  design rather than by deferral (see the relic-catalog invariant above).
- The first run on an account (2026-09-24, per user direction, replacing the scripted
  Valor-narrated Act 1 of 2026-09-05, deleted whole): **an ordinary run, nothing staged** —
  no forced pact, no curated map or fights. It adds information only: a **lore card** (four
  lines, one a tap, ahead of the first draft) and **first-time tips** — the first time a
  mechanic appears, a brief, out-of-universe card says what it is, **once per account**
  (`Profile.seenTipIds`). Tips are video-game information, never a hero speaking and never
  "we". Content `src/data/tips.ts`, mechanism `src/run/tips.ts`, reset from the Dev menu
  (`docs/tutorial.md`).
- Field Effects (2026-08-21 sign-off): resolves the former "weather subsystem" open
  question — Field Effects **is** that subsystem, generalized. A single global
  battlefield state (only one active at a time), settable by a move or a passive
  (relic/ability), lasting a flat **5 rounds** regardless of which effect; re-applying
  the active effect is a no-op, a different one overrides it and restarts the clock.
  Data-driven (`FieldEffectDefinition`, `docs/field-effects.md`); first content is
  **Magical Surge** (Arcane, displayed as "Surging Magic" until 2026-08-30 — id
  unchanged), doubling every hero's MP Regen while active.
  **A field is set three ways, and every field has all three** (2026-09-15, per user direction,
  after nine hours of play saw no field but Scorched Land and the sim put every setter at 0.35% of
  casts — `docs/field-effects.md` "Why four of five never appeared"): a **Herald** passive in the
  Boon pool (`heraldOf*`, SwitchedIn → setFieldEffect, type-gated on the flavour type, never
  once-per-fight, so a pivot re-sets a lapsed field and the locked no-refresh rule bounds it — the
  Drizzle shape, a field that costs no turn), an **Early rider** that does its type's job and sets
  the field on the way past (Sow, Hallow, Distort, Mana Font), and a **reader** whose power doubles
  under it (Flare Up, Resonant Bolt, Hindsight, Sunlance, Verdant Lash beside Smite and Overload),
  always pooled beside a setter. The spawn kits carry riders and readers, so the enemy side sets
  fields and "no owner" is counterplay. **Sanctuary keeps +1 heal priority and also heals ×1.5**
  (`healMultiplier`, a heal-pipeline term, never Wisdom). Verdant Earth's number is still the
  playtest's, untouched. The type-restricted damage term stays deferred. Measured: sets 14.0 →
  20.6 per 1000 player turns across the two phases, a field up at 14.7% of round ends,
  full-clear unmoved.

## Open questions — DO NOT silently resolve

Each has a *provisional* value baked into the prototypes for playability. Treat those as
placeholders, not decisions. Flag before hardening any of these:

- **Team archetypes are intentionally deferred** — they must *emerge* from movepool, ability,
  equipment, and relic design. Do not pre-specify archetypes.
- **Field Effects beyond mpRegenMultiplier:** a type-restricted damage-pipeline
  modifier ("certain type of moves") is named in the original ask but deliberately not
  yet wired into any engine module — see `docs/field-effects.md`.

---

## Prototype status

Two React single-file prototypes are the reference implementation of the combat loop. They are
**vertical slices, not the target architecture** — the engine here is inlined, not yet the pure
data + contracts model above. Port their *behavior*, not their structure.

- `prototypes/combat-prototype.jsx` — the mechanical slice: exact damage formula, 15-type chart,
  command-then-resolve, priority brackets, mana + bench regen, switching + lock-in, 8 heroes.
- `prototypes/combat-prototype-feel.jsx` — the same engine plus the **presentation layer**
  (sequenced resolution, HP-drain timing, floating numbers, particles, hitstop, screen shake,
  procedural Web Audio). This is the model for the engine→event-stream→view separation.

The 8 prototype heroes and the type chart are provisional content for testing the loop, not the
authored roster.

---

## Repo map (target)

- `CLAUDE.md` — this file. Keep it lean (<200 lines); adherence drops past that.
- `/docs/` — the deeper design modules (generate next): `combat.md`, `types-and-heroes.md`,
  `progression.md`, `mana.md`, `architecture.md`, `field-effects.md`, `run-loop.md`,
  `locations.md`, `events.md`, `lore.md`, `tutorial.md`, `visual-language.md` (presentation only). Reference from here; don't inline them.
  **`authoring-moves.md` is a runbook, not a design module** — read it before implementing
  a designed slate of moves for a type (all fifteen are authored as of 2026-09-17, Ancient
  last and enemy-only; Fire and Water are the worked examples, and §10 carries every hand-off).
  **`growth-overhaul.md` is built in full** — the replacement for levelling, movepool gating
  and Evolutions. Its §8 carries what each phase measured.
- `/prototypes/` — the two slices above, as behavioral reference.
- `/src/engine/` — the pure resolution engine + the six contracts.
- `/src/content/` — heroes, moves, abilities, relics, equipment as pure data.
- `/src/view/` — presentation layer; subscribes to the engine's event stream.

Build order: prove the six contracts + event stream in a thin TypeScript engine, port one
prototype exchange onto it end-to-end, *then* author the full roster as data.

---

## How to work in this repo

- Present tensions and second-order questions, not just answers. When a decision spawns a new
  question, name it.
- Don't re-litigate solved problems or over-elaborate on locked systems.
- Prefer deferring an open question explicitly over forcing premature closure.
- Anchor proposals in the reference games (Pokémon VGC, Guildrun, Monster Sanctuary, Into the
  Breach for feel) rather than rebuilding from first principles.
- Content is data. If a change wants bespoke logic in a content file, that's a smell — extend the
  engine vocabulary instead.
- **View layer, two standing rules** (both stated in `src/app/styles.css` and `overlayHost.ts`,
  both easy to break and hard to spot): nothing is selectable — never add
  `user-select`/`touch-callout`/`tap-highlight` to a component, the global `:root` block covers
  everything and `.selectable` is the only opt-in; and never `createPortal(…, document.body)` —
  use `overlayHost()`, since body sits outside the transform-scaled design canvas.
