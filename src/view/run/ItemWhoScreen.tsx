import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import { itemSlotsFor } from '../../run/progression';
import { absorbItem, sellItem, type ItemReceipt } from '../../run/runProgress';
import { sellValueFor } from '../../run/shop';
import type { RosterEntry, RunState } from '../../run/state';
import { RARITY_COLOR_VARS, RARITY_LABELS, RARITY_RGB_VARS } from '../shared/EquipmentBox';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { NodeHeader, NodeSky } from '../shared/NodeStage';
import { SellPress } from '../shared/SellPress';
import { useArmedTap } from '../shared/useArmedTap';
import { EquipChoiceCard, EquipInspectOverlay } from './EquipChoiceCard';
import { GearGood, GearSockets, Preview, ReplaceSheet, useItemReceipts, type PreviewState } from './HallCounters';
import { ItemFitChips } from './ItemFitChips';
import { MergeBurst } from './MergeBurst';
import { RosterPeek } from './RosterPeek';

interface Props {
  run: RunState;
  itemId: string;
  /** The pieces queued behind this one (a Loot Pile hands over several), shown dim in the row. */
  upcoming?: readonly string[];
  onRunChange: (next: RunState) => void;
  onDone: () => void;
  /** Only these heroes may take it — a patron's student (PatronNodeScreen). */
  onlyRosterIds?: readonly string[];
  /** Applied to the run as the piece is taken, before it is handed back: a patron records its student. */
  afterTake?: (run: RunState, rosterId: string) => RunState;
  /** A patron's piece, or a gift: the title before anything is chosen. */
  title?: string;
}

/**
 * Every item that arrives off a fight or a Loot Pile lands here (docs/gear-absorption.md §2), laid
 * out as the Guild Hall's Gear counter: the roster's builds above, the piece read whole below them.
 * A hero tap seats it — into a free socket, MERGED into the family the hero holds a tier up, or over
 * a piece a full hero picks to lose. Sell is the one decline.
 */
