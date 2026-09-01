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
import { entryPassiveCounts, entryStatModifiers } from '../../run/entryStats';
import { applyStatShift, grantEventPassive, rollEventMove, statShiftAllowed } from '../../run/events';
import { grantLevelUpMove, MOVE_CAP } from '../../run/progression';
import type { RosterEntry, RunState } from '../../run/state';
import { MoveDetailCard } from '../combat/MoveDetailOverlay';
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
import { passiveColor, passiveEmoji } from '../shared/passiveIcons';
import { StatGlyph, STAT_LABELS } from '../shared/StatBars';
import { EquipChoiceCard, EquipInspectOverlay } from './EquipChoiceCard';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterPeek } from './RosterPeek';

interface Props {
  /** The event rolled for this node, chosen once at node-select time (App.tsx) — see src/run/events.ts on why the roll is not made in here. */
  event: RunEventDefinition;
  run: RunState;
  onRunChange: (next: RunState) => void;
  /** The `loot` outcome's hand-off: App.tsx routes these through the same forced equip-or-trash gate every other equipment grant uses. Advances the node itself, so it is an alternative to onContinue, not a step before it. */
  onGrantEquipment: (itemIds: string[]) => void;
  onContinue: () => void;
}

/** An event's named tone resolved to the stage's own hue (NodeStage NODE_TINT_*) — the one place data's presentational hint becomes a colour. */
const TONE_TINT: Record<EventTone, string> = {
  gold: NODE_TINT_GOLD,
  arcane: NODE_TINT_ARCANE,
  teal: NODE_TINT_TEAL,
  vital: NODE_TINT_VITAL,
  mana: NODE_TINT_MANA,
};

/**
 * The same tone, in the ear. One `discovery` sound played in five keys rather
 * than five sounds — the events are one kind of place and already differ only
 * by `--node-rgb`, exactly the argument sounds.ts makes for the three shrines
 * sharing one `shrine`.
 *
 * The spread is deliberately narrow (a whole tone either side of centre). Wide
 * enough that an arcane event and a vital one are not the same arrival; narrow
 * enough that none of the five stops sounding like the others.
 */
const TONE_PITCH: Record<EventTone, number> = {
  gold: 1,
  arcane: 0.9,
  teal: 1.06,
  vital: 1.12,
  mana: 0.95,
};

/**
 * How long the event holds on its own voice before the offer and the roster
 * arrive (ms).
 *
 * Everything on this screen used to land on one frame: the name, the flavor,
 * the mechanical offer and six tappable heroes. The flavor is the only line in
 * the run loop that is not mechanical — it is the whole reason five events do
 * not read as five reward nodes — and it was competing for the first look with
 * a grid of buttons, which it loses every time. So it gets the screen to
 * itself for a beat, and the decision arrives after it has been read.
 *
 * Long enough for a short sentence, short enough that a player on their tenth
 * event is not waiting on it — and the beat is skippable in the only way that
 * matters, since nothing is hidden that the player could have acted on sooner.
 */
const EVENT_BEAT_MS = 1150;

/** "+20 Mana" / "−20 Max HP", in the same words and the same order every time — a stat shift is read as a trade, so the two halves must be legible side by side. */
function shiftEntries(deltas: Partial<Record<StatKey, number>>): [StatKey, number][] {
  return Object.entries(deltas).filter(([, amount]) => !!amount) as [StatKey, number][];
}

/** Chips for a stat shift, coloured by direction — the cost reads as a cost. Uses a true minus sign, not a hyphen, because these sit next to a plus. */
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

/**
 * A hero's effective max HP right now, out of combat — base plus every flat
 * grant, computed through the SAME helpers buildCombatState uses (entryStats.ts)
 * so the floor Soul Transfer is checked against is the number the fight will
 * actually use, not the hero's authored base.
 *
 * Relics are deliberately left out. They are team-wide, so they add the same
 * HP to every hero on the roster and cannot change WHICH hero is eligible —
 * and counting them would let a relic the player might never have had make a
 * hero drainable. The floor should hold on the hero's own durability.
 */
function effectiveMaxHp(hero: HeroDefinition, entry: RosterEntry): number {
  const counts = entryPassiveCounts(entry, equipment);
  const grants = entryStatModifiers(entry, equipment, passives, counts);
  return hero.baseStats.hp + (grants.hp ?? 0);
}

