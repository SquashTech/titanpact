import { getContrastText, getTypeAbbr, getTypeColor } from '../combat/typeColors';

/**
 * Pokémon-style colored type chip — replaces the old plain colored-text
 * type-tag everywhere a hero/enemy/move type is shown, so type reads as a
 * shape+color block at a glance instead of requiring the player to parse
 * a type name in a hue they've had to memorize.
 */
export function TypeBadge({ type }: { type: string }) {
  const bg = getTypeColor(type);
  return (
    <span className="type-badge" style={{ background: bg, color: getContrastText(bg) }} title={type}>
      {getTypeAbbr(type)}
    </span>
  );
}
