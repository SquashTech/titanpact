import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import { levelOf } from '../../run/growth';
import { grantLeyLine, LEY_LINE_FORCE, leyLineStatusId } from '../../run/runProgress';
import type { RosterEntry, RunState } from '../../run/state';
import { statScaleFor } from '../../run/statScale';
import { getTypeColorRgb } from '../combat/typeColors';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { NodeGlyph } from '../shared/nodeIcons';
import { NodeHeader, NodeSky } from '../shared/NodeStage';
import { StatusGlyph } from '../shared/statusIcons';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterPeek } from './RosterPeek';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

/** Ember red — the Force chip's family colour (mapNodes NODE_COLORS leyLineReward). */
const NODE_TINT_EMBER = '232, 100, 60';

/**
 * The Ley Line (docs/run-loop.md "The Forge and the Ley Line", 2026-09-17, per user direction):
 * one hero draws LEY_LINE_FORCE of Elemental Force at its own element, for the run — the
 * Enchanter's binding, free, and on the hero rather than a piece. Every card says the Force the
 * hero would hold at its element after the tap, since a second Ley Line and an enchant of the
 * same type all sum onto one figure, and that figure is what every hit of the type adds.
 */
export function LeyLineScreen({ run, onRunChange, onContinue }: Props) {
  const [grantedTo, setGrantedTo] = useState<string | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  useEffect(() => {
    playSfx('enchant.bind', { pitch: 0.8, delay: 0.1 });
  }, []);

  function handleGrant(rosterId: string) {
    playSfx('enchant.bind');
    onRunChange(grantLeyLine(run, rosterId, rosterHeroes));
    setGrantedTo(rosterId);
  }

  const grantedHero = grantedTo ? rosterHeroes[run.roster.find((r) => r.rosterId === grantedTo)!.heroId] : null;

  return (
    <div className="node-screen shrine-screen ley-line-screen" style={{ '--node-rgb': NODE_TINT_EMBER } as CSSProperties}>
      <NodeSky />

      <span className="shrine-descent" aria-hidden="true" />

      <RosterPeek run={run} />

      <NodeHeader
        eyebrow="Power Under the Ground"
        title="Ley Line"
        glyph={<NodeGlyph type="leyLineReward" />}
        readoutKey={grantedTo ?? 'idle'}
        readoutLive={!!grantedHero}
        readout={
          grantedHero
            ? `${grantedHero.name} draws on the line now — +${LEY_LINE_FORCE} ${grantedHero.types[0]} Force on every ${grantedHero.types[0]} hit, for the rest of the run.`
            : `Choose a hero to draw +${LEY_LINE_FORCE} Force at its own element — added to every hit of that type, each target, each strike. Hold to review a sheet.`
        }
      />

      <HeroPickGrid count={run.roster.length} fill>
        {run.roster.map((entry) => {
          const hero = rosterHeroes[entry.heroId];
          const type = hero.types[0];
          const statusId = leyLineStatusId(hero);
          const held = entry.bonusStatusGrants[statusId] ?? 0;
          const isGranted = grantedTo === entry.rosterId;
          return (
            <HeroPickCard
              key={entry.rosterId}
              hero={hero}
              entry={entry}
              className={isGranted ? 'is-blessed' : ''}
              disabled={!!grantedTo && !isGranted}
              onActivate={() => !grantedTo && handleGrant(entry.rosterId)}
              onPreview={() => setPreviewEntry({ hero, entry })}
              ariaLabel={`${hero.name}, level ${levelOf(entry)} — ${held} ${type} Force from the land, draw ${LEY_LINE_FORCE} more`}
              overlay={isGranted ? <span className="blessing-flare" aria-hidden="true" /> : undefined}
              ctaClassName={isGranted ? 'is-done' : 'is-accent'}
              cta={
                <span className="ley-line-cta" style={{ '--force-rgb': getTypeColorRgb(type) } as CSSProperties}>
                  <StatusGlyph statusId={statusId} className="ley-line-cta-glyph" />
                  {isGranted ? `${held} ${type} Force` : held > 0 ? `${held} → ${held + LEY_LINE_FORCE} ${type} Force` : `+${LEY_LINE_FORCE} ${type} Force`}
                </span>
              }
            />
          );
        })}
      </HeroPickGrid>

      <button className="resolve-button" disabled={!grantedTo} onClick={onContinue}>
        Continue
      </button>

      {previewEntry && (
        <HeroPreviewOverlay
          hero={previewEntry.hero}
          entry={previewEntry.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          scale={statScaleFor(run)}
          onClose={() => setPreviewEntry(null)}
        />
      )}
    </div>
  );
}
