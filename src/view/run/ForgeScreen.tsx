import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import { MAX_ITEM_SLOTS } from '../../run/equipment';
import { itemSlotsFor } from '../../run/progression';
import type { RosterEntry, RunState } from '../../run/state';
import { grantItemSlot } from '../../run/runProgress';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { NodeHeader, NodeSky } from '../shared/NodeStage';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterPeek } from './RosterPeek';

/** Matches the Forge's map colour (MapScreen NODE_COLORS forgeReward), as bare `r, g, b`. */
const NODE_TINT_FORGE = '240, 145, 60';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

/**
 * The Forge: one hero gains an item slot for the rest of the run. The only reward that grows
 * what a hero can HOLD rather than handing over another thing to hold, so it compounds with
 * every drop after it — which is why a hero at MAX_ITEM_SLOTS is simply not a legal target.
 */
export function ForgeScreen({ run, onRunChange, onContinue }: Props) {
  const [grantedTo, setGrantedTo] = useState<string | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  useEffect(() => {
    playSfx('shrine', { pitch: 0.72, delay: 0.12 });
  }, []);

  function handleGrant(rosterId: string) {
    playSfx('equip');
    onRunChange(grantItemSlot(run, rosterId, heroes));
    setGrantedTo(rosterId);
  }

  const grantedHero = grantedTo ? heroes[run.roster.find((r) => r.rosterId === grantedTo)!.heroId] : null;
  // A roster entirely at the cap would strand the player, so Continue opens for that case too.
  const anyEligible = run.roster.some((entry) => {
    const hero = heroes[entry.heroId];
    return hero && itemSlotsFor(hero, entry) < MAX_ITEM_SLOTS;
  });

  return (
    <div className="node-screen shrine-screen" style={{ '--node-rgb': NODE_TINT_FORGE } as CSSProperties}>
      <NodeSky />

      <span className="shrine-descent" aria-hidden="true" />

      <RosterPeek run={run} />

      <NodeHeader
        eyebrow="The Forge"
        title="Another Hand Free"
        readoutKey={grantedTo ?? 'idle'}
        readoutLive={!!grantedHero}
        readout={
          grantedHero
            ? `${grantedHero.name} can carry one more item.`
            : anyEligible
              ? 'Choose a hero to gain an item slot for the rest of the run. Hold to review a sheet.'
              : `Every hero is already at the ${MAX_ITEM_SLOTS}-slot cap — there is nothing the smith can add.`
        }
      />

      <HeroPickGrid count={run.roster.length} fill>
        {run.roster.map((entry) => {
          const hero = heroes[entry.heroId];
          const slots = itemSlotsFor(hero, entry);
          const isGranted = grantedTo === entry.rosterId;
          const atCap = slots >= MAX_ITEM_SLOTS;
          return (
            <HeroPickCard
              key={entry.rosterId}
              hero={hero}
              entry={entry}
              className={isGranted ? 'is-blessed' : ''}
              disabled={atCap || (!!grantedTo && !isGranted)}
              onActivate={() => !grantedTo && !atCap && handleGrant(entry.rosterId)}
              onPreview={() => setPreviewEntry({ hero, entry })}
              ariaLabel={`${hero.name}, level ${entry.level} — ${
                atCap ? `already at the ${MAX_ITEM_SLOTS}-slot cap` : `${slots} item slots, grant a ${slots + 1}th`
              }`}
              /* Mounted only on the granted card, so mounting is what starts it. */
              overlay={isGranted ? <span className="blessing-flare" aria-hidden="true" /> : undefined}
              ctaClassName={isGranted ? 'is-done' : 'is-accent'}
              cta={isGranted ? `${slots} slots` : atCap ? 'At cap' : `${slots} → ${slots + 1} slots`}
            />
          );
        })}
      </HeroPickGrid>

      <button className="resolve-button" disabled={!grantedTo && anyEligible} onClick={onContinue}>
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
