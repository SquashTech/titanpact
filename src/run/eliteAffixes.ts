// What makes an Elite a different fight (docs/guild-hall-overhaul.md §4): affixes on its side and a
// field up as it opens, drawn off the map's seed so the tap card and the fight agree.

import type { HeroLookup } from '../engine/state';
import type { TypeId } from '../engine/content';
import { createRng, nextFloat, type RngState } from '../engine/rng/seededRng';
import { ELITE_AFFIXES, ELITE_AFFIX_COUNT_BY_ACT, type EliteAffix } from '../data/eliteAffixes';
import { fieldEffects } from '../data/fieldEffects';
import { eliteOpeningFieldPassiveFor, titansMarkFor } from '../data/passives';
import type { TitanpactType } from '../data/typechart';
import type { Encounter } from './enemyGen';

export interface EliteDressing {
  affixIds: readonly string[];
  fieldEffectId: string;
}

export function eliteAffix(id: string): EliteAffix | undefined {
  return ELITE_AFFIXES.find((affix) => affix.id === id);
}

export function eliteAffixCountFor(actNumber: number): number {
  return ELITE_AFFIX_COUNT_BY_ACT[Math.min(Math.max(actNumber, 1), ELITE_AFFIX_COUNT_BY_ACT.length) - 1];
}

/** The fields an Elite fielding `types` may open on: those of its types, every one if none is. */
export function eliteFieldPool(types: readonly TypeId[]): string[] {
  const all = Object.keys(eliteOpeningFieldPassiveFor);
  const own = all.filter((id) => types.includes(fieldEffects[id].flavorType as TypeId));
  return own.length > 0 ? own : all;
}

export function rollEliteDressing(seed: number, actNumber: number, types: readonly TypeId[]): EliteDressing {
  let state: RngState = createRng(seed);
  const draw = (n: number) => {
    const { value, nextState } = nextFloat(state);
    state = nextState;
    return Math.floor(value * n);
  };
  const left = [...ELITE_AFFIXES];
  const affixIds: string[] = [];
  for (let i = 0; i < eliteAffixCountFor(actNumber) && left.length > 0; i++) affixIds.push(left.splice(draw(left.length), 1)[0].id);
  const fields = eliteFieldPool(types);
  return { affixIds, fieldEffectId: fields[draw(fields.length)] };
}

/** The dressing onto the drawn side: each affix on every enemy, the field on the first lead. */
export function dressElite(encounter: Encounter, dressing: EliteDressing, combatants: HeroLookup): Encounter {
  const affixes = dressing.affixIds.map(eliteAffix).filter((a): a is EliteAffix => !!a);
  const leadId = encounter.squad.activeIds.find((id): id is string => id !== null) ?? null;
  const fieldPassive = eliteOpeningFieldPassiveFor[dressing.fieldEffectId];
  const roster = encounter.run.roster.map((entry) => {
    const grants: string[] = [];
    for (const affix of affixes) {
      if (affix.passiveId) grants.push(affix.passiveId);
      const mark = affix.marks ? titansMarkFor[combatants[entry.heroId]?.types[0] as TitanpactType] : undefined;
      if (mark) grants.push(mark);
    }
    if (entry.rosterId === leadId && fieldPassive) grants.push(fieldPassive);
    return grants.length > 0 ? { ...entry, bonusPassiveGrants: [...entry.bonusPassiveGrants, ...grants] } : entry;
  });
  return { ...encounter, run: { ...encounter.run, roster } };
}
