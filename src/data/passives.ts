// Passive catalog, grouped by where a passive comes from. `passives` is the single lookup every
// screen and resolveRound import, so the Class passives (classes.ts) are merged in here too.

import type { PassiveDefinition } from '../engine/content';
import { classPassives } from './classes';
import { TYPES, type TitanpactType } from './typechart';
import { fieldEffects } from './fieldEffects';

// --- Evolution-granted, outside the per-hero tables ---
const fixturePassives: Record<string, PassiveDefinition> = {
  sanguine: {
    id: 'sanguine',
    name: 'Sanguine',
    description: 'Whenever an enemy takes Bleed damage, this hero heals for the same amount.',
    reactive: {
      hook: 'StatusTicked',
      condition: { relativeTo: 'enemy', eventFieldEquals: { statusId: 'Bleed', kind: 'damage' } },
      effect: { kind: 'heal', target: 'self', amount: { kind: 'matchTriggerAmount' } },
    },
  },
};

// --- Equipment-granted (equipment.ts grantsPassiveIds) ---
const equipmentPassives: Record<string, PassiveDefinition> = {
  bloodthirst: {
    id: 'bloodthirst',
    name: 'Bloodthirst',
    description: "Whenever this hero's side deals damage to an enemy, heal this hero for 15% of that damage.",
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'enemy' },
      effect: { kind: 'heal', target: 'self', amount: { kind: 'matchTriggerAmount', multiplier: 0.15 } },
    },
  },
  wardensVigil: {
    id: 'wardensVigil',
    name: "Warden's Vigil",
    description: 'Whenever this hero takes damage, heal for 10% of that damage.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'heal', target: 'self', amount: { kind: 'matchTriggerAmount', multiplier: 0.1 } },
    },
  },
  vengefulEmblem: {
    id: 'vengefulEmblem',
    name: 'Vengeful Emblem',
    description: 'Whenever this hero takes damage, gain +5 Attack.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'self', stat: 'attack', amount: 5 },
    },
  },

  // --- 2026-09-06: six more, for the Epic+ effect floor (docs/progression.md "The effect
  // floor"). All six are ordinary data over the existing hooks — no engine change — and
  // passiveIcons.tsx derives their glyphs, so none needs a table entry to look like itself.

  sunder: {
    id: 'sunder',
    name: 'Sunder',
    // subjectRole 'source' + relativeTo 'self' = "this hero dealt it"; 'triggerTarget' is then
    // the defender, which is the only way a source-role passive reaches who it just hit.
    description: 'Whenever this hero lands an attack, its target loses 10 Defense.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'statDelta', target: 'triggerTarget', stat: 'defense', amount: -10 },
    },
  },
  secondSkin: {
    id: 'secondSkin',
    name: 'Second Skin',
    // Vengeful Emblem's shape turned inward — that one pays an attacker for being hit, this
    // one pays a wall for holding. One statDelta per stat, sharing the amount.
    description: 'Whenever this hero takes damage, it gains 5 Defense and 5 Wisdom.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'self', stat: ['defense', 'wisdom'], amount: 5 },
    },
  },
  arcaneReservoir: {
    id: 'arcaneReservoir',
    name: 'Arcane Reservoir',
    // manaGrant is UNCAPPED (docs/mana.md "Overflow"), so this is the bench-cycling engine
    // paying out in the one currency that can exceed its pool. Every arrival, the opening
    // lead included — a pivot out and back re-seeds it.
    description: 'When this hero enters the battlefield, it gains 30 Mana, past its pool.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'manaGrant', target: 'self', amount: { kind: 'flat', value: 30 } },
    },
  },
  rallyingStandard: {
    id: 'rallyingStandard',
    name: 'Rallying Standard',
    // 'ally' is the ACTIVE partner and never the owner, so this grants nothing while the
    // hero stands alone — the one entry passive that wants a full field.
    description: "When this hero enters the battlefield, its partner gains 10 Attack and 10 Intelligence.",
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'ally', stat: ['attack', 'intelligence'], amount: 10 },
    },
  },
  purifyingWard: {
    id: 'purifyingWard',
    name: 'Purifying Ward',
    // `cleanse` with no count strips every non-positive status, same rules as a move's.
    // Pivoting out of a Burn and back in to shed it is the intended play.
    description: 'When this hero enters the battlefield, it sheds every negative status.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'cleanse', target: 'self' },
    },
  },
  quickening: {
    id: 'quickening',
    name: 'Quickening',
    description: 'When this hero enters the battlefield, it gains 10 Speed.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'self', stat: 'speed', amount: 10 },
    },
  },

  // --- 2026-09-07: the six family Awakenings the item rework needed (docs/equipment.md §2).
  // All flat — the tier buys stats, the family buys the effect — so none of them needs the
  // per-item passive magnitude an earlier draft proposed, and grantsPassiveIds stays a plain
  // string array. Poison rather than Bleed in both DoT entries because Bleed is `shape:
  // 'boolean'` and carries no magnitude to author.

  impale: {
    id: 'impale',
    name: 'Impale',
    // The Spear's Awakening. Sunder's trigger with a DoT payload instead of a debuff, so the two
    // Attack families that both fire on landing a hit still read differently.
    description: "Whenever this hero lands an attack, its target suffers Poison 5.",
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Poison', magnitude: 5, duration: 3 },
    },
  },
  marksman: {
    id: 'marksman',
    name: 'Marksman',
    // The Bow's. Unconditional because PassiveDamageModifier is evaluated against { moveType }
    // alone — there is no damage-CATEGORY condition, so "bonus with physical moves" is unsayable.
    // 10% is half the typed passives' 20%, which is what buys the loss of the type restriction.
    description: 'Deals 10% bonus damage.',
    damageModifier: { amount: 0.1 },
  },
  overchannel: {
    id: 'overchannel',
    name: 'Overchannel',
    // The Staff's. manaGrant is UNCAPPED (docs/mana.md "Overflow"), so a hero that keeps swinging
    // banks past its pool — the Int family's answer to mana being the primary balance lever.
    description: 'Whenever this hero lands an attack, it gains 10 Mana, past its pool.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'manaGrant', target: 'self', amount: { kind: 'flat', value: 10 } },
    },
  },
  barbs: {
    id: 'barbs',
    name: 'Barbs',
    // The Leathers'. A true counter-attack is not expressible — there is no `damage` effect, and a
    // target-role DamageDealt cannot reach its attacker (triggerTarget is the DEFENDER whatever the
    // condition read) — so this hits activeEnemies instead. Lower than Impale's 5: it lands on both.
    description: 'Whenever this hero takes damage, enemies suffer Poison 3.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Poison', magnitude: 3, duration: 3 },
    },
  },
  manaWard: {
    id: 'manaWard',
    name: 'Mana Ward',
    // The Robe's. Warden's Vigil's shape paid in mana instead of HP, which is why the Robe and the
    // Plate can share a trigger without sharing an identity.
    description: 'Whenever this hero takes damage, it gains Mana equal to 15% of it, past its pool.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'manaGrant', target: 'self', amount: { kind: 'matchTriggerAmount', multiplier: 0.15 } },
    },
  },
  attunement: {
    id: 'attunement',
    name: 'Attunement',
    // The Ring's. Arcane Reservoir pointed at the partner instead of the owner — 'ally' is the
    // ACTIVE partner and never the owner, so this grants nothing while the hero stands alone.
    description: 'When this hero enters the battlefield, its partner gains 20 Mana, past its pool.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'manaGrant', target: 'ally', amount: { kind: 'flat', value: 20 } },
    },
  },
};

