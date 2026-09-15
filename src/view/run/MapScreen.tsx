import { useState, type CSSProperties } from 'react';
import type { RunState } from '../../run/state';
import { SEAL_ACTS } from '../../run/state';
import { reachableNodeIds } from '../../run/runProgress';
import { equipment } from '../../data/equipment';
import type { MapNode, MapNodeType, RunMap } from '../../run/map';
import { RosterManagementScreen } from './RosterManagementScreen';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';
import { ResourceGlyph, type ResourceKind } from '../shared/RunGlyph';
import { HubGlyph, NodeGlyph } from '../shared/nodeIcons';
import { rosterHeroes } from '../../data/content';
import { HeroPortrait } from '../shared/HeroPortrait';
import { WoundBar, entryHp } from '../shared/WoundBar';
import { MapRoute } from './MapRoute';
import { BannerShelf } from './BannerShelf';
import { NODE_COLORS, NODE_NAMES, NODE_TIERS, type NodeTier } from './mapNodes';
import { NodeDossierOverlay } from './NodeDossierOverlay';
import { levelAfterEncounters, levelOf } from '../../run/growth';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import { locationForAct } from '../../run/locations';
import { locationDomains, type LocationDefinition } from '../../data/locations';
import { ElementGlyph } from '../shared/elementIcons';
import { getTypeColor } from '../combat/typeColors';
import { LocationAmbience } from '../shared/LocationSky';
import { AudioSettings } from '../shared/AudioSettings';
import { nodeEncounter, scoutedTypes } from '../../run/encounters';
import { tutorialEncounterFor } from '../../run/tutorial';
import { TUTORIAL_ENCOUNTERS } from '../../data/tutorial';
import { heroes } from '../../data/heroes';
import { enemies } from '../../data/enemies';
import { allCombatants } from '../../data/content';
import type { TypeId } from '../../engine/content';

/**
 * What the Skirmish and Elite tiles in front of the player preview: the typing of the squad
 * each one fields, from the same deterministic draw the tap will start (run/encounters.ts).
 * Only the hero-pool nodes — the mob layer's tier already says what a Monsters tile is.
 */
function scoutChoices(run: RunState, choiceIds: readonly string[]): Record<string, TypeId[]> {
  const map = run.map!;
  const location = locationForAct(run.locationIds, run.actNumber);
  const scouted: Record<string, TypeId[]> = {};
  for (const id of choiceIds) {
    const node = map.nodes[id];
    if (!node || (node.type !== 'skirmish' && node.type !== 'elite')) continue;
    const scripted = tutorialEncounterFor(TUTORIAL_ENCOUNTERS, run, node.type);
    const encounter = nodeEncounter(node, { run, location, heroes, allCombatants, enemies, progression: progressionTable, scripted });
    scouted[id] = scoutedTypes(encounter, allCombatants);
  }
  return scouted;
}

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onSelectNode: (nodeId: string) => void;
  /** Leave to the title with the run saved here. Omit and the pause menu drops both quit entries. */
  onSaveAndQuit?: () => void;
  /** Discard the run and its save (two-tap armed). */
  onAbandonRun?: () => void;
}

/** One run resource in the header track. */
function ResourceStat({ kind, label, value }: { kind: ResourceKind; label: string; value: number }) {
  return (
    <span className="map-stat" aria-label={`${label}: ${value}`}>
      <ResourceGlyph kind={kind} />
      <span className="map-stat-value">{value}</span>
    </span>
  );
}

/** Worst case first: a row you may take an Elite on is a row to plan for an Elite on. */
const RAIL_TIER_RANK: Record<NodeTier, number> = { ancient: 0, encounter: 1, landmark: 2, reward: 3 };

/** The one node kind a row is worth being warned about, out of the two or three it offers. */
function railTypeFor(map: RunMap, row: number): MapNodeType {
  return map.rows[row]
    .map((id) => map.nodes[id].type)
    .reduce((best, type) => (RAIL_TIER_RANK[NODE_TIERS[type]] < RAIL_TIER_RANK[NODE_TIERS[best]] ? type : best));
}

/**
 * The act ahead, one mark per row. It replaces the thing the whole-map view gave away for free and
 * the only thing worth keeping from it — an act's SHAPE.
 *
 * It counted rows and nothing else until 2026-09-08 (per user direction), which answered "how far"
 * and left "how hard" to be discovered a row at a time. Every row is now marked by what it makes
 * you do: a bare dot for a row that only pays out, and the node's own glyph for one that does not —
 * every forced fight in the act, its kind and its difficulty, readable before the act starts. That
 * is the whole planning surface a scene-map can afford, and it costs no room the pips did not
 * already have.
 *
 * A row offering more than one thing is marked by the HARDEST of them, so the rail never
 * under-promises: the Elite-or-Battle row wears the Elite.
 */
