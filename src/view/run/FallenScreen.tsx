import { useEffect, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { releaseFallen } from '../../run/cycles';
import { canUseRevive, spendRevive } from '../../run/consumables';
import type { RosterEntry, RunState } from '../../run/state';
import { reviveHero } from '../../run/wounds';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { NodeHeader, NodeSky } from '../shared/NodeStage';
import { ResourceGlyph } from '../shared/RunGlyph';
import { entryHp } from '../shared/WoundBar';

/**
 * The Fallen (docs/ascension.md §3): under Permadeath, first in the post-fight chain — every
 * hero the won fight knocked out, one row each, kept by a Revive while the stock lasts or gone
 * with everything it carried when the player carries on. Nothing is released until Continue, so a
 * tap on the wrong row costs nothing but a Revive.
 */
interface Props {
  run: RunState;
  /** The heroes the fight knocked out, still on the roster and `down` until Continue lets them go. */
  rosterIds: readonly string[];
  onRunChange: (run: RunState) => void;
  onContinue: () => void;
}

export function FallenScreen({ run, rosterIds, onRunChange, onContinue }: Props) {
  const fallen = rosterIds.map((id) => run.roster.find((entry) => entry.rosterId === id)).filter((entry): entry is RosterEntry => !!entry);
  const stillDown = fallen.filter((entry) => entry.down);
  const revives = run.consumables.revive;
  const canRevive = canUseRevive(run);

  useEffect(() => {
    playSfx('companion.gone');
  }, []);

  function handleRevive(entry: RosterEntry) {
    if (!entry.down || !canUseRevive(run)) return;
    const { maxHp } = entryHp(rosterHeroes[entry.heroId], entry, run.relics);
    playSfx('blessing');
    onRunChange(spendRevive(reviveHero(run, entry.rosterId, maxHp)));
  }

  function handleContinue() {
    onRunChange(releaseFallen(run, stillDown.map((entry) => entry.rosterId)));
    onContinue();
  }

  const count = fallen.length;
  const title = count === 1 ? 'A hero has fallen' : `${count} heroes have fallen`;
  const readout =
    stillDown.length === 0
      ? 'Everyone who could be saved stands again.'
      : canRevive
        ? `A Revive keeps one at half health. Whoever is not revived is gone from the run with everything they carried. ${revives} ${revives === 1 ? 'Revive' : 'Revives'} left.`
        : 'No Revives. Whoever fell is gone from the run with everything they carried.';

  return (
    <div className="node-screen shrine-screen fallen-screen" style={{ '--node-rgb': '150, 60, 60' } as CSSProperties}>
      <NodeSky />

      <span className="shrine-descent" aria-hidden="true" />

      <NodeHeader
        eyebrow="The pact comes due"
        title={title}
        glyph={<ResourceGlyph kind="revive" className="node-header-resource" />}
        readout={readout}
        readoutLive
      />

      <HeroPickGrid count={count} fill>
        {fallen.map((entry) => {
          const hero = rosterHeroes[entry.heroId];
          const open = entry.down && canRevive;
          const cta = !entry.down ? 'Stands at half' : canRevive ? 'Revive' : 'Gone';
          return (
            <HeroPickCard
              key={entry.rosterId}
              hero={hero}
              entry={entry}
              disabled={!open}
              selected={!entry.down}
              onActivate={() => open && handleRevive(entry)}
              ariaLabel={`${hero.name} — ${cta}`}
              ctaClassName={!entry.down ? 'is-done' : canRevive ? 'is-accent' : undefined}
              cta={cta}
            />
          );
        })}
      </HeroPickGrid>

      <div className="node-spacer" />

      <button className="resolve-button" onClick={handleContinue}>
        {stillDown.length === 0 ? 'Continue' : 'Carry on without them'}
      </button>
    </div>
  );
}
