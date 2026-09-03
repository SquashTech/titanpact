import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { statusApplicationsOf } from '../../engine/content';
import { allCombatants } from '../../data/content';
import { moves } from '../../data/moves';
import { typeChart } from '../../data/typechart';
import { equipment } from '../../data/equipment';
import { statuses } from '../../data/statuses';
import { passives } from '../../data/passives';
import { fieldEffects } from '../../data/fieldEffects';
import { relics } from '../../data/relics';
import type { CombatState, Side } from '../../engine/state';
import {
  activePartnerTypes,
  isLockedIn,
  effectiveTypes,
  hasStatus,
  hasAffordableMoveInFight,
  resolveManaCost,
  resolveCastBasePower,
  resolveTargetMode,
  getEffectiveStat,
  getMaxHp,
  getMaxMana,
} from '../../engine/state';
import type { HealCaster } from '../../engine/heal/healPipeline';
import { resolveRound } from '../../engine/combat/resolveRound';
import { DEFAULT_PACT_CLOCK, PACT_WARNING_ROUNDS, pactFractionFor } from '../../engine/combat/pactClock';
import { applyForcedReplacement } from '../../engine/combat/switching';
import { resolveBattleStartEntries, resolvePassiveReactions } from '../../engine/combat/passiveEngine';
import { selectableTargets, statusGatedTargets } from '../../engine/combat/statusEngine';
import { FIELD_EFFECT_DURATION_ROUNDS } from '../../engine/combat/fieldEffectEngine';
import type { Action } from '../../engine/combat/actions';
import type { CombatEvent } from '../../engine/events';
import type { MoveDefinition, StatKey, TargetMode } from '../../engine/content';
import { resolveTypeMult, TYPE_MULT_FLOOR } from '../../engine/damage/typeMult';
import { resolveElementalForceBonus } from '../../engine/damage/damagePipeline';
import type { RunState, RosterEntry } from '../../run/state';
import type { Squad } from '../../run/squad';
import type { EquipmentDefinition } from '../../run/equipment';
import { buildCombatState } from '../../run/buildCombatState';
import { pickAiAction, type AiContext } from '../../run/ai';
import { relicTeamStatModifiers } from '../../run/relics';
import { relicTeamPassiveGrants } from '../../run/passives';
import { relicTeamStatusGrants } from '../../run/statusGrants';
import { CombatantCard, type Popup } from './CombatantCard';
import { HeroDetailOverlay } from './HeroDetailOverlay';
import { SwitchInPanel, type SwitchOption } from './SwitchInPanel';
import { FieldEffectDetailOverlay } from './FieldEffectDetailOverlay';
import { MoveDetailOverlay, formatMult, multClass } from './MoveDetailOverlay';
import { formatEvents, type LogLine } from './formatEvent';
import { applyEventToState } from './applyEventToState';
import { buildBeats, type Beat } from './buildBeats';
import { openingBeat } from './openingBeats';
import { playBeatSfx } from '../../audio/beatSfx';
import { setMusicRate } from '../../audio/music';
import { getTypeColorRgb } from './typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { MoveKindBadge, MoveTraitChips, TARGET_MODE_LABELS, healReadout, moveEffectSummary, riderTargetLabel, useLongPress } from '../shared/MoveTile';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';
import { AudioSettings } from '../shared/AudioSettings';
import { ManaCost } from '../shared/ManaCost';
import { HeroPortrait } from '../shared/HeroPortrait';
import { StatGlyph, STAT_LABELS } from '../shared/StatBars';
import { EquipmentEffectList, EquipmentIcon, EQUIP_SLOT_LABELS, RARITY_COLOR_VARS, RARITY_LABELS, fmtGrant } from '../shared/EquipmentBox';
import { useAmbientLocation } from '../shared/LocationContext';
import { LocationAmbience } from '../shared/LocationSky';
import type { LocationDefinition } from '../../data/locations';

/** One enemy's live matchup for a move row, precomputed by FightScreen so MoveRow needs no combat state of its own. */
interface MoveMatchup {
  id: string;
  name: string;
  mult: number;
}

/** Every live figure is resolved by the caller (it holds the Combatant and the board); the row only renders. */
interface MoveRowProps {
  move: MoveDefinition;
  /** Enough mana to press it. Unaffordable rows stay pressable at the DOM level so they can still be inspected. */
  affordable: boolean;
  /** `requiresTargetStatus` has nobody to aim at. Separate from `affordable` so the mana gem does not grey out over it. */
  gateUnmet: boolean;
  /** Live cost (state.ts resolveManaCost), not `move.manaCost`. */
  cost: number;
  selected: boolean;
  /** Elemental Force's contribution to BasePower right now. */
  forceBonus: number;
  /** damageTakenSinceLastTurn — what a retributionPercent move deals a share of. */
  banked: number;
  /** Total stat reduction standing on the active enemies — what a doublesStatReductions move would add. */
  bankedReductions: number;
  /** What a selfHpCost move would take off this hero right now; 0 when the move charges none. */
  selfHpCost: number;
  /** This round's rolled BasePower for a randomBasePower move. Derived from (seed, round, combatant, move), so re-rendering cannot re-roll it. */
  rolledBasePower: number | undefined;
  /** The half of a conditionalPower answerable without a target (user status / field / user HP / partner type). Not folded into `gateUnmet`: an unmet bonus is still a legal press. */
  userConditionMet: boolean;
  /** Whether the active partner satisfies a conditionalStatDeltas row's type. Its own flag — a move can author this and conditionalPower independently. */
  packBonusActive: boolean;
  /** What the move will actually target (resolveTargetMode) — differs from `move.target` under conditionalTarget. */
  liveTargetMode: MoveDefinition['target'];
  caster: HealCaster;
  matchups: readonly MoveMatchup[];
  onSelect: () => void;
  onInspect: () => void;
}

