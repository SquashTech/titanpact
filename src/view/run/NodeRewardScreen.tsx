import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rollEquipmentDrops } from '../../data/equipment';
import type { RunState } from '../../run/state';
import { rarityWeightsFor } from '../../run/equipment';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { withSeededRandom } from '../shared/seededRandom';
import { ItemWhoScreen } from './ItemWhoScreen';
import { mapNodeIcon } from './mapNodeArt';
import { RoadScene } from './RoadEncounter';
import cacheOpen from '../../../art/cache/chest-open.png';

import type { RewardNodeType } from '../../run/map';
export type { RewardNodeType };

/** The chest on the road (ms from mount): the map tile's chest drops in, rattles, bursts open. */
const CHEST_FLASH_AT = 1300;
const CHEST_BURST_AT = CHEST_FLASH_AT + 700;
/** Held open before the piece is laid out. */
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
  /** Fixes what the chest holds, so a resumed run finds the same (docs/save-system.md D2). */
  seed: number;
}

/**
 * The Equipment Cache (docs/run-loop.md), met on the road: a chest that flashes and swings open
 * on one piece. The Gem nodes are not here: which hero takes a Gem IS
 * a decision (GemNodeScreen).
 */
export function NodeRewardScreen({ run, onRunChange, onContinue, seed }: Props) {
  return <EquipmentCache run={run} onRunChange={onRunChange} onContinue={onContinue} seed={seed} />;
}

/** Chest on the road, then the one piece it held, on the who-screen. A tap on the road skips straight to it. */
function EquipmentCache({ run, onRunChange, onContinue, seed }: Pick<Props, 'run' | 'onRunChange' | 'onContinue' | 'seed'>) {
  const [itemId] = useState(() => withSeededRandom(seed, () => rollEquipmentDrops(1, rarityWeightsFor(run.actNumber, 'cache'))[0].id));
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
          <span className="road-cache-shadow" />
          <img src={mapNodeIcon('equipmentReward')} className="road-cache-art is-closed" alt="" draggable={false} />
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

  return <ItemWhoScreen run={run} itemId={itemId} title="A Forgotten Chest" onRunChange={onRunChange} onDone={onContinue} />;
}
