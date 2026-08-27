import { useState } from 'react';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { RosterEntry } from '../../run/state';
import type { EvolutionNode } from '../../run/progression';
import { StatGlyph, STAT_LABELS } from '../shared/StatBars';
import { TypeBadge } from '../shared/TypeBadge';
import { ElementGlyph } from '../shared/elementIcons';
import { HeroPortrait } from '../shared/HeroPortrait';

interface Props {
  hero: HeroDefinition;
  entry: RosterEntry;
  node: EvolutionNode;
  onChoose: (pathId: string) => void;
}

/**
 * Full-screen Evolution moment (CLAUDE.md "Evolutions are authored branch
 * points" / "differ in kind"). Previously this choice rendered inline inside
 * the hero's card on LevelUpScreen, which pushed a full 6-hero roster into
 * scrolling and buried a permanent, exciting decision in the middle of a
 * routine list. Pulled out into its own takeover screen so the moment reads
 * as the big deal it is; picking a path returns the caller (LevelUpScreen)
 * to the normal training list.
 *
 * Selecting a path only highlights it — matching the select-then-confirm
 * pattern used for move replacement (MoveInfoPanel-driven screens) — since
 * this choice is permanent for the run and a stray tap shouldn't lock it in.
 */
export function EvolutionScreen({ hero, entry, node, onChoose }: Props) {
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const selectedPath = node.paths.find((p) => p.id === selectedPathId) ?? null;

  return (
    <div className="node-screen evolution-screen">
      <div className="screen-scroll">
        <div className="evolution-banner">
          <div className="evolution-banner-glow" aria-hidden="true" />
          <HeroPortrait heroId={hero.id} className="evolution-banner-portrait" />
          <div className="evolution-banner-eyebrow">Evolution</div>
          <h2 className="evolution-banner-title">{hero.name} is ready to evolve!</h2>
          <p className="evolution-banner-sub">
            Level {entry.level} — choose a path. This choice is permanent for the rest of the run.
          </p>
        </div>

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
                {path.description && <p className="evolution-path-description">{path.description}</p>}
                <div className="evolution-path-grants">
                  {statEntries.map(([stat, amount]) => (
                    <span key={stat} className="evolution-path-grant-chip">
                      <StatGlyph stat={stat} /> {STAT_LABELS[stat]} +{amount}
                    </span>
                  ))}
                  {path.typeGraft && (
                    <span className="evolution-path-grant-chip evolution-path-typegraft">
                      <TypeBadge type={path.typeGraft} /> secondary type
                    </span>
                  )}
                  {/* The graft branch above answers "which second type" with a
                      chip; this one answers "none, and here is the one you
                      keep" — so it names that type the same way rather than
                      as bare text sitting beside a chip that isn't there. */}
                  {!path.typeGraft && (
                    <span className="evolution-path-grant-chip evolution-path-mono">
                      stays mono <ElementGlyph type={hero.types[0]} /> {hero.types[0]}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <button className="resolve-button" disabled={!selectedPath} onClick={() => selectedPath && onChoose(selectedPath.id)}>
        {selectedPath ? `Confirm — Evolve into ${selectedPath.name}` : 'Choose a path to evolve'}
      </button>
    </div>
  );
}
