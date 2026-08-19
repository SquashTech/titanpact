/**
 * Emoji glyph per status id — crisp at any size (unlike the pixel-art PNGs
 * this replaced, which turned to noise once downscaled to badge size).
 * Shared by CombatantCard's compact badge and StatusDetailOverlay's larger
 * readout, plus HeroDetailOverlay's status chip, so all three stay in sync.
 */
export const statusEmoji: Record<string, string> = {
  Burn: '🔥',
  Bleed: '🩸',
  Freeze: '❄️',
  Daze: '💫',
  Regen: '💚',
  Conduct: '⚡',
  Poison: '🧪',
  Haunt: '👻',
  Stealth: '🌑',
};

/**
 * Identity color per status — Fire-orange Burn, Frost-cyan Freeze, and so on
 * (Regen/Conduct reuse the app's existing --hp-high/--conduct tokens) — so a
 * badge reads as "which status" by color alone, not just by its emoji.
 * Applied via inline style (mirrors TypeBadge/getTypeColor, since 9 statuses
 * is a JS lookup, not something worth 9 enumerated CSS classes) everywhere a
 * status chip renders: CombatantCard's badge, StatusDetailOverlay, and
 * HeroDetailOverlay's chip.
 */
const STATUS_COLOR: Record<string, string> = {
  Burn: '#e2683c',
  Bleed: '#c0392b',
  Freeze: '#7fd6e0',
  Daze: '#c9a0f5',
  Regen: '#4caf6a',
  Conduct: '#f5d90a',
  Poison: '#8bc34a',
  Haunt: '#7a5fc4',
  Stealth: '#6b7a99',
};

export function statusColor(statusId: string): string {
  return STATUS_COLOR[statusId] ?? '#d9a441';
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `rgba(...)` tint of a status's color, for chip backgrounds/borders — same soft-tinted-chip look styles.css already uses for --accent/--enemy (e.g. .switching-tag), just computed since these colors are per-status data rather than fixed custom properties. */
export function statusTint(statusId: string, alpha: number): string {
  const [r, g, b] = hexToRgb(statusColor(statusId));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Poison's timer is a fixed 3-round countdown to detonation (statusEngine.ts
 * tickEndOfRound: duration goes 3 -> 2 -> 1 -> detonate, never resetting on
 * reapplication — docs/conditions.md §7 Q3/Q4). A single emoji can't show
 * that progress, so PoisonPips below renders 3 small pips and fills one
 * more as detonation nears: freshly applied (duration 3) is 1 filled pip,
 * the final round before it pops (duration 1) is all 3.
 */
export function poisonTier(duration: number | undefined): 1 | 2 | 3 {
  if (duration === undefined || duration >= 3) return 1;
  if (duration === 2) return 2;
  return 3;
}

/** The 3-pip "how close to detonation" meter — sits next to Poison's emoji+magnitude in both CombatantCard and StatusDetailOverlay. Pip color is set here (Poison's own color, via currentColor) so callers don't each have to know it. */
export function PoisonPips({ duration }: { duration: number | undefined }) {
  const tier = poisonTier(duration);
  return (
    <span className="status-pips" style={{ color: statusColor('Poison') }} aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <span key={i} className={`status-pip${i <= tier ? ' status-pip-filled' : ''}`} />
      ))}
    </span>
  );
}
