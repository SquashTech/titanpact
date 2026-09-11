import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { heroes } from '../../data/heroes';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition } from '../../engine/content';
import { canSpendScroll } from '../../run/progression';
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
 * A won Scroll, poured now (2026-09-10, per user direction — it replaces the Roster's Mastery
 * board tab). Scrolls used to sit in a purse until the player went looking for them, and
 * `docs/growth-overhaul.md` §10 had already named the failure that produced: a count on a menu
 * button "still signals admin waiting". The deeper reason it had to go is that Mastery Rank was
 * built so the ceiling sits behind the SPEND rather than behind a clock — holding a Scroll is
 * never better than spending one — and a stock with no reason to be held is not a strategy, it is
 * a to-do list.
 *
 * So the board is pushed rather than pulled, and there is no way out but pouring. What that costs
 * is the churn hedge: a Scroll can no longer be saved for a hero you have not recruited yet. That
 * is consistent with how recruitment already works — a Guild hire arrives raw on purpose and a
 * contract hero arrives finished on purpose — but it is the thing to watch if pivoting starts
 * feeling punished.
 *
 * Last in the post-fight chain, AFTER the Banner, the contract and the Crucible, so a hero
 * recruited or Classed this beat can take the Scroll it just became eligible for.
 *
 * The 6th Scroll into a hero is its Evolution (docs/growth-overhaul.md §11), and that is a
 * screen of its own, so the pour's state lives here (`useScrollPour`) and the Evolution screen
 * replaces the board outright while the choice is open.
 *
 * The header is the count and nothing else: a Scroll glyph and how many are left. The title it
 * used to carry ("2 Scrolls to Pour") and the line under it ("Tap a hero to pour one in · 3 to a
 * rank") were both saying what the board already shows — every row that can take one is lit.
 */
export function MasteryScreen({ run, onRunChange, onDone }: Props) {
  const [inspecting, setInspecting] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  useEffect(() => {
    playSfx('cache.open', { pitch: 1.12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flow = useScrollPour(run, onRunChange);

  const left = run.masteryScrolls;
  // Every hero at max rank with nothing left to teach: the Scroll buys literally nothing, and the
  // screen has to let go or it is a wall. The count is left standing rather than swallowed — it
  // is a dead end in the run, not a bug, and App refuses to raise this screen on it again.
  const stuck = left > 0 && !run.roster.some((entry) => canSpendScroll(progressionTable, moves, run, entry));
  // Never while a pour is still resolving — the Scroll's offer after an Evolution has not rolled yet.
  const done = (left <= 0 || stuck) && !flow.evolving && !flow.overflow;

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
        {stuck && <span className="mastery-stuck">Nobody has anything left to learn</span>}
      </header>

      <div className="screen-scroll">
        <MasteryBoard run={run} flow={flow} onInspect={(entry, hero) => setInspecting({ hero, entry })} />
      </div>

      {/* Only once every Scroll is poured. Held in the layout while hidden so the centred board
          does not jump when the button arrives. */}
      <button className={`resolve-button mastery-continue${done ? '' : ' is-hidden'}`} disabled={!done} onClick={onDone}>
        Continue
      </button>

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
