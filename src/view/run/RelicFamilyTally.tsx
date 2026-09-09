import { useEffect, useState, type CSSProperties } from 'react';
import type { RelicDefinition } from '../../run/relics';
import { RelicArt } from '../shared/relicArt';
import { relicColor } from '../shared/relicIcons';
import { prefersReducedMotion } from '../shared/reducedMotion';

interface Props {
  /** The whole family, held or not — the collection is the point, not the one just gained. */
  family: readonly RelicDefinition[];
  /** Counts AFTER the grant lands; the gained one counts itself down one and ticks back up. */
  counts: Map<string, number>;
  gainedRelicId: string;
}

/** How long the tally sits at its old figure before the gained one ticks over. */
const TICK_DELAY_MS = 460;

/**
 * What a claim actually changed, shown against everything the run already holds (2026-09-08, per
 * user direction). A Gem or a Banner is a number on a shelf of numbers — its worth is entirely
 * "this is my fourth Ruby", which a single reveal card cannot say. So the claim reveals the SHELF,
 * with the new one flaring and counting up on it.
 */
export function RelicFamilyTally({ family, counts, gainedRelicId }: Props) {
  const [ticked, setTicked] = useState(prefersReducedMotion());

  useEffect(() => {
    if (ticked) return;
    const timer = window.setTimeout(() => setTicked(true), TICK_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`relic-tally is-${family[0]?.gem ? 'gems' : 'banners'}`}>
      {family.map((relic, i) => {
        const held = counts.get(relic.id) ?? 0;
        const gained = relic.id === gainedRelicId;
        const shown = gained && !ticked ? held - 1 : held;
        return (
          <div
            key={relic.id}
            className={`relic-tally-cell${gained ? ' is-gained' : ''}${shown > 0 ? '' : ' is-empty'}`}
            style={{ '--relic-color': relicColor(relic.id), animationDelay: `${i * 45}ms` } as CSSProperties}
          >
            {gained && <span className="relic-tally-burst" aria-hidden="true" />}
            <RelicArt relicId={relic.id} className="relic-tally-art" />
            <span className={`relic-tally-count${gained && ticked ? ' is-ticked' : ''}`}>{shown}</span>
          </div>
        );
      })}
    </div>
  );
}
