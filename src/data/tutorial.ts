// The scripted first run — CONTENT. Everything Valor says lives here, and every number the
// scripted Act 1 pins. Mechanism is src/run/tutorial.ts; design notes are docs/tutorial.md.
//
// EDITING THIS FILE
//   - `TUTORIAL_SCRIPT` is the dialogue. A bare string is a Valor line; `{ speaker: 'fang' }`
//     gives the line to Fang. `topic` is the small header over the box — the mechanic being
//     named. Lines advance on tap, one at a time.
//   - A beat's `id` is the moment it fires at. `map:<nodeType>` fires on the map with that node
//     ahead; `reward:<nodeType>` on that reward node's own screen; the rest name a screen.
//     Deleting a beat silently removes it; nothing else has to change.
//   - `TUTORIAL_FIGHT_CUES` are the mid-fight lines, checked at the start of every command
//     phase. Order is priority order — the first unseen cue whose `when` holds is the one shown.
//   - `TUTORIAL_ENCOUNTERS` is who you actually fight; `TUTORIAL_PAYOUTS` is what a win pays.

import type { MapNodeType } from '../run/map';
import type { TutorialBeat, TutorialEncounter, TutorialFightCue, TutorialPayout } from '../run/tutorial';

// --- Curated encounters ---

/**
 * Act 1's fights, forced. The pairings are the lesson:
 *
 *  - `fight` — two soft goblins, one of whom (Shadow) Fang half-resists. No super-effective
 *    exists here on purpose: the opener teaches the loop, not the chart.
 *  - `skirmish` — two Frost heroes. Frost doubles into Fang's Beast and halves into Valor's
 *    Iron, so the same move reads two ways on one screen. It is also the recruit the Guardian
 *    is weak to, which is the whole shape of the act: what beats you beats what is ahead.
 *  - `battle` — the Chief as a body to grind, two basics as the bench lesson.
 *  - `boss` — one escort each: Stone for Valor's Iron, Nature for Fang's Beast. The Goblin Lord
 *    rides the bench as he always does (locations.ts `guardianFinalEnemyId`) and walks on after
 *    the first KO, which is when the Ancient wall gets explained.
 */
export const TUTORIAL_ENCOUNTERS: Partial<Record<MapNodeType, TutorialEncounter>> = {
  fight: { heroIds: ['goblinGrunt', 'goblinSkulker'] },
  skirmish: { heroIds: ['rime', 'glacialWarden'] },
  battle: { heroIds: ['goblinChief', 'goblinGrunt', 'goblinSkulker'] },
  boss: { heroIds: ['sentinel', 'wildOracle'] },
};

/**
 * What a scripted win pays, replacing the normal roll. Tuned so that following Valor's advice
 * (pour it into one hero) puts Valor at the Evolution level on the Level Up screen after the
 * `battle`, and spreading it evenly still gets somebody there. 22 XP before the Guardian
 * against a 10-point cost to reach level 5; 160 gold at the Guild Hall against a 50-gold hero.
 */
export const TUTORIAL_PAYOUTS: Partial<Record<MapNodeType, TutorialPayout>> = {
  fight: { xp: 4, gold: 25 },
  skirmish: { xp: 8, gold: 30 },
  battle: { xp: 10, gold: 65 },
  boss: { xp: 4, gold: 0 },
};

// --- Dialogue ---

