import { useState } from 'react';
import { moves } from '../../data/moves';
import { passives } from '../../data/passives';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition, MoveTier, StatKey, TypeId } from '../../engine/content';
import type { EvolutionPath } from '../../run/progression';
import { MOVE_TIER_LEVEL, MOVE_TIER_EXPIRY } from '../../run/progression';
import { MoveDetailCard } from '../combat/MoveDetailOverlay';
import { HeroPortrait } from '../shared/HeroPortrait';
import { MoveButtonReplica } from '../shared/MoveTile';
import { PassiveReadout } from '../shared/passiveIcons';
import { StatBars, StatGlyph, STAT_LABELS } from '../shared/StatBars';
import { TabStrip, type TabSpec } from '../shared/TabStrip';
import { TypeBadge } from '../shared/TypeBadge';
import { TypeMatchups } from '../shared/TypeMatchups';

interface Props {
  hero: HeroDefinition;
  onClose: () => void;
}

type TabId = 'stats' | 'moves' | 'evolution';

const TIER_ORDER: readonly MoveTier[] = ['early', 'mid', 'late'];
const TIER_LABELS: Record<MoveTier, string> = { early: 'Early', mid: 'Mid', late: 'Late' };

/** An unauthored `tier` is Early, the same default isMoveTierOfferable applies. */
function tierOf(moveId: string): MoveTier {
  return moves[moveId]?.tier ?? 'early';
}

/** The levels a tier can actually be OFFERED at — a closed range for Early, which expires when Mid opens. */
function tierLevels(tier: MoveTier): string {
  const expiry = MOVE_TIER_EXPIRY[tier];
  return expiry === Infinity ? `${MOVE_TIER_LEVEL[tier]}+` : `${MOVE_TIER_LEVEL[tier]}–${expiry - 1}`;
}

function fmtGrant(amount: number): string {
  return amount > 0 ? `+${amount}` : `${amount}`;
}

/** The types a hero ends up with down a given path — a graft replaces the secondary, never the innate primary. */
function pathTypes(hero: HeroDefinition, path: EvolutionPath): TypeId[] {
  return path.typeGraft ? [hero.types[0], path.typeGraft] : [...hero.types];
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
  caster,
  onInspect,
}: {
  hero: HeroDefinition;
  path: EvolutionPath;
  caster: { wisdom: number; types: readonly TypeId[] };
  onInspect: (id: string) => void;
}) {
  const granted = path.unlocksMoveIds ?? [];
  const learnable = path.learnableMoveIds ?? [];
  const grantedPassives = (path.grantsPassiveIds ?? []).filter((id) => passives[id]);
  const types = pathTypes(hero, path);
  // A graft path's own types, so its moves read with the STAB the path would actually give them.
  const pathCaster = path.typeGraft ? { wisdom: caster.wisdom, types } : caster;

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

      {learnable.length > 0 && (
        <>
          <div className="evo-path-label">Joins the level-up pool</div>
          <MoveList moveIds={learnable} caster={pathCaster} onInspect={onInspect} />
        </>
      )}

      {granted.length === 0 && learnable.length === 0 && grantedPassives.length === 0 && !path.typeGraft && (
        <div className="evo-path-label">Stats only.</div>
      )}
    </div>
  );
}

/**
 * The whole authored hero, in three pages: Stats, Moves, Evolution (2026-09-07, per user
 * direction). Read-only and run-independent — it reads `heroes`/`progressionTable` directly, never
 * a RosterEntry, so it shows the hero as designed rather than as levelled.
 */
export function HeroDossierOverlay({ hero, onClose }: Props) {
  const [tab, setTab] = useState<TabId>('stats');
  const [popupMoveId, setPopupMoveId] = useState<string | null>(null);

  const startingKit = hero.moveIds;
  // The starting kit is filtered out of the pool by levelUpMovePool, so it is filtered out here too.
  const pool = (progressionTable.moveTiers[hero.id] ?? []).filter((id) => !startingKit.includes(id));
  const byTier = TIER_ORDER.map((tier) => ({ tier, moveIds: pool.filter((id) => tierOf(id) === tier) }));
  const nodes = progressionTable.evolutions[hero.id] ?? [];
  // Base stats, so every move card reads the hero as authored (a graft path's STAB is shown on its own card).
  const caster = { wisdom: hero.baseStats.wisdom, types: hero.types };

  const tabs: TabSpec<TabId>[] = [
    { id: 'stats', label: 'Stats', glyph: 'stats' },
    { id: 'moves', label: 'Moves', glyph: 'moves', count: startingKit.length + pool.length },
    { id: 'evolution', label: 'Evolution', glyph: 'buffs' },
  ];

  // stopPropagation on every dismiss: this overlay is a DOM child of the Compendium's own
  // backdrop, whose onClick closes the whole screen — closing the sheet must not close that too.
  function close(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    onClose();
  }

  return (
    <div className="detail-overlay is-sheet" onClick={close}>
      <div className="detail-panel is-tabbed" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header is-hero">
          <HeroPortrait heroId={hero.id} className="detail-portrait is-inline" />
          <div className="detail-header-titles">
            <div className="detail-name">{hero.name}</div>
            <div className="combatant-types">
              {hero.types.map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
            <div className="detail-evolution-row">
              <span className={`dossier-badge ${hero.starter ? 'badge-ally' : 'badge-recruit'}`}>
                {hero.starter ? 'Starter' : 'Recruit only'}
              </span>
            </div>
          </div>
        </div>

        <div className="detail-tab-body" role="tabpanel">
          {tab === 'stats' && (
            <>
              {/* Matchups lead the page — see HeroPreviewOverlay. */}
              <TypeMatchups types={hero.types} />
              <StatBars baseStats={hero.baseStats} />
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
                      {TIER_LABELS[tier]} — Lv {tierLevels(tier)}
                    </div>
                    <MoveList moveIds={moveIds} caster={caster} onInspect={setPopupMoveId} />
                  </div>
                ) : null
              )}
            </>
          )}

          {tab === 'evolution' &&
            nodes.map((node) => (
              <div key={node.level}>
                <div className="tab-subhead">Level {node.level}</div>
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
