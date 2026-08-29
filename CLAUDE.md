# TITANPACT — Project Constitution

Roguelike tactical RPG. Fully-piloted **doubles (2v2)** combat inspired by Pokémon VGC and
Guildrun. ~45-minute runs: draft → escalating fights → relics. Portrait-mode mobile.

**North star:** every hero must be viable under *some* combination of items, relics, and team
composition. No hero is a trap pick.

This file is the constitution: load-bearing rules and rationale. Deeper design lives in `/docs`
(see Repo map). When a rule here and a prompt conflict, this file wins — surface the conflict,
don't silently override it.

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
- **Stat line:** HP, Attack/Defense, Intelligence/Wisdom, Speed, Mana, MP Regen.
- **Stat modifiers are flat additive integers, multiples of 5 or 10.** No % stat mods.
  There is **no automatic stat growth** from leveling.
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
  type (type-graft); it never changes the innate primary.

### Heroes & progression
- Heroes are **named, authored, fixed specialists** (~53 concepts). Not procedurally generated.
- **Mono typing is a valid terminal state**, not a larval stage. Precedent: Pokémon
  Normal/Water/Bug. A numerically common mono type is not a design flaw.
- **Level-ups are a pooled currency** distributed freely after each battle (benched heroes
  included). Below the Evolution level, a level-up **unlocks a move** from the current
  tier; the level-up that reaches the Evolution level instead **surfaces the Evolution
  choice** — no move that level-up. **They never directly raise stats.**
- **Evolutions are authored branch points**, each option carrying a **single
  identifiable name** (e.g. Cinder's Explosive / Ironclad / Thunderblaze).
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
- **3 equipment slots** per hero: weapon, armor, accessory. **Relics are team-wide passives**
  — a separate axis, not equipment.

### Mana & tempo
- Regenerating Mana with two stats: **pool size** and **per-turn MP Regen** (always written "MP Regen" — the bare word collided with the HoT status, now **Renew**).
- **Bench heroes regen mana** — this is the resource-cycling engine that makes switching
  productive.
- **Lock-in rule:** voluntary switching is disabled once a side has **2+ heroes KO'd** (forced
  replacement of a downed hero still happens). This flips a fight from a cycling game into a
  grind — an intentional phase transition.
- **Rest** is a required choice when a hero does not have enough mana for any of their abilities.
  Recovers all mana, but skips the turn.
- **Mana tuning invariant:** *mana investment must pay out later than the point at which a weak
  team dies.* Keep this true when tuning any mana node or regen value.

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
  reward → Skirmish → pick 1 of 3 reward → pick 1 of 2 (Elite or Battle) → Guild Hall →
  an end-of-act **Guardian** boss fight, no path ever skipping a fight, and no path ever
  losing the Elite/Battle choice (`docs/run-loop.md`). **2026-08-29:** the boss was
  renamed Ancient → **Guardian**; "Ancient" is reserved for something later in a run and
  is otherwise only the locked TYPE, which is untouched. The map's encounter labels are
  now a two-word vocabulary — **Monsters** (not recruitable: `fight`, `battle`) and
  **Skirmish** (recruitable: `skirmish`, `elite`) — with difficulty carried by colour and
  glyph instead of by a third and fourth word. Node type *ids* are unchanged.
  **2026-08-26:** the reward row
  feeding that choice **steers** — left→Elite, right→Battle, middle→both — so the choice
  is never removed, only priced against taking a side reward. **5 acts** are
  chained per run (`RunState.actNumber`, `TOTAL_ACTS`), each with a fresh map generated
  once the previous act's Guardian falls; 1 Recruit Contract is granted at the end of
  every act (replacing the removed `contractReward` map-node type — Recruit Contracts
  now come only from that per-act grant, a beaten enemy's contract claim, or a Guild
  Hall purchase). Encounter difficulty does not yet scale by act number — open question,
  `docs/run-loop.md` §3. HP/mana **fully restore
  between map nodes** — reversed same-day from an initial persist-across-nodes design
  after first playtest showed a KO'd hero simply stayed dead-weight into the next
  fight with no way to recover it (`docs/run-loop.md`). Relics are **minimal and
  stat-only** until the trigger-hook contract exists.
- Field Effects (2026-08-21 sign-off): resolves the former "weather subsystem" open
  question — Field Effects **is** that subsystem, generalized. A single global
  battlefield state (only one active at a time), settable by a move or a passive
  (relic/ability), lasting a flat **5 rounds** regardless of which effect; re-applying
  the active effect is a no-op, a different one overrides it and restarts the clock.
  Data-driven (`FieldEffectDefinition`, `docs/field-effects.md`); first content is
  **Surging Magic** (Arcane), doubling every hero's MP Regen while active.

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
  `locations.md`, `visual-language.md` (presentation only). Reference from here; don't inline them.
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
