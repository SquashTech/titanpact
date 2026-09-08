import { useState, type CSSProperties } from 'react';
import type { RunState } from '../../run/state';
import { SEAL_ACTS } from '../../run/state';
import { reachableNodeIds } from '../../run/runProgress';
import { unseenCount } from '../../run/equipment';
import type { MapNode, RunMap } from '../../run/map';
import { RosterManagementScreen } from './RosterManagementScreen';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';
import { ResourceGlyph, type ResourceKind } from '../shared/RunGlyph';
import { HubGlyph, NodeGlyph } from '../shared/nodeIcons';
import { MapRoute } from './MapRoute';
import { NODE_COLORS, NODE_NAMES, nodeRewardText } from './mapNodes';
import { canAffordAnyLevelUp } from '../../run/progression';
import { locationForAct } from '../../run/locations';
import type { LocationDefinition } from '../../data/locations';
import { LocationAmbience } from '../shared/LocationSky';
import { AudioSettings } from '../shared/AudioSettings';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onSelectNode: (nodeId: string) => void;
  /** Re-opens the Level Up screen for a pool the player banked rather than spent. */
  onOpenLevelUp: () => void;
  /** Leave to the title with the run saved here. Omit and the pause menu drops both quit entries. */
  onSaveAndQuit?: () => void;
  /** Discard the run and its save (two-tap armed). */
  onAbandonRun?: () => void;
}

/**
 * One run resource in the header track. Spendable XP is the only one with somewhere to go
 * from this screen, so it is the only one that is ever a button.
 */
function ResourceStat({ kind, label, value, onSpend }: { kind: ResourceKind; label: string; value: number; onSpend?: () => void }) {
  const body = (
    <>
      <ResourceGlyph kind={kind} />
      <span className="map-stat-value">{value}</span>
    </>
  );
  if (!onSpend) {
    return (
      <span className="map-stat" aria-label={`${label}: ${value}`}>
        {body}
      </span>
    );
  }
  return (
    <button type="button" className="map-stat is-spendable" onClick={onSpend} aria-label={`${label}: ${value} — spend now`} title="Spend XP">
      {body}
    </button>
  );
}

/**
 * How far to the Guardian, one pip per row. It replaces the thing the whole-map view gave away
 * for free and the only thing worth keeping from it — an act's LENGTH. The last pip is the
 * Guardian itself, drawn rather than dotted, because "how many more" and "what is at the end"
 * are the same question.
 */
function ProgressRail({ map, currentRow }: { map: RunMap; currentRow: number }) {
  const bossRow = map.rows.length - 1;
  return (
    <div className="map-rail" aria-label={`Row ${currentRow + 1} of ${map.rows.length}`}>
      {map.rows.map((_, row) => {
        const state = row < currentRow ? 'is-done' : row === currentRow ? 'is-here' : '';
        if (row === bossRow) {
          return (
            <span key={row} className={`map-rail-boss ${state}`} style={{ '--node-color': NODE_COLORS.boss } as CSSProperties}>
              <NodeGlyph type="boss" className="map-rail-boss-glyph" />
            </span>
          );
        }
        return <span key={row} className={`map-rail-pip ${state}`} aria-hidden="true" />;
      })}
    </div>
  );
}

/** What a hold says: which place this is, and what it pays. The only words on the screen. */
function MapNodePreviewPopup({ node, onClose }: { node: MapNode; onClose: () => void }) {
  return (
    <div className="log-overlay" onClick={onClose}>
      <div className="log-panel move-popup-panel" style={{ '--node-color': NODE_COLORS[node.type] } as CSSProperties}>
        <div className="log-panel-header">
          <span>
            <NodeGlyph type={node.type} className="map-popup-glyph" /> {NODE_NAMES[node.type]}
          </span>
        </div>
        <div className="move-popup-description">{nodeRewardText(node.type)}</div>
        <div className="move-popup-hint">Tap anywhere to close</div>
      </div>
    </div>
  );
}


// docs/locations.md §4 — the well carries the act's Location at a fraction of
// the arrival screen's strength.
const MAP_MOTE_DENSITY = 0.5;

