import { useState } from 'react';
import { moves } from '../../data/moves';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { Combatant, StatContext } from '../../engine/state';
import { effectiveTypes, getEffectiveStat, getMaxHp, getMaxMana } from '../../engine/state';
import type { RosterEntry } from '../../run/state';
import type { EquipmentDefinition } from '../../run/equipment';
import { chosenEvolutionPaths, itemSlotsFor } from '../../run/progression';
import { progressionTable } from '../../data/progression';
import { StatGlyph, STAT_LABELS, STAT_ORDER, StatBars, hpTier } from '../shared/StatBars';
import { SectionGlyph } from '../shared/sectionIcons';
import { EquipmentInfoPanel, EquipmentSlotGrid } from '../shared/EquipmentBox';
import { MoveTile, swallowGhostClick } from '../shared/MoveTile';
import { MoveDetailCard } from './MoveDetailOverlay';
import { TypeBadge } from '../shared/TypeBadge';
import { TypeMatchups } from '../shared/TypeMatchups';
import { HeroPortrait } from '../shared/HeroPortrait';
import { StatusGlyph, statusColor, statusTint, PoisonPips } from '../shared/statusIcons';
import { passives } from '../../data/passives';
import { PassiveGlyph, passiveColor, passiveTint, PassiveInfoPanel } from '../shared/passiveIcons';

interface Props {
  hero: HeroDefinition;
  combatant: Combatant;
  /** null when the roster has no matching entry (guarded for safety). */
  rosterEntry: RosterEntry | null;
  equipmentLookup: Record<string, EquipmentDefinition>;
  /** Field Effect plus the board a conditional passive reads (state.ts StatContext). */
  statCtx: StatContext;
  onClose: () => void;
}

type PopupRef = { kind: 'move' | 'equipment' | 'passive'; id: string };

function fmtMod(n: number): string {
  if (n === 0) return '—';
  return n > 0 ? `+${n}` : `${n}`;
}

/** "Burn 20" / "Bleed" — boolean statuses carry no number and render bare. */
function fmtStatus(statusId: string, magnitude: number | undefined, duration: number | undefined): string {
  const n = magnitude ?? duration;
  return n !== undefined ? `${statusId} ${n}` : statusId;
}

