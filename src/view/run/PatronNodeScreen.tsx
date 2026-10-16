import { type CSSProperties, useEffect, useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import { moves } from '../../data/moves';
import { passives } from '../../data/passives';
import { patrons } from '../../data/patrons';
import type { HeroDefinition } from '../../engine/content';
import { moveForPrimaryType } from '../../engine/state';
import { grantEventPassive } from '../../run/events';
import { levelOf } from '../../run/growth';
import { MOVE_CAP, formIdFor, grantMove } from '../../run/progression';
import {
  CAPSTONE_TRUST,
  fittedRarity,
  forgeUnique,
  heldFamilyIndex,
  liftHeldItem,
  patronItemId,
  setStudent,
  studentOf,
  type PatronStep,
} from '../../run/patrons';
import type { RosterEntry, RunState } from '../../run/state';
import { statScaleFor } from '../../run/statScale';
import { MoveDetailCard } from '../combat/MoveDetailOverlay';
import { healCasterForEntry } from '../shared/healCaster';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { HeroPortrait } from '../shared/HeroPortrait';
import { NodeMotes } from '../shared/NodeStage';
import { PassiveReadout } from '../shared/passiveIcons';
import { PlateButton } from '../shared/PlateButton';
import { AcademyNodeScreen } from './AcademyNodeScreen';
import { ForgeNodeScreen } from './ForgeNodeScreen';
import { rollFittingGear } from '../../data/equipment';
import { RARITY_ORDER, type EquipmentRarity } from '../../run/equipment';
import { rosterEntryTypes } from '../../run/progression';
import { seededRandom } from '../shared/seededRandom';
import { EquipChoiceCard } from './EquipChoiceCard';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { ItemWhoScreen } from './ItemWhoScreen';
import { MoveOfferOverlay } from './MoveOfferOverlay';
import { KeeperVoice } from './RoadEncounter';
import { RosterPeek } from './RosterPeek';
import { PatronFigure, TrustPips, patronColor, stepFact } from './patronView';

interface Props {
  run: RunState;
  patronId: string;
  /** The rung this meeting pays, 1-5: the Trust the meeting raised the patron to. */
  rung: number;
  /** The steps of the rung already paid, so a resumed screen picks up where it stood. */
  stepsDone: number;
  seed: number;
  /** A step landed: the run it left, and how many of the rung's steps are now paid. */
  onStep: (next: RunState, stepsDone: number) => void;
  onContinue: () => void;
}

/**
 * A patron seat or the capstone (docs/patrons.md): the patron greets, says what this meeting pays,
 * and then pays it one step at a time — an item through the who-screen (its taker becomes the
 * student), a lift or a Unique in place on the student, a move or passive taught to the student,
 * a Class through the Academy's own screen.
 */
export function PatronNodeScreen({ run, patronId, rung, stepsDone, seed, onStep, onContinue }: Props) {
  const patron = patrons[patronId];
  const [greeted, setGreeted] = useState(stepsDone > 0);
  const voice = patron.lines[rung - 1];
  const steps = patron.rungs[rung - 1];
  const color = patronColor(patronId);
  const style = { '--node-rgb': '216, 180, 106', '--rite-color': color } as CSSProperties;

  const keeper = (
    <header className="keeper-head patron-head">
      <span className="keeper-figure">
        <span className="rite-pool" aria-hidden="true" />
        <span className="patron-figure" style={{ color }}>
          <PatronFigure patronId={patronId} />
        </span>
      </span>
      <span className="keeper-words">
        <span className="rite-eyebrow">{rung === CAPSTONE_TRUST ? `${patron.title}, before the Last Seal` : patron.title}</span>
        <h2 className="rite-name patron-name">{patron.name}</h2>
        <KeeperVoice line={voice} />
        <TrustPips trust={rung} className="patron-head-trust" />
      </span>
    </header>
  );

  if (!greeted) {
    return (
      <div className="node-screen rite-screen patron-screen" style={style}>
        <span className="node-sky" aria-hidden="true" />
        <NodeMotes count={12} />
        <RosterPeek run={run} />
        {keeper}
        <div className="patron-rung">
          {steps.map((step, i) => {
            const fact = stepFact(step, run.actNumber);
            return (
              <div key={i} className="patron-rung-step">
                <strong>{fact.value}</strong>
                <span>{fact.label}</span>
              </div>
            );
          })}
        </div>
        <div className="node-spacer" />
        <PlateButton tint={color} onClick={() => setGreeted(true)}>
          Accept
        </PlateButton>
      </div>
    );
  }

  if (stepsDone >= steps.length) {
    return (
      <div className="node-screen rite-screen patron-screen" style={style}>
        <span className="node-sky" aria-hidden="true" />
        <NodeMotes count={12} />
        {keeper}
        <div className="node-spacer" />
        <button className="resolve-button" onClick={onContinue}>
          Continue
        </button>
      </div>
    );
  }

  return (
    <PatronStepView
      key={stepsDone}
      run={run}
      patronId={patronId}
      step={steps[stepsDone]}
      seed={seed + stepsDone}
      keeper={keeper}
      style={style}
      onDone={(next) => onStep(next, stepsDone + 1)}
    />
  );
}

interface StepProps {
  run: RunState;
  patronId: string;
  step: PatronStep;
  seed: number;
  keeper: React.ReactNode;
  style: CSSProperties;
  onDone: (next: RunState) => void;
}

/** One step of a rung. The run handed to `onDone` is the step's whole result. */
function PatronStepView({ run, patronId, step, seed, keeper, style, onDone }: StepProps) {
  const patron = patrons[patronId];
  const student = patron.hasStudent ? studentOf(run, patronId) : null;
  const [landed, setLanded] = useState<RunState | null>(null);
  const [reveal, setReveal] = useState<{ rosterId: string; what: 'item' | 'move' | 'passive'; id: string } | null>(null);
  const [overflow, setOverflow] = useState<string | null>(null);
  const [fitted, setFitted] = useState<{ rosterId: string; itemId: string } | null>(null);
  const [chosenUnique, setChosenUnique] = useState<string | null>(null);
  const markStudent = (r: RunState, rosterId: string) => (patron.hasStudent && !studentOf(r, patronId) ? setStudent(r, patronId, rosterId) : r);
  // A move or passive for a student who already has one asks nothing: it is taught on arrival.
  const autoTeach = !!student && (step.kind === 'move' || step.kind === 'passive');
  useEffect(() => {
    if (autoTeach) start(student!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (reveal && landed) {
    const entry = landed.roster.find((r) => r.rosterId === reveal.rosterId)!;
    return <StepReveal run={landed} entry={entry} what={reveal.what} id={reveal.id} style={style} onContinue={() => onDone(landed)} />;
  }

  // An item, or a lift or a Unique on a student who holds no piece of the family: the who-screen.
  const itemFor = (): string | null => {
    if (step.kind === 'item') return patronItemId(step.familyId, run.actNumber);
    if (step.kind === 'liftItem' && (!student || heldFamilyIndex(run, student, step.familyId) < 0)) return patronItemId(step.familyId, run.actNumber);
    if (step.kind === 'unique' && (!student || heldFamilyIndex(run, student, step.familyId) < 0)) return step.uniqueId;
    return null;
  };
  const whoItem = itemFor();
  if (whoItem) {
    return (
      <ItemWhoScreen
        run={landed ?? run}
        itemId={whoItem}
        title={patron.title}
        onlyRosterIds={student ? [student] : undefined}
        afterTake={markStudent}
        onRunChange={setLanded}
        onDone={() => onDone(landed ?? run)}
      />
    );
  }

  if (step.kind === 'liftItem' || step.kind === 'unique') {
    const before = run.roster.find((r) => r.rosterId === student)!.equipment[heldFamilyIndex(run, student!, step.familyId)];
    const next = step.kind === 'liftItem' ? liftHeldItem(run, student!, step.familyId, equipment) : forgeUnique(run, student!, step.familyId, step.uniqueId);
    const after = next.roster.find((r) => r.rosterId === student)!.equipment[heldFamilyIndex(next, student!, step.familyId)];
    return (
      <div className="node-screen rite-screen patron-screen" style={style}>
        <span className="node-sky" aria-hidden="true" />
        <NodeMotes count={12} />
        {keeper}
        <div className="patron-forge">
          <EquipChoiceCard item={equipment[after]} revealDelayMs={0} labelled showcase onInspect={() => {}} />
          {before === after && <span className="patron-forge-note">Already as fine as this act allows.</span>}
        </div>
        <div className="node-spacer" />
        <button
          className="resolve-button"
          onClick={() => {
            playSfx('discovery');
            onDone(next);
          }}
        >
          Continue
        </button>
      </div>
    );
  }

  if (step.kind === 'forge') {
    return <ForgeNodeScreen run={landed ?? run} onRunChange={setLanded} onContinue={() => onDone(landed ?? run)} />;
  }

  // A fitted piece: the hero first, then the piece rolled for them, through the who-screen.
  if (step.kind === 'fittedItem') {
    if (fitted) {
      return (
        <ItemWhoScreen
          run={landed ?? run}
          itemId={fitted.itemId}
          title={patron.title}
          onlyRosterIds={[fitted.rosterId]}
          onRunChange={setLanded}
          onDone={() => onDone(landed ?? run)}
        />
      );
    }
    return (
      <WhoLearns
        run={run}
        step={step}
        only={null}
        style={style}
        keeper={keeper}
        onPick={(rosterId) => {
          const entry = run.roster.find((r) => r.rosterId === rosterId)!;
          const hero = rosterHeroes[entry.heroId];
          const rarity = fittedRarity(run.actNumber, step.tiersAhead);
          const weights = Object.fromEntries(RARITY_ORDER.map((r) => [r, r === rarity ? 1 : 0])) as Record<EquipmentRarity, number>;
          const item = rollFittingGear(hero.baseStats, rosterEntryTypes(hero, entry), weights, seededRandom(seed));
          if (item) setFitted({ rosterId, itemId: item.id });
          else onDone(run);
        }}
      />
    );
  }

  // One of the patron's Uniques, then the who-screen for anyone.
  if (step.kind === 'uniqueChoice') {
    if (chosenUnique) {
      return <ItemWhoScreen run={landed ?? run} itemId={chosenUnique} title={patron.title} onRunChange={setLanded} onDone={() => onDone(landed ?? run)} />;
    }
    return (
      <div className="node-screen rite-screen patron-screen" style={style}>
        <span className="node-sky" aria-hidden="true" />
        <NodeMotes count={12} />
        <RosterPeek run={run} />
        {keeper}
        <div className="patron-uniques">
          {step.uniqueIds.map((id) => (
            <button
              key={id}
              type="button"
              className="patron-unique"
              onClick={() => {
                playSfx('ui.pick');
                setChosenUnique(id);
              }}
            >
              <EquipChoiceCard item={equipment[id]} revealDelayMs={0} labelled onInspect={() => {}} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step.kind === 'class' || step.kind === 'masterClass') {
    return (
      <AcademyNodeScreen
        run={landed ?? run}
        seed={seed}
        offerCount={step.kind === 'class' ? step.count : undefined}
        masterClassIds={step.kind === 'masterClass' ? step.classIds : undefined}
        keeper={keeper}
        onRunChange={setLanded}
        onContinue={() => onDone(landed ?? run)}
      />
    );
  }

  // A move or a passive, to the student — or to whoever is picked, who becomes the student.
  const teach = (rosterId: string, replaceMoveId?: string, learn = true) => {
    let next = markStudent(run, rosterId);
    if (step.kind === 'move') {
      setOverflow(null);
      // Declined at a full kit, or already known: the student is still the student, and nothing is revealed.
      if (!learn) return onDone(next);
      next = grantMove(next, rosterId, step.moveId, replaceMoveId);
      setLanded(next);
      setReveal({ rosterId, what: 'move', id: step.moveId });
    } else if (step.kind === 'passive') {
      next = grantEventPassive(next, rosterId, step.passiveId, passives);
      setLanded(next);
      setReveal({ rosterId, what: 'passive', id: step.passiveId });
    }
    playSfx('class.learn');
  };
  const start = (rosterId: string) => {
    const entry = run.roster.find((r) => r.rosterId === rosterId)!;
    if (step.kind === 'move' && entry.unlockedMoveIds.includes(step.moveId)) return teach(rosterId, undefined, false);
    if (step.kind === 'move' && entry.unlockedMoveIds.length >= MOVE_CAP) return setOverflow(rosterId);
    teach(rosterId);
  };

  if (overflow && step.kind === 'move') {
    const entry = run.roster.find((r) => r.rosterId === overflow)!;
    return (
      <MoveOfferOverlay
        run={run}
        entry={entry}
        moveId={step.moveId}
        eyebrow={`${patron.title} teaches a move — your kit is full`}
        onResolve={(replaceMoveId, learn) => teach(overflow, learn ? (replaceMoveId ?? undefined) : undefined, learn && !!replaceMoveId)}
      />
    );
  }

  if (autoTeach) return null;
  return <WhoLearns run={run} step={step} only={null} style={style} keeper={keeper} onPick={start} />;
}

function WhoLearns({
  run,
  step,
  only,
  style,
  keeper,
  onPick,
}: {
  run: RunState;
  step: PatronStep;
  only: string | null;
  style: CSSProperties;
  keeper: React.ReactNode;
  onPick: (rosterId: string) => void;
}) {
  const [previewing, setPreviewing] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const move = step.kind === 'move' ? moves[step.moveId] : null;
  return (
    <div className="node-screen rite-screen patron-screen" style={style}>
      <span className="node-sky" aria-hidden="true" />
      <NodeMotes count={12} />
      <RosterPeek run={run} />
      {keeper}
      <HeroPickGrid count={run.roster.length} fill>
        {run.roster.map((entry) => {
          const hero = rosterHeroes[entry.heroId];
          const open = !only || only === entry.rosterId;
          const typed = move ? moveForPrimaryType(move, hero.types[0]) : null;
          return (
            <HeroPickCard
              key={entry.rosterId}
              hero={hero}
              entry={entry}
              disabled={!open}
              onActivate={() => open && onPick(entry.rosterId)}
              onPreview={() => setPreviewing({ hero, entry })}
              ariaLabel={`${hero.name}, level ${levelOf(entry)}`}
              detail={typed ? <span className="tutor-fit">{typed.name}</span> : undefined}
              ctaClassName="is-accent"
              cta={open ? (step.kind === 'fittedItem' ? 'Fit' : 'Teach') : 'Not the student'}
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

function StepReveal({
  run,
  entry,
  what,
  id,
  style,
  onContinue,
}: {
  run: RunState;
  entry: RosterEntry;
  what: 'item' | 'move' | 'passive';
  id: string;
  style: CSSProperties;
  onContinue: () => void;
}) {
  const hero = rosterHeroes[entry.heroId];
  const caster = healCasterForEntry(hero, entry, run.relics);
  const move = what === 'move' ? moveForPrimaryType(moves[id], hero.types[0]) : null;
  return (
    <div className="node-screen rite-screen patron-screen" style={style}>
      <span className="node-sky" aria-hidden="true" />
      <NodeMotes count={12} />
      <div className="screen-scroll">
        <div className="rite-reveal">
          <span className="rite-reveal-flash" aria-hidden="true" />
          <span className="rite-hero">
            <span className="rite-pool" aria-hidden="true" />
            <HeroPortrait heroId={hero.id} pathId={formIdFor(entry)} className="rite-portrait" />
          </span>
          <h2 className="rite-name">{hero.name}</h2>
          <div className={`rite-reveal-verb${move ? ' is-move' : ''}`}>
            {move && <MoveDetailCard move={move} caster={caster} />}
            {what === 'passive' && <PassiveReadout passive={passives[id]} source="Patron" />}
          </div>
        </div>
      </div>
      <button className="resolve-button" onClick={onContinue}>
        Continue
      </button>
    </div>
  );
}

/** Two patrons at Trust 4 as the last Guardian's gate opens: the one who comes is the one decision. */
export function PatronCapstoneScreen({ run, candidates, onChoose }: { run: RunState; candidates: readonly string[]; onChoose: (patronId: string) => void }) {
  return (
    <div className="node-screen rite-screen patron-screen" style={{ '--node-rgb': '216, 180, 106' } as CSSProperties}>
      <span className="node-sky" aria-hidden="true" />
      <NodeMotes count={12} />
      <RosterPeek run={run} />
      <span className="rite-eyebrow">Before the Last Seal</span>
      <h2 className="rite-name">Who comes?</h2>
      <div className="patron-capstone-list">
        {candidates.map((id) => {
          const patron = patrons[id];
          const fact = stepFact(patron.rungs[CAPSTONE_TRUST - 1][0], run.actNumber);
          return (
            <button
              key={id}
              type="button"
              className="patron-capstone-card"
              style={{ '--rite-color': patronColor(id) } as CSSProperties}
              onClick={() => {
                playSfx('ui.confirm');
                onChoose(id);
              }}
            >
              <span className="patron-figure" style={{ color: patronColor(id) }}>
                <PatronFigure patronId={id} />
              </span>
              <span className="patron-capstone-title">
                <strong className="patron-capstone-name">{patron.name}</strong> {patron.title}
              </span>
              <strong>{fact.value}</strong>
              <span>{fact.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
