import { useState, type CSSProperties } from 'react';
import { heroes } from '../../data/heroes';
import { TYPES } from '../../data/typechart';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition, TypeId } from '../../engine/content';
import { hasCompanionStar, isSpawnAscended, type Profile } from '../../run/profile';
import { heroPool } from '../../run/recruitment';
import { ANCIENT } from '../../run/companion';
import { SPAWN_TIERS, spawnId, titanspawnLines, type SpawnTier, type TitanspawnLine } from '../../data/titanspawn';
import { getTypeAbbr, getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { HeroPortrait } from '../shared/HeroPortrait';
import { EvolutionStar } from '../shared/EvolutionStar';
import { pathTintStyle } from '../shared/pathTint';
import { HeroDossierOverlay } from './HeroDossierOverlay';

// The Constellation's two star pages: where every star the account has earned is charted — a
// hero's three Evolution paths, and a Titanspawn line's companion star (docs/collection.md §2).

// Primary type in type-chart order (TYPES); a stable sort keeps same-type heroes in authoring order.
function byPrimaryType(a: HeroDefinition, b: HeroDefinition): number {
  return TYPES.indexOf(a.types[0] as (typeof TYPES)[number]) - TYPES.indexOf(b.types[0] as (typeof TYPES)[number]);
}

/** A hero's Evolution paths in authored order — exactly three, one star's worth each. */
function evolutionPathsOf(hero: HeroDefinition) {
  return (progressionTable.evolutions[hero.id] ?? []).flatMap((node) => node.paths);
}

/**
 * Hero row: sprite, name and types on the first line, and under them the hero's three Evolution
 * paths as cells — the path's name over its star, lit when a run has been cleared in that form
 * (profile.ts `evolutionStars`), each cell washed in the path's own tint (shared/pathTint.ts).
 */
function HeroStarRow({ hero, onOpen }: { hero: HeroDefinition; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="compendium-row"
      style={{ '--type-rgb': getTypeColorRgb(hero.types[0]) } as CSSProperties}
      onClick={onOpen}
      aria-label={`${hero.name} — view details`}
    >
      <span className="compendium-row-head">
        <span className="compendium-row-figure">
          <span className="pick-ground" aria-hidden="true" />
          <HeroPortrait heroId={hero.id} className="compendium-row-portrait" />
        </span>
        <span className="compendium-row-body">
          <span className="compendium-row-name">{hero.name}</span>
          <span className="pick-types compendium-row-types">
            {hero.types.map((t) => (
              <span key={t} className="pick-type-code" style={{ color: getTypeColor(t) }} title={t}>
                <ElementGlyph type={t} />
                {getTypeAbbr(t)}
              </span>
            ))}
          </span>
        </span>
      </span>
      <span className="compendium-row-paths">
        {evolutionPathsOf(hero).map((path) => (
          <span key={path.id} className="compendium-path-cell" style={pathTintStyle(hero, path)}>
            <span className="compendium-path-name">{path.name}</span>
            <EvolutionStar path={path} className="compendium-path-star" />
          </span>
        ))}
      </span>
    </button>
  );
}

/** Every hero the account owns, three stars a hero. A hero still to buy has no stars to chart. */
export function HeroStarsPage({ profile }: { profile: Profile }) {
  const [dossierHeroId, setDossierHeroId] = useState<string | null>(null);
  const owned = Object.values(heroPool(heroes, profile.purchases)).sort(byPrimaryType);
  const dossierHero = dossierHeroId ? heroes[dossierHeroId] : null;
  return (
    <>
      <div className="compendium-list">
        {owned.map((hero) => (
          <HeroStarRow key={hero.id} hero={hero} onOpen={() => setDossierHeroId(hero.id)} />
        ))}
      </div>
      {dossierHero && <HeroDossierOverlay hero={dossierHero} onClose={() => setDossierHeroId(null)} />}
    </>
  );
}

const TIER_LABELS: Record<SpawnTier, string> = {
  early: 'Early',
  mid: 'Mid',
  late: 'Late',
};

/**
 * One Titanspawn line: hidden until a run has been cleared with its companion alive (profile.ts
 * `companionStars`), then drawn in its Late body with its star lit and its three bodies named
 * under it — and Ancient beside its type once one of the line has woken in the finale.
 */
function SpawnStarRow({ line, profile }: { line: TitanspawnLine; profile: Profile }) {
  const known = hasCompanionStar(profile, line.type);
  const types: TypeId[] = known && isSpawnAscended(profile, line.type) ? [line.type, ANCIENT] : [line.type];
  const lead = getTypeColor(line.type);
  return (
    <div
      className={`compendium-row compendium-spawn-row${known ? '' : ' is-unknown'}`}
      style={{ '--type-rgb': getTypeColorRgb(line.type) } as CSSProperties}
      aria-label={known ? `${line.names.late}: star earned` : `An unknown ${line.type} Titanspawn`}
    >
      <span className="compendium-row-head">
        <span className="compendium-row-figure">
          <span className="pick-ground" aria-hidden="true" />
          <HeroPortrait heroId={spawnId(line, 'late')} className="compendium-row-portrait compendium-spawn-portrait" />
        </span>
        <span className="compendium-row-body">
          <span className="compendium-row-name">{known ? line.names.late : '???'}</span>
          <span className="pick-types compendium-row-types">
            {types.map((t) => (
              <span key={t} className="pick-type-code" style={{ color: getTypeColor(t) }} title={t}>
                <ElementGlyph type={t} />
                {getTypeAbbr(t)}
              </span>
            ))}
          </span>
        </span>
        <span
          className={`evo-star compendium-spawn-star ${known ? 'is-earned' : 'is-empty'}`}
          title={known ? 'Star earned' : 'Clear a run with this Titanspawn at your side to earn'}
          aria-hidden="true"
        >
          {known ? '★' : '☆'}
        </span>
      </span>
      <span className="compendium-row-paths">
        {SPAWN_TIERS.map((tier) => (
          <span key={tier} className="compendium-path-cell" style={{ '--path-lead': lead } as CSSProperties}>
            <span className="compendium-path-name">{known ? line.names[tier] : '???'}</span>
            <span className="compendium-spawn-tier">{TIER_LABELS[tier]}</span>
          </span>
        ))}
      </span>
    </div>
  );
}

/** The bestiary: one Titanspawn line a type, revealed by its companion star. */
export function SpawnStarsPage({ profile }: { profile: Profile }) {
  return (
    <div className="compendium-list">
      {titanspawnLines.map((line) => (
        <SpawnStarRow key={line.type} line={line} profile={profile} />
      ))}
    </div>
  );
}
