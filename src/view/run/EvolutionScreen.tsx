import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { HeroDefinition, StatKey, TypeId } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import { MOVE_CAP, type EvolutionNode, type EvolutionPath } from '../../run/progression';
import { passives } from '../../data/passives';
import { PassiveGlyph, PassiveInfoPanel, passiveColor, passiveTint } from '../shared/passiveIcons';
import { moves } from '../../data/moves';
import { MoveDetailCard, MoveDetailOverlay } from '../combat/MoveDetailOverlay';
import { StatGlyph, STAT_LABELS } from '../shared/StatBars';
import { TypeBadge } from '../shared/TypeBadge';
import { TypeMatchups } from '../shared/TypeMatchups';
import { ElementGlyph } from '../shared/elementIcons';
import { getTypeColor } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { useLongPress } from '../shared/MoveTile';
import { healCasterForEntry } from '../shared/healCaster';
import { entryStatTotals } from '../shared/entryStatTotals';
import { NodeHeader, NodeSky } from '../shared/NodeStage';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { playSfx } from '../../audio/sfx';
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

/** The type a graft COSTS — only a hero born dual has one to give up. */
function tradedType(hero: HeroDefinition, path: EvolutionPath): TypeId | null {
  return path.typeGraft ? hero.types[1] ?? null : null;
}

/**
 * The two type colours a path's card is washed in (2026-09-07, per user direction): the choice
 * is a type choice, so the card should look like the hero it produces rather than like a
 * category. `lead` is what the path is ABOUT — the type of the move it grants, or the type it
 * grafts — and `trail` is the half of the resulting typing that comes along.
 *
 * A path that grants nothing typed leads on the hero's SECONDARY instead: on a dual hero it is
 * the half that path isn't already defined by, which is what keeps two same-typed siblings
 * (Cinder's Explosive and Ironclad) from washing up identical.
 */
function pathPalette(hero: HeroDefinition, path: EvolutionPath): { lead: TypeId; trail: TypeId } {
  const types = pathTypes(hero, path);
  const granted = path.unlocksMoveIds.map((id) => moves[id]?.type).find(Boolean) ?? path.typeGraft ?? null;
  const lead = granted && types.includes(granted) ? granted : types[types.length - 1] ?? types[0];
  return { lead, trail: types.find((t) => t !== lead) ?? lead };
}

function paletteStyle(hero: HeroDefinition, path: EvolutionPath): CSSProperties {
  const { lead, trail } = pathPalette(hero, path);
  return { '--path-lead': getTypeColor(lead), '--path-trail': getTypeColor(trail) } as CSSProperties;
}

/** What `learnableMoveIds` buys, as a promise. The names themselves are for the dossier. */
function poolPromise(path: EvolutionPath): string | null {
  if (!path.learnableMoveIds?.length) return null;
  return path.typeGraft
    ? `New ${path.typeGraft} moves are added to the level-up pool.`
    : 'New moves are added to the level-up pool.';
}

function statEntriesOf(path: EvolutionPath): [StatKey, number][] {
  return Object.entries(path.statGrants).filter(([, amount]) => !!amount) as [StatKey, number][];
}

/**
 * Full-screen Evolution choice. Tap a path and the whole thing opens as a dossier — the choice is
 * permanent for the run, so the confirm lives in there, on the screen that actually explains it,
 * rather than on a bar under three cards that only print headlines.
 */
