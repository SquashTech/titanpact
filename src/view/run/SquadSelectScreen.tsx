import { useState } from 'react';
import { heroes } from '../../data/heroes';
import type { RunState } from '../../run/state';
import type { Squad } from '../../run/squad';
import { pickSquad } from '../../run/squad';

interface Props {
  run: RunState;
  onConfirm: (squad: Squad) => void;
}

/**
 * Bring-6-pick-4 squad selection (docs/combat.md "Bring-6-pick-4 sideboard").
 * Recruitment isn't built yet (README "Known gaps") so the roster passed in
 * is fixed for the session — this screen only implements the pick-4 step.
 */
export function SquadSelectScreen({ run, onConfirm }: Props) {
  const [pickedIds, setPickedIds] = useState<string[]>([]);

  function toggle(rosterId: string) {
    setPickedIds((prev) => {
      if (prev.includes(rosterId)) return prev.filter((id) => id !== rosterId);
      if (prev.length >= 4) return prev;
      return [...prev, rosterId];
    });
  }

  function handleConfirm() {
    onConfirm(pickSquad(run.roster, pickedIds));
  }

  return (
    <div className="squad-select">
      <h2>Pick your squad ({pickedIds.length}/4)</h2>
      <p className="hint">First two picks start active; the rest start on the bench.</p>
      <div className="roster-grid">
        {run.roster.map((entry) => {
          const hero = heroes[entry.heroId];
          const pickIndex = pickedIds.indexOf(entry.rosterId);
          const picked = pickIndex !== -1;
          const equippedCount = Object.values(entry.equipment).filter(Boolean).length;
          return (
            <button key={entry.rosterId} className={`roster-card${picked ? ' picked' : ''}`} onClick={() => toggle(entry.rosterId)}>
              <div className="roster-card-name">{hero.name}</div>
              <div className="roster-card-types">{hero.types.join('/')}</div>
              {equippedCount > 0 && <div className="roster-card-equip">{equippedCount} item{equippedCount > 1 ? 's' : ''} equipped</div>}
              {picked && <span className="roster-card-badge">{pickIndex < 2 ? 'ACTIVE' : 'BENCH'}</span>}
            </button>
          );
        })}
      </div>
      <button className="resolve-button" disabled={pickedIds.length === 0} onClick={handleConfirm}>
        Start Fight
      </button>
    </div>
  );
}
