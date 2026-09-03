import type { ReactNode } from 'react';
import type { PassiveDefinition, PassiveEffect, StatKey } from '../../engine/content';
import { STAT_ORDER } from '../../engine/content';
import { passives } from '../../data/passives';
import { fieldEffects } from '../../data/fieldEffects';
import { statuses } from '../../data/statuses';
import { getTypeColor } from '../combat/typeColors';
import { ELEMENT_PATHS } from './elementIcons';
import { SECTION_PATHS } from './sectionIcons';
import { StatGlyph, STAT_COLORS, STAT_PATHS } from './statIcons';
import { STAT_LABELS } from './StatBars';
import { hexTint, STATUS_PATHS, statusColor } from './statusIcons';

// Two marks the shared vocabularies don't already carry. Same contract as STATUS_PATHS:
// 24x24, `currentColor` only, nothing finer than ~2 units.

/** Rank chevrons — the Class mark. Classes are stat grants alone, so nothing else identifies them. */
const CLASS_CHEVRONS = (
  <g fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12.4 12 5l8 7.4" />
    <path d="M4 19.4 12 12l8 7.4" />
  </g>
);

/** Three sparkles, largest first — "scoured clean". One alone is the Intelligence spark. */
const CLEANSE_SPARKLE = (
  <>
    <path d="M9.6 1.8c.6 4.9 3.2 7.5 8.1 8.1-4.9.6-7.5 3.2-8.1 8.1-.6-4.9-3.2-7.5-8.1-8.1 4.9-.6 7.5-3.2 8.1-8.1Z" />
    <path d="M18.2 12.4c.3 2.9 1.7 4.3 4.6 4.6-2.9.3-4.3 1.7-4.6 4.6-.3-2.9-1.7-4.3-4.6-4.6 2.9-.3 4.3-1.7 4.6-4.6Z" />
    <path d="M4.8 16.6c.2 1.9 1.1 2.8 3 3-1.9.2-2.8 1.1-3 3-.2-1.9-1.1-2.8-3-3 1.9-.2 2.8-1.1 3-3Z" />
  </>
);

const FALLBACK_COLOR = '#d9a441';

interface PassiveArt {
  path: ReactNode;
  color: string;
}

function elementArt(type: string | undefined): PassiveArt | undefined {
  if (!type || !ELEMENT_PATHS[type]) return undefined;
  return { path: ELEMENT_PATHS[type], color: getTypeColor(type) };
}

function statusArt(statusId: string | undefined): PassiveArt | undefined {
  if (!statusId || !STATUS_PATHS[statusId]) return undefined;
  return { path: STATUS_PATHS[statusId], color: statusColor(statusId) };
}

function statArt(stat: StatKey | readonly StatKey[] | undefined): PassiveArt | undefined {
  // A multi-stat delta (Afterglow's Attack and Intelligence) is drawn by its first stat.
  const key: StatKey | undefined = typeof stat === 'string' ? stat : stat?.[0];
  if (!key || !STAT_PATHS[key]) return undefined;
  return { path: STAT_PATHS[key], color: STAT_COLORS[key] };
}

/** The reactive effect is what the passive DOES, so it — not the trigger — is what the glyph draws. */
function reactiveArt(effect: PassiveEffect): PassiveArt | undefined {
  switch (effect.kind) {
    case 'applyStatus':
      return statusArt(effect.statusId);
    case 'heal':
      return statArt('hp');
    case 'statDelta':
      return statArt(effect.stat);
    case 'manaGrant':
      return statArt('manaPool');
    case 'cleanse':
      return { path: CLEANSE_SPARKLE, color: STAT_COLORS.wisdom };
    case 'setFieldEffect':
      return elementArt(fieldEffects[effect.fieldEffectId]?.flavorType);
  }
}

/** The stat a Class leads with — highest grant, ties broken by STAT_ORDER — which is what colours its chevrons. */
function dominantStat(grants: Partial<Record<StatKey, number>>): StatKey | undefined {
  let best: StatKey | undefined;
  for (const stat of STAT_ORDER) {
    if (!grants[stat]) continue;
    if (best === undefined || grants[stat]! > grants[best]!) best = stat;
  }
  return best;
}

/**
 * Glyph and identity colour, DERIVED from what the passive is made of rather than authored per id:
 * a type-locked damage bonus wears its element, a status-applying reaction wears that status, a
 * stat reaction wears that stat, a Class wears chevrons in its lead stat's colour. Nothing needs a
 * table entry to look like itself, so new content is drawn the moment it is written.
 */
