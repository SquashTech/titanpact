import { useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition, MoveTier } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import { grantOfferedMove, MOVE_CAP } from '../../run/progression';
import { tutorMovePool } from '../../run/tutor';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { MoveButtonReplica } from '../shared/MoveTile';
import { StageMovePopup } from '../shared/HeroStage';
import { healCasterForEntry } from '../shared/healCaster';
import tutorArt from '../../../art/npc/tutor.png';
import { NodeMotes, NODE_TINT_INSIGHT } from '../shared/NodeStage';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { MoveLearnedOverlay, MoveOfferOverlay } from './MoveOfferOverlay';
import { RosterPeek } from './RosterPeek';
import { KeeperVoice, useKeeperLine } from './RoadEncounter';
import { TUTOR_LINES } from '../../data/roadLines';
import { levelOf } from '../../run/growth';
import { statScaleFor } from '../../run/statScale';
import { PlateButton } from '../shared/PlateButton';
import { getTypeColor } from '../combat/typeColors';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
  /** Kept for the save format; the Tutor rolls nothing now. */
  seed: number;
}

const TIER_LABEL: Record<MoveTier, string> = { late: 'Late', mid: 'Mid', early: 'Early' };

/** The move, chosen. Below the cap it has already landed; at the cap it is the replace question. */
interface Lesson {
  rosterId: string;
  moveId: string;
  learned: boolean;
}

/**
 * `tutorReward` node (act 4, docs/tutor.md): pick a hero, then pick ANY move it can learn and does
 * not hold — Late first, since a kit's last hole that late is usually a Late one. A tap selects, a
 * hold reads, and Teach commits. At the move cap the choice of what goes is asked as everywhere
 * else, and declining there sends the player back to the list rather than spending the Tutor.
 */
