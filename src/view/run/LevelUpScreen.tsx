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
  availableEvolution,
  chooseEvolutionPath,
  rosterEntryTypes,
  MOVE_CAP,
  ProgressionError,
} from '../../run/progression';
import { getTypeColor } from '../combat/typeColors';
import { MoveTile, MoveInfoPanel, CategoryBadge, useLongPress } from '../shared/MoveTile';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { EvolutionScreen } from './EvolutionScreen';

/**
 * One existing move in the move-replace offer's picker — same roster-card
 * layout as before (name + type/category badges, "picked" highlight), but
 * now a standalone component rather than an inline .map() callback: it needs
 * its own useLongPress call, and hooks can't be called inside a loop body.
 * Long-press opens the shared move-detail popup (see `movePopup` below,
 * the same one LevelUpScreen's main hero list already uses) instead of the
 * old hover-driven fixed panel — tap still just selects/deselects the
 * replacement target.
 */
function ReplaceMoveCard({
  move,
  selected,
  onSelect,
  onLongPress,
}: {
  move: MoveDefinition;
  selected: boolean;
  onSelect: () => void;
  onLongPress: () => void;
}) {
  const longPress = useLongPress(onLongPress, onSelect);
  return (
    <button className={`roster-card${selected ? ' picked' : ''}`} style={{ borderLeftColor: getTypeColor(move.type) }} {...longPress}>
      <div className="roster-card-name">{move.name}</div>
      <div className="roster-card-types">
        <TypeBadge type={move.type} />
        <CategoryBadge category={move.category} />
      </div>
    </button>
  );
}

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onDone: () => void;
}

interface MoveOffer {
  rosterId: string;
  moveId: string;
}

/**
 * Forced immediately-after-battle spend screen (CLAUDE.md "After winning a
 * fight, you are given training points that must be instantly allocated
 * before the run continues"). Every Training Point earned must be put into a
 * hero here before Continue unlocks — replaces the old "spend whenever, via
 * Manage Roster" flow. Manage Roster (RosterManagementScreen) is now
 * inspection/equipment-only and never spends the pool.
 *
 * Each hero card is itself the level-up button — tapping it spends the point
 * immediately (an earlier confirm-dialog step was removed for slowing down the
 * flow). Move details, both here and in the move-replace offer's picker
 * (ReplaceMoveCard below), are read via a
 * long-press on the move (mirrors FightScreen's move-button long-press)
 * rather than a persistent info panel that tracked whatever was last
 * hovered/tapped — that used to reserve a large fixed box at the top of the
 * screen and was the main source of scroll on a full 6-hero roster.
 */
