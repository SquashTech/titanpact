// The chiptune score: a ChipSong's note tables compiled to timed events per channel. No audio here, so
// tests can read it.

import type { ChipSong } from './chipSongs';

export type LeadWave = 'square' | 'pulse25' | 'pulse12' | 'triangle';

const CHORDS: Record<string, readonly string[]> = {
  C: ['C', 'E', 'G'],
  Cm: ['C', 'Eb', 'G'],
  D: ['D', 'F#', 'A'],
  Dm: ['D', 'F', 'A'],
  E: ['E', 'G#', 'B'],
  Em: ['E', 'G', 'B'],
  Eb: ['Eb', 'G', 'Bb'],
  F: ['F', 'A', 'C'],
  Fm: ['F', 'Ab', 'C'],
  'F#m': ['F#', 'A', 'C#'],
  'F#': ['F#', 'A#', 'C#'],
  G: ['G', 'B', 'D'],
  Gm: ['G', 'Bb', 'D'],
  A: ['A', 'C#', 'E'],
  Am: ['A', 'C', 'E'],
  Ab: ['Ab', 'C', 'Eb'],
  Bb: ['Bb', 'D', 'F'],
  Bm: ['B', 'D', 'F#'],
  B: ['B', 'D#', 'F#'],
  Bdim: ['B', 'D', 'F'],
  'C#dim': ['C#', 'E', 'G'],
  'G#dim': ['G#', 'B', 'D'],
  Dsus: ['D', 'G', 'A'],
  Asus: ['A', 'D', 'E'],
  Csus: ['C', 'F', 'G'],
};

const PITCH: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

function midiOf(name: string, octave: number): number {
  const p = PITCH[name];
  if (p === undefined) throw new Error(`chiptune: bad pitch ${name}`);
  return 12 * (octave + 1) + p;
}

export function noteMidi(token: string): number {
  const m = /^([A-G][#b]?)(\d)$/.exec(token);
  if (!m) throw new Error(`chiptune: bad note ${token}`);
  return midiOf(m[1], Number(m[2]));
}

/** Chord tone `i` at or above `octave`, each tone stacked above the one before. */
export function chordTone(chord: string, i: number, octave: number): number {
  const tones = CHORDS[chord];
  if (!tones) throw new Error(`chiptune: bad chord ${chord}`);
  const up = Math.floor(i / tones.length);
  const root = midiOf(tones[0], octave);
  let m = midiOf(tones[i % tones.length], octave);
  while (m < root) m += 12;
  return m + 12 * up;
}

export type DrumKind = 'kick' | 'snare' | 'hat';

export interface NoteEvent {
  step: number;
  steps: number;
  midi: number;
}

export interface CompiledSong {
  length: number;
  lead: NoteEvent[];
  harmony: NoteEvent[];
  arp: NoteEvent[];
  bass: NoteEvent[];
  drums: { step: number; kind: DrumKind }[];
}

/** Tokens: a note, digit or bass letter starts, '-' holds, '.' rests. */
function parseLine(tokens: string[], toMidi: (token: string, step: number) => number | null): NoteEvent[] {
  const out: NoteEvent[] = [];
  tokens.forEach((t, step) => {
    const last = out[out.length - 1];
    if (t === '-') {
      if (last && last.step + last.steps === step) last.steps++;
      return;
    }
    if (t === '.') return;
    const midi = toMidi(t, step);
    if (midi !== null) out.push({ step, steps: 1, midi });
  });
  return out;
}

function bars(lines: readonly string[]): string[] {
  return lines.join(' ').trim().split(/\s+/);
}

/** One pattern a bar, cycled when the song lists fewer patterns than bars. */
function cycled(patterns: string | readonly string[], count: number): string[] {
  const list = typeof patterns === 'string' ? [patterns] : patterns;
  return Array.from({ length: count }, (_, i) => list[i % list.length]);
}

export function compileSong(song: ChipSong): CompiledSong {
  const count = song.chords.length;
  const chordAt = (step: number) => song.chords[Math.floor(step / 16)];
  const lead = parseLine(bars(song.melody), (t) => noteMidi(t));
  const harmony = song.harmony ? parseLine(bars(song.harmony), (t) => noteMidi(t)) : [];
  const arp = song.arp ? parseLine(bars(cycled(song.arp, count)), (t, s) => chordTone(chordAt(s), Number(t), song.arpOctave ?? 4)) : [];
  const bass = parseLine(bars(cycled(song.bass, count)), (t, s) => {
    const chord = chordAt(s);
    const octave = song.bassOctave ?? 2;
    if (t === 'R') return chordTone(chord, 0, octave);
    if (t === 'r') return chordTone(chord, 0, octave) + 12;
    if (t === '3') return chordTone(chord, 1, octave);
    if (t === '5') return chordTone(chord, 2, octave);
    if (t === 'L') return chordTone(chord, 2, octave) - 12;
    throw new Error(`chiptune: bad bass token ${t}`);
  });
  const drums: CompiledSong['drums'] = [];
  const kit = song.drums;
  if (kit) {
    for (let b = 0; b < count; b++) {
      const fill = kit.fill && (b + 1) % (kit.fillEvery ?? count) === 0 ? kit.fill : null;
      for (const kind of ['kick', 'snare', 'hat'] as const) {
        const pattern = fill?.[kind] ?? cycled(kit[kind], count)[b];
        for (let s = 0; s < 16; s++) if (pattern[s] === 'x') drums.push({ step: b * 16 + s, kind });
      }
    }
  }
  return { length: count * 16, lead, harmony, arp, bass, drums };
}
