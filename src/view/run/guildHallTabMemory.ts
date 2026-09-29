// The Guild Hall counter the player was last at (2026-09-25, per user direction): a buy that
// raises a who-screen unmounts the hall, and used to land back on the Tavern. Held for one visit
// only: walking in opens on the Tavern (2026-09-29, per user direction), so entry clears it.

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

/** A fresh visit: the next mount opens on its default counter. */
export function clearGuildHallTab(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Storage unavailable — nothing was held. */
  }
}

export function writeGuildHallTab(tab: GuildHallTab): void {
  try {
    localStorage.setItem(STORAGE_KEY, tab);
  } catch {
    /* Storage unavailable — the hall opens on its default next time. */
  }
}
