import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import { ICHOR_FIGHTS, anyIchorEligible, canDrinkIchor, ichorLevelAfter, ichorXp, type IchorKind } from '../../run/ichor';
import { MAX_XP, levelOf, xpProgress } from '../../run/growth';
import type { RosterEntry, RunState } from '../../run/state';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { NodeHeader, NodeSky, NODE_TINT_VITAL } from '../shared/NodeStage';
import { ResourceGlyph } from '../shared/RunGlyph';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterPeek } from './RosterPeek';

interface Props {
  run: RunState;
  kind: IchorKind;
  /** The Guild Hall's shelf, rather than a map node: the header says what was paid. */
  bought?: boolean;
  /** The pick IS the decision — the caller feeds the hero and raises the level-up report. */
  onPick: (rosterId: string) => void;
  /** Only reachable when nobody can eat it; a map node still has to be walked past. */
  onSkip: () => void;
}

const TITLES: Record<IchorKind, string> = { ichor: 'Ichor', drop: 'Drop of Ichor' };

/**
 * Ichor: XP aimed at ONE hero (docs/xp-overhaul.md §3, run/ichor.ts). The screen collects one
 * thing, who, and every card shows what that hero's bar would do — a hero behind par climbs
 * further on the same Ichor, a carry ahead of it less, and the bar is where that is read rather
 * than a sentence about par. The payoff is the level-up report, not this screen: the pick hands
 * straight off.
 */
export function IchorNodeScreen({ run, kind, bought = false, onPick, onSkip }: Props) {
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const [picked, setPicked] = useState(false);

  useEffect(() => {
    playSfx('shrine', { pitch: 1.1, delay: 0.12 });
  }, []);

  const xp = ichorXp(run, kind);
  const anyEligible = anyIchorEligible(run.roster);

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
        eyebrow={bought ? 'Off the shelf' : 'What the Titan Leaks'}
        title={TITLES[kind]}
        glyph={<ResourceGlyph kind="ichor" className="node-header-resource" />}
        readout={
          anyEligible
            ? `${xp} XP — ${ICHOR_FIGHTS[kind]} fights' worth — for whoever drinks it. Choose who; a hero behind climbs further on it. Hold to review a sheet.`
            : 'Every hero is already at max level — there is nobody left to drink it.'
        }
      />

      <HeroPickGrid count={run.roster.length} fill>
        {run.roster.map((entry) => {
          const hero = rosterHeroes[entry.heroId];
          const from = levelOf(entry);
          const eligible = canDrinkIchor(entry);
          const to = eligible ? ichorLevelAfter(run, entry, kind) : from;
          const toXp = Math.min(MAX_XP, entry.xp + xp);
          return (
            <HeroPickCard
              key={entry.rosterId}
              hero={hero}
              entry={entry}
              disabled={!eligible || picked}
              onActivate={() => eligible && handlePick(entry.rosterId)}
              onPreview={() => setPreviewEntry({ hero, entry })}
              ariaLabel={`${hero.name}, level ${from} — ${eligible ? `drinks it, to level ${to}` : 'already at max level'}`}
              ctaClassName={eligible ? 'is-accent' : undefined}
              detail={<IchorBarPreview fromXp={entry.xp} toXp={toXp} crossed={to - from} />}
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

/**
 * What the Ichor would do to this hero's bar. Inside one level: the XP already banked, dim, and
 * the Ichor's share bright after it. Across a level: the bar it ENDS in, all bright, with the
 * levels crossed struck beside it — the CTA under the card names the two levels.
 */
function IchorBarPreview({ fromXp, toXp, crossed }: { fromXp: number; toXp: number; crossed: number }) {
  const held = crossed > 0 ? 0 : xpProgress(fromXp);
  const after = xpProgress(toXp);
  return (
    <span className="ichor-bar" aria-hidden="true">
      <span className="ichor-bar-track">
        <i className="ichor-bar-held" style={{ width: `${held * 100}%` }} />
        <i className="ichor-bar-gain" style={{ left: `${held * 100}%`, width: `${Math.max(0, after - held) * 100}%` }} />
      </span>
      {crossed > 0 && <span className="ichor-bar-levels">+{crossed}</span>}
    </span>
  );
}
