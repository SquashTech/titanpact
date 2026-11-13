import { useState } from 'react';
import type { ScrollProgress } from '../../run/resume';
import type { RunState } from '../../run/state';
import type { StoryScreen } from '../../run/story';
import { GemNodeScreen } from '../run/GemNodeScreen';
import { ItemWhoScreen } from '../run/ItemWhoScreen';
import { GuideHand } from './GuideHand';

interface LessonScreenProps {
  screen: StoryScreen;
  run: RunState;
  onRunChange: (run: RunState) => void;
  onDone: () => void;
  /** The hand shows: no page is up over the screen. */
  guided: boolean;
}

/** A run's own screen, guided: only the hero each tap names is open, and the hand is on it (the tutorial's spoils). */
export function LessonScreen({ screen, run, onRunChange, onDone, guided }: LessonScreenProps) {
  const [acted, setActed] = useState(false);
  const [gems, setGems] = useState<ScrollProgress | undefined>(undefined);

  if (screen.kind === 'item') {
    const act = (next: RunState) => {
      setActed(true);
      onRunChange(next);
    };
    return (
      <>
        <ItemWhoScreen run={run} itemId={screen.itemId} onlyRosterIds={[screen.to]} noLeave onRunChange={act} onDone={onDone} />
        {guided && <GuideHand selector={acted ? '.item-who-screen .resolve-button' : '.item-ledger-row.is-offered'} />}
      </>
    );
  }
  const placed = screen.gems.length - (gems?.remaining ?? screen.gems.length);
  const current = screen.gems[placed];
  return (
    <>
      <GemNodeScreen
        run={run}
        onRunChange={onRunChange}
        plan={{ source: 'drop', gems: screen.gems.map((g) => g.gem) }}
        progress={gems}
        onProgress={setGems}
        onlyRosterIds={current ? [current.to] : []}
        onDone={onDone}
      />
      {guided && current && <GuideHand selector=".gem-screen .pick-card:not(.is-locked)" />}
    </>
  );
}
