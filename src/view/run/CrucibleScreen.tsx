import { type CSSProperties, useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { seededRandom } from '../shared/seededRandom';
import { classes } from '../../data/classes';
import { equipment } from '../../data/equipment';
import { rosterHeroes } from '../../data/content';
import { moves } from '../../data/moves';
import { passives } from '../../data/passives';
import type { HeroDefinition } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import { anyClassAvailable, classMoveOverflows, grantClass, rollClassOffers, type ClassDefinition, type ClassKind } from '../../run/classes';
import { rosterEntryTypes, formIdFor } from '../../run/progression';
import { getTypeAbbr, getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { MoveDetailCard, MoveDetailOverlay } from '../combat/MoveDetailOverlay';
import { CLASS_PATHS } from '../shared/classIcons';
import { ElementGlyph } from '../shared/elementIcons';
import { healCasterForEntry } from '../shared/healCaster';
import { HeroPortrait } from '../shared/HeroPortrait';
import { MoveButtonReplica, moveEffectSummary, useLongPress } from '../shared/MoveTile';
import { NodeMotes, NODE_TINT_GOLD } from '../shared/NodeStage';
import { PassiveGlyph, PassiveReadout, passiveColor } from '../shared/passiveIcons';
import { PassiveDetailOverlay } from '../shared/PassiveDossier';
import { moveForPrimaryType } from '../../engine/state';
import { STAT_COLORS } from '../shared/StatBars';
import { CrucibleRite } from './CrucibleRite';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { MoveOfferOverlay } from './MoveOfferOverlay';
import { RosterPeek } from './RosterPeek';
import { levelOf } from '../../run/growth';
import { statScaleFor } from '../../run/statScale';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
  /** Fixes the screen's roll, so a resumed run is offered the same (docs/save-system.md D2). */
  seed: number;
}

/** The colour a kind wears — the stat the kind is about, the same palette an Evolution's kind chip uses. */
const KIND_COLORS: Record<ClassKind, string> = {
  offensive: STAT_COLORS.attack,
  defensive: STAT_COLORS.defense,
  utility: STAT_COLORS.speed,
};

/** A sentence a line: the ask reads whole rather than wrapping mid-phrase. */
const CRUCIBLE_LINE = "The Guardian's heart burns in the Crucible.\nTeach a hero a powerful Class.";

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
export function CrucibleScreen({ run, onRunChange, onContinue, seed }: Props) {
  /** Standing at the rim — chosen, not yet committed. */
  const [armedRosterId, setArmedRosterId] = useState<string | null>(null);
  const [chosenRosterId, setChosenRosterId] = useState<string | null>(null);
  /** Rolled once, on mount: three from the whole catalog. */
  const [offers] = useState(() => rollClassOffers(classes, seededRandom(seed)));
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

  // The pick is the decision and the fire is its seal, so the figure sounds as a card chosen
  // (`ui.pick`, on the arm rather than the press — the same press starts the hold that only inspects).
  function arm(rosterId: string) {
    playSfx('ui.pick');
    setArmedRosterId(rosterId);
  }

  // No sound of its own: a `resolve-button` already plays `ui.confirm` on the press (uiSfx.ts).
  function enter() {
    if (!armedEntry) return;
    setChosenRosterId(armedEntry.rosterId);
  }

  return (
    <div className={`node-screen crucible-screen${cold ? ' is-cold' : ''}`} style={{ '--node-rgb': NODE_TINT_GOLD } as CSSProperties}>
      <RosterPeek run={run} />
      <CrucibleRite
        line={cold ? 'The fire is cold. Every hero already carries a Class.' : CRUCIBLE_LINE}
        stage={
          // No boxes — a figure is lit by the fire and grows a frame only once it is the one chosen,
          // the battlefield's own targetability idiom.
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
                    onPreview={() => setPreviewing({ hero: rosterHeroes[entry.heroId], entry })}
                  />
                ))}
              </div>
            ))}
          </div>
        }
        footer={
          // An unspent Crucible is never walked past — it does not bank, so leaving is the same as
          // burning it. The button commits only once a hero stands at the rim; cold, it is the exit.
          cold ? (
            <button className="resolve-button" onClick={onContinue}>
              Continue
            </button>
          ) : (
            <button className="resolve-button crucible-enter" disabled={!armedEntry} onClick={enter}>
              {armedEntry ? `Enter the Crucible — ${rosterHeroes[armedEntry.heroId].name}` : 'Choose a hero'}
            </button>
          )
        }
      />

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
}

/**
 * Three Classes, pick then confirm, still standing in the Crucible's fire: the hero at the rim, lit
 * from below and taking the colour of the Class it is leaning toward, and the three verbs as carved
 * cards of one height — the Class's mark in a socket, its name, and the move or passive it grants in
 * a line. A hold reads the verb whole. No way back: the hero at the rim is the hero tempered, so the
 * only press is the one that commits.
 */
