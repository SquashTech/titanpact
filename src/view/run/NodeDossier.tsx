import { nextRungSteps, patronColor, patronOfNode, PatronFigure, stepFact, TrustPips } from './patronView';
import { moves } from '../../data/moves';
import { passives } from '../../data/passives';
import { MoveDetailCard } from '../combat/MoveDetailOverlay';
import { healCasterForEntry } from '../shared/healCaster';
import { PassiveReadout } from '../shared/passiveIcons';
import { CAPSTONE_TRUST, studentOf, trustOf } from '../../run/patrons';
import { formIdFor } from '../../run/progression';
import { rosterHeroes } from '../../data/content';
import { HeroPortrait } from '../shared/HeroPortrait';
import { type CSSProperties, type ReactNode } from 'react';
import type { MapNode } from '../../run/map';
import type { EquipmentRarity } from '../../run/equipment';
import { RARITY_ORDER } from '../../run/equipment';
import { NODE_COLORS } from './mapNodes';
import { nodeDossier, storyNodeDossier, type NodeFact, type NodeFactGlyph } from './nodeFacts';
import { storyCatalog } from '../../data/stories';
import { storyNodeSpec } from '../../run/story';
import { HubGlyph, NodeGlyph } from '../shared/nodeIcons';
import { RESOURCE_COLORS, ResourceGlyph } from '../shared/RunGlyph';
import { StatGlyph } from '../shared/statIcons';
import { TargetFigures } from '../shared/MoveStrip';
import { SectionGlyph } from '../shared/sectionIcons';
import { BANNER } from '../shared/relicIcons';
import { RARITY_COLOR_VARS, RARITY_LABELS } from '../shared/EquipmentBox';
import type { RunState } from '../../run/state';
import type { TypeId } from '../../engine/content';
import { rosterEntryTypes } from '../../run/progression';
import { ElementGlyph } from '../shared/elementIcons';
import { getTypeColor } from '../combat/typeColors';
import { MatchupArrow } from '../shared/MatchupArrows';
import { matchupVerdict } from '../shared/matchupVerdict';

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

/** Each reward in its own colour — the run's resource colours where it has one — so a card reads as loot, not a table. */
const FACT_COLORS: Record<NodeFactGlyph, string> = {
  gold: RESOURCE_COLORS.gold,
  xp: RESOURCE_COLORS.xp,
  scroll: RESOURCE_COLORS.scroll,
  contract: RESOURCE_COLORS.contract,
  mana: RESOURCE_COLORS.mpPotion,
  hp: RESOURCE_COLORS.hpPotion,
  item: '#f0a35a',
  banner: '#e8c66a',
  move: '#c9a6ff',
  passive: '#c9a6ff',
  class: '#c9a6ff',
  hero: '#9bc9ff',
  anvil: '#f0a35a',
  enchant: '#7fd6ff',
  enemy: '#ff7b6b',
  hidden: '#b8bccb',
};

/** One reward as loot: its mark glowing in its colour beside the figure and what it is. */
export function RewardRow({ fact }: { fact: NodeFact }) {
  return (
    <div className="node-dossier-reward" style={{ '--reward-color': FACT_COLORS[fact.glyph] } as CSSProperties}>
      <span className="node-dossier-reward-glyph">{FACT_GLYPHS[fact.glyph]}</span>
      <span className="node-dossier-reward-text">
        <strong className="node-dossier-reward-value">{fact.value}</strong>
        <span className="node-dossier-reward-label">
          {fact.label}
          {fact.who && <TargetFigures target={fact.who === 'team' ? 'bothAllies' : 'singleAlly'} small />}
        </span>
        {fact.note && <span className="node-dossier-reward-note">{fact.note}</span>}
      </span>
    </div>
  );
}

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

/** A fork's party, one column an enemy by its typing, and each roster hero's arrow against each. */
function PartyMatchups({ party, run }: { party: readonly (readonly TypeId[])[]; run: RunState }) {
  return (
    <div className="node-dossier-party" style={{ '--foes': party.length } as CSSProperties}>
      <span aria-hidden="true" />
      {party.map((types, i) => (
        <span key={i} className="node-dossier-foe">
          {types.map((type) => (
            <span key={type} className="node-dossier-foe-type" style={{ color: getTypeColor(type) }}>
              <ElementGlyph type={type} />
            </span>
          ))}
        </span>
      ))}
      {run.roster.map((entry) => {
        const heroTypes = rosterEntryTypes(rosterHeroes[entry.heroId], entry);
        return [
          <HeroPortrait
            key={`${entry.rosterId}-hero`}
            heroId={entry.heroId}
            pathId={formIdFor(entry)}
            className={`node-dossier-party-hero${entry.down ? ' is-down' : ''}`}
          />,
          ...party.map((types, i) => (
            <span key={`${entry.rosterId}-${i}`} className={`node-dossier-party-cell${entry.down ? ' is-down' : ''}`}>
              <MatchupArrow verdict={matchupVerdict(heroTypes, types)} />
            </span>
          )),
        ];
      })}
    </div>
  );
}

