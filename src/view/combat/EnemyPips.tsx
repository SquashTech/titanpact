import { enemies, isGuardianId, isTitanEye } from '../../data/enemies';
import { phaseOf, type CombatState, type Side } from '../../engine/state';

interface Props {
  combat: CombatState;
  side: Side;
}

/** A Guardian, its unsealed twin, the Herald or an Eye — the fight's boss, drawn as a larger mark with the Titan's eye in it. */
function isBoss(heroId: string): boolean {
  return heroId in enemies || isTitanEye(heroId) || isGuardianId(heroId);
}

/**
 * The enemy party as one mark each, in the sky's corner opposite the Menu: lit while it stands, hollow
 * once it falls, in party order so a knockout darkens the mark it always had. A later phase's
 * reserves join once that phase has begun, so the Eyes are not counted before they open.
 */
export function EnemyPips({ combat, side }: Props) {
  const ids = Object.keys(combat.combatants).filter((id) => {
    const c = combat.combatants[id];
    return c.side === side && !c.called && !c.enteredDown;
  });
  const phase = Math.max(0, ...combat.active[side].flatMap((id) => (id ? [phaseOf(combat.combatants[id])] : [])));
  const shown = ids.filter((id) => phaseOf(combat.combatants[id]) <= phase);
  if (shown.length === 0) return null;
  const standing = shown.filter((id) => !combat.combatants[id].fainted).length;
  return (
    <div className="enemy-pips" role="img" aria-label={`${standing} of ${shown.length} enemies standing`}>
      {shown.map((id) => {
        const c = combat.combatants[id];
        return <span key={id} className={`enemy-pip${isBoss(c.heroId) ? ' is-boss' : ''}${c.fainted ? ' is-down' : ''}`} />;
      })}
    </div>
  );
}
