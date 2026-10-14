// The console keys' drawn marks: a font's arrows sit off-centre in a medallion and set ⏵⏵ a glyph's width apart.

export type ConsoleGlyphKind = 'back' | 'play' | 'fast';

const PATHS: Record<ConsoleGlyphKind, string> = {
  back: 'M10.5 5 3.5 12l7 7 1.6-1.6-4.3-4.3H20.5v-2.2H7.8l4.3-4.3Z',
  play: 'M6 4v16l13-8Z',
  fast: 'M2 5v14l10-7Zm10 0v14l10-7Z',
};

export function ConsoleGlyph({ kind }: { kind: ConsoleGlyphKind }) {
  return (
    <svg className="bottom-action-drawn-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d={PATHS[kind]} />
    </svg>
  );
}