// Lifted out of the `.map()` because useLongPress is a hook. Unaffordable rows are
// `.is-unaffordable` + aria-disabled rather than `disabled` so a hold still opens the dossier.
function MoveRow({ move, affordable, gateUnmet, cost, selected, forceBonus, banked, bankedReductions, selfHpCost, rolledBasePower, userConditionMet, packBonusActive, liveTargetMode, caster, matchups, onSelect, onInspect }: MoveRowProps) {
  const usable = affordable && !gateUnmet;
  const longPress = useLongPress(onInspect, () => {
    if (usable) onSelect();
  });
  const heal = healReadout(move, caster);
  const rolledHigh =
    rolledBasePower != null &&
    move.randomBasePower != null &&
    rolledBasePower > (move.randomBasePower.min + move.randomBasePower.max) / 2;
  // A ramp that has actually accrued reads as boosted; the first cast, still at its authored figure, does not.
  const ramped = move.basePowerGainOnUse != null && rolledBasePower != null && rolledBasePower > (move.basePower ?? 0);
  const boosted = forceBonus > 0 || rolledHigh || ramped;

  return (
    <button
      className={`move-button${selected ? ' selected' : ''}${usable ? '' : ' is-unusable'}${affordable ? '' : ' is-unaffordable'}`}
      style={{ '--move-type-rgb': getTypeColorRgb(move.type) } as CSSProperties}
      aria-disabled={!usable}
      {...longPress}
    >
      <div className="move-row-top">
        <ManaCost cost={cost} />
        <span className="move-type-code" title={move.type}>
          <ElementGlyph type={move.type} />
        </span>
        <span className="move-name">{move.name}</span>
        {move.kind === 'damage' && (move.basePower ?? rolledBasePower) != null && (
          <span
            className={`move-power${boosted ? ' move-boosted' : ''}`}
            title={
              rolledBasePower != null && move.randomBasePower != null
                ? `Rolled this round: ${rolledBasePower} of ${move.randomBasePower.min}-${move.randomBasePower.max}${forceBonus > 0 ? ` · Elemental Force: +${forceBonus}` : ''}`
                : move.basePowerGainOnUse != null
                ? `Stacked to ${rolledBasePower ?? move.basePower} of ${move.basePowerGainOnUse.max} this fight${forceBonus > 0 ? ` · Elemental Force: +${forceBonus}` : ''}`
                : forceBonus > 0
                  ? `Elemental Force: +${forceBonus} Base Power`
                  : undefined
            }
          >
            <strong>{(rolledBasePower ?? move.basePower ?? 0) + forceBonus}</strong>BP
            {boosted && <span className="move-boosted-arrow">▲</span>}
          </span>
        )}
        {heal && (
          <span className="move-power move-heal">
            <strong>{heal.value}</strong>
          </span>
        )}
        {/* Holds the power slot open so buff rows align with BP/HEAL rows. */}
        {move.kind === 'buff' && <span className="move-power move-power-empty" aria-hidden="true" />}
        <MoveKindBadge move={move} />
      </div>
      {/* Always rendered, so a row's height never depends on its contents. */}
      <div className="move-row-effect">
        {move.kind === 'damage' ? (
          <span className="move-eff-row">
            {/* The matchups lead on a damage move so the two enemy names start at the same x on
                every row; priority and spread fall in behind them with the riders. */}
            {matchups.map(({ id, name, mult }) => (
              <span key={id} className={`move-eff-chip ${multClass(mult)}`}>
                <span className="move-eff-name">{name}</span>
                <span className="move-eff-mult">{formatMult(mult)}</span>
              </span>
            ))}
            <MoveTraitChips move={move} liveTargetMode={liveTargetMode} />
            {statusApplicationsOf(move).map((app) => {
              const where = riderTargetLabel(app);
              return (
                <span key={app.statusId} className="move-eff-status">
                  {app.chance != null ? `${Math.round(app.chance * 100)}% ` : '+'}
                  {app.statusId}
                  {where ? ` (${where})` : ''}
                </span>
              );
            })}
            {move.statDeltas?.map(({ stat, amount }, i) => (
              <span key={stat} className="move-eff-status">
                {/* One roll gates the whole list, so the odds print once. */}
                {move.statDeltaChance != null && i === 0 ? `${Math.round(move.statDeltaChance * 100)}% ` : ''}
                {amount >= 0 ? '+' : ''}
                {amount} {STAT_LABELS[stat]}
              </span>
            ))}
            {move.conditionalPower && (
              <span
                className={`move-eff-status${
                  (move.conditionalPower.requiresUserStatus ||
                    move.conditionalPower.requiresFieldEffect ||
                    move.conditionalPower.requiresPartnerType ||
                    move.conditionalPower.requiresUserHpBelow != null) &&
                  !userConditionMet
                    ? ' move-eff-unmet'
                    : ''
                }`}
              >
                ×{move.conditionalPower.multiplier}{' '}
                {move.conditionalPower.requiresPartnerType
                  ? `with a ${move.conditionalPower.requiresPartnerType} partner`
                  : move.conditionalPower.requiresFieldEffect
                  ? `under ${fieldEffects[move.conditionalPower.requiresFieldEffect]?.name ?? move.conditionalPower.requiresFieldEffect}`
                  : move.conditionalPower.requiresUserHpBelow != null
                    ? `while you are under ${Math.round(move.conditionalPower.requiresUserHpBelow * 100)}% HP`
                    : move.conditionalPower.requiresTargetHpBelow != null
                      ? `under ${Math.round(move.conditionalPower.requiresTargetHpBelow * 100)}% HP`
                      : move.conditionalPower.requiresUserStatus
                        ? `with ${move.conditionalPower.requiresUserStatus}`
                        : `vs ${move.conditionalPower.requiresTargetStatus}`}
                {move.conditionalPower.consumesStatus && !move.conditionalPower.requiresFieldEffect ? ' (spent)' : ''}
              </span>
            )}
            {move.randomBasePower && (
              <span className="move-eff-status">
                Rolls {move.randomBasePower.min}-{move.randomBasePower.max}
              </span>
            )}
            {move.randomPriority?.length && (
              <span className="move-eff-status">
                Priority {[...move.randomPriority].sort((a, b) => a - b).map((p) => (p >= 0 ? `+${p}` : `${p}`)).join('/')} random
              </span>
            )}
            {move.randomStatDeltas && (
              <span className="move-eff-status">
                +{move.randomStatDeltas.amount}{' '}
                {move.randomStatDeltas.count === 1 ? 'random stat' : `${move.randomStatDeltas.count} random stats`}
                {move.statDeltaTarget === 'self' ? ' (Self)' : ''}
              </span>
            )}
            {move.randomStatusApplication?.length && (
              <span className="move-eff-status">
                1 of {move.randomStatusApplication.map((app) => app.statusId).join('/')}
              </span>
            )}
            {move.detonatesStatus && <span className="move-eff-status">Detonates {move.detonatesStatus}</span>}
            {move.requiresTargetStatus && (
              <span className={`move-eff-status${gateUnmet ? ' move-eff-unmet' : ''}`}>
                {gateUnmet ? `Needs ${move.requiresTargetStatus}` : `${move.requiresTargetStatus} only`}
              </span>
            )}
            {move.drainPercent != null && <span className="move-eff-status">Drain {Math.round(move.drainPercent * 100)}%</span>}
            {move.offStatOverride != null && (
              <span className="move-eff-status">Uses {STAT_LABELS[move.offStatOverride]}</span>
            )}
            {move.retributionPercent != null && (
              <span className={`move-eff-status${banked > 0 ? '' : ' move-eff-unmet'}`}>
                {Math.round(banked * move.retributionPercent)} dmg banked
              </span>
            )}
            {move.recoilPercent != null && <span className="move-eff-status">Recoil {Math.round(move.recoilPercent * 100)}%</span>}
            {move.selfHpCost != null && <span className="move-eff-status">-{selfHpCost} HP</span>}
            {move.manaDiscountOnUse != null && (
              <span className="move-eff-status">Next {Math.max(0, cost - move.manaDiscountOnUse)} MP</span>
            )}
            {move.basePowerGainOnUse && (
              <span className="move-eff-status">
                Next{' '}
                {Math.min(
                  move.basePowerGainOnUse.max,
                  (rolledBasePower ?? move.basePower ?? 0) + move.basePowerGainOnUse.amount
                )}{' '}
                BP
              </span>
            )}
            {move.conditionalPriority && (
              <span className="move-eff-status">
                {move.conditionalPriority.bonus >= 0 ? '+' : ''}
                {move.conditionalPriority.bonus} priority vs {move.conditionalPriority.requiresTargetStatus}
              </span>
            )}
            {move.conditionalManaCost && (
              <span className="move-eff-status">
                {move.conditionalManaCost.requiresPartnerType ? (
                  <>
                    {move.conditionalManaCost.manaCost} MP with a {move.conditionalManaCost.requiresPartnerType} partner
                  </>
                ) : (
                  <>
                    {move.conditionalManaCost.manaCost} MP vs{' '}
                    {move.conditionalManaCost.requiresAllEnemiesStatus
                      ? `2× ${move.conditionalManaCost.requiresAllEnemiesStatus}`
                      : `1× ${move.conditionalManaCost.requiresAnyEnemyStatus}`}
                  </>
                )}
              </span>
            )}
            {move.conditionalTarget && (
              <span className={`move-eff-status${liveTargetMode === move.conditionalTarget.target ? '' : ' move-eff-unmet'}`}>
                {TARGET_MODE_LABELS[move.conditionalTarget.target]} under{' '}
                {fieldEffects[move.conditionalTarget.requiresFieldEffect]?.name ?? move.conditionalTarget.requiresFieldEffect}
              </span>
            )}
          </span>
        ) : (
          <span className="move-eff-row">
            <MoveTraitChips move={move} liveTargetMode={liveTargetMode} />
            <span className="move-effect-text">{moveEffectSummary(move, caster)}</span>
            {move.doublesStatReductions && (
              <span className={`move-eff-status${bankedReductions > 0 ? '' : ' move-eff-unmet'}`}>
                −{bankedReductions} more
              </span>
            )}
            {move.selfHpCost != null && <span className="move-eff-status">-{selfHpCost} HP</span>}
            {move.conditionalStatDeltas && (
              <span className={`move-eff-status${packBonusActive ? '' : ' move-eff-unmet'}`}>
                {packBonusActive
                  ? `×${move.conditionalStatDeltas.multiplier} now`
                  : `Needs a ${move.conditionalStatDeltas.requiresPartnerType} partner`}
              </span>
            )}
          </span>
        )}
      </div>
    </button>
  );
}

