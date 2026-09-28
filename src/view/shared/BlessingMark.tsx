// A roster hero's Blessing (docs/blessings-and-statuses.md §1.6), worn wherever the hero is read
// off the map — protecting it is a map decision, so it has to be seen there, not only in a fight.

export function BlessingMark({ className }: { className?: string }) {
  return (
    <span
      className={`blessing-mark${className ? ` ${className}` : ''}`}
      title="Blessed — the next blow that would knock this hero out is turned aside"
      aria-label="Blessed"
    >
      <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
        <path d="M6 0 L7.3 4.7 L12 6 L7.3 7.3 L6 12 L4.7 7.3 L0 6 L4.7 4.7 Z" fill="currentColor" />
      </svg>
    </span>
  );
}
