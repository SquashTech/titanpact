import { useState, type CSSProperties, type DragEvent } from 'react';
import { heroes } from '../../data/heroes';
import { allCombatants } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import type { RunState, RosterEntry } from '../../run/state';
import { reorderRoster } from '../../run/state';
import type { Squad } from '../../run/squad';
import { pickSquad, requiredSquadSize } from '../../run/squad';
import { rosterEntryTypes } from '../../run/progression';
import type { Encounter } from '../../run/enemyGen';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterManagementScreen } from './RosterManagementScreen';
import { getTypeColor } from '../combat/typeColors';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { hasDramaticEntrance } from '../shared/entrances';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';
import { NodeSky, NODE_TINT_GOLD } from '../shared/NodeStage';
import { useAmbientLocation } from '../shared/LocationContext';

interface Props {
  run: RunState;
  /** Generated at node-select time (App.tsx) so the enemy squad can be scouted before the player commits. */
  encounter: Encounter;
  onRunChange: (next: RunState) => void;
  onConfirm: (squad: Squad) => void;
}

/** 2-wide/3-tall grid: active, bench, reserve. Always 6 cells (the roster cap); cells past the roster render empty. */
const SLOT_COUNT = 6;
const SLOT_ROWS: readonly { key: string; label: string; indices: readonly [number, number] }[] = [
  { key: 'active', label: 'Active', indices: [0, 1] },
  { key: 'bench', label: 'Bench', indices: [2, 3] },
  { key: 'reserve', label: 'Reserve', indices: [4, 5] },
];

const DRAG_KEY = 'text/titanpact-squad-slot';

function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Bring-6-pick-4 squad selection before every fight node (docs/combat.md "Bring-6-pick-4 sideboard"). Drag, or tap-then-tap, swaps two cells. */
export function SquadSelectScreen({ run, encounter, onRunChange, onConfirm }: Props) {
  const [slots, setSlots] = useState<(string | null)[]>(() => {
    const ids = run.roster.map((r) => r.rosterId);
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
  const required = requiredSquadSize(run.roster.length);
  const location = useAmbientLocation();
  const rosterById = new Map(run.roster.map((r) => [r.rosterId, r]));

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

  // Writes the arrangement back to the roster so it seeds the next fight's grid (and pickSquad
  // on sub-4 rosters). Nulls are dropped so the grid repacks from index 0 next time.
  function handleConfirm() {
    const squad = pickSquad(run.roster, pickedIds);
    onRunChange(reorderRoster(run, slots.filter((id): id is string => id !== null)));
    onConfirm(squad);
  }

  return (
    // `--node-rgb` is the Location's tint here (docs/locations.md §5.5), not a node's.
    <div className="squad-select" style={{ '--node-rgb': location?.tintRgb ?? NODE_TINT_GOLD } as CSSProperties}>
      <NodeSky />

      {/* Opens Manage Roster, not the read-only peek: moving gear before a fight is the point here. */}
      <button
        type="button"
        className="corner-glyph-button"
        onClick={() => setShowRoster(true)}
        aria-label="Manage your roster"
        title="Manage your roster"
      >
        <span aria-hidden="true">👥</span>
      </button>
      <button
        type="button"
        className="corner-glyph-button corner-slot-2"
        onClick={() => setShowReference(true)}
        aria-label="Type chart and reference"
        title="Type chart and reference"
      >
        <span aria-hidden="true">📖</span>
      </button>
      <div className="screen-scroll">
        <div className="squad-section squad-section-enemy">
          <h2 className="squad-section-title">⚔️ Scouted Enemies</h2>
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
                    style={{ borderColor: getTypeColor(types[0]) }}
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
                  style={{ borderColor: getTypeColor(hero.types[0]) }}
                  onClick={() => setInspecting({ hero, entry, enemy: true })}
                  aria-label={`View ${hero.name} details`}
                >
                  <HeroPortrait heroId={hero.id} className="enemy-scout-portrait" />
                  <div className="enemy-scout-types">
                    {types.map((t) => (
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
                    const entry = rosterId ? rosterById.get(rosterId) : undefined;
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
                                setInspecting({ hero, entry, enemy: false });
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
          relicIds={inspecting.enemy ? [] : run.relics}
          onClose={() => setInspecting(null)}
        />
      )}
      {showReference && <ReferenceOverlay onClose={() => setShowReference(false)} />}
      {showRoster && <RosterManagementScreen run={run} onRunChange={onRunChange} onClose={() => setShowRoster(false)} />}
    </div>
  );
}
