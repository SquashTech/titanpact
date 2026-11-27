import { patronColor, patronOfNode } from './patronView';
import { trustOf } from '../../run/patrons';
import { useState, type CSSProperties } from 'react';
import type { RunState } from '../../run/state';
import { SEAL_ACTS } from '../../run/state';
import { reachableNodeIds } from '../../run/runProgress';
import { equipment } from '../../data/equipment';
import type { MapNodeType } from '../../run/map';
import { RosterManagementScreen } from './RosterManagementScreen';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';
import { ResourceGlyph, type ResourceKind } from '../shared/RunGlyph';
import { HubGlyph, NodeGlyph } from '../shared/nodeIcons';
import { rosterHeroes } from '../../data/content';
import { HeroPortrait } from '../shared/HeroPortrait';
import { formIdFor } from '../../run/progression';
import { ManaBar, WoundBar, entryHp, entryMana } from '../shared/WoundBar';
import { MapRoad } from './MapRoad';
import { BannerShelf } from './BannerShelf';
import { NodeDossier } from './NodeDossier';
import { nodeLensMark } from './nodeLens';
import { progressionTable } from '../../data/progression';
import { locationForAct } from '../../run/locations';
import { locationDomains, type LocationDefinition } from '../../data/locations';
import { ElementGlyph } from '../shared/elementIcons';
import { getTypeColor } from '../combat/typeColors';
import { LocationAmbience } from '../shared/LocationSky';
import { locationBackdrop } from '../shared/locationBackdrops';
import { AudioSettings } from '../shared/AudioSettings';
import { eliteDressingFor, nodeEncounter, scoutedParty } from '../../run/encounters';
import type { EliteDressing } from '../../run/eliteAffixes';
import { heroes } from '../../data/heroes';
import { encounterPools } from '../../run/deck';
import { enemies } from '../../data/enemies';
import { FIRST_CYCLE, cycleOf } from '../../run/cycles';
import { allCombatants } from '../../data/content';
import type { TypeId } from '../../engine/content';
import partyArt from '../../../art/ui/party.png';

/**
 * What the Skirmish and Elite tiles in front of the player preview: the typing of the squad
 * each one fields, from the same deterministic draw the tap will start (run/encounters.ts).
 * Only the hero-pool nodes — the mob layer's tier already says what a Monsters tile is.
 */
