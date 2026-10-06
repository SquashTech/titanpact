import type { EvolutionPath } from '../../run/progression';
import { starCycleClass, useEvolutionStarCycle } from './ProfileContext';
import { cycleOf } from '../../run/cycles';

/**
 * One Evolution star: lit when the player has cleared a run with the hero in that form, an
 * empty outline when not (profile.ts `evolutionStars`). The same mark everywhere a path is
 * named — the Stars page, the Collection card, the hero dossier, the Evolution choice — so a lit
 * star on the choice screen is recognisably the one the Stars page is missing.
 */
export function EvolutionStar({ path, className }: { path: EvolutionPath; className?: string }) {
  const cycle = useEvolutionStarCycle(path.heroId, path.id);
  const earned = cycle > 0;
  return (
    <span
      className={`evo-star ${earned ? 'is-earned' : 'is-empty'}${starCycleClass(cycle)}${className ? ` ${className}` : ''}`}
      title={earned ? `${path.name} — star earned in Cycle ${cycleOf(cycle).numeral}` : `${path.name} — clear a run as ${path.name} to earn`}
      aria-label={earned ? `${path.name}: star earned` : `${path.name}: no star yet`}
      role="img"
    >
      {earned ? '★' : '☆'}
    </span>
  );
}
