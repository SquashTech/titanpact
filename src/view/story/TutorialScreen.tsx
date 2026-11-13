import { useEffect, useMemo, useState } from 'react';
import { allCombatants } from '../../data/content';
import {
  TUTORIAL_CUES,
  TUTORIAL_FIGHT,
  TUTORIAL_GEMS,
  TUTORIAL_GEMS_TIP,
  TUTORIAL_ITEM,
  TUTORIAL_ITEM_TIP,
  TUTORIAL_MAP_TIP,
  TUTORIAL_OPEN_FOE_LEADS,
  TUTORIAL_OPEN_FOES,
  TUTORIAL_ROAD,
} from '../../data/tutorial';
import { advanceToNode } from '../../run/runProgress';
import { openingSquad } from '../../run/squad';
import type { RunState } from '../../run/state';
import { storyEncounter, storySides } from '../../run/story';
import type { Tip } from '../../run/tips';
import { partyAfterFight } from '../../run/tutorial';
import { FightScreen } from '../combat/FightScreen';
import { MapScreen } from '../run/MapScreen';
import { RestNodeScreen } from '../run/RestNodeScreen';
import { TipOverlay } from '../run/TipOverlay';
import { GuideHand } from './GuideHand';
import { LessonScreen } from './LessonScreen';
import { TutorialRecruitScreen } from './TutorialRecruitScreen';

/** Where the tutorial stands and fights. */
const TUTORIAL_PLACE = 'wildsEdge';

type Stage = 'fight' | 'item' | 'gems' | 'map' | 'recruitReward' | 'restReward' | 'fight2';

interface Props {
  /** Shown once before the fight: the game's welcome. */
  welcome: Tip;
  onFinished: () => void;
  onQuit: () => void;
  onPlace: (locationId: string | null) => void;
  exitLabel: string;
}

/**
 * The tutorial (docs/the-tutorial.md): one scripted fight, its spoils, a road of three stops, and an
 * open fight. Each prompt is tapped through once a play; the hand points at every guided tap.
 */
export function TutorialScreen({ welcome, onFinished, onQuit, onPlace, exitLabel }: Props) {
  const [stage, setStage] = useState<Stage>('fight');
  const [attempt, setAttempt] = useState(0);
  const [seenIds, setSeenIds] = useState<readonly string[]>([]);
  const seen = (id: string) => setSeenIds((ids) => [...ids, id]);
  const [run, setRun] = useState<RunState | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const sides = useMemo(() => storySides(TUTORIAL_FIGHT, allCombatants), []);
  const foes = useMemo(() => storyEncounter(TUTORIAL_OPEN_FOES, TUTORIAL_OPEN_FOE_LEADS, allCombatants), []);

  useEffect(() => onPlace(TUTORIAL_PLACE), [onPlace]);

  /** A page shown once a play, ahead of its screen. */
  const page = (tip: Tip) => (!seenIds.includes(tip.id) ? <TipOverlay key={tip.id} tip={tip} onDone={() => seen(tip.id)} /> : null);
  const unseen = (tip: Tip) => !seenIds.includes(tip.id);

  if (stage === 'fight') {
    const greeting = unseen(welcome);
    return (
      <>
        <FightScreen
          key={`fight:${attempt}`}
          playerRun={sides.player.run}
          playerSquad={sides.player.squad}
          aiRun={sides.ai.run}
          aiSquad={sides.ai.squad}
          xpGained={0}
          equipmentReward={null}
          story={TUTORIAL_FIGHT}
          storyCues={greeting ? undefined : TUTORIAL_CUES}
          storyTips={{ seenIds, onSeen: seen }}
          cinematicWin
          onResolved={(outcome, state) => {
            if (outcome === 'loss') return setAttempt((n) => n + 1);
            setRun(partyAfterFight(sides.player.run, state, allCombatants, TUTORIAL_ROAD, TUTORIAL_PLACE));
            setStage('item');
          }}
          onExitToTitle={onQuit}
          exitLabel={exitLabel}
        />
        {page(welcome)}
      </>
    );
  }

  if (!run) return null;

  if (stage === 'item' || stage === 'gems') {
    const tip = stage === 'item' ? TUTORIAL_ITEM_TIP : TUTORIAL_GEMS_TIP;
    return (
      <>
        <LessonScreen
          key={stage}
          screen={stage === 'item' ? TUTORIAL_ITEM : TUTORIAL_GEMS}
          run={run}
          onRunChange={setRun}
          onDone={() => setStage(stage === 'item' ? 'gems' : 'map')}
          guided={!unseen(tip)}
        />
        {page(tip)}
      </>
    );
  }

  if (stage === 'map') {
    return (
      <>
        <MapScreen
          run={run}
          onRunChange={setRun}
          onSelectNode={(id) => {
            const type = run.map!.nodes[id].type;
            setNodeId(id);
            setStage(type === 'restReward' ? 'restReward' : type === 'recruitReward' ? 'recruitReward' : 'fight2');
          }}
        />
        {page(TUTORIAL_MAP_TIP) ?? <GuideHand selector={['.map-preview-go', '.map-medallion']} />}
      </>
    );
  }

  const arrive = () => {
    setRun((current) => (current && nodeId ? advanceToNode(current, nodeId) : current));
    setStage('map');
  };

  if (stage === 'recruitReward') return <TutorialRecruitScreen run={run} onRunChange={setRun} onContinue={arrive} />;
  if (stage === 'restReward') return <RestNodeScreen run={run} onRunChange={setRun} onContinue={arrive} />;

  return (
    <FightScreen
      key={`open:${attempt}`}
      playerRun={run}
      playerSquad={openingSquad(run.roster)}
      aiRun={foes.run}
      aiSquad={foes.squad}
      xpGained={0}
      equipmentReward={null}
      cinematicWin
      onResolved={(outcome) => (outcome === 'win' ? onFinished() : setAttempt((n) => n + 1))}
      onExitToTitle={onQuit}
      exitLabel={exitLabel}
    />
  );
}
