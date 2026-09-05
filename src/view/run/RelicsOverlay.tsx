import { gemRelics, relics } from '../../data/relics';
import { passives } from '../../data/passives';
import { RelicIcon } from '../shared/EquipmentBox';
import { stackedGrantSummary, stackedRelicName } from '../shared/relicStacks';

interface Props {
  ownedRelicIds: readonly string[];
  onClose: () => void;
}

/** Duplicates render as one card carrying the summed total. */
function countRelics(ownedRelicIds: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of ownedRelicIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

export function RelicsOverlay({ ownedRelicIds, onClose }: Props) {
  const counts = countRelics(ownedRelicIds);
  const gemIds = new Set(gemRelics.map((gem) => gem.id));
  const groups = [...counts.entries()]
    .filter(([relicId]) => !gemIds.has(relicId))
    .map(([relicId, count]) => ({ relicId, count }));

  return (
    <div className="log-overlay" onClick={onClose}>
      <div className="log-panel relics-panel" onClick={(e) => e.stopPropagation()}>
        <div className="log-panel-header">
          <span>Relics</span>
          <button className="log-close-button" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="relics-grid">
          {/* All eight, held or not: a run collects Gems steadily enough that the empty slots are a
              plan rather than a blank — the player can see what is still out there to stack. */}
          <div className="relics-section-label">Gems</div>
          <div className="gem-rail">
            {gemRelics.map((gem) => {
              const count = counts.get(gem.id) ?? 0;
              return (
                <div key={gem.id} className={`gem-chip${count > 0 ? '' : ' is-empty'}`}>
                  <RelicIcon relicId={gem.id} className="gem-chip-icon" />
                  <span className="gem-chip-name">
                    {gem.name} <span className="gem-chip-count">×{count}</span>
                  </span>
                  <span className="gem-chip-grant">{stackedGrantSummary(gem, count)}</span>
                </div>
              );
            })}
          </div>

          <div className="relics-section-label">Relics</div>
          {groups.length > 0 ? (
            groups.map(({ relicId, count }) => {
              const relic = relics[relicId];
              if (!relic) return null;
              // A stack states its summed grant; the authored description is written for one copy.
              const stackedTotal = count > 1 ? stackedGrantSummary(relic, count) : '';
              return (
                <div key={relicId} className="relic-card">
                  <div className="relic-card-head">
                    <RelicIcon relicId={relic.id} className="relic-card-icon" />
                    <span className="relic-card-name">{stackedRelicName(relic, count)}</span>
                  </div>
                  {stackedTotal ? (
                    <div className="relic-card-desc">Team-wide {stackedTotal}.</div>
                  ) : (
                    relic.description && <div className="relic-card-desc">{relic.description}</div>
                  )}
                  {relic.grantsPassiveIds && relic.grantsPassiveIds.length > 0 && (
                    <div className="relic-card-desc">
                      Grants:{' '}
                      {relic.grantsPassiveIds
                        .map((id) => passives[id]?.name ?? id)
                        .join(', ')}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="detail-empty">No relics yet — they'll show up as map rewards.</div>
          )}
        </div>
      </div>
    </div>
  );
}
