import { useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition, MoveTier } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import { grantMove, MOVE_CAP, MOVE_TIER_LEVEL } from '../../run/progression';
import { tutorMovePool, tutorTeachableCount } from '../../run/tutor';
import { MoveDetailCard } from '../combat/MoveDetailOverlay';
import { HeroPortrait } from '../shared/HeroPortrait';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { MoveButtonReplica } from '../shared/MoveTile';
import { NodeGlyph } from '../shared/nodeIcons';
import { NodeHeader, NodeSky, NODE_TINT_INSIGHT } from '../shared/NodeStage';
import { healCasterForEntry } from '../shared/healCaster';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterPeek } from './RosterPeek';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

const TIER_ORDER: readonly MoveTier[] = ['early', 'mid', 'late'];
const TIER_LABELS: Record<MoveTier, string> = { early: 'Early', mid: 'Mid', late: 'Late' };

/**
 * `tutorReward` node (docs/run-loop.md "The Tutor"): pick a hero, then pick ANY move off its own
 * level-up pool — no roll, no tier gate, and a move it declined years of level-ups ago is still
 * on the shelf. Two phases plus the replace-or-decline every at-cap grant goes through, and the
 * reveal.
 *
 * `grantMove`, not `grantLevelUpMove`: the Tutor is a faucet, not a level-up offer, so teaching a
 * move must not burn it out of the hero's own pool for the level-ups still to come.
 */