function ProgressRail({ map, currentRow }: { map: RunMap; currentRow: number }) {
  return (
    <div className="map-rail" aria-label={`Row ${currentRow + 1} of ${map.rows.length}`}>
      {map.rows.map((_, row) => {
        const type = railTypeFor(map, row);
        const tier = NODE_TIERS[type];
        const state = row < currentRow ? 'is-done' : row === currentRow ? 'is-here' : '';
        if (tier === 'reward') {
          return <span key={row} className={`map-rail-pip ${state}`} aria-hidden="true" />;
        }
        return (
          <span
            key={row}
            className={`map-rail-mark tier-${tier} ${state}`}
            style={{ '--node-color': NODE_COLORS[type] } as CSSProperties}
            title={NODE_NAMES[type]}
          >
            <NodeGlyph type={type} className="map-rail-glyph" />
          </span>
        );
      })}
    </div>
  );
}

// docs/locations.md §4 — the well carries the act's Location at a fraction of
// the arrival screen's strength.
const MAP_MOTE_DENSITY = 0.5;

// Bottom-left: the bottom row is a width-1 encounter tile that fits its column;
// the top row's Guardian tile spills into both neighbours. Under the name, what spawns here —
// the marks rather than the words, since the placard is a quarter of the screen wide.
function MapPlacard({ location }: { location: LocationDefinition }) {
  const domains = locationDomains(location);
  return (
    <div className="map-placard">
      <span className="map-placard-name">{location.name}</span>
      <span className="map-placard-faction">
        {domains
          ? domains.map((type) => (
              <span key={type} style={{ color: getTypeColor(type) }} title={type}>
                <ElementGlyph type={type} />
              </span>
            ))
          : 'Every domain'}
      </span>
    </div>
  );
}

