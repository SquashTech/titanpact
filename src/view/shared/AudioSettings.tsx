import { useRef, useState } from 'react';
import { getAudioPrefs, playSfx, setMusicLevel, setMuted, setSfxLevel } from '../../audio/sfx';

// Volume and mute, as a drop-in block for a menu's .options-list.

// `input` fires per pixel of travel; throttle the preview tick.
const PREVIEW_THROTTLE_MS = 140;

export function AudioSettings() {
  const [muted, setMutedState] = useState(() => getAudioPrefs().muted);
  const [sfx, setSfx] = useState(() => getAudioPrefs().sfx);
  const [music, setMusic] = useState(() => getAudioPrefs().music);
  const lastPreview = useRef(0);

  function handleMute() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    // The row's own tap sound was suppressed while muted; say something on the way back.
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
    // No preview: an effect would play at the effects volume and mislead.
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