// --- Event-granted (events.ts grantPassive) ---
const eventPassives: Record<string, PassiveDefinition> = {
  imposingPresence: {
    id: 'imposingPresence',
    name: 'Imposing Presence',
    description: 'When this hero enters the battlefield, enemies lose 10 Attack.',
    // SwitchedIn's subject is the INCOMING combatant, so relativeTo 'self' = this hero arriving.
    // Fires on every arrival, the opening lead included — unbounded within a fight by design.
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'activeEnemies', stat: 'attack', amount: -10 },
    },
  },
};

// --- Boon-granted, type-locked (the `passiveReward` node, src/run/boons.ts) ---
//
// One per type, +20% damage with that type's moves — the shape four of the deleted passive relics
// carried, restored 2026-09-07 now that a passive lands on ONE hero the player chooses rather
// than on all four at once. Generated from a name table rather than authored one by one: the
// effect is identical across the fourteen and only the type differs, so a hand-written block
// would be fourteen chances to typo a moveType. `passiveIcons.tsx` derives the glyph from
// `damageModifier.eventFieldEquals.moveType`, so each wears its own element with no table entry.
//
// **Ancient deliberately has none**, the same call the Ancient Force relic made: no hero is
// Ancient-typed and no hero can reach an Ancient move, so it would be a grant nobody can use.
export const TYPE_DAMAGE_BONUS = 0.2;

const TYPE_PASSIVE_NAMES: Partial<Record<TitanpactType, { id: string; name: string }>> = {
  Fire: { id: 'emberheart', name: 'Emberheart' },
  Water: { id: 'deepcurrent', name: 'Deepcurrent' },
  Frost: { id: 'frostbrand', name: 'Frostbrand' },
  Storm: { id: 'stormcallersFocus', name: "Stormcaller's Focus" },
  Stone: { id: 'stonebreaker', name: 'Stonebreaker' },
  Nature: { id: 'greenwrath', name: 'Greenwrath' },
  Light: { id: 'radiantZeal', name: 'Radiant Zeal' },
  Shadow: { id: 'shadowfang', name: 'Shadowfang' },
  Arcane: { id: 'runebrand', name: 'Runebrand' },
  Mind: { id: 'psionicEdge', name: 'Psionic Edge' },
  Spirit: { id: 'soulbrand', name: 'Soulbrand' },
  Iron: { id: 'forgebrand', name: 'Forgebrand' },
  Mech: { id: 'overdrive', name: 'Overdrive' },
  Beast: { id: 'feralInstinct', name: 'Feral Instinct' },
};

const typeDamagePassives: Record<string, PassiveDefinition> = Object.fromEntries(
  Object.entries(TYPE_PASSIVE_NAMES).map(([type, { id, name }]) => [
    id,
    {
      id,
      name,
      description: `Deals ${Math.round(TYPE_DAMAGE_BONUS * 100)}% bonus damage with ${type}-type moves.`,
      damageModifier: { eventFieldEquals: { moveType: type }, amount: TYPE_DAMAGE_BONUS },
    } satisfies PassiveDefinition,
  ])
);

/** Type -> the one Boon that rewards it, for the roster filter in `src/run/boons.ts`. */
export const typeDamagePassiveFor: Partial<Record<TitanpactType, string>> = Object.fromEntries(
  Object.entries(TYPE_PASSIVE_NAMES).map(([type, { id }]) => [type, id])
);

/** Every type that has one, in TYPES order — the order any surface listing them uses. */
export const TYPE_DAMAGE_PASSIVE_TYPES: readonly TitanpactType[] = TYPES.filter((type) => !!typeDamagePassiveFor[type]);

// --- Boon-granted, the field Heralds (docs/field-effects.md "Heralds") ---
//
// One per Field Effect: when this hero enters the battlefield, set it. The Drizzle shape — a field
// that is the consequence of a pick and costs no turn — on the SwitchedIn hook Imposing Presence
// uses, every arrival, so a pivot out and back re-sets a field that has lapsed (re-setting the
// active one is a no-op and never refreshes the clock). Offered on the type Boons' gate — a roster
// hero fields the field's flavour type — but the HOLDER need not: a Stasis Herald belongs on the
// slowest hero on the team, whatever its type.
const FIELD_HERALD_NAMES: Record<string, { id: string; name: string }> = {
  surgingMagic: { id: 'heraldOfSurge', name: 'Herald of Surge' },
  scorchedLand: { id: 'heraldOfCinders', name: 'Herald of Cinders' },
  stasisBubble: { id: 'heraldOfStillness', name: 'Herald of Stillness' },
  sanctuary: { id: 'heraldOfDawn', name: 'Herald of Dawn' },
  verdantEarth: { id: 'heraldOfBloom', name: 'Herald of Bloom' },
};

const fieldHeraldPassives: Record<string, PassiveDefinition> = Object.fromEntries(
  Object.entries(FIELD_HERALD_NAMES).map(([fieldEffectId, { id, name }]) => [
    id,
    {
      id,
      name,
      description: `When this hero enters the battlefield, set ${fieldEffects[fieldEffectId].name}.`,
      reactive: {
        hook: 'SwitchedIn',
        condition: { relativeTo: 'self' },
        effect: { kind: 'setFieldEffect', fieldEffectId },
      },
    } satisfies PassiveDefinition,
  ])
);

/** Flavour type -> the Herald of the field it colours, for the roster filter in `src/run/boons.ts`. */
export const fieldHeraldPassiveFor: Partial<Record<TitanpactType, string>> = Object.fromEntries(
  Object.entries(FIELD_HERALD_NAMES).map(([fieldEffectId, { id }]) => [fieldEffects[fieldEffectId].flavorType, id])
);

