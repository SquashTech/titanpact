import { useRef, type CSSProperties, type MouseEvent } from 'react';
import type { MoveDefinition } from '../../engine/content';
import { getTypeAbbr, getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { TypeBadge } from './TypeBadge';

/**
 * Shared ~500ms long-press-vs-click detection. Originally inlined in
 * MoveTile below; pulled out so other custom-styled tappable elements that
 * want the same "hold for details, tap to act" split (e.g. LevelUpScreen's
 * move-replace picker, which needs its own bordered card layout rather than
 * MoveTile's compact span) can reuse it instead of re-implementing the timer
 * dance. The click that follows a completed long-press is swallowed so it
 * can't also fire `onClick`.
 */
export function useLongPress(onLongPress?: () => void, onClick?: () => void) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);

  function clearTimer() {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  return {
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
    onPointerDown: () => {
      if (!onLongPress) return;
      fired.current = false;
      timer.current = window.setTimeout(() => {
        fired.current = true;
        onLongPress();
      }, 500);
    },
    onPointerUp: clearTimer,
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

export const KIND_LABELS: Record<string, string> = { damage: 'Damage', heal: 'Heal', buff: 'Buff/Debuff' };

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
 * Physical (Attack/Defense pipeline) vs Magical (Intelligence/Wisdom pipeline) —
 * see CLAUDE.md "Two-pipeline separation". Shown everywhere a move's type badge
 * is shown, so the pipeline a move draws from is always legible alongside its type.
 */
export function CategoryBadge({ category }: { category: MoveDefinition['category'] }) {
  return <span className={`category-badge category-${category}`}>{CATEGORY_LABELS[category]}</span>;
}

const CATEGORY_EMOJI: Record<MoveDefinition['category'], string> = { physical: '⚔️', magical: '🔮' };
const KIND_EMOJI: Record<MoveDefinition['kind'], string> = { damage: '', heal: '💚', buff: '🛡️' };

/**
 * Compact glyph for the always-visible move button (FightScreen's move grid)
 * — replaces CategoryBadge's PHY/MAG text there. Category (physical/magical)
 * only matters for `kind: 'damage'` moves (resolveRound.ts reads it for the
 * stat ratio; heal/buff moves ignore it entirely), so showing PHY/MAG on a
 * heal or buff was decorative noise that also failed to say "this doesn't
 * attack." Damage moves keep the category glyph; heal/buff moves show their
 * kind instead, so attacks and non-attacks read apart at a glance. The
 * long-press move popup still spells the full PHY/MAG + Damage/Heal/Buff
 * text out via CategoryBadge + KIND_LABELS for anyone unsure what a glyph
 * means.
 */
export function MoveKindBadge({ move }: { move: MoveDefinition }) {
  const isDamage = move.kind === 'damage';
  const emoji = isDamage ? CATEGORY_EMOJI[move.category] : KIND_EMOJI[move.kind];
  const tierClass = isDamage ? `category-${move.category}` : `kind-${move.kind}`;
  const title = isDamage ? CATEGORY_LABELS[move.category] : KIND_LABELS[move.kind];
  return (
    <span className={`category-badge move-kind-badge ${tierClass}`} title={title}>
      {emoji}
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
 * Visual replica of FightScreen's in-combat move button (same .move-button/
 * .move-crystal/.move-row-* markup, styles.css:1589) for screens that offer
 * a hero's moves outside of combat — currently LevelUpScreen's move-replace
 * picker — so the same button language is recognizable wherever a move is
 * shown. Presentational only: no mana-affordability check and no elemental-
 * force bonus, since both are live-combat-only state that doesn't apply here.
 */
export function MoveButtonReplica({
  move,
  selected,
  onClick,
  onLongPress,
}: {
  move: MoveDefinition;
  selected?: boolean;
  onClick?: () => void;
  onLongPress?: () => void;
}) {
  const longPress = useLongPress(onLongPress, onClick);
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
        <span className="move-crystal" title={`${move.manaCost} Mana`}>
          <strong>{move.manaCost}</strong>
        </span>
        <span className="move-name">{move.name}</span>
      </div>
      <div className="move-row-mid">
        <span className="move-type-code" title={move.type}>
          {getTypeAbbr(move.type)}
        </span>
        {move.kind === 'damage' && move.basePower != null && (
          <span className="move-power">
            <strong>{move.basePower}</strong>BP
          </span>
        )}
        {move.kind === 'heal' && move.healAmount != null && (
          <span className="move-power move-heal">
            <strong>{move.healAmount}</strong>HEAL
          </span>
        )}
      </div>
    </button>
  );
}

interface MoveInfoPanelProps {
  move: MoveDefinition | null;
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
export function MoveInfoPanel({ move, label, placeholder = 'Hover or tap a move to see its details.' }: MoveInfoPanelProps) {
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
            {move.kind === 'heal' && move.healAmount != null && (
              <span className="move-stat move-stat-heal">
                <strong>{move.healAmount}</strong>
                <span className="move-stat-unit">HEAL</span>
              </span>
            )}
            <span className="move-stat move-stat-cost">
              <strong>{move.manaCost}</strong>
              <span className="move-stat-unit">MP</span>
            </span>
            <span className="move-info-kind">
              {TARGET_MODE_LABELS[move.target]} &middot; {KIND_LABELS[move.kind] ?? move.kind}
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
