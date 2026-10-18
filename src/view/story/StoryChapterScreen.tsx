import { useMemo, useState } from 'react';
import { allCombatants } from '../../data/content';
import { storySides, type StoryChapter } from '../../run/story';
import { FightScreen } from '../combat/FightScreen';
import { TitanFallScreen } from '../run/TitanFallScreen';
import { StoryEndCard, StoryScene } from './StoryScene';

interface Props {
  chapter: StoryChapter;
  /** The chapter played to its end card. */
  onFinished: () => void;
  /** Left mid-chapter; nothing is recorded. */
  onQuit: () => void;
  /** The Titan's fall has played: the account has seen it, so Classic does not play it again. */
  onFallSeen: () => void;
}

/** Plays a chapter's beats in order (docs/stories.md §10). A lost fight is played again from its start. */
export function StoryChapterScreen({ chapter, onFinished, onQuit, onFallSeen }: Props) {
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const beat = chapter.beats[index];
  const next = () => setIndex((i) => i + 1);
  const sides = useMemo(() => (beat?.kind === 'fight' ? storySides(beat.fight, allCombatants) : null), [beat]);

  if (!beat) return null;
  if (beat.kind === 'scene') return <StoryScene key={index} locationId={beat.locationId} cast={beat.cast} lines={beat.lines} skipped={beat.skipped} onDone={next} />;
  if (beat.kind === 'fall')
    return (
      <TitanFallScreen
        key={index}
        lines={beat.lines}
        onDone={() => {
          onFallSeen();
          next();
        }}
      />
    );
  if (beat.kind === 'end') return <StoryEndCard title={chapter.title} line={beat.line} onDone={onFinished} />;
  return (
    <FightScreen
      key={`${index}:${attempt}`}
      playerRun={sides!.player.run}
      playerSquad={sides!.player.squad}
      aiRun={sides!.ai.run}
      aiSquad={sides!.ai.squad}
      goldReward={0}
      xpGained={0}
      equipmentReward={null}
      story={beat.fight}
      storyCues={beat.cues}
      cinematicWin
      onResolved={(outcome) => (outcome === 'win' ? next() : setAttempt((n) => n + 1))}
      onExitToTitle={onQuit}
      exitLabel="Leave the Story"
    />
  );
}
