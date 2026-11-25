import { useId } from 'react';

// The mana-cost gem every move button leads with: a glossy bubble of mana with an ink rim and one
// highlight (docs/worlds.md §2.6, the Bubbly look). Inline SVG so the rim is real geometry.

interface ManaCostProps {
  cost: number;
  /** `'md'` (24px) is the move button; `'sm'` (16px) is every compact restatement (kit chips, console crest). */
  size?: 'md' | 'sm';
  className?: string;
}

export function ManaCost({ cost, size = 'md', className }: ManaCostProps) {
  const fill = `mana-bubble-${useId().replace(/:/g, '')}`;
  return (
    <span className={`mana-gem mana-gem-${size}${cost >= 100 ? ' is-wide' : ''}${className ? ` ${className}` : ''}`} title={`${cost} Mana`}>
      <svg className="mana-gem-cut" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id={fill} cx="0.38" cy="0.32" r="0.75">
            <stop className="mana-gem-light" offset="0" />
            <stop className="mana-gem-mid" offset="0.55" />
            <stop className="mana-gem-deep" offset="1" />
          </radialGradient>
        </defs>
        <circle className="mana-gem-body" cx="12" cy="12" r="10.4" fill={`url(#${fill})`} />
        <ellipse className="mana-gem-spark" cx="8.6" cy="7.4" rx="3.3" ry="2" transform="rotate(-30 8.6 7.4)" />
      </svg>
      <span className="mana-gem-value">{cost}</span>
    </span>
  );
}