// --- Evolution-granted (progression.ts grantsPassiveIds) ---
const evolutionPassives: Record<string, PassiveDefinition> = {
  firestarter: {
    id: 'firestarter',
    name: 'Firestarter',
    description: 'The first time this hero afflicts Burn during combat, set Scorched Land.',
    // subjectRole 'source' + relativeTo 'self' = "this hero applied the Burn" (plain 'self' would
    // read "I was burned"; 'enemy' would fire off the partner's Burns). oncePerFight keeps the
    // field a 5-round window rather than refreshing on every Burn.
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Burn' } },
      effect: { kind: 'setFieldEffect', fieldEffectId: 'scorchedLand' },
      oncePerFight: true,
    },
  },
  unstoppableGrowth: {
    id: 'unstoppableGrowth',
    name: 'Unstoppable Growth',
    description: 'When this hero enters the battlefield, it gains Renew 40.',
    // Same arrival shape as Imposing Presence, pointed inward: every arrival including the
    // opening lead, so a pivot out and back re-seeds it. Renew stacks additively, which is
    // the intended payoff. A passive-applied HoT is FLAT — the healing formula's Wisdom
    // scaling belongs to a move's own heal, and a passive has no move to take STAB from.
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Renew', magnitude: 40 },
    },
  },
  frozenStone: {
    id: 'frozenStone',
    name: 'Frozen Stone',
    description: 'Whenever this hero\'s Defense rises, Freeze a random enemy.',
    // eventFieldPositive is what makes this "rises" rather than "changes" — a Defense DEBUFF
    // must not freeze anyone. Fed only by a move's own stat deltas, so the hero's own Bastion
    // and a partner's Frost Wall both arm it, and a passive-caused change never chains.
    reactive: {
      hook: 'StatChanged',
      condition: { relativeTo: 'self', eventFieldEquals: { stat: 'defense' }, eventFieldPositive: 'delta' },
      effect: { kind: 'applyStatus', target: 'randomEnemy', statusId: 'Freeze' },
    },
  },
  enthrall: {
    id: 'enthrall',
    name: 'Enthrall',
    description: 'Every Water attack this hero lands leaves its target Haunted.',
    // Static Tide's exact shape, transposed off Conduct/Storm onto Haunt/Mind: the Water hit
    // plants the mark and the GRAFTED line is what cashes it. Haunt expands a singleEnemy Spirit
    // or Mind move onto the marked hero's partner, so Siren's Mind moves spread and its Water
    // ones never do — planting and cashing stay two different columns, which is the point.
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Water' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Haunt' },
    },
  },
  staticTide: {
    id: 'staticTide',
    name: 'Static Tide',
    description: 'Every Water attack this hero lands leaves its target Conducting.',
    // RESERVED, not dead (2026-09-02): Riptide's Storm graft became Water/Mind, so nothing grants
    // this today. Held for a future recruit-only Water hero that grafts Storm — with Shock Bubble,
    // the Water move that plants Conduct, which is parked in the orphan list for the same reason.
    // subjectRole 'source' + relativeTo 'self' = "I dealt this hit"; the Conduct then has to
    // land on 'triggerTarget', the defender, because the condition's subject is the attacker.
    // Maelstrom's own Storm moves are what cash the mark in (Conduct.triggerTypes).
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Water' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Conduct' },
    },
  },
  overspill: {
    id: 'overspill',
    name: 'Overspill',
    description: 'When this hero enters the battlefield, it gains 50 mana, past its pool.',
    // Mana overflow is a locked pillar (docs/mana.md) that only MOVES could reach until now.
    // It matters most here: Singularity costs 150 and Glyph's pool is 85, so its best move is
    // unreachable without overflow. Uncapped, survives switching, so the play is to pivot to the
    // bench, regen, come back 50 up — the bench-cycling engine pointed at one enormous cast.
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'manaGrant', target: 'self', amount: { kind: 'flat', value: 50 } },
    },
  },
  communion: {
    id: 'communion',
    name: 'Communion',
    description: 'Whenever this hero is healed, its partner is healed for the same amount.',
    // Target-role Healed: "I was healed". Revenant's Drain and Soul Rend are drainPercent riders,
    // which DO emit Healed, so every drain now sustains the pair. A passive heal runs applyHpDelta
    // and emits HpChanged rather than Healed, so this cannot bounce between the two of them.
    reactive: {
      hook: 'Healed',
      condition: { relativeTo: 'self' },
      effect: { kind: 'heal', target: 'ally', amount: { kind: 'matchTriggerAmount' } },
    },
  },
  tempering: {
    id: 'tempering',
    name: 'Tempering',
    description: 'Whenever this hero takes damage, it gains 10 Defense.',
    // Target-role DamageDealt: "I was hit". Steel worked by blows. Unbounded within a fight on
    // purpose — Valor is the hero that wins the long one, and the Pact Clock is what brackets it.
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'self', stat: 'defense', amount: 10 },
    },
  },
  combustion: {
    id: 'combustion',
    name: 'Combustion',
    description: 'Whenever this hero is Burned, it gains 20 Attack.',
    // Target-role StatusApplied: "I caught fire". Mech's whole Burn line burns its OWN caster —
    // Backfire, Overheat and Meltdown each apply Burn to the target AND to self — so the drawback
    // written into the type becomes the fuel, and an enemy burning Clockwork is a mistake.
    // Burn is stacking additive, so every re-application pays again.
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', eventFieldEquals: { statusId: 'Burn' } },
      effect: { kind: 'statDelta', target: 'self', stat: 'attack', amount: 20 },
    },
  },
  afterglow: {
    id: 'afterglow',
    name: 'Afterglow',
    description: 'Whenever this hero heals an ally, that ally gains 20 Attack and 20 Intelligence.',
    // Source-role on the Healed hook: "I did the healing", landing on triggerTarget, the ally
    // who received it. BOTH offensive stats on purpose — Solace does not get to choose her
    // partner, so the buff has to be worth the same to a Crag as to a Glyph. It also means a
    // heal is never a wasted turn: at full HP the healing is nothing and the buff is everything.
    reactive: {
      hook: 'Healed',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'statDelta', target: 'triggerTarget', stat: ['attack', 'intelligence'], amount: 20 },
    },
  },
  afterimage: {
    id: 'afterimage',
    name: 'Afterimage',
    description: 'When this hero enters the battlefield, it gains Ambush 20.',
    // Ambush clears on switch, so this cannot be banked by cycling — every arrival buys exactly
    // one loaded attack, the opening lead included. It is what makes a pivot an offensive move
    // rather than only a mana-recovery one, which is the whole reason the bench regenerates.
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Ambush', magnitude: 20 },
    },
  },
  eitherHand: {
    id: 'eitherHand',
    name: 'Either Hand',
    description: 'A blow of the other kind than the last one this hero landed strikes 30% harder.',
    // The mixed attacker's verb (Tempest's Forked, Cortex's Embodied). A 70/70 line picking the
    // weaker defence averages a stat ratio of 1.43 against a 100-point specialist's 1.77 — only
    // 30% of enemy lines have the Def/Wis gap that would pay for the second stat — so mixing is
    // dominated by construction until alternating itself pays: 1.43 x 1.3 lands level with the
    // specialist, and only for a kit that can actually swing both hands every other turn.
    // Never on a first hit, never on a repeat (passiveEngine alternatesCategory).
    damageModifier: { alternatesCategory: true, amount: 0.3 },
  },
  restorativeToxin: {
    id: 'restorativeToxin',
    name: 'Restorative Toxin',
    description: 'Whenever this hero applies Poison, it gains twice that amount as Renew.',
    // Firestarter's source-role shape, but the payout is READ off the event rather than authored:
    // matchTriggerAmount on StatusApplied's `magnitude`. Note the units differ either side of the
    // 2x — Poison magnitude is a PERCENT of the victim's max HP, Renew magnitude is FLAT HP on
    // Sylva. Poison also stacks, so every re-application pays again (docs/leveling-and-ranks.md).
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Poison' } },
      effect: {
        kind: 'applyStatus',
        target: 'self',
        statusId: 'Renew',
        magnitude: { kind: 'matchTriggerAmount', field: 'magnitude', multiplier: 2 },
      },
    },
  },
  naturesPurification: {
    id: 'naturesPurification',
    name: "Nature's Purification",
    description: 'When this hero enters the battlefield, its partner is Cleansed.',
    // Imposing Presence's arrival shape aimed sideways. Cleanse spares `positive` statuses, so it
    // never strips the partner's own Renew. Alone on the field it resolves to nobody and is silent.
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'cleanse', target: 'ally' },
    },
  },
  bloodthirsty: {
    id: 'bloodthirsty',
    name: 'Bloodthirsty',
    description: 'This hero has +20 Attack and +20 Speed while an enemy is Bleeding.',
    // A live conditional grant, not a reactive statDelta: it switches off when the Bleeder
    // switches out, faints, is cleansed or expires. Reads ACTIVE enemies only.
    conditionalStatGrants: {
      requiresEnemyStatus: 'Bleed',
      statGrants: { attack: 20, speed: 20 },
    },
  },
  // --- The recruit-only slate (2026-09-05) ---
  cinderguard: {
    id: 'cinderguard',
    name: 'Cinderguard',
    description: 'Whenever this hero takes damage, both active enemies gain Burn 10.',
    // Target-role DamageDealt: "I was hit". There is no 'triggerSource' target — a passive cannot
    // reach the attacker — so the answer goes to activeEnemies, which in doubles is the attacker
    // plus its partner. Small per firing, stacking additively, and Immolate is what cashes it.
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Burn', magnitude: 10 },
    },
  },
  ashfeast: {
    id: 'ashfeast',
    name: 'Ashfeast',
    description: 'Whenever an enemy takes Burn damage, this hero heals for the same amount.',
    // Sanguine's exact shape moved off Bleed onto Burn — and Burn is a magnitude status Brimstone
    // stacks itself, so unlike Sanguine this one does not need a partner to arm it.
    reactive: {
      hook: 'StatusTicked',
      condition: { relativeTo: 'enemy', eventFieldEquals: { statusId: 'Burn', kind: 'damage' } },
      effect: { kind: 'heal', target: 'self', amount: { kind: 'matchTriggerAmount' } },
    },
  },
  hexfume: {
    id: 'hexfume',
    name: 'Hexfume',
    description: 'When this hero enters the battlefield, both active enemies gain Poison 10.',
    // Imposing Presence's arrival shape carrying a status instead of a stat. Poison only counts
    // down while its holder is ACTIVE, so a foe that pivots out banks the timer rather than
    // clearing it — arriving repeatedly raises the percentage without ever resetting the clock.
    // The 3-round timer is authored per APPLICATION, the way every Poison move authors it; omit it
    // and the timer starts at 0 and the payload fires at the end of the round it landed in.
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Poison', magnitude: 10, duration: 3 },
    },
  },
  killingFrost: {
    id: 'killingFrost',
    name: 'Killing Frost',
    description: 'Whenever this hero Freezes an enemy, it gains 10 Intelligence.',
    // Feedback Loop's shape on Freeze. Freeze is stacking 'none', so re-freezing an already
    // frozen foe emits nothing and pays nothing; the ramp costs fresh targets, and Permafrost
    // and Avalanche reaching both foes at once is the two-for-one that makes it worth a path.
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Freeze' } },
      effect: { kind: 'statDelta', target: 'self', stat: 'intelligence', amount: 10 },
    },
  },
  coldForge: {
    id: 'coldForge',
    name: 'Cold Forge',
    description: "Whenever this hero's Defense rises, it gains 10 Attack.",
    // Frozen Stone's trigger with an inward payout: eventFieldPositive is what makes this "rises"
    // and not "changes". Cube's own Frost Armor and a partner's Bastion or Frost Wall all arm it,
    // which is the whole build — the wall it puts up is the weapon it swings.
    reactive: {
      hook: 'StatChanged',
      condition: { relativeTo: 'self', eventFieldEquals: { stat: 'defense' }, eventFieldPositive: 'delta' },
      effect: { kind: 'statDelta', target: 'self', stat: 'attack', amount: 10 },
    },
  },
  squallLine: {
    id: 'squallLine',
    name: 'Squall Line',
    description: 'Whenever this hero lands an attack, it gains 5 Attack and 5 Speed.',
    // Unconditional and per HIT, so a spread cast pays twice — the smallest per-firing figure of
    // any evolution passive for that reason. Speed on the roster's fastest hero compounds: the
    // ramp buys the turn order it needs to keep ramping.
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'statDelta', target: 'self', stat: ['attack', 'speed'], amount: 5 },
    },
  },
  plunder: {
    id: 'plunder',
    name: 'Plunder',
    description: 'Whenever this hero lands an attack, it gains 10 mana.',
    // Overspill's uncapped grant metered out a hit at a time instead of an arrival at a time
    // (docs/mana.md "Overflow"). Scallywag's late column is expensive and its Attack is not, so
    // the aggression funds itself — and the overflow is what reaches Overcharge without a Rest.
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'manaGrant', target: 'self', amount: { kind: 'flat', value: 10 } },
    },
  },
  thornrot: {
    id: 'thornrot',
    name: 'Thornrot',
    description: 'Whenever this hero applies Poison, it gains 10 Attack and 10 Speed.',
    // Restorative Toxin's trigger paying a stat line instead of a HoT — Sylva turns Poison into
    // sustain, Mordrax turns it into pressure. Poison stacks, so every re-application pays again.
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Poison' } },
      effect: { kind: 'statDelta', target: 'self', stat: ['attack', 'speed'], amount: 10 },
    },
  },
  heartwood: {
    id: 'heartwood',
    name: 'Heartwood',
    description: "Whenever this hero's Renew heals it, it gains 10 Attack and 10 Defense.",
    // Read off the TICK, not the Healed hook: a HoT tick emits StatusTicked (kind 'heal'), never
    // Healed, so Communion's shape would never fire here. Renew halves each tick but the stat
    // line does not, which is what turns Hollowbark's own Second Wind into a three-round ramp.
    reactive: {
      hook: 'StatusTicked',
      condition: { relativeTo: 'self', eventFieldEquals: { statusId: 'Renew', kind: 'heal' } },
      effect: { kind: 'statDelta', target: 'self', stat: ['attack', 'defense'], amount: 10 },
    },
  },
  shieldbearer: {
    id: 'shieldbearer',
    name: 'Shieldbearer',
    description: 'When this hero enters the battlefield, its partner gains 20 Defense and 20 Wisdom.',
    // Nature's Purification's arrival shape paying a stat line sideways. BOTH defensive stats
    // because Aegis does not pick its partner: the grant has to be worth the same to a Crag as
    // to a Glyph. Alone on the field it resolves to nobody and is silent.
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'ally', stat: ['defense', 'wisdom'], amount: 20 },
    },
  },
  puppetStrings: {
    id: 'puppetStrings',
    name: 'Puppet Strings',
    description: "Whenever an enemy's Intelligence drops, this hero gains 10 Intelligence.",
    // Entanglement's trigger on the other magical stat, paying the owner rather than marking the
    // foe. Trance's slate is an Intelligence shredder (Lull, Disorient, Break Will), and Disorient
    // reaching both foes is two firings. ATTRIBUTION: StatChanged carries no source, so a Mind
    // PARTNER's debuff arms it too — the same deliberate looseness Entanglement has.
    reactive: {
      hook: 'StatChanged',
      condition: { relativeTo: 'enemy', eventFieldEquals: { stat: 'intelligence' }, eventFieldNegative: 'delta' },
      effect: { kind: 'statDelta', target: 'self', stat: 'intelligence', amount: 10 },
    },
  },
  grief: {
    id: 'grief',
    name: 'Grief',
    description: 'Whenever this hero takes damage, it gains Renew 20.',
    // Tempering's trigger paying a HoT instead of Defense, which is the only way a 45-Defense
    // body gets to be the one that stays. Renew is additive and survives switching, so a pivot
    // out to the bench carries the stack with it.
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Renew', magnitude: 20 },
    },
  },
  sentry: {
    id: 'sentry',
    name: 'Sentry',
    description: 'When this hero enters the battlefield, it is Provoked — single-target enemy moves aimed at either ally are redirected onto it this round.',
    // The doubles anchor made passive: the Stone move Provoke, on arrival, without Warden having
    // to be Stone or spend the turn. Duration 1 ticking at END of round means exactly the round
    // it arrived in, so the redirect is a pivot's payload and not a standing tax.
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Provoke', duration: 1 },
    },
  },
  cavalryCharge: {
    id: 'cavalryCharge',
    name: 'Cavalry Charge',
    description: 'When this hero enters the battlefield, it gains 30 Attack.',
    // The charge, literally: the arrival IS the payload, so the bench-cycling engine becomes
    // Gallant's damage curve. Unbounded within a fight, and priced in the turn each pivot costs.
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'self', stat: 'attack', amount: 30 },
    },
  },
  runawayPressure: {
    id: 'runawayPressure',
    name: 'Runaway Pressure',
    description: 'Whenever this hero lands an attack, it gains 10 Attack.',
    // Squall Line's shape at double the figure on one axis, because Bellows at 5 Speed acts last
    // in nearly every exchange — the ramp is what it is paid for never getting to go first.
    // Unbounded within a fight on purpose; the Pact Clock is what brackets it.
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'statDelta', target: 'self', stat: 'attack', amount: 10 },
    },
  },
  superheat: {
    id: 'superheat',
    name: 'Superheat',
    description: 'Whenever this hero is Burned, it gains 20 Intelligence.',
    // Combustion aimed at the other offensive stat, which is what makes it a REFOCUS payoff
    // rather than a copy: Overpressure SPENDS Bellows' Attack, and Mech's magical column
    // (Backfire, Overheat, Meltdown) burns its own caster, so the drawback funds the new stat.
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', eventFieldEquals: { statusId: 'Burn' } },
      effect: { kind: 'statDelta', target: 'self', stat: 'intelligence', amount: 20 },
    },
  },
  widowsKiss: {
    id: 'widowsKiss',
    name: "Widow's Kiss",
    description: 'Whenever this hero applies Bleed, that target also gains Poison 10.',
    // Source-role StatusApplied landing on triggerTarget — the hero that RECEIVED the Bleed,
    // which is the only way a source-role passive reaches it. Widow's two damage-over-time
    // columns collapse into one: every Bleed is also a Poison, and Toxic Fangs is both twice.
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Bleed' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Poison', magnitude: 10, duration: 3 },
    },
  },
  snare: {
    id: 'snare',
    name: 'Snare',
    description: 'When this hero enters the battlefield, both active enemies lose 20 Speed.',
    // Imposing Presence pointed at Speed instead of Attack. On the joint-fastest hero in the
    // roster this is not a defensive read — it buys the turn order outright, and holds it
    // through the pivot back in.
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'activeEnemies', stat: 'speed', amount: -20 },
    },
  },
  constrict: {
    id: 'constrict',
    name: 'Constrict',
    description: 'Whenever this hero lands a magical attack, its target loses 10 Speed.',
    // Enthrall's source-role shape paying a stat debuff instead of a mark. Coil's slate is
    // magical end to end, so every cast tightens; Psionic Wave reaching both foes slows both.
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { category: 'magical' } },
      effect: { kind: 'statDelta', target: 'triggerTarget', stat: 'speed', amount: -10 },
    },
  },
  // --- The third-of-each-type six (2026-09-17) ---
  aftershock: {
    id: 'aftershock',
    name: 'Aftershock',
    description: 'Whenever this hero lands a magical attack, its target loses 10 Defense.',
    // Constrict's shape aimed at Defense: the mixed line's two halves feed each other, since
    // Stone's magical column is all spread — one Rockfall softens both foes for the staff.
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { category: 'magical' } },
      effect: { kind: 'statDelta', target: 'triggerTarget', stat: 'defense', amount: -10 },
    },
  },
  pixieDust: {
    id: 'pixieDust',
    name: 'Pixie Dust',
    description: 'When this hero enters the battlefield, its partner gains 30 mana, past their pool.',
    // Overspill pointed at the partner. A support that pivots in is paying a turn to arrive, and
    // the arrival itself is the pour — the bench-cycling engine, read from the other seat.
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'manaGrant', target: 'ally', amount: { kind: 'flat', value: 30 } },
    },
  },
  rampant: {
    id: 'rampant',
    name: 'Rampant',
    description: 'Whenever this hero takes damage, it gains 10 Attack.',
    // Tempering's trigger paying the offensive stat, on the body least interested in defending.
    // Every hit it eats is a bigger bite back; the Pact Clock is what brackets it.
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'self', stat: 'attack', amount: 10 },
    },
  },
  omen: {
    id: 'omen',
    name: 'Omen',
    description: 'When this hero enters the battlefield, both active enemies are Haunted.',
    // Torment for free on every arrival, both foes at once. Sentry's shape carrying Spirit's
    // mark instead of Provoke: the tank does not need the hits aimed at it, it needs every hit
    // its partner lands to count twice.
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Haunt' },
    },
  },
  sunblind: {
    id: 'sunblind',
    name: 'Sunblind',
    description: 'Whenever this hero Dazes a foe, that foe loses 20 Wisdom.',
    // Widow's Kiss on the Daze rider: a flash that lands before the foe acts costs them the
    // turn, and now the follow-up burns through them too. Only pays on a hero fast enough to
    // land the Daze first, which is the whole line.
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Daze' } },
      effect: { kind: 'statDelta', target: 'triggerTarget', stat: 'wisdom', amount: -20 },
    },
  },
  thickHide: {
    id: 'thickHide',
    name: 'Thick Hide',
    description: 'Whenever this hero takes damage, it gains Shield 20.',
    // Grief's trigger paying a Shield pool instead of a HoT: flat, since a passive has no move to
    // scale off, additive up to max HP, and taken only by the next hit — on a hero whose kit
    // draws the hits (Provoke), each one it eats is the next one it half-eats.
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Shield', magnitude: 20 },
    },
  },
  chargedAir: {
    id: 'chargedAir',
    name: 'Charged Air',
    description: 'This hero has +20 Intelligence and +20 Speed while an enemy is Conducting.',
    // Bloodthirsty's shape on Conduct: Skyshear plants the mark (Jolt, Ionize, Stunning Bolt,
    // Thunderbolt, Stoop) and is a bigger, faster caster for as long as it holds. A live grant,
    // so it switches off when the marked foe is detonated, switches out or faints.
    conditionalStatGrants: {
      requiresEnemyStatus: 'Conduct',
      statGrants: { intelligence: 20, speed: 20 },
    },
  },
  // --- The Free Company (docs/constellation.md §11 phase 6) ---
  nanites: {
    id: 'nanites',
    name: 'Nanites',
    description: 'When this hero enters the battlefield, its partner gains Renew 30.',
    // The partner-on-arrival shape (Arcane Reservoir's mana, Bodyguard's Defense) paying a HoT:
    // the medic starts work on whoever it walks in beside, and a pivot out and back re-seeds it.
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Renew', magnitude: 30 },
    },
  },
  bloodmeal: {
    id: 'bloodmeal',
    name: 'Bloodmeal',
    description: 'Whenever this hero applies Bleed, it gains Renew 20.',
    // Restorative Toxin's trigger on Bleed, flat since Bleed carries no magnitude: the bat feeds
    // on what it opens, and a 170-HP body that keeps cutting keeps standing.
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Bleed' } },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Renew', magnitude: 20 },
    },
  },
};

