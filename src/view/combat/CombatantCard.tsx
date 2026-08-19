import { useState } from 'react';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { Combatant, StatusInstance } from '../../engine/state';
import { effectiveTypes, getEffectiveStat, getMaxHp, getMaxMana } from '../../engine/state';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { STAT_ICONS, STAT_ORDER } from '../shared/StatBars';
import { statusEmoji, statusColor, statusTint, PoisonPips } from '../shared/statusIcons';
import { useLongPress } from '../shared/MoveTile';
import { StatusDetailOverlay } from './StatusDetailOverlay';

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
  /** Marks this card as the currently-committed choice — e.g. the bench hero picked to switch in (FightScreen's switch-in picker overlay). Purely a visual highlight, independent of `targetable`. */
  selected?: boolean;
  /** This bench hero is the declared replacement for a pending switch action — shown directly on the switch-in picker overlay's cards (FightScreen) so the choice reads at a glance, including when it was made for a *different* active hero than the one currently on screen. */
  switchingIn?: boolean;
  /** This bench hero is already queued as another active hero's replacement, so it can't also be picked here — dims the card and blocks the click independently of `targetable`. */
  locked?: boolean;
  /** This is the player combatant whose move panel is currently on screen (FightScreen) — a pulsing glow replaces the old "X's move" text label, so the cue costs no vertical space. */
  acting?: boolean;
}

function hpTier(fraction: number): 'hp-high' | 'hp-mid' | 'hp-low' {
  if (fraction > 0.5) return 'hp-high';
  if (fraction > 0.2) return 'hp-mid';
  return 'hp-low';
}

/**
 * Icon + bare number (magnitude, falling back to duration) for a single
 * active status — replaces the old word+number text badge so the row reads
 * at a glance and stays legible at bench-card scale. Tinted with the
 * status's own identity color (statusIcons.tsx statusColor) rather than a
 * uniform debuff-red, so the badge reads as "which status" by color alone.
 * The icon alone can't carry everything a player might need (how it clears,
 * what it actually does), so a ~500ms hold opens StatusDetailOverlay with
 * the full readout; a plain tap only stops propagation so it can't fall
 * through to the card's own onSelectTarget (see useLongPress in MoveTile.tsx).
 */
function StatusChip({ instance, onInspect }: { instance: StatusInstance; onInspect: () => void }) {
  const longPress = useLongPress(onInspect);
  const emoji = statusEmoji[instance.statusId];
  const n = instance.magnitude ?? instance.duration;
  const color = statusColor(instance.statusId);
  return (
    <span
      className={`status-badge${n !== undefined ? ' status-badge-has-count' : ''}${instance.statusId === 'Conduct' ? ' status-badge-conduct' : ''}`}
      style={{ color, background: statusTint(instance.statusId, 0.16), borderColor: statusTint(instance.statusId, 0.55) }}
      title={`${instance.statusId}${n !== undefined ? ` ${n}` : ''} — hold for details`}
      {...longPress}
    >
      <span className="status-emoji">{emoji ?? instance.statusId.slice(0, 1)}</span>
      {n !== undefined && <span className="status-badge-count">{n}</span>}
      {instance.statusId === 'Poison' && <PoisonPips duration={instance.duration} />}
    </span>
  );
}

/**
 * Stat-mod corner badges (glanceable "this hero's stats are off base" cue,
 * separate from the momentary dmg-popup and from opening HeroDetailOverlay).
 * Split the active (non-zero) mods across the two top corners, two per side
 * in the common case, so neither corner outgrows the space the portrait and
 * name leave free — see .stat-mod-corner in styles.css.
 *
 * Derived from getEffectiveStat (effective - base), not combatant.statModifiers
 * alone, so a status-pipeline effect like Freeze (docs/conditions.md, halves
 * Speed outside statModifiers) still surfaces a badge here instead of only
 * showing up as a status-name chip.
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

export function CombatantCard({ hero, combatant, targetable, onSelectTarget, onInspect, popup, selected, switchingIn, locked, acting }: Props) {
  const [inspectingStatus, setInspectingStatus] = useState<string | null>(null);
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
  if (acting) classes.push('acting');
  // Conduct's detonation beat (buildBeats.ts) — keyed fresh with the popup so
  // the flash restarts even if Conduct detonates twice in a row.
  if (popup?.className === 'popup-conduct') classes.push('zap-hit');

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
        {Object.values(combatant.statuses)
          // A duration-shape status (Stealth) can sit at duration 0 for the rest of
          // its last protected round before the next start-of-round tick actually
          // removes it (statusEngine.ts tickStartOfRound) — hide the chip the moment
          // it hits 0 rather than showing a stale "0" badge for that whole round.
          .filter((s) => s.duration === undefined || s.duration > 0)
          .map((s) => (
            <StatusChip key={s.statusId} instance={s} onInspect={() => setInspectingStatus(s.statusId)} />
          ))}
      </div>
      {inspectingStatus && combatant.statuses[inspectingStatus] && (
        <StatusDetailOverlay instance={combatant.statuses[inspectingStatus]} onClose={() => setInspectingStatus(null)} />
      )}
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
