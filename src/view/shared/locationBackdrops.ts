// Painted Location backdrops (docs/locations.md §4), 196x344, drawn at 2x on the 394-wide design
// canvas. Three per Location: the arrival screen's cinematic `art/locations/<id>.png`, the map's
// quieter `map/<id>.png` composed around the route, and the fight's `battle/<id>.png` (196x228, the
// arena) composed around the two rows, and the inside of its Guild Hall, `hall/<id>.png` (196x392).
// A Location missing one keeps the vector horizon there.

export type BackdropKind = 'arrival' | 'map' | 'battle' | 'hall';

const FILES: Record<BackdropKind, Record<string, string>> = {
  arrival: import.meta.glob<string>('../../../art/locations/*.png', { eager: true, query: '?url', import: 'default' }),
  map: import.meta.glob<string>('../../../art/locations/map/*.png', { eager: true, query: '?url', import: 'default' }),
  battle: import.meta.glob<string>('../../../art/locations/battle/*.png', { eager: true, query: '?url', import: 'default' }),
  hall: import.meta.glob<string>('../../../art/locations/hall/*.png', { eager: true, query: '?url', import: 'default' }),
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

/** Where the map painting's open ground is, as a fraction of its height: the map's row stands on it. */
const MAP_GROUND: Record<string, number> = {
  wildsEdge: 0.7,
  necropolis: 0.68,
  blightedShrine: 0.68,
  forbiddenForest: 0.68,
  moltenFoundry: 0.72,
  stormCoast: 0.62,
  holySanctum: 0.68,
  dreamingSpires: 0.76,
  thunderAerie: 0.74,
  frozenReach: 0.68,
  theThreshold: 0.7,
};

export function mapGround(locationId: string): number | undefined {
  return locationBackdrop(locationId, 'map') ? MAP_GROUND[locationId] : undefined;
}

/** Every painting one Location owns (all of them without an id) — what the preloader fetches ahead. */
export function locationBackdropUrls(locationId?: string): string[] {
  return (Object.keys(BACKDROPS) as BackdropKind[]).flatMap((kind) =>
    locationId ? (BACKDROPS[kind][locationId] ? [BACKDROPS[kind][locationId]] : []) : Object.values(BACKDROPS[kind])
  );
}
