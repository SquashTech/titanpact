// Level-up move pools and Evolution nodes for the roster, all 42 heroes (three a type, 2026-09-17).
// A pool entry that is also in the hero's starting
// kit is dead weight: levelUpMovePool filters unlocked moves out, so it can
// never be offered. Every Evolution node offers three paths differing in kind
// and keeps at least one path that leaves the typing alone. The graft owns the SECONDARY SLOT, so a
// mono hero gains a type and an innately dual one TRADES the one it was born with — exactly one path
// per dual hero does, and it pays for the STAB it costs by carrying the new type's line. A graft's
// `learnableMoveIds` JOIN the level-up pool rather than being handed over (docs/leveling-and-ranks.md).

import type { ProgressionTable } from '../run/progression';
import type { TypeId } from '../engine/content';
import { heroes } from './heroes';
import { moves } from './moves';
import { spawnMoveTiers, spawnSlate } from './titanspawn';

const moveTiers: ProgressionTable['moveTiers'] = {
    // FLOOR (test/moveTiers.test.ts, movePoolFloor): after the starting kit is filtered out, every
    // pool holds MOVE_CAP more than the level curve can draw FROM EACH OFFERABLE SET — Early expires
    // when Mid opens, so the sets are Early alone (2 offers), Mid alone (2) and Mid+Late (6), and an
    // offer is spent whether it is taken or declined. The MOVE_CAP on top is the loadout: a move the
    // hero is holding is filtered out of its own pool, however it got there. In practice: 6 Early,
    // 6 Mid, 4 Late.
    // Every pool also carries OFF-TYPE entries, drawn from the commodity layer — the single-target
    // attacks and the buffs that carry no engine role. Three rules: pick on the stat the hero
    // actually attacks with, keep to the off-type colours the pool already telegraphs at Early, and
    // never pick the move an Evolution path already hands over (test/roster.test.ts) — telegraph a
    // graft with a DIFFERENT move of that type, or not at all. A move whose power or price is
    // conditional on a status needs a reliable applier of that status in the same pool.
    // --- Fire ---
    // Fire's physical column is four moves past Cinder's kit, so the Early band is Iron
    // off-type by necessity (2026-09-19, mono-Fire); Iron's guard column is Ironclad's line.
    cinderKnight: [
      'kindle',
      'moltenLash',
      'firebrand',
      'blazingRetreat',
      'volcanicSurge',
      'heavyBlow',
      'ironFist',
      'openingStrike',
      'pinDown',
      'swiftBlow',
      'holyStrike',
      'momentumSwing',
      'serratedSlice',
      'rendArmor',
      'metallicBlade',
      'onslaught',
      'swingingChain',
    ],
    crimson: [
      'flashpoint',
      'infuse',
      'setAlight',
      'scorch',
      'immolate',
      'firestorm',
      'inferno',
      'purify',
      'spreadingBlaze',
      'sparkBurst',
      'magicBolt',
      'psiBolt',
      'wisp',
      'sparkFlash',
      'backdraft',
      'radiantBeam',
      'cerebralShock',
      'solarFlare',
      'flareUp',
      'heatHaze',
    ],
    brimstone: [
      'flashpoint',
      'ember',
      'sparkFlash',
      'spreadingBlaze',
      'backdraft',
      'sparkBurst',
      'umbralBeam',
      'umbralWave',
      'setAlight',
      'enfeeble',
      'wisp',
      'magicBolt',
      'stokeTheFlames',
      'jolt',
      'chainLightning',
      'poltergeist',
      'thunderbolt',
      'banish',
      'flareUp',
      'heatHaze',
      'ionCascade',
      'grimHarvest',
    ],
    // Drake: Fire's physical column past its kit, then the dragon's body — Beast claws, Iron weight,
    // and one Storm and two Stone Early moves to telegraph Wyvern and Cinderscale.
    drake: [
      'stokeTheFlames',
      'claw',
      'thunderclap',
      'rockToss',
      'gravelSpray',
      'heavyBlow',
      'rally',
      'firebrand',
      'moltenLash',
      'blazingRetreat',
      'gore',
      'momentumSwing',
      'rendArmor',
      'volcanicSurge',
      'swingingChain',
      'onslaught',
      'rendingLeap',
    ],
    // --- Water ---
    tidecaller: [
    'refresh','siphon', 'torrent', 'engulf', 'crest', 'deluge', 'oasis', 'tsunami', 'highTide', 'seawall', 'undertow', 'iceShard', 'psiBolt', 'glimmer', 'jolt', 'aquaSlice', 'shockBubble', 'waveShred', 'undercurrent', 'cleansingRain', 'rainfall', 'drench'],
    // Shock Bubble plants Conduct and the Iron column detonates it — the mark and the payoff are
    // both already in the pool, which is what Tideclaw's Static Tide then makes free.
    pincer: [
      'openingStrike',
      'aquaSlice',
      'waveShred',
      'washAway',
      'shockBubble',
      'rendArmor',
      'refresh',
      'ironFist',
      'heavyBlow',
      'serratedSlice',
      'rockToss',
      'claw',
      'mudBall',
      'oasis',
      'crest',
      'highTide',
      'seawall',
      'titanicCrush',
      'undercurrent',
      'cleansingRain', 'rainfall', 'drench',
    ],
    // Water's whole magical column, minus Tsunami (Tidebreaker's grant). Deep Chill and Jolt
    // telegraph the two grafts; Tsunami is what the mono path pays with.
    leviathan: [
      // Trimmed so a Downpour setter is likely (2026-10-08): Early 3 and Mid 4, one setter in each —
      // 1 − (1/3 × 1/2) ≈ 83% to be offered at least one. Deep Chill and Shock Bubble telegraph the grafts.
      'deepChill', 'jolt', 'rainfall',
      'rainmaker', 'drench', 'torrent', 'shockBubble',
      'maelstrom', 'highTide', 'seawall', 'thunderbolt',
    ],
    // Nautilus: Water's support and control half, with one Mind and one Shadow Early move to
    // telegraph Inkmind and Mimic.
    nautilus: [
      'lull',
      'siphon',
      'refresh',
      'tideGuard',
      'undercurrent',
      'psiBolt',
      'weaken',
      'torrent',
      'engulf',
      'deluge',
      'washAway',
      'shockBubble',
      'cleansingRain',
      'tsunami',
      'maelstrom',
      'highTide',
      'seawall', 'rainfall', 'drench',
    ],
    // --- Frost ---
    glacialWarden: [
      'rimeWind',
      'snowBlast',
      'frostArmor',
      'glaciate',
      'permafrost',
      'iceShell',
      'rimeCoat',
      'quickFreeze',
      'frigidAir',
      'absoluteZero',
      'avalanche',
      'purify',
      'siphon',
      'magicBolt',
      'jolt',
      'glimmer',
      'torrent',
      'radiantBeam',
      'frostWall',
      'solarFlare',
      'hoarfrostEdge',
      'blindingSnow',
    ],
    // Physical Frost plus physical off-type coverage. The magical half of the slate (Snow Blast,
    // Glaciate, Frigid Air, Quick Freeze, Avalanche, Absolute Zero) belongs to Flurry, who swings
    // with Intelligence; Permafrost stays because a Freeze rider costs nothing off a 40 Int. Frost
    // authors only two physical Mid and two physical Late, so the rest is deliberately off-type —
    // the FLOOR is worth more than tidiness, and Stone/Iron reach what Frost is resisted by.
    rime: [
      'secondWind',
      'icicleThrust', 'coldSnap', 'permafrost', 'iceShell', 'rimeCoat', 'rubbleRush', 'serratedSlice', 'spireClaw',
      'iceShatter', 'frostWall', 'titanicCrush', 'swingingChain',
      'claw', 'frostArmor', 'rockToss', 'undertow', 'thunderclap', 'heavyBlow',
      'hoarfrostEdge',
      'blindingSnow',
    ],
    cube: [
    'pinDown','icicleThrust', 'coldSnap', 'deepChill', 'permafrost', 'rimeCoat', 'rockToss', 'openingStrike', 'ironFist', 'frostWall', 'cogBop', 'snowball', 'heavyBlow', 'iceShatter', 'rubbleRush', 'momentumSwing', 'serratedSlice', 'titanicCrush', 'hoarfrostEdge'],
    // --- Storm ---
    stormRanger: [
      'ironArrow',
      'thunderclap',
      'pinningShot',
      'stormpiercer',
      'rally',
      'stormLash',
      'shockSlice',
      'tailwind',
      'overcharge',
      'heavyBlow',
      'charge',
      'swiftBlow',
      'ionize',
      'fadeStrike',
      'iceShard',
      'stormSurge',
      'rockToss',
      'faultLine',
      'cutthroat',
      'bodyCrush',
      'duskBlade',
      'staticCharge',
      'rideTheLightning',
    ],
    // The mixed pool: Storm's physical column (Thunderclap 45 -> Storm Lash 55 + Conduct ->
    // Overcharge 80, free once both foes are marked) alongside the magical one, because 70/70
    // means picking whichever of the target's Defense and Wisdom is lower. Ten, not eight —
    // two columns need the room.
    tempest: [
      'charge',
      'thunderclap',
      'zap',
      'stormLash',
      'ionize',
      'electricBurst',
      'overcharge',
      'thunderbolt',
      'stormSurge',
      'ionicZap',
      'magicBolt',
      'ironFist',
      'undertow',
      'chainLightning',
      'shockSlice',
      'tailwind',
      'staticCharge',
      'stunningBolt',
      'ionCascade',
    ],
    // Skyshear: the magical column entire, with Arcane, Light and Frost as the off-type — a caster's
    // colours, none of it on Rimewing's or Sunward's line.
    skyshear: [
      'charge',
      'zap',
      'risingStatic',
      'magicBolt',
      'blind',
      'focus',
      'snowBlast',
      'arcFlash',
      'ionize',
      'stunningBolt',
      'electricBurst',
      'chainLightning',
      'arcPulse',
      'blindingSnow',
      'ionicZap',
      'thunderbolt',
      'ionCascade',
      'twinCast',
    ],
    // --- Stone ---
    crag: [
      'secondWind',
      'faultLine',
      'rubbleRush',
      'retribution',
      'boulderSlam',
      'provoke',
      'weaken',
      'rally',
      'bodyCrush',
      'heavyBlow',
      'iceShard',
      'claw',
      'mudBall',
      'bodyBlow',
      'bastion',
      'spireClaw',
      'stoneheart',
      'rampart',
      'eviscerate',
      'gravelSpray', 'digIn', 'tectonicSlam',
    ],
    sentinel: [
      'fortify',
      'bodyBlow',
      'bastion',
      'retribution',
      'boulderSlam',
      'stoneheart',
      'toughenUp',
      'rally',
      'faultLine',
      'openingStrike',
      'holyStrike',
      'rockToss',
      'iceShard',
      'rubbleRush',
      'spireClaw',
      'titanicCrush',
      'rampart',
      'deityBlade',
      'gravelSpray',
      'bodyguard',
      'hallow',
      'sunlance', 'digIn', 'tectonicSlam',
    ],
    // Both of Stone's columns, since the line swings both. Ember, Singe and Magic Bolt telegraph
    // the grafts; Titanic Crush is Quakebringer's grant, so it is not here.
    slate: [
      'rockToss',
      'focus', 'mudBall', 'gravelSpray', 'ember', 'singe', 'magicBolt',
      'faultLine', 'rockfall', 'rubbleRush', 'spireClaw', 'bodyBlow', 'retribution',
      'landslide', 'boulderSlam', 'stoneheart', 'bodyCrush', 'digIn', 'tectonicSlam',
    ],
    // --- Nature ---
    wildOracle: [
      'fullBloom',
      'toxicSpores',
      'vineLash',
      'blight',
      'corrode',
      'magicGrowth',
      'miasma',
      'forceOfNature',
      'wildBloom',
      'animalSpirit',
      'drain',
      'glimmer',
      'jolt',
      'siphon',
      'tremor',
      'vengeance',
      'rockfall',
      'overgrowth',
      'sow',
      'rootbind',
      'leech',
      'greenwood',
    ],
    mordax: [
      'rally',
      'ivySpike',
      'thornWhip',
      'leafSlice',
      'branchSlam',
      'overgrowth',
      'toxicSpores',
      'weaken',
      'lacerate',
      'ironFist',
      'venomBite',
      'mudBall',
      'thunderclap',
      'blight',
      'thrash',
      'bodyBlow',
      'bodyCrush',
      'apexPredator',
      'sow',
      'rootbind',
      'verdantLash',
    ],
    hollowbark: [
      'secondWind',
      'vineLash',
      'blight',
      'leafSlice',
      'thornWhip',
      'branchSlam',
      'regrowth',
      'weaken',
      'stoneheart',
      'rockToss',
      'phantomStrike',
      'mudBall',
      'iceShard',
      'magicGrowth',
      'spookySlice',
      'rubbleRush',
      'overgrowth',
      'wailingFlight',
      'sow',
      'verdantLash',
    ],
    // Tixwick: Nature's blades, then the Bleed column the mantis cuts for — Shadow knives, Beast
    // claws, and Lacerate as the reliable opener Maul and Eviscerate need.
    tixwick: [
      'pinDown',
      'vineLash',
      'claw',
      'hamstring',
      'fadeStrike',
      'backstab',
      'sharpen',
      'thornWhip',
      'leafSlice',
      'lacerate',
      'maul',
      'shadowSlice',
      'rend',
      'cutthroat',
      'duskBlade',
      'eviscerate',
      'thousandCuts',
      'rendingLeap',
    ],
    // --- Light ---
    dawnwarden: [
      'purify',
      'radiantBeam',
      'blind',
      'bless',
      'vigil',
      'consecrate',
      'benediction',
      'smite',
      'radiance',
      'blindingFlash',
      'solarFlare',
      'divineGrace',
      'judgment',
      'exalt',
      'psiBolt',
      'magicBolt',
      'regrowth',
      'jolt',
      'corrode',
      'hallow',
      'dawnlight',
    ],
    aegis: [
    'secondWind','holySlice', 'blind', 'purify', 'bless', 'vigil', 'exalt', 'consecrate', 'benediction', 'divineGrace', 'reinforce', 'pistonPunch', 'vineLash', 'toughenUp', 'rockToss', 'radiantBeam', 'radiance', 'smite', 'solarFlare', 'judgment', 'hallow', 'sunlance', 'bodyguard'],
    // Light's magical attacks and the Daze riders, minus Solar Flare (Sunborne's grant). Jolt and
    // Stunning Bolt telegraph Storm, Wisp telegraphs Spirit; Thunderbolt is the Late off-type.
    empyrean: [
      'blind',
      'bless', 'purify', 'vigil', 'jolt', 'wisp', 'magicBolt',
      'radiantBeam', 'smite', 'blindingFlash', 'radiance', 'benediction', 'stunningBolt',
      'judgment', 'exalt', 'divineGrace', 'thunderbolt',
    ],
    // --- Shadow ---
    // Widow (mono-Shadow since 2026-09-19): the knife column, with the Beast it was born beside
    // kept as off-type telegraph — Venom Bite, Pounce, Howl, the two Bleed riders and Rending
    // Leap. Carapace's line is the mauler's half of the slate, so none of it sits here.
    widow: [
      'lieInWait',
      'hamstring',
      'fadeStrike',
      'phantomStrike',
      'weaken',
      'pounce',
      'howl',
      'knifeFan',
      'cutthroat',
      'rend',
      'shadowSlice',
      'smokeBomb',
      'shadowstrike',
      'lacerate',
      'toxicFangs',
      'duskBlade',
      'thousandCuts',
      'shadowForm',
      'rendingLeap',
      'shadowsweep',
    ],
    marrow: [
    'purify','lieInWait', 'umbralBeam', 'umbralWave', 'poltergeist', 'enfeeble', 'drain', 'torment', 'soulRend', 'wisp', 'jolt', 'siphon', 'deepChill', 'flicker', 'electricBurst', 'lastRites', 'ionicZap', 'maelstrom', 'grimHarvest', 'stunningBolt', 'seance'],
    // Claw is long-standing off-type coverage; Umbra Bolt is the in-type fix — Shadow has a whole
    // magical column and Nightshade's 65 Intelligence could reach none of it.
    nightshade: [
    'weaken','fadeStrike', 'shadowstrike', 'cutthroat', 'shadowSlice', 'rend', 'duskBlade', 'shadowForm', 'thousandCuts', 'claw', 'umbraBolt', 'vineLash', 'ivySpike', 'iceShard', 'enfeeble', 'leafSlice', 'iceShatter', 'hamstring', 'smokeBomb', 'rendingLeap'],
    // --- Arcane ---
    runescribe: [
      'barrier',
      'infuse',
      'manaFont',
      'study',
      'arcaneBlast',
      'overload',
      'magicCloak',
      'arcPulse',
      'singularity',
      'cataclysm',
      'conjuredSword',
      'manaTap',
      'backfire',
      'psiBolt',
      'jolt',
      'siphon',
      'empower',
      'conduit',
      'resonantBolt',
      'twinCast',
    ],
    zenith: [
      'batteryPack',
      'barrier',
      'infuse','conduit', 'fontOfPower', 'arcaneOverflow', 'empower', 'cataclysm', 'focus', 'arcPulse', 'magicCloak', 'glimmer', 'psiBolt', 'manaTap', 'splash', 'arcaneBlast', 'overload', 'study', 'wickedFear',
      'resonantBolt',
      'twinCast',
    ],
    // The support half of Arcane plus the two nukes a partner will want poured into. Bless, Lull
    // and Wisp are the off-type support colours; Stasis telegraphs the Mind graft alongside Lull.
    pixie: [
      'magicBolt',
      'manaFont', 'focus', 'barrier', 'manaTap', 'bless', 'lull', 'wisp',
      'empower', 'arcPulse', 'study', 'magicCloak', 'overload', 'stasis',
      'conduit', 'arcaneOverflow', 'fontOfPower', 'twinCast', 'cataclysm',
    ],
    // --- Mind ---
    // Psyshock and Psionic Wave are the mid/late damage the pool had none of, and both shred
    // Wisdom, so they double as Entanglement fuel. Phantom Strike and Cog Bop are deliberate
    // OFF-TYPE coverage: no STAB, no Evolution needed, and the only two things a base Reverie
    // can point its 53 Attack at. Lull leaves — the one debuff that feeds nothing.
    mindweaver: [
      'barrier',
      'brainWard',
      'psychicBlow',
      'enervate',
      'psyshock',
      'stasis',
      'mentalFortress',
      'disorient',
      'psionicWave',
      'mindShatter',
      'breakWill',
      'brainFlay',
      'phantomStrike',
      'cogBop',
      'backfire',
      'glimmer',
      'lull',
      'cerebralShock',
      'distort',
      'hindsight',
    ],
    // Mono-Mind since 2026-09-05, so the pool follows the primary type. Weaken stays as the one
    // Shadow keepsake (off-type coverage, and the cheapest debuff in the game); the rest of the
    // Shadow line is what Voidcaller grafts back.
    lucius: [
      'mentalFortress',
      'lull',
      'brainWard',
      'weaken',
      'psychicBlow',
      'psyshock',
      'stasis',
      'cerebralShock',
      'disorient',
      'psionicWave',
      'breakWill',
      'mindShatter',
      'magicBolt',
      'wisp',
      'enervate',
      'psiPulse',
      'arcaneBlast',
      'brainFlay',
      'wickedFear',
      'hindsight',
      'mindLeech',
      'twinCast',
    ],
    trance: [
      'enervate',
      'brainWard',
      'psyshock',
      'wickedFear',
      'stasis',
      'disorient',
      'psionicWave',
      'breakWill',
      'brainFlay',
      'dopamine',
      'magicBolt',
      'wisp',
      'deepChill',
      'siphon',
      'psychicBlow',
      'cerebralShock',
      'mindShatter',
      'distort',
      'psiPulse',
      'hindsight',
      'mindLeech',
    ],
    // --- Spirit ---
    revenant: [
      'unbound',
      'secondWind',
      'drain',
      'spite',
      'soulRend',
      'poltergeist',
      'soulOffering',
      'vengeance',
      'flicker',
      'banish',
      'lastRites',
      'ascendant',
      'psiBolt',
      'siphon',
      'deepChill',
      'stasis',
      'breakWill',
      'soulfire',
      'willOWisp',
      'hindsight',
      'unquiet',
      'seance',
    ],
    sorrow: [
    'secondWind','lieInWait', 'backstab', 'fadeStrike', 'spookySlice', 'cutthroat', 'rend', 'soulOffering', 'wailingFlight', 'duskBlade', 'thousandCuts', 'iceShard', 'undertow', 'frostArmor', 'coldSnap', 'aquaSlice', 'ascendant', 'soulfire', 'hamstring'],
    // The magical line and the HP-priced cards a 230-HP body can afford. Provoke and Bodyguard are
    // the tank's off-type verbs; Fortify and Lie in Wait telegraph the grafts.
    dread: [
      'secondWind',
      'wisp', 'drain', 'soulfire', 'provoke', 'fortify', 'lieInWait',
      'soulRend', 'poltergeist', 'soulOffering', 'vengeance', 'flicker', 'bodyguard',
      'banish', 'seance', 'lastRites', 'ascendant',
    ],
    // --- Iron ---
    ironWarden: [
      'repairKit',
    'openingStrike','swiftBlow', 'pinDown', 'ironSkin', 'rendArmor', 'livingWall', 'juggernaut', 'rockToss', 'bodyBlow', 'reinforce', 'bastion', 'holyStrike', 'claw', 'metallicBlade', 'heavyBlow', 'momentumSwing', 'onslaught', 'swingingChain', 'stoneheart', 'shieldBash', 'bodyguard'],
    valor: [
      'provoke',
      'openingStrike',
      'heavyBlow',
      'momentumSwing',
      'serratedSlice',
      'reinforce',
      'swingingChain',
      'metallicBlade',
      'juggernaut',
      'undertow',
      'rockToss',
      'pinDown',
      'fortify',
      'ironSkin',
      'rendArmor',
      'livingWall',
      'bastion',
      'onslaught',
      'deityBlade',
      'shieldBash',
      'parry',
    ],
    gallant: [
      'ironArrow',
      'rally',
      'swiftBlow',
      'ironFist',
      'momentumSwing',
      'serratedSlice',
      'metallicBlade',
      'onslaught',
      'rendArmor',
      'swingingChain',
      'holyStrike',
      'thunderclap',
      'sharpen',
      'openingStrike',
      'ironSkin',
      'shrapnel',
      'reinforce',
      'shockSlice',
      'juggernaut',
      'packLeader',
      'parry',
    ],
    // Scallywag (Iron since 2026-09-19, a bundle hero): the cutlass column, with the dirty-fighting
    // Shadow it always carried and Stone for the cannonballs. No Storm here — Stormrunner's line
    // is the whole of it.
    scallywag: [
      'ironArrow',
      'sharpen',
      'ironFist',
      'openingStrike',
      'swiftBlow',
      'fadeStrike',
      'backstab',
      'rockToss',
      'momentumSwing',
      'metallicBlade',
      'rendArmor',
      'serratedSlice',
      'parry',
      'cutthroat',
      'shadowSlice',
      'swingingChain',
      'onslaught',
      'juggernaut',
      'boulderSlam',
      'duskBlade',
    ],
    // --- Mech ---
    forgewright: [
      'batteryPack',
      'repairKit',
      'rocketPod',
    'sparkPlug','backfire', 'overheat', 'malfunction', 'meltdown', 'salvage', 'juryRig', 'cogBop', 'overclock', 'reinforce', 'undertow', 'singe', 'ironFist', 'rockToss', 'cogSlam', 'whirlingBlades', 'jackpot', 'overdrive', 'perfectCreation', 'steamVent', 'patchUp', 'shockCoil', 'salvo'],
    steamColossus: [
      'repairKit',
      'rocketPod',
      'sharpen',
      'swiftBlow',
      'pistonPunch',
      'cogSlam',
      'whirlingBlades',
      'jackpot',
      'overdrive',
      'perfectCreation',
      'onslaught',
      'thunderclap',
      'rockToss',
      'ironFist',
      'openingStrike',
      'serratedSlice',
      'momentumSwing',
      'rendArmor',
      'salvage',
      'steamVent',
      'sparkPlug',
      'shockCoil',
      'salvo',
      'shieldBash',
    ],
    // Mech's physical column and the Iron heavies a 110-Attack body wants. Pounce telegraphs the
    // Beast graft, Rock Toss the Stone one; Gore is Primal's grant, so it is not here.
    rex: [
      'rocketPod',
      'sparkPlug',
      'pistonPunch', 'cogBop', 'pounce', 'rockToss', 'heavyBlow', 'ironFist',
      'whirlingBlades', 'cogSlam', 'shockCoil', 'juryRig', 'patchUp', 'momentumSwing', 'kickstart',
      'jackpot', 'salvo', 'overdrive', 'onslaught',
    ],
    // Patch: the repair column, with Light, Water and Arcane support as the off-type — a medic's
    // colours. Beacon's and Coolant's lines are the heal columns proper, so they are not here.
    patch: [
      'batteryPack',
      'repairKit',
      'backfire',
      'overclock',
      'purify',
      'mend',
      'refresh',
      'infuse',
      'manaFont',
      'patchUp',
      'salvage',
      'juryRig',
      'malfunction',
      'empower',
      'radiantBeam',
      'overdrive',
      'perfectCreation',
      'conduit',
      'exalt',
    ],
    // --- Beast ---
    packAlpha: [
      'rally',
      'prowl',
      'pounce',
      'lacerate',
      'maul',
      'toxicFangs',
      'thrash',
      'packHunt',
      'rampage',
      'eviscerate',
      'apexPredator',
      'packLeader',
      'fadeStrike',
      'singe',
      'provoke',
      'vineLash',
      'duskBlade',
      'venomBite',
      'gore',
      'bloodTrail',
      'rendingLeap', 'gash', 'bloodFrenzy',
    ],
    // Ursa: the heavy half of the slate — Gore, Rampage, Thrash, Eviscerate — with Stone's guard
    // column as the off-type (Provoke in the kit telegraphs it; Stoneheart is the payoff).
    ursa: [
      'provoke',
      'rally',
      'howl',
      'pounce',
      'venomBite',
      'rockToss',
      'heavyBlow',
      'gore',
      'rampage',
      'maul',
      'lacerate',
      'thrash',
      'bloodTrail',
      'spireClaw',
      'eviscerate',
      'apexPredator',
      'rendingLeap',
      'packLeader',
      'stoneheart', 'gash', 'bloodFrenzy',
    ],
    coil: [
      'primalRoar',
      'animalSpirit',
      'psyshock',
      'wickedFear',
      'dopamine',
      'enervate',
      'disorient',
      'psionicWave',
      'breakWill',
      'packLeader',
      'umbraBolt',
      'wisp',
      'brainWard',
      'toxicSpores',
      'cerebralShock',
      'psychicBlow',
      'mentalFortress',
      'distort',
      'rootbind',
      'mindLeech',
      'leech', 'gash', 'bloodFrenzy',
    ],
    // Vex: Beast's Bleed column, with the Shadow it will turn into as the off-type — Fade Strike,
    // Backstab and Cutthroat, none of them on Vampyr's line.
    vex: [
      'lieInWait',
      'venomBite',
      'pounce',
      'prowl',
      'rally',
      'fadeStrike',
      'backstab',
      'lacerate',
      'bloodTrail',
      'maul',
      'toxicFangs',
      'gore',
      'cutthroat',
      'packHunt',
      'rendingLeap',
      'eviscerate',
      'apexPredator',
      'packLeader', 'gash', 'bloodFrenzy',
    ],
    // --- Starfall ---
    // Drift: Mind's magical column, with Water's clouding as the off-type. Mind Leech is Stinger's grant.
    drift: [
      'brainWard',
      'enervate', 'distort', 'dopamine', 'refresh', 'inkCloud',
      'psyshock', 'cerebralShock', 'stasis', 'hindsight', 'disorient', 'mentalFortress',
      'psionicWave', 'mindShatter', 'brainFlay', 'breakWill',
    ],
    // Igloo: Frost's walls and the Iron plate that props them up. Frost Wall is Glacier's grant.
    rimehold: [
      'mudBall',
      'deepChill', 'rimeCoat', 'hoarfrostEdge', 'snowBlast', 'pinDown', 'fortify',
      'icicleThrust', 'coldSnap', 'permafrost', 'glaciate', 'blindingSnow', 'reinforce',
      'iceShatter', 'avalanche', 'snowball', 'absoluteZero', 'frostArmor',
    ],
    // Carillon: Light's physical column and its guard. Consecrate is Great Bell's grant.
    carillon: [
      'radiantBlow',
      'vigil', 'purify', 'mend', 'blind', 'hallow', 'provoke', 'fortify', 'secondWind',
      'holySlice', 'sunlance', 'smite', 'radiance', 'benediction', 'shieldBash',
      'deityBlade', 'judgment', 'exalt', 'divineGrace',
    ],
    // Hart: Light's heal column, with Nature's growth as the off-type. Blinding Flash is White Hart's grant.
    hart: [
      'fullBloom',
      'hallow',
      'purify', 'bless', 'blind', 'vigil', 'refresh', 'regrowth',
      'dawnlight',
      'benediction', 'radiantBeam', 'radiance', 'consecrate', 'smite', 'wildBloom',
      'divineGrace', 'exalt', 'solarFlare', 'forceOfNature',
    ],
    // Ashwing: Fire's magical column with Light's and Water's mending beside it. Immolate is Firebird's grant.
    ashwing: [
      'flashpoint',
      'setAlight',
      'sparkFlash', 'flareUp', 'stokeTheFlames', 'vigil', 'purify', 'refresh',
      'scorch', 'spreadingBlaze', 'heatHaze', 'backdraft', 'benediction', 'cleansingRain',
      'inferno', 'firestorm', 'sparkBurst', 'divineGrace', 'highTide',
    ],
    // Kappa: Water's physical column and the Iron and Beast brawling around it. Oasis is Deep Pool's grant.
    kappa: [
      'claw',
      'siphon', 'tideGuard', 'heavyBlow', 'ironFist', 'rockToss', 'sharpen',
      'aquaSlice', 'engulf', 'lacerate', 'maul', 'momentumSwing', 'rendArmor',
      'waveShred', 'onslaught', 'eviscerate', 'rendingLeap', 'juggernaut', 'rainfall', 'drench',
    ],
    // Tusk: Frost's physical column with Iron's weight behind it. Snowball is Ice Age's grant.
    tusk: [
      'heavyBlow',
      'frostArmor', 'rimeCoat', 'pinDown', 'ironFist', 'sharpen', 'openingStrike',
      'icicleThrust', 'coldSnap', 'iceShell', 'momentumSwing', 'rendArmor', 'permafrost',
      'iceShatter', 'onslaught', 'swingingChain', 'frostWall', 'juggernaut',
    ],
    // Motley: Mind's debuffs and Light's blinding as the off-type. Psychic Blow is Harlequin's grant.
    motley: [
      'dopamine',
      'enervate', 'distort', 'brainWard', 'blind',
      'psyshock', 'wickedFear', 'cerebralShock', 'disorient', 'hindsight', 'mentalFortress',
      'psionicWave', 'brainFlay', 'breakWill', 'mindShatter',
    ],
    // Folio: Arcane's magical column, with Shadow's weakening as the off-type. Twin Cast is Magnum Opus's grant.
    folio: [
      'manaTap',
      'barrier', 'resonantBolt', 'manaFont', 'infuse', 'weaken',
      'arcaneBlast', 'arcPulse', 'overload', 'study', 'magicCloak',
      'singularity', 'cataclysm', 'arcaneOverflow', 'conduit',
    ],
    // Ronin: Iron's physical column, with Shadow's first strike and Spirit's flight as the off-types. Onslaught is Kensei's grant.
    ronin: [
      'ironArrow',
      'swiftBlow',
      'ironFist', 'openingStrike', 'pinDown', 'fortify', 'ironSkin',
      'shrapnel',
      'serratedSlice', 'rendArmor', 'momentumSwing', 'parry', 'shadowstrike',
      'juggernaut', 'swingingChain', 'wailingFlight',
    ],
    // Kong: Beast's physical column, with Stone's brace as the off-type. Pack Leader is Silverback's grant.
    kong: [
      'ivySpike',
      'pounce', 'venomBite', 'prowl', 'rally', 'mudBall', 'toughenUp', 'heavyBlow',
      'gore', 'rampage', 'thrash', 'packHunt', 'lacerate', 'maul', 'bloodTrail',
      'apexPredator', 'eviscerate', 'rendingLeap', 'titanicCrush', 'boulderSlam', 'gash', 'bloodFrenzy',
    ],
    // Morel: Nature's Poison column and Mind's dulling as the off-type. Wild Bloom is Toadstool's grant.
    morel: [
      'fullBloom',
      'umbraBolt',
      'weaken', 'regrowth', 'sow', 'lull', 'inkCloud', 'enervate',
      'blight', 'corrode', 'rootbind', 'magicGrowth', 'disorient', 'mindLeech',
      'miasma', 'forceOfNature', 'leech', 'breakWill', 'brainFlay',
    ],
    // Scree: Stone's guard column, the Defense swings, and Iron's pins. Rampart is Tor's grant.
    scree: [
      'fortify',
      'rockToss', 'toughenUp', 'mudBall', 'gravelSpray', 'openingStrike', 'pinDown',
      'spireClaw', 'bastion', 'retribution', 'bodyguard', 'faultLine', 'reinforce',
      'bodyCrush', 'stoneheart', 'boulderSlam', 'landslide', 'digIn', 'tectonicSlam',
    ],
    // Aurum: Light's physical column and Iron's weight behind it. Deity Blade is Sunlord's grant.
    aurum: [
      'claw',
      'hallow', 'vigil', 'purify', 'pounce', 'heavyBlow', 'openingStrike', 'sharpen',
      'holySlice', 'sunlance', 'consecrate', 'benediction', 'gore', 'serratedSlice', 'momentumSwing',
      'onslaught', 'apexPredator', 'juggernaut', 'divineGrace', 'exalt',
    ],
    // Jinx: Shadow's knives, with the cat's pounce and Iron's pins as the off-types. Shadowstrike is Black Cat's grant.
    jinx: [
      'pinDown',
      'hamstring', 'backstab', 'openingStrike', 'swiftBlow', 'claw', 'pounce',
      'shadowSlice', 'cutthroat', 'rend', 'smokeBomb', 'lacerate', 'rendArmor', 'maul',
      'duskBlade', 'thousandCuts', 'shadowForm', 'rendingLeap', 'eviscerate',
      'shadowsweep',
    ],
    // Kitsu: Spirit's magical column, with Arcane's bolts as the off-type. Banish is Ninetails' grant.
    kitsu: [
      'flashpoint',
      'unbound',
      'ember', 'drain', 'soulfire', 'secondWind', 'spite', 'magicBolt', 'focus',
      'soulRend', 'poltergeist', 'flicker', 'vengeance', 'soulOffering', 'arcPulse', 'arcaneBlast',
      'unquiet',
      'seance', 'lastRites', 'ascendant', 'twinCast', 'cataclysm',
      'requiem',
    ],
    // Tinder: Fire's magical Burn column, with Spirit's and Storm's quick casts as the off-types. Firestorm is Headliner's grant.
    tinder: [
      'flashpoint',
      'sparkFlash',
      'setAlight', 'flareUp', 'zap', 'unbound', 'wisp', 'spite',
      'scorch', 'spreadingBlaze', 'heatHaze', 'backdraft', 'immolate', 'flicker', 'stunningBolt',
      'sparkBurst', 'inferno', 'ionicZap', 'banish',
    ],
    // Selkie: Water's mending column, with Light's and Nature's healing beside it. High Tide is Tidewife's grant.
    selkie: [
      'fullBloom',
      'regrowth',
      'tideGuard', 'inkCloud', 'siphon', 'mend', 'purify', 'vigil',
      'oasis', 'washAway', 'cleansingRain', 'crest', 'engulf', 'benediction', 'wildBloom',
      'seawall', 'tsunami', 'divineGrace', 'overgrowth', 'rainfall', 'drench',
    ],
    // Hush: Frost's magical Freeze column, with Arcane's bolts and Light's glare as the off-types. Absolute Zero is Tundra Hunter's grant.
    hush: [
      'rimeWind',
      'snowBlast', 'hoarfrostEdge', 'rimeCoat', 'focus', 'manaTap', 'glimmer',
      'glaciate', 'quickFreeze', 'permafrost', 'blindingSnow', 'frigidAir', 'arcaneBlast', 'radiantBeam',
      'avalanche', 'cataclysm', 'solarFlare', 'twinCast', 'magicBolt',
    ],
    // Lotus: Nature's magical column, with Arcane's and Light's nukes as the off-types. Force of Nature is Thousand Petals' grant.
    lotus: [
      'fullBloom',
      'psiBolt',
      'sow', 'toxicSpores', 'focus', 'magicBolt', 'glimmer', 'bless',
      'corrode', 'blight', 'magicGrowth', 'wildBloom', 'rootbind', 'radiantBeam', 'arcaneBlast',
      'leech', 'miasma', 'overgrowth', 'solarFlare', 'cataclysm',
      'greenwood',
    ],
    // Nimbus: Storm's magical column, with Water's rain as the off-type. Ionic Zap is Anvilhead's grant.
    nimbus: [
      'charge',
      'risingStatic', 'staticCharge', 'zap', 'tideGuard', 'splash', 'undercurrent',
      'arcFlash',
      'chainLightning', 'stunningBolt', 'ionize', 'electricBurst', 'shockBubble', 'cleansingRain', 'torrent',
      'thunderbolt', 'ionCascade', 'tsunami', 'highTide',
    ],
    // Kite: Storm's marks and tailwinds, with the Beast howl, Water's ink and the Frost and Mind guards beside them. Chain Lightning is Highflyer's grant.
    kite: [
      'batteryPack',
      'zap',
      'toxicSpores', 'charge', 'howl', 'refresh', 'inkCloud', 'brainWard',
      'tailwind', 'ionize', 'stunningBolt', 'blindingSnow', 'electricBurst', 'mentalFortress',
      'stormSurge', 'thunderbolt', 'ionCascade', 'ionicZap',
    ],
    // Raiju: Storm's physical column and every pivot on the table, with Iron's and Shadow's quick blades. Shock Slice is Kaminari's grant.
    raiju: [
      'prowl',
      'swiftBlow', 'openingStrike', 'hamstring', 'sharpen', 'mudBall', 'heavyBlow',
      'rideTheLightning', 'stormLash', 'tailwind', 'livingWall', 'rendArmor', 'shadowstrike',
      'skyfall', 'overcharge', 'stormSurge', 'juggernaut',
    ],
    // Dune: Stone's physical column, with Iron's pins and weight, and Thunderclap — the one Storm
    // move a Stone hero can learn, Stone's answer to Iron. Body Crush is Worldworm's grant.
    dune: [
      'toughenUp',
      'mudBall', 'gravelSpray', 'openingStrike', 'pinDown', 'fortify', 'heavyBlow', 'thunderclap',
      'faultLine', 'rubbleRush', 'spireClaw', 'rendArmor', 'momentumSwing', 'retribution',
      'boulderSlam', 'titanicCrush', 'stoneheart', 'swingingChain', 'digIn', 'tectonicSlam',
    ],
    // Cairn: Stone's guard column, Light's mending beside it, and Stone's magical spread. Body Blow is Menhir's grant.
    cairn: [
      'tideGuard',
      'mudBall', 'provoke', 'vigil', 'mend', 'purify',
      'bastion', 'bodyguard', 'rockfall', 'benediction', 'consecrate',
      'rampart', 'landslide', 'divineGrace', 'digIn', 'tectonicSlam',
    ],
    // Murk: Shadow's physical column with Stone's mud and Nature's moss as the off-types. Shadowstrike is Lurker's grant.
    murk: [
      'toughenUp',
      'fadeStrike', 'backstab', 'mudBall', 'vineLash', 'pinDown',
      'knifeFan',
      'shadowSlice', 'rend', 'smokeBomb', 'rubbleRush', 'thornWhip',
      'duskBlade', 'shadowForm', 'boulderSlam', 'thousandCuts',
    ],
    // Rook: Shadow's magical column, with Mind's hexes as the off-type. Enfeeble is Coven's grant.
    rook: [
      'torment',
      'lull', 'enervate', 'inkCloud', 'distort',
      'umbralBeam', 'wickedFear', 'disorient', 'mindLeech',
      'eclipse', 'umbralWave', 'grimHarvest', 'breakWill',
    ],
    // Koan: Mind has no fists, so Iron's and Stone's counters and Shadow's first strike carry him. Psychokinesis is Third Eye's grant.
    koan: [
      'openingStrike',
      'swiftBlow', 'heavyBlow', 'enervate', 'ironSkin',
      'parry', 'retribution', 'shadowstrike', 'momentumSwing', 'mentalFortress', 'rendArmor',
      'stoneheart', 'onslaught', 'juggernaut', 'fortify',
    ],
    // Thane: Arcane's physical column and its mana buffs, with Iron's blades beside them. Arcane Overflow is Spellsword's grant.
    thane: [
      'sharpen',
      'ironFist', 'openingStrike', 'fortify', 'pinDown', 'infuse', 'manaFont',
      'wardblade', 'magicCloak', 'empower', 'momentumSwing', 'rendArmor', 'serratedSlice', 'parry',
      'conduit', 'onslaught', 'juggernaut', 'swingingChain', 'wailingFlight',
    ],
    // Trove: the bait-and-bite of Stone's guard column, with Arcane's pool-sharing. Font of Power is Bottomless Chest's grant.
    trove: [
      'fortify',
      'barrier', 'manaTap', 'mudBall', 'toughenUp', 'pinDown', 'rockToss',
      'wardblade', 'magicCloak', 'empower', 'bodyguard', 'bodyBlow', 'retribution', 'spireClaw',
      'arcaneOverflow', 'stoneheart', 'onslaught', 'bodyCrush', 'conduit',
    ],
    // Totem: Spirit's support and every type's ally buffs. Banish is Elder Pole's grant.
    totem: [
      'spite',
      'torment', 'secondWind', 'soulfire', 'frostArmor', 'brainWard', 'mend', 'tideGuard',
      'soulOffering', 'poltergeist', 'soulRend', 'reinforce', 'mentalFortress', 'bastion', 'radiance',
      'seance', 'highTide', 'stormSurge', 'frostWall', 'exalt',
    ],
    // Keen: Spirit's magical column, with every other type's spreads as the off-type. Last Rites is Harbinger's grant.
    keen: [
      'rimeWind',
      'drain', 'spite', 'unbound', 'soulfire', 'inkCloud', 'sparkFlash', 'tremor',
      'willOWisp',
      'soulRend', 'poltergeist', 'flicker', 'arcPulse', 'disorient', 'deluge', 'backdraft',
      'seance', 'banish', 'ascendant', 'psionicWave', 'cataclysm', 'maelstrom',
      'requiem',
    ],
    // Ferra: Iron's one magical row is Conjured Sword, kept off every pool (test/ironMoves), so Storm's current and Arcane's bolts carry her. Conjured Sword is Magnetar's grant.
    ferra: [
      'magicBolt',
      'charge', 'zap', 'focus', 'fortify', 'barrier', 'manaTap',
      'electricBurst', 'stunningBolt', 'arcaneBlast', 'arcPulse', 'livingWall', 'study', 'reinforce',
      'thunderbolt', 'cataclysm', 'twinCast', 'singularity',
    ],
    // Abacus: Mech's magical column with Mind's reading of the far side; Distort sets the Stasis Field Hindsight reads. Perfect Creation is Difference Engine's grant.
    abacus: [
      'batteryPack',
      'repairKit',
      'psiBolt',
      'kickstart', 'lull', 'focus', 'enervate', 'magicBolt', 'overclock',
      'overheat', 'malfunction', 'salvage', 'hindsight', 'cerebralShock', 'stasis', 'psyshock',
      'meltdown', 'psionicWave', 'brainFlay', 'mindShatter',
    ],
    // Whirr: Mech's physical column with Storm's darting and Iron's quick blows; Spark Plug plants what Overcharge and Whirling Blades run on. Overdrive is Gyre's grant.
    whirr: [
      'ironArrow',
      'rocketPod',
      'swiftBlow',
      'cogBop', 'steamVent', 'sparkPlug', 'thunderclap', 'openingStrike', 'pinDown',
      'whirlingBlades', 'shockCoil', 'cogSlam', 'shockSlice', 'rideTheLightning', 'momentumSwing',
      'salvo', 'jackpot', 'overcharge', 'skyfall', 'onslaught',
    ],
    // Mellow: Beast's rallying with Water's and Nature's mending and Stone's guard beside it. Reinforce is Gentle Giant's grant.
    mellow: [
      'refresh',
      'rally', 'claw', 'tideGuard', 'regrowth', 'toughenUp', 'provoke',
      'bodyguard', 'washAway', 'oasis', 'cleansingRain', 'bastion', 'wildBloom', 'packHunt',
      'highTide', 'rampart', 'overgrowth', 'seawall', 'gash', 'bloodFrenzy',
    ],
    // The companion's bodies (run/companion.ts): a spawn's pool is its type's whole slate, so
    // the schedule gates it by band like anyone's. No Evolution node — its Mastery pips are its
    // tier-steps instead.
    ...spawnMoveTiers,
};

