import { useState, type CSSProperties } from 'react';
import type { RunState } from '../../run/state';
import { SEAL_ACTS } from '../../run/state';
import { reachableNodeIds } from '../../run/runProgress';
import type { MapNode, MapNodeType, RunMap } from '../../run/map';
import { RosterManagementScreen } from './RosterManagementScreen';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';
import { ResourceGlyph, type ResourceKind } from '../shared/RunGlyph';
import { HubGlyph, NodeGlyph } from '../shared/nodeIcons';
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

// Name carries recruitability (Monsters vs Skirmish); NODE_COLORS carries
// difficulty. The two channels are deliberately not redundant.
const NODE_NAMES: Record<MapNodeType, string> = {
  fight: 'Monsters',
  skirmish: 'Skirmish',
  battle: 'Monsters',
  elite: 'Skirmish',
  boss: 'Guardian',
  shop: 'Guild Hall',
  blacksmith: 'Blacksmith',
  equipmentReward: 'Item',
  gemReward: 'Gem',
  passiveReward: 'Boon',
  currencyReward: 'Gold',
  upgradeReward: 'XP',
  forgeReward: 'Forge',
  hpBoostReward: 'Vitality',
  manaBoostReward: 'Mana',
  classReward: 'Mentor',
  tutorReward: 'Tutor',
  event: 'Event',
  muster: 'The Vigil',
  finale: 'Endbringer',
};

// Stat-reward colours match StatBars' STAT_COLORS. `battle` stays `--ally`,
// not `--enemy`: two reds a shade apart on the Elite-or-Battle row was illegible.
const NODE_COLORS: Record<MapNodeType, string> = {
  fight: 'var(--enemy)',
  skirmish: 'var(--ally)',
  battle: 'var(--ally)',
  elite: 'var(--crit)',
  boss: 'var(--accent)',
  shop: 'var(--mana)',
  // A burnt copper beside the Forge's orange: same family (both are about what a hero can
  // carry), different silhouette tier, so they read as related rather than as each other.
  blacksmith: '#c67a4c',
  equipmentReward: 'var(--physical)',
  // A rose nothing else on the map wears: a Gem can be any stat, so it cannot borrow one stat's colour.
  gemReward: '#d9569b',
  // Arcane violet, the hue the whole passive vocabulary already sits on (passiveIcons' fallback).
  passiveReward: 'var(--magical)',
  currencyReward: 'var(--accent)',
  upgradeReward: 'var(--hp-high)',
  // Forge orange: the only node that hands out a permanent SLOT rather than a thing to put in one.
  forgeReward: '#f0913c',
  hpBoostReward: 'var(--hp-high)',
  manaBoostReward: 'var(--mana)',
  classReward: 'var(--buff)',
  // The only cyan on the map — the Tutor is rare enough that it should never be mistaken at a
  // glance for the Mana Well beside it.
  tutorReward: '#48c9e8',
  event: 'var(--tier-common)',
  muster: 'var(--accent)',
  // The only node in a run that wears the mythic red, because there is only one of it.
  finale: 'var(--tier-mythic)',
};

// The line under a choice card's name: what the node pays out, and nothing else. Difficulty
// rides on NODE_COLORS, recruitability on NODE_NAMES.
const NODE_DESCRIPTIONS: Record<MapNodeType, string> = {
  fight: '15–25g · 2 XP · item',
  skirmish: '15–25g · 4 XP · 25% item · recruitable',
  battle: '30–45g · 3 XP · item',
  elite: '15–25g · 4 XP · 55% elite item · recruitable — enemies carry +10 to 2 stats',
  boss: '4 XP · 70% elite item · 1 Recruit Contract',
  shop: 'Buy heroes, contracts and gear — and sell what you are not carrying',
  blacksmith: 'Buy an item slot, a tier at the Anvil, or an element at the Enchanter — acts 3+',
  equipmentReward: '1 of 3 items',
  gemReward: '1 of 3 Gems — each a team-wide +5 to one stat',
  passiveReward: '1 of 3 Boons, granted to one hero for the rest of the run',
  currencyReward: '15–30g',
  upgradeReward: '2 XP',
  forgeReward: '+1 item slot to one hero, for the rest of the run',
  hpBoostReward: '+20 max HP to one hero',
  manaBoostReward: 'Sapphire — team-wide +5 Mana Pool',
  classReward: '1 of 3 Classes, taught to one hero',
  tutorReward: 'One hero learns ANY move from its level-up pool — acts 4 and 5 only',
  event: 'Hidden until you arrive: a move, a passive, gear or a trade',
  muster: 'Fill the roster to six, then spend everything left',
  finale: 'The five seals you broke — then the thing they were holding',
};

// Every Guardian pays a Banner now that the finale act follows act 5 (App.tsx).
function nodeRewardText(type: MapNodeType): string {
  const base = NODE_DESCRIPTIONS[type];
  return type === 'boss' ? `${base} · Guardian’s Banner` : base;
}