export function EvolutionScreen({ hero, entry, node, run, onChoose }: Props) {
  const [inspectedPathId, setInspectedPathId] = useState<string | null>(null);
  /** Set once the choice is spent: the cinematic runs over the screen and calls `onChoose` at the end. */
  const [sealingPathId, setSealingPathId] = useState<string | null>(null);
  const inspectedPath = node.paths.find((p) => p.id === inspectedPathId) ?? null;
  const sealingPath = node.paths.find((p) => p.id === sealingPathId) ?? null;

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
        readout="The choice is permanent."
      />

      <div className="screen-scroll">
        <div className="stage-centered">
          <div className="evolution-path-list evolution-path-list-big">
            {node.paths.map((path) => (
              <PathButton key={path.id} hero={hero} path={path} onInspect={() => setInspectedPathId(path.id)} />
            ))}
          </div>
          <p className="evolution-inspect-hint">Tap a path to read everything it grants.</p>
        </div>
      </div>

      {inspectedPath && (
        <PathDossier
          hero={hero}
          entry={entry}
          run={run}
          path={inspectedPath}
          onChoose={() => setSealingPathId(inspectedPath.id)}
          onClose={() => setInspectedPathId(null)}
        />
      )}

      {sealingPath && (
        <EvolutionCinematic
          hero={hero}
          path={sealingPath}
          onDone={() => onChoose(sealingPath.id)}
        />
      )}
    </div>
  );
}

/** One labelled band inside a path card. Rendered only when the path actually grants that kind of thing. */
function PathZone({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`evolution-zone${className ? ` ${className}` : ''}`}>
      <span className="evolution-zone-label">{label}</span>
      <div className="evolution-zone-body">{children}</div>
    </div>
  );
}

