import { useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import mentorArt from '../../../art/npc/mentor.png';
import { heroes } from '../../data/heroes';
import { classes } from '../../data/classes';
import { equipment } from '../../data/equipment';
import type { HeroDefinition, PassiveDefinition, StatKey } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import { grantClass } from '../../run/classes';
import { HeroPortrait } from '../shared/HeroPortrait';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { NodeHeader, NodeSky, NODE_TINT_TEAL } from '../shared/NodeStage';
import { StatGlyph, STAT_LABELS } from '../shared/StatBars';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterPeek } from './RosterPeek';
import { RunGlyph } from '../shared/RunGlyph';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

function pickRandom<T>(pool: readonly T[], count: number): T[] {
  const remaining = [...pool];
  const picked: T[] = [];
  while (picked.length < Math.min(count, remaining.length)) {
    picked.push(remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0]);
  }
  return picked;
}

function fmtStatGrants(grants: Partial<Record<StatKey, number>> | undefined): [StatKey, number][] {
  return Object.entries(grants ?? {}).filter(([, amount]) => !!amount) as [StatKey, number][];
}

interface ClassChoiceCardProps {
  cls: PassiveDefinition;
  picked: boolean;
  onPick: () => void;
}

function ClassChoiceCard({ cls, picked, onPick }: ClassChoiceCardProps) {
  return (
    <button className={`relic-card class-shrine-card${picked ? ' picked' : ''}`} onClick={onPick}>
      <div className="relic-card-head">
        <span className="relic-card-icon" aria-hidden="true">
          <RunGlyph kind="class" />
        </span>
        <span className="relic-card-name">{cls.name}</span>
      </div>
      <div className="class-shrine-card-grants">
        {fmtStatGrants(cls.statGrants).map(([stat, amount]) => (
          <span key={stat} className="evolution-path-grant-chip">
            <StatGlyph stat={stat} /> {STAT_LABELS[stat]} +{amount}
          </span>
        ))}
      </div>
    </button>
  );
}

interface ClassHeroCardProps {
  hero: HeroDefinition;
  entry: RosterEntry;
  onAssign: () => void;
  onPreview: () => void;
}

function ClassHeroCard({ hero, entry, onAssign, onPreview }: ClassHeroCardProps) {
  return (
    <HeroPickCard
      hero={hero}
      entry={entry}
      onActivate={onAssign}
      onPreview={onPreview}
      ariaLabel={`${hero.name}, level ${entry.level} — teach this discipline`}
      ctaClassName="is-accent"
      cta="Teach"
    />
  );
}

/**
 * `classReward` node: pick 1 of 3 Classes, then the hero who learns it (grantClass replaces rather
 * than stacks). Three phases in one component — select-then-confirm, tap-to-assign, then a reveal.
 */
