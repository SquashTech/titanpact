import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { playSfx } from '../../audio/sfx';
import type { SfxId } from '../../audio/sounds';
import { moves } from '../../data/moves';
import { passives } from '../../data/passives';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition, MoveTier, StatKey, TypeId } from '../../engine/content';
import { gradesFor } from '../../run/growth';
import { pathTypes, type EvolutionPath } from '../../run/progression';
import { pathTint } from '../shared/pathTint';
import { scheduleFor, signatureLevelFor } from '../../run/progression';
import { MASTERY_EVOLUTION, MASTERY_INNATE } from '../../run/mastery';
import type { LevelSchedule } from '../../engine/content';
import { MoveDetailCard } from '../combat/MoveDetailOverlay';
import { HeroPortrait } from '../shared/HeroPortrait';
import { getTypeColor } from '../combat/typeColors';
import { MoveButtonReplica } from '../shared/MoveTile';
import { PassiveReadout } from '../shared/passiveIcons';
import { computeStatTotal, StatGlyph, STAT_LABELS } from '../shared/StatBars';
import { StatColumns } from '../shared/StatColumns';
import { ElementGlyph } from '../shared/elementIcons';
import { TabStrip, type TabSpec } from '../shared/TabStrip';
import { TypeBadge } from '../shared/TypeBadge';
import { isTitanspawn } from '../../data/titanspawn';
import { innatePassiveOf, masteredInnateOf, titansMarkOf } from '../../run/innate';
import { TypeMatchups } from '../shared/TypeMatchups';
import { EvolutionStar } from '../shared/EvolutionStar';

interface Props {
  hero: HeroDefinition;
  /** The heroes the arrows step through, wrapping at either end. Omitted, or without the hero opened, there are no arrows. */
  cycle?: readonly HeroDefinition[];
  onClose: () => void;
}

/** A horizontal drag this long across the showcase steps to the neighbouring hero. */
const SWIPE_PX = 44;
/** Less travel than this and the press on the showcase was a tap. */
const TAP_SLOP_PX = 10;
/** How long a tapped pose holds before the hero settles back to idle. */
const POSE_MS = 720;

type TabId = 'stats' | 'moves' | 'evolution';

const TIER_ORDER: readonly MoveTier[] = ['early', 'mid', 'late'];
const TIER_LABELS: Record<MoveTier, string> = { early: 'Early', mid: 'Mid', late: 'Late' };

/** An unauthored `tier` is Early, the same default isMoveTierOfferable applies. */
function tierOf(moveId: string): MoveTier {
  return moves[moveId]?.tier ?? 'early';
}

/** The levels a tier is OFFERED at — each band offers its own tier (progression.ts bandRank, MOVE_TIER_RANK_EXPIRY). */
function tierLevels(tier: MoveTier, schedule: LevelSchedule): string {
  if (tier === 'early') return `to ${schedule.midLevel - 1}`;
  if (tier === 'mid') return `${schedule.midLevel}–${schedule.lateLevel - 1}`;
  return `from ${schedule.lateLevel}`;
}


/**
 * A list of moves as full-width cards, each already carrying its mana, power and effect line.
 * Tapping one opens the full dossier; nothing has to be tapped to find out what a move does.
 */
function MoveList({
  moveIds,
  caster,
  onInspect,
}: {
  moveIds: readonly string[];
  caster: { wisdom: number; types: readonly TypeId[] };
  onInspect: (id: string) => void;
}) {
  return (
    <div className="tab-move-list">
      {moveIds.map((id) =>
        moves[id] ? (
          <MoveButtonReplica key={id} move={moves[id]} caster={caster} onClick={() => onInspect(id)} />
        ) : (
          <span key={id} className="detail-status-chip">
            {id}
          </span>
        )
      )}
    </div>
  );
}

