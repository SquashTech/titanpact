import { useEffect, useRef, useState } from 'react';
import { heroes } from '../../data/heroes';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import {
  levelUpHero,
  levelUpCost,
  canAffordAnyLevelUp,
  levelUpMovePool,
  grantLevelUpMove,
  availableEvolution,
  pendingEvolution,
  chosenEvolutionPaths,
  chooseEvolutionPath,
  applyEvolutionMoves,
  MOVE_CAP,
  MASTERY_STAT_AMOUNT,
  drawMasteryStats,
  grantMasteryStat,
  levelUpPayout,
  ProgressionError,
  type EvolutionNode,
} from '../../run/progression';
import { deferLevelUp } from '../../run/runProgress';
import { MoveButtonReplica, useLongPress } from '../shared/MoveTile';
import { STAT_LABELS, STAT_COLORS, StatGlyph } from '../shared/StatBars';
import { entryStatTotals } from '../shared/entryStatTotals';
import { healCasterForEntry } from '../shared/healCaster';
import { MoveDetailCard } from '../combat/MoveDetailOverlay';
import { HeroPortrait } from '../shared/HeroPortrait';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { NodeHeader, NodeSky } from '../shared/NodeStage';
import { equipment } from '../../data/equipment';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterPeek } from './RosterPeek';
import { EvolutionScreen } from './EvolutionScreen';
import { playSfx } from '../../audio/sfx';
import { prefersReducedMotion } from '../shared/reducedMotion';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onDone: () => void;
}

interface MoveOffer {
  rosterId: string;
  moveId: string;
}

/** A mastery level-up's three rolled stats. The level is already banked; there is no decline. */
interface MasteryOffer {
  rosterId: string;
  stats: StatKey[];
}

/** What one Training Point buys this hero, in display-priority order. */
type Payoff = 'evolve' | 'brink' | 'move' | 'swap' | 'mastery';

/** Short on purpose: 9px uppercase in a ~100px card. */
const PAYOFF_LABEL: Record<Payoff, string> = {
  evolve: 'Evolve!',
  brink: 'Evolve next',
  move: 'New move',
  swap: 'Move swap',
  mastery: '+10 stat',
};

function payoffFor(entry: RosterEntry): Payoff {
  if (availableEvolution(progressionTable, entry)) return 'evolve';
  const pending = pendingEvolution(progressionTable, entry);
  if (pending && entry.level + 1 >= pending.level) return 'brink';
  // Asked of the level the point WOULD reach — move tiers and mastery are both level-gated.
  const payout = levelUpPayout(progressionTable, moves, { ...entry, level: entry.level + 1 });
  if (payout === 'mastery') return 'mastery';
  return entry.unlockedMoveIds.length >= MOVE_CAP ? 'swap' : 'move';
}

interface GrowthCardProps {
  hero: HeroDefinition;
  entry: RosterEntry;
  node: EvolutionNode | null;
  /** The pool cannot cover this hero's next level — the card says why it is disabled. */
  unaffordable: boolean;
  canAct: boolean;
  isAnimating: boolean;
  onActivate: () => void;
  onPreview: () => void;
}

