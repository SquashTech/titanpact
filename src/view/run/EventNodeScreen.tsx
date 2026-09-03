import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { playSfx } from '../../audio/sfx';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { equipment } from '../../data/equipment';
import { heroes } from '../../data/heroes';
import { moves } from '../../data/moves';
import { passives } from '../../data/passives';
import type { EventTone, RunEventDefinition } from '../../data/events';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { EquipmentDefinition } from '../../run/equipment';
import { pickWeightedEquipment, rarityWeightsFor } from '../../run/equipment';
import { applyStatShift, grantEventPassive, rollEventMove, statShiftAllowed } from '../../run/events';
import { grantLevelUpMove, MOVE_CAP } from '../../run/progression';
import type { RosterEntry, RunState } from '../../run/state';
import { MoveDetailCard } from '../combat/MoveDetailOverlay';
import { entryStatTotals } from '../shared/entryStatTotals';
import { healCasterForEntry } from '../shared/healCaster';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { MoveButtonReplica } from '../shared/MoveTile';
import {
  NodeHeader,
  NodeSky,
  NODE_TINT_ARCANE,
  NODE_TINT_GOLD,
  NODE_TINT_MANA,
  NODE_TINT_TEAL,
  NODE_TINT_VITAL,
} from '../shared/NodeStage';
import { passiveColor, PassiveGlyph } from '../shared/passiveIcons';
import { StatGlyph, STAT_LABELS } from '../shared/StatBars';
import { EquipChoiceCard, EquipInspectOverlay } from './EquipChoiceCard';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterPeek } from './RosterPeek';

interface Props {
  /** Rolled at node-select time (App.tsx) — see src/run/events.ts. */
  event: RunEventDefinition;
  run: RunState;
  onRunChange: (next: RunState) => void;
  /** Loot hand-off to App.tsx's forced equip-or-trash gate. Advances the node itself — an alternative to onContinue. */
  onGrantEquipment: (itemIds: string[]) => void;
  onContinue: () => void;
}

const TONE_TINT: Record<EventTone, string> = {
  gold: NODE_TINT_GOLD,
  arcane: NODE_TINT_ARCANE,
  teal: NODE_TINT_TEAL,
  vital: NODE_TINT_VITAL,
  mana: NODE_TINT_MANA,
};

/** One `discovery` sound in five keys, a whole tone either side of centre. */
const TONE_PITCH: Record<EventTone, number> = {
  gold: 1,
  arcane: 0.9,
  teal: 1.06,
  vital: 1.12,
  mana: 0.95,
};

/** How long the event holds on its flavor line before the offer and roster arrive (ms). */
const EVENT_BEAT_MS = 1150;

function shiftEntries(deltas: Partial<Record<StatKey, number>>): [StatKey, number][] {
  return Object.entries(deltas).filter(([, amount]) => !!amount) as [StatKey, number][];
}

/** True minus sign, not a hyphen — these sit next to a plus. */
function ShiftChips({ deltas, className }: { deltas: Partial<Record<StatKey, number>>; className?: string }) {
  return (
    <div className={`detail-modifier-list${className ? ` ${className}` : ''}`}>
      {shiftEntries(deltas).map(([stat, amount]) => (
        <span key={stat} className={`detail-modifier-chip ${amount > 0 ? 'stat-buff' : 'stat-debuff'}`}>
          <StatGlyph stat={stat} tone="inherit" /> {STAT_LABELS[stat]} {amount > 0 ? `+${amount}` : `−${Math.abs(amount)}`}
        </span>
      ))}
    </div>
  );
}

