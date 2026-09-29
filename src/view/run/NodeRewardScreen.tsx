import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rollEquipmentDrops } from '../../data/equipment';
import type { RunState } from '../../run/state';
import type { EquipmentDefinition } from '../../run/equipment';
import { rarityWeightsFor } from '../../run/equipment';
import { grantCurrencyReward, purseRangeFor, rollGoldRange } from '../../run/runProgress';
import { NodeMotes, NODE_TINT_GOLD } from '../shared/NodeStage';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { EquipChoiceCard, EquipInspectOverlay } from './EquipChoiceCard';
import { mapNodeArt } from './mapNodeArt';
import { RoadScene } from './RoadEncounter';
import { RosterPeek } from './RosterPeek';
import cacheOpen from '../../../art/cache/chest-opened.png';

export type RewardNodeType = 'currencyReward' | 'equipmentReward';

/** The chest on the road (ms from mount): the map's own piece rises in, blinks white, bursts open. */
const CHEST_FLASH_AT = 1300;
const CHEST_BURST_AT = CHEST_FLASH_AT + 700;
/** Held open before the pieces are laid out. */
const CHEST_OPEN_AT = CHEST_BURST_AT + 1500;

/** Sparks off the gold as the lid gives: x offset (px), delay (s), drift (px). */
const CACHE_SPARKS = [
  [-54, 0.05, -18],
  [-30, 0.2, -6],
  [-8, 0, 4],
  [14, 0.12, 12],
  [36, 0.28, 20],
  [58, 0.08, 26],
  [-40, 0.4, -24],
  [24, 0.45, 8],
] as const;

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
  const [phase, setPhase] = useState<'road' | 'flash' | 'burst' | 'open'>(() => (prefersReducedMotion() ? 'open' : 'road'));

  // One timer a phase, so a tap that skips ahead re-times everything after it.
  useEffect(() => {
    if (phase === 'open') return;
    const next = phase === 'road' ? 'flash' : phase === 'flash' ? 'burst' : 'open';
    const wait = phase === 'road' ? CHEST_FLASH_AT : phase === 'flash' ? CHEST_BURST_AT - CHEST_FLASH_AT : CHEST_OPEN_AT - CHEST_BURST_AT;
    const timer = window.setTimeout(() => setPhase(next), wait);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === 'burst') playSfx('cache.open');
  }, [phase]);

  if (phase !== 'open') {
    return (
      <RoadScene
        className={`is-place is-arrival is-chest is-${phase}`}
        label="A Forgotten Chest"
        onClick={() => setPhase(phase === 'burst' ? 'open' : 'burst')}
      >
        <span className="road-cache" aria-hidden="true">
          <span className="road-cache-rays" />
          <img src={mapNodeArt('equipmentReward')} className="road-cache-art is-closed" alt="" draggable={false} />
          <img src={cacheOpen} className="road-cache-art is-open" alt="" draggable={false} />
          {CACHE_SPARKS.map(([x, delay, drift], i) => (
            <span
              key={i}
              className="road-cache-spark"
              style={{ '--spark-x': `${x}px`, '--spark-drift': `${drift}px`, animationDelay: `${delay}s` } as CSSProperties}
            />
          ))}
        </span>
        <span className="road-chest-flash" aria-hidden="true" />
        <span className="road-encounter-label" aria-hidden="true">
          A Forgotten Chest
          <span className="road-encounter-more" />
        </span>
      </RoadScene>
    );
  }

  return (
    <div className="node-screen rite-screen is-cache node-reward-screen" style={{ '--node-rgb': NODE_TINT_GOLD, '--rite-color': `rgb(${NODE_TINT_GOLD})` } as CSSProperties}>
      <span className="node-sky cache-ground" aria-hidden="true" />
      <NodeMotes count={16} />
      <RosterPeek run={run} />

      {/* The chest the road just opened, still giving off its light; the three pieces rise out of it. */}
      <header className="rite-head">
        <span className="rite-place">
          <span className="rite-pool" aria-hidden="true" />
          <img src={cacheOpen} className="rite-place-art" alt="" draggable={false} />
        </span>
        <span className="rite-eyebrow">A Forgotten Chest</span>
        <h2 className="rite-name">Choose One</h2>
      </header>

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
        {pickedItemId ? `Take — ${choices.find((i) => i.id === pickedItemId)?.name}` : 'Choose a piece'}
      </button>

      {inspectItemId &&
        (() => {
          const item = choices.find((i) => i.id === inspectItemId);
          return item ? <EquipInspectOverlay item={item} onClose={() => setInspectItemId(null)} /> : null;
        })()}
    </div>
  );
}