function scoutChoices(run: RunState, choiceIds: readonly string[]): Record<string, { party: (readonly TypeId[])[]; elite?: EliteDressing }> {
  const map = run.map!;
  const location = locationForAct(run.locationIds, run.actNumber);
  const scouted: Record<string, { party: (readonly TypeId[])[]; elite?: EliteDressing }> = {};
  // The same pools App.tsx hands the fight, or the tile would preview a different party.
  const pools = encounterPools(run, heroes, heroes);
  for (const id of choiceIds) {
    const node = map.nodes[id];
    if (!node || (node.type !== 'skirmish' && node.type !== 'elite')) continue;
    const encounter = nodeEncounter(node, { run, location, heroes: pools.heroes, strangers: pools.strangers, allCombatants, enemies, progression: progressionTable });
    scouted[id] = {
      party: scoutedParty(encounter, allCombatants),
      ...(node.type === 'elite' ? { elite: eliteDressingFor(map, id, run.actNumber, encounter, allCombatants) } : {}),
    };
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
  /** Set while saves are not landing whole: the menu key wears a mark and the menu says why. */
  saveTrouble?: string | null;
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
export function MapScreen({ run, onRunChange, onSelectNode, onSaveAndQuit, onAbandonRun, saveTrouble = null }: Props) {
  const [rosterOpen, setRosterOpen] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  // Two taps to abandon: quitting is reversible now, but abandoning deletes the save.
  const [confirmingQuit, setConfirmingQuit] = useState(false);
  const map = run.map;
  if (!map) return null;

  const location = locationForAct(run.locationIds, run.actNumber);

  // The whole view: where the player stands, and what they may take from here.
  const choiceIds = reachableNodeIds(run);
  const scouted = scoutChoices(run, choiceIds);
  const [reading, setReading] = useState<MapNodeType | null>(null);

  return (
    <div className="map-screen is-road" data-location={location.id} style={{ '--node-rgb': location.tintRgb } as CSSProperties}>
      {/* The act's weather and ground, at SCREEN level rather than inside the well (2026-09-10).
          It used to be the well's first child, so the place stopped at a frame two-thirds of the
          way up the phone and the header sat outside the weather — which is what made the map read
          as a picture of a place rather than as one. */}
      <LocationAmbience location={location} density={MAP_MOTE_DENSITY} className="map-atmosphere" painted />
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
        <div className="map-act-group">
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
          {run.cycle > FIRST_CYCLE && (
            <span className="map-act" aria-label={`Cycle ${cycleOf(run.cycle).numeral}`} title={cycleOf(run.cycle).line}>
              <span className="map-act-label">Cycle</span>
              <span className="map-act-count">{cycleOf(run.cycle).numeral}</span>
            </span>
          )}
        </div>
        <div className="map-purse">
          <ResourceStat kind="hpPotion" label="HP Potions" value={run.consumables.hpPotion} />
          <ResourceStat kind="mpPotion" label="MP Potions" value={run.consumables.mpPotion} />
        </div>
        <button
          type="button"
          className={`map-header-button${saveTrouble ? ' has-save-trouble' : ''}`}
          onClick={() => {
            setConfirmingQuit(false);
            setShowMenu(true);
          }}
          aria-label={saveTrouble ? 'Options — the run is not saving' : 'Options'}
          title="Options"
        >
          <HubGlyph name="menu" />
        </button>
      </div>

      <MapRoad
        map={map}
        currentNodeId={run.currentNodeId}
        visitedNodeIds={run.visitedNodeIds}
        choiceIds={choiceIds}
        actNumber={run.actNumber}
        guardianId={location.guardianFinalEnemyId}
        painting={locationBackdrop(location.id, 'map')}
        leadHeroId={run.roster[0]?.heroId}
        onSelectNode={onSelectNode}
        renderDossier={(node) => <NodeDossier node={node} run={run} party={scouted[node.id]?.party} elite={scouted[node.id]?.elite} />}
        patronFor={(node) => {
          const patron = patronOfNode(run, node);
          return patron ? { id: patron.id, title: patron.title, name: patron.name, color: patronColor(patron.id), trust: trustOf(run, patron.id) } : null;
        }}
        onPreviewChange={(node) => setReading(node?.type ?? null)}
      />

      <div className="map-well">
        <MapPlacard location={location} />
        <BannerShelf run={run} />
      </div>

      {/* One button, because there is one thing down here worth opening: the run's own sheet —
          Banners, every hero and every item on them (2026-09-07, per user direction). Nothing
          ever waits behind it: gear is absorbed where it arrives (docs/gear-absorption.md). */}
      <div className="map-footer">
        <button className="map-footer-button" style={{ '--btn-color': 'var(--ally)' } as CSSProperties} onClick={() => setRosterOpen(true)}>
          <span className="map-footer-cap">
            <img src={partyArt} className="map-footer-emblem" alt="" draggable={false} />
            <span className="map-footer-label">Roster</span>
          </span>
          {/* The party, where the act has left it (run/wounds.ts): HP carries between fights, so
              the one button under the map wears the six bars rather than hiding them behind a tap. */}
          <span className="map-footer-party" aria-label="Party health">
            {run.roster.map((entry) => {
              const hero = rosterHeroes[entry.heroId];
              const { hp, maxHp } = entryHp(hero, entry, run.relics);
              // While a tile is read, the chip wears what that node turns on (nodeLens.tsx).
              const lens = reading ? nodeLensMark(reading, entry, run) : null;
              return (
                <span
                  key={entry.rosterId}
                  className={`map-party-chip${entry.down ? ' is-down' : ''}${lens?.dim ? ' is-dim' : ''}`}
                  aria-label={entry.down ? `${hero.name}: down` : `${hero.name}: ${hp} of ${maxHp} HP`}
                >
                  <HeroPortrait heroId={hero.id} pathId={formIdFor(entry)} className="map-party-portrait" />
                  {lens?.badge && <span className="map-party-badge">{lens.badge}</span>}
                  {lens?.bar ?? <WoundBar hp={hp} maxHp={maxHp} />}
                  {!lens?.bar && !entry.down && <ManaBar {...entryMana(hero, entry, run.relics)} />}
                </span>
              );
            })}
          </span>
        </button>
      </div>

      {/* Same markup as FightScreen's Options panel. */}
      {showMenu && (
        <div className="log-overlay" onClick={() => setShowMenu(false)}>
          <div className="log-panel options-panel is-gilt-sheet" onClick={(e) => e.stopPropagation()}>
            <h3 className="gilt-dialog-title">Options</h3>
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
                  Save & Quit to Title
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
                  : saveTrouble ?? 'The run is saved here. Quitting keeps it — Continue picks it back up.'}
              </p>
            )}
          </div>
        </div>
      )}

      {rosterOpen && <RosterManagementScreen run={run} onRunChange={onRunChange} onClose={() => setRosterOpen(false)} />}
      {showReference && <ReferenceOverlay onClose={() => setShowReference(false)} />}
    </div>
  );
}