// Branches on `outcome.kind`, never on an event id — a fifth branch means
// extending the vocabulary in src/data/events.ts, not adding a case here.
export function EventNodeScreen({ event, run, onRunChange, onGrantEquipment, onContinue }: Props) {
  const { outcome } = event;

  // Contents roll here, once: the screen is never unmounted mid-event.
  const [offeredMoveId] = useState<string | undefined>(() =>
    outcome.kind === 'learnMove' ? rollEventMove(outcome.pool, moves) : undefined
  );
  const [lootItems] = useState<EquipmentDefinition[]>(() =>
    outcome.kind === 'loot'
      ? pickWeightedEquipment(Object.values(equipment), outcome.count, rarityWeightsFor(run.actNumber, 'standard'))
      : []
  );

  /** The roster hero this event resolved onto — also the "done" flag for hero-picking outcomes. */
  const [resolvedTo, setResolvedTo] = useState<string | null>(null);
  /** learnMove only: the at-cap hero weighing a swap. Null = the hero grid is showing. */
  const [swapping, setSwapping] = useState<string | null>(null);
  const [selectedReplaceId, setSelectedReplaceId] = useState<string | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const [inspectItemId, setInspectItemId] = useState<string | null>(null);

  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    playSfx('discovery', { pitch: TONE_PITCH[event.tone] });
    if (prefersReducedMotion()) {
      setArrived(true);
      return;
    }
    const timer = window.setTimeout(() => setArrived(true), EVENT_BEAT_MS);
    return () => window.clearTimeout(timer);
  }, [event.tone]);

  const offeredMove = offeredMoveId ? moves[offeredMoveId] : undefined;
  const grantedPassive = outcome.kind === 'grantPassive' ? passives[outcome.passiveId] : undefined;
  const resolvedEntry = resolvedTo ? run.roster.find((r) => r.rosterId === resolvedTo) ?? null : null;
  const resolvedHero = resolvedEntry ? heroes[resolvedEntry.heroId] : null;
  const swappingEntry = swapping ? run.roster.find((r) => r.rosterId === swapping) ?? null : null;
  const swappingCaster = swappingEntry ? healCasterForEntry(heroes[swappingEntry.heroId], swappingEntry, run.relics) : undefined;

  function teach(rosterId: string, replaceMoveId?: string) {
    if (!offeredMoveId) return;
    onRunChange(grantLevelUpMove(run, rosterId, offeredMoveId, replaceMoveId));
    setResolvedTo(rosterId);
    setSwapping(null);
    setSelectedReplaceId(null);
  }

  function handleHeroPick(entry: RosterEntry) {
    if (resolvedTo) return;
    if (outcome.kind === 'learnMove') {
      if (entry.unlockedMoveIds.length >= MOVE_CAP) setSwapping(entry.rosterId);
      else teach(entry.rosterId);
      return;
    }
    if (outcome.kind === 'statShift') {
      onRunChange(applyStatShift(run, entry.rosterId, outcome.deltas));
      setResolvedTo(entry.rosterId);
      return;
    }
    if (outcome.kind === 'grantPassive') {
      onRunChange(grantEventPassive(run, entry.rosterId, outcome.passiveId, passives));
      setResolvedTo(entry.rosterId);
    }
  }

  // Only the stat shift has a gate (src/run/events.ts MIN_HP_AFTER_SHIFT).
  // Relics are deliberately excluded from the HP floor: they are team-wide
  // and cannot change WHICH hero is eligible.
  function heroBlocked(entry: RosterEntry): boolean {
    if (outcome.kind !== 'statShift') return false;
    return !statShiftAllowed(outcome.deltas, entryStatTotals(heroes[entry.heroId], entry).hp);
  }

  function heroCta(entry: RosterEntry, blocked: boolean): ReactNode {
    if (resolvedTo === entry.rosterId) {
      return outcome.kind === 'statShift' ? 'Traded' : 'Learned';
    }
    if (blocked) return 'Too frail';
    if (outcome.kind === 'learnMove') return entry.unlockedMoveIds.length >= MOVE_CAP ? 'Replace…' : 'Teach';
    if (outcome.kind === 'statShift') return 'Trade';
    return 'Learn';
  }

  /** The ask, or what just happened. Never the flavor — that has its own line. */
  function readout(): ReactNode {
    if (resolvedHero) {
      if (outcome.kind === 'learnMove' && offeredMove) return `${resolvedHero.name} learned ${offeredMove.name}.`;
      if (outcome.kind === 'statShift') return `${resolvedHero.name} made the trade.`;
      if (grantedPassive) return `${resolvedHero.name} learned ${grantedPassive.name}.`;
    }
    if (outcome.kind === 'learnMove') {
      return offeredMove ? 'Choose who learns it. Hold a hero to review its sheet.' : 'Nothing here after all.';
    }
    if (outcome.kind === 'statShift') return 'Choose who makes the trade. Hold a hero to review its sheet.';
    if (outcome.kind === 'grantPassive') return 'Choose who learns it. Hold a hero to review its sheet.';
    return `${lootItems.length} ${lootItems.length === 1 ? 'piece' : 'pieces'} of gear. Take them, then place each one.`;
  }

  const heroPicking = outcome.kind !== 'loot';
  const canContinue = outcome.kind === 'loot' || resolvedTo !== null;

  return (
    <div className="node-screen event-node-screen" style={{ '--node-rgb': TONE_TINT[event.tone] } as CSSProperties}>
      <NodeSky />
      <RosterPeek run={run} />

      {!swapping && (
        <NodeHeader
          compact={outcome.kind !== 'statShift'}
          eyebrow={event.eyebrow}
          title={event.name}
          readoutKey={arrived ? (resolvedTo ?? 'idle') : 'arriving'}
          readoutLive={!!resolvedHero}
          /* Empty, not undefined, during the beat: NodeHeader reserves the readout's height. */
          readout={arrived ? readout() : ''}
        >
          <p className="event-flavor">{event.flavor}</p>

          {arrived && outcome.kind === 'statShift' && (
            <div className="node-item-effects event-reveal-in">
              <ShiftChips deltas={outcome.deltas} />
            </div>
          )}
          {arrived && outcome.kind === 'grantPassive' && grantedPassive && (
            <div
              className="node-item-effects event-passive-offer event-reveal-in"
              style={{ '--passive-color': passiveColor(grantedPassive.id) } as CSSProperties}
            >
              <span className="event-passive-name">
                <PassiveGlyph passiveId={grantedPassive.id} />
                {grantedPassive.name}
              </span>
              <p className="event-passive-desc">{grantedPassive.description}</p>
            </div>
          )}
        </NodeHeader>
      )}

      {/* --- learnMove: the swap panel --- */}
      {swapping && swappingEntry && offeredMove ? (
        <div className="screen-scroll moveoffer-stage">
          <div className="stage-centered">
            <div className="reward-panel">
              <p className="offer-hero-sub">
                {heroes[swappingEntry.heroId].name} already knows {MOVE_CAP} moves — pick one to replace, or go back.
              </p>
              <div className="offer-move-highlight">
                <MoveDetailCard
                  move={offeredMove}
                  label="Offered by the event"
                  caster={swappingCaster}
                />
              </div>
              <div className="offer-swap-arrow" aria-hidden="true">
                ↓ replaces one of
              </div>
              <div className="move-list offer-replace-list">
                {swappingEntry.unlockedMoveIds.map((moveId) => (
                  <MoveButtonReplica
                    key={moveId}
                    move={moves[moveId]}
                    selected={selectedReplaceId === moveId}
                    caster={swappingCaster}
                    onClick={() => setSelectedReplaceId(moveId)}
                  />
                ))}
              </div>
              <div className="reward-panel-actions moveoffer-actions">
                <button
                  className="moveoffer-button moveoffer-decline"
                  onClick={() => {
                    setSwapping(null);
                    setSelectedReplaceId(null);
                  }}
                >
                  <span className="moveoffer-icon" aria-hidden="true">
                    ✕
                  </span>
                  <span className="moveoffer-label">Back</span>
                  <span className="moveoffer-sub">Pick a different hero</span>
                </button>
                <button
                  className="moveoffer-button moveoffer-confirm"
                  disabled={!selectedReplaceId}
                  onClick={() => selectedReplaceId && teach(swappingEntry.rosterId, selectedReplaceId)}
                >
                  <span className="moveoffer-icon" aria-hidden="true">
                    ✓
                  </span>
                  <span className="moveoffer-label">Replace</span>
                  <span className="moveoffer-sub">{selectedReplaceId ? moves[selectedReplaceId].name : 'Select a move'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* --- learnMove: the offered move --- */}
          {arrived && outcome.kind === 'learnMove' && offeredMove && (
            <div className="event-offer-move event-reveal-in">
              <MoveDetailCard move={offeredMove} label="Offered by the event" />
            </div>
          )}

          {/* --- loot --- */}
          {/* The wrapper stays mounted through the beat: it is the only flex:1
              child on this path, and gating it collapsed the column. */}
          {outcome.kind === 'loot' && (
            <div className="screen-scroll">
              <div className="stage-centered">
                {arrived && (
                  <div className="equip-cache-list">
                    {lootItems.map((item, i) => (
                      <EquipChoiceCard
                        key={item.id}
                        item={item}
                        onInspect={() => setInspectItemId(item.id)}
                        revealDelayMs={120 + i * 90}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- the hero grid --- */}
          {heroPicking && (
            <HeroPickGrid count={run.roster.length} fill className={arrived ? 'is-waking' : 'is-asleep'}>
              {run.roster.map((entry) => {
                const hero = heroes[entry.heroId];
                const isResolved = resolvedTo === entry.rosterId;
                const blocked = heroBlocked(entry);
                return (
                  <HeroPickCard
                    key={entry.rosterId}
                    hero={hero}
                    entry={entry}
                    disabled={!arrived || (resolvedTo !== null && !isResolved) || blocked}
                    onActivate={() => handleHeroPick(entry)}
                    onPreview={() => setPreviewEntry({ hero, entry })}
                    ariaLabel={`${hero.name}, level ${entry.level} — ${event.name}`}
                    ctaClassName={isResolved ? 'is-done' : 'is-accent'}
                    cta={heroCta(entry, blocked)}
                  />
                );
              })}
            </HeroPickGrid>
          )}
        </>
      )}

      {/* Disabled through the beat: a live Continue is an invitation to skip it. */}
      {!swapping &&
        (outcome.kind === 'loot' ? (
          <button
            className="resolve-button"
            disabled={!arrived}
            onClick={() => onGrantEquipment(lootItems.map((i) => i.id))}
          >
            {lootItems.length > 0 ? `Take all ${lootItems.length}` : 'Continue'}
          </button>
        ) : (
          <button className="resolve-button" disabled={!arrived || !canContinue} onClick={onContinue}>
            Continue
          </button>
        ))}

      {previewEntry && (
        <HeroPreviewOverlay
          hero={previewEntry.hero}
          entry={previewEntry.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          onClose={() => setPreviewEntry(null)}
        />
      )}

      {inspectItemId &&
        (() => {
          const item = lootItems.find((i) => i.id === inspectItemId);
          return item ? <EquipInspectOverlay item={item} onClose={() => setInspectItemId(null)} /> : null;
        })()}
    </div>
  );
}
