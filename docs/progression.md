# progression.md

> How heroes and teams grow across a run: the level-up currency, Evolution, equipment,
> relics, XP, and the raise-vs-recruit axis. Rules only — grant values, XP rates, and
> equipment/relic content are **data** (`/data`). Combat effects of these systems
> resolve through the stat and damage pipelines in `architecture.md`.

## Progression philosophy: level-ups unlock, they don't inflate

The core rule that keeps balance legible:

- **Level-ups never directly raise a stat.** Leveling **unlocks moves** and **drives
  Evolution**. It does not silently pump numbers.
- Stat growth, where it happens, comes through **Evolution paths** as explicit
  grants — never as an invisible per-level drip.

This separation is deliberate: it means a hero's power at any moment is explained by
*visible choices* (which moves, which Evolution path, which gear, which relics), not by
an opaque level curve.

---

## The level-up currency (pooled, freely distributed)

- Leveling uses a **pooled level-up currency**, distributed **freely** across the
  roster by the player — not a per-hero locked XP track for spending. 
- The player chooses where to invest the pool. This is a strategic decision surface,
  not an automatic allocation.

---

## Evolution (LOCKED rules)

> **`docs/leveling-and-ranks.md` is now the authoritative spec for level-ups and
> Evolution** and supersedes this section where they disagree. The type-graft/shift
> question is reconciled (below — secondary type can shift, 2026-08-15 sign-off) and
> implemented. **Reconciled (2026-08-16 playtest sign-off):** the leveling
> *currency* mechanic now matches `leveling-and-ranks.md` — `src/run/progression.ts`
> implements `levelUpHero` (spends one pooled Training Point, incrementing
> `RosterEntry.level`) plus `grantLevelUpMove` (resolves that level-up's random move
> offer: gained outright under the 4-move cap, or an accept/decline replacement
> choice at cap). The older two-independent-spends model (`unlockTierMove` /
> `investRankProgress`) is removed. Spending is also now forced immediately after
> every points grant (`LevelUpScreen`), not deferred via Manage Roster. **Still
> open:** the bench-XP reconciliation question below is unaffected by this change
> (points are still freely distributable to any roster hero, benched or active).
>
> **Renamed and re-scoped (2026-08-16):** what this section used to call
> "rank-up" is now **Evolution** (docs/leveling-and-ranks.md's terminology, matched
> here and in code — `RankUpBranch`/`chooseRankUpBranch` etc. are now
> `EvolutionPath`/`chooseEvolutionPath`). The trigger is also simplified for the
> current implementation pass: instead of a per-hero-authored `rankProgress`
> threshold, every hero now Evolves at the same flat, uniform level
> (`EVOLUTION_LEVEL`, currently 5) — and the level-up that reaches it **replaces**
> that level-up's move offer rather than granting one alongside the Evolution
> choice. See `leveling-and-ranks.md` Part 2 for the full rule and its scope note
> reconciling this against `CLAUDE.md`'s variable evolution-depth design intent.

- Level-ups **drive Evolution**; Evolution is where a hero's identity branches.
- **Evolution paths differ in kind, not degree.** A path is not "the same hero but
  bigger numbers" — paths take the hero in genuinely different directions
  (different kits, roles, tools). Do not implement paths as tiered stat bumps.
- **Every path carries a single identifiable name** (`leveling-and-ranks.md`) — e.g.
  Cinder's Explosive / Ironclad / Thunderblaze — not just a `kind` label.
- **The hero's innate type is immutable across all Evolution** (`types-and-heroes.md`).
- **Mono is a valid terminal state** — a hero can be fully realized without ever
  branching into a second type. Don't gate "finished" on dual-typing.

### Stat grants

- Where an Evolution path (or other source) grants stats, **grants are always
  multiples of 5 or 10.** Never grant 7, never grant 12. This keeps the number space
  clean and readable.
- Grants feed the **stat pipeline** (`architecture.md`) as part of effective stats.

### Evolution sequencing (current scope — see `leveling-and-ranks.md` for the deferred multi-node design)

- A hero's Evolution line is an **ordered list of nodes** (`ProgressionTable.evolutions`,
  `src/run/progression.ts`), authored per-hero in `/data`. **Currently every hero has
  exactly one node**, gated on hero level rather than an accumulated-progress
  threshold — `EVOLUTION_LEVEL` is a single flat engine constant, not per-hero data.
  Multiple ordered nodes (Capstone = 0 / Single = 1 / Deep-line = 2+ per `CLAUDE.md`)
  are a deferred extension of this same shape, not a different one.
