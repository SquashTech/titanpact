import type { MoveDefinition } from '../../engine/content';
import { getTypeColor } from '../combat/typeColors';
import { TypeBadge } from './TypeBadge';

export const KIND_LABELS: Record<string, string> = { damage: 'Damage', heal: 'Heal', buff: 'Buff/Debuff' };

const CATEGORY_LABELS: Record<MoveDefinition['category'], string> = { physical: 'PHY', magical: 'MAG' };

/**
 * Physical (Attack/Defense pipeline) vs Magical (Intelligence/Wisdom pipeline) —
 * see CLAUDE.md "Two-pipeline separation". Shown everywhere a move's type badge
 * is shown, so the pipeline a move draws from is always legible alongside its type.
 */
export function CategoryBadge({ category }: { category: MoveDefinition['category'] }) {
  return <span className={`category-badge category-${category}`}>{CATEGORY_LABELS[category]}</span>;
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
 * looking" from "picking" (e.g. LevelUpScreen's move-replace screen, where
 * hovering previews a move but only a click sets the persisted selection) —
 * most callers just pass the same handler to both, matching the old
 * combined `onSelect` behavior.
 */
export function MoveTile({
  move,
  selected,
  onHover,
  onClick,
}: {
  move: MoveDefinition;
  selected?: boolean;
  onHover?: () => void;
  onClick?: () => void;
}) {
  return (
    <span
      className={`move-tile${selected ? ' move-tile-selected' : ''}`}
      style={{ borderLeftColor: getTypeColor(move.type) }}
      onMouseEnter={onHover}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
    >
      {move.name}
    </span>
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
            <span className="move-info-kind">{KIND_LABELS[move.kind] ?? move.kind}</span>
          </div>
          {move.description && <div className="move-info-desc">{move.description}</div>}
        </>
      ) : (
        <div className="move-info-placeholder">{placeholder}</div>
      )}
    </div>
  );
}
