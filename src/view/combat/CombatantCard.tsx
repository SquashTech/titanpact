import { useEffect, useState, type CSSProperties } from 'react';
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

// ── Figure animation ────────────────────────────────────────────────────
// Two things happen to the sprite itself, above the card flashes below: the
// actor holds its action frame, and whoever it hits recoils.
//
// Both frames are a STATE, not a one-shot — each is up for as long as the
// console is narrating the line that put it there (the attacker's, from
// buildBeats' `strikeCombatantId`; the target's, from its own damage popup), so
// a player reading at their own pace is still looking at the exchange the text
// is describing. The recoil is the one-shot, and it fires on the beat the
// damage is announced, which is the beat where the attacker's pose is already
// up — so the two read as one exchange with nothing to time against.
//
// Every swap between frames is covered by a flash, because a pixel-art cut
// between two poses with nothing over it reads as a glitch rather than as
// motion: the entry flash is the opening frame of each pose's own animation,
// and the exit gets `.releasing` below, which is the only transition that had
// no animation of its own to hide it.
const HIT_REACT_MS = 460;
const POSE_RELEASE_MS = 240;

/**
 * Sprite-level reaction per popup class. A blow knocks the figure back; a DoT
 * tick only makes it sag, since nothing hit it — but both show the wound,
 * because the frame is chosen off this map being hit at all. Poison sits with
 * the blows rather than with the other two statuses: it does not tick down, it
 * bursts once for everything at the end, and buildBeats says so ("Poison bursts
 * for N damage!").
 */
const POPUP_HIT_CLASS: Record<string, string> = {
  'popup-damage': 'hit-struck',
  'popup-haunt': 'hit-struck',
  'popup-conduct': 'hit-struck',
  'popup-poison': 'hit-struck',
  'popup-crit': 'hit-crit',
  'popup-burn': 'hit-wince',
  'popup-bleed': 'hit-wince',
};

/** True for `ms` after `key` changes to a new non-null value; false again in time for the next one to replay. */
function useOneShot(key: number | null | undefined, ms: number): boolean {
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (key === null || key === undefined) {
      setLive(false);
      return;
    }
    // Off for one frame first. A CSS animation restarts only when its class is
    // removed and re-added, so a second strike arriving while the first is still
    // running would otherwise play nothing at all.
    setLive(false);
    const frame = requestAnimationFrame(() => setLive(true));
    const timer = window.setTimeout(() => setLive(false), ms);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [key, ms]);
  return live;
}

/** Card-level flash class per popup class (styles.css). */
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
  /** Visual highlight for the committed choice in the forced-replacement panel, independent of `targetable`. */
  selected?: boolean;
  /** The player combatant whose move panel is on screen — a pulsing glow instead of a text label. */
  acting?: boolean;
  /** Effectiveness of the move being targeted against THIS hero; `className` is one of the eff-chip tier classes. */
  effBadge?: { text: string; className: string } | null;
  /** Portrait + name + type + effBadge only (targeting panel). */
  compact?: boolean;
  /** This figure is the one mid-move — it holds its action frame until the console moves on (buildBeats' `strikeCombatantId`). */
  striking?: boolean;
  /** Field Effect plus the board a conditional passive reads (state.ts StatContext). Omitted, neither hook applies. */
  statCtx?: StatContext;
}

/** Icon + bare number (magnitude, falling back to duration). A ~500ms hold opens StatusDetailOverlay; a tap only stops propagation. */
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

// getCombatStatDelta (effective − loadout baseline), NOT baselineStatModifiers:
// equipment/relic/Evolution grants read as the hero's stat block, not as a
// battlefield indicator. Only what changed DURING this fight shows here.
function activeStatMods(hero: HeroDefinition, combatant: Combatant, statCtx: StatContext | undefined): Array<{ stat: StatKey; mod: number }> {
  const fieldEffectCtx = statCtx ?? { active: null, defs: fieldEffects };
  return STAT_ORDER.flatMap((stat) => {
    const mod = getCombatStatDelta(hero, combatant, stat, fieldEffectCtx);
    return mod !== 0 ? [{ stat, mod }] : [];
  });
}

type Pose = 'idle' | 'attack' | 'hurt';

/**
 * The pose the figure just left, for as long as the flash covering that swap
 * runs. Entering a pose is masked by the opening frame of the pose's own
 * animation; LEAVING one had nothing, so the frame cut and the drop out of the
 * strike lean both happened raw, on a beat change, with nothing over them.
 *
 * Set during render rather than from an effect on purpose: an effect lands the
 * class one frame after the `src` swap it is there to hide, and one unmasked
 * frame is the entire artifact. React supports this shape for exactly this —
 * the extra render is thrown away before anything is committed.
 */
