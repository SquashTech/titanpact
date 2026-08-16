import type { HeroDefinition, StatKey } from '../../engine/content';
import type { Combatant } from '../../engine/state';
import { effectiveTypes, getMaxHp, getMaxMana } from '../../engine/state';
import type { RosterEntry } from '../../run/state';
import type { EquipmentDefinition, EquipmentSlot } from '../../run/equipment';
import { getTypeColor } from './typeColors';
import { STAT_LABELS, STAT_ORDER, StatBars } from '../shared/StatBars';

const EQUIP_SLOT_ORDER: EquipmentSlot[] = ['weapon', 'armor', 'accessory'];

const EQUIP_SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  accessory: 'Accessory',
};

interface Props {
  hero: HeroDefinition;
  combatant: Combatant;
  /** null when the roster this combatant belongs to has no matching entry (shouldn't happen in practice, guarded for safety). */
  rosterEntry: RosterEntry | null;
  equipmentLookup: Record<string, EquipmentDefinition>;
  onClose: () => void;
}

function fmtMod(n: number): string {
  if (n === 0) return '—';
  return n > 0 ? `+${n}` : `${n}`;
}

/** "Burn 20" / "Daze 2" / "Bleed" — mirrors CombatantCard's badge text (magnitude/duration shown when the status carries one). */
function fmtStatus(statusId: string, magnitude: number | undefined, duration: number | undefined): string {
  const n = magnitude ?? duration;
  return n !== undefined ? `${statusId} ${n}` : statusId;
}

/**
 * Full stat/loadout readout for a single combatant, opened by tapping a
 * battlefield card's info button (CombatantCard.tsx). Works for either side —
 * everything it reads (hero, combatant, roster entry) is already visible to
 * the player once a hero is on the battlefield, so there's no hidden-info
 * concern the way there is for the enemy bench. Dismisses on any tap,
 * anywhere (docs/architecture.md presentation-layer convention shared with
 * the battle log overlay).
 */
export function HeroDetailOverlay({ hero, combatant, rosterEntry, equipmentLookup, onClose }: Props) {
  const hasModifiers = STAT_ORDER.some((stat) => (combatant.statModifiers[stat] ?? 0) !== 0);

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header">
          <div className="detail-name">{hero.name}</div>
          <div className="combatant-types">
            {effectiveTypes(hero, combatant).map((t) => (
              <span key={t} className="type-tag" style={{ color: getTypeColor(t) }}>
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="detail-resource-row">
          <span>
            HP {Math.max(0, combatant.currentHp)}/{getMaxHp(hero, combatant)}
          </span>
          <span>
            MP {combatant.currentMana}/{getMaxMana(hero, combatant)}
          </span>
        </div>

        <div className="detail-section-title">Stats</div>
        <StatBars baseStats={hero.baseStats} deltas={combatant.statModifiers} />

        <div className="detail-section-title">Buffs / Debuffs</div>
        {hasModifiers ? (
          <div className="detail-modifier-list">
            {STAT_ORDER.filter((stat) => (combatant.statModifiers[stat] ?? 0) !== 0).map((stat) => {
              const mod = combatant.statModifiers[stat] ?? 0;
              return (
                <span key={stat} className={`detail-modifier-chip ${mod > 0 ? 'stat-buff' : 'stat-debuff'}`}>
                  {STAT_LABELS[stat]} {fmtMod(mod)}
                </span>
              );
            })}
          </div>
        ) : (
          <div className="detail-empty">No active modifiers.</div>
        )}

        <div className="detail-section-title">Statuses</div>
        {Object.values(combatant.statuses).length > 0 ? (
          <div className="detail-modifier-list">
            {Object.values(combatant.statuses).map((s) => (
              <span key={s.statusId} className={`detail-status-chip${s.statusId === 'Regen' ? ' status-badge-positive' : ''}`}>
                {fmtStatus(s.statusId, s.magnitude, s.duration)}
              </span>
            ))}
          </div>
        ) : (
          <div className="detail-empty">No active statuses.</div>
        )}

        <div className="detail-section-title">Equipment</div>
        {rosterEntry ? (
          <div className="detail-equip-list">
            {EQUIP_SLOT_ORDER.map((slot) => {
              const itemId = rosterEntry.equipment[slot];
              const item = itemId ? equipmentLookup[itemId] : null;
              return (
                <div className="detail-equip-row" key={slot}>
                  <span className="detail-equip-slot">{EQUIP_SLOT_LABELS[slot]}</span>
                  <span className="detail-equip-item">{item ? item.name : '— empty —'}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="detail-empty">No loadout data.</div>
        )}

        <div className="detail-close-hint">Tap anywhere to close</div>
      </div>
    </div>
  );
}