export const TUTORIAL_SCRIPT: readonly TutorialBeat[] = [
  {
    id: 'intro',
    topic: 'The Pact',
    lines: [
      'Fang and I have been walking toward this valley for a year. You are the last piece of it.',
      'A Titan cannot be killed. It can only be bound — and binding runs both ways. Something has to hold the other end of the leash.',
      'That is you. We are the hands. You are the will.',
      { speaker: 'fang', text: 'Less talking. Treeline.' },
      'Seal the pact and we go.',
    ],
  },
  {
    id: 'arrival',
    topic: 'The Map',
    lines: [
      "Wild's Edge. Everything lives out here, and most of it would rather we did not.",
      'Normally this map branches and you choose your own road. Not today. Today there is one way through, and I will tell you what every stop on it is for.',
      'Tap the node above us when you are ready.',
    ],
  },

  // --- Row 0: the opener ---
  {
    id: 'map:fight',
    topic: 'Monsters',
    lines: [
      'Goblins. Two of them, two of us — every fight in this world is two against two.',
      'Fang and I are both on the field at once. Each round you give us an order apiece: a move, and who it lands on. Nothing happens until we have both been told.',
      'Monsters, this one. Nothing here is worth recruiting — you just take what falls off them.',
    ],
  },
  {
    id: 'gem',
    topic: 'Gems',
    lines: [
      'A Gem. That is a relic, and a relic is team-wide — the same bonus on me, on Fang, and on anyone we pick up later.',
      'They stack, forever. Two Sapphires is ten more Mana on everybody.',
      'Pick the one you want carried for the rest of the run.',
    ],
  },
  {
    id: 'equip',
    topic: 'Equipment',
    lines: [
      'Gear. Three slots each — weapon, armour, accessory — and it belongs to one hero, not the team. That is the whole difference between this and the Gem.',
      'There is no bag to put it in. Equip it on one of us or throw it away. Those are the two doors.',
    ],
  },
  {
    id: 'levelUp',
    topic: 'Experience',
    lines: [
      'Experience is a pot, not a bar. You spend it on whichever of us you like — and a hero who sat out the fight can still be raised.',
      'A level does not raise my numbers. It teaches me a move. That is what growth is, here.',
      'The first level costs one point, the next two, the next three. Spreading it thin is cheap; going deep on one of us is not. Both are real plans.',
      'Mine, if you are asking. I want to show you something later.',
    ],
  },

  // --- Row 1: equipment cache ---
  {
    id: 'map:equipmentReward',
    topic: 'Choosing',
    lines: [
      'A cache. Three pieces, you take one.',
      'Read what the numbers actually do before you touch it. A big number on the wrong hero is a small number.',
    ],
  },
  {
    id: 'reward:equipmentReward',
    lines: [
      'Rarity is a budget, not a promise. A Common on the right shoulders beats an Epic on the wrong ones.',
    ],
  },

  // --- Row 2: the Mentor ---
  {
    id: 'map:classReward',
    topic: 'Mentor',
    lines: [
      'Someone up there teaches. A Class is a permanent shape — one per hero, one per run, and it does not come off.',
      'There are four of these on the road ahead, so you need not spend it on me. Spend it on whoever you have decided this run is about.',
    ],
  },
  {
    id: 'classNode',
    lines: ['Three on offer. Read them against who we already are, not against which one sounds best.'],
  },

  // --- Row 3: the Skirmish ---
  {
    id: 'map:skirmish',
    topic: 'Skirmish',
    lines: [
      'Not goblins. Pactbearers, same as us — which means when they go down, you can claim one.',
      'You are carrying a Recruit Contract. One beaten hero, straight onto our roster, at whatever strength they were beaten at. Six is the cap and we are two, so there is room.',
      'Frost, both of them. Cold eats a Beast, Fang — that will hurt. It runs off me.',
      { speaker: 'fang', text: 'Then stand in front.' },
    ],
  },
  {
    id: 'recruit',
    topic: 'Recruit Contract',
    lines: [
      'Take one of them. I will tell you why at the end of this valley.',
      'A contract keeps everything they had when they fell — their level, their moves, their growth. Not their gear. Gear stays on the corpse.',
    ],
  },

  // --- Row 4: the relic ---
  {
    id: 'map:relicReward',
    topic: 'Relics',
    lines: [
      'A relic. Team-wide, like the Gem, but a relic carries more than a flat number — it changes how the team works.',
      'Everyone gets it. Everyone we ever recruit gets it. That is why they are worth walking toward.',
    ],
  },
  {
    id: 'reward:relicReward',
    lines: ['Three. One comes with us for the rest of the run.'],
  },

  // --- Row 5: the warband ---
  {
    id: 'map:battle',
    topic: 'The Bench',
    lines: [
      'A chief and his warband. More of them than of us, which means somebody watches from the bench.',
      'The bench is not a punishment. Whoever sits there regenerates Mana every round, and you can bring them in whenever you like. Switching costs a turn and nothing else.',
      'One warning. Once a side has lost two heroes, that side can no longer switch at all — the doors close and it becomes a straight grind. Do your cycling early.',
    ],
  },
  {
    id: 'evolution',
    topic: 'Evolution',
    lines: [
      'There. Five levels in and the road forks.',
      'This is not a bigger number. It is a different hero, and it is permanent for the rest of the run.',
      'Defensive, offensive, or something stranger. Read all three. You are choosing what I am for.',
    ],
  },

  // --- Row 6: the Guild Hall ---
  {
    id: 'map:shop',
    topic: 'Guild Hall',
    lines: [
      'Last stop before the Guardian. Gold buys three things here: a hero outright, a piece of gear, or another blank contract.',
      'Spend it. There is nothing on the far side of this that takes coin.',
    ],
  },
  {
    id: 'shop',
    lines: ['A fourth body is worth more than a fourth trinket, if the coin is there.'],
  },

  // --- Row 7: the Guardian ---
  {
    id: 'map:boss',
    topic: 'The Guardian',
    lines: [
      'The Goblin Lord. He is not a goblin the way the others are goblins. He is a warden, and half of what he is is the seal itself.',
      'Ancient. Everything is resisted by it. Nothing you own is strong against him and nothing ever will be — that is what a seal is.',
      'So you do not out-type him. You out-last him.',
      "Two escorts stand in front of him. The stone one is mine; the green one is Fang's. Take them in that order.",
      'And keep the Frost one you claimed swinging. Cold is what a Beast fears, and under all that Ancient he is still a Beast.',
    ],
  },
  {
    id: 'outro',
    topic: 'One Seal Down',
    lines: [
      'The lock is broken and the valley is quiet. Five more of those, and then the thing they were holding.',
      'From here the map branches, the choices are yours, and I stop telling you which way to walk.',
      'You know the shape of it now. Doubles, Mana, types, gear, relics, levels, contracts. Everything after this is those seven things pointed at harder problems.',
      { speaker: 'fang', text: 'Good. Walk.' },
    ],
  },
];