export function TutorNodeScreen({ run, onRunChange, onContinue }: Props) {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [pickedMoveId, setPickedMoveId] = useState<string | null>(null);
  /** At MOVE_CAP the pick opens the swap panel instead of resolving. */
  const [swapping, setSwapping] = useState(false);
  const [selectedReplaceId, setSelectedReplaceId] = useState<string | null>(null);
  const [taught, setTaught] = useState<{ rosterId: string; moveId: string } | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const [popupMoveId, setPopupMoveId] = useState<string | null>(null);

  // Read off `run` rather than held, so the entry is the post-grant one on the reveal.
  const student = studentId ? (run.roster.find((r) => r.rosterId === studentId) ?? null) : null;
  const studentHero = student ? heroes[student.heroId] : null;
  const caster = student && studentHero ? healCasterForEntry(studentHero, student, run.relics) : undefined;

  const teachableOf = (entry: RosterEntry) => tutorTeachableCount(progressionTable, moves, entry);
  const anyTeachable = run.roster.some((entry) => teachableOf(entry) > 0);

  const pool = student ? tutorMovePool(progressionTable, moves, student) : [];
  const byTier = TIER_ORDER.map((tier) => ({
    tier,
    moveIds: pool.filter((id) => (moves[id].tier ?? 'early') === tier),
  })).filter((group) => group.moveIds.length > 0);

  const atCap = !!student && student.unlockedMoveIds.length >= MOVE_CAP;

  function teach(replaceMoveId?: string) {
    if (!student || !pickedMoveId) return;
    playSfx('class.learn');
    onRunChange(grantMove(run, student.rosterId, pickedMoveId, replaceMoveId));
    setTaught({ rosterId: student.rosterId, moveId: pickedMoveId });
    setSwapping(false);
  }

  function leaveStudent() {
    playSfx('ui.back');
    setStudentId(null);
    setPickedMoveId(null);
    setSelectedReplaceId(null);
  }

  const taughtMove = taught ? moves[taught.moveId] : null;

  return (
    <div className="node-screen tutor-node-screen" style={{ '--node-rgb': NODE_TINT_INSIGHT } as CSSProperties}>
      <NodeSky />

      <RosterPeek run={run} />

      {!taught && !swapping && (
        <NodeHeader
          compact
          glyph={student ? undefined : <NodeGlyph type="tutorReward" />}
          eyebrow={student ? 'Choose a Technique' : 'A Master Waits'}
          title={student && studentHero ? studentHero.name : 'The Tutor'}
          readout={
            student && studentHero
              ? `Everything ${studentHero.name} could ever have learned — take any one of it. Greyed techniques are already known; hold one to read it in full.`
              : anyTeachable
                ? 'Choose a hero and they may learn any single move from their own pool, whatever their level. Hold a card to review its sheet.'
                : 'Every hero already knows everything their pool holds — there is nothing here to teach.'
          }
        />
      )}

      {/* Phase 2's grid is a direct child of the screen (not inside `.screen-scroll`) so its figures
          sit at the same height as on the Mentor, the Boon and the stat shrines. */}
      {taught && taughtMove && studentHero ? (
        <div className="screen-scroll">
          <div className="class-learn-reveal">
            <div className="class-learn-flash" aria-hidden="true" />
            <div className="class-learn-portraits">
              <span className="tutor-reveal-badge">
                <NodeGlyph type="tutorReward" className="tutor-reveal-icon" />
              </span>
              <span className="class-learn-arrow" aria-hidden="true">
                →
              </span>
              <HeroPortrait heroId={studentHero.id} className="class-learn-hero" />
            </div>
            <div className="class-learn-eyebrow">Technique Learned</div>
            <h2 className="class-learn-title">{studentHero.name}</h2>
            <div className="tutor-reveal-move">
              <MoveDetailCard move={taughtMove} caster={caster} />
            </div>
          </div>
        </div>
      ) : swapping && student && studentHero && pickedMoveId ? (
        <div className="screen-scroll moveoffer-stage">
          <div className="stage-centered">
            <div className="reward-panel">
              <div className="offer-hero-head">
                <HeroPortrait heroId={studentHero.id} className="offer-hero-portrait" />
                <h3>{studentHero.name}</h3>
              </div>
              <p className="offer-hero-sub">
                Already knows {MOVE_CAP} moves — pick one to replace, or go back.
              </p>
              <div className="offer-move-highlight">
                <MoveDetailCard move={moves[pickedMoveId]} label="Taught by the Tutor" caster={caster} />
              </div>
              <div className="offer-swap-arrow" aria-hidden="true">
                ↓ replaces one of
              </div>
              <div className="move-list offer-replace-list">
                {student.unlockedMoveIds.map((moveId) => (
                  <MoveButtonReplica
                    key={moveId}
                    move={moves[moveId]}
                    selected={selectedReplaceId === moveId}
                    caster={caster}
                    onClick={() => setSelectedReplaceId(moveId)}
                    onLongPress={() => setPopupMoveId(moveId)}
                  />
                ))}
              </div>
              <div className="reward-panel-actions moveoffer-actions">
                <button
                  className="moveoffer-button moveoffer-decline"
                  onClick={() => {
                    setSwapping(false);
                    setSelectedReplaceId(null);
                  }}
                >
                  <span className="moveoffer-icon" aria-hidden="true">
                    ✕
                  </span>
                  <span className="moveoffer-label">Back</span>
                  <span className="moveoffer-sub">Pick a different technique</span>
                </button>
                <button
                  className="moveoffer-button moveoffer-confirm"
                  disabled={!selectedReplaceId}
                  onClick={() => selectedReplaceId && teach(selectedReplaceId)}
                >
                  <span className="moveoffer-icon" aria-hidden="true">
                    ✓
                  </span>
                  <span className="moveoffer-label">Replace</span>
                  <span className="moveoffer-sub">{selectedReplaceId ? moves[selectedReplaceId].name : 'Select a move'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : student ? (
        <div className="screen-scroll tutor-pool">
          {byTier.map(({ tier, moveIds }) => (
            <div key={tier}>
              <div className="tab-subhead">
                {TIER_LABELS[tier]} — Lv {MOVE_TIER_LEVEL[tier]}+
              </div>
              <div className="tab-move-list">
                {moveIds.map((moveId) => {
                  const known = student.unlockedMoveIds.includes(moveId);
                  return (
                    <MoveButtonReplica
                      key={moveId}
                      move={moves[moveId]}
                      caster={caster}
                      selected={pickedMoveId === moveId}
                      unusable={known}
                      tag={known ? <span className="tutor-known-tag">Known</span> : undefined}
                      onClick={known ? undefined : () => setPickedMoveId(pickedMoveId === moveId ? null : moveId)}
                      onLongPress={() => setPopupMoveId(moveId)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <HeroPickGrid count={run.roster.length} fill>
          {run.roster.map((entry) => {
            const hero = heroes[entry.heroId];
            const teachable = teachableOf(entry);
            return (
              <HeroPickCard
                key={entry.rosterId}
                hero={hero}
                entry={entry}
                disabled={teachable === 0}
                onActivate={() => {
                  playSfx('ui.select');
                  setStudentId(entry.rosterId);
                }}
                onPreview={() => setPreviewEntry({ hero, entry })}
                ariaLabel={`${hero.name}, level ${entry.level} — ${teachable} techniques to learn`}
                ctaClassName="is-accent"
                cta={teachable === 0 ? 'Nothing left' : 'Study'}
                detail={<span className="tutor-count">{teachable === 0 ? 'pool exhausted' : `${teachable} untaken`}</span>}
              />
            );
          })}
        </HeroPickGrid>
      )}

      {taught ? (
        <button className="resolve-button" onClick={onContinue}>
          Continue
        </button>
      ) : swapping ? null : student ? (
        <div className="reward-panel-actions tutor-actions">
          <button className="secondary-button" onClick={leaveStudent}>
            Choose another hero
          </button>
          <button
            className="resolve-button"
            disabled={!pickedMoveId}
            onClick={() => {
              if (!pickedMoveId) return;
              if (atCap) {
                setSwapping(true);
                setSelectedReplaceId(null);
              } else {
                teach();
              }
            }}
          >
            {pickedMoveId ? (atCap ? `Replace for ${moves[pickedMoveId].name}` : `Learn ${moves[pickedMoveId].name}`) : 'Select a technique'}
          </button>
        </div>
      ) : (
        <button className="resolve-button" disabled={anyTeachable} onClick={onContinue}>
          {anyTeachable ? 'Choose a hero' : 'Move on'}
        </button>
      )}

      {popupMoveId && moves[popupMoveId] && (
        <div className="log-overlay" onClick={() => setPopupMoveId(null)}>
          <div className="log-panel move-popup-panel">
            <MoveDetailCard move={moves[popupMoveId]} caster={caster} />
            <div className="move-popup-hint">Tap anywhere to close</div>
          </div>
        </div>
      )}

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
