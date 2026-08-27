/**
 * The mana-cost gem — the number every move button leads with.
 *
 * It was a Hearthstone-style sphere: a single radial gradient from pale blue
 * to navy with a white numeral on it. That was the right *idea* and the wrong
 * *material*. Two things had changed around it since:
 *
 * 1. The move button's interior was flattened (styles.css .mana-gem's own
 *    note) down to chromeless text and glyphs, leaving the sphere as the one
 *    object on the face — which only works if the object is worth looking at.
 * 2. The console the buttons sit in is a dark, carved, top-left-lit surface
 *    with type-tinted rows. A fully-saturated light-blue ball was the single
 *    brightest thing on the screen, on every row, regardless of what the row
 *    said — a gradient sticker on a lit set.
 *
 * So it keeps the billing (CLAUDE.md: mana cost is the primary balance lever,
 * so it leads the row) and changes the material: a **cut gem of dark glass**,
 * three flat facets lit from above, a bright rim, and one specular sliver on
 * the upper-left edge where every other surface in the app takes its light.
 *
 * Why flat facets rather than a smoother gradient: a facet is what makes a
 * shape read as *cut* instead of *shiny*, and at 24px a hard edge survives
 * where a soft ramp turns to mush. The interior is dark, so the numeral is now
 * light-on-dark like every other number on the screen instead of white-on-pale
 * blue, and the gem stops out-shouting the move name beside it. The glow does
 * the work the fill used to: it says "mana" in the dark, at a fraction of the
 * area.
 *
 * Drawn as inline SVG rather than a CSS clip-path so the facet seams and the
 * rim are real geometry — a clip-path would take the shape but clip away the
 * box-shadow that has to draw the rim, and would need three stacked elements
 * to fake what three <path>s say directly.
 */

interface ManaCostProps {
  cost: number;
  /**
   * `'md'` (24px) is the in-combat and level-up move button. `'sm'` (16px) is
   * every compact restatement of the same fact — the draft screen's kit chips,
   * the console crest's committed-move marker — kept as the same gem at half
   * scale rather than a different shape, so "this is what it costs" is one
   * picture the player learns once.
   */
  size?: 'md' | 'sm';
  /** Extra classes for callers that also need to position the gem (e.g. the console crest pins it to a socket's corner). */
  className?: string;
}

export function ManaCost({ cost, size = 'md', className }: ManaCostProps) {
  return (
    <span className={`mana-gem mana-gem-${size}${className ? ` ${className}` : ''}`} title={`${cost} Mana`}>
      <svg className="mana-gem-cut" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {/* Drawn first, behind everything: a near-black outer stroke that
            separates the gem from whatever it sits on. Load-bearing on the
            console crest, where the gem overlaps a hero portrait and would
            otherwise dissolve into it — this replaces the ring that variant
            used to draw with a box-shadow. */}
        <path className="mana-gem-halo" d="M12 1.3 22.3 7v10L12 22.7 1.7 17V7Z" />
        {/* Crown: the top rhombus, catching the most light. */}
        <path className="mana-gem-crown" d="M1.7 7 12 1.3 22.3 7 12 12Z" />
        {/* The two pavilion facets. Left is the lit side (the app's light
            comes from the top left), right is the shadowed one — the whole
            reason to cut the lower body in two rather than fill it flat. */}
        <path className="mana-gem-left" d="M1.7 7 12 12v10.7L1.7 17Z" />
        <path className="mana-gem-right" d="M22.3 7 12 12v10.7L22.3 17Z" />
        <path className="mana-gem-rim" d="M12 1.3 22.3 7v10L12 22.7 1.7 17V7Z" />
        <path className="mana-gem-spark" d="M4.4 7.7 10.3 4.4" />
      </svg>
      <span className="mana-gem-value">{cost}</span>
    </span>
  );
}
