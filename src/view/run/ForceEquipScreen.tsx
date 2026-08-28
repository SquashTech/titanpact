import { useState, type CSSProperties } from 'react';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import type { EquipmentDefinition, EquipmentSlot } from '../../run/equipment';
import { equipToRoster, RunProgressError } from '../../run/runProgress';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { NodeHeader, NodeSky } from '../shared/NodeStage';
import { StatGlyph, STAT_LABELS } from '../shared/StatBars';
import { EQUIP_SLOT_LABELS, EquipmentIcon, RARITY_COLOR_VARS, RARITY_LABELS, RARITY_RGB_VARS } from '../shared/EquipmentBox';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterPeek } from './RosterPeek';
import { passives } from '../../data/passives';
import { passiveEmoji } from '../shared/passiveIcons';
import { statuses } from '../../data/statuses';

interface Props {
  run: RunState;
  /** Item ids awaiting a decision, in order. Seeded by the caller (App.tsx) with whatever was just granted — usually one item, but a bumped item gets appended here too (see below). */
  queue: string[];
  onRunChange: (next: RunState) => void;
  onDone: () => void;
}

interface QueueEntry {
  itemId: string;
  /** True once this item has already been displaced from a hero by a prior choice this screen — changes the headline copy so the player understands why they're being asked again. */
  bumped: boolean;
}

function fmtGrant(amount: number): string {
  return amount > 0 ? `+${amount}` : `${amount}`;
}

interface ForceEquipHeroCardProps {
  hero: HeroDefinition;
  entry: RosterEntry;
  slot: EquipmentSlot;
  currentItem: EquipmentDefinition | null;
  onEquip: () => void;
  onPreview: () => void;
}

/**
 * One hero on the placement grid: the shared HeroPickCard, carrying what is
 * in that hero's matching slot right now as its detail row — the fact the
 * whole choice turns on, since equipping over a filled slot bumps the old
 * item back onto this same queue.
 *
 * A tap equips/replaces immediately; holding opens the full HeroPreviewOverlay
 * sheet first, so a player can check a hero's loadout and stats before
 * committing to bump something off them.
 */
function ForceEquipHeroCard({ hero, entry, slot, currentItem, onEquip, onPreview }: ForceEquipHeroCardProps) {
  return (
    <HeroPickCard
      hero={hero}
      entry={entry}
      onActivate={onEquip}
      onPreview={onPreview}
      ariaLabel={`${hero.name}, level ${entry.level} — ${currentItem ? `replace ${currentItem.name}` : 'equip'}`}
      detail={
        <span className={`pick-slot${currentItem ? ' filled' : ' empty'}`}>
          <EquipmentIcon item={currentItem} slot={slot} className="pick-slot-icon" />
          <span className="pick-slot-item">{currentItem ? currentItem.name : 'Empty'}</span>
        </span>
      }
      ctaClassName="is-accent"
      cta={currentItem ? 'Replace' : 'Equip'}
    />
  );
}

/**
 * Forced resolution gate (CLAUDE.md-style "instantly allocated before the run
 * continues", same pattern as LevelUpScreen): every piece of equipment
 * obtained must be equipped to a hero or trashed before the run advances —
 * there is no unequipped stash to defer the choice into anymore (per user
 * direction, replacing the old RosterManagementScreen inventory). Equipping
 * onto a hero that already has an item in that slot bumps the old item back
 * onto the front of this same queue, so the player resolves it too before
 * Continue is possible — recursing until every displaced item has a home or
 * is trashed.
 */
