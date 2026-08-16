import type { MoveDefinition } from '../../engine/content';
import { getTypeColor } from '../combat/typeColors';
import { TypeBadge } from './TypeBadge';

export const KIND_LABELS: Record<string, string> = { damage: 'Damage', heal: 'Heal', buff: 'Buff/Debuff' };

/** "60 pow · 10 mp" / "40 heal · 14 mp" / "10 mp" — the compact stat line shown for a move. */
export function moveStatLine(move: MoveDefinition): string {
  const parts: string[] = [];
  if (move.kind === 'damage' && move.basePower) parts.push(`${move.basePower} pow`);
  if (move.kind === 'heal' && move.healAmount) parts.push(`${move.healAmount} heal`);
  parts.push(`${move.manaCost} mp`);
  return parts.join(' · ');
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
 */
export function MoveTile({ move, selected, onSelect }: { move: MoveDefinition; selected?: boolean; onSelect?: () => void }) {
  return (
    <span
      className={`move-tile${selected ? ' move-tile-selected' : ''}`}
      style={{ borderLeftColor: getTypeColor(move.type) }}
      onMouseEnter={onSelect}
      onClick={
        onSelect
          ? (e) => {
              e.stopPropagation();
              onSelect();
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

/** Fixed-position move detail readout paired with MoveTile — see MoveTile's doc comment for why this isn't a cursor-anchored tooltip. */
export function MoveInfoPanel({ move, label, placeholder = 'Hover or tap a move to see its details.' }: MoveInfoPanelProps) {
  return (
    <div className="move-info-panel">
      {move ? (
        <>
          {label && <div className="move-info-label">{label}</div>}
          <div className="move-info-head">
            <span className="move-info-name">{move.name}</span>
            <TypeBadge type={move.type} />
          </div>
          <div className="move-info-meta">
            {KIND_LABELS[move.kind] ?? move.kind} · {moveStatLine(move)}
          </div>
          {move.description && <div className="move-info-desc">{move.description}</div>}
        </>
      ) : (
        <div className="move-info-placeholder">{placeholder}</div>
      )}
    </div>
  );
}
