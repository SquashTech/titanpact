import { createContext, useContext, type ReactNode } from 'react';
import type { LocationDefinition } from '../../data/locations';

/**
 * Which Location the player is currently standing in, for the view layer only
 * (docs/locations.md §5.5).
 *
 * This is the first and, so far, only React context in the repo, and the
 * reason it earns the exception is the shape of the problem. A location is
 * *ambient*: it is true of the whole act, it is read by one shared leaf
 * component (`NodeSky`) that ten screens render without knowing anything about
 * it, and not one of those screens uses it for anything else. Threading it
 * through as a prop would mean ten screens' prop lists and ten App.tsx call
 * sites growing a field they only forward — and one of them, RosterReplaceScreen,
 * takes no RunState at all and would have to start.
 *
 * The value being nullable is load-bearing, not defensive. `null` means "no
 * act is being played", which is the honest answer on the title screen and in
 * the sandbox tools — and it is what makes those screens keep the plain,
 * placeless node sky they have always had without a single opt-out. App.tsx
 * decides; everything downstream just reads.
 *
 * Nothing outside the view layer imports this. It carries no run state, only
 * the authored `LocationDefinition`, so it can never become a second source of
 * truth for anything the engine or `RunState` owns.
 */
const LocationContext = createContext<LocationDefinition | null>(null);

export function LocationProvider({ location, children }: { location: LocationDefinition | null; children: ReactNode }) {
  return <LocationContext.Provider value={location}>{children}</LocationContext.Provider>;
}

/** The act's Location, or null outside a run. Safe to call from any view component. */
export function useAmbientLocation(): LocationDefinition | null {
  return useContext(LocationContext);
}
