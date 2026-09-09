import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import type { StatKey } from '../../engine/content';
import { gemForStat, gemList, type GemDefinition } from '../../data/gems';
import { grantGems } from '../../run/gems';
import type { RunState } from '../../run/state';
import { NodeHeader, NodeSky, NODE_TINT_ARCANE } from '../shared/NodeStage';
import { RelicKindGlyph } from '../shared/relicIcons';
import { STAT_FULL_LABELS } from '../shared/relicStacks';
import { RelicChoiceCard } from './RelicChoiceCard';
import { RelicFamilyTally } from './RelicFamilyTally';
import { RosterPeek } from './RosterPeek';

interface Props {
  /** The stats offered. One is a fixed grant (the Mana Well); three is the 1-of-3. */
  stats: readonly StatKey[];
  /** How many of the chosen stone the claim pays. */
  count: number;
  eyebrow: string;
  title: string;
  /** Overrides the default arcane tint — the Mana Well keeps its own colour. */
  tint?: string;
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

// A Gem offer (docs/run-loop.md "Gems"). Gems are handed out in stacks and spent per hero, so the
// claim reveals the whole SHELF with the new stones counting up on it — what a Gem is worth is
// entirely "this is my twelfth Ruby", which a single reveal card cannot say.
export function GemChoiceScreen({ stats, count, eyebrow, title, tint, run, onRunChange, onContinue }: Props) {
  const offers = stats.map((stat) => gemForStat[stat]).filter((gem): gem is GemDefinition => !!gem);
  const fixed = offers.length === 1;
  const [pickedStat, setPickedStat] = useState<StatKey | null>(fixed ? offers[0].stat : null);
  const [claimed, setClaimed] = useState(false);

  // Empty deps on purpose: a different offer cannot arrive without a different mount.
  useEffect(() => {
    playSfx('shrine', { pitch: 1.24, delay: 0.12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickedGem = pickedStat ? gemForStat[pickedStat] ?? null : null;
  const claimedGem = claimed ? pickedGem : null;
  // Counts AFTER the grant — the tally counts the gained ones back down itself for the tick.
  const counts = new Map(gemList.map((gem) => [gem.id, run.gemsEarned[gem.stat] ?? 0]));

  function handleClaim(stat: StatKey) {
    playSfx('blessing', { pitch: 1.24 });
    playSfx('discovery', { delay: 0.18 });
    onRunChange(grantGems(run, stat, count));
    setClaimed(true);
  }

  const stack = (name: string) => (count > 1 ? `${name} ×${count}` : name);

  return (
    <div className="node-screen node-reward-screen" style={{ '--node-rgb': tint ?? NODE_TINT_ARCANE } as CSSProperties}>
      <NodeSky />
      <RosterPeek run={run} />

      <NodeHeader
        compact
        eyebrow={claimedGem ? 'Gems Taken' : eyebrow}
        title={claimedGem ? stack(claimedGem.name) : title}
        glyph={claimedGem ? undefined : <RelicKindGlyph form="gem" />}
        readoutLive={!!claimedGem || !!pickedGem}
        // A picked stone states its own grant: the cards carry no words at all, so this line is
        // the only place the number a player is choosing between can be read.
        readoutKey={claimedGem ? 'set' : pickedGem?.id ?? 'offer'}
        readout={
          claimedGem
            ? `Set them on a hero from the roster — +${claimedGem.grant} ${STAT_FULL_LABELS[claimedGem.stat]} apiece.`
            : pickedGem
              ? `${stack(pickedGem.name)} — +${pickedGem.grant} ${STAT_FULL_LABELS[pickedGem.stat]} each, on whoever you pour them into.`
              : fixed
                ? 'Cut stones, and one hero the richer for them.'
                : 'One stone, as many as the seam gave up.'
        }
      />

      <div className="screen-scroll">
        <div className="stage-centered">
          {!claimed ? (
            <div className={`relic-pick-row${fixed ? ' is-single' : ''}`}>
              {offers.map((gem, i) => (
                <RelicChoiceCard
                  key={gem.id}
                  relic={{ id: gem.id, name: gem.name, description: `+${gem.grant} ${STAT_FULL_LABELS[gem.stat]} per Gem.` }}
                  picked={pickedStat === gem.stat}
                  onPick={() => setPickedStat(!fixed && pickedStat === gem.stat ? null : gem.stat)}
                  revealDelayMs={80 + i * 90}
                />
              ))}
            </div>
          ) : (
            claimedGem && (
              <>
                <div className="relic-tally-label">Your gems</div>
                <RelicFamilyTally family={gemList} variant="gems" counts={counts} gainedRelicId={claimedGem.id} gainedCount={count} />
              </>
            )
          )}
        </div>
      </div>

      {!claimed ? (
        <button
          className="resolve-button relic-shrine-claim-button"
          disabled={!pickedStat}
          onClick={() => pickedStat && handleClaim(pickedStat)}
        >
          {pickedGem ? `Take ${stack(pickedGem.name)}` : 'Choose a gem'}
        </button>
      ) : (
        <button className="resolve-button" onClick={onContinue}>
          Continue
        </button>
      )}
    </div>
  );
}
