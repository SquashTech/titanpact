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