export function ItemWhoScreen({ run, itemId, upcoming = [], onRunChange, onDone, onlyRosterIds, afterTake, title: arrivalTitle }: Props) {
  const item = equipment[itemId];
  const [outcome, setOutcome] = useState<{ rosterId: string; mergeId?: string; replaced?: boolean } | { gold: number } | null>(null);
  const [burst, setBurst] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [replacing, setReplacing] = useState<RosterEntry | null>(null);

  useEffect(() => {
    playSfx('discovery');
  }, []);

  const done = outcome !== null;
  const receipts = useItemReceipts(run, done ? undefined : item);
  const sellGold = item ? sellValueFor(item) : 0;
  const sell = useArmedTap(() => {
    if (!item || done) return;
    playSfx('ui.confirm');
    onRunChange(sellItem(run, itemId, equipment));
    setOutcome({ gold: sellGold });
  }, true);

  if (!item) return null;

  const takenBy = outcome && 'rosterId' in outcome ? outcome.rosterId : null;
  const mergeResult = outcome && 'mergeId' in outcome && outcome.mergeId ? equipment[outcome.mergeId] : null;
  // Once merged, the card is the piece the hero now wears, not the one that arrived.
  const shownItem = mergeResult ?? item;

  function handleGive(entry: RosterEntry, replaceIndex?: number) {
    if (done) return;
    const receipt = receipts.get(entry.rosterId);
    if (!receipt || receipt.kind === 'none') return;
    if (receipt.kind === 'replace' && replaceIndex === undefined) {
      setReplacing(entry);
      return;
    }
    setReplacing(null);
    const taken = absorbItem(run, entry.rosterId, itemId, equipment, rosterHeroes, replaceIndex);
    onRunChange(afterTake ? afterTake(taken, entry.rosterId) : taken);
    if (receipt.kind === 'merge') {
      playSfx('discovery');
      setBurst(receipt.resultId);
      setOutcome({ rosterId: entry.rosterId, mergeId: receipt.resultId });
    } else {
      playSfx('equip');
      setOutcome({ rosterId: entry.rosterId, replaced: receipt.kind === 'replace' });
    }
  }

  function ctaFor(entry: RosterEntry, receipt: ItemReceipt | undefined): string {
    if (takenBy === entry.rosterId) return mergeResult ? `${RARITY_LABELS[mergeResult.rarity]}!` : 'Taken';
    if (done) return `${entry.equipment.length}/${itemSlotsFor(rosterHeroes[entry.heroId], entry)}`;
    if (!receipt || receipt.kind === 'none') return receipt?.reason === 'ceiling' ? 'At its peak' : 'Full';
    if (receipt.kind === 'merge') return `Merge → ${RARITY_LABELS[receipt.resultRarity]}`;
    if (receipt.kind === 'replace') return 'Replace';
    return 'Take';
  }

  // The title is the whole header: no readout, so its height never changes under the roster.
  const title = !outcome ? (arrivalTitle ?? 'New Gear') : 'gold' in outcome ? `Sold for ${outcome.gold} gold` : mergeResult ? 'Merged' : outcome.replaced ? 'Replaced' : 'Absorbed';

  return (
    <div className="node-screen item-who-screen" style={{ '--node-rgb': RARITY_RGB_VARS[item.rarity] } as CSSProperties}>
      <NodeSky />
      <RosterPeek run={run} />

      <NodeHeader compact title={title} />

      <div className="hall-counter-room is-gear is-who">
        <HeroPickGrid count={run.roster.length} columns={run.roster.length > 4 ? 3 : 2} fill className="counter-roster">
          {run.roster.map((entry) => {
            const hero = rosterHeroes[entry.heroId];
            const receipt = receipts.get(entry.rosterId);
            const open = !done && !!receipt && receipt.kind !== 'none' && (!onlyRosterIds || onlyRosterIds.includes(entry.rosterId));
            const isTaker = takenBy === entry.rosterId;
            const cta = ctaFor(entry, receipt);
            return (
              <HeroPickCard
                key={entry.rosterId}
                hero={hero}
                entry={entry}
                disabled={!open && !isTaker}
                className={[open ? 'is-offered' : '', isTaker ? 'is-blessed' : ''].filter(Boolean).join(' ') || undefined}
                onActivate={open ? () => handleGive(entry) : () => setPreview({ hero, entry })}
                onPreview={() => setPreview({ hero, entry })}
                ariaLabel={`${hero.name} — ${cta}`}
                ctaClassName={isTaker ? 'is-done' : receipt?.kind === 'merge' && open ? 'is-accent is-merge' : open ? 'is-accent' : undefined}
                overlay={isTaker ? <span className="blessing-flare" aria-hidden="true" /> : undefined}
                detail={
                  <>
                    <ItemFitChips run={run} hero={hero} entry={entry} item={item} />
                    <GearSockets hero={hero} entry={entry} receipt={receipt} open={open} />
                  </>
                }
                cta={cta}
              />
            );
          })}
        </HeroPickGrid>

        <div className="counter-focus">
          <EquipChoiceCard key={shownItem.id} item={shownItem} revealDelayMs={0} labelled showcase onInspect={() => setInspecting(shownItem.id)} />
        </div>

        {/* A Loot Pile's haul: this piece lit, the ones still to come beside it. */}
        {upcoming.length > 0 && (
          <div className="counter-stock is-gear">
            {[itemId, ...upcoming].map((id, i) => (
              <GearGood
                key={`${id}:${i}`}
                itemId={id}
                picked={i === 0}
                isSold={i > 0}
                soldNote="Next"
                label={<span className="counter-good-tier" style={{ color: RARITY_COLOR_VARS[equipment[id].rarity] }}>{RARITY_LABELS[equipment[id].rarity]}</span>}
                onPick={() => {}}
                onInspect={() => setInspecting(id)}
              />
            ))}
          </div>
        )}
      </div>

      {done ? (
        <button className="resolve-button" onClick={onDone}>
          Continue
        </button>
      ) : (
        <SellPress gold={sellGold} purse={run.gold} armed={sell.armed} buttonRef={sell.ref} onClick={sell.onClick} className="item-who-sell" />
      )}

      {burst && equipment[burst] && <MergeBurst result={equipment[burst]} onDone={() => setBurst(null)} />}
      {inspecting && equipment[inspecting] && <EquipInspectOverlay item={equipment[inspecting]} onClose={() => setInspecting(null)} />}
      {preview && <Preview run={run} preview={preview} onClose={() => setPreview(null)} />}
      {replacing && <ReplaceSheet entry={replacing} onReplace={(index) => handleGive(replacing, index)} onClose={() => setReplacing(null)} />}
    </div>
  );
}
