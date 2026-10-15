import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rollEquipmentDrops } from '../../data/equipment';
import type { RunState } from '../../run/state';
import type { EquipmentDefinition } from '../../run/equipment';
import { rarityWeightsFor } from '../../run/equipment';
import { grantCurrencyReward, purseRangeFor, rollGoldRange } from '../../run/runProgress';
import { grantContract } from '../../run/recruitment';
import { NodeHeader, NodeMotes, NODE_TINT_GOLD } from '../shared/NodeStage';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { seededRandom, withSeededRandom } from '../shared/seededRandom';
import { ResourceGlyph } from '../shared/RunGlyph';
import { useCoinCount } from '../shared/useCoinCount';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import { itemSlotsFor } from '../../run/progression';
import { absorbItem, sellItem, type ItemReceipt } from '../../run/runProgress';
import { sellValueFor } from '../../run/shop';
import type { RosterEntry } from '../../run/state';
import { RARITY_COLOR_VARS, RARITY_LABELS } from '../shared/EquipmentBox';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { SellPress } from '../shared/SellPress';
import { useArmedTap } from '../shared/useArmedTap';
import { EquipChoiceCard, EquipInspectOverlay } from './EquipChoiceCard';
import { GearGood, GearSockets, Preview, ReplaceSheet, useItemReceipts, type PreviewState } from './HallCounters';
import { mapNodeIcon } from './mapNodeArt';
import { MergeBurst } from './MergeBurst';
import { RoadScene } from './RoadEncounter';
import { RosterPeek } from './RosterPeek';
import cacheOpen from '../../../art/cache/chest-open.png';

import type { RewardNodeType } from '../../run/map';
export type { RewardNodeType };

/** The chest on the road (ms from mount): the map tile's chest drops in, rattles, bursts open. */
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
  /** Fixes what the purse or the chest holds, so a resumed run finds the same (docs/save-system.md D2). */
  seed: number;
}

/**
 * The instant reward nodes and the Equipment Cache (docs/run-loop.md), all met on the road: gold
 * is a pile by the roadside that pays out as it is found, a Contract a sealed sheet picked up, and the Cache is a chest that flashes
 * and swings open before offering its 3. The Gem nodes are not here: which hero takes a Gem IS
 * a decision (GemNodeScreen).
 */
export function NodeRewardScreen({ nodeType, run, onRunChange, onContinue, seed }: Props) {
  if (nodeType === 'currencyReward') return <GoldOnTheRoad run={run} onRunChange={onRunChange} onContinue={onContinue} seed={seed} />;
  if (nodeType === 'contractReward') return <ContractOnTheRoad run={run} onRunChange={onRunChange} onContinue={onContinue} />;
  return <EquipmentCache run={run} onRunChange={onRunChange} onContinue={onContinue} seed={seed} />;
}

/** Coins out of the pouch: x drift (px), peak height (px), delay (s). Golden-ratio spread, so no two land together. */
const GOLD_COINS = Array.from({ length: 12 }, (_, i) => {
  const t = (i * 0.618034) % 1;
  return { x: Math.round(-95 + t * 190), rise: Math.round(28 + ((i * 0.382) % 1) * 36), delay: +((i * 0.035) % 0.3).toFixed(3) };
});

/** When the pouch gives (ms): the coins burst and the count starts. */
const POUCH_BURST_AT = 650;

/**
 * The purse by the road. Paid on arrival — the tap only walks on — and staged as a payout: the
 * pouch jolts, coins burst out of it, the haul counts up coin by coin, and the purse under it shows
 * what it now holds.
 */
function GoldOnTheRoad({ run, onRunChange, onContinue, seed }: Pick<Props, 'run' | 'onRunChange' | 'onContinue' | 'seed'>) {
  const [amount] = useState(() => rollGoldRange(purseRangeFor(run.actNumber), seededRandom(seed)));
  const [from] = useState(run.gold);
  const [burst, setBurst] = useState(() => prefersReducedMotion());
  const counted = useCoinCount(amount, burst);
  // Ref-guarded rather than deps-guarded: StrictMode mounts the effect twice, and the second pass
  // must not pay the player again.
  const granted = useRef(false);
  useEffect(() => {
    if (granted.current) return;
    granted.current = true;
    onRunChange(grantCurrencyReward(run, amount));
    // `run` is deliberately absent: this fires once, on arrival, against the state it arrived with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (burst) return;
    const timer = window.setTimeout(() => setBurst(true), POUCH_BURST_AT);
    return () => window.clearTimeout(timer);
  }, [burst]);

  const name = 'A Spilled Purse';
  return (
    <RoadScene className={`is-place is-arrival is-gold${burst ? ' is-burst' : ''}`} label={`${name}: +${amount} gold`} onClick={onContinue}>
      <img src={mapNodeIcon('currencyReward')} className={`road-encounter-figure is-icon road-gold-pouch${prefersReducedMotion() ? ' is-still' : ''}`} alt="" draggable={false} />
      {burst && (
        <span className="road-gold-fountain" aria-hidden="true">
          {GOLD_COINS.map((c, i) => (
            <span
              key={i}
              className="road-gold-coin"
              style={{ '--coin-x': `${c.x}px`, '--coin-rise': `${c.rise}px`, animationDelay: `${c.delay}s` } as CSSProperties}
            />
          ))}
        </span>
      )}
      <span className="road-gold-delta" aria-hidden="true">
        +{counted}
        <span className="road-gold-unit">g</span>
      </span>
      <span className="road-gold-purse" aria-hidden="true">
        <ResourceGlyph kind="gold" /> {from} <span className="road-gold-arrow">→</span> <strong>{from + counted}</strong>
      </span>
      <span className="road-encounter-label" aria-hidden="true">
        {name}
        <span className="road-encounter-more" />
      </span>
    </RoadScene>
  );
}

