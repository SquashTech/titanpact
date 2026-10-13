import type { ReactNode } from 'react';
import { FLAME } from './elementIcons';

// One glyph per Field Effect, 24x24 grid, `currentColor` only. Every one stands on the same ground
// line, so a field never reads as its bare type glyph; the scene above it says which field it is.

const GROUND = <rect x="1" y="20.2" width="22" height="2.8" rx="1.4" />;
const STROKED = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const FIELD_PATHS: Record<string, ReactNode> = {
  // Three rising arrows: every pool's regen climbing.
  surgingMagic: (
    <g {...STROKED} strokeWidth={2.6}>
      <path d="M6 17.5V9.5M3.4 12 6 9.4 8.6 12" />
      <path d="M12 17.5V4.5M9.4 7 12 4.4 14.6 7" />
      <path d="M18 17.5V9.5M15.4 12 18 9.4 20.6 12" />
    </g>
  ),
  scorchedLand: (
    <>
      <g transform="translate(6.2 2.4) scale(0.5)">{FLAME}</g>
      <g transform="translate(1.4 9.6) scale(0.42)">{FLAME}</g>
      <g transform="translate(13.2 9.6) scale(0.42)">{FLAME}</g>
    </>
  ),
  stasisBubble: (
    <>
      <circle cx="12" cy="10.6" r="7.6" {...STROKED} strokeWidth={2.6} />
      <path {...STROKED} strokeWidth={2} d="M8 8.4a4.6 4.6 0 0 1 3-2.6" />
    </>
  ),
  // A sun half-risen.
  sanctuary: (
    <>
      <path d="M5 19.2a7 7 0 0 1 14 0Z" />
      <path {...STROKED} strokeWidth={2.4} d="M12 3.4v3.4M4.6 6.6l2.2 2.4M19.4 6.6l-2.2 2.4M1.8 13.4h2.6M19.6 13.4h2.6" />
    </>
  ),
  verdantEarth: (
    <>
      <path {...STROKED} strokeWidth={2.4} d="M8 19V12M16 19V9" />
      <path d="M8 13C8 9.6 5.6 7.6 2.6 7.6 2.6 11 5 13 8 13Z" />
      <path d="M16 10.4c0-3.8 2.6-6.4 6-6.4 0 3.8-2.6 6.4-6 6.4Z" />
      <path d="M16 12.4c0-2.6-1.9-4.4-4.4-4.4 0 2.6 1.9 4.4 4.4 4.4Z" />
    </>
  ),
  bloodMoon: (
    <path
      fillRule="evenodd"
      d="M12 2.6a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm-2.4 3.6a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Zm4.4 4.2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z"
    />
  ),
  downpour: (
    <>
      <circle cx="9" cy="6.6" r="4" />
      <circle cx="15.4" cy="8" r="3.4" />
      <rect x="4.6" y="7.4" width="15" height="4.4" rx="2.2" />
      <path {...STROKED} strokeWidth={2.2} d="M7 14.4l-1.2 3M12 14.4l-1.2 3M17 14.4l-1.2 3" />
    </>
  ),
  // Coursed stone, the ground built up.
  bedrock: (
    <>
      <rect x="2.4" y="13.8" width="8.6" height="4.6" rx="1" />
      <rect x="13" y="13.8" width="8.6" height="4.6" rx="1" />
      <rect x="7.6" y="7.4" width="8.8" height="4.6" rx="1" />
      <rect x="18.2" y="7.4" width="3.4" height="4.6" rx="1" />
      <rect x="2.4" y="7.4" width="3.4" height="4.6" rx="1" />
    </>
  ),
  witheringGaze: (
    <>
      <path
        fillRule="evenodd"
        d="M12 4.2c4.6 0 8.2 2.8 10.4 6.4C20.2 14.2 16.6 17 12 17S3.8 14.2 1.6 10.6C3.8 7 7.4 4.2 12 4.2Zm0 2.6a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z"
      />
      <circle cx="12" cy="10.6" r="1.7" />
    </>
  ),
};

/** A field's own glyph on its ground line; a field with no drawing yet stands its bare ground. */
export function FieldGlyph({ fieldEffectId, className }: { fieldEffectId: string; className?: string }) {
  return (
    <svg className={`stat-glyph${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      {FIELD_PATHS[fieldEffectId]}
      {GROUND}
    </svg>
  );
}
