// ⚠️ TEST FIXTURE CONTENT — a level-up move pool and Evolution paths for the
// fixture roster's starter heroes, enough to exercise both consequences of
// leveling end to end (docs/leveling-and-ranks.md: a level-up either "offers
// a random move" or, at EVOLUTION_LEVEL, surfaces the Evolution choice
// instead). Each
// hero's starting kit (src/data/heroes.ts) is deliberately small — a
// low-power main-type move plus 1-2 support moves — so the moveTiers pool
// below is where the rest of a hero's thematic movepool lives, offered
// randomly (not in authored order) as the hero levels up toward the 4-move
// cap (src/run/progression.ts MOVE_CAP). Not the authored 53-hero
// progression content.
//
// SCOPE NOTE: paths are stat-only (statGrants + description, no
// unlocksMoveIds) — kept deliberately separate from the level-up move pool
// so the two growth axes don't gate the same content twice. Every fixture
// hero's evolution node sits at EVOLUTION_LEVEL and offers exactly three
// paths differing in kind (CLAUDE.md "the player is presented with a choice
// of three options"): one offensive, one defensive, one utility — not every
// path grafts a type ("mono remains a legitimate terminal state",
// docs/progression.md); each hero keeps exactly one mono path as a valid
// terminal identity. `description` is the one-line flavor/mechanical pitch
// shown on the Evolution choice screen (src/view/run/LevelUpScreen.tsx) —
// this is the 2026-08-16 designer draft verbatim, not final balance copy.
//
// ironWarden and wildOracle were promoted from dual- to mono-typed in
// src/data/heroes.ts to fit this framework's mono-base-plus-graft shape
// (matching the "50/50 heroes" pattern in CLAUDE.md, even though neither is
// on that specific list) — Iron/Stone and Nature/Spirit are now reachable
// only via their defensive Evolution paths (Bulwark/Heartwood keep them
// mono; the type comes from a sibling path instead, same as any other
// hero here). Type-chart tuning is unaffected: the chart is keyed per
// single type, not per pair.
//
// cinderKnight and tidecaller's paths were renamed/retyped from an earlier
// placeholder pass (Blazing Vanguard/Ember Bulwark/Kindled Spirit, Deluge
// Adept/Glacial Bastion/Mana Current) to match the same designer draft —
// stat grants are unchanged, only names and typeGraft targets moved to line
// up with the other 10 heroes' authored framework.
//
// Lucius (dual Shadow/Mind — no typeGraft path, per the mono-only rule
// chooseEvolutionPath enforces) is the one exception to the stat-only scope
// note above: his defensive path also grants a Passive (grantsPassiveIds,
// src/run/progression.ts EvolutionPath, engine/content.ts PassiveDefinition)
// — Sanguine (src/data/passives.ts), the first Evolution-granted Passive now
// that the contract exists (engine/combat/passiveEngine.ts).

import type { ProgressionTable } from '../run/progression';
import { EVOLUTION_LEVEL } from '../run/progression';