export function ClassNodeScreen({ run, onRunChange, onContinue }: Props) {
  const [classChoices] = useState(() => pickRandom(Object.values(classes), 3));
  const [pickedClassId, setPickedClassId] = useState<string | null>(null);
  const [confirmedClassId, setConfirmedClassId] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  const confirmedClass = confirmedClassId ? classes[confirmedClassId] : null;
  // Keeps the just-assigned hero (whose classId is no longer null) so their card doesn't vanish
  // out from under the "Learned" label.
  const eligibleRoster = run.roster.filter((entry) => entry.classId === null || entry.rosterId === assignedTo);
  const assignedEntry = assignedTo ? run.roster.find((r) => r.rosterId === assignedTo) ?? null : null;
  const assignedHero = assignedEntry ? heroes[assignedEntry.heroId] : null;

  function handleAssign(rosterId: string) {
    if (!confirmedClassId) return;
    playSfx('class.learn');
    onRunChange(grantClass(run, classes, rosterId, confirmedClassId));
    setAssignedTo(rosterId);
  }

  const canContinue = confirmedClassId !== null && (assignedTo !== null || eligibleRoster.length === 0);

  return (
    <div className="node-screen class-node-screen" style={{ '--node-rgb': NODE_TINT_TEAL } as CSSProperties}>
      <NodeSky />

      <RosterPeek run={run} />

      {!assignedTo && (
        <NodeHeader
          compact
          /* Ring only while the Mentor is full-size; at 48px its lower arc cut through the title. */
          ring={!confirmedClass}
          art={
            <img
              src={mentorArt}
              className={`class-shrine-mentor${confirmedClass ? ' class-shrine-mentor-small' : ''}`}
              alt=""
              draggable={false}
            />
          }
          eyebrow={confirmedClass ? 'Choose a Student' : 'The Mentor Awaits'}
          title={confirmedClass ? confirmedClass.name : "Mentor's Hall"}
          readout={
            confirmedClass
              ? eligibleRoster.length === 0
                ? 'Every hero has already learned a Class — this teaching goes to waste.'
                : 'Hold a hero to review its sheet before committing.'
              : "Tap a discipline to select it, then confirm — you'll choose who studies it next."
          }
        >
          {confirmedClass && (
            <div className="node-item-effects">
              <div className="detail-modifier-list">
                {fmtStatGrants(confirmedClass.statGrants).map(([stat, amount]) => (
                  <span key={stat} className="detail-modifier-chip stat-buff">
                    <StatGlyph stat={stat} tone="inherit" /> {STAT_LABELS[stat]} +{amount}
                  </span>
                ))}
              </div>
            </div>
          )}
        </NodeHeader>
      )}

      {/* Phase 2's grid is a direct child of the screen (not inside `.screen-scroll`) so its figures
          sit at the same height as on Level Up, Equipment and the stat shrines. */}
      {!confirmedClass ? (
        <div className="screen-scroll">
          <div className="stage-centered">
            <div className="class-shrine-list">
              {classChoices.map((cls) => (
                <ClassChoiceCard
                  key={cls.id}
                  cls={cls}
                  picked={pickedClassId === cls.id}
                  onPick={() => setPickedClassId(pickedClassId === cls.id ? null : cls.id)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : !assignedTo ? (
        eligibleRoster.length > 0 ? (
          <HeroPickGrid count={eligibleRoster.length} fill>
            {eligibleRoster.map((entry) => {
              const hero = heroes[entry.heroId];
              return (
                <ClassHeroCard
                  key={entry.rosterId}
                  hero={hero}
                  entry={entry}
                  onAssign={() => handleAssign(entry.rosterId)}
                  onPreview={() => setPreviewEntry({ hero, entry })}
                />
              );
            })}
          </HeroPickGrid>
        ) : (
          <div className="node-spacer" />
        )
      ) : (
        <div className="screen-scroll">
          {assignedHero && confirmedClass && (
            <div className="class-learn-reveal">
              <div className="class-learn-flash" aria-hidden="true" />
              <div className="class-learn-portraits">
                <img src={mentorArt} className="class-learn-mentor" alt="" draggable={false} />
                <span className="class-learn-arrow" aria-hidden="true">
                  →
                </span>
                <HeroPortrait heroId={assignedHero.id} className="class-learn-hero" />
              </div>
              <div className="class-learn-eyebrow">Discipline Learned</div>
              <h2 className="class-learn-title">{assignedHero.name}</h2>
              <div className="class-learn-classname">{confirmedClass.name}</div>
              <div className="class-learn-grants">
                {fmtStatGrants(confirmedClass.statGrants).map(([stat, amount], i) => (
                  <span key={stat} className="class-learn-grant-chip" style={{ animationDelay: `${0.15 + i * 0.1}s` }}>
                    <StatGlyph stat={stat} /> {STAT_LABELS[stat]} +{amount}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!confirmedClass ? (
        <button
          className="resolve-button class-shrine-confirm-button"
          disabled={!pickedClassId}
          onClick={() => pickedClassId && setConfirmedClassId(pickedClassId)}
        >
          {pickedClassId ? `Confirm ${classChoices.find((c) => c.id === pickedClassId)?.name}` : 'Select a discipline'}
        </button>
      ) : (
        <button className="resolve-button" disabled={!canContinue} onClick={onContinue}>
          Continue
        </button>
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
