import { currentEvolutionPathId } from '../../run/progression';
import { turnedCurse } from '../../run/curse';
import { curseStarId, hasCurseStar, hasEvolutionStar, starCycleOf, type Profile } from '../../run/profile';
import { stardustBalance } from '../../run/starShop';
import { starShopCatalog } from '../../data/starShop';
import type { RosterEntry, RunState } from '../../run/state';

/** One star a run added: new when `fromCycle` is 0, otherwise re-coloured from that Cycle up. */
export interface EarnedStar {
  id: string;
  cycle: number;
  fromCycle: number;
}

export interface VictoryStars {
  byRosterId: Record<string, EarnedStar[]>;
  clearBonus: number;
  balanceBefore: number;
  balanceAfter: number;
}

function heroStarIds(profile: Profile, entry: RosterEntry): { id: string; cycle: number }[] {
  const out: { id: string; cycle: number }[] = [];
  const curse = turnedCurse(entry);
  if (curse) out.push({ id: curseStarId(curse.id), cycle: starCycleOf(profile, curseStarId(curse.id), hasCurseStar(profile, curse.id)) });
  const pathId = currentEvolutionPathId(entry);
  if (pathId) out.push({ id: pathId, cycle: starCycleOf(profile, pathId, hasEvolutionStar(profile, entry.heroId, pathId)) });
  return out;
}

/** Diffed off the profile either side of the record, so the ceremony cannot disagree with what was written. */
export function victoryStars(run: RunState, before: Profile, after: Profile): VictoryStars {
  const byRosterId: Record<string, EarnedStar[]> = {};
  for (const entry of run.roster) {
    const was = heroStarIds(before, entry);
    const earned = heroStarIds(after, entry)
      .map((star, i) => ({ id: star.id, cycle: star.cycle, fromCycle: was[i]?.cycle ?? 0 }))
      .filter((star) => star.cycle > star.fromCycle);
    if (earned.length > 0) byRosterId[entry.rosterId] = earned;
  }
  return {
    byRosterId,
    clearBonus: after.bonusStardust - before.bonusStardust,
    balanceBefore: stardustBalance(before, starShopCatalog),
    balanceAfter: stardustBalance(after, starShopCatalog),
  };
}