/**
 * `event` map node resolution (docs/run-loop.md, src/data/events.ts).
 *
 * Replaces the placeholder that stood here since the map was built. One screen
 * for all five events, and for every event written after them: the four outcome
 * kinds are a closed vocabulary, so this component branches on `outcome.kind`
 * and NEVER on an event id. An event that needs a fifth branch is a signal to
 * extend the vocabulary in src/data/events.ts, not to add a case here.
 *
 * The chrome is the shared node stage (docs/visual-language.md, ninth pass) —
 * same sky, same unboxed header, same corner RosterPeek, same single bottom CTA
 * as every other node — and the bodies are deliberately borrowed rather than
 * invented:
 *
 *  - the hero grid is HeroPickCard, tap-acts/hold-inspects, exactly as the stat
 *    shrines and the Mentor use it;
 *  - the offered move is MoveDetailCard, the same dossier a hold opens in a
 *    fight, over MoveButtonReplica rows — i.e. LevelUpScreen's move-replace
 *    panel, because "is this worth one of my four slots" is the same question
 *    there and here and deserves the same instrument;
 *  - the loot is EquipChoiceCard, the Equipment Cache's own card.
 *
 * Nothing here is a new visual idea. That is the intent: an event is a new
 * *thing that happens*, not a new dialect.
 */
