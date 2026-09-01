import { useState, type CSSProperties } from 'react';
import { equipment } from '../../data/equipment';
import { drawableRelics } from '../../data/relics';
import type { RunState } from '../../run/state';
import type { EquipmentDefinition } from '../../run/equipment';
import { pickWeightedEquipment, rarityWeightsFor } from '../../run/equipment';
import { grantCurrencyReward, grantUpgradeReward, grantRelicReward } from '../../run/runProgress';
import { RelicIcon } from '../shared/EquipmentBox';
import { ResourceMark, RunGlyph } from '../shared/RunGlyph';
import { SectionGlyph } from '../shared/sectionIcons';
import { NodeHeader, NodeSky, NODE_TINT_ARCANE, NODE_TINT_GOLD, NODE_TINT_VITAL } from '../shared/NodeStage';
import { CacheOpening, useCacheOpening } from './CacheReveal';
import { EquipChoiceCard, EquipInspectOverlay } from './EquipChoiceCard';
import { RelicChoiceCard } from './RelicChoiceCard';
import { RosterPeek } from './RosterPeek';

export type RewardNodeType = 'currencyReward' | 'upgradeReward' | 'equipmentReward' | 'relicReward';

/** Each reward node keeps the hue it already wore as a banner — gold for the caches, XP green, the shrine's violet (see NodeStage). */
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
  /** equipmentReward only: claiming an item hands straight off to the forced-equip gate (App.tsx ForceEquipScreen) rather than resolving in place — there's no unequipped stash to claim into anymore. */
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

/**
 * Resolves the four "instant" reward node types (docs/run-loop.md): currency,
 * upgrade and equipment grant on a single tap; relic offers 3 choices.
 * Equipment claims hand off to `onClaimEquipment` (App.tsx routes that
 * through ForceEquipScreen) instead of resolving here — there's no
 * unequipped stash to claim into anymore, the player must place the item on
 * a hero or trash it before the run continues.
 */
