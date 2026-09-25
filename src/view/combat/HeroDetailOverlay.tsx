import { useState, type CSSProperties } from 'react';
import { moves } from '../../data/moves';
import { classes } from '../../data/classes';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { Combatant, StatContext } from '../../engine/state';
import {
  combatantManaCost,
  effectiveTypes,
  getEffectiveStat,
  getMaxHp,
  getMaxMana,
  moveForHero,
  statModifierCeiling,
  statModifierFloor,
} from '../../engine/state';
import type { RosterEntry } from '../../run/state';
import type { StatScale } from '../../run/statScale';
import type { EquipmentDefinition } from '../../run/equipment';
import { chosenEvolutionPaths, itemSlotsFor } from '../../run/progression';
import { chosenClass } from '../../run/classes';
import { levelOf } from '../../run/growth';
import { progressionTable } from '../../data/progression';
import { StatGlyph, STAT_LABELS, STAT_ORDER, StatBars, hpTier, ShieldFill, ShieldLabel } from '../shared/StatBars';
import { shieldHeld } from '../../engine/status/shield';
import { statuses } from '../../data/statuses';
import { EquipmentSlotGrid, ItemReadout } from '../shared/EquipmentBox';
import { ItemDetailCard } from '../shared/ItemDossier';
import { MasteryPips } from '../shared/MasteryPips';
import { MoveButtonReplica, swallowGhostClick, useLongPress } from '../shared/MoveTile';
import { MoveDetailCard } from './MoveDetailOverlay';
import { TabStrip, type TabSpec } from '../shared/TabStrip';
import { TypeBadge } from '../shared/TypeBadge';
import { TypeMatchups } from '../shared/TypeMatchups';
import { HeroPortrait } from '../shared/HeroPortrait';
import { HubGlyph } from '../shared/nodeIcons';
import { getTypeColor } from './typeColors';
import { StatusGlyph, statusColor, statusTint, PoisonPips } from '../shared/statusIcons';
import { passives } from '../../data/passives';
import { PassiveReadout } from '../shared/passiveIcons';
import { PassiveDetailCard } from '../shared/PassiveDossier';

interface Props {
  hero: HeroDefinition;
  combatant: Combatant;
  /** null when the roster has no matching entry (guarded for safety). */
  rosterEntry: RosterEntry | null;
  equipmentLookup: Record<string, EquipmentDefinition>;
  /** The player's stat reference (run/statScale.ts), either side — both sides read on one scale. */
  scale?: StatScale;
  /** Field Effect plus the board a conditional passive reads (state.ts StatContext). */
  statCtx: StatContext;
  onClose: () => void;
}

type TabId = 'stats' | 'moves' | 'gear' | 'passives';
type PopupRef = { kind: 'move' | 'equipment' | 'class'; id: string };

function fmtMod(n: number): string {
  if (n === 0) return '—';
  return n > 0 ? `+${n}` : `${n}`;
}

/** "Burn 20" / "Bleed" — boolean statuses carry no number and render bare. */
function fmtStatus(statusId: string, magnitude: number | undefined, duration: number | undefined): string {
  const n = magnitude ?? duration;
  return n !== undefined ? `${statusId} ${n}` : statusId;
}

/**
 * The in-fight hero sheet, either side — the same four-page sheet the run reads a hero on
 * (HeroPreviewOverlay), so a hero checked mid-fight and a hero checked on the map are one design
 * (2026-09-15, per user direction; it was the one-scroll sheet the run retired on 2026-09-07).
 *
 * What the fight adds sits on the Stats page: the HP and MP bars, the → readout and the
 * "can't go any lower" tick on every stat, the modifier chips and the statuses. A move on the
 * Moves page is priced as THIS fight prices it — the per-move ledger applied, an unaffordable row
 * dimmed the way the console dims it — because the question asked here is "what can it cast next
 * round", not "what does it know".
 */
