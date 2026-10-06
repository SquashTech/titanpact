import { createContext, useContext, type ReactNode } from 'react';
import { createProfile, hasEvolutionStar, starCycleOf, type Profile } from '../../run/profile';

// The player profile for the view layer. A context rather than a prop because the one thing a
// RUN reads off it — which Evolution paths already carry a star — is wanted three screens deep
// (LevelUpScreen / ScrollNodeScreen → EvolutionScreen → a path card) under screens that otherwise
// never touch the profile. The default is a fresh profile so a screen renders without a provider
// (the sandbox, a test) as it would for a brand-new player.
const ProfileContext = createContext<Profile>(createProfile());

export function ProfileProvider({ profile, children }: { profile: Profile; children: ReactNode }) {
  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>;
}

export function useProfile(): Profile {
  return useContext(ProfileContext);
}

/** Whether the player has cleared a run with this hero in this form (profile.ts `evolutionStars`). */
export function useHasEvolutionStar(heroId: string, pathId: string): boolean {
  return hasEvolutionStar(useProfile(), heroId, pathId);
}

/** The Cycle a path's star was earned on at its highest, or 0 while it is unearned (profile.ts `starCycles`). */
export function useEvolutionStarCycle(heroId: string, pathId: string): number {
  const profile = useProfile();
  return starCycleOf(profile, pathId, hasEvolutionStar(profile, heroId, pathId));
}

/** The class a lit star wears for its Cycle (docs/cycles.md §5); empty for an unearned one. */
export function starCycleClass(cycle: number): string {
  return cycle > 0 ? ` star-cycle-${cycle}` : '';
}
