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
//   - Any line may print an icon inline by naming it in brackets: `[physical]`, `[magical]`,
//     `[heal]`, `[buff]`, `[debuff]`. It renders the same badge the move buttons wear, so the
//     mark in the sentence is the mark the player is being sent to look for. A misspelt token
//     prints literally and fails `test/tutorial.test.ts`.
//   - `TUTORIAL_FIGHT_CUES` are the mid-fight lines, checked at the start of every command
//     phase. Order is priority order — the first unseen cue whose `when` holds is the one shown.
//   - `TUTORIAL_ENCOUNTERS` is who you actually fight; `TUTORIAL_PAYOUTS` is what a win pays.
//   - `TUTORIAL_LOCKS` is what the act refuses to let the player skip.

import type { MapNodeType } from '../run/map';
import type { TutorialBeat, TutorialEncounter, TutorialFightCue, TutorialLocks, TutorialPayout } from '../run/tutorial';

// --- Locks ---

/**
 * The three choices Act 1 takes away, so the lessons behind them cannot be walked past
 * (2026-09-06, per user direction). Each lifts the moment its lesson lands; none survives Act 1.
 *
 * Flurry is the forced recruit because she is the roster's least ambiguous MAGICAL specialist —
 * 25 Attack against 80 Intelligence, and a damage move that is magical. The split between the
 * two pipelines is invisible until the player holds one of each, and no draft can be relied on
 * to hand them one. She is then locked onto the field for the warband and the Guardian, because
 * the Goblin Lord is authored at 75 Defense against 60 Wisdom: her Rime Wind reads 42 on him
 * where Valor's Iron Fist reads 20 and Fang's Claw reads 30 — and she is not even strong against
 * him, since the Ancient half halves her Frost right back. That one screen is the whole lesson,
 * and nothing had to be staged for it.
 */
export const TUTORIAL_LOCKS: TutorialLocks = {
  focusHeroId: 'valor',
  recruitHeroId: 'glacialWarden',
  fieldHeroId: 'glacialWarden',
  fieldAtNodes: ['battle', 'boss'],
};

// --- Curated encounters ---

/**
 * Act 1's fights, forced. The pairings are the lesson:
 *
 *  - `fight` — two soft goblins, one of whom (Shadow) Fang half-resists. No super-effective
 *    exists here on purpose: the opener teaches the loop, not the chart.
 *  - `skirmish` — two Frost heroes. Frost doubles into Fang's Beast and halves into Valor's
 *    Iron, so the same move reads two ways on one screen. It is also the recruit the Guardian
 *    is weak to, which is the whole shape of the act: what beats you beats what is ahead. Rime
 *    swings physical and Flurry casts, so the pair is also the first place the two damage
 *    pipelines stand side by side (`TUTORIAL_LOCKS` forces Flurry onto the roster).
 *  - `battle` — the Chief as a body to grind, two basics as the bench lesson.
 *  - `boss` — two of the faction's own basics, because that is what a Guardian is everywhere
 *    else (run-loop.md "The Guardian's escorts"): the Grunt is a Beast for the caster to double
 *    into, the Warrior is Iron so teeth do little to it. The Goblin Lord rides the bench as he
 *    always does (locations.ts `guardianFinalEnemyId`) and walks on after the first KO.
 *
 *    He is also the physical/magical proof, and it needed no staging: 75 Defense against 60
 *    Wisdom, so Flurry's Rime Wind reads 42 where Valor's Iron Fist reads 20 and Fang's Claw
 *    reads 30 — and she is not even strong against him, the seal halves her too. Two pipelines,
 *    one enemy, and the enemy is the one the whole act has been walking toward.
 */
export const TUTORIAL_ENCOUNTERS: Partial<Record<MapNodeType, TutorialEncounter>> = {
  // The opener is the ONLY scripted fight that needed propping up. Two authored-as-fodder
  // Goblins died to one round of Valor and Fang — Iron Fist reads 40 x (60/25) x 1.25 = ~120
  // into a 100 HP Grunt — which took every round-2 lesson with them. Defense is most of the
  // grant because the ratio, not the HP, is what was ending it: +35 takes Valor's read from
  // 2.4x down to ~1.0x, and the fight from one round to three or four.
  fight: { heroIds: ['goblinGrunt', 'goblinSkulker'], statGrants: { hp: 25, defense: 35 } },
  skirmish: { heroIds: ['rime', 'glacialWarden'] },
  battle: { heroIds: ['goblinChief', 'goblinGrunt', 'goblinSkulker'] },
  boss: { heroIds: ['goblinGrunt', 'goblinWarrior'] },
};

