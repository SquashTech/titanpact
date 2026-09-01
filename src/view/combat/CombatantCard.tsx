import { useState, type CSSProperties } from 'react';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { Combatant, StatContext, StatusInstance } from '../../engine/state';
import { effectiveTypes, getCombatStatDelta, getMaxHp, getMaxMana } from '../../engine/state';
import { fieldEffects } from '../../data/fieldEffects';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { StatGlyph, STAT_ORDER, hpTier } from '../shared/StatBars';
import { StatusGlyph, statusColor, statusTint, PoisonPips } from '../shared/statusIcons';
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
  'popup-renew': 'renew-hit',
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
  /** Marks this card as the currently-committed choice — the bench hero picked in the forced-replacement panel (FightScreen). Purely a visual highlight, independent of `targetable`. */
  selected?: boolean;
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
  /** Everything a stat read needs beyond the combatant itself (state.ts StatContext): the Field Effect, and the board a conditional passive is measured against. Omitted, the card shows stats with neither hook applied. */
  statCtx?: StatContext;
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
  const n = instance.magnitude ?? instance.duration;
  const color = statusColor(instance.statusId);
  return (
    <span
      className={`status-badge${n !== undefined ? ' status-badge-has-count' : ''}${instance.statusId === 'Conduct' ? ' status-badge-conduct' : ''}`}
      style={{ color, background: statusTint(instance.statusId, 0.16), borderColor: statusTint(instance.statusId, 0.55) }}
      title={`${instance.statusId}${n !== undefined ? ` ${n}` : ''} — hold for details`}
      {...longPress}
    >
      <StatusGlyph statusId={instance.statusId} />
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
 * enhance the hero's effective Stat Total and read as part of their stat block
 * (HeroDetailOverlay), not as a battlefield indicator. Only what a move or
 * passive changes DURING this fight (including a status-pipeline effect like
 * Freeze, docs/conditions.md, halving Speed, or a Field-Effect-pipeline one
 * like Verdant Earth's Attack/Intelligence bonus, docs/field-effects.md)
 * shows up here.
 */
function activeStatMods(hero: HeroDefinition, combatant: Combatant, statCtx: StatContext | undefined): Array<{ stat: StatKey; mod: number }> {
  const fieldEffectCtx = statCtx ?? { active: null, defs: fieldEffects };
  return STAT_ORDER.flatMap((stat) => {
    const mod = getCombatStatDelta(hero, combatant, stat, fieldEffectCtx);
    return mod !== 0 ? [{ stat, mod }] : [];
  });
}

function StatModBadge({ stat, mod }: { stat: StatKey; mod: number }) {
  return (
    <span className={`stat-mod-badge ${mod > 0 ? 'stat-buff' : 'stat-debuff'}`} title={`${stat} ${mod > 0 ? '+' : ''}${mod}`}>
      <StatGlyph stat={stat} tone="inherit" />
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
  acting,
  effBadge,
  compact,
  statCtx,
}: Props) {
  const [inspectingStatus, setInspectingStatus] = useState<string | null>(null);
  const maxHp = getMaxHp(hero, combatant);
  const maxMana = getMaxMana(hero, combatant);
  const hpFraction = Math.max(0, combatant.currentHp / maxHp);
  // Mana is the one resource that can sit ABOVE its maximum (state.ts
  // Combatant.currentMana — Arcane's manaGrant). So the fill is clamped and
  // the surplus gets its own band on top; unclamped, the div simply overflowed
  // its own hidden track and a 210/85 hero looked identical to a full one.
  const manaFraction = maxMana > 0 ? Math.max(0, Math.min(1, combatant.currentMana / maxMana)) : 0;
  const manaOverFraction = maxMana > 0 ? Math.max(0, Math.min(1, (combatant.currentMana - maxMana) / maxMana)) : 0;
  const activeMods = compact || combatant.fainted ? [] : activeStatMods(hero, combatant, statCtx);
  const leftMods = activeMods.slice(0, Math.ceil(activeMods.length / 2));
  const rightMods = activeMods.slice(Math.ceil(activeMods.length / 2));

  const classes = ['combatant-card'];
  if (compact) classes.push('compact');
  if (combatant.fainted) classes.push('fainted');
  if (targetable && !combatant.fainted) classes.push('targetable');
  if (selected) classes.push('selected');
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

  // Targeting always wins; otherwise the whole figure opens its detail sheet.
  // There is no corner "i" affordance any more: it had already been reduced to
  // a chromeless 40%-opacity glyph that read as a smudge on the figure, and it
  // pointed at a gesture the whole card already answers. Tapping the hero *is*
  // the affordance. Target-row cards pass no onInspect, so their behavior is
  // unchanged.
  const canTarget = Boolean(targetable && !combatant.fainted);
  const handleCardClick = canTarget ? onSelectTarget : onInspect;

  return (
    <div
      className={classes.join(' ')}
      style={typeStyle}
      onClick={handleCardClick}
      role={canTarget || onInspect ? 'button' : undefined}
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
      {popup && (
        <div key={popup.key} className={`dmg-popup ${popup.className}`}>
          {popup.text}
        </div>
      )}
      {/* The figure and the ground it stands on. On the battlefield
          (.team-row scope in styles.css) the card's own box is gone, so this
          pair carries the hero's physical presence instead: the portrait
          renders at a clean 2x of its 48px pixel-art source — it was
          previously 56px, a 1.167x scale that made some source pixels 1px
          wide and others 2px — standing on a type-colored ellipse that
          reads as both a shadow and a team-color platform. The ellipse also
          absorbs two cues the card box used to carry: which side (ally
          platforms are wider and brighter, enemy ones smaller and dimmer,
          selling distance across the horizon) and whose turn it is
          (.acting lights the platform rather than outlining a rectangle).
          In the compact/bench pickers the box stays and this is just a
          plain wrapper — see .bench-row/.target-row overrides. */}
      <div className="combatant-stage">
        <span className="combatant-platform" aria-hidden="true" />
        <HeroPortrait heroId={hero.id} seed={combatant.combatantId} className="combatant-portrait" />
      </div>
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
        {/* iconOnly: the hero's own name sits directly beside these, so the
            three-letter code was spending width to repeat what the glyph and
            the fill colour already say — and at card scale it was the smaller,
            harder-to-read half of the pair. The literal answer is still one
            tap away in HeroDetailOverlay, which is where a player who hasn't
            learned the set is headed anyway. */}
        <span className="combatant-types">
          {effectiveTypes(hero, combatant).map((t) => (
            <TypeBadge key={t} type={t} iconOnly />
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
              {manaOverFraction > 0 && <div className="bar-fill mana-over" style={{ width: `${manaOverFraction * 100}%` }} />}
            </div>
            <div className={`bar-label${manaOverFraction > 0 ? ' is-overcharged' : ''}`}>
              MP {combatant.currentMana}/{maxMana}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
