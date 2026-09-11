import { useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import mentorArt from '../../../art/npc/mentor.png';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import { grantOfferedMove, MOVE_CAP, recordMoveOffer } from '../../run/progression';
import { mentorMovePool } from '../../run/tutor';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { NodeHeader, NodeSky, NODE_TINT_INSIGHT } from '../shared/NodeStage';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { MoveLearnedOverlay, MoveOfferOverlay } from './MoveOfferOverlay';
import { RosterPeek } from './RosterPeek';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

/** The roll, once made. Below the cap the move has already landed; at the cap it is the replace question. */
interface Lesson {
  rosterId: string;
  moveId: string;
  learned: boolean;
}

/**
 * `mentorReward` node (acts 1-3, docs/growth-overhaul.md §11): "the Mentor can teach any hero a
 * powerful move." Pick a hero, and one Mid-tier move is ROLLED from that hero's pool — the same
 * beat as a Scroll pour with the band fixed at Mid, un-rank-gated and ticking nothing. The only
 * decision on the screen is who, which is what one of a new player's first nodes can carry.
 *
 * The offer is spent by being made, as a Scroll's is (`recordMoveOffer` before the answer): a
 * roll declined is a roll burned.
 */
export function MentorNodeScreen({ run, onRunChange, onContinue }: Props) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  const poolOf = (entry: RosterEntry) => mentorMovePool(progressionTable, moves, entry);
  const anyTeachable = run.roster.some((entry) => poolOf(entry).length > 0);
  const lessonEntry = lesson ? (run.roster.find((r) => r.rosterId === lesson.rosterId) ?? null) : null;

  function teach(entry: RosterEntry) {
    const pool = poolOf(entry);
    if (pool.length === 0) return;
    const moveId = pool[Math.floor(Math.random() * pool.length)];
    playSfx('class.learn');
    let next = recordMoveOffer(run, entry.rosterId, [moveId]);
    // Room in the kit: it simply lands, and the box only says so. At the cap the question is real.
    const learned = entry.unlockedMoveIds.length < MOVE_CAP;
    if (learned) next = grantOfferedMove(next, entry.rosterId, moveId);
    onRunChange(next);
    setLesson({ rosterId: entry.rosterId, moveId, learned });
  }

  function resolve(replaceMoveId: string | null, learn: boolean) {
    if (!lesson) return;
    if (learn) onRunChange(grantOfferedMove(run, lesson.rosterId, lesson.moveId, replaceMoveId ?? undefined));
    onContinue();
  }

  return (
    <div className="node-screen tutor-node-screen mentor-node-screen" style={{ '--node-rgb': NODE_TINT_INSIGHT } as CSSProperties}>
      <NodeSky />
      <RosterPeek run={run} />

      <NodeHeader
        compact
        ring
        art={<img src={mentorArt} className="class-shrine-mentor" alt="" draggable={false} />}
        eyebrow="The Mentor Awaits"
        title="Mentor's Hall"
        readout={
          anyTeachable
            ? 'The Mentor can teach any hero a powerful move. Choose who — hold a card to review its sheet.'
            : 'There is nothing left here the Mentor can teach.'
        }
      />

      {anyTeachable ? (
        <HeroPickGrid count={run.roster.length} fill>
          {run.roster.map((entry) => {
            const hero = heroes[entry.heroId];
            const teachable = poolOf(entry).length > 0;
            return (
              <HeroPickCard
                key={entry.rosterId}
                hero={hero}
                entry={entry}
                disabled={!teachable || !!lesson}
                onActivate={() => teach(entry)}
                onPreview={() => setPreviewEntry({ hero, entry })}
                ariaLabel={`${hero.name}, level ${entry.level} — ${teachable ? 'learn a move' : 'nothing left to teach'}`}
                ctaClassName="is-accent"
                cta={teachable ? 'Learn' : 'Nothing left'}
              />
            );
          })}
        </HeroPickGrid>
      ) : (
        <div className="node-spacer" />
      )}

      {!anyTeachable && (
        <button className="resolve-button" onClick={onContinue}>
          Continue
        </button>
      )}

      {lesson && lessonEntry && (lesson.learned ? (
        <MoveLearnedOverlay run={run} entry={lessonEntry} moveId={lesson.moveId} eyebrow="The Mentor teaches" onClose={onContinue} />
      ) : (
        <MoveOfferOverlay run={run} entry={lessonEntry} moveId={lesson.moveId} eyebrow="The Mentor teaches — your kit is full" onResolve={resolve} />
      ))}

      {previewEntry && (
        <HeroPreviewOverlay
          hero={previewEntry.hero}
          entry={previewEntry.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          onClose={() => setPreviewEntry(null)}
        />
      )}
    </div>
  );
}