- Node *N* becomes available once `entry.level >= node[N].level` **and** every prior
  node already has a path chosen. Nodes are not conditioned on *which* path was
  picked at a prior node — path choice changes what that node grants, not which node
  comes next. Revisit this if a hero design genuinely needs diverging future nodes
  per earlier path — it's a bigger data-model change, not a default to reach for.
- Choosing a path is **free** and one-shot per node — the point cost was already paid
  reaching the node's trigger level via level-ups.

### Type-graft paths (reconciled with `docs/leveling-and-ranks.md` — 2026-08-15)

- An Evolution path may optionally **graft or shift the secondary type slot** on a
  hero, per `docs/leveling-and-ranks.md` "The immutability nuance": the innate
  **primary** type never changes; the **secondary** type slot is the Evolution
  branch axis and can be set by one Evolution and **replaced by a later one.**
- **Only mono-type heroes have a free secondary slot to start.** A hero authored
  with two innate types already has both type slots filled by design — a path
  must never offer a graft/shift to an already-dual-by-design hero. This is
  enforced at data-application time, not just by authoring convention.
- **A graft can be overwritten by a later graft path**, any number of times
  across a hero's Evolution line — each application simply replaces the current
  secondary type with the new one. There is still only ever **one** secondary
  slot (Titanpact heroes cap at two types total, `types-and-heroes.md`); shifting
  isn't stacking a third type, it's swapping what occupies the second one.
- The **innate primary type never changes.** Type-graft/shift only ever touches
  the secondary slot; the authored `HeroDefinition.types` primary stays
  immutable. The hero's effective types for combat purposes (STAB, and being the
  target of an opponent's `TypeMult`) are the innate primary **plus** the current
  secondary-slot grant (if any), resolved at the combat layer — never written
  back onto the authored hero data.
- A path that grafts a type may **also** carry `statGrants` /
  `unlocksMoveIds` — grafting isn't mutually exclusive with the rest of a
  path's payload, it's one more thing a path's "kind" can express
  (typically fits an `offensive` or `utility` path reframing the hero's
  toolkit around a new domain, but nothing mechanically requires that pairing).
- **Mono remains a legitimate terminal state.** Not grafting is always a valid
  choice among a node's paths — a graft path should normally be offered
  alongside a non-graft alternative at that node, not forced.

---

## Equipment (per-hero)

- **3 slots per hero: weapon, armor, accessory.**
- Equipment contributes through the **stat pipeline** (stat-shaped effects) or the
  **damage multiplier term** (damage-shaped effects) per the pipeline rules in
  `architecture.md` — same discipline as everywhere: stat effects go in stats, damage
  modifiers go in the multiplier term.
- **Equipment strips on contract termination.** When a hero leaves the team
  (contract terminated), their gear is removed. Model equipment as attached to the
  hero's roster slot, not permanently bound to the hero object, so termination cleanly
  reclaims it.
