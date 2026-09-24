import { useState, type CSSProperties, type DragEvent, type ReactNode } from 'react';
import { rosterHeroes } from '../../data/content';
import { allCombatants } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { HeroDefinition, TypeId } from '../../engine/content';
import type { RunState, RosterEntry } from '../../run/state';
import { reorderRoster } from '../../run/state';
import type { Squad } from '../../run/squad';
import { pickSquad } from '../../run/squad';
import { rosterEntryTypes } from '../../run/progression';
import type { Encounter } from '../../run/enemyGen';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterManagementScreen } from './RosterManagementScreen';
import { getTypeColor } from '../combat/typeColors';
import { TypeBadge } from '../shared/TypeBadge';
import { PassiveGlyph, passiveColor, passiveTint } from '../shared/passiveIcons';
import { currentInnateOf, titansMarkOf } from '../../run/innate';
import { HeroPortrait } from '../shared/HeroPortrait';
import { hasDramaticEntrance } from '../shared/entrances';
import { useProfile } from '../shared/ProfileContext';
import { useLongPress } from '../shared/MoveTile';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';
import { NodeSky, NODE_TINT_GOLD } from '../shared/NodeStage';
import { HubGlyph } from '../shared/nodeIcons';
import { useAmbientLocation } from '../shared/LocationContext';
import { matchupVerdict } from '../shared/matchupVerdict';
import { ResourceGlyph } from '../shared/RunGlyph';
import { reviveHero, standingRoster } from '../../run/wounds';
import { canUseRevive, spendRevive } from '../../run/consumables';
import { levelOf } from '../../run/growth';
import { statScaleFor } from '../../run/statScale';
import { WoundBar, entryHp } from '../shared/WoundBar';

interface Props {
  run: RunState;
  /** Generated at node-select time (App.tsx) so the enemy squad can be scouted before the player commits. */
  encounter: Encounter;
  onRunChange: (next: RunState) => void;
  onConfirm: (squad: Squad) => void;
}

/**
 * 2-wide grid in two BANDS, active over bench — always 6 cells (the roster cap), cells past the
 * roster render empty. Each band has its own header (2026-09-11, per user direction), because a
 * left-hand column of small words did not separate the rows. The third band, Reserve, went with
 * bring-6-pick-4 (2026-09-17): every fight fields the whole roster, so this is a lead-order screen.
 */