// --- Innate (HeroDefinition.passiveIds, docs/innate-passives.md) ---
//
// One a hero, held from birth, live from the first fight on either side of the field. A verb
// never a number: a card here is a reaction, an entry grant or a rider, never `statGrants`
// alone (test/roster pins it). In no pool — an innate that is ALSO an equipment card (Impale on
// Mordrax, Sunder on Gallant) reaches the Boon pool as the equipment card it is, and stacks.
// The band is deliberately narrow: an entry grant, a 5-point reaction, a rider on a typed hit,
// a trickle. Sibling pairs across a type (Fault Line / Aftershock, Live Wire / Static Field) and
// innate → Evolution chains (Impale → Thornrot, Attunement → Pixie Dust) are what the seats are for.
const innatePassives: Record<string, PassiveDefinition> = {
  kindling: {
    id: 'kindling',
    name: 'Kindling',
    description: 'Whenever this hero afflicts Burn, it gains 5 Attack.',
    // Fires on Fire's self-Burn too — the cost pays a little back, which is the brawler's reading.
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Burn' } },
      effect: { kind: 'statDelta', target: 'self', stat: 'attack', amount: 5 },
    },
  },
  stoke: {
    id: 'stoke',
    name: 'Stoke',
    description: 'Whenever an enemy takes Burn damage, this hero gains 5 Intelligence.',
    reactive: {
      hook: 'StatusTicked',
      condition: { relativeTo: 'enemy', eventFieldEquals: { statusId: 'Burn', kind: 'damage' } },
      effect: { kind: 'statDelta', target: 'self', stat: 'intelligence', amount: 5 },
    },
  },
  sulphur: {
    id: 'sulphur',
    name: 'Sulphur',
    description: 'When this hero enters the battlefield, both active enemies gain Burn 5.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Burn', magnitude: 5 },
    },
  },
  drag: {
    id: 'drag',
    name: 'Drag',
    description: 'Whenever this hero lands a Water attack, its target loses 5 Speed.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Water' } },
      effect: { kind: 'statDelta', target: 'triggerTarget', stat: 'speed', amount: -5 },
    },
  },
  carapace: {
    id: 'carapace',
    name: 'Carapace',
    description: 'When this hero enters the battlefield, it gains Shield 30.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Shield', magnitude: 30 },
    },
  },
  glaciate: {
    id: 'glaciate',
    name: 'Glaciate',
    description: 'Whenever this hero takes damage, both active enemies lose 5 Speed.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'activeEnemies', stat: 'speed', amount: -5 },
    },
  },
  coldSnap: {
    id: 'coldSnap',
    name: 'Cold Snap',
    description: 'Whenever this hero Freezes an enemy, it gains 10 Attack.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Freeze' } },
      effect: { kind: 'statDelta', target: 'self', stat: 'attack', amount: 10 },
    },
  },
  absoluteZero: {
    id: 'absoluteZero',
    name: 'Absolute Zero',
    description: "Whenever this hero's Defense rises, both active enemies lose 5 Speed.",
    reactive: {
      hook: 'StatChanged',
      condition: { relativeTo: 'self', eventFieldEquals: { stat: 'defense' }, eventFieldPositive: 'delta' },
      effect: { kind: 'statDelta', target: 'activeEnemies', stat: 'speed', amount: -5 },
    },
  },
  tailwind: {
    id: 'tailwind',
    name: 'Tailwind',
    description: 'When this hero enters the battlefield, its partner gains 10 Speed.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'ally', stat: 'speed', amount: 10 },
    },
  },
  liveWire: {
    id: 'liveWire',
    name: 'Live Wire',
    description: 'Whenever this hero lands a Storm attack, its target is Conducting.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Storm' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Conduct' },
    },
  },
  staticField: {
    id: 'staticField',
    name: 'Static Field',
    description: 'Whenever an enemy becomes Conducting, this hero gains 10 Intelligence.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'enemy', eventFieldEquals: { statusId: 'Conduct' } },
      effect: { kind: 'statDelta', target: 'self', stat: 'intelligence', amount: 10 },
    },
  },
  stoneWall: {
    id: 'stoneWall',
    name: 'Stone Wall',
    description: 'When this hero enters the battlefield, its partner gains Shield 20.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Shield', magnitude: 20 },
    },
  },
  faultLine: {
    id: 'faultLine',
    name: 'Fault Line',
    description: 'Whenever this hero lands a physical attack, its target loses 5 Wisdom.',
    // Aftershock's mirror (magical → Defense), so Slate's Quakebringer holds both halves.
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { category: 'physical' } },
      effect: { kind: 'statDelta', target: 'triggerTarget', stat: 'wisdom', amount: -5 },
    },
  },
  verdure: {
    id: 'verdure',
    name: 'Verdure',
    description: 'Whenever this hero heals an ally, that ally gains Renew 10.',
    reactive: {
      hook: 'Healed',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Renew', magnitude: 10 },
    },
  },
  grace: {
    id: 'grace',
    name: 'Grace',
    description: 'Whenever this hero heals an ally, it gains 10 Mana, past its pool.',
    reactive: {
      hook: 'Healed',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'manaGrant', target: 'self', amount: { kind: 'flat', value: 10 } },
    },
  },
  consecrate: {
    id: 'consecrate',
    name: 'Consecrate',
    description: 'Whenever this hero is healed, it gains 5 Defense and 5 Wisdom.',
    reactive: {
      hook: 'Healed',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'self', stat: ['defense', 'wisdom'], amount: 5 },
    },
  },
  halo: {
    id: 'halo',
    name: 'Halo',
    description: "At the end of each round, this hero's partner is healed 10.",
    reactive: {
      hook: 'RoundEnded',
      condition: { relativeTo: 'self' },
      effect: { kind: 'heal', target: 'ally', amount: { kind: 'flat', value: 10 } },
    },
  },
  lacerate: {
    id: 'lacerate',
    name: 'Lacerate',
    description: 'Whenever this hero lands a physical attack, its target Bleeds.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { category: 'physical' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Bleed' },
    },
  },
  necrosis: {
    id: 'necrosis',
    name: 'Necrosis',
    description: 'Whenever an enemy takes Poison damage, this hero heals for the same amount.',
    reactive: {
      hook: 'StatusTicked',
      condition: { relativeTo: 'enemy', eventFieldEquals: { statusId: 'Poison', kind: 'damage' } },
      effect: { kind: 'heal', target: 'self', amount: { kind: 'matchTriggerAmount' } },
    },
  },
  shadowmeld: {
    id: 'shadowmeld',
    name: 'Shadowmeld',
    description: 'When this hero enters the battlefield, it gains Ambush 10.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Ambush', magnitude: 10 },
    },
  },
  neuroplastic: {
    id: 'neuroplastic',
    name: 'Neuroplastic',
    description: 'Whenever this hero takes damage, it gains 5 Attack and 5 Intelligence.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'self', stat: ['attack', 'intelligence'], amount: 5 },
    },
  },
  intrusion: {
    id: 'intrusion',
    name: 'Intrusion',
    description: 'Whenever this hero lands a Mind attack, its target loses 5 Intelligence.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Mind' } },
      effect: { kind: 'statDelta', target: 'triggerTarget', stat: 'intelligence', amount: -5 },
    },
  },
  lullaby: {
    id: 'lullaby',
    name: 'Lullaby',
    description: 'At the end of each round, both active enemies lose 5 Speed.',
    reactive: {
      hook: 'RoundEnded',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'activeEnemies', stat: 'speed', amount: -5 },
    },
  },
  wail: {
    id: 'wail',
    name: 'Wail',
    description: 'Whenever this hero lands a Spirit attack, its target is Haunted.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Spirit' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Haunt' },
    },
  },
  foreboding: {
    id: 'foreboding',
    name: 'Foreboding',
    description: 'Whenever an enemy is Haunted, this hero gains 5 Defense and 5 Wisdom.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'enemy', eventFieldEquals: { statusId: 'Haunt' } },
      effect: { kind: 'statDelta', target: 'self', stat: ['defense', 'wisdom'], amount: 5 },
    },
  },
  rivet: {
    id: 'rivet',
    name: 'Rivet',
    description: 'Whenever this hero takes damage, its partner gains 5 Defense.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'ally', stat: 'defense', amount: 5 },
    },
  },
  boiler: {
    id: 'boiler',
    name: 'Boiler',
    description: 'Whenever this hero is Burned, it gains 10 Mana, past its pool.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', eventFieldEquals: { statusId: 'Burn' } },
      effect: { kind: 'manaGrant', target: 'self', amount: { kind: 'flat', value: 10 } },
    },
  },
  steamPressure: {
    id: 'steamPressure',
    name: 'Steam Pressure',
    description: 'Whenever this hero is Burned, it gains 10 Speed.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', eventFieldEquals: { statusId: 'Burn' } },
      effect: { kind: 'statDelta', target: 'self', stat: 'speed', amount: 10 },
    },
  },
  fieldRepair: {
    id: 'fieldRepair',
    name: 'Field Repair',
    description: 'Whenever this hero heals an ally, that ally is Cleansed of one affliction.',
    reactive: {
      hook: 'Healed',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'cleanse', target: 'triggerTarget', count: 1 },
    },
  },
  packHunter: {
    id: 'packHunter',
    name: 'Pack Hunter',
    description: "Whenever this hero's partner lands an attack, this hero gains 5 Attack.",
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'ally', subjectRole: 'source' },
      effect: { kind: 'statDelta', target: 'self', stat: 'attack', amount: 5 },
    },
  },
  serpentsEye: {
    id: 'serpentsEye',
    name: "Serpent's Eye",
    description: 'When this hero enters the battlefield, both active enemies lose 10 Intelligence.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'activeEnemies', stat: 'intelligence', amount: -10 },
    },
  },
  lingering: {
    id: 'lingering',
    name: 'Lingering',
    description: 'The first time this hero would be knocked out each fight, it survives at 1 HP.',
    // The one innate the designer flagged as likely over the band, kept on purpose to be tested.
    enduresOnce: true,
  },
  // The Burden (docs/innate-passives.md §4): a cost, and the hero born with it comes in
  // BURDEN_SURPLUS over the 550. Bellows is the first and, for now, the only one.
  ironbound: {
    id: 'ironbound',
    name: 'Ironbound',
    description: 'This hero never switches out on its own. It is far bigger than its peers for it.',
    cannotSwitchOut: true,
    burden: true,
  },
};

