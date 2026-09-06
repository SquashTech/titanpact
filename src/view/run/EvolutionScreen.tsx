import { useState, type CSSProperties } from 'react';
import type { HeroDefinition, StatKey, TypeId } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import type { EvolutionNode, EvolutionPath } from '../../run/progression';
import { passives } from '../../data/passives';
import { PassiveGlyph, PassiveInfoPanel, passiveColor, passiveTint } from '../shared/passiveIcons';
import { moves } from '../../data/moves';
import { MoveDetailCard } from '../combat/MoveDetailOverlay';
import { StatGlyph, STAT_LABELS } from '../shared/StatBars';
import { TypeBadge } from '../shared/TypeBadge';
import { TypeMatchups } from '../shared/TypeMatchups';
import { ElementGlyph } from '../shared/elementIcons';
import { getTypeColor } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { useLongPress } from '../shared/MoveTile';
import { healCasterForEntry } from '../shared/healCaster';
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

/** The types a hero ends up with down a path — a graft replaces the secondary, never the innate primary. */
function pathTypes(hero: HeroDefinition, path: EvolutionPath): TypeId[] {
  return path.typeGraft ? [hero.types[0], path.typeGraft] : [...hero.types];
}

/**
 * What `learnableMoveIds` buys, as a promise rather than a roster. The list itself is unreadable
 * at the moment of choosing — five names the player has never seen, none of which they get now —
 * and it crowded out the two things that ARE immediate: the granted move and the passive.
 */
function poolPromise(path: EvolutionPath): string | null {
  if (!path.learnableMoveIds?.length) return null;
  return path.typeGraft
    ? `New ${path.typeGraft} moves join its level-up pool.`
    : 'New moves join its level-up pool.';
}

/** Full-screen Evolution choice. Select-then-confirm: the choice is permanent for the run, so a stray tap must not lock it in. */
export function EvolutionScreen({ hero, entry, node, run, onChoose }: Props) {
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [inspectedPathId, setInspectedPathId] = useState<string | null>(null);
  const selectedPath = node.paths.find((p) => p.id === selectedPathId) ?? null;
  const inspectedPath = node.paths.find((p) => p.id === inspectedPathId) ?? null;

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
            {node.paths.map((path) => (
              <PathButton
                key={path.id}
                hero={hero}
                path={path}
                selected={selectedPathId === path.id}
                onSelect={() => setSelectedPathId(path.id)}
                onInspect={() => setInspectedPathId(path.id)}
              />
            ))}
          </div>
          <p className="evolution-inspect-hint">Tap a path to select it, hold to read what it grants.</p>
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

      {inspectedPath && (
        <PathDossier
          hero={hero}
          entry={entry}
          run={run}
          path={inspectedPath}
          onChoose={() => onChoose(inspectedPath.id)}
          onClose={() => setInspectedPathId(null)}
        />
      )}
    </div>
  );
}

/** Tap picks, hold inspects — the same gesture the move rows and the equipment caches use. */
function PathButton({
  hero,
  path,
  selected,
  onSelect,
  onInspect,
}: {
  hero: HeroDefinition;
  path: EvolutionPath;
  selected: boolean;
  onSelect: () => void;
  onInspect: () => void;
}) {
  const longPress = useLongPress(onInspect, onSelect);
  const statEntries = Object.entries(path.statGrants).filter(([, amount]) => !!amount) as [StatKey, number][];
  const promise = poolPromise(path);

  return (
    <button className={`evolution-path-button evolution-${path.kind}${selected ? ' picked' : ''}`} {...longPress}>
      <div className="evolution-path-head">
        <span className="evolution-path-name">{path.name}</span>
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
        {path.unlocksMoveIds.map((id) => moves[id] && (
          <span
            key={id}
            className="evolution-path-grant-chip evolution-path-move"
            style={{ '--move-color': getTypeColor(moves[id].type) } as CSSProperties}
          >
            <ElementGlyph type={moves[id].type} /> {moves[id].name}
          </span>
        ))}
      </div>
      {promise && <p className="evolution-path-learnable">{promise}</p>}
      {(path.grantsPassiveIds ?? []).map((id) => passives[id] && (
        <p key={id} className="evolution-path-passive-text">
          {passives[id].description}
        </p>
      ))}
    </button>
  );
}

/**
 * Everything a path hands over, at full detail: the move it grants read against the hero's
 * post-graft types (so STAB is the number it will actually be), the passive's own panel, and
 * the matchups the graft signs the rest of the run up for.
 */
function PathDossier({
  hero,
  entry,
  run,
  path,
  onChoose,
  onClose,
}: {
  hero: HeroDefinition;
  entry: RosterEntry;
  run: RunState;
  path: EvolutionPath;
  onChoose: () => void;
  onClose: () => void;
}) {
  const types = pathTypes(hero, path);
  // Post-graft types, not the entry's current ones: the granted move is usually the graft's own type.
  const caster = { ...healCasterForEntry(hero, entry, run.relics), types };
  const grantedPassives = (path.grantsPassiveIds ?? []).filter((id) => passives[id]);
  const grantedMoves = path.unlocksMoveIds.filter((id) => moves[id]);
  const promise = poolPromise(path);

  return (
    <div className="detail-overlay" onClick={onClose}>
      <button className="detail-close-button" onClick={onClose} aria-label="Close">
        ✕
      </button>
      <div className="detail-panel evolution-dossier" onClick={(e) => e.stopPropagation()}>
        <div className="evolution-dossier-title">{path.name}</div>

        {path.typeGraft && (
          <section className="evolution-dossier-section">
            <div className="evo-path-label">Becomes</div>
            <div className="evo-path-types">
              {types.map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
            <TypeMatchups types={types} />
          </section>
        )}

        {grantedMoves.length > 0 && (
          <section className="evolution-dossier-section">
            <div className="evo-path-label">Granted on choosing</div>
            {grantedMoves.map((id) => (
              <MoveDetailCard key={id} move={moves[id]} caster={caster} />
            ))}
          </section>
        )}

        {grantedPassives.length > 0 && (
          <section className="evolution-dossier-section">
            <div className="evo-path-label">Passive</div>
            {grantedPassives.map((id) => (
              <PassiveInfoPanel key={id} passive={passives[id]} />
            ))}
          </section>
        )}

        {promise && (
          <section className="evolution-dossier-section">
            <div className="evo-path-label">Level-up pool</div>
            <p className="evolution-dossier-pool">{promise} They are offered on level-up, not now.</p>
          </section>
        )}

        <button
          className="resolve-button evolution-dossier-confirm"
          data-sfx="ui.commit"
          onClick={onChoose}
        >
          Confirm — Evolve into {path.name}
        </button>
      </div>
    </div>
  );
}
