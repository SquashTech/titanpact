# Hero audit — innates and Evolutions, type by type

Started 2026-10-07, per user direction: the macro design is settled, so the pass is micro — every
hero's innate, mastered innate and three Evolution paths, one type at a time. **Fun first,
balance second.** The working sheet is `docs/balance/heroes.md` (`scripts/exportBalance.ts`, which
now prints the innate, the mastered innate, the signature level and each granted move in full).

**The live tracker is a Google Sheet** (2026-10-08): [Titanpact — Hero Audit](https://docs.google.com/spreadsheets/d/17NZ7OlZBINW-01sexIBrN-86Xo2sUe9g8y54VcLx_Xs/edit), one row
per innate, mastered innate and Evolution path, with Status / Claude's proposal / Your notes / Needs redraw
columns. It was built from the data by importing `moveBrief` and `effect` from `scripts/exportBalance.ts`.
Read it back as a CSV export (the Drive read tool samples only the first 50 rows); a write replaces the
whole sheet, so always read and merge first.

## Evolution art to redraw

Paths whose graft changed after their sprite was drawn. The files were renamed to the new id
(`art/evolutions/<pathId>.png`, `…attack.png`, `…damaged.png`), so each still shows — in the old
type's look. Strike a row when its three frames are redrawn.

| Path id | Hero | Path | Drawn as | Now |
|---|---|---|---|---|
| `rimehold-hearthglow` | Igloo | Hearthglow | Stone (a stone-gated igloo) | Fire |
| `cube-icebreaker` | Floe | Icebreaker | Iron | Mech |
| `stormRanger-dustDevil` | Squall | Dust Devil | Nature | Stone |
| `stormRanger-turbine` | Squall | Turbine | Frost | Mech |
| `skyshear-farsight` | Skyshear | Farsight | Light | Mind |
| `nimbus-raincloud` | Nimbus | Raincloud | Frost | Water |
| `kite-lanternKite` | Kite | Lantern Kite | Light | Spirit |
| `glacialWarden-blizzard` | Flurry | Blizzard | Stone | Storm — check: the snowman wizard may read fine |
| `glacialWarden-snowSpirit` | Flurry | Snow Spirit | Water | Spirit — check |
| `rimehold-aurora` | Igloo | Aurora | Water | Light — check |
| `tidecaller-salamander` | Riptide | Salamander | Frost | Fire |
| `tidecaller-marshrunner` | Riptide | Marshrunner | Mind | Nature |
| `pincer-reefshell` | Pincer | Reefshell | Storm | Stone |
| `selkie-seasinger` | Selkie | Seasinger | Mind | Light |
| `selkie-roane` | Selkie | Roane | Spirit | Arcane |

Rime's Hoarsteel (an armoured knight, now Iron) and Floe's Cryolattice (a crystal, now Arcane)
already read as their new types.

## Rules the audit changed

- **A dual hero's paths each pay a move AND a passive.** A retype on a dual hero swaps a type
  rather than gaining one, so a bare graft + one grant left it with nothing new. **Generalised to
  every hero on 2026-10-10** (`docs/evolution-simplification.md` §10): every path pays a move and
  a passive, the type on top; two passives and no move is pinned by name (`TWO_PASSIVES`).

## Engine vocabulary added

- `reactive.alsoEffect` — a second effect on the same firing (Funeral Pyre's HP and Mana; it also
  folded Crimson's Stoke+, which had been two same-named cards).
- `PassiveHook` `'RoundStarted'` and `'FieldEffectSet'` — ownerless like `RoundEnded`, so each
  active owner is its own subject; `FieldEffectSet` reads `fieldEffectId`.
- `PassiveDefinition.sideRefusesStatuses` — while the holder stands active, its side's active
  heroes refuse those statuses and a held one does not tick (`Combatant.sideStatusImmunities`,
  `statusEngine.sideRefuses`). The refusal is silent in the event stream today.
- `PassiveDamageModifier.perTargetStatusLevel` — the amount per level of a status on the defender.

## Fire (2026-10-07)

| Hero | Change |
|---|---|
| Cinder | **Kindling**: +10 Atk/Int when it lands an attack on a Burning foe (was +5/+5 on applying Burn); **Kindling+** +20/+20. **Ironclad**'s Cinderguard: +10 Defense at the start of each round (was: set both enemies Burning when hit). |
| Crimson | **Cinderveil**'s Ember Veil: its Fire attacks Haunt the target (was Shield 20 on applying Burn). **Pyroclasm**: Landslide removed; Firestarter + **Flameproof** (while active, your active heroes are immune to Burn). Stoke+ is one card. |
| Brimstone | Int grade D → C, HP S → A. Kit Ember/Weaken → **Umbra Bolt**/Weaken (Ember to its Early pool) so it no longer copies Crimson. **Sulphur**: a random enemy set Burning on entry (was both); **Sulphur+** both (was a climb to Badly Burned). **Ashguard** Fire/Stone + Ashfeast + **Rockfall**. **Hexfume** Fire/Nature + Blight + **Hexfume** (entry: both enemies Poison 10). |
| Drake | Magma Hide Shield 40 → 60. Otherwise unchanged. |
| Ashwing | **Sunbird** adds **Dawnfire** (when Sanctuary is set, Fire Force 15, three times a fight). **Ashen**'s Funeral Pyre: the save heals to full HP and refills Mana (was: two Burn levels on both enemies). |
| Tinder | **Fire-Breather**: on switching out, a random enemy becomes Badly Burned (was: every Fire attack sets both Burning); **Fire-Breather+** both enemies. **Grand Finale** now switches Tinder out. **Top Billing**: +15% damage per Burn level on the target (was +30% vs any Burn). |

To watch: the enemy AI never switches voluntarily, so an enemy Tinder's innate fires only off
Grand Finale. Flameproof makes Fire's self-Burn costs free for the whole active side.

## Water (2026-10-07)

| Hero | Change |
|---|---|
| Riptide | **Drag**: a Water hit takes 10 Speed off the target and gives Riptide 10 (was −5 to the target); **Drag+** 20 and 20. **Tidecaller**'s Swell: a physical hit gains 10 Intelligence, a magical hit 10 Attack (was +5 Atk/Int/Spd per Water hit). **Siren**'s Enthrall: both active enemies lose 10 Wisdom at every round's end (was: Water hits Haunt — now Crimson's Cinderveil's). |
| Pincer | **Ironshell**'s Plating: gaining Shield grants Iron Force 10, three times a fight (was +10 Defense). |
| Leviathan | **Tidebreaker**'s Tidal Mass: Water Force 20 when Downpour is set, three times a fight (was a fifth of the Mana spent). **Deepfrost** keeps Glaciate and adds **Freezing Rain** (Downpour set → both enemies Frozen). **Stormwyrm**'s Storm Drinker: its Water hits leave the target Conducting (was: Mana for setting off Conduct). |
| Nautilus | Unchanged. |
| Kappa | Kit Undertow/Tide Guard → Undertow/**Refresh** (Tide Guard to its pool), so Brimming fires off its own kit. **Brimming**, Brimming+, Shared Dish and Spilled Dish now hear Renew's heals too (a tick that restores HP). **Yokai** adds **Spilled Dish** (healed → a random enemy Haunted). |
| Selkie | **Roane**'s Drowned Gift: on entering the field, its partner gains Renew 3 (was: a KO'd foe gives the partner Renew 3). |

Engine: `PassiveDefinition.alsoReactive` — a second reaction on its own hook (Swell).

**Leviathan's Downpour access** (2026-10-08): a new Mid Water move, **Rainmaker** (magical, Pow 45, 40
mana, one enemy, sets Downpour), and Leviathan's pool trimmed to Early 3 (Deep Chill, Jolt, Rainfall)
and Mid 4 (Rainmaker, Drench, Torrent, Shock Bubble) — about 83% to be offered a setter, nearer 78% once a
graft's Mid line joins the pool. Its Deepfrost Trial build carries Rainmaker in Magic Bolt's place.

To watch: Renew heals are
`StatusTicked`, not `Healed`, game-wide; only Kappa's cards were taught to hear both. Pincer's
Tideclaw (Static Tide) and Leviathan's Stormwyrm (Storm Drinker) are now the same verb.

## Frost — renames and grafts (2026-10-08)

Five of Frost's twelve grafts were Stone and three Water, and three paths shared the name Glacier.
Spread so each type appears once across the type (Nature unused); Tusk's Erratic keeps the one
Stone, a glacial erratic being a boulder the ice carried.

| Hero | Path (was) | Graft (was) | Granted move (was) |
|---|---|---|---|
| Flurry | Blizzard (Glacier) | Storm (Stone) | — |
| Flurry | Snow Spirit (Permafrost) | Spirit (Water) | Soul Rend (Oasis) |
| Rime | Snowbound (Avalanche) | — | Snowball |
| Rime | Hoarsteel (Glacier) | Iron (Stone) | — |
| Floe | Icebreaker (Permafrost Core) | Mech (Iron) | — |
| Floe | Cryolattice | Arcane (Stone) | Wardblade (Body Blow) |
| Igloo | Snowfort (Glacier) | — | Frost Wall |
| Igloo | Hearthglow (Keep) | Fire (Stone) | — |
| Igloo | Aurora (Meltwater) | Light (Water) | Benediction (Oasis) |

Innates renamed off move names: Rime's Cold Snap → **Bitter Cold**, Floe's Absolute Zero →
**Pack Ice** (ids unchanged). Art renamed with the ids; Hearthglow's and Icebreaker's drawings were
made for Stone and Iron and want a redraw. Stars on the old ids are dropped (no players yet).
Still owed in the details pass: Bedrock Ice, Frozen Stone and Portcullis carry their old types'
names on new grafts.

## Frost — details (2026-10-08)

| Hero | Change |
|---|---|
| Flurry | **Frostbite**: an enemy loses 10% of max HP as it is Frozen, by anyone's hand (was 10% every round end while Frozen); Frostbite+ 20%. **Avalanche**: Landslide removed; Killing Frost (now +20 Int) + **Snowfall** (a Rest Freezes a random enemy). |
| Rime | **Bitter Cold**: +10 Attack when it lands an attack on a Frozen foe (was: on Freezing); Bitter Cold+ +20. **Hoarsteel** grants **Reinforce** (+20 Atk/+20 Def, both allies), which arms Frozen Stone. |
| Floe | **Pack Ice**: when its Defense rises, a random enemy is Frozen (was −5 Speed to both); Pack Ice+ both enemies. |
| Igloo | **Shelter**: Shield 25 (Shelter+ 50). **Hearthglow**'s Portcullis is **Warm Hearth**: Provoking sets both enemies Burning. |
| Tusk | **Stampede**: its Speed doubles at every round end (was +5 Attack); Stampede+ triples. **Matriarch's Fury**: both active allies gain the 10 Attack. |
| Hush | **Athene** grants **Psionic Wave** (Mind spread, Pow 70, 80 mana, 50% −30 Wis). |

Engine: `PassiveAmount` `targetStat` — the effect target's live stat (Stampede).

**Stampede ignores the ×4 ceiling** (same day, per user direction): Speed only orders turns, so it is
the one stat uncapped (`uncapped` on a passive statDelta); a later debuff never claws an overshoot
back to the ceiling.

To watch: Pack Ice and Rime's Frozen Stone are now the same verb. Frostbite
fires once a fresh freeze, not every round.

## Storm — renames and grafts (2026-10-08)

Frost three times and Light three times across twelve grafts; spread so each type appears once
(Shadow unused).

| Hero | Path (was) | Graft (was) | Granted move (was) |
|---|---|---|---|
| Squall | Dust Devil (Greenwood) | Stone (Nature) | — |
| Squall | Turbine (Whiteout) | Mech (Frost) | Cog Slam (Icicle Thrust) |
| Skyshear | Farsight (Sunward) | Mind (Light) | Psyshock (Radiant Beam) |
| Nimbus | Raincloud (Hailcloud) | Water (Frost) | Rainmaker (Avalanche) |
| Kite | Lantern Kite (Sunkite) | Spirit (Light) | — |

Squall's innate Tailwind → **Slipstream** (it shared the move's name; Whiteout shared Igloo's
signature's). Art moved with the ids; all five drawings were made for the old types.

## Storm — details, DECIDED, NOT BUILT (2026-10-08)

Per user direction; build these first when the audit resumes, then update the sheet.

- **Squall, Slipstream** — REVERSED the same day (per user direction): Squall's innate is **Retrieve** (an Arrow that KOs gets its Charge back), mastered **Retrieve+** with Restock, and he opens with Storm Arrow. BUILT; see `docs/charges.md` "Squall's Arrows".
- **Squall, Windshear's Squall Line**: "This hero's Storm attacks have +30% crit chance" (replaces +5 Atk / +5 Spd per hit). Check whether a passive can grant crit chance yet — crit lives on moves and loadout today.
- Still proposed, no answer yet: Skyshear's Stormveil → Storm Force on setting off Conduct; Kite's Outpace → both allies +10 Atk/Int; Tempest's Forked → Thunderbolt instead of Skyfall; Squall's Dust Devil passive (Thornshot) review.

## Mech — Patch (2026-10-10, per user direction)

Patch's damage is meant to come from the marks he plants (Conduct, Burn) for a partner to cash, not from his own hits.

| Change | Detail |
|---|---|
| **Jumper Cable** (new, Early Mech) | Spark Plug's magical twin: Pow 30, swings with Wisdom (`offStatOverride`), plants Conduct, 20 mana. Replaces Spark Plug in his kit; Spark Plug stays with the four physical Mech heroes. |
| **Short Circuit** (new, Mid Mech) | Malfunction without the roll: Pow 40, swings with Wisdom, plants Burn AND Conduct, no self-Burn, 45 mana. Replaces Malfunction in his pool (Clockwork and Abacus keep Malfunction). |
| Pool trimmed | Infuse and Empower out (off-type mana grants); Battery Pack and Conduit stay. 19 → 17 moves. |
| **Coolant**: Heat Sink → **Heat Exchanger** | When an enemy takes Burn damage, Patch's partner heals for the same amount (Ashfeast's shape, aimed at the partner). |

**The sim pilot now prices marks** (`src/run/pilot.ts` `riderValue`): Conduct is worth its 15% burst when an active ally can pay for a Storm/Iron/Mech hit (×0.7, ×0.85 with two), Haunt one echo of our best Spirit/Mind hit on the holder's partner (×0.5); neither when the mark is already there. Both priced at 0 before, so the pilot never chose to plant one. This is also the Trials' and the Gauntlet's late AI, which now plants marks on purpose.

## Fire, second pass (2026-10-11, per user direction)

The audit restarted at Fire after every Evolution path became a move and a passive.

| Hero | Change |
|---|---|
| Cinder | **Kindling**: the hero AND its partner gain ATK ▲ INT ▲ on hitting a Burning foe (3 a fight); **Kindling+** the same, 5 a fight. **Ironclad**'s Cinderguard: taking damage sets a random enemy Burning (unless already). **Thunderblaze**: Fanned Flame → **Stormfire**, its Fire attacks set off Conduct as Storm attacks do. |
| Crimson | **Emberweave**'s Spellfire: an enemy taking Burn damage gives Arcane Force 10 (3 a fight). |
| Drake | **Wyvern**'s Wingwake: on entering, its next attack is +1 priority with Ambush 20. **Cinderscale**'s Magma Hide: taking damage gives Fire Force 10 (3 a fight). |
| Ashwing | **Ashen** grants Soul Rend (was Vengeance, whose low-HP window Funeral Pyre erased). **Sunbird**'s Dawnfire: while Sanctuary is up, its Fire attacks heal the partner a third of the damage. |

Engine: `PassiveTriggerCondition.requiresFieldEffect` (Dawnfire) and `PassiveDefinition.setsOffStatus` (Stormfire; read at the hit in resolveRound).

**Settled the same day:**

| Hero | Change |
|---|---|
| Cinder | **Kindling+**: it and its partner gain ATK ▲▲ INT ▲▲ (3 a fight). |
| Crimson | **Stoke+**: INT ▲▲ (3 a fight); the Mana is gone. |
| Brimstone | Sulphur stays as it is. |
| Drake | **Hoardwyrm**'s Hoard: the first potion drunk each fight gives Ambush 40 (once a fight since the Trials and the Gauntlet hand out two potions every fight) — the named exception to "a potion is not a trigger" (Drake warrants exceptions). |
| Tinder | Every path rewards the pivot: **Headliner** Curtain Call (switching out heals the partner 15% of max HP), **Sparkler** Spotlight (entering gives the partner Ambush 20, 3 a fight), **Limelight** Footlights (entering gives Light Force 15, 3 a fight). Top Billing and Crackle are gone. |

**A mastered innate may take two steps a firing** (per user direction): the one-step brake of
`docs/stat-stages.md` §6.3 stays for every other repeating card; `test/statStages` names the
exception. Engine: `ConsumableUsed` hook; an `ally` target on a hero that has just switched
out means the partner it stood beside, not the hero taking its slot.

## Water, second pass — grafts (2026-10-11, per user direction)

Mind three times, Frost, Storm and Spirit twice each across twelve grafts; spread so each type
appears once (Mech unused). Leviathan keeps Frost and Storm, Nautilus Mind and Shadow, Kappa Beast
and Spirit. Siren and Seasinger were one myth doing one thing; Siren is the one that left.

| Hero | Path (was) | Graft (was) | Granted move (was) |
|---|---|---|---|
| Riptide | Salamander (Frostbound) | Fire (Frost) | Molten Lash (Permafrost) |
| Riptide | Marshrunner (Siren) | Nature (Mind) | Rootbind (Psyshock) |
| Pincer | Reefshell (Squallshell) | Stone (Storm) | Dig In (Storm Lash) |
| Selkie | Seasinger | Light (Mind) | Consecrate (Mind Shatter) |
| Selkie | Roane | Arcane (Spirit) | Empower (Soul Offering) |

Passives are unchanged and owed in the details pass: Brittle (Salamander) has no Freeze to read,
Static Shell (Reefshell) no Storm hit to cash its Conduct, and Seasinger lost the Wisdom-swung
nuke that made it. Art moved with the ids; all five drawings were made for the old types.

## Water, second pass — details (2026-10-11, per user direction)

| Hero | Change |
|---|---|
| Riptide | **Drag+** fires off any attack (Drag stays Water). **Salamander**'s Scald: an enemy's Speed lowered → DEF ▼ (3 a fight). **Marshrunner**'s Mire: an enemy's Speed lowered → Poison 10. Both hear Drag. Swell unchanged. |
| Pincer | **Tideclaw** grants **Pinch** (new Mid Water physical, Pow 55, 40 mana, ATK ▲ to self) and **Shell Shards** (its Shield broken → both active enemies DEF ▼, 3 a fight); the Iron move and Static Tide are gone. **Ironshell** grants Juggernaut (was Shield Bash). **Reefshell**'s Coral Growth: gaining Shield → DEF ▲ (3 a fight). |
| Nautilus | **Inkmind** grants Wicked Fear (was Disorient); its passive is renamed **Murk** (it shared Ink Cloud's name). **Mimic**'s Mimicry: an enemy raising a stat → Nautilus raises the same one as many steps (3 a fight). |
| Kappa | Unchanged: Snapper's Bleed feeds Brimming through Blood Moon's lifesteal. |
| Selkie | **Salt Tears**: granting Renew → the receiver INT ▲ WIS ▲; **Salt Tears+** ▲▲ — unbraked — no longer a cleanse. **Seasinger** grants **Dawnsong** (new Late Light, Pow 115, 70 mana, swings with Wisdom — Mind Shatter's shape); Tidesong stays. |

Deleted: Brittle, Enthrall, Static Tide, Static Shell (Storm Drinker is the one Conduct planter on a
Water path; Static Tide's tests now pin it).

Engine: `PassiveHook` `'StatusRemoved'` (Shell Shards reads `reason: 'broken'`; a hit's broken Shield
joins the damage reaction pass); a statDelta `stat: 'trigger'` (Mimicry); and
`reactive.hearsPassives` — a card that opts in hears a StatChanged another passive made, which no
card did before (Scald and Mire hearing Drag, Mimicry hearing a Kindling). Every other card still
hears moves alone.

Salt Tears and Salt Tears+ are UNBRAKED by name (same day, per user direction): every Renew lifts its
receiver, a two-target one both (`test/statStages` names them). To watch: Mire is unbraked too — Poison adds 10 per Speed drop, and Drag and Rootbind
both feed it.

**Leviathan's first Mid offer is always Rainmaker** (same day, per user direction): `LevelSchedule.guaranteedOffers`, read in
`levelMovePool` so a roster hero, an enemy and the sim all get it; a guarantee already spent rolls as usual.

**Leviathan is the second Burden** (same day, per user direction). A forced first-turn Rest was proposed
and dropped as unfun; a pure-upside wake was dropped as no slumber at all. **Slumbering**: the first
time it enters each fight it takes INT ▼▼ SPD ▼▼, and wins INT ▲ SPD ▲ back at each of its next two
round ends on the field — groggy, never idle, and stages survive a switch, so it wakes once a fight.
**Slumbering+** (the one mastered card that sheds its Burden) arrives awake with INT ▲. Line 610:
Int 100 → 120, Mana 70 → 90, HP 190 → 210, Speed kept. Overchannel left the hero (it stays the
Staff's awakening); Overchannel+ is deleted. To watch: enemy Leviathans never master, so every one
arrives groggy.

**Selkie's Roane** (same day, per user direction): grants **Brine Hex** (new Mid Arcane, Pow 70, 45 mana,
swings with Wisdom) so she is not pure support, and **Drowned Gift** is now: granting Renew fully
restores the receiver's Mana (to its pool, never past it). To watch: a self-Refresh keeps Selkie full.

The audit's new moves (Pinch, Dawnsong, Brine Hex) sit LAST in `moves.ts`: `evolutionLine` reads each
slate in order, and placed early they displaced other heroes' line picks. Last, Pinch fills four
physical Water graft lines one move short (Rime Hydrofreeze, Scallywag Seawise, Murk Drowner, Mellow
Hot Spring); the other two join no line.

## Frost, second pass (2026-10-11, per user direction)

Grafts were already one type each (Nature unused); details only.

| Hero | Change |
|---|---|
| Flurry | **Blizzard**'s Bedrock Ice → **Thundersnow**: an enemy Frozen starts Conducting (Chain Lightning cashes it on both). **Snow Spirit**'s Cold Comfort → **Wraithfrost**: an enemy Frozen is Haunted. |
| Rime | **Hoarsteel**'s Frozen Stone (Floe's Pack Ice word for word) → **Cold Iron**: a hit on a Frozen foe → DEF ▲ (3 a fight). **Hydrofreeze**'s Black Ice: the first Water hit each fight Freezes, guaranteed (was 30% every hit). |
| All | **Every Slice move's Bleed is 50%** (was 30%): Aqua, Shock, Leaf, Holy, Shadow, Spooky, Serrated. |
| Floe | **Icebreaker**'s Cold Housing: its Defense rising → partner Shield 30 (was Shield 20 every round). |
| Igloo | **Hearthglow**'s Warm Hearth (id `warmHearth`, was `portcullis`): on entering, it is set Burning and gains ATK ▲▲ (was: Provoking Burns both enemies). Cold Front kept. |
| Tusk | **Ice Age**'s Winter's Weight: on entering, Frost Force 10 (was a 30% Freeze). **Erratic**'s Dead Weight → **Head of the Herd**: +10 MP Regen while faster than every other hero on the field. |
| Hush | **Tundra Hunter**'s Still Prey: Frozen enemies can't aim a move at it — a spread still hits (was +30% damage to Frozen). |

Engine: `PassiveDefinition.untargetableByStatus` (ward.ts `shunnedBy`, read at the picker for the
player, the AI and the pilot, and at resolution as a MoveGuarded); `conditionalStatGrants.requiresFastest`
(read through `StatContext.board.heroes`, which mana regen now passes). Frozen Stone is deleted; its
engine tests pin Pack Ice, the same verb.

To watch: Winter's Weight stacks Frost Force on every entry. Int 20 — a wacky one by request. Ice Age still grants Snowball, as Rime's Snowbound does.

## The round rule (2026-10-11, per user direction)

**A passive affects each hero at most once a round** — a game rule, explained once (the "Raised and
Lowered" tip's third page), never printed on a card. It replaced `docs/stat-stages.md` §6.3's brake:
"Once a round, up to N times a fight" came off 99 cards and `perFight` off 124 effects.

- Per HERO, not per card: a spread still marks each target, a two-target Renew lifts both, a
  self-buff lands once however many triggers fire. A random target draws among the heroes the card
  has not touched this round. Stacks all land on their firing.
- No fight cap: the five-step limit is the ceiling.
- **Surging Intellect** (+) is the one exception (`everyFiring`): every Mana gained.
- 19 mastered innates that differed from their base card only by the cap now move **two steps**:
  Drag+, Bitter Cold+, Vengeful Emblem+, Consecrate+, Lullaby+, Rivet+, Breach+, Pack Hunter+,
  Nettle+, Brimming+, Inscribe+, Curl+, Bad Luck+, Unfurl+, Outpace+, Undermine+, Death Wail+,
  Tally+, Unbothered+.
- Kept: "Up to N times a fight" where the cap IS the card (42, `maxFiresPerFight`), and "the first
  time each fight". Slumbering's wake took `maxFiresPerFight: 2` — its cap was what stopped it at awake.
- Weaker under it, accepted: once-per-hero conversions (lifesteal per hit, Burn-tick heals,
  Restorative Toxin, the Cleric's Succor, the Warlock's Siphon) now pay once a round.

Not measured yet: buffs can now climb past their old caps in long fights.

## Storm, second pass (2026-10-11, per user direction)

Grafts were already one type each (Shadow unused).

| Hero | Change |
|---|---|
| Squall | **Windshear** is two passives and no move (Skyfall and Squall Line gone): **Last Gust** — an Arrow with one Charge left goes at +1 priority; **Keen Fletching** — an Arrow with all its Charges leaves its target Bleeding. **Dust Devil**'s Thornshot → **Grit**: every Arrow takes DEF ▼ off its target. **Turbine**'s Autoloader → **Flywheel**: loosing an Arrow gives Mech Force 10. |
| Tempest | **Ionosphere**'s Stored Charge: at a round's start, a full pool gives Storm Force 10 (3 a fight). **Either Hand** (shared with Reverie's Embodied and Nightshade's Blackout): the first entry each fight, a hero holding both a physical and a magical attack gains ATK ▲ INT ▲ (was +30% on alternating — "too confusing"). |
| Skyshear | **Stormveil**: at each round's end, while an enemy is Conducting, Shield 20; **Stormveil+** Shield 40, one card (was a once-a-fight Barrier, two mastered cards). |
| Nimbus | **Anvil Cloud**: the first time it takes damage each fight, a random enemy Conducts (was 50% every hit); **Anvil Cloud+** both enemies. |
| Kite | **Outpace**: both allies gain ATK ▲ INT ▲ (Outpace+ ▲▲) while they outspeed both enemies (was INT on Kite alone). **Lantern Kite** grants **Lantern Light** (new Mid Spirit, Pow 60, 40 mana, swings with Wisdom, plants Haunt) and **Gilded String** heals Kite 15% on a move that deals no damage. |
| Raiju | **Heat Lightning**'s Brushfire: switching out Dazes every Burning enemy (was: Burns both). |

Engine: `PassiveDefinition.chargeRider` (Windshear; read in priority.ts and at the hit), trigger
conditions `ownerManaFull`, `anyEnemyHasStatus`, `requiresMixedKit` (`Combatant.mixedKit`, stamped at
fight build), and `onlyWithStatus` on a passive's applyStatus. Either Hand's alternation verb
(`alternatesCategory`, `Combatant.lastHitCategory`) is deleted with the card that used it. Squall's
Trials build swaps Skyfall for Storm Arrow.

To watch: Brushfire after Blazing Retreat (Burn, then leave) is a Daze the same round; Stormveil
stacks Shield every round a mark sits on the far side.

## Stone, second pass (2026-10-11, per user direction)

Iron three times, Shadow, Fire and Water twice across twelve grafts; spread so each type appears once
(Mech unused). The details were left to Claude's judgement ("go with your gut").

| Hero | Path (was) | Graft (was) | Move (was) | Passive |
|---|---|---|---|---|
| Crag | Snowcap (Mountainheart) | Frost (Iron) | Cold Snap (Juggernaut) | **Snowpack**: the first hit taken each fight Freezes both enemies |
| Crag | Rootwarden | Nature | Rootbind | **Deep Roots**: taking damage gives Renew (was Unstoppable Growth, Renew on entry — deleted) |
| Sentinel | Cathedral | Light (Iron) | Benediction (Juggernaut) | Flying Buttress, kept |
| Sentinel | Gloomwatch | Shadow | Cutthroat | **Night Vigil**: hit while Provoking → Ambush 20 (was: the partner hit, which Provoke prevents) |
| Petra | Quakebringer | — | Rockfall (Titanic Crush), off its own pool | Aftershock, kept — the magical spread lowers both Defenses |
| Scree | Pangolin (Riverstone) | Beast (Water) | **Scale Rake** — new Mid Beast, Pow 60, swings with Defense (Cleansing Rain) | **Scale Edges**: an enemy that hits it starts Bleeding |
| Dune | Worldworm | — | Rubble Rush (Body Crush), off its own pool | Desert Body, kept |
| Dune | Shimmer (Glassback) | Mind (Fire) | Psychokinesis (Firebrand) | **Mirage Step**: the first entry each fight, Barrier for the round and Poised |
| Dune | Sandstorm (Duneshade) | Storm (Shadow) | Storm Lash (Rend) | **Static Sand**: its Stone attacks set off Conduct |
| Cairn | Menhir | — | Body Blow | **Standing Stone**: entering sets Bedrock (was Settling Stone, DEF ▲ a round) |

Innate: **Stone Wall** (Sentinel) Shields the partner when Sentinel becomes Provoking (was: on entry,
about once a fight); Stone Wall+ Shield 60. **Shield Bash's Daze is certain, 2 Charges** (was 30%) —
every holder (Warden, Valor, Bellows, Carillon, Trove, Scree, Cinder's Ironclad pool).

Engine: trigger condition `targetsOwner` (Scale Edges). Deleted: Immovable, Sinking Sands, Molten
Glass, Settling Stone, Riverworn, Unstoppable Growth (its general Renew test now pins Deep Roots). No
path art existed for the renamed paths. Dune's Trials build carries Rubble Rush.

To watch: Juggernaut is now granted by Pincer's Ironshell alone. Snowpack + Cold Snap is a
first-blow combo; Standing Stone hands the partner Bedrock every entry.

**Crag's innate** (2026-10-12, per user direction — Vengeful Emblem is a Greataxe's awakening already):
**Unshakeable**: this hero's stats can't be lowered, by anyone. **Unshakeable+** also refuses every
negative status another hand lays on it (its own Provoke and costs still land). Engine:
`PassiveDefinition.refusesStatDrops` / `refusesAfflictions`, stamped on the combatant at fight build;
a refused drop is a `StatRefused` beat ("Unshakeable: Crag's Defense can't be lowered!"), a refused
status the existing `StatusRefused`. Vengeful Emblem+ (`bedrockWrath`) is deleted; Vengeful Emblem
stays the Greataxe's.

**Stone follow-ups** (2026-10-12, per user direction): **Slag Heap** (Petra's Magma) — a Stone hit on a
Burning foe gives Stone Force 10 and Fire Force 10, 3 a fight (was: re-light the Burn). **Mirage Step**
drops the +1 priority — the entry Barrier is the card. **Static Sand** and Fire's **Stormfire** read
"also set off Conduct". **Menhir** grants **Tectonic Slam** (×2 under Bedrock; Cairn's physical swings
with its Defense 90 under it) instead of Body Blow, off its own pool. **Barrow-Call → Grave Watch**:
an enemy that hits Cairn's partner is Haunted. Engine: `targetsPartner` condition. Cairn's Trials
build carries Tectonic Slam.

## Nature, second pass (2026-10-12, per user direction)

Beast and Stone twice, Spirit three times across twelve grafts; spread so each type appears once
(Storm unused).

| Hero | Path (was) | Graft (was) | Move (was) | Passive |
|---|---|---|---|---|
| Mordrax | Wildfire (Wildheart) | Fire (Beast) | Firebrand (Maul) | **Brushburn**: a hit on a Poisoned foe sets it Burning — Impale primes it (was Feral Rend) |
| Mordrax | Ironbark | Iron (Stone) | Parry (Bastion) — Shield and ATK ▲, so Ironsap pays ▲▲ | Ironsap, kept |
| Hollowbark | Rimewood (Wraithwood), rewire kept | Frost (Spirit) | Quick Freeze (Poltergeist) | **Numbing Rime**: an enemy that hits it loses SPD ▼ (was Whispering Boughs) |
| Tixwick | Thresher (Reaper) | Mech (Iron) | Whirling Blades (Serrated Slice) | **Grindstone**: Edge 5 at each round end, 4 a fight (`docs/edge-and-aim.md`; was Reaping, deleted) |
| Morel | Fairy Ring (Corpselight) | Arcane (Spirit) | Overload (Unquiet) | **Fairy Tithe**: Poisoning an enemy gives 10 Mana, past the pool — about 10 a round off Sporefall (was Graveglow) |

**Tixwick is about slicing.** A **Slice** is a move tag (`MoveTag 'slice'`), not a type: every move
named Slice or Blade(s), plus Cutthroat, Thousand Cuts, Hamstring, Runeslash, Hoarfrost Edge,
Guillotine and Draw Cut — a test pins the names. The player reads it on the move ("Slice" in the
summary, a row in the move detail). Innate **Twin Scythes**: every Slice it lands Bleeds (Slices
are 50% bare). **Twin Scythes+**: that, and its Slices strike an extra time. Kit **Reed Slice**
(new Early Nature, Pow 40, 20 mana, 50% Bleed) replaces Ivy Spike, which joins its pool.
**Orchid**'s Lure: taking damage gives Ambush 20 (Poised already lifted the strike after Provoke).
**Ghost Mantis**'s Dead Leaf: a Slice it lands Haunts its target (was: a KO Haunts both). Poised as
a card is deleted (the status stays, Mirage Step's); Poised+ with it.

**Lotus**: Unfurl reads Renew's TICK (`StatusTicked`), not its landing — one Regrowth is INT ▲ at
each of three round ends; Unfurl+ ▲▲ a tick. The sim and play have her among the weakest; the
next lever, if needed, is Petalfall's level (22).

**Hollowbark**: Barbs Poison 3 → 5, Barbs+ 8 → 10. Barbs is also the Leathers' awakening, which
rises with it (the awakening is priced flat, so the item budget is unmoved).

Engine: `MoveTag 'slice'`; `PassiveDefinition.extraHits` (`hitCountFor` in state.ts, read by the
resolver, the forecast and the pilot); the spawn slate skips only Arrows and the guard, a Slice
being an ordinary hit. Trials: Morel carries Overload, Tixwick Whirling Blades and Leaf Slice.

To watch: Twin Scythes+ on Thousand Cuts is four hits, each carrying Ambush; the move tile's hit
chip still reads the move's own count, not the holder's. Fairy Tithe + Sporefall is steady overflow.

**Edge and Aim** (same day, per user direction, `docs/edge-and-aim.md`): a Force for a move
family — Edge on every Slice, Aim on every Arrow, any type. **Hone** (Early Iron, Edge 20, 3
Charges) in the pools of the seven heroes holding four or more Slices; **Take Aim** (Early Storm,
Aim 20) in Squall's; Thresher's **Grindstone**; Restock adds Aim 10; the **Whetstone** and
**Fletching** Boons, gated on the roster holding the family.

## Light, second pass (2026-10-12, per user direction)

Fire and Nature twice, Spirit three times across twelve grafts; spread so each type appears once
(Shadow unused).

| Hero | Change |
|---|---|
| Solace | **Dewfall** (Sunflare): Water (Fire), Cleansing Rain (Scorch), **Morning Dew** — healing an ally gives it 20 Mana, up to its pool (Light's Mana battery; Arcane owns overflow). Sunscald deleted. |
| Aegis | **Cornerstone** (Verdant Oath): Stone (Nature), Bastion (Wild Bloom), **Keystone** — a broken Shield gives ATK ▲▲, the one path card at two steps (named in test/statStages). Shared Root deleted. Innate **Consecrate → Anointed** (it shared a name with the move). |
| Empyrean | **Seraph**: Arcane (Spirit), Overload (Soul Rend); Radiant Vessel kept. |
| Hart | **Dream Stag** (Spirit Stag): Mind (Spirit), Mental Fortress (Soul Offering); **Deathwatch** takes from a random enemy exactly what Renew mended (was 4% of max HP). |
| Aurum | **High Noon** ATK ▲ (was SPD); **Kindled Mane** re-lights a Burn on every Light hit (the "unless it already is" gate is gone); **Lion's Share** heals and raises both allies. |
| Carillon | **The Bell Tolls**: every third round, Sanctuary and this hero's Mana full; **The Bell Tolls+** both allies' Mana — one card each (was two cards under one name, mastered every second round). |

Engine: passive target `bothAllies`; a passive `damage` may read the trigger's `amount`; a
`manaGrant` may be `capped`. Open: Hart's new name, Aurum's innate (Gilded Mane does nothing in the
Trials or the Gauntlet). Left as they were, not raised again: Sunblind, Dawnlight, Dawnherald's High
Tide beside a Water graft.

**Light follow-ups** (same day, per user direction): **Hart is renamed Argent** (id `hart` kept; the
White Hart path keeps its name). **Gilded Mane**: while Aurum is at full HP it takes 30% less
damage, Gilded Mane+ 60% (`PassiveDefinition.damageTakenModifier`, a defender-side term collected
with the attacker's damage modifiers, per hit) — the gold read did nothing in the Trials or the
Gauntlet; `goldStatGrants` is now held by nothing. **Dawnlight** gives **Grace** (the heal Force,
`docs/edge-and-aim.md` §6) instead of Light Force.

## Shadow, second pass (2026-10-12, per user direction)

Nature five times and Spirit twice across twelve grafts; spread so each type appears once (Light
unused). Nightshade's Hemlock keeps Nature, Jinx's Nekomata Spirit.

| Hero | Change |
|---|---|
| Widow | **Rimeweb** (Silkbinder): Frost (Nature), Icicle Thrust (Rootbind), Snare kept. **Venomfang** grants **Thousand Cuts** (Grim Harvest — magical, on Int 20), taken out of its level-up pool. |
| Marrow | **Ossuary**: Stone (Nature), Rockfall (Blight); Charnel kept. |
| Murk | **Bog Iron** (Mossback): Iron (Nature), Rend Armor (Regrowth), **Rustcoat** — a hit gives Shield 10 (was Moss Mantle). |
| Rook | **Hedge Witch**: Arcane (Nature), Brine Hex (Blight), **Hexcraft** — lowering an enemy's stat gives Shadow Force 10, uncapped as the user wrote it (was Bitter Brew; "Witch's Brew" was Brimstone's already). **Augur** (Nightcrow): Mind (Spirit), Psyshock (Poltergeist); Crowsign kept — Mind attacks carry Haunt too. |

Engine: `StatChanged.sourceCombatantId` (the caster or the passive's owner), read by a source-role
condition.

**Lucky Cat** (same day, per user direction, after a random-Force draft was dropped for chip clutter):
**Beckoning Paw** — a hit has a 20% chance to give both allies ▲ to every stat, Ancient Power's
shape (was 30% for the partner's ATK and INT).

To watch: Hexcraft has no fight cap — Weaken every round is +10 Shadow Force a round.

## Arcane, second pass (2026-10-12, per user direction)

Analysed for balance ranges first (the user's brief). Findings and what was done:

| Finding | Was | Now |
|---|---|---|
| **Surging Intellect** (Zenith) paid Intelligence equal to EVERY Mana gained — regen, Rest, grant — bounded only by the ×4 flat ceiling: Mana Font alone made +40 Int a round, a partner's Font of Power +150 at once; Zenith hit 1× in round 1 and 4× by mid-fight, stages on top. | flat, every firing | **a Mana grant from a move or a passive gives INT ▲** (Surging Intellect+ ▲▲); regen and Rest pay nothing; the round rule applies. `everyFiring` is deleted with it. |
| **Crescendo** (Folio's Magnum Opus) gave INT ▲ a hit while the innate Inscribe took WIS ▼ a hit: Int ÷ Wis at ×12.25 after five rounds on one target. | INT ▲ a hit | **every fifth round on the field, its Arcane moves gain 100 Base Power for the next round** (the `Crescendo` status: a one-round Arcane Force) |
| **Foreordained** (Zenith's Oracle) set Stasis Field on any no-damage move, overwriting Mana Font's own Surging Magic. | no-damage move | **on entering the field** |
| **Stormrune** (Thane's Stormbrand, the type's top path in the sim; Thane 184.5 DPR, 5th of 47) marked every Arcane hit. | every hit | **the first Arcane hit on each foe** (`oncePerTarget`) |
| **Arcane Overflow** cost 70 against Thane's 55 pool (Spellsword −0.76, the weakest Arcane path measured). | 70 | **55** |
| Singularity (150 Mana on a 95 pool) | — | kept: the setup is the point (user). |

Grafts: Mind three times, Light, Shadow and Iron twice; spread so each type appears once (Stone
unused). **Zenith Corona** (Halo): Fire (Light), Scorch (Consecrate), **Sunspot** — laying a Burn
gives 10 Mana, which Surging Intellect turns into INT ▲ (was Lingering Light, deleted: no heal on the
path left it dead). **Pixie Glamour**: Nature (Mind), Magic Growth (Disorient), Mirage kept. **Folio
Scrying Pool** (Prophecy): Water (Mind), Torrent (Psyshock), Written Fate kept. **Thane Rimesworn**
(Ironsworn): Frost (Iron), Icicle Thrust (Reinforce), **Frost Oath** (was Iron Oath). **Trove Mimic**
(Vaultshade): Beast (Shadow), Gore (Shadow Form), Vault Curse kept.

Engine: `ManaGranted` hook (a grant alone); `everyNRoundsOnField` (the owner's own tenure, off
`Combatant.firstActionRound`); `oncePerTarget` (PassiveInstance.firedOnIds). The sim drafts only the
base deck, so Zenith, Folio and Trove have no measurement; their findings are the arithmetic above.

To watch: Zenith's starting kit (Mana Font, Magic Bolt) grants no Mana, so Surging Intellect needs a
partner's grant or a path (Apogee, Sunspot) to fire.

**Arcane follow-ups** (same day, per user direction): **Surging Intellect also pays on a Rest** (a
grant or a Rest, never regen; Surging Intellect+ ▲▲ the same). **Mana Font gives both allies 10
Mana** beside its +10 MP Regen and Surging Magic, so Zenith's innate fires off its starting kit — a
buff to every Mana Font holder.

## Mind, second pass (2026-10-12, per user direction)

Measured first (sim, 2000 runs, the base deck only): Lucius 137.9 DPR, Drift 125.0, Trance 118.8
against a median of 125 — no outlier on the scale of Zenith or Folio. Reverie, Motley and Koan are
outside the base deck and unmeasured.

- **Void Gnaw** (Lucius's Voidcaller) 5% → **8%** of max HP a hit. Voidcaller measured −0.46 against
  Sanguine's +0.68, the widest path gap in the type: Gorge heals half on a knockout, while Void Gnaw
  came to about 30% of one foe's HP over a six-round fight (now about 48%).
- **Foresight+** (Koan) is one card — Poised and Ambush 30 on the same firing (`alsoEffect`); it was
  two cards under one name.
- Kept: Neuroplastic+ (bounded by the round rule and ▲5), Lullaby, Motley, Drift's Deepbloom (−0.30,
  near the noise floor).

Grafts: Shadow, Arcane and Light three times each; spread so each appears once (Storm unused).

| Hero | Path (was) | Graft (was) | Move (was) | Passive |
|---|---|---|---|---|
| Reverie | Dustwing (Blindspot) | Nature (Shadow) | Corrode (Umbral Beam) | In the Gap, kept |
| Lucius | Rosetta (Cipher) | Stone (Arcane) | Rockfall (Arc Pulse) | Sealed Script, kept |
| Trance | Somnambulist | Spirit (Arcane) | Unquiet (Arcane Blast) | Sleepwalk, kept |
| Trance | Ringmaster | Fire (Light) | Heat Haze (Blinding Flash) | Center Ring, kept |
| Drift | Ice Jelly (Moon Jelly) | Frost (Light) | Permafrost (Consecrate) | Moonglow, kept |
| Motley | Iron Mask (Tragedian) | Iron (Shadow) | Rend Armor (Rend) | Hubris, kept |

To watch: Ringmaster's Center Ring (a Dazed enemy gives the partner Ambush 30) lost its Daze source
with Blinding Flash; Trance's Sandman (50% Daze) and a partner's Dazes now feed it. The Mind Trial's
Drift carries Permafrost.

## Spirit, second pass (2026-10-12, per user direction)

Measured (sim, base deck): Sorrow 162.6 DPR / ratio 2.85, Revenant 115.9 / 2.03, Dread 62.1 / 1.39
with the lowest die% measured (6.2%); Kitsu, Totem and Keen unmeasured. The enemy AI never
switches, so Haunt (cleared only by a switch) never leaves an AI foe — every per-Haunt payout pays
every round.

| Finding | Was | Now |
|---|---|---|
| **Nightmare** (Dread): with Omen, mastered, 40% of the enemy team's HP a round with no hits (the finale's Withering Gaze is 5%) | 10% / 20% | **6% / 12%** |
| **Death Wail** (Keen): a free team-wide ▼ — both enemies at ▼5 by round 5 | both active enemies | **its target** (a Haunt carries it to the partner) |
| **Foxfire** (Kitsu): the "unless it already is" text; the gate itself holds a foe at ~9% a round instead of 15% | — | reworded, gate kept: *on a foe that isn't Burning*; Foxfire+ and Spreading Flame likewise |
| **Shriek** (Sorrow's Banshee, +0.49): a 30% Daze | chance | **the first attack on each foe Dazes it** (`oncePerTarget`) |
| **Mantling** (Dread's Ironfeather, −0.49): fired only off Reinforce | Defense rises → Shield 30, 3 a fight | **taking damage → partner Shield 15** |
| **Lament+** (Sorrow) | two cards | one card (`alsoEffect`) |

Grafts: Mind three times, Nature, Frost and Shadow twice; spread so each appears once (Mech unused).
**Revenant Soulbinder**: Arcane (Mind), Arcane Blast (Wicked Fear). **Revenant Drowned** (Undying):
Water (Nature), Oasis (Wild Bloom). **Sorrow Gravestone** (Mourner): Stone (Frost), Fault Line (Icicle
Thrust). **Sorrow Requiem** (Dirge): Light (Mind), rewire kept, Radiant Beam (Psionic Wave). **Keen
Stormwail** (Shroud): Storm (Shadow), Thunderbolt (Eclipse). Every passive kept.

## Iron, second pass (2026-10-12, per user direction)

Measured (sim, base deck): Gallant 184.6 DPR / ratio 3.42 (4th of 47 by DPR), Valor 138.0 / 3.04,
Warden 127.5 / 2.52; Scallywag, Ronin and Ferra unmeasured. Gallant's Breach (DEF ▼ a hit, ×3.5 on a
focused foe by round 5) is one axis, kept as identity; the weak paths were fixed instead.

**Ronin is the Iron slicer** (per user direction, Tixwick's sibling). **Kata** replaces Heavy Blow in
his kit (Heavy Blow joins his pool): a `permanent`, never-replaced move that each round becomes one of
the eight elemental Slices — Reed, Aqua, Shock, Leaf, Holy, Shadow, Spooky, Serrated — from every
tier, and never locks (Quiver locks). Engine: `MetamorphicRule.faceIds` and `anyTier`. **Iaido** puts
him **Drawn Blade**: his next *Slice* goes at +1 priority (`StatusDefinition.priorityBonusTag`; only a
Slice spends it); Iaido+ adds Ambush 30 on the same card. **Hone** joins his pool. **Shinobi** grants
Shadow Slice (Rend); **Unseen Cut** Bleeds the first foe each attack lands on, once each
(`oncePerTarget`, was 30%). **Winter Edge** (Raijin): Frost (Storm), Hoarfrost Edge (Shock Slice),
Rolling Thunder renamed **Cold Steel**.

| Hero | Change |
|---|---|
| Gallant | **Gallop** (Destrier, −0.52): the struck foe's partner loses DEF ▼ (was SPD ▲ to itself), a new target `triggerTargetPartner`. **Dullahan** (Oathbound): Spirit (Light), Spooky Slice (Consecrate), **Dread Charge** — entering Haunts both enemies (Vow of Arms, which needed heals, deleted). |
| Warden | **Rootbreaker** (Sunderer, −0.55): Nature (Mech), Verdant Lash (Cog Slam); **Shieldbreaker** — its hits go straight through Shield (`piercesShield`), +30% to a Shielded foe (was +50% only to a Shielded foe). **Rampart** (Lodestar): Stone (Light), Rampart (Benediction), Oathlight kept. |
| Valor | **Forgeheart** (Galvanize): Fire (Storm), Molten Lash (Storm Lash), **Rallying Flame** — setting a foe Burning gives the partner Ambush 25 (was Rallying Spark, on Conduct). |
| Scallywag | **Safe Harbour**: heals 25% on switching out (was 10% a round from the bench — no bench passives). Broadside and Broadside+ are one card each (`alsoReactive`). |
| Ferra | **Polarity** (Electromagnet): Arcane (Storm), Overload (Chain Lightning), Induction kept. **Lodestone+** one card, DEF ▼ (its text still read "lose 15 Defense"). |

Grafts spread so each type appears once (Mind unused); Scallywag's Stormrunner keeps Storm as the
graft the roster names as her way back. The Iron Trial's Ronin is Kensei with Kata.

## Mech, second pass (2026-10-12, per user direction)

Measured (sim, base deck): **Rex 224.8 DPR, 1st of 47, 1.15 KO a fight (the most)**; Clockwork 98.1;
Patch 48.0 (the sim undercounts supports — not acted on). Bellows, Abacus, Whirr unmeasured.

| Finding | Was | Now |
|---|---|---|
| **Tyrant's Due** (Rex): +10 Attack for the run on a once-a-fight knockout, uncapped — ~+130 over a run, more than his base 100; mastered on every knockout | uncapped | **up to +50 a run** (Tyrant's Due+ **+100**): `statDelta.permanentCap`, read against `Combatant.permanentStatPrior`, seeded from `RosterEntry.permanentPassiveGains` |
| **Recitation** (Abacus's Arithmancer): WIS ▼ on both foes a magical hit beside Tally's INT ▲ a round — Folio's double ratio, ×12 by round 5, on both | both enemies WIS ▼ | **an Arcane hit gives 15 Mana**, past the pool |
| **Fossil** (Rex, −0.58, the weakest Mech path): Retribution's 50% of damage taken on Defense 55 | Retribution | **Boulder Slam** (Stone Late, 100 / 70) |
| **Boiler** (Clockwork) — the user disliked it | 30% Burn on a Mech hit | **Wind-Up**: every second round on the field, ATK ▲ DEF ▲ (Wind-Up+ ▲▲); a switch restarts the count |
| **Ironbound+** (Bellows) | two cards | one card |

Grafts: Water, Fire and Stone twice; spread so each appears once (Iron unused — Bellows carries it).
**Clockwork Cryogenics** (Hydraulics): Frost (Water), Ice Shell (Oasis), **Rime Plating** — gaining Shield
gives the partner Shield 15 (Steam Curtain read Boiler's Burns; deleted). **Bellows Ghost Ship**
(Bulkhead): Spirit (Stone), Soul Offering (Bodyguard), Blast Door kept. **Bellows Smokestack**
(Overpressure): Shadow (Fire), rewire kept, Umbral Wave (Firestorm), Blowoff Valve kept.
