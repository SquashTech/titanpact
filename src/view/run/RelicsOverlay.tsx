import { relics } from '../../data/relics';
import { passives } from '../../data/passives';
import { RelicIcon } from '../shared/EquipmentBox';
import { stackedGrantSummary, stackedRelicName } from '../shared/relicStacks';

interface Props {
  ownedRelicIds: readonly string[];
  onClose: () => void;
}

/** Duplicates render as one card carrying the summed total. */
function groupRelics(ownedRelicIds: readonly string[]): { relicId: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const id of ownedRelicIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()].map(([relicId, count]) => ({ relicId, count }));
}

export function RelicsOverlay({ ownedRelicIds, onClose }: Props) {
  const groups = groupRelics(ownedRelicIds);

  return (
    <div className="log-overlay" onClick={onClose}>
      <div className="log-panel relics-panel" onClick={(e) => e.stopPropagation()}>
        <div className="log-panel-header">
          <span>Relics</span>
          <button className="log-close-button" onClick={onClose}>
            ✕
          </button>
        </div>
        {groups.length > 0 ? (
          <div className="relics-grid">
            {groups.map(({ relicId, count }) => {
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
            })}
          </div>
        ) : (
          <div className="detail-empty">No relics yet — they'll show up as map rewards.</div>
        )}
      </div>
    </div>
  );
}
