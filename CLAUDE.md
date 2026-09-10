# TITANPACT — Project Constitution

Roguelike tactical RPG. Fully-piloted **doubles (2v2)** combat inspired by Pokémon VGC and
Guildrun. ~45-minute runs: draft → escalating fights → relics. Portrait-mode mobile.

**North star:** every hero must be viable under *some* combination of items, relics, and team
composition. No hero is a trap pick.

This file is the constitution: load-bearing rules and rationale. Deeper design lives in `/docs`
(see Repo map). When a rule here and a prompt conflict, this file wins — surface the conflict,
don't silently override it.

> **A partly-built overhaul supersedes part of this file: `docs/growth-overhaul.md`**
> (2026-09-10). Stats move onto automatic roster-wide levelling (Fire Emblem growth grades,
> cap 30), moves onto a **Mastery Scroll / Mastery Rank** currency, Evolutions onto **the
> Crucible** at the act boundary, and **Gems are deleted**. That doc's §9 lists the invariants
> scheduled for reversal; its §8 is the phase order and says which have landed.
> **Phases 1-2 are DONE (2026-09-10): Gems are gone, and moves come only from Mastery
> Scrolls.** Everything else below is still the rule in force and the code still implements it.
> Read it before touching levelling, movepools, Evolutions or reward nodes.

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
  are flat — a passive has no move to take STAB from. It exists because `HP_SCALE` is
  neutral for what repeats and not for what decays: `decay: 'halve'` caps a Burn's lifetime
  output at ≈2× its magnitude however long the fight runs. `docs/combat.md`.
- **Stat line:** HP, Attack/Defense, Intelligence/Wisdom, Speed, Mana, MP Regen.
- **Every hero's seven stats sum to exactly 550** — HP/Attack/Defense/Intelligence/
  Wisdom/Speed/Mana at FACE VALUE, HP counted at 1:1 (2026-09-09, replacing the 450
  budget that priced HP at half); **MP Regen sits outside it at a flat 10**. The rule is
  the number the hero sheet's Stat Total row already prints, so a line being on budget is
  checkable by the player and not only by the repo (`heroStatTotal`,
  `src/run/statBudget.ts`; `test/roster.test.ts`; `docs/types-and-heroes.md`). A
  specialist is signalled by spiking one stat past anything else in the roster, never by
  coming in under the total. The re-base took its points out of **HP** and held **Speed**
  fixed on every hero, compressing the roster's HP range from 160–300 to 180–250.
  **It deliberately over-charges HP** — measured break-even is ≈0.33 a point, enemy lines
  still pay `HP_BUDGET_VALUE` = 0.5 and equipment 0.25 — so it is a legibility call to be
  judged in playtest, and the walls are what to watch (`docs/progression.md` "Pricing HP").
- **Stat modifiers are flat additive integers, multiples of 5 or 10.** No % stat mods.
  There is **no automatic stat growth** from leveling. One documented exemption
  (2026-08-30): a **derived** grant, whose amount is read off live state rather than
  authored, lands unrounded — Arcane Overflow grants Attack/Intelligence equal to the
  caster's current Mana, and Beast's Apex Predator grants Attack equal to the caster's
  own current Attack (`MoveDefinition.derivedStatDeltas`, `docs/combat.md`). Two
  sources, one exemption; a third should be a conversation, not a habit.
- **No accuracy stat.** Moves always land. **Mana cost is the primary balance lever** on
  reliable moves.
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
- Heroes are **named, authored, fixed specialists** (~53 concepts). Not procedurally generated.
- **Mono typing is a valid terminal state**, not a larval stage. Precedent: Pokémon
  Normal/Water/Bug. A numerically common mono type is not a design flaw.
- **A level-up costs as many pool points as the hero's current level** (2026-09-01):
  1→2 costs 1, 4→5 costs 4, 10→11 costs 10 (`levelUpCost`, `costToReachLevel`,
  `src/run/progression.ts`). The flat 1 it replaced made the payout curve **convex** —
  the system paid more per point the harder the player hyperfocused. **Priced, not
  capped:** the carry build stays legal and is charged for in breadth. A **leftover pool
  that buys nobody is normal and banks**, so every gate is `canAffordAnyLevelUp`, never
  `levelUpPool > 0`. **Spending is optional** (2026-09-03): the player may bank a
  spendable pool and walk on (`RunState.levelUpDeferred`), which suppresses the gate
  until the next XP grant clears it; the map's status bar carries the banked figure and
  re-opens the screen. **The price flattens at `MAX_LEVEL_UP_COST` = 5** (2026-09-05) and
  **per-fight income now scales by act**, `+ACT_XP_STEP` per act past the first
  (`trainingPointsFor`, `ACT_XP_STEP`, `src/run/difficulty.ts`) — both reversing the
  earlier flat-income decision, because batch simulation showed **0.0% of heroes ever
  reached level 7**, where every move costing 70+ mana unlocks. Rationale, figures and the
  open tuning questions: `docs/leveling-and-ranks.md`.
