import { useState } from 'react';
import { heroes } from '../../data/heroes';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
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
import { MoveInfoPanel, MoveButtonReplica } from '../shared/MoveTile';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { equipment } from '../../data/equipment';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { EvolutionScreen } from './EvolutionScreen';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onDone: () => void;
}

interface MoveOffer {
  rosterId: string;
  moveId: string;
}

/** Duration of the level-up fill-bar's tactile animation (styles.css @keyframes hero-grid-levelup-fill) — the actual level-up (and any resulting screen transition, e.g. to the move-replace offer or Evolution) is deferred until it completes. */
const LEVEL_UP_ANIM_MS = 550;

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
  /** Long-press-triggered move detail popup — shared by both the main hero list and the move-replace offer's picker. */
  const [movePopup, setMovePopup] = useState<{ moveId: string; label: string } | null>(null);
  /** Info-button-triggered full hero sheet (HeroPreviewOverlay) — the main hero grid no longer shows moves inline, so this is the only way to see a hero's current moves/stats/gear from this screen. */
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  /** Roster id whose card is mid level-up fill-bar animation, if any — blocks starting another level-up until it finishes (see LEVEL_UP_ANIM_MS/applyLevelUp below). */
  const [animatingRosterId, setAnimatingRosterId] = useState<string | null>(null);
  /** "X leveled up and learned Y!" readout, set once the animated level-up actually resolves — re-added per user direction so a level-up's outcome is visible on-screen again instead of only inferable from the card's new Lv/moves. */
  const [feedback, setFeedback] = useState<string | null>(null);

  /** The actual level-up effect — spends the pooled point and applies whatever it rolled. Called after the tactile fill-bar animation finishes (see handleCardClick), never directly from a click, so a screen transition it triggers (the move-replace offer, or handing off to EvolutionScreen) always happens after the animation rather than cutting it off. */
  function applyLevelUp(rosterId: string) {
    const entry = run.roster.find((r) => r.rosterId === rosterId);
    if (!entry) return;
    const heroName = heroes[entry.heroId].name;
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
      setFeedback(`${heroName} leveled up to Lv ${nextEntry.level}!`);
      return;
    }

    const moveId = pool[Math.floor(Math.random() * pool.length)];
    if (!wasAtCap) {
      onRunChange(grantLevelUpMove(next, rosterId, moveId));
      setFeedback(`${heroName} leveled up to Lv ${nextEntry.level} and learned ${moves[moveId].name}!`);
    } else {
      onRunChange(next);
      setFeedback(null);
      setOffer({ rosterId, moveId });
      setSelectedReplaceId(null);
    }
  }

  /** Tapping a hero card: an Evolution-ready card jumps straight to EvolutionScreen (that choice was already earned by an earlier level-up, so there's nothing to animate here); otherwise play the fill-bar animation and only apply the level-up once it completes. Ignored while another card's animation is still running, so points can't be double-spent mid-animation. */
  function handleCardClick(rosterId: string) {
    if (animatingRosterId) return;
    const entry = run.roster.find((r) => r.rosterId === rosterId);
    if (!entry) return;
    if (availableEvolution(progressionTable, entry)) {
      setEvolvingRosterId(rosterId);
      return;
    }
    if (run.levelUpPool < 1) return;
    setFeedback(null);
    setAnimatingRosterId(rosterId);
    window.setTimeout(() => {
      applyLevelUp(rosterId);
      setAnimatingRosterId(null);
    }, LEVEL_UP_ANIM_MS);
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
        <div className="bottom-pinned">
        <div className="levelup-header">
          <h2 className="levelup-header-title">Level Up</h2>
          <div className="levelup-pool-badge" title="XP still to spend">
            <span className="levelup-pool-count">{run.levelUpPool}</span>
            <span className="levelup-pool-label">{run.levelUpPool === 1 ? 'pt left' : 'pts left'}</span>
          </div>
        </div>

        {!offer && feedback && <div className="levelup-feedback">{feedback}</div>}

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
            <div className="move-grid offer-replace-grid">
              {offerEntry.unlockedMoveIds.map((moveId) => (
                <MoveButtonReplica
                  key={moveId}
                  move={moves[moveId]}
                  selected={selectedReplaceId === moveId}
                  onClick={() => setSelectedReplaceId(moveId)}
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
          <div className="hero-grid">
            {run.roster.map((entry) => {
              const hero = heroes[entry.heroId];
              const node = availableEvolution(progressionTable, entry);
              const isAnimating = animatingRosterId === entry.rosterId;
              // A pending Evolution takes priority over spending another
              // point — tapping the card opens EvolutionScreen instead of
              // leveling up again, so the choice can't be buried under a
              // stack of unresolved levels. Any card is briefly inert while
              // another one's fill-bar is animating, so a point can't be
              // spent mid-animation.
              const blockedByOtherAnim = !!animatingRosterId && !isAnimating;
              const canLevelUp = run.levelUpPool >= 1 && !node && !blockedByOtherAnim;
              const canAct = (canLevelUp || !!node) && !blockedByOtherAnim;
              return (
                <div
                  key={entry.rosterId}
                  className={`hero-grid-card${canAct ? '' : ' hero-grid-card-disabled'}${node ? ' hero-grid-card-evolving' : ''}${isAnimating ? ' hero-grid-card-leveling' : ''}`}
                  style={{ borderLeftColor: getTypeColor(hero.types[0]) }}
                  role="button"
                  tabIndex={canAct ? 0 : -1}
                  aria-disabled={!canAct}
                  onClick={() => {
                    if (node) setEvolvingRosterId(entry.rosterId);
                    else if (canLevelUp) handleCardClick(entry.rosterId);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (node) setEvolvingRosterId(entry.rosterId);
                      else if (canLevelUp) handleCardClick(entry.rosterId);
                    }
                  }}
                >
                  <button
                    type="button"
                    className="info-button hero-grid-info-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewEntry({ hero, entry });
                    }}
                    aria-label={`View ${hero.name} details`}
                  >
                    i
                  </button>
                  <HeroPortrait heroId={hero.id} className="hero-grid-portrait" />
                  <div className="hero-grid-name-row">
                    <span className="hero-grid-name">{hero.name}</span>
                    <span className="training-hero-level">Lv {entry.level}</span>
                  </div>
                  <div className="hero-grid-types">
                    {rosterEntryTypes(hero, entry).map((t) => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </div>
                  <span className="hero-grid-cta">
                    {isAnimating
                      ? 'Leveling up…'
                      : node
                        ? '⚡ Ready to evolve!'
                        : run.levelUpPool >= 1
                          ? 'Tap to level up'
                          : 'No points'}
                  </span>
                  {isAnimating && (
                    <div className="hero-grid-levelup-bar">
                      <div className="hero-grid-levelup-bar-fill" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>
      <button
        className="resolve-button"
        disabled={run.levelUpPool > 0 || !!offer || run.roster.some((entry) => !!availableEvolution(progressionTable, entry))}
        onClick={onDone}
      >
        Continue
      </button>

      {/* Long-press-triggered move detail popup (MoveButtonReplica's onLongPress) — reuses .log-overlay/.log-panel like FightScreen's move-button popup, including "tap anywhere to close" (no stopPropagation on the panel). */}
      {movePopup && (
        <div className="log-overlay" onClick={() => setMovePopup(null)}>
          <div className="log-panel move-popup-panel">
            <MoveInfoPanel move={moves[movePopup.moveId]} label={movePopup.label} />
            <div className="move-popup-hint">Tap anywhere to close</div>
          </div>
        </div>
      )}

      {/* Info-button-triggered full hero sheet — replaces the old inline move-tile row on each hero-grid card, which didn't fit a chunky 3x2 card. */}
      {previewEntry && (
        <HeroPreviewOverlay
          hero={previewEntry.hero}
          entry={previewEntry.entry}
          equipmentLookup={equipment}
          onClose={() => setPreviewEntry(null)}
        />
      )}
    </div>
  );
}