export function TutorNodeScreen({ run, onRunChange, onContinue }: Props) {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [inspect, setInspect] = useState<string | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const voice = useKeeperLine(TUTOR_LINES);

  const poolOf = (entry: RosterEntry) => tutorMovePool(progressionTable, moves, entry);
  const anyTeachable = run.roster.some((entry) => poolOf(entry).length > 0);
  const student = studentId ? (run.roster.find((r) => r.rosterId === studentId) ?? null) : null;
  const lessonEntry = lesson ? (run.roster.find((r) => r.rosterId === lesson.rosterId) ?? null) : null;

  function teach() {
    if (!student || !chosen) return;
    playSfx('class.learn');
    const learned = student.unlockedMoveIds.length < MOVE_CAP;
    if (learned) onRunChange(grantOfferedMove(run, student.rosterId, chosen));
    setLesson({ rosterId: student.rosterId, moveId: chosen, learned });
  }

  function resolve(replaceMoveId: string | null, learn: boolean) {
    if (!lesson) return;
    if (!learn) {
      // Not spent: back to the list to choose again.
      setLesson(null);
      return;
    }
    onRunChange(grantOfferedMove(run, lesson.rosterId, lesson.moveId, replaceMoveId ?? undefined));
    onContinue();
  }

  const header = (
    <header className="keeper-head">
      <span className="keeper-figure">
        <span className="rite-pool" aria-hidden="true" />
        <img src={tutorArt} className="keeper-art" alt="" draggable={false} />
      </span>
      <span className="keeper-words">
        <span className="rite-eyebrow">By the Roadside</span>
        <h2 className="rite-name">The Tutor</h2>
        <KeeperVoice line={voice} />
        {anyTeachable ? (
          <span className="keeper-offer">
            <span className="keeper-line">Teaches one hero any move it can learn.</span>
            <span className="keeper-terms">Your pick · Late moves first</span>
          </span>
        ) : (
          <span className="keeper-offer">There is nothing left here the Tutor can teach.</span>
        )}
      </span>
    </header>
  );

  return (
    <div className="node-screen rite-screen is-tutor tutor-node-screen" style={{ '--node-rgb': NODE_TINT_INSIGHT, '--rite-color': `rgb(${NODE_TINT_INSIGHT})` } as CSSProperties}>
      <span className="node-sky tutor-ground" aria-hidden="true" />
      <NodeMotes count={14} />
      <RosterPeek run={run} />

      {header}

      {student ? (
        <TutorMoveList
          entry={student}
          run={run}
          pool={poolOf(student)}
          chosen={chosen}
          onChoose={setChosen}
          onInspect={setInspect}
          onBack={() => {
            setStudentId(null);
            setChosen(null);
          }}
          onTeach={teach}
        />
      ) : anyTeachable ? (
        <HeroPickGrid count={run.roster.length} fill>
          {run.roster.map((entry) => {
            const hero = rosterHeroes[entry.heroId];
            const pool = poolOf(entry);
            const late = pool.filter((id) => moves[id].tier === 'late').length;
            const teachable = pool.length > 0;
            const full = entry.unlockedMoveIds.length >= MOVE_CAP;
            return (
              <HeroPickCard
                key={entry.rosterId}
                hero={hero}
                entry={entry}
                disabled={!teachable}
                onActivate={() => setStudentId(entry.rosterId)}
                onPreview={() => setPreviewEntry({ hero, entry })}
                ariaLabel={`${hero.name}, level ${levelOf(entry)} — ${teachable ? `${pool.length} moves to choose from, ${late} Late` : 'nothing left to teach'}`}
                detail={
                  teachable ? (
                    <span className="tutor-fit">
                      {late} Late · {pool.length} in all · {full ? 'kit full' : 'has room'}
                    </span>
                  ) : undefined
                }
                ctaClassName="is-accent"
                cta={teachable ? 'Choose' : 'Nothing left'}
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

      {inspect && student && (
        <StageMovePopup move={moves[inspect]} caster={healCasterForEntry(rosterHeroes[student.heroId], student, run.relics)} onClose={() => setInspect(null)} />
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
          gold={run.gold}
          scale={statScaleFor(run)}
          onClose={() => setPreviewEntry(null)}
        />
      )}
    </div>
  );
}

interface ListProps {
  entry: RosterEntry;
  run: RunState;
  pool: string[];
  chosen: string | null;
  onChoose: (moveId: string) => void;
  onInspect: (moveId: string) => void;
  onBack: () => void;
  onTeach: () => void;
}

/** One hero's learnable moves, banded Late → Mid → Early, the same tiles Constructed uses. */
function TutorMoveList({ entry, run, pool, chosen, onChoose, onInspect, onBack, onTeach }: ListProps) {
  const hero = rosterHeroes[entry.heroId];
  const caster = healCasterForEntry(hero, entry, run.relics);
  const bands = (['late', 'mid', 'early'] as const)
    .map((tier) => ({ tier, ids: pool.filter((id) => (moves[id].tier ?? 'early') === tier) }))
    .filter((band) => band.ids.length > 0);

  return (
    <section className="tutor-moves">
      <div className="tutor-moves-head">
        <button type="button" className="tutor-moves-back" onClick={onBack}>
          ‹ Heroes
        </button>
        <span className="tutor-moves-who">
          {hero.name} · {entry.unlockedMoveIds.length}/{MOVE_CAP} moves
        </span>
      </div>
      <div className="tutor-moves-scroll">
        {bands.map((band) => (
          <div key={band.tier} className="tutor-band">
            <span className={`tutor-band-label is-${band.tier}`}>{TIER_LABEL[band.tier]}</span>
            <div className="move-list tutor-move-list">
              {band.ids.map((id) => (
                <MoveButtonReplica
                  key={id}
                  move={moves[id]}
                  selected={id === chosen}
                  caster={caster}
                  onClick={() => onChoose(id)}
                  onLongPress={() => onInspect(id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <PlateButton className="tutor-teach" tint={chosen ? getTypeColor(moves[chosen].type) : undefined} disabled={!chosen} onClick={onTeach}>
        {chosen ? `Teach ${moves[chosen].name}` : 'Choose a move'}
      </PlateButton>
    </section>
  );
}
