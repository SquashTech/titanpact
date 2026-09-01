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
  MOVE_CAP,
  MASTERY_STAT_AMOUNT,
  drawMasteryStats,
  grantMasteryStat,
  levelUpPayout,
  ProgressionError,
  type EvolutionNode,
} from '../../run/progression';
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

/**
 * A mastery level-up's three rolled stats, awaiting the player's pick
 * (run/progression.ts drawMasteryStats). The level is already banked when
 * this is set — only the +10 is outstanding — so this offer has no decline:
 * every option is a strict gain, and refusing one would just burn the point.
 * That is the difference from MoveOffer, where declining a swap is a real
 * choice because the replacement can be worse than what it displaces.
 */
interface MasteryOffer {
  rosterId: string;
  stats: StatKey[];
}

/**
 * What one Training Point actually buys this hero — the single fact the
 * whole screen exists to let the player compare, and the thing the old card
 * (name / level / types / "Tap to level up") never said.
 *
 * Ordered by how much it should pull the eye: an Evolution already earned
 * outranks everything, then the level-up that *triggers* one, then the
 * ordinary move roll, then the mastery stat (a real payoff, just a smaller
 * one), then the one dud left — a swap the player may not want.
 *
 * 'level' ("Level only") is GONE as of 2026-08-31: past MASTERY_LEVEL, and on
 * any empty pool below it, the point now buys a stat instead of nothing
 * (run/progression.ts levelUpPayout). There is no longer a state in which a
 * Training Point pays out nothing at all.
 */
type Payoff = 'evolve' | 'brink' | 'move' | 'swap' | 'mastery';

/** Kept short on purpose: this sits in a ~100px card at 9px/800 uppercase, and a label that wraps or clips is worse than a vaguer one. */
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
  // Asked of the level this point WOULD reach, not the current one, because
  // both halves of the answer are level-gated: move tiers open at a level
  // (run/progression.ts MOVE_TIER_LEVEL), so a level-3 hero whose Early moves
  // are spent still has a Mid move waiting; and mastery starts at a level too.
  // The card must promise what the point will actually buy.
  const payout = levelUpPayout(progressionTable, moves, { ...entry, level: entry.level + 1 });
  if (payout === 'mastery') return 'mastery';
  return entry.unlockedMoveIds.length >= MOVE_CAP ? 'swap' : 'move';
}

