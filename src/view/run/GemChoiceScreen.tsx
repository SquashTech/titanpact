import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { gemRelics, relics } from '../../data/relics';
import type { RunState } from '../../run/state';
import { grantRelicReward } from '../../run/runProgress';
import { NodeHeader, NodeSky, NODE_TINT_ARCANE } from '../shared/NodeStage';
import { RelicKindGlyph } from '../shared/relicIcons';
import { stackedGrantSummary, stackedRelicName } from '../shared/relicStacks';
import { RelicChoiceCard } from './RelicChoiceCard';
import { RelicFamilyTally } from './RelicFamilyTally';
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

// A Gem offer (docs/run-loop.md "Gems"). The same beat as the Guardian's Banner: a Gem is designed
// to stack, so the whole family is always offered rather than filtered down to what is unheld —
// and the claim reveals the whole SHELF, with the new stone counting up on it.
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
  // Counts AFTER the grant — the tally counts the gained one back down itself for the tick.
  const counts = new Map<string, number>();
  for (const id of run.relics) counts.set(id, (counts.get(id) ?? 0) + 1);
  const claimedCount = claimedGem ? counts.get(claimedGem.id) ?? 0 : 0;

  function handleClaim(gemId: string) {
    playSfx('blessing', { pitch: 1.24 });
    playSfx('discovery', { delay: 0.18 });
    onRunChange(grantRelicReward(run, gemId));
    setClaimed(true);
  }

  return (
    <div className="node-screen node-reward-screen" style={{ '--node-rgb': tint ?? NODE_TINT_ARCANE } as CSSProperties}>
      <NodeSky />
      <RosterPeek run={run} />

      <NodeHeader
        compact
        eyebrow={claimedGem ? 'Gem Set' : eyebrow}
        title={claimedGem ? stackedRelicName(claimedGem, claimedCount) : title}
        glyph={claimedGem ? undefined : <RelicKindGlyph form="gem" />}
        readoutLive={!!claimedGem || !!pickedGem}
        // A picked stone states its own grant: the cards carry no words at all now, so this
        // line is the only place the number a player is choosing between can be read.
        readoutKey={claimedGem ? 'set' : pickedGem?.id ?? 'offer'}
        readout={
          claimedGem
            ? `Team-wide ${stackedGrantSummary(claimedGem, claimedCount)}.`
            : pickedGem
              ? `${pickedGem.name} — team-wide ${stackedGrantSummary(pickedGem, 1)}.`
              : fixed
                ? 'A cut stone, and every hero carries what it gives.'
                : 'One stone, set for the whole team.'
        }
      />

      <div className="screen-scroll">
        <div className="stage-centered">
          {!claimed ? (
            <div className={`relic-pick-row${fixed ? ' is-single' : ''}`}>
              {offers.map((gem, i) => (
                <RelicChoiceCard
                  key={gem.id}
                  relic={gem}
                  picked={pickedGemId === gem.id}
                  onPick={() => setPickedGemId(!fixed && pickedGemId === gem.id ? null : gem.id)}
                  revealDelayMs={80 + i * 90}
                />
              ))}
            </div>
          ) : (
            claimedGem && (
              <>
                <div className="relic-tally-label">Your gems</div>
                <RelicFamilyTally family={gemRelics} counts={counts} gainedRelicId={claimedGem.id} />
              </>
            )
          )}
        </div>
      </div>

      {!claimed ? (
        <button
          className="resolve-button relic-shrine-claim-button"
          disabled={!pickedGemId}
          onClick={() => pickedGemId && handleClaim(pickedGemId)}
        >
          {pickedGem ? `Claim the ${pickedGem.name}` : 'Choose a gem'}
        </button>
      ) : (
        <button className="resolve-button" onClick={onContinue}>
          Continue
        </button>
      )}
    </div>
  );
}
