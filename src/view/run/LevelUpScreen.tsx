import { useRef, useState } from 'react';
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
  pendingEvolution,
  chosenEvolutionPaths,
  chooseEvolutionPath,
  MOVE_CAP,
  ProgressionError,
  type EvolutionNode,
} from '../../run/progression';
import { MoveButtonReplica, useLongPress } from '../shared/MoveTile';
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
 * What one Training Point actually buys this hero — the single fact the
 * whole screen exists to let the player compare, and the thing the old card
 * (name / level / types / "Tap to level up") never said.
 *
 * Ordered by how much it should pull the eye: an Evolution already earned
 * outranks everything, then the level-up that *triggers* one, then the
 * ordinary move roll, then the two duds (a swap the player may not want, and
 * a hero whose pool is exhausted so the point buys a bare level).
 */
type Payoff = 'evolve' | 'brink' | 'move' | 'swap' | 'level';

/** Kept short on purpose: this sits in a ~100px card at 9px/800 uppercase, and a label that wraps or clips is worse than a vaguer one. */
const PAYOFF_LABEL: Record<Payoff, string> = {
  evolve: 'Evolve!',
  brink: 'Evolve next',
  move: 'New move',
  swap: 'Move swap',
  level: 'Level only',
};

function payoffFor(entry: RosterEntry): Payoff {
  if (availableEvolution(progressionTable, entry)) return 'evolve';
  const pending = pendingEvolution(progressionTable, entry);
  if (pending && entry.level + 1 >= pending.level) return 'brink';
  // The pool is read at the level this point WOULD reach, not the current
  // one, because move tiers are level-gated (run/progression.ts
  // MOVE_TIER_LEVEL): a level-3 hero whose Early moves are spent still has a
  // Mid move waiting, and the card must promise the move it will actually get.
  if (levelUpMovePool(progressionTable, moves, { ...entry, level: entry.level + 1 }).length === 0) return 'level';
  return entry.unlockedMoveIds.length >= MOVE_CAP ? 'swap' : 'move';
}

interface GrowthCardProps {
  hero: HeroDefinition;
  entry: RosterEntry;
  node: EvolutionNode | null;
  canAct: boolean;
  isAnimating: boolean;
  onActivate: () => void;
  onPreview: () => void;
}

/**
 * One hero on the growth roster: the shared HeroPickCard (which this card is
 * where the rest of the run loop's pick screens got theirs from — see
 * src/view/shared/HeroPickCard.tsx) carrying two things only this screen
 * has, the rank track toward Evolution as its detail row and the rising
 * charge as its overlay.
 *
 * Tap levels up (or opens Evolution); hold opens the full hero sheet, the
 * "hold to inspect" language used for moves and equipment everywhere else.
 */