interface GrowthCardProps {
  hero: HeroDefinition;
  entry: RosterEntry;
  node: EvolutionNode | null;
  /** True while the pool cannot cover this hero's next level (run/progression.ts levelUpCost). The card is disabled either way; this is what makes it say WHY. */
  unaffordable: boolean;
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
function GrowthCard({ hero, entry, node, unaffordable, canAct, isAnimating, onActivate, onPreview }: GrowthCardProps) {
  const payoff = payoffFor(entry);
  // An earned Evolution was already paid for by the level-up that reached
  // EVOLUTION_LEVEL, so those cards carry no price at all — the one state in
  // which tapping a card costs nothing.
  const cost = node ? null : levelUpCost(entry.level);
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
      ariaLabel={`${hero.name}, level ${entry.level} — ${PAYOFF_LABEL[payoff]}${cost === null ? '' : `, costs ${cost} XP`}`}
      /* The rising charge only exists while the level-up timer is running —
         mounting it is what starts its animation, so there is no stale state
         to reset between level-ups. */
      overlay={
        <>
          {/* The price, as a corner mark on the figure — the mirror of
              `.pick-level` opposite it, because the two numbers are read
              together: a level-up costs as many points as the level it leaves
              (run/progression.ts levelUpCost). Dimmed rather than hidden when
              the pool can't cover it, so the card says "too expensive" and not
              just "no". */}
          {cost !== null && (
            <span className={`growth-cost${unaffordable ? ' is-unaffordable' : ''}`} aria-hidden="true">
              {cost}
            </span>
          )}
          {isAnimating && <span className="growth-charge" aria-hidden="true" />}
        </>
      }
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
 * One rolled stat on the mastery picker: what the hero has now, and what
 * this pick would make it.
 *
 * Showing the CURRENT value is the whole reason this is a choice screen and
 * not three bare labels — "+10 Attack" means something very different on a
 * 90-Attack bruiser than on a 20-Attack caster, and the player is being asked
 * to decide exactly that. `current` already includes equipment, Evolution,
 * map-node and earlier mastery grants (run/entryStats.ts entryStatModifiers),
 * so it is the number the hero actually fights with.
 */
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
 * How long the screen lingers after the last Training Point is resolved
 * before handing off on its own (2026-08-31, user direction: the Continue
 * button is gone).
 *
 * There was nothing left for that button to decide. It was disabled for the
 * entire life of the screen and became pressable exactly when the screen had
 * no remaining state — a press whose only outcome was "yes, I am finished",
 * asked of a player the screen had already finished with. Every other forced
 * allocation gate in the run (ForceEquipScreen's queue, the Recruit
 * Contract's offers) leaves the moment its work is done; this one asked for a
 * receipt.
 *
 * The delay is what the button was actually buying, and it is the part worth
 * keeping: the last level-up's readout ("Cinder reached Lv 5 and learned
 * Ember Wall!") lands in the header at the same instant the pool empties, and
 * cutting on that frame would make the payoff of the final point the one the
 * player never gets to read.
 */
const AUTO_CONTINUE_MS = 1250;

/**
 * The arrival beat: how long the screen spends telling the player what they
 * won before it asks them to spend it.
 *
 * This screen arrives straight off a victory and used to land whole — header,
 * a full orb track and six hero cards, all on the first frame — so the one
 * fact it exists to deliver ("you earned three points") was never *delivered*,
 * it was simply already true when the screen appeared. The pool is the reward;
 * a reward that is only ever shown in its final state is a number, not a
 * payoff. Now the orbs land one at a time, each with its own note a step above
 * the last, and the roster wakes up once they have all arrived.
 *
 * Deliberately short. Three points cost 300 + 3x130 + 340 = about a second,
 * which is a beat, not a cutscene — and the roster is dark rather than absent
 * throughout, so nothing moves when it lights up.
 */
const ORB_LEAD_MS = 300;
const ORB_STAGGER_MS = 130;
/** The pause between the last orb landing and the roster waking — the note needs somewhere to finish. */
const ORB_SETTLE_MS = 340;
/** Past this many orbs the header falls back to a count (see orbCount), and a count has nothing to stagger. Same threshold, one source. */
const ORB_TRACK_MAX = 12;

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
  /** The mastery level-up's three rolled stats, awaiting a pick. Mutually exclusive with `offer` in practice — one level-up pays out either a move or a stat, never both. */
  const [masteryOffer, setMasteryOffer] = useState<MasteryOffer | null>(null);
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

  /**
   * How many orbs the arrival beat has to count in. Zero means there is
   * nothing to count — an empty pool (the screen is only open to resolve a
   * pending Evolution) or a pool too big for the track to draw — and the beat
   * is skipped outright rather than being run with nothing in it.
   */
  const introOrbs = startingPool.current > 0 && startingPool.current <= ORB_TRACK_MAX ? startingPool.current : 0;
  /** Orbs that have landed so far. Starts full when there is no beat, so the render path below needs no second branch. */
  const [arrivedOrbs, setArrivedOrbs] = useState(introOrbs > 0 ? 0 : orbCount);
  /** False while the pool is still being counted in — the roster is dark and inert until it flips (see `is-asleep`). */
  const [introDone, setIntroDone] = useState(introOrbs === 0);

  useEffect(() => {
    if (introOrbs === 0) return;
    // Reduced motion gets the pool, not a second of it appearing (see
    // reducedMotion.ts — the stylesheet cannot reach a chain of timeouts).
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
          // A step up per orb, capped so an eight-point pool doesn't climb out
          // of the register it started in.
          playSfx('xp.orb', { pitch: 1 + Math.min(i, 7) * 0.06 });
        }, ORB_LEAD_MS + i * ORB_STAGGER_MS)
      );
    }
    timers.push(window.setTimeout(() => setIntroDone(true), ORB_LEAD_MS + introOrbs * ORB_STAGGER_MS + ORB_SETTLE_MS));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [introOrbs]);

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

    // Past MASTERY_LEVEL the point buys a stat rather than a move — the sink
    // that keeps a maxed hero worth investing in (run/progression.ts
    // grantMasteryStat). Also the catch-all for an empty pool below the cap,
    // so no level-up can pay out nothing.
    //
    // The level is banked immediately and the GRANT waits on the player's
    // pick, the same split the move-replace offer already uses: the point is
    // spent either way, so the level must not be contingent on the choice.
    if (levelUpPayout(progressionTable, moves, nextEntry) === 'mastery') {
      onRunChange(next);
      setFeedback(null);
      setMasteryOffer({ rosterId, stats: drawMasteryStats(Math.random) });
      return;
    }

    // Rolled off the POST-level-up entry: the level just reached is what
    // decides which move tiers are on the table (run/progression.ts
    // MOVE_TIER_LEVEL), so the level-up that reaches 4 can draw a Mid move.
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

  /** Tapping a hero card: an Evolution-ready card jumps straight to EvolutionScreen (that choice was already earned by an earlier level-up, so there's nothing to animate here); otherwise play the charge animation and only apply the level-up once it completes. Ignored while another card's animation is still running, so points can't be double-spent mid-animation. */
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
    setOffer(null);
    setSelectedReplaceId(null);
  }

  /** Applies the mastery pick. No null case, unlike resolveOffer — the picker has no decline (see MasteryOffer). */
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
    onRunChange(chooseEvolutionPath(run, progressionTable, heroes, rosterId, pathId));
    setEvolvingRosterId(null);
  }

  const pendingEvolutions = run.roster.filter((entry) => !!availableEvolution(progressionTable, entry)).length;

  /**
   * The hand-off. Fires once the screen has nothing left to resolve —
   * no points, no earned Evolution, no offer open, no animation running, and
   * nothing the player has opened over the top of it.
   *
   * The overlay checks are not paranoia: the pool empties on a card tap, and
   * a player who then holds a card to read a hero sheet must not have the
   * screen pulled out from under them. Because those are effect
   * dependencies, opening a sheet cancels the pending hand-off and closing it
   * starts a fresh one — which is the behaviour that wants writing anyway.
   *
   * `ui.page` rather than silence: this is the only transition in the app the
   * player did not press for, and an unannounced screen change reads as a
   * glitch. A whoosh is what makes it read as the screen leaving on purpose.
   */
  /* Affordability, not emptiness. Under the level-priced curve
     (run/progression.ts levelUpCost) a leftover point or two that cannot buy
     anybody a level is the NORMAL end state, and it banks for a later node —
     so the screen has to leave on "nothing left I can buy", or it would sit
     open forever holding 2 points against a roster that all costs 3. */
  const canAffordAny = canAffordAnyLevelUp(run);

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

  /* Read through a ref so the effect below can depend on `done` alone. App.tsx
     passes `onDone` as an inline arrow, so its identity changes on every
     parent render — as a dependency it would tear down and restart the timer
     each time, and a screen that re-rendered often enough would simply never
     leave. */
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

  const masteryEntry = masteryOffer ? (run.roster.find((r) => r.rosterId === masteryOffer.rosterId) ?? null) : null;
  /* What the picker's "80 → 90" reads off: base plus every flat grant already
     on the hero, so the comparison is against what it actually fights with
     rather than against its authored line. */
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
      {!offer && !masteryOffer && (
        <NodeHeader
          eyebrow="Growth Phase"
          title="Level Up"
          readoutKey={introDone ? (feedback ?? 'idle') : 'arriving'}
          readoutLive={!introDone || !!feedback}
          /* While the orbs are landing the line reports the win rather than
             giving an instruction — asking "tap a hero" of a player who cannot
             yet tap one is the kind of thing that trains people to stop reading
             this line at all. */
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
          {/* The pool, as orbs that go out one at a time rather than a
              numeral in a bordered card. Same fixed-denominator idiom as the
              draft's pact sockets — the track's width is what the fight paid
              out, and watching it empty is the screen's whole feedback loop.
              Past a dozen points (never reachable from one fight, but the
              pool can carry over) it falls back to a count so the row can't
              wrap into the roster. */}
          {orbCount > ORB_TRACK_MAX ? (
            <div className="levelup-orb-count">
              <span className="levelup-orb filled" aria-hidden="true" />
              <span>{run.levelUpPool} XP to spend</span>
            </div>
          ) : (
            <div className="levelup-orbs" aria-label={`${run.levelUpPool} of ${orbCount} XP left to spend`}>
              {/* Three states, not two: an orb that has not landed yet is
                  `unarrived` (collapsed and invisible), and the transition
                  already on `.levelup-orb` is what pops it in when the arrival
                  beat reaches it. The spent/filled split is unchanged — after
                  the beat, `arrivedOrbs` is the full count and this reads
                  exactly as it always did. */}
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
        /* Dark and inert while the pool counts in, then waking card by card
           (`.pick-grid.is-waking > .pick-card`). Rendered either way rather
           than mounted on `introDone`: the grid owns the space between the
           header and the bottom of the screen, and a roster that arrives by
           *appearing* would shove the orb track up the instant it landed. */
        <HeroPickGrid count={run.roster.length} fill className={introDone ? 'is-waking' : 'is-asleep'}>
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
            // `introDone` joins the other two locks rather than relying on the
            // grid's own `pointer-events: none`: the cards are also reachable
            // by keyboard, and a card that answers Enter while it is invisible
            // spends a point the player never saw arrive.
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

      {/* There is no Continue button here — see AUTO_CONTINUE_MS. It was
          disabled for the whole life of the screen and unlocked exactly when
          the screen had nothing left to ask, so the screen now leaves on its
          own instead. Its ~90px went to the hero grid, which is the one thing
          on this screen the player is actually reading.

          (It was already unmounted while the move-replace offer was up, for
          a related reason: the offer carries its own Decline/Confirm pair,
          and a greyed-out gold bar under them read as the real button while
          pushing the comparison below the fold.) */}

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