// Bottom-left: the bottom row is a width-1 encounter tile that fits its column;
// the top row's Guardian tile spills into both neighbours.
function MapPlacard({ location }: { location: LocationDefinition }) {
  return (
    <div className="map-placard">
      <span className="map-placard-name">{location.name}</span>
      <span className="map-placard-faction">{location.faction}</span>
    </div>
  );
}

// The run's hub (docs/run-loop.md). Training Points are spent on LevelUpScreen,
// not here; a banked remainder on the map is normal.
export function MapScreen({ run, onRunChange, onSelectNode, onOpenLevelUp, onSaveAndQuit, onAbandonRun }: Props) {
  const [showRoster, setShowRoster] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  // Two taps to abandon: quitting is reversible now, but abandoning deletes the save.
  const [confirmingQuit, setConfirmingQuit] = useState(false);
  const [previewNode, setPreviewNode] = useState<MapNode | null>(null);
  const map = run.map;
  if (!map) return null;

  const location = locationForAct(run.locationIds, run.actNumber);
  const unopened = unseenCount(run.unseenItemIds, run.stash);

  // The whole view: where the player stands, and what they may take from here.
  const choiceIds = reachableNodeIds(run);
  const currentRow = run.currentNodeId != null ? map.nodes[run.currentNodeId]?.row ?? 0 : -1;
  const originNode = run.currentNodeId != null ? map.nodes[run.currentNodeId] ?? null : null;

  return (
    <div className="map-screen" data-location={location.id} style={{ '--node-rgb': location.tintRgb } as CSSProperties}>
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
        <div className="map-purse">
          <ResourceStat kind="gold" label="Gold" value={run.gold} />
          <ResourceStat
            kind="xp"
            label="Unspent XP"
            value={run.levelUpPool}
            onSpend={canAffordAnyLevelUp(run) ? onOpenLevelUp : undefined}
          />
          <ResourceStat kind="contract" label="Recruit Contracts" value={run.recruitContracts} />
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
        <LocationAmbience location={location} density={MAP_MOTE_DENSITY} className="map-atmosphere" />
        <MapPlacard location={location} />

        <ProgressRail map={map} currentRow={currentRow} />

        <MapRoute
          map={map}
          originNode={originNode}
          omen={location.omen}
          choiceIds={choiceIds}
          onSelectNode={onSelectNode}
          onPreviewNode={setPreviewNode}
        />
      </div>

      {/* One button, because there is one thing down here worth opening: the run's own sheet —
          Banners, Gems, every hero and every item on them (2026-09-07, per user direction).
          It also carries the bag's badge: gear no longer stops the run to be handed out, so this
          is the only place the run says one is waiting (docs/progression.md). */}
      <div className="map-footer">
        <button
          className="map-footer-button"
          style={{ '--btn-color': 'var(--ally)' } as CSSProperties}
          onClick={() => setShowRoster(true)}
        >
          <span className="map-footer-icon"><HubGlyph name="roster" /></span>
          <span className="map-footer-label">Roster</span>
          {unopened > 0 && (
            <span className="map-footer-badge" aria-label={`${unopened} unopened ${unopened === 1 ? 'item' : 'items'} in your bag`}>
              {unopened === 1 ? '!' : unopened}
            </span>
          )}
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
                    🚪
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
                    {confirmingQuit ? '⚠' : '🗑'}
                  </span>
                  {confirmingQuit ? 'Tap again to abandon' : 'Abandon Run'}
                </button>
              )}
            </div>
            {onAbandonRun && (
              <p className="options-note">
                {confirmingQuit
                  ? 'This run ends now. Roster, Banners, Gems and map progress are lost.'
                  : 'The run is saved here. Quitting keeps it — Continue picks it back up.'}
              </p>
            )}
          </div>
        </div>
      )}

      {showRoster && <RosterManagementScreen run={run} onRunChange={onRunChange} onClose={() => setShowRoster(false)} />}
      {showReference && <ReferenceOverlay onClose={() => setShowReference(false)} />}
      {previewNode && <MapNodePreviewPopup node={previewNode} onClose={() => setPreviewNode(null)} />}
    </div>
  );
}
