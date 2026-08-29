import { useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import type { MoveDefinition } from '../../engine/content';
import { resolveHealFor, type HealCaster } from '../../engine/heal/healPipeline';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { fieldEffects } from '../../data/fieldEffects';
import { statuses } from '../../data/statuses';
import { STAT_LABELS } from './StatBars';
import { TypeBadge } from './TypeBadge';
import { ElementGlyph } from './elementIcons';
import { MoveKindGlyph, type MoveKindGlyphKind } from './statIcons';
import { ManaCost } from './ManaCost';

/**
 * Shared hold-to-inspect gesture: a ~500ms press opens details, a tap acts.
 * Originally inlined in MoveTile below; pulled out so other custom-styled
 * tappable elements that want the same split (e.g. LevelUpScreen's
 * move-replace picker, which needs its own bordered card layout rather than
 * MoveTile's compact span) can reuse it instead of re-implementing the timer
 * dance. The click that follows a completed long-press is swallowed so it
 * can't also fire `onClick`.
 *
 * Three things beyond the timer, none of which the hand-rolled copies had:
 *
 * 1. **The hold is visible while it happens.** The returned props carry
 *    `data-holding` for as long as the timer is running, so the pressed
 *    control can draw its own charge (styles.css, `[data-holding]`). A 500ms
 *    gesture that shows nothing until the instant it completes is
 *    indistinguishable from a dead control, which is most of why "hold for
 *    info" goes undiscovered. It is spelled as a data attribute rather than
 *    as a returned flag precisely so every existing `{...longPress}` call
 *    site picks it up without touching its JSX — and unlike a bare boolean,
 *    a `data-*` prop is legal to spread onto a DOM element.
 * 2. **Movement cancels it.** `.move-list` scrolls at short viewports and the
 *    roster/compendium lists scroll everywhere, and on touch the pointer
 *    stays captured by the element it went down on — `pointerleave` never
 *    fires mid-drag, so a flick to scroll sat perfectly still as far as the
 *    DOM was concerned and popped a detail card 500ms later. A pointer that
 *    travels past HOLD_CANCEL_PX is a scroll, not a hold.
 * 3. **It ticks.** One short vibration at the moment the hold completes,
 *    where the platform offers one: the gesture ends under the player's own
 *    finger, which is covering the thing that just changed.
 */
export const LONG_PRESS_MS = 500;

/** Past this much travel the gesture is a scroll or a drag, not a hold. Deliberately generous — a thumb resting on glass wanders several pixels over half a second without its owner meaning anything by it. */
const HOLD_CANCEL_PX = 12;

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
    /* Absent rather than `false` when idle: a CSS `[data-holding]` selector
       matches any value, empty string included, so the attribute's presence
       is the whole signal. */
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
        // Feature-detected, not assumed: iOS Safari has no Vibration API at
        // all, and a desktop mouse holding a move button must not throw.
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
 * Swallows the very next click anywhere in the document, for a short grace
 * window — call this the instant a long-press opens a popup that visually
 * covers the tile the hold started on (e.g. HeroDetailOverlay/
 * HeroPreviewOverlay's move/equipment popup). Releasing the hold fires a
 * "ghost" click: the popup is now the topmost element at the pointer's
 * position, so the pointerup that ends the gesture lands on it instead of
 * the original tile, and the mousedown-target/pointerup-target mismatch
 * makes the browser synthesize a click on whichever ancestor happens to be
 * common to both — RosterManagementScreen's own equip popup ran into this
 * first. Which ancestor that lands on (and whether it even has a click
 * handler that would misinterpret it as a deliberate dismiss) depends on
 * how deeply the popup is nested — a plain screen vs. one opened from
 * inside another modal like Manage Roster — so rather than guessing the
 * right ancestor to guard, this intercepts the click at the document's
 * capture phase, before it reaches any component's onClick at all. A
 * genuine subsequent tap (after the grace window, since only one click is
 * ever swallowed) reaches handlers normally.
 */
export function swallowGhostClick() {
  const swallow = (e: Event) => e.stopPropagation();
  document.addEventListener('click', swallow, { capture: true, once: true });
  window.setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 400);
}

/**
 * `kind: 'buff'` covers both directions in the data — "Negative amounts are
 * debuffs — same move kind covers both" (engine/content.ts) — which is right
 * for the engine, where there is genuinely one resolution path, and wrong for
 * the UI, where Rally and Weaken were the same word and the same picture. The
 * sign is recovered here, once, so the glyph, the badge colour and the
 * "Buff"/"Debuff" text can never disagree with each other.
 *
 * Two ways a buff-kind move points downward, and a move needs only one:
 *
 * - **A negative stat delta** — Weaken (-10 DEF), Curse Mind (-10 INT/WIS).
 * - **A status pushed onto somebody else that isn't flagged `positive`** —
 *   the same StatusDefinition flag Cleanse reads (docs/conditions.md §7), so
 *   a status authored as harmful counts here the moment it is written, with
 *   no second list to keep in sync. `target: 'self'` is what separates
 *   granting Renew from inflicting Poison; both are one StatusApplication
 *   field, and the target is the only thing that says which reading applies
 *   (the same distinction moveEffectSummary spells as Grants vs Applies).
 *
 * A move carrying both a buff and a debuff would read as a debuff. None does
 * today; if one is ever authored, the honest answer is probably two glyphs
 * rather than a tiebreak, so revisit this rather than adding a rule.
 */
function isDebuff(move: MoveDefinition): boolean {
  if (move.statDeltas?.some(({ amount }) => amount < 0)) return true;
  const applied = move.statusApplication;
  return applied != null && applied.target !== 'self' && !statuses[applied.statusId]?.positive;
}

/** Which of MoveKindGlyph's five glyphs a move wears: a damage move keys off `move.category` (the stat pipeline it draws from), a non-damage one off `move.kind`, with buff split by sign. The one MoveDefinition -> MoveKindGlyphKind mapping in the app. */
export function moveKindGlyph(move: MoveDefinition): MoveKindGlyphKind {
  if (move.kind === 'damage') return move.category;
  if (move.kind === 'heal') return 'heal';
  return isDebuff(move) ? 'debuff' : 'buff';
}

/** The player-facing word for what a move does, matching the glyph exactly. Replaces a KIND_LABELS table whose buff entry read "Buff/Debuff" — a hedge that was only ever there because nothing could tell the two apart. */
export function moveKindLabel(move: MoveDefinition): string {
  if (move.kind === 'damage') return 'Damage';
  if (move.kind === 'heal') return 'Heal';
  return isDebuff(move) ? 'Debuff' : 'Buff';
}

const CATEGORY_LABELS: Record<MoveDefinition['category'], string> = { physical: 'PHY', magical: 'MAG' };

/**
 * Canonical player-facing name for each `TargetMode` (engine/content.ts) —
 * the single source of truth so this wording doesn't drift between the
 * long-press MoveInfoPanel below and FightScreen's targeting-panel copy.
 * 'allOthers' reads as "All" (everyone but the caster) rather than a literal
 * "everyone including me" mode — Titanpact has no such mode today.
 * "Random" is reserved vocabulary for a future move that rolls its target
 * randomly rather than a distinct `TargetMode` — no move uses it yet, so it
 * isn't a key here; author it as a move-level description note (matching
 * "this will usually specify on the move itself") until an engine hook exists.
 */
export const TARGET_MODE_LABELS: Record<MoveDefinition['target'], string> = {
  singleEnemy: 'Single Enemy',
  bothEnemies: 'Both Enemies',
  singleAlly: 'Single Ally',
  bothAllies: 'Both Allies',
  self: 'Self',
  allOthers: 'All',
};

/**
 * What a heal move actually restores, for whoever is about to cast it.
 *
 * Healing stopped being a flat authored number when the healing formula
 * landed (docs/combat.md), so every readout that used to print
 * `move.healPower` as literal HP now has to run the formula or lie —
 * Solace's Restore Vigor says 60 on Solace's own sheet and 36 on Cinder's,
 * and those are both correct. Callers pass a `caster` wherever a hero is in
 * scope, which is everywhere a move is shown except the type compendium.
 *
 * Without one this falls back to the authored HealPower, which is the same
 * number a Wisdom-50 caster with no STAB gets — honest as a baseline, and
 * flagged `resolved: false` so the caller can drop the "HP" unit rather
 * than promise hit points it can't compute.
 */
export function healReadout(move: MoveDefinition | undefined, caster?: HealCaster): { value: number; resolved: boolean } | null {
  if (!move || move.kind !== 'heal' || move.healPower == null) return null;
  if (!caster) return { value: move.healPower, resolved: false };
  return { value: resolveHealFor(move, caster).heal, resolved: true };
}

/**
 * One-line "what this actually does" summary for a move, in the vocabulary the
 * hero sheet and the long-press popup already use (STAT_LABELS abbreviations,
 * TARGET_MODE_LABELS wording).
 *
 * This exists because of the question docs/visual-language.md keeps arriving at:
 * the no-boxes rule governs whether a control is drawn as a box, not whether the
 * box holds the decision. A combat move button carried name / type / cost / BP and
 * nothing about the *effect*, so the only way to learn that Second Wind grants
 * +10 ATK was a 500ms hold on it — every turn, for every move.
 *
 * Damage moves deliberately don't route through here. Their decision-relevant
 * line is the per-target effectiveness readout, which needs live combat state and
 * so is built by the caller (FightScreen).
 */
export function moveEffectSummary(move: MoveDefinition, caster?: HealCaster): string {
  const parts: string[] = [];

  const heal = healReadout(move, caster);
  if (heal) parts.push(`Restores ${heal.value} HP`);

  if (move.statDeltas?.length) {
    parts.push(move.statDeltas.map(({ stat, amount }) => `${amount >= 0 ? '+' : ''}${amount} ${STAT_LABELS[stat]}`).join(', '));
  }

  if (move.statusApplication) {
    const { statusId, magnitude, duration, target } = move.statusApplication;
    // A status landing on the user is granted; one landing on the move's resolved
    // target is inflicted. Same field, opposite reading — and since the target
    // clause appended below reads "Self" for a self-buff either way, the verb is
    // what actually disambiguates the two.
    const amount = magnitude ?? duration;
    parts.push(`${target === 'self' ? 'Grants' : 'Applies'} ${statusId}${amount != null ? ` ${amount}` : ''}`);
  }

  if (move.cleanses) parts.push('Cleanses');

  if (move.fieldEffectApplication) {
    parts.push(`Field: ${fieldEffects[move.fieldEffectApplication]?.name ?? move.fieldEffectApplication}`);
  }

  // Falls back to the authored flavor line rather than rendering an empty row —
  // the row's height is reserved either way, so a move with no mechanical payload
  // should still say something rather than leave a gap.
  if (parts.length === 0) return move.description ?? '';

  return `${parts.join(' · ')} — ${TARGET_MODE_LABELS[move.target]}`;
}

/**
 * Physical (Attack/Defense pipeline) vs Magical (Intelligence/Wisdom pipeline) —
 * see CLAUDE.md "Two-pipeline separation". Shown everywhere a move's type badge
 * is shown, so the pipeline a move draws from is always legible alongside its type.
 */
export function CategoryBadge({ category }: { category: MoveDefinition['category'] }) {
  return <span className={`category-badge category-${category}`}>{CATEGORY_LABELS[category]}</span>;
}

/**
 * Compact glyph for the always-visible move button (FightScreen's move grid)
 * — replaces CategoryBadge's PHY/MAG text there. Category (physical/magical)
 * only matters for `kind: 'damage'` moves (resolveRound.ts reads it for the
 * stat ratio; heal/buff moves ignore it entirely), so showing PHY/MAG on a
 * heal or buff was decorative noise that also failed to say "this doesn't
 * attack." Damage moves keep the category glyph; heal/buff/debuff moves show
 * their kind instead, so attacks and non-attacks read apart at a glance. The
 * long-press move popup still spells the full PHY/MAG + Damage/Heal/Buff/
 * Debuff text out via CategoryBadge + moveKindLabel for anyone unsure what a
 * glyph means.
 *
 * The glyph itself is now MoveKindGlyph — the same vector set the stat blocks
 * use, and for physical/magical/heal the *same glyph as the stat the move
 * actually reads* (see its note in statIcons.tsx). It replaced the pixel-art
 * badge, which was picked from a 32px iconset and drawn here at 16px: a true
 * halving that survives, but a size this slot was locked to rather than one
 * it chose. Vector lets the badge sit at the row's own scale.
 */
export function MoveKindBadge({ move }: { move: MoveDefinition }) {
  const kind = moveKindGlyph(move);
  // Damage moves are coloured by pipeline, everything else by kind — so the
  // class follows `kind` rather than `move.kind`, which is what gives debuff
  // its own .kind-debuff red instead of inheriting the buff teal.
  const tierClass = move.kind === 'damage' ? `category-${move.category}` : `kind-${kind}`;
  // Still PHY/MAG for a damage move: the title's job there is to expand the
  // abbreviation the badge replaced, not to name the kind.
  const title = move.kind === 'damage' ? CATEGORY_LABELS[move.category] : moveKindLabel(move);
  return (
    <span className={`category-badge move-kind-badge ${tierClass}`} title={title}>
      <MoveKindGlyph kind={kind} className="move-kind-glyph" />
    </span>
  );
}

/**
 * Uniform move tile — just the name, type shown as a colored left edge
 * (matching the border-left type coding used elsewhere in this app, e.g. the
 * hero card itself) rather than a separate dot glyph, so more tiles fit per
 * row before wrapping. Stats and description aren't shown on the tile at
 * all; hovering (mouse) or tapping (touch/click) loads them into the
 * caller's fixed MoveInfoPanel instead of popping a tooltip next to the
 * cursor, so the text can never hang off a screen edge on this portrait
 * mobile layout.
 *
 * `onHover` and `onClick` are separate so a caller can distinguish "just
 * looking" from "picking" (e.g. CompendiumScreen/HeroPreviewOverlay, where
 * hovering previews a move into their fixed MoveInfoPanel but only a click
 * sets the persisted selection) — most callers just pass the same handler
 * to both, matching the old combined `onSelect` behavior.
 *
 * `onLongPress` is a third, independent trigger — a ~500ms hold (mirrors
 * FightScreen's move-button long-press), backed by the shared `useLongPress`
 * hook above, for callers where the tile sits inside a larger clickable card
 * (e.g. LevelUpScreen's hero cards) and a plain tap must never fire it, or
 * where there's no hover affordance to lean on at all (touch). The click
 * that follows a completed long-press is swallowed so it can't also invoke
 * `onClick`. Click always stops propagation regardless of which handlers
 * are passed, since a bare tap on a tile must never bubble to a
 * surrounding card's own click handler.
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
 * Visual replica of FightScreen's in-combat move row (its `MoveRow`) for
 * screens that offer a hero's moves outside of combat — currently
 * LevelUpScreen's move-replace picker — so the same button language is
 * recognizable wherever a move is shown. Presentational only: no mana-
 * affordability check and no Elemental Force bonus, since both are
 * live-combat-only state that doesn't apply here.
 *
 * It had drifted. FightScreen's button was rebuilt into a full-width row —
 * cost, type glyph, name, power and kind badge on ONE line, with the second
 * line freed for the effect readout that used to need a 500ms hold — and this
 * replica stayed on the old two-line `.move-row-top` / `.move-row-mid` shape
 * in a 2-column grid, with no effect line and no kind badge at all. The result
 * was that the one screen in the run loop whose entire job is comparing four
 * moves showed less about each move than the fight screen does, in a layout
 * that no longer looked like it (2026-08-29 pass).
 *
 * The one honest divergence from `MoveRow`: a damage move's effect line is its
 * description rather than the per-enemy matchup chips. Those need a live
 * CombatState, and there isn't one here — a move being *learned* has no
 * defenders to be effective against yet.
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
  /** The hero whose button this is, so a heal shows what IT restores — see healReadout. Elemental Force still isn't applied here (live-combat-only), but Wisdom and STAB are loadout facts that read fine out of combat. */
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
      /* Kept in lockstep with FightScreen's own move button — this is the
         replica, and the two diverging is exactly what makes a reward screen
         stop feeling like the same game as the fight screen. */
      style={{ '--move-type-rgb': getTypeColorRgb(move.type) } as CSSProperties}
      {...longPress}
    >
      <div className="move-row-top">
        <ManaCost cost={move.manaCost} />
        {/* Glyph only, no abbreviation — kept in lockstep with FightScreen's
            own move button, which has the reasoning. */}
        <span className="move-type-code" title={move.type}>
          <ElementGlyph type={move.type} />
        </span>
        <span className="move-name">{move.name}</span>
        {move.kind === 'damage' && move.basePower != null && (
          <span className="move-power">
            <strong>{move.basePower}</strong>BP
          </span>
        )}
        {/* Bare number, no "HEAL" — kept in lockstep with FightScreen's own
            move button, which has the reasoning. */}
        {heal && (
          <span className="move-power move-heal">
            <strong>{heal.value}</strong>
          </span>
        )}
        {/* Holds the power column open on a move with no number to put in it,
            so the badges don't rag between rows — same as MoveRow. */}
        {move.kind === 'buff' && <span className="move-power move-power-empty" aria-hidden="true" />}
        <MoveKindBadge move={move} />
      </div>
      <div className="move-row-effect">
        <span className="move-effect-text">{moveEffectSummary(move, caster)}</span>
      </div>
    </button>
  );
}

