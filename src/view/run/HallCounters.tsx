import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import { GEM_ORDER, gemAmount, shelfGemPrice, type Gem } from '../../run/gems';
import { MASTERY_CAP, MASTERY_EVOLUTION, canTakeMastery, crossesMastery } from '../../run/mastery';
import { itemSlotsFor } from '../../run/progression';
import { itemReceiptFor, type ItemReceipt } from '../../run/runProgress';
import { shopItemPrice } from '../../run/shop';
import type { RosterEntry, RunState } from '../../run/state';
import { statScaleFor } from '../../run/statScale';
import { ItemBox, ItemPiece, RARITY_COLOR_VARS, RARITY_LABELS, slotBoxes } from '../shared/EquipmentBox';
import { GemIcon, GEM_STONES } from '../shared/GemIcon';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { MasteryPips } from '../shared/MasteryPips';
import { useLongPress } from '../shared/MoveTile';
import { ResourceGlyph } from '../shared/RunGlyph';
import { overlayHost } from '../shared/overlayHost';
import { STAT_FULL_LABELS } from '../shared/relicStacks';
import { entryStatTotals } from '../shared/entryStatTotals';
import { CONFIRM_PURCHASE_FROM } from '../shared/useArmedTap';
import { EquipChoiceCard, EquipInspectOverlay } from './EquipChoiceCard';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { MergeBurst } from './MergeBurst';

// The Guild Hall's Gem and Gear counters (docs/run-loop.md "The Guild Hall"): the stock above, the
// whole roster below with what the choice reads off it — Mastery pips at the Gems, sockets at the
// Gear — so the decision is made here and not on the Roster screen. Pick a piece, then the hero:
// the purchase lands on that hero on the spot, with no who-screen after it.

const ARMED_MS = 4000;
const BURST_MS = 700;

const GEM_STAT_SHORT: Record<Gem['stat'], string> = { hp: 'HP', manaPool: 'Mana', attack: 'Atk', defense: 'Def', intelligence: 'Int', wisdom: 'Wis', speed: 'Spd' };

/** The hero a dear purchase is armed on; a second tap on the same hero pays. Lapses, and clears when the stock pick changes. */
function useArmedHero(pick: number | null) {
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => setArmed(null), [pick]);
  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(null), ARMED_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);
  return [armed, setArmed] as const;
}

function Price({ gold }: { gold: number }) {
  return (
    <span className="counter-good-price">
      <ResourceGlyph kind="gold" /> {gold}
    </span>
  );
}

interface PreviewState {
  hero: HeroDefinition;
  entry: RosterEntry;
}

function Preview({ run, preview, onClose }: { run: RunState; preview: PreviewState; onClose: () => void }) {
  return (
    <HeroPreviewOverlay
      hero={preview.hero}
      entry={preview.entry}
      equipmentLookup={equipment}
      relicIds={run.relics}
      gold={run.gold}
      scale={statScaleFor(run)}
      onClose={onClose}
    />
  );
}

interface GemCounterProps {
  run: RunState;
  gems: readonly Gem[];
  sold: readonly number[];
  /** Pays for the Gem and sets it on the hero; the landed run, or null when it could not be bought. */
  onBuy: (slot: number, rosterId: string) => RunState | null;
  /** What the pip opened (an Evolution, the mastered innate) is raised by the host over the landed run. */
  onPlaced: (rosterId: string, landed: RunState, fromMastery: number) => void;
}