/**
 * What a scripted win pays, replacing the normal roll. `TUTORIAL_LOCKS.focusHeroId` sends every
 * point to Valor until she evolves, so these figures are a schedule rather than a hope: 4 takes
 * her to level 3, the Skirmish's 8 takes her to 5, and the Evolution therefore lands on the
 * level-up screen straight after the Skirmish — the same beat that hands over Flurry. The
 * warband's 10 then arrives with the lock already lifted and the whole roster spendable.
 *
 * 22 XP before the Guardian against a 10-point cost to reach level 5; 160 gold at the Guild
 * Hall against a 50-gold hero.
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
      'Fang and I have been walking toward this valley for a year. The journey truly begins now.',
      'A Titan cannot be killed. It can only be bound. It is up to us to appease it.',
      'Five Guardians stand between us and the Pact.',
      { speaker: 'fang', text: 'Woof.' },
      'Seal the pact and we go.',
    ],
  },
  {
    id: 'arrival',
    topic: 'The Map',
    lines: [
      "Wild's Edge. Everything lives out here, and most of it would rather we did not.",
      'Normally, this map branches and you choose your own road. Not today. Today there is one way through, and I will tell you what every stop on it is for.',
      'Venture forth when you are ready.',
    ],
  },

  // --- Row 0: the opener ---
  {
    id: 'map:fight',
    topic: 'Monsters',
    lines: [
      'Goblins. Two of them, two of us. Every fight in this world is two against two.',
      'Fang and I are both on the field at once. Each round you give us an order apiece: a move, and who it lands on. Nothing happens until we have both been told.',
      'Monsters tend to hold valuable loot that will aid us on this journey.',
    ],
  },
  {
    id: 'gem',
    topic: 'Gems',
    lines: [
      'A Gem. That is a relic, and a relic benefits us all. The same bonus on me, on Fang, and on anyone we pick up later.',
      'They stack, forever. We will collect many across these lands.',
      'Pick the one you want carried for the rest of the journey.',
    ],
  },
  {
    id: 'equip',
    topic: 'Equipment',
    lines: [
      'Gear. Each of us can hold one weapon, one armor, and one accessory.',
      'Equip it on one of us or throw it away.',
    ],
  },
  {
    id: 'levelUp',
    topic: 'Experience',
    lines: [
      'Experience teaches us new ways to fell our foes. Give it to any of us, even heroes who did not participate in the battle.',
      'A level does not raise my numbers. It teaches me a new move, or progresses me toward evolution.',
      'The first level costs one point, the next two, the next three.',
      'For now, give it all to me. There is something I need to reach, and I will show you when I get there.',
    ],
  },

  // --- Row 1: equipment cache ---
  {
    id: 'map:equipmentReward',
    topic: 'Choosing',
    lines: [
      'A cache. Three pieces, you take one.',
      'Some of us may want different specialties than others. Observe what the equipment does before choosing.',
    ],
  },
  {
    id: 'reward:equipmentReward',
    lines: [
      'Equipment comes in various rarities, but sometimes rare does not mean better.',
    ],
  },

  // --- Row 2: the Mentor ---
  {
    id: 'map:classReward',
    topic: 'Mentor',
    lines: [
      'Someone up there teaches. Each of us may learn one class. The decision is permanent.',
      'We will find more of these on the road ahead.',
    ],
  },
  {
    id: 'classNode',
    lines: ['Three on offer. Choose one, then who will learn it.'],
  },

  // --- Row 3: the Skirmish ---
  {
    id: 'map:skirmish',
    topic: 'Skirmish',
    lines: [
      'A Skirmish. These are always against other Pactbearers, just like us. When they go down, we can recruit one.',
      'You are carrying a Recruit Contract. One beaten hero, straight onto our roster, at whatever strength they were beaten at. Six is the cap and we are two, so there is room.',
      'Both of them are of the Frost element. Cold eats a Beast such as Fang. We must deal with them quickly.',
      { speaker: 'fang', text: 'Woof.' },
      'Watch how differently they fight. One strikes with their hands. The other with magic.',
    ],
  },
  {
    id: 'recruit',
    topic: 'Recruit Contract',
    lines: [
      'Take the caster. This one is not a choice.',
      'Fang and I strike with our bodies. What we do is measured against what the enemy is wearing.',
      'She does not. What she casts is measured against their mind instead, and armor does nothing to stop it.',
      'We will need one of each. There is something at the end of this valley we do not pass without her.',
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
      'The caster starts on the field. I want you flying her before it matters.',
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
      'Ancient. Everything is resisted by it. Nothing we own is strong against him, and nothing ever will be. That is what a seal is.',
      'So we do not out-type him. We out-last him.',
      'Two of his warband stand in front. Clear them and he comes out — that is how every Guardian we meet will be arranged.',
      'Keep the caster on the field the whole way. When he arrives, do not just look at the colors. Look at the numbers.',
    ],
  },
  {
    id: 'outro',
    topic: 'One Seal Down',
    lines: [
      'The lock is broken and the valley is quiet. Five more of those, and then the thing they were holding.',
      'From here the map branches, the choices are yours, and I stop telling you which way to walk.',
      'You know the shape of it now. Doubles, Mana, types, the two kinds of damage, gear, relics, levels, contracts. Everything after this is those eight things pointed at harder problems.',
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
      'The blue gem shows the MP cost to cast the move. At the end of each round, everyone recovers a little bit of MP.',
      'Resting is always an option, and it fully recovers your MP. Sometimes, Rest is the only available choice.',
      'Speed decides who actually swings first, and you will not always be the one who does.',
      'At any time, you can tap on a hero or an enemy to view their capabilities.',
    ],
  },
  {
    id: 'fight:types',
    node: 'fight',
    when: { minRound: 2 },
    topic: 'Damage',
    lines: [
      'Watch the numbers on the move buttons. Type advantages are key, and resistances sometimes even moreso.',
    ],
  },
  {
    id: 'fight:rest',
    node: ['fight', 'skirmish', 'battle', 'boss'],
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
      'Note the numbers on the move buttons. My Iron strikes for double against Frost foes.',
      'Fang, on the other hand, struggles in this matchup. It may be worth using his turn to bolster our Attack.',
      'At any time, you may hold a move button to see exactly what it does before you commit.',
    ],
  },
  {
    id: 'skirmish:pipelines',
    node: 'skirmish',
    when: { round: 2 },
    topic: 'Two Kinds of Hit',
    lines: [
      'Watch them closely. The one throwing shards is using a PHYSICAL [physical] move, and it is weighed against my Defense.',
      'The other one is MAGICAL [magical], and my Defense is irrelevant. It goes against my Wisdom instead.',
      'Every move in the game wears one mark or the other. Look for it before you commit.',
    ],
  },
  {
    id: 'skirmish:focus',
    node: 'skirmish',
    when: { minRound: 3 },
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
    id: 'battle:magic',
    node: 'battle',
    when: { round: 2 },
    topic: 'The Caster',
    lines: [
      'Look at her sheet. Twenty-five Attack. She could not break a branch with her hands.',
      'Eighty Intelligence, though. That is what her wind is measured with, and it goes against their Wisdom, which nothing out here bothers to have.',
      'Two of us who hit armor, one of us who goes around it. That is why I made you take her.',
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
      'His warband, not him. The green one is a Beast, and cold doubles into a Beast — send the caster at it.',
      'The other is Iron. Claws and teeth barely mark it, so do not waste a Beast on that one.',
      'Kill one and the Lord takes its place. Be ready.',
    ],
  },
  {
    id: 'boss:ancient',
    node: 'boss',
    when: { enemyOnField: 'goblinLord' },
    topic: 'Ancient',
    lines: [
      'There he is.',
      'Everything reads half against that second color. There is no answer to it, and there never will be.',
      'So stop reading colors and read the numbers. Hold each of our moves over him before you commit.',
      'A fist is weighed against his Defense. Her wind is weighed against his Wisdom. He is not equally armored against both, and almost nothing ever is.',
      'That is the half of the formula most people never look at. Look at it.',
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
