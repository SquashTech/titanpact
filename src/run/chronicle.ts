// The Chronicle: what the Cycle tapestry says under each cleared Cycle (docs/cycles.md §4), read
// off the account's first win on that Cycle. History is capped, so an old Cycle may have lost its
// record; it still gets a line.

import type { Profile, RunRecord } from './profile';
import type { Warden } from './wardens';

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth'];

/** The tip id that remembers a Cycle's panel has been woven in front of the player. */
export function chronicleWovenTipId(cycle: number): string {
  return `chronicle.cycle${cycle}`;
}

/** The newest cleared Cycle whose weave the player has not seen yet, or undefined. */
export function pendingWeave(profile: Pick<Profile, 'cyclesCleared' | 'seenTipIds'>): number | undefined {
  const cycle = profile.cyclesCleared;
  return cycle > 0 && !profile.seenTipIds.includes(chronicleWovenTipId(cycle)) ? cycle : undefined;
}

/** The oldest win on that Cycle still in the history (history is newest first). */
export function firstWinOn(history: readonly RunRecord[], cycle: number): RunRecord | undefined {
  for (let i = history.length - 1; i >= 0; i--) if (history[i].outcome === 'win' && history[i].cycle === cycle) return history[i];
  return undefined;
}

function list(names: readonly string[]): string {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** One caption per cleared Cycle. */
export function chronicleLines(
  profile: Pick<Profile, 'cyclesCleared' | 'runHistory' | 'wardens'>,
  nameOf: (heroId: string) => string | undefined
): Record<number, string> {
  const lines: Record<number, string> = {};
  for (let cycle = 1; cycle <= profile.cyclesCleared; cycle++) {
    const year = `The ${ORDINALS[cycle - 1] ?? `${cycle}th`} year.`;
    const ids = cycle === 1 && profile.wardens.length > 0 ? profile.wardens.map((w) => w.heroId) : (firstWinOn(profile.runHistory, cycle)?.roster.map((h) => h.heroId) ?? []);
    const names = list(ids.map(nameOf).filter((n): n is string => !!n));
    if (cycle === 1) lines[cycle] = names ? `${year} ${names} sealed the Titan, and stayed to hold its seals.` : `${year} The Titan was sealed, and its sealers stayed to hold the seals.`;
    else lines[cycle] = names ? `${year} ${names} sealed it again.` : `${year} The Titan was sealed again.`;
  }
  return lines;
}

/** Who stands in the first panel: the Wardens, or the first Cycle I win's band before there were Wardens. */
export function chronicleBand(profile: Pick<Profile, 'runHistory' | 'wardens'>): { heroId: string; pathId: string | null }[] {
  if (profile.wardens.length > 0) return profile.wardens.map((w: Warden) => ({ heroId: w.heroId, pathId: w.pathId }));
  return (firstWinOn(profile.runHistory, 1)?.roster ?? []).map((h) => ({ heroId: h.heroId, pathId: h.evolutionPathId }));
}
