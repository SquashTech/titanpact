import type { HeroDefinition, StatKey } from '../../engine/content';
import type { Combatant } from '../../engine/state';
import { effectiveTypes, getEffectiveStat, getMaxHp, getMaxMana } from '../../engine/state';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { STAT_ICONS, STAT_ORDER } from '../shared/StatBars';

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
  /** This bench hero is the declared replacement for a pending switch action — shown directly on the switch-row picker buttons (FightScreen) so the choice reads at a glance, including when it was made for a *different* active hero than the one currently on screen. */
  switchingIn?: boolean;
  /** This bench hero is already queued as another active hero's replacement, so it can't also be picked here — dims the card and blocks the click independently of `targetable`. */
  locked?: boolean;
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

/**
 * Stat-mod corner badges (glanceable "this hero's stats are off base" cue,
 * separate from the momentary dmg-popup and from opening HeroDetailOverlay).
 * Split the active (non-zero) mods across the two top corners, two per side
 * in the common case, so neither corner outgrows the space the portrait and
 * name leave free — see .stat-mod-corner in styles.css.
 *
 * Derived from getEffectiveStat (effective - base), not combatant.statModifiers
 * alone, so a status-pipeline effect like Blight (docs/conditions.md, applies a
 * multiplicative reduction outside statModifiers) still surfaces a badge here
 * instead of only showing up as a status-name chip.
 */
function activeStatMods(hero: HeroDefinition, combatant: Combatant): Array<{ stat: StatKey; mod: number }> {
  return STAT_ORDER.flatMap((stat) => {
    const mod = getEffectiveStat(hero, combatant, stat) - hero.baseStats[stat];
    return mod !== 0 ? [{ stat, mod }] : [];
  });
}

function StatModBadge({ stat, mod }: { stat: StatKey; mod: number }) {
  return (
    <span className={`stat-mod-badge ${mod > 0 ? 'stat-buff' : 'stat-debuff'}`} title={`${stat} ${mod > 0 ? '+' : ''}${mod}`}>
      {STAT_ICONS[stat]}
      {mod > 0 ? '▲' : '▼'}
    </span>
  );
}

export function CombatantCard({ hero, combatant, targetable, onSelectTarget, onInspect, popup, selected, switchingIn, locked }: Props) {
  const maxHp = getMaxHp(hero, combatant);
  const maxMana = getMaxMana(hero, combatant);
  const hpFraction = Math.max(0, combatant.currentHp / maxHp);
  const manaFraction = maxMana > 0 ? Math.max(0, combatant.currentMana / maxMana) : 0;
  const activeMods = combatant.fainted ? [] : activeStatMods(hero, combatant);
  const leftMods = activeMods.slice(0, Math.ceil(activeMods.length / 2));
  const rightMods = activeMods.slice(Math.ceil(activeMods.length / 2));

  const classes = ['combatant-card'];
  if (combatant.fainted) classes.push('fainted');
  if (targetable && !combatant.fainted && !locked) classes.push('targetable');
  if (selected) classes.push('selected');
  if (locked) classes.push('locked');

  return (
    <div
      className={classes.join(' ')}
      onClick={targetable && !combatant.fainted && !locked ? onSelectTarget : undefined}
      role={targetable && !locked ? 'button' : undefined}
    >
      {leftMods.length > 0 && (
        <div className="stat-mod-corner stat-mod-corner-left">
          {leftMods.map(({ stat, mod }) => (
            <StatModBadge key={stat} stat={stat} mod={mod} />
          ))}
        </div>
      )}
      {rightMods.length > 0 && (
        <div className="stat-mod-corner stat-mod-corner-right">
          {rightMods.map(({ stat, mod }) => (
            <StatModBadge key={stat} stat={stat} mod={mod} />
          ))}
        </div>
      )}
      {combatant.fainted && <span className="fainted-tag">KO</span>}
      {switchingIn && <span className="switching-tag">⇄ Switching In</span>}
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
      <HeroPortrait heroId={hero.id} className="combatant-portrait" />
      <div className="combatant-name">
        <span>{hero.name}</span>
        <span className="combatant-types">
          {effectiveTypes(hero, combatant).map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </span>
      </div>
      {/* Always rendered, even with no active statuses — reserves a fixed row of
          vertical space so a status landing mid-fight doesn't grow the card and
          shove the rest of the battlefield around (docs/architecture.md
          "Resolution and presentation are separate layers"). */}
      <div className="status-badge-row">
        {Object.values(combatant.statuses).map((s) => (
          <span key={s.statusId} className={`status-badge${s.statusId === 'Regen' ? ' status-badge-positive' : ''}`}>
            {statusBadgeText(s.statusId, s.magnitude, s.duration)}
          </span>
        ))}
      </div>
      {/* Wrapped in a `.resource` pair so compact contexts (bench-row) can lay
          HP and MP side by side instead of stacked — `.resource-row`/`.resource`
          are `display: contents` by default, so this changes nothing about the
          full-size card's layout (see .bench-row .resource-row in styles.css). */}
      <div className="resource-row">
        <div className="resource">
          <div className="bar-track">
            <div className={`bar-fill ${hpTier(hpFraction)}`} style={{ width: `${hpFraction * 100}%` }} />
          </div>
          <div className="bar-label">
            HP {Math.max(0, combatant.currentHp)}/{maxHp}
          </div>
        </div>
        <div className="resource">
          <div className="bar-track">
            <div className="bar-fill mana" style={{ width: `${manaFraction * 100}%` }} />
          </div>
          <div className="bar-label">
            MP {combatant.currentMana}/{maxMana}
          </div>
        </div>
      </div>
    </div>
  );
}
