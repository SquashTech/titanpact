import { useEffect, useState, type CSSProperties } from 'react';
import { RelicArt } from '../shared/relicArt';
import { relicColor } from '../shared/relicIcons';
import { prefersReducedMotion } from '../shared/reducedMotion';

interface Props {
  /** The whole family, held or not — the collection is the point, not the one just gained. */
  family: readonly { id: string }[];
  /** Which family is on the shelf: seven Gems lay out differently from five Banners. */
  variant: 'gems' | 'banners';
  /** Counts AFTER the grant lands; the gained one counts itself back down and ticks up. */
  counts: Map<string, number>;
  gainedRelicId: string;
  /** How many landed — a Gem arrives in stacks, a Banner one at a time. */
  gainedCount?: number;
}

/** How long the tally sits at its old figure before the gained one ticks over. */
const TICK_DELAY_MS = 460;

/**
 * What a claim actually changed, shown against everything the run already holds (2026-09-08, per
 * user direction). A Gem or a Banner is a number on a shelf of numbers — its worth is entirely
 * "this is my fourth Ruby", which a single reveal card cannot say. So the claim reveals the SHELF,
 * with the new one flaring and counting up on it.
 */
export function RelicFamilyTally({ family, variant, counts, gainedRelicId, gainedCount = 1 }: Props) {
  const [ticked, setTicked] = useState(prefersReducedMotion());

  useEffect(() => {
    if (ticked) return;
    const timer = window.setTimeout(() => setTicked(true), TICK_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`relic-tally is-${variant}`}>
      {family.map((relic, i) => {
        const held = counts.get(relic.id) ?? 0;
        const gained = relic.id === gainedRelicId;
        const shown = gained && !ticked ? held - gainedCount : held;
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
