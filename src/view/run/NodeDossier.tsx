import type { CSSProperties, ReactNode } from 'react';
import type { MapNode } from '../../run/map';
import type { EquipmentRarity } from '../../run/equipment';
import { RARITY_ORDER } from '../../run/equipment';
import type { MapNodeType } from '../../run/map';
import { NODE_COLORS, NODE_LABELS, NODE_NAMES } from './mapNodes';
import { mapNodeArt, mapNodeIcon } from './mapNodeArt';
import { landmarkStillArt } from './mapLandmarks';
import { nodeDossier, type NodeFactGlyph } from './nodeFacts';
import { HubGlyph, NodeGlyph } from '../shared/nodeIcons';
import { ResourceGlyph } from '../shared/RunGlyph';
import { StatGlyph } from '../shared/statIcons';
import { SectionGlyph } from '../shared/sectionIcons';
import { BANNER } from '../shared/relicIcons';
import { RARITY_COLOR_VARS, RARITY_LABELS } from '../shared/EquipmentBox';
import type { RunState } from '../../run/state';

/** Every mark a ledger row can lead with, drawn from the glyph sets the rest of the run already uses. */
const FACT_GLYPHS: Record<NodeFactGlyph, ReactNode> = {
  gold: <ResourceGlyph kind="gold" tone="inherit" />,
  xp: <ResourceGlyph kind="xp" tone="inherit" />,
  scroll: <ResourceGlyph kind="scroll" tone="inherit" />,
  mana: <StatGlyph stat="manaPool" tone="inherit" />,
  hp: <StatGlyph stat="hp" tone="inherit" />,
  contract: <ResourceGlyph kind="contract" tone="inherit" />,
  item: <SectionGlyph name="equipment" />,
  banner: (
    <svg className="relic-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      {BANNER}
    </svg>
  ),
  move: <SectionGlyph name="moves" />,
  passive: <SectionGlyph name="passives" />,
  class: <HubGlyph name="hall" />,
  enemy: <HubGlyph name="foe" />,
  hero: <SectionGlyph name="heroes" />,
  anvil: <HubGlyph name="anvil" />,
  enchant: <SectionGlyph name="matchups" />,
  hidden: <NodeGlyph type="event" />,
};

/**
 * The act's rarity odds as one bar, the tiers in order and each as wide as its weight. A row of
 * five percentages reads as five numbers; a bar reads as "mostly Rare, a sliver of Legendary",
 * which is the question the player has.
 */
function RarityOdds({ odds }: { odds: Record<EquipmentRarity, number> }) {
  const live = RARITY_ORDER.filter((rarity) => odds[rarity] > 0);
  const total = live.reduce((sum, rarity) => sum + odds[rarity], 0);
  if (total === 0) return null;
  const share = (rarity: EquipmentRarity) => Math.round((odds[rarity] / total) * 100);
  return (
    <div className="node-dossier-odds">
      <div className="node-dossier-odds-bar" aria-hidden="true">
        {live.map((rarity) => (
          <span
            key={rarity}
            className="node-dossier-odds-seg"
            style={{ flexGrow: odds[rarity], '--rarity-color': RARITY_COLOR_VARS[rarity] } as CSSProperties}
          />
        ))}
      </div>
      <div className="node-dossier-odds-keys">
        {live.map((rarity) => (
          <span key={rarity} className="node-dossier-odds-key" style={{ '--rarity-color': RARITY_COLOR_VARS[rarity] } as CSSProperties}>
            <strong>{share(rarity)}%</strong> {RARITY_LABELS[rarity]}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The map's preview card (MapRoute): the node's name large in its colour with its art beside it,
 * a line of lore, then what the node pays as figures, never as a sentence. The roster's side of it is the footer's chips (nodeLens.tsx).
 */
/** A fight is named by what it is to the player (Elite, Skirmish); every other node by its place. */
const FIGHT_NODES: readonly MapNodeType[] = ['fight', 'battle', 'skirmish', 'elite', 'boss'];

export function NodeDossier({ node, run }: { node: MapNode; run: RunState }) {
  const dossier = nodeDossier(node.type, run.actNumber, run.cycle);
  const color = NODE_COLORS[node.type];
  // The tile's own picture, in the order the tile picks it (MapRoute), so the card is the tile opened up.
  const art = landmarkStillArt(node.type) ?? mapNodeIcon(node.type) ?? mapNodeArt(node.type);
  const title = FIGHT_NODES.includes(node.type) ? NODE_LABELS[node.type] : NODE_NAMES[node.type];

  return (
    <div className="node-dossier-panel" style={{ '--node-color': color } as CSSProperties}>
      <div className="node-dossier-hero">
        <span className="node-dossier-art">{art ? <img src={art} alt="" draggable={false} /> : <NodeGlyph type={node.type} />}</span>
        <div className="node-dossier-heading">
          <div className="node-dossier-title">{title}</div>
          <p className="node-dossier-about">{dossier.about}</p>
        </div>
      </div>

      <div className="node-dossier-facts">
        {dossier.facts.filter((fact) => fact.value !== null).map((fact) => (
          <div key={fact.label} className="node-dossier-fact">
            <span className="node-dossier-fact-glyph">{FACT_GLYPHS[fact.glyph]}</span>
            <span className="node-dossier-fact-label">{fact.label}</span>
            <span className="node-dossier-fact-value">
              <strong>{fact.value ?? '—'}</strong>
              {fact.note && <span className="node-dossier-fact-note">{fact.note}</span>}
            </span>
          </div>
        ))}
      </div>

      {dossier.odds && <RarityOdds odds={dossier.odds} />}
    </div>
  );
}