// Tap levels up (or opens Evolution); hold opens the full hero sheet.
function GrowthCard({ hero, entry, node, unaffordable, canAct, isAnimating, onActivate, onPreview }: GrowthCardProps) {
  const payoff = payoffFor(entry);
  // An earned Evolution was paid for by the level-up that reached it.
  const cost = node ? null : levelUpCost(entry.level);
  const pending = pendingEvolution(progressionTable, entry);
  const takenPaths = pending ? [] : chosenEvolutionPaths(progressionTable, entry);
  const chosenPath = takenPaths[takenPaths.length - 1] ?? null;
  const filled = pending ? Math.min(entry.level, pending.level) : 0;

  return (
    <HeroPickCard
      hero={hero}
      entry={entry}
      className={['growth-card', node ? 'is-evolving' : '', payoff === 'brink' && canAct ? 'is-brink' : '', isAnimating ? 'is-leveling' : '']
        .filter(Boolean)
        .join(' ')}
      disabled={!canAct}
      onActivate={onActivate}
      onPreview={onPreview}
      ariaLabel={`${hero.name}, level ${entry.level} — ${PAYOFF_LABEL[payoff]}${cost === null ? '' : `, costs ${cost} XP`}`}
      overlay={
        <>
          {cost !== null && (
            <span className={`growth-cost${unaffordable ? ' is-unaffordable' : ''}`} aria-hidden="true">
              {cost}
            </span>
          )}
          {/* Mounted only while the timer runs — mounting is what starts the animation. */}
          {isAnimating && <span className="growth-charge" aria-hidden="true" />}
        </>
      }
      detail={
        <span className="growth-track">
          {pending
            ? Array.from({ length: pending.level }, (_, i) => {
                const isLast = i === pending.level - 1;
                const isFilled = i < filled;
                // Remount only the frontier pip on a level change so only it replays the seal.
                return (
                  <span
                    key={i === filled - 1 ? `${i}-${entry.level}` : `${i}`}
                    className={`growth-pip${isFilled ? ' filled' : ''}${isLast ? ' evo' : ''}`}
                  />
                );
              })
            : chosenPath && <span className="growth-path">{chosenPath.name}</span>}
        </span>
      }
      ctaClassName={`payoff-${payoff}`}
      cta={isAnimating ? 'Training…' : PAYOFF_LABEL[payoff]}
    />
  );
}

/** `current` includes equipment, Evolution, map-node and earlier mastery grants. */
function MasteryStatOption({ stat, current, onPick }: { stat: StatKey; current: number; onPick: () => void }) {
  return (
    <button className="mastery-option" onClick={onPick}>
      <span className="mastery-option-glyph" aria-hidden="true">
        <StatGlyph stat={stat} />
      </span>
      <span className="mastery-option-label">{STAT_LABELS[stat]}</span>
      <span className="mastery-option-math">
        <span className="mastery-option-from">{current}</span>
        <span className="mastery-option-arrow" aria-hidden="true">
          →
        </span>
        <span className="mastery-option-to" style={{ color: STAT_COLORS[stat] }}>
          {current + MASTERY_STAT_AMOUNT}
        </span>
      </span>
    </button>
  );
}

function OfferHeroHead({ hero, onPreview }: { hero: HeroDefinition; onPreview: () => void }) {
  const longPress = useLongPress(onPreview);
  return (
    <div className="offer-hero-head" {...longPress}>
      <HeroPortrait heroId={hero.id} className="offer-hero-portrait" />
      <h3>{hero.name}</h3>
    </div>
  );
}

/** Charge animation length (styles.css growth-charge-fill); the level-up itself waits for it. */
const LEVEL_UP_ANIM_MS = 550;

/** Linger after the last point resolves so the final readout can be read; there is no Continue button. */
const AUTO_CONTINUE_MS = 1250;

/** Arrival beat: orbs land one at a time, then the roster wakes. */
const ORB_LEAD_MS = 300;
const ORB_STAGGER_MS = 130;
const ORB_SETTLE_MS = 340;
/** Past this the header falls back to a count, which has nothing to stagger. */
const ORB_TRACK_MAX = 12;

/** The card wake stagger plus its longest delay (styles.css .pick-grid.is-waking). */
const GRID_WAKE_MS = 700;

