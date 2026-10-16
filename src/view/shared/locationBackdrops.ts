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

/** A point on the map painting, in its own pixels (196x344): where one tile's foot stands. */
export type MapSpot = readonly [x: number, y: number];

/** Where a row's tiles stand on the painting, by how many share the row. */
export type MapSpots = Readonly<Record<1 | 2 | 3, readonly MapSpot[]>>;

// Picked off each painting so a tile stands on open ground: clear of trees, sea and lava, on the road.
const MAP_SPOTS: Record<string, MapSpots> = {
  wildsEdge:       { 1: [[98, 240]], 2: [[70, 248], [126, 248]], 3: [[60, 254], [98, 216], [136, 254]] },
  necropolis:      { 1: [[98, 234]], 2: [[72, 238], [124, 238]], 3: [[58, 244], [98, 214], [138, 244]] },
  blightedShrine:  { 1: [[98, 232]], 2: [[78, 250], [120, 230]], 3: [[72, 262], [98, 210], [122, 258]] },
  forbiddenForest: { 1: [[98, 238]], 2: [[72, 244], [124, 244]], 3: [[58, 248], [98, 232], [138, 248]] },
  moltenFoundry:   { 1: [[86, 252]], 2: [[44, 262], [150, 206]], 3: [[44, 262], [80, 176], [150, 206]] },
  stormCoast:      { 1: [[80, 224]], 2: [[58, 246], [118, 258]], 3: [[50, 250], [86, 204], [136, 262]] },
  holySanctum:     { 1: [[98, 226]], 2: [[62, 242], [136, 262]], 3: [[56, 240], [98, 222], [140, 262]] },
  dreamingSpires:  { 1: [[98, 258]], 2: [[72, 260], [124, 260]], 3: [[58, 262], [98, 236], [138, 262]] },
  thunderAerie:    { 1: [[98, 252]], 2: [[72, 254], [124, 254]], 3: [[58, 256], [98, 228], [138, 256]] },
  frozenReach:     { 1: [[98, 234]], 2: [[72, 236], [124, 236]], 3: [[58, 240], [98, 212], [138, 240]] },
  theThreshold:    { 1: [[98, 238]], 2: [[72, 240], [124, 240]], 3: [[58, 246], [98, 216], [138, 246]] },
};

export function mapSpots(locationId: string): MapSpots | undefined {
  return locationBackdrop(locationId, 'map') ? MAP_SPOTS[locationId] : undefined;
}

/** Every painting one Location owns (all of them without an id) — what the preloader fetches ahead. */
export function locationBackdropUrls(locationId?: string): string[] {
  return (Object.keys(BACKDROPS) as BackdropKind[]).flatMap((kind) =>
    locationId ? (BACKDROPS[kind][locationId] ? [BACKDROPS[kind][locationId]] : []) : Object.values(BACKDROPS[kind])
  );
}