/** Moves an Evolution's line takes from each of these tiers: a hit and a tool, in slate order. */
export const EVOLUTION_LINE_TIERS = ['mid', 'late'] as const;
export const EVOLUTION_LINE_PER_TIER = 2;

/**
 * The line an Evolution opens, by rule rather than by list (docs/evolution-simplification.md §3):
 * of the tiered moves of `type` the hero's own pool does not already hold — damage only on the
 * column the hero swings with after the path (flipped by a rewire), minus what the path hands
 * over — two from Mid and two from Late, one damage move and one other where the tier has both.
 * A rewire takes a second damage move a tier: its hero's own attacks are all on the wrong stat.
 */
export function evolutionLine(heroId: string, type: TypeId, { swapped = false, granted = [] as readonly string[] } = {}): string[] {
  const hero = heroes[heroId];
  const physical = hero.baseStats.attack >= hero.baseStats.intelligence !== swapped;
  const own = new Set([...hero.moveIds, ...(moveTiers[heroId] ?? []), ...granted]);
  const open = spawnSlate(type).filter((id) => {
    const move = moves[id];
    if (own.has(id)) return false;
    return move.kind !== 'damage' || move.category === (physical ? 'physical' : 'magical');
  });
  return EVOLUTION_LINE_TIERS.flatMap((tier) => {
    const inTier = open.filter((id) => moves[id].tier === tier);
    const hits = inTier.filter((id) => moves[id].kind === 'damage').slice(0, swapped ? 2 : 1);
    const tool = inTier.find((id) => moves[id].kind !== 'damage');
    const picked = [...hits, tool].filter((id): id is string => !!id);
    for (const id of inTier) if (picked.length < EVOLUTION_LINE_PER_TIER && !picked.includes(id)) picked.push(id);
    return open.filter((id) => picked.includes(id));
  });
}