function usePoseRelease(pose: Pose): Pose | null {
  const [released, setReleased] = useState<Pose | null>(null);
  const [shown, setShown] = useState<Pose>(pose);
  if (shown !== pose) {
    setShown(pose);
    if (pose === 'idle' && shown !== 'idle' && released !== shown) setReleased(shown);
  }
  useEffect(() => {
    if (!released) return;
    const timer = window.setTimeout(() => setReleased(null), POSE_RELEASE_MS);
    return () => window.clearTimeout(timer);
  }, [released]);
  return released;
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
  striking,
}: Props) {
  const [inspectingStatus, setInspectingStatus] = useState<string | null>(null);
  const hitClass = popup ? POPUP_HIT_CLASS[popup.className] : undefined;
  // Keyed on the popup, not on the class: the same figure taking the same kind of hit twice running must replay.
  const struck = useOneShot(hitClass ? popup!.key : null, HIT_REACT_MS);
  // Taking a hit wins over landing one, so a hero that swung and got answered reads as the one who came off worse.
  const pose: Pose = hitClass ? 'hurt' : striking ? 'attack' : 'idle';
  const released = usePoseRelease(pose);
  const maxHp = getMaxHp(hero, combatant);
  const maxMana = getMaxMana(hero, combatant);
  const hpFraction = Math.max(0, combatant.currentHp / maxHp);
  // Mana can exceed its pool (docs/mana.md "Overflow"): fill is clamped, surplus gets its own band.
  const manaFraction = maxMana > 0 ? Math.max(0, Math.min(1, combatant.currentMana / maxMana)) : 0;
  const manaOverFraction = maxMana > 0 ? Math.max(0, Math.min(1, (combatant.currentMana - maxMana) / maxMana)) : 0;
  const activeMods = compact || combatant.fainted ? [] : activeStatMods(hero, combatant, statCtx);
  const modSplit = Math.ceil(activeMods.length / 2);
  const leftMods = activeMods.slice(0, modSplit);
  const rightMods = activeMods.slice(modSplit);

  const classes = ['combatant-card'];
  if (compact) classes.push('compact');
  if (combatant.fainted) classes.push('fainted');
  if (targetable && !combatant.fainted) classes.push('targetable');
  if (selected) classes.push('selected');
  if (acting) classes.push('acting');
  if (effBadge) classes.push(effBadge.className);
  if (popup && POPUP_FLASH_CLASS[popup.className]) classes.push(POPUP_FLASH_CLASS[popup.className]);
  if (striking) classes.push('striking');
  if (struck && hitClass) classes.push(hitClass);
  if (released) classes.push('releasing', `releasing-${released}`);

  // effectiveTypes, not hero.types — a type-graft Evolution should retint the card too.
  const types = effectiveTypes(hero, combatant);
  const primaryType = types[0];
  const typeStyle = { '--type-color': getTypeColor(primaryType), '--type-rgb': getTypeColorRgb(primaryType) } as CSSProperties;

  // Targeting always wins; otherwise tapping the figure opens its detail sheet.
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
      <div className="combatant-stage">
        <span className="combatant-platform" aria-hidden="true" />
        <HeroPortrait
          heroId={hero.id}
          seed={combatant.combatantId}
          className="combatant-portrait"
          pose={pose}
        />
      </div>
      {/* Always rendered so the row reserves its height whether or not this card has a badge. */}
      <div className="eff-badge-row">
        {effBadge && <span className={`eff-chip ${effBadge.className}`}>{effBadge.text}</span>}
      </div>
      <div className="combatant-name">
        <span className="hero-name-text">{hero.name}</span>
        <span className="combatant-types">
          {types.map((t) => (
            <TypeBadge key={t} type={t} iconOnly />
          ))}
        </span>
      </div>
      {/* Always rendered (outside compact) so a status landing mid-fight doesn't grow the card. */}
      {!compact && (
        <div className="status-badge-row">
          {Object.values(combatant.statuses).flatMap((s) => {
            // A duration-shape status can sit at 0 until the next start-of-round tick removes it.
            if (s.duration !== undefined && s.duration <= 0) return [];
            // Net out the loadout portion of a magnitude grant (baselineStatusMagnitudes) — that is not a combat indicator.
            if (s.magnitude === undefined) {
              return [<StatusChip key={s.statusId} instance={s} onInspect={() => setInspectingStatus(s.statusId)} />];
            }
            const shown = s.magnitude - (combatant.baselineStatusMagnitudes[s.statusId] ?? 0);
            if (shown <= 0) return [];
            return [<StatusChip key={s.statusId} instance={{ ...s, magnitude: shown }} onInspect={() => setInspectingStatus(s.statusId)} />];
          })}
        </div>
      )}
      {inspectingStatus && combatant.statuses[inspectingStatus] && (
        <StatusDetailOverlay instance={combatant.statuses[inspectingStatus]} onClose={() => setInspectingStatus(null)} />
      )}
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
