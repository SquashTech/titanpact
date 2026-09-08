import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { equipment, rollEquipmentDrops } from '../../data/equipment';
import type { RunState } from '../../run/state';
import type { EquipmentDefinition } from '../../run/equipment';
import { rarityWeightsFor } from '../../run/equipment';
import { grantCurrencyReward, grantUpgradeReward } from '../../run/runProgress';
import { ResourceGlyph } from '../shared/RunGlyph';
import { SectionGlyph } from '../shared/sectionIcons';
import { NodeHeader, NodeSky, NODE_TINT_GOLD, NODE_TINT_VITAL } from '../shared/NodeStage';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { CacheOpening, useCacheOpening } from './CacheReveal';
import { EquipChoiceCard, EquipInspectOverlay } from './EquipChoiceCard';
import { RosterPeek } from './RosterPeek';

export type RewardNodeType = 'currencyReward' | 'upgradeReward' | 'equipmentReward';

/** Flat, and deliberately under one fight's pay: the XP cache is a top-up, not a substitute for fighting. */
const UPGRADE_REWARD_XP = 2;

const NODE_TINT: Record<RewardNodeType, string> = {
  currencyReward: NODE_TINT_GOLD,
  upgradeReward: NODE_TINT_VITAL,
  equipmentReward: NODE_TINT_GOLD,
};

/** Beat before the count starts, so the room is read before it moves. */
const HOARD_LEAD_MS = 420;
const HOARD_TICK_MS = 70;
/** A 30g haul at one tick a coin would run 2.1s; past this the count strides instead. */
const HOARD_MAX_TICKS = 14;

/** Coins out of the numeral. Golden-angle scatter: stable across renders, never symmetrical, no seed. */
const COINS = Array.from({ length: 14 }, (_, i) => {
  const seed = i * 137.51;
  return {
    x: ((seed % 100) - 50) * 2.2,
    rise: 58 + ((seed * 0.37) % 74),
    size: 8 + ((seed * 0.11) % 6),
    delay: (seed * 4.3) % 560,
  };
});

/**
 * Runs `from` up to `from + amount`, one coin-strike per step. The grant itself has already landed
 * in run state by the time this counts — the animation reports it, it never withholds it, so a
 * player who taps straight past keeps every point.
 */
function useCountUp(from: number, amount: number, tick: 'gold.coin' | 'xp.orb'): { shown: number; done: boolean } {
  const [shown, setShown] = useState(from);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(from + amount);
      setDone(true);
      playSfx('gold.purse');
      return;
    }

    const steps = Math.max(1, Math.min(HOARD_MAX_TICKS, amount));
    let step = 0;
    let interval = 0;
    const lead = window.setTimeout(() => {
      interval = window.setInterval(() => {
        step += 1;
        setShown(from + Math.round((amount * step) / steps));
        playSfx(tick, { pitch: 1 + step * 0.04 });
        if (step >= steps) {
          window.clearInterval(interval);
          playSfx('gold.purse', { delay: 0.06 });
          setDone(true);
        }
      }, HOARD_TICK_MS);
    }, HOARD_LEAD_MS);

    return () => {
      window.clearTimeout(lead);
      window.clearInterval(interval);
    };
  }, [from, amount, tick]);

  return { shown, done };
}

interface HoardProps {
  kind: 'gold' | 'xp';
  amount: number;
  /** The purse (or pool) as it stood before this node paid out. */
  from: number;
}

