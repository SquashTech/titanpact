import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import { CANDY_LEVELS, anyCandyEligible, canEatCandy, candyLevelAfter, parLevel, type CandyKind } from '../../run/candy';
import { levelOf } from '../../run/growth';
import type { RosterEntry, RunState } from '../../run/state';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { NodeHeader, NodeSky, NODE_TINT_VITAL } from '../shared/NodeStage';
import { ResourceGlyph } from '../shared/RunGlyph';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterPeek } from './RosterPeek';

interface Props {
  run: RunState;
  kind: CandyKind;
  /** The Guild Hall's shelf, rather than a map node: the header says what was paid. */
  bought?: boolean;
  /** The pick IS the decision — the caller feeds the hero and raises the level-up report. */
  onPick: (rosterId: string) => void;
  /** Only reachable when nobody can eat it; a map node still has to be walked past. */
  onSkip: () => void;
}

const TITLES: Record<CandyKind, string> = { candy: 'Candy', small: 'Small Candy' };

/**
 * Candy: XP aimed at ONE hero (docs/xp-overhaul.md §3, run/candy.ts). The screen collects one
 * thing, who, and every card says what that hero would become — a hero behind par climbs
 * further on the same candy, which is the whole reason the number is on the card. The payoff is
 * the level-up report, not this screen: the pick hands straight off.
 */
export function CandyNodeScreen({ run, kind, bought = false, onPick, onSkip }: Props) {
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const [picked, setPicked] = useState(false);

  useEffect(() => {
    playSfx('shrine', { pitch: 1.1, delay: 0.12 });
  }, []);

  const levels = CANDY_LEVELS[kind];
  const par = parLevel(run);
  const anyEligible = anyCandyEligible(run.roster);

  function handlePick(rosterId: string) {
    if (picked) return;
    setPicked(true);
    playSfx('xp.orb');
    onPick(rosterId);
  }

  return (
    <div className="node-screen shrine-screen" style={{ '--node-rgb': NODE_TINT_VITAL } as CSSProperties}>
      <NodeSky />

      <span className="shrine-descent" aria-hidden="true" />

      <RosterPeek run={run} />

      <NodeHeader
        eyebrow={bought ? 'Off the shelf' : 'Spoils'}
        title={TITLES[kind]}
        glyph={<ResourceGlyph kind="candy" className="node-header-resource" />}
        readout={
          anyEligible
            ? `${levels === 1 ? "A level's" : `${levels} levels'`} worth of growth at par (Lv ${par}), for one hero. Choose who — a hero behind gets more of it. Hold to review a sheet.`
            : 'Every hero is already at max level — there is nobody left to feed.'
        }
      />

      <HeroPickGrid count={run.roster.length} fill>
        {run.roster.map((entry) => {
          const hero = rosterHeroes[entry.heroId];
          const from = levelOf(entry);
          const eligible = canEatCandy(entry);
          const to = eligible ? candyLevelAfter(run, entry, kind) : from;
          return (
            <HeroPickCard
              key={entry.rosterId}
              hero={hero}
              entry={entry}
              disabled={!eligible || picked}
              onActivate={() => eligible && handlePick(entry.rosterId)}
              onPreview={() => setPreviewEntry({ hero, entry })}
              ariaLabel={`${hero.name}, level ${from} — ${eligible ? `feed it, to level ${to}` : 'already at max level'}`}
              ctaClassName={eligible ? 'is-accent' : undefined}
              cta={eligible ? (to > from ? `Lv ${from} → ${to}` : `Lv ${from}, part-way`) : 'Max'}
            />
          );
        })}
      </HeroPickGrid>

      {!anyEligible && (
        <button className="resolve-button" onClick={onSkip}>
          Continue
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
