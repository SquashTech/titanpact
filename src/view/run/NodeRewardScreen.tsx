import { useState, type CSSProperties } from 'react';
import { equipment } from '../../data/equipment';
import { drawableRelics } from '../../data/relics';
import type { RunState } from '../../run/state';
import type { EquipmentDefinition } from '../../run/equipment';
import { pickWeightedEquipment, rarityWeightsFor } from '../../run/equipment';
import { grantCurrencyReward, grantUpgradeReward, grantRelicReward } from '../../run/runProgress';
import { RelicIcon } from '../shared/EquipmentBox';
import { ResourceGlyph } from '../shared/RunGlyph';
import { RelicKindGlyph } from '../shared/relicIcons';
import { SectionGlyph } from '../shared/sectionIcons';
import { NodeHeader, NodeSky, NODE_TINT_ARCANE, NODE_TINT_GOLD, NODE_TINT_VITAL } from '../shared/NodeStage';
import { CacheOpening, useCacheOpening } from './CacheReveal';
import { EquipChoiceCard, EquipInspectOverlay } from './EquipChoiceCard';
import { RelicChoiceCard } from './RelicChoiceCard';
import { RosterPeek } from './RosterPeek';

export type RewardNodeType = 'currencyReward' | 'upgradeReward' | 'equipmentReward' | 'relicReward';

/** Flat, and deliberately under one fight's pay: the XP cache is a top-up, not a substitute for fighting. */
const UPGRADE_REWARD_XP = 2;

const NODE_TINT: Record<RewardNodeType, string> = {
  currencyReward: NODE_TINT_GOLD,
  upgradeReward: NODE_TINT_VITAL,
  equipmentReward: NODE_TINT_GOLD,
  relicReward: NODE_TINT_ARCANE,
};

interface Props {
  nodeType: RewardNodeType;
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
  /** equipmentReward only: a claim hands straight off to the forced-equip gate (App.tsx) — there is no unequipped stash. */
  onClaimEquipment: (itemId: string) => void;
}

function pickRandom<T>(pool: readonly T[], count: number): T[] {
  const remaining = [...pool];
  const picked: T[] = [];
  while (picked.length < Math.min(count, remaining.length)) {
    picked.push(remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0]);
  }
  return picked;
}

