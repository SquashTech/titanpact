import { useState } from 'react';
import { heroes } from '../../data/heroes';
import { moves } from '../../data/moves';
import { typeChart } from '../../data/typechart';
import { equipment } from '../../data/equipment';
import type { CombatState, Side } from '../../engine/state';
import { isLockedIn } from '../../engine/state';
import { resolveRound } from '../../engine/combat/resolveRound';
import { applyForcedReplacement } from '../../engine/combat/switching';
import type { Action } from '../../engine/combat/actions';
import type { MoveDefinition } from '../../engine/content';
import type { RunState, RosterEntry } from '../../run/state';
import { createRunState, createRosterEntry, addRosterEntry, ROSTER_CAP } from '../../run/state';
import type { Squad } from '../../run/squad';
import { pickSquad } from '../../run/squad';
import { buildCombatState } from '../../run/buildCombatState';
import { CombatantCard } from './CombatantCard';
import { formatEvents, type LogLine } from './formatEvent';

const PLAYER_SIDE: Side = 'A';
const AI_SIDE: Side = 'B';
const config = { typeChart, heroes, moves, benchHpRegenFlat: 5 };

/**
 * Fixed AI opponent — its own roster, independent of the player's (RunState
 * is per-side; there's no shared-roster concept). Bench included so forced
 * replacement and switching are exercised on the AI side too, not just the
 * player's.
 */
function createAiRun(): RunState {
  let run = createRunState(0);
  for (const heroId of ['ironWarden', 'wildOracle', 'stormRanger', 'shadowMonk']) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  return run;
}
const AI_RUN = createAiRun();
const AI_SQUAD = pickSquad(AI_RUN.roster, ['ironWarden', 'wildOracle', 'stormRanger', 'shadowMonk']);

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
  onExit: () => void;
  /**
   * Recruit Contract claim (docs/progression.md "raise-vs-recruit axis" —
   * src/run/recruitment.ts): "claim a beaten hero." There's no escalating
   * fight run loop yet to trigger this organically (README "Next steps"
   * #4), so it's offered here on the single demo fight's victory screen —
   * the AI's roster stands in for "the enemy you just beat." Returns
   * whether the claim succeeded (false only on a full roster) so this
   * screen can reflect it.
   */
  onClaimContract: (defeated: RosterEntry) => boolean;
}

