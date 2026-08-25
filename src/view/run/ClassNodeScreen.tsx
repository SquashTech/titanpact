import { useState } from 'react';
import mentorArt from '../../../art/npc/mentor.png';
import { heroes } from '../../data/heroes';
import { classes } from '../../data/classes';
import { equipment } from '../../data/equipment';
import type { HeroDefinition, PassiveDefinition, StatKey } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import { grantClass, chosenClass } from '../../run/classes';
import { rosterEntryTypes } from '../../run/progression';
import { getTypeColor } from '../combat/typeColors';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { useLongPress } from '../shared/MoveTile';
import { STAT_ICONS, STAT_LABELS } from '../shared/StatBars';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
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
            {STAT_ICONS[stat]} {STAT_LABELS[stat]} +{amount}
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
 * One candidate on the "who studies it" grid — pulled out of the .map() below
 * because useLongPress is a hook (same reason LevelUpScreen's own hero card
 * is its own component). A tap teaches the Class immediately; holding opens
 * the full HeroPreviewOverlay sheet first — full stats/moves/gear, not just
 * the name/level/types this grid shows — so committing a permanent, one-per-
 * run Class to a hero isn't a guess. The "i" button is the discoverable,
 * no-hold alternative to the same overlay.
 */
function ClassHeroCard({ hero, entry, onAssign, onPreview }: ClassHeroCardProps) {
  const longPress = useLongPress(onPreview, onAssign);
  return (
    <div
      className="hero-grid-card"
      style={{ borderLeftColor: getTypeColor(hero.types[0]) }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAssign();
        }
      }}
      {...longPress}
    >
      <button
        type="button"
        className="info-button hero-grid-info-button"
        onClick={(e) => {
          e.stopPropagation();
          onPreview();
        }}
        aria-label={`View ${hero.name} details`}
      >
        i
      </button>
      <HeroPortrait heroId={hero.id} className="hero-grid-portrait" />
      <div className="hero-grid-name-row">
        <span className="hero-grid-name">{hero.name}</span>
        <span className="training-hero-level">Lv {entry.level}</span>
      </div>
      <div className="hero-grid-types">
        {rosterEntryTypes(hero, entry).map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
      </div>
      <span className="hero-grid-cta">Teach</span>
    </div>
  );
}

interface RosterPeekOverlayProps {
  run: RunState;
  onInspect: (hero: HeroDefinition, entry: RosterEntry) => void;
  onClose: () => void;
}

/**
 * "Check your roster before committing" — a read-only overview reachable
 * from the pick-a-Class phase, before the player has even chosen a
 * discipline. Reuses RosterManagementScreen's overlay/panel chrome and the
 * shared .hero-grid card shape; unlike that screen this is pure inspection
 * (no equipment dragging), so every card just opens the full HeroPreviewOverlay
 * sheet on tap.
 */
function RosterPeekOverlay({ run, onInspect, onClose }: RosterPeekOverlayProps) {
  return (
    <div className="log-overlay roster-mgmt-overlay" onClick={onClose}>
      <div className="log-panel roster-panel" onClick={(e) => e.stopPropagation()}>
        <div className="log-panel-header">
          <span>Your Roster</span>
          <button className="log-close-button" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="screen-scroll">
          <div className="hero-grid">
            {run.roster.map((entry) => {
              const hero = heroes[entry.heroId];
              const heroClass = chosenClass(classes, entry);
              return (
                <button
                  key={entry.rosterId}
                  type="button"
                  className="hero-grid-card"
                  style={{ borderLeftColor: getTypeColor(hero.types[0]) }}
                  onClick={() => onInspect(hero, entry)}
                >
                  <HeroPortrait heroId={hero.id} className="hero-grid-portrait" />
                  <div className="hero-grid-name-row">
                    <span className="hero-grid-name">{hero.name}</span>
                    <span className="training-hero-level">Lv {entry.level}</span>
                  </div>
                  <div className="hero-grid-types">
                    {rosterEntryTypes(hero, entry).map((t) => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </div>
                  <span className="hero-grid-cta">{heroClass ? heroClass.name.replace('Class - ', '') : 'Tap to inspect'}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
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
  const [rosterPeekOpen, setRosterPeekOpen] = useState(false);

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
    <div className="node-screen class-node-screen">
      <div className="screen-scroll">
        {!confirmedClass ? (
          <div className="bottom-pinned">
            <div className="reward-panel class-shrine-panel">
              <div className="class-shrine-banner">
                <div className="class-shrine-glow" aria-hidden="true" />
                <img src={mentorArt} className="class-shrine-mentor" alt="" />
                <div className="class-shrine-eyebrow">The Mentor Awaits</div>
                <h2><RunGlyph kind="class" /> Mentor's Hall</h2>
                <p className="hint">Tap a discipline to select it, then confirm — you'll choose who studies it next.</p>
                <button type="button" className="secondary-button class-shrine-roster-btn" onClick={() => setRosterPeekOpen(true)}>
                  👥 Check Your Roster
                </button>
              </div>
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
            <button
              className="resolve-button class-shrine-confirm-button"
              disabled={!pickedClassId}
              onClick={() => pickedClassId && setConfirmedClassId(pickedClassId)}
            >
              {pickedClassId ? `Confirm ${classChoices.find((c) => c.id === pickedClassId)?.name}` : 'Select a discipline'}
            </button>
          </div>
        ) : !assignedTo ? (
          <div className="bottom-pinned">
            <div className="reward-panel">
              <div className="class-shrine-banner">
                <div className="class-shrine-glow" aria-hidden="true" />
                <img src={mentorArt} className="class-shrine-mentor class-shrine-mentor-small" alt="" />
                <h2>{confirmedClass.name}</h2>
                <p className="hint">
                  {eligibleRoster.length === 0
                    ? 'Every hero has already learned a Class — this teaching goes to waste.'
                    : `Choose who will study ${confirmedClass.name}.`}
                </p>
              </div>
            </div>
            {eligibleRoster.length > 0 && (
              <div className="hero-grid">
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
              </div>
            )}
          </div>
        ) : (
          assignedHero &&
          confirmedClass && (
            <div className="class-learn-reveal">
              <div className="class-learn-flash" aria-hidden="true" />
              <div className="class-learn-portraits">
                <img src={mentorArt} className="class-learn-mentor" alt="" />
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
                    {STAT_ICONS[stat]} {STAT_LABELS[stat]} +{amount}
                  </span>
                ))}
              </div>
            </div>
          )
        )}
      </div>
      <button className="resolve-button" disabled={!canContinue} onClick={onContinue}>
        Continue
      </button>

      {previewEntry && (
        <HeroPreviewOverlay
          hero={previewEntry.hero}
          entry={previewEntry.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          onClose={() => setPreviewEntry(null)}
        />
      )}

      {rosterPeekOpen && (
        <RosterPeekOverlay
          run={run}
          onInspect={(hero, entry) => setPreviewEntry({ hero, entry })}
          onClose={() => setRosterPeekOpen(false)}
        />
      )}
    </div>
  );
}
