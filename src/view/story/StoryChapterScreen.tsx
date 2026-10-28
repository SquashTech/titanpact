import { useEffect, useMemo, useState } from 'react';
import { allCombatants } from '../../data/content';
import { storySides, type StoryChapter } from '../../run/story';
import type { RunState } from '../../run/state';
import { FightScreen } from '../combat/FightScreen';
import { MANUAL_PAGES } from '../../data/howToPlay';
import { lessonPages } from '../../run/manual';
import { LessonLearnedScreen } from './LessonLearnedScreen';
import { ItemWhoScreen } from '../run/ItemWhoScreen';
import { GuideHand } from './GuideHand';
import { TipOverlay } from '../run/TipOverlay';
import type { Tip } from '../../run/tips';

interface Props {
  chapter: StoryChapter;
  /** Every beat played: the chapter is over. */
  onFinished: () => void;
  /** Left mid-chapter; nothing is recorded. */
  onQuit: () => void;
  /** The ground a fight beat stands on, for the arena and the music; null for the plain arena. */
  onPlace: (locationId: string | null) => void;
  /** The tips already shown this play: the lesson's own pages, and the control tips on a fight's cues. */
  tips: { seenIds: readonly string[]; onSeen: (id: string) => void };
  /** What leaving a fight is called. */
  exitLabel: string;
  /** Shown ahead of everything else, once: the game's welcome before its first lesson. */
  welcome?: { tip: Tip; onSeen: () => void };
}

/**
 * Plays a chapter's beats in order, a First Light lesson's among them, each opening on the lesson's
 * How to Play pages before its first tap. A lost fight is played again from its start.
 */
export function StoryChapterScreen({ chapter, onFinished, onQuit, onPlace, tips, exitLabel, welcome }: Props) {
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const beat = chapter.beats[index];
  const next = () => setIndex((i) => i + 1);
  const sides = useMemo(() => (beat ? storySides(beat.fight, allCombatants) : null), [beat]);
  // A beat's hand-over: the party as the item screen leaves it, and whether it has been handed. Kept across a replay.
  const [given, setGiven] = useState<{ index: number; run: RunState; done: boolean } | null>(null);
  const handed = given?.index === index ? given : null;
  const pages = useMemo(() => lessonPages(MANUAL_PAGES, chapter.id), [chapter.id]);
  const [welcomed, setWelcomed] = useState(false);
  const opening = welcome && !welcomed ? welcome.tip : null;
  const page = beat ? opening ?? pages.find((p) => !tips.seenIds.includes(p.id)) ?? null : null;
  const pageUp = page && (
    <TipOverlay
      key={page.id}
      tip={page}
      onDone={() => {
        if (page === opening) {
          setWelcomed(true);
          welcome!.onSeen();
        } else tips.onSeen(page.id);
      }}
    />
  );

  useEffect(() => {
    if (beat) onPlace(beat.locationId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  if (!beat) {
    return pages.length > 0 ? <LessonLearnedScreen pages={pages} onContinue={onFinished} /> : <Finish onFinished={onFinished} />;
  }
  if (beat.handOver && !handed?.done) {
    const { itemId, to } = beat.handOver;
    return (
      <>
        <ItemWhoScreen
          run={handed?.run ?? sides!.player.run}
          itemId={itemId}
          onlyRosterIds={[to]}
          noSell
          onRunChange={(run) => setGiven({ index, run, done: false })}
          onDone={() => setGiven((g) => ({ index, run: g?.run ?? sides!.player.run, done: true }))}
        />
        {page ? pageUp : <GuideHand selector={handed ? '.item-who-screen .resolve-button' : '.item-ledger-row.is-offered'} />}
      </>
    );
  }
  return (
    <>
      <FightScreen
        key={`${index}:${attempt}`}
        playerRun={handed?.run ?? sides!.player.run}
        playerSquad={sides!.player.squad}
        aiRun={sides!.ai.run}
        aiSquad={sides!.ai.squad}
        goldReward={0}
        xpGained={0}
        equipmentReward={null}
        story={beat.fight}
        storyCues={page ? undefined : beat.cues}
        storyLine={beat.line}
        storyTips={tips}
        cinematicWin
        onResolved={(outcome) => (outcome === 'win' ? next() : setAttempt((n) => n + 1))}
        onExitToTitle={onQuit}
        exitLabel={exitLabel}
      />
      {pageUp}
    </>
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
