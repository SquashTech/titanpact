import { useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { nextChapter, storyChapterPips, type StoryDefinition } from '../../run/story';
import { PlateButton } from '../shared/PlateButton';
import './story.css';

const BANNERS = import.meta.glob<string>('../../../art/stories/*.png', { eager: true, query: '?url', import: 'default' });
const bannerFor = (storyId: string): string | undefined =>
  Object.entries(BANNERS).find(([path]) => path.endsWith(`/${storyId}.png`))?.[1];

/** Cycle I white, II copper, III frost, IV gold, V rainbow: the colours stars already use. */
const CYCLE_CLASS = ['', 'c1', 'c2', 'c3', 'c4', 'c5'];

interface Props {
  stories: readonly StoryDefinition[];
  chaptersDone: readonly string[];
  cyclesCleared: number;
  onPlayChapter: (chapterId: string) => void;
  onClassic: () => void;
  onBack: () => void;
}

type Pick = { kind: 'story'; story: StoryDefinition } | { kind: 'classic' };

/** Lit marks wear their Cycle's colour: a Story's chapters all one Cycle's, Classic's Cycles each their own. */
function Pips({ marks, cycle }: { marks: readonly ('done' | 'now' | null)[]; cycle?: number }) {
  return (
    <span className="story-pips" aria-hidden="true">
      {marks.map((mark, i) => (
        <b key={i} className={mark === 'done' ? CYCLE_CLASS[cycle ?? i + 1] : mark === 'now' ? 'is-now' : ''} />
      ))}
    </span>
  );
}

/** What Seal the Pact opens once the prologue is played (docs/stories.md §10): the featured book, a Journey on the shelf. */
export function StorySelectScreen({ stories, chaptersDone, cyclesCleared, onPlayChapter, onClassic, onBack }: Props) {
  const picks: Pick[] = [...stories.map((story) => ({ kind: 'story' as const, story })), { kind: 'classic' }];
  const [selected, setSelected] = useState(0);
  const pick = picks[selected];
  const classicPips = [1, 2, 3, 4, 5].map((c) => (c <= cyclesCleared ? 'done' : c === cyclesCleared + 1 ? 'now' : null));

  const chapter = pick.kind === 'story' ? nextChapter(pick.story, chaptersDone) ?? pick.story.chapters[pick.story.chapters.length - 1] : null;
  const started = pick.kind === 'story' && pick.story.chapters.some((c) => chaptersDone.includes(c.id));
  const finished = pick.kind === 'story' && nextChapter(pick.story, chaptersDone) === null;
  const verb = pick.kind === 'classic' ? 'Seal the Pact' : finished ? 'Replay' : started ? 'Continue' : 'Begin';

  function art(p: Pick) {
    if (p.kind === 'classic') return <span className="story-classic-art" aria-hidden="true"><span className="story-classic-seal" /></span>;
    const banner = bannerFor(p.story.id);
    return banner ? <span className="story-banner" style={{ backgroundImage: `url(${banner})` }} aria-hidden="true" /> : null;
  }
  const name = (p: Pick) => (p.kind === 'classic' ? 'The Infinite' : p.story.name);
  const pipsOf = (p: Pick) => {
    if (p.kind === 'classic') return <Pips marks={classicPips} />;
    const { cycle, marks } = storyChapterPips(p.story, chaptersDone);
    return <Pips marks={marks} cycle={cycle} />;
  };

  return (
    <div className="story-screen story-select">
      <button type="button" className="story-back" onClick={onBack} aria-label="Back">
        ‹
      </button>
      <div className="story-feature">
        {art(pick)}
        <div className="story-feature-text">
          <h1 className="story-feature-name">{name(pick)}</h1>
          {chapter && <p className="story-feature-chapter">{chapter.title}</p>}
          {pick.kind === 'classic' && <p className="story-feature-chapter">Four Guardians, then the Titan</p>}
          {pipsOf(pick)}
        </div>
      </div>
      <div className="story-shelf">
        {picks.map((p, i) => (
          <button
            key={p.kind === 'classic' ? 'classic' : p.story.id}
            type="button"
            className={`story-cover${i === selected ? ' is-on' : ''}`}
            onClick={() => {
              playSfx('ui.tap');
              setSelected(i);
            }}
          >
            {art(p)}
            <span className="story-cover-name">{name(p)}</span>
            {pipsOf(p)}
          </button>
        ))}
      </div>
      <PlateButton className="story-go" onClick={() => (pick.kind === 'classic' ? onClassic() : chapter && onPlayChapter(chapter.id))}>
        {verb}
      </PlateButton>
    </div>
  );
}
