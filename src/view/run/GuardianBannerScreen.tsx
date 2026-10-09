import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { bannerArtId, guardianBannersFor } from '../../data/relics';
import { isLongWinter } from '../../run/cycles';
import type { RunState } from '../../run/state';
import { grantRelicReward } from '../../run/runProgress';
import { NodeHeader, NodeSky, NODE_TINT_GOLD } from '../shared/NodeStage';
import { RelicKindGlyph, relicColor } from '../shared/relicIcons';
import { stackedRelicName } from '../shared/relicStacks';
import { BannerGrantPlaque } from './BannerGrantPlaque';
import { RelicChoiceCard } from './RelicChoiceCard';
import { RelicFamilyTally } from './RelicFamilyTally';
import { RosterPeek } from './RosterPeek';
import { PlateButton } from '../shared/PlateButton';

/** Six is the roster cap, so a run never holds more Banners than this can name. */
const COUNT_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six'];
const countWord = (n: number) => COUNT_WORDS[n] ?? String(n);

/** The cloth each pixel standard is dyed (art/relics), which the way-forward button burns in. The stat colour relicColor reads would turn the Bulwark grey. */
const BANNER_CLOTH: Record<string, string> = {
  bannerOfTheWarcry: '#e0473c',
  bannerOfTheBulwark: '#4a8ae0',
  bannerOfTheWellspring: '#3fb35c',
};
const clothStyle = (relicId: string) => ({ '--relic-color': BANNER_CLOTH[bannerArtId(relicId)] ?? relicColor(relicId) }) as CSSProperties;

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

// The Guardian's Banner (docs/run-loop.md): a fixed, never-rolled 1-of-3 after each Guardian, so
// the player can plan four acts of stacking ahead. Three standards on their bars, swaying; the
// charges on the cloth are the grant, and the claim reveals the whole hall with the new one raised.
export function GuardianBannerScreen({ run, onRunChange, onContinue }: Props) {
  const [pickedRelicId, setPickedRelicId] = useState<string | null>(null);
  const offered = guardianBannersFor(isLongWinter(run));
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    playSfx('shrine', { pitch: 0.86, delay: 0.12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickedRelic = pickedRelicId ? offered.find((r) => r.id === pickedRelicId) ?? null : null;
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
        readoutKey={claimedRelic ? 'raised' : 'offer'}
        readoutLive={!!claimedRelic}
        readout={
          claimedRelic
            ? 'Raised for the acts ahead.'
            : 'Each standard benefits the whole roster.'
        }
      />

      <div className="screen-scroll">
        <div className="stage-centered">
          {!claimed ? (
            <>
              <div className="relic-pick-row is-banners">
                {offered.map((relic, i) => (
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
              <BannerGrantPlaque relic={pickedRelic} copies={1} />
            </>
          ) : (
            claimedRelic && (
              <>
                <BannerGrantPlaque
                  relic={claimedRelic}
                  copies={claimedCount}
                  note={claimedCount > 1 ? `${countWord(claimedCount)} raised, summed.` : undefined}
                />
                <div className="relic-tally-label">Your banners</div>
                <RelicFamilyTally family={offered} variant="banners" counts={counts} gainedRelicId={claimedRelic.id} />
              </>
            )
          )}
        </div>
      </div>

      {!claimed ? (
        <PlateButton
          style={pickedRelic ? clothStyle(pickedRelic.id) : undefined}
          tint={pickedRelic ? 'var(--relic-color)' : undefined}
          disabled={!pickedRelicId}
          onClick={() => pickedRelicId && handleClaim(pickedRelicId)}
        >
          {pickedRelic ? `Raise the ${pickedRelic.name}` : 'Choose a banner'}
        </PlateButton>
      ) : (
        <PlateButton
          style={claimedRelic ? clothStyle(claimedRelic.id) : undefined}
          tint={claimedRelic ? 'var(--relic-color)' : undefined}
          onClick={onContinue}
        >
          Continue
        </PlateButton>
      )}
    </div>
  );
}
