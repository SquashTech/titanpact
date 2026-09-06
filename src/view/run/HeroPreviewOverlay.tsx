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
import { MoveTile, swallowGhostClick, useLongPress } from '../shared/MoveTile';
import { MoveDetailCard } from '../combat/MoveDetailOverlay';
import { EquipmentInfoPanel, EquipmentSlotGrid } from '../shared/EquipmentBox';
import { TypeBadge } from '../shared/TypeBadge';
import { TypeMatchups } from '../shared/TypeMatchups';
import { HeroPortrait } from '../shared/HeroPortrait';
import { PassiveInfoPanel } from '../shared/passiveIcons';

interface Props {
  hero: HeroDefinition;
  entry: RosterEntry;
  equipmentLookup: Record<string, EquipmentDefinition>;
  /** The owning team's relics (RunState.relics). Omit for a hero not on this team — a scouted enemy, or the pre-run draft. */
  relicIds?: readonly string[];
  /**
   * A hero not on the roster yet (the Guild Hall shelf): hides the equip grid, which is always
   * empty, and the relic breakdown, which is a given. Relic bonuses stay in the stat bars.
   */
  unowned?: boolean;
  /** Turns the sheet into a decision: a confirm button under the loadout, plus Cancel. Omit for read-only previews. */
  action?: {
    label: string;
    /** Rendered above the button — why it is inert, or what confirming will additionally cost. */
    note?: string;
    disabled?: boolean;
    onConfirm: () => void;
  };
  onClose: () => void;
}

/**
 * Out-of-combat stat/loadout sheet. Stats come from entryStats.ts — the same function
 * buildCombatState.ts uses for a Combatant's baseline — so this sheet cannot drift from the fight.
 */
export function HeroPreviewOverlay({ hero, entry, equipmentLookup, relicIds = [], unowned = false, action, onClose }: Props) {
  const heroClass = chosenClass(classes, entry);
  const teamStatModifiers = relicTeamStatModifiers(relicIds, relics);
  const teamPassiveGrants = relicTeamPassiveGrants(relicIds, relics);
  const passiveCounts = entryPassiveCounts(entry, equipmentLookup, teamPassiveGrants);
  const grants = entryStatModifiers(entry, equipmentLookup, passives, passiveCounts, teamStatModifiers);
  const relicGrants = Object.entries(relicStatContribution(teamStatModifiers, teamPassiveGrants, passives)) as [StatKey, number][];
  const evolved = chosenEvolutionPaths(progressionTable, entry);
  const types = rosterEntryTypes(hero, entry);
  // Not healCasterForEntry: that reads the global equipment table, and this sheet must honour `equipmentLookup`.
  const healCaster = { wisdom: hero.baseStats.wisdom + (grants.wisdom ?? 0), types };
  const [popup, setPopup] = useState<{ kind: 'move' | 'equipment' | 'class'; id: string } | null>(null);

  // swallowGhostClick: releasing the hold fires a synthetic click on whatever now covers the tile,
  // which would reach an ancestor's onClick (possibly outside this component) and read as a dismiss.
  function openPopup(next: { kind: 'move' | 'equipment' | 'class'; id: string }) {
    swallowGhostClick();
    setPopup(next);
  }

  const classLongPress = useLongPress(heroClass ? () => openPopup({ kind: 'class', id: heroClass.id }) : undefined);

  // Stops propagation on the backdrop too, so a click here never also closes the screen that
  // rendered this overlay (e.g. Manage Roster's own backdrop).
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
      <div className="detail-panel" onClick={closeAndStop}>
        <HeroPortrait heroId={hero.id} className="detail-portrait" />
        <div className="detail-header">
          <div className="detail-name">
            {hero.name} — Lv {entry.level}
          </div>
          <div className="combatant-types">
            {types.map((t) => (
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

        <div className="detail-section-title"><SectionGlyph name="matchups" /> Matchups</div>
        <TypeMatchups types={types} />

        <div className="detail-section-title"><SectionGlyph name="stats" /> Stats</div>
        <StatBars baseStats={hero.baseStats} deltas={grants} />
        {!unowned && relicGrants.length > 0 && (
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

        {!unowned && (
          <>
            <div className="detail-section-title"><SectionGlyph name="equipment" /> Equipment</div>
            <EquipmentSlotGrid loadout={entry.equipment} equipmentLookup={equipmentLookup} onInspect={(id) => openPopup({ kind: 'equipment', id })} />
          </>
        )}

        {/* stopPropagation: closeAndStop treats any tap in the panel as dismiss, which would fire before the confirm. */}
        {action && (
          <div className="detail-action" onClick={(e) => e.stopPropagation()}>
            {action.note && <div className="detail-action-note">{action.note}</div>}
            <button className="resolve-button" disabled={action.disabled} onClick={action.onConfirm}>
              {action.label}
            </button>
            <button className="detail-action-cancel" onClick={onClose}>
              Cancel
            </button>
          </div>
        )}

        <div className="detail-close-hint">
          {`Hold a move${unowned ? '' : ', item'}, or Class to inspect it${action ? '' : ' — tap elsewhere to close'}`}
        </div>
      </div>

      {popup && (
        <div className="log-overlay" onClick={() => setPopup(null)}>
          <div className="log-panel move-popup-panel">
            {popup.kind === 'move' ? (
              moves[popup.id] ? <MoveDetailCard move={moves[popup.id]} caster={healCaster} /> : null
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
