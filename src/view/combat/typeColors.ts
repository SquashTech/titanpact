// Presentation-only color mapping for the 15 types (docs/architecture.md
// "Resolution and presentation are separate layers" — the engine never sees
// this). Keyed by string rather than importing TitanpactType so it degrades
// gracefully if a type shows up here before the chart is updated.

const TYPE_COLORS: Record<string, string> = {
  Fire: '#e2683c',
  Water: '#4a90d9',
  Frost: '#7fd6e0',
  Storm: '#a78be0',
  Stone: '#a89468',
  Nature: '#6bbf59',
  Light: '#e8d16a',
  Shadow: '#7a6fa8',
  Arcane: '#c356d0',
  Mind: '#e05fa0',
  Spirit: '#5fcfc0',
  Iron: '#9aa3ad',
  Forge: '#d97a3c',
  Beast: '#b5772f',
  Ancient: '#8a9c5e',
};

/** Deterministic fallback for any type not in the fixture chart yet, so new content never renders blank. */
export function getTypeColor(type: string): string {
  if (TYPE_COLORS[type]) return TYPE_COLORS[type];
  let hash = 0;
  for (let i = 0; i < type.length; i++) hash = (hash * 31 + type.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360}, 45%, 60%)`;
}

/** Three-letter badge label (TypeBadge.tsx) — Pokémon-style abbreviated type chip in place of plain colored text. */
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
  Forge: 'FOR',
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

/** Picks readable badge text (near-black or near-white) against a type color background. Non-hex colors (the hsl() fallback above) default to dark text, which reads fine against that fallback's fixed 60% lightness. */
export function getContrastText(bg: string): string {
  const rgb = hexToRgb(bg);
  if (!rgb) return '#161616';
  const [r, g, b] = rgb;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#161616' : '#f5f6f8';
}
