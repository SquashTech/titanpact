import type { ReactNode } from 'react';
import type { TriggerKeywordId } from '../../data/keywords';

// The trigger keyword glyphs: 24x24, `currentColor`, drawn in pairs that rhyme — Enter/Leave one
// doorway with the arrow reversed, On Hit a burst outward and Struck the same force inward.

const STROKED = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const KEYWORD_PATHS: Record<TriggerKeywordId, ReactNode> = {
  enter: (
    <g {...STROKED}>
      <path d="M14 3.5h6v17h-6" />
      <path d="M3 12h11" />
      <path d="M9.5 7.5 14 12l-4.5 4.5" />
    </g>
  ),
  leave: (
    <g {...STROKED}>
      <path d="M10 3.5H4v17h6" />
      <path d="M9 12h12" />
      <path d="M16.5 7.5 21 12l-4.5 4.5" />
    </g>
  ),
  hit: <path d="M12 1 14 8.4l5.8-4.2-3.2 6.4 6.4 1.4-6.4 1.4 3.2 6.4L14 15.6 12 23l-2-7.4-5.8 4.2 3.2-6.4L1 12l6.4-1.4-3.2-6.4L10 8.4Z" />,
  struck: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <g {...STROKED}>
        <path d="M2.5 6.5 7 12l-4.5 5.5" />
        <path d="M21.5 6.5 17 12l4.5 5.5" />
      </g>
    </>
  ),
  takedown: (
    <path
      fillRule="evenodd"
      d="M12 2C6.9 2 3.3 5.4 3.3 10c0 2.6 1.1 4.6 3.1 5.8V21h11.2v-5.2c2-1.2 3.1-3.2 3.1-5.8C20.7 5.4 17.1 2 12 2ZM8.6 9.2a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Zm6.8 0a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Z"
    />
  ),
  roundEnd: <path d="M5 2h14v2.6l-5.4 7.4 5.4 7.4V22H5v-2.6l5.4-7.4L5 4.6Z" />,
  rest: (
    <g {...STROKED} strokeWidth={2.6}>
      <path d="M3 10h6.5L3 18h6.5" />
      <path d="M13.5 3H20l-6.5 8H20" />
    </g>
  ),
  healed: <path d="M9.5 2.5h5v7h7v5h-7v7h-5v-7h-7v-5h7Z" />,
};

export function KeywordGlyph({ keyword, className }: { keyword: TriggerKeywordId; className?: string }) {
  return (
    <svg className={`stat-glyph${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      {KEYWORD_PATHS[keyword]}
    </svg>
  );
}
