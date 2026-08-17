import { useState } from 'react';
import { heroes } from '../../data/heroes';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition } from '../../engine/content';
import { getTypeColor } from '../combat/typeColors';
import { StatBars } from '../shared/StatBars';
import { MoveTile, MoveInfoPanel } from '../shared/MoveTile';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';

interface Props {
  onClose: () => void;
}

/** A hero's full learnable movepool for compendium purposes: its starting kit plus its level-up move-tier pool (src/data/progression.ts), deduped and ordered starting-kit-first. Not what any single roster instance actually knows — MOVE_CAP still caps a real hero to 4 at once. */
function fullMovepool(heroId: string, startingMoveIds: readonly string[]): string[] {
  const tierIds = progressionTable.moveTiers[heroId] ?? [];
  return [...new Set([...startingMoveIds, ...tierIds])];
}

/**
 * Read-only hero browser, reachable from the title screen before a run even
 * starts. Shows every authored HeroDefinition's base stats and full learnable
 * movepool (starting kit + level-up tier pool) — unlike HeroPreviewOverlay,
 * there's no RosterEntry here (no level, no Evolution grants, no equipment):
 * this is the hero as designed, not a specific run's build of it.
 */
/** One authored hero's stat/movepool card. Move selection state lives in the parent screen, not here, so every card shares the same fixed info panel instead of each carrying its own. */
function CompendiumHeroCard({
  hero,
  movepool,
  viewedMoveId,
  onSelectMove,
}: {
  hero: HeroDefinition;
  movepool: string[];
  viewedMoveId: string | null;
  onSelectMove: (moveId: string) => void;
}) {
  return (
    <div className="roster-mgmt-card" style={{ borderLeftColor: getTypeColor(hero.types[0]) }}>
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

      <div className="detail-section-title">Movepool</div>
      <div className="move-tile-row">
        {movepool.map((id) =>
          moves[id] ? (
            <MoveTile key={id} move={moves[id]} selected={viewedMoveId === id} onSelect={() => onSelectMove(id)} />
          ) : (
            <span key={id} className="detail-status-chip">
              {id}
            </span>
          )
        )}
      </div>
    </div>
  );
}

export function CompendiumScreen({ onClose }: Props) {
  const heroList = Object.values(heroes);
  /** Which move is loaded into the single shared info panel below, and whose card it came from — lifted up here (rather than per-card) so scrolling to a different hero doesn't leave a stack of stale panels behind. */
  const [viewed, setViewed] = useState<{ heroId: string; moveId: string } | null>(null);
  const viewedHero = viewed ? (heroes[viewed.heroId] ?? null) : null;
  const viewedMove = viewed ? (moves[viewed.moveId] ?? null) : null;

  return (
    <div className="log-overlay roster-mgmt-overlay" onClick={onClose}>
      <div className="log-panel roster-panel" onClick={(e) => e.stopPropagation()}>
        <div className="log-panel-header">
          <span>Compendium</span>
          <button className="log-close-button" onClick={onClose}>
            ✕
          </button>
        </div>
        <MoveInfoPanel move={viewedMove} label={viewedHero?.name} />
        <div className="screen-scroll">
          <div className="roster-mgmt-list">
            {heroList.map((hero) => (
              <CompendiumHeroCard
                key={hero.id}
                hero={hero}
                movepool={fullMovepool(hero.id, hero.moveIds)}
                viewedMoveId={viewed?.heroId === hero.id ? viewed.moveId : null}
                onSelectMove={(moveId) => setViewed({ heroId: hero.id, moveId })}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
