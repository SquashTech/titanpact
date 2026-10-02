import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { HeroDefinition, StatKey, TypeId } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import { offenseSwapDelta, pathTypes, type EvolutionNode, type EvolutionPath } from '../../run/progression';
import { pathTint, pathTintStyle } from '../shared/pathTint';
import { passives } from '../../data/passives';
import { PassiveGlyph, passiveColor } from '../shared/passiveIcons';
import { PassiveDetailOverlay } from '../shared/PassiveDossier';
import { moves } from '../../data/moves';
import { MoveDetailOverlay } from '../combat/MoveDetailOverlay';
import { StatGlyph, STAT_LABELS } from '../shared/StatBars';
import { TypeBadge } from '../shared/TypeBadge';
import { TypeMatchups } from '../shared/TypeMatchups';
import { ElementGlyph } from '../shared/elementIcons';
import { getTypeColor } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeWheel } from '../shared/TypeWheel';
import { MoveButtonReplica, useLongPress } from '../shared/MoveTile';
import { healCasterForEntry } from '../shared/healCaster';
import { entryStatTotals } from '../shared/entryStatTotals';
import { NodeHeader, NodeSky } from '../shared/NodeStage';
import { overlayHost } from '../shared/overlayHost';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { playSfx } from '../../audio/sfx';
import { RosterPeek } from './RosterPeek';
import { MasteryPips } from '../shared/MasteryPips';
import { MASTERY_EVOLUTION } from '../../run/mastery';
import { EvolutionStar } from '../shared/EvolutionStar';
import { useHasEvolutionStar } from '../shared/ProfileContext';

interface Props {
  hero: HeroDefinition;
  entry: RosterEntry;
  node: EvolutionNode;
  /** Only for the corner roster glyph — checking the team's type coverage before locking a graft in. */
  run: RunState;
  onChoose: (pathId: string) => void;
}

/** The type a graft COSTS — only a hero born dual has one to give up. */
function tradedType(hero: HeroDefinition, path: EvolutionPath): TypeId | null {
  return path.typeGraft ? hero.types[1] ?? null : null;
}

/**
 * Full-screen Evolution choice: the three forms side by side, and a tap opens one in the showcase.
 * The choice is permanent for the run, so the confirm lives there, on the screen that explains it,
 * rather than under three cards that only headline it.
 */
export function EvolutionScreen({ hero, entry, node, run, onChoose }: Props) {
  /** The awakening has played (or was skipped): the choice is on screen. Reduced motion skips it. */
  const [awakened, setAwakened] = useState(() => prefersReducedMotion());
  const [inspectedIndex, setInspectedIndex] = useState<number | null>(null);
  /** Set once the choice is spent: the cinematic runs over the screen and calls `onChoose` at the end. */
  const [sealingPathId, setSealingPathId] = useState<string | null>(null);
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

      <div className="evo-forms">
        <div className="evo-form-row">
          {node.paths.map((path, i) => (
            <FormCard key={path.id} hero={hero} path={path} onInspect={() => setInspectedIndex(i)} />
          ))}
        </div>
        <p className="evolution-inspect-hint">Tap a form to see it in full.</p>
      </div>

      {inspectedIndex !== null && (
        <PathShowcase
          hero={hero}
          entry={entry}
          run={run}
          paths={node.paths}
          index={inspectedIndex}
          onIndex={setInspectedIndex}
          onChoose={() => setSealingPathId(node.paths[inspectedIndex].id)}
          onClose={() => setInspectedIndex(null)}
        />
      )}

      {sealingPath && (
        <EvolutionCinematic
          hero={hero}
          path={sealingPath}
          onDone={() => onChoose(sealingPath.id)}
        />
      )}

      {!awakened && <EvolutionAwakening hero={hero} onDone={() => setAwakened(true)} />}
    </div>
  );
}

