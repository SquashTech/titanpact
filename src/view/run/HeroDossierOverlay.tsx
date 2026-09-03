import { useState, type CSSProperties } from 'react';
import { moves } from '../../data/moves';
import { passives } from '../../data/passives';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition, MoveTier, StatKey, TypeId } from '../../engine/content';
import type { EvolutionPath } from '../../run/progression';
import { MASTERY_LEVEL, MASTERY_STAT_AMOUNT, MOVE_TIER_LEVEL } from '../../run/progression';
import { MoveDetailCard } from '../combat/MoveDetailOverlay';
import { HeroPortrait } from '../shared/HeroPortrait';
import { MoveTile } from '../shared/MoveTile';
import { PassiveInfoPanel, PassiveGlyph, passiveColor, passiveTint } from '../shared/passiveIcons';
import { SectionGlyph } from '../shared/sectionIcons';
import { StatBars, StatGlyph, STAT_LABELS } from '../shared/StatBars';
import { TypeBadge } from '../shared/TypeBadge';
import { TypeMatchups } from '../shared/TypeMatchups';

interface Props {
  hero: HeroDefinition;
  onClose: () => void;
}

const TIER_ORDER: readonly MoveTier[] = ['early', 'mid', 'late'];
const TIER_LABELS: Record<MoveTier, string> = { early: 'Early', mid: 'Mid', late: 'Late' };

/** An unauthored `tier` is Early, the same default isMoveTierUnlocked applies. */
function tierOf(moveId: string): MoveTier {
  return moves[moveId]?.tier ?? 'early';
}

function fmtGrant(amount: number): string {
  return amount > 0 ? `+${amount}` : `${amount}`;
}

/** The types a hero ends up with down a given path — a graft replaces the secondary, never the innate primary. */
function pathTypes(hero: HeroDefinition, path: EvolutionPath): TypeId[] {
  return path.typeGraft ? [hero.types[0], path.typeGraft] : [...hero.types];
}

type Popup = { kind: 'move' | 'passive'; id: string };

/** Tap-to-inspect row; `MoveTile`'s onClick, not its long-press — this is a reference screen, not a loadout. */
function MoveRow({ moveIds, onInspect }: { moveIds: readonly string[]; onInspect: (id: string) => void }) {
  return (
    <div className="move-tile-row dossier-move-row">
      {moveIds.map((id) =>
        moves[id] ? (
          <MoveTile key={id} move={moves[id]} onClick={() => onInspect(id)} />
        ) : (
          <span key={id} className="detail-status-chip">
            {id}
          </span>
        )
      )}
    </div>
  );
}

function StatGrantChips({ grants }: { grants: Partial<Record<StatKey, number>> }) {
  const entries = Object.entries(grants).filter(([, amount]) => amount) as [StatKey, number][];
  if (entries.length === 0) return null;
  return (
    <div className="detail-modifier-list">
      {entries.map(([stat, amount]) => (
        <span key={stat} className={`detail-modifier-chip ${amount > 0 ? 'stat-buff' : 'stat-debuff'}`}>
          <StatGlyph stat={stat} tone="inherit" /> {STAT_LABELS[stat]} {fmtGrant(amount)}
        </span>
      ))}
    </div>
  );
}

function EvolutionPathCard({
  hero,
  path,
  onInspect,
}: {
  hero: HeroDefinition;
  path: EvolutionPath;
  onInspect: (popup: Popup) => void;
}) {
  const granted = path.unlocksMoveIds ?? [];
  const learnable = path.learnableMoveIds ?? [];
  const grantedPassives = (path.grantsPassiveIds ?? []).filter((id) => passives[id]);
  const types = pathTypes(hero, path);

  return (
    <div className={`evo-path-card evo-${path.kind}`}>
      <div className="evo-path-head">
        <span className={`evolution-badge evolution-${path.kind}`}>{path.kind}</span>
        <span className="evo-path-name">{path.name}</span>
      </div>
      {path.description && <div className="evo-path-desc">{path.description}</div>}

      <StatGrantChips grants={path.statGrants} />

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
          <div className="detail-modifier-list">
            {grantedPassives.map((id) => (
              <button
                key={id}
                type="button"
                className="evo-passive-chip"
                style={{ '--passive-color': passiveColor(id), '--passive-tint': passiveTint(id, 0.14) } as CSSProperties}
                onClick={() => onInspect({ kind: 'passive', id })}
              >
                <PassiveGlyph passiveId={id} />
                {passives[id].name}
              </button>
            ))}
          </div>
        </>
      )}

      {granted.length > 0 && (
        <>
          <div className="evo-path-label">Granted on choosing</div>
          <MoveRow moveIds={granted} onInspect={(id) => onInspect({ kind: 'move', id })} />
        </>
      )}

      {learnable.length > 0 && (
        <>
          <div className="evo-path-label">Joins the level-up pool</div>
          <MoveRow moveIds={learnable} onInspect={(id) => onInspect({ kind: 'move', id })} />
        </>
      )}

      {granted.length === 0 && learnable.length === 0 && grantedPassives.length === 0 && !path.typeGraft && (
        <div className="evo-path-label">Stats only.</div>
      )}
    </div>
  );
}