const PLAYER_SIDE: Side = 'A';
const AI_SIDE: Side = 'B';

/**
 * How much of a Location's authored weather the arena carries. Lower than any other surface:
 * this is the one screen where a mote can cross a hit number.
 */
const ARENA_MOTE_DENSITY = 0.45;

/**
 * The act's place, standing behind the fight (docs/locations.md §5.5). Memoised because the
 * arena re-renders on every beat and the particle field has nothing to say about any of them.
 */
const ArenaLocation = memo(function ArenaLocation({ location }: { location: LocationDefinition }) {
  return <LocationAmbience location={location} density={ARENA_MOTE_DENSITY} className="battlefield-location" />;
});

// Same golden-angle scatter as the title's useEmbers / draft's useMotes; stable across renders.
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

// Hold-to-auto-play: hold length before auto-play engages, and the pause between auto-advanced beats.
const AUTO_ADVANCE_HOLD_MS = 350;
const AUTO_ADVANCE_STEP_MS = 450;

// EXPERIMENTAL: music rate once a named enemy takes the field (also drops pitch — no time-stretch in Web Audio). 1 disables it.
const DREAD_MUSIC_RATE = 0.8;

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

/** Word readout for the targeting panel's effBadge. Neutral has no label — callers omit the badge for mult === 1. */
function effLabel(mult: number): string {
  if (mult >= 4) return 'Super Bonus!';
  if (mult > 1) return 'Bonus!';
  if (mult <= TYPE_MULT_FLOOR) return 'Super Resist!';
  return 'Resist!';
}

/** Modes with nothing to pick between, so the target row doubles as a confirm button. Random modes belong here: the engine rolls the target at resolution. */
function isSpreadTarget(mode: TargetMode): boolean {
  return mode === 'bothEnemies' || mode === 'bothAllies' || mode === 'allOthers' || mode === 'randomAlly' || mode === 'randomEnemy';
}

/** Lowercased for mid-sentence aria-label use. */
function spreadTargetLabel(mode: TargetMode): string {
  return TARGET_MODE_LABELS[mode]?.toLowerCase() ?? 'target';
}

interface PendingAction {
  kind: 'move' | 'switch' | 'rest';
  moveId?: string;
  declaredTarget?: string | null;
  benchedCombatantId?: string;
  /** Who comes in when a switchesUserOut move sends its caster out. Kept apart from `benchedCombatantId`, which belongs to a switch ACTION. */
  switchToCombatantId?: string | null;
}

// The command crest: one socket per active slot, mirrored to the arena (left hero reports from the left end).
// The same element renders for move selection and targeting; only the acting slot's label changes.
function ConsoleCrest({
  state,
  activeSlots,
  actingId,
  combatants,
  pending,
  isComplete,
  label,
  labelRgb,
}: {
  /** The whole fight, so the committed-move gem is priced by resolveManaCost (a cost can depend on the enemy side's statuses). */
  state: CombatState;
  /** The player's two active slots in battlefield order, nulls included. */
  activeSlots: readonly (string | null)[];
  actingId: string | null;
  combatants: CombatState['combatants'];
  pending: Record<string, PendingAction>;
  isComplete: (p: PendingAction | undefined) => boolean;
  label: string;
  /** Overrides the console's own hue — targeting colors the label by the MOVE being aimed. */
  labelRgb?: string;
}) {
  function renderSlot(slot: 0 | 1) {
    const cid = activeSlots[slot] ?? null;
    const sideClass = slot === 0 ? 'left' : 'right';
    // An empty slot still holds its end of the crest.
    if (!cid || combatants[cid].fainted) return <span key={slot} className={`console-slot ${sideClass}`} />;
    const c = combatants[cid];
    const cHero = allCombatants[c.heroId];
    const committed = isComplete(pending[cid]) ? pending[cid] : undefined;
    const committedMove = committed?.kind === 'move' ? moves[committed.moveId!] : undefined;
    const acting = cid === actingId;
    const slotLabel = acting
      ? label
      : committedMove
        ? committedMove.name
        : committed
          ? committed.kind === 'rest'
            ? 'Rest'
            : 'Switching out'
          : cHero.name;
    const slotRgb = acting ? labelRgb : committedMove ? getTypeColorRgb(committedMove.type) : undefined;
    return (
      <span key={slot} className={`console-slot ${sideClass}`}>
        <span
          className={`console-socket${acting ? ' acting' : ''}${committed ? ' committed' : ''}`}
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
          {committed && !committedMove && (
            <span className="console-socket-mark" aria-hidden="true">
              {committed.kind === 'rest' ? '◌' : '⇄'}
            </span>
          )}
        </span>
        <span
          className={`console-commander${acting ? ' acting' : ''}${!acting && !committed ? ' waiting' : ''}`}
          style={slotRgb ? ({ '--console-rgb': slotRgb } as CSSProperties) : undefined}
        >
          {/* The gem rides with the move name, not the socket: .mana-gem's own position:relative would keep it in flow there. */}
          {committedMove && <ManaCost cost={resolveManaCost(state, c.combatantId, committedMove, allCombatants)} size="sm" />}
          <span className="console-commander-text">{slotLabel}</span>
        </span>
      </span>
    );
  }

  return (
    <div className="console-crest">
      {renderSlot(0)}
      <span className="console-rule" aria-hidden="true" />
      {renderSlot(1)}
    </div>
  );
}

