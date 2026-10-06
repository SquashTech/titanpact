import type { MapNodeType } from '../../run/map';

// The map's pixel art for a node. A pick-1-of-3 reward and the Elite/Skirmish fork are a 32px ICON
// (art/map-nodes/icons, from the art/icons/32x32 pack), set in a uniform stone tile and reused on
// the node's own screen; the rest fall back to their 48x48 stone medallion (art/map-nodes), drawn at
// a clean 2x (3x for a row of one).

function byName(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.png'.length), url])
  );
}

const MEDALLIONS = byName(
  import.meta.glob<string>('../../../art/map-nodes/*.png', { eager: true, query: '?url', import: 'default' })
);
const ICONS = byName(
  import.meta.glob<string>('../../../art/map-nodes/icons/*.png', { eager: true, query: '?url', import: 'default' })
);

export function mapNodeIcon(type: MapNodeType): string | undefined {
  return ICONS[type];
}

/** Nodes that share another's face: the `battle` is the same Titanspawn pool as the `fight`. */
const ALIAS: Partial<Record<MapNodeType, MapNodeType>> = { battle: 'fight' };

export function mapNodeArt(type: MapNodeType): string | undefined {
  return MEDALLIONS[ALIAS[type] ?? type];
}

/** Every map medallion and icon — what the preloader fetches ahead. */
export function allMapNodeArtUrls(): string[] {
  return [...Object.values(MEDALLIONS), ...Object.values(ICONS)];
}
