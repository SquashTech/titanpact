import { useEffect, useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import { anvilQuote, type ItemRef } from '../../run/runProgress';
import type { RunState } from '../../run/state';
import { RARITY_LABELS } from '../shared/EquipmentBox';
import { HubGlyph } from '../shared/nodeIcons';
import { SmithyBeat, type SmithyWork } from './SmithyBeat';
import { refKey, SmithyBenches } from './SmithyBenches';
import { SmithyWorkSheet } from './SmithyWorkSheet';
import { ForgeSign } from './smithyArt';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
}

/**
 * The Guild Hall's smithy (docs/equipment.md §5; docs/gear-absorption.md §6), rebuilt as a room
 * rather than a list (2026-09-16, per user direction). Every piece the player owns is on a hero,
 * so the tab is the roster: each hero's bench, the hero on it, and its three sockets — the same
 * sockets the who-screen fills (SmithyBenches, shared with the Forge node). A tap on a piece opens its work sheet (SmithyWorkSheet); the
 * Anvil and the Enchanter both happen there, and what they make is played out on the piece
 * (SmithyBeat) before the bench shows it. The list it replaces put eighteen identical rows under
 * two price buttons each, and read as an invoice.
 */
export function ItemServicesSection({ run, onRunChange }: Props) {
  const [working, setWorking] = useState<ItemRef | null>(null);
  /** The beat playing over the work just paid for, and the socket it lands in. */
  const [beat, setBeat] = useState<{ work: SmithyWork; key: string } | null>(null);
  /** The socket the last piece of work landed in, lit for a moment once the beat clears. */
  const [fresh, setFresh] = useState<string | null>(null);

  useEffect(() => {
    if (!fresh) return;
    const timer = window.setTimeout(() => setFresh(null), 2400);
    return () => window.clearTimeout(timer);
  }, [fresh]);

  /** A lift the purse covers right now — the badge reads this, not the bare quote (2026-09-17, per user direction — a badge on a lift the player cannot pay for is a badge on every piece by Act 3). */
  const affordableLift = (itemId: string) => {
    const quote = anvilQuote(run, itemId, equipment);
    return quote && run.gold >= quote.cost ? quote : null;
  };

  const workingEntry = working ? run.roster.find((r) => r.rosterId === working.rosterId) : null;
  const workingHero = workingEntry ? rosterHeroes[workingEntry.heroId] : null;
  const workingItem = working && workingEntry ? equipment[workingEntry.equipment[working.index] ?? ''] : null;

  return (
    <div className="smithy">
      {/* The forge itself, as the counter's sign. No tally under the title: the benches say it. */}
      <ForgeSign />
      <div className="guild-hall-section-head">
        <span className="guild-hall-section-title">
          <HubGlyph name="anvil" /> Anvil &amp; Enchanter
        </span>
      </div>

      <SmithyBenches
        run={run}
        liftFor={(item) => {
          const quote = affordableLift(item.id);
          return quote ? { targetRarity: quote.targetRarity, label: `Can be lifted to ${RARITY_LABELS[quote.targetRarity]} for ${quote.cost} gold` } : null;
        }}
        onPick={(ref) => setWorking(ref)}
        fresh={fresh}
      />

      {working && workingEntry && workingHero && workingItem && (
        <SmithyWorkSheet
          run={run}
          hero={workingHero}
          entry={workingEntry}
          itemRef={working}
          item={workingItem}
          onCommit={(next, work) => {
            onRunChange(next);
            setWorking(null);
            setBeat({ work, key: refKey(working) });
          }}
          onClose={() => {
            playSfx('ui.back');
            setWorking(null);
          }}
        />
      )}

      {beat && (
        <SmithyBeat
          work={beat.work}
          onDone={() => {
            setFresh(beat.key);
            setBeat(null);
          }}
        />
      )}
    </div>
  );
}
