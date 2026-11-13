import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { allCombatants, rosterHeroes } from '../../data/content';
import { deckRowOf } from '../../run/deck';
import type { ScrollProgress } from '../../run/resume';
import type { RunState } from '../../run/state';
import { storyEntry, type StoryScreen } from '../../run/story';
import { GemNodeScreen } from '../run/GemNodeScreen';
import { ItemWhoScreen } from '../run/ItemWhoScreen';
import { RecruitNodeScreen, type RecruitOffer } from '../run/RecruitNodeScreen';
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
  const offer = useMemo(() => (screen.kind === 'recruit' ? storyEntry(screen.offer, allCombatants[screen.offer.heroId]) : null), [screen]);
  // Who could answer each type: the base heroes of it the party does not hold.
  const offers = useMemo<RecruitOffer[]>(
    () =>
      screen.kind === 'recruit'
        ? screen.types.map((type) => ({
            type,
            heroIds: Object.values(rosterHeroes)
              .filter((hero) => !hero.unlock && deckRowOf(hero) === type && !run.roster.some((entry) => entry.heroId === hero.id))
              .map((hero) => hero.id),
          }))
        : [],
    // The party at the lesson's start; Hollowbark joining must not reshuffle the tiles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [screen]
  );
  const act = (next: RunState) => {
    setActed(true);
    onRunChange(next);
  };

  if (screen.kind === 'item') {
    return (
      <>
        <ItemWhoScreen run={run} itemId={screen.itemId} onlyRosterIds={[screen.to]} noLeave onRunChange={act} onDone={onDone} />
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
      <RecruitNodeScreen
        run={run}
        offers={offers}
        entryFor={(type) => (type === screen.type ? offer : null)}
        pickedType={null}
        onPick={() => {}}
        onlyType={screen.type}
        onRunChange={act}
        onGrantEquipment={onDone}
        onContinue={onDone}
      />
      {guided && <GuideHand selector={acted ? '.recruit-node-screen .resolve-button' : '.recruit-type:not(:disabled)'} />}
    </>
  );
}

/** A screen lesson's one line, across the top of the screen it plays on. */
export function LessonLine({ text }: { text: string }) {
  return createPortal(<div className="lesson-line is-screen">{text}</div>, overlayHost());
}
