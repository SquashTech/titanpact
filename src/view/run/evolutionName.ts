import { progressionTable } from '../../data/progression';
import { currentEvolutionPathId } from '../../run/progression';
import type { RosterEntry } from '../../run/state';

/** The name of the last Evolution taken — the one word that says what this hero became. */
export function evolutionName(entry: RosterEntry): string | null {
  const chosen = currentEvolutionPathId(entry);
  if (!chosen) return null;
  for (const node of progressionTable.evolutions[entry.heroId] ?? []) {
    const path = node.paths.find((p) => p.id === chosen);
    if (path) return path.name;
  }
  return null;
}
