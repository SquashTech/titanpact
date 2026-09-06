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
 * What a scripted win pays, replacing the roll. The totals are a NORMAL Act 1's, deliberately:
 * a tutorial that pays better than the game would make erasing your profile the strongest opening
 * move, which is nonsense. Against `trainingPointsFor` at act 1 this is 13 XP for 13, and against
 * `goldRewardFor`'s bands it is 77 gold against a ~77.5 average.
 *
 * One point is MOVED, not added: the warband pays 4 where a normal battle pays 3, and the
 * Guardian pays 3 where a normal one pays 4. Normal income is 9 before the Guardian and reaching
 * the Evolution costs 10, so on the true table Valor would evolve one fight too late — after the
 * act's apex fight rather than before it, which is the one place the lesson has to land. Moving a
 * point earlier buys that without buying any power.
 *
 * `TUTORIAL_LOCKS.focusHeroId` is what makes 10 enough rather than lucky: every point goes to
 * Valor, so 2 puts her at level 2, the Skirmish's 4 at level 4, and the warband's 4 at 5. There is
 * no slack in that — `test/tutorial.test.ts` holds both ends, the floor and the ceiling.
 */
export const TUTORIAL_PAYOUTS: Partial<Record<MapNodeType, TutorialPayout>> = {
  fight: { xp: 2, gold: 20 },
  skirmish: { xp: 4, gold: 20 },
  battle: { xp: 4, gold: 37 },
  boss: { xp: 3, gold: 0 },
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
      'Monsters tend to hold valuable loot that will aid us on this journey.',
    ],
  },
  {
    id: 'gem',
    topic: 'Gems',
    lines: [
      'A Gem. That is a relic, and a relic benefits us all. The same bonus on me, Fang, and anyone we pick up later.',
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
      'We will find more of these Mentors on the road ahead.',
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
      'Take the caster. They provide something that we lack.',
      'Fang and I strike with our Attack. We struggle against enemies with high Defense.',
      'Flurry does not. They cast with Intelligence, which is measured against Wisdom instead.',
      'A healthy balance is pivotal to success. There is something at the end of this valley we do not pass without it.',
    ],
  },

  // --- Row 4: the relic ---
  {
    id: 'map:relicReward',
    topic: 'Relics',
    lines: [
      'A relic. It affects us all, like the Gem.',
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
      'A chief and his warband.',
      'We are a team of three now, meaning one must sit on the bench. Whoever sits there regenerates Mana every round, and you can bring them in whenever you like. Switching costs a turn and nothing else.',
      "Let's bring the caster to the field for this one. Their abilities may come in handy.",
    ],
  },
  {
    id: 'evolution',
    topic: 'Evolution',
    lines: [
      'There. Five levels in and the road forks.',
      'The choice is permanent for the rest of the journey. My potential varies wildly, and it is up to you to choose my fate.',
      'Press and hold any of the buttons for a detailed description of what each path entails.',
    ],
  },

  // --- Row 6: the Guild Hall ---
  {
    id: 'map:shop',
    topic: 'Guild Hall',
    lines: [
      'Last stop before the Guardian. Gold buys three things here: a hero outright, a piece of gear, or another recruit contract.',
    ],
  },
  {
    id: 'shop',
    lines: ['A fourth body is worth more than anything else, if the coin is there.'],
  },

  // --- Row 7: the Guardian ---
  {
    id: 'map:boss',
    topic: 'The Guardian',
    lines: [
      'The Goblin Lord. He is not a goblin the way the others are goblins. He is a Guardian, and he holds one of the five seals.',
      'He is known as an Ancient. Nothing we own is strong against him, and nothing ever will be.',
      'Two of his warband stand in front. Clear one of them and he comes out, so be sure that we are well-prepared.',
    ],
  },
  {
    id: 'outro',
    topic: 'One Seal Down',
    lines: [
      'The lock is broken and the valley is quiet. Four more of those, and the Titanpact will be forged.',
      'From here the map branches, the choices are yours, and you are on your own.',
      { speaker: 'fang', text: 'Woof.' },
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
      'Fang and I are both on the field at once. Each round, you give us both an order: a move, and the target.',
      'Pick one of my moves, then do the same for Fang.',
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
      'I have nothing left to cast. I must Rest. It costs me the turn, but I will regain all of my Mana.',
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

  // --- The warband ---
  {
    id: 'battle:switch',
    node: 'battle',
    when: { round: 1 },
    topic: 'Switching',
    lines: [
      'Anyone on the bench is filling their Mana back up while they wait.',
      'Careful maneuvering of the squad is essential to success.',
    ],
  },
  {
    id: 'battle:magic',
    node: 'battle',
    when: { round: 2 },
    topic: 'The Caster',
    lines: [
      "Look at Flurry's stat sheet. 25 Attack. Barely enough to scratch them.",
      '80 Intelligence, though. That is what her magic is measured with, and it goes against their Wisdom, which nothing out here bothers to have.',
    ],
  },
  {
    id: 'battle:spread',
    node: 'battle',
    when: { round: 3 },
    topic: 'Spread',
    lines: [
      'One more thing about Flurry. Rime Wind does not pick a target, but rather, it lands on everything across from us at once.',
      'Look for the ⇉ Spread mark on a move. Sometimes striking both is better than striking one.',
    ],
  },

  // --- The Guardian ---
  {
    id: 'boss:escorts',
    node: 'boss',
    when: { round: 1 },
    topic: 'The Escorts',
    lines: [
      'His warband. Far less threatening than what awaits us.',
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
      'Everything deals half against an Ancient. Type advantages alone will not win us this battle.',
      'Choose your moves carefully. Remember that you can hold down a move button to examine it before you commit.',
      'You can also click on him to see what he specializes in. Strategize accordingly.',
    ],
  },
  {
    id: 'boss:clock',
    node: 'boss',
    when: { minRound: 5 },
    topic: 'The Pact Clock',
    lines: [
      'One more thing, and I hope you never need it.',
      'No fight is allowed to last forever. Far enough in, the Titan grows restless, and will begin to tear apart the fabric of reality.',
      'Everybody will die. We must end the battle before that happens.',
    ],
  },
];