function passiveArt(def: PassiveDefinition | undefined): PassiveArt {
  const derived =
    (def?.damageModifier && elementArt(def.damageModifier.eventFieldEquals?.moveType)) ||
    statusArt(def?.conditionalStatGrants?.requiresEnemyStatus) ||
    (def?.reactive && reactiveArt(def.reactive.effect)) ||
    (def?.statGrants && { path: CLASS_CHEVRONS, color: STAT_COLORS[dominantStat(def.statGrants) ?? 'attack'] });
  return derived || { path: SECTION_PATHS.passives, color: FALLBACK_COLOR };
}

/** The one place a passive glyph is drawn. `aria-hidden`: every caller states the name in text beside it. */
export function PassiveGlyph({ passiveId, className }: { passiveId: string; className?: string }) {
  const { path } = passiveArt(passives[passiveId]);
  return (
    <svg
      className={`status-glyph${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {path}
    </svg>
  );
}

export function passiveColor(passiveId: string): string {
  return passiveArt(passives[passiveId]).color;
}

export function passiveTint(passiveId: string, alpha: number): string {
  return hexTint(passiveColor(passiveId), alpha);
}

/** How the passive reaches the board — the Passive counterpart of statusIcons' pipelineLabel. */
export function passiveKindLabel(def: PassiveDefinition): string {
  if (def.reactive) return def.reactive.oncePerFight ? 'Reactive · once per fight' : 'Reactive';
  if (def.damageModifier) return 'Damage pipeline';
  if (def.conditionalStatGrants) return 'Conditional';
  return 'Always on';
}

/** Flat and conditional stat grants as `[stat, amount]` pairs; the conditional ones are the tail. */
export function passiveStatGrants(def: PassiveDefinition): [StatKey, number][] {
  const flat = Object.entries(def.statGrants ?? {}) as [StatKey, number][];
  const conditional = Object.entries(def.conditionalStatGrants?.statGrants ?? {}) as [StatKey, number][];
  return [...flat, ...conditional].filter(([, amount]) => amount !== 0);
}

/**
 * The one line `description` doesn't already carry. Every damage-modifier passive spells its own
 * bonus out in prose, so that case is a CHIP (below) rather than a second sentence saying the same
 * thing; what prose leaves out is that a conditional grant reads the ACTIVE slots only.
 */
export function passiveEffectSummary(def: PassiveDefinition): string | undefined {
  if (!def.conditionalStatGrants) return undefined;
  const status = statuses[def.conditionalStatGrants.requiresEnemyStatus];
  const name = status?.name ?? def.conditionalStatGrants.requiresEnemyStatus;
  return `Only an enemy on the field counts — a benched ${name} carrier does nothing.`;
}

/** Grant chips, in the same `.detail-modifier-chip` vocabulary EquipmentInfoPanel uses for an item's. */
export function PassiveStatChips({ def }: { def: PassiveDefinition }) {
  const grants = passiveStatGrants(def);
  const modifier = def.damageModifier;
  if (grants.length === 0 && !modifier) return null;
  return (
    <div className="detail-modifier-list">
      {grants.map(([stat, amount]) => (
        <span key={stat} className={`detail-modifier-chip ${amount > 0 ? 'stat-buff' : 'stat-debuff'}`}>
          <StatGlyph stat={stat} tone="inherit" /> {STAT_LABELS[stat]} {amount > 0 ? `+${amount}` : amount}
        </span>
      ))}
      {/* The description says "20% bonus damage" in prose; this is the same fact as a number to scan. */}
      {modifier && (
        <span className="detail-modifier-chip stat-buff">
          {modifier.eventFieldEquals?.moveType ?? 'All'} damage +{Math.round(modifier.amount * 100)}%
        </span>
      )}
    </div>
  );
}


/**
 * Full readout for one passive, opened from any passive chip. Same head/medallion/description
 * shape as StatusDetailOverlay's panel, so the two content types read as one family — and the
 * same fixed `.move-info-panel` box, so swapping between passives never reflows the popup.
 */
export function PassiveInfoPanel({ passive }: { passive: PassiveDefinition | null }) {
  if (!passive) {
    return (
      <div className="move-info-panel passive-info-panel">
        <div className="move-info-placeholder">No passive selected.</div>
      </div>
    );
  }
  const color = passiveColor(passive.id);
  const summary = passiveEffectSummary(passive);
  return (
    <div className="move-info-panel passive-info-panel" style={{ borderColor: color }}>
      <div className="passive-info-head">
        <span className="passive-info-icon" style={{ color, background: passiveTint(passive.id, 0.16) }}>
          <PassiveGlyph passiveId={passive.id} />
        </span>
        <div className="passive-info-titles">
          <div className="passive-info-name" style={{ color }}>
            {passive.name}
          </div>
          <div className="passive-info-kind">{passiveKindLabel(passive)}</div>
        </div>
      </div>
      <div className="passive-info-desc">{passive.description}</div>
      <PassiveStatChips def={passive} />
      {summary && <div className="passive-info-meta">{summary}</div>}
    </div>
  );
}
