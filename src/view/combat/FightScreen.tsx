import { useState } from 'react';
import { heroes } from '../../data/heroes';
import { moves } from '../../data/moves';
import { typeChart } from '../../data/typechart';
import { createCombatant, type CombatState, type Side } from '../../engine/state';
import { createRng } from '../../engine/rng/seededRng';
import { resolveRound } from '../../engine/combat/resolveRound';
import type { Action } from '../../engine/combat/actions';
import type { MoveDefinition } from '../../engine/content';
import { CombatantCard } from './CombatantCard';
import { formatEvents, type LogLine } from './formatEvent';

// This fixture roster is exactly 2v2 with no bench — the same content used by
// the automated tests and the CLI demo. Switching/bench UI is out of scope
// until /src/run models the real bring-6-pick-4 roster.
const ROSTER = [
  { combatantId: 'a1', heroId: 'cinderKnight', side: 'A' as Side },
  { combatantId: 'a2', heroId: 'tidecaller', side: 'A' as Side },
  { combatantId: 'b1', heroId: 'ironWarden', side: 'B' as Side },
  { combatantId: 'b2', heroId: 'wildOracle', side: 'B' as Side },
];

const PLAYER_SIDE: Side = 'A';
const config = { typeChart, heroes, moves, benchHpRegenFlat: 5 };

function buildInitialState(seed: number): CombatState {
  const combatants: CombatState['combatants'] = {};
  for (const r of ROSTER) {
    const hero = heroes[r.heroId];
    // Explicit starting-resource choice for this screen (full HP/mana) — NOT
    // an engine default. Starting mana is still 🔒 OPEN per docs/mana.md.
    combatants[r.combatantId] = createCombatant(r.combatantId, r.heroId, r.side, hero.baseStats.hp, hero.baseStats.manaPool);
  }
  return {
    seed,
    rngState: createRng(seed),
    round: 1,
    active: { A: ['a1', 'a2'], B: ['b1', 'b2'] },
    bench: { A: [], B: [] },
    combatants,
    koCount: { A: 0, B: 0 },
  };
}

function aliveIdsOn(state: CombatState, side: Side): string[] {
  return state.active[side].filter((id): id is string => id !== null && !state.combatants[id].fainted);
}

function sideDefeated(state: CombatState, side: Side): boolean {
  return ROSTER.filter((r) => r.side === side).every((r) => state.combatants[r.combatantId].fainted);
}

/** Deliberately simple heuristic driving the AI side — see scripts/demo-fight.ts for the same policy. */
function pickAiAction(state: CombatState, combatantId: string): Action {
  const combatant = state.combatants[combatantId];
  const hero = heroes[combatant.heroId];
  const moveId = hero.moveIds[0];
  const move = moves[moveId];
  const enemySide: Side = combatant.side === 'A' ? 'B' : 'A';
  const declaredTarget =
    move.target === 'singleEnemy' ? (aliveIdsOn(state, enemySide)[0] ?? null) : move.target === 'singleAlly' ? combatantId : null;
  return { kind: 'move', combatantId, moveId, declaredTarget };
}

interface PendingAction {
  moveId: string;
  declaredTarget: string | null;
}

