import type { CSSProperties } from 'react';
import { moves } from '../../data/moves';
import { passives } from '../../data/passives';
import { relics } from '../../data/relics';
import { statuses } from '../../data/statuses';
import { STAT_ORDER, type HeroDefinition, type StatKey } from '../../engine/content';
import { moveForHero } from '../../engine/state';
import { entryPassiveCounts, entryStatModifiers } from '../../run/entryStats';
import type { EquipmentDefinition } from '../../run/equipment';
import { equipment } from '../../data/equipment';
import { innatePassiveIdsFor } from '../../run/innate';
import { itemFitChips } from '../../run/itemFit';
import { relicTeamPassiveGrants } from '../../run/passives';
import { relicTeamStatModifiers } from '../../run/relics';
import type { RosterEntry, RunState } from '../../run/state';
import { getTypeColor } from '../combat/typeColors';
import { StatusGlyph } from '../shared/statusIcons';
import { STAT_FULL_LABELS } from '../shared/relicStacks';
import { STAT_COLORS, StatGlyph } from '../shared/statIcons';

/** The item's grants repeated on a hero's card: lit where this hero leans on it (docs/gear-absorption.md §2). */
export function ItemFitChips({ run, hero, entry, item }: { run: RunState; hero: HeroDefinition; entry: RosterEntry; item: EquipmentDefinition }) {
  const counts = entryPassiveCounts(entry, equipment, relicTeamPassiveGrants(run.relics, relics), innatePassiveIdsFor(hero, entry));
  const grants = entryStatModifiers(entry, equipment, passives, counts, relicTeamStatModifiers(run.relics, relics), run.gold);
  const stats = Object.fromEntries(STAT_ORDER.map((stat) => [stat, hero.baseStats[stat] + (grants[stat] ?? 0)])) as Record<StatKey, number>;
  const kit = entry.unlockedMoveIds.flatMap((id) => (moves[id] ? [moveForHero(moves[id], hero)] : []));
  const chips = itemFitChips(item, stats, kit, statuses);
  if (chips.length === 0) return null;
  return (
    <span className="item-fit-chips">
      {chips.map((chip) => {
        if (chip.kind === 'speed') {
          return (
            <span key="speed" className="item-fit-chip is-speed" style={{ '--fit-color': STAT_COLORS.speed } as CSSProperties} title={`Speed ${chip.value}`}>
              <StatGlyph stat="speed" tone="inherit" />
              {chip.value}
            </span>
          );
        }
        if (chip.kind === 'stat') {
          return (
            <span key={chip.stat} className={`item-fit-chip${chip.lit ? ' is-lit' : ''}`} style={{ '--fit-color': STAT_COLORS[chip.stat] } as CSSProperties} title={STAT_FULL_LABELS[chip.stat]}>
              <StatGlyph stat={chip.stat} tone="inherit" />
            </span>
          );
        }
        const def = statuses[chip.statusId];
        return (
          <span key={chip.statusId} className={`item-fit-chip${chip.lit ? ' is-lit' : ''}`} style={{ '--fit-color': def?.forceType ? getTypeColor(def.forceType) : '#ffd98a' } as CSSProperties} title={def?.name}>
            <StatusGlyph statusId={chip.statusId} />
          </span>
        );
      })}
    </span>
  );
}
