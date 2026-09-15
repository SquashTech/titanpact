import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import { itemSlotsFor } from '../../run/progression';
import { absorbItem, itemReceiptFor, sellItem, type ItemReceipt } from '../../run/runProgress';
import { sellValueFor } from '../../run/shop';
import type { RosterEntry, RunState } from '../../run/state';
import { levelOf } from '../../run/growth';
import { EquipmentIcon, ItemBox, RARITY_COLOR_VARS, RARITY_LABELS, RARITY_RGB_VARS, slotBoxes } from '../shared/EquipmentBox';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { NodeHeader, NodeSky } from '../shared/NodeStage';
import { EquipChoiceCard, EquipInspectOverlay } from './EquipChoiceCard';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { MergeBurst } from './MergeBurst';
import { RosterPeek } from './RosterPeek';

interface Props {
  run: RunState;
  itemId: string;
  onRunChange: (next: RunState) => void;
  onDone: () => void;
}

/**
 * Every item arrives here (docs/gear-absorption.md §2): the piece at the top, the roster below,
 * one tap seats it and it never comes off. A card reads what the tap would do — take it into a
 * free socket, or MERGE it into the family the hero already holds, a tier up — and a hero that
 * can do neither is greyed out. Sell is the one decline. The numbers stay on the piece's own
 * card; the roster cards show sockets, since the question is who, not how much.
 */
