// Painted Location backdrops (docs/locations.md §4), 196x344, drawn at 2x on the 394-wide design
// canvas. Three per Location: the arrival screen's cinematic `art/locations/<id>.png`, the map's
// quieter `map/<id>.png` composed around the route, and the fight's `battle/<id>.png` (196x228, the
// arena) composed around the two rows. A Location missing one keeps the vector horizon there.

export type BackdropKind = 'arrival' | 'map' | 'battle';

const FILES: Record<BackdropKind, Record<string, string>> = {
  arrival: import.meta.glob<string>('../../../art/locations/*.png', { eager: true, query: '?url', import: 'default' }),
  map: import.meta.glob<string>('../../../art/locations/map/*.png', { eager: true, query: '?url', import: 'default' }),
  battle: import.meta.glob<string>('../../../art/locations/battle/*.png', { eager: true, query: '?url', import: 'default' }),
};

const BACKDROPS = Object.fromEntries(
  Object.entries(FILES).map(([kind, files]) => [
    kind,
    Object.fromEntries(
      Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.png'.length), url])
    ),
  ])
) as Record<BackdropKind, Record<string, string>>;

export function locationBackdrop(locationId: string, kind: BackdropKind = 'arrival'): string | undefined {
  return BACKDROPS[kind][locationId];
}