- **Level-ups are a pooled currency** distributed freely after each battle (benched heroes
  included). A level **pays a stat**: it rolls three distinct combat stats and the player
  picks one, for a flat **+10** (`MASTERY_CHOICE_COUNT`, `drawMasteryStats`,
  `grantMasteryStat`, `src/run/progression.ts`). A choice rather than a forced roll because
  hyperfocus needs *aim*; three of five still withholds two, so the roll keeps mattering. The
  reel is the **five combat stats only** — HP/Mana/MP Regen are excluded because a flat +10 is
  not worth the same thing across all eight. The level-up that reaches the Evolution level
  instead **surfaces the Evolution choice**. Enforced by `test/mastery.test.ts`.
  **A level never teaches a move** (2026-09-10, Growth Overhaul phase 2), so the old
  `MASTERY_LEVEL` = 10 gate is inert: every level pays a stat, from the first.
- **Moves come from ONE faucet: Mastery Scrolls, gated by Mastery Rank** (2026-09-10,
  `docs/growth-overhaul.md` §4). A Scroll is poured into one hero on the Roster's Mastery
  board; it offers **one** move from that hero's pool — take it or decline, and the move is
  burned either way — and it ticks the rank bar. **`SCROLLS_PER_RANK` = 3, `MAX_MASTERY_RANK`
  = 3**, so six max a hero; rank 1 offers Early, 2 Mid (Early expires), 3 Mid+Late, mapping
  1:1 onto the authored 6/6/4 pools, so **no hero needed re-authoring**. Rank is **DERIVED**
  from `RosterEntry.masteryScrollsSpent`, never stored. **The tick lands before the roll**, so
  the third Scroll into a hero offers from the band it just opened.
  Income: **`SCROLLS_PER_ACT` = 2 at every Guardian** (10 guaranteed), plus the `scrollReward`
  Scroll Cache and the Guild Hall — ~15-18 a run, against six to max one hero.
  **Rank puts the ceiling behind the SPEND, never behind a clock** — act-gating the movepool
  makes holding a Scroll always better than spending one, and a currency whose optimal play is
  *don't spend it* can never feel good to receive. It is also where the carry build is priced
  in breadth, which uniform levelling will otherwise delete in phase 3.
- **A Scroll is refused only when it would buy LITERALLY nothing** — max rank AND nothing left
  to teach (`canSpendScroll`). A dry band below the cap still takes one, because the rank tick
  is the only thing that opens the next band and refusing there would strand the hero forever.
  The move-pool floor is now **`SCROLLS_PER_RANK` per offerable set** (`movePoolFloor`,
  `test/moveTiers.test.ts`): Scrolls make offers-per-hero player-controlled, so no depth can
  promise a pool "cannot be emptied" the way the old curve-derived margin did.
- **Evolutions are authored branch points**, each option carrying a **single
  identifiable name** (e.g. Cinder's Explosive / Ironclad / Thunderblaze).
  **All 36 heroes are on the five-clause Evolution framework** as of 2026-09-05 — no
  path is ever a bare stat line (`docs/leveling-and-ranks.md`).
  Options differ *in kind* (defensive / offensive / utility), are **permanent within a
  run**, and gate the movepool.
- **Starters vs. recruit-only:** every hero is flagged `starter: true/false`
  (`HeroDefinition.starter`, `src/data/heroes.ts`). Starters are offered in the
  start-of-run draft; `starter: false` heroes exist only in the game, obtained
  in-run via Recruit Contract or Guild Hall. A hero is in exactly one pool, never
  both (`docs/types-and-heroes.md` "Starters vs. recruit-only heroes").
- **Recruitment:** Recruit Contracts (claim a beaten hero; arrives with branches partially
  locked) or Guild Halls (spend gold; choose from a pool; arrives underleveled and fully
  customizable). Guild heroes have decaying runway value; contract heroes have flat value.
- **Roster hard cap = 6**, doubling as the bring-6-pick-4 battle sideboard. Gaining a hero
  requires **terminating** an existing one. Equipment strips on termination; no gold refund.
- **Items are uncategorised, and the SLOT is the scarce thing** (2026-09-06, replacing the
  weapon/armor/accessory split, which playtested as fiddly and unintuitive). Any item goes in
  any slot; **every hero starts on `BASE_ITEM_SLOTS` = 1** and there is no per-hero dial
  (2026-09-08). Nine heroes at **Speed ≤ 40** used to author 2, but Speed and HP are
  anti-correlated across the roster, so the rule read as a Speed rule and landed as an HP rule —
  and a measured 79.3% mirror-match edge for a second item dwarfed the tiebreak loss it was
  paying for. The **Forge** node grants +1 slot to one hero, to `MAX_ITEM_SLOTS` = 3.
  **No hero holds two copies of one item**, and capacity is decided in one place, `itemSlotsFor`
  (`docs/progression.md`). **Relics are the team-wide axis** — a separate axis, not items.
- **The relic catalog is ONE closed family of flat stats: the Guardian's Banners** (2026-09-07,
  replacing a ~50-relic random pool and the `relicReward` Shrine node, both deleted). Playtest
  found the pool collapsed into two buckets — a bigger stat grant, or a passive that was
  unanswerable applied to all four heroes at once — so the interesting grants live per-hero: on
  equipment and the Boon node. Nothing team-wide grants a passive or an Elemental Force, and a
  Banner is the ONLY team-wide grant of any kind.
