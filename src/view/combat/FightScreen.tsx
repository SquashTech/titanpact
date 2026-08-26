import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { heroes } from '../../data/heroes';
import { allCombatants } from '../../data/content';
import { moves } from '../../data/moves';
import { typeChart } from '../../data/typechart';
import { equipment } from '../../data/equipment';
import { statuses } from '../../data/statuses';
import { passives } from '../../data/passives';
import { fieldEffects } from '../../data/fieldEffects';
import { relics } from '../../data/relics';
import type { CombatState, Side } from '../../engine/state';
import { isLockedIn, effectiveTypes, hasAffordableMove } from '../../engine/state';
import { resolveRound } from '../../engine/combat/resolveRound';
import { applyForcedReplacement } from '../../engine/combat/switching';
import { FIELD_EFFECT_DURATION_ROUNDS } from '../../engine/combat/fieldEffectEngine';
import type { Action } from '../../engine/combat/actions';
import type { CombatEvent } from '../../engine/events';
import type { HeroDefinition, MoveDefinition, StatKey, TargetMode } from '../../engine/content';
import { resolveStab, resolveTypeMult, TYPE_MULT_FLOOR } from '../../engine/damage/typeMult';
import { resolveElementalForceBonus } from '../../engine/damage/damagePipeline';
import type { RunState, RosterEntry } from '../../run/state';
import { ROSTER_CAP } from '../../run/state';
import type { Squad } from '../../run/squad';
import type { EquipmentDefinition } from '../../run/equipment';
import { buildCombatState } from '../../run/buildCombatState';
import { relicTeamStatModifiers } from '../../run/relics';
import { relicTeamPassiveGrants } from '../../run/passives';
import { relicTeamStatusGrants } from '../../run/statusGrants';
import { isRecruitable, deriveContractOffer } from '../../run/recruitment';
import { RosterReplaceScreen } from '../run/RosterReplaceScreen';
import { CombatantCard, type Popup } from './CombatantCard';
import { HeroDetailOverlay } from './HeroDetailOverlay';
import { FieldEffectDetailOverlay } from './FieldEffectDetailOverlay';
import { formatEvents, type LogLine } from './formatEvent';
import { applyEventToState } from './applyEventToState';
import { buildBeats, type Beat } from './buildBeats';
import { getTypeAbbr, getTypeColor, getTypeColorRgb } from './typeColors';
import { TypeBadge } from '../shared/TypeBadge';
import { CategoryBadge, MoveKindBadge, KIND_LABELS, TARGET_MODE_LABELS, moveEffectSummary, useLongPress } from '../shared/MoveTile';
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
 * 2026-08-19: replace the plain text "Claim X" buttons with hero portraits;
 * 2026-08-21: deliberately NOT built on the guild-hall-hero-card /
 * roster-card visual family — recruiting a teammate is a bigger moment than
 * a shop purchase, so this card gets its own violet contract-seal treatment
 * and idle shimmer instead of reusing the generic hero-card look). Pulled
 * out of the recruit-claims .map() below because useLongPress is a hook
 * (GuildHallHeroCard is the precedent for this split). A short tap selects
 * the card (highlighted, matching NodeRewardScreen's equipment/relic
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
      style={{ '--recruit-type-color': getTypeColor(hero.types[0]) } as CSSProperties}
      {...longPress}
    >
      <span className="recruit-claim-shimmer" aria-hidden="true" />
      <span className="recruit-claim-seal" aria-hidden="true">
        📜
      </span>
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

/**
 * Ambient embers drifting up through the console — the same golden-angle
 * sequence the title screen's useEmbers and the draft's useMotes use (a pure
 * function of index, so the scatter is stable across re-renders with no seed to
 * store) and the same `title-ember-rise` keyframe.
 *
 * Nine rather than the draft's sixteen: this field is a third of the height and
 * sits behind text the player reads under time pressure, not behind a figure
 * they are admiring. They take `--console-rgb`, so the air below the horizon
 * carries the domain of whoever is currently commanding.
 */
const CONSOLE_EMBERS = Array.from({ length: 9 }, (_, i) => {
  const seed = i * 137.51;
  return {
    left: seed % 100,
    delay: (seed * 1.3) % 8,
    duration: 6.5 + ((seed * 0.29) % 4),
    size: 2 + ((seed * 0.17) % 2),
  };
});
const config = { typeChart, heroes: allCombatants, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** Recruit Contract offers are capped to this many cards on the victory screen (user direction, 2026-08-21) — a 4v4 elite/boss fight would otherwise dump every recruitable enemy on the player at once. */
const MAX_RECRUIT_OFFERS = 2;

/** Random, order-independent sample of up to MAX_RECRUIT_OFFERS entries — called once per fight via useMemo below, not on every render, so the offer doesn't reshuffle out from under a selection. */
function pickRecruitOffers(entries: readonly RosterEntry[]): RosterEntry[] {
  if (entries.length <= MAX_RECRUIT_OFFERS) return [...entries];
  const pool = [...entries];
  const picks: RosterEntry[] = [];
  while (picks.length < MAX_RECRUIT_OFFERS && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(i, 1)[0]);
  }
  return picks;
}

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

/**
 * The command crest — what replaced "Select Aegis' Move:" / "Select a Target:".
 *
 * A doubles turn is two decisions taken in sequence, and the console said
 * nothing about that: not which of the two you were on, and not what you had
 * already locked in for the other. It said the acting hero's name, in words,
 * beside a hero the arena was already lighting — a form label for a fact
 * something else was carrying better.
 *
 * So it becomes the two heroes themselves, in the same socket idiom the draft
 * uses for the pact (docs/visual-language.md third pass) and the Field Effect
 * plaque uses for its duration: a fixed-denominator track whose full shape is
 * learned once and then read at a glance. One socket per active hero at 24px —
 * the one clean downscale of a 48px source. The one in command is lit in its
 * own domain color, the same light the whole console is filled with; a
 * committed one wears the mana crystal of the move it is holding.
 *
 * The SAME object renders for move selection and for targeting, with only the
 * trailing label changing (the commander's name, then the move being aimed).
 * That is the persistent console shell open item 3 asked for, at the one level
 * that actually matters to the player: the header does not restyle itself
 * halfway through a decision.
 */
function ConsoleCrest({
  activeIds,
  actingId,
  combatants,
  pending,
  isComplete,
  label,
  labelRgb,
}: {
  activeIds: readonly string[];
  actingId: string | null;
  combatants: CombatState['combatants'];
  pending: Record<string, PendingAction>;
  isComplete: (p: PendingAction | undefined) => boolean;
  label: string;
  /** Overrides the console's own hue — targeting colors the label by the MOVE being aimed, not by its caster. */
  labelRgb?: string;
}) {
  return (
    <div className="console-crest">
      <div className="console-sockets">
        {activeIds.map((cid) => {
          const c = combatants[cid];
          const cHero = allCombatants[c.heroId];
          const committed = isComplete(pending[cid]) ? pending[cid] : undefined;
          const committedMove = committed?.kind === 'move' ? moves[committed.moveId!] : undefined;
          return (
            <span
              key={cid}
              className={`console-socket${cid === actingId ? ' acting' : ''}${committed ? ' committed' : ''}`}
              style={{ '--socket-rgb': getTypeColorRgb(effectiveTypes(cHero, c)[0]) } as CSSProperties}
              title={
                committedMove
                  ? `${cHero.name} — ${committedMove.name}`
                  : committed
                    ? `${cHero.name} — ${committed.kind === 'rest' ? 'Rest' : 'Switching out'}`
                    : cHero.name
              }
            >
              <HeroPortrait heroId={cHero.id} className="console-socket-portrait" />
              {committedMove && (
                <span
                  className="console-socket-crystal"
                  style={{ '--move-type-rgb': getTypeColorRgb(committedMove.type) } as CSSProperties}
                >
                  {committedMove.manaCost}
                </span>
              )}
              {committed && !committedMove && (
                <span className="console-socket-mark" aria-hidden="true">
                  {committed.kind === 'rest' ? '\u25CC' : '\u21C4'}
                </span>
              )}
            </span>
          );
        })}
      </div>
      {/* Identity, not instruction — and set in the horizon's own register
          (9px/800/0.14em uppercase) rather than body copy, which is the
          register audit the second pass asked for. */}
      <span className="console-commander" style={labelRgb ? ({ '--console-rgb': labelRgb } as CSSProperties) : undefined}>
        {label}
      </span>
    </div>
  );
}

interface Props {
  playerRun: RunState;
  playerSquad: Squad;
  /** This node's generated encounter (src/run/enemyGen.ts) — a fresh AI roster/squad per fight/elite/boss node, not a fixed opponent. */
  aiRun: RunState;
  aiSquad: Squad;
  /**
   * The player's owned relics (RunState.relics) — the raw id list rather
   * than precomputed grants, so this screen derives the stat/passive/status
   * broadcasts once (below) AND can hand the same ids to the hero sheets it
   * opens (HeroPreviewOverlay), which must show the same relic-inclusive
   * numbers the fight itself uses. Omitted by relic-less callers (Quick
   * Battle).
   */
  playerRelicIds?: readonly string[];
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
   * AI roster on a win. Returns whether the claim succeeded (false only if
   * the player has no contracts left) — a full roster no longer blocks this,
   * see onClaimContractReplace below.
   */
  onClaimContract: (defeated: RosterEntry) => boolean;
  /**
   * Roster-full variant of onClaimContract, wired to RosterReplaceScreen's
   * confirm button (rendered in-place over this victory overlay rather than
   * via App.tsx's Screen state — see that component's header comment for
   * why). Returns whether the claim+replace succeeded.
   */
  onClaimContractReplace: (defeated: RosterEntry, terminatedRosterId: string) => boolean;
  /** Fired when the player dismisses the result overlay — the caller owns what a win/loss means for run progress (vitals sync, currency grant, advancing the map, or ending the run). */
  onResolved: (outcome: 'win' | 'loss', finalState: CombatState) => void;
  /**
   * Abandon the run from the bottom bar's Options menu and go back to the
   * title. Omit it for fights that aren't part of a run (Quick Battle, the
   * sandbox) — the menu then simply has nothing to quit and shows only
   * Resume. There is no save file, so this discards the run outright; the
   * menu arms the choice with a second tap before calling this.
   */
  onQuitToTitle?: () => void;
}

export function FightScreen({
  playerRun,
  playerSquad,
  aiRun,
  aiSquad,
  playerRelicIds = [],
  goldReward,
  trainingPointsReward,
  equipmentReward,
  onClaimContract,
  onClaimContractReplace,
  onResolved,
  onQuitToTitle,
}: Props) {
  /** The three team-wide broadcasts every owned relic contributes (src/run/relics.ts, passives.ts, statusGrants.ts) — derived here rather than by each caller so "what a relic does" has one wiring site. */
  const teamStatModifiers = relicTeamStatModifiers(playerRelicIds, relics);
  const teamPassiveGrants = relicTeamPassiveGrants(playerRelicIds, relics);
  const teamStatusGrants = relicTeamStatusGrants(playerRelicIds, relics);

  function buildInitialState(seed: number): CombatState {
    return buildCombatState(
      seed,
      allCombatants,
      equipment,
      [
        { side: PLAYER_SIDE, squad: playerSquad, roster: playerRun.roster, teamStatModifiers, teamPassiveGrants, teamStatusGrants },
        { side: AI_SIDE, squad: aiSquad, roster: aiRun.roster },
      ],
      passives
    );
  }

  const [combat, setCombat] = useState<CombatState>(() => buildInitialState(Math.floor(Math.random() * 2 ** 31)));
  const [log, setLog] = useState<LogLine[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  /** The bottom bar's Options menu (quit run / resume). */
  const [menuOpen, setMenuOpen] = useState(false);
  /** Quitting is armed by a first tap and only fires on the second — see the menu's markup below. Reset every time the menu opens so it never comes back pre-armed. */
  const [confirmingQuit, setConfirmingQuit] = useState(false);
  /** Bench hero tapped (but not yet confirmed) in the forced-replacement panel below — a fainted active slot requires a deliberate select-then-confirm instead of a single tap, since this choice can't be undone once committed. Reset after each confirm so the panel starts fresh for the next open slot (a double KO opens two in sequence). */
  const [replacementPick, setReplacementPick] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, PendingAction>>({});
  const [selecting, setSelecting] = useState<{ combatantId: string; move: MoveDefinition } | null>(null);
  const [actionStep, setActionStep] = useState(0);
  const [claimedRosterIds, setClaimedRosterIds] = useState<string[]>([]);
  const [inspecting, setInspecting] = useState<string | null>(null);
  /** Whether the active Field Effect's full detail card (FieldEffectDetailOverlay) is open — opened via a long-press on the battlefield-divider badge. */
  const [inspectingFieldEffect, setInspectingFieldEffect] = useState(false);
  /** Recruit Contract claim selection on the victory screen — a tap selects a card, the confirm button below the grid is what actually spends the contract. */
  const [claimSelection, setClaimSelection] = useState<string | null>(null);
  /** rosterId of the AI-side hero whose full stat/move sheet is open, via a recruit-claim card's long-press. */
  const [claimPreviewRosterId, setClaimPreviewRosterId] = useState<string | null>(null);
  /** The defeated entry a roster-full claim attempt is trying to recruit — set instead of claiming directly when playerRun.roster is already at ROSTER_CAP, opening RosterReplaceScreen in place over this victory overlay. */
  const [rosterReplaceEntry, setRosterReplaceEntry] = useState<RosterEntry | null>(null);

  /**
   * Recruit Contract offers for this fight, capped at MAX_RECRUIT_OFFERS and
   * randomly sampled when a 4v4 encounter leaves more recruitable enemies
   * than that (e.g. an elite/boss fight). Memoized on `aiRun` — stable for
   * the life of this FightScreen instance (aiRun doesn't change mid-fight) —
   * rather than recomputed inline in the result overlay below, so selecting
   * a card or any other re-render doesn't reroll which heroes are offered.
   */
  const recruitableEntries = useMemo(() => aiRun.roster.filter((entry) => isRecruitable(entry.heroId, heroes)), [aiRun]);
  const recruitOffers = useMemo(() => pickRecruitOffers(recruitableEntries), [recruitableEntries]);

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
  const [bannerMetaClass, setBannerMetaClass] = useState<string | null>(null);
  /**
   * Every beat revealed so far in the round currently playing out, oldest
   * first — the last entry is the beat on screen now, the ones before it are
   * history. The console is a fixed-height chassis and a single beat is one
   * sentence, so playback used to leave 226px of bare console face under an
   * 80px banner (28% of the screen). This is what fills it, and it fills it
   * with the one thing the player actually loses during playback: a round
   * read too fast, or auto-played under a held thumb, is gone until they open
   * the log. Only *revealed* beats are ever listed — the queue holds the rest
   * of the round already resolved, and rendering that would hand the player
   * the enemy's turn before it happens.
   */
  const [beatTrail, setBeatTrail] = useState<{ banner: string; meta?: string; metaClass?: string }[]>([]);
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

  /**
   * The battlefield-divider Field Effect plaque opens its full detail card
   * (FieldEffectDetailOverlay) — the plaque itself only has room for the name
   * and a rounds-remaining pip track, not for what the effect actually does.
   * Bound to BOTH gestures: hold (the convention shared with status badges and
   * move buttons) *and* a plain tap. A Field Effect is standing rules that
   * change how every move in the round resolves, so "what does this do" has to
   * be one obvious tap away rather than gated behind a gesture the player has
   * to already know is available.
   */
  const inspectFieldEffect = combat.activeFieldEffect ? () => setInspectingFieldEffect(true) : undefined;
  const fieldEffectPress = useLongPress(inspectFieldEffect, inspectFieldEffect);

  // A player active slot fainted and needs a bench replacement chosen before the next round can be declared (docs/combat.md "KO handling": forced replacement is not optional, but WHICH bench hero fills it is the player's choice).
  const openReplacementSlots = ([0, 1] as const).filter((slot) => combat.active[PLAYER_SIDE][slot] === null && playerBench.length > 0);

  const canAct = !resolving && openReplacementSlots.length === 0 && playerActiveAlive.length > 0;
  const stepIndex = canAct ? Math.min(actionStep, playerActiveAlive.length - 1) : 0;
  // The player combatant whose move panel is currently on screen — glowed on the battlefield (CombatantCard's `acting` prop) instead of a "X's move" text label, so that vertical space goes back to the action panel.
  const actingId: string | null = canAct ? playerActiveAlive[stepIndex] : null;

  /** Whether the target-selection panel (below) is what's currently on screen for the acting hero — drives both that panel's render and the bottom-bar Back button's behavior (exit targeting back to the move grid, rather than stepping to the previous hero). */
  const showingTargetPanel = selecting !== null && selecting.combatantId === actingId;

  /**
   * The hue the whole lower half of the screen is lit in.
   *
   * This is the console's link to the arena. The player's two heroes take
   * turns commanding it, and while one is, the console is lit in *that hero's
   * domain color* — the same type color their platform, their card rim and
   * their move rows already carry. So the console reads as belonging to the
   * figure standing above it rather than as a control panel the fight happens
   * to be displayed on, and "whose turn is it" stops being carried solely by a
   * pulse on a 96px sprite.
   *
   * docs/visual-language.md lists "accent color at region boundaries" as a
   * non-goal — but that entry is about *separating* two regions with hue, and
   * this does the opposite. It is also the one thing on screen that changes
   * exactly as often as it should: twice a turn, at the moment command passes,
   * where the draft's rejected version would have re-tinted on every rail tap.
   *
   * Gold while a round resolves: nobody is commanding, the round is, and gold
   * is what the beat banner and every other "the game is speaking" surface
   * already uses.
   */
  const consoleRgb = (() => {
    if (resolving || actingId === null) return '224, 166, 60';
    const c = combat.combatants[actingId];
    return getTypeColorRgb(effectiveTypes(allCombatants[c.heroId], c)[0]);
  })();
  /**
   * ...and from WHERE they stand. The two player heroes occupy the left and
   * right halves of the ally row, so the console's light source slides to sit
   * under whichever one currently holds it.
   *
   * This is the cheapest honest answer to "these are two separate zones": a
   * light has a position, and putting the console's at the foot of the figure
   * that owns it makes the arena floor and the console one continuous lit
   * surface rather than a picture with a control panel under it. It is also
   * read-at-a-glance information — which side of the field you are commanding
   * from — delivered without a word of UI.
   *
   * Centre while a round resolves: the round belongs to nobody.
   */
  const consoleOrigin = (() => {
    if (resolving || actingId === null) return '50%';
    const slot = playerActiveAlive.indexOf(actingId);
    return slot <= 0 ? '27%' : '73%';
  })();
  const consoleStyle = { '--console-rgb': consoleRgb, '--console-origin': consoleOrigin } as CSSProperties;

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

  /** Fixed-group moves (bothEnemies/bothAllies/allOthers) have no target to choose — resolveTargets ignores declaredTarget for these — so the bottom targeting panel's Confirm button just commits the move as-is. */
  function handleConfirmSpread() {
    if (!selecting) return;
    commitAction(selecting.combatantId, { kind: 'move', moveId: selecting.move.id, declaredTarget: null });
  }

  function isSpreadTarget(mode: TargetMode): boolean {
    return mode === 'bothEnemies' || mode === 'bothAllies' || mode === 'allOthers';
  }

  /** Lowercased for mid-sentence aria-label use ("Confirm — hits both enemies") — same canonical wording as TARGET_MODE_LABELS, just not title-cased. */
  function spreadTargetLabel(mode: TargetMode): string {
    return TARGET_MODE_LABELS[mode]?.toLowerCase() ?? 'target';
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
    setReplacementPick(null);
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

  /**
   * Word readout for the targeting panel (CombatantCard's `effBadge`) —
   * spells out the matchup instead of making the player do 2×/0.5× math
   * mid-tap. Neutral (1×) intentionally has no label; callers should omit
   * the badge entirely rather than render this for mult === 1.
   */
  function effLabel(mult: number): string {
    if (mult >= 4) return 'Super Bonus!';
    if (mult > 1) return 'Bonus!';
    if (mult <= TYPE_MULT_FLOOR) return 'Super Resist!';
    return 'Resist!';
  }

  /**
   * Dual-type stacking (CLAUDE.md "TypeMult stacks multiplicatively") means a
   * defender weak to a move on both its types takes 4× rather than the 2× a
   * single-type matchup caps out at, and the reverse for a double-resist —
   * floored at TYPE_MULT_FLOOR (0.25) rather than going lower still. Two extra
   * tiers on top of the plain super/resist split so those matchups read as
   * distinctly bigger deals, not just "a bit more of the same color."
   */
  function multClass(mult: number): string {
    if (mult >= 4) return 'eff-quad-super';
    if (mult > 1) return 'eff-super';
    if (mult === 1) return 'eff-neutral';
    if (mult <= TYPE_MULT_FLOOR) return 'eff-quad-resist';
    return 'eff-resist';
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
    setBeatTrail([]);
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
    setBeatTrail((prev) => [...prev, { banner: beat.banner, meta: beat.bannerMeta, metaClass: beat.bannerMetaClass }]);
    setBannerMeta(beat.bannerMeta ?? null);
    setBannerMetaClass(beat.bannerMetaClass ?? null);
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
    if (playerRun.roster.length >= ROSTER_CAP) {
      setRosterReplaceEntry(entry);
      return;
    }
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
          activeFieldEffect={combat.activeFieldEffect}
        />
      );
    }
    const bench = combat.bench[side];
    if (side === PLAYER_SIDE && bench.length > 0 && !resolving) {
      return (
        <div className="combatant-card empty-slot" key={`empty-${side}-${slot}`}>
          <span className="fainted-tag">KO</span>
          <div className="combatant-name">Choose replacement below</div>
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

      <div
        className={`battlefield${combat.activeFieldEffect ? ' field-effect-active' : ''}`}
        style={
          combat.activeFieldEffect
            ? ({ '--field-effect-rgb': getTypeColorRgb(fieldEffects[combat.activeFieldEffect.fieldEffectId]?.flavorType ?? 'Arcane') } as CSSProperties)
            : undefined
        }
      >
        <div className="team-row enemy">
          {renderActiveSlot(AI_SIDE, 0)}
          {renderActiveSlot(AI_SIDE, 1)}
        </div>

        <div className="battlefield-divider">
          <span className="battlefield-vs">VS</span>
          {combat.activeFieldEffect && (
            /* The plaque sits centred ON the horizon, and "VS" fades out
               behind it (styles.css .field-effect-active .battlefield-vs).
               "VS" is decorative and means "nothing special is happening
               here"; a Field Effect is the single most important standing
               fact about the battlefield, so it takes the centre rather than
               being pinned into a corner beside a mark it was overlapping.
               Keyed by effect id so switching effects remounts the element
               and replays the arrival animation — an override has to read as
               a *new* field, not as a name quietly swapping in place. */
            <span
              key={combat.activeFieldEffect.fieldEffectId}
              className="field-effect-badge"
              title={`${fieldEffects[combat.activeFieldEffect.fieldEffectId]?.description ?? ''} — tap for details`}
              {...fieldEffectPress}
            >
              {/* No glyph here, deliberately — it lives on
                  FieldEffectDetailOverlay instead. This plaque is the one
                  surface in the status family that already spells its subject
                  out in words, and it is also the most size-constrained thing
                  on the screen: it has to sit inside a 13px horizon band
                  without touching either team row. Measured, a 16px icon cost
                  23px of width (190px total, 51% of the screen) and dropped
                  the clearance to each row from 6.4px to 2.2px — paying half
                  the horizon for identity the adjacent word already carries. */}
              <span className="field-effect-name">
                {fieldEffects[combat.activeFieldEffect.fieldEffectId]?.name ?? combat.activeFieldEffect.fieldEffectId}
              </span>
              {/* Duration is a flat 5 rounds for every effect
                  (FIELD_EFFECT_DURATION_ROUNDS, a locked invariant), so a
                  fixed 5-pip track reads as a clock the player can learn.
                  The old "· 4" was a bare number with no unit — indistinguishable
                  from a stack count, a tier, or a power value. */}
              <span className="field-effect-pips" aria-label={`${combat.activeFieldEffect.roundsRemaining} rounds remaining`}>
                {Array.from({ length: FIELD_EFFECT_DURATION_ROUNDS }, (_, i) => (
                  <span
                    key={i}
                    className={`field-effect-pip${i < combat.activeFieldEffect!.roundsRemaining ? '' : ' spent'}`}
                  />
                ))}
              </span>
            </span>
          )}
        </div>
        {inspectingFieldEffect && combat.activeFieldEffect && (
          <FieldEffectDetailOverlay active={combat.activeFieldEffect} onClose={() => setInspectingFieldEffect(false)} />
        )}

        <div className="team-row ally">
          {renderActiveSlot(PLAYER_SIDE, 0)}
          {renderActiveSlot(PLAYER_SIDE, 1)}
        </div>
      </div>

      <div className="action-area" style={consoleStyle}>
        <div className="console-embers" aria-hidden="true">
          {CONSOLE_EMBERS.map((e, i) => (
            <span
              key={i}
              className="console-ember"
              style={{
                left: `${e.left}%`,
                width: `${e.size}px`,
                height: `${e.size}px`,
                animationDelay: `${e.delay}s`,
                animationDuration: `${e.duration}s`,
              }}
            />
          ))}
        </div>
        {/* Narrates the current beat of a playing-out round
            (docs/architecture.md "engine / presentation separation") — who
            acted, what landed, who went down. Lives here, in the space the
            move-selection panel vacates while resolving, rather than as a
            fixed-height reservation above the battlefield that would sit
            empty (and push everything else down) the rest of the time. */}
        {resolving && (
          <div className="combat-banner">
            <div className="combat-banner-current">
              {banner && <span className="combat-banner-line">{banner}</span>}
              {bannerMeta && <span className={`combat-banner-meta${bannerMetaClass ? ` ${bannerMetaClass}` : ''}`}>{bannerMeta}</span>}
            </div>
            {/* What already happened this round, most recent first, so the
                newest history sits directly under the beat it followed and
                older lines fall off the bottom instead of pushing the current
                beat down. `beatTrail` is oldest-first, hence the slice+reverse:
                drop the last entry (that's the current beat, rendered above)
                and read backwards. The list scrolls rather than growing — the
                console's outer boundary is fixed in every state, which is the
                whole point of this pass. */}
            {beatTrail.length > 1 && (
              <div className="beat-trail">
                {beatTrail
                  .slice(0, -1)
                  .reverse()
                  .map((entry, i) => (
                    <div className="beat-trail-line" key={beatTrail.length - 2 - i}>
                      <span className="beat-trail-text">{entry.banner}</span>
                      {entry.meta && <span className={`beat-trail-meta${entry.metaClass ? ` ${entry.metaClass}` : ''}`}>{entry.meta}</span>}
                    </div>
                  ))}
              </div>
            )}
            <span className="combat-banner-hint">tap ▸ or hold to auto-play ⏵⏵</span>
          </div>
        )}
        {/* A player active slot fainted — voluntary switching/move selection
            is on hold (canAct is false, see openReplacementSlots above)
            until a bench replacement is chosen for it. Deliberately a
            select-then-Confirm flow rather than a single tap: this
            replacement can't be undone once committed, unlike the
            already-two-tap move-then-target flow above. A double KO opens
            this panel again for the second slot once the first is filled —
            openReplacementSlots recomputes off `combat`, which just changed. */}
        {!resolving &&
          openReplacementSlots.length > 0 &&
          (() => {
            const slot = openReplacementSlots[0];
            return (
              <div className="action-panel target-panel">
                <div className="target-panel-header">
                  <span className="target-panel-title">
                    Choose a Replacement{openReplacementSlots.length > 1 ? ' (1 of 2)' : ''}:
                  </span>
                </div>
                <div className="bench-row">
                  {playerBench.map((benchId) => {
                    const benchCombatant = combat.combatants[benchId];
                    const benchHero = allCombatants[benchCombatant.heroId];
                    return (
                      <CombatantCard
                        key={benchId}
                        hero={benchHero}
                        combatant={benchCombatant}
                        targetable
                        selected={replacementPick === benchId}
                        onSelectTarget={() => setReplacementPick(benchId)}
                        onInspect={() => setInspecting(benchId)}
                        popup={popups[benchId]}
                        activeFieldEffect={combat.activeFieldEffect}
                      />
                    );
                  })}
                </div>
                <button
                  className="resolve-button replacement-confirm-button"
                  disabled={!replacementPick}
                  onClick={() => replacementPick && handleForcedReplacement(slot, replacementPick)}
                >
                  Confirm
                </button>
              </div>
            );
          })()}
        {!resolving &&
          openReplacementSlots.length === 0 &&
          playerActiveAlive.length > 0 &&
          (() => {
            const id = actingId!;
            const entry = entryFor(playerRun.roster, id);
            const hero = allCombatants[combat.combatants[id].heroId];
            const combatant = combat.combatants[id];

            // Move chosen, target not yet declared: swap the move grid for a
            // bottom-anchored targeting panel instead of relying on the
            // battlefield cards up top — on mobile that's a long thumb
            // reach from the move buttons down here. The gold `.targetable`
            // glow on the battlefield cards (targetableIds, above) still
            // applies in parallel, so either tap path works. Fixed-group
            // moves (bothEnemies/bothAllies/allOthers) have nothing to pick
            // between, so their cards are shown for information only and a
            // single Confirm button commits; single-target moves render
            // each legal target as its own tappable card, which collapses
            // to one card — a de facto confirm button — whenever only one
            // target is legal (self-target moves, or a singleAlly/singleEnemy
            // move with only one candidate left standing).
            if (selecting && selecting.combatantId === id) {
              const { move } = selecting;
              const spread = isSpreadTarget(move.target);
              return (
                <div className="action-panel target-panel" key={`${id}-targeting`}>
                  {/* Same crest, one step later. "Select a Target:" in glowing
                      12px body copy beside a filled type chip was a second
                      header design for the same console, two taps apart — and
                      the instruction it carried is already the loudest thing on
                      screen, since every legal target has grown a pulsing gold
                      frame (docs/visual-language.md: "targetability becomes the
                      frame"). What the player cannot see from the frames is
                      WHICH move they are aiming, so that is what the crest's
                      trailing label becomes, in the move's own type color. */}
                  <ConsoleCrest
                    activeIds={playerActiveAlive}
                    actingId={actingId}
                    combatants={combat.combatants}
                    pending={pending}
                    isComplete={isPendingComplete}
                    label={move.name}
                    labelRgb={getTypeColorRgb(move.type)}
                  />
                  {/* A spread move has nothing to pick between, so the whole
                      row of targets doubles as the confirm control — one
                      outlined group instead of a separate confirm button
                      eating its own vertical slice below the cards. A 3-target
                      spread (allOthers) additionally drops each card's name
                      text (kept: type badges, eff badge, HP/MP) since three
                      full-width cards' dual-type badges alone can outgrow the
                      panel and force horizontal scroll. */}
                  <div
                    className={`target-row${spread ? ' target-row-spread' : ''}${spread && targetableIds.length >= 3 ? ' target-row-compact' : ''}`}
                    onClick={spread ? handleConfirmSpread : undefined}
                    role={spread ? 'button' : undefined}
                    aria-label={spread ? `Confirm — hits ${spreadTargetLabel(move.target)}` : undefined}
                  >
                    {targetableIds.map((tid) => {
                      const tHero = allCombatants[combat.combatants[tid].heroId];
                      const tCombatant = combat.combatants[tid];
                      const mult = effectivenessAgainst(move, tid);
                      return (
                        <CombatantCard
                          key={tid}
                          hero={tHero}
                          combatant={tCombatant}
                          targetable={!spread}
                          onSelectTarget={spread ? undefined : () => handleTargetClick(tid)}
                          popup={popups[tid]}
                          effBadge={mult === 1 ? null : { text: effLabel(mult), className: multClass(mult) }}
                          /* `compact` (portrait + name + type only) was right
                             when this panel was 98.7px tall with 157.9px of bare
                             console under it: HP/MP/statuses are on the
                             battlefield cards above, and repeating them bloated
                             a box that had no room. The console-fill pass
                             inverted that — the cards are 248.6px now, and the
                             choice being made is *which of these two to hit*,
                             for which how much HP one has left and what it is
                             already suffering are the two facts that decide it.
                             Redundancy costs nothing against empty space. */
                        />
                      );
                    })}
                  </div>
                </div>
              );
            }

            // Softlock fallback (CLAUDE.md "Mana & tempo"): none of this
            // hero's unlocked moves are currently affordable. Rest replaces
            // the (all-disabled) move grid entirely — Switch stays available
            // below as normal whenever a bench hero exists, so a player who
            // dumped mana into a big hit can still choose to swap in someone
            // fresh instead of resting this active hero.
            const canAffordAnyMove = hasAffordableMove(combatant.currentMana, entry.unlockedMoveIds, moves);
            return (
              <div className="action-panel" key={id}>
                <ConsoleCrest
                  activeIds={playerActiveAlive}
                  actingId={actingId}
                  combatants={combat.combatants}
                  pending={pending}
                  isComplete={isPendingComplete}
                  label={hero.name}
                />
                {!canAffordAnyMove && (
                  <div className="move-list" key={`${id}-moves`}>
                    <button
                      className={`move-button rest-button${pending[id]?.kind === 'rest' ? ' selected' : ''}`}
                      onClick={() => handleRestClick(id)}
                    >
                      <div className="move-row-top">
                        <span className="move-name">Rest</span>
                      </div>
                      <div className="move-row-effect">
                        <span className="move-effect-text">Out of Mana — recovers to full, but skips the turn</span>
                      </div>
                    </button>
                  </div>
                )}
                {canAffordAnyMove && (
                <div className="move-list">
                  {entry.unlockedMoveIds.map((moveId) => {
                    const move = moves[moveId];
                    const affordable = combatant.currentMana >= move.manaCost;
                    const isSelected =
                      (pending[id]?.kind === 'move' && pending[id]?.moveId === moveId) ||
                      (selecting?.combatantId === id && selecting.move.id === moveId);
                    const forceBonus = resolveElementalForceBonus(combatant, move.type, statuses);
                    return (
                      <button
                        key={moveId}
                        className={`move-button${isSelected ? ' selected' : ''}`}
                        /* Type is carried by the button's own material now (a
                           tinted wash + tinted rim, styles.css) instead of a
                           3px stripe glued to the left edge, so the whole
                           control is type-coded rather than wearing a tag. */
                        style={{ '--move-type-rgb': getTypeColorRgb(move.type) } as CSSProperties}
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
                        {/* One line, not two: at full row width the meta that
                            used to need its own .move-row-mid fits beside the
                            name, which frees the second line for what the button
                            was missing entirely — the effect. */}
                        <div className="move-row-top">
                          <span className="move-crystal" title={`${move.manaCost} Mana`}>
                            <strong>{move.manaCost}</strong>
                          </span>
                          <span className="move-name">{move.name}</span>
                          {/* Was a filled TypeBadge chip. One move button used to
                              hold three sub-boxes (mana crystal, type chip, kind
                              chip) inside an already-boxed control — the nesting
                              problem docs/visual-language.md names one level
                              down. The abbreviation still carries the exact type
                              (color alone can't separate 15 of them), it just
                              does it as colored text rather than as a third
                              competing rectangle. */}
                          <span className="move-type-code" title={move.type}>
                            {getTypeAbbr(move.type)}
                          </span>
                          {move.kind === 'damage' && move.basePower != null && (
                            <span
                              className={`move-power${forceBonus > 0 ? ' move-boosted' : ''}`}
                              title={forceBonus > 0 ? `Elemental Force: +${forceBonus} Base Power` : undefined}
                            >
                              <strong>{move.basePower + forceBonus}</strong>BP
                              {forceBonus > 0 && <span className="move-boosted-arrow">▲</span>}
                            </span>
                          )}
                          {move.kind === 'heal' && move.healAmount != null && (
                            <span className="move-power move-heal">
                              <strong>{move.healAmount}</strong>HEAL
                            </span>
                          )}
                          {/* Holds the power slot open on a move that has no
                              number to put in it (a buff). Without it the type
                              code lands at one x on rows carrying a BP/HEAL
                              readout and a different one on rows that don't, and
                              a 3-4 row list rags visibly between the two. */}
                          {move.kind === 'buff' && <span className="move-power move-power-empty" aria-hidden="true" />}
                          <MoveKindBadge move={move} />
                        </div>
                        {/* The decision, on the face of the control instead of
                            behind a 500ms hold on it. For an attack that is the
                            live matchup against each enemy still standing — the
                            most consequential fact in a doubles game, and one the
                            player was re-deriving by holding every move, every
                            turn. For everything else it is what the move actually
                            grants or inflicts (moveEffectSummary). Always
                            rendered, so a row's height never depends on its
                            contents. */}
                        <div className="move-row-effect">
                          {move.kind === 'damage' ? (
                            <span className="move-eff-row">
                              {enemyActiveAlive.map((eid) => {
                                const mult = effectivenessAgainst(move, eid);
                                return (
                                  <span key={eid} className={`move-eff-chip ${multClass(mult)}`}>
                                    <span className="move-eff-name">{allCombatants[combat.combatants[eid].heroId].name}</span>
                                    <span className="move-eff-mult">{formatMult(mult)}</span>
                                  </span>
                                );
                              })}
                              {move.statusApplication && <span className="move-eff-status">+{move.statusApplication.statusId}</span>}
                            </span>
                          ) : (
                            <span className="move-effect-text">{moveEffectSummary(move)}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                )}
              </div>
            );
          })()}
      </div>

      {/* Every secondary action lives in one fixed bottom row instead of
          reserving its own space (a top header for log/reference, an
          always-visible bench readout, a back button that shifted the move
          grid down) — that reserved space was the source of the mobile
          scroll this consolidation exists to eliminate. Buttons stay
          mounted and are disabled rather than hidden when inapplicable, so
          the row's height never changes turn to turn.

          Split into two weights (2026-08-26, user direction): Back and
          Switch are pressed *during* a decision, many times a fight, so they
          take double width and the row's full height — the previous
          24px-tall quarter-width row was genuinely hard to hit on a phone
          now that the app runs installed rather than in a browser tab. Log /
          Ref / Menu are consulted, not played, so they stay narrow and stack
          their glyph over a caption instead. */}
      <div className="bottom-bar" style={consoleStyle}>
        <button
          className="bottom-action bottom-action-primary"
          disabled={!(actingId !== null && (showingTargetPanel || stepIndex > 0))}
          onClick={() => (showingTargetPanel ? setSelecting(null) : setActionStep(stepIndex - 1))}
        >
          <span className="bottom-action-glyph" aria-hidden="true">
            ←
          </span>
          Back
        </button>
        <button
          className="bottom-action bottom-action-primary bottom-action-switch"
          disabled={!(actingId !== null && playerBench.length > 0 && !playerLockedIn)}
          onClick={() => setSwitchOpen(true)}
        >
          <span className="bottom-action-glyph" aria-hidden="true">
            🔄
          </span>
          Switch
        </button>
        <button className="bottom-action bottom-action-utility" onClick={() => setLogOpen(true)}>
          <span className="bottom-action-glyph" aria-hidden="true">
            📜
          </span>
          <span className="bottom-action-label">Log</span>
        </button>
        <button className="bottom-action bottom-action-utility" onClick={() => setReferenceOpen(true)}>
          <span className="bottom-action-glyph" aria-hidden="true">
            📊
          </span>
          <span className="bottom-action-label">Ref</span>
        </button>
        <button
          className="bottom-action bottom-action-utility"
          onClick={() => {
            setConfirmingQuit(false);
            setMenuOpen(true);
          }}
        >
          <span className="bottom-action-glyph" aria-hidden="true">
            ⚙
          </span>
          <span className="bottom-action-label">Menu</span>
        </button>
      </div>

      {/* Options. Deliberately the only way out of a fight that isn't
          winning or losing it: there is no save file (App.tsx holds RunState
          in component state), so abandoning is destructive and gets a
          two-tap arm/confirm rather than one button that can drop a
          45-minute run on a mis-tap. The quit entry is hidden entirely when
          the caller passes no onQuitToTitle — Quick Battle and the sandbox
          fights have no run to abandon. */}
      {menuOpen && (
        <div className="log-overlay" onClick={() => setMenuOpen(false)}>
          <div className="log-panel options-panel" onClick={(e) => e.stopPropagation()}>
            <div className="log-panel-header">
              <span>Options</span>
              <button className="log-close-button" onClick={() => setMenuOpen(false)}>
                ✕
              </button>
            </div>
            <div className="options-list">
              <button className="options-item" onClick={() => setMenuOpen(false)}>
                Resume Fight
              </button>
              {onQuitToTitle && (
                <button
                  className={`options-item options-item-danger${confirmingQuit ? ' armed' : ''}`}
                  onClick={() => (confirmingQuit ? onQuitToTitle() : setConfirmingQuit(true))}
                >
                  {confirmingQuit ? 'Tap again to abandon' : 'Quit Run — Return to Title'}
                </button>
              )}
            </div>
            {onQuitToTitle && (
              <p className="options-note">
                {confirmingQuit
                  ? 'This run ends now. Roster, relics and map progress are lost.'
                  : 'Runs are not saved. Quitting discards this one.'}
              </p>
            )}
          </div>
        </div>
      )}

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
                        activeFieldEffect={combat.activeFieldEffect}
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
          const forceBonus = resolveElementalForceBonus(combatant, move.type, statuses);
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
                  <span className="move-popup-kind">{KIND_LABELS[move.kind] ?? move.kind}</span>
                  <span className="move-popup-target">{TARGET_MODE_LABELS[move.target]}</span>
                  {move.kind === 'damage' && move.basePower != null && (
                    <span
                      className={`move-power${forceBonus > 0 ? ' move-boosted' : ''}`}
                      title={forceBonus > 0 ? `Elemental Force: +${forceBonus} Base Power` : undefined}
                    >
                      <strong>{move.basePower + forceBonus}</strong>BP
                      {forceBonus > 0 && <span className="move-boosted-arrow">▲</span>}
                    </span>
                  )}
                  {move.kind === 'heal' && move.healAmount != null && (
                    <span className="move-power move-heal">
                      <strong>{move.healAmount}</strong>HEAL
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
              activeFieldEffect={combat.activeFieldEffect}
              onClose={() => setInspecting(null)}
            />
          );
        })()}

      {winner &&
        !resolving &&
        (() => {
          const selectedClaimEntry = claimSelection ? (recruitOffers.find((e) => e.rosterId === claimSelection) ?? null) : null;
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
                        ⭐ <strong>+{trainingPointsReward}</strong> XP
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

                {winner === PLAYER_SIDE && recruitOffers.length > 0 && (
                  <div className="recruit-claims">
                    <span className="recruit-claims-glow" aria-hidden="true" />
                    <div className="recruit-claims-eyebrow">📜 Recruit Contracts available: {playerRun.recruitContracts}</div>
                    <div className="recruit-claims-grid">
                      {recruitOffers.map((entry) => {
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
                    <button
                      className={`resolve-button recruit-claim-confirm${selectedClaimEntry ? ' armed' : ''}`}
                      disabled={!selectedClaimEntry || noContracts}
                      onClick={() => selectedClaimEntry && handleClaimContract(selectedClaimEntry)}
                    >
                      {noContracts
                        ? 'No Contracts Left'
                        : selectedClaimEntry
                          ? rosterFull
                            ? `Replace a Hero for ${heroes[selectedClaimEntry.heroId].name}`
                            : `Claim ${heroes[selectedClaimEntry.heroId].name} — 1 Contract`
                          : 'Select a Hero to Recruit'}
                    </button>
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
                      relicIds={playerRelicIds}
                      onClose={() => setClaimPreviewRosterId(null)}
                    />
                  );
                })()}

              {rosterReplaceEntry && (
                <RosterReplaceScreen
                  roster={playerRun.roster}
                  candidate={{ source: 'contract', offer: deriveContractOffer(rosterReplaceEntry) }}
                  relicIds={playerRelicIds}
                  onConfirm={(terminatedRosterId) => {
                    const ok = onClaimContractReplace(rosterReplaceEntry, terminatedRosterId);
                    if (ok) {
                      setClaimedRosterIds((prev) => [...prev, rosterReplaceEntry.rosterId]);
                      setClaimSelection(null);
                      setRosterReplaceEntry(null);
                    }
                    return ok;
                  }}
                  onCancel={() => setRosterReplaceEntry(null)}
                />
              )}
            </div>
          );
        })()}
    </>
  );
}
