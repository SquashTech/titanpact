import { useState } from 'react';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import type { RunState, RosterEntry } from '../../run/state';
import { statScaleFor } from '../../run/statScale';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { ItemDetailOverlay } from '../shared/ItemDossier';
import { HeroSlotCard, HeroSlotGrid } from '../shared/HeroSlotCard';
import { playSfx } from '../../audio/sfx';

interface Props {
  run: RunState;
  onClose: () => void;
}

/**
 * The Roster: the squad as six cards with their sockets underneath, and nothing to do to them
 * (docs/gear-absorption.md §2). Gear is absorbed the moment it arrives and never comes off, so
 * this is a sheet the player READS — tap a hero for the full sheet, tap a piece for what it does.
 * The carry, the bag, the merge picker and the swap sheet all left with the bag.
 */
export function RosterManagementScreen({ run, onClose }: Props) {
  const [inspecting, setInspecting] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const [viewedItemId, setViewedItemId] = useState<string | null>(null);

  return (
    <div
      className="log-overlay roster-mgmt-overlay"
      onClick={() => {
        // The long-press item popup mounts mid-gesture, so the release click's mousedown and
        // mouseup targets differ and the browser dispatches it on their common ancestor — this
        // overlay — bypassing the popup's own stopPropagation. Treat that click as closing the popup.
        if (viewedItemId) {
          setViewedItemId(null);
          return;
        }
        onClose();
      }}
    >
      <div className="log-panel roster-panel" onClick={(e) => e.stopPropagation()}>
        <div className="log-panel-header roster-panel-header">
          <span>Roster</span>
          <button className="log-close-button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="screen-scroll">
          <div className="gear-board">
            {/* Two across, three down: the roster reads as a squad at a glance rather than as a
                list to scroll, and each card gets a full card-width row underneath it for sockets. */}
            <HeroSlotGrid>
              {run.roster.map((entry) => {
                const hero = rosterHeroes[entry.heroId];
                return (
                  <HeroSlotCard
                    key={entry.rosterId}
                    hero={hero}
                    entry={entry}
                    equipmentLookup={equipment}
                    onHeadTap={() => {
                      playSfx('ui.select');
                      setInspecting({ hero, entry });
                    }}
                    headLabel={`View ${hero.name} details`}
                    slotProps={(_, item) => ({
                      onTap: item ? () => setViewedItemId(item.id) : undefined,
                      onLongPress: item ? () => setViewedItemId(item.id) : undefined,
                    })}
                  />
                );
              })}
            </HeroSlotGrid>
          </div>
        </div>

        {/* Outside the scroll, so it is pinned to the bottom of a full-height panel and always
            in thumb reach. The header ✕ stays — it is where every other overlay puts it — but
            on a 780px page it is the corner furthest from the hand doing the work. */}
        <button className="resolve-button roster-close-button" onClick={onClose}>
          Close
        </button>
      </div>

      {inspecting && (
        <HeroPreviewOverlay
          hero={inspecting.hero}
          entry={inspecting.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          scale={statScaleFor(run)}
          onClose={() => setInspecting(null)}
        />
      )}

      <ItemDetailOverlay item={viewedItemId ? (equipment[viewedItemId] ?? null) : null} onClose={() => setViewedItemId(null)} />
    </div>
  );
}
