import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import { levelOf } from '../../run/growth';
import type { RosterEntry, RunState } from '../../run/state';
import { anyWounded, mendRoster } from '../../run/wounds';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { NodeHeader, NodeSky, NODE_TINT_VITAL } from '../shared/NodeStage';
import { NodeGlyph } from '../shared/nodeIcons';
import { WoundBar, entryHp } from '../shared/WoundBar';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

/**
 * The Rest (docs/run-loop.md "Wounds", 2026-09-15, per user direction): the whole roster made
 * whole, in the seat a reward row would otherwise have given to gear, Scrolls or a Boon. No
 * decision on the screen — the decision was the tile — so it is a receipt with a beat: every bar
 * where the act left it, one tap, every bar full.
 */
export function RestNodeScreen({ run, onRunChange, onContinue }: Props) {
  const [rested, setRested] = useState(false);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const wounded = anyWounded(run);

  useEffect(() => {
    playSfx('shrine', { pitch: 0.8, delay: 0.12 });
  }, []);

  function handleRest() {
    playSfx('blessing');
    onRunChange(mendRoster(run));
    setRested(true);
  }

  return (
    <div className="node-screen shrine-screen rest-screen" style={{ '--node-rgb': NODE_TINT_VITAL } as CSSProperties}>
      <NodeSky />

      <NodeHeader
        eyebrow="Embers Banked"
        title="Rest"
        glyph={<NodeGlyph type="restReward" />}
        readoutKey={rested ? 'rested' : 'idle'}
        readoutLive={rested}
        readout={
          rested
            ? 'Every wound closes. The company is whole again.'
            : wounded
              ? 'The company sits by the fire. Rest, and every wound the act has left closes. Hold a hero to review a sheet.'
              : 'Nobody is hurt. The fire is warm all the same.'
        }
      />

      <HeroPickGrid count={run.roster.length} fill>
        {run.roster.map((entry) => {
          const hero = rosterHeroes[entry.heroId];
          const { hp, maxHp } = entryHp(hero, entry, run.relics);
          return (
            <HeroPickCard
              key={entry.rosterId}
              hero={hero}
              entry={entry}
              className={rested ? 'is-mended' : ''}
              onPreview={() => setPreviewEntry({ hero, entry })}
              ariaLabel={`${hero.name}, level ${levelOf(entry)} — ${hp} of ${maxHp} HP`}
              detail={<WoundBar hp={hp} maxHp={maxHp} figure />}
              ctaClassName={hp === maxHp ? 'is-done' : ''}
              cta={hp === maxHp ? 'Whole' : `${maxHp - hp} to mend`}
            />
          );
        })}
      </HeroPickGrid>

      {rested || !wounded ? (
        <button className="resolve-button" onClick={onContinue}>
          Continue
        </button>
      ) : (
        <button className="resolve-button" onClick={handleRest}>
          Rest
        </button>
      )}

      {previewEntry && (
        <HeroPreviewOverlay
          hero={previewEntry.hero}
          entry={previewEntry.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          onClose={() => setPreviewEntry(null)}
        />
      )}
    </div>
  );
}
