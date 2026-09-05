// Passive catalog, grouped by where a passive comes from. `passives` is the single lookup every
// screen and resolveRound import, so the Class catalog (classes.ts) is merged in here too.

import type { PassiveDefinition } from '../engine/content';
import { classes } from './classes';

// --- Fixture passives (sanguine: Lucius's Evolution; emberheart: relic) ---
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
  emberheart: {
    id: 'emberheart',
    name: 'Emberheart',
    description: 'Deals 20% bonus damage with Fire-type moves.',
    damageModifier: { eventFieldEquals: { moveType: 'Fire' }, amount: 0.2 },
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
  stormcallersFocus: {
    id: 'stormcallersFocus',
    name: "Stormcaller's Focus",
    description: 'Deals 20% bonus damage with Storm-type moves.',
    damageModifier: { eventFieldEquals: { moveType: 'Storm' }, amount: 0.2 },
  },
  frostbrand: {
    id: 'frostbrand',
    name: 'Frostbrand',
    description: 'Deals 20% bonus damage with Frost-type moves.',
    damageModifier: { eventFieldEquals: { moveType: 'Frost' }, amount: 0.2 },
  },
  shadowfang: {
    id: 'shadowfang',
    name: 'Shadowfang',
    description: 'Deals 20% bonus damage with Shadow-type moves.',
    damageModifier: { eventFieldEquals: { moveType: 'Shadow' }, amount: 0.2 },
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
    description: 'When this hero enters the battlefield, it gains Renew 20.',
    // Same arrival shape as Imposing Presence, pointed inward: every arrival including the
    // opening lead, so a pivot out and back re-seeds it. Renew stacks additively, which is
    // the intended payoff. A passive-applied HoT is FLAT — the healing formula's Wisdom
    // scaling belongs to a move's own heal, and a passive has no move to take STAB from.
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Renew', magnitude: 20 },
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
    description: 'Whenever this hero gains Stealth, it gains 20 Attack.',
    // Target-role StatusApplied: the subject is whoever RECEIVED the status, so this reads
    // "I became hidden". Nightshade's own Vanish (15 mana) and Shadow Form are the sources, which
    // makes the ramp a turn spent rather than a rider on attacking. Stealth is stacking 'none',
    // so re-applying while already hidden emits no event and pays nothing — the ramp costs a
    // fresh Stealth every time, and Stealth's start-of-round tick is what frees one up.
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', eventFieldEquals: { statusId: 'Stealth' } },
      effect: { kind: 'statDelta', target: 'self', stat: 'attack', amount: 20 },
    },
  },
  entanglement: {
    id: 'entanglement',
    name: 'Entanglement',
    description: "Whenever an enemy's Wisdom drops, that enemy is Haunted.",
    // Frozen Stone inverted: eventFieldNegative is what makes this "drops" and not "changes", so
    // a Wisdom BUFF on a foe never marks them. Cortex's slate is a Wisdom shredder end to end
    // (Psi Bolt, Enervate, Psyshock, Disorient, Psionic Wave), so the debuffs it was already
    // casting now plant Haunt for free — and Wisdom is the magical defStat, so the same point
    // both softens the target and marks it.
    // ATTRIBUTION: StatChanged carries no source, so this reads "an enemy's Wisdom dropped",
    // not "I dropped it" — a Mind PARTNER's debuff arms it too. Deliberate, docs/combat.md.
    reactive: {
      hook: 'StatChanged',
      condition: { relativeTo: 'enemy', eventFieldEquals: { stat: 'wisdom' }, eventFieldNegative: 'delta' },
      effect: { kind: 'applyStatus', target: 'triggerSubject', statusId: 'Haunt' },
    },
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
  feedbackLoop: {
    id: 'feedbackLoop',
    name: 'Feedback Loop',
    description: 'Whenever this hero applies Conduct, it gains +10 Intelligence.',
    // Firestarter's shape (source-role StatusApplied) pointed at the mark Tempest already
    // builds its slate around, so planting is also ramping. NOT oncePerFight: the ramp IS the
    // path, and Ionize plants on both foes for two firings. Conduct is stacking 'none', so a
    // re-plant on an already-marked target does not re-fire; the ramp costs fresh targets.
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Conduct' } },
      effect: { kind: 'statDelta', target: 'self', stat: 'intelligence', amount: 10 },
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
    description: 'Whenever this hero takes damage, both active enemies gain Burn 5.',
    // Target-role DamageDealt: "I was hit". There is no 'triggerSource' target — a passive cannot
    // reach the attacker — so the answer goes to activeEnemies, which in doubles is the attacker
    // plus its partner. Small per firing, stacking additively, and Immolate is what cashes it.
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Burn', magnitude: 5 },
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
    description: 'Whenever this hero takes damage, it gains Renew 10.',
    // Tempering's trigger paying a HoT instead of Defense, which is the only way a 45-Defense
    // body gets to be the one that stays. Renew is additive and survives switching, so a pivot
    // out to the bench carries the stack with it.
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Renew', magnitude: 10 },
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
};

export const passives: Record<string, PassiveDefinition> = { ...fixturePassives, ...equipmentPassives, ...eventPassives, ...evolutionPassives, ...classes };

/**
 * What a passive costs when an ITEM grants it, in RARITY_BUDGET points (multiples of 5).
 * equipmentBudgetProblems fails on any equipment-granted passive missing here. Relics are
 * not priced through this. Anchor: 20 = a 20% type-locked damage multiplier.
 */
export const PASSIVE_ITEM_COST: Readonly<Record<string, number>> = {
  emberheart: 20,
  stormcallersFocus: 20,
  frostbrand: 20,
  shadowfang: 20,
  bloodthirst: 20,
  wardensVigil: 15,
  vengefulEmblem: 25,
  sanguine: 20,
};