export function GemCounter({ run, gems, sold, onBuy, onPlaced }: GemCounterProps) {
  const [pick, setPick] = useState<number | null>(null);
  const [armed, setArmed] = useArmedHero(pick);
  const [burst, setBurst] = useState<{ rosterId: string; key: number } | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  useEffect(() => {
    if (!burst) return;
    const timer = window.setTimeout(() => setBurst(null), BURST_MS);
    return () => window.clearTimeout(timer);
  }, [burst]);

  const gem = pick !== null && !sold.includes(pick) ? gems[pick] : null;
  const price = gem ? shelfGemPrice(gem) : 0;
  const statName = gem ? (gem.stat === 'manaPool' ? 'Mana' : STAT_FULL_LABELS[gem.stat]) : '';

  function handleHero(entry: RosterEntry) {
    if (pick === null || !gem || !canTakeMastery(entry) || run.gold < price) return;
    if (price >= CONFIRM_PURCHASE_FROM && armed !== entry.rosterId) {
      setArmed(entry.rosterId);
      return;
    }
    const landed = onBuy(pick, entry.rosterId);
    if (!landed) return;
    const milestone = crossesMastery(entry, 1, MASTERY_EVOLUTION) || crossesMastery(entry, 1, MASTERY_CAP);
    playSfx('gold.coin');
    playSfx('gem.set', { pitch: (milestone ? 1.26 : 1) * (0.9 + GEM_ORDER.indexOf(gem.stat) * 0.035), delay: 0.08 });
    setBurst({ rosterId: entry.rosterId, key: Date.now() });
    setPick(null);
    onPlaced(entry.rosterId, landed, entry.mastery);
  }

  return (
    <div className="hall-counter-room is-gems" style={gem ? ({ '--gem-color': GEM_STONES[gem.stat].tones[1] } as CSSProperties) : undefined}>
      <div className="counter-stock is-gems">
        {gems.map((g, i) => {
          const isSold = sold.includes(i);
          const cost = shelfGemPrice(g);
          return (
            <button
              key={i}
              type="button"
              className={`counter-good${pick === i ? ' is-picked' : ''}${isSold ? ' is-sold' : ''}`}
              disabled={isSold}
              onClick={() => {
                playSfx('ui.pick');
                setPick(pick === i ? null : i);
              }}
            >
              <span className="counter-good-art">
                <GemIcon stat={g.stat} size={30} large={g.points >= 10} live={pick === i} />
              </span>
              <span className="counter-good-words">
                <span className="counter-good-name">
                  +{gemAmount(g)} {GEM_STAT_SHORT[g.stat]}
                </span>
                {isSold ? <span className="counter-good-price is-note">Sold</span> : <Price gold={cost} />}
              </span>
            </button>
          );
        })}
      </div>

      <HeroPickGrid count={run.roster.length} columns={3} fill className="counter-roster">
        {run.roster.map((entry) => {
          const hero = rosterHeroes[entry.heroId];
          const eligible = canTakeMastery(entry);
          const open = !!gem && eligible && run.gold >= price;
          const evolves = crossesMastery(entry, 1, MASTERY_EVOLUTION);
          const masters = crossesMastery(entry, 1, MASTERY_CAP) && !!hero.masteredPassiveIds?.length;
          const isArmed = armed === entry.rosterId;
          const flaring = burst?.rosterId === entry.rosterId;
          const now = gem ? entryStatTotals(hero, entry, run.relics, run.gold)[gem.stat] : 0;
          const cta = !eligible
            ? 'Mastered'
            : !gem
              ? `${entry.mastery}/${MASTERY_CAP}`
              : run.gold < price
                ? 'Need gold'
                : isArmed
                  ? `Buy · ${price}g`
                  : evolves
                    ? 'Evolves!'
                    : masters
                      ? 'Masters!'
                      : `+${gemAmount(gem)} ${GEM_STAT_SHORT[gem.stat]}`;
          return (
            <HeroPickCard
              key={entry.rosterId}
              hero={hero}
              entry={entry}
              disabled={!!gem && !open}
              className={[gem && open ? 'is-offered' : '', isArmed ? 'is-armed' : '', flaring ? 'is-gem-burst' : ''].filter(Boolean).join(' ') || undefined}
              overlay={flaring ? <span key={burst!.key} className="gem-burst" aria-hidden="true" /> : undefined}
              onActivate={gem ? () => handleHero(entry) : () => setPreview({ hero, entry })}
              onPreview={() => setPreview({ hero, entry })}
              ariaLabel={`${hero.name}, Mastery ${entry.mastery} of ${MASTERY_CAP} — ${cta}`}
              ctaClassName={isArmed ? 'is-accent is-buy' : gem && open && (evolves || masters) ? 'is-accent' : gem && open ? 'is-accent' : undefined}
              detail={
                <span className="gem-card-detail">
                  {gem && (
                    <span className="gem-card-stat">
                      <span className="gem-card-label">{statName}</span>
                      <span className="gem-card-value">{now}</span>
                      {open && <span className="gem-card-gain">+{gemAmount(gem)}</span>}
                    </span>
                  )}
                  <MasteryPips mastery={entry.mastery} gain={open ? 1 : 0} />
                </span>
              }
              cta={cta}
            />
          );
        })}
      </HeroPickGrid>

      {preview && createPortal(<Preview run={run} preview={preview} onClose={() => setPreview(null)} />, overlayHost())}
    </div>
  );
}

