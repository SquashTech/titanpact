import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { relics } from '../../data/relics';
import type { RunState } from '../../run/state';
import { grantRelicReward } from '../../run/runProgress';
import { RelicIcon } from '../shared/EquipmentBox';
import { NodeHeader, NodeSky, NODE_TINT_ARCANE } from '../shared/NodeStage';
import { RelicKindGlyph } from '../shared/relicIcons';
import { stackedGrantSummary, stackedRelicName } from '../shared/relicStacks';
import { RelicChoiceCard } from './RelicChoiceCard';
import { RosterPeek } from './RosterPeek';

interface Props {
  /** One id is a fixed grant (the two stat shrines); three is the 1-of-3 offer. */
  gemIds: readonly string[];
  eyebrow: string;
  title: string;
  /** Overrides the default arcane tint — the Mana Well and Regen Spring keep their own colour. */
  tint?: string;
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

// A Gem offer (docs/run-loop.md "Gems"). The same beat as the Guardian's Banner and for the same
// reason — a Gem is designed to stack, so the card says what a repeat pick totals to rather than
// filtering out what is already held.
export function GemChoiceScreen({ gemIds, eyebrow, title, tint, run, onRunChange, onContinue }: Props) {
  const offers = gemIds.map((id) => relics[id]).filter(Boolean);
  const fixed = offers.length === 1;
  const [pickedGemId, setPickedGemId] = useState<string | null>(fixed ? offers[0].id : null);
  const [claimed, setClaimed] = useState(false);

  // Empty deps on purpose: a different offer cannot arrive without a different mount.
  useEffect(() => {
    playSfx('shrine', { pitch: 1.24, delay: 0.12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickedGem = pickedGemId ? offers.find((gem) => gem.id === pickedGemId) ?? null : null;
  const claimedGem = claimed ? pickedGem : null;
  const claimedCount = claimedGem ? run.relics.filter((id) => id === claimedGem.id).length : 0;

  function handleClaim(gemId: string) {
    playSfx('blessing', { pitch: 1.24 });
    onRunChange(grantRelicReward(run, gemId));
    setClaimed(true);
  }

  return (
    <div className="node-screen node-reward-screen" style={{ '--node-rgb': tint ?? NODE_TINT_ARCANE } as CSSProperties}>
      <NodeSky />
      <RosterPeek run={run} />

      {!claimed && (
        <NodeHeader
          compact
          eyebrow={eyebrow}
          title={title}
          glyph={<RelicKindGlyph form="gem" />}
          readout={
            fixed
              ? 'A cut stone, and every hero carries what it gives.'
              : 'One stone, set for the whole team. Tap a gem to select it, then claim it.'
          }
        />
      )}

      <div className="screen-scroll">
        {!claimed && (
          <div className="stage-centered">
            <div className="relic-shrine-list">
              {offers.map((gem, i) => {
                const held = run.relics.filter((id) => id === gem.id).length;
                return (
                  <RelicChoiceCard
                    key={gem.id}
                    relic={gem}
                    picked={pickedGemId === gem.id}
                    onPick={() => setPickedGemId(!fixed && pickedGemId === gem.id ? null : gem.id)}
                    revealDelayMs={80 + i * 90}
                    note={
                      held > 0
                        ? `Already set ×${held} — taking it again makes ${stackedRelicName(gem, held + 1)}, ${stackedGrantSummary(gem, held + 1)} in total.`
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
        )}

        {claimedGem && (
          <div className="relic-reveal">
            <div className="relic-reveal-flash" aria-hidden="true" />
            <div className="relic-reveal-icon-badge">
              <RelicIcon relicId={claimedGem.id} className="relic-reveal-icon" />
            </div>
            <div className="relic-reveal-eyebrow">Gem Set</div>
            <h2 className="relic-reveal-name">{stackedRelicName(claimedGem, claimedCount)}</h2>
            <p className="relic-reveal-desc">Team-wide {stackedGrantSummary(claimedGem, claimedCount)}.</p>
          </div>
        )}
      </div>

      {!claimed ? (
        <button
          className="resolve-button relic-shrine-claim-button"
          disabled={!pickedGemId}
          onClick={() => pickedGemId && handleClaim(pickedGemId)}
        >
          {pickedGem ? `Claim ${pickedGem.name}` : 'Choose a gem'}
        </button>
      ) : (
        <button className="resolve-button" onClick={onContinue}>
          Continue
        </button>
      )}
    </div>
  );
}