export const progressionTable: ProgressionTable = {
  moveTiers: {
    cinderKnight: ['emberSlash', 'flareBurst', 'quickJab', 'fangRush', 'cinderNova', 'infernoWave'],
    crimson: ['emberSlash', 'infernoWave', 'cinderNova', 'arcaneBolt', 'manaBurst', 'purify'],
    tidecaller: ['aquaJet', 'tsunamiCrash', 'frostLock', 'ripCurrent', 'mendWounds', 'curseMind'],
    ironWarden: ['boulderToss', 'shrapnelBlast', 'stoneQuake', 'ironFist', 'fortify'],
    wildOracle: ['wildfire', 'vineLash', 'soulRend', 'rendingClaw', 'naturesWrath'],
    stormRanger: ['quickJab', 'thunderclap', 'galeSlash', 'fangRush'],
    shadowMonk: ['duskStrike', 'shadowVeil', 'fangRush', 'quickJab', 'nightmareGrasp'],
    marrow: ['duskStrike', 'shadowVeil', 'fangRush', 'quickJab', 'nightmareGrasp'],
    glacialWarden: ['frostBite', 'purify', 'mendWounds', 'weaken'],
    dawnwarden: ['sunstrike', 'healingRain', 'fortify', 'purify'],
    runescribe: ['mindSpike', 'psychicLance', 'weaken', 'curseMind'],
    mindweaver: ['spectralBind', 'quickJab', 'vanish', 'stunningBlow'],
    forgewright: ['ironFist', 'shrapnelBlast', 'quickJab', 'stunningBlow'],
    packAlpha: ['rendingClaw', 'quickJab', 'fortify', 'weaken'],
    // --- Stone/Spirit starters + the new Iron starter (2026-08-17) ---
    valor: ['quickJab', 'shrapnelBlast', 'stunningBlow', 'rally'],
    revenant: ['specterHowl', 'purify', 'weaken', 'curseMind'],
    crag: ['stoneQuake', 'shrapnelBlast', 'weaken', 'rally'],

    // --- Rime, Cube, Mordrax (2026-08-17) ---
    rime: ['glacialSpike', 'frostLock', 'fangRush', 'rendingClaw', 'stunningBlow', 'mendWounds'],
    cube: ['glacialSpike', 'frostLock', 'boulderToss', 'shrapnelBlast', 'ironFist'],
    mordax: ['naturesWrath', 'venomousBite', 'savageMaul', 'fangRush', 'weaken'],

    // Lucius: only his Evolutions are deferred (src/data/heroes.ts) — he
    // still grows a movepool like any other hero below EVOLUTION_LEVEL.
    lucius: ['vanish', 'nightmareGrasp', 'psychicLance', 'mindSpike'],

    // --- Hollowbark, Aegis, Brimstone, Gallant, Nightshade, Pincer,
    // Scallywag, Sentinel, Bellows, Zenith (2026-08-22) ---
    hollowbark: ['naturesWrath', 'venomousBite', 'healingRain', 'rendingClaw', 'weaken'],
    aegis: ['sunstrike', 'restoreVigor', 'purify', 'consecrate', 'stunningBlow'],
    brimstone: ['wildfire', 'nightmareGrasp', 'stokeTheFlames', 'duskStrike', 'scorchTheEarth'],
    gallant: ['shrapnelBlast', 'stunningBlow', 'fortify', 'savageMaul', 'galeShot'],
    nightshade: ['shadowVeil', 'weaken', 'curseMind', 'rendingClaw', 'stunningBlow'],
    pincer: ['tidalBolt', 'tsunamiCrash', 'ripCurrent', 'shrapnelBlast', 'frostLock'],
    scallywag: ['thunderclap', 'galeSlash', 'ironFist', 'stunningBlow', 'fangRush'],
    sentinel: ['stoneQuake', 'shrapnelBlast', 'weaken', 'ironFist', 'rally'],
    steamColossus: ['sparkForge', 'ironFist', 'stunningBlow', 'quickJab', 'boulderToss'],
    zenith: ['overload', 'psychicLance', 'mindSpike', 'curseMind', 'stasisField'],
  },
  evolutions: {
    // cinderKnight is now baseline Fire/Iron (src/data/heroes.ts, 2026-08-17)
    // rather than mono Fire grafting Iron via Evolution — none of its three
    // paths may carry a typeGraft any more (chooseEvolutionPath rejects a
    // type-graft path on an already-dual-typed hero, src/run/progression.ts),
    // so Ironclad and Thunderblaze were re-themed to amplify the existing
    // Fire/Iron kit instead of reaching for a third type.
    cinderKnight: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'cinderKnight-offensive',
            heroId: 'cinderKnight',
            kind: 'offensive',
            name: 'Explosive',
            description: 'Burn-stacking burst; leans into Consume-Burn detonations.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'cinderKnight-defensive',
            heroId: 'cinderKnight',
            kind: 'defensive',
            name: 'Ironclad',
            description: 'Armored frontliner; protect self/partner, high bulk.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'cinderKnight-utility',
            heroId: 'cinderKnight',
            kind: 'utility',
            name: 'Thunderblaze',
            description: 'Molten-forged speed; sheds bulk for tempo and priority pressure.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
          },
        ],
      },
    ],
    tidecaller: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'tidecaller-offensive',
            heroId: 'tidecaller',
            kind: 'offensive',
            name: 'Maelstrom',
            description: 'Escalating wave pressure / multi-hit.',
            statGrants: { intelligence: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'tidecaller-defensive',
            heroId: 'tidecaller',
            kind: 'defensive',
            name: 'Tidewarden',
            description: 'Sustain tank; Regen + protect.',
            statGrants: { defense: 10, wisdom: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
          },
          {
            id: 'tidecaller-utility',
            heroId: 'tidecaller',
            kind: 'utility',
            name: 'Frostbound',
            description: 'Freeze control; locks tempo, feeds Freeze→Consume lines.',
            statGrants: { manaPool: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Frost',
          },
        ],
      },
    ],
    ironWarden: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'ironWarden-offensive',
            heroId: 'ironWarden',
            kind: 'offensive',
            name: 'Sunderer',
            description: 'Armor-piercing heavy hits; cuts enemy Def.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Mech',
          },
          {
            id: 'ironWarden-defensive',
            heroId: 'ironWarden',
            kind: 'defensive',
            name: 'Bulwark',
            description: 'Redirect/protect partner — the doubles anchor.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'ironWarden-utility',
            heroId: 'ironWarden',
            kind: 'utility',
            name: 'Lodestar',
            description: 'Cleanse + ally support; the paladin path.',
            statGrants: { wisdom: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Light',
          },
        ],
      },
    ],
    wildOracle: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'wildOracle-offensive',
            heroId: 'wildOracle',
            kind: 'offensive',
            name: 'Thornwrath',
            description: 'Feral on-hit aggression; Bleed/Poison pressure.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Beast',
          },
          {
            id: 'wildOracle-defensive',
            heroId: 'wildOracle',
            kind: 'defensive',
            name: 'Heartwood',
            description: 'Regen bulwark; sustains the pair.',
            statGrants: { wisdom: 10, hp: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'wildOracle-utility',
            heroId: 'wildOracle',
            kind: 'utility',
            name: 'Augur',
            description: 'Foresight/control; status manipulation and priority steering.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Mind',
          },
        ],
      },
    ],
    stormRanger: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'stormRanger-offensive',
            heroId: 'stormRanger',
            kind: 'offensive',
            name: 'Tempest',
            description: 'High-crit, high-priority skirmisher.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'stormRanger-defensive',
            heroId: 'stormRanger',
            kind: 'defensive',
            name: 'Bedrock',
            description: 'Grounded tank; hazard/redirect.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Stone',
          },
          {
            id: 'stormRanger-utility',
            heroId: 'stormRanger',
            kind: 'utility',
            name: 'Whiteout',
            description: 'Spread slow/Freeze; tempo denial across both targets.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Frost',
          },
        ],
      },
    ],
    shadowMonk: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'shadowMonk-offensive',
            heroId: 'shadowMonk',
            kind: 'offensive',
            name: 'Nightreaver',
            description: 'High-burst assassin strikes, safest under Stealth.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'shadowMonk-defensive',
            heroId: 'shadowMonk',
            kind: 'defensive',
            name: 'Stillmind',
            description: 'Evasive sustain; self-cleanse.',
            statGrants: { wisdom: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
          },
          {
            id: 'shadowMonk-utility',
            heroId: 'shadowMonk',
            kind: 'utility',
            name: 'Nightveil',
            description: 'Daze control + debuffs; shuts a threat off.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Mind',
          },
        ],
      },
    ],
    marrow: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'marrow-offensive',
            heroId: 'marrow',
            kind: 'offensive',
            name: 'Nightreaver',
            description: 'High-burst assassin strikes, safest under Stealth.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'marrow-defensive',
            heroId: 'marrow',
            kind: 'defensive',
            name: 'Stillmind',
            description: 'Evasive sustain; self-cleanse.',
            statGrants: { wisdom: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
          },
          {
            id: 'marrow-utility',
            heroId: 'marrow',
            kind: 'utility',
            name: 'Nightveil',
            description: 'Daze control + debuffs; shuts a threat off.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Mind',
          },
        ],
      },
    ],
    glacialWarden: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'glacialWarden-offensive',
            heroId: 'glacialWarden',
            kind: 'offensive',
            name: 'Avalanche',
            description: 'Freeze-then-shatter burst (Consume-Freeze).',
            statGrants: { intelligence: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'glacialWarden-defensive',
            heroId: 'glacialWarden',
            kind: 'defensive',
            name: 'Glacier',
            description: 'Immovable tank; max Def, endure.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Stone',
          },
          {
            id: 'glacialWarden-utility',
            heroId: 'glacialWarden',
            kind: 'utility',
            name: 'Permafrost',
            description: 'Spread Freeze/slow; area control.',
            statGrants: { manaPool: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Water',
          },
        ],
      },
    ],
    dawnwarden: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'dawnwarden-offensive',
            heroId: 'dawnwarden',
            kind: 'offensive',
            name: 'Sunflare',
            description: 'Radiant burst; Burn pressure.',
            statGrants: { intelligence: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Fire',
          },
          {
            id: 'dawnwarden-defensive',
            heroId: 'dawnwarden',
            kind: 'defensive',
            name: 'Sanctuary',
            description: 'Healer-tank; Regen + protect.',
            statGrants: { wisdom: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
          },
          {
            id: 'dawnwarden-utility',
            heroId: 'dawnwarden',
            kind: 'utility',
            name: 'Dawnherald',
            description: 'Cleanse/buff support; the classic support priest.',
            statGrants: { manaPool: 10, mpRegen: 5 },
            unlocksMoveIds: [],
          },
        ],
      },
    ],
    runescribe: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'runescribe-offensive',
            heroId: 'runescribe',
            kind: 'offensive',
            name: 'Spellstorm',
            description: 'Raw Int nuke; scaling burst.',
            statGrants: { intelligence: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'runescribe-defensive',
            heroId: 'runescribe',
            kind: 'defensive',
            name: 'Sigilward',
            description: 'Barrier/ward tank.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Stone',
          },
          {
            id: 'runescribe-utility',
            heroId: 'runescribe',
            kind: 'utility',
            name: 'Loreweaver',
            description: 'Setup/control; status steering.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Mind',
          },
        ],
      },
    ],
    mindweaver: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'mindweaver-offensive',
            heroId: 'mindweaver',
            kind: 'offensive',
            name: 'Mindrend',
            description: 'Daze-punishing burst.',
            statGrants: { intelligence: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'mindweaver-defensive',
            heroId: 'mindweaver',
            kind: 'defensive',
            name: 'Adamant',
            description: 'Mental + physical bulk; status resistance.',
            statGrants: { defense: 10, wisdom: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Iron',
          },
          {
            id: 'mindweaver-utility',
            heroId: 'mindweaver',
            kind: 'utility',
            name: 'Dominion',
            description: 'Control lock — Daze, Haunt, domination debuffs.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Shadow',
          },
        ],
      },
    ],
    forgewright: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'forgewright-offensive',
            heroId: 'forgewright',
            kind: 'offensive',
            name: 'Overdrive',
            description: 'Ramping heavy hitter; Atk builds over turns.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'forgewright-defensive',
            heroId: 'forgewright',
            kind: 'defensive',
            name: 'Juggernaut',
            description: 'Armored machine; max bulk, endure.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Iron',
          },
          {
            id: 'forgewright-utility',
            heroId: 'forgewright',
            kind: 'utility',
            name: 'Boilover',
            description: 'Steam control — Burn spread + hazard/tempo.',
            statGrants: { manaPool: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Water',
          },
        ],
      },
    ],
    packAlpha: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'packAlpha-offensive',
            heroId: 'packAlpha',
            kind: 'offensive',
            name: 'Bloodhunt',
            description: 'Bleed-momentum aggressor.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'packAlpha-defensive',
            heroId: 'packAlpha',
            kind: 'defensive',
            name: 'Stonehide',
            description: 'Thick-hide bruiser; endure.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Stone',
          },
          {
            id: 'packAlpha-utility',
            heroId: 'packAlpha',
            kind: 'utility',
            name: 'Warhowl',
            description: 'Pack-support — partner buffs, the doubles-facing path.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
          },
        ],
      },
    ],

    // --- Stone/Spirit starters + the new Iron starter (2026-08-17) ---
    valor: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'valor-offensive',
            heroId: 'valor',
            kind: 'offensive',
            name: 'Crusader',
            description: 'All-out armored assault; raw Attack.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'valor-defensive',
            heroId: 'valor',
            kind: 'defensive',
            name: 'Bastion',
            description: 'Shield-wall anchor; protect partner, max Defense.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Stone',
          },
          {
            id: 'valor-utility',
            heroId: 'valor',
            kind: 'utility',
            name: 'Dawnblade',
            description: 'Righteous support; cleanse and speed control.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Light',
          },
        ],
      },
    ],
    revenant: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'revenant-offensive',
            heroId: 'revenant',
            kind: 'offensive',
            name: 'Wraithblade',
            description: 'Draining spectral assault; raw Intelligence.',
            statGrants: { intelligence: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'revenant-defensive',
            heroId: 'revenant',
            kind: 'defensive',
            name: 'Hollow Warden',
            description: 'Undying bulwark; bleeds momentum from the living.',
            statGrants: { defense: 10, wisdom: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Shadow',
          },
          {
            id: 'revenant-utility',
            heroId: 'revenant',
            kind: 'utility',
            name: 'Soulbinder',
            description: 'Control and setup; status steering from beyond.',
            statGrants: { manaPool: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Mind',
          },
        ],
      },
    ],
    crag: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'crag-offensive',
            heroId: 'crag',
            kind: 'offensive',
            name: 'Stonebreaker',
            description: 'Rock-fisted heavy hitter; raw Attack.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'crag-defensive',
            heroId: 'crag',
            kind: 'defensive',
            name: 'Mountainheart',
            description: 'Immovable armored mass; max bulk.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Iron',
          },
          {
            id: 'crag-utility',
            heroId: 'crag',
            kind: 'utility',
            name: 'Warden of Roots',
            description: 'Overgrown guardian; sustain and support.',
            statGrants: { wisdom: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Nature',
          },
        ],
      },
    ],

    // --- Crimson, Rime, Cube, Mordrax (2026-08-17) ---
    crimson: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'crimson-offensive',
            heroId: 'crimson',
            kind: 'offensive',
            name: 'Pyroclasm',
            description: 'Unrestrained magical firepower; raw Int nuke.',
            statGrants: { intelligence: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'crimson-defensive',
            heroId: 'crimson',
            kind: 'defensive',
            name: 'Cinderveil',
            description: 'Wreathes itself in protective embers; a bulkier caster.',
            statGrants: { wisdom: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
          },
          {
            id: 'crimson-utility',
            heroId: 'crimson',
            kind: 'utility',
            name: 'Emberweave',
            description: 'Fuses flame with raw arcane current; efficient, sustained casting.',
            statGrants: { manaPool: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Arcane',
          },
        ],
      },
    ],
    rime: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'rime-offensive',
            heroId: 'rime',
            kind: 'offensive',
            name: 'Iceclaw',
            description: 'Raw talon aggression; hits like a diving strike.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'rime-defensive',
            heroId: 'rime',
            kind: 'defensive',
            name: 'Direwing',
            description: 'Apex-predator instincts harden it into a Frost/Beast bulwark.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Beast',
          },
          {
            id: 'rime-utility',
            heroId: 'rime',
            kind: 'utility',
            name: 'Farsight',
            description: 'Preternatural foresight; reads the whole field before it moves.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Mind',
          },
        ],
      },
    ],
    cube: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'cube-offensive',
            heroId: 'cube',
            kind: 'offensive',
            name: 'Shatterframe',
            description: 'Sharpens its frozen edges into a genuine offensive threat.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'cube-defensive',
            heroId: 'cube',
            kind: 'defensive',
            name: 'Permafrost Core',
            description: 'Its frozen shell hardens into an armored, near-immovable block.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Iron',
          },
          {
            id: 'cube-utility',
            heroId: 'cube',
            kind: 'utility',
            name: 'Cryolattice',
            description: 'Crystalline lattice growth; a slow, grinding area-control build.',
            statGrants: { wisdom: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Stone',
          },
        ],
      },
    ],
    mordax: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'mordax-offensive',
            heroId: 'mordax',
            kind: 'offensive',
            name: 'Bloomfang',
            description: 'Thorn and claw working together; raw aggression.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'mordax-defensive',
            heroId: 'mordax',
            kind: 'defensive',
            name: 'Ironbark',
            description: 'Bark hardens to something closer to stone than wood.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Stone',
          },
          {
            id: 'mordax-utility',
            heroId: 'mordax',
            kind: 'utility',
            name: 'Wildheart',
            description: 'Leans fully into its feral side; faster, hungrier.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Beast',
          },
        ],
      },
    ],

    lucius: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'lucius-offensive',
            heroId: 'lucius',
            kind: 'offensive',
            name: 'Voidcaller',
            description: 'Leans fully into raw spellpower, restraint be damned.',
            statGrants: { intelligence: 10, speed: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'lucius-defensive',
            heroId: 'lucius',
            kind: 'defensive',
            name: 'Sanguine',
            description: "Feeds on the enemy's open wounds — heals for every point of Bleed damage they take, from any source.",
            statGrants: { hp: 10, wisdom: 10 },
            unlocksMoveIds: [],
            grantsPassiveIds: ['sanguine'],
          },
          {
            id: 'lucius-utility',
            heroId: 'lucius',
            kind: 'utility',
            name: 'Cipher',
            description: 'Trades offense for a deep, self-sustaining mana reserve.',
            statGrants: { manaPool: 10, mpRegen: 5 },
            unlocksMoveIds: [],
          },
        ],
      },
    ],

    // --- Hollowbark, Aegis, Brimstone, Gallant, Nightshade, Pincer,
    // Scallywag, Sentinel, Bellows, Zenith (2026-08-22) — Brimstone
    // and Bellows are already dual-typed, so per the mono-only graft
    // rule none of their paths carry a typeGraft (same treatment as
    // cinderKnight/lucius above).
    hollowbark: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'hollowbark-offensive',
            heroId: 'hollowbark',
            kind: 'offensive',
            name: 'Thornheart',
            description: 'Thorn and root turned weapon; raw Attack.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'hollowbark-defensive',
            heroId: 'hollowbark',
            kind: 'defensive',
            name: 'Rootstone',
            description: 'Bark petrifies into bark-over-stone armor.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Stone',
          },
          {
            id: 'hollowbark-utility',
            heroId: 'hollowbark',
            kind: 'utility',
            name: 'Wraithwood',
            description: 'The hollow trunk lets something else move in.',
            statGrants: { wisdom: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
          },
        ],
      },
    ],
    aegis: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'aegis-offensive',
            heroId: 'aegis',
            kind: 'offensive',
            name: 'Vanguard',
            description: 'Shield becomes spear; leads the charge instead of holding the line.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'aegis-defensive',
            heroId: 'aegis',
            kind: 'defensive',
            name: 'Warforged',
            description: 'The shield-arm becomes literal, unbreakable iron.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Iron',
          },
          {
            id: 'aegis-utility',
            heroId: 'aegis',
            kind: 'utility',
            name: 'Sanctified',
            description: 'A guardian blessing extended to the whole team.',
            statGrants: { wisdom: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
          },
        ],
      },
    ],
    brimstone: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'brimstone-offensive',
            heroId: 'brimstone',
            kind: 'offensive',
            name: 'Cauldronborn',
            description: 'The pot boils over; raw Intelligence.',
            statGrants: { intelligence: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'brimstone-defensive',
            heroId: 'brimstone',
            kind: 'defensive',
            name: 'Ashguard',
            description: 'Caked-on ash and cinder harden into a crude shell.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'brimstone-utility',
            heroId: 'brimstone',
            kind: 'utility',
            name: 'Hexfume',
            description: 'A choking, cursed smoke that lingers over the field.',
            statGrants: { wisdom: 10, mpRegen: 5 },
            unlocksMoveIds: [],
          },
        ],
      },
    ],
    gallant: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'gallant-offensive',
            heroId: 'gallant',
            kind: 'offensive',
            name: 'Charger',
            description: 'All-out lance rush; raw Attack.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'gallant-defensive',
            heroId: 'gallant',
            kind: 'defensive',
            name: 'Rampart',
            description: 'Barded and braced; an immovable cavalry wall.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Stone',
          },
          {
            id: 'gallant-utility',
            heroId: 'gallant',
            kind: 'utility',
            name: 'Oathbound',
            description: 'The knightly oath made literal; a radiant, faster escort.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Light',
          },
        ],
      },
    ],
    nightshade: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'nightshade-offensive',
            heroId: 'nightshade',
            kind: 'offensive',
            name: 'Umbral',
            description: 'Pure killing focus; raw Attack.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'nightshade-defensive',
            heroId: 'nightshade',
            kind: 'defensive',
            name: 'Wraithstep',
            description: 'Half a step out of the material world at all times.',
            statGrants: { wisdom: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
          },
          {
            id: 'nightshade-utility',
            heroId: 'nightshade',
            kind: 'utility',
            name: 'Duskweaver',
            description: 'Reads intent before the strike lands; control over kill.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Mind',
          },
        ],
      },
    ],
    pincer: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'pincer-offensive',
            heroId: 'pincer',
            kind: 'offensive',
            name: 'Tideclaw',
            description: 'Bigger claws, harder strikes; raw Attack.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'pincer-defensive',
            heroId: 'pincer',
            kind: 'defensive',
            name: 'Ironshell',
            description: 'The carapace hardens past shell into plate.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Iron',
          },
          {
            id: 'pincer-utility',
            heroId: 'pincer',
            kind: 'utility',
            name: 'Brinefrost',
            description: 'Retreats to colder water; slows everything around it.',
            statGrants: { manaPool: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Frost',
          },
        ],
      },
    ],
    scallywag: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'scallywag-offensive',
            heroId: 'scallywag',
            kind: 'offensive',
            name: 'Corsair',
            description: 'No quarter given; raw Attack.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'scallywag-defensive',
            heroId: 'scallywag',
            kind: 'defensive',
            name: 'Ironhull',
            description: 'Scavenged plate lashed over the coat; built to take a boarding fight.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Iron',
          },
          {
            id: 'scallywag-utility',
            heroId: 'scallywag',
            kind: 'utility',
            name: 'Seawise',
            description: 'Reads the water and the wind; always a step ahead.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Water',
          },
        ],
      },
    ],
    sentinel: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'sentinel-offensive',
            heroId: 'sentinel',
            kind: 'offensive',
            name: 'Talonguard',
            description: 'Drops from its perch; raw Attack.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'sentinel-defensive',
            heroId: 'sentinel',
            kind: 'defensive',
            name: 'Cathedral',
            description: 'Iron reinforcement worked into the stone; a load-bearing wall of a hero.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Iron',
          },
          {
            id: 'sentinel-utility',
            heroId: 'sentinel',
            kind: 'utility',
            name: 'Gloomwatch',
            description: 'Keeps its vigil after dark; wards and unsettles in equal measure.',
            statGrants: { wisdom: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
          },
        ],
      },
    ],
    steamColossus: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'steamColossus-offensive',
            heroId: 'steamColossus',
            kind: 'offensive',
            name: 'Redline',
            description: 'Every safety valve welded shut; raw Attack.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'steamColossus-defensive',
            heroId: 'steamColossus',
            kind: 'defensive',
            name: 'Bulkhead',
            description: 'Plated past the point of reason; max bulk.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'steamColossus-utility',
            heroId: 'steamColossus',
            kind: 'utility',
            name: 'Overpressure',
            description: 'Vents building steam into a longer, more efficient burn.',
            statGrants: { manaPool: 10, mpRegen: 5 },
            unlocksMoveIds: [],
          },
        ],
      },
    ],
    zenith: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'zenith-offensive',
            heroId: 'zenith',
            kind: 'offensive',
            name: 'Apex',
            description: 'Unrestrained arcane output; raw Intelligence.',
            statGrants: { intelligence: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'zenith-defensive',
            heroId: 'zenith',
            kind: 'defensive',
            name: 'Halo',
            description: 'The orb blooms into a standing radiant shield.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Light',
          },
          {
            id: 'zenith-utility',
            heroId: 'zenith',
            kind: 'utility',
            name: 'Oracle',
            description: 'Reads the whole field at once; setup and control.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Mind',
          },
        ],
      },
    ],
  },
};