function GrowthCard({ hero, entry, node, canAct, isAnimating, onActivate, onPreview }: GrowthCardProps) {
  const payoff = payoffFor(entry);
  const pending = pendingEvolution(progressionTable, entry);
  // Post-Evolution heroes have no pending node and so no track; their
  // identity line becomes the path they took, which is the more interesting
  // fact about them anyway.
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
      ariaLabel={`${hero.name}, level ${entry.level} — ${PAYOFF_LABEL[payoff]}`}
      /* The rising charge only exists while the level-up timer is running —
         mounting it is what starts its animation, so there is no stale state
         to reset between level-ups. */
      overlay={isAnimating ? <span className="growth-charge" aria-hidden="true" /> : undefined}
      /* The rank track: a fixed denominator (the pending Evolution's trigger
         level) whose shape the player learns once, exactly like the Field
         Effect plaque's duration clock and the draft's pact sockets. This is
         the answer to "who should get this point" — how far each hero is from
         the branch, readable across the whole roster at a glance. The final
         pip is the Evolution itself, drawn as a diamond. */
      detail={
        <span className="growth-track">
          {pending
            ? Array.from({ length: pending.level }, (_, i) => {
                const isLast = i === pending.level - 1;
                const isFilled = i < filled;
                // Remount the frontier pip whenever the level changes so it
                // (and only it) replays the seal animation — the rest of the
                // track holds still.
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
      /* Shown even with an empty pool — the card is visibly locked already,
         and six repetitions of "No XP" would replace the one piece of
         information on the card with a fact the header states once. What a
         hero is about to unlock stays worth reading while the player decides
         whether to press Continue. */
      ctaClassName={`payoff-${payoff}`}
      cta={isAnimating ? 'Training…' : PAYOFF_LABEL[payoff]}
    />
  );
}

/**
 * The move-replace offer's headline hero portrait/name — a plain hold (no
 * click action of its own to protect) opens the same HeroPreviewOverlay
 * sheet as the roster, so a player unsure about a swap can check the hero's
 * full loadout without leaving the offer.
 */
function OfferHeroHead({ hero, onPreview }: { hero: HeroDefinition; onPreview: () => void }) {
  const longPress = useLongPress(onPreview);
  return (
    <div className="offer-hero-head" {...longPress}>
      <HeroPortrait heroId={hero.id} className="offer-hero-portrait" />
      <h3>{hero.name}</h3>
    </div>
  );
}

/** Duration of the level-up charge animation (styles.css @keyframes growth-charge-fill) — the actual level-up (and any resulting screen transition, e.g. to the move-replace offer or Evolution) is deferred until it completes. */
const LEVEL_UP_ANIM_MS = 550;

/**
 * Forced immediately-after-battle spend screen (CLAUDE.md "After winning a
 * fight, you are given training points that must be instantly allocated
 * before the run continues"). Every Training Point earned must be put into a
 * hero here before Continue unlocks. Manage Roster
 * (RosterManagementScreen) is inspection/equipment-only and never spends the
 * pool.
 *
 * Rebuilt 2026-08-26 as the fourth pass of docs/visual-language.md's
 * no-meaningless-boxes rule, after the fight screen and the draft. What was
 * here: a bordered glowing `.levelup-banner` (a container carrying no
 * action) holding a bordered `.levelup-xp-card` (another one) above a
 * bordered `.levelup-feedback` strip that was *always* rendered — reserving
 * its own height for placeholder prose — above the one region that genuinely
 * was pressable. Three boxes of chrome to introduce one grid of buttons.
 * Underneath the styling sat the same two defects the draft pass found:
 *
 *  1. `.hero-grid-portrait` drew 48px sources at **30px** — a 0.625x scale,
 *     the fractional-downscale defect docs/visual-language.md exists to
 *     forbid. Now 48px (1x) at three columns, 96px (2x) at two.
 *  2. The cards were **empty of the decision**. Name, level, two type chips
 *     and "Tap to level up" — nothing about what the point actually buys, so
 *     picking a hero meant opening six overlays or guessing. Every card now
 *     carries a rank track toward its Evolution and a one-line payoff
 *     ("New move" / "Move swap" / "Evolution next" / "Evolve now"), which is
 *     the whole basis of the choice.
 *
 * The pool itself is now a depleting orb track rather than a numeral in a
 * card: spending a point puts one out, so the screen's central resource is
 * something the player watches drain instead of a number they re-read.
 *
 * Each hero card is itself the level-up button — tapping it spends the point
 * immediately (an earlier confirm-dialog step was removed for slowing down
 * the flow). Move details, both here and in the move-replace offer's picker,
 * are read via a long-press on the move (mirrors FightScreen's move-button
 * long-press).
 */
export function LevelUpScreen({ run, onRunChange, onDone }: Props) {
  const [offer, setOffer] = useState<MoveOffer | null>(null);
  /** The move offer's currently-highlighted replacement target — a click selects it, but nothing is applied until Confirm. */
  const [selectedReplaceId, setSelectedReplaceId] = useState<string | null>(null);
  /** Which roster entry, if any, has taken over the screen with its full-screen Evolution choice (see EvolutionScreen). */
  const [evolvingRosterId, setEvolvingRosterId] = useState<string | null>(null);
  /** Long-press-triggered move detail popup — shared by both the roster and the move-replace offer's picker. */
  const [movePopup, setMovePopup] = useState<{ moveId: string; label: string } | null>(null);
  /** Info-button-triggered full hero sheet (HeroPreviewOverlay) — the cards don't show moves inline, so this is the only way to see a hero's current moves/stats/gear from this screen. */
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  /** Roster id whose card is mid charge animation, if any — blocks starting another level-up until it finishes (see LEVEL_UP_ANIM_MS/applyLevelUp below). */
  const [animatingRosterId, setAnimatingRosterId] = useState<string | null>(null);
  /** "X leveled up and learned Y!" readout, set once the animated level-up actually resolves — so a level-up's outcome is visible on-screen instead of only inferable from the card's new level and moves. */
  const [feedback, setFeedback] = useState<string | null>(null);

  /**
   * The pool as it stood when this screen opened, so the orb track keeps a
   * stable width while it empties left-to-right — a track that shrank as it
   * drained would just be the old numeral with extra steps. Read once via a
   * ref rather than state: it must not resettle when `run` changes.
   */
  const startingPool = useRef(run.levelUpPool);
  const orbCount = Math.max(startingPool.current, run.levelUpPool);

  /** The actual level-up effect — spends the pooled point and applies whatever it rolled. Called after the charge animation finishes (see handleCardClick), never directly from a click, so a screen transition it triggers (the move-replace offer, or handing off to EvolutionScreen) always happens after the animation rather than cutting it off. */
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

    // Only once the level is actually banked — a refused level-up above
    // must stay silent, and the fanfare is timed to land on the end of the
    // card's charge animation, which is what calls this.
    playSfx('levelUp');

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

    // Rolled off the POST-level-up entry: the level just reached is what
    // decides which move tiers are on the table (run/progression.ts
    // MOVE_TIER_LEVEL), so the level-up that reaches 4 can draw a Mid move.
    const pool = levelUpMovePool(progressionTable, moves, nextEntry);
    if (pool.length === 0) {
      onRunChange(next);
      setFeedback(`${heroName} reached Lv ${nextEntry.level}.`);
      return;
    }

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

  /** Tapping a hero card: an Evolution-ready card jumps straight to EvolutionScreen (that choice was already earned by an earlier level-up, so there's nothing to animate here); otherwise play the charge animation and only apply the level-up once it completes. Ignored while another card's animation is still running, so points can't be double-spent mid-animation. */
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
        run={run}
        onChoose={(pathId) => handleChooseEvolution(evolvingEntry.rosterId, pathId)}
      />
    );
  }

  const pendingEvolutions = run.roster.filter((entry) => !!availableEvolution(progressionTable, entry)).length;

  return (
    <div className="levelup-screen">
      {/* Gold, where the draft's sky is the pact's gold/violet: this is the
          growth beat, and it is the one screen in the run loop that is purely
          a reward. */}
      <NodeSky />

      {/* The corner roster glyph every allocation screen carries — see
          RosterPeek.tsx. Kept mounted through the move-replace offer too:
          deciding which of a hero's four moves to give up is exactly when
          the rest of the team's coverage matters. */}
      <RosterPeek run={run} />

      {/* Hidden while the move-replace offer is up: that panel has its own
          headline, and it is the one layout here tall enough to need the
          whole screen. */}
      {!offer && (
        <NodeHeader
          eyebrow="Growth Phase"
          title="Level Up"
          readoutKey={feedback ?? 'idle'}
          readoutLive={!!feedback}
          readout={
            feedback ??
            (pendingEvolutions > 0
              ? `${pendingEvolutions === 1 ? 'A hero is' : `${pendingEvolutions} heroes are`} ready to evolve — tap to choose a path.`
              : run.levelUpPool >= 1
                ? 'Tap a hero to spend a point. Hold to review its sheet.'
                : 'Every point is spent.')
          }
        >
          {/* The pool, as orbs that go out one at a time rather than a
              numeral in a bordered card. Same fixed-denominator idiom as the
              draft's pact sockets — the track's width is what the fight paid
              out, and watching it empty is the screen's whole feedback loop.
              Past a dozen points (never reachable from one fight, but the
              pool can carry over) it falls back to a count so the row can't
              wrap into the roster. */}
          {orbCount > 12 ? (
            <div className="levelup-orb-count">
              <span className="levelup-orb filled" aria-hidden="true" />
              <span>{run.levelUpPool} XP to spend</span>
            </div>
          ) : (
            <div className="levelup-orbs" aria-label={`${run.levelUpPool} of ${orbCount} XP left to spend`}>
              {Array.from({ length: orbCount }, (_, i) => (
                <span key={i} className={`levelup-orb${i < run.levelUpPool ? ' filled' : ' spent'}`} />
              ))}
            </div>
          )}
        </NodeHeader>
      )}

      {offer && offerEntry ? (
        <div className="screen-scroll moveoffer-stage">
          <div className="stage-centered">
            <div className="reward-panel">
              <OfferHeroHead
                hero={heroes[offerEntry.heroId]}
                onPreview={() => setPreviewEntry({ hero: heroes[offerEntry.heroId], entry: offerEntry })}
              />
              <p className="offer-hero-sub">Already knows {MOVE_CAP} moves — pick one to replace, or decline.</p>
              {/* The offered move itself — permanent for as long as the offer
                  is open, so the player always sees what they'd be learning.
                  ┄
                  This is the full move dossier (MoveDetailOverlay's
                  MoveDetailCard), the same card a 500ms hold opens anywhere
                  else in the game, rather than the one-line MoveInfoPanel that
                  was here. The decision this screen exists for is "is this
                  worth one of my four slots", and the panel answered it with a
                  name, a power number and a flavor line — every mechanical
                  fact that would actually settle it (what it applies, to whom,
                  for how long, what it costs against the pool) was behind a
                  hold the player had no reason to think was available on a
                  readout. The dossier is what a player already knows how to
                  read by this point in a run (2026-08-29 pass). */}
              <div className="offer-move-highlight">
                <MoveDetailCard
                  move={moves[offer.moveId]}
                  label="New move offered"
                  caster={healCasterForEntry(heroes[offerEntry.heroId], offerEntry, run.relics)}
                />
              </div>
              <div className="offer-swap-arrow" aria-hidden="true">
                ↓ replaces one of
              </div>
              {/* `.move-list`, the fight screen's own move selector — one
                  column of full-width rows tiled edge to edge and divided by a
                  hairline, so the four moves read as one surface with four
                  facets rather than as four loose tiles. It was a 2-column
                  `.move-grid`, which is the shape FightScreen's selector had
                  before the console-fill pass and nothing has used since; the
                  modifier below trims the console-specific parts (filling the
                  chassis, rows sharing its height) that have no chassis here. */}
              <div className="move-list offer-replace-list">
                {offerEntry.unlockedMoveIds.map((moveId) => (
                  <MoveButtonReplica
                    key={moveId}
                    move={moves[moveId]}
                    selected={selectedReplaceId === moveId}
                    caster={healCasterForEntry(heroes[offerEntry.heroId], offerEntry, run.relics)}
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
        <HeroPickGrid count={run.roster.length} fill>
          {run.roster.map((entry) => {
            const hero = heroes[entry.heroId];
            const node = availableEvolution(progressionTable, entry);
            const isAnimating = animatingRosterId === entry.rosterId;
            // A pending Evolution takes priority over spending another
            // point — tapping the card opens EvolutionScreen instead of
            // leveling up again, so the choice can't be buried under a
            // stack of unresolved levels. Any card is briefly inert while
            // another one's animation is running, so a point can't be spent
            // mid-animation.
            const blockedByOtherAnim = !!animatingRosterId && !isAnimating;
            const canLevelUp = run.levelUpPool >= 1 && !node && !blockedByOtherAnim;
            const canAct = (canLevelUp || !!node) && !blockedByOtherAnim;
            return (
              <GrowthCard
                key={entry.rosterId}
                hero={hero}
                entry={entry}
                node={node}
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

      {/* Gone entirely while the move-replace offer is up, rather than sitting
          under it disabled: the offer already carries its own CTA (the
          Decline/Confirm pair), so a second greyed-out gold bar below that
          pair read as the screen's real button while costing the ~90px that
          pushed the offer into a scroll. Nothing in the offer may sit below
          the fold — it is a comparison between the offered move and four
          existing ones, and a comparison you have to scroll to complete is one
          you make from memory. */}
      {!offer && (
        <button className="resolve-button" disabled={run.levelUpPool > 0 || pendingEvolutions > 0} onClick={onDone}>
          Continue
        </button>
      )}

      {/* Long-press-triggered move detail popup (MoveButtonReplica's onLongPress) — reuses .log-overlay/.log-panel like FightScreen's move-button popup, including "tap anywhere to close" (no stopPropagation on the panel). */}
      {movePopup && (
        <div className="log-overlay" onClick={() => setMovePopup(null)}>
          <div className="log-panel move-popup-panel">
            {/* Same move dossier the fight screen opens (MoveDetailOverlay.tsx) — the whole point of this screen is choosing between moves, so it should read exactly like inspecting one mid-fight. */}
            <MoveDetailCard
              move={moves[movePopup.moveId]}
              label={movePopup.label}
              caster={offerEntry ? healCasterForEntry(heroes[offerEntry.heroId], offerEntry, run.relics) : undefined}
            />
            <div className="move-popup-hint">Tap anywhere to close</div>
          </div>
        </div>
      )}

      {/* Info-button-triggered full hero sheet — the cards carry growth, not loadout, so this is where moves/stats/gear are read. */}
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
