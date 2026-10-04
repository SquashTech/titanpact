import { useState, type CSSProperties } from 'react';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import { classes } from '../../data/classes';
import { passives } from '../../data/passives';
import { relics } from '../../data/relics';
import type { HeroDefinition, PassiveId, StatKey } from '../../engine/content';
import { STAT_ORDER } from '../../engine/content';
import { entryGradesFor, levelOf } from '../../run/growth';
import { MasteryPips } from '../shared/MasteryPips';
import { WoundBar, entryHp } from '../shared/WoundBar';
import type { RosterEntry } from '../../run/state';
import type { StatScale } from '../../run/statScale';
import type { EquipmentDefinition } from '../../run/equipment';
import { relicTeamStatModifiers } from '../../run/relics';
import { relicTeamPassiveGrants } from '../../run/passives';
import { entryPassiveCounts, entryStatModifiers } from '../../run/entryStats';
import { chosenEvolutionPaths, itemSlotsFor, rosterEntryTypes, formIdFor } from '../../run/progression';
import { chosenClass } from '../../run/classes';
import { innatePassiveIdsFor } from '../../run/innate';
import { StatBars } from '../shared/StatBars';
import { TabStrip, type TabSpec } from '../shared/TabStrip';
import { MoveButtonReplica, swallowGhostClick, useLongPress } from '../shared/MoveTile';
import { MoveDetailCard } from '../combat/MoveDetailOverlay';
import { EquipmentSlotGrid, ItemReadout } from '../shared/EquipmentBox';
import { ItemDetailCard } from '../shared/ItemDossier';
import { TypeBadge } from '../shared/TypeBadge';
import { TypeMatchups } from '../shared/TypeMatchups';
import { HeroPortrait } from '../shared/HeroPortrait';
import { getTypeColor } from '../combat/typeColors';
import { PassiveReadout } from '../shared/passiveIcons';
import { PassiveDetailCard } from '../shared/PassiveDossier';
import { HubGlyph } from '../shared/nodeIcons';
import { StatusGlyph } from '../shared/statusIcons';

interface Props {
  hero: HeroDefinition;
  entry: RosterEntry;
  equipmentLookup: Record<string, EquipmentDefinition>;
  /** The owning team's relics (RunState.relics). Omit for a hero not on this team — a scouted enemy, or the pre-run draft. */
  relicIds?: readonly string[];
  /** The run's purse, so a goldStatGrants innate (Gilded Mane) reads on the sheet as it lands in the fight. */
  gold?: number;
  /** The run's stat reference (run/statScale.ts) — the player's even for a scouted enemy, so both sides are read on one scale. Omit at the draft. */
  scale?: StatScale;
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

type TabId = 'stats' | 'moves' | 'gear';

/** One passive on this hero, with everything the sheet prints about it. */
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
  hero: HeroDefinition,
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

