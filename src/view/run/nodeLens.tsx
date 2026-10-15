import type { CSSProperties, ReactNode } from 'react';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import type { MapNodeType } from '../../run/map';
import { MASTERY_CAP } from '../../run/mastery';
import { MANA_WELL_AMOUNT, LEY_LINE_FORCE } from '../../run/runProgress';
import { levelOf } from '../../run/growth';
import { MOVE_CAP, rosterEntryTypes } from '../../run/progression';
import { equipmentStatusGrants } from '../../run/statusGrants';
import { tutorMovePool } from '../../run/tutor';
import type { RosterEntry, RunState } from '../../run/state';
import { TypeBadge } from '../shared/TypeBadge';
import { MasteryPips } from '../shared/MasteryPips';
import { RARITY_COLOR_VARS } from '../shared/EquipmentBox';
import { entryStatTotals } from '../shared/entryStatTotals';

/** What of the roster a node's decision turns on. Null: nothing on the roster changes the answer. */
type Lens = 'mastery' | 'mana' | 'force' | 'gear' | 'hp' | 'moves' | 'types' | 'level' | null;

const LENS: Record<MapNodeType, Lens> = {
  fight: 'level',
  battle: 'level',
  skirmish: 'level',
  elite: 'level',
  boss: 'level',
  finale: 'level',
  shop: 'hp',
  muster: 'hp',
  restReward: 'hp',
  equipmentReward: 'gear',
  forgeReward: 'gear',
  scrollReward: 'mastery',
  scribeReward: 'mastery',
  manaWellReward: 'mana',
  leyLineReward: 'force',
  passiveReward: 'types',
  blessingReward: 'hp',
  mentorReward: 'level',
  tutorReward: 'moves',
  academyReward: 'moves',
  patronSeat: null,
  currencyReward: null,
  contractReward: null,
  event: null,
};

/** Force the hero already draws at its own element, off its gear and any Ley Line. */
function forceAt(entry: RosterEntry, type: string): number {
  const id = `${type}Force`;
  return (entry.bonusStatusGrants[id] ?? 0) + (equipmentStatusGrants(entry.equipment, equipment)[id] ?? 0);
}

/** "50→90": what the node would make of a figure the hero holds now. */
function Lift({ from, to }: { from: number; to: number }) {
  return (
    <span className="node-lens-lift">
      {from}
      <span className="node-lens-arrow">→</span>
      <strong>{to}</strong>
    </span>
  );
}

export interface NodeLensMark {
  /** Drawn in place of the chip's HP bar; null keeps the bar. */
  bar: ReactNode;
  /** Set on the portrait's corner. */
  badge: ReactNode;
  /** The node does nothing for this hero. */
  dim: boolean;
}

/**
 * What a map node's decision turns on, for one hero — the pips a Gem lands on, the pool a Well
 * deepens, the sockets a chest fills — worn by the footer's party chip while the node is read, so
 * the choice is made with the facts in view. Null: the chip stays as it is (HP is the lens).
 */
export function nodeLensMark(type: MapNodeType, entry: RosterEntry, run: RunState): NodeLensMark | null {
  const hero = rosterHeroes[entry.heroId];
  if (!hero) return null;
  const mark = (bar: ReactNode, dim = false, badge: ReactNode = null): NodeLensMark => ({ bar, badge, dim });
  switch (LENS[type]) {
    case 'level':
      return mark(null, false, <span className="node-lens-level">Lv {levelOf(entry)}</span>);
    case 'types':
      return mark(
        null,
        false,
        <span className="node-lens-types">
          {rosterEntryTypes(hero, entry).map((t) => (
            <TypeBadge key={t} type={t} iconOnly />
          ))}
        </span>
      );
    case 'mastery':
      return mark(<MasteryPips mastery={entry.mastery} className="node-lens-pips" />, entry.mastery >= MASTERY_CAP);
    case 'mana': {
      const pool = entryStatTotals(hero, entry, run.relics).manaPool;
      return mark(<Lift from={pool} to={pool + MANA_WELL_AMOUNT} />);
    }
    case 'force': {
      const element = hero.types[0];
      const now = forceAt(entry, element);
      const count = entry.unlockedMoveIds.filter((id) => moves[id]?.type === element).length;
      return mark(<Lift from={now} to={now + LEY_LINE_FORCE} />, count === 0);
    }
    case 'gear': {
      const worn = entry.equipment.map((id) => equipment[id]).filter(Boolean);
      return mark(
        <span className="node-lens-gear">
          {[0, 1, 2].map((i) => {
            const item = worn[i];
            return item ? (
              <span key={i} className="node-lens-socket is-filled" style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties} />
            ) : (
              <span key={i} className="node-lens-socket" />
            );
          })}
        </span>,
        type === 'forgeReward' ? worn.length === 0 : worn.length >= 3
      );
    }
    case 'moves':
      return mark(
        <span className="node-lens-lift">
          <strong>{entry.unlockedMoveIds.length}</strong>/{MOVE_CAP}
        </span>,
        tutorMovePool(progressionTable, moves, entry).length === 0
      );
    default:
      return null;
  }
}
