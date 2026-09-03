import { useState, type CSSProperties } from 'react';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import type { EvolutionNode } from '../../run/progression';
import { passives } from '../../data/passives';
import { PassiveGlyph, passiveColor, passiveTint } from '../shared/passiveIcons';
import { moves } from '../../data/moves';
import { StatGlyph, STAT_LABELS } from '../shared/StatBars';
import { TypeBadge } from '../shared/TypeBadge';
import { ElementGlyph } from '../shared/elementIcons';
import { HeroPortrait } from '../shared/HeroPortrait';
import { NodeHeader, NodeSky } from '../shared/NodeStage';
import { RosterPeek } from './RosterPeek';

interface Props {
  hero: HeroDefinition;
  entry: RosterEntry;
  node: EvolutionNode;
  /** Only for the corner roster glyph — checking the team's type coverage before locking a graft in. */
  run: RunState;
  onChoose: (pathId: string) => void;
}

/** Full-screen Evolution choice. Select-then-confirm: the choice is permanent for the run, so a stray tap must not lock it in. */
export function EvolutionScreen({ hero, entry, node, run, onChoose }: Props) {
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const selectedPath = node.paths.find((p) => p.id === selectedPathId) ?? null;

  return (
    <div className="node-screen evolution-screen">
      <NodeSky />
      <RosterPeek run={run} />
      <NodeHeader
        compact
        art={
          <span className="evolution-art">
            <span className="evolution-banner-glow" aria-hidden="true" />
            <HeroPortrait heroId={hero.id} className="evolution-banner-portrait" />
          </span>
        }
        eyebrow="Evolution"
        title={`${hero.name} is ready to evolve!`}
        readout={`Level ${entry.level} — choose a path. This choice is permanent for the rest of the run.`}
      />

      <div className="screen-scroll">
        <div className="stage-centered">
          <div className="evolution-path-list evolution-path-list-big">
            {node.paths.map((path) => {
              const isSelected = selectedPathId === path.id;
              const statEntries = Object.entries(path.statGrants).filter(([, amount]) => !!amount) as [StatKey, number][];
              return (
                <button
                  key={path.id}
                  className={`evolution-path-button evolution-${path.kind}${isSelected ? ' picked' : ''}`}
                  onClick={() => setSelectedPathId(path.id)}
                >
                  <div className="evolution-path-head">
                    <span className="evolution-path-name">{path.name}</span>
                    <span className="evolution-path-kind">{path.kind}</span>
                  </div>
                  <div className="evolution-path-grants">
                    {/* Signed, not always "+": a refocus path spends a stat to buy another. */}
                    {statEntries.map(([stat, amount]) => (
                      <span key={stat} className={`evolution-path-grant-chip${amount < 0 ? ' evolution-path-grant-loss' : ''}`}>
                        <StatGlyph stat={stat} /> {STAT_LABELS[stat]} {amount > 0 ? '+' : ''}
                        {amount}
                      </span>
                    ))}
                    {path.typeGraft && (
                      <span className="evolution-path-grant-chip evolution-path-typegraft">
                        <TypeBadge type={path.typeGraft} /> secondary type
                      </span>
                    )}
                    {!path.typeGraft && (
                      <span className="evolution-path-grant-chip evolution-path-mono">
                        stays mono <ElementGlyph type={hero.types[0]} /> {hero.types[0]}
                      </span>
                    )}
                    {(path.grantsPassiveIds ?? []).map((id) => passives[id] && (
                      <span
                        key={id}
                        className="evolution-path-grant-chip evolution-path-passive"
                        style={{ '--passive-color': passiveColor(id), '--passive-tint': passiveTint(id, 0.16) } as CSSProperties}
                      >
                        <PassiveGlyph passiveId={id} /> {passives[id].name}
                      </span>
                    ))}
                  </div>
                  {path.unlocksMoveIds.length > 0 && (
                    <p className="evolution-path-learnable">
                      <span className="evolution-path-learnable-label">Learns</span>
                      {path.unlocksMoveIds.map((id) => moves[id]?.name ?? id).join(' · ')}
                    </p>
                  )}
                  {(path.learnableMoveIds?.length ?? 0) > 0 && (
                    <p className="evolution-path-learnable">
                      <span className="evolution-path-learnable-label">Can learn</span>
                      {path.learnableMoveIds!.map((id) => moves[id]?.name ?? id).join(' · ')}
                    </p>
                  )}
                  {(path.grantsPassiveIds ?? []).map((id) => passives[id] && (
                    <p key={id} className="evolution-path-passive-text">
                      {passives[id].description}
                    </p>
                  ))}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {/* The slot stays mounted at full height so the path cards don't shift when the button arrives. */}
      <div className="evolution-cta-slot">
        {selectedPath && (
          <button className="resolve-button" data-sfx="ui.commit" onClick={() => onChoose(selectedPath.id)}>
            Confirm — Evolve into {selectedPath.name}
          </button>
        )}
      </div>
    </div>
  );
}
