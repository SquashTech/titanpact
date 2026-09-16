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
import { statScaleFor } from '../../run/statScale';
import { ItemBox, RARITY_COLOR_VARS, RARITY_LABELS, RARITY_RGB_VARS, slotBoxes } from '../shared/EquipmentBox';
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
  // The stage holds three rows of two-column cards OR a piece with three rows of grants, not both:
  // past four heroes, or past three grants (a Crest, a Unique), the roster goes to three columns.
  const grantCount =
    Object.values(item.statGrants).filter(Boolean).length + (item.grantsStatusIds?.length ?? 0) + (item.grantsPassiveIds?.length ?? 0);
  const columns = run.roster.length > 4 || grantCount > 3 ? 3 : 2;
  const stacked = run.roster.length > columns;
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
    onRunChange(sellItem(run, itemId, equipment));
    setOutcome({ kind: 'sold', gold: sellGold });
  }

  // The title is the whole header: no readout, so its height never changes under the roster.
  function title(): string {
    if (outcome?.kind === 'sold') return `Sold for ${outcome.gold} gold`;
    if (outcome?.kind === 'merge') return 'Merged';
    if (outcome?.kind === 'take') return 'Absorbed';
    return 'New Gear';
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

      <NodeHeader compact title={title()} />

      {/* The piece's name, tier and every grant spelled out: the header says only what kind of moment this is. */}
      <div className="item-who-piece">
        <EquipChoiceCard item={item} revealDelayMs={0} labelled onInspect={() => setInspecting(true)} />
      </div>

      {/* The wrapper is a size container: the cards read their portrait size off the height the
          stage actually leaves them (styles.css), which varies with the phone and with the piece. */}
      <div className="item-who-roster">
        <HeroPickGrid count={run.roster.length} columns={columns} className={stacked ? 'is-stacked' : undefined} fill>
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
      </div>

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
          scale={statScaleFor(run)}
          onClose={() => setPreviewEntry(null)}
        />
      )}
    </div>
  );
}
