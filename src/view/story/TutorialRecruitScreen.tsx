import { useMemo, useState, type CSSProperties } from 'react';
import { allCombatants, rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import { TUTORIAL_LEVEL } from '../../data/tutorial';
import type { HeroDefinition } from '../../engine/content';
import { draftableTypes, deckRowOf } from '../../run/deck';
import { joinEventRecruit } from '../../run/events';
import type { RosterEntry, RunState } from '../../run/state';
import { statScaleFor } from '../../run/statScale';
import { storyEntry } from '../../run/story';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { NodeMotes } from '../shared/NodeStage';
import { HeroPreviewOverlay } from '../run/HeroPreviewOverlay';
import { mapNodeIcon } from '../run/mapNodeArt';
import { RecruitOath } from '../run/RecruitOath';
import '../run/recruitNode.css';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

const RECRUIT_RGB = '155, 201, 255';

/** The tutorial's Recruit (docs/the-tutorial.md §3): the first real choice, any base hero the party does not hold. */
export function TutorialRecruitScreen({ run, onRunChange, onContinue }: Props) {
  // The offer is read once, so the joining hero does not reshuffle it.
  const offer = useMemo<RosterEntry[]>(() => {
    const order = draftableTypes(rosterHeroes);
    return Object.values(rosterHeroes)
      .filter((hero) => !hero.unlock && !run.roster.some((entry) => entry.heroId === hero.id))
      .sort((a, b) => order.indexOf(deckRowOf(a)) - order.indexOf(deckRowOf(b)))
      .map((hero) => storyEntry({ rosterId: `recruit-${hero.id}`, heroId: hero.id, level: TUTORIAL_LEVEL }, allCombatants[hero.id]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [joined, setJoined] = useState<RosterEntry | null>(null);
  const [preview, setPreview] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const picked = offer.find((entry) => entry.rosterId === pickedId) ?? null;

  if (joined) return <RecruitOath run={run} entry={joined} onContinue={onContinue} />;

  return (
    <div className="node-screen rite-screen recruit-node-screen" style={{ '--rite-color': `rgb(${RECRUIT_RGB})` } as CSSProperties}>
      <span className="node-sky" aria-hidden="true" />
      <NodeMotes count={10} />
      <header className="rite-head">
        <span className="rite-place">
          <span className="rite-pool" aria-hidden="true" />
          <img src={mapNodeIcon('recruitReward')} className="rite-place-art is-icon" alt="" draggable={false} />
        </span>
        <h2 className="rite-name">Recruit</h2>
      </header>

      <HeroPickGrid count={offer.length} fill columns={3}>
        {offer.map((entry) => {
          const hero = rosterHeroes[entry.heroId];
          return (
            <HeroPickCard
              key={entry.rosterId}
              hero={hero}
              entry={entry}
              selected={pickedId === entry.rosterId}
              onActivate={() => setPickedId(entry.rosterId)}
              onPreview={() => setPreview({ hero, entry })}
              ariaLabel={`${hero.name} — tap to choose, hold to read`}
              cta={pickedId === entry.rosterId ? 'Chosen' : 'Choose'}
            />
          );
        })}
      </HeroPickGrid>

      <div className="reward-panel-actions moveoffer-actions event-leave-actions">
        <button
          className="moveoffer-button moveoffer-confirm"
          disabled={!picked}
          onClick={() => {
            if (!picked) return;
            onRunChange(joinEventRecruit(run, picked));
            setJoined(picked);
          }}
        >
          <span className="moveoffer-label">{picked ? `${rosterHeroes[picked.heroId].name} joins` : 'Choose a hero'}</span>
        </button>
      </div>

      {preview && (
        <HeroPreviewOverlay
          hero={preview.hero}
          entry={preview.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          scale={statScaleFor(run)}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
