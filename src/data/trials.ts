// The Trials (docs/constructed.md §6): fourteen authored teams, one a type, each that type's six,
// in chart order. A slot is the same TeamSlot the player builds with; test/constructed pins every
// one legal, its type's six, and an answer to every type that hits it super-effectively.

import type { ConstructedContent, TeamSlot, TrialDefinition } from '../run/constructed';
import { equipment } from './equipment';
import { heroes } from './heroes';
import { progressionTable } from './progression';

export const constructedContent: ConstructedContent = { heroes, table: progressionTable, equipment };

export const trials: Record<string, TrialDefinition> = {
  fire: {
    id: 'fire',
    type: 'Fire',
    name: 'The Kindling',
    line: 'Everything here was lit before you arrived.',
    gameplan: 'Burn both foes from the first round, then cash every Burn in — Crimson feeds on the ticks, Immolate and Flashover spend them.',
    cover: 'Tinder, Cinder and Drake carry Storm into Water; Brimstone’s Nature hits Water and Stone alike; Cinder’s Rend Armor is Iron into Stone.',
    leads: ['brimstone', 'tinder'],
    team: {
      name: 'The Kindling',
      slots: [
        {
          heroId: 'brimstone',
          pathId: 'brimstone-hexfume',
          moveIds: ['hearthfire', 'forceOfNature', 'sparkFlash', 'enfeeble'],
          itemIds: ['staff.mythic.blazing', 'orb.mythic', 'tome.mythic'],
        },
        {
          heroId: 'tinder',
          pathId: 'tinder-sparkler',
          moveIds: ['grandFinale', 'chainLightning', 'spreadingBlaze', 'flareUp'],
          itemIds: ['staff.mythic.blazing', 'wand.mythic', 'ring.mythic'],
        },
        {
          heroId: 'crimson',
          pathId: 'crimson-pyroclasm',
          moveIds: ['flashover', 'immolate', 'inferno', 'setAlight'],
          itemIds: ['staff.mythic.blazing', 'tome.mythic', 'orb.mythic'],
        },
        {
          heroId: 'cinderKnight',
          pathId: 'cinderKnight-thunderblaze',
          moveIds: ['hammerbrand', 'stormLash', 'setAlight', 'rendArmor'],
          itemIds: ['sword.mythic.blazing', 'greataxe.mythic', 'plate.mythic'],
        },
        {
          heroId: 'drake',
          pathId: 'drake-wyvern',
          moveIds: ['wyrmfire', 'shockSlice', 'firebrand', 'kindle'],
          itemIds: ['sword.mythic.blazing', 'dagger.mythic', 'boots.mythic'],
        },
        {
          heroId: 'ashwing',
          pathId: 'ashwing-sunbird',
          moveIds: ['risingPyre', 'consecrate', 'mend', 'divineGrace'],
          itemIds: ['tome.mythic', 'robe.mythic', 'crest.mythic'],
        },
      ],
    },
  },

  water: {
    id: 'water',
    type: 'Water',
    name: 'The Long Tide',
    line: 'It mends faster than you can hurt it, and every mend sharpens the claw.',
    gameplan: 'Outlast: Selkie keeps Renew on the line and every tick of it gives Kappa Attack, Pincer and Riptide hold the Shields, and Leviathan floods Water Force into the kill.',
    cover: 'Kappa’s Heavy Blow is Iron into Frost and its Rock Toss Stone into Storm; Leviathan’s Avalanche is Frost and Nautilus’s Umbral Beam Shadow into Nature; Leviathan’s Magic Bolt is Arcane into Storm.',
    leads: ['selkie', 'kappa'],
    team: {
      name: 'The Long Tide',
      slots: [
        {
          heroId: 'selkie',
          pathId: 'selkie-tidewife',
          moveIds: ['sealskinCloak', 'highTide', 'wildBloom', 'refresh'],
          itemIds: ['robe.mythic', 'tome.mythic', 'ring.mythic'],
        },
        {
          heroId: 'kappa',
          pathId: 'kappa-deepPool',
          moveIds: ['pullUnder', 'waveShred', 'heavyBlow', 'rockToss'],
          itemIds: ['sword.mythic.tidal', 'greataxe.mythic', 'plate.mythic'],
        },
        {
          heroId: 'leviathan',
          pathId: 'leviathan-deepfrost',
          moveIds: ['deepsurge', 'maelstrom', 'avalanche', 'magicBolt'],
          itemIds: ['staff.mythic.tidal', 'orb.mythic', 'wand.mythic'],
        },
        {
          heroId: 'pincer',
          pathId: 'pincer-ironshell',
          moveIds: ['vise', 'tideGuard', 'heavyBlow', 'juggernaut'],
          itemIds: ['shield.mythic', 'plate.mythic', 'crest.mythic'],
        },
        {
          heroId: 'nautilus',
          pathId: 'nautilus-mimic',
          moveIds: ['inkCloud', 'enfeeble', 'umbralBeam', 'torrent'],
          itemIds: ['tome.mythic', 'robe.mythic', 'staff.mythic.tidal'],
        },
        {
          heroId: 'tidecaller',
          pathId: 'tidecaller-tidecaller',
          moveIds: ['lizardRush', 'aquaSlice', 'iceShard', 'seawall'],
          itemIds: ['crest.mythic', 'dagger.mythic', 'sword.mythic.tidal'],
        },
      ],
    },
  },

  frost: {
    id: 'frost',
    type: 'Frost',
    name: 'The White Hold',
    line: 'The ice thickens with every blow, and the cold comes off it.',
    gameplan: 'Every Defense raise is a weapon: Frost Wall, Spire Claw and Second Skin set off Floe’s Speed drain and Rime’s Freeze, and Flurry’s Frostbite takes a fifth of every Frozen foe each round.',
    cover: 'Rime’s Spire Claw and Flurry’s Torrent hit Fire; Hush’s Umbral Beam is Shadow into Light; Rime’s Thunderclap and Floe’s Cog Bop are Storm and Mech into Iron.',
    leads: ['cube', 'glacialWarden'],
    team: {
      name: 'The White Hold',
      slots: [
        {
          heroId: 'cube',
          pathId: 'cube-shatterframe',
          moveIds: ['coldMass', 'frostWall', 'coldSnap', 'cogBop'],
          itemIds: ['shield.mythic', 'crest.mythic', 'plate.mythic'],
        },
        {
          heroId: 'glacialWarden',
          pathId: 'glacialWarden-avalanche',
          moveIds: ['permafrost', 'absoluteZero', 'torrent', 'jolt'],
          itemIds: ['staff.mythic.rimed', 'tome.mythic', 'orb.mythic'],
        },
        {
          heroId: 'rime',
          pathId: 'rime-glacier',
          moveIds: ['spireClaw', 'coldSnap', 'iceShatter', 'thunderclap'],
          itemIds: ['sword.mythic.rimed', 'shield.mythic', 'plate.mythic'],
        },
        {
          heroId: 'rimehold',
          pathId: 'rimehold-glacier',
          moveIds: ['provoke', 'whiteout', 'frostWall', 'rimeCoat'],
          itemIds: ['shield.mythic', 'plate.mythic', 'crest.mythic'],
        },
        {
          heroId: 'tusk',
          pathId: 'tusk-iceAge',
          moveIds: ['mammothCharge', 'iceShatter', 'coldSnap', 'frostArmor'],
          itemIds: ['sword.mythic.rimed', 'greataxe.mythic', 'dagger.mythic'],
        },
        {
          heroId: 'hush',
          pathId: 'hush-nightOwl',
          moveIds: ['silentDescent', 'glaciate', 'deepChill', 'umbralBeam'],
          itemIds: ['staff.mythic.rimed', 'wand.mythic', 'orb.mythic'],
        },
      ],
    },
  },

  storm: {
    id: 'storm',
    type: 'Storm',
    name: 'The Front',
    line: 'By the time the thunder reaches you, the round is over.',
    gameplan: 'Move first every round: Squall’s Tailwind and Storm Surge carry the line past the foe, Kite’s Stormkite drags them back and its Outpace stacks Intelligence while both allies lead, and priority strikes close before the other side acts.',
    cover: 'Nimbus’s Tsunami and Squall’s and Raiju’s Heavy Blow hit Stone; Tempest’s Metallic Blade is Iron into Stone; Raiju’s Rending Leap is Beast into Arcane.',
    leads: ['stormRanger', 'kite'],
    team: {
      name: 'The Front',
      slots: [
        {
          heroId: 'stormRanger',
          pathId: 'stormRanger-windshear',
          moveIds: ['galeVolley', 'stormSurge', 'skyfall', 'heavyBlow'],
          itemIds: ['sword.mythic.thundering', 'boots.mythic', 'dagger.mythic'],
        },
        {
          heroId: 'kite',
          pathId: 'kite-sunkite',
          moveIds: ['stormkite', 'stormSurge', 'thunderbolt', 'ionicZap'],
          itemIds: ['wand.mythic.thundering', 'ring.mythic', 'staff.mythic'],
        },
        {
          heroId: 'skyshear',
          pathId: 'skyshear-stormeye',
          moveIds: ['stoop', 'ionicZap', 'ionCascade', 'ionize'],
          itemIds: ['staff.mythic.thundering', 'wand.mythic', 'orb.mythic'],
        },
        {
          heroId: 'raiju',
          pathId: 'raiju-kamaitachi',
          moveIds: ['prowl', 'skyfall', 'rendingLeap', 'heavyBlow'],
          itemIds: ['sword.mythic.thundering', 'dagger.mythic', 'crest.mythic'],
        },
        {
          heroId: 'tempest',
          pathId: 'tempest-lightningRod',
          moveIds: ['twinbolt', 'ionicZap', 'metallicBlade', 'overcharge'],
          itemIds: ['wand.mythic.thundering', 'sword.mythic', 'crest.mythic'],
        },
        {
          heroId: 'nimbus',
          pathId: 'nimbus-anvilhead',
          moveIds: ['cloudburst', 'ionicZap', 'tsunami', 'tideGuard'],
          itemIds: ['boots.mythic', 'wand.mythic.tidal', 'robe.mythic'],
        },
      ],
    },
  },

  stone: {
    id: 'stone',
    type: 'Stone',
    name: 'The Return',
    line: 'Every blow thrown at the mountain comes back down the mountain.',
    gameplan: 'Invite the hits and send them back: Provoke pulls every blow onto walls that harden with each one, and Stoneheart, Retribution and the Defense-swung blows return it all.',
    cover: 'Sentinel’s Ice Shard is Frost into Water and Nature; Crag’s Claw is Beast into Nature; Dune’s Thunderclap is Storm into Iron.',
    leads: ['scree', 'crag'],
    team: {
      name: 'The Return',
      slots: [
        {
          heroId: 'scree',
          pathId: 'scree-tor',
          moveIds: ['provoke', 'rollout', 'stoneheart', 'retribution'],
          itemIds: ['shield.mythic', 'plate.mythic', 'leathers.mythic'],
        },
        {
          heroId: 'crag',
          pathId: 'crag-stonebreaker',
          moveIds: ['stoneheart', 'boulderSlam', 'iceShard', 'claw'],
          itemIds: ['greataxe.mythic.granite', 'sword.mythic', 'plate.mythic'],
        },
        {
          heroId: 'sentinel',
          pathId: 'sentinel-talonguard',
          moveIds: ['roostGuard', 'provoke', 'bodyCrush', 'iceShard'],
          itemIds: ['shield.mythic', 'crest.mythic', 'plate.mythic'],
        },
        {
          heroId: 'dune',
          pathId: 'dune-worldworm',
          moveIds: ['sandbreach', 'bodyCrush', 'stoneheart', 'thunderclap'],
          itemIds: ['sword.mythic.granite', 'spear.mythic', 'greataxe.mythic'],
        },
        {
          heroId: 'slate',
          pathId: 'slate-quakebringer',
          moveIds: ['upheaval', 'landslide', 'rockfall', 'retribution'],
          itemIds: ['staff.mythic.granite', 'crest.mythic', 'orb.mythic'],
        },
        {
          heroId: 'cairn',
          pathId: 'cairn-menhir',
          moveIds: ['raiseTheCairn', 'bodyBlow', 'provoke', 'rampart'],
          itemIds: ['tome.mythic', 'robe.mythic', 'shield.mythic'],
        },
      ],
    },
  },

  nature: {
    id: 'nature',
    type: 'Nature',
    name: 'The Undergrowth',
    line: 'Nothing here strikes twice. It only has to touch you once.',
    gameplan: 'Smother both foes in Poison from every angle at once — Morel’s spores each round, Sylva’s Renew, Hollowbark’s bark, Mordax’s and Tixwick’s blades — and let the ticks bring them under half for Guillotine.',
    cover: 'Hollowbark’s Rock Toss, Mordax’s Body Blow, Sylva’s Tremor and Lotus’s Torrent answer Fire; Mordax’s Iron Fist, Tixwick’s Serrated Slice and Sylva’s Glimmer answer Frost; Morel’s Soul Rend and Sylva’s Glimmer answer Shadow; Hollowbark’s Ice Shard and Mordax’s Thunderclap answer Beast.',
    leads: ['morel', 'wildOracle'],
    team: {
      name: 'The Undergrowth',
      slots: [
        {
          heroId: 'morel',
          pathId: 'morel-corpselight',
          moveIds: ['sporestorm', 'blight', 'soulRend', 'rootbind'],
          itemIds: ['staff.mythic.verdant', 'robe.mythic', 'tome.mythic'],
        },
        {
          heroId: 'wildOracle',
          pathId: 'wildOracle-apothecary',
          moveIds: ['regrowth', 'blightbloom', 'glimmer', 'tremor'],
          itemIds: ['robe.mythic', 'ring.mythic', 'tome.mythic'],
        },
        {
          heroId: 'hollowbark',
          pathId: 'hollowbark-rootstone',
          moveIds: ['deadfall', 'rockToss', 'iceShard', 'fortify'],
          itemIds: ['leathers.mythic', 'shield.mythic', 'plate.mythic'],
        },
        {
          heroId: 'mordax',
          pathId: 'mordax-bloomfang',
          moveIds: ['rootrend', 'ironFist', 'thunderclap', 'bodyBlow'],
          itemIds: ['spear.mythic.verdant', 'greataxe.mythic', 'dagger.mythic'],
        },
        {
          heroId: 'tixwick',
          pathId: 'tixwick-reaper',
          moveIds: ['guillotine', 'thornWhip', 'serratedSlice', 'pinDown'],
          itemIds: ['sword.mythic.verdant', 'spear.mythic', 'boots.mythic'],
        },
        {
          heroId: 'lotus',
          pathId: 'lotus-moonpond',
          moveIds: ['petalfall', 'corrode', 'torrent', 'toxicSpores'],
          itemIds: ['staff.mythic.verdant', 'orb.mythic', 'wand.mythic'],
        },
      ],
    },
  },

  light: {
    id: 'light',
    type: 'Light',
    name: 'The Sounding Bell',
    line: 'The bell keeps the hour, and on the hour the ground is holy.',
    gameplan: 'Keep Sanctuary standing all fight — Carillon’s bell tolls it every second round, Empyrean and Hart lay it between — and swing Smite and Sunlance doubled on hallowed ground.',
    cover: 'Light itself hits Shadow; Empyrean’s Magic Bolt is Arcane into both Mind and Spirit; Solace’s Psi Bolt is Mind into Spirit; Aurum’s Claw is Beast into Mind.',
    leads: ['carillon', 'empyrean'],
    team: {
      name: 'The Sounding Bell',
      slots: [
        {
          heroId: 'carillon',
          pathId: 'carillon-greatBell',
          moveIds: ['greatToll', 'sunlance', 'consecrate', 'provoke'],
          itemIds: ['sword.mythic.radiant', 'plate.mythic', 'crest.mythic'],
        },
        {
          heroId: 'empyrean',
          pathId: 'empyrean-sunborne',
          moveIds: ['sundive', 'smite', 'magicBolt', 'hallow'],
          itemIds: ['staff.mythic.radiant', 'wand.mythic', 'orb.mythic'],
        },
        {
          heroId: 'dawnwarden',
          pathId: 'dawnwarden-dawnherald',
          moveIds: ['smite', 'hallow', 'psiBolt', 'daybreak'],
          itemIds: ['staff.mythic.radiant', 'tome.mythic', 'robe.mythic'],
        },
        {
          heroId: 'aegis',
          pathId: 'aegis-vanguard',
          moveIds: ['sunlance', 'bulwarkStrike', 'bodyguard', 'benediction'],
          itemIds: ['shield.mythic', 'plate.mythic', 'crest.mythic'],
        },
        {
          heroId: 'hart',
          pathId: 'hart-whiteHart',
          moveIds: ['hallow', 'smite', 'antlerCrown', 'blindingFlash'],
          itemIds: ['robe.mythic', 'ring.mythic', 'tome.mythic'],
        },
        {
          heroId: 'aurum',
          pathId: 'aurum-pride',
          moveIds: ['sunlance', 'solarPounce', 'claw', 'sharpen'],
          itemIds: ['sword.mythic.radiant', 'dagger.mythic', 'boots.mythic'],
        },
      ],
    },
  },

  shadow: {
    id: 'shadow',
    type: 'Shadow',
    name: 'The Ill Omen',
    line: 'Whatever it meant to do to you, it will do worse.',
    gameplan: 'Hex both foes down — Jinx’s Bad Luck on every hit, Rook’s curses that each cost a foe its health and Poison it, Murk’s Bogslam and Enfeeble — then let Nightshade, Widow and Marrow cut through what is left.',
    cover: 'Shadow itself hits Light; Rook’s Wicked Fear and Mind Leech are Mind into Spirit and Light alike — the one answer to Spirit, carried twice.',
    leads: ['rook', 'jinx'],
    team: {
      name: 'The Ill Omen',
      slots: [
        {
          heroId: 'rook',
          pathId: 'rook-coven',
          moveIds: ['evilEye', 'enfeeble', 'wickedFear', 'mindLeech'],
          itemIds: ['wand.mythic.psionic', 'robe.mythic', 'ring.mythic'],
        },
        {
          heroId: 'jinx',
          pathId: 'jinx-blackCat',
          moveIds: ['crossedPath', 'shadowstrike', 'thousandCuts', 'swiftBlow'],
          itemIds: ['sword.mythic.umbral', 'dagger.mythic', 'boots.mythic'],
        },
        {
          heroId: 'murk',
          pathId: 'murk-drowner',
          moveIds: ['bogslam', 'smokeBomb', 'shadowSlice', 'rubbleRush'],
          itemIds: ['greataxe.mythic', 'plate.mythic', 'crest.mythic'],
        },
        {
          heroId: 'marrow',
          pathId: 'marrow-carrion',
          moveIds: ['deathdrink', 'eclipse', 'umbralWave', 'weaken'],
          itemIds: ['staff.mythic.umbral', 'orb.mythic', 'tome.mythic'],
        },
        {
          heroId: 'nightshade',
          pathId: 'nightshade-penumbra',
          moveIds: ['nightfall', 'duskBlade', 'rend', 'weaken'],
          itemIds: ['sword.mythic.umbral', 'bow.mythic', 'boots.mythic'],
        },
        {
          heroId: 'widow',
          pathId: 'widow-venomfang',
          moveIds: ['widowbite', 'toxicFangs', 'shadowstrike', 'duskBlade'],
          itemIds: ['dagger.mythic.umbral', 'spear.mythic', 'leathers.mythic'],
        },
      ],
    },
  },

  arcane: {
    id: 'arcane',
    type: 'Arcane',
    name: 'The Wellspring Court',
    line: 'Every drop of mana in the room ends up in one mind.',
    gameplan: 'Win the mana war: Pixie, Glyph and Trove pour mana into Zenith, whose every gained point becomes twice as much Intelligence for Singularity, while Trove’s Hoard makes every foe’s move dearer.',
    cover: 'Glyph’s Jolt and Thane’s Storm Lash are Storm into Beast; every Arcane strike on the team hits Mech, Folio’s Rune Volley and Zenith’s Culmination first among them.',
    leads: ['zenith', 'pixie'],
    team: {
      name: 'The Wellspring Court',
      slots: [
        {
          heroId: 'zenith',
          pathId: 'zenith-apex',
          moveIds: ['singularity', 'culmination', 'cataclysm', 'manaFont'],
          itemIds: ['staff.mythic.runed', 'orb.mythic', 'robe.mythic'],
        },
        {
          heroId: 'pixie',
          pathId: 'pixie-stardust',
          moveIds: ['fairyRing', 'empower', 'infuse', 'exalt'],
          itemIds: ['ring.mythic', 'tome.mythic', 'boots.mythic'],
        },
        {
          heroId: 'runescribe',
          pathId: 'runescribe-thaumaturge',
          moveIds: ['fontOfPower', 'erasure', 'jolt', 'barrier'],
          itemIds: ['staff.mythic.runed', 'orb.mythic', 'robe.mythic'],
        },
        {
          heroId: 'folio',
          pathId: 'folio-magnumOpus',
          moveIds: ['runeVolley', 'twinCast', 'arcPulse', 'resonantBolt'],
          itemIds: ['staff.mythic.runed', 'wand.mythic', 'tome.mythic'],
        },
        {
          heroId: 'thane',
          pathId: 'thane-stormbrand',
          moveIds: ['runebreaker', 'stormLash', 'magicCloak', 'wardblade'],
          itemIds: ['sword.mythic.runed', 'greataxe.mythic', 'boots.mythic'],
        },
        {
          heroId: 'trove',
          pathId: 'trove-bottomlessChest',
          moveIds: ['provoke', 'mimicsMaw', 'fontOfPower', 'bodyBlow'],
          itemIds: ['plate.mythic', 'shield.mythic', 'crest.mythic'],
        },
      ],
    },
  },

  mind: {
    id: 'mind',
    type: 'Mind',
    name: 'The Unravelling',
    line: 'Nothing is taken from you all at once. It is only taken.',
    gameplan: 'Strip every stat the foes have — Trance’s Lullaby, Drift’s Nettle, Disorient, Hollowing — and cash it in with Brain Flay at double power, while every Wisdom lost feeds Reverie’s Mind Shatter.',
    cover: 'Reverie’s Cog Slam is Mech into Arcane and Beast; Koan’s Rending Leap is Beast into Arcane; Drift’s Radiant Beam is Light and Lucius’s Soul Rend Spirit into Shadow.',
    leads: ['trance', 'mindweaver'],
    team: {
      name: 'The Unravelling',
      slots: [
        {
          heroId: 'trance',
          pathId: 'trance-puppeteer',
          moveIds: ['disorient', 'sandman', 'brainFlay', 'lull'],
          itemIds: ['staff.mythic.psionic', 'wand.mythic', 'tome.mythic'],
        },
        {
          heroId: 'mindweaver',
          pathId: 'mindweaver-construct',
          moveIds: ['mindShatter', 'mindlink', 'cogSlam', 'enervate'],
          itemIds: ['crest.mythic', 'tome.mythic', 'robe.mythic'],
        },
        {
          heroId: 'lucius',
          pathId: 'lucius-sanguine',
          moveIds: ['hollowing', 'brainFlay', 'soulRend', 'mindLeech'],
          itemIds: ['staff.mythic.psionic', 'orb.mythic', 'tome.mythic'],
        },
        {
          heroId: 'drift',
          pathId: 'drift-moonJelly',
          moveIds: ['stingingBloom', 'inkCloud', 'brainFlay', 'radiantBeam'],
          itemIds: ['staff.mythic.psionic', 'robe.mythic', 'ring.mythic'],
        },
        {
          heroId: 'motley',
          pathId: 'motley-tragedian',
          moveIds: ['motleysTrick', 'tragicomedy', 'enervate', 'brainFlay'],
          itemIds: ['staff.mythic.psionic', 'orb.mythic', 'crest.mythic'],
        },
        {
          heroId: 'koan',
          pathId: 'koan-crane',
          moveIds: ['foreseenBlow', 'rendingLeap', 'enervate', 'onslaught'],
          itemIds: ['sword.mythic.psionic', 'greataxe.mythic', 'leathers.mythic'],
        },
      ],
    },
  },

  spirit: {
    id: 'spirit',
    type: 'Spirit',
    name: 'The Bound Choir',
    line: 'Strike one of them and both answer for it.',
    gameplan: 'Haunt both foes from Dread’s first step onto the field, then every blow to one echoes into the other while Nightmare takes a fifth of each Haunted foe’s health a round and Séance lands double.',
    cover: 'Totem’s Animal Spirit is Beast into Arcane and Mind alike; Sorrow’s Dusk Blade is Shadow and Kitsu’s Arcane Blast Arcane into Mind.',
    leads: ['dread', 'revenant'],
    team: {
      name: 'The Bound Choir',
      slots: [
        {
          heroId: 'dread',
          pathId: 'dread-omen',
          moveIds: ['nevermore', 'torment', 'secondWind', 'seance'],
          itemIds: ['plate.mythic', 'robe.mythic', 'shield.mythic'],
        },
        {
          heroId: 'revenant',
          pathId: 'revenant-soulbinder',
          moveIds: ['seance', 'soulTithe', 'poltergeist', 'banish'],
          itemIds: ['staff.mythic.haunted', 'orb.mythic', 'tome.mythic'],
        },
        {
          heroId: 'sorrow',
          pathId: 'sorrow-banshee',
          moveIds: ['dirgeOfAsh', 'phantomStrike', 'duskBlade', 'wailingFlight'],
          itemIds: ['sword.mythic.haunted', 'dagger.mythic', 'leathers.mythic'],
        },
        {
          heroId: 'kitsu',
          pathId: 'kitsu-ninetails',
          moveIds: ['tailfireVolley', 'seance', 'arcaneBlast', 'wisp'],
          itemIds: ['staff.mythic.haunted', 'wand.mythic', 'orb.mythic'],
        },
        {
          heroId: 'totem',
          pathId: 'totem-spiritAnimal',
          moveIds: ['ancestorsRise', 'animalSpirit', 'torment', 'bastion'],
          itemIds: ['robe.mythic', 'crest.mythic', 'ring.mythic'],
        },
        {
          heroId: 'keen',
          pathId: 'keen-harbinger',
          moveIds: ['lastKeen', 'seance', 'poltergeist', 'lastRites'],
          itemIds: ['staff.mythic.haunted', 'tome.mythic', 'wand.mythic'],
        },
      ],
    },
  },

  iron: {
    id: 'iron',
    type: 'Iron',
    name: 'The Charged Line',
    line: 'Ferra charges the field. Every blade on the line answers it.',
    gameplan: 'Ferra leaves both foes Conducting on entry and on every Arcane hit; the line swings Metallic Blade and Overcharge free while a foe carries it, behind Warden’s Shields.',
    cover: 'Ferra’s Arcane Blast hits Storm and Mech alike; Valor’s Stoneheart and Warden’s Body Blow are Stone into Storm; Scallywag’s Aqua Slice is Water into Mech.',
    leads: ['ferra', 'ronin'],
    team: {
      name: 'The Charged Line',
      slots: [
        {
          heroId: 'ferra',
          pathId: 'ferra-magnetar',
          moveIds: ['ferrousCrush', 'arcaneBlast', 'conjuredSword', 'stunningBolt'],
          itemIds: ['staff.mythic.runed', 'orb.mythic', 'wand.mythic'],
        },
        {
          heroId: 'ronin',
          pathId: 'ronin-raijin',
          moveIds: ['drawCut', 'shockSlice', 'overcharge', 'sharpen'],
          itemIds: ['sword.mythic.tempered', 'boots.mythic', 'dagger.mythic'],
        },
        {
          heroId: 'ironWarden',
          pathId: 'ironWarden-bulwark',
          moveIds: ['wallStrike', 'bastion', 'bodyBlow', 'metallicBlade'],
          itemIds: ['shield.mythic', 'plate.mythic', 'crest.mythic'],
        },
        {
          heroId: 'valor',
          pathId: 'valor-shieldwall',
          moveIds: ['oathstrike', 'stoneheart', 'metallicBlade', 'reinforce'],
          itemIds: ['sword.mythic.tempered', 'crest.mythic', 'plate.mythic'],
        },
        {
          heroId: 'gallant',
          pathId: 'gallant-charger',
          moveIds: ['fullTilt', 'rideTheLightning', 'metallicBlade', 'onslaught'],
          itemIds: ['sword.mythic.tempered', 'dagger.mythic', 'greataxe.mythic'],
        },
        {
          heroId: 'scallywag',
          pathId: 'scallywag-seawise',
          moveIds: ['broadside', 'aquaSlice', 'metallicBlade', 'heavyBlow'],
          itemIds: ['greataxe.mythic', 'leathers.mythic', 'sword.mythic.tempered'],
        },
      ],
    },
  },

  mech: {
    id: 'mech',
    type: 'Mech',
    name: 'The Wound Spring',
    line: 'Nothing here is at full strength yet. Give it time and it will be.',
    gameplan: 'Wind up and outlast: every machine grows while the fight runs — Bellows each round, Rex each hit taken, Abacus each enemy swing, Clockwork Burning itself into Attack, Overwind each cast — while Patch mends whoever stands beside it.',
    cover: 'Thunderclap off Whirr and Bellows is Storm into Water; every Mech blow hits Arcane; Abacus’s Arcane Blast and Rex’s Pounce answer Mind.',
    leads: ['steamColossus', 'patch'],
    team: {
      name: 'The Wound Spring',
      slots: [
        {
          heroId: 'steamColossus',
          pathId: 'steamColossus-bulkhead',
          moveIds: ['boilerBlow', 'thunderclap', 'onslaught', 'cogSlam'],
          itemIds: ['greataxe.mythic.geared', 'plate.mythic', 'shield.mythic'],
        },
        {
          heroId: 'patch',
          pathId: 'patch-triage',
          moveIds: ['overhaul', 'divineGrace', 'mend', 'sparkPlug'],
          itemIds: ['robe.mythic', 'tome.mythic', 'ring.mythic'],
        },
        {
          heroId: 'rex',
          pathId: 'rex-tyrant',
          moveIds: ['devour', 'pounce', 'onslaught', 'cogSlam'],
          itemIds: ['greataxe.mythic.geared', 'dagger.mythic', 'plate.mythic'],
        },
        {
          heroId: 'abacus',
          pathId: 'abacus-arithmancer',
          moveIds: ['foregoneConclusion', 'arcaneBlast', 'meltdown', 'overheat'],
          itemIds: ['staff.mythic.geared', 'orb.mythic', 'wand.mythic'],
        },
        {
          heroId: 'forgewright',
          pathId: 'forgewright-runaway',
          moveIds: ['overwind', 'steamVent', 'volcanicSurge', 'cogSlam'],
          itemIds: ['sword.mythic.geared', 'greataxe.mythic', 'plate.mythic'],
        },
        {
          heroId: 'whirr',
          pathId: 'whirr-gyre',
          moveIds: ['wingbeatBarrage', 'thunderclap', 'overdrive', 'cogSlam'],
          itemIds: ['dagger.mythic.geared', 'sword.mythic', 'boots.mythic'],
        },
      ],
    },
  },

  beast: {
    id: 'beast',
    type: 'Beast',
    name: 'The Blood Trail',
    line: 'Once it bleeds, the pack has already decided.',
    gameplan: 'Open a Bleed on a foe and feed on it — Vex drinks every tick, Fang’s Bloodthirsty runs while one bleeds, Maul and Eviscerate hit double — behind Mellow’s Shields and Coil’s Dazes.',
    cover: 'Ursa’s Heavy Blow is Iron into Frost; Ursa’s Titanic Crush and Kong’s Boulder Slam are Stone into Storm; Coil’s Psyshock is Mind into Mech.',
    leads: ['packAlpha', 'vex'],
    team: {
      name: 'The Blood Trail',
      slots: [
        {
          heroId: 'packAlpha',
          pathId: 'packAlpha-bloodhunt',
          moveIds: ['rend', 'lacerate', 'maul', 'packHunt'],
          itemIds: ['sword.mythic.feral', 'dagger.mythic', 'boots.mythic'],
        },
        {
          heroId: 'vex',
          pathId: 'vex-nightfeeder',
          moveIds: ['exsanguinate', 'bloodTrail', 'maul', 'eviscerate'],
          itemIds: ['dagger.mythic.feral', 'sword.mythic', 'leathers.mythic'],
        },
        {
          heroId: 'ursa',
          pathId: 'ursa-grizzly',
          moveIds: ['overbear', 'heavyBlow', 'titanicCrush', 'maul'],
          itemIds: ['greataxe.mythic.feral', 'plate.mythic', 'sword.mythic'],
        },
        {
          heroId: 'kong',
          pathId: 'kong-silverback',
          moveIds: ['groundPound', 'bloodTrail', 'boulderSlam', 'lacerate'],
          itemIds: ['greataxe.mythic', 'crest.mythic', 'plate.mythic'],
        },
        {
          heroId: 'mellow',
          pathId: 'mellow-gentleGiant',
          moveIds: ['allAboard', 'bodyguard', 'bastion', 'rally'],
          itemIds: ['shield.mythic', 'robe.mythic', 'plate.mythic'],
        },
        {
          heroId: 'coil',
          pathId: 'coil-mesmer',
          moveIds: ['stranglehold', 'psyshock', 'primalRoar', 'lull'],
          itemIds: ['staff.mythic.psionic', 'tome.mythic', 'wand.mythic'],
        },
      ],
    },
  },
};

export const TRIAL_LIST: readonly TrialDefinition[] = Object.values(trials);

/** The Trial's build of a hero, as the builder's Suggested (docs/constructed.md §9): every hero is in exactly one Trial. */
export function suggestedSlotFor(heroId: string): TeamSlot | null {
  for (const trial of TRIAL_LIST) {
    const slot = trial.team.slots.find((s) => s.heroId === heroId);
    if (slot) return { ...slot, moveIds: [...slot.moveIds], itemIds: [...slot.itemIds] };
  }
  return null;
}
