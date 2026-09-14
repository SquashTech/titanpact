import { useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import { grantOfferedMove, MOVE_CAP, recordMoveOffer } from '../../run/progression';
import { tutorMovePool } from '../../run/tutor';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { NodeGlyph } from '../shared/nodeIcons';
import { NodeHeader, NodeSky, NODE_TINT_INSIGHT } from '../shared/NodeStage';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { MoveLearnedOverlay, MoveOfferOverlay } from './MoveOfferOverlay';
import { RosterPeek } from './RosterPeek';
import { levelOf } from '../../run/growth';

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
 * `tutorReward` node (acts 4-5, docs/run-loop.md "The Tutor"): the Mentor's beat at the Late
 * band (2026-09-13, per user direction). Pick a hero, and one Late-tier move is ROLLED from that
 * hero's pool — a schedule offer with the band fixed at Late, un-gated, taking no entry. It used
 * to be a curated pick of any move off the pool: the run's strongest reward and its longest
 * screen. The roll keeps the payoff — a guaranteed Late move, ahead of the band or beside it —
 * and leaves WHO as the only decision.
 *
 * The offer is spent by being made (`recordMoveOffer` before the answer): a roll declined is a
 * roll burned.
 */
export function TutorNodeScreen({ run, onRunChange, onContinue }: Props) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  const poolOf = (entry: RosterEntry) => tutorMovePool(progressionTable, moves, entry);
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
    <div className="node-screen tutor-node-screen" style={{ '--node-rgb': NODE_TINT_INSIGHT } as CSSProperties}>
      <NodeSky />
      <RosterPeek run={run} />

      <NodeHeader
        compact
        glyph={<NodeGlyph type="tutorReward" />}
        eyebrow="A Master Waits"
        title="The Tutor"
        readout={
          anyTeachable
            ? 'The Tutor teaches any hero one of its deepest techniques — a Late move, guaranteed. Choose who; hold a card to review its sheet.'
            : 'There is nothing left here the Tutor can teach.'
        }
      />

      {anyTeachable ? (
        <HeroPickGrid count={run.roster.length} fill>
          {run.roster.map((entry) => {
            const hero = rosterHeroes[entry.heroId];
            const teachable = poolOf(entry).length > 0;
            return (
              <HeroPickCard
                key={entry.rosterId}
                hero={hero}
                entry={entry}
                disabled={!teachable || !!lesson}
                onActivate={() => teach(entry)}
                onPreview={() => setPreviewEntry({ hero, entry })}
                ariaLabel={`${hero.name}, level ${levelOf(entry)} — ${teachable ? 'learn a Late move' : 'nothing left to teach'}`}
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
        <MoveLearnedOverlay run={run} entry={lessonEntry} moveId={lesson.moveId} eyebrow="The Tutor teaches" onClose={onContinue} />
      ) : (
        <MoveOfferOverlay run={run} entry={lessonEntry} moveId={lesson.moveId} eyebrow="The Tutor teaches — your kit is full" onResolve={resolve} />
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
