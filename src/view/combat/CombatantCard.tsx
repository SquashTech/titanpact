import type { HeroDefinition } from '../../engine/content';
import type { Combatant } from '../../engine/state';
import { effectiveTypes, getMaxHp, getMaxMana } from '../../engine/state';
import { getTypeColor } from './typeColors';

interface Props {
  hero: HeroDefinition;
  combatant: Combatant;
  targetable?: boolean;
  onSelectTarget?: () => void;
}

function hpTier(fraction: number): 'hp-high' | 'hp-mid' | 'hp-low' {
  if (fraction > 0.5) return 'hp-high';
  if (fraction > 0.2) return 'hp-mid';
  return 'hp-low';
}

export function CombatantCard({ hero, combatant, targetable, onSelectTarget }: Props) {
  const maxHp = getMaxHp(hero, combatant);
  const maxMana = getMaxMana(hero, combatant);
  const hpFraction = Math.max(0, combatant.currentHp / maxHp);
  const manaFraction = maxMana > 0 ? Math.max(0, combatant.currentMana / maxMana) : 0;

  const classes = ['combatant-card'];
  if (combatant.fainted) classes.push('fainted');
  if (targetable && !combatant.fainted) classes.push('targetable');

  return (
    <div
      className={classes.join(' ')}
      onClick={targetable && !combatant.fainted ? onSelectTarget : undefined}
      role={targetable ? 'button' : undefined}
    >
      {combatant.fainted && <span className="fainted-tag">KO</span>}
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
