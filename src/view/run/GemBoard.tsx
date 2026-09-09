import { useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import type { HeroDefinition, StatKey } from '../../engine/content';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import { gemForStat, gemList } from '../../data/gems';
import {
  gemCapacityFor,
  gemHeadroom,
  gemPool,
  gemsHeldBy,
  gemsOn,
  pullGems,
  socketGems,
  unsocketGems,
} from '../../run/gems';
import type { RosterEntry, RunState } from '../../run/state';
import { HeroSlotCard, HeroSlotGrid } from '../shared/HeroSlotCard';
import { useLongPress } from '../shared/MoveTile';
import { RelicArt } from '../shared/relicArt';
import { relicColor } from '../shared/relicIcons';
import { STAT_FULL_LABELS } from '../shared/relicStacks';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  /** Tapping a hero with nothing in hand still opens their sheet, as it does on the Gear board. */
  onInspect: (entry: RosterEntry, hero: HeroDefinition) => void;
}

/** One stone a hero is carrying. Tap returns one, hold returns the lot. */
function HeroGemChip({ stat, count, onTake, onTakeAll }: { stat: StatKey; count: number; onTake: () => void; onTakeAll: () => void }) {
  const gem = gemForStat[stat]!;
  const press = useLongPress(onTakeAll, onTake);
  return (
    <button
      type="button"
      className="gem-held-chip"
      data-sfx="none"
      style={{ '--relic-color': relicColor(gem.id) } as CSSProperties}
      aria-label={`${gem.name} ×${count} — tap to take one back, hold to take all`}
      {...press}
    >
      <RelicArt relicId={gem.id} className="gem-held-art" />
      <span className="gem-held-count">{count}</span>
    </button>
  );
}

/**
 * The Gems half of Manage Roster (2026-09-09, per user direction). Built as the Gear board's
 * twin — a tray of what the run is carrying along the bottom, the same six cards above it, and
 * one tap-then-tap to move a stone — because the alternative it replaced made the player walk
 * into a hero sheet and back out for every hero they wanted to touch.
 *
 * A held stone STAYS held after it lands, which the Gear board's items do not: Gems arrive four
 * and five at a time and the whole point is pouring several. Holding a hero is the bulk gesture
 * in both directions — pour everything that fits, or, with an empty hand, take everything back.
 */
export function GemBoard({ run, onRunChange, onInspect }: Props) {
  const [held, setHeld] = useState<StatKey | null>(null);
  const pool = gemPool(run);
  const heldGem = held ? gemForStat[held] ?? null : null;
  const heldSpare = held ? pool[held] ?? 0 : 0;

  // Picking a stone up is idempotent from the tray's side: tapping the one in hand puts it down.
  function take(stat: StatKey) {
    if ((pool[stat] ?? 0) < 1) return;
    playSfx(held === stat ? 'ui.back' : 'ui.select');
    setHeld(held === stat ? null : stat);
  }

  function pour(entry: RosterEntry, all: boolean) {
    if (!held) return;
    const count = all ? Math.min(heldSpare, gemHeadroom(entry, held)) : 1;
    if (count < 1) {
      playSfx('ui.denied');
      return;
    }
    playSfx('ui.tap', { pitch: all ? 1.12 : 1 });
    const next = socketGems(run, entry.rosterId, held, count);
    onRunChange(next);
    // Nothing left of this stone is nothing left to pour: drop it rather than leave a dead hand.
    if ((gemPool(next)[held] ?? 0) < 1) setHeld(null);
  }

  /** Holding a hero with an empty hand strips them — the one gesture a roster swap actually needs. */
  function strip(entry: RosterEntry) {
    if (gemsHeldBy(entry) < 1) return;
    playSfx('ui.tap', { pitch: 0.72 });
    onRunChange(pullGems(run, entry.rosterId));
  }

  function takeBack(entry: RosterEntry, stat: StatKey, all: boolean) {
    const count = all ? gemsOn(entry, stat) : 1;
    if (count < 1) return;
    playSfx('ui.tap', { pitch: 0.84 });
    onRunChange(unsocketGems(run, entry.rosterId, stat, count));
  }

  return (
    <div className={`gem-board${held ? ' is-focused' : ''}`}>
      <div className="gem-focus-bar">
        {heldGem ? (
          <>
            <RelicArt relicId={heldGem.id} className="gem-focus-art" />
            <span className="gem-focus-text">
              <span className="gem-focus-name">{heldGem.name}</span>
              <span className="gem-focus-grant">
                +{heldGem.grant} {STAT_FULL_LABELS[heldGem.stat]} each · {heldSpare} left
              </span>
            </span>
            <button
              className="gem-focus-cancel"
              onClick={() => {
                playSfx('ui.back');
                setHeld(null);
              }}
            >
              Done
            </button>
          </>
        ) : (
          <span className="gem-focus-idle">Tap a stone below, then tap who gets it. Hold to pour.</span>
        )}
      </div>

      <HeroSlotGrid>
        {run.roster.map((entry) => {
          const hero = heroes[entry.heroId];
          const on = gemsHeldBy(entry);
          const capacity = gemCapacityFor(entry);
          const headroom = held ? gemHeadroom(entry, held) : 0;
          const worn = gemList.filter((gem) => gemsOn(entry, gem.stat) > 0);
          return (
            <HeroSlotCard
              key={entry.rosterId}
              hero={hero}
              entry={entry}
              equipmentLookup={equipment}
              className={held ? (headroom > 0 ? 'can-take' : 'is-inert') : ''}
              onHeadTap={() => (held ? pour(entry, false) : onInspect(entry, hero))}
              onHeadLongPress={held ? () => pour(entry, true) : () => strip(entry)}
              headLabel={
                held
                  ? `Set a ${heldGem?.name ?? 'Gem'} on ${hero.name}, or hold to pour`
                  : `View ${hero.name} details, or hold to take their Gems back`
              }
              body={
                <div className="gem-held-row">
                  <span className={`gem-held-total${on >= capacity ? ' is-full' : ''}`}>
                    {on}
                    <span className="gem-held-cap">/{capacity}</span>
                  </span>
                  {worn.map((gem) => (
                    <HeroGemChip
                      key={gem.id}
                      stat={gem.stat}
                      count={gemsOn(entry, gem.stat)}
                      onTake={() => takeBack(entry, gem.stat, false)}
                      onTakeAll={() => takeBack(entry, gem.stat, true)}
                    />
                  ))}
                </div>
              }
            />
          );
        })}
      </HeroSlotGrid>

      {/* The tray, in the bag's place and drawn from the same way: the bottom of the reach is
          where the thing you are spending lives. */}
      <div className="stash-panel gem-tray">
        <div className="stash-header">
          <span className="stash-label">Gems</span>
          <span className="stash-count">{gemList.reduce((total, gem) => total + (pool[gem.stat] ?? 0), 0)}</span>
        </div>
        <div className="gem-tray-grid">
          {gemList.map((gem) => {
            const spare = pool[gem.stat] ?? 0;
            return (
              <button
                key={gem.id}
                type="button"
                className={`gem-tray-stone${held === gem.stat ? ' is-held' : ''}${spare === 0 ? ' is-empty' : ''}`}
                style={{ '--relic-color': relicColor(gem.id) } as CSSProperties}
                disabled={spare === 0}
                onClick={() => take(gem.stat)}
                aria-label={`${gem.name}, ${spare} unset — +${gem.grant} ${STAT_FULL_LABELS[gem.stat]} each`}
              >
                <RelicArt relicId={gem.id} className="gem-tray-art" />
                <span className="gem-tray-count">{spare}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