/** The whole of a gold/XP cache: the pile, and the player's own total climbing through it. */
function Hoard({ kind, amount, from }: HoardProps) {
  const { shown, done } = useCountUp(from, amount, kind === 'gold' ? 'gold.coin' : 'xp.orb');

  return (
    <div className={`node-hoard${done ? ' is-settled' : ''}`}>
      {kind === 'gold' && (
        <div className="node-hoard-coins" aria-hidden="true">
          {COINS.map((c, i) => (
            <span
              key={i}
              className="node-coin"
              style={
                {
                  '--coin-x': `${c.x}px`,
                  '--coin-rise': `${c.rise}px`,
                  width: `${c.size}px`,
                  height: `${c.size}px`,
                  marginLeft: `${-c.size / 2}px`,
                  marginTop: `${-c.size / 2}px`,
                  animationDelay: `${HOARD_LEAD_MS + c.delay}ms`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}

      <span className="node-hoard-delta">+{kind === 'gold' ? `${amount}g` : `${amount} XP`}</span>

      <span className="node-hoard-amount">
        <ResourceGlyph kind={kind} className="node-hoard-glyph" />
        {shown}
        <span className="node-hoard-unit">{kind === 'gold' ? 'g' : 'XP'}</span>
      </span>

      <span className="node-hoard-label">{kind === 'gold' ? 'Purse' : 'Level-up pool'}</span>
    </div>
  );
}

interface Props {
  nodeType: RewardNodeType;
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
  /** equipmentReward only: a claim hands straight off to the item gate (App.tsx), which seats or bags it. */
  onClaimEquipment: (itemId: string) => void;
}

/**
 * The three instant reward nodes (docs/run-loop.md): the Equipment Cache offers 3, and gold and XP
 * pay out on arrival — there was never a decision behind their Claim button, only a tap between the
 * player and the same Continue every other node ends on (2026-09-08, per user direction).
 */
export function NodeRewardScreen({ nodeType, run, onRunChange, onContinue, onClaimEquipment }: Props) {
  const [currencyAmount] = useState(() => 15 + Math.floor(Math.random() * 16)); // 15-30
  const [equipmentChoices] = useState<EquipmentDefinition[]>(() =>
    nodeType === 'equipmentReward'
      ? rollEquipmentDrops(3, rarityWeightsFor(run.actNumber, 'standard'))
      : []
  );
  const [pickedItemId, setPickedItemId] = useState<string | null>(null);
  const [inspectItemId, setInspectItemId] = useState<string | null>(null);

  /** Equipment Cache only (CacheReveal.tsx); the other node types pass false and start `open`. */
  const chestPhase = useCacheOpening(nodeType === 'equipmentReward');

  const isInstant = nodeType === 'currencyReward' || nodeType === 'upgradeReward';
  // Read before the grant lands, so the count-up has somewhere to start from.
  const [startFrom] = useState(() => (nodeType === 'currencyReward' ? run.gold : run.levelUpPool));

  // Ref-guarded rather than deps-guarded: StrictMode mounts the effect twice, and the second pass
  // must not pay the player again.
  const granted = useRef(false);
  useEffect(() => {
    if (!isInstant || granted.current) return;
    granted.current = true;
    onRunChange(
      nodeType === 'currencyReward'
        ? grantCurrencyReward(run, currencyAmount)
        : grantUpgradeReward(run, UPGRADE_REWARD_XP)
    );
    // `run` is deliberately absent: this fires once, on arrival, against the state it arrived with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInstant, nodeType, currencyAmount]);

  return (
    <div className="node-screen node-reward-screen" style={{ '--node-rgb': NODE_TINT[nodeType] } as CSSProperties}>
      <NodeSky />

      <RosterPeek run={run} />

      {nodeType === 'currencyReward' && (
        <NodeHeader
          eyebrow="Spoils"
          title="Gold Cache"
          glyph={<ResourceGlyph kind="gold" className="node-header-resource" />}
          readout="A pile of gold, left where it fell."
        />
      )}

      {nodeType === 'upgradeReward' && (
        <NodeHeader
          eyebrow="Spoils"
          title="XP Cache"
          glyph={<ResourceGlyph kind="xp" className="node-header-resource" />}
          readout="Hard-won experience, straight into the pool."
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

      <div className="screen-scroll">
        {isInstant && (
          <Hoard
            kind={nodeType === 'currencyReward' ? 'gold' : 'xp'}
            amount={nodeType === 'currencyReward' ? currencyAmount : UPGRADE_REWARD_XP}
            from={startFrom}
          />
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
      </div>

      {nodeType === 'equipmentReward' ? (
        chestPhase === 'open' && (
          <button
            className="resolve-button equip-cache-reveal-in"
            style={{ animationDelay: `${120 + equipmentChoices.length * 90}ms` } as CSSProperties}
            disabled={!pickedItemId}
            onClick={() => pickedItemId && onClaimEquipment(pickedItemId)}
          >
            {pickedItemId ? `Claim ${equipmentChoices.find((i) => i.id === pickedItemId)?.name}` : 'Select a piece of gear'}
          </button>
        )
      ) : (
        <button className="resolve-button" onClick={onContinue}>
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