export function ForceEquipScreen({ run, queue: initialQueue, onRunChange, onDone }: Props) {
  const [queue, setQueue] = useState<QueueEntry[]>(() => initialQueue.map((itemId) => ({ itemId, bumped: false })));
  const [confirmTrash, setConfirmTrash] = useState(false);
  /** Long-press-triggered full hero sheet (HeroPreviewOverlay) — lets the player check a hero's current loadout before bumping something off them. */
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  const current = queue[0];
  const itemLookup = current ? equipment[current.itemId] : undefined;

  if (!current || !itemLookup) {
    onDone();
    return null;
  }
  // Reassigned to a definitely-EquipmentDefinition-typed binding so the
  // closures below (handleEquip et al.) don't need a redundant narrowing
  // check on every use — TS can't carry the guard above's narrowing into a
  // function declared after it.
  const item = itemLookup;

  function advance(nextQueue: QueueEntry[]) {
    setQueue(nextQueue);
    setConfirmTrash(false);
    if (nextQueue.length === 0) onDone();
  }

  function handleEquip(rosterId: string) {
    try {
      const { run: nextRun, bumpedItemId } = equipToRoster(run, rosterId, item.id, equipment);
      onRunChange(nextRun);
      const rest = queue.slice(1);
      advance(bumpedItemId ? [...rest, { itemId: bumpedItemId, bumped: true }] : rest);
    } catch (err) {
      if (!(err instanceof RunProgressError)) throw err;
    }
  }

  function handleTrash() {
    advance(queue.slice(1));
  }

  const grants = Object.entries(item.statGrants) as [StatKey, number][];
  const grantedPassives = item.grantsPassiveIds ?? [];
  const grantedStatuses = item.grantsStatusIds ?? [];

  return (
    <div
      className="node-screen force-equip-screen"
      style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity], '--node-rgb': RARITY_RGB_VARS[item.rarity] } as CSSProperties}
    >
      {/* The whole screen takes the drop's tier colour — a mythic find and a
          common one no longer arrive in the same room. */}
      <NodeSky />

      <RosterPeek run={run} />

      {/* The item, unboxed. What was here: `.equip-spotlight`, a bordered,
          glowing, rarity-rimmed card carrying the icon, the name, the rarity
          line and every stat chip — a container around the one thing on the
          screen you cannot act on, sitting above the six things you can (see
          docs/visual-language.md's ninth pass). The icon is now the header's
          art and the name is its title. */}
      <NodeHeader
        compact
        eyebrow={current.bumped ? 'Needs a New Home' : 'New Equipment'}
        art={<EquipmentIcon item={item} slot={item.slot} className="equip-spotlight-icon" />}
        title={item.name}
        readout={`${RARITY_LABELS[item.rarity]} · ${EQUIP_SLOT_LABELS[item.slot]}${
          current.bumped ? ' — unequipped; give it to another hero, or trash it' : ''
        }`}
      />

      {/* Header → what the thing does → the roster → the CTA, the same four
          bands in the same order as the Level Up screen (2026-08-28 pass).
          This used to be a `.screen-scroll > .bottom-pinned` stack, which put
          the grid at a different height on this screen than on every other
          pick-a-hero screen depending on how much the item had to say about
          itself. The effects block scrolls inside its own band instead, so
          the figures always start at the same place. */}
      <div className="node-item-effects">
        {grants.some(([, amount]) => amount) && (
          <div className="detail-modifier-list">
            {grants
              .filter(([, amount]) => amount)
              .map(([stat, amount]) => (
                <span key={stat} className={`detail-modifier-chip ${amount > 0 ? 'stat-buff' : 'stat-debuff'}`}>
                  <StatGlyph stat={stat} tone="inherit" /> {STAT_LABELS[stat]} {fmtGrant(amount)}
                </span>
              ))}
          </div>
        )}
        {/* Full passive/status description (not just the "Grants: Name"
            chip used elsewhere) — the more economical hero grid below
            frees up room to spell out exactly what the item does. */}
        {(grantedPassives.length > 0 || grantedStatuses.length > 0) && (
          <div className="equip-spotlight-passives">
            {grantedPassives.map((passiveId) => {
              const def = passives[passiveId];
              if (!def) return null;
              return (
                <div key={passiveId} className="equip-spotlight-passive">
                  <span className="equip-spotlight-passive-name">
                    {passiveEmoji[passiveId] ? `${passiveEmoji[passiveId]} ` : ''}
                    {def.name}
                  </span>
                  <span className="equip-spotlight-passive-desc">{def.description}</span>
                </div>
              );
            })}
            {grantedStatuses.map(({ statusId, magnitude }) => {
              const def = statuses[statusId];
              if (!def) return null;
              return (
                <div key={statusId} className="equip-spotlight-passive">
                  <span className="equip-spotlight-passive-name">
                    {def.name} +{magnitude}
                  </span>
                  <span className="equip-spotlight-passive-desc">{def.description}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <HeroPickGrid count={run.roster.length} fill>
        {run.roster.map((entry) => {
          const hero = heroes[entry.heroId];
          const currentId = entry.equipment[item.slot];
          const currentItem = currentId ? equipment[currentId] : null;
          return (
            <ForceEquipHeroCard
              key={entry.rosterId}
              hero={hero}
              entry={entry}
              slot={item.slot}
              currentItem={currentItem}
              onEquip={() => handleEquip(entry.rosterId)}
              onPreview={() => setPreviewEntry({ hero, entry })}
            />
          );
        })}
      </HeroPickGrid>

      <button className="secondary-button trash-button" onClick={() => setConfirmTrash(true)}>
        🗑️ Trash {item.name}
      </button>

      {confirmTrash && (
        <div className="log-overlay" onClick={() => setConfirmTrash(false)}>
          <div className="log-panel" onClick={(e) => e.stopPropagation()}>
            <div className="log-panel-header">
              <span>Confirm Trash</span>
            </div>
            <p className="hint">{`Trash ${item.name}? This cannot be undone — it's gone for good.`}</p>
            <div className="reward-panel-actions">
              <button className="secondary-button" onClick={() => setConfirmTrash(false)}>
                Cancel
              </button>
              <button className="resolve-button" onClick={handleTrash}>
                Trash It
              </button>
            </div>
          </div>
        </div>
      )}

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
