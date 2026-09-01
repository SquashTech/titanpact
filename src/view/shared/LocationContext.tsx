import { createContext, useContext, type ReactNode } from 'react';
import type { LocationDefinition } from '../../data/locations';

// The act's ambient Location for the view layer (docs/locations.md §5.5). A context rather than a
// prop because one shared leaf (NodeSky) reads it under ten screens that otherwise never touch it.
// `null` means "no act is being played" (title screen, sandbox) and yields the placeless sky.
const LocationContext = createContext<LocationDefinition | null>(null);

export function LocationProvider({ location, children }: { location: LocationDefinition | null; children: ReactNode }) {
  return <LocationContext.Provider value={location}>{children}</LocationContext.Provider>;
}

export function useAmbientLocation(): LocationDefinition | null {
  return useContext(LocationContext);
}
