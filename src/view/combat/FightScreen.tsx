import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { heroes } from '../../data/heroes';
import { allCombatants } from '../../data/content';
import { moves } from '../../data/moves';
import { typeChart } from '../../data/typechart';
import { equipment } from '../../data/equipment';
import { statuses } from '../../data/statuses';
import type { CombatState, Side, StatModifiers } from '../../engine/state';
import { isLockedIn, effectiveTypes, hasAffordableMove } from '../../engine/state';
import { resolveRound } from '../../engine/combat/resolveRound';
import { applyForcedReplacement } from '../../engine/combat/switching';
import type { Action } from '../../engine/combat/actions';
import type { CombatEvent } from '../../engine/events';
import type { HeroDefinition, MoveDefinition, StatKey } from '../../engine/content';
import { resolveStab, resolveTypeMult } from '../../engine/damage/typeMult';
import type { RunState, RosterEntry } from '../../run/state';
import { ROSTER_CAP } from '../../run/state';
import type { Squad } from '../../run/squad';
import type { EquipmentDefinition } from '../../run/equipment';
import { buildCombatState } from '../../run/buildCombatState';
import { isRecruitable } from '../../run/recruitment';
import { CombatantCard, type Popup } from './CombatantCard';
import { HeroDetailOverlay } from './HeroDetailOverlay';
import { formatEvents, type LogLine } from './formatEvent';
import { applyEventToState } from './applyEventToState';
import { buildBeats, type Beat } from './buildBeats';
import { getTypeColor } from './typeColors';
import { TypeBadge } from '../shared/TypeBadge';
import { CategoryBadge, useLongPress } from '../shared/MoveTile';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';
import { HeroPortrait } from '../shared/HeroPortrait';
import { STAT_ICONS, STAT_LABELS } from '../shared/StatBars';
import { EquipmentIcon, EQUIP_SLOT_LABELS, RARITY_COLOR_VARS, RARITY_LABELS } from '../shared/EquipmentBox';
import { HeroPreviewOverlay } from '../run/HeroPreviewOverlay';

function fmtGrant(amount: number): string {
  return amount > 0 ? `+${amount}` : `${amount}`;
}

interface RecruitClaimCardProps {
  hero: HeroDefinition;
  selected: boolean;
  claimed: boolean;
  onSelect: () => void;
  onInspect: () => void;
}

/**
 * One claimable Recruit Contract offer on the victory screen (user direction,
 * 2026-08-19: replace the plain text "Claim X" buttons with hero portraits).
 * Pulled out of the recruit-claims .map() below because useLongPress is a
 * hook (GuildHallHeroCard is the precedent for this split). A short tap
 * selects the card (highlighted, matching NodeRewardScreen's equipment/relic
 * pick-then-claim two-step) rather than claiming immediately — the actual
 * spend happens from the confirm button below the grid, once. A ~500ms hold
 * opens the full HeroPreviewOverlay stat/move sheet instead, same
 * tap-selects/hold-inspects split as every other offer card in the app.
 */
