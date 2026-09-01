import { useId, type ReactNode } from 'react';
import type { StatusDefinition } from '../../engine/content';
import { getTypeColor } from '../combat/typeColors';
import { ELEMENT_PATHS, FLAME } from './elementIcons';

// Elemental Force ids are `${Type}Force` (src/data/statuses.ts); stripping the suffix lets Force
// chips reuse the type's own colour and element glyph instead of fifteen authored entries.
const FORCE_ID_SUFFIX = 'Force';

function forceStatusType(statusId: string): string | undefined {
  if (!statusId.endsWith(FORCE_ID_SUFFIX)) return undefined;
  const base = statusId.slice(0, -FORCE_ID_SUFFIX.length);
  return ELEMENT_PATHS[base] ? base : undefined;
}

// The nine authored statuses: 24x24, `currentColor` only, nothing finer than ~2 units.
const STATUS_PATHS: Record<string, ReactNode> = {
  // Shared with the Fire element on purpose; the Force chip's arrow is what says "buff".
  Burn: FLAME,
  // Gash plus two drops — either alone is another glyph (claw, Mana droplet).
  Bleed: (
    <>
      <path d="M2.8 2.2c6.2 1.8 11.2 5.6 14.9 11.2-5.6-2.4-10.6-6.2-14.9-11.2Z" />
      <path d="M8 14c1.9 2.4 2.9 3.9 2.9 5.1a2.9 2.9 0 0 1-5.8 0c0-1.2 1-2.7 2.9-5.1Z" />
      <path d="M16.6 16.6c1.6 2 2.4 3.2 2.4 4.2a2.4 2.4 0 0 1-4.8 0c0-1 .8-2.2 2.4-4.2Z" />
    </>
  ),
  // Radial six-spoke, distinct from the Frost element's angular shards.
  Freeze: (
    <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <path d="M12 2.4v19.2" />
      <path d="M3.7 7.2 20.3 16.8" />
      <path d="M3.7 16.8 20.3 7.2" />
    </g>
  ),
  // Swirl, 1¼ turns — more closes into a disc at badge size.
  Daze: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      d="M2.8 12A6.9 6.9 0 0 1 16.6 12A2.9 2.9 0 0 1 10.8 12"
    />
  ),
  // The HP heart with a rising chevron subtracted (evenodd). Heart geometry copied from
  // statIcons.tsx STAT_PATHS.hp because this needs the raw `d`; redraw both together.
  Renew: (
    <path
      fillRule="evenodd"
      d="M12 21.6 3.7 13.1a5.3 5.3 0 0 1 7.5-7.5l.8.8.8-.8a5.3 5.3 0 0 1 7.5 7.5ZM12 9.6 7.4 14.2l1.8 1.8L12 13.2l2.8 2.8 1.8-1.8Z"
    />
  ),
  // Bare bolt; the Storm element carries a cloud so the two stay apart on one card.
  Conduct: <path d="M13.8 1.8 5.6 13.4h4.8L8.8 22.6 18.4 10.2h-5.2Z" />,
  // Trefoil (skull = Guardian, flask = Statuses header).
  Poison: (
    <>
      <circle cx="12" cy="6.2" r="4.6" />
      <circle cx="6.4" cy="15.8" r="4.6" />
      <circle cx="17.6" cy="15.8" r="4.6" />
      <circle cx="12" cy="12.8" r="3.4" />
    </>
  ),
  // Ghost, the only status glyph with a face (the Spirit element is faceless for this reason).
  Haunt: (
    <path
      fillRule="evenodd"
      d="M12 1.8c4.5 0 7.9 3.4 7.9 8v11c0 1.1-1.2 1.7-2 1l-2-1.8-2.1 1.9a1.3 1.3 0 0 1-1.7 0L10 20l-2 1.8c-.8.7-2 .1-2-1v-11c0-4.6 3.5-8 8-8ZM9.2 9.4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm5.6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"
    />
  ),
  // Closed eye.
  Stealth: (
    <g fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
      <path d="M2.6 9.6c2.6 3.6 5.8 5.4 9.4 5.4s6.8-1.8 9.4-5.4" />
      <path d="M3.6 16.6 5.8 13.4" />
      <path d="M8.6 19.2 9.8 15.4" />
      <path d="M15.4 19.2 14.2 15.4" />
      <path d="M20.4 16.6 18.2 13.4" />
    </g>
  ),
};