/** A Recruit Contract by the road. Paid on arrival like the purse; the tap only walks on. */
function ContractOnTheRoad({ run, onRunChange, onContinue }: Pick<Props, 'run' | 'onRunChange' | 'onContinue'>) {
  const [from] = useState(run.recruitContracts);
  const [burst, setBurst] = useState(() => prefersReducedMotion());
  const granted = useRef(false);
  useEffect(() => {
    if (granted.current) return;
    granted.current = true;
    onRunChange(grantContract(run));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (burst) return;
    const timer = window.setTimeout(() => {
      setBurst(true);
      playSfx('pact.bind');
    }, POUCH_BURST_AT);
    return () => window.clearTimeout(timer);
  }, [burst]);

  const name = 'A Sealed Contract';
  return (
    <RoadScene className={`is-place is-arrival is-gold is-contract${burst ? ' is-burst' : ''}`} label={`${name}: +1 Recruit Contract`} onClick={onContinue}>
      <img src={mapNodeIcon('contractReward')} className={`road-encounter-figure is-icon road-gold-pouch${prefersReducedMotion() ? ' is-still' : ''}`} alt="" draggable={false} />
      <span className="road-gold-delta" aria-hidden="true">
        +1
      </span>
      <span className="road-gold-purse" aria-hidden="true">
        <ResourceGlyph kind="contract" /> {from} <span className="road-gold-arrow">→</span> <strong>{from + 1}</strong>
      </span>
      <span className="road-encounter-label" aria-hidden="true">
        {name}
        <span className="road-encounter-more" />
      </span>
    </RoadScene>
  );
}

/** Chest on the road, then the three pieces. A tap on the road skips straight to them. */
function EquipmentCache({ run, onRunChange, onContinue, seed }: Pick<Props, 'run' | 'onRunChange' | 'onContinue' | 'seed'>) {
  const [choices] = useState<EquipmentDefinition[]>(() => withSeededRandom(seed, () => rollEquipmentDrops(3, rarityWeightsFor(run.actNumber, 'cache'))));
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

  return <CacheCounter run={run} choices={choices} onRunChange={onRunChange} onContinue={onContinue} />;
}

type CacheOutcome = { itemId: string; rosterId: string; mergeId?: string } | { itemId: string; gold: number };

/**
 * The opened chest as the Guild Hall's Gear counter (HallCounters.tsx): the roster's builds above, the
 * three pieces below, the one picked read whole between them. A hero tap seats it — the who-screen is
 * this screen — and Sell is the one decline, as on the who-screen.
 */
