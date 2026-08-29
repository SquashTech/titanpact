import { TYPES, typeChart } from '../../data/typechart';
import type { TypeId } from '../../engine/content';
import { resolveTypeMult } from '../../engine/damage/typeMult';
import { TypeBadge } from './TypeBadge';

/** One multiplier bucket — every attacking type that lands on this defender for exactly `mult`. */
interface MatchupGroup {
  mult: number;
  types: TypeId[];
}

/** "4×" / "2×" / "½×" / "¼×" — vulgar fractions on the resist side, since `0.5×` reads as a decimal to parse where `½×` reads as a shape. */
function fmtMult(mult: number): string {
  if (mult === 0.5) return '½×';
  if (mult === 0.25) return '¼×';
  return `${mult}×`;
}

/**
 * Every attacking type bucketed by what it does to a defender with these
 * types, resolved through the same resolveTypeMult the damage pipeline uses —
 * so dual-type multiplicative stacking and the soft 0.25× floor
 * (docs/types-and-heroes.md) are inherited rather than re-derived here. A
 * dual type is exactly why this exists: 2×2 = 4× and ½×½ = ¼× are the two
 * facts a player cannot read off a pair of type chips.
 *
 * Neutral (1×) types are dropped — listing nine of them would bury the four
 * that matter. Returned weak-first descending (4× before 2×) and
 * resist-strongest-first (¼× before ½×), so the most consequential group in
 * each row is the one nearest its label.
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

/**
 * The defensive half of the type chart, for one hero: what hurts them and
 * what bounces off. Every hero sheet in the game shows it — combat's
 * HeroDetailOverlay, the out-of-combat HeroPreviewOverlay, and the
 * Compendium's card — reading the hero's *effective* types, so an Evolution
 * type-graft moves this readout the moment it lands.
 *
 * Two rows, not four. Bucketing by multiplier inside each row keeps 4× and ¼×
 * explicit (the whole reason a dual-typed hero needs this) without spending a
 * separate labelled line on each tier: the sheets these sit in are already at
 * their scroll budget on a phone, and a "Weak"/"Resists" pair that wraps is
 * two lines for most heroes and three or four only for the genuinely
 * complicated ones.
 *
 * Colored by CONSEQUENCE, matching SwitchInPanel's toneFor rather than the
 * move grid's eff-super/eff-resist naming: red is bad news for the hero on
 * this sheet, green is good news, regardless of which side of 1× the
 * multiplier sits on.
 */
export function TypeMatchups({ types }: { types: readonly TypeId[] }) {
  const { weak, resist } = typeMatchups(types);
  return (
    <div className="matchup-block">
      <MatchupRow label="Weak" tone="bad" groups={weak} />
      <MatchupRow label="Resists" tone="good" groups={resist} />
    </div>
  );
}
