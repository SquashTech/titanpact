import { type CSSProperties, useState } from 'react';
import { playSfx } from '../../audio/sfx';
import academyArt from '../../../art/map-nodes/landmarks/academy.png';
import { seededRandom } from '../shared/seededRandom';
import { classes } from '../../data/classes';
import { equipment } from '../../data/equipment';
import { rosterHeroes } from '../../data/content';
import { moves } from '../../data/moves';
import { passives } from '../../data/passives';
import { ACADEMY_LINES } from '../../data/roadLines';
import type { HeroDefinition } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import { anyClassAvailable, classMoveOverflows, grantClass, rollClassOffers, type ClassDefinition, type ClassKind } from '../../run/classes';
import { formIdFor } from '../../run/progression';
import { levelOf } from '../../run/growth';
import { statScaleFor } from '../../run/statScale';
import { getTypeColor } from '../combat/typeColors';
import { MoveDetailCard, MoveDetailOverlay } from '../combat/MoveDetailOverlay';
import { CLASS_PATHS } from '../shared/classIcons';
import { ElementGlyph } from '../shared/elementIcons';
import { healCasterForEntry } from '../shared/healCaster';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { HeroPortrait } from '../shared/HeroPortrait';
import { MoveButtonReplica, moveEffectSummary, useLongPress } from '../shared/MoveTile';
import { NodeMotes } from '../shared/NodeStage';
import { PassiveGlyph, PassiveReadout, passiveColor } from '../shared/passiveIcons';
import { PassiveDetailOverlay } from '../shared/PassiveDossier';
import { moveForPrimaryType } from '../../engine/state';
import { STAT_COLORS } from '../shared/StatBars';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { MoveOfferOverlay } from './MoveOfferOverlay';
import { RosterPeek } from './RosterPeek';
import { KeeperVoice, useKeeperLine } from './RoadEncounter';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
  /** Fixes the screen's roll, so a resumed run is offered the same (docs/save-system.md D2). */
  seed: number;
}

/** The Academy's laurel (mapNodes NODE_COLORS academyReward). */
const ACADEMY_RGB = '184, 201, 90';

/** The colour a kind wears — the stat the kind is about, the same palette an Evolution's kind chip uses. */
const KIND_COLORS: Record<ClassKind, string> = {
  offensive: STAT_COLORS.attack,
  defensive: STAT_COLORS.defense,
  utility: STAT_COLORS.speed,
};

/**
 * `academyReward` node (docs/academy.md): the three Classes first, each readable with a hold, and
 * the roster under them showing who can still learn one; then, with a Class chosen, the hero who
 * takes it. A hero's tap commits — the hero enrolled is the hero taught — so the way back lives one
 * step earlier, from the heroes to the Classes, where nothing has been granted yet. A Class is a
 * VERB — a move or a passive — never a stat line, one a hero for the run. Non-bankable.
 */
