import { useState, type CSSProperties } from 'react';
import type { RunState } from '../../run/state';
import { SEAL_ACTS } from '../../run/state';
import { reachableNodeIds } from '../../run/runProgress';
import { mergeablePairIndices, unseenCount } from '../../run/equipment';
import { equipment } from '../../data/equipment';
import type { MapNode, MapNodeType, RunMap } from '../../run/map';
import { RosterManagementScreen } from './RosterManagementScreen';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';
import { ResourceGlyph, type ResourceKind } from '../shared/RunGlyph';
import { HubGlyph, NodeGlyph } from '../shared/nodeIcons';
import { MapRoute } from './MapRoute';
import { BannerShelf } from './BannerShelf';
import { NODE_COLORS, NODE_NAMES, NODE_TIERS, nodeRewardText, type NodeTier } from './mapNodes';
import { levelAfterEncounters } from '../../run/growth';
import { footerWaiting } from './mapFooter';
import { locationForAct } from '../../run/locations';
import type { LocationDefinition } from '../../data/locations';
import { LocationAmbience } from '../shared/LocationSky';
import { AudioSettings } from '../shared/AudioSettings';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onSelectNode: (nodeId: string) => void;
  /** Leave to the title with the run saved here. Omit and the pause menu drops both quit entries. */
  onSaveAndQuit?: () => void;
  /** Discard the run and its save (two-tap armed). */
  onAbandonRun?: () => void;
}

/**
 * One run resource in the header track. Every one of them is a pure readout — nothing in the
 * purse is spendable from here any more, now that a Scroll is poured where it is won.
 */
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

/**
 * What the footer button is lit in, per inbox (mapFooter.ts). Unread gear keeps the alarm red it
 * has always had; a merge waiting is the tier palette's own gold, because what it is announcing is
 * a tier — and the two must not be the same colour, or the button changing its mind about what it
 * is called is the only thing separating them.
 */
const FOOTER_COLORS = {
  rest: 'var(--ally)',
  items: 'var(--physical)',
  merges: 'var(--tier-legendary)',
} as const;

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

// The run's hub (docs/run-loop.md). Levels are automatic (run/growth.ts) and nothing is spent
// here — the header states where the run stands, the purse states what is still to hand out.
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
  const unopened = unseenCount(run.unseenItemIds, run.stash);
  // The roster's PAR, which under automatic levelling is everyone but a late joiner. Read off the
  // roster rather than off the curve so it is right for a hero the curve does not describe — a
  // contract recruit arriving at act level, or a fixture. Falls back to the curve for an empty one.
  const rosterLevel = run.roster.reduce((best, entry) => Math.max(best, entry.level), levelAfterEncounters(run.encountersWon));
  const waiting = footerWaiting(unopened, mergeablePairIndices(run.stash, equipment, run.actNumber).size / 2);

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
          {/* No Scroll chip: since 2026-09-10 a Scroll is poured the moment it is won and never
              held, so the count here would read 0 for the whole run (docs/growth-overhaul.md §4). */}
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
        <BannerShelf run={run} />

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
          Banners, every hero and every item on them (2026-09-07, per user direction). Gear
          never stops the run to be handed out, so this is the only place the run says any is
          waiting (docs/progression.md). */}
      <div className="map-footer">
        <button
          className={`map-footer-button${waiting.total > 0 ? ' has-unopened' : ''}`}
          // Inline, so it has to carry the alert colour too: a custom property set here outranks
          // anything .has-unopened could say about it from the stylesheet.
          style={{ '--btn-color': FOOTER_COLORS[waiting.kind] } as CSSProperties}
          onClick={() => setRosterOpen(true)}
        >
          <span className="map-footer-icon"><HubGlyph name="roster" /></span>
          {/* The label says what is waiting, not where you are going. A badge alone is a mark the
              eye can learn to skip; a button that has changed its mind about what it is called
              cannot be skipped, and gear left in the bag is a hero fighting an act without it. */}
          <span className="map-footer-label">{waiting.label}</span>
          {waiting.total > 0 && (
            <span className="map-footer-badge" aria-label={waiting.aria}>
              {waiting.total}
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
                  ? 'This run ends now. Roster, Banners and map progress are lost.'
                  : 'The run is saved here. Quitting keeps it — Continue picks it back up.'}
              </p>
            )}
          </div>
        </div>
      )}

      {rosterOpen && <RosterManagementScreen run={run} onRunChange={onRunChange} onClose={() => setRosterOpen(false)} />}
      {showReference && <ReferenceOverlay onClose={() => setShowReference(false)} />}
      {previewNode && <MapNodePreviewPopup node={previewNode} onClose={() => setPreviewNode(null)} />}
    </div>
  );
}
