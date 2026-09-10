import { useRef, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import type { HeroDefinition, StatKey } from '../../engine/content';
import { heroes } from '../../data/heroes';
import { gemForStat, gemList } from '../../data/gems';
import {
  gemCapacityFor,
  gemHeadroom,
  gemPool,
  gemStatModifiers,
  gemsHeldBy,
  gemsOn,
  pullGems,
  socketGems,
  unsocketGems,
} from '../../run/gems';
import type { RosterEntry, RunState } from '../../run/state';
import { getTypeColor } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { useLongPress } from '../shared/MoveTile';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { RelicArt } from '../shared/relicArt';
import { relicColor } from '../shared/relicIcons';
import { STAT_LABELS } from '../shared/StatBars';
import { STAT_FULL_LABELS } from '../shared/relicStacks';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  /** Tapping a hero with nothing in hand still opens their sheet, as it does on the Gear board. */
  onInspect: (entry: RosterEntry, hero: HeroDefinition) => void;
}

/** How long a landed stone's numeral rides up off the row. Matches `gem-flare-rise` in styles.css. */
const FLARE_MS = 720;

/** One landed stone, mid-flight. Keyed by a counter, so a stack pours as a column of them. */
interface Flare {
  id: number;
  rosterId: string;
  text: string;
  color: string;
}

/**
 * The Gems half of Manage Roster. The Gear board's twin — the tray of what the run is carrying
 * pinned along the bottom, the roster above it, one tap-then-tap to move a stone.
 *
 * A held stone STAYS held after it lands, which the Gear board's items do not: Gems arrive four
 * and five at a time and the whole point is pouring several. Holding a hero is the bulk gesture in
 * both directions — pour everything that fits, or, with an empty hand, take everything back.
 *
 * Heroes are full-width ROWS: seven stat cells only fit across a full width, and showing all seven
 * — dim where a hero carries none — is what makes a spread readable down a column rather than hero
 * by hero. Each row states what its stones are BUYING under the name, which is the half of this
 * screen a player actually wants (the cells are the input; the stat line is the output).
 */
export function GemBoard({ run, onRunChange, onInspect }: Props) {
  const [held, setHeld] = useState<StatKey | null>(null);
  const [flares, setFlares] = useState<readonly Flare[]>([]);
  const nextFlareId = useRef(0);
  const pool = gemPool(run);
  const heldGem = held ? gemForStat[held] ?? null : null;
  const heldSpare = held ? pool[held] ?? 0 : 0;
  /** Only what the run actually holds: the tray FILLS as stones arrive rather than sitting as seven zeroes. */
  const carried = gemList.filter((gem) => (pool[gem.stat] ?? 0) > 0);

  function flare(rosterId: string, stat: StatKey, amount: number) {
    if (prefersReducedMotion()) return;
    const id = nextFlareId.current++;
    setFlares((live) => [...live, { id, rosterId, text: `+${amount} ${STAT_LABELS[stat]}`, color: relicColor(gemForStat[stat]!.id) }]);
    window.setTimeout(() => setFlares((live) => live.filter((f) => f.id !== id)), FLARE_MS);
  }

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
    const seated = gemsOn(entry, held) + count;
    // Pitched by how full the hero now is, so a poured stack climbs instead of repeating.
    playSfx('gem.set', { pitch: 1 + Math.min(seated, 8) * 0.06 });
    flare(entry.rosterId, held, count * (gemForStat[held]?.grant ?? 0));
    const next = socketGems(run, entry.rosterId, held, count);
    onRunChange(next);
    // Nothing left of this stone is nothing left to pour: drop it rather than leave a dead hand.
    if ((gemPool(next)[held] ?? 0) < 1) setHeld(null);
  }

  /** Holding a hero with an empty hand strips them — the one gesture a roster swap actually needs. */
  function strip(entry: RosterEntry) {
    if (gemsHeldBy(entry) < 1) return;
    playSfx('gem.pull', { pitch: 0.86 });
    onRunChange(pullGems(run, entry.rosterId));
  }

  function takeBack(entry: RosterEntry, stat: StatKey, all: boolean) {
    const count = all ? gemsOn(entry, stat) : 1;
    if (count < 1) return;
    playSfx('gem.pull');
    onRunChange(unsocketGems(run, entry.rosterId, stat, count));
  }

  return (
    <div className={`gem-board${held ? ' is-focused' : ''}`}>
      <div className="gem-hero-list">
        {run.roster.map((entry) => (
          <GemHeroRow
            key={entry.rosterId}
            entry={entry}
            hero={heroes[entry.heroId]}
            held={held}
            heldName={heldGem?.name ?? null}
            flares={flares.filter((f) => f.rosterId === entry.rosterId)}
            onPour={(all) => pour(entry, all)}
            onStrip={() => strip(entry)}
            onTakeBack={(stat, all) => takeBack(entry, stat, all)}
            onInspect={() => onInspect(entry, heroes[entry.heroId])}
          />
        ))}
      </div>

      {/* The tray reads out the stone in hand in its own header rather than under a banner of its
          own: one bar that changes what it says, so nothing above it moves when a stone is lifted. */}
      <div className="gem-tray">
        <div className="gem-tray-head">
          {heldGem ? (
            <>
              <span className="gem-tray-held">
                <span className="gem-tray-held-name">{heldGem.name}</span>
                <span className="gem-tray-held-grant">
                  +{heldGem.grant} {STAT_FULL_LABELS[heldGem.stat]} each · {heldSpare} left
                </span>
              </span>
              <button
                className="gem-tray-done"
                onClick={() => {
                  playSfx('ui.back');
                  setHeld(null);
                }}
              >
                Done
              </button>
            </>
          ) : (
            <>
              <span className="gem-tray-label">Gems</span>
              <span className="gem-tray-total">{carried.reduce((n, gem) => n + (pool[gem.stat] ?? 0), 0)}</span>
            </>
          )}
        </div>
        <div className="gem-tray-grid">
          {carried.map((gem) => (
            <button
              key={gem.id}
              type="button"
              className={`gem-tray-stone${held === gem.stat ? ' is-held' : ''}`}
              style={{ '--relic-color': relicColor(gem.id) } as CSSProperties}
              onClick={() => take(gem.stat)}
              aria-label={`${gem.name}, ${pool[gem.stat]} unset — +${gem.grant} ${STAT_FULL_LABELS[gem.stat]} each`}
            >
              <RelicArt relicId={gem.id} className="gem-tray-art" />
              <span className="gem-tray-count">{pool[gem.stat]}</span>
            </button>
          ))}
          {carried.length === 0 && <span className="gem-tray-none">Every Gem is set.</span>}
        </div>
      </div>
    </div>
  );
}

