// The wordmark (2026-11-24, per user direction, docs/worlds.md §2.7): the working title Twofold Heroes,
// the one word Twofold big and HEROES set small beneath it, white and gold with a thick ink rim.

export function TitleLogo() {
  return (
    <div className="book-logo" role="img" aria-label="Twofold Heroes">
      <span className="book-logo-big" aria-hidden="true">
        Twofold
      </span>
      <span className="book-logo-small" aria-hidden="true">
        HEROES
      </span>
    </div>
  );
}
