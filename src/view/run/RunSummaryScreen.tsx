import { useState } from 'react';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import { classes } from '../../data/classes';
import { locations } from '../../data/locations';
import { progressionTable } from '../../data/progression';
import { chosenClass } from '../../run/classes';
import { locationForAct } from '../../run/locations';
import { companionTypeOf, hasCompanionStar, hasEvolutionStar, type Profile } from '../../run/profile';
import { currentEvolutionPathId } from '../../run/progression';
import type { HeroDefinition } from '../../engine/content';
import { SEAL_ACTS, type RosterEntry, type RunState } from '../../run/state';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { levelOf } from '../../run/growth';
import { statScaleFor } from '../../run/statScale';

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
  const chosen = currentEvolutionPathId(entry);
  if (!chosen) return null;
  for (const node of progressionTable.evolutions[entry.heroId] ?? []) {
    const path = node.paths.find((p) => p.id === chosen);
    if (path) return path.name;
  }
  return null;
}

/**
 * The end of a run, which used to be a heading and a button. What it came to, in the order it
 * matters: how far it got (one sentence, the act and the place), what it became (the roster that
 * finished it, each hero still openable), and what it added to the profile — the last being the
 * only reason to press start again. No ledger: the figures it used to carry (gold, fights won,
 * Banners) were the run's bookkeeping, not its story (2026-09-16, per user direction).
 */
export function RunSummaryScreen({ outcome, run, profileBefore, profileAfter, onNewRun, onReturnToTitle }: Props) {
  const [inspecting, setInspecting] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  const won = outcome === 'win';
  const place = run.locationIds.length > 0 ? locationForAct(run.locationIds, run.actNumber) : null;

  // Diffed rather than passed in, so the screen cannot disagree with what was actually recorded:
  // a hero's star is NEW when the form it finished in is in the profile after and not before.
  const starsAwarded = run.roster.filter((entry) => {
    const type = companionTypeOf(entry.heroId);
    if (type) return hasCompanionStar(profileAfter, type) && !hasCompanionStar(profileBefore, type);
    const pathId = currentEvolutionPathId(entry);
    return pathId !== null && hasEvolutionStar(profileAfter, entry.heroId, pathId) && !hasEvolutionStar(profileBefore, entry.heroId, pathId);
  });
  const newFurthestAct = profileAfter.furthestAct > profileBefore.furthestAct;
  const hasRecords = starsAwarded.length > 0 || newFurthestAct;

  return (
    <div className={`result-overlay ${won ? 'result-win' : 'result-loss'}`}>
      <div className="result-panel run-summary-panel">
        <div className="result-glow" aria-hidden="true" />

        <h2>{won ? 'Run Cleared' : 'Run Failed'}</h2>
        <p className="run-summary-where">
          {won
            ? `All ${SEAL_ACTS} Guardians have fallen, the Herald with them, and the Titan's Eyes have closed.`
            : run.actNumber > SEAL_ACTS
              ? `Your squad fell at the last pact${place ? ` · ${place.name}` : ''}.`
              : `Your squad fell in Act ${actLabel(run.actNumber)} of ${actLabel(SEAL_ACTS)}${place ? ` · ${place.name}` : ''}.`}
        </p>

        {run.roster.length > 0 && (
          <>
            <div className="run-summary-section-title">{won ? 'The team that finished' : 'Your final squad'}</div>
            <HeroPickGrid count={run.roster.length}>
              {run.roster.map((entry) => {
                const hero = rosterHeroes[entry.heroId];
                const heroClass = chosenClass(classes, entry);
                const earnedStar = starsAwarded.some((e) => e.rosterId === entry.rosterId);
                return (
                  <HeroPickCard
                    key={entry.rosterId}
                    hero={hero}
                    entry={entry}
                    onActivate={() => setInspecting({ hero, entry })}
                    onPreview={() => setInspecting({ hero, entry })}
                    ariaLabel={`${hero.name}, level ${levelOf(entry)} — view sheet`}
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
                  ★ {rosterHeroes[entry.heroId].name} · {companionTypeOf(entry.heroId) ? 'Companion' : evolutionName(entry)}
                </span>
              ))}
              {newFurthestAct && (
                <span className="run-summary-record-chip">
                  Furthest act — {profileAfter.furthestAct > SEAL_ACTS ? 'Finale' : actLabel(profileAfter.furthestAct)}
                </span>
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
          scale={statScaleFor(run)}
          onClose={() => setInspecting(null)}
        />
      )}
    </div>
  );
}
