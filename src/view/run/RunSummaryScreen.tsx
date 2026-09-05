import { useState } from 'react';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import { relics } from '../../data/relics';
import { classes } from '../../data/classes';
import { locations } from '../../data/locations';
import { progressionTable } from '../../data/progression';
import { chosenClass } from '../../run/classes';
import { locationForAct } from '../../run/locations';
import type { Profile } from '../../run/profile';
import type { RelicDefinition } from '../../run/relics';
import type { HeroDefinition } from '../../engine/content';
import { TOTAL_ACTS, type RosterEntry, type RunState } from '../../run/state';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { RelicIcon } from '../shared/EquipmentBox';
import { stackedGrantSummary, stackedRelicName } from '../shared/relicStacks';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';

interface Props {
  outcome: 'win' | 'loss';
  /** The run as it finished — read only; this screen changes nothing. */
  run: RunState;
  /** Profile either side of this run being recorded, so the screen can show what the run ADDED. */
  profileBefore: Profile;
  profileAfter: Profile;
  onNewRun: () => void;
  onReturnToTitle: () => void;
}

const ACT_ROMAN = ['I', 'II', 'III', 'IV', 'V'];

function actLabel(actNumber: number): string {
  return ACT_ROMAN[actNumber - 1] ?? String(actNumber);
}

/** The name of the last Evolution taken — the one word that says what this hero became. */
function evolutionName(entry: RosterEntry): string | null {
  const chosen = entry.chosenPathIds[entry.chosenPathIds.length - 1];
  if (!chosen) return null;
  for (const node of progressionTable.evolutions[entry.heroId] ?? []) {
    const path = node.paths.find((p) => p.id === chosen);
    if (path) return path.name;
  }
  return null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="run-summary-stat">
      <span className="run-summary-stat-value">{value}</span>
      <span className="run-summary-stat-label">{label}</span>
    </div>
  );
}

/**
 * The end of a run, which used to be a heading and a button. Three things, in the order they
 * matter: what the run became (the roster that finished it, each hero still openable), how far
 * it got, and what it added to the profile — the last being the only reason to press start again.
 */
export function RunSummaryScreen({ outcome, run, profileBefore, profileAfter, onNewRun, onReturnToTitle }: Props) {
  const [inspecting, setInspecting] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  const won = outcome === 'win';
  const place = run.locationIds.length > 0 ? locationForAct(run.locationIds, run.actNumber) : null;

  /** Folded by id, the same way RosterPeek shows them: a stacked relic is one chip with its total. */
  const relicCounts = new Map<string, number>();
  for (const id of run.relics) relicCounts.set(id, (relicCounts.get(id) ?? 0) + 1);
  const ownedRelics = [...relicCounts]
    .map(([id, count]) => ({ relic: relics[id], count }))
    .filter((r): r is { relic: RelicDefinition; count: number } => !!r.relic);

  // Diffed rather than passed in, so the screen cannot disagree with what was actually recorded.
  const starsAwarded = run.roster.filter(
    (entry) => (profileAfter.heroStars[entry.heroId] ?? 0) > (profileBefore.heroStars[entry.heroId] ?? 0)
  );
  const newFurthestAct = profileAfter.furthestAct > profileBefore.furthestAct;
  const hasRecords = starsAwarded.length > 0 || newFurthestAct;

  return (
    <div className={`result-overlay ${won ? 'result-win' : 'result-loss'}`}>
      <div className="result-panel run-summary-panel">
        <div className="result-glow" aria-hidden="true" />

        <h2>{won ? 'Run Cleared' : 'Run Failed'}</h2>
        <p className="run-summary-where">
          {won
            ? `All ${TOTAL_ACTS} Guardians have fallen.`
            : `Your squad fell in Act ${actLabel(run.actNumber)}${place ? ` · ${place.name}` : ''}.`}
        </p>

        <div className="run-summary-stats">
          <Stat label="Act reached" value={`${actLabel(run.actNumber)} / ${TOTAL_ACTS}`} />
          <Stat label="Encounters won" value={String(run.encountersWon)} />
          <Stat label="Gold" value={String(run.gold)} />
          <Stat label="Relics" value={String(run.relics.length)} />
        </div>

        {ownedRelics.length > 0 && (
          <div className="run-summary-relics">
            {ownedRelics.map(({ relic, count }) => {
              const summary = count > 1 ? stackedGrantSummary(relic, count) : '';
              return (
                <span
                  key={relic.id}
                  className="roster-peek-relic"
                  title={(summary && `Team-wide ${summary}.`) || relic.description || relic.name}
                >
                  <RelicIcon relicId={relic.id} className="roster-peek-relic-icon" />
                  {stackedRelicName(relic, count)}
                </span>
              );
            })}
          </div>
        )}

        {run.roster.length > 0 && (
          <>
            <div className="run-summary-section-title">{won ? 'The team that finished' : 'Your final squad'}</div>
            <HeroPickGrid count={run.roster.length}>
              {run.roster.map((entry) => {
                const hero = heroes[entry.heroId];
                const heroClass = chosenClass(classes, entry);
                const earnedStar = starsAwarded.some((e) => e.rosterId === entry.rosterId);
                return (
                  <HeroPickCard
                    key={entry.rosterId}
                    hero={hero}
                    entry={entry}
                    onActivate={() => setInspecting({ hero, entry })}
                    onPreview={() => setInspecting({ hero, entry })}
                    ariaLabel={`${hero.name}, level ${entry.level} — view sheet`}
                    overlay={
                      earnedStar ? (
                        <span className="run-summary-card-star" aria-hidden="true">
                          ★
                        </span>
                      ) : undefined
                    }
                    /* What this hero became, falling back to its Class; the card badges the level itself. */
                    cta={evolutionName(entry) ?? (heroClass ? heroClass.name.replace('Class - ', '') : 'Inspect')}
                  />
                );
              })}
            </HeroPickGrid>
          </>
        )}

        {hasRecords && (
          <>
            <div className="run-summary-section-title">Records</div>
            <div className="run-summary-records">
              {starsAwarded.map((entry) => (
                <span key={entry.rosterId} className="run-summary-record-chip is-star">
                  ★ {heroes[entry.heroId].name}
                </span>
              ))}
              {newFurthestAct && (
                <span className="run-summary-record-chip">Furthest act — {actLabel(profileAfter.furthestAct)}</span>
              )}
            </div>
          </>
        )}

        {/* Stacked, not the shared row: two full sentences side by side on a phone are two cramped targets.
            `.result-buttons button:last-child` still makes the second one read as secondary. */}
        <div className="result-buttons run-summary-buttons">
          <button onClick={onNewRun}>Start a New Run</button>
          <button onClick={onReturnToTitle}>Return to Title</button>
        </div>
      </div>

      {inspecting && (
        <HeroPreviewOverlay
          hero={inspecting.hero}
          entry={inspecting.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          onClose={() => setInspecting(null)}
        />
      )}
    </div>
  );
}