function EvolutionPathCard({
  hero,
  path,
  caster,
  onInspect,
}: {
  hero: HeroDefinition;
  path: EvolutionPath;
  caster: { wisdom: number; types: readonly TypeId[] };
  onInspect: (id: string) => void;
}) {
  const granted = path.unlocksMoveIds ?? [];
  const grantedPassives = (path.grantsPassiveIds ?? []).filter((id) => passives[id]);
  const types = pathTypes(hero, path);
  // A graft path's own types, so its moves read with the STAB the path would actually give them.
  const pathCaster = path.typeGraft ? { wisdom: caster.wisdom, types } : caster;

  return (
    <div className="evo-path-card" style={{ '--plate-color': pathTint(hero, path).lead } as CSSProperties}>
      <div className="evo-path-head">
        <span className="evo-path-name">{path.name}</span>
        <EvolutionStar path={path} className="evo-path-star" />
      </div>
      {path.description && <div className="evo-path-desc">{path.description}</div>}

      {path.swapsOffense && (
        <div className="detail-modifier-list">
          <span className="detail-modifier-chip">
            <StatGlyph stat="attack" tone="inherit" /> Attack ⇄ <StatGlyph stat="intelligence" tone="inherit" /> Intelligence
          </span>
        </div>
      )}

      {path.typeGraft && (
        <>
          <div className="evo-path-label">Type graft — becomes</div>
          <div className="evo-path-types">
            {types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
          <TypeMatchups types={types} />
        </>
      )}

      {grantedPassives.length > 0 && (
        <>
          <div className="evo-path-label">Passive</div>
          <div className="tab-readout-list">
            {grantedPassives.map((id) => (
              <PassiveReadout key={id} passive={passives[id]} />
            ))}
          </div>
        </>
      )}

      {granted.length > 0 && (
        <>
          <div className="evo-path-label">Granted on choosing</div>
          <MoveList moveIds={granted} caster={pathCaster} onInspect={onInspect} />
        </>
      )}


    </div>
  );
}

function StepButton({ dir, onClick }: { dir: 'prev' | 'next'; onClick: () => void }) {
  return (
    <button type="button" className={`dossier-step is-${dir}`} aria-label={dir === 'prev' ? 'Previous hero' : 'Next hero'} data-sfx="none" onClick={onClick}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d={dir === 'prev' ? 'M10 3 5 8l5 5' : 'M6 3l5 5-5 5'} />
      </svg>
    </button>
  );
}

/**
 * The whole authored hero, in three pages: Stats, Moves, Evolution (2026-09-07, per user
 * direction). Read-only and run-independent — it reads `heroes`/`progressionTable` directly, never
 * a RosterEntry, so it shows the hero as designed rather than as levelled.
 */
export function HeroDossierOverlay({ hero: opened, cycle, onClose }: Props) {
  const [tab, setTab] = useState<TabId>('stats');
  const [popupMoveId, setPopupMoveId] = useState<string | null>(null);
  const [heroId, setHeroId] = useState(opened.id);
  const [showMastered, setShowMastered] = useState(false);
  const [openPools, setOpenPools] = useState<readonly string[]>([]);
  const [stepDir, setStepDir] = useState<'next' | 'prev' | null>(null);
  const swipeRef = useRef<{ pointerId: number; x: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const index = cycle ? cycle.findIndex((h) => h.id === heroId) : -1;
  const canCycle = !!cycle && cycle.length > 1 && index >= 0;
  const hero = canCycle ? cycle![index] : opened;

  function step(dir: 1 | -1) {
    if (!canCycle) return;
    playSfx('ui.pick');
    setHeroId(cycle![(index + dir + cycle!.length) % cycle!.length].id);
    setStepDir(dir > 0 ? 'next' : 'prev');
    setShowMastered(false);
    setOpenPools([]);
    setPopupMoveId(null);
    bodyRef.current?.scrollTo({ top: 0 });
  }

  useEffect(() => {
    if (!canCycle) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // A tap on the showcase plays the hero's poses in turn: attack, then hurt, then attack again.
  const [pose, setPose] = useState<{ kind: 'attack' | 'hurt'; beat: number } | null>(null);
  const nextPoseRef = useRef<'attack' | 'hurt'>('attack');
  const poseTimer = useRef<number | undefined>(undefined);

  function playPose() {
    const kind = nextPoseRef.current;
    nextPoseRef.current = kind === 'attack' ? 'hurt' : 'attack';
    playSfx(kind === 'attack' ? (`cast.${hero.types[0]}` as SfxId) : 'hit.physical');
    setStepDir(null);
    setPose((prev) => ({ kind, beat: (prev?.beat ?? 0) + 1 }));
    clearTimeout(poseTimer.current);
    poseTimer.current = window.setTimeout(() => setPose(null), POSE_MS);
  }

  useEffect(() => {
    clearTimeout(poseTimer.current);
    setPose(null);
    nextPoseRef.current = 'attack';
  }, [heroId]);

  useEffect(() => () => clearTimeout(poseTimer.current), []);

  function onSwipeDown(e: ReactPointerEvent<HTMLElement>) {
    swipeRef.current = { pointerId: e.pointerId, x: e.clientX };
  }

  function onSwipeUp(e: ReactPointerEvent<HTMLElement>) {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start || start.pointerId !== e.pointerId) return;
    // Screen px to canvas px: the design canvas is transform-scaled.
    const scale = e.currentTarget.getBoundingClientRect().width / (e.currentTarget.offsetWidth || 1) || 1;
    const dx = (e.clientX - start.x) / scale;
    if (Math.abs(dx) >= SWIPE_PX) {
      if (canCycle) step(dx < 0 ? 1 : -1);
    } else if (Math.abs(dx) < TAP_SLOP_PX) playPose();
  }

  const startingKit = hero.moveIds;
  // The starting kit is filtered out of the pool by masteryMovePool, so it is filtered out here too.
  const pool = (progressionTable.moveTiers[hero.id] ?? []).filter((id) => !startingKit.includes(id));
  const byTier = TIER_ORDER.map((tier) => ({ tier, moveIds: pool.filter((id) => tierOf(id) === tier) }));
  const nodes = progressionTable.evolutions[hero.id] ?? [];
  const evolutionPools = nodes
    .flatMap((node) => node.paths)
    .filter((path) => (path.learnableMoveIds ?? []).length > 0)
    .map((path) => ({
      path,
      moveIds: path.learnableMoveIds!,
      // A graft path's own types, so its moves read with the STAB the path would actually give them.
      pathCaster: path.typeGraft ? { wisdom: hero.baseStats.wisdom, types: pathTypes(hero, path) } : { wisdom: hero.baseStats.wisdom, types: hero.types },
    }));
  const innate = innatePassiveOf(hero);
  const mastered = masteredInnateOf(hero);
  const mark = innate ? null : titansMarkOf(hero);
  // Base stats, so every move card reads the hero as authored (a graft path's STAB is shown on its own card).
  const caster = { wisdom: hero.baseStats.wisdom, types: hero.types, stats: hero.baseStats };

  const tabs: TabSpec<TabId>[] = [
    { id: 'stats', label: 'Stats', glyph: 'stats' },
    { id: 'moves', label: 'Moves', glyph: 'moves', count: startingKit.length + pool.length + (hero.signatureMoveId ? 1 : 0) + evolutionPools.reduce((n, p) => n + p.moveIds.length, 0) },
    { id: 'evolution', label: 'Evolution', glyph: 'buffs' },
  ];

  // stopPropagation on every dismiss: this overlay is a DOM child of the Collection's own
  // backdrop, whose onClick closes the whole screen — closing the sheet must not close that too.
  function close(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    onClose();
  }

  return (
    <div className="detail-overlay is-sheet" onClick={close}>
      {/* Same sheet as the run's own hero preview (HeroPreviewOverlay), cut in the same colour:
          the Collection and the roster are two ways into one hero, and they should not be two
          designs. */}
      <div
        className="detail-panel is-tabbed is-hero-sheet"
        style={{ '--hero-color': getTypeColor(hero.types[0]) } as CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`detail-header is-hero dossier-head${canCycle ? ' can-cycle' : ''}`}>
          {canCycle && <StepButton dir="prev" onClick={() => step(-1)} />}
          {/* The Stats page seats the hero large, so the title bar drops its thumbnail there. */}
          {tab !== 'stats' && (
            <span className="detail-portrait-plate">
              <HeroPortrait heroId={hero.id} className="detail-portrait is-inline" />
            </span>
          )}
          <div className="detail-header-titles">
            <div className="detail-name">{hero.name}</div>
            <div className="combatant-types">
              {hero.types.map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
            {isTitanspawn(hero.id) && (
              <div className="detail-evolution-row">
                <span className="dossier-badge badge-recruit">Titanspawn</span>
                <span className="companion-mortal is-small">Mortal</span>
              </div>
            )}
          </div>
          {canCycle && <StepButton dir="next" onClick={() => step(1)} />}
        </div>

        <div ref={bodyRef} className={`detail-tab-body${tab === 'stats' ? ' is-showcase-page' : ''}`} role="tabpanel">
          {tab === 'stats' && (
            <>
              {/* The hero first and large: this page is the showcase, a swipe across it the next hero. */}
              <div
                key={`showcase-${hero.id}`}
                className={`dossier-showcase${stepDir ? ` is-from-${stepDir}` : ''}`}
                style={{ '--hero-color-2': getTypeColor(hero.types[1] ?? hero.types[0]) } as CSSProperties}
                onPointerDown={onSwipeDown}
                onPointerUp={onSwipeUp}
                onPointerCancel={() => (swipeRef.current = null)}
              >
                <span className="dossier-showcase-rays" aria-hidden="true" />
                <span className="dossier-showcase-sigil" aria-hidden="true">
                  <ElementGlyph type={hero.types[0]} />
                </span>
                <span className="dossier-showcase-pedestal" aria-hidden="true" />
                <span className="dossier-showcase-total">
                  <span>Stat Total</span>
                  {computeStatTotal(hero.baseStats)}
                </span>
                {pose && <span key={`flash-${pose.beat}`} className={`dossier-showcase-flash is-${pose.kind}`} aria-hidden="true" />}
                <HeroPortrait
                  key={pose ? `pose-${pose.beat}` : 'idle'}
                  heroId={hero.id}
                  pose={pose?.kind ?? 'idle'}
                  className={`dossier-showcase-portrait${pose ? ` is-${pose.kind}` : ''}`}
                />
              </div>

              {/* The innate is what the hero DOES before it has evolved (docs/innate-passives.md §6);
                  its mastered form is one tap away rather than a second card. */}
              {innate && (
                <PassiveReadout
                  passive={showMastered && mastered ? mastered : innate}
                  source={showMastered && mastered ? `Innate, mastered at Mastery ${MASTERY_INNATE}` : 'Innate'}
                  action={
                    mastered && (
                      <button
                        type="button"
                        className={`innate-plus-toggle${showMastered ? ' is-on' : ''}`}
                        aria-pressed={showMastered}
                        aria-label={showMastered ? `Show ${innate.name}` : `Show ${mastered.name}`}
                        onClick={() => setShowMastered((on) => !on)}
                      >
                        +
                      </button>
                    )
                  }
                />
              )}
              {mark && <PassiveReadout passive={mark} source="Titan's Mark" />}

              <StatColumns baseStats={hero.baseStats} grades={gradesFor(hero)} />
              <TypeMatchups types={hero.types} />
            </>
          )}

          {tab === 'moves' && (
            <>
              <div className="tab-subhead">Starting kit</div>
              <MoveList moveIds={startingKit} caster={caster} onInspect={setPopupMoveId} />
              <div className="tab-subhead">Level-up pool</div>
              {byTier.map(({ tier, moveIds }) =>
                moveIds.length > 0 ? (
                  <div key={tier}>
                    <div className="evo-path-label">
                      {TIER_LABELS[tier]} — Lv {tierLevels(tier, scheduleFor(hero))}
                    </div>
                    <MoveList moveIds={moveIds} caster={caster} onInspect={setPopupMoveId} />
                  </div>
                ) : null
              )}
              {hero.signatureMoveId && (
                <>
                  {/* The one move no pool ever offers: the line a player reads before drafting. */}
                  <div className="tab-subhead">Signature — Lv {signatureLevelFor(hero) ?? '—'}</div>
                  <MoveList moveIds={[hero.signatureMoveId]} caster={caster} onInspect={setPopupMoveId} />
                </>
              )}
              {/* What each Evolution adds to the level-up pool, read here with the moves rather than on the path card. */}
              {evolutionPools.length > 0 && <div className="tab-subhead">Evolution pool</div>}
              {evolutionPools.map(({ path, moveIds, pathCaster }) => (
                <div key={path.id} className={`evo-pool${openPools.includes(path.id) ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="evo-pool-head"
                    aria-expanded={openPools.includes(path.id)}
                    onClick={() => setOpenPools((open) => (open.includes(path.id) ? open.filter((id) => id !== path.id) : [...open, path.id]))}
                  >
                    <span className="evo-pool-name">{path.name}</span>
                    <span className="evo-pool-count">{moveIds.length}</span>
                    <svg className="evo-pool-chevron" viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M4 6l4 4 4-4" />
                    </svg>
                  </button>
                  {openPools.includes(path.id) && <MoveList moveIds={moveIds} caster={pathCaster} onInspect={setPopupMoveId} />}
                </div>
              ))}
            </>
          )}

          {tab === 'evolution' &&
            nodes.map((node, i) => (
              <div key={i}>
                <div className="tab-subhead">Mastery {MASTERY_EVOLUTION}</div>
                {node.paths.map((path) => (
                  <EvolutionPathCard key={path.id} hero={hero} path={path} caster={caster} onInspect={setPopupMoveId} />
                ))}
              </div>
            ))}
        </div>

        <TabStrip tabs={tabs} active={tab} onSelect={setTab} />
      </div>

      <div className="sheet-footer" onClick={(e) => e.stopPropagation()}>
        <button className="resolve-button sheet-close-button" onClick={close}>
          Close
        </button>
      </div>

      {popupMoveId && moves[popupMoveId] && (
        <div
          className="log-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setPopupMoveId(null);
          }}
        >
          <div className="log-panel move-popup-panel">
            <MoveDetailCard move={moves[popupMoveId]} caster={caster} />
            <div className="move-popup-hint">Tap anywhere to close</div>
          </div>
        </div>
      )}
    </div>
  );
}
