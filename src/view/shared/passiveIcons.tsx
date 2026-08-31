import type { PassiveDefinition } from '../../engine/content';

/**
 * Emoji glyph per passive id — same discipline as statusIcons.tsx's
 * statusEmoji (crisp at badge scale, no pixel-art downscaling). A passive
 * with no entry here just renders without an icon rather than a placeholder
 * glyph, so new content never needs an art pass before it's playable.
 */
export const passiveEmoji: Record<string, string> = {
  sanguine: '🩸',
  emberheart: '🔥',
  imposingPresence: '👁️',
};

/** Identity color per passive, same purpose as statusIcons.tsx's STATUS_COLOR — a passive chip reads as "which passive" by color alone, not just its emoji. Unlisted ids fall back to a neutral gold, same fallback statusColor uses. */
const PASSIVE_COLOR: Record<string, string> = {
  sanguine: '#c0392b',
  emberheart: '#e2683c',
  imposingPresence: '#7d6bc4',
};

export function passiveColor(passiveId: string): string {
  return PASSIVE_COLOR[passiveId] ?? '#d9a441';
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `rgba(...)` tint of a passive's color, for chip backgrounds/borders — mirrors statusIcons.tsx statusTint exactly. */
export function passiveTint(passiveId: string, alpha: number): string {
  const [r, g, b] = hexToRgb(passiveColor(passiveId));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** One line of prose for what a Passive actually does — for content whose effect isn't fully captured by `description` alone (currently just damage-modifier passives, whose bonus % is data rather than authored prose). Reused by HeroDetailOverlay's inspect popup and ReferenceOverlay's static catalog so the two never drift. */
export function passiveEffectSummary(def: PassiveDefinition): string | undefined {
  if (def.damageModifier) {
    const pct = Math.round(def.damageModifier.amount * 100);
    return `Damage bonus: +${pct}%.`;
  }
  return undefined;
}

/**
 * Fixed detail readout for one Passive — mirrors MoveInfoPanel/
 * EquipmentInfoPanel's fixed-box-regardless-of-content convention (same
 * `.move-info-panel` styling, so tapping between a move/item/passive popup
 * never reflows the panel beneath it). Reused both by HeroDetailOverlay
 * (inspecting a held Passive) and by an item's popup (inspecting a granted
 * one) — the content is identical either way.
 */
export function PassiveInfoPanel({ passive }: { passive: PassiveDefinition | null }) {
  return (
    <div className="move-info-panel">
      {passive ? (
        <>
          <div className="move-info-head">
            <span className="move-info-name">
              {passiveEmoji[passive.id] ? `${passiveEmoji[passive.id]} ` : ''}
              {passive.name}
            </span>
          </div>
          <div className="move-info-placeholder">{passive.description}</div>
          {passiveEffectSummary(passive) && <div className="move-info-placeholder">{passiveEffectSummary(passive)}</div>}
        </>
      ) : (
        <div className="move-info-placeholder">No passive selected.</div>
      )}
    </div>
  );
}
