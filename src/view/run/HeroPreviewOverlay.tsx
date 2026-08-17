import { useState } from 'react';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition } from '../../engine/content';
import type { RosterEntry } from '../../run/state';
import type { EquipmentDefinition, EquipmentSlot } from '../../run/equipment';
import { equipmentStatModifiers } from '../../run/equipment';
import { mergeStatMods } from '../../run/statMods';
import { chosenEvolutionPaths, rosterEntryTypes } from '../../run/progression';
import { StatBars } from '../shared/StatBars';
import { MoveTile, MoveInfoPanel } from '../shared/MoveTile';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';

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

/**
 * Out-of-combat stat/loadout preview, opened by an info button before a
 * fight starts (SquadSelectScreen — both the player's own roster and the
 * scouted enemy squad). Unlike combat's HeroDetailOverlay, there's no live
 * Combatant to read yet (no fight exists): effective stats are computed
 * directly from base + Evolution grants + equipped-item grants, the same
 * inputs buildCombatState.ts feeds the engine at fight start.
 */
export function HeroPreviewOverlay({ hero, entry, equipmentLookup, onClose }: Props) {
  const grants = mergeStatMods(entry.evolutionStatGrants, equipmentStatModifiers(entry.equipment, equipmentLookup));
  const evolved = chosenEvolutionPaths(progressionTable, entry);
  const [viewedMoveId, setViewedMoveId] = useState<string | null>(null);
  const viewedMove = viewedMoveId ? (moves[viewedMoveId] ?? null) : null;

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <HeroPortrait heroId={hero.id} className="detail-portrait" />
        <div className="detail-header">
          <div className="detail-name">
            {hero.name} — Lv {entry.level}
          </div>
          <div className="combatant-types">
            {rosterEntryTypes(hero, entry).map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
          {evolved.length > 0 && (
            <div className="detail-evolution-row">
              {evolved.map((path) => (
                <span key={path.id} className={`evolution-badge evolution-${path.kind}`}>
                  {path.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="detail-section-title">Stats</div>
        <StatBars baseStats={hero.baseStats} deltas={grants} />

        <div className="detail-section-title">Moves</div>
        {entry.unlockedMoveIds.length > 0 ? (
          <>
            <div className="move-tile-row">
              {entry.unlockedMoveIds.map((id) =>
                moves[id] ? (
                  <MoveTile
                    key={id}
                    move={moves[id]}
                    selected={viewedMoveId === id}
                    onHover={() => setViewedMoveId(id)}
                    onClick={() => setViewedMoveId(id)}
                  />
                ) : (
                  <span key={id} className="detail-status-chip">
                    {id}
                  </span>
                )
              )}
            </div>
            <MoveInfoPanel move={viewedMove} />
          </>
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
