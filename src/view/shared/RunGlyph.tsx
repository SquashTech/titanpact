import type { CSSProperties, ReactNode } from 'react';
import iconset from '../../../art/2500plusIcons/No Border/Iconset.png';
import { NODE_PATHS } from './nodeIcons';

/** RPG Maker icon indices into the 2500+ Pixel Odyssey sheet (docs/icon-pack.md). */
const ICON_INDEX = {
  equipment: 97, // sword
  weapon: 97,
  armor: 81, // ward shield
  accessory: 70, // arcane sparkle
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

// The run resources as vector, 24x24, `currentColor` — the sizes these are drawn at
// (11-14px) are the ones docs/icon-pack.md measures the pixel sheet as being destroyed by.
// Gold and the Ichor deliberately reuse the map node that pays them out: one picture per concept.
const FLASK_PATH = (
  <>
    <path d="M9 2h6v2h-1v4.6l4.9 8.2A2.6 2.6 0 0 1 16.7 21H7.3a2.6 2.6 0 0 1-2.2-4.2L10 8.6V4H9Z" opacity="0.35" />
    <path d="M10 9.2V4h4v5.2l4.2 7a1.4 1.4 0 0 1-1.2 2.1H7a1.4 1.4 0 0 1-1.2-2.1Zm-2.4 8.1h8.8l-2.3-3.8H9.9Z" />
    <rect x="8.5" y="2" width="7" height="2" rx="0.6" />
  </>
);

const RESOURCE_PATHS = {
  gold: NODE_PATHS.currencyReward,
  // A quill, not the document it signs: a sealed sheet drawn this small is a floppy disk
  // (measured), and a page of ruled lines is the Reference scroll, which is on the same
  // screen. The diagonal is what survives 14px — the same reason STAT_PATHS.attack is one.
  contract: (
    <>
      <path d="M21.4 2.2c-7 .6-11.8 3.5-14.3 7.7-1.4 2.3-1.9 4.7-1.7 6.7l3.2-3.2c2.8.4 6-.8 8.1-3.2-1.5.4-3.2.4-4.5 0 2.6-.5 5.3-2.1 6.8-4.6-1.4.8-3 1.1-4.3 1 1.8-1.5 4.2-3 6.7-4.4Z" />
      <path d="M7.9 15.1 3.1 20.8l2 1.7 4.5-5.8Z" />
    </>
  ),
  // The one phial, not the Ichor node's pair: what the shelf sells is a Drop.
  ichor: NODE_PATHS.ichorDropReward,
  // The Mastery Scroll: the Scribe's node glyph, since a Scroll is what the Scribe hands over.
  scroll: NODE_PATHS.scribeReward,
  // The two potions share one flask and differ by colour alone, since they are the same verb at
  // two gauges. A round-bottomed flask with a stoppered neck: the bulb is what survives 12px.
  hpPotion: FLASK_PATH,
  mpPotion: FLASK_PATH,
} satisfies Record<string, ReactNode>;

export type ResourceKind = keyof typeof RESOURCE_PATHS;

/** One color per resource, shared everywhere the resource is drawn. */
export const RESOURCE_COLORS: Record<ResourceKind, string> = {
  gold: 'var(--accent)',
  contract: '#9bc9ff',
  // The level-up report's green: an Ichor is a level-up the player aims.
  ichor: '#4caf6a',
  // The Scribe's parchment (mapNodes NODE_COLORS scribeReward).
  scroll: '#e0c27a',
  // The gauges' own colours, so a potion reads as the bar it refills.
  hpPotion: '#ff8a8a',
  mpPotion: '#8fb4ff',
};

/** The one place a run resource is drawn. `aria-hidden`: it always sits beside its own count or label. */
export function ResourceGlyph({ kind, tone = 'resource', className }: { kind: ResourceKind; tone?: 'resource' | 'inherit'; className?: string }) {
  return (
    <svg
      className={`resource-glyph${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      style={tone === 'resource' ? ({ color: RESOURCE_COLORS[kind] } as CSSProperties) : undefined}
    >
      {RESOURCE_PATHS[kind]}
    </svg>
  );
}
