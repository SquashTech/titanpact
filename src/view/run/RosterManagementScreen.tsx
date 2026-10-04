import { useState, type CSSProperties } from 'react';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import { classes } from '../../data/classes';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition } from '../../engine/content';
import { MAX_ITEM_SLOTS } from '../../run/equipment';
import { chosenClass } from '../../run/classes';
import { levelOf, xpProgress } from '../../run/growth';
import { chosenEvolutionPaths, itemSlotsFor, rosterEntryTypes, formIdFor } from '../../run/progression';
import type { RunState, RosterEntry } from '../../run/state';
import { statScaleFor } from '../../run/statScale';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { ItemDetailOverlay } from '../shared/ItemDossier';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeBadge } from '../shared/TypeBadge';
import { ItemBox, slotBoxes } from '../shared/EquipmentBox';
import { MasteryPips } from '../shared/MasteryPips';
import { WoundBar, entryHp } from '../shared/WoundBar';
import { BlessingMark } from '../shared/BlessingMark';
import { playSfx } from '../../audio/sfx';

interface Props {
  run: RunState;
  onClose: () => void;
}

/**
 * The Roster: the whole screen given to the squad, six heroes standing in six alcoves with what
 * the act has left them — level, HP, form, Mastery — and their sockets underneath, and nothing to
 * do to any of it (docs/gear-absorption.md §2). Tap a hero for the full sheet, a piece for what it
 * does.
 */
export function RosterManagementScreen({ run, onClose }: Props) {
  const [inspecting, setInspecting] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const [viewedItemId, setViewedItemId] = useState<string | null>(null);

  return (
    <div
      className="log-overlay roster-sheet-overlay"
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
      <div className="log-panel roster-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="log-panel-header roster-sheet-header">
          <span>Roster</span>
          <button className="log-close-button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="roster-sheet-grid">
          {run.roster.map((entry) => {
            const hero = rosterHeroes[entry.heroId];
            return (
              <RosterSheetCard
                key={entry.rosterId}
                hero={hero}
                entry={entry}
                relicIds={run.relics}
                onInspect={() => {
                  playSfx('ui.select');
                  setInspecting({ hero, entry });
                }}
                onItem={setViewedItemId}
              />
            );
          })}
        </div>

        {/* Outside the grid, pinned to the bottom and in thumb reach; the header ✕ is where every
            other overlay puts it, but on a 780px page it is the corner furthest from the hand. */}
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
          gold={run.gold}
          scale={statScaleFor(run)}
          onClose={() => setInspecting(null)}
        />
      )}

      <ItemDetailOverlay item={viewedItemId ? (equipment[viewedItemId] ?? null) : null} onClose={() => setViewedItemId(null)} />
    </div>
  );
}

interface CardProps {
  hero: HeroDefinition;
  entry: RosterEntry;
  relicIds: readonly string[];
  onInspect: () => void;
  onItem: (itemId: string) => void;
}

/** One hero: the alcove it stands in (tap for the sheet), then its HP, Mastery and sockets. */
function RosterSheetCard({ hero, entry, relicIds, onInspect, onItem }: CardProps) {
  const level = levelOf(entry);
  const { hp, maxHp } = entryHp(hero, entry, relicIds);
  const form = chosenEvolutionPaths(progressionTable, entry).slice(-1)[0]?.name ?? null;
  const heroClass = chosenClass(classes, entry);
  const boxes = slotBoxes(entry.equipment, itemSlotsFor(hero, entry));
  const locked = Math.max(0, MAX_ITEM_SLOTS - boxes.length);
  const types = rosterEntryTypes(hero, entry);

  const label = `${hero.name}, level ${level} — view sheet`;
  const formLine = [form, heroClass?.name.replace('Class - ', '')].filter(Boolean).join(' · ');

  return (
    <div
      className={`roster-sheet-card${entry.down ? ' is-down' : ''}`}
      style={{ '--hero-color': getTypeColor(types[0]), '--hero-rgb': getTypeColorRgb(types[0]) } as CSSProperties}
    >
      <div className="roster-sheet-top">
        <button type="button" className="roster-sheet-alcove" data-sfx="none" onClick={onInspect} aria-label={label}>
          <HeroPortrait heroId={hero.id} pathId={formIdFor(entry)} className="roster-sheet-figure" />
          <span className="roster-sheet-level">
            <small>Lv</small>
            {level}
          </span>
          <span className="roster-sheet-types">
            {types.map((t) => (
              <TypeBadge key={t} type={t} iconOnly />
            ))}
          </span>
          {entry.down && <span className="roster-sheet-down">Down</span>}
          {entry.blessed && <BlessingMark className="roster-sheet-blessing" />}
          {/* The level's bar, laid along the alcove's floor. */}
          <span className="roster-sheet-xp" aria-hidden="true">
            <span style={{ width: `${Math.round(xpProgress(entry.xp) * 100)}%` }} />
          </span>
        </button>

        <div className="equip-mount roster-sheet-mount">
          {boxes.map((itemId, index) => {
            const item = itemId ? (equipment[itemId] ?? null) : null;
            return (
              <ItemBox
                key={index}
                item={item}
                onTap={item ? () => onItem(item.id) : undefined}
                onLongPress={item ? () => onItem(item.id) : undefined}
              />
            );
          })}
          {Array.from({ length: locked }, (_, i) => (
            <span key={`locked-${i}`} className="item-box is-locked" aria-hidden="true" />
          ))}
        </div>
      </div>

      <button type="button" className="roster-sheet-foot" data-sfx="none" onClick={onInspect} aria-label={label} tabIndex={-1}>
        <span className="roster-sheet-ident">
          <span className="roster-sheet-name">{hero.name}</span>
          {formLine && <span className="roster-sheet-form">{formLine}</span>}
        </span>
        <WoundBar hp={hp} maxHp={maxHp} figure className="roster-sheet-hp" />
        <MasteryPips mastery={entry.mastery} marked className="roster-sheet-mastery" />
      </button>
    </div>
  );
}
