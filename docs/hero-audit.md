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