function ClassChoice({ run, entry, offers, pickedClassId, onPick, onConfirm }: ChoiceProps) {
  const hero = rosterHeroes[entry.heroId];
  const caster = healCasterForEntry(hero, entry, run.relics);
  const picked = pickedClassId ? offers.find((c) => c.id === pickedClassId) ?? null : null;
  const [reading, setReading] = useState<ClassDefinition | null>(null);
  return (
    <div
      className={`node-screen crucible-screen rite-screen crucible-choice${picked ? ' has-pick' : ''}`}
      style={{ '--node-rgb': NODE_TINT_GOLD, '--rite-color': picked ? classColor(picked) : '#ff8a2a' } as CSSProperties}
    >
      <span className="node-sky crucible-ground" aria-hidden="true" />
      <NodeMotes count={14} />
      <RosterPeek run={run} />

      <header className="rite-head">
        <span className="rite-hero">
          <span className="rite-pool" aria-hidden="true" />
          <HeroPortrait heroId={hero.id} pathId={formIdFor(entry)} className="rite-portrait" />
          {picked && (
            <span className="rite-mark" key={picked.id} aria-hidden="true">
              <ClassGlyph cls={picked} />
            </span>
          )}
        </span>
        <span className="rite-eyebrow">Choose a Class</span>
        <h2 className="rite-name">{hero.name}</h2>
        <span className="rite-types">
          {rosterEntryTypes(hero, entry).map((t) => (
            <span key={t} className="pick-type-code" style={{ color: getTypeColor(t) }}>
              <ElementGlyph type={t} />
              {getTypeAbbr(t)}
            </span>
          ))}
        </span>
      </header>

      <div className="verb-card-list crucible-class-list">
        {offers.map((cls) => (
          <ClassCard
            key={cls.id}
            cls={cls}
            picked={pickedClassId === cls.id}
            dimmed={!!picked && pickedClassId !== cls.id}
            caster={caster}
            onPick={() => {
              playSfx('ui.pick');
              onPick(cls.id);
            }}
            onRead={() => setReading(cls)}
          />
        ))}
      </div>

      <button className="resolve-button" disabled={!picked} onClick={onConfirm}>
        {picked ? `Temper — ${picked.name}` : 'Choose a Class'}
      </button>

      {reading?.grantsMoveId && <MoveDetailOverlay move={moves[reading.grantsMoveId]} caster={caster} onClose={() => setReading(null)} />}
      {reading?.grantsPassiveId && <PassiveDetailOverlay passive={passives[reading.grantsPassiveId]} onClose={() => setReading(null)} />}
    </div>
  );
}

interface CardProps {
  cls: ClassDefinition;
  picked: boolean;
  dimmed: boolean;
  caster: ReturnType<typeof healCasterForEntry>;
  onPick: () => void;
  onRead: () => void;
}

/**
 * One Class: its mark and name over the verb drawn as the player already knows it — a move as the
 * fight's own move button (at the type it will have on THIS hero), a passive as the innate readout.
 * Tap picks; hold reads.
 */
function ClassCard({ cls, picked, dimmed, caster, onPick, onRead }: CardProps) {
  const authored = cls.grantsMoveId ? moves[cls.grantsMoveId] : null;
  const move = authored && caster ? moveForPrimaryType(authored, caster.types[0]) : authored;
  const passive = cls.grantsPassiveId ? passives[cls.grantsPassiveId] : null;
  const longPress = useLongPress(onRead, onPick);
  const summary = move ? moveEffectSummary(move, caster) : passive?.description ?? '';
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
        {authored && <MoveButtonReplica move={authored} caster={caster} />}
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

/** What the fire made: the hero, the Class, and the verb it now carries. */
function ClassLearnedReveal({ run, entry, cls, onContinue }: RevealProps) {
  const hero = rosterHeroes[entry.heroId];
  const caster = healCasterForEntry(hero, entry, run.relics);
  const move = cls.grantsMoveId ? moves[cls.grantsMoveId] : null;
  const passive = cls.grantsPassiveId ? passives[cls.grantsPassiveId] : null;
  const color = classColor(cls);
  return (
    <div className="node-screen crucible-screen rite-screen" style={{ '--node-rgb': NODE_TINT_GOLD, '--rite-color': color } as CSSProperties}>
      <span className="node-sky crucible-ground" aria-hidden="true" />
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
          <span className="rite-eyebrow">Tempered</span>
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
  const hero = rosterHeroes[entry.heroId];
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
      aria-label={`${hero.name}, level ${levelOf(entry)} — ${pending ? 'stand at the rim' : 'already tempered'}`}
      data-sfx={pending ? 'none' : undefined}
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
      <HeroPortrait heroId={hero.id} pathId={formIdFor(entry)} className="crucible-portrait" />
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
