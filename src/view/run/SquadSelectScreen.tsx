import { useState, type CSSProperties, type DragEvent, type ReactNode } from 'react';
import { heroes } from '../../data/heroes';
import { allCombatants } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import type { RunState, RosterEntry } from '../../run/state';
import { reorderRoster } from '../../run/state';
import type { Squad } from '../../run/squad';
import { pickSquad, requiredSquadSize, STANDARD_SQUAD_SIZE } from '../../run/squad';
import { rosterEntryTypes } from '../../run/progression';
import type { Encounter } from '../../run/enemyGen';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterManagementScreen } from './RosterManagementScreen';
import { getTypeColor } from '../combat/typeColors';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { hasDramaticEntrance } from '../shared/entrances';
import { useLongPress } from '../shared/MoveTile';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';
import { NodeSky, NODE_TINT_GOLD } from '../shared/NodeStage';
import { HubGlyph } from '../shared/nodeIcons';
import { useAmbientLocation } from '../shared/LocationContext';

interface Props {
  run: RunState;
  /** Generated at node-select time (App.tsx) so the enemy squad can be scouted before the player commits. */
  encounter: Encounter;
  onRunChange: (next: RunState) => void;
  onConfirm: (squad: Squad) => void;
  /** 4 everywhere but the finale, which fields the whole roster (docs/run-loop.md 4). */
  squadSize?: number;
  /**
   * The scripted first run (docs/tutorial.md): roster ids pinned to an ACTIVE slot. They seed
   * slots 0-1 and no swap can move them out of the active row — owning the hero that teaches a
   * lesson is not the same as flying them. Empty everywhere else.
   */
  lockedActiveRosterIds?: readonly string[];
}

/**
 * 2-wide/3-tall grid: active, bench, reserve. Always 6 cells (the roster cap); cells past the
 * roster render empty. Each row is a BAND with its own header (2026-09-11, per user direction):
 * the label says what the row is and the note says what it means for the fight, because a
 * left-hand column of three small words did not separate "opens the fight" from "sits it out".
 */
const SLOT_COUNT = 6;
function slotRows(squadSize: number): readonly { key: string; label: string; note: string; indices: readonly [number, number] }[] {
  return [
    { key: 'active', label: 'Active', note: 'Open the fight', indices: [0, 1] },
    { key: 'bench', label: 'Bench', note: 'Switch in', indices: [2, 3] },
    // The finale fields six, so the third row stops being a sideboard and becomes bench.
    squadSize > 4
      ? { key: 'bench', label: 'Bench', note: 'Switch in', indices: [4, 5] }
      : { key: 'reserve', label: 'Reserve', note: 'Sit this one out', indices: [4, 5] },
  ];
}

const DRAG_KEY = 'text/titanpact-squad-slot';

function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface SquadSlotProps {
  hero?: HeroDefinition;
  entry?: RosterEntry;
  selected: boolean;
  dropTarget: boolean;
  dragOver: boolean;
  locked: boolean;
  /** Tap: begin or complete a swap. */
  onActivate: () => void;
  /** Hold: open the hero's sheet. Absent on an empty cell, which has nothing to review. */
  onInspect?: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;
}

/**
 * One cell of the bring-6-pick-4 grid.
 *
 * Extracted from the grid's `.map()` for one reason: it holds a `useLongPress`, and a hook cannot
 * live inside a loop body. Holding is what this screen was missing — every other card in the game
 * opens its sheet that way, and this one alone had a small circled `i` doing it instead, which is
 * why that `i` survived the twenty-seventh pass: it was not a redundant second route to the sheet
 * here, it was the only one.
 *
 * The hold has to share the cell with a tap AND an HTML5 drag, and does: the hook cancels its timer
 * once the pointer travels 12px, which any drag does long before `dragstart`, and it swallows the
 * click that a completed hold would otherwise deliver to the swap handler.
 */
function SquadSlot({
  hero,
  entry,
  selected,
  dropTarget,
  dragOver,
  locked,
  onActivate,
  onInspect,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: SquadSlotProps & { children: ReactNode }) {
  const press = useLongPress(onInspect, onActivate);
  return (
    <div
      className={`squad-slot${hero ? ' filled' : ' empty'}${selected ? ' selected' : ''}${dropTarget ? ' drop-target' : ''}${
        dragOver ? ' drag-over' : ''
      }${locked ? ' is-pinned' : ''}`}
      style={hero ? ({ '--plate-color': getTypeColor(hero.types[0]) } as CSSProperties) : undefined}
      role="button"
      tabIndex={0}
      draggable={!!hero}
      aria-label={hero && entry ? `${hero.name}, level ${entry.level} — tap to move, hold to review` : 'Empty slot'}
      // The cell had `role="button"` and a tab stop and answered neither key. Enter and Space now
      // do what a tap does; the sheet is keyboard-reachable through the roster button in the corner.
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate();
        }
      }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      {...press}
    >
      {children}
    </div>
  );
}

