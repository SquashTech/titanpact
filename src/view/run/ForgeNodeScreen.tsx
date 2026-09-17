import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { equipment } from '../../data/equipment';
import type { EquipmentDefinition } from '../../run/equipment';
import { anvilQuote, forgeLift, RunProgressError, type ItemRef } from '../../run/runProgress';
import type { RunState } from '../../run/state';
import { RARITY_LABELS } from '../shared/EquipmentBox';
import { HubGlyph } from '../shared/nodeIcons';
import { NodeHeader, NodeSky, NODE_TINT_HEARTH } from '../shared/NodeStage';
import { RosterPeek } from './RosterPeek';
import { SmithyBeat, type SmithyWork } from './SmithyBeat';
import { refKey, SmithyBenches } from './SmithyBenches';
import { ForgeSign } from './smithyArt';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

/**
 * The Forge (docs/run-loop.md "The Forge and the Ley Line", 2026-09-17, per user direction): the
 * Smithy's Anvil, out on the road and free — one worn piece, one tier up, the act's window still
 * capping it. The room is the Smithy tab's (SmithyBenches) and the work plays out the same way
 * (SmithyBeat); the difference is that a tap on a piece IS the lift, since there is no price to
 * read before it. A piece the Anvil would refuse — a Unique, a Mythic, a tier the act has not
 * reached — sits locked, and a roster with nothing to lift walks on.
 */
export function ForgeNodeScreen({ run, onRunChange, onContinue }: Props) {
  /** The socket lifted and what came off the anvil — the readout's subject once the beat has cleared. */
  const [lifted, setLifted] = useState<{ key: string; after: EquipmentDefinition } | null>(null);
  const [beat, setBeat] = useState<SmithyWork | null>(null);

  useEffect(() => {
    playSfx('anvil.ring', { pitch: 0.85, delay: 0.15 });
  }, []);

  const liftable = run.roster.reduce((n, entry) => n + entry.equipment.filter((itemId) => anvilQuote(run, itemId, equipment) !== null).length, 0);
  const done = lifted !== null;

  function handlePick(ref: ItemRef) {
    if (done) return;
    const entry = run.roster.find((r) => r.rosterId === ref.rosterId);
    const before = entry ? equipment[entry.equipment[ref.index] ?? ''] : undefined;
    if (!before) return;
    try {
      const next = forgeLift(run, ref, equipment);
      const after = equipment[next.roster.find((r) => r.rosterId === ref.rosterId)!.equipment[ref.index]!]!;
      onRunChange(next);
      setLifted({ key: refKey(ref), after });
      setBeat({ kind: 'anvil', before, after });
    } catch (err) {
      if (!(err instanceof RunProgressError)) throw err;
      playSfx('ui.denied');
    }
  }

  const readout = lifted
    ? `${lifted.after.name} comes off the anvil ${RARITY_LABELS[lifted.after.rarity]} — a tier up, free.`
    : liftable === 0
      ? 'Nothing the roster wears can be lifted here. Walk on.'
      : `Choose one worn piece to lift a tier, free. ${liftable} ${liftable === 1 ? 'piece' : 'pieces'} the anvil will take.`;

  return (
    <div className="node-screen forge-node-screen" style={{ '--node-rgb': NODE_TINT_HEARTH } as CSSProperties}>
      <NodeSky />

      <RosterPeek run={run} />

      <NodeHeader
        compact
        eyebrow="Iron and Ember"
        title="The Forge"
        glyph={<HubGlyph name="anvil" />}
        readoutKey={lifted?.key ?? 'idle'}
        readoutLive={done}
        readout={readout}
      />

      <div className="screen-scroll">
        <ForgeSign />
        <SmithyBenches
          run={run}
          liftFor={(item) => {
            const quote = anvilQuote(run, item.id, equipment);
            return quote && !done ? { targetRarity: quote.targetRarity, label: `Lift to ${RARITY_LABELS[quote.targetRarity]}, free` } : null;
          }}
          pickable={(item) => !done && anvilQuote(run, item.id, equipment) !== null}
          onPick={handlePick}
          fresh={beat ? null : (lifted?.key ?? null)}
        />
      </div>

      <button className="resolve-button" disabled={!done && liftable > 0} onClick={onContinue}>
        {liftable === 0 && !done ? 'Walk on' : 'Continue'}
      </button>

      {beat && <SmithyBeat work={beat} onDone={() => setBeat(null)} />}
    </div>
  );
}
