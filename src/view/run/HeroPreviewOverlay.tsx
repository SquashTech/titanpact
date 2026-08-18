import { useState } from 'react';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition } from '../../engine/content';
import type { RosterEntry } from '../../run/state';
import type { EquipmentDefinition } from '../../run/equipment';
import { equipmentStatModifiers } from '../../run/equipment';
import { mergeStatMods } from '../../run/statMods';
import { chosenEvolutionPaths, rosterEntryTypes } from '../../run/progression';
import { StatBars } from '../shared/StatBars';
import { MoveTile, MoveInfoPanel } from '../shared/MoveTile';
import { EquipmentInfoPanel, EquipmentSlotGrid } from '../shared/EquipmentBox';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';

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
  const grants = mergeStatMods(entry.evolutionStatGrants, entry.bonusStatGrants, equipmentStatModifiers(entry.equipment, equipmentLookup));
  const evolved = chosenEvolutionPaths(progressionTable, entry);
  const [viewedMoveId, setViewedMoveId] = useState<string | null>(null);
  const viewedMove = viewedMoveId ? (moves[viewedMoveId] ?? null) : null;
  const [viewedEquipmentId, setViewedEquipmentId] = useState<string | null>(null);
  const viewedEquipment = viewedEquipmentId ? (equipmentLookup[viewedEquipmentId] ?? null) : null;

  /**
   * Stops propagation here (not just on the panel) so a click anywhere in
   * this overlay — backdrop or panel background alike — closes only THIS
   * overlay and never bubbles into whatever screen rendered it (e.g.
   * RosterManagementScreen's own backdrop, which would otherwise also close
   * on the same click).
   */
  function closeAndStop(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    onClose();
  }

  return (
    <div className="detail-overlay" onClick={closeAndStop}>
      <button className="detail-close-button" onClick={onClose} aria-label="Close">
        ✕
      </button>
      {/* Tapping the panel background itself closes it too (matches the
          "Tap elsewhere to close" hint below) — only a move tile or an
          equipped item's box stops propagation, so inspecting one doesn't
          also dismiss the overlay. */}
      <div className="detail-panel" onClick={closeAndStop}>
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
        <EquipmentSlotGrid
          loadout={entry.equipment}
          equipmentLookup={equipmentLookup}
          viewedItemId={viewedEquipmentId}
          onSelect={setViewedEquipmentId}
        />
        <EquipmentInfoPanel item={viewedEquipment} />

        <div className="detail-close-hint">Tap a move or item to inspect it — tap elsewhere to close</div>
      </div>
    </div>
  );
}