interface RowProps {
  entry: RosterEntry;
  hero: HeroDefinition;
  held: StatKey | null;
  heldName: string | null;
  flares: readonly Flare[];
  onPour: (all: boolean) => void;
  onStrip: () => void;
  onTakeBack: (stat: StatKey, all: boolean) => void;
  onInspect: () => void;
}

/** One hero, full width: who they are, what their stones buy, then a cell per Gem type. */
function GemHeroRow({ entry, hero, held, heldName, flares, onPour, onStrip, onTakeBack, onInspect }: RowProps) {
  const on = gemsHeldBy(entry);
  const capacity = gemCapacityFor(entry);
  const headroom = held ? gemHeadroom(entry, held) : 0;
  const state = held ? (headroom > 0 ? ' can-take' : ' is-inert') : '';
  const headPress = useLongPress(held ? () => onPour(true) : onStrip, held ? () => onPour(false) : onInspect);
  const grants = gemStatModifiers(entry);

  return (
    <div className={`gem-hero-row${state}`} style={{ borderLeftColor: getTypeColor(hero.types[0]) } as CSSProperties}>
      <button
        type="button"
        className="gem-hero-head"
        data-sfx="none"
        aria-label={
          held
            ? `Set a ${heldName ?? 'Gem'} on ${hero.name}, or hold to pour`
            : `View ${hero.name}, or hold to take their Gems back`
        }
        {...headPress}
      >
        <HeroPortrait heroId={hero.id} className="gem-hero-portrait" />
        <span className="gem-hero-ident">
          <span className="gem-hero-name">{hero.name}</span>
          {/* The payoff, not the input: the cells below already say how many stones: this says
              what they bought, and it is the line the numerals fly off when one lands. */}
          <span className="gem-hero-grants">
            {on === 0 ? (
              <span className="gem-hero-none">No Gems set</span>
            ) : (
              gemList
                .filter((gem) => grants[gem.stat])
                .map((gem) => (
                  <span key={gem.id} className="gem-hero-grant" style={{ '--relic-color': relicColor(gem.id) } as CSSProperties}>
                    +{grants[gem.stat]} {STAT_LABELS[gem.stat]}
                  </span>
                ))
            )}
          </span>
        </span>
        <span className={`gem-hero-total${on >= capacity ? ' is-full' : ''}`}>
          {on}
          <span className="gem-hero-cap">/{capacity}</span>
        </span>
      </button>

      <div className="gem-hero-cells">
        {gemList.map((gem) => {
          const count = gemsOn(entry, gem.stat);
          return (
            <GemCell
              key={gem.id}
              gemId={gem.id}
              name={gem.name}
              heroName={hero.name}
              count={count}
              // With a stone in hand every cell is the same target as the hero: the row is ONE
              // destination, and aiming at a particular column would be a rule with no purpose.
              onTap={() => (held ? onPour(false) : onTakeBack(gem.stat, false))}
              onHold={() => (held ? onPour(true) : onTakeBack(gem.stat, true))}
            />
          );
        })}
      </div>

      <span className="gem-flare-layer" aria-hidden="true">
        {flares.map((f) => (
          <span key={f.id} className="gem-flare" style={{ '--relic-color': f.color } as CSSProperties}>
            {f.text}
          </span>
        ))}
      </span>
    </div>
  );
}

function GemCell({
  gemId,
  name,
  heroName,
  count,
  onTap,
  onHold,
}: {
  gemId: string;
  name: string;
  heroName: string;
  count: number;
  onTap: () => void;
  onHold: () => void;
}) {
  const press = useLongPress(onHold, onTap);
  return (
    <button
      type="button"
      className={`gem-cell${count > 0 ? ' is-set' : ''}`}
      data-sfx="none"
      style={{ '--relic-color': relicColor(gemId) } as CSSProperties}
      aria-label={count > 0 ? `${heroName}: ${name} ×${count}` : `${heroName}: no ${name}`}
      {...press}
    >
      {/* Keyed on the count so it REMOUNTS when one lands, which is what replays the bloom —
          a class toggle would need a frame of nothing between two identical animations. */}
      <span key={count} className="gem-cell-bloom" aria-hidden="true" />
      <RelicArt relicId={gemId} className="gem-cell-art" />
      <span key={`n${count}`} className="gem-cell-count">
        {count > 0 ? count : ''}
      </span>
    </button>
  );
}
