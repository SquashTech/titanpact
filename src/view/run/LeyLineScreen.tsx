import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import { moves } from '../../data/moves';
import type { HeroDefinition } from '../../engine/content';
import { levelOf } from '../../run/growth';
import { grantLeyLine, LEY_LINE_FORCE, leyLineStatusId } from '../../run/runProgress';
import type { RosterEntry, RunState } from '../../run/state';
import { statScaleFor } from '../../run/statScale';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { HeroPortrait } from '../shared/HeroPortrait';
import { formIdFor } from '../../run/progression';
import { NodeMotes } from '../shared/NodeStage';
import { NodeGlyph } from '../shared/nodeIcons';
import { StatusGlyph } from '../shared/statusIcons';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterPeek } from './RosterPeek';
import stoneArt from '../../../art/map-nodes/awake/leyLineReward.png';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

/** The woken stone's light (mapNodeArt AWAKE_RGB leyLineReward). */
const LEY_RGB = '120, 230, 255';

/** How many of the hero's moves hit at its own element — what the Force is added to. */
function movesAtElement(entry: RosterEntry, element: string): number {
  return entry.unlockedMoveIds.filter((id) => moves[id]?.type === element).length;
}

/**
 * The Ley Line (docs/run-loop.md "The Forge and the Ley Line", 2026-09-17, per user direction):
 * one hero draws LEY_LINE_FORCE of Elemental Force at its own element, for the run — the
 * Enchanter's binding, free, and on the hero rather than a piece. Staged as a rite at the woken
 * stone: what it gives on one card, and every hero's card saying the Force it would hold at its
 * element and how many of its moves that Force is added to — a second Ley Line and an enchant of
 * the same type all sum onto one figure, and a hero with none of its element's moves gains nothing.
 */
export function LeyLineScreen({ run, onRunChange, onContinue }: Props) {
  const [grantedTo, setGrantedTo] = useState<string | null>(null);
  const [before, setBefore] = useState(0);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  useEffect(() => {
    playSfx('enchant.bind', { pitch: 0.8, delay: 0.1 });
  }, []);

  function handleGrant(entry: RosterEntry) {
    playSfx('enchant.bind');
    setBefore(entry.bonusStatusGrants[leyLineStatusId(rosterHeroes[entry.heroId])] ?? 0);
    onRunChange(grantLeyLine(run, entry.rosterId, rosterHeroes));
    setGrantedTo(entry.rosterId);
  }

  const grantedEntry = grantedTo ? run.roster.find((r) => r.rosterId === grantedTo) ?? null : null;

  if (grantedEntry) {
    const hero = rosterHeroes[grantedEntry.heroId];
    const element = hero.types[0];
    const statusId = leyLineStatusId(hero);
    const count = movesAtElement(grantedEntry, element);
    return (
      <div className="node-screen rite-screen is-ley ley-line-screen" style={{ '--rite-color': getTypeColor(element) } as CSSProperties}>
        <span className="node-sky ley-ground" aria-hidden="true" />
        <NodeMotes count={14} />
        <div className="screen-scroll">
          <div className="rite-reveal">
            <span className="rite-reveal-flash" aria-hidden="true" />
            <span className="rite-hero">
              <span className="rite-pool" aria-hidden="true" />
              <HeroPortrait heroId={hero.id} pathId={formIdFor(grantedEntry)} className="rite-portrait" />
              <span className="rite-mark is-reveal" aria-hidden="true">
                <StatusGlyph statusId={statusId} />
              </span>
            </span>
            <span className="rite-eyebrow">The Line Answers</span>
            <h2 className="rite-name">{hero.name}</h2>
            <span className="rite-reveal-name">{element} Force</span>
            <div className="rite-reveal-verb well-ledger">
              <span className="well-ledger-row">
                <StatusGlyph statusId={statusId} className="well-ledger-glyph" />
                <span className="well-ledger-label">{element} Force</span>
                <span className="well-ledger-figure">
                  {before} <span className="well-ledger-arrow">→</span> <strong>{before + LEY_LINE_FORCE}</strong>
                </span>
              </span>
              <span className="well-ledger-row">
                <span className="well-ledger-label">Added to every hit of</span>
                <span className="well-ledger-figure">
                  <strong>{count}</strong> {element} {count === 1 ? 'move' : 'moves'}
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

  return (
    <div className="node-screen rite-screen is-ley ley-line-screen" style={{ '--rite-color': `rgb(${LEY_RGB})` } as CSSProperties}>
      <span className="node-sky ley-ground" aria-hidden="true" />
      <NodeMotes count={14} />
      <RosterPeek run={run} />

      <header className="rite-head">
        <span className="rite-place">
          <span className="rite-pool" aria-hidden="true" />
          <img src={stoneArt} className="rite-place-art" alt="" draggable={false} />
        </span>
        <span className="rite-eyebrow">Power Under the Ground</span>
        <h2 className="rite-name">The Ley Line</h2>
      </header>

      <div className="verb-card is-static is-picked ley-gift">
        <span className="verb-card-socket" aria-hidden="true">
          <NodeGlyph type="leyLineReward" className="verb-card-glyph" />
        </span>
        <span className="verb-card-body">
          <span className="verb-card-head">
            <span className="verb-card-name">Draw the Line</span>
            <span className="verb-card-kind">One hero</span>
          </span>
          <span className="verb-card-verb">
            <span className="verb-card-verb-name">+{LEY_LINE_FORCE} Force at the hero's own element</span>
          </span>
          <span className="verb-card-desc">Added to every hit of that type, each target, for the rest of the run.</span>
        </span>
      </div>

      <HeroPickGrid count={run.roster.length} fill columns={run.roster.length > 4 ? 3 : 2}>
        {run.roster.map((entry) => {
          const hero = rosterHeroes[entry.heroId];
          const type = hero.types[0];
          const statusId = leyLineStatusId(hero);
          const held = entry.bonusStatusGrants[statusId] ?? 0;
          const count = movesAtElement(entry, type);
          return (
            <HeroPickCard
              key={entry.rosterId}
              hero={hero}
              entry={entry}
              onActivate={() => handleGrant(entry)}
              onPreview={() => setPreviewEntry({ hero, entry })}
              ariaLabel={`${hero.name}, level ${levelOf(entry)} — ${held} ${type} Force from the land, ${count} ${type} moves, draw ${LEY_LINE_FORCE} more`}
              detail={
                <span className={`ley-fit${count === 0 ? ' is-dead' : ''}`}>
                  {count === 0 ? `no ${type} moves` : `${count} ${type} move${count === 1 ? '' : 's'}`}
                </span>
              }
              ctaClassName="is-accent"
              cta={
                <span className="ley-line-cta" style={{ '--force-rgb': getTypeColorRgb(type) } as CSSProperties}>
                  <StatusGlyph statusId={statusId} className="ley-line-cta-glyph" />
                  {held} → {held + LEY_LINE_FORCE}
                </span>
              }
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