// Bottom-right up-arrow every Force chip wears, so fifteen chips read as one family first.
const FORCE_ARROW = <path d="M18.2 13.4 23.4 20h-3.2v3.4h-4V20H13Z" />;

// The element is scaled back and the corner masked out as a hole (rather than drawn over), since
// four elements reach into that corner at any scale and the hole works when both colours match.
const FORCE_ELEMENT_TRANSFORM = 'translate(-1.3 -1.7) scale(0.8)';

/**
 * The one place a status glyph is drawn. Falls back to the id's first letter for a status with no
 * authored path so new content is playable before it is drawn. `aria-hidden`: the wrapping chip
 * carries the name in its `title`.
 */
export function StatusGlyph({ statusId, className }: { statusId: string; className?: string }) {
  // React ids contain colons, a selector metacharacter — `url(#:r7:)` does not resolve everywhere.
  const maskId = `force-cut-${useId().replace(/:/g, '')}`;
  const forceType = forceStatusType(statusId);
  const path = forceType ? (
    <>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <rect x="0" y="0" width="24" height="24" fill="#fff" />
        <circle cx="18.9" cy="19.1" r="6" fill="#000" />
      </mask>
      <g mask={`url(#${maskId})`} transform={FORCE_ELEMENT_TRANSFORM}>
        {ELEMENT_PATHS[forceType]}
      </g>
      {FORCE_ARROW}
    </>
  ) : (
    STATUS_PATHS[statusId]
  );
  const cls = className ? ` ${className}` : '';
  if (!path) return <span className={`status-emoji${cls}`}>{statusId.slice(0, 1)}</span>;
  return (
    <svg className={`status-glyph${cls}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      {path}
    </svg>
  );
}

/** Identity colour per status; Renew/Conduct match the --hp-high/--conduct tokens. */
const STATUS_COLOR: Record<string, string> = {
  Burn: '#e2683c',
  Bleed: '#c0392b',
  Freeze: '#7fd6e0',
  Daze: '#c9a0f5',
  Renew: '#4caf6a',
  Conduct: '#f5d90a',
  Poison: '#8bc34a',
  Haunt: '#7a5fc4',
  Stealth: '#6b7a99',
};

export function statusColor(statusId: string): string {
  const forceType = forceStatusType(statusId);
  if (forceType) return getTypeColor(forceType);
  return STATUS_COLOR[statusId] ?? '#d9a441';
}

/** `rgba(...)` at `alpha` from a `#rrggbb` hex. Shared with passiveIcons.tsx. */
export function hexTint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Tint of a status's colour, for chip backgrounds/borders. */
export function statusTint(statusId: string, alpha: number): string {
  return hexTint(statusColor(statusId), alpha);
}

/** Poison counts 3 -> 2 -> 1 -> detonate and never resets; the pip meter fills one more each round. */
export function poisonTier(duration: number | undefined): 1 | 2 | 3 {
  if (duration === undefined || duration >= 3) return 1;
  if (duration === 2) return 2;
  return 3;
}

const PIPELINE_LABELS: Record<StatusDefinition['pipeline'], string> = {
  dot: 'Damage over time',
  hot: 'Heal over time',
  control: 'Control effect',
  timer: 'Delayed detonation',
  trigger: 'Trigger / mark',
  target: 'Targeting effect',
  basePower: 'Elemental Force',
  none: 'Effect',
};

export function pipelineLabel(pipeline: StatusDefinition['pipeline']): string {
  return PIPELINE_LABELS[pipeline];
}

/** How a status is removed, in prose — shared by StatusDetailOverlay and ReferenceOverlay. */
export function statusClearText(def: StatusDefinition): string {
  if (def.clearsOnSwitch) return 'Cleared by switching to the bench.';
  return def.positive ? "Persists through switching — Cleanse can't remove it." : 'Persists through switching — removed by Cleanse.';
}

/** The 3-pip "how close to detonation" meter beside Poison's badge. */
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
