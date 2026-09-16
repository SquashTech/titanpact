import type { EvolutionPath } from '../../run/progression';
import { useHasEvolutionStar } from './ProfileContext';

/**
 * One Evolution star: lit when the player has cleared a run with the hero in that form, an
 * empty outline when not (profile.ts `evolutionStars`). The same mark everywhere a path is
 * named — the Compendium row, the hero dossier, the Evolution choice — so a lit star on the
 * choice screen is recognisably the one the Compendium is missing.
 */
export function EvolutionStar({ path, className }: { path: EvolutionPath; className?: string }) {
  const earned = useHasEvolutionStar(path.heroId, path.id);
  return (
    <span
      className={`evo-star ${earned ? 'is-earned' : 'is-empty'}${className ? ` ${className}` : ''}`}
      title={earned ? `${path.name} — star earned` : `${path.name} — clear a run as ${path.name} to earn`}
      aria-label={earned ? `${path.name}: star earned` : `${path.name}: no star yet`}
      role="img"
    >
      {earned ? '★' : '☆'}
    </span>
  );
}

/** A hero's three stars in a row, in the paths' authored order. */
export function EvolutionStarRow({ paths, className }: { paths: readonly EvolutionPath[]; className?: string }) {
  return (
    <span className={`evo-star-row${className ? ` ${className}` : ''}`}>
      {paths.map((path) => (
        <EvolutionStar key={path.id} path={path} />
      ))}
    </span>
  );
}
