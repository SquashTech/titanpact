import type { MapNodeType } from '../../run/map';

// The map's pixel art for a node. A node with a PROP (art/map-nodes/props) is drawn as the thing
// itself — a shrine, a chest, a war banner — standing in a lit disc; one without falls back to its
// 48x48 stone medallion (art/map-nodes), the emblem painted into one shared frame. Both are drawn at
// a clean 2x (3x for the Guardian and a row of one).

function byName(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.png'.length), url])
  );
}

const MEDALLIONS = byName(
  import.meta.glob<string>('../../../art/map-nodes/*.png', { eager: true, query: '?url', import: 'default' })
);
const PROPS = byName(
  import.meta.glob<string>('../../../art/map-nodes/props/*.png', { eager: true, query: '?url', import: 'default' })
);

// The pick-1-of-3 rewards and the Elite/Skirmish fork as plain buttons: one 32px icon each, from
// the art/icons/32x32 pack, set in a uniform stone tile (MapRoute).
const ICONS = byName(
  import.meta.glob<string>('../../../art/map-nodes/icons/*.png', { eager: true, query: '?url', import: 'default' })
);

export function mapNodeIcon(type: MapNodeType): string | undefined {
  return ICONS[type];
}

/** Nodes that share another's face: the `battle` is the same Titanspawn pool as the `fight`. */
const ALIAS: Partial<Record<MapNodeType, MapNodeType>> = { battle: 'fight' };

export function mapNodeArt(type: MapNodeType): string | undefined {
  const key = ALIAS[type] ?? type;
  return PROPS[key] ?? MEDALLIONS[key];
}

export function isMapProp(type: MapNodeType): boolean {
  return (ALIAS[type] ?? type) in PROPS;
}

// A place's second state (art/map-nodes/awake): the same prop woken as the player arrives —
// the well surging, the stone blazing — drawn over its map self on the road (RoadEncounter).
const AWAKE = byName(
  import.meta.glob<string>('../../../art/map-nodes/awake/*.png', { eager: true, query: '?url', import: 'default' })
);

/** Each woken place's light, as "r, g, b": the flare it gives off and the glow it keeps. */
const AWAKE_RGB: Partial<Record<MapNodeType, string>> = {
  manaWellReward: '120, 205, 255',
  leyLineReward: '120, 230, 255',
  restReward: '255, 160, 70',
  passiveReward: '190, 130, 255',
  event: '255, 215, 120',
  forgeReward: '255, 150, 60',
};

export interface Awakening {
  art: string;
  rgb: string;
}

export function mapNodeAwakening(type: MapNodeType): Awakening | undefined {
  const art = AWAKE[type];
  return art ? { art, rgb: AWAKE_RGB[type] ?? '255, 220, 150' } : undefined;
}

/** Every map piece, prop and woken state — what the preloader fetches ahead. */
export function allMapNodeArtUrls(): string[] {
  return [...Object.values(MEDALLIONS), ...Object.values(PROPS), ...Object.values(AWAKE), ...Object.values(ICONS)];
}
