import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { allCombatants } from '../../data/content';
import { moves } from '../../data/moves';
import { moveForHero, type CombatState, type Side } from '../../engine/state';
import { HeroPortrait } from '../shared/HeroPortrait';
import { overlayHost } from '../shared/overlayHost';
import { MoveDetailCard } from './MoveDetailOverlay';
import { getTypeColor, getTypeColorRgb } from './typeColors';
import { companionCallMoveId, companionHeroId, companionTier } from '../../run/companion';
import type { RunState } from '../../run/state';
import { PlateButton } from '../shared/PlateButton';

const TIER_NAMES = { early: 'Early', mid: 'Mid', late: 'Late' } as const;

/** Where the Call stands this moment: lit and waiting, committed this round, playing its move, or spent for the fight. */
export type CompanionState = 'ready' | 'queued' | 'acting' | 'spent';

/**
 * The companion on the field (docs/companion-call.md §8): small, behind the pair, never on a slot.
 * Lit with an idle bob while a Call is left, dimmed once spent; it leaps in on the beat its move
 * plays. A tap opens the Call card — or, with a Call committed this round, takes it back.
 */
export function CompanionFigure({
  heroId,
  state,
  moveType,
  onTap,
}: {
  heroId: string;
  state: CompanionState;
  /** The Call move's type, which lights the figure's ground and the queued mark. */
  moveType: string;
  onTap?: () => void;
}) {
  const hero = allCombatants[heroId];
  const label =
    state === 'queued' ? `${hero?.name ?? 'Companion'} — Called this round; tap to take it back` : `${hero?.name ?? 'Companion'} — Call`;
  return (
    <button
      type="button"
      className={`companion-perch is-${state}`}
      style={{ '--type-rgb': getTypeColorRgb(moveType) } as CSSProperties}
      onClick={onTap}
      disabled={!onTap}
      aria-label={label}
    >
      <span className="companion-perch-ground" aria-hidden="true" />
      <HeroPortrait heroId={heroId} className="companion-perch-portrait" pose={state === 'acting' ? 'attack' : 'idle'} />
      {state === 'queued' && (
        <span className="companion-perch-mark" aria-hidden="true">
          ✦
        </span>
      )}
    </button>
  );
}

/**
 * The Call card: the companion's one move, read whole against the live board (its own stats, the
 * standing enemies), and one button. Pressing it commits the Call as the acting hero's action — no
 * target, since a Call move never asks for one. Tap outside to close.
 */
export function CallSheet({
  combat,
  side,
  defenderIds,
  callerName,
  refusal,
  onCall,
  onClose,
}: {
  combat: CombatState;
  side: Side;
  /** Enemy combatants still standing, in battlefield order — what the card forecasts against. */
  defenderIds: readonly string[];
  /** The hero whose turn would be spent, for the button. */
  callerName: string | null;
  /** Why the Call cannot be made right now, or null when it can. */
  refusal: string | null;
  onCall: () => void;
  onClose: () => void;
}) {
  const call = combat.calls?.[side];
  const caster = call ? combat.combatants[call.combatantId] : undefined;
  const hero = caster ? allCombatants[caster.heroId] : undefined;
  if (!call || !caster || !hero) return null;
  const move = moveForHero(moves[call.moveId], hero);

  return createPortal(
    <div className="detail-overlay" onClick={onClose}>
      <div
        className="detail-panel move-detail-panel call-sheet"
        style={{ borderTopColor: getTypeColor(move.type), '--move-type-rgb': getTypeColorRgb(move.type) } as CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="call-sheet-head">
          <HeroPortrait heroId={hero.id} className="call-sheet-portrait" />
          <span className="call-sheet-ident">
            <span className="call-sheet-name">{hero.name}</span>
            <span className="call-sheet-rule">A hero can spend its turn to Call it, once a fight.</span>
          </span>
        </div>
        <MoveDetailCard move={move} context={{ combat, attackerId: caster.combatantId, defenderIds }} terse free />
        <PlateButton className="call-sheet-button" tint={getTypeColor(hero.types[0])} disabled={refusal !== null} onClick={onCall}>
          {refusal ?? (callerName ? `${callerName} calls ${hero.name}` : `Call ${hero.name}`)}
        </PlateButton>
      </div>
    </div>,
    overlayHost()
  );
}

/**
 * The companion out of a fight (the Roster's strip): who it is this act, and the move its Call
 * casts, read as authored — there is no board to forecast against. Tap anywhere to close.
 */
export function CompanionDossier({ run, onClose }: { run: RunState; onClose: () => void }) {
  const heroId = companionHeroId(run);
  const moveId = companionCallMoveId(run);
  const hero = heroId ? allCombatants[heroId] : undefined;
  const move = moveId ? moves[moveId] : undefined;
  if (!hero || !move) return null;
  return createPortal(
    <div className="detail-overlay" onClick={onClose}>
      <div
        className="detail-panel move-detail-panel call-sheet"
        style={{ borderTopColor: getTypeColor(move.type), '--move-type-rgb': getTypeColorRgb(move.type) } as CSSProperties}
        onClick={onClose}
      >
        <div className="call-sheet-head">
          <HeroPortrait heroId={hero.id} className="call-sheet-portrait" />
          <span className="call-sheet-ident">
            <span className="call-sheet-name">
              {hero.name} · {TIER_NAMES[companionTier(run.actNumber, run.cycle)]}
            </span>
            <span className="call-sheet-rule">A hero can spend its turn to Call it, once a fight. It grows with the act.</span>
          </span>
        </div>
        <MoveDetailCard move={move} terse free />
        <div className="detail-close-hint">Tap anywhere to close</div>
      </div>
    </div>,
    overlayHost()
  );
}