/** Whether a passive is a Burden — a cost the hero was born with, priced in its stat line. */
export function isBurden(passiveId: string): boolean {
  return passives[passiveId]?.burden === true;
}

// --- The Titan's Mark (every Titanspawn, docs/innate-passives.md §3) ---
//
// One a type, identical in shape: at each round end the spawn stands on the field it gains
// TITANS_MARK_FORCE of its own type's Force. The Force statuses are additive, never decay and
// survive a switch, so the stack climbs for as long as the creature stands — the Titan's clock in
// miniature, and the reason a Skirmish against spawn is a fight to end rather than to cycle.
// Active only (RoundEnded fires for owners on the field), the Pact Clock's shape since the bench
// came off it. Generated like the type Boons; Ancient has none, the Titan does not mark itself.
// The spawn alone carry it, never a Guardian: measured (docs/innate-passives.md §8), a Marked
// champion in a 14-round fight took the Act 1 Guardian 92 -> 76% and the act 68 -> 56%, and
// leaving the champion bare put both back exactly — the seal is what keeps the Mark off it.
export const TITANS_MARK_FORCE = 5;

const MARK_TYPES: readonly TitanpactType[] = TYPES.filter((type) => type !== 'Ancient');

const titansMarkPassives: Record<string, PassiveDefinition> = Object.fromEntries(
  MARK_TYPES.map((type) => {
    const id = `markOf${type}`;
    return [
      id,
      {
        id,
        name: `Mark of the Titan (${type})`,
        description: `At the end of each round this creature stands on the field, it gains ${type} Force ${TITANS_MARK_FORCE}.`,
        reactive: {
          hook: 'RoundEnded',
          condition: { relativeTo: 'self' },
          effect: { kind: 'applyStatus', target: 'self', statusId: `${type}Force`, magnitude: TITANS_MARK_FORCE },
        },
      } satisfies PassiveDefinition,
    ];
  })
);

