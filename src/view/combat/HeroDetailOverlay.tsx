import { useState } from 'react';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { Combatant } from '../../engine/state';
import { effectiveTypes, getEffectiveStat, getMaxHp, getMaxMana } from '../../engine/state';
import type { RosterEntry } from '../../run/state';
import type { EquipmentDefinition } from '../../run/equipment';
import { chosenEvolutionPaths } from '../../run/progression';
import { progressionTable } from '../../data/progression';
import { STAT_ICONS, STAT_LABELS, STAT_ORDER, StatBars } from '../shared/StatBars';
import { EquipmentInfoPanel, EquipmentSlotGrid } from '../shared/EquipmentBox';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { statusEmoji, statusColor, statusTint, PoisonPips } from '../shared/statusIcons';

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
  const effectiveTotals = Object.fromEntries(STAT_ORDER.map((stat) => [stat, getEffectiveStat(hero, combatant, stat)])) as Record<StatKey, number>;
  const evolved = rosterEntry ? chosenEvolutionPaths(progressionTable, rosterEntry) : [];
  const [viewedEquipmentId, setViewedEquipmentId] = useState<string | null>(null);
  const viewedEquipment = viewedEquipmentId ? (equipmentLookup[viewedEquipmentId] ?? null) : null;

  /**
   * Stops propagation here (not just on the panel) so a click anywhere in
   * this overlay — backdrop or panel background alike — closes only THIS
   * overlay and never bubbles into whatever screen rendered it.
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
          <div className="detail-name">{hero.name}</div>
          <div className="combatant-types">
            {effectiveTypes(hero, combatant).map((t) => (
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

        <div className="detail-resource-row">
          <span>
            HP {Math.max(0, combatant.currentHp)}/{getMaxHp(hero, combatant)}
          </span>
          <span>
            MP {combatant.currentMana}/{getMaxMana(hero, combatant)}
          </span>
        </div>

        <div className="detail-section-title">Stats</div>
        <StatBars baseStats={hero.baseStats} deltas={combatant.statModifiers} totals={effectiveTotals} />

        <div className="detail-section-title">Buffs / Debuffs</div>
        {hasModifiers ? (
          <div className="detail-modifier-list">
            {STAT_ORDER.filter((stat) => (combatant.statModifiers[stat] ?? 0) !== 0).map((stat) => {
              const mod = combatant.statModifiers[stat] ?? 0;
              return (
                <span key={stat} className={`detail-modifier-chip ${mod > 0 ? 'stat-buff' : 'stat-debuff'}`}>
                  {STAT_ICONS[stat]} {STAT_LABELS[stat]} {fmtMod(mod)}
                </span>
              );
            })}
          </div>
        ) : (
          <div className="detail-empty">No active modifiers.</div>
        )}

        <div className="detail-section-title">Statuses</div>
        {/* Hide a duration-shape status (Stealth) once its counter hits 0 — see
            CombatantCard.tsx's matching filter for why it can still be present
            in state for the rest of that round. */}
        {(() => {
          const visibleStatuses = Object.values(combatant.statuses).filter((s) => s.duration === undefined || s.duration > 0);
          return visibleStatuses.length > 0 ? (
            <div className="detail-modifier-list">
              {visibleStatuses.map((s) => {
                const emoji = statusEmoji[s.statusId];
                return (
                  <span
                    key={s.statusId}
                    className="detail-status-chip"
                    style={{
                      color: statusColor(s.statusId),
                      background: statusTint(s.statusId, 0.12),
                      borderColor: statusTint(s.statusId, 0.5),
                    }}
                  >
                    {emoji && <span className="status-emoji">{emoji}</span>}
                    {fmtStatus(s.statusId, s.magnitude, s.duration)}
                    {s.statusId === 'Poison' && <PoisonPips duration={s.duration} />}
                  </span>
                );
              })}
            </div>
          ) : (
            <div className="detail-empty">No active statuses.</div>
          );
        })()}

        <div className="detail-section-title">Equipment</div>
        {rosterEntry ? (
          <>
            <EquipmentSlotGrid
              loadout={rosterEntry.equipment}
              equipmentLookup={equipmentLookup}
              viewedItemId={viewedEquipmentId}
              onSelect={setViewedEquipmentId}
            />
            <EquipmentInfoPanel item={viewedEquipment} />
          </>
        ) : (
          <div className="detail-empty">No loadout data.</div>
        )}

        <div className="detail-close-hint">Tap a move or item to inspect it — tap elsewhere to close</div>
      </div>
    </div>
  );
}
