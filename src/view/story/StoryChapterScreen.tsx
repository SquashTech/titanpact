import { useEffect, useMemo, useState } from 'react';
import { allCombatants } from '../../data/content';
import { storySides, type StoryAct, type StoryChapter } from '../../run/story';
import { FightScreen } from '../combat/FightScreen';
import { TitanFallScreen } from '../run/TitanFallScreen';
import { StoryEndCard, StoryMemory, StoryScene } from './StoryScene';

interface Props {
  chapter: StoryChapter;
  /** The chapter played to its end card. */
  onFinished: () => void;
  /** Left mid-chapter; nothing is recorded. */
  onQuit: () => void;
  /** The Titan's fall has played: the account has seen it, so Classic does not play it again. */
  onFallSeen: () => void;
  /** Where the chapter stands now, for the music: a scene's or a memory's place, silence for the fall. */
  onPlace: (locationId: string | null) => void;
  /** The beat to open on: 0, or the one after an act the run's screens just played. */
  startBeat?: number;
  /** A beat that is an Act hands over to the run's own screens. */
  onStartAct: (act: StoryAct, beat: number) => void;
}

/** Plays a chapter's beats in order (docs/stories.md §10). A lost fight is played again from its start. */
export function StoryChapterScreen({ chapter, onFinished, onQuit, onFallSeen, onPlace, startBeat = 0, onStartAct }: Props) {
  const [index, setIndex] = useState(startBeat);
  const [attempt, setAttempt] = useState(0);
  const beat = chapter.beats[index];
  const next = () => setIndex((i) => i + 1);
  const sides = useMemo(() => (beat?.kind === 'fight' ? storySides(beat.fight, allCombatants) : null), [beat]);

  useEffect(() => {
    if (beat?.kind === 'scene' || beat?.kind === 'memory') onPlace(beat.locationId);
    else if (beat?.kind === 'fall') onPlace(null);
    if (beat?.kind === 'act') onStartAct(beat.act, index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  if (!beat || beat.kind === 'act') return null;
  if (beat.kind === 'memory') return <StoryMemory key={index} locationId={beat.locationId} lines={beat.lines} voice={beat.voice} onDone={next} />;
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
