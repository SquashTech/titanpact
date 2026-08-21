import { useState, type DragEvent } from 'react';
import { heroes } from '../../data/heroes';
import { allCombatants } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import type { RunState, RosterEntry } from '../../run/state';
import type { Squad } from '../../run/squad';
import { pickSquad, requiredSquadSize } from '../../run/squad';
import { rosterEntryTypes } from '../../run/progression';
import type { Encounter } from '../../run/enemyGen';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterManagementScreen } from './RosterManagementScreen';
import { getTypeColor } from '../combat/typeColors';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';

interface Props {
  run: RunState;
  /** This node's already-generated encounter (src/run/enemyGen.ts) — generated at node-select time (App.tsx) specifically so the enemy squad can be scouted here, before the player commits a squad. */
  encounter: Encounter;
  onRunChange: (next: RunState) => void;
  onConfirm: (squad: Squad) => void;
}

/** Row-major 2-wide/3-tall squad grid: top row is who fields the fight, middle row cycles in off the bench, bottom row stays home. Always 6 cells (the roster hard cap) regardless of current roster size — unfilled cells beyond the roster just render empty. */
const SLOT_COUNT = 6;
const SLOT_ROWS: readonly { key: string; label: string; indices: readonly [number, number] }[] = [
  { key: 'active', label: 'Active', indices: [0, 1] },
  { key: 'bench', label: 'Bench', indices: [2, 3] },
  { key: 'reserve', label: 'Reserve', indices: [4, 5] },
];

const DRAG_KEY = 'text/titanpact-squad-slot';

/**
 * Bring-6-pick-4 squad selection (docs/combat.md "Bring-6-pick-4
 * sideboard"), shown before every fight/elite/boss map node (docs/run-loop.md)
 * — team-preview-style, matching CLAUDE.md's VGC framing rather than a
 * once-per-run pick. Guild Hall recruitment lives exclusively behind `shop`
 * map nodes now (ShopNodeScreen) — deliberately NOT embedded here, so it
 * stays a map choice rather than being freely available before every fight.
 * Recruit Contracts are claimed off a beaten enemy at fight's end
 * (FightScreen), not bought up front. Also shows the scouted enemy squad
 * (playtest ask: see who you might face before committing) with the same
 * info-button stat-preview pattern as the player's own roster.
 *
 * The player's own roster is arranged on a fixed 2x3 grid (one cell per
 * roster slot, up to the roster hard cap of 6) rather than a pick-order
 * list: row 1 is who starts the fight active, row 2 is bench, row 3 is
 * reserve (sits this fight out entirely). Heroes are repositioned by
 * dragging one cell onto another (swapping their contents) or, for touch,
 * tapping a filled cell then tapping the destination — same
 * select-then-target pattern as RosterManagementScreen's equipment grid.
 */
