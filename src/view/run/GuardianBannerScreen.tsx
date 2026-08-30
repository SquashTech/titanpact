import { useState, type CSSProperties } from 'react';
import { guardianBannerRelics } from '../../data/relics';
import type { RunState } from '../../run/state';
import { grantRelicReward } from '../../run/runProgress';
import { RelicIcon } from '../shared/EquipmentBox';
import { NodeHeader, NodeSky, NODE_TINT_GOLD } from '../shared/NodeStage';
import { RunGlyph } from '../shared/RunGlyph';
import { stackedGrantSummary, stackedRelicName } from '../shared/relicStacks';
import { RelicChoiceCard } from './RelicChoiceCard';
import { RosterPeek } from './RosterPeek';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

/**
 * The Guardian's Banner (docs/run-loop.md): the extra reward for beating an
 * act's Guardian, shown after the wins that end acts 1-4 (the act-5 Guardian
 * ends the run, so there is nothing left to carry a banner into).
 *
 * Deliberately NOT a map node and deliberately NOT a random draw. Every other
 * relic source rolls something; this one offers the same three every time
 * (guardianBannerRelics, src/data/relics.ts) so the player can plan four acts
 * ahead — and because the three are stackable, the interesting question is
 * "spread them, or commit to one axis four times", which only works if the
 * offer is known in advance.
 *
 * Structurally the Relic Shrine's select-then-claim two-step (NodeRewardScreen)
 * with the pool fixed and a note on each card saying what a repeat pick would
 * stack to.
 */
export function GuardianBannerScreen({ run, onRunChange, onContinue }: Props) {
  const [pickedRelicId, setPickedRelicId] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  const claimedRelic = claimed && pickedRelicId ? guardianBannerRelics.find((r) => r.id === pickedRelicId) ?? null : null;
  const claimedCount = claimedRelic ? run.relics.filter((id) => id === claimedRelic.id).length : 0;

  function handleClaim(relicId: string) {
    onRunChange(grantRelicReward(run, relicId));
    setClaimed(true);
  }

  return (
    <div className="node-screen node-reward-screen" style={{ '--node-rgb': NODE_TINT_GOLD } as CSSProperties}>
      <NodeSky />
      <RosterPeek run={run} />

      {!claimed && (
        <NodeHeader
          compact
          eyebrow="The Guardian Falls"
          title="Raise a Banner"
          glyph={<RunGlyph kind="relic" />}
          readout="One standard for the acts ahead. Every hero carries it — the ones you have and the ones you haven't met."
        />
      )}

      <div className="screen-scroll">
        {!claimed && (
          <div className="stage-centered">
            <div className="relic-shrine-list">
              {guardianBannerRelics.map((relic, i) => {
                // How many of this banner the team already carries, so a
                // repeat pick advertises its real total rather than making
                // the player multiply the description by hand.
                const held = run.relics.filter((id) => id === relic.id).length;
                return (
                  <RelicChoiceCard
                    key={relic.id}
                    relic={relic}
                    picked={pickedRelicId === relic.id}
                    onPick={() => setPickedRelicId(pickedRelicId === relic.id ? null : relic.id)}
                    revealDelayMs={80 + i * 90}
                    note={
                      held > 0
                        ? `Already raised ×${held} — taking it again makes ${stackedRelicName(relic, held + 1)}, ${stackedGrantSummary(relic, held + 1)} in total.`
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Replaces the picker entirely once claimed, same as the Relic
            Shrine's reveal — obtaining the banner is its own beat. */}
        {claimedRelic && (
          <div className="relic-reveal">
            <div className="relic-reveal-flash" aria-hidden="true" />
            <div className="relic-reveal-icon-badge">
              <RelicIcon relicId={claimedRelic.id} className="relic-reveal-icon" />
            </div>
            <div className="relic-reveal-eyebrow">Banner Raised</div>
            <h2 className="relic-reveal-name">{stackedRelicName(claimedRelic, claimedCount)}</h2>
            <p className="relic-reveal-desc">Team-wide {stackedGrantSummary(claimedRelic, claimedCount)}.</p>
          </div>
        )}
      </div>

      {!claimed ? (
        <button
          className="resolve-button relic-shrine-claim-button"
          disabled={!pickedRelicId}
          onClick={() => pickedRelicId && handleClaim(pickedRelicId)}
        >
          {pickedRelicId ? `Raise ${guardianBannerRelics.find((r) => r.id === pickedRelicId)?.name}` : 'Choose a banner'}
        </button>
      ) : (
        <button className="resolve-button" onClick={onContinue}>
          Continue
        </button>
      )}
    </div>
  );
}
