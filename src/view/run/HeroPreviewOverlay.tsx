import { useState } from 'react';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import { classes } from '../../data/classes';
import { passives } from '../../data/passives';
import { relics } from '../../data/relics';
import type { HeroDefinition, PassiveId, StatKey } from '../../engine/content';
import { STAT_ORDER } from '../../engine/content';
import type { StatModifiers } from '../../engine/state';
import type { RosterEntry } from '../../run/state';
import type { EquipmentDefinition } from '../../run/equipment';
import { equipmentStatModifiers } from '../../run/equipment';
import { relicTeamStatModifiers } from '../../run/relics';
import { relicTeamPassiveGrants, passiveStatModifiers } from '../../run/passives';
import { entryPassiveCounts, entryStatModifiers, relicStatContribution } from '../../run/entryStats';
import { chosenEvolutionPaths, itemSlotsFor, rosterEntryTypes } from '../../run/progression';
import { chosenClass } from '../../run/classes';
import { StatBars, StatGlyph, STAT_LABELS } from '../shared/StatBars';
import { TabStrip, type TabSpec } from '../shared/TabStrip';
import { MoveButtonReplica, swallowGhostClick, useLongPress } from '../shared/MoveTile';
import { MoveDetailCard } from '../combat/MoveDetailOverlay';
import { EquipmentInfoPanel, EquipmentSlotGrid, ItemReadout } from '../shared/EquipmentBox';
import { TypeBadge } from '../shared/TypeBadge';
import { TypeMatchups } from '../shared/TypeMatchups';
import { HeroPortrait } from '../shared/HeroPortrait';
import { PassiveInfoPanel, PassiveReadout } from '../shared/passiveIcons';

interface Props {
  hero: HeroDefinition;
  entry: RosterEntry;
  equipmentLookup: Record<string, EquipmentDefinition>;
  /** The owning team's relics (RunState.relics). Omit for a hero not on this team — a scouted enemy, or the pre-run draft. */
  relicIds?: readonly string[];
  /**
   * A hero not on the roster yet (the Guild Hall shelf): hides the Gear page, which is always
   * empty. Everything else — relic grants included — is what the hero would arrive with.
   */
  unowned?: boolean;
  /** Turns the sheet into a decision: a confirm button under the tabs, plus Cancel. Omit for read-only previews. */
  action?: {
    label: string;
    /** Rendered above the button — why it is inert, or what confirming will additionally cost. */
    note?: string;
    disabled?: boolean;
    onConfirm: () => void;
  };
  onClose: () => void;
}

type TabId = 'stats' | 'moves' | 'gear' | 'passives';

/** One passive on this hero, with everything the Passives page prints about it. */
interface PassiveRow {
  passiveId: PassiveId;
  count: number;
  /** Where it came from, in the player's words — an item's own name where an item granted it. */
  sources: string[];
}

/**
 * Every passive the hero actually carries, attributed. Deliberately not derived from
 * `entryPassiveCounts`, which merges the sources into a bare count: the grant lists are kept
 * separate on RosterEntry precisely so a sheet can answer "where did this come from", and this is
 * the screen that asks. Order is identity-first — Class, then Evolution, then what the run handed
 * out — so the passives a player chose lead the page.
 */
function passiveRows(
  entry: RosterEntry,
  equipmentLookup: Record<string, EquipmentDefinition>,
  teamPassiveGrants: Record<PassiveId, number>
): PassiveRow[] {
  const rows = new Map<PassiveId, PassiveRow>();
  const add = (passiveId: PassiveId, source: string) => {
    if (!passives[passiveId]) return;
    const row = rows.get(passiveId) ?? { passiveId, count: 0, sources: [] };
    row.count += 1;
    if (!row.sources.includes(source)) row.sources.push(source);
    rows.set(passiveId, row);
  };

  if (entry.classId) add(entry.classId, 'Class');
  for (const id of entry.evolutionPassiveGrants) add(id, 'Evolution');
  for (const id of entry.bonusPassiveGrants) add(id, 'Boon');
  for (const itemId of entry.equipment) {
    const item = equipmentLookup[itemId];
    for (const id of item?.grantsPassiveIds ?? []) add(id, item.name);
  }
  for (const [id, count] of Object.entries(teamPassiveGrants)) {
    for (let i = 0; i < count; i++) add(id, 'Relic');
  }
  return [...rows.values()];
}

