import { useState, type CSSProperties } from 'react';
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

/** "+10 Attack, +10 Defense" — a Class's whole mechanical effect, shown alongside its flavor description on the offer card. */
function fmtStatGrants(grants: Partial<Record<StatKey, number>> | undefined): [StatKey, number][] {
  return Object.entries(grants ?? {}).filter(([, amount]) => !!amount) as [StatKey, number][];
}

interface ClassChoiceCardProps {
  cls: PassiveDefinition;
  picked: boolean;
  onPick: () => void;
}

/** One Class offer on the Mentor's Hall screen — tap selects it, same select-then-confirm two-step as the Relic Shrine's cards (NodeRewardScreen). */
function ClassChoiceCard({ cls, picked, onPick }: ClassChoiceCardProps) {
  return (
    <button className={`relic-card class-shrine-card${picked ? ' picked' : ''}`} onClick={onPick}>
      <div className="relic-card-head">
        <span className="relic-card-icon" aria-hidden="true">
          <RunGlyph kind="class" />
        </span>
        <span className="relic-card-name">{cls.name}</span>
      </div>
      {cls.description && <p className="class-shrine-card-flavor">{cls.description}</p>}
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

/**
 * One candidate on the "who studies it" grid — the shared HeroPickCard. A tap
 * teaches the Class immediately; holding opens the full HeroPreviewOverlay
 * sheet first — stats, moves and gear, not just the name/level/types the card
 * shows — so committing a permanent, one-per-run Class to a hero isn't a
 * guess. The "i" button is the discoverable, no-hold alternative to the same
 * overlay.
 */
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
 * `classReward` node resolution: pick 1 of 3 Classes (src/data/classes.ts —
 * PassiveDefinition entries whose only content is a flat two-stat grant),
 * then pick which roster hero learns it (src/run/classes.ts grantClass,
 * which REPLACES rather than stacks — a hero can only ever hold one Class
 * per run). Kept as one component with three internal phases rather than a
 * second App.tsx-routed screen: unlike equipmentReward (which hands off to
 * the general-purpose ForceEquipScreen, reused by several other flows),
 * nothing else in the app needs a "pick a Class, then a hero" screen, so
 * it isn't worth promoting to its own routed step. Phase 1 mirrors
 * NodeRewardScreen's relicReward (tap-to-select, then confirm); phase 2
 * mirrors LevelUpScreen's/ForceEquipScreen's hero grid (tap-to-act, hold-to-
 * preview); phase 3 (2026-08-22 overhaul) is a dedicated reveal — same "this
 * is a big deal" logic as EvolutionScreen — that replaces the grid entirely
 * once a pick lands, so teaching a Class reads as a moment rather than a
 * list item quietly changing state.
 */
export function ClassNodeScreen({ run, onRunChange, onContinue }: Props) {
  const [classChoices] = useState(() => pickRandom(Object.values(classes), 3));
  const [pickedClassId, setPickedClassId] = useState<string | null>(null);
  const [confirmedClassId, setConfirmedClassId] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  const confirmedClass = confirmedClassId ? classes[confirmedClassId] : null;
  // Includes the just-assigned hero even after their classId stops being
  // null (the grant just applied) — otherwise the card they were tapped on
  // would vanish out from under the "Learned" label the instant it's shown.
  const eligibleRoster = run.roster.filter((entry) => entry.classId === null || entry.rosterId === assignedTo);
  const assignedEntry = assignedTo ? run.roster.find((r) => r.rosterId === assignedTo) ?? null : null;
  const assignedHero = assignedEntry ? heroes[assignedEntry.heroId] : null;

  function handleAssign(rosterId: string) {
    if (!confirmedClassId) return;
    onRunChange(grantClass(run, classes, rosterId, confirmedClassId));
    setAssignedTo(rosterId);
  }

  const canContinue = confirmedClassId !== null && (assignedTo !== null || eligibleRoster.length === 0);

  return (
    <div className="node-screen class-node-screen" style={{ '--node-rgb': NODE_TINT_TEAL } as CSSProperties}>
      <NodeSky />

      {/* Was a full-width "👥 Check Your Roster" secondary button sitting
          under the discipline list, which only existed on this screen and
          only during phase 1. Now the same corner glyph every other pick
          screen carries, present through all three phases — see
          RosterPeek.tsx. */}
      <RosterPeek run={run} />

      {/* The Mentor speaks from the stage rather than from inside a bordered
          plaque — `.class-shrine-banner` was a box (inside `.reward-panel`,
          a second box) around the one part of this screen you cannot act on.
          The portrait, the ring and the teal all survive it; see
          docs/visual-language.md's ninth pass. */}
      {!assignedTo && (
        <NodeHeader
          compact
          /* Only while the Mentor is at full size. The ring is 116px and the
             figure drops to 48px the moment a discipline is confirmed, so on
             the student-picking screen the dashed circle had nothing left to
             frame and its lower arc cut straight through the eyebrow and the
             title — a stray ellipse drawn over the line of text under it,
             which is the exact failure NodeHeader's own `ring` note says to
             avoid around a bare title (2026-08-29, per user report of a
             visual bug at the top of the second screen). */
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
          /* No glyph on either phase. The Mentor is already standing directly
             above the title at 96px, so a second small class sprite wedged in
             front of the words added nothing but a mark the eye tries to read
             as part of the heading. */
          readout={
            confirmedClass
              ? eligibleRoster.length === 0
                ? 'Every hero has already learned a Class — this teaching goes to waste.'
                : /* Not "Choose who will study X" any more: the eyebrow says
                     Choose a Student, the title says X, and the chips below it
                     say what X does — a sentence repeating both was the third
                     printing of the same name on one header. */
                  'Hold a hero to review its sheet before committing.'
              : "Tap a discipline to select it, then confirm — you'll choose who studies it next."
          }
        >
          {/* The discipline the player just committed to, carried through the
              student pick. The title says its name, but the name alone is not
              what the choice was made on — the grants are — and by this screen
              the card that showed them is gone. Same slot, and the same chips,
              the forced-equip gate uses for the item it is placing. */}
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

      {/* Phase 2's grid is a direct child of the screen, not a `.stage-centered`
          block inside `.screen-scroll` — that is what puts the figures at the
          same height here as on Level Up, Equipment and the stat shrines
          (2026-08-28 pass). Phases 1 and 3 keep the scroll region: a list of
          three disciplines and the learn-reveal are both content to read, not
          a roster to compare. */}
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
              {confirmedClass.description && <p className="class-learn-desc">{confirmedClass.description}</p>}
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

      {/* One CTA at the bottom, whichever the screen is waiting for — the
          Confirm used to sit inside the scroll area with a second, disabled
          gold Continue directly beneath it, two identical-looking primaries
          of which one was inert. */}
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
