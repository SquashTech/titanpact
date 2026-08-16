import { useState } from 'react';
import { heroes } from '../../data/heroes';
import { allCombatants } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import type { RunState, RosterEntry } from '../../run/state';
import type { Squad } from '../../run/squad';
import { pickSquad } from '../../run/squad';
import type { Encounter } from '../../run/enemyGen';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';

interface Props {
  run: RunState;
  /** This node's already-generated encounter (src/run/enemyGen.ts) — generated at node-select time (App.tsx) specifically so the enemy squad can be scouted here, before the player commits a squad. */
  encounter: Encounter;
  onConfirm: (squad: Squad) => void;
}

/**
 * Bring-6-pick-4 squad selection (docs/combat.md "Bring-6-pick-4
 * sideboard"), shown before every fight/elite/boss map node (docs/run-loop.md)
 * — team-preview-style, matching CLAUDE.md's VGC framing rather than a
 * once-per-run pick. Guild Hall recruitment lives exclusively behind `shop`
 * map nodes now (ShopNodeScreen) — deliberately NOT embedded here, so it
 * stays a map choice rather than being freely available before every fight.
 * Recruit Contracts are claimed off a beaten enemy at fight's end
 * (FightScreen), not bought up front. Also shows the scouted enemy squad
 * (playtest ask: see who you might face before committing) with the same
 * info-button stat-preview pattern as the player's own roster.
 */
export function SquadSelectScreen({ run, encounter, onConfirm }: Props) {
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [inspecting, setInspecting] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

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
      <div className="screen-scroll">
        <h2>Pick your squad ({pickedIds.length}/4)</h2>
        <p className="hint">First two picks start active; the rest start on the bench.</p>
        <div className="roster-grid">
          {run.roster.map((entry) => {
            const hero = heroes[entry.heroId];
            const pickIndex = pickedIds.indexOf(entry.rosterId);
            const picked = pickIndex !== -1;
            const equippedCount = Object.values(entry.equipment).filter(Boolean).length;
            return (
              <div
                key={entry.rosterId}
                className={`roster-card${picked ? ' picked' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => toggle(entry.rosterId)}
              >
                <button
                  className="info-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInspecting({ hero, entry });
                  }}
                  aria-label={`View ${hero.name} details`}
                >
                  i
                </button>
                <div className="roster-card-name">
                  {hero.name} <span className="hint">Lv {entry.level}</span>
                </div>
                <div className="roster-card-types">{hero.types.join('/')}</div>
                {equippedCount > 0 && (
                  <div className="roster-card-equip">
                    {equippedCount} item{equippedCount > 1 ? 's' : ''} equipped
                  </div>
                )}
                {picked && <span className="roster-card-badge">{pickIndex < 2 ? 'ACTIVE' : 'BENCH'}</span>}
              </div>
            );
          })}
        </div>

        <h2>Scouted enemies</h2>
        <p className="hint">Who you may face this fight.</p>
        <div className="roster-grid">
          {encounter.run.roster.map((entry) => {
            const hero = allCombatants[entry.heroId];
            const isBench = !encounter.squad.activeIds.includes(entry.rosterId);
            return (
              <div key={entry.rosterId} className="roster-card enemy-scout-card">
                <button
                  className="info-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInspecting({ hero, entry });
                  }}
                  aria-label={`View ${hero.name} details`}
                >
                  i
                </button>
                <div className="roster-card-name">
                  {hero.name} <span className="hint">Lv {entry.level}</span>
                </div>
                <div className="roster-card-types">{hero.types.join('/')}</div>
                <span className="roster-card-badge">{isBench ? 'BENCH' : 'ACTIVE'}</span>
              </div>
            );
          })}
        </div>
      </div>
      <button className="resolve-button" disabled={pickedIds.length === 0} onClick={handleConfirm}>
        Start Fight
      </button>

      {inspecting && (
        <HeroPreviewOverlay
          hero={inspecting.hero}
          entry={inspecting.entry}
          equipmentLookup={equipment}
          onClose={() => setInspecting(null)}
        />
      )}
    </div>
  );
}
