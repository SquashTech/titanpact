# innate-passives.md — Innate passives, the Titan's Mark, and the Burden

> **STATUS: BUILT 2026-09-20** (per user direction, the same day as the draft). Every hero holds
> one innate, every Titanspawn its type's Mark, Bellows the one Burden; measured in §8. **One
> departure from the draft, measured:** a Guardian carries NO Mark (§3). Every number is a first
> pass; `TITANS_MARK_FORCE`, `BURDEN_SURPLUS` and the outlier magnitudes are the designer's to move.
>
> **Every innate has a MASTERED form since 2026-09-24** (per user direction, `docs/mastery.md`
> §5b): the tenth Mastery pip replaces the born card with an authored upgrade of the same verb —
> `HeroDefinition.masteredPassiveIds`, read through `innatePassiveIdsFor` — with every figure at
> least doubled or its reach widened. Everything below describes the born card.

---

## 0. Why this exists

**Pre-Evolution, heroes converge inside a type.** Every hero's seven stats sum to 550, every
hero's grades sum to 28, and every hero draws its moves from its type's slate. At six heroes a
type, they would take the same Mid offers by Act 3 and differ by which stat is spiked. The other
pre-Evolution axes — grade line, typing, starting moves, schedule timing — reveal slowly or are
shared. The sameness risk is **within-type**, not across the roster.

**Pokémon's answer is the ability, not the stat total.** Its Fire-types are Blaze against Flash
Fire against Drought against Flame Body; the ability is what separates two Fire-types with the
same silhouette, and it is on the summary screen before a player commits. Its varied base-stat
totals do not deliver viability — the tier system does, and most of the dex is uncompetitive by
design. Where a low total *is* viable (Azumarill at 420) it is the ability doing the work, and the
stat line is the price charged for it. So varied totals are downstream of passives, and the
passive is the lever.

**The slot already existed.** `HeroDefinition.passiveIds` (`src/engine/content.ts`) is read at
fight build beside every other source; the Herald's Standard and the Eyes' Gaze ride on it. Its
old comment said *"a hero's identity still lives in its Evolution and its Class, not here"* — this
document reversed that on purpose.

**The game stacks passives, which Pokémon does not.** A hero can hold an innate, an Evolution
passive, a Class passive, a Boon and three items' worth, so an innate does not have to *be* the
Evolution's excitement — it is the floor the Evolution builds on (§5).

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
  to pay for it, either direction. The Boon's type-locked `+20%` is the band's median. What
  measures over or under gets its *passive* tuned, never its line. (The one exception is the
  Burden, §4, which is priced on purpose and printed.)
- **A shared vocabulary, a few uniques.** Pokémon runs ~300 abilities across ~1000 monsters and
  Intimidate is on thirty of them. A vocabulary of twenty-odd, with a handful of signatures, is
  something a player learns. §7 reuses the existing catalog wherever a card already fits —
  Impale, Quickening, Sanguine — and those reuses are the point, not a shortcut.

---

## 2. The innate

**Schema.** `HeroDefinition.passiveIds` is the slot; a roster hero holds exactly one innate there
(two ids under one name where a card needs two halves — Broadside, On the Hour), and
`test/roster` pins it — a valid `PassiveDefinition`, not `statGrants`-only, never its own type's
+20% Boon, and in no pool. `innatePassiveOf(hero)` / `innatePassiveIdsFor` (`src/run/innate.ts`)
are the readers.

