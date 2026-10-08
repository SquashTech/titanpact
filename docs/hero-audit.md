# Hero audit — innates and Evolutions, type by type

Started 2026-10-07, per user direction: the macro design is settled, so the pass is micro — every
hero's innate, mastered innate and three Evolution paths, one type at a time. **Fun first,
balance second.** The working sheet is `docs/balance/heroes.md` (`scripts/exportBalance.ts`, which
now prints the innate, the mastered innate, the signature level and each granted move in full).

## Rules the audit changed

- **A dual hero's paths each pay a move AND a passive.** A retype on a dual hero swaps a type
  rather than gaining one, so a bare graft + one grant left it with nothing new. Applied hero by
  hero as the audit reaches each type; `DUALS_MOVE_AND_PASSIVE` in
  `test/evolutionSimplification.test.ts` lists the converted ones.
- **A path may pay more than a pair, by name.** `BEYOND_THE_PAIR` in the same test pins each one
  with its exact shape.

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
