import type { CSSProperties } from 'react';
import iconset from '../../../art/2500plusIcons/No Border/Iconset.png';

/**
 * A deliberately small set of icons from the supplied 2500+ Pixel Odyssey
 * sheet. Each value is the documented RPG Maker icon index (see
 * docs/icon-pack.md), which keeps the generic run UI in a single art style
 * instead of borrowing the earlier placeholder equipment/relic thumbnails.
 */
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

/** Renders one 32px cell from the licensed 2500+ sheet at a crisp CSS size. */
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

/** A compact typographic marker for resources with no matching supplied asset. */
export function ResourceMark({ label, tone = 'gold', className }: { label: string; tone?: 'gold' | 'green' | 'blue'; className?: string }) {
  return (
    <span className={`resource-mark resource-mark-${tone}${className ? ` ${className}` : ''}`} aria-hidden="true">
      {label}
    </span>
  );
}
