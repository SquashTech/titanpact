import type { CSSProperties } from 'react';
import iconset from '../../../art/2500plusIcons/No Border/Iconset.png';

/** RPG Maker icon indices into the 2500+ Pixel Odyssey sheet (docs/icon-pack.md). */
const ICON_INDEX = {
  equipment: 97, // sword
  weapon: 97,
  armor: 81, // ward shield
  accessory: 70, // arcane sparkle
  relic: 3, // gem
  guild: 70,
  class: 81,
  mana: 75, // restorative cycle
} as const;

export type RunGlyphKind = keyof typeof ICON_INDEX;

/** One 32px cell from the sheet. */
export function IconsetGlyph({ index, className, title }: { index: number; className?: string; title?: string }) {
  const style = {
    '--sprite-col': index % 16,
    '--sprite-row': Math.floor(index / 16),
    backgroundImage: `url(${iconset})`,
  } as CSSProperties;
  return <span className={`iconset-glyph${className ? ` ${className}` : ''}`} style={style} aria-hidden="true" title={title} />;
}

export function RunGlyph({ kind, className, title }: { kind: RunGlyphKind; className?: string; title?: string }) {
  return <IconsetGlyph index={ICON_INDEX[kind]} className={`run-glyph${className ? ` ${className}` : ''}`} title={title} />;
}

/** Typographic marker for resources with no matching sheet asset. */
export function ResourceMark({ label, tone = 'gold', className }: { label: string; tone?: 'gold' | 'green' | 'blue'; className?: string }) {
  return (
    <span className={`resource-mark resource-mark-${tone}${className ? ` ${className}` : ''}`} aria-hidden="true">
      {label}
    </span>
  );
}
