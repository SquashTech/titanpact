// The sky's rules (docs/the-sky.md §2): a constellation is a set of stars, lit when every star is,
// and lighting one opens the ones that come after it. Content is data (src/data/sky.ts); this file
// is the mechanism. Every star an existing record already settles is DERIVED from that record, so
// an account lights exactly what it has done; only a new scenario's win is stored
// (`Profile.litStars`).

import type { Profile } from './profile';

/** What lights one star. Every kind but `scenario` reads a record the profile already keeps. */
export type SkyStarLight =
  | { kind: 'scenario'; scenarioId: string }
  | { kind: 'journeyWon' }
  | { kind: 'cycleCleared'; cycle: number }
  | { kind: 'trialBeaten'; trialId: string }
  | { kind: 'gauntletCleared' };

export interface SkyStar {
  id: string;
  /** In the constellation's own box, 0–1 on each axis. */
  x: number;
  y: number;
  light: SkyStarLight;
}

/** What a constellation pays once, the moment its last star is lit (docs/the-sky.md §5). */
export type SkyReward = { kind: 'stardust'; amount: number };

export interface ConstellationDefinition {
  id: string;
  name: string;
  /** The constellation's centre in the sky, 0–1 on each axis. */
  at: { x: number; y: number };
  stars: readonly SkyStar[];
  /** The shape drawn in when it is lit: pairs of indices into `stars`. */
  lines: readonly (readonly [number, number])[];
  /** Lit by any of these, it opens; none means it is open from the start. */
  after: readonly string[];
  /**
   * A tutorial constellation (§3). An account that played before the sky existed already knows what
   * it teaches, so its stars count as lit — but its reward is paid only for playing it, so the sky
   * arriving moves no existing balance.
   */
  rail?: boolean;
  /** Its scenarios are not authored yet: it opens what comes after it as if lit, and lights and pays nothing itself. */
  uncharted?: boolean;
  rewards: readonly SkyReward[];
}

/** One way to bend a Journey (§6). Each field names a mechanism that already exists in the run layer. */
export interface ScenarioModifiers {
  /** A set team, by hero id: no draft and no recruiting. */
  fixedTeam?: readonly string[];
  /** A fixed seed, so the fights play the same every time. */
  seed?: number;
  /** A run of this many acts, not the full Journey. */
  acts?: number;
  cycle?: number;
  /** Where the draft and the Guild Hall draw from, in place of the deck. */
  pool?: { kind: 'type'; type: string } | { kind: 'strangers' };
  /** Added to the run's Location pool. */
  locationIds?: readonly string[];
}

/** What winning means. Goals past a plain win land with the scenarios that need them (§10, phase 6). */
export type ScenarioGoal = { kind: 'win' };

export interface ScenarioDefinition {
  id: string;
  name: string;
  goal: ScenarioGoal;
  modifiers: ScenarioModifiers;
}

export interface SkyContent {
  constellations: Readonly<Record<string, ConstellationDefinition>>;
  scenarios: Readonly<Record<string, ScenarioDefinition>>;
}

/** How a constellation stands: drawn in, playable, shown only as a shape with its reward, or not shown. */
export type ConstellationState = 'lit' | 'open' | 'glimpsed' | 'hidden';

/** An account that finished a run or a Story chapter before the sky — the rails have nothing to teach it. */
export function playedBeforeTheSky(profile: Profile): boolean {
  return profile.runsCompleted + profile.runsFailed > 0 || profile.storyChaptersDone.length > 0;
}

function lightIsLit(profile: Profile, light: SkyStarLight): boolean {
  switch (light.kind) {
    case 'scenario':
      return profile.litStars.includes(light.scenarioId);
    case 'journeyWon':
      return profile.runsCompleted > 0;
    case 'cycleCleared':
      return profile.cyclesCleared >= light.cycle;
    case 'trialBeaten':
      return profile.trialsCleared.includes(light.trialId);
    case 'gauntletCleared':
      return profile.gauntletClears > 0;
  }
}

export function isStarLit(profile: Profile, constellation: ConstellationDefinition, star: SkyStar): boolean {
  return (!!constellation.rail && playedBeforeTheSky(profile)) || lightIsLit(profile, star.light);
}

export function isConstellationLit(profile: Profile, constellation: ConstellationDefinition): boolean {
  return constellation.stars.every((star) => isStarLit(profile, constellation, star));
}

/** Its own stars decide `lit`; the constellations it comes after decide the rest. */
export function constellationState(profile: Profile, sky: SkyContent, id: string): ConstellationState {
  const constellation = sky.constellations[id];
  if (!constellation) return 'hidden';
  if (isConstellationLit(profile, constellation)) return 'lit';
  const before = constellation.after.map((prior) => sky.constellations[prior]).filter((c): c is ConstellationDefinition => !!c);
  if (constellation.after.length === 0 || before.some((c) => c.uncharted || isConstellationLit(profile, c))) return 'open';
  if (before.some((c) => constellationState(profile, sky, c.id) === 'open')) return 'glimpsed';
  return 'hidden';
}

/** Stardust the constellations lit by play have paid, derived from the lit set so there is no count to inflate. */
export function skyStardust(profile: Profile, sky: SkyContent): number {
  let total = 0;
  for (const constellation of Object.values(sky.constellations)) {
    if (!constellation.stars.every((star) => lightIsLit(profile, star.light))) continue;
    for (const reward of constellation.rewards) if (reward.kind === 'stardust') total += reward.amount;
  }
  return total;
}

/** The scenario a star plays, when it is one. */
export function starScenario(sky: SkyContent, star: SkyStar): ScenarioDefinition | null {
  return star.light.kind === 'scenario' ? sky.scenarios[star.light.scenarioId] ?? null : null;
}

export class SkyError extends Error {}

/** A scenario won: stored the first time, unchanged on a replay. Only a scenario's star is ever stored. */
export function recordScenarioLit(profile: Profile, sky: SkyContent, scenarioId: string): Profile {
  if (!sky.scenarios[scenarioId]) throw new SkyError(`no scenario ${scenarioId}`);
  if (profile.litStars.includes(scenarioId)) return profile;
  return { ...profile, litStars: [...profile.litStars, scenarioId] };
}
