import { useState } from 'react';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import { classes } from '../../data/classes';
import { chosenClass } from '../../run/classes';
import { locationForAct } from '../../run/locations';
import { type Profile } from '../../run/profile';
import type { HeroDefinition } from '../../engine/content';
import { SEAL_ACTS, type RosterEntry, type RunState } from '../../run/state';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { PlateButton } from '../shared/PlateButton';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { levelOf } from '../../run/growth';
import { statScaleFor } from '../../run/statScale';
import { evolutionName } from './evolutionName';
import { VictoryCard } from './VictoryCard';
import { victoryStars } from './victoryStars';

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

/**
 * The end of a run. A clear is one framed card — the Cycle beaten, the team in the forms it
 * finished in, the road, what it paid — made to be screenshotted, with the ways out below its
 * frame. A loss says how far it got and who fell, and what it added to the profile. No ledger:
 * gold, fights won and Banners were the run's bookkeeping, not its story (2026-09-16, per user
 * direction).
 */
export function RunSummaryScreen({ outcome, run, profileBefore, profileAfter, onNewRun, onReturnToTitle }: Props) {
  const [inspecting, setInspecting] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const inspect = (entry: RosterEntry) => setInspecting({ hero: rosterHeroes[entry.heroId], entry });

  const preview = inspecting && (
    <HeroPreviewOverlay
      hero={inspecting.hero}
      entry={inspecting.entry}
      equipmentLookup={equipment}
      relicIds={run.relics}
      gold={run.gold}
      scale={statScaleFor(run)}
      onClose={() => setInspecting(null)}
    />
  );

  if (outcome === 'win') {
    return (
      <div className="result-overlay run-summary-overlay result-win">
        <span className="champion-rays run-summary-rays" aria-hidden="true" />
        <div className="run-summary-victory">
          <VictoryCard run={run} profileAfter={profileAfter} stars={victoryStars(run, profileBefore, profileAfter)} onInspect={inspect} />
          <div className="run-summary-victory-buttons">
            <PlateButton onClick={onNewRun}>Start a New Run</PlateButton>
            <button type="button" className="secondary-button" onClick={onReturnToTitle}>
              Return to Title
            </button>
          </div>
        </div>
        {preview}
      </div>
    );
  }

  const place = run.locationIds.length > 0 ? locationForAct(run.locationIds, run.actNumber) : null;
  const newFurthestAct = profileAfter.furthestAct > profileBefore.furthestAct;

  return (
    <div className="result-overlay run-summary-overlay result-loss">
      <div className="result-panel run-summary-panel">
        <div className="result-glow" aria-hidden="true" />

        <h2>Run Failed</h2>
        <p className="run-summary-where">
          {run.actNumber > SEAL_ACTS
            ? `Your squad fell at the last pact${place ? ` · ${place.name}` : ''}.`
            : `Your squad fell in Act ${actLabel(run.actNumber)} of ${actLabel(SEAL_ACTS)}${place ? ` · ${place.name}` : ''}.`}
        </p>

        {run.roster.length > 0 && (
          <>
            <div className="run-summary-section-title">Your final squad</div>
            <HeroPickGrid count={run.roster.length}>
              {run.roster.map((entry) => {
                const hero = rosterHeroes[entry.heroId];
                const heroClass = chosenClass(classes, entry);
                return (
                  <HeroPickCard
                    key={entry.rosterId}
                    hero={hero}
                    entry={entry}
                    onActivate={() => inspect(entry)}
                    onPreview={() => inspect(entry)}
                    ariaLabel={`${hero.name}, level ${levelOf(entry)} — view sheet`}
                    /* What this hero became, falling back to its Class; the card badges the level itself. */
                    cta={evolutionName(entry) ?? (heroClass ? heroClass.name.replace('Class - ', '') : null)}
                  />
                );
              })}
            </HeroPickGrid>
          </>
        )}

        {newFurthestAct && (
          <>
            <div className="run-summary-section-title">Records</div>
            <div className="run-summary-records">
              <span className="run-summary-record-chip">
                Furthest act — {profileAfter.furthestAct > SEAL_ACTS ? 'Finale' : actLabel(profileAfter.furthestAct)}
              </span>
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

      {preview}
    </div>
  );
}
