import { Fragment } from 'react';
import { moves } from '../../data/moves';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { RosterEntry } from '../../run/state';
import type { EquipmentDefinition, EquipmentSlot } from '../../run/equipment';
import { equipmentStatModifiers } from '../../run/equipment';
import { mergeStatMods } from '../../run/statMods';
import { getTypeColor } from '../combat/typeColors';

const STAT_ORDER: StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed', 'manaPool', 'mpRegen'];

const STAT_LABELS: Record<StatKey, string> = {
  hp: 'HP',
  attack: 'Attack',
  defense: 'Defense',
  intelligence: 'Intelligence',
  wisdom: 'Wisdom',
  speed: 'Speed',
  manaPool: 'Mana Pool',
  mpRegen: 'MP Regen',
};

const EQUIP_SLOT_ORDER: EquipmentSlot[] = ['weapon', 'armor', 'accessory'];

const EQUIP_SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  accessory: 'Accessory',
};

interface Props {
  hero: HeroDefinition;
  entry: RosterEntry;
  equipmentLookup: Record<string, EquipmentDefinition>;
  onClose: () => void;
}

function fmtGrant(n: number): string {
  if (n === 0) return '—';
  return n > 0 ? `+${n}` : `${n}`;
}

/**
 * Out-of-combat stat/loadout preview, opened by an info button before a
 * fight starts (SquadSelectScreen — both the player's own roster and the
 * scouted enemy squad). Unlike combat's HeroDetailOverlay, there's no live
 * Combatant to read yet (no fight exists): effective stats are computed
 * directly from base + rank-up grants + equipped-item grants, the same
 * inputs buildCombatState.ts feeds the engine at fight start.
 */
export function HeroPreviewOverlay({ hero, entry, equipmentLookup, onClose }: Props) {
  const grants = mergeStatMods(entry.rankStatGrants, equipmentStatModifiers(entry.equipment, equipmentLookup));

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header">
          <div className="detail-name">
            {hero.name} — Lv {entry.level}
          </div>
          <div className="combatant-types">
            {hero.types.map((t) => (
              <span key={t} className="type-tag" style={{ color: getTypeColor(t) }}>
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="detail-section-title">Stats</div>
        <div className="detail-stat-grid">
          <span className="detail-stat-head">Stat</span>
          <span className="detail-stat-head">Base</span>
          <span className="detail-stat-head">Grants</span>
          <span className="detail-stat-head">Total</span>
          {STAT_ORDER.map((stat) => {
            const grant = grants[stat] ?? 0;
            return (
              <Fragment key={stat}>
                <span>{STAT_LABELS[stat]}</span>
                <span>{hero.baseStats[stat]}</span>
                <span className={grant > 0 ? 'stat-buff' : grant < 0 ? 'stat-debuff' : ''}>{fmtGrant(grant)}</span>
                <span>{hero.baseStats[stat] + grant}</span>
              </Fragment>
            );
          })}
        </div>

        <div className="detail-section-title">Moves</div>
        {entry.unlockedMoveIds.length > 0 ? (
          <div className="detail-modifier-list">
            {entry.unlockedMoveIds.map((id) => (
              <span key={id} className="detail-status-chip">
                {moves[id]?.name ?? id}
              </span>
            ))}
          </div>
        ) : (
          <div className="detail-empty">No moves.</div>
        )}

        <div className="detail-section-title">Equipment</div>
        <div className="detail-equip-list">
          {EQUIP_SLOT_ORDER.map((slot) => {
            const itemId = entry.equipment[slot];
            const item = itemId ? equipmentLookup[itemId] : null;
            return (
              <div className="detail-equip-row" key={slot}>
                <span className="detail-equip-slot">{EQUIP_SLOT_LABELS[slot]}</span>
                <span className="detail-equip-item">{item ? item.name : '— empty —'}</span>
              </div>
            );
          })}
        </div>

        <div className="detail-close-hint">Tap anywhere to close</div>
      </div>
    </div>
  );
}
