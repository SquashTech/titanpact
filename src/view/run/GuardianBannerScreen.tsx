import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { guardianBannerRelics } from '../../data/relics';
import type { RunState } from '../../run/state';
import { grantRelicReward } from '../../run/runProgress';
import { NodeHeader, NodeSky, NODE_TINT_GOLD } from '../shared/NodeStage';
import { RelicKindGlyph } from '../shared/relicIcons';
import { stackedGrantSummary, stackedRelicName } from '../shared/relicStacks';
import { RelicChoiceCard } from './RelicChoiceCard';
import { RelicFamilyTally } from './RelicFamilyTally';
import { RosterPeek } from './RosterPeek';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

// The Guardian's Banner (docs/run-loop.md): a fixed, never-rolled 1-of-5 after each Guardian, so
// the player can plan four acts of stacking ahead. Five standards on their bars, swaying; the
// charges on the cloth are the grant, and the claim reveals the whole hall with the new one raised.
export function GuardianBannerScreen({ run, onRunChange, onContinue }: Props) {
  const [pickedRelicId, setPickedRelicId] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    playSfx('shrine', { pitch: 0.86, delay: 0.12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickedRelic = pickedRelicId ? guardianBannerRelics.find((r) => r.id === pickedRelicId) ?? null : null;
  const claimedRelic = claimed ? pickedRelic : null;
  const counts = new Map<string, number>();
  for (const id of run.relics) counts.set(id, (counts.get(id) ?? 0) + 1);
  const claimedCount = claimedRelic ? counts.get(claimedRelic.id) ?? 0 : 0;

  function handleClaim(relicId: string) {
    playSfx('seal.strike');
    playSfx('blessing', { pitch: 0.86, delay: 0.14 });
    onRunChange(grantRelicReward(run, relicId));
    setClaimed(true);
  }

  return (
    <div className="node-screen node-reward-screen" style={{ '--node-rgb': NODE_TINT_GOLD } as CSSProperties}>
      <NodeSky />
      <RosterPeek run={run} />

      <NodeHeader
        compact
        eyebrow={claimedRelic ? 'Banner Raised' : 'The Guardian Falls'}
        title={claimedRelic ? stackedRelicName(claimedRelic, claimedCount) : 'Raise a Banner'}
        glyph={claimedRelic ? undefined : <RelicKindGlyph form="banner" />}
        readoutKey={claimedRelic ? 'raised' : pickedRelic?.id ?? 'offer'}
        readoutLive={!!claimedRelic || !!pickedRelic}
        readout={
          claimedRelic
            ? `Team-wide ${stackedGrantSummary(claimedRelic, claimedCount)}.`
            : pickedRelic
              ? `Team-wide ${stackedGrantSummary(pickedRelic, 1)}.`
              : 'One standard for the acts ahead. Every hero carries it — the ones you have and the ones you have not met.'
        }
      />

      <div className="screen-scroll">
        <div className="stage-centered">
          {!claimed ? (
            <div className="relic-pick-row is-banners">
              {guardianBannerRelics.map((relic, i) => (
                <RelicChoiceCard
                  key={relic.id}
                  relic={relic}
                  named
                  picked={pickedRelicId === relic.id}
                  onPick={() => setPickedRelicId(pickedRelicId === relic.id ? null : relic.id)}
                  revealDelayMs={80 + i * 90}
                />
              ))}
            </div>
          ) : (
            claimedRelic && (
              <>
                <div className="relic-tally-label">Your banners</div>
                <RelicFamilyTally family={guardianBannerRelics} variant="banners" counts={counts} gainedRelicId={claimedRelic.id} />
              </>
            )
          )}
        </div>
      </div>

      {!claimed ? (
        <button
          className="resolve-button relic-banner-claim-button"
          disabled={!pickedRelicId}
          onClick={() => pickedRelicId && handleClaim(pickedRelicId)}
        >
          {pickedRelic ? `Raise the ${pickedRelic.name}` : 'Choose a banner'}
        </button>
      ) : (
        <button className="resolve-button" onClick={onContinue}>
          Continue
        </button>
      )}
    </div>
  );
}
