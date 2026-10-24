// Blip's thoughts (docs/the-sky.md §1): short, meta and fun, never a rule and never a verdict on the
// player's picks. First pass, every line open to the designer. Grouped by moment.

import type { ThoughtDefinition } from '../run/thoughts';

export const THOUGHTS: readonly ThoughtDefinition[] = [
  { id: 'firstSky', moment: { kind: 'firstSky' }, once: true, line: 'Oh! Hi. I watch the Titan rise in every world. Watch with me?' },

  { id: 'revealed.firstLight', moment: { kind: 'revealed', constellationId: 'firstLight' }, once: true, line: 'Everyone starts with these stars. Even me.' },
  { id: 'revealed.theBench', moment: { kind: 'revealed', constellationId: 'theBench' }, once: true, line: 'Two fight, the rest wait. Waiting is a skill. I’m bad at it.' },
  { id: 'revealed.theRoad', moment: { kind: 'revealed', constellationId: 'theRoad' }, once: true, line: 'A whole road, with a Guardian at the end. I hope they make it.' },
  { id: 'revealed.journey', moment: { kind: 'revealed', constellationId: 'journey' }, once: true, line: 'A Journey is a whole telling, start to end. My favourite kind.' },
  { id: 'revealed.cycles', moment: { kind: 'revealed', constellationId: 'cycles' }, once: true, line: 'It wakes again a year later. And it remembers.' },
  { id: 'revealed.trials', moment: { kind: 'revealed', constellationId: 'trials' }, once: true, line: 'Fourteen worlds I already watched. Each one’s best six.' },
  { id: 'revealed.gauntlet', moment: { kind: 'revealed', constellationId: 'gauntlet' }, once: true, line: 'Heroes from different worlds in one ring. I brought snacks.' },

  { id: 'opened.journey', moment: { kind: 'opened', constellationId: 'journey' }, once: true, line: 'No two Journeys go the same. That’s why I keep watching.' },
  { id: 'opened.cycles', moment: { kind: 'opened', constellationId: 'cycles' }, once: true, line: 'Each Cycle it learns a little more. So do we.' },
  { id: 'opened.trials', moment: { kind: 'opened', constellationId: 'trials' }, once: true, line: 'One type each, at their very best. No pressure.' },
  { id: 'opened.gauntlet', moment: { kind: 'opened', constellationId: 'gauntlet' }, once: true, line: 'Five wins before two losses. I’ll be loud about it.' },

  { id: 'uncharted.a', moment: { kind: 'uncharted' }, line: 'I haven’t found these stars yet. Soon!' },
  { id: 'uncharted.b', moment: { kind: 'uncharted' }, line: 'Still looking for this one. It’s in here somewhere.' },

  { id: 'idle.door', moment: { kind: 'idle' }, line: 'That one’s guarded its door so long it forgot why.' },
  { id: 'idle.bear', moment: { kind: 'idle' }, line: 'Slowest bear I’ve ever seen. I love him.' },
  { id: 'idle.worlds', moment: { kind: 'idle' }, line: 'Every star up here is a world where somebody didn’t give up.' },
  { id: 'idle.count', moment: { kind: 'idle' }, line: 'I counted the stars once. Then more showed up.' },
  { id: 'idle.crab', moment: { kind: 'idle' }, line: 'Somewhere a crab is winning a fight. I can feel it.' },
  { id: 'idle.favourite', moment: { kind: 'idle' }, line: 'I’m not supposed to have favourites. I have so many.' },

  { id: 'returned.win.a', moment: { kind: 'returned', outcome: 'win' }, line: 'They did it! I’m putting that one somewhere bright.' },
  { id: 'returned.win.b', moment: { kind: 'returned', outcome: 'win' }, line: 'Did you see that? Everyone up here saw that.' },
  { id: 'returned.loss.a', moment: { kind: 'returned', outcome: 'loss' }, line: 'Oh no. …Okay. Again. That one had a really good bear.' },
  { id: 'returned.loss.b', moment: { kind: 'returned', outcome: 'loss' }, line: 'That world ended. Lots of others haven’t.' },
  { id: 'returned.loss.c', moment: { kind: 'returned', outcome: 'loss' }, line: 'Not every telling holds. The next one might.' },

  { id: 'poked.a', moment: { kind: 'poked' }, line: 'Hee!' },
  { id: 'poked.b', moment: { kind: 'poked' }, line: 'Boop.' },
  { id: 'poked.c', moment: { kind: 'poked' }, line: 'That tickles!' },
  { id: 'poked.d', moment: { kind: 'poked' }, line: 'I’m awake, I’m awake.' },
  { id: 'pokedLots.a', moment: { kind: 'pokedLots' }, line: 'Okay, okay! I’m dizzy.' },
  { id: 'pokedLots.b', moment: { kind: 'pokedLots' }, line: 'You found my one weak spot. It’s all of me.' },
];
