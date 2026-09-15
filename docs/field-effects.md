# field-effects.md

Field Effects: a single global battlefield state, one active at a time. This resolves
`mana.md`'s former "weather subsystem" open question — Field Effects **is** that
subsystem, generalized beyond just weather-flavored effects (2026-08-21 designer
sign-off).

---

## Locked shape

- **Only one Field Effect may be active at a time**, global — it affects both sides,
  not a per-side state.
- **Every Field Effect lasts a flat 5 rounds**, regardless of which effect it is.
  Duration is NOT authored per-definition; it's an engine constant
  (`engine/combat/fieldEffectEngine.ts` `FIELD_EFFECT_DURATION_ROUNDS`).
- **Re-applying the currently active effect is a no-op** — it does not refresh the
  clock. Trying to re-cast Magical Surge while it's already up just wastes the mana
  spent on the move; the countdown keeps going as if nothing happened.
- **Setting a different effect while one is active overrides it** — the old effect's
  clock is discarded (not merged/extended), and the new one starts a fresh 5-round
  countdown.
- **Settable two ways**, matching the two vectors already in the engine: a move can
  carry `MoveDefinition.fieldEffectApplication` (own field, any move kind — same
  flexibility `statusApplication` already has), or a Passive (i.e. a relic or an
  ability) can carry the `setFieldEffect` `PassiveEffect` off any existing reactive
  hook. Global, so — unlike `statusApplication`/the other three `PassiveEffect`
  kinds — there's no per-target loop and no `target` field.
- **Ticks at the end of every round**, alongside status ticks and mana regen
  (`resolveRound.ts`) — including the round it was cast in. A Field Effect set mid-round
  is already one tick into its countdown by the time that same round ends (reads as
  4 rounds remaining right after the casting round, not 5).

## Content schema

```ts
interface FieldEffectDefinition {
  id: FieldEffectId;
  name: string;
  description: string;
  flavorType?: TypeId; // presentational only — the view's badge/glow color
  mpRegenMultiplier?: number; // e.g. 2 = doubled
  slowsStatusDecay?: { statusIds: readonly StatusId[]; retain: number }; // e.g. Burn kept at 0.75/round
  reversesSpeedOrder?: boolean;
  healPriorityBonus?: number; // added to a heal-kind move's priority bracket
  healMultiplier?: number; // multiplies a heal-kind move's restored HP (Sanctuary 1.5)
  statBonusEqualToStatusMagnitude?: { statusId: StatusId; stats: readonly StatKey[] };
}
```

Same registry pattern as every other content type: a plain object literal keyed by id,
`src/data/fieldEffects.ts`. The engine reads `FieldEffectDefinition` flags
generically — no per-effect special cases, same discipline as
`StatusDefinition`/`PassiveHook` — each flag owned by the one engine module that
actually applies it:

- **`mpRegenMultiplier`** — `engine/combat/manaRegen.ts`. A flat multiplier on every
  combatant's MP Regen, applied in the regen pipeline itself — never folded into the
  `mpRegen` stat, the same discipline that keeps damage modifiers out of the stat
  pipeline (CLAUDE.md "Two-pipeline separation"), generalized to the regen pipeline.
- **`slowsStatusDecay`** — `engine/combat/statusEngine.ts` `tickEndOfRound`. Lists
  status ids whose end-of-round decay (`StatusDefinition.decay`) is slowed while the
  effect is active, and the share of the magnitude `retain`ed per tick: 0.5 is the
  ordinary halving, 1 would be no decay at all. The DoT/HoT tick itself still fires
  untouched — the field moves the decay, never the damage.

  It **replaced a boolean `suppressesStatusDecay`** (2026-09-05). Scorched Land stopping
  Burn outright was survivable while a Burn was a flat authored number; once the
  magnitude formula (`docs/combat.md` "Scaled status magnitudes") put a Fire
  specialist's Burn near 50 a tick, five undecayed rounds was 250 damage from one Early
  move and one passive, which killed a full-HP hero through no decision. Field duration
  is locked at 5 rounds, so the rate is the only lever — Scorched Land now retains 0.75,
  and its whole window pays about 150.
- **`reversesSpeedOrder`** — `engine/combat/priority.ts` `orderActions`. Flips the
  Speed tiebreaker to ascending (slowest-first) *within* a shared priority bracket.
  Priority BRACKETS themselves are untouched — still sorted descending — so a move
  with nonzero authored `priority` still resolves in its own bracket regardless of the
  flip.
