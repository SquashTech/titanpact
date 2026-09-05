// The storage half of the player profile, and the one place that erases everything.
// Rules live in src/run/profile.ts.

import { heroes } from '../data/heroes';
import { createProfile, decodeProfile, type Profile } from '../run/profile';
import { clearSave } from './saveStorage';

const PROFILE_KEY = 'titanpact.profile';

const knownHeroIds: ReadonlySet<string> = new Set(Object.keys(heroes));

export function readProfile(): Profile {
  let raw: string | null;
  try {
    raw = localStorage.getItem(PROFILE_KEY);
  } catch {
    // Private-mode Safari throws on access; the session still plays, it just does not record.
    return createProfile();
  }
  if (!raw) return createProfile();
  try {
    return decodeProfile(JSON.parse(raw), knownHeroIds);
  } catch {
    return createProfile();
  }
}

/**
 * Read, apply, write. The profile is deliberately NOT held in React state: playtime flushes
 * on a timer, and a state update on that timer would re-render the whole tree mid-fight for
 * a number nothing on screen is showing. Screens that display it read it when they open.
 */
export function updateProfile(apply: (profile: Profile) => Profile): Profile {
  const next = apply(readProfile());
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  } catch {
    /* Storage unavailable or full — the session continues unrecorded. */
  }
  return next;
}

/**
 * Erases the profile and any parked run. Audio settings are left alone: they are preferences,
 * not a record of play, and wiping them makes a reset feel broken rather than clean.
 */
export function eraseAllData(): void {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* Nothing readable to erase. */
  }
  clearSave();
}
