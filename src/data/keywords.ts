// Trigger keywords: the eight trigger clauses passive text repeats most, each a badge read off
// the passive's own hook (src/run/keywords.ts). The meaning is what a tap on the passive shows.

export type TriggerKeywordId = 'enter' | 'leave' | 'hit' | 'struck' | 'takedown' | 'roundEnd' | 'rest' | 'healed';

export interface TriggerKeywordDefinition {
  id: TriggerKeywordId;
  name: string;
  meaning: string;
}

export const triggerKeywords: Record<TriggerKeywordId, TriggerKeywordDefinition> = {
  enter:    { id: 'enter',    name: 'Enter',     meaning: 'When this hero takes the field.' },
  leave:    { id: 'leave',    name: 'Leave',     meaning: 'When this hero switches out.' },
  hit:      { id: 'hit',      name: 'On Hit',    meaning: 'When this hero hits a foe with a move.' },
  struck:   { id: 'struck',   name: 'Struck',    meaning: 'When this hero is attacked.' },
  takedown: { id: 'takedown', name: 'Takedown',  meaning: 'When this hero knocks out a foe.' },
  roundEnd: { id: 'roundEnd', name: 'Round End', meaning: 'At the end of each round.' },
  rest:     { id: 'rest',     name: 'Rest',      meaning: 'When this hero Rests.' },
  healed:   { id: 'healed',   name: 'Healed',    meaning: 'When a move heals this hero.' },
};

// Move keywords: the properties the move dossier's effect rows repeat most, each a gold word
// heading its row. Rarer properties stay sentences.
export type MoveKeywordId = 'charges' | 'drain' | 'slice' | 'pivot' | 'crit' | 'cleanse' | 'recoil';

export const moveKeywords: Record<MoveKeywordId, string> = {
  charges:   'Charges',
  drain:     'Drain',
  slice:     'Slice',
  pivot:     'Pivot',
  crit:      'Crit',
  cleanse:   'Cleanse',
  recoil:    'Recoil',
};
