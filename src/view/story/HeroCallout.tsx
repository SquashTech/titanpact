import { useEffect, useState } from 'react';
import type { CueLine } from '../../run/story';
import './story.css';

// A hero calling the round's plan in a lesson fight (docs/the-sky.md §1): a speech bubble on the
// horizon over the speaker's side, typed a line at a time. The last line stays up until the round
// plays; nothing is tapped through.

/** Per letter, then the pause a line holds before the next one starts. */
const TYPE_MS = 28;
const HOLD_MS = 900;
const HOLD_PER_CHAR_MS = 22;

interface Props {
  lines: readonly CueLine[];
  /** Where the speaker stands on the field (its active slot), or null when it is not out. */
  sideOf: (rosterId: string) => 'left' | 'right' | null;
  nameOf: (rosterId: string) => string;
}

export function HeroCallout({ lines, sideOf, nameOf }: Props) {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(0);
  const line = lines[index];

  useEffect(() => {
    if (!line) return;
    if (typed < line.text.length) {
      const t = window.setTimeout(() => setTyped((n) => n + 1), TYPE_MS);
      return () => window.clearTimeout(t);
    }
    if (index + 1 >= lines.length) return;
    const t = window.setTimeout(() => {
      setIndex((i) => i + 1);
      setTyped(0);
    }, HOLD_MS + line.text.length * HOLD_PER_CHAR_MS);
    return () => window.clearTimeout(t);
  }, [line, typed, index, lines.length]);

  if (!line) return null;
  const side = sideOf(line.by) ?? 'left';
  return (
    <div key={index} className={`hero-callout is-from-${side}`} role="status">
      <span className="hero-callout-name">{nameOf(line.by)}</span>
      {/* The whole line is laid out from the first letter, so the bubble never grows as it types. */}
      <span>{line.text.slice(0, typed)}</span>
      <span className="hero-callout-untyped">{line.text.slice(typed)}</span>
    </div>
  );
}
