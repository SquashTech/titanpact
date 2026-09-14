// Wall-clock estimate for a run. The sim counts what a run is MADE of — beats to
// watch, actions to declare, screens to pass through — and this file prices each in
// seconds. The counts are measured; the prices are assumptions, and every one is
// here so a playtest can correct it in one place.

/** Every screen a run passes through that the sim can count. */
export type ScreenKind =
  | 'draft'
  | 'mapPick'
  | 'squadSelect'
  | 'fightOpen'
  | 'fightResult'
  | 'levelUp'
  | 'companion'
  | 'contract'
  | 'drop'
  | 'offer'
  | 'moveLearned'
  | 'evolution'
  | 'banner'
  | 'crucible'
  | 'pactSeal'
  | 'actIntro'
  | 'scrollReward'
  | 'currencyReward'
  | 'manaWellReward'
  | 'equipmentReward'
  | 'passiveReward'
  | 'forgeReward'
  | 'mentorReward'
  | 'tutorReward'
  | 'scribeReward'
  | 'blacksmith'
  | 'event'
  | 'shop'
  | 'muster';

/**
 * Seconds a player spends on each screen, for a player reading at a normal pace and making the
 * choice the screen asks for. A report screen (level-up, Pact Seal) is its animation plus a tap;
 * a choice screen is the animation plus the comparison it asks for.
 */
export const SCREEN_SECONDS: Record<ScreenKind, number> = {
  draft: 45,
  mapPick: 5,
  squadSelect: 10,
  fightOpen: 5,
  fightResult: 6,
  levelUp: 6,
  companion: 8,
  contract: 15,
  drop: 12,
  // A schedule offer at the cap is the replace-or-decline question; below it the move simply
  // lands and the screen is a receipt — one look, one tap.
  offer: 12,
  moveLearned: 4,
  evolution: 30,
  banner: 12,
  crucible: 20,
  pactSeal: 8,
  actIntro: 8,
  // Three taps on a pick-a-hero screen, no comparison asked: the Forge's price.
  scrollReward: 10,
  currencyReward: 4,
  // A pick-a-hero screen, the Forge's price.
  manaWellReward: 10,
  equipmentReward: 25,
  passiveReward: 20,
  forgeReward: 10,
  mentorReward: 15,
  tutorReward: 30,
  // Two taps on a pick-a-hero screen, no comparison asked: the Forge's price, less.
  scribeReward: 8,
  blacksmith: 30,
  event: 15,
  shop: 45,
  muster: 45,
};

export interface PaceProfile {
  id: string;
  label: string;
  /** Seconds per beat during round playback. */
  beatSeconds: number;
  /** Seconds to declare one hero's action (move + target, or a switch). */
  actionSeconds: number;
  /** Multiplier on SCREEN_SECONDS — a player who knows the screens moves through them faster. */
  screenScale: number;
}

/** src/view/combat/autoPlay.ts AUTO_PLAY_STEP_MS — not imported, since that file touches localStorage. */
const AUTO_STEP_S = 0.45;
const FAST_STEP_S = 0.12;
const RENDER_OVERHEAD_S = 0.08;

/**
 * Three players. `reader` taps every beat and reads it (autoplay off, the default); `auto` holds
 * the Auto key at its reading pace; `veteran` runs Fast and already knows what a round says.
 */
export const PACE_PROFILES: readonly PaceProfile[] = [
  { id: 'reader', label: 'Reader (tap every beat)', beatSeconds: 0.9, actionSeconds: 6, screenScale: 1 },
  { id: 'auto', label: 'Auto', beatSeconds: AUTO_STEP_S + RENDER_OVERHEAD_S, actionSeconds: 4, screenScale: 0.75 },
  { id: 'veteran', label: 'Veteran (Fast)', beatSeconds: FAST_STEP_S + RENDER_OVERHEAD_S, actionSeconds: 2.5, screenScale: 0.5 },
];

export interface TimeCounts {
  fights: number;
  rounds: number;
  beats: number;
  /** Player-side action declarations (one per active hero per round). */
  actions: number;
  screens: Partial<Record<ScreenKind, number>>;
}

export function emptyTimeCounts(): TimeCounts {
  return { fights: 0, rounds: 0, beats: 0, actions: 0, screens: {} };
}

export function addTimeCounts(into: TimeCounts, from: TimeCounts): void {
  into.fights += from.fights;
  into.rounds += from.rounds;
  into.beats += from.beats;
  into.actions += from.actions;
  for (const key of Object.keys(from.screens) as ScreenKind[]) {
    into.screens[key] = (into.screens[key] ?? 0) + (from.screens[key] ?? 0);
  }
}

export interface TimeBreakdown {
  beats: number;
  actions: number;
  screens: number;
  total: number;
}

/** Seconds, split by where they go. */
export function secondsFor(counts: TimeCounts, profile: PaceProfile): TimeBreakdown {
  const beats = counts.beats * profile.beatSeconds;
  const actions = counts.actions * profile.actionSeconds;
  let screens = 0;
  for (const key of Object.keys(counts.screens) as ScreenKind[]) {
    screens += (counts.screens[key] ?? 0) * SCREEN_SECONDS[key] * profile.screenScale;
  }
  return { beats, actions, screens, total: beats + actions + screens };
}
