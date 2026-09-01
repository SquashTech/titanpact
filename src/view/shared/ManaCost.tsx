// The mana-cost gem every move button leads with: a cut gem of dark glass, three flat facets lit
// from the top-left. Inline SVG rather than clip-path so the rim/halo strokes are real geometry.

interface ManaCostProps {
  cost: number;
  /** `'md'` (24px) is the move button; `'sm'` (16px) is every compact restatement (kit chips, console crest). */
  size?: 'md' | 'sm';
  className?: string;
}

export function ManaCost({ cost, size = 'md', className }: ManaCostProps) {
  return (
    <span className={`mana-gem mana-gem-${size}${className ? ` ${className}` : ''}`} title={`${cost} Mana`}>
      <svg className="mana-gem-cut" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {/* Halo: near-black outer stroke, load-bearing where the gem overlaps a portrait. */}
        <path className="mana-gem-halo" d="M12 1.3 22.3 7v10L12 22.7 1.7 17V7Z" />
        <path className="mana-gem-crown" d="M1.7 7 12 1.3 22.3 7 12 12Z" />
        <path className="mana-gem-left" d="M1.7 7 12 12v10.7L1.7 17Z" />
        <path className="mana-gem-right" d="M22.3 7 12 12v10.7L22.3 17Z" />
        <path className="mana-gem-rim" d="M12 1.3 22.3 7v10L12 22.7 1.7 17V7Z" />
        <path className="mana-gem-spark" d="M4.4 7.7 10.3 4.4" />
      </svg>
      <span className="mana-gem-value">{cost}</span>
    </span>
  );
}