function CacheCounter({ run, choices, onRunChange, onContinue }: { run: RunState; choices: EquipmentDefinition[] } & Pick<Props, 'onRunChange' | 'onContinue'>) {
  const [pick, setPick] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<CacheOutcome | null>(null);
  const [inspecting, setInspecting] = useState<EquipmentDefinition | null>(null);
  const [burst, setBurst] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [replacing, setReplacing] = useState<RosterEntry | null>(null);

  const done = outcome !== null;
  const item = pick !== null ? choices[pick] : undefined;
  const receipts = useItemReceipts(run, done ? undefined : item);
  const takenBy = outcome && 'rosterId' in outcome ? outcome.rosterId : null;
  const shown = outcome && 'mergeId' in outcome && outcome.mergeId ? equipment[outcome.mergeId] : item;
  const sellGold = item ? sellValueFor(item) : 0;
  const sell = useArmedTap(() => {
    if (!item || done) return;
    playSfx('gold.coin');
    onRunChange(sellItem(run, item.id, equipment));
    setOutcome({ itemId: item.id, gold: sellGold });
  }, true);

  function handleHero(entry: RosterEntry, replaceIndex?: number) {
    if (!item || done) return;
    const receipt = receipts.get(entry.rosterId);
    if (!receipt || receipt.kind === 'none') return;
    if (receipt.kind === 'replace' && replaceIndex === undefined) {
      setReplacing(entry);
      return;
    }
    setReplacing(null);
    onRunChange(absorbItem(run, entry.rosterId, item.id, equipment, rosterHeroes, replaceIndex));
    if (receipt.kind === 'merge') {
      playSfx('discovery');
      setBurst(receipt.resultId);
      setOutcome({ itemId: item.id, rosterId: entry.rosterId, mergeId: receipt.resultId });
    } else {
      playSfx('equip');
      setOutcome({ itemId: item.id, rosterId: entry.rosterId });
    }
  }

  function ctaFor(entry: RosterEntry, receipt: ItemReceipt | undefined): string {
    const hero = rosterHeroes[entry.heroId];
    if (takenBy === entry.rosterId) return outcome && 'mergeId' in outcome && outcome.mergeId ? `${RARITY_LABELS[equipment[outcome.mergeId].rarity]}!` : 'Taken';
    if (!item || done) return `${entry.equipment.length}/${itemSlotsFor(hero, entry)}`;
    if (!receipt || receipt.kind === 'none') return receipt?.reason === 'ceiling' ? 'At its peak' : 'Full';
    if (receipt.kind === 'merge') return `Merge → ${RARITY_LABELS[receipt.resultRarity]}`;
    if (receipt.kind === 'replace') return 'Replace';
    return 'Take';
  }

  const title = !outcome ? 'Choose One' : 'gold' in outcome ? `Sold for ${outcome.gold} gold` : outcome.mergeId ? 'Merged' : 'Absorbed';

  return (
    <div className="node-screen cache-counter-screen" style={{ '--node-rgb': NODE_TINT_GOLD } as CSSProperties}>
      <span className="node-sky cache-ground" aria-hidden="true" />
      <NodeMotes count={12} />
      <RosterPeek run={run} />

      <NodeHeader compact eyebrow="A Forgotten Chest" title={title} />

      <div className="hall-counter-room is-gear is-cache">
        <HeroPickGrid count={run.roster.length} columns={run.roster.length > 4 ? 3 : 2} fill className="counter-roster">
          {run.roster.map((entry) => {
            const hero = rosterHeroes[entry.heroId];
            const receipt = receipts.get(entry.rosterId);
            const open = !!item && !done && !!receipt && receipt.kind !== 'none';
            const cta = ctaFor(entry, receipt);
            const isTaker = takenBy === entry.rosterId;
            return (
              <HeroPickCard
                key={entry.rosterId}
                hero={hero}
                entry={entry}
                disabled={(!!item && !open && !isTaker) || (done && !isTaker)}
                className={[open ? 'is-offered' : '', isTaker ? 'is-blessed' : ''].filter(Boolean).join(' ') || undefined}
                onActivate={open ? () => handleHero(entry) : () => setPreview({ hero, entry })}
                onPreview={() => setPreview({ hero, entry })}
                ariaLabel={`${hero.name} — ${cta}`}
                ctaClassName={isTaker ? 'is-done' : receipt?.kind === 'merge' && open ? 'is-accent is-merge' : open ? 'is-accent' : undefined}
                overlay={isTaker ? <span className="blessing-flare" aria-hidden="true" /> : undefined}
                detail={<GearSockets hero={hero} entry={entry} receipt={receipt} open={open} />}
                cta={cta}
              />
            );
          })}
        </HeroPickGrid>

        {/* The piece in hand, read whole, beside the three it was picked from. */}
        <div className="counter-focus">
          {shown && <EquipChoiceCard key={shown.id} item={shown} revealDelayMs={0} labelled onInspect={() => setInspecting(shown)} />}
        </div>

        <div className="counter-stock is-gear">
          {choices.map((choice, i) => (
            <GearGood
              key={choice.id}
              itemId={choice.id}
              picked={pick === i}
              isSold={done && outcome!.itemId !== choice.id}
              soldNote="Left behind"
              label={<span className="counter-good-tier" style={{ color: RARITY_COLOR_VARS[choice.rarity] }}>{RARITY_LABELS[choice.rarity]}</span>}
              onPick={() => {
                if (done) return;
                playSfx('ui.pick');
                setPick(pick === i ? null : i);
              }}
              onInspect={() => setInspecting(choice)}
            />
          ))}
        </div>
      </div>

      {done ? (
        <button className="resolve-button" onClick={onContinue}>
          Continue
        </button>
      ) : (
        <SellPress
          gold={item ? sellGold : undefined}
          purse={run.gold}
          armed={sell.armed}
          buttonRef={sell.ref}
          onClick={sell.onClick}
          emptyLabel="Choose a piece"
          className="cache-sell"
        />
      )}

      {burst && equipment[burst] && <MergeBurst result={equipment[burst]} onDone={() => setBurst(null)} />}
      {inspecting && <EquipInspectOverlay item={inspecting} onClose={() => setInspecting(null)} />}
      {preview && <Preview run={run} preview={preview} onClose={() => setPreview(null)} />}
      {replacing && <ReplaceSheet entry={replacing} onReplace={(index) => handleHero(replacing, index)} onClose={() => setReplacing(null)} />}
    </div>
  );
}