interface Props {
  playerRun: RunState;
  playerSquad: Squad;
  /** This node's generated encounter (src/run/enemyGen.ts). */
  aiRun: RunState;
  aiSquad: Squad;
  /** Raw relic ids, so this screen derives the team broadcasts once and hands the same ids to the hero sheets it opens. Omitted by relic-less callers (Quick Battle). */
  playerRelicIds?: readonly string[];
  /** Displayed only — the caller grants it in onResolved. */
  goldReward: number;
  /** Displayed only — the caller grants it in onResolved. */
  trainingPointsReward: number;
  /** The opener fight's guaranteed drop, rolled up front so the victory screen can show it. Displayed only. */
  equipmentReward: EquipmentDefinition | null;
  /** Fired when the player dismisses the result overlay — the caller owns what a win/loss means for the run. */
  onResolved: (outcome: 'win' | 'loss', finalState: CombatState) => void;
  /** Abandon the run (two-tap armed). Omit for fights outside a run. */
  onQuitToTitle?: () => void;
  /** Plain one-tap exit for fights outside a run (Quick Battle). A caller passes one or the other, never both. */
  onExitToTitle?: () => void;
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
  onResolved,
  onQuitToTitle,
  onExitToTitle,
}: Props) {
  /** null outside an act (sandbox, quick battle): the arena keeps its placeless neutral scene. */
  const location = useAmbientLocation();

  const teamStatModifiers = relicTeamStatModifiers(playerRelicIds, relics);
  const teamPassiveGrants = relicTeamPassiveGrants(playerRelicIds, relics);
  const teamStatusGrants = relicTeamStatusGrants(playerRelicIds, relics);

  /**
   * The two boards the intro plays between. `start` is what the player sees at first render —
   * both leads on the field, their entry passives NOT yet applied — `events` is what those
   * passives then did, and `final` is the board round 1 is declared on. Split because folding
   * them together is what made an entry passive invisible: the fight would open on stats
   * already changed, with nothing on screen having named the passive that changed them.
   */
  function openBattle(seed: number): { start: CombatState; events: CombatEvent[]; final: CombatState } {
    const start = buildInitialState(seed);
    const resolved = resolveBattleStartEntries(start, 1, allCombatants, statuses, passives, fieldEffects);
    return { start, events: resolved.events, final: resolved.state };
  }

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

  const [opening] = useState(() => openBattle(Math.floor(Math.random() * 2 ** 31)));
  const [combat, setCombat] = useState<CombatState>(opening.start);
  /** Empty at open: the opening events reach the log through the intro's beats as they reveal, like any round's. */
  const [log, setLog] = useState<LogLine[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  /** Quit is armed by a first tap and fires on the second; reset whenever the menu opens. */
  const [confirmingQuit, setConfirmingQuit] = useState(false);
  /** Bench hero tapped but not yet confirmed in the forced-replacement panel. Reset after each confirm (a double KO opens two in sequence). */
  const [replacementPick, setReplacementPick] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, PendingAction>>({});
  const [selecting, setSelecting] = useState<{ combatantId: string; move: MoveDefinition } | null>(null);
  /** Second stage of a switchesUserOut declaration: target chosen, now picking who comes in. Commits a move, not a switch. */
  const [pivoting, setPivoting] = useState<{ combatantId: string; move: MoveDefinition; declaredTarget: string | null } | null>(null);
  const [actionStep, setActionStep] = useState(0);
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [inspectingFieldEffect, setInspectingFieldEffect] = useState(false);
  // Tap-advanced round playback: `resolving` gates input while the already-decided event stream
  // is revealed one beat at a time. The queue, display state and authoritative end state live
  // in refs — only ever touched inside handleAdvance, never rendered.
  // Starts true: a fight opens mid-playback (the intro), and the mount effect below fills the
  // queue. Initialising it false would paint one frame of a live action console first.
  const [resolving, setResolving] = useState(true);
  const [beat, setBeat] = useState<Beat | null>(null);
  /** Only a React key: consecutive beats can carry identical text, and the headline must remount to replay its arrival. */
  const [beatSeq, setBeatSeq] = useState(0);
  const [popups, setPopups] = useState<Record<string, Popup>>({});
  /** The move dossier, opened by holding a move row. Carries the holder: every number on the card is relative to the commanding hero. */
  const [movePopup, setMovePopup] = useState<{ combatantId: string; move: MoveDefinition } | null>(null);
  const popupSeq = useRef(0);
  const beatQueue = useRef<Beat[]>([]);
  const displayState = useRef<CombatState | null>(null);
  const finalState = useRef<CombatState | null>(null);
  // Hold-to-auto-play: `autoEngaged` lets the trailing click (pointerup always fires one) be swallowed.
  const holdTimer = useRef<number | null>(null);
  const autoPlayInterval = useRef<number | null>(null);
  const autoEngaged = useRef(false);

  useEffect(() => {
    return () => {
      if (holdTimer.current !== null) clearTimeout(holdTimer.current);
      if (autoPlayInterval.current !== null) clearInterval(autoPlayInterval.current);
      // The act's track keeps playing past this screen, so the dread rate is restored here or never.
      setMusicRate(1);
    };
  }, []);

  // The fight's intro: the engagement beat, then whatever the leads' entry passives did. Queued
  // into the same beat player a round uses and advanced the same way — tap per beat, hold to
  // auto-play — so the fight's first input teaches the input every round after it wants.
  useEffect(() => {
    startBeatPlayback(opening.start, opening.events, opening.final, [
      openingBeat(opening.start, allCombatants, AI_SIDE, location),
    ]);
  }, []);

  /** The one StatContext every number on this screen reads through, so cards, dossier and forecast agree with resolveRound. */
  const statCtx = { active: combat.activeFieldEffect, defs: fieldEffects, board: { state: combat, passives } };

  const playerActiveAlive = aliveActiveIdsOn(combat, PLAYER_SIDE);
  const enemyActiveAlive = aliveActiveIdsOn(combat, AI_SIDE);
  const playerBench = combat.bench[PLAYER_SIDE];
  const playerLockedIn = isLockedIn(combat, PLAYER_SIDE);

  const winner: Side | null = sideDefeated(combat, PLAYER_SIDE) ? AI_SIDE : sideDefeated(combat, AI_SIDE) ? PLAYER_SIDE : null;

  // Bound to both hold and tap: a Field Effect must be one obvious tap away.
  const inspectFieldEffect = combat.activeFieldEffect ? () => setInspectingFieldEffect(true) : undefined;
  const fieldEffectPress = useLongPress(inspectFieldEffect, inspectFieldEffect);

  // A player slot fainted and needs a bench replacement before the next round can be declared.
  const openReplacementSlots = ([0, 1] as const).filter((slot) => combat.active[PLAYER_SIDE][slot] === null && playerBench.length > 0);

  const canAct = !resolving && openReplacementSlots.length === 0 && playerActiveAlive.length > 0;
  const stepIndex = canAct ? Math.min(actionStep, playerActiveAlive.length - 1) : 0;
  const actingId: string | null = canAct ? playerActiveAlive[stepIndex] : null;

  /** Drives the target panel and the Back button (exit targeting rather than step to the previous hero). */
  const showingTargetPanel = selecting !== null && selecting.combatantId === actingId;

  /**
   * Rest is a recovery, not a pass: the key stays dark while the hero has nothing to recover, so
   * the row never offers a turn that would only be spent. Any missing mana at all opens it —
   * partial recovery is a real play. Overflow (docs/mana.md) reads as full: `<`, not `!==`.
   * The out-of-mana Rest row in the grid is unaffected, so the softlock escape is never gated.
   */
  const actingCanRest =
    actingId !== null &&
    combat.combatants[actingId].currentMana <
      getMaxMana(allCombatants[combat.combatants[actingId].heroId], combat.combatants[actingId]);

  // The console is lit in the commanding hero's domain color, from under that hero's side of the
  // field; gold and centred while a round resolves (nobody is commanding).
  const consoleRgb = (() => {
    if (resolving || actingId === null) return '224, 166, 60';
    const c = combat.combatants[actingId];
    return getTypeColorRgb(effectiveTypes(allCombatants[c.heroId], c)[0]);
  })();
  const consoleOrigin = (() => {
    if (resolving || actingId === null) return '50%';
    const slot = playerActiveAlive.indexOf(actingId);
    return slot <= 0 ? '27%' : '73%';
  })();
  const consoleStyle = { '--console-rgb': consoleRgb, '--console-origin': consoleOrigin } as CSSProperties;

  // Gate first, Stealth second, matching resolveRound's order. `statuses` lets a Provoke narrow the picker.
  function visibleTargets(move: MoveDefinition, ids: string[]): string[] {
    return selectableTargets(combat, move.target, move.kind, statusGatedTargets(combat, move, ids), statuses);
  }

  /** Whether a requiresTargetStatus move has anyone to hit — drives the dead row so the player is refused at the button, not in an empty panel. */
  function hasLegalTarget(move: MoveDefinition, casterId: string): boolean {
    if (!move.requiresTargetStatus) return true;
    const pool =
      move.target === 'singleAlly' || move.target === 'bothAllies'
        ? playerActiveAlive
        : move.target === 'self'
          ? [casterId]
          : move.target === 'allOthers'
            ? [...enemyActiveAlive, ...playerActiveAlive].filter((cid) => cid !== casterId)
            : enemyActiveAlive;
    return statusGatedTargets(combat, move, pool).length > 0;
  }

  const targetableIds: string[] = !selecting
    ? []
    : selecting.move.target === 'singleEnemy'
      ? visibleTargets(selecting.move, enemyActiveAlive)
      : selecting.move.target === 'singleAlly'
        ? visibleTargets(selecting.move, playerActiveAlive)
        : selecting.move.target === 'self'
          ? [selecting.combatantId]
          : selecting.move.target === 'bothEnemies' || selecting.move.target === 'randomEnemy'
            ? visibleTargets(selecting.move, enemyActiveAlive)
            : selecting.move.target === 'bothAllies' || selecting.move.target === 'randomAlly'
              ? visibleTargets(selecting.move, playerActiveAlive)
              : selecting.move.target === 'allOthers'
                ? visibleTargets(
                    selecting.move,
                    [...enemyActiveAlive, ...playerActiveAlive].filter((cid) => cid !== selecting.combatantId)
                  )
                : [];

  function isPendingComplete(p: PendingAction | undefined): boolean {
    if (!p) return false;
    if (p.kind === 'switch') return !!p.benchedCombatantId;
    if (p.kind === 'rest') return true;
    const move = moves[p.moveId!];
    if ((move.target === 'singleEnemy' || move.target === 'singleAlly') && !p.declaredTarget) return false;
    return true;
  }

  /** Whether a switchesUserOut move has anyone to pivot to. The move stays pressable either way — it degrades to its buff, as the engine resolves it. */
  function canPivot(): boolean {
    return playerBench.length > 0 && !isLockedIn(combat, PLAYER_SIDE);
  }

  /**
   * Commits an action and advances to the next active hero, or resolves the round if this was the
   * last to declare. Takes the resolved pending map so the just-committed action is visible now.
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

  // Always a two-tap commit: this loads the move and lights its targets; a second tap on a card commits.
  function handleMoveClick(combatantId: string, move: MoveDefinition) {
    setSelecting({ combatantId, move });
  }

  /** Commits the selected move against `targetId`, or holds it in `pivoting` when a switchesUserOut move still needs its replacement chosen. */
  function declareSelectedMove(targetId: string | null) {
    if (!selecting) return;
    if (selecting.move.switchesUserOut && canPivot()) {
      setPivoting({ combatantId: selecting.combatantId, move: selecting.move, declaredTarget: targetId });
      setSelecting(null);
      return;
    }
    commitAction(selecting.combatantId, { kind: 'move', moveId: selecting.move.id, declaredTarget: targetId });
  }

  function handleTargetClick(targetId: string) {
    declareSelectedMove(targetId);
  }

  /** Fixed-group moves have no target to choose — resolveTargets ignores declaredTarget for them. */
  function handleConfirmSpread() {
    declareSelectedMove(null);
  }

  function handleSwitchClick(combatantId: string, benchedCombatantId: string) {
    commitAction(combatantId, { kind: 'switch', benchedCombatantId });
  }

  function handleRestClick(combatantId: string) {
    commitAction(combatantId, { kind: 'rest' });
  }

  function handleForcedReplacement(slot: 0 | 1, benchedCombatantId: string) {
    const result = applyForcedReplacement(combat, combat.round, PLAYER_SIDE, slot, benchedCombatantId, statuses);
    // A replacement is still an arrival — same entry hook a declared switch runs, applied here because forced replacement resolves outside a round.
    const entry = resolvePassiveReactions(result.state, combat.round, result.events, allCombatants, statuses, passives, fieldEffects);
    setCombat(entry.state);
    appendLog(formatEvents([...result.events, ...entry.events], allCombatants, entry.state.combatants, moves));
    setReplacementPick(null);
  }

  // formatEvents keys by round+index within its own call, which collides across calls in one round; re-key against the running length.
  function appendLog(newLines: LogLine[]) {
    setLog((prev) => [...prev, ...newLines.map((l, i) => ({ ...l, key: `${prev.length + i}-${l.key}` }))]);
  }

  const aiContext: AiContext = {
    heroes: allCombatants,
    moves,
    statuses,
    typeChart,
    moveIdsFor: (combatantId) => {
      const entry = entryFor(aiRun.roster, combatantId);
      if (entry.unlockedMoveIds.length > 0) return entry.unlockedMoveIds;
      return allCombatants[combat.combatants[combatantId].heroId].moveIds;
    },
  };

  function effectivenessAgainst(move: MoveDefinition, defenderId: string): number {
    const defender = combat.combatants[defenderId];
    const defenderHero = allCombatants[defender.heroId];
    return resolveTypeMult(typeChart, move.type, effectiveTypes(defenderHero, defender));
  }

  function enemyEntries() {
    return enemyActiveAlive.map((eid) => {
      const c = combat.combatants[eid];
      return { hero: allCombatants[c.heroId], combatant: c };
    });
  }

  function benchOptions(isSelected: (benchId: string) => boolean, isClaimedByOther: (benchId: string) => boolean): SwitchOption[] {
    return playerBench.map((benchId) => {
      const benchCombatant = combat.combatants[benchId];
      return {
        combatantId: benchId,
        hero: allCombatants[benchCombatant.heroId],
        combatant: benchCombatant,
        moveIds: entryFor(playerRun.roster, benchId).unlockedMoveIds,
        selected: isSelected(benchId),
        claimedByOther: isClaimedByOther(benchId),
      };
    });
  }

  function resolveRoundWith(pendingMap: Record<string, PendingAction>) {
    const playerActions: Action[] = playerActiveAlive.map((id) => {
      const p = pendingMap[id];
      if (p.kind === 'switch') return { kind: 'switch', combatantId: id, benchedCombatantId: p.benchedCombatantId! };
      if (p.kind === 'rest') return { kind: 'rest', combatantId: id };
      return {
        kind: 'move',
        combatantId: id,
        moveId: p.moveId!,
        declaredTarget: p.declaredTarget,
        switchToCombatantId: p.switchToCombatantId,
      };
    });
    const aiActions: Action[] = enemyActiveAlive.map((id) => pickAiAction(combat, id, aiContext));

    const result = resolveRound(combat, [...playerActions, ...aiActions], config);
    let nextState = result.state;
    const events = [...result.events];

    // The AI auto-replaces fainted slots from its bench right away (forced replacement ignores lock-in).
    for (const slot of [0, 1] as const) {
      if (nextState.active[AI_SIDE][slot] === null && nextState.bench[AI_SIDE].length > 0) {
        const inId = nextState.bench[AI_SIDE][0];
        const r = applyForcedReplacement(nextState, nextState.round, AI_SIDE, slot, inId, statuses);
        nextState = r.state;
        events.push(...r.events);
        const entry = resolvePassiveReactions(nextState, nextState.round, r.events, allCombatants, statuses, passives, fieldEffects);
        nextState = entry.state;
        events.push(...entry.events);
      }
    }

    startBeatPlayback(combat, events, nextState);
  }

  // Loads the resolved round's beats and reveals the first; `finalState` is applied verbatim once
  // the queue empties, so playback can never drift from the authoritative result.
  // `prelude` is for beats that are not grouped from events — today only the intro's engagement beat.
  function startBeatPlayback(startState: CombatState, events: CombatEvent[], nextFinalState: CombatState, prelude: Beat[] = []) {
    const beats = [...prelude, ...buildBeats(events, allCombatants, moves, startState.combatants, PLAYER_SIDE)];
    displayState.current = startState;
    finalState.current = nextFinalState;
    beatQueue.current = beats;
    setResolving(true);
    handleAdvance();
  }

  /** Reveals the next beat, or finalizes the round once the queue is empty. Returns whether a beat was shown, so the auto-play loop knows when to stop. */
  function handleAdvance(): boolean {
    const revealed = beatQueue.current.shift();

    if (!revealed) {
      setCombat(finalState.current!);
      setPopups({});
      setBeat(null);
      setResolving(false);
      setPending({});
      setSelecting(null);
      setMovePopup(null);
      setSwitchOpen(false);
      setActionStep(0);
      return false;
    }

    let next = displayState.current!;
    for (const event of revealed.events) next = applyEventToState(next, event);
    displayState.current = next;

    setCombat(next);
    appendLog(formatEvents(revealed.events, allCombatants, next.combatants, moves));
    playBeatSfx(revealed);
    // EXPERIMENTAL: a dramatic entrance drags the music down for the rest of the fight. Delete this line to drop it.
    if (revealed.dramaticEntrance) setMusicRate(DREAD_MUSIC_RATE);
    setBeat(revealed);
    setBeatSeq((n) => n + 1);
    setPopups(Object.fromEntries(revealed.popups.map((p) => [p.combatantId, { key: popupSeq.current++, text: p.text, className: p.className }])));
    return true;
  }

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

  function engageAutoPlay() {
    holdTimer.current = null;
    autoEngaged.current = true;
    if (!handleAdvance()) return;
    autoPlayInterval.current = window.setInterval(() => {
      if (!handleAdvance()) stopAutoAdvance();
    }, AUTO_ADVANCE_STEP_MS);
  }

  function handleAdvancePointerDown() {
    // Reset here, not only on the trailing click: a pointercancel skips the click entirely.
    autoEngaged.current = false;
    holdTimer.current = window.setTimeout(engageAutoPlay, AUTO_ADVANCE_HOLD_MS);
  }

  /** A press that engaged auto-play already revealed its beats, so its trailing click is swallowed. */
  function handleAdvanceClick() {
    if (autoEngaged.current) {
      autoEngaged.current = false;
      return;
    }
    handleAdvance();
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
          statCtx={statCtx}
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
      {/* Full-screen tap-to-advance catcher; sits below the log overlay's z-index. */}
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
        className={`battlefield${combat.activeFieldEffect ? ' field-effect-active' : ''}${
          resolving && beat?.dramaticEntrance ? ' dramatic-entrance' : ''
        }`}
        /* The Location's lighting recipe keys off this; absent, styles.css's placeless arena stands. */
        data-location={location?.id}
        style={
          {
            ...(combat.activeFieldEffect
              ? { '--field-effect-rgb': getTypeColorRgb(fieldEffects[combat.activeFieldEffect.fieldEffectId]?.flavorType ?? 'Arcane') }
              : null),
            ...(location ? { '--node-rgb': location.tintRgb } : null),
          } as CSSProperties
        }
      >
        {location && <ArenaLocation location={location} />}
        {/* Keyed on beatSeq so the one-shot animation replays per reveal. */}
        {resolving && beat?.dramaticEntrance && <div key={beatSeq} className="dramatic-entrance-veil" aria-hidden="true" />}

        {/* Pact Clock face: driven off combat.round, not events, so it is right on first render. */}
        {combat.round >= DEFAULT_PACT_CLOCK.startRound - PACT_WARNING_ROUNDS && (
          <div
            className={`pact-warning${combat.round >= DEFAULT_PACT_CLOCK.startRound ? ' is-due' : ''}`}
            role="status"
          >
            <span className="pact-warning-mark" aria-hidden="true" />
            <span className="pact-warning-text">
              {combat.round >= DEFAULT_PACT_CLOCK.startRound
                ? `The pact is due — ${Math.round(pactFractionFor(combat.round, DEFAULT_PACT_CLOCK) * 100)}% HP from everyone this round`
                : `The pact comes due in ${DEFAULT_PACT_CLOCK.startRound - combat.round} ${
                    DEFAULT_PACT_CLOCK.startRound - combat.round === 1 ? 'round' : 'rounds'
                  }`}
            </span>
          </div>
        )}

        <div className="team-row enemy">
          {renderActiveSlot(AI_SIDE, 0)}
          {renderActiveSlot(AI_SIDE, 1)}
        </div>

        <div className="battlefield-divider">
          <span className="battlefield-vs">VS</span>
          {combat.activeFieldEffect && (
            /* Keyed by effect id so an override remounts and replays the arrival. No glyph: the plaque must fit a 13px horizon band. */
            <span
              key={combat.activeFieldEffect.fieldEffectId}
              className="field-effect-badge"
              title={`${fieldEffects[combat.activeFieldEffect.fieldEffectId]?.description ?? ''} — tap for details`}
              {...fieldEffectPress}
            >
              <span className="field-effect-name">
                {fieldEffects[combat.activeFieldEffect.fieldEffectId]?.name ?? combat.activeFieldEffect.fieldEffectId}
              </span>
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
        {resolving && beat && (
          /* The beat's color sits on the OUTER element: the inner one remounts every beat, and a remounting background cannot cross-fade. */
          <div
            className={`combat-banner${beat.bannerFocusKind ? ` banner-kind-${beat.bannerFocusKind}` : ''}`}
            style={beat.bannerAccent ? ({ '--banner-accent': beat.bannerAccent } as CSSProperties) : undefined}
          >
            <div className="combat-banner-current" key={beatSeq}>
              {beat.bannerLead && <span className="combat-banner-lead">{beat.bannerLead}</span>}
              <span className={`combat-banner-focus${beat.bannerFocus ? '' : ' banner-focus-sentence'}`}>{beat.bannerFocus ?? beat.banner}</span>
              {beat.bannerSub && <span className="combat-banner-sub">{beat.bannerSub}</span>}
              {beat.bannerTag && <span className="combat-banner-tag">{beat.bannerTag}</span>}
              {beat.bannerMeta && (
                <span className={`combat-banner-meta${beat.bannerMetaClass ? ` ${beat.bannerMetaClass}` : ''}`}>{beat.bannerMeta}</span>
              )}
            </div>
            <span className="combat-banner-hint">tap ▸ or hold to auto-play ⏵⏵</span>
          </div>
        )}
        {/* Forced replacement: select-then-Confirm, since it cannot be undone once committed. */}
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
                        statCtx={statCtx}
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
            const combatant = combat.combatants[id];
            const hero = allCombatants[combatant.heroId];

            // Move chosen, target not yet declared: a bottom-anchored targeting panel in place of the
            // move grid. The gold `.targetable` glow on the battlefield cards still applies in parallel.
            if (selecting && selecting.combatantId === id) {
              const { move } = selecting;
              const spread = isSpreadTarget(move.target);
              return (
                <div className="action-panel target-panel" key={`${id}-targeting`}>
                  <ConsoleCrest
                    state={combat}
                    activeSlots={combat.active[PLAYER_SIDE]}
                    actingId={actingId}
                    combatants={combat.combatants}
                    pending={pending}
                    isComplete={isPendingComplete}
                    label={move.name}
                    labelRgb={getTypeColorRgb(move.type)}
                  />
                  {/* A spread move's whole target row doubles as the confirm control. */}
                  <div
                    className={`target-row${spread ? ' target-row-spread' : ''}${spread && targetableIds.length >= 3 ? ' target-row-compact' : ''}`}
                    onClick={spread ? handleConfirmSpread : undefined}
                    role={spread ? 'button' : undefined}
                    aria-label={spread ? `Confirm — hits ${spreadTargetLabel(move.target)}` : undefined}
                  >
                    {targetableIds.map((tid) => {
                      const tCombatant = combat.combatants[tid];
                      const mult = effectivenessAgainst(move, tid);
                      return (
                        <CombatantCard
                          key={tid}
                          hero={allCombatants[tCombatant.heroId]}
                          combatant={tCombatant}
                          targetable={!spread}
                          onSelectTarget={spread ? undefined : () => handleTargetClick(tid)}
                          popup={popups[tid]}
                          effBadge={mult === 1 ? null : { text: effLabel(mult), className: multClass(mult) }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            }

            // Softlock fallback (CLAUDE.md "Mana & tempo"): Rest replaces an all-unaffordable grid, carrying the explanation the bottom-bar key has no room for.
            const canAffordAnyMove = hasAffordableMoveInFight(combat, id, entry.unlockedMoveIds, moves, allCombatants);
            const maxHp = getMaxHp(hero, combatant);
            const partnerTypes = activePartnerTypes(combat, id, allCombatants) ?? [];
            const caster: HealCaster = {
              wisdom: getEffectiveStat(hero, combatant, 'wisdom', statCtx),
              types: effectiveTypes(hero, combatant),
            };
            const bankedReductions = enemyActiveAlive.reduce(
              (sum, eid) =>
                sum +
                Object.values(combat.combatants[eid].statModifiers).reduce(
                  (acc, v) => acc + (typeof v === 'number' && v < 0 ? -v : 0),
                  0
                ),
              0
            );
            return (
              <div className="action-panel" key={id}>
                <ConsoleCrest
                  state={combat}
                  activeSlots={combat.active[PLAYER_SIDE]}
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
                    const cost = resolveManaCost(combat, id, move, allCombatants);
                    const isSelected =
                      (pending[id]?.kind === 'move' && pending[id]?.moveId === moveId) ||
                      (selecting?.combatantId === id && selecting.move.id === moveId);
                    return (
                      <MoveRow
                        key={moveId}
                        move={move}
                        affordable={combatant.currentMana >= cost}
                        gateUnmet={!hasLegalTarget(move, id)}
                        cost={cost}
                        selected={isSelected}
                        forceBonus={resolveElementalForceBonus(combatant, move.type, statuses)}
                        banked={combatant.damageTakenSinceLastTurn}
                        bankedReductions={bankedReductions}
                        rolledBasePower={resolveCastBasePower(combat, id, move, combatant.moveBasePowerBonuses)}
                        selfHpCost={
                          move.selfHpCost == null
                            ? 0
                            : move.selfHpCost.mode === 'percentMaxHp'
                              ? Math.round(maxHp * move.selfHpCost.amount)
                              : Math.max(0, combatant.currentHp - move.selfHpCost.amount)
                        }
                        userConditionMet={
                          move.conditionalPower?.requiresPartnerType
                            ? partnerTypes.includes(move.conditionalPower.requiresPartnerType)
                            : move.conditionalPower?.requiresFieldEffect
                            ? combat.activeFieldEffect?.fieldEffectId === move.conditionalPower.requiresFieldEffect
                            : move.conditionalPower?.requiresUserHpBelow != null
                              ? combatant.currentHp < maxHp * move.conditionalPower.requiresUserHpBelow
                              : !move.conditionalPower?.requiresUserStatus ||
                                hasStatus(combatant, move.conditionalPower.requiresUserStatus)
                        }
                        packBonusActive={
                          move.conditionalStatDeltas != null && partnerTypes.includes(move.conditionalStatDeltas.requiresPartnerType)
                        }
                        liveTargetMode={resolveTargetMode(combat, move)}
                        caster={caster}
                        matchups={
                          move.kind === 'damage'
                            ? enemyActiveAlive.map((eid) => ({
                                id: eid,
                                name: allCombatants[combat.combatants[eid].heroId].name,
                                mult: effectivenessAgainst(move, eid),
                              }))
                            : []
                        }
                        onSelect={() => handleMoveClick(id, move)}
                        onInspect={() => setMovePopup({ combatantId: id, move })}
                      />
                    );
                  })}
                </div>
                )}
              </div>
            );
          })()}
      </div>

      {/* Fixed bottom row; buttons stay mounted and disable rather than hide, so the row's height never changes.
          While a target is being chosen it collapses to a single full-width Back — that state has one legal exit. */}
      <div className={`bottom-bar${showingTargetPanel ? ' bottom-bar-solo' : ''}`} style={consoleStyle}>
        <button
          className="bottom-action bottom-action-primary bottom-action-back"
          disabled={!(actingId !== null && (showingTargetPanel || stepIndex > 0))}
          onClick={() => (showingTargetPanel ? setSelecting(null) : setActionStep(stepIndex - 1))}
        >
          <span className="bottom-action-glyph" aria-hidden="true">
            ←
          </span>
          Back
        </button>
        {!showingTargetPanel && (
          <>
            <button
              className="bottom-action bottom-action-primary bottom-action-switch"
              disabled={!(actingId !== null && playerBench.length > 0 && !playerLockedIn)}
              onClick={() => setSwitchOpen(true)}
            >
              {/* ⇄, not an emoji: an emoji cannot take the key's own color. */}
              <span className="bottom-action-glyph" aria-hidden="true">
                ⇄
              </span>
              Switch
            </button>
            {/* A one-tap commit, like the out-of-mana Rest row it duplicates. Deliberately not
                adjacent to Back: the keys either side of it only open panels, so the row's one
                irreversible key never sits under the thumb that is reaching for undo. Dark at
                full mana — see actingCanRest. */}
            <button
              className={`bottom-action bottom-action-primary bottom-action-rest${
                actingId !== null && pending[actingId]?.kind === 'rest' ? ' selected' : ''
              }`}
              disabled={!actingCanRest}
              onClick={() => actingId !== null && handleRestClick(actingId)}
            >
              <span className="bottom-action-glyph" aria-hidden="true">
                ☾
              </span>
              Rest
            </button>
            <button
              className="bottom-action bottom-action-utility"
              onClick={() => {
                setConfirmingQuit(false);
                setMenuOpen(true);
              }}
            >
              <span className="bottom-action-glyph" aria-hidden="true">
                ☰
              </span>
              <span className="bottom-action-label">Menu</span>
            </button>
          </>
        )}
      </div>

      {/* Options. Quitting is destructive (no save file), so it is a two-tap arm/confirm. */}
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
              {/* The readers close the menu on the way out: both share the .log-overlay scrim, and stacking would leave Options visible behind. */}
              <button
                className="options-item"
                onClick={() => {
                  setMenuOpen(false);
                  setLogOpen(true);
                }}
              >
                <span className="options-item-glyph" aria-hidden="true">
                  📜
                </span>
                Battle Log
              </button>
              <button
                className="options-item"
                onClick={() => {
                  setMenuOpen(false);
                  setReferenceOpen(true);
                }}
              >
                <span className="options-item-glyph" aria-hidden="true">
                  📊
                </span>
                Reference — Types &amp; Statuses
              </button>
              <AudioSettings />
              <button className="options-item" onClick={() => setMenuOpen(false)}>
                <span className="options-item-glyph" aria-hidden="true">
                  ▶
                </span>
                Resume Fight
              </button>
              {onExitToTitle && (
                <button className="options-item" onClick={onExitToTitle}>
                  <span className="options-item-glyph" aria-hidden="true">
                    ⏏
                  </span>
                  Back to Title Screen
                </button>
              )}
              {onQuitToTitle && (
                <button
                  className={`options-item options-item-danger${confirmingQuit ? ' armed' : ''}`}
                  onClick={() => (confirmingQuit ? onQuitToTitle() : setConfirmingQuit(true))}
                >
                  <span className="options-item-glyph" aria-hidden="true">
                    {confirmingQuit ? '⚠' : '🚪'}
                  </span>
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

      {/* Stage two of a switchesUserOut declaration — the same panel as a plain switch, committing a move instead. Dismissing drops the whole move. */}
      {pivoting &&
        (() => {
          const { combatantId, move, declaredTarget } = pivoting;
          const outgoing = combat.combatants[combatantId];
          return (
            <SwitchInPanel
              outgoingHero={allCombatants[outgoing.heroId]}
              outgoing={outgoing}
              typeChart={typeChart}
              moves={moves}
              enemies={enemyEntries()}
              options={benchOptions(
                () => false,
                // Same claim rule as the switch panel, extended to another hero's pivot.
                (benchId) =>
                  Object.entries(pending).some(
                    ([pid, p]) =>
                      pid !== combatantId &&
                      ((p.kind === 'switch' && p.benchedCombatantId === benchId) ||
                        (p.kind === 'move' && p.switchToCombatantId === benchId))
                  )
              )}
              onPick={(benchId) => {
                setPivoting(null);
                commitAction(combatantId, { kind: 'move', moveId: move.id, declaredTarget, switchToCombatantId: benchId });
              }}
              onInspect={(benchId) => setInspecting(benchId)}
              onClose={() => setPivoting(null)}
            />
          );
        })()}

      {switchOpen &&
        actingId &&
        (() => {
          const id = actingId;
          const outgoing = combat.combatants[id];
          return (
            <SwitchInPanel
              outgoingHero={allCombatants[outgoing.heroId]}
              outgoing={outgoing}
              typeChart={typeChart}
              moves={moves}
              enemies={enemyEntries()}
              options={benchOptions(
                (benchId) => pending[id]?.kind === 'switch' && pending[id]?.benchedCombatantId === benchId,
                (benchId) =>
                  Object.entries(pending).some(
                    ([pid, p]) => pid !== id && p.kind === 'switch' && p.benchedCombatantId === benchId
                  )
              )}
              onPick={(benchId) => {
                handleSwitchClick(id, benchId);
                setSwitchOpen(false);
              }}
              onInspect={(benchId) => setInspecting(benchId)}
              onClose={() => setSwitchOpen(false)}
            />
          );
        })()}

      {movePopup && (
        <MoveDetailOverlay
          move={movePopup.move}
          context={{ combat, attackerId: movePopup.combatantId, defenderIds: enemyActiveAlive }}
          onClose={() => setMovePopup(null)}
        />
      )}

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
              statCtx={statCtx}
              onClose={() => setInspecting(null)}
            />
          );
        })()}

      {winner &&
        !resolving &&
        (() => {
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
                              <StatGlyph stat={stat} tone="inherit" /> {STAT_LABELS[stat]} {fmtGrant(amount)}
                            </span>
                          ))}
                      </div>
                    )}
                    <EquipmentEffectList item={equipmentReward} />
                  </div>
                )}

                <div className="result-buttons">
                  <button onClick={() => onResolved(winner === PLAYER_SIDE ? 'win' : 'loss', combat)}>Continue</button>
                </div>
              </div>
            </div>
          );
        })()}
    </>
  );
}
