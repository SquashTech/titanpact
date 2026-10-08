import type { MoveDefinition } from '../../engine/content';
import type { Combatant } from '../../engine/state';
import { chargesLeft } from '../../engine/state';

interface Props {
  move: MoveDefinition;
  /** The live holder; omitted, every pip is drawn lit (a fight opens full). */
  combatant?: Pick<Combatant, 'chargesSpent'>;
  /** Pips given back since the player last saw this row, lit with a flash. */
  restored?: number;
  className?: string;
}

/**
 * A move's Charges (docs/charges.md) as a row of upright cells: lit for a Charge left, hollow for one
 * spent. Never a fraction. Nothing is drawn for a move without Charges.
 */
export function ChargePips({ move, combatant, restored = 0, className }: Props) {
  const total = move.chargesPerFight;
  if (total == null) return null;
  const left = combatant ? chargesLeft(combatant, move) ?? total : total;
  const classes = ['charge-pips', left === 0 ? 'is-empty' : '', className].filter(Boolean).join(' ');
  return (
    <span className={classes} aria-label={`${left} of ${total} Charges left`}>
      {Array.from({ length: total }, (_, i) => {
        const lit = i < left;
        const flashing = lit && i >= left - restored;
        return <i key={i} className={['charge-pip', lit ? 'is-lit' : 'is-spent', flashing ? 'is-restored' : ''].filter(Boolean).join(' ')} />;
      })}
    </span>
  );
}