/**
 * The whole authored hero: base stats, the starting kit, every move the level-up pool can
 * ever offer, and all three Evolution paths with what each one unlocks. Read-only and
 * run-independent — it reads `heroes`/`progressionTable` directly, never a RosterEntry, so
 * it shows the hero as designed rather than as levelled.
 */
export function HeroDossierOverlay({ hero, onClose }: Props) {
  const [popup, setPopup] = useState<Popup | null>(null);

  const startingKit = hero.moveIds;
  // The starting kit is filtered out of the pool by levelUpMovePool, so it is filtered out here too.
  const pool = (progressionTable.moveTiers[hero.id] ?? []).filter((id) => !startingKit.includes(id));
  const byTier = TIER_ORDER.map((tier) => ({ tier, moveIds: pool.filter((id) => tierOf(id) === tier) }));
  const nodes = progressionTable.evolutions[hero.id] ?? [];
  const graftedMoveCount = nodes
    .flatMap((node) => node.paths)
    .flatMap((path) => [...(path.unlocksMoveIds ?? []), ...(path.learnableMoveIds ?? [])]).length;
  // Base stats, so every move card reads the hero as authored (a graft path's STAB is shown on its own card).
  const caster = { wisdom: hero.baseStats.wisdom, types: hero.types };

  // stopPropagation on every dismiss: this overlay is a DOM child of the Compendium's own
  // backdrop, whose onClick closes the whole screen — closing the sheet must not close that too.
  function close(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    onClose();
  }

  return (
    <div className="detail-overlay" onClick={close}>
      <button className="detail-close-button" onClick={close} aria-label="Close">
        ✕
      </button>
      <div className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <HeroPortrait heroId={hero.id} className="detail-portrait" />
        <div className="detail-header">
          <div className="detail-name">{hero.name}</div>
          <span className={`dossier-badge ${hero.starter ? 'badge-ally' : 'badge-recruit'}`}>
            {hero.starter ? 'Starter' : 'Recruit only'}
          </span>
          <div className="detail-evolution-row">
            {hero.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
        </div>

        <div className="detail-section-title">
          <SectionGlyph name="matchups" /> Matchups
        </div>
        <TypeMatchups types={hero.types} />

        <div className="detail-section-title">
          <SectionGlyph name="stats" /> Base stats
        </div>
        <StatBars baseStats={hero.baseStats} />

        <div className="detail-section-title">
          <SectionGlyph name="moves" /> Starting kit
        </div>
        <MoveRow moveIds={startingKit} onInspect={(id) => setPopup({ kind: 'move', id })} />

        <div className="detail-section-title">
          <SectionGlyph name="moves" /> Level-up pool
        </div>
        {pool.length > 0 ? (
          byTier.map(({ tier, moveIds }) =>
            moveIds.length > 0 ? (
              <div key={tier}>
                <div className="evo-path-label">
                  {TIER_LABELS[tier]} — Lv {MOVE_TIER_LEVEL[tier]}+
                </div>
                <MoveRow moveIds={moveIds} onInspect={(id) => setPopup({ kind: 'move', id })} />
              </div>
            ) : null
          )
        ) : (
          <div className="detail-empty">No pool moves.</div>
        )}
        <div className="dossier-note">
          {pool.length} in the pool
          {graftedMoveCount > 0 && `, plus ${graftedMoveCount} behind Evolution paths`}. A level-up offers a random
          draw from whichever tiers are unlocked; past Lv {MASTERY_LEVEL} it instead grants +{MASTERY_STAT_AMOUNT} to one
          of three drawn combat stats.
        </div>

        <div className="detail-section-title">
          <SectionGlyph name="buffs" /> Evolution
        </div>
        {nodes.length > 0 ? (
          nodes.map((node) => (
            <div key={node.level}>
              <div className="evo-path-label">Level {node.level} — pick one, permanent for the run</div>
              {node.paths.map((path) => (
                <EvolutionPathCard key={path.id} hero={hero} path={path} onInspect={setPopup} />
              ))}
            </div>
          ))
        ) : (
          <div className="detail-empty">No Evolution authored.</div>
        )}

        <div className="detail-close-hint">Tap a move or passive to inspect it</div>
      </div>

      {popup && (
        <div className="log-overlay" onClick={(e) => { e.stopPropagation(); setPopup(null); }}>
          <div className="log-panel move-popup-panel">
            {popup.kind === 'move' ? (
              moves[popup.id] ? <MoveDetailCard move={moves[popup.id]} caster={caster} /> : null
            ) : (
              <PassiveInfoPanel passive={passives[popup.id] ?? null} />
            )}
            <div className="move-popup-hint">Tap anywhere to close</div>
          </div>
        </div>
      )}
    </div>
  );
}