interface MoveInfoPanelProps {
  move: MoveDefinition | null;
  /** The hero this panel is describing the move FOR, so a heal reads as real hit points rather than as its authored baseline (healReadout). */
  caster?: HealCaster;
  /** Shown above the move name while a move is loaded, e.g. "Hover or tap a move". Omit for no label row. */
  label?: string;
  /** Shown in place of move details when nothing is loaded yet. */
  placeholder?: string;
}

/**
 * Fixed-position move detail readout paired with MoveTile — see MoveTile's
 * doc comment for why this isn't a cursor-anchored tooltip. Power/heal and
 * mana cost share the name/type/category row rather than getting a row of
 * their own — one fewer line keeps the panel short enough that a full
 * 6-hero roster doesn't push LevelUpScreen into scrolling.
 */
export function MoveInfoPanel({ move, caster, label, placeholder = 'Hover or tap a move to see its details.' }: MoveInfoPanelProps) {
  const heal = healReadout(move ?? undefined, caster);
  return (
    <div className="move-info-panel">
      {move ? (
        <>
          {label && <div className="move-info-label">{label}</div>}
          <div className="move-info-head">
            <span className="move-info-name">{move.name}</span>
            <TypeBadge type={move.type} />
            <CategoryBadge category={move.category} />
            {move.kind === 'damage' && move.basePower != null && (
              <span className="move-stat move-stat-power">
                <strong>{move.basePower}</strong>
                <span className="move-stat-unit">POW</span>
              </span>
            )}
            {heal && (
              <span className="move-stat move-stat-heal">
                <strong>{heal.value}</strong>
                {/* "HP" only once the number IS hit points. Unresolved it is
                    still the authored HealPower, and calling that HP would be
                    the exact lie healReadout exists to avoid. */}
                <span className="move-stat-unit">{heal.resolved ? 'HP' : 'HEAL'}</span>
              </span>
            )}
            <span className="move-stat move-stat-cost">
              <strong>{move.manaCost}</strong>
              <span className="move-stat-unit">MP</span>
            </span>
            <span className="move-info-kind">
              {TARGET_MODE_LABELS[move.target]} &middot; {moveKindLabel(move)}
            </span>
          </div>
          {move.description && <div className="move-info-desc">{move.description}</div>}
        </>
      ) : (
        <div className="move-info-placeholder">{placeholder}</div>
      )}
    </div>
  );
}
