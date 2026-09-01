import type { CSSProperties } from 'react';
import type { RelicDefinition } from '../../run/relics';
import { RelicIcon } from '../shared/EquipmentBox';

interface Props {
  relic: RelicDefinition;
  picked: boolean;
  onPick: () => void;
  revealDelayMs: number;
  /** Extra line under the description — the Banner screen uses it for what a repeat pick stacks to. */
  note?: string;
}

// Tap selects; the claim is the screen's own bottom button. No inspect step —
// the description is on the card.
export function RelicChoiceCard({ relic, picked, onPick, revealDelayMs, note }: Props) {
  return (
    <button
      className={`relic-card relic-shrine-card${picked ? ' picked' : ''}`}
      style={{ animationDelay: `${revealDelayMs}ms` } as CSSProperties}
      onClick={onPick}
    >
      <div className="relic-shrine-card-icon-badge">
        <RelicIcon relicId={relic.id} className="relic-card-icon" />
      </div>
      <div className="relic-shrine-card-body">
        <span className="relic-card-name">{relic.name}</span>
        <p className="relic-shrine-card-desc">{relic.description ?? 'No effect described.'}</p>
        {note && <p className="relic-shrine-card-note">{note}</p>}
      </div>
    </button>
  );
}