- **Rarity tiers (2026-08-17, per user direction): Common/Rare/Epic/Legendary/Mythic**,
  gray/blue/purple/gold/red — `EquipmentDefinition.rarity` (`src/run/equipment.ts`
  `EquipmentRarity`), with per-tier colors as CSS custom properties (`styles.css`
  `--tier-*`) so every rarity-colored element (Equipment Cache cards, the
  forced-equip spotlight) stays in sync from one source. `RARITY_DROP_WEIGHTS`
  biases `equipmentReward` node rolls toward common gear; the roster hard cap and
  authored-content scope (`equipment.ts`'s fixture items) are unaffected — tiering is
  purely a rarity/color/drop-weight classification on top of the existing
  `statGrants` model, not a new stat-scaling system.
- **No unequipped-item stash (2026-08-17, reversing the 2026-08-16 third-playtest
  design — per user direction, "adds unnecessary player busywork").** Every item
  obtained, from a battle win or an `equipmentReward` node alike, must be equipped to
  a hero or trashed for good before the run continues (`ForceEquipScreen`,
  `docs/run-loop.md` "The unequipped-item inventory was removed"). `RunState` no
  longer has an `inventory` field.

> The **crit source** question (`combat.md`) lands partly here: it's now LOCKED as a
> loadout/equipment layer, not a base stat — so it's an equipment concern. Not yet
> implemented: `equipment.ts` has no crit-chance field yet (see `combat.md` "Crit").

---

## Relics (team-wide)

- Relics are **team-wide passives** and a **separate progression axis** from per-hero
  equipment. Do not merge relic logic into the equipment system — they progress
  independently and apply to the whole team, not a slot.
- Relic effects still respect the pipeline discipline: stat-shaped → stat pipeline,
  damage-shaped → multiplier term.

---

## The raise-vs-recruit axis (LOCKED design intent)

**Starters vs. recruit-only (`types-and-heroes.md` "Starters vs. recruit-only
heroes"):** `HeroDefinition.starter` gates whether a hero is ever offered in the
start-of-run draft. `starter: false` heroes are recruit-only — the raise-vs-recruit
axis below is *how* you get them, this flag is *whether* you have to. Both dimensions
apply per hero independently (a recruit-only hero can still be raised via Guild Hall
or recruited via Contract, same as a starter you didn't happen to draft).

Two sources of heroes, with intentionally different value curves:

- **Guild Hall heroes (raise).** Carry **runway value** — upside you unlock by
  investing level-up currency and time. That runway **decays late-run**: there's
  eventually not enough run left to cash in the investment.
- **Contract heroes (recruit).** **Flat-value veterans** — they don't develop much,
  but they're immediately useful and don't need runway.

The intended play pattern — **develop early, plug-and-play late** — should **emerge
from these timing dynamics**, not from scripting. Don't hard-code "late-run, prefer
contracts." Set the value curves and let the correct behavior fall out. If it doesn't
emerge, that's a tuning signal on the curves (bench XP rate, grant sizes, run length),
not a reason to script the AI or nudge the player.

**IMPLEMENTED (the generic mechanism):** `src/run/recruitment.ts`. Guild Hall spends
`RunState.gold` on a fresh, 0-progress, ungeared `RosterEntry` from a data-driven offer
pool (`src/data/recruitment.ts`, provisional flat costs). Recruit Contracts derive a
claimable offer from a defeated enemy's `RosterEntry` — carrying its level, chosen
Evolution paths, stat grants, and type-graft, but not its equipment (an assumption,
not a cited rule — equipment is roster-slot-attached, not hero-bound, and neither this
doc nor `CLAUDE.md` says whether captured gear transfers). The trigger is real, not a
placeholder: claiming reuses the specific map node's own generated AI roster
(`src/run/enemyGen.ts`), now that the run loop exists (`run-loop.md`).

**Recruit Contracts are a scarce currency, not a free-and-unlimited claim (2026-08-16
playtest pass).** `RunState.recruitContracts` starts at 1 per run and is spent (not
gold — free in that sense) on every `claimContract`; claiming with none available is
rejected (`RecruitmentError`). More can be found via a `contractReward` map node
(`run-loop.md` node types) or bought at a Guild Hall for a flat 12g
(`buyContract`, `src/data/recruitment.ts` `CONTRACT_PURCHASE_COST`) — deliberately
cheaper than a direct 20g hero recruit, since a contract still requires beating
something specific to cash in. **NOT YET IMPLEMENTED:** the decaying Guild Hall
runway value curve (offers are flat gold costs, not a value that decays as the run
progresses).

---

## Per-run reset vs. meta-progression (LOCKED — 2026-08-15 designer sign-off)

**Light meta-progression: unlocks only.** Every run resets the roster, level-up
pool, equipment, and relics to zero — there is no persistent currency or
account-level power growth (rejected: a heavier meta-currency/upgrade layer, to
protect per-run balance legibility, `CLAUDE.md` north star). What *does* persist
across runs is the **pool of what a future run can draw from**: permanent unlocks
(new heroes, relics, equipment becoming available to draft) live in **meta state**
(`architecture.md` "State shapes"), separate from the **run state** that resets.
This is the standard roguelike-lite shape (Slay the Spire, Hades): each run is a
fresh attempt from an unlock pool that only grows.

**NOT YET IMPLEMENTED:** there is no meta-state layer, save format, or unlock-pool
model in code yet — this section records the design decision the eventual
implementation must honor, not a built system. Building it is real scope: a save
file, an unlock-pool data shape, and the run-state initialization reading from it.
