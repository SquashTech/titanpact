import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { HeroDefinition, MoveDefinition, StatKey, TypeId } from '../../engine/content';
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
import { MoveKindBadge, MoveTraitChips, healReadout, moveEffectSummary, useLongPress } from '../shared/MoveTile';
import { ManaCost } from '../shared/ManaCost';
import { ChargePips } from '../shared/ChargePips';
import { moveForPrimaryType } from '../../engine/state';
import type { HealCaster } from '../../engine/heal/healPipeline';
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
  const slots = grantSlots(node.paths);
  const rowCount = slots?.length ?? Math.max(...node.paths.map((path) => grantsOf(path).length));
  const dense = rowCount > 2;

  return (
    <div
      className="node-screen evolution-screen"
      style={{ '--path-lead': getTypeColor(hero.types[0]), '--path-trail': getTypeColor(hero.types[1] ?? hero.types[0]) } as CSSProperties}
    >
      {/* Placeless: a painted moon sat behind the readout, and this moment is the hero's, not the act's. */}
      <NodeSky placeless />
      <span className="evolution-sky-rays is-floating" aria-hidden="true" />
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
        <div className={`evo-form-row${dense ? ' is-dense' : ''}${rowCount > 3 ? ' is-packed' : ''}`}>
          {node.paths.map((path, i) => (
            <FormCard key={path.id} hero={hero} path={path} slots={slots} onInspect={() => setInspectedIndex(i)} />
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

/** One thing a path hands over — two on most paths, three on a few named ones — as the card and the showcase both draw it. */
type Grant = { kind: 'type'; type: TypeId } | { kind: 'move'; id: string } | { kind: 'passive'; id: string };

const GRANT_KIND_LABEL = { type: 'New type', move: 'New move', passive: 'New passive' } as const;

function grantsOf(path: EvolutionPath): Grant[] {
  const out: Grant[] = [];
  if (path.typeGraft) out.push({ kind: 'type', type: path.typeGraft });
  for (const id of path.unlocksMoveIds) if (moves[id]) out.push({ kind: 'move', id });
  for (const id of path.grantsPassiveIds ?? []) if (passives[id]) out.push({ kind: 'passive', id });
  return out;
}

/**
 * The rows every card in the node draws, by kind — a type, then each move, then each passive, as
 * many of each as the richest path pays — so a medal sits level with its kind on the other cards.
 * Null when every path pays the same count (the regular three pairs): the cards then draw their
 * grants as they come, row for row, with no empty socket on every card.
 */
function grantSlots(paths: readonly EvolutionPath[]): Grant['kind'][] | null {
  if (new Set(paths.map((path) => grantsOf(path).length)).size <= 1) return null;
  const most = (kind: Grant['kind']) => Math.max(0, ...paths.map((path) => grantsOf(path).filter((g) => g.kind === kind).length));
  return (['type', 'move', 'passive'] as const).flatMap((kind) => Array<Grant['kind']>(most(kind)).fill(kind));
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
 * hero lit in the colours the path lands it on, the typing it ends with, and the path's grants
 * as medallions. A headline to compare at a glance; the tap opens the showcase, where the
 * choice is read in full and spent.
 */
function FormCard({ hero, path, slots, onInspect }: { hero: HeroDefinition; path: EvolutionPath; slots: Grant['kind'][] | null; onInspect: () => void }) {
  const grants = grantsOf(path);
  const rows = slots ?? grants.map((g) => g.kind);
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
        {rows.map((kind, i) => {
          // The nth slot of a kind takes this path's nth grant of it; a path that pays none leaves the row empty.
          const nth = rows.slice(0, i).filter((k) => k === kind).length;
          const grant = grants.filter((g) => g.kind === kind)[nth];
          if (!grant) {
            return (
              <span key={i} className="evo-form-grant is-empty">
                <span className="evo-form-medal" />
                <span className="evo-form-kind">{GRANT_KIND_LABEL[kind]}</span>
                <span className="evo-form-grant-name">None</span>
              </span>
            );
          }
          return (
            <span key={i} className="evo-form-grant" style={{ '--grant': grantColor(grant) } as CSSProperties}>
              <span className="evo-form-medal">
                <GrantGlyph grant={grant} />
              </span>
              <span className="evo-form-kind">{GRANT_KIND_LABEL[kind]}</span>
              <span className="evo-form-grant-name">{grantName(grant)}</span>
            </span>
          );
        })}
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
export function PassiveGrantRow({ passiveId, onRead }: { passiveId: string; onRead: () => void }) {
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
 * the dossier sheet). The hero stands on rays in the path's colours with its typing beside it.
 * Under it, the path's gifts strung down one thread, unboxed (2026-10-08, per user direction — a
 * stone panel of bordered rows was boxes inside boxes): the new type, the move, each passive, a
 * rewire, each a medal and a line, every tap opening the full card; a pair or a named path's
 * three draw the same way. Everything the choice is made with sits together at the foot: the
 * dots, the arrows either side of the commit, and the way back. Nothing scrolls (2026-10-02, per
 * user direction): on a short screen the stage and the medals give up height first.
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
      </div>

      {/* Keyed on the path so paging replays the gifts' entrance. */}
      <div className="evo-show-body" key={path.id}>
        <ol className="evo-gifts">
          {grantsOf(path).map((grant, i) => (
            <GiftLine
              key={i}
              grant={grant}
              order={i}
              traded={traded}
              caster={caster}
              onRead={grant.kind === 'move' ? () => setReadingMoveId(grant.id) : grant.kind === 'passive' ? () => setReadingPassiveId(grant.id) : undefined}
            />
          ))}
          {swapEntries.length > 0 && (
            <li className="evo-gift is-rewire" style={{ '--i': grantsOf(path).length } as CSSProperties}>
              <span className="evo-gift-medal">⇄</span>
              <span className="evo-gift-body">
                <span className="evo-gift-kind">Rewired</span>
                <span className="evo-gift-name">Attack ⇄ Intelligence</span>
                <span className="evo-show-swap">
                  {swapEntries.map(([stat, amount]) => (
                    <span key={stat} className={`evo-show-swap-stat${amount < 0 ? ' is-loss' : ''}`}>
                      <StatGlyph stat={stat} /> {STAT_LABELS[stat]} {current[stat]} → <strong>{current[stat] + amount}</strong>
                    </span>
                  ))}
                </span>
              </span>
            </li>
          )}
        </ol>

        {poolMoves.length > 0 && (
          <div className="evo-show-pool">
            <div className="evo-show-pool-kind">Level-ups can teach</div>
            <div className="evolution-pool-chips">
              {poolMoves.map((id) => (
                <PoolMoveChip key={id} moveId={id} onRead={() => setReadingMoveId(id)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* The choice in one place: which form (dots, arrows), take it, or back out. Not
          `.resolve-button`: this is the one press in the run that spends something permanent, and
          it should not look like Continue. The way back sits under it rather than only in a
          corner: backing out of a decision should not be the hardest press here. */}
      <div className="evolution-dossier-actions">
        <div className="evo-show-dots" aria-hidden="true">
          {paths.map((p, i) => (
            <span key={p.id} className={`evo-show-dot${i === index ? ' is-on' : ''}`} />
          ))}
        </div>
        <div className="evo-show-commit">
          <button className="evo-show-arrow" aria-label="Previous form" data-sfx="ui.select" onClick={() => step(-1)}>
            <ShowcaseChevron flip />
          </button>
          <button className="evolve-button" data-sfx="none" onClick={onChoose}>
            <span className="evolve-button-sheen" aria-hidden="true" />
            <span className="evolve-button-rays" aria-hidden="true" />
            <span className="evolve-button-label">
              <span className="evolve-button-kicker">Evolve into</span>
              <span className="evolve-button-name">{path.name}</span>
            </span>
          </button>
          <button className="evo-show-arrow" aria-label="Next form" data-sfx="ui.select" onClick={() => step(1)}>
            <ShowcaseChevron />
          </button>
        </div>
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

/** The arrows beside the commit, drawn so they sit dead centre in the ring (a text chevron rides its baseline). */
function ShowcaseChevron({ flip }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * One gift on the showcase's thread: its medal (the form card's, so the two screens read as one
 * thing at two sizes), what kind of gift, its name, and one line of what it does. A move's line
 * is the fight's own readout — mana, power, kind, traits, effect — without the button around it.
 */
function GiftLine({
  grant,
  order,
  traded,
  caster,
  onRead,
}: {
  grant: Grant;
  order: number;
  traded: TypeId | null;
  caster: HealCaster;
  onRead?: () => void;
}) {
  const style = { '--grant': grantColor(grant), '--i': order } as CSSProperties;
  const body = (
    <>
      <span className="evo-gift-medal">
        <GrantGlyph grant={grant} />
      </span>
      <span className="evo-gift-body">
        <span className="evo-gift-kind">{GRANT_KIND_LABEL[grant.kind]}</span>
        {grant.kind === 'type' && (
          <>
            <span className="evo-gift-name">{grant.type}</span>
            <span className="evo-gift-text">{traded ? `Trades ${traded} for ${grant.type}` : `Joins its typing as a second type`}</span>
          </>
        )}
        {grant.kind === 'move' && <MoveGiftText move={moveForPrimaryType(moves[grant.id], caster.types[0])} caster={caster} />}
        {grant.kind === 'passive' && (
          <>
            <span className="evo-gift-name">{passives[grant.id].name}</span>
            <span className="evo-gift-text">{passives[grant.id].description}</span>
          </>
        )}
      </span>
    </>
  );
  return (
    <li className={`evo-gift is-${grant.kind}`} style={style}>
      {onRead ? (
        <button type="button" className="evo-gift-press" data-sfx="ui.select" onClick={onRead}>
          {body}
        </button>
      ) : (
        <span className="evo-gift-press">{body}</span>
      )}
    </li>
  );
}

function MoveGiftText({ move, caster }: { move: MoveDefinition; caster: HealCaster }) {
  const heal = healReadout(move, caster);
  const power =
    move.kind === 'damage'
      ? move.basePower != null
        ? `${move.basePower}`
        : move.randomBasePower
          ? `${move.randomBasePower.min}–${move.randomBasePower.max}`
          : null
      : heal
        ? `${heal.value}`
        : null;
  return (
    <>
      <span className="evo-gift-head">
        <span className="evo-gift-name">{move.name}</span>
        <span className="evo-gift-facts">
          <ManaCost cost={move.manaCost} size="sm" />
          {power && <strong className={`evo-gift-power${heal ? ' is-heal' : ''}`}>{power}</strong>}
          <ChargePips move={move} />
          <MoveKindBadge move={move} />
        </span>
      </span>
      <span className="evo-gift-text">
        <MoveTraitChips move={move} />
        {moveEffectSummary(move, caster)}
      </span>
    </>
  );
}

/** Beat boundaries for the evolution cinematic, in ms from the press; the morph's own swaps follow. */
const EVOLVE_BEATS = { charge: 1400, morph: 2400, revealHold: 380, done: 5200 } as const;

/**
 * The gaps between the morph's swaps (ms), old form ⇄ new, closing in until they blur. Odd in
 * count, so the last swap leaves the NEW silhouette up for the burst to break open.
 */
const MORPH_GAPS = [440, 360, 300, 250, 210, 175, 145, 120, 100, 84, 70, 60, 52, 46, 42, 40, 40, 40, 40] as const;
const MORPH_MS = MORPH_GAPS.reduce((sum, gap) => sum + gap, 0);

type EvolveBeat = 'intro' | 'charge' | 'morph' | 'burst' | 'reveal';

// Golden-angle scatter, stable with no seed: light drawn IN to the hero, and sparks thrown OUT.
const EVOLVE_MOTES = Array.from({ length: 18 }, (_, i) => {
  const seed = i * 137.51;
  return { angle: seed % 360, distance: 120 + ((seed * 0.37) % 70), delay: (seed * 0.011) % 1.1 };
});
const EVOLVE_SPARKS = Array.from({ length: 22 }, (_, i) => {
  const seed = i * 137.51;
  return { angle: seed % 360, distance: 90 + ((seed * 0.53) % 110), size: 6 + ((seed * 0.19) % 8), trail: i % 3 === 0 };
});

/**
 * What the choice looks like when it lands (2026-10-07, per user direction — "big and epic, like
 * Pokémon"). The hero is announced EVOLVING in its own colours with light drawn in to it; it
 * CHARGES to a white silhouette as the chart spins up; then the MORPH — old form and new
 * swapping in silhouette, faster and faster, a tick under each swap — until it BURSTS in a
 * white-out and the new form is REVEALED in colour, throwing sparks, under the path's name and
 * the typing it lands on. The first tap jumps to the reveal, the second (or the timer) moves on.
 */
function EvolutionCinematic({ hero, path, onDone }: { hero: HeroDefinition; path: EvolutionPath; onDone: () => void }) {
  const [beat, setBeat] = useState<EvolveBeat>('intro');
  /** How many swaps the morph has made: odd shows the new form. */
  const [swaps, setSwaps] = useState(0);
  const types = pathTypes(hero, path);
  const revealed = beat === 'reveal';
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (prefersReducedMotion()) {
      onDone();
      return;
    }
    playSfx('titan.stir');
    const at = (ms: number, fn: () => void) => window.setTimeout(fn, ms);
    const pending = (timers.current = [
      at(EVOLVE_BEATS.charge, () => {
        setBeat('charge');
        playSfx('evolve.charge');
      }),
      at(EVOLVE_BEATS.morph, () => setBeat('morph')),
    ]);
    let t = EVOLVE_BEATS.morph;
    MORPH_GAPS.forEach((gap, i) => {
      t += gap;
      // The tick climbs with the swaps, so the ear hears the same acceleration the eye does.
      pending.push(
        at(t, () => {
          setSwaps(i + 1);
          playSfx('star.tick', { pitch: 0.8 + i * 0.05, gain: 0.8 });
        })
      );
    });
    const burstAt = EVOLVE_BEATS.morph + MORPH_MS + 60;
    pending.push(
      at(burstAt, () => {
        setBeat('burst');
        playSfx('seal.shatter');
      }),
      at(burstAt + EVOLVE_BEATS.revealHold, () => {
        setBeat('reveal');
        playSfx('evolve.fanfare');
      }),
      at(burstAt + EVOLVE_BEATS.revealHold + EVOLVE_BEATS.done, onDone)
    );
    return () => timers.current.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function skip() {
    if (revealed) {
      onDone();
      return;
    }
    // Skipping still lands on the new form: the player chose it, and should see what it is.
    timers.current.forEach(window.clearTimeout);
    timers.current = [window.setTimeout(onDone, EVOLVE_BEATS.done)];
    setBeat('reveal');
    playSfx('evolve.fanfare');
  }

  const showNew = revealed || beat === 'burst' || swaps % 2 === 1;
  const line = revealed ? (
    <>
      {hero.name} evolved into <strong>{path.name}</strong>!
    </>
  ) : (
    <>{hero.name} is evolving!</>
  );

  // Portalled into overlayHost(), never body (overlayHost.ts): the stage rules pin a screen's
  // children to `position: relative`, which would flatten this into the bottom of the column.
  return createPortal(
    <div className={`evo-rite is-${beat}`} style={pathTintStyle(hero, path)} onClick={skip}>
      <span className="evo-rite-veil" aria-hidden="true" />
      <span className="evo-rite-rush" aria-hidden="true" />
      <span className="evo-rite-rays" aria-hidden="true" />

      <div className="evo-rite-stage">
        {/* The chart spins up through the charge, the hero becoming one thing, and comes back slow
            after the burst with its new typing lit. Unfocused until the reveal. */}
        <TypeWheel className="evo-rite-wheel" size={EVOLVE_WHEEL} focus={revealed ? types : undefined} />
        <span className="evo-rite-ring is-outer" aria-hidden="true" />
        <span className="evo-rite-ring is-inner" aria-hidden="true" />
        <span className="evo-rite-column" aria-hidden="true" />
        {EVOLVE_MOTES.map((m, i) => (
          <span
            key={i}
            className="evo-rite-mote"
            style={{ '--a': `${m.angle}deg`, '--d': `${m.distance}px`, animationDelay: `${m.delay}s` } as CSSProperties}
            aria-hidden="true"
          />
        ))}
        {/* Both forms stand in one place; the morph shows one silhouette at a time. */}
        <HeroPortrait heroId={hero.id} className={`evo-rite-figure is-old${showNew ? '' : ' is-shown'}`} />
        <HeroPortrait heroId={hero.id} pathId={path.id} className={`evo-rite-figure is-new${showNew ? ' is-shown' : ''}`} />
        {/* The reveal's white, as its own layer that only fades: the form under it is never filtered white. */}
        {revealed && <HeroPortrait heroId={hero.id} pathId={path.id} className="evo-rite-figure is-afterglow" />}
        <span className="evo-rite-flash" aria-hidden="true" />
        {revealed &&
          EVOLVE_SPARKS.map((s, i) => (
            <span
              key={i}
              className={`evo-rite-spark${s.trail ? ' is-trail' : ''}`}
              style={{ '--a': `${s.angle}deg`, '--d': `${s.distance}px`, '--s': `${s.size}px` } as CSSProperties}
              aria-hidden="true"
            />
          ))}
      </div>

      <div className="evo-rite-box">
        <span className="evo-rite-line" key={revealed ? 'evolved' : 'evolving'}>
          {line}
        </span>
        {revealed && (
          <span className="evo-rite-types">
            {types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </span>
        )}
        {revealed && <span className="evo-rite-more" aria-hidden="true" />}
      </div>
    </div>,
    overlayHost()
  );
}