/** Tap opens the dossier — the card is a headline, not the decision. */
function PathButton({ hero, path, onInspect }: { hero: HeroDefinition; path: EvolutionPath; onInspect: () => void }) {
  const statEntries = statEntriesOf(path);
  const grantedPassives = (path.grantsPassiveIds ?? []).filter((id) => passives[id]);
  const grantedMoves = path.unlocksMoveIds.filter((id) => moves[id]);
  const promise = poolPromise(path);
  const traded = tradedType(hero, path);

  return (
    <button className="evolution-path-button" style={paletteStyle(hero, path)} data-sfx="ui.select" onClick={onInspect}>
      <span className="evolution-path-sheen" aria-hidden="true" />
      <div className="evolution-path-head">
        <span className="evolution-path-name">{path.name}</span>
        <span className="evolution-path-chevron" aria-hidden="true">
          ›
        </span>
      </div>

      {/* Where the hero LANDS, not what is added — and on a dual hero a graft is a trade, so the
          type it costs is printed beside the one it buys (docs/leveling-and-ranks.md "The RETYPE"). */}
      <PathZone label="Typing" className="is-typing">
        {pathTypes(hero, path).map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
        {traded && (
          <span className="evolution-path-grant-chip evolution-path-grant-loss">
            <ElementGlyph type={traded} /> trades {traded}
          </span>
        )}
        {!path.typeGraft && <span className="evolution-path-mono">unchanged</span>}
      </PathZone>

      {statEntries.length > 0 && (
        <PathZone label="Stats" className="is-stats">
          {/* Signed, not always "+": a refocus path spends a stat to buy another. */}
          {statEntries.map(([stat, amount]) => (
            <span key={stat} className={`evolution-path-grant-chip${amount < 0 ? ' evolution-path-grant-loss' : ''}`}>
              <StatGlyph stat={stat} /> {STAT_LABELS[stat]} {amount > 0 ? '+' : ''}
              {amount}
            </span>
          ))}
        </PathZone>
      )}

      {grantedMoves.length > 0 && (
        <PathZone label="Move" className="is-moves">
          {grantedMoves.map((id) => (
            <span
              key={id}
              className="evolution-path-grant-chip evolution-path-move"
              style={{ '--move-color': getTypeColor(moves[id].type) } as CSSProperties}
            >
              <ElementGlyph type={moves[id].type} /> {moves[id].name}
            </span>
          ))}
        </PathZone>
      )}

      {grantedPassives.length > 0 && (
        <PathZone label="Passive" className="is-passive">
          {grantedPassives.map((id) => (
            <span
              key={id}
              className="evolution-path-grant-chip evolution-path-passive"
              style={{ '--passive-color': passiveColor(id), '--passive-tint': passiveTint(id, 0.16) } as CSSProperties}
            >
              <PassiveGlyph passiveId={id} /> {passives[id].name}
            </span>
          ))}
        </PathZone>
      )}

      {promise && (
        <PathZone label="Pool" className="is-pool">
          <span className="evolution-path-learnable">{promise}</span>
        </PathZone>
      )}
    </button>
  );
}

/** A pool move as a chip that opens its own dossier. Tap or hold — nothing else here wants the tap. */
function PoolMoveChip({ moveId, onRead }: { moveId: string; onRead: () => void }) {
  const press = useLongPress(onRead, onRead);
  const move = moves[moveId];
  return (
    <button
      type="button"
      className="evolution-path-grant-chip evolution-path-move is-readable"
      style={{ '--move-color': getTypeColor(move.type) } as CSSProperties}
      data-sfx="none"
      {...press}
    >
      <ElementGlyph type={move.type} /> {move.name}
    </button>
  );
}

/**
 * Everything a path hands over, at full detail: the stat line it lands the hero on, the move it
 * grants read against the hero's post-graft types (so STAB is the number it will actually be),
 * the passive's own panel, the pool it opens by name, and the matchups the graft signs the rest
 * of the run up for. This is where the choice is spent — the cards behind it only headline it.
 *
 * Full-bleed, with the actions pinned under a scrolling body: a permanent choice should not have
 * its Confirm below a fold, and the flavour line the card carries is not worth the room here.
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
  const [readingMoveId, setReadingMoveId] = useState<string | null>(null);
  const types = pathTypes(hero, path);
  // Post-graft types, not the entry's current ones: the granted move is usually the graft's own type.
  const caster = { ...healCasterForEntry(hero, entry, run.relics), types };
  const current = entryStatTotals(hero, entry, run.relics);
  const statEntries = statEntriesOf(path);
  const grantedPassives = (path.grantsPassiveIds ?? []).filter((id) => passives[id]);
  const grantedMoves = path.unlocksMoveIds.filter((id) => moves[id]);
  const poolMoves = (path.learnableMoveIds ?? []).filter((id) => moves[id]);
  const traded = tradedType(hero, path);
  const promise = poolPromise(path);
  // At the cap the grant becomes a replace-or-decline offer, which by the Evolution level is the
  // usual case rather than the edge one (applyEvolutionMoves).
  const kitFull = grantedMoves.length > 0 && entry.unlockedMoveIds.length >= MOVE_CAP;

  return (
    <div className="detail-overlay evolution-dossier-overlay" onClick={onClose}>
      <div className="detail-panel evolution-dossier" style={paletteStyle(hero, path)} onClick={(e) => e.stopPropagation()}>
        <div className="evolution-dossier-head">
          <span className="evolution-dossier-title">{path.name}</span>
          <button className="evolution-dossier-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="evolution-dossier-body">
          <section className="evolution-dossier-section">
            <div className="evo-path-label">Typing</div>
            <div className="evo-path-types">
              {types.map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
              {!path.typeGraft && <span className="evolution-dossier-note">unchanged</span>}
              {traded && (
                <span className="evolution-dossier-note">
                  trades {traded} for {path.typeGraft}
                </span>
              )}
            </div>
            <TypeMatchups types={types} />
          </section>

          {statEntries.length > 0 && (
            <section className="evolution-dossier-section">
              <div className="evo-path-label">Stats</div>
              <div className="evolution-stat-table">
                {statEntries.map(([stat, amount]) => (
                  <div key={stat} className={`evolution-stat-row${amount < 0 ? ' is-loss' : ''}`}>
                    <span className="evolution-stat-name">
                      <StatGlyph stat={stat} /> {STAT_LABELS[stat]}
                    </span>
                    <span className="evolution-stat-now">{current[stat]}</span>
                    <span className="evolution-stat-arrow" aria-hidden="true">
                      →
                    </span>
                    <span className="evolution-stat-next">{current[stat] + amount}</span>
                    <span className="evolution-stat-delta">
                      {amount > 0 ? '+' : ''}
                      {amount}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {grantedMoves.length > 0 && (
            <section className="evolution-dossier-section">
              <div className="evo-path-label">Granted on choosing</div>
              {grantedMoves.map((id) => (
                <MoveDetailCard key={id} move={moves[id]} caster={caster} />
              ))}
              {kitFull && (
                <p className="evolution-dossier-note-line">
                  {hero.name} already knows {MOVE_CAP} moves — you'll choose one to replace, or decline.
                </p>
              )}
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
              <p className="evolution-dossier-pool">{promise}</p>
              {poolMoves.length > 0 && (
                <div className="evolution-pool-chips">
                  {poolMoves.map((id) => (
                    <PoolMoveChip key={id} moveId={id} onRead={() => setReadingMoveId(id)} />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Not `.resolve-button`: this is the one press in the run that spends something
            permanent, and it should not look like Continue. */}
        <button className="evolve-button" data-sfx="none" onClick={onChoose}>
          <span className="evolve-button-sheen" aria-hidden="true" />
          <span className="evolve-button-rays" aria-hidden="true" />
          <span className="evolve-button-label">
            <span className="evolve-button-kicker">Evolve into</span>
            <span className="evolve-button-name">{path.name}</span>
          </span>
        </button>
      </div>

      {readingMoveId && (
        <MoveDetailOverlay move={moves[readingMoveId]} caster={caster} onClose={() => setReadingMoveId(null)} />
      )}
    </div>
  );
}