export function AcademyNodeScreen({ run, onRunChange, onContinue, seed }: Props) {
  /** Rolled once, on mount: three from the whole catalog. */
  const [offers] = useState(() => rollClassOffers(classes, seededRandom(seed)));
  const [pickedClassId, setPickedClassId] = useState<string | null>(null);
  /** The Class carried to the hero step. */
  const [teachingId, setTeachingId] = useState<string | null>(null);
  const [reading, setReading] = useState<ClassDefinition | null>(null);
  /** A move-Class whose move the kit refuses: the replace-or-decline before the grant lands. */
  const [overflow, setOverflow] = useState<{ rosterId: string; classId: string } | null>(null);
  const [learned, setLearned] = useState<{ rosterId: string; classId: string } | null>(null);
  const [previewing, setPreviewing] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const voice = useKeeperLine(ACADEMY_LINES);

  const overflowEntry = overflow ? (run.roster.find((r) => r.rosterId === overflow.rosterId) ?? null) : null;
  const learnedEntry = learned ? (run.roster.find((r) => r.rosterId === learned.rosterId) ?? null) : null;
  const anyEligible = anyClassAvailable(run.roster);
  const picked = pickedClassId ? offers.find((c) => c.id === pickedClassId) ?? null : null;
  const teaching = teachingId ? classes[teachingId] : null;

  function commit(rosterId: string, classId: string, replaceMoveId?: string) {
    playSfx('class.learn');
    onRunChange(grantClass(run, classes, rosterId, classId, replaceMoveId));
    setOverflow(null);
    setLearned({ rosterId, classId });
  }

  function teach(entry: RosterEntry) {
    if (!teaching || entry.classId !== null) return;
    // The kit is full: the class move is the same replace-or-decline an Evolution's grant makes,
    // and declining still takes the Class — the hero just holds the verb it cannot fit.
    if (classMoveOverflows(teaching, entry)) setOverflow({ rosterId: entry.rosterId, classId: teaching.id });
    else commit(entry.rosterId, teaching.id);
  }

  if (overflow && overflowEntry) {
    return (
      <MoveOfferOverlay
        run={run}
        entry={overflowEntry}
        moveId={classes[overflow.classId].grantsMoveId!}
        eyebrow="The Class grants a move — your kit is full"
        onResolve={(replaceMoveId, learn) => commit(overflow.rosterId, overflow.classId, learn ? replaceMoveId ?? undefined : undefined)}
      />
    );
  }

  if (learned && learnedEntry) {
    return <ClassLearnedReveal run={run} entry={learnedEntry} cls={classes[learned.classId]} onContinue={onContinue} />;
  }

  const rite = { '--node-rgb': ACADEMY_RGB, '--rite-color': picked ? classColor(picked) : `rgb(${ACADEMY_RGB})` } as CSSProperties;

  if (teaching) {
    const authored = teaching.grantsMoveId ? moves[teaching.grantsMoveId] : null;
    return (
      <div className="node-screen rite-screen is-academy tutor-node-screen academy-heroes" style={{ ...rite, '--rite-color': classColor(teaching) } as CSSProperties}>
        <span className="node-sky academy-ground" aria-hidden="true" />
        <NodeMotes count={14} />
        <RosterPeek run={run} />

        <div className="tutor-moves-head academy-heroes-head">
          <button type="button" className="tutor-moves-back" onClick={() => setTeachingId(null)}>
            ‹ Classes
          </button>
          <span className="academy-teaching" style={{ color: classColor(teaching) }}>
            <ClassGlyph cls={teaching} />
            {teaching.name}
          </span>
        </div>
        <span className="rite-eyebrow academy-ask">Who learns it?</span>

        <HeroPickGrid count={run.roster.length} fill>
          {run.roster.map((entry) => {
            const hero = rosterHeroes[entry.heroId];
            const open = entry.classId === null;
            const held = entry.classId ? classes[entry.classId] : null;
            // A class move wears its holder's type: shown at the type it would have on this hero.
            const typed = authored ? moveForPrimaryType(authored, hero.types[0]) : null;
            return (
              <HeroPickCard
                key={entry.rosterId}
                hero={hero}
                entry={entry}
                disabled={!open}
                onActivate={() => teach(entry)}
                onPreview={() => setPreviewing({ hero, entry })}
                ariaLabel={`${hero.name}, level ${levelOf(entry)} — ${open ? `learns ${teaching.name}` : `already a ${held?.name}`}`}
                detail={
                  open && typed ? (
                    <span className="tutor-fit" style={{ color: getTypeColor(typed.type) }}>
                      <ElementGlyph type={typed.type} /> {typed.name}
                    </span>
                  ) : undefined
                }
                ctaClassName="is-accent"
                cta={open ? 'Teach' : held ? `Is a ${held.name}` : 'Has a Class'}
              />
            );
          })}
        </HeroPickGrid>

        {previewing && (
          <HeroPreviewOverlay
            hero={previewing.hero}
            entry={previewing.entry}
            equipmentLookup={equipment}
            relicIds={run.relics}
            gold={run.gold}
            scale={statScaleFor(run)}
            onClose={() => setPreviewing(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`node-screen rite-screen is-academy tutor-node-screen academy-landing${picked ? ' has-pick' : ''}`} style={rite}>
      <span className="node-sky academy-ground" aria-hidden="true" />
      <NodeMotes count={14} />
      <RosterPeek run={run} />

      <header className="keeper-head">
        <span className="keeper-figure">
          <span className="rite-pool" aria-hidden="true" />
          <img src={academyArt} className="keeper-art is-icon" alt="" draggable={false} />
        </span>
        <span className="keeper-words">
          <span className="rite-eyebrow">By the Roadside</span>
          <h2 className="rite-name">The Academy</h2>
          <KeeperVoice line={voice} />
          {anyEligible ? (
            <span className="keeper-offer">
              <span className="keeper-line">Schools one hero in a Class.</span>
              <span className="keeper-terms">1 of 3 · one Class a hero</span>
            </span>
          ) : (
            <span className="keeper-offer">Every hero already has a Class. There is nothing left to teach.</span>
          )}
        </span>
      </header>

      {anyEligible ? (
        <>
          <div className="verb-card-list academy-class-list">
            {offers.map((cls) => (
              <ClassCard
                key={cls.id}
                cls={cls}
                picked={pickedClassId === cls.id}
                dimmed={!!picked && pickedClassId !== cls.id}
                onPick={() => {
                  playSfx('ui.pick');
                  setPickedClassId(pickedClassId === cls.id ? null : cls.id);
                }}
                onRead={() => setReading(cls)}
              />
            ))}
          </div>

          {/* Who can still learn one: a lit figure is free, a dimmed one already wears its Class's mark. */}
          <span className="rite-eyebrow academy-students-label">Who can learn</span>
          <div className="academy-students" aria-label="Heroes who can learn a Class">
            {run.roster.map((entry) => {
              const hero = rosterHeroes[entry.heroId];
              const held = entry.classId ? classes[entry.classId] : null;
              return (
                <span key={entry.rosterId} className={`academy-student${held ? ' has-class' : ''}`} title={held ? `${hero.name} · ${held.name}` : hero.name}>
                  <HeroPortrait heroId={hero.id} pathId={formIdFor(entry)} className="academy-student-portrait" />
                  {held && (
                    <span className="academy-student-mark" style={{ color: classColor(held) }} aria-hidden="true">
                      <ClassGlyph cls={held} />
                    </span>
                  )}
                </span>
              );
            })}
          </div>

          <button className="resolve-button" disabled={!picked} onClick={() => picked && setTeachingId(picked.id)}>
            {picked ? `Choose a student — ${picked.name}` : 'Choose a Class'}
          </button>
        </>
      ) : (
        <>
          <div className="node-spacer" />
          <button className="resolve-button" onClick={onContinue}>
            Continue
          </button>
        </>
      )}

      {reading?.grantsMoveId && <MoveDetailOverlay move={moves[reading.grantsMoveId]} onClose={() => setReading(null)} />}
      {reading?.grantsPassiveId && <PassiveDetailOverlay passive={passives[reading.grantsPassiveId]} onClose={() => setReading(null)} />}
    </div>
  );
}

/** The Class mark in its kind's colour — the same glyph the hero sheet draws for a held Class. */
export function ClassGlyph({ cls, className }: { cls: ClassDefinition; className?: string }) {
  if (cls.grantsPassiveId) return <PassiveGlyph passiveId={cls.grantsPassiveId} className={className} />;
  return (
    <svg className={`status-glyph${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      {CLASS_PATHS[cls.id] ?? CLASS_PATHS.champion}
    </svg>
  );
}

export function classColor(cls: ClassDefinition): string {
  return cls.grantsPassiveId ? passiveColor(cls.grantsPassiveId) : KIND_COLORS[cls.kind];
}

interface CardProps {
  cls: ClassDefinition;
  picked: boolean;
  dimmed: boolean;
  onPick: () => void;
  onRead: () => void;
}

/**
 * One Class: its mark and name over the verb drawn as the player already knows it — a move as the
 * fight's own move button, tagged as wearing its holder's type (no hero is chosen yet), a passive as
 * the innate readout. Tap picks; hold reads.
 */
function ClassCard({ cls, picked, dimmed, onPick, onRead }: CardProps) {
  const move = cls.grantsMoveId ? moves[cls.grantsMoveId] : null;
  const passive = cls.grantsPassiveId ? passives[cls.grantsPassiveId] : null;
  const longPress = useLongPress(onRead, onPick);
  const summary = move ? moveEffectSummary(move) : passive?.description ?? '';
  return (
    <div
      className={`verb-card class-card${picked ? ' is-picked' : ''}${dimmed ? ' is-dimmed' : ''}`}
      style={{ '--rite-color': classColor(cls) } as CSSProperties}
      role="button"
      tabIndex={0}
      aria-pressed={picked}
      aria-label={`${cls.name}: ${move ? move.name : passive?.name}. ${summary}`}
      data-sfx="none"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPick();
        }
      }}
      {...longPress}
    >
      <span className="verb-card-head class-card-head">
        <span className="class-card-mark" aria-hidden="true">
          <ClassGlyph cls={cls} />
        </span>
        <span className="verb-card-name">{cls.name}</span>
      </span>
      {/* Read-only: the card takes the press, so the replica is drawn and never pressed. */}
      <span className="class-card-verb">
        {move && <MoveButtonReplica move={move} tag={move.typeFollowsUser ? "Hero's type" : undefined} />}
        {passive && <PassiveReadout passive={passive} />}
      </span>
    </div>
  );
}

interface RevealProps {
  run: RunState;
  entry: RosterEntry;
  cls: ClassDefinition;
  onContinue: () => void;
}

/** What the Academy taught: the hero, the Class, and the verb it now carries. */
function ClassLearnedReveal({ run, entry, cls, onContinue }: RevealProps) {
  const hero = rosterHeroes[entry.heroId];
  const caster = healCasterForEntry(hero, entry, run.relics);
  const move = cls.grantsMoveId ? moves[cls.grantsMoveId] : null;
  const passive = cls.grantsPassiveId ? passives[cls.grantsPassiveId] : null;
  return (
    <div className="node-screen rite-screen is-academy" style={{ '--node-rgb': ACADEMY_RGB, '--rite-color': classColor(cls) } as CSSProperties}>
      <span className="node-sky academy-ground" aria-hidden="true" />
      <NodeMotes count={14} />
      <div className="screen-scroll">
        <div className="rite-reveal">
          <span className="rite-reveal-flash" aria-hidden="true" />
          <span className="rite-hero">
            <span className="rite-pool" aria-hidden="true" />
            <HeroPortrait heroId={hero.id} pathId={formIdFor(entry)} className="rite-portrait" />
            <span className="rite-mark is-reveal" aria-hidden="true">
              <ClassGlyph cls={cls} />
            </span>
          </span>
          <span className="rite-eyebrow">Graduated</span>
          <h2 className="rite-name">{hero.name}</h2>
          <span className="rite-reveal-name">{cls.name}</span>
          <div className={`rite-reveal-verb${move ? ' is-move' : ''}`}>
            {move && <MoveDetailCard move={move} caster={caster} />}
            {passive && <PassiveReadout passive={passive} source="Class" />}
          </div>
        </div>
      </div>
      <button className="resolve-button" onClick={onContinue}>
        Continue
      </button>
    </div>
  );
}