/** Chart order, so two ledger lines list the same stats in the same places. */
function orderedGrants(mods: StatModifiers): [StatKey, number][] {
  return STAT_ORDER.flatMap((stat) => (mods[stat] ? [[stat, mods[stat]] as [StatKey, number]] : []));
}

/** One line of the "where the numbers came from" ledger. Renders nothing for a source granting nothing. */
function GrantSourceRow({ label, mods }: { label: string; mods: StatModifiers }) {
  const grants = orderedGrants(mods);
  if (grants.length === 0) return null;
  return (
    <div className="grant-source-row">
      <span className="grant-source-label">{label}</span>
      <span className="grant-source-chips">
        {grants.map(([stat, amount]) => (
          <span key={stat} className={`grant-source-chip ${amount > 0 ? 'stat-buff' : 'stat-debuff'}`}>
            <StatGlyph stat={stat} tone="inherit" /> {STAT_LABELS[stat]} {amount > 0 ? `+${amount}` : amount}
          </span>
        ))}
      </span>
    </div>
  );
}

/**
 * Out-of-combat stat/loadout sheet, in four pages: Stats, Moves, Gear, Passives (2026-09-07, per
 * user direction, replacing one long scroll of boxes). The split is what buys each page the room to
 * state things outright — moves as full-width cards carrying their own effect line, items and
 * passives spelled out rather than made into buttons that have to be tapped before they say
 * anything.
 *
 * Stats come from entryStats.ts — the same function buildCombatState.ts uses for a Combatant's
 * baseline — so this sheet cannot drift from the fight.
 */