- **`healPriorityBonus`** — `engine/combat/priority.ts` `orderActions`
  (`actionPriority`). Added to a `kind: 'heal'` move's priority bracket, read
  generically off the move's own `kind` rather than a per-move/per-status check.
- **`healMultiplier`** — `engine/heal/healPipeline.ts` `fieldHealMultiplier` (2026-09-15). A term of the
  heal pipeline on a `kind: 'heal'` move's restored HP, carried on `HealCaster.fieldMult` so the
  fight tile and the detail overlay preview the same figure the fight pays, and reported on
  `Healed.fieldMult`. Never folded into Wisdom; a Renew tick and a drain never ran the formula
  and do not read it. Same discipline as `mpRegenMultiplier`, one pipeline over.
- **`statBonusEqualToStatusMagnitude`** — `engine/state.ts` `getEffectiveStat`. A genuine
  stat-pipeline bonus (pipeline 1, not a damage modifier): every stat in `stats` gains a
  bonus equal to the combatant's **own current magnitude of `statusId`** — for Verdant
  Earth, its Renew. Read live off the status each call, so the bonus decays as Renew
  halves and is 0 for a hero not carrying it: the effect is a payoff for building around
  the status, not a flat buff to the whole field. Keyed by status id rather than
  hardcoding Renew, so a later effect can scale a stat off any magnitude-shape status.
  Threaded as an optional `FieldEffectContext` argument (`{ active, defs }`) so every existing 3-arg call site
  (tests, non-combat stat sheets) is unaffected; `damagePipeline.ts`'s
  `resolveStatRatio` and `resolveRound.ts`'s per-hit `DamageDealt` readout both pass it
  through, and it's recomputed fresh per hit (not hoisted before the action loop) so a
  Field Effect set by a faster action earlier the same round already applies to a
  slower action's damage later that round.

A **type-restricted damage-pipeline modifier** ("certain type of moves" from the
original ask — e.g. a future effect boosting Fire-type moves specifically) remains a
**deliberately deferred extension point**, not yet wired into any engine module.
`PassiveHook` and `StatusDefinition.triggerTypes` were both grown incrementally, one
shape at a time, only when real content needed the next one — Field Effects follows
the same discipline. Add it (a `moveTypes`/`amount` shape on `FieldEffectDefinition`,
collected into `resolveRound.ts`'s `modifiers` array the same way
`collectPassiveDamageModifiers` already is) when the first type-restricted Field
Effect is actually authored.

## Content (2026-08-21 batch)

Each is flavored around one type (`flavorType`, presentational only) but — like
Magical Surge — mechanically **global**, affecting both sides. The original setting
moves all mirrored `arcaneSurge`'s shape (`kind: 'buff'`, `target: 'self'`, 20 mana,
sets its field effect), the same "small dedicated buff move" pattern `moves.ts`'s file
header documents for status-granting moves like `lieInWait` (Ambush) and `secondWind`
(Renew). **Every one of those bare setters is now gone**, folded by the authored slates
into a move that also *does* something — Nature's Magic Growth and Force of Nature,
Light's Consecrate (a 45-mana `bothAllies` heal that turns the ground on the way past)
and Arcane's Mana Font and Magic Cloak (all 2026-08-30):

**Surging Magic was renamed Magical Surge** on 2026-08-30, when the Arcane design table
arrived calling it that three times over. Display name only — the `surgingMagic` id is
unchanged, so nothing else moved.

| Field Effect | flavorType | Effect | Move (starter) |
| --- | --- | --- | --- |
| Magical Surge | Arcane | Doubles MP Regen | `manaFont`, `magicCloak` (Glyph) |
| Scorched Land | Fire | Burn keeps 3/4 of its value a round instead of half | `spreadingBlaze` (Brimstone) |
| Stasis Field | Mind | Reverses same-bracket Speed order | `stasis` (Cortex), `distort` |
| Sanctuary | Light | Heal-kind moves get +1 priority and heal ×1.5 (2026-09-15) | `consecrate` (Solace), `hallow` |
| Verdant Earth | Nature | +Attack/+Intelligence equal to your own Renew | `magicGrowth`, `forceOfNature` (Sylva), `sow` |

### A field effect set by a PASSIVE (2026-09-01, Fire)