/** Type -> its Mark. A Titanspawn line carries the one for its type (titanspawn.ts); a Guardian does not — its seal keeps it off (enemies.ts). */
export const titansMarkFor: Partial<Record<TitanpactType, string>> = Object.fromEntries(MARK_TYPES.map((type) => [type, `markOf${type}`]));

/** Whether a passive is a Mark — the scouted chip and the nameplate read it as the Titan's, not the creature's. */
export function isTitansMark(passiveId: string): boolean {
  return passiveId in titansMarkPassives;
}

// --- The Titan's pieces (HeroDefinition.passiveIds, docs/titan-eyes.md §10) ---
//
// Innate to the Herald and the Eyes, in no pool: a piece of the Titan is the only thing that ever
// holds one. The Standard is the finale's shape — the company must fall before the Herald can be
// touched — and the Gaze is the Eyes' clock, set as they open and returning every third round so a
// field of the player's own buys one to three rounds and never the phase.
export const HERALDS_STANDARD_ID = 'heraldsStandard';
export const WITHERING_GAZE_FALLS_ID = 'witheringGazeFalls';
export const WITHERING_GAZE_RETURNS_ID = 'witheringGazeReturns';

/** Every third round: the Gaze lasts five, so a player's field is overwritten inside it (never refreshed — re-setting the active field is a no-op). */
export const WITHERING_GAZE_CADENCE = 3;