/** Bring-6-pick-4 squad selection before every fight node (docs/combat.md "Bring-6-pick-4 sideboard"). Drag, or tap-then-tap, swaps two cells. */
export function SquadSelectScreen({
  run,
  encounter,
  onRunChange,
  onConfirm,
  squadSize = STANDARD_SQUAD_SIZE,
  lockedActiveRosterIds = [],
}: Props) {
  const locked = new Set(lockedActiveRosterIds.filter((id) => run.roster.some((r) => r.rosterId === id)));
  const [slots, setSlots] = useState<(string | null)[]>(() => {
    // Locked heroes first, so they land in the two active slots before anyone else is placed.
    const ids = run.roster.map((r) => r.rosterId).sort((a, b) => Number(locked.has(b)) - Number(locked.has(a)));
    return Array.from({ length: SLOT_COUNT }, (_, i) => ids[i] ?? null);
  });
  // Scrambled once into state: `encounter.run.roster` is generated active-first, and a fixed
  // order (or a per-drag reshuffle) would tell the player which enemies open the fight.
  const [scoutOrder] = useState(() => shuffled(encounter.run.roster));
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  /** `enemy`: a scouted-opponent sheet gets no relic grants folded in. */
  const [inspecting, setInspecting] = useState<{ hero: HeroDefinition; entry: RosterEntry; enemy: boolean } | null>(null);
  const [showReference, setShowReference] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const required = requiredSquadSize(run.roster.length, squadSize);
  const location = useAmbientLocation();
  const rosterById = new Map(run.roster.map((r) => [r.rosterId, r]));

  const activeIds = [slots[0], slots[1]] as const;
  const benchIds = slots.slice(2, squadSize).filter((id): id is string => id !== null);
  const pickedIds = activeIds.filter((id): id is string => id !== null).concat(benchIds);
  const lockedHeld = [...locked].every((id) => slots[0] === id || slots[1] === id);
  const canStart = activeIds[0] !== null && activeIds[1] !== null && pickedIds.length === required && lockedHeld;

  function isLockedSlot(index: number): boolean {
    const id = slots[index];
    return id !== null && locked.has(id);
  }

  /** A pinned hero may be reordered WITHIN the active row — lead order is still the player's — but never out of it. */
  function canSwap(a: number, b: number): boolean {
    if (a === b) return false;
    const wouldEvict = (from: number, to: number) => isLockedSlot(from) && to > 1;
    return !wouldEvict(a, b) && !wouldEvict(b, a);
  }

  function swapSlots(a: number, b: number) {
    if (!canSwap(a, b)) return;
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

  // Writes the arrangement back to the roster so it seeds the next fight's grid (and pickSquad
  // on sub-4 rosters). Nulls are dropped so the grid repacks from index 0 next time.
  function handleConfirm() {
    const squad = pickSquad(run.roster, pickedIds, squadSize);
    onRunChange(reorderRoster(run, slots.filter((id): id is string => id !== null)));
    onConfirm(squad);
  }

  return (
    // `--node-rgb` is the Location's tint here (docs/locations.md §5.5), not a node's.
    <div className="squad-select" style={{ '--node-rgb': location?.tintRgb ?? NODE_TINT_GOLD } as CSSProperties}>
      <NodeSky />

      <div className="screen-scroll">
        <div className="squad-stage">
          {/* Who is coming: a chapter mark in the enemy's red, then the four (or however many)
              scouted, in an order that says nothing about who opens. */}
          <section className="squad-section squad-section-enemy">
            <h2 className="squad-section-title">Scouted enemies</h2>
            <div className="enemy-scout-grid">
              {scoutOrder.map((entry) => {
                const hero = allCombatants[entry.heroId];
                const types = rosterEntryTypes(hero, entry);
                // Hidden-card enemy (shared/entrances.ts): silhouette and typing only, and
                // deliberately not a button — there is no sheet behind it.
                if (hasDramaticEntrance(hero.id)) {
                  return (
                    <div
                      key={entry.rosterId}
                      className="enemy-scout-chip enemy-scout-chip-concealed"
                      style={{ '--plate-color': getTypeColor(types[0]) } as CSSProperties}
                      aria-label={`An unidentified ${types.join('/')} enemy`}
                    >
                      <HeroPortrait heroId={hero.id} className="enemy-scout-portrait" />
                      <div className="enemy-scout-types">
                        {types.map((t) => (
                          <TypeBadge key={t} type={t} />
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <button
                    key={entry.rosterId}
                    className="enemy-scout-chip"
                    style={{ '--plate-color': getTypeColor(hero.types[0]) } as CSSProperties}
                    onClick={() => setInspecting({ hero, entry, enemy: true })}
                    aria-label={`View ${hero.name} details`}
                  >
                    <HeroPortrait heroId={hero.id} className="enemy-scout-portrait" />
                    <span className="enemy-scout-name">{hero.name}</span>
                    <div className="enemy-scout-types">
                      {types.map((t) => (
                        <TypeBadge key={t} type={t} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Struck between two hairlines, like the fight's own opening beat. */}
          <div className="squad-vs-divider" aria-hidden="true">
            <span>VS</span>
          </div>

          <section className="squad-section squad-section-player">
            <h2 className="squad-section-title">
              Your squad
              <span className="squad-section-count" aria-label={`${pickedIds.length} of ${required} fielded`}>
                {pickedIds.length}/{required}
              </span>
            </h2>
            <div className="squad-grid">
              {slotRows(squadSize).map((row, rowIndex) => (
                <div key={rowIndex} className={`squad-band squad-band-${row.key}`}>
                  <div className="squad-band-head">
                    <span className="squad-band-label">{row.label}</span>
                    <span className="squad-band-note">{row.note}</span>
                  </div>
                  <div className="squad-grid-row-cells">
                    {row.indices.map((index) => {
                      const rosterId = slots[index];
                      const entry = rosterId ? rosterById.get(rosterId) : undefined;
                      const hero = entry ? heroes[entry.heroId] : undefined;
                      const isSelected = selectedSlot === index;
                      const isDropTarget = selectedSlot !== null && canSwap(selectedSlot, index);
                      const isDragOver = dragOverSlot === index;
                      const isLocked = isLockedSlot(index);
                      return (
                        <SquadSlot
                          key={index}
                          hero={hero}
                          entry={entry}
                          selected={isSelected}
                          dropTarget={isDropTarget}
                          dragOver={isDragOver}
                          locked={isLocked}
                          onActivate={() => handleSlotClick(index)}
                          onInspect={hero && entry ? () => setInspecting({ hero, entry, enemy: false }) : undefined}
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
                              {isLocked && (
                                <span className="squad-slot-pin" aria-label={`${hero.name} must start this fight`} title="Locked into the fight">
                                  <HubGlyph name="lock" />
                                </span>
                              )}
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
                        </SquadSlot>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* The two tools flank the one CTA (2026-09-11, per user direction): they were 44px tiles in
          the top-right corner, the far end of a thumb's reach on a phone. Roster on the left — it
          opens Manage Roster, since moving gear before a fight is the point — reference on the
          right, and Start Fight between them where the thumb already rests. */}
      <div className="squad-footer">
        <button type="button" className="squad-tool-button" onClick={() => setShowRoster(true)} aria-label="Manage your roster" title="Manage your roster">
          <HubGlyph name="roster" />
        </button>
        <button className="resolve-button" disabled={!canStart} onClick={handleConfirm}>
          Start Fight
        </button>
        <button
          type="button"
          className="squad-tool-button"
          onClick={() => setShowReference(true)}
          aria-label="Type chart and reference"
          title="Type chart and reference"
        >
          <HubGlyph name="codex" />
        </button>
      </div>

      {inspecting && (
        <HeroPreviewOverlay
          hero={inspecting.hero}
          entry={inspecting.entry}
          equipmentLookup={equipment}
          relicIds={inspecting.enemy ? [] : run.relics}
          onClose={() => setInspecting(null)}
        />
      )}
      {showReference && <ReferenceOverlay onClose={() => setShowReference(false)} />}
      {showRoster && <RosterManagementScreen run={run} onRunChange={onRunChange} onClose={() => setShowRoster(false)} />}
    </div>
  );
}
