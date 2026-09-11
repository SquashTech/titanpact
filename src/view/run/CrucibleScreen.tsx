import { type CSSProperties, useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { classes } from '../../data/classes';
import { equipment } from '../../data/equipment';
import { heroes } from '../../data/heroes';
import { moves } from '../../data/moves';
import { passives } from '../../data/passives';
import type { HeroDefinition } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import { anyClassAvailable, classMoveOverflows, grantClass, rollClassOffers, type ClassDefinition, type ClassKind } from '../../run/classes';
import { rosterEntryTypes } from '../../run/progression';
import { getTypeAbbr, getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { MoveDetailCard, MoveDetailOverlay } from '../combat/MoveDetailOverlay';
import { CLASS_PATHS } from '../shared/classIcons';
import { ElementGlyph } from '../shared/elementIcons';
import { healCasterForEntry } from '../shared/healCaster';
import { HeroPortrait } from '../shared/HeroPortrait';
import { MoveButtonReplica, useLongPress } from '../shared/MoveTile';
import { NodeHeader, NodeSky, NODE_TINT_GOLD } from '../shared/NodeStage';
import { PassiveGlyph, passiveColor } from '../shared/passiveIcons';
import { STAT_COLORS } from '../shared/StatBars';
import { CrucibleChain, CrucibleVessel } from './crucibleArt';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { MoveOfferOverlay } from './MoveOfferOverlay';
import { RosterPeek } from './RosterPeek';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

/** The colour a kind wears — the stat the kind is about, the same palette an Evolution's kind chip uses. */
const KIND_COLORS: Record<ClassKind, string> = {
  offensive: STAT_COLORS.attack,
  defensive: STAT_COLORS.defense,
  utility: STAT_COLORS.speed,
};

const KIND_LABELS: Record<ClassKind, string> = { offensive: 'Offensive', defensive: 'Defensive', utility: 'Utility' };

/**
 * The Crucible — the Guardian's beat (docs/growth-overhaul.md §5, §11): pick ONE hero, and the fire
 * tempers it into a Class. Chain: Guardian falls → Banner → Crucible → Pact Seal → act intro. Team,
 * hero, run — three scales ascending.
 *
 * It used to grant the Evolution. That moved onto the Scroll ladder (the 6th Scroll into a hero)
 * so the player builds toward it, and the beat and its stage stayed for the Class: the same shape
 * (one hero, then one of three differing in kind) and the same fiction (a Guardian's death is where
 * a hero changes). A Class is a VERB — a move, or a passive — never a stat line.
 *
 * **Non-bankable.** A turning point is decided now, which is why it is a beat rather than an item.
 */
export function CrucibleScreen({ run, onRunChange, onContinue }: Props) {
  /** Standing at the rim — chosen, not yet committed. */
  const [armedRosterId, setArmedRosterId] = useState<string | null>(null);
  const [chosenRosterId, setChosenRosterId] = useState<string | null>(null);
  /** Rolled once, on mount: one Class a kind. */
  const [offers] = useState(() => rollClassOffers(classes, Math.random));
  const [pickedClassId, setPickedClassId] = useState<string | null>(null);
  /** A move-Class whose move the kit refuses: the replace-or-decline before the grant lands. */
  const [overflow, setOverflow] = useState<{ rosterId: string; classId: string } | null>(null);
  const [learned, setLearned] = useState<{ rosterId: string; classId: string } | null>(null);
  const [previewing, setPreviewing] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  const chosen = chosenRosterId ? (run.roster.find((r) => r.rosterId === chosenRosterId) ?? null) : null;
  const overflowEntry = overflow ? (run.roster.find((r) => r.rosterId === overflow.rosterId) ?? null) : null;
  const learnedEntry = learned ? (run.roster.find((r) => r.rosterId === learned.rosterId) ?? null) : null;
  const eligible = run.roster.filter((entry) => entry.classId === null);

  function commit(rosterId: string, classId: string, replaceMoveId?: string) {
    playSfx('class.learn');
    onRunChange(grantClass(run, classes, rosterId, classId, replaceMoveId));
    setOverflow(null);
    setChosenRosterId(null);
    setArmedRosterId(null);
    setLearned({ rosterId, classId });
  }

  function confirm() {
    if (!chosen || !pickedClassId) return;
    const cls = classes[pickedClassId];
    // The kit is full: the class move is the same replace-or-decline an Evolution's grant makes,
    // and declining still takes the Class — the hero just holds the verb it cannot fit.
    if (classMoveOverflows(cls, chosen)) setOverflow({ rosterId: chosen.rosterId, classId: cls.id });
    else commit(chosen.rosterId, cls.id);
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
    return (
      <ClassLearnedReveal run={run} entry={learnedEntry} cls={classes[learned.classId]} onContinue={onContinue} />
    );
  }

  if (chosen) {
    return (
      <ClassChoice
        run={run}
        entry={chosen}
        offers={offers}
        pickedClassId={pickedClassId}
        onPick={(id) => setPickedClassId(pickedClassId === id ? null : id)}
        onConfirm={confirm}
        onBack={() => {
          playSfx('ui.back');
          setChosenRosterId(null);
        }}
      />
    );
  }

  const armedEntry = armedRosterId ? (run.roster.find((r) => r.rosterId === armedRosterId) ?? null) : null;
  const cold = !anyClassAvailable(run.roster);
  // Two ranks around the bowl, the nearer three closest to the fire. Depth is carried by light,
  // never by size: a 48px source scales cleanly to 96 and to nothing in between.
  const frontCount = Math.min(3, run.roster.length);
  const back = run.roster.slice(0, run.roster.length - frontCount);
  const front = run.roster.slice(run.roster.length - frontCount);

  function arm(rosterId: string) {
    playSfx('ui.select');
    setArmedRosterId(rosterId);
  }

  function enter() {
    if (!armedEntry) return;
    playSfx('ui.confirm');
    setChosenRosterId(armedEntry.rosterId);
  }

  const readout = cold
    ? 'Every hero already carries a Class.'
    : armedEntry
      ? `${heroes[armedEntry.heroId].name} stands at the rim. The Class they take is theirs for the run.`
      : 'Choose the hero to be tempered — hold one to read its sheet first.';

  return (
    <div
      className={`node-screen crucible-screen${armedEntry ? ' is-armed' : ''}${cold ? ' is-cold' : ''}`}
      style={{ '--node-rgb': NODE_TINT_GOLD } as CSSProperties}
    >
      <NodeSky />
      <RosterPeek run={run} />
      <NodeHeader
        eyebrow="The Crucible"
        title={cold ? 'The fire is cold' : 'One of you is tempered'}
        readout={readout}
        readoutKey={armedRosterId ?? String(cold)}
        readoutLive={!!armedEntry}
      />

      {/* The scene: a bowl of molten gold, the light it throws upward, the embers it sheds, and the
          roster standing around it in two ranks. No boxes — a figure is lit by the fire and grows a
          frame only once it is the one chosen, the battlefield's own targetability idiom. */}
      <div className="crucible-stage">
        <span className="crucible-heat" aria-hidden="true" />
        <CrucibleChain side="left" />
        <CrucibleChain side="right" />
        {SMOKE.map((sm, i) => (
          <span
            key={i}
            className="crucible-smoke"
            aria-hidden="true"
            style={{ '--smoke-dur': `${sm.duration}s`, '--smoke-delay': `${sm.delay}s`, '--smoke-drift': `${sm.drift}px` } as CSSProperties}
          />
        ))}
        <div className="crucible-embers" aria-hidden="true">
          {EMBERS.map((e, i) => (
            <span
              key={i}
              className="crucible-ember"
              style={
                {
                  '--ember-x': `${e.x}%`,
                  '--ember-delay': `${e.delay}s`,
                  '--ember-dur': `${e.duration}s`,
                  '--ember-drift': `${e.drift}px`,
                  '--ember-size': `${e.size}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>

        <div className="crucible-ranks">
          {[back, front].map((rank, r) => (
            <div key={r} className={`crucible-rank ${r === 0 ? 'is-back' : 'is-front'}`}>
              {rank.map((entry) => (
                <CrucibleFigure
                  key={entry.rosterId}
                  entry={entry}
                  pending={entry.classId === null}
                  armed={entry.rosterId === armedRosterId}
                  dimmed={!!armedEntry && entry.rosterId !== armedRosterId}
                  onArm={() => arm(entry.rosterId)}
                  onPreview={() => setPreviewing({ hero: heroes[entry.heroId], entry })}
                />
              ))}
            </div>
          ))}
        </div>

        <CrucibleVessel />
      </div>

      {/* An unspent Crucible is never walked past — it does not bank, so leaving is the same as
          burning it. The button commits only once a hero stands at the rim; cold, it is the exit. */}
      {cold ? (
        <button className="resolve-button" onClick={onContinue}>
          Continue
        </button>
      ) : (
        <button className="resolve-button crucible-enter" disabled={!armedEntry} onClick={enter}>
          {armedEntry ? `Enter the Crucible — ${heroes[armedEntry.heroId].name}` : 'Choose a hero'}
        </button>
      )}

      {previewing && (
        <HeroPreviewOverlay
          hero={previewing.hero}
          entry={previewing.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          onClose={() => setPreviewing(null)}
        />
      )}
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

interface ChoiceProps {
  run: RunState;
  entry: RosterEntry;
  offers: ClassDefinition[];
  pickedClassId: string | null;
  onPick: (classId: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}

/**
 * Three Classes differing in kind, read as an Evolution branch — pick, then confirm. A move-Class
 * shows its move's full card and a passive-Class its passive's line, because the verb is the whole
 * of what is being chosen.
 */
function ClassChoice({ run, entry, offers, pickedClassId, onPick, onConfirm, onBack }: ChoiceProps) {
  const hero = heroes[entry.heroId];
  const caster = healCasterForEntry(hero, entry, run.relics);
  const picked = pickedClassId ? offers.find((c) => c.id === pickedClassId) ?? null : null;
  const [inspectingMoveId, setInspectingMoveId] = useState<string | null>(null);
  return (
    <div className="node-screen crucible-screen crucible-choice" style={{ '--node-rgb': NODE_TINT_GOLD } as CSSProperties}>
      <NodeSky />
      <RosterPeek run={run} />
      <NodeHeader
        compact
        art={<HeroPortrait heroId={hero.id} className="crucible-choice-portrait" />}
        eyebrow="Choose a Class"
        title={hero.name}
        readout={picked ? picked.description : 'One of three, each a different kind. Hold a move to read it in full.'}
        readoutKey={pickedClassId ?? 'none'}
      />
      <div className="screen-scroll">
        <div className="stage-centered">
          <div className="class-shrine-list">
            {offers.map((cls) => (
              <ClassCard
                key={cls.id}
                cls={cls}
                picked={pickedClassId === cls.id}
                caster={caster}
                onPick={() => onPick(cls.id)}
                onInspect={() => cls.grantsMoveId && setInspectingMoveId(cls.grantsMoveId)}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="reward-panel-actions crucible-choice-actions">
        <button className="secondary-button" onClick={onBack}>
          Back
        </button>
        <button className="resolve-button" disabled={!picked} onClick={onConfirm}>
          {picked ? `Temper — ` : 'Select a Class'}
        </button>
      </div>
      {inspectingMoveId && moves[inspectingMoveId] && (
        <MoveDetailOverlay move={moves[inspectingMoveId]} caster={caster} onClose={() => setInspectingMoveId(null)} />
      )}
    </div>
  );
}

interface CardProps {
  cls: ClassDefinition;
  picked: boolean;
  caster: ReturnType<typeof healCasterForEntry>;
  onPick: () => void;
  /** Hold a move-Class to read its move in full. */
  onInspect: () => void;
}

/**
 * One Class: the mark and name with the kind beside them, and the verb underneath — a move as the
 * same row the Tutor lists moves in (tap picks, hold reads the dossier), a passive as its line.
 * A div rather than a button because the move row is one already.
 */
function ClassCard({ cls, picked, caster, onPick, onInspect }: CardProps) {
  const move = cls.grantsMoveId ? moves[cls.grantsMoveId] : null;
  const passive = cls.grantsPassiveId ? passives[cls.grantsPassiveId] : null;
  const color = classColor(cls);
  const press = useLongPress(move ? onInspect : undefined, onPick);
  return (
    <div
      className={`relic-card class-shrine-card crucible-class-card${picked ? ' picked' : ''}`}
      style={{ '--kind-color': color } as CSSProperties}
      role="button"
      tabIndex={0}
      aria-pressed={picked}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPick();
        }
      }}
      {...press}
    >
      <div className="relic-card-head">
        <span className="relic-card-icon class-shrine-card-icon" style={{ color }} aria-hidden="true">
          <ClassGlyph cls={cls} className="class-shrine-card-glyph" />
        </span>
        <span className="relic-card-name">{cls.name}</span>
        <span className="crucible-class-kind" style={{ color }}>
          {KIND_LABELS[cls.kind]}
        </span>
      </div>
      <div className="crucible-class-verb">
        {move && <MoveButtonReplica move={move} caster={caster} selected={picked} onClick={onPick} onLongPress={onInspect} />}
        {passive && (
          <div className="crucible-class-passive">
            <span className="crucible-class-passive-name" style={{ color }}>
              {passive.name}
            </span>
            <span className="crucible-class-passive-desc">{passive.description}</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface RevealProps {
  run: RunState;
  entry: RosterEntry;
  cls: ClassDefinition;
  onContinue: () => void;
}

/** What the fire made: the hero, the Class, and the verb it now carries. */
function ClassLearnedReveal({ run, entry, cls, onContinue }: RevealProps) {
  const hero = heroes[entry.heroId];
  const caster = healCasterForEntry(hero, entry, run.relics);
  const move = cls.grantsMoveId ? moves[cls.grantsMoveId] : null;
  const passive = cls.grantsPassiveId ? passives[cls.grantsPassiveId] : null;
  const color = classColor(cls);
  return (
    <div className="node-screen crucible-screen" style={{ '--node-rgb': NODE_TINT_GOLD } as CSSProperties}>
      <NodeSky />
      <div className="screen-scroll">
        <div className="class-learn-reveal">
          <div className="class-learn-flash" aria-hidden="true" />
          <div className="class-learn-portraits">
            <span className="tutor-reveal-badge" style={{ color }}>
              <ClassGlyph cls={cls} className="tutor-reveal-icon" />
            </span>
            <span className="class-learn-arrow" aria-hidden="true">
              →
            </span>
            <HeroPortrait heroId={hero.id} className="class-learn-hero" />
          </div>
          <div className="class-learn-eyebrow">Tempered</div>
          <h2 className="class-learn-title">{hero.name}</h2>
          <div className="class-learn-classname" style={{ color }}>
            {cls.name}
          </div>
          {move && (
            <div className="tutor-reveal-move">
              <MoveDetailCard move={move} caster={caster} />
            </div>
          )}
          {passive && (
            <div className="crucible-class-passive is-reveal">
              <span className="crucible-class-passive-name" style={{ color }}>
                {passive.name}
              </span>
              <span className="crucible-class-passive-desc">{passive.description}</span>
            </div>
          )}
        </div>
      </div>
      <button className="resolve-button" onClick={onContinue}>
        Continue
      </button>
    </div>
  );
}

interface FigureProps {
  entry: RosterEntry;
  /** Holds no Class yet. A tempered hero stands ashen and cannot be armed. */
  pending: boolean;
  armed: boolean;
  dimmed: boolean;
  onArm: () => void;
  onPreview: () => void;
}

/** One hero at the rim: figure on fire-lit ground, name, types. Tap arms; hold opens the sheet. */
function CrucibleFigure({ entry, pending, armed, dimmed, onArm, onPreview }: FigureProps) {
  const hero = heroes[entry.heroId];
  const longPress = useLongPress(onPreview, pending ? onArm : undefined);
  const classes = ['crucible-figure', pending ? '' : 'is-ashen', armed ? 'is-armed' : '', dimmed ? 'is-dimmed' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={classes}
      style={{ '--type-rgb': getTypeColorRgb(hero.types[0]) } as CSSProperties}
      role="button"
      tabIndex={pending ? 0 : -1}
      aria-disabled={!pending}
      aria-pressed={armed}
      aria-label={`${hero.name}, level ${entry.level} — ${pending ? 'stand at the rim' : 'already tempered'}`}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && pending) {
          e.preventDefault();
          onArm();
        }
      }}
      {...longPress}
    >
      <span className="crucible-figure-frame" aria-hidden="true" />
      <span className="crucible-figure-ground" aria-hidden="true" />
      <HeroPortrait heroId={hero.id} className="crucible-portrait" />
      <span className="crucible-figure-name">{hero.name}</span>
      <span className="crucible-figure-types">
        {rosterEntryTypes(hero, entry).map((t) => (
          <span key={t} className="pick-type-code" style={{ color: getTypeColor(t) }} title={t}>
            <ElementGlyph type={t} />
            {getTypeAbbr(t)}
          </span>
        ))}
      </span>
      {!pending && <span className="crucible-figure-ashen">Tempered</span>}
    </div>
  );
}

const SMOKE = [
  { duration: 9.7, delay: 0, drift: -60 },
  { duration: 12.3, delay: -4.1, drift: 50 },
  { duration: 14.9, delay: -8.6, drift: -15 },
];

// Golden-angle spread, the same as the Pact Seal's shards: stable, never symmetrical, no seed.
const EMBERS = Array.from({ length: 18 }, (_, i) => {
  const seed = i * 137.51;
  return {
    x: 22 + (seed % 56),
    delay: (seed * 0.37) % 7,
    duration: 4.2 + ((seed * 0.11) % 3.6),
    drift: -22 + ((seed * 0.53) % 44),
    size: 2 + ((seed * 0.07) % 2.5),
  };
});
