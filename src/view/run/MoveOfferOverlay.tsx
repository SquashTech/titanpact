import { useState } from 'react';
import { createPortal } from 'react-dom';
import { heroes } from '../../data/heroes';
import { moves } from '../../data/moves';
import type { RosterEntry, RunState } from '../../run/state';
import { MOVE_CAP } from '../../run/progression';
import { playSfx } from '../../audio/sfx';
import { MoveDetailCard } from '../combat/MoveDetailOverlay';
import { HeroPortrait } from '../shared/HeroPortrait';
import { MoveButtonReplica, useLongPress } from '../shared/MoveTile';
import { HubGlyph } from '../shared/nodeIcons';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';
import { healCasterForEntry } from '../shared/healCaster';
import { overlayHost } from '../shared/overlayHost';

interface Props {
  run: RunState;
  entry: RosterEntry;
  moveId: string;
  /** Line above the card — what bought this offer. */
  eyebrow: string;
  /** `null` declines. The move is already burned from the pool either way; the caller owns that. */
  onResolve: (replaceMoveId: string | null, learn: boolean) => void;
}

/**
 * One move, offered to one hero: learn it, or decline. At `MOVE_CAP` the offer grows a second
 * question — which of the four goes — and the confirm waits on an answer to it.
 *
 * Its own component rather than LevelUpScreen's, which is a full-screen stage and only ever
 * handles the at-cap half. This is the shape a Mastery Scroll needs (docs/growth-overhaul.md §4),
 * and it wears the same `.reward-panel` / `.moveoffer-*` classes so the two read as one screen.
 */
export function MoveOfferOverlay({ run, entry, moveId, eyebrow, onResolve }: Props) {
  const [selectedReplaceId, setSelectedReplaceId] = useState<string | null>(null);
  const [popupMoveId, setPopupMoveId] = useState<string | null>(null);
  const [referenceOpen, setReferenceOpen] = useState(false);

  const hero = heroes[entry.heroId];
  const caster = healCasterForEntry(hero, entry, run.relics);
  const atCap = entry.unlockedMoveIds.length >= MOVE_CAP;
  const headPress = useLongPress(() => setPopupMoveId(moveId));

  function resolve(replaceMoveId: string | null, learn: boolean) {
    playSfx(learn ? 'scroll.spend' : 'ui.back');
    onResolve(replaceMoveId, learn);
  }

  return createPortal(
    <div className="log-overlay moveoffer-overlay">
      <div className="reward-panel moveoffer-panel">
        {/* The cards below are terse — the rule under each payload is in here instead. */}
        <button
          type="button"
          className="moveoffer-reference"
          onClick={() => setReferenceOpen(true)}
          aria-label="Reference"
          title="Reference"
        >
          <HubGlyph name="reference" />
        </button>
        <div className="offer-hero-head" {...headPress}>
          <HeroPortrait heroId={hero.id} className="offer-hero-portrait" />
          <h3>{hero.name}</h3>
        </div>
        <p className="offer-hero-eyebrow">{eyebrow}</p>

        <div className="offer-move-highlight">
          <MoveDetailCard move={moves[moveId]} label="New move offered" caster={caster} terse />
        </div>

        {atCap && (
          <>
            <p className="offer-hero-sub">Already knows {MOVE_CAP} moves — pick one to replace, or decline.</p>
            <div className="offer-swap-arrow" aria-hidden="true">
              ↓ replaces one of
            </div>
            <div className="move-list offer-replace-list">
              {entry.unlockedMoveIds.map((id) => (
                <MoveButtonReplica
                  key={id}
                  move={moves[id]}
                  selected={selectedReplaceId === id}
                  caster={caster}
                  onClick={() => setSelectedReplaceId(id)}
                  onLongPress={() => setPopupMoveId(id)}
                />
              ))}
            </div>
          </>
        )}

        <div className="reward-panel-actions moveoffer-actions">
          <button className="moveoffer-button moveoffer-decline" onClick={() => resolve(null, false)}>
            <span className="moveoffer-icon" aria-hidden="true">
              ✕
            </span>
            <span className="moveoffer-label">Decline</span>
            {/* Says the price out loud: the Scroll is spent and the move does not come back. */}
            <span className="moveoffer-sub">The move is gone either way</span>
          </button>
          <button
            className="moveoffer-button moveoffer-confirm"
            disabled={atCap && !selectedReplaceId}
            onClick={() => resolve(selectedReplaceId, true)}
          >
            <span className="moveoffer-icon" aria-hidden="true">
              ✓
            </span>
            <span className="moveoffer-label">Learn</span>
            <span className="moveoffer-sub">
              {atCap ? (selectedReplaceId ? `Replace ${moves[selectedReplaceId].name}` : 'Pick a move first') : moves[moveId].name}
            </span>
          </button>
        </div>
      </div>

      {popupMoveId && (
        <div className="log-overlay" onClick={() => setPopupMoveId(null)}>
          <div className="log-panel move-popup-panel" onClick={(e) => e.stopPropagation()}>
            <MoveDetailCard move={moves[popupMoveId]} caster={caster} />
            <div className="move-popup-hint">Tap anywhere to close</div>
          </div>
        </div>
      )}
      {referenceOpen && <ReferenceOverlay initialTab="statuses" onClose={() => setReferenceOpen(false)} />}
    </div>,
    overlayHost()
  );
}

interface LearnedProps {
  run: RunState;
  entry: RosterEntry;
  moveId: string;
  eyebrow: string;
  onClose: () => void;
}

/**
 * The receipt for a Scroll poured into a hero with room in its kit (2026-09-10, per user
 * direction): the move is already learned by the time this mounts, so there is nothing to ask —
 * one card and one button. The same panel the offer wears, so a pour below the cap and a pour at
 * it read as the same beat with a question added, not as two screens.
 */
export function MoveLearnedOverlay({ run, entry, moveId, eyebrow, onClose }: LearnedProps) {
  const hero = heroes[entry.heroId];
  const caster = healCasterForEntry(hero, entry, run.relics);
  return createPortal(
    <div className="log-overlay moveoffer-overlay">
      <div className="reward-panel moveoffer-panel is-learned">
        <div className="offer-hero-head">
          <HeroPortrait heroId={hero.id} className="offer-hero-portrait" />
          <h3>{hero.name}</h3>
        </div>
        <p className="offer-hero-eyebrow">{eyebrow}</p>

        <div className="offer-move-highlight">
          <MoveDetailCard move={moves[moveId]} label="Move learned" caster={caster} terse />
        </div>

        <div className="reward-panel-actions moveoffer-actions">
          <button className="moveoffer-button moveoffer-confirm" onClick={onClose}>
            <span className="moveoffer-icon" aria-hidden="true">
              ✓
            </span>
            <span className="moveoffer-label">Continue</span>
            <span className="moveoffer-sub">{moves[moveId].name} learned</span>
          </button>
        </div>
      </div>
    </div>,
    overlayHost()
  );
}