**Firestarter** (`src/data/passives.ts`, granted by Crimson's Pyroclasm Evolution) is
the first content to use the `setFieldEffect` `PassiveEffect` the contract has carried
since it was written: *the first time this hero afflicts Burn during combat, set
Scorched Land.* It is the first field effect that costs **no turn** — the field arrives
as a rider on a Burn the player wanted to land anyway.

Two engine additions were needed and both are general, not Fire-specific:

- `PassiveTriggerCondition.subjectRole: 'source'` — the ACTOR perspective on a hook,
  so a passive can read "when **I** afflict" rather than "when this happens to me". The
  default `'target'` role is unchanged, so every passive authored before it behaves
  identically. `StatusApplied` now carries `sourceCombatantId` to answer it.
- `reactive.oncePerFight` — what makes Firestarter a **threshold** rather than an
  engine. Without it every subsequent Burn would re-set the field and restart its
  5-round clock, so Scorched Land would never expire while Crimson kept casting. Once
  means the field is a window the player has to spend, which is the shape every other
  setter already has.

Note the consequence for the table above: **Scorched Land now has two routes**, and a
Crimson holding both `spreadingBlaze` and Firestarter is paying for the same field
twice — a deliberate anti-synergy priced into the path, not an oversight.

### A field effect as a damage condition (2026-08-30, Light)

Sanctuary is the first field effect a **move reads back**, rather than only being
affected by: Light's Smite doubles its BasePower while Sanctuary is the active effect
(`MoveDefinition.conditionalPower.requiresFieldEffect` — see `docs/combat.md`). Three
properties of the subsystem become load-bearing the moment content does this, and all
three are the LOCKED shape rather than anything new:

- **One slot.** Any other effect overrides Sanctuary and switches the bonus straight
  off — so a Magical Surge cast by either side is real counterplay to a Light team,
  which is the first time "whose field is up" has been a damage question.
- **No owner.** The side that sets it arms *every* Smite on the field, its own and the
  enemy's. The setter is a tempo commitment, not a private buff.
- **A 5-round clock.** The bonus is rented, never owned; nothing in the type can
  refresh it except re-paying for the setter, and re-applying the *active* effect is a
  no-op that does not restart the clock.

`consumesStatus` is deliberately inert on this form. "Consume the field effect" would
end a global, both-sides state early — a field-effect mechanic, not a status one — and
it has not been decided.

### A field effect as a TARGETING condition (2026-08-30, Arcane)

Magical Surge is the second field a move reads back, and the first read for something
other than damage: Arcane's Overload is `singleEnemy` normally and `bothEnemies` while
Magical Surge is up (`MoveDefinition.conditionalTarget` — see `docs/combat.md`).

The same three properties above apply unchanged, and the same way round: one slot, so
any other field switches the spread off; no owner, so an enemy's Magical Surge spreads
your Overload; a 5-round rented clock. What is new is only that the type now **sets the
field it reads** — Mana Font and Magic Cloak are both Arcane, both in the same slate as
Overload, and Mana Font sits in the same Scroll pool. That is the deliberate
counterpart to Light's Consecrate/Smite pairing: the combo grows on one hero rather
than depending on a second draft of the same type.

Worth noting that Magical Surge is now doing two unrelated jobs at once — doubling MP
Regen (which the Arcane battery is built around) and spreading one move. Neither
interferes with the other, but it does mean an Arcane player has one field they always
want up for two reasons, where Light's Sanctuary is a genuine choice.

Each move is tied to that starter through `progressionTable.moveTiers`
(`src/data/progression.ts`) — a **level-up unlock**, not part of the starting kit.
It was originally granted as a fourth starting move, which made those five heroes the
only ones opening with four (2026-08-26): starting kits are now uniformly three across
the whole roster, both because the draft screen compares four candidates side by side
and because a 20-mana field setter is a strange thing to hand a level-1 hero whose
other moves cost 10-15. A hero that wants its field effect grows into it.

This is placeholder-tier balance content (mana costs, and which starter carries each
move, are both open to reassignment) — the mechanics and the definitions are real, but
nothing here has been through a tuning pass.

### View layer: per-effect color

The battlefield glow/border and the divider badge (`FightScreen.tsx`) were originally
hardcoded to Magical Surge's Arcane purple — the CSS itself flagged this as
provisional ("revisit if/when a non-Arcane Field Effect ships"). Now generalized:
`FightScreen.tsx` sets a `--field-effect-rgb` custom property (an "r, g, b" triplet
from `typeColors.ts` `getTypeColorRgb(def.flavorType)`) on `.battlefield`, and
`styles.css`'s glow/badge/keyframes all read `rgba(var(--field-effect-rgb, 195, 86,
208), …)` — the fallback triplet is Arcane's own color, so an effect with no
`flavorType` still renders instead of going colorless.
`FieldEffectDetailOverlay.tsx` sets its own border-top-color inline the same way
(`getTypeColor`, not the custom property) since it's portalled to `document.body` and
so sits outside `.battlefield`'s subtree — custom properties don't cross a portal
boundary.

## Why four of five never appeared, and the three routes that fix it (2026-09-15)

**The finding.** Nine hours of play saw no field but Scorched Land. The sim agreed: over 600
runs and 65,384 player casts, every field setter combined was **0.35% of casts** — Spreading
Blaze 0, Magic Growth 0, Magic Cloak 0, Stasis 15, Consecrate 42, Force of Nature 51, Mana
Font 110. Scorched Land appeared anyway, because **Firestarter** sets it off a Burn the player
wanted to land regardless: the one route that costs no turn.

That is the VGC lesson, and the user named it: weather works when an ability summons it
(Drizzle, Drought) and does not when a turn is spent casting it (Rain Dance). Three faults
compounded here:

1. **Setter rate.** Eight setter moves, seven of them Mid or Late, one passive on one
   Evolution path of one hero. A field was something bought at 40–55 mana in place of an attack.
2. **Readers.** Two moves in the game read a field (Smite, Overload). A field nothing reads is
   a number nobody looks at.
3. **Legibility.** Sanctuary's +1 heal priority and Stasis Field's reversed order are
   un-feelable unless the player is watching resolve order. Scorched Land's retain-0.75 is just
   as invisible — it survives only because it is *set* constantly.

**The three routes** (per user direction; all three, not one):

### Heralds — a field set on entry, costing no turn

One passive per field, `heraldOf*` in `src/data/passives.ts`, generated off the field catalog:
*when this hero enters the battlefield, set X*. It is `{ hook: 'SwitchedIn', condition:
{ relativeTo: 'self' }, effect: { kind: 'setFieldEffect' } }` — the shape Imposing Presence
uses, reachable since 2026-08-31 and never authored. **Not `oncePerFight`**, on purpose: a pivot
out and back re-sets a field that has lapsed or been overridden, and the locked shape (re-setting
the active field is a no-op that never refreshes the clock) is what stops it from being a
permanent field. That is the weather war — switch Politoed back in.

They live in the **Boon pool**, type-gated exactly as the +20% damage Boons are: offered when a
roster hero fields the field's flavour type (`fieldHeraldPassiveFor`, `src/run/boons.ts`). The
holder need not be that type — a Stasis Herald belongs on Crag or the Colossus, which is where
Trick Room actually lives. Firestarter stays an Evolution passive with a different trigger; the
Fire Herald in the Boon pool is a second route, not a replacement.

### Riders — an Early move that does its type's job and sets the field on the way past

Scorched Land's shape, one per field, priced as the payload alone:

| Field | Early rider | Payload |
| --- | --- | --- |
| Magical Surge | Mana Font (existing) | +10 MP Regen both allies |
| Scorched Land | — (Firestarter, Spreading Blaze) | — |
| Stasis Field | **Distort** | −20 Intelligence on one foe |
| Sanctuary | **Hallow** | heal 35 on one ally |
| Verdant Earth | **Sow** | Renew 30 on one ally |

**Stasis** was repriced: 45 mana for +20/+20 on self was the worst card in its slate, so the
field never came with it. It is +20/+20 on **both allies** at 40 now.

The riders sit in the **Titanspawn kits** too (Gleamling holds Hallow, Whimling Distort,
Sproutling Sow, Runeling Mana Font and Resonant Bolt, the Emberling Flare Up), so the enemy side
sets fields — and under the "no owner" rule an enemy's Sanctuary arms the player's Smite. The
field war now happens *to* the player, not only by them.

### Readers — a move that visibly lights up while its field is up

One per field on Smite's `conditionalPower.requiresFieldEffect` shape, so every field has a card
whose number doubles when it is on:

| Field | Reader | Shape |
| --- | --- | --- |
| Magical Surge | **Resonant Bolt** (Early, 35) | ×2; Overload spreads |
| Scorched Land | **Flare Up** (Early, 40, Burn 10) | ×2 |
| Stasis Field | **Hindsight** (Mid, 55, priority −1) | ×2 — slow on purpose |
| Sanctuary | **Sunlance** (Mid, physical, 55) | ×2 — the physical Light line's Smite |
| Verdant Earth | **Verdant Lash** (Mid, physical, 50) | ×2 |

Every reader is pooled beside a setter (`src/data/progression.ts`), so no hero draws a dead
conditional.

### Sanctuary's second job

Per user direction, Sanctuary **keeps** +1 heal priority and **also multiplies heal-kind moves
by 1.5** — `FieldEffectDefinition.healMultiplier`, a term of the heal pipeline
(`healPipeline.ts` `fieldHealMultiplier`, carried on `HealCaster.fieldMult` and reported on
`Healed.fieldMult`), never a Wisdom bonus, exactly as `mpRegenMultiplier` is a term of the regen
pipeline and never an MP Regen stat. A Renew tick and a drain are not heals and do not read it.
The bigger number is seen on every heal, which is what the priority never was. It is the
two-jobs shape Magical Surge already has, accepted with eyes open.

**Verdant Earth's number is untouched.** The standing call (2026-09-05) was to play it before
dividing it, and the play verdict was that it never appeared — so this pass makes it appear
and leaves the 1:1 grant where it was. If it now reads as broken, that is the playtest result.

### Measured (600 runs, seed 1, skilled pilot; `scripts/sim` now counts field sets)

| | sets (player / enemy) | per 1000 player turns | rounds ending with a field up | full-clear |
| --- | --- | --- | --- | --- |
| before (2026-09-15 morning) | ~230 setter casts | ~3.5 | not counted | 54.7% |
| Heralds + Sanctuary term | 403 / 673 | 14.0 | 10.3% | 55.5% |
| + riders, readers, kits | 582 / 1,038 | 20.6 | 14.7% | 55.0% |

Full-clear is unmoved — none of this was a power lever. What the pilot cannot price: a Force
self-buff (Undercurrent, Hoarfrost Edge, Static Charge, Soulfire were cast 0–3 times in 78,558
turns; `pilot.ts` values Force at half its magnitude over the horizon, about a quarter of what
it pays), and the Heralds themselves are drawn at random like every Boon. Directional, as
always; the read that matters is the user's next run.

### Still deferred

- **The type-restricted damage term** (Pokémon terrain: "+X% Fire moves") — asked and declined
  this pass, to keep the five distinct in kind. Revisit once the setter rate has been played.

## Open questions — do not silently resolve

- **The damage-modifier surface** (above) — deferred until a concrete type-restricted
  Field Effect is authored.
- **Should a relic be able to grant a Field Effect passively at fight-build time**
  (like `RelicDefinition.grantsStatusIds` does for Elemental Force), rather than only
  through a reactive Passive hook firing mid-fight? **Half of the premise this was
  written on has since changed** (2026-08-31): `PassiveHook` now includes
  `SwitchedIn`, the entry hook Imposing Presence needed (docs/events.md), and it fires
  for the opening lead as well as for every mid-fight arrival
  (`passiveEngine.ts` `resolveBattleStartEntries`). So a relic granting a Field
  Effect on entry IS now reachable — a relic-held `{ hook: 'SwitchedIn', effect:
  { kind: 'setFieldEffect' } }` would set it the moment a fight opens, since a relic
  broadcasts to every combatant on the side. The question that remains is narrower and
  still open: should it be expressible as a plain build-time grant (like
  `RelicDefinition.grantsStatusIds`) rather than as a hook that has to fire? Nothing
  needs either yet.
- **Verdant Earth's bonus size**, as of the Nature slate, is no longer bounded by the
  20–30 Renew the fixture content granted: Overgrowth's Renew 100 makes this a ~+125
  Attack/Intelligence swing. **Signed off 2026-08-30** — see docs/combat.md "Renew's
  stacked payoffs". Renew is a slow passive effect and its payoffs are meant to be
  worth the turn; the halving curve is what bounds the window rather than the
  magnitude. Not a finding; do not re-report it.
- **Verdant Earth's bonus applying to benched heroes too** — `getEffectiveStat` has no
  active/bench distinction, so (like Magical Surge's `mpRegenMultiplier`) the
  Attack/Intelligence bonus applies to any combatant carrying Renew regardless of bench
  status. Mostly moot while the bonus only feeds the damage pipeline (a benched hero
  isn't attacking), but it means a hero can be switched in mid-effect already boosted.
  Consistent with existing precedent, but not something a designer has explicitly
  signed off on for this specific effect — flag if that's ever meant to be
  active-only.