- **The Tutor: one guaranteed seat in each of acts 4 and 5** (2026-09-07). `tutorReward` lets
  the player pick a hero and teach it **any** move from that hero's own level-up pool — un-rolled,
  un-tier-gated, and including moves a level-up already offered and had declined. It takes a seat
  **inside** a pick-1-of-3 reward row rather than a forced row of its own: that displacement (a
  Forge, a Boon, a purse) is the only price a reward row can charge, and it is why the strongest
  reward in the run is not free. Lategame-only because earlier the level curve is handing out
  moves anyway. `tutorMovePool`, `src/run/tutor.ts`; `docs/run-loop.md` "The Tutor".
- **Boons: the `passiveReward` node grants ONE hero a passive** (2026-09-07), the salvage of the
  passive relics — same effects, hero-scoped, so the scope that broke them is gone. 1-of-3 then
  pick a hero, via `grantEventPassive`; it stacks. The pool is every equipment/event passive plus
  **one type-locked +20% damage passive per type** (Ancient excluded), and a type one is offered
  **only when a roster hero fields that type** — the filter is what keeps it from ever being a
  dead card. Evolution passives and Classes are excluded: both are somebody's identity already.
  `src/run/boons.ts`, `docs/run-loop.md` "Boons".
- **There is no per-hero stat-investment currency.** Gems were deleted whole on 2026-09-10
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
  Not every stat costs 1 — HP is ½, MP Regen is 3× (`STAT_POINT_VALUE`); Force is 2 a magnitude.
  **From Epic up an item must spend ≥⅓ of its budget on effects** — a passive or a Force, never
  stats alone (`EFFECT_FLOOR_SHARE`). Budgets tripled when heroes went from three slots to one,
  so the floor is what keeps a bigger item from being merely a bigger number.
  **Drop odds scale by act**: Legendary/Mythic cannot appear in Act 1, Common cannot appear
  in Act 5, elites roll one tier ahead (`rarityWeightsFor`, `docs/progression.md`).

### Mana & tempo
- Regenerating Mana with two stats: **pool size** and **per-turn MP Regen** (always written "MP Regen" — the bare word collided with the HoT status, now **Renew**).
- **Mana can exceed the pool** (2026-08-30, Arcane): a mana GRANT (`MoveDefinition
  .manaGrant`) overflows, and the overflow is uncapped, never clawed back by regen or
  Rest, and survives switching. It ends only by being spent or at the next map node
  (`docs/mana.md` "Overflow"). Every reader of `currentMana` must handle `> maxMana`.
- **Bench heroes regen mana** — this is the resource-cycling engine that makes switching
  productive.
- **Lock-in rule:** voluntary switching is disabled once a side has **2+ heroes KO'd** (forced
  replacement of a downed hero still happens). This flips a fight from a cycling game into a
  grind — an intentional phase transition.
- **Rest** is a required choice when a hero does not have enough mana for any of their abilities.
  Recovers all mana, but skips the turn.
- **Mana tuning invariant:** *mana investment must pay out later than the point at which a weak
  team dies.* Keep this true when tuning any mana node or regen value.
