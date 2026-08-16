import type { HeroDefinition } from '../../engine/content';
import type { Combatant } from '../../engine/state';
import { effectiveTypes, getMaxHp, getMaxMana } from '../../engine/state';
import { getTypeColor } from './typeColors';

export interface Popup {
  key: number;
  text: string;
  className: string;
}

interface Props {
  hero: HeroDefinition;
  combatant: Combatant;
  targetable?: boolean;
  onSelectTarget?: () => void;
  onInspect?: () => void;
  popup?: Popup | null;
  /** Marks this card as the currently-committed choice — e.g. the bench hero picked to switch in (FightScreen's switch-row). Purely a visual highlight, independent of `targetable`. */
  selected?: boolean;
}

function hpTier(fraction: number): 'hp-high' | 'hp-mid' | 'hp-low' {
  if (fraction > 0.5) return 'hp-high';
  if (fraction > 0.2) return 'hp-mid';
  return 'hp-low';
}

/** "Burn 20" / "Daze 2" / "Bleed" — magnitude or duration shown when the status carries one, omitted for boolean-shape statuses (docs/conditions.md §1). Regen is the only positive status; everything else reads as a debuff. */
function statusBadgeText(statusId: string, magnitude: number | undefined, duration: number | undefined): string {
  const n = magnitude ?? duration;
  return n !== undefined ? `${statusId} ${n}` : statusId;
}

export function CombatantCard({ hero, combatant, targetable, onSelectTarget, onInspect, popup, selected }: Props) {
  const maxHp = getMaxHp(hero, combatant);
  const maxMana = getMaxMana(hero, combatant);
  const hpFraction = Math.max(0, combatant.currentHp / maxHp);
  const manaFraction = maxMana > 0 ? Math.max(0, combatant.currentMana / maxMana) : 0;

  const classes = ['combatant-card'];
  if (combatant.fainted) classes.push('fainted');
  if (targetable && !combatant.fainted) classes.push('targetable');
  if (selected) classes.push('selected');

  return (
    <div
      className={classes.join(' ')}
      onClick={targetable && !combatant.fainted ? onSelectTarget : undefined}
      role={targetable ? 'button' : undefined}
    >
      {combatant.fainted && <span className="fainted-tag">KO</span>}
      {onInspect && (
        <button
          className="info-button"
          onClick={(e) => {
            e.stopPropagation();
            onInspect();
          }}
          aria-label={`View ${hero.name} details`}
        >
          i
        </button>
      )}
      {popup && (
        <div key={popup.key} className={`dmg-popup ${popup.className}`}>
          {popup.text}
        </div>
      )}
      <div className="combatant-name">
        <span>{hero.name}</span>
        <span className="combatant-types">
          {effectiveTypes(hero, combatant).map((t) => (
            <span key={t} className="type-tag" style={{ color: getTypeColor(t) }}>
              {t}
            </span>
          ))}
        </span>
      </div>
      {Object.values(combatant.statuses).length > 0 && (
        <div className="status-badge-row">
          {Object.values(combatant.statuses).map((s) => (
            <span key={s.statusId} className={`status-badge${s.statusId === 'Regen' ? ' status-badge-positive' : ''}`}>
              {statusBadgeText(s.statusId, s.magnitude, s.duration)}
            </span>
          ))}
        </div>
      )}
      <div className="bar-track">
        <div className={`bar-fill ${hpTier(hpFraction)}`} style={{ width: `${hpFraction * 100}%` }} />
      </div>
      <div className="bar-label">
        HP {Math.max(0, combatant.currentHp)}/{maxHp}
      </div>
      <div className="bar-track">
        <div className="bar-fill mana" style={{ width: `${manaFraction * 100}%` }} />
      </div>
      <div className="bar-label">
        MP {combatant.currentMana}/{maxMana}
      </div>
    </div>
  );
}
