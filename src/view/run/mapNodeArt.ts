import type { MapNodeType } from '../../run/map';

// The map's pixel medallions (art/map-nodes): one 48x48 stone frame with each node's emblem
// painted into its centre, drawn at a clean 2x (3x for the Guardian and a row of one).

const files = import.meta.glob<string>('../../../art/map-nodes/*.png', { eager: true, query: '?url', import: 'default' });

const ART: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.png'.length), url])
);

/** Nodes that share another's face: the `battle` is the same Titanspawn pool as the `fight`. */
const ALIAS: Partial<Record<MapNodeType, MapNodeType>> = { battle: 'fight' };

export function mapNodeArt(type: MapNodeType): string | undefined {
  return ART[ALIAS[type] ?? type];
}