const titanPassives: Record<string, PassiveDefinition> = {
  [HERALDS_STANDARD_ID]: {
    id: HERALDS_STANDARD_ID,
    name: "Herald's Standard",
    description: 'While any of its company still stands, every move aimed at the Herald turns away and no affliction can touch it.',
    wardedWhileCompanyStands: true,
  },
  [WITHERING_GAZE_FALLS_ID]: {
    id: WITHERING_GAZE_FALLS_ID,
    name: 'The Gaze Falls',
    description: 'When this Eye opens on the battlefield, set Withering Gaze.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'setFieldEffect', fieldEffectId: 'witheringGaze' },
    },
  },

  [WITHERING_GAZE_RETURNS_ID]: {
    id: WITHERING_GAZE_RETURNS_ID,
    name: 'The Gaze Returns',
    description: `Every ${WITHERING_GAZE_CADENCE === 3 ? 'third' : `${WITHERING_GAZE_CADENCE}th`} round, set Withering Gaze again.`,
    reactive: {
      hook: 'RoundEnded',
      condition: { relativeTo: 'self', everyNRounds: WITHERING_GAZE_CADENCE },
      effect: { kind: 'setFieldEffect', fieldEffectId: 'witheringGaze' },
    },
  },
};

export const passives: Record<string, PassiveDefinition> = {
  ...fixturePassives,
  ...equipmentPassives,
  ...eventPassives,
  ...typeDamagePassives,
  ...fieldHeraldPassives,
  ...evolutionPassives,
  ...classPassives,
  ...innatePassives,
  ...titansMarkPassives,
  ...titanPassives,
};