interface GearCounterProps {
  run: RunState;
  itemIds: readonly string[];
  sold: readonly number[];
  /** Pays for the piece and seats it on the hero (a free socket, or a merge); the landed run, or null. */
  onBuy: (slot: number, rosterId: string) => RunState | null;
}

/** A piece on the Gear counter: tap picks it, hold reads it whole. */
function GearGood({ itemId, picked, isSold, onPick, onInspect }: { itemId: string; picked: boolean; isSold: boolean; onPick: () => void; onInspect: () => void }) {
  const item = equipment[itemId];
  const longPress = useLongPress(onInspect, isSold ? undefined : onPick);
  if (!item) return null;
  return (
    <button
      type="button"
      className={`counter-good is-gear${picked ? ' is-picked' : ''}${isSold ? ' is-sold' : ''}`}
      style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties}
      aria-disabled={isSold}
      data-sfx="none"
      {...longPress}
    >
      <span className="counter-good-art is-piece">
        <ItemPiece item={item} />
      </span>
      <span className="counter-good-words">
        <span className="counter-good-name">{item.name}</span>
        {isSold ? <span className="counter-good-price is-note">Sold</span> : <Price gold={shopItemPrice(item)} />}
      </span>
    </button>
  );
}

export function GearCounter({ run, itemIds, sold, onBuy }: GearCounterProps) {
  const [pick, setPick] = useState<number | null>(null);
  const [armed, setArmed] = useArmedHero(pick);
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [burst, setBurst] = useState<string | null>(null);
  const [flare, setFlare] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const item = pick !== null && !sold.includes(pick) ? equipment[itemIds[pick]] : undefined;
  const price = item ? shopItemPrice(item) : 0;

  const receipts = useMemo(() => {
    const out = new Map<string, ItemReceipt>();
    if (!item) return out;
    for (const entry of run.roster) {
      const hero = rosterHeroes[entry.heroId];
      if (hero) out.set(entry.rosterId, itemReceiptFor(entry, item, hero, equipment));
    }
    return out;
  }, [run.roster, item]);

  useEffect(() => {
    if (!flare) return;
    const timer = window.setTimeout(() => setFlare(null), BURST_MS);
    return () => window.clearTimeout(timer);
  }, [flare]);

  function handleHero(entry: RosterEntry) {
    if (pick === null || !item) return;
    const receipt = receipts.get(entry.rosterId);
    if (!receipt || receipt.kind === 'none' || run.gold < price) return;
    if (price >= CONFIRM_PURCHASE_FROM && armed !== entry.rosterId) {
      setArmed(entry.rosterId);
      return;
    }
    if (!onBuy(pick, entry.rosterId)) return;
    playSfx('gold.coin');
    if (receipt.kind === 'merge') {
      playSfx('discovery');
      setBurst(receipt.resultId);
    } else {
      playSfx('equip');
    }
    setFlare(entry.rosterId);
    setPick(null);
  }

  function ctaFor(receipt: ItemReceipt | undefined, isArmed: boolean): string {
    if (!receipt || receipt.kind === 'none') return receipt?.reason === 'ceiling' ? 'At its peak' : 'Full';
    if (run.gold < price) return 'Need gold';
    if (isArmed) return `Buy · ${price}g`;
    if (receipt.kind === 'merge') return `Merge → ${RARITY_LABELS[receipt.resultRarity]}`;
    return 'Take';
  }

  return (
    <div className="hall-counter-room is-gear">
      <div className="counter-stock is-gear">
        {itemIds.map((id, i) => (
          <GearGood
            key={i}
            itemId={id}
            picked={pick === i}
            isSold={sold.includes(i)}
            onPick={() => {
              playSfx('ui.pick');
              setPick(pick === i ? null : i);
            }}
            onInspect={() => setInspecting(id)}
          />
        ))}
      </div>

      {/* The piece in hand, read whole: name, tier and every grant spelled out. */}
      <div className="counter-focus">
        {item && <EquipChoiceCard key={item.id} item={item} revealDelayMs={0} labelled onInspect={() => setInspecting(item.id)} />}
      </div>

      <HeroPickGrid count={run.roster.length} columns={3} fill className="counter-roster">
        {run.roster.map((entry) => {
          const hero = rosterHeroes[entry.heroId];
          const receipt = receipts.get(entry.rosterId);
          const open = !!item && !!receipt && receipt.kind !== 'none' && run.gold >= price;
          const isArmed = armed === entry.rosterId;
          const mergeIndex = receipt?.kind === 'merge' ? entry.equipment.indexOf(receipt.heldItemId) : -1;
          const freeIndex = receipt?.kind === 'take' ? entry.equipment.length : -1;
          const cta = item ? ctaFor(receipt, isArmed) : `${entry.equipment.length}/${itemSlotsFor(hero, entry)}`;
          return (
            <HeroPickCard
              key={entry.rosterId}
              hero={hero}
              entry={entry}
              disabled={!!item && !open}
              className={[item && open ? 'is-offered' : '', isArmed ? 'is-armed' : '', flare === entry.rosterId ? 'is-blessed' : ''].filter(Boolean).join(' ') || undefined}
              onActivate={item ? () => handleHero(entry) : () => setPreview({ hero, entry })}
              onPreview={() => setPreview({ hero, entry })}
              ariaLabel={`${hero.name} — ${cta}`}
              ctaClassName={isArmed ? 'is-accent is-buy' : receipt?.kind === 'merge' && open ? 'is-accent is-merge' : open ? 'is-accent' : undefined}
              overlay={flare === entry.rosterId ? <span className="blessing-flare" aria-hidden="true" /> : undefined}
              detail={
                <span className="equip-slot-row item-who-sockets">
                  {slotBoxes(entry.equipment, itemSlotsFor(hero, entry)).map((heldId, index) => {
                    const target = open && (index === mergeIndex || index === freeIndex);
                    return (
                      <ItemBox
                        key={index}
                        item={heldId ? (equipment[heldId] ?? null) : null}
                        className={target ? 'target' : undefined}
                        style={
                          target && receipt?.kind === 'merge'
                            ? ({ '--rarity-color': RARITY_COLOR_VARS[receipt.resultRarity] } as CSSProperties)
                            : undefined
                        }
                      />
                    );
                  })}
                </span>
              }
              cta={cta}
            />
          );
        })}
      </HeroPickGrid>

      {/* Portalled: the counter sits inside the hall's .screen-scroll, a stacking context of its own. */}
      {createPortal(
        <>
          {burst && equipment[burst] && <MergeBurst result={equipment[burst]} onDone={() => setBurst(null)} />}
          {inspecting && equipment[inspecting] && <EquipInspectOverlay item={equipment[inspecting]} onClose={() => setInspecting(null)} />}
          {preview && <Preview run={run} preview={preview} onClose={() => setPreview(null)} />}
        </>,
        overlayHost()
      )}
    </div>
  );
}
