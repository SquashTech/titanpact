// What the people met on the road say before their screen (RoadEncounter). One is drawn per meeting.

export const MENTOR_LINES: readonly string[] = [
  'Hold a moment, travellers. The road ahead is cruel to the untaught. Let me show one of you something.',
  'You carry the pact-mark. I felt it three valleys off. Sit by my fire, and send me your most willing student.',
  'I have walked this road since before your Titan slept. One lesson, then go. Who will learn it?',
  'Ah. Another company chasing the dark. Good. The last ones did not stop to listen. Will you?',
  'Every blade I ever taught is buried somewhere on this road. Choose well who carries the next one.',
];

export const TUTOR_LINES: readonly string[] = [
  'You made it this far. Most do not. Show me your strongest, and I will show them what strength is for.',
  'I do not teach twice, and I do not teach the timid. Send me one who is ready.',
  'The Titan grows restless, and so do I. One of you. One lesson. Make it count.',
  'Steel remembers every hand that held it. Let one of yours hold something worth remembering.',
  'I have buried better students than yours. Prove me wrong about them.',
];

export const SCRIBE_LINES: readonly string[] = [
  'Oh! Travellers. Hold still, I am writing you down. There. Now, two of you, let us see what you have learned.',
  'Every deed on this road ends up in my ledger sooner or later. Yours are overdue. Who first?',
  'The Mastery is in the telling as much as the doing. Give me two names and I will write them into it.',
  'I copy what the old heroes knew, a line at a time. Two of you, sit. This will not take long.',
  'Careful, the ink is still wet. I have pages here that were meant for someone. Perhaps for you.',
];

export const GUILDMASTER_LINES: readonly string[] = [
  'Come in, come in, shut the door on that wind. Coin buys a sword arm here, and the fire is free.',
  'Pact-bound, are you? Then you will want steady hands behind you. I have a few for hire, for the right price.',
  'Every company that passes through here leaves a little lighter. Mostly in the purse. Let us see about yours.',
  'The mead is warm, the blades are sharp, and the sellswords are only mostly sober. What will it be?',
  'Ah, the road has not killed you yet. Good for you. Better for business. Step inside.',
];

export const VIGIL_LINES: readonly string[] = [
  'So you have broken every seal. I kept the lamps lit for you. Take what you need; there is no coming back from where you go next.',
  'The last company to stand here never returned. Spend every coin you have. You will not need it after tonight.',
  'I have seen the Herald from my window. It is waiting for you. Rest, gather yourselves, and then go end this.',
];

export const SMITH_LINES: readonly string[] = [
  'Mind the sparks. Hand me something worth the heat and I will make it sing.',
  'Your gear is dented, chipped, and a disgrace to whoever forged it. Give it here. One piece, done right.',
  'Out here the ore is good and the fire is hotter than any town forge. Pick your piece, and pick the element to bind in it.',
  'I do not sell. I do not haggle. I make one thing better, once, and then you walk on.',
  'Heard you coming three hills off, clanking like a tinker cart. Sit. Let us fix that.',
];

/** The places met on the road, keyed by map node type: a name and the lines narrated over it. */
export const PLACE_LINES: Record<string, { name: string; lines: readonly string[] }> = {
  passiveReward: {
    name: 'A Wayside Shrine',
    lines: [
      'A shrine older than the road, its star still burning. It will bless one of you, and only one.',
      'Moss has taken the steps, but not the light above them. Something here is still listening.',
      'Pilgrims left offerings here once. Now there is only the star, and whoever kneels first.',
    ],
  },
  equipmentReward: {
    name: 'A Forgotten Chest',
    lines: [
      'A chest half sunk in the grass, its owner long gone. The lock gives at the first touch.',
      'Iron-banded and heavy, abandoned by the roadside. Whoever left it here left in a hurry.',
      'Coins glint around a sealed chest. Either a trap, or the luckiest turn in the road so far.',
    ],
  },
  currencyReward: {
    name: 'A Spilled Purse',
    lines: [
      'A merchant\'s purse, split open in the dirt. No merchant in sight, and no one to argue.',
      'Gold and a few stray gems, scattered where a cart overturned. Finders keepers.',
      'A sack of coin left under a milestone, as if for you. Best not to ask.',
    ],
  },
  scrollReward: {
    name: 'A Crate of Scrolls',
    lines: [
      'A crate of old teachings, ribbon still on every roll. Three of them are worth reading.',
      'Someone\'s library, dumped by the roadside. The ink is faded, the lessons are not.',
      'Scrolls, stacked and sealed, waiting for hands that know what to do with them.',
    ],
  },
  restReward: {
    name: 'A Quiet Camp',
    lines: [
      'A tent already pitched, a fire already laid. For one night, the road can wait.',
      'Warm embers, a dry tent, and nothing hunting you. Rest while you can.',
      'Someone camped here and moved on. Their fire still takes a spark.',
    ],
  },
  manaWellReward: {
    name: 'An Old Well',
    lines: [
      'The water at the bottom glows blue. One of you could drink deep enough to hold more of it.',
      'A well sunk into a vein of pure mana. It hums when you lean over the edge.',
      'The rope is rotten but the light below is not. Let one of you draw from it.',
    ],
  },
  leyLineReward: {
    name: 'A Ley Stone',
    lines: [
      'Runes crawl across the standing stone, and the ground beneath it thrums with power.',
      'A ley line surfaces here, bright as a vein of lightning. It will bind itself to one of you.',
      'The stone is warm to the touch. Whoever lays a hand on it will not be quite the same.',
    ],
  },
};

/** The fallen Guardian's last words over the Crucible — its fire, handed on. */
export const CRUCIBLE_LINES: readonly string[] = [
  'My fire does not go out. It only changes hands. Choose who will carry it.',
  'You broke me, so you have earned what burned in me. Give it to one of yours.',
  'I was the seal. Now I am only heat. Step into it, one of you, and come out something more.',
  'Take what is left of me. Temper one of yours in it, and see what they become.',
];