/**
 * The map's preview card (MapRoute): what the node pays, as loot — each reward a glowing mark beside
 * its figure — with what it fields set apart above, and a line only on the few nodes that need one. The lit tile under the card already carries its name and its picture; the
 * roster's side of it is the footer's chips (nodeLens.tsx).
 */
function storyDossierFor(run: RunState, node: MapNode) {
  const spec = run.story ? storyNodeSpec(run, storyCatalog, node.id) : null;
  return spec ? storyNodeDossier(spec, run.actNumber) : null;
}

export function NodeDossier({ node, run, party }: { node: MapNode; run: RunState; party?: readonly (readonly TypeId[])[] }) {
  const patron = patronOfNode(run, node);
  // A move or a passive is shown as the thing itself; every other rung keeps its ledger row.
  const steps = patron ? nextRungSteps(run, patron) : [];
  const shownAsCard = steps.filter((step) => step.kind === 'move' || step.kind === 'passive');
  const dossier = patron
    ? { about: null, facts: steps.filter((step) => !shownAsCard.includes(step)).map((step) => stepFact(step, run.actNumber)), odds: null }
    : storyDossierFor(run, node) ?? nodeDossier(node.type, run.actNumber, run.cycle);
  const color = patron ? patronColor(patron.id) : NODE_COLORS[node.type];
  const shown = dossier.facts.filter((fact) => fact.value !== null);
  const threats = shown.filter((fact) => fact.threat);
  const rewards = shown.filter((fact) => !fact.threat);

  const studentId = patron?.hasStudent ? studentOf(run, patron.id) : null;
  const student = studentId ? run.roster.find((r) => r.rosterId === studentId) : null;
  const caster = student ? healCasterForEntry(rosterHeroes[student.heroId], student, run.relics) : undefined;

  return (
    <div className={`node-dossier-panel${patron ? ' is-patron' : ''}`} style={{ '--node-color': color } as CSSProperties}>
      {/* A patron is a person: the figure, the name large enough to remember, what they are and one line about them. */}
      {patron ? (
        <div className="patron-dossier-head">
          <span className="patron-dossier-figure">
            <span className="patron-dossier-pool" aria-hidden="true" />
            <PatronFigure patronId={patron.id} />
          </span>
          <span className="patron-dossier-words">
            <span className="patron-dossier-title">{patron.title}</span>
            <strong className="patron-dossier-name">{patron.name}</strong>
            <span className="patron-dossier-line">“{patron.lines[Math.min(trustOf(run, patron.id), CAPSTONE_TRUST - 1)]}”</span>
            <span className="patron-dossier-trust">
              <TrustPips trust={trustOf(run, patron.id)} />
              {student && (
                <span className="patron-dossier-student">
                  <HeroPortrait heroId={student.heroId} pathId={formIdFor(student)} className="patron-dossier-student-portrait" />
                  {rosterHeroes[student.heroId].name}
                </span>
              )}
            </span>
          </span>
        </div>
      ) : (
        dossier.about && <p className="node-dossier-about">{dossier.about}</p>
      )}

      {threats.map((fact) => (
        <div key={fact.label} className="node-dossier-threat" style={{ '--reward-color': FACT_COLORS[fact.glyph] } as CSSProperties}>
          <span className="node-dossier-threat-glyph">{FACT_GLYPHS[fact.glyph]}</span>
          <strong>{fact.value}</strong>
          {fact.note && <span className="node-dossier-threat-note">{fact.note}</span>}
        </div>
      ))}

      {party && party.length > 0 && <PartyMatchups party={party} run={run} />}

      {shownAsCard.map((step, i) =>
        step.kind === 'move' ? (
          <div key={i} className="node-dossier-move">
            <MoveDetailCard move={moves[step.moveId]} caster={caster} terse />
          </div>
        ) : step.kind === 'passive' ? (
          <PassiveReadout key={i} passive={passives[step.passiveId]} />
        ) : null
      )}

      <div className="node-dossier-rewards">
        {rewards.map((fact) => (
          <RewardRow key={fact.label} fact={fact} />
        ))}
      </div>

      {dossier.odds && <RarityOdds odds={dossier.odds} />}
    </div>
  );
}