/** Full stat/loadout readout for one combatant, either side. Dismisses on any tap. */
export function HeroDetailOverlay({ hero, combatant, rosterEntry, equipmentLookup, statCtx, onClose }: Props) {
  // Loadout grants plus in-fight changes — unlike CombatantCard's badges, which flag only the latter.
  const totalModifiers = Object.fromEntries(
    STAT_ORDER.map((stat) => [stat, (combatant.baselineStatModifiers[stat] ?? 0) + (combatant.statModifiers[stat] ?? 0)])
  ) as Record<StatKey, number>;
  const hasModifiers = STAT_ORDER.some((stat) => totalModifiers[stat] !== 0);
  const effectiveTotals = Object.fromEntries(
    STAT_ORDER.map((stat) => [stat, getEffectiveStat(hero, combatant, stat, statCtx)])
  ) as Record<StatKey, number>;
  const evolved = rosterEntry ? chosenEvolutionPaths(progressionTable, rosterEntry) : [];
  const types = effectiveTypes(hero, combatant);
  // Effective Wisdom (mid-fight buffs and field effect included), not the loadout baseline.
  const healCaster = { wisdom: effectiveTotals.wisdom, types };
  const maxHp = getMaxHp(hero, combatant);
  const maxMana = getMaxMana(hero, combatant);
  const hpFraction = maxHp > 0 ? Math.max(0, combatant.currentHp) / maxHp : 0;
  const manaFraction = maxMana > 0 ? Math.min(1, combatant.currentMana / maxMana) : 0;
  const manaOverFraction = maxMana > 0 ? Math.max(0, Math.min(1, (combatant.currentMana - maxMana) / maxMana)) : 0;
  // Hide a duration-shape status once its counter hits 0 (see CombatantCard).
  const visibleStatuses = Object.values(combatant.statuses).filter((s) => s.duration === undefined || s.duration > 0);
  const passiveList = Object.values(combatant.passives);
  const [popup, setPopup] = useState<PopupRef | null>(null);

  // swallowGhostClick: releasing the hold fires a synthesized click that would otherwise read as a dismiss (MoveTile.tsx).
  function openPopup(next: PopupRef) {
    swallowGhostClick();
    setPopup(next);
  }

  // A click anywhere closes only THIS overlay (never bubbles to the screen beneath); with the popup open it closes just the popup.
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
          <div className="detail-name">{hero.name}</div>
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
        </div>

        <div className="detail-section-title"><SectionGlyph name="matchups" /> Matchups</div>
        <TypeMatchups types={types} />

        <div className="detail-resource-row">
          <div>
            <div className="bar-track">
              <div className={`bar-fill ${hpTier(hpFraction)}`} style={{ width: `${hpFraction * 100}%` }} />
            </div>
            <div className="bar-label">
              HP {Math.max(0, combatant.currentHp)}/{maxHp}
            </div>
          </div>
          <div>
            <div className="bar-track">
              <div className="bar-fill mana" style={{ width: `${manaFraction * 100}%` }} />
              {manaOverFraction > 0 && <div className="bar-fill mana-over" style={{ width: `${manaOverFraction * 100}%` }} />}
            </div>
            <div className={`bar-label${manaOverFraction > 0 ? ' is-overcharged' : ''}`}>
              MP {combatant.currentMana}/{maxMana}
            </div>
          </div>
        </div>

        <div className="detail-section-title"><SectionGlyph name="stats" /> Stats</div>
        <StatBars baseStats={hero.baseStats} deltas={totalModifiers} totals={effectiveTotals} />

        <div className="detail-section-title"><SectionGlyph name="buffs" /> Buffs / Debuffs</div>
        {hasModifiers ? (
          <div className="detail-modifier-list">
            {STAT_ORDER.filter((stat) => totalModifiers[stat] !== 0).map((stat) => {
              const mod = totalModifiers[stat];
              return (
                <span key={stat} className={`detail-modifier-chip ${mod > 0 ? 'stat-buff' : 'stat-debuff'}`}>
                  <StatGlyph stat={stat} tone="inherit" /> {STAT_LABELS[stat]} {fmtMod(mod)}
                </span>
              );
            })}
          </div>
        ) : (
          <div className="detail-empty">No active modifiers.</div>
        )}

        <div className="detail-section-title"><SectionGlyph name="statuses" /> Statuses</div>
        {visibleStatuses.length > 0 ? (
          <div className="detail-modifier-list">
            {visibleStatuses.map((s) => (
              <span
                key={s.statusId}
                className="detail-status-chip"
                style={{
                  color: statusColor(s.statusId),
                  background: statusTint(s.statusId, 0.12),
                  borderColor: statusTint(s.statusId, 0.5),
                }}
              >
                <StatusGlyph statusId={s.statusId} />
                {fmtStatus(s.statusId, s.magnitude, s.duration)}
                {s.statusId === 'Poison' && <PoisonPips duration={s.duration} />}
              </span>
            ))}
          </div>
        ) : (
          <div className="detail-empty">No active statuses.</div>
        )}

        <div className="detail-section-title"><SectionGlyph name="passives" /> Passives</div>
        {passiveList.length > 0 ? (
          <div className="detail-modifier-list">
            {passiveList.map((instance) => {
              const def = passives[instance.passiveId];
              if (!def) return null;
              return (
                <button
                  key={instance.passiveId}
                  type="button"
                  className="detail-status-chip detail-passive-chip"
                  aria-label={`${def.name} — inspect`}
                  style={{
                    color: passiveColor(instance.passiveId),
                    background: passiveTint(instance.passiveId, 0.12),
                    borderColor: passiveTint(instance.passiveId, 0.5),
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    openPopup({ kind: 'passive', id: instance.passiveId });
                  }}
                >
                  <PassiveGlyph passiveId={instance.passiveId} />
                  {def.name}
                  {instance.stacks > 1 && <span className="detail-passive-stacks">×{instance.stacks}</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="detail-empty">No active passives.</div>
        )}

        <div className="detail-section-title"><SectionGlyph name="moves" /> Moves</div>
        {rosterEntry && rosterEntry.unlockedMoveIds.length > 0 ? (
          <div className="move-tile-row">
            {rosterEntry.unlockedMoveIds.map((moveId) =>
              moves[moveId] ? (
                <MoveTile key={moveId} move={moves[moveId]} onLongPress={() => openPopup({ kind: 'move', id: moveId })} />
              ) : null
            )}
          </div>
        ) : (
          <div className="detail-empty">No moves.</div>
        )}

        <div className="detail-section-title"><SectionGlyph name="equipment" /> Items</div>
        {rosterEntry ? (
          <EquipmentSlotGrid
            loadout={rosterEntry.equipment}
            capacity={itemSlotsFor(hero, rosterEntry)}
            equipmentLookup={equipmentLookup}
            onInspect={(id) => openPopup({ kind: 'equipment', id })}
          />
        ) : (
          <div className="detail-empty">No item data.</div>
        )}

        <div className="detail-close-hint">Hold a move or item, or tap a passive, to inspect it — tap elsewhere to close</div>
      </div>

      {popup && (
        <div className="log-overlay" onClick={() => setPopup(null)}>
          <div className="log-panel move-popup-panel">
            {popup.kind === 'move' ? (
              // No combat context: this sheet is read out of a fight as often as in one, so the forecast half does not render.
              moves[popup.id] ? <MoveDetailCard move={moves[popup.id]} caster={healCaster} /> : null
            ) : popup.kind === 'equipment' ? (
              <EquipmentInfoPanel item={equipmentLookup[popup.id] ?? null} />
            ) : (
              <PassiveInfoPanel passive={passives[popup.id] ?? null} />
            )}
            <div className="move-popup-hint">Tap anywhere to close</div>
          </div>
        </div>
      )}
    </div>
  );
}
