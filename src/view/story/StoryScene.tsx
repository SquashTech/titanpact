import { useState } from 'react';
import { playSfx } from '../../audio/sfx';
import type { StoryActor, StoryLine } from '../../run/story';
import { HeroPortrait } from '../shared/HeroPortrait';
import { locationBackdrop } from '../shared/locationBackdrops';
import './story.css';

interface Props {
  locationId: string;
  cast: readonly StoryActor[];
  lines: readonly StoryLine[];
  skipped: string;
  onDone: () => void;
}

/** A Story scene (docs/stories.md §10): the cast on the place's backdrop, one line a tap, the speaker stepping forward. */
export function StoryScene({ locationId, cast, lines, skipped, onDone }: Props) {
  const [step, setStep] = useState(0);
  const [skipping, setSkipping] = useState(false);
  const line = lines[Math.min(step, lines.length - 1)];
  const speaker = cast.find((actor) => actor.id === line?.speaker) ?? null;
  const backdrop = locationBackdrop(locationId);

  function advance() {
    if (skipping || step >= lines.length - 1) {
      playSfx('ui.confirm');
      onDone();
      return;
    }
    playSfx('ui.tap');
    setStep((i) => i + 1);
  }

  const left = cast.filter((actor) => actor.stands === 'left');
  const right = cast.filter((actor) => actor.stands === 'right');
  const figure = (actor: StoryActor) => (
    <div key={actor.id} className={`story-figure${actor.id === speaker?.id ? ' is-speaking' : ''}`}>
      <HeroPortrait heroId={actor.artHeroId} className="story-figure-sprite" />
    </div>
  );

  return (
    <div className="story-screen story-scene" onClick={advance} role="dialog" aria-live="polite">
      {backdrop && <div className="story-backdrop" style={{ backgroundImage: `url(${backdrop})` }} aria-hidden="true" />}
      <button
        type="button"
        className="story-skip"
        onClick={(e) => {
          e.stopPropagation();
          playSfx('ui.tap');
          setSkipping(true);
        }}
      >
        Skip
      </button>
      <div className="story-stage" aria-hidden="true">
        <div className="story-side is-left">{left.map(figure)}</div>
        <div className="story-side is-right">{right.map(figure)}</div>
      </div>
      <div className={`story-line${speaker ? '' : ' is-narration'}${line?.think ? ' is-thought' : ''}`}>
        {skipping ? (
          <p className="story-line-text">{skipped}</p>
        ) : (
          <>
            {speaker && <span className="story-line-name">{speaker.name}</span>}
            <p className="story-line-text">{line?.text}</p>
          </>
        )}
      </div>
    </div>
  );
}

/** A chapter's last beat: its title, one closing line, back to the Story select. */
export function StoryEndCard({ title, line, onDone }: { title: string; line: string; onDone: () => void }) {
  return (
    <div
      className="story-screen story-end"
      onClick={() => {
        playSfx('ui.confirm');
        onDone();
      }}
      role="dialog"
    >
      <p className="story-end-line">{line}</p>
      <h1 className="story-end-title">{title}</h1>
    </div>
  );
}
