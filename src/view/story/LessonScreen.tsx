import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { allCombatants } from '../../data/content';
import { claimContract, deriveContractOffer } from '../../run/recruitment';
import type { ScrollProgress } from '../../run/resume';
import type { RunState } from '../../run/state';
import { storyEntry, type StoryScreen } from '../../run/story';
import { GemNodeScreen } from '../run/GemNodeScreen';
import { ItemWhoScreen } from '../run/ItemWhoScreen';
import { RecruitScreen } from '../run/RecruitScreen';
import { overlayHost } from '../shared/overlayHost';
import { GuideHand } from './GuideHand';

interface LessonScreenProps {
  screen: StoryScreen;
  run: RunState;
  onRunChange: (run: RunState) => void;
  onDone: () => void;
  /** The hand shows: no page is up over the screen. */
  guided: boolean;
}

/** A run's own screen as a lesson beat: only the hero each tap names is open, and the hand is on it. */
export function LessonScreen({ screen, run, onRunChange, onDone, guided }: LessonScreenProps) {
  const [acted, setActed] = useState(false);
  const [gems, setGems] = useState<ScrollProgress | undefined>(undefined);
  const offer = useMemo(() => (screen.kind === 'contract' ? storyEntry(screen.offer, allCombatants[screen.offer.heroId]) : null), [screen]);
  const act = (next: RunState) => {
    setActed(true);
    onRunChange(next);
  };

  if (screen.kind === 'item') {
    return (
      <>
        <ItemWhoScreen run={run} itemId={screen.itemId} onlyRosterIds={[screen.to]} noSell onRunChange={act} onDone={onDone} />
        {guided && <GuideHand selector={acted ? '.item-who-screen .resolve-button' : '.item-ledger-row.is-offered'} />}
      </>
    );
  }
  if (screen.kind === 'gems') {
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
  return (
    <>
      <RecruitScreen
        run={run}
        offers={[offer!]}
        mustSign
        onClaim={(defeated) => {
          act(claimContract(run, deriveContractOffer(defeated), defeated.rosterId));
          return true;
        }}
        onClaimReplace={() => false}
        onDone={onDone}
      />
      {guided && <GuideHand selector={acted ? '.recruit-leave' : '.recruit-sign'} />}
    </>
  );
}

/** A screen lesson's one line, across the top of the screen it plays on. */
export function LessonLine({ text }: { text: string }) {
  return createPortal(<div className="lesson-line is-screen">{text}</div>, overlayHost());
}
