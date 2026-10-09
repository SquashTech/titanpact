import type { CSSProperties, MouseEvent, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  /** Any CSS colour; the whole plate is mixed from it. Omitted, it reads the screen's --node-rgb. */
  tint?: string;
  /** The console's size, for a plate inside a fight's action panel. */
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
  'data-sfx'?: string;
}

/**
 * The commit press: the title's chamfered metal plate at screen size, struck in the colour of
 * what is being chosen. A plank belongs to a place; a plate is a decision.
 */
export function PlateButton({ children, onClick, disabled = false, tint, compact = false, className, style, 'data-sfx': sfx }: Props) {
  return (
    <div
      className={`plate-socket${compact ? ' is-compact' : ''}${disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`}
      style={tint ? ({ ...style, '--plate-color': tint } as CSSProperties) : style}
    >
      <span className="plate-wing-tip is-left" aria-hidden="true" />
      <span className="plate-wing-tip is-right" aria-hidden="true" />
      <span className="plate-frame" aria-hidden="true" />
      <button type="button" className="plate-cta" onClick={onClick} disabled={disabled} data-sfx={sfx}>
        {!disabled && <span className="plate-sheen" aria-hidden="true" />}
        <span className="plate-label">{children}</span>
      </button>
    </div>
  );
}
