import type { CSSProperties } from 'react';
import type { RelicDefinition } from '../../run/relics';
import { RelicIcon } from '../shared/EquipmentBox';

interface Props {
  relic: RelicDefinition;
  picked: boolean;
  onPick: () => void;
  /** Staggers this card's fade-up-in behind the screen's header, same convention as the Equipment Cache cards. */
  revealDelayMs: number;
  /**
   * An extra line under the description, for offers whose value depends on
   * what the player already holds — the Guardian's Banner screen uses it to
   * spell out what a repeat pick stacks to (GuardianBannerScreen). Omitted
   * by the Relic Shrine, where every offer is one the player doesn't own.
   */
  note?: string;
}

/**
 * One relic offer, wherever relics are offered — a full-width row (icon +
 * name + the relic's actual description) rather than a square tile, so the
 * player can read exactly what each relic does before committing without
 * holding anything. Tap selects it (highlighted; the claim itself is the
 * screen's own bottom button, the same select-then-claim two-step the
 * Equipment Cache uses); there is no long-press/inspect step, since the
 * description is already on the card.
 *
 * Lives in its own file rather than inside NodeRewardScreen because the
 * post-Guardian Banner screen offers relics too, and an offered relic should
 * look the same object in both places.
 */
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
