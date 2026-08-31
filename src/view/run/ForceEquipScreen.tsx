import { useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import { equipToRoster, RunProgressError } from '../../run/runProgress';
import { NodeHeader, NodeSky } from '../shared/NodeStage';
import { StatGlyph, STAT_LABELS } from '../shared/StatBars';
import { EQUIP_SLOT_LABELS, EquipmentEffectList, EquipmentIcon, RARITY_COLOR_VARS, RARITY_LABELS, RARITY_RGB_VARS } from '../shared/EquipmentBox';
import { EquipCompareRow } from './EquipCompareRow';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterPeek } from './RosterPeek';

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

/**
 * How long the seating animation runs before the item is actually applied
 * (styles.css @keyframes equip-seat-*). Same deferred-commit shape as
 * LevelUpScreen's LEVEL_UP_ANIM_MS: equipping can advance the queue or leave
 * the screen entirely, and doing that on the frame of the tap would cut the
 * animation off at its first frame.
 *
 * Shorter than the level-up's 550ms on purpose. A level is a promotion and
 * gets a fanfare; this is a buckle closing, and a buckle that takes half a
 * second to close is a broken buckle.
 */
const EQUIP_ANIM_MS = 420;

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
  /** Roster id whose card is mid seating animation, if any — every other card is inert until it finishes, so an item can't be equipped onto two heroes inside one animation (see EQUIP_ANIM_MS). */
  const [seatingRosterId, setSeatingRosterId] = useState<string | null>(null);

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

  /**
   * Tapping a hero: play the buckle, run the seating animation on that card,
   * and only then hand the item over. The sound fires here rather than with
   * the state change because it IS the press's feedback — the metal is what
   * the tap sounds like, and delaying it 420ms would read as lag.
   */
  function handleEquip(rosterId: string) {
    if (seatingRosterId) return;
    playSfx('equip');
    setSeatingRosterId(rosterId);
    window.setTimeout(() => {
      setSeatingRosterId(null);
      applyEquip(rosterId);
    }, EQUIP_ANIM_MS);
  }

  function applyEquip(rosterId: string) {
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
          docs/visual-language.md's ninth pass). The name is now the header's
          title and the icon rides beside it as the title glyph, the same slot
          the Gold Cache's coin and the Relic Shrine's gem use.
          ┄
          The icon used to be the header's `art` — a 52px figure standing above
          the eyebrow — and what the effects are now inside used to be a fourth
          band of its own between the header and the body. Together those two
          put this screen's figures 33px lower than the Level Up screen's, and
          since a won fight hands equipment straight to Level Up, the whole
          roster visibly jumped up the moment the player pressed Trash/Equip
          (2026-08-29 pass). The chips sit in the header's `children` slot —
          exactly where Level Up puts its XP orb track.
          ┄
          This is the ABSOLUTE reading of the item and the table below is the
          RELATIVE one, which is why both exist and neither is redundant. A
          player meeting an item for the first time should not have to
          reconstruct what it is from six diffs of it, and a diff cannot carry
          a passive's prose. */}
      <NodeHeader
        /* NodeHeader's own step-down, for exactly what it is for: "a screen
           whose body is already tall gets the same header one size down
           rather than a different header". The body below is now a six-row
           table. It also buys the margin the titles here need that no other
           node screen does — a node is called "Guild Hall", an item is called
           "Mantle of the Archmage", and at 25px that ran off the canvas and
           under the roster glyph. */
        compact
        eyebrow={current.bumped ? 'Needs a New Home' : 'New Equipment'}
        glyph={<EquipmentIcon item={item} slot={item.slot} className="equip-spotlight-icon" />}
        title={item.name}
        readout={`${RARITY_LABELS[item.rarity]} · ${EQUIP_SLOT_LABELS[item.slot]}${
          current.bumped ? ' — unequipped; give it to another hero, or trash it' : ' — tap a hero to hand it over'
        }`}
      >
        {/* Capped and internally scrolling: an item with three granted
            passives and one with none must leave the table below the same
            height, or the row a player is reaching for moves under their
            thumb between one item and the next. */}
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
              chip used elsewhere). The table below abbreviates a granted
              passive to its name, since a diff has no room for prose; this is
              the one place the prose gets said. */}
          <EquipmentEffectList item={item} />
        </div>
      </NodeHeader>

      {/* The comparison table (EquipCompareRow). Six rows of one hero each,
          scrolling internally rather than pushing Trash off the screen —
          .app-shell's standing rule, and the reason a full roster needs no
          layout of its own here: a seventh hero would simply be a seventh
          row. What was here: HeroPickGrid, six identity cards with one line
          of slot text each, which is what forced the player through six hero
          sheets to answer a question about numbers (2026-08-31). */}
      {/* Two scales at one threshold, the same one HeroPickGrid uses (`count
          > 4`): past four heroes the rows go dense so six of them fit the
          stage, at four or fewer they double the portrait so an early-run
          roster doesn't leave a hole where the grid used to fill one. */}
      <div className={`equip-compare-table screen-scroll${run.roster.length > 4 ? '' : ' is-roomy'}`}>
        {run.roster.map((entry) => {
          const hero = heroes[entry.heroId];
          const currentId = entry.equipment[item.slot];
          const currentItem = currentId ? equipment[currentId] : null;
          return (
            <EquipCompareRow
              key={entry.rosterId}
              hero={hero}
              entry={entry}
              slot={item.slot}
              currentItem={currentItem}
              offered={item}
              isEquipping={seatingRosterId === entry.rosterId}
              locked={!!seatingRosterId && seatingRosterId !== entry.rosterId}
              onEquip={() => handleEquip(entry.rosterId)}
              onPreview={() => setPreviewEntry({ hero, entry })}
            />
          );
        })}
      </div>

      {/* Inert while a card is seating, for the same reason the other cards
          are: the deferred equip is holding a snapshot of this queue, and
          trashing the head of it mid-animation would resolve the same item
          twice. */}
      <button className="secondary-button trash-button" disabled={!!seatingRosterId} onClick={() => setConfirmTrash(true)}>
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
