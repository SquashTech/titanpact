import { useEffect, useMemo, useState } from 'react';
import { allCombatants } from '../../data/content';
import { storySides, type StoryAct, type StoryChapter } from '../../run/story';
import { FightScreen } from '../combat/FightScreen';

interface Props {
  chapter: StoryChapter;
  /** Every beat played: the chapter is over. */
  onFinished: () => void;
  /** Left mid-chapter; nothing is recorded. */
  onQuit: () => void;
  /** The ground a fight beat stands on, for the arena and the music; null for the plain arena. */
  onPlace: (locationId: string | null) => void;
  /** The beat to open on: 0, or the one after an act the run's screens just played. */
  startBeat?: number;
  /** A beat that is an Act hands over to the run's own screens. */
  onStartAct: (act: StoryAct, beat: number) => void;
  /** The tips already shown, for the control tips on a fight's cues. */
  tips: { seenIds: readonly string[]; onSeen: (id: string) => void };
  /** What leaving a fight is called. */
  exitLabel: string;
}

/** Plays a chapter's beats in order, a First Light lesson's among them. A lost fight is played again from its start. */
export function StoryChapterScreen({ chapter, onFinished, onQuit, onPlace, startBeat = 0, onStartAct, tips, exitLabel }: Props) {
  const [index, setIndex] = useState(startBeat);
  const [attempt, setAttempt] = useState(0);
  const beat = chapter.beats[index];
  const next = () => setIndex((i) => i + 1);
  const sides = useMemo(() => (beat?.kind === 'fight' ? storySides(beat.fight, allCombatants) : null), [beat]);

  useEffect(() => {
    if (beat?.kind === 'fight') onPlace(beat.locationId ?? null);
    if (beat?.kind === 'act') onStartAct(beat.act, index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  if (!beat) return <Finish onFinished={onFinished} />;
  if (beat.kind === 'act') return null;
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
      storyTips={tips}
      cinematicWin
      onResolved={(outcome) => (outcome === 'win' ? next() : setAttempt((n) => n + 1))}
      onExitToTitle={onQuit}
      exitLabel={exitLabel}
    />
  );
}

/** Says a chapter is over the moment it mounts. */
function Finish({ onFinished }: { onFinished: () => void }) {
  useEffect(() => {
    onFinished();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
