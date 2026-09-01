import { getContrastText, getTypeAbbr, getTypeColor } from '../combat/typeColors';
import { ElementGlyph } from './elementIcons';

/**
 * Colored type chip: element glyph plus 3-letter abbreviation, redundant on purpose so the glyph
 * can be learned. `iconOnly` drops the letters where something adjacent already names the type.
 */
export function TypeBadge({ type, iconOnly }: { type: string; iconOnly?: boolean }) {
  const bg = getTypeColor(type);
  return (
    <span
      className={`type-badge${iconOnly ? ' type-badge-icon-only' : ''}`}
      style={{ background: bg, color: getContrastText(bg) }}
      title={type}
    >
      <ElementGlyph type={type} className="type-badge-glyph" />
      {!iconOnly && <span className="type-badge-code">{getTypeAbbr(type)}</span>}
    </span>
  );
}
