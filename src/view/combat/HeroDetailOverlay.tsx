import { useState } from 'react';
import { moves } from '../../data/moves';
import { fieldEffects } from '../../data/fieldEffects';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { ActiveFieldEffect, Combatant } from '../../engine/state';
import { effectiveTypes, getEffectiveStat, getMaxHp, getMaxMana } from '../../engine/state';
import type { RosterEntry } from '../../run/state';
import type { EquipmentDefinition } from '../../run/equipment';
import { chosenEvolutionPaths } from '../../run/progression';
import { progressionTable } from '../../data/progression';
import { STAT_ICONS, STAT_LABELS, STAT_ORDER, StatBars, hpTier } from '../shared/StatBars';
import { EquipmentInfoPanel, EquipmentSlotGrid } from '../shared/EquipmentBox';
import { MoveTile, MoveInfoPanel, swallowGhostClick } from '../shared/MoveTile';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { StatusGlyph, statusColor, statusTint, PoisonPips } from '../shared/statusIcons';
import { passives } from '../../data/passives';
import { passiveEmoji, passiveColor, passiveTint, PassiveInfoPanel } from '../shared/passiveIcons';

interface Props {
  hero: HeroDefinition;
  combatant: Combatant;
  /** null when the roster this combatant belongs to has no matching entry (shouldn't happen in practice, guarded for safety). */
  rosterEntry: RosterEntry | null;
  equipmentLookup: Record<string, EquipmentDefinition>;
  /** The battlefield's current Field Effect, if any (docs/field-effects.md) — threaded into getEffectiveStat so a Verdant Earth-boosted Attack/Intelligence reads correctly here instead of showing the unboosted loadout value. */
  activeFieldEffect: ActiveFieldEffect | null;
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
export function HeroDetailOverlay({ hero, combatant, rosterEntry, equipmentLookup, activeFieldEffect, onClose }: Props) {
  // Loadout (equipment/relic/Evolution/Class) grants combined with whatever a
  // move/passive has changed THIS fight — this full sheet shows both, unlike
  // the battlefield card's badges (CombatantCard.tsx activeStatMods), which
  // only flag the latter.
  const totalModifiers = Object.fromEntries(
    STAT_ORDER.map((stat) => [stat, (combatant.baselineStatModifiers[stat] ?? 0) + (combatant.statModifiers[stat] ?? 0)])
  ) as Record<StatKey, number>;
  const fieldEffectCtx = { active: activeFieldEffect, defs: fieldEffects };
  const hasModifiers = STAT_ORDER.some((stat) => totalModifiers[stat] !== 0);
  const effectiveTotals = Object.fromEntries(
    STAT_ORDER.map((stat) => [stat, getEffectiveStat(hero, combatant, stat, fieldEffectCtx)])
  ) as Record<StatKey, number>;
  const evolved = rosterEntry ? chosenEvolutionPaths(progressionTable, rosterEntry) : [];
  const maxHp = getMaxHp(hero, combatant);
  const maxMana = getMaxMana(hero, combatant);
  const hpFraction = maxHp > 0 ? Math.max(0, combatant.currentHp) / maxHp : 0;
  const manaFraction = maxMana > 0 ? combatant.currentMana / maxMana : 0;
  /** Long-press-triggered move/item/passive detail popup — shared by the moves row, the equipment grid, and the passives row below (mirrors LevelUpScreen's movePopup, "hold to inspect" standard). */
  const [popup, setPopup] = useState<{ kind: 'move' | 'equipment' | 'passive'; id: string } | null>(null);

  /**
   * Opens the popup and arms swallowGhostClick (MoveTile.tsx) — releasing
   * the hold that got us here fires a browser-synthesized "ghost" click
   * (the popup now covers the tile, so pointerup lands on it instead of the
   * original element) that would otherwise reach whichever ancestor's
   * onClick and get misread as a deliberate dismiss. See that function's
   * doc comment for the full mechanism.
   */
  function openPopup(next: { kind: 'move' | 'equipment' | 'passive'; id: string }) {
    swallowGhostClick();
    setPopup(next);
  }

  /**
   * Stops propagation here (not just on the panel) so a click anywhere in
   * this overlay — backdrop or panel background alike — closes only THIS
   * overlay and never bubbles into whatever screen rendered it. A deliberate
   * click elsewhere in the panel while the popup is open dismisses just the
   * popup, not the whole hero sheet.
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
            </div>
            <div className="bar-label">
              MP {combatant.currentMana}/{maxMana}
            </div>
          </div>
        </div>

        <div className="detail-section-title">📊 Stats</div>
        <StatBars baseStats={hero.baseStats} deltas={totalModifiers} totals={effectiveTotals} />

        <div className="detail-section-title">✨ Buffs / Debuffs</div>
        {hasModifiers ? (
          <div className="detail-modifier-list">
            {STAT_ORDER.filter((stat) => totalModifiers[stat] !== 0).map((stat) => {
              const mod = totalModifiers[stat];
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

        <div className="detail-section-title">🩹 Statuses</div>
        {/* Hide a duration-shape status (Stealth) once its counter hits 0 — see
            CombatantCard.tsx's matching filter for why it can still be present
            in state for the rest of that round. */}
        {(() => {
          const visibleStatuses = Object.values(combatant.statuses).filter((s) => s.duration === undefined || s.duration > 0);
          return visibleStatuses.length > 0 ? (
            <div className="detail-modifier-list">
              {visibleStatuses.map((s) => {
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
                    <StatusGlyph statusId={s.statusId} />
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

        <div className="detail-section-title">🌟 Passives</div>
        {Object.keys(combatant.passives).length > 0 ? (
          <div className="detail-modifier-list">
            {Object.values(combatant.passives).map((instance) => {
              const def = passives[instance.passiveId];
              if (!def) return null;
              return (
                <span
                  key={instance.passiveId}
                  className="detail-status-chip"
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
                  {passiveEmoji[instance.passiveId] && <span className="status-emoji">{passiveEmoji[instance.passiveId]}</span>}
                  {def.name}
                  {instance.stacks > 1 && ` ×${instance.stacks}`}
                </span>
              );
            })}
          </div>
        ) : (
          <div className="detail-empty">No active passives.</div>
        )}

        <div className="detail-section-title">⚔️ Moves</div>
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

        <div className="detail-section-title">🎒 Equipment</div>
        {rosterEntry ? (
          <EquipmentSlotGrid
            loadout={rosterEntry.equipment}
            equipmentLookup={equipmentLookup}
            onInspect={(id) => openPopup({ kind: 'equipment', id })}
          />
        ) : (
          <div className="detail-empty">No loadout data.</div>
        )}

        <div className="detail-close-hint">Hold a move or item, or tap a passive, to inspect it — tap elsewhere to close</div>
      </div>

      {/* Long-press-triggered move/item detail popup (see `popup` state above) — reuses .log-overlay/.log-panel like LevelUpScreen's move popup, including "tap anywhere to close" (no stopPropagation on the panel). */}
      {popup && (
        <div className="log-overlay" onClick={() => setPopup(null)}>
          <div className="log-panel move-popup-panel">
            {popup.kind === 'move' ? (
              <MoveInfoPanel move={moves[popup.id] ?? null} />
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
