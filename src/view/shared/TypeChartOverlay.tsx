import { TYPES, typeChart } from '../../data/typechart';
import { TypeBadge } from './TypeBadge';

interface Props {
  onClose: () => void;
}

function multClass(mult: number): string {
  if (mult > 1) return 'eff-super';
  if (mult < 1) return 'eff-resist';
  return 'eff-neutral';
}

function formatCell(mult: number): string {
  return mult === 1 ? '–' : `${mult}`;
}

/**
 * Full 15x15 type effectiveness matrix (src/data/typechart.ts), reachable
 * from every screen that benefits from a type-matchup lookup (title, map,
 * squad-select/battle-preview, combat). Rows are the attacker's type,
 * columns are the defender's — same axis order as effectivenessAgainst in
 * FightScreen. Read-only: this is the current fixture chart, not the
 * authored balance content (see typechart.ts's placeholder warning).
 */
export function TypeChartOverlay({ onClose }: Props) {
  return (
    <div className="log-overlay" onClick={onClose}>
      <div className="log-panel type-chart-panel" onClick={(e) => e.stopPropagation()}>
        <div className="log-panel-header">
          <span>Type Chart</span>
          <button className="log-close-button" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="type-chart-scroll">
          <div className="type-chart-grid">
            <div className="tc-cell tc-corner" />
            {TYPES.map((col) => (
              <div className="tc-cell tc-col-header" key={col}>
                <TypeBadge type={col} />
              </div>
            ))}
            {TYPES.map((row) => (
              <div className="tc-row" key={row}>
                <div className="tc-cell tc-row-header">
                  <TypeBadge type={row} />
                </div>
                {TYPES.map((col) => {
                  const mult = typeChart[row][col];
                  return (
                    <div className={`tc-cell tc-value ${multClass(mult)}`} key={col}>
                      {formatCell(mult)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