export function NodeRewardScreen({ nodeType, run, onRunChange, onContinue, onClaimEquipment }: Props) {
  const [currencyAmount] = useState(() => 15 + Math.floor(Math.random() * 16)); // 15-30
  // Rescaled with the level-price curve (run/progression.ts levelUpCost) and
  // the per-fight payouts it forced (App.tsx trainingPointsFor): 2-3 was a
  // third of a level-1 hero's Evolution under flat pricing and a twentieth of
  // it under the curve. At 4-6 the XP option stays a live pick against 15-30
  // gold and a relic, which is the only reason the reward row is a choice.
  const [upgradeAmount] = useState(() => 4 + Math.floor(Math.random() * 3)); // 4-6
  // The cache's 3 offers roll the act's own curve (rarityWeightsFor,
  // src/run/equipment.ts) — an Act-1 cache cannot show a Legendary and an
  // Act-5 one cannot show a Common.
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

  /** The relic to show in the post-claim reveal moment below — pickedRelicId stays set through the claim, so this only needs to look it up once `claimed` flips true. */
  const claimedRelic = claimed && pickedRelicId ? relicChoices.find((r) => r.id === pickedRelicId) ?? null : null;

  /**
   * Equipment Cache only: the chest-opens-into-the-loot beat, shared with the
   * three slot caches (CacheReveal.tsx — which is also where the account of
   * what was wrong with the version that used to live in this file sits).
   * `open` swaps in the real panel, whose header/cards/button then cascade in
   * via their own `equip-cache-reveal-in` fade-up, staggered by index in the
   * equipmentChoices.map() below.
   *
   * The other three node types pass `false` and start `open` — the hook takes
   * the flag rather than the call site taking a conditional hook.
   */
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

  /** True while the screen's one bottom button is still a Claim rather than a Continue — the two never render together. */
  const showClaimButton =
    nodeType === 'currencyReward' || nodeType === 'upgradeReward'
      ? !claimed
      : nodeType === 'relicReward'
        ? !claimed && relicChoices.length > 0
        : false;

  return (
    <div className="node-screen node-reward-screen" style={{ '--node-rgb': NODE_TINT[nodeType] } as CSSProperties}>
      <NodeSky />

      {/* Every node that hands the team something carries the same corner
          roster glyph as the allocation screens — a relic is a team-wide
          passive and a piece of gear has to land on somebody, so "who have I
          got" is part of the choice here too (RosterPeek.tsx). */}
      <RosterPeek run={run} />

      {/* One header per node type, on one stage. What was here: four
          bordered banners (`.equip-cache-banner` twice, `.relic-shrine-banner`,
          each inside a `.reward-panel`) introducing content that was itself in
          boxes — see docs/visual-language.md's ninth pass. The eyebrow/title/
          readout is the same object the level-up screen uses; only the hue and
          the words change. */}
      {nodeType === 'currencyReward' && (
        <NodeHeader
          eyebrow="Spoils"
          title="Gold Cache"
          glyph={<ResourceMark label="G" />}
          readoutLive={claimed}
          readout={claimed ? `${currencyAmount}g added to the purse.` : 'A pile of gold, left where it fell.'}
        />
      )}

      {nodeType === 'upgradeReward' && (
        <NodeHeader
          eyebrow="Spoils"
          title="XP Cache"
          glyph={<ResourceMark label="XP" tone="green" />}
          readoutLive={claimed}
          readout={claimed ? `${upgradeAmount} XP added to the pool.` : 'Hard-won experience, there for the taking.'}
        />
      )}

      {nodeType === 'equipmentReward' && chestPhase === 'open' && (
        <NodeHeader
          compact
          eyebrow="A Cache Opens"
          title="Equipment Cache"
          /* The vector chest — the same shape the map node wears
             (nodeIcons.tsx `equipmentReward`) and the same one that just
             finished swinging open above this line. It was `RunGlyph
             kind="equipment"`, which is cell 97 of the pixel sheet: a sword.
             An Equipment Cache is a container, not a weapon, and the map had
             already said so. */
          glyph={<SectionGlyph name="equipment" />}
          readout="Tap a piece of gear to select it, hold to read it in full."
        />
      )}

      {nodeType === 'relicReward' && !claimed && (
        <NodeHeader
          compact
          eyebrow="A Pact Awaits"
          title="Relic Shrine"
          glyph={<RunGlyph kind="relic" />}
          readout={relicChoices.length > 0 ? 'Tap a relic to select it, then claim it.' : 'Every relic here is already yours.'}
        />
      )}

      <div className="screen-scroll">
        {/* Gold and XP have nothing to choose between, so the amount itself is
            the screen: one numeral at display size, lit by the node's own hue.
            It was a line of hint text inside a bordered banner. */}
        {(nodeType === 'currencyReward' || nodeType === 'upgradeReward') && (
          <div className={`node-hoard${claimed ? ' is-claimed' : ''}`}>
            <span className="node-hoard-amount">
              {nodeType === 'currencyReward' ? currencyAmount : upgradeAmount}
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

        {/* Deliberately its own top-level sibling rather than nested in the
            picker above (same reasoning as the Equipment Cache's chest-reveal
            split) — this replaces the pick-a-relic list entirely once a claim
            lands, so obtaining a relic reads as its own moment instead of a
            line of text where the picker used to be. */}
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

      {/* One CTA, not two. Claiming used to be a full-width gold button inside
          the panel with a second full-width gold button ("Continue") directly
          under it — two identical-looking primaries, one of which was inert.
          The bottom button is now whichever of the two the screen is actually
          waiting for. */}
      {(nodeType === 'currencyReward' || nodeType === 'upgradeReward') && !claimed && (
        <button
          className="resolve-button"
          onClick={() =>
            handleClaimInstant(
              nodeType === 'currencyReward' ? grantCurrencyReward(run, currencyAmount) : grantUpgradeReward(run, upgradeAmount)
            )
          }
        >
          {nodeType === 'currencyReward' ? `Claim ${currencyAmount}g` : `Claim ${upgradeAmount} XP`}
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