/**
 * The Boon node's pool (`src/run/boons.ts`). Equipment and event passives are the roster-agnostic
 * half — every one is live on any hero — and the type-locked half joins per run, filtered to the
 * types the roster actually fields. Evolution passives and Classes are deliberately absent: an
 * Evolution path's passive IS that path's identity, and a Class has its own node.
 */
export const boonPassives: Record<string, PassiveDefinition> = { ...equipmentPassives, ...eventPassives };

/**
 * What a passive costs when an ITEM grants it, in RARITY_BUDGET points (multiples of 5).
 * equipmentBudgetProblems fails on any equipment-granted passive missing here. Relics are
 * not priced through this. Anchor: 40 = a 20% type-locked damage multiplier.
 *
 * Roughly DOUBLED with the 2026-09-06 budget pass, and that is not just tracking inflation:
 * almost everything here is percentage-shaped or unbounded — a 20% multiplier, a share of
 * damage healed, a stack that grows all fight — so what it is worth rises with the stat line
 * around it, and the stat lines tripled. Left at the old figures a Mythic would clear the
 * effect floor for 18% of its budget and still be a stat stick.
 */
/**
 * What a granted passive costs an item's rarity budget. FLAT at AWAKENING_COST for every entry
 * (2026-09-07, per user direction): a family's Awakening is the same at Epic, Legendary and
 * Mythic, so there is no per-tier magnitude to price and no reason for one passive to cost more
 * than another *as an item component*. It replaced a 30/50 spread.
 *
 * The magnitudes themselves were set under that old spread — Vengeful Emblem was priced at 50 and
 * Purifying Ward at 30, and they now cost the same — so they owe a balance sweep before playtest
 * (docs/equipment.md §2 "The inherited magnitudes owe a balance pass").
 *
 * Only ITEM-granted passives appear here. The type-locked damage passives left the item catalog
 * with the generated type gear (element is the enchantment axis now) and live on the Boon node,
 * which is a reward rather than a priced component.
 */
export const AWAKENING_COST = 20;

export const PASSIVE_ITEM_COST: Readonly<Record<string, number>> = Object.fromEntries(
  [
    'sunder',
    'bloodthirst',
    'vengefulEmblem',
    'impale',
    'marksman',
    'overchannel',
    'quickening',
    'purifyingWard',
    'arcaneReservoir',
    'wardensVigil',
    'secondSkin',
    'barbs',
    'manaWard',
    'attunement',
    'rallyingStandard',
  ].map((id) => [id, AWAKENING_COST])
);