export const progressionTable: ProgressionTable = {
  moveTiers,
  evolutions: {
    // --- Fire ---
    cinderKnight: [
      {
        paths: [
          {
            id: 'cinderKnight-explosive',
            heroId: 'cinderKnight',
            name: 'Explosive',
            // The simplified framework's pilot (docs/evolution-simplification.md): Move + Passive,
            // the rewire on top. Ironclad is Type + Passive, Thunderblaze Type + Move.
            swapsOffense: true,
            unlocksMoveIds: ['immolate'],
            grantsPassiveIds: ['rekindle'],
            learnableMoveIds: evolutionLine('cinderKnight', 'Fire', { swapped: true, granted: ['immolate'] }),
          },
          {
            id: 'cinderKnight-ironclad',
            heroId: 'cinderKnight',
            name: 'Ironclad',
            unlocksMoveIds: [],
            typeGraft: 'Iron',
            learnableMoveIds: evolutionLine('cinderKnight', 'Iron'),
            grantsPassiveIds: ['cinderguard'],
          },
          {
            id: 'cinderKnight-thunderblaze',
            heroId: 'cinderKnight',
            name: 'Thunderblaze',
            unlocksMoveIds: ['stormLash'],
            typeGraft: 'Storm',
            learnableMoveIds: evolutionLine('cinderKnight', 'Storm', { granted: ['stormLash'] }),
          },
        ],
      },
    ],
    crimson: [
      {
        paths: [
          {
            id: 'crimson-pyroclasm',
            heroId: 'crimson',
            name: 'Pyroclasm',
            // Two passives, no move (2026-10-07, per user direction): the field it lights, and the side it spares.
            unlocksMoveIds: [],
            grantsPassiveIds: ['firestarter', 'flameproof'],
          },
          {
            id: 'crimson-cinderveil',
            heroId: 'crimson',
            name: 'Cinderveil',
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
            learnableMoveIds: evolutionLine('crimson', 'Spirit'),
            grantsPassiveIds: ['emberVeil'],
          },
          {
            id: 'crimson-emberweave',
            heroId: 'crimson',
            name: 'Emberweave',
            unlocksMoveIds: ['arcPulse'],
            typeGraft: 'Arcane',
            learnableMoveIds: evolutionLine('crimson', 'Arcane', { granted: ['arcPulse'] }),
          },
        ],
      },
    ],
    brimstone: [
      {
        paths: [
          {
            id: 'brimstone-rotflame',
            heroId: 'brimstone',
            name: 'Rotflame',
            // The keeper: Fire/Shadow stays, and Eclipse is the Shadow Late the two retypes trade away.
            unlocksMoveIds: ['eclipse'],
            grantsPassiveIds: ['witchsBrew'],
          },
          {
            id: 'brimstone-ashguard',
            heroId: 'brimstone',
            name: 'Ashguard',
            unlocksMoveIds: ['rockfall'],
            typeGraft: 'Stone',
            learnableMoveIds: evolutionLine('brimstone', 'Stone', { granted: ['rockfall'] }),
            grantsPassiveIds: ['ashfeast'],
          },
          {
            id: 'brimstone-hexfume',
            heroId: 'brimstone',
            name: 'Hexfume',
            unlocksMoveIds: ['blight'],
            typeGraft: 'Nature',
            learnableMoveIds: evolutionLine('brimstone', 'Nature', { granted: ['blight'] }),
            grantsPassiveIds: ['hexfume'],
          },
        ],
      },
    ],
    drake: [
      {
        paths: [
          {
            id: 'drake-hoardwyrm',
            heroId: 'drake',
            name: 'Hoardwyrm',
            unlocksMoveIds: ['juggernaut'],
            grantsPassiveIds: ['hoard'],
          },
          {
            id: 'drake-wyvern',
            heroId: 'drake',
            name: 'Wyvern',
            unlocksMoveIds: ['shockSlice'],
            typeGraft: 'Storm',
            learnableMoveIds: evolutionLine('drake', 'Storm', { granted: ['shockSlice'] }),
          },
          {
            id: 'drake-cinderscale',
            heroId: 'drake',
            name: 'Cinderscale',
            unlocksMoveIds: [],
            typeGraft: 'Stone',
            learnableMoveIds: evolutionLine('drake', 'Stone'),
            grantsPassiveIds: ['magmaHide'],
          },
        ],
      },
    ],
    // --- Water ---
    tidecaller: [
      {
        paths: [
          {
            id: 'tidecaller-tidecaller',
            heroId: 'tidecaller',
            name: 'Tidecaller',
            // A Late Water spread off Riptide's own pool (test/roster.test.ts).
            unlocksMoveIds: ['maelstrom'],
            grantsPassiveIds: ['swell'],
          },
          {
            id: 'tidecaller-frostbound',
            heroId: 'tidecaller',
            name: 'Frostbound',
            unlocksMoveIds: ['permafrost'],
            typeGraft: 'Frost',
            learnableMoveIds: evolutionLine('tidecaller', 'Frost', { granted: ['permafrost'] }),
          },
          {
            id: 'tidecaller-siren',
            heroId: 'tidecaller',
            name: 'Siren',
            unlocksMoveIds: [],
            typeGraft: 'Mind',
            learnableMoveIds: evolutionLine('tidecaller', 'Mind'),
            grantsPassiveIds: ['enthrall'],
          },
        ],
      },
    ],
    pincer: [
      {
        paths: [
          {
            id: 'pincer-tideclaw',
            heroId: 'pincer',
            name: 'Tideclaw',
            // Off-type on the mono path on purpose: an Iron hit is the detonator Static Tide's mark wants.
            unlocksMoveIds: ['metallicBlade'],
            grantsPassiveIds: ['staticTide'],
          },
          {
            id: 'pincer-ironshell',
            heroId: 'pincer',
            name: 'Ironshell',
            unlocksMoveIds: [],
            typeGraft: 'Iron',
            learnableMoveIds: evolutionLine('pincer', 'Iron'),
            grantsPassiveIds: ['plating'],
          },
          {
            id: 'pincer-squallshell',
            heroId: 'pincer',
            name: 'Squallshell',
            unlocksMoveIds: ['stormLash'],
            typeGraft: 'Storm',
            learnableMoveIds: evolutionLine('pincer', 'Storm', { granted: ['stormLash'] }),
          },
        ],
      },
    ],
    leviathan: [
      {
        paths: [
          {
            id: 'leviathan-tidebreaker',
            heroId: 'leviathan',
            name: 'Tidebreaker',
            unlocksMoveIds: ['tsunami'],
            grantsPassiveIds: ['tidalMass'],
          },
          {
            id: 'leviathan-deepfrost',
            heroId: 'leviathan',
            name: 'Deepfrost',
            unlocksMoveIds: ['glaciate'],
            typeGraft: 'Frost',
            learnableMoveIds: evolutionLine('leviathan', 'Frost', { granted: ['glaciate'] }),
            grantsPassiveIds: ['deepfrostRain'],
          },
          {
            id: 'leviathan-stormwyrm',
            heroId: 'leviathan',
            name: 'Stormwyrm',
            unlocksMoveIds: [],
            typeGraft: 'Storm',
            learnableMoveIds: evolutionLine('leviathan', 'Storm'),
            grantsPassiveIds: ['stormDrinker'],
          },
        ],
      },
    ],
    nautilus: [
      {
        paths: [
          {
            id: 'nautilus-deepgrip',
            heroId: 'nautilus',
            name: 'Deepgrip',
            unlocksMoveIds: ['breakWill'],
            grantsPassiveIds: ['deepgrip'],
          },
          {
            id: 'nautilus-inkmind',
            heroId: 'nautilus',
            name: 'Inkmind',
            unlocksMoveIds: [],
            typeGraft: 'Mind',
            learnableMoveIds: evolutionLine('nautilus', 'Mind'),
            grantsPassiveIds: ['inkCloud'],
          },
          {
            id: 'nautilus-mimic',
            heroId: 'nautilus',
            name: 'Mimic',
            unlocksMoveIds: ['enfeeble'],
            typeGraft: 'Shadow',
            learnableMoveIds: evolutionLine('nautilus', 'Shadow', { granted: ['enfeeble'] }),
          },
        ],
      },
    ],
    // --- Frost ---
    glacialWarden: [
      {
        paths: [
          {
            id: 'glacialWarden-avalanche',
            heroId: 'glacialWarden',
            name: 'Avalanche',
            // Two passives, no move (2026-10-08, per user direction): freeze on the Rest, grow on the freeze.
            unlocksMoveIds: [],
            grantsPassiveIds: ['killingFrost', 'snowfall'],
          },
          {
            id: 'glacialWarden-blizzard',
            heroId: 'glacialWarden',
            name: 'Blizzard',
            unlocksMoveIds: [],
            typeGraft: 'Storm',
            learnableMoveIds: evolutionLine('glacialWarden', 'Storm'),
            grantsPassiveIds: ['bedrockIce'],
          },
          {
            id: 'glacialWarden-snowSpirit',
            heroId: 'glacialWarden',
            name: 'Snow Spirit',
            unlocksMoveIds: ['soulRend'],
            typeGraft: 'Spirit',
            learnableMoveIds: evolutionLine('glacialWarden', 'Spirit', { granted: ['soulRend'] }),
          },
        ],
      },
    ],
    rime: [
      {
        paths: [
          {
            id: 'rime-snowbound',
            heroId: 'rime',
            name: 'Snowbound',
            unlocksMoveIds: ['snowball'],
            grantsPassiveIds: ['rollingSnow'],
          },
          {
            id: 'rime-hoarsteel',
            heroId: 'rime',
            name: 'Hoarsteel',
            unlocksMoveIds: ['reinforce'],
            typeGraft: 'Iron',
            learnableMoveIds: evolutionLine('rime', 'Iron', { granted: ['reinforce'] }),
            grantsPassiveIds: ['frozenStone'],
          },
          {
            id: 'rime-hydrofreeze',
            heroId: 'rime',
            name: 'Hydrofreeze',
            unlocksMoveIds: ['aquaSlice'],
            typeGraft: 'Water',
            learnableMoveIds: evolutionLine('rime', 'Water', { granted: ['aquaSlice'] }),
          },
        ],
      },
    ],
    cube: [
      {
        paths: [
          {
            id: 'cube-shatterframe',
            heroId: 'cube',
            name: 'Shatterframe',
            unlocksMoveIds: ['iceShell'],
            grantsPassiveIds: ['coldForge'],
          },
          {
            id: 'cube-icebreaker',
            heroId: 'cube',
            name: 'Icebreaker',
            unlocksMoveIds: [],
            typeGraft: 'Mech',
            learnableMoveIds: evolutionLine('cube', 'Mech'),
            grantsPassiveIds: ['coldHousing'],
          },
          {
            id: 'cube-cryolattice',
            heroId: 'cube',
            name: 'Cryolattice',
            unlocksMoveIds: ['wardblade'],
            typeGraft: 'Arcane',
            learnableMoveIds: evolutionLine('cube', 'Arcane', { granted: ['wardblade'] }),
          },
        ],
      },
    ],
    // --- Storm ---
    stormRanger: [
      {
        paths: [
          {
            id: 'stormRanger-windshear',
            heroId: 'stormRanger',
            name: 'Windshear',
            unlocksMoveIds: ['skyfall'],
            grantsPassiveIds: ['squallLine'],
          },
          {
            id: 'stormRanger-dustDevil',
            heroId: 'stormRanger',
            name: 'Dust Devil',
            unlocksMoveIds: [],
            typeGraft: 'Stone',
            learnableMoveIds: evolutionLine('stormRanger', 'Stone'),
            grantsPassiveIds: ['thornshot'],
          },
          {
            id: 'stormRanger-turbine',
            heroId: 'stormRanger',
            name: 'Turbine',
            unlocksMoveIds: ['cogSlam'],
            typeGraft: 'Mech',
            learnableMoveIds: evolutionLine('stormRanger', 'Mech', { granted: ['cogSlam'] }),
          },
        ],
      },
    ],
    tempest: [
      {
        paths: [
          {
            id: 'tempest-lightningRod',
            heroId: 'tempest',
            name: 'Lightning Rod',
            // Not a rewire: at 70/70 a swap trades nothing. The line reads the physical column, Attack >= Intelligence.
            unlocksMoveIds: ['metallicBlade'],
            typeGraft: 'Iron',
            learnableMoveIds: evolutionLine('tempest', 'Iron', { granted: ['metallicBlade'] }),
          },
          {
            id: 'tempest-ionosphere',
            heroId: 'tempest',
            name: 'Ionosphere',
            unlocksMoveIds: [],
            typeGraft: 'Arcane',
            learnableMoveIds: evolutionLine('tempest', 'Arcane'),
            grantsPassiveIds: ['storedCharge'],
          },
          {
            id: 'tempest-forked',
            heroId: 'tempest',
            name: 'Forked',
            // The mixed path (docs/combat.md "Either Hand"): stays 70/70 and makes alternating pay.
            unlocksMoveIds: ['skyfall'],
            grantsPassiveIds: ['eitherHand'],
          },
        ],
      },
    ],
    skyshear: [
      {
        paths: [
          {
            id: 'skyshear-stormeye',
            heroId: 'skyshear',
            name: 'Stormeye',
            unlocksMoveIds: ['tailwind'],
            grantsPassiveIds: ['chargedAir'],
          },
          {
            id: 'skyshear-rimewing',
            heroId: 'skyshear',
            name: 'Rimewing',
            unlocksMoveIds: [],
            typeGraft: 'Frost',
            learnableMoveIds: evolutionLine('skyshear', 'Frost'),
            grantsPassiveIds: ['hailstrike'],
          },
          {
            id: 'skyshear-farsight',
            heroId: 'skyshear',
            name: 'Farsight',
            unlocksMoveIds: ['psyshock'],
            typeGraft: 'Mind',
            learnableMoveIds: evolutionLine('skyshear', 'Mind', { granted: ['psyshock'] }),
          },
        ],
      },
    ],
    // --- Stone ---
    crag: [
      {
        paths: [
          {
            id: 'crag-stonebreaker',
            heroId: 'crag',
            name: 'Stonebreaker',
            unlocksMoveIds: ['titanicCrush'],
            grantsPassiveIds: ['bury'],
          },
          {
            id: 'crag-mountainheart',
            heroId: 'crag',
            name: 'Mountainheart',
            unlocksMoveIds: ['juggernaut'],
            typeGraft: 'Iron',
            learnableMoveIds: evolutionLine('crag', 'Iron', { granted: ['juggernaut'] }),
          },
          {
            id: 'crag-rootwarden',
            heroId: 'crag',
            name: 'Rootwarden',
            unlocksMoveIds: [],
            typeGraft: 'Nature',
            learnableMoveIds: evolutionLine('crag', 'Nature'),
            grantsPassiveIds: ['unstoppableGrowth'],
          },
        ],
      },
    ],
    sentinel: [
      {
        paths: [
          {
            id: 'sentinel-talonguard',
            heroId: 'sentinel',
            name: 'Talonguard',
            unlocksMoveIds: ['bodyCrush'],
            grantsPassiveIds: ['gatheringWeight'],
          },
          {
            id: 'sentinel-cathedral',
            heroId: 'sentinel',
            name: 'Cathedral',
            unlocksMoveIds: ['juggernaut'],
            typeGraft: 'Iron',
            learnableMoveIds: evolutionLine('sentinel', 'Iron', { granted: ['juggernaut'] }),
          },
          {
            id: 'sentinel-gloomwatch',
            heroId: 'sentinel',
            name: 'Gloomwatch',
            unlocksMoveIds: [],
            typeGraft: 'Shadow',
            learnableMoveIds: evolutionLine('sentinel', 'Shadow'),
            grantsPassiveIds: ['nightVigil'],
          },
        ],
      },
    ],
    slate: [
      {
        paths: [
          {
            id: 'slate-quakebringer',
            heroId: 'slate',
            name: 'Quakebringer',
            unlocksMoveIds: ['titanicCrush'],
            grantsPassiveIds: ['aftershock'],
          },
          {
            id: 'slate-magma',
            heroId: 'slate',
            name: 'Magma',
            unlocksMoveIds: ['scorch'],
            typeGraft: 'Fire',
            learnableMoveIds: evolutionLine('slate', 'Fire', { granted: ['scorch'] }),
          },
          {
            id: 'slate-runestone',
            heroId: 'slate',
            name: 'Runestone',
            unlocksMoveIds: [],
            typeGraft: 'Arcane',
            learnableMoveIds: evolutionLine('slate', 'Arcane'),
            grantsPassiveIds: ['runicWard'],
          },
        ],
      },
    ],
    // --- Nature ---
    wildOracle: [
      {
        paths: [
          {
            id: 'wildOracle-druid',
            heroId: 'wildOracle',
            name: 'Druid',
            swapsOffense: true,
            unlocksMoveIds: ['thrash'],
            typeGraft: 'Beast',
            learnableMoveIds: evolutionLine('wildOracle', 'Beast', { swapped: true, granted: ['thrash'] }),
          },
          {
            id: 'wildOracle-lightsage',
            heroId: 'wildOracle',
            name: 'Lightsage',
            unlocksMoveIds: [],
            typeGraft: 'Light',
            learnableMoveIds: evolutionLine('wildOracle', 'Light'),
            grantsPassiveIds: ['naturesPurification'],
          },
          {
            id: 'wildOracle-apothecary',
            heroId: 'wildOracle',
            name: 'Apothecary',
            unlocksMoveIds: ['highTide'],
            grantsPassiveIds: ['restorativeToxin'],
          },
        ],
      },
    ],
    mordax: [
      {
        paths: [
          {
            id: 'mordax-bloomfang',
            heroId: 'mordax',
            name: 'Bloomfang',
            unlocksMoveIds: ['toxicFangs'],
            grantsPassiveIds: ['thornrot'],
          },
          {
            id: 'mordax-ironbark',
            heroId: 'mordax',
            name: 'Ironbark',
            unlocksMoveIds: ['bastion'],
            typeGraft: 'Stone',
            learnableMoveIds: evolutionLine('mordax', 'Stone', { granted: ['bastion'] }),
          },
          {
            id: 'mordax-wildheart',
            heroId: 'mordax',
            name: 'Wildheart',
            unlocksMoveIds: [],
            typeGraft: 'Beast',
            learnableMoveIds: evolutionLine('mordax', 'Beast'),
            grantsPassiveIds: ['feralRend'],
          },
        ],
      },
    ],
    hollowbark: [
      {
        paths: [
          {
            id: 'hollowbark-thornheart',
            heroId: 'hollowbark',
            name: 'Thornheart',
            unlocksMoveIds: ['wildBloom'],
            grantsPassiveIds: ['heartwood'],
          },
          {
            id: 'hollowbark-rootstone',
            heroId: 'hollowbark',
            name: 'Rootstone',
            unlocksMoveIds: [],
            typeGraft: 'Stone',
            learnableMoveIds: evolutionLine('hollowbark', 'Stone'),
            grantsPassiveIds: ['petrified'],
          },
          {
            id: 'hollowbark-wraithwood',
            heroId: 'hollowbark',
            name: 'Wraithwood',
            swapsOffense: true,
            unlocksMoveIds: ['poltergeist'],
            typeGraft: 'Spirit',
            learnableMoveIds: evolutionLine('hollowbark', 'Spirit', { swapped: true, granted: ['poltergeist'] }),
          },
        ],
      },
    ],
    tixwick: [
      {
        paths: [
          {
            id: 'tixwick-reaper',
            heroId: 'tixwick',
            name: 'Reaper',
            unlocksMoveIds: ['serratedSlice'],
            typeGraft: 'Iron',
            learnableMoveIds: evolutionLine('tixwick', 'Iron', { granted: ['serratedSlice'] }),
          },
          {
            id: 'tixwick-orchid',
            heroId: 'tixwick',
            name: 'Orchid',
            unlocksMoveIds: ['provoke'],
            grantsPassiveIds: ['lure'],
          },
          {
            id: 'tixwick-ghostMantis',
            heroId: 'tixwick',
            name: 'Ghost Mantis',
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
            learnableMoveIds: evolutionLine('tixwick', 'Spirit'),
            grantsPassiveIds: ['deadLeaf'],
          },
        ],
      },
    ],
    // --- Light ---
    dawnwarden: [
      {
        paths: [
          {
            id: 'dawnwarden-sunflare',
            heroId: 'dawnwarden',
            name: 'Sunflare',
            unlocksMoveIds: ['scorch'],
            typeGraft: 'Fire',
            learnableMoveIds: evolutionLine('dawnwarden', 'Fire', { granted: ['scorch'] }),
          },
          {
            id: 'dawnwarden-solstice',
            heroId: 'dawnwarden',
            name: 'Solstice',
            unlocksMoveIds: [],
            typeGraft: 'Frost',
            learnableMoveIds: evolutionLine('dawnwarden', 'Frost'),
            grantsPassiveIds: ['rimeMantle'],
          },
          {
            id: 'dawnwarden-dawnherald',
            heroId: 'dawnwarden',
            name: 'Dawnherald',
            unlocksMoveIds: ['highTide'],
            grantsPassiveIds: ['afterglow'],
          },
        ],
      },
    ],
    aegis: [
      {
        paths: [
          {
            id: 'aegis-vanguard',
            heroId: 'aegis',
            name: 'Vanguard',
            unlocksMoveIds: ['deityBlade'],
            grantsPassiveIds: ['answeringBlade'],
          },
          {
            id: 'aegis-warforged',
            heroId: 'aegis',
            name: 'Warforged',
            unlocksMoveIds: [],
            typeGraft: 'Mech',
            learnableMoveIds: evolutionLine('aegis', 'Mech'),
            grantsPassiveIds: ['shieldbearer'],
          },
          {
            id: 'aegis-verdantOath',
            heroId: 'aegis',
            name: 'Verdant Oath',
            unlocksMoveIds: ['wildBloom'],
            typeGraft: 'Nature',
            learnableMoveIds: evolutionLine('aegis', 'Nature', { granted: ['wildBloom'] }),
          },
        ],
      },
    ],
    empyrean: [
      {
        paths: [
          {
            id: 'empyrean-sunborne',
            heroId: 'empyrean',
            name: 'Sunborne',
            unlocksMoveIds: ['solarFlare'],
            grantsPassiveIds: ['sunblind'],
          },
          {
            id: 'empyrean-stormwing',
            heroId: 'empyrean',
            name: 'Stormwing',
            unlocksMoveIds: ['electricBurst'],
            typeGraft: 'Storm',
            learnableMoveIds: evolutionLine('empyrean', 'Storm', { granted: ['electricBurst'] }),
          },
          {
            id: 'empyrean-seraph',
            heroId: 'empyrean',
            name: 'Seraph',
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
            learnableMoveIds: evolutionLine('empyrean', 'Spirit'),
            grantsPassiveIds: ['radiantVessel'],
          },
        ],
      },
    ],
    // --- Shadow ---
    widow: [
      {
        paths: [
          {
            id: 'widow-venomfang',
            heroId: 'widow',
            name: 'Venomfang',
            unlocksMoveIds: ['grimHarvest'],
            grantsPassiveIds: ['widowsKiss'],
          },
          {
            id: 'widow-carapace',
            heroId: 'widow',
            name: 'Carapace',
            unlocksMoveIds: ['apexPredator'],
            typeGraft: 'Beast',
            learnableMoveIds: evolutionLine('widow', 'Beast', { granted: ['apexPredator'] }),
          },
          {
            id: 'widow-silkbinder',
            heroId: 'widow',
            name: 'Silkbinder',
            unlocksMoveIds: [],
            typeGraft: 'Nature',
            learnableMoveIds: evolutionLine('widow', 'Nature'),
            grantsPassiveIds: ['snare'],
          },
        ],
      },
    ],
    marrow: [
      {
        paths: [
          {
            id: 'marrow-carrion',
            heroId: 'marrow',
            name: 'Carrion',
            unlocksMoveIds: ['eclipse'],
            grantsPassiveIds: ['festering'],
          },
          {
            id: 'marrow-ossuary',
            heroId: 'marrow',
            name: 'Ossuary',
            unlocksMoveIds: ['blight'],
            typeGraft: 'Nature',
            learnableMoveIds: evolutionLine('marrow', 'Nature', { granted: ['blight'] }),
          },
          {
            id: 'marrow-ashenwell',
            heroId: 'marrow',
            name: 'Ashenwell',
            unlocksMoveIds: [],
            typeGraft: 'Fire',
            learnableMoveIds: evolutionLine('marrow', 'Fire'),
            grantsPassiveIds: ['ashenPyre'],
          },
        ],
      },
    ],
    nightshade: [
      {
        paths: [
          {
            id: 'nightshade-blackout',
            heroId: 'nightshade',
            name: 'Blackout',
            unlocksMoveIds: [],
            typeGraft: 'Storm',
            learnableMoveIds: evolutionLine('nightshade', 'Storm'),
            grantsPassiveIds: ['eitherHand'],
          },
          {
            id: 'nightshade-penumbra',
            heroId: 'nightshade',
            name: 'Penumbra',
            unlocksMoveIds: ['eclipse'],
            grantsPassiveIds: ['halfSeen'],
          },
          {
            id: 'nightshade-hemlock',
            heroId: 'nightshade',
            name: 'Hemlock',
            swapsOffense: true,
            unlocksMoveIds: ['corrode'],
            typeGraft: 'Nature',
            learnableMoveIds: evolutionLine('nightshade', 'Nature', { swapped: true, granted: ['corrode'] }),
          },
        ],
      },
    ],
    // --- Arcane ---
    runescribe: [
      {
        paths: [
          {
            id: 'runescribe-thaumaturge',
            heroId: 'runescribe',
            name: 'Thaumaturge',
            unlocksMoveIds: ['fontOfPower'],
            grantsPassiveIds: ['overspill'],
          },
          {
            id: 'runescribe-machinist',
            heroId: 'runescribe',
            name: 'Machinist',
            unlocksMoveIds: [],
            typeGraft: 'Mech',
            learnableMoveIds: evolutionLine('runescribe', 'Mech'),
            grantsPassiveIds: ['capacitor'],
          },
          {
            id: 'runescribe-blackletter',
            heroId: 'runescribe',
            name: 'Blackletter',
            unlocksMoveIds: ['enfeeble'],
            typeGraft: 'Shadow',
            learnableMoveIds: evolutionLine('runescribe', 'Shadow', { granted: ['enfeeble'] }),
          },
        ],
      },
    ],
    zenith: [
      {
        paths: [
          {
            id: 'zenith-apex',
            heroId: 'zenith',
            name: 'Apex',
            unlocksMoveIds: ['singularity'],
            grantsPassiveIds: ['apogee'],
          },
          {
            id: 'zenith-halo',
            heroId: 'zenith',
            name: 'Halo',
            unlocksMoveIds: ['consecrate'],
            typeGraft: 'Light',
            learnableMoveIds: evolutionLine('zenith', 'Light', { granted: ['consecrate'] }),
          },
          {
            id: 'zenith-oracle',
            heroId: 'zenith',
            name: 'Oracle',
            unlocksMoveIds: [],
            typeGraft: 'Mind',
            learnableMoveIds: evolutionLine('zenith', 'Mind'),
            grantsPassiveIds: ['foreordained'],
          },
        ],
      },
    ],
    pixie: [
      {
        paths: [
          {
            id: 'pixie-stardust',
            heroId: 'pixie',
            name: 'Stardust',
            unlocksMoveIds: ['exalt'],
            grantsPassiveIds: ['glitter'],
          },
          {
            id: 'pixie-glamour',
            heroId: 'pixie',
            name: 'Glamour',
            unlocksMoveIds: [],
            typeGraft: 'Mind',
            learnableMoveIds: evolutionLine('pixie', 'Mind'),
            grantsPassiveIds: ['mirage'],
          },
          {
            id: 'pixie-wisplight',
            heroId: 'pixie',
            name: 'Wisplight',
            unlocksMoveIds: ['soulOffering'],
            typeGraft: 'Spirit',
            learnableMoveIds: evolutionLine('pixie', 'Spirit', { granted: ['soulOffering'] }),
          },
        ],
      },
    ],
    // --- Mind ---
    mindweaver: [
      {
        paths: [
          {
            id: 'mindweaver-construct',
            heroId: 'mindweaver',
            name: 'Construct',
            // Reverie picks its hand here: Construct the body (the rewire), Blindspot the mind, Embodied both.
            swapsOffense: true,
            unlocksMoveIds: ['cogSlam'],
            typeGraft: 'Mech',
            learnableMoveIds: evolutionLine('mindweaver', 'Mech', { swapped: true, granted: ['cogSlam'] }),
          },
          {
            id: 'mindweaver-blindspot',
            heroId: 'mindweaver',
            name: 'Blindspot',
            unlocksMoveIds: [],
            typeGraft: 'Shadow',
            learnableMoveIds: evolutionLine('mindweaver', 'Shadow'),
            grantsPassiveIds: ['inTheGap'],
          },
          {
            id: 'mindweaver-embodied',
            heroId: 'mindweaver',
            name: 'Embodied',
            // The mixed path (docs/combat.md "Either Hand"): Psychokinesis is the physical hand Mind never had.
            unlocksMoveIds: ['psychokinesis'],
            grantsPassiveIds: ['eitherHand'],
          },
        ],
      },
    ],
    lucius: [
      {
        paths: [
          {
            id: 'lucius-voidcaller',
            heroId: 'lucius',
            name: 'Voidcaller',
            unlocksMoveIds: ['eclipse'],
            typeGraft: 'Shadow',
            learnableMoveIds: evolutionLine('lucius', 'Shadow', { granted: ['eclipse'] }),
          },
          {
            id: 'lucius-sanguine',
            heroId: 'lucius',
            name: 'Sanguine',
            unlocksMoveIds: ['soulRend'],
            grantsPassiveIds: ['gorge'],
          },
          {
            id: 'lucius-cipher',
            heroId: 'lucius',
            name: 'Cipher',
            unlocksMoveIds: [],
            typeGraft: 'Arcane',
            learnableMoveIds: evolutionLine('lucius', 'Arcane'),
            grantsPassiveIds: ['sealedScript'],
          },
        ],
      },
    ],
    trance: [
      {
        paths: [
          {
            id: 'trance-puppeteer',
            heroId: 'trance',
            name: 'Puppeteer',
            unlocksMoveIds: ['poltergeist'],
            grantsPassiveIds: ['puppetStrings'],
          },
          {
            id: 'trance-somnambulist',
            heroId: 'trance',
            name: 'Somnambulist',
            unlocksMoveIds: [],
            typeGraft: 'Arcane',
            learnableMoveIds: evolutionLine('trance', 'Arcane'),
            grantsPassiveIds: ['sleepwalk'],
          },
          {
            id: 'trance-ringmaster',
            heroId: 'trance',
            name: 'Ringmaster',
            unlocksMoveIds: ['blindingFlash'],
            typeGraft: 'Light',
            learnableMoveIds: evolutionLine('trance', 'Light', { granted: ['blindingFlash'] }),
          },
        ],
      },
    ],
    // --- Spirit ---
    revenant: [
      {
        paths: [
          {
            id: 'revenant-wraithblade',
            heroId: 'revenant',
            name: 'Wraithblade',
            swapsOffense: true,
            unlocksMoveIds: ['wailingFlight'],
            grantsPassiveIds: ['graveHands'],
            learnableMoveIds: evolutionLine('revenant', 'Spirit', { swapped: true, granted: ['wailingFlight'] }),
          },
          {
            id: 'revenant-undying',
            heroId: 'revenant',
            name: 'Undying',
            unlocksMoveIds: [],
            typeGraft: 'Nature',
            learnableMoveIds: evolutionLine('revenant', 'Nature'),
            grantsPassiveIds: ['communion'],
          },
          {
            id: 'revenant-soulbinder',
            heroId: 'revenant',
            name: 'Soulbinder',
            unlocksMoveIds: ['wickedFear'],
            typeGraft: 'Mind',
            learnableMoveIds: evolutionLine('revenant', 'Mind', { granted: ['wickedFear'] }),
          },
        ],
      },
    ],
    sorrow: [
      {
        paths: [
          {
            id: 'sorrow-banshee',
            heroId: 'sorrow',
            name: 'Banshee',
            unlocksMoveIds: ['shadowstrike'],
            grantsPassiveIds: ['shriek'],
          },
          {
            id: 'sorrow-mourner',
            heroId: 'sorrow',
            name: 'Mourner',
            unlocksMoveIds: [],
            typeGraft: 'Frost',
            learnableMoveIds: evolutionLine('sorrow', 'Frost'),
            grantsPassiveIds: ['grief'],
          },
          {
            id: 'sorrow-dirge',
            heroId: 'sorrow',
            name: 'Dirge',
            swapsOffense: true,
            unlocksMoveIds: ['psionicWave'],
            typeGraft: 'Mind',
            learnableMoveIds: evolutionLine('sorrow', 'Mind', { swapped: true, granted: ['psionicWave'] }),
          },
        ],
      },
    ],
    dread: [
      {
        paths: [
          {
            id: 'dread-omen',
            heroId: 'dread',
            name: 'Omen',
            unlocksMoveIds: ['breakWill'],
            grantsPassiveIds: ['omen'],
          },
          {
            id: 'dread-ironfeather',
            heroId: 'dread',
            name: 'Ironfeather',
            unlocksMoveIds: ['reinforce'],
            typeGraft: 'Iron',
            learnableMoveIds: evolutionLine('dread', 'Iron', { granted: ['reinforce'] }),
          },
          {
            id: 'dread-gallows',
            heroId: 'dread',
            name: 'Gallows',
            unlocksMoveIds: [],
            typeGraft: 'Shadow',
            learnableMoveIds: evolutionLine('dread', 'Shadow'),
            grantsPassiveIds: ['carrion'],
          },
        ],
      },
    ],
    // --- Iron ---
    ironWarden: [
      {
        paths: [
          {
            id: 'ironWarden-sunderer',
            heroId: 'ironWarden',
            name: 'Sunderer',
            unlocksMoveIds: ['cogSlam'],
            typeGraft: 'Mech',
            learnableMoveIds: evolutionLine('ironWarden', 'Mech', { granted: ['cogSlam'] }),
          },
          {
            id: 'ironWarden-bulwark',
            heroId: 'ironWarden',
            name: 'Bulwark',
            unlocksMoveIds: ['parry'],
            grantsPassiveIds: ['sentry'],
          },
          {
            id: 'ironWarden-lodestar',
            heroId: 'ironWarden',
            name: 'Lodestar',
            unlocksMoveIds: [],
            typeGraft: 'Light',
            learnableMoveIds: evolutionLine('ironWarden', 'Light'),
            grantsPassiveIds: ['oathlight'],
          },
        ],
      },
    ],
    valor: [
      {
        paths: [
          {
            id: 'valor-galvanize',
            heroId: 'valor',
            name: 'Galvanize',
            unlocksMoveIds: ['stormLash'],
            typeGraft: 'Storm',
            learnableMoveIds: evolutionLine('valor', 'Storm', { granted: ['stormLash'] }),
          },
          {
            id: 'valor-shieldwall',
            heroId: 'valor',
            name: 'Shieldwall',
            unlocksMoveIds: ['stoneheart'],
            grantsPassiveIds: ['tempering'],
          },
          {
            id: 'valor-paladin',
            heroId: 'valor',
            name: 'Paladin',
            unlocksMoveIds: [],
            typeGraft: 'Light',
            learnableMoveIds: evolutionLine('valor', 'Light'),
            grantsPassiveIds: ['swornShield'],
          },
        ],
      },
    ],
    gallant: [
      {
        paths: [
          {
            id: 'gallant-charger',
            heroId: 'gallant',
            name: 'Charger',
            unlocksMoveIds: ['rideTheLightning'],
            grantsPassiveIds: ['cavalryCharge'],
          },
          {
            id: 'gallant-oathbound',
            heroId: 'gallant',
            name: 'Oathbound',
            unlocksMoveIds: ['consecrate'],
            typeGraft: 'Light',
            learnableMoveIds: evolutionLine('gallant', 'Light', { granted: ['consecrate'] }),
          },
          {
            id: 'gallant-destrier',
            heroId: 'gallant',
            name: 'Destrier',
            unlocksMoveIds: [],
            typeGraft: 'Beast',
            learnableMoveIds: evolutionLine('gallant', 'Beast'),
            grantsPassiveIds: ['gallop'],
          },
        ],
      },
    ],
    scallywag: [
      {
        paths: [
          {
            id: 'scallywag-corsair',
            heroId: 'scallywag',
            name: 'Corsair',
            unlocksMoveIds: ['thousandCuts'],
            grantsPassiveIds: ['plunder'],
          },
          {
            id: 'scallywag-stormrunner',
            heroId: 'scallywag',
            name: 'Stormrunner',
            unlocksMoveIds: ['stormLash'],
            typeGraft: 'Storm',
            learnableMoveIds: evolutionLine('scallywag', 'Storm', { granted: ['stormLash'] }),
          },
          {
            id: 'scallywag-seawise',
            heroId: 'scallywag',
            name: 'Seawise',
            unlocksMoveIds: [],
            typeGraft: 'Water',
            learnableMoveIds: evolutionLine('scallywag', 'Water'),
            grantsPassiveIds: ['safeHarbour'],
          },
        ],
      },
    ],
    // --- Mech ---
    forgewright: [
      {
        paths: [
          {
            id: 'forgewright-runaway',
            heroId: 'forgewright',
            name: 'Runaway',
            unlocksMoveIds: ['volcanicSurge'],
            grantsPassiveIds: ['combustion'],
          },
          {
            id: 'forgewright-hydraulics',
            heroId: 'forgewright',
            name: 'Hydraulics',
            unlocksMoveIds: ['oasis'],
            typeGraft: 'Water',
            learnableMoveIds: evolutionLine('forgewright', 'Water', { granted: ['oasis'] }),
          },
          {
            id: 'forgewright-furnace',
            heroId: 'forgewright',
            name: 'Furnace',
            unlocksMoveIds: [],
            typeGraft: 'Fire',
            learnableMoveIds: evolutionLine('forgewright', 'Fire'),
            grantsPassiveIds: ['ignition'],
          },
        ],
      },
    ],
    // A dual hero (docs/evolution-simplification.md §6.1): Redline keeps Mech/Iron and takes a Late
    // Iron move; Bulkhead and Overpressure each trade the Iron away.
    steamColossus: [
      {
        paths: [
          {
            id: 'steamColossus-redline',
            heroId: 'steamColossus',
            name: 'Redline',
            unlocksMoveIds: ['juggernaut'],
            grantsPassiveIds: ['runawayPressure'],
          },
          {
            id: 'steamColossus-bulkhead',
            heroId: 'steamColossus',
            name: 'Bulkhead',
            unlocksMoveIds: [],
            typeGraft: 'Stone',
            learnableMoveIds: evolutionLine('steamColossus', 'Stone'),
            grantsPassiveIds: ['blastDoor'],
          },
          {
            id: 'steamColossus-overpressure',
            heroId: 'steamColossus',
            name: 'Overpressure',
            swapsOffense: true,
            unlocksMoveIds: ['firestorm'],
            typeGraft: 'Fire',
            learnableMoveIds: evolutionLine('steamColossus', 'Fire', { swapped: true, granted: ['firestorm'] }),
          },
        ],
      },
    ],
    rex: [
      {
        paths: [
          {
            id: 'rex-tyrant',
            heroId: 'rex',
            name: 'Tyrant',
            unlocksMoveIds: ['stoneheart'],
            grantsPassiveIds: ['rampant'],
          },
          {
            id: 'rex-primal',
            heroId: 'rex',
            name: 'Primal',
            unlocksMoveIds: ['gore'],
            typeGraft: 'Beast',
            learnableMoveIds: evolutionLine('rex', 'Beast', { granted: ['gore'] }),
          },
          {
            id: 'rex-fossil',
            heroId: 'rex',
            name: 'Fossil',
            unlocksMoveIds: [],
            typeGraft: 'Stone',
            learnableMoveIds: evolutionLine('rex', 'Stone'),
            grantsPassiveIds: ['unearthed'],
          },
        ],
      },
    ],
    patch: [
      {
        paths: [
          {
            id: 'patch-triage',
            heroId: 'patch',
            name: 'Triage',
            unlocksMoveIds: ['divineGrace'],
            grantsPassiveIds: ['nanites'],
          },
          {
            id: 'patch-beacon',
            heroId: 'patch',
            name: 'Beacon',
            unlocksMoveIds: ['consecrate'],
            typeGraft: 'Light',
            learnableMoveIds: evolutionLine('patch', 'Light', { granted: ['consecrate'] }),
          },
          {
            id: 'patch-coolant',
            heroId: 'patch',
            name: 'Coolant',
            unlocksMoveIds: [],
            typeGraft: 'Water',
            learnableMoveIds: evolutionLine('patch', 'Water'),
            grantsPassiveIds: ['heatSink'],
          },
        ],
      },
    ],
    // --- Beast ---
    packAlpha: [
      {
        paths: [
          {
            id: 'packAlpha-bloodhunt',
            heroId: 'packAlpha',
            name: 'Bloodhunt',
            unlocksMoveIds: ['rend'],
            grantsPassiveIds: ['bloodthirsty'],
          },
          {
            id: 'packAlpha-stonehide',
            heroId: 'packAlpha',
            name: 'Stonehide',
            unlocksMoveIds: [],
            typeGraft: 'Stone',
            learnableMoveIds: evolutionLine('packAlpha', 'Stone'),
            grantsPassiveIds: ['bedrockHide'],
          },
          {
            id: 'packAlpha-warhowl',
            heroId: 'packAlpha',
            name: 'Warhowl',
            // Rewire (docs/evolution-simplification.md §4): Pack Hunter reads both columns for it.
            swapsOffense: true,
            unlocksMoveIds: ['poltergeist'],
            typeGraft: 'Spirit',
            learnableMoveIds: evolutionLine('packAlpha', 'Spirit', { swapped: true, granted: ['poltergeist'] }),
          },
        ],
      },
    ],
    ursa: [
      {
        paths: [
          {
            id: 'ursa-grizzly',
            heroId: 'ursa',
            name: 'Grizzly',
            unlocksMoveIds: ['titanicCrush'],
            grantsPassiveIds: ['thickHide'],
          },
          {
            id: 'ursa-polar',
            heroId: 'ursa',
            name: 'Polar',
            unlocksMoveIds: ['icicleThrust'],
            typeGraft: 'Frost',
            learnableMoveIds: evolutionLine('ursa', 'Frost', { granted: ['icicleThrust'] }),
          },
          {
            id: 'ursa-timberback',
            heroId: 'ursa',
            name: 'Timberback',
            unlocksMoveIds: [],
            typeGraft: 'Nature',
            learnableMoveIds: evolutionLine('ursa', 'Nature'),
            grantsPassiveIds: ['wellFed'],
          },
        ],
      },
    ],
    // A dual hero (docs/evolution-simplification.md §6.1): Mesmer keeps Beast/Mind and takes a Late
    // Mind move; Basilisk and Hooded each trade the Mind away.
    coil: [
      {
        paths: [
          {
            id: 'coil-basilisk',
            heroId: 'coil',
            name: 'Basilisk',
            unlocksMoveIds: [],
            typeGraft: 'Nature',
            learnableMoveIds: evolutionLine('coil', 'Nature'),
            grantsPassiveIds: ['constrict'],
          },
          {
            id: 'coil-hooded',
            heroId: 'coil',
            name: 'Hooded',
            unlocksMoveIds: ['landslide'],
            typeGraft: 'Stone',
            learnableMoveIds: evolutionLine('coil', 'Stone', { granted: ['landslide'] }),
          },
          {
            id: 'coil-mesmer',
            heroId: 'coil',
            name: 'Mesmer',
            unlocksMoveIds: ['brainFlay'],
            grantsPassiveIds: ['mesmerize'],
          },
        ],
      },
    ],
    vex: [
      {
        paths: [
          {
            id: 'vex-nightfeeder',
            heroId: 'vex',
            name: 'Nightfeeder',
            unlocksMoveIds: ['rampage'],
            grantsPassiveIds: ['bloodmeal'],
          },
          {
            id: 'vex-vampyr',
            heroId: 'vex',
            name: 'Vampyr',
            unlocksMoveIds: ['duskBlade'],
            typeGraft: 'Shadow',
            learnableMoveIds: evolutionLine('vex', 'Shadow', { granted: ['duskBlade'] }),
          },
          {
            id: 'vex-wraithwing',
            heroId: 'vex',
            name: 'Wraithwing',
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
            learnableMoveIds: evolutionLine('vex', 'Spirit'),
            grantsPassiveIds: ['graveMark'],
          },
        ],
      },
    ],
    // --- Starfall ---
    drift: [
      {
        paths: [
          {
            id: 'drift-stinger',
            heroId: 'drift',
            name: 'Stinger',
            unlocksMoveIds: ['mindLeech'],
            grantsPassiveIds: ['stingingCells'],
          },
          {
            id: 'drift-deepbloom',
            heroId: 'drift',
            name: 'Deepbloom',
            unlocksMoveIds: ['torrent'],
            typeGraft: 'Water',
            learnableMoveIds: evolutionLine('drift', 'Water', { granted: ['torrent'] }),
          },
          {
            id: 'drift-moonJelly',
            heroId: 'drift',
            name: 'Moon Jelly',
            unlocksMoveIds: [],
            typeGraft: 'Light',
            learnableMoveIds: evolutionLine('drift', 'Light'),
            grantsPassiveIds: ['moonglow'],
          },
        ],
      },
    ],
    rimehold: [
      {
        paths: [
          {
            id: 'rimehold-snowfort',
            heroId: 'rimehold',
            name: 'Snowfort',
            unlocksMoveIds: ['frostWall'],
            grantsPassiveIds: ['coldFront'],
          },
          {
            id: 'rimehold-hearthglow',
            heroId: 'rimehold',
            name: 'Hearthglow',
            unlocksMoveIds: [],
            typeGraft: 'Fire',
            learnableMoveIds: evolutionLine('rimehold', 'Fire'),
            grantsPassiveIds: ['portcullis'],
          },
          {
            id: 'rimehold-aurora',
            heroId: 'rimehold',
            name: 'Aurora',
            unlocksMoveIds: ['benediction'],
            typeGraft: 'Light',
            learnableMoveIds: evolutionLine('rimehold', 'Light', { granted: ['benediction'] }),
          },
        ],
      },
    ],
    carillon: [
      {
        paths: [
          {
            id: 'carillon-greatBell',
            heroId: 'carillon',
            name: 'Great Bell',
            unlocksMoveIds: ['consecrate'],
            grantsPassiveIds: ['reverberation'],
          },
          {
            id: 'carillon-bellfounder',
            heroId: 'carillon',
            name: 'Bellfounder',
            unlocksMoveIds: ['momentumSwing'],
            typeGraft: 'Iron',
            learnableMoveIds: evolutionLine('carillon', 'Iron', { granted: ['momentumSwing'] }),
          },
          {
            id: 'carillon-knell',
            heroId: 'carillon',
            name: 'Knell',
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
            learnableMoveIds: evolutionLine('carillon', 'Spirit'),
            grantsPassiveIds: ['lastToll'],
          },
        ],
      },
    ],
    hart: [
      {
        paths: [
          {
            id: 'hart-whiteHart',
            heroId: 'hart',
            name: 'White Hart',
            unlocksMoveIds: ['blindingFlash'],
            grantsPassiveIds: ['unblemished'],
          },
          {
            id: 'hart-greenwood',
            heroId: 'hart',
            name: 'Greenwood',
            unlocksMoveIds: ['sow'],
            typeGraft: 'Nature',
            learnableMoveIds: evolutionLine('hart', 'Nature', { granted: ['sow'] }),
          },
          {
            id: 'hart-spiritStag',
            heroId: 'hart',
            name: 'Spirit Stag',
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
            learnableMoveIds: evolutionLine('hart', 'Spirit'),
            grantsPassiveIds: ['deathwatch'],
          },
        ],
      },
    ],
    ashwing: [
      {
        paths: [
          {
            id: 'ashwing-firebird',
            heroId: 'ashwing',
            name: 'Firebird',
            unlocksMoveIds: ['immolate'],
            grantsPassiveIds: ['risingFlame'],
          },
          {
            id: 'ashwing-sunbird',
            heroId: 'ashwing',
            name: 'Sunbird',
            unlocksMoveIds: ['consecrate'],
            typeGraft: 'Light',
            learnableMoveIds: evolutionLine('ashwing', 'Light', { granted: ['consecrate'] }),
            grantsPassiveIds: ['dawnfire'],
          },
          {
            id: 'ashwing-ashen',
            heroId: 'ashwing',
            name: 'Ashen',
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
            learnableMoveIds: evolutionLine('ashwing', 'Spirit'),
            grantsPassiveIds: ['funeralPyre'],
          },
        ],
      },
    ],
    kappa: [
      {
        paths: [
          {
            id: 'kappa-deepPool',
            heroId: 'kappa',
            name: 'Deep Pool',
            unlocksMoveIds: ['oasis'],
            grantsPassiveIds: ['sharedDish'],
          },
          {
            id: 'kappa-snapper',
            heroId: 'kappa',
            name: 'Snapper',
            unlocksMoveIds: [],
            typeGraft: 'Beast',
            learnableMoveIds: evolutionLine('kappa', 'Beast'),
            grantsPassiveIds: ['snappingJaw'],
          },
          {
            id: 'kappa-yokai',
            heroId: 'kappa',
            name: 'Yokai',
            unlocksMoveIds: ['spookySlice'],
            typeGraft: 'Spirit',
            learnableMoveIds: evolutionLine('kappa', 'Spirit', { granted: ['spookySlice'] }),
            grantsPassiveIds: ['yokaiDish'],
          },
        ],
      },
    ],
    tusk: [
      {
        paths: [
          {
            id: 'tusk-iceAge',
            heroId: 'tusk',
            name: 'Ice Age',
            unlocksMoveIds: ['snowball'],
            grantsPassiveIds: ['wintersWeight'],
          },
          {
            id: 'tusk-erratic',
            heroId: 'tusk',
            name: 'Erratic',
            unlocksMoveIds: ['titanicCrush'],
            typeGraft: 'Stone',
            learnableMoveIds: evolutionLine('tusk', 'Stone', { granted: ['titanicCrush'] }),
          },
          {
            id: 'tusk-matriarch',
            heroId: 'tusk',
            name: 'Matriarch',
            unlocksMoveIds: [],
            typeGraft: 'Beast',
            learnableMoveIds: evolutionLine('tusk', 'Beast'),
            grantsPassiveIds: ['matriarchsFury'],
          },
        ],
      },
    ],
    motley: [
      {
        paths: [
          {
            id: 'motley-harlequin',
            heroId: 'motley',
            name: 'Harlequin',
            unlocksMoveIds: ['psychicBlow'],
            grantsPassiveIds: ['setup'],
          },
          {
            id: 'motley-conjurer',
            heroId: 'motley',
            name: 'Conjurer',
            unlocksMoveIds: ['magicCloak'],
            typeGraft: 'Arcane',
            learnableMoveIds: evolutionLine('motley', 'Arcane', { granted: ['magicCloak'] }),
          },
          {
            id: 'motley-tragedian',
            heroId: 'motley',
            name: 'Tragedian',
            unlocksMoveIds: [],
            typeGraft: 'Shadow',
            learnableMoveIds: evolutionLine('motley', 'Shadow'),
            grantsPassiveIds: ['hubris'],
          },
        ],
      },
    ],
    folio: [
      {
        paths: [
          {
            id: 'folio-magnumOpus',
            heroId: 'folio',
            name: 'Magnum Opus',
            unlocksMoveIds: ['twinCast'],
            grantsPassiveIds: ['crescendo'],
          },
          {
            id: 'folio-illuminated',
            heroId: 'folio',
            name: 'Illuminated',
            unlocksMoveIds: [],
            typeGraft: 'Light',
            learnableMoveIds: evolutionLine('folio', 'Light'),
            grantsPassiveIds: ['illumination'],
          },
          {
            id: 'folio-prophecy',
            heroId: 'folio',
            name: 'Prophecy',
            unlocksMoveIds: ['psyshock'],
            typeGraft: 'Mind',
            learnableMoveIds: evolutionLine('folio', 'Mind', { granted: ['psyshock'] }),
          },
        ],
      },
    ],
    ronin: [
      {
        paths: [
          {
            id: 'ronin-kensei',
            heroId: 'ronin',
            name: 'Kensei',
            unlocksMoveIds: ['onslaught'],
            grantsPassiveIds: ['readyStance'],
          },
          {
            id: 'ronin-raijin',
            heroId: 'ronin',
            name: 'Raijin',
            unlocksMoveIds: ['shockSlice'],
            typeGraft: 'Storm',
            learnableMoveIds: evolutionLine('ronin', 'Storm', { granted: ['shockSlice'] }),
          },
          {
            id: 'ronin-shinobi',
            heroId: 'ronin',
            name: 'Shinobi',
            unlocksMoveIds: [],
            typeGraft: 'Shadow',
            learnableMoveIds: evolutionLine('ronin', 'Shadow'),
            grantsPassiveIds: ['unseenCut'],
          },
        ],
      },
    ],
    kong: [
      {
        paths: [
          {
            id: 'kong-silverback',
            heroId: 'kong',
            name: 'Silverback',
            unlocksMoveIds: ['packLeader'],
            grantsPassiveIds: ['troopLeader'],
          },
          {
            id: 'kong-stonefist',
            heroId: 'kong',
            name: 'Stonefist',
            unlocksMoveIds: ['rubbleRush'],
            typeGraft: 'Stone',
            learnableMoveIds: evolutionLine('kong', 'Stone', { granted: ['rubbleRush'] }),
          },
          {
            id: 'kong-canopyKing',
            heroId: 'kong',
            name: 'Canopy King',
            unlocksMoveIds: [],
            typeGraft: 'Nature',
            learnableMoveIds: evolutionLine('kong', 'Nature'),
            grantsPassiveIds: ['closingCanopy'],
          },
        ],
      },
    ],
    morel: [
      {
        paths: [
          {
            id: 'morel-toadstool',
            heroId: 'morel',
            name: 'Toadstool',
            unlocksMoveIds: ['wildBloom'],
            grantsPassiveIds: ['sporeRing'],
          },
          {
            id: 'morel-deathcap',
            heroId: 'morel',
            name: 'Deathcap',
            unlocksMoveIds: ['grimHarvest'],
            typeGraft: 'Shadow',
            learnableMoveIds: evolutionLine('morel', 'Shadow', { granted: ['grimHarvest'] }),
          },
          {
            id: 'morel-corpselight',
            heroId: 'morel',
            name: 'Corpselight',
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
            learnableMoveIds: evolutionLine('morel', 'Spirit'),
            grantsPassiveIds: ['graveglow'],
          },
        ],
      },
    ],
    scree: [
      {
        paths: [
          {
            id: 'scree-tor',
            heroId: 'scree',
            name: 'Tor',
            unlocksMoveIds: ['rampart'],
            grantsPassiveIds: ['leeward'],
          },
          {
            id: 'scree-ironscale',
            heroId: 'scree',
            name: 'Ironscale',
            unlocksMoveIds: ['shieldBash'],
            typeGraft: 'Iron',
            learnableMoveIds: evolutionLine('scree', 'Iron', { granted: ['shieldBash'] }),
          },
          {
            id: 'scree-riverstone',
            heroId: 'scree',
            name: 'Riverstone',
            unlocksMoveIds: [],
            typeGraft: 'Water',
            learnableMoveIds: evolutionLine('scree', 'Water'),
            grantsPassiveIds: ['riverworn'],
          },
        ],
      },
    ],
    aurum: [
      {
        paths: [
          {
            id: 'aurum-sunlord',
            heroId: 'aurum',
            name: 'Sunlord',
            unlocksMoveIds: ['deityBlade'],
            grantsPassiveIds: ['highNoon'],
          },
          {
            id: 'aurum-pride',
            heroId: 'aurum',
            name: 'Pride',
            unlocksMoveIds: ['rampage'],
            typeGraft: 'Beast',
            learnableMoveIds: evolutionLine('aurum', 'Beast', { granted: ['rampage'] }),
          },
          {
            id: 'aurum-sunfire',
            heroId: 'aurum',
            name: 'Sunfire',
            unlocksMoveIds: [],
            typeGraft: 'Fire',
            learnableMoveIds: evolutionLine('aurum', 'Fire'),
            grantsPassiveIds: ['kindledMane'],
          },
        ],
      },
    ],
    jinx: [
      {
        paths: [
          {
            id: 'jinx-blackCat',
            heroId: 'jinx',
            name: 'Black Cat',
            unlocksMoveIds: ['shadowstrike'],
            grantsPassiveIds: ['misfortune'],
          },
          {
            id: 'jinx-nekomata',
            heroId: 'jinx',
            name: 'Nekomata',
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
            learnableMoveIds: evolutionLine('jinx', 'Spirit'),
            grantsPassiveIds: ['secondTail'],
          },
          {
            id: 'jinx-luckyCat',
            heroId: 'jinx',
            name: 'Lucky Cat',
            unlocksMoveIds: ['jackpot'],
            typeGraft: 'Mech',
            learnableMoveIds: evolutionLine('jinx', 'Mech', { granted: ['jackpot'] }),
          },
        ],
      },
    ],
    kitsu: [
      {
        paths: [
          {
            id: 'kitsu-ninetails',
            heroId: 'kitsu',
            name: 'Ninetails',
            unlocksMoveIds: ['banish'],
            grantsPassiveIds: ['oldFire'],
          },
          {
            id: 'kitsu-emberfox',
            heroId: 'kitsu',
            name: 'Emberfox',
            unlocksMoveIds: ['scorch'],
            typeGraft: 'Fire',
            learnableMoveIds: evolutionLine('kitsu', 'Fire', { granted: ['scorch'] }),
          },
          {
            id: 'kitsu-trickster',
            heroId: 'kitsu',
            name: 'Trickster',
            unlocksMoveIds: [],
            typeGraft: 'Mind',
            learnableMoveIds: evolutionLine('kitsu', 'Mind'),
            grantsPassiveIds: ['borrowedFace'],
          },
        ],
      },
    ],
    tinder: [
      {
        paths: [
          {
            id: 'tinder-headliner',
            heroId: 'tinder',
            name: 'Headliner',
            unlocksMoveIds: ['firestorm'],
            grantsPassiveIds: ['topBilling'],
          },
          {
            id: 'tinder-sparkler',
            heroId: 'tinder',
            name: 'Sparkler',
            unlocksMoveIds: ['chainLightning'],
            typeGraft: 'Storm',
            learnableMoveIds: evolutionLine('tinder', 'Storm', { granted: ['chainLightning'] }),
          },
          {
            id: 'tinder-limelight',
            heroId: 'tinder',
            name: 'Limelight',
            unlocksMoveIds: [],
            typeGraft: 'Light',
            learnableMoveIds: evolutionLine('tinder', 'Light'),
            grantsPassiveIds: ['footlights'],
          },
        ],
      },
    ],
    selkie: [
      {
        paths: [
          {
            id: 'selkie-tidewife',
            heroId: 'selkie',
            name: 'Tidewife',
            unlocksMoveIds: ['highTide'],
            grantsPassiveIds: ['highWater'],
          },
          {
            id: 'selkie-seasinger',
            heroId: 'selkie',
            name: 'Seasinger',
            unlocksMoveIds: ['mindShatter'],
            typeGraft: 'Mind',
            learnableMoveIds: evolutionLine('selkie', 'Mind', { granted: ['mindShatter'] }),
          },
          {
            id: 'selkie-roane',
            heroId: 'selkie',
            name: 'Roane',
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
            learnableMoveIds: evolutionLine('selkie', 'Spirit'),
            grantsPassiveIds: ['drownedGift'],
          },
        ],
      },
    ],
    hush: [
      {
        paths: [
          {
            id: 'hush-tundraHunter',
            heroId: 'hush',
            name: 'Tundra Hunter',
            unlocksMoveIds: ['absoluteZero'],
            grantsPassiveIds: ['stillPrey'],
          },
          {
            id: 'hush-nightOwl',
            heroId: 'hush',
            name: 'Night Owl',
            unlocksMoveIds: ['eclipse'],
            typeGraft: 'Shadow',
            learnableMoveIds: evolutionLine('hush', 'Shadow', { granted: ['eclipse'] }),
          },
          {
            id: 'hush-athene',
            heroId: 'hush',
            name: 'Athene',
            unlocksMoveIds: ['psionicWave'],
            typeGraft: 'Mind',
            learnableMoveIds: evolutionLine('hush', 'Mind', { granted: ['psionicWave'] }),
            grantsPassiveIds: ['owlsGaze'],
          },
        ],
      },
    ],
    lotus: [
      {
        paths: [
          {
            id: 'lotus-thousandPetals',
            heroId: 'lotus',
            name: 'Thousand Petals',
            unlocksMoveIds: ['forceOfNature'],
            grantsPassiveIds: ['petalStorm'],
          },
          {
            id: 'lotus-enlightened',
            heroId: 'lotus',
            name: 'Enlightened',
            unlocksMoveIds: ['psionicWave'],
            typeGraft: 'Mind',
            learnableMoveIds: evolutionLine('lotus', 'Mind', { granted: ['psionicWave'] }),
          },
          {
            id: 'lotus-moonpond',
            heroId: 'lotus',
            name: 'Moonpond',
            unlocksMoveIds: [],
            typeGraft: 'Water',
            learnableMoveIds: evolutionLine('lotus', 'Water'),
            grantsPassiveIds: ['moonwell'],
          },
        ],
      },
    ],
    nimbus: [
      {
        paths: [
          {
            id: 'nimbus-anvilhead',
            heroId: 'nimbus',
            name: 'Anvilhead',
            unlocksMoveIds: ['ionicZap'],
            grantsPassiveIds: ['anvilCrown'],
          },
          {
            id: 'nimbus-raincloud',
            heroId: 'nimbus',
            name: 'Raincloud',
            unlocksMoveIds: ['rainmaker'],
            typeGraft: 'Water',
            learnableMoveIds: evolutionLine('nimbus', 'Water', { granted: ['rainmaker'] }),
          },
          {
            id: 'nimbus-sunshower',
            heroId: 'nimbus',
            name: 'Sunshower',
            unlocksMoveIds: [],
            typeGraft: 'Light',
            learnableMoveIds: evolutionLine('nimbus', 'Light'),
            grantsPassiveIds: ['sunbreak'],
          },
        ],
      },
    ],
    kite: [
      {
        paths: [
          {
            id: 'kite-highflyer',
            heroId: 'kite',
            name: 'Highflyer',
            unlocksMoveIds: ['chainLightning'],
            grantsPassiveIds: ['updraft'],
          },
          {
            id: 'kite-seedwind',
            heroId: 'kite',
            name: 'Seedwind',
            unlocksMoveIds: ['rootbind'],
            typeGraft: 'Nature',
            learnableMoveIds: evolutionLine('kite', 'Nature', { granted: ['rootbind'] }),
          },
          {
            id: 'kite-lanternKite',
            heroId: 'kite',
            name: 'Lantern Kite',
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
            learnableMoveIds: evolutionLine('kite', 'Spirit'),
            grantsPassiveIds: ['gildedString'],
          },
        ],
      },
    ],
    raiju: [
      {
        paths: [
          {
            id: 'raiju-kaminari',
            heroId: 'raiju',
            name: 'Kaminari',
            unlocksMoveIds: ['shockSlice'],
            grantsPassiveIds: ['thunderstep'],
          },
          {
            id: 'raiju-kamaitachi',
            heroId: 'raiju',
            name: 'Kamaitachi',
            unlocksMoveIds: ['rendingLeap'],
            typeGraft: 'Beast',
            learnableMoveIds: evolutionLine('raiju', 'Beast', { granted: ['rendingLeap'] }),
          },
          {
            id: 'raiju-heatLightning',
            heroId: 'raiju',
            name: 'Heat Lightning',
            unlocksMoveIds: [],
            typeGraft: 'Fire',
            learnableMoveIds: evolutionLine('raiju', 'Fire'),
            grantsPassiveIds: ['brushfire'],
          },
        ],
      },
    ],
    dune: [
      {
        paths: [
          {
            id: 'dune-worldworm',
            heroId: 'dune',
            name: 'Worldworm',
            unlocksMoveIds: ['bodyCrush'],
            grantsPassiveIds: ['desertBody'],
          },
          {
            id: 'dune-glassback',
            heroId: 'dune',
            name: 'Glassback',
            unlocksMoveIds: ['firebrand'],
            typeGraft: 'Fire',
            learnableMoveIds: evolutionLine('dune', 'Fire', { granted: ['firebrand'] }),
          },
          {
            id: 'dune-duneshade',
            heroId: 'dune',
            name: 'Duneshade',
            unlocksMoveIds: [],
            typeGraft: 'Shadow',
            learnableMoveIds: evolutionLine('dune', 'Shadow'),
            grantsPassiveIds: ['sinkingSands'],
          },
        ],
      },
    ],
    cairn: [
      {
        paths: [
          {
            id: 'cairn-menhir',
            heroId: 'cairn',
            name: 'Menhir',
            unlocksMoveIds: ['bodyBlow'],
            grantsPassiveIds: ['settlingStone'],
          },
          {
            id: 'cairn-riverbed',
            heroId: 'cairn',
            name: 'Riverbed',
            unlocksMoveIds: ['seawall'],
            typeGraft: 'Water',
            learnableMoveIds: evolutionLine('cairn', 'Water', { granted: ['seawall'] }),
          },
          {
            id: 'cairn-barrow',
            heroId: 'cairn',
            name: 'Barrow',
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
            learnableMoveIds: evolutionLine('cairn', 'Spirit'),
            grantsPassiveIds: ['barrowCall'],
          },
        ],
      },
    ],
    murk: [
      {
        paths: [
          {
            id: 'murk-lurker',
            heroId: 'murk',
            name: 'Lurker',
            unlocksMoveIds: ['shadowstrike'],
            grantsPassiveIds: ['stillWater'],
          },
          {
            id: 'murk-mossback',
            heroId: 'murk',
            name: 'Mossback',
            unlocksMoveIds: ['regrowth'],
            typeGraft: 'Nature',
            learnableMoveIds: evolutionLine('murk', 'Nature', { granted: ['regrowth'] }),
          },
          {
            id: 'murk-drowner',
            heroId: 'murk',
            name: 'Drowner',
            unlocksMoveIds: [],
            typeGraft: 'Water',
            learnableMoveIds: evolutionLine('murk', 'Water'),
            grantsPassiveIds: ['heldUnder'],
          },
        ],
      },
    ],
    rook: [
      {
        paths: [
          {
            id: 'rook-coven',
            heroId: 'rook',
            name: 'Coven',
            unlocksMoveIds: ['enfeeble'],
            grantsPassiveIds: ['witchmark'],
          },
          {
            id: 'rook-nightcrow',
            heroId: 'rook',
            name: 'Nightcrow',
            unlocksMoveIds: ['poltergeist'],
            typeGraft: 'Spirit',
            learnableMoveIds: evolutionLine('rook', 'Spirit', { granted: ['poltergeist'] }),
          },
          {
            id: 'rook-hedgeWitch',
            heroId: 'rook',
            name: 'Hedge Witch',
            unlocksMoveIds: [],
            typeGraft: 'Nature',
            learnableMoveIds: evolutionLine('rook', 'Nature'),
            grantsPassiveIds: ['bitterBrew'],
          },
        ],
      },
    ],
    koan: [
      {
        paths: [
          {
            id: 'koan-thirdEye',
            heroId: 'koan',
            name: 'Third Eye',
            unlocksMoveIds: ['psychokinesis'],
            grantsPassiveIds: ['stillness'],
          },
          {
            id: 'koan-crane',
            heroId: 'koan',
            name: 'Crane',
            unlocksMoveIds: ['rendingLeap'],
            typeGraft: 'Beast',
            learnableMoveIds: evolutionLine('koan', 'Beast', { granted: ['rendingLeap'] }),
          },
          {
            id: 'koan-bodhi',
            heroId: 'koan',
            name: 'Bodhi',
            unlocksMoveIds: [],
            typeGraft: 'Light',
            learnableMoveIds: evolutionLine('koan', 'Light'),
            grantsPassiveIds: ['innerLight'],
          },
        ],
      },
    ],
    thane: [
      {
        paths: [
          {
            id: 'thane-spellsword',
            heroId: 'thane',
            name: 'Spellsword',
            unlocksMoveIds: ['arcaneOverflow'],
            grantsPassiveIds: ['bladeChannel'],
          },
          {
            id: 'thane-ironsworn',
            heroId: 'thane',
            name: 'Ironsworn',
            unlocksMoveIds: ['reinforce'],
            typeGraft: 'Iron',
            learnableMoveIds: evolutionLine('thane', 'Iron', { granted: ['reinforce'] }),
          },
          {
            id: 'thane-stormbrand',
            heroId: 'thane',
            name: 'Stormbrand',
            unlocksMoveIds: [],
            typeGraft: 'Storm',
            learnableMoveIds: evolutionLine('thane', 'Storm'),
            grantsPassiveIds: ['stormrune'],
          },
        ],
      },
    ],
    trove: [
      {
        paths: [
          {
            id: 'trove-bottomlessChest',
            heroId: 'trove',
            name: 'Bottomless Chest',
            unlocksMoveIds: ['fontOfPower'],
            grantsPassiveIds: ['tithe'],
          },
          {
            id: 'trove-strongbox',
            heroId: 'trove',
            name: 'Strongbox',
            unlocksMoveIds: [],
            typeGraft: 'Iron',
            learnableMoveIds: evolutionLine('trove', 'Iron'),
            grantsPassiveIds: ['barbedLock'],
          },
          {
            id: 'trove-vaultshade',
            heroId: 'trove',
            name: 'Vaultshade',
            unlocksMoveIds: ['shadowForm'],
            typeGraft: 'Shadow',
            learnableMoveIds: evolutionLine('trove', 'Shadow', { granted: ['shadowForm'] }),
          },
        ],
      },
    ],
    totem: [
      {
        paths: [
          {
            id: 'totem-elderPole',
            heroId: 'totem',
            name: 'Elder Pole',
            unlocksMoveIds: ['banish'],
            grantsPassiveIds: ['eldestFace'],
          },
          {
            id: 'totem-oldGrowth',
            heroId: 'totem',
            name: 'Old Growth',
            unlocksMoveIds: ['wildBloom'],
            typeGraft: 'Nature',
            learnableMoveIds: evolutionLine('totem', 'Nature', { granted: ['wildBloom'] }),
          },
          {
            id: 'totem-spiritAnimal',
            heroId: 'totem',
            name: 'Spirit Animal',
            unlocksMoveIds: [],
            typeGraft: 'Beast',
            learnableMoveIds: evolutionLine('totem', 'Beast'),
            grantsPassiveIds: ['spiritPack'],
          },
        ],
      },
    ],
    keen: [
      {
        paths: [
          {
            id: 'keen-harbinger',
            heroId: 'keen',
            name: 'Harbinger',
            unlocksMoveIds: ['lastRites'],
            grantsPassiveIds: ['deathKnell'],
          },
          {
            id: 'keen-shroud',
            heroId: 'keen',
            name: 'Shroud',
            unlocksMoveIds: ['eclipse'],
            typeGraft: 'Shadow',
            learnableMoveIds: evolutionLine('keen', 'Shadow', { granted: ['eclipse'] }),
          },
          {
            id: 'keen-wintermourn',
            heroId: 'keen',
            name: 'Wintermourn',
            unlocksMoveIds: [],
            typeGraft: 'Frost',
            learnableMoveIds: evolutionLine('keen', 'Frost'),
            grantsPassiveIds: ['graveFrost'],
          },
        ],
      },
    ],
    ferra: [
      {
        paths: [
          {
            id: 'ferra-magnetar',
            heroId: 'ferra',
            name: 'Magnetar',
            unlocksMoveIds: ['conjuredSword'],
            grantsPassiveIds: ['ironFilings'],
          },
          {
            id: 'ferra-electromagnet',
            heroId: 'ferra',
            name: 'Electromagnet',
            unlocksMoveIds: [],
            typeGraft: 'Storm',
            learnableMoveIds: evolutionLine('ferra', 'Storm'),
            grantsPassiveIds: ['induction'],
          },
          {
            id: 'ferra-railgun',
            heroId: 'ferra',
            name: 'Railgun',
            unlocksMoveIds: ['overheat'],
            typeGraft: 'Mech',
            learnableMoveIds: evolutionLine('ferra', 'Mech', { granted: ['overheat'] }),
          },
        ],
      },
    ],
    abacus: [
      {
        paths: [
          {
            id: 'abacus-differenceEngine',
            heroId: 'abacus',
            name: 'Difference Engine',
            unlocksMoveIds: ['perfectCreation'],
            grantsPassiveIds: ['failureAnalysis'],
          },
          {
            id: 'abacus-prognosticator',
            heroId: 'abacus',
            name: 'Prognosticator',
            unlocksMoveIds: ['disorient'],
            typeGraft: 'Mind',
            learnableMoveIds: evolutionLine('abacus', 'Mind', { granted: ['disorient'] }),
          },
          {
            id: 'abacus-arithmancer',
            heroId: 'abacus',
            name: 'Arithmancer',
            unlocksMoveIds: [],
            typeGraft: 'Arcane',
            learnableMoveIds: evolutionLine('abacus', 'Arcane'),
            grantsPassiveIds: ['recitation'],
          },
        ],
      },
    ],
    whirr: [
      {
        paths: [
          {
            id: 'whirr-gyre',
            heroId: 'whirr',
            name: 'Gyre',
            unlocksMoveIds: ['overdrive'],
            grantsPassiveIds: ['mainspring'],
          },
          {
            id: 'whirr-sparkwing',
            heroId: 'whirr',
            name: 'Sparkwing',
            unlocksMoveIds: ['stormLash'],
            typeGraft: 'Storm',
            learnableMoveIds: evolutionLine('whirr', 'Storm', { granted: ['stormLash'] }),
          },
          {
            id: 'whirr-nectarwing',
            heroId: 'whirr',
            name: 'Nectarwing',
            unlocksMoveIds: [],
            typeGraft: 'Nature',
            learnableMoveIds: evolutionLine('whirr', 'Nature'),
            grantsPassiveIds: ['nectar'],
          },
        ],
      },
    ],
    mellow: [
      {
        paths: [
          {
            id: 'mellow-gentleGiant',
            heroId: 'mellow',
            name: 'Gentle Giant',
            unlocksMoveIds: ['reinforce'],
            grantsPassiveIds: ['broadBack'],
          },
          {
            id: 'mellow-hotSpring',
            heroId: 'mellow',
            name: 'Hot Spring',
            unlocksMoveIds: [],
            typeGraft: 'Water',
            learnableMoveIds: evolutionLine('mellow', 'Water'),
            grantsPassiveIds: ['warmSpring'],
          },
          {
            id: 'mellow-meadow',
            heroId: 'mellow',
            name: 'Meadow',
            unlocksMoveIds: ['sow'],
            typeGraft: 'Nature',
            learnableMoveIds: evolutionLine('mellow', 'Nature', { granted: ['sow'] }),
          },
        ],
      },
    ],
  },
};
