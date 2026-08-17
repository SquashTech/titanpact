import { useState } from 'react';
import { heroes } from '../../data/heroes';
import { allCombatants } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import type { RunState, RosterEntry } from '../../run/state';
import type { Squad } from '../../run/squad';
import { pickSquad, requiredSquadSize } from '../../run/squad';
import { rosterEntryTypes } from '../../run/progression';
import type { Encounter } from '../../run/enemyGen';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { getTypeColor } from '../combat/typeColors';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeChartOverlay } from '../shared/TypeChartOverlay';

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
  const [showTypeChart, setShowTypeChart] = useState(false);
  const required = requiredSquadSize(run.roster.length);

  function toggle(rosterId: string) {
    setPickedIds((prev) => {
      if (prev.includes(rosterId)) return prev.filter((id) => id !== rosterId);
      if (prev.length >= required) return prev;
      return [...prev, rosterId];
    });
  }

  function handleConfirm() {
    onConfirm(pickSquad(run.roster, pickedIds));
  }

  return (
    <div className="squad-select">
      <div className="map-header">
        <button className="log-toggle-button" onClick={() => setShowTypeChart(true)}>
          Type Chart
        </button>
      </div>
      <div className="screen-scroll">
        {/* Enemies first, mirroring the combat screen's enemy-row-on-top layout —
            scout the threat before committing a squad against it. */}
        <div className="squad-section squad-section-enemy">
          <h2 className="squad-section-title">⚔️ Scouted Enemies</h2>
          <div className="enemy-scout-grid">
            {encounter.run.roster.map((entry) => {
              const hero = allCombatants[entry.heroId];
              const isBench = !encounter.squad.activeIds.includes(entry.rosterId);
              return (
                <button
                  key={entry.rosterId}
                  className={`enemy-scout-chip${isBench ? ' enemy-scout-chip-bench' : ''}`}
                  style={{ borderColor: getTypeColor(hero.types[0]) }}
                  onClick={() => setInspecting({ hero, entry })}
                  aria-label={`View ${hero.name} details`}
                >
                  <HeroPortrait heroId={hero.id} className="enemy-scout-portrait" />
                  <div className="enemy-scout-types">
                    {rosterEntryTypes(hero, entry).map((t) => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="squad-vs-divider">VS</div>

        <div className="squad-section squad-section-player">
          <h2 className="squad-section-title">🛡️ Pick Your Squad ({pickedIds.length}/{required})</h2>
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
                  style={{ borderLeftColor: getTypeColor(hero.types[0]) }}
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
                  <HeroPortrait heroId={hero.id} className="roster-card-portrait" />
                  <div className="roster-card-name">
                    {hero.name} <span className="hint">Lv {entry.level}</span>
                  </div>
                  <div className="roster-card-types">
                    {rosterEntryTypes(hero, entry).map((t) => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </div>
                  {equippedCount > 0 && (
                    <div className="roster-card-equip">
                      {equippedCount} item{equippedCount > 1 ? 's' : ''} equipped
                    </div>
                  )}
                  {picked && <span className="roster-card-badge badge-ally">{pickIndex < 2 ? 'ACTIVE' : 'BENCH'}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <button className="resolve-button" disabled={pickedIds.length !== required} onClick={handleConfirm}>
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
      {showTypeChart && <TypeChartOverlay onClose={() => setShowTypeChart(false)} />}
    </div>
  );
}