export function HeroPreviewOverlay({ hero, entry, equipmentLookup, relicIds = [], unowned = false, action, onClose }: Props) {
  const heroClass = chosenClass(classes, entry);
  const teamStatModifiers = relicTeamStatModifiers(relicIds, relics);
  const teamPassiveGrants = relicTeamPassiveGrants(relicIds, relics);
  const passiveCounts = entryPassiveCounts(entry, equipmentLookup, teamPassiveGrants);
  const grants = entryStatModifiers(entry, equipmentLookup, passives, passiveCounts, teamStatModifiers);
  const evolved = chosenEvolutionPaths(progressionTable, entry);
  const types = rosterEntryTypes(hero, entry);
  // Not healCasterForEntry: that reads the global equipment table, and this sheet must honour `equipmentLookup`.
  const healCaster = { wisdom: hero.baseStats.wisdom + (grants.wisdom ?? 0), types };

  const heldItems = entry.equipment.flatMap((id) => (equipmentLookup[id] ? [equipmentLookup[id]] : []));
  const rows = passiveRows(entry, equipmentLookup, teamPassiveGrants);
  const capacity = itemSlotsFor(hero, entry);

  const [tab, setTab] = useState<TabId>('stats');
  const [popup, setPopup] = useState<{ kind: 'move' | 'equipment' | 'class'; id: string } | null>(null);

  const tabs: TabSpec<TabId>[] = [
    { id: 'stats', label: 'Stats', glyph: 'stats' },
    { id: 'moves', label: 'Moves', glyph: 'moves', count: entry.unlockedMoveIds.length },
    ...(unowned ? [] : [{ id: 'gear' as const, label: 'Gear', glyph: 'equipment' as const, count: heldItems.length }]),
    { id: 'passives', label: 'Passives', glyph: 'passives', count: rows.length },
  ];

  // swallowGhostClick: releasing a hold fires a synthetic click on whatever now covers the target,
  // which would reach an ancestor's onClick (possibly outside this component) and read as a dismiss.
  function openPopup(next: { kind: 'move' | 'equipment' | 'class'; id: string }) {
    swallowGhostClick();
    setPopup(next);
  }

  const classLongPress = useLongPress(heroClass ? () => openPopup({ kind: 'class', id: heroClass.id }) : undefined);

  // Stops propagation on the backdrop too, so a click here never also closes the screen that
  // rendered this overlay (e.g. Manage Roster's own backdrop).
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
      {/* A tabbed panel does NOT dismiss on an inner tap the way the one-scroll sheet did: this is a
          surface the player reads and switches pages in, and losing it to a stray tap while
          scrolling a move list is the wrong trade. The backdrop and the footer Close still close it. */}
      <div className="detail-panel is-tabbed" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header is-hero">
          <HeroPortrait heroId={hero.id} className="detail-portrait is-inline" />
          <div className="detail-header-titles">
            <div className="detail-name">
              {hero.name} — Lv {entry.level}
            </div>
            <div className="combatant-types">
              {types.map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
            {(evolved.length > 0 || heroClass) && (
              <div className="detail-evolution-row">
                {evolved.map((path) => (
                  <span key={path.id} className={`evolution-badge evolution-${path.kind}`}>
                    {path.name}
                  </span>
                ))}
                {heroClass && (
                  <span className="evolution-badge class-badge" {...classLongPress} title="Hold to view details">
                    🏛️ {heroClass.name}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="detail-tab-body" role="tabpanel">
          {tab === 'stats' && (
            <>
              {/* Matchups lead the page: which columns hurt this hero is the first thing asked of
                  a sheet, and behind eight stat bars it was below the fold. */}
              <TypeMatchups types={types} />
              <StatBars baseStats={hero.baseStats} deltas={grants} />
              <div className="grant-source-list">
                {/* Shown for an unowned hero too, unlike the old from-relics strip: the bars
                    already carry the team grant, and a ledger that claims to account for the
                    bars has to account for all of it. */}
                <GrantSourceRow label="Relics" mods={relicStatContribution(teamStatModifiers, teamPassiveGrants, passives)} />
                <GrantSourceRow label="Items" mods={equipmentStatModifiers(entry.equipment, equipmentLookup)} />
                <GrantSourceRow label="Evolution" mods={entry.evolutionStatGrants} />
                <GrantSourceRow label="Boons" mods={entry.bonusStatGrants} />
                <GrantSourceRow label="Mastery" mods={entry.masteryStatGrants} />
                {/* Hero-scoped passives only — relic-granted ones are already inside the Relics
                    line, and every grant has to appear exactly once for the ledger to add up. */}
                <GrantSourceRow label="Passives" mods={passiveStatModifiers(entryPassiveCounts(entry, equipmentLookup), passives)} />
              </div>
            </>
          )}

          {/* No hints, no empty-state prose, on this page or the two below (2026-09-07, per user
              direction): the strip already carries each page's count, and the cards say the rest. */}
          {tab === 'moves' && (
            <div className="tab-move-list">
              {entry.unlockedMoveIds.map((id) =>
                moves[id] ? (
                  <MoveButtonReplica key={id} move={moves[id]} caster={healCaster} onClick={() => openPopup({ kind: 'move', id })} />
                ) : (
                  <span key={id} className="detail-status-chip">
                    {id}
                  </span>
                )
              )}
            </div>
          )}

          {tab === 'gear' && (
            <>
              <EquipmentSlotGrid
                loadout={entry.equipment}
                capacity={capacity}
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
              {rows.map((row) => (
                <PassiveReadout key={row.passiveId} passive={passives[row.passiveId]} source={row.sources.join(' · ')} count={row.count} />
              ))}
            </div>
          )}
        </div>

        <TabStrip tabs={tabs} active={tab} onSelect={setTab} />
      </div>

      {/* Below the panel, at the very bottom of the screen. Where the sheet is asking a question
          rather than answering one, the confirm takes the gold slab and Close steps down to the
          secondary treatment — two accent slabs stacked would leave no "this is the press". */}
      <div className="sheet-footer" onClick={(e) => e.stopPropagation()}>
        {action?.note && <div className="detail-action-note">{action.note}</div>}
        {action && (
          <button className="resolve-button sheet-close-button" disabled={action.disabled} onClick={action.onConfirm}>
            {action.label}
          </button>
        )}
        <button className={action ? 'secondary-button' : 'resolve-button sheet-close-button'} onClick={onClose}>
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
              moves[popup.id] ? (
                <MoveDetailCard move={moves[popup.id]} caster={healCaster} />
              ) : null
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
