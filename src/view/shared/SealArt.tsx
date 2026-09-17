import type { CSSProperties } from 'react';
import { SEAL_ACTS } from '../../run/state';
import { TypeWheel } from './TypeWheel';

// The pact's seal as the title screen draws it: three rings, the type wheel, and five sigils —
// one per warden — on the mid ring. The title shows it with the fourth sigil dead (the binding
// is failing at the moment the player picks it up); the binding beat at the end of the run
// re-lights it one sigil at a time (TitanBoundScreen). Same markup either way, so the two are
// one object. Every rule is under `.title-seal` in styles.css; a host scopes its own overrides.

interface Props {
  /** Which sigil has gone out, if any (index into the five). */
  brokenIndex?: number | null;
  /** How many sigils carry `is-lit`, from the first. A host that lights them in sequence counts up; the title leaves them all lit. */
  lit?: number;
}

// 0deg is straight UP: the CSS places a sigil with `rotate(a) translateY(-r)`.
const SIGIL_ANGLES = Array.from({ length: SEAL_ACTS }, (_, i) => i * (360 / SEAL_ACTS));

export function SealArt({ brokenIndex = null, lit = SEAL_ACTS }: Props) {
  return (
    <span className="title-seal" aria-hidden="true">
      <span className="title-seal-ring is-outer" />
      <span className="title-seal-ring is-mid" />
      <span className="title-seal-ring is-inner" />
      <TypeWheel />
      <span className="title-seal-sigils">
        {SIGIL_ANGLES.map((angle, i) => (
          <span
            key={angle}
            className={`title-seal-sigil${i === brokenIndex ? ' is-broken' : ''}${i < lit ? ' is-lit' : ''}`}
            style={{ '--a': `${angle}deg` } as CSSProperties}
          />
        ))}
      </span>
    </span>
  );
}