/** The dial behind the stage, px: past the outer ring, and clear of the pips and the plate under it. */
const EVOLVE_WHEEL = 300;

/** Beat boundaries for the awakening, in ms from the screen landing. */
const AWAKEN_BEATS = { crack: 1300, call: 2150, done: 5200 } as const;

/**
 * What reaching the Evolution looks like BEFORE the choice (2026-09-15, per user direction).
 * The fifth pip landed on a who-screen and the next thing on screen was three cards — the
 * biggest moment a hero has in a run opened as a menu. This is the beat between: the hero
 * STIRS (the pip strip under it, the fifth lighting), the seal CRACKS (rings closing, the
 * column rising, the figure shaking and brightening — the seal cinematic's charge, stopped short
 * of the white-out, because nothing is being swapped yet), and the CALL lands: the name, and the
 * one line that says what is now being asked. The choice screen is already mounted under it, so
 * the veil lifting IS the transition. A tap skips to the choice at any beat; it holds for a tap
 * on the last one and lets itself out after a while for a player who has put the phone down.
 */
function EvolutionAwakening({ hero, onDone }: { hero: HeroDefinition; onDone: () => void }) {
  const [beat, setBeat] = useState<'stir' | 'crack' | 'call'>('stir');
  const lead = hero.types[0];
  const trail = hero.types[1] ?? lead;

  useEffect(() => {
    playSfx('titan.stir');
    const timers = [
      window.setTimeout(() => {
        setBeat('crack');
        playSfx('seal.strike');
      }, AWAKEN_BEATS.crack),
      window.setTimeout(() => {
        setBeat('call');
        playSfx('levelUp');
      }, AWAKEN_BEATS.call),
      window.setTimeout(onDone, AWAKEN_BEATS.done),
    ];
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same portal, same stage vocabulary as the seal cinematic below — one look for both halves of
  // the moment, the awakening washed in the hero's OWN types since no path has been picked yet.
  return createPortal(
    <div
      className={`evolve-cinematic evolve-awakening is-${beat}`}
      style={{ '--path-lead': getTypeColor(lead), '--path-trail': getTypeColor(trail) } as CSSProperties}
      onClick={onDone}
    >
      <span className="evolve-cinematic-veil" aria-hidden="true" />
      <span className="evolve-cinematic-rays" aria-hidden="true" />

      <div className="evolve-cinematic-stage">
        {/* The chart behind the hero, its own types lit: what it is, before it is asked what to become. */}
        <TypeWheel className="evolve-wheel" size={EVOLVE_WHEEL} focus={hero.types} />
        <span className="evolve-ring is-outer" aria-hidden="true" />
        <span className="evolve-ring is-inner" aria-hidden="true" />
        <span className="evolve-column" aria-hidden="true" />
        <HeroPortrait heroId={hero.id} className="evolve-figure" />
        <span className="evolve-flash" aria-hidden="true" />
      </div>

      <MasteryPips mastery={MASTERY_EVOLUTION} className="evolve-awakening-pips" />

      <div className="evolve-cinematic-plate">
        <div className="evolve-cinematic-eyebrow">Mastery {MASTERY_EVOLUTION}</div>
        <h2 className="evolve-cinematic-name">{hero.name} is ready to evolve</h2>
        <div className="evolve-awakening-prompt">Tap to choose a path</div>
      </div>
    </div>,
    overlayHost()
  );
}

/** One of the two things a path hands over, as the card and the showcase both draw it. */
type Grant = { kind: 'type'; type: TypeId } | { kind: 'move'; id: string } | { kind: 'passive'; id: string };

const GRANT_KIND_LABEL = { type: 'New type', move: 'New move', passive: 'New passive' } as const;

function grantsOf(path: EvolutionPath): Grant[] {
  const out: Grant[] = [];
  if (path.typeGraft) out.push({ kind: 'type', type: path.typeGraft });
  for (const id of path.unlocksMoveIds) if (moves[id]) out.push({ kind: 'move', id });
  for (const id of path.grantsPassiveIds ?? []) if (passives[id]) out.push({ kind: 'passive', id });
  return out;
}

function grantColor(grant: Grant): string {
  if (grant.kind === 'type') return getTypeColor(grant.type);
  if (grant.kind === 'move') return getTypeColor(moves[grant.id].type);
  return passiveColor(grant.id);
}

function grantName(grant: Grant): string {
  if (grant.kind === 'type') return grant.type;
  if (grant.kind === 'move') return moves[grant.id].name;
  return passives[grant.id].name;
}

function GrantGlyph({ grant }: { grant: Grant }) {
  if (grant.kind === 'type') return <ElementGlyph type={grant.type} />;
  if (grant.kind === 'move') return <ElementGlyph type={moves[grant.id].type} />;
  return <PassiveGlyph passiveId={grant.id} />;
}

/**
 * One of the three forms, side by side with the other two (2026-09-29, per user direction): the
 * hero lit in the colours the path lands it on, the typing it ends with, and the path's two
 * grants as medallions. A headline to compare at a glance; the tap opens the showcase, where the
 * choice is read in full and spent.
 */
function FormCard({ hero, path, onInspect }: { hero: HeroDefinition; path: EvolutionPath; onInspect: () => void }) {
  const traded = tradedType(hero, path);
  const starred = useHasEvolutionStar(hero.id, path.id);
  return (
    <button className={`evo-form-card${starred ? ' is-starred' : ''}`} style={pathTintStyle(hero, path)} data-sfx="ui.select" onClick={onInspect}>
      <span className="evo-form-name">
        {path.name}
        {starred && <EvolutionStar path={path} className="evolution-path-star" />}
      </span>
      <span className="evo-form-stage">
        <span className="evo-form-aura" aria-hidden="true" />
        <HeroPortrait heroId={hero.id} pathId={path.id} className="evo-form-portrait" />
      </span>
      <span className="evo-form-types">
        {pathTypes(hero, path).map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
      </span>
      {traded && <span className="evo-form-traded">loses {traded}</span>}
      {path.swapsOffense && <span className="evo-form-rewire">Atk ⇄ Int</span>}
      <span className="evo-form-grants">
        {grantsOf(path).map((grant, i) => (
          <span key={i} className="evo-form-grant" style={{ '--grant': grantColor(grant) } as CSSProperties}>
            <span className="evo-form-medal">
              <GrantGlyph grant={grant} />
            </span>
            <span className="evo-form-kind">{GRANT_KIND_LABEL[grant.kind]}</span>
            <span className="evo-form-grant-name">{grantName(grant)}</span>
          </span>
        ))}
      </span>
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
      className="evo-pool-chip"
      style={{ '--move-color': getTypeColor(move.type) } as CSSProperties}
      data-sfx="none"
      {...press}
    >
      <ElementGlyph type={move.type} /> {move.name}
    </button>
  );
}

/** A granted passive as one row: the glyph, the name and the rule, clamped. The tap opens it whole. */
function PassiveGrantRow({ passiveId, onRead }: { passiveId: string; onRead: () => void }) {
  const passive = passives[passiveId];
  return (
    <button
      type="button"
      className="evo-passive-row"
      style={{ '--passive-color': passiveColor(passiveId) } as CSSProperties}
      data-sfx="ui.select"
      onClick={onRead}
    >
      <span className="evo-passive-icon">
        <PassiveGlyph passiveId={passiveId} />
      </span>
      <span className="evo-passive-text">
        <span className="evo-passive-name">{passive.name}</span>
        <span className="evo-passive-desc">{passive.description}</span>
      </span>
    </button>
  );
}

/** A horizontal drag this long across the stage steps to the neighbouring form. */
const SHOWCASE_SWIPE_PX = 44;

/**
 * One form at full size, and where the choice is spent (2026-09-29, per user direction, replacing
 * the dossier sheet). The hero stands on rays in the path's colours; the arrows, the dots and a
 * swipe page between the three without going back. Under it, ONE panel of rows — the new type and
 * what it changes on the chart, the move as the fight draws it, the passive, a rewire, the line —
 * each tap opening the full card. Nothing scrolls (2026-10-02, per user direction): the stage
 * gives up height on a short screen so the rows and the commit never fall below a fold.
 */
function PathShowcase({
  hero,
  entry,
  run,
  paths,
  index,
  onIndex,
  onChoose,
  onClose,
}: {
  hero: HeroDefinition;
  entry: RosterEntry;
  run: RunState;
  paths: readonly EvolutionPath[];
  index: number;
  onIndex: (index: number) => void;
  onChoose: () => void;
  onClose: () => void;
}) {
  const [readingMoveId, setReadingMoveId] = useState<string | null>(null);
  const [readingPassiveId, setReadingPassiveId] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const path = paths[index];
  const tint = pathTint(hero, path);
  const types = pathTypes(hero, path);
  // Post-graft types, not the entry's current ones: the granted move is usually the graft's own type.
  const caster = { ...healCasterForEntry(hero, entry, run.relics), types };
  const current = entryStatTotals(hero, entry, run.relics);
  // A rewire's rows are read off this hero's own Attack and Intelligence — what it would trade now.
  const swapEntries = path.swapsOffense ? (Object.entries(offenseSwapDelta(hero, entry)) as [StatKey, number][]) : [];
  const grantedPassives = (path.grantsPassiveIds ?? []).filter((id) => passives[id]);
  const grantedMoves = path.unlocksMoveIds.filter((id) => moves[id]);
  const poolMoves = (path.learnableMoveIds ?? []).filter((id) => moves[id]);
  const traded = tradedType(hero, path);
  const step = (delta: number) => onIndex((index + delta + paths.length) % paths.length);

  return (
    <div className="evo-show is-floating" style={pathTintStyle(hero, path)}>
      <div
        className="evo-show-hero"
        onPointerDown={(e) => setDragFrom(e.clientX)}
        onPointerUp={(e) => {
          if (dragFrom !== null && Math.abs(e.clientX - dragFrom) >= SHOWCASE_SWIPE_PX) step(e.clientX < dragFrom ? 1 : -1);
          setDragFrom(null);
        }}
        onPointerCancel={() => setDragFrom(null)}
      >
        <button className="evo-show-arrow is-prev" aria-label="Previous form" data-sfx="ui.select" onClick={() => step(-1)}>
          ‹
        </button>
        <span className="evo-show-stage">
          <span className="evo-show-rays" aria-hidden="true" />
          <span className="evo-show-aura" aria-hidden="true" />
          <HeroPortrait key={path.id} heroId={hero.id} pathId={path.id} className="evo-show-portrait" />
        </span>
        <div className="evo-show-info">
          <div className="evo-show-name" style={{ color: tint.lead }}>
            {path.name}
          </div>
          <div className="evo-show-types">
            {types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
          <TypeMatchups types={types} />
        </div>
        <button className="evo-show-arrow is-next" aria-label="Next form" data-sfx="ui.select" onClick={() => step(1)}>
          ›
        </button>
        <div className="evo-show-dots" aria-hidden="true">
          {paths.map((p, i) => (
            <span key={p.id} className={`evo-show-dot${i === index ? ' is-on' : ''}`} />
          ))}
        </div>
        {path.description && <p className="evo-show-desc">{path.description}</p>}
      </div>

      <div className="evo-show-body">
        <div className="evo-show-rows">
        {path.typeGraft && (
          <section className="evo-show-row is-inline">
            <div className="evo-show-kind">New type</div>
            <TypeBadge type={path.typeGraft} />
            {traded && <span className="evo-show-kind-note">trades {traded} for {path.typeGraft}</span>}
          </section>
        )}

        {grantedMoves.map((id) => (
          <section key={id} className="evo-show-row">
            <div className="evo-show-kind">New move</div>
            <MoveButtonReplica move={moves[id]} caster={caster} onClick={() => setReadingMoveId(id)} onLongPress={() => setReadingMoveId(id)} />
          </section>
        ))}

        {grantedPassives.map((id) => (
          <section key={id} className="evo-show-row">
            <div className="evo-show-kind">New passive</div>
            <PassiveGrantRow passiveId={id} onRead={() => setReadingPassiveId(id)} />
          </section>
        ))}

        {swapEntries.length > 0 && (
          <section className="evo-show-row is-inline">
            <div className="evo-show-kind">Atk ⇄ Int</div>
            <div className="evo-show-swap">
              {swapEntries.map(([stat, amount]) => (
                <span key={stat} className={`evo-show-swap-stat${amount < 0 ? ' is-loss' : ''}`}>
                  <StatGlyph stat={stat} /> {STAT_LABELS[stat]} {current[stat]} → <strong>{current[stat] + amount}</strong>
                </span>
              ))}
            </div>
          </section>
        )}

        {poolMoves.length > 0 && (
          <section className="evo-show-row">
            <div className="evo-show-kind">Level-ups can teach</div>
            <div className="evolution-pool-chips">
              {poolMoves.map((id) => (
                <PoolMoveChip key={id} moveId={id} onRead={() => setReadingMoveId(id)} />
              ))}
            </div>
          </section>
        )}
        </div>
      </div>

      {/* Not `.resolve-button`: this is the one press in the run that spends something
          permanent, and it should not look like Continue. The way back sits under it rather
          than only in a corner: backing out of a decision should not be the hardest press here. */}
      <div className="evolution-dossier-actions">
        <button className="evolve-button" data-sfx="none" onClick={onChoose}>
          <span className="evolve-button-sheen" aria-hidden="true" />
          <span className="evolve-button-rays" aria-hidden="true" />
          <span className="evolve-button-label">
            <span className="evolve-button-kicker">Evolve into</span>
            <span className="evolve-button-name">{path.name}</span>
          </span>
        </button>
        <button className="evolution-dossier-back" data-sfx="ui.back" onClick={onClose}>
          Back to paths
        </button>
      </div>

      {readingMoveId && (
        <MoveDetailOverlay move={moves[readingMoveId]} caster={caster} onClose={() => setReadingMoveId(null)} />
      )}
      <PassiveDetailOverlay passive={readingPassiveId ? passives[readingPassiveId] : null} onClose={() => setReadingPassiveId(null)} />
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

  // Portalled into overlayHost(), never body (overlayHost.ts): the stage rules pin a screen's
  // children to `position: relative`, which would flatten this into the bottom of the column.
  return createPortal(
    <div className={`evolve-cinematic is-${beat}`} style={pathTintStyle(hero, path)} onClick={onDone}>
      <span className="evolve-cinematic-veil" aria-hidden="true" />
      <span className="evolve-cinematic-rays" aria-hidden="true" />

      <div className="evolve-cinematic-stage">
        {/* The whole chart spins up through the charge and bleeds into the path's colour — the
            hero becoming one thing — and comes back slow after the burst with its new typing lit.
            Unfocused until the reveal so the charge starts from the full chart. */}
        <TypeWheel className="evolve-wheel" size={EVOLVE_WHEEL} focus={beat === 'reveal' ? types : undefined} />
        <span className="evolve-ring is-outer" aria-hidden="true" />
        <span className="evolve-ring is-inner" aria-hidden="true" />
        <span className="evolve-column" aria-hidden="true" />
        {/* The new form arrives under the white-out, which is what the burst is for. */}
        <HeroPortrait heroId={hero.id} pathId={beat === 'reveal' ? path.id : undefined} className="evolve-figure" />
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
    </div>,
    overlayHost()
  );
}