/** The four instant reward nodes (docs/run-loop.md): gold, XP and equipment grant on one tap; the relic shrine offers 3. */
export function NodeRewardScreen({ nodeType, run, onRunChange, onContinue, onClaimEquipment }: Props) {
  const [currencyAmount] = useState(() => 15 + Math.floor(Math.random() * 16)); // 15-30
  const [equipmentChoices] = useState<EquipmentDefinition[]>(() =>
    nodeType === 'equipmentReward'
      ? pickWeightedEquipment(Object.values(equipment), 3, rarityWeightsFor(run.actNumber, 'standard'))
      : []
  );
  const [relicChoices] = useState(() =>
    nodeType === 'relicReward' ? pickRandom(drawableRelics.filter((r) => !run.relics.includes(r.id)), 3) : []
  );

  const [pickedItemId, setPickedItemId] = useState<string | null>(null);
  const [inspectItemId, setInspectItemId] = useState<string | null>(null);
  const [pickedRelicId, setPickedRelicId] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  const claimedRelic = claimed && pickedRelicId ? relicChoices.find((r) => r.id === pickedRelicId) ?? null : null;

  /** Equipment Cache only (CacheReveal.tsx); the other node types pass false and start `open`. */
  const chestPhase = useCacheOpening(nodeType === 'equipmentReward');

  function handleClaimInstant(next: RunState) {
    onRunChange(next);
    setClaimed(true);
  }

  function handleClaimRelic(relicId: string) {
    onRunChange(grantRelicReward(run, relicId));
    setClaimed(true);
  }

  const canContinue = claimed || (nodeType === 'relicReward' && relicChoices.length === 0);

  /** True while the one bottom button is still a Claim rather than a Continue. */
  const showClaimButton =
    nodeType === 'currencyReward' || nodeType === 'upgradeReward'
      ? !claimed
      : nodeType === 'relicReward'
        ? !claimed && relicChoices.length > 0
        : false;

  return (
    <div className="node-screen node-reward-screen" style={{ '--node-rgb': NODE_TINT[nodeType] } as CSSProperties}>
      <NodeSky />

      <RosterPeek run={run} />

      {nodeType === 'currencyReward' && (
        <NodeHeader
          eyebrow="Spoils"
          title="Gold Cache"
          glyph={<ResourceGlyph kind="gold" className="node-header-resource" />}
          readoutLive={claimed}
          readout={claimed ? `${currencyAmount}g added to the purse.` : 'A pile of gold, left where it fell.'}
        />
      )}

      {nodeType === 'upgradeReward' && (
        <NodeHeader
          eyebrow="Spoils"
          title="XP Cache"
          glyph={<ResourceGlyph kind="xp" className="node-header-resource" />}
          readoutLive={claimed}
          readout={claimed ? `${UPGRADE_REWARD_XP} XP added to the pool.` : 'Hard-won experience, there for the taking.'}
        />
      )}

      {nodeType === 'equipmentReward' && chestPhase === 'open' && (
        <NodeHeader
          compact
          eyebrow="A Cache Opens"
          title="Equipment Cache"
          glyph={<SectionGlyph name="equipment" />}
          readout="Tap a piece of gear to select it, hold to read it in full."
        />
      )}

      {nodeType === 'relicReward' && !claimed && (
        <NodeHeader
          compact
          eyebrow="A Pact Awaits"
          title="Relic Shrine"
          glyph={<RelicKindGlyph form="crystal" />}
          readout={relicChoices.length > 0 ? 'Tap a relic to select it, then claim it.' : 'Every relic here is already yours.'}
        />
      )}

      <div className="screen-scroll">
        {(nodeType === 'currencyReward' || nodeType === 'upgradeReward') && (
          <div className={`node-hoard${claimed ? ' is-claimed' : ''}`}>
            <span className="node-hoard-amount">
              {nodeType === 'currencyReward' ? currencyAmount : UPGRADE_REWARD_XP}
              <span className="node-hoard-unit">{nodeType === 'currencyReward' ? 'g' : 'XP'}</span>
            </span>
          </div>
        )}

        {nodeType === 'equipmentReward' && chestPhase !== 'open' && (
          <CacheOpening phase={chestPhase} caption="Three ways this could go." />
        )}

        {nodeType === 'equipmentReward' && chestPhase === 'open' && (
          <div className="stage-centered">
            <div className="equip-cache-list">
              {equipmentChoices.map((item, i) => (
                <EquipChoiceCard
                  key={item.id}
                  item={item}
                  picked={pickedItemId === item.id}
                  onPick={() => setPickedItemId(pickedItemId === item.id ? null : item.id)}
                  onInspect={() => setInspectItemId(item.id)}
                  revealDelayMs={120 + i * 90}
                />
              ))}
            </div>
          </div>
        )}

        {nodeType === 'relicReward' && !claimed && relicChoices.length > 0 && (
          <div className="stage-centered">
            <div className="relic-shrine-list">
              {relicChoices.map((relic, i) => (
                <RelicChoiceCard
                  key={relic.id}
                  relic={relic}
                  picked={pickedRelicId === relic.id}
                  onPick={() => setPickedRelicId(pickedRelicId === relic.id ? null : relic.id)}
                  revealDelayMs={80 + i * 90}
                />
              ))}
            </div>
          </div>
        )}

        {nodeType === 'relicReward' && claimedRelic && (
          <div className="relic-reveal">
            <div className="relic-reveal-flash" aria-hidden="true" />
            <div className="relic-reveal-icon-badge">
              <RelicIcon relicId={claimedRelic.id} className="relic-reveal-icon" />
            </div>
            <div className="relic-reveal-eyebrow">Relic Claimed</div>
            <h2 className="relic-reveal-name">{claimedRelic.name}</h2>
            {claimedRelic.description && <p className="relic-reveal-desc">{claimedRelic.description}</p>}
          </div>
        )}
      </div>

      {(nodeType === 'currencyReward' || nodeType === 'upgradeReward') && !claimed && (
        <button
          className="resolve-button"
          onClick={() =>
            handleClaimInstant(
              nodeType === 'currencyReward' ? grantCurrencyReward(run, currencyAmount) : grantUpgradeReward(run, UPGRADE_REWARD_XP)
            )
          }
        >
          {nodeType === 'currencyReward' ? `Claim ${currencyAmount}g` : `Claim ${UPGRADE_REWARD_XP} XP`}
        </button>
      )}

      {nodeType === 'equipmentReward' && chestPhase === 'open' && (
        <button
          className="resolve-button equip-cache-reveal-in"
          style={{ animationDelay: `${120 + equipmentChoices.length * 90}ms` } as CSSProperties}
          disabled={!pickedItemId}
          onClick={() => pickedItemId && onClaimEquipment(pickedItemId)}
        >
          {pickedItemId ? `Claim ${equipmentChoices.find((i) => i.id === pickedItemId)?.name}` : 'Select a piece of gear'}
        </button>
      )}

      {nodeType === 'relicReward' && !claimed && relicChoices.length > 0 && (
        <button
          className="resolve-button relic-shrine-claim-button"
          disabled={!pickedRelicId}
          onClick={() => pickedRelicId && handleClaimRelic(pickedRelicId)}
        >
          {pickedRelicId ? `Claim ${relicChoices.find((r) => r.id === pickedRelicId)?.name}` : 'Select a relic'}
        </button>
      )}

      {nodeType !== 'equipmentReward' && !showClaimButton && (
        <button className="resolve-button" disabled={!canContinue} onClick={onContinue}>
          Continue
        </button>
      )}

      {inspectItemId &&
        (() => {
          const item = equipmentChoices.find((i) => i.id === inspectItemId);
          return item ? <EquipInspectOverlay item={item} onClose={() => setInspectItemId(null)} /> : null;
        })()}
    </div>
  );
}
