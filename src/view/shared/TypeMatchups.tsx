import { TYPES, typeChart } from '../../data/typechart';
import type { TypeId } from '../../engine/content';
import { resolveTypeMult } from '../../engine/damage/typeMult';
import { TypeBadge } from './TypeBadge';

interface MatchupGroup {
  mult: number;
  types: TypeId[];
}

/** Vulgar fractions on the resist side: `½×` reads as a shape where `0.5×` reads as a decimal. */
function fmtMult(mult: number): string {
  if (mult === 0.5) return '½×';
  if (mult === 0.25) return '¼×';
  return `${mult}×`;
}

/**
 * Every attacking type bucketed by its multiplier against these defender types, through the same
 * resolveTypeMult the damage pipeline uses (dual stacking and the 0.25× floor are inherited).
 * Neutral types are dropped; groups are ordered most consequential first (4× before 2×, ¼× before ½×).
 */
export function typeMatchups(defenderTypes: readonly TypeId[]): { weak: MatchupGroup[]; resist: MatchupGroup[] } {
  const byMult = new Map<number, TypeId[]>();
  for (const attacking of TYPES) {
    const mult = resolveTypeMult(typeChart, attacking, defenderTypes);
    if (mult === 1) continue;
    const bucket = byMult.get(mult);
    if (bucket) bucket.push(attacking);
    else byMult.set(mult, [attacking]);
  }
  const groups = [...byMult.entries()].map(([mult, types]) => ({ mult, types }));
  return {
    weak: groups.filter((g) => g.mult > 1).sort((a, b) => b.mult - a.mult),
    resist: groups.filter((g) => g.mult < 1).sort((a, b) => a.mult - b.mult),
  };
}

function MatchupRow({ label, tone, groups }: { label: string; tone: 'bad' | 'good'; groups: MatchupGroup[] }) {
  return (
    <div className="matchup-row">
      <span className={`matchup-side matchup-${tone}`}>{label}</span>
      {groups.length > 0 ? (
        groups.map((group) => (
          <span className="matchup-group" key={group.mult}>
            <span className={`matchup-mult matchup-${tone}${group.mult >= 4 || group.mult <= 0.25 ? ' matchup-extreme' : ''}`}>
              {fmtMult(group.mult)}
            </span>
            {group.types.map((type) => (
              <TypeBadge key={type} type={type} iconOnly />
            ))}
          </span>
        ))
      ) : (
        <span className="matchup-none">None</span>
      )}
    </div>
  );
}

/** Defensive matchups for one hero's *effective* types. Colored by consequence: red is bad for this hero, green good. */
export function TypeMatchups({ types }: { types: readonly TypeId[] }) {
  const { weak, resist } = typeMatchups(types);
  return (
    <div className="matchup-block">
      <MatchupRow label="Weak" tone="bad" groups={weak} />
      <MatchupRow label="Resists" tone="good" groups={resist} />
    </div>
  );
}
