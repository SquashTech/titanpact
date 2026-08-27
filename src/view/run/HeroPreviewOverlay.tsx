import { useState } from 'react';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import { classes } from '../../data/classes';
import { passives } from '../../data/passives';
import { relics } from '../../data/relics';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { RosterEntry } from '../../run/state';
import type { EquipmentDefinition } from '../../run/equipment';
import { relicTeamStatModifiers } from '../../run/relics';
import { relicTeamPassiveGrants } from '../../run/passives';
import { entryPassiveCounts, entryStatModifiers, relicStatContribution } from '../../run/entryStats';
import { chosenEvolutionPaths, rosterEntryTypes } from '../../run/progression';
import { chosenClass } from '../../run/classes';
import { StatBars, StatGlyph, STAT_LABELS } from '../shared/StatBars';
import { SectionGlyph } from '../shared/sectionIcons';
import { MoveTile, MoveInfoPanel, swallowGhostClick, useLongPress } from '../shared/MoveTile';
import { EquipmentInfoPanel, EquipmentSlotGrid } from '../shared/EquipmentBox';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { PassiveInfoPanel } from '../shared/passiveIcons';

interface Props {
  hero: HeroDefinition;
  entry: RosterEntry;
  equipmentLookup: Record<string, EquipmentDefinition>;
  /**
   * The owning team's relics (RunState.relics), so this sheet shows the same
   * numbers the fight will (relics are team-wide — src/run/relics.ts — and
   * every combatant on the side gets them at build time). Omit for a hero
   * that is NOT on this team: the scouted enemy squad (SquadSelectScreen)
   * and the pre-run draft, where the player owns no relics yet.
   */
  relicIds?: readonly string[];
  onClose: () => void;
}

/**
 * Out-of-combat stat/loadout preview, opened by an info button before a
 * fight starts (SquadSelectScreen — both the player's own roster and the
 * scouted enemy squad). Unlike combat's HeroDetailOverlay, there's no live
 * Combatant to read yet (no fight exists), so stats come from entryStats.ts
 * — literally the same function buildCombatState.ts calls to produce a
 * Combatant's baselineStatModifiers, so this sheet can't drift out of sync
 * with what the fight actually uses (it did: relic grants were missing here).
 */
export function HeroPreviewOverlay({ hero, entry, equipmentLookup, relicIds = [], onClose }: Props) {
  const heroClass = chosenClass(classes, entry);
  const teamStatModifiers = relicTeamStatModifiers(relicIds, relics);
  const teamPassiveGrants = relicTeamPassiveGrants(relicIds, relics);
  const passiveCounts = entryPassiveCounts(entry, equipmentLookup, teamPassiveGrants);
  const grants = entryStatModifiers(entry, equipmentLookup, passives, passiveCounts, teamStatModifiers);
  /** The relic-sourced slice of `grants`, called out under the bars so a team-wide buff is legible as a relic's doing rather than looking like the hero's own numbers. */
  const relicGrants = Object.entries(relicStatContribution(teamStatModifiers, teamPassiveGrants, passives)) as [StatKey, number][];
  const evolved = chosenEvolutionPaths(progressionTable, entry);
  /** Long-press-triggered move/item/class detail popup — shared by the moves row, the equipment grid, and the Class badge below (mirrors LevelUpScreen's movePopup, "hold to inspect" standard). */
  const [popup, setPopup] = useState<{ kind: 'move' | 'equipment' | 'class'; id: string } | null>(null);

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
  function openPopup(next: { kind: 'move' | 'equipment' | 'class'; id: string }) {
    swallowGhostClick();
    setPopup(next);
  }

  const classLongPress = useLongPress(heroClass ? () => openPopup({ kind: 'class', id: heroClass.id }) : undefined);

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
          {heroClass && (
            <div className="detail-evolution-row">
              <span className="evolution-badge class-badge" {...classLongPress} title="Hold to view details">
                🏛️ {heroClass.name}
              </span>
            </div>
          )}
        </div>

        <div className="detail-section-title"><SectionGlyph name="stats" /> Stats</div>
        <StatBars baseStats={hero.baseStats} deltas={grants} />
        {relicGrants.length > 0 && (
          <div className="relic-contrib-row">
            <span className="relic-contrib-label">🏺 From relics</span>
            {relicGrants.map(([stat, amount]) => (
              <span key={stat} className="relic-contrib-chip">
                <StatGlyph stat={stat} /> {STAT_LABELS[stat]} {amount > 0 ? `+${amount}` : amount}
              </span>
            ))}
          </div>
        )}

        <div className="detail-section-title"><SectionGlyph name="moves" /> Moves</div>
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

        <div className="detail-section-title"><SectionGlyph name="equipment" /> Equipment</div>
        <EquipmentSlotGrid loadout={entry.equipment} equipmentLookup={equipmentLookup} onInspect={(id) => openPopup({ kind: 'equipment', id })} />

        <div className="detail-close-hint">Hold a move, item, or Class to inspect it — tap elsewhere to close</div>
      </div>

      {/* Long-press-triggered move/item/class detail popup (see `popup` state above) — reuses .log-overlay/.log-panel like LevelUpScreen's move popup, including "tap anywhere to close" (no stopPropagation on the panel). */}
      {popup && (
        <div className="log-overlay" onClick={() => setPopup(null)}>
          <div className="log-panel move-popup-panel">
            {popup.kind === 'move' ? (
              <MoveInfoPanel move={moves[popup.id] ?? null} />
            ) : popup.kind === 'equipment' ? (
              <EquipmentInfoPanel item={equipmentLookup[popup.id] ?? null} />
            ) : (
              <PassiveInfoPanel passive={classes[popup.id] ?? null} />
            )}
            <div className="move-popup-hint">Tap anywhere to close</div>
          </div>
        </div>
      )}
    </div>
  );
}
