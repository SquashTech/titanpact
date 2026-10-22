import { playSfx } from '../../audio/sfx';
import { NightSky } from '../run/NightSky';
import './story.css';

interface Props {
  onStory: () => void;
  onJourney: () => void;
}

/**
 * Once, after the prologue (docs/stories.md §10): the two roads open to a new player, each saying what
 * it is. The Story's is the default; a Journey is the whole game at once.
 */
export function ManyRoadsScreen({ onStory, onJourney }: Props) {
  const choose = (go: () => void) => () => {
    playSfx('ui.confirm');
    go();
  };
  return (
    <div className="story-screen story-roads" role="dialog" aria-labelledby="roads-title">
      <NightSky />
      <div className="story-roads-body">
        <h1 id="roads-title" className="story-roads-title">
          Many Roads
        </h1>
        <p className="story-roads-intro">Titanpact can be played many ways. For now, two roads are open to you.</p>
        <button type="button" className="story-road is-primary" onClick={choose(onStory)}>
          <span className="story-road-name">Continue Valor's Story</span>
          <span className="story-road-what">
            Her next chapter: one short act, and a little more of the game to learn. The surest way in.
          </span>
        </button>
        <button type="button" className="story-road" onClick={choose(onJourney)}>
          <span className="story-road-name">Begin a Journey</span>
          <span className="story-road-what">
            The full game. Draft a team from the heroes in your Collection, defeat four Guardians, then face the Titan
            itself. Lose a fight and the Journey ends.
          </span>
        </button>
      </div>
    </div>
  );
}
