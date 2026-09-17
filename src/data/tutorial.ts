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
 * to hand them one. She is then locked onto the field for the Guardian, because
 * the Manticore is authored at 75 Defense against 60 Wisdom: her Rime Wind reads 42 on it
 * where Valor's Iron Fist reads 20 and Fang's Claw reads 30 — and she is not even strong against
 * it, since the Ancient half halves her Frost right back. That one screen is the whole lesson,
 * and nothing had to be staged for it.
 */
export const TUTORIAL_LOCKS: TutorialLocks = {
  recruitHeroId: 'glacialWarden',
  fieldHeroId: 'glacialWarden',
  fieldAtNodes: ['boss'],
};

// --- Curated encounters ---

/**
 * Act 1's fights, forced. The pairings are the lesson:
 *
 *  - `fight` — two Early spawn, one of whom (Shadow) Fang half-resists. No super-effective
 *    exists here on purpose: the opener teaches the loop, not the chart.
 *  - `skirmish` — two Frost heroes. Frost doubles into Fang's Beast and halves into Valor's
 *    Iron, so the same move reads two ways on one screen. It is also the recruit the Guardian
 *    is weak to, which is the whole shape of the act: what beats you beats what is ahead. Rime
 *    swings physical and Flurry casts, so the pair is also the first place the two damage
 *    pipelines stand side by side (`TUTORIAL_LOCKS` forces Flurry onto the roster).
 *  - `boss` — two Early spawn, because that is what a Guardian's escorts are everywhere else
 *    (run-loop.md "The Guardian's escorts"): the Cubling is a Beast for the caster to double
 *    into, the Rivetling is Iron so teeth do little to it. The Manticore rides the bench as it
 *    always does (locations.ts `guardianFinalEnemyId`) and walks on after the first KO.
 *
 *    The spawn stand exactly where the Goblins stood (Beast/Shadow, Beast, Beast/Iron), so the
 *    Frost/Iron/Beast chart the act is built on is unchanged (docs/tutorial.md). The lines are
 *    still Valor's first draft against a mob layer that has since been replaced — the rewrite is
 *    deferred until the systems are complete (docs/titanspawn-overhaul.md §9).
 *
 *    He is also the physical/magical proof, and it needed no staging: 75 Defense against 60
 *    Wisdom, so Flurry's Rime Wind reads 42 where Valor's Iron Fist reads 20 and Fang's Claw
 *    reads 30 — and she is not even strong against it, the seal halves her too. Two pipelines,
 *    one enemy, and the enemy is the one the whole act has been walking toward.
 */
export const TUTORIAL_ENCOUNTERS: Partial<Record<MapNodeType, TutorialEncounter>> = {
  // The opener is the ONLY scripted fight that needed propping up. Two authored-as-fodder
  // bodies die to one round of Valor and Fang — Iron Fist reads 40 x (60/30) x 1.25 = ~100
  // into a 76 HP Cubling — which takes every round-2 lesson with them. Defense is most of the
  // grant because the ratio, not the HP, is what ends it: +35 takes Valor's read from 2x
  // down to ~0.9x, and the fight from one round to three or four.
  fight: { heroIds: ['cubling', 'duskling'], statGrants: { hp: 50, defense: 35 } },
  skirmish: { heroIds: ['rime', 'glacialWarden'] },
  boss: { heroIds: ['cubling', 'rivetling'] },
};

/**
 * What a scripted win pays. XP is DELIBERATELY ABSENT: the scripted act takes the same
 * experience a normal one does, so that erasing a profile to replay the tutorial is never the
 * strongest opening move in the run. It used to pay double.
 *
 * XP is not pinned because there is nothing to pin (2026-09-10): levels are automatic and
 * roster-wide, and the act's fights pay the whole roster the same authored XP (run/growth.ts
 * ENCOUNTER_XP_BY_ACT) whatever the player does.
 *
 * Gold IS pinned, and only to its own average (goldRewardFor rolls 15-25 for a fight or Skirmish). Not for power — 77 against a ~77.5 mean — but for determinism: Valor tells the
 * player what to spend at the Guild Hall, so what they are holding when they get there cannot be
 * a coin flip. The warband `battle` and its 37 went with the fourth fight (2026-09-14).
 */