// --- Mid-fight cues ---

/**
 * Checked at the start of every command phase; the first unseen cue whose conditions all hold is
 * shown. Order in this array is priority order, so a round-1 lesson beats a standing condition
 * that happens to be true at the same moment.
 */
export const TUTORIAL_FIGHT_CUES: readonly TutorialFightCue[] = [
  // --- The opener ---
  {
    id: 'fight:command',
    node: 'fight',
    when: { round: 1 },
    topic: 'Command',
    lines: [
      'Pick one of my moves, then pick who it lands on. Then do the same for Fang.',
      'Speed decides who actually swings first, and you will not always be the one who does.',
    ],
  },
  {
    id: 'fight:types',
    node: 'fight',
    when: { round: 2 },
    topic: 'Damage',
    lines: [
      'Watch the numbers on the move buttons. Shadow runs off Fang at half strength — the chart is doing that, not luck.',
      'Every move also rolls a little high or low each time. Plan for the low roll.',
    ],
  },
  {
    id: 'fight:mana',
    node: 'fight',
    when: { minRound: 2 },
    topic: 'Mana',
    lines: [
      'Every move costs Mana, and only a trickle comes back each round.',
      'The expensive ones are expensive because they are good. That is the whole balance of this game in one sentence.',
    ],
  },
  {
    id: 'fight:rest',
    node: 'fight',
    when: { outOfMana: true },
    topic: 'Rest',
    lines: [
      'I have nothing left to cast. Rest — it hands the whole pool back and costs me the turn.',
      'Better than swinging at air. Sometimes it is the right play even when I could still afford something.',
    ],
  },

  // --- The Skirmish ---
  {
    id: 'skirmish:chart',
    node: 'skirmish',
    when: { round: 1 },
    topic: 'Type Advantage',
    lines: [
      'Frost into Iron is half. Frost into Beast is double. Same move, two very different afternoons.',
      'Hold a move button to see exactly what it does to each of them before you commit.',
    ],
  },
  {
    id: 'skirmish:focus',
    node: 'skirmish',
    when: { minRound: 2 },
    topic: 'Focus',
    lines: [
      'Put both of us on the same one. Two enemies standing at half health hit you twice as hard as one at full.',
    ],
  },
  {
    id: 'skirmish:hurt',
    node: 'skirmish',
    when: { playerHpBelow: 0.4 },
    topic: 'Pressure',
    lines: [
      'This is where a bench would have been useful. We do not have one yet — which is exactly what the contract at the end of this is for.',
    ],
  },

  // --- The warband ---
  {
    id: 'battle:switch',
    node: 'battle',
    when: { round: 1 },
    topic: 'Switching',
    lines: [
      'Anyone on the bench is filling their Mana back up while they wait.',
      'Pull whoever is hurting out, send them back in later. It costs the turn, not the round.',
    ],
  },
  {
    id: 'battle:locked',
    node: 'battle',
    when: { lockedIn: true },
    topic: 'Locked In',
    lines: [
      'Two of us down. The doors are shut — no more switching for either side.',
      'This is the other half of the fight, and it is a grind. Nothing clever left. Just be the one still standing.',
    ],
  },

  // --- The Guardian ---
  {
    id: 'boss:escorts',
    node: 'boss',
    when: { round: 1 },
    topic: 'The Escorts',
    lines: [
      'Stone in front of me, Nature in front of Fang. Both of those are double damage for the right one of us.',
      'Clear them and the field is ours before he is even out.',
    ],
  },
  {
    id: 'boss:ancient',
    node: 'boss',
    when: { enemyOnField: 'goblinLord' },
    topic: 'Ancient',
    lines: [
      'There he is.',
      'Everything reads half against that second colour. There is no answer to it — you just keep hitting and you do not die first.',
      'Cold first. Keep me between him and the rest.',
    ],
  },
  {
    id: 'boss:clock',
    node: 'boss',
    when: { minRound: 8 },
    topic: 'The Pact Clock',
    lines: [
      'One more thing, and I hope you never need it.',
      'No fight is allowed to last forever. Far enough in, the failing seal starts taking its weight out of everyone on the field — both sides, bench included, and nothing stops it.',
      'A stall does not win here. It just kills everybody.',
    ],
  },
];