export function EventNodeScreen({ event, run, onRunChange, onGrantEquipment, onContinue }: Props) {
  const { outcome } = event;

  /*
   * The event's own contents roll HERE, not in App.tsx, and only once. This
   * screen is never unmounted mid-event — its one hand-off (loot -> the equip
   * gate) is terminal — so a useState initializer is safe, which is exactly the
   * condition shop.ts's roll-at-select-time rule turns on. The event IDENTITY
   * still comes in as a prop, because App decides what a node is.
   */
  const [offeredMoveId] = useState<string | undefined>(() =>
    outcome.kind === 'learnMove' ? rollEventMove(outcome.pool, moves) : undefined
  );
  const [lootItems] = useState<EquipmentDefinition[]>(() =>
    outcome.kind === 'loot'
      ? pickWeightedEquipment(Object.values(equipment), outcome.count, rarityWeightsFor(run.actNumber, 'standard'))
      : []
  );

  /** The roster hero this event has resolved onto, once it has. Also the "done" flag for the three hero-picking outcomes. */
  const [resolvedTo, setResolvedTo] = useState<string | null>(null);
  /** learnMove only: the at-cap hero whose four moves are being weighed against the offer. Null = the hero grid is showing. */
  const [swapping, setSwapping] = useState<string | null>(null);
  const [selectedReplaceId, setSelectedReplaceId] = useState<string | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const [inspectItemId, setInspectItemId] = useState<string | null>(null);

  /** False for the screen's first beat, while the place introduces itself (see EVENT_BEAT_MS). */
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    // Fired on mount rather than on the reveal: this is the room, not
    // feedback on anything, and it is built with no transient anywhere in it
    // so it cannot be mistaken for the latter (sounds.ts `discovery`).
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
      // At the cap the offer becomes a swap, which is a second decision and
      // gets its own panel — the same two-step a level-up move offer uses,
      // rather than silently refusing the tap or silently dropping a move.
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

  /** Whether this hero can be tapped at all. Only the stat shift has a real gate — see src/run/events.ts MIN_HP_AFTER_SHIFT. */
  function heroBlocked(entry: RosterEntry): boolean {
    if (outcome.kind !== 'statShift') return false;
    return !statShiftAllowed(outcome.deltas, effectiveMaxHp(heroes[entry.heroId], entry));
  }

  /** The bottom line on each hero card: what the tap buys, in the fewest words that are still specific. */
  function heroCta(entry: RosterEntry): ReactNode {
    if (resolvedTo === entry.rosterId) {
      return outcome.kind === 'statShift' ? 'Traded' : 'Learned';
    }
    if (heroBlocked(entry)) return 'Too frail';
    if (outcome.kind === 'learnMove') return entry.unlockedMoveIds.length >= MOVE_CAP ? 'Replace…' : 'Teach';
    if (outcome.kind === 'statShift') return 'Trade';
    return 'Learn';
  }

  /**
   * The header's last line — the ask, or what just happened. Never the flavor:
   * flavor is a fact about the PLACE and is drawn on its own line above,
   * where it stays put while this one swaps from instruction to outcome.
   */
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

      {/* Hidden during the swap panel for the same reason LevelUpScreen hides
          its own header there: that panel carries its own hero, its own offered
          move and its own two actions, and a second title above it competes
          with the decision instead of framing it. */}
      {!swapping && (
        <NodeHeader
          compact={outcome.kind !== 'statShift'}
          eyebrow={event.eyebrow}
          title={event.name}
          readoutKey={arrived ? (resolvedTo ?? 'idle') : 'arriving'}
          readoutLive={!!resolvedHero}
          /* Empty, not absent, during the first beat: NodeHeader reserves the
             readout's height whenever it is not `undefined`, so the ask fades
             in where it will live rather than pushing the flavor line and the
             whole grid up when it arrives. */
          readout={arrived ? readout() : ''}
        >
          {/* The event's own voice. Its own line, above the offer and above
              the ask, because it answers a different question than either: not
              "what do I get" or "what do I do", but "where am I". It is the
              only thing on the screen that is not mechanical, and it is what
              stops five events from reading as five reward nodes — so it is
              never displaced by the instruction, the way it would be if both
              shared the readout. */}
          <p className="event-flavor">{event.flavor}</p>

          {/* What the event is actually offering, carried in the header so it
              stays visible while the player looks along the hero grid — the
              same slot, and the same chips, the Mentor uses for the discipline
              it is about to teach. */}
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
                {passiveEmoji[grantedPassive.id] && <span aria-hidden="true">{passiveEmoji[grantedPassive.id]}</span>}
                {grantedPassive.name}
              </span>
              <p className="event-passive-desc">{grantedPassive.description}</p>
            </div>
          )}
        </NodeHeader>
      )}

      {/* --- learnMove: the swap panel ------------------------------------ */}
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
                  caster={healCasterForEntry(heroes[swappingEntry.heroId], swappingEntry, run.relics)}
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
                    caster={healCasterForEntry(heroes[swappingEntry.heroId], swappingEntry, run.relics)}
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
          {/* --- learnMove: the offered move, above the grid --------------- */}
          {arrived && outcome.kind === 'learnMove' && offeredMove && (
            <div className="event-offer-move event-reveal-in">
              <MoveDetailCard move={offeredMove} label="Offered by the event" />
            </div>
          )}

          {/* --- loot: the three drops ------------------------------------- */}
          {/* The `.screen-scroll` wrapper is rendered through the first beat
              even though the cards inside it are not. It is this screen's only
              `flex: 1` child on the loot path, so gating the wrapper itself on
              `arrived` collapsed the column and pulled the bottom CTA up under
              the title for the length of the beat. Hide the contents, keep the
              box — the same rule the hero grid follows two blocks down. */}
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

          {/* --- the hero grid -------------------------------------------- */}
          {/* Dark and inert for the first beat, then waking card by card —
              same two classes the level-up screen's roster uses, and for the
              same reason: the grid keeps its space so nothing moves when it
              lights up. */}
          {heroPicking && (
            <HeroPickGrid count={run.roster.length} fill className={arrived ? 'is-waking' : 'is-asleep'}>
              {run.roster.map((entry) => {
                const hero = heroes[entry.heroId];
                const isResolved = resolvedTo === entry.rosterId;
                return (
                  <HeroPickCard
                    key={entry.rosterId}
                    hero={hero}
                    entry={entry}
                    disabled={!arrived || (resolvedTo !== null && !isResolved) || heroBlocked(entry)}
                    onActivate={() => handleHeroPick(entry)}
                    onPreview={() => setPreviewEntry({ hero, entry })}
                    ariaLabel={`${hero.name}, level ${entry.level} — ${event.name}`}
                    ctaClassName={isResolved ? 'is-done' : 'is-accent'}
                    cta={heroCta(entry)}
                  />
                );
              })}
            </HeroPickGrid>
          )}
        </>
      )}

      {/* One CTA at the bottom, as on every node. Loot has nothing to decide
          here — the decision is which hero wears it, which is the equip gate's
          whole job — so its button hands straight off instead of resolving. */}
      {/* Disabled through the first beat along with everything else. A live
          Continue under a screen that has not finished introducing itself is
          an invitation to skip the introduction, which is the one thing this
          beat exists to stop. */}
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
