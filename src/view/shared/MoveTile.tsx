import { useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import type { MoveDefinition, StatusApplication } from '../../engine/content';
import { statusApplicationsOf } from '../../engine/content';
import { resolveHealFor, type HealCaster } from '../../engine/heal/healPipeline';
import { resolveStatusMagnitudeFor } from '../../engine/status/statusMagnitude';
import { moveForPrimaryType } from '../../engine/state';
import type { Combatant } from '../../engine/state';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { fieldEffects } from '../../data/fieldEffects';
import { statuses } from '../../data/statuses';
import { STAT_LABELS } from './StatBars';
import { ElementGlyph } from './elementIcons';
import { MoveKindGlyph } from './statIcons';
import { isDebuff, moveKindGlyph, stageText } from './moveKind';
import { ManaCost } from './ManaCost';
import { ChargePips } from './ChargePips';
import { playSfx } from '../../audio/sfx';
import { statusAmountText } from './statusFacts';
import { MoveName, MovePriorityChip, MoveStrip, MoveStub, TARGET_MODE_LABELS } from './MoveStrip';

// --- Hold-to-inspect gesture ---

export const LONG_PRESS_MS = 500;

/** Past this much travel the gesture is a scroll, not a hold. Generous: a resting thumb wanders. */
const HOLD_CANCEL_PX = 12;
/** The element itself moved this far between press and release: its panel scrolled. */
const SCROLLED_PX = 6;

/**
 * A ~500ms press calls `onLongPress`, a tap calls `onClick`; the click after a completed hold is
 * swallowed. Returns `data-holding` while the timer runs (styles.css `[data-holding]`) and cancels
 * on movement — on touch the pointer stays captured, so `pointerleave` never fires mid-scroll.
 *
 * A tap COMMITS ON POINTERUP, not on the click that follows (2026-09-11, per user direction). On
 * touch the browser cancels the pointer the moment it decides a touch is a scroll, and inside a
 * scrolling panel a thumb that wanders a few px past its slop gets no `click` at all — which is
 * why the replace offer sometimes took a tap without lighting the row. The travel threshold here
 * is the one judge of what a tap is; the click that does still arrive is swallowed so nothing
 * fires twice. A synthetic `.click()` with no pointer behind it still goes through `onClick`.
 */
export function useLongPress(onLongPress?: () => void, onClick?: () => void) {
  const timer = useRef<number | null>(null);
  /** The hold fired, or the tap was already committed on pointerup: the trailing click is spent. */
  const consumed = useRef(false);
  const origin = useRef<{ x: number; y: number; top: number } | null>(null);
  const [holding, setHolding] = useState(false);

  function clearTimer() {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setHolding(false);
  }

  function cancel() {
    clearTimer();
    origin.current = null;
  }

  return {
    // Absent rather than `false` when idle: `[data-holding]` matches any value, empty string included.
    'data-holding': holding ? '' : undefined,
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
    onPointerDown: (e: PointerEvent) => {
      consumed.current = false;
      origin.current = { x: e.clientX, y: e.clientY, top: e.currentTarget.getBoundingClientRect().top };
      if (!onLongPress) return;
      setHolding(true);
      timer.current = window.setTimeout(() => {
        consumed.current = true;
        cancel();
        // Feature-detected: iOS Safari has no Vibration API.
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(12);
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: PointerEvent) => {
      const from = origin.current;
      if (!from) return;
      if (Math.abs(e.clientX - from.x) > HOLD_CANCEL_PX || Math.abs(e.clientY - from.y) > HOLD_CANCEL_PX) cancel();
    },
    onPointerUp: (e: PointerEvent) => {
      const from = origin.current;
      // A panel that scrolled under a still finger moved the element, not the pointer: that is a scroll too.
      const scrolled = from !== null && Math.abs(e.currentTarget.getBoundingClientRect().top - from.top) > SCROLLED_PX;
      const tapped = from !== null && !consumed.current && !scrolled;
      cancel();
      if (scrolled) consumed.current = true;
      if (!tapped) return;
      consumed.current = true;
      onClick?.();
    },
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClick: (e: MouseEvent) => {
      e.stopPropagation();
      if (consumed.current) {
        consumed.current = false;
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

export { moveKindGlyph };

export function moveKindLabel(move: MoveDefinition): string {
  if (move.kind === 'damage') return 'Damage';
  if (move.kind === 'heal') return 'Heal';
  return isDebuff(move) ? 'Debuff' : 'Buff';
}

const CATEGORY_LABELS: Record<MoveDefinition['category'], string> = { physical: 'PHY', magical: 'MAG' };

/** "A Charge back on every spent move", "Every Arrow refills". */
export function restoresChargesText(restore: NonNullable<MoveDefinition['restoresCharges']>): string {
  const which = restore.moveTag === 'arrow' ? 'Arrow' : 'spent move';
  if (restore.amount === 'all') return restore.moveTag === 'arrow' ? 'Every Arrow refills' : 'Every move refills its Charges';
  return `${restore.amount === 1 ? 'A Charge' : `${restore.amount} Charges`} back on every ${which}`;
}

/** '1 Charge', '2 Charges'. */
export function chargesLabel(n: number): string {
  return `${n} Charge${n === 1 ? '' : 's'}`;
}

export { MovePriorityChip, TARGET_MODE_LABELS };

/** Where a rider lands when not the move's own target; null for 'moveTarget' (the summary's trailing clause says it). */
export function riderTargetLabel(app: StatusApplication): string | null {
  if (app.target === 'moveTarget') return null;
  if (app.target === 'self') return 'Self';
  return TARGET_MODE_LABELS[app.target];
}

/**
 * What a rider's magnitude comes to for this caster (docs/combat.md "Scaled status magnitudes").
 * A DoT or HoT's authored figure is a BASE — printing it beside a heal that already resolves is
 * how a Burn 15 becomes a Burn 19 the moment the button is pressed. Without a caster the base
 * stands, which is the honest answer when there is nobody to scale it by.
 */
export function riderMagnitude(move: MoveDefinition, app: StatusApplication, caster?: HealCaster): number | undefined {
  const def = statuses[app.statusId];
  if (!def || !caster) return app.magnitude;
  return resolveStatusMagnitudeFor(app.magnitude, def, app, move, { stats: caster.stats ?? {}, types: caster.types });
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

/**
 * What a delta comes to for this caster (docs/stat-scaling.md §2) — the same rule as riderMagnitude:
 * the authored figure is a base, and without a caster the base stands.
 */
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
    const deltas = move.statDeltas.map(({ stat, stages }) => stageText(stat, stages)).join(', ');
    const odds = move.statDeltaChance != null ? `${Math.round(move.statDeltaChance * 100)}% chance: ` : '';
    const pack = move.conditionalStatDeltas
      ? `, ×${move.conditionalStatDeltas.multiplier} beside a ${move.conditionalStatDeltas.requiresPartnerType} partner`
      : '';
    parts.push(odds + deltas + statDeltaWhere(move) + pack);
  }

  if (move.randomStatDeltas) {
    const { count, stages } = move.randomStatDeltas;
    parts.push(`${'▲'.repeat(stages)} to ${count === 1 ? 'a random stat' : `${count} random stats`}${statDeltaWhere(move)}`);
  }

  if (move.clearsRaisedStages) parts.push(`Clears raised stats${statDeltaWhere(move)}`);

  if (move.mpRegenGrant) parts.push(`+${move.mpRegenGrant} ${STAT_LABELS.mpRegen}${statDeltaWhere(move)}`);


  // Read off live state at cast, so the summary states the rule (docs/stat-stages.md §6.4).
  if (move.doublesStages || move.stagesPerManaHeld) {
    const where =
      move.statDeltaTarget === 'bothAllies' || (move.statDeltaTarget == null && move.target === 'bothAllies')
        ? ' (Both Allies)'
        : move.statDeltaTarget === 'self' || (move.statDeltaTarget == null && move.target === 'self')
          ? ' (Self)'
          : '';
    if (move.doublesStages) parts.push(`Doubles your ${move.doublesStages.map((stat) => STAT_LABELS[stat]).join(' and ')} steps, ▲▲ from none${where}`);
    if (move.stagesPerManaHeld) {
      const { stats, per, max } = move.stagesPerManaHeld;
      parts.push(`${stats.map((stat) => STAT_LABELS[stat]).join(' and ')} ▲ per ${per} Mana held, up to ${'▲'.repeat(max)}${where}`);
    }
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
    const reducedSide = move.conditionalPower.requiresTargetStatReduction;
    const userHpSide = move.conditionalPower.requiresUserHpBelow;
    const partnerSide = move.conditionalPower.requiresPartnerType;
    const gate = move.conditionalPower.requiresTargetStatus ?? userSide ?? '';
    const gateName = statuses[gate]?.name ?? gate;
    // Never printed on the field form, which cannot consume anything.
    const spent = move.conditionalPower.consumesStatus && !fieldSide ? ', consumed' : '';
    const clause = move.conditionalPower.requiresLastCharge
      ? 'on its last Charge'
      : partnerSide
      ? `while your partner is a ${partnerSide}`
      : fieldSide
      ? `while ${fieldEffects[fieldSide]?.name ?? fieldSide} is up`
      : userHpSide != null
        ? `while you are below ${Math.round(userHpSide * 100)}% HP`
        : hpSide != null
          ? `vs a target below ${Math.round(hpSide * 100)}% HP`
          : reducedSide
            ? 'vs a target whose stats have been lowered'
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
    const { statusId, duration, chance } = app;
    const amount = riderMagnitude(move, app, caster) ?? duration;
    const odds = chance != null ? `${Math.round(chance * 100)}% ` : '';
    const verb = grantsRatherThanInflicts(app) ? 'Grants' : 'Applies';
    const statusName = statuses[statusId]?.name ?? statusId;
    const where = riderTargetLabel(app);
    const shown = amount == null ? '' : app.magnitude != null ? ` ${statusAmountText(statusId, amount)}` : ` ${amount}`;
    parts.push(`${odds}${verb} ${statusName}${shown}${where ? ` (${where})` : ''}`);
  }

  if (move.randomStatusApplication?.length) {
    const faces = move.randomStatusApplication
      .map((app) => {
        const name = statuses[app.statusId]?.name ?? app.statusId;
        const amount = riderMagnitude(move, app, caster) ?? app.duration;
        return amount != null ? `${name} ${app.magnitude != null ? statusAmountText(app.statusId, amount) : amount}` : name;
      })
      .join(', ');
    parts.push(`Applies one of: ${faces}`);
  }

  if (move.detonatesStatus) {
    parts.push(`Detonates ${statuses[move.detonatesStatus]?.name ?? move.detonatesStatus}`);
  }

  if (move.cleanses) parts.push(move.cleanseCount != null ? `Cleanses ${move.cleanseCount} at random` : 'Cleanses');

  if (move.manaDiscountOnUse) parts.push(`costs ${move.manaDiscountOnUse} less each use`);

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
  if (move.manaCostAll) parts.push('Spends all Mana');
  if (move.firstTurnOnly) parts.push('First turn out only');
  if (move.tags?.includes('arrow')) parts.push('Arrow');
  if (move.tags?.includes('slice')) parts.push('Slice');
  if (move.restoresCharges) parts.push(restoresChargesText(move.restoresCharges));

  if (move.fieldEffectApplication) {
    parts.push(`Field: ${fieldEffects[move.fieldEffectApplication]?.name ?? move.fieldEffectApplication}`);
  }

  // A metamorphic move is never cast as itself: say what it turns into, not who it targets.
  if (move.metamorphic) {
    if (typeof move.metamorphic !== 'object') return 'Becomes a random move each round';
    const family = move.metamorphic.poolTag === 'arrow' ? 'Arrow' : move.metamorphic.poolTag === 'slice' ? 'Slice' : 'move';
    return move.metamorphic.locksOnCast
      ? `Shows one ${family} a round; the first one cast stays for the fight`
      : `Becomes a random ${family} each round`;
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
      style={{ '--plate-color': getTypeColor(move.type) } as CSSProperties}
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
  move: authored,
  selected,
  unusable,
  tag,
  matchups,
  caster,
  chargeHolder,
  free,
  onClick,
  onLongPress,
}: {
  move: MoveDefinition;
  selected?: boolean;
  /** Dimmed and un-raised — the row is here to be read, not pressed. The hold gesture still works. */
  unusable?: boolean;
  /** Short chip in the top row, right of the name (the Tutor's "Known"). */
  tag?: ReactNode;
  /** Per-enemy multipliers in seat order, as a fight's row leads with them (a tip's staged scene). */
  matchups?: readonly (number | null)[];
  /** So a heal shows what THIS hero restores — see healReadout. */
  caster?: HealCaster;
  /** The live holder, for spent Charge pips; omitted, a charged move's pips are drawn full. */
  chargeHolder?: Pick<Combatant, 'chargesSpent'>;
  /** Cast without Mana (the companion's act): no gem. */
  free?: boolean;
  onClick?: () => void;
  onLongPress?: () => void;
}) {
  // A Class move wears the caster's type (state.ts) — resolved here so every replica agrees with the fight.
  const move = caster ? moveForPrimaryType(authored, caster.types[0]) : authored;
  // Sounded on the committed tap rather than the press (uiSfx's pointerdown), since a press in a list may be a scroll.
  const longPress = useLongPress(onLongPress, onClick ? () => { playSfx('ui.move'); onClick(); } : undefined);
  const heal = healReadout(move, caster);
  const value =
    move.kind === 'damage'
      ? move.randomBasePower
        ? `${move.randomBasePower.min}–${move.randomBasePower.max}`
        : move.basePower
      : heal?.value;
  return (
    <button
      type="button"
      className={`move-button has-stub${selected ? ' selected' : ''}${unusable ? ' is-unusable' : ''}`}
      style={{ '--move-type-rgb': getTypeColorRgb(move.type) } as CSSProperties}
      data-sfx="none"
      {...longPress}
    >
      <div className="move-row-top">
        {!free && <ManaCost cost={move.manaCost} />}
        <span className="move-type-code" title={move.type}>
          <ElementGlyph type={move.type} />
        </span>
        <MoveName text={move.name} />
        <ChargePips move={move} combatant={chargeHolder} />
        {tag}
        <MoveStrip move={move} amountOf={(app) => riderMagnitude(move, app, caster)} live={{ seats: matchups }} />
      </div>
      <MoveStub move={move} value={value ?? undefined} />
    </button>
  );
}