- **The Pact Clock — the upper bracket on the invariant above** (2026-09-01,
  `src/engine/combat/pactClock.ts`). From **round 30** every combatant — both sides,
  **active and benched** — loses **10%** of max HP at the round boundary, rising **+5% per
  round**, so a full-HP hero dies five rounds in. Direct HP loss: no Defense, no type
  chart, no variance, and **no passive reaction pass** — the terminator is not a trigger
  source. It closes the stall nothing else bracketed (mana regenerates, rounds were
  unbounded, stat mods have no ceiling). Escalating chip, not instant death, so the side
  that is ahead still wins and only the stall loses. Round 30 is a placeholder for a
  measurement — see `docs/combat.md`.

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
  reward → Skirmish → pick 1 of 3 reward → pick 1 of 2 (Elite or Battle) → pick 1 of 3
  reward → the funnel → an end-of-act **Guardian** boss fight, no path ever skipping a
  fight, and no path ever losing a choice (`docs/run-loop.md`). **2026-09-08:** a third
  reward row was added and the funnel became a **pick 1 of 2 from act 3** — Guild Hall
  (people and new gear, and the run's only place to SELL) or **Blacksmith** (item slots,
  the Anvil, the Enchanter, all for gold). One verb family per node; the Anvil and
  Enchanter left the Guild Hall, and the free `forgeReward` Forge is unchanged. Map tiles
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
  then a finale act** (2026-09-05, `docs/lore.md` + `run-loop.md` §4), are
  chained per run (`RunState.actNumber`, `TOTAL_ACTS`), each with a fresh map generated
  once the previous act's Guardian falls; 1 Recruit Contract is granted at the end of
  every act (replacing the removed `contractReward` map-node type — Recruit Contracts
  now come only from that per-act grant, a beaten enemy's contract claim, or a Guild
  Hall purchase). Beating an act's Guardian also grants **the Guardian's
  Banner** (2026-08-30; reshaped 2026-09-07): a fixed, never-rolled **1-of-5** team-wide relic,
  one per axis — Vitality (+30 HP), Warcry (+20 Atk, +20 Int), Bulwark (+15 Def, +15 Wis),
  Swiftness (+20 Speed), Wellspring (+40 Mana, +10 MP Regen) — stackable across the
  five acts and displayed folded ("Banner of Vitality +2"). The Warcry carries two stats at
  full value because a hero swings with one or the other; the Bulwark's two are both live on
  every hero, so they are priced at +15. Their relative values
  are an open balance question (`docs/run-loop.md`). **Encounters scale by act**
  (2026-08-30) on two tracks (`src/run/difficulty.ts`): **Monsters** baselines at Act 2
  (placeholder — per-act monster content isn't authored yet), **Skirmish/Guardian** at
  Act 1, and acts past a track's baseline walk an **accelerating** `ACT_STEP_CURVE`
  (`[0, 1, 3, 6, 10]` cumulative steps of +30 stat total each) on top of the node-kind
  bonus. It accelerates because it has to track a player whose growth does: measured, a
  linear curve had enemy stats growing +239/+161/+90/+87 an act against the player's
  +254/+192/+364/+399 (2026-09-05, `scripts/sim`). Enemy level runs **1 / 3 / 5 / 7 / 10**
  by act, so from Act 3 on every hero-pool enemy arrives already **evolved**, and a Recruit
  Contract claims it at that level — but note that **level is inert for a Guardian's
  champion**: every champion ships a full 4-move kit and `appendFinalEnemy` runs no level
  progression, so the stat curve is the only lever that touches it. Every number here is a
  first-pass figure for playtest; only the shape is decided. HP/mana **fully restore
  between map nodes** — reversed same-day from an initial persist-across-nodes design
  after first playtest showed a KO'd hero simply stayed dead-weight into the next
  fight with no way to recover it (`docs/run-loop.md`). Relics are **stat-only**, by design
  rather than by deferral (see the relic-catalog invariant above).
- The first run on an account (2026-09-05 sign-off): **scripted through Act 1**, narrated by
  **Valor**, with Valor + Fang forced as the pact and the act's map narrowed to **one node
  per row**. Every line and every curated encounter is content (`src/data/tutorial.ts`);
  mechanism is `src/run/tutorial.ts`. Gated on `Profile.tutorialDone`, set when Act 1's
  Guardian falls — so a wiped tutorial is offered again. Act 2 onward is an ordinary run
  (`docs/tutorial.md`).
- Field Effects (2026-08-21 sign-off): resolves the former "weather subsystem" open
  question — Field Effects **is** that subsystem, generalized. A single global
  battlefield state (only one active at a time), settable by a move or a passive
  (relic/ability), lasting a flat **5 rounds** regardless of which effect; re-applying
  the active effect is a no-op, a different one overrides it and restarts the clock.
  Data-driven (`FieldEffectDefinition`, `docs/field-effects.md`); first content is
  **Magical Surge** (Arcane, displayed as "Surging Magic" until 2026-08-30 — id
  unchanged), doubling every hero's MP Regen while active.

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
  a designed slate of moves for a type (1 type still to go — Ancient; Fire
  and Water are the worked examples, and §10 carries all fourteen hand-offs).
  **`growth-overhaul.md` is a destination plus a route, and only phases 1-2 of §8 are built** —
  the replacement for levelling, movepool gating and Evolutions. Check §8 before assuming.
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
