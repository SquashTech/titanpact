# innate-passives.md — Innate passives, the Titan's Mark, and the Burden

> **STATUS: DECIDED AND BUILT 2026-09-20 (per user direction, same day as the draft — "I am
> willing to test it regardless").** Phases 1–7 are IN: the slot and the forty-five, the Mark on
> every spawn, Lingering and Ironbound as engine verbs, the Burden on Bellows, the reading
> surfaces, and the measurement (§8). **One departure from the draft, measured:** a Guardian
> carries NO Mark — a Marked champion in a 14-round fight was the whole of a twelve-point Act 1
> loss, and a bare one put it back exactly; the seal is what keeps the Titan's Mark off it. The
> designer flagged Lingering as likely over the band and chose to test it; it measured mid-pack.
> Every number is a first pass; `TITANS_MARK_FORCE`, `BURDEN_SURPLUS` and the outlier
> magnitudes are the designer's to move.

---

## 0. Why this exists

**Pre-Evolution, heroes converge inside a type.** Every hero's seven stats sum to 550, every
hero's grades sum to 28, and every hero draws its moves from its type's slate. At three a type that
is enough: Cinder, Crimson and Brimstone are a brawler, a caster and a Shadow-tinged caster, and
the spread plus the three starting moves keep them apart until the Evolution at pip 5 does the real
work. At seven a type — the roster is headed for a hundred — seven Fire heroes draw from one Fire
slate, take the same Mid offers by Act 3 and differ by which stat is spiked. The five pre-Evolution
axes today are stat spread, grade line, typing, three starting moves and schedule timing; the
grades and the schedule reveal slowly, the slate is shared, and the spread is one number moved
around. The sameness risk is **within-type**, not across the roster.

**Pokémon's answer is the ability, not the stat total.** Its Fire-types are Blaze against Flash
Fire against Drought against Flame Body; the ability is what separates two Fire-types with the
same silhouette, and it is on the summary screen before a player commits. Its varied base-stat
totals are the *other* thing people remember, but they do not deliver viability — the tier system
does, and ninety percent of the dex is uncompetitive by design. Where a low total *is* viable
(Azumarill at 420) it is the ability doing the work, and the stat line is the price the designers
charged for it. So varied totals are downstream of passives, and the passive is the lever.

**The slot already exists.** `HeroDefinition.passiveIds` (`src/engine/content.ts`) is read by
`entryPassiveCounts` at fight build beside every other source, and the Herald's Standard and the
Eyes' Gaze ride on it today. Its own comment says *"a hero's identity still lives in its Evolution
and its Class, not here"* — this document reverses that sentence on purpose, not by accident. The
catalog holds sixty passives across five sources (equipment, event, the type-locked Boons, the
Heralds, Evolution), and the reactive vocabulary — seven hooks, a declarative condition, six
effect kinds — expresses most of what §7 asks for without a new verb.

**The game stacks passives, which Pokémon does not.** A Pokémon has one ability, so an ability
that changes on evolution is the whole story. Here a hero can hold an innate, an Evolution
passive, a Class passive, a Boon and three items' worth, so an innate does not have to *be* the
Evolution's excitement — it is the floor the Evolution builds on, and (§5) one path can trade it.

---

## 1. The rule this reduces to

**A hero's innate passive is a verb it was born with: on the card before the draft, in no pool,
never a bare number.** Every hero has exactly one. It is what two heroes of one type do
differently before either has evolved, and the reason the Evolution reads as a *change* rather
than as the first time the hero did anything.

Three corollaries the rest follows from:

- **Never a bare number.** An innate `+10 Attack` is a 560 total through the side door and the
  550 rule dies quietly. The Class rule already says it: a verb, never a stat. An innate may
  carry `statGrants` only as part of a conditional or a reaction (Bloodthirsty's *while an enemy
  is Bleeding*, Quickening's *when it enters*); a passive that is `statGrants` alone is refused as
  an innate by test.
- **Uniform and unpriced.** Every innate is authored to one parity band and no hero's stats move
  to pay for it, either direction. The Boon's type-locked `+20%` is the band's median: a known
  quantity the sim has already priced. What measures over or under gets its *passive* tuned, never
  its line. (The one exception is the Burden, §4, which is priced on purpose and printed.)
- **A shared vocabulary, a few uniques.** Pokémon runs ~300 abilities across ~1000 monsters and
  Intimidate is on thirty of them. Forty-two uniques is forty-two tooltips; a vocabulary of
  twenty-odd, with a handful of signatures, is something a player learns. §7 reuses the existing
  catalog wherever a card already fits — Impale, Sunder, Quickening, Sanguine — and those reuses
  are the point, not a shortcut.

---

## 2. The innate

**Schema.** No new field. `HeroDefinition.passiveIds` is the slot; a roster hero holds exactly one
id there, and `test/roster` pins it — one per hero, a valid `PassiveDefinition`, not
`statGrants`-only, and (below) in no pool. The Titan's pieces keep their several. A helper,
`innatePassiveOf(hero)`, is the one reader; the fight build already folds the id in.

**In no pool.** The Boon pool (`src/run/boons.ts`) already excludes Evolution passives and Classes
because *both are somebody's identity already*; the innate ids join that exclusion. An innate that
is ALSO an equipment passive (Mordrax's Impale, Gallant's Sunder) can still arrive on a drop and
stack — the repo's stacking rule stands, the innate is simply the first stack. That is a feature to
watch, not a bug to close: a second Impale on Mordrax is a build, and the sim will say whether it
is a runaway one.

**Who carries it.** Every hero in the recruitable pool — starter, recruit-only, Constellation
unlock — so a hero-pool enemy fights with it for free (same definition), a contract hero brings it
(it is not a finished axis; a Guild hire has it too), and the scouted chip names it. A hero is its
innate on both sides of the field, which is what makes the chip worth reading.

**Timing.** Nothing about an innate is gated: it is live from the first fight, the same on a level
1 hire and a level 30 veteran. That is deliberate — the schedule and the pips are the things that
unfold; the innate is the thing that is already true.

---

## 3. The Titan's Mark — one passive per type, on every Titanspawn

The Titanspawn are not heroes and get no authored innate. They get **the Mark**: one passive per
mortal type, fourteen of them, generated from the type the way the `${type}Force` statuses are,
identical in shape across the roster of forty-two spawn:

> **Mark of the Titan (Fire)** — *At the end of each round this creature stands on the field, it
> gains Fire Force 5.*

- **Expressible today**, no new verb: `reactive: { hook: 'RoundEnded', condition: { relativeTo:
  'self' }, effect: { kind: 'applyStatus', target: 'self', statusId: 'FireForce', magnitude:
  TITANS_MARK_FORCE } }`. The Force statuses are `stacking: 'additive'`, `decay: 'none'`,
  `clearsOnSwitch: false`, so the stack grows and survives a pivot.
- **Active only.** `RoundEnded` fires for active owners, so a benched spawn does not accrue — the
  same shape as the Pact Clock since the bench came off it. It is the Titan's clock in miniature:
  the longer the creature stands, the harder it hits, and the pressure is on the player to end
  fights rather than cycle through them.
- **Magnitude, first pass: `TITANS_MARK_FORCE` = 5.** Force is flat BasePower before the multiplier
  chain, and the slates' medians are Early 40 / Mid 55 / Late 80. At round four a Mid spawn is
  +20 on 55; at round eight it is +40, near double. Compare the Ley Line's +10 flat for a whole
  run. This is the one dial, and it is a sharp one: it will bite the Act 1 wall (the run's measured
  wall at every pass) harder than anything else in this document, and §9 phase 6 measures it
  before it is left there. If 5 is too much, the alternatives in order are a per-tier magnitude
  (Early 3), a cap on the stack, and a later first tick — not a smaller number on every tier.
- **On the enemy side, a spawn fights like the Titan's; a hero-pool enemy fights like a hero.**
  That asymmetry is the reading: a Skirmish against spawn is a fight against a clock, a Skirmish
  against a hero party is a fight against a kit.
- **The Guardians carry NO Mark** (reversed from the draft, measured — §8). The draft put one on
  every champion as the Titan's mortal type made large; a Marked Manticore in a fourteen-round
  fight went 91.7 → 75.9% and took Act 1 from 67.8 to 55.8%, and a bare champion with Marked
  escorts put both back to the baseline exactly. The reading that survives: **the seal keeps the
  Titan's Mark off the Guardian** — its escorts climb, it does not. The Herald keeps its Standard
  and the Eyes their Gaze; Ancient has no Mark, because the Titan does not mark itself.
- **The companion carries the Mark.** It is a `TitanspawnDefinition`, so it inherits one, and the
  proposal is to *leave it there*: the mortal companion is the Titan's creature fighting for you,
  and a Force that climbs each round it stands is a reason to lead with it and a reason it dies.
  This is a player-side buff on a hero fielded every fight and it is §11's first open question;
  the alternative is stripping it on `RosterEntry.mortal` at the join.

---

## 4. The Burden — a drawback the stats pay for

The designer's steer: drawback passives are design space worth exploring, on the Slaking model —
a gigantic body attached to a flaw — but not Truant itself. The version that survives the
constitution:

**A Burden is an innate whose passive is a cost, and whose hero comes in OVER the 550 by a fixed,
printed surplus.** `BURDEN_SURPLUS` = 60 (first pass), authored into the base line, so the sheet's
Stat Total row prints `610 · Burden` and the number is still the player's to check. The test pins
`550`, or `550 + BURDEN_SURPLUS` for a hero whose innate is flagged `burden: true` — one exemption
with one name, beside the Mana Well's and the Ley Line's.

Why a *fixed* surplus rather than one priced per drawback: pricing each drawback separately is the
varied-BST problem coming back in through the passive, and the repo's precedent for a set of
unlike things at one price is the Banner — three grants held at *measured parity*, the sim doing
the pricing. So: one surplus, and each Burden's severity is authored to be worth about that, then
measured. A Burden that measures as free gets sharper; one that measures as a trap gets blunter.
The stats never move again.

**Base, not grades.** The surplus is 60 base points and the hero still has 28 grade points, so
every Burden hero is front-loaded by construction: 60 is 11% of the line at level 1 and 7% at
level 30. That is the right shape — *arrives big, does not grow into it* — and it is the same
axis a contract hero's flat value sits on. A Burden in grades (a bigger body that keeps getting
bigger) is a different, worse creature and is not proposed.

**Permanent.** No Evolution path sheds a Burden, because the surplus stays and the price would not.
A path may build on it (§5) but the trade lasts the run — the whole point of a Slaking is that
you live with it.

**Never a numerical drawback on the sheet.** A Burden is a verb too: `−20 Speed` is not a Burden,
it is a stat line. The candidate vocabulary, with what each needs:

| Burden | Effect | Vocabulary |
|---|---|---|
| **Ironbound** | Cannot switch out voluntarily (forced replacement still happens). | New: `cannotSwitchOut` flag read by the switch validator. |
| **Bare-Handed** | Holds no items — `itemSlotsFor` reads 0; never on a who-screen. | New: `holdsNoItems`, one line in `itemSlotsFor`. |
| **Bloodprice** | Every hit this hero lands costs it 5% of max HP, direct. | New: a `damageSelf` effect kind (Fire's self-Burn is the precedent for a visible self-cost). |
| **Thin-Skinned** | Takes 20% more damage from every hit. | New: a defender-side `damageModifier` — a term the pipeline will want anyway. |
| **Hollow** | Cannot be healed by allies (its own Renew and drain still work). | New: `refusesAllyHeals` on the heal pipeline. |
| **Unrested** | MP Regen 0 — a burst caster that Rests. | Expressible (`statGrants: { mpRegen: −10 }`), but it is a number; listed to be argued against. |
| **Lumbering** | Always acts last inside its priority bracket. | New: a Speed-order override in `orderActions` (Stasis Field's cousin). |

Ironbound and Bare-Handed are the two to build first: each is one flag in one place, each is
legible in one sentence, and each is a *real* cost under the current rules — every fight fields the
whole roster and rotation is the cycling engine, so a hero that cannot leave is a hero you lead or
bench for the fight; and three sockets at Legendary is ~270 points of budget a Bare-Handed hero
never holds, against a surplus of 60 that is worth most in Act 1.

**How many.** Three or four across the whole roster at first, and preferably on *new* seats as the
roster grows past forty-two rather than by rewriting a 550 hero into a 610 one. One existing
conversion is proposed because the body already says it: **Bellows** (Mech/Iron, 250 / 105 / 90 /
15 / 35 / Speed 5 / Mana 50) is a Slaking silhouette without the flaw — *Ironbound* fits a steam
colossus, and +60 into HP 280 / Attack 120 / Defense 105 is the line. Ursa (Attack 115 at Speed 20)
is the other candidate and is not proposed: its Evolution (Grizzly, Thick Hide) is already the
identity, and two Burden brutes on the same shelf is one too many.

---

## 5. The Evolution builds on the innate — never replaces it

Additive by default: the Evolution passive lands beside the innate, and several rows in §7 are
written so the innate *feeds* the path — Mordrax's Impale (every hit Poisons) into Bloomfang's
Thornrot (Poison applied → +10 Attack, +10 Speed); Pixie's Attunement (+20 Mana to the partner on
entry) under Stardust's Pixie Dust (+30); Nightshade's Shadowmeld (Ambush 10 on entry) under
Penumbra's Afterimage (Ambush 20). That is the stacking the designer named: the Evolution is still
where the kit turns a corner, and the innate is the run-up.

**No path ever replaces the innate** (2026-09-20, per user direction). The draft proposed a
`replacesInnate` on at most one path per hero, on the graft's precedent; the designer declined
it. The innate is what the hero *is*, on both sides of the field and for the whole run — an
Evolution adds to it and may make it wrong for the new shape (Cinder's Thunderblaze does not want
Kindling), and that mismatch is the path's price, read on the card the way a retype's lost STAB
is. `EvolutionPath` carries no such field and none should be added.

---

## 6. Where it is read

- **The draft card and the Constellation's examine screen**, under the types: the innate's name,
  its one sentence on tap. *An identity a player reads before drafting* is the standard — it is on
  the card, not behind a sheet.
- **The hero sheet**, a row of its own above the Evolution passive, so the two read as a stack.
- **The scouted chip and the node dossier**: the name only. A Titanspawn chip reads *Mark of the
  Titan*, and after the first fight the player knows what that means.
- **The fight nameplate** on long-press, with the rest of the passives.
- **The Burden** prints on the sheet's Stat Total row (`610 · Burden`) and its passive row is
  tinted as a cost, the way a self-Burn's price is drawn.

No screen collects a decision about any of it. An innate is never chosen, never rerolled, never
sold; the one decision it ever touches is the draft, and there it is one line on a card.

---

## 7. First pass — the forty-five

Every row names the innate, its sentence, whether the catalog already holds it, and whether the
engine expresses it today. *(existing)* is a straight reuse; *(new)* is a new `PassiveDefinition`
in the existing vocabulary; *(vocab)* needs an engine verb from §4 or §9. The Evolution passive is
in the last column so the two can be read as a pair. Every magnitude is a first pass.

| Hero | Type | Innate | Effect | Status | Evolution passive |
|---|---|---|---|---|---|
| Cinder | Fire | **Kindling** | Whenever this hero afflicts Burn, it gains 5 Attack. | new | Cinderguard (Ironclad) |
| Crimson | Fire | **Stoke** | Whenever an enemy takes Burn damage, this hero gains 5 Intelligence. | new | Firestarter (Pyroclasm) |
| Brimstone | Fire/Shadow | **Sulphur** | When this hero enters the battlefield, both active enemies gain Burn 5. | new | Ashfeast / Hexfume |
| Riptide | Water | **Drag** | Whenever this hero lands a Water attack, its target loses 5 Speed. | new | Enthrall (Siren) |
| Pincer | Water | **Carapace** | When this hero enters the battlefield, it gains Shield 30. | new | Static Tide (Tideclaw) |
| Leviathan | Water | **Overchannel** | Whenever this hero lands an attack, it gains 10 Mana, past its pool. | existing | — |
| Flurry | Frost | **Glaciate** | Whenever this hero takes damage, both active enemies lose 5 Speed. | new | Killing Frost (Avalanche) |
| Rime | Frost | **Cold Snap** | Whenever this hero Freezes an enemy, it gains 10 Attack. | new | Frozen Stone (Glacier) |
| Cube | Frost | **Absolute Zero** | Whenever this hero's Defense rises, both active enemies lose 5 Speed. | new | Cold Forge (Shatterframe) |
| Squall | Storm | **Tailwind** | When this hero enters the battlefield, its partner gains 10 Speed. | new | Squall Line (Windshear) |
| Tempest | Storm | **Live Wire** | Whenever this hero lands a Storm attack, its target is Conducting. | new | Either Hand (Forked) |
| Skyshear | Storm | **Static Field** | Whenever an enemy becomes Conducting, this hero gains 10 Intelligence. | new | Charged Air (Stormeye) |
| Crag | Stone | **Vengeful Emblem** | Whenever this hero takes damage, it gains 5 Attack. | existing | Unstoppable Growth (Rootwarden) |
| Sentinel | Stone | **Stone Wall** | When this hero enters the battlefield, its partner gains Shield 20. | new | — |
| Slate | Stone | **Fault Line** | Whenever this hero lands a physical attack, its target loses 5 Wisdom. | new | Aftershock (Quakebringer) — the magical mirror |
| Sylva | Nature | **Verdure** | Whenever this hero heals an ally, that ally gains Renew 10. | new | Nature's Purification / Restorative Toxin |
| Mordrax | Nature | **Impale** | Whenever this hero lands an attack, its target suffers Poison 5. | existing | Thornrot (Bloomfang) — fed by the innate |
| Hollowbark | Nature | **Barbs** | Whenever this hero takes damage, enemies suffer Poison 3. | existing | Heartwood (Thornheart) |
| Solace | Light | **Grace** | Whenever this hero heals an ally, it gains 10 Mana, past its pool. | new | Afterglow (Dawnherald) |
| Aegis | Light | **Consecrate** | Whenever this hero is healed, it gains 5 Defense and 5 Wisdom. | new | Shieldbearer (Warforged) |
| Empyrean | Light | **Halo** | At the end of each round, this hero's partner is healed 10. | new | Sunblind (Sunborne) |
| Widow | Shadow | **Lacerate** | Whenever this hero lands a physical attack, its target Bleeds 5. | new | Widow's Kiss / Snare — fed by the innate |
| Marrow | Shadow | **Necrosis** | Whenever an enemy takes Poison damage, this hero heals for the same amount. | new | — |
| Nightshade | Shadow | **Shadowmeld** | When this hero enters the battlefield, it gains Ambush 10. | new | Afterimage (Penumbra) — stacks to 30 |
| Glyph | Arcane | **Mana Ward** | Whenever this hero takes damage, it gains Mana equal to 15% of it, past its pool. | existing | Overspill (Thaumaturge) |
| Zenith | Arcane | **Arcane Reservoir** | When this hero enters the battlefield, it gains 30 Mana, past its pool. | existing | — |
| Pixie | Arcane | **Attunement** | When this hero enters the battlefield, its partner gains 20 Mana, past its pool. | existing | Pixie Dust (Stardust) — stacks |
| Cortex | Mind | **Neuroplastic** | Whenever this hero takes damage, it gains 5 Attack and 5 Intelligence. | new | Either Hand (Embodied) |
| Lucius | Mind | **Intrusion** | Whenever this hero lands a Mind attack, its target loses 5 Intelligence. | new | Sanguine |
| Trance | Mind | **Lullaby** | At the end of each round, both active enemies lose 5 Speed. | new | Puppet Strings (Puppeteer) |
| Revenant | Spirit | **Lingering** | The first time this hero would be knocked out each fight, it survives at 1 HP. | vocab | Communion (Undying) |
| Sorrow | Spirit | **Wail** | Whenever this hero lands a Spirit attack, its target is Haunted. | new | Grief (Mourner) |
| Dread | Spirit | **Foreboding** | Whenever an enemy is Haunted, this hero gains 5 Defense and 5 Wisdom. | new | Omen — fed by the innate |
| Warden | Iron | **Rivet** | Whenever this hero takes damage, its partner gains 5 Defense. | new | Sentry (Bulwark) |
| Valor | Iron | **Rallying Standard** | When this hero enters the battlefield, its partner gains 10 Attack and 10 Intelligence. | existing | Tempering (Shieldwall) |
| Gallant | Iron | **Sunder** | Whenever this hero lands an attack, its target loses 10 Defense. | existing | Cavalry Charge (Charger) |
| Scallywag | Iron (unlock) | **Quickening** | When this hero enters the battlefield, it gains 10 Speed. | existing | Plunder (Corsair) |
| Clockwork | Mech | **Boiler** | Whenever this hero is Burned, it gains 10 Mana, past its pool. | new | Combustion (Runaway) |
| Bellows | Mech/Iron | **Ironbound** *(Burden)* | Cannot switch out voluntarily. Stat Total 610. | vocab | Runaway Pressure / Superheat |
| Rex | Mech | **Steam Pressure** | Whenever this hero is Burned, it gains 10 Speed. | new | Rampant (Tyrant) |
| Patch | Mech (unlock) | **Field Repair** | Whenever this hero heals an ally, that ally is Cleansed of one affliction. | new | Nanites (Triage) |
| Fang | Beast | **Pack Hunter** | Whenever this hero's partner lands an attack, this hero gains 5 Attack. | new | Bloodthirsty (Bloodhunt) |
| Ursa | Beast | **Second Skin** | Whenever this hero takes damage, it gains 5 Defense and 5 Wisdom. | existing | Thick Hide (Grizzly) |
| Coil | Beast/Mind | **Serpent's Eye** | When this hero enters the battlefield, both active enemies lose 10 Intelligence. | new | Constrict (Basilisk) |
| Vex | Beast (unlock) | **Sanguine** | Whenever an enemy takes Bleed damage, this hero heals for the same amount. | existing | Bloodmeal (Nightfeeder) |

Forty-five rows: twelve straight reuses, thirty-one new cards in the vocabulary that exists, two
that need a verb (Lingering's endure-once, Ironbound's switch lock). The band is deliberately
narrow — an entry grant, a 5-point reaction, a rider on a typed hit, a trickle — and the three
outliers by feel (Lingering, Halo, Pincer's Carapace 30) are the ones §9 phase 6 looks at first.

Things the table is *for*, beyond filling seats:

- **Sibling pairs across a type**: Fault Line / Aftershock on Slate, Cold Snap / Killing Frost
  across Rime and Flurry, Live Wire / Static Field across Tempest and Skyshear. Two heroes of one
  type now want each other on the field for a reason the slate did not give them.
- **Innate → Evolution chains** (Mordrax, Widow, Dread, Pixie, Nightshade): the Evolution passive
  reads its own innate, so the turn at pip 5 is *more of what this hero already was*.
- **Reuses that name a role**: Sunder on Gallant and Rallying Standard on Valor say *the lancer*
  and *the captain* in words the player already learned off gear.

---

## 8. Measured

Sim, 3000 runs, chart pilot, seed 7, against the pre-innate tree on the same seed (the doc
commit, `75aebc0`). Four batches:

| | full-clear | Act 1 | Act 1 Guardian | Act 2 | finale |
|---|---|---|---|---|---|
| base (pre-innate) | 20.8% | 67.8% | 91.7% (15.6 rounds) | 70.6% | 52.8% |
| Mark 5, Guardians marked | 18.2% | 55.8% | 75.9% | 67.4% | 62.9% |
| Mark 3, Guardians marked | 20.3% | 61.6% | 83.2% | 69.6% | 58.6% |
| **Mark 5, Guardians bare — SHIPPED** | **22.5%** | **68.3%** | 93.1% | 67.3% | 62.6% |

- **The Guardian's Mark was the whole Act 1 delta.** The Skirmish and the Elite — innate against
  innate — did not move (73.3 → 72.8%, 75.8 → 76.4%); the three-round `fight` nodes barely
  accrue a Mark (99.1 → 98.4%); the fourteen-round Act 1 Guardian took the twelve points alone.
  Halving the magnitude recovered half; taking it off the champion recovered all of it.
- **The innates are a ~+2 point player buff, all of it in the finale** (52.8 → 62.6%): the
  Herald and the Eyes carry no innate against a roster that now does. Acts 2–5 each gave up one
  to three points to the spawn's Mark and the Act 2 Guardians (Necropolis 95 → 91, Storm Coast
  96 → 88) are the ones to watch — the two whose escorts stand longest.
- **Per hero, every roster win rate moved inside ±2.6 points** (n ≈ 300–600, SE ≈ 1.3). Revenant
  +2.0 win / −5.4 die% — the largest death-rate drop on the table, as Lingering should, and not an
  outlier. Bellows −0.6 win / +4.9 die% / +8.6 DPR, drafted 28% more often (396 → 508): the Burden
  prices at about the 60 under this pilot. Nothing on the trap or the runaway shape.
- **Not measured:** the Mark on the companion (the pilot fields it as a hero; its 48.7% loss rate
  is unchanged).

## 8b. What the run feels like

The draft has a second line to read. Two Fire cards side by side are *the one whose Burns feed its
Attack* and *the one whose enemies' Burns feed its Intelligence*, before either has a stat bar
looked at. A Skirmish against spawn has a clock on it from round one — the chips said *Mark of the
Titan*, and by round six the player knows a spawn left standing is a spawn hitting for double.
The companion is the one Titan's creature on your side and it climbs the same way, which is a
reason to lead with it and the reason it dies. A Burden hero is a body the player chose to live
with: Bellows leads or it sits, and its 610 is the reason you took it anyway.

Nothing new is decided in-run. There is no screen, no reroll, no shelf; the innate is read at the
draft and the Constellation, and then it is simply true.

---

## 9. Order of work

| Phase | What lands | Status |
|---|---|---|
| **1. The slot** | `innatePassiveOf` / `titansMarkOf` (`src/run/innate.ts`); `test/roster` pins one innate a hero, not `statGrants`-only, never its own type's Boon, no Mark on a hero; the new `innatePassives` section is outside `boonPassives`, a reused equipment card stays in it. | **IN** |
| **2. The Mark** | `TITANS_MARK_FORCE` = 5; fourteen generated (`titansMarkFor`, `isTitansMark`), attached in `titanspawn.ts`'s definition builder; **no Guardian carries one** (§3, §8); the companion carries it; the chip and dossier show it. | **IN** |
| **3. The forty-five** | §7's table in `src/data/heroes.ts` and `passives.ts`; no placeholders — the two verbs landed in the same commit. | **IN** |
| **4. The Burden** | `PassiveDefinition.burden`; `BURDEN_SURPLUS` = 60, `heroStatTotalFor`, the roster test pins exactly `['steamColossus']`; `cannotSwitchOut` read through `canSwitchOut` at every voluntary-switch site (engine, fight screen, both sim pilots); Bellows at 280 / 120 / 105 / 15 / 35 / 5 / 50, the sheet printing `610 · Burden`. `holdsNoItems` NOT built — no hero asked for it. | **IN** |
| **5. Vocabulary** | `enduresOnce` (Lingering): `Combatant.enduresLeft` counted at fight build, spent in `applyHpDelta` on any lethal loss, an `Endured` event voiced in the log. The other three shapes wait on a hero that wants them. | **IN** (endure) |
| **6. Reading surfaces** | `StageInnate` (glyph, name, the whole sentence) between the dais and the kit on the draft, the Recruit claim and the Guild Hall / replace stage, tapping to the dossier; the Compendium and Constellation dossier lead the Stats tab with it; the pre-fight scout chip names it under the typing (a spawn's reads *Mark*); the hero sheet's Passives tab lists it as *Innate*; the nameplate long-press shows it with the rest. | **IN** |
| **7. Measure** | §8. | **IN** |

---

## 10. Locked invariants this overturns

Until the phase named lands, the rule below is still the rule in force.

| Invariant (CLAUDE.md / code) | What changes | Phase |
|---|---|---|
| `passiveIds`: *"a hero's identity still lives in its Evolution and its Class, not here"* | Reversed: every hero holds one innate there. | 1 |
| Boons: *"Evolution passives and Classes are excluded: both are somebody's identity already"* | Innate passives join the exclusion. | 1 |
| *"Every hero's seven stats sum to exactly 550"* | Held — except a Burden hero, at `550 + BURDEN_SURPLUS`, flagged and printed. | 4 |
| *"A specialist is signalled by spiking one stat … never by coming in under the total"* | A Burden comes in OVER the total; the flaw is the signal. Still never under. | 4 |
| Titanspawn kits are *"from the type slates"* and a spawn's definition carries nothing but its line | Every spawn and the companion carry the Mark; a Guardian does not. | 2 |
| Lock-in and *"voluntary switching is disabled once half a side is KO'd"* | Unchanged in rule; Ironbound is a per-hero lock the rule sits beside. | 4 |
| *"A Class is a VERB, never a number"* | Extended to innates: the same test, one more source. | 1 |
| *"Nothing team-wide grants a passive"* | Untouched. An innate is hero-scoped. | — |
| *"A bare number never gets a screen"* | Untouched. Nothing here has a screen. | — |

---

## 11. Open questions — DO NOT silently resolve

1. **The companion and the Mark.** Keep it (proposed — the Titan's creature on your side, and the
   fielding rule already makes it a thing that dies) or strip it at the join? A +5 Force a round on
   a hero in every fight is the largest player-side buff in this document; the sim measures it
   before anyone plays it.
2. **The Mark by tier.** One magnitude for all three tiers, or Early 3 / Mid 5 / Late 5? Proposed:
   one dial until Act 1 says otherwise.
3. **The Burden's surplus in base or in grades.** Proposed base (§4: front-loaded is the point).
   The alternative — a 550 line with a 34-point grade budget — is a late-blooming Burden, which is
   a different creature and may deserve its own name later rather than the same one.
4. **How many Burdens, and whether any existing hero converts.** Proposed: Bellows only, and the
   rest on new seats. Ursa is the tempting second and is argued against above.
5. ~~`replacesInnate` on at most one path — or any path.~~ **Declined by the designer
   (2026-09-20): no path replaces the innate, ever.** §5.
6. **Whether a hero's innate may be its own type's +20% Boon** (Emberheart on a Fire hero). §7
   never does it; it would make that Boon a dead card for that hero and the filter cannot see it.
   Proposed: never.
7. **Ordering against the buff/debuff rework.** Six rows in §7 are stat riders on a hit, the shape
   the signature rework is waiting on. Land phases 1–3 first (the rows are small numbers), or land
   the rework first so the innates are authored to it?
8. **Whether Titanspawn *also* get a per-line passive** beyond the Mark, once the roster's are in
   and the Mark is measured. Not proposed; named so it is not assumed.
9. ~~The Guardians' Mark against the Act 1 Guardian.~~ **Answered by measurement (§8):** it was
   the whole loss, and the champion carries no Mark. A delayed start (round 3) was the draft's
   fallback and was not tried; it is still available if the escorts' Mark ever wants a body to
   stack with.

### Watch in playtest

- Does a second Fire card at the draft read as a *different hero* now, or still as a different
  stat bar? That is the whole test; the numbers are downstream.
- Does *Mark of the Titan* on a chip change how a Skirmish is played (lead the damage, skip the
  set-up turn), or is it invisible until the fourth round?
- Does Bellows get drafted, and does it get led? A Burden nobody takes is a trap with a printed
  price, which is worse than no Burden.
- Do the reused cards (Sunder, Impale, Sanguine) read as *this hero's thing* on the sheet, or as
  gear the hero happens to have? If the latter, the shared-vocabulary bet is wrong and those rows
  want uniques.
