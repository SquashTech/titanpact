// Round playback speed: the console's two Auto keys, and the one place their
// setting is remembered. A preference, not a record of play, so it lives beside
// the audio prefs in its own key rather than in the Profile.

export type AutoPlayMode = 'off' | 'auto' | 'fast';

const STORAGE_KEY = 'titanpact.autoplay';

/** Pause between auto-advanced beats. `auto` is a reading pace; `fast` is for a player who already knows what a round says. */
export const AUTO_PLAY_STEP_MS: Record<Exclude<AutoPlayMode, 'off'>, number> = {
  auto: 450,
  fast: 120,
};

export function readAutoPlayMode(): AutoPlayMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'auto' || raw === 'fast' ? raw : 'off';
  } catch {
    // Private-mode Safari throws on localStorage access.
    return 'off';
  }
}

export function writeAutoPlayMode(mode: AutoPlayMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* Storage unavailable — the setting still holds for the session. */
  }
}
