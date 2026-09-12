import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { heroes } from '../../data/heroes';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition } from '../../engine/content';
import { canAffordAnyScroll, canSpendScroll, deferMastery } from '../../run/progression';
import type { RosterEntry, RunState } from '../../run/state';
import { equipment } from '../../data/equipment';
import { NodeSky, NODE_TINT_ARCANE } from '../shared/NodeStage';
import { ResourceGlyph } from '../shared/RunGlyph';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { EvolutionScreen } from './EvolutionScreen';
import { MasteryBoard, useScrollPour } from './MasteryBoard';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onDone: () => void;
}

/**
 * The Mastery board, pushed after every node that leaves the purse able to buy somebody a rung
 * (App.tsx `masteryDue`), and pulled from the map's Scroll chip for a purse the player banked.
 *
 * A rung's price rises with the rung (docs/growth-overhaul.md §12, 2026-09-12 — the pre-overhaul
 * level-up curve, brought back per user direction), so the purse is a purse again: a leftover
 * that buys nobody banks on its own, and a purse that could buy somebody can be banked by choice —
 * the Bank button is the out, and the next grant re-asks. That reverses 2026-09-10's "poured
 * where it is won, never held", which was built for a flat price where holding never paid; under
 * a rising one, saving toward a dear rung is the strategy the curve exists to create.
 *
 * Last in the post-fight chain, AFTER the Banner, the contract and the Crucible, so a hero
 * recruited or Classed this beat can take the rung it just became eligible for.
 *
 * The Evolution rung is a screen of its own (docs/growth-overhaul.md §11), so the pour's state
 * lives here (`useScrollPour`) and the Evolution screen replaces the board outright while the
 * choice is open.
 *
 * The header is the count and nothing else: a Scroll glyph and how many are held. Every row that
 * can take a rung is lit, and every row carries its own price.
 */
export function MasteryScreen({ run, onRunChange, onDone }: Props) {
  const [inspecting, setInspecting] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  useEffect(() => {
    playSfx('cache.open', { pitch: 1.12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flow = useScrollPour(run, onRunChange);

  const left = run.masteryScrolls;
  // Affordability, not emptiness: a purse that buys nobody banks, and the screen lets go on it.
  const spendable = canAffordAnyScroll(progressionTable, moves, run);
  // Every hero at max rank with nothing left to teach: the purse buys literally nothing, ever.
  // The count is left standing rather than swallowed — it is a dead end in the run, not a bug.
  const stuck = left > 0 && !run.roster.some((entry) => canSpendScroll(progressionTable, moves, { ...run, masteryScrolls: Infinity }, entry));
  const idle = !flow.pouring && !flow.offer && !flow.evolving && !flow.overflow;
  // Never while a pour is still resolving — the rung's offer after an Evolution has not rolled yet.
  const done = !spendable && idle;
  // The out for a purse the player wants to keep. Not while anything is mid-resolution: an
  // Evolution or an overflow is a payout already bought, not a spend to walk away from.
  const canBank = spendable && idle;

  function bank() {
    playSfx('ui.page');
    onRunChange(deferMastery(run));
    onDone();
  }

  const evolvingEntry = flow.evolving ? (run.roster.find((r) => r.rosterId === flow.evolving!.rosterId) ?? null) : null;
  if (flow.evolving && evolvingEntry) {
    return (
      <EvolutionScreen
        hero={heroes[evolvingEntry.heroId]}
        entry={evolvingEntry}
        node={flow.evolving.node}
        run={run}
        onChoose={flow.chooseEvolution}
      />
    );
  }

  return (
    <div className="node-screen mastery-screen" style={{ '--node-rgb': NODE_TINT_ARCANE } as CSSProperties}>
      <NodeSky />

      <header className="mastery-header">
        <span className="node-eyebrow">Mastery</span>
        <span className={`mastery-count${left <= 0 ? ' is-spent' : ''}`} key={left} aria-label={`${left} Scrolls left`}>
          <ResourceGlyph kind="scroll" tone="inherit" className="mastery-count-glyph" />
          <span className="mastery-count-num">{left}</span>
        </span>
        {stuck ? (
          <span className="mastery-stuck">Nobody has anything left to learn</span>
        ) : (
          left > 0 && !spendable && idle && <span className="mastery-stuck">Not enough for a rung yet — banked</span>
        )}
      </header>

      <div className="screen-scroll">
        <MasteryBoard run={run} flow={flow} onInspect={(entry, hero) => setInspecting({ hero, entry })} />
      </div>

      {/* One slot, two buttons: Continue once the purse buys nobody, Bank while it still could.
          Both are held in the layout while unavailable so the centred board does not jump when
          the button arrives or leaves mid-pour. */}
      {done ? (
        <button className="resolve-button mastery-continue" onClick={onDone}>
          Continue
        </button>
      ) : (
        <button className={`secondary-button mastery-bank${canBank ? '' : ' is-inert'}`} disabled={!canBank} onClick={bank}>
          Bank {left} Scroll{left === 1 ? '' : 's'} for later
        </button>
      )}

      {inspecting && (
        <HeroPreviewOverlay
          hero={inspecting.hero}
          entry={inspecting.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          onClose={() => setInspecting(null)}
        />
      )}
    </div>
  );
}