export function ItemWhoScreen({ run, itemId, onRunChange, onDone }: Props) {
  const item = equipment[itemId];
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ kind: 'take' } | { kind: 'merge'; resultId: string } | { kind: 'sold'; gold: number } | null>(null);
  const [burst, setBurst] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  useEffect(() => {
    playSfx('discovery');
  }, []);

  const receipts = useMemo(() => {
    const out = new Map<string, ItemReceipt>();
    if (!item) return out;
    for (const entry of run.roster) {
      const hero = rosterHeroes[entry.heroId];
      if (hero) out.set(entry.rosterId, itemReceiptFor(entry, item, hero, equipment));
    }
    return out;
  }, [run.roster, item]);

  if (!item) return null;

  const done = outcome !== null;
  const sellGold = sellValueFor(item);
  const assignedEntry = assignedTo ? run.roster.find((r) => r.rosterId === assignedTo) ?? null : null;
  const assignedHero = assignedEntry ? rosterHeroes[assignedEntry.heroId] : null;
  const mergeResult = outcome?.kind === 'merge' ? equipment[outcome.resultId] : null;

  function handleGive(rosterId: string) {
    if (done) return;
    const receipt = receipts.get(rosterId);
    if (!receipt || receipt.kind === 'none') return;
    onRunChange(absorbItem(run, rosterId, itemId, equipment, rosterHeroes));
    setAssignedTo(rosterId);
    if (receipt.kind === 'merge') {
      playSfx('discovery');
      setOutcome({ kind: 'merge', resultId: receipt.resultId });
      setBurst(receipt.resultId);
    } else {
      playSfx('equip');
      setOutcome({ kind: 'take' });
    }
  }

  function handleSell() {
    if (done) return;
    playSfx('ui.select');
    onRunChange(sellItem(run, itemId, equipment));
    setOutcome({ kind: 'sold', gold: sellGold });
  }

  function readout(): string {
    if (outcome?.kind === 'sold') return `Sold for ${outcome.gold} gold.`;
    if (outcome?.kind === 'merge' && assignedHero && mergeResult) return `${assignedHero.name}'s ${mergeResult.name} is ${RARITY_LABELS[mergeResult.rarity]} now.`;
    if (outcome?.kind === 'take' && assignedHero) return `${assignedHero.name} carries the ${item.name} from here on.`;
    return 'Choose who carries it — it stays with them for the run. A hero already holding one of these merges it up a tier. Hold a hero to review a sheet, hold the piece to read it.';
  }

  function ctaFor(receipt: ItemReceipt | undefined, isAssigned: boolean) {
    if (isAssigned) return outcome?.kind === 'merge' && mergeResult ? RARITY_LABELS[mergeResult.rarity] : 'Taken';
    if (!receipt || receipt.kind === 'none') return receipt?.reason === 'ceiling' ? 'At its peak' : 'Full';
    if (receipt.kind === 'merge') return `Merge → ${RARITY_LABELS[receipt.resultRarity]}`;
    return 'Take';
  }

  return (
    <div className="node-screen shrine-screen item-who-screen" style={{ '--node-rgb': RARITY_RGB_VARS[item.rarity] } as CSSProperties}>
      <NodeSky />

      <RosterPeek run={run} />

      <NodeHeader
        compact
        eyebrow={done ? (outcome.kind === 'sold' ? 'Sold' : outcome.kind === 'merge' ? 'Merged' : 'Absorbed') : 'New Gear'}
        title={item.name}
        glyph={<EquipmentIcon item={item} />}
        readoutKey={outcome ? `${outcome.kind}:${assignedTo ?? ''}` : 'idle'}
        readoutLive={done}
        readout={readout()}
      />

      <div className="item-who-piece">
        <EquipChoiceCard item={item} revealDelayMs={0} onInspect={() => setInspecting(true)} />
      </div>

      <HeroPickGrid count={run.roster.length} fill>
        {run.roster.map((entry) => {
          const hero = rosterHeroes[entry.heroId];
          const receipt = receipts.get(entry.rosterId);
          const isAssigned = assignedTo === entry.rosterId;
          const blocked = !receipt || receipt.kind === 'none';
          const mergeIndex = receipt?.kind === 'merge' ? entry.equipment.indexOf(receipt.heldItemId) : -1;
          return (
            <HeroPickCard
              key={entry.rosterId}
              hero={hero}
              entry={entry}
              className={isAssigned ? 'is-blessed' : ''}
              disabled={blocked || (done && !isAssigned)}
              onActivate={() => handleGive(entry.rosterId)}
              onPreview={() => setPreviewEntry({ hero, entry })}
              ariaLabel={`${hero.name}, level ${levelOf(entry)} — ${ctaFor(receipt, isAssigned)}`}
              detail={
                <span className="equip-slot-row item-who-sockets">
                  {slotBoxes(entry.equipment, itemSlotsFor(hero, entry)).map((heldId, index) => (
                    <ItemBox
                      key={index}
                      item={heldId ? (equipment[heldId] ?? null) : null}
                      className={index === mergeIndex && !done ? 'target' : undefined}
                      style={
                        index === mergeIndex && receipt?.kind === 'merge' && !done
                          ? ({ '--rarity-color': RARITY_COLOR_VARS[receipt.resultRarity] } as CSSProperties)
                          : undefined
                      }
                    />
                  ))}
                </span>
              }
              overlay={isAssigned ? <span className="blessing-flare" aria-hidden="true" /> : undefined}
              ctaClassName={isAssigned ? 'is-done' : receipt?.kind === 'merge' ? 'is-accent is-merge' : blocked ? '' : 'is-accent'}
              cta={ctaFor(receipt, isAssigned)}
            />
          );
        })}
      </HeroPickGrid>

      {done ? (
        <button className="resolve-button" onClick={onDone}>
          Continue
        </button>
      ) : (
        <button className="secondary-button item-who-sell" onClick={handleSell}>
          Sell for {sellGold} gold
        </button>
      )}

      {burst && equipment[burst] && <MergeBurst result={equipment[burst]} onDone={() => setBurst(null)} />}

      {inspecting && <EquipInspectOverlay item={item} onClose={() => setInspecting(false)} />}

      {previewEntry && (
        <HeroPreviewOverlay
          hero={previewEntry.hero}
          entry={previewEntry.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          onClose={() => setPreviewEntry(null)}
        />
      )}
    </div>
  );
}