export function SquadSelectScreen({ run, encounter, onRunChange, onConfirm }: Props) {
  const [slots, setSlots] = useState<(string | null)[]>(() => {
    const ids = run.roster.map((r) => r.rosterId);
    return Array.from({ length: SLOT_COUNT }, (_, i) => ids[i] ?? null);
  });
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [inspecting, setInspecting] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const [showReference, setShowReference] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const required = requiredSquadSize(run.roster.length);

  const activeIds = [slots[0], slots[1]] as const;
  const benchIds = [slots[2], slots[3]].filter((id): id is string => id !== null);
  const pickedIds = activeIds.filter((id): id is string => id !== null).concat(benchIds);
  const canStart = activeIds[0] !== null && activeIds[1] !== null && pickedIds.length === required;

  function swapSlots(a: number, b: number) {
    if (a === b) return;
    setSlots((prev) => {
      const next = [...prev];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  }

  function handleSlotClick(index: number) {
    if (selectedSlot === null) {
      if (slots[index] === null) return;
      setSelectedSlot(index);
      return;
    }
    if (selectedSlot !== index) swapSlots(selectedSlot, index);
    setSelectedSlot(null);
  }

  function handleConfirm() {
    onConfirm(pickSquad(run.roster, pickedIds));
  }

  return (
    <div className="squad-select">
      <div className="map-header">
        <button className="log-toggle-button" onClick={() => setShowRoster(true)}>
          👥 Roster
        </button>
        <button className="log-toggle-button" onClick={() => setShowReference(true)}>
          Reference
        </button>
      </div>
      <div className="screen-scroll">
        {/* Enemies first, mirroring the combat screen's enemy-row-on-top layout —
            scout the threat before committing a squad against it. */}
        <div className="squad-section squad-section-enemy">
          <h2 className="squad-section-title">⚔️ Scouted Enemies</h2>
          <div className="enemy-scout-grid">
            {encounter.run.roster.map((entry) => {
              const hero = allCombatants[entry.heroId];
              const isBench = !encounter.squad.activeIds.includes(entry.rosterId);
              return (
                <button
                  key={entry.rosterId}
                  className={`enemy-scout-chip${isBench ? ' enemy-scout-chip-bench' : ''}`}
                  style={{ borderColor: getTypeColor(hero.types[0]) }}
                  onClick={() => setInspecting({ hero, entry })}
                  aria-label={`View ${hero.name} details`}
                >
                  <HeroPortrait heroId={hero.id} className="enemy-scout-portrait" />
                  <div className="enemy-scout-types">
                    {rosterEntryTypes(hero, entry).map((t) => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="squad-vs-divider">VS</div>

        <div className="squad-section squad-section-player">
          <h2 className="squad-section-title">🛡️ Arrange Your Squad ({pickedIds.length}/{required})</h2>
          <div className="squad-grid">
            {SLOT_ROWS.map((row) => (
              <div key={row.key} className={`squad-grid-row squad-grid-row-${row.key}`}>
                <div className="squad-grid-row-label">{row.label}</div>
                <div className="squad-grid-row-cells">
                  {row.indices.map((index) => {
                    const rosterId = slots[index];
                    const entry = rosterId ? run.roster.find((r) => r.rosterId === rosterId) : undefined;
                    const hero = entry ? heroes[entry.heroId] : undefined;
                    const isSelected = selectedSlot === index;
                    const isDropTarget = selectedSlot !== null && selectedSlot !== index;
                    const isDragOver = dragOverSlot === index;
                    return (
                      <div
                        key={index}
                        className={`squad-slot${hero ? ' filled' : ' empty'}${isSelected ? ' selected' : ''}${
                          isDropTarget ? ' drop-target' : ''
                        }${isDragOver ? ' drag-over' : ''}`}
                        style={hero ? { borderLeftColor: getTypeColor(hero.types[0]) } : undefined}
                        role="button"
                        tabIndex={0}
                        draggable={!!hero}
                        onClick={() => handleSlotClick(index)}
                        onDragStart={(e: DragEvent) => {
                          if (!hero) return;
                          e.dataTransfer.setData(DRAG_KEY, String(index));
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(e: DragEvent) => {
                          if (e.dataTransfer.types.includes(DRAG_KEY)) {
                            e.preventDefault();
                            setDragOverSlot(index);
                          }
                        }}
                        onDragLeave={() => setDragOverSlot((s) => (s === index ? null : s))}
                        onDrop={(e: DragEvent) => {
                          e.preventDefault();
                          setDragOverSlot(null);
                          const raw = e.dataTransfer.getData(DRAG_KEY);
                          if (!raw) return;
                          swapSlots(Number(raw), index);
                          setSelectedSlot(null);
                        }}
                      >
                        {hero && entry ? (
                          <>
                            <button
                              className="info-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspecting({ hero, entry });
                              }}
                              aria-label={`View ${hero.name} details`}
                            >
                              i
                            </button>
                            <HeroPortrait heroId={hero.id} className="roster-card-portrait" />
                            <div className="roster-card-name">
                              {hero.name} <span className="hint">Lv {entry.level}</span>
                            </div>
                            <div className="roster-card-types">
                              {rosterEntryTypes(hero, entry).map((t) => (
                                <TypeBadge key={t} type={t} />
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="squad-slot-empty-label">Empty</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <button className="resolve-button" disabled={!canStart} onClick={handleConfirm}>
        Start Fight
      </button>

      {inspecting && (
        <HeroPreviewOverlay
          hero={inspecting.hero}
          entry={inspecting.entry}
          equipmentLookup={equipment}
          onClose={() => setInspecting(null)}
        />
      )}
      {showReference && <ReferenceOverlay onClose={() => setShowReference(false)} />}
      {showRoster && <RosterManagementScreen run={run} onRunChange={onRunChange} onClose={() => setShowRoster(false)} />}
    </div>
  );
}