export const TUTORIAL_PAYOUTS: Partial<Record<MapNodeType, TutorialPayout>> = {
  fight: { gold: 20 },
  skirmish: { gold: 20 },
  boss: { gold: 0 },
};

// --- Dialogue ---

export const TUTORIAL_SCRIPT: readonly TutorialBeat[] = [
  {
    id: 'intro',
    topic: 'The Pact',
    lines: [
      "We're finally here, Fang.",
      'Five Guardians stand between us and the Titan.',
      { speaker: 'fang', text: 'Woof.' },
      'Many others will try, but we must succeed. If we do not complete the Pact with the Titan, we will all be met with the end of times.',
      'Seal the Pact and we go.',
    ],
  },
  {
    id: 'arrival',
    topic: 'The Map',
    lines: [
      "Wild's Edge. The Titan's leak runs thin out here, and many others are attempting to complete the Pact.",
      'Venture forth when you are ready.',
    ],
  },

  // --- Row 0: the opener ---
  {
    id: 'map:fight',
    topic: 'Titanspawn',
    lines: [
      'A couple of Titanspawn — what leaks through the seal, still small this far out. They surely have some valuable loot that will aid us on the journey. We will take them on together.',
    ],
  },
  {
    id: 'equip',
    topic: 'Equipment',
    lines: [
      'Loot. Whatever we find is given to one of us on the spot, and it stays with them — nothing comes off, so choose who it suits.',
      'Each of us can carry three. Hand a piece to someone already carrying its like and the two are forged into something better. Hold the piece to read it, hold one of us to read a sheet.',
    ],
  },
  {
    id: 'levelUp',
    topic: 'Growing',
    lines: [
      'Every fight we win hardens all of us — the ones who stood in it and the ones who did not. You will never have to choose who grows.',
      'What we grow INTO is not up to either of us. Each of my statistics rolls on its own, against whatever I am naturally suited to. My sheet on the Roster shows those leanings.',
      'And every few levels, a level teaches. A new move is offered from whatever I am ready for — take it or let it go, it will not come round again. Deeper down the same road is where each of us evolves.',
    ],
  },

  // --- Row 1: equipment cache ---
  {
    id: 'map:equipmentReward',
    topic: 'Choosing',
    lines: [
      'A cache. We get one of three items.',
      'Some of us may want to focus on different stats than others. Observe what the equipment does before choosing.',
    ],
  },
  {
    id: 'reward:equipmentReward',
    lines: [
      'Equipment comes in various rarities, but rare does not always mean better.',
    ],
  },

  // --- Row 2: the Mentor ---
  {
    id: 'map:mentorReward',
    topic: 'Mentor',
    lines: [
      'A Mentor. They can teach any one of us a powerful move — which move is theirs to choose, not ours.',
      'We will find more of these Mentors on the road ahead, until the road gets too hard for them to help.',
    ],
  },
  {
    id: 'mentorNode',
    lines: ['Choose which of us learns.'],
  },

  // --- Row 4: the Scribe ---
  {
    id: 'map:scribeReward',
    topic: 'The Scribe',
    lines: [
      'A Scribe. Every act has one, and they hand out Mastery Scrolls — two each, to two of us.',
      'Five Scrolls and a hero Evolves: a new form, chosen from three. Ten, and they master their signature move. The Scribe starts us off; where the rest come from is ours to find.',
    ],
  },
  {
    id: 'scribeNode',
    lines: ['Choose two of us.'],
  },

  // --- Row 5: the Skirmish ---
  {
    id: 'map:skirmish',
    topic: 'Skirmish',
    lines: [
      'A Skirmish. These are always against other Pactbearers, just like us. When they go down, we can recruit one among their ranks as long as we have a Recruit Contract.',
      'There can only be a maximum of six of us on a team. Recruits beyond that point will force one out, and whatever they carried goes with them.',
      'Both of these enemies are of the Frost element. Cold eats a Beast such as Fang. We must deal with them quickly.',
      { speaker: 'fang', text: 'Woof.' },
    ],
  },
  {
    id: 'recruit',
    topic: 'Recruit Contract',
    lines: [
      'Take the caster. They provide something that we lack.',
      'Fang and I strike with our Attack. Therefore, we struggle against enemies with high Defense.',
      'Flurry does not. They cast with Intelligence, which is measured against Wisdom instead.',
      'A healthy balance is pivotal to success.',
    ],
  },

  // --- Row 3: the boon ---
  {
    id: 'map:passiveReward',
    topic: 'The Boon',
    lines: [
      'A shrine. It offers three boons, and one of us takes one — a lasting knack, kept for the rest of the journey.',
      'Read what each does before choosing, and give it to whoever can make the most of it.',
    ],
  },

  {
    id: 'crucible',
    topic: 'The Crucible',
    lines: [
      'The Guardian is down, and the fire of the Crucible is lit. One of us walks into it and comes out with a Class — a discipline any of us could take.',
      'A move, or a talent. The choice is permanent for the rest of the journey, and each Guardian lights the fire once.',
    ],
  },

  // --- Row 6: the Scroll Cache ---
  {
    id: 'map:scrollReward',
    topic: 'Scroll Cache',
    lines: [
      'Someone came this way before us, and did not leave with what they were carrying.',
      'Three Mastery Scrolls, and these are ours to divide as we like. Put all three on one of us and they are that much closer to Evolving — or spread them, if you would rather nobody is far from it.',
    ],
  },

  // --- Row 7: the Guild Hall ---
  {
    id: 'map:shop',
    topic: 'Guild Hall',
    lines: [
      'Last stop before the Guardian. Gold buys four things here: a hero outright, a piece of gear, another recruit contract, or a Mastery Scroll.',
    ],
  },
  {
    id: 'shop',
    lines: ['A fourth hero is worth more than anything else.'],
  },

  // --- Row 7: the Guardian ---
  {
    id: 'map:boss',
    topic: 'The Guardian',
    lines: [
      'The Manticore. It is no spawn. It is a Guardian, and it holds one of the five seals.',
      'It is known as an Ancient. Nothing we own is strong against it, and nothing ever will be.',
      'Two of its brood stand in front. Clear one of them and it comes out, so be sure that we are well-prepared.',
      'We are more than two now, so some of us must sit on the bench. Whoever sits there regenerates Mana every round, and you can bring them in whenever you like. Switching costs only a turn.',
      "Let's bring the caster to the field for this one. Their abilities may come in handy.",
    ],
  },
  {
    id: 'outro',
    topic: 'One Seal Down',
    lines: [
      'The first lock is broken. Four more of those, and the Titanpact will be forged.',
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
      'All battles in this world are 2v2. Each round, you give us both an order: a move, and the target.',
      'Pick one of my moves, then do the same for Fang.',
      'The blue gem shows the MP cost to cast the move. At the end of each round, everyone recovers a little bit of MP.',
      'Resting is always an option, and it fully recovers your MP. Sometimes, Rest is the only available choice.',
      'Speed decides the order that we strike. The coin at each fighter\'s shoulder is their place in it — Fang is quicker than anyone else on the field, so act accordingly.',
      'At any time, you can tap on a hero or an enemy to view their capabilities, or tap a coin to hear who moves when.',
    ],
  },
  {
    id: 'fight:rest',
    node: ['fight', 'skirmish', 'boss'],
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
      'Note the effectiveness numbers on the move buttons. My Iron strikes for 2x against Frost foes.',
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
      'Watch them closely. The one throwing shards is using a PHYSICAL [physical] moves, and it is weighed against my Defense.',
      'The snowman is MAGICAL [magical], so my Defense is irrelevant. It goes against my Wisdom instead.',
      'Every attack in the game uses one or the other. Look for it before you commit.',
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
    id: 'boss:magic',
    node: 'boss',
    when: { round: 2 },
    topic: 'The Caster',
    lines: [
      "Flurry's stat sheet shows a pitiful Attack stat. However, their Intelligence is impressive. Their Rime Wind will be effective here.",
      'Rime Wind does not pick a target. It is a ⇉ Spread move, meaning it strikes both of the enemies.',
    ],
  },
  {
    id: 'boss:ancient',
    node: 'boss',
    when: { enemyOnField: 'manticore' },
    topic: 'Ancient',
    lines: [
      'There it is.',
      'Everything deals half against an Ancient. Type advantages alone will not win us this battle.',
      'Choose your moves carefully. Remember that you can hold down a move button to examine it before you commit.',
      'You can also click on it to see what it specializes in. Strategize accordingly.',
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
