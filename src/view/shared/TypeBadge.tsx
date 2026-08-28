import { getContrastText, getTypeAbbr, getTypeColor } from '../combat/typeColors';
import { ElementGlyph } from './elementIcons';

/**
 * Pokémon-style colored type chip — replaces the old plain colored-text
 * type-tag everywhere a hero/enemy/move type is shown, so type reads as a
 * shape+color block at a glance instead of requiring the player to parse
 * a type name in a hue they've had to memorize.
 *
 * The chip now carries its element glyph (elementIcons.tsx) beside the
 * abbreviation, and the pairing is doing the job the abbreviation was hired
 * for. docs/visual-language.md's own argument for keeping three letters was
 * that *"colour alone cannot separate 15 types"* — true, but that was an
 * argument against colour, not for text. A glyph separates fifteen far faster
 * than three 9px letters do, and it is the one part of the chip that survives
 * being seen sideways on a phone. The abbreviation stays underneath it as the
 * literal answer for a player who has not learned the set yet; together they
 * are redundant on purpose, which is what lets the glyph be learned in the
 * first place.
 *
 * `iconOnly` drops the letters for surfaces where something adjacent already
 * names the type and the width is spoken for: the 15x15 matchup grid, whose
 * columns are 30px and whose headers repeat down every row, and the combat
 * hero cards, where the chip sits beside the hero's own name and a tap opens
 * the full stat sheet.
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