export function FightScreen({ playerRun, playerSquad, onExit, onClaimContract }: Props) {
  function buildInitialState(seed: number): CombatState {
    return buildCombatState(seed, heroes, equipment, [
      { side: PLAYER_SIDE, squad: playerSquad, roster: playerRun.roster },
      { side: AI_SIDE, squad: AI_SQUAD, roster: AI_RUN.roster },
    ]);
  }

  const [combat, setCombat] = useState<CombatState>(() => buildInitialState(Math.floor(Math.random() * 2 ** 31)));
  const [log, setLog] = useState<LogLine[]>([]);
  const [pending, setPending] = useState<Record<string, PendingAction>>({});
  const [selecting, setSelecting] = useState<{ combatantId: string; move: MoveDefinition } | null>(null);
  const [claimedRosterIds, setClaimedRosterIds] = useState<string[]>([]);

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
        : [];

  function handleMoveClick(combatantId: string, move: MoveDefinition) {
    if (move.target === 'singleEnemy' || move.target === 'singleAlly') {
      const candidates = move.target === 'singleEnemy' ? enemyActiveAlive : playerActiveAlive;
      if (candidates.length === 1) {
        setPending((prev) => ({ ...prev, [combatantId]: { kind: 'move', moveId: move.id, declaredTarget: candidates[0] } }));
        setSelecting(null);
      } else {
        setSelecting({ combatantId, move });
      }
    } else {
      setPending((prev) => ({ ...prev, [combatantId]: { kind: 'move', moveId: move.id, declaredTarget: null } }));
      if (selecting?.combatantId === combatantId) setSelecting(null);
    }
  }

  function handleTargetClick(targetId: string) {
    if (!selecting) return;
    setPending((prev) => ({ ...prev, [selecting.combatantId]: { kind: 'move', moveId: selecting.move.id, declaredTarget: targetId } }));
    setSelecting(null);
  }

  function handleSwitchClick(combatantId: string, benchedCombatantId: string) {
    setPending((prev) => ({ ...prev, [combatantId]: { kind: 'switch', benchedCombatantId } }));
    if (selecting?.combatantId === combatantId) setSelecting(null);
  }

  function handleForcedReplacement(slot: 0 | 1, benchedCombatantId: string) {
    const result = applyForcedReplacement(combat, combat.round, PLAYER_SIDE, slot, benchedCombatantId);
    setCombat(result.state);
    appendLog(formatEvents([result.event], heroes, result.state.combatants));
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

  function isActionComplete(combatantId: string): boolean {
    const p = pending[combatantId];
    if (!p) return false;
    if (p.kind === 'switch') return !!p.benchedCombatantId;
    const move = moves[p.moveId!];
    if ((move.target === 'singleEnemy' || move.target === 'singleAlly') && !p.declaredTarget) return false;
    return true;
  }

  const allReady = playerActiveAlive.length > 0 && playerActiveAlive.every(isActionComplete) && openReplacementSlots.length === 0;

  function pickAiAction(state: CombatState, combatantId: string): Action {
    const combatant = state.combatants[combatantId];
    const hero = heroes[combatant.heroId];
    const entry = entryFor(AI_RUN.roster, combatantId);
    const moveId = entry.unlockedMoveIds[0] ?? hero.moveIds[0];
    const move = moves[moveId];
    const declaredTarget =
      move.target === 'singleEnemy' ? (aliveActiveIdsOn(state, PLAYER_SIDE)[0] ?? null) : move.target === 'singleAlly' ? combatantId : null;
    return { kind: 'move', combatantId, moveId, declaredTarget };
  }

  function handleResolve() {
    const playerActions: Action[] = playerActiveAlive.map((id) => {
      const p = pending[id];
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
        const r = applyForcedReplacement(nextState, nextState.round, AI_SIDE, slot, inId);
        nextState = r.state;
        events.push(r.event);
      }
    }

    setCombat(nextState);
    appendLog(formatEvents(events, heroes, nextState.combatants));
    setPending({});
    setSelecting(null);
  }

  function handleRematch() {
    setCombat(buildInitialState(Math.floor(Math.random() * 2 ** 31)));
    setLog([]);
    setPending({});
    setSelecting(null);
    setClaimedRosterIds([]);
  }

  function handleClaimContract(entry: RosterEntry) {
    if (onClaimContract(entry)) setClaimedRosterIds((prev) => [...prev, entry.rosterId]);
  }

  function renderActiveSlot(side: Side, slot: 0 | 1) {
    const id = combat.active[side][slot];
    if (id) {
      const hero = heroes[combat.combatants[id].heroId];
      return (
        <CombatantCard
          key={id}
          hero={hero}
          combatant={combat.combatants[id]}
          targetable={targetableIds.includes(id)}
          onSelectTarget={() => handleTargetClick(id)}
        />
      );
    }
    const bench = combat.bench[side];
    if (side === PLAYER_SIDE && bench.length > 0) {
      return (
        <div className="combatant-card empty-slot" key={`empty-${side}-${slot}`}>
          <div className="combatant-name">Choose replacement</div>
          {bench.map((benchId) => (
            <button key={benchId} className="bench-pick-button" onClick={() => handleForcedReplacement(slot, benchId)}>
              {heroes[combat.combatants[benchId].heroId].name}
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

  function renderBenchRow(side: Side) {
    const bench = combat.bench[side];
    if (bench.length === 0) return null;
    return (
      <div className="bench-row">
        {bench.map((id) => (
          <div className="bench-card" key={id}>
            <CombatantCard hero={heroes[combat.combatants[id].heroId]} combatant={combat.combatants[id]} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <button className="exit-button" onClick={onExit}>
        ← Squad
      </button>

      <div className="team-row enemy">
        {renderActiveSlot(AI_SIDE, 0)}
        {renderActiveSlot(AI_SIDE, 1)}
      </div>
      {renderBenchRow(AI_SIDE)}

      <div className="team-row ally">
        {renderActiveSlot(PLAYER_SIDE, 0)}
        {renderActiveSlot(PLAYER_SIDE, 1)}
      </div>
      {renderBenchRow(PLAYER_SIDE)}

      <div className="event-log">
        {[...log].reverse().map((l) => (
          <div key={l.key} className={l.className}>
            {l.text}
          </div>
        ))}
      </div>

      {openReplacementSlots.length === 0 &&
        playerActiveAlive.map((id) => {
          const entry = entryFor(playerRun.roster, id);
          const hero = heroes[combat.combatants[id].heroId];
          const combatant = combat.combatants[id];
          return (
            <div className="action-panel" key={id}>
              <h3>{hero.name}'s move</h3>
              {selecting?.combatantId === id && <div className="hint">Choose a target above</div>}
              <div className="move-grid">
                {entry.unlockedMoveIds.map((moveId) => {
                  const move = moves[moveId];
                  const affordable = combatant.currentMana >= move.manaCost;
                  const isSelected = pending[id]?.kind === 'move' && pending[id]?.moveId === moveId;
                  return (
                    <button
                      key={moveId}
                      className={`move-button${isSelected ? ' selected' : ''}`}
                      disabled={!affordable}
                      onClick={() => handleMoveClick(id, move)}
                    >
                      {move.name}
                      <span className="move-cost">{move.manaCost}MP</span>
                    </button>
                  );
                })}
              </div>
              {playerBench.length > 0 && (
                <div className="switch-row">
                  <div className="switch-label">{playerLockedIn ? 'Switching disabled (2+ KOs)' : 'Switch in:'}</div>
                  {!playerLockedIn &&
                    playerBench.map((benchId) => {
                      const isSelected = pending[id]?.kind === 'switch' && pending[id]?.benchedCombatantId === benchId;
                      return (
                        <button
                          key={benchId}
                          className={`move-button switch-button${isSelected ? ' selected' : ''}`}
                          onClick={() => handleSwitchClick(id, benchId)}
                        >
                          {heroes[combat.combatants[benchId].heroId].name}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}

      {openReplacementSlots.length > 0 && <div className="hint">Choose a bench replacement above before resolving the round.</div>}

      <button className="resolve-button" disabled={!allReady} onClick={handleResolve}>
        Resolve Round {combat.round}
      </button>

      {winner && (
        <div className="result-overlay">
          <h2>{winner === PLAYER_SIDE ? 'Victory!' : 'Defeat'}</h2>
          {winner === PLAYER_SIDE && (
            <div className="contract-claims">
              <div className="hint">Claim a Recruit Contract (docs/progression.md "raise-vs-recruit axis"):</div>
              <div className="contract-claims-grid">
                {AI_RUN.roster.map((entry) => {
                  const claimed = claimedRosterIds.includes(entry.rosterId);
                  const rosterFull = playerRun.roster.length >= ROSTER_CAP;
                  return (
                    <button
                      key={entry.rosterId}
                      className="move-button"
                      disabled={claimed || rosterFull}
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
            <button onClick={handleRematch}>Rematch</button>
            <button onClick={onExit}>Change Squad</button>
          </div>
        </div>
      )}
    </>
  );
}
