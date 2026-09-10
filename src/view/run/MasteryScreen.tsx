import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition } from '../../engine/content';
import { SCROLLS_PER_RANK, canSpendScroll } from '../../run/progression';
import type { RosterEntry, RunState } from '../../run/state';
import { equipment } from '../../data/equipment';
import { NodeHeader, NodeSky, NODE_TINT_ARCANE } from '../shared/NodeStage';
import { ResourceGlyph } from '../shared/RunGlyph';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { MasteryBoard } from './MasteryBoard';

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
 * recruited or evolved this beat can take the Scroll it just became eligible for.
 */
export function MasteryScreen({ run, onRunChange, onDone }: Props) {
  const [inspecting, setInspecting] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  useEffect(() => {
    playSfx('cache.open', { pitch: 1.12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const left = run.masteryScrolls;
  // Every hero at max rank with nothing left to teach: the Scroll buys literally nothing, and the
  // screen has to let go or it is a wall. The count is left standing rather than swallowed — it
  // is a dead end in the run, not a bug, and App refuses to raise this screen on it again.
  const stuck = left > 0 && !run.roster.some((entry) => canSpendScroll(progressionTable, moves, run, entry));
  const done = left <= 0 || stuck;

  return (
    <div className="node-screen mastery-screen" style={{ '--node-rgb': NODE_TINT_ARCANE } as CSSProperties}>
      <NodeSky />

      <NodeHeader
        compact
        eyebrow="Mastery"
        title={left > 1 ? `${left} Scrolls to Pour` : left === 1 ? 'A Scroll to Pour' : 'Poured'}
        glyph={left > 0 ? <ResourceGlyph kind="scroll" tone="inherit" /> : undefined}
        readoutKey={stuck ? 'stuck' : String(left)}
        readoutLive={left <= 0}
        readout={
          stuck
            ? 'Every hero is at Mastery Rank 3 with nothing left to learn. This one has nowhere to go.'
            : left > 0
              ? `Tap a hero to pour one in · ${SCROLLS_PER_RANK} to a rank`
              : 'Poured. Concentrate and the ceiling rises; spread thin and nobody ranks up.'
        }
      />

      <div className="screen-scroll">
        <MasteryBoard run={run} onRunChange={onRunChange} onInspect={(entry, hero) => setInspecting({ hero, entry })} />
      </div>

      {/* Disabled rather than absent while a Scroll is still in hand, the same shape the Banner
          uses: the button is where the eye goes, so it is the thing that should say what is owed. */}
      <button className="resolve-button" disabled={!done} onClick={onDone}>
        {done ? 'Continue' : left > 1 ? `Pour a Scroll — ${left} left` : 'Pour the Scroll'}
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
