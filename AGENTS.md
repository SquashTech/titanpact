# Titanpact — Working Guide

Titanpact is a portrait-mobile, fully piloted **2v2 tactical roguelike**. Its strategic
references are Pokémon VGC and Guildrun; its run-map structure is closer to Slay the
Spire. A run is built around drafting, assembling a six-hero roster, selecting four
combatants per battle, and making resource-aware choices through five acts.

The north star is that every authored hero should be viable in some combination of
equipment, relics, moves, Evolution path, Class, and team composition. Do not create
trap picks or prescribe team archetypes prematurely; they should emerge from content.

## Read first

- `docs/architecture.md` — system boundaries and event contract.
- `docs/combat.md`, `docs/mana.md`, `docs/conditions new.md` — combat rules.
- `docs/run-loop.md`, `docs/progression.md`, `docs/types-and-heroes.md` — content and
  progression rules.
- `src/engine/content.ts` — canonical data vocabulary.
- `README.md` — historical status notes; corroborate implementation claims in source,
  as it contains some older milestones.

## Current implementation

- `src/engine/` is a pure, seeded TypeScript combat engine. It resolves declared
  actions into ordered, serializable `CombatEvent`s; it must never import React, DOM,
  audio, or animation code.
- `src/data/` contains authored/tunable data: heroes, moves, statuses, passives,
  equipment, relics, classes, field effects, recruitment, enemies, and the type chart.
- `src/run/` owns run-level state and policies: roster/progression, map traversal,
  encounters, rewards, shop/recruitment, equipment, relics, classes, and the seam that
  builds combat state from a chosen squad.
- `src/view/` renders the combat event stream and run screens. `src/app/App.tsx`
  orchestrates screens and the playable run; `src/app/styles.css` supplies the UI skin.
- `test/` is a dependency-free compiled test suite covering combat, status/passive and
  field-effect behavior, RNG, run state, map, shop, recruitment, relics, and Classes.
- `art/` contains hero/enemy portraits and UI icons. Treat supplied assets and licenses
  as project assets, not disposable generated files.

The app currently supports starter drafting; roster management (cap 6); bring-6/pick-4
squad selection; 2v2 combat with benches; pooled level-up points; Evolutions; equipment,
relics, Classes, Contracts and Guild Halls; a seeded map; and five chained acts. Some
screens and content remain intentionally developmental (for example Event nodes and
placeholder Ancient/boss content).

**Content status:** the engine, run loop, schemas, and UI are the foundation for the
next design phase. Nearly all current authored gameplay content — hero stat lines and
movepools, equipment, relics, passives, Classes, enemies, and numerical tuning — is
working placeholder material, not finalized design. Treat it as playtest scaffolding:
use it to validate systems, but do not infer intended balance, permanent identities, or
the final roster/type chart from it. Replace or retune it through the data layer while
preserving the shared engine contracts.

## Non-negotiable game rules

- The exact damage formula is
  `BasePower × (offStat / defStat) × STAB × TypeMult × Variance × Crit`.
  Physical uses Attack/Defense and magical uses Intelligence/Wisdom. STAB is 1.25;
  variance is a per-hit uniform 0.85–1.0 roll and must remain.
- Keep the stat and damage pipelines separate. Flat stat grants produce stats and their
  ratio; damage bonuses belong in the damage pipeline multiplier term. Do not disguise
  damage as stats or vice versa.
- Stats are HP, Attack, Defense, Intelligence, Wisdom, Speed, Mana pool, and MP Regen.
  Stat changes are flat additive integers in multiples of 5 or 10. Levels unlock moves
  or Evolution choices; they never directly raise stats.
- Moves always land. Mana is the primary reliability/balance cost. Priority uses integer
  brackets, then Speed. There is no spread-damage penalty.
- Mana regenerates every round for active and benched heroes. A hero with no affordable
  move must Rest to refill. Voluntary switching locks once a side has two KOs; forced
  replacement continues.
- The game has 15 types: Fire, Water, Frost, Storm, Stone, Nature, Light, Shadow,
  Arcane, Mind, Spirit, Iron, Mech, Beast, Ancient. Type describes a hero’s power
  domain, not its body. Primary type is immutable; an Evolution may add/change only a
  secondary type. Type effectiveness has a soft 0.25× floor, not immunity.
- A hero has three equipment slots (weapon, armor, accessory). Relics are separate,
  team-wide passives. Content must remain pure data interpreted by shared vocabulary;
  do not add per-hero behavior to an engine or content file.

## Architecture and design discipline

- Preserve engine → ordered event stream → presentation separation. The engine changes
  state and emits events; the view animates those events and never calculates outcomes.
- Keep engine RNG deterministic and threaded through `CombatState`; never use
  `Math.random()` in `src/engine`. Preserve documented RNG consumption order.
- Add new mechanical needs by extending the shared content/effect/hook/condition
  vocabulary, then using it as data. The implemented vocabulary includes move effects,
  status definitions, passive reactions/damage modifiers/stat grants, targeting, and
  Field Effects.
- Field Effects are global: only one can be active, duration is five rounds, reapplying
  the same effect is a no-op, and a different effect replaces it. Current data covers
  mana regeneration, Burn decay, Speed ordering, heal priority, and Regen-linked stat
  effects; type-restricted damage-pipeline Field Effects remain an open design area.
- Avoid silently deciding open questions. The intentionally open items include emergent
  team archetypes and further Field Effect damage-pipeline support. Flag a proposed
  decision and its downstream implications before hardening it.
- Preserve the run-state/meta-state distinction. Run state resets; light permanent
  unlock meta-progression is decided but not yet fully implemented.

## Run structure

Each act is: **Fight → choose 1 of 3 rewards → Skirmish → choose 1 of 3 rewards →
Elite or Battle → Guild Hall → Ancient boss**. No route skips a fight. Winning a boss
advances to a new act until Act 5 completes. Act 1 additionally has a forced Mentor
Class node immediately after its Skirmish. HP and mana restore between map nodes.

Starters and recruit-only heroes are exclusive (`HeroDefinition.starter`). Recruit
Contracts claim defeated heroes with their run state; Guild Halls sell underleveled,
customizable recruits. At the six-hero cap, gaining a hero requires termination and
equipment handling follows the acquisition policy.

## Development workflow

- Use Node 18+ and npm. Run `npm test` for engine/run regressions.
- Run `npm run typecheck:view` for the React layer and `npm run build:view` for a
  production UI build. `npm run dev` starts the local playable app.
- Prefer focused tests in `test/` whenever changing a rule or invariant; add coverage
  for a new engine primitive or run policy.
- Keep TypeScript strict and data serializable. Make presentation changes in `src/view`
  or `src/app`, rules in `src/engine`, policy/state in `src/run`, and tunable content in
  `src/data`.
- Do not update generated `dist/` or `dist-view/` by hand. Do not discard unrelated
  uncommitted work.

When proposing a design or implementation change, state the tension it creates (for
example: roster depth versus run pacing, or a new passive hook versus data simplicity)
and anchor it in the project’s established references rather than rebuilding locked
systems from first principles.
