import { useRef, useState } from 'react';
import { heroes } from '../../data/heroes';
import { allCombatants } from '../../data/content';
import { moves } from '../../data/moves';
import { typeChart } from '../../data/typechart';
import { equipment } from '../../data/equipment';
import { statuses } from '../../data/statuses';
import type { CombatState, Side, StatModifiers } from '../../engine/state';
import { isLockedIn, effectiveTypes, getMaxHp } from '../../engine/state';
import { resolveRound } from '../../engine/combat/resolveRound';
import { applyForcedReplacement } from '../../engine/combat/switching';
import type { Action } from '../../engine/combat/actions';
import type { CombatEvent } from '../../engine/events';
import type { MoveDefinition } from '../../engine/content';
import { resolveStab, resolveTypeMult } from '../../engine/damage/typeMult';
import type { RunState, RosterEntry } from '../../run/state';
import { ROSTER_CAP } from '../../run/state';
import type { Squad } from '../../run/squad';
import { buildCombatState } from '../../run/buildCombatState';
import { isRecruitable } from '../../run/recruitment';
import { CombatantCard, type Popup } from './CombatantCard';
import { HeroDetailOverlay } from './HeroDetailOverlay';
import { formatEvents, type LogLine } from './formatEvent';
import { applyEventToState } from './applyEventToState';
import { buildBeats, type Beat } from './buildBeats';
import { getTypeColor } from './typeColors';

const PLAYER_SIDE: Side = 'A';
const AI_SIDE: Side = 'B';
const config = { typeChart, heroes: allCombatants, moves, statuses, benchHpRegenFlat: 5 };

function rosterIdOf(combatantId: string): string {
  return combatantId.slice(combatantId.indexOf(':') + 1);
}

function entryFor(roster: readonly RosterEntry[], combatantId: string): RosterEntry {
  const entry = roster.find((r) => r.rosterId === rosterIdOf(combatantId));
  if (!entry) throw new Error(`No roster entry for ${combatantId}`);
  return entry;
}

function aliveActiveIdsOn(state: CombatState, side: Side): string[] {
  return state.active[side].filter((id): id is string => id !== null && !state.combatants[id].fainted);
}

function sideDefeated(state: CombatState, side: Side): boolean {
  const combatants = Object.values(state.combatants).filter((c) => c.side === side);
  return combatants.length > 0 && combatants.every((c) => c.fainted);
}

interface PendingAction {
  kind: 'move' | 'switch';
  moveId?: string;
  declaredTarget?: string | null;
  benchedCombatantId?: string;
}

interface Props {
  playerRun: RunState;
  playerSquad: Squad;
  /** This node's generated encounter (src/run/enemyGen.ts) — a fresh AI roster/squad per fight/elite/boss node, not a fixed opponent. */
  aiRun: RunState;
  aiSquad: Squad;
  /** Team-wide relic stat grants (docs/run-loop.md, src/run/relics.ts), precomputed by the caller — applied to every player combatant placed this fight. */
  teamStatModifiers?: StatModifiers;
  /** This node's gold reward on a win (docs/run-loop.md), precomputed by the caller — displayed only, the caller grants it in onResolved. */
  goldReward: number;
  /**
   * Recruit Contract claim (docs/progression.md "raise-vs-recruit axis" —
   * src/run/recruitment.ts): "claim a beaten hero," offered off this node's
   * AI roster on a win. Returns whether the claim succeeded (false only on a
   * full roster) so this screen can reflect it.
   */
  onClaimContract: (defeated: RosterEntry) => boolean;
  /** Fired when the player dismisses the result overlay — the caller owns what a win/loss means for run progress (vitals sync, currency grant, advancing the map, or ending the run). */
  onResolved: (outcome: 'win' | 'loss', finalState: CombatState) => void;
}

