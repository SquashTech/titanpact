// Presentation-only type colors; the engine never sees these. Keyed by string
// so an unlisted type degrades to a hashed fallback rather than blank.

// Storm and Shadow are split on brightness AND chroma so they read apart at
// badge size. Shadow stops short of black because it doubles as ink
// (ElementGlyph fill, LevelUpScreen type codes) over --bg/--panel.
const TYPE_COLORS: Record<string, string> = {
  Fire: '#e2683c',
  Water: '#4a90d9',
  Frost: '#7fd6e0',
  Storm: '#b48cf5',
  Stone: '#a89468',
  Nature: '#6bbf59',
  Light: '#e8d16a',
  Shadow: '#6a637a',
  Arcane: '#c356d0',
  Mind: '#e05fa0',
  Spirit: '#5fcfc0',
  Iron: '#9aa3ad',
  Mech: '#d97a3c',
  Beast: '#b5772f',
  Ancient: '#8a9c5e',
};

export function getTypeColor(type: string): string {
  if (TYPE_COLORS[type]) return TYPE_COLORS[type];
  let hash = 0;
  for (let i = 0; i < type.length; i++) hash = (hash * 31 + type.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360}, 45%, 60%)`;
}

/** Three-letter badge label (TypeBadge.tsx). */
const TYPE_ABBR: Record<string, string> = {
  Fire: 'FIR',
  Water: 'WTR',
  Frost: 'FRS',
  Storm: 'STM',
  Stone: 'STN',
  Nature: 'NAT',
  Light: 'LIT',
  Shadow: 'SHD',
  Arcane: 'ARC',
  Mind: 'MND',
  Spirit: 'SPI',
  Iron: 'IRN',
  Mech: 'MEC',
  Beast: 'BST',
  Ancient: 'ANC',
};

export function getTypeAbbr(type: string): string {
  return TYPE_ABBR[type] ?? type.slice(0, 3).toUpperCase();
}

function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const n = parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** "r, g, b" triplet for CSS that builds its own rgba() variants; neutral gray for the non-hex fallback. */
export function getTypeColorRgb(type: string): string {
  const rgb = hexToRgb(getTypeColor(type));
  return rgb ? rgb.join(', ') : '150, 150, 150';
}

/** Readable badge text (near-black or near-white) against a type color; non-hex colors default to dark text. */
export function getContrastText(bg: string): string {
  const rgb = hexToRgb(bg);
  if (!rgb) return '#161616';
  const [r, g, b] = rgb;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#161616' : '#f5f6f8';
}
