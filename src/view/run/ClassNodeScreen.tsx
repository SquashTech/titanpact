import { useState } from 'react';
import { heroes } from '../../data/heroes';
import { classes } from '../../data/classes';
import type { PassiveDefinition, StatKey } from '../../engine/content';
import type { RunState } from '../../run/state';
import { grantClass } from '../../run/classes';
import { rosterEntryTypes } from '../../run/progression';
import { getTypeColor } from '../combat/typeColors';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { STAT_LABELS } from '../shared/StatBars';

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

/** "+10 Attack, +10 Defense" — a Class's whole effect, so this is all a card needs to show (no hold-to-inspect popup, unlike relics/equipment which carry longer descriptions). */
function fmtStatGrants(grants: Partial<Record<StatKey, number>> | undefined): string {
  return Object.entries(grants ?? {})
    .filter(([, amount]) => amount)
    .map(([stat, amount]) => `${(amount as number) > 0 ? '+' : ''}${amount} ${STAT_LABELS[stat as StatKey] ?? stat}`)
    .join(', ');
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
          🏛️
        </span>
        <span className="relic-card-name">{cls.name}</span>
      </div>
      <div className="relic-card-desc">{fmtStatGrants(cls.statGrants)}</div>
    </button>
  );
}

/**
 * `classReward` node resolution: pick 1 of 3 Classes (src/data/classes.ts —
 * PassiveDefinition entries whose only content is a flat two-stat grant),
 * then pick which roster hero learns it (src/run/classes.ts grantClass,
 * which REPLACES rather than stacks — a hero can only ever hold one Class
 * per run). Kept as one component with two internal phases rather than a
 * second App.tsx-routed screen: unlike equipmentReward (which hands off to
 * the general-purpose ForceEquipScreen, reused by several other flows),
 * nothing else in the app needs a "pick a Class, then a hero" screen, so
 * it isn't worth promoting to its own routed step. Phase 1 mirrors
 * NodeRewardScreen's relicReward (tap-to-select, then confirm); phase 2
 * mirrors StatBoostScreen's target-hero list, filtered to heroes who don't
 * already hold a Class — offering the pick to an already-classed hero would
 * silently overwrite their existing Class, which is never what "teach a
 * Class" should mean here.
 */
export function ClassNodeScreen({ run, onRunChange, onContinue }: Props) {
  const [classChoices] = useState(() => pickRandom(Object.values(classes), 3));
  const [pickedClassId, setPickedClassId] = useState<string | null>(null);
  const [confirmedClassId, setConfirmedClassId] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);

  const confirmedClass = confirmedClassId ? classes[confirmedClassId] : null;
  // Includes the just-assigned hero even after their classId stops being
  // null (the grant just applied) — otherwise the card they were tapped on
  // would vanish out from under the "Learned" label the instant it's shown.
  const eligibleRoster = run.roster.filter((entry) => entry.classId === null || entry.rosterId === assignedTo);

  function handleAssign(rosterId: string) {
    if (!confirmedClassId) return;
    onRunChange(grantClass(run, classes, rosterId, confirmedClassId));
    setAssignedTo(rosterId);
  }

  const canContinue = confirmedClassId !== null && (assignedTo !== null || eligibleRoster.length === 0);

  return (
    <div className="node-screen">
      <div className="screen-scroll">
        {!confirmedClass ? (
          <div className="reward-panel class-shrine-panel">
            <div className="class-shrine-banner">
              <div className="class-shrine-glow" aria-hidden="true" />
              <h2>🏛️ Mentor's Hall</h2>
              <p className="hint">Tap a discipline to select it, then confirm — you'll choose who studies it next.</p>
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
            {pickedClassId && (
              <button className="resolve-button" onClick={() => setConfirmedClassId(pickedClassId)}>
                Confirm {classChoices.find((c) => c.id === pickedClassId)?.name}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="reward-panel">
              <h2>🏛️ Mentor's Hall</h2>
              <p className="hint">
                {assignedTo
                  ? `${heroes[run.roster.find((r) => r.rosterId === assignedTo)!.heroId].name} learned ${confirmedClass.name}.`
                  : eligibleRoster.length === 0
                    ? 'Every hero has already learned a Class — this teaching goes to waste.'
                    : `Choose a hero to learn ${confirmedClass.name} (${fmtStatGrants(confirmedClass.statGrants)}).`}
              </p>
            </div>
            {eligibleRoster.length > 0 && (
              <div className="equip-target-list">
                {eligibleRoster.map((entry) => {
                  const hero = heroes[entry.heroId];
                  const isAssigned = assignedTo === entry.rosterId;
                  return (
                    <button
                      key={entry.rosterId}
                      className="equip-target-card"
                      style={{ borderLeftColor: getTypeColor(hero.types[0]) }}
                      disabled={!!assignedTo}
                      onClick={() => handleAssign(entry.rosterId)}
                    >
                      <div className="roster-mgmt-head">
                        <HeroPortrait heroId={hero.id} className="roster-mgmt-portrait" />
                        <div className="roster-mgmt-name">
                          {hero.name} <span className="hint">Lv {entry.level}</span>
                        </div>
                        <div className="roster-card-types">
                          {rosterEntryTypes(hero, entry).map((t) => (
                            <TypeBadge key={t} type={t} />
                          ))}
                        </div>
                        <span className="equip-target-cta">{isAssigned ? 'Learned' : 'Teach'}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      <button className="resolve-button" disabled={!canContinue} onClick={onContinue}>
        Continue
      </button>
    </div>
  );
}
