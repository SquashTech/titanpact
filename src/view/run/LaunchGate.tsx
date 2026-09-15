import { unlockAudio } from '../../audio/synth';

interface Props {
  onBegin: () => void;
}

/**
 * The one tap a cold launch asks for before the title (2026-09-15, per user direction). No
 * browser will sound a note before the page has been touched, so the title used to open silent
 * and its score could start only on whatever the player pressed first — and a first press of
 * Start Run leaves the title before the fade-in gets anywhere. This is that press, moved ahead
 * of the title: the tap unlocks the AudioContext, the title arrives already scored, and the
 * track's bytes have been pulling down the whole time this sat here (music.ts applyDesired).
 * Session-scoped — a return to the title later does not pass through it again.
 */
export function LaunchGate({ onBegin }: Props) {
  return (
    <button
      type="button"
      className="launch-gate"
      data-sfx="ui.launch"
      onClick={() => {
        // The window-level unlock listeners have already run by now; this is belt and braces
        // on the one tap the whole score depends on.
        unlockAudio();
        onBegin();
      }}
    >
      <span className="launch-gate-vignette" aria-hidden="true" />
      <span className="launch-gate-seal" aria-hidden="true">
        <span className="launch-gate-ring is-outer" />
        <span className="launch-gate-ring is-inner" />
        <span className="launch-gate-core" />
      </span>
      <span className="launch-gate-wordmark">Titanpact</span>
      <span className="launch-gate-prompt">Tap to begin</span>
    </button>
  );
}