export function FightScreen({ playerRun, playerSquad, aiRun, aiSquad, teamStatModifiers, goldReward, onClaimContract, onResolved }: Props) {
  function buildInitialState(seed: number): CombatState {
    return buildCombatState(seed, allCombatants, equipment, [
      { side: PLAYER_SIDE, squad: playerSquad, roster: playerRun.roster, teamStatModifiers },
      { side: AI_SIDE, squad: aiSquad, roster: aiRun.roster },
    ]);
  }

  const [combat, setCombat] = useState<CombatState>(() => buildInitialState(Math.floor(Math.random() * 2 ** 31)));
  const [log, setLog] = useState<LogLine[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [pending, setPending] = useState<Record<string, PendingAction>>({});
  const [selecting, setSelecting] = useState<{ combatantId: string; move: MoveDefinition } | null>(null);
  const [actionStep, setActionStep] = useState(0);
  const [claimedRosterIds, setClaimedRosterIds] = useState<string[]>([]);
  const [inspecting, setInspecting] = useState<string | null>(null);

  // Sequenced, tap-advanced round playback (docs/architecture.md "engine /
  // presentation separation"): `resolving` gates player input and the
  // victory overlay while a round's already-decided event stream is being
  // revealed one beat at a time; `banner` narrates the current beat;
  // `popups` are the floating numbers keyed per combatant card. The queue,
  // the in-progress display state, and the round's authoritative end state
  // live in refs rather than state — they're only ever read/written from
  // inside handleAdvance's click handler, never rendered directly.
  const [resolving, setResolving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [bannerMeta, setBannerMeta] = useState<string | null>(null);
  const [popups, setPopups] = useState<Record<string, Popup>>({});
  const [hoveredMove, setHoveredMove] = useState<{ combatantId: string; move: MoveDefinition } | null>(null);
  const popupSeq = useRef(0);
  const beatQueue = useRef<Beat[]>([]);
  const displayState = useRef<CombatState | null>(null);
  const finalState = useRef<CombatState | null>(null);

  const playerActiveAlive = aliveActiveIdsOn(combat, PLAYER_SIDE);
  const enemyActiveAlive = aliveActiveIdsOn(combat, AI_SIDE);
  const playerBench = combat.bench[PLAYER_SIDE];
  const enemyBench = combat.bench[AI_SIDE];
  const playerLockedIn = isLockedIn(combat, PLAYER_SIDE);

  const winner: Side | null = sideDefeated(combat, PLAYER_SIDE) ? AI_SIDE : sideDefeated(combat, AI_SIDE) ? PLAYER_SIDE : null;

  // A player active slot fainted and needs a bench replacement chosen before the next round can be declared (docs/combat.md "KO handling": forced replacement is not optional, but WHICH bench hero fills it is the player's choice).
  const openReplacementSlots = ([0, 1] as const).filter((slot) => combat.active[PLAYER_SIDE][slot] === null && playerBench.length > 0);

  const targetableIds: string[] = !selecting
    ? []
    : selecting.move.target === 'singleEnemy'
      ? enemyActiveAlive
      : selecting.move.target === 'singleAlly'
        ? playerActiveAlive
        : selecting.move.target === 'bothEnemies'
          ? enemyActiveAlive
          : selecting.move.target === 'bothAllies'
            ? playerActiveAlive
            : selecting.move.target === 'allOthers'
              ? [...enemyActiveAlive, ...playerActiveAlive].filter((cid) => cid !== selecting.combatantId)
              : [];

  function isPendingComplete(p: PendingAction | undefined): boolean {
    if (!p) return false;
    if (p.kind === 'switch') return !!p.benchedCombatantId;
    const move = moves[p.moveId!];
    if ((move.target === 'singleEnemy' || move.target === 'singleAlly') && !p.declaredTarget) return false;
    return true;
  }

  /**
   * Commits `combatantId`'s action and, Pokemon-style, advances to the next
   * player active hero once this one's choice is complete — or auto-resolves
   * the round if this was the last hero to declare. Takes the resolved
   * pending map directly (rather than reading the `pending` state) so the
   * just-committed action is visible immediately, without waiting a render
   * cycle for setState to land.
   */
  function commitAction(combatantId: string, action: PendingAction) {
    const nextPending = { ...pending, [combatantId]: action };
    setPending(nextPending);
    setSelecting(null);
    setHoveredMove(null);

    if (!isPendingComplete(action)) return;

    const idx = playerActiveAlive.indexOf(combatantId);
    if (idx !== -1 && idx < playerActiveAlive.length - 1) {
      setActionStep(idx + 1);
      return;
    }

    if (openReplacementSlots.length === 0 && playerActiveAlive.every((id) => isPendingComplete(nextPending[id]))) {
      resolveRoundWith(nextPending);
    }
  }

  function handleMoveClick(combatantId: string, move: MoveDefinition) {
    if (move.target === 'singleEnemy' || move.target === 'singleAlly') {
      const candidates = move.target === 'singleEnemy' ? enemyActiveAlive : playerActiveAlive;
      if (candidates.length === 1) {
        commitAction(combatantId, { kind: 'move', moveId: move.id, declaredTarget: candidates[0] });
      } else {
        setSelecting({ combatantId, move });
      }
    } else if (move.target === 'bothEnemies' || move.target === 'bothAllies' || move.target === 'allOthers') {
      // Mechanically these moves hit every valid target regardless of which one is tapped
      // (declaredTarget is ignored by the engine's targeting resolution — engine/combat/targeting.ts)
      // — the tap is a confirmation step, not a real choice, so an accidental brush of the move
      // button can't commit a spread attack without the player deliberately confirming it.
      setSelecting({ combatantId, move });
    } else {
      commitAction(combatantId, { kind: 'move', moveId: move.id, declaredTarget: null });
    }
  }

  function handleTargetClick(targetId: string) {
    if (!selecting) return;
    commitAction(selecting.combatantId, { kind: 'move', moveId: selecting.move.id, declaredTarget: targetId });
  }

  function handleSwitchClick(combatantId: string, benchedCombatantId: string) {
    commitAction(combatantId, { kind: 'switch', benchedCombatantId });
  }

  function handleForcedReplacement(slot: 0 | 1, benchedCombatantId: string) {
    const result = applyForcedReplacement(combat, combat.round, PLAYER_SIDE, slot, benchedCombatantId, statuses);
    setCombat(result.state);
    appendLog(formatEvents(result.events, allCombatants, result.state.combatants));
  }

  /**
   * formatEvents keys lines by round+index within its OWN call, which
   * collides across separate calls in the same round (e.g. two forced
   * replacements after a double KO both format a single-element array at
   * index 0). Re-key against the log's running length so every append is
   * unique regardless of how many separate calls contributed to it.
   */
  function appendLog(newLines: LogLine[]) {
    setLog((prev) => [...prev, ...newLines.map((l, i) => ({ ...l, key: `${prev.length + i}-${l.key}` }))]);
  }

  /**
   * Picks randomly among the AI's currently-affordable moves rather than
   * always its first listed move — with a wider fixture movepool per hero
   * (src/data/heroes.ts) a deterministic first-pick would never exercise the
   * variety, and a fight that always plays out the same way isn't useful for
   * testing more complex battles.
   */
  function pickAiAction(state: CombatState, combatantId: string): Action {
    const combatant = state.combatants[combatantId];
    const hero = allCombatants[combatant.heroId];
    const entry = entryFor(aiRun.roster, combatantId);
    const moveIds = entry.unlockedMoveIds.length > 0 ? entry.unlockedMoveIds : hero.moveIds;
    const affordable = moveIds.filter((id) => combatant.currentMana >= moves[id].manaCost);
    const pool = affordable.length > 0 ? affordable : moveIds;
    const moveId = pool[Math.floor(Math.random() * pool.length)];
    const move = moves[moveId];
    const declaredTarget =
      move.target === 'singleEnemy' ? (aliveActiveIdsOn(state, PLAYER_SIDE)[0] ?? null) : move.target === 'singleAlly' ? combatantId : null;
    return { kind: 'move', combatantId, moveId, declaredTarget };
  }

  /** Type-effectiveness multiplier of `move` against whichever hero currently occupies `defenderId` — presentation-only read of the engine's own type resolution (docs/architecture.md "Resolution and presentation are separate layers"). */
  function effectivenessAgainst(move: MoveDefinition, defenderId: string): number {
    const defender = combat.combatants[defenderId];
    const defenderHero = allCombatants[defender.heroId];
    return resolveTypeMult(typeChart, move.type, effectiveTypes(defenderHero, defender));
  }

  function formatMult(mult: number): string {
    return `${Math.round(mult * 100) / 100}×`;
  }

  function multClass(mult: number): string {
    if (mult > 1) return 'eff-super';
    if (mult < 1) return 'eff-resist';
    return 'eff-neutral';
  }

  /** The move currently being shown to the player for `combatantId` — mid target-selection, or already committed — so the description/effectiveness readout has something to point at. */
  function activeMoveFor(combatantId: string): MoveDefinition | null {
    if (selecting?.combatantId === combatantId) return selecting.move;
    const p = pending[combatantId];
    if (p?.kind === 'move' && p.moveId) return moves[p.moveId];
    return null;
  }

  function resolveRoundWith(pendingMap: Record<string, PendingAction>) {
    const playerActions: Action[] = playerActiveAlive.map((id) => {
      const p = pendingMap[id];
      return p.kind === 'switch'
        ? { kind: 'switch', combatantId: id, benchedCombatantId: p.benchedCombatantId! }
        : { kind: 'move', combatantId: id, moveId: p.moveId!, declaredTarget: p.declaredTarget };
    });
    const aiActions: Action[] = enemyActiveAlive.map((id) => pickAiAction(combat, id));

    const result = resolveRound(combat, [...playerActions, ...aiActions], config);
    let nextState = result.state;
    const events = [...result.events];

    // The AI auto-replaces fainted active slots from its own bench right away (docs/combat.md: forced replacement "still happens" regardless of lock-in; scripts/demo-fight.ts does the same as a post-round step).
    for (const slot of [0, 1] as const) {
      if (nextState.active[AI_SIDE][slot] === null && nextState.bench[AI_SIDE].length > 0) {
        const inId = nextState.bench[AI_SIDE][0];
        const r = applyForcedReplacement(nextState, nextState.round, AI_SIDE, slot, inId, statuses);
        nextState = r.state;
        events.push(...r.events);
      }
    }

    startBeatPlayback(combat, events, nextState);
  }

  /**
   * Loads an already-resolved round's event stream, grouped into beats
   * (buildBeats.ts), and reveals the first one. The rest wait in `beatQueue`
   * for handleAdvance taps — this is the seam that turns the engine's
   * instant, synchronous result into something a player reads at their own
   * pace instead of a scripted timer (docs/architecture.md "engine /
   * presentation separation"). `finalState` is applied verbatim once the
   * queue empties, so playback can never drift from the authoritative result
   * regardless of how the beats replayed it.
   */
  function startBeatPlayback(startState: CombatState, events: CombatEvent[], nextFinalState: CombatState) {
    const beats = buildBeats(events, allCombatants, moves, startState.combatants, PLAYER_SIDE);
    displayState.current = startState;
    finalState.current = nextFinalState;
    beatQueue.current = beats;
    setResolving(true);
    handleAdvance();
  }

  /**
   * Reveals the next queued beat, or — once the queue is empty — finalizes
   * the round (snaps to the authoritative end state and hands control back
   * to the player). Bound to a tap on the banner/battlefield while
   * `resolving` is true, so the player reads each beat at their own pace
   * rather than a fixed timer.
   */
  function handleAdvance() {
    const beat = beatQueue.current.shift();

    if (!beat) {
      setCombat(finalState.current!);
      setPopups({});
      setBanner(null);
      setBannerMeta(null);
      setResolving(false);
      setPending({});
      setSelecting(null);
      setHoveredMove(null);
      setActionStep(0);
      return;
    }

    let next = displayState.current!;
    for (const event of beat.events) next = applyEventToState(next, event);
    displayState.current = next;

    setCombat(next);
    appendLog(formatEvents(beat.events, allCombatants, next.combatants));
    setBanner(beat.banner);
    setBannerMeta(beat.bannerMeta ?? null);
    setPopups(Object.fromEntries(beat.popups.map((p) => [p.combatantId, { key: popupSeq.current++, text: p.text, className: p.className }])));
  }

  function handleClaimContract(entry: RosterEntry) {
    if (onClaimContract(entry)) setClaimedRosterIds((prev) => [...prev, entry.rosterId]);
  }

  function renderActiveSlot(side: Side, slot: 0 | 1) {
    const id = combat.active[side][slot];
    if (id) {
      const hero = allCombatants[combat.combatants[id].heroId];
      return (
        <CombatantCard
          key={id}
          hero={hero}
          combatant={combat.combatants[id]}
          targetable={targetableIds.includes(id)}
          onSelectTarget={() => handleTargetClick(id)}
          onInspect={() => setInspecting(id)}
          popup={popups[id]}
        />
      );
    }
    const bench = combat.bench[side];
    if (side === PLAYER_SIDE && bench.length > 0 && !resolving) {
      return (
        <div className="combatant-card empty-slot" key={`empty-${side}-${slot}`}>
          <div className="combatant-name">Choose replacement</div>
          {bench.map((benchId) => (
            <button key={benchId} className="bench-pick-button" onClick={() => handleForcedReplacement(slot, benchId)}>
              {allCombatants[combat.combatants[benchId].heroId].name}
            </button>
          ))}
        </div>
      );
    }
    return (
      <div className="combatant-card empty-slot" key={`empty-${side}-${slot}`}>
        —
      </div>
    );
  }

  return (
    <>
      <div className="fight-header">
        <button className="log-toggle-button" onClick={() => setLogOpen(true)}>
          📜 Battle Log
        </button>
      </div>

      {/* Full-screen click-catcher while a round is playing out — lets the
          player tap anywhere to advance instead of hunting for the banner
          specifically. Sits below the battle-log overlay's z-index so an
          open log panel takes taps for itself (close it) rather than also
          advancing the beat underneath it. */}
      {resolving && <div className="advance-overlay" onClick={handleAdvance} />}

      <div className="battlefield">
        {banner && (
          <div className="combat-banner">
            <span>{banner}</span>
            {bannerMeta && <span className="combat-banner-meta">{bannerMeta}</span>}
            <span className="combat-banner-hint">tap to continue ▸</span>
          </div>
        )}

        <div className="team-row enemy">
          {renderActiveSlot(AI_SIDE, 0)}
          {renderActiveSlot(AI_SIDE, 1)}
        </div>

        <div className="team-row ally">
          {renderActiveSlot(PLAYER_SIDE, 0)}
          {renderActiveSlot(PLAYER_SIDE, 1)}
        </div>
      </div>

      <div className="action-area">
        {!resolving &&
          openReplacementSlots.length === 0 &&
          playerActiveAlive.length > 0 &&
          (() => {
            const stepIndex = Math.min(actionStep, playerActiveAlive.length - 1);
            const id = playerActiveAlive[stepIndex];
            const entry = entryFor(playerRun.roster, id);
            const hero = allCombatants[combat.combatants[id].heroId];
            const combatant = combat.combatants[id];
            const activeMove = activeMoveFor(id);
            return (
              <div className="action-panel" key={id}>
                <div className="action-panel-header">
                  <h3>{hero.name}'s move</h3>
                  {stepIndex > 0 && (
                    <button className="back-button" onClick={() => setActionStep(stepIndex - 1)}>
                      ← Back
                    </button>
                  )}
                </div>
                <div className="move-grid">
                  {entry.unlockedMoveIds.map((moveId) => {
                    const move = moves[moveId];
                    const affordable = combatant.currentMana >= move.manaCost;
                    const isSelected = pending[id]?.kind === 'move' && pending[id]?.moveId === moveId;
                    const hasStab = resolveStab(move.type, effectiveTypes(hero, combatant)) > 1;
                    return (
                      <button
                        key={moveId}
                        className={`move-button${isSelected ? ' selected' : ''}`}
                        disabled={!affordable}
                        onClick={() => handleMoveClick(id, move)}
                        onMouseEnter={() => setHoveredMove({ combatantId: id, move })}
                        onMouseLeave={() => setHoveredMove((prev) => (prev?.move.id === move.id && prev.combatantId === id ? null : prev))}
                      >
                        <div className="move-row-top">
                          <span className="move-name">{move.name}</span>
                          <span className="move-cost">{move.manaCost}MP</span>
                        </div>
                        <div className="move-row-mid">
                          <span className="type-tag" style={{ color: getTypeColor(move.type) }}>
                            {move.type}
                          </span>
                          <span className="move-power">BP {move.basePower}</span>
                          {hasStab && <span className="move-stab">STAB</span>}
                        </div>
                        {enemyActiveAlive.length > 0 && (
                          <div className="move-row-eff">
                            {enemyActiveAlive.map((enemyId) => {
                              const mult = effectivenessAgainst(move, enemyId);
                              return (
                                <span key={enemyId} className={`eff-chip ${multClass(mult)}`}>
                                  {formatMult(mult)}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="move-description">
                  {hoveredMove?.combatantId === id
                    ? (hoveredMove.move.description ?? '')
                    : selecting?.combatantId === id
                      ? 'Choose a target above.'
                      : activeMove
                        ? (activeMove.description ?? '')
                        : 'Tap a move to see its effect and matchups.'}
                </div>
                {playerBench.length > 0 && (
                  <div className="switch-row">
                    <div className="switch-label">{playerLockedIn ? 'Switching disabled (2+ KOs)' : 'Switch in:'}</div>
                    {!playerLockedIn &&
                      playerBench.map((benchId) => {
                        const isSelected = pending[id]?.kind === 'switch' && pending[id]?.benchedCombatantId === benchId;
                        const benchCombatant = combat.combatants[benchId];
                        const benchHero = allCombatants[benchCombatant.heroId];
                        return (
                          <button
                            key={benchId}
                            className={`move-button switch-button${isSelected ? ' selected' : ''}`}
                            onClick={() => handleSwitchClick(id, benchId)}
                          >
                            <span>{benchHero.name}</span>
                            <span className="switch-hp">
                              HP {Math.max(0, benchCombatant.currentHp)}/{getMaxHp(benchHero, benchCombatant)}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })()}

        {!resolving && openReplacementSlots.length > 0 && <div className="hint">Choose a bench replacement above to continue.</div>}
      </div>

      {logOpen && (
        <div className="log-overlay" onClick={() => setLogOpen(false)}>
          <div className="log-panel" onClick={(e) => e.stopPropagation()}>
            <div className="log-panel-header">
              <span>Battle Log</span>
              <button className="log-close-button" onClick={() => setLogOpen(false)}>
                ✕
              </button>
            </div>
            <div className="event-log">
              {[...log].reverse().map((l) => (
                <div key={l.key} className={l.className}>
                  {l.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {inspecting &&
        combat.combatants[inspecting] &&
        (() => {
          const combatant = combat.combatants[inspecting];
          const hero = allCombatants[combatant.heroId];
          const roster = combatant.side === PLAYER_SIDE ? playerRun.roster : aiRun.roster;
          const rosterEntry = roster.find((r) => r.rosterId === rosterIdOf(inspecting)) ?? null;
          return (
            <HeroDetailOverlay
              hero={hero}
              combatant={combatant}
              rosterEntry={rosterEntry}
              equipmentLookup={equipment}
              onClose={() => setInspecting(null)}
            />
          );
        })()}

      {winner && !resolving && (
        <div className="result-overlay">
          <h2>{winner === PLAYER_SIDE ? 'Victory!' : 'Defeat'}</h2>
          {winner === PLAYER_SIDE && goldReward > 0 && <p className="hint">+{goldReward}g</p>}
          {winner === PLAYER_SIDE && aiRun.roster.some((entry) => isRecruitable(entry.heroId, heroes)) && (
            <div className="contract-claims">
              <div className="hint">
                Claim a Recruit Contract ({playerRun.recruitContracts} available):
              </div>
              <div className="contract-claims-grid">
                {aiRun.roster.filter((entry) => isRecruitable(entry.heroId, heroes)).map((entry) => {
                  const claimed = claimedRosterIds.includes(entry.rosterId);
                  const rosterFull = playerRun.roster.length >= ROSTER_CAP;
                  const noContracts = playerRun.recruitContracts <= 0;
                  return (
                    <button
                      key={entry.rosterId}
                      className="move-button"
                      disabled={claimed || rosterFull || noContracts}
                      onClick={() => handleClaimContract(entry)}
                    >
                      {claimed ? `${heroes[entry.heroId].name} (claimed)` : `Claim ${heroes[entry.heroId].name}`}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="result-buttons">
            <button onClick={() => onResolved(winner === PLAYER_SIDE ? 'win' : 'loss', combat)}>Continue</button>
          </div>
        </div>
      )}
    </>
  );
}