/** Beat boundaries for the evolution cinematic, in ms from the press. */
const EVOLVE_BEATS = { burst: 1150, reveal: 1520, done: 4100 } as const;

/**
 * What the choice looks like when it lands (2026-09-08, per user direction). An Evolution is the
 * most permanent thing a run does to a hero and it used to resolve as a screen swap — the dossier
 * closed and the level-up list came back one line different.
 *
 * Three beats, and they are the shape of the moment rather than decoration: the hero CHARGES
 * (rings closing in, the figure lit from inside and shaking), the charge BURSTS (a white-out that
 * hides the swap, which is the whole trick), and the new form is REVEALED under the path's name
 * and the typing it lands on. A tap skips to the end; nothing here is load-bearing, so a player
 * who has seen it twenty times never has to sit through it.
 */
function EvolutionCinematic({ hero, path, onDone }: { hero: HeroDefinition; path: EvolutionPath; onDone: () => void }) {
  const [beat, setBeat] = useState<'charge' | 'burst' | 'reveal'>('charge');
  const types = pathTypes(hero, path);

  useEffect(() => {
    if (prefersReducedMotion()) {
      onDone();
      return;
    }
    playSfx('titan.stir');
    const timers = [
      window.setTimeout(() => {
        setBeat('burst');
        playSfx('seal.shatter');
      }, EVOLVE_BEATS.burst),
      window.setTimeout(() => {
        setBeat('reveal');
        playSfx('levelUp');
      }, EVOLVE_BEATS.reveal),
      window.setTimeout(onDone, EVOLVE_BEATS.done),
    ];
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`evolve-cinematic is-${beat}`} style={paletteStyle(hero, path)} onClick={onDone}>
      <span className="evolve-cinematic-veil" aria-hidden="true" />
      <span className="evolve-cinematic-rays" aria-hidden="true" />

      <div className="evolve-cinematic-stage">
        <span className="evolve-ring is-outer" aria-hidden="true" />
        <span className="evolve-ring is-inner" aria-hidden="true" />
        <span className="evolve-column" aria-hidden="true" />
        <HeroPortrait heroId={hero.id} className="evolve-figure" />
        <span className="evolve-flash" aria-hidden="true" />
      </div>

      <div className="evolve-cinematic-plate">
        <div className="evolve-cinematic-eyebrow">{hero.name} evolved</div>
        <h2 className="evolve-cinematic-name">{path.name}</h2>
        <div className="evolve-cinematic-types">
          {types.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </div>
      </div>
    </div>
  );
}
