import { useRef, useState } from 'react';
import { getAudioPrefs, playSfx, setMusicLevel, setMuted, setSfxLevel } from '../../audio/sfx';

/**
 * Volume and mute, as a drop-in block for a menu's .options-list.
 *
 * Lives in shared/ rather than inside FightScreen because the fight's pause
 * menu is only the FIRST place this belongs — a player on the map or the
 * title screen has just as much reason to mute, and this should be one
 * component when that happens rather than two that drift.
 *
 * The two faders are separate on purpose (audio/synth.ts runs an sfx bus and
 * a music bus off the master): turning combat noise down to read the numbers
 * shouldn't also silence the score, and playing the score quietly under loud
 * hits is a mix decision the player gets to make.
 */

/**
 * A dragged fader that plays nothing is a fader set blind. Effects preview a
 * tick as they move — but no faster than this, because `input` fires per
 * pixel of travel and an unthrottled preview is a machine-gun.
 */
const PREVIEW_THROTTLE_MS = 140;

export function AudioSettings() {
  // Seeded from the live prefs (they persist in localStorage), then held
  // locally so the sliders track the thumb rather than the store.
  const [muted, setMutedState] = useState(() => getAudioPrefs().muted);
  const [sfx, setSfx] = useState(() => getAudioPrefs().sfx);
  const [music, setMusic] = useState(() => getAudioPrefs().music);
  const lastPreview = useRef(0);

  function handleMute() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    // Unmuting is otherwise silent: the row's own tap sound was suppressed on
    // pointerdown, while the mute was still on. Say something on the way back.
    if (!next) playSfx('ui.confirm');
  }

  function handleSfx(value: number) {
    setSfx(value);
    setSfxLevel(value);
    const now = performance.now();
    if (now - lastPreview.current < PREVIEW_THROTTLE_MS) return;
    lastPreview.current = now;
    playSfx('ui.select');
  }

  function handleMusic(value: number) {
    setMusic(value);
    setMusicLevel(value);
    // Deliberately no preview: the music bus has no source yet, and previewing
    // it with an EFFECT would play at the effects volume and mislead.
  }

  return (
    <div className="options-audio">
      <button className="options-item" onClick={handleMute} aria-pressed={muted}>
        <span className="options-item-glyph" aria-hidden="true">
          {muted ? '🔇' : '🔊'}
        </span>
        Sound
        <span className={`options-item-state${muted ? ' is-off' : ''}`}>{muted ? 'Muted' : 'On'}</span>
      </button>

      <div className={`audio-faders${muted ? ' is-muted' : ''}`}>
        <label className="audio-fader">
          <span className="audio-fader-label">Effects</span>
          <input
            className="audio-slider"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={sfx}
            onChange={(e) => handleSfx(Number(e.target.value))}
          />
          <span className="audio-fader-value">{Math.round(sfx * 100)}%</span>
        </label>

        <label className="audio-fader">
          <span className="audio-fader-label">Music</span>
          <input
            className="audio-slider"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={music}
            onChange={(e) => handleMusic(Number(e.target.value))}
          />
          <span className="audio-fader-value">{Math.round(music * 100)}%</span>
        </label>
      </div>
    </div>
  );
}
