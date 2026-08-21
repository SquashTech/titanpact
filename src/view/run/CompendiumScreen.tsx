import { useState } from 'react';
import { heroes } from '../../data/heroes';
import { TYPES } from '../../data/typechart';
import type { HeroDefinition } from '../../engine/content';
import { getTypeColor } from '../combat/typeColors';
import { StatBars } from '../shared/StatBars';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';

interface Props {
  onClose: () => void;
}

/**
 * Read-only hero browser, reachable from the title screen before a run even
 * starts. Shows every authored HeroDefinition's base stats — unlike
 * HeroPreviewOverlay, there's no RosterEntry here (no level, no Evolution
 * grants, no equipment): this is the hero as designed, not a specific run's
 * build of it.
 */
function CompendiumHeroCard({ hero }: { hero: HeroDefinition }) {
  return (
    <div className="roster-mgmt-card" style={{ borderLeftColor: getTypeColor(hero.types[0]) }}>
      <span className={`roster-card-badge ${hero.starter ? 'badge-ally' : 'badge-recruit'}`}>
        {hero.starter ? 'STARTER' : 'RECRUIT ONLY'}
      </span>
      <div className="roster-mgmt-head">
        <HeroPortrait heroId={hero.id} className="roster-mgmt-portrait" />
        <div className="roster-mgmt-name">{hero.name}</div>
        <div className="roster-card-types">
          {hero.types.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </div>
      </div>

      <div className="detail-section-title">Stats</div>
      <StatBars baseStats={hero.baseStats} />
    </div>
  );
}

type CompendiumTab = 'starters' | 'recruitable';

export function CompendiumScreen({ onClose }: Props) {
  /** Starters is the default tab; Recruitable is a second tab the player has to select — the two pools mirror the draft vs. Guild Hall split (HeroDefinition.starter, src/data/heroes.ts). */
  const [tab, setTab] = useState<CompendiumTab>('starters');
  // Ordered by the hero's primary type's position in the 15-type chart
  // (src/data/typechart.ts TYPES), not authoring order — a stable sort keeps
  // same-primary-type heroes (e.g. Warden/Valor, both Iron) in their existing
  // relative order instead of reshuffling them further.
  const heroList = Object.values(heroes)
    .filter((hero) => (tab === 'starters' ? hero.starter : !hero.starter))
    .sort((a, b) => TYPES.indexOf(a.types[0] as (typeof TYPES)[number]) - TYPES.indexOf(b.types[0] as (typeof TYPES)[number]));

  return (
    <div className="log-overlay roster-mgmt-overlay" onClick={onClose}>
      <div className="log-panel roster-panel" onClick={(e) => e.stopPropagation()}>
        <div className="log-panel-header">
          <span>Compendium</span>
          <button className="log-close-button" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="compendium-tabs">
          <button className={`compendium-tab${tab === 'starters' ? ' active' : ''}`} onClick={() => setTab('starters')}>
            Starters
          </button>
          <button className={`compendium-tab${tab === 'recruitable' ? ' active' : ''}`} onClick={() => setTab('recruitable')}>
            Recruitable
          </button>
        </div>
        <div className="screen-scroll">
          <div className="roster-mgmt-list">
            {heroList.map((hero) => (
              <CompendiumHeroCard key={hero.id} hero={hero} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
