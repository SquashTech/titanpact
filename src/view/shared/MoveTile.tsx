import { useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import type { MoveDefinition, StatusApplication } from '../../engine/content';
import { statusApplicationsOf } from '../../engine/content';
import { resolveHealFor, type HealCaster } from '../../engine/heal/healPipeline';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { fieldEffects } from '../../data/fieldEffects';
import { statuses } from '../../data/statuses';
import { STAT_LABELS } from './StatBars';
import { ElementGlyph } from './elementIcons';
import { MoveKindGlyph, type MoveKindGlyphKind } from './statIcons';
import { ManaCost } from './ManaCost';

// --- Hold-to-inspect gesture ---

export const LONG_PRESS_MS = 500;

/** Past this much travel the gesture is a scroll, not a hold. Generous: a resting thumb wanders. */
const HOLD_CANCEL_PX = 12;

/**
 * A ~500ms press calls `onLongPress`, a tap calls `onClick`; the click after a completed hold is
 * swallowed. Returns `data-holding` while the timer runs (styles.css `[data-holding]`) and cancels
 * on movement — on touch the pointer stays captured, so `pointerleave` never fires mid-scroll.
 */
export function useLongPress(onLongPress?: () => void, onClick?: () => void) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const [holding, setHolding] = useState(false);

  function clearTimer() {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    origin.current = null;
    setHolding(false);
  }

  return {
    // Absent rather than `false` when idle: `[data-holding]` matches any value, empty string included.
    'data-holding': holding ? '' : undefined,
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
    onPointerDown: (e: PointerEvent) => {
      if (!onLongPress) return;
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      setHolding(true);
      timer.current = window.setTimeout(() => {
        fired.current = true;
        clearTimer();
        // Feature-detected: iOS Safari has no Vibration API.
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(12);
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: PointerEvent) => {
      const from = origin.current;
      if (!from) return;
      if (Math.abs(e.clientX - from.x) > HOLD_CANCEL_PX || Math.abs(e.clientY - from.y) > HOLD_CANCEL_PX) clearTimer();
    },
    onPointerUp: clearTimer,
    onPointerCancel: clearTimer,
    onPointerLeave: clearTimer,
    onClick: (e: MouseEvent) => {
      e.stopPropagation();
      if (fired.current) {
        fired.current = false;
        return;
      }
      onClick?.();
    },
  };
}

/**
 * Swallows the next document click for a short grace window. Call when a long-press opens a popup
 * covering the tile: the pointerup lands on the popup, and the mousedown/pointerup target mismatch
 * makes the browser synthesize a click on the common ancestor — which may dismiss it.
 */
export function swallowGhostClick() {
  const swallow = (e: Event) => e.stopPropagation();
  document.addEventListener('click', swallow, { capture: true, once: true });
  window.setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 400);
}

// --- Move kind / labels ---

/** Grants vs Applies: a `positive` status is granted whoever it lands on; a self-cast is always a grant. */
export function grantsRatherThanInflicts(app: StatusApplication): boolean {
  return app.target === 'self' || statuses[app.statusId]?.positive === true;
}

// `kind: 'buff'` covers both signs in the data; the sign is recovered here, once, so glyph, badge
// colour and label can never disagree. A move carrying both reads as a debuff (open UI question).
function isDebuff(move: MoveDefinition): boolean {
  if (move.statDeltas?.some(({ amount }) => amount < 0)) return true;
  // doublesStatReductions authors no deltas and no status of its own.
  if (move.doublesStatReductions) return true;
  return statusApplicationsOf(move).some((app) => app.target !== 'self' && !statuses[app.statusId]?.positive);
}

/** The one MoveDefinition -> MoveKindGlyphKind mapping in the app. */
export function moveKindGlyph(move: MoveDefinition): MoveKindGlyphKind {
  if (move.kind === 'damage') return move.category;
  if (move.kind === 'heal') return 'heal';
  return isDebuff(move) ? 'debuff' : 'buff';
}

export function moveKindLabel(move: MoveDefinition): string {
  if (move.kind === 'damage') return 'Damage';
  if (move.kind === 'heal') return 'Heal';
  return isDebuff(move) ? 'Debuff' : 'Buff';
}

const CATEGORY_LABELS: Record<MoveDefinition['category'], string> = { physical: 'PHY', magical: 'MAG' };

/** Canonical player-facing name per TargetMode; FightScreen's targeting copy reads this too. */
export const TARGET_MODE_LABELS: Record<MoveDefinition['target'], string> = {
  singleEnemy: 'Single Enemy',
  bothEnemies: 'Both Enemies',
  singleAlly: 'Single Ally',
  bothAllies: 'Both Allies',
  self: 'Self',
  allOthers: 'All',
  randomAlly: 'Random Ally',
  randomEnemy: 'Random Enemy',
};

// Random modes are not spread: exactly one combatant is drawn.
const SPREAD_TARGET_MODES: ReadonlySet<MoveDefinition['target']> = new Set(['bothEnemies', 'bothAllies', 'allOthers']);

export function isSpreadTarget(target: MoveDefinition['target']): boolean {
  return SPREAD_TARGET_MODES.has(target);
}

/**
 * Priority bracket and spread, leading the effect row: these say whether and how the move lands,
 * where rider chips say what happens when it does. `liveTargetMode` is the board's answer for a
 * conditional target; omit outside combat.
 */
export function MoveTraitChips({
  move,
  liveTargetMode,
}: {
  move: MoveDefinition;
  liveTargetMode?: MoveDefinition['target'];
}) {
  const target = liveTargetMode ?? move.target;
  // A randomPriority move's authored `priority` is dead; the row already carries a chip saying so.
  const bracket = move.randomPriority?.length ? 0 : move.priority;
  if (!bracket && !isSpreadTarget(target)) return null;
  return (
    <>
      {bracket !== 0 && (
        <span
          className="move-eff-trait"
          title={
            bracket > 0
              ? `Priority +${bracket} — resolves before every priority-0 move, whatever the Speed`
              : `Priority ${bracket} — resolves after every priority-0 move, whatever the Speed`
          }
        >
          {bracket > 0 ? '↟' : '↡'} Priority {bracket > 0 ? `+${bracket}` : bracket}
        </span>
      )}
      {isSpreadTarget(target) && (
        <span className="move-eff-trait" title={`Spread — hits ${TARGET_MODE_LABELS[target]}, at no damage penalty`}>
          ⇉ Spread
        </span>
      )}
    </>
  );
}

/** Where a rider lands when not the move's own target; null for 'moveTarget' (the summary's trailing clause says it). */
export function riderTargetLabel(app: StatusApplication): string | null {
  if (app.target === 'moveTarget') return null;
  if (app.target === 'self') return 'Self';
  return TARGET_MODE_LABELS[app.target];
}

/**
 * What a heal restores for this caster (docs/combat.md). Without a caster falls back to the
 * authored HealPower, flagged `resolved: false` so the caller can drop the "HP" unit.
 */
export function healReadout(move: MoveDefinition | undefined, caster?: HealCaster): { value: number; resolved: boolean } | null {
  if (!move || move.kind !== 'heal' || move.healPower == null) return null;
  if (!caster) return { value: move.healPower, resolved: false };
  return { value: resolveHealFor(move, caster).heal, resolved: true };
}

// Display rule for `statDeltaTarget` (content.ts): a side is named only when the deltas land somewhere
// OTHER than the move's own target, so a bothAllies move never prints "(Both Allies) — Both Allies".
function statDeltaWhere(move: MoveDefinition): string {
  return move.statDeltaTarget === 'bothAllies' ? ' (Both Allies)' : move.statDeltaTarget === 'self' ? ' (Self)' : '';
}

/**
 * One-line "what this actually does" summary, in the hero sheet's vocabulary. Every clause is worded
 * as the CONDITION rather than the current answer, because this is printed on surfaces with no
 * fight in scope. Damage moves' per-target effectiveness line is built by FightScreen instead.
 */
export function moveEffectSummary(move: MoveDefinition, caster?: HealCaster): string {
  const parts: string[] = [];

  const heal = healReadout(move, caster);
  if (heal) parts.push(`Restores ${heal.value} HP`);

  // Leads: on Infuse/Empower/Conduit it IS the move. Overflow is the point (docs/mana.md "Overflow").
  if (move.manaGrant) parts.push(`Gives ${move.manaGrant} MP, past their max`);

  if (move.statDeltas?.length) {
    const deltas = move.statDeltas.map(({ stat, amount }) => `${amount >= 0 ? '+' : ''}${amount} ${STAT_LABELS[stat]}`).join(', ');
    const odds = move.statDeltaChance != null ? `${Math.round(move.statDeltaChance * 100)}% chance: ` : '';
    const pack = move.conditionalStatDeltas
      ? `, ×${move.conditionalStatDeltas.multiplier} beside a ${move.conditionalStatDeltas.requiresPartnerType} partner`
      : '';
    parts.push(odds + deltas + statDeltaWhere(move) + pack);
  }

  if (move.randomStatDeltas) {
    const { count, amount } = move.randomStatDeltas;
    parts.push(`+${amount} to ${count === 1 ? 'a random stat' : `${count} random stats`}${statDeltaWhere(move)}`);
  }

  if (move.doublesStatReductions) parts.push('Doubles stat reductions already on the target');

  // No number to print: the value is whatever live state says. States the rule.
  if (move.derivedStatDeltas) {
    const where =
      move.statDeltaTarget === 'bothAllies' || (move.statDeltaTarget == null && move.target === 'bothAllies')
        ? ' (Both Allies)'
        : move.statDeltaTarget === 'self' || (move.statDeltaTarget == null && move.target === 'self')
          ? ' (Self)'
          : '';
    const stats = move.derivedStatDeltas.stats.map((stat) => STAT_LABELS[stat]).join(' and ');
    parts.push(
      move.derivedStatDeltas.source === 'userEffectiveAttack'
        ? `Doubles your ${stats}${where}`
        : `+${stats} equal to your Mana before casting${where}`
    );
  }

  // A hard gate: with no legal target the move cannot be cast at all.
  if (move.requiresTargetStatus) {
    const gate = move.requiresTargetStatus;
    parts.push(`Only targets ${statuses[gate]?.name ?? gate}`);
  }

  if (move.conditionalPower) {
    const fieldSide = move.conditionalPower.requiresFieldEffect;
    const userSide = move.conditionalPower.requiresUserStatus;
    const hpSide = move.conditionalPower.requiresTargetHpBelow;
    const userHpSide = move.conditionalPower.requiresUserHpBelow;
    const partnerSide = move.conditionalPower.requiresPartnerType;
    const gate = move.conditionalPower.requiresTargetStatus ?? userSide ?? '';
    const gateName = statuses[gate]?.name ?? gate;
    // Never printed on the field form, which cannot consume anything.
    const spent = move.conditionalPower.consumesStatus && !fieldSide ? ', consumed' : '';
    const clause = partnerSide
      ? `while your partner is a ${partnerSide}`
      : fieldSide
      ? `while ${fieldEffects[fieldSide]?.name ?? fieldSide} is up`
      : userHpSide != null
        ? `while you are below ${Math.round(userHpSide * 100)}% HP`
        : hpSide != null
          ? `vs a target below ${Math.round(hpSide * 100)}% HP`
          : userSide
            ? `while you have ${gateName}`
            : `vs ${gateName}`;
    parts.push(`×${move.conditionalPower.multiplier} power ${clause}${spent}`);
  }

  if (move.conditionalTarget) {
    const field = fieldEffects[move.conditionalTarget.requiresFieldEffect]?.name ?? move.conditionalTarget.requiresFieldEffect;
    parts.push(`Hits ${TARGET_MODE_LABELS[move.conditionalTarget.target].toLowerCase()} while ${field} is up`);
  }

  if (move.randomBasePower) {
    parts.push(`Base Power rolls ${move.randomBasePower.min}-${move.randomBasePower.max} each round`);
  }

  if (move.basePowerGainOnUse) {
    parts.push(`+${move.basePowerGainOnUse.amount} Base Power each use this fight, up to ${move.basePowerGainOnUse.max}`);
  }

  if (move.critChance != null) parts.push(`${Math.round(move.critChance * 100)}% crit`);

  if (move.offStatOverride) {
    const replaced = move.category === 'physical' ? 'attack' : 'intelligence';
    parts.push(`Uses ${STAT_LABELS[move.offStatOverride]} in place of ${STAT_LABELS[replaced]}`);
  }

  if (move.retributionPercent != null) {
    const share = move.retributionPercent === 1 ? `all` : `${Math.round(move.retributionPercent * 100)}%`;
    parts.push(`Deals ${share} of damage taken since your last turn`);
  }

  if (move.recoilPercent) parts.push(`Costs ${Math.round(move.recoilPercent * 100)}% of damage dealt as recoil`);

  if (move.selfHpCost) {
    parts.push(
      move.selfHpCost.mode === 'percentMaxHp'
        ? `Costs the user ${Math.round(move.selfHpCost.amount * 100)}% of max HP`
        : `Drops the user to ${move.selfHpCost.amount} HP`
    );
  }

  if (move.drainPercent) parts.push(`Heals ${Math.round(move.drainPercent * 100)}% of damage dealt`);

  // One clause per rider; the verb (Grants/Applies) is what separates a boon from a wound.
  for (const app of statusApplicationsOf(move)) {
    const { statusId, magnitude, duration, chance } = app;
    const amount = magnitude ?? duration;
    const odds = chance != null ? `${Math.round(chance * 100)}% ` : '';
    const verb = grantsRatherThanInflicts(app) ? 'Grants' : 'Applies';
    const statusName = statuses[statusId]?.name ?? statusId;
    const where = riderTargetLabel(app);
    parts.push(`${odds}${verb} ${statusName}${amount != null ? ` ${amount}` : ''}${where ? ` (${where})` : ''}`);
  }

  if (move.randomStatusApplication?.length) {
    const faces = move.randomStatusApplication
      .map((app) => {
        const name = statuses[app.statusId]?.name ?? app.statusId;
        const amount = app.magnitude ?? app.duration;
        return amount != null ? `${name} ${amount}` : name;
      })
      .join(', ');
    parts.push(`Applies one of: ${faces}`);
  }

  if (move.detonatesStatus) {
    parts.push(`Detonates ${statuses[move.detonatesStatus]?.name ?? move.detonatesStatus}`);
  }

  if (move.cleanses) parts.push(move.cleanseCount != null ? `Cleanses ${move.cleanseCount} at random` : 'Cleanses');

  if (move.manaDiscountOnUse) parts.push(`−${move.manaDiscountOnUse} MP each use`);

  if (move.randomPriority?.length) {
    const brackets = [...move.randomPriority].sort((a, b) => a - b).map((p) => (p >= 0 ? `+${p}` : `${p}`));
    parts.push(`Priority ${brackets.join(' or ')}, at random`);
  }

  if (move.conditionalPriority) {
    const gate = move.conditionalPriority.requiresTargetStatus;
    const sign = move.conditionalPriority.bonus >= 0 ? '+' : '';
    parts.push(`${sign}${move.conditionalPriority.bonus} priority vs ${statuses[gate]?.name ?? gate}`);
  }

  // The mana gem beside this line shows the LIVE price; this states the condition.
  if (move.conditionalManaCost) {
    const all = move.conditionalManaCost.requiresAllEnemiesStatus;
    const partner = move.conditionalManaCost.requiresPartnerType;
    const gate = all ?? move.conditionalManaCost.requiresAnyEnemyStatus;
    if (partner) {
      parts.push(`${move.conditionalManaCost.manaCost} MP beside a ${partner} partner`);
    } else if (gate) {
      const name = statuses[gate]?.name ?? gate;
      parts.push(
        `${move.conditionalManaCost.manaCost} MP if ${all ? `both enemies have ${name}` : `an enemy has ${name}`}`
      );
    }
  }

  // After the buff it delivers, because that is the resolution order.
  if (move.switchesUserOut) parts.push('Then switch out');

  if (move.fieldEffectApplication) {
    parts.push(`Field: ${fieldEffects[move.fieldEffectApplication]?.name ?? move.fieldEffectApplication}`);
  }

  // The row's height is reserved either way; say something rather than leave a gap.
  if (parts.length === 0) return TARGET_MODE_LABELS[move.target];

  return `${parts.join(' · ')} — ${TARGET_MODE_LABELS[move.target]}`;
}

// --- Badges and tiles ---

export function CategoryBadge({ category }: { category: MoveDefinition['category'] }) {
  return <span className={`category-badge category-${category}`}>{CATEGORY_LABELS[category]}</span>;
}

/** Compact kind glyph for the move button: damage moves show their pipeline, others their kind. */
export function MoveKindBadge({ move }: { move: MoveDefinition }) {
  const kind = moveKindGlyph(move);
  // Class follows `kind`, not `move.kind`, so debuff gets its own red rather than the buff teal.
  const tierClass = move.kind === 'damage' ? `category-${move.category}` : `kind-${kind}`;
  const title = move.kind === 'damage' ? CATEGORY_LABELS[move.category] : moveKindLabel(move);
  return (
    <span className={`category-badge move-kind-badge ${tierClass}`} title={title}>
      <MoveKindGlyph kind={kind} className="move-kind-glyph" />
    </span>
  );
}

/**
 * Name-only tile, type as a coloured left edge. `onHover` previews, `onClick` picks, `onLongPress`
 * inspects; click always stops propagation so a tap never bubbles to a surrounding card.
 */
export function MoveTile({
  move,
  selected,
  onHover,
  onClick,
  onLongPress,
}: {
  move: MoveDefinition;
  selected?: boolean;
  onHover?: () => void;
  onClick?: () => void;
  onLongPress?: () => void;
}) {
  const longPress = useLongPress(onLongPress, onClick);

  return (
    <span
      className={`move-tile${selected ? ' move-tile-selected' : ''}`}
      style={{ borderLeftColor: getTypeColor(move.type) }}
      onMouseEnter={onHover}
      {...longPress}
    >
      {move.name}
    </span>
  );
}

/**
 * Visual replica of FightScreen's in-combat `MoveRow` for out-of-combat screens (LevelUpScreen's
 * move-replace picker). Keep in lockstep with it. No affordability check, no Elemental Force, and
 * no `liveTargetMode` — there is no board here.
 */
export function MoveButtonReplica({
  move,
  selected,
  caster,
  onClick,
  onLongPress,
}: {
  move: MoveDefinition;
  selected?: boolean;
  /** So a heal shows what THIS hero restores — see healReadout. */
  caster?: HealCaster;
  onClick?: () => void;
  onLongPress?: () => void;
}) {
  const longPress = useLongPress(onLongPress, onClick);
  const heal = healReadout(move, caster);
  return (
    <button
      type="button"
      className={`move-button${selected ? ' selected' : ''}`}
      style={{ '--move-type-rgb': getTypeColorRgb(move.type) } as CSSProperties}
      {...longPress}
    >
      <div className="move-row-top">
        <ManaCost cost={move.manaCost} />
        <span className="move-type-code" title={move.type}>
          <ElementGlyph type={move.type} />
        </span>
        <span className="move-name">{move.name}</span>
        {move.kind === 'damage' && move.basePower != null && (
          <span className="move-power">
            <strong>{move.basePower}</strong>BP
          </span>
        )}
        {heal && (
          <span className="move-power move-heal">
            <strong>{heal.value}</strong>
          </span>
        )}
        {/* Holds the power column open so the badges don't rag between rows. */}
        {move.kind === 'buff' && <span className="move-power move-power-empty" aria-hidden="true" />}
        <MoveKindBadge move={move} />
      </div>
      <div className="move-row-effect">
        <span className="move-eff-row">
          <MoveTraitChips move={move} />
          <span className="move-effect-text">{moveEffectSummary(move, caster)}</span>
        </span>
      </div>
    </button>
  );
}
