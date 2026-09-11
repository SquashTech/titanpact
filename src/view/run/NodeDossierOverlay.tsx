import { createPortal } from 'react-dom';
import type { CSSProperties, ReactNode } from 'react';
import type { MapNode } from '../../run/map';
import type { EquipmentRarity } from '../../run/equipment';
import { RARITY_ORDER } from '../../run/equipment';
import { NODE_COLORS, NODE_NAMES } from './mapNodes';
import { nodeDossier, type NodeFactGlyph } from './nodeFacts';
import { HubGlyph, NodeGlyph } from '../shared/nodeIcons';
import { ResourceGlyph } from '../shared/RunGlyph';
import { SectionGlyph } from '../shared/sectionIcons';
import { BANNER } from '../shared/relicIcons';
import { RARITY_COLOR_VARS, RARITY_LABELS } from '../shared/EquipmentBox';
import { overlayHost } from '../shared/overlayHost';

/** Every mark a ledger row can lead with, drawn from the glyph sets the rest of the run already uses. */
const FACT_GLYPHS: Record<NodeFactGlyph, ReactNode> = {
  gold: <ResourceGlyph kind="gold" tone="inherit" />,
  scroll: <ResourceGlyph kind="scroll" tone="inherit" />,
  contract: <ResourceGlyph kind="contract" tone="inherit" />,
  item: <SectionGlyph name="equipment" />,
  banner: (
    <svg className="relic-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      {BANNER}
    </svg>
  ),
  recruit: <SectionGlyph name="heroes" />,
  move: <SectionGlyph name="moves" />,
  passive: <SectionGlyph name="passives" />,
  slot: <HubGlyph name="hand" />,
  class: <HubGlyph name="hall" />,
  enemy: <NodeGlyph type="fight" />,
  hero: <SectionGlyph name="heroes" />,
  anvil: <NodeGlyph type="forgeReward" />,
  enchant: <SectionGlyph name="matchups" />,
  sell: <ResourceGlyph kind="gold" tone="inherit" />,
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
      <div className="move-detail-eyebrow">Item tier odds</div>
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
 * What a hold on a map node opens: the node's ledger — what it pays, what it costs, what it
 * fields — as figures in rows, never as a sentence. Sits on the same `.detail-overlay` /
 * `.detail-panel` chassis as the move dossier, with the node's colour on the stripe and the disc,
 * so the tile the player is still holding down reads as having opened rather than as a panel
 * about it. Portalled into overlayHost(), never document.body — see overlayHost.ts.
 */
export function NodeDossierOverlay({ node, actNumber, onClose }: { node: MapNode; actNumber: number; onClose: () => void }) {
  const dossier = nodeDossier(node.type, actNumber);
  const color = NODE_COLORS[node.type];

  function closeAndStop(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    onClose();
  }

  return createPortal(
    <div className="detail-overlay" onClick={closeAndStop}>
      <div className="detail-panel node-dossier-panel" style={{ borderTopColor: color, '--node-color': color } as CSSProperties} onClick={closeAndStop}>
        <div className="node-dossier-head">
          <span className="node-dossier-disc">
            <NodeGlyph type={node.type} />
          </span>
          <div className="node-dossier-titles">
            <div className="node-dossier-name">{NODE_NAMES[node.type]}</div>
            <div className="node-dossier-line">{dossier.kind}</div>
          </div>
        </div>

        <div className="node-dossier-facts">
          {dossier.facts.map((fact) => (
            <div key={fact.label} className={`node-dossier-fact${fact.value === null ? ' is-none' : ''}`}>
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

        <div className="detail-close-hint">Tap anywhere to close</div>
      </div>
    </div>,
    overlayHost()
  );
}