**In no pool.** The Boon pool (`src/run/boons.ts`) excludes Evolution passives and Classes
because *both are somebody's identity already*; the new innate cards join that exclusion
(`innatePassives` sits outside `boonPassives`). An innate that is ALSO an equipment passive
(Mordrax's Impale) can still arrive on a drop and stack — the innate is simply the first stack.
That is a feature to watch, not a bug to close.

**Who carries it.** Every hero, owned or not, so a hero-pool enemy fights with it for free (same
definition), a contract hero brings it, a Guild hire has it too, and the scouted chip names it.

**Timing.** Nothing about an innate is gated: it is live from the first fight, the same on a level
1 hire and a level 30 veteran. The schedule and the pips are the things that unfold; the innate
is the thing that is already true.

---

## 3. The Titan's Mark — one passive per type, on every Titanspawn

The Titanspawn are not heroes and get no authored innate. They get **the Mark**: one passive per
mortal type, fourteen of them, generated from the type (`titansMarkFor`, `isTitansMark`) and
attached in `titanspawn.ts`'s definition builder:

> **Mark of the Titan (Fire)** — *At the end of each round this creature stands on the field, it
> gains Fire Force 5.*

- **No new verb**: a `RoundEnded` reaction applying the type's Force status to self. The Force
  statuses are additive, never decay and survive a switch, so the stack grows and survives a pivot.
- **Active only.** `RoundEnded` fires for active owners, so a benched spawn does not accrue — the
  Pact Clock's shape. It is the Titan's clock in miniature: the longer the creature stands, the
  harder it hits, and the pressure is on the player to end fights rather than cycle through them.
- **Magnitude, first pass: `TITANS_MARK_FORCE` = 5.** Force is flat BasePower before the multiplier
  chain, and the slates' medians are Early 40 / Mid 55 / Late 80: at round four a Mid spawn is +20
  on 55, at round eight near double. If 5 proves too much, the alternatives in order are a
  per-tier magnitude (Early 3), a cap on the stack, and a later first tick — not a smaller number
  on every tier.
- **On the enemy side, a spawn fights like the Titan's; a hero-pool enemy fights like a hero.**
  A Skirmish against spawn is a fight against a clock, a Skirmish against a hero party a fight
  against a kit.
- **The Guardians carry NO Mark** (reversed from the draft, measured — §8): a Marked Manticore in
  a fourteen-round fight went 91.7 → 75.9% and took Act 1 from 67.8 to 55.8%, and a bare champion
  with Marked escorts put both back exactly. **The seal keeps the Titan's Mark off the Guardian** —
  its escorts climb, it does not. The Herald keeps its Standard and the Eyes their Gaze; Ancient
  has no Mark, because the Titan does not mark itself.
- **The companion carries the Mark.** It is a `TitanspawnDefinition`, so it inherits one: the
  Titan's creature fighting for you, a reason to lead with it and a reason it dies. Whether to
  keep that is §11's first open question.

---

## 4. The Burden — a drawback the stats pay for

The designer's steer: drawback passives are design space worth exploring, on the Slaking model —
a gigantic body attached to a flaw — but not Truant itself.

**A Burden is an innate whose passive is a cost, and whose hero comes in OVER the 550 by a fixed,
printed surplus.** `BURDEN_SURPLUS` = 60 (first pass), in the base line, so the sheet's Stat Total
row prints `610 · Burden` and the number is still the player's to check. `PassiveDefinition.burden`
flags it; `heroStatTotalFor` and the roster test pin `550 + BURDEN_SURPLUS` for exactly
`['steamColossus']` — **Bellows alone**.

Why a *fixed* surplus rather than one priced per drawback: pricing each separately is the
varied-BST problem coming back through the passive, and the repo's precedent for unlike things at
one price is the Banner — grants held at *measured parity*, the sim doing the pricing. Each
Burden's severity is authored to be worth about the surplus, then measured: one that measures as
free gets sharper, one that measures as a trap gets blunter. The stats never move again.

**Base, not grades.** The surplus is 60 base points and the hero still has 28 grade points, so a
Burden hero is front-loaded by construction — *arrives big, does not grow into it*. A Burden in
grades (a bigger body that keeps getting bigger) is a different, worse creature and is not
proposed.

**Permanent.** No Evolution path sheds a Burden, because the surplus stays and the price would not.

**Never a numerical drawback on the sheet.** A Burden is a verb: `−20 Speed` is not a Burden, it
is a stat line. **Ironbound** is the one built — cannot switch out voluntarily (`cannotSwitchOut`,
read through `canSwitchOut` at every voluntary-switch site), and since 2026-09-29 it also vents 15
Mana at every round end on the field (Boiler Pressure, a `loseMana` effect, §7c). The rest of the
candidate vocabulary is **unbuilt, waiting on a hero that wants it**:

| Burden | Effect | Vocabulary |
|---|---|---|
| **Bare-Handed** | Holds no items — `itemSlotsFor` reads 0; never on a who-screen. | New: `holdsNoItems`, one line in `itemSlotsFor`. |
| **Bloodprice** | Every hit this hero lands costs it 5% of max HP, direct. | A self-aimed passive `damage` effect (now in the vocabulary). |
| **Thin-Skinned** | Takes 20% more damage from every hit. | New: a defender-side `damageModifier`. |
| **Hollow** | Cannot be healed by allies (its own Renew and drain still work). | New: `refusesAllyHeals` on the heal pipeline. |
| **Unrested** | MP Regen 0 — a burst caster that Rests. | Expressible, but it is a number; listed to be argued against. |
| **Lumbering** | Always acts last inside its priority bracket. | New: a Speed-order override in `orderActions`. |

**How many.** Bellows was converted because the body already said it (a steam colossus, now
280 / 120 / 105 / 15 / 35 / Speed 5 / Mana 50). Any further Burden goes on a *new* seat rather
than rewriting a 550 hero into a 610 one; Ursa was the tempting second and was declined (its
Evolution is already the identity). Kappa's proposed dish-spilling Burden was left unbuilt.

---

## 5. The Evolution builds on the innate — never replaces it

Additive: the Evolution passive lands beside the innate, and several rows in §7 are written so
the innate *feeds* the path — Mordrax's Impale into Bloomfang's Thornrot (Poison applied → +10
Attack, +10 Speed); Nightshade's Shadowmeld (Ambush 10 on entry) under Penumbra's Afterimage
(Ambush 20). The Evolution is still where the kit turns a corner, and the innate is the run-up.

**No path ever replaces the innate** (2026-09-20, per user direction; a `replacesInnate` field
was proposed and declined). The innate is what the hero *is*, on both sides of the field and for
the whole run — an Evolution may make it wrong for the new shape (Cinder's Thunderblaze does not
want Kindling), and that mismatch is the path's price. `EvolutionPath` carries no such field and
none should be added. (The tenth Mastery pip's mastered form is an upgrade of the same verb, not a
replacement — see the status note.)

---

## 6. Where it is read

- **The draft card, the Recruit claim and the Guild Hall / replace stage** (`StageInnate`: glyph,
  name, the whole sentence, tapping to the dossier). *An identity a player reads before drafting*
  is the standard — it is on the card, not behind a sheet.
- **The dossier** (Collection, Constellation) leads its Stats tab with it; **the hero sheet's
  Passives tab** lists it as *Innate*.
- **The scouted chip and the node dossier**: the name only. A Titanspawn chip reads *Mark*.
- **The fight nameplate** on long-press, with the rest of the passives.
- **The Burden** prints on the sheet's Stat Total row (`610 · Burden`) and its passive row is
  tinted as a cost.

No screen collects a decision about any of it. An innate is never chosen, never rerolled, never
sold.

---

## 7. The forty-five (2026-09-20 first pass, kept current)

The base-era roster's innates, with the Evolution passive in the last column so the two read as a
pair. Rows re-authored in §7c show the current card. The innates of the From the Tall Grass three
(Drake, Nautilus, Tixwick) and of the Starfall heroes are authored in `src/data/heroes.ts` /
`passives.ts` on the same rules. *existing* is a straight reuse of a catalog card; *new* a new
`PassiveDefinition`, with any engine verb it needed noted.

| Hero | Type | Innate | Effect | Status | Evolution passive |
|---|---|---|---|---|---|
| Cinder | Fire | **Kindling** | Whenever this hero afflicts Burn, it gains 5 Attack. | new | Cinderguard (Ironclad) |
| Crimson | Fire | **Stoke** | Whenever an enemy takes Burn damage, this hero gains 10 Intelligence. | new | Firestarter (Pyroclasm) |
| Brimstone | Fire/Shadow | **Sulphur** | When this hero enters the battlefield, both active enemies gain Burn 5. | new | Ashfeast / Hexfume |
| Riptide | Water | **Drag** | Whenever this hero lands a Water attack, its target loses 5 Speed. | new | Enthrall (Siren) |
| Pincer | Water | **Carapace** | When this hero enters the battlefield, it gains Shield 30. | new | Static Tide (Tideclaw) |
| Leviathan | Water | **Overchannel** | Whenever this hero lands an attack, it gains 10 Mana, past its pool. | existing | — |
| Flurry | Frost | **Frostbite** | At the end of each round, every Frozen enemy loses 10% of its max HP. | new (§7c) | Killing Frost (Avalanche) |
| Rime | Frost | **Cold Snap** | Whenever this hero Freezes an enemy, it gains 10 Attack. | new | Frozen Stone (Glacier) |
| Floe | Frost | **Absolute Zero** | Whenever this hero's Defense rises, both active enemies lose 5 Speed. | new | Cold Forge (Shatterframe) |
| Squall | Storm | **Tailwind** | When this hero enters the battlefield, its partner gains 10 Speed. | new | Squall Line (Windshear) |
| Tempest | Storm | **Live Wire** | Whenever this hero sets off Conduct, it gains Shield 20. Rising Static in the kit plants the mark. | new · `StatusDetonated` hook | Either Hand (Forked) |
| Skyshear | Storm | **Stormveil** | The first time each fight an enemy's Conduct bursts, this hero gains Barrier for the rest of the round. | new (§7c) | Charged Air (Stormeye) |
| Crag | Stone | **Vengeful Emblem** | Whenever this hero takes damage, it gains 10 Attack. | existing | Unstoppable Growth (Rootwarden) |
| Sentinel | Stone | **Stone Wall** | When this hero enters the battlefield, its partner gains Shield 20. | new | — |
| Petra | Stone | **Fault Line** | Whenever this hero lands a Stone attack, it gains Shield 10. | new | Aftershock (Quakebringer) |
| Sylva | Nature | **Verdurous** | Whenever this hero grants Renew, a random enemy suffers Poison 5 — per grant. | new | Nature's Purification / Restorative Toxin |
| Mordrax | Nature | **Impale** | Whenever this hero lands an attack, its target suffers Poison 5. | existing | Thornrot (Bloomfang) — fed by the innate |
| Hollowbark | Nature | **Barbs** | Whenever this hero takes damage, enemies suffer Poison 3. | existing | Heartwood (Thornheart) |
| Solace | Light | **Dawnlight** | When this hero enters the battlefield, it gains Light Force 10, up to 3 times a fight. | new (§7c) | Afterglow (Dawnherald) |
| Aegis | Light | **Consecrate** | Whenever this hero is healed, it gains 5 Defense and 5 Wisdom. | new | Shieldbearer (Warforged) |
| Empyrean | Light | **Halo** | At the end of each round, this hero's partner is healed 10. | new | Sunblind (Sunborne) |
| Widow | Shadow | **Lethal Bite** | Deals double damage to an enemy that is both Bleeding and Poisoned; the kit sets the table. | new · `requiresTargetStatuses` | Widow's Kiss / Snare — feeds the innate |
| Marrow | Shadow | **Necrosis** | Whenever an enemy takes Poison damage, this hero heals for the same amount. | new | — |
| Nightshade | Shadow | **Shadowmeld** | When this hero enters the battlefield, it gains Ambush 10. | new | Afterimage (Penumbra) — stacks to 30 |
| Glyph | Arcane | **Arcane Repose** | Whenever this hero Rests, it gains Shield equal to the Mana it recovered. | new · `Rested` hook | Overspill (Thaumaturge) |
| Zenith | Arcane | **Surging Intellect** | Whenever this hero gains Mana, it gains that much Intelligence. | new (§7c) | — |
| Pixie | Arcane | **Mana Chime** | While this hero is on the field, its partner has +10 MP Regen. | new (§7c) | Pixie Dust (Stardust) |
| Reverie | Mind | **Neuroplastic** | Whenever an enemy's Wisdom is lowered, this hero gains that much Wisdom. | new · event-read `statDelta` | Either Hand (Embodied) |
| Lucius | Mind | **Hunger** | Whenever this hero lands a Mind attack, it heals for 20% of the damage dealt. | new | Sanguine — the other half of the vampire |
| Trance | Mind | **Lullaby** | At the end of each round, both active enemies lose 5 Speed. | new | Puppet Strings (Puppeteer) |
| Revenant | Spirit | **Ghostlight** | This hero's Spirit moves deal 25% more to a Haunted foe (2026-10-02; it was Spirit Force 10 a Haunt, which banked a permanent stack off every fresh enemy). | new | Communion (Undying) |
| Sorrow | Spirit | **Lament** | Whenever this hero damages a Haunted enemy, it heals for that amount. | new · `eventTargetHasStatus` | Grief (Mourner) |
| Dread | Spirit | **Nightmare** | At the end of each round, every Haunted enemy loses 10% of its max HP — direct, past any Shield. | new · `damage` effect | Omen — feeds the innate |
| Warden | Iron | **Rivet** | At the end of each round, its partner gains 5 Defense. | new | Sentry (Bulwark) |
| Valor | Iron | **Rallying Standard** | When this hero enters the battlefield, its partner gains 10 Attack and 10 Intelligence. | existing | Tempering (Shieldwall) |
| Gallant | Iron | **Breach** | Whenever this hero lands an attack, its target loses 5 Defense. | new (§7c) | Cavalry Charge (Charger) |
| Scallywag | Iron | **Broadside** | On the bench, loads a cannonball a round (up to `BROADSIDE_MAGAZINE` = 4); on entering, fires them all — `BROADSIDE_SHOT` = 5% of max HP to both enemies per ball, direct. The ONLY reaction that fires from the bench. | new · `whileBenched`, `maxMagnitude`, `perHeldStatus` | Plunder (Corsair) |
| Clockwork | Mech | **Boiler** | Mech attacks have a 30% chance to Burn 10, scaled by its Intelligence — the first passive magnitude that scales. | new · `chance`, `scaledBy` | Combustion (Runaway) |
| Bellows | Mech/Iron | **Ironbound** *(Burden)* | Cannot switch out voluntarily; vents 15 Mana at every round end on the field. Stat Total 610. | vocab | Runaway Pressure / Superheat |
| Rex | Mech | **Tyrant's Due** | Once a fight, a finishing blow grants 10 Attack for the rest of the RUN (`permanentStatGains` → `RosterEntry.bonusStatGrants`). The one innate that outlives the fight. | new · `finishingBlow`, `permanent` | Rampant (Tyrant) |
| Patch | Mech | **Upkeep** | At the end of each round, its partner heals 12 healing power, scaled by this hero's Wisdom. | new (§7c) | Nanites (Triage) |
| Fang | Beast | **Pack Hunter** | Whenever this hero's partner lands an attack, this hero gains 5 Attack. | new | Bloodthirsty (Bloodhunt) |
| Ursa | Beast | **Feast** | A finishing blow heals a third of its max HP. | new · `percentMaxHp` amount | Thick Hide (Grizzly) |
| Coil | Beast/Mind | **Serpent's Eye** | When this hero enters the battlefield, both active enemies lose 10 Intelligence. | new | Constrict (Basilisk) |
| Vex | Beast | **Sanguine** | Whenever an enemy takes Bleed damage, this hero heals for the same amount. | existing | Bloodmeal (Nightfeeder) |

The band is deliberately narrow — an entry grant, a 5-point reaction, a rider on a typed hit, a
trickle. Lingering (the endure-once verb, `enduresOnce`, an `Endured` event) was Revenant's innate
for a day; the verb stays in the engine and is held again by Ashwing's Smoulder, whose mastered
Rebirth reads an `Endured` passive hook.

Things the table is *for*, beyond filling seats:

- **Sibling pairs across a type**: Fault Line / Aftershock on Petra, Cold Snap / Killing Frost
  across Rime and Flurry. Two heroes of one type want each other on the field for a reason the
  slate did not give them.
- **Innate → Evolution chains** (Mordrax, Widow, Dread, Nightshade): the Evolution passive reads
  its own innate, so the turn at pip 5 is *more of what this hero already was*.
- **Reuses that name a role**: Rallying Standard on Valor says *the captain* in words the player
  already learned off gear.

---

## 7c. Innates re-authored (2026-09-29, per user direction)

Sim pass 13 put seven of these heroes in the roster's bottom ten; each also took a second on-type
attack into its starting kit the same day. The innates were rewritten by the designer, with three
edits from review: Pixie's aura is **while on the field**, Patch's heal runs on **the heal
formula's Wisdom term** rather than a share of max HP (Renew stays the one percent heal), and
Skyshear's Barrier is **once a fight** — Barrier is the game's hardest lockout.

| Hero | Innate | What it does | Mastered (+) | Engine |
|---|---|---|---|---|
| Zenith | **Surging Intellect** | Whenever this hero gains Mana — regen, a grant, a Rest — it gains that much Intelligence. | twice that much | new `ManaGained` hook; the third derived grant (CLAUDE.md) |
| Pixie | **Mana Chime** | While this hero is on the field, its partner has +10 MP Regen. | and +10 MP Regen on Pixie | new `partnerStatGrants` aura, read live in `getEffectiveStat` |
| Flurry | **Frostbite** | At the end of each round, every Frozen enemy loses 10% of its max HP. | 20% | Nightmare's shape on Freeze |
| Kite | **Outpace** | At the end of each round, if both active allies move before both active enemies, this hero gains 20 Intelligence — it stacks. | 40 | new `sideOutspeeds` condition (reversed under Stasis Bubble) |
| Patch | **Upkeep** | At the end of each round, its partner heals 12 healing power, scaled by this hero's Wisdom. | 24 | passive `heal` `scaledBy` — the second `scaledBy` holder |
| Morel | **Sporefall** | At the end of each round, both active enemies are Poisoned 5. | Poisoned 10 | none — Poison's timer holds while the magnitude climbs, so a 15% burst every three rounds |
| Skyshear | **Stormveil** | The first time each fight an enemy's Conduct bursts, this hero gains Barrier for the rest of the round. | this hero and its partner | none |
| Solace | **Dawnlight** | When this hero enters the battlefield, it gains Light Force 10, up to 3 times a fight (`maxFiresPerFight` since 2026-10-02, so pivoting no longer farms it). | Light Force 20 | none (replaced Grace) |
| Carillon | **On the Hour** | At the end of every third round, the bell tolls: Sanctuary is set, and this hero's Mana is fully restored (two ids under one name; replaced Toll). | every second round | new `restoreMana` effect — refills to the pool, never past it |
| Hush | **Silent Wings** (reworked) | Whenever this hero Freezes an enemy, it gains Frost Force 10 (was Ambush 15), up to 3 times a fight. | Frost Force 20 | none |

The same pass added three Early moves that fill slate gaps — **Ki Strike** (Mind, physical, for
Koan), **Primal Roar** (Beast, magical, for Coil) and **Radiant Blow** (Light, physical, in
Carillon's kit). Second Wind is sound (Renew 14% ticks three times, ~40% of max HP for 30 mana);
the sim reads it as 0 healing because its move ledger credits a cast, not the ticks after it.

**The Burden tightened (same day).** Bellows was the roster's top hero: Ironbound cost nothing
when the whole roster fields and the enemy never forces a pivot. Ironbound now also **vents 15
Mana at every round end on the field** (Boiler Pressure, a `loseMana` effect), after regen, so it
nets −5 a round before a cast; with no bench to cycle to, the answer is a Rest — about one round
in three he stands still. The 610 stands. **Kappa** opens on Tide Guard in place of Siphon: Siphon
fed Brimming's +10 Attack every cast, a self-loop from turn one.

**Gallant, Rex and Ursa, the same day.** Gallant's innate is now **Breach** (5 Defense a landed
attack; Breach+ 15), so Swords and the Boon keep Sunder at 10. Rex trades 10 Attack for 10 HP
(100 / 220). Feast heals a third of max HP, not half. Measured (10k a pilot, seed 84): none of the
five nerfs moved its hero past noise (chart ±0.45); the top six are high-Attack physical heroes at
+0.2 to +0.6 skilled and +1.8 to +2.5 chart. Each +10 base Attack reads as ≈ +0.43 chart-pilot
fights across the physical roster (r 0.51) against an Act 1 spawn average of 32 Defense. The edge
is structural, and strong for a middling player rather than an expert.

Retired: Grace, Glaciate, Headwind, Field Repair, Mycelium, Static Field and their mastered cards.
Arcane Reservoir and Attunement stay as equipment cards. **For playtest:** Zenith has no fixed cap
but the ×4 fight ceiling (+255 Intelligence at base 85), and Outpace and Frostbite are strongest
against the enemy AI precisely because it never switches (Freeze never clears, a speed lead never
breaks on a pivot).

## 8. Measured

Sim, 3000 runs, chart pilot, seed 7, against the pre-innate tree on the same seed (`75aebc0`):

| | full-clear | Act 1 | Act 1 Guardian | Act 2 | finale |
|---|---|---|---|---|---|
| base (pre-innate) | 20.8% | 67.8% | 91.7% (15.6 rounds) | 70.6% | 52.8% |
| Mark 5, Guardians marked | 18.2% | 55.8% | 75.9% | 67.4% | 62.9% |
| Mark 3, Guardians marked | 20.3% | 61.6% | 83.2% | 69.6% | 58.6% |
| **Mark 5, Guardians bare — SHIPPED** | **22.5%** | **68.3%** | 93.1% | 67.3% | 62.6% |

- **The Guardian's Mark was the whole Act 1 delta.** The Skirmish and the Elite — innate against
  innate — did not move; the three-round `fight` nodes barely accrue a Mark; the fourteen-round
  Act 1 Guardian took the twelve points alone. Halving the magnitude recovered half; taking it off
  the champion recovered all of it.
- **The innates are a ~+2 point player buff, all of it in the finale** (52.8 → 62.6%): the Herald
  and the Eyes carry no innate against a roster that now does. Later acts each gave up one to three
  points to the spawn's Mark.
- **Per hero, every roster win rate moved inside ±2.6 points** (SE ≈ 1.3). Bellows −0.6 win /
  +4.9 die% / +8.6 DPR, drafted 28% more often: the Burden priced at about the 60 under this pilot
  (before the 2026-09-29 vent).
- **Not measured:** the Mark on the companion.

These figures predate the four-act run and the 84-hero roster.

## 8b. What the run feels like

The draft has a second line to read. Two Fire cards side by side are *the one whose Burns feed its
Attack* and *the one whose enemies' Burns feed its Intelligence*, before either has a stat bar
looked at. A Skirmish against spawn has a clock on it from round one — the chips said *Mark*, and
by round six the player knows a spawn left standing is a spawn hitting for double. The companion
is the one Titan's creature on your side and it climbs the same way. A Burden hero is a body the
player chose to live with: Bellows leads or it sits, and its 610 is the reason you took it anyway.

---

## 9. Where it lives

`src/run/innate.ts` (`innatePassiveOf`, `innatePassiveIdsFor`, `titansMarkOf`); the cards in
`src/data/passives.ts` (`innatePassives`, `titansMarkFor`, `isTitansMark`); the slot on
`HeroDefinition.passiveIds` / `masteredPassiveIds` in `src/data/heroes.ts`; `BURDEN_SURPLUS` and
`heroStatTotalFor` beside the stat budget; `cannotSwitchOut` through `canSwitchOut`;
`enduresOnce` spent in `applyHpDelta`. `test/roster` pins the rules in §2 and §4.

---

## 10. Locked invariants this overturns

| Invariant (CLAUDE.md / code) | What changed |
|---|---|
| `passiveIds`: *"a hero's identity still lives in its Evolution and its Class, not here"* | Reversed: every hero holds one innate there. |
| Boons: *"Evolution passives and Classes are excluded: both are somebody's identity already"* | Innate passives join the exclusion. |
| *"Every hero's seven stats sum to exactly 550"* | Held — except a Burden hero, at `550 + BURDEN_SURPLUS`, flagged and printed. |
| *"A specialist is signalled by spiking one stat … never by coming in under the total"* | A Burden comes in OVER the total; the flaw is the signal. Still never under. |
| Titanspawn kits are *"from the type slates"* and a spawn's definition carries nothing but its line | Every spawn and the companion carry the Mark; a Guardian does not. |
| Lock-in and *"voluntary switching is disabled once half a side is KO'd"* | Unchanged in rule; Ironbound is a per-hero lock the rule sits beside. |
| *"A Class is a VERB, never a number"* | Extended to innates: the same test, one more source. |
| *"Passive-applied magnitudes are flat — a passive has no move to take STAB from"* | Named exceptions, per user direction: Boiler's Burn (`scaledBy: 'intelligence'`, 2026-09-20) and Patch's Upkeep (`scaledBy: 'wisdom'`, 2026-09-29). A further one should be a conversation. |
| *"Nothing team-wide grants a passive"* | Untouched. An innate is hero-scoped. |
| *"A bare number never gets a screen"* | Untouched. Nothing here has a screen. |

---

## 11. Open questions — DO NOT silently resolve

1. **The companion and the Mark.** It keeps the Mark today (the Titan's creature on your side,
   and the fielding rule already makes it a thing that dies); the alternative is stripping it on
   `RosterEntry.mortal` at the join. A +5 Force a round on a hero in every fight is the largest
   player-side buff in this document, and it has never been measured.
2. **The Mark by tier.** One magnitude for all three tiers, or Early 3 / Mid 5 / Late 5? One dial
   until Act 1 says otherwise.
3. **More Burdens.** Bellows alone today; any further one on a new seat (§4).
4. **The buff/debuff rework.** The innates landed first; several §7 rows are stat riders on a hit,
   the shape the signature rework is waiting on, and would be re-read against it if it lands.
5. **Whether Titanspawn *also* get a per-line passive** beyond the Mark. Not proposed; named so it
   is not assumed.
6. **A delayed first tick for the Mark** (round 3) was the draft's fallback for the Guardian and
   was never tried; it is still available if the escorts' Mark ever wants a body to stack with.

### Watch in playtest

- Does a second Fire card at the draft read as a *different hero* now, or still as a different
  stat bar? That is the whole test; the numbers are downstream.
- Does *Mark* on a chip change how a Skirmish is played (lead the damage, skip the set-up turn),
  or is it invisible until the fourth round?
- Does Bellows get drafted, and does it get led? A Burden nobody takes is a trap with a printed
  price, which is worse than no Burden.
- Do the reused cards (Impale, Sanguine, Rallying Standard) read as *this hero's thing* on the
  sheet, or as gear the hero happens to have? If the latter, the shared-vocabulary bet is wrong and
  those rows want uniques.
