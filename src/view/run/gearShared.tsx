import { useMemo, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import { itemSlotsFor } from '../../run/progression';
import { itemReceiptFor, type ItemReceipt } from '../../run/runProgress';
import type { EquipmentDefinition } from '../../run/equipment';
import type { RosterEntry, RunState } from '../../run/state';
import { statScaleFor } from '../../run/statScale';
import { ItemBox, ItemPiece, MergeMark, RARITY_COLOR_VARS, RARITY_LABELS, slotBoxes } from '../shared/EquipmentBox';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';

// What every screen that hands a hero a piece shares: the sockets it would land in, the sheet that
// writes one over, what each hero would do with it, and a hero's sheet read in place.

export interface PreviewState {
  hero: HeroDefinition;
  entry: RosterEntry;
}

export function Preview({ run, preview, onClose }: { run: RunState; preview: PreviewState; onClose: () => void }) {
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

/** A hero's three sockets, the one a pick would fill or merge into lit in the colour it would come out. */
export function GearSockets({ hero, entry, receipt, open }: { hero: HeroDefinition; entry: RosterEntry; receipt: ItemReceipt | undefined; open: boolean }) {
  const mergeIndex = receipt?.kind === 'merge' ? entry.equipment.indexOf(receipt.heldItemId) : -1;
  const freeIndex = receipt?.kind === 'take' ? entry.equipment.length : -1;
  return (
    <span className="equip-slot-row item-who-sockets">
      {slotBoxes(entry.equipment, itemSlotsFor(hero, entry)).map((heldId, index) => {
        const target = open && (receipt?.kind === 'replace' || index === mergeIndex || index === freeIndex);
        const merging = target && receipt?.kind === 'merge' ? receipt : null;
        return (
          <ItemBox
            key={index}
            item={heldId ? (equipment[heldId] ?? null) : null}
            className={target ? 'target' : undefined}
            style={merging ? ({ '--rarity-color': RARITY_COLOR_VARS[merging.resultRarity], '--merge-color': RARITY_COLOR_VARS[merging.resultRarity] } as CSSProperties) : undefined}
          >
            {merging && <MergeMark />}
          </ItemBox>
        );
      })}
    </span>
  );
}

/** A full hero's three pieces, one tapped to be written over. The piece is lost, so the confirm names it. */
export function ReplaceSheet({ entry, confirmSuffix, onReplace, onClose }: { entry: RosterEntry; confirmSuffix?: string; onReplace: (index: number) => void; onClose: () => void }) {
  const [chosen, setChosen] = useState<number | null>(null);
  const chosenItem = chosen !== null ? equipment[entry.equipment[chosen]] : undefined;
  return (
    <div className="log-overlay" onClick={onClose}>
      <div className="log-panel move-popup-panel replace-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="replace-sheet-title">Replace which?</div>
        <div className="replace-sheet-pieces">
          {entry.equipment.map((heldId, index) => {
            const held = equipment[heldId];
            if (!held) return null;
            return (
              <button
                key={index}
                type="button"
                className={`replace-sheet-piece${chosen === index ? ' is-chosen' : ''}`}
                style={{ '--rarity-color': RARITY_COLOR_VARS[held.rarity] } as CSSProperties}
                onClick={() => {
                  playSfx('ui.pick');
                  setChosen(index);
                }}
              >
                <span className="item-box filled">
                  <ItemPiece item={held} />
                </span>
                <span className="replace-sheet-name">{held.name}</span>
                <span className="replace-sheet-tier">{RARITY_LABELS[held.rarity]}</span>
              </button>
            );
          })}
        </div>
        <button className="resolve-button replace-sheet-confirm" disabled={chosen === null} onClick={() => chosen !== null && onReplace(chosen)}>
          {chosenItem ? `Lose ${chosenItem.name}${confirmSuffix ?? ''}` : 'Lose a piece'}
        </button>
      </div>
    </div>
  );
}

/** What every hero would do with the piece: take it, merge it, write over one, or nothing. */
export function useItemReceipts(run: RunState, item: EquipmentDefinition | undefined) {
  return useMemo(() => {
    const out = new Map<string, ItemReceipt>();
    if (!item) return out;
    for (const entry of run.roster) {
      const hero = rosterHeroes[entry.heroId];
      if (hero) out.set(entry.rosterId, itemReceiptFor(entry, item, hero, equipment));
    }
    return out;
  }, [run.roster, item]);
}