// The run's hub (docs/run-loop.md). Levels are automatic (run/growth.ts) and pay out on the
// level-up report, not here.
export function MapScreen({ run, onRunChange, onSelectNode, onSaveAndQuit, onAbandonRun }: Props) {
  const [rosterOpen, setRosterOpen] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  // Two taps to abandon: quitting is reversible now, but abandoning deletes the save.
  const [confirmingQuit, setConfirmingQuit] = useState(false);
  const [previewNode, setPreviewNode] = useState<MapNode | null>(null);
  const map = run.map;
  if (!map) return null;

  const location = locationForAct(run.locationIds, run.actNumber);
  // The roster's PAR, which under automatic levelling is everyone but a late joiner. Read off the
  // roster rather than off the curve so it is right for a hero the curve does not describe — a
  // contract recruit arriving at act level, or a fixture. Falls back to the curve for an empty one.
  const rosterLevel = run.roster.reduce((best, entry) => Math.max(best, levelOf(entry)), levelAfterEncounters(run.encountersWon));

  // The whole view: where the player stands, and what they may take from here.
  const choiceIds = reachableNodeIds(run);
  const scouted = scoutChoices(run, choiceIds);
  const currentRow = run.currentNodeId != null ? map.nodes[run.currentNodeId]?.row ?? 0 : -1;
  const originNode = run.currentNodeId != null ? map.nodes[run.currentNodeId] ?? null : null;

  return (
    <div className="map-screen" data-location={location.id} style={{ '--node-rgb': location.tintRgb } as CSSProperties}>
      {/* The act's weather and ground, at SCREEN level rather than inside the well (2026-09-10).
          It used to be the well's first child, so the place stopped at a frame two-thirds of the
          way up the phone and the header sat outside the weather — which is what made the map read
          as a picture of a place rather than as one. */}
      <LocationAmbience location={location} density={MAP_MOTE_DENSITY} className="map-atmosphere" />
      {/* Act on the left is a position, not a thing you hold; the purse on the right is. The two
          corners hold the screen's non-run controls, out of the way of the one that matters. */}
      <div className="map-header">
        <button
          type="button"
          className="map-header-button"
          onClick={() => setShowReference(true)}
          aria-label="Reference"
          title="Reference"
        >
          <HubGlyph name="reference" />
        </button>
        {/* Level is a property of the RUN, not of a hero: automatic levelling puts the whole
            roster on the same number, and a figure identical across six cards carries no
            information there. It reads here, beside the act, and per-hero only where a hero
            DEVIATES — a recruit that is behind (docs/growth-overhaul.md §4). */}
        {run.actNumber > SEAL_ACTS ? (
          // The finale is the corridor past the fifth seal, not a sixth act, so it counts nothing.
          <span className="map-act" aria-label="The final pact">
            <span className="map-act-label">Final</span>
            <span className="map-act-count">Pact</span>
          </span>
        ) : (
          <span className="map-act" aria-label={`Act ${run.actNumber} of ${SEAL_ACTS}`}>
            <span className="map-act-label">Act</span>
            <span className="map-act-count">
              {run.actNumber}
              <span className="map-act-total">/{SEAL_ACTS}</span>
            </span>
          </span>
        )}
        <span className="map-level" aria-label={`Roster level ${rosterLevel}`}>
          <span className="map-act-label">Lv</span>
          <span className="map-act-count">{rosterLevel}</span>
        </span>
        <div className="map-purse">
          <ResourceStat kind="gold" label="Gold" value={run.gold} />
          <ResourceStat kind="contract" label="Recruit Contracts" value={run.recruitContracts} />
          <ResourceStat kind="hpPotion" label="HP Potions" value={run.consumables.hpPotion} />
          <ResourceStat kind="mpPotion" label="MP Potions" value={run.consumables.mpPotion} />
        </div>
        <button
          type="button"
          className="map-header-button"
          onClick={() => {
            setConfirmingQuit(false);
            setShowMenu(true);
          }}
          aria-label="Options"
          title="Options"
        >
          <HubGlyph name="menu" />
        </button>
      </div>

      {/* The well is a scene now, not a diagram (2026-09-08, per user direction): the act's
          Location, the rail saying how far is left, and the two or three places the player may
          go from here. The whole-act graph — grid, measured edge overlay, scroll anchoring — is
          gone; `RunMap` and every rule that reads it are untouched, this was only ever the view. */}
      <div className="map-well">
        {/* Stays in the well, unlike the weather: the well's bottom edge IS the top of the footer
            button, so anchoring here is what keeps the place's name clear of it however many
            lines the name takes. */}
        <MapPlacard location={location} />
        <BannerShelf run={run} />

        <ProgressRail map={map} currentRow={currentRow} />

        <MapRoute
          map={map}
          originNode={originNode}
          omen={location.omen}
          choiceIds={choiceIds}
          scouted={scouted}
          actNumber={run.actNumber}
          onSelectNode={onSelectNode}
          onPreviewNode={setPreviewNode}
        />
      </div>

      {/* One button, because there is one thing down here worth opening: the run's own sheet —
          Banners, every hero and every item on them (2026-09-07, per user direction). Nothing
          ever waits behind it: gear is absorbed where it arrives (docs/gear-absorption.md). */}
      <div className="map-footer">
        <button className="map-footer-button" style={{ '--btn-color': 'var(--ally)' } as CSSProperties} onClick={() => setRosterOpen(true)}>
          <span className="map-footer-cap">
            <span className="map-footer-icon"><HubGlyph name="roster" /></span>
            <span className="map-footer-label">Roster</span>
          </span>
          {/* The party, where the act has left it (run/wounds.ts): HP carries between fights, so
              the one button under the map wears the six bars rather than hiding them behind a tap. */}
          <span className="map-footer-party" aria-label="Party health">
            {run.roster.map((entry) => {
              const hero = rosterHeroes[entry.heroId];
              const { hp, maxHp } = entryHp(hero, entry, run.relics);
              return (
                <span key={entry.rosterId} className="map-party-chip" aria-label={`${hero.name}: ${hp} of ${maxHp} HP`}>
                  <HeroPortrait heroId={hero.id} className="map-party-portrait" />
                  <WoundBar hp={hp} maxHp={maxHp} />
                </span>
              );
            })}
          </span>
        </button>
      </div>

      {/* Same markup as FightScreen's Options panel. */}
      {showMenu && (
        <div className="log-overlay" onClick={() => setShowMenu(false)}>
          <div className="log-panel options-panel" onClick={(e) => e.stopPropagation()}>
            <div className="log-panel-header">
              <span>Options</span>
              <button className="log-close-button" onClick={() => setShowMenu(false)}>
                ✕
              </button>
            </div>
            <div className="options-list">
              <AudioSettings />
              <button className="options-item" onClick={() => setShowMenu(false)}>
                <span className="options-item-glyph" aria-hidden="true">
                  ▶
                </span>
                Back to Map
              </button>
              {onSaveAndQuit && (
                <button className="options-item" onClick={onSaveAndQuit}>
                  <span className="options-item-glyph" aria-hidden="true">
                    <HubGlyph name="door" />
                  </span>
                  Save &amp; Quit to Title
                </button>
              )}
              {onAbandonRun && (
                <button
                  className={`options-item options-item-danger${confirmingQuit ? ' armed' : ''}`}
                  onClick={() => (confirmingQuit ? onAbandonRun() : setConfirmingQuit(true))}
                >
                  <span className="options-item-glyph" aria-hidden="true">
                    <HubGlyph name={confirmingQuit ? 'warn' : 'discard'} />
                  </span>
                  {confirmingQuit ? 'Tap again to abandon' : 'Abandon Run'}
                </button>
              )}
            </div>
            {onAbandonRun && (
              <p className="options-note">
                {confirmingQuit
                  ? 'This run ends now. Roster, Banners and map progress are lost.'
                  : 'The run is saved here. Quitting keeps it — Continue picks it back up.'}
              </p>
            )}
          </div>
        </div>
      )}

      {rosterOpen && <RosterManagementScreen run={run} onClose={() => setRosterOpen(false)} />}
      {showReference && <ReferenceOverlay onClose={() => setShowReference(false)} />}
      {previewNode && <NodeDossierOverlay node={previewNode} actNumber={run.actNumber} onClose={() => setPreviewNode(null)} />}
    </div>
  );
}
