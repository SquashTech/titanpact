import { useEffect, useRef, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import type { StatKey } from '../../engine/content';
import { gemList } from '../../data/gems';
import {
  GEM_CAP_PER_STAT,
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
import { RelicArt } from '../shared/relicArt';
import { relicColor } from '../shared/relicIcons';
import { STAT_FULL_LABELS } from '../shared/relicStacks';

interface Props {
  entry: RosterEntry;
  run: RunState;
  onRunChange: (next: RunState) => void;
}

/** How long a press sits before it starts pouring, and how fast it pours after that. */
const POUR_DELAY_MS = 320;
const POUR_INTERVAL_MS = 90;

/**
 * Press-and-hold that repeats. The action is read from a ref rather than closed over, so a pour
 * that outlives a re-render keeps acting on the run as it is NOW — the alternative socketS the
 * same Gem twice off a stale copy.
 */
function useRepeatPress(action: () => boolean) {
  const latest = useRef(action);
  latest.current = action;
  const timers = useRef<{ delay?: number; interval?: number }>({});

  function stop() {
    window.clearTimeout(timers.current.delay);
    window.clearInterval(timers.current.interval);
    timers.current = {};
  }

  useEffect(() => stop, []);

  function start() {
    if (!latest.current()) return;
    timers.current.delay = window.setTimeout(() => {
      timers.current.interval = window.setInterval(() => {
        if (!latest.current()) stop();
      }, POUR_INTERVAL_MS);
    }, POUR_DELAY_MS);
  }

  return { onPointerDown: start, onPointerUp: stop, onPointerLeave: stop, onPointerCancel: stop };
}

function PourButton({
  label,
  sign,
  disabled,
  act,
}: {
  label: string;
  sign: '+' | '−';
  disabled: boolean;
  act: () => boolean;
}) {
  const press = useRepeatPress(act);
  return (
    <button
      type="button"
      className="gem-pour-button"
      disabled={disabled}
      aria-label={label}
      {...press}
      onClick={(e) => e.stopPropagation()}
    >
      {sign}
    </button>
  );
}

/**
 * Where a hero's Gems are set (docs/run-loop.md "Gems"). Re-allocation is free, so this is a
 * dial rather than a commitment — tap to move one, hold to pour. The pips are the two caps made
 * visible: a row fills at GEM_CAP_PER_STAT, and the header count fills at the hero's capacity.
 *
 * Rendered only where Gems may be moved. The sheet omits it from node-select onward, which IS
 * the freeze — there is no disabled state to reason about, because the controls are not there.
 */
export function GemAllocationPanel({ entry, run, onRunChange }: Props) {
  const runRef = useRef(run);
  runRef.current = run;

  const held = gemsHeldBy(entry);
  const capacity = gemCapacityFor(entry);
  const pool = gemPool(run);

  /** Both directions read the LIVE run, so a hold keeps pouring into the state it just changed. */
  function move(stat: StatKey, delta: 1 | -1): boolean {
    const live = runRef.current;
    const current = live.roster.find((e) => e.rosterId === entry.rosterId);
    if (!current) return false;
    if (delta === 1) {
      if (gemHeadroom(current, stat) < 1 || (gemPool(live)[stat] ?? 0) < 1) return false;
      playSfx('ui.tap');
      onRunChange(socketGems(live, entry.rosterId, stat, 1));
      return true;
    }
    if (gemsOn(current, stat) < 1) return false;
    playSfx('ui.tap', { pitch: 0.84 });
    onRunChange(unsocketGems(live, entry.rosterId, stat, 1));
    return true;
  }

  return (
    <div className="gem-panel">
      <div className="gem-panel-head">
        <span className="gem-panel-label">Set</span>
        <span className="gem-panel-count">
          {held}
          <span className="gem-panel-cap">/{capacity}</span>
        </span>
        <button
          type="button"
          className="gem-pull-button"
          disabled={held === 0}
          onClick={(e) => {
            e.stopPropagation();
            playSfx('ui.tap', { pitch: 0.72 });
            onRunChange(pullGems(runRef.current, entry.rosterId));
          }}
        >
          Pull all
        </button>
      </div>

      <div className="gem-row-list">
        {gemList.map((gem) => {
          const on = gemsOn(entry, gem.stat);
          const spare = pool[gem.stat] ?? 0;
          const headroom = gemHeadroom(entry, gem.stat);
          return (
            <div
              key={gem.id}
              className={`gem-row${on > 0 ? ' is-set' : ''}`}
              style={{ '--relic-color': relicColor(gem.id) } as CSSProperties}
            >
              <RelicArt relicId={gem.id} className="gem-row-art" />
              <div className="gem-row-main">
                <div className="gem-row-head">
                  <span className="gem-row-label">{STAT_FULL_LABELS[gem.stat]}</span>
                  {on > 0 && <span className="gem-row-grant">+{on * gem.grant}</span>}
                  {/* What is left to pour, said only where there is something to pour. */}
                  {spare > 0 && <span className="gem-row-spare">{spare} left</span>}
                </div>
                <div className="gem-pips" aria-hidden="true">
                  {Array.from({ length: GEM_CAP_PER_STAT }, (_, i) => (
                    <span key={i} className={`gem-pip${i < on ? ' is-filled' : ''}`} />
                  ))}
                </div>
              </div>
              <div className="gem-row-controls">
                <PourButton
                  label={`Take a ${gem.name} off ${entry.rosterId}`}
                  sign="−"
                  disabled={on === 0}
                  act={() => move(gem.stat, -1)}
                />
                <PourButton
                  label={`Set a ${gem.name} on ${entry.rosterId}`}
                  sign="+"
                  disabled={headroom === 0 || spare === 0}
                  act={() => move(gem.stat, 1)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