export function LevelUpScreen({ run, onRunChange, onDone }: Props) {
  const [offer, setOffer] = useState<MoveOffer | null>(null);
  /** The move offer's currently-highlighted replacement target — a click selects it, but nothing is applied until Confirm. */
  const [selectedReplaceId, setSelectedReplaceId] = useState<string | null>(null);
  /** Which roster entry, if any, has taken over the screen with its full-screen Evolution choice (see EvolutionScreen). */
  const [evolvingRosterId, setEvolvingRosterId] = useState<string | null>(null);
  /** Long-press-triggered move detail popup — shared by both the main hero list and the move-replace offer's picker (see MoveTile/ReplaceMoveCard's onLongPress). */
  const [movePopup, setMovePopup] = useState<{ moveId: string; label: string } | null>(null);

  function handleLevelUp(rosterId: string) {
    if (run.levelUpPool < 1) return;
    const entry = run.roster.find((r) => r.rosterId === rosterId);
    if (!entry) return;
    const pool = levelUpMovePool(progressionTable, entry);
    const wasAtCap = entry.unlockedMoveIds.length >= MOVE_CAP;

    let next: RunState;
    try {
      next = levelUpHero(run, rosterId);
    } catch (err) {
      if (err instanceof ProgressionError) return;
      throw err;
    }

    // Evolution replaces the move offer, not adds to it
    // (docs/leveling-and-ranks.md "the hero is not offered a new move" at
    // Evolution) — if this level-up left an Evolution pending, skip the move
    // roll entirely and hand off to the full-screen EvolutionScreen instead.
    const nextEntry = next.roster.find((r) => r.rosterId === rosterId)!;
    if (availableEvolution(progressionTable, nextEntry)) {
      onRunChange(next);
      setEvolvingRosterId(rosterId);
      return;
    }

    if (pool.length === 0) {
      onRunChange(next);
      return;
    }

    const moveId = pool[Math.floor(Math.random() * pool.length)];
    if (!wasAtCap) {
      onRunChange(grantLevelUpMove(next, rosterId, moveId));
    } else {
      onRunChange(next);
      setOffer({ rosterId, moveId });
      setSelectedReplaceId(null);
    }
  }

  function resolveOffer(replaceMoveId: string | null) {
    if (!offer) return;
    if (replaceMoveId) {
      onRunChange(grantLevelUpMove(run, offer.rosterId, offer.moveId, replaceMoveId));
    }
    setOffer(null);
    setSelectedReplaceId(null);
  }

  function handleChooseEvolution(rosterId: string, pathId: string) {
    onRunChange(chooseEvolutionPath(run, progressionTable, heroes, rosterId, pathId));
    setEvolvingRosterId(null);
  }

  const offerEntry = offer ? (run.roster.find((r) => r.rosterId === offer.rosterId) ?? null) : null;

  const evolvingEntry = evolvingRosterId ? (run.roster.find((r) => r.rosterId === evolvingRosterId) ?? null) : null;
  const evolvingNode = evolvingEntry ? availableEvolution(progressionTable, evolvingEntry) : null;
  if (evolvingEntry && evolvingNode) {
    return (
      <EvolutionScreen
        hero={heroes[evolvingEntry.heroId]}
        entry={evolvingEntry}
        node={evolvingNode}
        onChoose={(pathId) => handleChooseEvolution(evolvingEntry.rosterId, pathId)}
      />
    );
  }

  return (
    <div className="node-screen">
      <div className="screen-scroll">
        <div className="levelup-header">
          <h2 className="levelup-header-title">Level Up</h2>
          <div className="levelup-pool-badge" title="Training points still to spend">
            <span className="levelup-pool-count">{run.levelUpPool}</span>
            <span className="levelup-pool-label">{run.levelUpPool === 1 ? 'pt left' : 'pts left'}</span>
          </div>
        </div>

        {offer && offerEntry ? (
          <div className="reward-panel">
            <div className="offer-hero-head">
              <HeroPortrait heroId={heroes[offerEntry.heroId].id} className="training-hero-portrait" />
              <h3>{heroes[offerEntry.heroId].name}</h3>
            </div>
            <p className="offer-hero-sub">
              Already knows {MOVE_CAP} moves — pick one to replace, or decline.
            </p>
            {/* The offered move itself — permanent for as long as the offer is
                open (unlike the old hover-driven panel this replaced), so the
                player always sees what they'd be learning. The glow marks it
                as the screen's headline info, distinct from the plain
                replace-candidate cards below. */}
            <div className="offer-move-highlight">
              <MoveInfoPanel move={moves[offer.moveId]} label="New move offered" />
            </div>
            <div className="offer-swap-arrow" aria-hidden="true">
              ↓ replaces one of
            </div>
            <div className="roster-grid">
              {offerEntry.unlockedMoveIds.map((moveId) => (
                <ReplaceMoveCard
                  key={moveId}
                  move={moves[moveId]}
                  selected={selectedReplaceId === moveId}
                  onSelect={() => setSelectedReplaceId(moveId)}
                  onLongPress={() => setMovePopup({ moveId, label: `${heroes[offerEntry.heroId].name} — current move` })}
                />
              ))}
            </div>
            <div className="reward-panel-actions">
              <button className="secondary-button" onClick={() => resolveOffer(null)}>
                Decline — keep current moves
              </button>
              <button className="resolve-button" disabled={!selectedReplaceId} onClick={() => resolveOffer(selectedReplaceId)}>
                {selectedReplaceId ? `Confirm — Learn ${moves[offer.moveId].name}` : 'Pick a move to replace'}
              </button>
            </div>
          </div>
        ) : (
          <div className="training-hero-list">
            {run.roster.map((entry) => {
              const hero = heroes[entry.heroId];
              const node = availableEvolution(progressionTable, entry);
              // A pending Evolution takes priority over spending another
              // point — tapping the card opens EvolutionScreen instead of
              // leveling up again, so the choice can't be buried under a
              // stack of unresolved levels.
              const canLevelUp = run.levelUpPool >= 1 && !node;
              const canAct = canLevelUp || !!node;
              return (
                <div
                  key={entry.rosterId}
                  className={`training-hero${canAct ? '' : ' training-hero-disabled'}${node ? ' training-hero-evolving' : ''}`}
                  style={{ borderLeftColor: getTypeColor(hero.types[0]) }}
                  role="button"
                  tabIndex={canAct ? 0 : -1}
                  aria-disabled={!canAct}
                  onClick={() => {
                    if (node) setEvolvingRosterId(entry.rosterId);
                    else if (canLevelUp) handleLevelUp(entry.rosterId);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (node) setEvolvingRosterId(entry.rosterId);
                      else if (canLevelUp) handleLevelUp(entry.rosterId);
                    }
                  }}
                >
                  <div className="training-hero-head">
                    <div className="training-hero-title">
                      <HeroPortrait heroId={hero.id} className="training-hero-portrait" />
                      <div className="training-hero-name-block">
                        <div className="training-hero-name-row">
                          <h3>{hero.name}</h3>
                          <span className="training-hero-level">Lv {entry.level}</span>
                        </div>
                        <div className="training-hero-types">
                          {rosterEntryTypes(hero, entry).map((t) => (
                            <TypeBadge key={t} type={t} />
                          ))}
                        </div>
                      </div>
                    </div>
                    <span className="training-hero-cta">
                      {node ? '⚡ Ready to evolve!' : canLevelUp ? 'Tap to level up' : 'No points'}
                    </span>
                  </div>
                  <div className="move-tile-row">
                    {entry.unlockedMoveIds.map((moveId) =>
                      moves[moveId] ? (
                        <MoveTile key={moveId} move={moves[moveId]} onLongPress={() => setMovePopup({ moveId, label: hero.name })} />
                      ) : null
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <button
        className="resolve-button"
        disabled={run.levelUpPool > 0 || !!offer || run.roster.some((entry) => !!availableEvolution(progressionTable, entry))}
        onClick={onDone}
      >
        Continue
      </button>

      {/* Long-press-triggered move detail popup (MoveTile's onLongPress) — reuses .log-overlay/.log-panel like FightScreen's move-button popup, including "tap anywhere to close" (no stopPropagation on the panel). */}
      {movePopup && (
        <div className="log-overlay" onClick={() => setMovePopup(null)}>
          <div className="log-panel move-popup-panel">
            <MoveInfoPanel move={moves[movePopup.moveId]} label={movePopup.label} />
            <div className="move-popup-hint">Tap anywhere to close</div>
          </div>
        </div>
      )}
    </div>
  );
}
