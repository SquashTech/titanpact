import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import { levelOf } from '../../run/growth';
import { MANA_WELL_AMOUNT, MANA_WELL_REGEN, grantManaWell } from '../../run/runProgress';
import type { RosterEntry, RunState } from '../../run/state';
import { statScaleFor } from '../../run/statScale';
import { entryStatTotals } from '../shared/entryStatTotals';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { HeroPortrait } from '../shared/HeroPortrait';
import { formIdFor } from '../../run/progression';
import { NodeMotes, NODE_TINT_MANA } from '../shared/NodeStage';
import { STAT_COLORS, StatGlyph } from '../shared/statIcons';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterPeek } from './RosterPeek';
import wellArt from '../../../art/map-nodes/icons/manaWellReward.png';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

/** A hero's pool as a bar, with the stretch the Well would add drawn on past it. `scale` is the roster's deepest pool after a draw. */
function WellPoolBar({ pool, scale }: { pool: number; scale: number }) {
  return (
    <span className="well-pool" aria-hidden="true">
      <span className="well-pool-fill" style={{ width: `${(pool / scale) * 100}%` }} />
      <span className="well-pool-gain" style={{ width: `${(MANA_WELL_AMOUNT / scale) * 100}%` }} />
    </span>
  );
}

/**
 * The Mana Well (docs/run-loop.md "The Mana Well", 2026-09-13, per user direction): one hero's
 * max Mana rises by MANA_WELL_AMOUNT and its MP Regen by MANA_WELL_REGEN for the rest of the run. The
 * one bare-number screen the constitution allows, because a pool is the stat that gates a whole
 * tier of moves, where +10 Attack was never something a player could see. Staged as a rite at the
 * woken well: what it gives on one card, every hero's pool drawn as a bar with the stretch the
 * Well would add, and the hero it chose standing in its light with the numbers before and after.
 */
export function ManaWellScreen({ run, onRunChange, onContinue }: Props) {
  const [grantedTo, setGrantedTo] = useState<string | null>(null);
  const [before, setBefore] = useState<{ pool: number; regen: number } | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  useEffect(() => {
    playSfx('shrine', { pitch: 0.9, delay: 0.12 });
  }, []);

  function handleGrant(entry: RosterEntry) {
    const totals = entryStatTotals(rosterHeroes[entry.heroId], entry, run.relics);
    playSfx('class.learn');
    setBefore({ pool: totals.manaPool, regen: totals.mpRegen });
    onRunChange(grantManaWell(run, entry.rosterId));
    setGrantedTo(entry.rosterId);
  }

  const style = { '--node-rgb': NODE_TINT_MANA, '--rite-color': STAT_COLORS.manaPool } as CSSProperties;
  const grantedEntry = grantedTo ? run.roster.find((r) => r.rosterId === grantedTo) ?? null : null;

  if (grantedEntry && before) {
    const hero = rosterHeroes[grantedEntry.heroId];
    return (
      <div className="node-screen rite-screen is-well mana-well-screen" style={style}>
        <span className="node-sky well-ground" aria-hidden="true" />
        <NodeMotes count={14} />
        <div className="screen-scroll">
          <div className="rite-reveal">
            <span className="rite-reveal-flash" aria-hidden="true" />
            <span className="rite-hero">
              <span className="rite-pool" aria-hidden="true" />
              <HeroPortrait heroId={hero.id} pathId={formIdFor(grantedEntry)} className="rite-portrait" />
              <span className="rite-mark is-reveal" aria-hidden="true">
                <StatGlyph stat="manaPool" />
              </span>
            </span>
            <span className="rite-eyebrow">Drawn Deeper</span>
            <h2 className="rite-name">{hero.name}</h2>
            <span className="rite-reveal-name">The Mana Well</span>
            <div className="rite-reveal-verb well-ledger">
              <span className="well-ledger-row">
                <StatGlyph stat="manaPool" className="well-ledger-glyph" />
                <span className="well-ledger-label">Max Mana</span>
                <span className="well-ledger-figure">
                  {before.pool} <span className="well-ledger-arrow">→</span> <strong>{before.pool + MANA_WELL_AMOUNT}</strong>
                </span>
              </span>
              <span className="well-ledger-row">
                <StatGlyph stat="mpRegen" className="well-ledger-glyph" />
                <span className="well-ledger-label">MP Regen</span>
                <span className="well-ledger-figure">
                  {before.regen} <span className="well-ledger-arrow">→</span> <strong>{before.regen + MANA_WELL_REGEN}</strong>
                </span>
              </span>
            </div>
          </div>
        </div>
        <button className="resolve-button" onClick={onContinue}>
          Continue
        </button>
      </div>
    );
  }

  const pools = run.roster.map((entry) => entryStatTotals(rosterHeroes[entry.heroId], entry, run.relics).manaPool);
  const scale = Math.max(...pools, 1) + MANA_WELL_AMOUNT;

  return (
    <div className="node-screen rite-screen is-well mana-well-screen" style={style}>
      <span className="node-sky well-ground" aria-hidden="true" />
      <NodeMotes count={14} />
      <RosterPeek run={run} />

      <header className="rite-head">
        <span className="rite-place">
          <span className="rite-pool" aria-hidden="true" />
          <img src={wellArt} className="rite-place-art is-icon" alt="" draggable={false} />
        </span>
        <span className="rite-eyebrow">Cold Water, Far Down</span>
        <h2 className="rite-name">The Mana Well</h2>
      </header>

      {/* What it gives, once, on the card the other rites use for their verbs. */}
      <div className="verb-card is-static is-picked well-gift">
        <span className="verb-card-socket" aria-hidden="true">
          <StatGlyph stat="manaPool" className="verb-card-glyph" />
        </span>
        <span className="verb-card-body">
          <span className="verb-card-head">
            <span className="verb-card-name">Draw Deep</span>
            <span className="verb-card-kind">One hero</span>
          </span>
          <span className="verb-card-verb">
            <span className="verb-card-verb-name" style={{ color: STAT_COLORS.manaPool }}>
              <StatGlyph stat="manaPool" />+{MANA_WELL_AMOUNT} max Mana
            </span>
            <span className="verb-card-verb-name" style={{ color: STAT_COLORS.mpRegen }}>
              <StatGlyph stat="mpRegen" />+{MANA_WELL_REGEN} MP Regen
            </span>
          </span>
          <span className="verb-card-desc">For the rest of the run.</span>
        </span>
      </div>

      <HeroPickGrid count={run.roster.length} fill columns={run.roster.length > 4 ? 3 : 2}>
        {run.roster.map((entry, i) => {
          const hero = rosterHeroes[entry.heroId];
          const pool = pools[i];
          return (
            <HeroPickCard
              key={entry.rosterId}
              hero={hero}
              entry={entry}
              onActivate={() => handleGrant(entry)}
              onPreview={() => setPreviewEntry({ hero, entry })}
              ariaLabel={`${hero.name}, level ${levelOf(entry)} — ${pool} max Mana, grant ${MANA_WELL_AMOUNT} more and ${MANA_WELL_REGEN} MP Regen`}
              detail={<WellPoolBar pool={pool} scale={scale} />}
              ctaClassName="is-accent"
              cta={`${pool} → ${pool + MANA_WELL_AMOUNT} MP`}
            />
          );
        })}
      </HeroPickGrid>

      {previewEntry && (
        <HeroPreviewOverlay
          hero={previewEntry.hero}
          entry={previewEntry.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          gold={run.gold}
          scale={statScaleFor(run)}
          onClose={() => setPreviewEntry(null)}
        />
      )}
    </div>
  );
}
