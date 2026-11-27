import type { MapNodeType } from '../../run/map';

// A node's ICON is flat drawn art (art/map-nodes/flat, docs/road-map.md), worn on the road and on the
// node's own screen; a node with none falls back to its 48x48 pixel medallion (art/map-nodes).

function byName(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, path.lastIndexOf('.')), url])
  );
}

const MEDALLIONS = byName(
  import.meta.glob<string>('../../../art/map-nodes/*.png', { eager: true, query: '?url', import: 'default' })
);
const ICONS = byName(
  import.meta.glob<string>('../../../art/map-nodes/flat/*.svg', { eager: true, query: '?url', import: 'default' })
);

export function mapNodeIcon(type: MapNodeType): string | undefined {
  return ICONS[type];
}

// What an event is once it has a name: one 32px icon each (art/events, by event id), met on the road
// and worn on its screen. The map tile's question mark is the fallback.
const EVENT_ICONS = byName(
  import.meta.glob<string>('../../../art/events/*.png', { eager: true, query: '?url', import: 'default' })
);

export function eventIcon(eventId: string): string {
  return EVENT_ICONS[eventId] ?? ICONS.event;
}

/** Nodes that share another's face: the `battle` is the same Titanspawn pool as the `fight`. */
const ALIAS: Partial<Record<MapNodeType, MapNodeType>> = { battle: 'fight' };

export function mapNodeArt(type: MapNodeType): string | undefined {
  return MEDALLIONS[ALIAS[type] ?? type];
}

/** Every map medallion and icon, and every event's — what the preloader fetches ahead. */
export function allMapNodeArtUrls(): string[] {
  return [...Object.values(MEDALLIONS), ...Object.values(ICONS), ...Object.values(EVENT_ICONS)];
}