export function HeroDetailOverlay({ hero, combatant, rosterEntry, equipmentLookup, statCtx, scale, onClose }: Props) {
  // Loadout grants plus in-fight changes — unlike CombatantCard's badges, which flag only the latter.
  const totalModifiers = Object.fromEntries(
    STAT_ORDER.map((stat) => [stat, (combatant.baselineStatModifiers[stat] ?? 0) + (combatant.statModifiers[stat] ?? 0)])
  ) as Record<StatKey, number>;
  const hasModifiers = STAT_ORDER.some((stat) => totalModifiers[stat] !== 0);
  // What THIS fight did, apart from the loadout: the → readout and the floor tick (docs/stat-scaling.md §5).
  const fightReadout = {
    deltas: Object.fromEntries(STAT_ORDER.map((stat) => [stat, combatant.statModifiers[stat] ?? 0])) as Partial<Record<StatKey, number>>,
    floors: Object.fromEntries(
      STAT_ORDER.map((stat) => [stat, hero.baseStats[stat] + (combatant.baselineStatModifiers[stat] ?? 0) + statModifierFloor(hero, combatant, stat)])
    ) as Partial<Record<StatKey, number>>,
    ceilings: Object.fromEntries(
      STAT_ORDER.map((stat) => [stat, hero.baseStats[stat] + (combatant.baselineStatModifiers[stat] ?? 0) + statModifierCeiling(hero, combatant, stat)])
    ) as Partial<Record<StatKey, number>>,
  };
  const heldAtFloor = (stat: StatKey) => {
    const floor = statModifierFloor(hero, combatant, stat);
    return floor < 0 && (combatant.statModifiers[stat] ?? 0) <= floor;
  };
  const heldAtCeiling = (stat: StatKey) => {
    const ceiling = statModifierCeiling(hero, combatant, stat);
    return ceiling > 0 && (combatant.statModifiers[stat] ?? 0) >= ceiling;
  };
  const effectiveTotals = Object.fromEntries(
    STAT_ORDER.map((stat) => [stat, getEffectiveStat(hero, combatant, stat, statCtx)])
  ) as Record<StatKey, number>;
  const evolved = rosterEntry ? chosenEvolutionPaths(progressionTable, rosterEntry) : [];
  const heroClass = rosterEntry ? chosenClass(classes, rosterEntry) : null;
  const types = effectiveTypes(hero, combatant);
  // Effective Wisdom (mid-fight buffs and field effect included), not the loadout baseline.
  const healCaster = { wisdom: effectiveTotals.wisdom, types, stats: effectiveTotals };
  const maxHp = getMaxHp(hero, combatant);
  const maxMana = getMaxMana(hero, combatant);
  const hpFraction = maxHp > 0 ? Math.max(0, combatant.currentHp) / maxHp : 0;
  const manaFraction = maxMana > 0 ? Math.min(1, combatant.currentMana / maxMana) : 0;
  const manaOverFraction = maxMana > 0 ? Math.max(0, Math.min(1, (combatant.currentMana - maxMana) / maxMana)) : 0;
  // Hide a duration-shape status once its counter hits 0 (see CombatantCard).
  const visibleStatuses = Object.values(combatant.statuses).filter((s) => s.duration === undefined || s.duration > 0);
  const passiveList = Object.values(combatant.passives).filter((instance) => passives[instance.passiveId]);
  const moveIds = rosterEntry?.unlockedMoveIds.filter((id) => moves[id]) ?? [];
  const heldItems = rosterEntry?.equipment.flatMap((id) => (equipmentLookup[id] ? [equipmentLookup[id]] : [])) ?? [];

  const [tab, setTab] = useState<TabId>('stats');
  const [popup, setPopup] = useState<PopupRef | null>(null);

  const tabs: TabSpec<TabId>[] = [
    { id: 'stats', label: 'Stats', glyph: 'stats' },
    { id: 'moves', label: 'Moves', glyph: 'moves', count: moveIds.length },
    { id: 'gear', label: 'Gear', glyph: 'equipment', count: heldItems.length },
    { id: 'passives', label: 'Passives', glyph: 'passives', count: passiveList.length },
  ];

  // swallowGhostClick: releasing the hold fires a synthesized click that would otherwise read as a dismiss (MoveTile.tsx).
  function openPopup(next: PopupRef) {
    swallowGhostClick();
    setPopup(next);
  }

  const classLongPress = useLongPress(heroClass ? () => openPopup({ kind: 'class', id: heroClass.id }) : undefined);

  // A click on the backdrop closes only THIS overlay (never bubbles to the screen beneath); with the popup open it closes just the popup.
  function closeFromBackdrop(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    if (popup) {
      setPopup(null);
      return;
    }
    onClose();
  }

  return (
    <div className="detail-overlay is-sheet" onClick={closeFromBackdrop}>
      {/* Cut in the hero's INNATE primary colour, as the run's sheet is: a graft changes what the
          hero fights like, never who it is. The badges below carry the effective pair. */}
      <div
        className="detail-panel is-tabbed is-hero-sheet"
        style={{ '--hero-color': getTypeColor(hero.types[0]) } as CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="detail-header is-hero">
          <span className="detail-portrait-plate">
            <HeroPortrait heroId={hero.id} className="detail-portrait is-inline" />
          </span>
          <div className="detail-header-titles">
            <div className="detail-name">
              {hero.name}
              {rosterEntry && <span className="detail-level">Lv {levelOf(rosterEntry)}</span>}
            </div>
            <div className="combatant-types">
              {types.map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
            {rosterEntry && <MasteryPips mastery={rosterEntry.mastery} className="detail-mastery" />}
            {(evolved.length > 0 || heroClass) && (
              <div className="detail-evolution-row">
                {evolved.map((path) => (
                  <span key={path.id} className="evolution-badge">
                    {path.name}
                  </span>
                ))}
                {heroClass && (
                  <span className="evolution-badge class-badge" {...classLongPress} title="Hold to view details">
                    <HubGlyph name="hall" /> {heroClass.name}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="detail-tab-body" role="tabpanel">
          {tab === 'stats' && (
            <>
              <div className="detail-resource-row">
                <div>
                  <div className="bar-track">
                    <div className={`bar-fill ${hpTier(hpFraction)}`} style={{ width: `${hpFraction * 100}%` }} />
                    <ShieldFill currentHp={combatant.currentHp} maxHp={maxHp} shield={shieldHeld(combatant, statuses)} />
                  </div>
                  <div className="bar-label">
                    HP {Math.max(0, combatant.currentHp)}/{maxHp}
                    <ShieldLabel shield={shieldHeld(combatant, statuses)} />
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

              {/* Matchups lead, as on the run's sheet: which columns hurt this hero is the first thing asked. */}
              <TypeMatchups types={types} />
              <StatBars baseStats={hero.baseStats} deltas={totalModifiers} totals={effectiveTotals} fight={fightReadout} scale={scale} />

              {hasModifiers && (
                <>
                  <div className="tab-subhead">Buffs / Debuffs</div>
                  <div className="detail-modifier-list">
                    {STAT_ORDER.filter((stat) => totalModifiers[stat] !== 0).map((stat) => {
                      const mod = totalModifiers[stat];
                      return (
                        <span
                          key={stat}
                          className={`detail-modifier-chip ${mod > 0 ? 'stat-buff' : 'stat-debuff'}${heldAtFloor(stat) || heldAtCeiling(stat) ? ' stat-held' : ''}`}
                        >
                          <StatGlyph stat={stat} tone="inherit" /> {STAT_LABELS[stat]} {fmtMod(mod)}
                          {heldAtFloor(stat) && <span className="detail-modifier-floor"> · can't go any lower</span>}
                          {heldAtCeiling(stat) && <span className="detail-modifier-floor"> · can't go any higher</span>}
                        </span>
                      );
                    })}
                  </div>
                </>
              )}

              {visibleStatuses.length > 0 && (
                <>
                  <div className="tab-subhead">Statuses</div>
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
                </>
              )}
            </>
          )}

          {tab === 'moves' && (
            <div className="tab-move-list">
              {moveIds.map((id) => {
                // Priced as the fight prices it: the ledger applied, and dim where the pool can't pay.
                const move = moveForHero(moves[id], hero);
                const cost = combatantManaCost(move, combatant);
                return (
                  <MoveButtonReplica
                    key={id}
                    move={cost === move.manaCost ? move : { ...move, manaCost: cost }}
                    unusable={combatant.currentMana < cost}
                    caster={healCaster}
                    onClick={() => openPopup({ kind: 'move', id })}
                  />
                );
              })}
            </div>
          )}

          {tab === 'gear' && rosterEntry && (
            <>
              <EquipmentSlotGrid
                loadout={rosterEntry.equipment}
                capacity={itemSlotsFor(hero, rosterEntry)}
                equipmentLookup={equipmentLookup}
                onInspect={(id) => openPopup({ kind: 'equipment', id })}
              />
              <div className="tab-readout-list">
                {heldItems.map((item) => (
                  <ItemReadout key={item.id} item={item} />
                ))}
              </div>
            </>
          )}

          {tab === 'passives' && (
            <div className="tab-readout-list">
              {passiveList.map((instance) => (
                <PassiveReadout key={instance.passiveId} passive={passives[instance.passiveId]} count={instance.stacks} />
              ))}
            </div>
          )}
        </div>

        <TabStrip tabs={tabs} active={tab} onSelect={setTab} />
      </div>

      <div className="sheet-footer" onClick={(e) => e.stopPropagation()}>
        <button className="resolve-button sheet-close-button" onClick={onClose}>
          Close
        </button>
      </div>

      {popup && (
        <div
          className="log-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setPopup(null);
          }}
        >
          <div className="log-panel move-popup-panel">
            {popup.kind === 'move' ? (
              // Priced by the fight here too, so the dossier agrees with the row that opened it.
              moves[popup.id] ? (
                <MoveDetailCard
                  move={{ ...moveForHero(moves[popup.id], hero), manaCost: combatantManaCost(moves[popup.id], combatant) }}
                  caster={healCaster}
                />
              ) : null
            ) : popup.kind === 'equipment' ? (
              equipmentLookup[popup.id] ? <ItemDetailCard item={equipmentLookup[popup.id]} /> : null
            ) : (
              // A Class is a verb: its move at this hero's type, or its passive.
              (() => {
                const cls = classes[popup.id];
                const classMove = cls?.grantsMoveId ? moves[cls.grantsMoveId] : null;
                return classMove ? (
                  <MoveDetailCard move={moveForHero(classMove, hero)} caster={healCaster} />
                ) : cls?.grantsPassiveId && passives[cls.grantsPassiveId] ? (
                  <PassiveDetailCard passive={passives[cls.grantsPassiveId]} />
                ) : null;
              })()
            )}
            <div className="move-popup-hint">Tap anywhere to close</div>
          </div>
        </div>
      )}
    </div>
  );
}