const SLOT_COUNT = 6;
const SLOT_ROWS: readonly { key: string; label: string; indices: readonly number[] }[] = [
  { key: 'active', label: 'Active', indices: [0, 1] },
  { key: 'bench', label: 'Bench', indices: [2, 3, 4, 5] },
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

interface SquadSlotProps {
  hero?: HeroDefinition;
  entry?: RosterEntry;
  selected: boolean;
  dropTarget: boolean;
  dragOver: boolean;
  /** A fight left this hero down (run/wounds.ts): not fielded, not picked up, not swapped. */
  down: boolean;
  /** Another hero is held and may land here: the cell wears its move-here key. */
  swapTarget: boolean;
  /** A Revive is held and this hero is down: the cell wears the key that spends it. */
  onRevive?: () => void;
  /** Tap: pick this hero up (or put it down); on an empty cell, land the held hero here. */
  onActivate: () => void;
  /** The move-here key: swap the held hero into this cell. */
  onSwapHere: () => void;
  /** Hold: open the hero's sheet. Absent on an empty cell, which has nothing to review. */
  onInspect?: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;
}

/**
 * One cell of the squad grid.
 *
 * Extracted from the grid's `.map()` for one reason: it holds a `useLongPress`, and a hook cannot
 * live inside a loop body. Holding is what this screen was missing — every other card in the game
 * opens its sheet that way, and this one alone had a small circled `i` doing it instead, which is
 * why that `i` survived the twenty-seventh pass: it was not a redundant second route to the sheet
 * here, it was the only one.
 *
 * The hold has to share the cell with a tap AND an HTML5 drag, and does: the hook cancels its timer
 * once the pointer travels 12px, which any drag does long before `dragstart`, and it swallows the
 * click that a completed hold would otherwise deliver to the tap handler.
 *
 * A tap SELECTS (2026-09-14, per user direction); it never swaps. Tap-then-tap used to trade the two
 * cells, so reading a second hero's matchups moved the first one — the swap is its own key now,
 * drawn on every cell the held hero can land in, and the key alone commits a move. The key stops
 * its pointer events at itself so the cell's own tap under it does not fire and re-select.
 */
function SquadSlot({
  hero,
  entry,
  selected,
  dropTarget,
  dragOver,
  down,
  swapTarget,
  onRevive,
  onActivate,
  onSwapHere,
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
      }${down ? ' is-down' : ''}`}
      style={hero ? ({ '--plate-color': getTypeColor(hero.types[0]) } as CSSProperties) : undefined}
      role="button"
      tabIndex={0}
      draggable={!!hero && !down}
      aria-label={
        hero && entry ? `${hero.name}, level ${levelOf(entry)} — ${down ? 'down, hold to review' : 'tap to pick up, hold to review'}` : 'Empty slot'
      }
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
      {swapTarget && (
        <button
          type="button"
          className="squad-slot-swap"
          aria-label={hero ? `Swap with ${hero.name}` : 'Move here'}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onSwapHere();
          }}
        >
          <HubGlyph name="swap" />
        </button>
      )}
      {onRevive && (
        <button
          type="button"
          className="squad-slot-swap squad-slot-revive"
          aria-label={`Revive ${hero?.name ?? ''}`}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRevive();
          }}
        >
          <ResourceGlyph kind="revive" tone="inherit" />
        </button>
      )}
    </div>
  );
}

/**
 * What the scouted enemy was born with (docs/innate-passives.md §6): its innate's glyph and name,
 * or the Titan's Mark on a spawn. The name is the read — a Skirmish against spawn is a fight
 * against a clock — and the tap on the chip opens the sheet that says the rest.
 */
function ScoutedPassive({ hero, entry }: { hero: HeroDefinition; entry: RosterEntry }) {
  const innate = currentInnateOf(hero, entry);
  const mark = innate ? null : titansMarkOf(hero);
  const passive = innate ?? mark;
  if (!passive) return null;
  return (
    <span
      className={`enemy-scout-innate${mark ? ' is-mark' : ''}`}
      style={{ '--passive-color': passiveColor(passive.id), '--passive-tint': passiveTint(passive.id, 0.16) } as CSSProperties}
      title={`${passive.name} — ${passive.description}`}
    >
      <PassiveGlyph passiveId={passive.id} />
      <span className="enemy-scout-innate-name">{mark ? 'Mark' : passive.name}</span>
    </span>
  );
}

/**
 * One hero against one scouted enemy: up for a matchup the hero comes out ahead in, down for one it
 * comes out behind in, and an empty slot otherwise — the slot is always drawn so nothing changes
 * height when a verdict comes or goes. Under an enemy chip while a hero is held, and in every hero
 * cell's row (`small`).
 */
function MatchupArrow({ verdict, small = false }: { verdict: 'up' | 'down' | null; small?: boolean }) {
  return (
    <span
      className={`enemy-scout-verdict${verdict ? ` is-${verdict}` : ''}${small ? ' enemy-scout-verdict-small' : ''}`}
      aria-label={verdict === 'up' ? 'Good matchup' : verdict === 'down' ? 'Bad matchup' : undefined}
    >
      {verdict && (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
          {verdict === 'up' ? <path d="M12 4 21 14h-6v6H9v-6H3Z" /> : <path d="M12 20 3 10h6V4h6v6h6Z" />}
        </svg>
      )}
    </span>
  );
}

/**
 * Every scouted enemy's verdict against one hero, in the chips' order, so the whole grid is read at
 * a glance (2026-09-17, per user direction). It used to take a tap per hero: the arrows landed under
 * the enemies only while that hero was held, and reading six heroes was six taps and a memory.
 */
function MatchupRow({ heroTypes, enemies }: { heroTypes: readonly TypeId[]; enemies: readonly RosterEntry[] }) {
  const verdicts = enemies.map((enemy) => matchupVerdict(heroTypes, rosterEntryTypes(allCombatants[enemy.heroId], enemy)));
  const up = verdicts.filter((v) => v === 'up').length;
  const down = verdicts.filter((v) => v === 'down').length;
  return (
    <div
      className={`squad-slot-matchups${enemies.length > 4 ? ' squad-slot-matchups-dense' : ''}`}
      aria-label={`${up} good ${up === 1 ? 'matchup' : 'matchups'}, ${down} bad`}
    >
      {verdicts.map((verdict, i) => (
        <MatchupArrow key={enemies[i].rosterId} verdict={verdict} small />
      ))}
    </div>
  );
}

/** Lead order before every fight node — the whole roster fields (docs/combat.md "The fielded roster"). Drag, or tap then the move-here key, swaps two cells; a tap alone picks a hero up. */
export function SquadSelectScreen({ run, encounter, onRunChange, onConfirm }: Props) {
  const [slots, setSlots] = useState<(string | null)[]>(() => {
    // The downed last, so the ones who can fight hold the field.
    const rank = (id: string) => (run.roster.find((r) => r.rosterId === id)!.down ? 1 : 0);
    const ids = run.roster.map((r) => r.rosterId).sort((a, b) => rank(a) - rank(b));
    return Array.from({ length: SLOT_COUNT }, (_, i) => ids[i] ?? null);
  });
  // Scrambled once into state: `encounter.run.roster` is generated active-first, and a fixed
  // order (or a per-drag reshuffle) would tell the player which enemies open the fight. A later
  // PHASE (Squad.reserves — the Titan's Eyes behind the Herald, docs/titan-eyes.md §10) is not
  // scouted until the profile has cleared a run: the first time through, what walks on when the
  // Herald falls is the surprise (per user direction).
  const profile = useProfile();
  const [scoutOrder] = useState(() => {
    const reserved = new Set((encounter.squad.reserves ?? []).flat());
    const seen = profile.runsCompleted > 0;
    return shuffled(encounter.run.roster.filter((entry) => seen || !reserved.has(entry.rosterId)));
  });
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  /** `enemy`: a scouted-opponent sheet gets no relic grants folded in. */
  const [inspecting, setInspecting] = useState<{ hero: HeroDefinition; entry: RosterEntry; enemy: boolean } | null>(null);
  const [showReference, setShowReference] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const location = useAmbientLocation();
  const rosterById = new Map(run.roster.map((r) => [r.rosterId, r]));

  // The hero the player has picked up: its arrows land under the scouted enemies while it is held,
  // echoing the row its own cell already wears (MatchupRow) against the faces across the field.
  // Post-Evolution types, since that is the typing that fights.
  const heldEntry = selectedSlot !== null && slots[selectedSlot] ? rosterById.get(slots[selectedSlot]!) : undefined;
  const heldTypes = heldEntry ? rosterEntryTypes(rosterHeroes[heldEntry.heroId], heldEntry) : null;

  function isDownSlot(index: number): boolean {
    const id = slots[index];
    return id !== null && (rosterById.get(id)?.down ?? false);
  }

  // The fielded are the STANDING (run/wounds.ts): a downed hero keeps its cell and is not picked.
  const standingCount = standingRoster(run.roster).length;
  const standingAt = (index: number) => (slots[index] !== null && !isDownSlot(index) ? slots[index] : null);
  const activeIds = [standingAt(0), standingAt(1)] as const;
  const benchIds = slots.slice(2).filter((id): id is string => id !== null && !rosterById.get(id)!.down);
  const pickedIds = activeIds.filter((id): id is string => id !== null).concat(benchIds);
  // Two leads, or the one hero left standing on its own.
  const canStart = activeIds[0] !== null && (activeIds[1] !== null || standingCount < 2);

  /** A downed hero does not move. */
  function canSwap(a: number, b: number): boolean {
    if (a === b) return false;
    return !isDownSlot(a) && !isDownSlot(b);
  }

  /** One Revive off the purse, one hero up at half (run/wounds.ts reviveHero). It stands up in the cell it held. */
  function handleRevive(rosterId: string) {
    const entry = rosterById.get(rosterId);
    if (!entry || !entry.down || !canUseRevive(run)) return;
    const { maxHp } = entryHp(rosterHeroes[entry.heroId], entry, run.relics);
    onRunChange(spendRevive(reviveHero(run, rosterId, maxHp)));
  }

  function swapSlots(a: number, b: number) {
    if (!canSwap(a, b)) return;
    setSlots((prev) => {
      const next = [...prev];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  }

  // A tap picks a hero up or puts it down; tapping a second hero picks THAT one up. Only an empty
  // cell lands the held hero on a tap, since it has nothing of its own to pick up.
  function handleSlotClick(index: number) {
    if (slots[index] === null) {
      if (selectedSlot !== null) handleSwapHere(index);
      return;
    }
    if (isDownSlot(index)) return;
    setSelectedSlot(selectedSlot === index ? null : index);
  }

  function handleSwapHere(index: number) {
    if (selectedSlot === null) return;
    swapSlots(selectedSlot, index);
    setSelectedSlot(null);
  }

  // Writes the arrangement back to the roster so it seeds the next fight's grid. Nulls are dropped so
  // the grid repacks from index 0 next time.
  function handleConfirm() {
    const squad = pickSquad(run.roster, pickedIds);
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
            {/* Six scouted (the finale) go three abreast in a row chip, so the band stays the height
                four take and the screen keeps its one-page shape. */}
            <div className={`enemy-scout-grid${scoutOrder.length > 4 ? ' enemy-scout-grid-dense' : ''}`}>
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
                      aria-label={`An unidentified ${types.join('/')} enemy, level ${levelOf(entry)}`}
                    >
                      <HeroPortrait heroId={hero.id} className="enemy-scout-portrait" />
                      <span className="pick-level enemy-scout-level" aria-hidden="true">
                        {levelOf(entry)}
                      </span>
                      <div className="enemy-scout-types">
                        {types.map((t) => (
                          <TypeBadge key={t} type={t} />
                        ))}
                      </div>
                      <MatchupArrow verdict={heldTypes ? matchupVerdict(heldTypes, types) : null} />
                    </div>
                  );
                }
                return (
                  <button
                    key={entry.rosterId}
                    className="enemy-scout-chip"
                    style={{ '--plate-color': getTypeColor(hero.types[0]) } as CSSProperties}
                    onClick={() => setInspecting({ hero, entry, enemy: true })}
                    aria-label={`View ${hero.name} details, level ${levelOf(entry)}`}
                  >
                    <HeroPortrait heroId={hero.id} className="enemy-scout-portrait" />
                    <span className="pick-level enemy-scout-level" aria-hidden="true">
                      {levelOf(entry)}
                    </span>
                    <span className="enemy-scout-name">{hero.name}</span>
                    <div className="enemy-scout-types">
                      {types.map((t) => (
                        <TypeBadge key={t} type={t} />
                      ))}
                    </div>
                    <ScoutedPassive hero={hero} entry={entry} />
                    <MatchupArrow verdict={heldTypes ? matchupVerdict(heldTypes, types) : null} />
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
            <h2 className="squad-section-title">Your squad</h2>
            <div className="squad-grid">
              {SLOT_ROWS.map((row, rowIndex) => (
                <div key={rowIndex} className={`squad-band squad-band-${row.key}`}>
                  <div className="squad-band-head">
                    <span className="squad-band-label">{row.label}</span>
                  </div>
                  <div className="squad-grid-row-cells">
                    {row.indices.map((index) => {
                      const rosterId = slots[index];
                      const entry = rosterId ? rosterById.get(rosterId) : undefined;
                      const hero = entry ? rosterHeroes[entry.heroId] : undefined;
                      const isSelected = selectedSlot === index;
                      const isDropTarget = selectedSlot !== null && canSwap(selectedSlot, index);
                      const isDragOver = dragOverSlot === index;
                      const isDown = isDownSlot(index);
                      return (
                        <SquadSlot
                          key={index}
                          hero={hero}
                          entry={entry}
                          selected={isSelected}
                          dropTarget={isDropTarget}
                          dragOver={isDragOver}
                          down={isDown}
                          swapTarget={isDropTarget}
                          onRevive={isDown && rosterId && canUseRevive(run) ? () => handleRevive(rosterId) : undefined}
                          onActivate={() => handleSlotClick(index)}
                          onSwapHere={() => handleSwapHere(index)}
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
                              <HeroPortrait heroId={hero.id} className="roster-card-portrait" />
                              {/* On the figure's corner as the pick cards wear it, not on the name line: a row
                                  cell's line holds a ten-letter name OR a level, not both. */}
                              <span className="pick-level squad-slot-level" aria-hidden="true">
                                {levelOf(entry)}
                              </span>
                              <div className="roster-card-name">{hero.name}</div>
                              <div className="roster-card-types">
                                {rosterEntryTypes(hero, entry).map((t) => (
                                  <TypeBadge key={t} type={t} />
                                ))}
                              </div>
                              {/* A downed hero has no matchups to read: it is not going. */}
                              {entry.down ? <div className="squad-slot-down-label">Down</div> : <MatchupRow heroTypes={rosterEntryTypes(hero, entry)} enemies={scoutOrder} />}
                              {/* Where the act has left this hero (run/wounds.ts) — the read the pick is made on. */}
                              <WoundBar {...entryHp(hero, entry, run.relics)} figure />
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
          scale={statScaleFor(run)}
          onClose={() => setInspecting(null)}
        />
      )}
      {showReference && <ReferenceOverlay onClose={() => setShowReference(false)} />}
      {showRoster && <RosterManagementScreen run={run} onClose={() => setShowRoster(false)} />}
    </div>
  );
}