// Forced post-battle spend screen. Each hero card is itself the level-up
// button; RosterManagementScreen never spends the pool.
export function LevelUpScreen({ run, onRunChange, onDone }: Props) {
  const [offer, setOffer] = useState<MoveOffer | null>(null);
  /** Only an Evolution can grant more than one move at once; each waits its turn behind `offer`. */
  const [offerQueue, setOfferQueue] = useState<string[]>([]);
  /** Mutually exclusive with `offer` in practice — one level-up pays out a move or a stat. */
  const [masteryOffer, setMasteryOffer] = useState<MasteryOffer | null>(null);
  const [selectedReplaceId, setSelectedReplaceId] = useState<string | null>(null);
  const [evolvingRosterId, setEvolvingRosterId] = useState<string | null>(null);
  const [movePopup, setMovePopup] = useState<{ moveId: string; label: string } | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  /** Card mid charge animation; blocks a second level-up until it finishes. */
  const [animatingRosterId, setAnimatingRosterId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Read once via a ref so the orb track keeps a stable width while it empties.
  const startingPool = useRef(run.levelUpPool);
  const orbCount = Math.max(startingPool.current, run.levelUpPool);

  /** Zero skips the arrival beat outright (empty pool, or too many orbs to draw). */
  const introOrbs = startingPool.current > 0 && startingPool.current <= ORB_TRACK_MAX ? startingPool.current : 0;
  const [arrivedOrbs, setArrivedOrbs] = useState(introOrbs > 0 ? 0 : orbCount);
  const [introDone, setIntroDone] = useState(introOrbs === 0);

  useEffect(() => {
    if (introOrbs === 0) return;
    if (prefersReducedMotion()) {
      setArrivedOrbs(introOrbs);
      setIntroDone(true);
      return;
    }
    const timers: number[] = [];
    for (let i = 0; i < introOrbs; i++) {
      timers.push(
        window.setTimeout(() => {
          setArrivedOrbs(i + 1);
          playSfx('xp.orb', { pitch: 1 + Math.min(i, 7) * 0.06 });
        }, ORB_LEAD_MS + i * ORB_STAGGER_MS)
      );
    }
    timers.push(window.setTimeout(() => setIntroDone(true), ORB_LEAD_MS + introOrbs * ORB_STAGGER_MS + ORB_SETTLE_MS));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [introOrbs]);

  /**
   * The arrival beat plays once. A move offer unmounts the grid, and replaying the
   * stagger on the way back would re-introduce a roster the player never left.
   */
  const [wakeDone, setWakeDone] = useState(false);
  useEffect(() => {
    if (!introDone || wakeDone) return;
    const timer = window.setTimeout(() => setWakeDone(true), GRID_WAKE_MS);
    return () => window.clearTimeout(timer);
  }, [introDone, wakeDone]);

  /** Called after the charge animation (handleCardClick), never directly from a click. */
  function applyLevelUp(rosterId: string) {
    const entry = run.roster.find((r) => r.rosterId === rosterId);
    if (!entry) return;
    const heroName = heroes[entry.heroId].name;
    const wasAtCap = entry.unlockedMoveIds.length >= MOVE_CAP;

    let next: RunState;
    try {
      next = levelUpHero(run, rosterId);
    } catch (err) {
      if (err instanceof ProgressionError) return;
      throw err;
    }

    playSfx('levelUp');

    // Evolution replaces the move offer (docs/leveling-and-ranks.md).
    const nextEntry = next.roster.find((r) => r.rosterId === rosterId)!;
    if (availableEvolution(progressionTable, nextEntry)) {
      onRunChange(next);
      setEvolvingRosterId(rosterId);
      return;
    }

    // Level banked now, grant waits on the pick — same split as the move offer.
    if (levelUpPayout(progressionTable, moves, nextEntry) === 'mastery') {
      onRunChange(next);
      setFeedback(null);
      setMasteryOffer({ rosterId, stats: drawMasteryStats(Math.random) });
      return;
    }

    // Rolled off the post-level-up entry: the new level decides which tiers are open.
    const pool = levelUpMovePool(progressionTable, moves, nextEntry);
    const moveId = pool[Math.floor(Math.random() * pool.length)];
    if (!wasAtCap) {
      onRunChange(grantLevelUpMove(next, rosterId, moveId));
      setFeedback(`${heroName} reached Lv ${nextEntry.level} and learned ${moves[moveId].name}!`);
    } else {
      onRunChange(next);
      setFeedback(null);
      setOffer({ rosterId, moveId });
      setSelectedReplaceId(null);
    }
  }

  function handleCardClick(rosterId: string) {
    if (animatingRosterId) return;
    const entry = run.roster.find((r) => r.rosterId === rosterId);
    if (!entry) return;
    if (availableEvolution(progressionTable, entry)) {
      setEvolvingRosterId(rosterId);
      return;
    }
    if (run.levelUpPool < levelUpCost(entry.level)) return;
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
    setOffer(offerQueue.length > 0 ? { rosterId: offer.rosterId, moveId: offerQueue[0] } : null);
    setOfferQueue(offerQueue.slice(1));
    setSelectedReplaceId(null);
  }

  function resolveMasteryOffer(stat: StatKey) {
    if (!masteryOffer) return;
    const entry = run.roster.find((r) => r.rosterId === masteryOffer.rosterId);
    if (!entry) return;
    onRunChange(grantMasteryStat(run, masteryOffer.rosterId, stat));
    setFeedback(
      `${heroes[entry.heroId].name} reached Lv ${entry.level} — +${MASTERY_STAT_AMOUNT} ${STAT_LABELS[stat]}!`
    );
    setMasteryOffer(null);
  }

  function handleChooseEvolution(rosterId: string, pathId: string) {
    const entry = run.roster.find((r) => r.rosterId === rosterId);
    const path = entry
      ? (availableEvolution(progressionTable, entry)?.paths.find((p) => p.id === pathId) ?? null)
      : null;
    // Read BEFORE the choice lands: the path's moves that MOVE_CAP refused become the same
    // replace-or-decline offer a level-up makes, one at a time.
    const overflow = entry && path ? applyEvolutionMoves(entry.unlockedMoveIds, path.unlocksMoveIds).overflow : [];

    onRunChange(chooseEvolutionPath(run, progressionTable, heroes, rosterId, pathId));
    setEvolvingRosterId(null);
    if (overflow.length > 0) {
      setOfferQueue(overflow.slice(1));
      setOffer({ rosterId, moveId: overflow[0] });
      setSelectedReplaceId(null);
    }
  }

  const pendingEvolutions = run.roster.filter((entry) => !!availableEvolution(progressionTable, entry)).length;

  // Affordability, not emptiness: a leftover that buys nobody banks (CLAUDE.md).
  const canAffordAny = canAffordAnyLevelUp(run);

  // The overlay checks matter: a player holding a card to read a sheet must
  // not have the screen pulled out from under them.
  const done =
    introDone &&
    !canAffordAny &&
    pendingEvolutions === 0 &&
    !offer &&
    !masteryOffer &&
    !animatingRosterId &&
    !evolvingRosterId &&
    !movePopup &&
    !previewEntry;

  // The out: a pool that buys nobody leaves on its own, and this is for one the player
  // wants to keep. Evolutions are excluded — those are already paid for, not a spend.
  const canBank =
    introDone && canAffordAny && pendingEvolutions === 0 && !offer && !masteryOffer && !animatingRosterId && !evolvingRosterId;

  function handleBank() {
    playSfx('ui.page');
    onRunChange(deferLevelUp(run));
    onDone();
  }

  // Ref, so the effect depends on `done` alone — App.tsx passes an inline arrow.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => {
      playSfx('ui.page');
      onDoneRef.current();
    }, AUTO_CONTINUE_MS);
    return () => window.clearTimeout(timer);
  }, [done]);

  const offerEntry = offer ? (run.roster.find((r) => r.rosterId === offer.rosterId) ?? null) : null;
  const offerCaster = offerEntry ? healCasterForEntry(heroes[offerEntry.heroId], offerEntry, run.relics) : undefined;

  const masteryEntry = masteryOffer ? (run.roster.find((r) => r.rosterId === masteryOffer.rosterId) ?? null) : null;
  const masteryTotals = masteryEntry ? entryStatTotals(heroes[masteryEntry.heroId], masteryEntry, run.relics) : null;

  const evolvingEntry = evolvingRosterId ? (run.roster.find((r) => r.rosterId === evolvingRosterId) ?? null) : null;
  const evolvingNode = evolvingEntry ? availableEvolution(progressionTable, evolvingEntry) : null;
  if (evolvingEntry && evolvingNode) {
    return (
      <EvolutionScreen
        hero={heroes[evolvingEntry.heroId]}
        entry={evolvingEntry}
        node={evolvingNode}
        run={run}
        onChoose={(pathId) => handleChooseEvolution(evolvingEntry.rosterId, pathId)}
      />
    );
  }

  return (
    <div className="levelup-screen">
      <NodeSky />

      <RosterPeek run={run} />

      {!offer && !masteryOffer && (
        <NodeHeader
          eyebrow="Growth Phase"
          title="Level Up"
          readoutKey={introDone ? (feedback ?? 'idle') : 'arriving'}
          readoutLive={!introDone || !!feedback}
          readout={
            !introDone
              ? `${startingPool.current} ${startingPool.current === 1 ? 'point' : 'points'} earned.`
              : feedback ??
                (pendingEvolutions > 0
                  ? `${pendingEvolutions === 1 ? 'A hero is' : `${pendingEvolutions} heroes are`} ready to evolve — tap to choose a path.`
                  : canAffordAny
                    ? 'Tap a hero to spend. A level costs as much as the hero has — hold to review its sheet.'
                    : run.levelUpPool >= 1
                      ? `${run.levelUpPool} XP banked — not enough for anyone yet. Moving on.`
                      : 'Every point is spent — moving on.')
          }
        >
          {orbCount > ORB_TRACK_MAX ? (
            <div className="levelup-orb-count">
              <span className="levelup-orb filled" aria-hidden="true" />
              <span>{run.levelUpPool} XP to spend</span>
            </div>
          ) : (
            <div className="levelup-orbs" aria-label={`${run.levelUpPool} of ${orbCount} XP left to spend`}>
              {Array.from({ length: orbCount }, (_, i) => (
                <span
                  key={i}
                  className={`levelup-orb${i >= arrivedOrbs ? ' unarrived' : i < run.levelUpPool ? ' filled' : ' spent'}`}
                />
              ))}
            </div>
          )}
        </NodeHeader>
      )}

      {masteryOffer && masteryEntry && masteryTotals ? (
        <div className="screen-scroll moveoffer-stage">
          <div className="stage-centered">
            <div className="reward-panel mastery-panel">
              <OfferHeroHead
                hero={heroes[masteryEntry.heroId]}
                onPreview={() => setPreviewEntry({ hero: heroes[masteryEntry.heroId], entry: masteryEntry })}
              />
              <p className="offer-hero-sub">
                Lv {masteryEntry.level} — the movepool is spent. Pick a stat to raise, permanently.
              </p>
              <div className="mastery-options">
                {masteryOffer.stats.map((stat) => (
                  <MasteryStatOption
                    key={stat}
                    stat={stat}
                    current={masteryTotals[stat]}
                    onPick={() => resolveMasteryOffer(stat)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : offer && offerEntry ? (
        <div className="screen-scroll moveoffer-stage">
          <div className="stage-centered">
            <div className="reward-panel">
              <OfferHeroHead
                hero={heroes[offerEntry.heroId]}
                onPreview={() => setPreviewEntry({ hero: heroes[offerEntry.heroId], entry: offerEntry })}
              />
              <p className="offer-hero-sub">Already knows {MOVE_CAP} moves — pick one to replace, or decline.</p>
              <div className="offer-move-highlight">
                <MoveDetailCard
                  move={moves[offer.moveId]}
                  label="New move offered"
                  caster={offerCaster}
                />
              </div>
              <div className="offer-swap-arrow" aria-hidden="true">
                ↓ replaces one of
              </div>
              <div className="move-list offer-replace-list">
                {offerEntry.unlockedMoveIds.map((moveId) => (
                  <MoveButtonReplica
                    key={moveId}
                    move={moves[moveId]}
                    selected={selectedReplaceId === moveId}
                    caster={offerCaster}
                    onClick={() => setSelectedReplaceId(moveId)}
                    onLongPress={() => setMovePopup({ moveId, label: `${heroes[offerEntry.heroId].name} — current move` })}
                  />
                ))}
              </div>
              <div className="reward-panel-actions moveoffer-actions">
                <button className="moveoffer-button moveoffer-decline" onClick={() => resolveOffer(null)}>
                  <span className="moveoffer-icon" aria-hidden="true">
                    ✕
                  </span>
                  <span className="moveoffer-label">Decline</span>
                  <span className="moveoffer-sub">Keep current moves</span>
                </button>
                <button
                  className="moveoffer-button moveoffer-confirm"
                  disabled={!selectedReplaceId}
                  onClick={() => resolveOffer(selectedReplaceId)}
                >
                  <span className="moveoffer-icon" aria-hidden="true">
                    ✓
                  </span>
                  <span className="moveoffer-label">Confirm</span>
                  <span className="moveoffer-sub">
                    {selectedReplaceId ? `Learn ${moves[offer.moveId].name}` : 'Pick a move first'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Rendered dark rather than mounted on `introDone`, so nothing shifts when it wakes. */
        <HeroPickGrid count={run.roster.length} fill className={introDone ? (wakeDone ? '' : 'is-waking') : 'is-asleep'}>
          {run.roster.map((entry) => {
            const hero = heroes[entry.heroId];
            const node = availableEvolution(progressionTable, entry);
            const isAnimating = animatingRosterId === entry.rosterId;
            // `introDone` is a real lock, not just pointer-events: the cards are keyboard-reachable.
            const blockedByOtherAnim = !!animatingRosterId && !isAnimating;
            const affordable = run.levelUpPool >= levelUpCost(entry.level);
            const canLevelUp = introDone && affordable && !node && !blockedByOtherAnim;
            const canAct = introDone && (canLevelUp || !!node) && !blockedByOtherAnim;
            return (
              <GrowthCard
                key={entry.rosterId}
                hero={hero}
                entry={entry}
                node={node}
                unaffordable={!node && !affordable}
                canAct={canAct}
                isAnimating={isAnimating}
                onActivate={() => {
                  if (node) setEvolvingRosterId(entry.rosterId);
                  else if (canLevelUp) handleCardClick(entry.rosterId);
                }}
                onPreview={() => setPreviewEntry({ hero, entry })}
              />
            );
          })}
        </HeroPickGrid>
      )}

      {/* Kept in the layout even when it cannot be pressed. The grid centres in
          whatever room is left under it, so unmounting the button — for the half
          second a card spends charging, or the moment the pool runs dry — would
          slide the whole roster down under the player's own thumb. */}
      {!offer && !masteryOffer && (
        <button
          className={`secondary-button levelup-bank-button${canBank ? '' : ' is-inert'}`}
          onClick={handleBank}
          disabled={!canBank}
        >
          Bank {run.levelUpPool} XP for later
        </button>
      )}

      {movePopup && (
        <div className="log-overlay" onClick={() => setMovePopup(null)}>
          <div className="log-panel move-popup-panel">
            <MoveDetailCard
              move={moves[movePopup.moveId]}
              label={movePopup.label}
              caster={offerCaster}
            />
            <div className="move-popup-hint">Tap anywhere to close</div>
          </div>
        </div>
      )}

      {previewEntry && (
        <HeroPreviewOverlay
          hero={previewEntry.hero}
          entry={previewEntry.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          onClose={() => setPreviewEntry(null)}
        />
      )}
    </div>
  );
}
