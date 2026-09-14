import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import { levelOf } from '../../run/growth';
import { MANA_WELL_AMOUNT, grantManaWell } from '../../run/runProgress';
import type { RosterEntry, RunState } from '../../run/state';
import { entryStatTotals } from '../shared/entryStatTotals';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { NodeHeader, NodeSky, NODE_TINT_MANA } from '../shared/NodeStage';
import { StatGlyph } from '../shared/StatBars';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterPeek } from './RosterPeek';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

/**
 * The Mana Well (docs/run-loop.md "The Mana Well", 2026-09-13, per user direction): one hero's
 * max Mana rises by MANA_WELL_AMOUNT for the rest of the run. The one bare-number screen the
 * constitution allows, because a pool is the stat that gates a whole tier of moves: +30 Mana is a
 * Late cast a fight, where +10 Attack was never something a player could see. Every card says
 * the pool it would leave the hero with, so the choice is read off the number that matters.
 */
export function ManaWellScreen({ run, onRunChange, onContinue }: Props) {
  const [grantedTo, setGrantedTo] = useState<string | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  useEffect(() => {
    playSfx('shrine', { pitch: 0.9, delay: 0.12 });
  }, []);

  function handleGrant(rosterId: string) {
    playSfx('gold.purse');
    onRunChange(grantManaWell(run, rosterId));
    setGrantedTo(rosterId);
  }

  const grantedHero = grantedTo ? rosterHeroes[run.roster.find((r) => r.rosterId === grantedTo)!.heroId] : null;

  return (
    <div className="node-screen shrine-screen" style={{ '--node-rgb': NODE_TINT_MANA } as CSSProperties}>
      <NodeSky />

      <span className="shrine-descent" aria-hidden="true" />

      <RosterPeek run={run} />

      <NodeHeader
        eyebrow="Cold Water, Far Down"
        title="Mana Well"
        glyph={<StatGlyph stat="manaPool" tone="inherit" />}
        readoutKey={grantedTo ?? 'idle'}
        readoutLive={!!grantedHero}
        readout={
          grantedHero
            ? `${grantedHero.name} draws deeper now — +${MANA_WELL_AMOUNT} max Mana for the rest of the run.`
            : `Choose a hero to gain +${MANA_WELL_AMOUNT} max Mana for the rest of the run. Hold to review a sheet.`
        }
      />

      <HeroPickGrid count={run.roster.length} fill>
        {run.roster.map((entry) => {
          const hero = rosterHeroes[entry.heroId];
          const pool = entryStatTotals(hero, entry, run.relics).manaPool;
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
              ariaLabel={`${hero.name}, level ${levelOf(entry)} — ${pool} max Mana, grant ${MANA_WELL_AMOUNT} more`}
              overlay={isGranted ? <span className="blessing-flare" aria-hidden="true" /> : undefined}
              ctaClassName={isGranted ? 'is-done' : 'is-accent'}
              cta={isGranted ? `${pool} Mana` : `${pool} → ${pool + MANA_WELL_AMOUNT} Mana`}
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
          onClose={() => setPreviewEntry(null)}
        />
      )}
    </div>
  );
}
