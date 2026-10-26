// Blip's thoughts (docs/the-sky.md §1): chatty, a little silly, never a rule and never a verdict on
// the player's picks. Each entry's lines are its bubbles, in order. Grouped by moment.

import type { ThoughtDefinition } from '../run/thoughts';

export const THOUGHTS: readonly ThoughtDefinition[] = [
  {
    id: 'firstSky',
    moment: { kind: 'firstSky' },
    once: true,
    forced: true,
    showsNext: 'firstLight',
    plays: 'firstLight.hunt',
    scene: 'fall',
    lines: [
      'Oh, hi! Sorry, I would’ve cleaned up a bit, but I wasn’t expecting company.',
      'So, this is my job. I watch over one little world. Well... a LOT of versions of it.',
      'In most of them, a Titan wakes up and... um. There’s no world left after. It’s a whole thing.',
      'But in a few, the heroes win! Every one of those becomes a star, and I keep them all up here.',
      'I guess you’re going to help me look for worlds where the Titan was slain, huh?',
      'I’ll show you my favorite one first.',
      'This one starts the way they always do...',
    ],
  },

  { id: 'revealed.firstLight', moment: { kind: 'revealed', constellationId: 'firstLight' }, once: true, lines: ['A mighty fighter and her trusty canine companion. Their bond can never be broken.', 'Valor and Fang. I’ve watched them a hundred times, and I still cheer every time.'] },
  { id: 'revealed.infinite', moment: { kind: 'revealed', constellationId: 'infinite' }, once: true, lines: ['Ooh, these are my favorite kind. Start to finish, no skipping!'] },
  { id: 'revealed.trials', moment: { kind: 'revealed', constellationId: 'trials' }, once: true, lines: ['I’ve watched these teams before. They’re kind of show-offs, honestly.'] },
  { id: 'revealed.gauntlet', moment: { kind: 'revealed', constellationId: 'gauntlet' }, once: true, lines: ['Heroes from totally different worlds, all fighting each other? I need snacks for this.'] },
  { id: 'revealed.strange', moment: { kind: 'revealed', constellationId: 'strange' }, once: true, lines: ['Ooh, what’s over there? Those look... weird. I love weird.'] },

  { id: 'opened.infinite', moment: { kind: 'opened', constellationId: 'infinite' }, once: true, lines: ['Every time I watch one of these it goes differently. I love that.'] },
  { id: 'opened.trials', moment: { kind: 'opened', constellationId: 'trials' }, once: true, lines: ['Each team’s all one type. Like matching outfits, but for fighting.'] },
  { id: 'opened.gauntlet', moment: { kind: 'opened', constellationId: 'gauntlet' }, once: true, lines: ['Five wins before two losses! I’ll be cheering. Loudly. Sorry in advance.'] },

  { id: 'star.bench', moment: { kind: 'star', starId: 'firstLight.clearing' }, once: true, lines: ['Sometimes, the groups are more than two. But they always fight two against two anyway. Strange...'] },
  { id: 'star.road', moment: { kind: 'star', starId: 'firstLight.road' }, once: true, lines: ['It’s a long journey to the Titan, and they search for loot along the way.'] },
  { id: 'star.cycle2', moment: { kind: 'star', starId: 'cycles.2' }, once: true, lines: ['Wait... it came back? It came BACK. And it’s still mad about last time.'] },
  { id: 'star.cycle3', moment: { kind: 'star', starId: 'cycles.3' }, once: true, lines: ['Every time it comes back, it’s learned something. Kind of rude, honestly.'] },

  {
    id: 'drawnIn.firstLight',
    moment: { kind: 'drawnIn', constellationId: 'firstLight' },
    once: true,
    lines: [
      'That’s it! That’s their whole story. I cried a little. Don’t tell anyone.',
      'See the circle? That’s the Pact. Every world where the heroes win holds it shut.',
      'And there are SO many more out there. Come on, let’s go find one!',
    ],
  },

  { id: 'uncharted.a', moment: { kind: 'uncharted' }, lines: ['Hmm, I haven’t found this one yet. It’s around here somewhere...'] },
  { id: 'uncharted.b', moment: { kind: 'uncharted' }, lines: ['Nope, still dark. Give me a minute!'] },

  { id: 'idle.door', moment: { kind: 'idle' }, lines: ['That Guardian’s been guarding its door so long, I think it forgot why.'] },
  { id: 'idle.bear', moment: { kind: 'idle' }, lines: ['That bear is SO slow. I love him so much.'] },
  { id: 'idle.count', moment: { kind: 'idle' }, lines: ['I tried counting all the stars once. I got to eleven and then sneezed.'] },
  { id: 'idle.crab', moment: { kind: 'idle' }, lines: ['Somewhere out there, a crab is winning a fight right now. I just know it.'] },
  { id: 'idle.favourite', moment: { kind: 'idle' }, lines: ['I’m not supposed to have favorites. ...I have like forty favorites.'] },
  { id: 'idle.breakfast', moment: { kind: 'idle' }, lines: ['Do you ever look at a star and wonder what it had for breakfast? Just me?'] },

  { id: 'returned.win.a', moment: { kind: 'returned', outcome: 'win' }, lines: ['THEY DID IT!', 'Okay, okay, I’m calm. I’m so calm.'] },
  { id: 'returned.win.b', moment: { kind: 'returned', outcome: 'win' }, lines: ['Did you see that?! I’m putting that one somewhere really sparkly.'] },
  { id: 'returned.loss.a', moment: { kind: 'returned', outcome: 'loss' }, lines: ['Oh no...', 'Okay! We’ll find another one. That bear was really good, though.'] },
  { id: 'returned.loss.b', moment: { kind: 'returned', outcome: 'loss' }, lines: ['Well, that world didn’t make it. There are lots more, though!'] },
  { id: 'returned.loss.c', moment: { kind: 'returned', outcome: 'loss' }, lines: ['Aww. Let’s try another one. I have a good feeling about the next one.'] },

  { id: 'poked.a', moment: { kind: 'poked' }, lines: ['Hee!'] },
  { id: 'poked.b', moment: { kind: 'poked' }, lines: ['Boop!'] },
  { id: 'poked.c', moment: { kind: 'poked' }, lines: ['Hey, that tickles!'] },
  { id: 'poked.d', moment: { kind: 'poked' }, lines: ['I’m awake, I’m awake!'] },
  { id: 'pokedLots.a', moment: { kind: 'pokedLots' }, lines: ['Okay, okay! Everything’s spinning...'] },
  { id: 'pokedLots.b', moment: { kind: 'pokedLots' }, lines: ['You found my one weak spot. It’s... all of me.'] },
];
