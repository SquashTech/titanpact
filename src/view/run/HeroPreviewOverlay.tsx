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
import { MoveTile, MoveInfoPanel, swallowGhostClick } from '../shared/MoveTile';
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
  /** Long-press-triggered move/item detail popup — shared by the moves row and the equipment grid below (mirrors LevelUpScreen's movePopup, "hold to inspect" standard). */
  const [popup, setPopup] = useState<{ kind: 'move' | 'equipment'; id: string } | null>(null);

  /**
   * Opens the popup and arms swallowGhostClick (MoveTile.tsx) — releasing
   * the hold that got us here fires a browser-synthesized "ghost" click
   * (the popup now covers the tile, so pointerup lands on it instead of the
   * original element) that would otherwise reach whichever ancestor's
   * onClick and get misread as a deliberate dismiss — including, when this
   * overlay is opened from inside another modal like Manage Roster, an
   * ancestor further out than this component even knows about. See that
   * function's doc comment for the full mechanism.
   */
  function openPopup(next: { kind: 'move' | 'equipment'; id: string }) {
    swallowGhostClick();
    setPopup(next);
  }

  /**
   * Stops propagation here (not just on the panel) so a click anywhere in
   * this overlay — backdrop or panel background alike — closes only THIS
   * overlay and never bubbles into whatever screen rendered it (e.g.
   * RosterManagementScreen's own backdrop, which would otherwise also close
   * on the same click). A deliberate click elsewhere in the panel while the
   * popup is open dismisses just the popup, not the whole hero sheet.
   */
  function closeAndStop(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    if (popup) {
      setPopup(null);
      return;
    }
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

        <div className="detail-section-title">📊 Stats</div>
        <StatBars baseStats={hero.baseStats} deltas={grants} />

        <div className="detail-section-title">⚔️ Moves</div>
        {entry.unlockedMoveIds.length > 0 ? (
          <div className="move-tile-row">
            {entry.unlockedMoveIds.map((id) =>
              moves[id] ? (
                <MoveTile key={id} move={moves[id]} onLongPress={() => openPopup({ kind: 'move', id })} />
              ) : (
                <span key={id} className="detail-status-chip">
                  {id}
                </span>
              )
            )}
          </div>
        ) : (
          <div className="detail-empty">No moves.</div>
        )}

        <div className="detail-section-title">🎒 Equipment</div>
        <EquipmentSlotGrid loadout={entry.equipment} equipmentLookup={equipmentLookup} onInspect={(id) => openPopup({ kind: 'equipment', id })} />

        <div className="detail-close-hint">Hold a move or item to inspect it — tap elsewhere to close</div>
      </div>

      {/* Long-press-triggered move/item detail popup (see `popup` state above) — reuses .log-overlay/.log-panel like LevelUpScreen's move popup, including "tap anywhere to close" (no stopPropagation on the panel). */}
      {popup && (
        <div className="log-overlay" onClick={() => setPopup(null)}>
          <div className="log-panel move-popup-panel">
            {popup.kind === 'move' ? (
              <MoveInfoPanel move={moves[popup.id] ?? null} />
            ) : (
              <EquipmentInfoPanel item={equipmentLookup[popup.id] ?? null} />
            )}
            <div className="move-popup-hint">Tap anywhere to close</div>
          </div>
        </div>
      )}
    </div>
  );
}