function RecruitClaimCard({ hero, selected, claimed, onSelect, onInspect }: RecruitClaimCardProps) {
  const longPress = useLongPress(onInspect, claimed ? undefined : onSelect);
  return (
    <button
      className={`recruit-claim-card${selected ? ' selected' : ''}${claimed ? ' claimed' : ''}`}
      style={{ borderLeftColor: getTypeColor(hero.types[0]) }}
      {...longPress}
    >
      <HeroPortrait heroId={hero.id} className="recruit-claim-portrait" />
      <div className="recruit-claim-name">{hero.name}</div>
      <div className="roster-card-types">
        {hero.types.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
      </div>
      {claimed && <span className="recruit-claim-tag">Claimed</span>}
    </button>
  );
}

const PLAYER_SIDE: Side = 'A';
const AI_SIDE: Side = 'B';
const config = { typeChart, heroes: allCombatants, moves, statuses, benchHpRegenFlat: 5 };

// Hold-to-auto-play tuning (FightScreen's advance-overlay) — how long a
// press must be held before it commits to auto-play instead of a normal
// single-beat tap, and the pause between each auto-advanced beat once
// engaged. Both are easy to retune from playtesting.
const AUTO_ADVANCE_HOLD_MS = 350;
const AUTO_ADVANCE_STEP_MS = 450;

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
  kind: 'move' | 'switch' | 'rest';
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
  /** This node's Training Point reward on a win, precomputed by the caller (App.tsx handleSquadConfirmed) — displayed only, the caller grants it in onResolved. */
  trainingPointsReward: number;
  /**
   * The guaranteed common-item drop from the run's opener Goblin fight, if
   * this node is one (App.tsx handleSquadConfirmed) — rolled up front so the
   * victory screen can spotlight the exact item that's coming. Null for
   * every other node. Displayed only; the caller hands this same item off to
   * ForceEquipScreen in onResolved.
   */
  equipmentReward: EquipmentDefinition | null;
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

export function FightScreen({
  playerRun,
  playerSquad,
  aiRun,
  aiSquad,
  teamStatModifiers,
  goldReward,
  trainingPointsReward,
  equipmentReward,
  onClaimContract,
  onResolved,
}: Props) {
  function buildInitialState(seed: number): CombatState {
    return buildCombatState(seed, allCombatants, equipment, [
      { side: PLAYER_SIDE, squad: playerSquad, roster: playerRun.roster, teamStatModifiers },
      { side: AI_SIDE, squad: aiSquad, roster: aiRun.roster },
    ]);
  }

  const [combat, setCombat] = useState<CombatState>(() => buildInitialState(Math.floor(Math.random() * 2 ** 31)));
  const [log, setLog] = useState<LogLine[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [pending, setPending] = useState<Record<string, PendingAction>>({});
  const [selecting, setSelecting] = useState<{ combatantId: string; move: MoveDefinition } | null>(null);
  const [actionStep, setActionStep] = useState(0);
  const [claimedRosterIds, setClaimedRosterIds] = useState<string[]>([]);
  const [inspecting, setInspecting] = useState<string | null>(null);
  /** Recruit Contract claim selection on the victory screen — a tap selects a card, the confirm button below the grid is what actually spends the contract. */
  const [claimSelection, setClaimSelection] = useState<string | null>(null);
  /** rosterId of the AI-side hero whose full stat/move sheet is open, via a recruit-claim card's long-press. */
  const [claimPreviewRosterId, setClaimPreviewRosterId] = useState<string | null>(null);

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
  /** Full move detail (description + matchups), shown on long-press — see the move-button pointer handlers below. Distinct from `selecting`, which is mid-target-selection state, not an info request. */
  const [movePopup, setMovePopup] = useState<{ combatantId: string; move: MoveDefinition } | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);
  const popupSeq = useRef(0);
  const beatQueue = useRef<Beat[]>([]);
  const displayState = useRef<CombatState | null>(null);
  const finalState = useRef<CombatState | null>(null);
  /** Hold-to-auto-play on the advance-overlay (below): `holdTimer` is the
   *  pending "has this press been held long enough to engage auto-play"
   *  check, `autoPlayInterval` is the running auto-advance loop once
   *  engaged, and `autoEngaged` records that engagement happened so the
   *  trailing click (pointerup always fires one) gets swallowed instead of
   *  advancing an extra beat on top of what auto-play already revealed. */
  const holdTimer = useRef<number | null>(null);
  const autoPlayInterval = useRef<number | null>(null);
  const autoEngaged = useRef(false);

  useEffect(() => {
    return () => {
      if (longPressTimer.current !== null) clearTimeout(longPressTimer.current);
      if (holdTimer.current !== null) clearTimeout(holdTimer.current);
      if (autoPlayInterval.current !== null) clearInterval(autoPlayInterval.current);
    };
  }, []);

  const playerActiveAlive = aliveActiveIdsOn(combat, PLAYER_SIDE);
  const enemyActiveAlive = aliveActiveIdsOn(combat, AI_SIDE);
  const playerBench = combat.bench[PLAYER_SIDE];
  const enemyBench = combat.bench[AI_SIDE];
  const playerLockedIn = isLockedIn(combat, PLAYER_SIDE);

  const winner: Side | null = sideDefeated(combat, PLAYER_SIDE) ? AI_SIDE : sideDefeated(combat, AI_SIDE) ? PLAYER_SIDE : null;

  // A player active slot fainted and needs a bench replacement chosen before the next round can be declared (docs/combat.md "KO handling": forced replacement is not optional, but WHICH bench hero fills it is the player's choice).
  const openReplacementSlots = ([0, 1] as const).filter((slot) => combat.active[PLAYER_SIDE][slot] === null && playerBench.length > 0);

  const canAct = !resolving && openReplacementSlots.length === 0 && playerActiveAlive.length > 0;
  const stepIndex = canAct ? Math.min(actionStep, playerActiveAlive.length - 1) : 0;
  // The player combatant whose move panel is currently on screen — glowed on the battlefield (CombatantCard's `acting` prop) instead of a "X's move" text label, so that vertical space goes back to the action panel.
  const actingId: string | null = canAct ? playerActiveAlive[stepIndex] : null;

  const targetableIds: string[] = !selecting
    ? []
    : selecting.move.target === 'singleEnemy'
      ? enemyActiveAlive
      : selecting.move.target === 'singleAlly'
        ? playerActiveAlive
        : selecting.move.target === 'self'
          ? [selecting.combatantId]
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
    if (p.kind === 'rest') return true;
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

  /**
   * Always a two-tap commit, regardless of target shape: this tap only ever
   * loads the move into `selecting` and lights up its target(s) on the
   * battlefield (targetableIds above) — even a 'self' move highlights just
   * the caster's own card, and a singleEnemy/singleAlly move with only one
   * legal candidate still highlights that lone card rather than
   * auto-resolving. A second, deliberate tap on the highlighted card(s)
   * (handleTargetClick) is what actually commits the action. This makes
   * move selection uniformly deliberate — no move can be locked in by a
   * single accidental tap, no matter how "obvious" the target is.
   */
  function handleMoveClick(combatantId: string, move: MoveDefinition) {
    setSelecting({ combatantId, move });
  }

  function handleTargetClick(targetId: string) {
    if (!selecting) return;
    commitAction(selecting.combatantId, { kind: 'move', moveId: selecting.move.id, declaredTarget: targetId });
  }

  function handleSwitchClick(combatantId: string, benchedCombatantId: string) {
    commitAction(combatantId, { kind: 'switch', benchedCombatantId });
  }

  function handleRestClick(combatantId: string) {
    commitAction(combatantId, { kind: 'rest' });
  }

  function handleForcedReplacement(slot: 0 | 1, benchedCombatantId: string) {
    const result = applyForcedReplacement(combat, combat.round, PLAYER_SIDE, slot, benchedCombatantId, statuses);
    setCombat(result.state);
    appendLog(formatEvents(result.events, allCombatants, result.state.combatants, moves));
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
    if (!hasAffordableMove(combatant.currentMana, moveIds, moves)) {
      // Same fallback as the player's move grid below: nothing is affordable,
      // so Rest rather than declaring a move that would just no-op in the
      // engine (resolveRound.ts's mana guard) and silently waste the turn.
      return { kind: 'rest', combatantId };
    }
    const affordable = moveIds.filter((id) => combatant.currentMana >= moves[id].manaCost);
    const moveId = affordable[Math.floor(Math.random() * affordable.length)];
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

  function resolveRoundWith(pendingMap: Record<string, PendingAction>) {
    const playerActions: Action[] = playerActiveAlive.map((id) => {
      const p = pendingMap[id];
      if (p.kind === 'switch') return { kind: 'switch', combatantId: id, benchedCombatantId: p.benchedCombatantId! };
      if (p.kind === 'rest') return { kind: 'rest', combatantId: id };
      return { kind: 'move', combatantId: id, moveId: p.moveId!, declaredTarget: p.declaredTarget };
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
   * rather than a fixed timer. Returns whether a beat was actually shown
   * (false once it finalized), so the auto-play loop below knows when to
   * stop ticking instead of continuing to fire against an already-finished
   * round.
   */
  function handleAdvance(): boolean {
    const beat = beatQueue.current.shift();

    if (!beat) {
      setCombat(finalState.current!);
      setPopups({});
      setBanner(null);
      setBannerMeta(null);
      setResolving(false);
      setPending({});
      setSelecting(null);
      setMovePopup(null);
      setSwitchOpen(false);
      setActionStep(0);
      return false;
    }

    let next = displayState.current!;
    for (const event of beat.events) next = applyEventToState(next, event);
    displayState.current = next;

    setCombat(next);
    appendLog(formatEvents(beat.events, allCombatants, next.combatants, moves));
    setBanner(beat.banner);
    setBannerMeta(beat.bannerMeta ?? null);
    setPopups(Object.fromEntries(beat.popups.map((p) => [p.combatantId, { key: popupSeq.current++, text: p.text, className: p.className }])));
    return true;
  }

  /** Stops any pending hold-to-engage check and any running auto-play loop — bound to pointerup/pointerleave/pointercancel on the advance-overlay so releasing the press (or the pointer sliding off-screen) always halts it. */
  function stopAutoAdvance() {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (autoPlayInterval.current !== null) {
      clearInterval(autoPlayInterval.current);
      autoPlayInterval.current = null;
    }
  }

  /** Fires once the press has been held past AUTO_ADVANCE_HOLD_MS: reveals the beat that was waiting under the player's thumb immediately, then keeps revealing one every AUTO_ADVANCE_STEP_MS until released or the round runs out of beats. */
  function engageAutoPlay() {
    holdTimer.current = null;
    autoEngaged.current = true;
    if (!handleAdvance()) return;
    autoPlayInterval.current = window.setInterval(() => {
      if (!handleAdvance()) stopAutoAdvance();
    }, AUTO_ADVANCE_STEP_MS);
  }

  function handleAdvancePointerDown() {
    // Reset rather than only clearing on the trailing click: a press that
    // ends via pointercancel (gesture interrupted by the OS, e.g. a
    // notification swipe) skips the click event entirely, which would
    // otherwise leave a stale `true` here and swallow the next press's tap.
    autoEngaged.current = false;
    holdTimer.current = window.setTimeout(engageAutoPlay, AUTO_ADVANCE_HOLD_MS);
  }

  /** A press that never made it to the hold threshold is a normal tap — advance one beat as before. A press that did engage auto-play already revealed its beats via the interval, so swallow the trailing click instead of double-advancing. */
  function handleAdvanceClick() {
    if (autoEngaged.current) {
      autoEngaged.current = false;
      return;
    }
    handleAdvance();
  }

  function handleClaimContract(entry: RosterEntry) {
    if (onClaimContract(entry)) {
      setClaimedRosterIds((prev) => [...prev, entry.rosterId]);
      setClaimSelection(null);
    }
  }

  function handleSelectClaim(rosterId: string) {
    setClaimSelection((prev) => (prev === rosterId ? null : rosterId));
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
          acting={id === actingId}
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
      {/* Full-screen click-catcher while a round is playing out — lets the
          player tap anywhere to advance instead of hunting for the banner
          specifically. Sits below the battle-log overlay's z-index so an
          open log panel takes taps for itself (close it) rather than also
          advancing the beat underneath it. */}
      {resolving && (
        <div
          className="advance-overlay"
          onClick={handleAdvanceClick}
          onPointerDown={handleAdvancePointerDown}
          onPointerUp={stopAutoAdvance}
          onPointerLeave={stopAutoAdvance}
          onPointerCancel={stopAutoAdvance}
        />
      )}

      <div className="battlefield">
        <div className="team-row enemy">
          {renderActiveSlot(AI_SIDE, 0)}
          {renderActiveSlot(AI_SIDE, 1)}
        </div>

        <div className="battlefield-divider">
          <span>VS</span>
        </div>

        <div className="team-row ally">
          {renderActiveSlot(PLAYER_SIDE, 0)}
          {renderActiveSlot(PLAYER_SIDE, 1)}
        </div>
      </div>

      <div className="action-area">
        {/* Narrates the current beat of a playing-out round
            (docs/architecture.md "engine / presentation separation") — who
            acted, what landed, who went down. Lives here, in the space the
            move-selection panel vacates while resolving, rather than as a
            fixed-height reservation above the battlefield that would sit
            empty (and push everything else down) the rest of the time. */}
        {resolving && (
          <div className="combat-banner">
            {banner && <span>{banner}</span>}
            {bannerMeta && <span className="combat-banner-meta">{bannerMeta}</span>}
            <span className="combat-banner-hint">tap ▸ or hold to auto-play ⏵⏵</span>
          </div>
        )}
        {!resolving &&
          openReplacementSlots.length === 0 &&
          playerActiveAlive.length > 0 &&
          (() => {
            const id = actingId!;
            const entry = entryFor(playerRun.roster, id);
            const hero = allCombatants[combat.combatants[id].heroId];
            const combatant = combat.combatants[id];
            // Softlock fallback (CLAUDE.md "Mana & tempo"): none of this
            // hero's unlocked moves are currently affordable. Rest replaces
            // the (all-disabled) move grid entirely — Switch stays available
            // below as normal whenever a bench hero exists, so a player who
            // dumped mana into a big hit can still choose to swap in someone
            // fresh instead of resting this active hero.
            const canAffordAnyMove = hasAffordableMove(combatant.currentMana, entry.unlockedMoveIds, moves);
            return (
              <div className="action-panel" key={id}>
                {!canAffordAnyMove && (
                  <div className="move-grid">
                    <button
                      className={`move-button rest-button${pending[id]?.kind === 'rest' ? ' selected' : ''}`}
                      onClick={() => handleRestClick(id)}
                    >
                      <div className="move-row-top">
                        <span className="move-name">Rest</span>
                      </div>
                      <div className="move-row-mid">
                        <span className="move-power">Out of Mana — recovers to full</span>
                      </div>
                    </button>
                  </div>
                )}
                {canAffordAnyMove && (
                <div className="move-grid">
                  {entry.unlockedMoveIds.map((moveId) => {
                    const move = moves[moveId];
                    const affordable = combatant.currentMana >= move.manaCost;
                    const isSelected =
                      (pending[id]?.kind === 'move' && pending[id]?.moveId === moveId) ||
                      (selecting?.combatantId === id && selecting.move.id === moveId);
                    const hasStab = resolveStab(move.type, effectiveTypes(hero, combatant)) > 1;
                    return (
                      <button
                        key={moveId}
                        className={`move-button${isSelected ? ' selected' : ''}`}
                        disabled={!affordable}
                        onClick={() => {
                          if (longPressFired.current) {
                            longPressFired.current = false;
                            return;
                          }
                          handleMoveClick(id, move);
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                        onPointerDown={() => {
                          longPressFired.current = false;
                          longPressTimer.current = window.setTimeout(() => {
                            longPressFired.current = true;
                            setMovePopup({ combatantId: id, move });
                          }, 500);
                        }}
                        onPointerUp={() => {
                          if (longPressTimer.current !== null) {
                            clearTimeout(longPressTimer.current);
                            longPressTimer.current = null;
                          }
                        }}
                        onPointerLeave={() => {
                          if (longPressTimer.current !== null) {
                            clearTimeout(longPressTimer.current);
                            longPressTimer.current = null;
                          }
                        }}
                      >
                        <div className="move-row-top">
                          <span className="move-name">{move.name}</span>
                          <span className="move-cost">
                            <strong>{move.manaCost}</strong>MP
                          </span>
                        </div>
                        <div className="move-row-mid">
                          <TypeBadge type={move.type} />
                          {move.kind === 'damage' && move.basePower != null && (
                            <span className="move-power">
                              <strong>{move.basePower}</strong>BP
                            </span>
                          )}
                          {hasStab && <span className="move-stab">STAB</span>}
                        </div>
                        <div className="move-row-bottom">
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
                          <CategoryBadge category={move.category} />
                        </div>
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

      {/* Every secondary action lives in one fixed bottom row instead of
          reserving its own space (a top header for log/reference, an
          always-visible bench readout, a back button that shifted the move
          grid down) — that reserved space was the source of the mobile
          scroll this consolidation exists to eliminate. Buttons stay
          mounted and are disabled rather than hidden when inapplicable, so
          the row's height never changes turn to turn. */}
      <div className="bottom-bar">
        <button className="back-button" disabled={!(actingId !== null && stepIndex > 0)} onClick={() => setActionStep(stepIndex - 1)}>
          ← Back
        </button>
        <button
          className="log-toggle-button"
          disabled={!(actingId !== null && playerBench.length > 0 && !playerLockedIn)}
          onClick={() => setSwitchOpen(true)}
        >
          🔄 Switch
        </button>
        <button className="log-toggle-button" onClick={() => setLogOpen(true)}>
          📜 Log
        </button>
        <button className="log-toggle-button" onClick={() => setReferenceOpen(true)}>
          📊 Ref
        </button>
      </div>

      {switchOpen &&
        actingId &&
        (() => {
          const id = actingId;
          return (
            <div className="log-overlay" onClick={() => setSwitchOpen(false)}>
              <div className="log-panel" onClick={(e) => e.stopPropagation()}>
                <div className="log-panel-header">
                  <span>Switch In</span>
                  <button className="log-close-button" onClick={() => setSwitchOpen(false)}>
                    ✕
                  </button>
                </div>
                <div className="bench-row">
                  {playerBench.map((benchId) => {
                    const isSelected = pending[id]?.kind === 'switch' && pending[id]?.benchedCombatantId === benchId;
                    // A different already-committed active hero has already claimed this bench
                    // hero as their replacement — can't also send it in here.
                    const claimedByOther = Object.entries(pending).some(
                      ([pid, p]) => pid !== id && p.kind === 'switch' && p.benchedCombatantId === benchId
                    );
                    const benchCombatant = combat.combatants[benchId];
                    const benchHero = allCombatants[benchCombatant.heroId];
                    return (
                      <CombatantCard
                        key={benchId}
                        hero={benchHero}
                        combatant={benchCombatant}
                        targetable={!claimedByOther}
                        selected={isSelected}
                        switchingIn={isSelected || claimedByOther}
                        locked={claimedByOther}
                        onSelectTarget={() => {
                          handleSwitchClick(id, benchId);
                          setSwitchOpen(false);
                        }}
                        onInspect={() => setInspecting(benchId)}
                        popup={popups[benchId]}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

      {movePopup &&
        (() => {
          const { move } = movePopup;
          const combatant = combat.combatants[movePopup.combatantId];
          const hero = allCombatants[combatant.heroId];
          const hasStab = resolveStab(move.type, effectiveTypes(hero, combatant)) > 1;
          return (
            <div className="log-overlay" onClick={() => setMovePopup(null)}>
              <div className="log-panel move-popup-panel">
                <div className="log-panel-header">
                  <span>{move.name}</span>
                  <span className="move-cost">
                    <strong>{move.manaCost}</strong>MP
                  </span>
                </div>
                <div className="move-popup-meta">
                  <TypeBadge type={move.type} />
                  <CategoryBadge category={move.category} />
                  {move.kind === 'damage' && move.basePower != null && (
                    <span className="move-power">
                      <strong>{move.basePower}</strong>BP
                    </span>
                  )}
                  {hasStab && <span className="move-stab">STAB</span>}
                </div>
                <div className="move-popup-description">{move.description ?? 'No description.'}</div>
                {enemyActiveAlive.length > 0 && (
                  <div className="move-popup-matchups">
                    {enemyActiveAlive.map((enemyId) => {
                      const enemyHero = allCombatants[combat.combatants[enemyId].heroId];
                      const mult = effectivenessAgainst(move, enemyId);
                      return (
                        <div className="move-popup-matchup-row" key={enemyId}>
                          <span>{enemyHero.name}</span>
                          <span className={`eff-chip ${multClass(mult)}`}>{formatMult(mult)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="move-popup-hint">Tap anywhere to close</div>
              </div>
            </div>
          );
        })()}

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

      {referenceOpen && <ReferenceOverlay onClose={() => setReferenceOpen(false)} />}

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

      {winner &&
        !resolving &&
        (() => {
          const recruitableEntries = aiRun.roster.filter((entry) => isRecruitable(entry.heroId, heroes));
          const selectedClaimEntry = claimSelection ? (recruitableEntries.find((e) => e.rosterId === claimSelection) ?? null) : null;
          const rosterFull = playerRun.roster.length >= ROSTER_CAP;
          const noContracts = playerRun.recruitContracts <= 0;
          const equipGrants = equipmentReward ? (Object.entries(equipmentReward.statGrants) as [StatKey, number][]) : [];

          return (
            <div className={`result-overlay ${winner === PLAYER_SIDE ? 'result-win' : 'result-loss'}`}>
              <div className="result-panel">
                <div className="result-glow" aria-hidden="true" />
                <h2>{winner === PLAYER_SIDE ? 'Victory!' : 'Defeat'}</h2>

                {winner === PLAYER_SIDE && (goldReward > 0 || trainingPointsReward > 0) && (
                  <div className="result-rewards">
                    {goldReward > 0 && (
                      <div className="result-reward-chip">
                        💰 <strong>+{goldReward}</strong>g
                      </div>
                    )}
                    {trainingPointsReward > 0 && (
                      <div className="result-reward-chip">
                        📈 <strong>+{trainingPointsReward}</strong> Training
                      </div>
                    )}
                  </div>
                )}

                {winner === PLAYER_SIDE && equipmentReward && (
                  <div
                    className="equip-spotlight result-equip-spotlight"
                    style={{ '--rarity-color': RARITY_COLOR_VARS[equipmentReward.rarity] } as CSSProperties}
                  >
                    <div className="equip-spotlight-glow" aria-hidden="true" />
                    <div className="equip-spotlight-header">
                      <EquipmentIcon item={equipmentReward} slot={equipmentReward.slot} className="equip-spotlight-icon" />
                      <div>
                        <div className="equip-spotlight-name">{equipmentReward.name}</div>
                        <div className="equip-spotlight-rarity">
                          {RARITY_LABELS[equipmentReward.rarity]} · {EQUIP_SLOT_LABELS[equipmentReward.slot]}
                        </div>
                      </div>
                    </div>
                    {equipGrants.length > 0 && (
                      <div className="detail-modifier-list">
                        {equipGrants
                          .filter(([, amount]) => amount)
                          .map(([stat, amount]) => (
                            <span key={stat} className={`detail-modifier-chip ${amount > 0 ? 'stat-buff' : 'stat-debuff'}`}>
                              {STAT_ICONS[stat]} {STAT_LABELS[stat]} {fmtGrant(amount)}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {winner === PLAYER_SIDE && recruitableEntries.length > 0 && (
                  <div className="recruit-claims">
                    <div className="hint">📜 Recruit Contracts available: {playerRun.recruitContracts}</div>
                    <div className="recruit-claims-grid">
                      {recruitableEntries.map((entry) => {
                        const claimed = claimedRosterIds.includes(entry.rosterId);
                        return (
                          <RecruitClaimCard
                            key={entry.rosterId}
                            hero={heroes[entry.heroId]}
                            selected={claimSelection === entry.rosterId}
                            claimed={claimed}
                            onSelect={() => handleSelectClaim(entry.rosterId)}
                            onInspect={() => setClaimPreviewRosterId(entry.rosterId)}
                          />
                        );
                      })}
                    </div>
                    <div className="recruit-claims-hint">Tap a hero to select, hold to inspect their stats</div>
                    {selectedClaimEntry && (
                      <button
                        className="resolve-button recruit-claim-confirm"
                        disabled={rosterFull || noContracts}
                        onClick={() => handleClaimContract(selectedClaimEntry)}
                      >
                        {rosterFull
                          ? 'Roster Full'
                          : noContracts
                            ? 'No Contracts Left'
                            : `Claim ${heroes[selectedClaimEntry.heroId].name} — 1 Contract`}
                      </button>
                    )}
                  </div>
                )}

                <div className="result-buttons">
                  <button onClick={() => onResolved(winner === PLAYER_SIDE ? 'win' : 'loss', combat)}>Continue</button>
                </div>
              </div>

              {claimPreviewRosterId &&
                (() => {
                  const entry = aiRun.roster.find((r) => r.rosterId === claimPreviewRosterId);
                  if (!entry) return null;
                  return (
                    <HeroPreviewOverlay
                      hero={heroes[entry.heroId]}
                      entry={entry}
                      equipmentLookup={equipment}
                      onClose={() => setClaimPreviewRosterId(null)}
                    />
                  );
                })()}
            </div>
          );
        })()}
    </>
  );
}
