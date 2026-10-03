import { useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { seededRandom } from '../shared/seededRandom';
import mentorArt from '../../../art/npc/mentor.png';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import { grantOfferedMove, MOVE_CAP, recordMoveOffer } from '../../run/progression';
import { mentorMovePool } from '../../run/tutor';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { NodeMotes } from '../shared/NodeStage';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { MoveLearnedOverlay, MoveOfferOverlay } from './MoveOfferOverlay';
import { RosterPeek } from './RosterPeek';
import { KeeperVoice, useKeeperLine } from './RoadEncounter';
import { MENTOR_LINES } from '../../data/roadLines';
import { levelOf } from '../../run/growth';
import { statScaleFor } from '../../run/statScale';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
  /** Fixes the screen's roll, so a resumed run is offered the same (docs/save-system.md D2). */
  seed: number;
}

/** The Mentor's teal (the map tile's --buff). */
const MENTOR_RGB = '63, 184, 175';

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
export function MentorNodeScreen({ run, onRunChange, onContinue, seed }: Props) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const voice = useKeeperLine(MENTOR_LINES);

  const poolOf = (entry: RosterEntry) => mentorMovePool(progressionTable, moves, entry);
  const anyTeachable = run.roster.some((entry) => poolOf(entry).length > 0);
  const lessonEntry = lesson ? (run.roster.find((r) => r.rosterId === lesson.rosterId) ?? null) : null;

  function teach(entry: RosterEntry) {
    const pool = poolOf(entry);
    if (pool.length === 0) return;
    const moveId = pool[Math.floor(seededRandom(seed, entry.rosterId)() * pool.length)];
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
    <div className="node-screen rite-screen is-mentor tutor-node-screen mentor-node-screen" style={{ '--node-rgb': MENTOR_RGB, '--rite-color': `rgb(${MENTOR_RGB})` } as CSSProperties}>
      <span className="node-sky mentor-ground" aria-hidden="true" />
      <NodeMotes count={14} />
      <RosterPeek run={run} />

      {/* The Mentor by the road. Its one line is the node's whole explanation — one of a new
          player's first nodes, with no tip — so it is said plainly rather than as tags. */}
      <header className="keeper-head">
        <span className="keeper-figure">
          <span className="rite-pool" aria-hidden="true" />
          <img src={mentorArt} className="keeper-art" alt="" draggable={false} />
        </span>
        <span className="keeper-words">
          <span className="rite-eyebrow">By the Roadside</span>
          <h2 className="rite-name">The Mentor</h2>
          <KeeperVoice line={voice} />
          {anyTeachable ? (
            <span className="keeper-offer">
              <span className="keeper-line">Teaches any hero a powerful move.</span>
              <span className="keeper-terms">One hero · from its own moves</span>
            </span>
          ) : (
            <span className="keeper-offer">There is nothing left here the Mentor can teach.</span>
          )}
        </span>
      </header>

      {anyTeachable ? (
        <HeroPickGrid count={run.roster.length} fill>
          {run.roster.map((entry) => {
            const hero = rosterHeroes[entry.heroId];
            const pool = poolOf(entry).length;
            const teachable = pool > 0;
            const full = entry.unlockedMoveIds.length >= MOVE_CAP;
            return (
              <HeroPickCard
                key={entry.rosterId}
                hero={hero}
                entry={entry}
                disabled={!teachable || !!lesson}
                onActivate={() => teach(entry)}
                onPreview={() => setPreviewEntry({ hero, entry })}
                ariaLabel={`${hero.name}, level ${levelOf(entry)} — ${teachable ? `${pool} moves to draw from, ${full ? 'kit full' : 'has room'}` : 'nothing left to teach'}`}
                detail={
                  teachable ? (
                    <span className="tutor-fit">
                      {pool} {pool === 1 ? 'move' : 'moves'} · {full ? 'kit full' : 'has room'}
                    </span>
                  ) : undefined
                }
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
          gold={run.gold}
          scale={statScaleFor(run)}
          onClose={() => setPreviewEntry(null)}
        />
      )}
    </div>
  );
}
