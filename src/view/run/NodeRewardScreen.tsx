import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rollEquipmentDrops } from '../../data/equipment';
import type { RunState } from '../../run/state';
import type { EquipmentDefinition } from '../../run/equipment';
import { rarityWeightsFor } from '../../run/equipment';
import { grantCurrencyReward, purseRangeFor, rollGoldRange } from '../../run/runProgress';
import { SectionGlyph } from '../shared/sectionIcons';
import { NodeHeader, NodeSky, NODE_TINT_GOLD } from '../shared/NodeStage';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { EquipChoiceCard, EquipInspectOverlay } from './EquipChoiceCard';
import { mapNodeArt } from './mapNodeArt';
import { RoadScene } from './RoadEncounter';
import { RosterPeek } from './RosterPeek';
import chestSeal from '../../../art/cache/chest-seal.png';
import chestOpen from '../../../art/cache/chest-open.png';

export type RewardNodeType = 'currencyReward' | 'equipmentReward';

/** The chest on the road (ms from mount): it fades in, strains, then flashes and swings open. */
const CHEST_BURST_AT = 1500;
/** Held open before the pieces are laid out. */
const CHEST_OPEN_AT = CHEST_BURST_AT + 1100;

interface Props {
  nodeType: RewardNodeType;
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
  /** equipmentReward only: a claim hands straight off to the item gate (App.tsx), which seats or bags it. */
  onClaimEquipment: (itemId: string) => void;
}

/**
 * The instant reward node and the Equipment Cache (docs/run-loop.md), both met on the road: gold
 * is a pile by the roadside that pays out as it is found, and the Cache is a chest that flashes
 * and swings open before offering its 3. The Scroll nodes are not here: which hero takes a pip IS
 * a decision (ScrollNodeScreen).
 */
export function NodeRewardScreen({ nodeType, run, onRunChange, onContinue, onClaimEquipment }: Props) {
  if (nodeType === 'currencyReward') return <GoldOnTheRoad run={run} onRunChange={onRunChange} onContinue={onContinue} />;
  return <EquipmentCache run={run} onClaimEquipment={onClaimEquipment} />;
}

/** The pile, and the haul rising over it. Paid on arrival: the tap only walks on. */
function GoldOnTheRoad({ run, onRunChange, onContinue }: Pick<Props, 'run' | 'onRunChange' | 'onContinue'>) {
  const [amount] = useState(() => rollGoldRange(purseRangeFor(run.actNumber)));
  // Ref-guarded rather than deps-guarded: StrictMode mounts the effect twice, and the second pass
  // must not pay the player again.
  const granted = useRef(false);
  useEffect(() => {
    if (granted.current) return;
    granted.current = true;
    onRunChange(grantCurrencyReward(run, amount));
    playSfx('gold.coin', { delay: 0.55 });
    playSfx('gold.purse', { delay: 0.8 });
    // `run` is deliberately absent: this fires once, on arrival, against the state it arrived with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const name = 'A Spilled Purse';
  return (
    <RoadScene className="is-place is-arrival is-gold" label={`${name}: +${amount} gold`} onClick={onContinue}>
      <img src={mapNodeArt('currencyReward')} className={`road-encounter-figure${prefersReducedMotion() ? ' is-still' : ''}`} alt="" draggable={false} />
      <span className="road-gold-delta" aria-hidden="true">
        +{amount}
        <span className="road-gold-unit">g</span>
      </span>
      <span className="road-encounter-label" aria-hidden="true">
        {name}
        <span className="road-encounter-more" />
      </span>
    </RoadScene>
  );
}

/** Chest on the road, then the three pieces. A tap on the road skips straight to them. */
function EquipmentCache({ run, onClaimEquipment }: Pick<Props, 'run' | 'onClaimEquipment'>) {
  const [choices] = useState<EquipmentDefinition[]>(() => rollEquipmentDrops(3, rarityWeightsFor(run.actNumber, 'standard')));
  const [pickedItemId, setPickedItemId] = useState<string | null>(null);
  const [inspectItemId, setInspectItemId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'road' | 'burst' | 'open'>(() => (prefersReducedMotion() ? 'open' : 'road'));

  useEffect(() => {
    if (phase === 'open') return;
    const burst = window.setTimeout(() => {
      setPhase('burst');
      playSfx('cache.open');
    }, CHEST_BURST_AT);
    const open = window.setTimeout(() => setPhase('open'), CHEST_OPEN_AT);
    return () => {
      window.clearTimeout(burst);
      window.clearTimeout(open);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase !== 'open') {
    return (
      <RoadScene className={`is-place is-arrival is-chest${phase === 'burst' ? ' is-burst' : ''}`} label="A Forgotten Chest" onClick={() => setPhase('open')}>
        <span className="road-chest" style={{ '--chest-seal': `url(${chestSeal})`, '--chest-open': `url(${chestOpen})` } as CSSProperties} aria-hidden="true">
          <span className="road-chest-frames" />
        </span>
        <span className="road-chest-flash" aria-hidden="true" />
      </RoadScene>
    );
  }

  return (
    <div className="node-screen node-reward-screen" style={{ '--node-rgb': NODE_TINT_GOLD } as CSSProperties}>
      <NodeSky />
      <RosterPeek run={run} />
      <NodeHeader
        compact
        eyebrow="A Cache Opens"
        title="Equipment Cache"
        glyph={<SectionGlyph name="equipment" />}
        readout="Tap a piece of gear to select it, hold to read it in full."
      />

      <div className="screen-scroll">
        <div className="stage-centered">
          <div className="equip-cache-list">
            {choices.map((item, i) => (
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
      </div>

      <button
        className="resolve-button equip-cache-reveal-in"
        style={{ animationDelay: `${120 + choices.length * 90}ms` } as CSSProperties}
        disabled={!pickedItemId}
        onClick={() => pickedItemId && onClaimEquipment(pickedItemId)}
      >
        {pickedItemId ? `Claim ${choices.find((i) => i.id === pickedItemId)?.name}` : 'Select a piece of gear'}
      </button>

      {inspectItemId &&
        (() => {
          const item = choices.find((i) => i.id === inspectItemId);
          return item ? <EquipInspectOverlay item={item} onClose={() => setInspectItemId(null)} /> : null;
        })()}
    </div>
  );
}
