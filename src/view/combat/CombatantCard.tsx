import { useState, type CSSProperties } from 'react';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { ActiveFieldEffect, Combatant, StatusInstance } from '../../engine/state';
import { effectiveTypes, getCombatStatDelta, getMaxHp, getMaxMana } from '../../engine/state';
import { fieldEffects } from '../../data/fieldEffects';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { STAT_ICONS, STAT_ORDER, hpTier } from '../shared/StatBars';
import { statusEmoji, statusColor, statusTint, PoisonPips } from '../shared/statusIcons';
import { useLongPress } from '../shared/MoveTile';
import { StatusDetailOverlay } from './StatusDetailOverlay';
import { getTypeColor, getTypeColorRgb } from './typeColors';

export interface Popup {
  key: number;
  text: string;
  className: string;
}

/**
 * Card-level flash on the beat each of these pops (buildBeats.ts) — keyed off
 * the popup's className the same way Conduct's zap-hit originally was, just
 * generalized to a lookup so each status gets its own animated identity
 * (styles.css) without a growing chain of className checks here.
 */
const POPUP_FLASH_CLASS: Record<string, string> = {
  'popup-damage': 'impact-hit',
  'popup-crit': 'crit-hit',
  'popup-heal': 'heal-hit',
  'popup-conduct': 'zap-hit',
  'popup-burn': 'burn-hit',
  'popup-bleed': 'bleed-hit',
  'popup-poison': 'poison-hit',
  'popup-regen': 'regen-hit',
  'popup-haunt': 'haunt-hit',
  'popup-passive-heal': 'passive-heal-hit',
};

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
  /** Type-effectiveness readout for the move currently being targeted (FightScreen's bottom targeting panel) — the multiplier of that move against THIS card's hero, so the matchup is visible right where the player commits to a target instead of only back in the move grid. `className` is one of the eff-chip tier classes (FightScreen's multClass): eff-quad-super/eff-super/eff-neutral/eff-resist/eff-quad-resist. */
  effBadge?: { text: string; className: string } | null;
  /** Strips HP/MP bars, status chips, and stat-mod corner badges down to
   * portrait + name + type + effBadge — the targeting panel (FightScreen)
   * already shows full HP/MP/statuses on the battlefield cards behind it, so
   * repeating them here was pure redundancy bloating the target-picker boxes. */
  compact?: boolean;
  /** The battlefield's current Field Effect, if any (docs/field-effects.md) — threaded into activeStatMods so a Verdant Earth-boosted Attack/Intelligence badges here like any other combat-only stat delta. Defaults to null (no bonus) for callers that don't pass it. */
  activeFieldEffect?: ActiveFieldEffect | null;
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
 * Derived from getCombatStatDelta (effective - loadout baseline), NOT
 * combatant.baselineStatModifiers — equipment/relic/Evolution/Class grants
 * enhance the hero's effective BST and read as part of their stat block
 * (HeroDetailOverlay), not as a battlefield indicator. Only what a move or
 * passive changes DURING this fight (including a status-pipeline effect like
 * Freeze, docs/conditions.md, halving Speed, or a Field-Effect-pipeline one
 * like Verdant Earth's Attack/Intelligence bonus, docs/field-effects.md)
 * shows up here.
 */
function activeStatMods(hero: HeroDefinition, combatant: Combatant, activeFieldEffect: ActiveFieldEffect | null): Array<{ stat: StatKey; mod: number }> {
  const fieldEffectCtx = { active: activeFieldEffect, defs: fieldEffects };
  return STAT_ORDER.flatMap((stat) => {
    const mod = getCombatStatDelta(hero, combatant, stat, fieldEffectCtx);
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

export function CombatantCard({
  hero,
  combatant,
  targetable,
  onSelectTarget,
  onInspect,
  popup,
  selected,
  switchingIn,
  locked,
  acting,
  effBadge,
  compact,
  activeFieldEffect = null,
}: Props) {
  const [inspectingStatus, setInspectingStatus] = useState<string | null>(null);
  const maxHp = getMaxHp(hero, combatant);
  const maxMana = getMaxMana(hero, combatant);
  const hpFraction = Math.max(0, combatant.currentHp / maxHp);
  const manaFraction = maxMana > 0 ? Math.max(0, combatant.currentMana / maxMana) : 0;
  const activeMods = compact || combatant.fainted ? [] : activeStatMods(hero, combatant, activeFieldEffect);
  const leftMods = activeMods.slice(0, Math.ceil(activeMods.length / 2));
  const rightMods = activeMods.slice(Math.ceil(activeMods.length / 2));

  const classes = ['combatant-card'];
  if (compact) classes.push('compact');
  if (combatant.fainted) classes.push('fainted');
  if (targetable && !combatant.fainted && !locked) classes.push('targetable');
  if (selected) classes.push('selected');
  if (locked) classes.push('locked');
  if (acting) classes.push('acting');
  // Retints the .targetable glow (styles.css) to match the effectiveness
  // tier so the enemy box itself reads as "great target" / "bad target" at
  // a glance, not just the text badge inside it.
  if (effBadge) classes.push(effBadge.className);
  // Keyed fresh with the popup so the flash restarts even if the same status
  // ticks/detonates twice in a row.
  if (popup && POPUP_FLASH_CLASS[popup.className]) classes.push(POPUP_FLASH_CLASS[popup.className]);

  // Primary type (effectiveTypes, not hero.types — a type-graft Evolution
  // should retint the card too) drives the card's accent color, so each box
  // reads as "which hero's power" at a glance instead of a uniform gray tin
  // that only differed by ally/enemy row position.
  const primaryType = effectiveTypes(hero, combatant)[0];
  const typeStyle = { '--type-color': getTypeColor(primaryType), '--type-rgb': getTypeColorRgb(primaryType) } as CSSProperties;

  return (
    <div
      className={classes.join(' ')}
      style={typeStyle}
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
      {/* The move-being-targeted's effectiveness against THIS card's hero
          (FightScreen's bottom targeting panel) — sits below the portrait,
          above the name/type line. Always rendered (like .status-badge-row
          below) so its row reserves the same height whether or not this
          particular card has a badge — otherwise cards with a non-neutral
          matchup grow taller than their neutral-matchup neighbors and the
          whole target row's HP/MP bars end up misaligned. */}
      <div className="eff-badge-row">
        {effBadge && <span className={`eff-chip ${effBadge.className}`}>{effBadge.text}</span>}
      </div>
      <div className="combatant-name">
        <span className="hero-name-text">{hero.name}</span>
        <span className="combatant-types">
          {effectiveTypes(hero, combatant).map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </span>
      </div>
      {/* Always rendered, even with no active statuses — reserves a fixed row of
          vertical space so a status landing mid-fight doesn't grow the card and
          shove the rest of the battlefield around (docs/architecture.md
          "Resolution and presentation are separate layers"). Skipped entirely
          in `compact` mode — the targeting panel doesn't show statuses, and
          the battlefield card behind it already reserves this space. */}
      {!compact && (
        <div className="status-badge-row">
          {Object.values(combatant.statuses)
            // A duration-shape status (Stealth) can sit at duration 0 for the rest of
            // its last protected round before the next start-of-round tick actually
            // removes it (statusEngine.ts tickStartOfRound) — hide the chip the moment
            // it hits 0 rather than showing a stale "0" badge for that whole round.
            .filter((s) => s.duration === undefined || s.duration > 0)
            // A magnitude-shape grant like Elemental Force can come entirely from
            // equipment/relics (buildCombatState.ts baselineStatusMagnitudes) — that
            // portion is loadout, not a combat indicator, so net it out and drop the
            // chip if nothing was added by a move/passive during THIS fight.
            .filter((s) => s.magnitude === undefined || s.magnitude - (combatant.baselineStatusMagnitudes[s.statusId] ?? 0) > 0)
            .map((s) => {
              const displayInstance =
                s.magnitude !== undefined ? { ...s, magnitude: s.magnitude - (combatant.baselineStatusMagnitudes[s.statusId] ?? 0) } : s;
              return <StatusChip key={s.statusId} instance={displayInstance} onInspect={() => setInspectingStatus(s.statusId)} />;
            })}
        </div>
      )}
      {inspectingStatus && combatant.statuses[inspectingStatus] && (
        <StatusDetailOverlay instance={combatant.statuses[inspectingStatus]} onClose={() => setInspectingStatus(null)} />
      )}
      {/* Wrapped in a `.resource` pair so compact contexts (bench-row) can lay
          HP and MP side by side instead of stacked — `.resource-row`/`.resource`
          are `display: contents` by default, so this changes nothing about the
          full-size card's layout (see .bench-row .resource-row in styles.css).
          Dropped entirely in `compact` mode (targeting panel) — HP/MP are
          already visible on the battlefield card this panel sits above. */}
      {!compact && (
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
      )}
    </div>
  );
}