// How much weight a choice card carries — the Guardian is not a Gem.
type NodeTier = 'reward' | 'encounter' | 'landmark' | 'ancient';

const NODE_TIERS: Record<MapNodeType, NodeTier> = {
  fight: 'encounter',
  skirmish: 'encounter',
  battle: 'encounter',
  elite: 'encounter',
  boss: 'ancient',
  shop: 'landmark',
  blacksmith: 'landmark',
  equipmentReward: 'reward',
  gemReward: 'reward',
  passiveReward: 'reward',
  currencyReward: 'reward',
  upgradeReward: 'reward',
  forgeReward: 'reward',
  hpBoostReward: 'reward',
  manaBoostReward: 'reward',
  classReward: 'reward',
  tutorReward: 'reward',
  event: 'reward',
  muster: 'landmark',
  finale: 'ancient',
};

/**
 * What a choice leads ON to (2026-09-08, per user direction). The map no longer shows the act;
 * it shows where you are and what you may take next. Two of the seven branch points in an act
 * actually route — measured, the rest reach the same places whichever option you pick — and both
 * of those price the choice in front of you against the one behind it: the reward row STEERS into
 * Elite-or-Battle, and which of those you take limits which of the next row's rewards you reach.
 *
 * Pricing only works if the price is visible before it is paid, which the whole map used to do
 * by being whole. This is what does it instead: each option carries what it opens, and only when
 * the options differ — if every choice on the row leads to the same places, the marker is noise
 * and is not drawn. Derived, never authored, so a change to the generator shows up here for free.
 */
function leadOnTypes(map: RunMap, nodeId: string): MapNodeType[] {
  const seen: MapNodeType[] = [];
  for (const nextId of map.nodes[nodeId]?.nextIds ?? []) {
    const type = map.nodes[nextId]?.type;
    if (type && !seen.includes(type)) seen.push(type);
  }
  return seen;
}

function leadOnsDiffer(map: RunMap, nodeIds: readonly string[]): boolean {
  if (nodeIds.length < 2) return false;
  const signature = (id: string) => leadOnTypes(map, id).join('+');
  const first = signature(nodeIds[0]);
  return nodeIds.some((id) => signature(id) !== first);
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

/**
 * One thing the player may go and do. Big, named and spelled out — the tiles dropped their
 * labels because twenty-five of them had to fit a well, and two or three do not.
 */
function ChoiceCard({
  map,
  node,
  showLeadOn,
  onSelect,
}: {
  map: RunMap;
  node: MapNode;
  showLeadOn: boolean;
  onSelect: () => void;
}) {
  const leadOns = showLeadOn ? leadOnTypes(map, node.id) : [];
  return (
    <button
      type="button"
      className={`map-choice tier-${NODE_TIERS[node.type]}`}
      style={{ '--node-color': NODE_COLORS[node.type] } as CSSProperties}
      onClick={onSelect}
    >
      <span className="map-choice-glyph">
        <NodeGlyph type={node.type} />
      </span>
      <span className="map-choice-body">
        <span className="map-choice-name">{NODE_NAMES[node.type]}</span>
        <span className="map-choice-reward">{nodeRewardText(node.type)}</span>
      </span>
      {leadOns.length > 0 && (
        <span className="map-choice-leadon">
          <span className="map-choice-leadon-label">Opens</span>
          {leadOns.map((type) => (
            <span key={type} className="map-choice-leadon-chip" style={{ '--node-color': NODE_COLORS[type] } as CSSProperties}>
              <NodeGlyph type={type} className="map-choice-leadon-glyph" />
              {NODE_NAMES[type]}
            </span>
          ))}
        </span>
      )}
    </button>
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
  const map = run.map;
  if (!map) return null;

  const location = locationForAct(run.locationIds, run.actNumber);

  // The whole view: where the player stands, and what they may take from here.
  const choiceIds = reachableNodeIds(run);
  const currentRow = run.currentNodeId != null ? map.nodes[run.currentNodeId]?.row ?? 0 : -1;
  const showLeadOn = leadOnsDiffer(map, choiceIds);

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

        <div className="map-choices">
          {choiceIds.map((nodeId) => (
            <ChoiceCard
              key={nodeId}
              map={map}
              node={map.nodes[nodeId]}
              showLeadOn={showLeadOn}
              onSelect={() => onSelectNode(nodeId)}
            />
          ))}
        </div>
      </div>

      {/* One button, because there is one thing down here worth opening: the run's own sheet —
          Banners, Gems, every hero and every item on them (2026-09-07, per user direction). */}
      <div className="map-footer">
        <button
          className="map-footer-button"
          style={{ '--btn-color': 'var(--ally)' } as CSSProperties}
          onClick={() => setShowRoster(true)}
        >
          <span className="map-footer-icon"><HubGlyph name="roster" /></span>
          <span className="map-footer-label">Roster</span>
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
    </div>
  );
}
