// Trigger keywords: the eight trigger clauses passive text repeats most, each a badge read off
// the passive's own hook (src/run/keywords.ts). The meaning is what a tap on the passive shows.

export type TriggerKeywordId = 'enter' | 'leave' | 'hit' | 'struck' | 'takedown' | 'roundEnd' | 'rest' | 'healed';

export interface TriggerKeywordDefinition {
  id: TriggerKeywordId;
  name: string;
  meaning: string;
}

export const triggerKeywords: Record<TriggerKeywordId, TriggerKeywordDefinition> = {
  enter:    { id: 'enter',    name: 'Enter',     meaning: 'Each time this hero takes the field: leading, switching in, or stepping up for a fallen ally.' },
  leave:    { id: 'leave',    name: 'Leave',     meaning: "Each time this hero switches out. Falling doesn't count." },
  hit:      { id: 'hit',      name: 'On Hit',    meaning: 'Each time one of its moves damages a foe, once for every foe a spread move strikes.' },
  struck:   { id: 'struck',   name: 'Struck',    meaning: "Each time a move's hit lands on this hero, even one a Shield soaks up. Burn, Poison and Bleed don't count." },
  takedown: { id: 'takedown', name: 'Takedown',  meaning: "Each time one of its hits knocks a foe out." },
  roundEnd: { id: 'roundEnd', name: 'Round End', meaning: 'At the end of every round this hero is on the field.' },
  rest:     { id: 'rest',     name: 'Rest',      meaning: 'Each time this hero Rests.' },
  healed:   { id: 'healed',   name: 'Healed',    meaning: "Each time a move heals this hero, its own drain included. Renew and passives don't count." },
};
