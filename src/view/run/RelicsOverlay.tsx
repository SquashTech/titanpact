import { relics } from '../../data/relics';
import { passives } from '../../data/passives';
import { RelicIcon } from '../shared/EquipmentBox';
import { passiveEmoji } from '../shared/passiveIcons';
import { stackedGrantSummary, stackedRelicName } from '../shared/relicStacks';

interface Props {
  ownedRelicIds: readonly string[];
  onClose: () => void;
}

/** Counts each distinct relic id, so duplicates render as ONE card carrying the summed total rather than N identical cards — same pattern as RosterManagementScreen's groupInventory. */
function groupRelics(ownedRelicIds: readonly string[]): { relicId: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const id of ownedRelicIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()].map(([relicId, count]) => ({ relicId, count }));
}

/**
 * Read-only relic collection view, reachable from the map header's Relics
 * button. Relics are minimal and stat-only for this pass (CLAUDE.md "Relics
 * are team-wide passives", docs/run-loop.md "Relics: minimal, stat-only") —
 * this overlay just lists what's owned; there's no per-relic management
 * since relics aren't assigned or unequipped like gear.
 */
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
              // A stack renames itself ("Banner of Vitality +2") and states
              // its summed grant, because the authored description is written
              // for a single copy and would otherwise read as a third of what
              // the team is actually getting. No separate ×N badge alongside
              // it: two counters in two different bases for one fact.
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
                        .map((id) => `${passiveEmoji[id] ? `${passiveEmoji[id]} ` : ''}${passives[id]?.name ?? id}`)
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
