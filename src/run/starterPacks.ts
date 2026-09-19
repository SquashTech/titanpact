// Starter Packs (docs/constellation.md §3): the list of hero ids the start-of-run draft is rolled
// from INSTEAD of the fourteen starters. The draft itself is untouched — generateStarterOptions
// takes its pool as a parameter, and a pack is a different pool. Packs are content
// (src/data/starterPacks.ts); this file is the mechanism, the same split as starShop.ts.
//
// Buying and equipping are separate: a pack is HELD (pack zero always; a clear-unlocked one
// once the profile has a clear; a bought one once its offer is in `purchases`) and at most one
// is EQUIPPED (`Profile.equippedPackId`), free and reversible from the Constellation's first
// shelf. A held pack the player never equips has cost nothing.

import type { Profile } from './profile';

export const BASE_PACK_ID = 'base';

/** Eight is the floor so the four shown are always a real draw from something larger (§3.1). */
export const PACK_MIN_HEROES = 8;

/**
 * How a pack comes to be held. `clear` is the shake-up shape: nothing to buy, it opens the moment
 * the profile records its first cleared run. `offer` is a Constellation purchase.
 */
export type PackUnlock = { kind: 'clear' } | { kind: 'offer'; offerId: string };

export interface StarterPack {
  id: string;
  name: string;
  /** One line on the shelf row. */
  description: string;
  /** ≥ PACK_MIN_HEROES. Any types, any overlap. The draft's pool while this pack is equipped. */
  heroIds: readonly string[];
  /** `base` is pack zero; `recut` is drawn from the base roster; `theme` brings heroes outside it. */
  kind: 'base' | 'recut' | 'theme';
  /** Absent on pack zero, which every profile holds. */
  unlock?: PackUnlock;
}

export class PackError extends Error {}

export function packHeld(profile: Profile, pack: StarterPack): boolean {
  if (!pack.unlock) return true;
  return pack.unlock.kind === 'clear' ? profile.runsCompleted > 0 : profile.purchases.includes(pack.unlock.offerId);
}

/**
 * The pack the next run drafts from. Falls back to pack zero when the equipped id names a pack
 * this build no longer ships or one the profile does not hold — a profile is never stranded on a
 * draft it cannot make.
 */
export function equippedPack(profile: Profile, packs: readonly StarterPack[]): StarterPack {
  const base = packs.find((pack) => pack.id === BASE_PACK_ID);
  if (!base) throw new PackError('no base pack');
  const wanted = packs.find((pack) => pack.id === profile.equippedPackId);
  return wanted && packHeld(profile, wanted) ? wanted : base;
}

/** Free and reversible; a pack not held is refused. */
export function equipPack(profile: Profile, packs: readonly StarterPack[], packId: string): Profile {
  const pack = packs.find((p) => p.id === packId);
  if (!pack) throw new PackError(`no pack ${packId}`);
  if (!packHeld(profile, pack)) throw new PackError(`${packId} is not held`);
  return { ...profile, equippedPackId: packId };
}
