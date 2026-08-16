import { useState } from 'react';
import { heroes } from '../../data/heroes';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import type { MoveDefinition } from '../../engine/content';
import type { RunState } from '../../run/state';
import {
  levelUpHero,
  levelUpMovePool,
  grantLevelUpMove,
  availableRankUp,
  chooseRankUpBranch,
  MOVE_CAP,
  ProgressionError,
} from '../../run/progression';
import { getTypeColor } from '../combat/typeColors';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onDone: () => void;
}

interface MoveOffer {
  rosterId: string;
  moveId: string;
}

const KIND_LABELS: Record<string, string> = { damage: 'Damage', heal: 'Heal', buff: 'Buff/Debuff' };

/** "60 pow · 10 mp" / "40 heal · 14 mp" / "10 mp" — the compact stat line shown in a move tooltip/banner. */
function moveStatLine(move: MoveDefinition): string {
  const parts: string[] = [];
  if (move.kind === 'damage' && move.basePower) parts.push(`${move.basePower} pow`);
  if (move.kind === 'heal' && move.healAmount) parts.push(`${move.healAmount} heal`);
  parts.push(`${move.manaCost} mp`);
  return parts.join(' · ');
}

/** Hoverable move chip — name + type-colored tag, with a tooltip panel (full type/stats/description) shown on hover, tap-to-toggle on touch devices. */
function MoveChip({ move }: { move: MoveDefinition }) {
  const [pinned, setPinned] = useState(false);
  return (
    <span
      className={`move-chip${pinned ? ' move-chip-pinned' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        setPinned((p) => !p);
      }}
    >
      <span className="move-chip-type-dot" style={{ background: getTypeColor(move.type) }} />
      {move.name}
      <span className="move-chip-tooltip">
        <span className="move-tooltip-head">
          <span className="move-tooltip-name">{move.name}</span>
          <span className="type-tag" style={{ color: getTypeColor(move.type) }}>
            {move.type}
          </span>
        </span>
        <span className="move-tooltip-meta">
          {KIND_LABELS[move.kind] ?? move.kind} · {moveStatLine(move)}
        </span>
        {move.description && <span className="move-tooltip-desc">{move.description}</span>}
      </span>
    </span>
  );
}

/**
 * Forced immediately-after-battle spend screen (CLAUDE.md "After winning a
 * fight, you are given training points that must be instantly allocated
 * before the run continues"). Every Training Point earned must be put into a
 * hero here before Continue unlocks — replaces the old "spend whenever, via
 * Manage Roster" flow. Manage Roster (RosterManagementScreen) is now
 * inspection/equipment-only and never spends the pool.
 */
export function LevelUpScreen({ run, onRunChange, onDone }: Props) {
  const [offer, setOffer] = useState<MoveOffer | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  /** The most recently learned/offered move — drives the top-of-screen move banner (this screen's equivalent of SquadSelectScreen's info-preview treatment). */
  const [bannerMoveId, setBannerMoveId] = useState<string | null>(null);

  function handleLevelUp(rosterId: string) {
    const entry = run.roster.find((r) => r.rosterId === rosterId);
    if (!entry) return;
    const hero = heroes[entry.heroId];
    const pool = levelUpMovePool(progressionTable, entry);
    const wasAtCap = entry.unlockedMoveIds.length >= MOVE_CAP;
    const newLevel = entry.level + 1;

    let next: RunState;
    try {
      next = levelUpHero(run, rosterId);
    } catch (err) {
      if (err instanceof ProgressionError) return;
      throw err;
    }

    if (pool.length === 0) {
      onRunChange(next);
      setLastMessage(`${hero.name} reached level ${newLevel}.`);
      setBannerMoveId(null);
      return;
    }

    const moveId = pool[Math.floor(Math.random() * pool.length)];
    if (!wasAtCap) {
      onRunChange(grantLevelUpMove(next, rosterId, moveId));
      setLastMessage(`${hero.name} reached level ${newLevel} and learned ${moves[moveId].name}!`);
      setBannerMoveId(moveId);
    } else {
      onRunChange(next);
      setOffer({ rosterId, moveId });
      setBannerMoveId(moveId);
    }
  }

  function resolveOffer(replaceMoveId: string | null) {
    if (!offer) return;
    const entry = run.roster.find((r) => r.rosterId === offer.rosterId);
    const hero = entry ? heroes[entry.heroId] : null;
    if (replaceMoveId) {
      onRunChange(grantLevelUpMove(run, offer.rosterId, offer.moveId, replaceMoveId));
      if (hero) setLastMessage(`${hero.name} swapped in ${moves[offer.moveId].name}.`);
    } else if (hero) {
      setLastMessage(`${hero.name} kept its current moves.`);
      setBannerMoveId(null);
    }
    setOffer(null);
  }

  const offerEntry = offer ? (run.roster.find((r) => r.rosterId === offer.rosterId) ?? null) : null;
  const bannerMove = bannerMoveId ? moves[bannerMoveId] : null;

  return (
    <div className="node-screen">
      <div className="screen-scroll">
        <h2 className="squad-section-title">📈 Level Up — {run.levelUpPool} pts remaining</h2>
        <p className="hint">Spend every Training Point before continuing.</p>

        {bannerMove && (
          <div className="levelup-banner">
            <div className="levelup-banner-label">{offer ? 'Move offered' : 'Move learned'}</div>
            <div className="move-tooltip-head">
              <span className="move-tooltip-name">{bannerMove.name}</span>
              <span className="type-tag" style={{ color: getTypeColor(bannerMove.type) }}>
                {bannerMove.type}
              </span>
            </div>
            <div className="move-tooltip-meta">
              {KIND_LABELS[bannerMove.kind] ?? bannerMove.kind} · {moveStatLine(bannerMove)}
            </div>
            {bannerMove.description && <div className="move-tooltip-desc">{bannerMove.description}</div>}
          </div>
        )}
        {!bannerMove && lastMessage && <p className="hint">{lastMessage}</p>}

        {offer && offerEntry ? (
          <div className="reward-panel">
            <h3>
              {heroes[offerEntry.heroId].name} is already at {MOVE_CAP} moves — pick one to replace, or decline.
            </h3>
            <div className="roster-grid">
              {offerEntry.unlockedMoveIds.map((moveId) => (
                <button key={moveId} className="roster-card" onClick={() => resolveOffer(moveId)}>
                  <div className="roster-card-name">Replace {moves[moveId].name}</div>
                  <div className="roster-card-types">
                    <MoveChip move={moves[moveId]} />
                  </div>
                </button>
              ))}
              <button className="roster-card" onClick={() => resolveOffer(null)}>
                <div className="roster-card-name">Decline — keep current moves</div>
              </button>
            </div>
          </div>
        ) : (
          <div className="roster-grid">
            {run.roster.map((entry) => {
              const hero = heroes[entry.heroId];
              const node = availableRankUp(progressionTable, entry);
              return (
                <div
                  key={entry.rosterId}
                  className="training-hero"
                  style={{ borderLeftColor: getTypeColor(hero.types[0]) }}
                >
                  <h3>
                    {hero.name} — Lv {entry.level}
                  </h3>
                  <div className="roster-card-types">
                    {hero.types.map((t) => (
                      <span key={t} className="type-tag" style={{ color: getTypeColor(t) }}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="move-chip-row">
                    {entry.unlockedMoveIds.map((moveId) =>
                      moves[moveId] ? <MoveChip key={moveId} move={moves[moveId]} /> : null
                    )}
                  </div>
                  <button className="move-button" disabled={run.levelUpPool < 1} onClick={() => handleLevelUp(entry.rosterId)}>
                    Level Up (1 pt)
                  </button>
                  {node && (
                    <div className="training-row">
                      <span className="hint">Rank-up ready — choose a branch:</span>
                      {node.branches.map((branch) => (
                        <button
                          key={branch.id}
                          className={`rankup-branch-button rankup-${branch.kind}`}
                          onClick={() => onRunChange(chooseRankUpBranch(run, progressionTable, heroes, entry.rosterId, branch.id))}
                        >
                          <span className="rankup-branch-name">{branch.name}</span>
                          <span className="rankup-branch-kind">{branch.kind}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <button className="resolve-button" disabled={run.levelUpPool > 0 || !!offer} onClick={onDone}>
        Continue
      </button>
    </div>
  );
}
