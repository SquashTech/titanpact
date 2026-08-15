# progression.md

> How heroes and teams grow across a run: the level-up currency, rank-ups, equipment,
> relics, XP, and the raise-vs-recruit axis. Rules only — grant values, XP rates, and
> equipment/relic content are **data** (`/data`). Combat effects of these systems
> resolve through the stat and damage pipelines in `architecture.md`.

## Progression philosophy: level-ups unlock, they don't inflate

The core rule that keeps balance legible:

- **Level-ups never directly raise a stat.** Leveling **unlocks moves** and **drives
  rank-ups**. It does not silently pump numbers.
- Stat growth, where it happens, comes through **rank-up branches** as explicit
  grants — never as an invisible per-level drip.

This separation is deliberate: it means a hero's power at any moment is explained by
*visible choices* (which moves, which rank branch, which gear, which relics), not by
an opaque level curve.

---

## The level-up currency (pooled, freely distributed)

- Leveling uses a **pooled level-up currency**, distributed **freely** across the
  roster by the player — not a per-hero locked XP track for spending. 
- The player chooses where to invest the pool. This is a strategic decision surface,
  not an automatic allocation.

---

## Rank-ups (LOCKED rules)

> **`docs/leveling-and-ranks.md` is now the authoritative spec for level-ups and
> rank-ups** and supersedes this section where they disagree. The type-graft/shift
> question is reconciled (below — secondary type can shift, 2026-08-15 sign-off) and
> implemented. **Still not reconciled:** the leveling *currency* mechanic itself —
> `leveling-and-ranks.md` describes discrete per-battle level-up grants that always
> trigger a movepool event, with rank-up triggered automatically at a level
> threshold; the current implementation (`src/run/progression.ts`) still uses the
> *older* pooled-points-via-two-independent-spends model (`unlockTierMove` /
> `investRankProgress`) documented below. Deliberately left as-is for now — the
> newer spec still has its own open item (bench-XP reconciliation) and rewiring the
> engine is real scope; flag before doing that rewrite rather than drifting into it.

- Level-ups **drive rank-ups**; rank-ups are where a hero's identity branches.
- **Rank-up branches differ in kind, not degree.** A branch is not "the same hero but
  bigger numbers" — branches take the hero in genuinely different directions
  (different kits, roles, tools). Do not implement branches as tiered stat bumps.
- **The hero's innate type is immutable across all rank-ups** (`types-and-heroes.md`).
- **Mono is a valid terminal rank state** — a hero can be fully realized without ever
  branching into a second type. Don't gate "finished" on dual-typing.

### Stat grants

- Where a rank-up (or other source) grants stats, **grants are always multiples of 5
  or 10.** Never grant 7, never grant 12. This keeps the number space clean and
  readable.
- Grants feed the **stat pipeline** (`architecture.md`) as part of effective stats.

### Rank-up sequencing (LOCKED — matches the implemented model)

- A hero's rank-up line is an **ordered list of nodes**, authored per-hero in
  `/data`. Node count is the hero's evolution depth (`CLAUDE.md`: Capstone = 0
  nodes, Single = 1, Deep line = 2+).
- Each node has a **threshold** and a set of branches. `rankProgress` accumulates
  **cumulatively across the whole line** — a node's threshold is the total
  invested progress required, not a delta since the last rank-up. (E.g. a
  two-node hero with thresholds 3 and 8 needs 8 total invested points to reach
  the second node, not 3 then 8 more.)
- Node *N* becomes available once `rankProgress >= node[N].threshold` **and**
  every prior node already has a branch chosen. Nodes are not conditioned on
  *which* branch was picked at a prior node — every hero has one fixed
  sequence of nodes; branch choice changes what that node grants, not which
  node comes next. Revisit this if a hero design genuinely needs diverging
  future nodes per earlier branch — it's a bigger data-model change, not a
  default to reach for.
- Choosing a branch is **free** — the cost was already paid via the points
  spent reaching the node's threshold. Choosing is a separate action from
  paying, and is one-shot per node.

### Type-graft branches (reconciled with `docs/leveling-and-ranks.md` — 2026-08-15)

- A rank-up branch may optionally **graft or shift the secondary type slot** on a
  hero, per `docs/leveling-and-ranks.md` "The immutability nuance": the innate
  **primary** type never changes; the **secondary** type slot is the rank-up
  branch axis and can be set by one rank-up and **replaced by a later one.**
- **Only mono-type heroes have a free secondary slot to start.** A hero authored
  with two innate types already has both type slots filled by design — a branch
  must never offer a graft/shift to an already-dual-by-design hero. This is
  enforced at data-application time, not just by authoring convention.
- **A graft can be overwritten by a later graft branch**, any number of times
  across a hero's rank-up line — each application simply replaces the current
  secondary type with the new one. There is still only ever **one** secondary
  slot (Titanpact heroes cap at two types total, `types-and-heroes.md`); shifting
  isn't stacking a third type, it's swapping what occupies the second one.
- The **innate primary type never changes.** Type-graft/shift only ever touches
  the secondary slot; the authored `HeroDefinition.types` primary stays
  immutable. The hero's effective types for combat purposes (STAB, and being the
  target of an opponent's `TypeMult`) are the innate primary **plus** the current
  secondary-slot grant (if any), resolved at the combat layer — never written
  back onto the authored hero data.
- A branch that grafts a type may **also** carry `statGrants` /
  `unlocksMoveIds` — grafting isn't mutually exclusive with the rest of a
  branch's payload, it's one more thing a branch's "kind" can express
  (typically fits an `offensive` or `utility` branch reframing the hero's
  toolkit around a new domain, but nothing mechanically requires that pairing).
- **Mono remains a legitimate terminal state.** Not grafting is always a valid
  choice among a node's branches — a graft branch should normally be offered
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
