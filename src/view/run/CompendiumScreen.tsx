import { heroes } from '../../data/heroes';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import { getTypeColor } from '../combat/typeColors';
import { StatBars } from '../shared/StatBars';

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
 * there's no RosterEntry here (no level, no rank-up grants, no equipment):
 * this is the hero as designed, not a specific run's build of it.
 */
export function CompendiumScreen({ onClose }: Props) {
  const heroList = Object.values(heroes);

  return (
    <div className="log-overlay roster-mgmt-overlay" onClick={onClose}>
      <div className="log-panel roster-panel" onClick={(e) => e.stopPropagation()}>
        <div className="log-panel-header">
          <span>Compendium</span>
          <button className="log-close-button" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="hint">{heroList.length} heroes authored. Base stats shown — no rank-up or equipment bonuses.</p>
        <div className="screen-scroll">
          <div className="roster-mgmt-list">
            {heroList.map((hero) => {
              const movepool = fullMovepool(hero.id, hero.moveIds);
              return (
                <div key={hero.id} className="roster-mgmt-card" style={{ borderLeftColor: getTypeColor(hero.types[0]) }}>
                  <div className="roster-mgmt-head">
                    <div className="roster-mgmt-name">{hero.name}</div>
                    <div className="roster-card-types">
                      {hero.types.map((t) => (
                        <span key={t} className="type-tag" style={{ color: getTypeColor(t) }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section-title">Stats</div>
                  <StatBars baseStats={hero.baseStats} />

                  <div className="detail-section-title">Movepool</div>
                  <div className="detail-modifier-list">
                    {movepool.map((id) => {
                      const move = moves[id];
                      return (
                        <span
                          key={id}
                          className="detail-status-chip"
                          style={move ? { color: getTypeColor(move.type), borderColor: getTypeColor(move.type) } : undefined}
                        >
                          {move?.name ?? id}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
