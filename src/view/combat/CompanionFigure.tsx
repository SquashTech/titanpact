import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { allCombatants } from '../../data/content';
import { moves } from '../../data/moves';
import { calledMove, moveForHero, type CombatState, type Side } from '../../engine/state';
import { HeroPortrait } from '../shared/HeroPortrait';
import { overlayHost } from '../shared/overlayHost';
import { EYE_GRADIENT, makeEye } from '../shared/figurePrimitives';
import { MoveDetailCard } from './MoveDetailOverlay';
import { getTypeColor, getTypeColorRgb } from './typeColors';
import { companionCallMoveId, companionHeroId, companionTier } from '../../run/companion';
import type { RunState } from '../../run/state';

const TIER_NAMES = { early: 'Early', mid: 'Mid', late: 'Late' } as const;

/** Where the companion stands this moment: biding its time, acting this round (the telegraph), playing its move, or done for the fight. */
export type CompanionState = 'waiting' | 'intends' | 'acting' | 'spent';

/** The Titan's eye the woken companion opens (docs/companion-call.md §12.4), drawn in the Guardians' own lens. */
function awakenedEyeSvg(uid: string): string {
  const gradient = `${uid}g`;
  return `<svg viewBox="0 0 20 12" xmlns="http://www.w3.org/2000/svg">${EYE_GRADIENT(gradient)}${makeEye(uid, gradient)(10, 6, 5, 'stare')}</svg>`;
}

/**
 * The companion on the field (docs/companion-call.md §12): small, between and behind the pair,
 * never on a slot. It acts on its own; the round it will, it wears a ! from the top of the command
 * phase and takes a seat on the order track. A tap opens its card — the exact move it will cast.
 * Woken, it has opened a Titan eye.
 */
export function CompanionFigure({
  heroId,
  state,
  moveType,
  awakened = false,
  onTap,
}: {
  heroId: string;
  state: CompanionState;
  /** The type its move resolves as, which lights the figure's ground and the !. */
  moveType: string;
  awakened?: boolean;
  onTap?: () => void;
}) {
  const hero = allCombatants[heroId];
  const name = hero?.name ?? 'Companion';
  const label = state === 'intends' ? `${name} — acts this round` : state === 'spent' ? `${name} — has acted` : name;
  return (
    <button
      type="button"
      className={`companion-perch is-${state}${awakened ? ' is-awakened' : ''}`}
      style={{ '--type-rgb': getTypeColorRgb(moveType) } as CSSProperties}
      onClick={onTap}
      disabled={!onTap}
      aria-label={label}
    >
      <span className="companion-perch-ground" aria-hidden="true" />
      <HeroPortrait heroId={heroId} className="companion-perch-portrait" pose={state === 'acting' ? 'attack' : 'idle'} />
      {awakened && <span className="companion-perch-eye" aria-hidden="true" dangerouslySetInnerHTML={{ __html: awakenedEyeSvg('companionEye') }} />}
      {state === 'intends' && (
        <span className="companion-perch-mark" aria-hidden="true">
          !
        </span>
      )}
    </button>
  );
}

/**
 * The companion's card: its one move, read whole against the live board (its own stats, the
 * standing enemies), and when it acts. Nothing to press — it acts on its own. Tap outside to close.
 */
export function CallSheet({
  combat,
  side,
  defenderIds,
  intends,
  onClose,
}: {
  combat: CombatState;
  side: Side;
  /** Enemy combatants still standing, in battlefield order — what the card forecasts against. */
  defenderIds: readonly string[];
  /** It acts this round. */
  intends: boolean;
  onClose: () => void;
}) {
  const call = combat.calls?.[side];
  const caster = call ? combat.combatants[call.combatantId] : undefined;
  const hero = caster ? allCombatants[caster.heroId] : undefined;
  if (!call || !caster || !hero) return null;
  const move = moveForHero(calledMove(call, moves), hero);
  const when = intends
    ? 'Acts this round.'
    : call.remaining <= 0
      ? call.perPhase
        ? 'Has acted. Acts again when the fight turns.'
        : 'Has acted this fight.'
      : 'Acts on its own, once a fight.';

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
            <span className="call-sheet-name">{hero.name}</span>
            <span className="call-sheet-rule">{when}</span>
          </span>
        </div>
        <MoveDetailCard move={move} context={{ combat, attackerId: caster.combatantId, defenderIds }} terse free />
        <div className="detail-close-hint">Tap anywhere to close</div>
      </div>
    </div>,
    overlayHost()
  );
}

/**
 * The companion out of a fight (the Roster's strip): who it is this act, and the move it casts,
 * read as authored — there is no board to forecast against. Tap anywhere to close.
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
            <span className="call-sheet-rule">Acts on its own, once a fight. It grows with the act.</span>
          </span>
        </div>
        <MoveDetailCard move={move} terse free />
        <div className="detail-close-hint">Tap anywhere to close</div>
      </div>
    </div>,
    overlayHost()
  );
}