export function FightScreen() {
  const [combat, setCombat] = useState<CombatState>(() => buildInitialState(Math.floor(Math.random() * 2 ** 31)));
  const [log, setLog] = useState<LogLine[]>([]);
  const [pending, setPending] = useState<Record<string, PendingAction>>({});
  const [selecting, setSelecting] = useState<{ combatantId: string; move: MoveDefinition } | null>(null);

  const playerAlive = aliveIdsOn(combat, PLAYER_SIDE);
  const enemyAlive = aliveIdsOn(combat, PLAYER_SIDE === 'A' ? 'B' : 'A');
  const winner: Side | null = sideDefeated(combat, 'A') ? 'B' : sideDefeated(combat, 'B') ? 'A' : null;

  const targetableIds: string[] = !selecting
    ? []
    : selecting.move.target === 'singleEnemy'
      ? enemyAlive
      : selecting.move.target === 'singleAlly'
        ? playerAlive
        : [];

  function handleMoveClick(combatantId: string, move: MoveDefinition) {
    if (move.target === 'singleEnemy' || move.target === 'singleAlly') {
      const candidates = move.target === 'singleEnemy' ? enemyAlive : playerAlive;
      if (candidates.length === 1) {
        setPending((prev) => ({ ...prev, [combatantId]: { moveId: move.id, declaredTarget: candidates[0] } }));
        setSelecting(null);
      } else {
        setSelecting({ combatantId, move });
      }
    } else {
      setPending((prev) => ({ ...prev, [combatantId]: { moveId: move.id, declaredTarget: null } }));
      if (selecting?.combatantId === combatantId) setSelecting(null);
    }
  }

  function handleTargetClick(targetId: string) {
    if (!selecting) return;
    setPending((prev) => ({ ...prev, [selecting.combatantId]: { moveId: selecting.move.id, declaredTarget: targetId } }));
    setSelecting(null);
  }

  function isActionComplete(combatantId: string): boolean {
    const p = pending[combatantId];
    if (!p) return false;
    const move = moves[p.moveId];
    if ((move.target === 'singleEnemy' || move.target === 'singleAlly') && !p.declaredTarget) return false;
    return true;
  }

  const allReady = playerAlive.length > 0 && playerAlive.every(isActionComplete);

  function handleResolve() {
    const playerActions: Action[] = playerAlive.map((id) => {
      const p = pending[id];
      return { kind: 'move', combatantId: id, moveId: p.moveId, declaredTarget: p.declaredTarget };
    });
    const aiActions: Action[] = enemyAlive.map((id) => pickAiAction(combat, id));

    const result = resolveRound(combat, [...playerActions, ...aiActions], config);
    setCombat(result.state);
    setLog((prev) => [...prev, ...formatEvents(result.events, heroes, result.state.combatants)]);
    setPending({});
    setSelecting(null);
  }

  function handleNewFight() {
    setCombat(buildInitialState(Math.floor(Math.random() * 2 ** 31)));
    setLog([]);
    setPending({});
    setSelecting(null);
  }

  return (
    <>
      <div className="team-row enemy">
        {ROSTER.filter((r) => r.side === 'B').map((r) => (
          <CombatantCard
            key={r.combatantId}
            hero={heroes[r.heroId]}
            combatant={combat.combatants[r.combatantId]}
            targetable={targetableIds.includes(r.combatantId)}
            onSelectTarget={() => handleTargetClick(r.combatantId)}
          />
        ))}
      </div>

      <div className="team-row ally">
        {ROSTER.filter((r) => r.side === 'A').map((r) => (
          <CombatantCard
            key={r.combatantId}
            hero={heroes[r.heroId]}
            combatant={combat.combatants[r.combatantId]}
            targetable={targetableIds.includes(r.combatantId)}
            onSelectTarget={() => handleTargetClick(r.combatantId)}
          />
        ))}
      </div>

      <div className="event-log">
        {[...log].reverse().map((l) => (
          <div key={l.key} className={l.className}>
            {l.text}
          </div>
        ))}
      </div>

      {playerAlive.map((id) => {
        const combatant = combat.combatants[id];
        const hero = heroes[combatant.heroId];
        return (
          <div className="action-panel" key={id}>
            <h3>{hero.name}'s move</h3>
            {selecting?.combatantId === id && <div className="hint">Choose a target above</div>}
            <div className="move-grid">
              {hero.moveIds.map((moveId) => {
                const move = moves[moveId];
                const affordable = combatant.currentMana >= move.manaCost;
                const isSelected = pending[id]?.moveId === moveId;
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
          </div>
        );
      })}

      <button className="resolve-button" disabled={!allReady} onClick={handleResolve}>
        Resolve Round {combat.round}
      </button>

      {winner && (
        <div className="result-overlay">
          <h2>{winner === PLAYER_SIDE ? 'Victory!' : 'Defeat'}</h2>
          <button onClick={handleNewFight}>Play Again</button>
        </div>
      )}
    </>
  );
}
