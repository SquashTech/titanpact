// The Guild Hall counter the player was last at (2026-09-25, per user direction): a buy that
// raises a who-screen unmounts the hall, and the next visit is a fresh mount — both used to land
// back on the Tavern. A preference, not a record of play, so it lives in its own key beside the
// autoplay and audio prefs rather than in the save or the Profile.

import type { GuildHallTab } from './GuildHallPanel';

const STORAGE_KEY = 'titanpact.guildHallTab';

/** The last counter picked, or `fallback` when none has been (or storage is unavailable). */
export function readGuildHallTab(fallback: GuildHallTab): GuildHallTab {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'shop' || raw === 'tavern' || raw === 'smithy' ? raw : fallback;
  } catch {
    // Private-mode Safari throws on localStorage access.
    return fallback;
  }
}

export function writeGuildHallTab(tab: GuildHallTab): void {
  try {
    localStorage.setItem(STORAGE_KEY, tab);
  } catch {
    /* Storage unavailable — the hall opens on its default next time. */
  }
}