  const mastered = innatePassiveIdsFor(hero, entry) !== hero.passiveIds;
  for (const id of innatePassiveIdsFor(hero, entry) ?? []) add(id, mastered ? 'Innate · Mastered' : 'Innate');
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

/**
 * The Ley Line's Force: not a stat, so the bars cannot carry it and nothing else on the sheet says
 * it is there — the one survivor of the old where-the-numbers-came-from ledger.
 */
function ForceSourceRow({ label, grants }: { label: string; grants: RosterEntry['bonusStatusGrants'] }) {
  const held = Object.entries(grants).filter(([, amount]) => (amount ?? 0) > 0) as [string, number][];
  if (held.length === 0) return null;
  return (
    <div className="grant-source-row">
      <span className="grant-source-label">{label}</span>
      <span className="grant-source-chips">
        {held.map(([statusId, amount]) => (
          <span key={statusId} className="grant-source-chip stat-buff">
            <StatusGlyph statusId={statusId} className="grant-source-force" /> {statusId.slice(0, -'Force'.length)} Force +{amount}
          </span>
        ))}
      </span>
    </div>
  );
}

/**
 * Out-of-combat stat/loadout sheet, in three pages: Stats, Moves, Gear (2026-09-07, per user
 * direction, replacing one long scroll of boxes). The split is what buys each page the room to
 * state things outright — moves as full-width cards carrying their own effect line, items and
 * passives spelled out rather than made into buttons that have to be tapped before they say
 * anything. Passives sit on the Stats page, never behind a tab (2026-10-04, per user direction):
 * they are what makes a hero itself, and they took the room of a stat-source ledger that only
 * said what a run teaches anyway — the numbers come from levels and gear.
 *
 * Stats come from entryStats.ts — the same function buildCombatState.ts uses for a Combatant's
 * baseline — so this sheet cannot drift from the fight.
 */
export function HeroPreviewOverlay({ hero, entry, equipmentLookup, relicIds = [], gold = 0, scale, unowned = false, action, onClose }: Props) {
  const heroClass = chosenClass(classes, entry);
  const teamStatModifiers = relicTeamStatModifiers(relicIds, relics);
  const teamPassiveGrants = relicTeamPassiveGrants(relicIds, relics);
  const passiveCounts = entryPassiveCounts(entry, equipmentLookup, teamPassiveGrants, innatePassiveIdsFor(hero, entry));
  const grants = entryStatModifiers(entry, equipmentLookup, passives, passiveCounts, teamStatModifiers, gold);
  const evolved = chosenEvolutionPaths(progressionTable, entry);
  const types = rosterEntryTypes(hero, entry);
  // Not healCasterForEntry: that reads the global equipment table, and this sheet must honour `equipmentLookup`.
  const previewStats = Object.fromEntries(STAT_ORDER.map((stat) => [stat, hero.baseStats[stat] + (grants[stat] ?? 0)])) as Record<StatKey, number>;
  const healCaster = { wisdom: previewStats.wisdom, types, stats: previewStats };

  const heldItems = entry.equipment.flatMap((id) => (equipmentLookup[id] ? [equipmentLookup[id]] : []));
  const rows = passiveRows(hero, entry, equipmentLookup, teamPassiveGrants);
  const capacity = itemSlotsFor(hero, entry);

  const [tab, setTab] = useState<TabId>('stats');
  const [popup, setPopup] = useState<{ kind: 'move' | 'equipment' | 'class'; id: string } | null>(null);

  const tabs: TabSpec<TabId>[] = [
    { id: 'stats', label: 'Stats', glyph: 'stats' },
    { id: 'moves', label: 'Moves', glyph: 'moves', count: entry.unlockedMoveIds.length },
    ...(unowned ? [] : [{ id: 'gear' as const, label: 'Gear', glyph: 'equipment' as const, count: heldItems.length }]),
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
      {/* The sheet is cut in the hero's INNATE primary colour, not its current effective one: a
          graft changes what the hero fights like, never who it is (CLAUDE.md), and this is the
          screen that answers the second question. The badges below carry the effective pair. */}
      <div
        className="detail-panel is-tabbed is-hero-sheet"
        style={{ '--hero-color': getTypeColor(hero.types[0]) } as CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="detail-header is-hero">
          <span className="detail-portrait-plate">
            <HeroPortrait heroId={hero.id} pathId={formIdFor(entry)} className="detail-portrait is-inline" />
          </span>
          <div className="detail-header-titles">
            {/* The level is set apart rather than run into the name with an em dash: it is a figure
                ABOUT the hero, and "Squall — Lv 14" reads as one string where one half changes
                every fight. */}
            <div className="detail-name">
              {hero.name}
              <span className="detail-level">Lv {levelOf(entry)}</span>
            </div>
            <div className="combatant-types">
              {types.map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
            {/* The pips under the types: how far this hero is from turning, read without a screen. */}
            <MasteryPips mastery={entry.mastery} className="detail-mastery" />
            {/* Where the act has left this hero (run/wounds.ts) — on the sheet, since the sheet is where a wound is checked. */}
            {!unowned && <WoundBar {...entryHp(hero, entry, relicIds)} figure className="detail-hp" />}
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
              {/* Matchups lead the page: which columns hurt this hero is the first thing asked of
                  a sheet, and behind eight stat bars it was below the fold. */}
              <TypeMatchups types={types} />
              {/* Totals only, no "+N" against base: the room is the passives'. */}
              <StatBars baseStats={hero.baseStats} totals={previewStats} grades={entryGradesFor(hero, entry)} scale={scale} />
              <ForceSourceRow label="Ley Line" grants={entry.bonusStatusGrants} />
              {rows.length > 0 && (
                <>
                  <div className="tab-subhead">Passives</div>
                  <div className="tab-readout-list">
                    {rows.map((row) => (
                      <PassiveReadout key={row.passiveId} passive={passives[row.passiveId]} source={row.sources.join(' · ')} count={row.count} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* No hints, no empty-state prose, on this page or the one below (2026-09-07, per user
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
              equipmentLookup[popup.id] ? <ItemDetailCard item={equipmentLookup[popup.id]} /> : null
            ) : (
              // A Class is a verb: its move at this hero's type, or its passive.
              (() => {
                const cls = classes[popup.id];
                const classMove = cls?.grantsMoveId ? moves[cls.grantsMoveId] : null;
                return classMove ? (
                  <MoveDetailCard move={classMove} caster={healCaster} />
                ) : (
                  cls?.grantsPassiveId && passives[cls.grantsPassiveId] ? <PassiveDetailCard passive={passives[cls.grantsPassiveId]} /> : null
                );
              })()
            )}
            <div className="move-popup-hint">Tap anywhere to close</div>
          </div>
        </div>
      )}
    </div>
  );
}
